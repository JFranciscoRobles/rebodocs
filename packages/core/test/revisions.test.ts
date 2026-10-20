import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  exportDocx,
  importDocx,
  type Doc,
  type Paragraph,
  acceptRevisions,
  addNote,
  createDoc,
  decideAllRevisions,
  deleteRange,
  insertText,
  paragraphText,
  rejectRevisions,
  removeNote,
  revisionAt,
  revisionsOf,
  splitParagraph,
  trackEdit,
} from '../src';

const para = (text: string, props: Paragraph['props'] = {}): Paragraph => ({ props, runs: [{ text, props: {} }] });
const doc = (...texts: string[]): Doc => createDoc(texts.map((text) => para(text)));
const ANA = { author: 'Ana', date: '2026-10-18T10:00:00Z' };
const LUIS = { author: 'Luis', date: '2026-10-18T11:00:00Z' };
/** Each paragraph as it reads with its changes: {+put in+}, [-taken out-], and ¶+ or ¶- for its mark. */
const shown = (d: Doc) =>
  d.paragraphs.map(
    (p) =>
      p.runs.map((run) => (run.props.revision === 'insert' ? `{+${run.text}+}` : run.props.revision === 'delete' ? `[-${run.text}-]` : run.text)).join('') +
      (p.props.markRevision === 'insert' ? '¶+' : p.props.markRevision === 'delete' ? '¶-' : ''),
  );
const texts = (d: Doc) => d.paragraphs.map(paragraphText);

describe('tracking an edit', () => {
  it('marks what is typed, and keeps what is taken out struck through, with the caret where it belongs', () => {
    const start = doc('Hola mundo');
    const typed = trackEdit(start, insertText(start, { para: 0, offset: 4 }, ' cruel').doc, ANA);
    // The space could be either one: it is the one before the word that is marked.
    expect(shown(typed.doc)).toEqual(['Hola {+cruel +}mundo']);
    expect(typed.doc.paragraphs[0].runs[1].props).toMatchObject({ revisionAuthor: 'Ana', revisionDate: '2026-10-18T10:00:00Z' });
    // Taking out "mundo": it stays, and Backspace leaves the caret before it.
    const cut = deleteRange(typed.doc, { from: { para: 0, offset: 11 }, to: { para: 0, offset: 16 } });
    const gone = trackEdit(typed.doc, cut, ANA);
    expect(shown(gone.doc)).toEqual(['Hola {+cruel +}[-mundo-]']);
    expect(gone.map({ para: 0, offset: 11 }, 'back')).toEqual({ para: 0, offset: 11 });
    // Backspace again over what is already taken out: nothing more goes, and the caret goes past it.
    const again = trackEdit(gone.doc, deleteRange(gone.doc, { from: { para: 0, offset: 15 }, to: { para: 0, offset: 16 } }), ANA);
    expect(shown(again.doc)).toEqual(['Hola {+cruel +}[-mundo-]']);
    expect(again.map({ para: 0, offset: 15 }, 'back')).toEqual({ para: 0, offset: 11 });
    // What was put in and is taken out again goes for good.
    const unsaid = trackEdit(gone.doc, deleteRange(gone.doc, { from: { para: 0, offset: 5 }, to: { para: 0, offset: 11 } }), ANA);
    expect(shown(unsaid.doc)).toEqual(['Hola [-mundo-]']);
  });

  it('puts what is taken out at the edges of words, where letters could match either way', () => {
    const start = doc('Asesor: __Ana Lucía');
    const cut = trackEdit(start, deleteRange(start, { from: { para: 0, offset: 0 }, to: { para: 0, offset: 10 } }), LUIS).doc;
    expect(shown(cut)).toEqual(['[-Asesor: __-]Ana Lucía']);
    const s2 = doc('uno dos dos tres');
    expect(shown(trackEdit(s2, deleteRange(s2, { from: { para: 0, offset: 7 }, to: { para: 0, offset: 11 } }), LUIS).doc)).toEqual(['uno dos [-dos -]tres']);
  });

  it('replaces a word as the old one taken out and the new one put in, by whoever does it', () => {
    const start = doc('El precio es cien pesos');
    const after = insertText(deleteRange(start, { from: { para: 0, offset: 13 }, to: { para: 0, offset: 17 } }), { para: 0, offset: 13 }, 'doscientos').doc;
    const tracked = trackEdit(start, after, LUIS, { words: true });
    expect(shown(tracked.doc)).toEqual(['El precio es [-cien-]{+doscientos+} pesos']);
    // Letter by letter, as typing is tracked, the letters that stay are not taken out.
    expect(shown(trackEdit(start, after, LUIS).doc)).toEqual(['El precio es {+dos+}cien{+tos+} pesos']);
    // The caret after what was typed stays after it.
    expect(tracked.map({ para: 0, offset: 23 }, 'back')).toEqual({ para: 0, offset: 27 });
  });

  it('keeps a new paragraph and a join as marks, which accepting and rejecting settle', () => {
    const start = doc('Primera parte segunda parte', 'Otro');
    const split = trackEdit(start, splitParagraph(start, { para: 0, offset: 14 }).doc, ANA).doc;
    expect(shown(split)).toEqual(['Primera parte ¶+', 'segunda parte', 'Otro']);
    expect(texts(rejectRevisions(split))).toEqual(['Primera parte segunda parte', 'Otro']);
    expect(shown(acceptRevisions(split))).toEqual(['Primera parte ', 'segunda parte', 'Otro']);
    // Backspace at the start of a paragraph: both stay, apart, until it is accepted.
    const joined = trackEdit(start, deleteRange(start, { from: { para: 0, offset: 27 }, to: { para: 1, offset: 0 } }), ANA).doc;
    expect(shown(joined)).toEqual(['Primera parte segunda parte¶-', 'Otro']);
    expect(texts(acceptRevisions(joined))).toEqual(['Primera parte segunda parteOtro']);
    expect(shown(rejectRevisions(joined))).toEqual(['Primera parte segunda parte', 'Otro']);
  });

  it('takes out whole paragraphs, and a new paragraph rejected after a heading leaves the next one as it was', () => {
    const start = createDoc([para('Título', { styleId: 'Heading1' }), para('Texto')]);
    const deleted = trackEdit(start, deleteRange(start, { from: { para: 0, offset: 0 }, to: { para: 1, offset: 0 } }), ANA).doc;
    expect(shown(deleted)).toEqual(['[-Título-]¶-', 'Texto']);
    expect(acceptRevisions(deleted).paragraphs.map((p) => [paragraphText(p), p.props.styleId])).toEqual([['Texto', undefined]]);
    // Enter at the end of the heading makes an empty paragraph; rejected, it goes, and "Texto" keeps its own look.
    const enter = splitParagraph(start, { para: 0, offset: 6 }).doc;
    const tracked = trackEdit(start, { ...enter, paragraphs: enter.paragraphs.map((p, i) => (i === 1 ? { ...p, props: {} } : p)) }, ANA).doc;
    expect(shown(tracked)).toEqual(['Título', '¶+', 'Texto']);
    expect(rejectRevisions(tracked).paragraphs.map((p) => [paragraphText(p), p.props.styleId])).toEqual([['Título', 'Heading1'], ['Texto', undefined]]);
  });
});

