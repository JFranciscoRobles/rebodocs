// Layout engine: breaks paragraphs into lines and lines into pages.
// It has no DOM dependency; text metrics come from a TextMeasurer.

import { shownRevision } from './revisions';
import {
  type CellLines,
  type Columns,
  type Doc,
  type PageSetup,
  type Paragraph,
  type Run,
  type Position,
  type Range,
  type ResolvedParagraphProps,
  type ResolvedRunProps,
  type SectionStart,
  type Story,
  type Table,
  type TabStop,
  DEFAULT_BORDER,
  ONE_COLUMN,
  comparePositions,
  defined,
  inCell,
  resolveParagraph,
  sameCell,
  resolveRun,
} from './model';
import { type Anchor, type BasePart, type FootnotePart, type StoryPart, type TextBoxPart, anchoredObject } from './docx/source';
import { type TextBoxLook, textBoxId, textBoxLook, textBoxOf, textBoxPart } from './textboxes';
import { footnotePart, sectionPart, storyKind } from './stories';
import { footnoteNumbers, footnoteReferenceId, footnoteReferences, isFootnoteMark, shownFootnotes } from './footnotes';
import { type ListLabel, isSymbolFont, listLabels, symbolText } from './numbering';

export interface FontSpec {
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
}

export interface FontMetrics {
  ascent: number;
  descent: number;
}

export interface TextMeasurer {
  /** Advance width of `text` in points. */
  width(text: string, font: FontSpec): number;
  metrics(font: FontSpec): FontMetrics;
}

export interface Fragment {
  /** 'tab' is a gap, 'break' is a zero-width '\n' or '\f', 'object' is a box (zero-width for anchors). */
  kind: 'text' | 'tab' | 'break' | 'object';
  text: string;
  /** Offsets inside the paragraph. */
  start: number;
  end: number;
  /** Page coordinates. */
  x: number;
  width: number;
  props: ResolvedRunProps;
  font: FontSpec;
  ascent: number;
  descent: number;
  /** Extra advance per space, used by justified lines. */
  wordSpacing: number;
  /** For a tab that leads up to a right tab stop: the dots drawn in its gap, and where. */
  leader?: { text: string; x: number; width: number };
  /** For the reference to a note at the foot of the page, or the mark its text starts with: the number shown, raised `rise` above the baseline, in `font`. */
  mark?: NoteMark;
}

/** The number of a note as its reference shows it. */
export interface NoteMark {
  text: string;
  font: FontSpec;
  rise: number;
}

export interface Line {
  index: number;
  page: number;
  para: number;
  start: number;
  end: number;
  /** Page coordinates of the line box; `width` excludes trailing spaces. */
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
  fragments: Fragment[];
  /** The list label, on the first line of a list paragraph. It is not part of the text: its offsets are 0. */
  label?: Fragment;
  lastInParagraph: boolean;
  /** For a line inside a table: index of its cell in the `cells` of its page. */
  cell?: number;
  /** Set for a line of text set vertically in a cell: it is laid out level, as given here, and turned on the page. */
  turn?: Turn;
  /** The line box this line was placed from: the same object on every layout until its paragraph changes. */
  raw: object;
}

/**
 * A quarter turn about a point of the page: -90 turns a line to read from the
 * bottom up, 90 from the top down. The point stays where it is.
 */
export interface Turn {
  angle: 90 | -90;
  x: number;
  y: number;
}

/** Where a point of a turned line's own layout is on the page. */
export function turnPoint(turn: Turn, x: number, y: number): { x: number; y: number } {
  const dx = x - turn.x;
  const dy = y - turn.y;
  return turn.angle < 0 ? { x: turn.x + dy, y: turn.y - dx } : { x: turn.x - dy, y: turn.y + dx };
}

/** Where a point of the page is in a turned line's own layout. */
export function unturnPoint(turn: Turn, x: number, y: number): { x: number; y: number } {
  const dx = x - turn.x;
  const dy = y - turn.y;
  return turn.angle < 0 ? { x: turn.x - dy, y: turn.y + dx } : { x: turn.x + dy, y: turn.y - dx };
}

