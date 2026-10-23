// The public API of @rebodocs/core, as a file to read in a diff: every name
// `src/index.ts` exports, by module, with its declaration as the source has
// it. A change to what the package promises shows there; one to what it
// keeps to itself (`src/internal.ts`) does not.
//
//   node tools/api-report.mjs            writes packages/core/API.md
//   node tools/api-report.mjs --check    says whether it is out of date (the tests ask)
//   node tools/api-report.mjs --unnamed  the types public declarations mention that the package does not export, as JSON

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'packages/core/src');
const REPORT = join(ROOT, 'packages/core/API.md');

/** What a source file says of `name`: its declaration, without its body or its comments. */
export function declarationOf(file, name) {
  const text = readFileSync(join(SRC, `${file}.ts`), 'utf8');
  const start = new RegExp(`^export\\s+(?:declare\\s+)?(?:async\\s+)?(function\\*?|const|let|class|interface|type|enum|abstract class)\\s+${name.replace(/\$/g, '\\$')}\\b`, 'm').exec(text);
  if (!start) return undefined;
  const kind = start[1];
  const rest = text.slice(start.index);
  const strip = (s) =>
    s
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  // Up to where the brackets close, at the first of `stops` outside them.
  const until = (stops) => {
    let depth = 0;
    for (let i = 0; i < rest.length; i++) {
      const ch = rest[i];
      if ('([{<'.includes(ch)) depth++;
      else if (')]}>'.includes(ch) && rest[i - 1] !== '=') depth--;
      if (depth === 0 && stops(i)) return rest.slice(0, i + 1);
      if (depth < 0) return rest.slice(0, i);
    }
    return rest;
  };
  if (kind === 'interface' || kind === 'enum') return { kind, text: strip(until((i) => rest[i] === '}')) };
  if (kind === 'type') return { kind, text: strip(until((i) => rest[i] === ';')) };
  if (kind.startsWith('function')) {
    // The body starts at a brace at the end of a line, once the parameters are closed.
    const body = /\)(?:\s*:\s*[^\n]*?)?\s*\{\n/.exec(rest);
    return { kind: 'function', text: strip(body ? rest.slice(0, body.index + body[0].length - 2) : rest.split('\n')[0]) };
  }
  if (kind.includes('class')) return { kind: 'class', text: strip(rest.split('\n')[0].replace(/\s*\{\s*$/, '')) };
  // A constant: its type when it says one, or its value, whole when it is a list or an object written over lines.
  const line = rest.split('\n')[0];
  if (/[[{(]\s*$/.test(line)) return { kind: 'const', text: strip(until((i) => rest[i] === ';')) };
  const typed = /^export\s+(?:const|let)\s+[\w$]+\s*:\s*([^=]+)=/.exec(line);
  if (typed) return { kind: 'const', text: `export const ${name}: ${typed[1].trim()}` };
  const arrow = /^export\s+const\s+[\w$]+\s*=\s*(\([^)]*\)\s*(?::\s*[^=]+)?)=>/.exec(line);
  if (arrow) return { kind: 'const', text: `export const ${name} = ${arrow[1].trim()} => …` };
  return { kind: 'const', text: strip(line.length > 160 ? `${line.slice(0, 160)}…` : line) };
}

/** The names a barrel exports from each module, in its order: `export { a, type B } from './m'`. */
export function exportsOf(barrel) {
  const text = readFileSync(join(SRC, barrel), 'utf8');
  const out = [];
  // `export type { A, B }` too: what the formatter makes of a list of nothing but types.
  for (const m of text.matchAll(/export\s+(type\s+)?\{([^}]+)\}\s+from\s+'\.\/([^']+)'/g)) {
    const parts = m[2].split(',').map((s) => s.trim());
    for (const part of parts.filter(Boolean)) out.push({ module: m[3], name: part.replace(/^type\s+/, ''), type: !!m[1] || part.startsWith('type ') });
  }
  return out;
}

/** Every name the engine exports, public or not: what each module of `src/internal.ts` declares, or passes on from another. */
export function internalNames() {
  const names = new Set();
  const internal = readFileSync(join(SRC, 'internal.ts'), 'utf8');
  const modules = [...internal.matchAll(/export\s+(?:\*|(?:type\s+)?\{[^}]*\})\s+from\s+'\.\/([^']+)'/g)].map((m) => m[1]);
  for (const module of new Set(modules)) {
    const text = readFileSync(join(SRC, `${module}.ts`), 'utf8');
    for (const m of text.matchAll(/^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type|enum|abstract class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
    // `export { a, type B }` and `export type { B }`, with a `from` or without.
    for (const m of text.matchAll(/^export\s+(?:type\s+)?\{([^}]+)\}/gm))
      for (const part of m[1].split(','))
        if (part.trim())
          names.add(
            part
              .trim()
              .replace(/^type\s+/, '')
              .split(/\s+as\s+/)
              .pop(),
          );
  }
  return names;
}

/**
 * The names a public declaration mentions that the engine exports but the
 * package does not: a type a user of the package would meet in a signature
 * and could not name. None, for an API that holds together.
 */
export function unnamed() {
  const own = new Set(exportsOf('index.ts').map((n) => n.name));
  const all = internalNames();
  const missing = new Map();
  for (const { module, name } of exportsOf('index.ts')) {
    const found = declarationOf(module, name);
    // Types only: a name in lower case there is a field, whatever function goes by it.
    for (const word of found?.text.match(/[A-Z][\w$]*/g) ?? []) if (word !== name && all.has(word) && !own.has(word)) missing.set(word, [...(missing.get(word) ?? []), name]);
  }
  return [...missing].map(([word, by]) => `${word} (in ${[...new Set(by)].slice(0, 3).join(', ')})`);
}

function report() {
  const names = exportsOf('index.ts');
  const lines = [
    '# The public API of @rebodocs/core',
    '',
    'Made by `node tools/api-report.mjs` from `src/index.ts`; do not change it by hand. What is here is what the',
    'package promises: a change to it is a change of its API, and goes in the changelog. What the engine keeps',
    'to itself is in `src/internal.ts`, for the packages of the repository, with no promise.',
    '',
    `${names.length} names.`,
  ];
  let module = '';
  for (const { module: from, name } of names) {
    if (from !== module) {
      module = from;
      lines.push('', `## ${from}`, '', '```ts');
    }
    const found = declarationOf(from, name);
    lines.push(found ? found.text : `export { ${name} } // re-exported`);
    const next = names[names.indexOf(names.find((n) => n.name === name && n.module === from)) + 1];
    if (!next || next.module !== from) lines.push('```');
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--unnamed')) {
    console.log(JSON.stringify(unnamed()));
    process.exit(0);
  }
  const made = report();
  if (process.argv.includes('--check')) {
    const now = readFileSync(REPORT, 'utf8');
    if (now !== made) {
      console.error('packages/core/API.md is out of date: run `node tools/api-report.mjs` and look at the diff.');
      process.exit(1);
    }
  } else {
    writeFileSync(REPORT, made);
    console.log(`packages/core/API.md: ${exportsOf('index.ts').length} names.`);
  }
}
