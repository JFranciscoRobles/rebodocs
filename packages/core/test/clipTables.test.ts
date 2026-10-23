import { describe, expect, it } from 'vitest';
import {
  type Clip,
  type Doc,
  type Paragraph,
  clipHtml,
  clipOf,
  clipText,
  clipWithoutTables,
  createDoc,
  insertClip,
  insertTable,
  locateCell,
  mergeCells,
  paragraphText,
  parseClip,
  serializeClip,
  setHeaderRow,
} from '../src/internal';

const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });
const texts = (doc: Doc) => doc.paragraphs.map(paragraphText);
/** The text of each cell of the first table, row by row, as the grid has it. */
const grid = (doc: Doc, table = 0) => {
  const rows: string[][] = [];
  doc.paragraphs.forEach((para, i) => {
    const at = para.cell?.table === table ? locateCell(doc, i) : undefined;
    if (!at) return;
    (rows[at.rowIndex] ??= [])[at.cellIndex] = [rows[at.rowIndex]?.[at.cellIndex], paragraphText(para)].filter((t) => t !== undefined && t !== '').join(' / ');
  });
  return rows;
};

/** A clip of a table of two columns: a heading row, and two rows, the last with its two cells merged. */
const clip = (): Clip => ({
  paragraphs: [
    { runs: [{ text: 'Antes', props: {} }], props: {} },
    { runs: [{ text: 'Concepto', props: { bold: true } }], props: {}, cell: { table: 0, row: 0, column: 0 } },
    { runs: [{ text: 'Monto', props: { bold: true } }], props: {}, cell: { table: 0, row: 0, column: 1 } },
    { runs: [{ text: 'Renta', props: {} }], props: {}, cell: { table: 0, row: 1, column: 0 } },
    { runs: [{ text: '$18,500', props: {} }], props: { align: 'right' }, cell: { table: 0, row: 1, column: 1 } },
    { runs: [{ text: 'Total al mes', props: {} }], props: {}, cell: { table: 0, row: 2, column: 0 } },
    { runs: [{ text: 'con IVA', props: { italic: true } }], props: {}, cell: { table: 0, row: 2, column: 0 } },
    { runs: [{ text: 'Después', props: {} }], props: {} },
  ],
  tables: [{ rows: 3, columns: 2, merges: [{ row: 2, column: 0, rows: 1, columns: 2 }], widths: [300, 100], header: 1 }],
});

