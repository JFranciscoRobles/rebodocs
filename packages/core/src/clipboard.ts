// What is copied and pasted with its formatting: a piece of a document, apart
// from it, its tables among it. It goes to other programs as HTML, and comes
// back from this editor whole; what comes as HTML from elsewhere is read into
// one by the editor.

import { type ListKind, levelOf, MAX_LIST_LEVEL, addList } from './numbering';
import { LINK_COLOR, cleanHref, linkHref, linkProps } from './links';
import { escapeXml } from './docx/xml';
import { borderRoom } from './docx/import';
import {
  type Border,
  type CellLines,
  type Doc,
  type Paragraph,
  type ParagraphProps,
  type Position,
  type Range,
  type RunProps,
  type TableCell,
  type TableRow,
  DEFAULT_BORDER,
  defined,
  paragraphLength,
  resolveRun,
} from './model';
import { insertText, listKindAt, propsAt, sliceRuns, splitParagraph } from './ops';
import { paragraphStyles } from './styles';
import { canMergeCells, insertTable, locateCell, mergeCells, setHeaderRow } from './tables';
import { altText, docImage, imageExtension, imageTypeOf, insertImage, pictureSize, setAltText } from './images';

/** A run of a clip: its formatting is what it has of its own, on top of the text it lands in. */
export interface ClipRun {
  text: string;
  props: RunProps;
  /** Where it goes, when it is a link. */
  href?: string;
  /** A picture in the line, in place of text: its `text` is empty. */
  image?: ClipImage;
}

/**
 * A picture of a clip. Only a `data:` address is put in by insertClip; one
 * the clip got some other way (a web address, a file of the computer) is for
 * whoever pastes it to read into one first, or it is left out.
 */
export interface ClipImage {
  src: string;
  /** Its size in the line, in points; 0 when where it came from did not say, and it is then the picture's own at 96 pixels an inch. */
  width: number;
  height: number;
  /** What it shows, for whoever cannot see it. */
  alt?: string;
}

export interface ClipParagraph {
  runs: ClipRun[];
  props: ParagraphProps;
  /** The list it is in: items with the same `id` are in one list. */
  list?: { id: number; kind: ListKind; level: number };
  /** The name Word knows its style by ('heading 1', 'Title'...), when it has one but Normal. */
  style?: string;
  /** The cell it is in, when it is in a table: the table, in `Clip.tables`, and the row and column of the grid where the cell starts. */
  cell?: { table: number; row: number; column: number };
}

/** A table of a clip: its grid, and the cells that take more than one place of it. */
export interface ClipTable {
  rows: number;
  columns: number;
  /** Cells that cover more than one row or column: where each starts, and how many it covers. */
  merges?: { row: number; column: number; rows: number; columns: number }[];
  /** How wide each column is, in points, when where it came from says so. */
  widths?: number[];
  /** How many of its first rows are its heading, repeated on each page. */
  header?: number;
  /** The look of the cells that have one, by where each starts in the grid: its colour, the lines of its sides, where its text sits. */
  cells?: ClipCell[];
  /** The height of the rows that say one, in points: at least that, or that whatever they hold when `exact`. */
  heights?: { row: number; height: number; exact?: boolean }[];
}

/** The look of a cell of a clip's table. `lines` with no side is a cell drawn with none; left out, one drawn with the plain lines. */
export interface ClipCell {
  row: number;
  column: number;
  shade?: string;
  lines?: CellLines;
  valign?: 'center' | 'bottom';
}

export interface Clip {
  paragraphs: ClipParagraph[];
  /** The tables its paragraphs are in, by `ClipParagraph.cell.table`. */
  tables?: ClipTable[];
}

/** The formatting of a run that means something outside the document it is in. */
function portableRun(props: RunProps): RunProps {
  const { bold, italic, underline, strike, fontSize, fontFamily, color, highlight } = props;
  return defined({ bold, italic, underline, strike, fontSize, fontFamily, color, highlight });
}

