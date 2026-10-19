// Operations on the shape of tables: creating one, and adding or removing rows
// and columns. Like every other operation they return a new document; the
// paragraphs of cells that are not touched stay the same objects.

import {
  type Border,
  type CellRef,
  type Doc,
  type Paragraph,
  type ParagraphProps,
  type Position,
  type RunProps,
  type Table,
  type TableCell,
  type TableRow,
  DEFAULT_BORDER,
  cellOfTable,
  createParagraph,
  inCell,
  defined,
  paragraphLength,
} from './model';
import { propsAt, splitParagraph } from './ops';

export interface CellLocation {
  tableIndex: number;
  table: Table;
  rowIndex: number;
  cellIndex: number;
  row: TableRow;
  cell: TableCell;
  /** First grid column the cell covers. */
  column: number;
}

function columnOf(row: TableRow, cellIndex: number): number {
  let column = row.before;
  for (let i = 0; i < cellIndex; i++) column += row.cells[i].span;
  return column;
}

/** Where in its table the cell of a paragraph is, or undefined for a paragraph outside any table. */
export function locateCell(doc: Doc, para: number): CellLocation | undefined {
  const ref = doc.paragraphs[para]?.cell;
  const table = ref && doc.tables?.[ref.table];
  if (!ref || !table) return undefined;
  const rowIndex = table.rows.findIndex((r) => r.id === ref.row);
  const row = table.rows[rowIndex];
  const cellIndex = row ? row.cells.findIndex((c) => c.id === ref.cell) : -1;
  if (cellIndex < 0) return undefined;
  return { tableIndex: ref.table, table, rowIndex, cellIndex, row, cell: row.cells[cellIndex], column: columnOf(row, cellIndex) };
}

const nextId = (items: { id: number }[]) => Math.max(-1, ...items.map((item) => item.id)) + 1;
const keyOf = (row: number, cell: number) => `${row}:${cell}`;

/** Formatting for new text: `props` without what ties a run to the content it was copied from. */
function plainRun(props: RunProps): RunProps {
  return defined({
    ...props,
    opaque: undefined,
    wrap: undefined,
    object: undefined,
    anchor: undefined,
    objectWidth: undefined,
    objectHeight: undefined,
    field: undefined,
  });
}

/** An empty paragraph for a new cell, formatted like `template`. */
function emptyLike(template: Paragraph, cell: CellRef): Paragraph {
  const props = defined<ParagraphProps>({ ...template.props, numId: undefined, listLevel: undefined, pageBreakBefore: undefined });
  return { props, runs: [{ text: '', props: plainRun(template.runs[0].props) }], cell };
}

/**
 * Replaces a table by `table` and lines its paragraphs up with the new shape:
 * a cell that still exists keeps its paragraphs, a new one gets the paragraph
 * `fill` makes for it, and the paragraphs of cells that are gone go with them.
 * `at` is where the paragraphs go when the table has none yet.
 */
function reshape(
  doc: Doc,
  tableIndex: number,
  table: Table,
  fill: (row: TableRow, cell: TableCell, ref: CellRef) => Paragraph,
  at?: number,
): Doc {
  let first = -1;
  let last = -1;
  const kept = new Map<string, Paragraph[]>();
  doc.paragraphs.forEach((p, i) => {
    // The paragraphs of a table in a cell go with that cell.
    const ref = cellOfTable(doc.tables, p.cell, tableIndex);
    if (!ref) return;
    if (first < 0) first = i;
    last = i;
    const key = keyOf(ref.row, ref.cell);
    const list = kept.get(key);
    if (list) list.push(p);
    else kept.set(key, [p]);
  });
  const block: Paragraph[] = [];
  for (const row of table.rows) {
    for (const cell of row.cells) {
      block.push(...(kept.get(keyOf(row.id, cell.id)) ?? [fill(row, cell, { table: tableIndex, row: row.id, cell: cell.id })]));
    }
  }
  const paragraphs = doc.paragraphs.slice();
  if (first < 0) paragraphs.splice(at ?? paragraphs.length, 0, ...block);
  else paragraphs.splice(first, last - first + 1, ...block);
  // A document always has a paragraph.
  if (!paragraphs.length) paragraphs.push(createParagraph());
  const tables = (doc.tables ?? []).slice();
  tables[tableIndex] = table;
  return { ...doc, tables, paragraphs };
}

