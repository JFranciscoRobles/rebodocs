// What the page "Real-time collaboration" says that is data: the cases of two
// people changing the same thing, some of them set up in the editors of the
// page, and the options and routes of the server.

import type { Editor } from '@rebodocs/react';

// The sample in the room: 1 "Reservation receipt", 2 "Payment is due within 15 days of this receipt.",
// 3 "Late payments add a fee.", 4 "Either party may cancel in writing.", 5 "Signed, Ana" (indexes from 0 below).

export interface Scenario {
  key: string;
  title: string;
  /** What each of them does, said for the person. */
  setup: string;
  expect: string;
  ana: (editor: Editor) => void;
  luis: (editor: Editor) => void;
}

export const SCENARIOS: Scenario[] = [
  {
    key: 'same-place',
    title: 'Both type at the same place',
    setup: 'Ana writes “small ” before “fee”; Luis writes “fixed ” there too.',
    expect: 'both texts, the one the server got first before the other.',
    ana: (e) => (e.setSelection({ para: 2, offset: 20 }), e.insertText('small ')),
    luis: (e) => (e.setSelection({ para: 2, offset: 20 }), e.insertText('fixed ')),
  },
  {
    key: 'delete-passage',
    title: 'One deletes a passage, the other types in it',
    setup: 'Ana deletes “ within 15 days”; Luis writes “about ” before “15”.',
    expect: 'the passage goes, and “about ” stays.',
    ana: (e) => (e.setSelection({ para: 1, offset: 14 }, { para: 1, offset: 29 }), e.deleteBackward()),
    luis: (e) => (e.setSelection({ para: 1, offset: 22 }), e.insertText('about ')),
  },
  {
    key: 'split',
    title: 'One presses Enter, the other types after that place',
    setup: 'Ana presses Enter before “fee”; Luis writes “ each month” before the full stop.',
    expect: 'the text in the second half.',
    ana: (e) => (e.setSelection({ para: 2, offset: 20 }), e.insertParagraphBreak()),
    luis: (e) => (e.setSelection({ para: 2, offset: 23 }), e.insertText(' each month')),
  },
  {
    key: 'delete-paragraph',
    title: 'One deletes a paragraph, the other types in it',
    setup: 'Ana deletes the paragraph “Either party may cancel in writing.”; Luis writes “ within 7 days” at its end.',
    expect: 'its text goes, and what Luis typed stays, in a paragraph of its own with the same formatting.',
    ana: (e) => (e.setSelection({ para: 3, offset: 0 }, { para: 4, offset: 0 }), e.deleteBackward()),
    luis: (e) => (e.setSelection({ para: 3, offset: 34 }), e.insertText(' within 7 days')),
  },
  {
    key: 'format-both',
    title: 'Both format the same passage',
    setup: 'Ana makes “Late payments” red; Luis makes it blue.',
    expect: 'each letter in the colour of the one the server got last.',
    ana: (e) => (e.setSelection({ para: 2, offset: 0 }, { para: 2, offset: 13 }), e.setRunProps({ color: 'C0392B' })),
    luis: (e) => (e.setSelection({ para: 2, offset: 0 }, { para: 2, offset: 13 }), e.setRunProps({ color: '1A73E8' })),
  },
  {
    key: 'format-type',
    title: 'One formats a passage, the other types in it',
    setup: 'Ana makes “Late payments add” bold; Luis writes “ now” after “payments”.',
    expect: 'what Luis typed stays where it was typed, without the bold; the rest is bold.',
    ana: (e) => (e.setSelection({ para: 2, offset: 0 }, { para: 2, offset: 17 }), e.toggleMark('bold')),
    luis: (e) => (e.setSelection({ para: 2, offset: 13 }), e.insertText(' now')),
  },
];

/** What happens at once, and what everybody ends with: the rules of transform, in changes.ts. */
export const CONFLICTS: [what: string, result: string, scenario?: string][] = [
  ['Both type at the same place.', 'Both texts, the one the server got first before the other.', 'same-place'],
  ['One deletes a passage, the other types in the middle of it.', 'The passage goes, and what was typed in it stays.', 'delete-passage'],
  ['One splits a paragraph (Enter), the other types after that place.', 'The text goes into the second half.', 'split'],
  ['One joins two paragraphs, the other types in the second one.', 'The text is in the joined paragraph, at the same place in it.'],
  ['One formats a paragraph, the other splits it.', 'Both halves have the formatting.'],
  ['Both join the same two paragraphs.', 'One join.'],
  [
    'One deletes a paragraph, the other types in it.',
    'The paragraph’s text goes, and what was typed stays where it was, in a paragraph of its own with the same formatting. The one typing goes on typing there, without the caret jumping.',
    'delete-paragraph',
  ],
  ['One deletes a paragraph, the other only formats its text or presses Enter in it.', 'The paragraph is gone: nothing new was written in it.'],
  ['One formats a passage (bold, a colour, a tracked deletion), the other types in it.', 'What was typed stays where it was typed, without the formatting; the rest has it.', 'format-type'],
  ['Both format the same passage.', 'Each letter has the formatting of the one the server got last.', 'format-both'],
  ['One formats a passage, the other deletes part of it.', 'What was deleted is gone; the rest has the formatting.'],
  ['Both put new paragraphs after the same one.', 'Both, the ones the server got first before the others.'],
  ['Both insert a table at the same place.', 'Both tables, one after the other.'],
  [
    'Both change the shape of the same table, the page setup, the styles or the same comment.',
    'The one the server got last. Cells left without a paragraph, or paragraphs in a cell that went, are mended the same way by everybody.',
  ],
  ['Both add a picture or a comment.', 'Both: their names are made unique before they are sent.'],
];

/** The options of the command, from packages/collab/src/main.ts. */
export const OPTIONS: [option: string, env: string, text: string][] = [
  ['--backend URL', 'REBODOCS_COLLAB_BACKEND', 'Where documents are read from and saved to.'],
  ['--backend-key KEY', 'REBODOCS_COLLAB_BACKEND_KEY', 'Sent to your backend as Authorization: Bearer …. Put it in the environment, not on the command line.'],
  ['--port N', 'REBODOCS_COLLAB_PORT', '7420 by default.'],
  ['--host ADDR', '', 'The address to listen on: this machine alone when left out; 0.0.0.0 lets others in.'],
  ['--save-every N', '', 'Seconds between saves while a room has changes. 30 by default.'],
  ['--data DIR', '', 'Without a backend: the folder rooms are kept in, ./salas when left out.'],
  ['--memory', '', 'Without a backend: keep nothing, rooms last as long as the process.'],
  ['--token WORD', 'REBODOCS_COLLAB_TOKEN', 'Without a backend: the word a page must give to start a room.'],
  ['--static DIR', '', 'Also serve a built editor from that folder: one address for the page and its rooms.'],
];

/** The three routes of your backend, and when the server calls each. */
export const ROUTES: [route: string, when: string, what: string][] = [
  ['GET /docs/<id>', 'Someone opens a room nobody is in.', 'Return the DOCX.'],
  ['PUT /docs/<id>', 'Every --save-every seconds with changes, when the last person leaves, on shutdown.', 'Store the DOCX in the body. The one when the last person leaves ends a session of work, and says so.'],
  ['POST /docs/<id>/access', 'Someone joins, with { "ticket": "…" }.', 'Answer { "name": "Ana" } to let them in under that name, with "readOnly": true to let them only watch, or 403.'],
];
