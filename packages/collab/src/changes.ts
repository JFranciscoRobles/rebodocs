// What several people working on one document send each other: not the
// document, but what each of them changed in it. A change names the paragraph
// it is about by its id, never by its place, so it still means the same once
// the paragraphs around it have come and gone.
//
// There are four things to do with changes, and they are all here: tell which
// ones lead from one document to another (`diff`), make them (`apply`), say
// what a change becomes when someone else's got there first (`transform`),
// and follow a caret through them (`mapAnchor`). None of it needs a browser.

import {
  type CellRef,
  type Doc,
  type Media,
  type Note,
  type Paragraph,
  type Run,
  type RunProps,
  type Section,
  type Story,
  type StoryPart,
  type Table,
  STORY_PARTS,
  createDoc,
  footnotePart,
  textBoxPart,
  cellOfTable,
  defined,
  inCell,
  paragraphLength,
  paragraphText,
  sameCell,
  sliceRuns,
  storyOf,
  withStory,
} from '@rebodocs/core';

/** Where a paragraph is: the text of the document when there is no part, or one of its headers and footers. */
interface InFlow {
  part?: StoryPart;
}

/** Text taken out of a paragraph and text put in, at one place. */
export interface Splice extends InFlow {
  t: 'splice';
  id: string;
  at: number;
  remove: number;
  insert: Run[];
  /** The formatting the paragraph keeps for what is typed next, when this leaves it without text. */
  empty?: RunProps;
  /** What it puts in is the text it takes out, with other formatting: it moves nothing, and is made letter by letter. */
  format?: true;
}

/** The formatting of a paragraph: only what changed of it. `null` takes a property away. */
export interface SetParagraph extends InFlow {
  t: 'para';
  id: string;
  props?: Record<string, unknown>;
  cell?: CellRef | null;
  origin?: number | null;
  /** The section the paragraph ends, as a whole: its page, its columns, its own header and footer. */
  section?: Section | null;
}

export interface InsertParagraphs extends InFlow {
  t: 'insert';
  /** The paragraph they go after; `null` for the start. */
  after: string | null;
  paras: Paragraph[];
}

export interface DeleteParagraph extends InFlow {
  t: 'delete';
  id: string;
  /** The paragraph that was before it: where what was to go after it goes instead. */
  prev: string | null;
  /**
   * The paragraph as it was taken out. With it, what someone else was writing
   * in it meanwhile is not lost: the paragraph goes, and what they wrote stays.
   */
  para?: Paragraph;
}

/** A paragraph cut in two at `at`: what follows becomes the paragraph `newId`, right after it. */
export interface Split extends InFlow {
  t: 'split';
  id: string;
  at: number;
  newId: string;
  /**
   * The formatting of the second half: that of the paragraph cut, whose mark
   * it ends with, even when someone else brought that paragraph up to another.
   */
  props?: Record<string, unknown>;
}

/** The paragraph `next` added to the end of `id`, which was `at` long. */
export interface Join extends InFlow {
  t: 'join';
  id: string;
  next: string;
  at: number;
}

/** The shape of a table. `fresh` for one that was not there: two made at once must not take the same place. */
export interface SetTable extends InFlow {
  t: 'table';
  index: number;
  value: Table;
  fresh?: boolean;
}

/** A header or footer as a whole: made, or taken away. */
export interface SetStory {
  t: 'story';
  part: StoryPart;
  value: Story | null;
}

export interface SetField {
  t: 'set';
  key: 'page' | 'compatMode' | 'styles' | 'titlePage' | 'columns' | 'sectionStart' | 'noHeader' | 'noFooter' | 'trackRevisions';
  value: unknown;
}

export interface SetNote {
  t: 'note';
  id: string;
  value: Note | null;
}

export interface SetMedia {
  t: 'media';
  key: string;
  value: Media;
}

/** One list definition: an abstract one (its levels) or a list that uses one. */
export interface SetList {
  t: 'num';
  kind: 'abstract' | 'list';
  id: number;
  value: unknown;
}

export type Op = Splice | SetParagraph | InsertParagraphs | DeleteParagraph | Split | Join | SetTable | SetStory | SetField | SetNote | SetMedia | SetList;

// --- Ids ----------------------------------------------------------------------------

/** The paragraphs of each part of a document, the text first. */
/** The parts a document, or either of two, has text in besides its body: its headers and footers, and its notes at the foot of the pages. */
export function storyPartsOf(...docs: Doc[]): StoryPart[] {
  const notes = new Set(docs.flatMap((doc) => (doc.footnotes ?? []).map((note) => footnotePart(note.id))));
  const boxes = new Set(docs.flatMap((doc) => (doc.textBoxes ?? []).map((box) => textBoxPart(box.id))));
  return [...STORY_PARTS, ...notes, ...boxes];
}

function flows(doc: Doc): { part?: StoryPart; paragraphs: Paragraph[] }[] {
  const out: { part?: StoryPart; paragraphs: Paragraph[] }[] = [{ paragraphs: doc.paragraphs }];
  for (const part of storyPartsOf(doc)) {
    const story = storyOf(doc, part);
    if (story) out.push({ part, paragraphs: story.paragraphs });
  }
  return out;
}

/**
 * Gives every paragraph of a document that was just read its id, by where it
 * is: whoever reads the same file gives the same ones. It writes them on the
 * paragraphs themselves, which only a document nobody else holds yet allows;
 * that keeps them the very objects the file was read into, and so written
 * back untouched.
 */
export function stampIds(doc: Doc): Doc {
  for (const { part, paragraphs } of flows(doc)) {
    paragraphs.forEach((p, i) => {
      // A note's id ends in digits: what follows it is kept apart.
      p.id = part?.startsWith('footnote:') || part?.startsWith('textbox:') ? `${part}#${i}` : `${part ?? 'p'}${i}`;
    });
  }
  return doc;
}

