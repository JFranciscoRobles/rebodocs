// Tracked changes, as Word's "Track changes" keeps them: while they are on,
// what is typed stays marked as put in, and what is taken out stays in the
// text, struck through, until someone accepts or rejects each change. A
// change is in the formatting of the text it is about (`revision` on the
// runs, `markRevision` on the paragraph for the mark that ends it), so that
// it goes wherever the text goes: into the file, to the others working on
// it, into undo.
//
// An edit is tracked by comparing the document before it with the document
// after it: whatever the edit was, what it took out is put back, marked, and
// what it put in is marked. So every way of changing the text is tracked the
// same, typing as much as what an assistant does.

import {
  type Doc,
  type Paragraph,
  type ParagraphProps,
  type Position,
  type Range,
  type Run,
  type RunProps,
  type Story,
  type RowRevision,
  type Table,
  type FormatChange,
  type ParagraphFormat,
  type RunFormat,
  PARAGRAPH_FORMAT,
  RUN_FORMAT,
  comparePositions,
  resolveParagraph,
  resolveRun,
  defined,
  paragraphLength,
  paragraphText,
  sameCell,
} from './model';
import { normalizeRuns } from './ops';
import { commonPairs } from './diffing';
import { type StoryPart, storyOf, textParts, withStory } from './stories';

/** Text put in, text taken out, or formatting changed. */
export type RevisionType = 'insert' | 'delete' | 'format';

/** Who makes a change, and when: an ISO date. */
export interface Reviser {
  author: string;
  date?: string;
}

/** The colours the changes of each person are shown in, as Word gives one to each author. */
export const REVISION_COLORS = ['B5082E', '1F5FBF', '2E7D32', '7B1FA2', 'C25E00', '00838F', 'AD1457', '5D4037'];

/** The colour text moved is shown in. */
export const MOVE_COLOR = '2E7D32';

/** The colour of the changes of `author`: always the same one for the same name. */
export function revisionColor(author: string): string {
  let hash = 0;
  for (let i = 0; i < author.length; i++) hash = (hash * 31 + author.charCodeAt(i)) | 0;
  return REVISION_COLORS[Math.abs(hash) % REVISION_COLORS.length];
}

/**
 * How text with a change is shown: in the colour of its author, underlined
 * when put in, struck through when taken out; both when taken out of what
 * someone else put in.
 */
export function shownRevision<T extends RunProps>(props: T): T {
  if (!props.revision) return props;
  return {
    ...props,
    // A move in green, whoever made it, as Word shows one.
    color: props.revisionMove ? MOVE_COLOR : revisionColor(props.revisionAuthor ?? ''),
    underline: props.revision === 'insert' || props.insertedBy !== undefined ? true : props.underline,
    strike: props.revision === 'delete' ? true : props.strike,
  };
}

/** The date a change made now is kept with: to the minute, so that what one person types in a row is one change. */
export function revisionNow(now = new Date()): string {
  return `${now.toISOString().slice(0, 16)}:00Z`;
}

/** Text marked as a change `by` someone. Taking out what another person put in keeps who did: it is their change too. */
const runWith = (props: RunProps, type: 'insert' | 'delete', by: Reviser): RunProps =>
  defined({
    ...props,
    revision: type,
    revisionAuthor: by.author,
    revisionDate: by.date,
    revisionMove: undefined,
    ...(type === 'delete' && props.revision === 'insert' ? { insertedBy: props.revisionAuthor ?? '', insertedDate: props.revisionDate } : {}),
  });
/** One of the marks of where a note starts and ends. Putting a note in or taking it out is no change to the text, tracked or not, as in Word. */
const noteMark = (props: RunProps): boolean => !!props.anchor && /<w:comment(?:RangeStart|RangeEnd|Reference)\b/.test(props.object ?? '');
const runWithout = (props: RunProps): RunProps =>
  props.revision || props.revisionAuthor || props.revisionDate || props.insertedBy !== undefined || props.revisionMove !== undefined
    ? defined({ ...props, revision: undefined, revisionAuthor: undefined, revisionDate: undefined, insertedBy: undefined, insertedDate: undefined, revisionMove: undefined })
    : props;
const markWith = (props: ParagraphProps, type: 'insert' | 'delete', by: Reviser): ParagraphProps => defined({ ...props, markRevision: type, markAuthor: by.author, markDate: by.date });
const markWithout = (props: ParagraphProps): ParagraphProps =>
  props.markRevision || props.markAuthor || props.markDate ? defined({ ...props, markRevision: undefined, markAuthor: undefined, markDate: undefined }) : props;

// --- Tracking an edit -----------------------------------------------------------------

/** A letter of a paragraph, or the mark that ends it. */
type Item = { mark: false; ch: string; props: RunProps; from: Paragraph } | { mark: true; from: Paragraph };

/** What a paragraph is made of, letter by letter, and where each letter of the later version is. */
function itemsOf(paragraphs: Paragraph[], first = 0): { items: Item[]; at: [number, number][] } {
  const items: Item[] = [];
  const at: [number, number][] = [];
  paragraphs.forEach((p, k) => {
    let offset = 0;
    for (const run of p.runs) {
      for (const ch of run.text) {
        items.push({ mark: false, ch, props: run.props, from: p });
        at.push([first + k, offset++]);
      }
    }
    items.push({ mark: true, from: p });
    at.push([first + k, offset]);
  });
  return { items, at };
}

const keyOf = (item: Item) => (item.mark ? '\u0000¶' : item.props.object ? `${item.ch}${item.props.object}` : item.ch);

/** The items in stretches matched as one: each letter, or with `words` each word, space and sign. */
function unitsOf(items: Item[], words: boolean): number[] {
  const starts: number[] = [];
  const kind = (item: Item) => (item.mark || item.props.object ? 'x' : /\s/.test(item.ch) ? 's' : /[\p{L}\p{N}_]/u.test(item.ch) ? 'w' : 'p');
  items.forEach((item, i) => {
    const k = kind(item);
    if (!words || i === 0 || k === 'x' || k === 'p' || k !== kind(items[i - 1])) starts.push(i);
  });
  return starts;
}

