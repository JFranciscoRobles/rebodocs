import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type Paragraph,
  applyRunProps,
  createDoc,
  createParagraph,
  deleteRange,
  documentXml,
  exportDocx,
  importDocx,
  insertRow,
  insertTable,
  insertText,
  paragraphText,
  setParagraphProps,
  splitParagraph,
  withStory,
} from '@rebodocs/core';
import { type Op, apply, decode, diff, encode, ensureIds, mapAnchor, stampIds, transform } from '../src/changes';

const base = (...texts: string[]): Doc => stampIds(createDoc(texts.map((text) => createParagraph(text))));

function minter(tag: string): () => string {
  let n = 0;
  return () => `${tag}${n++}`;
}

/** A document as it reads, whatever way its runs are cut. */
function shape(doc: Doc): unknown {
  const paragraphs = (list: Paragraph[]) =>
    list.map((p) => {
      const chars: string[] = [];
      for (const run of p.runs) for (const ch of run.text) chars.push(`${ch}${JSON.stringify(Object.entries(run.props).filter(([, v]) => v !== undefined).sort())}`);
      return { id: p.id, props: Object.entries(p.props).filter(([, v]) => v !== undefined).sort(), cell: p.cell, text: chars.join('') };
    });
  return { body: paragraphs(doc.paragraphs), tables: doc.tables, header: doc.header && paragraphs(doc.header.paragraphs), page: doc.page, notes: doc.notes };
}

const texts = (doc: Doc) => doc.paragraphs.map(paragraphText);

/** What a person does to the document they have, as the changes that go to the others. */
function edit(doc: Doc, tag: string, change: (doc: Doc) => Doc): { doc: Doc; ops: Op[] } {
  const next = ensureIds(doc, change(doc), minter(tag));
  return { doc: next, ops: diff(doc, next) };
}

/** Two people change the same document at once; everybody makes the changes of `a` first. Gives what each ends with. */
function meet(doc: Doc, a: (doc: Doc) => Doc, b: (doc: Doc) => Doc): { first: Doc; second: Doc } {
  const one = edit(doc, 'a', a);
  const two = edit(doc, 'b', b);
  const { second, first } = transform(two.ops, one.ops);
  return { first: apply(one.doc, second), second: apply(two.doc, first) };
}

