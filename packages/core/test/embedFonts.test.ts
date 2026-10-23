import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { type Doc, createDoc, documentLanguage, embeddedFonts, exportDocx, importDocx, parseTrueType, textByFamily } from '../src/internal';

/**
 * The least a font file needs to be told embeddable or not: the TrueType
 * header and an OS/2 table with its licence bits, then bytes to make it 200 long.
 */
function font(fsType: number, version = 0x00010000): Uint8Array {
  const bytes = new Uint8Array(200);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, version);
  view.setUint16(4, 1);
  bytes.set(
    [...'OS/2'].map((c) => c.charCodeAt(0)),
    12,
  );
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
    const docx = exportDocx(doc, {
      fonts: [
        { family: 'Brand', bold: false, italic: false, bytes: regular },
        { family: 'Brand', bold: true, italic: false, bytes: bold },
      ],
    });
    const table = text(docx, 'word/fontTable.xml');
    expect(table).toMatch(/<w:font w:name="Brand"><w:embedRegular r:id="rId\d+" w:fontKey="\{[0-9A-F-]{36}\}"\/><w:embedBold r:id="rId\d+" w:fontKey="\{[0-9A-F-]{36}\}"\/><\/w:font>/);
    expect(text(docx, 'word/settings.xml')).toContain('<w:embedTrueTypeFonts/>');
    expect(text(docx, '[Content_Types].xml')).toContain('Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"');
    // What is stored is not the font as it is: its first 32 bytes are changed by the key.
    const stored = Object.entries(parts(docx)).filter(([path]) => path.endsWith('.odttf'));
    expect(stored).toHaveLength(2);
    expect(stored.some(([, bytes]) => bytes.slice(0, 32).every((b, i) => b === regular[i]))).toBe(false);
    const back = embeddedFonts(importDocx(docx).source!);
    expect(back.map((f) => [f.family, f.bold, f.italic])).toEqual([
      ['Brand', false, false],
      ['Brand', true, false],
    ]);
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
    const twice = exportDocx(opened, {
      fonts: [
        { family: 'Brand', bold: false, italic: false, bytes: font(0) },
        { family: 'Brand', bold: false, italic: true, bytes: font(0) },
      ],
    });
    expect(Object.keys(parts(twice)).filter((path) => path.endsWith('.odttf'))).toHaveLength(2);
    expect(embeddedFonts(importDocx(twice).source!).map((f) => [f.bold, f.italic])).toEqual([
      [false, false],
      [false, true],
    ]);
    expect(text(twice, 'word/settings.xml').match(/embedTrueTypeFonts/g)).toHaveLength(1);
    // Without fonts given, a file goes as it was.
    expect(parts(exportDocx(doc))['word/fontTable.xml']).toBeUndefined();
  });
});

describe('fonts cut down in the DOCX', () => {
  // A real font, OFL: what Word is to read back as a font.
  const courier = new Uint8Array(readFileSync(new URL('./fixtures/CourierPrime-Regular.ttf', import.meta.url)));
  const brand = createDoc([{ props: {}, runs: [{ text: 'Héllo', props: { fontFamily: 'Brand' } }] }]);
  const unobfuscate = (docx: Uint8Array) => {
    const table = text(docx, 'word/fontTable.xml');
    const key = table.match(/w:fontKey="\{([0-9A-F-]+)\}"/)![1].replace(/-/g, '');
    const bytes = Object.entries(parts(docx))
      .find(([path]) => path.endsWith('.odttf'))![1]
      .slice();
    for (let i = 0; i < 32; i++) bytes[i] ^= parseInt(key.slice(30 - 2 * (i % 16), 32 - 2 * (i % 16)), 16);
    return bytes;
  };
  /** How long the outline of a character is in a TrueType file: 0 for one left out. */
  const outline = (bytes: Uint8Array, ch: string) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tables = new Map<string, number>();
    for (let i = 0; i < view.getUint16(4); i++) tables.set(String.fromCharCode(...bytes.slice(12 + i * 16, 16 + i * 16)), view.getUint32(12 + i * 16 + 8));
    const glyph = parseTrueType(bytes)!.glyph(ch.codePointAt(0)!);
    const long = view.getInt16(tables.get('head')! + 50) === 1;
    const at = (g: number) => (long ? view.getUint32(tables.get('loca')! + g * 4) : view.getUint16(tables.get('loca')! + g * 2) * 2);
    return at(glyph + 1) - at(glyph);
  };

  it('keeps the characters of the document and of the keyboard, and says it is cut down', () => {
    const docx = exportDocx(brand, { fonts: [{ family: 'Brand', bold: false, italic: false, bytes: courier }], subsetFonts: true });
    expect(text(docx, 'word/fontTable.xml')).toMatch(/<w:embedRegular r:id="rId\d+" w:fontKey="\{[0-9A-F-]{36}\}" w:subsetted="1"\/>/);
    expect(text(docx, 'word/settings.xml')).toContain('<w:embedTrueTypeFonts/><w:saveSubsetFonts/>');
    const cut = unobfuscate(docx);
    expect(cut.length).toBeLessThan(courier.length / 2);
    // Still a font: its name, its map of characters, and a header that adds up.
    expect(parseTrueType(cut)?.family).toBe('Courier Prime');
    const view = new DataView(cut.buffer);
    let sum = 0;
    for (let i = 0; i < cut.length; i += 4) sum = (sum + view.getUint32(i)) >>> 0;
    expect(sum).toBe(0xb1b0afba);
    expect(outline(cut, 'é')).toBeGreaterThan(0);
    expect(outline(cut, 'Z')).toBeGreaterThan(0);
    expect(outline(cut, 'ñ')).toBe(0);
    expect(outline(courier, 'ñ')).toBeGreaterThan(0);
  });

  it('goes whole when the licence says it may not be cut down, or when not asked', () => {
    const locked = courier.slice();
    const view = new DataView(locked.buffer);
    for (let i = 0; i < view.getUint16(4); i++) {
      if (String.fromCharCode(...locked.slice(12 + i * 16, 16 + i * 16)) === 'OS/2') view.setUint16(view.getUint32(12 + i * 16 + 8) + 8, 0x0100);
    }
    const docx = exportDocx(brand, { fonts: [{ family: 'Brand', bold: false, italic: false, bytes: locked }], subsetFonts: true });
    expect(text(docx, 'word/fontTable.xml')).not.toContain('w:subsetted');
    expect(text(docx, 'word/settings.xml')).not.toContain('saveSubsetFonts');
    expect(unobfuscate(docx)).toEqual(locked);
    expect(unobfuscate(exportDocx(brand, { fonts: [{ family: 'Brand', bold: false, italic: false, bytes: courier }] }))).toEqual(courier);
  });
});

