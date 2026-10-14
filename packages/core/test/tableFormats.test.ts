import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type Doc, type TextMeasurer, boxLines, exportDocx, importDocx, layoutDocument } from '../src';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

// Monospace fake: every character is half the font size wide; 10pt text makes 10pt lines.
const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

const LINE = (sz: number, color = '1F3864', kind = 'single') => `w:val="${kind}" w:sz="${sz}" w:space="0" w:color="${color}"`;

const STYLES =
  `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults>` +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:pPr><w:spacing w:after="0"/></w:pPr></w:style>' +
  '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:tblPr><w:tblCellMar><w:left w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>' +
  // Lines above and below the table and between its rows; a dark heading row with white bold text, and banded rows.
  '<w:style w:type="table" w:styleId="Ledger"><w:basedOn w:val="TableNormal"/>' +
  `<w:tblPr><w:tblBorders><w:top ${LINE(16)}/><w:left w:val="nil"/><w:bottom ${LINE(16)}/><w:right w:val="nil"/><w:insideH ${LINE(4, 'BFBFBF')}/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr>` +
  '<w:tblStylePr w:type="firstRow"><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="1F3864"/></w:tcPr></w:tblStylePr>' +
  '<w:tblStylePr w:type="band1Horz"><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="F2F5FA"/></w:tcPr></w:tblStylePr>' +
  '</w:style></w:styles>';

const p = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
const tc = (content: string, tcPr = '') => `<w:tc><w:tcPr>${tcPr}</w:tcPr>${content}</w:tc>`;
const tr = (cells: string, trPr = '') => `<w:tr>${trPr ? `<w:trPr>${trPr}</w:trPr>` : ''}${cells}</w:tr>`;
const tbl = (rows: string, tblPr: string, grid = [2000, 2000]) =>
  `<w:tbl><w:tblPr>${tblPr}</w:tblPr><w:tblGrid>${grid.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>`;
const LOOK = '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>';

// 300 x 200pt page with 10pt margins: a text area 280pt wide and 180pt tall.
function open(body: string): Doc {
  const document =
    `<w:document ${W}><w:body>${body}` +
    '<w:sectPr><w:pgSz w:w="6000" w:h="4000"/><w:pgMar w:top="200" w:right="200" w:bottom="200" w:left="200"/></w:sectPr>' +
    '</w:body></w:document>';
  return importDocx(zipSync({ 'word/document.xml': strToU8(document), 'word/styles.xml': strToU8(STYLES) }));
}

