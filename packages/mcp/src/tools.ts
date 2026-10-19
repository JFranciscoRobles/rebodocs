// What an assistant can do to a document, as tools: each has a name, a
// description, the shape of its arguments and a function from a document to
// what it says and, when it changes something, the document after. They are
// pure and use nothing of Node or of the browser, so the same ones run in the
// server, on a file, and in the page of the editor, on the document open there.
//
// Paragraphs go by their number, from 1, as `read_document` shows them. A
// place inside a paragraph goes by its text: what to find, and which time.

import {
  cellOfTable,
  drawnTextBoxes,
  insertTextBox,
  textBoxOf,
  textBoxPart,
  type RevisionView,
  acceptRevisions,
  comparePositions,
  decideAllRevisions,
  rejectRevisions,
  revisionNow,
  revisionsOf,
  trackDocEdit,
  compareDocs,
  describeChange,
  importDocx,
  type Change,
  type Doc,
  type BasePart,
  type StoryPart,
  footnoteNumbers,
  footnoteOf,
  footnotePart,
  footnoteReferenceId,
  footnoteReferences,
  hasOwnFirstPage,
  insertFootnote,
  hasOwnStories,
  pageAt,
  sectionCount,
  sectionMarks,
  sectionPart,
  setOwnFirstPage,
  setOwnStories,
  setSectionPage,
  storyKind,
  storySource,
  storyOf,
  withStory,
  type PageNumberFormat,
  type Story,
  type ListKind,
  type Align,
  type Paragraph,
  type ParagraphProps,
  type TabStop,
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
  deleteTable,
  columnsAt,
  insertColumnBreak,
  setColumns,
  setHeaderRow,
  setRowHeight,
  type Border,
  type BorderStyle,
  type Columns,
  type PageSetup,
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
  paragraphText,
  propsAt,
  resolveParagraph,
  resolveRun,
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
  /** Who the changes it makes are by while they are tracked: "Assistant" when not said. */
  reviser?: string;
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
/** The text of a paragraph as an assistant reads it; with the numbers of the notes, their references as [^n]. */
/** A paragraph as the assistant reads it: tracked changes as {+put in+} and [-taken out-], and its mark too when it is one. */
const shown = (p: Paragraph, notes?: Map<string, number>): string => {
  let out = '';
  let open = '';
  const close = () => (open === 'insert' ? '+}' : open === 'delete' ? '-]' : '');
  for (const run of p.runs) {
    const note = notes && footnoteReferenceId(run.props.object);
    const text =
      note !== undefined && notes?.has(note) ? `[^${notes.get(note)}]`.repeat(run.text.length) : run.props.anchor ? '' : run.props.object ? '[image]'.repeat(run.text.length) : run.text;
    if (!text) continue;
    const revision = run.props.revision ?? '';
    if (revision !== open) {
      out += close() + (revision === 'insert' ? '{+' : revision === 'delete' ? '[-' : '');
      open = revision;
    }
    out += text;
  }
  out += close();
  if (p.props.markRevision) out += p.props.markRevision === 'insert' ? '{+¶+}' : '[-¶-]';
  return out.replace(/\f/g, '[page break]').replace(/\t/g, ' → ');
};

const words = (doc: Doc): number => doc.paragraphs.reduce((sum, p) => sum + (shown(p).match(/\S+/g)?.length ?? 0), 0);

const styleNames = (doc: Doc): string => paragraphStyles(doc).map((style) => style.id).join(', ');

function line(doc: Doc, index: number, labels: ReturnType<typeof listLabels>, notes?: Map<string, number>): string {
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
  return `[${index + 1}]${tags.length ? ` (${tags.join('; ')})` : ''} ${label ? `${label} ` : ''}${shown(p, notes)}`;
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

/** Paper sizes, upright, in points. */
const PAPERS: Record<string, { width: number; height: number }> = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.3, height: 841.9 },
  legal: { width: 612, height: 1008 },
};

const COLOR = /^#?([0-9a-fA-F]{6})$/;
const color = (value: string, name: string): string => COLOR.exec(value)?.[1].toUpperCase() ?? fail(`"${name}" must be a colour as six hex digits, like C0392B.`);

