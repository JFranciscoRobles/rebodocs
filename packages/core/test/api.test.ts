// The API of the package is what `src/index.ts` exports, and `API.md` says it
// name by name: the two have to agree, so that a change to what the package
// promises shows in the diff of a file a reviewer reads.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as api from '../src/index';
import * as internal from '../src/internal';

const report = fileURLToPath(new URL('../../../tools/api-report.mjs', import.meta.url));

describe('the public API', () => {
  it('is what API.md says: run `npm run api` after changing it, and read the diff', () => {
    expect(() => execFileSync(process.execPath, [report, '--check'], { stdio: 'pipe' })).not.toThrow();
  });

  it('names every type its declarations mention: none a user meets in a signature is left out', () => {
    expect(JSON.parse(execFileSync(process.execPath, [report, '--unnamed'], { encoding: 'utf8' }))).toEqual([]);
  });

  it('is part of what the packages of the repository have, and smaller', () => {
    const own = Object.keys(api);
    expect(own.every((name) => name in internal)).toBe(true);
    expect(own.length).toBeLessThan(Object.keys(internal).length);
    // What a user of the package needs first is there.
    for (const name of ['importDocx', 'exportDocx', 'createDoc', 'insertText', 'fillVariables', 'layoutDocument', 'renderPdf', 'trackEdit', 'compareDocs', 'exportMarkdown'])
      expect(api).toHaveProperty(name);
    // And the insides of the engine are not.
    for (const name of ['parseXml', 'moveChar', 'hitTest', 'caretRect', 'subsetTrueType', 'storyOf']) expect(api).not.toHaveProperty(name);
  });
});
