// The documents the shelf starts with, in `public/samples/`: three that Word
// saved, from the documents the layout is measured against, and the agreement
// `apps/demo` writes with the engine (`npm run samples` writes it first, with
// the script of that demo). None of them is kept in git.

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const here = resolve(import.meta.dirname, '..');
const out = join(here, 'public/samples');
const root = resolve(here, '../..');
mkdirSync(out, { recursive: true });

const FROM_WORD = ['contract-arial-tables.docx', 'contract-georgia-lists.docx', 'float-brochure.docx'];
for (const name of FROM_WORD) copyFileSync(join(root, 'test-documents', name), join(out, name));

const files = ['agreement.docx', ...FROM_WORD];
writeFileSync(join(out, 'index.json'), `${JSON.stringify(files)}\n`);
console.log(`samples: ${files.length} documents in public/samples`);
