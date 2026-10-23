// The page: its setup, columns, breaks, numbers, letterhead, notes at the foot, text boxes and the table of contents.

import {
  drawnTextBoxes,
  insertTextBox,
  textBoxOf,
  textBoxPart,
  type Doc,
  footnoteNumbers,
  insertFootnote,
  insertEndnote,
  noteLabels,
  pageAt,
  sectionCount,
  sectionMarks,
  setOwnFirstPage,
  setOwnStories,
  setSectionPage,
  withStory,
  type PageNumberFormat,
  type Position,
  type Range,
  columnsAt,
  insertColumnBreak,
  setColumns,
  type Columns,
  type PageSetup,
  imageExtension,
  pageNumbering,
  setPageNumbering,
  insertText,
  letterheadOf,
  pngLetterheadMargins,
  removeLetterhead,
  setLetterhead,
  withLetterheadMargins,
  insertToc,
  paragraphLength,
  tocRange,
  updateToc,
} from '@rebodocs/core/internal';
import {
  type ToolContext,
  type Tool,
  fail,
  text,
  optionalText,
  optionalFlag,
  whole,
  paragraphIndex,
  afterIndex,
  PLACE,
  places,
  spliced,
  inTable,
  CM,
  pictureSize,
  PAPERS,
  number,
  pageSaid,
  sectionsSaid,
} from './shared';

