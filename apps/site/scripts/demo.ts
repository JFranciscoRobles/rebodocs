// Writes the document the editor on the landing page opens with: a receipt
// that is also a template, short enough to read at a glance and with one of
// each thing worth trying: variables, a change Claude suggested, a comment,
// a note at the foot of the page, lists, a link, a table and signatures.
// Made with the same operations the editor uses.
//
//   npm run demo -w @rebodocs/site     → public/demo.docx

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type Doc,
  type Run,
  type RunProps,
  addNote,
  applyRunProps,
  createDoc,
  exportDocx,
  findAll,
  insertFootnote,
  insertLink,
  insertSignatures,
  insertTable,
  insertText,
  replaceRange,
  setCellProps,
  setListStyle,
  setPageNumbering,
  setParagraphStyle,
  toggleList,
  trackDocEdit,
} from '../../../packages/core/src/index';

const run = (text: string, props: RunProps = {}): Run => ({ text, props });
const bold = (text: string) => run(text, { bold: true });

const LINES: { runs: Run[]; style?: string; list?: 'bullet' | 'number'; align?: 'justify' | 'right' | 'center' }[] = [
  { runs: [run('Reservation receipt')], style: 'Title' },
  { runs: [run('A real DOCX, open in the real editor. Change anything: nothing leaves your browser.')], style: 'Subtitle' },
  { runs: [run('{{city}}, {{date}}', { italic: true })], align: 'right' },
  {
    runs: [
      run('Received from '),
      bold('{{client | capital}}'),
      run(' the amount of '),
      bold('{{amount | currency}}'),
      run(' as a deposit to reserve the property known as '),
      bold('{{property}}'),
      run('. The deposit is credited to the price on signing, and the balance is paid within 30 days.'),
    ],
    align: 'justify',
  },
  { runs: [run('Terms')], style: 'Heading1' },
  { runs: [run('The property is taken off the market from the date of this receipt.')], list: 'number' },
  { runs: [run('Either party may cancel in writing before the date of signing.')], list: 'number' },
  { runs: [run('Both parties sign below in agreement.')], list: 'number' },
  { runs: [run('Try it')], style: 'Heading1' },
  { runs: [run('Select a word and make it '), bold('bold'), run(', '), run('red', { color: 'C0392B' }), run(' or '), run('highlighted', { highlight: 'FFF176' }), run('.')], list: 'bullet' },
  { runs: [run('Claude suggested a change above: accept or reject it from Review.')], list: 'bullet' },
  { runs: [run('Open the side panel to fill the variables, answer Ana’s comment, and save a version to compare.')], list: 'bullet' },
  { runs: [run('Open the menu: load your own .docx, export a PDF, set a letterhead.')], list: 'bullet' },
  { runs: [run('Add rows to the table below with Tab in its last cell. Everything here is in the guide, at ')], list: 'bullet' },
  { runs: [run('')] },
  { runs: [run('')] },
];

const TABLE = [
  ['Concept', 'Due', 'Amount'],
  ['Deposit', 'Today', '{{amount | currency}}'],
  ['Balance', 'On signing', '{{balance | currency}}'],
];

/** Where `text` first is in the document. */
const find = (doc: Doc, text: string) => {
  const range = findAll(doc, text, { matchCase: true })[0];
  if (!range) throw new Error(`"${text}" is not in the document.`);
  return range;
};

function demoDoc(): Doc {
  let doc = createDoc(LINES.map((line) => ({ props: line.align ? { align: line.align } : {}, runs: line.runs })));
  LINES.forEach((line, i) => {
    if (line.style) doc = setParagraphStyle(doc, i, i, line.style);
  });
  for (const kind of ['number', 'bullet'] as const) {
    const first = LINES.findIndex((line) => line.list === kind);
    const last = LINES.length - 1 - [...LINES].reverse().findIndex((line) => line.list === kind);
    doc = toggleList(doc, first, last, kind);
    // The terms go by letter: a), b), c).
    if (kind === 'number') doc = setListStyle(doc, first, last, { format: 'lowerLetter', text: '#)' });
  }

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

  const guide = LINES.length - 3;
  doc = insertLink(doc, { para: guide, offset: doc.paragraphs[guide].runs.reduce((n, r) => n + r.text.length, 0) }, 'rebodocs.com/docs', 'https://rebodocs.com/docs/').doc;
  doc = insertText(doc, { para: guide, offset: doc.paragraphs[guide].runs.reduce((n, r) => n + r.text.length, 0) }, '.').doc;

  doc = insertFootnote(doc, find(doc, 'on signing').to, 'If the sale does not go ahead for a reason of the seller, the deposit is returned in full.').doc;
  doc = addNote(doc, find(doc, '{{property}}'), { text: 'Check the cadastral reference before we send it.', author: 'Ana', date: '2026-10-20T09:30:00Z' }).doc;

  doc = { ...doc, header: { paragraphs: [{ props: { align: 'right' }, runs: [run('Rebodocs · sample document', { fontSize: 9, color: '777777' })] }] } };
  doc = setPageNumbering(doc, { place: 'footer', align: 'center', format: 'pageOfTotal' });

  // Last, the change Claude suggested: 30 days down to 15, and how to pay.
  let after = replaceRange(doc, find(doc, '30'), '15').doc;
  after = insertText(after, find(after, '15 days').to, ', by bank transfer').doc;
  return trackDocEdit(doc, after, { author: 'Claude', date: '2026-10-20T10:00:00Z' });
}

const out = fileURLToPath(new URL('../public/demo.docx', import.meta.url));
writeFileSync(out, exportDocx(demoDoc(), { language: 'en-US' }));
console.log(`demo.docx: ${out}`);
