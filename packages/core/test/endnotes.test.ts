import { strFromU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type NoteNumbering,
  type FontSpec,
  type Paragraph,
  type TextMeasurer,
  createDoc,
  noteNumberingOf,
  endnoteNumbers,
  endnotePart,
  exportDocx,
  importDocx,
  insertEndnote,
  insertFootnote,
  insertSectionBreak,
  layoutDocument,
  noteLabels,
  noteRules,
  paragraphText,
  renderPdf,
  setNoteNumbering,
  setEndnotesAt,
  shownEndnotes,
  storyOf,
  withStory,
} from '../src/internal';

// Every letter half as wide as its size; 10 pt text, 5 pt a letter, lines 10 pt tall.
const measurer: TextMeasurer = {
  width: (text: string, font: FontSpec) => text.length * font.size * 0.5,
  metrics: (font: FontSpec) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};
// 100 pt of text a line, 20 letters; 100 pt of page, ten lines of 10 pt.
const PAGE = { width: 120, height: 120, marginTop: 10, marginRight: 10, marginBottom: 10, marginLeft: 10 };
const p = (text: string): Paragraph => ({ props: { spacingBefore: 0, spacingAfter: 0, lineHeight: 1 }, runs: [{ text, props: { fontSize: 10 } }] });
const doc = (texts: string[]): Doc => createDoc(texts.map(p), PAGE);
const end = (d: Doc, para: number, text: string) => insertEndnote(d, { para, offset: paragraphText(d.paragraphs[para]).length }, text).doc;

