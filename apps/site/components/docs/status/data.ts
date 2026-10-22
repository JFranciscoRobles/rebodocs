// What the page says was measured, as it was measured: these numbers come
// from running the commands, not from memory. Run them again and update them.

/** When the numbers below were taken. */
export const MEASURED = 'October 21, 2026';

/** `npx vitest run --reporter=json`, its tests by where they are. */
export const TESTS: { where: string; count: number; what: string }[] = [
  { where: 'packages/core', count: 317, what: 'Import and export, layout, tables, lists, notes, sections, tracked changes, versions, templates, PDF and its tags, fonts.' },
  { where: 'packages/collab', count: 78, what: 'The change format, two sessions converging, reconnection, the server and its backend.' },
  { where: 'packages/mcp', count: 37, what: 'The tools for an assistant, its server, and its chat against a Claude of the tests’ own.' },
  { where: 'packages/editor', count: 20, what: 'The texts of the interface, what a screen reader is told, the words spelling checks and the contrast of the dark theme.' },
  { where: 'apps/storage', count: 12, what: 'The backend of the storage demo, on a bucket kept in memory.' },
  { where: 'apps/realtime', count: 11, what: 'The backend of the real-time demo: two people typing through its three routes.' },
];

/** Of every line Word wrote in the documents measured, how many are where Word puts them, in percent with one decimal. */
export const linesLikeWord = (): number => {
  const [same, all] = AGAINST_WORD.reduce(([a, b], row) => [a + row.lines[0], b + row.lines[1]], [0, 0]);
  return Math.floor((same / all) * 1000) / 10;
};

/**
 * `npm run word-compare -- fixtures/<file>.docx`, against the PDF Word for Mac made of each. The
 * float-* ones are made by `npm run float-cases`, with these names; the other four are the author's own
 * documents, kept out of the repository, and shown under names of their own.
 */
export const AGAINST_WORD: { name: string; what: string; pages: [number, number]; lines: [number, number]; apart: number }[] = [
  { name: 'brochure', what: 'A brochure made in Word, with pictures', pages: [2, 2], lines: [39, 39], apart: 0.3 },
  { name: 'brochure-both-sides', what: 'The brochure, its pictures with text down both sides', pages: [2, 2], lines: [39, 39], apart: 0.3 },
  { name: 'brochure-reanchored', what: 'The brochure, its pictures anchored again', pages: [3, 3], lines: [38, 38], apart: 1.5 },
  { name: 'contract-tables-columns', what: 'A contract of 322 paragraphs: tables, columns, several sections', pages: [3, 6], lines: [266, 276], apart: 3.6 },
  { name: 'float-reach', what: 'How far under its text a line is still beside a picture', pages: [2, 2], lines: [40, 40], apart: 0.4 },
  { name: 'float-top-and-bottom', what: 'The whole width left free, with and without room round it', pages: [2, 2], lines: [33, 33], apart: 0.4 },
  { name: 'float-edges', what: 'Which lines are beside a picture, at its top and bottom edges', pages: [0, 2], lines: [24, 35], apart: 0.4 },
  { name: 'float-relative-to', what: 'Measured from the page and from its margins, or put at a side by name', pages: [2, 2], lines: [47, 47], apart: 0.4 },
  { name: 'float-both-sides', what: 'In the middle of the column, text down both sides; then at each edge', pages: [1, 1], lines: [37, 37], apart: 0.4 },
  { name: 'float-in-front', what: 'Over the text and under it', pages: [1, 1], lines: [20, 20], apart: 0.4 },
  { name: 'float-narrow', what: 'Little room on one side: how narrow a stretch Word still writes in', pages: [0, 2], lines: [37, 47], apart: 0.4 },
  { name: 'float-page-end', what: 'Near the foot of a page, and taller than what is left of it', pages: [3, 3], lines: [74, 74], apart: 0.4 },
  { name: 'float-sides', what: 'Told which side the text may go down', pages: [2, 2], lines: [42, 42], apart: 0.4 },
  { name: 'float-least-room', what: 'Short words: the least room Word writes in', pages: [2, 2], lines: [60, 60], apart: 0.4 },
  { name: 'float-mid-paragraph', what: 'Anchored in the middle of a paragraph, with other line spacings', pages: [1, 2], lines: [47, 47], apart: 0.4 },
  { name: 'float-table-and-header', what: 'In a cell of a table, and in the header', pages: [1, 1], lines: [33, 33], apart: 0.4 },
];