/** Past this many letters by letters, the paragraphs that changed are taken as taken out and put in whole. */
const MAX_LETTERS = 4_000_000;

type Emitted = { item: Item; type: 'same' | 'insert' | 'delete'; was?: Item; at?: [number, number] };

/** One step from the earlier items to the later ones: one the same in both, one taken out, one put in. */
type Op = { t: 's'; b: number; a: number } | { t: 'd'; b: number } | { t: 'i'; a: number };

/** The steps the pairs of matching items make, what is taken out before what is put in. */
function opsOf(pairs: [number, number][], nb: number, na: number): Op[] {
  const ops: Op[] = [];
  let b = 0;
  let a = 0;
  for (const [pb, pa] of [...pairs, [nb, na] as [number, number]]) {
    for (; b < pb; b++) ops.push({ t: 'd', b });
    for (; a < pa; a++) ops.push({ t: 'i', a });
    if (pb < nb) {
      ops.push({ t: 's', b: pb, a: pa });
      b = pb + 1;
      a = pa + 1;
    }
  }
  return ops;
}

/**
 * The steps with each stretch of spaces left between two changes made part
 * of them: "a b" made "x y" reads as one change, [-a b-]{+x y+}, not as two
 * around a space that stayed. What is taken out goes before what is put in.
 */
function joinChanges(ops: Op[], before: Item[]): Op[] {
  const segments: { same: boolean; ops: Op[] }[] = [];
  for (const op of ops) {
    const same = op.t === 's';
    const last = segments[segments.length - 1];
    if (last && last.same === same) last.ops.push(op);
    else segments.push({ same, ops: [op] });
  }
  const blank = (op: Op) => {
    const item = before[(op as { b: number }).b];
    return !item.mark && !item.props.object && /\s/.test(item.ch);
  };
  const out: Op[] = [];
  let changed: Op[] = [];
  const flush = () => {
    out.push(...changed.filter((op) => op.t === 'd'), ...changed.filter((op) => op.t === 'i'));
    changed = [];
  };
  segments.forEach((segment, k) => {
    const between = segment.same && k > 0 && k < segments.length - 1 && segment.ops.every(blank);
    if (!segment.same) changed.push(...segment.ops);
    else if (between) for (const op of segment.ops as Extract<Op, { t: 's' }>[]) changed.push({ t: 'd', b: op.b }, { t: 'i', a: op.a });
    else {
      flush();
      out.push(...segment.ops);
    }
  });
  flush();
  return out;
}

const WORDISH = /[\p{L}\p{N}_]/u;
/** How good a place it is for a change to start or end, between two items: the edge of a word is better than its middle. */
function edge(left: string | undefined, right: string | undefined): number {
  if (left === undefined || right === undefined || left.startsWith('\u0000') || right.startsWith('\u0000')) return 3;
  const l = WORDISH.test(left);
  const r = WORDISH.test(right);
  if (l !== r) return 2;
  return !l ? 1 : 0;
}

/**
 * Moves each stretch only taken out, or only put in, between two that are
 * the same, to where it reads best: the same letters can be matched more
 * than one way, as the space of "a b" taken out of "a b b", and the change
 * then goes at the edges of words.
 */
function slide(ops: Op[], keysB: string[], keysA: string[]): Op[] {
  const out = ops.slice();
  for (let s = 0; s < out.length; s++) {
    const t = out[s].t;
    if (t === 's') continue;
    let e = s;
    while (e < out.length && out[e].t === t) e++;
    if (s === 0 || e >= out.length || out[s - 1].t !== 's' || out[e].t !== 's') {
      s = e - 1;
      continue;
    }
    const side = t === 'd' ? 'b' : 'a';
    const keys = t === 'd' ? keysB : keysA;
    const idx = (op: Op) => (op as Record<'a' | 'b', number>)[side];
    // The stretch is keys[from..to); it may go left while the letter before it is its last, right while the one after is its first.
    let from = idx(out[s]);
    let to = idx(out[e - 1]) + 1;
    const score = (f: number, t2: number) => edge(keys[f - 1], keys[f]) + edge(keys[t2 - 1], keys[t2]);
    let best = { shift: 0, score: score(from, to) };
    for (let k = 1; from - k >= 0 && s - k >= 0 && out[s - k].t === 's' && keys[from - k] === keys[to - k]; k++) {
      const sc = score(from - k, to - k);
      if (sc > best.score) best = { shift: -k, score: sc };
    }
    for (let k = 1; e - 1 + k < out.length && out[e - 1 + k].t === 's' && keys[from + k - 1] === keys[to + k - 1]; k++) {
      const sc = score(from + k, to + k);
      if (sc > best.score) best = { shift: k, score: sc };
    }
    for (let k = 0; k < Math.abs(best.shift); k++) {
      if (best.shift < 0) {
        // The same step before the stretch takes its last item; the stretch takes that step's item.
        const before = out[s - 1] as { t: 's'; b: number; a: number };
        const last = out[e - 1];
        const moved: Op = side === 'b' ? { t: 's', b: idx(last), a: before.a } : { t: 's', b: before.b, a: idx(last) };
        const taken: Op = side === 'b' ? { t: 'd', b: before.b } : { t: 'i', a: before.a };
        out.splice(s - 1, e - s + 1, taken, ...out.slice(s, e - 1), moved);
        s--;
        e--;
      } else {
        const after = out[e] as { t: 's'; b: number; a: number };
        const first = out[s];
        const moved: Op = side === 'b' ? { t: 's', b: idx(first), a: after.a } : { t: 's', b: after.b, a: idx(first) };
        const taken: Op = side === 'b' ? { t: 'd', b: after.b } : { t: 'i', a: after.a };
        out.splice(s, e - s + 1, moved, ...out.slice(s + 1, e), taken);
        s++;
        e++;
      }
    }
    from = idx(out[s]);
    to = idx(out[e - 1]) + 1;
    s = e - 1;
  }
  return out;
}

