// Writes the document the demo opens with: a short contract, in English, that
// is also a template, with one of each thing an interface has something to show for:
// headings for the outline, variables with a type, a table with a heading
// row, text in two columns, places to sign, a header and a page number. Made with the same operations the editor uses.
//
//   npm run sample -w @rebodocs/demo     → public/sample.docx
//   vite-node scripts/sample.ts <file>   → wherever the site wants its copy

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Doc, type Run, type RunProps, applyRunProps, createDoc, exportDocx, insertSignatures, insertTable, insertText, paragraphText, setCellProps, setColumns, setHeaderRow, setPageNumbering, setParagraphStyle } from '@rebodocs/core';

const run = (text: string, props: RunProps = {}): Run => ({ text, props });
const bold = (text: string) => run(text, { bold: true });

const LINES: { runs: Run[]; style?: string; align?: 'justify' | 'right' | 'center' }[] = [
  { runs: [run('Services Agreement')], style: 'Title' },
  { runs: [run('{{city}}, {{date | long date}}', { italic: true })], align: 'right' },
  { runs: [run('Parties')], style: 'Heading1' },
  {
    runs: [run('This agreement is made between '), bold('{{client | capital}}'), run(' (“the Client”) and '), bold('{{provider | capital}}'), run(' (“the Provider”). Each party confirms it has the legal capacity to be bound by the terms of this agreement.')],
    align: 'justify',
  },
  { runs: [run('Scope of the services')], style: 'Heading1' },
  { runs: [run('The Provider will carry out for the Client the services described in Schedule A, with the care expected of its trade and within the deadlines set out there.')], align: 'justify' },
  { runs: [run('Obligations of the parties')], style: 'Heading1' },
  { runs: [bold('The Client. '), run('To give the Provider the information and access it needs, to review each delivery within five business days, and to pay the fees on the dates agreed.')], align: 'justify' },
  { runs: [bold('The Provider. '), run('To carry out the services to the quality agreed, to tell the Client of any delay as soon as it knows of it, and to keep confidential the information it receives.')], align: 'justify' },
  { runs: [run('Fees and payment')], style: 'Heading1' },
  { runs: [run('The Client will pay the Provider '), bold('{{amount | currency}}'), run(', on the following schedule:')], align: 'justify' },
  { runs: [run('')] },
  { runs: [run('Term')], style: 'Heading1' },
  { runs: [run('This agreement takes effect on the date it is signed and remains in force until the services have been delivered and accepted.')], align: 'justify' },
  { runs: [run('Signatures')], style: 'Heading1' },
  { runs: [run('')] },
];

const TABLE = [
  ['Item', 'Due', 'Amount'],
  ['Deposit', 'On signing', '{{deposit | currency}}'],
  ['Final payment', 'On delivery', '{{balance | currency}}'],
];

function sampleDoc(): Doc {
  let doc = createDoc(LINES.map((line) => ({ props: line.align ? { align: line.align } : {}, runs: line.runs })));
  LINES.forEach((line, i) => {
    if (line.style) doc = setParagraphStyle(doc, i, i, line.style);
  });

  // From the end back, so the places above stay where they are.
  doc = insertSignatures(doc, { para: LINES.length - 1, offset: 0 }, ['The Client', 'The Provider'], 'FULL NAME').doc;
  const table = LINES.findIndex((line, i) => i > 0 && line.runs[0].text === '' && !line.style);
  doc = insertTable(doc, { para: table, offset: 0 }, TABLE.length, TABLE[0].length).doc;
  const cell = doc.paragraphs.findIndex((p, i) => i >= table && p.cell);
  const cells = TABLE.flat();
  for (let i = cells.length - 1; i >= 0; i--) doc = insertText(doc, { para: cell + i, offset: 0 }, cells[i]).doc;
  const head = cell + TABLE[0].length - 1;
  doc = setCellProps(doc, cell, head, { shade: 'E8EEF9' });
  doc = applyRunProps(doc, { from: { para: cell, offset: 0 }, to: { para: head, offset: TABLE[0][TABLE[0].length - 1].length } }, { bold: true });
  // The heading row is shown again on every page the table goes on to.
  doc = setHeaderRow(doc, cell, true);

  // The obligations of each side, side by side: two columns with a line between them, on the same page as the rest.
  const first = doc.paragraphs.findIndex((p) => paragraphText(p).startsWith('The Client.'));
  const last = first + 1;
  doc = setColumns(doc, { from: { para: first, offset: 0 }, to: { para: last, offset: paragraphText(doc.paragraphs[last]).length } }, { count: 2, space: 24, separator: true });

  doc = { ...doc, header: { paragraphs: [{ props: { align: 'right' }, runs: [run('Rebodocs · sample document', { fontSize: 9, color: '777777' })] }] } };
  return setPageNumbering(doc, { place: 'footer', align: 'center', format: 'pageOfTotal' });
}

const given = process.argv.slice(2).find((arg) => arg.endsWith('.docx'));
const out = given ? resolve(given) : fileURLToPath(new URL('../public/sample.docx', import.meta.url));
// Written as English, for dates and amounts and for spelling in Word.
writeFileSync(out, exportDocx(sampleDoc(), { language: 'en-US' }));
console.log(`sample.docx: ${out}`);
