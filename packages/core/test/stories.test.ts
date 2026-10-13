import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type Story,
  type TextMeasurer,
  bandLayout,
  caretRect,
  deleteRange,
  exportDocx,
  hitTest,
  importDocx,
  insertText,
  layoutDocument,
  mapFieldOffset,
  outsideField,
  paragraphLength,
  setPageNumbering,
  splitParagraph,
  storyOnPage,
} from '../src';

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const FIELD =
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r>' +
  '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
const H = {
  table:
    '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tr>' +
    '<w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr><w:p><w:r><w:t>Left</w:t></w:r></w:p></w:tc>' +
    '<w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Right</w:t></w:r></w:p></w:tc>' +
    '</w:tr></w:tbl>',
  title: '<w:p w:rsidR="00AA"><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t>Company name</w:t></w:r></w:p>',
  number: `<w:p><w:r><w:t xml:space="preserve">Page </w:t></w:r>${FIELD}<w:r><w:t xml:space="preserve"> end</w:t></w:r></w:p>`,
};
const HEADER = `<w:hdr ${NS}>${H.table}${H.title}${H.number}</w:hdr>`;
const BODY = Array.from({ length: 200 }, (_, i) => `<w:p><w:r><w:t>Line ${i}</w:t></w:r></w:p>`).join('');
const SECT = '<w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:pgSz w:w="4000" w:h="4000"/><w:pgMar w:top="1440" w:right="400" w:bottom="400" w:left="400" w:header="200" w:footer="200"/></w:sectPr>';
const DOCUMENT = `<w:document ${NS}><w:body>${BODY}${SECT}</w:body></w:document>`;
const PARTS: Record<string, string> = {
  '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  'word/document.xml': DOCUMENT,
  'word/header1.xml': HEADER,
  'word/_rels/document.xml.rels':
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>',
};

const open = (): Doc => importDocx(zipSync(Object.fromEntries(Object.entries(PARTS).map(([k, v]) => [k, strToU8(v)]))));
const save = (doc: Doc) => {
  const files = unzipSync(exportDocx(doc));
  return { header: strFromU8(files['word/header1.xml']), document: strFromU8(files['word/document.xml']), files };
};
/** The header seen as a document, which is how the editing operations are run on it. */
const inHeader = (doc: Doc, change: (text: Doc) => Doc): Doc => {
  const story = doc.header!;
  const text = change({ ...doc, paragraphs: story.paragraphs, tables: story.tables, header: undefined });
  return { ...doc, header: { paragraphs: text.paragraphs, tables: text.tables } as Story };
};
const textOf = (story: Story) => story.paragraphs.map((p) => p.runs.filter((r) => !r.props.object).map((r) => r.text).join(''));
const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