function portableParagraph(props: ParagraphProps): ParagraphProps {
  const { align, spacingBefore, spacingAfter, lineHeight, indentLeft, indentRight, indentFirstLine, keepNext, keepLines, tabs } = props;
  return defined({ align, spacingBefore, spacingAfter, lineHeight, indentLeft, indentRight, indentFirstLine, keepNext, keepLines, tabs });
}

/** The text of `range`, with its formatting and its pictures, apart from the document. Fields, shapes and text boxes stay behind. */
export function clipOf(doc: Doc, range: Range): Clip {
  const styles = paragraphStyles(doc);
  const paragraphs: ClipParagraph[] = [];
  const tables: ClipTable[] = [];
  /** The table of the clip each table of the document went to, and the first of its rows the clip has. */
  const taken = new Map<number, { index: number; firstRow: number }>();
  for (let i = range.from.para; i <= range.to.para; i++) {
    const p = doc.paragraphs[i];
    const at = p.cell ? locateCell(doc, i) : undefined;
    // A cell merged into the one above it holds nothing of its own.
    if (at?.cell.merge === 'continue') continue;
    const a = i === range.from.para ? range.from.offset : 0;
    const b = i === range.to.para ? range.to.offset : paragraphLength(p);
    const runs: ClipRun[] = [];
    for (const run of sliceRuns(p.runs, a, b)) {
      // Text taken out while changes were tracked is not there for the person.
      if (run.props.revision === 'delete') continue;
      if (run.props.object) {
        const image = clipImage(doc, run.props);
        if (image) runs.push({ text: '', props: {}, image });
        continue;
      }
      // The size and the font go even when they are the document's own, which elsewhere are not.
      const { fontSize, fontFamily } = resolveRun(run.props);
      runs.push(defined({ text: run.text, props: portableRun({ ...run.props, fontSize, fontFamily }), href: linkHref(run.props) }));
    }
    const kind = listKindAt(doc, i);
    const style = styles.find((s) => s.id === p.props.styleId && s !== styles[0]);
    paragraphs.push(
      defined<ClipParagraph>({
        runs,
        props: portableParagraph(p.props),
        list: kind ? { id: p.props.numId!, kind, level: p.props.listLevel ?? 0 } : undefined,
        style: style?.wordName,
        cell: at && clipCell(at, taken, tables),
      }),
    );
  }
  // The rows of each table the clip has, from the first it took to the last.
  for (const [index, { index: into, firstRow }] of taken) {
    const lastRow = Math.max(...paragraphs.filter((p) => p.cell?.table === into).map((p) => p.cell!.row)) + firstRow;
    tables[into] = tableOf(doc, index, firstRow, lastRow);
  }
  return tables.length ? { paragraphs, tables } : { paragraphs };
}

/** A picture of the document as a picture of a clip: its bytes as a data: address, its size and what it shows. Undefined for a shape or a text box. */
function clipImage(doc: Doc, props: RunProps): ClipImage | undefined {
  const media = props.object ? docImage(doc, props.object) : undefined;
  if (!media || !imageExtension(media.type) || !props.objectWidth || !props.objectHeight) return undefined;
  return defined({ src: dataAddress(media.bytes, media.type), width: props.objectWidth, height: props.objectHeight, alt: altText(props.object) });
}

/** Bytes as a data: address. */
export function dataAddress(bytes: Uint8Array, type: string): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
}

/** The picture a data: address holds, by what its bytes are: programs are not always right about the kind they say (Word says image/png of a JPEG). */
export function dataPicture(src: string): { bytes: Uint8Array; type: string } | undefined {
  const found = /^data:image\/[\w.+-]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(src.trim());
  if (!found) return undefined;
  try {
    const bytes = Uint8Array.from(atob(found[1].replace(/\s+/g, '')), (c) => c.charCodeAt(0));
    const type = imageTypeOf(bytes);
    return type && imageExtension(type) ? { bytes, type } : undefined;
  } catch {
    return undefined;
  }
}

