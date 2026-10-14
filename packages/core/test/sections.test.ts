import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type TextMeasurer,
  COLUMN_BREAK_XML,
  columnsAt,
  createDoc,
  createParagraph,
  deleteRange,
  docEnd,
  exportDocx,
  hitTest,
  importDocx,
  insertColumnBreak,
  layoutDocument,
  paragraphText,
  sectionCount,
  sectionsOf,
  setColumns,
  splitParagraph,
} from '../src';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

// Monospace fake: every character is half the font size wide; 10pt text makes 10pt lines.
const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

const STYLES =
  `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults>` +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:pPr><w:spacing w:after="0"/></w:pPr></w:style></w:styles>';

const p = (text: string, pPr = '') => `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
// A 300 x 200pt page with 10pt margins: a text area 280pt wide and 180pt tall, eighteen 10pt lines.
const PAGE = '<w:pgSz w:w="6000" w:h="4000"/><w:pgMar w:top="200" w:right="200" w:bottom="200" w:left="200" w:header="100" w:footer="100"/>';
/** Section properties: two columns 20pt apart unless said otherwise. */
const sect = (inner = '<w:cols w:num="2" w:space="400"/>', type = '') => `<w:sectPr>${type ? `<w:type w:val="${type}"/>` : ''}${PAGE}${inner}</w:sectPr>`;
/** An empty paragraph that ends a section. */
const end = (sectPr: string) => `<w:p><w:pPr>${sectPr}</w:pPr></w:p>`;

function open(body: string, last = sect('<w:cols w:space="720"/>'), extra: Record<string, string> = {}): Doc {
  const document = `<w:document ${W} ${R}><w:body>${body}${last}</w:body></w:document>`;
  const files: Record<string, Uint8Array> = { 'word/document.xml': strToU8(document), 'word/styles.xml': strToU8(STYLES) };
  for (const [path, xml] of Object.entries(extra)) files[path] = strToU8(xml);
  return importDocx(zipSync(files));
}

const lines = (n: number, prefix = 'x') => Array.from({ length: n }, (_, i) => p(`${prefix}${i + 1}`)).join('');
const xml = (doc: Doc) => strFromU8(unzipSync(exportDocx(doc))['word/document.xml']);

describe('sections', () => {
  it('reads the sections of a document: their page, their columns and where they start', () => {
    const doc = open(p('a') + end(sect('<w:cols w:num="3" w:space="400" w:sep="1"/>', 'continuous')) + p('b'), sect('<w:cols w:num="2" w:space="400" w:equalWidth="0"><w:col w:w="2000" w:space="600"/><w:col w:w="3000"/></w:cols>', 'nextColumn'));
    expect(doc.paragraphs[1].section?.columns).toEqual({ count: 3, space: 20, separator: true });
    expect(doc.paragraphs[1].section?.start).toBe('continuous');
    expect(doc.columns).toEqual({ count: 2, space: 20, widths: [{ width: 100, space: 30 }, { width: 150, space: 0 }] });
    expect(doc.sectionStart).toBe('nextColumn');
    expect(sectionsOf(doc).map((s) => [s.columns.count, s.start, s.end])).toEqual([[3, 'continuous', 2], [2, 'nextColumn', 3]]);
    expect(sectionCount(doc)).toBe(2);
    expect(columnsAt(doc, 0).count).toBe(3);
    expect(columnsAt(doc, 2).count).toBe(2);
  });

  it('sets the text down one column and then down the next', () => {
    const doc = open(lines(20), sect());
    const layout = layoutDocument(doc, measurer);
    expect(layout.pages).toHaveLength(1);
    const at = (para: number) => layout.lines.find((l) => l.para === para)!;
    // Columns of (280 - 20) / 2 = 130pt: the second starts 150pt in from the margin.
    expect([at(0).x, at(0).y]).toEqual([10, 10]);
    expect([at(17).x, at(17).y]).toEqual([10, 180]);
    expect([at(18).x, at(18).y]).toEqual([160, 10]);
    expect(at(19).y).toBe(20);
  });

  it('puts the caret in the column clicked, and in the nearest one beside or below them', () => {
    // Three lines in each column, and one under them across the page.
    const doc = open(lines(6) + end(sect('<w:cols w:num="2" w:space="400"/>')) + p('after'), sect('<w:cols w:space="720"/>', 'continuous'));
    const layout = layoutDocument(doc, measurer);
    const click = (x: number, y: number) => hitTest(layout, measurer, 0, x, y).para;
    expect(click(20, 15)).toBe(0);
    expect(click(170, 15)).toBe(3);
    expect(click(170, 35)).toBe(5);
    // Between the columns, the nearer.
    expect(click(143, 25)).toBe(1);
    expect(click(157, 25)).toBe(4);
    // Right of the short text of a column, and below the end of the second.
    expect(click(120, 15)).toBe(0);
    expect(click(250, 38)).toBe(5);
    expect(click(200, 45)).toBe(7);
  });

  it('breaks the lines of a paragraph to the width of its column, and again in a column of another width', () => {
    const word = 'abcd ';
    const doc = open(p(word.repeat(50).trim()), sect('<w:cols w:num="2" w:equalWidth="0"><w:col w:w="1000" w:space="200"/><w:col w:w="3000"/></w:cols>'));
    const layout = layoutDocument(doc, measurer);
    // 50pt holds two words a line, eighteen lines down; 150pt, six words a line for the fourteen left.
    const first = layout.lines.filter((l) => l.x === 10);
    const second = layout.lines.filter((l) => l.x === 70);
    expect(first).toHaveLength(18);
    expect(second).toHaveLength(3);
    expect(paragraphText(doc.paragraphs[0]).slice(first[0].start, first[0].end)).toBe('abcd abcd ');
    expect(paragraphText(doc.paragraphs[0]).slice(second[0].start, second[0].end)).toBe('abcd '.repeat(6));
  });

  it('goes on in the next column after a column break, and on the next page after the last', () => {
    const breakRun = '<w:r><w:br w:type="column"/></w:r>';
    const body = `<w:p><w:r><w:t>a</w:t></w:r>${breakRun}<w:r><w:t>b</w:t></w:r>${breakRun}<w:r><w:t>c</w:t></w:r></w:p>`;
    const doc = open(body, sect());
    const layout = layoutDocument(doc, measurer);
    const text = paragraphText(doc.paragraphs[0]);
    const where = layout.lines.map((l) => [l.page, l.x, l.y, text.slice(l.start, l.end).replace(/[^abc]/g, '')]);
    expect(where).toEqual([
      [0, 10, 10, 'a'],
      [0, 160, 10, 'b'],
      [1, 10, 10, 'c'],
    ]);
  });

  it('evens out the columns of a section that one starting on the same page follows', () => {
    const doc = open(lines(6) + end(sect('<w:cols w:num="2" w:space="400"/>')) + p('after'), sect('<w:cols w:space="720"/>', 'continuous'));
    const layout = layoutDocument(doc, measurer);
    const at = (para: number) => layout.lines.find((l) => l.para === para)!;
    expect(layout.pages).toHaveLength(1);
    // Three lines in each column, and what follows under the deeper of them.
    expect([at(2).x, at(2).y]).toEqual([10, 30]);
    expect([at(3).x, at(3).y]).toEqual([160, 10]);
    expect([at(7).x, at(7).y]).toEqual([10, 40]);
  });

  it('gives no room to the empty paragraph that only ends a section', () => {
    const doc = open(p('a') + end(sect('<w:cols w:space="720"/>')) + p('b'), sect('<w:cols w:space="720"/>', 'continuous'));
    const layout = layoutDocument(doc, measurer);
    expect(layout.lines.map((l) => [l.para, l.y])).toEqual([[0, 10], [1, 20], [2, 20]]);
  });

  it('starts a section on a new page, on an odd one or in the next column, as it asks', () => {
    const two = (type: string) => layoutDocument(open(p('a') + end(sect('<w:cols w:num="2" w:space="400"/>')) + p('b'), sect('<w:cols w:num="2" w:space="400"/>', type)), measurer);
    const b = (layout: ReturnType<typeof layoutDocument>) => layout.lines.find((l) => l.para === 2)!;
    expect([b(two('nextPage')).page, b(two('nextPage')).y]).toEqual([1, 10]);
    expect([b(two('nextColumn')).page, b(two('nextColumn')).x]).toEqual([0, 160]);
    // Page 2 is even: an odd page leaves it blank.
    expect(b(two('oddPage')).page).toBe(2);
    expect(two('nextPage').pages.map((page) => page.section)).toEqual([0, 1]);
  });

  it('draws a line down between the columns of a section that asks for one, as deep as they go', () => {
    const doc = open(lines(4), sect('<w:cols w:num="2" w:space="400" w:sep="1"/>'));
    expect(layoutDocument(doc, measurer).pages[0].rules).toEqual([{ x: 150, top: 10, bottom: 50 }]);
    expect(layoutDocument(open(lines(4), sect()), measurer).pages[0].rules).toBeUndefined();
  });

  it('shows no header on the pages of the first sections when none of them has one', () => {
    const hdr = `<w:hdr ${W}><w:p><w:r><w:t>head</w:t></w:r></w:p></w:hdr>`;
    const rels = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>';
    const doc = open(p('a') + end(sect('<w:cols w:space="720"/>')) + p('b'), `<w:sectPr><w:headerReference w:type="default" r:id="rH"/>${PAGE}</w:sectPr>`, {
      'word/header1.xml': hdr,
      'word/_rels/document.xml.rels': rels,
    });
    expect(doc.paragraphs[1].section?.noHeader).toBe(true);
    const layout = layoutDocument(doc, measurer);
    expect(layout.pages.map((page) => !!page.header)).toEqual([false, true]);
  });

  it('sets the columns of the section the caret is in', () => {
    const doc = createDoc([createParagraph('a'), createParagraph('b')]);
    const at = { para: 1, offset: 0 };
    const two = setColumns(doc, { from: at, to: at }, { count: 2, space: 18, separator: true });
    expect(two.columns).toEqual({ count: 2, space: 18, separator: true });
    expect(setColumns(two, { from: at, to: at }, { count: 1, space: 18 }).columns).toBeUndefined();
  });

  it('sets a selection in columns of its own, between breaks that keep it on the same page', () => {
    const doc = createDoc(['a', 'b', 'c', 'd'].map((t) => createParagraph(t)));
    const next = setColumns(doc, { from: { para: 1, offset: 0 }, to: { para: 2, offset: 1 } }, { count: 2, space: 20 });
    expect(next.paragraphs.map((p) => p.section && [p.section.columns?.count ?? 1, p.section.start ?? 'nextPage'])).toEqual([[1, 'nextPage'], undefined, [2, 'continuous'], undefined]);
    expect(next.columns).toBeUndefined();
    expect(next.sectionStart).toBe('continuous');
    // All on one page: the selection in two columns, side by side, between the paragraphs around it.
    const layout = layoutDocument(next, measurer);
    expect(layout.pages).toHaveLength(1);
    const line = (para: number) => layout.lines.find((l) => l.para === para)!;
    expect(line(2).y).toBe(line(1).y);
    expect(line(2).x).toBeGreaterThan(line(1).x);
    expect(line(3).y).toBeGreaterThan(line(2).y);
  });

  it('keeps the end of a section with the second half of a split paragraph, and with what is left of a merged one', () => {
    const doc = setColumns(createDoc(['ab', 'c', 'd'].map((t) => createParagraph(t))), { from: { para: 0, offset: 0 }, to: { para: 0, offset: 2 } }, { count: 2, space: 20 });
    expect(doc.paragraphs[0].section).toBeDefined();
    const split = splitParagraph(doc, { para: 0, offset: 1 }).doc;
    expect(split.paragraphs.map((p) => !!p.section)).toEqual([false, true, false, false]);
    // Joining the paragraph that ends the section to the next takes the break away, as in Word.
    const joined = deleteRange(split, { from: { para: 1, offset: 1 }, to: { para: 2, offset: 0 } });
    expect(joined.paragraphs.map((p) => !!p.section)).toEqual([false, false, false]);
  });

  it('writes the columns back: as they were when untouched, and changed when changed', () => {
    const body = lines(3) + end(sect('<w:cols w:num="3" w:space="400" w:sep="1"/>', 'continuous')) + p('z');
    const doc = open(body, sect('<w:cols w:space="720"/>'));
    // Untouched, the document is the file.
    expect(importDocx(exportDocx(doc)).paragraphs[3].section?.columns).toEqual({ count: 3, space: 20, separator: true });

    const caret = { para: 4, offset: 0 };
    const changed = setColumns(doc, { from: caret, to: caret }, { count: 2, space: 30 });
    const out = xml(changed);
    expect(out).toContain('<w:cols w:num="2" w:space="600"/>');
    const back = importDocx(exportDocx(changed));
    expect(back.columns).toEqual({ count: 2, space: 30 });
    expect(back.paragraphs[3].section?.columns?.count).toBe(3);

    // A section made here has its properties written on the paragraph that ends it.
    const made = setColumns(doc, { from: { para: 0, offset: 0 }, to: { para: 1, offset: 1 } }, { count: 2, space: 20 });
    const reread = importDocx(exportDocx(made));
    // The selection ends at a break of its own; the rest of its section starts on the same page.
    expect(reread.paragraphs.map((p) => p.section?.columns?.count ?? (p.section ? 1 : 0))).toEqual([0, 2, 0, 3, 0]);
    expect(reread.paragraphs[3].section?.start).toBe('continuous');
  });

  it('puts a column break in the text, and writes it as Word does', () => {
    const doc = createDoc([createParagraph('ab')]);
    const at = insertColumnBreak(setColumns(doc, { from: docEnd(doc), to: docEnd(doc) }, { count: 2, space: 20 }), { para: 0, offset: 1 });
    expect(at.pos).toEqual({ para: 0, offset: 2 });
    const layout = layoutDocument(at.doc, measurer);
    // 'b' goes on at the top of the second column.
    expect(layout.lines.map((l) => l.y)).toEqual([72, 72]);
    expect(layout.lines[1].x).toBeGreaterThan(layout.lines[0].x);
    expect(xml(at.doc)).toContain(COLUMN_BREAK_XML);
    expect(importDocx(exportDocx(at.doc)).paragraphs[0].runs.some((r) => r.props.object === COLUMN_BREAK_XML)).toBe(true);
  });
});
