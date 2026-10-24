// Stretches of a document that may be changed while the rest may not: what
// Word's "Restrict editing" calls exceptions for everyone. Like a note, a
// stretch is two marks in the text that take no room, the very XML Word
// writes for it (w:permStart and w:permEnd), so it moves with the text as it
// is edited, comes back from a file as it went, and Word keeps it. Whether
// the rest is closed to changes is `Doc.restricted`, which Word reads as
// w:documentProtection w:edit="readOnly".

import { type Doc, type Paragraph, type Position, type Range, ANCHOR_CHAR, defined } from './model';
import { noteMark } from './notes';
import { insertText, propsAt } from './ops';

/** A stretch that may be changed, by the id its marks share. */
export interface EditableRange {
  id: string;
  range: Range;
}

/** What a mark of a stretch looks like, and its id. */
const MARK = /<w:perm(Start|End)\b[^>]*?\bw:id="([^"]*)"/;

/** The stretch a mark belongs to, and which of its marks it is; undefined for any other object. */
export function editableMark(xml: string | undefined): { id: string; kind: 'start' | 'end' } | undefined {
  const match = xml && MARK.exec(xml);
  if (!match) return undefined;
  return { id: match[2], kind: match[1] === 'Start' ? 'start' : 'end' };
}

const before = (a: Position, b: Position) => a.para < b.para || (a.para === b.para && a.offset < b.offset);

/** The stretches that may be changed, in the order they start: each from after its first mark to its last. */
export function editableRanges(doc: Pick<Doc, 'paragraphs'>): EditableRange[] {
  const starts = new Map<string, Position>();
  const out: EditableRange[] = [];
  doc.paragraphs.forEach((p, para) => {
    let offset = 0;
    for (const run of p.runs) {
      const mark = run.props.anchor ? editableMark(run.props.object) : undefined;
      if (mark?.kind === 'start' && !starts.has(mark.id)) starts.set(mark.id, { para, offset: offset + run.text.length });
      const from = mark?.kind === 'end' ? starts.get(mark.id) : undefined;
      if (mark && from) {
        starts.delete(mark.id);
        out.push({ id: mark.id, range: { from, to: { para, offset } } });
      }
      offset += run.text.length;
    }
  });
  return out.sort((a, b) => (before(a.range.from, b.range.from) ? -1 : before(b.range.from, a.range.from) ? 1 : 0));
}

/** The stretch `pos` is in, its ends included; the shortest, when one is inside another. */
export function editableAt(doc: Pick<Doc, 'paragraphs'>, pos: Position): EditableRange | undefined {
  const inside = editableRanges(doc).filter(({ range }) => !before(pos, range.from) && !before(range.to, pos));
  return inside.sort((a, b) => (before(a.range.from, b.range.from) ? 1 : -1))[0];
}

/** Makes `range` a stretch that may be changed; it may be empty, a place to write in. */
export function addEditableRange(doc: Doc, range: Range): { doc: Doc; id: string } {
  const { from, to } = before(range.to, range.from) ? { from: range.to, to: range.from } : range;
  const taken = new Set<string>();
  for (const p of doc.paragraphs) for (const run of p.runs) if (run.props.anchor) taken.add(editableMark(run.props.object)?.id ?? '');
  let n = 0;
  while (taken.has(String(n))) n++;
  const id = String(n);
  const mark = (at: Doc, pos: Position, xml: string) => {
    const like = propsAt(at, pos);
    return insertText(at, pos, ANCHOR_CHAR, defined({ fontFamily: like.fontFamily, fontSize: like.fontSize, object: xml, anchor: true })).doc;
  };
  // The end first, so the start does not move it.
  const marked = mark(mark(doc, to, `<w:permEnd w:id="${id}"/>`), from, `<w:permStart w:id="${id}" w:edGrp="everyone"/>`);
  return { doc: marked, id };
}

/** Takes the marks of a stretch away: its text stays, and is like the rest again. */
export function removeEditableRange(doc: Doc, id: string): Doc {
  let changed = false;
  const gone = (run: Paragraph['runs'][number]) => run.props.anchor && editableMark(run.props.object)?.id === id;
  const paragraphs = doc.paragraphs.map((p) => {
    if (!p.runs.some(gone)) return p;
    changed = true;
    const runs = p.runs.filter((run) => !gone(run));
    // A paragraph is never left without a run.
    return { ...p, runs: runs.length ? runs : [{ text: '', props: defined({ ...p.runs[0].props, object: undefined, anchor: undefined }) }] };
  });
  return changed ? { ...doc, paragraphs } : doc;
}

/** Closes the rest of the document to changes, or opens it again. */
export function setRestricted(doc: Doc, on: boolean): Doc {
  return !!doc.restricted === on ? doc : defined<Doc>({ ...doc, restricted: on || undefined });
}

/**
 * What no one may change in a restricted document, written out to compare:
 * the text and look of the paragraphs outside the stretches, their marks, and
 * the rest of the document. The notes are left out, as they may be added.
 */
function outside(doc: Doc): string {
  const out: string[] = [];
  const open = new Set<string>();
  let text = '';
  let look = '';
  const flush = () => {
    if (text) out.push(`${look}${text}`);
    text = '';
  };
  for (const p of doc.paragraphs) {
    // A paragraph that starts inside a stretch was made there, by breaking a line of it.
    if (!open.size) {
      flush();
      out.push(`¶${JSON.stringify(p.props)}`);
    }
    for (const run of p.runs) {
      const mark = run.props.anchor ? editableMark(run.props.object) : undefined;
      if (mark) {
        flush();
        out.push(`${mark.kind}:${mark.id}`);
        if (mark.kind === 'start') open.add(mark.id);
        else open.delete(mark.id);
        continue;
      }
      if (open.size || (run.props.anchor && noteMark(run.props.object))) continue;
      // Runs split or joined differently are the same text.
      const props = JSON.stringify(run.props);
      if (props !== look) flush();
      look = props;
      text += run.text;
    }
    if (!open.size) {
      flush();
      out.push('⏎');
    }
  }
  flush();
  return out.join('\n');
}

/** The fields of a document that no one may change in it, besides its paragraphs: not its notes or the pictures put in. */
const FREE = new Set<keyof Doc>(['paragraphs', 'notes', 'media', 'source']);

/**
 * Whether `after` keeps all that `before` does outside its stretches that may
 * be changed: what a change must do to be made while a document is restricted.
 * Notes may be added and taken away.
 */
export function keepsOutside(before: Doc, after: Doc): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)] as (keyof Doc)[]);
  for (const key of keys) {
    if (FREE.has(key) || before[key] === after[key]) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) return false;
  }
  return before.paragraphs === after.paragraphs || outside(before) === outside(after);
}