/** Where a cell of the document is in the clip: its table, made when the clip first comes to it, and its place in the grid. */
function clipCell(at: NonNullable<ReturnType<typeof locateCell>>, taken: Map<number, { index: number; firstRow: number }>, tables: ClipTable[]): ClipParagraph['cell'] {
  let entry = taken.get(at.tableIndex);
  if (!entry) {
    entry = { index: taken.size, firstRow: at.rowIndex };
    taken.set(at.tableIndex, entry);
    tables.push({ rows: 0, columns: 0 });
  }
  return { table: entry.index, row: at.rowIndex - entry.firstRow, column: gridColumn(at.table.rows[at.rowIndex], at.cellIndex) };
}

/** The column of the grid where a cell of a row starts. */
function gridColumn(row: TableRow, cellIndex: number): number {
  let column = row.before;
  for (let c = 0; c < cellIndex; c++) column += row.cells[c].span;
  return column;
}

/** Rows `from` to `to` of a table of the document as a table of a clip: its grid, its merged cells, its widths and its heading. */
function tableOf(doc: Doc, index: number, from: number, to: number): ClipTable {
  const table = doc.tables![index];
  const rows = table.rows.slice(from, to + 1);
  const merges: NonNullable<ClipTable['merges']> = [];
  rows.forEach((row, r) => {
    row.cells.forEach((cell, c) => {
      if (cell.merge === 'continue') return;
      const column = gridColumn(row, c);
      let down = 1;
      // The cells merged into this one below it: those that continue it in the same column.
      if (cell.merge === 'start') {
        while (r + down < rows.length) {
          const below = rows[r + down];
          const under = below.cells.find((_, k) => gridColumn(below, k) === column);
          if (under?.merge !== 'continue') break;
          down++;
        }
      }
      if (down > 1 || cell.span > 1) merges.push({ row: r, column, rows: down, columns: cell.span });
    });
  });
  let header = 0;
  while (header < rows.length && rows[header].header) header++;
  const cells: ClipCell[] = [];
  const heights: NonNullable<ClipTable['heights']> = [];
  rows.forEach((row, r) => {
    if (row.height > 0) heights.push(defined({ row: r, height: row.height, exact: row.exact || undefined }));
    row.cells.forEach((cell, c) => {
      if (cell.merge === 'continue') return;
      const look = defined<ClipCell>({ row: r, column: gridColumn(row, c), shade: cell.shade, lines: cell.borders ? cell.lines : {}, valign: cell.valign });
      if (Object.keys(look).length > 2) cells.push(look);
    });
  });
  return defined<ClipTable>({
    rows: rows.length,
    columns: table.columns.length,
    merges: merges.length ? merges : undefined,
    widths: table.columns.slice(),
    header: header || undefined,
    cells: cells.length ? cells : undefined,
    heights: heights.length ? heights : undefined,
  });
}

/** The plain text of a clip, paragraphs separated by '\n'. */
export function clipText(clip: Clip): string {
  // The cells of a row apart by a tab, as a table goes into a mail or a sheet.
  return clip.paragraphs
    .map((p, i) => {
      const before = clip.paragraphs[i - 1]?.cell;
      const sameRow = !!p.cell && !!before && before.table === p.cell.table && before.row === p.cell.row && before.column !== p.cell.column;
      return (i ? (sameRow ? '\t' : '\n') : '') + p.runs.map((r) => r.text).join('');
    })
    .join('');
}

const pt = (n: number): string => `${Math.round(n * 100) / 100}pt`;

function runHtml(run: ClipRun): string {
  if (run.image) {
    const { src, width, height, alt } = run.image;
    // In pixels as an attribute, as a page lays it out, and in points as a style, as Word reads it.
    const size = width && height ? ` width="${Math.round(width / 0.75)}" height="${Math.round(height / 0.75)}" style="width:${pt(width)};height:${pt(height)}"` : '';
    return `<img src="${escapeXml(src)}"${size} alt="${escapeXml(alt ?? '')}">`;
  }
  const { props } = run;
  const css: string[] = [];
  if (props.fontFamily) css.push(`font-family:'${props.fontFamily.replace(/'/g, '')}'`);
  if (props.fontSize) css.push(`font-size:${pt(props.fontSize)}`);
  if (props.color && !(run.href && props.color === LINK_COLOR)) css.push(`color:#${props.color}`);
  if (props.highlight) css.push(`background-color:#${props.highlight}`);
  css.push(`font-weight:${props.bold ? 'bold' : 'normal'}`);
  if (props.italic) css.push('font-style:italic');
  const lines = [props.underline && !run.href ? 'underline' : '', props.strike ? 'line-through' : ''].filter(Boolean);
  if (lines.length) css.push(`text-decoration:${lines.join(' ')}`);
  const text = escapeXml(run.text).replace(/\n/g, '<br>').replace(/\t/g, '&emsp;').replace(/\f/g, '');
  const span = `<span style="${css.join(';')}">${text}</span>`;
  return run.href ? `<a href="${escapeXml(run.href)}">${span}</a>` : span;
}