/** First paragraph of a cell, by ids. */
function firstParagraphOf(doc: Doc, tableIndex: number, row: number, cell: number): number {
  return doc.paragraphs.findIndex((p) => p.cell?.table === tableIndex && p.cell.row === row && p.cell.cell === cell);
}

/** The caret at the start of the cell at this place of the table, or as near to it as there still is one. */
function caretNear(doc: Doc, before: Doc, loc: CellLocation, rowIndex: number, column: number): Position {
  const table = doc.tables?.[loc.tableIndex];
  const row = table?.rows[Math.max(0, Math.min(rowIndex, table.rows.length - 1))];
  if (row?.cells.length) {
    let cell = row.cells[0];
    let start = row.before;
    for (const c of row.cells) {
      if (start <= column) cell = c;
      start += c.span;
    }
    const para = firstParagraphOf(doc, loc.tableIndex, row.id, cell.id);
    if (para >= 0) return { para, offset: 0 };
  }
  // The table is gone: the caret goes where it was.
  const where = before.paragraphs.findIndex((p) => p.cell?.table === loc.tableIndex);
  return { para: Math.max(0, Math.min(where, doc.paragraphs.length - 1)), offset: 0 };
}

function cellAtColumn(row: TableRow | undefined, column: number): TableCell | undefined {
  let start = row?.before ?? 0;
  for (const cell of row?.cells ?? []) {
    if (column >= start && column < start + cell.span) return cell;
    start += cell.span;
  }
  return undefined;
}

/**
 * Inserts a table of empty cells at the caret, which must be outside any
 * table: a table inside a cell is not modelled. Text after the caret goes
 * below the table. Returns the document and the caret in the first cell.
 */
export function insertTable(doc: Doc, pos: Position, rowCount: number, columnCount: number): { doc: Doc; pos: Position } {
  const here = doc.paragraphs[pos.para];
  if (here.cell || rowCount < 1 || columnCount < 1) return { doc, pos };
  const tableIndex = doc.tables?.length ?? 0;
  const width = (doc.page.width - doc.page.marginLeft - doc.page.marginRight) / columnCount;
  const rows: TableRow[] = Array.from({ length: rowCount }, (_, r) => ({
    id: r,
    before: 0,
    height: 0,
    cells: Array.from({ length: columnCount }, (_, c): TableCell => ({ id: c, span: 1, borders: true, borderTop: 0.5, borderBottom: 0.5 })),
  }));
  const table: Table = {
    columns: new Array<number>(columnCount).fill(width),
    fixed: true,
    align: 'left',
    indent: 0,
    padTop: 0,
    padRight: 5.4,
    padBottom: 0,
    padLeft: 5.4,
    rows,
  };
  // Cells start with the caret's formatting, without the spacing and indents of the paragraph it is in.
  const template: Paragraph = {
    props: defined<ParagraphProps>({
      ...here.props,
      align: undefined,
      spacingBefore: 0,
      spacingAfter: 0,
      indentLeft: 0,
      indentRight: 0,
      indentFirstLine: 0,
      keepNext: undefined,
    }),
    runs: [{ text: '', props: propsAt(doc, pos) }],
  };
  // An empty paragraph stays below the table; otherwise the paragraph is split around it.
  const split = paragraphLength(here) > 0 ? splitParagraph(doc, pos).doc : doc;
  const at = paragraphLength(here) > 0 ? pos.para + 1 : pos.para;
  const next = reshape(split, tableIndex, table, (_row, _cell, ref) => emptyLike(template, ref), at);
  return { doc: next, pos: { para: at, offset: 0 } };
}

/** The line a signature is written on, and what stands under it until the name is typed. */
export const SIGNATURE_LINE = '_'.repeat(30);
export const SIGNATURE_NAME = 'NOMBRE COMPLETO';
/** Who signs in each place, written above its line. */
export const SIGNATURE_TITLES = ['ASESOR', 'CLIENTE'];