/** Where a box of a turned line's own layout is on the page. */
export function turnRect<R extends { x: number; y: number; width: number; height: number }>(turn: Turn | undefined, rect: R): R {
  if (!turn) return rect;
  const a = turnPoint(turn, rect.x, rect.y);
  const b = turnPoint(turn, rect.x + rect.width, rect.y + rect.height);
  return { ...rect, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

/** The turn of a line moved by `dx` and `dy` with it, for a line that has one. */
function movedTurn(turn: Turn | undefined, dx: number, dy: number): { turn?: Turn } {
  return turn ? { turn: { ...turn, x: turn.x + dx, y: turn.y + dy } } : {};
}

/** The part of a table cell that is on one page. A cell merged down is one box as tall as its rows. */
export interface CellBox {
  /** The line of each side, when the cell's are not the plain ones `borders` stands for. */
  lines?: CellLines;
  x: number;
  y: number;
  width: number;
  height: number;
  table: number;
  row: number;
  cell: number;
  borders: boolean;
  /** Colour behind the cell, as hex RGB. */
  shade?: string;
}

/** A floating picture, placed where its anchor says; text does not make room for it. */
export interface FloatBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The object's XML, from which its picture is found. */
  xml: string;
  /** Where its anchor is in the text it belongs to: its paragraph, and its place in it. */
  para: number;
  offset: number;
  /** True when it is drawn under the text; over it otherwise. */
  behind?: boolean;
  /** Where the object lives when it is not in the body. */
  part?: StoryPart;
  /** True when the vertical position is measured from the page, not from the text around the anchor. */
  fixed?: boolean;
}

/** A text box on a page: its frame, how it looks, and its text set out inside it, in page coordinates. */
export interface TextBoxBand extends Band {
  id: string;
  part: TextBoxPart;
  frame: { x: number; y: number; width: number; height: number };
  look: TextBoxLook;
  /** True when it is drawn under the text and not over it. */
  behind?: boolean;
}

/** The notes at the foot of a page: the line above them, and the stretch of each that is on the page, in order. */
export interface FootnoteArea {
  rule: { x: number; y: number; width: number; height: number };
  notes: FootnoteBand[];
}

/** The stretch of a note on a page: its lines, from `from` down its own layout, set at the foot of the page. Its paragraphs are the note's. */
export interface FootnoteBand extends Band {
  id: string;
  from: number;
  part: FootnotePart;
}

/** A header or a footer as laid out on one page. */
export interface Band {
  lines: Line[];
  cells: CellBox[];
  floats: FloatBox[];
  /** Where its pictures live, when it is not the header or the footer every page has: the first page's own, or its section's. */
  part?: StoryPart;
}

export interface LayoutPage {
  index: number;
  lines: Line[];
  cells: CellBox[];
  floats: FloatBox[];
  header?: Band;
  footer?: Band;
  /** Index of the section the page starts in, for a document set out in several. */
  section?: number;
  /** The size and margins of the page, for a document set out in several sections: those of its section. `Layout.page` otherwise. */
  setup?: PageSetup;
  /** The parts its header and its footer are, when not the document's: its section's own, or those of the first page. */
  parts?: { header?: StoryPart; footer?: StoryPart };
  /** The notes at its foot, and the line above them. */
  footnotes?: FootnoteArea;
  /** The text boxes on it, each with its text set out inside it. */
  textBoxes?: TextBoxBand[];
  /** The lines drawn down between columns, from `top` to `bottom` at `x`. */
  rules?: { x: number; top: number; bottom: number }[];
  /** The columns of the parts of the page set out in more than one, and the lines each holds, by their `index`, from `from` up to `to`. */
  columns?: ColumnBox[];
}

/** A column on a page: where it is, and the lines in it. */
export interface ColumnBox {
  x: number;
  y: number;
  width: number;
  height: number;
  from: number;
  to: number;
}

export interface Layout {
  page: PageSetup;
  pages: LayoutPage[];
  lines: Line[];
  /** Index in `lines` of the first line of each paragraph. */
  paraFirstLine: number[];
}

export interface Rect {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A box with a plain line on every side: what a cell with borders and nothing more said about them has. */
const FOUR_LINES: CellLines = { top: DEFAULT_BORDER, right: DEFAULT_BORDER, bottom: DEFAULT_BORDER, left: DEFAULT_BORDER };

/** The lines a cell box is drawn with, side by side: its own, the plain ones of a cell with borders, or none. */
export function boxLines(box: Pick<CellBox, 'lines' | 'borders'>): CellLines {
  return box.lines ?? (box.borders ? FOUR_LINES : {});
}

/** The cell of a row that starts at grid column `column`, if one does. */
function cellStartingAt(row: Table['rows'][number] | undefined, column: number): Table['rows'][number]['cells'][number] | undefined {
  let start = row?.before ?? 0;
  for (const cell of row?.cells ?? []) {
    if (start === column) return cell;
    start += cell.span;
  }
  return undefined;
}

/** A paragraph that leaves no space above or below it: what stands for a table in a cell. */
const NO_SPACING = resolveParagraph({ spacingBefore: 0, spacingAfter: 0 });

const TAB_STOP = 36;
/**
 * Share of their width the spaces of a justified line may give up to fit more
 * text (Word 2013 and later). Measured against Word for Mac 16 on a real
 * contract: of 109 justified lines it shrank spaces by up to 24.3% and turned
 * down words that needed 24.8% or more. WordCraft uses 20%.
 */
const MAX_SPACE_SHRINK = 0.245;
/**
 * A word is only squeezed in when leaving it out would loosen the line clearly
 * more than taking it tightens it: the stretch avoided, as a share of the
 * spaces, has to be at least this many times the shrink. In the same contract
 * Word squeezed every word where that ratio was 2.1 or more and none where it
 * was 1.3 or less.
 */
const MIN_STRETCH_PER_SHRINK = 1.6;
const SHRINK_COMPAT_MODE = 15;
const EPSILON = 0.01;
const MIN_LINE_WIDTH = 10;
/**
 * Text does not go down the side of a picture in less room than this: a quarter
 * of an inch. Measured against Word, which writes in 20 points and not in 12.
 */
const MIN_WRAP_WIDTH = 18;
/**
 * How far past the foot of the page the last line may run, in points. Against
 * Word, a line that ran a point past a foot set by a footer with a picture
 * stayed on its page, and one that ran ten past it did not.
 */
const PAGE_SLACK = 1.5;
/** How far down the text steps, laid out without pages, where a page was asked to end. */
const CONTINUOUS_BREAK = 12;

export function fontOf(props: ResolvedRunProps): FontSpec {
  return { family: props.fontFamily, size: props.fontSize, bold: props.bold, italic: props.italic };
}

type PieceKind = 'word' | 'space' | 'tab' | 'break' | 'pagebreak' | 'columnbreak' | 'object';

interface Piece {
  kind: PieceKind;
  text: string;
  start: number;
  props: ResolvedRunProps;
  font: FontSpec;
  width: number;
  metrics: FontMetrics;
  /** For a tab: what fills its gap. */
  leader?: TabStop['leader'];
  mark?: NoteMark;
}

interface RawLine {
  start: number;
  end: number;
  /** Relative to the left edge of the content area. */
  x: number;
  width: number;
  ascent: number;
  descent: number;
  height: number;
  fragments: Fragment[];
  label?: Fragment;
  pageBreakAfter: boolean;
  /** Set on a line that ends in a column break: what follows goes on in the next column. */
  columnBreakAfter?: boolean;
  /** Room left empty above the line, inside its height: what it was pushed down by to clear a picture. */
  pad?: number;
  /**
   * Set on a line that shares its row with the next: the text to one side of
   * a picture, with more of it on the other. Its `height`, which is how far
   * down the next line goes, is 0, and this is how tall it is.
   */
  box?: number;
}

/**
 * What a line that starts `top` points down its paragraph has to keep clear
 * of: how far in from each edge of the text area it may run, and, when it
 * cannot be there at all, how far down it has to go first.
 */
type LineShape = (top: number, height: number, first: boolean) => { skip: number; segments: { left: number; right: number }[] };

/** The XML of a column break, as a run of its own: what is put in the text for one. */
export const COLUMN_BREAK_XML = '<w:r><w:br w:type="column"/></w:r>';

/** Whether an object of the text is a column break: a break that ends the column, kept as Word wrote it. */
export function isColumnBreak(xml: string): boolean {
  return /^<w:r\b[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>|<w:rPr\/>)?<w:br\b[^>]*\bw:type="column"[^>]*\/><\/w:r>$/.test(xml);
}

/** The numbers the references to notes, and the marks they start with, show: by the run that holds each. Set by `numberNotes`. */
const MARK_LABELS = new WeakMap<Run, string>();

/** Superscript as Word sets it: 65 % of the size, to the half point, raised by about a third of the size. Measured against Word. */
function noteMark(text: string, font: FontSpec): NoteMark {
  return { text, font: { ...font, size: Math.round(font.size * 1.3) / 2 }, rise: font.size * 0.35 };
}

/** Paragraphs with the number of each note in its references and marks, by `numberOf` the run's object. The same copy each time while the numbers stay. */
const numbered = new WeakMap<Paragraph, { key: string; copy: Paragraph }>();
function numberParagraphs(paragraphs: Paragraph[], numberOf: (xml: string) => string | undefined): Paragraph[] {
  let changed = false;
  const out = paragraphs.map((p) => {
    const labels = p.runs.map((run) => (run.props.object ? numberOf(run.props.object) : undefined));
    if (labels.every((label) => label === undefined)) return p;
    const key = labels.join('|');
    let made = numbered.get(p);
    if (made?.key !== key) {
      const runs = p.runs.map((run, i) => (labels[i] === undefined ? run : { ...run }));
      runs.forEach((run, i) => labels[i] !== undefined && MARK_LABELS.set(run, labels[i]!));
      made = { key, copy: { ...p, runs } };
      numbered.set(p, made);
    }
    changed = true;
    return made.copy;
  });
  return changed ? out : paragraphs;
}

function pieceKind(text: string): PieceKind {
  switch (text[0]) {
    case '\t':
      return 'tab';
    case '\n':
      return 'break';
    case '\f':
      return 'pagebreak';
    case ' ':
      return 'space';
    default:
      return 'word';
  }
}

function tokenize(para: Paragraph, measurer: TextMeasurer): Piece[] {
  const pieces: Piece[] = [];
  let offset = 0;
  for (const run of para.runs) {
    // A tracked change shows in the colour of who made it, underlined or struck through.
    const props = shownRevision(resolveRun(run.props));
    const font = fontOf(props);
    const metrics = measurer.metrics(font);
    if (props.object && isColumnBreak(props.object)) {
      for (let i = 0; i < run.text.length; i++) pieces.push({ kind: 'columnbreak', text: run.text[i], start: offset + i, props, font, width: 0, metrics });
      offset += run.text.length;
      continue;
    }
    const label = props.object ? MARK_LABELS.get(run) : undefined;
    if (label !== undefined) {
      // The number of a note, raised and smaller: it does not make its line any taller, as in Word.
      const mark = noteMark(label, font);
      const width = measurer.width(label, mark.font);
      for (let i = 0; i < run.text.length; i++) pieces.push({ kind: 'object', text: run.text[i], start: offset + i, props, font, width, metrics, mark });
      offset += run.text.length;
      continue;
    }
    if (props.object) {
      // One box per character; an anchor is an empty box that only holds a position.
      const box = props.anchor ? metrics : { ascent: props.objectHeight, descent: 0 };
      for (let i = 0; i < run.text.length; i++) {
        const width = props.anchor ? 0 : props.objectWidth;
        pieces.push({ kind: 'object', text: run.text[i], start: offset + i, props, font, width, metrics: box });
      }
      offset += run.text.length;
      continue;
    }
    // A word may break after a hyphen inside it, as in Word: "pre-" ends one line and "approved" starts the next.
    for (const match of run.text.matchAll(/\t|\n|\f| +|[^\t\n\f -]*[^\t\n\f -]-+(?=[^\t\n\f -])|[^\t\n\f ]+/g)) {
      const text = match[0];
      const kind = pieceKind(text);
      const width = kind === 'word' || kind === 'space' ? measurer.width(text, font) : 0;
      pieces.push({ kind, text, start: offset + match.index, props, font, width, metrics });
    }
    offset += run.text.length;
  }
  return pieces;
}

/** Groups consecutive word pieces (a word split across runs) so they never break apart. */
function groupPieces(pieces: Piece[]): Piece[][] {
  const groups: Piece[][] = [];
  for (const piece of pieces) {
    const prev = groups[groups.length - 1];
    const after = prev?.[prev.length - 1];
    // The number of a note stays with the word it follows.
    if ((piece.kind === 'word' || piece.mark) && prev && prev[0].kind === 'word' && !after!.text.endsWith('-')) prev.push(piece);
    else groups.push([piece]);
  }
  return groups;
}

function countSpaces(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) if (text[i] === ' ') n++;
  return n;
}

interface PlacedLabel {
  /** Positioned relative to the left edge of the content area, before alignment. */
  fragment: Fragment;
  /** Where the text of the first line starts. */
  textStart: number;
}

function placeLabel(
  para: Paragraph,
  pp: ResolvedParagraphProps,
  measurer: TextMeasurer,
  label: ListLabel,
  tabInterval: number,
): PlacedLabel {
  const { level } = label;
  // The label takes the paragraph's formatting, then the level's own.
  const base = resolveRun(para.runs[0].props);
  const symbol = isSymbolFont(level.run.fontFamily);
  const props = resolveRun({
    ...base,
    underline: false,
    strike: false,
    opaque: '',
    wrap: '',
    object: '',
    anchor: false,
    ...level.run,
    // Symbol fonts are not drawn: their bullets are mapped to characters of the paragraph's font.
    fontFamily: symbol ? base.fontFamily : (level.run.fontFamily ?? base.fontFamily),
  });
  const text = symbol ? symbolText(label.text, level.run.fontFamily!) : label.text;
  const font = fontOf(props);
  const metrics = measurer.metrics(font);
  const width = measurer.width(text, font);

  const origin = pp.indentLeft + pp.indentFirstLine;
  const x = level.align === 'right' ? origin - width : level.align === 'center' ? origin - width / 2 : origin;
  const end = x + width;
  let textStart = end;
  if (level.suffix === 'space') {
    textStart = end + measurer.width(' ', font);
  } else if (level.suffix === 'tab') {
    // The next stop: the hanging indent acts as one; a label that runs past it goes on to the one after.
    textStart = nextTabStop(pp, end - EPSILON, tabInterval, pp.indentFirstLine < 0 ? pp.indentLeft : undefined).pos;
  }
  const fragment: Fragment = {
    kind: 'text',
    text,
    start: 0,
    end: 0,
    x,
    width,
    props,
    font,
    ascent: metrics.ascent,
    descent: metrics.descent,
    wordSpacing: 0,
  };
  return { fragment, textStart };
}

/** What a document says about how all its paragraphs are broken into lines. */
interface LineRules {
  /** Whether justified lines may shrink their spaces to take one more word: from the layout of Word 2013 on. */
  shrinkSpaces: boolean;
  /** Points between the default tab stops. */
  tabInterval: number;
}

/**
 * The stop a tab `at` points from the left edge of the text goes to: the
 * paragraph's next one, or the hanging indent when the tab is before it on
 * the first line, or past them the next default stop.
 */
function nextTabStop(pp: ResolvedParagraphProps, at: number, interval: number, hanging?: number): TabStop {
  let stop = pp.tabs.find((tab) => tab.align !== 'bar' && tab.pos > at + EPSILON);
  if (pp.leaderTab > at + EPSILON && (!stop || pp.leaderTab < stop.pos)) stop = { pos: pp.leaderTab, align: 'right', leader: 'dot' };
  if (hanging !== undefined && hanging > at + EPSILON && (!stop || hanging < stop.pos)) stop = { pos: hanging, align: 'left' };
  if (stop) return stop;
  const step = interval > 0 ? interval : TAB_STOP;
  return { pos: (Math.floor(at / step + EPSILON) + 1) * step, align: 'left' };
}

/** What fills the gap of a tab with a leader, a character at a time. */
const LEADER_CHAR: Record<NonNullable<TabStop['leader']>, string> = { dot: '.', hyphen: '-', underscore: '_', heavy: '_', middleDot: '·' };

function breakParagraph(
  para: Paragraph,
  pp: ResolvedParagraphProps,
  contentWidth: number,
  measurer: TextMeasurer,
  listLabel: ListLabel | undefined,
  rules: LineRules,
  shape?: LineShape,
  /** Where the last line of the paragraph starts, when that is known: see `startLine`. */
  lastFrom?: number,
  /** Where in the paragraph to start: the rest of one that goes on in a column of another width. */
  from = 0,
): RawLine[] {
  const lines: RawLine[] = [];
  const pieces = from > 0 ? tokenize(para, measurer).filter((p) => p.start >= from) : tokenize(para, measurer);
  const label = from === 0 ? listLabel && placeLabel(para, pp, measurer, listLabel, rules.tabInterval) : undefined;
  let cur: Piece[] = [];
  let curWidth = 0;
  let nextOffset = from;
  let lastProps = resolveRun(para.runs[0].props);
  let endedWithBreak = false;

  /** The look of the text of the paragraph, by which the height of a line is told before it is filled: not that of a mark at its start. */
  const nominal = resolveRun((para.runs.find((run) => run.text && !run.props.object) ?? para.runs[0]).props);
  /** What the line being filled keeps clear of, worked out when it starts: pictures the text goes round. */
  let room = { left: -Infinity, right: -Infinity, pad: 0 };
  let filled = 0;
  /** The stretches of the row being filled that come after the one in hand: the other side of a picture. */
  let pending: { left: number; right: number }[] = [];
  /** The lines of the row being filled that are already made. */
  let rowStart = 0;
  const startLine = (below = 0) => {
    // More of the same row: the next stretch of it, as far down as the first.
    const next = below ? undefined : pending.shift();
    if (next) {
      room = { ...next, pad: room.pad };
      return;
    }
    // A row started again further down keeps the lines it already has, which is none.
    if (!below) rowStart = lines.length;
    pending = [];
    room = { left: -Infinity, right: -Infinity, pad: below };
    if (!shape) return;
    // As tall as a line of the paragraph's own text is: what it holds is not known yet.
    const m = measurer.metrics(fontOf(nominal));
    // What must clear a picture is the whole line, the room its line spacing leaves under the text
    // included; but of the last line of a paragraph, which has nothing of its own below it, only the text.
    // Measured against Word.
    const text = m.ascent + m.descent;
    const height = lastFrom !== undefined && nextOffset >= lastFrom ? text : Math.max(text, text * pp.lineHeight);
    for (let tries = 0; tries < 50; tries++) {
      const at = shape(filled + room.pad, height, filled === 0 && room.pad === 0);
      if (at.skip > EPSILON) {
        room.pad += at.skip;
        continue;
      }
      const [head, ...rest] = at.segments;
      room.left = head?.left ?? -Infinity;
      room.right = head?.right ?? -Infinity;
      pending = rest;
      break;
    }
  };
  startLine();

  /** Whether a picture takes room from the stretch being filled. */
  const narrowed = () => room.left > ownIndent() || room.right > pp.indentRight;
  /** How tall a line of the paragraph's own text is: how far down to look for room. */
  const rowHeight = () => {
    const m = measurer.metrics(fontOf(nominal));
    return (m.ascent + m.descent) * pp.lineHeight;
  };

  const ownIndent = () => (lines.length > 0 || from > 0 ? pp.indentLeft : label ? label.textStart : pp.indentLeft + pp.indentFirstLine);
  /** Where the line starts: at its indent, or past the picture that is in its way. */
  const indent = () => Math.max(ownIndent(), room.left);
  const avail = () => Math.max(MIN_LINE_WIDTH, contentWidth - indent() - Math.max(pp.indentRight, room.right));

  /** Ends the row being filled: its stretches are as tall as the tallest, and sit on one baseline. */
  const finishRow = () => {
    const row = lines.slice(rowStart);
    if (!row.length) return;
    const up = Math.max(...row.map((line) => line.ascent));
    const down = Math.max(...row.map((line) => line.descent));
    const tall = (up + down) * pp.lineHeight + room.pad;
    row.forEach((line, i) => {
      line.ascent = up;
      line.descent = down;
      // The last one made is the one that takes the room, whether or not the row was filled to its end.
      if (i < row.length - 1) {
        line.box = tall;
        line.height = 0;
      } else {
        delete line.box;
        line.height = tall;
      }
    });
    filled += tall;
    rowStart = lines.length;
  };

  const flush = (forced: boolean, breakAfter: 'page' | 'column' | undefined, lastLine: boolean) => {
    // A break, or the end of the paragraph, ends the row where it is: nothing goes on the other side.
    if (forced || lastLine) pending = [];
    const lineIndent = indent();
    const lineAvail = avail();
    const start = cur.length ? cur[0].start : nextOffset;
    const last = cur[cur.length - 1];
    const end = last ? last.start + last.text.length : nextOffset;

    let ascent = 0;
    let descent = 0;
    if (cur.length) {
      for (const p of cur) {
        ascent = Math.max(ascent, p.metrics.ascent);
        descent = Math.max(descent, p.metrics.descent);
      }
    } else {
      const m = measurer.metrics(fontOf(lastProps));
      ascent = m.ascent;
      descent = m.descent;
    }
    const lineLabel = lines.length === 0 ? label : undefined;
    // A label can make its line taller above the baseline, never below it, as in Word.
    if (lineLabel) ascent = Math.max(ascent, lineLabel.fragment.ascent);

    // Trailing spaces and breaks hang past the edge and do not count for alignment.
    let visibleCount = cur.length;
    const hangs = (kind: PieceKind) => kind === 'space' || kind === 'break' || kind === 'pagebreak' || kind === 'columnbreak';
    while (visibleCount > 0 && hangs(cur[visibleCount - 1].kind)) visibleCount--;
    let visible = 0;
    let spaces = 0;
    let hasTab = false;
    for (let i = 0; i < visibleCount; i++) {
      visible += cur[i].width;
      if (cur[i].kind === 'space') spaces += cur[i].text.length;
      if (cur[i].kind === 'tab') hasTab = true;
    }

    const slack = Math.max(0, lineAvail - visible);
    let shift = 0;
    let wordSpacing = 0;
    if (pp.align === 'center') shift = slack / 2;
    else if (pp.align === 'right') shift = slack;
    else if (pp.align === 'justify' && !forced && !lastLine && spaces > 0 && !hasTab) wordSpacing = slack / spaces;
    // A line that only fits with its spaces shrunk is shrunk, the last line of the paragraph too.
    if (shrink && visible > lineAvail + EPSILON && spaces > 0 && !hasTab) wordSpacing = (lineAvail - visible) / spaces;

    const fragments: Fragment[] = [];
    let x = lineIndent + shift;
    for (const p of cur) {
      const advance = p.kind === 'space' ? p.width + p.text.length * wordSpacing : p.width;
      const prev = fragments[fragments.length - 1];
      const isText = p.kind === 'word' || p.kind === 'space';
      if (isText && prev && prev.kind === 'text' && prev.props === p.props) {
        prev.text += p.text;
        prev.end += p.text.length;
        prev.width += advance;
      } else {
        fragments.push({
          kind: isText ? 'text' : p.kind === 'tab' ? 'tab' : p.kind === 'object' ? 'object' : 'break',
          text: p.text,
          start: p.start,
          end: p.start + p.text.length,
          x,
          width: advance,
          props: p.props,
          font: p.font,
          ascent: p.metrics.ascent,
          descent: p.metrics.descent,
          wordSpacing,
        });
        if (p.mark) fragments[fragments.length - 1].mark = p.mark;
        // The gap of a tab to a stop with a leader is filled with it: the gap for now, set out when the line is placed.
        if (p.kind === 'tab' && p.leader) fragments[fragments.length - 1].leader = { text: LEADER_CHAR[p.leader], x, width: advance };
      }
      x += advance;
    }

    lines.push({
      start,
      end,
      x: lineIndent + shift,
      width: visible + spaces * wordSpacing,
      ascent,
      descent,
      height: (ascent + descent) * pp.lineHeight + room.pad,
      fragments,
      label: lineLabel && { ...lineLabel.fragment, x: lineLabel.fragment.x + shift + (lineIndent - ownIndent()) },
      pageBreakAfter: breakAfter === 'page',
      ...(breakAfter === 'column' ? { columnBreakAfter: true } : {}),
      ...(room.pad ? { pad: room.pad } : {}),
    });
    if (pending.length) {
      // The row goes on: how tall it is, is known when its last stretch is made.
      const made = lines[lines.length - 1];
      made.box = made.height;
      made.height = 0;
    } else {
      finishRow();
    }
    if (last) lastProps = last.props;
    nextOffset = end;
    // After a page or a column break the paragraph mark stays on the line of the break, as in Word 2013 and later;
    // after a line break it starts a line of its own.
    endedWithBreak = forced && !breakAfter;
    cur = [];
    curWidth = 0;
    startLine();
  };

  const push = (p: Piece) => {
    cur.push(p);
    curWidth += p.width;
  };

  const shrink = rules.shrinkSpaces && pp.align === 'justify';
  /** Whether a word that runs past the edge by itself fits once the spaces of the line are shrunk. */
  const fitsShrunk = (wordWidth: number): boolean => {
    if (!shrink) return false;
    let spaceWidth = 0;
    let trailing = 0;
    for (const p of cur) {
      // Never on a line with a tab.
      if (p.kind === 'tab') return false;
      if (p.kind === 'space') {
        spaceWidth += p.width;
        trailing += p.width;
      } else {
        trailing = 0;
      }
    }
    const over = curWidth + wordWidth - avail();
    if (spaceWidth <= 0 || over > spaceWidth * MAX_SPACE_SHRINK + EPSILON) return false;
    // Without the word the line ends before its trailing spaces, and the ones left stretch to fill it.
    const inner = spaceWidth - trailing;
    const loose = avail() - (curWidth - trailing);
    return inner <= 0 || loose / inner >= MIN_STRETCH_PER_SHRINK * (over / spaceWidth);
  };

  const groups = groupPieces(pieces);
  /** The groups before this one go on the line whatever room it has: the text that ends at a stop past its end. */
  let pinned = -1;
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    const head = group[0];
    if (head.kind === 'space') {
      push(head);
    } else if (head.kind === 'tab') {
      // The stop the tab goes to; on the first line the hanging indent is one too.
      const hanging = () => (lines.length === 0 && from === 0 && !label && pp.indentFirstLine < 0 ? pp.indentLeft : undefined);
      const stop = () => nextTabStop(pp, indent() + curWidth, rules.tabInterval, hanging());
      let to = stop();
      if (to.align === 'left') {
        // What follows starts at the stop; past the end of the line, the tab starts the next.
        if (to.pos > indent() + avail() + EPSILON && cur.length) {
          flush(false, undefined, false);
          to = stop();
        }
        push({ ...head, width: Math.max(0, to.pos - indent() - curWidth), ...(to.leader ? { leader: to.leader } : {}) });
      } else {
        // What follows, up to the next tab or the end of the line, ends at the stop, is centred on it or has its
        // decimal point there; the tab takes the room that leaves. A stop past the end of the line is at its end.
        let rest = 0;
        let point = -1;
        const ends = (kind: PieceKind) => kind === 'break' || kind === 'pagebreak' || kind === 'columnbreak' || kind === 'tab';
        const after: Piece[] = [];
        let n = g + 1;
        for (; n < groups.length && !ends(groups[n][0].kind); n++) after.push(...groups[n]);
        for (const p of after) rest += p.width;
        if (to.align === 'decimal') {
          // Up to the first point, whatever the language of the text; without one, up to the end. Measured against Word.
          let before = 0;
          for (const p of after) {
            const k = p.kind === 'word' ? p.text.indexOf('.') : -1;
            if (k >= 0) {
              point = before + measurer.width(p.text.slice(0, k), p.font);
              break;
            }
            before += p.width;
          }
        }
        const lead = () => (to.align === 'center' ? rest / 2 : to.align === 'decimal' && point >= 0 ? point : rest);
        // A stop past the end of the line is where the text ends all the same, as in Word; the dotted one of a
        // table of contents is kept to the line.
        const room = () => (to.align === 'right' && to.leader === 'dot' && to.pos === pp.leaderTab ? Math.min(to.pos - indent(), avail()) : to.pos - indent());
        // No room left for it on this line: it starts the next, and still ends at the stop.
        if (curWidth + lead() > room() + EPSILON && cur.length) {
          flush(false, undefined, false);
          to = stop();
        }
        push({ ...head, width: Math.max(0, room() - curWidth - lead()), ...(to.leader ? { leader: to.leader } : {}) });
        // Up to a stop past the end of the line, the text runs past it, as in Word.
        if (room() > avail() + EPSILON) pinned = n;
      }
    } else if (head.kind === 'break' || head.kind === 'pagebreak' || head.kind === 'columnbreak') {
      push(head);
      flush(true, head.kind === 'pagebreak' ? 'page' : head.kind === 'columnbreak' ? 'column' : undefined, false);
    } else if (head.kind === 'object') {
      // A box is never split: it moves to a new line, where it may overflow.
      if (curWidth + head.width > avail() + EPSILON && cur.length) flush(false, undefined, false);
      push(head);
    } else if (g < pinned) {
      for (const p of group) push(p);
    } else {
      let groupWidth = 0;
      for (const p of group) groupWidth += p.width;
      let fits = curWidth + groupWidth <= avail() + EPSILON || fitsShrunk(groupWidth);
      if (!fits && cur.length) flush(false, undefined, false);
      // Too wide for what is left of this side of a picture: it goes on the other, not cut in two; and
      // when it fits on neither, down to where the picture leaves it room, as in Word.
      while (!fits && !cur.length && pending.length && groupWidth > avail() + EPSILON) startLine();
      if (!fits && !cur.length && groupWidth > avail() + EPSILON) {
        // The row has text on its other side already: it ends there, and the word starts the next.
        if (lines.length > rowStart) {
          finishRow();
          pending = [];
          startLine();
        }
        for (let tries = 0; tries < 200 && narrowed() && groupWidth > avail() + EPSILON; tries++) startLine(room.pad + rowHeight());
      }
      if (!cur.length) fits = groupWidth <= avail() + EPSILON;
      if (fits || curWidth + groupWidth <= avail() + EPSILON) {
        for (const p of group) push(p);
        continue;
      }
      // The word is wider than a whole line: break it by characters.
      const queue = group.slice();
      while (queue.length) {
        const p = queue.shift()!;
        const room = avail() - curWidth;
        if (p.width <= room + EPSILON) {
          push(p);
          continue;
        }
        let lo = 0;
        let hi = p.text.length;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (measurer.width(p.text.slice(0, mid), p.font) <= room + EPSILON) lo = mid;
          else hi = mid - 1;
        }
        if (lo === 0 && cur.length === 0) lo = 1;
        if (lo > 0) {
          const headText = p.text.slice(0, lo);
          push({ ...p, text: headText, width: measurer.width(headText, p.font) });
        }
        flush(false, undefined, false);
        if (lo < p.text.length) {
          const tailText = p.text.slice(lo);
          queue.unshift({ ...p, text: tailText, start: p.start + lo, width: measurer.width(tailText, p.font) });
        }
      }
    }
  }

  if (cur.length || lines.length === 0 || endedWithBreak) flush(false, undefined, true);
  return lines;
}

