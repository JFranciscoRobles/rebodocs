// What is on the pages besides text, and what is taken hold of with the
// mouse: pictures, the edges of a table, the others' carets, notes; and the
// shortcuts that put things in, the zoom, and what a screen reader is told.

import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { click, frame, mount, mouse, texts } from './helpers';

/** A picture of one white pixel. */
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
const middle = (el: Element) => {
  const box = el.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

describe('pictures and tables, with the mouse', () => {
  it('selects a picture with a click, and makes it larger by its corner', async () => {
    const editor = await mount(['antes ']);
    editor.setSelection({ para: 0, offset: 6 });
    editor.insertImage(PNG, 'image/png', 100, 100);
    await frame();
    editor.setSelection({ para: 0, offset: 0 });
    click(middle(editor.element.querySelector('.dx-object')!));
    expect(editor.pictureSelected).toBe(true);
    await frame();
    const corner = middle(editor.element.querySelector('.dx-objh-se')!);
    mouse('mousedown', corner);
    mouse('mousemove', { x: corner.x + 60, y: corner.y + 60 });
    mouse('mouseup', { x: corner.x + 60, y: corner.y + 60 });
    const picture = editor.doc.paragraphs[0].runs.find((run) => run.props.objectWidth)!;
    expect(picture.props.objectWidth).toBeGreaterThan(100);
  });

  it('moves the edge between two columns of a table by dragging it', async () => {
    const editor = await mount(['']);
    editor.insertTable(2, 2);
    await frame();
    const before = editor.doc.tables![0].columns[0];
    const cell = editor.element.querySelector('.dx-cell')!.getBoundingClientRect();
    const edge = { x: cell.right, y: cell.top + cell.height / 2 };
    mouse('mousemove', edge);
    mouse('mousedown', edge);
    mouse('mousemove', { x: edge.x + 50, y: edge.y });
    mouse('mouseup', { x: edge.x + 50, y: edge.y });
    expect(editor.doc.tables![0].columns[0]).toBeGreaterThan(before);
  });
});

describe('what else is on the pages', () => {
  it('draws the others where they are, with their names', async () => {
    const editor = await mount(['juntos']);
    editor.setPeers([{ name: 'Luis', color: '1A73E8', page: 0, anchor: { para: 0, offset: 2 }, focus: { para: 0, offset: 2 } }]);
    await frame();
    const peer = editor.element.querySelector('.dx-peer');
    expect(peer?.textContent).toContain('Luis');
  });

  it('keeps a note on what is selected, and shows where it is', async () => {
    const editor = await mount(['revisar esto']);
    editor.setSelection({ para: 0, offset: 8 }, { para: 0, offset: 12 });
    const id = editor.addNote('¿seguro?');
    expect(id).toBeDefined();
    expect(editor.notes.map((note) => note.text)).toEqual(['¿seguro?']);
    await frame();
    expect(editor.element.querySelectorAll('.dx-note').length).toBeGreaterThan(0);
  });
});

describe('the shortcuts, the zoom and the screen reader', () => {
  it('puts in a footnote, an endnote and a page break with their keys', async () => {
    const editor = await mount(['texto']);
    editor.setSelection({ para: 0, offset: 5 });
    await userEvent.keyboard('{Control>}{Alt>}f{/Alt}{/Control}');
    expect(editor.footnotes).toHaveLength(1);
    editor.setArea('body');
    editor.setSelection({ para: 0, offset: editor.doc.paragraphs[0].runs.map((r) => r.text).join('').length });
    await userEvent.keyboard('{Control>}{Alt>}d{/Alt}{/Control}');
    expect(editor.endnotes).toHaveLength(1);
    editor.setArea('body');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(editor.pageCount).toBe(2);
  });

  it('zooms with Ctrl and the wheel', async () => {
    const editor = await mount(['zoom']);
    const before = editor.zoom;
    editor.element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -200, clientX: 300, clientY: 300 }));
    expect(editor.zoom).toBeGreaterThan(before);
  });

  it('says what the caret moves over', async () => {
    const editor = await mount(['hola']);
    editor.setSelection({ para: 0, offset: 0 });
    await userEvent.keyboard('{ArrowRight}');
    await frame();
    const said = [...editor.element.querySelectorAll('[aria-live]')].map((el) => el.textContent).join(' ');
    expect(said).toContain('o');
    expect(texts(editor)).toEqual(['hola']);
  });
});
