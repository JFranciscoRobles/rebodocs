// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('viewer', {
  entries: { index: 'src/index.ts', react: 'src/react.ts' },
  exports: { '.': 'index', './react': 'react' },
  client: ['react'],
  keywords: ['docx', 'word', 'viewer', 'preview', 'thumbnail', 'react'],
  homepage: 'https://rebodocs.com/docs/viewer/',
});
