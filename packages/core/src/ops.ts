// Pure editing operations: each one takes a Doc and returns a new Doc.

import {
  type Doc,
  type Paragraph,
  type ParagraphProps,
  type Position,
  type Range,
  type Run,
  type RunProps,
  defined,
  paragraphLength,
  paragraphText,
  plainText,
  runPropsEqual,
  sameCell,
} from './model';
import { type ListKind, type ListLevel, MAX_LIST_LEVEL, type NumFormat, addList, isSymbolFont, levelOf, listKind } from './numbering';

function locate(p: Paragraph, offset: number): { index: number; inner: number } {
  let acc = 0;
  for (let i = 0; i < p.runs.length; i++) {
    const len = p.runs[i].text.length;
    // At a boundary the left run wins, so typing continues its formatting.
    if (offset <= acc + len) return { index: i, inner: offset - acc };
    acc += len;
  }
  const last = p.runs.length - 1;
  return { index: last, inner: p.runs[last].text.length };
}

/** Formatting that typed text would get at `pos`. */
export function propsAt(doc: Doc, pos: Position): RunProps {
  const p = doc.paragraphs[pos.para];
  let props = p.runs[locate(p, pos.offset).index].props;
  // New text is no change of anybody's until it is tracked as one.
  if (props.revision) props = defined({ ...props, revision: undefined, revisionAuthor: undefined, revisionDate: undefined });
  if (!props.object) return props;
  // Text typed next to an object takes its formatting but is not part of it.
  return defined({ ...props, object: undefined, anchor: undefined, objectWidth: undefined, objectHeight: undefined });
}

/** True when the character at `index` is an anchor, which the caret steps over. */
function isAnchorAt(p: Paragraph, index: number): boolean {
  let acc = 0;
  for (const run of p.runs) {
    if (index < acc + run.text.length) return !!run.props.anchor;
    acc += run.text.length;
  }
  return false;
}

/**
 * `pos`, or the nearest position outside the marks of the page-number field
 * it is in. What a file keeps between those marks is the result of the field,
 * which Word writes again: text typed there would be lost.
 */
export function outsideField(doc: Doc, pos: Position): Position {
  const { runs } = doc.paragraphs[pos.para];
  let offset = 0;
  let begin = -1;
  let result = -1;
  let numbered = false;
  for (const run of runs) {
    const mark = run.props.object ? /w:fldCharType="(\w+)"/.exec(run.props.object)?.[1] : undefined;
    if (mark === 'begin') {
      begin = offset;
      result = -1;
      numbered = false;
    } else if (mark === 'separate') {
      result = offset + run.text.length;
    } else if (mark === 'end' && begin >= 0) {
      const end = offset + run.text.length;
      if (numbered && pos.offset > begin && pos.offset < end) {
        return { para: pos.para, offset: result >= 0 && pos.offset <= result ? begin : end };
      }
      begin = -1;
    } else if (run.props.field) {
      numbered = true;
    }
    offset += run.text.length;
  }
  return pos;
}

export function sliceRuns(runs: Run[], from: number, to: number): Run[] {
  const out: Run[] = [];
  let acc = 0;
  for (const run of runs) {
    const start = Math.max(from, acc);
    const end = Math.min(to, acc + run.text.length);
    if (end > start) out.push({ text: run.text.slice(start - acc, end - acc), props: run.props });
    acc += run.text.length;
  }
  return out;
}

export function normalizeRuns(runs: Run[], fallback: RunProps): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = out[out.length - 1];
    if (prev && runPropsEqual(prev.props, run.props)) {
      out[out.length - 1] = { text: prev.text + run.text, props: prev.props };
    } else {
      out.push(run);
    }
  }
  return out.length ? out : [{ text: '', props: fallback }];
}

function replaceParagraphs(doc: Doc, index: number, count: number, paragraphs: Paragraph[]): Doc {
  const next = doc.paragraphs.slice();
  next.splice(index, count, ...paragraphs);
  return { ...doc, paragraphs: next };
}

/** Inserts text inside a single paragraph; `text` must not carry paragraph separators. */
export function insertText(doc: Doc, pos: Position, text: string, props?: RunProps): { doc: Doc; pos: Position } {
  if (!text) return { doc, pos };
  const p = doc.paragraphs[pos.para];
  const runProps = props ?? propsAt(doc, pos);
  const len = paragraphLength(p);
  const runs = normalizeRuns([...sliceRuns(p.runs, 0, pos.offset), { text, props: runProps }, ...sliceRuns(p.runs, pos.offset, len)], runProps);
  return {
    doc: replaceParagraphs(doc, pos.para, 1, [{ ...p, runs }]),
    pos: { para: pos.para, offset: pos.offset + text.length },
  };
}