// --- Changes of formatting ---------------------------------------------------------

/** The formatting a run or a paragraph sets, of the keys given. */
function formatOf<T extends object>(props: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of keys) if ((props as Record<string, unknown>)[key] !== undefined) out[key] = (props as Record<string, unknown>)[key];
  return out as Partial<T>;
}

const sameValue = (a: unknown, b: unknown) => a === b || (typeof a === 'object' && JSON.stringify(a) === JSON.stringify(b));
const sameRunFormat = (a: RunProps, b: RunProps) => {
  const ra = resolveRun(a);
  const rb = resolveRun(b);
  return RUN_FORMAT.every((key) => sameValue(ra[key], rb[key]));
};
const sameParagraphFormat = (a: ParagraphProps, b: ParagraphProps) => {
  const ra = resolveParagraph(a);
  const rb = resolveParagraph(b);
  return PARAGRAPH_FORMAT.every((key) => sameValue(ra[key], rb[key]));
};

/**
 * What a tracked edit does to the formatting of text that stays: changed, it
 * keeps the formatting it had first, to go back to; changed back to that, it
 * is no change. Text just put in too, as in Word: its putting in and its
 * formatting are two changes. The same change for the letters of one run, so
 * they stay one.
 */
function formatTracker(by: Reviser) {
  const made = new Map<object, Map<object, RunProps>>();
  const run = (was: RunProps, now: RunProps): RunProps => {
    if (sameRunFormat(was, now)) return now;
    let byNow = made.get(was);
    if (!byNow) made.set(was, (byNow = new Map()));
    let props = byNow.get(now);
    if (!props) {
      const first: RunFormat = was.formatChange?.before ?? formatOf(was, RUN_FORMAT);
      props = sameRunFormat(now, first)
        ? defined({ ...now, formatChange: undefined })
        : { ...now, formatChange: defined<FormatChange<RunFormat>>({ author: by.author, date: by.date, before: first }) };
      byNow.set(now, props);
    }
    return props;
  };
  const paragraph = (was: ParagraphProps, now: ParagraphProps): ParagraphProps => {
    if (sameParagraphFormat(was, now)) return now;
    const first: ParagraphFormat = was.formatChange?.before ?? formatOf(was, PARAGRAPH_FORMAT);
    return sameParagraphFormat(now, first)
      ? defined({ ...now, formatChange: undefined })
      : { ...now, formatChange: defined<FormatChange<ParagraphFormat>>({ author: by.author, date: by.date, before: first }) };
  };
  /** A paragraph whose text did not change, with what changed in its formatting tracked. */
  const same = (was: Paragraph, now: Paragraph): Paragraph => {
    const props = paragraph(was.props, now.props);
    const runs: Run[] = [];
    let changed = props !== now.props;
    const before: RunProps[] = [];
    for (const r of was.runs) for (let i = 0; i < r.text.length; i++) before.push(r.props);
    let at = 0;
    for (const r of now.runs) {
      for (const ch of r.text) {
        const tracked = before[at] ? run(before[at], r.props) : r.props;
        if (tracked !== r.props) changed = true;
        runs.push({ text: ch, props: tracked });
        at += ch.length;
      }
    }
    if (!changed) return now;
    return { ...now, props, runs: normalizeRuns(runs, now.runs[0]?.props ?? {}) };
  };
  return { run, paragraph, same };
}

/**
 * The paragraphs of `after` with what changed from `before` tracked, and
 * where each place of `after` is among them: `before` and `after` are the
 * paragraphs of the same text, before and after an edit.
 */
