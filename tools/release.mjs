// Publishes the six packages, each its `dist/` as `tools/package.mjs` made it (React
// its folder), in the order they use each other, so none is on npm before what it needs.
// A version already on npm is passed over, so a release cut halfway is gone on
// with by running it again. `--dry-run` says what it would publish.
//
//   npm run release              (builds first)
//   npm run release -- --dry-run

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORDER = ['core', 'editor', 'viewer', 'collab', 'mcp', 'react'];
// Where each goes from: its `dist/`, but React, built on its own, which goes as its folder is.
const FROM = (name) => join(root, 'packages', name, ...(name === 'react' ? [] : ['dist']));
const dry = process.argv.includes('--dry-run');

const versions = new Set(ORDER.map((name) => JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8')).version));
if (versions.size !== 1) throw new Error(`Every package goes at the same version, and these are at ${[...versions].join(', ')}: give them all one.`);

for (const name of ORDER) {
  const dist = FROM(name);
  const { name: full, version } = JSON.parse(readFileSync(join(dist, 'package.json'), 'utf8'));
  let there = false;
  try {
    there = execFileSync('npm', ['view', `${full}@${version}`, 'version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() === version;
  } catch {}
  if (there) {
    console.log(`${full}@${version} is on npm already.`);
    continue;
  }
  execFileSync('npm', ['publish', dist, '--access', 'public', '--no-workspaces', ...(process.env.CI ? ['--provenance'] : []), ...(dry ? ['--dry-run'] : [])], { stdio: 'inherit' });
}