describe('the changes there are', () => {
  it('lists them by person, and accepts or rejects one of them alone', () => {
    let d = doc('Uno dos tres');
    d = trackEdit(d, insertText(d, { para: 0, offset: 3 }, ' y medio').doc, ANA).doc;
    d = trackEdit(d, deleteRange(d, { from: { para: 0, offset: 16 }, to: { para: 0, offset: 20 } }), LUIS).doc;
    expect(shown(d)).toEqual(['Uno {+y medio +}dos [-tres-]']);
    expect(revisionsOf(d).map((r) => [r.type, r.author, r.text])).toEqual([
      ['insert', 'Ana', 'y medio '],
      ['delete', 'Luis', 'tres'],
    ]);
    const luis = revisionAt(d.paragraphs, { para: 0, offset: 18 })!;
    expect(shown(rejectRevisions(d, luis.range))).toEqual(['Uno {+y medio +}dos tres']);
    expect(shown(acceptRevisions(d, luis.range))).toEqual(['Uno {+y medio +}dos ']);
    expect(shown(decideAllRevisions(d, true))).toEqual(['Uno y medio dos ']);
    expect(shown(decideAllRevisions(d, false))).toEqual(['Uno dos tres']);
    // Paragraphs without changes are left as they are.
    const two = createDoc([para('a'), para('b')]);
    expect(acceptRevisions(two).paragraphs[0]).toBe(two.paragraphs[0]);
  });
});

