import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  canMergeCells,
  canSplitCell,
  cellRect,
  createDoc,
  docText,
  exportDocx,
  importDocx,
  insertSignatures,
  insertTable,
  insertText,
  mergeCells,
  resizeColumn,
  setCellProps,
  splitCell,
  tableGeometry,
} from '../src/internal';

/** A 3 × 3 table after a first paragraph, each cell holding its name: A1, B1... */
function grid(): Doc {
  let { doc } = insertTable(
    createDoc([
      { props: {}, runs: [{ text: 'Before', props: {} }] },
      { props: {}, runs: [{ text: '', props: {} }] },
    ]),
    { para: 1, offset: 0 },
    3,
    3,
  );
  for (let i = 0; i < 9; i++) doc = insertText(doc, { para: 1 + i, offset: 0 }, `${'ABC'[i % 3]}${Math.floor(i / 3) + 1}`).doc;
  return doc;
}
const cellOf = (doc: Doc, name: string) => doc.paragraphs.findIndex((p) => p.runs.some((r) => r.text === name));
const shape = (doc: Doc) => doc.tables![0].rows.map((row) => row.cells.map((c) => `${c.span}${c.merge ? c.merge[0] : ''}`).join(' '));
const textIn = (doc: Doc) =>
  doc.tables![0].rows.map((row) =>
    row.cells
      .map((c) =>
        doc.paragraphs
          .filter((p) => p.cell?.row === row.id && p.cell.cell === c.id)
          .map((p) => p.runs.map((r) => r.text).join(''))
          .join('+'),
      )
      .join(' | '),
  );

