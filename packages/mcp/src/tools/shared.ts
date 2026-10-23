// What the tools have in common: the shape of one, reading their arguments,
// and saying a document in words the way every tool says it.

import {
  drawnTextBoxes,
  textBoxOf,
  type Doc,
  type Layout,
  type StoryPart,
  endnoteReferenceId,
  footnoteReferenceId,
  noteLabels,
  hasOwnFirstPage,
  hasOwnStories,
  pageAt,
  sectionMarks,
  sectionPart,
  storyOf,
  type Paragraph,
  type TabStop,
  type Position,
  type Range,
  type RunProps,
  HIGHLIGHT_COLORS,
  applyRunProps,
  columnsAt,
  type PageSetup,
  jpegSize,
  locateCell,
  defined,
  altText,
  findAll,
  listKindAt,
  listLabels,
  paragraphStyles,
  propsAt,
  resolveParagraph,
  resolveRun,
  setParagraphStyle,
  styleIdAt,
} from '@rebodocs/core/internal';

/** What a tool needs that is not in the document. */
export interface ToolContext {
  /** The page each paragraph of a document starts on, from 1: for a table of contents. Without it there is no way to number one. */
  pageOf?: (doc: Doc) => (para: number) => number;
  /** The document laid out in pages, as it prints: for read_pages. Without it the pages cannot be read. */
  layoutOf?: (doc: Doc) => Layout;
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

export type Args = Record<string, unknown>;

export interface Tool {
  name: string;
  /** What a person is shown of it, where a client lists the tools or asks to allow one. */
  title: string;
  description: string;
  /** The properties of its arguments, as JSON Schema, and which of them must be given. */
  properties: Record<string, unknown>;
  required?: string[];
  /** True when it changes the document. */
  writes: boolean;
  /** True when doing it twice with the same arguments leaves the document as doing it once. */
  idempotent?: boolean;
  /** True when it can also be told to act on the header or the footer, with "area". */
  areas?: boolean;
  run(doc: Doc, args: Args, context: ToolContext): ToolResult;
}

/** What went wrong in a way the assistant can put right: said back to it, not thrown at the person. */
export class ToolError extends Error {}

export const fail = (message: string): never => {
  throw new ToolError(message);
};

// --- Reading arguments ----------------------------------------------------------

export const text = (args: Args, name: string): string => {
  const value = args[name];
  return typeof value === 'string' && value ? value : fail(`"${name}" must be a text that is not empty.`);
};
export const optionalText = (args: Args, name: string): string | undefined => {
  const value = args[name];
  return value === undefined || value === null ? undefined : typeof value === 'string' ? value : fail(`"${name}" must be a text.`);
};
export const optionalFlag = (args: Args, name: string): boolean | undefined => {
  const value = args[name];
  return value === undefined || value === null ? undefined : typeof value === 'boolean' ? value : fail(`"${name}" must be true or false.`);
};
export const whole = (args: Args, name: string): number | undefined => {
  const value = args[name];
  if (value === undefined || value === null) return undefined;
  return typeof value === 'number' && Number.isInteger(value) ? value : fail(`"${name}" must be a whole number.`);
};

/** The index of the paragraph numbered `args[name]`. */
export function paragraphIndex(doc: Doc, args: Args, name: string, fallback?: number): number {
  const n = whole(args, name) ?? fallback ?? fail(`"${name}" is needed: the number of a paragraph, as read_document shows it.`);
  if (n < 1 || n > doc.paragraphs.length) fail(`There is no paragraph ${n}: the document has ${doc.paragraphs.length}.`);
  return n - 1;
}

/** The paragraph a new one goes after, as an index: -1 to go first. */
export function afterIndex(doc: Doc, args: Args): number {
  const n = whole(args, 'after_paragraph') ?? fail('"after_paragraph" is needed: the number of the paragraph to insert after, or 0 to insert at the start.');
  if (n < 0 || n > doc.paragraphs.length) fail(`"after_paragraph" must be between 0 and ${doc.paragraphs.length}.`);
  return n - 1;
}

// --- Reading the document -------------------------------------------------------

/** The text of a paragraph as a person reads it: without the marks that take no room, a picture as a word. */
/** The text of a paragraph as an assistant reads it; with the numbers of the notes, their references as [^n]. */
/** A picture as the assistant reads it: with its description, when it has one, as a screen reader says it. */
export const imageText = (run: { text: string; props: { object?: string } }) => {
  const alt = altText(run.props.object);
  return (alt ? `[image: ${alt}]` : '[image]').repeat(run.text.length);
};

/** A paragraph as the assistant reads it: tracked changes as {+put in+} and [-taken out-], and its mark too when it is one. */
export const shown = (p: Paragraph, notes?: Map<string, number>, ends?: Map<string, string>): string => {
  let out = '';
  let open = '';
  const close = () => (open === 'insert' ? '+}' : open === 'delete' ? '-]' : '');
  for (const run of p.runs) {
    const note = notes && footnoteReferenceId(run.props.object);
    const end = ends && endnoteReferenceId(run.props.object);
    const text =
      note !== undefined && notes?.has(note)
        ? `[^${notes.get(note)}]`.repeat(run.text.length)
        : end !== undefined && ends?.has(end)
          ? `[^${endnoteTag(ends.get(end)!)}]`.repeat(run.text.length)
          : run.props.anchor
            ? ''
            : run.props.object
              ? imageText(run)
              : run.text;
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

/** Where `offset` of the paragraph's text falls in the text `shown` gives, with its marks of changes, pictures and tabs. */
export function shownOffset(p: Paragraph, offset: number): number {
  const runs: Paragraph['runs'] = [];
  let left = offset;
  for (const run of p.runs) {
    if (left <= 0) break;
    runs.push({ ...run, text: run.text.slice(0, left) });
    left -= run.text.length;
  }
  const before = shown({ ...p, runs, props: { ...p.props, markRevision: undefined } });
  // A change still open where the text was cut has been closed by shown: that mark is not before the place.
  const last = [...runs].reverse().find((run) => run.text && !run.props.anchor);
  return before.length - (last?.props.revision === 'insert' || last?.props.revision === 'delete' ? 2 : 0);
}

export const words = (doc: Doc): number => doc.paragraphs.reduce((sum, p) => sum + (shown(p).match(/\S+/g)?.length ?? 0), 0);

export const styleNames = (doc: Doc): string =>
  paragraphStyles(doc)
    .map((style) => style.id)
    .join(', ');

/** How a reference to a note at the end reads: its number, i, ii, iii; with an "e" before it when it is a figure, not to be taken for one at the foot of the page. */
export const endnoteTag = (label: string) => (/^\d/.test(label) ? `e${label}` : label);

/** What each note at the end shows as its number, for `shown` and `line`. */
export const endnoteTags = (doc: Doc): Map<string, string> => noteLabels(doc, 'endnote');

export function line(doc: Doc, index: number, labels: ReturnType<typeof listLabels>, notes?: Map<string, number>, ends?: Map<string, string>): string {
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
  return `[${index + 1}]${tags.length ? ` (${tags.join('; ')})` : ''} ${label ? `${label} ` : ''}${shown(p, notes, ends)}`;
}

/** The lines of the paragraphs from `from` to `to`, as `read_document` gives them. */
export function lines(doc: Doc, from: number, to: number): string {
  const labels = listLabels(doc);
  const out: string[] = [];
  for (let i = from; i <= to; i++) out.push(line(doc, i, labels));
  return out.join('\n');
}

export const READ_LIMIT = 24000;

// --- Finding a place by its text ------------------------------------------------

export const PLACE = {
  find: { type: 'string', description: 'The exact text to act on, as it reads in the document. Capital and small letters count.' },
  paragraph: { type: 'integer', description: 'Only look in this paragraph (its number from read_document).' },
  occurrence: { type: 'integer', description: 'Which match to use when the text is found more than once: 1 for the first.' },
};

/** The places `args.find` is found, narrowed by `paragraph` and `occurrence`. With `all` every one of them; otherwise it has to be one. */
export function places(doc: Doc, args: Args, all = false): Range[] {
  const query = text(args, 'find');
  const only = whole(args, 'paragraph');
  let found = findAll(doc, query, { matchCase: true });
  if (only !== undefined) found = found.filter((range) => range.from.para === only - 1);
  if (!found.length) {
    const loose = findAll(doc, query).length;
    fail(
      `"${query}" is not in ${only === undefined ? 'the document' : `paragraph ${only}`}.${loose ? ' It is there with other capital letters: copy it as it reads.' : ' A text has to be inside one paragraph: read the document again and copy it exactly.'}`,
    );
  }
  const nth = whole(args, 'occurrence');
  if (nth !== undefined) return [found[nth - 1] ?? fail(`"${query}" is found ${found.length} times: there is no occurrence ${nth}.`)];
  if (all || found.length === 1) return found;
  const where = found.map((range) => range.from.para + 1).join(', ');
  return fail(`"${query}" is found ${found.length} times, in paragraphs ${where}. Say which with "paragraph" or "occurrence", or make "find" longer.`);
}

/** Applies `change` to each place, the last first, so that the ones before stay where they were. */
export const each = (doc: Doc, found: Range[], change: (doc: Doc, range: Range) => Doc): Doc => [...found].reverse().reduce(change, doc);

export const said = (found: Range[]) => (found.length === 1 ? `paragraph ${found[0].from.para + 1}` : `${found.length} places`);

// --- New paragraphs -------------------------------------------------------------

/** Paragraphs of plain text put in after the one at `after` (-1: first), in the font of the text around and in the cell it is in. */
export function spliced(doc: Doc, after: number, texts: string[]): Doc {
  const near = doc.paragraphs[Math.max(after, 0)];
  const like = propsAt(doc, { para: Math.max(after, 0), offset: 0 });
  const props: RunProps = defined({ fontFamily: like.fontFamily });
  const made: Paragraph[] = texts.map((value) => defined({ props: {}, runs: [{ text: value.replace(/\r?\n/g, '\n'), props }], cell: after < 0 ? undefined : near.cell }));
  const paragraphs = doc.paragraphs.slice();
  paragraphs.splice(after + 1, 0, ...made);
  const normal = paragraphStyles(doc)[0].id;
  return setParagraphStyle({ ...doc, paragraphs }, after + 1, after + made.length, normal);
}

export function styleId(doc: Doc, wanted: string): string {
  const styles = paragraphStyles(doc);
  const lower = wanted.trim().toLowerCase();
  const style = styles.find((s) => s.id.toLowerCase() === lower) ?? styles.find((s) => s.name.toLowerCase() === lower || s.wordName?.toLowerCase() === lower);
  return style?.id ?? fail(`There is no style "${wanted}". The styles of this document are: ${styleNames(doc)}.`);
}

export const inTable = (doc: Doc, from: number, to: number) => doc.paragraphs.slice(from, to + 1).some((p) => p.cell);

// --- The tools ------------------------------------------------------------------

/** Points in a centimetre, and in a pixel of a picture. */
export const CM = 72 / 2.54;
export const PX = 0.75;

/** The size of a picture in pixels, read from the start of its file. */
export function pictureSize(bytes: Uint8Array, type: string): { width: number; height: number } | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let size: { width: number; height: number } | undefined;
  if (type === 'image/png' && bytes.length > 24 && view.getUint32(0) === 0x89504e47) size = { width: view.getUint32(16), height: view.getUint32(20) };
  else if (type === 'image/jpeg') size = jpegSize(bytes);
  else if (type === 'image/gif' && bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49) size = { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  return size && size.width > 0 && size.height > 0 ? size : undefined;
}

/** Paper sizes, upright, in points. */
export const PAPERS: Record<string, { width: number; height: number }> = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.3, height: 841.9 },
  legal: { width: 612, height: 1008 },
};

export const COLOR = /^#?([0-9a-fA-F]{6})$/;
export const color = (value: string, name: string): string => COLOR.exec(value)?.[1].toUpperCase() ?? fail(`"${name}" must be a colour as six hex digits, like C0392B.`);

export const number = (args: Args, name: string, min: number, max: number): number | undefined => {
  const value = args[name];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(`"${name}" must be a number.`);
  return value < min || value > max ? fail(`"${name}" must be between ${min} and ${max}.`) : value;
};

// --- How text looks ---------------------------------------------------------------

/** What of a run shows: what is read from a text to say how it looks, and what is copied to make another text look the same. */
export const LOOKS = ['fontFamily', 'fontSize', 'bold', 'italic', 'underline', 'strike', 'color', 'highlight'] as const;

/** The look of a run, every part of it given, so that it wins over what a text had. */
export function looksOf(props: RunProps): RunProps {
  const resolved = resolveRun(props);
  const out: RunProps = {};
  for (const key of LOOKS) (out as Record<string, unknown>)[key] = resolved[key];
  return out;
}

/** The look of a run in words: its font and size, and what it has besides. */
export function sayLooks(props: RunProps): string {
  const r = resolveRun(props);
  const marks = [
    r.bold && 'bold',
    r.italic && 'italic',
    r.underline && 'underline',
    r.strike && 'strike',
    r.color !== '000000' && `color ${r.color}`,
    r.highlight && `highlight ${r.highlight}`,
  ].filter(Boolean);
  return [`${r.fontFamily} ${r.fontSize} pt`, ...marks].join(', ');
}

export const runsOfText = (p: Paragraph) => p.runs.filter((run) => !run.props.anchor && !run.props.object && run.text);

/** The look most of the text of a paragraph has: what a text written in its place takes. */
export function mainLooks(doc: Doc, para: number): RunProps {
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

export const cm = (points: number) => `${Math.round((points / CM) * 100) / 100} cm`;

/** The look of a paragraph in words: where it sits, its indents and the room around it. */
/** The tab stops a tool was given, in order; undefined when it was given none. */
export function tabStops(given: unknown): TabStop[] | undefined {
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

export function sayParagraph(doc: Doc, para: number): string {
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
  if (r.keepLines) parts.push('lines kept together');
  if (r.pageBreakBefore) parts.push('starts a page');
  return parts.join('; ');
}

/** The stretches of a paragraph that look different, each with its text and its look. */
export function sayRuns(p: Paragraph): string[] {
  const out: { text: string; looks: string }[] = [];
  for (const run of p.runs) {
    if (run.props.anchor) continue;
    const text = run.props.object ? imageText(run) : run.text;
    const looks = sayLooks(run.props);
    const last = out[out.length - 1];
    if (last && last.looks === looks) last.text += text;
    else out.push({ text, looks });
  }
  return out.map(({ text, looks }) => `  "${text.length > 80 ? `${text.slice(0, 80)}…` : text}" — ${looks}`);
}

/** The properties a tool takes for how a text looks. */
export const LOOK_PROPERTIES = {
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
export function lookPatch(args: Args): RunProps {
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
export function segmentsOf(args: Args): { text: string; patch: RunProps }[] {
  if (Array.isArray(args.segments) && args.segments.length) {
    return (args.segments as Args[]).map((segment) => ({ text: optionalText(segment ?? {}, 'text') ?? '', patch: lookPatch(segment ?? {}) }));
  }
  return [{ text: optionalText(args, 'text') ?? '', patch: {} }];
}

export const SEGMENTS = {
  type: 'array',
  description:
    'Instead of "text": the text in pieces, each with what sets it apart from the rest (bold, italic, a colour…), to keep the words that were bold bold. The pieces are joined as they are: put the spaces in them.',
  items: { type: 'object', properties: { text: { type: 'string' }, ...LOOK_PROPERTIES }, required: ['text'] },
};

/** Gives the text of paragraph `para` from `start` the look `base`, and each segment its own on top. */
export function dress(doc: Doc, para: number, start: number, base: RunProps, segments: { text: string; patch: RunProps }[]): Doc {
  const total = segments.reduce((sum, segment) => sum + segment.text.length, 0);
  let next = applyRunProps(doc, { from: { para, offset: start }, to: { para, offset: start + total } }, base);
  let at = start;
  for (const segment of segments) {
    if (Object.keys(segment.patch).length && segment.text) next = applyRunProps(next, { from: { para, offset: at }, to: { para, offset: at + segment.text.length } }, segment.patch);
    at += segment.text.length;
  }
  return next;
}

export const cmOf = (points: number) => Math.round((points / CM) * 100) / 100;

/** A page as its size and margins say it. */
export function pageSaid(page: PageSetup): string {
  return `The page is ${cmOf(page.width)} × ${cmOf(page.height)} cm, with margins of ${cmOf(page.marginTop)} cm above, ${cmOf(page.marginBottom)} below, ${cmOf(page.marginLeft)} left and ${cmOf(page.marginRight)} right.`;
}

/** The sections of a document of several: their paragraphs, their page and their header and footer. Nothing for one of one. */
export function sectionsSaid(doc: Doc): string {
  const ends = sectionMarks(doc);
  if (!ends.length) return '';
  const story = (part: StoryPart) => {
    const body = (storyOf(doc, part)?.paragraphs ?? [])
      .map((p) => shown(p))
      .filter((value) => value.trim())
      .join(' / ');
    return body ? `"${body}"` : 'empty';
  };
  const lines = [...ends, doc.paragraphs.length - 1].map((end, k) => {
    const from = k ? ends[k - 1] + 1 : 0;
    const page = pageAt(doc, end);
    const last = k === ends.length;
    const own = hasOwnStories(doc, k);
    const parts = [
      `${cmOf(page.width)} × ${cmOf(page.height)} cm, margins ${cmOf(page.marginTop)} / ${cmOf(page.marginBottom)} / ${cmOf(page.marginLeft)} / ${cmOf(page.marginRight)} cm (top / bottom / left / right)`,
      last
        ? "its header and footer are the document's"
        : own
          ? `header ${story(sectionPart('header', k))}, footer ${story(sectionPart('footer', k))} of its own`
          : "shows the document's header and footer",
      hasOwnFirstPage(doc, k) ? `its first page has its own: header ${story(sectionPart('firstHeader', last ? undefined : k))}, footer ${story(sectionPart('firstFooter', last ? undefined : k))}` : '',
    ];
    return `${k + 1}. Paragraphs ${from + 1} to ${end + 1}: ${parts.filter(Boolean).join('; ')}.`;
  });
  return `Sections (each with its own page; "section" in set_page_setup, and with "area", says one):\n${lines.join('\n')}`;
}

/** The stretches of paragraphs set in columns. */
export function columnsSaid(doc: Doc): string {
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
export function fontsOf(doc: Doc): string {
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

/** The text boxes of the document, numbered as "area_textbox" takes them, with their text. */
export function textBoxesSaid(doc: Doc): string {
  const ids = drawnTextBoxes(doc).filter((id) => textBoxOf(doc, id));
  if (!ids.length) return '';
  const lines = ids.map(
    (id, i) =>
      `${i + 1}. ${
        textBoxOf(doc, id)!
          .paragraphs.map((p) => shown(p))
          .filter((t) => t.trim())
          .join(' / ') || '(empty)'
      }`,
  );
  return `Text boxes (read and change one with area "textbox" and its number in area_textbox):\n${lines.join('\n')}`;
}