/**
 * Inserts a place to sign for each of the `titles`, side by side: a table of
 * one row without borders, each cell with who signs, a line and a name under
 * it, centred and in bold. Returns the document and the range of the first
 * name, to type over it. `name` is what stands for each name until then.
 */
export function insertSignatures(doc: Doc, pos: Position, titles: string[] = SIGNATURE_TITLES, name = SIGNATURE_NAME): { doc: Doc; pos: Position; name?: { from: Position; to: Position } } {
  const count = titles.length;
  const made = insertTable(doc, pos, 1, count);
  if (made.doc === doc) return made;
  const first = made.pos.para;
  const paragraphs = made.doc.paragraphs.slice();
  const cells = paragraphs.slice(first, first + count).flatMap((cell, i): Paragraph[] => {
    const props: RunProps = { ...cell.runs[0].props, bold: true };
    const written = (text: string): Paragraph => ({ ...cell, props: { ...cell.props, align: 'center' }, runs: [{ text, props }] });
    return [written(titles[i]), written(SIGNATURE_LINE), written(name)];
  });
  paragraphs.splice(first, count, ...cells);
  const next = setCellProps({ ...made.doc, paragraphs }, first, first + cells.length - 1, { borders: false });
  return { doc: next, pos: { para: first + 2, offset: 0 }, name: { from: { para: first + 2, offset: 0 }, to: { para: first + 2, offset: name.length } } };
}

/** Adds an empty row above or below the row of the paragraph, shaped and formatted like it. */
export function insertRow(doc: Doc, para: number, below: boolean): Doc {
  const loc = locateCell(doc, para);
  if (!loc) return doc;
  const { table, row, rowIndex } = loc;
  const neighbour = table.rows[rowIndex + 1];
  const added: TableRow = {
    ...row,
    id: nextId(table.rows),
    cells: row.cells.map((cell, i) => {
      // Inside a run of cells merged down, the new cell joins the run.
      const inRun = below ? cell.merge && cellAtColumn(neighbour, columnOf(row, i))?.merge === 'continue' : cell.merge === 'continue';
      return defined<TableCell>({ ...cell, merge: inRun ? 'continue' : undefined });
    }),
  };
  const rows = table.rows.slice();
  rows.splice(below ? rowIndex + 1 : rowIndex, 0, added);
  return reshape(doc, loc.tableIndex, { ...table, rows }, (_row, cell, ref) => {
    const like = firstParagraphOf(doc, loc.tableIndex, row.id, cell.id);
    return emptyLike(doc.paragraphs[like >= 0 ? like : para], ref);
  });
}

/** Removes the row of the paragraph, and the table with it when it was the last one. */
export function deleteRow(doc: Doc, para: number): { doc: Doc; pos: Position } {
  const loc = locateCell(doc, para);
  if (!loc) return { doc, pos: { para, offset: 0 } };
  const { table, row, rowIndex } = loc;
  const rows = table.rows.filter((r) => r !== row);
  // A run of merged cells that started in this row starts in the next one.
  const below = rows[rowIndex];
  if (below) {
    rows[rowIndex] = {
      ...below,
      cells: below.cells.map((cell, i) =>
        cell.merge === 'continue' && cellAtColumn(row, columnOf(below, i))?.merge === 'start' ? { ...cell, merge: 'start' as const } : cell,
      ),
    };
  }
  const next = reshape(doc, loc.tableIndex, { ...table, rows }, (_row, _cell, ref) => emptyLike(doc.paragraphs[para], ref));
  return { doc: next, pos: caretNear(next, doc, loc, rowIndex, loc.column) };
}

/**
 * Removes the table the paragraph is in, the innermost one for a table in a
 * cell, with everything in it. The text around it stays, and the caret goes
 * where the table was.
 */
