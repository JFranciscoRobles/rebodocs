import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  addNote,
  createDoc,
  deleteRange,
  docText,
  exportDocx,
  importDocx,
  insertText,
  noteExcerpt,
  noteRanges,
  notesAt,
  pruneNotes,
  removeAllNotes,
  removeNote,
  setNoteColor,
  setNoteText,
  variableNotes,
} from '../src/internal';

const base = () =>
  createDoc([
    { props: {}, runs: [{ text: 'El precio es de mil pesos.', props: {} }] },
    { props: {}, runs: [{ text: 'Segundo párrafo.', props: {} }] },
  ]);
const visible = (doc: Doc) => docText(doc).replace(/⁠/g, '');
/** A part of a package, without the attribute that keeps the spaces of a text. */
const part = (bytes: Uint8Array, path: string) => strFromU8(unzipSync(bytes)[path]).replace(/ xml:space="preserve"/g, '');
/** Where `text` starts in a paragraph, counting the marks that take no room. */
const offsetOf = (doc: Doc, para: number, text: string) =>
  doc.paragraphs[para].runs
    .map((r) => r.text)
    .join('')
    .indexOf(text);

describe('notes', () => {
  it('puts a note on a stretch of text, which stays as it was', () => {
    const { doc, id } = addNote(base(), { from: { para: 0, offset: 16 }, to: { para: 0, offset: 25 } }, { text: ' Confirmar el importe ', author: 'Ana', date: '2026-10-12T10:00:00Z' });
    expect(id).toBe('0');
    expect(visible(doc)).toBe(visible(base()));
    expect(doc.notes).toEqual([{ id: '0', author: 'Ana', date: '2026-10-12T10:00:00Z', text: 'Confirmar el importe' }]);
    const [note] = noteRanges(doc);
    expect(noteExcerpt(doc, note.range)).toBe('mil pesos');
    // Its marks move with the text around them.
    const typed = insertText(doc, { para: 0, offset: 0 }, 'Nota: ').doc;
    expect(noteExcerpt(typed, noteRanges(typed)[0].range)).toBe('mil pesos');
    expect(notesAt(doc, { para: 0, offset: 20 }).map((n) => n.id)).toEqual(['0']);
    expect(notesAt(doc, { para: 0, offset: 3 })).toEqual([]);
    // Nothing to say, or nothing to say it about.
    expect(addNote(base(), { from: { para: 0, offset: 3 }, to: { para: 0, offset: 5 } }, { text: '  ', author: 'Ana' }).doc).toEqual(base());
  });

  it('holds several, one inside another and across paragraphs, each with its own id', () => {
    let { doc } = addNote(base(), { from: { para: 0, offset: 3 }, to: { para: 1, offset: 7 } }, { text: 'Larga', author: 'Ana' });
    const at = offsetOf(doc, 0, 'mil');
    doc = addNote(doc, { from: { para: 0, offset: at }, to: { para: 0, offset: at + 3 } }, { text: 'Corta', author: 'Luis' }).doc;
    expect(doc.notes!.map((n) => n.id)).toEqual(['0', '1']);
    expect(noteRanges(doc).map((n) => [n.id, noteExcerpt(doc, n.range)])).toEqual([
      ['0', 'precio es de mil pesos. Segundo'],
      ['1', 'mil'],
    ]);
    // The shortest first: it is the one meant.
    expect(notesAt(doc, { para: 0, offset: offsetOf(doc, 0, 'mil') + 1 }).map((n) => n.id)).toEqual(['1', '0']);
  });

  it('changes what a note says, and takes one away with its marks', () => {
    const { doc } = addNote(base(), { from: { para: 0, offset: 3 }, to: { para: 0, offset: 9 } }, { text: 'Uno', author: 'Ana' });
    const edited = setNoteText(doc, '0', 'Otro texto');
    expect(edited.notes![0].text).toBe('Otro texto');
    expect(setNoteText(doc, '0', '   ')).toBe(doc);
    expect(setNoteText(doc, '7', 'x')).toBe(doc);
    const gone = removeNote(edited, '0');
    expect(gone.notes).toBeUndefined();
    expect(docText(gone)).toBe(docText(base()));
    expect(removeNote(gone, '0')).toBe(gone);
  });

  it('takes every note away at once, with their marks', () => {
    const one = addNote(base(), { from: { para: 0, offset: 3 }, to: { para: 0, offset: 9 } }, { text: 'Uno', author: 'Ana' }).doc;
    const two = addNote(one, { from: { para: 1, offset: 0 }, to: { para: 1, offset: 7 } }, { text: 'Dos', author: 'Luis' }).doc;
    const gone = removeAllNotes(two);
    expect(gone.notes).toBeUndefined();
    expect(noteRanges(gone)).toEqual([]);
    expect(docText(gone)).toBe(docText(base()));
    expect(removeAllNotes(gone)).toBe(gone);
  });

  it('writes them as comments of Word, and reads them back', () => {
    const made = addNote(
      base(),
      { from: { para: 0, offset: 16 }, to: { para: 0, offset: 25 } },
      { text: 'Confirmar <importe>\nCon el cliente', author: 'Ana "la jefa" Pérez', date: '2026-10-12T10:00:00Z' },
    ).doc;
    const bytes = exportDocx(made);
    const document = part(bytes, 'word/document.xml');
    expect(document.replace(/<w:rPr>.*?<\/w:rPr>/g, '')).toContain(
      '<w:commentRangeStart w:id="0"/><w:r><w:t>mil pesos</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>',
    );
    expect(part(bytes, 'word/comments.xml')).toContain(
      '<w:comment w:id="0" w:author="Ana &quot;la jefa&quot; Pérez" w:date="2026-10-12T10:00:00Z" w:initials="A&quot;J">' +
        '<w:p><w:r><w:annotationRef/></w:r><w:r><w:t>Confirmar &lt;importe&gt;</w:t></w:r></w:p><w:p><w:r><w:t>Con el cliente</w:t></w:r></w:p></w:comment>',
    );
    expect(part(bytes, '[Content_Types].xml')).toContain('PartName="/word/comments.xml"');
    expect(part(bytes, 'word/_rels/document.xml.rels')).toContain('/comments" Target="comments.xml"');

    const back = importDocx(bytes);
    expect(back.notes!.map(({ id, author, date, text }) => ({ id, author, date, text }))).toEqual([
      { id: '0', author: 'Ana "la jefa" Pérez', date: '2026-10-12T10:00:00Z', text: 'Confirmar <importe>\nCon el cliente' },
    ]);
    expect(noteRanges(back).map((n) => noteExcerpt(back, n.range))).toEqual(['mil pesos']);
    // Untouched, the file is written with the very comments it had; a second note joins the first.
    expect(part(exportDocx(back), 'word/comments.xml')).toBe(part(bytes, 'word/comments.xml'));
    const two = addNote(back, { from: { para: 1, offset: 0 }, to: { para: 1, offset: 7 } }, { text: 'Otra', author: 'Luis' });
    expect(two.id).toBe('1');
    const again = importDocx(exportDocx(two.doc));
    expect(again.notes!.map((n) => [n.id, n.text])).toEqual([
      ['0', 'Confirmar <importe>\nCon el cliente'],
      ['1', 'Otra'],
    ]);
    expect(noteRanges(again).map((n) => noteExcerpt(again, n.range))).toEqual(['mil pesos', 'Segundo']);
    // Taken away, a note leaves nothing behind in the file.
    const none = exportDocx(removeNote(removeNote(again, '0'), '1'));
    expect(part(none, 'word/document.xml')).not.toContain('w:comment');
    expect(part(none, 'word/comments.xml')).not.toContain('<w:comment ');
  });

  it('keeps the comments of a file it did not write, as they were', () => {
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const comment =
      '<w:comment w:id="4" w:author="Luis" w:initials="L"><w:p><w:pPr><w:pStyle w:val="CommentText"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Revisar</w:t></w:r><w:r><w:t>_esto</w:t></w:r></w:p></w:comment>';
    const paragraph =
      '<w:p><w:r><w:t>Uno </w:t></w:r><w:commentRangeStart w:id="4"/><w:r><w:t>dos</w:t></w:r><w:commentRangeEnd w:id="4"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="4"/></w:r><w:r><w:t>tres</w:t></w:r></w:p>';
    const file = zipSync({
      '[Content_Types].xml': strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),
      'word/document.xml': strToU8(`<w:document ${NS}><w:body>${paragraph}<w:p><w:r><w:t>Final</w:t></w:r></w:p></w:body></w:document>`),
      'word/comments.xml': strToU8(`<w:comments ${NS} xmlns:w14="urn:x">${comment}</w:comments>`),
    });
    const doc = importDocx(file);
    expect(doc.notes!.map((n) => [n.id, n.author, n.text])).toEqual([['4', 'Luis', 'Revisar_esto']]);
    expect(noteRanges(doc).map((n) => noteExcerpt(doc, n.range))).toEqual(['dos']);
    // A new note takes an id the file does not use, and the old comment keeps its formatting.
    const added = addNote(doc, { from: { para: 1, offset: 0 }, to: { para: 1, offset: 5 } }, { text: 'Nueva', author: 'Ana' });
    expect(added.id).toBe('0');
    const out = exportDocx(added.doc);
    expect(part(out, 'word/document.xml')).toContain(paragraph);
    const comments = part(out, 'word/comments.xml');
    expect(comments).toContain(`xmlns:w14="urn:x">${comment}<w:comment w:id="0" w:author="Ana"`);
    // Its text changed, a comment of the file is written anew.
    expect(part(exportDocx(setNoteText(doc, '4', 'Listo')), 'word/comments.xml')).toContain(
      '<w:comment w:id="4" w:author="Luis" w:initials="L"><w:p><w:r><w:annotationRef/></w:r><w:r><w:t>Listo</w:t></w:r></w:p></w:comment>',
    );
  });

  it('drops the note whose text was deleted, when the file is written', () => {
    const { doc } = addNote(base(), { from: { para: 0, offset: 16 }, to: { para: 0, offset: 25 } }, { text: 'Uno', author: 'Ana' });
    // From inside the stretch to past its end: the start is left on its own.
    const cut = deleteRange(doc, { from: { para: 0, offset: offsetOf(doc, 0, 'pesos') }, to: { para: 0, offset: offsetOf(doc, 0, '.') + 1 } });
    expect(noteRanges(cut)).toEqual([]);
    const pruned = pruneNotes(cut);
    expect(pruned.notes).toBeUndefined();
    expect(pruned.paragraphs[0].runs.every((run) => !run.props.object)).toBe(true);
    expect(part(exportDocx(cut), 'word/document.xml')).not.toContain('w:comment');
    expect(pruneNotes(doc)).toBe(doc);
  });

  it('marks a note with a colour, kept in the file where Word leaves it alone', () => {
    const made = addNote(base(), { from: { para: 0, offset: 3 }, to: { para: 0, offset: 9 } }, { text: 'Uno', author: 'Ana; la jefa', date: '2026-10-12T10:00:00Z', color: '#34a853' });
    expect(made.doc.notes![0].color).toBe('34A853');
    const two = addNote(made.doc, { from: { para: 1, offset: 0 }, to: { para: 1, offset: 7 } }, { text: 'Dos', author: 'Luis', date: '2026-10-12T11:00:00Z' }).doc;
    // The usual colour is no colour, and so is one that is not a colour.
    expect(two.notes![1].color).toBeUndefined();
    expect(setNoteColor(two, '1', 'F4B400')).toBe(two);
    expect(setNoteColor(two, '1', 'rojo')).toBe(two);
    const blue = setNoteColor(two, '1', '4285f4');
    expect(blue.notes!.map((n) => n.color)).toEqual(['34A853', '4285F4']);

    const bytes = exportDocx(blue);
    const custom = part(bytes, 'docProps/custom.xml');
    expect(custom).toContain('name="DxNoteColors"><vt:lpwstr>2026-10-12T10:00:00Z|Ana; la jefa|Uno=34A853;2026-10-12T11:00:00Z|Luis|Dos=4285F4</vt:lpwstr>');
    expect(part(bytes, '[Content_Types].xml')).toContain('PartName="/docProps/custom.xml"');
    expect(part(bytes, '_rels/.rels')).toContain('/custom-properties" Target="docProps/custom.xml"');
    const back = importDocx(bytes);
    expect(back.notes!.map((n) => n.color)).toEqual(['34A853', '4285F4']);

    // Back to the usual one, its entry goes; the other properties of a file stay.
    const files = unzipSync(bytes);
    files['docProps/custom.xml'] = strToU8(
      strFromU8(files['docProps/custom.xml']).replace('<property ', '<property fmtid="{X}" pid="7" name="Cliente"><vt:lpwstr>ACME</vt:lpwstr></property><property '),
    );
    const kept = importDocx(zipSync(files));
    const out = part(exportDocx(setNoteColor(setNoteColor(kept, '0', ''), '1', 'EA4335')), 'docProps/custom.xml');
    expect(out).toContain('name="Cliente"><vt:lpwstr>ACME</vt:lpwstr></property>');
    expect(out).toContain('pid="8" name="DxNoteColors"><vt:lpwstr>2026-10-12T11:00:00Z|Luis|Dos=EA4335</vt:lpwstr>');
    expect(out.match(/DxNoteColors/g)).toHaveLength(1);
  });

  it('keeps the colour of each of two notes written by the same person at the same moment', () => {
    const when = { author: 'Docs', date: '2026-10-12T12:00:00Z' };
    let doc = addNote(base(), { from: { para: 0, offset: 3 }, to: { para: 0, offset: 9 } }, { ...when, text: 'Primera; con = signos', color: '4285F4' }).doc;
    doc = addNote(doc, { from: { para: 1, offset: 0 }, to: { para: 1, offset: 7 } }, { ...when, text: 'Segunda', color: '34A853' }).doc;
    doc = addNote(doc, { from: { para: 1, offset: 9 }, to: { para: 1, offset: 12 } }, { ...when, text: 'Tercera, sin color' }).doc;
    const back = importDocx(exportDocx(doc));
    expect(back.notes!.map((n) => [n.text, n.color])).toEqual([
      ['Primera; con = signos', '4285F4'],
      ['Segunda', '34A853'],
      ['Tercera, sin color', undefined],
    ]);
  });
});

