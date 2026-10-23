// Reading the document: what it says, how it looks, and what is in it.

import {
  revisionsOf,
  compareDocs,
  describeChange,
  importDocx,
  type Change,
  type Doc,
  type Layout,
  locateCell,
  paragraphText,
  endnoteOf,
  endnoteReferences,
  noteLabels,
  footnoteNumbers,
  footnoteOf,
  footnoteReferences,
  sectionMarks,
  storyKind,
  findAll,
  hasRevisions,
  letterheadOf,
  listLabels,
  outline,
  tocRange,
  variableNames,
} from '@rebodocs/core/internal';
import {
  type Tool,
  fail,
  whole,
  text,
  optionalText,
  optionalFlag,
  paragraphIndex,
  shown,
  shownOffset,
  words,
  styleNames,
  line,
  READ_LIMIT,
  sayParagraph,
  sayRuns,
  sectionsSaid,
  columnsSaid,
  fontsOf,
  textBoxesSaid,
  endnoteTag,
  endnoteTags,
} from './shared';

export const READING: Tool[] = [
  {
    name: 'get_overview',
    title: 'Document overview',
    description: 'A summary of the document: how long it is, its headings with the paragraph each is at, its template variables, its notes and its paragraph styles. Start here.',
    properties: {},
    writes: false,
    run(doc) {
      const headings = outline(doc).map((item) => `${'  '.repeat(Math.max(item.level - 1, 0))}- ${item.text} [${item.para + 1}]`);
      const names = variableNames(doc);
      const story = (name: string, part: Doc['header']) => {
        const body = (part?.paragraphs ?? [])
          .map((p) => shown(p))
          .filter((value) => value.trim())
          .join(' / ');
        return body ? `${name}: ${body}` : '';
      };
      return {
        text: [
          `${doc.paragraphs.length} paragraphs, ${words(doc)} words, ${(doc.tables ?? []).filter((table) => table.rows.length).length} tables, ${doc.notes?.length ?? 0} notes.`,
          tocRange(doc) ? 'It has a table of contents.' : '',
          footnoteNumbers(doc).size ? `It has ${footnoteNumbers(doc).size} notes at the foot of the page, shown as [^n] in read_document.` : '',
          endnoteTags(doc).size ? `It has ${endnoteTags(doc).size} notes at the end, after its text, shown as [^${endnoteTag([...endnoteTags(doc).values()][0])}] and on in read_document.` : '',
          textBoxesSaid(doc),
          doc.trackRevisions || revisionsOf(doc).length
            ? `${doc.trackRevisions ? 'Changes are tracked: what you change stays marked for the person to accept or reject.' : 'Changes are not tracked.'} ${revisionsOf(doc).length} tracked changes, shown in read_document as {+put in+} and [-taken out-] (list_changes).`
            : '',
          letterheadOf(doc) ? 'It has a letterhead: a picture the size of the page behind the text of every page (set_letterhead).' : '',
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
    title: 'Read the text',
    areas: true,
    description:
      'The text of the document, one paragraph a line, each with its number in brackets and, in parentheses, its style and its table cell when it has them. A long document comes in parts: ask for the next with "from".',
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
      const ends = endnoteTags(doc);
      const out: string[] = [];
      let size = 0;
      let i = from;
      for (; i <= to; i++) {
        const next = line(doc, i, labels, numbers, ends);
        if (out.length && size + next.length > READ_LIMIT) break;
        out.push(next);
        size += next.length + 1;
      }
      const more = i <= to ? `\n… ${to - i + 1} more paragraphs: read on with from=${i + 1}.` : '';
      // The notes at the foot of the page the paragraphs read refer to.
      const cited = [
        ...new Set(
          footnoteReferences(doc)
            .filter((ref) => ref.para >= from && ref.para < i && numbers.has(ref.id))
            .map((ref) => ref.id),
        ),
      ];
      const notes = cited.map(
        (id) =>
          `[^${numbers.get(id)}] ${footnoteOf(doc, id)!
            .paragraphs.map((p) => shown(p))
            .join(' / ')
            .trim()}`,
      );
      const footer = notes.length ? `\nNotes at the foot of the page (area "footnote" with area_footnote reads or changes one):\n${notes.join('\n')}` : '';
      // And those at the end, with the number area_endnote takes: 1 for the first.
      const order = [...ends.keys()];
      const citedEnds = [
        ...new Set(
          endnoteReferences(doc)
            .filter((ref) => ref.para >= from && ref.para < i && ends.has(ref.id))
            .map((ref) => ref.id),
        ),
      ];
      const endLines = citedEnds.map(
        (id) =>
          `[^${endnoteTag(ends.get(id)!)}] (area_endnote ${order.indexOf(id) + 1}) ${endnoteOf(doc, id)!
            .paragraphs.map((p) => shown(p))
            .join(' / ')
            .trim()}`,
      );
      const after = endLines.length ? `\nNotes at the end (area "endnote" with area_endnote reads or changes one):\n${endLines.join('\n')}` : '';
      return { text: out.join('\n') + more + footer + after };
    },
  },
  {
    name: 'read_formatting',
    title: 'Read the formatting',
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
    title: 'Compare with another file',
    description:
      'What changed between this document and another version of it in a .docx file ("path"): the paragraphs put in, taken out and changed, of the text and of its headers, footers, notes at the foot of the page and text boxes, and the notes on the text (as add_note makes), with what was taken out as [-…-] and what was put in as {+…+}. Tracked changes are compared as if accepted, as Word does. By default the file is the earlier version; with "file_is" "later", it is the later one.',
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
      const { changes, notes } = later ? compareDocs(doc, other) : compareDocs(other, doc);
      if (!changes.length && !notes.length) return { text: 'There is no difference in the text, the headers, the footers, the notes or the text boxes.' };
      /** Where a change is, by the numbers of this document when it has the paragraph. */
      const where = (change: Change) => {
        const mine = later ? change.before : change.after;
        const theirs = later ? change.after : change.before;
        const place = mine !== undefined ? `[${mine + 1}]` : `(only in the file, its paragraph ${theirs! + 1})`;
        if (!change.part) return place;
        const note = change.part.startsWith('footnote:')
          ? (footnoteNumbers(later ? doc : other).get(change.part.slice(9)) ?? footnoteNumbers(later ? other : doc).get(change.part.slice(9)))
          : undefined;
        const kind = storyKind(change.part);
        const end = change.part.startsWith('endnote:')
          ? (noteLabels(later ? doc : other, 'endnote').get(change.part.slice(8)) ?? noteLabels(later ? other : doc, 'endnote').get(change.part.slice(8)))
          : undefined;
        const name = note !== undefined ? `Footnote ${note}` : end !== undefined ? `Endnote ${end}` : kind === 'textbox' ? 'Text box' : kind === 'header' ? 'Header' : 'Footer';
        return `${name} ${place}`;
      };
      const WORDS = { added: 'put in', removed: 'taken out', changed: 'changed', formatted: 'same text, another look' } as const;
      const MOST = 200;
      const lines = changes.slice(0, MOST).map((change) => `${where(change)} ${WORDS[change.kind]}: ${describeChange(change)}`);
      if (changes.length > MOST) lines.push(`…and ${changes.length - MOST} more.`);
      const NOTE_WORDS = { added: 'written', removed: 'taken out', changed: 'changed' } as const;
      for (const change of notes) lines.push(`Note by ${change.author} ${NOTE_WORDS[change.kind]}: ${describeChange(change)}`);
      const total = changes.length + notes.length;
      const tracked = hasRevisions(doc) || hasRevisions(other) ? ' Tracked changes were taken as accepted, so the numbers are those the paragraphs would have with them accepted.' : '';
      const head = `${total} ${total === 1 ? 'change' : 'changes'} from the ${later ? 'document' : 'file'} to the ${later ? 'file' : 'document'}; the numbers in brackets are those of this document's paragraphs:${tracked}`;
      return { text: `${head}\n${lines.join('\n')}` };
    },
  },
  {
    name: 'read_pages',
    title: 'Read the pages',
    description:
      'How the document falls on its pages, as it prints: for each page, the paragraphs on it, how it starts and ends and how much room is left at its foot; and what may want mending: a paragraph cut by the end of a page, a heading left at the foot of one with its text on the next, a page with only a line or two, a table that runs over pages, a page with nothing on it. Read it after changes that move text, before a document goes out.',
    properties: {
      from: { type: 'integer', description: 'The first page, from 1. 1 when left out.' },
      to: { type: 'integer', description: 'The last page. 30 after "from" when left out.' },
    },
    writes: false,
    run(doc, args, context) {
      const layout = context.layoutOf?.(doc) ?? fail('The pages of the document cannot be worked out here.');
      const count = layout.pages.length;
      const from = whole(args, 'from') ?? 1;
      if (from < 1 || from > count) fail(`There is no page ${from}: the document has ${count}.`);
      const to = Math.min(whole(args, 'to') ?? from + 29, count);
      if (to < from) fail('"to" is before "from".');
      const headings = new Set(outline(doc).map((item) => item.para));
      const out: string[] = [`${count} ${count === 1 ? 'page' : 'pages'}.`];
      const notes: string[] = [];
      for (let i = from - 1; i < to; i++) {
        const said = pageSaid(doc, layout, i, headings);
        out.push(said.line);
        notes.push(...said.notes);
      }
      for (const [table, pages] of tablesOverPages(doc, layout)) if (pages[1] >= from && pages[0] <= to) notes.push(`Table ${table + 1} runs from page ${pages[0]} to page ${pages[1]}.`);
      if (to < count) out.push(`… ${count - to} more pages: read on with from=${to + 1}.`);
      return { text: [...out, notes.length ? `To look at:\n${notes.map((note) => `- ${note}`).join('\n')}` : 'Nothing looks out of place.'].join('\n') };
    },
  },
  {
    name: 'find_text',
    title: 'Find text',
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
        const para = doc.paragraphs[range.from.para];
        const whole = shown(para);
        const at = shownOffset(para, range.from.offset);
        const start = Math.max(0, at - 40);
        return `[${range.from.para + 1}] ${start ? '…' : ''}${whole.slice(start, at + query.length + 40)}${at + query.length + 40 < whole.length ? '…' : ''}`;
      });
      return { text: `${found.length} ${found.length === 1 ? 'match' : 'matches'}${found.length > 50 ? ', the first 50' : ''}:\n${shownOnes.join('\n')}` };
    },
  },
];

