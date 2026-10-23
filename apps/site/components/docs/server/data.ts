// What the page "On a server: DOCX and PDF" says that is data, each checked in
// packages/core/src (docx/, render.ts, fonts.ts, pdf.ts, markdown.ts,
// layout.ts, blocks.ts and the modules of CATALOG) and packages/mcp/src/generate.ts.

/** The calls a server makes, in the order it makes them. */
export const CALLS: { sig: string; text: string }[] = [
  {
    sig: 'importDocx(bytes, { maxSize? }) → Doc',
    text: 'A DOCX as a document. What the engine does not understand is kept, to be written back as it was. It throws for a file that is not a DOCX, and for one that says it takes more than maxSize unpacked (256 MB when not given).',
  },
  {
    sig: 'fillVariables(doc, data, { locale?, currency?, today? }) → Doc',
    text: "The {{variables}} of a template filled, with their formats (upper, currency, long date…), and its blocks written out: {{#lines}} … {{/lines}} once for each item of a list, kept or taken out for true or false. data is the JSON your application has, nested objects and all. locale writes values in a language ('es-MX': 21 de octubre de 2026); without it, in the language of the document, or in English when it says none.",
  },
  { sig: 'exportDocx(doc) → Uint8Array', text: 'The document as a DOCX. One opened and saved untouched comes out with the same XML.' },
  {
    sig: 'readFont(bytes) → FontFile | undefined',
    text: 'A .ttf or .otf file, read for its family, weight and widths; of a collection (.ttc), its first face. Undefined for one that is not a font it reads.',
  },
  { sig: 'readFonts(bytes) → FontFile[]', text: 'Every face of a file: each of a collection, as macOS keeps Helvetica, made a font of its own.' },
  {
    sig: 'renderPdf(doc, fonts, title?, language?) → { pdf, layout, missingFonts, missingPictures }',
    text: 'The document laid out with those fonts and drawn as a tagged PDF: the layout it used, the families it had to stand in for, and how many pictures it could not draw. The language (es-MX) is the one the file says when not given.',
  },
  {
    sig: 'exportMarkdown(doc, { changes? }) → string',
    text: 'Headings, emphasis, lists, links and tables as Markdown. No fonts, colours or pictures: for a language model, or an index. Tracked changes come accepted; or as before them (original), or marked [-taken out-]{+put in+} (marked).',
  },
  { sig: 'layoutDocument(doc, measurer) → Layout', text: 'Pages and lines, without drawing them. The measurer is anything that tells the width of a text and the height of a font.' },
];

/** What goes into the PDF, from render.ts and pdf.ts. */
export const PDF_FACTS: { title: string; text: string }[] = [
  { title: 'Fonts inside', text: 'TrueType ones cut down to the characters used; OpenType ones in CFF whole. The text can be selected and searched.' },
  { title: 'Its own fonts first', text: 'Fonts the DOCX carries inside are used by themselves, before the ones you give: they are the ones it was written with.' },
  {
    title: 'Stand-ins',
    text: 'A family you did not give is set in one of its kind you did (for a sans: Arial, Liberation Sans, Helvetica, DejaVu Sans; for a serif, Times New Roman and its likes; for a mono, Courier New), else in the first you gave, in the face of its style, and named in missingFonts.',
  },
  { title: 'Pictures', text: 'PNG of 8 or 16 bits to the sample, GIF (its first frame), and JPEG, which goes in as it is. Any other is left out and counted in missingPictures.' },
];

/** generate.ts in packages/mcp. */
export const CLI: { flag: string; text: string }[] = [
  { flag: 'template.docx', text: 'The template.' },
  { flag: 'data.json', text: 'Its values. Nested objects give dotted names: { "client": { "name": "Ana" } } fills {{client.name}}; a list fills a block, {{#lines}} … {{/lines}}.' },
  { flag: '-o out.pdf | out.docx | out.md', text: 'What to make, by its extension.' },
  { flag: '--fonts folder', text: 'Where the .ttf, .otf and .ttc files are, for a PDF; more than one may be given. Then those of the system.' },
  {
    flag: '--locale en-US · --currency EUR',
    text: 'The language dates and numbers are written in, and the currency of currency. Left out, the language of the document (or English) and a dollar sign.',
  },
  { flag: '--list', text: 'Only the names of the variables of the template, one a line, and its blocks.' },
];