export function deleteTable(doc: Doc, para: number): { doc: Doc; pos: Position } {
  const loc = locateCell(doc, para);
  if (!loc) return { doc, pos: { para, offset: 0 } };
  const at = doc.paragraphs.findIndex((p) => cellOfTable(doc.tables, p.cell, loc.tableIndex));
  let next = reshape(doc, loc.tableIndex, { ...loc.table, rows: [] }, () => createParagraph());
  // A cell always holds a paragraph: one the table was the only thing in gets an empty one.
  const parent = loc.table.parent;
  if (parent && !next.paragraphs.some((p) => inCell(next.tables, p.cell, parent))) {
    const paragraphs = next.paragraphs.slice();
    paragraphs.splice(at, 0, emptyLike(doc.paragraphs[para], parent));
    next = { ...next, paragraphs };
  }
  return { doc: next, pos: { para: Math.max(0, Math.min(at, next.paragraphs.length - 1)), offset: 0 } };
}

/**
 * Adds an empty column to the left or right of the cell of the paragraph. It
 * is as wide as the column next to it, and the others give up room so the
 * table stays as wide as it was.
 */
export function insertColumn(doc: Doc, para: number, right: boolean): Doc {
  const loc = locateCell(doc, para);
  if (!loc) return doc;
  const { table } = loc;
  const at = right ? loc.column + loc.cell.span : loc.column;
  const total = table.columns.reduce((a, b) => a + b, 0);
  const width = table.columns[Math.min(right ? at - 1 : at, table.columns.length - 1)] ?? total;
  const columns = table.columns.slice();
  columns.splice(at, 0, width);
  const scale = total / (total + width);

  /** Row id -> the cell the new one copies its look and its text formatting from. */
  const models = new Map<number, TableCell>();
  const rows = table.rows.map((row): TableRow => {
    if (at < row.before) return { ...row, before: row.before + 1 };
    const cells: TableCell[] = [];
    let start = row.before;
    let placed = false;
    row.cells.forEach((cell, i) => {
      if (!placed && at > start && at < start + cell.span) {
        // The column falls inside a cell that covers several: the cell covers one more.
        cells.push({ ...cell, span: cell.span + 1 });
        placed = true;
      } else {
        if (!placed && at === start) {
          const model = (right && row.cells[i - 1]) || cell;
          models.set(row.id, model);
          cells.push(defined<TableCell>({ ...model, id: nextId(row.cells), span: 1, merge: undefined }));
          placed = true;
        }
        cells.push(cell);
      }
      start += cell.span;
    });
    if (!placed && row.cells.length) {
      const model = row.cells[row.cells.length - 1];
      models.set(row.id, model);
      cells.push(defined<TableCell>({ ...model, id: nextId(row.cells), span: 1, merge: undefined }));
    }
    return { ...row, cells };
  });
  return reshape(doc, loc.tableIndex, { ...table, columns: columns.map((w) => w * scale), rows }, (row, _cell, ref) => {
    const like = firstParagraphOf(doc, loc.tableIndex, row.id, models.get(row.id)?.id ?? -1);
    return emptyLike(doc.paragraphs[like >= 0 ? like : para], ref);
  });
}

/** Removes the column the cell of the paragraph starts in, and the table with it when it was the last one. */
export function deleteColumn(doc: Doc, para: number): { doc: Doc; pos: Position } {
  const loc = locateCell(doc, para);
  if (!loc) return { doc, pos: { para, offset: 0 } };
  const { table, column } = loc;
  const columns = table.columns.filter((_, i) => i !== column);
  const rows = table.rows
    .map((row): TableRow => {
      if (column < row.before) return { ...row, before: row.before - 1 };
      const cells: TableCell[] = [];
      let start = row.before;
      for (const cell of row.cells) {
        const inside = column >= start && column < start + cell.span;
        start += cell.span;
        // A cell over several columns loses one; a cell of this column alone goes.
        if (inside && cell.span > 1) cells.push({ ...cell, span: cell.span - 1 });
        else if (!inside) cells.push(cell);
      }
      return { ...row, cells };
    })
    .filter((row) => row.cells.length);
  const next = reshape(doc, loc.tableIndex, { ...table, columns, rows }, (_row, _cell, ref) => emptyLike(doc.paragraphs[para], ref));
  return { doc: next, pos: caretNear(next, doc, loc, loc.rowIndex, column) };
}

