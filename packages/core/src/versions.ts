// Versions of a document: what changed from one to another, and going back to
// one. Keeping them is the application's, which has them as DOCX files; this
// is what is done with two of them once read. The comparison is of what can
// be read, paragraph by paragraph and, inside a paragraph that changed, word
// by word, in the text, its headers and footers, and its notes at the foot of
// the page. It comes as a list of changes and as a document to look at: the
// later one, with what was taken out struck through and what was put in
// underlined, as Word shows a comparison.

import {
  type Doc,
  type Media,
  type Note,
  type Paragraph,
  type Position,
  type Run,
  type RunProps,
  type Story,
  ANCHOR_CHAR,
  OBJECT_CHAR,
  defined,
  paragraphText,
  resolveParagraph,
  resolveRun,
} from './model';
import { sliceRuns } from './ops';
import { commonPairs } from './diffing';
import { docImage, mediaKey } from './images';
import { type StoryPart, endnotePart, footnotePart, storyOf, storyParts, withStory } from './stories';
import { shownEndnotes, shownFootnotes } from './footnotes';
import { decideAllRevisions, hasRevisions } from './revisions';
import { textBoxPart } from './textboxes';
import { paragraphStyles } from './styles';

export type ChangeKind = 'added' | 'removed' | 'changed' | 'formatted';

/** A stretch of the text of a change: the same in both, only in the later one, or only in the earlier one. */
export interface ChangePiece {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

export interface Change {
  /** A paragraph put in or taken out, one whose text changed, or one whose text is the same but not its look. */
  kind: ChangeKind;
  /** Where it is when not in the text: a header, a footer, a note at the foot of the page. */
  part?: StoryPart;
  /** The paragraph in the earlier version and in the later one, by index in its part; one is missing when the paragraph is only in the other. */
  before?: number;
  after?: number;
  pieces: ChangePiece[];
}

/** A note on the text (what Word calls a comment) written, taken out, or whose text changed. */
export interface NoteChange {
  kind: 'added' | 'removed' | 'changed';
  author: string;
  date?: string;
  /** Its id in the earlier version and in the later one; one is missing when it is only in the other. */
  before?: string;
  after?: string;
  pieces: ChangePiece[];
}

export interface Comparison {
  changes: Change[];
  /** The notes on the text written, taken out or changed: listed, not marked in `doc`. */
  notes: NoteChange[];
  /**
   * The later version with the changes marked: what was taken out struck
   * through in red, in its place, and what was put in underlined in green.
   * To look at, not to edit or keep.
   */
  doc: Doc;
  /** Where each change of the text starts in `doc`, in the order of the changes; for one of a part, in that part's text. */
  marks: { part?: StoryPart; pos: Position }[];
}

/** The colours of what was put in and what was taken out. */
export const ADDED_COLOR = '1A7F37';
export const REMOVED_COLOR = 'C62828';

const added = (props: RunProps): RunProps => ({ ...props, underline: true, strike: false, color: ADDED_COLOR });
const removed = (props: RunProps): RunProps => ({ ...props, strike: true, underline: false, color: REMOVED_COLOR });

// --- Words --------------------------------------------------------------------------

interface Token {
  text: string;
  from: number;
}

/** The words of a text, the spaces between them, and each picture or mark on its own. */
function tokens(text: string): Token[] {
  const out: Token[] = [];
  // Chinese, without spaces, a character at a time: what changed in a sentence of it is the characters that did.
  const word = /[\uFFFC\u2060]|\s+|\p{Script=Han}|(?:(?!\p{Script=Han})[\p{L}\p{N}_])+|[^\s\p{L}\p{N}_]/gu;
  for (let found = word.exec(text); found; found = word.exec(text)) out.push({ text: found[0], from: found.index });
  return out;
}

/** How much two texts have of the same words, from 0 to 1: the words alone, without the marks beside them. */
function likeness(a: string, b: string): number {
  const words = (text: string) => text.match(/\p{Script=Han}|(?:(?!\p{Script=Han})[\p{L}\p{N}_])+/gu) ?? [];
  const wa = words(a);
  const wb = words(b);
  if (!wa.length && !wb.length) return 1;
  const count = new Map<string, number>();
  for (const w of wa) count.set(w, (count.get(w) ?? 0) + 1);
  let common = 0;
  for (const w of wb) {
    const left = count.get(w) ?? 0;
    if (left > 0) {
      common++;
      count.set(w, left - 1);
    }
  }
  return (2 * common) / (wa.length + wb.length);
}

/** Below this, a paragraph taken out and one put in where it was are two, not one that changed. */
const ALIKE = 0.4;

/** What a reader sees of a text: without the marks that take no room. */
const readable = (text: string) => text.replaceAll(ANCHOR_CHAR, '');

// --- Look ---------------------------------------------------------------------------

const LOOK: (keyof RunProps)[] = ['bold', 'italic', 'underline', 'strike', 'fontSize', 'fontFamily', 'color', 'highlight'];

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) if (!sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
    return true;
  }
  return (a === undefined || a === false || a === 0 || a === '') && (b === undefined || b === false || b === 0 || b === '');
}

