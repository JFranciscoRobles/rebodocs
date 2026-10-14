// What the page asks of the backend: which documents there are, a new one,
// and a ticket to come into the room of one.
//
//   GET  /api/docs            the documents, and who is in the room of each now
//   POST /api/docs?key=…      a new, empty one
//   POST /api/room?key=…      for { "name": "…" }: where its room is, and a ticket into it
//
// The ticket is where an application of your own decides: it knows who is
// signed in and whether they may edit that document. Here anyone may, under
// the name they give.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createDoc, exportDocx } from '@rebodocs/core';
import { type Tickets, roomOf } from './collab';
import { DOCX, type Store } from './store';

/** A request that cannot be answered, and the status that says why. */
class Refused extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function keyOf(url: URL): string {
  const key = url.searchParams.get('key') ?? '';
  if (!key || key.length > 200 || /[/\\]/.test(key) || key.startsWith('.') || !/\.docx$/i.test(key)) throw new Refused(400, 'That is not the name of a document.');
  return key;
}

async function bodyOf(request: IncomingMessage): Promise<Record<string, unknown>> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of request) {
    size += (part as Buffer).length;
    if (size > 16_384) throw new Refused(413, 'Too much to read.');
    parts.push(part as Buffer);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(parts).toString('utf8') || '{}');
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    throw new Refused(400, 'The body is not JSON.');
  }
}

export interface ApiOptions {
  /** Where the collaboration server is, for a browser that reached this backend at `host`. */
  collabUrl(host: string): string;
  tickets: Tickets;
  /** What the people in a room now are called; nobody when it is not open. */
  inRoom?(room: string): string[];
}

/**
 * Answers the requests under `/api`; says false for any other, so that
 * whatever serves the pages can go on with it.
 */
export function createApi(store: () => Store, options: ApiOptions) {
  const routes: Record<string, (url: URL, request: IncomingMessage) => Promise<unknown>> = {
    'GET /api/docs': async () => (await store().list()).filter((file) => /\.docx$/i.test(file.key)).map((file) => ({ ...file, people: options.inRoom?.(roomOf(file.key)) ?? [] })),
    'POST /api/docs': async (url) => {
      const key = keyOf(url);
      if (await store().get(key)) throw new Refused(409, 'There is a document with that name already.');
      await store().put(key, exportDocx(createDoc()), DOCX);
      return { key };
    },
    'POST /api/room': async (url, request) => {
      const key = keyOf(url);
      const name = String((await bodyOf(request)).name ?? '').trim().slice(0, 80) || 'Someone';
      if (!(await store().get(key))) throw new Refused(404, 'There is no such document.');
      const room = roomOf(key);
      return { url: options.collabUrl(new URL(`http://${request.headers.host ?? 'localhost'}`).hostname), room, ticket: options.tickets.issue(room, name) };
    },
  };

  return async function api(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return false;
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    const route = routes[`${request.method} ${url.pathname}`];
    if (!route) {
      send(404, { error: 'There is nothing at that address.' });
      return true;
    }
    try {
      send(200, await route(url, request));
    } catch (error) {
      if (error instanceof Refused) send(error.status, { error: error.message });
      else {
        console.error(error);
        send(500, { error: 'The server could not do that. Its log says why.' });
      }
    }
    return true;
  };
}
