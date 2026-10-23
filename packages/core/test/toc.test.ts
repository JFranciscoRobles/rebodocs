import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type Doc, type FontSpec, type Paragraph, createDoc, exportDocx, importDocx, insertToc, layoutDocument, plainText, setParagraphStyle, tocRange, tocTarget, updateToc } from '../src/internal';

/** Every character as wide as half its font size: enough to see where things land. */
const measurer = {
  width: (text: string, font: FontSpec) => text.length * font.size * 0.5,
  metrics: (font: FontSpec) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};
const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });
const lines = (doc: Doc) => doc.paragraphs.map((para) => plainText(para.runs));

/** An empty first paragraph, then headings of two levels with text under them. */
function base(): Doc {
  let doc = createDoc([p(''), p('Objeto'), p('Texto del objeto.'), p('Precio'), p('Forma de pago'), p('Texto del pago.'), p('Vigencia')]);
  for (const [para, style] of [
    [1, 'Heading1'],
    [3, 'Heading1'],
    [4, 'Heading2'],
    [6, 'Heading1'],
  ] as const)
    doc = setParagraphStyle(doc, para, para, style);
  return doc;
}
const pages = (map: Record<string, number>) => (doc: Doc) => (para: number) => map[plainText(doc.paragraphs[para].runs)] ?? 0;

