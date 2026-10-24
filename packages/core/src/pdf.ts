// A PDF of a laid-out document, written here: every page with its text where
// the layout put it, its table borders and shading, and its pictures.
//
// Fonts are the hard part. A font whose file is at hand (the ones a DOCX
// carries, TrueType or OpenType) goes into the PDF. For any other, the PDF names one of the
// three families every reader has (Helvetica, Times, Courier), which have the
// same widths as Arial, Times New Roman and Courier New. Words are placed one
// by one where the layout measured them, so lines keep their length whatever
// the reader draws them with.
//
// The PDF is tagged (see pdftags.ts): a screen reader finds in it the
// headings, the lists, the tables, the notes and what each picture shows, in
// the order of the document, and the headings are its bookmarks too.

import { zlibSync } from 'fflate';
import { type Band, type FontSpec, type Fragment, type Layout, type LayoutPage, type Line, type TextBoxBand, type TextMeasurer, boxLines, noteRules } from './layout';
import { type Border, type Doc, DEFAULT_BORDER } from './model';
import { linkHref } from './links';
import { altText, isDecorative } from './images';
import { outline } from './outline';
import { type Element, StructTree } from './pdftags';
import { type StoryPart, documentLanguage } from './docx/source';

/** A picture ready for a PDF: a JPEG as it is, or its pixels. */
export interface PdfImage {
  width: number;
  height: number;
  /** The bytes of a JPEG file, which a PDF can hold as they are. */
  jpeg?: Uint8Array;
  /** Otherwise, three bytes per pixel, row by row, and one byte per pixel of opacity when not all are opaque. */
  rgb?: Uint8Array;
  alpha?: Uint8Array;
}

export interface PdfResources {
  /** The measurer the layout was made with: words are placed where it says they start. */
  measurer: TextMeasurer;
  /** The TrueType or OpenType file of a font, when there is one to put in the PDF. */
  font?(spec: FontSpec): Uint8Array | undefined;
  /** The picture of an object, by its XML and the part it lives in. */
  image?(xml: string, part?: StoryPart): PdfImage | undefined;
  title?: string;
  /**
   * The document the layout was made from. With it, a screen reader finds its
   * headings, lists, tables and notes in the PDF, and the headings are
   * bookmarks; without it, each paragraph is just a paragraph.
   */
  doc?: Doc;
  /** The language of the text, as a tag such as es-MX: the one the document says, when not given. */
  language?: string;
}

// --- Bytes ----------------------------------------------------------------------

const latin1 = (text: string) => Uint8Array.from(text, (ch) => ch.charCodeAt(0) & 0xff);
const num = (value: number) => (Math.round(value * 1000) / 1000).toString();
const hex = (value: number, digits: number) => value.toString(16).toUpperCase().padStart(digits, '0');

class Writer {
  private chunks: Uint8Array[] = [];
  private offsets: number[] = [];
  private length = 0;

  private push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  constructor() {
    // The second line marks the file as holding bytes, not text.
    this.push(latin1('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n'));
  }

  /** Reserves the number of an object to be written later. */
  reserve(): number {
    this.offsets.push(0);
    return this.offsets.length;
  }

  /** Writes an object: a dictionary or any other value, and the bytes of its stream when it has one. */
  write(id: number, dict: string, stream?: Uint8Array): number {
    this.offsets[id - 1] = this.length;
    if (stream) {
      this.push(latin1(`${id} 0 obj\n${dict.replace(/>>$/, ` /Length ${stream.length} >>`)}\nstream\n`));
      this.push(stream);
      this.push(latin1('\nendstream\nendobj\n'));
    } else {
      this.push(latin1(`${id} 0 obj\n${dict}\nendobj\n`));
    }
    return id;
  }

  add(dict: string, stream?: Uint8Array): number {
    return this.write(this.reserve(), dict, stream);
  }

  /** A stream squeezed with Flate. */
  deflated(dict: string, data: Uint8Array): number {
    return this.add(dict.replace(/>>$/, ' /Filter /FlateDecode >>'), zlibSync(data));
  }

  finish(root: number, info: number): Uint8Array<ArrayBuffer> {
    const start = this.length;
    const count = this.offsets.length + 1;
    let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (const offset of this.offsets) xref += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    this.push(latin1(`${xref}trailer\n<< /Size ${count} /Root ${root} 0 R /Info ${info} 0 R >>\nstartxref\n${start}\n%%EOF\n`));
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}

/** A text string of a dictionary, in UTF-16 so any letter can be in it. */
function textString(text: string): string {
  let out = 'FEFF';
  for (let i = 0; i < text.length; i++) out += hex(text.charCodeAt(i), 4);
  return `<${out}>`;
}

// --- TrueType -------------------------------------------------------------------

export interface TrueType {
  /** The family the font says it is of, and its style. */
  family: string;
  bold: boolean;
  italic: boolean;
  unitsPerEm: number;
  bbox: [number, number, number, number];
  ascent: number;
  descent: number;
  /** Extra room the font asks for between lines. */
  lineGap: number;
  capHeight: number;
  italicAngle: number;
  glyph(codePoint: number): number;
  advance(glyph: number): number;
  /** How much closer (less than 0) or further apart a glyph and the one after it are set, in the units of the font, by its pairs: what Word does when kerning is on. 0 for a pair the font says nothing of. */
  kerning?(left: number, right: number): number;
  /** Set for an OpenType file whose outlines are in CFF, not TrueType: it goes into a PDF whole. */
  cff?: boolean;
}

/**
 * An OpenType file in CFF whose glyphs a PDF can name by their numbers, as
 * every reader then draws them: one keyed by CID gets a charset where each
 * glyph's CID is its number, written over the one it had. The file as it is
 * when it already is so, when it is keyed by glyph name, or when it cannot be
 * made sense of.
 */
function cffByGlyph(bytes: Uint8Array): Uint8Array {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let at = -1;
    for (let i = 0; i < view.getUint16(4); i++) {
      const record = 12 + i * 16;
      if (String.fromCharCode(bytes[record], bytes[record + 1], bytes[record + 2], bytes[record + 3]) === 'CFF ') at = view.getUint32(record + 8);
    }
    const charset = at < 0 ? undefined : cffCharset(bytes, at);
    if (!charset || charset.identity) return bytes;
    // Glyph 0 has no entry. Ranges of glyphs whose CIDs follow their numbers, as few as the room allows.
    const glyphs = charset.glyphs;
    const out = bytes.slice();
    const k = charset.at;
    if (charset.length >= 5) {
      out[k] = 2;
      out[k + 1] = 0;
      out[k + 2] = 1;
      out[k + 3] = (glyphs - 2) >> 8;
      out[k + 4] = (glyphs - 2) & 0xff;
    } else {
      out[k] = 1;
      let p = k + 1;
      for (let first = 1; first < glyphs; first += 256) {
        const left = Math.min(255, glyphs - 1 - first);
        out[p] = first >> 8;
        out[p + 1] = first & 0xff;
        out[p + 2] = left;
        p += 3;
      }
      if (p > k + charset.length) return bytes;
    }
    return out;
  } catch {
    return bytes;
  }
}

