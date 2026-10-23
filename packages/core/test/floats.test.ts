import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type FontSpec,
  type Paragraph,
  type Run,
  adjacentLine,
  createDoc,
  floatAt,
  insertImage,
  moveFloat,
  pictureAt,
  pictureWrap,
  reanchorFloat,
  resizeFloat,
  setPictureWrap,
  exportDocx,
  hitTest,
  importDocx,
  insertText,
  layoutDocument,
  plainText,
  storyOf,
  withStory,
} from '../src/internal';
import { anchoredObject } from '../src/docx/source';

/** Every character as wide as half its font size: enough to see where things land. */
const measurer = {
  width: (text: string, font: FontSpec) => text.length * font.size * 0.5,
  metrics: (font: FontSpec) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};
const W =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const EMU = 12700;

/** A floating picture `width` by `height` points, `x` from the column and `y` below its paragraph. */
const drawing = (wrap: string, x: number, y: number, width: number, height: number, gap = 0) =>
  `<w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0"><wp:positionH relativeFrom="column"><wp:posOffset>${x * EMU}</wp:posOffset></wp:positionH>` +
  `<wp:positionV relativeFrom="paragraph"><wp:posOffset>${y * EMU}</wp:posOffset></wp:positionV><wp:extent cx="${width * EMU}" cy="${height * EMU}"/>` +
  `<wp:${wrap}${gap ? ` distT="${gap * EMU}" distB="${gap * EMU}" distL="${gap * EMU}" distR="${gap * EMU}"` : ''}/>` +
  `<a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="rId1"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing>`;
const floating = (xml: string): Run => ({ text: '⁠', props: { object: `<w:r>${xml}</w:r>`, anchor: true } });
const words = (count: number) => Array.from({ length: count }, () => 'palabra').join(' ');
const p = (text: string, ...more: Run[]): Paragraph => ({ props: {}, runs: [...more, { text, props: {} }] });

