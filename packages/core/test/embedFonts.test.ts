import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createDoc, embeddedFonts, exportDocx, importDocx } from '../src';

/**
 * The least a font file needs to be told embeddable or not: the TrueType
 * header and an OS/2 table with its licence bits, then bytes to make it 200 long.
 */
function font(fsType: number, version = 0x00010000): Uint8Array {
  const bytes = new Uint8Array(200);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, version);
  view.setUint16(4, 1);
  bytes.set([...'OS/2'].map((c) => c.charCodeAt(0)), 12);
  view.setUint32(12 + 8, 28);
  view.setUint32(12 + 12, 100);
  view.setUint16(28 + 8, fsType);
  for (let i = 128; i < 200; i++) bytes[i] = i;
  return bytes;
}

const doc = createDoc([{ props: {}, runs: [{ text: 'Hello', props: { fontFamily: 'Brand' } }] }]);
const parts = (docx: Uint8Array) => unzipSync(docx);
const text = (docx: Uint8Array, path: string) => strFromU8(parts(docx)[path]);

describe('fonts carried in the DOCX', () => {
  it('puts the fonts given into the file, obfuscated, as Word reads them back', () => {
    const regular = font(0);
    const bold = font(0x0008);
    const docx = exportDocx(doc, { fonts: [{ family: 'Brand', bold: false, italic: false, bytes: regular }, { family: 'Brand', bold: true, italic: false, bytes: bold }] });
    const table = text(docx, 'word/fontTable.xml');
    expect(table).toMatch(/<w:font w:name="Brand"><w:embedRegular r:id="rId\d+" w:fontKey="\{[0-9A-F-]{36}\}"\/><w:embedBold r:id="rId\d+" w:fontKey="\{[0-9A-F-]{36}\}"\/><\/w:font>/);
    expect(text(docx, 'word/settings.xml')).toContain('<w:embedTrueTypeFonts/>');
    expect(text(docx, '[Content_Types].xml')).toContain('Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"');
    // What is stored is not the font as it is: its first 32 bytes are changed by the key.
    const stored = Object.entries(parts(docx)).filter(([path]) => path.endsWith('.odttf'));
    expect(stored).toHaveLength(2);
    expect(stored.some(([, bytes]) => bytes.slice(0, 32).every((b, i) => b === regular[i]))).toBe(false);
    const back = embeddedFonts(importDocx(docx).source!);
    expect(back.map((f) => [f.family, f.bold, f.italic])).toEqual([['Brand', false, false], ['Brand', true, false]]);
    expect(back[0].bytes).toEqual(regular);
    expect(back[1].bytes).toEqual(bold);
  });

  it('leaves out a font whose licence keeps it from being embedded, and one that is not TrueType', () => {
    const docx = exportDocx(doc, {
      fonts: [
        { family: 'Brand', bold: false, italic: false, bytes: font(0x0002) },
        { family: 'Brand', bold: true, italic: false, bytes: font(0x0200 | 0x0004) },
        { family: 'Brand', bold: false, italic: true, bytes: font(0, 0x4f54544f) },
      ],
    });
    expect(parts(docx)['word/fontTable.xml']).toBeUndefined();
    // A restricted bit with a looser one set too: the looser one holds.
    expect(text(exportDocx(doc, { fonts: [{ family: 'Brand', bold: false, italic: false, bytes: font(0x0002 | 0x0004) }] }), 'word/fontTable.xml')).toContain('w:embedRegular');
  });

  it('does not put a face in twice when the file carries it already, and keeps what the file had', () => {
    const once = exportDocx(doc, { fonts: [{ family: 'Brand', bold: false, italic: false, bytes: font(0) }] });
    const opened = importDocx(once);
    const twice = exportDocx(opened, { fonts: [{ family: 'Brand', bold: false, italic: false, bytes: font(0) }, { family: 'Brand', bold: false, italic: true, bytes: font(0) }] });
    expect(Object.keys(parts(twice)).filter((path) => path.endsWith('.odttf'))).toHaveLength(2);
    expect(embeddedFonts(importDocx(twice).source!).map((f) => [f.bold, f.italic])).toEqual([[false, false], [false, true]]);
    expect(text(twice, 'word/settings.xml').match(/embedTrueTypeFonts/g)).toHaveLength(1);
    // Without fonts given, a file goes as it was.
    expect(parts(exportDocx(doc))['word/fontTable.xml']).toBeUndefined();
  });
});
