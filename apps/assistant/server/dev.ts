// The backend as this demo runs it: the one of the realtime demo, which keeps
// the documents (in a folder, or in a bucket as the storage demo does) and lets
// people into their rooms, and beside it the way to Claude.

import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { type CollabServer, createCollabServer } from '../../../packages/collab/src/server';
import { backendStorage } from '../../../packages/collab/src/storage';
import { assistantRoute } from '../../../packages/mcp/src/claude';
import { createApi } from '../../realtime/server/api';
import { createCollabBackend, createTickets } from '../../realtime/server/collab';
import { DOCX, type Store, folderStore } from '../../realtime/server/store';

const store: Store = process.env.S3_BUCKET ? (await import('../../storage/server/bucket')).openBucket() : folderStore(resolve('documents'));

/** A first document to open, where there is none: the sample contract `npm run sample` writes. */
const seeded = (async () => {
  const sample = resolve('.seed/contract.docx');
  if (existsSync(sample) && !(await store.list()).some((file) => /\.docx$/i.test(file.key))) await store.put('contract.docx', new Uint8Array(readFileSync(sample)), DOCX);
})().catch((error: Error) => console.error(`No first document: ${error.message}`));

const tickets = createTickets(process.env.TICKET_SECRET!);
const collabPort = Number(process.env.COLLAB_PORT ?? 7431);
let rooms: CollabServer | undefined;

const api = createApi(() => store, {
  collabUrl: (host) => `http://${host}:${collabPort}`,
  tickets,
  inRoom: (room) => rooms?.rooms().find((open) => open.id === room)?.people ?? [],
});
const collab = createCollabBackend(() => store, { key: process.env.COLLAB_BACKEND_KEY!, tickets });

// The key stays here: the page sends the conversation, and gets back what Claude answered.
const effort = process.env.ASSISTANT_EFFORT;
const assistant = assistantRoute({
  model: process.env.ASSISTANT_MODEL || undefined,
  effort: effort === 'low' || effort === 'medium' || effort === 'high' ? effort : undefined,
  perMinute: Number(process.env.ASSISTANT_PER_MINUTE) || undefined,
});

/** Answers what is asked of the backend, by the page or by the collaboration server; false for anything else. */
export async function backend(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  await seeded;
  return (await assistant(request, response)) || (await api(request, response)) || (await collab(request, response));
}

/** The collaboration server, in this process, as in the realtime demo. */
export function startCollab(backendUrl: string): CollabServer {
  return (rooms = createCollabServer({
    port: collabPort,
    host: process.env.COLLAB_HOST,
    // Every change logged as it comes, as in apps/realtime: the server can stop at any moment and lose none.
    storage: backendStorage({ url: backendUrl, key: process.env.COLLAB_BACKEND_KEY, log: process.env.COLLAB_LOG !== '0' }),
    saveAfter: 2000,
    idle: 1500,
  }));
}
