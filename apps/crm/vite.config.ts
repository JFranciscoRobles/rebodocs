// The pages, and beside them the one route a CRM adds for the assistant: the
// key of the Claude API stays in this process and never reaches the browser.
// Everything else is the page's: the documents are kept in the browser, as
// the CRM would keep them in its own storage.
//
// The package is taken from its source, as in `apps/demo`.

import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig } from 'vite';

function assistant(): Plugin {
  return {
    name: 'rebodocs-crm-assistant',
    configureServer(server) {
      try {
        process.loadEnvFile(resolve(import.meta.dirname, '.env'));
      } catch {
        // No .env: the assistant says it has no key.
      }
      // Loaded through Vite, which reads TypeScript and takes the packages from their source.
      const load = () => server.ssrLoadModule('/server/assistant.ts') as Promise<typeof import('./server/assistant')>;
      server.middlewares.use((request, response, next) => {
        load()
          .then(({ route }) => route(request, response))
          .then((answered) => answered || next(), next);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), assistant()],
  resolve: {
    alias: { '@rebodocs/react': resolve(import.meta.dirname, '../../packages/react/src/index.ts') },
  },
  server: { port: 5180, strictPort: true },
});
