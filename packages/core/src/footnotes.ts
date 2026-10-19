// Notes at the foot of the page. As in Word, a note is named by its id from a
// run of the text, its reference, which shows its number; the note itself is
// a story of its own whose text starts with a mark that shows the same number.
// Notes are numbered in the order their references come in the text.

import { type Doc, type Footnote, type Paragraph, type Position, type RunProps, type Story, ANCHOR_CHAR, defined, resolveRun } from './model';
import { escapeXml } from './docx/xml';
import { insertText, propsAt } from './ops';
import { paragraphStyles } from './styles';

const REFERENCE = /<w:footnoteReference\b[^>]*?\bw:id="(-?\d+)"/;
const MARK = /<w:footnoteRef\s*\/>/;

/** The id of the note a run's object refers to, when it is the reference to one. */
export function footnoteReferenceId(xml: string | undefined): string | undefined {
  return xml ? REFERENCE.exec(xml)?.[1] : undefined;
}

/** Whether a run's object is the mark at the start of a note's own text, which shows its number. */
export function isFootnoteMark(xml: string | undefined): boolean {
  return !!xml && MARK.test(xml) && !REFERENCE.test(xml);
}

/** The properties of a raised number in the font and at the size of the text it goes with. */
function raised(like: RunProps): string {
  const font = like.fontFamily ? escapeXml(like.fontFamily) : '';
  const size = like.fontSize ? Math.round(like.fontSize * 2) : 0;
  return (
    '<w:rPr>' +
    (font ? `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` : '') +
    (size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : '') +
    '<w:vertAlign w:val="superscript"/></w:rPr>'
  );
}

/** The XML of the reference to note `id`, raised as Word raises it, in the font of the text around it. */
export const footnoteReferenceXml = (id: string, like: RunProps = {}) => `<w:r>${raised(like)}<w:footnoteReference w:id="${escapeXml(id)}"/></w:r>`;

/** The XML of the mark a note's text starts with. */
export const footnoteMarkXml = (like: RunProps = {}) => `<w:r>${raised(like)}<w:footnoteRef/></w:r>`;

/** The references of the text, in order: the paragraph and the offset of each, and the note it names. */
export function footnoteReferences(doc: Pick<Doc, 'paragraphs'>): { id: string; para: number; offset: number }[] {
  const out: { id: string; para: number; offset: number }[] = [];
  doc.paragraphs.forEach((p, para) => {
    let offset = 0;
    for (const run of p.runs) {
      const id = footnoteReferenceId(run.props.object);
      if (id !== undefined) for (let k = 0; k < run.text.length; k++) out.push({ id, para, offset: offset + k });
      offset += run.text.length;
    }
  });
  return out;
}

/** The number each note shows, by its id: the order its first reference comes in the text, from 1. */
export function footnoteNumbers(doc: Pick<Doc, 'paragraphs' | 'footnotes'>): Map<string, number> {
  const numbers = new Map<string, number>();
  if (!doc.footnotes?.length) return numbers;
  const known = new Set(doc.footnotes.map((note) => note.id));
  for (const { id } of footnoteReferences(doc)) if (known.has(id) && !numbers.has(id)) numbers.set(id, numbers.size + 1);
  return numbers;
}

/** The notes that are shown: those a reference names, in the order of their numbers. */
export function shownFootnotes(doc: Pick<Doc, 'paragraphs' | 'footnotes'>): Footnote[] {
  const numbers = footnoteNumbers(doc);
  return (doc.footnotes ?? []).filter((note) => numbers.has(note.id)).sort((a, b) => numbers.get(a.id)! - numbers.get(b.id)!);
}

export function footnoteOf(doc: Pick<Doc, 'footnotes'>, id: string): Footnote | undefined {
  return doc.footnotes?.find((note) => note.id === id);
}

/** The document with the text of note `id` replaced by `story`, or with a note of that id that has it when it had none. */
export function withFootnote<T extends Pick<Doc, 'footnotes'>>(doc: T, id: string, story: Story): T {
  const made = defined<Footnote>({ id, paragraphs: story.paragraphs, tables: story.tables });
  const had = (doc.footnotes ?? []).some((note) => note.id === id);
  const footnotes = had ? doc.footnotes!.map((note) => (note.id === id ? made : note)) : [...(doc.footnotes ?? []), made];
  return { ...doc, footnotes };
}

/** The look a new note's text has: the document's style for it when it has one, ten points otherwise. */
function noteParagraph(doc: Doc, text: string, like: RunProps): Paragraph {
  const style = paragraphStyles(doc).find((s) => s.wordName?.toLowerCase() === 'footnote text' || s.id === 'FootnoteText');
  const run: RunProps = defined({ fontFamily: like.fontFamily, ...(style ? style.run : { fontSize: 10 }) });
  return {
    props: style ? defined({ ...style.paragraph, styleId: style.id }) : { spacingBefore: 0, spacingAfter: 0, lineHeight: 1 },
    runs: [
      { text: ANCHOR_CHAR, props: { ...run, object: footnoteMarkXml(run), anchor: true } },
      { text: ` ${text}`, props: run },
    ],
  };
}

/**
 * Puts a note at the foot of the page at `pos`: its reference goes there, and
 * the note starts with `text`. Returns where the caret goes, after the reference,
 * and the id of the note.
 */
export function insertFootnote(doc: Doc, pos: Position, text = ''): { doc: Doc; pos: Position; id: string } {
  const ids = (doc.footnotes ?? []).map((note) => Number(note.id)).filter(Number.isFinite);
  const id = String(Math.max(0, ...ids) + 1);
  const like = propsAt(doc, pos);
  const { opaque: _, wrap: __, object: ___, anchor: ____, ...plain } = like;
  const inserted = insertText(doc, pos, ANCHOR_CHAR, { ...plain, object: footnoteReferenceXml(id, resolveRun(plain)), anchor: true });
  const note: Footnote = { id, paragraphs: [noteParagraph(doc, text, plain)] };
  return { doc: { ...inserted.doc, footnotes: [...(doc.footnotes ?? []), note] }, pos: inserted.pos, id };
}
