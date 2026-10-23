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
  insertEndnote,
  insertFootnote,
  insertImage,
  insertText,
  docImage,
  paragraphText,
  restoreVersion,
  trackEdit,
  insertTextBox,
  setParagraphProps,
  setColumns,
  setOwnStories,
  setSectionPage,
  splitParagraph,
  withStory,
} from '@rebodocs/core/internal';
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
      for (const run of p.runs)
        for (const ch of run.text)
          chars.push(
            `${ch}${JSON.stringify(
              Object.entries(run.props)
                .filter(([, v]) => v !== undefined)
                .sort(),
            )}`,
          );
      return {
        id: p.id,
        props: Object.entries(p.props)
          .filter(([, v]) => v !== undefined)
          .sort(),
        cell: p.cell,
        section: p.section,
        text: chars.join(''),
      };
    });
  return {
    body: paragraphs(doc.paragraphs),
    tables: doc.tables,
    header: doc.header && paragraphs(doc.header.paragraphs),
    page: doc.page,
    columns: doc.columns,
    notes: doc.notes,
    footnotes: doc.footnotes?.map((note) => [note.id, paragraphs(note.paragraphs)]),
    endnotes: doc.endnotes?.map((note) => [note.id, paragraphs(note.paragraphs)]),
    textBoxes: doc.textBoxes?.map((box) => [box.id, paragraphs(box.paragraphs)]),
  };
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

/** The document with a section ending at paragraph `at`, as it was before the change. */
const sectioned = (doc: Doc, at = 0): Doc => ({ ...doc, paragraphs: doc.paragraphs.map((p, i) => (i === at ? { ...p, section: { page: doc.page, start: 'continuous' as const } } : p)) });

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
    ['columns, in sections of their own', (doc) => setColumns(doc, { from: { para: 1, offset: 0 }, to: { para: 1, offset: 2 } }, { count: 2, space: 36 })],
    ['the columns of the last section', (doc) => setColumns(doc, { from: { para: 2, offset: 0 }, to: { para: 2, offset: 0 } }, { count: 3, space: 20 })],
    ['the page and the header of a section', (doc) => withStory(setOwnStories(setSectionPage(sectioned(doc), 0, { width: 800 }), 0, true), 'header@0', { paragraphs: [createParagraph('propio')] })],
    ['a new paragraph in one that ends a section', (doc) => splitParagraph(sectioned(doc), { para: 0, offset: 3 }).doc],
    ['a note at the foot of the page', (doc) => insertFootnote(doc, { para: 1, offset: 3 }, 'al pie').doc],
    ['a note at the end', (doc) => insertEndnote(doc, { para: 1, offset: 3 }, 'al final').doc],
    [
      'the text of a note at the end',
      (doc) => {
        const made = stampIds(insertEndnote(doc, { para: 1, offset: 3 }, 'al final').doc);
        return withStory(made, 'endnote:1', { paragraphs: [...made.endnotes![0].paragraphs, createParagraph('y más')] });
      },
    ],
    [
      'the text of a note',
      (doc) => {
        const made = stampIds(insertFootnote(doc, { para: 1, offset: 3 }, 'al pie').doc);
        return withStory(made, 'footnote:1', { paragraphs: [...made.footnotes![0].paragraphs, createParagraph('y más')] });
      },
    ],
    [
      'a text box, and its text',
      (doc) => {
        const made = stampIds(insertTextBox(doc, { para: 1, offset: 2 }, { text: 'en el cuadro' }).doc);
        const box = made.textBoxes![0];
        return withStory(made, `textbox:${box.id}`, { paragraphs: [...box.paragraphs, createParagraph('y otra línea')] });
      },
    ],
    [
      'tracked changes, and tracking them',
      (doc) => ({
        ...trackEdit(doc, deleteRange(insertText(doc, { para: 0, offset: 2 }, 'XY').doc, { from: { para: 1, offset: 6 }, to: { para: 2, offset: 0 } }), { author: 'Ana', date: '2026-10-18T10:00:00Z' })
          .doc,
        trackRevisions: true,
      }),
    ],
    [
      'where the notes at the end go, and how a section numbers them',
      (doc) => ({ ...sectioned(doc, 1), endnotesAt: 'sections', endnoteNumbering: { format: 'decimal', start: 3, restart: 'section' } }),
    ],
    ['joining one that ends a section to the one before', (doc) => deleteRange(sectioned(doc, 1), { from: { para: 0, offset: 7 }, to: { para: 1, offset: 0 } })],
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

  it('sends going back to a version as the changes it makes, its pictures with them', () => {
    const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    // The version is a file of its own, with the picture in its package.
    const version = importDocx(
      exportDocx(insertImage(createDoc([createParagraph('primero'), createParagraph('con foto ')]), { para: 1, offset: 9 }, { bytes: PNG, type: 'image/png', width: 8, height: 8 }).doc),
    );
    const doc = stampIds(importDocx(exportDocx(createDoc([createParagraph('primero'), createParagraph('segundo'), createParagraph('tercero')]))));
    const made = edit(doc, 'n', (d) => restoreVersion(d, version));
    // The paragraph that is the same is not sent again.
    expect(made.ops.some((op) => 'id' in op && op.id === doc.paragraphs[0].id)).toBe(false);
    const theirs = apply(doc, made.ops);
    expect(texts(theirs)).toEqual(texts(version));
    const picture = theirs.paragraphs[1].runs.find((run) => run.props.object)!;
    expect(docImage(theirs, picture.props.object!)?.bytes).toEqual(PNG);
  });

  it('writes a keystroke as one small change', () => {
    const doc = base('primero', 'segundo');
    const { ops } = edit(doc, 'n', (d) => insertText(d, { para: 1, offset: 3 }, 'X').doc);
    expect(ops).toEqual([{ t: 'splice', id: 'p1', at: 3, remove: 0, insert: [{ text: 'X', props: {} }] }]);
  });

  it('writes Enter as a cut, and Backspace at the start of a paragraph as a join', () => {
    const doc = base('primero', 'segundo');
    const cut = edit(doc, 'n', (d) => splitParagraph(d, { para: 0, offset: 3 }).doc);
    expect(cut.ops).toEqual([{ t: 'split', id: 'p0', at: 3, newId: 'n0', props: {} }]);
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
    expect(
      apply(doc, [
        { t: 'splice', id: 'nadie', at: 0, remove: 0, insert: [{ text: 'x', props: {} }] },
        { t: 'delete', id: 'nadie', prev: null },
      ]),
    ).toBe(doc);
  });
});