describe('a table in a clip', () => {
  it('is put in as a table: its cells, a cell of two paragraphs, its merged cells, its widths and its heading', () => {
    const doc = createDoc([p('Arriba'), p('')]);
    const { doc: after, pos } = insertClip(doc, { para: 1, offset: 0 }, clip());
    expect(after.tables).toHaveLength(1);
    expect(grid(after)).toEqual([['Concepto', 'Monto'], ['Renta', '$18,500'], ['Total al mes / con IVA']]);
    const table = after.tables![0];
    expect(table.rows[2].cells).toHaveLength(1);
    expect(table.rows[2].cells[0].span).toBe(2);
    expect(table.rows[0].header).toBe(true);
    // 400 pt asked for, between margins narrower than that: the same proportions, fitted.
    const room = doc.page.width - doc.page.marginLeft - doc.page.marginRight;
    expect(table.columns.reduce((a, b) => a + b, 0)).toBeCloseTo(Math.min(400, room));
    expect(table.columns[0] / table.columns[1]).toBeCloseTo(3);
    // The look of what was in the cells.
    const amount = after.paragraphs.findIndex((para) => paragraphText(para) === '$18,500');
    expect(after.paragraphs[amount].props.align).toBe('right');
    expect(after.paragraphs.find((para) => paragraphText(para) === 'Concepto')!.runs[0].props.bold).toBe(true);
    // The paragraphs before and after it, and the caret after what was pasted.
    // Into an empty paragraph: what comes after the table goes in the one left after it, as in Word.
    expect(after.paragraphs.filter((para) => !para.cell).map(paragraphText)).toEqual(['Arriba', 'Antes', 'Después']);
    expect(paragraphText(after.paragraphs[pos.para]).slice(0, pos.offset)).toBe('Después');
  });

  it('goes before a paragraph pasted at its start, with no empty paragraph above it', () => {
    const only: Clip = { paragraphs: clip().paragraphs.slice(1, 5), tables: [{ rows: 2, columns: 2 }] };
    const { doc } = insertClip(createDoc([p('Texto que sigue.')]), { para: 0, offset: 0 }, only);
    expect(doc.paragraphs[0].cell).toBeDefined();
    expect(texts(doc).at(-1)).toBe('Texto que sigue.');
    expect(texts(doc).filter((t) => t === '')).toHaveLength(0);
  });

  it('comes as lines in a cell, where a table cannot go, its cells apart by a tab', () => {
    const inTable = insertTable(createDoc([p('')]), { para: 0, offset: 0 }, 1, 1).doc;
    const { doc } = insertClip(inTable, { para: 0, offset: 0 }, clip());
    expect(doc.tables).toHaveLength(1);
    expect(texts(doc).filter(Boolean)).toEqual(['Antes', 'Concepto\tMonto', 'Renta\t$18,500', 'Total al mes', 'con IVA', 'Después']);
    expect(clipWithoutTables(clip()).paragraphs.map((q) => q.runs.map((r) => r.text).join(''))).toEqual(['Antes', 'Concepto\tMonto', 'Renta\t$18,500', 'Total al mes', 'con IVA', 'Después']);
  });

  it('is copied from a document with its grid, and pasted again as it was', () => {
    let doc = insertTable(createDoc([p('Arriba'), p('')]), { para: 1, offset: 0 }, 3, 2).doc;
    const cells = doc.paragraphs.map((para, i) => (para.cell ? i : -1)).filter((i) => i >= 0);
    const words = ['Concepto', 'Monto', 'Renta', '$18,500', 'Total', ''];
    doc = { ...doc, paragraphs: doc.paragraphs.map((para, i) => (cells.includes(i) ? { ...para, runs: [{ text: words[cells.indexOf(i)], props: para.runs[0].props }] } : para)) };
    doc = setHeaderRow(doc, cells[0], true);
    doc = mergeCells(doc, cells[4], cells[5]).doc;
    const all = { from: { para: 0, offset: 0 }, to: { para: doc.paragraphs.length - 1, offset: 0 } };
    const copied = clipOf(doc, all);
    expect(copied.tables).toEqual([{ rows: 3, columns: 2, merges: [{ row: 2, column: 0, rows: 1, columns: 2 }], widths: doc.tables![0].columns, header: 1 }]);
    // As text, a row a line; as HTML, a table that spans.
    expect(clipText(copied)).toContain('Concepto\tMonto\nRenta\t$18,500\nTotal');
    const html = clipHtml(copied);
    expect(html).toContain('<table');
    expect(html).toContain('colspan="2"');
    expect(html).toContain('<th');
    // Read back from this editor's own data, and put in again.
    const back = parseClip(serializeClip(copied))!;
    const pasted = insertClip(createDoc([p('')]), { para: 0, offset: 0 }, back).doc;
    expect(grid(pasted)).toEqual([['Concepto', 'Monto'], ['Renta', '$18,500'], ['Total']]);
    expect(pasted.tables![0].rows[0].header).toBe(true);
  });

  it('is not read back when its cells do not fit its grid', () => {
    const bad = clip();
    bad.paragraphs[1].cell = { table: 0, row: 9, column: 0 };
    expect(parseClip(serializeClip(bad))).toBeUndefined();
    expect(parseClip(JSON.stringify({ ...clip(), tables: [{ rows: 0, columns: 2 }] }))).toBeUndefined();
    expect(parseClip(serializeClip(clip()))).toBeDefined();
  });

  it('gives its cells the look they came with, and its rows their heights, and takes them with it when copied', () => {
    const lines = { top: { style: 'double' as const, width: 0.75, color: '1F3864' }, bottom: { style: 'single' as const, width: 0.5, color: 'BFBFBF' } };
    const looked: Clip = {
      paragraphs: [
        { runs: [{ text: 'a', props: {} }], props: {}, cell: { table: 0, row: 0, column: 0 } },
        { runs: [{ text: 'b', props: {} }], props: {}, cell: { table: 0, row: 0, column: 1 } },
        { runs: [{ text: 'c', props: {} }], props: {}, cell: { table: 0, row: 1, column: 1 } },
      ],
      tables: [
        {
          rows: 2,
          columns: 2,
          merges: [{ row: 0, column: 0, rows: 2, columns: 1 }],
          cells: [
            { row: 0, column: 0, shade: '1F3864', valign: 'center' },
            { row: 0, column: 1, lines },
            { row: 1, column: 1, lines: {} },
          ],
          heights: [{ row: 1, height: 25, exact: true }],
        },
      ],
    };
    const doc = insertClip(createDoc([p('')]), { para: 0, offset: 0 }, looked).doc;
    const [first, second] = doc.tables![0].rows;
    // Merged down, its colour goes down with it.
    expect([first.cells[0].shade, first.cells[0].valign, second.cells[0].shade]).toEqual(['1F3864', 'center', '1F3864']);
    expect(first.cells[1]).toMatchObject({ borders: true, lines, borderTop: 2.25, borderBottom: 0.5 });
    expect(second.cells[1].borders).toBe(false);
    expect([second.height, second.exact]).toEqual([25, true]);
    // Copied again, it is the same; and as HTML, Word reads the lines, the colour and the height.
    const range = { from: { para: 0, offset: 0 }, to: { para: doc.paragraphs.length - 1, offset: 0 } };
    const again = clipOf(doc, range).tables![0];
    expect(again.cells).toEqual(expect.arrayContaining([expect.objectContaining({ row: 0, column: 0, shade: '1F3864', valign: 'center' }), expect.objectContaining({ row: 0, column: 1, lines })]));
    expect(again.heights).toEqual([{ row: 1, height: 25, exact: true }]);
    const html = clipHtml(clipOf(doc, range));
    expect(html).toContain('border-top:double #1F3864 0.75pt');
    expect(html).toContain('background:#1F3864');
    expect(html).toContain('height:25pt;mso-height-rule:exactly');
  });
});
