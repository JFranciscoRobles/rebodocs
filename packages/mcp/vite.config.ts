// Builds the package as it goes to npm: the engine inside, so that it needs no
// other package of this repository, and the Claude SDK left out for npm to
// install. Four ways in: the tools, the editor's side, the route to Claude, and
// the server a client such as Claude Desktop starts (`rebodocs-mcp`).
// `scripts/build.mjs` runs it and writes the types and the package beside it.

import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const src = (file: string) => resolve(import.meta.dirname, 'src', file);

export default defineConfig({
  build: {
    ssr: true,
    target: 'node22',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: { index: src('tools.ts'), browser: src('browser.ts'), claude: src('claude.ts'), cli: src('main.ts') },
      external: ['@anthropic-ai/sdk'],
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        // What a client runs.
        banner: (chunk) => (chunk.name === 'cli' ? '#!/usr/bin/env node' : ''),
      },
    },
  },
  // Everything but the SDK goes in the files: the engine is not on npm by itself.
  ssr: { noExternal: true, external: ['@anthropic-ai/sdk'] },
});
