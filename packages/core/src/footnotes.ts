// Notes at the foot of the page, and at the end of the document. As in Word,
// a note is named by its id from a run of the text, its reference, which
// shows its number; the note itself is a story of its own whose text starts
// with a mark that shows the same number. Notes of each kind are numbered in
// the order their references come in the text: those at the foot 1, 2, 3,
// those at the end i, ii, iii unless the document says otherwise.

import { type Doc, type Footnote, type NoteNumbering, type Paragraph, type Section, type Position, type RunProps, type Story, ANCHOR_CHAR, defined, resolveRun } from './model';
import { escapeXml } from './docx/xml';
import { formatNumber } from './numbering';
import { insertText, propsAt } from './ops';
import { paragraphStyles } from './styles';

/** The two kinds of note: at the foot of the page its reference is on, and at the end of the document. */
export type NoteKind = 'footnote' | 'endnote';

/** What is a note's of each kind in the file and in the document. */
const KINDS = {
  footnote: { reference: /<w:footnoteReference\b[^>]*?\bw:id="(-?\d+)"/, mark: /<w:footnoteRef\s*\/>/, tag: 'footnote', field: 'footnotes', style: ['footnote text', 'FootnoteText'] },
  endnote: { reference: /<w:endnoteReference\b[^>]*?\bw:id="(-?\d+)"/, mark: /<w:endnoteRef\s*\/>/, tag: 'endnote', field: 'endnotes', style: ['endnote text', 'EndnoteText'] },
} as const;

type WithNotes = Pick<Doc, 'paragraphs' | 'footnotes' | 'endnotes'>;
const notesOf = (doc: Pick<Doc, 'footnotes' | 'endnotes'>, kind: NoteKind): Footnote[] | undefined => (kind === 'footnote' ? doc.footnotes : doc.endnotes);

/** The id of the note a run's object refers to, when it is the reference to one of `kind`. */
export function noteReferenceId(xml: string | undefined, kind: NoteKind): string | undefined {
  return xml ? KINDS[kind].reference.exec(xml)?.[1] : undefined;
}

/** Whether a run's object is the mark at the start of a note's own text, which shows its number. */
export function isNoteMark(xml: string | undefined, kind: NoteKind): boolean {
  return !!xml && KINDS[kind].mark.test(xml) && !KINDS[kind].reference.test(xml);
}

/** The id of the note at the foot of the page a run's object refers to, when it is the reference to one. */
export const footnoteReferenceId = (xml: string | undefined): string | undefined => noteReferenceId(xml, 'footnote');
/** The id of the note at the end a run's object refers to, when it is the reference to one. */
export const endnoteReferenceId = (xml: string | undefined): string | undefined => noteReferenceId(xml, 'endnote');
export const isFootnoteMark = (xml: string | undefined): boolean => isNoteMark(xml, 'footnote');
export const isEndnoteMark = (xml: string | undefined): boolean => isNoteMark(xml, 'endnote');

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
export const noteReferenceXml = (kind: NoteKind, id: string, like: RunProps = {}) => `<w:r>${raised(like)}<w:${KINDS[kind].tag}Reference w:id="${escapeXml(id)}"/></w:r>`;
/** The XML of the mark a note's text starts with. */
export const noteMarkXml = (kind: NoteKind, like: RunProps = {}) => `<w:r>${raised(like)}<w:${KINDS[kind].tag}Ref/></w:r>`;
export const footnoteReferenceXml = (id: string, like: RunProps = {}) => noteReferenceXml('footnote', id, like);
export const footnoteMarkXml = (like: RunProps = {}) => noteMarkXml('footnote', like);

/** The references to notes of `kind` in the text, in order: the paragraph and the offset of each, and the note it names. */
export function noteReferences(doc: Pick<Doc, 'paragraphs'>, kind: NoteKind): { id: string; para: number; offset: number }[] {
  const out: { id: string; para: number; offset: number }[] = [];
  doc.paragraphs.forEach((p, para) => {
    let offset = 0;
    for (const run of p.runs) {
      const id = noteReferenceId(run.props.object, kind);
      if (id !== undefined) for (let k = 0; k < run.text.length; k++) out.push({ id, para, offset: offset + k });
      offset += run.text.length;
    }
  });
  return out;
}

