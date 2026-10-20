// Sections: stretches of a document set out in their own way, here in columns.
// As in Word, the paragraph that ends a section says how it is set out; the
// last section's own are the document's.

import {
  type Columns,
  type Doc,
  type PageSetup,
  type Paragraph,
  type Position,
  type Range,
  type Section,
  type SectionStart,
  ANCHOR_CHAR,
  ONE_COLUMN,
  defined,
  orderedRange,
} from './model';
import { insertText, propsAt, splitParagraph } from './ops';
import { COLUMN_BREAK_XML } from './layout';

/** The most columns a section may be set in. */
export const MAX_COLUMNS = 6;

/** Whether a paragraph's mark can end a section: not one inside a table, nor the last of the document, whose section is the document's. */
function canEnd(doc: Doc, i: number): boolean {
  return i >= 0 && i < doc.paragraphs.length - 1 && !doc.paragraphs[i].cell;
}

/** The paragraph that ends the section paragraph `para` is in, or -1 when that is the last section, the document's own. */
export function sectionMarkOf(doc: Doc, para: number): number {
  for (let i = Math.max(0, para); i < doc.paragraphs.length - 1; i++) if (doc.paragraphs[i].section && canEnd(doc, i)) return i;
  return -1;
}

/** How the section paragraph `para` is in is set out. */
export function sectionOf(doc: Doc, para: number): Section {
  const end = sectionMarkOf(doc, para);
  if (end >= 0) return doc.paragraphs[end].section!;
  return defined<Section>({ page: doc.page, columns: doc.columns, start: doc.sectionStart, noHeader: doc.noHeader, noFooter: doc.noFooter, firstPage: doc.firstPage });
}

/** The index of the section paragraph `para` is in, counting from 0: the last is the document's own. */
export function sectionIndexOf(doc: Doc, para: number): number {
  let k = 0;
  for (let i = 0; i < Math.min(para, doc.paragraphs.length - 1); i++) if (doc.paragraphs[i].section && canEnd(doc, i)) k++;
  return k;
}

/** The paragraph that ends section `index`, or -1 for the last. */
function markOfSection(doc: Doc, index: number): number {
  return sectionMarks(doc)[index] ?? -1;
}

/** The page of the section paragraph `para` is in. */
export function pageAt(doc: Doc, para: number): PageSetup {
  return sectionOf(doc, para).page;
}

/** The document with the page of the section paragraph `para` is in changed by `patch`: its size, its margins. */
export function setSectionPage(doc: Doc, para: number, patch: Partial<PageSetup>): Doc {
  const end = sectionMarkOf(doc, para);
  const was = end < 0 ? doc.page : doc.paragraphs[end].section!.page;
  const page = { ...was, ...patch };
  if ((Object.keys(page) as (keyof PageSetup)[]).every((key) => page[key] === was[key])) return doc;
  return end < 0 ? { ...doc, page } : patchSection(doc, end, { page });
}

/** Whether section `index` has a header and a footer of its own, and does not show the document's. The last one's are the document's. */
export function hasOwnStories(doc: Doc, index: number): boolean {
  const end = markOfSection(doc, index);
  if (end < 0) return true;
  const s = doc.paragraphs[end].section!;
  return !!(s.header || s.footer || s.noHeader || s.noFooter);
}

/**
 * Gives section `index` a header and a footer of its own, starting as copies
 * of the ones it shows; or takes them away, and it shows the document's.
 */
export function setOwnStories(doc: Doc, index: number, own: boolean): Doc {
  const end = markOfSection(doc, index);
  if (end < 0 || own === hasOwnStories(doc, index)) return doc;
  const { header: _h, footer: _f, noHeader: _nh, noFooter: _nf, ...rest } = doc.paragraphs[end].section!;
  const section = own ? defined<Section>({ ...rest, header: doc.header ?? { paragraphs: [] }, footer: doc.footer ?? { paragraphs: [] } }) : rest;
  const paragraphs = doc.paragraphs.slice();
  paragraphs[end] = { ...paragraphs[end], section };
  return { ...doc, paragraphs };
}

/** Whether the first page of section `index` has a header and a footer to itself. */
export function hasOwnFirstPage(doc: Doc, index: number): boolean {
  const end = markOfSection(doc, index);
  return !!(end < 0 ? doc.firstPage : doc.paragraphs[end].section!.firstPage);
}

/** Gives the first page of section `index` a header and a footer to itself, which start empty, or takes them away. */
export function setOwnFirstPage(doc: Doc, index: number, on: boolean): Doc {
  if (on === hasOwnFirstPage(doc, index)) return doc;
  const end = markOfSection(doc, index);
  if (end < 0) {
    const { firstPage: _, ...rest } = doc;
    return on ? { ...rest, firstPage: {} } : rest;
  }
  const { firstPage: _, ...rest } = doc.paragraphs[end].section!;
  const paragraphs = doc.paragraphs.slice();
  paragraphs[end] = { ...paragraphs[end], section: on ? { ...rest, firstPage: {} } : rest };
  return { ...doc, paragraphs };
}

/** The columns of the section paragraph `para` is in: one when it runs the whole width. */
export function columnsAt(doc: Doc, para: number): Columns {
  return sectionOf(doc, para).columns ?? ONE_COLUMN;
}

/** How many sections the document has. */
export function sectionCount(doc: Doc): number {
  let n = 1;
  for (let i = 0; i < doc.paragraphs.length - 1; i++) if (doc.paragraphs[i].section && canEnd(doc, i)) n++;
  return n;
}

