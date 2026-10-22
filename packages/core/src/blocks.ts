// The blocks of a template: what is between {{#name}} and {{/name}} is written
// once for each item of a list, or once when the value is there and not at
// all when it is not; what is between {{^name}} and {{/name}}, only when it is
// not. Where the marks are says what is repeated: two in one paragraph, the
// text between them; each in a cell of the same row of a table, the row; each
// a paragraph of its own, the paragraphs between them, tables and all.
// Inside, {{items.price}} is the price of the item being written.

import { type Doc, type Paragraph, type Run, type Table, sameCell } from './model';
import { sliceRuns } from './ops';

/** The values a template is filled with: text and numbers, yes or no, lists, and objects whose fields go by dotted names. */
export type TemplateValue = string | number | boolean | null | undefined | TemplateData | TemplateValue[];
export interface TemplateData {
  [name: string]: TemplateValue;
}

export interface Block {
  name: string;
  /** Written {{^name}}: kept when the value is not there. */
  inverted: boolean;
  /** What it repeats or keeps: the text between its marks, the row of a table they are in, or the paragraphs between them. */
  kind: 'text' | 'row' | 'paragraphs';
}

const MARK = /\{\{\s*([#^/])\s*([\p{L}\p{N}_][\p{L}\p{N}_.\- ]*?)\s*\}\}/gu;
/** A paragraph that holds a mark and nothing else. */
const ALONE = new RegExp(`^${MARK.source}$`, 'u');

interface Mark {
  sign: '#' | '^' | '/';
  name: string;
  para: number;
  /** Where the mark starts and ends in its paragraph, past text taken out while changes were tracked. */
  from: number;
  to: number;
}

/** The marks of blocks in the paragraphs, in order. */
function marksOf(paragraphs: Paragraph[]): Mark[] {
  const out: Mark[] = [];
  paragraphs.forEach((p, para) => {
    let text = '';
    const at: number[] = [];
    let offset = 0;
    for (const run of p.runs) {
      if (!run.props.object && run.props.revision !== 'delete') {
        for (let i = 0; i < run.text.length; i++) at.push(offset + i);
        text += run.text;
      }
      offset += run.text.length;
    }
    if (!text.includes('{{')) return;
    for (const match of text.matchAll(MARK)) {
      const end = match.index + match[0].length;
      out.push({ sign: match[1] as Mark['sign'], name: match[2], para, from: at[match.index], to: at[end - 1] + 1 });
    }
  });
  return out;
}

interface Pair {
  open: Mark;
  close: Mark;
  inner: Pair[];
}

/** Each opening mark with the closing one of its name, the blocks inside a block under it. A mark without its other half is left out. */
function pairsOf(marks: Mark[]): Pair[] {
  const top: Pair[] = [];
  const stack: { open: Mark; inner: Pair[] }[] = [];
  for (const mark of marks) {
    if (mark.sign !== '/') {
      stack.push({ open: mark, inner: [] });
      continue;
    }
    let k = stack.length - 1;
    while (k >= 0 && stack[k].open.name !== mark.name) k--;
    if (k < 0) continue;
    // Blocks opened inside this one and never closed are left out; what they held is this one's.
    const opened = stack.splice(k);
    const inner = opened.flatMap((one) => one.inner);
    const pair = { open: opened[0].open, close: mark, inner };
    (stack.length ? stack[stack.length - 1].inner : top).push(pair);
  }
  // What blocks never closed held goes to the block around them.
  for (let k = stack.length - 1; k >= 0; k--) (k > 0 ? stack[k - 1].inner : top).push(...stack[k].inner);
  return top;
}

/** The value of a dotted name: `client.name` is the field of `client`, or the value given as "client.name". */
export function valueAt(data: TemplateData, name: string): TemplateValue {
  if (Object.prototype.hasOwnProperty.call(data, name)) return data[name];
  for (let i = name.indexOf('.'); i > 0; i = name.indexOf('.', i + 1)) {
    const head = data[name.slice(0, i)];
    if (head && typeof head === 'object' && !Array.isArray(head)) {
      const found = valueAt(head, name.slice(i + 1));
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** The values as the variables name them: `{ client: { name: 'Ana' } }` is `{ 'client.name': 'Ana' }`. Lists are for blocks, and left out. */
export function flattenValues(data: TemplateData, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(data)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined || Array.isArray(value)) continue;
    if (typeof value === 'object') flattenValues(value, name, out);
    else out[name] = String(value);
  }
  return out;
}

/** Whether a value counts as there: not empty, not false, not 0, not a list without items. "false" and "0" as text count as not. */
export function isPresent(value: TemplateValue): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value === null || value === undefined || value === false || value === 0) return false;
  if (typeof value === 'string') return !['', 'false', '0'].includes(value.trim().toLowerCase());
  return true;
}

/** What a block is written for: each item of a list, the value once when it is there, nothing when it is not. */
function itemsOf(value: TemplateValue, inverted: boolean): TemplateValue[] {
  if (inverted) return isPresent(value) ? [] : [undefined];
  if (Array.isArray(value)) return value;
  return isPresent(value) ? [value] : [];
}

/** The values inside the block for one item: the item takes the name of the block. */
const scoped = (data: TemplateData, name: string, item: TemplateValue): TemplateData => (item === undefined ? data : { ...data, [name]: item });

const visibleText = (p: Paragraph) =>
  p.runs
    .filter((run) => !run.props.object && run.props.revision !== 'delete')
    .map((run) => run.text)
    .join('');

/** A copy written after the first leaves out what must be in a document once: notes, bookmarks, pictures and boxes that float. */
const once = (runs: Run[], first: boolean) => (first ? runs : runs.filter((run) => !run.props.anchor));

/** The paragraphs without what they hold of the marks given, from the last one back. */
function withoutMarks(paragraphs: Paragraph[], marks: Mark[], base: number): Paragraph[] {
  const out = paragraphs.slice();
  for (const mark of [...marks].sort((a, b) => b.para - a.para || b.from - a.from)) {
    const p = out[mark.para - base];
    const length = p.runs.reduce((n, run) => n + run.text.length, 0);
    const runs = [...sliceRuns(p.runs, 0, mark.from), ...sliceRuns(p.runs, mark.to, length)];
    out[mark.para - base] = { ...p, runs: runs.length ? runs : [{ text: '', props: p.runs[0]?.props ?? {} }] };
  }
  return out;
}

/** What a block is, by where its marks are; undefined for marks it cannot work with, which stay as they are. */
function kindOf(doc: Doc, pair: Pair): Block['kind'] | undefined {
  const { open, close } = pair;
  const a = doc.paragraphs[open.para];
  const b = doc.paragraphs[close.para];
  if (open.para === close.para) return 'text';
  if (a.cell && b.cell && a.cell.table === b.cell.table && a.cell.row === b.cell.row && rowRange(doc, open.para)) return 'row';
  if (!ALONE.test(visibleText(a).trim()) || !ALONE.test(visibleText(b).trim()) || !sameCell(a.cell, b.cell)) return undefined;
  // Section breaks are said by the paragraphs that end the sections: those are not repeated.
  if (doc.paragraphs.slice(open.para, close.para + 1).some((p) => p.section)) return undefined;
  return 'paragraphs';
}

/** The paragraphs of the row paragraph `para` is in, when they come one after another with no table inside. */
function rowRange(doc: Doc, para: number): { from: number; to: number } | undefined {
  const cell = doc.paragraphs[para].cell!;
  const inRow = (p: Paragraph | undefined) => p?.cell?.table === cell.table && p.cell.row === cell.row;
  let from = para;
  let to = para;
  while (inRow(doc.paragraphs[from - 1])) from--;
  while (inRow(doc.paragraphs[to + 1])) to++;
  // A table in a cell of the row puts its own paragraphs among the row's.
  const nested = (doc.tables ?? []).some((table) => table.parent?.table === cell.table && table.parent.row === cell.row);
  return nested ? undefined : { from, to };
}

/** The tables the paragraphs are in, copied to the end of `tables`, and the paragraphs pointing at the copies. */
function copyTables(paragraphs: Paragraph[], tables: Table[]): { paragraphs: Paragraph[]; tables: Table[] } {
  const used = [...new Set(paragraphs.flatMap((p) => (p.cell ? [p.cell.table] : [])))];
  if (!used.length) return { paragraphs, tables };
  const next = tables.slice();
  const moved = new Map<number, number>();
  for (const index of used) moved.set(index, next.push(tables[index]) - 1);
  for (const [was, now] of moved) {
    const parent = tables[was].parent;
    if (parent && moved.has(parent.table)) next[now] = { ...next[now], parent: { ...parent, table: moved.get(parent.table)! } };
  }
  return { paragraphs: paragraphs.map((p) => (p.cell && moved.has(p.cell.table) ? { ...p, cell: { ...p.cell, table: moved.get(p.cell.table)! } } : p)), tables: next };
}

/** A copy of paragraphs that is not the first: no longer the ones of the file, and without what must be there once. */
const copied = (paragraphs: Paragraph[], first: boolean): Paragraph[] =>
  first
    ? paragraphs
    : paragraphs.map((p) => {
        const { origin: _, id: __, ...rest } = p;
        const runs = once(p.runs, false);
        return { ...rest, runs: runs.length ? runs : [{ text: '', props: p.runs[0]?.props ?? {} }] };
      });

/**
 * The document with each block that has a value written out: repeated, kept
 * or taken away. `fill` fills the variables of what a block wrote, with the
 * values for that item. A block without a value stays as it is, marks and
 * all, so a template can be filled in steps.
 */
export function expandBlocks(doc: Doc, data: TemplateData, fill: (part: Doc, data: TemplateData) => Doc): Doc {
  if (!doc.paragraphs.some((p) => p.runs.some((run) => run.text.includes('{{')))) return doc;
  return expandPairs(doc, pairsOf(marksOf(doc.paragraphs)), data, fill);
}

function expandPairs(doc: Doc, unordered: Pair[], data: TemplateData, fill: (part: Doc, data: TemplateData) => Doc): Doc {
  const pairs = [...unordered].sort((a, b) => a.open.para - b.open.para || a.open.from - b.open.from);
  let next = doc;
  // From the last one back, so the ones before keep their place.
  for (let i = pairs.length - 1; i >= 0; i--) {
    const pair = pairs[i];
    const value = valueAt(data, pair.open.name);
    const kind = value === undefined ? undefined : kindOf(next, pair);
    next = kind ? expandPair(next, pair, kind, itemsOf(value, pair.open.sign === '^'), data, fill) : expandPairs(next, pair.inner, data, fill);
  }
  return next;
}

/** The part of the document a block writes for one item: its blocks written out and its variables filled. */
function written(doc: Doc, paragraphs: Paragraph[], tables: Table[] | undefined, data: TemplateData, fill: (part: Doc, data: TemplateData) => Doc): Doc {
  const part = expandBlocks({ ...doc, paragraphs, tables }, data, fill);
  return fill(part, data);
}

function expandPair(doc: Doc, { open, close }: Pair, kind: Block['kind'], items: TemplateValue[], data: TemplateData, fill: (part: Doc, data: TemplateData) => Doc): Doc {
  const name = open.name;
  if (kind === 'text') {
    const p = doc.paragraphs[open.para];
    const length = p.runs.reduce((n, run) => n + run.text.length, 0);
    const inside = sliceRuns(p.runs, open.to, close.from);
    let tables = doc.tables;
    const copies = items.flatMap((item, k) => {
      const part = written(doc, [{ ...p, runs: once(inside, k === 0).length ? once(inside, k === 0) : [{ text: '', props: p.runs[0].props }] }], tables, scoped(data, name, item), fill);
      tables = part.tables;
      return part.paragraphs[0].runs;
    });
    const runs = [...sliceRuns(p.runs, 0, open.from), ...copies, ...sliceRuns(p.runs, close.to, length)].filter((run) => run.text);
    const paragraphs = doc.paragraphs.slice();
    paragraphs[open.para] = { ...p, runs: runs.length ? runs : [{ text: '', props: p.runs[0].props }] };
    return { ...doc, paragraphs, tables };
  }

  if (kind === 'row') {
    const { from, to } = rowRange(doc, open.para)!;
    const ref = doc.paragraphs[open.para].cell!;
    const table = doc.tables![ref.table];
    const row = table.rows.find((one) => one.id === ref.row)!;
    const plain = withoutMarks(doc.paragraphs.slice(from, to + 1), [open, close], from);
    let nextId = Math.max(...table.rows.map((one) => one.id)) + 1;
    let tables = doc.tables!;
    const rows: (typeof row)[] = [];
    const paragraphs: Paragraph[] = [];
    items.forEach((item, k) => {
      const id = k === 0 ? row.id : nextId++;
      rows.push(k === 0 ? row : { ...row, id });
      const own = copied(plain, k === 0).map((p) => ({ ...p, cell: { ...p.cell!, row: id } }));
      const part = written(doc, own, tables, scoped(data, name, item), fill);
      tables = part.tables!;
      paragraphs.push(...part.paragraphs);
    });
    const now = tables[ref.table];
    const kept = now.rows.flatMap((one) => (one.id === row.id ? rows : [one]));
    const all = doc.paragraphs.slice();
    all.splice(from, to - from + 1, ...paragraphs);
    const nextTables = tables.slice();
    nextTables[ref.table] = { ...now, rows: kept };
    return dropEmptyTable({ ...doc, paragraphs: all, tables: nextTables }, ref.table);
  }

  // Paragraphs: the marks go, and what is between them is written for each item.
  const inside = doc.paragraphs.slice(open.para + 1, close.para);
  let tables = doc.tables ?? [];
  const paragraphs: Paragraph[] = [];
  items.forEach((item, k) => {
    const copy = k === 0 ? { paragraphs: inside, tables } : copyTables(copied(inside, false), tables);
    const part = written(doc, copy.paragraphs, copy.tables, scoped(data, name, item), fill);
    tables = part.tables ?? [];
    paragraphs.push(...part.paragraphs);
  });
  const container = doc.paragraphs[open.para];
  // A cell holds at least one paragraph, and so does the document.
  if (!paragraphs.length && (container.cell ? !doc.paragraphs.some((p, i) => (i < open.para || i > close.para) && sameCell(p.cell, container.cell)) : doc.paragraphs.length === close.para - open.para + 1)) {
    paragraphs.push({ props: container.props, runs: [{ text: '', props: container.runs[0].props }], ...(container.cell ? { cell: container.cell } : {}) });
  }
  const all = doc.paragraphs.slice();
  all.splice(open.para, close.para - open.para + 1, ...paragraphs);
  // The text of a document ends in a paragraph that is not in a table.
  if (all[all.length - 1].cell && !doc.paragraphs[doc.paragraphs.length - 1].cell) all.push({ props: {}, runs: [{ text: '', props: container.runs[0].props }] });
  return { ...doc, paragraphs: all, ...(tables.length || doc.tables ? { tables } : {}) };
}

/** The table left without rows taken away, the tables after it numbered one less. */
function dropEmptyTable(doc: Doc, index: number): Doc {
  if (doc.tables![index].rows.length) return doc;
  const tables = doc.tables!.filter((_, i) => i !== index).map((table) => (table.parent && table.parent.table > index ? { ...table, parent: { ...table.parent, table: table.parent.table - 1 } } : table));
  let paragraphs = doc.paragraphs.map((p) => (p.cell && p.cell.table > index ? { ...p, cell: { ...p.cell, table: p.cell.table - 1 } } : p));
  if (!paragraphs.length) paragraphs = [{ props: {}, runs: [{ text: '', props: {} }] }];
  return { ...doc, paragraphs, tables };
}

/** The blocks of the paragraphs, each once by its name and sign. */
export function findBlocks(doc: Doc): Block[] {
  const out: Block[] = [];
  const walk = (pairs: Pair[]) => {
    for (const pair of pairs) {
      const kind = kindOf(doc, pair);
      const inverted = pair.open.sign === '^';
      if (kind && !out.some((one) => one.name === pair.open.name && one.inverted === inverted)) out.push({ name: pair.open.name, inverted, kind });
      walk(pair.inner);
    }
  };
  walk(pairsOf(marksOf(doc.paragraphs)));
  return out;
}

/** Where the marks of blocks are, to be shown apart from the text. */
export function findBlockMarks(doc: Pick<Doc, 'paragraphs'>): { name: string; range: { from: { para: number; offset: number }; to: { para: number; offset: number } } }[] {
  return marksOf(doc.paragraphs).map((mark) => ({ name: mark.name, range: { from: { para: mark.para, offset: mark.from }, to: { para: mark.para, offset: mark.to } } }));
}