function trackParagraphs(before: Paragraph[], after: Paragraph[], by: Reviser, words: boolean): { paragraphs: Paragraph[]; map: (pos: Position) => Position } {
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head++;
  let endB = before.length;
  let endA = after.length;
  while (endB > head && endA > head && before[endB - 1] === after[endA - 1]) {
    endB--;
    endA--;
  }
  if (head === endB && head === endA) return { paragraphs: after, map: (pos) => pos };
  const format = formatTracker(by);
  const midB = before.slice(head, endB);
  const midA = after.slice(head, endA);
  const out: Paragraph[] = [];
  /** Where each place of each paragraph of the middle of `after` went, by its index in `after`. */
  const places = new Map<number, Position[]>();
  const place = (a: number, offset: number, pos: Position) => {
    let list = places.get(a);
    if (!list) places.set(a, (list = []));
    list[offset] = pos;
  };

  const rebuild = (emitted: Emitted[]) => {
    // What comes after the last mark goes before it: a paragraph ends with one.
    let last = emitted.length - 1;
    while (last >= 0 && !emitted[last].item.mark) last--;
    if (last >= 0 && last < emitted.length - 1) emitted = [...emitted.slice(0, last), ...emitted.slice(last + 1), emitted[last]];
    const used = new Set<Paragraph>();
    /** The formatting of paragraphs whose mark was taken out here: the one a join gave the paragraph after. */
    const joined = new Set<ParagraphProps>();
    let runs: Run[] = [];
    let length = 0;
    let first: Emitted | undefined;
    for (const e of emitted) {
      if (!e.item.mark) {
        // What comes in already marked as put in keeps who put it in: tracking an edit twice changes nothing.
        const props =
          e.type === 'same'
            ? e.was && !e.was.mark
              ? format.run(e.was.props, e.item.props)
              : e.item.props
            : noteMark(e.item.props) || (e.type === 'insert' && e.item.props.revision === 'insert') || (e.type === 'delete' && e.item.props.revision === 'delete')
              ? e.item.props
              : runWith(e.item.props, e.type, by);
        if (e.at) place(e.at[0], e.at[1], { para: out.length, offset: length });
        runs.push({ text: e.item.ch, props });
        length += e.item.ch.length;
        first ??= e;
        continue;
      }
      const own = e.item.from;
      let props = own.props;
      // Joined to the one before: it is shown apart again, with its own formatting.
      if (e.type === 'same' && e.was && joined.has(own.props) && e.was.from.props !== own.props) props = e.was.from.props;
      else if (e.type === 'same' && e.was) props = format.paragraph(e.was.from.props, props);
      if (e.type === 'insert' && own.props.markRevision !== 'insert') props = markWith(props, 'insert', by);
      else if (e.type === 'delete') {
        if (own.props.markRevision !== 'delete') props = markWith(props, 'delete', by);
        joined.add(own.props);
      }
      if (e.at) place(e.at[0], e.at[1], { para: out.length, offset: length });
      let meta = first?.item.from ?? own;
      if (used.has(meta)) meta = e.was?.from ?? own;
      const { runs: _, props: __, cell: ___, section: ____, ...rest } = meta;
      const keep = used.has(meta) ? {} : rest;
      used.add(meta);
      const fallback = runWithout(own.runs[0]?.props ?? {});
      out.push(defined<Paragraph>({ ...keep, props, runs: normalizeRuns(runs, fallback), cell: own.cell, section: own.section }));
      runs = [];
      length = 0;
      first = undefined;
    }
  };

  const cluster = (gb: Paragraph[], ga: Paragraph[], firstA: number) => {
    if (!gb.length && !ga.length) return;
    const b = itemsOf(gb);
    const a = itemsOf(ga, firstA);
    // Matched letter by letter, or word by word; then each stretch is its letters again.
    const ub = unitsOf(b.items, words);
    const ua = unitsOf(a.items, words);
    const span = (starts: number[], items: Item[], k: number) => items.slice(starts[k], starts[k + 1] ?? items.length);
    const unitPairs = commonPairs(
      ub.map((_, k) => span(ub, b.items, k).map(keyOf).join('')),
      ua.map((_, k) => span(ua, a.items, k).map(keyOf).join('')),
      undefined,
      MAX_LETTERS,
    );
    const pairs: [number, number][] = [];
    for (const [kb, ka] of unitPairs) for (let n = 0; n < span(ub, b.items, kb).length; n++) pairs.push([ub[kb] + n, ua[ka] + n]);
    const slid = slide(opsOf(pairs, b.items.length, a.items.length), b.items.map(keyOf), a.items.map(keyOf));
    const ops = words ? joinChanges(slid, b.items) : slid;
    const emitted: Emitted[] = [];
    for (const op of ops) {
      if (op.t === 's') emitted.push({ item: a.items[op.a], type: 'same', was: b.items[op.b], at: a.at[op.a] });
      else if (op.t === 'i') emitted.push({ item: a.items[op.a], type: 'insert', at: a.at[op.a] });
      else {
        const item = b.items[op.b];
        // What one put in and takes out again goes for good; what someone else put in stays, theirs and taken out, as in Word.
        if (item.mark ? item.from.props.markRevision === 'insert' : (item.props.revision === 'insert' && (item.props.revisionAuthor ?? '') === by.author) || noteMark(item.props)) continue;
        emitted.push({ item, type: 'delete' });
      }
    }
    rebuild(emitted);
  };

  const pairs = commonPairs(midB.map(paragraphText), midA.map(paragraphText));
  let b = 0;
  let a = 0;
  for (const [pb, pa] of [...pairs, [midB.length, midA.length] as [number, number]]) {
    const gone = midB.slice(b, pb);
    cluster(gone, midA.slice(a, pa), head + a);
    if (pb < midB.length) {
      // The same text: the later paragraph as it is, whatever else changed in it; but one that took the look
      // of a paragraph taken out whole before it, joined to it, has its own back, as the two show apart.
      let p = midA[pa];
      if (p.props !== midB[pb].props && gone.some((was) => was.props === p.props)) p = { ...p, props: midB[pb].props };
      else if (p !== midB[pb]) p = format.same(midB[pb], p);
      for (let o = 0; o <= paragraphLength(p); o++) place(head + pa, o, { para: out.length, offset: o });
      out.push(p);
    }
    b = pb + 1;
    a = pa + 1;
  }

  const paragraphs = [...after.slice(0, head), ...out, ...after.slice(endA)];
  const shift = head + out.length - endA;
  return {
    paragraphs,
    map(pos) {
      if (pos.para < head) return pos;
      if (pos.para >= endA) return { para: pos.para + shift, offset: pos.offset };
      const found = places.get(pos.para)?.[pos.offset];
      return found ? { para: head + found.para, offset: found.offset } : pos;
    },
  };
}

/** The letter before `pos` in its paragraph is one taken out. */
function deletedBefore(p: Paragraph, offset: number): boolean {
  let at = 0;
  for (const run of p.runs) {
    if (offset > at && offset <= at + run.text.length) return run.props.revision === 'delete';
    at += run.text.length;
  }
  return false;
}

export interface TrackedEdit {
  doc: Doc;
  /**
   * Where a place of the document after the edit is in the tracked one. With
   * `caret`, a caret goes before the text just taken out in front of it, as
   * after Backspace; with `forward`, after it, as after Delete.
   */
  map(pos: Position, caret?: 'back' | 'forward'): Position;
}

/**
 * The edit that turned the paragraphs of `before` into those of `after`, as
 * changes `by` someone, kept to be accepted or rejected: what it took out
 * stays, struck through, and what it put in is marked. Only the text and the
 * marks between paragraphs are tracked; an edit that changed the shape of a
 * table is not, and comes back as it was.
 */