/** Columns as the model keeps them: none for one, and no more than there can be. */
function normalized(columns: Columns): Columns | undefined {
  const count = Math.max(1, Math.min(MAX_COLUMNS, Math.round(columns.widths?.length || columns.count)));
  if (count < 2) return undefined;
  return defined<Columns>({
    count,
    space: Math.max(0, columns.space),
    widths: columns.widths?.length === count ? columns.widths : undefined,
    separator: columns.separator || undefined,
  });
}

/** The document with the section that paragraph `end` ends (-1 for the last) changed by `patch`. */
function patchSection(doc: Doc, end: number, patch: Partial<Section>): Doc {
  if (end < 0) {
    const next = { ...doc };
    if ('columns' in patch) next.columns = patch.columns;
    if ('start' in patch) next.sectionStart = patch.start === 'nextPage' ? undefined : patch.start;
    return defined(next);
  }
  const paragraphs = doc.paragraphs.slice();
  const p = paragraphs[end];
  const section = defined<Section>({ ...p.section!, ...patch });
  if (section.start === 'nextPage') delete section.start;
  paragraphs[end] = { ...p, section };
  return { ...doc, paragraphs };
}

/** The document with a section ending at paragraph `i`, set out as `section` is. */
function endSectionAt(doc: Doc, i: number, section: Section): Doc {
  const paragraphs = doc.paragraphs.slice();
  paragraphs[i] = { ...paragraphs[i], section: defined<Section>({ ...section }) };
  return { ...doc, paragraphs };
}

/** The first paragraph of the section that paragraph `end` ends (-1 for the last). */
function sectionStartOf(doc: Doc, end: number): number {
  const last = end < 0 ? doc.paragraphs.length - 1 : end;
  let i = last - 1;
  while (i >= 0 && !(doc.paragraphs[i].section && canEnd(doc, i))) i--;
  return i + 1;
}

/**
 * Sets the columns of the text. With nothing selected, of the whole section
 * the caret is in; with a selection, of its paragraphs alone, which become a
 * section of their own, between section breaks that keep the text before and
 * after it on the same page, as Word does. A selection that goes into a table
 * takes all of it: a section does not end inside one.
 */
export function setColumns(doc: Doc, range: Range, columns: Columns): Doc {
  const want = normalized(columns);
  let { from, to } = orderedRange(range.from, range.to);
  if (from.para === to.para && from.offset === to.offset) return patchSection(doc, sectionMarkOf(doc, from.para), { columns: want });

  const n = doc.paragraphs.length;
  let first = from.para;
  let last = to.para;
  // A table is taken whole: the section starts before it and ends at the paragraph after it.
  while (first > 0 && doc.paragraphs[first].cell) first--;
  if (doc.paragraphs[first].cell) first = 0;
  else if (first !== from.para) first++;
  while (last < n - 1 && doc.paragraphs[last].cell) last++;

  let out = doc;
  // What comes before the selection in its section stays as it was, in a section of its own.
  const head = sectionMarkOf(out, first);
  if (first > sectionStartOf(out, head) && canEnd(out, first - 1)) {
    out = endSectionAt(out, first - 1, sectionOf(out, first));
    out = patchSection(out, sectionMarkOf(out, first), { start: 'continuous' });
  }
  // And so does what comes after it.
  const tail = sectionMarkOf(out, last);
  if (tail !== last && last < n - 1 && canEnd(out, last)) {
    out = endSectionAt(out, last, sectionOf(out, last));
    out = patchSection(out, sectionMarkOf(out, last + 1), { start: 'continuous' });
  }
  // Every section of the selection takes the columns.
  for (let i = first; i <= last; ) {
    const end = sectionMarkOf(out, i);
    out = patchSection(out, end, { columns: want });
    if (end < 0 || end >= last) break;
    i = end + 1;
  }
  return out;
}

/** Puts a column break at the caret: what follows goes on at the top of the next column, or of the next page after the last. */
export function insertColumnBreak(doc: Doc, pos: Position): { doc: Doc; pos: Position } {
  if (doc.paragraphs[pos.para]?.cell) return { doc, pos };
  return insertText(doc, pos, ANCHOR_CHAR, { ...propsAt(doc, pos), object: COLUMN_BREAK_XML, anchor: true });
}

/**
 * Puts a section break at the caret, as Word's: the paragraph is split, and
 * what comes before it becomes a section of its own, set out as the one it was
 * in, with the same header and footer. What follows starts on the next page or,
 * `continuous`, on the same one, and can then be given another page, other
 * margins or columns. Not inside a table: a section does not end in one.
 */
export function insertSectionBreak(doc: Doc, pos: Position, start: SectionStart = 'nextPage'): { doc: Doc; pos: Position } {
  if (doc.paragraphs[pos.para]?.cell) return { doc, pos };
  // What the file said of the section is the later part's to write back; the new one starts from what it shows.
  const { xml: _, ...was } = sectionOf(doc, pos.para);
  const split = splitParagraph(doc, pos);
  let out = endSectionAt(split.doc, pos.para, was);
  out = patchSection(out, sectionMarkOf(out, split.pos.para), { start });
  return { doc: out, pos: split.pos };
}

/** The paragraphs that end a section, by index: the marks the document has. */
export function sectionMarks(doc: Doc): number[] {
  const marks: number[] = [];
  doc.paragraphs.forEach((p: Paragraph, i) => {
    if (p.section && canEnd(doc, i)) marks.push(i);
  });
  return marks;
}