// --- Cells ----------------------------------------------------------------------

/** A block of cells: rows `rowFrom` to `rowTo`, and grid columns from `colFrom` up to, not including, `colTo`. */
export interface CellRect {
  tableIndex: number;
  table: Table;
  rowFrom: number;
  rowTo: number;
  colFrom: number;
  colTo: number;
}

/**
 * The block of cells between the cells of two paragraphs, as a selection that
 * goes from one to the other takes it. Undefined unless both are in the same
 * table.
 */
export function cellRect(doc: Doc, paraA: number, paraB: number): CellRect | undefined {
  const a = locateCell(doc, paraA);
  const b = locateCell(doc, paraB);
  if (!a || !b || a.tableIndex !== b.tableIndex) return undefined;
  const { table } = a;
  const rect: CellRect = {
    tableIndex: a.tableIndex,
    table,
    rowFrom: Math.min(a.rowIndex, b.rowIndex),
    rowTo: Math.max(a.rowIndex, b.rowIndex),
    colFrom: Math.min(a.column, b.column),
    colTo: Math.max(a.column + a.cell.span, b.column + b.cell.span),
  };
  // A cell that sticks out of the block, sideways or as part of a run merged down, takes the block with it.
  for (let grew = true; grew; ) {
    grew = false;
    table.rows.forEach((row, r) => {
      let start = row.before;
      row.cells.forEach((cell) => {
        const end = start + cell.span;
        const across = start < rect.colTo && end > rect.colFrom;
        if (across && r >= rect.rowFrom && r <= rect.rowTo && (start < rect.colFrom || end > rect.colTo)) {
          rect.colFrom = Math.min(rect.colFrom, start);
          rect.colTo = Math.max(rect.colTo, end);
          grew = true;
        }
        // The run a cell of the block is in: up to its start, down to its last one.
        if (across && cell.merge === 'continue' && r === rect.rowTo + 1 && cellAtColumn(table.rows[rect.rowTo], start)?.merge) {
          rect.rowTo = r;
          grew = true;
        }
        if (across && cell.merge === 'continue' && r === rect.rowFrom && r > 0) {
          rect.rowFrom = r - 1;
          grew = true;
        }
        start = end;
      });
    });
    rect.rowFrom = Math.max(0, rect.rowFrom);
  }
  return rect;
}

const inRect = (rect: CellRect, rowIndex: number, start: number, cell: TableCell) =>
  rowIndex >= rect.rowFrom && rowIndex <= rect.rowTo && start >= rect.colFrom && start + cell.span <= rect.colTo;

/** True when the block is more than one cell, which is when it can be merged. */
export function canMergeCells(doc: Doc, paraA: number, paraB: number): boolean {
  const rect = cellRect(doc, paraA, paraB);
  if (!rect) return false;
  // A cell with a table in it is not merged: the table has no place to go in the one made of them.
  if (doc.tables?.some((t) => t.parent?.table === rect.tableIndex && rect.table.rows.some((row, r) => row.id === t.parent!.row && r >= rect.rowFrom && r <= rect.rowTo))) return false;
  let count = 0;
  for (let r = rect.rowFrom; r <= rect.rowTo; r++) {
    const row = rect.table.rows[r];
    let start = row.before;
    // Every row must begin and end with the block, or the result would not be a rectangle.
    if (row.before > rect.colFrom) return false;
    for (const cell of row.cells) {
      if (inRect(rect, r, start, cell) && cell.merge !== 'continue') count++;
      start += cell.span;
    }
    if (start < rect.colTo) return false;
  }
  return count > 1;
}

/**
 * Makes one cell of the block between the cells of two paragraphs. The text
 * of all of them goes into it, in reading order. Returns the document and the
 * caret at the start of the merged cell.
 */