describe('floating pictures', () => {
  it('reads where one goes and what the text does about it', () => {
    expect(anchoredObject(drawing('wrapSquare wrapText="bothSides"', 10, 20, 100, 50, 9))).toMatchObject({
      width: 100,
      height: 50,
      x: 10,
      y: 20,
      fromX: 'column',
      fromY: 'paragraph',
      wrap: 'square',
      gap: { top: 9, bottom: 9, left: 9, right: 9 },
    });
    expect(anchoredObject(drawing('wrapTopAndBottom', 0, 0, 100, 50))!.wrap).toBe('topBottom');
    expect(anchoredObject(drawing('wrapTight', 0, 0, 100, 50))!.wrap).toBe('square');
    expect(anchoredObject(drawing('wrapNone', 0, 0, 100, 50))).toMatchObject({ wrap: 'none', gap: { top: 0, bottom: 0, left: 0, right: 0 } });
    expect(anchoredObject('<w:drawing><wp:inline><wp:extent cx="1" cy="1"/></wp:inline></w:drawing>')).toBeUndefined();
  });

  it('sets the lines above a picture round it too when the room it keeps reaches up into them, the picture staying put', () => {
    // A line of 10 above, then a paragraph whose banner starts at its top with 4 of room above: the room covers the foot of the line.
    const short = (text: string): Paragraph => ({ props: { spacingAfter: 2 }, runs: [{ text, props: {} }] });
    const banner = floating(drawing('wrapTopAndBottom', 0, 0, 200, 40, 4));
    const layout = layoutDocument(createDoc([short('arriba'), short('subtitulo'), { ...p(words(10), banner), props: { spacingAfter: 0 } }]), measurer);
    const [box] = layout.pages[0].floats;
    const subtitle = layout.lines.find((l) => l.fragments.some((f) => f.text === 'subtitulo'))!;
    // Measured against Word: the subtitle goes below the banner, which stays where its paragraph first put it, under the first line.
    const first = layout.lines.find((l) => l.fragments.some((f) => f.text === 'arriba'))!;
    expect(first.y).toBeCloseTo(layout.page.marginTop);
    expect(box.y).toBeGreaterThan(first.y + first.height);
    expect(subtitle.y).toBeGreaterThanOrEqual(box.y + 40 + 4 - 0.01);
    expect(layout.lines.find((l) => l.para === 2)!.y).toBeGreaterThan(subtitle.y);
  });

  it('breaks again the lines that go on to the next page from beside a picture, for the room there', () => {
    // A picture at the foot of the first page, taller than what is left of it, and a long paragraph beside it.
    const filler = Array.from({ length: 25 }, (_, i) => p(`linea ${i}`));
    const doc = createDoc([...filler, p(words(200), floating(drawing('wrapSquare', 300, 0, 168, 200, 0)))]);
    const layout = layoutDocument(doc, measurer);
    expect(layout.pages[0].lines.some((l) => l.para === 25)).toBe(true);
    const next = layout.pages[1].lines.filter((l) => l.para === 25);
    expect(next.length).toBeGreaterThan(0);
    // On the next page nothing is beside it: the lines are as wide as the column.
    for (const line of next.slice(0, -1)) expect(line.width).toBeGreaterThan(300);
  });

  it('sends the text down the side of a picture it goes round, and back to its whole width below it', () => {
    // 200 points wide at the left of the column, 60 tall, with 10 of room round it: the text has the 258 to its right.
    const doc = createDoc([p(words(60), floating(drawing('wrapSquare', 0, 0, 200, 60, 10))), p(words(30))]);
    const layout = layoutDocument(doc, measurer);
    const { marginLeft, marginRight, width } = doc.page;
    const [box] = layout.pages[0].floats;
    expect(box).toMatchObject({ x: marginLeft, y: doc.page.marginTop, width: 200, height: 60 });
    const beside = layout.lines.filter((line) => line.y < box.y + 70 - 0.01);
    const below = layout.lines.filter((line) => line.y >= box.y + 70 - 0.01);
    expect(beside.length).toBeGreaterThan(2);
    expect(below.length).toBeGreaterThan(2);
    for (const line of beside) {
      expect(line.x).toBe(marginLeft + 210);
      expect(line.x + line.width).toBeLessThanOrEqual(width - marginRight + 0.01);
    }
    for (const line of below) expect(line.x).toBe(marginLeft);
    // No text is lost to the picture: every word is on some line.
    expect(
      layout.lines
        .map((line) => line.fragments.map((f) => f.text).join(''))
        .join('')
        .replace(/⁠/g, ''),
    ).toBe(`${words(60)}${words(30)}`);
    // The paragraph after it goes round it too, while it reaches that far.
    const tall = layoutDocument(createDoc([p('Uno', floating(drawing('wrapSquare', 0, 0, 200, 60))), p('Dos'), p(words(40))]), measurer);
    expect(tall.lines.filter((line) => line.para === 1)[0].x).toBe(marginLeft + 200);
    // One at the right leaves the text on its left.
    const right = layoutDocument(createDoc([p(words(60), floating(drawing('wrapSquare', 300, 0, 168, 40)))]), measurer);
    expect(right.lines[0].x).toBe(marginLeft);
    expect(right.lines[0].x + right.lines[0].width).toBeLessThanOrEqual(marginLeft + 300 + 0.01);
  });

  it('runs the text down both sides of a picture with room on each', () => {
    const { marginLeft, marginRight, width } = createDoc().page;
    const room = width - marginLeft - marginRight;
    // 100 wide in the middle of the column, 40 tall: the same room on its left as on its right.
    const x = (room - 100) / 2;
    const doc = createDoc([p(words(80), floating(drawing('wrapSquare wrapText="bothSides"', x, 0, 100, 40)))]);
    const layout = layoutDocument(doc, measurer);
    const [box] = layout.pages[0].floats;
    const rows = new Map<number, typeof layout.lines>();
    for (const line of layout.lines) rows.set(line.y, [...(rows.get(line.y) ?? []), line]);
    const beside = [...rows.entries()].filter(([y]) => y < box.y + 40 - 0.01);
    expect(beside.length).toBeGreaterThan(1);
    for (const [, [left, right, ...more]] of beside) {
      // Two stretches on one baseline: one ends before the picture, the other starts after it.
      expect(more).toEqual([]);
      expect(left.x).toBe(marginLeft);
      expect(left.x + left.width).toBeLessThanOrEqual(box.x + 0.01);
      expect(right.x).toBe(box.x + 100);
      expect(right.baseline).toBe(left.baseline);
      expect(right.height).toBe(left.height);
      expect(right.start).toBe(left.end);
    }
    // Below it, one line a row again, the whole width; and the text is all there, in order.
    const below = [...rows.entries()].filter(([y]) => y >= box.y + 40 - 0.01);
    expect(below.length).toBeGreaterThan(1);
    for (const [, row] of below) expect(row).toHaveLength(1);
    expect(below[0][0]).toBeCloseTo(beside[beside.length - 1][0] + beside[0][1][0].height, 5);
    expect(
      layout.lines
        .map((line) => line.fragments.map((f) => f.text).join(''))
        .join('')
        .replace(/⁠/g, ''),
    ).toBe(words(80));
    // A point on the right of the picture is in the stretch that is there, and the arrows keep to their side.
    const [, [left, right]] = beside[0];
    expect(hitTest(layout, measurer, 0, right.x + 5, right.y + 2).offset).toBeGreaterThanOrEqual(right.start);
    expect(hitTest(layout, measurer, 0, left.x + 5, left.y + 2).offset).toBeLessThan(left.end);
    expect(adjacentLine(layout, right, right.x + 5, 1)!.x).toBe(beside.length > 1 ? right.x : marginLeft);
    // Told to keep to one side, it does.
    const one = layoutDocument(createDoc([p(words(80), floating(drawing('wrapSquare wrapText="left"', x, 0, 100, 40)))]), measurer);
    expect(one.lines.filter((line) => line.y === one.lines[0].y)).toHaveLength(1);
    expect(one.lines[0].x + one.lines[0].width).toBeLessThanOrEqual(marginLeft + x + 0.01);
  });

  it('counts a whole line as beside a picture, but only the text of the last line of a paragraph', () => {
    // Lines 20 tall whose text is the first 10 of each.
    // The mark of the picture is in the size of the text, or its line would be the taller for it.
    const spaced = (text: string, ...more: Run[]): Paragraph => ({
      props: { lineHeight: 2, spacingAfter: 0 },
      runs: [...more.map((run) => ({ ...run, props: { ...run.props, fontSize: 10 } })), { text, props: { fontSize: 10 } }],
    });
    const { marginLeft, marginTop } = createDoc().page;
    const narrowed = (count: number, y: number, height: number) => {
      const layout = layoutDocument(createDoc([spaced(words(count), floating(drawing('wrapSquare', 300, y, 168, height)))]), measurer);
      return layout.lines.filter((line) => !line.lastInParagraph && line.x + line.width < marginLeft + 301 && line.end - line.start > 40).map((line) => Math.round((line.y - marginTop) / 20));
    };
    // A picture that starts in the room under the text of the second line, and ends just into the fifth: both are beside it.
    expect(narrowed(200, 35, 46)).toEqual([1, 2, 3, 4]);
    // One that starts where the third line does leaves the second alone.
    expect(narrowed(200, 40, 40)).toEqual([2, 3]);
    // A paragraph of two lines whose second ends it: the room under its text is not its own, so a picture
    // that starts there is not beside it, and the line keeps its whole width.
    const short = layoutDocument(createDoc([spaced(words(18), floating(drawing('wrapSquare', 300, 35, 168, 46))), p('Después')]), measurer);
    const said = (lines: typeof short.lines) =>
      lines.map((line) =>
        line.fragments
          .map((f) => f.text)
          .join('')
          .replace(/\u2060/g, ''),
      );
    expect(said(short.lines.filter((line) => line.para === 0))).toEqual(said(layoutDocument(createDoc([spaced(words(18))]), measurer).lines));
  });

  it('sends a word that fits on neither side of a picture below it, whole', () => {
    // 80 of room on the left and 108 on the right of a picture in the column; a word of 150 fits neither.
    const doc = createDoc([
      {
        props: {},
        runs: [floating(drawing('wrapSquare wrapText="bothSides"', 80, 0, 280, 30)), { text: 'a ', props: {} }, { text: 'palabralarguisima', props: { fontSize: 18 } }, { text: ' fin', props: {} }],
      },
    ]);
    const layout = layoutDocument(doc, measurer);
    const word = layout.lines.find((line) => line.fragments.some((f) => f.text.includes('palabralarguisima')))!;
    expect(
      layout.lines
        .flatMap((line) => line.fragments)
        .filter((f) => /palabra|larguisima/.test(f.text))
        .map((f) => f.text),
    ).toEqual(['palabralarguisima']);
    expect(word.x).toBe(doc.page.marginLeft);
    expect(word.y).toBeGreaterThanOrEqual(layout.pages[0].floats[0].y + 30 - 0.01);
  });

  it('puts the text below a picture that takes the whole width, or leaves too little beside it', () => {
    const top = createDoc([p('Antes'), p('Texto', floating(drawing('wrapTopAndBottom', 50, 0, 100, 80))), p('Después')]);
    const layout = layoutDocument(top, measurer);
    const [box] = layout.pages[0].floats;
    const [before, own, after] = layout.lines;
    expect(before.y + before.height).toBeLessThanOrEqual(box.y + 0.01);
    // The line of its own paragraph is pushed below it, and the next follows.
    expect(own.y).toBeCloseTo(box.y + 80, 5);
    expect(after.y).toBeGreaterThan(own.y);
    expect(own.x).toBe(top.page.marginLeft);
    // In the middle of the column, with less than a quarter of an inch on either side: the same.
    const { width, marginLeft, marginRight } = top.page;
    const room = width - marginLeft - marginRight;
    const narrow = layoutDocument(createDoc([p('Texto', floating(drawing('wrapSquare', 15, 0, room - 30, 50)))]), measurer);
    expect(narrow.lines[0].y).toBeCloseTo(narrow.pages[0].floats[0].y + 50, 5);
    // One the text does not go round changes nothing.
    const none = layoutDocument(createDoc([p(words(60), floating(drawing('wrapNone', 0, 0, 200, 60)))]), measurer);
    expect(none.pages[0].floats).toHaveLength(1);
    expect(none.lines.map((line) => [line.x, line.y])).toEqual(layoutDocument(createDoc([p(words(60))]), measurer).lines.map((line) => [line.x, line.y]));
  });
});

