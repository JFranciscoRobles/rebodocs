// Notes on stretches of the text: what Word calls comments. A note is kept
// apart from the text, which only holds two marks that take no room, one
// where the stretch starts and one where it ends. The marks are the very XML
// Word writes for them, so they move with the text as it is edited, come back
// from a file as they went, and a note made here is a comment in Word.

import { type Doc, type Note, type Paragraph, type Position, type Range, ANCHOR_CHAR, defined } from './model';
import { insertText, propsAt, textInRange } from './ops';

/** What a mark of a note looks like, and the id of its note. */
const MARK = /<w:comment(RangeStart|RangeEnd|Reference)\b[^>]*?\bw:id="([^"]*)"/;

/** The note a mark belongs to, and which of its marks it is; undefined for any other object. */
export function noteMark(xml: string | undefined): { id: string; kind: 'start' | 'end' | 'reference' } | undefined {
  const match = xml && MARK.exec(xml);
  if (!match) return undefined;
  return { id: match[2], kind: match[1] === 'RangeStart' ? 'start' : match[1] === 'RangeEnd' ? 'end' : 'reference' };
}

const startXml = (id: string) => `<w:commentRangeStart w:id="${id}"/>`;
/** The end of the stretch and, after it, the reference Word hangs the balloon from. */
const endXml = (id: string) => `<w:commentRangeEnd w:id="${id}"/><w:r><w:commentReference w:id="${id}"/></w:r>`;

/** The colours a note can be marked with; the first is the one a note has when none is chosen. */
export const NOTE_COLORS = ['F4B400', '34A853', '4285F4', 'EA4335', 'A142F4', '80868B'];

/**
 * What a note is known by apart from its id, which Word changes when it
 * saves the file: who wrote it, when, and how it starts. Two notes by the
 * same person in the same second are told apart by what they say.
 */
export const noteKey = (note: Pick<Note, 'author' | 'date' | 'text'>) => `${note.date ?? ''}|${note.author}|${note.text.slice(0, 24).replace(/[=;\s]+/g, ' ')}`;

export interface NoteRange {
  id: string;
  /** The text the note is about: from after its first mark to before its last. */
  range: Range;
}

/** Where each note of the text is, in the order they start. A note with only one of its marks left is not there. */
export function noteRanges(doc: Pick<Doc, 'paragraphs'>): NoteRange[] {
  const starts = new Map<string, Position>();
  const out: NoteRange[] = [];
  const done = new Set<string>();
  doc.paragraphs.forEach((p, para) => {
    let offset = 0;
    for (const run of p.runs) {
      const mark = run.props.anchor ? noteMark(run.props.object) : undefined;
      if (mark?.kind === 'start' && !starts.has(mark.id)) starts.set(mark.id, { para, offset: offset + run.text.length });
      // A file may end a stretch with the reference alone.
      const from = mark && mark.kind !== 'start' ? starts.get(mark.id) : undefined;
      if (mark && from && !done.has(mark.id)) {
        done.add(mark.id);
        out.push({ id: mark.id, range: { from, to: { para, offset } } });
      }
      offset += run.text.length;
    }
  });
  return out.sort((a, b) => a.range.from.para - b.range.from.para || a.range.from.offset - b.range.from.offset);
}

const before = (a: Position, b: Position) => a.para < b.para || (a.para === b.para && a.offset <= b.offset);

/** The notes whose stretch holds `pos`, the shortest first. */
export function notesAt(doc: Pick<Doc, 'paragraphs'>, pos: Position): NoteRange[] {
  const size = ({ range }: NoteRange) => (range.to.para - range.from.para) * 1e6 + range.to.offset - range.from.offset;
  return noteRanges(doc)
    .filter(({ range }) => before(range.from, pos) && before(pos, range.to))
    .sort((a, b) => size(a) - size(b));
}