export function trackEdit(before: Doc, after: Doc, by: Reviser, options: { words?: boolean } = {}): TrackedEdit {
  // Rows put in or taken out are tracked as rows; any other change to the shape of a table is not, and the edit with it.
  let shaped: { doc: Doc; map: (pos: Position) => Position } = { doc: after, map: (pos) => pos };
  if (before.tables !== after.tables && JSON.stringify(before.tables ?? []) !== JSON.stringify(after.tables ?? [])) {
    const rows = trackRows(before, after, by);
    if (!rows) return { doc: after, map: (pos) => pos };
    shaped = rows;
  }
  const tracked = trackParagraphs(before.paragraphs, shaped.doc.paragraphs, by, !!options.words);
  if (tracked.paragraphs === after.paragraphs) return { doc: after, map: (pos) => pos };
  const doc = { ...shaped.doc, paragraphs: tracked.paragraphs };
  return {
    doc,
    map(pos, caret) {
      const at = tracked.map(shaped.map(pos));
      if (caret !== 'back') return at;
      const p = doc.paragraphs[at.para];
      let offset = at.offset;
      while (p && offset > 0 && deletedBefore(p, offset)) offset--;
      return { para: at.para, offset };
    },
  };
}

/** The parts with text of their own: headers, footers, and the notes at the foot of the page. */
function partsOf(...docs: Doc[]): StoryPart[] {
  const parts = new Set<StoryPart>();
  for (const doc of docs) {
    for (const part of textParts(doc)) parts.add(part);
  }
  return [...parts];
}

/** `{ paragraphs, tables }` of a part as a document of its own, to be tracked as one. */
const asDoc = (doc: Doc, story: Story | undefined): Doc => ({ ...doc, paragraphs: story?.paragraphs ?? [], tables: story?.tables });

/**
 * A change to the whole document, its headers, footers and notes among it,
 * tracked as `trackEdit` tracks one to its text: word by word, as what is
 * changed at once is read, unless `words` is false.
 */
export function trackDocEdit(before: Doc, after: Doc, by: Reviser, words = true): Doc {
  let doc = trackEdit(before, after, by, { words }).doc;
  for (const part of partsOf(after)) {
    const was = storyOf(before, part);
    const now = storyOf(after, part);
    if (was === now || !now) continue;
    const tracked = trackEdit(asDoc(before, was), asDoc(after, now), by, { words }).doc;
    if (tracked.paragraphs !== now.paragraphs) doc = withStory(doc, part, { ...now, paragraphs: tracked.paragraphs });
  }
  return doc;
}

// --- Rows -----------------------------------------------------------------------------

/** The paragraphs of a row of a table, by their indexes. */
const rowParagraphs = (paragraphs: Paragraph[], table: number, row: number) => paragraphs.flatMap((p, i) => (p.cell?.table === table && p.cell.row === row ? [i] : []));

/**
 * The edit with the rows it put in marked as put in, and those it took out
 * back where they were, marked as taken out with their text: as Word tracks
 * rows. Undefined when the edit did more to a table than that: a column, a
 * merge, a table in a table.
 */
function trackRows(before: Doc, after: Doc, by: Reviser): { doc: Doc; map: (pos: Position) => Position } | undefined {
  const was = before.tables ?? [];
  const now = after.tables ?? [];
  if (now.length < was.length || [...was, ...now].some((t) => t.parent)) return undefined;
  const change = (type: 'insert' | 'delete'): RowRevision => defined({ type, author: by.author, date: by.date });
  const tables = now.slice();
  let paragraphs = after.paragraphs;
  for (let t = 0; t < now.length; t++) {
    const old = was[t];
    const table = now[t];
    if (!old) {
      tables[t] = { ...table, rows: table.rows.map((row) => ({ ...row, revision: change('insert') })) };
      continue;
    }
    if (old === table) continue;
    const shape = (x: Table) => JSON.stringify({ ...x, rows: undefined });
    if (shape(old) !== shape(table)) return undefined;
    const oldRows = new Map(old.rows.map((row) => [row.id, row]));
    if (
      table.rows.some(
        (row) =>
          oldRows.has(row.id) &&
          oldRows
            .get(row.id)!
            .cells.map((c) => c.id)
            .join() !== row.cells.map((c) => c.id).join(),
      )
    )
      return undefined;
    const rows = table.rows.map((row) => (oldRows.has(row.id) ? row : { ...row, revision: change('insert') }));
    const gone = new Map<number, Paragraph[]>();
    old.rows.forEach((row, i) => {
      if (rows.some((r) => r.id === row.id)) return;
      // A row of one's own put in and taken out again never was; anyone else's stays, taken out.
      if (row.revision?.type === 'insert' && row.revision.author === by.author) return;
      const previous = old.rows
        .slice(0, i)
        .reverse()
        .find((r) => rows.some((x) => x.id === r.id));
      rows.splice(previous ? rows.findIndex((x) => x.id === previous.id) + 1 : 0, 0, { ...row, revision: change('delete') });
      gone.set(
        row.id,
        rowParagraphs(before.paragraphs, t, row.id).map((i) => {
          const p = before.paragraphs[i];
          const runs = p.runs.flatMap((run) =>
            !run.text || run.props.revision === 'delete'
              ? [run]
              : run.props.revision === 'insert' && (run.props.revisionAuthor ?? '') === by.author
                ? []
                : [{ text: run.text, props: runWith(run.props, 'delete', by) }],
          );
          return { ...p, runs: normalizeRuns(runs, runWithout(p.runs[0]?.props ?? {})) };
        }),
      );
    });
    tables[t] = { ...table, rows };
    if (!gone.size) continue;
    // The paragraphs of the table again, row by row, with those of the rows taken out back in theirs.
    const of = new Map<number, Paragraph[]>();
    let first = -1;
    let last = -1;
    paragraphs.forEach((p, i) => {
      if (p.cell?.table !== t) return;
      if (first < 0) first = i;
      last = i;
      const list = of.get(p.cell.row);
      if (list) list.push(p);
      else of.set(p.cell.row, [p]);
    });
    const block = rows.flatMap((row) => gone.get(row.id) ?? of.get(row.id) ?? []);
    const next = paragraphs.slice();
    if (first >= 0) next.splice(first, last - first + 1, ...block);
    else {
      // The whole table went: where it was, before what came after it.
      const lastOfTable = before.paragraphs.reduce((at, p, i) => (p.cell?.table === t ? i : at), -1);
      const following = before.paragraphs.slice(lastOfTable + 1).find((p) => next.includes(p));
      next.splice(following ? next.indexOf(following) : next.length, 0, ...block);
    }
    paragraphs = next;
  }
  const doc = { ...after, tables, paragraphs };
  if (paragraphs === after.paragraphs) return { doc, map: (pos) => pos };
  const index = new Map(paragraphs.map((p, i) => [p, i]));
  return { doc, map: (pos) => ({ para: index.get(after.paragraphs[pos.para]) ?? pos.para, offset: pos.offset }) };
}

