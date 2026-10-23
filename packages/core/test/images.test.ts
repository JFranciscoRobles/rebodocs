import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  OBJECT_CHAR,
  altText,
  createDoc,
  docImage,
  exportDocx,
  importDocx,
  insertImage,
  insertImageGrid,
  insertText,
  movePicture,
  pictureAt,
  resizePicture,
  setAltText,
} from '../src/internal';

const PNG = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
const base = () =>
  createDoc([
    { props: {}, runs: [{ text: 'Hello world', props: {} }] },
    { props: {}, runs: [{ text: 'Second', props: {} }] },
  ]);
const texts = (doc: Doc) => doc.paragraphs.map((p) => p.runs.map((r) => (r.props.object ? '#' : r.text)).join(''));

describe('pictures', () => {
  it('puts a picture in the text, as one character', () => {
    const { doc, pos } = insertImage(base(), { para: 0, offset: 5 }, { bytes: PNG, type: 'image/png', width: 120, height: 60 });
    expect(texts(doc)).toEqual(['Hello# world', 'Second']);
    expect(pos).toEqual({ para: 0, offset: 6 });
    const run = pictureAt(doc, { para: 0, offset: 5 })!;
    expect(run.text).toBe(OBJECT_CHAR);
    expect(run.props).toMatchObject({ objectWidth: 120, objectHeight: 60, anchor: false });
    expect(docImage(doc, run.props.object!)).toEqual({ bytes: PNG, type: 'image/png' });
    expect(pictureAt(doc, { para: 0, offset: 4 })).toBeUndefined();
    // Not a kind of picture a document can hold, or no size: nothing happens.
    expect(insertImage(base(), { para: 0, offset: 0 }, { bytes: PNG, type: 'image/tiff', width: 10, height: 10 }).doc).toEqual(base());
  });

  it('writes the picture into the package, and reads it back', () => {
    const { doc } = insertImage(base(), { para: 0, offset: 5 }, { bytes: PNG, type: 'image/png', width: 120, height: 60 });
    const files = unzipSync(exportDocx(doc));
    expect([...files['word/media/dx1.png']]).toEqual([...PNG]);
    expect(strFromU8(files['[Content_Types].xml'])).toContain('<Default Extension="png" ContentType="image/png"/><Override');
    expect(strFromU8(files['word/_rels/document.xml.rels'])).toContain('relationships/image" Target="media/dx1.png"/>');
    const xml = strFromU8(files['word/document.xml']);
    expect(xml).toContain('r:embed="rId1"');
    expect(xml).not.toContain('dx:');
    expect(xml).toContain('<wp:extent cx="1524000" cy="762000"/>');

    const back = importDocx(exportDocx(doc));
    expect(texts(back)).toEqual(['Hello# world', 'Second']);
    const run = pictureAt(back, { para: 0, offset: 5 })!;
    expect(run.props).toMatchObject({ objectWidth: 120, objectHeight: 60 });
    expect([...docImage(back, run.props.object!)!.bytes]).toEqual([...PNG]);
    // Saved again, the picture is the one of the package: it is not written twice.
    expect(Object.keys(unzipSync(exportDocx(back))).filter((path) => path.includes('media/'))).toEqual(['word/media/dx1.png']);

    // A second picture put in a document that came from a file goes next to the first.
    const two = insertImage(insertText(back, { para: 1, offset: 0 }, 'x').doc, { para: 1, offset: 1 }, { bytes: new Uint8Array([255, 216, 9]), type: 'image/jpeg', width: 10, height: 10 }).doc;
    const again = unzipSync(exportDocx(two));
    expect(
      Object.keys(again)
        .filter((path) => path.includes('media/'))
        .sort(),
    ).toEqual(['word/media/dx1.jpg', 'word/media/dx1.png']);
    expect(texts(importDocx(exportDocx(two)))).toEqual(['Hello# world', 'x#Second']);
  });

  it('gives a picture another size, also one that came in a file', () => {
    const { doc } = insertImage(base(), { para: 0, offset: 5 }, { bytes: PNG, type: 'image/png', width: 120, height: 60 });
    const back = importDocx(exportDocx(doc));
    const resized = resizePicture(back, { para: 0, offset: 5 }, 60, 30);
    expect(texts(resized)).toEqual(['Hello# world', 'Second']);
    expect(pictureAt(resized, { para: 0, offset: 5 })!.props).toMatchObject({ objectWidth: 60, objectHeight: 30 });
    const xml = strFromU8(unzipSync(exportDocx(resized))['word/document.xml']);
    expect(xml).toContain('<wp:extent cx="762000" cy="381000"/>');
    expect(xml).toContain('<a:ext cx="762000" cy="381000"/>');
    expect(pictureAt(importDocx(exportDocx(resized)), { para: 0, offset: 5 })!.props).toMatchObject({ objectWidth: 60, objectHeight: 30 });
    expect(resizePicture(back, { para: 0, offset: 2 }, 60, 30)).toBe(back);
  });

  it('moves a picture inside its paragraph and to another one', () => {
    const { doc } = insertImage(base(), { para: 0, offset: 5 }, { bytes: PNG, type: 'image/png', width: 120, height: 60 });
    const later = movePicture(doc, { para: 0, offset: 5 }, { para: 0, offset: 12 });
    expect(texts(later.doc)).toEqual(['Hello world#', 'Second']);
    expect(later.pos).toEqual({ para: 0, offset: 11 });
    const earlier = movePicture(doc, { para: 0, offset: 5 }, { para: 0, offset: 0 });
    expect(texts(earlier.doc)).toEqual(['#Hello world', 'Second']);
    const other = movePicture(doc, { para: 0, offset: 5 }, { para: 1, offset: 3 });
    expect(texts(other.doc)).toEqual(['Hello world', 'Sec#ond']);
    expect(other.pos).toEqual({ para: 1, offset: 3 });
    expect(pictureAt(other.doc, other.pos)).toBeDefined();
    // Dropped where it is, or on something that is not a picture: nothing happens.
    expect(movePicture(doc, { para: 0, offset: 5 }, { para: 0, offset: 6 }).doc).toBe(doc);
    expect(movePicture(doc, { para: 0, offset: 2 }, { para: 1, offset: 0 }).doc).toBe(doc);
  });

  it('puts several pictures in as a grid without borders, each as large as its cell allows', () => {
    const picture = (width: number, height: number) => ({ bytes: PNG, type: 'image/png', width, height });
    const five = [picture(400, 200), picture(100, 300), picture(50, 50), picture(800, 800), picture(300, 100)];
    const { doc, pos } = insertImageGrid(base(), { para: 0, offset: 11 }, five, 3);
    expect(texts(doc)).toEqual(['Hello world', '#', '#', '#', '#', '#', '', '', 'Second']);
    expect(pos).toEqual({ para: 7, offset: 0 });
    const table = doc.tables![0];
    expect([table.rows.length, table.columns.length]).toEqual([2, 3]);
    expect(table.rows.every((row) => row.cells.every((cell) => !cell.borders))).toBe(true);
    // Each fills the square its column leaves, in its own shape, whether it was larger or smaller.
    const side = table.columns[0] - table.padLeft - table.padRight;
    const sizes = [1, 2, 3, 4, 5].map((i) => pictureAt(doc, { para: i, offset: 0 })!.props);
    expect(sizes.map((p) => [Math.round(p.objectWidth!), Math.round(p.objectHeight!)])).toEqual(
      [
        [1, 0.5],
        [1 / 3, 1],
        [1, 1],
        [1, 1],
        [1, 1 / 3],
      ].map(([w, h]) => [Math.round(side * w), Math.round(side * h)]),
    );
    expect(doc.paragraphs.slice(1, 6).every((p) => p.props.align === 'center')).toBe(true);
    expect(Object.keys(doc.media!)).toHaveLength(5);
    // No more columns than pictures; and it is a table like any other in the file.
    expect(insertImageGrid(base(), { para: 0, offset: 11 }, five.slice(0, 2), 6).doc.tables![0].columns).toHaveLength(2);
    const back = importDocx(exportDocx(doc));
    expect(texts(back)).toEqual(texts(doc));
    expect(insertImageGrid(base(), { para: 0, offset: 0 }, [], 3).doc).toEqual(base());
  });
});

describe('the description of a picture', () => {
  it('is read from the drawing as Word keeps it, set, changed and taken away, and goes to the DOCX and back', () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    let doc = insertImage(createDoc([{ props: {}, runs: [{ text: '', props: {} }] }]), { para: 0, offset: 0 }, { bytes: png, type: 'image/png', width: 20, height: 10 }).doc;
    const xml = () => doc.paragraphs[0].runs.find((run) => run.props.object)!.props.object;
    expect(altText(xml())).toBeUndefined();
    doc = setAltText(doc, { para: 0, offset: 0 }, 'A plan  of the "flat" & its rooms');
    expect(altText(xml())).toBe('A plan of the "flat" & its rooms');
    const back = importDocx(exportDocx(doc));
    expect(altText(back.paragraphs[0].runs.find((run) => run.props.object)!.props.object)).toBe('A plan of the "flat" & its rooms');
    doc = setAltText(doc, { para: 0, offset: 0 }, '');
    expect(altText(xml())).toBeUndefined();
    expect(setAltText(doc, { para: 0, offset: 0 }, '')).toBe(doc);
  });
});
