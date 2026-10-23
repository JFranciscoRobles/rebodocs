// What an assistant can do to a document, as tools: each has a name, a
// description, the shape of its arguments and a function from a document to
// what it says and, when it changes something, the document after. They are
// pure and use nothing of Node or of the browser, so the same ones run in the
// server, on a file, and in the page of the editor, on the document open there.
//
// Paragraphs go by their number, from 1, as `read_document` shows them. A
// place inside a paragraph goes by its text: what to find, and which time.

import {
  drawnTextBoxes,
  textBoxOf,
  textBoxPart,
  revisionNow,
  trackDocEdit,
  type Doc,
  type BasePart,
  type StoryPart,
  footnoteNumbers,
  footnotePart,
  endnotePart,
  shownEndnotes,
  hasOwnFirstPage,
  hasOwnStories,
  sectionCount,
  sectionPart,
  storyKind,
  storySource,
  storyOf,
  withStory,
  type Story,
  defined,
  propsAt,
} from '@rebodocs/core/internal';
import { type ToolContext, type ToolResult, type Args, type Tool, fail } from './tools/shared';
import { READING } from './tools/reading';
import { TEXT } from './tools/text';
import { FORMATTING } from './tools/formatting';
import { REVIEW } from './tools/review';
import { TEMPLATES } from './tools/templates';
import { TABLES } from './tools/tables';
import { PAGES } from './tools/pages';
import { editDocument } from './tools/batch';
import { CLAUSES } from './tools/clauses';

export { type Tool, type ToolContext, type ToolResult, ToolError } from './tools/shared';

export const TOOLS: Tool[] = [...READING, ...TEXT, editDocument((name) => BY_NAME.get(name)), ...CLAUSES, ...FORMATTING, ...REVIEW, ...TEMPLATES, ...TABLES, ...PAGES];

const BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

export const findTool = (name: string): Tool | undefined => BY_NAME.get(name);

const AREAS: Record<string, BasePart> = { header: 'header', footer: 'footer', first_header: 'firstHeader', first_footer: 'firstFooter' };

export const AREA = {
  type: 'string',
  enum: ['body', 'header', 'footer', 'first_header', 'first_footer', 'footnote', 'endnote', 'textbox'],
  description:
    'Which part of the document: its text ("body", when left out), the header or the footer every page shows, the ones the first page has to itself when the document gives it its own ("first_header", "first_footer": get_overview says whether it does), a note at the foot of the page ("footnote", with area_footnote), or a text box ("textbox", with area_textbox). Each has paragraphs numbered from 1 of its own.',
};

export const AREA_TEXTBOX = { type: 'integer', description: 'With area "textbox": the number of the text box, as get_overview lists them.' };

export const AREA_FOOTNOTE = { type: 'integer', description: 'With area "footnote": the number of the note, as read_document shows it in [^n].' };

export const AREA_ENDNOTE = { type: 'integer', description: 'With area "endnote": which note at the end, from 1 for the first (the one shown [^i]), as read_document lists them.' };

export const AREA_SECTION = {
  type: 'integer',
  description:
    'With "area", in a document of several sections: the section, from 1, whose own header or footer it is (get_overview says which have their own). Left out, the document\'s: those of the last section, which every section without its own shows.',
};

/** The properties of the arguments of a tool, with the part of the document where it can be told one. */
export const toolProperties = (tool: Tool): Record<string, unknown> =>
  tool.areas ? { ...tool.properties, area: AREA, area_section: AREA_SECTION, area_footnote: AREA_FOOTNOTE, area_endnote: AREA_ENDNOTE, area_textbox: AREA_TEXTBOX } : tool.properties;

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
  const { area = 'body', area_section: section = null, area_footnote: footnote = null, area_endnote: endnote = null, area_textbox: textbox = null, ...rest } = args;
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
    if (id === undefined)
      return fail(numbers.size ? `"area_footnote" must be the number of a note, from 1 to ${numbers.size}.` : 'The document has no notes at the foot of the page: put one in with insert_footnote.');
    if (name === 'add_note') return fail('A note cannot go in a note at the foot of the page. Put it on the text of the document.');
    if (!tool.areas) return fail(`${name} only works on the text of the document, not on a note at the foot of the page.`);
    return inStory(doc, tool, footnotePart(id), rest, context);
  }
  if (area === 'endnote') {
    const notes = shownEndnotes(doc);
    const id = Number.isInteger(endnote) ? notes[(endnote as number) - 1]?.id : undefined;
    if (id === undefined)
      return fail(notes.length ? `"area_endnote" must be the number of a note at the end, from 1 to ${notes.length}.` : 'The document has no notes at the end: put one in with insert_endnote.');
    if (name === 'add_note') return fail('A note cannot go in a note at the end. Put it on the text of the document.');
    if (!tool.areas) return fail(`${name} only works on the text of the document, not on a note at the end.`);
    return inStory(doc, tool, endnotePart(id), rest, context);
  }
  const base = typeof area === 'string' ? AREAS[area] : undefined;
  if (!base) return fail('"area" must be "body", "header", "footer", "first_header", "first_footer", "footnote", "endnote" or "textbox".');
  const named = String(area).replace('_', ' ');
  const count = sectionCount(doc);
  if (section !== null && (!Number.isInteger(section) || (section as number) < 1 || (section as number) > count)) return fail(`"area_section" must be from 1 to ${count}.`);
  // The last section's are the document's.
  const k = section === null || section === count ? undefined : (section as number) - 1;
  const part = sectionPart(base, k);
  if (k !== undefined && base === storyKind(base) && !hasOwnStories(doc, k))
    return fail(`Section ${k + 1} shows the document's header and footer: leave "area_section" out to change those, or give it its own first with set_page_setup (own_header_footer).`);
  if (base !== storyKind(base) && !hasOwnFirstPage(doc, k ?? count - 1))
    return fail(
      `The first page ${k === undefined ? 'of this document' : `of section ${k + 1}`} has no header and footer of its own: give it them with set_page_setup (different_first_page), or use "header" and "footer".`,
    );
  // Word has no comments in a header or a footer, so there is nowhere in the file for a note there.
  if (name === 'add_note') return fail(`A note cannot go in the ${named}: Word has no comments there. Put it on the text of the document.`);
  if (!tool.areas) return fail(`${name} only works on the text of the document, not on its ${named}.`);
  const story: Story | undefined = storyOf(doc, part);
  if (!story?.paragraphs.length && !tool.writes) return { text: `The document has no ${named}.` };
  return inStory(doc, tool, part, rest, context);
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