/** The rows put in or taken out, as changes: each the whole row, its text the text of its cells. */
function rowRevisions(doc: Pick<Doc, 'paragraphs' | 'tables'>): RevisionView[] {
  const out: RevisionView[] = [];
  (doc.tables ?? []).forEach((table, t) => {
    for (const row of table.rows) {
      if (!row.revision) continue;
      const at = rowParagraphs(doc.paragraphs, t, row.id);
      if (!at.length) continue;
      out.push(
        defined<RevisionView>({
          type: row.revision.type,
          author: row.revision.author,
          date: row.revision.date || undefined,
          range: { from: { para: at[0], offset: 0 }, to: { para: at[at.length - 1] + 1, offset: 0 } },
          text: at.map((i) => paragraphText(doc.paragraphs[i])).join(' | '),
          row: true,
        }),
      );
    }
  });
  return out;
}

/**
 * The rows with their changes decided, those in `range` that `pick` takes: a
 * row taken out and accepted goes, with its paragraphs; one put in and
 * rejected, the same; otherwise it is a row like the others again.
 */
function settleRows<T extends Pick<Doc, 'paragraphs'>>(doc: T, accept: boolean, range?: Range, pick?: ChangePick): T {
  const tables = (doc as Pick<Doc, 'tables'>).tables;
  if (!tables?.some((table) => table.rows.some((row) => row.revision))) return doc;
  let paragraphs = doc.paragraphs;
  const next = tables.map((table, t) => {
    if (!table.rows.some((row) => row.revision)) return table;
    const rows = table.rows.flatMap((row) => {
      if (!row.revision) return [row];
      const at = rowParagraphs(paragraphs, t, row.id);
      const touched = !range || at.some((i) => range.from.para <= i && (i < range.to.para || (i === range.to.para && range.to.offset > 0)));
      if (!touched || (pick && !pick(row.revision))) return [row];
      if ((row.revision.type === 'delete') === accept) {
        paragraphs = paragraphs.filter((p) => !(p.cell?.table === t && p.cell.row === row.id));
        return [];
      }
      const { revision: _, ...rest } = row;
      return [rest];
    });
    return rows.length === table.rows.length && rows.every((row, i) => row === table.rows[i]) ? table : { ...table, rows };
  });
  if (!paragraphs.length) paragraphs = [{ props: {}, runs: [{ text: '', props: {} }] }];
  return { ...doc, tables: next, paragraphs };
}

// --- The changes there are ------------------------------------------------------------

export interface RevisionView {
  type: RevisionType;
  author: string;
  date?: string;
  /** Where it is, in the text of its part: the end is after its last letter, or at the start of the next paragraph when it takes in a mark. */
  range: Range;
  /** Its text, with ¶ for a mark between paragraphs. */
  text: string;
  /** The header, footer or note it is in; the text of the document when not given. */
  part?: StoryPart;
  /** The name of the move it is half of: the place text left when taken out, the one it went to when put in. */
  move?: string;
  /** For a change of formatting, what it changed: the names of the properties, as bold or fontSize; of the paragraph, when the change is to one. */
  format?: string[];
  /** Set for a change of formatting of a whole paragraph: its range is the paragraph. */
  paragraph?: true;
  /** Set for a row of a table put in or taken out: its range is the row. */
  row?: true;
}

/** A change of a stretch of text: what is decided on, alone, by who made it. */
export interface RevisionChange {
  type: RevisionType;
  author: string;
  date?: string;
  move?: string;
}

/** The changes a run of text carries: one, or two when someone took out what another put in. */
export function changesOf(props: RunProps): RevisionChange[] {
  const out: RevisionChange[] = [];
  if (props.revision === 'insert' || props.revision === 'delete') {
    if (props.insertedBy !== undefined) out.push(defined<RevisionChange>({ type: 'insert', author: props.insertedBy, date: props.insertedDate || undefined }));
    out.push(defined<RevisionChange>({ type: props.revision, author: props.revisionAuthor ?? '', date: props.revisionDate || undefined, move: props.revisionMove || undefined }));
  }
  if (props.formatChange) out.push(defined<RevisionChange>({ type: 'format', author: props.formatChange.author, date: props.formatChange.date || undefined }));
  return out;
}

/** The properties a change of formatting changed, by name. */
function formatChanged<T extends object>(now: T, change: FormatChange<Partial<T>>, keys: readonly string[], resolve: (props: Partial<T>) => Record<string, unknown>): string[] {
  const a = resolve(now);
  const b = resolve(change.before);
  return keys.filter((key) => !sameValue(a[key], b[key]));
}

const sameChange = (a: RevisionChange, b: RevisionChange) => a.type === b.type && a.author === b.author && (a.move ?? '') === (b.move ?? '');