describe('a floating picture measured as Word measures it', () => {
  it('is placed from the top of its paragraph, the space above the paragraph included', () => {
    const spaced = (text: string, ...more: Run[]): Paragraph => ({ props: { spacingBefore: 30 }, runs: [...more, { text, props: {} }] });
    const first: Paragraph = { props: { spacingAfter: 0 }, runs: [{ text: 'Antes', props: {} }] };
    const layout = layoutDocument(createDoc([first, spaced('Texto', floating(drawing('wrapNone', 0, 5, 50, 20)))]), measurer);
    const [before, own] = layout.lines;
    // 5 below where the line before it ends, not 5 below its own first line, which is 30 further down.
    expect(layout.pages[0].floats[0].y).toBeCloseTo(before.y + before.height + 5, 5);
    expect(own.y).toBeCloseTo(before.y + before.height + 30, 5);
    // A first line sent below a picture still has that space above it.
    const pushed = layoutDocument(createDoc([first, spaced('Texto', floating(drawing('wrapTopAndBottom', 0, 5, 50, 40)))]), measurer);
    const box = pushed.pages[0].floats[0];
    const line = pushed.lines[1];
    expect(line.y).toBeCloseTo(box.y + 40 + 30, 5);
  });

  it('moves, takes another size and changes what the text does about it', () => {
    const doc = createDoc([p(words(60), floating(drawing('wrapSquare wrapText="bothSides"', 10, 20, 100, 50, 9)))]);
    const at = { para: 0, offset: 0 };
    expect(floatAt(doc, at)).toMatchObject({ x: 10, y: 20, width: 100, height: 50, wrap: 'square' });
    expect(floatAt(doc, { para: 0, offset: 3 })).toBeUndefined();
    const moved = moveFloat(doc, at, 15, -5);
    expect(floatAt(moved, at)).toMatchObject({ x: 25, y: 15, fromX: 'column', fromY: 'paragraph' });
    expect(layoutDocument(moved, measurer).pages[0].floats[0]).toMatchObject({ x: doc.page.marginLeft + 25, para: 0, offset: 0 });
    expect(moveFloat(doc, at, 0, 0)).toBe(doc);
    const sized = resizeFloat(doc, at, 60, 30);
    expect(floatAt(sized, at)).toMatchObject({ width: 60, height: 30, x: 10 });
    // It is still a mark with no width in its line: only the picture is another size.
    expect(sized.paragraphs[0].runs[0].props).toMatchObject({ anchor: true });
    expect(sized.paragraphs[0].runs[0].props.objectWidth ?? 0).toBe(0);
    for (const wrap of ['topBottom', 'none', 'square', 'behind'] as const) {
      const made = setPictureWrap(setPictureWrap(doc, at, 'none'), at, wrap);
      expect(pictureWrap(made, at)).toBe(wrap);
      expect(floatAt(made, at)).toMatchObject({ wrap: wrap === 'behind' ? 'none' : wrap, behind: wrap === 'behind' });
      // The room it keeps round it is still said, on the anchor.
      expect(made.paragraphs[0].runs[0].props.object).toMatch(/<wp:extent [^>]*\/><wp:wrap\w+[^>]*\/><a:graphic>/);
    }
    expect(setPictureWrap(doc, at, 'square')).toBe(doc);
    // One under the text is drawn before it: the layout says so.
    expect(layoutDocument(setPictureWrap(doc, at, 'behind'), measurer).pages[0].floats[0].behind).toBe(true);
    expect(layoutDocument(doc, measurer).pages[0].floats[0].behind).toBeUndefined();
    // One that was centred is from then on at a distance.
    const centred = createDoc([p('x', floating(drawing('wrapNone', 0, 0, 100, 50).replace('<wp:posOffset>0</wp:posOffset></wp:positionH>', '<wp:align>center</wp:align></wp:positionH>')))]);
    const room = centred.page.width - centred.page.marginLeft - centred.page.marginRight;
    expect(floatAt(centred, at)!.alignX).toBe('center');
    expect(floatAt(moveFloat(centred, at, 10, 0), at)).toMatchObject({ x: (room - 100) / 2 + 10 });
    expect(floatAt(moveFloat(centred, at, 10, 0), at)!.alignX).toBeUndefined();
  });
});

