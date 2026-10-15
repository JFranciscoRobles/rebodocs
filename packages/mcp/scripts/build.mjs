// Makes `dist/` a package to publish as it is: the bundle, its types, and a
// package.json of its own. The package.json beside the sources stays the one
// the repository uses, which points at the sources.
//
//   npm run build -w @rebodocs/mcp
//   npm publish ./packages/mcp/dist

import { execFileSync } from 'node:child_process';
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(here, '../..');
const packages = resolve(here, '..');
const out = join(here, 'dist');
const types = join(out, 'types');
const bin = (name) => join(root, 'node_modules', '.bin', name);

execFileSync(bin('vite'), ['build'], { cwd: here, stdio: 'inherit' });

// The declarations of the package and of the engine, as a tree beside the bundle; an import of
// the engine by name becomes a path to its file, as the application that installs it has no engine.
execFileSync(bin('tsc'), ['-p', join(here, 'tsconfig.build.json'), '--rootDir', packages, '--outDir', types], { stdio: 'inherit' });
let files = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.d.ts')) {
      files++;
      const text = readFileSync(path, 'utf8');
      let next = text.replace(/(from\s+|import\(\s*|import\s+)(['"])@rebodocs\/core\2/g, (_, before, quote) => {
        const to = relative(dirname(path), join(types, 'core/src/index')).replaceAll('\\', '/');
        return `${before}${quote}${to.startsWith('.') ? to : `./${to}`}${quote}`;
      });
      // With the extension, as Node's own resolution asks of a module.
      next = next.replace(/(from\s+|import\(\s*|import\s+)(['"])(\.{1,2}\/[^'"]+)\2/g, (whole, before, quote, path) => (path.endsWith('.js') ? whole : `${before}${quote}${path}.js${quote}`));
      if (/(from\s+|import\(\s*|import\s+)['"]@rebodocs\//.test(next)) throw new Error(`${relative(out, path)} imports a package this script does not know.`);
      if (next !== text) writeFileSync(path, next);
    }
  }
};
walk(types);

const source = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const entry = (name, file) => ({ types: `./types/mcp/src/${file}.d.ts`, import: `./${name}.js` });
const published = {
  name: source.name,
  version: source.version,
  description: source.description,
  license: source.license,
  homepage: 'https://rebodocs.com/docs/assistants/',
  repository: { type: 'git', url: 'git+https://github.com/JFranciscoRobles/rebodocs.git', directory: 'packages/mcp' },
  bugs: 'https://github.com/JFranciscoRobles/rebodocs/issues',
  keywords: ['docx', 'word', 'mcp', 'model-context-protocol', 'claude', 'ai', 'assistant', 'editor'],
  type: 'module',
  engines: { node: '>=22.12' },
  bin: { 'rebodocs-mcp': 'cli.js' },
  main: './index.js',
  types: './types/mcp/src/tools.d.ts',
  exports: {
    '.': entry('index', 'tools'),
    './browser': entry('browser', 'browser'),
    './claude': entry('claude', 'claude'),
  },
  dependencies: { '@anthropic-ai/sdk': source.dependencies['@anthropic-ai/sdk'] },
  publishConfig: { access: 'public' },
};
writeFileSync(join(out, 'package.json'), `${JSON.stringify(published, null, 2)}\n`);
for (const file of ['README.md', 'LICENSE']) copyFileSync(join(here, file), join(out, file));
console.log(`@rebodocs/mcp ${source.version}: dist/ is the package, ${files} declaration files in it.`);
