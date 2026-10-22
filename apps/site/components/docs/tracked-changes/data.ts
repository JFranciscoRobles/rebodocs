// What the page "Tracked changes" says that is data, each checked in
// packages/core/src/revisions.ts, packages/editor/src/editor.ts (Tracked
// changes, commit, the keys), toolbar.ts (Review), panel.ts (renderChanges)
// and packages/mcp/src/tools.ts.

import { type Doc, type Paragraph, applyRunProps, createDoc, deleteRange, deleteRow, insertTable, insertText, paragraphText, setParagraphStyle, trackEdit } from '@rebodocs/core';

const LUIS = { author: 'Luis', date: '2026-10-19T09:30:00Z' };
const para = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });
const at = (doc: Doc, text: string) => doc.paragraphs.findIndex((p) => paragraphText(p).includes(text));

/** The receipt before Luis: two lines of terms and a table of what is charged. */
function receipt(): Doc {
  let doc = setParagraphStyle(
    createDoc([para('Reservation receipt'), para('Payment is due within 15 days of this receipt.'), para('Late payments add a fee.'), para('Either party may cancel by phone or in writing.'), para('')]),
    0,
    0,
    'Title',
  );
  doc = insertTable(doc, { para: 4, offset: 0 }, 3, 2).doc;
  const cells = doc.paragraphs.flatMap((p, i) => (p.cell ? [i] : []));
  ['Item', 'Price', 'Room', '$900', 'Cleaning', '$50'].forEach((text, k) => (doc = insertText(doc, { para: cells[k], offset: 0 }, text).doc));
  return doc;
}

/**
 * The document of the demo: Luis's edits, each tracked as the editor tracks
 * them, waiting for someone to decide. A word replaced, words put in and taken
 * out, a change of formatting and a row of the table taken out.
 */
export const REVIEWED: Doc = (() => {
  let doc = receipt();
  const step = (edit: (d: Doc) => Doc) => (doc = trackEdit(doc, edit(doc), LUIS, { words: true }).doc);
  const where = (text: string, word: string) => ({ para: at(doc, text), offset: paragraphText(doc.paragraphs[at(doc, text)]).indexOf(word) });
  step((d) => {
    const from = where('Payment', '15');
    return insertText(deleteRange(d, { from, to: { ...from, offset: from.offset + 2 } }), from, '30').doc;
  });
  step((d) => insertText(d, where('Late payments', '.'), ' of 2% a month').doc);
  step((d) => {
    const from = where('Late payments', 'Late payments');
    return applyRunProps(d, { from, to: { ...from, offset: from.offset + 13 } }, { bold: true });
  });
  step((d) => {
    const from = where('Either party', 'by phone or ');
    return deleteRange(d, { from, to: { ...from, offset: from.offset + 12 } });
  });
  step((d) => deleteRow(d, at(d, 'Cleaning')).doc);
  return { ...doc, trackRevisions: true };
})();

export const PEOPLE = ['Ana', 'Luis'] as const;

/** How the keys behave while changes are tracked: commit and trackEdit in editor.ts, revisions.ts. */
export const KEYS: { key: string; text: string }[] = [
  { key: 'Typing', text: 'What is typed is put in, underlined in your colour. What you type in a row is one change.' },
  { key: 'Backspace', text: 'Text taken out stays, struck through, and the caret goes before it: Backspace again takes out the letter before, stepping over what is already struck.' },
  { key: 'Delete', text: 'The same forward: the caret goes after what it took out.' },
  { key: 'Over your own change', text: 'Text you put in and take out again goes for good: it never was in the document.' },
  { key: 'Over someone else’s', text: 'Text another person put in stays, theirs and taken out by you: two changes, each decided on its own, as in Word.' },
  { key: 'Formatting', text: 'Bold, a font, an alignment: a change of its own, which keeps the formatting the text had, to go back to. Text you just put in too, as in Word: its putting in and its formatting are decided apart.' },
  { key: 'Enter', text: 'The paragraph break is a change of its own, shown as a ¶ in your colour.' },
  { key: 'Backspace at the start', text: 'Joining two paragraphs is a change too: they stay apart, the mark struck through, until it is accepted.' },
];