const number = (args: Args, name: string, min: number, max: number): number | undefined => {
  const value = args[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(`"${name}" must be a number.`);
  return value < min || value > max ? fail(`"${name}" must be between ${min} and ${max}.`) : value;
};

// --- How text looks ---------------------------------------------------------------

/** What of a run shows: what is read from a text to say how it looks, and what is copied to make another text look the same. */
const LOOKS = ['fontFamily', 'fontSize', 'bold', 'italic', 'underline', 'strike', 'color', 'highlight'] as const;

/** The look of a run, every part of it given, so that it wins over what a text had. */
function looksOf(props: RunProps): RunProps {
  const resolved = resolveRun(props);
  const out: RunProps = {};
  for (const key of LOOKS) (out as Record<string, unknown>)[key] = resolved[key];
  return out;
}

/** The look of a run in words: its font and size, and what it has besides. */
function sayLooks(props: RunProps): string {
  const r = resolveRun(props);
  const marks = [r.bold && 'bold', r.italic && 'italic', r.underline && 'underline', r.strike && 'strike', r.color !== '000000' && `color ${r.color}`, r.highlight && `highlight ${r.highlight}`].filter(Boolean);
  return [`${r.fontFamily} ${r.fontSize} pt`, ...marks].join(', ');
}

const runsOfText = (p: Paragraph) => p.runs.filter((run) => !run.props.anchor && !run.props.object && run.text);

/** The look most of the text of a paragraph has: what a text written in its place takes. */
function mainLooks(doc: Doc, para: number): RunProps {
  const p = doc.paragraphs[para];
  const counts = new Map<string, { props: RunProps; size: number }>();
  for (const run of runsOfText(p)) {
    const key = sayLooks(run.props);
    const now = counts.get(key) ?? { props: run.props, size: 0 };
    now.size += run.text.length;
    counts.set(key, now);
  }
  let best: RunProps | undefined;
  let size = -1;
  for (const entry of counts.values()) if (entry.size > size) ({ props: best, size } = entry);
  return looksOf(best ?? propsAt(doc, { para, offset: 0 }));
}

const cm = (points: number) => `${Math.round((points / CM) * 100) / 100} cm`;

/** The look of a paragraph in words: where it sits, its indents and the room around it. */
/** The tab stops a tool was given, in order; undefined when it was given none. */
function tabStops(given: unknown): TabStop[] | undefined {
  if (given === undefined) return undefined;
  const list: unknown[] = Array.isArray(given) ? given : fail('"tab_stops" must be a list of stops, each with "at_cm".');
  return list
    .map((stop): TabStop => {
      const at = Number((stop as { at_cm?: unknown })?.at_cm);
      if (!Number.isFinite(at) || at < 0 || at > 60) fail('Each tab stop needs "at_cm", from 0 to 60.');
      const align = (stop as { align?: string }).align ?? 'left';
      if (!['left', 'center', 'right', 'decimal'].includes(align)) fail('A tab stop\'s "align" must be "left", "center", "right" or "decimal".');
      const leader = (stop as { leader?: string }).leader ?? 'none';
      if (!['none', 'dot', 'hyphen', 'underscore'].includes(leader)) fail('A tab stop\'s "leader" must be "none", "dot", "hyphen" or "underscore".');
      return defined<TabStop>({ pos: Math.round(at * CM * 100) / 100, align: align as TabStop['align'], leader: leader === 'none' ? undefined : (leader as TabStop['leader']) });
    })
    .sort((a, b) => a.pos - b.pos);
}

function sayParagraph(doc: Doc, para: number): string {
  const r = resolveParagraph(doc.paragraphs[para].props);
  const parts = [`style ${styleIdAt(doc, para)}`, `align ${r.align}`];
  if (r.indentLeft || r.indentRight || r.indentFirstLine) {
    const first = r.indentFirstLine > 0 ? `, first line ${cm(r.indentFirstLine)}` : r.indentFirstLine < 0 ? `, hanging ${cm(-r.indentFirstLine)}` : '';
    parts.push(`indent left ${cm(r.indentLeft)}, right ${cm(r.indentRight)}${first}`);
  }
  parts.push(`space before ${r.spacingBefore} pt, after ${r.spacingAfter} pt`, `line spacing ${Math.round(r.lineHeight * 100) / 100}`);
  const list = listKindAt(doc, para);
  if (list) parts.push(`${list} list, level ${r.listLevel + 1}`);
  if (r.tabs.length) parts.push(`tab stops ${r.tabs.map((tab) => `${tab.align}${tab.leader ? ` with ${tab.leader}s` : ''} at ${cm(tab.pos)}`).join(', ')}`);
  if (r.keepNext) parts.push('kept with the next');
  if (r.pageBreakBefore) parts.push('starts a page');
  return parts.join('; ');
}

/** The stretches of a paragraph that look different, each with its text and its look. */
function sayRuns(p: Paragraph): string[] {
  const out: { text: string; looks: string }[] = [];
  for (const run of p.runs) {
    if (run.props.anchor) continue;
    const text = run.props.object ? '[image]'.repeat(run.text.length) : run.text;
    const looks = sayLooks(run.props);
    const last = out[out.length - 1];
    if (last && last.looks === looks) last.text += text;
    else out.push({ text, looks });
  }
  return out.map(({ text, looks }) => `  "${text.length > 80 ? `${text.slice(0, 80)}…` : text}" — ${looks}`);
}

/** The properties a tool takes for how a text looks. */
const LOOK_PROPERTIES = {
  bold: { type: 'boolean' },
  italic: { type: 'boolean' },
  underline: { type: 'boolean' },
  strike: { type: 'boolean' },
  color: { type: 'string', description: 'The colour of the text, as six hex digits: C0392B.' },
  highlight: { type: 'string', description: `The colour behind the text: one of ${HIGHLIGHT_COLORS.join(', ')}; "none" to take it away.` },
  font_family: { type: 'string', description: 'The font, by its name: Arial, Times New Roman, Calibri…' },
  font_size: { type: 'number', description: 'The size of the text, in points: 11, 12…' },
};

/** The change of look given in `args`, with the names of LOOK_PROPERTIES. */
function lookPatch(args: Args): RunProps {
  const highlight = optionalText(args, 'highlight');
  const tint = optionalText(args, 'color');
  const family = optionalText(args, 'font_family');
  const patch = defined<RunProps>({
    bold: optionalFlag(args, 'bold'),
    italic: optionalFlag(args, 'italic'),
    underline: optionalFlag(args, 'underline'),
    strike: optionalFlag(args, 'strike'),
    color: tint === undefined ? undefined : color(tint, 'color'),
    highlight: highlight === undefined ? undefined : highlight === 'none' ? '' : color(highlight, 'highlight'),
    fontFamily: family === undefined ? undefined : family.trim() || fail('"font_family" must be the name of a font.'),
    fontSize: number(args, 'font_size', 1, 400),
  });
  if (patch.highlight && !HIGHLIGHT_COLORS.includes(patch.highlight)) fail(`Word only has these highlight colours: ${HIGHLIGHT_COLORS.join(', ')}.`);
  return patch;
}

/** A text given as plain "text" or as "segments", each with a look of its own over the one it is written in. */
function segmentsOf(args: Args): { text: string; patch: RunProps }[] {
  if (Array.isArray(args.segments) && args.segments.length) {
    return (args.segments as Args[]).map((segment) => ({ text: optionalText(segment ?? {}, 'text') ?? '', patch: lookPatch(segment ?? {}) }));
  }
  return [{ text: optionalText(args, 'text') ?? '', patch: {} }];
}

const SEGMENTS = {
  type: 'array',
  description: 'Instead of "text": the text in pieces, each with what sets it apart from the rest (bold, italic, a colour…), to keep the words that were bold bold. The pieces are joined as they are: put the spaces in them.',
  items: { type: 'object', properties: { text: { type: 'string' }, ...LOOK_PROPERTIES }, required: ['text'] },
};

/** Gives the text of paragraph `para` from `start` the look `base`, and each segment its own on top. */
function dress(doc: Doc, para: number, start: number, base: RunProps, segments: { text: string; patch: RunProps }[]): Doc {
  const total = segments.reduce((sum, segment) => sum + segment.text.length, 0);
  let next = applyRunProps(doc, { from: { para, offset: start }, to: { para, offset: start + total } }, base);
  let at = start;
  for (const segment of segments) {
    if (Object.keys(segment.patch).length && segment.text) next = applyRunProps(next, { from: { para, offset: at }, to: { para, offset: at + segment.text.length } }, segment.patch);
    at += segment.text.length;
  }
  return next;
}

const cmOf = (points: number) => Math.round((points / CM) * 100) / 100;

/** A page as its size and margins say it. */
function pageSaid(page: PageSetup): string {
  return `The page is ${cmOf(page.width)} × ${cmOf(page.height)} cm, with margins of ${cmOf(page.marginTop)} cm above, ${cmOf(page.marginBottom)} below, ${cmOf(page.marginLeft)} left and ${cmOf(page.marginRight)} right.`;
}

/** The sections of a document of several: their paragraphs, their page and their header and footer. Nothing for one of one. */
function sectionsSaid(doc: Doc): string {
  const ends = sectionMarks(doc);
  if (!ends.length) return '';
  const story = (part: StoryPart) => {
    const body = (storyOf(doc, part)?.paragraphs ?? []).map((p) => shown(p)).filter((value) => value.trim()).join(' / ');
    return body ? `"${body}"` : 'empty';
  };
  const lines = [...ends, doc.paragraphs.length - 1].map((end, k) => {
    const from = k ? ends[k - 1] + 1 : 0;
    const page = pageAt(doc, end);
    const last = k === ends.length;
    const own = hasOwnStories(doc, k);
    const parts = [
      `${cmOf(page.width)} × ${cmOf(page.height)} cm, margins ${cmOf(page.marginTop)} / ${cmOf(page.marginBottom)} / ${cmOf(page.marginLeft)} / ${cmOf(page.marginRight)} cm (top / bottom / left / right)`,
      last ? 'its header and footer are the document\'s' : own ? `header ${story(sectionPart('header', k))}, footer ${story(sectionPart('footer', k))} of its own` : 'shows the document\'s header and footer',
      hasOwnFirstPage(doc, k) ? `its first page has its own: header ${story(sectionPart('firstHeader', last ? undefined : k))}, footer ${story(sectionPart('firstFooter', last ? undefined : k))}` : '',
    ];
    return `${k + 1}. Paragraphs ${from + 1} to ${end + 1}: ${parts.filter(Boolean).join('; ')}.`;
  });
  return `Sections (each with its own page; "section" in set_page_setup, and with "area", says one):\n${lines.join('\n')}`;
}

/** The stretches of paragraphs set in columns. */
function columnsSaid(doc: Doc): string {
  const out: string[] = [];
  let start = -1;
  let count = 1;
  const close = (end: number) => {
    if (start >= 0 && count > 1) out.push(`paragraphs ${start + 1} to ${end + 1} in ${count} columns`);
  };
  for (let i = 0; i < doc.paragraphs.length; i++) {
    const n = columnsAt(doc, i).count;
    if (n !== count) {
      close(i - 1);
      start = i;
      count = n;
    } else if (start < 0) start = i;
  }
  close(doc.paragraphs.length - 1);
  return out.length ? `Columns: ${out.join('; ')}.` : '';
}

/** The fonts and sizes of the text, the most used first, with how much of the text each is. */
function fontsOf(doc: Doc): string {
  const counts = new Map<string, number>();
  let total = 0;
  for (const p of doc.paragraphs) {
    for (const run of runsOfText(p)) {
      const r = resolveRun(run.props);
      const key = `${r.fontFamily} ${r.fontSize} pt`;
      counts.set(key, (counts.get(key) ?? 0) + run.text.length);
      total += run.text.length;
    }
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return sorted.length ? sorted.map(([key, n]) => `${key} (${Math.round((n / total) * 100)}%)`).join(', ') : 'none';
}

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
        const body = (part?.paragraphs ?? []).map((p) => shown(p)).filter((value) => value.trim()).join(' / ');
        return body ? `${name}: ${body}` : '';
      };
      return {
        text: [
          `${doc.paragraphs.length} paragraphs, ${words(doc)} words, ${(doc.tables ?? []).filter((table) => table.rows.length).length} tables, ${doc.notes?.length ?? 0} notes.`,
          tocRange(doc) ? 'It has a table of contents.' : '',
          footnoteNumbers(doc).size ? `It has ${footnoteNumbers(doc).size} notes at the foot of the page, shown as [^n] in read_document.` : '',
          textBoxesSaid(doc),
          doc.trackRevisions || revisionsOf(doc).length
            ? `${doc.trackRevisions ? 'Changes are tracked: what you change stays marked for the person to accept or reject.' : 'Changes are not tracked.'} ${revisionsOf(doc).length} tracked changes, shown in read_document as {+put in+} and [-taken out-] (list_changes).`
            : '',
          story('Header', doc.header),
          story('Footer', doc.footer),
          doc.firstPage ? `The first page${sectionMarks(doc).length ? ' of the last section' : ''} has a header and a footer of its own ("first_header", "first_footer").` : '',
          story('First page header', doc.firstPage?.header),
          story('First page footer', doc.firstPage?.footer),
          sectionsSaid(doc),
          headings.length ? `Headings (with their paragraph):\n${headings.join('\n')}` : 'It has no headings.',
          names.length ? `Template variables: ${names.join(', ')}` : '',
          `Paragraph styles: ${styleNames(doc)}`,
          `Fonts: ${fontsOf(doc)}. read_formatting gives the look of each paragraph.`,
          columnsSaid(doc),
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
      const numbers = footnoteNumbers(doc);
      const out: string[] = [];
      let size = 0;
      let i = from;
      for (; i <= to; i++) {
        const next = line(doc, i, labels, numbers);
        if (out.length && size + next.length > READ_LIMIT) break;
        out.push(next);
        size += next.length + 1;
      }
      const more = i <= to ? `\n… ${to - i + 1} more paragraphs: read on with from=${i + 1}.` : '';
      // The notes at the foot of the page the paragraphs read refer to.
      const cited = [...new Set(footnoteReferences(doc).filter((ref) => ref.para >= from && ref.para < i && numbers.has(ref.id)).map((ref) => ref.id))];
      const notes = cited.map((id) => `[^${numbers.get(id)}] ${footnoteOf(doc, id)!.paragraphs.map((p) => shown(p)).join(' / ').trim()}`);
      const footer = notes.length ? `\nNotes at the foot of the page (area "footnote" with area_footnote reads or changes one):\n${notes.join('\n')}` : '';
      return { text: out.join('\n') + more + footer };
    },
  },
  {
    name: 'read_formatting',
    areas: true,
    description:
      'How paragraphs look: for each, its style, alignment, indents, the room before and after it and its line spacing; then each stretch of its text that looks different, with its font, its size and whether it is bold, italic, underlined or coloured. Read it before rewriting or adding text that has to look like what is there.',
    properties: {
      from: { type: 'integer', description: 'The first paragraph. 1 when left out.' },
      to: { type: 'integer', description: 'The last paragraph. 20 after "from" when left out.' },
    },
    writes: false,
    run(doc, args) {
      const from = paragraphIndex(doc, args, 'from', 1);
      const to = paragraphIndex(doc, args, 'to', Math.min(from + 20, doc.paragraphs.length));
      if (to < from) fail('"to" is before "from".');
      const out: string[] = [];
      let size = 0;
      let i = from;
      for (; i <= to; i++) {
        const block = [`[${i + 1}] ${sayParagraph(doc, i)}`, ...sayRuns(doc.paragraphs[i])].join('\n');
        if (out.length && size + block.length > READ_LIMIT) break;
        out.push(block);
        size += block.length + 1;
      }
      const more = i <= to ? `\n… ${to - i + 1} more paragraphs: read on with from=${i + 1}.` : '';
      return { text: out.join('\n') + more };
    },
  },
  {
    name: 'compare_documents',
    description:
      'What changed between this document and another version of it in a .docx file ("path"): the paragraphs put in, taken out and changed, of the text and of its headers, footers and notes at the foot of the page, with what was taken out as [-…-] and what was put in as {+…+}. By default the file is the earlier version; with "file_is" "later", it is the later one.',
    properties: {
      path: { type: 'string', description: 'The path of the other version, a .docx file.' },
      file_is: { type: 'string', enum: ['earlier', 'later'], description: 'Whether the file is the earlier version (the default) or the later one.' },
    },
    required: ['path'],
    writes: false,
    run(doc, args) {
      // The file is read by whoever runs the tool, which gives its bytes here: a page cannot open a path.
      const data = optionalText(args, 'data') ?? fail('The file could not be read.');
      let other: Doc;
      try {
        other = importDocx(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)));
      } catch {
        return fail('The file is not a Word document that can be read.');
      }
      const later = optionalText(args, 'file_is') === 'later';
      const { changes } = later ? compareDocs(doc, other) : compareDocs(other, doc);
      if (!changes.length) return { text: 'There is no difference in the text, the headers, the footers or the notes.' };
      /** Where a change is, by the numbers of this document when it has the paragraph. */
      const where = (change: Change) => {
        const mine = later ? change.before : change.after;
        const theirs = later ? change.after : change.before;
        const place = mine !== undefined ? `[${mine + 1}]` : `(only in the file, its paragraph ${theirs! + 1})`;
        if (!change.part) return place;
        const note = change.part.startsWith('footnote:') ? footnoteNumbers(later ? doc : other).get(change.part.slice(9)) ?? footnoteNumbers(later ? other : doc).get(change.part.slice(9)) : undefined;
        return `${note !== undefined ? `Note ${note}` : storyKind(change.part) === 'header' ? 'Header' : 'Footer'} ${place}`;
      };
      const WORDS = { added: 'put in', removed: 'taken out', changed: 'changed', formatted: 'same text, another look' } as const;
      const MOST = 200;
      const lines = changes.slice(0, MOST).map((change) => `${where(change)} ${WORDS[change.kind]}: ${describeChange(change)}`);
      if (changes.length > MOST) lines.push(`…and ${changes.length - MOST} more.`);
      const head = `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} from the ${later ? 'document' : 'file'} to the ${later ? 'file' : 'document'}; the numbers in brackets are those of this document's paragraphs:`;
      return { text: `${head}\n${lines.join('\n')}` };
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
    description: 'Puts a text in place of another, in the formatting of what was there: its font, its size and its marks. The text to find has to be inside one paragraph. An empty "replace" deletes it. To write a whole paragraph anew, as in a translation, rewrite_paragraph keeps more of its look.',
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
    name: 'rewrite_paragraph',
    areas: true,
    description:
      'Writes the whole text of a paragraph anew, as to translate it or say it otherwise, and keeps how it looks: its style, alignment, indents and spacing, and the font, size and colour most of its text has. Words that were set apart (bold, italic…) are kept so by giving the text in "segments". A paragraph with a picture is changed with replace_text instead.',
    properties: {
      paragraph: { type: 'integer', description: 'The number of the paragraph.' },
      text: { type: 'string', description: 'Its new text, all in the look most of it had.' },
      segments: SEGMENTS,
    },
    required: ['paragraph'],
    writes: true,
    run(doc, args) {
      const para = paragraphIndex(doc, args, 'paragraph');
      const p = doc.paragraphs[para];
      if (p.runs.some((run) => run.props.object && !run.props.anchor)) fail(`Paragraph ${para + 1} has a picture in it: change its words with replace_text, so that the picture stays.`);
      const segments = segmentsOf(args);
      const full = segments.map((segment) => segment.text).join('');
      if (!full) fail('Give the new text, in "text" or in "segments". To empty the paragraph use replace_text.');
      if (/[\r\n\f]/.test(full)) fail('The text of one paragraph has no line breaks: write the others with insert_paragraphs.');
      const base = mainLooks(doc, para);
      const length = paragraphLength(p);
      let next = length ? replaceRange(doc, { from: { para, offset: 0 }, to: { para, offset: length } }, full).doc : insertText(doc, { para, offset: 0 }, full, base).doc;
      // What takes no room, the marks of a note among it, may have stayed: the text is found where it is now.
      const start = Math.max(0, paragraphText(next.paragraphs[para]).indexOf(full));
      next = dress(next, para, start, base, segments);
      return { text: `Paragraph ${para + 1} rewritten, in ${sayLooks(base)}.\n${lines(next, para, para)}`, doc: next, reveal: { para, offset: 0 } };
    },
  },
  {
    name: 'insert_paragraphs',
    areas: true,
    description:
      'Writes new paragraphs after a paragraph. Each has its text and, when wanted, a style (a heading, for one) or a list. With "like_paragraph" a new one looks like a paragraph that is there: its alignment, indents, spacing, list, and the font, size and colour of most of its text. Text between double braces, like {{cliente}}, is a template variable.',
    properties: {
      after_paragraph: { type: 'integer', description: 'The number of the paragraph to insert after; 0 to insert at the start.' },
      like_paragraph: { type: 'integer', description: 'A paragraph every new one looks like, unless it says another.' },
      paragraphs: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            segments: SEGMENTS,
            like_paragraph: { type: 'integer', description: 'A paragraph this one looks like.' },
            style: { type: 'string', description: 'A paragraph style of the document, such as Heading1. The normal one when left out.' },
            list: { type: 'string', enum: ['bullet', 'number'], description: 'Makes the paragraph an item of a list.' },
          },
        },
      },
    },
    required: ['after_paragraph', 'paragraphs'],
    writes: true,
    run(doc, args) {
      const after = afterIndex(doc, args);
      const given = Array.isArray(args.paragraphs) && args.paragraphs.length ? (args.paragraphs as Args[]) : fail('"paragraphs" must be a list with at least one paragraph.');
      const like = whole(args, 'like_paragraph') === undefined ? undefined : paragraphIndex(doc, args, 'like_paragraph');
      const items = given.map((item) => {
        const segments = segmentsOf(item ?? {});
        const model = whole(item ?? {}, 'like_paragraph') === undefined ? like : paragraphIndex(doc, item, 'like_paragraph');
        return { text: segments.map((segment) => segment.text).join(''), segments, like: model, style: optionalText(item ?? {}, 'style'), list: optionalText(item ?? {}, 'list') };
      });
      // Into a document, or a header, that is one empty paragraph, they go in its place.
      const blank = doc.paragraphs.length === 1 && !paragraphLength(doc.paragraphs[0]) && !doc.paragraphs[0].cell;
      const first = blank ? 0 : after + 1;
      let next = spliced(doc, after, items.map((item) => item.text));
      if (blank) next = { ...next, paragraphs: next.paragraphs.filter((_, i) => i !== (after < 0 ? items.length : 0)) };
      items.forEach((item, i) => {
        const at = first + i;
        if (item.like !== undefined) {
          // The look of the paragraph it is like; not a page break before it, which is that paragraph's alone.
          const model = doc.paragraphs[item.like];
          const props: ParagraphProps = defined({ ...model.props, pageBreakBefore: undefined });
          const paragraphs = next.paragraphs.slice();
          paragraphs[at] = { ...paragraphs[at], props };
          next = { ...next, paragraphs };
        }
        if (item.style) next = setParagraphStyle(next, at, at, styleId(next, item.style));
        if (item.like !== undefined || item.segments.some((segment) => Object.keys(segment.patch).length)) {
          next = dress(next, at, 0, item.like !== undefined && !item.style ? mainLooks(doc, item.like) : looksOf(propsAt(next, { para: at, offset: 0 })), item.segments);
        }
      });
      // Each stretch of items of one kind at once, so that a numbered one counts on.
      for (let i = 0; i < items.length; i++) {
        const kind = items[i].list;
        if (!kind) continue;
        if (kind !== 'bullet' && kind !== 'number') fail('"list" must be "bullet" or "number".');
        let end = i;
        while (items[end + 1]?.list === kind) end++;
        // Those that are of that list already, by the paragraph they are like, stay in it.
        if (!items.slice(i, end + 1).every((_, k) => listKindAt(next, first + i + k) === kind)) next = toggleList(next, first + i, first + end, kind as ListKind);
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
    description:
      'Changes how a text looks: its font, its size, bold, italic, underlined, struck through, its colour or the highlight behind it. The text is one found by "find", or whole paragraphs, from "from" to "to". Give only what is to change.',
    properties: {
      ...PLACE,
      all: { type: 'boolean', description: 'Every match, not just one.' },
      from: { type: 'integer', description: 'Instead of "find": the first of the paragraphs to change whole.' },
      to: { type: 'integer', description: 'The last of them. The same as "from" when left out.' },
      ...LOOK_PROPERTIES,
    },
    writes: true,
    run(doc, args) {
      const patch = lookPatch(args);
      if (!Object.keys(patch).length) fail('Say what to change: font_family, font_size, bold, italic, underline, strike, color or highlight.');
      if (args.find === undefined && whole(args, 'from') === undefined) fail('Say what text to change: "find" a text, or give paragraphs with "from" and "to".');
      let found: Range[];
      if (args.find !== undefined) found = places(doc, args, optionalFlag(args, 'all') ?? false);
      else {
        const from = paragraphIndex(doc, args, 'from');
        const to = paragraphIndex(doc, args, 'to', from + 1);
        if (to < from) fail('"to" is before "from".');
        found = [{ from: { para: from, offset: 0 }, to: { para: to, offset: paragraphLength(doc.paragraphs[to]) } }];
      }
      const where = args.find !== undefined ? said(found) : found[0].from.para === found[0].to.para ? `paragraph ${found[0].from.para + 1}` : `paragraphs ${found[0].from.para + 1} to ${found[0].to.para + 1}`;
      return { text: `Formatted in ${where}.`, doc: each(doc, found, (now, range) => applyRunProps(now, range, patch)), reveal: found[0].from };
    },
  },
  {
    name: 'format_paragraphs',
    areas: true,
    description: 'Changes how paragraphs sit on the page: their alignment, indents, the room before and after them, their line spacing, their tab stops, and whether they keep with the next one. Give only what is to change.',
    properties: {
      from: { type: 'integer', description: 'The first paragraph.' },
      to: { type: 'integer', description: 'The last one. The same as "from" when left out.' },
      align: { type: 'string', enum: ['left', 'center', 'right', 'justify'] },
      indent_left_cm: { type: 'number', description: 'From the left margin, in centimetres.' },
      indent_right_cm: { type: 'number', description: 'From the right margin, in centimetres.' },
      first_line_cm: { type: 'number', description: 'How much further in the first line starts, in centimetres; below 0 for a hanging indent.' },
      space_before_pt: { type: 'number', description: 'Room above the paragraph, in points.' },
      space_after_pt: { type: 'number', description: 'Room below the paragraph, in points.' },
      line_spacing: { type: 'number', description: 'Of the lines: 1 single, 1.15, 1.5, 2 double.' },
      keep_with_next: { type: 'boolean', description: 'Keep it on the same page as the next paragraph, as a heading.' },
      tab_stops: {
        type: 'array',
        description: 'All the tab stops the paragraphs are to have, in place of the ones they have; [] for none. A tab in the text goes to the next one; past them, every 1.27 cm.',
        items: {
          type: 'object',
          properties: {
            at_cm: { type: 'number', description: 'From the left margin, in centimetres.' },
            align: { type: 'string', enum: ['left', 'center', 'right', 'decimal'], description: 'Whether the text after the tab starts there, is centred on it, ends there or has its decimal point there.' },
            leader: { type: 'string', enum: ['none', 'dot', 'hyphen', 'underscore'], description: 'What fills the room of the tab, as the dots of an index.' },
          },
          required: ['at_cm'],
        },
      },
    },
    required: ['from'],
    writes: true,
    run(doc, args) {
      const from = paragraphIndex(doc, args, 'from');
      const to = paragraphIndex(doc, args, 'to', from + 1);
      if (to < from) fail('"to" is before "from".');
      const align = optionalText(args, 'align');
      if (align !== undefined && !['left', 'center', 'right', 'justify'].includes(align)) fail('"align" must be "left", "center", "right" or "justify".');
      const length = (name: string) => {
        const value = number(args, name, -30, 30);
        return value === undefined ? undefined : value * CM;
      };
      const patch = defined<ParagraphProps>({
        align: align as Align | undefined,
        indentLeft: length('indent_left_cm'),
        indentRight: length('indent_right_cm'),
        indentFirstLine: length('first_line_cm'),
        spacingBefore: number(args, 'space_before_pt', 0, 1000),
        spacingAfter: number(args, 'space_after_pt', 0, 1000),
        lineHeight: number(args, 'line_spacing', 0.5, 5),
        keepNext: optionalFlag(args, 'keep_with_next'),
        tabs: tabStops(args.tab_stops),
      });
      if (!Object.keys(patch).length) fail('Say what to change: align, indent_left_cm, indent_right_cm, first_line_cm, space_before_pt, space_after_pt, line_spacing, tab_stops or keep_with_next.');
      const next = setParagraphProps(doc, from, to, patch);
      return { text: `Paragraphs ${from + 1} to ${to + 1}: ${sayParagraph(next, from)}.`, doc: next, reveal: { para: from, offset: 0 } };
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
    name: 'track_changes',
    description:
      'Switches tracked changes on or off, as Word\'s "Track changes". While on, every change made to the text, by any tool, stays marked for a person to accept or reject: what was put in as {+…+} and what was taken out as [-…-] in read_document.',
    properties: { on: { type: 'boolean', description: 'True to track the changes from now on, false to stop. What was tracked stays.' } },
    required: ['on'],
    writes: true,
    run(doc, args) {
      const on = optionalFlag(args, 'on') ?? fail('"on" must be true or false.');
      if (on === !!doc.trackRevisions) return { text: on ? 'Changes were already being tracked.' : 'Changes were not being tracked.' };
      const { trackRevisions: _, ...rest } = doc;
      return { text: on ? 'Changes are tracked from now on: what you change stays marked for the person to accept or reject.' : 'Changes are no longer tracked.', doc: on ? { ...doc, trackRevisions: true } : rest };
    },
  },
  {
    name: 'list_changes',
    description: 'The tracked changes of the document, numbered: who made each, whether it put text in or took it out, the text, and the paragraph it is in. accept_changes and reject_changes take these numbers.',
    properties: {},
    writes: false,
    run(doc) {
      const list = revisionsOf(doc);
      const state = doc.trackRevisions ? 'Changes are being tracked.' : 'Changes are not being tracked.';
      if (!list.length) return { text: `${state} There are no tracked changes.` };
      const notes = footnoteNumbers(doc);
      const where = (r: RevisionView) => {
        const at = `paragraph ${r.range.from.para + 1}`;
        if (!r.part) return at;
        const note = r.part.startsWith('footnote:') ? notes.get(r.part.slice(9)) : undefined;
        return `${note !== undefined ? `note ${note}` : storyKind(r.part as Exclude<StoryPart, `footnote:${string}`>)}, ${at}`;
      };
      const lines = list.map((r, i) => {
        const what = r.text.replace(/[\u2060\uFFFC]/g, '');
        const text = what === '¶' ? 'a paragraph break' : `"${what.replace(/¶$/, '')}"${what.endsWith('¶') ? ' and the paragraph break after it' : ''}`;
        return `${i + 1}. ${r.author || 'Someone'} ${r.type === 'insert' ? 'put in' : 'took out'} ${text} (${where(r)}${r.date ? `, ${r.date.slice(0, 16).replace('T', ' ')}` : ''})`;
      });
      return { text: `${state} ${list.length} tracked ${list.length === 1 ? 'change' : 'changes'}:\n${lines.join('\n')}` };
    },
  },
  {
    name: 'accept_changes',
    description: 'Accepts tracked changes: what was put in stays, unmarked, and what was taken out goes. With "changes", the ones of those numbers in list_changes; without, all of them.',
    properties: { changes: { type: 'array', items: { type: 'integer' }, description: 'The numbers of the changes, from list_changes. All of them when left out.' } },
    writes: true,
    run: (doc, args) => decideChanges(doc, args, true),
  },
  {
    name: 'reject_changes',
    description: 'Rejects tracked changes: what was put in goes, and what was taken out comes back. With "changes", the ones of those numbers in list_changes; without, all of them.',
    properties: { changes: { type: 'array', items: { type: 'integer' }, description: 'The numbers of the changes, from list_changes. All of them when left out.' } },
    writes: true,
    run: (doc, args) => decideChanges(doc, args, false),
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
      'Changes the shape or the look of a table that is there. "paragraph" is any paragraph of the cell to act on (read_document says which cell each is in). Actions: insert_row_above, insert_row_below, insert_column_left, insert_column_right, delete_row, delete_column, merge_cells (from "paragraph" to "to_paragraph"), split_cell (undoes a merge), set_column_widths (with "widths_cm", one for each column), set_row_height (with "height_cm", 0 for as tall as it holds, and "exact"), header_row_on and header_row_off (the rows down to this one repeat at the top of each page), align_cells_top, align_cells_center, align_cells_bottom, text_level, text_up and text_down (the text of the cells set level, or vertically to read from the bottom up or from the top down; its lines are as long as the row is tall), shade_cells (with "shade"), cell_lines (with "line_style", "line_width_pt" and "line_color"; "line_style" none takes them away), show_borders, hide_borders (the whole table) and delete_table. The actions on cells take "to_paragraph" for several. The text of a cell is changed with replace_text and insert_paragraphs.',
    properties: {
      paragraph: { type: 'integer', description: 'A paragraph of the cell to act on.' },
      action: { type: 'string', enum: ['insert_row_above', 'insert_row_below', 'insert_column_left', 'insert_column_right', 'delete_row', 'delete_column', 'merge_cells', 'split_cell', 'set_column_widths', 'set_row_height', 'header_row_on', 'header_row_off', 'align_cells_top', 'align_cells_center', 'align_cells_bottom', 'text_level', 'text_up', 'text_down', 'shade_cells', 'cell_lines', 'show_borders', 'hide_borders', 'delete_table'] },
      height_cm: { type: 'number', description: 'For set_row_height: in centimetres, without the margins of the cells; 0 for as tall as what it holds.' },
      exact: { type: 'boolean', description: 'For set_row_height: the row is that tall whatever it holds.' },
      line_style: { type: 'string', enum: ['single', 'double', 'dashed', 'dotted', 'none'], description: 'For cell_lines: the line all round the cells.' },
      line_width_pt: { type: 'number', description: 'For cell_lines: how thick, in points. 0.5 when left out.' },
      line_color: { type: 'string', description: 'For cell_lines: six hex digits. Black when left out.' },
      widths_cm: { type: 'array', items: { type: 'number' }, description: 'For set_column_widths: how wide each column is, in centimetres, from the left.' },
      to_paragraph: { type: 'integer', description: 'A paragraph of the cell at the other corner, for merge_cells and shade_cells.' },
      shade: { type: 'string', description: 'For shade_cells: the colour behind the cells, as six hex digits (E8EEF9); "none" to take it away.' },
    },
    required: ['paragraph', 'action'],
    writes: true,
    run(doc, args, context) {
      const para = paragraphIndex(doc, args, 'paragraph');
      const at = locateCell(doc, para) ?? fail(`Paragraph ${para + 1} is not in a table.`);
      if (at.tableIndex < (context.fixedTables ?? 0) && !['shade_cells', 'cell_lines', 'align_cells_top', 'align_cells_center', 'align_cells_bottom', 'text_level', 'text_up', 'text_down', 'show_borders', 'hide_borders'].includes(String(args.action))) {
        fail('A table the header or the footer of the file came with cannot be given another shape here: change the text of its cells, or make a new table.');
      }
      const other = whole(args, 'to_paragraph') === undefined ? para : paragraphIndex(doc, args, 'to_paragraph');
      if (!cellOfTable(doc.tables, doc.paragraphs[other].cell, at.tableIndex)) fail(`Paragraph ${other + 1} is not in the same table.`);
      const action = text(args, 'action');
      /** The paragraphs of the table, which are one after another, those of the tables in its cells among them. */
      const span = (now: Doc, table: number) => {
        const from = now.paragraphs.findIndex((p) => cellOfTable(now.tables, p.cell, table));
        let to = from;
        while (cellOfTable(now.tables, now.paragraphs[to + 1]?.cell, table)) to++;
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
        case 'set_row_height': {
          const height = number(args, 'height_cm', 0, 50) ?? fail('set_row_height needs "height_cm": the height in centimetres, or 0 for as tall as what the row holds.');
          next = setRowHeight(doc, para, height * CM, optionalFlag(args, 'exact') ?? false);
          break;
        }
        case 'header_row_on':
        case 'header_row_off':
          next = setHeaderRow(doc, para, action === 'header_row_on');
          break;
        case 'align_cells_top':
        case 'align_cells_center':
        case 'align_cells_bottom':
          next = setCellProps(doc, para, other, { valign: action.slice('align_cells_'.length) as 'top' | 'center' | 'bottom' });
          break;
        case 'text_level':
        case 'text_up':
        case 'text_down':
          next = setCellProps(doc, para, other, { direction: action.slice('text_'.length) as 'level' | 'up' | 'down' });
          break;
        case 'cell_lines': {
          const style = text(args, 'line_style');
          if (!['single', 'double', 'dashed', 'dotted', 'none'].includes(style)) fail('"line_style" must be "single", "double", "dashed", "dotted" or "none".');
          const tint = optionalText(args, 'line_color');
          const line: Border = { width: number(args, 'line_width_pt', 0.25, 6) ?? 0.5, color: tint === undefined ? '000000' : color(tint, 'line_color'), style: (style === 'none' ? 'single' : style) as BorderStyle };
          next = setCellProps(doc, para, other, style === 'none' ? { borders: false } : { line });
          break;
        }
        case 'show_borders':
        case 'hide_borders':
          next = setCellProps(doc, all.from, all.to, { borders: action === 'show_borders' });
          break;
        case 'delete_table': {
          const gone = deleteTable(doc, para);
          return { text: 'Table deleted. The paragraphs after it moved up.', doc: gone.doc, reveal: gone.pos };
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
    name: 'set_columns',
    description:
      'Sets text in columns, as a newsletter: one column, two, three, with a line between them or not. With "from" and "to" only those paragraphs go in columns, in a section of their own on the same page; with "paragraph" alone, the whole section that paragraph is in.',
    properties: {
      paragraph: { type: 'integer', description: 'A paragraph of the section to set in columns.' },
      from: { type: 'integer', description: 'Instead of "paragraph": the first of the paragraphs to set in columns by themselves.' },
      to: { type: 'integer', description: 'The last of them.' },
      count: { type: 'integer', description: 'How many columns: 1 to take them away, up to 6.' },
      space_cm: { type: 'number', description: 'Room between two columns, in centimetres. 1.27 when left out.' },
      separator: { type: 'boolean', description: 'A line down between the columns.' },
      widths_cm: { type: 'array', items: { type: 'number' }, description: 'When they are not all as wide: the width of each column, in centimetres.' },
    },
    required: ['count'],
    writes: true,
    run(doc, args) {
      const count = whole(args, 'count') ?? fail('"count" is needed: how many columns.');
      if (count < 1 || count > 6) fail('"count" must be between 1 and 6.');
      const space = (number(args, 'space_cm', 0, 10) ?? 1.27) * CM;
      const given = args.widths_cm;
      let columns: Columns = { count, space, separator: optionalFlag(args, 'separator') || undefined };
      if (given !== undefined) {
        if (!Array.isArray(given) || given.length !== count) fail(`"widths_cm" must have ${count} widths, one for each column.`);
        const widths = (given as unknown[]).map((value) => (typeof value === 'number' && value > 0 ? value * CM : fail('Each width must be a number above 0.')));
        columns = { ...columns, widths: widths.map((width, i) => ({ width, space: i < count - 1 ? space : 0 })) };
      }
      let range: Range;
      if (whole(args, 'from') !== undefined) {
        const from = paragraphIndex(doc, args, 'from');
        const to = paragraphIndex(doc, args, 'to', from + 1);
        if (to < from) fail('"to" is before "from".');
        if (inTable(doc, from, from) || inTable(doc, to, to)) fail('Columns start and end outside a table.');
        range = { from: { para: from, offset: 0 }, to: { para: to, offset: paragraphLength(doc.paragraphs[to]) } };
      } else {
        const para = paragraphIndex(doc, args, 'paragraph', 1);
        range = { from: { para, offset: 0 }, to: { para, offset: 0 } };
      }
      const next = setColumns(doc, range, columns);
      if (next === doc) return { text: 'Nothing changed: the text was already in those columns.' };
      return { text: `Set in ${count === 1 ? 'one column' : `${count} columns`}${columns.separator ? ' with a line between them' : ''}. Paragraphs that only end a section may have been added: read the document again before giving numbers.`, doc: next, reveal: range.from };
    },
  },
  {
    name: 'insert_column_break',
    description: 'Makes the text from a place start at the top of the next column, in a section set in columns: before a text found with "find", or at the start of a paragraph.',
    properties: { ...PLACE, at_paragraph: { type: 'integer', description: 'Instead of "find": the paragraph that starts the next column.' } },
    writes: true,
    run(doc, args) {
      let pos: Position;
      if (args.find !== undefined) pos = places(doc, args)[0].from;
      else pos = { para: paragraphIndex(doc, args, 'at_paragraph'), offset: 0 };
      if (doc.paragraphs[pos.para].cell) fail('A column break cannot go inside a table.');
      if (columnsAt(doc, pos.para).count < 2) fail(`Paragraph ${pos.para + 1} is not in columns: set them first with set_columns.`);
      const result = insertColumnBreak(doc, pos);
      return { text: 'The text from there starts in the next column.', doc: result.doc, reveal: result.pos };
    },
  },
  {
    name: 'insert_footnote',
    description:
      'Puts a note at the foot of the page: its number goes in the text right after a text found with "find" (or at the end of paragraph "at_paragraph"), and the note says "text". Notes are numbered by where they are in the text.',
    properties: { ...PLACE, at_paragraph: { type: 'integer', description: 'Instead of "find": the paragraph at whose end the number goes.' }, text: { type: 'string', description: 'What the note says.' } },
    required: ['text'],
    writes: true,
    run(doc, args) {
      const said = text(args, 'text');
      let pos: Position;
      if (args.find !== undefined) pos = places(doc, args)[0].to;
      else {
        const para = paragraphIndex(doc, args, 'at_paragraph');
        pos = { para, offset: paragraphLength(doc.paragraphs[para]) };
      }
      const result = insertFootnote(doc, pos, said);
      const number = footnoteNumbers(result.doc).get(result.id);
      return { text: `Note ${number} is at the foot of the page of paragraph ${pos.para + 1}.`, doc: result.doc, reveal: result.pos };
    },
  },
  {
    name: 'insert_text_box',
    description:
      'Puts a text box in: a box with a thin black line, anchored to a paragraph (at the end of "after_paragraph"; 1 when left out), at the left of the column, with the text of that paragraph going round it. It is as tall as its text. Its text is "text"; each line of it a paragraph. Change it later with area "textbox".',
    properties: {
      text: { type: 'string', description: 'What the box says; a new line starts another paragraph.' },
      at_paragraph: { type: 'integer', description: 'The paragraph it is anchored to. 1 when left out.' },
      width_cm: { type: 'number', description: 'How wide it is, in centimetres. 6 when left out.' },
    },
    required: ['text'],
    writes: true,
    run(doc, args) {
      const said = text(args, 'text');
      const para = args.at_paragraph === undefined || args.at_paragraph === null ? 0 : paragraphIndex(doc, args, 'at_paragraph');
      const asked = args.width_cm === undefined || args.width_cm === null ? 6 : typeof args.width_cm === 'number' && args.width_cm > 0 ? args.width_cm : fail('"width_cm" must be a number above 0.');
      const room = doc.page.width - doc.page.marginLeft - doc.page.marginRight;
      const made = insertTextBox(doc, { para, offset: 0 }, { width: Math.min(asked * CM, room), height: 30 });
      const story = textBoxOf(made.doc, made.id)!;
      const like = story.paragraphs[0];
      const paragraphs = said.split('\n').map((line) => ({ ...like, runs: [{ text: line, props: like.runs[0].props }] }));
      const next = withStory(made.doc, textBoxPart(made.id), { paragraphs });
      const number = drawnTextBoxes(next).indexOf(made.id) + 1;
      return { text: `Text box ${number} is anchored to paragraph ${para + 1}.`, doc: next, reveal: made.pos };
    },
  },
  {
    name: 'set_page_setup',
    description:
      'Changes the size of the paper, its orientation, or its margins; and, for one section of a document of several, whether it has a header and footer of its own and whether its first page has its own. Give only what is to change. Without "section", the page of every section changes.',
    properties: {
      section: { type: 'integer', description: 'Only this section, counting from 1: get_overview lists them. Every section when left out.' },
      paper: { type: 'string', enum: ['letter', 'a4', 'legal'], description: 'Letter (21.59 × 27.94 cm), A4 (21 × 29.7 cm) or legal (21.59 × 35.56 cm).' },
      orientation: { type: 'string', enum: ['portrait', 'landscape'] },
      margin_top_cm: { type: 'number' },
      margin_bottom_cm: { type: 'number' },
      margin_left_cm: { type: 'number' },
      margin_right_cm: { type: 'number' },
      different_first_page: { type: 'boolean', description: 'Whether the first page (of the section, with "section") has a header and a footer of its own ("first_header", "first_footer"), which start empty.' },
      own_header_footer: {
        type: 'boolean',
        description: 'With "section", for one before the last: true gives it a header and a footer of its own, copies of the document\'s to begin with; false has it show the document\'s, which are the last section\'s.',
      },
    },
    writes: true,
    run(doc, args) {
      const count = sectionCount(doc);
      const asked = whole(args, 'section');
      if (asked !== undefined && (asked < 1 || asked > count)) fail(`"section" must be from 1 to ${count}: the document has ${count === 1 ? 'one section' : `${count} sections`}.`);
      const ends = [...sectionMarks(doc), doc.paragraphs.length - 1];
      const which = asked === undefined ? ends.map((_, k) => k) : [asked - 1];
      const paper = optionalText(args, 'paper');
      const orientation = optionalText(args, 'orientation');
      if (paper !== undefined && !PAPERS[paper]) fail('"paper" must be "letter", "a4" or "legal".');
      if (orientation !== undefined && orientation !== 'portrait' && orientation !== 'landscape') fail('"orientation" must be "portrait" or "landscape".');
      const margins = (
        [
          ['margin_top_cm', 'marginTop'],
          ['margin_bottom_cm', 'marginBottom'],
          ['margin_left_cm', 'marginLeft'],
          ['margin_right_cm', 'marginRight'],
        ] as const
      ).map(([name, key]) => [key, number(args, name, 0, 10)] as const);
      let next = doc;
      for (const k of which) {
        const page: PageSetup = { ...pageAt(next, ends[k]) };
        if (paper !== undefined) {
          const size = PAPERS[paper];
          const wide = page.width > page.height;
          page.width = wide ? size.height : size.width;
          page.height = wide ? size.width : size.height;
        }
        if (orientation !== undefined && (orientation === 'landscape') !== page.width > page.height) [page.width, page.height] = [page.height, page.width];
        for (const [key, value] of margins) if (value !== undefined) page[key] = value * CM;
        if (page.width - page.marginLeft - page.marginRight < 2 * CM || page.height - page.marginTop - page.marginBottom < 2 * CM) fail('Those margins leave less than 2 cm for the text.');
        next = setSectionPage(next, ends[k], page);
      }
      const first = optionalFlag(args, 'different_first_page');
      if (first !== undefined) for (const k of which) next = setOwnFirstPage(next, k, first);
      const own = optionalFlag(args, 'own_header_footer');
      if (own !== undefined) {
        if (asked === undefined) return fail('"own_header_footer" is said of one section: give "section".');
        if (asked === count) fail(`Section ${count} is the last: its header and footer are the document's, which the sections without their own show.`);
        next = setOwnStories(next, asked - 1, own);
      }
      if (next === doc) return { text: 'Nothing changed: the page was already like that.' };
      return { text: sectionsSaid(next) || pageSaid(pageAt(next, 0)), doc: next };
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

const AREAS: Record<string, BasePart> = { header: 'header', footer: 'footer', first_header: 'firstHeader', first_footer: 'firstFooter' };

export const AREA = {
  type: 'string',
  enum: ['body', 'header', 'footer', 'first_header', 'first_footer', 'footnote', 'textbox'],
  description:
    'Which part of the document: its text ("body", when left out), the header or the footer every page shows, the ones the first page has to itself when the document gives it its own ("first_header", "first_footer": get_overview says whether it does), a note at the foot of the page ("footnote", with area_footnote), or a text box ("textbox", with area_textbox). Each has paragraphs numbered from 1 of its own.',
};

export const AREA_TEXTBOX = { type: 'integer', description: 'With area "textbox": the number of the text box, as get_overview lists them.' };

export const AREA_FOOTNOTE = { type: 'integer', description: 'With area "footnote": the number of the note, as read_document shows it in [^n].' };

export const AREA_SECTION = {
  type: 'integer',
  description:
    'With "area", in a document of several sections: the section, from 1, whose own header or footer it is (get_overview says which have their own). Left out, the document\'s: those of the last section, which every section without its own shows.',
};

/** The properties of the arguments of a tool, with the part of the document where it can be told one. */
export const toolProperties = (tool: Tool): Record<string, unknown> =>
  tool.areas ? { ...tool.properties, area: AREA, area_section: AREA_SECTION, area_footnote: AREA_FOOTNOTE, area_textbox: AREA_TEXTBOX } : tool.properties;

/**
 * Runs a tool on a document. Throws a `ToolError` for what the assistant got
 * wrong. With "area" as header or footer, a tool that can runs on that part
 * as if it were the document.
 */
export function runTool(doc: Doc, name: string, args: Args = {}, context: ToolContext = {}): ToolResult {
  const result = runOne(doc, name, args, context);
  // While changes are tracked, what a tool changes is tracked too, by the assistant: word by word, as it changes at once.
  if (!doc.trackRevisions || !result.doc || result.doc === doc || UNTRACKED.has(name)) return result;
  const by = { author: context.reviser ?? 'Assistant', date: revisionNow(context.now) };
  return { ...result, doc: trackDocEdit(doc, result.doc, by) };
}

function runOne(doc: Doc, name: string, args: Args, context: ToolContext): ToolResult {
  const tool = BY_NAME.get(name) ?? fail(`There is no tool "${name}".`);
  const { area = 'body', area_section: section = null, area_footnote: footnote = null, area_textbox: textbox = null, ...rest } = args;
  if (area === 'body' || area === null) return tool.run(doc, rest, context);
  if (area === 'textbox') {
    const ids = drawnTextBoxes(doc).filter((id) => textBoxOf(doc, id));
    const id = Number.isInteger(textbox) ? ids[(textbox as number) - 1] : undefined;
    if (id === undefined) return fail(ids.length ? `"area_textbox" must be the number of a text box, from 1 to ${ids.length}.` : 'The document has no text boxes: put one in with insert_text_box.');
    if (name === 'add_note') return fail('A note cannot go in a text box. Put it on the text of the document.');
    if (!tool.areas) return fail(`${name} only works on the text of the document, not on a text box.`);
    return inStory(doc, tool, textBoxPart(id), rest, context);
  }
  if (area === 'footnote') {
    const numbers = footnoteNumbers(doc);
    const id = [...numbers].find(([, n]) => n === footnote)?.[0];
    if (id === undefined) return fail(numbers.size ? `"area_footnote" must be the number of a note, from 1 to ${numbers.size}.` : 'The document has no notes at the foot of the page: put one in with insert_footnote.');
    if (name === 'add_note') return fail('A note cannot go in a note at the foot of the page. Put it on the text of the document.');
    if (!tool.areas) return fail(`${name} only works on the text of the document, not on a note at the foot of the page.`);
    return inStory(doc, tool, footnotePart(id), rest, context);
  }
  const base = typeof area === 'string' ? AREAS[area] : undefined;
  if (!base) return fail('"area" must be "body", "header", "footer", "first_header", "first_footer" or "footnote".');
  const named = String(area).replace('_', ' ');
  const count = sectionCount(doc);
  if (section !== null && (!Number.isInteger(section) || (section as number) < 1 || (section as number) > count)) return fail(`"area_section" must be from 1 to ${count}.`);
  // The last section's are the document's.
  const k = section === null || section === count ? undefined : (section as number) - 1;
  const part = sectionPart(base, k);
  if (k !== undefined && base === storyKind(base) && !hasOwnStories(doc, k))
    return fail(`Section ${k + 1} shows the document's header and footer: leave "area_section" out to change those, or give it its own first with set_page_setup (own_header_footer).`);
  if (base !== storyKind(base) && !hasOwnFirstPage(doc, k ?? count - 1))
    return fail(`The first page ${k === undefined ? 'of this document' : `of section ${k + 1}`} has no header and footer of its own: give it them with set_page_setup (different_first_page), or use "header" and "footer".`);
  // Word has no comments in a header or a footer, so there is nowhere in the file for a note there.
  if (name === 'add_note') return fail(`A note cannot go in the ${named}: Word has no comments there. Put it on the text of the document.`);
  if (!tool.areas) return fail(`${name} only works on the text of the document, not on its ${named}.`);
  const story: Story | undefined = storyOf(doc, part);
  if (!story?.paragraphs.length && !tool.writes) return { text: `The document has no ${named}.` };
  return inStory(doc, tool, part, rest, context);
}

/** The text boxes of the document, numbered as "area_textbox" takes them, with their text. */
function textBoxesSaid(doc: Doc): string {
  const ids = drawnTextBoxes(doc).filter((id) => textBoxOf(doc, id));
  if (!ids.length) return '';
  const lines = ids.map((id, i) => `${i + 1}. ${textBoxOf(doc, id)!.paragraphs.map((p) => shown(p)).filter((t) => t.trim()).join(' / ') || '(empty)'}`);
  return `Text boxes (read and change one with area "textbox" and its number in area_textbox):\n${lines.join('\n')}`;
}

/** Accepts or rejects tracked changes, by their numbers in list_changes, or all of them. */
function decideChanges(doc: Doc, args: Args, accept: boolean): ToolResult {
  const list = revisionsOf(doc);
  if (!list.length) return { text: 'There are no tracked changes.' };
  const given = args.changes;
  if (given === undefined || given === null) {
    return { text: `${accept ? 'Accepted' : 'Rejected'} all ${list.length} tracked ${list.length === 1 ? 'change' : 'changes'}.`, doc: decideAllRevisions(doc, accept) };
  }
  if (!Array.isArray(given) || !given.length || !given.every((n) => Number.isInteger(n) && n >= 1 && n <= list.length))
    return fail(`"changes" must be numbers of changes from list_changes, from 1 to ${list.length}.`);
  const chosen = [...new Set(given as number[])].map((n) => list[n - 1]);
  // The last first, so that taking one out does not move the ones before it.
  chosen.sort((a, b) => (a.part ?? '').localeCompare(b.part ?? '') || comparePositions(b.range.from, a.range.from));
  let next = doc;
  for (const r of chosen) {
    if (!r.part) next = accept ? acceptRevisions(next, r.range) : rejectRevisions(next, r.range);
    else {
      const story = storyOf(next, r.part)!;
      next = withStory(next, r.part, { ...story, paragraphs: (accept ? acceptRevisions(story, r.range) : rejectRevisions(story, r.range)).paragraphs });
    }
  }
  return { text: `${accept ? 'Accepted' : 'Rejected'} ${chosen.length} tracked ${chosen.length === 1 ? 'change' : 'changes'}. The numbers of the others may have moved: list_changes again before using one.`, doc: next };
}

/** Tools that settle tracked changes, or switch them: what they do is not itself a change to track. */
const UNTRACKED = new Set(['track_changes', 'accept_changes', 'reject_changes']);

/** Runs a tool on a header, a footer or a note at the foot of the page as if it were the document. */
function inStory(doc: Doc, tool: Tool, part: StoryPart, rest: Args, context: ToolContext): ToolResult {
  const story: Story | undefined = storyOf(doc, part);
  // An empty one to write in, in the font of the document.
  const paragraphs = story?.paragraphs.length ? story.paragraphs : [{ props: {}, runs: [{ text: '', props: defined({ fontFamily: propsAt(doc, { para: 0, offset: 0 }).fontFamily }) }] }];
  const view: Doc = { ...doc, paragraphs, tables: story?.tables, header: undefined, footer: undefined, firstPage: undefined, notes: undefined };
  // The tables the part came with from its file are written back as they were, cell by cell: only their text can change.
  const fixedTables = storySource(doc, part)?.story.tables?.length ?? 0;
  const result = tool.run(view, rest, { ...context, fixedTables });
  if (!result.doc) return result;
  const made: Story = result.doc.tables ? { paragraphs: result.doc.paragraphs, tables: result.doc.tables } : { paragraphs: result.doc.paragraphs };
  // Lists made in a header are defined with those of the document; where the change is, is not a place of its text.
  return { text: result.text, doc: defined({ ...withStory(doc, part, made), numbering: result.doc.numbering, media: result.doc.media }) };
}