const sameLook = (a: RunProps, b: RunProps) => {
  const ra = resolveRun(a) as RunProps;
  const rb = resolveRun(b) as RunProps;
  return LOOK.every((key) => sameValue(ra[key], rb[key]));
};

/** The default style of a document's paragraphs, which a paragraph has whether it says so or not. */
const defaultStyle = (doc: Doc) => paragraphStyles(doc)[0]?.id ?? '';

/** Whether two paragraphs of the same text look the same: the paragraph, and each letter of it. `styles` are the default styles of each. */
function looksSame(a: Paragraph, b: Paragraph, styles: [string, string]): boolean {
  const style = (p: Paragraph, own: string) => (!p.props.styleId || p.props.styleId === own ? '' : p.props.styleId);
  if (style(a, styles[0]) !== style(b, styles[1])) return false;
  if (!sameValue({ ...resolveParagraph(a.props), styleId: '' }, { ...resolveParagraph(b.props), styleId: '' })) return false;
  // Letter by letter, however each is cut into runs, and without the marks that take no room.
  const visible = (p: Paragraph) => p.runs.filter((run) => !run.props.anchor && run.text).map((run) => ({ ...run, text: readable(run.text) }));
  const runsA = visible(a);
  const runsB = visible(b);
  let i = 0;
  let j = 0;
  let offA = 0;
  let offB = 0;
  while (i < runsA.length && j < runsB.length) {
    const ra = runsA[i];
    const rb = runsB[j];
    if (ra.text.length && rb.text.length && !sameLook(ra.props, rb.props)) return false;
    const endA = offA + ra.text.length;
    const endB = offB + rb.text.length;
    if (endA <= endB) {
      offA = endA;
      i++;
    }
    if (endB <= endA) {
      offB = endB;
      j++;
    }
  }
  return true;
}

// --- Comparing the paragraphs of a part ----------------------------------------------

type Step = { kind: 'same' | 'formatted'; b: number; a: number } | { kind: 'removed'; b: number } | { kind: 'added'; a: number } | { kind: 'changed'; b: number; a: number };