/** The members of the editor, as editor.ts declares them. */
export const MEMBERS: { sig: string; text: string }[] = [
  { sig: 'trackChanges: boolean', text: 'Whether changes are tracked. Saved in the file, as Word saves it.' },
  { sig: 'setTrackChanges(on: boolean)', text: 'Turns it on or off. Not a step to undo: what was tracked stays.' },
  { sig: 'revisions: RevisionView[]', text: 'Every change: of the text first, then of the headers, footers, notes and text boxes.' },
  { sig: 'hasRevisions: boolean', text: 'Whether there is any change to accept or reject.' },
  { sig: 'activeRevision: RevisionView | undefined', text: 'The change the caret is in, or the first the selection takes in.' },
  { sig: 'acceptRevision(revision?) → boolean', text: 'The change given, alone; without one, the changes the selection takes in, or the one at the caret. A move, both halves. False when there is none.' },
  { sig: 'rejectRevision(revision?) → boolean', text: 'Rejects them the same way.' },
  { sig: 'acceptAllRevisions(author?)', text: 'Every change of the document, headers, notes and text boxes too, or every one of a person’s, as one step to undo.' },
  { sig: 'rejectAllRevisions(author?)', text: 'The same, rejected.' },
  { sig: "changesView: 'all' | 'accepted' | 'original'", text: 'How the changes are shown: marked, or the document as it would be with all of them accepted, or with none. Shown without them, it is only to be looked at.' },
  { sig: 'setChangesView(view)', text: 'Shows them so. The changes are still in the document, and in what it saves.' },
  { sig: 'goToRevision(dir: 1 | -1) → boolean', text: 'Selects the next change of the text being edited, or the one before. False when there is none.' },
  { sig: 'selectRevision(revision: RevisionView)', text: 'Selects a change, going into its header, footer or note first.' },
];

/** RevisionView, as revisions.ts declares it. */
export const VIEW: { name: string; type: string; text: string }[] = [
  { name: 'type', type: "'insert' | 'delete' | 'format'", text: 'Put in, taken out, or its formatting changed.' },
  { name: 'author', type: 'string', text: 'Who made it: the author of the editor, or "Anonymous" without one.' },
  { name: 'date', type: 'string?', text: 'When, as ISO 8601, to the minute.' },
  { name: 'range', type: 'Range', text: 'Where it is in the text of its part. A change to a paragraph mark ends at the start of the next paragraph.' },
  { name: 'text', type: 'string', text: 'Its text, with ¶ for a paragraph mark.' },
  { name: 'part', type: 'StoryPart?', text: 'The header, footer or note it is in; the body when left out.' },
  { name: 'move', type: 'string?', text: 'The name of the move it is half of: where text left, taken out, or where it went, put in.' },
  { name: 'format', type: 'string[]?', text: 'For a change of formatting, what it changed: bold, fontSize, align…' },
  { name: 'paragraph', type: 'true?', text: 'A change of formatting of the whole paragraph.' },
  { name: 'row', type: 'true?', text: 'A row of a table put in or taken out: its range is the row, its text that of its cells.' },
];

/** The functions of @rebodocs/core. */
export const CORE: { sig: string; text: string }[] = [
  { sig: 'trackEdit(before, after, by, { words? })', text: 'Any edit to a text, tracked: what it took out comes back struck, what it put in is marked. Returns { doc, map } — map moves a position of after into the tracked doc.' },
  { sig: 'trackDocEdit(before, after, by, words = true)', text: 'The same for the whole document, with its headers, footers and notes, word by word.' },
  { sig: 'acceptRevisions(doc, range?, pick?)', text: 'Accepts the changes in range, or all of the text; with pick, only those it takes, as one person’s or one kind.' },
  { sig: 'rejectRevisions(doc, range?, pick?)', text: 'Rejects them.' },
  { sig: 'decideAllRevisions(doc, accept, pick?)', text: 'Every change, headers, footers, notes and text boxes included; with pick, only those it takes.' },
  { sig: 'byAuthor(author) → pick', text: 'The changes of one person: Word’s “Accept all changes by”.' },
  { sig: 'revisionsOf(doc) → RevisionView[]', text: 'Every change of the document.' },
  { sig: 'hasRevisions(doc) → boolean', text: 'Whether it has any.' },
  { sig: 'revisionColor(author) → string', text: 'The colour of a person’s changes, always the same for the same name, as hex.' },
];

/** What the MCP server has for tracked changes, from tools.ts. */
export const TOOLS: { name: string; text: string }[] = [
  { name: 'track_changes', text: 'Turns tracking on or off. While on, everything any tool changes is tracked.' },
  { name: 'list_changes', text: 'The changes, numbered: who, put in or taken out, the text and its paragraph.' },
  { name: 'accept_changes', text: 'Those of the numbers given, all of one person’s with author, or all.' },
  { name: 'reject_changes', text: 'The same, rejected.' },
];
