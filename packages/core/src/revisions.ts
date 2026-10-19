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
  comparePositions,
  defined,
  paragraphLength,
  paragraphText,
  sameCell,
} from './model';
import { normalizeRuns } from './ops';
import { commonPairs } from './diffing';
import { type StoryPart, footnotePart, storyOf, storyParts, withStory } from './stories';

export type RevisionType = 'insert' | 'delete';

/** Who makes a change, and when: an ISO date. */
export interface Reviser {
  author: string;
  date?: string;
}

/** The colours the changes of each person are shown in, as Word gives one to each author. */
export const REVISION_COLORS = ['B5082E', '1F5FBF', '2E7D32', '7B1FA2', 'C25E00', '00838F', 'AD1457', '5D4037'];

/** The colour of the changes of `author`: always the same one for the same name. */
export function revisionColor(author: string): string {
  let hash = 0;
  for (let i = 0; i < author.length; i++) hash = (hash * 31 + author.charCodeAt(i)) | 0;
  return REVISION_COLORS[Math.abs(hash) % REVISION_COLORS.length];
}

/** How text with a change is shown: in the colour of its author, underlined when put in, struck through when taken out. */
export function shownRevision<T extends RunProps>(props: T): T {
  if (!props.revision) return props;
  return {
    ...props,
    color: revisionColor(props.revisionAuthor ?? ''),
    underline: props.revision === 'insert' ? true : props.underline,
    strike: props.revision === 'delete' ? true : props.strike,
  };
}

/** The date a change made now is kept with: to the minute, so that what one person types in a row is one change. */
export function revisionNow(now = new Date()): string {
  return `${now.toISOString().slice(0, 16)}:00Z`;
}

const runWith = (props: RunProps, type: RevisionType, by: Reviser): RunProps => defined({ ...props, revision: type, revisionAuthor: by.author, revisionDate: by.date });
const runWithout = (props: RunProps): RunProps => (props.revision || props.revisionAuthor || props.revisionDate ? defined({ ...props, revision: undefined, revisionAuthor: undefined, revisionDate: undefined }) : props);
const markWith = (props: ParagraphProps, type: RevisionType, by: Reviser): ParagraphProps => defined({ ...props, markRevision: type, markAuthor: by.author, markDate: by.date });
const markWithout = (props: ParagraphProps): ParagraphProps => (props.markRevision || props.markAuthor || props.markDate ? defined({ ...props, markRevision: undefined, markAuthor: undefined, markDate: undefined }) : props);

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

