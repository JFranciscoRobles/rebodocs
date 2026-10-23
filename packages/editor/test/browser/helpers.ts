// What the tests of the editor in a browser share: an editor on the page,
// as wide as a window, and the mouse, the fingers and the clipboard as the
// browser gives them to it.

import { type Doc, type Position, createDoc, createParagraph, paragraphText } from '@rebodocs/core/internal';
import { afterEach } from 'vitest';
import { Editor } from '../../src/index';

const mounted: { editor: Editor; box: HTMLElement }[] = [];

afterEach(() => {
  for (const { editor, box } of mounted.splice(0)) {
    editor.destroy();
    box.remove();
  }
});

/** A frame of the browser, for what it draws to be there. */
export const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));

/** An editor on the page, with paragraphs of these texts, or this document. */
export async function mount(content: string[] | Doc = ['']): Promise<Editor> {
  const box = document.createElement('div');
  box.style.cssText = 'width: 1000px; height: 800px; overflow: auto; position: relative';
  document.body.append(box);
  const doc = Array.isArray(content) ? createDoc(content.map((text) => createParagraph(text))) : content;
  const editor = new Editor(box, doc);
  mounted.push({ editor, box });
  editor.focus();
  await frame();
  return editor;
}

export const texts = (editor: Editor) => editor.doc.paragraphs.map(paragraphText);

/** Where on the screen a place in the text is: the middle of the caret there. */
export function pointAt(editor: Editor, pos: Position): { x: number; y: number } {
  const keep = editor.selection;
  editor.setSelection(pos);
  const caret = editor.element.querySelector<HTMLElement>('.dx-caret')!.getBoundingClientRect();
  editor.setSelection(keep.anchor, keep.focus);
  return { x: caret.left + 1, y: caret.top + caret.height / 2 };
}

/** The mouse, pressed at a point, moved and let go, as the browser says it. */
export function mouse(type: 'mousedown' | 'mousemove' | 'mouseup', { x, y }: { x: number; y: number }, init: MouseEventInit = {}): void {
  // What is under the pointer, as for a real mouse; the editor listens for moves and releases on the window, which they reach.
  const target = document.elementFromPoint(x, y) ?? document.body;
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, detail: 1, ...init }));
}

export function click(at: { x: number; y: number }, init: MouseEventInit = {}): void {
  mouse('mousedown', at, init);
  mouse('mouseup', at, init);
}

/** A finger, or two, on the pages. */
export function touch(editor: Editor, type: 'touchstart' | 'touchmove' | 'touchend', points: { x: number; y: number }[]): void {
  const target = (points[0] && document.elementFromPoint(points[0].x, points[0].y)) || editor.element;
  const touches = points.map((p, identifier) => new Touch({ identifier, target, clientX: p.x, clientY: p.y }));
  const event = new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : touches, changedTouches: touches });
  target.dispatchEvent(event);
}

/** The field the editor takes keys and text in. */
export const field = (editor: Editor) => editor.element.querySelector<HTMLTextAreaElement>('.dx-input')!;

/** What the clipboard is given by a copy or a cut, and what a paste gives. */
export function clipboard(editor: Editor, type: 'copy' | 'cut' | 'paste', data: Record<string, string> = {}): DataTransfer {
  const transfer = new DataTransfer();
  for (const [kind, value] of Object.entries(data)) transfer.setData(kind, value);
  field(editor).dispatchEvent(new ClipboardEvent(type, { bubbles: true, cancelable: true, clipboardData: transfer }));
  return transfer;
}
