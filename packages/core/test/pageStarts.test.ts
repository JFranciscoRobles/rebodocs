// Where text goes when a page starts, as measured against Word with contracts
// made for it (tools/contract-cases.ts, npm run word-compare).

import { describe, expect, it } from 'vitest';
import { type Doc, type FontSpec, type Paragraph, type ParagraphProps, type TextMeasurer, createDoc, layoutDocument } from '../src/internal';

// Every letter half as wide as its size; 10 pt text, 5 pt a letter, lines 10 pt tall.
const measurer: TextMeasurer = {
  width: (text: string, font: FontSpec) => text.length * font.size * 0.5,
  metrics: (font: FontSpec) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};
// 100 pt of text a line, 20 letters; 100 pt of page, ten lines.
const PAGE = { width: 120, height: 120, marginTop: 10, marginRight: 10, marginBottom: 10, marginLeft: 10 };
const p = (text: string, props: ParagraphProps = {}): Paragraph => ({ props: { spacingBefore: 0, spacingAfter: 0, lineHeight: 1, ...props }, runs: [{ text, props: { fontSize: 10 } }] });
const doc = (paragraphs: Paragraph[]): Doc => createDoc(paragraphs, PAGE);
/** The page each paragraph starts on, from 0, and the height of its first line. */
const starts = (d: Doc) => {
  const layout = layoutDocument(d, measurer);
  return d.paragraphs.map((_, i) => {
    const line = layout.lines[layout.paraFirstLine[i]];
    return { page: line.page, y: line.y };
  });
};
const line = (n: number) => Array.from({ length: n }, () => 'aaaa bbbb cccc dddd').join(' ');

describe('a heading kept with the paragraph after it', () => {
  it('goes to the next page with a paragraph whose lines are kept together, when that one does not fit', () => {
    // Seven lines of text; a heading; a paragraph of three lines that must stay whole, with room for two.
    const d = doc([p(line(7)), p('Heading', { keepNext: true }), p(line(3), { keepLines: true })]);
    const [, heading, after] = starts(d);
    expect(after.page).toBe(1);
    // Not left alone at the foot of the page: it goes with it.
    expect(heading.page).toBe(1);
  });

  it('stays where it is when the paragraph after it can start there, however its lines go', () => {
    // Four lines with room for two: two here and two on the next, which widow control lets be.
    const d = doc([p(line(7)), p('Heading', { keepNext: true }), p(line(4))]);
    const [, heading, after] = starts(d);
    expect(heading.page).toBe(0);
    expect(after.page).toBe(0);
  });
});

describe('the space above a paragraph that starts a page', () => {
  it('is what it asks for less the space below the paragraph before, when it asks for the page', () => {
    // 20 pt above, after a paragraph with 8 below: Word starts it 12 pt down from the margin.
    const [, , broken] = starts(doc([p('Uno', { spacingAfter: 8 }), p('Dos', { spacingAfter: 8 }), p('Tres', { spacingBefore: 20, pageBreakBefore: true })]));
    expect(broken.page).toBe(1);
    expect(broken.y).toBeCloseTo(PAGE.marginTop + 12);
    // No more than it asks for: none when the space below is larger.
    const [, , none] = starts(doc([p('Uno'), p('Dos', { spacingAfter: 30 }), p('Tres', { spacingBefore: 20, pageBreakBefore: true })]));
    expect(none.y).toBeCloseTo(PAGE.marginTop);
  });

  it('is none at the top of a page the text came to by itself', () => {
    const d = doc([p(line(10)), p('Sigue', { spacingBefore: 20 })]);
    const [, next] = starts(d);
    expect(next.page).toBe(1);
    expect(next.y).toBeCloseTo(PAGE.marginTop);
  });
});
