// Reviewing: notes in the margin, and changes tracked to accept or reject.

import {
  type RevisionChange,
  type RevisionView,
  acceptRevisions,
  byAuthor,
  comparePositions,
  decideAllRevisions,
  rejectRevisions,
  revisionsOf,
  type Doc,
  type StoryPart,
  footnoteNumbers,
  noteLabels,
  storyKind,
  storyOf,
  withStory,
  NOTE_COLORS,
  addNote,
  noteExcerpt,
  noteRanges,
  removeNote,
} from '@rebodocs/core/internal';
import { type ToolResult, type Args, type Tool, fail, text, optionalText, optionalFlag, PLACE, places, color } from './shared';

export const REVIEW: Tool[] = [
  {
    name: 'add_note',
    title: 'Add a note',
    description: 'Puts a note on a text: a comment in the margin, as in Word, that does not change the document. The way to review a document, or to ask about something in it.',
    properties: {
      ...PLACE,
      note: { type: 'string', description: 'What the note says.' },
      author: { type: 'string', description: 'Who signs it.' },
      color: { type: 'string', description: `The colour it is marked with: one of ${NOTE_COLORS.join(', ')}.` },
    },
    required: ['find', 'note'],
    writes: true,
    run(doc, args, context) {
      const [range] = places(doc, args);
      const tint = optionalText(args, 'color');
      const made = addNote(doc, range, {
        text: text(args, 'note'),
        author: optionalText(args, 'author') ?? context.author ?? 'AI',
        color: tint === undefined ? undefined : color(tint, 'color'),
        date: (context.now ?? new Date()).toISOString().replace(/\.\d+Z$/, 'Z'),
      });
      if (made.id === undefined) fail('The note could not be put there.');
      return { text: `Note ${made.id} added in paragraph ${range.from.para + 1}.`, doc: made.doc, reveal: range.from };
    },
  },
  {
    name: 'list_notes',
    title: 'List the notes',
    description: 'The notes of the document: the id of each, who wrote it, the text it is about and what it says.',
    properties: {},
    writes: false,
    run(doc) {
      const byId = new Map((doc.notes ?? []).map((note) => [note.id, note]));
      const out = noteRanges(doc).flatMap(({ id, range }) => {
        const note = byId.get(id);
        return note ? [`${id} [${range.from.para + 1}] ${note.author || '—'} on "${noteExcerpt(doc, range)}": ${note.text}`] : [];
      });
      return { text: out.length ? out.join('\n') : 'The document has no notes.' };
    },
  },
  {
    name: 'remove_note',
    title: 'Remove a note',
    description: 'Takes a note away; the text it was about stays.',
    properties: { id: { type: 'string', description: 'The id of the note, from list_notes.' } },
    required: ['id'],
    writes: true,
    run(doc, args) {
      const id = text(args, 'id');
      const next = removeNote(doc, id);
      if (next === doc) fail(`There is no note "${id}": list_notes gives their ids.`);
      return { text: `Note ${id} removed.`, doc: next };
    },
  },
  {
    name: 'track_changes',
    title: 'Track changes on or off',
    description:
      'Switches tracked changes on or off, as Word\'s "Track changes". While on, every change made to the text, by any tool, stays marked for a person to accept or reject: what was put in as {+…+} and what was taken out as [-…-] in read_document.',
    properties: { on: { type: 'boolean', description: 'True to track the changes from now on, false to stop. What was tracked stays.' } },
    required: ['on'],
    writes: true,
    idempotent: true,
    run(doc, args) {
      const on = optionalFlag(args, 'on') ?? fail('"on" must be true or false.');
      if (on === !!doc.trackRevisions) return { text: on ? 'Changes were already being tracked.' : 'Changes were not being tracked.' };
      const { trackRevisions: _, ...rest } = doc;
      return {
        text: on ? 'Changes are tracked from now on: what you change stays marked for the person to accept or reject.' : 'Changes are no longer tracked.',
        doc: on ? { ...doc, trackRevisions: true } : rest,
      };
    },
  },
  {
    name: 'list_changes',
    title: 'List tracked changes',
    description:
      'The tracked changes of the document, numbered: who made each, whether it put text in, took it out, moved it or changed its formatting, the text, and the paragraph it is in. Text one person put in and another took out is two changes. accept_changes and reject_changes take these numbers.',
    properties: {},
    writes: false,
    run(doc) {
      const list = revisionsOf(doc);
      const state = doc.trackRevisions ? 'Changes are being tracked.' : 'Changes are not being tracked.';
      if (!list.length) return { text: `${state} There are no tracked changes.` };
      const notes = footnoteNumbers(doc);
      const ends = noteLabels(doc, 'endnote');
      const where = (r: RevisionView) => {
        const at = `paragraph ${r.range.from.para + 1}`;
        if (!r.part) return at;
        const note = r.part.startsWith('footnote:') ? notes.get(r.part.slice(9)) : undefined;
        const end = r.part.startsWith('endnote:') ? ends.get(r.part.slice(8)) : undefined;
        return `${note !== undefined ? `note ${note}` : end !== undefined ? `note at the end ${end}` : storyKind(r.part as Exclude<StoryPart, `footnote:${string}`>)}, ${at}`;
      };
      const lines = list.map((r, i) => {
        const what = r.text.replace(/[\u2060\uFFFC]/g, '');
        const text = what === '¶' ? 'a paragraph break' : `"${what.replace(/¶$/, '')}"${what.endsWith('¶') ? ' and the paragraph break after it' : ''}`;
        const did = r.row
          ? r.type === 'insert'
            ? 'put in a table row with'
            : 'took out a table row with'
          : r.type === 'format'
            ? `changed the formatting (${(r.format ?? []).join(', ')}) of`
            : r.move
              ? r.type === 'insert'
                ? 'moved here'
                : 'moved away'
              : r.type === 'insert'
                ? 'put in'
                : 'took out';
        return `${i + 1}. ${r.author || 'Someone'} ${did} ${text} (${where(r)}${r.date ? `, ${r.date.slice(0, 16).replace('T', ' ')}` : ''})`;
      });
      return { text: `${state} ${list.length} tracked ${list.length === 1 ? 'change' : 'changes'}:\n${lines.join('\n')}` };
    },
  },
  {
    name: 'accept_changes',
    title: 'Accept tracked changes',
    description:
      'Accepts tracked changes: what was put in stays, unmarked, and what was taken out goes. With "changes", the ones of those numbers in list_changes; with "author", all of that person\'s; without either, all of them. A move is accepted whole.',
    properties: {
      changes: { type: 'array', items: { type: 'integer' }, description: 'The numbers of the changes, from list_changes. All of them when left out.' },
      author: { type: 'string', description: 'Only the changes of this person, as list_changes names them.' },
    },
    writes: true,
    run: (doc, args) => decideChanges(doc, args, true),
  },
  {
    name: 'reject_changes',
    title: 'Reject tracked changes',
    description:
      'Rejects tracked changes: what was put in goes, and what was taken out comes back. With "changes", the ones of those numbers in list_changes; with "author", all of that person\'s; without either, all of them. A move is rejected whole.',
    properties: {
      changes: { type: 'array', items: { type: 'integer' }, description: 'The numbers of the changes, from list_changes. All of them when left out.' },
      author: { type: 'string', description: 'Only the changes of this person, as list_changes names them.' },
    },
    writes: true,
    run: (doc, args) => decideChanges(doc, args, false),
  },
];

