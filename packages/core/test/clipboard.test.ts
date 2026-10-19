import { describe, expect, it } from 'vitest';
import {
  type Clip,
  type Paragraph,
  clipHtml,
  clipOf,
  clipText,
  createDoc,
  insertClip,
  linkHref,
  listKindAt,
  paragraphText,
  parseClip,
  serializeClip,
  setParagraphStyle,
  toggleList,
} from '../src';

const p = (text: string, props: Paragraph['runs'][number]['props'] = {}): Paragraph => ({ props: {}, runs: [{ text, props }] });
const pos = (para: number, offset: number) => ({ para, offset });

describe('copying and pasting with the formatting', () => {
  it('takes the text of a range with its formatting, and leaves behind what only means something in the document', () => {
    const doc = createDoc([{ props: { align: 'center' }, runs: [{ text: 'Hola ', props: { opaque: '<w:x/>' } }, { text: 'mundo', props: { bold: true, revision: 'insert' } }] }, p('Adiós')]);
    const clip = clipOf(doc, { from: pos(0, 2), to: pos(1, 3) });
    expect(clipText(clip)).toBe('la mundo\nAdi');
    expect(clip.paragraphs[0].props).toEqual({ align: 'center' });
    // The size and the font go along even when they are the document's own: elsewhere they are not.
    expect(clip.paragraphs[0].runs).toEqual([
      { text: 'la ', props: { fontSize: 11, fontFamily: 'Arial' } },
      { text: 'mundo', props: { bold: true, fontSize: 11, fontFamily: 'Arial' } },
    ]);
  });

  it('pastes a piece of a paragraph into the paragraph it lands in, on top of the formatting there', () => {
    const doc = createDoc([{ props: { align: 'right' }, runs: [{ text: 'ab', props: { fontFamily: 'Arial', fontSize: 14 } }] }]);
    const clip: Clip = { paragraphs: [{ runs: [{ text: 'X', props: { bold: true, color: 'FF0000' } }], props: { align: 'center' } }] };
    const result = insertClip(doc, pos(0, 1), clip);
    const para = result.doc.paragraphs[0];
    expect(paragraphText(para)).toBe('aXb');
    expect(para.props.align).toBe('right');
    expect(para.runs[1].props).toEqual({ fontFamily: 'Arial', fontSize: 14, bold: true, color: 'FF0000' });
    expect(result.pos).toEqual(pos(0, 2));
  });

  it('pastes whole paragraphs with their own formatting, styles, lists and links', () => {
    const doc = createDoc([p('antes'), p('después')]);
    const clip: Clip = {
      paragraphs: [
        { runs: [{ text: 'Título', props: {} }], props: {}, style: 'heading 1' },
        { runs: [{ text: 'uno', props: {} }], props: {}, list: { id: 1, kind: 'bullet', level: 0 } },
        { runs: [{ text: 'dos', props: {} }], props: {}, list: { id: 1, kind: 'bullet', level: 1 } },
        { runs: [{ text: 'sitio', props: { color: '00FF00' }, href: 'https://ejemplo.com' }], props: { align: 'justify' } },
      ],
    };
    const result = insertClip(doc, pos(1, 0), clip);
    const texts = result.doc.paragraphs.map(paragraphText);
    expect(texts).toEqual(['antes', 'Título', 'uno', 'dos', 'sitiodespués']);
    expect(result.doc.paragraphs[1].props.styleId).toBe('Heading1');
    expect(result.doc.paragraphs[1].runs[0].props.fontSize).toBe(20);
    expect(listKindAt(result.doc, 2)).toBe('bullet');
    expect(result.doc.paragraphs[3].props.numId).toBe(result.doc.paragraphs[2].props.numId);
    expect(result.doc.paragraphs[3].props.listLevel).toBe(1);
    expect(listKindAt(result.doc, 4)).toBeUndefined();
    expect(result.doc.paragraphs[4].props.align).toBe('justify');
    expect(linkHref(result.doc.paragraphs[4].runs[0].props)).toBe('https://ejemplo.com');
    expect(result.pos).toEqual(pos(4, 5));
  });

  it('brings the alignment and the style of a paragraph pasted into an empty one', () => {
    const clip: Clip = { paragraphs: [{ runs: [{ text: 'Centrado', props: {} }], props: { align: 'center' }, style: 'heading 2' }] };
    const empty = insertClip(createDoc([p('a'), p('')]), pos(1, 0), clip).doc.paragraphs[1];
    expect(empty.props.align).toBe('center');
    expect(empty.props.styleId).toBe('Heading2');
    // Into a paragraph with text, it is a piece of text in it.
    const full = insertClip(createDoc([{ props: { align: 'right' }, runs: [{ text: 'ab', props: {} }] }]), pos(0, 1), clip).doc.paragraphs[0];
    expect(full.props.align).toBe('right');
  });

  it('refuses a link that would run something', () => {
    const clip: Clip = { paragraphs: [{ runs: [{ text: 'x', props: {}, href: 'javascript:alert(1)' }], props: {} }] };
    const result = insertClip(createDoc(), pos(0, 0), clip);
    expect(linkHref(result.doc.paragraphs[0].runs[0].props)).toBeUndefined();
  });

  it('comes back whole from its HTML, and writes HTML other programs understand', () => {
    let doc = createDoc([p('Título'), p('uno', { bold: true }), p('dos', { italic: true, fontSize: 13 })]);
    doc = setParagraphStyle(doc, 0, 0, 'Heading1');
    doc = toggleList(doc, 1, 2, 'number');
    const clip = clipOf(doc, { from: pos(0, 0), to: pos(2, 3) });
    const data = serializeClip(clip);
    expect(parseClip(data)).toEqual(clip);
    expect(parseClip('{"no":1}')).toBeUndefined();
    expect(parseClip('no es JSON')).toBeUndefined();
    const html = clipHtml(clip, data);
    expect(html).toContain('<h1');
    expect(html).toContain('<ol');
    expect(html).toContain('font-weight:bold');
    expect(html).toContain('font-size:13pt');
    expect(html).toContain('font-style:italic');
    expect(html).toContain('data-rebodocs="');
    // What was copied pastes as it was: a heading and a numbered list.
    const pasted = insertClip(createDoc(), pos(0, 0), clip).doc;
    expect(pasted.paragraphs.map(paragraphText)).toEqual(['Título', 'uno', 'dos']);
    expect(pasted.paragraphs[0].props.styleId).toBe('Heading1');
    expect(listKindAt(pasted, 1)).toBe('number');
    expect(pasted.paragraphs[2].runs[0].props).toMatchObject({ italic: true, fontSize: 13 });
  });
});