export function splitParagraph(doc: Doc, pos: Position): { doc: Doc; pos: Position } {
  const p = doc.paragraphs[pos.para];
  const fallback = propsAt(doc, pos);
  const len = paragraphLength(p);
  // The mark that ends a section is the one at the end of the paragraph, which goes with the second half.
  const { section: _, ...head } = p;
  // So is the mark that was put in or taken out: the first half ends with a new one.
  const left: Paragraph = {
    ...head,
    props: p.props.markRevision ? defined({ ...p.props, markRevision: undefined, markAuthor: undefined, markDate: undefined }) : p.props,
    runs: normalizeRuns(sliceRuns(p.runs, 0, pos.offset), fallback),
  };
  const right: Paragraph = {
    ...p,
    props: defined({ ...p.props, pageBreakBefore: undefined }),
    runs: normalizeRuns(sliceRuns(p.runs, pos.offset, len), fallback),
  };
  return { doc: replaceParagraphs(doc, pos.para, 1, [left, right]), pos: { para: pos.para + 1, offset: 0 } };
}

/** Inserts plain text, turning each '\n' into a new paragraph. */
export function insertFragment(doc: Doc, pos: Position, text: string, props?: RunProps): { doc: Doc; pos: Position } {
  const runProps = props ?? propsAt(doc, pos);
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let state = { doc, pos };
  lines.forEach((line, i) => {
    if (i > 0) state = splitParagraph(state.doc, state.pos);
    state = insertText(state.doc, state.pos, line, runProps);
  });
  return state;
}

/**
 * Deletes the range, merging the last paragraph into the first when it spans
 * several. Paragraphs are never merged across the edge of a table cell: there
 * the text goes and every cell keeps its paragraphs, so the table keeps its shape.
 */
export function deleteRange(doc: Doc, range: Range): Doc {
  const { from, to } = range;
  let out = doc;
  // Each stretch of paragraphs that share a cell (or are outside any) is deleted on its own, last first.
  let last = to.para;
  for (let i = to.para; i >= from.para; i--) {
    if (i > from.para && sameCell(doc.paragraphs[i - 1].cell, doc.paragraphs[i].cell)) continue;
    out = deleteWithin(out, {
      from: i === from.para ? from : { para: i, offset: 0 },
      to: last === to.para ? to : { para: last, offset: paragraphLength(doc.paragraphs[last]) },
    });
    last = i - 1;
  }
  return out;
}

function deleteWithin(doc: Doc, range: Range): Doc {
  const { from, to } = range;
  const first = doc.paragraphs[from.para];
  const last = doc.paragraphs[to.para];
  const fallback = propsAt(doc, from);
  const runs = normalizeRuns([...sliceRuns(first.runs, 0, from.offset), ...sliceRuns(last.runs, to.offset, paragraphLength(last))], fallback);
  // What is left ends with the mark of the last paragraph, and so with the section that one ended, if any.
  const { section: _, ...head } = first;
  return replaceParagraphs(doc, from.para, to.para - from.para + 1, [defined<Paragraph>({ ...head, runs, section: last.section })]);
}

export function applyRunProps(doc: Doc, range: Range, patch: RunProps): Doc {
  const paragraphs = doc.paragraphs.slice();
  for (let i = range.from.para; i <= range.to.para; i++) {
    const p = paragraphs[i];
    const len = paragraphLength(p);
    const a = i === range.from.para ? range.from.offset : 0;
    const b = i === range.to.para ? range.to.offset : len;
    if (len === 0) {
      // An empty paragraph inside the range still takes the formatting.
      paragraphs[i] = { ...p, runs: [{ text: '', props: { ...p.runs[0].props, ...patch } }] };
      continue;
    }
    if (a === b) continue;
    const middle = sliceRuns(p.runs, a, b).map((r) => ({ text: r.text, props: { ...r.props, ...patch } }));
    paragraphs[i] = {
      ...p,
      runs: normalizeRuns([...sliceRuns(p.runs, 0, a), ...middle, ...sliceRuns(p.runs, b, len)], p.runs[0].props),
    };
  }
  return { ...doc, paragraphs };
}

