// What the editor does with the document as a whole: the clipboard, the
// pages it draws, the files it makes, finding, spelling, and text that comes
// from an input method rather than from keys.

import { createDoc, createParagraph, importDocx, paragraphText } from '@rebodocs/core/internal';
import { describe, expect, it } from 'vitest';
import { clipboard, field, frame, mount, texts } from './helpers';

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

describe('the editor and the clipboard', () => {
  it('copies the selection as text, as HTML and as its own, and pastes its own back with its formatting', async () => {
    const editor = await mount(['uno dos']);
    editor.setSelection({ para: 0, offset: 0 }, { para: 0, offset: 3 });
    editor.toggleMark('bold');
    const copied = clipboard(editor, 'copy');
    expect(copied.getData('text/plain')).toBe('uno');
    expect(copied.getData('text/html')).toContain('uno');
    const own = copied.types.find((type) => type !== 'text/plain' && type !== 'text/html')!;
    editor.setSelection({ para: 0, offset: 7 });
    clipboard(editor, 'paste', { 'text/plain': 'uno', [own]: copied.getData(own) });
    expect(texts(editor)).toEqual(['uno dosuno']);
    expect(editor.doc.paragraphs[0].runs.at(-1)).toMatchObject({ text: 'uno', props: { bold: true } });
  });

  it('cuts, and pastes text and a table from somewhere else', async () => {
    const editor = await mount(['cortar esto']);
    editor.setSelection({ para: 0, offset: 6 }, { para: 0, offset: 11 });
    expect(clipboard(editor, 'cut').getData('text/plain')).toBe(' esto');
    expect(texts(editor)).toEqual(['cortar']);
    clipboard(editor, 'paste', { 'text/plain': ' y pegar\notra' });
    expect(texts(editor)).toEqual(['cortar y pegar', 'otra']);
    clipboard(editor, 'paste', { 'text/plain': 'a b', 'text/html': '<table><tr><td>a</td><td>b</td></tr></table>' });
    expect(editor.doc.tables).toHaveLength(1);
  });
});

describe('the pages it draws', () => {
  it('lays a long document out on pages, and draws only those near the view', async () => {
    const editor = await mount(Array.from({ length: 400 }, (_, i) => `Párrafo ${i} con algo de texto para llenar la línea.`));
    expect(editor.pageCount).toBeGreaterThan(8);
    const pages = editor.element.querySelectorAll('.dx-page');
    expect(pages).toHaveLength(editor.pageCount);
    const drawn = [...pages].filter((page) => page.querySelector('.dx-line, span'));
    expect(drawn.length).toBeLessThan(editor.pageCount);
    expect(drawn.length).toBeGreaterThan(0);
  });

  it('draws the caret, and a selection over what is selected', async () => {
    const editor = await mount(['seleccionado']);
    editor.setSelection({ para: 0, offset: 0 }, { para: 0, offset: 5 });
    await frame();
    expect(editor.element.querySelectorAll('.dx-sel').length).toBeGreaterThan(0);
    editor.setSelection({ para: 0, offset: 3 });
    expect(editor.selectionBounds()).toBeDefined();
  });
});

describe('the files it makes', () => {
  it('gives back a DOCX that reads as what was written, and a PDF', async () => {
    const editor = await mount(['contrato']);
    editor.setSelection({ para: 0, offset: 8 });
    editor.insertParagraphBreak();
    editor.insertText('cláusula');
    expect(importDocx(editor.exportDocx()).paragraphs.map(paragraphText)).toEqual(['contrato', 'cláusula']);
    const pdf = await editor.exportPdf('Contrato');
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    expect(editor.exportMarkdown()).toContain('cláusula');
  });

  it('loads a DOCX in place of what it had', async () => {
    const editor = await mount(['antes']);
    const other = await mount(['después', 'y más']);
    editor.loadDocx(other.exportDocx());
    expect(texts(editor)).toEqual(['después', 'y más']);
    expect(editor.canUndo).toBe(false);
  });
});

describe('finding and spelling', () => {
  it('finds, steps through and replaces', async () => {
    const editor = await mount(['gato y gato', 'otro gato']);
    expect(editor.find('gato')).toBe(3);
    expect(editor.findStep(1)).toBe(true);
    expect(editor.replaceFound('perro')).toBe(true);
    expect(editor.replaceAllFound('perro')).toBe(2);
    expect(texts(editor)).toEqual(['perro y perro', 'otro perro']);
  });

  it('asks a spell checker about the words in view, and replaces one with a suggestion', async () => {
    const editor = await mount(createDoc([createParagraph('esto esta mal escrito')]));
    editor.spellChecker = {
      check: (words) => words.map((word) => word !== 'mal'),
      suggest: () => ['bien'],
    };
    await wait(800);
    await frame();
    editor.setSelection({ para: 0, offset: 11 });
    expect(editor.misspelling).toBeDefined();
    expect(await editor.spellingSuggestions()).toEqual(['bien']);
    editor.replaceMisspelling('bien');
    expect(texts(editor)).toEqual(['esto esta bien escrito']);
  });
});

describe('text from an input method', () => {
  it('shows a word as it is composed, changes it as the keyboard corrects it, and takes what the field is given', async () => {
    const editor = await mount(['a']);
    editor.setSelection({ para: 0, offset: 1 });
    const input = field(editor);
    const start = input.value;
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    input.value = `${start}n`;
    input.dispatchEvent(new InputEvent('input', { data: 'n', inputType: 'insertCompositionText' }));
    expect(texts(editor)).toEqual(['an']);
    // The keyboard makes it another letter before the word is done.
    input.value = `${start}ñ`;
    input.dispatchEvent(new InputEvent('input', { data: 'ñ', inputType: 'insertCompositionText' }));
    expect(texts(editor)).toEqual(['añ']);
    input.dispatchEvent(new CompositionEvent('compositionend', { data: 'ñ' }));
    await frame();
    expect(texts(editor)).toEqual(['añ']);
    // As an on-screen keyboard gives a letter: into the field, with no key.
    input.value = `${input.value}o`;
    input.dispatchEvent(new InputEvent('input', { data: 'o', inputType: 'insertText' }));
    expect(texts(editor)).toEqual(['año']);
  });
});
