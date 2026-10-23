// What the page says was measured, as it was measured: these numbers come
// from running the commands, not from memory. Run them again and update them.

/** When the numbers below were taken. */
export const MEASURED = 'October 23, 2026';

/** `npx vitest run --reporter=json`, its tests by where they are. */
export const TESTS: { where: string; count: number; what: string }[] = [
  { where: 'packages/core', count: 362, what: 'Import and export, layout, tables, lists, notes, sections, tracked changes, versions, templates, PDF and its tags, fonts.' },
  {
    where: 'packages/collab',
    count: 102,
    what: 'The change format, two sessions converging, an editor’s sync and a room on their own, reconnection, folding with people in, keys and limits, the server and its backend.',
  },
  { where: 'packages/mcp', count: 100, what: 'The tools for an assistant, its server, and its chat against a Claude of the tests’ own.' },
  { where: 'packages/editor', count: 25, what: 'The texts of the interface, what a screen reader is told, the words spelling checks, the contrast of the dark theme, and tables pasted from Word.' },
  {
    where: 'packages/editor, in Chrome',
    count: 30,
    what: 'The editor itself, on a page: keys, the mouse, touch, the clipboard, keyboards that compose, the pages drawn, the files it makes, spelling, pictures and tables taken hold of.',
  },
  { where: 'apps/storage', count: 12, what: 'The backend of the storage demo, on a bucket kept in memory.' },
  { where: 'apps/realtime', count: 11, what: 'The backend of the real-time demo: two people typing through its three routes.' },
];

/** Of every line Word wrote in the documents measured, how many are where Word puts them, in percent with one decimal. */
export const linesLikeWord = (): number => {
  const [same, all] = AGAINST_WORD.reduce(([a, b], row) => [a + row.lines[0], b + row.lines[1]], [0, 0]);
  return Math.floor((same / all) * 1000) / 10;
};

/**
 * `npm run word-check`: the documents of test-documents/, against the PDF Word for Mac made of each, kept
 * beside them. The float-* ones are made by `npm run float-cases` and the contract-* ones by
 * `npm run contract-cases`, with these names; none comes from a real document.
 */
export const AGAINST_WORD: { name: string; what: string; pages: [number, number]; lines: [number, number]; apart: number }[] = [
  { name: 'contract-times-justified', what: '28 clauses in Times New Roman, justified, at 1.15 lines', pages: [7, 7], lines: [230, 230], apart: 0.8 },
  { name: 'contract-georgia-lists', what: 'Numbered obligations in Georgia, lettered items under each', pages: [5, 5], lines: [166, 166], apart: 0.8 },
  { name: 'contract-verdana-tables', what: 'A table of 60 payments in Verdana over two pages, its heading on each, and the signatures', pages: [2, 2], lines: [71, 71], apart: 0.6 },
  { name: 'contract-arial-sections', what: 'A contract upright and its annex across the page, in Arial, with other margins', pages: [5, 5], lines: [150, 150], apart: 0.5 },
  { name: 'contract-times-columns', what: 'Clauses across the page and a glossary in two columns, in Times New Roman', pages: [3, 3], lines: [101, 101], apart: 0.7 },
  { name: 'contract-times-endnotes', what: 'Endnotes in Times New Roman, after the last clause, under their line', pages: [3, 3], lines: [87, 87], apart: 0.8 },
  { name: 'contract-times-endnotes-long', what: 'Endnotes that go on to a page of their own, one cut across the two', pages: [4, 4], lines: [144, 144], apart: 0.8 },
  { name: 'contract-times-endnotes-sections', what: 'Endnotes at the end of each section: one section leaves its own to the next', pages: [5, 5], lines: [126, 126], apart: 0.8 },
  { name: 'contract-arial-tables', what: 'Tables in every way Word makes them: merged, apart, beside the text, inside a cell, on their side', pages: [4, 4], lines: [154, 154], apart: 1.8 },
  { name: 'contract-arial-keep', what: 'Paragraphs kept whole, headings kept with their text and a clause that starts a page, in Arial', pages: [6, 6], lines: [192, 192], apart: 0.7 },
  { name: 'float-brochure', what: 'A brochure of two pages, its pictures on either side and across the page', pages: [1, 3], lines: [70, 90], apart: 1.0 },
  { name: 'float-reach', what: 'How far under its text a line is still beside a picture', pages: [2, 2], lines: [40, 40], apart: 0.5 },
  { name: 'float-top-and-bottom', what: 'The whole width left free, with and without room round it', pages: [2, 2], lines: [33, 33], apart: 0.5 },
  { name: 'float-edges', what: 'Which lines are beside a picture, at its top and bottom edges', pages: [0, 2], lines: [24, 35], apart: 0.5 },
  { name: 'float-relative-to', what: 'Measured from the page and from its margins, or put at a side by name', pages: [2, 2], lines: [47, 47], apart: 0.5 },
  { name: 'float-both-sides', what: 'In the middle of the column, text down both sides; then at each edge', pages: [1, 1], lines: [37, 37], apart: 0.5 },
  { name: 'float-in-front', what: 'Over the text and under it', pages: [1, 1], lines: [20, 20], apart: 0.5 },
  { name: 'float-narrow', what: 'Little room on one side: how narrow a stretch Word still writes in', pages: [0, 2], lines: [37, 47], apart: 0.5 },
  { name: 'float-page-end', what: 'Near the foot of a page, and taller than what is left of it', pages: [3, 3], lines: [74, 74], apart: 0.5 },
  { name: 'float-sides', what: 'Told which side the text may go down', pages: [2, 2], lines: [42, 42], apart: 0.5 },
  { name: 'float-least-room', what: 'Short words: the least room Word writes in', pages: [2, 2], lines: [60, 60], apart: 0.5 },
  { name: 'float-mid-paragraph', what: 'Anchored in the middle of a paragraph, with other line spacings', pages: [2, 2], lines: [47, 47], apart: 0.5 },
  { name: 'float-table-and-header', what: 'In a cell of a table, and in the header', pages: [1, 1], lines: [33, 33], apart: 0.5 },
];