/**
 * Where the charset of a CFF font keyed by CID is, how long it is and how
 * many glyphs it covers, and whether each glyph's CID is its own number.
 * Undefined for a font keyed by glyph name.
 */
function cffCharset(bytes: Uint8Array, at: number): { at: number; length: number; glyphs: number; identity: boolean } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  /** The items of an INDEX, as where each starts and ends, and where the INDEX ends. */
  const index = (start: number): { items: [number, number][]; end: number } => {
    const count = view.getUint16(start);
    if (!count) return { items: [], end: start + 2 };
    const size = bytes[start + 2];
    const offset = (k: number) => {
      let value = 0;
      for (let b = 0; b < size; b++) value = value * 256 + bytes[start + 3 + k * size + b];
      return value;
    };
    const base = start + 2 + (count + 1) * size;
    const items: [number, number][] = [];
    for (let k = 0; k < count; k++) items.push([base + offset(k), base + offset(k + 1)]);
    return { items, end: base + offset(count) };
  };
  const names = index(at + bytes[at + 2]);
  const [top] = index(names.end).items;
  if (!top) return undefined;
  // The operators of the top DICT, with the last number before each.
  const ops = new Map<number, number>();
  let operand = 0;
  for (let k = top[0]; k < top[1]; ) {
    const b = bytes[k];
    if (b === 12) {
      ops.set(1200 + bytes[k + 1], operand);
      k += 2;
    } else if (b <= 21) {
      ops.set(b, operand);
      k++;
    } else if (b === 28) {
      operand = view.getInt16(k + 1);
      k += 3;
    } else if (b === 29) {
      operand = view.getInt32(k + 1);
      k += 5;
    } else if (b === 30) {
      // A real number, of no use here: skipped to the nibble that ends it.
      k++;
      while (k < top[1] && (bytes[k] & 0x0f) !== 0x0f && bytes[k] >> 4 !== 0x0f) k++;
      k++;
    } else if (b <= 246) {
      operand = b - 139;
      k++;
    } else if (b <= 250) {
      operand = (b - 247) * 256 + bytes[k + 1] + 108;
      k += 2;
    } else {
      operand = -(b - 251) * 256 - bytes[k + 1] - 108;
      k += 2;
    }
  }
  // ROS, the operator only a font keyed by CID has.
  if (!ops.has(1230) || !ops.has(15) || !ops.has(17)) return undefined;
  const glyphs = index(at + ops.get(17)!).items.length;
  const charset = at + ops.get(15)!;
  const format = bytes[charset];
  let identity = true;
  let k = charset + 1;
  if (format === 0) {
    for (let g = 1; g < glyphs; g++, k += 2) identity &&= view.getUint16(k) === g;
  } else if (format === 1 || format === 2) {
    for (let g = 1; g < glyphs; ) {
      const first = view.getUint16(k);
      const left = format === 1 ? bytes[k + 2] : view.getUint16(k + 2);
      k += format === 1 ? 3 : 4;
      identity &&= first === g;
      g += left + 1;
    }
  } else {
    return undefined;
  }
  return { at: charset, length: k - charset, glyphs, identity };
}

/** Reads what a PDF needs to know of a TrueType or OpenType file. Undefined for anything else, or a file it cannot make sense of. */
export function parseTrueType(bytes: Uint8Array): TrueType | undefined {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = view.getUint32(0);
    // TrueType outlines, or CFF ones in an OpenType file ('OTTO').
    const cff = version === 0x4f54544f;
    if (version !== 0x00010000 && version !== 0x74727565 && !cff) return undefined;
    const tables = new Map<string, number>();
    for (let i = 0; i < view.getUint16(4); i++) {
      const at = 12 + i * 16;
      tables.set(String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]), view.getUint32(at + 8));
    }
    const table = (name: string) => {
      const at = tables.get(name);
      if (at === undefined) throw new Error(`no ${name}`);
      return at;
    };
    const head = table('head');
    const hhea = table('hhea');
    const hmtx = table('hmtx');
    const unitsPerEm = view.getUint16(head + 18);
    const metrics = view.getUint16(hhea + 34);
    const os2 = tables.get('OS/2');
    const post = tables.get('post');
    const ascent = view.getInt16(hhea + 4);

    // The table that maps characters to glyphs: the widest one for Unicode there is.
    const cmap = table('cmap');
    let wide = 0;
    let basic = 0;
    let symbol = false;
    for (let i = 0; i < view.getUint16(cmap + 2); i++) {
      const record = cmap + 4 + i * 8;
      const platform = view.getUint16(record);
      const encoding = view.getUint16(record + 2);
      const at = cmap + view.getUint32(record + 4);
      const format = view.getUint16(at);
      if (format === 12 && (platform === 0 || (platform === 3 && encoding === 10))) wide = at;
      else if (format === 4 && (platform === 0 || (platform === 3 && encoding <= 1))) {
        if (!basic || (platform === 3 && encoding === 1)) {
          basic = at;
          symbol = platform === 3 && encoding === 0;
        }
      }
    }
    if (!wide && !basic) return undefined;

    const fromBasic = (code: number): number => {
      const segments = view.getUint16(basic + 6) / 2;
      const ends = basic + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const ranges = deltas + segments * 2;
      for (let s = 0; s < segments; s++) {
        if (code > view.getUint16(ends + s * 2)) continue;
        const start = view.getUint16(starts + s * 2);
        if (code < start) return 0;
        const range = view.getUint16(ranges + s * 2);
        const delta = view.getUint16(deltas + s * 2);
        if (!range) return (code + delta) & 0xffff;
        const glyph = view.getUint16(ranges + s * 2 + range + (code - start) * 2);
        return glyph ? (glyph + delta) & 0xffff : 0;
      }
      return 0;
    };
    const fromWide = (code: number): number => {
      const groups = view.getUint32(wide + 12);
      let lo = 0;
      let hi = groups - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const at = wide + 16 + mid * 12;
        if (code < view.getUint32(at)) hi = mid - 1;
        else if (code > view.getUint32(at + 4)) lo = mid + 1;
        else return view.getUint32(at + 8) + code - view.getUint32(at);
      }
      return 0;
    };
    // The family as the menus of a word processor show it: the name with id 1.
    let family = '';
    const names = tables.get('name');
    if (names !== undefined) {
      const strings = names + view.getUint16(names + 4);
      for (let i = 0; i < view.getUint16(names + 2); i++) {
        const record = names + 6 + i * 12;
        const platform = view.getUint16(record);
        if (view.getUint16(record + 6) !== 1 || (family && platform !== 3)) continue;
        const at = strings + view.getUint16(record + 10);
        const length = view.getUint16(record + 8);
        let text = '';
        if (platform === 1) for (let k = 0; k < length; k++) text += String.fromCharCode(bytes[at + k]);
        else for (let k = 0; k + 1 < length; k += 2) text += String.fromCharCode(view.getUint16(at + k));
        if (text) family = text;
      }
    }
    const macStyle = view.getUint16(head + 44);
    const pairs = kernPairs(view, tables.get('kern'));
    return {
      ...(cff ? { cff } : {}),
      family,
      bold: (macStyle & 1) !== 0,
      italic: (macStyle & 2) !== 0,
      lineGap: view.getInt16(hhea + 8),
      unitsPerEm,
      bbox: [view.getInt16(head + 36), view.getInt16(head + 38), view.getInt16(head + 40), view.getInt16(head + 42)],
      ascent,
      descent: view.getInt16(hhea + 6),
      capHeight: os2 !== undefined && view.getUint16(os2) >= 2 ? view.getInt16(os2 + 88) : ascent,
      italicAngle: post !== undefined ? view.getInt32(post + 4) / 65536 : 0,
      glyph(code) {
        if (wide) return fromWide(code);
        // Symbol fonts keep their characters in a private range.
        return fromBasic(code) || (symbol && code < 0x100 ? fromBasic(0xf000 + code) : 0);
      },
      advance: (glyph) => view.getUint16(hmtx + Math.min(glyph, metrics - 1) * 4),
      kerning: (left, right) => pairs?.get(left * 0x10000 + right) ?? 0,
    };
  } catch {
    return undefined;
  }
}

