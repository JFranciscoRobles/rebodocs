import { zlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type FontFile, FontMeasurer, createDoc, decodePng, jpegSize, layoutDocument, renderPdf } from '../src/internal';

/** A font of two widths: a space and every letter half an em, "W" a whole one. Enough to lay text out with. */
function font(family: string, bold = false): FontFile {
  return {
    family,
    bold,
    italic: false,
    unitsPerEm: 1000,
    bbox: [0, -200, 1000, 800],
    ascent: 800,
    descent: -200,
    lineGap: 100,
    capHeight: 700,
    italicAngle: 0,
    glyph: (code) => (code === 0x57 ? 2 : code === 0x2603 ? 0 : 1),
    advance: (glyph) => (glyph === 2 ? 1000 : bold ? 600 : 500),
    bytes: new Uint8Array(4),
  };
}

describe('laying out without a browser', () => {
  it('measures text with the widths of the font files', () => {
    const measurer = new FontMeasurer([font('Arial'), font('Arial', true), font('Times New Roman')]);
    const spec = { family: 'arial', size: 10, bold: false, italic: false };
    expect(measurer.width('abc', spec)).toBe(15);
    expect(measurer.width('aW', spec)).toBe(15);
    expect(measurer.width('abc', { ...spec, bold: true })).toBe(18);
    // A letter the font lacks takes the room of a space.
    expect(measurer.width('☃', spec)).toBe(5);
    // Half the line gap goes above the text and half below; the whole of it is said too, for a line of several fonts.
    expect(measurer.metrics(spec)).toEqual({ ascent: 8.5, descent: 2.5, lineGap: 1 });
    // A style the family lacks is set in its plain font; a family that is missing, in one of its kind.
    expect(measurer.fontFor({ family: 'Arial', bold: true, italic: true })!.bold).toBe(true);
    expect(measurer.fontFor({ family: 'Georgia', bold: false, italic: false })!.family).toBe('Times New Roman');
    expect(measurer.fontFor({ family: 'Calibri', bold: false, italic: false })!.family).toBe('Arial');
    expect([...measurer.missing]).toEqual([
      ['Georgia', 'Times New Roman'],
      ['Calibri', 'Arial'],
    ]);
  });

  it('lays a document out and writes its PDF with those fonts', () => {
    const doc = createDoc(Array.from({ length: 80 }, (_, i) => ({ props: {}, runs: [{ text: `Línea ${i}`, props: {} }] })));
    const { pdf, layout, missingFonts } = renderPdf(doc, [font('Arial')], 'Prueba');
    expect(layout.pages.length).toBe(layoutDocument(doc, new FontMeasurer([font('Arial')])).pages.length);
    expect(layout.pages.length).toBeGreaterThan(1);
    expect(missingFonts.size).toBe(0);
    const text = Array.from(pdf.subarray(0, 8), (b) => String.fromCharCode(b)).join('');
    expect(text).toBe('%PDF-1.7');
  });
});

describe('reading pictures without a browser', () => {
  const chunk = (tag: string, data: number[] | Uint8Array) => {
    const body = Uint8Array.from(data);
    const out = new Uint8Array(12 + body.length);
    new DataView(out.buffer).setUint32(0, body.length);
    out.set(
      Array.from(tag, (c) => c.charCodeAt(0)),
      4,
    );
    out.set(body, 8);
    return out;
  };
  const png = (width: number, height: number, type: number, interlace: number, rows: number[], extra: Uint8Array[] = []) => {
    const parts = [
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', [0, 0, 0, width, 0, 0, 0, height, 8, type, 0, 0, interlace]),
      ...extra,
      chunk('IDAT', zlibSync(Uint8Array.from(rows))),
      chunk('IEND', []),
    ];
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  };

  it('reads the pixels of a PNG, whatever filter its rows were written with', () => {
    // 2 × 2, red green / blue white: the second row written as its difference from the first.
    const image = decodePng(png(2, 2, 2, 0, [0, 255, 0, 0, 0, 255, 0, 2, 1, 0, 255, 255, 0, 255]))!;
    expect([image.width, image.height]).toEqual([2, 2]);
    expect([...image.rgb]).toEqual([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
    expect([...image.alpha]).toEqual([255, 255, 255, 255]);
    // With opacity, and with a palette.
    expect([...decodePng(png(1, 1, 6, 0, [0, 10, 20, 30, 128]))!.alpha]).toEqual([128]);
    const paletted = decodePng(png(2, 1, 3, 0, [0, 1, 0], [chunk('PLTE', [9, 9, 9, 200, 100, 50]), chunk('tRNS', [0])]))!;
    expect([...paletted.rgb]).toEqual([200, 100, 50, 9, 9, 9]);
    expect([...paletted.alpha]).toEqual([255, 0]);
    expect(decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toBeUndefined();
  });

  it('reads an interlaced PNG, which comes in passes', () => {
    // 2 × 2 grey: the passes that have pixels are the first (0,0), the sixth (1,0) and the seventh (row 1).
    const image = decodePng(png(2, 2, 0, 1, [0, 10, 0, 20, 0, 30, 40]))!;
    expect([...image.rgb].filter((_, i) => i % 3 === 0)).toEqual([10, 20, 30, 40]);
  });

  it('reads the size of a JPEG', () => {
    expect(jpegSize(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc2, 0, 11, 8, 0, 39, 3, 44, 3, 0, 0, 0]))).toEqual({ width: 812, height: 39 });
    expect(jpegSize(new Uint8Array([1, 2, 3]))).toBeUndefined();
  });
});
