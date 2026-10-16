// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('collab', {
  entries: { index: 'src/changes.ts', browser: 'src/session.ts', server: 'src/server.ts', storage: 'src/storage.ts', cli: 'src/main.ts' },
  exports: { '.': 'index', './browser': 'browser', './server': 'server', './storage': 'storage' },
  bin: { 'rebodocs-collab': 'cli' },
  node: true,
  keywords: ['docx', 'word', 'collaboration', 'real-time', 'editor'],
  homepage: 'https://rebodocs.com/docs/collaboration/',
});