type Emitted = { item: Item; type: 'same' | RevisionType; was?: Item; at?: [number, number] };

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
          e.type === 'same' || (e.type === 'insert' && e.item.props.revision === 'insert') || (e.type === 'delete' && e.item.props.revision === 'delete')
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
    const ops = slide(opsOf(pairs, b.items.length, a.items.length), b.items.map(keyOf), a.items.map(keyOf));
    const emitted: Emitted[] = [];
    for (const op of ops) {
      if (op.t === 's') emitted.push({ item: a.items[op.a], type: 'same', was: b.items[op.b], at: a.at[op.a] });
      else if (op.t === 'i') emitted.push({ item: a.items[op.a], type: 'insert', at: a.at[op.a] });
      else {
        const item = b.items[op.b];
        // What was put in and is taken out again goes for good.
        if (item.mark ? item.from.props.markRevision === 'insert' : item.props.revision === 'insert') continue;
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
  if (before.tables !== after.tables && JSON.stringify(before.tables ?? []) !== JSON.stringify(after.tables ?? [])) return { doc: after, map: (pos) => pos };
  const tracked = trackParagraphs(before.paragraphs, after.paragraphs, by, !!options.words);
  if (tracked.paragraphs === after.paragraphs) return { doc: after, map: (pos) => pos };
  const doc = { ...after, paragraphs: tracked.paragraphs };
  return {
    doc,
    map(pos, caret) {
      const at = tracked.map(pos);
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
    for (const part of storyParts(doc)) parts.add(part);
    for (const note of doc.footnotes ?? []) parts.add(footnotePart(note.id));
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
}

/** The changes of a text, in order: each a run of letters and marks of the same kind by the same person. */
export function revisionsIn(paragraphs: Paragraph[], part?: StoryPart): RevisionView[] {
  const out: RevisionView[] = [];
  let open: RevisionView | undefined;
  const add = (type: string | undefined, author: string | undefined, date: string | undefined, from: Position, to: Position, text: string) => {
    if (type !== 'insert' && type !== 'delete') {
      open = undefined;
      return;
    }
    if (open && open.type === type && open.author === (author ?? '') && comparePositions(open.range.to, from) === 0) {
      open.range = { from: open.range.from, to };
      open.text += text;
      return;
    }
    open = defined<RevisionView>({ type, author: author ?? '', date: date || undefined, range: { from, to }, text, part });
    out.push(open);
  };
  paragraphs.forEach((p, para) => {
    let offset = 0;
    for (const run of p.runs) {
      if (run.text) add(run.props.revision, run.props.revisionAuthor, run.props.revisionDate, { para, offset }, { para, offset: offset + run.text.length }, run.text);
      offset += run.text.length;
    }
    add(p.props.markRevision, p.props.markAuthor, p.props.markDate, { para, offset }, { para: para + 1, offset: 0 }, '¶');
  });
  return out;
}

/** Every change of the document: of its text first, then of its headers, footers and notes. */
export function revisionsOf(doc: Doc): RevisionView[] {
  const out = revisionsIn(doc.paragraphs);
  for (const part of partsOf(doc)) out.push(...revisionsIn(storyOf(doc, part)?.paragraphs ?? [], part));
  return out;
}

/** Whether the document has any change to accept or reject. */
export function hasRevisions(doc: Doc): boolean {
  const any = (paragraphs: Paragraph[]) => paragraphs.some((p) => !!p.props.markRevision || p.runs.some((run) => !!run.props.revision));
  return any(doc.paragraphs) || partsOf(doc).some((part) => any(storyOf(doc, part)?.paragraphs ?? []));
}

/** The change at `pos` in a text: the one the letter after it is in, or else the one before it. */
export function revisionAt(paragraphs: Paragraph[], pos: Position): RevisionView | undefined {
  const all = revisionsIn(paragraphs);
  const inside = (r: RevisionView) => comparePositions(r.range.from, pos) <= 0 && comparePositions(pos, r.range.to) < 0;
  const touching = (r: RevisionView) => comparePositions(r.range.from, pos) <= 0 && comparePositions(pos, r.range.to) <= 0;
  return all.find(inside) ?? all.find(touching);
}

// --- Accepting and rejecting -----------------------------------------------------------

/**
 * The paragraphs with the changes in `range` (all of them without it)
 * accepted or rejected: text put in stays, or goes; text taken out goes, or
 * stays; a mark taken out joins its paragraph to the next, and one put in
 * that is rejected does the same.
 */
function decide(paragraphs: Paragraph[], accept: boolean, range?: Range): Paragraph[] {
  const inRange = (pos: Position) => !range || (comparePositions(range.from, pos) <= 0 && comparePositions(pos, range.to) < 0);
  const out: Paragraph[] = [];
  /** A paragraph whose mark went, waiting to be joined to the next. */
  let pending: { para: Paragraph; runs: Run[] } | undefined;
  paragraphs.forEach((p, para) => {
    // Untouched, it is the same paragraph: what is written back and sent to the others is only what changed.
    const touched = !!pending || (!!p.props.markRevision && inRange({ para, offset: paragraphLength(p) })) || p.runs.some((run, k) => {
      if (!run.props.revision) return false;
      const start = p.runs.slice(0, k).reduce((n, r) => n + r.text.length, 0);
      return !range || (comparePositions(range.from, { para, offset: start + run.text.length }) < 0 && comparePositions({ para, offset: start }, range.to) < 0);
    });
    if (!touched) {
      out.push(p);
      return;
    }
    const runs: Run[] = [];
    let offset = 0;
    for (const run of p.runs) {
      if (!run.props.revision) {
        runs.push(run);
        offset += run.text.length;
        continue;
      }
      for (const ch of run.text) {
        if (!inRange({ para, offset })) runs.push({ text: ch, props: run.props });
        else if ((run.props.revision === 'insert') === accept) runs.push({ text: ch, props: runWithout(run.props) });
        offset += ch.length;
      }
    }
    let props = p.props;
    let joins = false;
    if (p.props.markRevision && inRange({ para, offset })) {
      joins = (p.props.markRevision === 'delete') === accept;
      props = markWithout(p.props);
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

/** The text with its changes in `range` accepted: all of them without it. */
export function acceptRevisions<T extends Pick<Doc, 'paragraphs'>>(doc: T, range?: Range): T {
  return { ...doc, paragraphs: decide(doc.paragraphs, true, range) };
}

/** The text with its changes in `range` rejected: all of them without it. */
export function rejectRevisions<T extends Pick<Doc, 'paragraphs'>>(doc: T, range?: Range): T {
  return { ...doc, paragraphs: decide(doc.paragraphs, false, range) };
}

/** Every change of the document accepted, or rejected: in its text, headers, footers and notes. */
export function decideAllRevisions(doc: Doc, accept: boolean): Doc {
  let out: Doc = accept ? acceptRevisions(doc) : rejectRevisions(doc);
  for (const part of partsOf(doc)) {
    const story = storyOf(out, part);
    if (!story) continue;
    const paragraphs = decide(story.paragraphs, accept);
    if (paragraphs.some((p, i) => p !== story.paragraphs[i]) || paragraphs.length !== story.paragraphs.length) out = withStory(out, part, { ...story, paragraphs });
  }
  return out;
}
