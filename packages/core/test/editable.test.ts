import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  addEditableRange,
  addNote,
  createDoc,
  deleteRange,
  docText,
  editableAt,
  editableRanges,
  exportDocx,
  importDocx,
  insertText,
  keepsOutside,
  paragraphText,
  removeEditableRange,
  setParagraphProps,
  setRestricted,
  splitParagraph,
} from '../src/internal';

const base = () =>
  createDoc([
    { props: {}, runs: [{ text: 'Nombre: ________.', props: {} }] },
    { props: {}, runs: [{ text: 'Cláusula fija.', props: {} }] },
  ]);
const visible = (doc: Doc) => docText(doc).replace(/⁠/g, '');
/** A form whose blank, "________", may be changed. */
const form = () => addEditableRange(base(), { from: { para: 0, offset: 8 }, to: { para: 0, offset: 16 } });

describe('stretches that may be changed', () => {
  it('are two marks around the stretch, found again from them', () => {
    const { doc, id } = form();
    expect(visible(doc)).toBe(visible(base()));
    const [range] = editableRanges(doc);
    expect(range.id).toBe(id);
    expect(paragraphText(doc.paragraphs[0]).slice(range.range.from.offset, range.range.to.offset)).toBe('________');
    expect(editableAt(doc, range.range.from)?.id).toBe(id);
    expect(editableAt(doc, { para: 1, offset: 0 })).toBeUndefined();
    expect(editableRanges(removeEditableRange(doc, id))).toEqual([]);
    expect(visible(removeEditableRange(doc, id))).toBe(visible(base()));
  });

  it('may be empty, a place to write in', () => {
    const { doc } = addEditableRange(base(), { from: { para: 1, offset: 0 }, to: { para: 1, offset: 0 } });
    const [range] = editableRanges(doc);
    expect(range.range.from).toEqual(range.range.to);
  });
});

describe('a change in a restricted document', () => {
  it('may change the stretches, break their lines and put notes anywhere', () => {
    const { doc } = form();
    const { from, to } = editableRanges(doc)[0].range;
    const filled = insertText(deleteRange(doc, { from, to }), from, 'Ana López').doc;
    expect(keepsOutside(doc, filled)).toBe(true);
    expect(keepsOutside(doc, splitParagraph(filled, { para: 0, offset: from.offset + 3 }).doc)).toBe(true);
    expect(keepsOutside(doc, addNote(doc, { from: { para: 1, offset: 0 }, to: { para: 1, offset: 8 } }, { text: '¿Seguro?', author: 'Ana' }).doc)).toBe(true);
  });

  it('may not change what is outside them, their marks, or the rest of the document', () => {
    const { doc } = form();
    const { from, to } = editableRanges(doc)[0].range;
    expect(keepsOutside(doc, insertText(doc, { para: 1, offset: 0 }, 'No ').doc)).toBe(false);
    // Backspace at the start of the stretch takes its mark.
    expect(keepsOutside(doc, deleteRange(doc, { from: { para: 0, offset: from.offset - 1 }, to: from }))).toBe(false);
    expect(keepsOutside(doc, deleteRange(doc, { from, to: { para: 0, offset: to.offset + 1 } }))).toBe(false);
    expect(keepsOutside(doc, setParagraphProps(doc, 1, 1, { align: 'center' }))).toBe(false);
    expect(keepsOutside(doc, setRestricted(doc, true))).toBe(false);
  });
});

describe('in a DOCX', () => {
  it('are the marks Word writes, and the restriction Word reads, both back as they went', () => {
    const doc = setRestricted(form().doc, true);
    const bytes = exportDocx(doc);
    const files = unzipSync(bytes);
    const body = strFromU8(files['word/document.xml']);
    expect(body).toMatch(/<w:permStart w:id="0" w:edGrp="everyone"\/>.*________.*<w:permEnd w:id="0"\/>/s);
    expect(strFromU8(files['word/settings.xml'])).toContain('<w:documentProtection w:edit="readOnly" w:enforcement="1"/>');
    const back = importDocx(bytes);
    expect(back.restricted).toBe(true);
    expect(editableRanges(back)).toHaveLength(1);
    const open = exportDocx(setRestricted(back, false));
    expect(strFromU8(unzipSync(open)['word/settings.xml'])).not.toContain('documentProtection');
    expect(importDocx(open).restricted).toBeUndefined();
  });
});
