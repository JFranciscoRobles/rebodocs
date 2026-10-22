// The package as it goes to npm: `tools/package.mjs` says how.
import { buildPackage } from '../../../tools/package.mjs';

await buildPackage('mcp', {
  entries: { index: 'src/tools.ts', browser: 'src/browser.ts', claude: 'src/claude.ts', cli: 'src/main.ts', generate: 'src/generate.ts' },
  exports: { '.': 'index', './browser': 'browser', './claude': 'claude' },
  bin: { 'rebodocs-mcp': 'cli', 'rebodocs-generate': 'generate' },
  node: true,
  keywords: ['docx', 'word', 'mcp', 'model-context-protocol', 'claude', 'ai', 'assistant', 'editor'],
  homepage: 'https://rebodocs.com/docs/assistants/',
});
