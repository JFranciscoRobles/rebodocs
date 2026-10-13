// The outline of a document: its titles and headings, and the sections they
// open. A section is a heading and everything down to the next heading of
// its level or above; moving a heading moves its section.

import { type Doc, plainText } from './model';
import { paragraphStyles } from './styles';

export interface OutlineItem {
  /** Index of the paragraph of the heading. */
  para: number;
  /** 0 for a title, then the level of the heading from 1. */
  level: number;
  text: string;
}

/** The titles and headings of the document that have text, in order. Those inside tables are not part of it. */
export function outline(doc: Doc): OutlineItem[] {
  const levels = new Map<string, number>();
  for (const style of paragraphStyles(doc)) {
    if (style.outlineLevel) levels.set(style.id, style.outlineLevel);
    else if (style.wordName?.toLowerCase() === 'title') levels.set(style.id, 0);
  }
  const out: OutlineItem[] = [];
  doc.paragraphs.forEach((p, para) => {
    const level = levels.get(p.props.styleId ?? '');
    if (level === undefined || p.cell) return;
    const text = plainText(p.runs).replace(/\s+/g, ' ').trim();
    if (text) out.push({ para, level, text });
  });
  return out;
}

/** The paragraph after the last one of the section the heading at `para` opens. */
export function sectionEnd(doc: Doc, para: number): number {
  const items = outline(doc);
  const own = items.find((item) => item.para === para);
  if (!own) return para + 1;
  return items.find((item) => item.para > para && item.level <= own.level)?.para ?? doc.paragraphs.length;
}

/** The heading whose section the paragraph is in, as an index into `outline(doc)`; -1 before the first one. */
export function sectionAt(doc: Doc, para: number): number {
  const items = outline(doc);
  let index = -1;
  items.forEach((item, i) => {
    if (item.para <= para) index = i;
  });
  return index;
}

/**
 * Moves the section the heading at `from` opens to just before the paragraph
 * `before`, or to the end of the document when that is not given. Returns
 * the document and where the heading is now.
 */
export function moveSection(doc: Doc, from: number, before?: number): { doc: Doc; para: number } {
  const end = sectionEnd(doc, from);
  const to = before ?? doc.paragraphs.length;
  // Onto itself, or into the middle of a table: nothing to do.
  if ((to >= from && to <= end) || doc.paragraphs[to]?.cell) return { doc, para: from };
  const section = doc.paragraphs.slice(from, end);
  const rest = [...doc.paragraphs.slice(0, from), ...doc.paragraphs.slice(end)];
  const at = to > from ? to - section.length : to;
  rest.splice(at, 0, ...section);
  return { doc: { ...doc, paragraphs: rest }, para: at };
}
