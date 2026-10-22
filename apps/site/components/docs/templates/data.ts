// What the page "Templates and variables" says that is data, each checked in
// packages/core/src/variables.ts, blocks.ts and tables.ts (insertSignatures),
// packages/editor/src/editor.ts and panel.ts, and packages/mcp/src/tools.ts.

import type { FormatId } from '@rebodocs/core';

/** How a variable is read, from VARIABLE and findVariables in variables.ts. */
export const RULES: { title: string; text: string }[] = [
  { title: 'The name', text: 'Letters of any language, digits and underscores, and then also spaces, dots and dashes: {{client}}, {{client.name}}, {{fecha de firma}}. Spaces inside the braces are left out: {{ client }} is {{client}}.' },
  { title: 'Formats', text: 'Each after a bar, and applied from left to right: {{date | long date | upper}} writes the date, then puts it in capitals. A format it does not know is left out, and variableProblems names it.' },
  { title: 'Its look', text: 'The value takes the formatting of the text it stands in: a bold {{client}} is filled with a bold name. Word often breaks a word into pieces of the same look; the variable is found all the same.' },
  { title: 'Where', text: 'The text and its tables, every header and footer (the first page’s and each section’s among them), the notes at the foot of the page and the text boxes.' },
  { title: 'Tracked changes', text: 'Text taken out while changes are tracked is not part of a variable: what is read is what the document says. A variable put in while they were tracked gives its value as put in, by the same person.' },
  { title: 'Not a variable', text: '{single}, {{}}, or a name with a sign in it such as {{a}b}} stay as they are. So does a variable given no value; one given an empty value is taken away.' },
];

/** How a block is written, from blocks.ts: where its marks are says what it repeats. */
export const BLOCK_KINDS: { title: string; where: string; text: string }[] = [
  { title: 'A row of a table', where: '{{#lines}} in a cell, {{/lines}} in a cell of the same row', text: 'The row is written once for each item: the lines of an invoice, the people of a contract. A list without items takes the row away.' },
  { title: 'Paragraphs', where: '{{#annex}} and {{/annex}} each a paragraph of its own', text: 'What is between them, tables included, is written once for each item, or kept or taken away. The paragraphs of the marks go.' },
  { title: 'Text', where: 'both marks in one paragraph', text: 'The text between them: {{#vip}}, our valued member{{/vip}}, or {{#tags}}{{tags}}, {{/tags}} for a list of words.' },
];

export const BLOCK_RULES: { title: string; text: string }[] = [
  { title: 'Lists', text: 'An item that is an object gives its fields by the name of the block: {{lines.price}}. An item that is text is the name itself: {{tags}}. Blocks go inside blocks, {{#orders.lines}} inside {{#orders}}, each with its own item.' },
  { title: 'Yes or no', text: 'A value that is not a list keeps the block once, or takes it away when it is false, empty, 0, "false" or "0", or a list without items. {{^name}} … {{/name}} is the other way round: for “nothing ordered”.' },
  { title: 'Not given', text: 'A block with no value stays as it is, marks and all, as a variable does: a document can be filled in steps.' },
  { title: 'What is not repeated', text: 'A section break, a table inside the row to repeat, and marks that are neither in one paragraph, nor in one row, nor paragraphs of their own: those blocks stay as they are. Copies after the first leave out notes, bookmarks and floating pictures, which a document has once.' },
];

/** The names a format is read by, besides its English and its Spanish one, from FORMATS. */
export const ALIASES: Record<FormatId, string[]> = {
  upper: ['uppercase', 'mayúscula'],
  lower: ['lowercase', 'minúscula'],
  capital: ['title case', 'capitalizar'],
  bold: ['negritas'],
  italic: ['cursivas', 'itálica'],
  underline: [],
  date: ['fecha corta'],
  dateLong: ['dateLong'],
  dateFull: ['dateFull'],
  number: [],
  currency: ['importe'],
};

/** The rows of the table of formats: the "written as" columns are worked out by formatValue when the site is built. */
export const FORMAT_ROWS: { id: FormatId; arg?: string; value: string }[] = [
  { id: 'upper', value: 'ana pérez' },
  { id: 'lower', value: 'ANA PÉREZ' },
  { id: 'capital', value: 'ana pérez' },
  { id: 'bold', value: 'Ana' },
  { id: 'number', value: '1234567.5' },
  { id: 'number', arg: '2', value: '1234.5' },
  { id: 'currency', value: '2500' },
  { id: 'currency', arg: 'EUR', value: '2500' },
  { id: 'date', value: '2026-10-13' },
  { id: 'date', arg: 'd MMMM yyyy', value: '2026-10-13' },
  { id: 'dateLong', value: '2026-10-13' },
  { id: 'dateFull', value: '2026-10-13' },
];

/** The languages of the table of formats. None given is en-US. */
export const LOCALES = ['en-US', 'es-MX', 'de-DE'];

