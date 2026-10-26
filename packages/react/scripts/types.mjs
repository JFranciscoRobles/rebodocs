// Writes the types of the package beside its bundle: the declarations of the
// component and of everything it is made of, as a tree that mirrors the
// source, with what one package imports from another turned into a path to
// its file. An application that installs the bundle has none of the other
// packages to look the names up in.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packages = resolve(here, '..');
const out = join(here, 'dist');

/** Where each name another package is imported by lives, from the folder of the packages. */
const FILES = {
  '@rebodocs/core': 'core/src/index',
  '@rebodocs/core/internal': 'core/src/internal',
  '@rebodocs/editor': 'editor/src/index',
  '@rebodocs/viewer': 'viewer/src/index',
  '@rebodocs/viewer/react': 'viewer/src/react',
  '@rebodocs/collab': 'collab/src/changes',
  '@rebodocs/collab/browser': 'collab/src/session',
  '@rebodocs/mcp': 'mcp/src/tools',
  '@rebodocs/mcp/browser': 'mcp/src/browser',
};

execFileSync(
  process.execPath,
  [resolve(packages, '../node_modules/typescript/bin/tsc'), '-p', join(here, 'tsconfig.json'), '--noEmit', 'false', '--declaration', '--emitDeclarationOnly', '--rootDir', packages, '--outDir', out],
  { stdio: 'inherit' },
);

let files = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.d.ts')) {
      files++;
      const text = readFileSync(path, 'utf8');
      const next = text.replace(/(from\s+|import\(\s*|import\s+)(['"])(@rebodocs\/[^'"]+)\2/g, (whole, before, quote, name) => {
        const file = FILES[name];
        if (!file) throw new Error(`${relative(out, path)} imports ${name}, which this script does not know where to find.`);
        const to = relative(dirname(path), join(out, file)).replaceAll('\\', '/');
        return `${before}${quote}${to.startsWith('.') ? to : `./${to}`}${quote}`;
      });
      if (next !== text) writeFileSync(path, next);
    }
  }
};
walk(out);
console.log(`types: ${files} declaration files in dist`);
