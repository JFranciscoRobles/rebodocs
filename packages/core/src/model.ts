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
  /**
   * Set on text put in or taken out while changes were tracked: it stays in
   * the document, marked, until the change is accepted or rejected. Text
   * taken out is still there, struck through. See `revisions.ts`.
   */
  revision?: '' | 'insert' | 'delete';
  /** Who made the change, and when, as an ISO date. */
  revisionAuthor?: string;
  revisionDate?: string;
  /**
   * On text taken out that someone else had put in, while both changes wait:
   * who put it in, and when. As in Word, it is two changes, each to accept or
   * reject on its own.
   */
  insertedBy?: string;
  insertedDate?: string;
  /**
   * Set when the change is half of a move, as Word tracks text moved: the
   * name both halves share, the place it left (taken out) and the one it went
   * to (put in). Accepting or rejecting either half decides both.
   */
  revisionMove?: string;
  /** Set when the formatting of the text was changed while changes were tracked: who, when, and what it was before. */
  formatChange?: FormatChange<RunFormat>;
}

/** A change of formatting, kept to be accepted or rejected as Word keeps one: who made it, when, and the formatting before it. */
export interface FormatChange<T> {
  author: string;
  date?: string;
  /** The formatting it had: what rejecting the change gives back. What it leaves out was not set. */
  before: T;
}

/** What of a run's properties is its formatting: what a change of formatting is about. */
export const RUN_FORMAT = ['bold', 'italic', 'underline', 'strike', 'fontSize', 'fontFamily', 'color', 'highlight'] as const;
export type RunFormat = Pick<RunProps, (typeof RUN_FORMAT)[number]>;

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

/**
 * A tab stop: where the text after a tab starts ('left'), ends ('right'), is
 * centred ('center') or has its decimal point ('decimal'); a 'bar' one is a
 * line down the paragraph, not a stop. The gap of the tab may be filled with
 * a leader: dots, hyphens, a line.
 */
export interface TabStop {
  /** Points from the left edge of the text. */
  pos: number;
  align: 'left' | 'center' | 'right' | 'decimal' | 'bar';
  leader?: 'dot' | 'hyphen' | 'underscore' | 'heavy' | 'middleDot';
}

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
  /**
   * The paragraph's tab stops, its style's among them, from left to right.
   * Past the last one, tabs go to the default stops of the document.
   */
  tabs?: TabStop[];
  /**
   * Set when the mark that ends the paragraph was put in or taken out while
   * changes were tracked: a paragraph made by Enter, or one joined to the
   * next, which shows apart until the change is accepted.
   */
  markRevision?: '' | 'insert' | 'delete';
  markAuthor?: string;
  markDate?: string;
  /** Set when the formatting of the paragraph was changed while changes were tracked: who, when, and what it was before. */
  formatChange?: FormatChange<ParagraphFormat>;
}

/** What of a paragraph's properties is its formatting. */
export const PARAGRAPH_FORMAT = [
  'align',
  'spacingBefore',
  'spacingAfter',
  'lineHeight',
  'indentLeft',
  'indentRight',
  'indentFirstLine',
  'pageBreakBefore',
  'keepNext',
  'keepLines',
  'widowControl',
  'numId',
  'listLevel',
  'styleId',
  'leaderTab',
  'tabs',
] as const;
export type ParagraphFormat = Pick<ParagraphProps, (typeof PARAGRAPH_FORMAT)[number]>;

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

export type BorderStyle = 'single' | 'double' | 'dashed' | 'dotted';

/** A line along one side of a table cell. */
export interface Border {
  /** Thickness of the line, in points; a double line is two of them with as much room between. */
  width: number;
  /** Hex RGB without '#'. */
  color: string;
  style: BorderStyle;
}

/** The lines a cell is drawn with, side by side; a side without one has none. */
export interface CellLines {
  top?: Border;
  right?: Border;
  bottom?: Border;
  left?: Border;
}

/** The line a cell with borders and nothing more said about them is drawn with. */
export const DEFAULT_BORDER: Border = { width: 0.5, color: '000000', style: 'single' };

