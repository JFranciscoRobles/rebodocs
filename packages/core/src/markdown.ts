// Markdown out of a document: what Markdown has a way of saying (headings,
// bold, italic, strike-through, lists, tables) and the text of everything
// else. Fonts, sizes, colours, alignment, pictures and the header and footer
// are left behind.

import { type Doc, type Paragraph, type Run, cellOfTable, resolveRun } from './model';
import { listKindAt } from './ops';
import { paragraphStyles } from './styles';
import { decideAllRevisions, hasRevisions } from './revisions';

interface Piece {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  /** A tracked change, written as `[-…-]` or `{+…+}` when the changes are marked. */
  revision?: 'insert' | 'delete';
}

export interface MarkdownOptions {
  /**
   * The tracked changes of the document: the text as it would be with all of
   * them accepted (the default), as it was before them (`original`), or with
   * what was taken out as `[-…-]` and what was put in as `{+…+}` (`marked`),
   * as an assistant's read_document shows them.
   */
  changes?: 'accepted' | 'original' | 'marked';
}

/** Characters that would be read as Markdown where they stand. */
function escapeText(text: string): string {
  return text.replace(/([\\`*_[\]<>|~])/g, '\\$1');
}

/** A line that would start a heading, a list or a quote, kept as text. */
function escapeLineStart(line: string): string {
  return line.replace(/^(\s*)(#{1,6}\s|[-+]\s)/, (_, space: string, mark: string) => `${space}\\${mark}`).replace(/^(\s*\d+)([.)]\s)/, (_, number: string, mark: string) => `${number}\\${mark}`);
}

/** The text of the runs with its emphasis; `plainBold` drops the bold, for a heading that is bold all over. */
function inline(runs: Run[], plainBold = false): string {
  const pieces: Piece[] = [];
  for (const run of runs) {
    // Objects stand for pictures and marks; a page break has no place in Markdown.
    if (run.props.object) continue;
    const text = run.text.replace(/\f/g, '').replace(/\t/g, '    ');
    if (!text) continue;
    const props = resolveRun(run.props);
    const revision = run.props.revision === 'insert' || run.props.revision === 'delete' ? run.props.revision : undefined;
    const piece: Piece = { text, bold: props.bold && !plainBold, italic: props.italic, strike: props.strike, ...(revision ? { revision } : {}) };
    const last = pieces[pieces.length - 1];
    if (last && last.bold === piece.bold && last.italic === piece.italic && last.strike === piece.strike && last.revision === piece.revision) last.text += text;
    else pieces.push(piece);
  }
  return pieces
    .map((piece) => {
      // Emphasis marks must touch the text: the space around it goes outside them.
      const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(piece.text)!;
      if (!core) return piece.text;
      const mark = `${piece.strike ? '~~' : ''}${piece.bold ? '**' : ''}${piece.italic ? '*' : ''}`;
      const close = [...mark].reverse().join('');
      const [open, shut] = piece.revision === 'insert' ? ['{+', '+}'] : piece.revision === 'delete' ? ['[-', '-]'] : ['', ''];
      return `${lead}${open}${mark}${escapeText(core)}${close}${shut}${trail}`;
    })
    .join('')
    .trim();
}

/** A line break inside a paragraph, which Markdown writes as a backslash at the end of the line. */
const withBreaks = (text: string, indent = '') => text.split('\n').map(escapeLineStart).join(`\\\n${indent}`);

function tableBlock(doc: Doc, paragraphs: Paragraph[], tableIndex: number): string {
  const table = doc.tables?.[tableIndex];
  if (!table) return '';
  const rows = table.rows.map((row) => {
    const cells: string[] = [];
    for (const cell of row.cells) {
      // The text of a table in the cell goes in the cell, as Markdown has no tables in tables.
      const own = paragraphs.filter((p) => {
        const at = cellOfTable(doc.tables, p.cell, tableIndex);
        return at?.row === row.id && at.cell === cell.id;
      });
      // A cell is one line of the table: its paragraphs and line breaks become <br>.
      const text = own
        .map((p) => inline(p.runs))
        .filter(Boolean)
        .join('<br>')
        .replace(/\n/g, '<br>');
      cells.push(cell.merge === 'continue' ? '' : text);
      // A cell over several columns leaves the others empty.
      for (let i = 1; i < cell.span; i++) cells.push('');
    }
    return cells;
  });
  const width = Math.max(1, ...rows.map((cells) => cells.length));
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
  // Markdown tables need a header: the first row is it.
  const [head = [], ...body] = rows;
  return [line(head), line(Array.from({ length: width }, () => '---')), ...body.map(line)].join('\n');
}

export function exportMarkdown(doc: Doc, options: MarkdownOptions = {}): string {
  const changes = options.changes ?? 'accepted';
  // Decided first, unless marked: what a reader gets is one text, not both.
  if (changes !== 'marked' && hasRevisions(doc)) doc = decideAllRevisions(doc, changes === 'accepted');
  const styles = new Map(paragraphStyles(doc).map((style) => [style.id, style]));
  /** Blocks of the output and whether each one is a list item, which sits right under the one before it. */
  const blocks: { text: string; item: boolean }[] = [];
  const { paragraphs } = doc;
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    if (para.cell) {
      // A table inside another is written with the outermost one.
      let table = para.cell.table;
      while (doc.tables?.[table]?.parent) table = doc.tables[table].parent!.table;
      let end = i;
      while (end + 1 < paragraphs.length && cellOfTable(doc.tables, paragraphs[end + 1].cell, table)) end++;
      const text = tableBlock(doc, paragraphs.slice(i, end + 1), table);
      if (text) blocks.push({ text, item: false });
      i = end;
      continue;
    }
    const style = styles.get(para.props.styleId ?? '');
    const level = style?.outlineLevel ?? (style?.wordName?.toLowerCase() === 'title' ? 1 : 0);
    const kind = para.props.numId ? listKindAt(doc, i) : undefined;
    if (level) {
      const text = inline(para.runs, true).replace(/\n/g, ' ');
      if (text) blocks.push({ text: `${'#'.repeat(Math.min(level, 6))} ${text}`, item: false });
    } else if (kind) {
      const text = inline(para.runs);
      if (!text) continue;
      const indent = '    '.repeat(para.props.listLevel ?? 0);
      const mark = kind === 'bullet' ? '- ' : '1. ';
      blocks.push({ text: `${indent}${mark}${withBreaks(text, `${indent}${' '.repeat(mark.length)}`)}`, item: true });
    } else {
      const text = inline(para.runs);
      if (text) blocks.push({ text: withBreaks(text), item: false });
    }
  }
  let out = '';
  blocks.forEach((block, i) => {
    if (i) out += block.item && blocks[i - 1].item ? '\n' : '\n\n';
    out += block.text;
  });
  return out ? `${out}\n` : '';
}
