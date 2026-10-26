// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

// The worker of the spell checker first: the package takes it as a string.
await import('./spellworker.mjs');

await buildPackage('editor', {
  entries: { index: 'src/index.ts', 'locales/zh-Hans': 'src/locales/zh-Hans.ts', 'locales/zh-Hant': 'src/locales/zh-Hant.ts' },
  exports: { '.': 'index', './locales/zh-Hans': 'locales/zh-Hans', './locales/zh-Hant': 'locales/zh-Hant' },
  keywords: ['docx', 'word', 'editor', 'word-processor', 'wysiwyg', 'vanilla'],
  homepage: 'https://rebodocs.com/docs/vanilla/',
});
