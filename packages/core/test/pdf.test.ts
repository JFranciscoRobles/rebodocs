import { unzlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type TextMeasurer, FontMeasurer, createDoc, exportPdf, insertTable, insertText, layoutDocument, parseTrueType, readFont, setCellProps } from '../src';

const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};
const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

/** The streams of a PDF, unsqueezed, in the order they are in the file. */
function streams(pdf: Uint8Array): string[] {
  const text = latin1(pdf);
  const out: string[] = [];
  for (const match of text.matchAll(/<<([^\n]*)>>\nstream\n/g)) {
    const length = Number(/\/Length (\d+)/.exec(match[1])![1]);
    const start = match.index + match[0].length;
    const data = pdf.slice(start, start + length);
    out.push(match[1].includes('/FlateDecode') ? latin1(unzlibSync(data)) : latin1(data));
  }
  return out;
}

/**
 * The least of an OpenType file in CFF: three glyphs, 'A' and 'B' the last
 * two, and a CFF keyed by CID whose charset gives them CIDs 1001 and 1002.
 */
function cffFont(): Uint8Array {
  const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
  const i32 = (n: number) => [29, (n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  // CFF: header, Name INDEX, Top DICT INDEX, String and Global Subr INDEXes, charset, CharStrings INDEX.
  const name = [...'Test'].map((c) => c.charCodeAt(0));
  const head = [1, 0, 4, 1, ...u16(1), 1, 1, 1 + name.length, ...name];
  const dictLength = 3 + 2 + 5 + 1 + 5 + 1;
  const topIndex = 2 + 1 + 2;
  const charsetAt = head.length + topIndex + dictLength + 2 + 2;
  const charStringsAt = charsetAt + 5;
  const top = [139, 139, 139, 12, 30, ...i32(charsetAt), 15, ...i32(charStringsAt), 17];
  const cff = [...head, ...u16(1), 1, 1, 1 + top.length, ...top, 0, 0, 0, 0, 2, ...u16(1001), ...u16(1), ...u16(3), 1, 1, 2, 3, 4, 14, 14, 14];
  const headTable = new Array(54).fill(0);
  headTable.splice(18, 2, ...u16(1000));
  const hhea = new Array(36).fill(0);
  hhea.splice(4, 2, ...u16(800));
  hhea.splice(34, 2, ...u16(3));
  const hmtx = [...u16(500), 0, 0, ...u16(600), 0, 0, ...u16(700), 0, 0];
  // A format 4 cmap of one segment, 'A' and 'B' to glyphs 1 and 2, and the one that ends every such map.
  const sub = [...u16(4), ...u16(32), 0, 0, ...u16(4), ...u16(4), ...u16(1), 0, 0, ...u16(66), ...u16(0xffff), 0, 0, ...u16(65), ...u16(0xffff), ...u16(-64 & 0xffff), ...u16(1), 0, 0, 0, 0];
  const cmap = [0, 0, ...u16(1), ...u16(3), ...u16(1), 0, 0, 0, 12, ...sub];
  const tables: [string, number[]][] = [['CFF ', cff], ['cmap', cmap], ['head', headTable], ['hhea', hhea], ['hmtx', hmtx]];
  const out: number[] = [0x4f, 0x54, 0x54, 0x4f, ...u16(tables.length), 0, 0, 0, 0, 0, 0];
  let at = 12 + tables.length * 16;
  const body: number[] = [];
  for (const [tag, data] of tables) {
    out.push(...[...tag].map((c) => c.charCodeAt(0)), 0, 0, 0, 0, ...u16(at >>> 16), ...u16(at & 0xffff), ...u16(data.length >>> 16), ...u16(data.length & 0xffff));
    body.push(...data);
    while (body.length % 4) body.push(0);
    at = 12 + tables.length * 16 + body.length;
  }
  return Uint8Array.from([...out, ...body]);
}

describe('PDF export', () => {
  it('writes a file whose table of objects points at every object', () => {
    const doc = createDoc(Array.from({ length: 60 }, (_, i) => ({ props: {}, runs: [{ text: `Línea ${i} — “cita”`, props: i % 2 ? { bold: true } : {} }] })));
    const layout = layoutDocument(doc, measurer);
    const pdf = exportPdf(layout, { measurer, title: 'Prueba ñ' });
    const text = latin1(pdf);
    expect(text.startsWith('%PDF-1.7\n')).toBe(true);
    expect(text.endsWith('%%EOF\n')).toBe(true);
    expect(text).toContain(`/Count ${layout.pages.length}`);
    expect(layout.pages.length).toBeGreaterThan(1);
    // Every entry of the table is the place of the object with its number.
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const entries = [...text.slice(xref).matchAll(/(\d{10}) 00000 n /g)].map((m) => Number(m[1]));
    expect(entries.length).toBeGreaterThan(5);
    entries.forEach((offset, i) => expect(text.slice(offset, offset + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
    // Without font files, the fonts are the ones every reader has.
    expect(text).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding');
    expect(text).toContain('/BaseFont /Helvetica-Bold ');
    expect(text).toContain('/Title <FEFF0050007200750065006200610020' + '00F1>');
  });

  it('places each word where the layout measured it, in the letters of the fonts every reader has', () => {
    const doc = createDoc([{ props: {}, runs: [{ text: 'Hola mundo ', props: {} }, { text: 'año', props: { underline: true, color: 'FF0000', highlight: 'FFFF00' } }] }]);
    const layout = layoutDocument(doc, measurer);
    const [content] = streams(exportPdf(layout, { measurer }));
    const line = layout.pages[0].lines[0];
    const y = 792 - line.baseline;
    // "Hola " starts at the margin, "mundo " five characters of 5.5 points on.
    expect(content).toContain(`1 0 0 1 72 ${y} Tm <486F6C6120> Tj`);
    expect(content).toContain(`1 0 0 1 99.5 ${y} Tm <6D756E646F20> Tj`);
    // ñ is one byte in Windows-1252; the word is red, underlined, and on yellow.
    expect(content).toContain('<61F16F> Tj');
    expect(content).toContain('1 0 0 rg');
    expect(content).toMatch(/1 1 0 rg [\d. ]+ re f/);
    expect(content.match(/ re f/g)!.length).toBe(2);
  });

  it('draws the borders and the shading of table cells, and pictures given as pixels or as JPEG', () => {
    let { doc } = insertTable(createDoc([{ props: {}, runs: [{ text: '', props: {} }] }]), { para: 0, offset: 0 }, 1, 2);
    doc = setCellProps(insertText(doc, { para: 0, offset: 0 }, 'A').doc, 0, 0, { shade: 'D9E2F3' });
    const content = streams(exportPdf(layoutDocument(doc, measurer), { measurer }))[0];
    expect(content).toContain('0.851 0.886 0.953 rg 72 ');
    // Each side of each cell on its own, as cells may have a line of their own on every side.
    expect(content.match(/q 0 0 0 RG 0\.5 w {2}[\d. ]+ m [\d. ]+ l S Q/g)).toHaveLength(8);

    const picture = { xml: '<w:r><w:drawing><wp:inline><wp:extent cx="1270000" cy="635000"/></wp:inline></w:drawing></w:r>' };
    const withPicture = createDoc([{ props: {}, runs: [{ text: '￼', props: { object: picture.xml, objectWidth: 100, objectHeight: 50 } }] }]);
    const rgb = new Uint8Array([255, 0, 0, 0, 255, 0]);
    const pdf = exportPdf(layoutDocument(withPicture, measurer), { measurer, image: () => ({ width: 2, height: 1, rgb, alpha: new Uint8Array([255, 128]) }) });
    const text = latin1(pdf);
    expect(text).toContain('/Subtype /Image /Width 2 /Height 1 /BitsPerComponent 8 /ColorSpace /DeviceRGB /SMask ');
    expect(streams(pdf).some((s) => /q 100 0 0 50 72 [\d.]+ cm \/I1 Do Q/.test(s))).toBe(true);
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 1, 0, 2, 1, 0, 0, 0]);
    expect(latin1(exportPdf(layoutDocument(withPicture, measurer), { measurer, image: () => ({ width: 2, height: 1, jpeg }) }))).toContain('/ColorSpace /DeviceGray /Filter /DCTDecode');
  });

  it('measures with an OpenType file in CFF and puts it in the PDF, its glyphs named by number in every reader', () => {
    const font = readFont(cffFont(), { family: 'Test', bold: false, italic: false })!;
    expect(font).toMatchObject({ cff: true, unitsPerEm: 1000 });
    expect([font.glyph(65), font.glyph(66), font.advance(2)]).toEqual([1, 2, 700]);
    const measure = new FontMeasurer([font]);
    expect(measure.width('AB', { family: 'Test', bold: false, italic: false, size: 10 })).toBe(13);
    const doc = createDoc([{ props: {}, runs: [{ text: 'AB', props: { fontFamily: 'Test' } }] }]);
    const pdf = exportPdf(layoutDocument(doc, measure), { measurer: measure, font: () => font.bytes });
    const text = latin1(pdf);
    expect(text).toContain('/Subtype /CIDFontType0');
    expect(text).toContain('/FontFile3');
    expect(text).not.toContain('/CIDToGIDMap');
    expect(streams(pdf).join('\n')).toContain('<0001> <0041>');
    // The charset in the PDF gives each glyph its own number as its CID: readers differ on the other kind.
    const embedded = streams(pdf).find((data) => data.startsWith('OTTO'))!;
    expect(embedded.length).toBe(font.bytes.length);
    const at = latin1(font.bytes).indexOf(String.fromCharCode(2, 0x03, 0xe9));
    expect([...embedded.slice(at, at + 5)].map((c) => c.charCodeAt(0))).toEqual([2, 0, 1, 0, 1]);
  });

  it('does not take for a font what is not a TrueType file', () => {
    expect(parseTrueType(new Uint8Array([79, 84, 84, 79, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeUndefined();
    expect(parseTrueType(new Uint8Array(4))).toBeUndefined();
  });
});