/**
 * The pairs of the 'kern' table of a font, by the two glyphs (left × 65536 +
 * right): its horizontal subtables of format 0, the one Windows and Word read.
 * Measured against Word, its values are the ones Word sets text by: the pair
 * "11" of Arial, -152 units. Undefined for a font without the table.
 */
function kernPairs(view: DataView, at: number | undefined): Map<number, number> | undefined {
  if (at === undefined) return undefined;
  const pairs = new Map<number, number>();
  // Version 0, as Microsoft has it: a version and a count of 16 bits each.
  if (view.getUint16(at) !== 0) return undefined;
  let sub = at + 4;
  for (let n = view.getUint16(at + 2); n > 0; n--) {
    const length = view.getUint16(sub + 2);
    const coverage = view.getUint16(sub + 4);
    // Horizontal (bit 0), not minimum values (1) nor across the line (2), format 0 (the high byte).
    if ((coverage & 0x7) === 0x1 && coverage >> 8 === 0) {
      const count = view.getUint16(sub + 6);
      for (let i = 0; i < count; i++) {
        const pair = sub + 14 + i * 6;
        const key = view.getUint16(pair) * 0x10000 + view.getUint16(pair + 2);
        // Several subtables add up, as the format says.
        pairs.set(key, (pairs.get(key) ?? 0) + view.getInt16(pair + 4));
      }
    }
    sub += length || 6;
  }
  return pairs.size ? pairs : undefined;
}

/**
 * A TrueType file with only the outlines of `glyphs`, and of the glyphs they
 * are built from, and only the tables a PDF reader draws with. Glyphs keep
 * their numbers. Undefined when the file is not laid out as expected.
 * `keepTables` keeps every other table as it is, for a program that reads the
 * font as a font, as Word does: its names, its map of characters, its metrics.
 */
export function subsetTrueType(bytes: Uint8Array, glyphs: Iterable<number>, keepTables = false): Uint8Array | undefined {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tables = new Map<string, { at: number; length: number }>();
    for (let i = 0; i < view.getUint16(4); i++) {
      const record = 12 + i * 16;
      const tag = String.fromCharCode(bytes[record], bytes[record + 1], bytes[record + 2], bytes[record + 3]);
      tables.set(tag, { at: view.getUint32(record + 8), length: view.getUint32(record + 12) });
    }
    const head = tables.get('head');
    const loca = tables.get('loca');
    const glyf = tables.get('glyf');
    const maxp = tables.get('maxp');
    if (!head || !loca || !glyf || !maxp) return undefined;
    const count = view.getUint16(maxp.at + 4);
    const long = view.getInt16(head.at + 50) === 1;
    const offset = (glyph: number) => (long ? view.getUint32(loca.at + glyph * 4) : view.getUint16(loca.at + glyph * 2) * 2);

    // A glyph made of others needs them too.
    const keep = new Set<number>([0]);
    const queue = [...glyphs].filter((glyph) => glyph < count);
    while (queue.length) {
      const glyph = queue.pop()!;
      if (keep.has(glyph) && glyph !== 0) continue;
      keep.add(glyph);
      const start = glyf.at + offset(glyph);
      const end = glyf.at + offset(glyph + 1);
      if (end - start < 10 || view.getInt16(start) >= 0) continue;
      for (let at = start + 10; at + 4 <= end; ) {
        const flags = view.getUint16(at);
        queue.push(view.getUint16(at + 2));
        at += 4 + (flags & 0x1 ? 4 : 2) + (flags & 0x8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
        if (!(flags & 0x20)) break;
      }
    }

    const outlines: Uint8Array[] = [];
    const places = new Uint8Array((count + 1) * 4);
    const placesView = new DataView(places.buffer);
    let total = 0;
    for (let glyph = 0; glyph < count; glyph++) {
      placesView.setUint32(glyph * 4, total);
      if (!keep.has(glyph)) continue;
      const data = bytes.subarray(glyf.at + offset(glyph), glyf.at + offset(glyph + 1));
      const padded = new Uint8Array((data.length + 3) & ~3);
      padded.set(data);
      outlines.push(padded);
      total += padded.length;
    }
    placesView.setUint32(count * 4, total);
    const newGlyf = new Uint8Array(total);
    let at = 0;
    for (const data of outlines) {
      newGlyf.set(data, at);
      at += data.length;
    }
    // The places of the glyphs are written long, and the header says so.
    const newHead = bytes.slice(head.at, head.at + head.length);
    new DataView(newHead.buffer).setInt16(50, 1);
    new DataView(newHead.buffer).setUint32(8, 0);

    const parts: [string, Uint8Array][] = [];
    // A signature no longer matches what it signed.
    const tags = keepTables ? [...tables.keys()].filter((tag) => tag !== 'DSIG').sort() : ['cvt ', 'fpgm', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'prep'];
    for (const tag of tags) {
      const table = tables.get(tag);
      const data = tag === 'glyf' ? newGlyf : tag === 'loca' ? places : tag === 'head' ? newHead : table && bytes.subarray(table.at, table.at + table.length);
      if (data) parts.push([tag, data]);
    }
    const headerLength = 12 + parts.length * 16;
    const size = parts.reduce((sum, [, data]) => sum + ((data.length + 3) & ~3), headerLength);
    const file = new Uint8Array(size);
    const out = new DataView(file.buffer);
    const power = 2 ** Math.floor(Math.log2(parts.length));
    out.setUint32(0, 0x00010000);
    out.setUint16(4, parts.length);
    out.setUint16(6, power * 16);
    out.setUint16(8, Math.log2(power));
    out.setUint16(10, parts.length * 16 - power * 16);
    let place = headerLength;
    parts.forEach(([tag, data], i) => {
      const record = 12 + i * 16;
      for (let k = 0; k < 4; k++) file[record + k] = tag.charCodeAt(k);
      file.set(data, place);
      let sum = 0;
      for (let k = 0; k < ((data.length + 3) & ~3); k += 4) sum = (sum + out.getUint32(place + k)) >>> 0;
      out.setUint32(record + 4, sum);
      out.setUint32(record + 8, place);
      out.setUint32(record + 12, data.length);
      place += (data.length + 3) & ~3;
    });
    if (keepTables) {
      // What the header says the whole file adds up to, as a font that is read as one must.
      let sum = 0;
      for (let k = 0; k < file.length; k += 4) sum = (sum + out.getUint32(k)) >>> 0;
      const headAt = out.getUint32(12 + parts.findIndex(([tag]) => tag === 'head') * 16 + 8);
      out.setUint32(headAt + 8, (0xb1b0afba - sum) >>> 0);
    }
    return file;
  } catch {
    return undefined;
  }
}