/** Where @rebodocs/core runs: it uses no API of Node (no node:, Buffer or process), only the language and Intl. */
export const RUNTIMES: { title: string; text: string }[] = [
  { title: 'Node', text: 'Any version still supported; it is tested on 22. Read templates and fonts with fs, once, when the server starts.' },
  { title: 'Deno and Bun', text: 'The same package, from npm.' },
  { title: 'Workers and the edge', text: 'Cloudflare Workers, Vercel and Netlify Edge: there is no disk, so templates and fonts come as bytes, bundled or fetched.' },
  { title: 'The browser', text: 'As on this page: the demo above makes its PDF without a server.' },
];

/** What @rebodocs/core does without an editor, by what it is for: the names, from its modules. */
export const CATALOG: { title: string; module: string; calls: string[] }[] = [
  { title: 'Text', module: 'ops.ts, find.ts', calls: ['insertText', 'deleteRange', 'splitParagraph', 'findAll', 'replaceAll', 'replaceRange', 'textInRange', 'docText'] },
  { title: 'Look', module: 'ops.ts, styles.ts', calls: ['applyRunProps', 'setParagraphProps', 'setParagraphStyle', 'toggleList', 'setListStyle', 'restartNumbering'] },
  { title: 'Tables', module: 'tables.ts', calls: ['insertTable', 'insertRow', 'deleteRow', 'insertColumn', 'mergeCells', 'setCellProps', 'setHeaderRow', 'insertSignatures'] },
  { title: 'Pictures', module: 'images.ts', calls: ['insertImage', 'insertImageGrid', 'resizePicture', 'setPictureWrap', 'imageTypeOf'] },
  { title: 'Page', module: 'sections.ts, pageNumbers.ts', calls: ['setSectionPage', 'insertSectionBreak', 'setColumns', 'setPageNumbering', 'setOwnFirstPage', 'setEndnotesAt', 'setNoteNumbering'] },
  { title: 'Links and contents', module: 'links.ts, toc.ts, footnotes.ts', calls: ['insertLink', 'setLink', 'insertToc', 'updateToc', 'insertFootnote', 'insertEndnote'] },
  { title: 'Review', module: 'revisions.ts, notes.ts', calls: ['revisionsOf', 'acceptRevisions', 'rejectRevisions', 'decideAllRevisions', 'addNote', 'removeNote'] },
  { title: 'Versions', module: 'versions.ts', calls: ['compareDocs', 'describeChange', 'restoreVersion'] },
  { title: 'Letterhead', module: 'letterhead.ts', calls: ['setLetterhead', 'removeLetterhead', 'pngLetterheadMargins', 'withLetterheadMargins'] },
  { title: 'Templates', module: 'variables.ts, blocks.ts', calls: ['variableNames', 'templateBlocks', 'fillVariables', 'variableProblems', 'formatValue'] },
];

/** What a PDF made here has, and what it has not, from pdf.ts and render.ts. */
export const PDF_HAS = [
  'The fonts inside it, and text that can be selected, searched and copied.',
  'Links that open: to an address, and inside the document to its bookmarks, as the entries of a table of contents do.',
  'Headers, footers, page numbers, notes at the foot of the page and at the end, tables, columns, text boxes and letterheads, where the editor puts them.',
  'Its title, the one given to renderPdf, and its language.',
  'Tags for screen readers: headings, lists, tables, notes, links, and pictures with their description. See Accessibility.',
  'The headings as bookmarks in the side bar of the reader.',
];
export const PDF_HAS_NOT = ['PDF/A for archiving, forms to fill, a password or a signature.', 'Author, subject or keywords.'];

/** Measured on an Apple M1 with Node 22: a template of the receipt below, its block repeated, the median of seven runs, with the fonts already read. */
export const SPEED: { pages: number; fill: string; docx: string; pdf: string; size: string }[] = [
  { pages: 1, fill: '1 ms', docx: '0.6 ms', pdf: '3 ms', size: '12 KB' },
  { pages: 6, fill: '7 ms', docx: '0.9 ms', pdf: '17 ms', size: '25 KB' },
  { pages: 30, fill: '26 ms', docx: '3 ms', pdf: '77 ms', size: '81 KB' },
];