function withIds(before: Paragraph[], after: Paragraph[], mint: () => string): Paragraph[] {
  if (before === after) return after;
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  const stop = after.length - end;
  if (start >= stop) return after;
  // The ids of what did not change are taken; among what did, the first to have one keeps it.
  const taken = new Set<string>();
  for (let i = 0; i < after.length; i++) if ((i < start || i >= stop) && after[i].id) taken.add(after[i].id!);
  const wanted = new Set<string>();
  for (let i = start; i < stop; i++) if (after[i].id) wanted.add(after[i].id!);
  let out: Paragraph[] | undefined;
  for (let i = start; i < stop; i++) {
    const p = after[i];
    if (p.id && !taken.has(p.id)) {
      taken.add(p.id);
      continue;
    }
    // One made anew where another was takes its name, when nobody else has it: it is that one, changed.
    const was = before[i]?.id;
    const id = !p.id && i < before.length - end && was && !taken.has(was) && !wanted.has(was) ? was : mint();
    taken.add(id);
    out ??= after.slice();
    out[i] = { ...p, id };
  }
  return out ?? after;
}

/**
 * `after` with an id on every paragraph: the ones it has, and new ones for
 * the paragraphs made since `before`, which is the same document as it was
 * and already has them all.
 */
export function ensureIds(before: Doc, after: Doc, mint: () => string): Doc {
  if (before === after) return after;
  let doc = after;
  const paragraphs = withIds(before.paragraphs, after.paragraphs, mint);
  if (paragraphs !== after.paragraphs) doc = { ...doc, paragraphs };
  for (const part of storyPartsOf(after)) {
    const story = storyOf(after, part);
    if (!story) continue;
    const next = withIds(storyOf(before, part)?.paragraphs ?? [], story.paragraphs, mint);
    if (next !== story.paragraphs) doc = withStory(doc, part, { ...story, paragraphs: next });
  }
  return doc;
}

// --- From one document to another ---------------------------------------------------

function sameProps(a: object, b: object): boolean {
  if (a === b) return true;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  for (const key in x) if (x[key] !== y[key]) return false;
  for (const key in y) if (!(key in x) && y[key] !== undefined) return false;
  return true;
}

/** The formatting of each character of a paragraph. */
function propsByChar(runs: Run[]): RunProps[] {
  const out: RunProps[] = [];
  for (const run of runs) for (let i = 0; i < run.text.length; i++) out.push(run.props);
  return out;
}

const someRuns = (runs: Run[], like: Run[]): Run[] => (runs.length ? runs : [{ text: '', props: like[0]?.props ?? {} }]);

/** What turns the paragraph `was` into `now`, which has its id. */
function diffParagraph(was: Paragraph, now: Paragraph, part: StoryPart | undefined, out: Op[]): void {
  if (was === now) return;
  const id = now.id!;
  const flow = part ? { part } : {};
  if (was.runs !== now.runs) {
    const a = paragraphText(was);
    const b = paragraphText(now);
    const pa = propsByChar(was.runs);
    const pb = propsByChar(now.runs);
    const most = Math.min(a.length, b.length);
    let head = 0;
    while (head < most && a[head] === b[head] && sameProps(pa[head], pb[head])) head++;
    let tail = 0;
    while (tail < most - head && a[a.length - 1 - tail] === b[b.length - 1 - tail] && sameProps(pa[a.length - 1 - tail], pb[b.length - 1 - tail])) tail++;
    const remove = a.length - head - tail;
    const insert = sliceRuns(now.runs, head, b.length - tail);
    // An empty paragraph still has the formatting of what will be typed in it.
    const empty = b.length === 0 && !(a.length === 0 && sameProps(was.runs[0]?.props ?? {}, now.runs[0]?.props ?? {})) ? { empty: now.runs[0]?.props ?? {} } : {};
    const format = remove > 0 && a.slice(head, a.length - tail) === b.slice(head, b.length - tail) ? { format: true as const } : {};
    if (remove || insert.length || 'empty' in empty) out.push({ t: 'splice', ...flow, id, at: head, remove, insert, ...empty, ...format });
  }
  const op: SetParagraph = { t: 'para', ...flow, id };
  if (!sameProps(was.props, now.props)) {
    const props: Record<string, unknown> = {};
    const a = was.props as Record<string, unknown>;
    const b = now.props as Record<string, unknown>;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[key] !== b[key]) props[key] = b[key] ?? null;
    op.props = props;
  }
  if (!sameCell(was.cell, now.cell)) op.cell = now.cell ?? null;
  if (was.origin !== now.origin) op.origin = now.origin ?? null;
  if (was.section !== now.section && JSON.stringify(was.section ?? null) !== JSON.stringify(now.section ?? null)) op.section = now.section ?? null;
  if (op.props || 'cell' in op || 'origin' in op || 'section' in op) out.push(op);
}

function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

function diffFlow(before: Paragraph[], after: Paragraph[], part: StoryPart | undefined, out: Op[]): void {
  if (before === after) return;
  const flow = part ? { part } : {};
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  const olds = before.slice(start, before.length - end);
  const news = after.slice(start, after.length - end);
  const ahead = start > 0 ? before[start - 1].id! : null;

  // The paragraphs that are still there: those of the new ones found among the old, in the same order.
  const place = new Map(olds.map((p, i) => [p.id!, i]));
  const kept = new Set<string>();
  let from = 0;
  for (const p of news) {
    const at = place.get(p.id!);
    if (at !== undefined && at >= from) {
      kept.add(p.id!);
      from = at + 1;
    }
  }
  const nowOf = new Map(news.map((p) => [p.id!, p]));
  /** Each paragraph as the changes written so far leave it. */
  const state = new Map(olds.filter((p) => kept.has(p.id!)).map((p) => [p.id!, p]));

  // The ones that are gone. The last of a stretch of them may have been joined to the paragraph before the stretch.
  let last: Paragraph | undefined;
  for (let i = 0; i < olds.length; i++) {
    if (kept.has(olds[i].id!)) {
      last = olds[i];
      continue;
    }
    let stop = i;
    while (stop + 1 < olds.length && !kept.has(olds[stop + 1].id!)) stop++;
    const tail = olds[stop];
    let joined = false;
    if (last) {
      const was = paragraphText(last);
      const now = paragraphText(nowOf.get(last.id!)!);
      const rest = now.slice(commonPrefix(was, now));
      joined = was !== now && rest.length > 0 && paragraphText(tail).endsWith(rest);
    }
    if (joined) {
      // Text taken out from one paragraph to another: every paragraph between is brought up to the first, and their text goes as text.
      // Someone writing in one of them meanwhile keeps what they wrote, as anywhere else in a stretch taken out.
      let into = state.get(last!.id!)!;
      for (let k = i; k <= stop; k++) {
        out.push({ t: 'join', ...flow, id: last!.id!, next: olds[k].id!, at: paragraphLength(into) });
        const { section: _, ...head } = into;
        into = defined<Paragraph>({ ...head, runs: [...into.runs, ...olds[k].runs], section: olds[k].section });
      }
      state.set(last!.id!, into);
    } else {
      for (let k = i; k <= stop; k++) out.push({ t: 'delete', ...flow, id: olds[k].id!, prev: last?.id ?? ahead, para: olds[k] });
    }
    i = stop;
  }

  // The ones that are new, and what changed in the ones that stay.
  let after_ = ahead;
  let group: Paragraph[] = [];
  let groupAfter = ahead;
  const flush = () => {
    if (group.length) out.push({ t: 'insert', ...flow, after: groupAfter, paras: group });
    group = [];
  };
  for (let i = 0; i < news.length; i++) {
    const now = news[i];
    let was = state.get(now.id!);
    if (!was) {
      if (!group.length) groupAfter = after_;
      group.push(now);
      after_ = now.id!;
      continue;
    }
    flush();
    // Cut in two: what follows is the rest of its text, in a paragraph that was not there.
    const follows = news[i + 1];
    if (follows && !state.has(follows.id!)) {
      const text = paragraphText(was);
      const head = paragraphText(now);
      const rest = paragraphText(follows);
      if (rest.length > 0 && text === head + rest) {
        out.push({ t: 'split', ...flow, id: now.id!, at: head.length, newId: follows.id!, props: was.props as unknown as Record<string, unknown> });
        state.set(follows.id!, { ...was, id: follows.id!, runs: someRuns(sliceRuns(was.runs, head.length, text.length), was.runs) });
        const { section: _, ...rest } = was;
        was = { ...rest, runs: someRuns(sliceRuns(was.runs, 0, head.length), was.runs) };
      }
    }
    diffParagraph(was, now, part, out);
    after_ = now.id!;
  }
  flush();
}

