// How long the engine takes on a long document: laying it out, again after
// an edit with and without its cache, reading and writing it as DOCX,
// comparing two versions and making its PDF. Run it before and after a change
// to the engine, on the same machine: the numbers are this machine's, and say
// something only next to each other. On a phone, expect several times as long.
//
//   npm run bench                    3,000 paragraphs, 5 runs each
//   npm run bench -- --paragraphs 10000 --runs 3

import { type Doc, FontMeasurer, compareDocs, createDoc, createLayoutCache, exportDocx, importDocx, insertText, layoutDocument, renderPdf } from '@rebodocs/core/internal';
import { fontsFor } from '../packages/mcp/src/fonts';

const args = process.argv.slice(2);
const value = (name: string, fallback: number) => {
  const at = args.indexOf(name);
  return at >= 0 ? Number(args[at + 1]) : fallback;
};
const count = value('--paragraphs', 3000);
const runs = value('--runs', 5);

const clause = 'Las partes acuerdan lo relativo al objeto de este contrato conforme a lo que aquí se dispone, y a lo que la ley aplicable señala en lo no previsto. ';
const doc: Doc = createDoc(Array.from({ length: count }, (_, i) => ({ props: {}, runs: [{ text: `${i + 1}. ${clause}${i % 3 ? clause : ''}`, props: {} }] })));
const fonts = fontsFor(doc);
if (!fonts.length) {
  console.error('No fonts were found on this machine to lay the document out with.');
  process.exit(2);
}
const measurer = new FontMeasurer(fonts);
const edited = insertText(doc, { para: Math.floor(count / 2), offset: 0 }, 'x').doc;
const bytes = exportDocx(doc);

/** The middle of `runs` timings of `work`, in milliseconds: the least troubled by whatever else the machine did. */
function time(work: () => unknown): number {
  const all: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    work();
    all.push(performance.now() - start);
  }
  return all.sort((a, b) => a - b)[Math.floor(all.length / 2)];
}

const cache = createLayoutCache();
layoutDocument(doc, measurer, cache);
const pages = layoutDocument(doc, measurer).pages.length;
const rows: [string, number][] = [
  ['layout', time(() => layoutDocument(doc, measurer))],
  ['layout after an edit, no cache', time(() => layoutDocument(edited, measurer))],
  ['layout after an edit, with its cache', time(() => layoutDocument(edited, measurer, cache))],
  ['importDocx', time(() => importDocx(bytes))],
  ['exportDocx', time(() => exportDocx(doc))],
  ['compareDocs, one edit', time(() => compareDocs(doc, edited))],
  ['renderPdf', time(() => renderPdf(doc, fonts))],
];
console.log(`${count} paragraphs, ${pages} pages, ${Math.round(bytes.length / 1024)} KB of DOCX; the middle of ${runs} runs:`);
for (const [what, ms] of rows) console.log(`  ${what.padEnd(40)} ${ms.toFixed(0).padStart(6)} ms`);