// --- Fonts ----------------------------------------------------------------------

/** What Windows-1252 has between 0x80 and 0x9F, which the fonts every reader has can write. */
const WIN_ANSI: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
  // Near enough, for what it lacks: other hyphens and spaces, and the bullets of lists.
  0x2010: 0x2d,
  0x2011: 0x2d,
  0x2212: 0x2d,
  0x00a0: 0x20,
  0x2009: 0x20,
  0x202f: 0x20,
  0x25cf: 0x95,
  0x25aa: 0x95,
  0x25a0: 0x95,
  0x25cb: 0x6f,
  0x2192: 0xbb,
};

function winAnsi(code: number): number {
  if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return code;
  return WIN_ANSI[code] ?? 0x3f;
}

/** The family every reader has that stands in for `family`. */
function standardFont(spec: FontSpec): string {
  const name = spec.family;
  const style = (bold: string, italic: string, both: string) => (spec.bold && spec.italic ? both : spec.bold ? bold : spec.italic ? italic : '');
  if (/courier|consolas|mono/i.test(name)) return `Courier${style('-Bold', '-Oblique', '-BoldOblique')}`;
  if (/times|georgia|garamond|cambria|palatino|book|serif/i.test(name) && !/sans/i.test(name)) {
    return `Times${style('-Bold', '-Italic', '-BoldItalic') || '-Roman'}`;
  }
  return `Helvetica${style('-Bold', '-Oblique', '-BoldOblique')}`;
}

interface PdfFont {
  /** The name the page content calls it by. */
  name: string;
  id: number;
  /** The font file, for one that goes into the PDF. */
  file?: { bytes: Uint8Array; font: TrueType; used: Map<number, number> };
  standard?: string;
  /** What the file lacks of the face asked for, drawn as the browser draws it: thicker, or slanted. */
  fake?: { bold: boolean; italic: boolean };
  /** `text` as the string operand that shows it in this font. */
  encode(text: string): string;
}

/**
 * A word as the operator that shows it: with Tj as it is, or kerned with TJ,
 * each pair of letters the font sets closer moved together by what the font
 * says, in thousandths of the size, as the layout measured it. A font that is
 * not in the PDF has no pairs to give.
 */
function kernedText(font: PdfFont, word: string, kern: boolean): string {
  const file = font.file?.font;
  if (!kern || !file?.kerning) return `${font.encode(word)} Tj`;
  const parts: string[] = [];
  let run = '';
  let before = -1;
  for (const ch of word) {
    const glyph = file.glyph(ch.codePointAt(0)!) || file.glyph(0x20);
    const pair = before >= 0 ? file.kerning(before, glyph) : 0;
    if (pair) {
      parts.push(font.encode(run), String(Math.round((-pair * 1000 * 100) / file.unitsPerEm) / 100));
      run = '';
    }
    run += ch;
    before = glyph;
  }
  parts.push(font.encode(run));
  return parts.length === 1 ? `${parts[0]} Tj` : `[${parts.join(' ')}] TJ`;
}

// --- Pictures -------------------------------------------------------------------

/** Number of colour channels of a JPEG, read from its frame header. */
function jpegChannels(bytes: Uint8Array): number {
  for (let at = 2; at + 9 < bytes.length; ) {
    if (bytes[at] !== 0xff) return 3;
    const marker = bytes[at + 1];
    // The frame headers, which say the size and the channels; the others are skipped by their length.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return bytes[at + 9];
    at += 2 + (bytes[at + 2] << 8) + bytes[at + 3];
  }
  return 3;
}

// --- The document ---------------------------------------------------------------

/** The line drawn down between two columns. */
const COLUMN_RULE: Border = DEFAULT_BORDER;

const rgb = (color: string) => [0, 2, 4].map((i) => num(parseInt(color.slice(i, i + 2), 16) / 255 || 0)).join(' ');

/** An address as a PDF string: only the characters every reader takes, the rest in the way addresses write them. */
const uriString = (href: string) => `(${href.replace(/[^\x21-\x7e]/g, (c) => encodeURIComponent(c)).replace(/[\\()]/g, (c) => `\\${c}`)})`;

/** A part of a page to draw, and what its text is in the tree: the body, a note, a text box, or none (a header, a footer). */
interface PageBand {
  band: Band;
  part?: StoryPart;
  kind: 'body' | 'note' | 'box' | 'artifact';
  /** The note's id, the text box's. */
  id?: string;
}