/** How the paragraphs of `before` became those of `after`, in the order of the later ones. */
function steps(before: Paragraph[], after: Paragraph[], styles: [string, string]): Step[] {
  // As they read: a mark that takes no room, as where a bookmark is, is not a change of the text.
  const textB = before.map((p) => readable(paragraphText(p)));
  const textA = after.map((p) => readable(paragraphText(p)));
  const pairs = commonPairs(textB, textA);
  const out: Step[] = [];
  let b = 0;
  let a = 0;
  const gap = (toB: number, toA: number) => {
    // Between two that match, those taken out and those put in: one of each that are alike is one that changed.
    const gone = Array.from({ length: toB - b }, (_, k) => b + k);
    const come = Array.from({ length: toA - a }, (_, k) => a + k);
    let j = 0;
    for (const was of gone) {
      const k = come.findIndex((now, at) => at >= j && likeness(textB[was], textA[now]) >= ALIKE);
      if (k < 0) {
        out.push({ kind: 'removed', b: was });
        continue;
      }
      for (; j < k; j++) out.push({ kind: 'added', a: come[j] });
      out.push({ kind: 'changed', b: was, a: come[k] });
      j = k + 1;
    }
    for (; j < come.length; j++) out.push({ kind: 'added', a: come[j] });
  };
  for (const [pb, pa] of pairs) {
    gap(pb, pa);
    out.push({ kind: looksSame(before[pb], after[pa], styles) ? 'same' : 'formatted', b: pb, a: pa });
    b = pb + 1;
    a = pa + 1;
  }
  gap(before.length, after.length);
  return out;
}

/** The words of two versions of a paragraph, each the same, put in or taken out. */
function wordSteps(was: string, now: string): { kind: ChangePiece['kind']; from: number; to: number }[] {
  const tb = tokens(was);
  const ta = tokens(now);
  const pairs = commonPairs(
    tb.map((t) => t.text),
    ta.map((t) => t.text),
  );
  const out: { kind: ChangePiece['kind']; from: number; to: number }[] = [];
  const push = (kind: ChangePiece['kind'], from: number, to: number) => {
    if (from >= to) return;
    const last = out[out.length - 1];
    if (last?.kind === kind && last.to === from) last.to = to;
    else out.push({ kind, from, to });
  };
  const endB = (k: number) => (k < tb.length ? tb[k].from : was.length);
  const endA = (k: number) => (k < ta.length ? ta[k].from : now.length);
  let b = 0;
  let a = 0;
  for (const [pb, pa] of [...pairs, [tb.length, ta.length] as [number, number]]) {
    // Offsets: those of 'removed' are in the earlier text, the others in the later one.
    push('removed', endB(b), endB(pb));
    push('added', endA(a), endA(pa));
    if (pb < tb.length) push('same', ta[pa].from, endA(pa + 1));
    b = pb + 1;
    a = pa + 1;
  }
  return out;
}

/** What the person reads of a change: the words of it, and some of those around them. */
function piecesOf(kind: Change['kind'], was: string, now: string): ChangePiece[] {
  if (kind === 'added') return [{ kind: 'added', text: readable(now) }];
  if (kind === 'removed') return [{ kind: 'removed', text: readable(was) }];
  if (kind === 'formatted') return [{ kind: 'same', text: readable(now) }];
  return wordSteps(was, now)
    .map((step) => ({ kind: step.kind, text: readable((step.kind === 'removed' ? was : now).slice(step.from, step.to)) }))
    .filter((piece) => piece.text);
}

// --- The document to look at ---------------------------------------------------------

interface Marking {
  /** Pictures of another package carried with the document, by their new key. */
  media: Record<string, Media>;
}

/**
 * The key a picture carried from another package goes by: made of its bytes,
 * so that the same picture always has the same one and two others never
 * share it, whatever was shown under that key before.
 */
function imageName(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 0x01000193);
  return `v${(hash >>> 0).toString(36)}${bytes.length.toString(36)}`;
}

/**
 * The runs of the earlier version taken out, struck through: the marks that
 * take no room go, since what they named may not be there any more; the
 * pictures stay, carried with the document.
 */
function struck(runs: Run[], from: Doc, part: StoryPart | undefined, marking: Marking): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    if (run.props.anchor && !run.props.object?.includes('<w:drawing')) continue;
    const props = run.props.object ? carried(run.props, from, part, marking) : run.props;
    out.push({ text: run.text, props: removed(props) });
  }
  return out;
}

