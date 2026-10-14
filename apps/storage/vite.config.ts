// One process for the pages and for the backend: Vite serves the first, and
// hands what is under `/api` to `server/api.ts`, which is plain Node and goes
// as it is into any server of your own.
//
// The package is taken from its source, as in `apps/demo`.

import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

const PORT = 5176;

function backend(): Plugin {
  return {
    name: 'rebodocs-storage-backend',
    configureServer(server) {
      try {
        process.loadEnvFile(resolve(import.meta.dirname, '.env'));
      } catch {
        // No .env yet: the first request says what is missing.
      }
      // Loaded through Vite, which reads TypeScript and takes the packages from their source; a change in it shows without starting again.
      const load = () => server.ssrLoadModule('/server/dev.ts') as Promise<typeof import('./server/dev')>;
      server.middlewares.use((request, response, next) => {
        load()
          .then(({ api }) => api(request, response))
          .then((answered) => answered || next(), next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), backend()],
  resolve: {
    alias: { '@rebodocs/react': resolve(import.meta.dirname, '../../packages/react/src/index.ts') },
  },
  // The port is part of the origin the bucket was told to let in: no other will do.
  server: { port: PORT, strictPort: true },
});