describe('the text of a line', () => {
  it('sits at the top of its line, with the room its line spacing leaves under it', () => {
    // Lines 20 tall whose text is 10: Word puts the text first and the room after.
    const layout = layoutDocument(createDoc([{ props: { lineHeight: 2, spacingAfter: 0 }, runs: [{ text: 'x\nx', props: { fontSize: 10 } }] }]), measurer);
    const { marginTop } = createDoc().page;
    expect(layout.lines.map((line) => [line.y - marginTop, line.height, line.baseline - line.y])).toEqual([
      [0, 20, 8],
      [20, 20, 8],
    ]);
    // A spacing under single takes from above and below alike.
    const tight = layoutDocument(createDoc([{ props: { lineHeight: 0.8 }, runs: [{ text: 'x', props: { fontSize: 10 } }] }]), measurer);
    expect(tight.lines[0].baseline - tight.lines[0].y).toBeCloseTo(7, 5);
  });

  it('fits on a page when its text does, the room its line spacing leaves under it past the foot', () => {
    const para: Paragraph = { props: { lineHeight: 2, spacingAfter: 0, widowControl: false }, runs: [{ text: Array.from({ length: 8 }, () => 'x').join('\n'), props: { fontSize: 10 } }] };
    const fits = (height: number) => layoutDocument({ ...createDoc([para]), page: { ...createDoc().page, height: 72 + height + 72, marginTop: 72, marginBottom: 72 } }, measurer).pages[0].lines.length;
    // Lines of 20, double spacing of text 10 tall: the fifth starts at 80 and its text ends at 90, so it is in from 90 on. Measured against Word, which sets 26 lines of double spacing on a page with room for 25.6.
    expect(fits(100)).toBe(5);
    expect(fits(90)).toBe(5);
    expect(fits(89.9)).toBe(4);
  });

  it('fits a single-spaced line only when the whole of it does', () => {
    const para: Paragraph = { props: { lineHeight: 1, spacingAfter: 0, widowControl: false }, runs: [{ text: Array.from({ length: 8 }, () => 'x').join('\n'), props: { fontSize: 10 } }] };
    const fits = (height: number) => layoutDocument({ ...createDoc([para]), page: { ...createDoc().page, height: 72 + height + 72, marginTop: 72, marginBottom: 72 } }, measurer).pages[0].lines.length;
    // Five lines of 10 need 50; a fifth that runs a fifth of a point past goes on, as in Word.
    expect(fits(50)).toBe(5);
    expect(fits(49.8)).toBe(4);
  });
});