function diffTables(before: Table[] | undefined, after: Table[] | undefined, part: StoryPart | undefined, out: Op[]): void {
  if (before === after || !after) return;
  // A table is never taken out of the list: the paragraphs of the others name them by their place in it.
  after.forEach((table, index) => {
    if (table && before?.[index] !== table) out.push({ t: 'table', ...(part ? { part } : {}), index, value: table, ...(index >= (before?.length ?? 0) ? { fresh: true } : {}) });
  });
}

function diffMap<K, V>(before: Map<K, V> | undefined, after: Map<K, V> | undefined, each: (key: K, value: V | null) => void): void {
  if (before === after) return;
  for (const [key, value] of after ?? []) if (before?.get(key) !== value) each(key, value);
  for (const key of before?.keys() ?? []) if (!after?.has(key)) each(key, null);
}

/** The changes that turn `before` into `after`. Every paragraph of both has its id. */
export function diff(before: Doc, after: Doc): Op[] {
  const out: Op[] = [];
  if (before === after) return out;
  if (before.page !== after.page && !sameProps(before.page, after.page)) out.push({ t: 'set', key: 'page', value: after.page });
  if (before.compatMode !== after.compatMode) out.push({ t: 'set', key: 'compatMode', value: after.compatMode ?? null });
  for (const key of ['columns', 'sectionStart', 'noHeader', 'noFooter', 'trackRevisions'] as const) {
    if (before[key] !== after[key] && JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) out.push({ t: 'set', key, value: after[key] ?? null });
  }
  if (before.styles !== after.styles) out.push({ t: 'set', key: 'styles', value: after.styles ?? null });
  diffMap(before.numbering?.abstracts, after.numbering?.abstracts, (id, value) => out.push({ t: 'num', kind: 'abstract', id, value }));
  diffMap(before.numbering?.lists, after.numbering?.lists, (id, value) => out.push({ t: 'num', kind: 'list', id, value }));
  if (before.media !== after.media) {
    for (const [key, value] of Object.entries(after.media ?? {})) if (before.media?.[key] !== value) out.push({ t: 'media', key, value });
  }
  diffTables(before.tables, after.tables, undefined, out);
  diffFlow(before.paragraphs, after.paragraphs, undefined, out);
  if (before.notes !== after.notes) {
    const had = new Map((before.notes ?? []).map((note) => [note.id, note]));
    for (const note of after.notes ?? []) {
      const was = had.get(note.id);
      had.delete(note.id);
      if (was !== note && !(was && sameProps(was, note))) out.push({ t: 'note', id: note.id, value: note });
    }
    for (const id of had.keys()) out.push({ t: 'note', id, value: null });
  }
  if (!before.firstPage !== !after.firstPage) out.push({ t: 'set', key: 'titlePage', value: !!after.firstPage });
  for (const part of storyPartsOf(before, after)) {
    const was = storyOf(before, part);
    const now = storyOf(after, part);
    if (was === now) continue;
    if (!was || !now) {
      // Without a first page of its own, its header and footer went with it.
      if (now || part === 'header' || part === 'footer' || part.startsWith('footnote:') || part.startsWith('textbox:') || after.firstPage) out.push({ t: 'story', part, value: now ?? null });
      continue;
    }
    diffTables(was.tables, now.tables, part, out);
    diffFlow(was.paragraphs, now.paragraphs, part, out);
  }
  return out;
}

// --- Making changes -----------------------------------------------------------------

const EMPTY_TABLE: Table = { columns: [], fixed: true, align: 'left', indent: 0, padTop: 0, padRight: 0, padBottom: 0, padLeft: 0, rows: [] };

function joinRuns(runs: Run[], fallback: RunProps): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = out[out.length - 1];
    if (prev && sameProps(prev.props, run.props)) out[out.length - 1] = { text: prev.text + run.text, props: prev.props };
    else out.push(run);
  }
  return out.length ? out : [{ text: '', props: fallback }];
}

/**
 * The paragraphs of the tables as their shapes say: each table in one piece,
 * its cells in order, none without a paragraph and no paragraph in a cell
 * that is not there. Changes made at once to the shape of a table and to what
 * is in it can leave them otherwise; everybody mends them the same way.
 * `strict` are the tables whose cells must all have a paragraph.
 */
