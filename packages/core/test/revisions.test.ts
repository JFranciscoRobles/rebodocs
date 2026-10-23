import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  exportDocx,
  importDocx,
  type Doc,
  type Paragraph,
  acceptRevisions,
  addNote,
  applyRunProps,
  deleteRow,
  deleteTable,
  insertColumn,
  insertRow,
  insertTable,
  setParagraphProps,
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
} from '../src/internal';

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
    expect(rejectRevisions(tracked).paragraphs.map((p) => [paragraphText(p), p.props.styleId])).toEqual([
      ['Título', 'Heading1'],
      ['Texto', undefined],
    ]);
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

describe('changes of more than one person', () => {
  /** As `shown`, with what someone took out of another's text as [-…-] inside {+…+}, and a move's halves named. */
  const both = (d: Doc) =>
    d.paragraphs.map((p) =>
      p.runs
        .map((run) => {
          const { revision, insertedBy, revisionMove } = run.props;
          if (revision === 'delete' && insertedBy !== undefined) return `{+[-${run.text}-]+}`;
          const mark = revision === 'insert' ? `{+${run.text}+}` : revision === 'delete' ? `[-${run.text}-]` : run.text;
          return revisionMove ? `${mark}@${revisionMove}` : mark;
        })
        .join(''),
    );

  it('keeps what one person put in and another took out, as two changes, as Word does', () => {
    const start = doc('Pago a 15 días.');
    const luis = trackEdit(start, insertText(start, { para: 0, offset: 10 }, 'naturales ').doc, LUIS).doc;
    expect(shown(luis)).toEqual(['Pago a 15 {+naturales +}días.']);
    // Ana takes Luis's words out: they stay, his and taken out by her.
    const ana = trackEdit(luis, deleteRange(luis, { from: { para: 0, offset: 10 }, to: { para: 0, offset: 20 } }), ANA).doc;
    expect(both(ana)).toEqual(['Pago a 15 {+[-naturales -]+}días.']);
    expect(revisionsOf(ana).map((r) => [r.type, r.author, r.text])).toEqual([
      ['insert', 'Luis', 'naturales '],
      ['delete', 'Ana', 'naturales '],
    ]);
    // Her taking out accepted: the words go. Rejected: they are Luis's again, to decide.
    expect(texts(acceptRevisions(ana, undefined, (c) => c.type === 'delete'))).toEqual(['Pago a 15 días.']);
    expect(shown(rejectRevisions(ana, undefined, (c) => c.type === 'delete'))).toEqual(['Pago a 15 {+naturales +}días.']);
    // His putting in accepted: it is her taking out alone. Rejected: the words never were.
    const accepted = acceptRevisions(ana, undefined, (c) => c.author === 'Luis');
    expect(both(accepted)).toEqual(['Pago a 15 [-naturales -]días.']);
    expect(revisionsOf(accepted).map((r) => [r.type, r.author])).toEqual([['delete', 'Ana']]);
    expect(texts(rejectRevisions(ana, undefined, (c) => c.author === 'Luis'))).toEqual(['Pago a 15 días.']);
    // All accepted, or all rejected: they go either way.
    expect(texts(decideAllRevisions(ana, true))).toEqual(['Pago a 15 días.']);
    expect(texts(decideAllRevisions(ana, false))).toEqual(['Pago a 15 días.']);
    // Into the file as Word writes it, and back.
    const xml = strFromU8(unzipSync(exportDocx(ana))['word/document.xml']);
    expect(xml).toMatch(
      /<w:ins w:id="\d+" w:author="Luis" w:date="[^"]+"><w:del w:id="\d+" w:author="Ana" w:date="[^"]+"><w:r>(<w:rPr>.*?<\/w:rPr>)?<w:delText xml:space="preserve">naturales <\/w:delText><\/w:r><\/w:del><\/w:ins>/,
    );
    expect(both(importDocx(exportDocx(ana)))).toEqual(both(ana));
  });

  it('accepts or rejects the changes of one person, leaving the others', () => {
    const start = doc('Uno dos tres');
    const ana = trackEdit(start, insertText(start, { para: 0, offset: 3 }, ' y medio').doc, ANA).doc;
    const luis = trackEdit(ana, deleteRange(ana, { from: { para: 0, offset: 16 }, to: { para: 0, offset: 20 } }), LUIS).doc;
    expect(shown(luis)).toEqual(['Uno {+y medio +}dos [-tres-]']);
    expect(shown(decideAllRevisions(luis, true, (c) => c.author === 'Luis'))).toEqual(['Uno {+y medio +}dos ']);
    expect(shown(decideAllRevisions(luis, false, (c) => c.author === 'Ana'))).toEqual(['Uno dos [-tres-]']);
  });

  it('reads a move, shows its halves, and decides them together', () => {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const document =
      `<w:document ${W}><w:body>` +
      '<w:p><w:moveFromRangeStart w:id="1" w:author="Ana" w:date="2026-10-01T09:00:00Z" w:name="move1"/><w:moveFrom w:id="2" w:author="Ana" w:date="2026-10-01T09:00:00Z"><w:r><w:t xml:space="preserve">Primero. </w:t></w:r></w:moveFrom><w:moveFromRangeEnd w:id="1"/><w:r><w:t>Segundo.</w:t></w:r>' +
      '<w:moveToRangeStart w:id="3" w:author="Ana" w:date="2026-10-01T09:00:00Z" w:name="move1"/><w:moveTo w:id="4" w:author="Ana" w:date="2026-10-01T09:00:00Z"><w:r><w:t xml:space="preserve"> Primero.</w:t></w:r></w:moveTo><w:moveToRangeEnd w:id="3"/></w:p>' +
      '</w:body></w:document>';
    const read = importDocx(zipSync({ 'word/document.xml': strToU8(document) }));
    expect(both(read)).toEqual(['[-Primero. -]@move1Segundo.{+ Primero.+}@move1']);
    expect(revisionsOf(read).map((r) => [r.type, r.move, r.text])).toEqual([
      ['delete', 'move1', 'Primero. '],
      ['insert', 'move1', ' Primero.'],
    ]);
    // Accepting the place it went to accepts the place it left, and the other way round.
    const to = revisionsOf(read)[1];
    expect(texts(acceptRevisions(read, to.range))).toEqual(['Segundo. Primero.']);
    expect(texts(rejectRevisions(read, revisionsOf(read)[0].range))).toEqual(['Primero. Segundo.']);
    // Written again as what it is to any reader, text taken out and text put in; untouched, as Word wrote it.
    expect(strFromU8(unzipSync(exportDocx(read))['word/document.xml'])).toBe(document);
    const changed = { ...read, paragraphs: [{ ...read.paragraphs[0] }] };
    const xml = strFromU8(unzipSync(exportDocx(changed))['word/document.xml']);
    expect(xml).not.toContain('w:move');
    expect(shown(importDocx(exportDocx(changed)))).toEqual(['[-Primero. -]Segundo.{+ Primero.+}']);
  });
});

