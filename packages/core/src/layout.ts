// Layout engine: breaks paragraphs into lines and lines into pages.
// It has no DOM dependency; text metrics come from a TextMeasurer.

import {
  type Doc,
  type PageSetup,
  type Paragraph,
  type Position,
  type Range,
  type ResolvedParagraphProps,
  type ResolvedRunProps,
  type Story,
  type Table,
  comparePositions,
  resolveParagraph,
  sameCell,
  resolveRun,
} from './model';
import { type Anchor, type StoryPart, anchoredObject } from './docx/source';
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
  /** The line box this line was placed from: the same object on every layout until its paragraph changes. */
  raw: object;
}

/** The part of a table cell that is on one page. A cell merged down is one box as tall as its rows. */
export interface CellBox {
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

/** A header or a footer as laid out on one page. */
export interface Band {
  lines: Line[];
  cells: CellBox[];
  floats: FloatBox[];
  /** Where its pictures live, when it is not the header or the footer every page has: the first page's own. */
  part?: StoryPart;
}

export interface LayoutPage {
  index: number;
  lines: Line[];
  cells: CellBox[];
  floats: FloatBox[];
  header?: Band;
  footer?: Band;
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
/** The room, in points, left between the dots of a leader and the text on either side. */
const LEADER_GAP = 2;
/** How far down the text steps, laid out without pages, where a page was asked to end. */
const CONTINUOUS_BREAK = 12;

export function fontOf(props: ResolvedRunProps): FontSpec {
  return { family: props.fontFamily, size: props.fontSize, bold: props.bold, italic: props.italic };
}

type PieceKind = 'word' | 'space' | 'tab' | 'break' | 'pagebreak' | 'object';

interface Piece {
  kind: PieceKind;
  text: string;
  start: number;
  props: ResolvedRunProps;
  font: FontSpec;
  width: number;
  metrics: FontMetrics;
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
    const props = resolveRun(run.props);
    const font = fontOf(props);
    const metrics = measurer.metrics(font);
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
    for (const match of run.text.matchAll(/\t|\n|\f| +|[^\t\n\f ]+/g)) {
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
    if (piece.kind === 'word' && prev && prev[0].kind === 'word') prev.push(piece);
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
    // The hanging indent acts as a tab stop; a label that runs past it goes on to the next default stop.
    const hanging = pp.indentFirstLine < 0 && end <= pp.indentLeft + EPSILON;
    textStart = hanging ? pp.indentLeft : (Math.floor(end / TAB_STOP + EPSILON) + 1) * TAB_STOP;
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

function breakParagraph(
  para: Paragraph,
  pp: ResolvedParagraphProps,
  contentWidth: number,
  measurer: TextMeasurer,
  listLabel: ListLabel | undefined,
  shrinkSpaces: boolean,
  shape?: LineShape,
  /** Where the last line of the paragraph starts, when that is known: see `startLine`. */
  lastFrom?: number,
): RawLine[] {
  const lines: RawLine[] = [];
  const pieces = tokenize(para, measurer);
  const label = listLabel && placeLabel(para, pp, measurer, listLabel);
  let cur: Piece[] = [];
  let curWidth = 0;
  let nextOffset = 0;
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

  const ownIndent = () => (lines.length > 0 ? pp.indentLeft : label ? label.textStart : pp.indentLeft + pp.indentFirstLine);
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

  const flush = (forced: boolean, pageBreakAfter: boolean, lastLine: boolean) => {
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
    const hangs = (kind: PieceKind) => kind === 'space' || kind === 'break' || kind === 'pagebreak';
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
        // The gap of a tab that leads to a right stop is filled with dots, up against what follows.
        if (p.kind === 'tab' && pp.leaderTab > 0) {
          const dot = measurer.width('.', p.font);
          const count = dot > 0 ? Math.floor((advance - LEADER_GAP * 2) / dot) : 0;
          if (count > 0) fragments[fragments.length - 1].leader = { text: '.'.repeat(count), x: x + advance - LEADER_GAP - count * dot, width: count * dot };
        }
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
      pageBreakAfter,
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
    endedWithBreak = forced;
    cur = [];
    curWidth = 0;
    startLine();
  };

  const push = (p: Piece) => {
    cur.push(p);
    curWidth += p.width;
  };

  const shrink = shrinkSpaces && pp.align === 'justify';
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
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    const head = group[0];
    if (head.kind === 'space') {
      push(head);
    } else if (head.kind === 'tab' && pp.leaderTab > 0) {
      // What follows, up to the end of the line, ends at the stop: the tab takes the room that leaves.
      let rest = 0;
      for (let n = g + 1; n < groups.length && groups[n][0].kind !== 'break' && groups[n][0].kind !== 'pagebreak' && groups[n][0].kind !== 'tab'; n++) {
        for (const p of groups[n]) rest += p.width;
      }
      const stop = () => Math.min(pp.leaderTab - indent(), avail());
      // No room left for it on this line: it starts the next, and still ends at the stop.
      if (curWidth + rest > stop() + EPSILON && cur.length) flush(false, false, false);
      push({ ...head, width: Math.max(0, stop() - curWidth - rest) });
    } else if (head.kind === 'tab') {
      let tabWidth = TAB_STOP - ((indent() + curWidth) % TAB_STOP);
      if (curWidth + tabWidth > avail() + EPSILON && cur.length) {
        flush(false, false, false);
        tabWidth = TAB_STOP - (indent() % TAB_STOP);
      }
      push({ ...head, width: tabWidth });
    } else if (head.kind === 'break' || head.kind === 'pagebreak') {
      push(head);
      flush(true, head.kind === 'pagebreak', false);
    } else if (head.kind === 'object') {
      // A box is never split: it moves to a new line, where it may overflow.
      if (curWidth + head.width > avail() + EPSILON && cur.length) flush(false, false, false);
      push(head);
    } else {
      let groupWidth = 0;
      for (const p of group) groupWidth += p.width;
      let fits = curWidth + groupWidth <= avail() + EPSILON || fitsShrunk(groupWidth);
      if (!fits && cur.length) flush(false, false, false);
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
        flush(false, false, false);
        if (lo < p.text.length) {
          const tailText = p.text.slice(lo);
          queue.unshift({ ...p, text: tailText, start: p.start + lo, width: measurer.width(tailText, p.font) });
        }
      }
    }
  }

