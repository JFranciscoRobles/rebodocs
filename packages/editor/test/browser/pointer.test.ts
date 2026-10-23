// The mouse and the fingers: where a click puts the caret, what a double and
// a triple click select, dragging a selection out, and the same by touch.

import { describe, expect, it } from 'vitest';
import { click, frame, mount, mouse, pointAt, texts, touch } from './helpers';

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

describe('the editor, with the mouse', () => {
  it('puts the caret where it is clicked', async () => {
    const editor = await mount(['primera línea', 'segunda línea']);
    const at = pointAt(editor, { para: 1, offset: 4 });
    editor.setSelection({ para: 0, offset: 0 });
    click(at);
    expect(editor.selection.focus).toEqual({ para: 1, offset: 4 });
    expect(editor.collapsed).toBe(true);
  });

  it('selects a word with a double click, and a paragraph with three', async () => {
    const editor = await mount(['uno dos tres']);
    const at = pointAt(editor, { para: 0, offset: 5 });
    click(at, { detail: 2 });
    expect(editor.selectedText).toBe('dos');
    click(at, { detail: 3 });
    expect(editor.selectedText).toBe('uno dos tres');
  });

  it('draws a selection out by dragging, and widens it with Shift', async () => {
    const editor = await mount(['de aquí hasta allá', 'y más']);
    const from = pointAt(editor, { para: 0, offset: 3 });
    const to = pointAt(editor, { para: 1, offset: 1 });
    mouse('mousedown', from);
    mouse('mousemove', to);
    mouse('mouseup', to);
    expect(editor.selection).toEqual({ anchor: { para: 0, offset: 3 }, focus: { para: 1, offset: 1 } });
    click(pointAt(editor, { para: 1, offset: 5 }), { shiftKey: true });
    expect(editor.selection).toEqual({ anchor: { para: 0, offset: 3 }, focus: { para: 1, offset: 5 } });
  });

  it('goes into the header with a double click, and back to the text', async () => {
    const editor = await mount(['cuerpo']);
    const page = editor.pageBounds(0);
    const header = { x: page.left + page.width / 2, y: page.top + 30 };
    click(header, { detail: 2 });
    expect(editor.area).toBe('header');
    editor.insertText('Encabezado');
    editor.setArea('body');
    expect(editor.area).toBe('body');
    expect(texts(editor)).toEqual(['cuerpo']);
    const story = editor.doc.header?.paragraphs.map((p) => p.runs.map((r) => r.text).join(''));
    expect(story).toEqual(['Encabezado']);
  });
});

describe('the editor, by touch', () => {
  it('puts the caret where it is tapped, and selects a word held down', async () => {
    const editor = await mount(['tocar aquí']);
    const at = pointAt(editor, { para: 0, offset: 7 });
    editor.setSelection({ para: 0, offset: 0 });
    touch(editor, 'touchstart', [at]);
    touch(editor, 'touchend', [at]);
    expect(editor.selection.focus).toEqual({ para: 0, offset: 7 });
    expect(editor.element.classList.contains('dx-touch')).toBe(true);
    // Held still: the word under the finger.
    await wait(700);
    touch(editor, 'touchstart', [at]);
    await wait(700);
    touch(editor, 'touchend', [at]);
    expect(editor.selectedText).toBe('aquí');
  });

  it('makes the pages larger with two fingers drawn apart', async () => {
    const editor = await mount(['zoom']);
    const page = editor.pageBounds(0);
    const middle = { x: page.left + page.width / 2, y: page.top + 200 };
    const before = editor.zoom;
    touch(editor, 'touchstart', [
      { x: middle.x - 50, y: middle.y },
      { x: middle.x + 50, y: middle.y },
    ]);
    touch(editor, 'touchmove', [
      { x: middle.x - 100, y: middle.y },
      { x: middle.x + 100, y: middle.y },
    ]);
    await frame();
    touch(editor, 'touchend', []);
    expect(editor.zoom).toBeGreaterThan(before * 1.5);
  });
});
