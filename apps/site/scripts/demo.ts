// Writes the document the editor on the landing page opens with: a receipt
// that is also a template, short enough to read at a glance and with one of
// each thing worth trying. Made with the same operations the editor uses.
//
//   npm run demo -w @rebodocs/site     → public/demo.docx

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Doc, type Run, type RunProps, applyRunProps, createDoc, exportDocx, insertSignatures, insertTable, insertText, setCellProps, setPageNumbering, setParagraphStyle, toggleList } from '../../../packages/core/src/index';

const run = (text: string, props: RunProps = {}): Run => ({ text, props });
const bold = (text: string) => run(text, { bold: true });

const LINES: { runs: Run[]; style?: string; list?: boolean; align?: 'justify' | 'right' | 'center' }[] = [
  { runs: [run('Reservation receipt')], style: 'Title' },
  { runs: [run('This is a real DOCX, open in the real editor. Change anything.')], style: 'Subtitle' },
  { runs: [run('{{city}}, {{date}}', { italic: true })], align: 'right' },
  {
    runs: [
      run('Received from '),
      bold('{{client | capital}}'),
      run(' the amount of '),
      bold('{{amount | currency}}'),
      run(' as a deposit to reserve the property known as '),
      bold('{{property}}'),
      run('. The deposit is credited to the price on signing, and both parties sign below in agreement.'),
    ],
    align: 'justify',
  },
  { runs: [run('Try it')], style: 'Heading1' },
  { runs: [run('Select a word and make it '), bold('bold'), run(', '), run('red', { color: 'C0392B' }), run(' or '), run('highlighted', { highlight: 'FFF176' }), run('.')], list: true },
  { runs: [run('Open the side panel (second button) and fill the variables in double braces.')], list: true },
  { runs: [run('Open the menu (first button): load your own .docx, export a PDF, set a letterhead.')], list: true },
  { runs: [run('Add rows to the table below with Tab in its last cell.')], list: true },
  { runs: [run('')] },
  { runs: [run('')] },
];

const TABLE = [
  ['Concept', 'Due', 'Amount'],
  ['Deposit', 'Today', '{{amount | currency}}'],
  ['Balance', 'On signing', '{{balance | currency}}'],
];

function demoDoc(): Doc {
  let doc = createDoc(LINES.map((line) => ({ props: line.align ? { align: line.align } : {}, runs: line.runs })));
  LINES.forEach((line, i) => {
    if (line.style) doc = setParagraphStyle(doc, i, i, line.style);
  });
  const first = LINES.findIndex((line) => line.list);
  const last = LINES.length - 1 - [...LINES].reverse().findIndex((line) => line.list);
  doc = toggleList(doc, first, last, 'bullet');

  // From the end back, so the places above stay where they are.
  doc = insertSignatures(doc, { para: LINES.length - 1, offset: 0 }, ['Received by', 'Agreed by'], 'FULL NAME').doc;
  const table = LINES.length - 2;
  doc = insertTable(doc, { para: table, offset: 0 }, TABLE.length, TABLE[0].length).doc;
  const cell = doc.paragraphs.findIndex((p, i) => i >= table && p.cell);
  const cells = TABLE.flat();
  for (let i = cells.length - 1; i >= 0; i--) doc = insertText(doc, { para: cell + i, offset: 0 }, cells[i]).doc;
  const head = cell + TABLE[0].length - 1;
  doc = setCellProps(doc, cell, head, { shade: 'E8EEF9' });
  doc = applyRunProps(doc, { from: { para: cell, offset: 0 }, to: { para: head, offset: TABLE[0][TABLE[0].length - 1].length } }, { bold: true });

  doc = { ...doc, header: { paragraphs: [{ props: { align: 'right' }, runs: [run('Rebodocs · sample document', { fontSize: 9, color: '777777' })] }] } };
  return setPageNumbering(doc, { place: 'footer', align: 'center', format: 'pageOfTotal' });
}

const out = fileURLToPath(new URL('../public/demo.docx', import.meta.url));
writeFileSync(out, exportDocx(demoDoc()));
console.log(`demo.docx: ${out}`);
