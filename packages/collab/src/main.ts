// Runs the server people's editors meet at to work on a document together.
//
//   vite-node packages/collab/src/main.ts [--port 7420] [--host 0.0.0.0] [--token word] [--static folder]
//                                         [--data folder | --memory | --backend https://… --backend-key key]
//                                         [--save-after 5] [--save-every 30] [--recheck-every 0]
//
// The documents are kept in a folder (--data), nowhere (--memory), or by the
// system the server works for (--backend), which is then also the one to say
// who may edit each of them.
//
// With --static it also serves the editor, built (apps/playground/dist): one
// address is then all there is to give to the others.

import { networkInterfaces } from 'node:os';
import { createCollabServer, storedRooms } from './server';
import { DEFAULT_COLLAB_PORT } from './protocol';
import { backendStorage, folderStorage, memoryStorage } from './storage';

const args = process.argv.slice(2);
const value = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at < 0 ? undefined : args.splice(at, 2)[1];
};

const port = Number(value('--port') ?? process.env.REBODOCS_COLLAB_PORT ?? DEFAULT_COLLAB_PORT);
const host = value('--host');
const has = (name: string) => {
  const at = args.indexOf(name);
  if (at >= 0) args.splice(at, 1);
  return at >= 0;
};
const memory = has('--memory');
const backend = value('--backend') ?? process.env.REBODOCS_COLLAB_BACKEND;
const backendKey = value('--backend-key') ?? process.env.REBODOCS_COLLAB_BACKEND_KEY;
const saveAfter = Number(value('--save-after') ?? 5);
const saveEvery = Number(value('--save-every') ?? 30);
const recheckEvery = Number(value('--recheck-every') ?? process.env.REBODOCS_COLLAB_RECHECK_EVERY ?? 0);
const dataDir = value('--data') ?? (memory || backend ? undefined : 'rooms');
const token = value('--token') ?? process.env.REBODOCS_COLLAB_TOKEN;
const staticDir = value('--static');
if (
  args.length ||
  !Number.isInteger(port) ||
  port < 0 ||
  port > 65535 ||
  !(saveAfter >= 1) ||
  !(saveEvery >= 1) ||
  !(recheckEvery >= 0) ||
  [memory, !!backend, !!dataDir].filter(Boolean).length !== 1
) {
  console.error(
    'Usage: main.ts [--port 7420] [--host 0.0.0.0] [--token word] [--static folder] [--data folder | --memory | --backend https://… --backend-key key [--save-after 5] [--save-every 30] [--recheck-every 0]]',
  );
  process.exit(2);
}

const storage = backend ? backendStorage({ url: backend, key: backendKey }) : dataDir ? folderStorage(dataDir) : memoryStorage();
const where = backend ? `documents at ${backend}, nothing kept here` : dataDir ? `rooms kept in ${dataDir}: ${storedRooms(dataDir).length}` : 'rooms in memory only';
const server = createCollabServer({ port, host, storage, token, staticDir, saveAfter: saveAfter * 1000, saveEvery: saveEvery * 1000, recheckEvery: recheckEvery * 1000 || undefined });
server.ready.then(
  () => {
    const open = host && !/^(127\.|localhost$|::1$)/.test(host);
    console.error(`[collab] Listening on http://${host ?? '127.0.0.1'}:${server.port} · ${where}`);
    if (open) {
      const addresses = Object.values(networkInterfaces())
        .flatMap((list) => list ?? [])
        .filter((a) => a.family === 'IPv4' && !a.internal);
      for (const a of addresses) console.error(`[collab] On the network: http://${a.address}:${server.port}`);
      if (!token && !backend) console.error('[collab] Without --token, anyone who reaches this address can start sharing documents here.');
    } else {
      console.error('[collab] Only this machine can connect. For others to: --host 0.0.0.0');
    }
  },
  (error: Error) => {
    console.error(`[collab] Could not listen on port ${port}: ${error.message}`);
    process.exit(1);
  },
);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    // What the system does not have yet of the documents being worked on goes to it before leaving.
    void server.flush().finally(() => {
      server.close();
      process.exit(0);
    });
  });
}
