import { describe, expect, it } from 'vitest';
import { type Doc, type FontSpec, type Paragraph, type TextMeasurer, createDoc, drawnTextBoxes, layoutDocument, plainText, setParagraphStyle, styleIdAt } from '@rebodocs/core/internal';
import { TOOLS, ToolError, runTool } from '../src/tools';
import { follow } from '../src/tools/batch';

const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });
const texts = (doc: Doc) => doc.paragraphs.map((para) => plainText(para.runs).replace(/⁠/g, ''));
const numbered = (n: number) => createDoc(Array.from({ length: n }, (_, i) => p(`Párrafo ${i + 1}`)));
const apply = (doc: Doc, name: string, args: Record<string, unknown>, context = {}) => {
  const result = runTool(doc, name, args, context);
  expect(result.doc, result.text).toBeDefined();
  return result;
};
const error = (doc: Doc, name: string, args: Record<string, unknown>, context = {}) => {
  try {
    runTool(doc, name, args, context);
  } catch (e) {
    expect(e).toBeInstanceOf(ToolError);
    return (e as Error).message;
  }
  throw new Error('expected the tool to fail');
};

// Every letter half as wide as the size of its font: 10 pt text, 5 pt a letter.
const measurer: TextMeasurer = {
  width: (text: string, font: FontSpec) => text.length * font.size * 0.5,
  metrics: (font: FontSpec) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

describe('several edits at once', () => {
  it('takes every number from the document as it was read', () => {
    const doc = numbered(6);
    const { doc: after, text } = apply(doc, 'edit_document', {
      edits: [
        { tool: 'insert_paragraphs', after_paragraph: 1, paragraphs: [{ text: 'Nuevo A' }, { text: 'Nuevo B' }] },
        { tool: 'delete_paragraphs', from: 3, to: 4 },
        { tool: 'rewrite_paragraph', paragraph: 5, text: 'Quinto, de nuevo' },
        { tool: 'replace_text', find: 'Párrafo 6', replace: 'Sexto' },
        { tool: 'set_style', from: 2, style: 'Heading1' },
      ],
    });
    expect(texts(after!)).toEqual(['Párrafo 1', 'Nuevo A', 'Nuevo B', 'Párrafo 2', 'Quinto, de nuevo', 'Sexto']);
    expect(styleIdAt(after!, 3)).toBe('Heading1');
    expect(text).toContain('Made 5 edits');
    expect(text).toContain('read it again');
  });

  it('keeps in the order given what goes after the same paragraph', () => {
    const { doc } = apply(numbered(2), 'edit_document', {
      edits: [
        { tool: 'insert_paragraphs', after_paragraph: 1, paragraphs: [{ text: 'Primero' }] },
        { tool: 'insert_paragraphs', after_paragraph: 1, paragraphs: [{ text: 'Segundo' }] },
        { tool: 'insert_paragraphs', after_paragraph: 2, paragraphs: [{ text: 'Al final' }] },
        { tool: 'insert_paragraphs', after_paragraph: 0, paragraphs: [{ text: 'Al principio' }] },
      ],
    });
    expect(texts(doc!)).toEqual(['Al principio', 'Párrafo 1', 'Primero', 'Segundo', 'Párrafo 2', 'Al final']);
  });

  it('changes all or nothing', () => {
    const doc = numbered(3);
    expect(
      error(doc, 'edit_document', {
        edits: [
          { tool: 'rewrite_paragraph', paragraph: 1, text: 'Uno' },
          { tool: 'replace_text', find: 'no está', replace: 'x' },
        ],
      }),
    ).toMatch(/^Edit 2 \(replace_text\): .*Nothing was changed\.$/);
    expect(
      error(doc, 'edit_document', {
        edits: [
          { tool: 'delete_paragraphs', from: 2 },
          { tool: 'rewrite_paragraph', paragraph: 2, text: 'Dos' },
        ],
      }),
    ).toContain('paragraph 2 ("paragraph") was deleted or written over by an earlier edit');
    expect(error(doc, 'edit_document', { edits: [{ tool: 'set_page_setup', paper: 'a4' }] })).toContain('"tool" must be one of');
    expect(error(doc, 'edit_document', { edits: [{ tool: 'replace_text', area: 'header', find: 'a', replace: 'b' }] })).toContain('the text of the document only');
    expect(error(doc, 'edit_document', { edits: [] })).toContain('"edits" must be a list');
  });

  it('is tracked as one change of the assistant while changes are tracked', () => {
    const doc = { ...numbered(2), trackRevisions: true };
    const { doc: after } = apply(
      doc,
      'edit_document',
      {
        edits: [
          { tool: 'replace_text', find: 'Párrafo 1', replace: 'Uno' },
          { tool: 'replace_text', find: 'Párrafo 2', replace: 'Dos' },
        ],
      },
      { now: new Date('2026-10-22T12:00:00Z') },
    );
    expect(runTool(after!, 'list_changes').text).toContain('Assistant');
  });

  it('follows each paragraph through a change', () => {
    const [a, b, c, d] = [p('a'), p('b'), p('c'), p('d')];
    // Two put in after b; c taken out; b written anew.
    expect(follow([a, b, c, d], [a, b, p('x'), p('y'), c, d], [0, 1, 2, 3])).toEqual([0, 1, 4, 5]);
    expect(follow([a, b, c, d], [a, b, d], [0, 1, 2, 3])).toEqual([0, 1, -1, 2]);
    expect(follow([a, b, c, d], [a, p('B'), c, d], [0, 1, 2, 3])).toEqual([0, 1, 2, 3]);
    expect(follow([a, b, c], [p('A'), p('new'), b, c], [0, 1, 2])).toEqual([-1, 2, 3]);
  });
});

describe('the pages of a document', () => {
  // 100 pt wide, 50 pt of text a page: 20 letters a line, 5 lines a page.
  const page = { width: 120, height: 70, marginTop: 10, marginRight: 10, marginBottom: 10, marginLeft: 10 };
  const small = (doc: Doc): Doc => ({
    ...doc,
    page,
    paragraphs: doc.paragraphs.map((para) => ({
      ...para,
      props: { ...para.props, spacingAfter: 0, spacingBefore: 0, lineHeight: 1 },
      runs: para.runs.map((run) => ({ ...run, props: { ...run.props, fontSize: 10 } })),
    })),
  });
  const layoutOf = (doc: Doc) => layoutDocument(doc, measurer);

  it('says what is on each page and what may want mending', () => {
    const doc = small(createDoc([p('Uno'), p('Dos'), p('Tres'), p('Cuatro'), p('Cinco'), p('Sola')]));
    expect(runTool(doc, 'read_pages', {}, { layoutOf }).text).toBe(
      [
        '2 pages.',
        'Page 1: paragraphs 1 to 5, 5 lines; starts "Uno", ends "Cinco"; 0.0 cm left at the foot.',
        'Page 2: paragraph 6, 1 line; starts "Sola", ends "Sola"; 1.4 cm left at the foot.',
        'To look at:',
        '- The last page, 2, has only one line.',
      ].join('\n'),
    );
    // A heading is kept with its text: it goes to the next page with it, and nothing is left to mend.
    const heading = setParagraphStyle(small(createDoc([p('Uno'), p('Dos'), p('Tres'), p('Cuatro'), p('Título'), p('Un párrafo largo que no cabe en una línea.')])), 4, 4, 'Heading1');
    const read = runTool(small(heading), 'read_pages', {}, { layoutOf }).text;
    expect(read).toContain('Page 2: paragraphs 5 to 6');
    expect(read).toContain('Nothing looks out of place.');
  });

  it('cuts a long document in parts, and says when it cannot lay it out', () => {
    const doc = small(numbered(40));
    const first = runTool(doc, 'read_pages', { to: 2 }, { layoutOf }).text;
    expect(first).toContain('Page 2:');
    expect(first).not.toContain('Page 3:');
    expect(first).toContain('read on with from=3');
    expect(error(doc, 'read_pages', { from: 99 }, { layoutOf })).toContain('There is no page 99');
    expect(error(doc, 'read_pages', {})).toContain('cannot be worked out here');
  });

  it('finds a paragraph cut by the end of a page', () => {
    const long = 'palabra '.repeat(20).trim();
    const doc = small(createDoc([p('Uno'), p('Dos'), p('Tres'), p(long)]));
    expect(runTool(doc, 'read_pages', {}, { layoutOf }).text).toContain('Paragraph 4 is cut by the end of page 1 and goes on on page 2.');
  });
});

describe('tools with few tests until now', () => {
  it('sets a style by its name or its id, and says the ones there are', () => {
    const { doc } = apply(numbered(3), 'set_style', { from: 1, to: 2, style: 'heading 1' });
    expect([styleIdAt(doc!, 0), styleIdAt(doc!, 1), styleIdAt(doc!, 2)]).toEqual(['Heading1', 'Heading1', 'Normal']);
    expect(error(numbered(1), 'set_style', { from: 1, style: 'Inventado' })).toContain('There is no style "Inventado"');
  });

  it('puts in a page break after a paragraph', () => {
    const { doc } = apply(numbered(2), 'insert_page_break', { after_paragraph: 1 });
    expect(runTool(doc!, 'read_document').text).toContain('[page break]');
    expect(error(numbered(2), 'insert_page_break', { after_paragraph: 9 })).toContain('between 0 and 2');
  });

  it('puts in a block of signatures, side by side', () => {
    const { doc, text } = apply(numbered(1), 'insert_signatures', { after_paragraph: 1, titles: ['ASESOR', 'CLIENTE'], names: ['Ana', '{{cliente}}'] });
    expect(text.length).toBeGreaterThan(0);
    const read = runTool(doc!, 'read_document').text;
    expect(read).toContain('ASESOR');
    expect(read).toContain('CLIENTE');
    expect(read).toContain('{{cliente}}');
    expect(error(numbered(1), 'insert_signatures', { after_paragraph: 1, titles: [] })).toBeTruthy();
  });

  it('puts in a text box, whose text is read and changed with its area', () => {
    const { doc } = apply(numbered(2), 'insert_text_box', { text: 'En la caja\nSegunda línea', at_paragraph: 2 });
    expect(drawnTextBoxes(doc!)).toHaveLength(1);
    expect(runTool(doc!, 'get_overview').text).toContain('1. En la caja / Segunda línea');
    const changed = apply(doc!, 'replace_text', { area: 'textbox', area_textbox: 1, find: 'Segunda', replace: 'Otra' }).doc!;
    expect(runTool(changed, 'read_document', { area: 'textbox', area_textbox: 1 }).text).toContain('Otra línea');
    expect(error(doc!, 'read_document', { area: 'textbox', area_textbox: 2 })).toContain('from 1 to 1');
  });
});

describe('what each tool says of itself', () => {
  it('has a title, and says whether doing it again changes more', () => {
    expect(new Set(TOOLS.map((tool) => tool.title)).size).toBe(TOOLS.length);
    for (const tool of TOOLS) {
      expect(tool.title.length, tool.name).toBeGreaterThan(3);
      if (tool.idempotent) expect(tool.writes, tool.name).toBe(true);
    }
    expect(TOOLS.find((tool) => tool.name === 'insert_paragraphs')!.idempotent).toBeFalsy();
    expect(TOOLS.find((tool) => tool.name === 'set_style')!.idempotent).toBe(true);
  });
});
