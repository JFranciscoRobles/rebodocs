// What the page "Versions" says that is data, each checked in
// packages/core/src/versions.ts (compareDocs, restoreVersion, describeChange),
// packages/editor/src/versions.ts (Versions, createVersionView), panel.ts (the
// Versions tab), packages/react/src/mount.ts (asked again after a save) and
// packages/mcp/src/tools.ts (compare_documents).

import { type Doc, type Paragraph, applyRunProps, createDoc, paragraphText, setParagraphStyle } from '@rebodocs/core';

const para = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });

/** A receipt of a few lines, the first of them its title. */
function receipt(lines: string[]): Doc {
  return setParagraphStyle(createDoc(lines.map(para)), 0, 0, 'Title');
}

export interface Kept {
  id: string;
  date: string;
  author: string;
  label?: string;
  doc: Doc;
}

/** The versions the demo's application has kept, the oldest first. */
export const KEPT: Kept[] = [
  {
    id: 'v1',
    date: '2026-10-12T10:05:00',
    author: 'Ana',
    label: 'First draft',
    doc: receipt(['Reservation receipt', 'Payment is due within 15 days of this receipt.', 'Late payments add a fee.', 'Either party may cancel by phone or in writing.']),
  },
  {
    id: 'v2',
    date: '2026-10-15T16:40:00',
    author: 'Luis',
    label: 'Sent to the client',
    doc: receipt([
      'Reservation receipt',
      'Payment is due within 30 days of this receipt.',
      'Late payments add a fee of 2% a month.',
      'Either party may cancel by phone or in writing.',
      'Prices include taxes.',
    ]),
  },
];

/** The document as it is now: changed since the last version, and one line of it made bold. */
export const CURRENT: Doc = (() => {
  const doc = receipt([
    'Reservation receipt for room 12',
    'Payment is due within 30 days of this receipt.',
    'Late payments add a fee of 2% a month.',
    'Either party may cancel in writing.',
    'Keys are returned at the front desk.',
  ]);
  const at = doc.paragraphs.findIndex((p) => paragraphText(p).startsWith('Late'));
  return applyRunProps(doc, { from: { para: at, offset: 0 }, to: { para: at, offset: paragraphText(doc.paragraphs[at]).length } }, { bold: true });
})();

/** What the application gives the editor, as packages/editor/src/versions.ts declares it. */
export const MEMBERS: { sig: string; text: string }[] = [
  { sig: 'list() → Promise<VersionInfo[]>', text: 'The versions there are, in any order: the tab shows the newest first, those without a date last. Asked for each time the tab is opened, after a version is saved, and after each save of the document.' },
  { sig: 'load(id) → Promise<Uint8Array | ArrayBuffer>', text: 'One version, as the bytes of its DOCX. A version does not change, so each one is read once; one that could not be read is asked for again the next time.' },
  { sig: 'save?(docx, { label?, author? }) → Promise', text: 'Optional. Keeps the document as it is now, with the name typed for it and the editor’s author. With it the tab has Save version; without it, versions are kept when your application keeps them.' },
];

/** VersionInfo. */
export const INFO: { name: string; type: string; text: string }[] = [
  { name: 'id', type: 'string', text: 'What your application knows the version by, given back to load.' },
  { name: 'date', type: 'string?', text: 'When it was kept, as an ISO date: shown in the language of the interface, and the order of the list.' },
  { name: 'author', type: 'string?', text: 'Who kept it.' },
  { name: 'label', type: 'string?', text: 'Its name. Without one, the list calls it by its date.' },
];

/** What compareDocs gives. */
export const COMPARISON: { name: string; type: string; text: string }[] = [
  {
    name: 'changes',
    type: 'Change[]',
    text: 'One for each paragraph put in (added), taken out (removed), changed (changed), or with the same text and another look (formatted). Each has before and after, its index in each version, and part when it is in a header, a footer, a note at the foot of the page or a text box.',
  },
  { name: 'notes', type: 'NoteChange[]', text: 'The notes on the text written (added), taken out (removed) or whose text changed (changed), each by author and date, which Word keeps when it saves, though not the id. Listed, not marked in doc.' },
  { name: 'doc', type: 'Doc', text: 'The later version with the changes marked, as the editor shows it. It lays out, prints and exports to PDF like any document; it is for reading, not for editing or keeping.' },
  { name: 'marks', type: '{ part?, pos }[]', text: 'Where each change starts in doc, for going from one to the next.' },
];

/** The functions, of core and of the editor. */
export const FUNCTIONS: { sig: string; text: string }[] = [
  { sig: 'compareDocs(before, after) → Comparison', text: 'What changed from one version to another: paragraph by paragraph and, inside one that changed, word by word, in the text, its headers, footers, notes at the foot of the page and text boxes; and the notes on the text. Tracked changes are taken as accepted, as Word compares.' },
  { sig: 'describeChange(change, context = 40) → string', text: 'A change, of a paragraph or of a note, as plain text: [-taken out-], {+put in+}, a picture as [image], and up to context letters of what is around it.' },
  { sig: 'restoreVersion(current, version) → Doc', text: 'The document to put in place of current: the version, with the current paragraphs wherever they are the same.' },
  { sig: 'editor.restoreVersion(doc)', text: 'The same, on the editor, as one step to undo.' },
  { sig: 'loadVersion(versions, id) → Promise<Doc>', text: 'A version, read once. From @rebodocs/editor and @rebodocs/react.' },
  { sig: 'createVersionView(editor, versions, { onRestore?, onError? })', text: 'The comparison over the pages of an editor, for a list of versions of your own: show(from, to?), close().' },
];
