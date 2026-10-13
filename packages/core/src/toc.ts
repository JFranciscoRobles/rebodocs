// A table of contents in the text: a paragraph for each heading, with the
// page it is on at the end of a dotted leader. It is the field Word calls
// TOC, with its marks around the entries, so Word knows it for what it is and
// can bring it up to date itself. Here it is brought up to date by writing
// its entries again from the outline and the pages of a layout.

import { type Doc, type Paragraph, type Position, type RunProps, ANCHOR_CHAR, WRAP_SEPARATOR, defined, paragraphLength, plainText, resolveRun } from './model';
import { propsAt, splitParagraph } from './ops';
import { outline } from './outline';

/** The levels of heading a table of contents lists. */
const LEVELS = 3;
const BEGIN =
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
  `<w:r><w:instrText xml:space="preserve"> TOC \\o "1-${LEVELS}" \\h \\z \\u </w:instrText></w:r>` +
  '<w:r><w:fldChar w:fldCharType="separate"/></w:r>';
const END = '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
/** What tells, in the marks of a field, where one starts, where it ends, and that it is a table of contents. */
const TOKEN = /w:fldCharType="(begin|end)"|<w:instrText\b[^>]*>\s*(TOC)\b/g;
/** How far each level of heading is set in from the one above, and the space under an entry, in points. */
const LEVEL_INDENT = 14;
const ENTRY_SPACE = 4;

/** True for the marks a table of contents puts in a document made here: those of its field, and the bookmarks its entries lead to. */
export const isFieldMark = (xml: string | undefined) => !!xml && /<w:(fldChar|instrText|bookmarkStart|bookmarkEnd)\b/.test(xml);

/** The bookmark an entry leads to: what Word names the ones it makes for a table of contents. */
const BOOKMARK = /<w:bookmarkStart\b[^>]*\bw:name="(_Toc[^"]*)"/;
const LINK = /<w:hyperlink\b[^>]*\bw:anchor="([^"]*)"/;

/** The name of the bookmark of a table of contents a paragraph holds, if it has one. */
function bookmarkOf(p: Paragraph): string | undefined {
  for (const run of p.runs) {
    const name = run.props.anchor ? BOOKMARK.exec(run.props.object ?? '')?.[1] : undefined;
    if (name) return name;
  }
  return undefined;
}

/**
 * The paragraphs with a bookmark around each heading that had none, and the
 * name of the bookmark of each, by the index of its paragraph.
 */
function bookmarked(doc: Doc, headings: number[]): { paragraphs: Paragraph[]; names: Map<number, string> } {
  const names = new Map<number, string>();
  const taken = new Set<string>();
  let id = 900;
  for (const p of doc.paragraphs) {
    for (const run of p.runs) {
      if (!run.props.anchor || !run.props.object) continue;
      for (const match of run.props.object.matchAll(/<w:bookmarkStart\b[^>]*>/g)) {
        id = Math.max(id, Number(/\bw:id="(\d+)"/.exec(match[0])?.[1] ?? 0));
        taken.add(/\bw:name="([^"]*)"/.exec(match[0])?.[1] ?? '');
      }
    }
  }
  let serial = 100000000;
  let paragraphs = doc.paragraphs;
  for (const para of headings) {
    const p = doc.paragraphs[para];
    const had = bookmarkOf(p);
    if (had) {
      names.set(para, had);
      continue;
    }
    let name = `_Toc${++serial}`;
    while (taken.has(name)) name = `_Toc${++serial}`;
    taken.add(name);
    id++;
    const like = p.runs[0].props;
    if (paragraphs === doc.paragraphs) paragraphs = doc.paragraphs.slice();
    paragraphs[para] = { ...p, runs: [mark(`<w:bookmarkStart w:id="${id}" w:name="${name}"/>`, like), ...p.runs, mark(`<w:bookmarkEnd w:id="${id}"/>`, like)] };
    names.set(para, name);
  }
  return { paragraphs, names };
}

/**
 * The paragraph the entry of a table of contents at `para` leads to: the
 * heading that holds the bookmark the entry is a link to. Undefined for a
 * paragraph that is not such an entry, or whose heading is gone.
 */
export function tocTarget(doc: Pick<Doc, 'paragraphs'>, para: number): number | undefined {
  const range = tocRange(doc);
  if (!range || para < range.first || para > range.last) return undefined;
  let name: string | undefined;
  for (const run of doc.paragraphs[para].runs) name ??= LINK.exec(run.props.wrap ?? '')?.[1];
  if (!name) return undefined;
  const at = doc.paragraphs.findIndex((p) => bookmarkOf(p) === name);
  return at < 0 ? undefined : at;
}

/** The first and the last paragraph of the table of contents of the document, if it has one. */
export function tocRange(doc: Pick<Doc, 'paragraphs'>): { first: number; last: number } | undefined {
  let first = -1;
  let depth = 0;
  for (let para = 0; para < doc.paragraphs.length; para++) {
    for (const run of doc.paragraphs[para].runs) {
      if (!run.props.anchor || !run.props.object) continue;
      for (const token of run.props.object.matchAll(TOKEN)) {
        if (first < 0) {
          // The field starts where it says what it is: its own first mark came just before.
          if (token[2]) {
            first = para;
            depth = 1;
          }
        } else if (token[1] === 'begin') depth++;
        else if (token[1] === 'end' && --depth === 0) return { first, last: para };
      }
    }
  }
  return undefined;
}

