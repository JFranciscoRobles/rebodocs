// What an assistant can do to a document, as tools: each has a name, a
// description, the shape of its arguments and a function from a document to
// what it says and, when it changes something, the document after. They are
// pure and use nothing of Node or of the browser, so the same ones run in the
// server, on a file, and in the page of the editor, on the document open there.
//
// Paragraphs go by their number, from 1, as `read_document` shows them. A
// place inside a paragraph goes by its text: what to find, and which time.

import {
  type Doc,
  type StoryPart,
  storyKind,
  storyOf,
  withStory,
  type PageNumberFormat,
  type Story,
  type ListKind,
  type Paragraph,
  type Position,
  type Range,
  type RunProps,
  HIGHLIGHT_COLORS,
  NOTE_COLORS,
  addNote,
  applyRunProps,
  canMergeCells,
  canSplitCell,
  deleteColumn,
  deleteRow,
  imageExtension,
  insertColumn,
  insertImage,
  insertRow,
  jpegSize,
  locateCell,
  mergeCells,
  pageNumbering,
  setCellProps,
  setPageNumbering,
  setParagraphProps,
  splitCell,
  cleanHref,
  defined,
  deleteRange,
  fillVariables,
  findAll,
  findVariables,
  insertSignatures,
  insertTable,
  insertText,
  MIN_COLUMN_WIDTH,
  movePicture,
  resizePicture,
  insertToc,
  leaveList,
  linkHref,
  listKindAt,
  listLabels,
  noteExcerpt,
  noteRanges,
  outline,
  paragraphLength,
  paragraphStyles,
  propsAt,
  removeLink,
  removeNote,
  replaceRange,
  setLink,
  setParagraphStyle,
  styleIdAt,
  toggleList,
  tocRange,
  updateToc,
  variableNames,
  variableProblems,
  variableUses,
} from '@rebodocs/core';

/** What a tool needs that is not in the document. */
export interface ToolContext {
  /** The page each paragraph of a document starts on, from 1: for a table of contents. Without it there is no way to number one. */
  pageOf?: (doc: Doc) => (para: number) => number;
  /** How many of the tables of the document being worked on cannot be given another shape: those a header or a footer came with from its file. */
  fixedTables?: number;
  /** Who the notes it writes are by, when the assistant does not say. */
  author?: string;
  now?: Date;
}

export interface ToolResult {
  text: string;
  /** The document after the tool, when it changed it. */
  doc?: Doc;
  /** Where the change is, for whoever shows the document to bring it into view. */
  reveal?: Position;
}

type Args = Record<string, unknown>;

export interface Tool {
  name: string;
  description: string;
  /** The properties of its arguments, as JSON Schema, and which of them must be given. */
  properties: Record<string, unknown>;
  required?: string[];
  /** True when it changes the document. */
  writes: boolean;
  /** True when it can also be told to act on the header or the footer, with "area". */
  areas?: boolean;
  run(doc: Doc, args: Args, context: ToolContext): ToolResult;
}

/** What went wrong in a way the assistant can put right: said back to it, not thrown at the person. */
export class ToolError extends Error {}

const fail = (message: string): never => {
  throw new ToolError(message);
};

// --- Reading arguments ----------------------------------------------------------

const text = (args: Args, name: string): string => {
  const value = args[name];
  return typeof value === 'string' && value ? value : fail(`"${name}" must be a text that is not empty.`);
};
const optionalText = (args: Args, name: string): string | undefined => {
  const value = args[name];
  return value === undefined || value === null ? undefined : typeof value === 'string' ? value : fail(`"${name}" must be a text.`);
};
const optionalFlag = (args: Args, name: string): boolean | undefined => {
  const value = args[name];
  return value === undefined || value === null ? undefined : typeof value === 'boolean' ? value : fail(`"${name}" must be true or false.`);
};
const whole = (args: Args, name: string): number | undefined => {
  const value = args[name];
  if (value === undefined || value === null) return undefined;
  return typeof value === 'number' && Number.isInteger(value) ? value : fail(`"${name}" must be a whole number.`);
};

/** The index of the paragraph numbered `args[name]`. */
function paragraphIndex(doc: Doc, args: Args, name: string, fallback?: number): number {
  const n = whole(args, name) ?? fallback ?? fail(`"${name}" is needed: the number of a paragraph, as read_document shows it.`);
  if (n < 1 || n > doc.paragraphs.length) fail(`There is no paragraph ${n}: the document has ${doc.paragraphs.length}.`);
  return n - 1;
}

/** The paragraph a new one goes after, as an index: -1 to go first. */
function afterIndex(doc: Doc, args: Args): number {
  const n = whole(args, 'after_paragraph') ?? fail('"after_paragraph" is needed: the number of the paragraph to insert after, or 0 to insert at the start.');
  if (n < 0 || n > doc.paragraphs.length) fail(`"after_paragraph" must be between 0 and ${doc.paragraphs.length}.`);
  return n - 1;
}

// --- Reading the document -------------------------------------------------------

/** The text of a paragraph as a person reads it: without the marks that take no room, a picture as a word. */
const shown = (p: Paragraph): string =>
  p.runs
    .map((run) => (run.props.anchor ? '' : run.props.object ? '[image]'.repeat(run.text.length) : run.text))
    .join('')
    .replace(/\f/g, '[page break]')
    .replace(/\t/g, ' → ');

const words = (doc: Doc): number => doc.paragraphs.reduce((sum, p) => sum + (shown(p).match(/\S+/g)?.length ?? 0), 0);

const styleNames = (doc: Doc): string => paragraphStyles(doc).map((style) => style.id).join(', ');

function line(doc: Doc, index: number, labels: ReturnType<typeof listLabels>): string {
  const p = doc.paragraphs[index];
  const style = styleIdAt(doc, index);
  const at = p.cell ? locateCell(doc, index) : undefined;
  const tags = [
    style === paragraphStyles(doc)[0].id ? '' : style,
    // Where the cell is in its table: what the paragraph holds are the names of its row and its cell, which stay when others come and go.
    at ? `table ${at.tableIndex + 1}, row ${at.rowIndex + 1}, cell ${at.cellIndex + 1}` : '',
  ].filter(Boolean);
  // The bullet of a list is a sign of a symbol font: here it is said as one that reads anywhere.
  const label = listKindAt(doc, index) === 'bullet' ? '•' : labels[index]?.text;
  return `[${index + 1}]${tags.length ? ` (${tags.join('; ')})` : ''} ${label ? `${label} ` : ''}${shown(p)}`;
}

/** The lines of the paragraphs from `from` to `to`, as `read_document` gives them. */
function lines(doc: Doc, from: number, to: number): string {
  const labels = listLabels(doc);
  const out: string[] = [];
  for (let i = from; i <= to; i++) out.push(line(doc, i, labels));
  return out.join('\n');
}

