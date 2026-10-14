// What the collaboration server asks of the backend. It coordinates and keeps
// nothing: it asks here for the document when a room opens, gives it back as
// it changes, and asks whether each person may come in. So the documents stay
// behind one door, this one.
//
//   GET  /backend/docs/<room>          the document, as a DOCX
//   PUT  /backend/docs/<room>          the document as it is now, to keep
//   POST /backend/docs/<room>/access   { "ticket": "…" } → { "name": "…" }, or 403
//
// Those three are asked by the collaboration server, which shows a key. The
// page asks for one thing, in `api.ts`: a ticket to come into a room.

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DOCX, type Store } from './store';

/**
 * The room a document is worked on in. A room is named with letters, digits,
 * `-` and `_` alone, and the name of a file may have anything, so the room
 * is a digest of the name. An application of your own has ids for its
 * documents already, and uses those.
 */
export const roomOf = (key: string) => createHash('sha256').update(key).digest('base64url').slice(0, 22);

export interface Tickets {
  /** What lets a person into a room under a name, for a while. */
  issue(room: string, name: string): string;
  /** The name the ticket was given for, when it is for this room, untouched and not too old. */
  check(room: string, ticket: string): string | undefined;
}

/** Tickets signed with a secret that only the backend has: nothing is kept to check one. */
export function createTickets(secret: string, life = 8 * 60 * 60 * 1000): Tickets {
  const sign = (payload: string) => createHmac('sha256', secret).update(payload).digest('base64url');
  return {
    issue(room, name) {
      const payload = Buffer.from(JSON.stringify({ room, name, until: Date.now() + life })).toString('base64url');
      return `${payload}.${sign(payload)}`;
    },
    check(room, ticket) {
      const [payload, signature = ''] = ticket.split('.');
      const expected = Buffer.from(sign(payload));
      const given = Buffer.from(signature);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return undefined;
      try {
        const said = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { room?: unknown; name?: unknown; until?: unknown };
        return said.room === room && typeof said.name === 'string' && typeof said.until === 'number' && said.until > Date.now() ? said.name : undefined;
      } catch {
        return undefined;
      }
    },
  };
}

export interface CollabBackendOptions {
  /** What the collaboration server shows to be let in, as `Authorization: Bearer …`. */
  key: string;
  tickets: Tickets;
}

/**
 * Answers the collaboration server under `/backend/docs`; says false for any
 * other request.
 */
export function createCollabBackend(store: () => Store, options: CollabBackendOptions) {
  // Which document each room is of. What is not here yet is looked for among the documents.
  const keys = new Map<string, string>();
  const keyOf = async (room: string): Promise<string | undefined> => {
    if (!keys.has(room)) for (const file of await store().list()) keys.set(roomOf(file.key), file.key);
    return keys.get(room);
  };
  const allowed = (request: IncomingMessage) => {
    const given = Buffer.from(request.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${options.key}`);
    return given.length === expected.length && timingSafeEqual(given, expected);
  };
  const read = async (request: IncomingMessage, most: number): Promise<Buffer | undefined> => {
    const parts: Buffer[] = [];
    let size = 0;
    for await (const part of request) {
      size += (part as Buffer).length;
      if (size > most) return undefined;
      parts.push(part as Buffer);
    }
    return Buffer.concat(parts);
  };

  return async function collab(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const [, first, second, room, action, ...rest] = new URL(request.url ?? '/', 'http://localhost').pathname.split('/');
    if (first !== 'backend' || second !== 'docs') return false;
    const end = (status: number, body?: unknown) => {
      response.writeHead(status, body === undefined ? {} : { 'content-type': 'application/json; charset=utf-8' });
      response.end(body === undefined ? undefined : JSON.stringify(body));
      return true;
    };
    try {
      if (!allowed(request)) return end(401);
      if (!room || rest.length) return end(404);

      if (action === 'access' && request.method === 'POST') {
        const body = await read(request, 16_384);
        const ticket = body && (JSON.parse(body.toString('utf8') || '{}') as { ticket?: unknown }).ticket;
        const name = typeof ticket === 'string' ? options.tickets.check(room, ticket) : undefined;
        return name === undefined ? end(403) : end(200, { name });
      }
      if (action) return end(404);

      const key = await keyOf(room);
      if (!key || !/\.docx$/i.test(key)) return end(404);
      if (request.method === 'GET') {
        const file = await store().get(key);
        if (!file) return end(404);
        response.writeHead(200, { 'content-type': DOCX, 'x-document-name': encodeURIComponent(key.split('/').pop()!) });
        response.end(file);
        return true;
      }
      if (request.method === 'PUT') {
        const file = await read(request, 100_000_000);
        if (!file) return end(413);
        await store().put(key, file, DOCX);
        return end(204);
      }
      return end(405);
    } catch (error) {
      console.error(error);
      return end(500);
    }
  };
}