export function mergeCells(doc: Doc, paraA: number, paraB: number): { doc: Doc; pos: Position } {
  const rect = cellRect(doc, paraA, paraB);
  if (!rect || !canMergeCells(doc, paraA, paraB)) return { doc, pos: { para: paraA, offset: 0 } };
  const { table, tableIndex } = rect;
  /** Cells that go into the merged one, as "row id:cell id". */
  const absorbed = new Set<string>();
  let target: { row: number; cell: number } | undefined;
  const rows = table.rows.map((row, r): TableRow => {
    if (r < rect.rowFrom || r > rect.rowTo) return row;
    const cells: TableCell[] = [];
    let start = row.before;
    let placed = false;
    for (const cell of row.cells) {
      if (inRect(rect, r, start, cell)) {
        absorbed.add(keyOf(row.id, cell.id));
        if (!placed) {
          placed = true;
          target ??= { row: row.id, cell: cell.id };
          const merge = rect.rowFrom === rect.rowTo ? undefined : r === rect.rowFrom ? ('start' as const) : ('continue' as const);
          cells.push(defined<TableCell>({ ...cell, span: rect.colTo - rect.colFrom, merge }));
        }
      } else {
        cells.push(cell);
      }
      start += cell.span;
    }
    return { ...row, cells };
  });
  if (!target) return { doc, pos: { para: paraA, offset: 0 } };
  const into: CellRef = { table: tableIndex, row: target.row, cell: target.cell };

  // The text of the block moves into the merged cell; empty paragraphs are left behind, but one.
  const moving = doc.paragraphs.filter((p) => p.cell?.table === tableIndex && absorbed.has(keyOf(p.cell.row, p.cell.cell)));
  const withText = moving.filter((p) => paragraphLength(p) > 0);
  const keep = new Set(withText.length ? withText : moving.slice(0, 1));
  const paragraphs = doc.paragraphs.filter((p) => !moving.includes(p) || keep.has(p)).map((p) => (keep.has(p) ? { ...p, cell: into } : p));
  const like = moving[0];
  const next = reshape({ ...doc, paragraphs }, tableIndex, { ...table, rows }, (_row, _cell, ref) => emptyLike(like, ref));
  return { doc: next, pos: { para: Math.max(0, firstParagraphOf(next, tableIndex, into.row, into.cell)), offset: 0 } };
}

/** True for a cell that covers several columns or is merged with the ones below it. */
export function canSplitCell(doc: Doc, para: number): boolean {
  const loc = locateCell(doc, para);
  return !!loc && (loc.cell.span > 1 || loc.cell.merge === 'start');
}

/** Undoes a merge: the cell of the paragraph goes back to one cell per column and per row, the text staying in the first. */
export function splitCell(doc: Doc, para: number): Doc {
  const loc = locateCell(doc, para);
  if (!loc || !canSplitCell(doc, para)) return doc;
  const { table, column, rowIndex } = loc;
  const span = loc.cell.span;
  // The rows the cell reaches down to.
  let last = rowIndex;
  if (loc.cell.merge === 'start') {
    while (cellAtColumn(table.rows[last + 1], column)?.merge === 'continue') last++;
  }
  const rows = table.rows.map((row, r): TableRow => {
    if (r < rowIndex || r > last) return row;
    const cells: TableCell[] = [];
    let start = row.before;
    for (const cell of row.cells) {
      if (start === column) {
        const one = defined<TableCell>({ ...cell, span: 1, merge: undefined });
        cells.push(one);
        for (let i = 1; i < span; i++) cells.push({ ...one, id: nextId([...row.cells, ...cells]) });
      } else {
        cells.push(cell);
      }
      start += cell.span;
    }
    return { ...row, cells };
  });
  return reshape(doc, loc.tableIndex, { ...table, rows }, (_row, _cell, ref) => emptyLike(doc.paragraphs[para], ref));
}

/** What can be set on cells: whether they have borders, the line they are drawn with, the colour behind them and where their text sits. */
export interface CellPatch {
  borders?: boolean;
  /** The line of all four sides; null for the plain one `borders` stands for. */
  line?: Border | null;
  shade?: string;
  valign?: 'top' | 'center' | 'bottom';
  /** Which way the text reads: level, or set vertically from the bottom up or from the top down. */
  direction?: 'level' | 'up' | 'down';
}

