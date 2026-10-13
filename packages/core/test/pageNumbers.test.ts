import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Band,
  type Doc,
  type TextMeasurer,
  createDoc,
  createParagraph,
  exportDocx,
  importDocx,
  layoutDocument,
  pageNumbering,
  setPageNumbering,
} from '../src';

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

// Monospace fake: every character is half the font size wide.
const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

const files = (doc: Doc) => Object.fromEntries(Object.entries(unzipSync(exportDocx(doc))).map(([path, bytes]) => [path, strFromU8(bytes)]));
const textOf = (band: Band | undefined) => (band?.lines ?? []).map((l) => l.fragments.filter((f) => f.kind === 'text').map((f) => f.text).join('')).join('|');

/** Three pages of one line each. */
function threePages(): Doc {
  const page = { width: 200, height: 200, marginTop: 50, marginRight: 20, marginBottom: 50, marginLeft: 20, headerDistance: 10, footerDistance: 10 };
  return createDoc(['one\ftwo\fthree'].map((t) => createParagraph(t, { fontSize: 10 }, { spacingAfter: 0, lineHeight: 1 })), page);
}

describe('page numbers', () => {
  it('puts the number in the footer or the header, in any of four forms, and takes it away', () => {
    const plain = threePages();
    expect(pageNumbering(plain)).toBeUndefined();
    const numbered = setPageNumbering(plain, { place: 'footer', align: 'center', format: 'pageOfTotal' });
    expect(pageNumbering(numbered)).toEqual({ place: 'footer', align: 'center', format: 'pageOfTotal' });
    // The body is untouched: only the footer is new.
    expect(numbered.paragraphs).toBe(plain.paragraphs);

    const layout = layoutDocument(numbered, measurer);
    expect(layout.pages.map((p) => textOf(p.footer))).toEqual(['Página 1 de 3', 'Página 2 de 3', 'Página 3 de 3']);
    // 13 characters of 10pt text are 65pt wide: centred in the 160pt between the margins, at the foot of the page.
    expect(layout.pages[1].footer!.lines[0]).toMatchObject({ x: 20 + (160 - 65) / 2, y: 180 });

    const forms = (['number', 'numberOfTotal', 'page', 'pageOfTotal'] as const).map((format) => {
      const doc = setPageNumbering(plain, { place: 'header', align: 'right', format });
      expect(pageNumbering(doc)).toEqual({ place: 'header', align: 'right', format });
      return textOf(layoutDocument(doc, measurer).pages[1].header);
    });
    expect(forms).toEqual(['2', '2 / 3', 'Página 2', 'Página 2 de 3']);

    // The number takes the font of the text, not of a mark that happens to come first.
    const marked = { ...plain, paragraphs: [{ props: {}, runs: [{ text: '\u2060', props: { fontFamily: 'Symbol', object: '<w:bookmarkStart/>', anchor: true } }, { text: 'Text', props: { fontFamily: 'Georgia' } }] }] };
    expect(setPageNumbering(marked, { place: 'footer', align: 'left', format: 'number' }).footer!.paragraphs[0].runs[0].props).toMatchObject({ fontFamily: 'Georgia', fontSize: 10 });

    // Setting it again moves it: there is never more than one.
    const moved = setPageNumbering(numbered, { place: 'header', align: 'left', format: 'number' });
    expect(moved.footer!.paragraphs).toHaveLength(0);
    expect(textOf(layoutDocument(moved, measurer).pages[2].header)).toBe('3');
    expect(textOf(layoutDocument(moved, measurer).pages[2].footer)).toBe('');
    const removed = setPageNumbering(moved, undefined);
    expect(pageNumbering(removed)).toBeUndefined();
    expect(setPageNumbering(plain, undefined)).toBe(plain);
  });

  it('writes the footer of a new document as a part of its own, with real fields', () => {
    const doc = setPageNumbering(threePages(), { place: 'footer', align: 'right', format: 'numberOfTotal' });
    const out = files(doc);
    expect(out['[Content_Types].xml']).toContain('<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>');
    expect(out['word/_rels/document.xml.rels']).toContain('relationships/footer" Target="footer1.xml"/>');
    expect(out['word/document.xml']).toContain('<w:sectPr><w:footerReference w:type="default" r:id="rId1"/><w:pgSz');
    const footer = out['word/footer1.xml'];
    expect(footer).toContain('<w:jc w:val="right"/>');
    expect(footer).toContain('<w:fldChar w:fldCharType="begin"/></w:r>');
    expect(footer.match(/<w:instrText xml:space="preserve"> (\w+) <\/w:instrText>/g)).toEqual([
      '<w:instrText xml:space="preserve"> PAGE </w:instrText>',
      '<w:instrText xml:space="preserve"> NUMPAGES </w:instrText>',
    ]);
    expect(out['word/header1.xml']).toBeUndefined();

    const back = importDocx(exportDocx(doc));
    expect(pageNumbering(back)).toEqual({ place: 'footer', align: 'right', format: 'numberOfTotal' });
    expect(layoutDocument(back, measurer).pages.map((p) => textOf(p.footer))).toEqual(['1 / 3', '2 / 3', '3 / 3']);
    // Saved again without changes, the footer part is the same.
    expect(files(back)['word/footer1.xml']).toBe(footer);
  });

  const PAGE_FIELD =
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE</w:instrText></w:r>' +
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>';
  const FOOTER =
    `<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t>Confidencial</w:t></w:r></w:p>` +
    `<w:p><w:pPr><w:jc w:val="right"/></w:pPr>${PAGE_FIELD}</w:p></w:ftr>`;
  const HEADER = `<w:hdr ${NS}><w:p><w:r><w:t>Empresa</w:t></w:r></w:p></w:hdr>`;
  const sect = (refs: string) => `<w:sectPr>${refs}<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>`;
  const body = (refs: string, root = NS) => `<w:document ${root}><w:body><w:p><w:r><w:t>Body</w:t></w:r></w:p>${sect(refs)}</w:body></w:document>`;
  const RELS = (extra: string) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${extra}</Relationships>`;

  function withParts(): Doc {
    const refs = '<w:headerReference w:type="default" r:id="rId1"/><w:footerReference w:type="default" r:id="rId2"/>';
    return importDocx(
      zipSync({
        'word/document.xml': strToU8(body(refs)),
        'word/header1.xml': strToU8(HEADER),
        'word/footer1.xml': strToU8(FOOTER),
        'word/_rels/document.xml.rels': strToU8(RELS('<Relationship Id="rId1" Type="x/header" Target="header1.xml"/><Relationship Id="rId2" Type="x/footer" Target="footer1.xml"/>')),
      }),
    );
  }

  it('reads the page number an opened document has, and replaces it in its own footer', () => {
    const doc = withParts();
    expect(pageNumbering(doc)).toEqual({ place: 'footer', align: 'right', format: 'number' });
    // Untouched, everything is written back as it was.
    expect(files(doc)).toMatchObject({ 'word/footer1.xml': FOOTER, 'word/header1.xml': HEADER, 'word/document.xml': body('<w:headerReference w:type="default" r:id="rId1"/><w:footerReference w:type="default" r:id="rId2"/>') });

    const changed = setPageNumbering(doc, { place: 'footer', align: 'center', format: 'pageOfTotal' });
    const out = files(changed);
    // The other paragraph of the footer is copied as it was; the old number is gone and the new one follows.
    expect(out['word/footer1.xml']).toContain(`<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t>Confidencial</w:t></w:r></w:p><w:p><w:pPr>`);
    expect(out['word/footer1.xml']).not.toContain('<w:jc w:val="right"/>');
    expect(out['word/footer1.xml'].match(/fldCharType="begin"/g)).toHaveLength(2);
    // Nothing else changes: not the header, not the document, not the relationships.
    expect(out['word/header1.xml']).toBe(HEADER);
    expect(out['word/document.xml']).toBe(files(doc)['word/document.xml']);
    expect(out['word/_rels/document.xml.rels']).toBe(files(doc)['word/_rels/document.xml.rels']);
    expect(pageNumbering(importDocx(exportDocx(changed)))).toEqual({ place: 'footer', align: 'center', format: 'pageOfTotal' });

    // Moved to the header, it goes above what the header had; the footer keeps its other paragraph.
    const moved = files(setPageNumbering(doc, { place: 'header', align: 'left', format: 'number' }));
    expect(moved['word/header1.xml'].indexOf('PAGE')).toBeLessThan(moved['word/header1.xml'].indexOf('Empresa'));
    expect(moved['word/header1.xml']).toContain('<w:p><w:r><w:t>Empresa</w:t></w:r></w:p></w:hdr>');
    expect(moved['word/footer1.xml']).toBe(`<w:ftr ${NS}><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t>Confidencial</w:t></w:r></w:p></w:ftr>`);
  });

  it('leaves alone a page number that shares its line with other text', () => {
    const mixed = `<w:ftr ${NS}><w:p><w:r><w:t xml:space="preserve">Contrato 123 · </w:t></w:r>${PAGE_FIELD}</w:p></w:ftr>`;
    const doc = importDocx(
      zipSync({
        'word/document.xml': strToU8(body('<w:footerReference w:type="default" r:id="rId2"/>')),
        'word/footer1.xml': strToU8(mixed),
        'word/_rels/document.xml.rels': strToU8(RELS('<Relationship Id="rId2" Type="x/footer" Target="footer1.xml"/>')),
      }),
    );
    expect(pageNumbering(doc)).toBeUndefined();
    const numbered = setPageNumbering(doc, { place: 'footer', align: 'center', format: 'number' });
    expect(files(numbered)['word/footer1.xml']).toContain('<w:t xml:space="preserve">Contrato 123 · </w:t>');
    expect(layoutDocument(numbered, measurer).pages[0].footer!.lines).toHaveLength(2);
    // A footer emptied of its only paragraph still holds one, as the format requires.
    const only = importDocx(
      zipSync({
        'word/document.xml': strToU8(body('<w:footerReference w:type="default" r:id="rId2"/>')),
        'word/footer1.xml': strToU8(`<w:ftr ${NS}><w:p>${PAGE_FIELD}</w:p></w:ftr>`),
        'word/_rels/document.xml.rels': strToU8(RELS('<Relationship Id="rId2" Type="x/footer" Target="footer1.xml"/>')),
      }),
    );
    expect(files(setPageNumbering(only, undefined))['word/footer1.xml']).toBe(`<w:ftr ${NS}><w:p/></w:ftr>`);
  });

  it('adds a footer to an opened document that had none', () => {
    const types = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>';
    const open = (root: string) =>
      importDocx(zipSync({ '[Content_Types].xml': strToU8(types), 'word/document.xml': strToU8(body('', root)), 'word/footer1.xml': strToU8('taken') }));
    const out = files(setPageNumbering(open(NS), { place: 'footer', align: 'center', format: 'number' }));
    // The name footer1.xml was taken by a part nothing refers to, so the new one is footer2.xml.
    expect(out['word/footer1.xml']).toBe('taken');
    expect(out['word/footer2.xml']).toContain('PAGE');
    expect(out['[Content_Types].xml']).toContain('<Override PartName="/word/footer2.xml"');
    expect(out['word/_rels/document.xml.rels']).toContain('<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer2.xml"/>');
    expect(out['word/document.xml']).toContain('<w:sectPr><w:footerReference w:type="default" r:id="rId1"/><w:pgSz w:w="12240" w:h="15840"/>');
    expect(pageNumbering(importDocx(zipSync(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, strToU8(v)])))))).toEqual({ place: 'footer', align: 'center', format: 'number' });

    // A document that does not declare the namespace of the ids gets it where the id is used.
    const bare = files(setPageNumbering(open('xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'), { place: 'header', align: 'left', format: 'page' }));
    expect(bare['word/document.xml']).toContain('<w:headerReference w:type="default" r:id="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>');
  });
});