/** Accepts or rejects tracked changes, by their numbers in list_changes, or all of them. */
export function decideChanges(doc: Doc, args: Args, accept: boolean): ToolResult {
  const list = revisionsOf(doc);
  if (!list.length) return { text: 'There are no tracked changes.' };
  const given = args.changes;
  const author = args.author;
  if (author !== undefined && author !== null && typeof author !== 'string') return fail('"author" must be the name of a person, as list_changes gives it.');
  if ((given === undefined || given === null) && typeof author === 'string') {
    const theirs = list.filter((r) => r.author === author).length;
    if (!theirs) return fail(`No tracked change is by "${author}". The people with changes: ${[...new Set(list.map((r) => r.author))].map((a) => `"${a}"`).join(', ')}.`);
    return { text: `${accept ? 'Accepted' : 'Rejected'} the ${theirs} tracked ${theirs === 1 ? 'change' : 'changes'} by ${author}.`, doc: decideAllRevisions(doc, accept, byAuthor(author)) };
  }
  if (given === undefined || given === null) {
    return { text: `${accept ? 'Accepted' : 'Rejected'} all ${list.length} tracked ${list.length === 1 ? 'change' : 'changes'}.`, doc: decideAllRevisions(doc, accept) };
  }
  if (!Array.isArray(given) || !given.length || !given.every((n) => Number.isInteger(n) && n >= 1 && n <= list.length))
    return fail(`"changes" must be numbers of changes from list_changes, from 1 to ${list.length}.`);
  const chosen = [...new Set(given as number[])].map((n) => list[n - 1]);
  // The last first, so that taking one out does not move the ones before it.
  chosen.sort((a, b) => (a.part ?? '').localeCompare(b.part ?? '') || comparePositions(b.range.from, a.range.from));
  let next = doc;
  for (const r of chosen) {
    // That change alone: not another person's over the same text.
    const pick = (change: RevisionChange) => change.type === r.type && change.author === r.author && (change.move ?? '') === (r.move ?? '');
    if (!r.part) next = accept ? acceptRevisions(next, r.range, pick) : rejectRevisions(next, r.range, pick);
    else {
      const story = storyOf(next, r.part)!;
      next = withStory(next, r.part, { ...story, paragraphs: (accept ? acceptRevisions(story, r.range, pick) : rejectRevisions(story, r.range, pick)).paragraphs });
    }
  }
  return {
    text: `${accept ? 'Accepted' : 'Rejected'} ${chosen.length} tracked ${chosen.length === 1 ? 'change' : 'changes'}. The numbers of the others may have moved: list_changes again before using one.`,
    doc: next,
  };
}
