// The worker of the spell checker, with nspell inside it, as a string the
// editor makes the worker from (src/spellcheck.worker.code.ts): every bundler
// takes a string, and none has to know how to find a worker. Run it again
// after changing src/spellcheck.worker.ts: `npm run spellworker -w @rebodocs/editor`.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'vite';

const here = join(import.meta.dirname, '..');
const out = join(here, 'node_modules/.spellworker');
await build({
  root: here,
  configFile: false,
  logLevel: 'warn',
  build: {
    outDir: out,
    emptyOutDir: true,
    minify: true,
    lib: { entry: join(here, 'src/spellcheck.worker.ts'), formats: ['iife'], name: 'spellworker', fileName: () => 'worker.js' },
  },
});
// The notice of what it holds goes with it, as the licence of nspell asks.
const notice = '/*! nspell (c) Titus Wormer, MIT License: https://github.com/wooorm/nspell. is-buffer (c) Feross Aboukhadijeh, MIT License */\n';
const code = notice + readFileSync(join(out, 'worker.js'), 'utf8').trim();
rmSync(out, { recursive: true, force: true });
writeFileSync(
  join(here, 'src/spellcheck.worker.code.ts'),
  `// Made by scripts/spellworker.mjs from spellcheck.worker.ts and nspell (MIT): do not change it by hand.\nexport const SPELL_WORKER = ${JSON.stringify(code)};\n`,
);
console.log(`src/spellcheck.worker.code.ts: ${(code.length / 1024).toFixed(1)} KB`);
