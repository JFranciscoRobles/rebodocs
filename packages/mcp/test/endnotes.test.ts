import { describe, expect, it } from 'vitest';
import { type Doc, type FontSpec, type Paragraph, type TextMeasurer, createDoc, layoutDocument, paragraphText } from '@rebodocs/core/internal';
import { ToolError, runTool } from '../src/tools';

const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });
const apply = (doc: Doc, name: string, args: Record<string, unknown>) => {
  const result = runTool(doc, name, args);
  expect(result.doc, result.text).toBeDefined();
  return { ...result, doc: result.doc! };
};
const measurer: TextMeasurer = {
  width: (text: string, font: FontSpec) => text.length * font.size * 0.5,
  metrics: (font: FontSpec) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

describe('notes at the end, through the tools', () => {
  const doc = () => createDoc([p('El arrendatario pagará la renta.'), p('El plazo es de doce meses.')]);

  it('puts one in, numbered apart from those at the foot of the page, and reads it with the text', () => {
    let d = apply(doc(), 'insert_footnote', { find: 'renta', text: 'Mensual.' }).doc;
    const { doc: withEnd, text } = apply(d, 'insert_endnote', { find: 'meses', text: 'Contados desde la firma.' });
    d = withEnd;
    expect(text).toBe('Note i is at the end of the document; its number is in paragraph 2.');
    const read = runTool(d, 'read_document').text;
    expect(read).toContain('El arrendatario pagará la renta[^1].');
    expect(read).toContain('El plazo es de doce meses[^i].');
    expect(read).toContain('Notes at the end (area "endnote" with area_endnote reads or changes one):');
    expect(read).toContain('[^i] (area_endnote 1)');
    expect(read).toContain('Contados desde la firma.');
    expect(runTool(d, 'get_overview').text).toContain('It has 1 notes at the end, after its text, shown as [^i]');
  });

  it('changes the text of one with area "endnote", and says when there is none', () => {
    const d = apply(doc(), 'insert_endnote', { at_paragraph: 1, text: 'Una nota.' }).doc;
    const changed = apply(d, 'replace_text', { area: 'endnote', area_endnote: 1, find: 'Una nota', replace: 'Otra nota' }).doc;
    expect(paragraphText(changed.endnotes![0].paragraphs[0])).toContain('Otra nota.');
    expect(runTool(changed, 'read_document', { area: 'endnote', area_endnote: 1 }).text).toContain('Otra nota.');
    const none = () => runTool(doc(), 'read_document', { area: 'endnote', area_endnote: 1 });
    expect(none).toThrow(ToolError);
    expect(none).toThrow('no notes at the end');
    expect(() => runTool(d, 'read_document', { area: 'endnote', area_endnote: 2 })).toThrow('from 1 to 1');
  });

  it('says a page of notes at the end alone is the end, not a blank page', () => {
    const page = { width: 120, height: 120, marginTop: 10, marginRight: 10, marginBottom: 10, marginLeft: 10 };
    const lines = Array.from({ length: 10 }, (_, i) => ({ props: { spacingBefore: 0, spacingAfter: 0, lineHeight: 1 }, runs: [{ text: `Linea ${i + 1}`, props: { fontSize: 10 } }] }));
    const d = apply(createDoc(lines, page), 'insert_endnote', { at_paragraph: 10, text: 'Al final.' }).doc;
    const read = runTool(d, 'read_pages', {}, { layoutOf: (x) => layoutDocument(x, measurer) }).text;
    expect(read).toContain('notes at the end only');
    expect(read).not.toContain('is blank');
  });
});