export const PAGES: Tool[] = [
  {
    name: 'set_columns',
    title: 'Set columns',
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
    idempotent: true,
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
      return {
        text: `Set in ${count === 1 ? 'one column' : `${count} columns`}${columns.separator ? ' with a line between them' : ''}. Paragraphs that only end a section may have been added: read the document again before giving numbers.`,
        doc: next,
        reveal: range.from,
      };
    },
  },
  {
    name: 'insert_column_break',
    title: 'Insert a column break',
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
    title: 'Insert a footnote',
    description:
      'Puts a note at the foot of the page: its number goes in the text right after a text found with "find" (or at the end of paragraph "at_paragraph"), and the note says "text". Notes are numbered by where they are in the text.',
    properties: {
      ...PLACE,
      at_paragraph: { type: 'integer', description: 'Instead of "find": the paragraph at whose end the number goes.' },
      text: { type: 'string', description: 'What the note says.' },
    },
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
    name: 'insert_endnote',
    title: 'Insert an endnote',
    description:
      'Puts a note at the end of the document, after its text (or at the end of its section, when the document puts them there): its number (i, ii, iii) goes in the text right after a text found with "find" (or at the end of paragraph "at_paragraph"), and the note says "text". Notes at the end are numbered by where they are in the text, apart from those at the foot of the page.',
    properties: {
      ...PLACE,
      at_paragraph: { type: 'integer', description: 'Instead of "find": the paragraph at whose end the number goes.' },
      text: { type: 'string', description: 'What the note says.' },
    },
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
      const result = insertEndnote(doc, pos, said);
      const label = noteLabels(result.doc, 'endnote').get(result.id);
      return { text: `Note ${label} is at the end of the document; its number is in paragraph ${pos.para + 1}.`, doc: result.doc, reveal: result.pos };
    },
  },
  {
    name: 'insert_text_box',
    title: 'Insert a text box',
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
    name: 'set_letterhead',
    title: 'Set the letterhead',
    description:
      'Gives the document a letterhead: a picture from a file (PNG, JPEG or GIF), stretched over the whole page behind the text of every page, in place of the one it had. For a PNG, the top and bottom margins grow to clear what it prints there. With "remove", takes it away; the rest of the header stays. get_overview says whether the document has one.',
    properties: {
      path: { type: 'string', description: 'The path of the picture file, the shape of the paper.' },
      remove: { type: 'boolean', description: 'True to take the letterhead away instead.' },
    },
    writes: true,
    idempotent: true,
    run(doc, args) {
      if (args.remove === true) {
        if (!letterheadOf(doc)) return { text: 'The document has no letterhead.' };
        return { text: 'Letterhead removed. The margins are as they were.', doc: removeLetterhead(doc) };
      }
      // The file is read by whoever runs the tool, which gives its bytes here: a page cannot open a path.
      const type = optionalText(args, 'type') ?? '';
      const data = optionalText(args, 'data') ?? fail('Give "path", the picture file, or "remove": true.');
      if (!imageExtension(type)) fail('Only PNG, JPEG and GIF pictures can be a letterhead.');
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      if (!pictureSize(bytes, type)) fail('The file is not a picture that can be read.');
      let next = setLetterhead(doc, { bytes, type });
      const asked = type === 'image/png' ? pngLetterheadMargins(bytes, next.page) : undefined;
      if (asked) next = withLetterheadMargins(next, asked);
      const cm = (pt: number) => (pt / CM).toFixed(1);
      const margins = next.page === doc.page ? 'The margins clear it already.' : `Top margin ${cm(next.page.marginTop)} cm, bottom ${cm(next.page.marginBottom)} cm, to clear what it prints.`;
      return { text: `Letterhead set, behind the text of every page. ${asked ? margins : 'Its margins were not read: set them with set_page_setup if its printing needs room.'}`, doc: next };
    },
  },
  {
    name: 'set_page_setup',
    title: 'Page setup',
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
      different_first_page: {
        type: 'boolean',
        description: 'Whether the first page (of the section, with "section") has a header and a footer of its own ("first_header", "first_footer"), which start empty.',
      },
      own_header_footer: {
        type: 'boolean',
        description:
          "With \"section\", for one before the last: true gives it a header and a footer of its own, copies of the document's to begin with; false has it show the document's, which are the last section's.",
      },
    },
    writes: true,
    idempotent: true,
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
    title: 'Page numbers',
    description: 'Puts the number of the page in the header or the footer of every page, moves it, changes how it reads, or takes it away.',
    properties: {
      place: { type: 'string', enum: ['header', 'footer', 'none'], description: '"none" takes the number away.' },
      align: { type: 'string', enum: ['left', 'center', 'right'], description: 'Centre when left out.' },
      format: {
        type: 'string',
        enum: ['number', 'numberOfTotal', 'page', 'pageOfTotal'],
        description: 'How it reads: "3", "3 / 9", "Page 3" or "Page 3 of 9" (in the words of the document’s language: "Página 3 de 9" in Spanish). The first when left out.',
      },
    },
    required: ['place'],
    writes: true,
    idempotent: true,
    run(doc, args) {
      const place = text(args, 'place');
      if (place === 'none') return pageNumbering(doc) ? { text: 'Page number removed.', doc: setPageNumbering(doc, undefined) } : { text: 'The document had no page number.' };
      if (place !== 'header' && place !== 'footer') fail('"place" must be "header", "footer" or "none".');
      const now = pageNumbering(doc);
      const align = optionalText(args, 'align') ?? now?.align ?? 'center';
      const format = optionalText(args, 'format') ?? now?.format ?? 'number';
      if (align !== 'left' && align !== 'center' && align !== 'right') fail('"align" must be "left", "center" or "right".');
      if (!['number', 'numberOfTotal', 'page', 'pageOfTotal'].includes(format)) fail('"format" must be "number", "numberOfTotal", "page" or "pageOfTotal".');
      return {
        text: `Page number in the ${place}, ${align}.`,
        doc: setPageNumbering(doc, { place: place as 'header' | 'footer', align: align as 'left' | 'center' | 'right', format: format as PageNumberFormat }),
      };
    },
  },
  {
    name: 'insert_page_break',
    title: 'Insert a page break',
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
    title: 'Insert a table of contents',
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
    title: 'Update the table of contents',
    description: 'Writes the table of contents again from the headings and the pages the document has now. Do it after changing headings, or text that moves them to other pages.',
    properties: {},
    writes: true,
    idempotent: true,
    run(doc, _args, context) {
      if (!tocRange(doc)) fail('The document has no table of contents: insert_table_of_contents puts one in.');
      const pageOf = context.pageOf ?? fail('The pages of the document cannot be worked out here.');
      const next = settled(doc, pageOf);
      return next === doc
        ? { text: 'The table of contents was already up to date.' }
        : { text: 'Table of contents brought up to date.', doc: next, reveal: { para: tocRange(next)!.first, offset: 0 } };
    },
  },
];

/** The table of contents written again until doing so no longer moves its own headings to other pages: a pass or two. */
export function settled(doc: Doc, pageOf: NonNullable<ToolContext['pageOf']>): Doc {
  let now = doc;
  for (let pass = 0; pass < 3; pass++) {
    const next = updateToc(now, { pageOf: pageOf(now) });
    if (next === now) break;
    now = next;
  }
  return now;
}
