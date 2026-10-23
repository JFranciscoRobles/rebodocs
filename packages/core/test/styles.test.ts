import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type Doc, createDoc, exportDocx, importDocx, paragraphStyles, resolveRun, setParagraphStyle, styleIdAt, toggleList } from '../src/internal';

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const STYLES =
  `<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>` +
  '<w:pPrDefault><w:pPr><w:spacing w:after="160"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Ttulo1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="0"/></w:pPr><w:rPr><w:b/><w:color w:val="2F5496"/><w:sz w:val="32"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Cita"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Unused"><w:name w:val="Not in use"/></w:style>' +
  '<w:style w:type="character" w:styleId="Title"><w:name w:val="Some character style"/></w:style>' +
  '</w:styles>';
const P = {
  heading: '<w:p><w:pPr><w:pStyle w:val="Ttulo1"/></w:pPr><w:r><w:t>Chapter</w:t></w:r></w:p>',
  plain: '<w:p><w:r><w:t xml:space="preserve">Some </w:t></w:r><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>plain</w:t></w:r><w:r><w:t xml:space="preserve"> text</w:t></w:r></w:p>',
  quote: '<w:p><w:pPr><w:pStyle w:val="Cita"/></w:pPr><w:r><w:t>Quoted</w:t></w:r></w:p>',
};
const DOCUMENT = `<w:document ${NS}><w:body>${P.heading}${P.plain}${P.quote}</w:body></w:document>`;
const PARTS: Record<string, string> = {
  '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
  'word/document.xml': DOCUMENT,
  'word/styles.xml': STYLES,
};
const open = (): Doc => importDocx(zipSync(Object.fromEntries(Object.entries(PARTS).map(([k, v]) => [k, strToU8(v)]))));
const save = (doc: Doc) => Object.fromEntries(Object.entries(unzipSync(exportDocx(doc))).map(([path, data]) => [path, strFromU8(data)]));