/** A page in a line, and what on it may want mending. */
function pageSaid(doc: Doc, layout: Layout, i: number, headings: Set<number>): { line: string; notes: string[] } {
  const page = layout.pages[i];
  const body = page.lines;
  const n = i + 1;
  // A page of notes at the end alone is the end of the document, not a blank one.
  if (!body.length && page.endnotes?.notes.length) return { line: `Page ${n}: notes at the end only.`, notes: [] };
  if (!body.length) return { line: `Page ${n}: nothing on it.`, notes: [`Page ${n} is blank.`] };
  const setup = page.setup ?? layout.page;
  const first = body[0];
  const last = body[body.length - 1];
  const paras = [...new Set(body.map((line) => line.para))];
  const bottom = Math.max(...body.map((line) => line.y + line.height));
  // The foot of the text: the line over the notes at the foot of the page, when it has them.
  const room = Math.max(0, (page.footnotes?.rule.y ?? setup.height - setup.marginBottom) - bottom);
  const cut = (text: string, end: boolean) => (text.length > 50 ? (end ? `…${text.slice(-50)}` : `${text.slice(0, 50)}…`) : text);
  const textOf = (line: Layout['lines'][number]) => paragraphText(doc.paragraphs[line.para]).slice(line.start, line.end).trim();
  const range = paras.length === 1 ? `paragraph ${paras[0] + 1}` : `paragraphs ${paras[0] + 1} to ${paras[paras.length - 1] + 1}`;
  const notes: string[] = [];
  // Where the page ends: in the middle of a paragraph, or on a heading whose text is on the next.
  const next = layout.pages[i + 1];
  if (next?.lines.length) {
    if (!last.lastInParagraph && last.cell === undefined) notes.push(`Paragraph ${last.para + 1} is cut by the end of page ${n} and goes on on page ${n + 1}.`);
    else if (headings.has(last.para))
      notes.push(`The heading "${cut(paragraphTextOf(doc, last.para), false)}" (paragraph ${last.para + 1}) is the last thing on page ${n}; its text starts on page ${n + 1}.`);
    if (body.length <= 2 && i > 0) notes.push(`Page ${n} has only ${body.length === 1 ? 'one line' : 'two lines'}.`);
  } else if (body.length <= 2 && i > 0) notes.push(`The last page, ${n}, has only ${body.length === 1 ? 'one line' : 'two lines'}.`);
  return {
    line: `Page ${n}: ${range}, ${body.length} ${body.length === 1 ? 'line' : 'lines'}; starts "${cut(textOf(first), false)}", ends "${cut(textOf(last), true)}"; ${(room / (72 / 2.54)).toFixed(1)} cm left at the foot.`,
    notes,
  };
}

const paragraphTextOf = (doc: Doc, para: number) => shown(doc.paragraphs[para]).trim();

/** The tables that are on more than one page, with the first and the last of them, from 1. */
function tablesOverPages(doc: Doc, layout: Layout): Map<number, [number, number]> {
  const out = new Map<number, [number, number]>();
  for (const line of layout.lines) {
    if (line.cell === undefined || !doc.paragraphs[line.para]?.cell) continue;
    const table = locateCell(doc, line.para)?.tableIndex;
    if (table === undefined) continue;
    const pages = out.get(table);
    out.set(table, pages ? [Math.min(pages[0], line.page + 1), Math.max(pages[1], line.page + 1)] : [line.page + 1, line.page + 1]);
  }
  for (const [table, pages] of out) if (pages[0] === pages[1]) out.delete(table);
  return out;
}