describe('textByFamily', () => {
  it('reads the text of every part of the document, and the families of its styles', () => {
    const run = (text: string, fontFamily: string) => ({ text, props: { fontFamily } });
    const base = createDoc([{ props: {}, runs: [run('ab', 'Body'), run('c', 'Other')] }]);
    const doc = {
      ...base,
      header: { paragraphs: [{ props: {}, runs: [run('h', 'Head')] }] },
      footnotes: [{ id: '1', paragraphs: [{ props: {}, runs: [run('n', 'Note')] }] }],
      textBoxes: [{ id: '2', paragraphs: [{ props: {}, runs: [run('x', 'Body')] }] }],
      styles: [...(base.styles ?? []), { id: 'Brand', name: 'Brand', paragraph: {}, run: { fontFamily: 'Styled' } }],
    } as Doc;
    const text = textByFamily(doc);
    expect(text.get('body')).toBe('abx');
    expect(text.get('other')).toBe('c');
    expect(text.get('head')).toBe('h');
    expect(text.get('note')).toBe('n');
    expect(text.get('styled')).toBe('');
  });
});

describe('the language of the document', () => {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const plain = createDoc([{ props: {}, runs: [{ text: 'Hola', props: {} }] }]);

  it('says it in the defaults of the styles of a new document', () => {
    const styles = text(exportDocx(plain, { language: 'es-MX' }), 'word/styles.xml');
    expect(styles).toContain('<w:docDefaults><w:rPrDefault><w:rPr><w:lang w:val="es-MX"/></w:rPr></w:rPrDefault></w:docDefaults>');
    // Without one, nothing is said: the file is as it was made before.
    expect(parts(exportDocx(plain))['word/styles.xml']).toBeUndefined();
  });

  it('adds it to the defaults of a file that has none, and keeps the one a file says', () => {
    const file = (styles: string) =>
      zipSync({
        'word/document.xml': strToU8(`<w:document ${W}><w:body><w:p><w:r><w:t>Hola</w:t></w:r></w:p></w:body></w:document>`),
        'word/styles.xml': strToU8(styles),
        'word/_rels/document.xml.rels': strToU8(
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
        ),
      });
    const none = importDocx(file(`<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`));
    expect(text(exportDocx(none, { language: 'en-US' }), 'word/styles.xml')).toContain('<w:rPr><w:sz w:val="22"/><w:lang w:val="en-US"/></w:rPr>');
    const said = `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
    expect(text(exportDocx(importDocx(file(said)), { language: 'en-US' }), 'word/styles.xml')).toBe(said);
    // What a file says is read back, for a screen reader to use; a language a person chose goes over it.
    expect(documentLanguage(importDocx(file(said)))).toBe('fr-FR');
    expect(documentLanguage(none)).toBeUndefined();
    expect(text(exportDocx(importDocx(file(said)), { language: 'es-MX', replaceLanguage: true }), 'word/styles.xml')).toContain('<w:lang w:val="es-MX"/>');
  });
});