describe('table of contents', () => {
  it('lists the headings with their pages, the lower levels set in', () => {
    const pageOf = pages({ Objeto: 1, Precio: 2, 'Forma de pago': 2, Vigencia: 3 });
    const start = base();
    // Put in without pages, then given them: they are asked for by the paragraphs of the document the table is in.
    const { doc, pos } = insertToc(start, { para: 0, offset: 0 }, { title: 'Índice', pageOf: () => 0 });
    const made = updateToc(doc, { pageOf: pageOf(doc) });
    expect(lines(made).slice(0, 6)).toEqual(['Índice', 'Objeto\t1', 'Precio\t2', 'Forma de pago\t2', 'Vigencia\t3', '']);
    expect(tocRange(made)).toEqual({ first: 1, last: 4 });
    expect(pos).toEqual({ para: 5, offset: 0 });
    expect(made.paragraphs.slice(1, 5).map((para) => [para.props.indentLeft, para.props.leaderTab])).toEqual([
      [0, 468],
      [0, 468],
      [14, 468],
      [0, 468],
    ]);
    // The title of the table is not a heading, so the table does not list itself; and a document has one table.
    expect(made.paragraphs[0].props.styleId).toBeUndefined();
    expect(insertToc(made, { para: 6, offset: 0 }, { pageOf: () => 1 }).doc).toBe(made);
    // Brought up to date with nothing new to say, it is the same document.
    expect(updateToc(made, { pageOf: pageOf(made) })).toBe(made);
    expect(updateToc(start, { pageOf: () => 1 })).toBe(start);
  });

  it('follows the headings as they change', () => {
    const { doc } = insertToc(base(), { para: 0, offset: 0 }, { pageOf: () => 1 });
    const at = lines(doc).indexOf('Precio');
    const renamed = { ...doc, paragraphs: doc.paragraphs.map((para, i) => (i === at ? { ...para, runs: para.runs.map((run) => (run.props.object ? run : { ...run, text: 'Honorarios' })) } : para)) };
    const without = { ...renamed, paragraphs: renamed.paragraphs.filter((para) => plainText(para.runs) !== 'Vigencia') };
    const next = updateToc(without, { pageOf: (para) => para });
    expect(lines(next).slice(0, 4)).toEqual(['Objeto\t5', 'Honorarios\t7', 'Forma de pago\t8', '']);
    // With no headings left it says so, and is still a table to fill again.
    const bare = { ...next, paragraphs: next.paragraphs.map((para) => ({ ...para, props: { ...para.props, styleId: undefined } })) };
    const empty = updateToc(bare, { pageOf: () => 1, emptyText: 'Sin títulos' });
    expect(lines(empty)[0]).toBe('Sin títulos');
    expect(tocRange(empty)).toEqual({ first: 0, last: 0 });
  });

  it('sets the page of each entry against the right edge, with dots leading to it', () => {
    const { doc } = insertToc(base(), { para: 0, offset: 0 }, { pageOf: (para) => para * 7 });
    const layout = layoutDocument(doc, measurer);
    const right = doc.page.width - doc.page.marginRight;
    for (const line of layout.lines.slice(0, 4)) {
      const last = line.fragments.filter((f) => f.kind === 'text').pop()!;
      expect(last.x + last.width).toBeCloseTo(right, 5);
      const tab = line.fragments.find((f) => f.kind === 'tab')!;
      expect(tab.leader!.text).toMatch(/^\.{20,}$/);
      // The dots stay inside the gap, clear of the text on both sides.
      expect(tab.leader!.x).toBeGreaterThan(tab.x);
      expect(tab.leader!.x + tab.leader!.width).toBeLessThan(tab.x + tab.width);
    }
  });

  it('is the TOC field of Word in the file, and comes back as a table', () => {
    const { doc } = insertToc(base(), { para: 0, offset: 0 }, { title: 'Índice', pageOf: () => 3 });
    const xml = strFromU8(unzipSync(exportDocx(doc))['word/document.xml']);
    expect(xml).toContain(
      '<w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>',
    );
    expect(xml).toContain('<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9360"/></w:tabs>');
    expect(xml.match(/w:fldCharType="end"/g)).toHaveLength(1);
    expect(xml).toMatch(/Objeto<\/w:t><w:tab\/><w:t[^>]*>3<\/w:t>/);
    // Each entry is a link to the bookmark around its heading, as Word makes them.
    expect(xml).toMatch(/<w:hyperlink w:anchor="_Toc100000001" w:history="1"><w:r>.*?Objeto<\/w:t><w:tab\/><w:t[^>]*>3<\/w:t><\/w:r><\/w:hyperlink>/);
    expect(xml).toMatch(/<w:bookmarkStart w:id="901" w:name="_Toc100000001"\/><w:r>.*?Objeto<\/w:t><\/w:r><w:bookmarkEnd w:id="901"\/>/);
    expect(xml.match(/<w:hyperlink /g)).toHaveLength(4);

    const back = importDocx(exportDocx(doc));
    expect(tocRange(back)).toEqual(tocRange(doc));
    expect(back.paragraphs[1].props.leaderTab).toBe(468);
    // Brought up to date after coming back from the file, and written again.
    const updated = updateToc(back, { pageOf: () => 9 });
    expect(lines(updated).slice(1, 5)).toEqual(['Objeto\t9', 'Precio\t9', 'Forma de pago\t9', 'Vigencia\t9']);
    const again = importDocx(exportDocx(updated));
    expect(lines(again).slice(0, 6)).toEqual(['Índice', 'Objeto\t9', 'Precio\t9', 'Forma de pago\t9', 'Vigencia\t9', '']);
    expect(tocRange(again)).toEqual({ first: 1, last: 4 });
    // The links still lead to their headings, which kept their bookmarks.
    expect([1, 2, 3, 4].map((para) => plainText(again.paragraphs[tocTarget(again, para)!].runs))).toEqual(['Objeto', 'Precio', 'Forma de pago', 'Vigencia']);
    const out = strFromU8(unzipSync(exportDocx(updated))['word/document.xml']);
    expect(out.match(/w:fldCharType="begin"/g)).toHaveLength(1);
    expect(out.match(/w:fldCharType="end"/g)).toHaveLength(1);
  });

  it('leads from each entry to its heading, wherever the heading goes', () => {
    const { doc } = insertToc(base(), { para: 0, offset: 0 }, { title: 'Índice', pageOf: () => 1 });
    const heading = (para: number) => plainText(doc.paragraphs[tocTarget(doc, para)!].runs);
    expect([1, 2, 3, 4].map(heading)).toEqual(['Objeto', 'Precio', 'Forma de pago', 'Vigencia']);
    // The title of the table, and what is outside it, lead nowhere.
    expect(tocTarget(doc, 0)).toBeUndefined();
    expect(tocTarget(doc, 6)).toBeUndefined();
    // The table is found by its bookmark, not by its place: a heading moved to the end is still where its entry leads.
    const at = doc.paragraphs.findIndex((para) => plainText(para.runs) === 'Objeto');
    const paragraphs = doc.paragraphs.slice();
    paragraphs.push(...paragraphs.splice(at, 1));
    const moved = { ...doc, paragraphs };
    expect(tocTarget(moved, 1)).toBe(moved.paragraphs.length - 1);
    // A heading that is gone leaves its entry leading nowhere until the table is brought up to date.
    const cut = { ...doc, paragraphs: doc.paragraphs.filter((_, i) => i !== at) };
    expect(tocTarget(cut, 1)).toBeUndefined();
    // Brought up to date twice, the headings keep the bookmarks they were given the first time.
    const again = updateToc(moved, { pageOf: () => 2 });
    expect(again.paragraphs.filter((para) => para.runs.some((run) => /bookmarkStart/.test(run.props.object ?? '')))).toHaveLength(4);
  });
});
