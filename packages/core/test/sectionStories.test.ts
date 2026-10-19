import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type Story,
  type TextMeasurer,
  createDoc,
  exportDocx,
  exportPdf,
  hasOwnStories,
  importDocx,
  layoutDocument,
  sectionIndexOf,
  sectionMarks,
  setColumns,
  setOwnFirstPage,
  setOwnStories,
  setSectionPage,
  storyOf,
  storyPart,
  withStory,
} from '../src';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

const p = (text: string, sectPr = '') => `<w:p><w:pPr>${sectPr}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
const ref = (kind: 'header' | 'footer', type: string, id: string) => `<w:${kind}Reference w:type="${type}" r:id="${id}"/>`;
const sect = (w: number, h: number, refs = '', titlePg = false) =>
  `<w:sectPr>${refs}<w:pgSz w:w="${w}" w:h="${h}"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/>${titlePg ? '<w:titlePg/>' : ''}</w:sectPr>`;

/**
 * Three sections as Word has them: the first of letter size with its header,
 * the second turned, with a header of its own and a first page with another,
 * and the last, which names none and so shows the second's.
 */
function threeSections(): Doc {
  const parts: Record<string, [string, string]> = { h1: ['header', 'ONE'], h2: ['header', 'TWO'], h2f: ['header', 'FIRST TWO'], f1: ['footer', 'FOOT'] };
  const files: Record<string, Uint8Array> = {};
  let rels = '';
  for (const [id, [kind, text]] of Object.entries(parts)) {
    const root = kind === 'header' ? 'w:hdr' : 'w:ftr';
    files[`word/${id}.xml`] = strToU8(`<${root} ${W}>${p(text)}</${root}>`);
    rels += `<Relationship Id="${id}" Type="${REL}/${kind}" Target="${id}.xml"/>`;
  }
  const body =
    p('a', sect(12240, 15840, ref('header', 'default', 'h1') + ref('footer', 'default', 'f1'))) +
    p('b', sect(16838, 11906, ref('header', 'default', 'h2') + ref('header', 'first', 'h2f'), true)) +
    p('c') +
    sect(11906, 16838);
  files['word/document.xml'] = strToU8(`<w:document ${W}><w:body>${body}</w:body></w:document>`);
  files['word/_rels/document.xml.rels'] = strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`);
  return importDocx(zipSync(files));
}

const text = (story: Story | undefined) => story?.paragraphs.map((x) => x.runs.map((r) => r.text).join('')).join('|');
const retext = (story: Story, words: string): Story => ({ ...story, paragraphs: [{ ...story.paragraphs[0], runs: [{ ...story.paragraphs[0].runs[0], text: words }] }] });
/** What each page shows: its size, its header and its footer. */
const pages = (doc: Doc) => {
  const layout = layoutDocument(doc, measurer);
  const line = (band?: { lines: { fragments: { kind: string; text?: string }[] }[] }) => band?.lines[0]?.fragments.map((f) => f.text ?? '').join('') ?? '-';
  return layout.pages.map((page) => `${Math.round((page.setup ?? layout.page).width)} ${line(page.header)} ${line(page.footer)}`);
};

