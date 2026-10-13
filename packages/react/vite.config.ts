// Builds the component as a package another project can install: one file
// with the whole editor in it, and React left out for the project to bring.
// Its types are written after it, by `scripts/types.mjs`.

import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: true,
    lib: {
      entry: { index: resolve(import.meta.dirname, 'src/index.ts'), mount: resolve(import.meta.dirname, 'src/mount.ts') },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
      output: {
        // What draws in the browser: Next.js has to be told, in the file itself.
        banner: (chunk) => (chunk.name === 'index' ? "'use client';" : ''),
      },
    },
  },
});
