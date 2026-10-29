// The pieces of interface around the editor, driven as a person does: the
// toolbar and its menus, the side panel and its tabs, the status bar; and
// pictures pasted from Word and from a page.

/// <reference types="vite/client" />

import { type Doc, createDoc, createParagraph, paragraphText, setParagraphStyle } from '@rebodocs/core/internal';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Editor, createBubble, createPanel, createStatusBar, createToolbar, setLocale } from '../../src/index';
import wordHtml from '../fixtures/word-mac-pictures.html?raw';
import { clipboard, frame, mount, pointAt, texts } from './helpers';

const pieces: { destroy(): void }[] = [];
const boxes: HTMLElement[] = [];
beforeEach(() => setLocale('en'));
afterEach(() => {
  for (const piece of pieces.splice(0)) piece.destroy();
  for (const box of boxes.splice(0)) box.remove();
});

/** A box on the page for a piece of interface, taken away after the test. */
function box(): HTMLElement {
  const node = document.createElement('div');
  document.body.prepend(node);
  boxes.push(node);
  return node;
}

async function withToolbar(content: string[] | Doc): Promise<{ editor: Editor; bar: HTMLElement }> {
  const editor = await mount(content);
  const bar = box();
  pieces.push(createToolbar(bar, editor, {}));
  await frame();
  return { editor, bar };
}

const control = (root: HTMLElement, name: string) => root.querySelector<HTMLElement>(`[data-name="${name}"]`)!;
const press = async (root: HTMLElement, name: string) => {
  control(root, name).click();
  await frame();
};