describe('diff and apply', () => {
  const cases: [string, (doc: Doc) => Doc][] = [
    ['typing', (doc) => insertText(doc, { para: 1, offset: 3 }, 'XY').doc],
    ['deleting inside a paragraph', (doc) => deleteRange(doc, { from: { para: 0, offset: 1 }, to: { para: 0, offset: 3 } })],
    ['formatting', (doc) => applyRunProps(doc, { from: { para: 0, offset: 1 }, to: { para: 1, offset: 2 } }, { bold: true })],
    ['a new paragraph', (doc) => splitParagraph(doc, { para: 1, offset: 2 }).doc],
    ['a new paragraph at the end of one', (doc) => splitParagraph(doc, { para: 1, offset: 6 }).doc],
    ['a new paragraph at the start of one', (doc) => splitParagraph(doc, { para: 1, offset: 0 }).doc],
    ['joining two paragraphs', (doc) => deleteRange(doc, { from: { para: 0, offset: 5 }, to: { para: 1, offset: 0 } })],
    ['deleting across three paragraphs', (doc) => deleteRange(doc, { from: { para: 0, offset: 2 }, to: { para: 2, offset: 3 } })],
    ['paragraph formatting', (doc) => setParagraphProps(doc, 0, 1, { align: 'center' })],
    ['a table', (doc) => insertTable(doc, { para: 1, offset: 3 }, 2, 2).doc],
    ['the page', (doc) => ({ ...doc, page: { ...doc.page, marginLeft: 40 } })],
    ['a header', (doc) => withStory(doc, 'header', { paragraphs: [createParagraph('arriba')] })],
  ];
  for (const [name, change] of cases) {
    it(`leads to the same document: ${name}`, () => {
      const doc = base('primero', 'segundo', 'tercero');
      const made = edit(doc, 'n', change);
      expect(shape(apply(doc, made.ops))).toEqual(shape(made.doc));
      // And back: what undoing sends.
      expect(shape(apply(made.doc, diff(made.doc, doc)))).toEqual({ ...(shape(doc) as object), tables: made.doc.tables });
    });
  }

  it('writes a keystroke as one small change', () => {
    const doc = base('primero', 'segundo');
    const { ops } = edit(doc, 'n', (d) => insertText(d, { para: 1, offset: 3 }, 'X').doc);
    expect(ops).toEqual([{ t: 'splice', id: 'p1', at: 3, remove: 0, insert: [{ text: 'X', props: {} }] }]);
  });

  it('writes Enter as a cut, and Backspace at the start of a paragraph as a join', () => {
    const doc = base('primero', 'segundo');
    const cut = edit(doc, 'n', (d) => splitParagraph(d, { para: 0, offset: 3 }).doc);
    expect(cut.ops).toEqual([{ t: 'split', id: 'p0', at: 3, newId: 'n0' }]);
    const joined = edit(doc, 'n', (d) => deleteRange(d, { from: { para: 0, offset: 7 }, to: { para: 1, offset: 0 } }));
    expect(joined.ops).toEqual([{ t: 'join', id: 'p0', next: 'p1', at: 7 }]);
  });

  it('leaves the paragraphs nobody touched the very objects they were', () => {
    const doc = base('primero', 'segundo', 'tercero');
    const { ops } = edit(doc, 'n', (d) => insertText(d, { para: 1, offset: 0 }, 'X').doc);
    const made = apply(doc, ops);
    expect(made.paragraphs[0]).toBe(doc.paragraphs[0]);
    expect(made.paragraphs[2]).toBe(doc.paragraphs[2]);
  });

  it('leaves a file that was read written back as it was, ids and all', () => {
    const file = exportDocx(createDoc([createParagraph('uno', { bold: true }), createParagraph('dos'), createParagraph('tres')]));
    const plain = importDocx(file);
    const doc = stampIds(importDocx(file));
    expect(doc.paragraphs.map((p) => p.id)).toEqual(['p0', 'p1', 'p2']);
    // The paragraphs are still the ones the file was read into: what marks them as untouched.
    expect(doc.paragraphs[1]).toBe(doc.source!.slots[doc.paragraphs[1].origin!].paragraph);
    expect(documentXml(doc)).toBe(documentXml(plain));
    // And after a change to one of them, the others are written from the file as before.
    const { ops } = edit(doc, 'n', (d) => insertText(d, { para: 0, offset: 3 }, '!').doc);
    const made = apply(doc, ops);
    expect(made.paragraphs[1]).toBe(doc.paragraphs[1]);
    expect(documentXml(made)).toBe(documentXml(insertText(plain, { para: 0, offset: 3 }, '!').doc));
  });

  it('survives the wire with pictures and lists in it', () => {
    const ops: Op[] = [
      { t: 'media', key: 'k', value: { bytes: new Uint8Array([1, 2, 250]), type: 'image/png' } },
      { t: 'num', kind: 'list', id: 3, value: { abstractId: 1, starts: new Map([[0, 4]]), levels: new Map() } },
    ];
    expect(decode(encode(ops))).toEqual(ops);
  });

  it('does nothing with a change about a paragraph that is gone', () => {
    const doc = base('uno');
    expect(apply(doc, [{ t: 'splice', id: 'nadie', at: 0, remove: 0, insert: [{ text: 'x', props: {} }] }, { t: 'delete', id: 'nadie', prev: null }])).toBe(doc);
  });
});