function paragraphCss(props: ParagraphProps): string {
  const css: string[] = ['margin:0'];
  if (props.align) css.push(`text-align:${props.align}`);
  if (props.spacingBefore) css.push(`margin-top:${pt(props.spacingBefore)}`);
  if (props.spacingAfter) css.push(`margin-bottom:${pt(props.spacingAfter)}`);
  if (props.indentLeft) css.push(`margin-left:${pt(props.indentLeft)}`);
  if (props.indentRight) css.push(`margin-right:${pt(props.indentRight)}`);
  if (props.indentFirstLine) css.push(`text-indent:${pt(props.indentFirstLine)}`);
  // As Word writes it: a percentage of the natural line.
  if (props.lineHeight) css.push(`line-height:${Math.round(props.lineHeight * 100)}%`);
  return css.join(';');
}

const HEADING = /^heading ([1-6])$/i;

const CSS_BORDER: Record<Border['style'], string> = { single: 'solid', double: 'double', dashed: 'dashed', dotted: 'dotted' };

/** The lines, colour and place of the text of a cell as CSS, as Word writes them and reads them back. */
function cellCss(look: ClipCell | undefined): string {
  const side = (border: Border | undefined) => (border ? `${CSS_BORDER[border.style]} #${border.color} ${pt(border.width)}` : 'none');
  const lines = look?.lines;
  const css = lines ? (['top', 'right', 'bottom', 'left'] as const).map((key) => `border-${key}:${side(lines[key])}`) : [`border:${side(DEFAULT_BORDER)}`];
  if (look?.shade) css.push(`background:#${look.shade}`);
  css.push(`vertical-align:${look?.valign === 'center' ? 'middle' : (look?.valign ?? 'top')}`);
  return css.join(';');
}

/** A table of a clip as HTML: its grid, the merged cells spanning, and each cell's paragraphs. */
function tableHtml(clip: Clip, index: number): string {
  const table = clip.tables?.[index];
  if (!table) return '';
  const covered = new Set<string>();
  const span = new Map<string, { rows: number; columns: number }>();
  for (const m of table.merges ?? []) {
    span.set(`${m.row}:${m.column}`, m);
    for (let r = m.row; r < m.row + m.rows; r++) for (let c = m.column; c < m.column + m.columns; c++) if (r !== m.row || c !== m.column) covered.add(`${r}:${c}`);
  }
  const rows: string[] = [];
  for (let r = 0; r < table.rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < table.columns; c++) {
      if (covered.has(`${r}:${c}`)) continue;
      const own = clip.paragraphs.filter((p) => p.cell?.table === index && p.cell.row === r && p.cell.column === c);
      const inner = own.map((p) => `<p style="${paragraphCss(p.props)}">${p.runs.map(runHtml).join('') || '<br>'}</p>`).join('') || '<p style="margin:0"><br></p>';
      const s = span.get(`${r}:${c}`);
      const width = table.widths?.[c] && (!s || s.columns === 1) ? `;width:${pt(table.widths[c])}` : '';
      const tag = r < (table.header ?? 0) ? 'th' : 'td';
      const look = table.cells?.find((cell) => cell.row === r && cell.column === c);
      cells.push(`<${tag}${s && s.columns > 1 ? ` colspan="${s.columns}"` : ''}${s && s.rows > 1 ? ` rowspan="${s.rows}"` : ''} style="${cellCss(look)};padding:0 5.4pt${width}">${inner}</${tag}>`);
    }
    const height = table.heights?.find((h) => h.row === r);
    rows.push(`<tr${height ? ` style="height:${pt(height.height)}${height.exact ? ';mso-height-rule:exactly' : ''}"` : ''}>${cells.join('')}</tr>`);
  }
  return `<table style="border-collapse:collapse">${rows.join('')}</table>`;
}

