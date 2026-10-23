// The keyboard: typing, the keys that move and delete, and the shortcuts.

import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { mount, texts } from './helpers';

describe('the editor, from the keyboard', () => {
  it('types, splits and joins paragraphs, and breaks a line', async () => {
    const editor = await mount(['hola']);
    editor.setSelection({ para: 0, offset: 4 });
    await userEvent.keyboard(' mundo{Enter}otro');
    expect(texts(editor)).toEqual(['hola mundo', 'otro']);
    await userEvent.keyboard('{Home}{Backspace}');
    expect(texts(editor)).toEqual(['hola mundootro']);
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(texts(editor)[0]).toContain('\n');
    await userEvent.keyboard('{Tab}');
    expect(texts(editor)[0]).toContain('\t');
  });

  it('moves the caret by letter, word, line and document', async () => {
    const editor = await mount(['uno dos tres', 'cuatro']);
    editor.setSelection({ para: 0, offset: 0 });
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(editor.selection.focus).toEqual({ para: 0, offset: 2 });
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(editor.selection.focus.offset).toBeGreaterThan(2);
    await userEvent.keyboard('{End}');
    expect(editor.selection.focus).toEqual({ para: 0, offset: 12 });
    await userEvent.keyboard('{ArrowDown}');
    expect(editor.selection.focus.para).toBe(1);
    await userEvent.keyboard('{Home}');
    expect(editor.selection.focus).toEqual({ para: 1, offset: 0 });
    await userEvent.keyboard('{Control>}{Home}{/Control}');
    expect(editor.selection.focus).toEqual({ para: 0, offset: 0 });
  });

  it('selects with Shift, formats with the shortcuts, and deletes the selection', async () => {
    const editor = await mount(['negrita aquí']);
    editor.setSelection({ para: 0, offset: 0 });
    await userEvent.keyboard('{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}');
    expect(editor.selectedText).toBe('neg');
    await userEvent.keyboard('{Control>}b{/Control}');
    expect(editor.doc.paragraphs[0].runs[0]).toMatchObject({ text: 'neg', props: { bold: true } });
    await userEvent.keyboard('{Control>}i{/Control}');
    expect(editor.doc.paragraphs[0].runs[0].props.italic).toBe(true);
    await userEvent.keyboard('{Backspace}');
    expect(texts(editor)).toEqual(['rita aquí']);
    await userEvent.keyboard('{Control>}a{/Control}');
    expect(editor.selectedText).toBe('rita aquí');
  });

  it('undoes and redoes from the keyboard, step by step', async () => {
    const editor = await mount(['a']);
    editor.setSelection({ para: 0, offset: 1 });
    await userEvent.keyboard('b{Enter}c');
    expect(texts(editor)).toEqual(['ab', 'c']);
    expect(editor.canUndo).toBe(true);
    await userEvent.keyboard('{Control>}z{/Control}');
    await userEvent.keyboard('{Control>}z{/Control}');
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(texts(editor)).toEqual(['a']);
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(texts(editor)).toEqual(['ab']);
    await userEvent.keyboard('{Control>}y{/Control}');
    expect(texts(editor).length).toBe(2);
  });

  it('deletes forward, and by word', async () => {
    const editor = await mount(['uno dos tres']);
    editor.setSelection({ para: 0, offset: 0 });
    await userEvent.keyboard('{Delete}');
    expect(texts(editor)).toEqual(['no dos tres']);
    await userEvent.keyboard('{End}{Alt>}{Backspace}{/Alt}');
    expect(texts(editor)).toEqual(['no dos ']);
  });

  it('turns tracking of changes on with its keys, and marks what is typed', async () => {
    const editor = await mount(['texto']);
    editor.setSelection({ para: 0, offset: 5 });
    await userEvent.keyboard('{Control>}{Shift>}e{/Shift}{/Control}');
    expect(editor.trackChanges).toBe(true);
    await userEvent.keyboard(' nuevo');
    expect(editor.revisions.length).toBeGreaterThan(0);
    editor.acceptAllRevisions();
    expect(editor.hasRevisions).toBe(false);
    expect(texts(editor)).toEqual(['texto nuevo']);
  });

  it('takes nothing while it is read-only', async () => {
    const editor = await mount(['fijo']);
    editor.readOnly = true;
    editor.setSelection({ para: 0, offset: 4 });
    await userEvent.keyboard('xyz{Enter}{Backspace}');
    expect(texts(editor)).toEqual(['fijo']);
  });

  it('moves between the cells of a table with Tab', async () => {
    const editor = await mount(['']);
    editor.insertTable(2, 2);
    const first = editor.doc.paragraphs.findIndex((p) => p.cell);
    editor.setSelection({ para: first, offset: 0 });
    await userEvent.keyboard('A{Tab}B{Tab}C');
    const cells = editor.doc.paragraphs.filter((p) => p.cell).map((p) => p.runs.map((r) => r.text).join(''));
    expect(cells.slice(0, 3)).toEqual(['A', 'B', 'C']);
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(editor.doc.paragraphs[editor.selection.focus.para].cell).toMatchObject({ row: 0, cell: 1 });
  });
});
