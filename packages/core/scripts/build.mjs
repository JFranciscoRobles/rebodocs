// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('core', {
  entries: { index: 'src/index.ts', internal: 'src/internal.ts' },
  // What the packages of the repository use of the engine besides its API: with no promise, at the same version.
  exports: { '.': 'index', './internal': 'internal' },
  keywords: ['docx', 'word', 'pdf', 'templates', 'document', 'layout', 'mail-merge'],
  homepage: 'https://rebodocs.com/docs/server/',
});