/** The number each note of `kind` shows, by its id: the order its first reference comes in the text, from 1. */
export function noteNumbers(doc: WithNotes, kind: NoteKind): Map<string, number> {
  const numbers = new Map<string, number>();
  const notes = notesOf(doc, kind);
  if (!notes?.length) return numbers;
  const known = new Set(notes.map((note) => note.id));
  for (const { id } of noteReferences(doc, kind)) if (known.has(id) && !numbers.has(id)) numbers.set(id, numbers.size + 1);
  return numbers;
}

/** The notes of `kind` that are shown: those a reference names, in the order of their numbers. */
export function shownNotes(doc: WithNotes, kind: NoteKind): Footnote[] {
  const numbers = noteNumbers(doc, kind);
  return (notesOf(doc, kind) ?? []).filter((note) => numbers.has(note.id)).sort((a, b) => numbers.get(a.id)! - numbers.get(b.id)!);
}

/**
 * What each note of `kind` shows as its number, by its id: 1, 2, 3 at the
 * foot of the page and i, ii, iii at the end, or as the section its first
 * reference is in says. Measured against Word: a section that starts its
 * count again counts from its start, in the section or on each page; one that
 * does not goes on with the count of the document, moved on by its start less
 * one. `pageOf` says the page a reference is on, for a count that starts again
 * on each; without it, such a count goes on through its section.
 */
export function noteLabels(doc: WithNotes & Pick<Doc, 'endnoteNumbering' | 'footnoteNumbering'>, kind: NoteKind, pageOf?: (para: number, offset: number) => number | undefined): Map<string, string> {
  const numbers = noteNumbers(doc, kind);
  const labels = new Map<string, string>();
  const own = (section: Section | undefined) => (kind === 'footnote' ? section?.footnoteNumbering : section?.endnoteNumbering);
  /** The index of the section each paragraph is in, and how each numbers its notes: the last is the document's. */
  const numbering: (NoteNumbering | undefined)[] = [];
  const sectionOf: number[] = [];
  doc.paragraphs.forEach((p, i) => {
    sectionOf.push(numbering.length);
    if (p.section && !p.cell && i < doc.paragraphs.length - 1) numbering.push(own(p.section));
  });
  numbering.push(kind === 'footnote' ? doc.footnoteNumbering : doc.endnoteNumbering);
  let counting = '';
  let count = 0;
  for (const { id, para, offset } of noteReferences(doc, kind)) {
    const n = numbers.get(id);
    if (n === undefined || labels.has(id)) continue;
    const said = numbering[sectionOf[para]];
    // What the count starts again at: the section, and the page when it says so and the page is known.
    const page = said?.restart === 'page' ? pageOf?.(para, offset) : undefined;
    const at = `${sectionOf[para]}:${page ?? ''}`;
    if (at !== counting) [counting, count] = [at, 0];
    count++;
    const start = said?.start ?? 1;
    labels.set(id, formatNumber(said?.format ?? (kind === 'footnote' ? 'decimal' : 'lowerRoman'), said?.restart ? start + count - 1 : start - 1 + n));
  }
  return labels;
}

export const footnoteReferences = (doc: Pick<Doc, 'paragraphs'>) => noteReferences(doc, 'footnote');
export const endnoteReferences = (doc: Pick<Doc, 'paragraphs'>) => noteReferences(doc, 'endnote');
export const footnoteNumbers = (doc: Pick<Doc, 'paragraphs' | 'footnotes'>): Map<string, number> => noteNumbers(doc, 'footnote');
export const endnoteNumbers = (doc: Pick<Doc, 'paragraphs' | 'endnotes'>): Map<string, number> => noteNumbers(doc, 'endnote');
export const shownFootnotes = (doc: Pick<Doc, 'paragraphs' | 'footnotes'>): Footnote[] => shownNotes(doc, 'footnote');
export const shownEndnotes = (doc: Pick<Doc, 'paragraphs' | 'endnotes'>): Footnote[] => shownNotes(doc, 'endnote');