/** Whether a line holds nothing but a break that ends its page or its column: it takes its place wherever it is, as in Word. */
function breakOnly(rl: RawLine): boolean {
  return (rl.pageBreakAfter || !!rl.columnBreakAfter) && rl.fragments.every((f) => f.kind === 'break' || (f.kind === 'object' && f.width === 0));
}

function sameLabel(a: ListLabel | undefined, b: ListLabel | undefined): boolean {
  return a === b || (!!a && !!b && a.text === b.text && a.level === b.level);
}

interface CachedParagraph {
  contentWidth: number;
  label: ListLabel | undefined;
  lines: RawLine[];
}

/**
 * Line boxes of the paragraphs already laid out. Paragraphs are immutable, so
 * one that is the same object as last time, at the same width and with the
 * same list label, breaks into the same lines.
 */
export type LayoutCache = WeakMap<Paragraph, CachedParagraph>;

export function createLayoutCache(): LayoutCache {
  return new WeakMap();
}

/**
 * Where a table starts, from the left of the text area, and how wide its
 * columns are once fitted to it. `legacy` is for the layout of Word 2010 and
 * before, which lines up the text of a table's cells with the text around it
 * and not their edges: the table stands out on either side by the margins of
 * its cells, and one as wide as the text area is that much wider.
 */
/** A stretch down a table laid out on its own, from one place it may be cut across to the next. */
interface Stretch {
  from: number;
  to: number;
  /**
   * Set on the band that ends a row of the table and holds the last of its
   * lines: how much of the band comes after them, the margin and the border
   * below, and where the row starts.
   */
  tail?: number;
  rowFrom?: number;
}

/**
 * The bands of a table laid out on its own, cut across where a page may break
 * it: between its lines and its rows, but not through a line, a picture or a
 * row that must stay whole, nor between the last line of a row and its end.
 */
function bandsAcross(page: LayoutPage, height: number, tables: Table[] | undefined): Stretch[] {
  const solid: [number, number][] = [];
  const extents = page.lines.map((l) => (l.turn ? turnRect(l.turn, l) : l));
  for (const r of extents) solid.push([r.y, r.y + r.height]);
  for (const f of page.floats) solid.push([f.y, f.y + f.height]);
  const rows = new Map<string, { top: number; bottom: number; last: number }>();
  for (const box of page.cells) {
    const row = tables?.[box.table]?.rows[box.row];
    if (row?.cantSplit || row?.exact) solid.push([box.y, box.y + box.height]);
    const key = `${box.table}:${box.row}`;
    const was = rows.get(key);
    rows.set(key, { top: Math.min(was?.top ?? Infinity, box.y), bottom: Math.max(was?.bottom ?? -Infinity, box.y + box.height), last: 0 });
  }
  // The end of a row goes with its last line.
  for (const row of rows.values()) {
    row.last = row.top;
    for (const r of extents) if (r.y >= row.top - EPSILON && r.y < row.bottom - EPSILON) row.last = Math.max(row.last, r.y + r.height);
    if (row.bottom - row.last > EPSILON) solid.push([row.last - 2 * EPSILON, row.bottom]);
  }
  // What may not be cut through, as stretches that do not overlap.
  solid.sort((a, b) => a[0] - b[0]);
  const whole: [number, number][] = [];
  for (const [top, bottom] of solid) {
    const last = whole[whole.length - 1];
    if (last && top < last[1] - EPSILON) last[1] = Math.max(last[1], bottom);
    else whole.push([top, bottom]);
  }
  const candidates = [0, height, ...solid.flat(), ...page.cells.flatMap((box) => [box.y, box.y + box.height])]
    .filter((y) => y >= -EPSILON && y <= height + EPSILON)
    .sort((a, b) => a - b);
  const cuts: number[] = [];
  let k = 0;
  for (const y of candidates) {
    while (k < whole.length && whole[k][1] <= y + EPSILON) k++;
    if (k < whole.length && whole[k][0] < y - EPSILON) continue;
    if (!cuts.length || y - cuts[cuts.length - 1] > EPSILON) cuts.push(Math.min(height, Math.max(0, y)));
  }
  if (cuts.length < 2) cuts.splice(0, cuts.length, 0, height);
  cuts[cuts.length - 1] = height;
  return cuts.slice(1).map((to, i): Stretch => {
    const from = cuts[i];
    // Of the rows that end with this band and have their last line in it, the outermost.
    let row: { top: number; bottom: number; last: number } | undefined;
    for (const r of rows.values()) if (Math.abs(r.bottom - to) < EPSILON && r.last > from + EPSILON && r.bottom - r.last > EPSILON && (!row || r.top < row.top)) row = r;
    return row ? { from, to, tail: to - row.last, rowFrom: row.top } : { from, to };
  });
}

export function tableGeometry(table: Table, contentWidth: number, legacy = false): { left: number; columns: number[] } {
  let columns = table.columns;
  let total = columns.reduce((a, b) => a + b, 0);
  const scaleTo = (width: number) => {
    columns = columns.map((w) => (w * width) / total);
    total = width;
  };
  const first = table.rows[0]?.cells;
  const outLeft = legacy ? (first?.[0]?.padLeft ?? table.padLeft) + (table.spacing ?? 0) : 0;
  const outRight = legacy ? (first?.[first.length - 1]?.padRight ?? table.padRight) + (table.spacing ?? 0) : 0;
  if (table.widthFraction) scaleTo((contentWidth + outLeft + outRight) * table.widthFraction);
  // A table that is not fixed is narrowed to the room it has, as Word's autofit does.
  const room = contentWidth - Math.max(0, table.indent);
  if (!table.fixed && total > room + EPSILON) scaleTo(room);
  const left =
    table.align === 'center' ? (contentWidth - total) / 2 : table.align === 'right' ? contentWidth - total + outRight : table.indent - outLeft;
  return { left, columns };
}

/** A section as the layout takes it: how its pages are set out, and where its paragraphs end. */
export interface FlowSection {
  page: PageSetup;
  columns: Columns;
  start: SectionStart;
  noHeader?: boolean;
  noFooter?: boolean;
  /** Its own header and footer, for one before the last that does not show the document's. */
  header?: Story;
  footer?: Story;
  /** Those of its first page, when it has its own. */
  firstPage?: { header?: Story; footer?: Story };
  /** Its index among the sections, and whether it is the last, the document's own. */
  index: number;
  last: boolean;
  /** Index of the paragraph after its last one. */
  end: number;
}

/** The sections of a document, in order; the last one is the document's own. */
export function sectionsOf(doc: Pick<Doc, 'page' | 'paragraphs' | 'columns' | 'sectionStart' | 'noHeader' | 'noFooter' | 'firstPage'>): FlowSection[] {
  const sections: FlowSection[] = [];
  doc.paragraphs.forEach((p, i) => {
    // The last paragraph's mark is the document's: what it says of a section, the document says.
    const s = i < doc.paragraphs.length - 1 && !p.cell ? p.section : undefined;
    if (s) {
      const { page, columns, start, noHeader, noFooter, header, footer, firstPage } = s;
      sections.push(defined({ page, columns: columns ?? ONE_COLUMN, start: start ?? 'nextPage', noHeader, noFooter, header, footer, firstPage, index: sections.length, last: false, end: i + 1 }));
    }
  });
  sections.push(
    defined({
      page: doc.page,
      columns: doc.columns ?? ONE_COLUMN,
      start: doc.sectionStart ?? 'nextPage',
      noHeader: doc.noHeader,
      noFooter: doc.noFooter,
      firstPage: doc.firstPage,
      index: sections.length,
      last: true,
      end: doc.paragraphs.length,
    }),
  );
  return sections;
}

/** Where each column of a section is across its pages, and how wide. */
export function columnGeometry(page: PageSetup, columns: Columns): { x: number; width: number }[] {
  const width = page.width - page.marginLeft - page.marginRight;
  if (columns.count < 2) return [{ x: page.marginLeft, width }];
  const out: { x: number; width: number }[] = [];
  let x = page.marginLeft;
  if (columns.widths?.length) {
    for (const col of columns.widths) {
      out.push({ x, width: Math.max(MIN_LINE_WIDTH, col.width) });
      x += col.width + col.space;
    }
    return out;
  }
  const each = Math.max(MIN_LINE_WIDTH, (width - columns.space * (columns.count - 1)) / columns.count);
  for (let k = 0; k < columns.count; k++, x += each + columns.space) out.push({ x, width: each });
  return out;
}

/** A note at the foot of the page as the flow takes it: how tall it is, and where it may be cut. */
interface NoteShape {
  height: number;
  /** Where, down from its top, it may go on at the foot of the next page: after a line, leaving no line alone on either side. */
  cuts: number[];
}

/** The notes at the foot of the pages, for the flow to keep each on the page of its reference. */
interface FlowNotes {
  /** The notes the stretch of paragraph `para` from `start` to `end` refers to, by id, in order. */
  refs(para: number, start: number, end: number): string[];
  shape(id: string, width: number): NoteShape;
  /** How tall the line above the notes of a page is, with the room around it. */
  separator: number;
}

/** A stretch of a note on a page: from `from` to `to` down from its top. */
export interface NotePart {
  id: string;
  from: number;
  to: number;
}

interface FlowOptions {
  /** The text area of a page of a section, from its top to its bottom: what its header and footer leave. `first` for the page the section starts on. */
  area: (section: FlowSection, pageIndex: number, first: boolean) => { top: number; bottom: number };
  /** The sections, when the flow is set out in them; otherwise it is one, of the document's page and in one column. */
  sections?: FlowSection[];
  /** Set for text that runs on down one endless page: nothing starts another, and no picture is put off its line. */
  continuous?: boolean;
  /** The notes at the foot of the pages, when the text has any. */
  notes?: FlowNotes;
  /** How tall a text box grows to hold its text, when it does: the room it takes is that. */
  boxHeight?: (xml: string, anchor: Anchor) => number | undefined;
}

/**
 * Lays out a flow of paragraphs and tables down pages and, inside a page, down
 * the columns of the section each paragraph is in.
 */
