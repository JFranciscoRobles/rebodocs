import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type Doc, imageTypeOf, insertSectionBreak, setOwnStories, setPageNumbering, setSectionPage, createDoc, createParagraph, exportDocx, importDocx, insertImage, layoutDocument, letterheadImage, letterheadMargins, letterheadOf, paragraphText, removeLetterhead, setLetterhead, setPictureWrap, withStory } from '../src';

const PNG = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
const OTHER = new Uint8Array([137, 80, 78, 71, 9, 9]);
const base = (): Doc => createDoc([createParagraph('Recibo'), createParagraph('Texto')]);
const measurer = { width: (text: string, font: { size: number }) => text.length * font.size * 0.5, metrics: (font: { size: number }) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }) };
const headerText = (doc: Doc) => (doc.header?.paragraphs ?? []).map((p) => p.runs.map((run) => (run.props.object ? '' : run.text)).join(''));

describe('letterhead', () => {
  it('puts a picture the size of the page under the text of every page', () => {
    const doc = setLetterhead(base(), { bytes: PNG, type: 'image/png' });
    const found = letterheadOf(doc)!;
    expect(found).toMatchObject({ part: 'header', para: 0, offset: 0 });
    expect(found.xml).toContain('behindDoc="1"');
    expect(letterheadImage(doc)).toEqual({ bytes: PNG, type: 'image/png' });
    // The text of the document is as it was.
    expect(doc.paragraphs.map(paragraphText)).toEqual(['Recibo', 'Texto']);
    const [box] = layoutDocument(doc, measurer).pages[0].header!.floats;
    expect(box).toMatchObject({ x: 0, y: 0, width: 612, height: 792, behind: true });
  });

  it('is written as Word writes one, and read back as one', () => {
    const files = unzipSync(exportDocx(setLetterhead(base(), { bytes: PNG, type: 'image/png' })));
    const header = Object.keys(files).find((name) => /word\/header\d*\.xml$/.test(name))!;
    const xml = strFromU8(files[header]);
    expect(xml).toContain('<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>');
    expect(xml).toContain('<wp:extent cx="7772400" cy="10058400"/>');
    expect(xml).toContain('<wp:wrapNone/>');
    expect(xml).not.toContain('dx:');
    expect(Object.keys(files).some((name) => /word\/media\/.*\.png$/.test(name))).toBe(true);
    expect(strFromU8(files['word/document.xml'])).toContain('w:headerReference');
    const back = importDocx(exportDocx(setLetterhead(base(), { bytes: PNG, type: 'image/png' })));
    expect(letterheadOf(back)).toMatchObject({ part: 'header' });
    expect([...letterheadImage(back)!.bytes]).toEqual([...PNG]);
    // And again: what came from a file goes back to one with it.
    expect(letterheadOf(importDocx(exportDocx(back)))).toBeDefined();
  });

  it('takes the place of the one there was, and is taken away, leaving the rest of the header', () => {
    const titled = withStory(base(), 'header', { paragraphs: [createParagraph('Acme')] });
    const once = setLetterhead(titled, { bytes: PNG, type: 'image/png' });
    const twice = setLetterhead(once, { bytes: OTHER, type: 'image/png' });
    expect(headerText(twice)).toEqual(['Acme']);
    expect(twice.header!.paragraphs.flatMap((p) => p.runs).filter((run) => run.props.anchor)).toHaveLength(1);
    expect([...letterheadImage(twice)!.bytes]).toEqual([...OTHER]);
    const none = removeLetterhead(twice);
    expect(letterheadOf(none)).toBeUndefined();
    expect(headerText(none)).toEqual(['Acme']);
    expect(removeLetterhead(none)).toBe(none);
    // After a file: the one it brought is the one replaced.
    const reread = importDocx(exportDocx(once));
    const changed = setLetterhead(reread, { bytes: OTHER, type: 'image/png' });
    expect([...letterheadImage(importDocx(exportDocx(changed)))!.bytes]).toEqual([...OTHER]);
    expect(letterheadOf(importDocx(exportDocx(removeLetterhead(reread))))).toBeUndefined();
  });

  it('leaves in the file only the picture that is shown', () => {
    const pictures = (doc: Doc) => Object.entries(unzipSync(exportDocx(doc))).filter(([name]) => name.includes('/media/'));
    const first = importDocx(exportDocx(setLetterhead(base(), { bytes: PNG, type: 'image/png' })));
    expect(pictures(first)).toHaveLength(1);
    // Changed for another: the one it came with is not left inside for whoever unpacks the file.
    const changed = pictures(setLetterhead(first, { bytes: OTHER, type: 'image/png' }));
    expect(changed).toHaveLength(1);
    expect([...changed[0][1]]).toEqual([...OTHER]);
    const none = unzipSync(exportDocx(removeLetterhead(first)));
    expect(Object.keys(none).filter((name) => name.includes('/media/'))).toEqual([]);
    expect(Object.keys(none).filter((name) => /header\d*\.xml\.rels$/.test(name)).map((name) => strFromU8(none[name])).join('')).not.toContain('/image"');
    // And a picture of the text that was deleted goes the same way; the one that stays, stays.
    const two = insertImage(insertImage(base(), { para: 0, offset: 0 }, { bytes: PNG, type: 'image/png', width: 10, height: 10 }).doc, { para: 1, offset: 0 }, { bytes: OTHER, type: 'image/png', width: 10, height: 10 }).doc;
    const reread = importDocx(exportDocx(two));
    expect(pictures(reread)).toHaveLength(2);
    const left = pictures({ ...reread, paragraphs: [reread.paragraphs[1]] });
    expect(left).toHaveLength(1);
    expect([...left[0][1]]).toEqual([...OTHER]);
  });

  it('goes on the first page too when it has a header of its own', () => {
    const doc = setLetterhead({ ...base(), firstPage: {} }, { bytes: PNG, type: 'image/png' });
    expect(doc.header && letterheadOf({ ...doc, firstPage: undefined })).toBeDefined();
    expect(doc.firstPage!.header!.paragraphs[0].runs[0].props.anchor).toBe(true);
    expect(layoutDocument(doc, measurer).pages[0].header!.floats).toHaveLength(1);
    const none = removeLetterhead(doc);
    expect(none.firstPage!.header!.paragraphs[0].runs.some((run) => run.props.anchor)).toBe(false);
  });

  it('does not take a picture in the header for one, nor a file that is not a picture', () => {
    const doc = base();
    expect(setLetterhead(doc, { bytes: PNG, type: 'application/pdf' })).toBe(doc);
    const logo = insertImage({ ...doc, paragraphs: [createParagraph('')] }, { para: 0, offset: 0 }, { bytes: PNG, type: 'image/png', width: 80, height: 30 });
    const behind = setPictureWrap(logo.doc, { para: 0, offset: 0 }, 'behind');
    const withLogo = { ...withStory(doc, 'header', { paragraphs: behind.paragraphs }), media: behind.media };
    expect(letterheadOf(withLogo)).toBeUndefined();
    // Giving it a letterhead leaves the logo where it was.
    const both = setLetterhead(withLogo, { bytes: OTHER, type: 'image/png' });
    expect(both.header!.paragraphs.flatMap((p) => p.runs).filter((run) => run.props.anchor)).toHaveLength(2);
    expect(removeLetterhead(both).header!.paragraphs.flatMap((p) => p.runs).filter((run) => run.props.anchor)).toHaveLength(1);
  });

  it('reads from its pixels the margins it asks for', () => {
    const width = 100;
    const height = 130;
    const paper = (tone = 255) => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i += 4) data.set([tone, tone, tone, 255], i);
      return data;
    };
    const paint = (data: Uint8ClampedArray, rows: [number, number], columns: [number, number], tone: number) => {
      for (let y = rows[0]; y <= rows[1]; y++) for (let x = columns[0]; x <= columns[1]; x++) data.set([tone, tone, tone, 255], (y * width + x) * 4);
      return data;
    };
    const page = { height: 792 };
    const scale = 792 / height;
    // A logo at the top left, an address along the bottom, and a faint pattern under the text between them.
    const data = paint(paint(paint(paper(), [5, 10], [8, 30], 40), [118, 122], [8, 90], 60), [60, 100], [0, 99], 246);
    const asked = letterheadMargins({ width, height, data }, page);
    expect(asked.top).toBeCloseTo(11 * scale + 18, 5);
    expect(asked.bottom).toBeCloseTo((height - 118) * scale + 18, 5);
    // Blank paper asks for nothing; neither does something printed in the middle of the page.
    expect(letterheadMargins({ width, height, data: paper() }, page)).toEqual({});
    expect(letterheadMargins({ width, height, data: paint(paper(), [55, 70], [20, 80], 30) }, page)).toEqual({});
    // On coloured paper, it is what stands out from the paper that counts; and a logo with a line under it is one thing.
    const dark = paint(paint(paper(30), [4, 8], [10, 40], 230), [10, 10], [10, 90], 230);
    expect(letterheadMargins({ width, height, data: dark }, page)).toEqual({ top: 11 * scale + 18 });
    // Transparent is paper.
    const clear = new Uint8ClampedArray(width * height * 4);
    expect(letterheadMargins({ width, height, data: paint(clear, [0, 9], [0, 99], 20) }, page).top).toBeCloseTo(10 * scale + 18, 5);
  });

  it('is shown on a document read from a file that had no header, as a page number given to it is', () => {
    const read = importDocx(exportDocx(base()));
    expect(read.noHeader).toBe(true);
    const given = setLetterhead(read, { bytes: PNG, type: 'image/png' });
    expect(layoutDocument(given, measurer).pages[0].header?.floats).toHaveLength(1);
    const numbered = setPageNumbering(read, { place: 'footer', align: 'center', format: 'number' });
    expect(layoutDocument(numbered, measurer).pages[0].footer).toBeDefined();
  });

  it('stays the size of the page when the paper turns', () => {
    const doc = setLetterhead(base(), { bytes: PNG, type: 'image/png' });
    const turned = setSectionPage(doc, 0, { width: 792, height: 612 });
    expect(letterheadOf(turned)).toBeDefined();
    const [box] = layoutDocument(turned, measurer).pages[0].header!.floats;
    expect(box).toMatchObject({ width: 792, height: 612 });
    expect(letterheadOf(importDocx(exportDocx(turned)))).toBeDefined();
  });

  it('goes in the header of a section that has its own too, the size of its page', () => {
    let doc = insertSectionBreak(base(), { para: 0, offset: 6 }).doc;
    doc = setOwnStories(doc, 0, true);
    doc = setSectionPage(doc, 0, { width: 792, height: 612 });
    const given = setLetterhead(doc, { bytes: PNG, type: 'image/png' });
    const pages = layoutDocument(given, measurer).pages;
    expect(pages.map((page) => page.header?.floats.map((f) => [f.width, f.height]))).toEqual([[[792, 612]], [[612, 792]]]);
    // Each drawing with an id of its own, as Word wants them.
    const files = unzipSync(exportDocx(given));
    const ids = Object.keys(files).filter((name) => /word\/header\d*\.xml$/.test(name)).flatMap((name) => [...strFromU8(files[name]).matchAll(/<wp:docPr id="(\d+)"/g)].map((m) => m[1]));
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(letterheadOf(removeLetterhead(given))).toBeUndefined();
    expect(layoutDocument(removeLetterhead(given), measurer).pages.every((page) => !page.header?.floats.length)).toBe(true);
    // Turning the paper of the section turns its own.
    const turned = setSectionPage(given, 0, { width: 612, height: 792 });
    expect(layoutDocument(turned, measurer).pages[0].header!.floats[0]).toMatchObject({ width: 612, height: 792 });
  });

  it('tells a picture by how it starts, for one that came without saying what it is', () => {
    expect(imageTypeOf(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10]))).toBe('image/png');
    expect(imageTypeOf(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(imageTypeOf(new TextEncoder().encode('GIF89a'))).toBe('image/gif');
    expect(imageTypeOf(new TextEncoder().encode('<svg'))).toBeUndefined();
  });
});
