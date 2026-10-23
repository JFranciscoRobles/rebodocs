// How the text looks: styles, lists, the look of words and of paragraphs, and links.

import {
  type ListKind,
  type Align,
  type ParagraphProps,
  type Range,
  applyRunProps,
  setParagraphProps,
  cleanHref,
  defined,
  leaveList,
  linkHref,
  listKindAt,
  paragraphLength,
  removeLink,
  setLink,
  setParagraphStyle,
  toggleList,
} from '@rebodocs/core/internal';
import { type Tool, fail, text, optionalText, optionalFlag, whole, paragraphIndex, PLACE, places, each, said, styleId, CM, number, tabStops, sayParagraph, LOOK_PROPERTIES, lookPatch } from './shared';

export const FORMATTING: Tool[] = [
  {
    name: 'set_style',
    title: 'Set the paragraph style',
    areas: true,
    description: 'Gives paragraphs a paragraph style: a heading, a title, the normal text. get_overview lists the styles of the document.',
    properties: {
      from: { type: 'integer', description: 'The first paragraph.' },
      to: { type: 'integer', description: 'The last one. The same as "from" when left out.' },
      style: { type: 'string', description: 'The style, such as Heading1 or Normal.' },
    },
    required: ['from', 'style'],
    writes: true,
    idempotent: true,
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
    title: 'Make or end a list',
    areas: true,
    description: 'Makes paragraphs the items of a list with bullets or with numbers, or takes them out of the list they are in.',
    properties: {
      from: { type: 'integer', description: 'The first paragraph.' },
      to: { type: 'integer', description: 'The last one. The same as "from" when left out.' },
      kind: { type: 'string', enum: ['bullet', 'number', 'none'] },
    },
    required: ['from', 'kind'],
    writes: true,
    idempotent: true,
    run(doc, args) {
      const from = paragraphIndex(doc, args, 'from');
      const to = paragraphIndex(doc, args, 'to', from + 1);
      if (to < from) fail('"to" is before "from".');
      const kind = text(args, 'kind');
      if (kind !== 'bullet' && kind !== 'number' && kind !== 'none') fail('"kind" must be "bullet", "number" or "none".');
      let next = doc;
      for (let i = from; i <= to; i++) if (listKindAt(next, i) && listKindAt(next, i) !== kind) next = leaveList(next, i);
      if (kind !== 'none' && !doc.paragraphs.slice(from, to + 1).every((_, i) => listKindAt(next, from + i) === kind)) next = toggleList(next, from, to, kind as ListKind);
      return {
        text: kind === 'none' ? `Paragraphs ${from + 1} to ${to + 1} are out of their list.` : `Paragraphs ${from + 1} to ${to + 1} are a ${kind} list.`,
        doc: next,
        reveal: { para: from, offset: 0 },
      };
    },
  },
  {
    name: 'format_text',
    title: 'Format text',
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
    idempotent: true,
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
      const where =
        args.find !== undefined ? said(found) : found[0].from.para === found[0].to.para ? `paragraph ${found[0].from.para + 1}` : `paragraphs ${found[0].from.para + 1} to ${found[0].to.para + 1}`;
      return { text: `Formatted in ${where}.`, doc: each(doc, found, (now, range) => applyRunProps(now, range, patch)), reveal: found[0].from };
    },
  },
  {
    name: 'format_paragraphs',
    title: 'Format paragraphs',
    areas: true,
    description:
      'Changes how paragraphs sit on the page: their alignment, indents, the room before and after them, their line spacing, their tab stops, and whether they keep with the next one. Give only what is to change.',
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
      keep_lines_together: { type: 'boolean', description: 'Keep all its lines on one page: the paragraph goes whole to the next page rather than being cut.' },
      tab_stops: {
        type: 'array',
        description: 'All the tab stops the paragraphs are to have, in place of the ones they have; [] for none. A tab in the text goes to the next one; past them, every 1.27 cm.',
        items: {
          type: 'object',
          properties: {
            at_cm: { type: 'number', description: 'From the left margin, in centimetres.' },
            align: {
              type: 'string',
              enum: ['left', 'center', 'right', 'decimal'],
              description: 'Whether the text after the tab starts there, is centred on it, ends there or has its decimal point there.',
            },
            leader: { type: 'string', enum: ['none', 'dot', 'hyphen', 'underscore'], description: 'What fills the room of the tab, as the dots of an index.' },
          },
          required: ['at_cm'],
        },
      },
    },
    required: ['from'],
    writes: true,
    idempotent: true,
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
        keepLines: optionalFlag(args, 'keep_lines_together'),
        tabs: tabStops(args.tab_stops),
      });
      if (!Object.keys(patch).length)
        fail('Say what to change: align, indent_left_cm, indent_right_cm, first_line_cm, space_before_pt, space_after_pt, line_spacing, tab_stops, keep_with_next or keep_lines_together.');
      const next = setParagraphProps(doc, from, to, patch);
      return { text: `Paragraphs ${from + 1} to ${to + 1}: ${sayParagraph(next, from)}.`, doc: next, reveal: { para: from, offset: 0 } };
    },
  },
  {
    name: 'set_link',
    title: 'Set or remove a link',
    areas: true,
    description: 'Makes a text a link to a web page, a mail address or a telephone; or, with an empty "url", takes its link away.',
    properties: { ...PLACE, url: { type: 'string', description: 'Where the link goes: https://…, a mail address or tel:…. Empty to remove the link.' } },
    required: ['find', 'url'],
    writes: true,
    idempotent: true,
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
    title: 'List the links',
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
];