/** A picture of another package, as one the document carries with it. */
function carried(props: RunProps, from: Pick<Doc, 'paragraphs' | 'media' | 'source'>, part: StoryPart | undefined, marking: Marking): RunProps {
  const xml = props.object!;
  const key = mediaKey(xml);
  const image = docImage(from, xml, part);
  if (!image) return props;
  const name = imageName(image.bytes);
  marking.media[name] = image;
  const object = key === undefined ? xml.replace(/\br:embed="[^"]*"/, `r:embed="dx:${name}"`) : xml.replace(`r:embed="dx:${key}"`, `r:embed="dx:${name}"`);
  return { ...props, object };
}

/** A paragraph of the earlier version where it was taken out: as it was, but for what only its own file knows. */
function asRemoved(p: Paragraph, from: Doc, to: Doc, part: StoryPart | undefined, marking: Marking): Paragraph {
  const { numId, listLevel, ...props } = p.props;
  const listed = numId && to.numbering?.lists.has(numId) ? { numId, listLevel } : {};
  const runs = struck(p.runs, from, part, marking);
  return { props: defined({ ...props, ...listed }), runs: runs.length ? runs : [{ text: '', props: removed(p.runs[0]?.props ?? {}) }] };
}

/** A paragraph that changed, with its words of both versions: those taken out struck through, those put in underlined. */
function asChanged(was: Paragraph, now: Paragraph, from: Doc, part: StoryPart | undefined, marking: Marking): { paragraph: Paragraph; first: number } {
  const runs: Run[] = [];
  let at = 0;
  let first = -1;
  for (const step of wordSteps(paragraphText(was), paragraphText(now))) {
    if (step.kind !== 'same' && first < 0) first = at;
    if (step.kind === 'removed') {
      const taken = struck(sliceRuns(was.runs, step.from, step.to), from, part, marking);
      runs.push(...taken);
      at += taken.reduce((n, run) => n + run.text.length, 0);
    } else {
      const kept = sliceRuns(now.runs, step.from, step.to);
      runs.push(...(step.kind === 'added' ? kept.map((run) => ({ text: run.text, props: added(run.props) })) : kept));
      at += step.to - step.from;
    }
  }
  return { paragraph: { ...now, runs: runs.length ? runs : now.runs }, first: Math.max(0, first) };
}

/** The paragraphs of a part with its changes marked, and where each change starts among them. */
function marked(story: Story, from: Doc, to: Doc, before: Paragraph[], part: StoryPart | undefined, marking: Marking, list: Step[]): { paragraphs: Paragraph[]; marks: Position[] } {
  const out: Paragraph[] = [];
  const marks: Position[] = [];
  /** The paragraphs taken out between two of a table, which cannot go between them: they go after it. */
  let waiting: Paragraph[] = [];
  const nextA = (k: number) => {
    for (let s = k + 1; s < list.length; s++) {
      const step = list[s];
      if (step.kind !== 'removed') return story.paragraphs[step.a];
    }
    return undefined;
  };
  const flush = (next: Paragraph | undefined) => {
    if (!waiting.length) return;
    const prev = out[out.length - 1];
    if (next?.cell && prev?.cell && next.cell.table === prev.cell.table) return;
    out.push(...waiting);
    waiting = [];
  };
  list.forEach((step, k) => {
    if (step.kind === 'removed') {
      const p = asRemoved(before[step.b], from, to, part, marking);
      const prev = out[out.length - 1];
      const next = nextA(k);
      marks.push({ para: out.length + waiting.length, offset: 0 });
      if (before[step.b].cell) {
        // In a table, in the cell the paragraph before it is in, or the one after.
        const cell = prev?.cell ?? next?.cell;
        out.push(cell ? { ...p, cell } : p);
      } else if (prev?.cell && next?.cell && prev.cell.table === next.cell.table) waiting.push(p);
      else out.push(p);
      return;
    }
    const now = story.paragraphs[step.a];
    flush(now);
    if (step.kind === 'same') out.push(now);
    else if (step.kind === 'formatted') {
      marks.push({ para: out.length, offset: 0 });
      out.push(now);
    } else if (step.kind === 'added') {
      marks.push({ para: out.length, offset: 0 });
      out.push({ ...now, runs: now.runs.map((run) => ({ text: run.text, props: added(run.props) })) });
    } else {
      const { paragraph, first } = asChanged(before[step.b], now, from, part, marking);
      marks.push({ para: out.length, offset: first });
      out.push(paragraph);
    }
  });
  flush(undefined);
  out.push(...waiting);
  return { paragraphs: out, marks };
}