describe('changes of formatting', () => {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

  it('keeps the formatting text had, to accept or reject, and forgets it when it is put back', () => {
    const start = doc('Pago a 15 días.');
    const bold = trackEdit(start, applyRunProps(start, { from: { para: 0, offset: 7 }, to: { para: 0, offset: 9 } }, { bold: true }), ANA).doc;
    const run = bold.paragraphs[0].runs.find((r) => r.text === '15')!;
    expect(run.props).toMatchObject({ bold: true, formatChange: { author: 'Ana', before: {} } });
    expect(revisionsOf(bold).map((r) => [r.type, r.author, r.text, r.format])).toEqual([['format', 'Ana', '15', ['bold']]]);
    // Accepted: bold, and nothing to decide. Rejected: as it was.
    const accepted = acceptRevisions(bold);
    expect(accepted.paragraphs[0].runs.find((r) => r.text.includes('15'))!.props).toMatchObject({ bold: true });
    expect(revisionsOf(accepted)).toEqual([]);
    expect(rejectRevisions(bold).paragraphs[0].runs).toEqual([{ text: 'Pago a 15 días.', props: {} }]);
    // Made bold and then italic, by Luis: what it was first is still what rejecting gives.
    const italic = trackEdit(bold, applyRunProps(bold, { from: { para: 0, offset: 7 }, to: { para: 0, offset: 9 } }, { italic: true }), LUIS).doc;
    expect(italic.paragraphs[0].runs.find((r) => r.text === '15')!.props.formatChange).toMatchObject({ author: 'Luis', before: {} });
    // Put back as it was: no change any more.
    const back = trackEdit(bold, applyRunProps(bold, { from: { para: 0, offset: 7 }, to: { para: 0, offset: 9 } }, { bold: false }), ANA).doc;
    expect(revisionsOf(back)).toEqual([]);
  });

  it('keeps the formatting of text just put in as a change of its own, as Word does', () => {
    const start = doc('Uno dos tres.');
    const typed = trackEdit(start, insertText(start, { para: 0, offset: 4 }, 'nuevo ').doc, ANA).doc;
    const bold = trackEdit(typed, applyRunProps(typed, { from: { para: 0, offset: 4 }, to: { para: 0, offset: 9 } }, { bold: true }), ANA).doc;
    expect(revisionsOf(bold).map((r) => [r.type, r.text])).toEqual([
      ['insert', 'nuevo '],
      ['format', 'nuevo'],
    ]);
    // The putting in accepted and the formatting rejected: the word stays, not bold.
    const kept = rejectRevisions(acceptRevisions(bold, undefined, (c) => c.type === 'insert'));
    expect(kept.paragraphs[0].runs).toEqual([{ text: 'Uno nuevo dos tres.', props: {} }]);
    // The putting in rejected: the word goes, and its formatting with it.
    expect(texts(rejectRevisions(bold, undefined, (c) => c.type === 'insert'))).toEqual(['Uno dos tres.']);
  });

  it('keeps the formatting of a paragraph, as a change of the whole paragraph', () => {
    const start = doc('Título', 'Texto');
    const centred = trackEdit(start, setParagraphProps(start, 0, 0, { align: 'center' }), LUIS).doc;
    const [change] = revisionsOf(centred);
    expect(change).toMatchObject({ type: 'format', author: 'Luis', paragraph: true, format: ['align'], range: { from: { para: 0, offset: 0 }, to: { para: 1, offset: 0 } } });
    expect(rejectRevisions(centred).paragraphs[0].props.align).toBeUndefined();
    expect(acceptRevisions(centred).paragraphs[0].props).toEqual({ align: 'center' });
  });

  it('writes the changes of formatting as Word keeps them, and reads them back', () => {
    const start = doc('Pago a 15 días.', 'Fin');
    let changed = trackEdit(start, applyRunProps(start, { from: { para: 0, offset: 7 }, to: { para: 0, offset: 9 } }, { bold: true }), ANA).doc;
    changed = trackEdit(changed, setParagraphProps(changed, 1, 1, { align: 'right' }), LUIS).doc;
    const xml = strFromU8(unzipSync(exportDocx(changed))['word/document.xml']);
    expect(xml).toMatch(/<w:b\/>.*<w:rPrChange w:id="\d+" w:author="Ana" w:date="[^"]+"><w:rPr>(?:(?!<w:b\/>).)*<\/w:rPr><\/w:rPrChange><\/w:rPr><w:t[^>]*>15<\/w:t>/);
    expect(xml).toMatch(/<w:jc w:val="right"\/>(?:<w:rPr>.*?<\/w:rPr>)?<w:pPrChange w:id="\d+" w:author="Luis" w:date="[^"]+"><w:pPr>.*<w:jc w:val="left"\/><\/w:pPr><\/w:pPrChange><\/w:pPr>/);
    const read = importDocx(exportDocx(changed));
    expect(revisionsOf(read).map((r) => [r.type, r.author, r.text, r.format])).toEqual([
      ['format', 'Ana', '15', ['bold']],
      ['format', 'Luis', 'Fin¶', ['align']],
    ]);
    expect(texts(rejectRevisions(read))).toEqual(['Pago a 15 días.', 'Fin']);
    expect(rejectRevisions(read).paragraphs[0].runs.some((r) => resolveBold(r.props))).toBe(false);
  });

  it('reads a change of formatting Word made, and writes it back as it was when untouched', () => {
    const document =
      `<w:document ${W}><w:body>` +
      '<w:p><w:r><w:rPr><w:i/><w:rPrChange w:id="1" w:author="Ana" w:date="2026-10-01T09:00:00Z"><w:rPr/></w:rPrChange></w:rPr><w:t>Hola</w:t></w:r></w:p>' +
      '</w:body></w:document>';
    const read = importDocx(zipSync({ 'word/document.xml': strToU8(document) }));
    expect(revisionsOf(read).map((r) => [r.type, r.author, r.format])).toEqual([['format', 'Ana', ['italic']]]);
    expect(strFromU8(unzipSync(exportDocx(read))['word/document.xml'])).toBe(document);
    const rejected = rejectRevisions(read);
    expect(rejected.paragraphs[0].runs[0].props.italic).toBeFalsy();
    expect(strFromU8(unzipSync(exportDocx(rejected))['word/document.xml'])).not.toContain('rPrChange');
  });
});