/** The text a note is about, in one line. */
export function noteExcerpt(doc: Doc, range: Range): string {
  return textInRange(doc, range)
    .replace(new RegExp(`[${ANCHOR_CHAR}￼]`, 'g'), '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Puts a note on the text of `range`. Returns the document and the id the
 * note was given; nothing changes for an empty range or an empty note.
 */
export function addNote(doc: Doc, range: Range, note: { text: string; author: string; date?: string; color?: string }): { doc: Doc; id?: string } {
  const text = note.text.trim();
  if (!text || before(range.to, range.from)) return { doc };
  const taken = new Set((doc.notes ?? []).map((n) => n.id));
  for (const p of doc.paragraphs) for (const run of p.runs) if (run.props.anchor) taken.add(noteMark(run.props.object)?.id ?? '');
  let n = 0;
  while (taken.has(String(n))) n++;
  const id = String(n);
  const mark = (at: Doc, pos: Position, xml: string) => {
    const like = propsAt(at, pos);
    return insertText(at, pos, ANCHOR_CHAR, defined({ fontFamily: like.fontFamily, fontSize: like.fontSize, object: xml, anchor: true })).doc;
  };
  // The end first, so the start does not move it.
  const marked = mark(mark(doc, range.to, endXml(id)), range.from, startXml(id));
  const made: Note = defined({ id, author: note.author.trim(), date: note.date, text, color: cleanColor(note.color) });
  return { doc: { ...marked, notes: [...(doc.notes ?? []), made] }, id };
}

/** Changes what a note says. An empty text leaves it as it was: a note is taken away with `removeNote`. */
export function setNoteText(doc: Doc, id: string, text: string): Doc {
  const next = text.trim();
  const note = doc.notes?.find((n) => n.id === id);
  if (!note || !next || note.text === next) return doc;
  // What the file said about it no longer holds: it is written anew.
  return { ...doc, notes: doc.notes!.map((n) => (n === note ? defined<Note>({ ...n, text: next, xml: undefined }) : n)) };
}

/** A colour as it is kept: six hex digits in capitals, and nothing for the usual one. */
function cleanColor(color: string | undefined): string | undefined {
  const hex = /^#?([0-9a-f]{6})$/i.exec(color ?? '')?.[1].toUpperCase();
  return hex && hex !== NOTE_COLORS[0] ? hex : undefined;
}

/** Changes the colour a note is marked with; '' gives it the usual one back. */
export function setNoteColor(doc: Doc, id: string, color: string): Doc {
  const note = doc.notes?.find((n) => n.id === id);
  const next = cleanColor(color);
  if (!note || note.color === next) return doc;
  return { ...doc, notes: doc.notes!.map((n) => (n === note ? defined<Note>({ ...n, color: next }) : n)) };
}

/** The paragraphs without the marks of the notes `gone` says are. */
function withoutMarks(paragraphs: Paragraph[], gone: (id: string) => boolean): Paragraph[] {
  let changed = false;
  const next = paragraphs.map((p) => {
    if (!p.runs.some((run) => run.props.anchor && gone(noteMark(run.props.object)?.id ?? '\0'))) return p;
    changed = true;
    const runs = p.runs.filter((run) => !(run.props.anchor && gone(noteMark(run.props.object)?.id ?? '\0')));
    // A paragraph is never left without a run.
    return { ...p, runs: runs.length ? runs : [{ text: '', props: defined({ ...p.runs[0].props, object: undefined, anchor: undefined }) }] };
  });
  return changed ? next : paragraphs;
}

/** Takes a note away, with its marks; the text it was about stays. */
export function removeNote(doc: Doc, id: string): Doc {
  const paragraphs = withoutMarks(doc.paragraphs, (other) => other === id);
  const notes = doc.notes?.filter((n) => n.id !== id);
  if (paragraphs === doc.paragraphs && notes?.length === doc.notes?.length) return doc;
  return defined<Doc>({ ...doc, paragraphs, notes: notes?.length ? notes : undefined });
}

/**
 * The document without what editing left of notes whose end was deleted with
 * the text around it: the mark of where they started, and the notes
 * themselves. A note is in the text for as long as its end or its reference
 * is, which is what Word asks of a comment. A file is written from this.
 */
export function pruneNotes(doc: Doc): Doc {
  const there = new Set<string>();
  for (const p of doc.paragraphs) {
    for (const run of p.runs) {
      const mark = run.props.anchor ? noteMark(run.props.object) : undefined;
      if (mark && mark.kind !== 'start') there.add(mark.id);
    }
  }
  const paragraphs = withoutMarks(doc.paragraphs, (id) => id !== '\0' && !there.has(id));
  const notes = doc.notes?.filter((n) => there.has(n.id));
  if (paragraphs === doc.paragraphs && notes?.length === doc.notes?.length) return doc;
  return defined<Doc>({ ...doc, paragraphs, notes: notes?.length ? notes : undefined });
}
