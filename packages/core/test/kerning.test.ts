import { readFileSync } from 'node:fs';
import { strToU8, unzlibSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type FontSpec, type TextMeasurer, createDoc, exportPdf, FontMeasurer, importDocx, layoutDocument, readFont } from '../src/internal';

const courier = new Uint8Array(readFileSync(new URL('./fixtures/CourierPrime-Regular.ttf', import.meta.url)));
const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

/** A font file with a table of pairs added, each `[left, right, units]` by the letters: Courier Prime, which has none of its own. */
function withPairs(bytes: Uint8Array, pairs: [string, string, number][]): Uint8Array {
  const font = readFont(bytes)!;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4);
  // A table of version 0 with one horizontal subtable of format 0.
  const kern = new DataView(new ArrayBuffer(4 + 14 + pairs.length * 6));
  kern.setUint16(2, 1);
  kern.setUint16(6, 14 + pairs.length * 6);
  kern.setUint16(8, 0x0001);
  kern.setUint16(10, pairs.length);
  pairs.forEach(([left, right, units], i) => {
    kern.setUint16(18 + i * 6, font.glyph(left.codePointAt(0)!));
    kern.setUint16(20 + i * 6, font.glyph(right.codePointAt(0)!));
    kern.setInt16(22 + i * 6, units);
  });
  // The directory gets one entry more, so every table moves 16 bytes on, and the new one goes at the end.
  const head = 12 + count * 16;
  const out = new Uint8Array(bytes.length + 16 + kern.byteLength);
  const o = new DataView(out.buffer);
  out.set(bytes.subarray(0, head));
  out.set(bytes.subarray(head), head + 16);
  o.setUint16(4, count + 1);
  for (let t = 0; t < count; t++) o.setUint32(12 + t * 16 + 8, o.getUint32(12 + t * 16 + 8) + 16);
  out.set([0x6b, 0x65, 0x72, 0x6e], head);
  o.setUint32(head + 8, bytes.length + 16);
  o.setUint32(head + 12, kern.byteLength);
  out.set(new Uint8Array(kern.buffer), bytes.length + 16);
  return out;
}

const spec = (kern: boolean): FontSpec => ({ family: 'Courier Prime', bold: false, italic: false, size: 10, ...(kern ? { kern } : {}) });

describe('kerning', () => {
  const bytes = withPairs(courier, [
    ['A', 'V', -100],
    ['V', ' ', -50],
  ]);
  const font = readFont(bytes)!;
  const units = (n: number) => (n * 10) / font.unitsPerEm;

  it('reads the pairs of a font, and sets them closer only when kerning is on', () => {
    expect(font.kerning!(font.glyph(65), font.glyph(86))).toBe(-100);
    expect(font.kerning!(font.glyph(86), font.glyph(65))).toBe(0);
    expect(readFont(courier)!.kerning?.(font.glyph(65), font.glyph(86)) ?? 0).toBe(0);
    const measure = new FontMeasurer([font]);
    expect(measure.width('AV', spec(true))).toBeCloseTo(measure.width('AV', spec(false)) + units(-100));
    // Between a word and the space after it, measured apart, as Word kerns them.
    expect(measure.pair('V', ' ', spec(true))).toBeCloseTo(units(-50));
    expect(measure.pair('V', ' ', spec(false))).toBe(0);
  });

  it('kerns text as big as the threshold of its run, or bigger', () => {
    const seen: FontSpec[] = [];
    const measurer: TextMeasurer = { width: (text, f) => (seen.push(f), text.length * f.size * 0.5), metrics: (f) => ({ ascent: f.size * 0.8, descent: f.size * 0.2 }) };
    const at = (fontSize: number, kern: number) => {
      seen.length = 0;
      layoutDocument(createDoc([{ props: {}, runs: [{ text: 'AV', props: { fontSize, kern } }] }]), measurer);
      return seen.some((f) => f.kern);
    };
    expect([at(12, 12), at(12, 14), at(12, 0), at(12, 1)]).toEqual([true, false, false, true]);
  });

  it('is on when the file says nothing of it, and off when it gives defaults for runs that leave it out, as Word does', () => {
    const w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const document = (rPr = '') => `<w:document ${w}><w:body><w:p><w:r><w:rPr>${rPr}<w:sz w:val="24"/></w:rPr><w:t>AV</w:t></w:r></w:p></w:body></w:document>`;
    const styles = (rPr: string | undefined) => `<w:styles ${w}>${rPr === undefined ? '' : `<w:docDefaults><w:rPrDefault><w:rPr>${rPr}</w:rPr></w:rPrDefault></w:docDefaults>`}</w:styles>`;
    const kerned = (files: Record<string, string>) => {
      const doc = importDocx(zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xml)]))));
      const seen: FontSpec[] = [];
      layoutDocument(doc, { width: (text, f) => (seen.push(f), text.length * f.size * 0.5), metrics: (f) => ({ ascent: f.size * 0.8, descent: f.size * 0.2 }) });
      return seen.some((f) => f.kern);
    };
    // Measured against Word with four files that differ only in this.
    expect(kerned({ 'word/document.xml': document() })).toBe(true);
    expect(kerned({ 'word/document.xml': document(), 'word/styles.xml': styles(undefined) })).toBe(true);
    expect(kerned({ 'word/document.xml': document(), 'word/styles.xml': styles('<w:sz w:val="24"/>') })).toBe(false);
    expect(kerned({ 'word/document.xml': document(), 'word/styles.xml': styles('<w:kern w:val="4"/>') })).toBe(true);
    expect(kerned({ 'word/document.xml': document(), 'word/styles.xml': styles('<w:kern w:val="56"/>') })).toBe(false);
  });

  it('moves the letters of a kerned pair together in the PDF, as the layout measured them', () => {
    const measure = new FontMeasurer([font]);
    const draw = (kern: number) => {
      const doc = createDoc([{ props: {}, runs: [{ text: 'AVA', props: { fontFamily: 'Courier Prime', fontSize: 10, kern } }] }]);
      const pdf = exportPdf(layoutDocument(doc, measure), { measurer: measure, font: () => bytes });
      const text = latin1(pdf);
      return [...text.matchAll(/<<([^\n]*)>>\nstream\n/g)].map((m) => {
        const start = m.index + m[0].length;
        const data = pdf.slice(start, start + Number(/\/Length (\d+)/.exec(m[1])![1]));
        return m[1].includes('/FlateDecode') ? latin1(unzlibSync(data)) : latin1(data);
      })[0];
    };
    const shift = Math.round((100 * 1000 * 100) / font.unitsPerEm) / 100;
    expect(draw(1)).toMatch(new RegExp(`\\[<[0-9A-F]+> ${shift} <[0-9A-F]+>\\] TJ`));
    expect(draw(0)).not.toContain('TJ');
  });
});
