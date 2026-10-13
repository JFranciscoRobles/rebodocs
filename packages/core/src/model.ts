// Document model. All lengths are in points (1/72 in).

import type { DocxSource } from './docx/source';
import type { Numbering } from './numbering';

export interface RunProps {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontSize?: number;
  fontFamily?: string;
  /** Hex RGB without '#'. */
  color?: string;
  /** Highlight behind the text, as hex RGB without '#'. Word only has the colours of `HIGHLIGHT_COLORS`. */
  highlight?: string;

  // The fields below carry OOXML the model does not interpret, so that a
  // document opened from a DOCX can be written back without losing it.

  /** Inner XML of the run's original w:rPr. */
  opaque?: string;
  /** Inline wrappers around the run (hyperlink, tracked insertion...): open XML + WRAP_SEPARATOR + close XML. */
  wrap?: string;
  /** Raw paragraph-level XML of an object; every character of such a run stands for one copy of it. */
  object?: string;
  /** True for objects that take no space (bookmarks, field marks, comment ranges...). */
  anchor?: boolean;
  objectWidth?: number;
  objectHeight?: number;
  /** For the result of a field whose value depends on the page: 'PAGE' or 'NUMPAGES'. */
  field?: string;
}

/** The highlight colours Word offers, in the order of its palette. */
export const HIGHLIGHT_COLORS = [
  'FFFF00', '00FF00', '00FFFF', 'FF00FF', '0000FF', 'FF0000', '000080', '008080',
  '008000', '800080', '800000', '808000', '808080', 'C0C0C0', '000000',
];

export const WRAP_SEPARATOR = '\u0001';
/** Character that stands for a visible object. */
export const OBJECT_CHAR = '\uFFFC';
/** Character that stands for an anchor. */
export const ANCHOR_CHAR = '\u2060';

/**
 * A span of uniformly formatted text. Three control characters are part of the
 * text: '\t' (tab), '\n' (line break inside the paragraph), '\f' (page break).
 */
export interface Run {
  text: string;
  props: RunProps;
}

export type Align = 'left' | 'center' | 'right' | 'justify';

export interface ParagraphProps {
  align?: Align;
  spacingBefore?: number;
  spacingAfter?: number;
  /** Multiplier over the natural line height of the font. */
  lineHeight?: number;
  indentLeft?: number;
  indentRight?: number;
  /** Added to indentLeft on the first line; negative for a hanging indent. */
  indentFirstLine?: number;
  pageBreakBefore?: boolean;
  /** Keep the paragraph on the same page as the start of the next one. */
  keepNext?: boolean;
  /** Keep all the lines of the paragraph on one page. */
  keepLines?: boolean;
  /** Never leave the first or the last line of the paragraph alone on a page. On unless switched off, as in Word. */
  widowControl?: boolean;
  /** List the paragraph belongs to, an id in `Doc.numbering`; 0 for none. */
  numId?: number;
  /** Level inside that list, from 0. */
  listLevel?: number;
  /** The paragraph style the paragraph has, an id among `paragraphStyles(doc)`; '' for the default one. */
  styleId?: string;
  /**
   * Where, in points from the left edge of the text, what follows a tab ends:
   * a right tab stop, with dots leading up to it, as in the entries of a
   * table of contents. 0 for none.
   */
  leaderTab?: number;
}

/** A named look for a paragraph. Its formatting is complete: nothing of what the paragraph had shows through. */
export interface ParagraphStyle {
  id: string;
  /** The name shown to the person. */
  name: string;
  /** The name Word knows the style by, which is what makes it a title or a heading there. */
  wordName?: string;
  paragraph: ParagraphProps;
  /** The font size, weight, slant and colour of its text, and its font when the style has one. */
  run: RunProps;
  /** For a heading, its level from 1. */
  outlineLevel?: number;
  /** The style of the paragraph that Enter starts at the end of one of this style. */
  next?: string;
}