describe('the toolbar', () => {
  it('makes the selection bold, says so on its button, and undoes it', async () => {
    const { editor, bar } = await withToolbar(['Hello world']);
    editor.setSelection({ para: 0, offset: 0 }, { para: 0, offset: 5 });
    await frame();
    expect(control(bar, 'bold').getAttribute('aria-pressed')).toBe('false');
    expect((control(bar, 'redo') as HTMLButtonElement).disabled).toBe(true);
    await press(bar, 'bold');
    expect(editor.doc.paragraphs[0].runs[0]).toMatchObject({ text: 'Hello', props: { bold: true } });
    expect(control(bar, 'bold').getAttribute('aria-pressed')).toBe('true');
    await press(bar, 'undo');
    expect(editor.doc.paragraphs[0].runs[0].props.bold).toBeFalsy();
    expect((control(bar, 'redo') as HTMLButtonElement).disabled).toBe(false);
  });

  it('gives a paragraph a style and a size from its lists', async () => {
    const { editor, bar } = await withToolbar(['A title', 'Some text']);
    editor.setSelection({ para: 0, offset: 2 });
    await frame();
    const style = control(bar, 'style') as HTMLSelectElement;
    const heading = [...style.options].find((option) => option.text === 'Heading 1')!;
    style.value = heading.value;
    style.dispatchEvent(new Event('change'));
    await frame();
    expect(editor.activeStyleId()).toBe('Heading1');
    editor.setSelection({ para: 1, offset: 0 }, { para: 1, offset: 4 });
    const size = control(bar, 'size') as HTMLSelectElement;
    size.value = '18';
    size.dispatchEvent(new Event('change'));
    await frame();
    expect(editor.activeRunProps().fontSize).toBe(18);
  });

  it('opens a menu under its button, takes a choice from it and closes it', async () => {
    const { editor, bar } = await withToolbar(['Centred, in the end']);
    const align = control(bar, 'align');
    await press(bar, 'align');
    expect(align.getAttribute('aria-expanded')).toBe('true');
    expect(control(bar, 'align-left').getAttribute('aria-checked')).toBe('true');
    await press(bar, 'align-center');
    expect(editor.activeParagraphProps().align).toBe('center');
    expect(bar.querySelector('.dx-tb-pop')).toBeNull();
    expect(align.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a menu from the keyboard, and Escape gives the keyboard back to its button', async () => {
    const { bar } = await withToolbar(['Text']);
    const spacing = control(bar, 'spacing');
    spacing.focus();
    spacing.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await frame();
    const pop = bar.querySelector('.dx-tb-pop')!;
    expect(pop).not.toBeNull();
    expect(pop.contains(document.activeElement)).toBe(true);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await frame();
    expect(bar.querySelector('.dx-tb-pop')).toBeNull();
    expect(document.activeElement).toBe(spacing);
  });

  it('gives the document back the keyboard when a menu opened with the mouse is closed with Escape', async () => {
    const { editor, bar } = await withToolbar(['Text']);
    await press(bar, 'spacing');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await frame();
    expect(bar.querySelector('.dx-tb-pop')).toBeNull();
    expect(editor.element.contains(document.activeElement)).toBe(true);
  });

  it('puts in a table from the grid of the Insert menu, and enables the Table menu in it', async () => {
    const { editor, bar } = await withToolbar(['']);
    expect((control(bar, 'table') as HTMLButtonElement).disabled).toBe(true);
    await press(bar, 'insert');
    bar.querySelector<HTMLElement>('.dx-tb-cell[aria-label="3 columns by 2 rows"]')!.click();
    await frame();
    expect(editor.doc.tables?.[0].columns).toHaveLength(3);
    expect(editor.doc.tables?.[0].rows).toHaveLength(2);
    expect(editor.inTable).toBe(true);
    expect((control(bar, 'table') as HTMLButtonElement).disabled).toBe(false);
  });

  it('makes a list and indents it', async () => {
    const { editor, bar } = await withToolbar(['One', 'Two']);
    editor.setSelection({ para: 0, offset: 0 }, { para: 1, offset: 3 });
    await press(bar, 'bullet');
    expect(editor.activeListKind()).toBe('bullet');
    expect(control(bar, 'bullet').getAttribute('aria-pressed')).toBe('true');
    editor.setSelection({ para: 1, offset: 0 });
    await press(bar, 'indent');
    expect(editor.doc.paragraphs[1].props.listLevel).toBe(1);
  });

  it('goes round its buttons with the arrows, one stop for the Tab key', async () => {
    const { bar } = await withToolbar(['Text']);
    // Undo and redo have nothing to do yet: the arrows pass over them.
    const bold = control(bar, 'bold');
    bold.focus();
    bold.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await frame();
    expect(document.activeElement).toBe(control(bar, 'italic'));
    const stops = [...bar.querySelectorAll<HTMLElement>('button, select')].filter((node) => node.tabIndex === 0 && !(node as HTMLButtonElement).disabled && node.getClientRects().length > 0);
    expect(stops).toEqual([control(bar, 'italic')]);
    control(bar, 'italic').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(control(bar, 'style'));
  });
});

describe('the side panel', () => {
  async function withPanel(doc: Doc) {
    const editor = await mount(doc);
    const side = box();
    const panel = createPanel(side, editor);
    pieces.push(panel);
    return { editor, side, panel };
  }

  it('lists the headings, goes to one, and follows them as they are written', async () => {
    let doc = createDoc(['Terms', 'Text of the terms', 'Payment', 'Text of payment'].map((text) => createParagraph(text)));
    doc = setParagraphStyle(setParagraphStyle(doc, 0, 0, 'Heading1'), 2, 2, 'Heading1');
    const { editor, side, panel } = await withPanel(doc);
    panel.show('outline');
    await frame();
    const items = () => [...side.querySelectorAll<HTMLElement>('.dx-pn-item')];
    expect(items().map((node) => node.textContent)).toEqual(['Terms', 'Payment']);
    items()[1].click();
    expect(editor.selection.focus.para).toBe(2);
    editor.setSelection({ para: 2, offset: 7 });
    editor.insertText(' and late payment');
    await frame();
    expect(items().map((node) => node.textContent)).toEqual(['Terms', 'Payment and late payment']);
  });

  it('fills a variable from its box', async () => {
    const { editor, side, panel } = await withPanel(createDoc([createParagraph('For {{client}} in {{city}}')]));
    panel.show('variables');
    await frame();
    const input = side.querySelector<HTMLInputElement>('input[aria-label="Value of Client"]')!;
    input.value = 'Ana López';
    input.dispatchEvent(new Event('input'));
    input.closest('.dx-pn-frow')!.querySelector<HTMLElement>('[data-name="variable-fill"]')!.click();
    await frame();
    expect(texts(editor)).toEqual(['For Ana López in {{city}}']);
  });

  it('writes a note on the selection, and takes it away', async () => {
    const { editor, side, panel } = await withPanel(createDoc([createParagraph('Check this word')]));
    editor.setSelection({ para: 0, offset: 11 }, { para: 0, offset: 15 });
    panel.show('notes');
    await frame();
    const text = side.querySelector<HTMLTextAreaElement>('.dx-pn-new textarea, textarea')!;
    text.value = 'Which word?';
    text.dispatchEvent(new Event('input'));
    control(side, 'note-add').click();
    await frame();
    expect(editor.notes.map((note) => note.text)).toEqual(['Which word?']);
    const card = side.querySelector<HTMLElement>('.dx-pn-card')!;
    expect(card.querySelector('.dx-pn-quote')!.textContent).toBe('«word»');
    [...card.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Delete note')!.click();
    await frame();
    expect(editor.notes).toHaveLength(0);
  });

  it('tracks changes from its switch, lists one, and accepts it', async () => {
    const { editor, side, panel } = await withPanel(createDoc([createParagraph('Payment in 15 days')]));
    panel.show('changes');
    await frame();
    const track = control(side, 'changes-track') as HTMLInputElement;
    track.checked = true;
    track.dispatchEvent(new Event('change'));
    expect(editor.trackChanges).toBe(true);
    editor.setSelection({ para: 0, offset: 18 });
    editor.insertText(', by transfer');
    await frame();
    expect(side.querySelectorAll('.dx-pn-chg')).toHaveLength(1);
    control(side, 'change-accept').click();
    await frame();
    expect(editor.hasRevisions).toBe(false);
    expect(texts(editor)).toEqual(['Payment in 15 days, by transfer']);
  });

  it('opens and closes from its tabs', async () => {
    const { side, panel } = await withPanel(createDoc([createParagraph('Text')]));
    panel.show('notes');
    await frame();
    expect(panel.isOpen).toBe(true);
    expect(control(side, 'notes').getAttribute('aria-selected')).toBe('true');
    control(side, 'changes').click();
    await frame();
    expect(control(side, 'changes').getAttribute('aria-selected')).toBe('true');
    panel.hide();
    expect(panel.isOpen).toBe(false);
  });
});

describe('the status bar', () => {
  it('counts the words, changes the view and the zoom', async () => {
    const editor = await mount(['One two three', 'four']);
    const bar = box();
    pieces.push(createStatusBar(bar, editor));
    await frame();
    expect(control(bar, 'words').textContent).toContain('4');
    await press(bar, 'flow');
    expect(editor.view).toBe('flow');
    expect(control(bar, 'flow').getAttribute('aria-pressed')).toBe('true');
    await press(bar, 'column');
    const zoom = editor.zoom;
    await press(bar, 'zoom-in');
    expect(editor.zoom).toBeGreaterThan(zoom);
    await press(bar, 'zoom-reset');
    expect(editor.zoom).toBe(1);
  });
});

describe('the other button', () => {
  /** The pages pressed with the other button at a point, as the browser says it: true when it kept its own menu. */
  const otherButton = ({ x, y }: { x: number; y: number }) =>
    (document.elementFromPoint(x, y) ?? document.body).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }));
  const labels = () => [...document.querySelectorAll<HTMLElement>('.dx-bb.dx-bb-open > button')].map((node) => node.textContent);

  it('offers copying, cutting and pasting the selection in place of the browser menu, and keeps it', async () => {
    const editor = await mount(['Hello world']);
    pieces.push(createBubble(editor));
    editor.setSelection({ para: 0, offset: 0 }, { para: 0, offset: 5 });
    expect(otherButton(pointAt(editor, { para: 0, offset: 2 }))).toBe(false);
    await frame();
    expect(editor.selectedText).toBe('Hello');
    expect(labels()).toEqual(expect.arrayContaining(['Copy', 'Cut']));
  });

  it('puts the caret where it was pressed outside the selection', async () => {
    const editor = await mount(['Hello world']);
    pieces.push(createBubble(editor));
    editor.setSelection({ para: 0, offset: 0 }, { para: 0, offset: 5 });
    otherButton(pointAt(editor, { para: 0, offset: 8 }));
    await frame();
    expect(editor.collapsed).toBe(true);
    expect(editor.selection.focus).toEqual({ para: 0, offset: 8 });
    expect(labels()).toContain('Select all');
    expect(labels()).not.toContain('Copy');
  });

  it('leaves the browser menu alone where nothing offers another', async () => {
    const editor = await mount(['Hello world']);
    expect(otherButton(pointAt(editor, { para: 0, offset: 2 }))).toBe(true);
  });
});