function mend(paragraphs: Paragraph[], tables: Table[] | undefined, strict: Set<number>): Paragraph[] {
  let sound = paragraphs.length > 0;
  const seen = new Set<number>();
  /** Checks the table whose paragraphs start at `i`, those of the tables in its cells with them; returns where they end. */
  const check = (index: number, i: number): number => {
    const table = tables?.[index];
    if (!table || seen.has(index)) {
      sound = false;
      return i;
    }
    seen.add(index);
    for (const row of table.rows) {
      for (const cell of row.cells) {
        const ref = { table: index, row: row.id, cell: cell.id };
        const from = i;
        while (sound && i < paragraphs.length && inCell(tables, paragraphs[i].cell, ref)) {
          const own = paragraphs[i].cell!;
          // A table in the cell: one piece of its own, among the cell's paragraphs.
          if (own.table !== index) {
            let inner = own;
            while (tables?.[inner.table]?.parent && tables[inner.table].parent!.table !== index) inner = tables[inner.table].parent!;
            i = check(inner.table, i);
          } else i++;
        }
        if (i === from && strict.has(index)) sound = false;
      }
    }
    if (paragraphs[i] && cellOfTable(tables, paragraphs[i].cell, index)) sound = false;
    return i;
  };
  for (let i = 0; i < paragraphs.length && sound; ) {
    const ref = paragraphs[i].cell;
    if (!ref) {
      i++;
      continue;
    }
    // A table inside another starts where the outermost one does.
    let top = ref;
    while (tables?.[top.table]?.parent) top = tables[top.table].parent!;
    i = check(top.table, i);
  }
  if (sound) return paragraphs;

  const cells = new Map<string, Paragraph[]>();
  const ids = new Set<string>();
  for (const p of paragraphs) {
    if (p.id) ids.add(p.id);
    if (!p.cell) continue;
    const key = `${p.cell.table}:${p.cell.row}:${p.cell.cell}`;
    const list = cells.get(key);
    if (list) list.push(p);
    else cells.set(key, [p]);
  }
  const out: Paragraph[] = [];
  const done = new Set<number>();
  /** A table, each cell with its paragraphs and, before the last of them, the tables inside it. */
  const emit = (index: number, like: Paragraph) => {
    const table = tables![index];
    done.add(index);
    for (const row of table.rows) {
      for (const cell of row.cells) {
        const list = cells.get(`${index}:${row.id}:${cell.id}`) ?? [];
        const inner = (tables ?? []).map((t, k) => (t.parent && t.parent.table === index && t.parent.row === row.id && t.parent.cell === cell.id ? k : -1)).filter((k) => k >= 0 && !done.has(k));
        out.push(...list.slice(0, Math.max(0, list.length - 1)));
        for (const k of inner) emit(k, like);
        if (list.length) {
          out.push(list[list.length - 1]);
        } else if (strict.has(index) || inner.length) {
          let id = `t${index}.${row.id}.${cell.id}`;
          while (ids.has(id)) id += '~';
          ids.add(id);
          out.push({ id, props: {}, runs: [{ text: '', props: like.runs[0]?.props ?? {} }], cell: { table: index, row: row.id, cell: cell.id } });
        }
      }
    }
  };
  for (const p of paragraphs) {
    if (!p.cell) {
      out.push(p);
      continue;
    }
    let index = p.cell.table;
    if (!tables?.[index]) {
      const { cell: _, ...loose } = p;
      out.push(loose);
      continue;
    }
    // A table inside another goes out with the outermost one.
    while (tables[index].parent && tables[tables[index].parent!.table]) index = tables[index].parent!.table;
    if (done.has(index)) continue;
    emit(index, p);
  }
  if (!out.length) out.push({ id: 'p~', props: {}, runs: [{ text: '', props: {} }] });
  return out;
}

/** The paragraphs and the tables of one part while changes are being made to them. */
class Flow {
  paragraphs: Paragraph[];
  tables: Table[] | undefined;
  private places: Map<string, number> | undefined;
  private own = false;
  private ownTables = false;
  /** Whether paragraphs came or went, and the tables whose cells may have been left without one. */
  shaped = false;
  strict = new Set<number>();

  constructor(paragraphs: Paragraph[], tables: Table[] | undefined) {
    this.paragraphs = paragraphs;
    this.tables = tables;
  }

  get changed(): boolean {
    return this.own || this.ownTables;
  }

  index(id: string): number {
    if (!this.places) {
      this.places = new Map();
      this.paragraphs.forEach((p, i) => p.id !== undefined && this.places!.set(p.id, i));
    }
    return this.places.get(id) ?? -1;
  }

  private write(): Paragraph[] {
    if (!this.own) {
      this.paragraphs = this.paragraphs.slice();
      this.own = true;
    }
    return this.paragraphs;
  }

  set(index: number, p: Paragraph): void {
    this.write()[index] = p;
  }

  splice(index: number, remove: number, ...add: Paragraph[]): void {
    this.write().splice(index, remove, ...add);
    this.places = undefined;
    this.shaped = true;
  }

  touch(p: Paragraph | undefined): void {
    if (p?.cell) this.strict.add(p.cell.table);
  }

  setTable(index: number, table: Table): void {
    if (!this.ownTables) {
      this.tables = (this.tables ?? []).slice();
      this.ownTables = true;
    }
    while (this.tables!.length < index) this.tables!.push(EMPTY_TABLE);
    this.tables![index] = table;
    this.shaped = true;
    this.strict.add(index);
  }

  finish(): void {
    if (!this.shaped) return;
    const mended = mend(this.paragraphs, this.tables, this.strict);
    if (mended !== this.paragraphs) {
      this.paragraphs = mended;
      this.own = true;
    }
  }
}

