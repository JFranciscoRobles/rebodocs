// Measuring text from font files, for where there is no browser to ask: on a
// server, a document is laid out with the fonts it is given. The numbers are
// the ones a browser gets from the same files, so the pages come out the same.

import { type FontMetrics, type FontSpec, type TextMeasurer } from './layout';
import { type Doc, type Story, resolveRun } from './model';
import { type TrueType, parseTrueType } from './pdf';
import { storyOf, storyParts } from './stories';

/** A font file and what it says it is. */
export interface FontFile extends TrueType {
  bytes: Uint8Array;
}

/** Reads a TrueType or OpenType font file, or the first face of a collection (.ttc): `readFonts` gives them all. Undefined for anything else. */
export function readFont(bytes: Uint8Array, as?: { family: string; bold: boolean; italic: boolean }): FontFile | undefined {
  // A collection: its first face.
  if (isCollection(bytes)) {
    const first = collectionFaces(bytes)[0];
    return first && readFont(first, as);
  }
  const font = parseTrueType(bytes);
  if (!font || !(as?.family ?? font.family)) return undefined;
  return { ...font, ...as, bytes };
}

/** Every face of a font file: the one of a .ttf or .otf, or each of a collection (.ttc), as a file of its own. */
export function readFonts(bytes: Uint8Array): FontFile[] {
  const faces = isCollection(bytes) ? collectionFaces(bytes) : [bytes];
  return faces.map((face) => readFont(face)).filter((font): font is FontFile => !!font);
}

const isCollection = (bytes: Uint8Array) => bytes.length > 12 && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === 'ttcf';

/**
 * The faces of a collection, each made a font file of its own: its tables,
 * which the collection may share among faces, copied after a directory of
 * its own, so that it can be measured and put in a PDF as any .ttf.
 */
function collectionFaces(bytes: Uint8Array): Uint8Array[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const faces: Uint8Array[] = [];
  const count = view.getUint32(8);
  for (let f = 0; f < count && 12 + f * 4 + 4 <= bytes.length; f++) {
    try {
      const start = view.getUint32(12 + f * 4);
      const tables = view.getUint16(start + 4);
      const records = Array.from({ length: tables }, (_, i) => {
        const at = start + 12 + i * 16;
        return { record: bytes.subarray(at, at + 16), offset: view.getUint32(at + 8), length: view.getUint32(at + 12) };
      });
      const head = 12 + tables * 16;
      const size = records.reduce((n, table) => n + ((table.length + 3) & ~3), head);
      const out = new Uint8Array(size);
      const outView = new DataView(out.buffer);
      out.set(bytes.subarray(start, start + 12));
      let at = head;
      records.forEach((table, i) => {
        out.set(table.record, 12 + i * 16);
        outView.setUint32(12 + i * 16 + 8, at);
        out.set(bytes.subarray(table.offset, table.offset + table.length), at);
        at += (table.length + 3) & ~3;
      });
      faces.push(out);
    } catch {
      // A face that cannot be read: the others still are.
    }
  }
  return faces;
}

const kind = (family: string) =>
  /courier|consolas|mono/i.test(family) ? 'mono' : /times|georgia|garamond|cambria|palatino|book|serif/i.test(family) && !/sans/i.test(family) ? 'serif' : 'sans';
/** The families that stand in for one that is missing, by its kind, in the order they are tried. */
const STAND_INS = {
  mono: ['courier new', 'liberation mono', 'dejavu sans mono'],
  serif: ['times new roman', 'liberation serif', 'dejavu serif'],
  sans: ['arial', 'liberation sans', 'helvetica', 'dejavu sans'],
};

export class FontMeasurer implements TextMeasurer {
  private byFamily = new Map<string, FontFile[]>();
  private chosen = new Map<string, FontFile | undefined>();
  private widths = new Map<string, number>();
  /** Families asked for that no font was given for, and what stood in for each. */
  readonly missing = new Map<string, string>();

  constructor(fonts: FontFile[]) {
    for (const font of fonts) {
      const key = font.family.toLowerCase();
      const list = this.byFamily.get(key);
      if (list) list.push(font);
      else this.byFamily.set(key, [font]);
    }
  }

  /** The font a run of this family and style is measured and drawn with. */
  fontFor(spec: Pick<FontSpec, 'family' | 'bold' | 'italic'>): FontFile | undefined {
    const key = `${spec.family}|${spec.bold}|${spec.italic}`;
    if (this.chosen.has(key)) return this.chosen.get(key);
    const pick = (family: string) => {
      const faces = this.byFamily.get(family.toLowerCase());
      // The style asked for, or the nearest the family has: the plain one before any other.
      return (
        faces?.find((f) => f.bold === spec.bold && f.italic === spec.italic) ??
        faces?.find((f) => f.bold === spec.bold && !f.italic) ??
        faces?.find((f) => !f.bold && !f.italic) ??
        faces?.[0]
      );
    };
    let font = pick(spec.family);
    if (!font) {
      for (const family of STAND_INS[kind(spec.family)]) if ((font = pick(family))) break;
      // Else the first family given, in the face of the style asked: its bold for bold text.
      const first = [...this.byFamily.keys()][0];
      font ??= first === undefined ? undefined : pick(first);
      this.missing.set(spec.family, font?.family ?? '');
    }
    this.chosen.set(key, font);
    return font;
  }

  width(text: string, spec: FontSpec): number {
    const key = `${spec.family}|${spec.bold}|${spec.italic}|${spec.size}\n${text}`;
    let width = this.widths.get(key);
    if (width === undefined) {
      const font = this.fontFor(spec);
      if (!font) return text.length * spec.size * 0.5;
      let units = 0;
      for (const ch of text) units += font.advance(font.glyph(ch.codePointAt(0)!) || font.glyph(0x20));
      width = (units * spec.size) / font.unitsPerEm;
      if (this.widths.size > 100_000) this.widths.clear();
      this.widths.set(key, width);
    }
    return width;
  }

  metrics(spec: FontSpec): FontMetrics {
    const font = this.fontFor(spec);
    if (!font) return { ascent: spec.size * 0.9, descent: spec.size * 0.25 };
    const scale = spec.size / font.unitsPerEm;
    // The line gap goes half above and half below, as in the browser.
    const gap = (Math.max(0, font.lineGap) * scale) / 2;
    return { ascent: font.ascent * scale + gap, descent: -font.descent * scale + gap };
  }
}

/**
 * The text of a document by the family it is in, the family in lower case:
 * its body and tables, headers and footers, notes at the foot of the pages and
 * text boxes. The families of its styles are there too, with what text they have.
 */
export function textByFamily(doc: Doc): Map<string, string> {
  const text = new Map<string, Set<string>>();
  const add = (family: string, chars: string) => {
    const key = family.toLowerCase();
    let set = text.get(key);
    if (!set) text.set(key, (set = new Set()));
    for (const ch of chars) set.add(ch);
  };
  const stories: (Story | undefined)[] = [doc, ...storyParts(doc).map((part) => storyOf(doc, part)), ...(doc.footnotes ?? []), ...(doc.textBoxes ?? [])];
  for (const story of stories) for (const para of story?.paragraphs ?? []) for (const run of para.runs) add(resolveRun(run.props).fontFamily, run.text);
  for (const style of doc.styles ?? []) if (style.run.fontFamily) add(style.run.fontFamily, '');
  return new Map([...text].map(([family, chars]) => [family, [...chars].join('')]));
}
