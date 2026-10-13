import { unzlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type TextMeasurer, createDoc, exportPdf, insertTable, insertText, layoutDocument, parseTrueType, setCellProps } from '../src';

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
    expect(content.match(/0 0 0 RG 0\.5 w [\d. ]+ re S/g)).toHaveLength(2);

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

  it('does not take for a font what is not a TrueType file', () => {
    expect(parseTrueType(new Uint8Array([79, 84, 84, 79, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeUndefined();
    expect(parseTrueType(new Uint8Array(4))).toBeUndefined();
  });
});