/** How much room a border takes across the edge it is on: a double line is two lines and the room between them. */
function lineRoom(line: Border | undefined): number {
  return !line ? 0 : line.style === 'double' ? line.width * 3 : line.width;
}

/** The borders, the line, the shading, the place and the direction of the text of the cells of the block between the cells of two paragraphs. */
export function setCellProps(doc: Doc, paraA: number, paraB: number, patch: CellPatch): Doc {
  const rect = cellRect(doc, paraA, paraB);
  if (!rect) return doc;
  const { table } = rect;
  let changed = false;
  const rows = table.rows.map((row, r): TableRow => {
    let start = row.before;
    const cells = row.cells.map((cell) => {
      const inside = inRect(rect, r, start, cell);
      start += cell.span;
      if (!inside) return cell;
      const next: TableCell = { ...cell };
      if (patch.borders !== undefined && (patch.borders !== cell.borders || cell.lines)) {
        next.borders = patch.borders;
        // Plain lines all round, or none: the lines the cell had of its own go.
        delete next.lines;
        // A border takes room in the row; without it the row closes up.
        next.borderTop = patch.borders ? 0.5 : 0;
        next.borderBottom = patch.borders ? 0.5 : 0;
      }
      if (patch.line !== undefined) {
        next.borders = true;
        if (patch.line) next.lines = { top: patch.line, right: patch.line, bottom: patch.line, left: patch.line };
        else delete next.lines;
        next.borderTop = next.borderBottom = lineRoom(patch.line ?? DEFAULT_BORDER);
      }
      if (patch.shade !== undefined) {
        if (patch.shade) next.shade = patch.shade.toUpperCase();
        else delete next.shade;
      }
      if (patch.valign !== undefined) {
        if (patch.valign === 'top') delete next.valign;
        else next.valign = patch.valign;
      }
      if (patch.direction !== undefined) {
        if (patch.direction === 'level') delete next.direction;
        else next.direction = patch.direction;
      }
      if (
        next.borders === cell.borders &&
        next.shade === cell.shade &&
        next.lines === cell.lines &&
        next.valign === cell.valign &&
        next.direction === cell.direction &&
        next.borderTop === cell.borderTop
      ) {
        return cell;
      }
      changed = true;
      return next;
    });
    return cells.some((cell, i) => cell !== row.cells[i]) ? { ...row, cells } : row;
  });
  if (!changed) return doc;
  const tables = (doc.tables ?? []).slice();
  tables[rect.tableIndex] = { ...table, rows };
  return { ...doc, tables };
}

/**
 * Makes the row of the paragraph a heading row, shown again at the top of
 * every page the table goes on to, with the rows above it; or makes it and
 * the rows below it ordinary rows again. Only rows a table starts with are
 * headings, as in Word.
 */
export function setHeaderRow(doc: Doc, para: number, on: boolean): Doc {
  const loc = locateCell(doc, para);
  if (!loc) return doc;
  const { table, rowIndex } = loc;
  const rows = table.rows.map((row, i): TableRow => {
    const want = on ? i <= rowIndex || !!row.header : i < rowIndex && !!row.header;
    if (want === !!row.header) return row;
    const next = { ...row };
    if (want) next.header = true;
    else delete next.header;
    return next;
  });
  if (rows.every((row, i) => row === table.rows[i])) return doc;
  const tables = (doc.tables ?? []).slice();
  tables[loc.tableIndex] = { ...table, rows };
  return { ...doc, tables };
}

/** The narrowest a column can be dragged to, in points. */
export const MIN_COLUMN_WIDTH = 12;

/**
 * Moves the edge after column `boundary - 1` of a table by `delta` points.
 * An edge between two columns takes from one what it gives the other; the
 * last edge makes the table wider or narrower. `columns` are the widths the
 * table is laid out with, which become the ones it has.
 */