const escapeXmp = (text: string) => text.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The description of the file in XMP, as readers of tagged PDFs look for it:
 * its title and its language, and that it is made to be read by anyone
 * (PDF/UA) when it is.
 */
function xmp(title: string | undefined, language: string | undefined, universal: boolean): string {
  const lang = language || 'x-default';
  return (
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">' +
    '<pdf:Producer>Rebodocs</pdf:Producer>' +
    (title ? `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXmp(title)}</rdf:li></rdf:Alt></dc:title>` : '') +
    (language ? `<dc:language><rdf:Bag><rdf:li>${escapeXmp(lang)}</rdf:li></rdf:Bag></dc:language>` : '') +
    '</rdf:Description>' +
    (universal ? '<rdf:Description rdf:about="" xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/"><pdfuaid:part>1</pdfuaid:part></rdf:Description>' : '') +
    '</rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>'
  );
}

/** The headings of the document as the PDF's bookmarks, each going to the top of its first line, nested by level. Returns 0 when it has none. */
function writeOutlines(out: Writer, doc: Doc, layout: Layout, pageIds: number[]): number {
  interface Mark {
    title: string;
    page: number;
    y: number;
    level: number;
    kids: Mark[];
    id: number;
  }
  const top: Mark[] = [];
  const open: Mark[] = [];
  for (const item of outline(doc)) {
    const line = layout.lines[layout.paraFirstLine[item.para]];
    if (!line || !pageIds[line.page]) continue;
    const mark: Mark = { title: item.text, page: line.page, y: line.y, level: item.level, kids: [], id: 0 };
    while (open.length && open[open.length - 1].level >= item.level) open.pop();
    (open.length ? open[open.length - 1].kids : top).push(mark);
    open.push(mark);
  }
  if (!top.length) return 0;
  const rootId = out.reserve();
  const number = (marks: Mark[]) => marks.forEach((mark) => ((mark.id = out.reserve()), number(mark.kids)));
  number(top);
  /** All under it, each shown: every bookmark is open. */
  const count = (marks: Mark[]): number => marks.reduce((sum, mark) => sum + 1 + count(mark.kids), 0);
  const ends = (marks: Mark[]) => (marks.length ? ` /First ${marks[0].id} 0 R /Last ${marks[marks.length - 1].id} 0 R /Count ${count(marks)}` : '');
  const write = (marks: Mark[], parent: number) =>
    marks.forEach((mark, i) => {
      const height = (layout.pages[mark.page]?.setup ?? layout.page).height;
      const prev = i > 0 ? ` /Prev ${marks[i - 1].id} 0 R` : '';
      const next = i < marks.length - 1 ? ` /Next ${marks[i + 1].id} 0 R` : '';
      out.write(mark.id, `<< /Title ${textString(mark.title)} /Parent ${parent} 0 R${prev}${next}${ends(mark.kids)} /Dest [${pageIds[mark.page]} 0 R /XYZ 0 ${num(height - mark.y)} null] >>`);
      write(mark.kids, mark.id);
    });
  write(top, rootId);
  out.write(rootId, `<< /Type /Outlines${ends(top)} >>`);
  return rootId;
}

