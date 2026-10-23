// The backend as this demo runs it, and the collaboration server beside it.

import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { type CollabServer, createCollabServer } from '../../../packages/collab/src/server';
import { backendStorage } from '../../../packages/collab/src/storage';
import { createApi } from './api';
import { createCollabBackend, createTickets } from './collab';
import { DOCX, type Store, folderStore } from './store';

// A folder beside the demo, unless the environment names a bucket.
const store: Store = process.env.S3_BUCKET ? (await import('../../storage/server/bucket')).openBucket() : folderStore(resolve('documents'));

/** A first document to open, where there is none: the sample contract `npm run sample` writes. */
const seeded = (async () => {
  const sample = resolve('.seed/contract.docx');
  if (existsSync(sample) && !(await store.list()).some((file) => /\.docx$/i.test(file.key))) await store.put('contract.docx', new Uint8Array(readFileSync(sample)), DOCX);
})().catch((error: Error) => console.error(`No first document: ${error.message}`));

// Both are made by `vite.config.ts` when the environment has none: they last as long as the process.
const tickets = createTickets(process.env.TICKET_SECRET!);
const collabPort = Number(process.env.COLLAB_PORT ?? 7421);

// The collaboration server of this process, once it is started: asked who is in each room.
let rooms: CollabServer | undefined;

const api = createApi(() => store, {
  collabUrl: (host) => `http://${host}:${collabPort}`,
  tickets,
  inRoom: (room) => rooms?.rooms().find((open) => open.id === room)?.people ?? [],
});
const collab = createCollabBackend(() => store, { key: process.env.COLLAB_BACKEND_KEY!, tickets });

/** Answers what is asked of the backend, by the page or by the collaboration server; false for anything else. */
export async function backend(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  await seeded;
  return (await api(request, response)) || (await collab(request, response));
}

/**
 * The collaboration server, in this process to have one thing to start. It is
 * the one `npm run collab -- --backend …` runs, and it reaches the documents
 * the same way: through the three routes of `collab.ts`, over HTTP, with the key.
 */
export function startCollab(backendUrl: string): CollabServer {
  return (rooms = createCollabServer({
    port: collabPort,
    host: process.env.COLLAB_HOST,
    storage: backendStorage({ url: backendUrl, key: process.env.COLLAB_BACKEND_KEY }),
    // Soon after typing stops, so that it is soon seen where the documents are kept; 5 seconds is the usual.
    saveAfter: 2000,
    // A room lasts as long as someone is in it: a moment after the last one leaves, the document is
    // given back and the room is let go of. The moment is for a page that is only being loaded again.
    idle: 1500,
    // What happens in the rooms, in the terminal the demo runs in.
    onEvent: (event) => {
      if (event.type === 'join') console.log(`[collab] ${event.name || 'someone'} came into ${event.room}${event.readOnly ? ', to watch' : ''}`);
      else if (event.type === 'leave') console.log(`[collab] ${event.name || 'someone'} left ${event.room}`);
      else if (event.type === 'fold') console.log(`[collab] ${event.room}: ${event.changes} changes folded into its file${event.people ? `, with ${event.people} in it` : ''}`);
      else if (event.type === 'error') console.error(`[collab] ${event.room}: ${event.what}: ${event.error.message}`);
    },
  }));
}
