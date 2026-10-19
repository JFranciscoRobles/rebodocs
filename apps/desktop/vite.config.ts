// The pages of the application. Tauri shows them from this server while it is
// developed (`npm run dev`), and from `dist` once built.

import { defineConfig } from 'vite';

export default defineConfig({
  // Tauri waits for this very port: no other will do.
  server: { port: 5178, strictPort: true },
  // What Tauri prints would be wiped off with the screen.
  clearScreen: false,
  build: { target: 'safari15', outDir: 'dist' },
});