function layoutFlow(
  doc: Pick<Doc, 'page' | 'paragraphs' | 'tables' | 'numbering' | 'compatMode' | 'defaultTabStop'>,
  measurer: TextMeasurer,
  cache: LayoutCache | undefined,
  options: FlowOptions,
): Layout & { endY: number; firsts: Set<number>; notes: Map<number, { parts: NotePart[]; room: number }> } {
  const { continuous = false } = options;
  const sections = options.sections ?? [{ page: doc.page, columns: ONE_COLUMN, start: 'nextPage' as const, index: 0, last: true, end: doc.paragraphs.length }];
  let sectionIndex = 0;
  let section = sections[0];
  let page = section.page;
  /** The pages a section starts on, and the one the section the text is in started on. */
  const firsts = new Set([0]);
  let sectionFirst = 0;
  const area = (s: FlowSection, pageIndex: number) => options.area(s, pageIndex, pageIndex === sectionFirst);
  let { top, bottom } = area(section, 0);
  const { paragraphs } = doc;
  const labels = listLabels(doc);
  const rules: LineRules = { shrinkSpaces: (doc.compatMode ?? 0) >= SHRINK_COMPAT_MODE, tabInterval: doc.defaultTabStop ?? TAB_STOP };
  const legacyTables = doc.compatMode !== undefined && doc.compatMode < SHRINK_COMPAT_MODE;
  const pages: LayoutPage[] = [{ index: 0, lines: [], cells: [], floats: [], ...(options.sections ? { section: 0 } : {}) }];
  const lines: Line[] = [];
  const paraFirstLine: number[] = [];
  let y = top;
  /**
   * Space after the paragraph that ends right above `y`. Between two
   * paragraphs Word leaves the larger of the first's space after and the
   * second's space before, not their sum.
   */
  let spaceAbove = 0;

  /** The columns of the section, the one the text is in, and where they start on this page. */
  let columns = continuous ? columnGeometry(page, ONE_COLUMN) : columnGeometry(page, section.columns);
  let col = 0;
  /** The page coordinate of the left edge of the column, and its width: the text area the text is set in. */
  let colLeft = columns[0].x;
  let contentWidth = columns[0].width;
  let colTop = top;
  /** How far down the text of the columns of this page went, in the column that went furthest. */
  let deepest = top;
  /** What the page held when the column was started: anything more was put in the column. */
  let columnFrom = { lines: 0, cells: 0 };
  /** The index in `lines` of the first line of each column of this page up to the one the text is in. */
  let columnStarts = [0];
  /** While columns are balanced: the page they end on, and how far down it they may go. */
  let cap: { page: number; bottom: number } | undefined;

  // --- Notes at the foot of the pages ---
  const notes = continuous ? undefined : options.notes;
  /** As wide as the text of the page: notes go across it whatever its columns. */
  const textWidth = () => page.width - page.marginLeft - page.marginRight;
  /** The stretches of notes each page holds, and the room they and the line above them take at its foot. */
  const noteParts = new Map<number, { parts: NotePart[]; room: number }>();
  /** The notes already given a place, and the rest of one cut at the foot of the page, to go on at the foot of the next. */
  const notesPlaced = new Set<string>();
  let carried: { id: string; from: number }[] = [];
  /** The notes a line refers to that have no place yet. */
  const freshNotes = (para: number, rl: RawLine, also?: Set<string>) =>
    notes && rl.end > rl.start ? notes.refs(para, rl.start, rl.end).filter((id, k, all) => !notesPlaced.has(id) && !also?.has(id) && all.indexOf(id) === k) : [];
  /** The room on the page notes would take: whole, or with the last one cut as soon as it may be. */
  const noteNeed = (ids: string[], least: boolean, separator: boolean) => {
    let need = separator ? notes!.separator : 0;
    ids.forEach((id, k) => {
      const shape = notes!.shape(id, textWidth());
      need += least && k === ids.length - 1 && shape.cuts.length ? shape.cuts[0] : shape.height;
    });
    return need;
  };
  /** Gives a stretch of a note room at the foot of page `index`; on the page being filled, the text has that much less. */
  const takeNote = (index: number, part: NotePart) => {
    let at = noteParts.get(index);
    if (!at) noteParts.set(index, (at = { parts: [], room: 0 }));
    const add = (at.parts.length ? 0 : notes!.separator) + part.to - part.from;
    at.parts.push(part);
    at.room += add;
    if (index === pages.length - 1) bottom -= add;
  };
  /** The room left at the foot of page `index` for notes, under what is at `y`. */
  const roomFor = (index: number, below: number) => (index === pages.length - 1 ? bottom - below : Infinity) - (noteParts.get(index)?.parts.length ? 0 : notes!.separator);
  /** Puts as much of a note from `from` as fits in `room` on page `index`; what is left goes on at the foot of the next. */
  const putNote = (index: number, id: string, from: number, room: number, force: boolean) => {
    const shape = notes!.shape(id, textWidth());
    if (shape.height - from <= room + PAGE_SLACK) return takeNote(index, { id, from, to: shape.height });
    const cut = [...shape.cuts].reverse().find((c) => c > from && c - from <= room + PAGE_SLACK);
    if (cut === undefined && !force) return carried.push({ id, from });
    const to = cut ?? shape.height;
    takeNote(index, { id, from, to });
    if (to < shape.height) carried.push({ id, from: to });
  };
  /** The notes a line placed on page `index`, down to `below`, refers to: they go at the foot of that page, as far as they fit. */
  const notesOfLine = (index: number, para: number, rl: RawLine, below: number) => {
    for (const id of freshNotes(para, rl)) {
      notesPlaced.add(id);
      putNote(index, id, 0, roomFor(index, below), true);
    }
  };
  /** At the top of a new page: what was left of the notes of the page before goes on at its foot. */
  const carryNotes = () => {
    if (!notes || !carried.length) return;
    const was = carried;
    carried = [];
    for (const { id, from } of was) putNote(pages.length - 1, id, from, roomFor(pages.length - 1, top), was.length === 1 && !carried.length);
  };

  const anchorOf = (xml: string | undefined): Anchor | undefined => {
    const anchor = continuous || !xml ? undefined : anchoredObject(xml);
    // A text box as tall as its text takes the room its text does.
    const height = anchor && options.boxHeight?.(xml!, anchor);
    return height ? { ...anchor!, height } : anchor;
  };
  const current = () => pages[pages.length - 1];
  const setColumn = (k: number) => {
    col = k;
    colLeft = columns[k].x;
    contentWidth = columns[k].width;
    columnFrom = { lines: current().lines.length, cells: current().cells.length };
    columnStarts = [...columnStarts.slice(0, k), lines.length];
  };
  /** Ends the columns of this page, with the lines between them their section asks for. */
  const closeColumns = () => {
    deepest = Math.max(deepest, y);
    if (continuous || columns.length < 2 || deepest <= colTop + EPSILON) return;
    const at = current();
    for (let k = 0; k <= col; k++) {
      const c = columns[k];
      (at.columns ??= []).push({ x: c.x, y: colTop, width: c.width, height: deepest - colTop, from: columnStarts[k], to: k < col ? columnStarts[k + 1] : lines.length });
    }
    if (!section.columns.separator) return;
    const rules = (at.rules ??= []);
    for (let k = 0; k + 1 < columns.length; k++) {
      const x = (columns[k].x + columns[k].width + columns[k + 1].x) / 2;
      rules.push({ x, top: colTop, bottom: deepest });
    }
  };
  /** Takes the text area of the page for the section it is in now. */
  const startArea = () => {
    ({ top, bottom } = area(section, pages.length - 1));
    if (cap && cap.page === pages.length - 1) bottom = Math.min(bottom, cap.bottom);
    bottom -= noteParts.get(pages.length - 1)?.room ?? 0;
    carryNotes();
    y = top;
    colTop = top;
    deepest = top;
    spaceAbove = 0;
    wraps = [];
    setColumn(0);
  };
  const pushPage = () => {
    pages.push({ index: pages.length, lines: [], cells: [], floats: [], ...(options.sections ? { section: sectionIndex } : {}) });
    startArea();
  };
  const newPage = () => {
    if (continuous) {
      // Where a page was asked to end, the text only steps down.
      y += CONTINUOUS_BREAK;
      spaceAbove = 0;
      return;
    }
    closeColumns();
    pushPage();
  };
  /**
   * Goes on at the top of the next column, or of the next page after the last
   * one. What starts there because the column before had no more room for it
   * starts without the space it asks for above it, as in Word.
   */
  const nextColumn = (soft = true) => {
    if (continuous || col + 1 >= columns.length) newPage();
    else {
      deepest = Math.max(deepest, y);
      setColumn(col + 1);
      y = colTop;
    }
    spaceAbove = soft ? Infinity : 0;
  };

  const breakCached = (paraIndex: number, pp: ResolvedParagraphProps, width: number): RawLine[] => {
    const para = paragraphs[paraIndex];
    const label = labels[paraIndex];
    let cached = cache?.get(para);
    if (!cached || cached.contentWidth !== width || !sameLabel(cached.label, label)) {
      cached = { contentWidth: width, label, lines: breakParagraph(para, pp, width, measurer, label, rules) };
      cache?.set(para, cached);
    }
    return cached.lines;
  };

  /**
   * The leader of a tab, its gap at `left` from the edge of the page: the
   * characters that fit whole in it, each on a grid as wide as one counted from
   * the edge of the page, so that leaders line up from line to line. Measured against Word.
   */
  const leaderIn = (f: Fragment, left: number): Fragment['leader'] => {
    const { text: char, x, width } = f.leader!;
    const w = measurer.width(char, f.font);
    if (!(w > 0)) return undefined;
    const first = Math.ceil((left + x) / w - EPSILON);
    const count = Math.max(0, Math.floor((left + x + width) / w + EPSILON) - first);
    return count ? { text: char.repeat(count), x: first * w, width: count * w } : undefined;
  };

  /** Puts a line box on the current page; `left` is the page coordinate of the edge it is relative to. */
  const place = (
    paraIndex: number,
    rl: RawLine,
    last: boolean,
    left: number,
    lineTop: number,
    cell?: number,
    on: LayoutPage = current(),
  ) => {
    const pad = rl.pad ?? 0;
    const tall = rl.box ?? rl.height;
    // The room a line spacing above single leaves goes under the text, which sits at the top of its line:
    // that is where Word puts it. A spacing below single takes from both sides.
    const extra = tall - pad - (rl.ascent + rl.descent);
    const leading = extra > 0 ? 0 : extra / 2;
    const line: Line = {
      index: lines.length,
      page: on.index,
      para: paraIndex,
      start: rl.start,
      end: rl.end,
      x: left + rl.x,
      y: lineTop + pad,
      width: rl.width,
      height: tall - pad,
      baseline: lineTop + pad + leading + rl.ascent,
      fragments: rl.fragments.map((f) => (f.leader ? { ...f, x: left + f.x, leader: leaderIn(f, left) } : { ...f, x: left + f.x })),
      label: rl.label && { ...rl.label, x: left + rl.label.x },
      lastInParagraph: last,
      raw: rl,
    };
    if (cell !== undefined) line.cell = cell;
    lines.push(line);
    on.lines.push(line);
    if (notes) notesOfLine(on.index, paraIndex, rl, lineTop + tall);

    for (const f of rl.fragments) {
      const anchor = f.kind === 'object' ? anchorOf(f.props.object) : undefined;
      if (!anchor) continue;
      // One the text goes round was given its place before its paragraph was broken into lines.
      on.floats.push(placed.get(f.props.object) ?? floatAt(anchor, f.props.object, left, lineTop + pad, paraIndex, f.start));
    }
  };

  /** Where a floating picture goes: `left` is the edge its line is relative to, `lineTop` the top of the text it is anchored in. */
  const floatAt = (anchor: Anchor, xml: string, left: number, lineTop: number, para: number, offset: number): FloatBox => {
    // Horizontally from the page or from the edge the line is relative to; vertically from the page, the text area or the line.
    const onPage = anchor.fromX === 'page';
    const base = onPage ? 0 : left;
    const span = onPage ? page.width : contentWidth;
    const x =
      anchor.alignX === 'center'
        ? base + (span - anchor.width) / 2
        : anchor.alignX === 'right'
          ? base + span - anchor.width
          : base + (anchor.alignX ? 0 : anchor.x);
    const fixed = anchor.fromY === 'page';
    const float: FloatBox = { x, y: (fixed ? 0 : anchor.fromY === 'margin' ? page.marginTop : lineTop) + anchor.y, width: anchor.width, height: anchor.height, xml, para, offset };
    if (fixed) float.fixed = true;
    if (anchor.behind) float.behind = true;
    return float;
  };

  /** The pictures of the paragraph being placed that the text goes round, by their XML: where each is. */
  let placed = new Map<string, FloatBox>();
  /** What the text of the page has to go round: each picture with the room it keeps clear, and how. */
  type Wrap = { left: number; right: number; top: number; bottom: number; whole: boolean; side: Anchor['side'] };
  let wraps: Wrap[] = [];

  /**
   * A paragraph broken into lines that go round pictures, as `shape` says. Which line is the last is
   * known once the paragraph is broken, and it is broken another way for being the last. Word goes line
   * by line: the last is the first one that takes what is left of the text when it is measured as the
   * last. So the rows are tried from the end back, and the earliest that ends the paragraph when taken
   * for the last is the one.
   */
  const shapedLines = (paraIndex: number, pp: ResolvedParagraphProps, width: number, shape: LineShape): RawLine[] => {
    const broken = (lastFrom?: number) => breakParagraph(paragraphs[paraIndex], pp, width, measurer, labels[paraIndex], rules, shape, lastFrom);
    /** Where the last row of some lines starts. */
    const lastStart = (made: RawLine[]) => {
      let i = made.length - 1;
      while (i > 0 && made[i - 1].box !== undefined) i--;
      return made[i].start;
    };
    let made = broken();
    const starts = made.filter((_, i) => i === 0 || made[i - 1].box === undefined).map((line) => line.start);
    for (let k = starts.length - 1; k >= Math.max(0, starts.length - 4); k--) {
      const tried = broken(starts[k]);
      if (lastStart(tried) !== starts[k]) break;
      made = tried;
    }
    return made;
  };

  /**
   * How the lines of a paragraph that starts at `startY`, `lead` below what is
   * above it, have to go round the pictures of the page, or nothing when none
   * is in its way. The text goes
   * down the wider side of a picture, and below it when neither side has room.
   */
  const shapeFrom = (startY: number, lead: number, within: { wraps: Wrap[]; edge: number; width: number } = { wraps, edge: colLeft, width: contentWidth }): LineShape | undefined => {
    const near = within.wraps.filter((wrap) => wrap.bottom > startY + EPSILON);
    if (!near.length) return undefined;
    const { edge, width: contentWidth } = within;
    return (top, height, first) => {
      const y = startY + top;
      const over = near.filter((wrap) => wrap.bottom > y + EPSILON && wrap.top < y + height - EPSILON);
      const before = (wrap: (typeof near)[number]) => wrap.left - edge;
      const after = (wrap: (typeof near)[number]) => edge + contentWidth - wrap.right;
      const open = (wrap: (typeof near)[number]) => ({
        left: wrap.side !== 'right' && before(wrap) >= MIN_WRAP_WIDTH,
        right: wrap.side !== 'left' && after(wrap) >= MIN_WRAP_WIDTH,
      });
      for (const wrap of over) {
        const sides = open(wrap);
        // A first line sent below a picture keeps the space its paragraph asks for above it, as in Word.
        if (wrap.whole || (!sides.left && !sides.right)) return { skip: wrap.bottom - y + (first ? lead : 0), segments: [] };
      }
      // One picture with room on both sides: the line is in two, one stretch on each.
      if (over.length === 1 && over[0].side === 'both' && open(over[0]).left && open(over[0]).right) {
        return { skip: 0, segments: [{ left: -Infinity, right: edge + contentWidth - over[0].left }, { left: over[0].right - edge, right: -Infinity }] };
      }
      let left = -Infinity;
      let right = -Infinity;
      for (const wrap of over) {
        const sides = open(wrap);
        // The wider side, of those it may go down.
        const onRight = sides.right && (!sides.left || after(wrap) >= before(wrap));
        if (onRight) left = Math.max(left, wrap.right - edge);
        else right = Math.max(right, edge + contentWidth - wrap.left);
      }
      return { skip: 0, segments: [{ left, right }] };
    };
  };

  /** Whether nothing was put in the column yet: what does not fit in it then goes in anyway, or it never would. */
  const emptyPage = () => current().lines.length === columnFrom.lines && current().cells.length === columnFrom.cells;
  /** Whether nothing at all was put on the page yet. */
  const blankPage = () => !current().lines.length && !current().cells.length;
  /** How tall a column is, for what is too tall to be moved to the next one. */
  const pageHeight = () => bottom - colTop;
  const heightOf = (raw: RawLine[]) => raw.reduce((h, rl) => h + rl.height, 0);

  /** Height of the first line of a paragraph, laid out as running text. */
  const firstLineHeight = (paraIndex: number): number => {
    if (paraIndex >= paragraphs.length) return 0;
    const pp = resolveParagraph(paragraphs[paraIndex].props);
    return pp.spacingBefore + breakCached(paraIndex, pp, contentWidth)[0].height;
  };

  /** Paragraphs up to this index were already moved, together, by keep with next. */
  let keptUntil = -1;

  /**
   * Keep with next: a run of kept paragraphs and the first line of the one
   * after them go to the next page when they do not fit on this one. A run too
   * long for a page is broken as usual.
   */
  const keepWithNext = (paraIndex: number) => {
    if (paraIndex <= keptUntil) return;
    let needed = 0;
    let end = paraIndex;
    for (; end < paragraphs.length && !paragraphs[end].cell; end++) {
      const pp = resolveParagraph(paragraphs[end].props);
      if (!pp.keepNext) break;
      needed += pp.spacingBefore + heightOf(breakCached(end, pp, contentWidth)) + pp.spacingAfter;
    }
    if (end === paraIndex) return;
    keptUntil = end;
    needed += firstLineHeight(end);
    if (y + needed > bottom + EPSILON && needed <= pageHeight() + EPSILON && !emptyPage()) nextColumn();
  };

  const flow = (paraIndex: number) => {
    const pp = resolveParagraph(paragraphs[paraIndex].props);
    let raw = breakCached(paraIndex, pp, contentWidth);
    // An empty paragraph that only holds the end of a section takes no room, as in Word: its line is there for the caret.
    if (options.sections && paragraphs[paraIndex].section && paraIndex < paragraphs.length - 1 && raw.length === 1 && raw[0].end === 0) {
      paraFirstLine.push(lines.length);
      place(paraIndex, raw[0], true, colLeft, y);
      // Nor does the space below it: what follows starts as if after nothing.
      spaceAbove = 0;
      return;
    }
    if (pp.pageBreakBefore && !blankPage()) newPage();
    // What starts with a break goes on after it wherever it falls: nothing has to be kept here.
    const breaks = breakOnly(raw[0]);
    if (!breaks) keepWithNext(paraIndex);
    const total = heightOf(raw);
    if (!breaks && pp.keepLines && y + pp.spacingBefore + total > bottom + EPSILON && total <= pageHeight() + EPSILON && !emptyPage()) {
      nextColumn();
    }
    // Where the paragraph starts, the space it asks for above it included: what its pictures are measured from.
    let paraTop = y;
    y += Math.max(0, pp.spacingBefore - spaceAbove);
    paraFirstLine.push(lines.length);

    // The pictures anchored in it take their place first: its own lines go round the ones the text goes round.
    // Then it is broken again for the place it is in, when a picture is in its way: not what the cache keeps.
    const settle = () => {
      placed = new Map();
      let offset = 0;
      for (const run of paragraphs[paraIndex].runs) {
        const at = offset;
        offset += run.text.length;
        const anchor = anchorOf(run.props.object);
        if (!anchor || placed.has(run.props.object!)) continue;
        const box = floatAt(anchor, run.props.object!, colLeft, paraTop, paraIndex, at);
        placed.set(run.props.object!, box);
        if (anchor.wrap === 'none') continue;
        wraps.push({
          left: box.x - anchor.gap.left,
          right: box.x + box.width + anchor.gap.right,
          top: box.y - anchor.gap.top,
          bottom: box.y + box.height + anchor.gap.bottom,
          whole: anchor.wrap === 'topBottom',
          side: anchor.side,
        });
      }
      const shape = shapeFrom(y, y - paraTop);
      raw = shape ? shapedLines(paraIndex, pp, contentWidth, shape) : breakCached(paraIndex, pp, contentWidth);
    };
    settle();

    for (let i = 0; i < raw.length; ) {
      // How many of the remaining lines go on this page.
      let fit = 0;
      let used = 0;
      let forced = false;
      // The notes the lines refer to take room at the foot of the page: a line goes where its notes, or as much of the last as may be cut, go too.
      let needed = 0;
      let cut = false;
      const counted = new Set<string>();
      while (i + fit < raw.length && !forced && !cut) {
        const rl = raw[i + fit];
        const ids = freshNotes(paraIndex, rl, counted);
        const first = !noteParts.get(pages.length - 1)?.parts.length && !counted.size;
        const whole = ids.length ? noteNeed(ids, false, first) : 0;
        // Over notes the text gets no slack: Word keeps it clear of them. Measured against Word.
        const slack = whole || needed || noteParts.get(pages.length - 1)?.parts.length ? EPSILON : PAGE_SLACK;
        if (y + used + rl.height > bottom - needed - whole + slack && !breakOnly(rl)) {
          if (!ids.length || y + used + rl.height > bottom - needed - noteNeed(ids, true, first) + slack) break;
          cut = true;
        }
        used += rl.height;
        needed += whole;
        ids.forEach((id) => counted.add(id));
        forced = rl.pageBreakAfter || !!rl.columnBreakAfter;
        fit++;
      }
      const rest = raw.length - i - fit;
      if (rest > 0 && !forced) {
        if (pp.widowControl) {
          // A last line alone on the next page takes the one before it along...
          if (rest === 1 && fit > 1) fit--;
          // ...and a first line alone on this page goes with the rest.
          if (i === 0 && fit === 1) fit = 0;
        }
        // A page always takes at least one line, or nothing would ever fit.
        if (fit === 0 && emptyPage()) fit = 1;
      }
      // The stretches of a row stay together: the one that ends it is the one that takes room.
      while (fit > 0 && raw[i + fit - 1].box !== undefined) fit--;
      if (fit === 0 && emptyPage()) for (fit = 1; raw[i + fit - 1].box !== undefined && i + fit < raw.length; ) fit++;
      for (let k = 0; k < fit; k++, i++) {
        place(paraIndex, raw[i], i === raw.length - 1, colLeft, y);
        y += raw[i].height;
      }
      if (forced || i < raw.length) {
        const width = contentWidth;
        if (forced && raw[i - 1].pageBreakAfter) {
          newPage();
          // What comes after a page break starts at the top of its page without the space above it, as in Word.
          spaceAbove = Infinity;
        } else nextColumn(!forced);
        // None of it stayed behind: it starts again at the top of the new page, its pictures with it.
        if (i === 0) {
          paraTop = y;
          settle();
        } else if (i < raw.length && contentWidth !== width) {
          // The rest goes on in a column of another width, broken into lines again for it.
          raw = raw.slice(0, i).concat(breakParagraph(paragraphs[paraIndex], pp, contentWidth, measurer, labels[paraIndex], rules, undefined, undefined, raw[i].start));
        }
        // A paragraph that starts with the break starts where the break sends it, with the space it asks for above it.
        if (i === 1 && breaks && i < raw.length) y += pp.spacingBefore;
      }
    }
    placed = new Map();
    // A paragraph that ends in a break leaves its space below it where the break was, not at the top of what comes next.
    const last = raw[raw.length - 1];
    if (last.pageBreakAfter || last.columnBreakAfter) return;
    y += pp.spacingAfter;
    spaceAbove = pp.spacingAfter;
  };

  /** Lays out the table whose paragraphs start at `from`; returns the index after the ones it placed. */
  const layoutTable = (tableIndex: number, table: Table, from: number): number => {
    // A table in a cell starts at the edge of what the cell holds, even in the layout of Word 2010: measured against it.
    const geometry = tableGeometry(table, contentWidth, legacyTables && !table.parent);
    const { columns } = geometry;
    const total = columns.reduce((a, b) => a + b, 0);
    // A table the text goes round is set where it floats, all of it on this page; the text after it starts where it did.
    const float = continuous ? undefined : table.float;
    const startY = y;
    const keptBottom = bottom;
    const keptAbove = spaceAbove;
    const left = !float
      ? geometry.left
      : float.align === 'right'
        ? contentWidth - total + (legacyTables ? (table.rows[0]?.cells.at(-1)?.padRight ?? table.padRight) : 0)
        : float.align === 'center'
          ? (contentWidth - total) / 2
          : float.align === 'left'
            ? 0
            : float.x;
    if (float) {
      y += float.y;
      bottom = Infinity;
    }
    /** Room between the cells of a table whose cells stand apart, and around them. */
    const gap = table.spacing ?? 0;
    const edges = [0];
    for (const w of columns) edges.push(edges[edges.length - 1] + w);
    const edge = (column: number) => edges[Math.min(column, columns.length)];
    /** The last row of the run of merged cells that the cell starting at `column` of row `rowIndex` is in. */
    const runEnd = (rowIndex: number, column: number) => {
      let k = rowIndex;
      while (cellStartingAt(table.rows[k + 1], column)?.merge === 'continue') k++;
      return k;
    };
    let next = from;
    /**
     * The tables inside cells of this one, each laid out on its own and cut
     * across where a page may break it, by the line box that stands for each
     * band: from `from` to `to` down the table.
     */
    const nested = new Map<RawLine, Stretch & { sub: { page: LayoutPage; offset: number } }>();
    const nestedTable = (start: number, stop: number, width: number): RawLine[] => {
      const page: PageSetup = { width, height: Infinity, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0 };
      const laid = layoutFlow({ ...doc, page, paragraphs: paragraphs.slice(start, stop) }, measurer, cache, { area: () => ({ top: 0, bottom: Infinity }) });
      const sub = { page: laid.pages[0], offset: start };
      return bandsAcross(sub.page, laid.endY, doc.tables).map((band) => {
        const raw: RawLine = { start: 0, end: 0, x: 0, width, ascent: 0, descent: 0, height: band.to - band.from, fragments: [], pageBreakAfter: false };
        nested.set(raw, { ...band, sub });
        return raw;
      });
    };

    // Break the paragraphs of every cell first: a row is as tall as its tallest cell.
    const rows = table.rows.map((row, rowIndex) => {
      let column = row.before;
      let kept = true;
      let any = false;
      // The margins above and below the text are the row's: the widest any of its cells asks for, in every cell. Measured against Word.
      const marginTop = Math.max(0, ...row.cells.map((cell) => cell.padTop ?? table.padTop));
      const marginBottom = Math.max(0, ...row.cells.map((cell) => cell.padBottom ?? table.padBottom));
      const cells = row.cells.map((cell, cellIndex) => {
        const x = edge(column);
        const width = edge(column + cell.span) - x;
        const start = column;
        column += cell.span;
        const padLeft = (cell.padLeft ?? table.padLeft) + gap;
        // Cells that stand apart have room around each, and as much again between them and the edge of the table.
        const padTop = marginTop + gap + (rowIndex === 0 ? gap : 0);
        const padBottom = marginBottom + gap + (rowIndex === table.rows.length - 1 ? gap : 0);
        const inner = Math.max(MIN_LINE_WIDTH, width - padLeft - (cell.padRight ?? table.padRight) - gap);
        const content: { para: number; pp: ResolvedParagraphProps; raw: RawLine[]; before: number }[] = [];
        let height = padTop + padBottom;
        let above = 0;
        const ref = { table: tableIndex, row: row.id, cell: cell.id };
        // Text set vertically is broken once the row is known to be as tall as it is, and does not make it taller.
        // A cell that holds a table is set level.
        let turned = !!cell.direction && cell.merge !== 'continue';
        for (let k = next; turned && k < paragraphs.length && inCell(doc.tables, paragraphs[k].cell, ref); k++) turned = sameCell(paragraphs[k].cell, ref);
        // The pictures of the cell that its text goes round, measured from the top left of what it holds.
        const within = { wraps: [] as Wrap[], edge: 0, width: inner };
        let down = 0;
        while (next < paragraphs.length && inCell(doc.tables, paragraphs[next].cell, ref)) {
          if (!sameCell(paragraphs[next].cell, ref)) {
            // A table inside the cell: laid out on its own as wide as what the cell holds, and set in it in bands, as lines are.
            let stop = next;
            while (stop < paragraphs.length && inCell(doc.tables, paragraphs[stop].cell, ref) && !sameCell(paragraphs[stop].cell, ref)) stop++;
            const raw = nestedTable(next, stop, inner);
            down += heightOf(raw);
            height += heightOf(raw);
            above = 0;
            any = true;
            content.push({ para: next, pp: NO_SPACING, raw, before: 0 });
            next = stop;
            continue;
          }
          const pp = resolveParagraph(paragraphs[next].props);
          const before = Math.max(0, pp.spacingBefore - above);
          if (turned) {
            // Its row is at least one line of it tall, and its margins: measured against Word.
            if (!content.length) height += breakParagraph(paragraphs[next], pp, 1e6, measurer, labels[next], rules)[0].height;
            above = pp.spacingAfter;
            any = true;
            content.push({ para: next++, pp, raw: [], before });
            continue;
          }
          for (const run of paragraphs[next].runs) {
            const anchor = anchorOf(run.props.object);
            // One measured from the page is not in the cell at all.
            if (!anchor || anchor.wrap === 'none' || anchor.fromX === 'page' || anchor.fromY === 'page' || anchor.fromY === 'margin') continue;
            const x = anchor.alignX === 'center' ? (inner - anchor.width) / 2 : anchor.alignX === 'right' ? inner - anchor.width : anchor.alignX ? 0 : anchor.x;
            within.wraps.push({
              left: x - anchor.gap.left,
              right: x + anchor.width + anchor.gap.right,
              top: down + anchor.y - anchor.gap.top,
              bottom: down + anchor.y + anchor.height + anchor.gap.bottom,
              whole: anchor.wrap === 'topBottom',
              side: anchor.side,
            });
          }
          const shape = shapeFrom(down + before, before, within);
          const raw = shape ? shapedLines(next, pp, inner, shape) : breakCached(next, pp, inner);
          down += before + heightOf(raw) + pp.spacingAfter;
          above = pp.spacingAfter;
          height += before + pp.spacingAfter + heightOf(raw);
          kept &&= pp.keepNext;
          any = true;
          content.push({ para: next++, pp, raw, before });
        }
        // A cell merged down holds its text across the rows of the run; one merged with the cell above shows none of its own.
        const last = cell.merge ? runEnd(rowIndex, start) : rowIndex;
        // Text set vertically sits across the cell from the margin it starts at to the far edge, that edge's margin left out: as Word has it.
        const across = inner + (cell.direction === 'up' ? (cell.padRight ?? table.padRight) : (cell.padLeft ?? table.padLeft));
        return { cell, cellIndex, start, x, width, height, content, padLeft, padTop, padBottom, last, inner, across, turned, block: 0 };
      });
      // Horizontal borders take room: the first row's top one, and under every row the thicker of its
      // bottom border and the top border of the row below.
      const below = table.rows[rowIndex + 1]?.cells ?? [];
      const borderTop = rowIndex === 0 ? Math.max(0, ...row.cells.map((c) => c.borderTop ?? 0)) : 0;
      const borderBottom = Math.max(0, ...row.cells.map((c) => c.borderBottom ?? 0), ...below.map((c) => c.borderTop ?? 0));
      // The cells that are the whole of their run of rows say how tall the row is.
      const own = cells.filter((c) => !c.cell.merge || (c.cell.merge === 'start' && c.last === rowIndex)).map((c) => c.height);
      // The least height a row is given is what its cells hold, without the margins above and below their text: measured against Word.
      const margins = Math.max(0, ...cells.map((c) => c.padTop + c.padBottom));
      // A row of a height it has whatever it holds is taller by the margin below its cells' text: measured against Word too.
      const height = row.exact ? row.height + marginBottom + borderTop + borderBottom : Math.max(row.height ? row.height + margins : 0, ...own) + borderTop + borderBottom;
      // A row whose paragraphs all ask to be kept with the next stays with the row after it.
      return { cells, height, borderTop, borderBottom, exact: !!row.exact, cantSplit: !!row.cantSplit, kept: kept && any };
    });
    // A cell merged down whose text needs more room than its rows have makes the last of them taller, as in Word.
    rows.forEach((row, rowIndex) => {
      for (const c of row.cells) {
        if (c.cell.merge !== 'start' || c.last === rowIndex) continue;
        let room = -row.borderTop - rows[c.last].borderBottom;
        for (let k = rowIndex; k <= c.last; k++) room += rows[k].height;
        if (c.height > room && !rows[c.last].exact) rows[c.last].height += c.height - room;
      }
    });
    /** The room of a cell from the top of its row to the bottom of the last row of its run, the borders above and below left out. */
    const cellRoom = (rowIndex: number, c: (typeof rows)[number]['cells'][number]) => {
      let room = -rows[rowIndex].borderTop - rows[c.last].borderBottom;
      for (let k = rowIndex; k <= c.last; k++) room += rows[k].height;
      return room;
    };
    // Text set vertically: its lines are as long as the cell is tall, and stand side by side across it.
    rows.forEach((row, rowIndex) => {
      for (const c of row.cells) {
        if (!c.turned) continue;
        const length = Math.max(MIN_LINE_WIDTH, cellRoom(rowIndex, c) - c.padTop - c.padBottom);
        for (const item of c.content) {
          item.raw = breakCached(item.para, item.pp, length);
          c.block += item.before + heightOf(item.raw) + item.pp.spacingAfter;
        }
      }
    });

    type Item = { para: number; rl: RawLine; last: boolean; above: number; below: number; ghost?: boolean };
    /** The lines of the table as they go on its pages, put in the document once the whole table is laid out. */
    const set: (Item & { left: number; top: number; box: number; on: LayoutPage; copy?: boolean; turn?: Turn })[] = [];
    /** Per grid column, the box on this page that a cell merged with the one above goes on in. */
    let merged: (number | undefined)[] = [];
    /** Per grid column, the lines of a cell merged down that the rows so far had no room for: they go on in the rows below. */
    const carried = new Map<number, Item[]>();
    let keptRows = -1;
    // Heading rows, when the table starts with some and has others: shown again at the top of every page it goes on to.
    let headings = 0;
    while (headings < table.rows.length && table.rows[headings].header) headings++;
    if (headings === table.rows.length) headings = 0;
    let heading: { top: number; height: number; left: number; boxes: CellBox[]; firstBox: number; items: typeof set } | undefined;
    const headingFrom = { top: y, boxes: current().cells.length, page: current() };
    /** Goes on in the next column or page, with the heading rows at its top. */
    const breakTable = (rowIndex: number) => {
      nextColumn();
      merged = [];
      if (!heading || rowIndex < headings) return;
      const dy = y - heading.top;
      const dx = colLeft - heading.left;
      const page = current();
      const base = page.cells.length;
      for (const box of heading.boxes) page.cells.push({ ...box, x: box.x + dx, y: box.y + dy });
      for (const it of heading.items) set.push({ ...it, left: it.left + dx, top: it.top + dy, box: base + it.box - heading.firstBox, on: page, copy: true });
      y += heading.height;
    };

    rows.forEach((row, rowIndex) => {
      if (row.kept && rowIndex > keptRows) {
        // The kept rows, the row after them and, past the end of the table, the first line that follows.
        let needed = 0;
        let end = rowIndex;
        while (end < rows.length && rows[end].kept) needed += rows[end++].height;
        needed += end < rows.length ? rows[end].height : firstLineHeight(next);
        keptRows = end;
        if (y + needed > bottom + EPSILON && needed <= pageHeight() + EPSILON && !emptyPage()) breakTable(rowIndex);
      }
      // The lines each cell still has to place, with the space that goes above and below each.
      const queues = row.cells.map((c): Item[] => {
        if (c.turned) return [];
        const own = c.content.flatMap(({ para, pp, raw, before }) =>
          raw.map((rl, i) => ({ para, rl, last: i === raw.length - 1, above: i === 0 ? before : 0, below: i === raw.length - 1 ? pp.spacingAfter : 0 })),
        );
        if (c.cell.merge !== 'continue') return own;
        // What the run had no room for yet goes on here; the cell's own paragraphs, which Word does not show, take no room.
        const rest = carried.get(c.start) ?? [];
        carried.delete(c.start);
        return [...rest, ...own.map((it) => ({ ...it, ghost: true }))];
      });
      /** Whether the cell's run goes on in the row below: its text does not make this row taller. */
      const spans = row.cells.map((c) => c.last > rowIndex);
      const tall = (it: Item) => (it.ghost ? 0 : it.above + it.rl.height + it.below);

      // A row goes on the page whole when it fits. Otherwise it is broken between lines, each cell
      // going on in the next page, unless it must not be split or not even a first line fits here.
      let first = true;
      for (;;) {
        const lead = (c: (typeof row.cells)[number]) => (first ? row.borderTop + c.padTop : 0);
        const tallest = Math.max(0, ...row.cells.map((c, i) => (spans[i] ? 0 : lead(c) + queues[i].reduce((h, it) => h + tall(it), 0) + c.padBottom)));
        const height = row.exact && first ? row.height : (first ? Math.max(tallest, row.height - row.borderBottom) : tallest) + row.borderBottom;
        const blank = emptyPage();
        let whole = y + height <= bottom + EPSILON;
        if (!whole) {
          const starts = row.cells.every((c, i) => {
            const [head] = queues[i];
            return spans[i] || !head || y + lead(c) + head.above + head.rl.height <= bottom - row.borderBottom + EPSILON;
          });
          if (row.cantSplit || row.exact || !starts) {
            if (!blank) {
              breakTable(rowIndex);
              continue;
            }
            // Nothing above to move away from: a row that must stay whole runs off the page.
            whole = row.cantSplit || row.exact;
          }
        }
        const segment = whole ? height : bottom - y;
        /** The boxes this stretch of the row starts, and how far down the text of each cell went in it. */
        const fresh: number[] = [];
        let reached = -Infinity;

        row.cells.forEach((c, i) => {
          const boxes = current().cells;
          let box = c.cell.merge === 'continue' ? merged[c.start] : undefined;
          const cellLines = c.cell.lines ?? (c.cell.borders ? undefined : {});
          if (box !== undefined) {
            boxes[box].height += segment;
            // The run ends with the bottom line of its last cell.
            const was = boxes[box];
            if (was.lines || c.cell.lines) was.lines = { ...(was.lines ?? FOUR_LINES), bottom: (cellLines ?? FOUR_LINES).bottom };
          } else {
            box = boxes.length;
            fresh.push(box);
            boxes.push({
              x: colLeft + left + c.x + gap,
              y: y + (first ? gap : 0),
              width: c.width - 2 * gap,
              height: segment - (first ? gap : 0) - (whole ? gap : 0),
              table: tableIndex,
              row: rowIndex,
              cell: c.cellIndex,
              borders: c.cell.borders,
              ...(c.cell.lines ? { lines: c.cell.lines } : {}),
              ...(c.cell.shade ? { shade: c.cell.shade } : {}),
            });
          }
          merged[c.start] = c.cell.merge ? box : undefined;
          if (c.turned && first) {
            // Laid out level from the corner the text starts at, then turned about it; what the cell has no room for is cut off.
            const near = colLeft + left + c.x + c.padLeft;
            const turn: Turn =
              c.cell.direction === 'up'
                ? { angle: -90, x: near, y: y + row.borderTop + cellRoom(rowIndex, c) - c.padBottom }
                : { angle: 90, x: near + c.inner, y: y + lead(c) };
            const spare = c.across - c.block;
            let down = turn.y + (spare > 0 && c.cell.valign ? (c.cell.valign === 'center' ? spare / 2 : spare) : 0);
            for (const { para, pp, raw, before } of c.content) {
              raw.forEach((rl, k) => {
                const above = k === 0 ? before : 0;
                const below = k === raw.length - 1 ? pp.spacingAfter : 0;
                down += above;
                set.push({ para, rl, last: k === raw.length - 1, above, below, left: turn.x, top: down, box: box!, on: current(), turn });
                down += rl.height + below;
              });
            }
          }
          let top = y + lead(c);
          /** Set when all the text of a cell merged down goes in now, its rows having room for it on this page. */
          let settled = false;
          if (first && whole && c.cell.merge !== 'continue') {
            // The room of the cell: its row, or all the rows of its run.
            let room = segment - row.borderBottom;
            for (let k = rowIndex + 1; k <= c.last; k++) room += rows[k].height;
            room -= c.last > rowIndex ? rows[c.last].borderBottom - row.borderBottom : 0;
            const spare = room - lead(c) - queues[i].reduce((h, it) => h + tall(it), 0) - c.padBottom;
            const onPage = y + room <= bottom + EPSILON;
            settled = spans[i] && onPage && spare >= -EPSILON;
            // Text set lower in its cell: by what the cell has to spare.
            if (c.cell.valign && spare > 0 && (onPage || !spans[i])) top += c.cell.valign === 'center' ? spare / 2 : spare;
          }
          const end = y + segment - (spans[i] ? 0 : row.borderBottom);
          // A row broken across pages ends on this one with its bottom border: its lines leave room for it, as in Word.
          const room = bottom - row.borderBottom;
          let taken = 0;
          for (const queue = queues[i]; queue.length; taken++) {
            const [it] = queue;
            // On a blank page every cell takes at least one line, or a line taller than the page would never be placed.
            const fits = it.ghost || settled || (spans[i] ? top + it.above + it.rl.height <= end + EPSILON : whole || top + it.above + it.rl.height <= room + EPSILON || (blank && taken === 0));
            if (!fits) {
              // A row of a table in the cell whose text fits here, but not its end, goes on whole in the next page: as Word has it.
              const band = nested.get(it.rl);
              if (band?.tail && !spans[i] && top + it.above + it.rl.height - band.tail <= room + EPSILON) {
                let back = 0;
                while (back < taken && nested.get(set[set.length - 1 - back].rl)?.sub === band.sub && nested.get(set[set.length - 1 - back].rl)!.from > band.rowFrom! + EPSILON) back++;
                const first = back < taken ? nested.get(set[set.length - 1 - back].rl) : undefined;
                if (first?.sub === band.sub && Math.abs(first.from - band.rowFrom!) < EPSILON) back++;
                else back = 0;
                if (back && !(blank && back === taken)) queue.unshift(...set.splice(set.length - back));
              }
              break;
            }
            if (!it.ghost) top += it.above;
            set.push({ ...it, left: colLeft + left + c.x + c.padLeft, top, box, on: current() });
            if (!it.ghost) top += it.rl.height + it.below;
            if (!it.ghost && !spans[i]) reached = Math.max(reached, top);
            queue.shift();
          }
          // What a run merged down had no room for here goes on in the row below.
          if (spans[i] && queues[i].length) carried.set(c.start, queues[i].splice(0));
        });
        // A row broken across pages ends on this one right under its text, with its bottom border: as in Word.
        if (!whole && reached > -Infinity) {
          const boxes = current().cells;
          for (const k of fresh) boxes[k].height = Math.min(boxes[k].height, reached + row.borderBottom - boxes[k].y);
        }
        y += segment;
        if (queues.every((queue) => !queue.length)) break;
        breakTable(rowIndex);
        first = false;
      }
      // The heading rows, once all are placed on one page, are what is shown again on the next.
      if (rowIndex === headings - 1 && headingFrom.page === current()) {
        heading = {
          top: headingFrom.top,
          height: y - headingFrom.top,
          left: colLeft,
          boxes: current().cells.slice(headingFrom.boxes),
          firstBox: headingFrom.boxes,
          items: set.filter((it) => it.on === current() && it.box >= headingFrom.boxes),
        };
      }
      spaceAbove = 0;
    });

    // Lines go into the document in paragraph order, whichever page and row each one landed on;
    // the heading rows shown again come last, as copies of lines already there.
    const ordered = set.filter((it) => !it.copy).sort((a, b) => a.para - b.para);
    const lineOf = new Map<RawLine, Line>();
    let lastPara = -1;
    /** The bands of each table in a cell, in order down it, wherever each one landed. */
    const bandsOf = new Map<object, { it: (typeof set)[number]; from: number; to: number }[]>();
    for (const it of ordered) {
      const band = nested.get(it.rl);
      if (band) bandsOf.set(band.sub, [...(bandsOf.get(band.sub) ?? []), { it, from: band.from, to: band.to }]);
    }
    for (const it of ordered) {
      const inner = nested.get(it.rl);
      if (inner) {
        // A table in a cell, all of it with its first band: its boxes and its lines where the cell has each band, its paragraphs among the cell's.
        const bands = bandsOf.get(inner.sub);
        if (!bands || bands[0].it !== it) continue;
        const { page: sub, offset } = inner.sub;
        /** The band a point down the table is in. */
        const bandAt = (y: number) => {
          let k = 0;
          while (k + 1 < bands.length && bands[k + 1].from <= y + EPSILON) k++;
          return bands[k];
        };
        // A box goes on in each band it is in; the parts of it that land one under the other on a page are one box.
        const pieces = sub.cells.map((box) => {
          const own: { on: LayoutPage; index: number }[] = [];
          for (const { it: at, from, to } of bands) {
            const top = Math.max(box.y, from);
            const bottom = Math.min(box.y + box.height, to);
            if (bottom - top <= EPSILON && !(box.y >= from && box.y < to)) continue;
            const y = at.top + top - from;
            const last = own[own.length - 1];
            const was = last && last.on === at.on ? at.on.cells[last.index] : undefined;
            if (was && Math.abs(was.y + was.height - y) < EPSILON) {
              was.height = y + bottom - top - was.y;
              continue;
            }
            own.push({ on: at.on, index: at.on.cells.length });
            at.on.cells.push({ ...box, x: box.x + at.left, y, height: bottom - top });
          }
          return own;
        });
        for (const f of sub.floats) {
          const { it: at, from } = bandAt(f.y);
          at.on.floats.push({ ...f, x: f.x + at.left, y: f.fixed ? f.y : f.y + at.top - from, para: f.para + offset });
        }
        for (const l of sub.lines) {
          const para = l.para + offset;
          if (para !== lastPara) paraFirstLine.push(lines.length);
          lastPara = para;
          const { it: at, from } = bandAt(l.turn ? turnRect(l.turn, l).y : l.y);
          const dy = at.top - from;
          const box = l.cell === undefined ? undefined : (pieces[l.cell].filter((piece) => piece.on === at.on).pop() ?? pieces[l.cell][0]);
          const line: Line = {
            ...l,
            index: lines.length,
            page: at.on.index,
            para,
            x: l.x + at.left,
            y: l.y + dy,
            baseline: l.baseline + dy,
            fragments: l.fragments.map((f) => ({ ...f, x: f.x + at.left, ...(f.leader ? { leader: { ...f.leader, x: f.leader.x + at.left } } : {}) })),
            ...(l.label ? { label: { ...l.label, x: l.label.x + at.left } } : {}),
            ...movedTurn(l.turn, at.left, dy),
            cell: box ? box.index : at.box,
          };
          lines.push(line);
          at.on.lines.push(line);
        }
        continue;
      }
      if (it.para !== lastPara) {
        paraFirstLine.push(lines.length);
        // The pictures anchored in the paragraph are measured from its top, the space above it included,
        // and from the left of what its cell holds.
        placed = new Map();
        let offset = 0;
        for (const run of paragraphs[it.para].runs) {
          const at = offset;
          offset += run.text.length;
          const anchor = anchorOf(run.props.object);
          if (anchor && !placed.has(run.props.object!)) placed.set(run.props.object!, floatAt(anchor, run.props.object!, it.left, it.top - it.above, it.para, at));
        }
      }
      lastPara = it.para;
      place(it.para, it.rl, it.last, it.left, it.top, it.box, it.on);
      if (it.turn) lines[lines.length - 1].turn = it.turn;
      lineOf.set(it.rl, lines[lines.length - 1]);
    }
    for (const it of set) {
      if (!it.copy) continue;
      const line = lineOf.get(it.rl);
      if (!line) continue;
      const dx = it.left - (line.x - it.rl.x);
      const dy = it.top + (it.rl.pad ?? 0) - line.y;
      it.on.lines.push({
        ...line,
        page: it.on.index,
        x: line.x + dx,
        y: line.y + dy,
        baseline: line.baseline + dy,
        fragments: line.fragments.map((f) => ({ ...f, x: f.x + dx, ...(f.leader ? { leader: { ...f.leader, x: f.leader.x + dx } } : {}) })),
        ...(line.label ? { label: { ...line.label, x: line.label.x + dx } } : {}),
        ...movedTurn(line.turn, dx, dy),
        cell: it.box,
      });
    }
    placed = new Map();

    if (float) {
      // The text after the table goes round it, from where the table started.
      wraps.push({
        left: colLeft + left - float.gapLeft,
        right: colLeft + left + total + float.gapRight,
        top: startY + float.y - float.gapTop,
        bottom: y + float.gapBottom,
        whole: false,
        side: 'both',
      });
      y = startY;
      bottom = keptBottom;
      spaceAbove = keptAbove;
    }
    return next;
  };

  /** The tables that have paragraphs in this flow. */
  const flowTables = new Set(paragraphs.map((para) => para.cell?.table));
  /** Lays out the paragraphs from `from` up to, not including, `to`. */
  const run = (from: number, to: number) => {
    /** The table a paragraph is in at the top of this flow: the one around the table of its cell, when that one is in the flow too. */
    const outermost = (index: number | undefined) => {
      for (let k = 0; index !== undefined && k < 64; k++) {
        const parent = doc.tables?.[index]?.parent?.table;
        if (parent === undefined || !flowTables.has(parent)) break;
        index = parent;
      }
      return index;
    };
    for (let i = from; i < to; ) {
      // A cell that starts with a table starts the table around it too.
      const index = outermost(paragraphs[i].cell?.table);
      const table = index === undefined ? undefined : doc.tables?.[index];
      // A cell paragraph the table did not take (out of order, or of a missing table) flows as plain text.
      const end = table && !(i > 0 && outermost(paragraphs[i - 1].cell?.table) === index) ? layoutTable(index!, table, i) : i;
      if (end > i) i = end;
      else flow(i++);
    }
  };

  /** Everything the layout has done so far, to go back to it and lay out again from there. */
  const mark = () => {
    const at = current();
    return {
      pages: pages.length,
      on: { lines: at.lines.length, cells: at.cells.length, floats: at.floats.length, rules: at.rules?.length ?? 0, columns: at.columns?.length ?? 0 },
      lines: lines.length,
      firsts: paraFirstLine.length,
      state: { y, spaceAbove, top, bottom, col, colTop, deepest, columnFrom, columnStarts, keptUntil },
      wraps: wraps.slice(),
      notes: { parts: new Map([...noteParts].map(([k, v]) => [k, { parts: v.parts.slice(), room: v.room }])), placed: new Set(notesPlaced), carried: carried.slice() },
    };
  };
  const restore = (m: ReturnType<typeof mark>) => {
    pages.length = m.pages;
    const at = current();
    at.lines.length = m.on.lines;
    at.cells.length = m.on.cells;
    at.floats.length = m.on.floats;
    if (at.rules) at.rules.length = m.on.rules;
    if (at.columns) at.columns.length = m.on.columns;
    lines.length = m.lines;
    paraFirstLine.length = m.firsts;
    ({ y, spaceAbove, top, bottom, col, colTop, deepest, columnFrom, columnStarts, keptUntil } = m.state);
    colLeft = columns[col].x;
    contentWidth = columns[col].width;
    wraps = m.wraps.slice();
    placed = new Map();
    noteParts.clear();
    for (const [k, v] of m.notes.parts) noteParts.set(k, { parts: v.parts.slice(), room: v.room });
    notesPlaced.clear();
    for (const id of m.notes.placed) notesPlaced.add(id);
    carried = m.notes.carried.slice();
  };

  /**
   * Evens out the columns of the section just laid out, on the page it ends on,
   * as Word does before a section that starts on the same page: the text is
   * laid out again down shorter columns, as short as they can be with all of
   * it still on that page.
   */
  const balance = (m: ReturnType<typeof mark>, from: number, to: number) => {
    const last = pages.length - 1;
    let lo = colTop;
    let hi = bottom;
    const fits = (limit: number) => {
      restore(m);
      cap = { page: last, bottom: limit };
      if (pages.length - 1 === last) bottom = Math.min(bottom, limit);
      run(from, to);
      return pages.length - 1 === last;
    };
    for (let k = 0; k < 16 && hi - lo > 0.5; k++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    fits(hi);
    cap = undefined;
    // The page goes on below the columns as far down as it did, over its notes.
    bottom = area(section, pages.length - 1).bottom - (noteParts.get(pages.length - 1)?.room ?? 0);
  };

  /** Goes on to section `next`, where it asks to start. */
  const startSection = (next: number) => {
    const before = section;
    const s = sections[next];
    const geometry = columnGeometry(s.page, s.columns);
    // A page of another size is always a new one.
    const samePage = s.page.width === before.page.width && s.page.height === before.page.height;
    let start = samePage ? s.start : 'nextPage';
    if (start === 'nextColumn' && (geometry.length !== columns.length || col + 1 >= columns.length)) start = 'nextPage';
    const enter = () => {
      section = s;
      sectionIndex = next;
      page = s.page;
      columns = geometry;
    };
    if (start === 'continuous') {
      // It starts under the deepest column of the one before, in columns of its own.
      closeColumns();
      const wasColumns = before.columns.count > 1;
      enter();
      y = deepest;
      colTop = y;
      setColumn(0);
      if (wasColumns) spaceAbove = 0;
      return;
    }
    if (start === 'nextColumn') {
      enter();
      nextColumn(false);
      return;
    }
    const begin = () => {
      sectionFirst = pages.length;
      firsts.add(sectionFirst);
      pushPage();
    };
    if (blankPage()) {
      // Nothing is on this page yet: the section takes it.
      enter();
      current().section = next;
      sectionFirst = pages.length - 1;
      firsts.add(sectionFirst);
      startArea();
      return;
    }
    closeColumns();
    // The space below the last paragraph of the section before still counts against the space above the first of this one, on its new page; not on a page of another size.
    const after = samePage ? spaceAbove : 0;
    enter();
    begin();
    // A section that starts on an odd page, or on an even one, leaves a page blank when it has to.
    const number = pages.length;
    if ((start === 'oddPage' && number % 2 === 0) || (start === 'evenPage' && number % 2 === 1)) {
      firsts.delete(sectionFirst);
      begin();
    }
    spaceAbove = after;
  };

  let from = 0;
  sections.forEach((s, k) => {
    if (k > 0) startSection(k);
    const m = mark();
    run(from, Math.min(s.end, paragraphs.length));
    const next = sections[k + 1];
    const sameSize = next && next.page.width === s.page.width && next.page.height === s.page.height;
    if (!continuous && next?.start === 'continuous' && sameSize && columns.length > 1) balance(m, from, Math.min(s.end, paragraphs.length));
    from = s.end;
  });
  closeColumns();

  return { page: sections[sections.length - 1].page, pages, lines, paraFirstLine, endY: y, firsts, notes: noteParts };
}

/** Stories with their page fields filled in, so the same page always gets the same paragraphs. */
const filledStories = new WeakMap<Story, Map<string, Story>>();

/** `story` as it reads on a page: PAGE and NUMPAGES results replaced by the real numbers. */
export function storyOnPage(story: Story, pageNumber: number, pageCount: number): Story {
  return fillFields(story, pageNumber, pageCount);
}

/**
 * The offset in `to` of what is at `offset` in `from`, two states of one
 * paragraph that differ only in the text of their fields: the paragraph of a
 * header and the same one as a page shows it. An offset inside a field goes
 * to its end.
 */
export function mapFieldOffset(from: Paragraph, to: Paragraph, offset: number): number {
  if (from === to) return offset;
  let a = 0;
  let b = 0;
  for (let i = 0; i < from.runs.length && i < to.runs.length; i++) {
    const lenA = from.runs[i].text.length;
    const lenB = to.runs[i].text.length;
    if (offset <= a + lenA) {
      if (lenA === lenB) return b + offset - a;
      return offset === a ? b : b + lenB;
    }
    a += lenA;
    b += lenB;
  }
  return b;
}

const bandLayouts = new WeakMap<Band, Layout>();

/**
 * The header or the footer of a page as a layout of its own, for the
 * functions that find lines and positions: its paragraphs are those of the
 * story, and its only page is page 0.
 */
export function bandLayout(layout: Layout, part: 'header' | 'footer' | FootnotePart | TextBoxPart, pageIndex: number): Layout | undefined {
  const page = layout.pages[pageIndex];
  const band =
    part === 'header' || part === 'footer'
      ? page?.[part]
      : part.startsWith('textbox:')
        ? page?.textBoxes?.find((box) => box.part === part)
        : page?.footnotes?.notes.find((note) => note.part === part);
  if (!band) return undefined;
  let view = bandLayouts.get(band);
  if (!view) {
    const lines = band.lines.map((line, index) => ({ ...line, index, page: 0 }));
    const paraFirstLine: number[] = [];
    lines.forEach((line, i) => (paraFirstLine[line.para] ??= i));
    view = { page: layout.page, pages: [{ index: 0, lines, cells: band.cells, floats: band.floats }], lines, paraFirstLine };
    bandLayouts.set(band, view);
  }
  return view;
}

function fillFields(story: Story, pageNumber: number, pageCount: number): Story {
  const hasFields = (r: { props: { field?: string } }) => !!r.props.field;
  if (!story.paragraphs.some((p) => p.runs.some(hasFields))) return story;
  let filled = filledStories.get(story);
  if (!filled) filledStories.set(story, (filled = new Map()));
  const key = `${pageNumber}/${pageCount}`;
  let out = filled.get(key);
  if (!out) {
    out = {
      ...story,
      paragraphs: story.paragraphs.map((p) =>
        p.runs.some(hasFields)
          ? { ...p, runs: p.runs.map((r) => (r.props.field ? { ...r, text: String(r.props.field === 'PAGE' ? pageNumber : pageCount) } : r)) }
          : p,
      ),
    };
    if (filled.size > 500) filled.clear();
    filled.set(key, out);
  }
  return out;
}

const numberOf = (numbers: Map<string, number>, id: string | undefined) => (id === undefined ? undefined : numbers.get(id)?.toString());

/** The notes at the foot of the pages of a document: what the flow needs of them, and how to set out those of a page. */
function footnoteFlow(doc: Doc, numbers: Map<string, number>, measurer: TextMeasurer, cache: LayoutCache | undefined) {
  const byId = new Map(shownFootnotes(doc).map((note) => [note.id, note]));
  // The references of each paragraph, by offset.
  const refs = new Map<number, { offset: number; id: string }[]>();
  for (const ref of footnoteReferences(doc)) if (byId.has(ref.id)) (refs.get(ref.para) ?? refs.set(ref.para, []).get(ref.para)!).push(ref);
  const endless = (width: number): PageSetup => ({ width, height: Infinity, marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0 });
  const laidOut = new Map<string, { flow: ReturnType<typeof layoutFlow>; shape: NoteShape }>();
  const noteLayout = (id: string, width: number) => {
    const key = `${id}@${width}`;
    let made = laidOut.get(key);
    if (!made) {
      const note = byId.get(id)!;
      const paragraphs = numberParagraphs(note.paragraphs, (xml) => (isFootnoteMark(xml) ? numberOf(numbers, id) : undefined));
      const flow = layoutFlow({ ...doc, page: endless(width), paragraphs, tables: note.tables }, measurer, cache, { area: () => ({ top: 0, bottom: Infinity }) });
      // It may go on at the foot of the next page after a line outside its tables, leaving no line of a paragraph alone on either side.
      const own = flow.lines.filter((l) => l.cell === undefined);
      const cuts: number[] = [];
      own.forEach((line, k) => {
        const next = own[k + 1];
        if (!next) return;
        const ofPara = own.filter((l) => l.para === line.para);
        const at = ofPara.indexOf(line) + 1;
        if (next.para !== line.para || (at >= 2 && ofPara.length - at >= 2)) cuts.push(next.y);
      });
      made = { flow, shape: { height: flow.endY, cuts } };
      laidOut.set(key, made);
    }
    return made;
  };
  // The paragraph the line over the notes is drawn in.
  const separator = doc.footnoteSeparator ?? { props: { spacingBefore: 0, spacingAfter: 0, lineHeight: 1 }, runs: [{ text: '', props: doc.styles?.[0]?.run ?? {} }] };
  const rule = layoutFlow({ ...doc, page: endless(doc.page.width), paragraphs: [separator], tables: undefined }, measurer, cache, { area: () => ({ top: 0, bottom: Infinity }) });
  const ruleLine = rule.lines[0];
  const flow: FlowNotes = {
    refs: (para, start, end) => (refs.get(para) ?? []).filter((r) => r.offset >= start && r.offset < end).map((r) => r.id),
    shape: (id, width) => noteLayout(id, width).shape,
    separator: rule.endY,
  };
  /** The notes of a page set out at its foot, which is at `bottom`. */
  const place = (held: { parts: NotePart[]; room: number }, page: PageSetup, bottom: number): FootnoteArea => {
    const width = page.width - page.marginLeft - page.marginRight;
    const top = bottom - held.room;
    // The line, two inches long, a little above the baseline of its paragraph. Measured against Word.
    const size = ruleLine?.fragments[0]?.font.size ?? 11;
    const baseline = top + (ruleLine ? ruleLine.baseline : rule.endY * 0.8);
    const area: FootnoteArea = { rule: { x: page.marginLeft, y: baseline - size * 0.26, width: Math.min(144, width), height: 0.48 }, notes: [] };
    let y = top + rule.endY;
    for (const part of held.parts) {
      const { flow: laid } = noteLayout(part.id, width);
      const dy = y - part.from;
      const inside = (top: number) => top >= part.from - EPSILON && top < part.to - EPSILON;
      const [first] = laid.pages;
      area.notes.push({
        id: part.id,
        from: part.from,
        lines: first.lines.filter((l) => inside(l.y)).map((l) => ({ ...l, x: l.x + page.marginLeft, y: l.y + dy, baseline: l.baseline + dy, fragments: l.fragments.map((f) => ({ ...f, x: f.x + page.marginLeft })), ...(l.label ? { label: { ...l.label, x: l.label.x + page.marginLeft } } : {}), ...movedTurn(l.turn, page.marginLeft, dy) })),
        cells: first.cells.filter((c) => inside(c.y)).map((c) => ({ ...c, x: c.x + page.marginLeft, y: c.y + dy })),
        floats: first.floats.filter((f) => inside(f.y)).map((f) => ({ ...f, x: f.x + page.marginLeft, y: f.y + dy, part: footnotePart(part.id) })),
        part: footnotePart(part.id),
      });
      y += part.to - part.from;
    }
    return area;
  };
  return { ...flow, place };
}

/** Each text box of a page, wherever its drawing is (in the text, a header, a footer, a note), with its text set out inside it. */
function textBoxBands(doc: Doc, page: LayoutPage, setup: PageSetup, measurer: TextMeasurer, cache: LayoutCache | undefined): TextBoxBand[] {
  const frames: { xml: string; x: number; y: number; width: number; height: number; behind?: boolean }[] = [];
  const from = (band: Band | LayoutPage | undefined) => {
    if (!band) return;
    for (const float of band.floats) if (textBoxId(float.xml) !== undefined) frames.push(float);
    for (const line of band.lines) {
      for (const f of line.fragments) {
        if (f.kind === 'object' && f.width > 0 && textBoxId(f.props.object)) frames.push({ xml: f.props.object, x: f.x, y: line.baseline - f.ascent, width: f.width, height: f.ascent });
      }
    }
  };
  from(page);
  from(page.header);
  from(page.footer);
  for (const note of page.footnotes?.notes ?? []) from(note);
  const out: TextBoxBand[] = [];
  for (const frame of frames) {
    const id = textBoxId(frame.xml)!;
    const box = textBoxOf(doc, id);
    if (!box) continue;
    const look = textBoxLook(frame.xml);
    const { inset } = look;
    const width = Math.max(1, frame.width - inset.left - inset.right);
    const flow = layoutFlow({ ...doc, page: { ...setup, width, marginLeft: 0, marginRight: 0 }, paragraphs: box.paragraphs, tables: box.tables }, measurer, cache, { area: () => ({ top: 0, bottom: Infinity }) });
    const [first] = flow.pages;
    const inner = frame.height - inset.top - inset.bottom;
    // One that fits its text is as tall as it; any other shows what fits, as Word cuts the rest.
    const height = look.grows ? flow.endY + inset.top + inset.bottom : frame.height;
    const spare = Math.max(0, inner - flow.endY);
    const dx = frame.x + inset.left;
    const dy = frame.y + inset.top + (look.grows ? 0 : look.align === 'middle' ? spare / 2 : look.align === 'bottom' ? spare : 0);
    const fits = (top: number, bottom: number) => look.grows || bottom <= inner + EPSILON || top < EPSILON;
    const part = textBoxPart(id);
    out.push({
      id,
      part,
      frame: { x: frame.x, y: frame.y, width: frame.width, height },
      look,
      ...(frame.behind ? { behind: true } : {}),
      lines: first.lines
        .filter((l) => fits(l.y, l.y + l.height))
        .map((l) => ({ ...l, x: l.x + dx, y: l.y + dy, baseline: l.baseline + dy, fragments: l.fragments.map((f) => ({ ...f, x: f.x + dx })), ...(l.label ? { label: { ...l.label, x: l.label.x + dx } } : {}), ...movedTurn(l.turn, dx, dy) })),
      cells: first.cells.filter((c) => fits(c.y, c.y + c.height)).map((c) => ({ ...c, x: c.x + dx, y: c.y + dy })),
      floats: first.floats.map((f) => ({ ...f, x: f.x + dx, y: f.y + dy, part })),
    });
  }
  return out;
}

/** How tall a text box that grows with its text is, its text set out at the width it has: Word makes it so when it lays it out. */
function grownBoxes(doc: Doc, measurer: TextMeasurer, cache: LayoutCache | undefined): ((xml: string, anchor: Anchor) => number | undefined) | undefined {
  if (!doc.textBoxes?.length) return undefined;
  const known = new Map<string, number>();
  return (xml, anchor) => {
    const id = textBoxId(xml);
    const box = id === undefined ? undefined : textBoxOf(doc, id);
    if (!box) return undefined;
    const look = textBoxLook(xml);
    if (!look.grows) return undefined;
    const width = Math.max(1, anchor.width - look.inset.left - look.inset.right);
    const key = `${id}\u0000${width}`;
    let height = known.get(key);
    if (height === undefined) {
      const flow = layoutFlow({ ...doc, page: { ...doc.page, width, marginLeft: 0, marginRight: 0 }, paragraphs: box.paragraphs, tables: box.tables }, measurer, cache, { area: () => ({ top: 0, bottom: Infinity }) });
      height = flow.endY + look.inset.top + look.inset.bottom;
      known.set(key, height);
    }
    return height;
  };
}

/** `cache` must always be used with the same measurer. */
export function layoutDocument(doc: Doc, measurer: TextMeasurer, cache?: LayoutCache): Layout {
  const sections = sectionsOf(doc);
  const boxHeight = grownBoxes(doc, measurer, cache);

  /** A header or footer laid out from y = 0 across `page`, and its height. `part` is where its pictures live. */
  const band = (story: Story, part: StoryPart, pageNumber: number, pageCount: number, page: PageSetup) => {
    const filled = fillFields(story, pageNumber, pageCount);
    const flow = layoutFlow({ ...doc, page, paragraphs: filled.paragraphs, tables: filled.tables }, measurer, cache, { area: () => ({ top: 0, bottom: Infinity }), boxHeight });
    const [first] = flow.pages;
    const own = part !== storyKind(part);
    const at = (dy: number): Band => ({
      lines: first.lines.map((l) => ({ ...l, y: l.y + dy, baseline: l.baseline + dy, ...movedTurn(l.turn, 0, dy) })),
      cells: first.cells.map((c) => ({ ...c, y: c.y + dy })),
      floats: first.floats.map((f) => ({ ...f, y: f.fixed ? f.y : f.y + dy, part })),
      ...(own ? { part } : {}),
    });
    return { height: flow.endY, at, varies: filled !== story };
  };
  /** The header and the footer of a kind of page, and the text area they leave: one too tall for its margin takes room from it, as in Word. */
  const frame = (page: PageSetup, head: Story | undefined, foot: Story | undefined, parts: [StoryPart, StoryPart]) => {
    const header = head?.paragraphs.length ? { story: head, part: parts[0], ...band(head, parts[0], 1, 1, page) } : undefined;
    const footer = foot?.paragraphs.length ? { story: foot, part: parts[1], ...band(foot, parts[1], 1, 1, page) } : undefined;
    const headerTop = page.headerDistance ?? 36;
    const footerBottom = page.height - (page.footerDistance ?? 36);
    return {
      page,
      header,
      footer,
      headerTop,
      footerBottom,
      top: header ? Math.max(page.marginTop, headerTop + header.height) : page.marginTop,
      bottom: footer ? Math.min(page.height - page.marginBottom, footerBottom - footer.height) : page.height - page.marginBottom,
    };
  };
  /** The frames already worked out, by page setup and by what they hold. */
  const frames = new Map<PageSetup, Map<string, ReturnType<typeof frame> & { parts: { header: StoryPart; footer: StoryPart } }>>();
  /** The header or the footer a page of a section shows, and the part it is: on the first page, its own when the section says it has them, even if that is nothing. */
  const shown = (section: FlowSection, kind: 'header' | 'footer', first: boolean): { story?: Story; part: StoryPart } => {
    const own = (base: BasePart) => sectionPart(base, section.last ? undefined : section.index);
    if (first && section.firstPage) return { story: section.firstPage[kind], part: own(kind === 'header' ? 'firstHeader' : 'firstFooter') };
    if (section[kind]) return { story: section[kind], part: own(kind) };
    // One that shows none has a place for its own.
    if (kind === 'header' ? section.noHeader : section.noFooter) return { part: own(kind) };
    return { story: doc[kind], part: kind };
  };
  const frameFor = (section: FlowSection, _pageIndex: number, first: boolean) => {
    const head = shown(section, 'header', first);
    const foot = shown(section, 'footer', first);
    const key = `${head.part}:${!!head.story}:${foot.part}:${!!foot.story}`;
    let byPage = frames.get(section.page);
    if (!byPage) frames.set(section.page, (byPage = new Map()));
    let made = byPage.get(key);
    if (!made) byPage.set(key, (made = { ...frame(section.page, head.story, foot.story, [head.part, foot.part]), parts: { header: head.part, footer: foot.part } }));
    return made;
  };

  // The notes at the foot of the pages: the references show their numbers, and so do the notes.
  const numbers = footnoteNumbers(doc);
  const body = numbers.size ? { ...doc, paragraphs: numberParagraphs(doc.paragraphs, (xml) => numberOf(numbers, footnoteReferenceId(xml))) } : doc;
  const notes = numbers.size ? footnoteFlow(doc, numbers, measurer, cache) : undefined;
  const { endY: _, firsts, notes: noteParts, ...layout } = layoutFlow(body, measurer, cache, { area: frameFor, sections, notes, boxHeight });
  const count = layout.pages.length;
  // One that says the page it is on is laid out again for each; any other is the same, the very same, on all its pages.
  const same = new Map<object, Band>();
  const once = (of: { at: (dy: number) => Band }, dy: number) => same.get(of) ?? (same.set(of, of.at(dy)), same.get(of)!);
  for (const p of layout.pages) {
    const section = sections[p.section ?? sections.length - 1];
    const { header, footer, page, headerTop, footerBottom, parts } = frameFor(section, p.index, firsts.has(p.index));
    if (parts.header !== 'header' || parts.footer !== 'footer') p.parts = { ...(parts.header !== 'header' ? { header: parts.header } : {}), ...(parts.footer !== 'footer' ? { footer: parts.footer } : {}) };
    if (sections.length > 1) p.setup = page;
    if (header) p.header = header.varies ? band(header.story, header.part, p.index + 1, count, page).at(headerTop) : once(header, headerTop);
    if (footer) p.footer = footer.varies ? band(footer.story, footer.part, p.index + 1, count, page).at(footerBottom - footer.height) : once(footer, footerBottom - footer.height);
    const held = noteParts.get(p.index);
    if (held && notes) p.footnotes = notes.place(held, page, frameFor(section, p.index, firsts.has(p.index)).bottom);
    if (doc.textBoxes?.length) {
      const boxes = textBoxBands(doc, p, page, measurer, cache);
      if (boxes.length) p.textBoxes = boxes;
    }
  }
  // A document of one section says nothing of sections on its pages.
  if (sections.length === 1) for (const p of layout.pages) delete p.section;
  return layout;
}

/**
 * The text of the document down one page as tall as it needs: no header or
 * footer, nothing that starts another page, and no picture anywhere but in
 * its line. The page of the layout says how tall it came out.
 */
export function layoutContinuous(doc: Doc, measurer: TextMeasurer, cache?: LayoutCache): Layout {
  const { page } = doc;
  // The references to notes show their numbers; the notes themselves are at the foot of pages, which this has none of.
  const numbers = footnoteNumbers(doc);
  const body = numbers.size ? { ...doc, paragraphs: numberParagraphs(doc.paragraphs, (xml) => numberOf(numbers, footnoteReferenceId(xml))) } : doc;
  const { endY, firsts: _, notes: __, ...layout } = layoutFlow(body, measurer, cache, { area: () => ({ top: page.marginTop, bottom: Infinity }), continuous: true });
  return { ...layout, page: { ...page, height: endY + page.marginBottom } };
}

/** The line that shows the caret for `pos`. At a wrap boundary that is the start of the next line. */
export function lineForPosition(layout: Layout, pos: Position): Line {
  const first = layout.paraFirstLine[pos.para];
  let line = layout.lines[first];
  for (let i = first + 1; i < layout.lines.length; i++) {
    const candidate = layout.lines[i];
    if (candidate.para !== pos.para || candidate.start > pos.offset) break;
    line = candidate;
  }
  return line;
}

function fragmentX(fragment: Fragment, offset: number, measurer: TextMeasurer): number {
  const k = Math.max(0, Math.min(offset - fragment.start, fragment.text.length));
  if (k === 0) return fragment.x;
  if (fragment.kind !== 'text') return fragment.x + fragment.width;
  const prefix = fragment.text.slice(0, k);
  const spacing = fragment.wordSpacing ? countSpaces(prefix) * fragment.wordSpacing : 0;
  return fragment.x + measurer.width(prefix, fragment.font) + spacing;
}

export function xAtOffset(line: Line, offset: number, measurer: TextMeasurer): number {
  if (!line.fragments.length) return line.x;
  for (const fragment of line.fragments) {
    if (offset <= fragment.end) return fragmentX(fragment, offset, measurer);
  }
  const last = line.fragments[line.fragments.length - 1];
  return last.x + last.width;
}

/** Last offset on which the caret still renders on this line. */
export function lineEndOffset(line: Line): number {
  if (line.lastInParagraph || line.end === line.start) return line.end;
  const last = line.fragments[line.fragments.length - 1];
  const ch = last.text[last.text.length - 1];
  // Stay before the trailing space or break; past it the caret belongs to the next line.
  return ch === ' ' || ch === '\n' || ch === '\f' ? line.end - 1 : line.end;
}

export function offsetAtX(line: Line, x: number, measurer: TextMeasurer): number {
  let offset = line.end;
  for (const fragment of line.fragments) {
    if (x >= fragment.x + fragment.width) continue;
    if (x <= fragment.x) {
      offset = fragment.start;
    } else if (fragment.kind !== 'text') {
      offset = x - fragment.x < fragment.width / 2 ? fragment.start : fragment.end;
    } else {
      // Largest offset whose caret is left of x, then round to the nearest side.
      let lo = fragment.start;
      let hi = fragment.end;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (fragmentX(fragment, mid, measurer) <= x) lo = mid;
        else hi = mid - 1;
      }
      offset = lo;
      if (lo < fragment.end) {
        const left = fragmentX(fragment, lo, measurer);
        const right = fragmentX(fragment, lo + 1, measurer);
        if (x - left > right - x) offset = lo + 1;
      }
    }
    break;
  }
  return Math.min(offset, lineEndOffset(line));
}

