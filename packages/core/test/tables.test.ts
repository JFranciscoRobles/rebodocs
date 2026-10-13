import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type TextMeasurer,
  adjacentLine,
  cellExtent,
  createDoc,
  createParagraph,
  deleteColumn,
  deleteRow,
  deleteRange,
  docEnd,
  docStart,
  docText,
  exportDocx,
  hitTest,
  importDocx,
  insertColumn,
  insertRow,
  insertTable,
  insertText,
  layoutDocument,
  locateCell,
  neighbourCell,
  splitParagraph,
} from '../src';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

// Monospace fake: every character is half the font size wide; 10pt text makes 10pt lines.
const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

const STYLES =
  `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults>` +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:pPr><w:spacing w:after="100"/></w:pPr></w:style>' +
  '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:tblPr><w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
  '<w:style w:type="table" w:styleId="TableGrid"><w:basedOn w:val="TableNormal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:i/></w:rPr>' +
  // Borders of no thickness, so the geometry below is that of the text alone.
  '<w:tblPr><w:tblBorders><w:top w:val="single" w:sz="0"/><w:insideH w:val="single" w:sz="0"/></w:tblBorders></w:tblPr></w:style>' +
  '</w:styles>';

const p = (text: string, pPr = '') => `<w:p>${pPr}<w:r><w:t>${text}</w:t></w:r></w:p>`;
const tc = (content: string, tcPr = '') => `<w:tc><w:tcPr>${tcPr}</w:tcPr>${content}</w:tc>`;
const tr = (cells: string, trPr = '') => `<w:tr>${trPr}${cells}</w:tr>`;
const tbl = (rows: string, tblPr = '<w:tblStyle w:val="TableGrid"/>', grid = [2000, 2000]) =>
  `<w:tbl><w:tblPr>${tblPr}</w:tblPr><w:tblGrid>${grid.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>`;

// 300pt wide page with 10pt margins: a 280pt text area.
function open(body: string): Doc {
  const document =
    `<w:document ${W}><w:body>${body}` +
    '<w:sectPr><w:pgSz w:w="6000" w:h="2000"/><w:pgMar w:top="200" w:right="200" w:bottom="200" w:left="200"/></w:sectPr>' +
    '</w:body></w:document>';
  return importDocx(zipSync({ 'word/document.xml': strToU8(document), 'word/styles.xml': strToU8(STYLES) }));
}

const GRID = p('before') + tbl(tr(tc(p('A1')) + tc(p('B1') + p('B1b'))) + tr(tc(p('A2')) + tc(p('B2')))) + p('after');

