// What the page "Accessibility" says that is data, each checked in
// packages/editor/src (a11y.ts, keys.ts: announceMove, whereIs, spokenObject;
// ruler.ts, toolbar.ts, bubble.ts, panel.ts, sidebar.ts) and by driving a real
// editor with keys in headless Chrome, reading its live regions after each.

/** What the live region says, and when. */
export const HEARD: { title: string; text: string; example: string }[] = [
  {
    title: 'What the caret moved over',
    text: 'The letter with the arrows, the word with Alt (Ctrl on Windows) and an arrow, the line with up, down, Home and End. A space, a tab and the end of a paragraph by their name.',
    example: 'e · Reservation · space · end of paragraph',
  },
  {
    title: 'Where it is, when that changes',
    text: 'Before the text, on reaching another paragraph: the page, a heading, a table cell, leaving the table, a list and its level; and a link, or a change someone made, on reaching it.',
    example: 'Table, row 2, column 1. Deposit',
  },
  {
    title: 'What is there that is not text',
    text: 'A picture by its description, as Word keeps it; a text box; the number of a note at the foot of the page, and then the letter after it.',
    example: 'Picture: Plan of the flat… · Footnote 1, space',
  },
  {
    title: 'What was selected',
    text: 'What a key added to the selection or took from it. A long selection gives its start and its length, not the whole text.',
    example: 'r, selected · All selected',
  },
  {
    title: 'What a key did',
    text: 'What it deleted, a format turned on or off, undoing and redoing, pasting, going into the header or the footer.',
    example: 'o, deleted · Bold, on · Nothing to undo',
  },
];

/** The keys of the parts around the document, from a11y.ts, toolbar.ts, bubble.ts, typeahead.ts, keys.ts and panel.ts. */
export const KEYS: { keys: string; text: string }[] = [
  { keys: 'Alt+F10', text: 'To the toolbar.' },
  { keys: 'F6 · Shift+F6', text: 'From one part to the next, as they are on the page: the toolbar, the ruler, the side panel, the document, the status bar, and the find bar while it is open.' },
  { keys: 'Escape', text: 'From any part back to the document. In a menu, back to the button that opened it.' },
  { keys: 'Tab', text: 'In the toolbar, one stop; the arrows, Home and End go along it.' },
  { keys: 'Enter · ↓', text: 'On a button with a menu, opens it with the keyboard inside; the arrows go through it, and through grids (the size of a table, colours) in both directions.' },
  { keys: 'A tap of ⌘ (Ctrl)', text: 'Shows the bar beside the selection. Tab goes into it, the arrows along it, Tab or Escape back to the text.' },
  {
    keys: '/',
    text: 'At the start of a paragraph or after a space, the “/” menu: it is said, with how to use it; the keyboard stays in the text, ↑ and ↓ go through it and say each one, Enter or Tab does it, Escape leaves the “/” as text.',
  },
  { keys: '{{', text: 'The list of the variables, used as the “/” menu is; the one chosen is written whole.' },
  { keys: 'Tab · Shift+Tab', text: 'In a document restricted to areas to fill in, from one area to the next, selecting what it holds; a change outside them is refused and said to be.' },
  { keys: '⌘⌥Z (Ctrl+Alt+Z)', text: 'Screen reader mode, on and off.' },
];

/** The other parts that work from the keyboard. */
export const PARTS: { title: string; text: string }[] = [
  {
    title: 'The ruler',
    text: 'Each margin and indent is a slider read in centimetres: the arrows move it a quarter of a centimetre, Shift a whole one, Alt a point. On the button at its corner, Enter changes the kind of tab stop and Insert sets one at the caret; a tab stop moves with the arrows and goes with Delete.',
  },
  {
    title: 'Dialogs and the menu',
    text: 'The document menu, page setup, indents, the picture grid and the comparison of versions keep Tab inside them while they are open, and give the keyboard back to what had it when they close. Pictures in the grid move with buttons as well as by dragging.',
  },
  { title: 'The side panel', text: 'Its tabs are a tab list: one stop, and the arrows go from one to the next.' },
];

/** What is seen, from the styles of a11y.ts and the bars. */
export const SEEN: { title: string; text: string }[] = [
  { title: 'Focus', text: 'A ring around whatever has the keyboard, in every part.' },
  { title: 'Contrast', text: 'Text of the interface is at least 4.5:1 against its background: measured on every piece of text of the toolbar, the ruler, the side panel and the status bar.' },
  {
    title: 'Target size',
    text: 'Buttons and choices are at least 24 pixels, or that far apart. The handles of the ruler are smaller, as WCAG allows when a control of that size does the same: Page setup for the margins, and Indents… (in the spacing menu of the toolbar, or a double click on a handle) for the indents, typed in centimetres.',
  },
  {
    title: 'The language of the text',
    text: 'Chosen at the foot of the editor, or given with the language prop, or the one the file says; for a document that says none, the interface’s when it was opened, which changing the interface later leaves as it is. The field of the document and what is read from it are marked with it, so a screen reader reads a Spanish text with a Spanish voice under an English interface.',
  },
  { title: 'Colours by name', text: '“Dark gray”, “sky blue”, not a number; the colour button says the one in use.' },
  {
    title: 'High contrast',
    text: 'With the colours of the system forced on the page, as Windows does, the selection, the caret, the find results, what is on and what has the keyboard stay visible. The pages keep their own colours: they are the document as it prints.',
  },
  { title: 'Less motion', text: 'With “reduce motion” set, the caret does not blink and the menu does not slide.' },
];

/** What a PDF made from a document keeps for a screen reader, from pdf.ts and pdftags.ts, each checked with veraPDF and Poppler. */
export const PDF_TAGS: { title: string; text: string }[] = [
  { title: 'Headings', text: 'By the level of their style, Title and Heading 1 as H1. They are the bookmarks in the side bar of the reader as well.' },
  { title: 'Lists', text: 'Each item with its number or bullet apart from its text, a deeper level inside the item before it.' },
  {
    title: 'Tables',
    text: 'Rows and cells, a heading row as heading cells of their column, merged cells with the rows and columns they cover. A heading row drawn again on the next page is read once.',
  },
  { title: 'Pictures', text: 'Read by their description. One Word was told is decorative is skipped, as are those of headers.' },
  { title: 'Notes and links', text: 'A note after the paragraph of its reference; a link with the address it goes to, and Tab goes through the links in the order they are read.' },
  { title: 'What is not read', text: 'Headers, footers, borders, shading and the lines between columns are marked as decoration, which a screen reader skips.' },
];

/** What has not been checked. */
export const NOT_CHECKED: string[] = [
  'Real screen readers. VoiceOver, NVDA and JAWS each read a live region and a text field in their own way. What is announced was checked in Chrome, by reading the live regions after each key, not by listening.',
  'Screen reader mode relies on the screen reader following the caret of a field the editor moves. That is how they work, but it needs trying with each one.',
  'The tagged PDF was checked with veraPDF and read back with Poppler, not with Acrobat or a screen reader reading it.',
  'The automated audit needs a browser, so it is not run with the tests: npm run a11y -- <url> runs axe on the editor of a page, in a Chrome without a window, as it opens and with the caret in it. It finds nothing on the pages of this site.',
];