function applyToFlow(flow: Flow, op: Exclude<Op, SetStory | SetField | SetNote | SetMedia | SetList>): void {
  switch (op.t) {
    case 'splice': {
      const i = flow.index(op.id);
      if (i < 0) return;
      const p = flow.paragraphs[i];
      const length = paragraphLength(p);
      const at = Math.max(0, Math.min(op.at, length));
      const until = Math.max(at, Math.min(at + op.remove, length));
      const runs = joinRuns([...sliceRuns(p.runs, 0, at), ...op.insert, ...sliceRuns(p.runs, until, length)], op.empty ?? p.runs[0]?.props ?? {});
      flow.set(i, { ...p, runs: runs.length === 1 && !runs[0].text && op.empty ? [{ text: '', props: op.empty }] : runs });
      return;
    }
    case 'para': {
      const i = flow.index(op.id);
      if (i < 0) return;
      const p = flow.paragraphs[i];
      const next: Paragraph = { ...p };
      if (op.props) {
        const props = { ...p.props } as Record<string, unknown>;
        for (const [key, value] of Object.entries(op.props)) {
          if (value === null || value === undefined) delete props[key];
          else props[key] = value;
        }
        next.props = props;
      }
      if ('cell' in op) {
        flow.touch(p);
        if (op.cell) next.cell = op.cell;
        else delete next.cell;
        flow.touch(next);
        flow.shaped = true;
      }
      if ('origin' in op) {
        if (op.origin === null || op.origin === undefined) delete next.origin;
        else next.origin = op.origin;
      }
      if ('section' in op) {
        if (op.section) next.section = op.section;
        else delete next.section;
      }
      flow.set(i, next);
      return;
    }
    case 'insert': {
      const paras = op.paras.filter((p) => p.id !== undefined && flow.index(p.id) < 0);
      if (!paras.length) return;
      const after = op.after === null ? -1 : flow.index(op.after);
      // The paragraph they were to follow is gone, and nothing says where it was: they close the text.
      flow.splice(op.after !== null && after < 0 ? flow.paragraphs.length : after + 1, 0, ...paras);
      for (const p of paras) flow.touch(p);
      return;
    }
    case 'delete': {
      const i = flow.index(op.id);
      if (i < 0) return;
      const p = flow.paragraphs[i];
      flow.touch(p);
      // There is always a paragraph: the last one is emptied instead.
      if (flow.paragraphs.length === 1) flow.splice(0, 1, { id: `${op.id}~`, props: p.props, runs: [{ text: '', props: p.runs[0]?.props ?? {} }] });
      else flow.splice(i, 1);
      return;
    }
    case 'split': {
      const i = flow.index(op.id);
      if (i < 0 || flow.index(op.newId) >= 0) return;
      const p = flow.paragraphs[i];
      const length = paragraphLength(p);
      const at = Math.max(0, Math.min(op.at, length));
      // The mark that ends a section is at the end of the paragraph: it goes with the second half.
      const { section: _, ...head } = p;
      flow.splice(i, 1, { ...head, runs: someRuns(sliceRuns(p.runs, 0, at), p.runs) }, { ...p, id: op.newId, ...(op.props ? { props: op.props as unknown as Paragraph['props'] } : {}), runs: someRuns(sliceRuns(p.runs, at, length), p.runs) });
      return;
    }
    case 'join': {
      const i = flow.index(op.id);
      const j = flow.index(op.next);
      if (i < 0 || j < 0 || i === j) return;
      const p = flow.paragraphs[i];
      const next = flow.paragraphs[j];
      flow.touch(next);
      // What is left ends with the mark of the second, and with the section it ended.
      const { section: _, ...head } = p;
      flow.set(i, defined<Paragraph>({ ...head, runs: joinRuns([...p.runs, ...next.runs], p.runs[0]?.props ?? {}), section: next.section }));
      flow.splice(j, 1);
      return;
    }
    case 'table':
      flow.setTable(op.index, op.value);
      return;
  }
}

/**
 * The document with the changes made, in order. A change about something
 * that is no longer there does nothing, so that any changes at all can be
 * made to any document and everybody ends up with the same one.
 */
export function apply(doc: Doc, ops: Op[]): Doc {
  let out = doc;
  let open: { part: StoryPart | undefined; flow: Flow } | undefined;
  const close = () => {
    if (!open) return;
    const { part, flow } = open;
    open = undefined;
    flow.finish();
    if (!flow.changed) return;
    if (!part) out = { ...out, paragraphs: flow.paragraphs, ...(flow.tables ? { tables: flow.tables } : {}) };
    else out = withStory(out, part, flow.tables ? { paragraphs: flow.paragraphs, tables: flow.tables } : { paragraphs: flow.paragraphs });
  };
  for (const op of ops) {
    switch (op.t) {
      case 'story':
        close();
        // A first page gets its own header only while it has headers of its own at all.
        if ((op.part === 'firstHeader' || op.part === 'firstFooter') && !out.firstPage) break;
        out = withStory(out, op.part, op.value ?? undefined);
        break;
      case 'set':
        close();
        if (op.key === 'titlePage') {
          if (op.value && !out.firstPage) out = { ...out, firstPage: {} };
          else if (!op.value && out.firstPage) {
            const { firstPage: _, ...rest } = out;
            out = rest;
          }
        } else if (op.value === null || op.value === undefined) {
          const { [op.key]: _, ...rest } = out;
          out = rest as Doc;
        } else {
          out = { ...out, [op.key]: op.value };
        }
        break;
      case 'note': {
        close();
        const notes = (out.notes ?? []).filter((note) => note.id !== op.id);
        const at = (out.notes ?? []).findIndex((note) => note.id === op.id);
        if (op.value) notes.splice(at < 0 ? notes.length : at, 0, op.value);
        out = { ...out, notes };
        break;
      }
      case 'media':
        close();
        out = { ...out, media: { ...out.media, [op.key]: op.value } };
        break;
      case 'num': {
        close();
        const numbering = { abstracts: new Map(out.numbering?.abstracts), lists: new Map(out.numbering?.lists) };
        const map = (op.kind === 'abstract' ? numbering.abstracts : numbering.lists) as Map<number, unknown>;
        if (op.value === null || op.value === undefined) map.delete(op.id);
        else map.set(op.id, op.value);
        out = { ...out, numbering };
        break;
      }
      default: {
        if (!open || open.part !== op.part) {
          close();
          const story = op.part ? storyOf(out, op.part) : out;
          if (!story) break;
          open = { part: op.part, flow: new Flow(story.paragraphs, story.tables) };
        }
        applyToFlow(open.flow, op);
      }
    }
  }
  close();
  return out;
}

// --- When someone else's change got there first -------------------------------------

type TextOp = Splice | SetParagraph | InsertParagraphs | DeleteParagraph | Split | Join;
/** Whether a change is to the paragraphs of a part, and not to its tables or to the document as a whole. */
const inText = (op: Op): op is TextOp => op.t === 'splice' || op.t === 'para' || op.t === 'insert' || op.t === 'delete' || op.t === 'split' || op.t === 'join';

const insertLength = (op: Splice) => op.insert.reduce((n, run) => n + run.text.length, 0);