describe('two people at once', () => {
  const same = (doc: Doc, a: (doc: Doc) => Doc, b: (doc: Doc) => Doc) => {
    const { first, second } = meet(doc, a, b);
    expect(shape(second)).toEqual(shape(first));
    return first;
  };

  it('keeps what both typed in the same paragraph', () => {
    const doc = base('hola mundo');
    const out = same(doc, (d) => insertText(d, { para: 0, offset: 0 }, 'A ').doc, (d) => insertText(d, { para: 0, offset: 10 }, ' B').doc);
    expect(texts(out)).toEqual(['A hola mundo B']);
  });

  it('puts what both typed at the same place one after the other', () => {
    const doc = base('ab');
    const out = same(doc, (d) => insertText(d, { para: 0, offset: 1 }, 'X').doc, (d) => insertText(d, { para: 0, offset: 1 }, 'Y').doc);
    expect(texts(out)).toEqual(['aXYb']);
  });

  it('keeps what one typed inside what the other deleted', () => {
    const doc = base('abcdef');
    const out = same(doc, (d) => insertText(d, { para: 0, offset: 3 }, 'X').doc, (d) => deleteRange(d, { from: { para: 0, offset: 1 }, to: { para: 0, offset: 5 } }));
    expect(texts(out)).toEqual(['aXf']);
  });

  it('follows text into the paragraph Enter moved it to', () => {
    const doc = base('hola mundo');
    const out = same(doc, (d) => splitParagraph(d, { para: 0, offset: 5 }).doc, (d) => insertText(d, { para: 0, offset: 10 }, '!').doc);
    expect(texts(out)).toEqual(['hola ', 'mundo!']);
  });

  it('follows text into the paragraph it was joined to', () => {
    const doc = base('hola', 'mundo');
    const out = same(doc, (d) => deleteRange(d, { from: { para: 0, offset: 4 }, to: { para: 1, offset: 0 } }), (d) => insertText(d, { para: 1, offset: 5 }, '!').doc);
    expect(texts(out)).toEqual(['holamundo!']);
  });

  it('keeps both paragraphs when both press Enter in the same one', () => {
    const doc = base('abcdef');
    const out = same(doc, (d) => splitParagraph(d, { para: 0, offset: 2 }).doc, (d) => splitParagraph(d, { para: 0, offset: 4 }).doc);
    expect(texts(out)).toEqual(['ab', 'cd', 'ef']);
  });

  it('keeps typing and formatting of different paragraphs apart', () => {
    const doc = base('uno', 'dos', 'tres');
    const out = same(doc, (d) => setParagraphProps(d, 0, 0, { align: 'center' }), (d) => deleteRange(d, { from: { para: 1, offset: 0 }, to: { para: 2, offset: 0 } }));
    expect(texts(out)).toEqual(['uno', 'tres']);
    expect(out.paragraphs[0].props.align).toBe('center');
  });

  it('drops typing in a paragraph the other deleted, and nothing else', () => {
    const doc = base('uno', 'dos', 'tres');
    const out = same(doc, (d) => deleteRange(d, { from: { para: 0, offset: 3 }, to: { para: 2, offset: 0 } }), (d) => insertText(d, { para: 2, offset: 4 }, '!').doc);
    expect(texts(out)).toEqual(['unotres!']);
  });

  it('gives two tables made at once a place each', () => {
    // Whoever made the second one sees it move on: their document is made again from everybody's, not patched.
    const doc = base('uno', 'dos');
    const out = meet(doc, (d) => insertTable(d, { para: 0, offset: 3 }, 1, 2).doc, (d) => insertTable(d, { para: 1, offset: 3 }, 2, 1).doc).first;
    expect(out.tables).toHaveLength(2);
    expect(out.tables![0].rows).toHaveLength(1);
    expect(out.tables![1].rows).toHaveLength(2);
    expect(out.paragraphs.filter((p) => p.cell?.table === 0)).toHaveLength(2);
    expect(out.paragraphs.filter((p) => p.cell?.table === 1)).toHaveLength(2);
  });

  it('leaves a table whole when one adds a row and the other types in a cell', () => {
    const start = edit(base('uno'), 's', (d) => insertTable(d, { para: 0, offset: 3 }, 2, 2).doc).doc;
    const cell = start.paragraphs.findIndex((p) => p.cell);
    const out = same(start, (d) => insertRow(d, cell, true), (d) => insertText(d, { para: cell, offset: 0 }, 'celda').doc);
    expect(out.tables![0].rows).toHaveLength(3);
    expect(out.paragraphs.filter((p) => p.cell)).toHaveLength(6);
    expect(paragraphText(out.paragraphs[cell])).toBe('celda');
  });

  it('mends a table two people gave different shapes', () => {
    const start = edit(base('uno'), 's', (d) => insertTable(d, { para: 0, offset: 3 }, 2, 2).doc).doc;
    const cell = start.paragraphs.findIndex((p) => p.cell);
    const { first } = meet(start, (d) => insertRow(d, cell, true), (d) => insertRow(d, cell + 2, true));
    const table = first.tables![0];
    const inCells = first.paragraphs.filter((p) => p.cell);
    // Every cell of the shape that won has a paragraph, in the order of the cells, and no paragraph is in a cell that is not there.
    const order = table.rows.flatMap((row) => row.cells.map((c) => `${row.id}:${c.id}`));
    const found = inCells.map((p) => `${p.cell!.row}:${p.cell!.cell}`);
    expect([...new Set(found)]).toEqual(order);
    expect(found).toEqual([...found].sort((x, y) => order.indexOf(x) - order.indexOf(y)));
  });
});