/** The parts both versions have text in besides the body: headers, footers, the notes at the foot and at the end their references show, and text boxes. */
function partsOf(before: Doc, after: Doc): StoryPart[] {
  const parts = new Set<StoryPart>([...storyParts(before), ...storyParts(after)]);
  for (const doc of [after, before]) for (const note of shownFootnotes(doc)) parts.add(footnotePart(note.id));
  for (const doc of [after, before]) for (const note of shownEndnotes(doc)) parts.add(endnotePart(note.id));
  for (const doc of [after, before]) for (const box of doc.textBoxes ?? []) parts.add(textBoxPart(box.id));
  return [...parts];
}

/**
 * The notes on the text of two versions, each with its own in the other:
 * by who wrote it and when, which Word keeps when it saves, though not the
 * id; without a date, by who wrote it and what it says.
 */
function compareNotes(before: Note[], after: Note[]): NoteChange[] {
  const left = before.slice();
  const out: NoteChange[] = [];
  const same = (a: Note, b: Note) => a.author === b.author && (a.date || b.date ? a.date === b.date : a.text === b.text);
  for (const now of after) {
    const k = left.findIndex((was) => same(was, now));
    const was = k < 0 ? undefined : left.splice(k, 1)[0];
    if (was && was.text === now.text) continue;
    const kind = was ? 'changed' : 'added';
    out.push(defined({ kind, author: now.author, date: now.date, before: was?.id, after: now.id, pieces: piecesOf(kind, was?.text ?? '', now.text) }));
  }
  for (const was of left) out.push(defined({ kind: 'removed' as const, author: was.author, date: was.date, before: was.id, pieces: piecesOf('removed', was.text, '') }));
  return out;
}

/**
 * What changed from `before` to `after`, two versions of a document: the
 * paragraphs put in, taken out and changed, of the text and of its headers,
 * footers, notes at the foot of the page and text boxes; the notes on the
 * text; and the later version with them marked. A version with tracked
 * changes is compared as if they were accepted, as Word compares it.
 */
export function compareDocs(before: Doc, after: Doc): Comparison {
  if (hasRevisions(before)) before = decideAllRevisions(before, true);
  if (hasRevisions(after)) after = decideAllRevisions(after, true);
  const changes: Change[] = [];
  const marks: Comparison['marks'] = [];
  const marking: Marking = { media: {} };
  const styles: [string, string] = [defaultStyle(before), defaultStyle(after)];
  const compare = (was: Story | undefined, now: Story | undefined, part: StoryPart | undefined): Story | undefined => {
    const b = was?.paragraphs ?? [];
    const a = now?.paragraphs ?? [];
    const list = steps(b, a, styles);
    if (!list.some((step) => step.kind !== 'same')) return now;
    for (const step of list) {
      if (step.kind === 'same') continue;
      const textB = 'b' in step ? paragraphText(b[step.b]) : '';
      const textA = 'a' in step ? paragraphText(a[step.a]) : '';
      changes.push(defined({ kind: step.kind, part, before: 'b' in step ? step.b : undefined, after: 'a' in step ? step.a : undefined, pieces: piecesOf(step.kind, textB, textA) }));
    }
    const shown = marked(now ?? { paragraphs: [] }, before, after, b, part, marking, list);
    for (const pos of shown.marks) marks.push(defined({ part, pos }));
    if (!shown.paragraphs.length) return now;
    return { ...now, paragraphs: shown.paragraphs };
  };
  const body = compare(before, after, undefined)!;
  let doc: Doc = { ...after, paragraphs: body.paragraphs };
  for (const part of partsOf(before, after)) {
    const was = storyOf(before, part);
    const now = storyOf(after, part);
    const shown = compare(was, now, part);
    // A part only the earlier version had is listed, but has nowhere to be shown.
    if (shown && shown !== now) doc = withStory(doc, part, shown);
  }
  if (Object.keys(marking.media).length) doc = { ...doc, media: { ...doc.media, ...marking.media } };
  return { changes, notes: compareNotes(before.notes ?? [], after.notes ?? []), doc, marks };
}