/**
 * The clip as HTML, for the programs it is pasted into: Word, Google Docs, a
 * mail. `data` is put in it as well, for this editor to read back whole.
 */
export function clipHtml(clip: Clip, data?: string): string {
  const out: string[] = [];
  let openList: { id: number; tag: string } | undefined;
  const closeList = (): void => {
    if (openList) out.push(`</${openList.tag}>`);
    openList = undefined;
  };
  const written = new Set<number>();
  for (const p of clip.paragraphs) {
    if (p.cell) {
      closeList();
      // A table goes whole where its first paragraph is.
      if (!written.has(p.cell.table)) {
        written.add(p.cell.table);
        out.push(tableHtml(clip, p.cell.table));
      }
      continue;
    }
    const inner = p.runs.map(runHtml).join('') || '<br>';
    if (p.list) {
      const tag = p.list.kind === 'bullet' ? 'ul' : 'ol';
      if (openList?.id !== p.list.id || openList.tag !== tag) {
        closeList();
        openList = { id: p.list.id, tag };
        out.push(`<${tag} style="margin:0">`);
      }
      out.push(`<li style="margin-left:${pt(18 * p.list.level)}">${inner}</li>`);
      continue;
    }
    closeList();
    const level = p.style ? HEADING.exec(p.style)?.[1] : undefined;
    const tag = level ? `h${level}` : 'p';
    out.push(`<${tag} style="${paragraphCss(p.props)}">${inner}</${tag}>`);
  }
  closeList();
  const attr = data ? ` data-rebodocs="${escapeXml(data)}"` : '';
  return `<div${attr}>${out.join('')}</div>`;
}

/** The clip written to be read back by `parseClip`. */
export function serializeClip(clip: Clip): string {
  return JSON.stringify(clip);
}

/** A clip written by `serializeClip`, or undefined for anything else. */
export function parseClip(data: string | undefined | null): Clip | undefined {
  if (!data) return undefined;
  try {
    const clip = JSON.parse(data) as Clip;
    if (!Array.isArray(clip?.paragraphs)) return undefined;
    const ok = clip.paragraphs.every((p) => p && Array.isArray(p.runs) && p.runs.every((r) => typeof r?.text === 'string'));
    // Each cell of a table of the clip, where the grid of that table has it.
    const tables = clip.tables ?? [];
    const cells = clip.paragraphs.every((p) => {
      if (!p.cell) return true;
      const t = tables[p.cell.table];
      return !!t && Number.isInteger(p.cell.row) && Number.isInteger(p.cell.column) && p.cell.row >= 0 && p.cell.row < t.rows && p.cell.column >= 0 && p.cell.column < t.columns;
    });
    const grids = Array.isArray(tables) && tables.every((t) => t && Number.isInteger(t.rows) && Number.isInteger(t.columns) && t.rows > 0 && t.columns > 0 && t.rows <= 1000 && t.columns <= 63);
    return ok && cells && grids && clip.paragraphs.length ? clip : undefined;
  } catch {
    return undefined;
  }
}

/** The text of a paragraph of a clip written at `pos`: its runs on top of `base`, the formatting of the text there. */
function writeRuns(doc: Doc, pos: Position, runs: ClipRun[], base: RunProps): { doc: Doc; pos: Position } {
  let state = { doc, pos };
  for (const run of runs) {
    if (run.image) {
      state = writeImage(state.doc, state.pos, run.image);
      continue;
    }
    const text = run.text.replace(/\r/g, '');
    if (!text) continue;
    const props = defined({ ...base, ...portableRun(run.props) });
    const href = run.href && cleanHref(run.href);
    state = insertText(state.doc, state.pos, text, href ? linkProps(props, href) : props);
  }
  return state;
}