const READ_LIMIT = 24000;

// --- Finding a place by its text ------------------------------------------------

const PLACE = {
  find: { type: 'string', description: 'The exact text to act on, as it reads in the document. Capital and small letters count.' },
  paragraph: { type: 'integer', description: 'Only look in this paragraph (its number from read_document).' },
  occurrence: { type: 'integer', description: 'Which match to use when the text is found more than once: 1 for the first.' },
};

/** The places `args.find` is found, narrowed by `paragraph` and `occurrence`. With `all` every one of them; otherwise it has to be one. */
function places(doc: Doc, args: Args, all = false): Range[] {
  const query = text(args, 'find');
  const only = whole(args, 'paragraph');
  let found = findAll(doc, query, { matchCase: true });
  if (only !== undefined) found = found.filter((range) => range.from.para === only - 1);
  if (!found.length) {
    const loose = findAll(doc, query).length;
    fail(`"${query}" is not in ${only === undefined ? 'the document' : `paragraph ${only}`}.${loose ? ' It is there with other capital letters: copy it as it reads.' : ' A text has to be inside one paragraph: read the document again and copy it exactly.'}`);
  }
  const nth = whole(args, 'occurrence');
  if (nth !== undefined) return [found[nth - 1] ?? fail(`"${query}" is found ${found.length} times: there is no occurrence ${nth}.`)];
  if (all || found.length === 1) return found;
  const where = found.map((range) => range.from.para + 1).join(', ');
  return fail(`"${query}" is found ${found.length} times, in paragraphs ${where}. Say which with "paragraph" or "occurrence", or make "find" longer.`);
}

/** Applies `change` to each place, the last first, so that the ones before stay where they were. */
const each = (doc: Doc, found: Range[], change: (doc: Doc, range: Range) => Doc): Doc => [...found].reverse().reduce(change, doc);

const said = (found: Range[]) => (found.length === 1 ? `paragraph ${found[0].from.para + 1}` : `${found.length} places`);

// --- New paragraphs -------------------------------------------------------------

/** Paragraphs of plain text put in after the one at `after` (-1: first), in the font of the text around and in the cell it is in. */
function spliced(doc: Doc, after: number, texts: string[]): Doc {
  const near = doc.paragraphs[Math.max(after, 0)];
  const like = propsAt(doc, { para: Math.max(after, 0), offset: 0 });
  const props: RunProps = defined({ fontFamily: like.fontFamily });
  const made: Paragraph[] = texts.map((value) => defined({ props: {}, runs: [{ text: value.replace(/\r?\n/g, '\n'), props }], cell: after < 0 ? undefined : near.cell }));
  const paragraphs = doc.paragraphs.slice();
  paragraphs.splice(after + 1, 0, ...made);
  const normal = paragraphStyles(doc)[0].id;
  return setParagraphStyle({ ...doc, paragraphs }, after + 1, after + made.length, normal);
}

function styleId(doc: Doc, wanted: string): string {
  const styles = paragraphStyles(doc);
  const lower = wanted.trim().toLowerCase();
  const style = styles.find((s) => s.id.toLowerCase() === lower) ?? styles.find((s) => s.name.toLowerCase() === lower || s.wordName?.toLowerCase() === lower);
  return style?.id ?? fail(`There is no style "${wanted}". The styles of this document are: ${styleNames(doc)}.`);
}

const inTable = (doc: Doc, from: number, to: number) => doc.paragraphs.slice(from, to + 1).some((p) => p.cell);

// --- The tools ------------------------------------------------------------------

/** Points in a centimetre, and in a pixel of a picture. */
const CM = 72 / 2.54;
const PX = 0.75;

/** The size of a picture in pixels, read from the start of its file. */
function pictureSize(bytes: Uint8Array, type: string): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let size: { width: number; height: number } | undefined;
  if (type === 'image/png' && bytes.length > 24 && view.getUint32(0) === 0x89504e47) size = { width: view.getUint32(16), height: view.getUint32(20) };
  else if (type === 'image/jpeg') size = jpegSize(bytes);
  else if (type === 'image/gif' && bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49) size = { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  return size && size.width > 0 && size.height > 0 ? size : undefined;
}

const COLOR = /^#?([0-9a-fA-F]{6})$/;
const color = (value: string, name: string): string => COLOR.exec(value)?.[1].toUpperCase() ?? fail(`"${name}" must be a colour as six hex digits, like C0392B.`);