describe('a picture that changes how it sits in the text', () => {
  const png = new Uint8Array(8);
  const start = () => insertImage(createDoc([p('Uno'), p('Dos tres'), p('Cuatro')]), { para: 1, offset: 4 }, { bytes: png, type: 'image/png', width: 100, height: 50 }).doc;
  const at = { para: 1, offset: 4 };

  it('goes from the line to floating and back', () => {
    const doc = start();
    expect(pictureWrap(doc, at)).toBe('inline');
    const floating = setPictureWrap(doc, at, 'square');
    expect(pictureWrap(floating, at)).toBe('square');
    expect(pictureAt(floating, at)).toBeUndefined();
    // It is the same picture, the same size, now measured from its paragraph; in the line it takes no room.
    expect(floatAt(floating, at)).toMatchObject({ width: 100, height: 50, x: 0, y: 0, fromX: 'column', fromY: 'paragraph', wrap: 'square', behind: false });
    expect(floating.paragraphs[1].runs.map((run) => run.text).join('')).toBe('Dos \u2060tres');
    const layout = layoutDocument(floating, measurer);
    expect(layout.pages[0].floats).toEqual([expect.objectContaining({ width: 100, height: 50, para: 1, offset: 4 })]);
    expect(layout.lines.flatMap((line) => line.fragments).some((f) => f.kind === 'object' && f.width > 0)).toBe(false);
    expect(pictureWrap(setPictureWrap(doc, at, 'behind'), at)).toBe('behind');
    // And back: in the line again, with the room it takes.
    const back = setPictureWrap(floating, at, 'inline');
    expect(pictureWrap(back, at)).toBe('inline');
    expect(back.paragraphs[1].runs.find((run) => run.props.object)!.props).toMatchObject({ objectWidth: 100, objectHeight: 50, anchor: false });
    expect(back.paragraphs[1].runs.find((run) => run.props.object)!.props.object).toBe(doc.paragraphs[1].runs.find((run) => run.props.object)!.props.object);
    expect(layoutDocument(back, measurer).pages[0].floats).toEqual([]);
    // Both are carried by a DOCX.
    for (const made of [floating, setPictureWrap(doc, at, 'behind'), back]) expect(pictureWrap(importDocx(exportDocx(made)), at)).toBe(pictureWrap(made, at));
    expect(setPictureWrap(doc, { para: 0, offset: 0 }, 'square')).toBe(doc);
  });

  it('is anchored somewhere else', () => {
    const floating = setPictureWrap(start(), at, 'square');
    const moved = reanchorFloat(floating, at, { para: 2, offset: 0 });
    expect(moved.pos).toEqual({ para: 2, offset: 0 });
    expect(moved.doc.paragraphs.map((para) => para.runs.map((run) => run.text).join(''))).toEqual(['Uno', 'Dos tres', '\u2060Cuatro']);
    expect(floatAt(moved.doc, moved.pos)).toMatchObject({ width: 100, wrap: 'square' });
    expect(layoutDocument(moved.doc, measurer).pages[0].floats[0]).toMatchObject({ para: 2, offset: 0 });
    // Within its own paragraph, and to where it already is.
    expect(reanchorFloat(floating, at, { para: 1, offset: 0 }).pos).toEqual({ para: 1, offset: 0 });
    expect(reanchorFloat(floating, at, { para: 1, offset: 8 }).pos).toEqual({ para: 1, offset: 7 });
    expect(reanchorFloat(floating, at, at).doc).toBe(floating);
    expect(reanchorFloat(floating, { para: 0, offset: 0 }, { para: 2, offset: 0 }).doc).toBe(floating);
  });
});