/** The changes of a text, in order: each a run of letters and marks of the same kind by the same person. */
export function revisionsIn(paragraphs: Paragraph[], part?: StoryPart): RevisionView[] {
  const out: RevisionView[] = [];
  /** The changes that reach the place being read, to go on with the next letters when they are of the same. */
  let open: RevisionView[] = [];
  const add = (changes: RevisionChange[], from: Position, to: Position, text: string, props?: RunProps) => {
    open = changes.map((change) => {
      const going = open.find((view) => sameChange(view, change) && comparePositions(view.range.to, from) === 0);
      const changed = change.type === 'format' && props?.formatChange ? formatChanged(props, props.formatChange, RUN_FORMAT, (p) => resolveRun(p) as Record<string, unknown>) : undefined;
      if (going) {
        going.range = { from: going.range.from, to };
        going.text += text;
        if (changed) going.format = [...new Set([...(going.format ?? []), ...changed])];
        return going;
      }
      const view = defined<RevisionView>({ ...change, range: { from, to }, text, part, format: changed });
      out.push(view);
      return view;
    });
  };
  paragraphs.forEach((p, para) => {
    const change = p.props.formatChange;
    if (change) {
      out.push(
        defined<RevisionView>({
          type: 'format',
          author: change.author,
          date: change.date || undefined,
          range: { from: { para, offset: 0 }, to: { para: para + 1, offset: 0 } },
          text: `${paragraphText(p)}¶`,
          part,
          paragraph: true,
          format: formatChanged(p.props, change, PARAGRAPH_FORMAT, (props) => resolveParagraph(props) as Record<string, unknown>),
        }),
      );
    }
    let offset = 0;
    for (const run of p.runs) {
      if (run.text) add(changesOf(run.props), { para, offset }, { para, offset: offset + run.text.length }, run.text, run.props);
      offset += run.text.length;
    }
    const mark =
      p.props.markRevision === 'insert' || p.props.markRevision === 'delete'
        ? [defined<RevisionChange>({ type: p.props.markRevision, author: p.props.markAuthor ?? '', date: p.props.markDate || undefined })]
        : [];
    add(mark, { para, offset }, { para: para + 1, offset: 0 }, '¶');
  });
  return out;
}

/** Every change of the document: of its text first, then of its headers, footers and notes. */
export function revisionsOf(doc: Doc): RevisionView[] {
  const rows = rowRevisions(doc);
  // The text of a row put in or taken out is part of the change of the row, not one of its own.
  const ofRow = (view: RevisionView) =>
    view.type !== 'format' && rows.some((row) => row.type === view.type && row.author === view.author && view.range.from.para >= row.range.from.para && view.range.from.para < row.range.to.para);
  const out = [...revisionsIn(doc.paragraphs).filter((view) => !ofRow(view)), ...rows].sort((a, b) => comparePositions(a.range.from, b.range.from));
  for (const part of partsOf(doc)) out.push(...revisionsIn(storyOf(doc, part)?.paragraphs ?? [], part));
  return out;
}

/** Whether the document has any change to accept or reject. */
export function hasRevisions(doc: Doc): boolean {
  const any = (paragraphs: Paragraph[]) => paragraphs.some((p) => !!p.props.markRevision || !!p.props.formatChange || p.runs.some((run) => !!run.props.revision || !!run.props.formatChange));
  return any(doc.paragraphs) || (doc.tables ?? []).some((table) => table.rows.some((row) => row.revision)) || partsOf(doc).some((part) => any(storyOf(doc, part)?.paragraphs ?? []));
}

/** The change at `pos` in a text: the one the letter after it is in, or else the one before it. */
export function revisionAt(paragraphs: Paragraph[], pos: Position): RevisionView | undefined {
  const all = revisionsIn(paragraphs);
  const inside = (r: RevisionView) => comparePositions(r.range.from, pos) <= 0 && comparePositions(pos, r.range.to) < 0;
  const touching = (r: RevisionView) => comparePositions(r.range.from, pos) <= 0 && comparePositions(pos, r.range.to) <= 0;
  return all.find(inside) ?? all.find(touching);
}

// --- Accepting and rejecting -----------------------------------------------------------

/** Whether a change is accepted (true), rejected (false), or left as it is (undefined). */
type Verdict = (change: RevisionChange) => boolean | undefined;

/**
 * A run with its changes decided: null when its text goes. Text taken out of
 * what another put in is two changes: accepting the taking out takes it out;
 * rejecting it leaves the putting in, to be decided on its own.
 */
function settle(props: RunProps, verdict: Verdict): RunProps | null {
  let p = props;
  if (p.revision === 'delete' && p.insertedBy !== undefined) {
    const [put, took] = changesOf(p);
    const out = verdict(took);
    if (out === true) return null;
    if (out === false) p = defined({ ...runWithout(p), revision: 'insert' as const, revisionAuthor: put.author, revisionDate: put.date });
    else {
      const in_ = verdict(put);
      return in_ === true ? defined({ ...p, insertedBy: undefined, insertedDate: undefined }) : in_ === false ? null : p;
    }
  }
  const [change] = changesOf(p).filter((c) => c.type !== 'format');
  if (change) {
    const v = verdict(change);
    if (v !== undefined) {
      if ((change.type === 'insert') !== v) return null;
      p = runWithout(p);
    }
  }
  return settleFormat(p, verdict, RUN_FORMAT);
}

/** Props with their change of formatting decided: accepted, the change is forgotten; rejected, the formatting before it is back. */
function settleFormat<T extends RunProps | ParagraphProps>(props: T, verdict: Verdict, keys: readonly string[]): T {
  const change = props.formatChange as FormatChange<Record<string, unknown>> | undefined;
  if (!change) return props;
  const v = verdict({ type: 'format', author: change.author, date: change.date });
  if (v === undefined) return props;
  if (v) return defined({ ...props, formatChange: undefined });
  const back: Record<string, unknown> = { ...props, formatChange: undefined };
  for (const key of keys) back[key] = change.before[key];
  return defined(back as T);
}