export interface TableCell {
  /** Identifies the cell inside its row for as long as it exists; paragraphs point at it by this. */
  id: number;
  /** Grid columns the cell covers. */
  span: number;
  /** A cell merged with the ones below it ('start') or with the one above ('continue'). */
  merge?: 'start' | 'continue';
  borders: boolean;
  /** Colour behind the cell, as hex RGB without '#'. */
  shade?: string;
  /** Thickness of the cell's top and bottom borders, in points; they take room in the row. */
  borderTop?: number;
  borderBottom?: number;
  /** Margins the cell sets for itself, over the table's. */
  padTop?: number;
  padRight?: number;
  padBottom?: number;
  padLeft?: number;
}

export interface TableRow {
  /** Identifies the row inside its table for as long as it exists. */
  id: number;
  /** Grid columns skipped before the first cell. */
  before: number;
  /** Minimum height, in points. */
  height: number;
  /** True for a row that must stay whole on one page. Rows are broken across pages otherwise, as in Word. */
  cantSplit?: boolean;
  cells: TableCell[];
}

/** The structure of a table. Its text lives in the document's paragraphs, which point at their cell. */
export interface Table {
  /** Column widths, in points. */
  columns: number[];
  /** Width as a fraction of the text area, for tables sized that way; the columns are scaled to it. */
  widthFraction?: number;
  /** False for a table that may be narrowed to fit the text area. */
  fixed: boolean;
  align: 'left' | 'center' | 'right';
  indent: number;
  /** Space between a cell's edge and its text. */
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
  rows: TableRow[];
}

export interface CellRef {
  /** Index in `Doc.tables`. */
  table: number;
  /** Ids, not positions: rows and columns can be added or removed without touching the other paragraphs. */
  row: number;
  cell: number;
}

export function sameCell(a: CellRef | undefined, b: CellRef | undefined): boolean {
  return a === b || (!!a && !!b && a.table === b.table && a.row === b.row && a.cell === b.cell);
}

/** Invariant: `runs` always has at least one run (possibly with empty text). */
export interface Paragraph {
  props: ParagraphProps;
  runs: Run[];
  /** The table cell the paragraph is in. A table's paragraphs are consecutive, row by row and cell by cell. */
  cell?: CellRef;
  /** Index of the source paragraph this one descends from, when the document came from a DOCX. */
  origin?: number;
  /**
   * What the paragraph is known by while several people work on the document
   * at once: it stays the same as the paragraphs around it come and go. Given
   * and read by @rebodocs/collab; nothing else needs it.
   */
  id?: string;
}

export interface PageSetup {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  /** Distance from the top edge of the page to the header, and from the bottom edge to the footer. */
  headerDistance?: number;
  footerDistance?: number;
}

/** Content that is laid out on its own, outside the body: a header or a footer. */
export interface Story {
  paragraphs: Paragraph[];
  tables?: Table[];
}

/** A note on a stretch of the text: a comment, in Word. */
export interface Note {
  /** What its marks in the text name it by. */
  id: string;
  author: string;
  /** When it was written, as ISO 8601. */
  date?: string;
  text: string;
  /** The colour its text is marked with, as hex RGB without '#'; the usual amber when it has none. */
  color?: string;
  /** The comment as the file had it, for as long as its text is not changed here. */
  xml?: string;
}

/** The bytes of a picture and its MIME type. */
export interface Media {
  bytes: Uint8Array;
  type: string;
}

/** Invariant: `paragraphs` always has at least one paragraph. */
export interface Doc {
  page: PageSetup;
  paragraphs: Paragraph[];
  /** The tables the paragraphs' `cell` refer to. */
  tables?: Table[];
  /**
   * The version of Word whose layout rules the file asks for (`compatibilityMode`).
   * From 15 on, justified lines may shrink their spaces to take one more word.
   */
  compatMode?: number;
  /** Shown on every page; read from the file and not editable. */
  header?: Story;
  footer?: Story;
  /**
   * Set when the first page has a header and a footer to itself (a "different
   * first page" in Word): what it shows in place of the ones above, which may
   * be nothing. They are shown as the file has them, and not edited.
   */
  firstPage?: { header?: Story; footer?: Story };
  /** Pictures put in since the document was made or opened, by the key their drawing names. */
  media?: Record<string, Media>;
  /** The notes on stretches of the text, which holds the marks of where each one is. See `notes.ts`. */
  notes?: Note[];
  /** The paragraph styles on offer, the default one first; without them, a standard set. */
  styles?: ParagraphStyle[];
  /** List definitions the paragraphs' `numId` refer to. */
  numbering?: Numbering;
  /** The DOCX package the document was read from; export rewrites only what changed in it. */
  source?: DocxSource;
}