export interface TocOptions {
  /** The page the heading at a paragraph of the document is on, from 1. */
  pageOf: (para: number) => number;
  /** What the table says while the document has no headings to list. */
  emptyText?: string;
}

const mark = (xml: string, like: RunProps) => ({ text: ANCHOR_CHAR, props: defined<RunProps>({ fontFamily: like.fontFamily, fontSize: like.fontSize, object: xml, anchor: true }) });

/** The headings a table of contents lists: those of its levels, outside the table itself. */
const listed = (doc: Doc, skip: { first: number; last: number } | undefined) =>
  outline(doc).filter((item) => item.level >= 1 && item.level <= LEVELS && !(skip && item.para >= skip.first && item.para <= skip.last));

/** The entries of a table of contents, each a link to the bookmark of its heading, with the marks of the field at both ends. */
function entries(doc: Doc, skip: { first: number; last: number } | undefined, like: RunProps, options: TocOptions, names: Map<number, string>): Paragraph[] {
  const headings = listed(doc, skip);
  const top = Math.min(...headings.map((item) => item.level));
  const right = doc.page.width - doc.page.marginLeft - doc.page.marginRight;
  const text: RunProps = defined({ fontFamily: like.fontFamily, fontSize: like.fontSize, color: like.color });
  const paragraphs = headings.map((item): Paragraph => ({
    props: { align: 'left', indentLeft: (item.level - top) * LEVEL_INDENT, indentFirstLine: 0, spacingBefore: 0, spacingAfter: ENTRY_SPACE, leaderTab: right },
    runs: [{ text: `${item.text}\t${options.pageOf(item.para)}`, props: { ...text, wrap: `<w:hyperlink w:anchor="${names.get(item.para)}" w:history="1">${WRAP_SEPARATOR}</w:hyperlink>` } }],
  }));
  if (!paragraphs.length) paragraphs.push({ props: { spacingBefore: 0, spacingAfter: ENTRY_SPACE }, runs: [{ text: options.emptyText ?? '', props: { ...text, italic: true } }] });
  const firstRuns = paragraphs[0].runs;
  paragraphs[0] = { ...paragraphs[0], runs: [mark(BEGIN, like), ...firstRuns] };
  const last = paragraphs.length - 1;
  paragraphs[last] = { ...paragraphs[last], runs: [...paragraphs[last].runs, mark(END, like)] };
  return paragraphs;
}

/** The formatting of the text of the entries the table has: that of its first run that is text. */
function entryProps(doc: Doc, first: number): RunProps {
  const run = doc.paragraphs[first].runs.find((r) => !r.props.object && r.text);
  const props = resolveRun(run?.props ?? doc.paragraphs[first].runs[0].props);
  return { fontFamily: props.fontFamily, fontSize: props.fontSize, color: props.color };
}

/** What each paragraph of a table says, to tell whether writing it again changed anything. */
const said = (paragraphs: Paragraph[]) =>
  paragraphs.map((p) => `${p.props.indentLeft ?? 0}|${p.props.leaderTab ?? 0}|${p.runs.map((run) => LINK.exec(run.props.wrap ?? '')?.[1] ?? '').join('')}|${plainText(p.runs)}`).join('\n');

/**
 * Writes the table of contents again from the headings the document has now
 * and the pages `pageOf` gives them. The same document comes back when it
 * has no table, or the table already says all of it.
 */
export function updateToc(doc: Doc, options: TocOptions): Doc {
  const range = tocRange(doc);
  if (!range) return doc;
  // Each heading gets a bookmark for its entry to lead to; that changes no index.
  const marked = bookmarked(doc, listed(doc, range).map((item) => item.para));
  const next = entries(doc, range, entryProps(doc, range.first), options, marked.names);
  const old = doc.paragraphs.slice(range.first, range.last + 1);
  if (said(old) === said(next) && marked.paragraphs === doc.paragraphs) return doc;
  const paragraphs = marked.paragraphs.slice();
  paragraphs.splice(range.first, old.length, ...next);
  return { ...doc, paragraphs };
}

/**
 * Puts a table of contents in at `pos`, under `title` when one is given. A
 * document has one table: with one already there, or inside a table cell,
 * nothing happens. Returns the document and the position after the table.
 */
export function insertToc(doc: Doc, pos: Position, options: TocOptions & { title?: string }): { doc: Doc; pos: Position } {
  const here = doc.paragraphs[pos.para];
  if (here.cell || tocRange(doc)) return { doc, pos };
  const like = propsAt(doc, pos);
  // An empty paragraph stays below the table; otherwise the paragraph is split around it.
  const split = paragraphLength(here) > 0 ? splitParagraph(doc, pos).doc : doc;
  const at = paragraphLength(here) > 0 ? pos.para + 1 : pos.para;
  const base: RunProps = { fontFamily: like.fontFamily, fontSize: resolveRun({}).fontSize, color: resolveRun({}).color };
  const heading: Paragraph[] = options.title
    ? [{ props: { spacingBefore: 0, spacingAfter: 8, keepNext: true }, runs: [{ text: options.title, props: { ...base, bold: true, fontSize: 16 } }] }]
    : [];
  // The entries are numbered against the document they are going into, where the headings below have moved down.
  const placeholder: Paragraph = { props: {}, runs: [mark(BEGIN, base), { text: ' ', props: base }, mark(END, base)] };
  const paragraphs = split.paragraphs.slice();
  paragraphs.splice(at, 0, ...heading, placeholder);
  const made = updateToc({ ...split, paragraphs }, options);
  const range = tocRange(made)!;
  return { doc: made, pos: { para: range.last + 1, offset: 0 } };
}
