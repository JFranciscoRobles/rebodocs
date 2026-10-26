// A document only to read, and its first page for a thumbnail: the viewer
// read only, one page at a time or all of them at once from its bar, printed
// as it is shown; the page as the editor draws it, and as a picture.

import { createDoc, createParagraph, insertImage } from '@rebodocs/core/internal';
import { afterEach, describe, expect, it } from 'vitest';
import { type Viewer, createViewer, pagePicture, pageThumbnail, pageWidthToFit } from '../../src/index';
import { frame } from './helpers';

const shown: { viewer: Viewer; box: HTMLElement }[] = [];
afterEach(() => {
  for (const { viewer, box } of shown.splice(0)) {
    viewer.destroy();
    box.remove();
  }
});

const long = () => createDoc(Array.from({ length: 220 }, (_, i) => createParagraph(`Cláusula ${i + 1}. Las partes acuerdan lo que sigue, con cuidado y a tiempo.`)));

async function view(doc = long(), options = {}) {
  const box = document.createElement('div');
  box.style.cssText = 'width: 1200px; height: 760px; overflow: auto; position: relative';
  document.body.append(box);
  const viewer = createViewer(box, doc, options);
  shown.push({ viewer, box });
  await frame();
  await frame();
  return { viewer, box };
}

/** A picture of one colour, as PNG bytes, drawn in the page. */
async function png(width: number, height: number, colour: string): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d')!;
  context.fillStyle = colour;
  context.fillRect(0, 0, width, height);
  return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
}

describe('the viewer', () => {
  it('shows the pages one under another, each whole on the screen, read only, with no caret', async () => {
    const { viewer, box } = await view();
    expect(viewer.editor.readOnly).toBe(true);
    expect(viewer.layout).toBe('pages');
    expect(viewer.editor.view).toBe('column');
    expect(viewer.editor.fit).toBe('page');
    expect(viewer.pages).toBeGreaterThan(3);
    const page = box.querySelector<HTMLElement>('.dx-page')!;
    expect(page.offsetHeight).toBeLessThanOrEqual(box.clientHeight);
    viewer.editor.focus();
    await frame();
    const caret = box.querySelector<HTMLElement>('.dx-caret');
    expect(caret ? getComputedStyle(caret).display : 'none').toBe('none');
  });

  it('has the bar over its pages without the notes, the flowing text nor the language, and sets all the pages out from it', async () => {
    const { viewer, box } = await view();
    const bar = box.querySelector('.dx-viewer-bar')!;
    expect(bar.querySelector('[data-name="zoom"]')).not.toBeNull();
    for (const away of ['notes', 'flow', 'spread', 'language']) expect(bar.querySelector(`[data-name="${away}"]`)).toBeNull();
    bar.querySelector<HTMLButtonElement>('[data-name="grid"]')!.click();
    await new Promise((done) => setTimeout(done, 50));
    expect(viewer.layout).toBe('all');
    expect(viewer.editor.view).toBe('grid');
    bar.querySelector<HTMLButtonElement>('[data-name="column"]')!.click();
    await new Promise((done) => setTimeout(done, 50));
    expect(viewer.layout).toBe('pages');
    expect(viewer.editor.fit).toBe('page');
  });

  it('sets a short document all out so that every page fits on the screen', async () => {
    const short = createDoc(Array.from({ length: 60 }, (_, i) => createParagraph(`Línea ${i + 1}, para llenar una hoja y algo más.`)));
    const { viewer, box } = await view(short, { layout: 'all' });
    for (let i = 0; i < 10; i++) await frame();
    expect(viewer.pages).toBeGreaterThan(1);
    expect(box.scrollHeight).toBeLessThanOrEqual(box.clientHeight + 1);
  });

  it('prints its pages', async () => {
    const { viewer } = await view(createDoc([createParagraph('Para imprimir.')]));
    const printed: number[] = [];
    const real = window.print;
    window.print = () => void printed.push(document.querySelectorAll('body > .dx-print .dx-print-page').length);
    try {
      viewer.print();
    } finally {
      window.print = real;
    }
    expect(printed).toEqual([1]);
  });

  it('is gone with its bar when it is destroyed', async () => {
    const { viewer, box } = await view();
    viewer.destroy();
    shown.length = 0;
    expect(box.querySelector('.dx-viewer-bar')).toBeNull();
    expect(box.classList.contains('dx-viewer')).toBe(false);
    box.remove();
  });
});

describe('the first page, for a thumbnail', () => {
  it('reckons pages that all fit, as large as they can be, and a set width for too many', () => {
    const ratio = 11 / 8.5;
    expect(Math.round(pageWidthToFit(1, ratio, 1200, 700) * ratio)).toBe(700 - 48);
    expect(pageWidthToFit(3, ratio, 1200, 700) * ratio).toBeLessThanOrEqual(700);
    expect(pageWidthToFit(80, ratio, 1200, 700)).toBe(220);
  });

  it('is the page the editor draws, with its pictures as data, its size said', async () => {
    let doc = createDoc([createParagraph('Casa Rivera'), createParagraph('')]);
    doc = insertImage(doc, { para: 1, offset: 0 }, { bytes: await png(300, 120, '#0e7c52'), type: 'image/png', width: 300, height: 120 }).doc;
    const thumb = await pageThumbnail(doc);
    expect(thumb.querySelector('.dx-page')).not.toBeNull();
    expect(Number(thumb.dataset.width)).toBeGreaterThan(0);
    expect(Number(thumb.dataset.height)).toBeGreaterThan(Number(thumb.dataset.width));
    expect(thumb.querySelector('img')?.src).toMatch(/^data:image\/png/);
    // Out of sight while it was drawn, and gone after.
    expect(document.querySelectorAll('.dx-editor').length).toBe(0);
  });

  it('is a picture with the pictures of the page in it, where they are', async () => {
    let doc = createDoc([createParagraph('Casa Rivera'), createParagraph('')]);
    doc = insertImage(doc, { para: 1, offset: 0 }, { bytes: await png(300, 120, '#0e7c52'), type: 'image/png', width: 300, height: 120 }).doc;
    const picture = await pagePicture(doc, 640);
    expect(picture.type).toBe('image/jpeg');
    const bitmap = await createImageBitmap(picture);
    expect(Math.max(bitmap.width, bitmap.height)).toBe(640);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(bitmap, 0, 0);
    // A little in from the margin, under the title: the green of the picture.
    const [r, g, b] = context.getImageData(Math.round(bitmap.width * 0.2), Math.round(bitmap.height * 0.18), 1, 1).data;
    expect(Math.abs(r - 14) + Math.abs(g - 124) + Math.abs(b - 82)).toBeLessThan(40);
    expect((await pagePicture(doc, 200, { type: 'image/png' })).type).toBe('image/png');
  });
});
