// One process for everything: Vite serves the pages, hands what is asked of
// the backend to `server/`, and starts the collaboration server beside them.
// Apart, they would be three: the pages, your backend, and
// `npm run collab -- --backend http://…/backend/docs`.
//
// The package is taken from its source, as in `apps/demo`.

import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';
import type { CollabServer } from '../../packages/collab/src/server';

const PORT = 5177;

function backend(): Plugin {
  return {
    name: 'rebodocs-realtime-backend',
    configureServer(server) {
      try {
        process.loadEnvFile(resolve(import.meta.dirname, '.env'));
      } catch {
        // No .env: the documents go to a folder.
      }
      // What the collaboration server shows the backend, and what signs the tickets: made here when not given.
      process.env.COLLAB_BACKEND_KEY ||= randomBytes(24).toString('base64url');
      process.env.TICKET_SECRET ||= randomBytes(24).toString('base64url');
      // Loaded through Vite, which reads TypeScript and takes the packages from their source.
      const load = () => server.ssrLoadModule('/server/dev.ts') as Promise<typeof import('./server/dev')>;
      server.middlewares.use((request, response, next) => {
        load()
          .then(({ backend }) => backend(request, response))
          .then((answered) => answered || next(), next);
      });

      // The collaboration server starts once, with the pages, and gives back what it has before leaving.
      let rooms: CollabServer | undefined;
      server.httpServer?.once('listening', () => {
        load().then(
          ({ startCollab }) => {
            const at = server.httpServer?.address();
            rooms = startCollab(`http://localhost:${typeof at === 'object' && at ? at.port : PORT}/backend/docs`);
            rooms.ready.then(
              () => server.config.logger.info(`  ➜  Rooms:   http://localhost:${rooms?.port}/ (the collaboration server)`),
              (error: Error) => server.config.logger.error(`The collaboration server could not start: ${error.message}`),
            );
          },
          (error: Error) => server.config.logger.error(error.message),
        );
      });
      server.httpServer?.once('close', () => rooms?.close());
      for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.once(signal, () => void (rooms?.flush() ?? Promise.resolve()).finally(() => process.exit(0)));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), backend()],
  resolve: {
    alias: { '@rebodocs/react': resolve(import.meta.dirname, '../../packages/react/src/index.ts') },
  },
  server: { port: PORT, strictPort: true },
});
