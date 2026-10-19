import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type TextMeasurer,
  createDoc,
  deleteRange,
  exportDocx,
  footnoteNumbers,
  footnoteReferences,
  importDocx,
  insertFootnote,
  layoutDocument,
  storyOf,
  withStory,
} from '../src';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

// Monospace fake: every character is half the font size wide; a 10pt line is 10pt tall.
const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

const ref = (id: number) => `<w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r>`;
const p = (text: string, extra = '') => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r>${extra}</w:p>`;
const note = (id: number, ...lines: string[]) =>
  `<w:footnote w:id="${id}">${lines.map((text, k) => `<w:p>${k ? '' : '<w:r><w:footnoteRef/></w:r>'}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`).join('')}</w:footnote>`;

/**
 * A page 300 tall with 50 of margin above and below: 200 for the text, twenty
 * lines of 10pt. The separator is a 10pt line too.
 */
function open(body: string, notes: string): Doc {
  const document = `<w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="6000" w:h="6000"/><w:pgMar w:top="1000" w:right="200" w:bottom="1000" w:left="200"/></w:sectPr></w:body></w:document>`;
  const styles = `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
  const footnotes = `<w:footnotes ${W}><w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>${notes}</w:footnotes>`;
  const rels =
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/></Relationships>';
  return importDocx(
    zipSync({
      'word/document.xml': strToU8(document),
      'word/styles.xml': strToU8(styles),
      'word/footnotes.xml': strToU8(footnotes),
      'word/_rels/document.xml.rels': strToU8(rels),
    }),
  );
}

const lines = (n: number, from = 0) => Array.from({ length: n }, (_, i) => p(`line ${from + i}`)).join('');
/** Each page: the first line of its text, and each note at its foot with the text of its lines. */
const pages = (doc: Doc) =>
  layoutDocument(doc, measurer).pages.map((page) => ({
    first: page.lines[0]?.fragments.filter((f) => !f.mark).map((f) => f.text).join(''),
    notes: page.footnotes?.notes.map((band) => `${band.id}:${band.lines.length}`) ?? [],
  }));

describe('notes at the foot of the page', () => {
  it('reads the notes, and numbers them in the order of their references', () => {
    const doc = open(p('a', ref(5)) + p('b', ref(2)), note(2, ' second') + note(5, ' first'));
    expect(doc.footnotes?.map((n) => n.id)).toEqual(['2', '5']);
    expect([...footnoteNumbers(doc)]).toEqual([['5', 1], ['2', 2]]);
    const [line] = layoutDocument(doc, measurer).lines;
    // The reference shows its number, smaller and raised; it does not make the line taller.
    const mark = line.fragments.find((f) => f.mark)!;
    expect(mark.mark).toMatchObject({ text: '1', font: { size: 6.5 } });
    expect(mark.mark!.rise).toBeCloseTo(3.5);
    expect(line.height).toBe(10);
    const area = layoutDocument(doc, measurer).pages[0].footnotes!;
    expect(area.notes.map((n) => n.lines[0].fragments.map((f) => f.mark?.text ?? f.text).join(''))).toEqual(['1 first', '2 second']);
    // The line above them, two inches long, at the top of their room at the foot of the page.
    expect(area.rule).toMatchObject({ x: 10, width: 144 });
    expect(area.notes[1].lines[0].y + 10).toBe(250);
  });

  it('keeps the line of a reference on the page its note goes on, and cuts a long note to go on at the foot of the next', () => {
    // 17 lines, then one whose note is a paragraph of three lines: it does not fit with them, and cannot be cut leaving
    // no line alone, so the line goes to the next page with it.
    const words = (n: number) => 'n1 '.repeat(n).trim();
    const long = open(lines(17) + p('with a note', ref(1)) + lines(5, 17), note(1, words(50)));
    expect(pages(long)).toEqual([
      { first: 'line 0', notes: [] },
      { first: 'with a note', notes: ['1:3'] },
    ]);
    // One line fewer before it, and a note of four lines: two of them fit, the line stays, and the other two go on at the foot of the next page.
    const cut = open(lines(16) + p('with a note', ref(1)) + lines(5, 16), note(1, words(70)));
    const laid = pages(cut);
    expect(laid[0]).toEqual({ first: 'line 0', notes: ['1:2'] });
    expect(laid[1].notes).toEqual(['1:2']);
  });

  it('writes back only what changed, and drops a note whose reference went', () => {
    const doc = open(p('a', ref(1)) + p('b', ref(2)), note(1, ' one') + note(2, ' two'));
    const untouched = unzipSync(exportDocx(doc));
    expect(strFromU8(untouched['word/footnotes.xml'])).toContain('w:id="2"');
    // The first reference goes, and the second note says something else.
    const [first] = footnoteReferences(doc);
    let edited = deleteRange(doc, { from: { para: first.para, offset: first.offset }, to: { para: first.para, offset: first.offset + 1 } });
    const two = storyOf(edited, 'footnote:2')!;
    edited = withStory(edited, 'footnote:2', { paragraphs: [{ ...two.paragraphs[0], runs: [two.paragraphs[0].runs[0], { text: ' changed', props: {} }] }] });
    const back = importDocx(exportDocx(edited));
    expect(back.footnotes?.map((n) => [n.id, n.paragraphs[0].runs.map((r) => r.text).join('')])).toEqual([['2', '⁠ changed']]);
    expect(strFromU8(unzipSync(exportDocx(edited))['word/footnotes.xml'])).toContain('w:type="separator"');
  });

  it('puts notes in a new document, with their part, and reads them back', () => {
    let doc = createDoc([{ props: {}, runs: [{ text: 'Some text here.', props: {} }] }]);
    doc = insertFootnote(doc, { para: 0, offset: 4 }, 'Second in the text.').doc;
    const made = insertFootnote(doc, { para: 0, offset: 0 }, 'First in the text.');
    expect(made.pos).toEqual({ para: 0, offset: 1 });
    const files = unzipSync(exportDocx(made.doc));
    expect(strFromU8(files['[Content_Types].xml'])).toContain('footnotes+xml');
    expect(strFromU8(files['word/_rels/document.xml.rels'])).toContain('/footnotes');
    const back = importDocx(exportDocx(made.doc));
    expect([...footnoteNumbers(back)]).toEqual([['2', 1], ['1', 2]]);
    expect(layoutDocument(back, measurer).pages[0].footnotes?.notes.map((n) => n.id)).toEqual(['2', '1']);
  });
});
