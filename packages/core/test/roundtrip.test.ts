import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type TextMeasurer,
  applyRunProps,
  deleteRange,
  docText,
  exportDocx,
  importDocx,
  insertText,
  layoutDocument,
  moveChar,
  paragraphLength,
  setParagraphProps,
  splitParagraph,
} from '../src';

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"';

const STYLES =
  `<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>` +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"/>' +
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:pPr><w:ind w:left="720"/></w:pPr></w:style>' +
  '</w:styles>';

const DRAWING =
  '<w:drawing><wp:inline><wp:extent cx="1270000" cy="635000"/><a:blip r:embed="rId7"/></wp:inline></w:drawing>';

// One paragraph per feature, each on its own line so tests can find them.
const P = {
  heading: '<w:p w14:paraId="0A0A0A0A" w:rsidR="00AA"><w:pPr><w:pStyle w:val="Heading1"/><w:keepNext/></w:pPr><w:r><w:t>Title</w:t></w:r></w:p>',
  list: '<w:p w14:paraId="0B0B0B0B"><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="3"/></w:numPr></w:pPr><w:r><w:t>First item</w:t></w:r></w:p>',
  rich:
    '<w:p><w:bookmarkStart w:id="1" w:name="mark"/>' +
    '<w:r><w:rPr><w:rFonts w:asciiTheme="majorHAnsi"/><w:lang w:val="es-MX"/></w:rPr><w:t xml:space="preserve">See </w:t></w:r>' +
    '<w:hyperlink r:id="rId5" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:color w:val="0563C1" w:themeColor="hyperlink"/></w:rPr><w:t>the site</w:t></w:r></w:hyperlink>' +
    '<w:bookmarkEnd w:id="1"/>' +
    `<w:r><w:t xml:space="preserve"> and </w:t></w:r><w:r>${DRAWING}</w:r>` +
    '<w:ins w:id="9" w:author="Ana"><w:r><w:t>added</w:t></w:r></w:ins>' +
    '<w:del w:id="10" w:author="Ana"><w:r><w:delText>removed</w:delText></w:r></w:del>' +
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>7</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>' +
    '</w:p>',
  table:
    '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tr><w:trPr><w:cantSplit/></w:trPr>' +
    '<w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr><w:p><w:r><w:t>A1</w:t></w:r></w:p></w:tc>' +
    '<w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr><w:p><w:r><w:t>B1</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
  section: '<w:p><w:pPr><w:sectPr><w:type w:val="continuous"/></w:sectPr></w:pPr><w:r><w:t>End of section</w:t></w:r></w:p>',
  plain: '<w:p><w:r><w:t>Plain &amp; simple</w:t></w:r></w:p>',
};
const SECT = '<w:sectPr><w:headerReference w:type="default" r:id="rId8"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>';
const DOCUMENT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${Object.values(P).join('')}${SECT}</w:body></w:document>`;

const PARTS: Record<string, string> = {
  '[Content_Types].xml': '<Types/>',
  '_rels/.rels': '<Relationships/>',
  'word/document.xml': DOCUMENT,
  'word/styles.xml': STYLES,
  'word/numbering.xml': '<w:numbering/>',
  'word/header1.xml': '<w:hdr><w:p><w:r><w:t>Header</w:t></w:r></w:p></w:hdr>',
  'word/_rels/document.xml.rels':
    '<Relationships><Relationship Id="rId7" Target="media/image1.png"/><Relationship Id="rId5" Target="https://example.com" TargetMode="External"/></Relationships>',
  'word/media/image1.png': 'PNGDATA',
};

function open(): Doc {
  return importDocx(zipSync(Object.fromEntries(Object.entries(PARTS).map(([k, v]) => [k, strToU8(v)]))));
}

function save(doc: Doc): { xml: string; files: Record<string, Uint8Array> } {
  const files = unzipSync(exportDocx(doc));
  return { xml: strFromU8(files['word/document.xml']), files };
}

/** Index of the paragraph holding `text`, and the offset where it starts. */
function find(doc: Doc, text: string): { para: number; offset: number } {
  for (let para = 0; para < doc.paragraphs.length; para++) {
    const offset = doc.paragraphs[para].runs.map((r) => r.text).join('').indexOf(text);
    if (offset >= 0) return { para, offset };
  }
  throw new Error(`not found: ${text}`);
}

const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

describe('lossless round-trip', () => {
  it('reads the visible text, skipping deleted runs and field codes', () => {
    expect(docText(open())).toBe(
      ['Title', 'First item', 'See the site and added7', 'A1', 'B1', 'End of section', 'Plain & simple'].join('\n'),
    );
  });

  it('writes an untouched document back byte for byte', () => {
    const { xml, files } = save(open());
    expect(xml).toBe(DOCUMENT);
    for (const [path, content] of Object.entries(PARTS)) expect(strFromU8(files[path])).toBe(content);
  });

  it('rewrites only the edited paragraph', () => {
    const doc = open();
    const at = find(doc, 'Plain');
    const { xml, files } = save(insertText(doc, at, 'Very ').doc);
    for (const key of ['heading', 'list', 'rich', 'table', 'section'] as const) expect(xml).toContain(P[key]);
    expect(xml).not.toContain(P.plain);
    expect(xml).toContain('<w:p><w:r><w:t xml:space="preserve">Very Plain &amp; simple</w:t></w:r></w:p>');
    expect(xml.endsWith(`${SECT}</w:body></w:document>`)).toBe(true);
    expect(strFromU8(files['word/header1.xml'])).toBe(PARTS['word/header1.xml']);
    expect(strFromU8(files['word/media/image1.png'])).toBe('PNGDATA');
  });

  it('keeps everything it does not model inside an edited paragraph', () => {
    const doc = open();
    const at = find(doc, 'See ');
    const { xml } = save(insertText(doc, { para: at.para, offset: at.offset + 4 }, 'now ').doc);
    expect(xml).not.toContain(P.rich);
    for (const kept of [
      '<w:bookmarkStart w:id="1" w:name="mark"/>',
      '<w:rPr><w:rFonts w:asciiTheme="majorHAnsi"/><w:lang w:val="es-MX"/></w:rPr><w:t xml:space="preserve">See now </w:t>',
      '<w:hyperlink r:id="rId5" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:color w:val="0563C1" w:themeColor="hyperlink"/></w:rPr><w:t xml:space="preserve">the site</w:t></w:r></w:hyperlink>',
      '<w:bookmarkEnd w:id="1"/>',
      `<w:r>${DRAWING}</w:r>`,
      '<w:ins w:id="9" w:author="Ana"><w:r><w:t xml:space="preserve">added</w:t></w:r></w:ins>',
      '<w:del w:id="10" w:author="Ana"><w:r><w:delText>removed</w:delText></w:r></w:del>',
      '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>',
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>',
    ]) {
      expect(xml).toContain(kept);
    }
    // The edited file reads back to the same model it was written from.
    expect(docText(importDocx(exportDocx(insertText(doc, at, 'X').doc)))).toContain('XSee the site and added7');
  });

  it('writes only the formatting that changed', () => {
    const doc = open();
    const at = find(doc, 'the site');
    const range = { from: at, to: { para: at.para, offset: at.offset + 3 } };
    const { xml } = save(applyRunProps(doc, range, { bold: true, color: 'FF0000' }));
    expect(xml).toContain(
      '<w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:b/><w:bCs/><w:color w:val="FF0000"/></w:rPr><w:t xml:space="preserve">the</w:t></w:r>',
    );
    // The rest of the link keeps its theme colour, and no size or font is spelled out.
    expect(xml).toContain('<w:color w:val="0563C1" w:themeColor="hyperlink"/></w:rPr><w:t xml:space="preserve"> site</w:t>');
    expect(xml).not.toContain('<w:sz ');

    const heading = save(applyRunProps(doc, { from: { para: 0, offset: 0 }, to: { para: 0, offset: 5 } }, { bold: false }));
    expect(heading.xml).toContain('<w:r><w:rPr><w:b w:val="0"/><w:bCs w:val="0"/></w:rPr><w:t xml:space="preserve">Title</w:t></w:r>');

    const aligned = save(setParagraphProps(doc, 0, 0, { align: 'center', spacingAfter: 12 }));
    expect(aligned.xml).toContain(
      '<w:pPr><w:pStyle w:val="Heading1"/><w:keepNext/><w:spacing w:after="240"/><w:jc w:val="center"/></w:pPr>',
    );
  });

  it('gives both halves of a split paragraph the original properties', () => {
    const doc = open();
    const at = find(doc, 'First item');
    const { xml } = save(splitParagraph(doc, { para: at.para, offset: 6 }).doc);
    const pPr = '<w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="3"/></w:numPr></w:pPr>';
    expect(xml).toContain(
      `<w:p w14:paraId="0B0B0B0B">${pPr}<w:r><w:t xml:space="preserve">First </w:t></w:r></w:p>` +
        `<w:p>${pPr}<w:r><w:t xml:space="preserve">item</w:t></w:r></w:p>`,
    );
  });

  it('moves a section break to the last half of a split paragraph', () => {
    const doc = open();
    const at = find(doc, 'End of section');
    const { xml } = save(splitParagraph(doc, { para: at.para, offset: 3 }).doc);
    expect(xml).toContain(
      '<w:p><w:r><w:t xml:space="preserve">End</w:t></w:r></w:p>' +
        '<w:p><w:pPr><w:sectPr><w:type w:val="continuous"/></w:sectPr></w:pPr><w:r><w:t xml:space="preserve"> of section</w:t></w:r></w:p>',
    );
  });

  it('keeps the table structure when a deletion crosses cells', () => {
    const doc = open();
    const a1 = find(doc, 'A1');
    const b1 = find(doc, 'B1');
    const cleared = deleteRange(doc, { from: { para: a1.para, offset: 1 }, to: { para: b1.para, offset: 1 } });
    // The text goes, but each cell keeps its paragraph.
    expect(cleared.paragraphs).toHaveLength(doc.paragraphs.length);
    expect(save(cleared).xml).toContain(
      '<w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">A</w:t></w:r></w:p></w:tc>' +
        '<w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">1</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
    );
    // A cell left without paragraphs by other means still gets the one the schema requires.
    const merged = { ...doc, paragraphs: doc.paragraphs.filter((_, i) => i !== b1.para) };
    expect(save(merged).xml).toContain('<w:tc><w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr><w:p/></w:tc></w:tr></w:tbl>');
  });

  it('lays out drawings as boxes and anchors as zero-width', () => {
    const doc = open();
    const para = find(doc, 'See ').para;
    const layout = layoutDocument(doc, measurer);
    const objects = layout.lines.filter((l) => l.para === para).flatMap((l) => l.fragments.filter((f) => f.kind === 'object'));
    expect(objects.filter((f) => f.width > 0).map((f) => [f.width, f.ascent])).toEqual([[100, 50]]);
    expect(objects.filter((f) => f.width === 0).length).toBe(7);
  });

  it('steps the caret over anchors', () => {
    const doc = open();
    const para = find(doc, 'See ').para;
    // The paragraph starts with a bookmark: one step right lands after the "S".
    expect(moveChar(doc, { para, offset: 0 }, 1)).toEqual({ para, offset: 2 });
    expect(moveChar(doc, { para, offset: 2 }, -1)).toEqual({ para, offset: 1 });
    // The field ends in an anchor: from the end, one step left crosses it and the "7".
    const end = paragraphLength(doc.paragraphs[para]);
    expect(moveChar(doc, { para, offset: end }, -1)).toEqual({ para, offset: end - 2 });
  });
});
