import { describe, expect, it } from 'vitest';
import { type Paragraph, ANCHOR_CHAR, createDoc, docText, findAll, replaceAll, replaceRange, resolveRun } from '../src';

const doc = () =>
  createDoc([
    { props: {}, runs: [{ text: 'El cliente y la ', props: {} }, { text: 'Clienta', props: { bold: true } }, { text: ' del cliente.', props: {} }] },
    { props: {}, runs: [{ text: 'cli', props: {} }, { text: ANCHOR_CHAR, props: { object: '<w:bookmarkStart/>', anchor: true } }, { text: 'entes', props: { italic: true } }] },
  ] as Paragraph[]);

describe('find and replace', () => {
  it('finds every match, minding case and whole words when asked', () => {
    const at = (query: string, options = {}) => findAll(doc(), query, options).map((r) => [r.from.para, r.from.offset, r.to.offset]);
    expect(at('client')).toEqual([[0, 3, 9], [0, 16, 22], [0, 28, 34], [1, 0, 7]]);
    expect(at('Client', { matchCase: true })).toEqual([[0, 16, 22]]);
    expect(at('cliente', { wholeWord: true })).toEqual([[0, 3, 10], [0, 28, 35]]);
    expect(at('')).toEqual([]);
    expect(at('zzz')).toEqual([]);
  });

  it('replaces a match in the formatting of what was there', () => {
    const d = doc();
    const [, second] = findAll(d, 'client');
    const out = replaceRange(d, second, 'Compradora');
    expect(docText(out.doc).split('\n')[0]).toBe('El cliente y la Compradoraa del cliente.');
    expect(out.pos).toEqual({ para: 0, offset: 26 });
    const run = out.doc.paragraphs[0].runs.find((r) => r.text.startsWith('Compradora'))!;
    expect(resolveRun(run.props).bold).toBe(true);
  });

  it('replaces them all, also across a mark that takes no room, and can delete', () => {
    const out = replaceAll(doc(), 'cliente', 'socio', { wholeWord: true });
    expect(out.count).toBe(2);
    expect(docText(out.doc).split('\n')[0]).toBe('El socio y la Clienta del socio.');
    const gone = replaceAll(doc(), 'clientes', '');
    expect(gone.count).toBe(1);
    expect(gone.doc.paragraphs[1].runs.filter((r) => !r.props.object).map((r) => r.text).join('')).toBe('');
    expect(replaceAll(doc(), 'nada', 'x').doc).toEqual(doc());
  });
});