describe('tables', () => {
  it('reads the structure and points every cell paragraph at its cell', () => {
    const doc = open(GRID);
    expect(docText(doc)).toBe('before\nA1\nB1\nB1b\nA2\nB2\nafter');
    expect(doc.paragraphs.map((x) => x.cell && [x.cell.row, x.cell.cell])).toEqual([
      undefined, [0, 0], [0, 1], [0, 1], [1, 0], [1, 1], undefined,
    ]);
    const cell = (id: number) => ({ id, span: 1, borders: true, borderTop: 0, borderBottom: 0 });
    expect(doc.tables).toEqual([
      {
        columns: [100, 100],
        fixed: false,
        align: 'left',
        indent: 0,
        padTop: 0,
        padRight: 5,
        padBottom: 0,
        padLeft: 5,
        rows: [
          { id: 0, before: 0, height: 0, cells: [cell(0), cell(1)] },
          { id: 1, before: 0, height: 0, cells: [cell(0), cell(1)] },
        ],
      },
    ]);
  });

  it('gives cell paragraphs the formatting of the table style, under their own style', () => {
    const doc = open(GRID);
    // Normal's spacing wins over the table style's; the italic only the table style sets comes through.
    expect(doc.paragraphs[1].props.spacingAfter).toBe(5);
    expect(doc.paragraphs[1].runs[0].props.italic).toBe(true);
    expect(doc.paragraphs[0].runs[0].props.italic).toBeUndefined();
    // Borders come from the style unless the table or the cell says otherwise.
    const plain = open(tbl(tr(tc(p('x')) + tc(p('y'), '<w:tcBorders><w:top w:val="single"/></w:tcBorders>')), ''));
    expect(plain.tables![0].rows[0].cells.map((c) => c.borders)).toEqual([false, true]);
  });

  it('lays the cells of a row side by side, as tall as the tallest', () => {
    const layout = layoutDocument(open(GRID), measurer);
    const [page] = layout.pages;
    // 'before' takes 10pt + 5pt after; the first row holds two 15pt paragraphs in its second cell.
    expect(page.cells.map((c) => [c.x, c.y, c.width, c.height])).toEqual([
      [10, 25, 100, 30], [110, 25, 100, 30], [10, 55, 100, 15], [110, 55, 100, 15],
    ]);
    expect(layout.lines.map((l) => [l.x, l.y, l.cell])).toEqual([
      [10, 10, undefined], [15, 25, 0], [115, 25, 1], [115, 40, 1], [15, 55, 2], [115, 55, 3], [10, 70, undefined],
    ]);
  });

  it('wraps text to the width of its cell', () => {
    const layout = layoutDocument(open(tbl(tr(tc(p('aaaa bbbb cccc dddd eeee ffff')) + tc(p('x'))))), measurer);
    // 100pt column less 5pt on each side: 18 characters to a line.
    expect(layout.lines.filter((l) => l.para === 0).map((l) => [l.start, l.end])).toEqual([[0, 15], [15, 29]]);
    expect(layout.pages[0].cells[1].height).toBe(layout.pages[0].cells[0].height);
  });

  it('sizes columns from the grid, a relative width, spans and row settings', () => {
    const wide = layoutDocument(open(tbl(tr(tc(p('a')) + tc(p('b'))), '<w:tblW w:w="5000" w:type="pct"/>', [1000, 3000])), measurer);
    expect(wide.pages[0].cells.map((c) => [c.x, c.width])).toEqual([[10, 70], [80, 210]]);

    // A grid wider than the text area is narrowed to fit, unless the table is fixed.
    const big = [4000, 4000];
    expect(layoutDocument(open(tbl(tr(tc(p('a')) + tc(p('b'))), '', big)), measurer).pages[0].cells.map((c) => c.width)).toEqual([140, 140]);
    expect(
      layoutDocument(open(tbl(tr(tc(p('a')) + tc(p('b'))), '<w:tblLayout w:type="fixed"/>', big)), measurer).pages[0].cells.map((c) => c.width),
    ).toEqual([200, 200]);

    const spans = tbl(
      tr(tc(p('wide'), '<w:gridSpan w:val="2"/>')) + tr(tc(p('b')), '<w:trPr><w:gridBefore w:val="1"/><w:trHeight w:val="600"/></w:trPr>'),
      '<w:jc w:val="center"/>',
    );
    expect(layoutDocument(open(spans), measurer).pages[0].cells.map((c) => [c.x, c.y, c.width, c.height])).toEqual([
      [50, 10, 200, 15], [150, 25, 100, 30],
    ]);
  });

  it('makes room in each row for its horizontal borders', () => {
    // A 1.5pt border on top of the table, 0.5pt between rows and 1pt under it; one cell asks for 2pt below itself.
    const borders = '<w:tblBorders><w:top w:val="single" w:sz="12"/><w:insideH w:val="single"/><w:bottom w:val="single" w:sz="8"/></w:tblBorders>';
    const thick = '<w:tcBorders><w:bottom w:val="single" w:sz="16"/></w:tcBorders>';
    const doc = open(tbl(tr(tc(p('a')) + tc(p('b'))) + tr(tc(p('c'), thick) + tc(p('d'))) + tr(tc(p('e')) + tc(p('f'))), borders));
    expect(doc.tables![0].rows.map((row) => row.cells.map((c) => [c.borderTop, c.borderBottom]))).toEqual([
      [[1.5, 0.5], [1.5, 0.5]], [[0.5, 2], [0.5, 0.5]], [[0.5, 1], [0.5, 1]],
    ]);
    const layout = layoutDocument(doc, measurer);
    // Rows hold a 15pt paragraph: 1.5 + 15 + 0.5, then 15 + 2, then 15 + 1.
    expect(layout.pages[0].cells.filter((c) => c.cell === 0).map((c) => [c.y, c.height])).toEqual([[10, 17], [27, 17], [44, 16]]);
    // Text starts under the table's top border.
    expect(layout.lines.filter((l) => l.cell !== undefined && layout.pages[0].cells[l.cell].cell === 0).map((l) => l.y)).toEqual([11.5, 27, 44]);
  });

  it('uses the margins a cell sets for itself', () => {
    const margins = '<w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="400" w:type="dxa"/><w:right w:w="200" w:type="dxa"/></w:tcMar>';
    const doc = open(tbl(tr(tc(p('aaaa bbbb cccc dddd'), margins) + tc(p('x')))));
    expect(doc.tables![0].rows[0].cells[0]).toMatchObject({ padTop: 2, padLeft: 20, padRight: 10 });
    const layout = layoutDocument(doc, measurer);
    // 100pt column less 20pt and 10pt: 14 characters to a line (the space after them hangs), 20pt in and 2pt down.
    expect(layout.lines.filter((l) => l.para === 0).map((l) => [l.x, l.y, l.end])).toEqual([[30, 12, 15], [30, 22, 19]]);
    expect(layout.lines[2]).toMatchObject({ x: 115, y: 10 });
    expect(layout.pages[0].cells[0].height).toBe(27);
  });

  it('draws cells merged down as one box', () => {
    const merged = tbl(
      tr(tc(p('top'), '<w:vMerge w:val="restart"/>') + tc(p('b1'))) + tr(tc(p(''), '<w:vMerge/>') + tc(p('b2'))) + tr(tc(p('a3')) + tc(p('b3'))),
    );
    const layout = layoutDocument(open(merged), measurer);
    expect(layout.pages[0].cells.map((c) => [c.x, c.y, c.height])).toEqual([
      [10, 10, 30], [110, 10, 15], [110, 25, 15], [10, 40, 15], [110, 40, 15],
    ]);
    // The paragraph of the continued cell is laid out inside the merged box.
    expect(layout.lines[2]).toMatchObject({ para: 2, cell: 0, y: 25 });
  });

  it('moves a row that does not fit to the next page, whole', () => {
    const rows = Array.from({ length: 6 }, (_, i) => tr(tc(p(`a${i}`)) + tc(p(`b${i}`)))).join('');
    // 80pt of text area per page; rows are 15pt tall.
    const layout = layoutDocument(open(tbl(rows)), measurer);
    expect(layout.pages.map((pg) => pg.cells.length)).toEqual([10, 2]);
    expect(layout.pages[1].cells[0]).toMatchObject({ y: 10, row: 5 });
    expect(layout.lines.map((l) => l.page)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
  });

  it('breaks a row that does not fit between its lines, cell by cell', () => {
    // Twelve 10pt lines and 5pt after them, on pages that hold 80pt.
    const long = Array.from({ length: 12 }, (_, i) => `line${String(i).padStart(2, '0')} xxxxxxxx`).join(' ');
    const doc = open(tbl(tr(tc(p(long)) + tc(p('b1') + p('b2')))) + p('after'));
    const layout = layoutDocument(doc, measurer);
    // Both cells get a box on each page: down to the bottom of the first, and as tall as what is left on the second.
    expect(layout.pages.map((pg) => pg.cells.map((c) => [c.cell, c.y, c.height]))).toEqual([
      [[0, 10, 80], [1, 10, 80]],
      [[0, 10, 45], [1, 10, 45]],
    ]);
    const cellLines = (cell: number) => layout.lines.filter((l) => l.para === cell).map((l) => [l.page, l.y]);
    expect(cellLines(0).map(([pg]) => pg)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);
    expect(cellLines(0)[8]).toEqual([1, 10]);
    // The short cell is all on the first page, and the text after the table follows the second part of the row.
    expect(layout.lines.filter((l) => l.para === 1 || l.para === 2).map((l) => [l.page, l.y])).toEqual([[0, 10], [0, 25]]);
    expect(layout.lines[layout.lines.length - 1]).toMatchObject({ para: 3, page: 1, y: 55 });
    // Lines stay in paragraph order, each paragraph's own lines together.
    expect(layout.lines.map((l) => l.para)).toEqual([...new Array<number>(12).fill(0), 1, 2, 3]);
    expect(layout.paraFirstLine).toEqual([0, 12, 13, 14]);
    expect(layout.lines.map((l) => l.index)).toEqual(layout.lines.map((_, i) => i));
    // A click in the part of the cell on the second page lands on its lines there.
    expect(hitTest(layout, measurer, 1, 15, 12)).toEqual({ para: 0, offset: layout.lines[8].start });
  });

  it('starts a row on the next page when not even its first lines fit, or when it must stay whole', () => {
    const lead = p('1') + p('2') + p('3') + p('4');
    const tall = p('aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii');
    // 20pt are left: one line of the 30pt row would fit, so it is broken there...
    const broken = layoutDocument(open(lead + tbl(tr(tc(tall) + tc(p('x'))))), measurer);
    expect(broken.pages.map((pg) => pg.cells.map((c) => [c.y, c.height]))).toEqual([[[70, 20], [70, 20]], [[10, 15], [10, 15]]]);
    // ...unless the row says it cannot be split: then it moves whole.
    const whole = layoutDocument(open(lead + tbl(tr(tc(tall) + tc(p('x')), '<w:trPr><w:cantSplit/></w:trPr>'))), measurer);
    expect(whole.pages.map((pg) => pg.cells.length)).toEqual([0, 2]);
    expect(whole.pages[1].cells[0]).toMatchObject({ y: 10, height: 35 });
    // With 5pt left no line fits, so the row moves too.
    const none = layoutDocument(open(lead + p('5') + tbl(tr(tc(tall) + tc(p('x'))))), measurer);
    expect(none.pages.map((pg) => pg.cells.length)).toEqual([0, 2]);
    // A row that must stay whole but is taller than a page runs off it rather than vanish.
    const long = Array.from({ length: 12 }, () => 'xxxxxxxxxxxxxxxxxx').join(' ');
    const over = layoutDocument(open(tbl(tr(tc(p(long)) + tc(p('x')), '<w:trPr><w:cantSplit/></w:trPr>'))), measurer);
    expect(over.pages).toHaveLength(1);
    expect(over.pages[0].cells[0].height).toBe(125);
  });

  it('keeps rows together when their paragraphs ask to be kept with the next', () => {
    const keep = '<w:pPr><w:keepNext/></w:pPr>';
    const rowsOf = (pPr: string) => [0, 1, 2].map((i) => tr(tc(p(`a${i}`, pPr)) + tc(p(`b${i}`, pPr)))).join('');
    const lead = p('1') + p('2') + p('3');
    // 35pt are left on the page: two 15pt rows fit, the third goes over.
    expect(layoutDocument(open(lead + tbl(rowsOf('')) + p('after')), measurer).pages.map((pg) => pg.cells.length)).toEqual([4, 2]);
    // Kept, the three rows and the line after them move to the next page together.
    const kept = layoutDocument(open(lead + tbl(rowsOf(keep)) + p('after')), measurer);
    expect(kept.pages.map((pg) => pg.cells.length)).toEqual([0, 6]);
    expect(kept.lines[kept.lines.length - 1].page).toBe(1);
  });

  it('maps clicks to the cell under them', () => {
    const doc = open(GRID);
    const layout = layoutDocument(doc, measurer);
    expect(hitTest(layout, measurer, 0, 20, 30)).toEqual({ para: 1, offset: 1 });
    // Below the only line of A1, still inside its cell.
    expect(hitTest(layout, measurer, 0, 20, 50)).toEqual({ para: 1, offset: 1 });
    expect(hitTest(layout, measurer, 0, 130, 45)).toEqual({ para: 3, offset: 3 });
    expect(hitTest(layout, measurer, 0, 300, 60)).toEqual({ para: 5, offset: 2 });
    expect(hitTest(layout, measurer, 0, 12, 72)).toEqual({ para: 6, offset: 0 });
    expect(hitTest(layout, measurer, 0, 12, 12)).toEqual({ para: 0, offset: 0 });
  });

  it('moves the caret up and down by rows, staying in its column', () => {
    const layout = layoutDocument(open(GRID), measurer);
    const step = (from: number, x: number, dir: -1 | 1) => adjacentLine(layout, layout.lines[from], x, dir)?.para;
    // From 'before' down into the table, by where the caret is.
    expect(step(0, 20, 1)).toBe(1);
    expect(step(0, 150, 1)).toBe(2);
    // From A1 down to A2, not across to B1; from B1 down to its own second paragraph.
    expect(step(1, 20, 1)).toBe(4);
    expect(step(2, 120, 1)).toBe(3);
    expect(step(3, 120, 1)).toBe(5);
    expect(step(4, 20, 1)).toBe(6);
    // Up from 'after' into the last row, and from A2 to A1.
    expect(step(6, 150, -1)).toBe(5);
    expect(step(4, 20, -1)).toBe(1);
    expect(step(5, 120, -1)).toBe(3);
    expect(step(1, 20, -1)).toBe(0);
    expect(step(0, 20, -1)).toBeUndefined();
  });

  it('finds the cells around a paragraph', () => {
    const doc = open(GRID);
    expect(cellExtent(doc, 3)).toEqual({ from: 2, to: 3 });
    expect(neighbourCell(doc, 1, 1)).toEqual({ from: 2, to: 3 });
    expect(neighbourCell(doc, 2, 1)).toEqual({ from: 4, to: 4 });
    expect(neighbourCell(doc, 4, -1)).toEqual({ from: 2, to: 3 });
    expect(neighbourCell(doc, 1, -1)).toBeUndefined();
    expect(neighbourCell(doc, 5, 1)).toBeUndefined();
    expect(neighbourCell(doc, 0, 1)).toBeUndefined();
  });

  it('clears text across cells without merging them, and merges inside a cell', () => {
    const doc = open(GRID);
    const all = deleteRange(doc, { from: docStart(), to: docEnd(doc) });
    expect(docText(all)).toBe('\n\n\n\n\n');
    expect(all.paragraphs.map((x) => x.cell && [x.cell.row, x.cell.cell])).toEqual([undefined, [0, 0], [0, 1], [1, 0], [1, 1], undefined]);
    // From the middle of 'before' to the middle of B1b: A1 is emptied, B1 and B1b become one.
    const part = deleteRange(doc, { from: { para: 0, offset: 2 }, to: { para: 3, offset: 2 } });
    expect(docText(part)).toBe('be\n\nb\nA2\nB2\nafter');
    // A paragraph split inside a cell stays in it.
    const split = splitParagraph(doc, { para: 1, offset: 1 }).doc;
    expect(split.paragraphs[2].cell).toEqual({ table: 0, row: 0, cell: 0 });
    expect(layoutDocument(split, measurer).pages[0].cells[0].height).toBe(30);
    expect(docText(importDocx(exportDocx(split)))).toBe('before\nA\n1\nB1\nB1b\nA2\nB2\nafter');
  });

  it('reads a table inside a cell as paragraphs of that cell', () => {
    const doc = open(tbl(tr(tc(p('outer') + tbl(tr(tc(p('inner'))), '', [500]) + p('tail')) + tc(p('b')))));
    expect(doc.tables).toHaveLength(1);
    expect(doc.paragraphs.map((x) => x.cell!.cell)).toEqual([0, 0, 0, 1]);
    expect(importDocx(exportDocx(doc))).toEqual(doc);
  });
});

const xmlOf = (doc: Doc) => strFromU8(unzipSync(exportDocx(doc))['word/document.xml']);
/** The table as rows of cell texts, paragraphs of a cell joined by '/'. */
function grid(doc: Doc, table = 0): string[][] {
  return doc.tables![table].rows.map((row) =>
    row.cells.map((cell) =>
      doc.paragraphs
        .filter((x) => x.cell?.table === table && x.cell.row === row.id && x.cell.cell === cell.id)
        .map((x) => x.runs.map((r) => r.text).join(''))
        .join('/'),
    ),
  );
}
const paraOf = (doc: Doc, text: string) => doc.paragraphs.findIndex((x) => x.runs.map((r) => r.text).join('') === text);

describe('changing the shape of a table', () => {
  it('inserts a table at the caret, splitting the paragraph around it', () => {
    const plain = createDoc([createParagraph('hello world', { bold: true }, { align: 'center', spacingAfter: 12 })]);
    const { doc, pos } = insertTable(plain, { para: 0, offset: 5 }, 2, 3);
    expect(docText(doc)).toBe('hello\n\n\n\n\n\n\n world');
    expect(pos).toEqual({ para: 1, offset: 0 });
    expect(grid(doc)).toEqual([['', '', ''], ['', '', '']]);
    // Three equal columns across the 468pt text area; cells take the caret's formatting but not the paragraph's spacing.
    expect(doc.tables![0].columns).toEqual([156, 156, 156]);
    expect(doc.paragraphs[1].runs[0].props.bold).toBe(true);
    expect(doc.paragraphs[1].props).toMatchObject({ spacingAfter: 0 });
    expect(doc.paragraphs[1].props.align).toBeUndefined();
    expect(layoutDocument(doc, measurer).pages[0].cells).toHaveLength(6);

    // In an empty paragraph the table goes above it; inside a cell nothing happens.
    const empty = insertTable(createDoc(), { para: 0, offset: 0 }, 1, 1);
    expect(empty.doc.paragraphs.map((x) => !!x.cell)).toEqual([true, false]);
    expect(insertTable(doc, { para: 1, offset: 0 }, 2, 2).doc).toBe(doc);
  });

  it('writes a table made from scratch and reads it back', () => {
    let { doc } = insertTable(createDoc([createParagraph('top')]), { para: 0, offset: 3 }, 2, 2);
    doc = insertText(doc, { para: 1, offset: 0 }, 'A1').doc;
    doc = insertText(doc, { para: 4, offset: 0 }, 'B2').doc;
    const xml = xmlOf(doc);
    expect(xml).toContain('<w:tblGrid><w:gridCol w:w="4680"/><w:gridCol w:w="4680"/></w:tblGrid>');
    expect(xml).toContain('<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>');
    expect(xml.match(/<w:tc><w:tcPr><w:tcW w:w="4680" w:type="dxa"\/><\/w:tcPr><w:p>/g)).toHaveLength(4);
    // The table sits between the two halves of the paragraph it was inserted in.
    expect(xml.indexOf('top')).toBeLessThan(xml.indexOf('<w:tbl>'));
    expect(xml.indexOf('</w:tbl>')).toBeLessThan(xml.lastIndexOf('<w:p>'));
    const back = importDocx(exportDocx(doc));
    expect(grid(back)).toEqual([['A1', ''], ['', 'B2']]);
    expect(back.tables![0]).toMatchObject({ columns: [234, 234], fixed: true, padLeft: 5.4, padRight: 5.4 });
    expect(back.tables![0].rows[0].cells[0]).toMatchObject({ borders: true, borderTop: 0.5, borderBottom: 0.5 });
    expect(docText(back)).toBe(docText(doc));
  });

  it('adds and removes rows, leaving the other paragraphs as they were', () => {
    const doc = open(GRID);
    const below = insertRow(doc, paraOf(doc, 'A1'), true);
    expect(grid(below)).toEqual([['A1', 'B1/B1b'], ['', ''], ['A2', 'B2']]);
    expect(below.tables![0].rows.map((row) => row.id)).toEqual([0, 2, 1]);
    // Every paragraph that was there is the same object, so export copies it as it was.
    expect(doc.paragraphs.every((x) => below.paragraphs.includes(x))).toBe(true);
    expect(grid(insertRow(doc, paraOf(doc, 'B2'), false))).toEqual([['A1', 'B1/B1b'], ['', ''], ['A2', 'B2']]);
    // The new cells are formatted like the ones of the row they were made from.
    expect(below.paragraphs[4].runs[0].props.italic).toBe(true);
    expect(locateCell(below, 4)).toMatchObject({ rowIndex: 1, cellIndex: 0, column: 0 });

    const removed = deleteRow(below, paraOf(below, 'A1'));
    expect(grid(removed.doc)).toEqual([['', ''], ['A2', 'B2']]);
    expect(removed.pos).toEqual({ para: 1, offset: 0 });
    // Removing every row removes the table.
    let gone = deleteRow(doc, paraOf(doc, 'A2'));
    gone = deleteRow(gone.doc, gone.pos.para);
    expect(docText(gone.doc)).toBe('before\nafter');
    expect(gone.pos).toEqual({ para: 1, offset: 0 });
    expect(layoutDocument(gone.doc, measurer).pages[0].cells).toHaveLength(0);
  });

  it('adds and removes columns, cells over several columns growing or shrinking with them', () => {
    const wide = tbl(tr(tc(p('wide'), '<w:gridSpan w:val="2"/>')) + tr(tc(p('a')) + tc(p('b'))));
    const doc = open(wide);
    const right = insertColumn(doc, paraOf(doc, 'a'), true);
    // The new column falls inside the wide cell, which now covers three.
    expect(grid(right)).toEqual([['wide'], ['a', '', 'b']]);
    expect(right.tables![0].rows[0].cells[0].span).toBe(3);
    // It is as wide as the one beside it, and the table keeps its width.
    expect(right.tables![0].columns.map((w) => Math.round(w * 100) / 100)).toEqual([66.67, 66.67, 66.67]);
    // At the edge of the table the column is outside the wide cell, so that row gets a cell too.
    expect(grid(insertColumn(doc, paraOf(doc, 'a'), false))).toEqual([['', 'wide'], ['', 'a', 'b']]);
    const end = insertColumn(doc, paraOf(doc, 'b'), true);
    expect(grid(end)).toEqual([['wide', ''], ['a', 'b', '']]);
    expect(end.tables![0].rows[0].cells.map((c) => c.span)).toEqual([2, 1]);

    const removed = deleteColumn(right, paraOf(right, 'a'));
    expect(grid(removed.doc)).toEqual([['wide'], ['', 'b']]);
    expect(removed.doc.tables![0].rows[0].cells[0].span).toBe(2);
    expect(removed.doc.tables![0].columns).toHaveLength(2);
    // Removing the last column removes the table.
    const one = open(tbl(tr(tc(p('x'))) + tr(tc(p('y'))), '', [2000]) + p('after'));
    expect(docText(deleteColumn(one, 0).doc)).toBe('after');
  });

  it('keeps cells merged down consistent when rows are added or removed', () => {
    const merged = tbl(
      tr(tc(p('top'), '<w:vMerge w:val="restart"/>') + tc(p('b1'))) + tr(tc(p(''), '<w:vMerge/>') + tc(p('b2'))) + tr(tc(p('a3')) + tc(p('b3'))),
    );
    const doc = open(merged);
    const merges = (d: Doc) => d.tables![0].rows.map((row) => row.cells[0].merge);
    // A row added inside the merged run joins it; one added after it does not.
    expect(merges(insertRow(doc, paraOf(doc, 'b1'), true))).toEqual(['start', 'continue', 'continue', undefined]);
    expect(merges(insertRow(doc, paraOf(doc, 'b2'), true))).toEqual(['start', 'continue', undefined, undefined]);
    // Removing the row the run started in starts it in the next one.
    expect(merges(deleteRow(doc, paraOf(doc, 'b1')).doc)).toEqual(['start', undefined]);
  });

  it('writes a reshaped table with the properties its rows and cells had in the file', () => {
    const rowProps = '<w:trPr><w:cantSplit/></w:trPr>';
    const shade = '<w:shd w:val="clear" w:fill="EEEEEE"/>';
    const body =
      p('before') +
      tbl(tr(tc(p('A1'), shade) + tc(p('B1')), rowProps) + tr(tc(p('A2')) + tc(p('B2'))), '<w:tblStyle w:val="TableGrid"/><w:tblLook w:val="04A0"/>') +
      p('after');
    const doc = open(body);
    const reshaped = insertColumn(insertRow(doc, paraOf(doc, 'A1'), true), paraOf(doc, 'A1'), true);
    expect(grid(reshaped)).toEqual([['A1', '', 'B1'], ['', '', ''], ['A2', '', 'B2']]);
    const xml = xmlOf(reshaped);
    // The table's own properties are kept as they were, and the grid is rewritten.
    expect(xml).toContain('<w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblLook w:val="04A0"/></w:tblPr><w:tblGrid><w:gridCol w:w="1333"/><w:gridCol w:w="1333"/><w:gridCol w:w="1333"/></w:tblGrid>');
    // Row properties survive, and the new row takes those of the row it follows.
    expect(xml.match(/<w:tr><w:trPr><w:cantSplit\/><\/w:trPr>/g)).toHaveLength(2);
    // A cell keeps what the model does not read (its shading), with its width brought up to date.
    expect(xml).toContain(`<w:tc><w:tcPr><w:tcW w:w="1333" w:type="dxa"/>${shade}</w:tcPr><w:p><w:r><w:t>A1</w:t></w:r></w:p></w:tc>`);
    // Untouched paragraphs are copied as they were, in and around the table.
    for (const text of ['before', 'A1', 'B1', 'A2', 'B2', 'after']) expect(xml).toContain(`<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`);
    const back = importDocx(exportDocx(reshaped));
    expect(grid(back)).toEqual(grid(reshaped));
    expect(docText(back)).toBe(docText(reshaped));
    expect(back.tables![0].rows.map((row) => !!row.cantSplit)).toEqual([true, true, false]);

    // Text typed in a new cell is written there, and a table left without rows is not written at all.
    const typed = insertText(reshaped, paraOf(reshaped, 'B1') - 1 >= 0 ? { para: 2, offset: 0 } : { para: 0, offset: 0 }, 'new');
    expect(grid(importDocx(exportDocx(typed.doc)))[0]).toEqual(['A1', 'new', 'B1']);
    let gone = deleteRow(doc, paraOf(doc, 'A1'));
    gone = deleteRow(gone.doc, gone.pos.para);
    expect(xmlOf(gone.doc)).not.toContain('<w:tbl>');
    expect(docText(importDocx(exportDocx(gone.doc)))).toBe('before\nafter');
  });

  it('writes a table added to an opened document where it was inserted, not inside the table before it', () => {
    const doc = open(tbl(tr(tc(p('A1')) + tc(p('B1')))) + p('') + p('end'));
    const { doc: added } = insertTable(doc, { para: 2, offset: 0 }, 1, 2);
    expect(added.paragraphs.map((x) => x.cell?.table)).toEqual([0, 0, 1, 1, undefined, undefined]);
    const xml = xmlOf(added);
    expect(xml.match(/<w:tbl>/g)).toHaveLength(2);
    expect(xml.indexOf('</w:tbl>')).toBeLessThan(xml.lastIndexOf('<w:tbl>'));
    const back = importDocx(exportDocx(added));
    expect(back.tables).toHaveLength(2);
    expect(back.paragraphs.map((x) => x.cell?.table)).toEqual([0, 0, 1, 1, undefined, undefined]);
    // The first table was not touched: it is written exactly as it was.
    expect(xml).toContain(tbl(tr(tc(p('A1')) + tc(p('B1')))));
    // The same in the middle of the text.
    const mid = insertTable(open(p('one two') + p('end')), { para: 0, offset: 3 }, 1, 1).doc;
    expect(docText(importDocx(exportDocx(mid)))).toBe('one\n\n two\nend');
    expect(importDocx(exportDocx(mid)).paragraphs.map((x) => !!x.cell)).toEqual([false, true, false, false]);
  });
});
