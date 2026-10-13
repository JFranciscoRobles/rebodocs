// Measuring text from font files, for where there is no browser to ask: on a
// server, a document is laid out with the fonts it is given. The numbers are
// the ones a browser gets from the same files, so the pages come out the same.

import { type FontMetrics, type FontSpec, type TextMeasurer } from './layout';
import { type TrueType, parseTrueType } from './pdf';

/** A font file and what it says it is. */
export interface FontFile extends TrueType {
  bytes: Uint8Array;
}

/** Reads a TrueType font file. Undefined for anything else. */
export function readFont(bytes: Uint8Array, as?: { family: string; bold: boolean; italic: boolean }): FontFile | undefined {
  const font = parseTrueType(bytes);
  if (!font || !(as?.family ?? font.family)) return undefined;
  return { ...font, ...as, bytes };
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
      font ??= [...this.byFamily.values()][0]?.[0];
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