export interface TableCell {
  /** Identifies the cell inside its row for as long as it exists; paragraphs point at it by this. */
  id: number;
  /** Grid columns the cell covers. */
  span: number;
  /** A cell merged with the ones below it ('start') or with the one above ('continue'). */
  merge?: 'start' | 'continue';
  borders: boolean;
  /**
   * The line of each side, when they are not all the plain one `borders`
   * stands for: the colours, thicknesses and kinds of line a file gave them.
   */
  lines?: CellLines;
  /** Colour behind the cell, as hex RGB without '#'. */
  shade?: string;
  /** Where its text sits when the cell is taller than it: at the top unless this says otherwise. */
  valign?: 'center' | 'bottom';
  /**
   * Text set vertically: read from the bottom up ('up', the first line at the
   * left), or from the top down ('down', the first line at the right). Its
   * lines are as long as the row is tall; the row does not grow for them.
   */
  direction?: 'up' | 'down';
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
  /** Minimum height, in points; the height it has whatever it holds when `exact`. */
  height: number;
  exact?: boolean;
  /** True for a row that must stay whole on one page. Rows are broken across pages otherwise, as in Word. */
  cantSplit?: boolean;
  /** A heading row: one of the first rows of the table, shown again at the top of every page the table goes on to. */
  header?: boolean;
  cells: TableCell[];
  /** Set for a row put in or taken out while changes were tracked: it stays, marked, until the change is accepted or rejected. */
  revision?: RowRevision;
}

/** A row put in or taken out, by whom and when: one change, decided whole. */
export interface RowRevision {
  type: 'insert' | 'delete';
  author: string;
  date?: string;
}

