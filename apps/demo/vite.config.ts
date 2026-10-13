// The package is taken from its source, not from what it is built into: a
// change in `packages/react` shows here at once, with nothing to build first.
// An application of your own installs it from npm and needs none of this.

import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@rebodocs/react': resolve(import.meta.dirname, '../../packages/react/src/index.ts') },
  },
  server: { port: 5175 },
});