export function exportPdf(layout: Layout, resources: PdfResources): Uint8Array<ArrayBuffer> {
  const out = new Writer();
  /** The size of a page: its section's. The page being drawn is `height` tall, which PDF counts up from its bottom. */
  const sizeOf = (index: number) => layout.pages[index]?.setup ?? layout.page;
  let { width, height } = layout.page;
  const fonts = new Map<string, PdfFont>();
  const images = new Map<string, { name: string; id: number } | null>();
  const { doc } = resources;
  const tree = new StructTree(doc);
  /** Pictures read with no description to read. */
  let undescribed = 0;

  const fontFor = (spec: FontSpec): PdfFont => {
    const key = `${spec.family}|${spec.bold}|${spec.italic}`;
    let font = fonts.get(key);
    if (font) return font;
    const name = `F${fonts.size + 1}`;
    const bytes = resources.font?.(spec);
    const parsed = bytes && parseTrueType(bytes);
    if (bytes && parsed) {
      const used = new Map<number, number>();
      font = {
        name,
        id: out.reserve(),
        file: { bytes, font: parsed, used },
        // The regular face given for a bold or italic one the application did not give.
        fake: { bold: spec.bold && !parsed.bold, italic: spec.italic && !parsed.italic && !parsed.italicAngle },
        encode(text) {
          let codes = '';
          for (const ch of text) {
            const code = ch.codePointAt(0)!;
            const glyph = parsed.glyph(code) || parsed.glyph(0x20);
            if (!used.has(glyph)) used.set(glyph, code);
            codes += hex(glyph, 4);
          }
          return `<${codes}>`;
        },
      };
    } else {
      font = {
        name,
        id: out.reserve(),
        standard: standardFont(spec),
        encode(text) {
          let codes = '';
          for (const ch of text) codes += hex(winAnsi(ch.codePointAt(0)!), 2);
          return `<${codes}>`;
        },
      };
    }
    fonts.set(key, font);
    return font;
  };

  const imageFor = (xml: string, part?: StoryPart) => {
    const key = `${part ?? ''}\n${xml}`;
    let entry = images.get(key);
    if (entry !== undefined) return entry;
    entry = null;
    const image = resources.image?.(xml, part);
    if (image && image.width > 0 && image.height > 0) {
      const name = `I${images.size + 1}`;
      const size = `/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /BitsPerComponent 8`;
      if (image.jpeg) {
        const channels = jpegChannels(image.jpeg);
        const space = channels === 1 ? '/DeviceGray' : channels === 4 ? '/DeviceCMYK' : '/DeviceRGB';
        // Photoshop writes CMYK the other way round.
        const decode = channels === 4 ? ' /Decode [1 0 1 0 1 0 1 0]' : '';
        entry = { name, id: out.add(`<< ${size} /ColorSpace ${space}${decode} /Filter /DCTDecode >>`, image.jpeg) };
      } else if (image.rgb) {
        const mask = image.alpha?.some((a) => a !== 255) ? out.deflated(`<< ${size} /ColorSpace /DeviceGray >>`, image.alpha) : 0;
        entry = { name, id: out.deflated(`<< ${size} /ColorSpace /DeviceRGB${mask ? ` /SMask ${mask} 0 R` : ''} >>`, image.rgb) };
      }
    }
    images.set(key, entry);
    return entry;
  };

  /** A stretch of a line that is a link: where it is on its page, and where it goes, out of the document or to a bookmark of it. */
  interface LinkBox {
    x: number;
    y: number;
    width: number;
    height: number;
    href?: string;
    anchor?: string;
    line: Line;
    /** The element of its text, which the link is part of. */
    element?: Element;
  }
  /** Where each bookmark of the document is: its page, and how far down it. */
  const bookmarks = new Map<string, { page: number; y: number }>();
  let links: LinkBox[] = [];
  let pageIndex = 0;
  /** Where the link a fragment is part of goes, when it is part of one. */
  const targetOf = (f: Fragment) => {
    const anchor = f.props.wrap ? /<w:hyperlink\b[^>]*\bw:anchor="([^"]*)"/.exec(f.props.wrap)?.[1] : undefined;
    const href = linkHref(f.props);
    return href === undefined && anchor === undefined ? undefined : { href, anchor };
  };
  /** Notes the link a fragment is part of, joined to the one before it on its line when they go to the same place. */
  const noteLink = (f: Fragment, line: Line, element?: Element) => {
    const target = targetOf(f);
    if (!target) return;
    const { href, anchor } = target;
    const top = line.baseline - f.ascent;
    const bottom = line.baseline + f.descent;
    const last = links[links.length - 1];
    if (last && last.line === line && last.href === href && last.anchor === anchor && Math.abs(last.x + last.width - f.x) < 0.5) {
      // As tall as the tallest of its text.
      const low = Math.max(last.y + last.height, bottom);
      last.y = Math.min(last.y, top);
      last.height = low - last.y;
      last.width = f.x + f.width - last.x;
      return;
    }
    links.push({ x: f.x, y: top, width: f.width, height: bottom - top, href, anchor, line, element });
  };
  /** The lines already given to the tree: a heading row of a table, drawn again at the top of the next page, is not read twice. */
  const told = new Set<string>();
  /** The link being written, while the text of an element goes on being part of it. */
  let link: { owner: Element; key: string; element: Element } | undefined;
  /** The element a fragment's text goes in: its paragraph's, or the link it is part of. */
  const ownerOf = (f: Fragment, owner: Element | undefined) => {
    const target = owner && targetOf(f);
    if (!owner || !target) {
      if (f.width > 0) link = undefined;
      return owner;
    }
    const key = `${target.href}\n${target.anchor}`;
    if (link?.owner !== owner || link.key !== key) link = { owner, key, element: tree.child(owner, 'Link') };
    return link.element;
  };

  /** The operators that draw a page. PDF measures up from the bottom of the page: `y` is turned over. */
  const pageContent = (bands: PageBand[]): string => {
    let ops = '';
    /** What the content being written is part of: an element of the tree, the artifacts, or nothing yet. */
    let open: Element | 'artifact' | undefined;
    const close = () => {
      if (open) ops += 'EMC\n';
      open = undefined;
    };
    const artifact = () => {
      if (open === 'artifact') return;
      close();
      ops += '/Artifact BMC\n';
      open = 'artifact';
    };
    /** What follows is part of `element`; of the artifacts, when it is part of none. */
    const tag = (element: Element | undefined) => {
      if (!element) return artifact();
      if (open === element) return;
      close();
      ops += `/${element.type} <</MCID ${tree.mark(element, pageIndex)}>> BDC\n`;
      open = element;
    };
    const rect = (x: number, y: number, w: number, h: number) => `${num(x)} ${num(height - y - h)} ${num(w)} ${num(h)} re`;
    /** A picture, read by its description as part of `owner`; a decorative one, or one of a header, is skipped. */
    const picture = (xml: string, x: number, y: number, w: number, h: number, part: StoryPart | undefined, owner: Element | undefined) => {
      const image = imageFor(xml, part);
      if (!image) return;
      if (owner && !isDecorative(xml)) {
        const box: [number, number, number, number] = [num(x), num(height - y - h), num(x + w), num(height - y)].map(Number) as [number, number, number, number];
        const alt = altText(xml);
        if (!alt) undescribed++;
        tag(tree.child(owner, 'Figure', { alt: alt ?? '', bbox: box }));
      } else artifact();
      ops += `q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(height - y - h)} cm /${image.name} Do Q\n`;
    };
    /** A border from one point to another, centred on the line between them. */
    const stroke = (border: Border, x1: number, y1: number, x2: number, y2: number): string => {
      const w = border.width;
      const dash = border.style === 'dashed' ? `[${num(Math.max(3, w * 3))} ${num(Math.max(2, w * 2))}] 0 d` : border.style === 'dotted' ? `1 J [0 ${num(Math.max(1, w * 2))}] 0 d` : '';
      const segment = (dx: number, dy: number) => `${num(x1 + dx)} ${num(height - y1 - dy)} m ${num(x2 + dx)} ${num(height - y2 - dy)} l S`;
      // A double line is two, as far apart as each is thick, either side of where a single one would be.
      const across = x1 === x2 ? [w, 0] : [0, w];
      const body = border.style === 'double' ? `${segment(-across[0], -across[1])} ${segment(across[0], across[1])}` : segment(0, 0);
      return `q ${rgb(border.color)} RG ${num(Math.max(0.25, w))} w ${dash} ${body} Q\n`;
    };
    const text = (f: Fragment, line: Line) => {
      const size = f.font.size;
      if (f.props.highlight) ops += `${rgb(f.props.highlight)} rg ${rect(f.x, line.baseline - f.ascent, f.width, f.ascent + f.descent)} f\n`;
      const font = fontFor(f.font);
      const bold = font.fake?.bold;
      const slant = font.fake?.italic ? 0.2 : 0;
      // Bold as an outline round each letter in its own colour; italic as a slant of the letters.
      ops += `${bold ? 'q ' : ''}BT /${font.name} ${num(size)} Tf ${rgb(f.props.color)} rg${bold ? ` 2 Tr ${rgb(f.props.color)} RG ${num(size * 0.03)} w` : ''}\n`;
      // Word by word, each where the layout measured it to start: a word and the spaces after it.
      for (const match of f.text.matchAll(/\S+\s*|\s+/g)) {
        const before = f.text.slice(0, match.index);
        const spaces = f.wordSpacing ? (before.match(/ /g)?.length ?? 0) * f.wordSpacing : 0;
        const x = f.x + (before ? resources.measurer.width(before, f.font) : 0) + spaces;
        const word = match[0].replace(/\s+$/, ' ');
        // A space alone too, where a stretch starts with one: it shows nothing, and a reader takes it for the gap between two words.
        ops += `1 0 ${slant} 1 ${num(x)} ${num(height - line.baseline)} Tm ${kernedText(font, word, !!f.font.kern)}\n`;
      }
      ops += bold ? 'ET Q\n' : 'ET\n';
      const rule = (y: number) => (ops += `${rgb(f.props.color)} rg ${rect(f.x, y, f.width, Math.max(0.5, size * 0.05))} f\n`);
      if (f.props.underline) rule(line.baseline + size * 0.1);
      if (f.props.strike) rule(line.baseline - size * 0.3);
    };
    for (const { band, part, kind, id } of bands) {
      /** The element the text of a paragraph of the band goes in: none for a header or a footer, which are artifacts. */
      const leaf = (para: number) => (kind === 'body' ? tree.paragraph(para) : kind === 'note' ? tree.note(id!, para) : kind === 'box' ? tree.box(id!, para) : undefined);
      artifact();
      // A text box: what fills it and the line round it, under its text.
      const frame = (band as TextBoxBand).frame;
      if (frame) {
        const { look } = band as TextBoxBand;
        if (look.fill) ops += `${rgb(look.fill)} rg ${rect(frame.x, frame.y, frame.width, frame.height)} f\n`;
        if (look.line) ops += `q ${rgb(look.line.color)} RG ${num(look.line.width)} w ${rect(frame.x, frame.y, frame.width, frame.height)} S Q\n`;
      }
      // The pictures that go under the text first; the ones over it, once it is drawn.
      for (const float of band.floats) if (float.behind) picture(float.xml, float.x, float.y, float.width, float.height, float.part, leaf(float.para));
      artifact();
      for (const cell of band.cells) {
        if (cell.shade) ops += `${rgb(cell.shade)} rg ${rect(cell.x, cell.y, cell.width, cell.height)} f\n`;
      }
      for (const cell of band.cells) {
        const lines = boxLines(cell);
        const { x, y, width: w, height: h } = cell;
        if (lines.top) ops += stroke(lines.top, x, y, x + w, y);
        if (lines.bottom) ops += stroke(lines.bottom, x, y + h, x + w, y + h);
        if (lines.left) ops += stroke(lines.left, x, y, x, y + h);
        if (lines.right) ops += stroke(lines.right, x + w, y, x + w, y + h);
      }
      // The line round a table whose cells stand apart.
      for (const { x, y, width: w, height: h, lines } of (band as LayoutPage).frames ?? []) {
        if (lines.top) ops += stroke(lines.top, x, y, x + w, y);
        if (lines.bottom) ops += stroke(lines.bottom, x, y + h, x + w, y + h);
        if (lines.left) ops += stroke(lines.left, x, y, x, y + h);
        if (lines.right) ops += stroke(lines.right, x + w, y, x + w, y + h);
      }
      for (const rule of (band as LayoutPage).rules ?? []) ops += stroke(COLUMN_RULE, rule.x, rule.top, rule.x, rule.bottom);
      for (const notesRule of noteRules(band as LayoutPage)) ops += `0 0 0 rg ${rect(notesRule.x, notesRule.y, notesRule.width, notesRule.height)} f\n`;
      for (const line of band.lines) {
        const seen = `${kind}:${id ?? ''}:${line.para}:${line.start}`;
        const owner = told.has(seen) ? undefined : leaf(line.para);
        told.add(seen);
        const box = line.turn && line.cell !== undefined ? band.cells[line.cell] : undefined;
        if (line.turn && box) {
          // Text set vertically: cut to its cell, and turned about its corner. PDF turns the other way, its y going up.
          const a = line.turn.x;
          const b = height - line.turn.y;
          const turn = line.turn.angle < 0 ? `0 1 -1 0 ${num(a + b)} ${num(b - a)}` : `0 -1 1 0 ${num(a - b)} ${num(b + a)}`;
          ops += `q ${rect(box.x, box.y, box.width, box.height)} W n ${turn} cm\n`;
        }
        if (line.label) {
          tag(kind === 'body' && owner ? (tree.label(line.para) ?? owner) : owner);
          text(line.label, line);
        }
        for (const f of line.fragments) {
          const element = ownerOf(f, owner);
          if (f.kind !== 'object') tag(element);
          if (f.kind === 'text') text(f, line);
          // The number of a note: smaller, and raised.
          else if (f.mark)
            text(
              { ...f, kind: 'text', text: f.mark.text, font: f.mark.font, wordSpacing: 0, props: { ...f.props, underline: false, strike: false, highlight: '' } },
              { ...line, baseline: line.baseline - f.mark.rise },
            );
          else if (f.leader) text({ ...f, kind: 'text', ...f.leader, wordSpacing: 0 }, line);
          else if (f.kind === 'object' && f.width > 0) picture(f.props.object, f.x, line.baseline - f.ascent, f.width, f.ascent, part, element);
          // The whole of an entry of a table of contents is its link: its dots and its page too. A turned one is not marked.
          if (f.kind !== 'break' && f.width > 0 && !line.turn) noteLink(f, line, element === owner ? undefined : element);
          const mark = !part && f.kind === 'object' && f.props.anchor ? /<w:bookmarkStart\b[^>]*\bw:name="([^"]*)"/.exec(f.props.object)?.[1] : undefined;
          if (mark !== undefined && !bookmarks.has(mark)) bookmarks.set(mark, { page: pageIndex, y: line.y });
        }
        close();
        if (line.turn && box) ops += 'Q\n';
      }
      for (const float of band.floats) if (!float.behind) picture(float.xml, float.x, float.y, float.width, float.height, float.part, leaf(float.para));
    }
    close();
    return ops;
  };

  const pagesId = out.reserve();
  const resourcesId = out.reserve();
  // A page says which links it has, and a link to a bookmark says which page it is on: the pages are numbered before they are written.
  const pageIds = layout.pages.map(() => out.reserve());
  const drawn = layout.pages.map((page, index) => {
    // Where the pictures of a band live is said by its floats' own part: the first page may have a header of its own.
    const bands: PageBand[] = [];
    // Text boxes under the text first, the others over it once it is drawn. One in a header is part of it.
    const boxKind = (box: TextBoxBand) => (tree.readsBox(box.id) ? 'box' : 'artifact');
    for (const box of page.textBoxes ?? []) if (box.behind) bands.push({ band: box, part: box.part, kind: boxKind(box), id: box.id });
    if (page.header) bands.push({ band: page.header, part: page.header.part ?? 'header', kind: 'artifact' });
    bands.push({ band: page, kind: 'body' });
    if (page.footer) bands.push({ band: page.footer, part: page.footer.part ?? 'footer', kind: 'artifact' });
    for (const note of page.endnotes?.notes ?? []) bands.push({ band: note, part: note.part, kind: 'note', id: `endnote:${note.id}` });
    for (const note of page.footnotes?.notes ?? []) bands.push({ band: note, part: note.part, kind: 'note', id: note.id });
    for (const box of page.textBoxes ?? []) if (!box.behind) bands.push({ band: box, part: box.part, kind: boxKind(box), id: box.id });
    links = [];
    pageIndex = index;
    ({ width, height } = sizeOf(index));
    return { content: out.deflated('<< >>', latin1(pageContent(bands))), links };
  });
  drawn.forEach(({ content, links: boxes }, index) => {
    ({ width, height } = sizeOf(index));
    const annots: number[] = [];
    for (const box of boxes) {
      const target = box.anchor === undefined ? undefined : bookmarks.get(box.anchor);
      // Where it goes: the top of the line of its bookmark, or an address for the reader to open.
      const action =
        box.href !== undefined ? `/A << /S /URI /URI ${uriString(box.href)} >>` : target ? `/Dest [${pageIds[target.page]} 0 R /XYZ 0 ${num(sizeOf(target.page).height - target.y)} null]` : undefined;
      if (!action) continue;
      const rect = `[${num(box.x)} ${num(height - box.y - box.height)} ${num(box.x + box.width)} ${num(height - box.y)}]`;
      const id = out.reserve();
      // The element of its text names it, and it says where it goes.
      const tagged = box.element ? ` /StructParent ${tree.link(box.element, index, id, pageIds.length)} /Contents ${textString(box.href ?? box.anchor ?? '')}` : '';
      annots.push(out.write(id, `<< /Type /Annot /Subtype /Link /Rect ${rect} /Border [0 0 0]${tagged} ${action} >>`));
    }
    const list = annots.length ? ` /Annots [${annots.map((id) => `${id} 0 R`).join(' ')}]` : '';
    // Tab goes through the links in the order of the tree.
    out.write(
      pageIds[index],
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(width)} ${num(height)}] /Resources ${resourcesId} 0 R /Contents ${content} 0 R${list} /StructParents ${index} /Tabs /S >>`,
    );
  });

  for (const font of fonts.values()) {
    if (!font.file) {
      out.write(font.id, `<< /Type /Font /Subtype /Type1 /BaseFont /${font.standard} /Encoding /WinAnsiEncoding >>`);
      continue;
    }
    const { bytes, font: tt, used } = font.file;
    const scale = 1000 / tt.unitsPerEm;
    const units = (value: number) => Math.round(value * scale);
    const base = `DX${font.name}+Embedded`;
    // Only the glyphs the document uses go in; a font that cannot be cut down goes whole, as does one in CFF.
    const file = tt.cff
      ? out.deflated('<< /Subtype /OpenType >>', cffByGlyph(bytes))
      : (() => {
          const cut = subsetTrueType(bytes, used.keys()) ?? bytes;
          return out.deflated(`<< /Length1 ${cut.length} >>`, cut);
        })();
    const descriptor = out.add(
      `<< /Type /FontDescriptor /FontName /${base} /Flags ${tt.italicAngle ? 68 : 4} /FontBBox [${tt.bbox.map(units).join(' ')}] /ItalicAngle ${num(tt.italicAngle)}` +
        ` /Ascent ${units(tt.ascent)} /Descent ${units(tt.descent)} /CapHeight ${units(tt.capHeight)} /StemV 80 /${tt.cff ? 'FontFile3' : 'FontFile2'} ${file} 0 R >>`,
    );
    const glyphs = [...used.keys()].sort((a, b) => a - b);
    const widths = glyphs.map((glyph) => `${glyph} [${units(tt.advance(glyph))}]`).join(' ');
    const cid = out.add(
      `<< /Type /Font /Subtype /${tt.cff ? 'CIDFontType0' : 'CIDFontType2'} /BaseFont /${base} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >>` +
        ` /FontDescriptor ${descriptor} 0 R /DW 1000 /W [${widths}]${tt.cff ? '' : ' /CIDToGIDMap /Identity'} >>`,
    );
    // What each glyph stands for, so the text can be searched and copied.
    const pairs = glyphs.map((glyph) => {
      const code = used.get(glyph)!;
      const utf16 = code > 0xffff ? hex(0xd800 + ((code - 0x10000) >> 10), 4) + hex(0xdc00 + ((code - 0x10000) & 0x3ff), 4) : hex(code, 4);
      return `<${hex(glyph, 4)}> <${utf16}>`;
    });
    let map =
      '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
    for (let i = 0; i < pairs.length; i += 100) {
      const group = pairs.slice(i, i + 100);
      map += `${group.length} beginbfchar\n${group.join('\n')}\nendbfchar\n`;
    }
    map += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
    const toUnicode = out.deflated('<< >>', latin1(map));
    out.write(font.id, `<< /Type /Font /Subtype /Type0 /BaseFont /${base} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${toUnicode} 0 R >>`);
  }

  const fontList = [...fonts.values()].map((font) => `/${font.name} ${font.id} 0 R`).join(' ');
  const imageList = [...images.values()]
    .filter((image) => image !== null)
    .map((image) => `/${image.name} ${image.id} 0 R`)
    .join(' ');
  out.write(resourcesId, `<< /Font << ${fontList} >> /XObject << ${imageList} >> >>`);
  out.write(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  const structure = tree.write(
    () => out.reserve(),
    (id, dict) => out.write(id, dict),
    pageIds,
    textString,
  );
  const headings = doc ? writeOutlines(out, doc, layout, pageIds) : 0;
  const language = (resources.language ?? (doc && documentLanguage(doc)))?.replace(/[^A-Za-z0-9-]/g, '');
  const { title } = resources;
  // What a checker can tell of PDF/UA: a title, a language, every font in the file, every picture described.
  const universal = !!doc && !!title && !!language && !undescribed && [...fonts.values()].every((font) => font.file);
  const metadata = out.add('<< /Type /Metadata /Subtype /XML >>', new TextEncoder().encode(xmp(title, language, universal)));
  const root = out.add(
    `<< /Type /Catalog /Pages ${pagesId} 0 R /MarkInfo << /Marked true >> /StructTreeRoot ${structure} 0 R /Metadata ${metadata} 0 R` +
      (language ? ` /Lang (${language})` : '') +
      // The title, not the name of the file, at the top of the reader's window.
      (title ? ' /ViewerPreferences << /DisplayDocTitle true >>' : '') +
      (headings ? ` /Outlines ${headings} 0 R` : '') +
      ' >>',
  );
  const info = out.add(`<< /Producer (Rebodocs)${title ? ` /Title ${textString(title)}` : ''} >>`);
  return out.finish(root, info);
}