/** A picture of a clip put in at `pos`, at its size, made smaller to fit the width of the text; nothing when it is not a picture that can be. */
function writeImage(doc: Doc, pos: Position, image: ClipImage): { doc: Doc; pos: Position } {
  const picture = dataPicture(image.src);
  if (!picture) return { doc, pos };
  const own = pictureSize(picture.bytes, picture.type);
  let width = image.width > 0 ? image.width : (own?.width ?? 0) * 0.75;
  let height = image.height > 0 ? image.height : (own?.height ?? 0) * 0.75;
  if (!(width > 0 && height > 0)) return { doc, pos };
  const room = doc.page.width - doc.page.marginLeft - doc.page.marginRight;
  if (room > 0 && width > room) {
    height = (height * room) / width;
    width = room;
  }
  const placed = insertImage(doc, pos, { ...picture, width, height });
  if (placed.doc === doc || !image.alt) return placed;
  return { doc: setAltText(placed.doc, pos, image.alt), pos: placed.pos };
}

/**
 * Writes `clip` at `pos` with its formatting, as Word's paste that keeps the
 * formatting of where it comes from. What the clip does not say, such as a
 * font, the text takes from where it lands. One paragraph goes into the one
 * at `pos`; more of them bring their own paragraph formatting, lists and
 * styles. Returns the document and where the pasted text ends.
 */
export function insertClip(doc: Doc, pos: Position, clip: Clip): { doc: Doc; pos: Position } {
  const parts = clip.paragraphs;
  if (!parts.length) return { doc, pos };
  const base = propsAt(doc, pos);
  const styles = paragraphStyles(doc);
  const startedEmpty = paragraphLength(doc.paragraphs[pos.para]) === 0;

  // Each list of the clip becomes a list of the document.
  let numbering = doc.numbering;
  let used = Math.max(0, ...doc.paragraphs.map((p) => p.props.numId ?? 0));
  const lists = new Map<string, number>();
  for (const p of parts) {
    if (!p.list || parts.length === 1) continue;
    const key = `${p.list.id}:${p.list.kind}`;
    if (lists.has(key)) continue;
    const added = addList(numbering, p.list.kind, used);
    numbering = added.numbering;
    used = added.numId;
    lists.set(key, added.numId);
  }
  let state = { doc: numbering === doc.numbering ? doc : { ...doc, numbering }, pos };

  /** The paragraph formatting `part` gives the paragraph it is written in. */
  const paragraphProps = (part: ClipParagraph, current: ParagraphProps): ParagraphProps => {
    const style = part.style ? styles.find((s) => s.wordName?.toLowerCase() === part.style!.toLowerCase()) : undefined;
    const props: ParagraphProps = { ...(style ? style.paragraph : {}), ...portableParagraph(part.props), styleId: style?.id ?? '' };
    const numId = part.list && lists.get(`${part.list.id}:${part.list.kind}`);
    if (numId) {
      const level = Math.max(0, Math.min(part.list!.level, MAX_LIST_LEVEL));
      const def = levelOf(state.doc.numbering!, numId, level);
      Object.assign(props, { numId, listLevel: level, indentLeft: def?.indentLeft ?? 0, indentFirstLine: def?.indentFirstLine ?? 0 });
    } else {
      Object.assign(props, { numId: 0, listLevel: undefined });
    }
    return defined({ ...props, pageBreakBefore: current.pageBreakBefore });
  };
  const setProps = (para: number, part: ClipParagraph): void => {
    const paragraphs = state.doc.paragraphs.slice();
    const p = paragraphs[para];
    paragraphs[para] = { ...p, props: paragraphProps(part, p.props) } satisfies Paragraph;
    state = { ...state, doc: { ...state.doc, paragraphs } };
  };

  /** True right after a table, at the start of the paragraph that came after the place it was put in. */
  let afterTable = false;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const table = part.cell && clip.tables?.[part.cell.table];
    if (table) {
      let end = i;
      while (parts[end + 1]?.cell?.table === part.cell!.table) end++;
      const cells = parts.slice(i, end + 1);
      const placed = placeTable(state.doc, state.pos, table, cells);
      if (placed) state = placed;
      else {
        // In a cell, where a table in a table is not modelled: its rows come as lines, the cells apart by a tab, on lines of their own.
        if (i > 0 && !afterTable) state = splitParagraph(state.doc, state.pos);
        state = insertClip(state.doc, state.pos, { paragraphs: rowsAsLines(cells) });
      }
      afterTable = !!placed;
      i = end;
      continue;
    }
    if (i > 0 && !afterTable) state = splitParagraph(state.doc, state.pos);
    const runBase = i === 0 ? base : propsAt(state.doc, state.pos);
    const style = part.style ? styles.find((s) => s.wordName?.toLowerCase() === part.style!.toLowerCase()) : undefined;
    state = writeRuns(state.doc, state.pos, part.runs, style ? { ...runBase, ...style.run } : runBase);
    // A piece of a paragraph is text in the paragraph it lands in; whole paragraphs, or one in an empty paragraph, bring their own looks.
    if (afterTable || (startedEmpty ? i === 0 || parts.length > 1 : parts.length > 1 && (i > 0 || pos.offset === 0))) setProps(state.pos.para, part);
    afterTable = false;
  }
  return state;
}