describe('notes at the end of the document', () => {
  it('are numbered i, ii, iii in the order of their references, apart from those at the foot of the page', () => {
    let d = doc(['Uno', 'Dos', 'Tres']);
    d = end(d, 2, 'La tercera');
    d = end(d, 0, 'La primera');
    d = insertFootnote(d, { para: 1, offset: 3 }, 'Al pie').doc;
    expect([...endnoteNumbers(d).values()]).toEqual([1, 2]);
    expect(shownEndnotes(d).map((note) => paragraphText(note.paragraphs[0]))).toEqual([expect.stringContaining('La primera'), expect.stringContaining('La tercera')]);
    expect([...noteLabels(d, 'endnote').values()]).toEqual(['i', 'ii']);
    expect(d.footnotes).toHaveLength(1);
    expect([...noteLabels({ ...d, endnoteNumbering: { format: 'decimal' } }, 'endnote').values()]).toEqual(['1', '2']);
  });

  it('are set out after the last line of the text, under a short line, and the references show their numbers', () => {
    const d = end(doc(['Uno', 'Dos']), 1, 'Nota final');
    const layout = layoutDocument(d, measurer);
    expect(layout.pages).toHaveLength(1);
    const area = layout.pages[0].endnotes!;
    const lastBody = layout.lines[layout.lines.length - 1];
    expect(area.rule.y).toBeGreaterThan(lastBody.y + lastBody.height - 0.01);
    expect(area.rule.width).toBeLessThanOrEqual(144);
    expect(area.notes).toHaveLength(1);
    expect(area.notes[0].part).toBe(endnotePart('1'));
    const noteText = area.notes[0].lines.map((l) => l.fragments.map((f) => f.text).join('')).join('');
    expect(noteText).toContain('Nota final');
    // The reference in the text, and the mark of the note, read "i", raised.
    expect(lastBody.fragments.find((f) => f.mark)!.mark).toMatchObject({ text: 'i' });
    expect(area.notes[0].lines[0].fragments.find((f) => f.mark)!.mark).toMatchObject({ text: 'i' });
  });

  it('go on on pages of their own when they do not fit, under a line as wide as the text', () => {
    // Nine lines of text leave one; the note of four lines goes on to a page after.
    let d = doc(Array.from({ length: 9 }, (_, i) => `Linea ${i + 1}`));
    d = end(d, 8, 'palabra '.repeat(10).trim());
    const layout = layoutDocument(d, measurer);
    expect(layout.pages.length).toBeGreaterThan(1);
    const last = layout.pages[layout.pages.length - 1];
    expect(last.lines).toHaveLength(0);
    expect(last.endnotes!.notes[0].lines.length).toBeGreaterThan(0);
    // A note that goes on starts under a line across the text.
    expect(last.endnotes!.rule.width).toBeCloseTo(PAGE.width - PAGE.marginLeft - PAGE.marginRight);
  });

  it('are written to endnotes.xml and read back, with their numbering', () => {
    let d = end(doc(['Uno', 'Dos']), 0, 'Primera');
    d = end(d, 1, 'Segunda');
    const bytes = exportDocx(d);
    const files = unzipSync(bytes);
    expect(files['word/endnotes.xml']).toBeDefined();
    expect(strFromU8(files['[Content_Types].xml'])).toContain('endnotes+xml');
    expect(strFromU8(files['word/_rels/document.xml.rels'])).toContain('/endnotes');
    expect(strFromU8(files['word/document.xml'])).toContain('<w:endnoteReference w:id="1"/>');
    const back = importDocx(bytes);
    expect(shownEndnotes(back).map((note) => note.id)).toEqual(['1', '2']);
    expect(paragraphText(storyOf(back, endnotePart('2'))!.paragraphs[0])).toContain('Segunda');
    // Changed in one note, and written again: the other is as it was.
    const story = storyOf(back, endnotePart('1'))!;
    const changed = withStory(back, endnotePart('1'), { ...story, paragraphs: [{ ...story.paragraphs[0], runs: [...story.paragraphs[0].runs, { text: ' cambiada', props: {} }] }] });
    const again = importDocx(exportDocx(changed));
    expect(paragraphText(storyOf(again, endnotePart('1'))!.paragraphs[0])).toContain('Primera cambiada');
    expect(paragraphText(storyOf(again, endnotePart('2'))!.paragraphs[0])).toContain('Segunda');
  });

  it('take the numbering their section says, and not that of the settings, as Word does', () => {
    const bytes = exportDocx(end(doc(['Uno']), 0, 'Nota'));
    const files = unzipSync(bytes);
    const w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    files['word/settings.xml'] = new TextEncoder().encode(`<w:settings ${w}><w:endnotePr><w:numFmt w:val="upperLetter"/></w:endnotePr></w:settings>`);
    const said = (inner: string) => {
      const xml = strFromU8(files['word/document.xml']).replace('<w:sectPr>', `<w:sectPr><w:endnotePr>${inner}</w:endnotePr>`);
      return importDocx(zipSync({ ...files, 'word/document.xml': new TextEncoder().encode(xml) }));
    };
    expect(importDocx(zipSync(files)).endnoteNumbering).toBeUndefined();
    const read = said('<w:numFmt w:val="decimal"/><w:numStart w:val="3"/><w:numRestart w:val="eachSect"/>');
    expect(read.endnoteNumbering).toEqual({ format: 'decimal', start: 3, restart: 'section' });
    expect([...noteLabels(read, 'endnote').values()]).toEqual(['3']);
    // Written back as it is, and changed when it changes.
    expect(importDocx(exportDocx(read)).endnoteNumbering).toEqual({ format: 'decimal', start: 3, restart: 'section' });
    const changed = exportDocx({ ...read, endnoteNumbering: { format: 'upperRoman' } });
    expect(strFromU8(unzipSync(changed)['word/document.xml'])).toContain('<w:endnotePr><w:numFmt w:val="upperRoman"/></w:endnotePr>');
    expect(strFromU8(unzipSync(exportDocx({ ...read, endnoteNumbering: undefined }))['word/document.xml'])).not.toContain('w:endnotePr');
  });

  it('are set out and numbered as asked, section by section', () => {
    let d = end(doc(['Uno', 'Dos']), 1, 'Nota');
    d = insertSectionBreak(d, { para: 0, offset: 3 }).doc;
    expect(setEndnotesAt(d, 'document')).toBe(d);
    expect(setEndnotesAt(d, 'sections').endnotesAt).toBe('sections');
    expect(setEndnotesAt(setEndnotesAt(d, 'sections'), 'document').endnotesAt).toBeUndefined();
    // The first section and the last, the document's own, each its own; the defaults are not kept.
    const first = setNoteNumbering(d, 'endnote', 0, { format: 'upperLetter', start: 1 });
    expect(noteNumberingOf(first, 'endnote', 0)).toEqual({ format: 'upperLetter' });
    expect(noteNumberingOf(first, 'endnote', 1)).toBeUndefined();
    const last = setNoteNumbering(first, 'endnote', 1, { restart: 'section', start: 2 });
    expect(last.endnoteNumbering).toEqual({ start: 2, restart: 'section' });
    expect([...noteLabels(last, 'endnote').values()]).toEqual(['ii']);
    expect(setNoteNumbering(last, 'endnote', 1, {}).endnoteNumbering).toBeUndefined();
    expect(setNoteNumbering(last, 'endnote', 1, { start: 2, restart: 'section' })).toBe(last);
  });

  it('are numbered by section as Word numbers them: its own format and start, the count going on or starting again', () => {
    // Three sections of two notes each, as measured against Word.
    let d = doc(['a', 'b', 'c', 'd', 'e', 'f']);
    for (const para of [5, 4, 3, 2, 1, 0]) d = end(d, para, `Nota ${para + 1}`);
    // After each reference: the end of the paragraph.
    d = insertSectionBreak(d, { para: 3, offset: paragraphText(d.paragraphs[3]).length }).doc;
    d = insertSectionBreak(d, { para: 1, offset: paragraphText(d.paragraphs[1]).length }).doc;
    const marks = d.paragraphs.flatMap((p, i) => (p.section ? [i] : []));
    const numbered = (first: NoteNumbering | undefined, second: NoteNumbering | undefined, last: NoteNumbering | undefined) => {
      const paragraphs = d.paragraphs.slice();
      [first, second].forEach((numbering, k) => {
        paragraphs[marks[k]] = { ...paragraphs[marks[k]], section: { ...paragraphs[marks[k]].section!, endnoteNumbering: numbering } };
      });
      return [...noteLabels({ ...d, paragraphs, endnoteNumbering: last }, 'endnote').values()];
    };
    expect(numbered(undefined, undefined, undefined)).toEqual(['i', 'ii', 'iii', 'iv', 'v', 'vi']);
    // From 3 in letters, the count going on: the third note is the fifth letter.
    expect(numbered(undefined, { format: 'upperLetter', start: 3 }, { restart: 'section' })).toEqual(['i', 'ii', 'E', 'F', 'i', 'ii']);
    // The first from 3: the second, which says nothing, does not take it.
    expect(numbered({ start: 3 }, undefined, undefined)).toEqual(['iii', 'iv', 'iii', 'iv', 'v', 'vi']);
    expect(numbered({ format: 'decimal', start: 3 }, { restart: 'section' }, undefined)).toEqual(['3', '4', 'i', 'ii', 'v', 'vi']);
  });

  describe('at the end of each section', () => {
    // Three sections of one paragraph each, a note in each; the second goes on under the first, on its page.
    const sections = (noEndnotes = false): Doc => {
      let d = doc(['Uno', 'Dos', 'Tres']);
      for (const para of [2, 1, 0]) d = end(d, para, `Nota ${para + 1}`);
      d = insertSectionBreak(d, { para: 1, offset: 4 }).doc;
      d = insertSectionBreak(d, { para: 0, offset: 4 }, 'continuous').doc;
      const paragraphs = d.paragraphs.slice();
      // The mark of the second section: the second paragraph that ends one.
      const mark = paragraphs.findIndex((para, i) => para.section && paragraphs.slice(0, i).some((before) => before.section));
      if (noEndnotes) paragraphs[mark] = { ...paragraphs[mark], section: { ...paragraphs[mark].section!, noEndnotes: true } };
      return { ...d, paragraphs, endnotesAt: 'sections' };
    };
    const texts = (area: { notes: { lines: { fragments: { text: string }[] }[] }[] } | undefined) => area?.notes.map((n) => n.lines.map((l) => l.fragments.map((f) => f.text).join('')).join('')) ?? [];
    const lineOf = (layout: ReturnType<typeof layoutDocument>, text: string) => layout.lines.find((l) => l.fragments.some((f) => f.text.includes(text)))!;

    it('go after the text of their section, and what follows on the page goes on under them', () => {
      const layout = layoutDocument(sections(), measurer);
      expect(layout.pages).toHaveLength(2);
      const [first, second] = layout.pages;
      expect(texts(first.endnotes)).toEqual([expect.stringContaining('Nota 1'), expect.stringContaining('Nota 2')]);
      expect(texts(second.endnotes)).toEqual([expect.stringContaining('Nota 3')]);
      // The second section, which starts on the same page, starts under the notes of the first; each has its line.
      const [one, two] = first.endnotes!.notes;
      expect(lineOf(layout, 'Dos').y).toBeGreaterThan(one.lines[0].y);
      expect(two.lines[0].y).toBeGreaterThan(lineOf(layout, 'Dos').y);
      expect(noteRules(first)).toHaveLength(2);
      // The numbers go on from one section to the next.
      expect([...noteLabels(sections(), 'endnote').values()]).toEqual(['i', 'ii', 'iii']);
    });

    it('of a section that says it has none go at the end of the next', () => {
      const layout = layoutDocument(sections(true), measurer);
      expect(texts(layout.pages[0].endnotes)).toEqual([expect.stringContaining('Nota 1')]);
      expect(texts(layout.pages[1].endnotes)).toEqual([expect.stringContaining('Nota 2'), expect.stringContaining('Nota 3')]);
    });

    it('are said in the settings and the sections, and read back', () => {
      const files = unzipSync(exportDocx(sections(true)));
      expect(strFromU8(files['word/settings.xml'])).toContain('<w:endnotePr><w:pos w:val="sectEnd"/></w:endnotePr>');
      expect(strFromU8(files['word/document.xml']).match(/<w:noEndnote\/>/g)).toHaveLength(1);
      const back = importDocx(zipSync(files));
      expect(back.endnotesAt).toBe('sections');
      expect(back.paragraphs.filter((p) => p.section?.noEndnotes)).toHaveLength(1);
      // Back at the end of the document: the numbering the file gave them stays.
      const settings = strFromU8(files['word/settings.xml']).replace('<w:pos w:val="sectEnd"/>', '<w:pos w:val="sectEnd"/><w:numFmt w:val="decimal"/>');
      const again = exportDocx({ ...importDocx(zipSync({ ...files, 'word/settings.xml': new TextEncoder().encode(settings) })), endnotesAt: undefined });
      const written = strFromU8(unzipSync(again)['word/settings.xml']);
      expect(written).not.toContain('sectEnd');
      expect(written).toContain('<w:numFmt w:val="decimal"/>');
      expect(importDocx(again).endnotesAt).toBeUndefined();
    });
  });

  it('go into the PDF', () => {
    const d = end(doc(['Uno']), 0, 'Texto de la nota final');
    const { pdf } = renderPdf(d, []);
    expect(pdf.length).toBeGreaterThan(0);
  });
});
