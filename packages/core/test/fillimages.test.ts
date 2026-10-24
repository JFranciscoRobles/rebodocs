import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type Doc, type Paragraph, createDoc, exportDocx, fillVariables, importDocx, insertTable, insertText, variableProblems } from '../src/internal';

const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });

/** The head of a PNG of `width` × `height` pixels: what a picture's size is read from. */
function png(width: number, height: number, tag = 0): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  bytes[32] = tag;
  return bytes;
}
const dataUrl = (bytes: Uint8Array, type = 'image/png') => `data:${type};base64,${btoa(String.fromCharCode(...bytes))}`;

/** The pictures of the text, as their width and height, in the order they are. */
const pictures = (doc: Pick<Doc, 'paragraphs'>) => doc.paragraphs.flatMap((q) => q.runs.filter((run) => run.props.object).map((run) => [run.props.objectWidth, run.props.objectHeight]));
const text = (doc: Doc) => doc.paragraphs.map((q) => q.runs.map((run) => (run.props.object ? '#' : run.text)).join(''));

describe('pictures in a template', () => {
  const logo = dataUrl(png(200, 100));

  it('puts the picture in place of {{name | image}}, at its own size at 96 pixels an inch', () => {
    const doc = fillVariables(createDoc([p('Logo: {{logo | image}}.')]), { logo });
    expect(text(doc)).toEqual(['Logo: #.']);
    expect(pictures(doc)).toEqual([[150, 75]]);
    expect(Object.values(doc.media ?? {})).toHaveLength(1);
  });

  it('takes the width the format says, and keeps its shape; or both, when it says both', () => {
    expect(pictures(fillVariables(createDoc([p('{{logo | image: 4cm}}')]), { logo }))).toEqual([[113.39, 56.69]]);
    expect(pictures(fillVariables(createDoc([p('{{logo | image: 2in x 2in}}')]), { logo }))).toEqual([[144, 144]]);
    expect(pictures(fillVariables(createDoc([p('{{logo | imagen: 30 mm}}')]), { logo }))).toEqual([[85.04, 42.52]]);
  });

  it('never makes one wider than the text of the page', () => {
    const doc = fillVariables(createDoc([p('{{photo | image}}')]), { photo: dataUrl(png(4000, 1000)) });
    const widest = doc.page.width - doc.page.marginLeft - doc.page.marginRight;
    const [[width, height]] = pictures(doc);
    expect(width).toBeCloseTo(widest, 1);
    expect(height).toBeCloseTo(widest / 4, 1);
  });

  it('gives each item of a block its own picture, and keeps the same picture once', () => {
    let doc: Doc = createDoc([p('{{logo | image}}'), p('')]);
    doc = insertTable(doc, { para: 1, offset: 0 }, 1, 2).doc;
    const cells = doc.paragraphs.flatMap((q, i) => (q.cell ? [i] : []));
    doc = insertText(doc, { para: cells[0], offset: 0 }, '{{#people}}{{people.name}}').doc;
    doc = insertText(doc, { para: cells[1], offset: 0 }, '{{people.photo | image: 1in}}{{/people}}').doc;
    const filled = fillVariables(doc, {
      logo,
      people: [
        { name: 'Ana', photo: dataUrl(png(10, 10, 1)) },
        { name: 'Luis', photo: dataUrl(png(10, 20, 2)) },
        { name: 'Eva', photo: logo },
      ],
    });
    expect(filled.tables![0].rows).toHaveLength(3);
    expect(pictures(filled)).toEqual([
      [150, 75],
      [72, 72],
      [72, 144],
      [72, 36],
    ]);
    // The logo of the text and of Eva's row is one picture: three in all.
    expect(Object.keys(filled.media ?? {})).toHaveLength(3);
  });

  it('puts a logo in the header, and keeps it there through a .docx', () => {
    const doc = { ...createDoc([p('Body')]), header: { paragraphs: [p('{{logo | image: 3cm}} Acme Ltd.')] } } as Doc;
    const filled = fillVariables(doc, { logo });
    expect(pictures(filled.header!)).toEqual([[85.04, 42.52]]);
    const files = unzipSync(exportDocx(filled));
    expect(Object.keys(files).filter((name) => name.startsWith('word/media/'))).toHaveLength(1);
    const header = Object.keys(files).find((name) => /^word\/header\d*\.xml$/.test(name))!;
    expect(strFromU8(files[header])).toContain('<w:drawing>');
    expect(pictures(importDocx(exportDocx(filled)).header!)).toHaveLength(1);
  });

  it('writes the picture into the .docx, which reads it back', () => {
    const filled = fillVariables(createDoc([p('Signed: {{signature | image: 4cm}}')]), { signature: logo });
    const files = unzipSync(exportDocx(filled));
    const media = Object.keys(files).filter((name) => name.startsWith('word/media/'));
    expect(media).toHaveLength(1);
    expect(files[media[0]]).toEqual(png(200, 100));
    expect(pictures(importDocx(exportDocx(filled)))).toHaveLength(1);
  });

  it('says a value that is not a picture, and puts nothing in its place', () => {
    const doc = createDoc([p('Logo: {{logo | image}}.')]);
    for (const value of ['https://example.com/logo.png', 'data:image/png;base64,bm90IGEgcGljdHVyZQ==', 'data:text/plain;base64,aGk=']) {
      expect(variableProblems(doc, { logo: value })).toEqual([{ name: 'logo', format: 'image', kind: 'value' }]);
      expect(text(fillVariables(doc, { logo: value }))).toEqual(['Logo: .']);
    }
    expect(variableProblems(doc, { logo })).toEqual([]);
  });
});