describe('cells', () => {
  it('merges cells of a row, their text going into the first', () => {
    const doc = grid();
    expect(canMergeCells(doc, cellOf(doc, 'A1'), cellOf(doc, 'A1'))).toBe(false);
    const { doc: merged, pos } = mergeCells(doc, cellOf(doc, 'A1'), cellOf(doc, 'B1'));
    expect(shape(merged)).toEqual(['2 1', '1 1 1', '1 1 1']);
    expect(textIn(merged)).toEqual(['A1+B1 | C1', 'A2 | B2 | C2', 'A3 | B3 | C3']);
    expect(pos).toEqual({ para: cellOf(merged, 'A1'), offset: 0 });
    expect(docText(merged).split('\n')).toEqual(['Before', 'A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3', '']);
  });

  it('merges a block down and across, and undoes it', () => {
    const doc = grid();
    const { doc: merged } = mergeCells(doc, cellOf(doc, 'B3'), cellOf(doc, 'A2'));
    expect(shape(merged)).toEqual(['1 1 1', '2s 1', '2c 1']);
    expect(textIn(merged)).toEqual(['A1 | B1 | C1', 'A2+B2+A3+B3 | C2', ' | C3']);
    // The merged cell cannot be merged with part of a neighbour row...
    expect(cellRect(merged, cellOf(merged, 'A2'), cellOf(merged, 'A1'))).toMatchObject({ rowFrom: 0, rowTo: 2, colFrom: 0, colTo: 2 });
    // ...and splitting gives back one cell per column and row, the text in the first.
    expect(canSplitCell(merged, cellOf(merged, 'A2'))).toBe(true);
    expect(canSplitCell(merged, cellOf(merged, 'C2'))).toBe(false);
    const split = splitCell(merged, cellOf(merged, 'A2'));
    expect(shape(split)).toEqual(['1 1 1', '1 1 1', '1 1 1']);
    expect(textIn(split)).toEqual(['A1 | B1 | C1', 'A2+B2+A3+B3 |  | C2', ' |  | C3']);
  });

  it('sets the borders and the shading of the cells of a block', () => {
    const doc = grid();
    const shaded = setCellProps(doc, cellOf(doc, 'A1'), cellOf(doc, 'B2'), { shade: 'ffe699', borders: false });
    const cells = shaded.tables![0].rows.map((row) => row.cells.map((c) => `${c.shade ?? '-'}/${c.borders ? 'b' : 'n'}/${c.borderTop}`));
    expect(cells[0]).toEqual(['FFE699/n/0', 'FFE699/n/0', '-/b/0.5']);
    expect(cells[2]).toEqual(['-/b/0.5', '-/b/0.5', '-/b/0.5']);
    expect(setCellProps(shaded, cellOf(doc, 'A1'), cellOf(doc, 'A1'), { shade: '' }).tables![0].rows[0].cells[0].shade).toBeUndefined();
    expect(setCellProps(doc, cellOf(doc, 'A1'), cellOf(doc, 'A1'), { borders: true })).toBe(doc);
    expect(setCellProps(doc, 0, 0, { shade: 'FF0000' })).toBe(doc);

    const xml = strFromU8(unzipSync(exportDocx(shaded))['word/document.xml']);
    expect(xml).toContain('<w:shd w:val="clear" w:color="auto" w:fill="FFE699"/>');
    expect(xml).toContain('<w:tcBorders><w:top w:val="nil"/>');
    const back = importDocx(exportDocx(shaded));
    expect(back.tables![0].rows[1].cells.map((c) => `${c.shade ?? '-'}/${c.borders ? 'b' : 'n'}`)).toEqual(['FFE699/n', 'FFE699/n', '-/b']);
  });

  it('moves the edge between two columns, and the last one', () => {
    const doc = grid();
    const widths = (d: Doc) => d.tables![0].columns.map((w) => Math.round(w));
    expect(widths(doc)).toEqual([156, 156, 156]);
    const columns = tableGeometry(doc.tables![0], 468).columns;
    expect(widths(resizeColumn(doc, 0, 1, 40, columns))).toEqual([196, 116, 156]);
    expect(widths(resizeColumn(doc, 0, 3, -56, columns))).toEqual([156, 156, 100]);
    // A column does not go under its least width, nor eat more than its neighbour has.
    expect(widths(resizeColumn(doc, 0, 1, -500, columns))).toEqual([12, 300, 156]);
    expect(widths(resizeColumn(doc, 0, 2, 500, columns))).toEqual([156, 300, 12]);
    expect(resizeColumn(doc, 0, 1, 0, columns)).toBe(doc);
  });

  it('writes the changes of a table of a file on top of what it had', () => {
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const cell = (text: string, pr = '') => `<w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/>${pr}</w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
    const table =
      '<w:tbl><w:tblPr><w:tblStyle w:val="Grid"/><w:tblW w:w="5000" w:type="pct"/><w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid><w:gridCol w:w="4000"/><w:gridCol w:w="4000"/></w:tblGrid>' +
      `<w:tr>${cell('A1', '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>')}${cell('B1')}</w:tr><w:tr>${cell('A2')}${cell('B2')}</w:tr></w:tbl>`;
    const document = `<w:document ${NS}><w:body>${table}<w:p/></w:body></w:document>`;
    const open = () => importDocx(zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8(document) }));
    const doc = open();
    expect(doc.tables![0].rows[0].cells.map((c) => c.shade)).toEqual(['D9D9D9', undefined]);
    expect(strFromU8(unzipSync(exportDocx(doc))['word/document.xml'])).toBe(document);

    let next = setCellProps(doc, 1, 1, { shade: 'FFE699' });
    next = setCellProps(next, 0, 0, { shade: '' });
    next = resizeColumn(next, 0, 1, -60, tableGeometry(doc.tables![0], 468).columns);
    const xml = strFromU8(unzipSync(exportDocx(next))['word/document.xml']);
    // The table is as wide as its columns now, and keeps the rest of its properties.
    expect(xml).toContain('<w:tblPr><w:tblStyle w:val="Grid"/><w:tblW w:w="9360" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0"/></w:tblPr>');
    expect(xml).toContain('<w:tblGrid><w:gridCol w:w="3480"/><w:gridCol w:w="5880"/></w:tblGrid>');
    expect(xml).toContain('<w:tcW w:w="5880" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="FFE699"/></w:tcPr><w:p><w:r><w:t>B1</w:t>');
    expect(xml).toContain('<w:tcPr><w:tcW w:w="3480" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>A1</w:t>');
    const back = importDocx(exportDocx(next));
    expect(back.tables![0].columns.map(Math.round)).toEqual([174, 294]);
    expect(back.tables![0].rows[0].cells.map((c) => c.shade)).toEqual([undefined, 'FFE699']);
  });
});

describe('signatures', () => {
  it('puts in a line and a name for each person, side by side, without borders', () => {
    const start = createDoc([{ props: { align: 'justify' }, runs: [{ text: 'Leído, firman.', props: { fontSize: 12 } }] }]);
    const { doc, name } = insertSignatures(start, { para: 0, offset: 14 });
    expect(docText(doc).split('\n')).toEqual(['Leído, firman.', 'ASESOR', '_'.repeat(30), 'NOMBRE COMPLETO', 'CLIENTE', '_'.repeat(30), 'NOMBRE COMPLETO', '']);
    expect(doc.paragraphs.slice(1, 7).map((p) => [p.cell?.cell, p.props.align, p.runs[0].props.fontSize])).toEqual([
      [0, 'center', 12],
      [0, 'center', 12],
      [0, 'center', 12],
      [1, 'center', 12],
      [1, 'center', 12],
      [1, 'center', 12],
    ]);
    expect(doc.paragraphs.slice(1, 7).every((p) => p.runs[0].props.bold)).toBe(true);
    expect(doc.tables![0].rows.map((row) => row.cells.map((c) => c.borders))).toEqual([[false, false]]);
    expect(name).toEqual({ from: { para: 3, offset: 0 }, to: { para: 3, offset: 15 } });
    // It is an ordinary table in the file, and comes back as it went.
    const back = importDocx(exportDocx(doc));
    expect(docText(back)).toBe(docText(doc));
    expect(back.tables![0].rows[0].cells.map((c) => c.borders)).toEqual([false, false]);
    // Not inside another table.
    expect(insertSignatures(doc, { para: 2, offset: 0 }).doc).toBe(doc);
    expect(docText(insertSignatures(start, { para: 0, offset: 14 }, ['TESTIGO']).doc).split('\n')).toEqual(['Leído, firman.', 'TESTIGO', '_'.repeat(30), 'NOMBRE COMPLETO', '']);
  });
});