describe('tracked changes in the file', () => {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  it('reads what Word tracked, and writes it back as Word keeps it', () => {
    const document =
      `<w:document ${W}><w:body>` +
      '<w:p><w:r><w:t xml:space="preserve">Se paga </w:t></w:r><w:del w:id="1" w:author="Ana" w:date="2026-10-01T09:00:00Z"><w:r><w:delText>cien</w:delText></w:r></w:del>' +
      '<w:ins w:id="2" w:author="Ana" w:date="2026-10-01T09:00:00Z"><w:r><w:t>doscientos</w:t></w:r></w:ins><w:r><w:t xml:space="preserve"> pesos.</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:rPr><w:ins w:id="3" w:author="Luis" w:date="2026-10-02T09:00:00Z"/></w:rPr></w:pPr><w:ins w:id="4" w:author="Luis" w:date="2026-10-02T09:00:00Z"><w:r><w:t>Nuevo</w:t></w:r></w:ins></w:p>' +
      '<w:p><w:r><w:t>Fin</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const settings = `<w:settings ${W}><w:zoom w:percent="100"/><w:trackRevisions/><w:defaultTabStop w:val="708"/></w:settings>`;
    const rels =
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>';
    const read = importDocx(zipSync({ 'word/document.xml': strToU8(document), 'word/settings.xml': strToU8(settings), 'word/_rels/document.xml.rels': strToU8(rels) }));
    expect(read.trackRevisions).toBe(true);
    expect(shown(read)).toEqual(['Se paga [-cien-]{+doscientos+} pesos.', '{+Nuevo+}¶+', 'Fin']);
    expect(revisionsOf(read).map((r) => [r.type, r.author, r.text])).toEqual([
      ['delete', 'Ana', 'cien'],
      ['insert', 'Ana', 'doscientos'],
      ['insert', 'Luis', 'Nuevo¶'],
    ]);
    // Untouched, the file is as it was.
    expect(strFromU8(unzipSync(exportDocx(read))['word/document.xml'])).toBe(document);
    // Accepted here, the file says so; and tracking switched off, too.
    const accepted = { ...decideAllRevisions(read, true), trackRevisions: false };
    const files = unzipSync(exportDocx(accepted));
    expect(strFromU8(files['word/document.xml'])).not.toMatch(/w:ins|w:del/);
    expect(strFromU8(files['word/settings.xml'])).not.toContain('trackRevisions');
    expect(texts(importDocx(exportDocx(accepted)))).toEqual(['Se paga doscientos pesos.', 'Nuevo', 'Fin']);
  });

  it('writes the changes made here into a new document, which reads back the same', () => {
    let d = doc('Hola mundo', 'Adiós');
    d = trackEdit(d, insertText(d, { para: 0, offset: 4 }, ' cruel').doc, ANA).doc;
    d = trackEdit(d, deleteRange(d, { from: { para: 0, offset: 11 }, to: { para: 1, offset: 0 } }), LUIS).doc;
    const files = unzipSync(exportDocx({ ...d, trackRevisions: true }));
    const xml = strFromU8(files['word/document.xml']);
    expect(xml).toContain('<w:delText xml:space="preserve">mundo</w:delText>');
    expect(xml).toMatch(/<w:pPr>.*<w:rPr><w:del w:id="\d+" w:author="Luis" w:date="2026-10-18T11:00:00Z"\/>/);
    expect(strFromU8(files['word/settings.xml'])).toContain('<w:trackRevisions/>');
    const back = importDocx(exportDocx(d));
    expect(shown(back)).toEqual(shown(d));
    expect(revisionsOf(back).map((r) => r.author)).toEqual(['Ana', 'Luis']);
  });
});

describe('notes while changes are tracked', () => {
  it('puts a note in and takes it out without either being a change to the text', () => {
    const start = doc('El precio se cubrirá de contado');
    const noted = addNote(start, { from: { para: 0, offset: 22 }, to: { para: 0, offset: 32 } }, { text: '¿Con crédito?', author: 'Luis' });
    const tracked = trackEdit(start, noted.doc, LUIS).doc;
    expect(revisionsOf(tracked)).toEqual([]);
    expect(tracked.notes).toHaveLength(1);
    // Typed beside it, the text is still a change; the note is not.
    const typed = trackEdit(tracked, insertText(tracked, { para: 0, offset: 0 }, 'Nota: ').doc, LUIS).doc;
    expect(revisionsOf(typed).map((r) => r.text)).toEqual(['Nota: ']);
    const removed = trackEdit(typed, removeNote(typed, noted.id!), LUIS).doc;
    expect(revisionsOf(removed).map((r) => r.text)).toEqual(['Nota: ']);
    expect(texts(removed)).toEqual(['Nota: El precio se cubrirá de contado']);
  });
});
