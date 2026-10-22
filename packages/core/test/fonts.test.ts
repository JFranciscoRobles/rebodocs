import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FontMeasurer, readFont, readFonts } from '../src';

const file = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

/** Font files made one collection (.ttc), as macOS keeps Helvetica: each face's tables placed after a header that lists them. */
function collection(fonts: Uint8Array[]): Uint8Array {
  const head = 12 + fonts.length * 4;
  const out = new Uint8Array(head + fonts.reduce((n, font) => n + font.length, 0));
  const view = new DataView(out.buffer);
  out.set([0x74, 0x74, 0x63, 0x66]);
  view.setUint32(4, 0x00010000);
  view.setUint32(8, fonts.length);
  let at = head;
  fonts.forEach((font, i) => {
    view.setUint32(12 + i * 4, at);
    out.set(font, at);
    // The offsets of a collection's tables count from the start of the file.
    const tables = new DataView(font.buffer, font.byteOffset).getUint16(4);
    for (let t = 0; t < tables; t++) view.setUint32(at + 12 + t * 16 + 8, view.getUint32(at + 12 + t * 16 + 8) + at);
    at += font.length;
  });
  return out;
}

describe('font files', () => {
  it('reads each face of a collection, as a file of its own', () => {
    const ttc = collection([file('CourierPrime-Regular.ttf'), file('CourierPrime-Bold.ttf')]);
    const faces = readFonts(ttc);
    expect(faces.map((face) => [face.family, face.bold])).toEqual([
      ['Courier Prime', false],
      ['Courier Prime', true],
    ]);
    // Each is measured as the .ttf it came from.
    const single = readFont(file('CourierPrime-Bold.ttf'))!;
    expect(faces[1].advance(faces[1].glyph(65))).toBe(single.advance(single.glyph(65)));
    expect(readFont(ttc)!.bold).toBe(false);
    expect(readFonts(file('CourierPrime-Regular.ttf'))).toHaveLength(1);
  });

  it('stands in for a family it lacks with a face of the style asked, even when none is of its kind', () => {
    const measurer = new FontMeasurer([readFont(file('CourierPrime-Regular.ttf'))!, readFont(file('CourierPrime-Bold.ttf'))!]);
    // Courier is a mono, Arial a sans: nothing of its kind, so the first family given, bold for bold.
    expect(measurer.fontFor({ family: 'Arial', bold: true, italic: false })!.bold).toBe(true);
    expect(measurer.fontFor({ family: 'Arial', bold: false, italic: false })!.bold).toBe(false);
    expect(measurer.missing.get('Arial')).toBe('Courier Prime');
  });
});
