// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('editor', {
  entries: { index: 'src/index.ts' },
  exports: { '.': 'index' },
  keywords: ['docx', 'word', 'editor', 'word-processor', 'wysiwyg', 'vanilla'],
  homepage: 'https://rebodocs.com/docs/vanilla/',
});