/** @rebodocs/core, from variables.ts and tables.ts. */
export const CORE: { sig: string; text: string }[] = [
  { sig: 'variableNames(doc) → string[]', text: 'The names of the variables, each once, in the order they first appear: the text first, then the headers and footers, the notes and the text boxes.' },
  {
    sig: 'fillVariables(doc, values, { locale?, currency?, today? }) → Doc',
    text: 'The document with each variable that has a value replaced by it, as its formats ask, in every part. A variable left out of values stays as it is, so a document can be filled in steps. The same document comes back when there was nothing to fill. Without a locale, values are written in the language of the document, or in English.',
  },
  { sig: 'variableProblems(doc, values, options?) → { name, format, kind }[]', text: 'What would go wrong, before you fill: kind "format" for a format there is not, "value" for a value that is not what its format is for (not a date, not a number), which would be put as given.' },
  { sig: 'formatValue(value, formats, options?) → { text, props, problems }', text: 'One value as its formats ask, without a document: the text, the bold, italic or underline they add, and what could not be applied. Without a locale, in English (en-US).' },
  { sig: 'findAllVariables(doc) → (Variable & { part? })[]', text: 'Every use of every variable, in every part, with the part it is in (none for the text) and its range in that part: \'firstHeader\', \'header@0\' for a section’s own, \'footnote:1\', \'textbox:7\'.' },
  { sig: 'templateBlocks(doc) → { name, inverted, kind }[]', text: 'The blocks of the template in every part, each once by its name and sign: kind is \'row\', \'paragraphs\' or \'text\'.' },
  { sig: 'variableUses(doc, name) → number', text: 'How many times a variable is used.' },
  { sig: 'variableFormats(doc, name) → { id, arg }[]', text: 'The formats every use of a variable has: what the panel shows as set.' },
  {
    sig: 'setVariableFormat(doc, name, id, on, arg?, language?) → Doc',
    text: 'Gives a format to every use of a variable, or takes it away. A way of writing a date or a number takes the place of the one there was, and so does a change of capitals; bold, italic and underline add up. Written in the language given, or else the document’s: Spanish names when it starts with "es", English ones otherwise or when there is none.',
  },
  { sig: 'formatText(id, arg?, language?) → string', text: 'How a format is written in a document: formatText(\'date\', \'dd/MM/yyyy\') is "date: dd/MM/yyyy"; with \'es\', "fecha: dd/MM/yyyy".' },
  { sig: 'findVariables(doc) → Variable[]', text: 'The variables of the paragraphs given, with where each is: { name, formats, range }. Give it a header as { paragraphs } to look in that part.' },
  { sig: 'variableText(name, formats?) · isVariableName(name)', text: 'The text of a variable, {{name | format}}, and whether a name can be one.' },
  { sig: 'insertSignatures(doc, pos, titles?, name?) → { doc, pos, name? }', text: 'A place to sign for each title, side by side, at pos: a table of one row without borders, each cell with the title, a line and a name under it, centred and bold. name is the range of the first name, to type over it.' },
];

/** The Editor, from editor.ts. */
export const EDITOR: { sig: string; text: string }[] = [
  { sig: 'editor.variables', text: 'The names of the variables of the document, in every part.' },
  { sig: 'editor.activeVariable', text: 'The variable the caret is in, or the selection is.' },
  { sig: 'editor.blocks', text: 'The blocks of the template, as templateBlocks gives them.' },
  { sig: 'editor.insertVariable(name)', text: 'Puts {{name}} at the caret, or in place of the selection.' },
  { sig: 'editor.fillVariables(data)', text: 'Fills them everywhere and writes out the blocks given a value, in the language of formatLocale, as one step to undo. While changes are tracked, the filling is tracked: each variable taken out, its value put in.' },
  { sig: 'editor.selectVariable(name)', text: 'Selects the next place the variable is used after the caret, going round at the end: in the text, then the headers and footers, the notes and the text boxes, going into the one it is in.' },
  { sig: 'editor.variableFormats(name) · editor.variableUses(name)', text: 'As in the core, on the document of the editor.' },
  { sig: 'editor.setVariableFormat(name, id, on, arg?)', text: 'As in the core, written in the language of the interface, as one step to undo, and tracked while changes are.' },
  { sig: 'editor.formatLocale', text: 'The language values are written in: the language of the text (chosen at the foot of the editor, the language prop, the one the file says, or the interface’s when the document was opened), with the browser’s region.' },
  { sig: 'editor.insertSignatures(titles?)', text: 'Signatures at the caret, ADVISER and CLIENT when no titles are given, with the first name selected to type over.' },
];

/** The Variables tab of the side panel, from panel.ts. */
export const PANEL: { title: string; text: string }[] = [
  { title: 'A box for each', text: 'Named so it reads: clientName, client_name and client.name all show as “Name”, under “Client” when other variables start with client. With more than six, a box to find one.' },
  { title: 'Fill', text: '“Fill 3 variables in the document” puts every value typed in, as one step to undo; Enter in a box, or its ✓, fills that one alone. The values stay in the boxes, so undoing gives the variables back with them.' },
  { title: 'How it is written', text: 'The sliders open the data type (text, date, long date, full date, number, currency, each shown as it will come out), the letter case, and bold, italic or underline. A number also takes its decimals, an amount its currency (EUR, MXN), a date a pattern (d MMMM yyyy). Under the box, what the value will come out as, or why it cannot.' },
  { title: 'Load data…', text: 'The values from a .json file: { "client": { "name": "Ana" } } fills client.name, and a list is kept as it is for the block of its name.' },
  { title: 'Blocks', text: 'Each block, with what it repeats: kept or taken out, or once for each item of a list loaded. Its marks stand out in the text like variables.' },
  { title: 'Go to', text: 'The target selects the next place the variable is used, in the header or a note too. A count says how many there are, when more than one.' },
  { title: 'New variable', text: 'A name and Insert puts it at the caret. Or select a word and press {{ }} Variable in the bar beside the selection; or Insert → Variable… in the toolbar.' },
];

/** The tools of an assistant, from mcp/src/tools.ts. */
export const TOOLS: { sig: string; text: string }[] = [
  { sig: 'list_variables', text: 'Each variable with how many times it is used and the formats it is given, and each block with what it repeats.' },
  { sig: 'fill_variables { values, locale?, currency? }', text: 'Fills them everywhere, lists and yes or no for the blocks among the values, and says how many it filled, which are still without a value, which names are not variables of the document, and which values a format could not write.' },
  { sig: 'insert_signatures', text: 'Signature lines after a paragraph, with the titles and names given.' },
];