const resolveBold = (props: { bold?: boolean }) => !!props.bold;

describe('rows of tables', () => {
  /** A table of two rows, "a | b" and "c | d", between two paragraphs. */
  const table = () => {
    let d = insertTable(doc('Antes', 'Después'), { para: 1, offset: 0 }, 2, 2).doc;
    const cells = d.paragraphs.flatMap((p, i) => (p.cell ? [i] : []));
    ['a', 'b', 'c', 'd'].forEach((text, k) => (d = insertText(d, { para: cells[k], offset: 0 }, text).doc));
    return d;
  };
  const rowsOf = (d: Doc) => d.tables![0].rows.map((row) => [row.id, row.revision?.type ?? '', row.revision?.author ?? '']);
  const cellTexts = (d: Doc) => d.paragraphs.filter((p) => p.cell).map(paragraphText);

  it('marks a row put in, lists it as one change, and keeps or drops it', () => {
    const start = table();
    const added = trackEdit(
      start,
      insertRow(
        start,
        start.paragraphs.findIndex((p) => p.cell),
        true,
      ),
      ANA,
    ).doc;
    expect(rowsOf(added)).toEqual([
      [0, '', ''],
      [2, 'insert', 'Ana'],
      [1, '', ''],
    ]);
    expect(revisionsOf(added).map((r) => [r.type, r.author, r.row])).toEqual([['insert', 'Ana', true]]);
    expect(rowsOf(acceptRevisions(added))).toEqual([
      [0, '', ''],
      [2, '', ''],
      [1, '', ''],
    ]);
    const rejected = rejectRevisions(added);
    expect(rowsOf(rejected)).toEqual([
      [0, '', ''],
      [1, '', ''],
    ]);
    expect(cellTexts(rejected)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps a row taken out, struck through, until the change is decided', () => {
    const start = table();
    const second = start.paragraphs.findIndex((p) => paragraphText(p) === 'c');
    const cut = trackEdit(start, deleteRow(start, second).doc, LUIS).doc;
    expect(rowsOf(cut)).toEqual([
      [0, '', ''],
      [1, 'delete', 'Luis'],
    ]);
    expect(cellTexts(cut)).toEqual(['a', 'b', 'c', 'd']);
    expect(shown(cut).filter((t) => t.includes('c') || t.includes('d'))).toEqual(['[-c-]', '[-d-]']);
    // One change, the row's, not one for each cell's text.
    expect(revisionsOf(cut).map((r) => [r.type, r.author, r.text, r.row])).toEqual([['delete', 'Luis', 'c | d', true]]);
    const accepted = acceptRevisions(cut);
    expect(rowsOf(accepted)).toEqual([[0, '', '']]);
    expect(cellTexts(accepted)).toEqual(['a', 'b']);
    const rejected = rejectRevisions(cut);
    expect(rowsOf(rejected)).toEqual([
      [0, '', ''],
      [1, '', ''],
    ]);
    expect(shown(rejected)).toEqual(shown(start));
    // A whole table taken out: its rows stay, taken out.
    const gone = trackEdit(start, deleteTable(start, second).doc, LUIS).doc;
    expect(rowsOf(gone)).toEqual([
      [0, 'delete', 'Luis'],
      [1, 'delete', 'Luis'],
    ]);
    expect(texts(gone)).toEqual(texts(start));
    expect(texts(acceptRevisions(gone)).filter(Boolean)).toEqual(['Antes', 'Después']);
  });

  it('marks a table put in as rows put in, and writes the rows as Word keeps them', () => {
    const start = doc('Antes', 'Después');
    const made = trackEdit(start, insertTable(start, { para: 1, offset: 0 }, 2, 1).doc, ANA).doc;
    expect(rowsOf(made)).toEqual([
      [0, 'insert', 'Ana'],
      [1, 'insert', 'Ana'],
    ]);
    const xml = strFromU8(unzipSync(exportDocx(made))['word/document.xml']);
    expect(xml.match(/<w:trPr>(?:(?!<\/w:trPr>).)*<w:ins w:id="\d+" w:author="Ana" w:date="[^"]+"\/><\/w:trPr>/g)).toHaveLength(2);
    expect(rowsOf(importDocx(exportDocx(made)))).toEqual([
      [0, 'insert', 'Ana'],
      [1, 'insert', 'Ana'],
    ]);
  });

  it('leaves untracked what it does not track: a column', () => {
    const start = table();
    const wider = insertColumn(
      start,
      start.paragraphs.findIndex((p) => p.cell),
      true,
    );
    expect(trackEdit(start, wider, ANA).doc).toBe(wider);
  });
});