describe('the headers and footers of each section', () => {
  it('reads what each section shows: its own, the one of the section before it, or the last one\'s', () => {
    const doc = threeSections();
    const [first, second] = sectionMarks(doc).map((i) => doc.paragraphs[i].section!);
    expect(text(doc.header)).toBe('TWO');
    expect(text(doc.footer)).toBe('FOOT');
    // The first has a header of its own; its footer is the one every section shows.
    expect(text(first.header)).toBe('ONE');
    expect(first.footer).toBeUndefined();
    // The second shows the last one's, which it is, and has a first page of its own.
    expect(second.header).toBeUndefined();
    expect(text(second.firstPage?.header)).toBe('FIRST TWO');
    expect(second.firstPage?.footer).toBeUndefined();
    expect(doc.firstPage).toBeUndefined();
  });

  it('lays out each page of the size of its section, with its section\'s header and footer', () => {
    const doc = threeSections();
    expect(pages(doc)).toEqual(['612 ONE FOOT', '842 FIRST TWO -', '595 TWO FOOT']);
    const layout = layoutDocument(doc, measurer);
    expect([0, 1, 2].map((i) => storyPart(layout, 'header', i))).toEqual(['header@0', 'firstHeader@1', 'header']);
    expect(storyPart(layout, 'footer', 1)).toBe('firstFooter@1');
    // A PDF has each page of its own size.
    const pdf = strFromU8(exportPdf(layout, { measurer }));
    expect(pdf.match(/\/MediaBox \[[^\]]*\]/g)).toEqual(['/MediaBox [0 0 612 792]', '/MediaBox [0 0 841.9 595.3]', '/MediaBox [0 0 595.3 841.9]']);
  });

  it('writes back what changed, each section naming its own, so that none takes the one before it', () => {
    let doc = threeSections();
    doc = withStory(doc, 'header@0', retext(storyOf(doc, 'header@0')!, 'ONE AGAIN'));
    doc = setOwnStories(doc, 1, true);
    doc = withStory(doc, 'header@1', retext(storyOf(doc, 'header@1')!, 'MINE'));
    const docx = exportDocx(doc);
    const xml = strFromU8(unzipSync(docx)['word/document.xml']);
    const named = [...xml.matchAll(/<w:sectPr>(.*?)<w:pgSz/g)].map((m) => [...m[1].matchAll(/w:(header|footer)Reference w:type="(\w+)"/g)].map((r) => `${r[1]}:${r[2]}`).join(' '));
    // The second's first page has no footer, and none before it named one: it needs none.
    expect(named).toEqual(['header:default footer:default', 'header:default footer:default header:first', 'header:default footer:default']);
    const back = importDocx(docx);
    expect(pages(back)).toEqual(['612 ONE AGAIN FOOT', '842 FIRST TWO -', '595 TWO FOOT']);
    expect(text(storyOf(back, 'header@1'))).toBe('MINE');
    // Untouched, the sections go back as they were.
    expect(strFromU8(unzipSync(exportDocx(threeSections()))['word/document.xml'])).not.toContain('r:id="rId');
  });

  it('gives a section of a new document a page and a header of its own', () => {
    let doc = createDoc([1, 2, 3].map((n) => ({ props: {}, runs: [{ text: `p${n}`, props: {} }] })));
    doc = withStory(doc, 'header', { paragraphs: [{ props: {}, runs: [{ text: 'SAME', props: {} }] }] });
    doc = setColumns(doc, { from: { para: 1, offset: 0 }, to: { para: 1, offset: 2 } }, { count: 2, space: 36 });
    expect(sectionMarks(doc)).toEqual([0, 1]);
    // The middle one goes on a page of its own, turned, with a header of its own; the others show the document's.
    doc = setSectionPage(doc, 1, { width: 792, height: 612 });
    expect(setSectionPage(doc, 0, {})).toBe(doc);
    // A page of another size starts a page, whatever the section says.
    expect(sectionIndexOf(doc, 1)).toBe(1);
    expect(hasOwnStories(doc, 1)).toBe(false);
    doc = setOwnStories(doc, 1, true);
    doc = withStory(doc, 'header@1', { paragraphs: [{ props: {}, runs: [{ text: 'TURNED', props: {} }] }] });
    doc = setOwnFirstPage(doc, 0, true);
    expect(pages(doc)).toEqual(['612 - -', '792 TURNED -', '612 SAME -']);
    const back = importDocx(exportDocx(doc));
    expect(pages(back)).toEqual(['612 - -', '792 TURNED -', '612 SAME -']);
    // Taken away, a section shows the document's again.
    expect(pages(setOwnStories(back, 1, false))).toEqual(['612 - -', '792 SAME -', '612 SAME -']);
  });
});