describe('a first page with a header of its own', () => {
  const part = (root: string, body: string) => strToU8(`<w:${root} ${W}>${body}</w:${root}>`);
  const para = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
  const rels = (...targets: [string, string, string][]) =>
    strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${targets.map(([id, type, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join('')}</Relationships>`,
    );
  const file = (titlePg: string) =>
    zipSync({
      'word/document.xml': part(
        'document',
        `<w:body>${Array.from({ length: 140 }, (_, i) => para(`Línea ${i}`)).join('')}<w:sectPr><w:headerReference w:type="first" r:id="rId1"/><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/>${titlePg}</w:sectPr></w:body>`,
      ),
      'word/_rels/document.xml.rels': rels(['rId1', 'header', 'header2.xml'], ['rId2', 'header', 'header1.xml'], ['rId3', 'footer', 'footer1.xml']),
      'word/header1.xml': part(
        'hdr',
        '<w:p><w:r><w:t>Página </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/><w:instrText>PAGE</w:instrText><w:fldChar w:fldCharType="separate"/><w:fldChar w:fldCharType="end"/></w:r></w:p>',
      ),
      'word/header2.xml': part('hdr', `<w:p><w:r><w:t>Portada</w:t></w:r><w:r>${drawing('wrapSquare', 300, 0, 50, 50)}</w:r></w:p>`),
      'word/_rels/header2.xml.rels': rels(['rId1', 'image', 'media/logo.png']),
      'word/media/logo.png': new Uint8Array([1, 2, 3]),
      'word/footer1.xml': part('ftr', para('Pie')),
    });
  const band = (lines: { fragments: { text: string }[] }[] | undefined) =>
    (lines ?? [])
      .map((line) =>
        line.fragments
          .map((f) => f.text)
          .join('')
          .replace(/⁠/g, ''),
      )
      .join('|');

  it('shows it on the first page, and the usual one on the others', () => {
    const bytes = file('<w:titlePg/>');
    const doc = importDocx(bytes);
    expect(plainText(doc.firstPage!.header!.paragraphs[0].runs).replace(/⁠/g, '')).toBe('Portada');
    // The first page has no footer of its own: it shows none.
    expect(doc.firstPage!.footer).toBeUndefined();
    const layout = layoutDocument(doc, measurer);
    expect(layout.pages.length).toBeGreaterThan(2);
    expect(layout.pages.map((page) => band(page.header?.lines))).toEqual(['Portada', ...layout.pages.slice(1).map((_, i) => `Página ${i + 2}`)]);
    expect(layout.pages.map((page) => band(page.footer?.lines))).toEqual(['', ...layout.pages.slice(1).map(() => 'Pie')]);
    // Its picture is found in its own part.
    expect(layout.pages[0].header).toMatchObject({ part: 'firstHeader', floats: [{ part: 'firstHeader', width: 50 }] });
    expect(doc.source!.firstHeaderPath).toBe('word/header2.xml');
    // It is written back as it was, whatever is done to the text.
    const edited = unzipSync(exportDocx(insertText(doc, { para: 0, offset: 0 }, 'X').doc));
    const was = unzipSync(bytes);
    for (const name of ['word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/_rels/header2.xml.rels']) expect(strFromU8(edited[name])).toBe(strFromU8(was[name]));
    expect(strFromU8(edited['word/document.xml'])).toContain('<w:headerReference w:type="first" r:id="rId1"/>');
    expect(strFromU8(edited['word/document.xml'])).toContain('<w:titlePg/>');
    expect(importDocx(exportDocx(doc)).firstPage!.header).toBeDefined();
  });

  it('can be changed, and is written to its own part', () => {
    const bytes = file('<w:titlePg/>');
    const doc = importDocx(bytes);
    const was = unzipSync(bytes);
    // Its header, seen as a document of its own, with a word put in.
    const view = { ...doc, paragraphs: storyOf(doc, 'firstHeader')!.paragraphs, tables: undefined };
    const changed = withStory(doc, 'firstHeader', { paragraphs: insertText(view, { para: 0, offset: 0 }, 'Gran ').doc.paragraphs });
    expect(changed.header).toBe(doc.header);
    const files = unzipSync(exportDocx(changed));
    expect(strFromU8(files['word/header2.xml'])).toContain('Gran Portada');
    // Its picture stays, the header of the other pages is not touched, and neither is the text.
    expect(strFromU8(files['word/header2.xml'])).toContain('<wp:anchor');
    for (const name of ['word/header1.xml', 'word/footer1.xml', 'word/document.xml']) expect(strFromU8(files[name])).toBe(strFromU8(was[name]));
    const back = importDocx(exportDocx(changed));
    expect(plainText(back.firstPage!.header!.paragraphs[0].runs).replace(/⁠/g, '')).toBe('Gran Portada');
    expect(band(layoutDocument(back, measurer).pages[0].header?.lines)).toBe('Gran Portada');

    // A footer of its own, which it did not have: it gets a part, and the section names it as the first page's.
    const footed = withStory(doc, 'firstFooter', { paragraphs: [p('Pie de portada')] });
    const made = unzipSync(exportDocx(footed));
    expect(strFromU8(made['word/document.xml'])).toMatch(/<w:footerReference w:type="first" r:id="rId\d+"\/>/);
    expect(strFromU8(made['word/document.xml'])).toContain('<w:footerReference w:type="default" r:id="rId3"/>');
    const again = importDocx(exportDocx(footed));
    expect(plainText(again.firstPage!.footer!.paragraphs[0].runs)).toBe('Pie de portada');
    expect(plainText(again.footer!.paragraphs[0].runs)).toBe('Pie');
    expect(
      layoutDocument(again, measurer)
        .pages.slice(0, 2)
        .map((page) => band(page.footer?.lines)),
    ).toEqual(['Pie de portada', 'Pie']);
  });

  it('can be given to a document, and taken from it', () => {
    // One that had none: the section says so from then on, with or without a part for it.
    const plain = importDocx(file(''));
    const given = { ...plain, firstPage: {} };
    expect(band(layoutDocument(given, measurer).pages[0].header?.lines)).toBe('');
    expect(band(layoutDocument(given, measurer).pages[1].header?.lines)).toBe('Página 2');
    const xml = strFromU8(unzipSync(exportDocx(given))['word/document.xml']);
    expect(xml).toMatch(/<w:titlePg\/><\/w:sectPr>/);
    const back = importDocx(exportDocx(given));
    expect(back.firstPage).toEqual({});
    // Taken away: the first page shows what every page shows, and the part it had is left alone.
    const own = importDocx(file('<w:titlePg/>'));
    const { firstPage: _, ...taken } = own;
    const files = unzipSync(exportDocx(taken));
    expect(strFromU8(files['word/document.xml'])).not.toContain('titlePg');
    expect(strFromU8(files['word/header2.xml'])).toBe(strFromU8(unzipSync(file('<w:titlePg/>'))['word/header2.xml']));
    expect(importDocx(exportDocx(taken)).firstPage).toBeUndefined();
    // A new document says it too.
    expect(strFromU8(unzipSync(exportDocx({ ...createDoc([p('Uno')]), firstPage: { header: { paragraphs: [p('Portada')] } } }))['word/document.xml'])).toMatch(
      /<w:headerReference w:type="first"[^>]*\/>.*<w:titlePg\/>/,
    );
  });

  it('is the usual one when the document does not ask for another', () => {
    for (const titlePg of ['', '<w:titlePg w:val="0"/>']) {
      const doc = importDocx(file(titlePg));
      expect(doc.firstPage).toBeUndefined();
      expect(band(layoutDocument(doc, measurer).pages[0].header?.lines)).toBe('Página 1');
    }
  });

  it('gives a number to a page number written with nothing in it', () => {
    const doc = importDocx(file(''));
    expect(doc.header!.paragraphs[0].runs.filter((run) => run.props.field)).toEqual([expect.objectContaining({ text: '1', props: expect.objectContaining({ field: 'PAGE' }) })]);
    expect(strFromU8(unzipSync(exportDocx(doc))['word/header1.xml'])).toBe(strFromU8(unzipSync(file(''))['word/header1.xml']));
  });
});