describe('table formats', () => {
  it('gives the parts of a table the look its style sets apart: the heading row, the banded rows', () => {
    const rows = tr(tc(p('H1')) + tc(p('H2'))) + tr(tc(p('a')) + tc(p('b'))) + tr(tc(p('c')) + tc(p('d')));
    const doc = open(tbl(rows, `<w:tblStyle w:val="Ledger"/>${LOOK}`) + p('after'));
    const table = doc.tables![0];
    expect(table.rows.map((row) => row.cells[1].shade)).toEqual(['1F3864', 'F2F5FA', undefined]);
    // The text of the heading row is white and bold; the rest is not.
    expect(doc.paragraphs[0].runs[0].props).toMatchObject({ bold: true, color: 'FFFFFF' });
    expect(doc.paragraphs[2].runs[0].props.bold).toBeUndefined();
    // Without the heading row in its look, the first row is a band like the others.
    const plain = open(tbl(rows, '<w:tblStyle w:val="Ledger"/><w:tblLook w:val="0000"/>') + p('after'));
    expect(plain.tables![0].rows.map((row) => row.cells[0].shade)).toEqual(['F2F5FA', undefined, 'F2F5FA']);
  });

  it('draws each side of a cell with the line the table, its style or the cell gives it', () => {
    const own = `<w:tcBorders><w:left ${LINE(6, 'E55A2A', 'double')}/><w:right ${LINE(8, '000000', 'dashed')}/></w:tcBorders>`;
    const doc = open(tbl(tr(tc(p('a')) + tc(p('b'), own)) + tr(tc(p('c')) + tc(p('d'))), `<w:tblStyle w:val="Ledger"/>${LOOK}`) + p('after'));
    const [first, second] = doc.tables![0].rows;
    const navy = (width: number) => ({ width, color: '1F3864', style: 'single' });
    // Lines above and between the rows only, from the style.
    expect(first.cells[0].lines).toEqual({ top: navy(2), bottom: { width: 0.5, color: 'BFBFBF', style: 'single' } });
    expect(second.cells[0].lines).toEqual({ top: { width: 0.5, color: 'BFBFBF', style: 'single' }, bottom: navy(2) });
    // A cell's own lines go over them.
    expect(first.cells[1].lines?.left).toEqual({ width: 0.75, color: 'E55A2A', style: 'double' });
    expect(first.cells[1].lines?.right).toEqual({ width: 1, color: '000000', style: 'dashed' });
    // A box of the layout is drawn with the lines of its cell.
    const box = layoutDocument(doc, measurer).pages[0].cells[1];
    expect(boxLines(box).left?.style).toBe('double');
    // The lines go back into the file as they were.
    const again = importDocx(exportDocx(doc));
    expect(again.tables![0].rows[0].cells[1].lines).toEqual(first.cells[1].lines);
  });

  it('sets the text of a cell at its top, its middle or its bottom', () => {
    const tall = '<w:trHeight w:val="1000"/>';
    const doc = open(tbl(tr(tc(p('top')) + tc(p('mid'), '<w:vAlign w:val="center"/>'), tall) + tr(tc(p('x')) + tc(p('low'), '<w:vAlign w:val="bottom"/>'), tall), '') + p('after'));
    const layout = layoutDocument(doc, measurer);
    const y = (para: number) => layout.lines.find((l) => l.para === para)!.y;
    // Rows 50pt tall holding 10pt lines.
    expect(y(0)).toBe(10);
    expect(y(1)).toBe(30);
    expect(y(3)).toBe(100);
  });

  it('spreads the text of a cell merged down over the rows it covers, and makes only the last taller', () => {
    const merged = tc(p('one') + p('two') + p('three') + p('four'), '<w:vMerge w:val="restart"/>');
    const rows = tr(merged + tc(p('a'))) + tr(tc(p(''), '<w:vMerge/>') + tc(p('b')));
    const layout = layoutDocument(open(tbl(rows, '') + p('after')), measurer);
    const at = (para: number) => layout.lines.find((l) => l.para === para)!.y;
    // 'b' starts its row right under 'a', and the second row is as tall as the merged text needs.
    expect(at(4)).toBe(10);
    expect(at(6)).toBe(20);
    expect(at(1)).toBe(20);
    expect(at(3)).toBe(40);
    expect(at(7)).toBe(50);
  });

  it('shows the heading rows again at the top of every page a table goes on to', () => {
    const body = Array.from({ length: 25 }, (_, i) => tr(tc(p(`r${i}`)) + tc(p('.')))).join('');
    const doc = open(tbl(tr(tc(p('Head')) + tc(p('Er')), '<w:tblHeader/>') + body, '') + p('after'));
    expect(doc.tables![0].rows.map((row) => !!row.header).slice(0, 3)).toEqual([true, false, false]);
    const layout = layoutDocument(doc, measurer);
    expect(layout.pages.length).toBeGreaterThan(1);
    const [, second] = layout.pages;
    // The heading is the first thing on the second page, drawn again, but it is in the document once.
    expect(second.lines.some((l) => l.para === 0 && l.y === 10)).toBe(true);
    expect(layout.lines.filter((l) => l.para === 0)).toHaveLength(1);
    expect(second.cells.filter((c) => c.row === 0)).toHaveLength(2);
  });

  it('keeps a row of an exact height at that height whatever it holds', () => {
    const doc = open(tbl(tr(tc(p('a') + p('b') + p('c')) + tc(p('d')), '<w:trHeight w:hRule="exact" w:val="300"/>') + tr(tc(p('e')) + tc(p('f'))), '') + p('after'));
    expect(doc.tables![0].rows[0].exact).toBe(true);
    const layout = layoutDocument(doc, measurer);
    expect(layout.lines.find((l) => l.para === 4)!.y).toBe(25);
  });

  it('lets the text go round a table that floats beside it', () => {
    const float = '<w:tblpPr w:leftFromText="200" w:rightFromText="200" w:vertAnchor="text" w:horzAnchor="margin" w:tblpXSpec="right" w:tblpY="0"/>';
    const words = Array.from({ length: 30 }, () => 'word').join(' ');
    const doc = open(tbl(tr(tc(p('f1')) + tc(p('f2'))) + tr(tc(p('f3')) + tc(p('f4'))), float, [1000, 1000]) + p(words));
    expect(doc.tables![0].float).toMatchObject({ align: 'right', gapLeft: 10 });
    const layout = layoutDocument(doc, measurer);
    const text = layout.lines.filter((l) => l.para === 4);
    // The table, 100pt wide at the right margin, and 10pt clear of it: the first lines stop 110pt short.
    expect(text[0].y).toBe(10);
    expect(text[0].width).toBeLessThanOrEqual(170);
    // Below the table the text has the whole width again.
    expect(text.at(-1)!.y).toBeGreaterThanOrEqual(30);
    expect(Math.max(...text.map((l) => l.width))).toBeGreaterThan(170);
  });

  it('writes back the vertical place of the text, the heading rows and the lines of the cells it was given here', () => {
    const doc = open(tbl(tr(tc(p('a')) + tc(p('b'))) + tr(tc(p('c')) + tc(p('d'))), '') + p('after'));
    const table = doc.tables![0];
    const rows = table.rows.map((row, i) => ({
      ...row,
      header: i === 0 || undefined,
      cells: row.cells.map((cell) => ({ ...cell, valign: 'center' as const, borders: true, lines: { bottom: { width: 1.5, color: 'FF0000', style: 'dotted' as const } } })),
    }));
    const changed = { ...doc, tables: [{ ...table, rows }] };
    const xml = strFromU8(unzipSync(exportDocx(changed))['word/document.xml']);
    expect(xml).toContain('<w:vAlign w:val="center"/>');
    expect(xml).toContain('<w:tblHeader/>');
    expect(xml).toContain('<w:bottom w:val="dotted" w:sz="12" w:space="0" w:color="FF0000"/>');
    const back = importDocx(exportDocx(changed)).tables![0];
    expect(back.rows.map((row) => !!row.header)).toEqual([true, false]);
    expect(back.rows[0].cells[0].valign).toBe('center');
    expect(back.rows[0].cells[0].lines).toEqual({ bottom: { width: 1.5, color: 'FF0000', style: 'dotted' } });
  });
});
