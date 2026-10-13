import { describe, expect, it } from 'vitest';
import { type FontSpec, type Paragraph, type Run, caretRect, createDoc, hitTest, insertTable, layoutDocument, layoutReflow, reflowDoc } from '../src';

/** Every character as wide as half its font size: enough to see where things land. */
const measurer = {
  width: (text: string, font: FontSpec) => text.length * font.size * 0.5,
  metrics: (font: FontSpec) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};
const EMU = 12700;
const W = 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
const anchored = (width: number, height: number, behind = false): Run => ({
  text: '⁠',
  props: {
    anchor: true,
    object:
      `<w:r><w:drawing ${W}><wp:anchor behindDoc="${behind ? 1 : 0}"><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>` +
      `<wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${width * EMU}" cy="${height * EMU}"/>` +
      `<wp:${behind ? 'wrapNone' : 'wrapSquare'}/><a:graphic/></wp:anchor></w:drawing></w:r>`,
  },
});
const words = (count: number) => Array.from({ length: count }, () => 'palabra').join(' ');
const p = (text: string, props: Paragraph['props'] = {}, ...more: Run[]): Paragraph => ({ props, runs: [...more, { text, props: {} }] });

describe('the document on a screen', () => {
  it('sets the text to the width of the screen, down one page as tall as it takes', () => {
    const doc = createDoc(Array.from({ length: 40 }, () => p(words(40))));
    expect(layoutDocument(doc, measurer).pages.length).toBeGreaterThan(1);
    const layout = layoutReflow(doc, measurer, { width: 300, margin: 10 });
    expect(layout.pages).toHaveLength(1);
    expect(layout.page.width).toBe(300);
    for (const line of layout.lines) expect(line.x + line.width).toBeLessThanOrEqual(290.01);
    const last = layout.lines[layout.lines.length - 1];
    expect(layout.page.height).toBeGreaterThanOrEqual(last.y + last.height + 10);
    expect(Number.isFinite(layout.page.height)).toBe(true);
  });

  it('keeps the paragraphs and their positions, so a place in it is a place in the document', () => {
    const doc = createDoc([p(words(30)), p('uno dos tres')]);
    const layout = layoutReflow(doc, measurer, { width: 280 });
    expect(new Set(layout.lines.map((line) => line.para))).toEqual(new Set([0, 1]));
    const caret = caretRect(layout, measurer, { para: 1, offset: 4 });
    expect(hitTest(layout, measurer, 0, caret.x + 0.1, caret.y + 1)).toEqual({ para: 1, offset: 4 });
    // A paragraph nothing had to be done to is the very same one, so what was worked out for it is kept.
    expect(reflowDoc(doc, { width: 280 }).paragraphs[1]).toBe(doc.paragraphs[1]);
  });

  it('does not start another page where the document asks for one', () => {
    const doc = createDoc([p('antes\fdespués'), p('otra', { pageBreakBefore: true })]);
    expect(layoutDocument(doc, measurer).pages).toHaveLength(3);
    const layout = layoutReflow(doc, measurer, { width: 300 });
    expect(layout.pages).toHaveLength(1);
    const ys = layout.lines.map((line) => line.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it('narrows a table to the screen, and leaves one with too many columns wider than it', () => {
    const two = insertTable(createDoc([p('')]), { para: 0, offset: 0 }, 2, 2).doc;
    const narrow = layoutReflow(two, measurer, { width: 300, margin: 10 });
    expect(narrow.page.width).toBe(300);
    for (const cell of narrow.pages[0].cells) expect(cell.x + cell.width).toBeLessThanOrEqual(290.01);

    const eight = insertTable(createDoc([p(words(30))]), { para: 0, offset: 0 }, 2, 8).doc;
    const wide = layoutReflow(eight, measurer, { width: 300, margin: 10 });
    // Its columns would be 35 points each: it stays as wide as on its page, 468, with the margin on each side.
    expect(wide.page.width).toBeCloseTo(468 + 20);
    expect(Math.max(...wide.pages[0].cells.map((cell) => cell.x + cell.width))).toBeCloseTo(10 + 468);

    const five = insertTable(createDoc([p('')]), { para: 0, offset: 0 }, 1, 5).doc;
    // Five columns are brought down to 64 points each and no further.
    expect(layoutReflow(five, measurer, { width: 300, margin: 10 }).page.width).toBeCloseTo(5 * 64 + 20);
    // The text outside the table still keeps to the screen.
    for (const line of wide.lines.filter((l) => l.cell === undefined)) expect(line.x + line.width).toBeLessThanOrEqual(290.01);
  });

  it('puts a floating picture in its line, no wider than the screen, and leaves out one that is under the text', () => {
    const doc = createDoc([p('texto', {}, anchored(600, 300)), p('fondo', {}, anchored(612, 792, true))]);
    const layout = layoutReflow(doc, measurer, { width: 320, margin: 10 });
    expect(layout.pages[0].floats).toHaveLength(0);
    const pictures = layout.lines.flatMap((line) => line.fragments.filter((f) => f.kind === 'object' && f.width > 0));
    expect(pictures).toHaveLength(1);
    expect(pictures[0].width).toBeCloseTo(300);
    expect(pictures[0].ascent).toBeCloseTo(150);
  });

  it('brings in the indents that would leave no room for the text', () => {
    const doc = createDoc([p(words(20), { indentLeft: 216 }), p(words(20), { indentLeft: 36, indentFirstLine: -18 })]);
    const made = reflowDoc(doc, { width: 258, margin: 12 });
    // The text is half as wide as on its page: what an indent has over 36 points is halved.
    expect(made.paragraphs[0].props.indentLeft).toBeCloseTo(36 + (216 - 36) * 0.5);
    expect(made.paragraphs[1]).toBe(doc.paragraphs[1]);
  });
});
