// A restricted document: only its stretches marked for it may be changed,
// from the keyboard and from the editor's methods alike.

import { editableRanges, paragraphText } from '@rebodocs/core/internal';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { Editor } from '../../src/index';
import { mount, texts } from './helpers';

/** "Nombre: ____ y fecha: ____." with both blanks made stretches that may be changed, and the document restricted. */
async function form(): Promise<Editor> {
  const editor = await mount(['Nombre: ____ y fecha: ____.', 'Cláusula fija.']);
  editor.setSelection({ para: 0, offset: 8 }, { para: 0, offset: 12 });
  editor.makeEditable();
  const start = paragraphText(editor.doc.paragraphs[0]).lastIndexOf('____');
  editor.setSelection({ para: 0, offset: start }, { para: 0, offset: start + 4 });
  editor.makeEditable();
  editor.setRestricted(true);
  return editor;
}
const visible = (editor: Editor) => texts(editor).map((text) => text.replace(/⁠/g, ''));

describe('a restricted document', () => {
  it('takes what is typed in a stretch, and refuses it outside, saying so', async () => {
    const editor = await form();
    let refused = 0;
    editor.onRefused = () => refused++;
    expect(editor.nextEditable()).toBe(true);
    await userEvent.keyboard('Ana');
    expect(visible(editor)[0]).toBe('Nombre: Ana y fecha: ____.');
    editor.setSelection({ para: 1, offset: 3 });
    await userEvent.keyboard('x{Backspace}{Enter}');
    expect(visible(editor)).toEqual(['Nombre: Ana y fecha: ____.', 'Cláusula fija.']);
    expect(refused).toBe(3);
    expect(editor.element.classList.contains('dx-form-nudge')).toBe(true);
  });

  it('keeps the marks of a stretch: Backspace at its start does nothing, and its lines may be broken', async () => {
    const editor = await form();
    editor.nextEditable();
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}');
    expect(visible(editor)[0]).toBe('Nombre:  y fecha: ____.');
    expect(editor.editableRanges).toHaveLength(2);
    await userEvent.keyboard('Ana{Enter}López');
    expect(visible(editor).slice(0, 2)).toEqual(['Nombre: Ana', 'López y fecha: ____.']);
    // What is typed in a stretch is text, not one of its marks.
    expect(editor.doc.paragraphs[1].runs.find((run) => run.text.includes('López'))?.props.object).toBeFalsy();
  });

  it('goes from one stretch to the next with Tab, and back with Shift+Tab, going round', async () => {
    const editor = await form();
    editor.setSelection({ para: 1, offset: 0 });
    await userEvent.keyboard('{Tab}');
    expect(editor.activeEditable).toBe(editor.editableRanges[0].id);
    expect(editor.selectedText).toBe('____');
    await userEvent.keyboard('{Tab}');
    expect(editor.activeEditable).toBe(editor.editableRanges[1].id);
    await userEvent.keyboard('{Tab}');
    expect(editor.activeEditable).toBe(editor.editableRanges[0].id);
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(editor.activeEditable).toBe(editor.editableRanges[1].id);
  });

  it('may be noted on anywhere, but not have its stretches changed until it is open again', async () => {
    const editor = await form();
    editor.setSelection({ para: 1, offset: 0 }, { para: 1, offset: 8 });
    expect(editor.addNote('¿Es correcta?')).toBeDefined();
    expect(editor.notes).toHaveLength(1);
    editor.setSelection({ para: 1, offset: 0 }, { para: 1, offset: 8 });
    expect(editor.makeEditable()).toBeUndefined();
    editor.removeEditable(editor.editableRanges[0].id);
    expect(editor.editableRanges).toHaveLength(2);
    editor.setRestricted(false);
    editor.setSelection({ para: 1, offset: 3 });
    await userEvent.keyboard('x');
    // Open again, a letter goes in outside the stretches; the note's mark is before it, so it is not where it was counted.
    expect(visible(editor)[1].replace('x', '')).toBe('Cláusula fija.');
    expect(editableRanges(editor.doc)).toHaveLength(2);
  });

  it('shades its stretches on the page, an empty one too', async () => {
    const editor = await mount(['Firma: ']);
    editor.setSelection({ para: 0, offset: 7 });
    editor.makeEditable();
    await new Promise((done) => requestAnimationFrame(() => done(undefined)));
    expect(editor.element.querySelectorAll('.dx-field.dx-field-empty')).toHaveLength(1);
    editor.setRestricted(true);
    expect(editor.element.classList.contains('dx-restricted')).toBe(true);
  });
});