/** A clip with its tables as lines: each row one, its cells apart by a tab. For where a table cannot go. */
export function clipWithoutTables(clip: Clip): Clip {
  if (!clip.tables?.length) return clip;
  const out: ClipParagraph[] = [];
  for (let i = 0; i < clip.paragraphs.length; i++) {
    const p = clip.paragraphs[i];
    if (!p.cell) {
      out.push(p);
      continue;
    }
    let end = i;
    while (clip.paragraphs[end + 1]?.cell?.table === p.cell.table) end++;
    out.push(...rowsAsLines(clip.paragraphs.slice(i, end + 1)));
    i = end;
  }
  return { paragraphs: out };
}

/** The table at `index` with the look its clip gives its cells and the heights it gives its rows. `paraOf` finds the first paragraph of a cell by its row and column ids. */
function lookOfCells(doc: Doc, index: number, table: ClipTable, paraOf: (row: number, column: number) => number): Doc {
  if (!table.cells?.length && !table.heights?.length) return doc;
  const rows = doc.tables![index].rows.map((row) => ({ ...row, cells: row.cells.slice() }));
  for (const { row, height, exact } of table.heights ?? []) {
    if (!rows[row] || !(height > 0)) continue;
    rows[row].height = height;
    if (exact) rows[row].exact = true;
  }
  // A cell merged down over rows has its look in each of them, as Word has it: the lines of its sides go down them all.
  const looks = (table.cells ?? []).flatMap((look) => {
    const down = table.merges?.find((m) => m.row === look.row && m.column === look.column)?.rows ?? 1;
    return Array.from({ length: down }, (_, k) => ({ ...look, row: look.row + k }));
  });
  for (const look of looks) {
    const at = doc.paragraphs[paraOf(look.row, look.column)]?.cell;
    const row = at && rows.find((r) => r.id === at.row);
    const k = row ? row.cells.findIndex((c) => c.id === at.cell) : -1;
    if (!row || k < 0) continue;
    const cell: TableCell = { ...row.cells[k] };
    if (look.shade) cell.shade = look.shade;
    if (look.valign) cell.valign = look.valign;
    if (look.lines) {
      const sides = (['top', 'right', 'bottom', 'left'] as const).filter((key) => look.lines![key]);
      const plain = sides.length === 4 && sides.every((key) => sameLine(look.lines![key]!, DEFAULT_BORDER));
      cell.borders = sides.length > 0;
      if (sides.length && !plain) cell.lines = look.lines;
      else delete cell.lines;
      cell.borderTop = borderRoom(look.lines.top);
      cell.borderBottom = borderRoom(look.lines.bottom);
    }
    row.cells[k] = cell;
  }
  const tables = doc.tables!.slice();
  tables[index] = { ...tables[index], rows };
  return { ...doc, tables };
}

const sameLine = (a: Border, b: Border): boolean => a.width === b.width && a.color.toUpperCase() === b.color.toUpperCase() && a.style === b.style;