/** Where a place in a paragraph is once text was taken out and put in at `at`; `after` puts it past what was put in right there. */
function mapOffset(offset: number, at: number, remove: number, added: number, after: boolean): number {
  if (offset < at || (offset === at && !after)) return offset;
  if (offset >= at + remove) return offset - remove + added;
  return at + (after ? added : 0);
}

/**
 * What the change `a` becomes when `b`, made to the same document, is made
 * first. `later` says `a` is the one of the two everybody makes second: where
 * both put something at the same place, it goes after.
 */
function rebase(a: Op, b: Op, later: boolean): Op[] {
  if (!inText(a) || !inText(b) || a.part !== b.part) return [a];
  if (b.t === 'delete' && b.para && touches(a, b.id)) return rescued(a, b);
  if (a.t === 'delete' && a.para && touches(b, a.id)) return trimmed(a, b);
  switch (b.t) {
    case 'splice': {
      const added = insertLength(b);
      if (a.t === 'splice' && a.id === b.id) {
        // Formatting moves nothing: what it gave to the letters the other took out goes with them, and where both gave some, the one made second.
        if (a.format && (!b.format || !later)) return outside(a, b);
        if (b.format) return [a];
        const from = a.at;
        const to = a.at + a.remove;
        const bTo = b.at + b.remove;
        // What it takes out is around what the other put in: the two ends go, what is between stays.
        if (added > 0 && from < b.at && to > bTo) {
          return [
            { t: 'splice', ...(a.part ? { part: a.part } : {}), id: a.id, at: b.at + added, remove: to - bTo, insert: [] },
            { ...a, remove: b.at - from },
          ];
        }
        const start = mapOffset(from, b.at, b.remove, added, a.remove > 0 || later);
        const stop = Math.max(start, mapOffset(to, b.at, b.remove, added, false));
        return [{ ...a, at: start, remove: stop - start }];
      }
      // The text put in right where it is cut stays in the first half, as `split` below says; put in place of text that starts there, in the second.
      if (a.t === 'split' && a.id === b.id) return b.format ? [a] : [{ ...a, at: mapOffset(a.at, b.at, b.remove, added, a.at !== b.at || b.remove === 0) }];
      if (a.t === 'join' && a.id === b.id) return [{ ...a, at: Math.max(0, a.at - b.remove + added) }];
      return [a];
    }
    case 'split': {
      if (a.t === 'splice' && a.id === b.id) {
        const to = a.at + a.remove;
        if (a.at > b.at || (a.at === b.at && a.remove > 0)) return [{ ...a, id: b.newId, at: a.at - b.at }];
        // Formatting across the cut: each half its letters.
        if (a.format && to > b.at) {
          return [
            { ...a, id: b.newId, at: 0, remove: to - b.at, insert: sliceRuns(a.insert, b.at - a.at, a.remove) },
            { ...a, remove: b.at - a.at, insert: sliceRuns(a.insert, 0, b.at - a.at) },
          ];
        }
        if (to > b.at) {
          return [
            { t: 'splice', ...(a.part ? { part: a.part } : {}), id: b.newId, at: 0, remove: to - b.at, insert: [] },
            { ...a, remove: b.at - a.at },
          ];
        }
        return [a];
      }
      if (a.t === 'split' && a.id === b.id) return a.at > b.at || (a.at === b.at && later) ? [{ ...a, id: b.newId, at: a.at - b.at }] : [a];
      if (a.t === 'join' && a.id === b.id) return [{ ...a, id: b.newId, at: Math.max(0, a.at - b.at) }];
      if (a.t === 'insert' && a.after === b.id) return [{ ...a, after: b.newId }];
      if (a.t === 'delete' && a.prev === b.id) return [{ ...a, prev: b.newId }];
      // Formatting given to the whole paragraph is for both halves of it; the section it ends, for the second.
      if (a.t === 'para' && a.id === b.id && (a.props || 'section' in a)) {
        const { section, ...first } = a;
        const second: SetParagraph = { t: 'para', ...(a.part ? { part: a.part } : {}), id: b.newId, ...(a.props ? { props: a.props } : {}), ...('section' in a ? { section } : {}) };
        return [...(first.props || 'cell' in first || 'origin' in first ? [first] : []), second];
      }
      return [a];
    }
    case 'join': {
      if (a.t === 'splice' && a.id === b.next) return [{ ...a, id: b.id, at: a.at + b.at }];
      if (a.t === 'split' && a.id === b.next) return [{ ...a, id: b.id, at: a.at + b.at }];
      if (a.t === 'join') {
        if (a.id === b.id && a.next === b.next) return [];
        if (a.id === b.next) return [{ ...a, id: b.id, at: a.at + b.at }];
        // The same paragraph brought up to two: one of them took out the paragraph
        // between, which came back empty for the other to bring it up to. The empty
        // one goes, and what was brought is in the other.
        if (a.next === b.next) {
          if (b.at === 0 && (a.at !== 0 || later)) return [{ ...a, next: b.id }];
          if (a.at === 0) return [{ t: 'delete', ...(a.part ? { part: a.part } : {}), id: a.id, prev: b.id }];
        }
        return [a];
      }
      if (a.t === 'insert' && a.after === b.next) return [{ ...a, after: b.id }];
      if (a.t === 'delete') return a.id === b.next ? [] : a.prev === b.next ? [{ ...a, prev: b.id }] : [a];
      // The section the second ended is the one what is left ends.
      if (a.t === 'para' && a.id === b.next) return 'section' in a ? [{ t: 'para', ...(a.part ? { part: a.part } : {}), id: b.id, section: a.section }] : [];
      return [a];
    }
    case 'para': {
      // Formatting given to a paragraph someone cut is for both halves.
      if (a.t === 'split' && a.id === b.id && a.props && b.props) {
        const props = { ...a.props };
        for (const [key, value] of Object.entries(b.props)) {
          if (value === null || value === undefined) delete props[key];
          else props[key] = value;
        }
        return [{ ...a, props }];
      }
      return [a];
    }
    case 'insert': {
      // Paragraphs both put after the same one: those made second, after the others.
      if (a.t === 'insert' && later && a.after === b.after && b.paras.length) return [{ ...a, after: b.paras[b.paras.length - 1].id! }];
      // Paragraphs put in right before one taken out: what was to go where it was goes after them.
      if (a.t === 'delete' && a.prev === b.after && b.paras.length) return [{ ...a, prev: b.paras[b.paras.length - 1].id! }];
      return [a];
    }
    case 'delete': {
      if (a.t === 'insert' && a.after === b.id) return [{ ...a, after: b.prev }];
      if (a.t === 'delete' && a.prev === b.id) return [{ ...a, prev: b.prev }];
      return [a];
    }
    default:
      return [a];
  }
}