// --- Going back to a version --------------------------------------------------------

/**
 * `version` in place of `current`, as a change to it: the paragraphs that did
 * not change are the current ones, so that what was not touched is written
 * back as it was and the others working on it are sent only what changed;
 * the rest is the version's, with its pictures carried with it, since the
 * package the document is written into is still the current one.
 */
export function restoreVersion(current: Doc, version: Doc): Doc {
  const marking: Marking = { media: {} };
  const styles: [string, string] = [defaultStyle(current), defaultStyle(version)];
  const own = (p: Paragraph, part: StoryPart | undefined): Paragraph => {
    const runs = p.runs.map((run) => {
      if (!run.props.object || !/\br:embed="/.test(run.props.object)) return run;
      const image = docImage(version, run.props.object, part);
      if (!image) return run;
      const name = imageName(image.bytes);
      marking.media[name] = image;
      return { text: run.text, props: { ...run.props, object: run.props.object.replace(/\br:embed="[^"]*"/, `r:embed="dx:${name}"`) } };
    });
    const { origin: _, id: __, ...rest } = p;
    return { ...rest, runs };
  };
  /** The version's paragraphs, the current one in place of each that is the same and not in a table. */
  const merge = (was: Paragraph[], now: Paragraph[], part: StoryPart | undefined): Paragraph[] => {
    const out: Paragraph[] = now.map((p) => own(p, part));
    for (const step of steps(was, now, styles)) {
      if (step.kind !== 'same') continue;
      const kept = was[step.b];
      // The very same text, its marks too: a note or a bookmark the version has not would be left without its own.
      if (paragraphText(kept) === paragraphText(now[step.a]) && !kept.cell && !now[step.a].cell && !!kept.section === !!now[step.a].section && sameValue(kept.section, now[step.a].section))
        out[step.a] = kept;
    }
    return out;
  };
  let doc: Doc = { ...version, source: current.source, paragraphs: merge(current.paragraphs, version.paragraphs, undefined) };
  // Its own media is the version's, read from its file; current's pictures put in since go with the paragraphs that had them.
  const { media: _, ...rest } = doc;
  doc = rest;
  for (const part of partsOf(current, version)) {
    const now = storyOf(version, part);
    if (!now) {
      doc = withStory(doc, part, undefined);
      continue;
    }
    doc = withStory(doc, part, { ...now, paragraphs: merge(storyOf(current, part)?.paragraphs ?? [], now.paragraphs, part) });
  }
  const media = { ...version.media, ...marking.media };
  // The current pictures that the kept paragraphs still show.
  for (const [key, value] of Object.entries(current.media ?? {})) media[key] ??= value;
  return Object.keys(media).length ? { ...doc, media } : doc;
}

/** The changes of a comparison as plain text: `[-taken out-]` and `{+put in+}`, with some of the words around them. */
export function describeChange(change: Pick<Change, 'kind' | 'pieces'>, context = 40): string {
  const text = (piece: ChangePiece) => piece.text.replaceAll(OBJECT_CHAR, '[image]');
  return change.pieces
    .map((piece, i) => {
      if (piece.kind === 'removed') return `[-${text(piece)}-]`;
      if (piece.kind === 'added') return `{+${text(piece)}+}`;
      if (change.kind !== 'changed') return text(piece);
      const t = text(piece);
      if (t.length <= context * 2) return t;
      const first = i === 0;
      const last = i === change.pieces.length - 1;
      if (first) return `…${t.slice(-context)}`;
      if (last) return `${t.slice(0, context)}…`;
      return `${t.slice(0, context)}…${t.slice(-context)}`;
    })
    .join('');
}