describe('editing a header', () => {
  it('reads the header with its table, and writes it back untouched', () => {
    const doc = open();
    expect(textOf(doc.header!)).toEqual(['Left', 'Right', 'Company name', 'Page 1 end']);
    expect(doc.header!.paragraphs.map((p) => !!p.cell)).toEqual([true, true, false, false]);
    const out = save(doc);
    expect(out.header).toBe(HEADER);
    expect(out.document).toBe(DOCUMENT);
  });

  it('rewrites only the edited paragraph, on top of its original formatting', () => {
    const out = save(inHeader(open(), (text) => insertText(text, { para: 2, offset: 0 }, 'The ').doc));
    expect(out.header).toBe(
      `<w:hdr ${NS}>${H.table}<w:p w:rsidR="00AA"><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">The Company name</w:t></w:r></w:p>${H.number}</w:hdr>`,
    );
    expect(out.document).toBe(DOCUMENT);
  });

  it('rewrites a paragraph inside a table of the header, where it was', () => {
    const out = save(inHeader(open(), (text) => insertText(text, { para: 1, offset: 5 }, ' side').doc));
    expect(out.header).toContain('<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Right side</w:t></w:r></w:p></w:tc></w:tr></w:tbl>');
    expect(out.header).toContain(`<w:p><w:r><w:t>Left</w:t></w:r></w:p></w:tc>`);
    expect(out.header.endsWith(`${H.title}${H.number}</w:hdr>`)).toBe(true);
  });

  it('keeps the page number a field when the text around it is edited', () => {
    const doc = inHeader(open(), (text) => {
      const end = paragraphLength(text.paragraphs[3]);
      return deleteRange(text, { from: { para: 3, offset: end - 4 }, to: { para: 3, offset: end } });
    });
    expect(textOf(doc.header!)[3]).toBe('Page 1');
    const out = save(doc);
    // Rebuilt runs always say their spaces count; the marks of the field are the ones the file had.
    expect(out.header).toContain(`<w:p><w:r><w:t xml:space="preserve">Page </w:t></w:r>${FIELD.replace('<w:t>', '<w:t xml:space="preserve">')}</w:p>`);
    // And it still reads as a page number on every page.
    const back = importDocx(exportDocx(doc));
    expect(back.header!.paragraphs[3].runs.find((r) => r.props.field)?.props.field).toBe('PAGE');
  });

  it('keeps typing out of the marks of the page number, where Word would write over it', () => {
    const text = { ...open(), paragraphs: open().header!.paragraphs };
    // "Page " is 5 long, then come the three marks before the digit, the digit and the closing mark.
    const marks = text.paragraphs[3].runs.map((r) => (r.props.object ? '*' : r.text)).join('');
    expect(marks).toBe('Page ***1* end');
    const at = (offset: number) => outsideField(text, { para: 3, offset }).offset;
    expect([4, 5, 6, 8, 9, 10, 11].map(at)).toEqual([4, 5, 5, 5, 10, 10, 11]);
    // Anywhere else nothing moves.
    expect(outsideField(text, { para: 2, offset: 3 })).toEqual({ para: 2, offset: 3 });
  });

  it('writes the paragraphs a split makes, and new ones, in their place', () => {
    const split = inHeader(open(), (text) => splitParagraph(text, { para: 2, offset: 7 }).doc);
    expect(textOf(split.header!)).toEqual(['Left', 'Right', 'Company', ' name', 'Page 1 end']);
    const out = save(split);
    const at = (text: string) => out.header.indexOf(text);
    expect(at('</w:tbl>')).toBeLessThan(at('>Company<'));
    expect(at('>Company<')).toBeLessThan(at('> name<'));
    expect(at('> name<')).toBeLessThan(at('>Page <'));
    // Both halves keep the formatting of the paragraph they come from.
    expect(out.header.match(/<w:jc w:val="center"\/>/g)).toHaveLength(2);
    expect(importDocx(exportDocx(split)).header!.paragraphs).toHaveLength(5);
  });

  it('writes a page number made here with its marks, also once joined to a paragraph of the file', () => {
    // The number goes first in a header; joining the title to it leaves its field in a paragraph of the file.
    const numbered = setPageNumbering({ ...open(), header: { ...open().header!, paragraphs: open().header!.paragraphs.slice(0, 3) } }, { place: 'header', align: 'left', format: 'number' });
    expect(numbered.header!.paragraphs[0].runs[0].props.field).toBe('PAGE');
    const moved: Doc = { ...numbered, header: { ...numbered.header!, paragraphs: [...numbered.header!.paragraphs.slice(1), numbered.header!.paragraphs[0]] } };
    const joined = inHeader(moved, (text) => deleteRange(text, { from: { para: 2, offset: paragraphLength(text.paragraphs[2]) }, to: { para: 3, offset: 0 } }));
    expect(textOf(joined.header!)).toEqual(['Left', 'Right', 'Company name1']);
    const out = save(joined);
    expect(out.header).toContain('<w:instrText xml:space="preserve"> PAGE </w:instrText>');
    expect(out.header.match(/w:fldCharType="begin"/g)).toHaveLength(1);
    expect(importDocx(exportDocx(joined)).header!.paragraphs[2].runs.some((r) => r.props.field === 'PAGE')).toBe(true);
  });

  it('finds positions in the header of a page, whatever its page number is', () => {
    const doc = open();
    const layout = layoutDocument(doc, measurer);
    expect(layout.pages.length).toBeGreaterThan(10);
    const page = 11;
    const band = bandLayout(layout, 'header', page)!;
    expect(band.pages).toHaveLength(1);
    expect(band.lines.every((line, i) => line.index === i && line.page === 0)).toBe(true);
    expect(bandLayout(layout, 'footer', page)).toBeUndefined();
    // On page 12 the number is two digits wide where the document holds one.
    const model = doc.header!.paragraphs[3];
    const shown = storyOnPage(doc.header!, page + 1, layout.pages.length).paragraphs[3];
    const length = paragraphLength(model);
    expect(paragraphLength(shown)).toBe(length + 1);
    expect(mapFieldOffset(model, shown, length)).toBe(length + 1);
    expect(mapFieldOffset(shown, model, length + 1)).toBe(length);
    expect(mapFieldOffset(model, shown, 3)).toBe(3);
    // A click at the end of that line is the end of the paragraph.
    const end = caretRect(band, measurer, { para: 3, offset: length + 1 });
    const hit = hitTest(band, measurer, 0, end.x + 50, end.y + 1);
    expect(hit).toEqual({ para: 3, offset: length + 1 });
    expect(mapFieldOffset(shown, model, hit.offset)).toBe(length);
  });
});