export function caretRect(layout: Layout, measurer: TextMeasurer, pos: Position): Rect {
  const line = lineForPosition(layout, pos);
  return turnRect(line.turn, { page: line.page, x: xAtOffset(line, pos.offset, measurer), y: line.y, width: 0, height: line.height });
}

/**
 * Of the lines of a page set out in columns, those of the column the point is
 * in, or the nearest one of that part of the page. Elsewhere, the lines in no
 * column.
 */
function columnAt(page: LayoutPage, lines: Line[], x: number, y: number): Line[] {
  const columns = page.columns;
  if (!columns?.length) return lines;
  const within = (l: Line, c: ColumnBox) => l.index >= c.from && l.index < c.to;
  const band = columns.filter((c) => y >= c.y && y < c.y + c.height);
  if (!band.length) {
    const outside = lines.filter((l) => !columns.some((c) => within(l, c)));
    return outside.length ? outside : lines;
  }
  const gap = (c: ColumnBox) => (x < c.x ? c.x - x : x > c.x + c.width ? x - c.x - c.width : 0);
  let column = band[0];
  for (const c of band) if (gap(c) < gap(column)) column = c;
  const inside = lines.filter((l) => within(l, column));
  return inside.length ? inside : lines;
}

/** Maps a point in page coordinates to the nearest document position. */
export function hitTest(layout: Layout, measurer: TextMeasurer, pageIndex: number, x: number, y: number): Position {
  const page = layout.pages[Math.max(0, Math.min(pageIndex, layout.pages.length - 1))];
  // Inside a table cell only its own lines count; outside, only the lines that are in no cell.
  // Beside a table row, the nearest cell of that row takes the click.
  let box = -1;
  let distance = Infinity;
  page.cells.forEach((c, i) => {
    if (y < c.y || y >= c.y + c.height) return;
    const d = x < c.x ? c.x - x : x >= c.x + c.width ? x - (c.x + c.width) + EPSILON : 0;
    // Of boxes one inside another, a table's in a cell, the inner one, which comes after.
    if (d <= distance) {
      box = i;
      distance = d;
    }
  });
  let pageLines = page.lines.filter((l) => l.cell === (box < 0 ? undefined : box));
  if (!pageLines.length) pageLines = page.lines;
  if (!pageLines.length) {
    // A page left empty by a page break: fall back to the closest line before it.
    const before = layout.lines.filter((l) => l.page < page.index);
    pageLines = [before[before.length - 1] ?? layout.lines[0]];
  }
  if (box < 0) pageLines = columnAt(page, pageLines, x, y);
  // Text set vertically is looked for in its own layout, as it is before being turned.
  const turn = box < 0 ? undefined : pageLines[0].turn;
  if (turn) ({ x, y } = unturnPoint(turn, x, y));
  let line = pageLines[0];
  for (const candidate of pageLines) {
    if (candidate.y <= y) line = candidate;
    else break;
  }
  // A row in two, one stretch on each side of a picture: the one the point is in, or nearest to.
  const away = (l: Line) => (x < l.x ? l.x - x : x > l.x + l.width ? x - l.x - l.width : 0);
  for (const other of pageLines) {
    if (other !== line && other.cell === line.cell && Math.abs(other.y - line.y) < EPSILON && away(other) < away(line)) line = other;
  }
  return { para: line.para, offset: offsetAtX(line, x, measurer) };
}