describe('paragraph styles', () => {
  it('offers a standard set in a new document, and gives a paragraph the look of one', () => {
    const doc = createDoc([
      {
        props: { align: 'center', indentFirstLine: 18 },
        runs: [
          { text: 'A ', props: { bold: true } },
          { text: 'title', props: { underline: true, fontFamily: 'Georgia' } },
        ],
      },
    ]);
    expect(paragraphStyles(doc).map((s) => s.name)).toEqual(['Normal', 'Título', 'Subtítulo', 'Título 1', 'Título 2', 'Título 3']);
    expect(styleIdAt(doc, 0)).toBe('Normal');
    const titled = setParagraphStyle(doc, 0, 0, 'Heading1');
    expect(styleIdAt(titled, 0)).toBe('Heading1');
    // The formatting of the paragraph is the style's: nothing of what it had is left.
    expect(titled.paragraphs[0].props).toEqual({ spacingBefore: 20, spacingAfter: 6, keepNext: true, styleId: 'Heading1' });
    // The text takes its size and weight; the font and the underline are its own.
    expect(titled.paragraphs[0].runs.map((r) => resolveRun(r.props))).toMatchObject([
      { fontSize: 20, bold: false, underline: false, fontFamily: 'Arial' },
      { fontSize: 20, bold: false, underline: true, fontFamily: 'Georgia' },
    ]);
    expect(setParagraphStyle(doc, 0, 0, 'Nope')).toBe(doc);
  });

  it('writes the styles a new document uses, and reads them back as its own', () => {
    const doc = setParagraphStyle(
      createDoc([
        { props: {}, runs: [{ text: 'Chapter', props: {} }] },
        { props: {}, runs: [{ text: 'Text', props: {} }] },
      ]),
      0,
      0,
      'Heading2',
    );
    const out = save(doc);
    expect(out['word/document.xml']).toContain('<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:keepNext/>');
    expect(out['[Content_Types].xml']).toContain('PartName="/word/styles.xml"');
    expect(out['word/_rels/document.xml.rels']).toContain('relationships/styles" Target="styles.xml"/>');
    const styles = out['word/styles.xml'];
    expect(styles).toContain('<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/>');
    expect(styles).toContain('<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>');
    expect(styles).toContain('<w:outlineLvl w:val="1"/>');
    expect(styles).not.toContain('Heading1');

    const back = importDocx(exportDocx(doc));
    expect(styleIdAt(back, 0)).toBe('Heading2');
    expect(paragraphStyles(back).find((s) => s.id === 'Heading2')).toMatchObject({ name: 'Título 2', outlineLevel: 2, next: 'Normal', run: { fontSize: 16 } });
    expect(resolveRun(back.paragraphs[0].runs[0].props).fontSize).toBe(16);
    // Nothing is added the second time: the package has the style now.
    expect(save(back)['word/styles.xml']).toBe(styles);
  });

  it('offers the styles of a file under their usual names, with the ones its paragraphs use', () => {
    const doc = open();
    expect(doc.paragraphs.map((_, i) => styleIdAt(doc, i))).toEqual(['Ttulo1', 'Normal', 'Cita']);
    const styles = paragraphStyles(doc);
    // The file's own heading 1; the standard ones it lacks; and the quote, which is in use.
    expect(styles.map((s) => [s.id, s.name])).toEqual([
      ['Normal', 'Normal'],
      ['TitleDx', 'Título'],
      ['Subtitle', 'Subtítulo'],
      ['Ttulo1', 'Título 1'],
      ['Heading2', 'Título 2'],
      ['Heading3', 'Título 3'],
      ['Cita', 'Quote'],
    ]);
    expect(styles[3]).toMatchObject({
      outlineLevel: 1,
      next: 'Normal',
      paragraph: { spacingBefore: 12, spacingAfter: 0, keepNext: true },
      run: { fontFamily: 'Georgia', fontSize: 16, bold: true, color: '2F5496' },
    });
    // The standard ones are built on the Normal of the file.
    expect(styles[4]).toMatchObject({ paragraph: { spacingBefore: 18, spacingAfter: 6 }, run: { fontFamily: 'Georgia', fontSize: 16, bold: false } });
  });

  it('names the style in the paragraph, keeping the rest of the file as it was', () => {
    const doc = setParagraphStyle(open(), 1, 1, 'Ttulo1');
    expect(doc.paragraphs[1].runs.map((r) => resolveRun(r.props))).toMatchObject([
      { bold: true, fontSize: 16, underline: false },
      { bold: true, fontSize: 16, underline: true },
      { bold: true, fontSize: 16, underline: false },
    ]);
    const out = save(doc);
    const xml = out['word/document.xml'];
    expect(xml.startsWith(`<w:document ${NS}><w:body>${P.heading}<w:p><w:pPr><w:pStyle w:val="Ttulo1"/><w:keepNext/>`)).toBe(true);
    expect(xml.endsWith(`${P.quote}</w:body></w:document>`)).toBe(true);
    expect(xml).toContain('<w:u w:val="single"/>');
    expect(out['word/styles.xml']).toBe(STYLES);
    const back = importDocx(exportDocx(doc));
    expect(styleIdAt(back, 1)).toBe('Ttulo1');
    expect(back.paragraphs[1].props).toMatchObject({ spacingBefore: 12, spacingAfter: 0, keepNext: true });
  });

  it('adds to the file the standard style it lacked, and takes a paragraph back to Normal', () => {
    const doc = setParagraphStyle(setParagraphStyle(open(), 1, 1, 'TitleDx'), 0, 0, 'Normal');
    const out = save(doc);
    expect(out['word/styles.xml']).toBe(
      STYLES.replace('</w:styles>', '') +
        '<w:style w:type="paragraph" w:styleId="TitleDx"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>' +
        '<w:pPr><w:keepNext/><w:spacing w:before="0" w:after="60" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>' +
        out['word/styles.xml'].slice(out['word/styles.xml'].lastIndexOf('<w:rPr>')),
    );
    expect(out['word/styles.xml']).toContain('<w:sz w:val="52"/>');
    expect(out['word/document.xml']).toContain('<w:pStyle w:val="TitleDx"/>');
    const back = importDocx(exportDocx(doc));
    expect(back.paragraphs.map((_, i) => styleIdAt(back, i))).toEqual(['Normal', 'TitleDx', 'Cita']);
    // The heading that went back to Normal lost its weight, its colour and its spacing.
    expect(resolveRun(back.paragraphs[0].runs[0].props)).toMatchObject({ bold: false, fontSize: 11, color: '000000' });
    expect(back.paragraphs[0].props).toMatchObject({ spacingBefore: 0, spacingAfter: 8 });
    expect(paragraphStyles(back).find((s) => s.id === 'TitleDx')).toMatchObject({ name: 'Título', run: { fontSize: 26 } });
  });

  it('keeps a paragraph in its list when its style changes', () => {
    const listed = toggleList(open(), 1, 1, 'bullet');
    const { numId, indentLeft } = listed.paragraphs[1].props;
    expect(numId).toBeGreaterThan(0);
    const styled = setParagraphStyle(listed, 1, 1, 'Cita');
    expect(styled.paragraphs[1].props).toMatchObject({ numId, indentLeft, align: 'center', styleId: 'Cita' });
  });
});
