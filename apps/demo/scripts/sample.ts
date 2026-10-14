// Writes the document the demo opens with: a short contract that is also a
// template, with one of each thing an interface has something to show for:
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
  { runs: [run('Contrato de prestación de servicios')], style: 'Title' },
  { runs: [run('{{ciudad}}, {{fecha | fecha larga}}', { italic: true })], align: 'right' },
  { runs: [run('Partes')], style: 'Heading1' },
  {
    runs: [run('De una parte, '), bold('{{cliente | capital}}'), run(', en adelante «el Cliente»; y de otra, '), bold('{{prestador | capital}}'), run(', en adelante «el Prestador». Ambas partes se reconocen capacidad legal suficiente para obligarse en los términos de este contrato.')],
    align: 'justify',
  },
  { runs: [run('Objeto del contrato')], style: 'Heading1' },
  { runs: [run('El Prestador se obliga a realizar para el Cliente los servicios descritos en el Anexo A, con la diligencia propia de su oficio y dentro de los plazos que allí se señalan.')], align: 'justify' },
  { runs: [run('Obligaciones de las partes')], style: 'Heading1' },
  { runs: [bold('Del Cliente. '), run('Facilitar al Prestador la información y los accesos que necesite, revisar cada entrega en un plazo de cinco días hábiles y pagar los honorarios en las fechas pactadas.')], align: 'justify' },
  { runs: [bold('Del Prestador. '), run('Realizar los servicios con la calidad acordada, informar al Cliente de cualquier retraso en cuanto lo conozca y guardar reserva sobre la información que reciba.')], align: 'justify' },
  { runs: [run('Honorarios y forma de pago')], style: 'Heading1' },
  { runs: [run('El Cliente pagará al Prestador la cantidad de '), bold('{{monto | moneda}}'), run(', conforme al siguiente calendario:')], align: 'justify' },
  { runs: [run('')] },
  { runs: [run('Vigencia')], style: 'Heading1' },
  { runs: [run('Este contrato entra en vigor en la fecha de su firma y permanece vigente hasta la entrega y aceptación de los servicios.')], align: 'justify' },
  { runs: [run('Firmas')], style: 'Heading1' },
  { runs: [run('')] },
];

const TABLE = [
  ['Concepto', 'Vencimiento', 'Importe'],
  ['Anticipo', 'A la firma', '{{anticipo | moneda}}'],
  ['Entrega final', 'A la entrega', '{{saldo | moneda}}'],
];

function sampleDoc(): Doc {
  let doc = createDoc(LINES.map((line) => ({ props: line.align ? { align: line.align } : {}, runs: line.runs })));
  LINES.forEach((line, i) => {
    if (line.style) doc = setParagraphStyle(doc, i, i, line.style);
  });

  // From the end back, so the places above stay where they are.
  doc = insertSignatures(doc, { para: LINES.length - 1, offset: 0 }, ['El Cliente', 'El Prestador'], 'NOMBRE COMPLETO').doc;
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
  const first = doc.paragraphs.findIndex((p) => paragraphText(p).startsWith('Del Cliente.'));
  const last = first + 1;
  doc = setColumns(doc, { from: { para: first, offset: 0 }, to: { para: last, offset: paragraphText(doc.paragraphs[last]).length } }, { count: 2, space: 24, separator: true });

  doc = { ...doc, header: { paragraphs: [{ props: { align: 'right' }, runs: [run('Rebodocs · documento de muestra', { fontSize: 9, color: '777777' })] }] } };
  return setPageNumbering(doc, { place: 'footer', align: 'center', format: 'pageOfTotal' });
}

const given = process.argv.slice(2).find((arg) => arg.endsWith('.docx'));
const out = given ? resolve(given) : fileURLToPath(new URL('../public/sample.docx', import.meta.url));
writeFileSync(out, exportDocx(sampleDoc()));
console.log(`sample.docx: ${out}`);