// --- A paragraph one deleted while the other was writing in it ---------------------
// As in a document of characters: the paragraph goes, with the text it had, and
// what the other put in it meanwhile stays where the paragraph was. Whoever was
// writing goes on in the same paragraph, which keeps its id. It takes the
// deletion knowing the paragraph it took out (`para`); one that does not, from
// an editor of before, takes it all as it did.

/** Whether a change is about the paragraph `id`. */
const touches = (op: TextOp, id: string): boolean => (op.t === 'join' ? op.id === id || op.next === id : op.t !== 'insert' && op.id === id);

/**
 * A change to the text of a paragraph as what it really put in: a change
 * comes as one stretch taken out and one put in, which can have in it, as it
 * was, text that was there (typing at both ends of a word, giving it
 * formatting). Gives the stretches that are new, one after the other.
 */
function narrow(op: Splice, para: Paragraph): Splice[] {
  const was = paragraphText(para).slice(op.at, op.at + op.remove);
  const put = op.insert.map((run) => run.text).join('');
  const piece = (at: number, remove: number, from: number, to: number): Splice => ({ ...op, at, remove, insert: sliceRuns(op.insert, from, to) });
  if (put === was) return [];
  const inside = was ? put.indexOf(was) : -1;
  // What was there, with something put before it and after it.
  if (inside >= 0) {
    const out: Splice[] = [];
    if (inside + was.length < put.length) out.push(piece(op.at + op.remove, 0, inside + was.length, put.length));
    if (inside > 0) out.push(piece(op.at, 0, 0, inside));
    return out;
  }
  let head = 0;
  while (head < was.length && head < put.length && was[head] === put[head]) head++;
  let tail = 0;
  while (tail < was.length - head && tail < put.length - head && was[was.length - 1 - tail] === put[put.length - 1 - tail]) tail++;
  return [piece(op.at + head, op.remove - head - tail, head, put.length - tail)];
}

/** Whether a change to a paragraph puts text in it that it did not have: not formatting given to what is there, which comes as the same text again. */
const brings = (op: Splice, para: Paragraph): boolean => narrow(op, para).some((piece) => piece.insert.some((run) => run.text));

/** The paragraph a change leaves of `para`, made the way everybody makes it: two, when it cuts it. */
function follow(para: Paragraph, op: TextOp): Paragraph[] {
  const { cell, ...plain } = para;
  const { part: _, ...flat } = op;
  const out = apply(createDoc([plain]), [flat as Op]).paragraphs;
  const placed = op.t === 'para' && 'cell' in op ? (op.cell ?? undefined) : cell;
  return placed ? out.map((p) => ({ ...p, cell: placed })) : out;
}

/** Taking all the text out of the paragraph a deletion is about, and leaving it there. */
const emptied = (d: DeleteParagraph): Splice => ({ t: 'splice', ...(d.part ? { part: d.part } : {}), id: d.id, at: 0, remove: paragraphLength(d.para!), insert: [] });

/** What `a` becomes after the deletion `d` of the paragraph it is about: what brings text to it puts the paragraph back, empty, to bring it to. */
function rescued(a: TextOp, d: DeleteParagraph): Op[] {
  const back = (made: Op[]): Op[] => [
    { t: 'insert', ...(d.part ? { part: d.part } : {}), after: d.prev, paras: [{ ...d.para!, runs: [{ text: '', props: d.para!.runs[0]?.props ?? {} }] }] },
    ...transform(made, [emptied(d)]).second,
  ];
  if (a.t === 'splice') return brings(a, d.para!) ? back(narrow(a, d.para!)) : [];
  // Another paragraph brought up to the end of it: what it had goes, and what was brought stays.
  if (a.t === 'join' && a.id === d.id) return back([a]);
  // Formatting it, cutting it, or bringing it up to the one before: the deletion takes care of it.
  return [];
}

/** What the deletion `d` becomes after `b`, which changed the paragraph it takes out: it takes out what the paragraph had, and leaves what was brought. */
function trimmed(d: DeleteParagraph, b: TextOp): Op[] {
  const flow = d.part ? { part: d.part } : {};
  switch (b.t) {
    case 'splice':
      return brings(b, d.para!) ? transform([emptied(d)], narrow(b, d.para!)).second : [{ ...d, para: follow(d.para!, b)[0] }];
    case 'para':
      return [{ ...d, para: follow(d.para!, b)[0] }];
    case 'split': {
      // Both halves were what it had.
      const [head, tail] = follow(d.para!, b);
      return [{ ...d, para: head }, { t: 'delete', ...flow, id: b.newId, prev: d.prev, para: tail }];
    }
    case 'join':
      // Brought up to the end of the one before, what it had is there now; brought another up to its own end, it keeps that.
      return b.next === d.id ? [{ t: 'splice', ...flow, id: b.id, at: b.at, remove: paragraphLength(d.para!), insert: [] }] : [emptied(d)];
    default:
      return [];
  }
}

/** Formatting `a` made after the change `b` to the same paragraph: on the letters `b` left, and split around what `b` put in. */
function outside(a: Splice, b: Splice): Splice[] {
  const from = a.at;
  const to = a.at + a.remove;
  const bTo = b.at + b.remove;
  const out: Splice[] = [];
  const piece = (start: number, end: number, at: number) => {
    if (end > start) out.push({ ...a, at, remove: end - start, insert: sliceRuns(a.insert, start - from, end - from) });
  };
  piece(Math.max(from, bTo), to, Math.max(from, bTo) - b.remove + insertLength(b));
  piece(from, Math.min(to, b.at), from);
  return out;
}

function pair(as: Op[], bs: Op[]): [Op[], Op[]] {
  if (!as.length || !bs.length) return [as, bs];
  if (as.length === 1 && bs.length === 1) return [rebase(as[0], bs[0], true), rebase(bs[0], as[0], false)];
  if (as.length > 1) {
    const [head, b1] = pair([as[0]], bs);
    const [tail, b2] = pair(as.slice(1), b1);
    return [[...head, ...tail], b2];
  }
  const [a1, head] = pair(as, [bs[0]]);
  const [a2, tail] = pair(a1, bs.slice(1));
  return [a2, [...head, ...tail]];
}