/**
 * The paragraphs with their changes decided: each accepted, rejected or left
 * by `verdict`, for the letter or mark at a place. Text put in stays, or goes;
 * text taken out goes, or stays; a mark taken out joins its paragraph to the
 * next, and one put in that is rejected does the same.
 */
function decide(paragraphs: Paragraph[], verdict: (change: RevisionChange, at: Position) => boolean | undefined): Paragraph[] {
  const out: Paragraph[] = [];
  /** A paragraph whose mark went, waiting to be joined to the next. */
  let pending: { para: Paragraph; runs: Run[] } | undefined;
  paragraphs.forEach((p, para) => {
    const runs: Run[] = [];
    let offset = 0;
    let changed = false;
    for (const run of p.runs) {
      if (!run.props.revision && !run.props.formatChange) {
        runs.push(run);
        offset += run.text.length;
        continue;
      }
      for (const ch of run.text) {
        const at = { para, offset };
        const props = settle(run.props, (change) => verdict(change, at));
        if (props !== run.props) changed = true;
        if (props) runs.push({ text: ch, props });
        offset += ch.length;
      }
    }
    let props = settleFormat(p.props, (change) => verdict(change, { para, offset }), PARAGRAPH_FORMAT);
    if (props !== p.props) changed = true;
    let joins = false;
    const markChange = p.props.markRevision === 'insert' || p.props.markRevision === 'delete' ? { type: p.props.markRevision, author: p.props.markAuthor ?? '', date: p.props.markDate } : undefined;
    const markVerdict = markChange && verdict(markChange, { para, offset });
    if (markVerdict !== undefined) {
      joins = (markChange!.type === 'delete') === markVerdict;
      props = markWithout(props);
      changed = true;
    }
    // Untouched, it is the same paragraph: what is written back and sent to the others is only what changed.
    if (!changed && !pending) {
      out.push(p);
      return;
    }
    // A mark that goes: the text goes on in the next paragraph of the same cell, if there is one.
    const next = paragraphs[para + 1];
    if (joins && (!next || !sameCell(next.cell, p.cell))) joins = false;
    let made: Paragraph = { ...p, props, runs };
    if (pending) {
      const was = pending;
      const empty = !was.runs.some((run) => run.text);
      // Joined, it is the first paragraph with the text of both; an empty one before it just goes.
      made = empty ? { ...made, runs: [...runs] } : { ...was.para, props: markWithout(was.para.props), runs: [...was.runs, ...runs], section: p.section, cell: p.cell };
      pending = undefined;
    }
    if (joins) {
      pending = { para: made, runs: made.runs };
      return;
    }
    const fallback = runWithout(made.runs[0]?.props ?? p.runs[0]?.props ?? {});
    out.push({ ...made, runs: normalizeRuns(made.runs, fallback) });
  });
  return out;
}

/** Which changes to decide: those of one person, of one kind, or the halves of one move. */
export type ChangePick = (change: RevisionChange) => boolean;

/**
 * The verdict for the changes in `range` (all of them without it) that `pick`
 * takes (all of them without it). A move is decided whole: once one of its
 * halves is taken, the other is too, wherever it is.
 */
function verdictOf(paragraphs: Paragraph[], accept: boolean, range?: Range, pick?: ChangePick): (change: RevisionChange, at: Position) => boolean | undefined {
  const inRange = (pos: Position) => !range || (comparePositions(range.from, pos) <= 0 && comparePositions(pos, range.to) < 0);
  const taken = (change: RevisionChange, at: Position) => inRange(at) && (!pick || pick(change));
  const moves = new Set<string>();
  if (range || pick) {
    for (const view of revisionsIn(paragraphs)) {
      if (!view.move) continue;
      // A change is taken when any of its letters is.
      const touches = !range || (comparePositions(range.from, view.range.to) < 0 && comparePositions(view.range.from, range.to) < 0) || comparePositions(range.from, view.range.from) === 0;
      if (touches && (!pick || pick(view))) moves.add(view.move);
    }
  }
  return (change, at) => (taken(change, at) || (!!change.move && moves.has(change.move)) ? accept : undefined);
}

/** The text with its changes in `range` accepted, those `pick` takes: all of them without either. */
export function acceptRevisions<T extends Pick<Doc, 'paragraphs'>>(doc: T, range?: Range, pick?: ChangePick): T {
  return settleRows({ ...doc, paragraphs: decide(doc.paragraphs, verdictOf(doc.paragraphs, true, range, pick)) }, true, range, pick);
}

/** The text with its changes in `range` rejected, those `pick` takes: all of them without either. */
export function rejectRevisions<T extends Pick<Doc, 'paragraphs'>>(doc: T, range?: Range, pick?: ChangePick): T {
  return settleRows({ ...doc, paragraphs: decide(doc.paragraphs, verdictOf(doc.paragraphs, false, range, pick)) }, false, range, pick);
}

/** The changes `pick` takes: one person's, as Word's "Accept all changes by". */
export const byAuthor =
  (author: string): ChangePick =>
  (change) =>
    change.author === author;

/** Every change of the document accepted, or rejected, of those `pick` takes: in its text, headers, footers and notes. */
export function decideAllRevisions(doc: Doc, accept: boolean, pick?: ChangePick): Doc {
  let out: Doc = accept ? acceptRevisions(doc, undefined, pick) : rejectRevisions(doc, undefined, pick);
  for (const part of partsOf(doc)) {
    const story = storyOf(out, part);
    if (!story) continue;
    const paragraphs = decide(story.paragraphs, verdictOf(story.paragraphs, accept, undefined, pick));
    if (paragraphs.some((p, i) => p !== story.paragraphs[i]) || paragraphs.length !== story.paragraphs.length) out = withStory(out, part, { ...story, paragraphs });
  }
  return out;
}