describe('pasting pictures', () => {
  const until = async (done: () => boolean) => {
    for (let i = 0; i < 50 && !done(); i++) await new Promise((r) => setTimeout(r, 20));
  };
  const pictures = (editor: Editor) => editor.doc.paragraphs.flatMap((p) => p.runs.filter((r) => r.props.objectWidth).map((r) => [r.props.objectWidth, r.props.objectHeight]));

  it('puts in the pictures of what Word for Mac copied, at their size, with its text', async () => {
    const editor = await mount(['']);
    clipboard(editor, 'paste', { 'text/plain': 'Before the picture\nAfter it.', 'text/html': wordHtml });
    await until(() => pictures(editor).length > 0);
    expect(texts(editor).map((text) => text.replace(/￼/g, '▣'))).toEqual(['Before the picture ▣', 'After it.▣']);
    expect(pictures(editor)).toEqual([
      [60, 30],
      [45, 45],
    ]);
    expect(Object.values(editor.doc.media ?? {}).map((m) => m.type)).toEqual(['image/jpeg', 'image/jpeg']);
  });

  it('copies a picture with its text and pastes it back, and undoes it in one step', async () => {
    const editor = await mount(['A logo: ']);
    const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    editor.setSelection({ para: 0, offset: 8 });
    editor.insertImage(PNG, 'image/png', 40, 40);
    editor.setSelection({ para: 0, offset: 0 }, { para: 0, offset: 9 });
    const copied = clipboard(editor, 'copy');
    expect(copied.getData('text/html')).toContain('<img src="data:image/png;base64,');
    editor.setSelection({ para: 0, offset: 9 });
    clipboard(editor, 'paste', { 'text/plain': copied.getData('text/plain'), 'text/html': copied.getData('text/html'), 'application/x-rebodocs': copied.getData('application/x-rebodocs') });
    await until(() => pictures(editor).length === 2);
    expect(pictures(editor)).toEqual([
      [40, 40],
      [40, 40],
    ]);
    editor.undo();
    expect(pictures(editor)).toHaveLength(1);
    expect(paragraphText(editor.doc.paragraphs[0])).toBe('A logo: ￼');
  });
});
