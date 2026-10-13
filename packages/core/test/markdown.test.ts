import { describe, expect, it } from 'vitest';
import { type Paragraph, createDoc, exportMarkdown, insertTable, insertText, setParagraphStyle, shiftListLevel, toggleList } from '../src';

const p = (text: string, props: Paragraph['runs'][0]['props'] = {}): Paragraph => ({ props: {}, runs: [{ text, props }] });

describe('Markdown export', () => {
  it('writes headings, paragraphs and emphasis', () => {
    let doc = createDoc([
      p('The title'),
      p('A chapter', { bold: true }),
      { props: {}, runs: [{ text: 'Plain, ', props: {} }, { text: 'bold ', props: { bold: true } }, { text: 'both', props: { bold: true, italic: true } }, { text: ' and ', props: {} }, { text: 'gone', props: { strike: true } }, { text: '.', props: {} }] },
      p(''),
      p('First line\nsecond line\ttabbed\f'),
    ]);
    doc = setParagraphStyle(doc, 0, 0, 'Title');
    doc = { ...setParagraphStyle(doc, 1, 1, 'Heading2'), paragraphs: setParagraphStyle(doc, 1, 1, 'Heading2').paragraphs.map((para, i) => (i === 1 ? { ...para, runs: [{ text: 'A chapter', props: { bold: true } }] } : para)) };
    expect(exportMarkdown(doc)).toBe(
      ['# The title', '## A chapter', 'Plain, **bold** ***both*** and ~~gone~~.', 'First line\\\nsecond line    tabbed'].join('\n\n') + '\n',
    );
  });

  it('keeps as text what Markdown would read as marks', () => {
    const doc = createDoc([p('2 * 3 = 6, a_b, [x] <tag> `code` a|b'), p('# not a heading'), p('- not a list'), p('1. not numbered'), p('> not a quote')]);
    expect(exportMarkdown(doc)).toBe(
      ['2 \\* 3 = 6, a\\_b, \\[x\\] \\<tag\\> \\`code\\` a\\|b', '\\# not a heading', '\\- not a list', '1\\. not numbered', '\\> not a quote'].join('\n\n') + '\n',
    );
  });

  it('writes lists with their levels, items together', () => {
    let doc = createDoc([p('Before'), p('One'), p('Inside'), p('Two'), p('First'), p('Second'), p('After')]);
    doc = toggleList(doc, 1, 3, 'bullet');
    doc = shiftListLevel(doc, 2, 2, 1);
    doc = toggleList(doc, 4, 5, 'number');
    expect(exportMarkdown(doc)).toBe('Before\n\n- One\n    - Inside\n- Two\n1. First\n1. Second\n\nAfter\n');
  });

  it('writes a table with its first row as the header', () => {
    let { doc } = insertTable(createDoc([p('Before'), p('')]), { para: 1, offset: 0 }, 2, 2);
    const cells = doc.paragraphs.map((para, i) => (para.cell ? i : -1)).filter((i) => i >= 0);
    ['Name', 'Value', 'a|b', 'two\nlines'].forEach((text, k) => (doc = insertText(doc, { para: cells[k], offset: 0 }, text).doc));
    const md = exportMarkdown(doc);
    expect(md).toContain('| Name | Value |\n| --- | --- |\n| a\\|b | two<br>lines |');
    expect(md.startsWith('Before\n\n| Name')).toBe(true);
  });

  it('gives nothing for an empty document', () => {
    expect(exportMarkdown(createDoc())).toBe('');
  });
});