/** A table that is not in the run of the text but beside it, the text going round it. */
export interface TableFloat {
  /** Where it goes across the text area: to one side or the other, or this far from its left edge. */
  align?: 'left' | 'center' | 'right';
  x: number;
  /** How far down from the top of the paragraph after it. */
  y: number;
  /** The room kept clear around it. */
  gapLeft: number;
  gapRight: number;
  gapTop: number;
  gapBottom: number;
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
  /** Room between the cells, which then each have their own borders; none when the cells touch. */
  spacing?: number;
  /** Set for a table the text goes round. */
  float?: TableFloat;
  /**
   * The cell of another table this one is inside, for a table in a table. Its
   * paragraphs come among those of that cell, and point at its own cells.
   */
  parent?: CellRef;
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

/**
 * The cell of table `table` that `ref` is in: `ref` itself when it is one of
 * that table's, the cell its table is inside when it is a table in a table, and
 * so on up; undefined when it is in none of that table's cells.
 */
export function cellOfTable(tables: Table[] | undefined, ref: CellRef | undefined, table: number): CellRef | undefined {
  for (let at = ref, depth = 0; at && depth < 32; at = tables?.[at.table]?.parent, depth++) if (at.table === table) return at;
  return undefined;
}

/** Whether `ref` is cell `cell` or inside a table in it, however deep. */
export function inCell(tables: Table[] | undefined, ref: CellRef | undefined, cell: CellRef): boolean {
  return sameCell(cellOfTable(tables, ref, cell.table), cell);
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
  /**
   * Set on the last paragraph of a section that is not the last one: how the
   * section it ends is set out. As in Word, the mark that ends the paragraph
   * ends the section; the last section's own are the document's.
   */
  section?: Section;
}

/** How the text of a section is set in columns, as in a newspaper: down one, then down the next. */
export interface Columns {
  /** How many; 1 when the text runs the whole width. */
  count: number;
  /** Room between two columns, in points. */
  space: number;
  /** Each column's width and the room after it, when they are not all as wide. */
  widths?: { width: number; space: number }[];
  /** A line down the middle of the room between two columns. */
  separator?: boolean;
}

/** Where a section starts: on a new page (an odd or an even one, maybe), in the next column, or right where the one before ends. */
export type SectionStart = 'nextPage' | 'continuous' | 'nextColumn' | 'evenPage' | 'oddPage';

/** How a stretch of the document is set out: its page, its columns and where it starts. */
export interface Section {
  page: PageSetup;
  columns?: Columns;
  /** 'nextPage' when not said. */
  start?: SectionStart;
  /**
   * True for a section that shows no header, or no footer: neither it nor any
   * before it has one, as the first pages of a document read from a file may
   * not. The others show the document's.
   */
  noHeader?: boolean;
  noFooter?: boolean;
  /**
   * The section's own header and footer, when it does not show the document's:
   * the last section's, which every section without its own shows.
   */
  header?: Story;
  footer?: Story;
  /** Set when the first page of the section has a header and a footer to itself, as `Doc.firstPage` for the last section. */
  firstPage?: { header?: Story; footer?: Story };
  /** The section's own properties as the file had them, which export writes back with what changed. */
  xml?: string;
}

/** The columns of a section whose text runs the whole width. */
export const ONE_COLUMN: Columns = { count: 1, space: 36 };

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

/**
 * A note at the foot of the page its reference is on. The reference is a run
 * of the text holding the `w:footnoteReference` that names it by `id`; the
 * note's own text starts with a `w:footnoteRef`, which shows its number.
 */
/**
 * The text of a text box: a shape drawn on the page, floating or in a line,
 * with paragraphs of its own. The shape is the object of a run of the text;
 * `id` is the one its drawing says (`wp:docPr`), by which each finds the other.
 */
export interface TextBox extends Story {
  id: string;
}

export interface Footnote extends Story {
  id: string;
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
  /** The page of the last section, which is the whole document's when it has only one. */
  page: PageSetup;
  /** The columns of the last section; one when not said. Paragraphs that end the sections before say theirs. */
  columns?: Columns;
  /** Where the last section starts, when the document has others before it. */
  sectionStart?: SectionStart;
  /** Whether the last section shows no header or footer: see `Section`. */
  noHeader?: boolean;
  noFooter?: boolean;
  paragraphs: Paragraph[];
  /** The tables the paragraphs' `cell` refer to. */
  tables?: Table[];
  /**
   * The version of Word whose layout rules the file asks for (`compatibilityMode`).
   * From 15 on, justified lines may shrink their spaces to take one more word.
   */
  compatMode?: number;
  /** Points between the default tab stops, which tabs go to past a paragraph's own; half an inch when not said. */
  defaultTabStop?: number;
  /** The header and the footer of the last section, which those before it show too unless they have their own. */
  header?: Story;
  footer?: Story;
  /**
   * Set when the first page of the last section has a header and a footer to
   * itself (a "different first page" in Word): what it shows in place of the
   * ones above, which may be nothing. In a document of one section, the first page.
   */
  firstPage?: { header?: Story; footer?: Story };
  /** The notes at the foot of the pages, by their id; those no reference names are not shown, and not written. */
  footnotes?: Footnote[];
  /** The text of the text boxes of the document, by the id of their drawing; one no drawing names is not shown, and not written. */
  textBoxes?: TextBox[];
  /** The paragraph the line above the notes of a page is drawn in, as the file has it; one of the document's look when not said. */
  footnoteSeparator?: Paragraph;
  /** Whether what is typed and taken out is kept as changes to accept or reject, as Word's "Track changes". */
  trackRevisions?: boolean;
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

export type ResolvedRunProps = Required<Omit<RunProps, 'formatChange'>> & Pick<RunProps, 'formatChange'>;
export type ResolvedParagraphProps = Required<Omit<ParagraphProps, 'formatChange'>> & Pick<ParagraphProps, 'formatChange'>;

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
  revision: '',
  revisionAuthor: '',
  revisionDate: '',
  insertedBy: '',
  insertedDate: '',
  revisionMove: '',
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
  tabs: [],
  markRevision: '',
  markAuthor: '',
  markDate: '',
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
  return (Object.keys(ra) as (keyof RunProps)[]).every((k) => ra[k] === rb[k]) && ra.formatChange === rb.formatChange;
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