describe('carets', () => {
  it('move with the text typed before them, and stay for the text typed after', () => {
    const at = { id: 'p0', offset: 5 };
    expect(mapAnchor(at, { t: 'splice', id: 'p0', at: 2, remove: 0, insert: [{ text: 'abc', props: {} }] })).toEqual({ id: 'p0', offset: 8 });
    expect(mapAnchor(at, { t: 'splice', id: 'p0', at: 7, remove: 0, insert: [{ text: 'abc', props: {} }] })).toEqual(at);
    expect(mapAnchor(at, { t: 'splice', id: 'p1', at: 0, remove: 0, insert: [{ text: 'abc', props: {} }] })).toEqual(at);
  });

  it('follow their text into another paragraph', () => {
    expect(mapAnchor({ id: 'p0', offset: 5 }, { t: 'split', id: 'p0', at: 3, newId: 'n' })).toEqual({ id: 'n', offset: 2 });
    expect(mapAnchor({ id: 'p1', offset: 2 }, { t: 'join', id: 'p0', next: 'p1', at: 4 })).toEqual({ id: 'p0', offset: 6 });
  });

  it('keeps a table inside a cell where it is, among the paragraphs of that cell, as changes come and go', () => {
    const cell = (table: number, row = 0, c = 0) => ({ table, row, cell: c });
    const doc = stampIds({
      ...createDoc([
        { ...createParagraph('outer'), cell: cell(0) },
        { ...createParagraph('inner'), cell: cell(1) },
        { ...createParagraph('tail'), cell: cell(0) },
        { ...createParagraph('b'), cell: cell(0, 0, 1) },
        createParagraph('after'),
      ]),
      tables: [
        { columns: [100, 100], fixed: true, align: 'left', indent: 0, padTop: 0, padRight: 0, padBottom: 0, padLeft: 0, rows: [{ id: 0, before: 0, height: 0, cells: [{ id: 0, span: 1, borders: true }, { id: 1, span: 1, borders: true }] }] },
        { columns: [50], fixed: true, align: 'left', indent: 0, padTop: 0, padRight: 0, padBottom: 0, padLeft: 0, parent: cell(0), rows: [{ id: 0, before: 0, height: 0, cells: [{ id: 0, span: 1, borders: true }] }] },
      ],
    });
    const typed = insertText(doc, { para: 1, offset: 5 }, '!').doc;
    const ops = decode<Op[]>(encode(diff(doc, typed)));
    const out = apply(doc, ops);
    expect(texts(out)).toEqual(['outer', 'inner!', 'tail', 'b', 'after']);
    expect(out.paragraphs.map((p) => p.cell?.table)).toEqual([0, 1, 0, 0, undefined]);
    // A row added to the table around it leaves the inner one in its cell.
    const grown = insertRow(doc, 3, true);
    const both = apply(doc, decode<Op[]>(encode(diff(doc, grown))));
    const cells = (d: Doc) => d.paragraphs.map((p) => [paragraphText(p), p.cell && `${p.cell.table}:${p.cell.row}:${p.cell.cell}`]);
    expect(cells(both)).toEqual(cells(grown));
    expect(both.tables).toEqual(grown.tables);
  });
});
