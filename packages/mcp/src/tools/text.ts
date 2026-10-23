// Changing the text: replacing it, writing paragraphs anew, putting them in and taking them out.

import {
  type ListKind,
  type ParagraphProps,
  defined,
  deleteRange,
  insertText,
  listKindAt,
  paragraphLength,
  paragraphText,
  propsAt,
  replaceRange,
  setParagraphStyle,
  toggleList,
} from '@rebodocs/core/internal';
import {
  type Args,
  type Tool,
  fail,
  optionalText,
  optionalFlag,
  whole,
  paragraphIndex,
  afterIndex,
  lines,
  PLACE,
  places,
  each,
  said,
  spliced,
  styleId,
  inTable,
  looksOf,
  sayLooks,
  mainLooks,
  segmentsOf,
  SEGMENTS,
  dress,
} from './shared';

export const TEXT: Tool[] = [
  {
    name: 'replace_text',
    title: 'Replace text',
    areas: true,
    description:
      'Puts a text in place of another, in the formatting of what was there: its font, its size and its marks. The text to find has to be inside one paragraph. An empty "replace" deletes it. To write a whole paragraph anew, as in a translation, rewrite_paragraph keeps more of its look.',
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
    title: 'Rewrite a paragraph',
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
    title: 'Insert paragraphs',
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
      let next = spliced(
        doc,
        after,
        items.map((item) => item.text),
      );
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
      return {
        text: `Inserted as ${first === last ? `paragraph ${first + 1}` : `paragraphs ${first + 1} to ${last + 1}`}.${blank ? '' : ` The paragraphs after them moved down by ${items.length}.`}`,
        doc: next,
        reveal: { para: first, offset: 0 },
      };
    },
  },
  {
    name: 'delete_paragraphs',
    title: 'Delete paragraphs',
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
      if (!paragraphs.length || paragraphs.every((p) => p.cell))
        paragraphs.splice(from, 0, { props: {}, runs: [{ text: '', props: defined({ fontFamily: propsAt(doc, { para: from, offset: 0 }).fontFamily }) }] });
      return {
        text: `Deleted ${to - from + 1} ${to === from ? 'paragraph' : 'paragraphs'}. The ones after moved up.`,
        doc: { ...doc, paragraphs },
        reveal: { para: Math.min(from, paragraphs.length - 1), offset: 0 },
      };
    },
  },
];
