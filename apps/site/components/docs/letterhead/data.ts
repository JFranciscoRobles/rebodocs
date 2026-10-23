// What the page "Letterheads" says that is data, each checked in
// packages/core/src/letterhead.ts, packages/editor/src/editor.ts (Letterhead),
// sidebar.ts (the document menu), packages/react/src/docs.ts (the prop) and
// pieces.ts (useDocsPage).

/** When a picture is the letterhead, as isLetterhead and parts in letterhead.ts say. */
export const RULES: { title: string; text: string }[] = [
  { title: 'In a header', text: 'The header of every page, the first page’s own, or that of a section with a header of its own.' },
  { title: 'Behind the text', text: 'Drawn under it, with the text not wrapping around it.' },
  { title: 'Measured from the page', text: 'Placed from the edges of the sheet, not from the margins or a paragraph.' },
  { title: 'The size of the page', text: 'At least 85% of the width and of the height of the page it is on. A smaller picture behind the text is a picture in the header, not the letterhead.' },
];

/** The document menu, under Page, as sidebar.ts builds it. */
export const MENU: { item: string; text: string }[] = [
  { item: 'Letterhead… · Change the letterhead…', text: 'A PNG or JPG from the disk. The top and bottom margins grow to clear what it prints; the one there was goes. One step to undo.' },
  { item: 'Fit the margins to the letterhead', text: 'Does that again, after the margins were changed by hand.' },
  { item: 'Extract the letterhead', text: 'Saves its picture as a file, named after the document, to use on another one.' },
  { item: 'Remove the letterhead', text: 'Takes the picture away. What else the header has stays.' },
];

/** The editor's members, as editor.ts declares them. */
export const MEMBERS: { sig: string; text: string }[] = [
  { sig: 'hasLetterhead: boolean', text: 'Whether the document has one.' },
  { sig: 'letterhead: { bytes, type } | undefined', text: 'Its picture, as the document keeps it: to save apart, or to put on another document.' },
  {
    sig: 'setLetterheadFile(file, fit = true) → Promise<boolean>',
    text: 'Gives it the letterhead a PNG or JPG file is, and, unless fit is false, grows the margins to clear it: one step to undo. A file that does not say its kind is told by how it starts. False when it is not a picture that can be one.',
  },
  { sig: 'setLetterhead(bytes, type)', text: 'The same from bytes, without touching the margins.' },
  { sig: 'fitLetterheadMargins() → Promise<boolean>', text: 'Grows the top and bottom margins to clear what it prints; one that already clears it stays. False when nothing changed.' },
  { sig: 'removeLetterhead()', text: 'Takes it away.' },
];

/** useDocsPage, as pieces.ts gives it. */
export const HEADLESS: { sig: string; text: string }[] = [
  { sig: 'letterhead: boolean', text: 'Whether the document has one; also state.letterhead of useDocs.' },
  { sig: 'setLetterhead(file, fit?) → Promise<boolean>', text: 'The editor’s setLetterheadFile.' },
  { sig: 'fitLetterheadMargins() → Promise<boolean>', text: 'As on the editor.' },
  { sig: 'removeLetterhead()', text: 'As on the editor.' },
  { sig: 'letterheadFile() → Blob | undefined', text: 'Its picture as a file, for a button that saves it.' },
];

/** The functions of @rebodocs/core. */
export const CORE: { sig: string; text: string }[] = [
  {
    sig: 'setLetterhead(doc, { bytes, type }) → Doc',
    text: 'The picture stretched over the whole page, in the header of every page, the first page’s own and that of each section with its own, each the size of its page; the one there was goes. A kind of picture a document cannot hold leaves it as it was. The margins are not touched.',
  },
  { sig: 'removeLetterhead(doc) → Doc', text: 'Without it; the rest of the header stays.' },
  { sig: 'letterheadOf(doc) → { part, para, offset, xml } | undefined', text: 'Where it is: the header and the place in it.' },
  { sig: 'letterheadImage(doc) → { bytes, type } | undefined', text: 'Its picture.' },
  {
    sig: 'letterheadMargins(pixels, page) → { top?, bottom? }',
    text: 'The margins a picture asks for, read from its pixels (RGBA, as a canvas gives them). A side with nothing printed asks for nothing.',
  },
  {
    sig: 'pngLetterheadMargins(bytes, page) → { top?, bottom? } | undefined',
    text: 'The same from the bytes of a PNG, without a browser, as on a server. Undefined for a JPEG, whose pixels are not read here.',
  },
  {
    sig: 'withLetterheadMargins(doc, asked) → Doc',
    text: 'The top and bottom margins grown to what was asked: never shrunk, never past 40% of the page. What the editor does after reading a picture.',
  },
  {
    sig: 'resizeLetterhead(doc, width, height, section?) → Doc',
    text: 'The letterhead made the size of another page. setSectionPage does it when the paper or its orientation changes, so it is called by hand only for a page set some other way.',
  },
  { sig: 'imageTypeOf(bytes) → string | undefined', text: 'image/png, image/jpeg or image/gif, by how the bytes start, for a file that did not say.' },
];
