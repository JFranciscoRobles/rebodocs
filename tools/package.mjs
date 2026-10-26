// Makes the `dist/` of a package a package to publish as it is: its code in
// files of its own, its types beside them, and a package.json of its own. The
// package.json beside the sources stays the one the repository uses, which
// points at the sources; npm gets the one written here.
//
// What another package of the repository the package uses is left out of its
// files and named as a dependency at the version that package is at, the same
// for all when they are published together: `@rebodocs/editor` asks npm for
// `@rebodocs/core`, it does not carry a copy. `@rebodocs/react` is the
// exception, built on its own, with everything inside.
//
//   npm run build -w @rebodocs/<name>
//   npm publish ./packages/<name>/dist

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packages = join(root, 'packages');

/**
 * @param {string} name The folder of the package in `packages/`.
 * @param {{
 *   entries: Record<string, string>,
 *   exports: Record<string, string>,
 *   bin?: Record<string, string>,
 *   node?: boolean,
 *   client?: string[],
 *   keywords: string[],
 *   homepage: string,
 * }} spec `entries`: the file each output is built from; `exports`: what each
 *   export of the package is, by the name of its output; `bin`: commands, by
 *   output; `node`: whether it runs in Node rather than anywhere; `client`: the
 *   outputs that draw in the browser, which Next.js has to be told in the file.
 */
export async function buildPackage(name, spec) {
  const here = join(packages, name);
  const out = join(here, 'dist');
  const types = join(out, 'types');
  const source = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
  const deps = source.dependencies ?? {};
  // The packages of the repository it uses, at the version they are all published at.
  const ours = Object.keys({ ...deps, ...source.devDependencies }).filter((dep) => dep.startsWith('@rebodocs/'));
  const theirs = Object.keys(deps).filter((dep) => !dep.startsWith('@rebodocs/'));
  // What the application brings, React: neither in the files nor installed by npm.
  const peers = source.peerDependencies ?? {};
  theirs.push(...Object.keys(peers));
  const external = [...ours, ...theirs].flatMap((dep) => [dep, new RegExp(`^${dep.replace('/', '\\/')}/`)]);
  const commands = new Set(Object.values(spec.bin ?? {}));

  rmSync(out, { recursive: true, force: true });
  await build({
    root: here,
    configFile: false,
    logLevel: 'warn',
    build: {
      ssr: true,
      target: spec.node ? 'node22' : 'es2022',
      outDir: out,
      emptyOutDir: false,
      sourcemap: true,
      rollupOptions: {
        input: Object.fromEntries(Object.entries(spec.entries).map(([output, file]) => [output, join(here, file)])),
        external,
        output: {
          format: 'es',
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          banner: (chunk) => (commands.has(chunk.name) ? '#!/usr/bin/env node' : spec.client?.includes(chunk.name) && chunk.isEntry ? "'use client';" : ''),
        },
      },
    },
    // What is not another package goes in the files; the rest is npm's to install.
    ssr: { noExternal: true, external: [...ours, ...theirs] },
  });

  // The declarations, as a tree of the packages folder; those of the packages it uses are theirs to give.
  const config = join(out, 'tsconfig.types.json');
  writeFileSync(
    config,
    JSON.stringify({
      extends: join(root, 'tsconfig.json'),
      // What a package marks @internal is for its own files, not for whoever uses it: it is left out.
      compilerOptions: { noEmit: false, declaration: true, emitDeclarationOnly: true, stripInternal: true, rootDir: packages, outDir: types },
      include: [join(here, 'src')],
    }),
  );
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', config], { stdio: 'inherit' });
  rmSync(config);
  for (const other of readdirSync(types)) if (other !== name) rmSync(join(types, other), { recursive: true, force: true });
  let files = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.d.ts')) {
        files++;
        const text = readFileSync(path, 'utf8');
        // With the extension, as Node's own resolution asks of a module.
        const next = text.replace(/(from\s+|import\(\s*|import\s+)(['"])(\.{1,2}\/[^'"]+)\2/g, (whole, before, quote, file) => (file.endsWith('.js') ? whole : `${before}${quote}${file}.js${quote}`));
        if (next !== text) writeFileSync(path, next);
      }
    }
  };
  walk(types);

  const typesOf = (output) => `./types/${name}/${spec.entries[output].replace(/\.ts$/, '.d.ts')}`;
  const version = source.version;
  // Each package of the repository it uses, at the version that package is at: one patched alone still asks for the others as they are.
  const versionOf = (dep) => JSON.parse(readFileSync(join(packages, dep.slice('@rebodocs/'.length), 'package.json'), 'utf8')).version;
  const published = {
    name: source.name,
    version,
    description: source.description,
    license: source.license,
    homepage: spec.homepage,
    repository: { type: 'git', url: 'git+https://github.com/JFranciscoRobles/rebodocs.git', directory: `packages/${name}` },
    bugs: 'https://github.com/JFranciscoRobles/rebodocs/issues',
    keywords: spec.keywords,
    type: 'module',
    sideEffects: false,
    ...(spec.node ? { engines: { node: '>=22.12' } } : {}),
    ...(spec.bin ? { bin: Object.fromEntries(Object.entries(spec.bin).map(([command, output]) => [command, `${output}.js`])) } : {}),
    main: `./${spec.exports['.']}.js`,
    types: typesOf(spec.exports['.']),
    // `default` too: Node from 22.12 loads these with require() as well, for a server compiled to CommonJS (Nest).
    exports: Object.fromEntries(Object.entries(spec.exports).map(([path, output]) => [path, { types: typesOf(output), import: `./${output}.js`, default: `./${output}.js` }])),
    // For TypeScript set to resolve as old Node did, which does not read `exports`.
    typesVersions: {
      '*': Object.fromEntries(
        Object.entries(spec.exports)
          .filter(([path]) => path !== '.')
          .map(([path, output]) => [path.slice(2), [typesOf(output).slice(2)]]),
      ),
    },
    dependencies: Object.fromEntries([...ours.map((dep) => [dep, versionOf(dep)]), ...theirs.filter((dep) => !(dep in peers)).map((dep) => [dep, deps[dep]])].sort(([a], [b]) => a.localeCompare(b))),
    ...(source.peerDependencies ? { peerDependencies: peers, peerDependenciesMeta: source.peerDependenciesMeta } : {}),
    publishConfig: { access: 'public' },
  };
  writeFileSync(join(out, 'package.json'), `${JSON.stringify(published, null, 2)}\n`);
  for (const file of ['README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) copyFileSync(existsSync(join(here, file)) ? join(here, file) : join(root, file), join(out, file));
  console.log(`${source.name} ${version}: dist/ is the package, ${files} declaration files in it.`);
}
