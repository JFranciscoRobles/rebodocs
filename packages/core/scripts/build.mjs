// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('core', {
  entries: { index: 'src/index.ts' },
  exports: { '.': 'index' },
  keywords: ['docx', 'word', 'pdf', 'templates', 'document', 'layout', 'mail-merge'],
  homepage: 'https://rebodocs.com/docs/server/',
});