export function footnoteOf(doc: Pick<Doc, 'footnotes'>, id: string): Footnote | undefined {
  return doc.footnotes?.find((note) => note.id === id);
}
export function endnoteOf(doc: Pick<Doc, 'endnotes'>, id: string): Footnote | undefined {
  return doc.endnotes?.find((note) => note.id === id);
}

/** The document with the text of note `id` of `kind` replaced by `story`, or with a note of that id that has it when it had none. */
export function withNote<T extends Pick<Doc, 'footnotes' | 'endnotes'>>(doc: T, id: string, story: Story, kind: NoteKind): T {
  const made = defined<Footnote>({ id, paragraphs: story.paragraphs, tables: story.tables });
  const notes = notesOf(doc, kind) ?? [];
  const had = notes.some((note) => note.id === id);
  const next = had ? notes.map((note) => (note.id === id ? made : note)) : [...notes, made];
  return { ...doc, [KINDS[kind].field]: next };
}
export const withFootnote = <T extends Pick<Doc, 'footnotes'>>(doc: T, id: string, story: Story): T => withNote(doc as T & Pick<Doc, 'endnotes'>, id, story, 'footnote');
export const withEndnote = <T extends Pick<Doc, 'endnotes'>>(doc: T, id: string, story: Story): T => withNote(doc as T & Pick<Doc, 'footnotes'>, id, story, 'endnote');

/** The look a new note's text has: the document's style for it when it has one, ten points otherwise. */
function noteParagraph(doc: Doc, text: string, like: RunProps, kind: NoteKind): Paragraph {
  const [word, id] = KINDS[kind].style;
  const style = paragraphStyles(doc).find((s) => s.wordName?.toLowerCase() === word || s.id === id);
  const run: RunProps = defined({ fontFamily: like.fontFamily, ...(style ? style.run : { fontSize: 10 }) });
  return {
    props: style ? defined({ ...style.paragraph, styleId: style.id }) : { spacingBefore: 0, spacingAfter: 0, lineHeight: 1 },
    runs: [
      { text: ANCHOR_CHAR, props: { ...run, object: noteMarkXml(kind, run), anchor: true } },
      { text: ` ${text}`, props: run },
    ],
  };
}

/**
 * Puts a note of `kind` at `pos`: its reference goes there, and the note
 * starts with `text`. Returns where the caret goes, after the reference, and
 * the id of the note. Ids are counted apart for each kind, as Word does.
 */
export function insertNote(doc: Doc, pos: Position, text: string, kind: NoteKind): { doc: Doc; pos: Position; id: string } {
  const notes = notesOf(doc, kind) ?? [];
  const ids = notes.map((note) => Number(note.id)).filter(Number.isFinite);
  const id = String(Math.max(0, ...ids) + 1);
  const like = propsAt(doc, pos);
  const { opaque: _, wrap: __, object: ___, anchor: ____, ...plain } = like;
  const inserted = insertText(doc, pos, ANCHOR_CHAR, { ...plain, object: noteReferenceXml(kind, id, resolveRun(plain)), anchor: true });
  const note: Footnote = { id, paragraphs: [noteParagraph(doc, text, plain, kind)] };
  return { doc: { ...inserted.doc, [KINDS[kind].field]: [...notes, note] }, pos: inserted.pos, id };
}

/** Puts a note at the foot of the page at `pos`. See `insertNote`. */
export const insertFootnote = (doc: Doc, pos: Position, text = ''): { doc: Doc; pos: Position; id: string } => insertNote(doc, pos, text, 'footnote');
/** Puts a note at the end of the document at `pos`. See `insertNote`. */
export const insertEndnote = (doc: Doc, pos: Position, text = ''): { doc: Doc; pos: Position; id: string } => insertNote(doc, pos, text, 'endnote');