  if (cur.length || lines.length === 0 || endedWithBreak) flush(false, false, true);
  return lines;
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

/** Column widths of a table as laid out, and where its left edge is, relative to the text area. */
/** Where a table starts, from the left of the text area, and how wide its columns are once fitted to it. */
export function tableGeometry(table: Table, contentWidth: number): { left: number; columns: number[] } {
  let columns = table.columns;
  let total = columns.reduce((a, b) => a + b, 0);
  const scaleTo = (width: number) => {
    columns = columns.map((w) => (w * width) / total);
    total = width;
  };
  if (table.widthFraction) scaleTo(contentWidth * table.widthFraction);
  // A table that is not fixed is narrowed to the room it has, as Word's autofit does.
  const room = contentWidth - Math.max(0, table.indent);
  if (!table.fixed && total > room + EPSILON) scaleTo(room);
  const left =
    table.align === 'center' ? (contentWidth - total) / 2 : table.align === 'right' ? contentWidth - total : table.indent;
  return { left, columns };
}

/**
 * Lays out a flow of paragraphs and tables down pages whose text area runs
 * from `top` to `bottom`; on the first page from `first.top` to
 * `first.bottom`, when its header and footer are not those of the others.
 */
function layoutFlow(
  doc: Pick<Doc, 'page' | 'paragraphs' | 'tables' | 'numbering' | 'compatMode'>,
  measurer: TextMeasurer,
  cache: LayoutCache | undefined,
  restTop: number,
  restBottom: number,
  first: { top: number; bottom: number } = { top: restTop, bottom: restBottom },
  /** Set for text that runs on down one endless page: nothing starts another, and no picture is put off its line. */
  continuous = false,
): Layout & { endY: number } {
  let { top, bottom } = first;
  const page = doc.page;
  const { paragraphs } = doc;
  const labels = listLabels(doc);
  const shrinkSpaces = (doc.compatMode ?? 0) >= SHRINK_COMPAT_MODE;
  const contentWidth = page.width - page.marginLeft - page.marginRight;
  const pages: LayoutPage[] = [{ index: 0, lines: [], cells: [], floats: [] }];
  const lines: Line[] = [];
  const paraFirstLine: number[] = [];
  let y = top;
  /**
   * Space after the paragraph that ends right above `y`. Between two
   * paragraphs Word leaves the larger of the first's space after and the
   * second's space before, not their sum.
   */
  let spaceAbove = 0;

  const anchorOf = (xml: string | undefined): Anchor | undefined => (continuous || !xml ? undefined : anchoredObject(xml));
  const current = () => pages[pages.length - 1];
  const newPage = () => {
    if (continuous) {
      // Where a page was asked to end, the text only steps down.
      y += CONTINUOUS_BREAK;
      spaceAbove = 0;
      return;
    }
    pages.push({ index: pages.length, lines: [], cells: [], floats: [] });
    top = restTop;
    bottom = restBottom;
    y = top;
    spaceAbove = 0;
    wraps = [];
  };

  const breakCached = (paraIndex: number, pp: ResolvedParagraphProps, width: number): RawLine[] => {
    const para = paragraphs[paraIndex];
    const label = labels[paraIndex];
    let cached = cache?.get(para);
    if (!cached || cached.contentWidth !== width || !sameLabel(cached.label, label)) {
      cached = { contentWidth: width, label, lines: breakParagraph(para, pp, width, measurer, label, shrinkSpaces) };
      cache?.set(para, cached);
    }
    return cached.lines;
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
      fragments: rl.fragments.map((f) => (f.leader ? { ...f, x: left + f.x, leader: { ...f.leader, x: left + f.leader.x } } : { ...f, x: left + f.x })),
      label: rl.label && { ...rl.label, x: left + rl.label.x },
      lastInParagraph: last,
      raw: rl,
    };
    if (cell !== undefined) line.cell = cell;
    lines.push(line);
    on.lines.push(line);

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
    const broken = (lastFrom?: number) => breakParagraph(paragraphs[paraIndex], pp, width, measurer, labels[paraIndex], shrinkSpaces, shape, lastFrom);
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
  const shapeFrom = (startY: number, lead: number, within: { wraps: Wrap[]; edge: number; width: number } = { wraps, edge: page.marginLeft, width: contentWidth }): LineShape | undefined => {
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

  const emptyPage = () => !current().lines.length && !current().cells.length;
  // What fits on a page at all is asked of the pages after the first, which most are.
  const pageHeight = restBottom - restTop;
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
    if (y + needed > bottom + EPSILON && needed <= pageHeight + EPSILON && !emptyPage()) newPage();
  };

  const flow = (paraIndex: number) => {
    const pp = resolveParagraph(paragraphs[paraIndex].props);
    let raw = breakCached(paraIndex, pp, contentWidth);
    if (pp.pageBreakBefore && !emptyPage()) newPage();
    keepWithNext(paraIndex);
    const total = heightOf(raw);
    if (pp.keepLines && y + pp.spacingBefore + total > bottom + EPSILON && total <= pageHeight + EPSILON && !emptyPage()) {
      newPage();
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
        const box = floatAt(anchor, run.props.object!, page.marginLeft, paraTop, paraIndex, at);
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
      while (i + fit < raw.length && !forced && y + used + raw[i + fit].height <= bottom + PAGE_SLACK) {
        used += raw[i + fit].height;
        forced = raw[i + fit].pageBreakAfter;
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
        place(paraIndex, raw[i], i === raw.length - 1, page.marginLeft, y);
        y += raw[i].height;
      }
      if (forced || i < raw.length) {
        newPage();
        // None of it stayed behind: it starts again at the top of the new page, its pictures with it.
        if (i === 0) {
          paraTop = y;
          settle();
        }
      }
    }
    placed = new Map();
    y += pp.spacingAfter;
    spaceAbove = pp.spacingAfter;
  };

  /** Lays out the table whose paragraphs start at `from`; returns the index after the ones it placed. */
  const layoutTable = (tableIndex: number, table: Table, from: number): number => {
    const { left, columns } = tableGeometry(table, contentWidth);
    const edges = [0];
    for (const w of columns) edges.push(edges[edges.length - 1] + w);
    const edge = (column: number) => edges[Math.min(column, columns.length)];
    let next = from;

    // Break the paragraphs of every cell first: a row is as tall as its tallest cell.
    const rows = table.rows.map((row, rowIndex) => {
      let column = row.before;
      let kept = true;
      let any = false;
      const cells = row.cells.map((cell, cellIndex) => {
        const x = edge(column);
        const width = edge(column + cell.span) - x;
        const start = column;
        column += cell.span;
        const padLeft = cell.padLeft ?? table.padLeft;
        const padTop = cell.padTop ?? table.padTop;
        const inner = Math.max(MIN_LINE_WIDTH, width - padLeft - (cell.padRight ?? table.padRight));
        const content: { para: number; pp: ResolvedParagraphProps; raw: RawLine[]; before: number }[] = [];
        let height = padTop + (cell.padBottom ?? table.padBottom);
        let above = 0;
        const ref = { table: tableIndex, row: row.id, cell: cell.id };
        // The pictures of the cell that its text goes round, measured from the top left of what it holds.
        const within = { wraps: [] as Wrap[], edge: 0, width: inner };
        let down = 0;
        while (next < paragraphs.length && sameCell(paragraphs[next].cell, ref)) {
          const pp = resolveParagraph(paragraphs[next].props);
          const before = Math.max(0, pp.spacingBefore - above);
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
        return { cell, cellIndex, start, x, width, height, content, padLeft, padTop, padBottom: cell.padBottom ?? table.padBottom };
      });
      // Horizontal borders take room: the first row's top one, and under every row the thicker of its
      // bottom border and the top border of the row below.
      const below = table.rows[rowIndex + 1]?.cells ?? [];
      const borderTop = rowIndex === 0 ? Math.max(0, ...row.cells.map((c) => c.borderTop ?? 0)) : 0;
      const borderBottom = Math.max(0, ...row.cells.map((c) => c.borderBottom ?? 0), ...below.map((c) => c.borderTop ?? 0));
      const height = Math.max(row.height, ...cells.map((c) => c.height)) + borderTop + borderBottom;
      // A row whose paragraphs all ask to be kept with the next stays with the row after it.
      return { cells, height, borderTop, borderBottom, min: row.height, cantSplit: !!row.cantSplit, kept: kept && any };
    });

    /** Per grid column, the box on this page that a cell merged with the one above goes on in. */
    let merged: (number | undefined)[] = [];
    let keptRows = -1;
    rows.forEach((row, rowIndex) => {
      if (row.kept && rowIndex > keptRows) {
        // The kept rows, the row after them and, past the end of the table, the first line that follows.
        let needed = 0;
        let end = rowIndex;
        while (end < rows.length && rows[end].kept) needed += rows[end++].height;
        needed += end < rows.length ? rows[end].height : firstLineHeight(next);
        keptRows = end;
        if (y + needed > bottom + EPSILON && needed <= pageHeight + EPSILON && !emptyPage()) {
          newPage();
          merged = [];
        }
      }
      // The lines each cell still has to place, with the space that goes above and below each.
      const queues = row.cells.map((c) =>
        c.content.flatMap(({ para, pp, raw, before }) =>
          raw.map((rl, i) => ({
            para,
            rl,
            last: i === raw.length - 1,
            above: i === 0 ? before : 0,
            below: i === raw.length - 1 ? pp.spacingAfter : 0,
          })),
        ),
      );
      const set: { para: number; rl: RawLine; last: boolean; left: number; top: number; box: number; on: LayoutPage; above: number }[] = [];

      // A row goes on the page whole when it fits. Otherwise it is broken between lines, each cell
      // going on in the next page, unless it must not be split or not even a first line fits here.
      let first = true;
      for (;;) {
        const lead = (c: (typeof row.cells)[number]) => (first ? row.borderTop + c.padTop : 0);
        const tallest = Math.max(
          ...row.cells.map((c, i) => lead(c) + queues[i].reduce((h, it) => h + it.above + it.rl.height + it.below, 0) + c.padBottom),
        );
        const height = (first ? Math.max(tallest, row.min + row.borderTop) : tallest) + row.borderBottom;
        const blank = emptyPage();
        let whole = y + height <= bottom + EPSILON;
        if (!whole) {
          const starts = row.cells.every((c, i) => {
            const [head] = queues[i];
            return !head || y + lead(c) + head.above + head.rl.height <= bottom + EPSILON;
          });
          if (row.cantSplit || !starts) {
            if (!blank) {
              newPage();
              merged = [];
              continue;
            }
            // Nothing above to move away from: a row that must stay whole runs off the page.
            whole = row.cantSplit;
          }
        }
        const segment = whole ? height : bottom - y;

        row.cells.forEach((c, i) => {
          const boxes = current().cells;
          let box = c.cell.merge === 'continue' ? merged[c.start] : undefined;
          if (box !== undefined) {
            boxes[box].height += segment;
          } else {
            box = boxes.length;
            boxes.push({
              x: page.marginLeft + left + c.x,
              y,
              width: c.width,
              height: segment,
              table: tableIndex,
              row: rowIndex,
              cell: c.cellIndex,
              borders: c.cell.borders,
              ...(c.cell.shade ? { shade: c.cell.shade } : {}),
            });
          }
          merged[c.start] = c.cell.merge ? box : undefined;
          let top = y + lead(c);
          let taken = 0;
          for (const queue = queues[i]; queue.length; taken++) {
            const [it] = queue;
            // On a blank page every cell takes at least one line, or a line taller than the page would never be placed.
            const fits = whole || top + it.above + it.rl.height <= bottom + EPSILON || (blank && taken === 0);
            if (!fits) break;
            top += it.above;
            set.push({ para: it.para, rl: it.rl, last: it.last, left: page.marginLeft + left + c.x + c.padLeft, top, box, on: current(), above: it.above });
            top += it.rl.height + it.below;
            queue.shift();
          }
        });
        y += segment;
        if (queues.every((queue) => !queue.length)) break;
        newPage();
        merged = [];
        first = false;
      }

      // Lines go into the document in paragraph order, whichever page each one landed on.
      set.sort((a, b) => a.para - b.para);
      let lastPara = -1;
      for (const it of set) {
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
      }
      placed = new Map();
      spaceAbove = 0;
    });
    return next;
  };

  for (let i = 0; i < paragraphs.length; ) {
    const ref = paragraphs[i].cell;
    const table = ref && doc.tables?.[ref.table];
    // A cell paragraph the table did not take (out of order, or of a missing table) flows as plain text.
    const end = table && !(i > 0 && paragraphs[i - 1].cell?.table === ref.table) ? layoutTable(ref.table, table, i) : i;
    if (end > i) i = end;
    else flow(i++);
  }

  return { page, pages, lines, paraFirstLine, endY: y };
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
export function bandLayout(layout: Layout, part: 'header' | 'footer', pageIndex: number): Layout | undefined {
  const band = layout.pages[pageIndex]?.[part];
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

/** `cache` must always be used with the same measurer. */
export function layoutDocument(doc: Doc, measurer: TextMeasurer, cache?: LayoutCache): Layout {
  const { page } = doc;

  /** A header or footer laid out from y = 0, and its height. `part` is where its pictures live. */
  const band = (story: Story, part: StoryPart, pageNumber: number, pageCount: number) => {
    const filled = fillFields(story, pageNumber, pageCount);
    const flow = layoutFlow({ ...doc, paragraphs: filled.paragraphs, tables: filled.tables }, measurer, cache, 0, Infinity);
    const [first] = flow.pages;
    const own = part === 'firstHeader' || part === 'firstFooter';
    const at = (dy: number): Band => ({
      lines: first.lines.map((l) => ({ ...l, y: l.y + dy, baseline: l.baseline + dy })),
      cells: first.cells.map((c) => ({ ...c, y: c.y + dy })),
      floats: first.floats.map((f) => ({ ...f, y: f.fixed ? f.y : f.y + dy, part })),
      ...(own ? { part } : {}),
    });
    return { height: flow.endY, at, varies: filled !== story };
  };
  const headerTop = page.headerDistance ?? 36;
  const footerBottom = page.height - (page.footerDistance ?? 36);
  /** The header and the footer of a kind of page, and the text area they leave: one too tall for its margin takes room from it, as in Word. */
  const frame = (head: Story | undefined, foot: Story | undefined, parts: [StoryPart, StoryPart]) => {
    const header = head?.paragraphs.length ? { story: head, part: parts[0], ...band(head, parts[0], 1, 1) } : undefined;
    const footer = foot?.paragraphs.length ? { story: foot, part: parts[1], ...band(foot, parts[1], 1, 1) } : undefined;
    return {
      header,
      footer,
      top: header ? Math.max(page.marginTop, headerTop + header.height) : page.marginTop,
      bottom: footer ? Math.min(page.height - page.marginBottom, footerBottom - footer.height) : page.height - page.marginBottom,
    };
  };
  const rest = frame(doc.header, doc.footer, ['header', 'footer']);
  // The first page shows its own when the document says it has them, even if that is nothing.
  const opening = doc.firstPage ? frame(doc.firstPage.header, doc.firstPage.footer, ['firstHeader', 'firstFooter']) : rest;

  const { endY: _, ...layout } = layoutFlow(doc, measurer, cache, rest.top, rest.bottom, opening);
  const count = layout.pages.length;
  // One that says the page it is on is laid out again for each; any other is the same, the very same, on all its pages.
  const same = new Map<object, Band>();
  const once = (of: { at: (dy: number) => Band }, dy: number) => same.get(of) ?? (same.set(of, of.at(dy)), same.get(of)!);
  for (const p of layout.pages) {
    const { header, footer } = p.index === 0 ? opening : rest;
    if (header) p.header = header.varies ? band(header.story, header.part, p.index + 1, count).at(headerTop) : once(header, headerTop);
    if (footer) p.footer = footer.varies ? band(footer.story, footer.part, p.index + 1, count).at(footerBottom - footer.height) : once(footer, footerBottom - footer.height);
  }
  return layout;
}

/**
 * The text of the document down one page as tall as it needs: no header or
 * footer, nothing that starts another page, and no picture anywhere but in
 * its line. The page of the layout says how tall it came out.
 */
export function layoutContinuous(doc: Doc, measurer: TextMeasurer, cache?: LayoutCache): Layout {
  const { page } = doc;
  const { endY, ...layout } = layoutFlow(doc, measurer, cache, page.marginTop, Infinity, undefined, true);
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
  return { page: line.page, x: xAtOffset(line, pos.offset, measurer), y: line.y, width: 0, height: line.height };
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
    if (d < distance) {
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
  const beside = (l: Line) => {
    if (!box || l.cell === undefined || l.cell === line.cell) return false;
    const other = page.cells[l.cell];
    return other.table === box.table && other.row === box.row;
  };
  const beyond = (l: Line) =>
    dir > 0 ? l.y >= line.y + line.height - EPSILON : l.y + l.height <= line.y + EPSILON;
  /** The candidate closest to the starting line. */
  const nearest = (candidates: Line[]) => {
    let best: Line | undefined;
    for (const l of candidates) {
      if (!best || (dir > 0 ? l.y < best.y - EPSILON : l.y + l.height > best.y + best.height + EPSILON)) best = l;
    }
    // Of the stretches of a row in two, the one nearest to where the caret was.
    const away = (l: Line) => (x < l.x ? l.x - x : x > l.x + l.width ? x - l.x - l.width : 0);
    for (const l of candidates) {
      if (best && l !== best && l.cell === best.cell && Math.abs(l.y - best.y) < EPSILON && away(l) < away(best)) best = l;
    }
    return best;
  };

  let found = nearest(page.lines.filter((l) => l !== line && !beside(l) && beyond(l)));
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
    if (x2 > x1) rects.push({ page: line.page, x: x1, y: line.y, width: x2 - x1, height: line.height });
  }
  return rects;
}