export function setParagraphProps(doc: Doc, fromPara: number, toPara: number, patch: ParagraphProps): Doc {
  const paragraphs = doc.paragraphs.slice();
  for (let i = fromPara; i <= toPara; i++) {
    paragraphs[i] = { ...paragraphs[i], props: defined({ ...paragraphs[i].props, ...patch }) };
  }
  return { ...doc, paragraphs };
}

export function runsInRange(doc: Doc, range: Range): Run[] {
  const out: Run[] = [];
  for (let i = range.from.para; i <= range.to.para; i++) {
    const p = doc.paragraphs[i];
    const a = i === range.from.para ? range.from.offset : 0;
    const b = i === range.to.para ? range.to.offset : paragraphLength(p);
    out.push(...sliceRuns(p.runs, a, b));
  }
  return out;
}

/** Plain text of the range, paragraphs separated by '\n'. */
export function textInRange(doc: Doc, range: Range): string {
  const parts: string[] = [];
  for (let i = range.from.para; i <= range.to.para; i++) {
    const p = doc.paragraphs[i];
    const a = i === range.from.para ? range.from.offset : 0;
    const b = i === range.to.para ? range.to.offset : paragraphLength(p);
    parts.push(plainText(sliceRuns(p.runs, a, b)));
  }
  return parts.join('\n');
}

/** First and last paragraph of the table cell that holds `para`. */
export function cellExtent(doc: Doc, para: number): { from: number; to: number } {
  const ref = doc.paragraphs[para].cell;
  let from = para;
  let to = para;
  while (from > 0 && sameCell(doc.paragraphs[from - 1].cell, ref)) from--;
  while (to < doc.paragraphs.length - 1 && sameCell(doc.paragraphs[to + 1].cell, ref)) to++;
  return { from, to };
}

/** The cell after (1) or before (-1) the one that holds `para`, in the same table. */
export function neighbourCell(doc: Doc, para: number, dir: -1 | 1): { from: number; to: number } | undefined {
  const ref = doc.paragraphs[para].cell;
  if (!ref) return undefined;
  const here = cellExtent(doc, para);
  const other = doc.paragraphs[dir > 0 ? here.to + 1 : here.from - 1];
  if (other?.cell?.table !== ref.table) return undefined;
  return cellExtent(doc, dir > 0 ? here.to + 1 : here.from - 1);
}

