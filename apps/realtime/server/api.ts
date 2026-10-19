// What the page asks of the backend: which documents there are, a new one,
// and a ticket to come into the room of one.
//
//   GET  /api/docs            the documents, and who is in the room of each now
//   POST /api/docs?key=…      a new, empty one
//   POST /api/room?key=…      for { "name": "…" }: where its room is, and a ticket into it
//   GET  /api/versions?key=…  the versions kept of it, the newest first
//   GET  /api/version?key=…&id=…   one of them, as a DOCX
//   POST /api/versions?key=…&author=…&label=…   the DOCX in the body kept as a version
//
// The ticket is where an application of your own decides: it knows who is
// signed in and whether they may edit that document. Here anyone may, under
// the name they give.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createDoc, exportDocx } from '@rebodocs/core';
import { type Tickets, roomOf } from './collab';
import { DOCX, type Store } from './store';
import { VERSIONS, isVersionOf, keepVersion, versionsOf } from './versions';

/** What a route answers when it wrote the answer itself. */
const SENT = Symbol('sent');

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

async function bytesOf(request: IncomingMessage, most: number): Promise<Uint8Array> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of request) {
    size += (part as Buffer).length;
    if (size > most) throw new Refused(413, 'Too much to read.');
    parts.push(part as Buffer);
  }
  return new Uint8Array(Buffer.concat(parts));
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
  const routes: Record<string, (url: URL, request: IncomingMessage, response: ServerResponse) => Promise<unknown>> = {
    // The versions are beside the documents, not among them.
    'GET /api/docs': async () => (await store().list()).filter((file) => /\.docx$/i.test(file.key) && !file.key.startsWith(VERSIONS)).map((file) => ({ ...file, people: options.inRoom?.(roomOf(file.key)) ?? [] })),
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
    'GET /api/versions': async (url) => versionsOf(store(), keyOf(url)),
    'GET /api/version': async (url, _, response) => {
      const key = keyOf(url);
      const id = url.searchParams.get('id') ?? '';
      const file = isVersionOf(id, key) ? await store().get(id) : undefined;
      if (!file) throw new Refused(404, 'There is no such version.');
      response.writeHead(200, { 'content-type': DOCX, 'cache-control': 'no-store' });
      response.end(file);
      return SENT;
    },
    'POST /api/versions': async (url, request) => {
      const key = keyOf(url);
      if (!(await store().get(key))) throw new Refused(404, 'There is no such document.');
      const author = (url.searchParams.get('author') ?? '').trim().slice(0, 80);
      const label = (url.searchParams.get('label') ?? '').trim().slice(0, 200);
      return { id: await keepVersion(store(), key, await bytesOf(request, 100_000_000), { ...(author ? { author } : {}), ...(label ? { label } : {}) }) };
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
      const answer = await route(url, request, response);
      if (answer !== SENT) send(200, answer);
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
