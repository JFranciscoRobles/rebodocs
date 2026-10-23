import { describe, expect, it } from 'vitest';
import { type Doc, type Paragraph, createDoc, docText, exportDocx, fillVariables, findBlocks, importDocx, insertTable, insertText, isPresent, variableNames } from '../src/internal';

const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });

describe('blocks of a template', () => {
  const letter = () =>
    createDoc([
      p('Dear {{client}}{{#vip}}, our valued member{{/vip}}.'),
      p('{{#items}}'),
      p('- {{items.name}}: {{items.price | currency}}'),
      p('{{/items}}'),
      p('{{^items}}'),
      p('Nothing ordered.'),
      p('{{/items}}'),
      p('Tags: {{#tags}}[{{tags}}]{{/tags}}'),
    ]);

  it('says what blocks there are, by where their marks are', () => {
    expect(findBlocks(letter())).toEqual([
      { name: 'vip', inverted: false, kind: 'text' },
      { name: 'items', inverted: false, kind: 'paragraphs' },
      { name: 'items', inverted: true, kind: 'paragraphs' },
      { name: 'tags', inverted: false, kind: 'text' },
    ]);
    // The marks are not variables; what is inside them is.
    expect(variableNames(letter())).toEqual(['client', 'items.name', 'items.price', 'tags']);
  });

  it('repeats paragraphs and text for each item of a list, and keeps or takes away what a condition holds', () => {
    const doc = letter();
    const filled = fillVariables(doc, {
      client: 'Ana',
      vip: true,
      items: [
        { name: 'Desk', price: 250 },
        { name: 'Chair', price: 90.5 },
      ],
      tags: ['a', 'b'],
    });
    expect(docText(filled).split('\n')).toEqual(['Dear Ana, our valued member.', '- Desk: $250.00', '- Chair: $90.50', 'Tags: [a][b]']);
    // A block without a value stays as it is, to be filled later.
    expect(docText(fillVariables(doc, { client: 'Ana', vip: 'false', items: [] })).split('\n')).toEqual(['Dear Ana.', 'Nothing ordered.', 'Tags: {{#tags}}[{{tags}}]{{/tags}}']);
  });

  it('repeats the row of a table its marks are in, and writes it to a DOCX Word reads back', () => {
    let doc: Doc = createDoc([p('Invoice'), p('')]);
    doc = insertTable(doc, { para: 1, offset: 0 }, 3, 2).doc;
    const cells = doc.paragraphs.flatMap((q, i) => (q.cell ? [i] : []));
    ['Item', 'Price', '{{#lines}}{{lines.item}}', '{{lines.price | currency}}{{/lines}}', 'Total', '{{total | currency}}'].forEach(
      (text, k) => (doc = insertText(doc, { para: cells[k], offset: 0 }, text).doc),
    );
    expect(findBlocks(doc)).toEqual([{ name: 'lines', inverted: false, kind: 'row' }]);
    const filled = fillVariables(doc, {
      lines: [
        { item: 'Desk', price: 250 },
        { item: 'Chair', price: 90 },
      ],
      total: 340,
    });
    expect(filled.tables![0].rows).toHaveLength(4);
    expect(docText(importDocx(exportDocx(filled))).split('\n')).toEqual(['Invoice', 'Item', 'Price', 'Desk', '$250.00', 'Chair', '$90.00', 'Total', '$340.00', '']);
    // No items, no row.
    expect(fillVariables(doc, { lines: [], total: 0 }).tables![0].rows).toHaveLength(2);
  });

  it('writes nested blocks with the item of each, and fields of nested values by their dotted names', () => {
    const doc = createDoc([p('{{#orders}}'), p('Order {{orders.number}} for {{client.name}}: {{#orders.lines}}{{orders.lines.item}} {{/orders.lines}}'), p('{{/orders}}')]);
    const filled = fillVariables(doc, {
      client: { name: 'Ana' },
      orders: [
        { number: 1, lines: [{ item: 'a' }, { item: 'b' }] },
        { number: 2, lines: [] },
      ],
    });
    expect(docText(filled).split('\n')).toEqual(['Order 1 for Ana: a b ', 'Order 2 for Ana: ']);
  });

  it('counts as not there what is empty, false, 0 or a list without items', () => {
    expect([true, 'yes', 1, ['x'], {}].map(isPresent)).toEqual([true, true, true, true, true]);
    expect([false, '', ' false ', '0', 0, [], null, undefined].map(isPresent)).toEqual([false, false, false, false, false, false, false, false]);
  });
});

describe('what a server is to look out for', () => {
  it('refuses a DOCX that says it takes more unpacked than allowed, before unpacking it', () => {
    const docx = exportDocx(createDoc([p('x'.repeat(5000))]));
    expect(() => importDocx(docx, { maxSize: 1000 })).toThrow(/too large unpacked/);
    expect(docText(importDocx(docx))).toHaveLength(5000);
  });
});
