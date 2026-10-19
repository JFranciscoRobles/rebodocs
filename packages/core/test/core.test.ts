import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type FontSpec,
  type TextMeasurer,
  applyRunProps,
  caretRect,
  createDoc,
  createParagraph,
  deleteRange,
  docText,
  exportDocx,
  hitTest,
  importDocx,
  insertFragment,
  insertText,
  layoutDocument,
  lineForPosition,
  parseXml,
  selectionRects,
  setParagraphProps,
  splitParagraph,
} from '../src';

// Monospace fake: every character is half the font size wide.
const measurer: TextMeasurer = {
  width: (text: string, font: FontSpec) => text.length * font.size * 0.5,
  metrics: (font: FontSpec) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

// 10pt text -> 5pt per char, 10pt lines; 100pt content width -> 20 chars per line; 5 lines per page.
const PAGE = { width: 120, height: 70, marginTop: 10, marginRight: 10, marginBottom: 10, marginLeft: 10 };
const RUN = { fontSize: 10 };
const PARA = { spacingAfter: 0, lineHeight: 1 };

function docOf(...texts: string[]): Doc {
  return createDoc(
    texts.map((t) => createParagraph(t, RUN, PARA)),
    PAGE,
  );
}

describe('xml', () => {
  it('keeps whitespace, decodes entities and handles self-closing tags', () => {
    const root = parseXml('<?xml version="1.0"?><a x="1 &amp; 2"><b/><t xml:space="preserve"> &lt;hi&gt; </t></a>');
    const a = root.children[0];
    expect(a.attrs.x).toBe('1 & 2');
    expect(a.children.map((c) => c.name)).toEqual(['b', 't']);
    expect(a.children[1].children[0].text).toBe(' <hi> ');
  });
});

describe('ops', () => {
  it('inserts, splits and deletes across paragraphs', () => {
    let doc = docOf('hello world');
    doc = insertText(doc, { para: 0, offset: 5 }, ',').doc;
    expect(docText(doc)).toBe('hello, world');
    doc = splitParagraph(doc, { para: 0, offset: 6 }).doc;
    expect(docText(doc)).toBe('hello,\n world');
    doc = deleteRange(doc, { from: { para: 0, offset: 5 }, to: { para: 1, offset: 1 } });
    expect(docText(doc)).toBe('helloworld');
    expect(doc.paragraphs).toHaveLength(1);
  });

  it('splits runs when formatting a sub-range and merges them back', () => {
    const range = { from: { para: 0, offset: 6 }, to: { para: 0, offset: 11 } };
    let doc = applyRunProps(docOf('hello world'), range, { bold: true });
    expect(doc.paragraphs[0].runs.map((r) => r.text)).toEqual(['hello ', 'world']);
    expect(doc.paragraphs[0].runs[1].props.bold).toBe(true);
    doc = applyRunProps(doc, range, { bold: false });
    expect(doc.paragraphs[0].runs).toHaveLength(1);
  });

  it('turns newlines of pasted text into paragraphs', () => {
    const { doc, pos } = insertFragment(docOf('ab'), { para: 0, offset: 1 }, 'x\r\ny\nz');
    expect(docText(doc)).toBe('ax\ny\nzb');
    expect(pos).toEqual({ para: 2, offset: 1 });
  });

  it('keeps one empty run when a paragraph is emptied', () => {
    const doc = deleteRange(docOf('abc'), { from: { para: 0, offset: 0 }, to: { para: 0, offset: 3 } });
    expect(doc.paragraphs[0].runs).toEqual([{ text: '', props: RUN }]);
  });
});

describe('layout', () => {
  it('wraps at word boundaries and lets trailing spaces hang', () => {
    const layout = layoutDocument(docOf('aaaa bbbb cccc dddd eeee'), measurer);
    expect(layout.lines.map((l) => [l.start, l.end])).toEqual([
      [0, 20],
      [20, 24],
    ]);
    expect(layout.lines[0].width).toBe(95);
  });

  it('breaks a word longer than the line by characters', () => {
    const layout = layoutDocument(docOf('x'.repeat(45)), measurer);
    expect(layout.lines.map((l) => l.end - l.start)).toEqual([20, 20, 5]);
  });

  it('does not break a word split across runs', () => {
    const doc = docOf('');
    doc.paragraphs[0].runs = [
      { text: 'aaaaaaaa bbbbbbbb cc', props: RUN },
      { text: 'cc', props: { ...RUN, bold: true } },
    ];
    const layout = layoutDocument(doc, measurer);
    expect(layout.lines.map((l) => [l.start, l.end])).toEqual([
      [0, 18],
      [18, 22],
    ]);
  });

  it('paginates and honours page breaks', () => {
    const layout = layoutDocument(docOf('1', '2', '3', '4', '5', '6', 'a\fb'), measurer);
    expect(layout.lines.map((l) => l.page)).toEqual([0, 0, 0, 0, 0, 1, 1, 2]);
    expect(layout.pages).toHaveLength(3);
    expect(layout.lines[5].y).toBe(10);
  });

  it('never leaves the first or the last line of a paragraph alone on a page', () => {
    const three = 'aaaa bbbb cccc dddd eeee ffff gggg hhhh iiii jjjj kkkk';
    const four = `${three} llll mmmm nnnn oooo`;
    const pagesOf = (doc: Doc) => layoutDocument(doc, measurer).lines.map((l) => l.page);
    // Two of the three lines fit; taking the middle one along would leave the first alone, so all three move.
    expect(pagesOf(docOf('1', '2', '3', three))).toEqual([0, 0, 0, 1, 1, 1]);
    // Three of four lines fit: the last one takes the third with it.
    expect(pagesOf(docOf('1', '2', four))).toEqual([0, 0, 0, 0, 1, 1]);
    const off = docOf('1', '2', '3', three);
    off.paragraphs[3].props = { ...PARA, widowControl: false };
    expect(pagesOf(off)).toEqual([0, 0, 0, 0, 0, 1]);
    // Keep lines together moves the whole paragraph instead.
    off.paragraphs[3].props = { ...PARA, widowControl: false, keepLines: true };
    expect(pagesOf(off)).toEqual([0, 0, 0, 1, 1, 1]);
    // A paragraph taller than a page starts where it is and fills every page it crosses.
    expect(pagesOf(docOf('1', `${four} ${four} ${four}`))).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2]);
  });

  it('leaves the larger of space after and space before between two paragraphs', () => {
    const doc = docOf('a', 'b', 'c');
    doc.paragraphs[0].props = { ...PARA, spacingAfter: 4 };
    doc.paragraphs[1].props = { ...PARA, spacingBefore: 6, spacingAfter: 6 };
    doc.paragraphs[2].props = { ...PARA, spacingBefore: 2 };
    // 10pt lines: after 'a' the larger of 4 and 6, after 'b' the larger of 6 and 2.
    expect(layoutDocument(doc, measurer).lines.map((l) => l.y)).toEqual([10, 26, 42]);
  });

  it('keeps a paragraph with the start of the next one', () => {
    const pagesOf = (doc: Doc) => layoutDocument(doc, measurer).lines.map((l) => l.page);
    const doc = docOf('1', '2', '3', 'heading', 'kept too', 'body');
    expect(pagesOf(doc)).toEqual([0, 0, 0, 0, 0, 1]);
    doc.paragraphs[4].props = { ...PARA, keepNext: true };
    expect(pagesOf(doc)).toEqual([0, 0, 0, 0, 1, 1]);
    // A run of kept paragraphs moves together.
    doc.paragraphs[3].props = { ...PARA, keepNext: true };
    expect(pagesOf(doc)).toEqual([0, 0, 0, 1, 1, 1]);
    // A run that would not fit on a page either is left where it is.
    for (const para of doc.paragraphs) para.props = { ...PARA, keepNext: true };
    expect(pagesOf(doc)).toEqual([0, 0, 0, 0, 0, 1]);
  });

  it('adds an empty line after a trailing line break', () => {
    const layout = layoutDocument(docOf('ab\n'), measurer);
    expect(layout.lines.map((l) => [l.start, l.end])).toEqual([
      [0, 3],
      [3, 3],
    ]);
  });

  it('aligns and justifies', () => {
    const doc = docOf('aaaa bbbb cccc dddd eeee');
    doc.paragraphs[0].props = { ...PARA, align: 'justify' };
    const justified = layoutDocument(doc, measurer);
    // 95pt visible, 5pt slack over 3 gaps; the last line stays ragged.
    expect(justified.lines[0].fragments[0].wordSpacing).toBeCloseTo(5 / 3);
    expect(justified.lines[0].width).toBeCloseTo(100);
    expect(justified.lines[1].fragments[0].wordSpacing).toBe(0);

    doc.paragraphs[0].props = { ...PARA, align: 'right' };
    const right = layoutDocument(doc, measurer);
    expect(right.lines[1].x).toBe(10 + 100 - 20);
  });

  it('shrinks the spaces of a justified line to take one more word, in documents that ask for Word 2013 layout', () => {
    // 21 characters on a 20-character line: 5pt over, within what five 5pt spaces can give up.
    const text = 'aa bb cc dd ee ffffff gggg';
    const justified = (t: string) => {
      const doc = docOf(t);
      doc.paragraphs[0].props = { ...PARA, align: 'justify' };
      return doc;
    };
    expect(layoutDocument(justified(text), measurer).lines.map((l) => [l.start, l.end])).toEqual([[0, 15], [15, 26]]);
    const modern = layoutDocument({ ...justified(text), compatMode: 15 }, measurer);
    expect(modern.lines.map((l) => [l.start, l.end])).toEqual([[0, 22], [22, 26]]);
    expect(modern.lines[0].fragments[0].wordSpacing).toBeCloseTo(-1);
    expect(modern.lines[0].width).toBeCloseTo(100);
    // Not when leaving the word out would loosen the line about as little as taking it tightens it.
    expect(layoutDocument({ ...justified('aa bb cc dd eeeeeee f gggg'), compatMode: 15 }, measurer).lines[0].end).toBe(20);
    // Too far over for the spaces to absorb, on a line with a tab, or not justified: no shrinking.
    expect(layoutDocument({ ...justified('aa bb cc dd ee fffffff gggg'), compatMode: 15 }, measurer).lines[0].end).toBe(15);
    const tabbed = layoutDocument({ ...justified('a\tb cc dd ee ffffff gggg'), compatMode: 15 }, measurer);
    expect(tabbed.lines[0].fragments.every((f) => f.wordSpacing >= 0)).toBe(true);
    expect(layoutDocument({ ...docOf(text), compatMode: 15 }, measurer).lines[0].end).toBe(15);
  });

  it('maps positions to coordinates and back', () => {
    const doc = docOf('aaaa bbbb cccc dddd eeee', 'second');
    const layout = layoutDocument(doc, measurer);
    expect(caretRect(layout, measurer, { para: 0, offset: 3 })).toMatchObject({ page: 0, x: 25, y: 10, height: 10 });
    // A wrap boundary shows the caret at the start of the next line.
    expect(lineForPosition(layout, { para: 0, offset: 20 }).index).toBe(1);
    expect(hitTest(layout, measurer, 0, 26, 12)).toEqual({ para: 0, offset: 3 });
    expect(hitTest(layout, measurer, 0, 28, 12)).toEqual({ para: 0, offset: 4 });
    // Clicking past the end of a wrapped line stays on that line.
    expect(hitTest(layout, measurer, 0, 500, 12)).toEqual({ para: 0, offset: 19 });
    expect(hitTest(layout, measurer, 0, 500, 32)).toEqual({ para: 1, offset: 6 });
    expect(hitTest(layout, measurer, 0, 0, 500)).toEqual({ para: 1, offset: 0 });
  });

  it('builds one selection rect per line', () => {
    const layout = layoutDocument(docOf('aaaa bbbb cccc dddd eeee', 'second'), measurer);
    const rects = selectionRects(layout, measurer, { from: { para: 0, offset: 18 }, to: { para: 1, offset: 2 } });
    expect(rects.map((r) => [r.x, r.y, r.width])).toEqual([
      [100, 10, 10],
      [10, 20, 24],
      [10, 30, 10],
    ]);
  });
});