export function resizeColumn(doc: Doc, tableIndex: number, boundary: number, delta: number, columns: number[]): Doc {
  const table = doc.tables?.[tableIndex];
  if (!table || boundary < 1 || boundary > columns.length || columns.length !== table.columns.length) return doc;
  const next = columns.slice();
  const left = boundary - 1;
  const room = boundary < next.length ? next[boundary] - MIN_COLUMN_WIDTH : Infinity;
  const moved = Math.max(MIN_COLUMN_WIDTH - next[left], Math.min(delta, room));
  if (Math.abs(moved) < 0.01) return doc;
  next[left] += moved;
  if (boundary < next.length) next[boundary] -= moved;
  const tables = (doc.tables ?? []).slice();
  // The widths are now the ones given: the table no longer follows the width of the page.
  const { widthFraction: _, ...rest } = table;
  tables[tableIndex] = { ...rest, columns: next, fixed: true };
  return { ...doc, tables };
}

/** The least height a row can be dragged to, in points. */
export const MIN_ROW_HEIGHT = 6;

/**
 * Makes row `rowIndex` of a table `height` points tall, as it is drawn: the
 * margins of its cells above and below their text are part of it. It is the
 * least the row is given, and it grows still with what its cells hold; a row
 * of an exact height keeps it exact.
 */
export function resizeRow(doc: Doc, tableIndex: number, rowIndex: number, height: number): Doc {
  const table = doc.tables?.[tableIndex];
  const row = table?.rows[rowIndex];
  if (!table || !row) return doc;
  const margins = Math.max(0, ...row.cells.map((c) => (c.padTop ?? table.padTop) + (c.padBottom ?? table.padBottom)));
  const next = Math.round(Math.max(MIN_ROW_HEIGHT, row.exact ? height : height - margins) * 20) / 20;
  if (Math.abs(next - row.height) < 0.05) return doc;
  const rows = table.rows.slice();
  rows[rowIndex] = { ...row, height: next };
  const tables = (doc.tables ?? []).slice();
  tables[tableIndex] = { ...table, rows };
  return { ...doc, tables };
}

/**
 * Makes a whole table wider or narrower and taller or shorter, as dragging its
 * corner does: each column by `scaleX` from the widths it is laid out with,
 * `columns`, and each row by `scaleY` from the height it is drawn at,
 * `heights`. The text in it is not made larger or smaller.
 */
export function resizeTable(doc: Doc, tableIndex: number, columns: number[], scaleX: number, heights: number[], scaleY: number): Doc {
  const table = doc.tables?.[tableIndex];
  if (!table || columns.length !== table.columns.length) return doc;
  let next = doc;
  if (Math.abs(scaleX - 1) > 0.002) {
    const tables = (next.tables ?? []).slice();
    // The widths are now the ones given: the table no longer follows the width of the page.
    const { widthFraction: _, ...rest } = table;
    tables[tableIndex] = { ...rest, columns: columns.map((width) => Math.max(MIN_COLUMN_WIDTH, width * scaleX)), fixed: true };
    next = { ...next, tables };
  }
  if (Math.abs(scaleY - 1) > 0.002) {
    heights.forEach((height, rowIndex) => {
      next = resizeRow(next, tableIndex, rowIndex, height * scaleY);
    });
  }
  return next;
}

/**
 * Sets the height of the row of the cell of the paragraph, in points, the
 * margins of its cells not counted, as Word gives it: the least the row is
 * given or, `exact`, the height it has whatever it holds. 0 lets the row be
 * as tall as what it holds.
 */
export function setRowHeight(doc: Doc, para: number, height: number, exact = false): Doc {
  const loc = locateCell(doc, para);
  if (!loc) return doc;
  const { table, row, rowIndex } = loc;
  const next = Math.max(0, Math.round(height * 20) / 20);
  const sure = next > 0 && exact;
  if (next === row.height && sure === !!row.exact) return doc;
  const rows = table.rows.slice();
  rows[rowIndex] = defined<TableRow>({ ...row, height: next, exact: sure || undefined });
  const tables = (doc.tables ?? []).slice();
  tables[loc.tableIndex] = { ...table, rows };
  return { ...doc, tables };
}