export interface Position {
  para: number;
  offset: number;
}

export interface Range {
  from: Position;
  to: Position;
}

export type ResolvedRunProps = Required<RunProps>;
export type ResolvedParagraphProps = Required<ParagraphProps>;

export const DEFAULT_PAGE: PageSetup = {
  width: 612,
  height: 792,
  marginTop: 72,
  marginRight: 72,
  marginBottom: 72,
  marginLeft: 72,
};

export const DEFAULT_RUN: ResolvedRunProps = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  fontSize: 11,
  fontFamily: 'Arial',
  color: '000000',
  highlight: '',
  opaque: '',
  wrap: '',
  object: '',
  anchor: false,
  objectWidth: 0,
  objectHeight: 0,
  field: '',
};

export const DEFAULT_PARAGRAPH: ResolvedParagraphProps = {
  align: 'left',
  spacingBefore: 0,
  spacingAfter: 8,
  lineHeight: 1.15,
  indentLeft: 0,
  indentRight: 0,
  indentFirstLine: 0,
  pageBreakBefore: false,
  keepNext: false,
  keepLines: false,
  widowControl: true,
  numId: 0,
  listLevel: 0,
  styleId: '',
  leaderTab: 0,
};

/** Drops keys whose value is undefined so spreads never clobber defaults. */
export function defined<T extends object>(obj: T): T {
  const out = {} as T;
  for (const key of Object.keys(obj) as (keyof T)[]) {
    if (obj[key] !== undefined) out[key] = obj[key];
  }
  return out;
}

export function resolveRun(props: RunProps): ResolvedRunProps {
  return { ...DEFAULT_RUN, ...defined(props) };
}

export function resolveParagraph(props: ParagraphProps): ResolvedParagraphProps {
  return { ...DEFAULT_PARAGRAPH, ...defined(props) };
}

export function runPropsEqual(a: RunProps, b: RunProps): boolean {
  const ra = resolveRun(a);
  const rb = resolveRun(b);
  return (Object.keys(ra) as (keyof RunProps)[]).every((k) => ra[k] === rb[k]);
}

export function paragraphLength(p: Paragraph): number {
  let n = 0;
  for (const r of p.runs) n += r.text.length;
  return n;
}

/** Text with one character per offset, objects included as placeholder characters. */
export function paragraphText(p: Paragraph): string {
  return p.runs.map((r) => r.text).join('');
}

/** Text as a reader sees it, without object placeholders. */
export function plainText(runs: Run[]): string {
  return runs.map((r) => (r.props.object ? '' : r.text)).join('');
}

export function createParagraph(text = '', runProps: RunProps = {}, props: ParagraphProps = {}): Paragraph {
  return { props, runs: [{ text, props: runProps }] };
}

export function createDoc(paragraphs: Paragraph[] = [createParagraph()], page: PageSetup = DEFAULT_PAGE): Doc {
  return { page, paragraphs: paragraphs.length ? paragraphs : [createParagraph()] };
}

export function comparePositions(a: Position, b: Position): number {
  return a.para !== b.para ? a.para - b.para : a.offset - b.offset;
}

export function orderedRange(a: Position, b: Position): Range {
  return comparePositions(a, b) <= 0 ? { from: a, to: b } : { from: b, to: a };
}

export function docStart(): Position {
  return { para: 0, offset: 0 };
}

export function docEnd(doc: Doc): Position {
  const para = doc.paragraphs.length - 1;
  return { para, offset: paragraphLength(doc.paragraphs[para]) };
}

export function clampPosition(doc: Doc, pos: Position): Position {
  const para = Math.max(0, Math.min(pos.para, doc.paragraphs.length - 1));
  const offset = Math.max(0, Math.min(pos.offset, paragraphLength(doc.paragraphs[para])));
  return { para, offset };
}