export function docText(doc: Doc): string {
  return doc.paragraphs.map((p) => plainText(p.runs)).join('\n');
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

export function wordRangeAt(doc: Doc, pos: Position): Range {
  const text = paragraphText(doc.paragraphs[pos.para]);
  let a = pos.offset;
  let b = pos.offset;
  while (a > 0 && WORD_CHAR.test(text[a - 1])) a--;
  while (b < text.length && WORD_CHAR.test(text[b])) b++;
  if (a === b && b < text.length) b++;
  return { from: { para: pos.para, offset: a }, to: { para: pos.para, offset: b } };
}

/** Moves over one visible character, crossing anchors and paragraph boundaries. */
export function moveChar(doc: Doc, pos: Position, dir: -1 | 1): Position {
  const p = doc.paragraphs[pos.para];
  const length = paragraphLength(p);
  let offset = pos.offset;
  if (dir < 0) {
    while (offset > 0 && isAnchorAt(p, offset - 1)) offset--;
    if (offset > 0) return { para: pos.para, offset: offset - 1 };
    if (pos.para === 0) return pos;
    return { para: pos.para - 1, offset: paragraphLength(doc.paragraphs[pos.para - 1]) };
  }
  while (offset < length && isAnchorAt(p, offset)) offset++;
  if (offset < length) return { para: pos.para, offset: offset + 1 };
  if (pos.para === doc.paragraphs.length - 1) return pos;
  return { para: pos.para + 1, offset: 0 };
}

/** Moves to the previous word start or the next word end. */
export function moveWord(doc: Doc, pos: Position, dir: -1 | 1): Position {
  const text = paragraphText(doc.paragraphs[pos.para]);
  let o = pos.offset;
  if (dir < 0) {
    if (o === 0) return moveChar(doc, pos, -1);
    while (o > 0 && !WORD_CHAR.test(text[o - 1])) o--;
    while (o > 0 && WORD_CHAR.test(text[o - 1])) o--;
  } else {
    if (o === text.length) return moveChar(doc, pos, 1);
    while (o < text.length && !WORD_CHAR.test(text[o])) o++;
    while (o < text.length && WORD_CHAR.test(text[o])) o++;
  }
  return { para: pos.para, offset: o };
}

// --- Lists --------------------------------------------------------------------

/** Membership of a list at `level`, with the indents that level gives. */
function listProps(doc: Doc, numId: number, level: number): ParagraphProps {
  const def = doc.numbering && levelOf(doc.numbering, numId, level);
  if (!def) return { numId, listLevel: level };
  return { numId, listLevel: level, indentLeft: def.indentLeft ?? 0, indentFirstLine: def.indentFirstLine ?? 0 };
}

export function listKindAt(doc: Doc, para: number): ListKind | undefined {
  const { numId, listLevel } = doc.paragraphs[para].props;
  return numId ? listKind(doc.numbering, numId, listLevel ?? 0) : undefined;
}

/**
 * Takes a paragraph out of its list. With `keepIndent` the text stays where it
 * was and only the label goes, which is what the first Backspace at the start
 * of an item does in Word.
 */
export function leaveList(doc: Doc, para: number, keepIndent = false): Doc {
  const patch: ParagraphProps = { numId: 0, listLevel: undefined, indentFirstLine: 0 };
  return setParagraphProps(doc, para, para, keepIndent ? patch : { ...patch, indentLeft: 0 });
}

/**
 * Puts the paragraphs in a list of `kind`, or takes them out when all of them
 * already are in one. A list right before or after the range is continued;
 * otherwise a new one starts.
 */
export function toggleList(doc: Doc, fromPara: number, toPara: number, kind: ListKind): Doc {
  let allOn = true;
  for (let i = fromPara; i <= toPara; i++) allOn &&= listKindAt(doc, i) === kind;
  if (allOn) {
    return setParagraphProps(doc, fromPara, toPara, { numId: 0, listLevel: undefined, indentLeft: 0, indentFirstLine: 0 });
  }

  let next = doc;
  let numId = 0;
  for (const neighbour of [fromPara - 1, toPara + 1]) {
    if (!numId && doc.paragraphs[neighbour] && listKindAt(doc, neighbour) === kind) {
      numId = doc.paragraphs[neighbour].props.numId!;
    }
  }
  if (!numId) {
    const used = Math.max(0, ...doc.paragraphs.map((p) => p.props.numId ?? 0));
    const added = addList(doc.numbering, kind, used);
    next = { ...doc, numbering: added.numbering };
    numId = added.numId;
  }
  const paragraphs = next.paragraphs.slice();
  for (let i = fromPara; i <= toPara; i++) {
    const p = paragraphs[i];
    // A paragraph that changes from one kind of list to the other keeps its level.
    const level = p.props.numId ? (p.props.listLevel ?? 0) : 0;
    paragraphs[i] = { ...p, props: defined({ ...p.props, ...listProps(next, numId, level) }) };
  }
  return { ...next, paragraphs };
}

/**
 * How the label of a list level is written: the kind of number (or a bullet)
 * and the text around it, with `#` where the number goes: `{ format:
 * 'lowerLetter', text: '#.-' }` is "a.-", "b.-"; a bullet's text is its
 * character, `{ format: 'bullet', text: '•' }`.
 */
export interface ListStyle {
  format: NumFormat;
  text: string;
}

/** The style of the level the paragraph is at in its list; undefined outside a list. */
export function listStyleAt(doc: Doc, para: number): ListStyle | undefined {
  const { numId, listLevel } = doc.paragraphs[para]?.props ?? {};
  const level = listLevel ?? 0;
  const def = numId && doc.numbering ? levelOf(doc.numbering, numId, level) : undefined;
  if (!def) return undefined;
  return { format: def.format, text: def.format === 'bullet' ? def.text : def.text.split(`%${level + 1}`).join('#') };
}

/** A copy of a list, its own id: a list a DOCX came with is written back as it was, so a changed one gets a new id. */
function copyList(doc: Doc, numId: number, change: (levels: Map<number, ListLevel>, starts: Map<number, number>) => void): { doc: Doc; numId: number } {
  const list = doc.numbering?.lists.get(numId);
  if (!doc.numbering || !list) return { doc, numId };
  const lists = new Map(doc.numbering.lists);
  const used = Math.max(0, ...doc.paragraphs.map((p) => p.props.numId ?? 0), ...lists.keys());
  const copy = { abstractId: list.abstractId, starts: new Map(list.starts), levels: new Map(list.levels) };
  change(copy.levels, copy.starts);
  lists.set(used + 1, copy);
  return { doc: { ...doc, numbering: { ...doc.numbering, lists } }, numId: used + 1 };
}

/** Moves the paragraphs `from` on that are in list `numId` to list `to`, keeping their levels. */
function moveToList(doc: Doc, numId: number, to: number, from = 0, until = doc.paragraphs.length - 1): Doc {
  let changed = false;
  const paragraphs = doc.paragraphs.map((p, i) => {
    if (i < from || i > until || p.props.numId !== numId) return p;
    changed = true;
    return { ...p, props: { ...p.props, numId: to } };
  });
  return changed ? { ...doc, paragraphs } : doc;
}

/**
 * Writes the labels of the lists in the range another way: every level used
 * there, in the whole of its list, as Word changes a list's number format.
 * Paragraphs of the range outside a list are left alone.
 */
export function setListStyle(doc: Doc, fromPara: number, toPara: number, style: ListStyle): Doc {
  const levels = new Map<number, Set<number>>();
  for (let i = fromPara; i <= toPara; i++) {
    const { numId, listLevel } = doc.paragraphs[i].props;
    if (!numId || !doc.numbering?.lists.has(numId)) continue;
    if (!levels.has(numId)) levels.set(numId, new Set());
    levels.get(numId)!.add(listLevel ?? 0);
  }
  let next = doc;
  for (const [numId, used] of levels) {
    const copied = copyList(next, numId, (defs) => {
      for (const level of used) {
        const base = levelOf(next.numbering!, numId, level);
        if (!base) continue;
        const bullet = style.format === 'bullet';
        // A bullet's character is plain text in the paragraph's font; a symbol font would show another one.
        const run = { ...base.run };
        if (bullet || isSymbolFont(run.fontFamily)) delete run.fontFamily;
        defs.set(level, { ...base, format: style.format, text: bullet ? style.text : style.text.split('#').join(`%${level + 1}`), run });
      }
    });
    next = moveToList(copied.doc, numId, copied.numId);
  }
  return next;
}

/** Starts the numbering again at the paragraph: it and the items of its list after it count from the start once more. */
export function restartNumbering(doc: Doc, para: number): Doc {
  const { numId, listLevel } = doc.paragraphs[para]?.props ?? {};
  if (!numId || !doc.numbering?.lists.has(numId)) return doc;
  const level = listLevel ?? 0;
  const start = levelOf(doc.numbering, numId, level)?.start ?? 1;
  const copied = copyList(doc, numId, (_levels, starts) => {
    for (let i = 0; i <= MAX_LIST_LEVEL; i++) starts.set(i, levelOf(doc.numbering!, numId, i)?.start ?? 1);
    starts.set(level, start);
  });
  return moveToList(copied.doc, numId, copied.numId, para);
}

/**
 * Continues the numbering of the list of the same kind before the
 * paragraph's: it and the items of its list after it join that one. Nothing
 * happens when there is none before.
 */
export function continueNumbering(doc: Doc, para: number): Doc {
  const { numId } = doc.paragraphs[para]?.props ?? {};
  const kind = numId ? listKindAt(doc, para) : undefined;
  if (!numId || !kind) return doc;
  for (let i = para - 1; i >= 0; i--) {
    const other = doc.paragraphs[i].props.numId;
    if (other && other !== numId && listKindAt(doc, i) === kind) return moveToList(doc, numId, other, para);
  }
  return doc;
}

/** Moves the list items in the range `delta` levels deeper (or shallower, when negative). */
export function shiftListLevel(doc: Doc, fromPara: number, toPara: number, delta: number): Doc {
  const paragraphs = doc.paragraphs.slice();
  for (let i = fromPara; i <= toPara; i++) {
    const p = paragraphs[i];
    if (!p.props.numId) continue;
    const current = p.props.listLevel ?? 0;
    const level = Math.max(0, Math.min(current + delta, MAX_LIST_LEVEL));
    if (level !== current) paragraphs[i] = { ...p, props: defined({ ...p.props, ...listProps(doc, p.props.numId, level) }) };
  }
  return { ...doc, paragraphs };
}