describe('two people at once', () => {
  const same = (doc: Doc, a: (doc: Doc) => Doc, b: (doc: Doc) => Doc) => {
    const { first, second } = meet(doc, a, b);
    expect(shape(second)).toEqual(shape(first));
    return first;
  };

  it('sends what was typed or deleted before a word that starts the same at the start of a word', () => {
    // " always" typed before " add" also reads as "lways a" put in after "Late payments a".
    const typed = edit(base('Late payments add a fee.'), 'b', (doc) => insertText(doc, { para: 0, offset: 13 }, ' always').doc);
    expect(typed.ops).toMatchObject([{ t: 'splice', at: 14, remove: 0, insert: [{ text: 'always ' }] }]);
    const deleted = edit(base('Late payments always add a fee.'), 'b', (doc) => deleteRange(doc, { from: { para: 0, offset: 13 }, to: { para: 0, offset: 20 } }));
    expect(deleted.ops).toMatchObject([{ t: 'splice', at: 14, remove: 7, insert: [] }]);
    // Bold made at the same time over "Late payments add" stays on whole words.
    const doc = same(
      base('Late payments add a fee.'),
      (d) => applyRunProps(d, { from: { para: 0, offset: 0 }, to: { para: 0, offset: 17 } }, { bold: true }),
      (d) => insertText(d, { para: 0, offset: 13 }, ' always').doc,
    );
    expect(doc.paragraphs[0].runs.filter((run) => run.props.bold).map((run) => run.text)).toEqual(['Late payments ', 'add']);
  });

  it('leaves where it is what was typed at the start of a word already', () => {
    const typed = edit(base('Late payments add a fee.'), 'b', (doc) => insertText(doc, { para: 0, offset: 20 }, 'small ').doc);
    expect(typed.ops).toMatchObject([{ t: 'splice', at: 20, remove: 0, insert: [{ text: 'small ' }] }]);
  });

  it('keeps what both typed in the same paragraph', () => {
    const doc = base('hola mundo');
    const out = same(
      doc,
      (d) => insertText(d, { para: 0, offset: 0 }, 'A ').doc,
      (d) => insertText(d, { para: 0, offset: 10 }, ' B').doc,
    );
    expect(texts(out)).toEqual(['A hola mundo B']);
  });

  it('keeps the page given to a section when someone cuts the paragraph that ends it', () => {
    const doc = sectioned(base('primero', 'segundo'));
    const out = same(
      doc,
      (d) => setSectionPage(d, 0, { width: 800 }),
      (d) => splitParagraph(d, { para: 0, offset: 3 }).doc,
    );
    expect(texts(out)).toEqual(['pri', 'mero', 'segundo']);
    expect(out.paragraphs.map((p) => p.section?.page.width)).toEqual([undefined, 800, undefined]);
  });

  it('keeps what both wrote in a note at the foot of the page', () => {
    const doc = stampIds(insertFootnote(base('primero', 'segundo'), { para: 0, offset: 3 }, 'nota').doc);
    const note = (d: Doc) => d.footnotes![0].paragraphs.map(paragraphText).join('|');
    const out = same(
      doc,
      (d) => withStory(d, 'footnote:1', { paragraphs: [insertText({ ...d, paragraphs: d.footnotes![0].paragraphs }, { para: 0, offset: 1 }, 'A ').doc.paragraphs[0]] }),
      (d) => withStory(d, 'footnote:1', { paragraphs: [insertText({ ...d, paragraphs: d.footnotes![0].paragraphs }, { para: 0, offset: 6 }, ' B').doc.paragraphs[0]] }),
    );
    expect(note(out)).toBe('\u2060A  nota B');
  });

  it('keeps what both wrote in a note at the end', () => {
    const doc = stampIds(insertEndnote(base('primero', 'segundo'), { para: 0, offset: 3 }, 'nota').doc);
    const note = (d: Doc) => d.endnotes![0].paragraphs.map(paragraphText).join('|');
    const out = same(
      doc,
      (d) => withStory(d, 'endnote:1', { paragraphs: [insertText({ ...d, paragraphs: d.endnotes![0].paragraphs }, { para: 0, offset: 1 }, 'A ').doc.paragraphs[0]] }),
      (d) => withStory(d, 'endnote:1', { paragraphs: [insertText({ ...d, paragraphs: d.endnotes![0].paragraphs }, { para: 0, offset: 6 }, ' B').doc.paragraphs[0]] }),
    );
    expect(note(out)).toBe('\u2060A  nota B');
  });

  it('puts what both typed at the same place one after the other', () => {
    const doc = base('ab');
    const out = same(
      doc,
      (d) => insertText(d, { para: 0, offset: 1 }, 'X').doc,
      (d) => insertText(d, { para: 0, offset: 1 }, 'Y').doc,
    );
    expect(texts(out)).toEqual(['aXYb']);
  });

  it('keeps what one typed inside what the other deleted', () => {
    const doc = base('abcdef');
    const out = same(
      doc,
      (d) => insertText(d, { para: 0, offset: 3 }, 'X').doc,
      (d) => deleteRange(d, { from: { para: 0, offset: 1 }, to: { para: 0, offset: 5 } }),
    );
    expect(texts(out)).toEqual(['aXf']);
  });

  it('follows text into the paragraph Enter moved it to', () => {
    const doc = base('hola mundo');
    const out = same(
      doc,
      (d) => splitParagraph(d, { para: 0, offset: 5 }).doc,
      (d) => insertText(d, { para: 0, offset: 10 }, '!').doc,
    );
    expect(texts(out)).toEqual(['hola ', 'mundo!']);
  });

  it('follows text into the paragraph it was joined to', () => {
    const doc = base('hola', 'mundo');
    const out = same(
      doc,
      (d) => deleteRange(d, { from: { para: 0, offset: 4 }, to: { para: 1, offset: 0 } }),
      (d) => insertText(d, { para: 1, offset: 5 }, '!').doc,
    );
    expect(texts(out)).toEqual(['holamundo!']);
  });

  it('keeps both paragraphs when both press Enter in the same one', () => {
    const doc = base('abcdef');
    const out = same(
      doc,
      (d) => splitParagraph(d, { para: 0, offset: 2 }).doc,
      (d) => splitParagraph(d, { para: 0, offset: 4 }).doc,
    );
    expect(texts(out)).toEqual(['ab', 'cd', 'ef']);
  });

  it('keeps typing and formatting of different paragraphs apart', () => {
    const doc = base('uno', 'dos', 'tres');
    const out = same(
      doc,
      (d) => setParagraphProps(d, 0, 0, { align: 'center' }),
      (d) => deleteRange(d, { from: { para: 1, offset: 0 }, to: { para: 2, offset: 0 } }),
    );
    expect(texts(out)).toEqual(['uno', 'tres']);
    expect(out.paragraphs[0].props.align).toBe('center');
  });

  it('drops typing in a paragraph the other deleted, and nothing else', () => {
    const doc = base('uno', 'dos', 'tres');
    const out = same(
      doc,
      (d) => deleteRange(d, { from: { para: 0, offset: 3 }, to: { para: 2, offset: 0 } }),
      (d) => insertText(d, { para: 2, offset: 4 }, '!').doc,
    );
    expect(texts(out)).toEqual(['unotres!']);
  });

  describe('a paragraph one deletes while the other writes in it', () => {
    const doc = base('uno', 'dos', 'tres');
    const gone = (d: Doc) => deleteRange(d, { from: { para: 0, offset: 3 }, to: { para: 1, offset: 3 } });
    /** Both ways round: whichever got to the server first, everybody ends with the same. */
    /** Both ways round: whichever got to the server first, everybody ends with the same text. */
    const both = (b: (doc: Doc) => Doc) => {
      const one = same(doc, gone, b);
      expect(texts(same(doc, b, gone))).toEqual(texts(one));
      return one;
    };
    /** What someone does in steps, each sent as it is made, as the editor sends them. */
    const steps = (start: Doc, tag: string, ...changes: ((doc: Doc) => Doc)[]) => {
      let now = start;
      const ops: Op[] = [];
      for (const change of changes) {
        const made = edit(now, `${tag}${ops.length}.`, change);
        now = made.doc;
        ops.push(...made.ops);
      }
      return { doc: now, ops };
    };

    it('keeps what was written, in the paragraph it was written in', () => {
      const out = both((d) => insertText(d, { para: 1, offset: 2 }, 'XX').doc);
      expect(texts(out)).toEqual(['uno', 'XX', 'tres']);
      expect(out.paragraphs[1].id).toBe(doc.paragraphs[1].id);
    });

    it('keeps everything written in it at once, in its order', () => {
      const out = both((d) => insertText(insertText(d, { para: 1, offset: 0 }, 'A').doc, { para: 1, offset: 4 }, 'B').doc);
      expect(texts(out)).toEqual(['uno', 'AB', 'tres']);
    });

    it('lets the one writing go on writing there', () => {
      const { first: deleted } = meet(doc, gone, (d) => insertText(d, { para: 1, offset: 3 }, 'X').doc);
      const more = same(
        deleted,
        (d) => d,
        (d) => insertText(d, { para: 1, offset: 1 }, 'YZ').doc,
      );
      expect(texts(more)).toEqual(['uno', 'XYZ', 'tres']);
    });

    it('keeps a paragraph made with Enter and written in, and not what it had', () => {
      const one = edit(doc, 'a', gone);
      const two = steps(
        doc,
        'b',
        (d) => splitParagraph(d, { para: 1, offset: 1 }).doc,
        (d) => insertText(d, { para: 2, offset: 0 }, 'nuevo ').doc,
      );
      for (const [x, y] of [
        [one, two],
        [two, one],
      ]) {
        const { second, first } = transform(y.ops, x.ops);
        expect(shape(apply(y.doc, first))).toEqual(shape(apply(x.doc, second)));
        expect(texts(apply(x.doc, second))).toEqual(['uno', 'nuevo ', 'tres']);
      }
    });

    it('does not bring it back for formatting given to its text', () => {
      const out = both((d) => applyRunProps(d, { from: { para: 1, offset: 0 }, to: { para: 1, offset: 3 } }, { bold: true }));
      expect(texts(out)).toEqual(['uno', 'tres']);
    });

    it('does not bring it back for a cut with nothing written', () => {
      expect(texts(both((d) => splitParagraph(d, { para: 1, offset: 1 }).doc))).toEqual(['uno', 'tres']);
    });

    it('keeps the next paragraph, brought up to the end of it', () => {
      expect(texts(both((d) => deleteRange(d, { from: { para: 1, offset: 3 }, to: { para: 2, offset: 0 } })))).toEqual(['uno', 'tres']);
    });

    it('takes its text out of the paragraph before, when it was brought up to it', () => {
      expect(texts(both((d) => deleteRange(d, { from: { para: 0, offset: 3 }, to: { para: 1, offset: 0 } })))).toEqual(['uno', 'tres']);
    });

    it('drops what was written, as before, when the deletion does not say what it took out', () => {
      const one = edit(doc, 'a', gone);
      const two = edit(doc, 'b', (d) => insertText(d, { para: 1, offset: 2 }, 'XX').doc);
      const old = one.ops.map((op) => (op.t === 'delete' ? { ...op, para: undefined } : op));
      const { second, first } = transform(two.ops, old);
      expect(texts(apply(one.doc, second))).toEqual(['uno', 'tres']);
      expect(shape(apply(two.doc, first))).toEqual(shape(apply(one.doc, second)));
    });
  });

  it('gives two tables made at once a place each', () => {
    // Whoever made the second one sees it move on: their document is made again from everybody's, not patched.
    const doc = base('uno', 'dos');
    const out = meet(
      doc,
      (d) => insertTable(d, { para: 0, offset: 3 }, 1, 2).doc,
      (d) => insertTable(d, { para: 1, offset: 3 }, 2, 1).doc,
    ).first;
    expect(out.tables).toHaveLength(2);
    expect(out.tables![0].rows).toHaveLength(1);
    expect(out.tables![1].rows).toHaveLength(2);
    expect(out.paragraphs.filter((p) => p.cell?.table === 0)).toHaveLength(2);
    expect(out.paragraphs.filter((p) => p.cell?.table === 1)).toHaveLength(2);
  });

  it('leaves a table whole when one adds a row and the other types in a cell', () => {
    const start = edit(base('uno'), 's', (d) => insertTable(d, { para: 0, offset: 3 }, 2, 2).doc).doc;
    const cell = start.paragraphs.findIndex((p) => p.cell);
    const out = same(
      start,
      (d) => insertRow(d, cell, true),
      (d) => insertText(d, { para: cell, offset: 0 }, 'celda').doc,
    );
    expect(out.tables![0].rows).toHaveLength(3);
    expect(out.paragraphs.filter((p) => p.cell)).toHaveLength(6);
    expect(paragraphText(out.paragraphs[cell])).toBe('celda');
  });

  it('mends a table two people gave different shapes', () => {
    const start = edit(base('uno'), 's', (d) => insertTable(d, { para: 0, offset: 3 }, 2, 2).doc).doc;
    const cell = start.paragraphs.findIndex((p) => p.cell);
    const { first } = meet(
      start,
      (d) => insertRow(d, cell, true),
      (d) => insertRow(d, cell + 2, true),
    );
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
        {
          columns: [100, 100],
          fixed: true,
          align: 'left',
          indent: 0,
          padTop: 0,
          padRight: 0,
          padBottom: 0,
          padLeft: 0,
          rows: [
            {
              id: 0,
              before: 0,
              height: 0,
              cells: [
                { id: 0, span: 1, borders: true },
                { id: 1, span: 1, borders: true },
              ],
            },
          ],
        },
        {
          columns: [50],
          fixed: true,
          align: 'left',
          indent: 0,
          padTop: 0,
          padRight: 0,
          padBottom: 0,
          padLeft: 0,
          parent: cell(0),
          rows: [{ id: 0, before: 0, height: 0, cells: [{ id: 0, span: 1, borders: true }] }],
        },
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
