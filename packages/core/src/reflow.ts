// The document set to the width of a screen, not to its page: what a phone
// shows, where a sheet of paper does not fit and its text, made to, cannot be
// read. Nothing of the document changes: it is the same paragraphs, at the
// same positions, laid out down one page as wide as the screen and as tall as
// it takes.

import { anchoredObject } from './docx/source';
import { type LayoutCache, type Layout, type TextMeasurer, layoutContinuous, tableGeometry } from './layout';
import { type Doc, type Paragraph, type Table, resolveParagraph } from './model';

export interface ReflowOptions {
  /** How wide the screen is, in points. */
  width: number;
  /** The room left on each side of the text, and above and below it. */
  margin?: number;
}

/** The narrowest the text is set, whatever the screen. */
const MIN_COLUMN_WIDTH = 120;
/** The narrowest a column of a table is made to fit: narrower than this, the table is wider than the screen. */
const MIN_TABLE_COLUMN = 64;
/** An indent up to this is kept as it is; the rest of it shrinks with the screen. */
const KEPT_INDENT = 36;

const narrowedParagraphs = new WeakMap<Paragraph, { key: string; made: Paragraph }>();
const narrowedTables = new WeakMap<Table, { key: string; made: Table }>();

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** The table with its columns made to fit `column`, as far as they can and still be read. */
function narrowTable(table: Table, was: number, column: number): Table {
  const key = `${was}/${column}`;
  const kept = narrowedTables.get(table);
  if (kept?.key === key) return kept.made;
  const natural = tableGeometry(table, was).columns;
  const total = sum(natural);
  const target = Math.min(total, Math.max(column, natural.length * MIN_TABLE_COLUMN));
  const fits = target <= column + 0.01;
  const { widthFraction: _, ...rest } = table;
  const made: Table = {
    ...rest,
    columns: natural.map((w) => (w * target) / total),
    fixed: true,
    // One wider than the screen starts at the edge of the text, where it is scrolled from.
    align: fits ? table.align : 'left',
    indent: fits ? Math.max(0, Math.min(table.indent, column - target)) : 0,
  };
  narrowedTables.set(table, { key, made });
  return made;
}

/** How wide the inside of each cell of a table is, by the row and the cell a paragraph says it is in. */
function cellWidths(table: Table): Map<string, number> {
  const widths = new Map<string, number>();
  for (const row of table.rows) {
    let at = row.before;
    for (const cell of row.cells) {
      const width = sum(table.columns.slice(at, at + cell.span));
      widths.set(`${row.id}/${cell.id}`, Math.max(0, width - (cell.padLeft ?? table.padLeft) - (cell.padRight ?? table.padRight)));
      at += cell.span;
    }
  }
  return widths;
}

/**
 * The paragraph as it is set in `room` points: its pictures no wider than
 * that, the ones that floated put in its line, and its indents brought in by
 * `squeeze`. The same paragraph, when nothing of that touches it.
 */
function narrowParagraph(para: Paragraph, room: number, squeeze: number): Paragraph {
  const key = `${room}/${squeeze}`;
  const kept = narrowedParagraphs.get(para);
  if (kept?.key === key) return kept.made;
  let made = para;

  const runs = para.runs.map((run) => {
    const { object, anchor, objectWidth = 0, objectHeight = 0 } = run.props;
    if (!object) return run;
    let width = objectWidth;
    let height = objectHeight;
    if (anchor) {
      const at = anchoredObject(object);
      // One drawn under the text belongs to the page, as a letterhead does, and is not shown.
      if (!at || (at.behind && at.wrap === 'none')) return run;
      width = at.width;
      height = at.height;
    }
    if (!anchor && width <= room) return run;
    const scale = width > room ? room / width : 1;
    return { ...run, props: { ...run.props, anchor: false, objectWidth: width * scale, objectHeight: height * scale } };
  });
  if (runs.some((run, i) => run !== para.runs[i])) made = { ...made, runs };

  const pp = resolveParagraph(para.props);
  const narrow = (indent: number) => (indent > KEPT_INDENT ? KEPT_INDENT + (indent - KEPT_INDENT) * squeeze : indent);
  const indentLeft = narrow(pp.indentLeft);
  const indentRight = narrow(pp.indentRight);
  // A right tab stop past the edge of the text ends at it.
  const leaderTab = pp.leaderTab > room ? room : pp.leaderTab;
  if (indentLeft !== pp.indentLeft || indentRight !== pp.indentRight || leaderTab !== pp.leaderTab) {
    made = { ...made, props: { ...para.props, indentLeft, indentRight, ...(pp.leaderTab ? { leaderTab } : {}) } };
  }

  narrowedParagraphs.set(para, { key, made });
  return made;
}

/**
 * `doc` as it is laid out on a screen `width` points wide: a document with
 * one endless page of that width, the same paragraphs in the same order, and
 * its tables, pictures and indents made to fit. For laying out only: it is
 * not a document to edit or to save.
 *
 * A table that cannot be made to fit and still be read is left wider than
 * the screen, and the page with it: the text keeps to the width of the
 * screen, and the table is scrolled to.
 */
export function reflowDoc(doc: Doc, { width, margin = 12 }: ReflowOptions): Doc {
  const column = Math.max(MIN_COLUMN_WIDTH, Math.floor(width - margin * 2));
  const was = doc.page.width - doc.page.marginLeft - doc.page.marginRight;
  const squeeze = Math.min(1, column / was);

  const tables = doc.tables?.map((table) => narrowTable(table, was, column));
  const widest = Math.max(column, ...(tables ?? []).map((table) => table.indent + sum(table.columns)));
  const insides = new Map<Table, Map<string, number>>();
  const roomOf = (para: Paragraph): number => {
    const table = para.cell && tables?.[para.cell.table];
    if (!table) return column;
    let widths = insides.get(table);
    if (!widths) insides.set(table, (widths = cellWidths(table)));
    return widths.get(`${para.cell!.row}/${para.cell!.cell}`) ?? column;
  };

  const { header: _h, footer: _f, firstPage: _p, ...rest } = doc;
  return {
    ...rest,
    page: { width: margin + widest + margin, height: Infinity, marginTop: margin, marginBottom: margin, marginLeft: margin, marginRight: margin + widest - column },
    paragraphs: doc.paragraphs.map((para) => narrowParagraph(para, roomOf(para), squeeze)),
    ...(tables ? { tables } : {}),
  };
}

/**
 * The layout of `doc` on a screen: see `reflowDoc`. Its lines are those of
 * the paragraphs of `doc`, by their index, so a position in it is a position
 * in the document. `cache` must be one kept for this and nothing else.
 */
export function layoutReflow(doc: Doc, measurer: TextMeasurer, options: ReflowOptions, cache?: LayoutCache): Layout {
  return layoutContinuous(reflowDoc(doc, options), measurer, cache);
}
