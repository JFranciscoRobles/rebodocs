// Formatting as one types, in the manner of Markdown: "# " starts a heading,
// "- " a list, and **text** becomes bold; and an address that was typed
// becomes a link, as in Word. Each is a change of its own, made
// after the character that completes it was typed, so undoing it leaves what
// was typed.

import type { Doc, Paragraph, Position } from './model';
import { applyRunProps, deleteRange, listKindAt, toggleList } from './ops';
import { cleanHref, linkAt, setLink } from './links';
import { paragraphStyles, setParagraphStyle } from './styles';

const textBefore = (p: Paragraph, offset: number) =>
  p.runs
    .map((run) => run.text)
    .join('')
    .slice(0, offset);

/** Marks around text and what they turn it into: the longer ones first, so ** is not taken for two *. */
const INLINE: [RegExp, 'bold' | 'italic' | 'strike'][] = [
  [/\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, 'bold'],
  [/~~([^~\s](?:[^~]*[^~\s])?)~~$/, 'strike'],
  [/(?<!\*)\*([^*\s](?:[^*]*[^*\s])?)\*$/, 'italic'],
];

/** An address as it is typed: of the web, with its scheme or its www, or of mail. What may end a sentence after it is not part of it. */
const ADDRESS = /(?:^|[\s(«“"'])((?:https?:\/\/|www\.)[^\s<>"]*[^\s<>"'.,;:!?)\]»”]|[^\s@<>"(]+@[^\s@<>"]+\.[^\s@<>"'.,;:!?)\]»”]+)[.,;:!?)\]»”'"]* $/;

/** The address just typed before the space at `pos`, made a link. */
function autolink(doc: Doc, pos: Position, before: string): { doc: Doc; pos: Position } | undefined {
  const found = ADDRESS.exec(before)?.[1];
  const href = found && cleanHref(found);
  if (!found || !href) return undefined;
  // Counted from the space back: what may follow the address, a full stop for one, is between them.
  const from = before.lastIndexOf(found);
  const range = { from: { para: pos.para, offset: from }, to: { para: pos.para, offset: from + found.length } };
  // One that is a link already is left as it is.
  if (linkAt(doc, { para: pos.para, offset: from + 1 })) return undefined;
  return { doc: setLink(doc, range, href), pos };
}

/**
 * What typing `typed`, which is now just before `pos`, turns into. Undefined
 * when it is nothing but the character.
 */
export function autoformat(doc: Doc, pos: Position, typed: string): { doc: Doc; pos: Position; mark?: 'bold' | 'italic' | 'strike' } | undefined {
  const p = doc.paragraphs[pos.para];
  const before = textBefore(p, pos.offset);
  const start = { para: pos.para, offset: 0 };

  if (typed === ' ') {
    // At the start of a paragraph: a heading or a list. The marks go, the paragraph changes.
    const heading = /^(#{1,3}) $/.exec(before);
    const bullet = /^[-*] $/.test(before);
    const number = /^1[.)] $/.test(before);
    if (!heading && !bullet && !number) return autolink(doc, pos, before);
    const cleared = deleteRange(doc, { from: start, to: pos });
    if (heading) {
      const style = paragraphStyles(doc).find((s) => s.outlineLevel === heading[1].length);
      return style && { doc: setParagraphStyle(cleared, pos.para, pos.para, style.id), pos: start };
    }
    const kind = bullet ? 'bullet' : 'number';
    if (listKindAt(doc, pos.para) === kind) return undefined;
    return { doc: toggleList(cleared, pos.para, pos.para, kind), pos: start };
  }

  if (typed === '*' || typed === '~') {
    for (const [pattern, mark] of INLINE) {
      const match = pattern.exec(before);
      if (!match) continue;
      const width = (match[0].length - match[1].length) / 2;
      const from = pos.offset - match[0].length;
      // The closing marks go first, then the opening ones; what is left between them takes the format.
      let next = deleteRange(doc, { from: { para: pos.para, offset: pos.offset - width }, to: pos });
      next = deleteRange(next, { from: { para: pos.para, offset: from }, to: { para: pos.para, offset: from + width } });
      const end = { para: pos.para, offset: from + match[1].length };
      // `mark` tells which format was given, so that what is typed next does not carry it on.
      return { doc: applyRunProps(next, { from: { para: pos.para, offset: from }, to: end }, { [mark]: true }), pos: end, mark };
    }
  }
  return undefined;
}
