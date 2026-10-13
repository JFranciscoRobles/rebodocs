// Finding text and replacing it. A match lies inside one paragraph; the marks
// a paragraph carries that take no room (bookmarks, the marks of a field) do
// not get in its way.

import { type Doc, type Position, type Range, defined } from './model';
import { deleteRange, insertText, propsAt } from './ops';

export interface FindOptions {
  /** Capital and small letters count as different. */
  matchCase?: boolean;
  /** Only matches that are not part of a longer word. */
  wholeWord?: boolean;
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** Every place `query` is found, in the order of the document. */
export function findAll(doc: Doc, query: string, options: FindOptions = {}): Range[] {
  const out: Range[] = [];
  if (!query) return out;
  const fold = (text: string) => (options.matchCase ? text : text.toLowerCase());
  const needle = fold(query);
  doc.paragraphs.forEach((p, para) => {
    // The text that shows, and where in the paragraph each of its characters is.
    let text = '';
    const at: number[] = [];
    let offset = 0;
    for (const run of p.runs) {
      if (!run.props.object) {
        for (let i = 0; i < run.text.length; i++) at.push(offset + i);
        text += run.text;
      }
      offset += run.text.length;
    }
    const hay = fold(text);
    // Folding case can change the length of a few letters; then offsets cannot be trusted.
    if (hay.length !== text.length || needle.length !== query.length) return;
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) {
      const end = i + needle.length;
      if (options.wholeWord && ((i > 0 && WORD_CHAR.test(text[i - 1])) || (end < text.length && WORD_CHAR.test(text[end])))) continue;
      out.push({ from: { para, offset: at[i] }, to: { para, offset: at[end - 1] + 1 } });
    }
  });
  return out;
}

/** Puts `text` in place of `range`, in the formatting of what was there. Returns the position after it. */
export function replaceRange(doc: Doc, range: Range, text: string): { doc: Doc; pos: Position } {
  const inside = { para: range.from.para, offset: range.from.offset + 1 };
  const props = defined({ ...propsAt(doc, inside), field: undefined, object: undefined, anchor: undefined, objectWidth: undefined, objectHeight: undefined });
  const cleared = deleteRange(doc, range);
  return insertText(cleared, range.from, text.replace(/[\r\n\f]+/g, ' '), props);
}

/** Replaces every match of `query`. */
export function replaceAll(doc: Doc, query: string, text: string, options: FindOptions = {}): { doc: Doc; count: number } {
  const matches = findAll(doc, query, options);
  let next = doc;
  // From the last one back, so the ones still to do keep their place.
  for (let i = matches.length - 1; i >= 0; i--) next = replaceRange(next, matches[i], text).doc;
  return { doc: next, count: matches.length };
}