describe('notes on variables', () => {
  const template = () => createDoc([{ props: {}, runs: [{ text: 'Vende {{clienteNombre}} el inmueble en {{inmuebleDomicilio}} a {{clienteNombre}}.', props: {} }] }]);
  const at = (doc: Doc, text: string) =>
    doc.paragraphs[0].runs
      .map((r) => r.text)
      .join('')
      .indexOf(text);

  it('says what a note on a variable, or on a part of it, says; once, and nothing for the others', () => {
    let doc = template();
    const name = at(doc, '{{clienteNombre}}');
    doc = addNote(doc, { from: { para: 0, offset: name }, to: { para: 0, offset: name + 17 } }, { text: 'Como viene en la INE', author: 'Ana' }).doc;
    // A note on more text than the variable, and one that only touches it.
    doc = addNote(doc, { from: { para: 0, offset: 0 }, to: { para: 0, offset: at(doc, 'Nombre}}') + 3 } }, { text: 'El vendedor', author: 'Ana' }).doc;
    const second = doc.paragraphs[0].runs
      .map((r) => r.text)
      .join('')
      .lastIndexOf('{{clienteNombre}}');
    doc = addNote(doc, { from: { para: 0, offset: second }, to: { para: 0, offset: second + 17 } }, { text: 'Como viene en la INE', author: 'Luis' }).doc;
    // In the order of the text, each once.
    expect(variableNotes(doc)).toEqual({ clienteNombre: ['El vendedor', 'Como viene en la INE'] });
    // Text right next to it is not on it.
    const after = at(template(), ' el inmueble');
    const next = addNote(template(), { from: { para: 0, offset: after }, to: { para: 0, offset: after + 3 } }, { text: 'No', author: 'Ana' }).doc;
    expect(variableNotes(next)).toEqual({});
  });
});