describe('docx', () => {
  it('round-trips text, formatting and page setup', () => {
    const doc = createDoc(
      [
        {
          props: { align: 'center', spacingBefore: 12, spacingAfter: 6, lineHeight: 1.5, indentLeft: 36 },
          runs: [
            { text: 'Título <&> ', props: { bold: true, fontSize: 16, fontFamily: 'Georgia', color: 'FF0000' } },
            { text: 'tab\there\nbreak\fpage', props: { italic: true, underline: true, strike: true } },
          ],
        },
        { props: { indentLeft: 36, indentFirstLine: -18, pageBreakBefore: true }, runs: [{ text: '', props: { fontSize: 20 } }] },
        createParagraph('  spaces  '),
      ],
      { width: 595.3, height: 841.9, marginTop: 50, marginRight: 60, marginBottom: 70, marginLeft: 80 },
    );
    const back = importDocx(exportDocx(doc));
    expect(docText(back)).toBe(docText(doc));
    expect(back.page).toMatchObject(doc.page);
    expect(back.page).toMatchObject({ headerDistance: 35.4, footerDistance: 35.4 });
    expect(back.paragraphs[0].props).toMatchObject(doc.paragraphs[0].props);
    expect(back.paragraphs[0].runs[0].props).toMatchObject(doc.paragraphs[0].runs[0].props);
    expect(back.paragraphs[0].runs[1].props).toMatchObject({ italic: true, underline: true, strike: true });
    expect(back.paragraphs[0].runs[1].props.bold).toBeUndefined();
    expect(back.paragraphs[1].props).toMatchObject(doc.paragraphs[1].props);
    expect(back.paragraphs[1].runs[0].props.fontSize).toBe(20);
    // Exporting what was imported yields the same document again.
    expect(importDocx(exportDocx(back))).toEqual(back);
  });

  it('writes the pagination options of a paragraph and the size of the page', () => {
    const w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const document =
      `<w:document ${w}><w:body><w:p><w:pPr><w:keepNext/></w:pPr><w:r><w:t>one</w:t></w:r></w:p><w:p><w:r><w:t>two</w:t></w:r></w:p>` +
      '<w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/></w:sectPr>' +
      '</w:body></w:document>';
    const doc = importDocx(zipSync({ 'word/document.xml': strToU8(document) }));
    const read = (d: Doc) => strFromU8(unzipSync(exportDocx(d))['word/document.xml']);
    expect(read(doc)).toBe(document);
    expect(doc.paragraphs.map((p) => p.props.keepNext)).toEqual([true, undefined]);

    // Options are written only on the paragraph that changed, and can be switched off again.
    let edited = setParagraphProps(doc, 1, 1, { keepLines: true, widowControl: false, pageBreakBefore: true });
    edited = setParagraphProps(edited, 0, 0, { keepNext: false });
    expect(read(edited)).toContain(
      '<w:p><w:pPr><w:keepNext w:val="0"/></w:pPr><w:r><w:t xml:space="preserve">one</w:t></w:r></w:p>' +
        '<w:p><w:pPr><w:keepLines/><w:pageBreakBefore/><w:widowControl w:val="0"/></w:pPr><w:r><w:t xml:space="preserve">two</w:t></w:r></w:p>',
    );
    expect(importDocx(exportDocx(edited)).paragraphs[1].props).toMatchObject({ keepLines: true, widowControl: false, pageBreakBefore: true });

    // A landscape A4 page with narrow margins: the section keeps everything else it had.
    const turned = { ...doc, page: { ...doc.page, width: 841.9, height: 595.3, marginLeft: 36, marginRight: 36 } };
    expect(read(turned)).toContain(
      '<w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>' +
        '<w:pgMar w:top="1440" w:right="720" w:bottom="1440" w:left="720" w:header="708" w:footer="708" w:gutter="0"/><w:cols w:space="708"/></w:sectPr>',
    );
    expect(importDocx(exportDocx(turned)).page).toMatchObject({ width: 841.9, height: 595.3, marginLeft: 36 });
    // Back to portrait, the mark of a turned page goes.
    const upright = importDocx(exportDocx(turned));
    expect(read({ ...upright, page: { ...upright.page, width: 595.3, height: 841.9 } })).toContain('<w:pgSz w:w="11906" w:h="16838"/>');

    // The same from a document made from scratch.
    const fresh = createDoc([createParagraph('x', {}, { keepNext: true, widowControl: false })], { ...doc.page, width: 792, height: 612 });
    expect(read(fresh)).toContain('<w:keepNext/><w:widowControl w:val="0"/>');
    expect(read(fresh)).toContain('<w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/>');
    expect(importDocx(exportDocx(fresh)).page).toMatchObject({ width: 792, height: 612 });
  });

  it('writes highlights with the names Word has for them', () => {
    const doc = createDoc([{ props: {}, runs: [{ text: 'plain ', props: {} }, { text: 'marked', props: { highlight: 'FFFF00' } }] }]);
    const back = importDocx(exportDocx(doc));
    expect(back.paragraphs[0].runs.map((r) => r.props.highlight)).toEqual([undefined, 'FFFF00']);
    // In an opened document only the run that changed is touched, and a highlight can be taken off again.
    const marked = applyRunProps(back, { from: { para: 0, offset: 0 }, to: { para: 0, offset: 5 } }, { highlight: '00FFFF' });
    expect(importDocx(exportDocx(marked)).paragraphs[0].runs.map((r) => [r.text, r.props.highlight])).toEqual([
      ['plain', '00FFFF'], [' ', undefined], ['marked', 'FFFF00'],
    ]);
    const cleared = applyRunProps(back, { from: { para: 0, offset: 6 }, to: { para: 0, offset: 12 } }, { highlight: '' });
    expect(importDocx(exportDocx(cleared)).paragraphs[0].runs.every((r) => !r.props.highlight)).toBe(true);
  });

  it('resolves document defaults, style inheritance and direct formatting', () => {
    const w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const styles =
      `<w:styles ${w}><w:docDefaults>` +
      '<w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
      '</w:docDefaults>' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"/>' +
      '<w:style w:type="paragraph" w:styleId="Heading1"><w:basedOn w:val="Normal"/>' +
      '<w:pPr><w:spacing w:before="240" w:after="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>' +
      '<w:style w:type="character" w:styleId="Em"><w:rPr><w:i/></w:rPr></w:style>' +
      '</w:styles>';
    const document =
      `<w:document ${w}><w:body>` +
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:jc w:val="both"/></w:pPr>' +
      '<w:r><w:t>Head</w:t></w:r><w:r><w:rPr><w:b w:val="0"/><w:rStyle w:val="Em"/></w:rPr><w:t xml:space="preserve"> ing</w:t></w:r>' +
      '<w:del><w:r><w:delText>gone</w:delText></w:r></w:del></w:p>' +
      '<w:tbl><w:tr><w:tc><w:p><w:hyperlink><w:r><w:t>cell</w:t></w:r></w:hyperlink></w:p></w:tc></w:tr></w:tbl>' +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>' +
      '</w:body></w:document>';
    const doc = importDocx(
      zipSync({ 'word/document.xml': strToU8(document), 'word/styles.xml': strToU8(styles) }),
    );
    // What a tracked change took out is still in the text, marked as taken out.
    expect(docText(doc)).toBe('Head inggone\ncell');
    expect(doc.paragraphs[0].runs.at(-1)!.props.revision).toBe('delete');
    const [heading, cell] = doc.paragraphs;
    expect(heading.props).toMatchObject({ align: 'justify', spacingBefore: 12, spacingAfter: 0, lineHeight: 259 / 240 });
    expect(heading.runs[0].props).toMatchObject({ bold: true, fontSize: 16, fontFamily: 'Calibri' });
    expect(heading.runs[1].props).toMatchObject({ bold: false, italic: true, fontSize: 16 });
    expect(cell.props.spacingAfter).toBe(8);
    expect(cell.runs[0].props).toMatchObject({ fontSize: 11, fontFamily: 'Calibri' });
    expect(doc.page.width).toBeCloseTo(595.3);
  });
});