/** The paragraphs of the cells of a table as lines: one a row, its cells apart by a tab. */
function rowsAsLines(cells: ClipParagraph[]): ClipParagraph[] {
  const lines: ClipParagraph[] = [];
  let last: ClipParagraph['cell'];
  for (const p of cells) {
    const { cell, ...rest } = p;
    if (last && cell && last.row === cell.row && last.column !== cell.column) lines[lines.length - 1].runs.push({ text: '\t', props: {} }, ...p.runs);
    else lines.push({ ...rest, runs: [...p.runs] });
    last = cell;
  }
  return lines;
}

/**
 * Puts a table of a clip in at `pos`: a table of its grid, each cell with its
 * paragraphs, the widths of its columns fitted to the page, its heading rows,
 * and its merged cells merged. Undefined where a table cannot go, in a cell.
 * Returns where what comes after it goes: the paragraph after the table.
 */
function placeTable(doc: Doc, pos: Position, table: ClipTable, cells: ClipParagraph[]): { doc: Doc; pos: Position } | undefined {
  const here = doc.paragraphs[pos.para];
  if (here.cell) return undefined;
  const index = doc.tables?.length ?? 0;
  let next = insertTable(doc, pos, Math.min(table.rows, 1000), Math.min(table.columns, 63)).doc;
  if (next === doc) return undefined;
  // At the start of a paragraph with text, the table goes before it, not after an empty paragraph left there.
  if (pos.offset === 0 && paragraphLength(here) > 0) {
    const left = next.paragraphs[pos.para];
    if (!left.cell && !paragraphLength(left) && !left.section) next = { ...next, paragraphs: next.paragraphs.filter((_, i) => i !== pos.para) };
  }
  // The cells of the new table are its rows and columns by id: row r, cell c, until cells are merged.
  const paraOf = (row: number, column: number) => next.paragraphs.findIndex((p) => p.cell?.table === index && p.cell.row === row && p.cell.cell === column);
  const groups = new Map<string, ClipParagraph[]>();
  for (const p of cells) groups.set(`${p.cell!.row}:${p.cell!.column}`, [...(groups.get(`${p.cell!.row}:${p.cell!.column}`) ?? []), p]);
  for (const [key, own] of groups) {
    const [row, column] = key.split(':').map(Number);
    let at = paraOf(row, column);
    if (at < 0) continue;
    own.forEach((part, k) => {
      if (k > 0) {
        next = splitParagraph(next, { para: at, offset: paragraphLength(next.paragraphs[at]) }).doc;
        at++;
      }
      next = writeRuns(next, { para: at, offset: 0 }, part.runs, propsAt(next, { para: at, offset: 0 })).doc;
      const look = portableParagraph(part.props);
      if (Object.keys(look).length) {
        const paragraphs = next.paragraphs.slice();
        paragraphs[at] = { ...paragraphs[at], props: { ...paragraphs[at].props, ...look } };
        next = { ...next, paragraphs };
      }
    });
  }
  // The widths it came with, made to fit between the margins.
  if (table.widths?.length === table.columns && table.widths.every((w) => w > 0)) {
    const room = next.page.width - next.page.marginLeft - next.page.marginRight;
    const total = table.widths.reduce((sum, w) => sum + w, 0);
    const scale = Math.min(1, room / total);
    const tables = next.tables!.slice();
    tables[index] = { ...tables[index], columns: table.widths.map((w) => w * scale) };
    next = { ...next, tables };
  }
  if (table.header && table.header < table.rows) next = setHeaderRow(next, paraOf(table.header - 1, 0), true);
  for (const m of table.merges ?? []) {
    const a = paraOf(m.row, m.column);
    const b = paraOf(m.row + m.rows - 1, m.column + m.columns - 1);
    if (a >= 0 && b >= 0 && canMergeCells(next, a, b)) next = mergeCells(next, a, b).doc;
  }
  // Once merged: a merged cell's look is that of the cell it starts at.
  next = lookOfCells(next, index, table, paraOf);
  const last = next.paragraphs.reduce((found, p, i) => (p.cell?.table === index ? i : found), -1);
  return { doc: next, pos: { para: last + 1, offset: 0 } };
}
