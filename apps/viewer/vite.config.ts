// The package is taken from its source, as npm links it in the repository: a
// change in `packages/viewer` shows here at once, with nothing to build first.
// An application of your own installs it from npm and needs none of this.

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // On the network too, to open it from a phone: http://<this computer>:5181.
  server: { port: 5181, host: true },
});