/** A table that changed its place in the list of tables of a part. */
export interface Renamed {
  part?: StoryPart;
  from: number;
  to: number;
}

const movedCell = (cell: CellRef, r: Renamed): CellRef => (cell.table === r.from ? { ...cell, table: r.to } : cell);

/** A change with a table known by another place in the list. */
export function renameTable(op: Op, r: Renamed): Op {
  if (op.t === 'story' || op.t === 'set' || op.t === 'note' || op.t === 'media' || op.t === 'num' || op.part !== r.part) return op;
  if (op.t === 'table') return op.index === r.from ? { ...op, index: r.to } : op;
  if (op.t === 'para') return op.cell && op.cell.table === r.from ? { ...op, cell: movedCell(op.cell, r) } : op;
  if (op.t === 'insert') return op.paras.some((p) => p.cell?.table === r.from) ? { ...op, paras: op.paras.map((p) => (p.cell ? { ...p, cell: movedCell(p.cell, r) } : p)) } : op;
  return op;
}

/**
 * Two lists of changes made to the same document, each without knowing of
 * the other, and the order everybody makes them in: `first`, then `second`.
 * Gives `second` as it is to be made after `first`, and `first` as whoever
 * already made `second` is to make it. Tables both made new are told apart:
 * the ones of `second` move on, and `renamed` says where to.
 */
export function transform(second: Op[], first: Op[]): { second: Op[]; first: Op[]; renamed: Renamed[] } {
  const renamed: Renamed[] = [];
  const out: Op[] = [];
  let others = first;
  for (let a of second) {
    for (const r of renamed) a = renameTable(a, r);
    let mine = [a];
    const next: Op[] = [];
    for (const b of others) {
      const one = mine.length === 1 ? mine[0] : undefined;
      if (one?.t === 'table' && one.fresh && b.t === 'table' && b.fresh && one.part === b.part && one.index === b.index) {
        const r: Renamed = { ...(one.part ? { part: one.part } : {}), from: one.index, to: one.index + 1 };
        renamed.push(r);
        mine = [renameTable(one, r)];
      }
      const [a2, b2] = pair(mine, [b]);
      mine = a2;
      next.push(...b2);
    }
    out.push(...mine);
    others = next;
  }
  return { second: out, first: others, renamed };
}

// --- Carets -------------------------------------------------------------------------

/** A place in the text that stays where it is as the text around it changes. */
export interface Anchor {
  part?: StoryPart;
  id: string;
  offset: number;
}

/** Where a place is once a change was made. */
export function mapAnchor(anchor: Anchor, op: Op): Anchor {
  if (op.t === 'story' || op.t === 'set' || op.t === 'note' || op.t === 'media' || op.t === 'num' || op.part !== anchor.part) return anchor;
  switch (op.t) {
    case 'splice':
      return op.id === anchor.id && !op.format ? { ...anchor, offset: mapOffset(anchor.offset, op.at, op.remove, insertLength(op), false) } : anchor;
    case 'split':
      return op.id === anchor.id && anchor.offset > op.at ? { ...anchor, id: op.newId, offset: anchor.offset - op.at } : anchor;
    case 'join':
      return op.next === anchor.id ? { ...anchor, id: op.id, offset: anchor.offset + op.at } : anchor;
    case 'delete':
      return op.id === anchor.id && op.prev !== null ? { ...anchor, id: op.prev, offset: Number.MAX_SAFE_INTEGER } : anchor;
    default:
      return anchor;
  }
}

// --- Whether two hold the same document -------------------------------------------
// The rules above are tested, not proven: two people can, rarely, end with
// documents that differ. The server says now and then what its document is
// like, in a few letters; an editor whose own is not like it loads the room
// again. Only what reads differently counts: how the text is cut into runs,
// and properties left at nothing, do not.

/** A few letters that are the same for two documents that read the same: their text, paragraph by paragraph, with its formatting and the shape of its tables. */
export function digest(doc: Doc): string {
  const plain = (value: object | undefined) =>
    value
      ? JSON.stringify(
          Object.entries(value)
            .filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false)
            .sort(([x], [y]) => (x < y ? -1 : 1)),
        )
      : '';
  const parts: string[] = [];
  const flow = (paragraphs: Paragraph[]) => {
    for (const p of paragraphs) {
      let runs = '';
      let last = '';
      for (const run of p.runs) {
        if (!run.text) continue;
        const look = plain(run.props);
        runs += look === last ? run.text : `\u0001${look}\u0002${run.text}`;
        last = look;
      }
      parts.push(`${p.id}\u0003${plain(p.props)}\u0003${p.cell ? `${p.cell.table}.${p.cell.row}.${p.cell.cell}` : ''}\u0003${p.section ? JSON.stringify(p.section) : ''}\u0003${runs}`);
    }
  };
  flow(doc.paragraphs);
  parts.push(JSON.stringify(doc.tables ?? []));
  for (const part of storyPartsOf(doc)) {
    parts.push(`\u0004${part}`);
    flow(storyOf(doc, part)?.paragraphs ?? []);
  }
  for (const note of doc.notes ?? []) parts.push(`\u0005${note.id}`);
  // FNV-1a, twice over, from two starts: 16 hex letters.
  const text = parts.join('\n');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

// --- Over the wire ------------------------------------------------------------------
// Changes carry pictures (bytes) and list definitions (maps), which JSON has no way to write.

const toBase64 = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
};

const fromBase64 = (text: string): Uint8Array => {
  const raw = atob(text);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export function encode(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item instanceof Uint8Array) return { $bytes: toBase64(item) };
    if (item instanceof Map) return { $map: [...item] };
    return item;
  });
}

export function decode<T>(text: string): T {
  return JSON.parse(text, (_key, item: unknown) => {
    if (item && typeof item === 'object') {
      const tagged = item as { $bytes?: string; $map?: [unknown, unknown][] };
      if (typeof tagged.$bytes === 'string') return fromBase64(tagged.$bytes);
      if (Array.isArray(tagged.$map)) return new Map(tagged.$map);
    }
    return item;
  }) as T;
}

export { toBase64, fromBase64 };