/**
 * The line the caret moves to from `line` when going up (-1) or down (1) at
 * the horizontal position `x`. In a table that is the cell above or below,
 * not the next cell of the same row.
 */
export function adjacentLine(layout: Layout, line: Line, x: number, dir: -1 | 1): Line | undefined {
  const page = layout.pages[line.page];
  const box = line.cell === undefined ? undefined : page.cells[line.cell];
  /** Where a line is on the page, or in the layout of the text it is turned with when the starting line is. */
  const at = (l: Line) => (l.turn && l.turn !== line.turn ? turnRect(l.turn, l) : l);
  const beside = (l: Line) => {
    if (!box || l.cell === undefined || l.cell === line.cell) return false;
    const other = page.cells[l.cell];
    return other.table === box.table && other.row === box.row;
  };
  const beyond = (l: Line) =>
    dir > 0 ? at(l).y >= line.y + line.height - EPSILON : at(l).y + at(l).height <= line.y + EPSILON;
  /** The candidate closest to the starting line. */
  const nearest = (candidates: Line[]) => {
    let best: Line | undefined;
    for (const l of candidates) {
      if (!best || (dir > 0 ? at(l).y < at(best).y - EPSILON : at(l).y + at(l).height > at(best).y + at(best).height + EPSILON)) best = l;
    }
    // Of the stretches of a row in two, the one nearest to where the caret was.
    const away = (l: Line) => (x < at(l).x ? at(l).x - x : x > at(l).x + at(l).width ? x - at(l).x - at(l).width : 0);
    for (const l of candidates) {
      if (best && l !== best && l.cell === best.cell && Math.abs(at(l).y - at(best).y) < EPSILON && away(l) < away(best)) best = l;
    }
    return best;
  };

  if (line.turn && box) {
    // Text set vertically: the next line of it, or out of its cell as if the cell were one line.
    const own = nearest(page.lines.filter((l) => l !== line && l.turn === line.turn && beyond(l)));
    if (own) return own;
    const whole: Line = { ...line, turn: undefined, x: box.x, y: box.y, width: box.width, height: box.height };
    const out = adjacentLine(layout, whole, box.x + box.width / 2, dir);
    return out?.turn === line.turn ? undefined : out;
  }

  let found = nearest(page.lines.filter((l) => l !== line && !(line.cell !== undefined && l.cell === line.cell && l.turn) && !beside(l) && beyond(l)));
  for (let p = line.page + dir; !found && layout.pages[p]; p += dir) found = nearest(layout.pages[p].lines);
  if (!found || found.cell === undefined || (found.page === line.page && found.cell === line.cell)) return found;

  // Landing on a table row: take the cell of that row under `x`.
  const target = layout.pages[found.page];
  const row = target.cells[found.cell];
  let bestCell = found.cell;
  let bestDistance = Infinity;
  target.cells.forEach((c, i) => {
    if (c.table !== row.table || c.row !== row.row || !target.lines.some((l) => l.cell === i)) return;
    const distance = x < c.x ? c.x - x : x > c.x + c.width ? x - (c.x + c.width) : 0;
    if (distance < bestDistance) {
      bestCell = i;
      bestDistance = distance;
    }
  });
  const inCell = target.lines.filter((l) => l.cell === bestCell);
  return dir > 0 ? inCell[0] : inCell[inCell.length - 1];
}

const PARAGRAPH_MARK_WIDTH = 4;

export function selectionRects(layout: Layout, measurer: TextMeasurer, range: Range): Rect[] {
  const rects: Rect[] = [];
  if (comparePositions(range.from, range.to) === 0) return rects;
  const first = lineForPosition(layout, range.from).index;
  for (let i = first; i < layout.lines.length; i++) {
    const line = layout.lines[i];
    if (comparePositions({ para: line.para, offset: line.start }, range.to) >= 0) break;
    const from = line.para === range.from.para ? Math.max(range.from.offset, line.start) : line.start;
    const to = line.para === range.to.para ? Math.min(range.to.offset, line.end) : line.end;
    const x1 = xAtOffset(line, from, measurer);
    let x2 = xAtOffset(line, to, measurer);
    // Show the paragraph mark as selected when the range continues past it.
    if (line.lastInParagraph && line.para < range.to.para) x2 += PARAGRAPH_MARK_WIDTH;
    if (x2 > x1) rects.push(turnRect(line.turn, { page: line.page, x: x1, y: line.y, width: x2 - x1, height: line.height }));
  }
  return rects;
}
