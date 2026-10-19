import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type Paragraph,
  ADDED_COLOR,
  REMOVED_COLOR,
  applyRunProps,
  compareDocs,
  createDoc,
  describeChange,
  docImage,
  exportDocx,
  importDocx,
  insertImage,
  insertTable,
  insertText,
  paragraphText,
  restoreVersion,
  withStory,
} from '../src';

const para = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });
const doc = (...texts: string[]): Doc => createDoc(texts.map(para));
/** The text of each paragraph, with what was taken out as [-…-] and what was put in as {+…+}. */
const shown = (d: Doc) =>
  d.paragraphs.map((p) =>
    p.runs
      .map((run) => (run.props.color === REMOVED_COLOR && run.props.strike ? `[-${run.text}-]` : run.props.color === ADDED_COLOR && run.props.underline ? `{+${run.text}+}` : run.text))
      .join(''),
  );
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

describe('comparing two versions', () => {
  it('finds the words that changed in a paragraph, and marks them in the later one', () => {
    const { changes, doc: marked, marks } = compareDocs(doc('Título', 'El cliente paga cien pesos.'), doc('Título', 'El cliente paga doscientos pesos al mes.'));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: 'changed', before: 1, after: 1 });
    expect(describeChange(changes[0])).toBe('El cliente paga [-cien-]{+doscientos+} pesos{+ al mes+}.');
    expect(shown(marked)).toEqual(['Título', 'El cliente paga [-cien-]{+doscientos+} pesos{+ al mes+}.']);
    expect(marks).toEqual([{ pos: { para: 1, offset: 16 } }]);
  });

  it('puts what was taken out where it was, and tells a paragraph that changed from one that is new', () => {
    const before = doc('Uno', 'Dos, que se va.', 'Tres', 'Cuatro con una palabra');
    const after = doc('Uno', 'Tres', 'Cuatro con otra palabra', 'Cinco es nuevo del todo');
    const { changes, doc: marked } = compareDocs(before, after);
    expect(changes.map((c) => [c.kind, c.before, c.after])).toEqual([
      ['removed', 1, undefined],
      ['changed', 3, 2],
      ['added', undefined, 3],
    ]);
    expect(shown(marked)).toEqual(['Uno', '[-Dos, que se va.-]', 'Tres', 'Cuatro con [-una-]{+otra+} palabra', '{+Cinco es nuevo del todo+}']);
  });

  it('tells a paragraph whose look changed, and finds nothing between a version and itself', () => {
    const before = doc('Texto normal');
    const after = applyRunProps(before, { from: { para: 0, offset: 0 }, to: { para: 0, offset: 5 } }, { bold: true });
    expect(compareDocs(before, after).changes.map((c) => c.kind)).toEqual(['formatted']);
    const same = compareDocs(before, importDocx(exportDocx(before)));
    expect(same.changes).toEqual([]);
  });

  it('keeps what was taken out of a table in its cell, and finds the changes of a header', () => {
    let before = insertTable(doc('Antes'), { para: 0, offset: 5 }, 1, 2).doc;
    const cell = before.paragraphs.findIndex((p) => p.cell);
    before = insertText(before, { para: cell, offset: 0 }, 'Celda que se va').doc;
    before = withStory(before, 'header', { paragraphs: [para('Membrete viejo')] });
    let after = insertTable(doc('Antes'), { para: 0, offset: 5 }, 1, 2).doc;
    after = withStory(after, 'header', { paragraphs: [para('Membrete nuevo')] });
    const { changes, doc: marked } = compareDocs(before, after);
    const gone = marked.paragraphs.findIndex((p) => paragraphText(p) === 'Celda que se va');
    expect(marked.paragraphs[gone].cell).toEqual(after.paragraphs[cell].cell);
    expect(changes.find((c) => c.part === 'header')).toMatchObject({ kind: 'changed' });
    expect(shown({ ...marked, paragraphs: marked.header!.paragraphs })).toEqual(['Membrete [-viejo-]{+nuevo+}']);
  });
});

describe('going back to a version', () => {
  it('keeps the paragraphs that are the same, and carries the pictures of the version with it', () => {
    let version = insertImage(doc('Con foto ', 'Igual'), { para: 0, offset: 9 }, { bytes: PNG, type: 'image/png', width: 10, height: 10 }).doc;
    // As the application keeps it: a file, with the picture in its package.
    version = importDocx(exportDocx(version));
    const current = importDocx(exportDocx(doc('Sin foto', 'Igual')));
    const restored = restoreVersion(current, version);
    expect(restored.source).toBe(current.source);
    expect(restored.paragraphs[1]).toBe(current.paragraphs[1]);
    const picture = restored.paragraphs[0].runs.find((run) => run.props.object)!;
    expect(docImage(restored, picture.props.object!)?.bytes).toEqual(PNG);
    // Written into the current package, it reads back as the version.
    const back = importDocx(exportDocx(restored));
    expect(back.paragraphs.map(paragraphText)).toEqual(version.paragraphs.map(paragraphText));
    expect(compareDocs(version, back).changes).toEqual([]);
  });
});
