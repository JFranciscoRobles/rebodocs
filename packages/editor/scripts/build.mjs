// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

// The worker of the spell checker first: the package takes it as a string.
await import('./spellworker.mjs');

await buildPackage('editor', {
  entries: { index: 'src/index.ts' },
  exports: { '.': 'index' },
  keywords: ['docx', 'word', 'editor', 'word-processor', 'wysiwyg', 'vanilla'],
  homepage: 'https://rebodocs.com/docs/vanilla/',
});