export const TOOLS: Tool[] = [
  {
    name: 'get_overview',
    description: 'A summary of the document: how long it is, its headings with the paragraph each is at, its template variables, its notes and its paragraph styles. Start here.',
    properties: {},
    writes: false,
    run(doc) {
      const headings = outline(doc).map((item) => `${'  '.repeat(Math.max(item.level - 1, 0))}- ${item.text} [${item.para + 1}]`);
      const names = variableNames(doc);
      const story = (name: string, part: Doc['header']) => {
        const body = (part?.paragraphs ?? []).map(shown).filter((value) => value.trim()).join(' / ');
        return body ? `${name}: ${body}` : '';
      };
      return {
        text: [
          `${doc.paragraphs.length} paragraphs, ${words(doc)} words, ${(doc.tables ?? []).filter((table) => table.rows.length).length} tables, ${doc.notes?.length ?? 0} notes.`,
          tocRange(doc) ? 'It has a table of contents.' : '',
          story('Header', doc.header),
          story('Footer', doc.footer),
          doc.firstPage ? 'The first page has a header and a footer of its own ("first_header", "first_footer").' : '',
          story('First page header', doc.firstPage?.header),
          story('First page footer', doc.firstPage?.footer),
          headings.length ? `Headings (with their paragraph):\n${headings.join('\n')}` : 'It has no headings.',
          names.length ? `Template variables: ${names.join(', ')}` : '',
          `Paragraph styles: ${styleNames(doc)}`,
        ]
          .filter(Boolean)
          .join('\n'),
      };
    },
  },
  {
    name: 'read_document',
    areas: true,
    description: 'The text of the document, one paragraph a line, each with its number in brackets and, in parentheses, its style and its table cell when it has them. A long document comes in parts: ask for the next with "from".',
    properties: {
      from: { type: 'integer', description: 'The first paragraph to read. 1 when left out.' },
      to: { type: 'integer', description: 'The last paragraph to read. The end when left out.' },
    },
    writes: false,
    run(doc, args) {
      const from = paragraphIndex(doc, args, 'from', 1);
      const to = paragraphIndex(doc, args, 'to', doc.paragraphs.length);
      if (to < from) fail('"to" is before "from".');
      const labels = listLabels(doc);
      const out: string[] = [];
      let size = 0;
      let i = from;
      for (; i <= to; i++) {
        const next = line(doc, i, labels);
        if (out.length && size + next.length > READ_LIMIT) break;
        out.push(next);
        size += next.length + 1;
      }
      const more = i <= to ? `\n… ${to - i + 1} more paragraphs: read on with from=${i + 1}.` : '';
      return { text: out.join('\n') + more };
    },
  },
  {
    name: 'find_text',
    areas: true,
    description: 'Every place a text is found, with the paragraph it is in and the words around it.',
    properties: {
      query: { type: 'string', description: 'The text to look for.' },
      match_case: { type: 'boolean', description: 'Capital and small letters count as different. False when left out.' },
      allword: { type: 'boolean', description: 'Only matches that are not part of a longer word. False when left out.' },
    },
    required: ['query'],
    writes: false,
    run(doc, args) {
      const query = text(args, 'query');
      const found = findAll(doc, query, { matchCase: optionalFlag(args, 'match_case') ?? false, wholeWord: optionalFlag(args, 'allword') ?? false });
      if (!found.length) return { text: `"${query}" is not in the document.` };
      const shownOnes = found.slice(0, 50).map((range) => {
        const whole = shown(doc.paragraphs[range.from.para]);
        const at = whole.toLowerCase().indexOf(query.toLowerCase());
        const start = Math.max(0, at - 40);
        return `[${range.from.para + 1}] ${start ? '…' : ''}${whole.slice(start, at + query.length + 40)}${at + query.length + 40 < whole.length ? '…' : ''}`;
      });
      return { text: `${found.length} ${found.length === 1 ? 'match' : 'matches'}${found.length > 50 ? ', the first 50' : ''}:\n${shownOnes.join('\n')}` };
    },
  },
  {
    name: 'replace_text',
    areas: true,
    description: 'Puts a text in place of another, in the formatting of what was there. The text to find has to be inside one paragraph. An empty "replace" deletes it.',
    properties: { ...PLACE, replace: { type: 'string', description: 'The text to put in its place.' }, all: { type: 'boolean', description: 'Replace every match, not just one.' } },
    required: ['find', 'replace'],
    writes: true,
    run(doc, args) {
      const replace = optionalText(args, 'replace') ?? '';
      const found = places(doc, args, optionalFlag(args, 'all') ?? false);
      const next = each(doc, found, (now, range) => (replace ? replaceRange(now, range, replace).doc : deleteRange(now, range)));
      return { text: `Replaced in ${said(found)}.\n${lines(next, found[0].from.para, found[0].from.para)}`, doc: next, reveal: found[0].from };
    },
  },
  {
    name: 'insert_paragraphs',
    areas: true,
    description: 'Writes new paragraphs after a paragraph. Each has its text and, when wanted, a style (a heading, for one) or a list. Text between double braces, like {{cliente}}, is a template variable.',
    properties: {
      after_paragraph: { type: 'integer', description: 'The number of the paragraph to insert after; 0 to insert at the start.' },
      paragraphs: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            style: { type: 'string', description: 'A paragraph style of the document, such as Heading1. The normal one when left out.' },
            list: { type: 'string', enum: ['bullet', 'number'], description: 'Makes the paragraph an item of a list.' },
          },
          required: ['text'],
        },
      },
    },
    required: ['after_paragraph', 'paragraphs'],
    writes: true,
    run(doc, args) {
      const after = afterIndex(doc, args);
      const given = Array.isArray(args.paragraphs) && args.paragraphs.length ? (args.paragraphs as Args[]) : fail('"paragraphs" must be a list with at least one paragraph.');
      const items = given.map((item) => ({ text: optionalText(item ?? {}, 'text') ?? '', style: optionalText(item ?? {}, 'style'), list: optionalText(item ?? {}, 'list') }));
      // Into a document, or a header, that is one empty paragraph, they go in its place.
      const blank = doc.paragraphs.length === 1 && !paragraphLength(doc.paragraphs[0]) && !doc.paragraphs[0].cell;
      const first = blank ? 0 : after + 1;
      let next = spliced(doc, after, items.map((item) => item.text));
      if (blank) next = { ...next, paragraphs: next.paragraphs.filter((_, i) => i !== (after < 0 ? items.length : 0)) };
      items.forEach((item, i) => {
        if (item.style) next = setParagraphStyle(next, first + i, first + i, styleId(next, item.style));
      });
      // Each stretch of items of one kind at once, so that a numbered one counts on.
      for (let i = 0; i < items.length; i++) {
        const kind = items[i].list;
        if (!kind) continue;
        if (kind !== 'bullet' && kind !== 'number') fail('"list" must be "bullet" or "number".');
        let end = i;
        while (items[end + 1]?.list === kind) end++;
        next = toggleList(next, first + i, first + end, kind as ListKind);
        i = end;
      }
      const last = first + items.length - 1;
      return { text: `Inserted as ${first === last ? `paragraph ${first + 1}` : `paragraphs ${first + 1} to ${last + 1}`}.${blank ? '' : ` The paragraphs after them moved down by ${items.length}.`}`, doc: next, reveal: { para: first, offset: 0 } };
    },
  },
  {
    name: 'delete_paragraphs',
    areas: true,
    description: 'Deletes whole paragraphs, from one to another. Not for the paragraphs of a table.',
    properties: { from: { type: 'integer', description: 'The first paragraph to delete.' }, to: { type: 'integer', description: 'The last one. The same as "from" when left out.' } },
    required: ['from'],
    writes: true,
    run(doc, args) {
      const from = paragraphIndex(doc, args, 'from');
      const to = paragraphIndex(doc, args, 'to', from + 1);
      if (to < from) fail('"to" is before "from".');
      if (inTable(doc, from, to)) fail('Some of those paragraphs are in a table. Empty a cell with replace_text; whole rows and tables are deleted in the editor.');
      const paragraphs = doc.paragraphs.slice();
      paragraphs.splice(from, to - from + 1);
      // A document always has a paragraph, and so does what comes before a table.
      if (!paragraphs.length || paragraphs.every((p) => p.cell)) paragraphs.splice(from, 0, { props: {}, runs: [{ text: '', props: defined({ fontFamily: propsAt(doc, { para: from, offset: 0 }).fontFamily }) }] });
      return { text: `Deleted ${to - from + 1} ${to === from ? 'paragraph' : 'paragraphs'}. The ones after moved up.`, doc: { ...doc, paragraphs }, reveal: { para: Math.min(from, paragraphs.length - 1), offset: 0 } };
    },
  },
  {
    name: 'set_style',
    areas: true,
    description: 'Gives paragraphs a paragraph style: a heading, a title, the normal text. get_overview lists the styles of the document.',
    properties: {
      from: { type: 'integer', description: 'The first paragraph.' },
      to: { type: 'integer', description: 'The last one. The same as "from" when left out.' },
      style: { type: 'string', description: 'The style, such as Heading1 or Normal.' },
    },
    required: ['from', 'style'],
    writes: true,
    run(doc, args) {
      const from = paragraphIndex(doc, args, 'from');
      const to = paragraphIndex(doc, args, 'to', from + 1);
      if (to < from) fail('"to" is before "from".');
      const id = styleId(doc, text(args, 'style'));
      return { text: `Paragraphs ${from + 1} to ${to + 1} are now ${id}.`, doc: setParagraphStyle(doc, from, to, id), reveal: { para: from, offset: 0 } };
    },
  },
  {
    name: 'set_list',
    areas: true,
    description: 'Makes paragraphs the items of a list with bullets or with numbers, or takes them out of the list they are in.',
    properties: {
      from: { type: 'integer', description: 'The first paragraph.' },
      to: { type: 'integer', description: 'The last one. The same as "from" when left out.' },
      kind: { type: 'string', enum: ['bullet', 'number', 'none'] },
    },
    required: ['from', 'kind'],
    writes: true,
    run(doc, args) {
      const from = paragraphIndex(doc, args, 'from');
      const to = paragraphIndex(doc, args, 'to', from + 1);
      if (to < from) fail('"to" is before "from".');
      const kind = text(args, 'kind');
      if (kind !== 'bullet' && kind !== 'number' && kind !== 'none') fail('"kind" must be "bullet", "number" or "none".');
      let next = doc;
      for (let i = from; i <= to; i++) if (listKindAt(next, i) && listKindAt(next, i) !== kind) next = leaveList(next, i);
      if (kind !== 'none' && !doc.paragraphs.slice(from, to + 1).every((_, i) => listKindAt(next, from + i) === kind)) next = toggleList(next, from, to, kind as ListKind);
      return { text: kind === 'none' ? `Paragraphs ${from + 1} to ${to + 1} are out of their list.` : `Paragraphs ${from + 1} to ${to + 1} are a ${kind} list.`, doc: next, reveal: { para: from, offset: 0 } };
    },
  },
  {
    name: 'format_text',
    areas: true,
    description: 'Changes how a text looks: bold, italic, underlined, struck through, its colour or the highlight behind it. Give only what is to change.',
    properties: {
      ...PLACE,
      all: { type: 'boolean', description: 'Every match, not just one.' },
      bold: { type: 'boolean' },
      italic: { type: 'boolean' },
      underline: { type: 'boolean' },
      strike: { type: 'boolean' },
      color: { type: 'string', description: 'The colour of the text, as six hex digits: C0392B.' },
      highlight: { type: 'string', description: `The colour behind the text: one of ${HIGHLIGHT_COLORS.join(', ')}; "none" to take it away.` },
    },
    required: ['find'],
    writes: true,
    run(doc, args) {
      const highlight = optionalText(args, 'highlight');
      const tint = optionalText(args, 'color');
      const patch = defined<RunProps>({
        bold: optionalFlag(args, 'bold'),
        italic: optionalFlag(args, 'italic'),
        underline: optionalFlag(args, 'underline'),
        strike: optionalFlag(args, 'strike'),
        color: tint === undefined ? undefined : color(tint, 'color'),
        highlight: highlight === undefined ? undefined : highlight === 'none' ? '' : color(highlight, 'highlight'),
      });
      if (!Object.keys(patch).length) fail('Say what to change: bold, italic, underline, strike, color or highlight.');
      if (patch.highlight && !HIGHLIGHT_COLORS.includes(patch.highlight)) fail(`Word only has these highlight colours: ${HIGHLIGHT_COLORS.join(', ')}.`);
      const found = places(doc, args, optionalFlag(args, 'all') ?? false);
      return { text: `Formatted in ${said(found)}.`, doc: each(doc, found, (now, range) => applyRunProps(now, range, patch)), reveal: found[0].from };
    },
  },
  {
    name: 'set_link',
    areas: true,
    description: 'Makes a text a link to a web page, a mail address or a telephone; or, with an empty "url", takes its link away.',
    properties: { ...PLACE, url: { type: 'string', description: 'Where the link goes: https://…, a mail address or tel:…. Empty to remove the link.' } },
    required: ['find', 'url'],
    writes: true,
    run(doc, args) {
      const url = optionalText(args, 'url') ?? '';
      const [range] = places(doc, args);
      if (!url.trim()) return { text: `Link removed in paragraph ${range.from.para + 1}.`, doc: removeLink(doc, range), reveal: range.from };
      const href = cleanHref(url) ?? fail(`"${url}" is not an address a link can open: use a web page, a mail address or tel:.`);
      return { text: `Paragraph ${range.from.para + 1}: linked to ${href}.`, doc: setLink(doc, range, href), reveal: range.from };
    },
  },
  {
    name: 'list_links',
    description: 'The links of the document: the text of each, where it goes and its paragraph.',
    properties: {},
    writes: false,
    run(doc) {
      const out: string[] = [];
      doc.paragraphs.forEach((p, para) => {
        let last: string | undefined;
        for (const run of p.runs) {
          const href = linkHref(run.props);
          if (href !== undefined && href === last) out[out.length - 1] = out[out.length - 1].replace(/" → /, `${run.text}" → `);
          else if (href !== undefined) out.push(`[${para + 1}] "${run.text}" → ${href}`);
          last = href;
        }
      });
      return { text: out.length ? out.join('\n') : 'The document has no links.' };
    },
  },
  {
    name: 'add_note',
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
    name: 'list_variables',
    description: 'The template variables of the document, written between double braces: the name of each, how many times it is used and the formats it is given (capitals, a date, money…).',
    properties: {},
    writes: false,
    run(doc) {
      const names = variableNames(doc);
      if (!names.length) return { text: 'The document has no variables. One is written between double braces: {{cliente}}, or with a format, {{fecha | fecha larga}}.' };
      const formats = new Map<string, Set<string>>();
      for (const part of [doc, doc.header, doc.footer]) {
        for (const use of part ? findVariables(part) : []) {
          const set = formats.get(use.name) ?? new Set<string>();
          formats.set(use.name, set);
          for (const format of use.formats) set.add(format);
        }
      }
      return { text: names.map((name) => `${name} — used ${variableUses(doc, name)}×${formats.get(name)?.size ? `; formats: ${[...formats.get(name)!].join(', ')}` : ''}`).join('\n') };
    },
  },
  {
    name: 'fill_variables',
    description: 'Puts a value in place of each template variable that is given one, everywhere in the document, its header and its footer, in the format the variable asks for. Dates go as YYYY-MM-DD and numbers plain (1234.5): the format writes them out. Variables with no value stay as they are.',
    properties: { values: { type: 'object', description: 'The value of each variable, by its name: { "cliente": "Ana Pérez", "fecha": "2026-10-12" }.', additionalProperties: { type: ['string', 'number'] } } },
    required: ['values'],
    writes: true,
    run(doc, args, context) {
      const given = args.values && typeof args.values === 'object' && !Array.isArray(args.values) ? (args.values as Args) : fail('"values" must be an object with the value of each variable by its name.');
      const values: Record<string, string> = {};
      for (const [name, value] of Object.entries(given)) if (value !== null && value !== undefined) values[name] = String(value);
      const names = variableNames(doc);
      const unknown = Object.keys(values).filter((name) => !names.includes(name));
      const today = context.now ? { today: context.now } : {};
      const problems = variableProblems(doc, values, today).map(({ name, format, kind }) =>
        kind === 'format' ? `{{${name}}} asks for a format that does not exist, "${format}": it was ignored.` : `The value of {{${name}}}, "${values[name]}", is not one "${format}" can write: it was put as given.`,
      );
      const next = fillVariables(doc, values, today);
      const left = variableNames(next);
      return {
        text: [
          `Filled ${names.length - left.length} of ${names.length} variables.`,
          left.length ? `Still without a value: ${left.join(', ')}.` : '',
          unknown.length ? `Not variables of this document: ${unknown.join(', ')}.` : '',
          ...problems,
        ]
          .filter(Boolean)
          .join('\n'),
        doc: next === doc ? undefined : next,
      };
    },
  },
  {
    name: 'insert_table',
    areas: true,
    description: 'Puts in a table after a paragraph, with the text of each cell. Every row must have the same number of cells.',
    properties: {
      after_paragraph: { type: 'integer', description: 'The number of the paragraph to insert after; 0 to insert at the start.' },
      rows: { type: 'array', minItems: 1, items: { type: 'array', minItems: 1, items: { type: 'string' } }, description: 'The rows, each a list with the text of its cells.' },
      header: { type: 'boolean', description: 'The first row is a heading, set in bold. True when left out.' },
    },
    required: ['after_paragraph', 'rows'],
    writes: true,
    run(doc, args) {
      const after = afterIndex(doc, args);
      const rows = Array.isArray(args.rows) && args.rows.length ? (args.rows as unknown[]) : fail('"rows" must be a list of rows.');
      const cells = rows.map((row) => (Array.isArray(row) && row.length ? row.map((cell) => String(cell ?? '')) : fail('Each row must be a list with the text of its cells.')));
      if (cells.some((row) => row.length !== cells[0].length)) fail('Every row must have the same number of cells.');
      if (cells[0].length > 12) fail('A table can have 12 columns at most.');
      if (after >= 0 && doc.paragraphs[after].cell) fail('A table cannot go inside another: choose a paragraph outside the table.');
      const at = after + 1;
      const made = insertTable(spliced(doc, after, ['']), { para: at, offset: 0 }, cells.length, cells[0].length).doc;
      if (made.paragraphs.length === doc.paragraphs.length + 1) fail('A table cannot go there.');
      const first = made.paragraphs.findIndex((p, i) => i >= at && p.cell);
      const flat = cells.flat();
      let next = made;
      for (let i = flat.length - 1; i >= 0; i--) if (flat[i]) next = insertText(next, { para: first + i, offset: 0 }, flat[i]).doc;
      if (optionalFlag(args, 'header') ?? true) {
        const last = first + cells[0].length - 1;
        next = applyRunProps(next, { from: { para: first, offset: 0 }, to: { para: last, offset: paragraphLength(next.paragraphs[last]) } }, { bold: true });
      }
      return { text: `Table of ${cells.length} × ${cells[0].length} inserted: its cells are paragraphs ${first + 1} to ${first + flat.length}.`, doc: next, reveal: { para: first, offset: 0 } };
    },
  },
  {
    name: 'insert_signatures',
    description: 'Puts in a block of signatures after a paragraph: side by side, each with its title (such as ASESOR and CLIENTE), a line to sign on and the name under it.',
    properties: {
      after_paragraph: { type: 'integer', description: 'The number of the paragraph to insert after.' },
      titles: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string' }, description: 'The title over each signature.' },
      names: { type: 'array', items: { type: 'string' }, description: 'The name under each line, in the order of the titles. A variable, like {{cliente | mayúsculas}}, makes it a template.' },
    },
    required: ['after_paragraph', 'titles'],
    writes: true,
    run(doc, args) {
      const after = afterIndex(doc, args);
      const titles = Array.isArray(args.titles) && args.titles.length ? args.titles.map(String) : fail('"titles" must be a list with the title of each signature.');
      if (titles.length > 4) fail('There is room for 4 signatures side by side at most.');
      const names = Array.isArray(args.names) ? args.names.map(String) : [];
      if (after >= 0 && doc.paragraphs[after].cell) fail('The signatures cannot go inside a table: choose a paragraph outside it.');
      const at = after + 1;
      const made = insertSignatures(spliced(doc, after, ['']), { para: at, offset: 0 }, titles, names[0]).doc;
      const first = made.paragraphs.findIndex((p, i) => i >= at && p.cell);
      if (first < 0) fail('The signatures cannot go there.');
      // Each cell has its title, its line and its name: the name is the third paragraph of each.
      const paragraphs = made.paragraphs.map((p, i) => {
        const cell = Math.floor((i - first) / 3);
        if (i < first || cell >= titles.length || (i - first) % 3 !== 2 || names[cell] === undefined) return p;
        return { ...p, runs: [{ ...p.runs[0], text: names[cell] }] };
      });
      return { text: `Signatures inserted in paragraphs ${first + 1} to ${first + titles.length * 3}.`, doc: { ...made, paragraphs }, reveal: { para: first, offset: 0 } };
    },
  },
  {
    name: 'edit_table',
    areas: true,
    description:
      'Changes the shape or the look of a table that is there. "paragraph" is any paragraph of the cell to act on (read_document says which cell each is in). Actions: insert_row_above, insert_row_below, insert_column_left, insert_column_right, delete_row, delete_column, merge_cells (from "paragraph" to "to_paragraph"), split_cell (undoes a merge), set_column_widths (with "widths_cm", one for each column), shade_cells (with "shade"; to "to_paragraph" for several), show_borders, hide_borders (the whole table) and delete_table. The text of a cell is changed with replace_text and insert_paragraphs.',
    properties: {
      paragraph: { type: 'integer', description: 'A paragraph of the cell to act on.' },
      action: { type: 'string', enum: ['insert_row_above', 'insert_row_below', 'insert_column_left', 'insert_column_right', 'delete_row', 'delete_column', 'merge_cells', 'split_cell', 'set_column_widths', 'shade_cells', 'show_borders', 'hide_borders', 'delete_table'] },
      widths_cm: { type: 'array', items: { type: 'number' }, description: 'For set_column_widths: how wide each column is, in centimetres, from the left.' },
      to_paragraph: { type: 'integer', description: 'A paragraph of the cell at the other corner, for merge_cells and shade_cells.' },
      shade: { type: 'string', description: 'For shade_cells: the colour behind the cells, as six hex digits (E8EEF9); "none" to take it away.' },
    },
    required: ['paragraph', 'action'],
    writes: true,
    run(doc, args, context) {
      const para = paragraphIndex(doc, args, 'paragraph');
      const at = locateCell(doc, para) ?? fail(`Paragraph ${para + 1} is not in a table.`);
      if (at.tableIndex < (context.fixedTables ?? 0) && !['shade_cells', 'show_borders', 'hide_borders'].includes(String(args.action))) {
        fail('A table the header or the footer of the file came with cannot be given another shape here: change the text of its cells, or make a new table.');
      }
      const other = whole(args, 'to_paragraph') === undefined ? para : paragraphIndex(doc, args, 'to_paragraph');
      if (doc.paragraphs[other].cell?.table !== at.tableIndex) fail(`Paragraph ${other + 1} is not in the same table.`);
      const action = text(args, 'action');
      /** The paragraphs of the table, which are one after another. */
      const span = (now: Doc, table: number) => {
        const from = now.paragraphs.findIndex((p) => p.cell?.table === table);
        let to = from;
        while (now.paragraphs[to + 1]?.cell?.table === table) to++;
        return { from, to };
      };
      const all = span(doc, at.tableIndex);
      let next: Doc;
      switch (action) {
        case 'insert_row_above':
        case 'insert_row_below':
          next = insertRow(doc, para, action === 'insert_row_below');
          break;
        case 'insert_column_left':
        case 'insert_column_right':
          next = insertColumn(doc, para, action === 'insert_column_right');
          break;
        case 'delete_row':
          next = deleteRow(doc, para).doc;
          break;
        case 'delete_column':
          next = deleteColumn(doc, para).doc;
          break;
        case 'merge_cells':
          if (other === para) fail('merge_cells needs "to_paragraph": a paragraph of the cell at the other corner.');
          if (!canMergeCells(doc, para, other)) fail('Those cells cannot be merged: they must make a rectangle of whole cells.');
          next = mergeCells(doc, para, other).doc;
          break;
        case 'split_cell':
          if (!canSplitCell(doc, para)) fail('That cell is not a merged one: only a merge can be split.');
          next = splitCell(doc, para);
          break;
        case 'set_column_widths': {
          const given = Array.isArray(args.widths_cm) ? args.widths_cm : fail('set_column_widths needs "widths_cm": the width of each column, in centimetres.');
          if (given.length !== at.table.columns.length) fail(`The table has ${at.table.columns.length} columns: give ${at.table.columns.length} widths.`);
          const widths = given.map((value) => (typeof value === 'number' && value > 0 ? value * CM : fail('Each width must be a number above 0.')));
          if (widths.some((width) => width < MIN_COLUMN_WIDTH)) fail(`A column cannot be narrower than ${(MIN_COLUMN_WIDTH / CM).toFixed(1)} cm.`);
          const room = doc.page.width - doc.page.marginLeft - doc.page.marginRight;
          const total = widths.reduce((sum, width) => sum + width, 0);
          if (total > room + 0.5) fail(`Those widths add up to ${(total / CM).toFixed(1)} cm, and there are ${(room / CM).toFixed(1)} cm between the margins.`);
          const tables = (doc.tables ?? []).slice();
          // The widths are now the ones given: the table no longer follows the width of the page.
          const { widthFraction: _, ...rest } = at.table;
          tables[at.tableIndex] = { ...rest, columns: widths, fixed: true };
          next = { ...doc, tables };
          break;
        }
        case 'shade_cells': {
          const shade = text(args, 'shade');
          next = setCellProps(doc, para, other, { shade: shade === 'none' ? '' : color(shade, 'shade') });
          break;
        }
        case 'show_borders':
        case 'hide_borders':
          next = setCellProps(doc, all.from, all.to, { borders: action === 'show_borders' });
          break;
        case 'delete_table': {
          // Row by row: the table goes with its last one.
          next = doc;
          for (let row = at.table.rows.length; row > 0; row--) next = deleteRow(next, all.from).doc;
          return { text: 'Table deleted. The paragraphs after it moved up.', doc: next, reveal: { para: Math.min(all.from, next.paragraphs.length - 1), offset: 0 } };
        }
        default:
          return fail(`There is no action "${action}".`);
      }
      if (next === doc) return { text: 'Nothing changed: the table was already like that.' };
      // A table that lost its last row or column has no paragraphs left: it is kept, empty, so that the others keep their place.
      if (!next.tables?.[at.tableIndex]?.rows.length || !next.paragraphs.some((p) => p.cell?.table === at.tableIndex)) return { text: 'That was the last of the table: it is gone.', doc: next, reveal: { para: Math.min(all.from, next.paragraphs.length - 1), offset: 0 } };
      const now = span(next, at.tableIndex);
      const table = next.tables![at.tableIndex];
      return { text: `Done. The table has ${table.rows.length} rows and ${table.columns.length} columns; its cells are paragraphs ${now.from + 1} to ${now.to + 1}:\n${lines(next, now.from, now.to)}`, doc: next, reveal: { para: now.from, offset: 0 } };
    },
  },
  {
    name: 'insert_image',
    areas: true,
    description: 'Puts a picture from a file (PNG, JPEG or GIF) in a paragraph of its own after a paragraph. It goes at its own size, or as wide as the text when it is wider, unless "width_cm" says otherwise.',
    properties: {
      after_paragraph: { type: 'integer', description: 'The number of the paragraph to insert after; 0 to insert at the start.' },
      path: { type: 'string', description: 'The path of the picture file.' },
      width_cm: { type: 'number', description: 'How wide to show it, in centimetres. Its height follows.' },
      align: { type: 'string', enum: ['left', 'center', 'right'], description: 'Where on the line it goes. Left when left out.' },
    },
    required: ['after_paragraph', 'path'],
    writes: true,
    run(doc, args) {
      const after = afterIndex(doc, args);
      // The file is read by whoever runs the tool, which gives its bytes here: a page cannot open a path.
      const type = optionalText(args, 'type') ?? '';
      const data = optionalText(args, 'data') ?? fail('The picture file could not be read.');
      if (!imageExtension(type)) fail('Only PNG, JPEG and GIF pictures can be put in a document.');
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const size = pictureSize(bytes, type) ?? fail('The file is not a picture that can be read.');
      const { width: pageWidth, marginLeft, marginRight } = doc.page;
      const room = pageWidth - marginLeft - marginRight;
      const asked = args.width_cm === undefined || args.width_cm === null ? undefined : typeof args.width_cm === 'number' && args.width_cm > 0 ? args.width_cm * CM : fail('"width_cm" must be a number above 0.');
      const width = Math.min(asked ?? size.width * PX, room);
      const height = (width * size.height) / size.width;
      const align = optionalText(args, 'align') ?? 'left';
      if (align !== 'left' && align !== 'center' && align !== 'right') fail('"align" must be "left", "center" or "right".');
      const at = after + 1;
      let next = insertImage(spliced(doc, after, ['']), { para: at, offset: 0 }, { bytes, type, width, height }).doc;
      next = setParagraphProps(next, at, at, { align: align as 'left' | 'center' | 'right' });
      return { text: `Picture inserted as paragraph ${at + 1}, ${(width / CM).toFixed(1)} × ${(height / CM).toFixed(1)} cm.`, doc: next, reveal: { para: at, offset: 0 } };
    },
  },
  {
    name: 'edit_image',
    areas: true,
    description: 'Changes a picture that is in the document: "resize" it (with "width_cm"; its height follows), "move" it to a paragraph of its own after another (with "after_paragraph"), "align" the paragraph it is in (with "align"), or "delete" it. read_document shows a picture as [image].',
    properties: {
      paragraph: { type: 'integer', description: 'The paragraph the picture is in.' },
      occurrence: { type: 'integer', description: 'Which picture of the paragraph, when it has several: 1 for the first.' },
      action: { type: 'string', enum: ['resize', 'move', 'align', 'delete'] },
      width_cm: { type: 'number', description: 'For resize: how wide to show it, in centimetres.' },
      after_paragraph: { type: 'integer', description: 'For move: the paragraph it goes after; 0 for the start.' },
      align: { type: 'string', enum: ['left', 'center', 'right'], description: 'For align.' },
    },
    required: ['paragraph', 'action'],
    writes: true,
    run(doc, args) {
      const para = paragraphIndex(doc, args, 'paragraph');
      /** Where each picture of the paragraph is, and the size it is shown at. */
      const pictures: { offset: number; width: number; height: number }[] = [];
      let offset = 0;
      for (const run of doc.paragraphs[para].runs) {
        if (run.props.object && !run.props.anchor) for (let i = 0; i < run.text.length; i++) pictures.push({ offset: offset + i, width: run.props.objectWidth ?? 0, height: run.props.objectHeight ?? 0 });
        offset += run.text.length;
      }
      if (!pictures.length) fail(`Paragraph ${para + 1} has no picture.`);
      const nth = whole(args, 'occurrence') ?? 1;
      const was = pictures[nth - 1] ?? fail(`Paragraph ${para + 1} has ${pictures.length} ${pictures.length === 1 ? 'picture' : 'pictures'}: there is no ${nth}.`);
      const pos = { para, offset: was.offset };
      const action = text(args, 'action');
      switch (action) {
        case 'resize': {
          if (!(was.width > 0 && was.height > 0)) fail('That picture cannot be given another size.');
          const asked = typeof args.width_cm === 'number' && args.width_cm > 0 ? args.width_cm * CM : fail('resize needs "width_cm": a number above 0.');
          const width = Math.min(asked, doc.page.width - doc.page.marginLeft - doc.page.marginRight);
          const height = (width * was.height) / was.width;
          const next = resizePicture(doc, pos, width, height);
          if (next === doc) fail('That picture cannot be given another size.');
          return { text: `The picture is now ${(width / CM).toFixed(1)} × ${(height / CM).toFixed(1)} cm.`, doc: next, reveal: pos };
        }
        case 'align': {
          const align = text(args, 'align');
          if (align !== 'left' && align !== 'center' && align !== 'right') fail('"align" must be "left", "center" or "right".');
          return { text: `Paragraph ${para + 1} is aligned ${align}.`, doc: setParagraphProps(doc, para, para, { align: align as 'left' | 'center' | 'right' }), reveal: pos };
        }
        case 'delete':
          return { text: 'Picture deleted.', doc: deleteRange(doc, { from: pos, to: { para, offset: pos.offset + 1 } }), reveal: pos };
        case 'move': {
          const after = afterIndex(doc, args);
          // A paragraph of its own for it, like the one it is in; then the one it leaves, when nothing else was in it.
          const made = spliced(doc, after, ['']);
          const from = { para: after < para ? para + 1 : para, offset: pos.offset };
          const moved = movePicture(made, from, { para: after + 1, offset: 0 });
          if (moved.doc === made) fail('The picture could not be moved there.');
          let next = setParagraphProps(moved.doc, after + 1, after + 1, { align: doc.paragraphs[para].props.align ?? 'left' });
          const left = next.paragraphs[from.para];
          const alone = !paragraphLength(left) && !left.cell && next.paragraphs.length > 1;
          if (alone) next = { ...next, paragraphs: next.paragraphs.filter((_, i) => i !== from.para) };
          const now = after + 1 - (alone && from.para < after + 1 ? 1 : 0);
          return { text: `The picture is now in paragraph ${now + 1}.`, doc: next, reveal: { para: now, offset: 0 } };
        }
        default:
          return fail(`There is no action "${action}".`);
      }
    },
  },
  {
    name: 'set_page_number',
    description: 'Puts the number of the page in the header or the footer of every page, moves it, changes how it reads, or takes it away.',
    properties: {
      place: { type: 'string', enum: ['header', 'footer', 'none'], description: '"none" takes the number away.' },
      align: { type: 'string', enum: ['left', 'center', 'right'], description: 'Centre when left out.' },
      format: { type: 'string', enum: ['number', 'numberOfTotal', 'page', 'pageOfTotal'], description: 'How it reads: "3", "3 / 9", "Página 3" or "Página 3 de 9". The first when left out.' },
    },
    required: ['place'],
    writes: true,
    run(doc, args) {
      const place = text(args, 'place');
      if (place === 'none') return pageNumbering(doc) ? { text: 'Page number removed.', doc: setPageNumbering(doc, undefined) } : { text: 'The document had no page number.' };
      if (place !== 'header' && place !== 'footer') fail('"place" must be "header", "footer" or "none".');
      const now = pageNumbering(doc);
      const align = optionalText(args, 'align') ?? now?.align ?? 'center';
      const format = optionalText(args, 'format') ?? now?.format ?? 'number';
      if (align !== 'left' && align !== 'center' && align !== 'right') fail('"align" must be "left", "center" or "right".');
      if (!['number', 'numberOfTotal', 'page', 'pageOfTotal'].includes(format)) fail('"format" must be "number", "numberOfTotal", "page" or "pageOfTotal".');
      return { text: `Page number in the ${place}, ${align}.`, doc: setPageNumbering(doc, { place: place as 'header' | 'footer', align: align as 'left' | 'center' | 'right', format: format as PageNumberFormat }) };
    },
  },
  {
    name: 'insert_page_break',
    description: 'Makes the text after a paragraph start on a new page.',
    properties: { after_paragraph: { type: 'integer', description: 'The number of the paragraph the break goes after.' } },
    required: ['after_paragraph'],
    writes: true,
    run(doc, args) {
      const after = afterIndex(doc, args);
      if (after < 0) fail('"after_paragraph" must be a paragraph of the document.');
      if (doc.paragraphs[after].cell) fail('A page break cannot go inside a table.');
      const end = { para: after, offset: paragraphLength(doc.paragraphs[after]) };
      return { text: `Page break after paragraph ${after + 1}.`, doc: insertText(doc, end, '\f').doc, reveal: end };
    },
  },
  {
    name: 'insert_table_of_contents',
    description: 'Puts in a table of contents after a paragraph: the headings of the document, each with its page and a link to it. A document has one.',
    properties: {
      after_paragraph: { type: 'integer', description: 'The number of the paragraph to insert after; 0 to insert at the start.' },
      title: { type: 'string', description: 'The title over the table. "Índice" when left out; empty for none.' },
    },
    required: ['after_paragraph'],
    writes: true,
    run(doc, args, context) {
      const after = afterIndex(doc, args);
      if (tocRange(doc)) fail('The document already has a table of contents: update_table_of_contents brings it up to date.');
      if (after >= 0 && doc.paragraphs[after].cell) fail('A table of contents cannot go inside a table.');
      const pageOf = context.pageOf ?? fail('The pages of the document cannot be worked out here, so a table of contents cannot be numbered.');
      const at = after + 1;
      const made = insertToc(spliced(doc, after, ['']), { para: at, offset: 0 }, { pageOf: () => 1, title: optionalText(args, 'title') ?? 'Índice' }).doc;
      return { text: 'Table of contents inserted.', doc: settled(made, pageOf), reveal: { para: at, offset: 0 } };
    },
  },
  {
    name: 'update_table_of_contents',
    description: 'Writes the table of contents again from the headings and the pages the document has now. Do it after changing headings, or text that moves them to other pages.',
    properties: {},
    writes: true,
    run(doc, _args, context) {
      if (!tocRange(doc)) fail('The document has no table of contents: insert_table_of_contents puts one in.');
      const pageOf = context.pageOf ?? fail('The pages of the document cannot be worked out here.');
      const next = settled(doc, pageOf);
      return next === doc ? { text: 'The table of contents was already up to date.' } : { text: 'Table of contents brought up to date.', doc: next, reveal: { para: tocRange(next)!.first, offset: 0 } };
    },
  },
];

/** The table of contents written again until doing so no longer moves its own headings to other pages: a pass or two. */
function settled(doc: Doc, pageOf: NonNullable<ToolContext['pageOf']>): Doc {
  let now = doc;
  for (let pass = 0; pass < 3; pass++) {
    const next = updateToc(now, { pageOf: pageOf(now) });
    if (next === now) break;
    now = next;
  }
  return now;
}

const BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

export const findTool = (name: string): Tool | undefined => BY_NAME.get(name);

const AREAS: Record<string, StoryPart> = { header: 'header', footer: 'footer', first_header: 'firstHeader', first_footer: 'firstFooter' };

export const AREA = {
  type: 'string',
  enum: ['body', 'header', 'footer', 'first_header', 'first_footer'],
  description:
    'Which part of the document: its text ("body", when left out), the header or the footer every page shows, or the ones the first page has to itself when the document gives it its own ("first_header", "first_footer": get_overview says whether it does). Each has paragraphs numbered from 1 of its own.',
};

/** The properties of the arguments of a tool, with the part of the document where it can be told one. */
export const toolProperties = (tool: Tool): Record<string, unknown> => (tool.areas ? { ...tool.properties, area: AREA } : tool.properties);

/**
 * Runs a tool on a document. Throws a `ToolError` for what the assistant got
 * wrong. With "area" as header or footer, a tool that can runs on that part
 * as if it were the document.
 */
export function runTool(doc: Doc, name: string, args: Args = {}, context: ToolContext = {}): ToolResult {
  const tool = BY_NAME.get(name) ?? fail(`There is no tool "${name}".`);
  const { area = 'body', ...rest } = args;
  if (area === 'body' || area === null) return tool.run(doc, rest, context);
  const part = typeof area === 'string' ? AREAS[area] : undefined;
  if (!part) return fail('"area" must be "body", "header", "footer", "first_header" or "first_footer".');
  const named = String(area).replace('_', ' ');
  if (part !== storyKind(part) && !doc.firstPage) return fail('The first page of this document has no header and footer of its own: it shows the ones of every page, which are "header" and "footer".');
  // Word has no comments in a header or a footer, so there is nowhere in the file for a note there.
  if (name === 'add_note') return fail(`A note cannot go in the ${named}: Word has no comments there. Put it on the text of the document.`);
  if (!tool.areas) return fail(`${name} only works on the text of the document, not on its ${named}.`);
  const story: Story | undefined = storyOf(doc, part);
  if (!story?.paragraphs.length && !tool.writes) return { text: `The document has no ${named}.` };
  // An empty one to write in, in the font of the document.
  const paragraphs = story?.paragraphs.length ? story.paragraphs : [{ props: {}, runs: [{ text: '', props: defined({ fontFamily: propsAt(doc, { para: 0, offset: 0 }).fontFamily }) }] }];
  const view: Doc = { ...doc, paragraphs, tables: story?.tables, header: undefined, footer: undefined, firstPage: undefined, notes: undefined };
  // The tables the part came with from its file are written back as they were, cell by cell: only their text can change.
  const fixedTables = doc.source?.[`${part}Source`]?.story.tables?.length ?? 0;
  const result = tool.run(view, rest, { ...context, fixedTables });
  if (!result.doc) return result;
  const made: Story = result.doc.tables ? { paragraphs: result.doc.paragraphs, tables: result.doc.tables } : { paragraphs: result.doc.paragraphs };
  // Lists made in a header are defined with those of the document; where the change is, is not a place of its text.
  return { text: result.text, doc: defined({ ...withStory(doc, part, made), numbering: result.doc.numbering, media: result.doc.media }) };
}
