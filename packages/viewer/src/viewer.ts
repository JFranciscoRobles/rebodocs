// A document only to read: the editor, read only, its pages one under
// another, each whole on the screen, with the status bar floating over them
// (the page one is on, the counts, the fit, the zoom, and the views, whose
// grid sets all the pages out as large as lets them fit). For a file manager,
// a preview, a page that shows a contract: anywhere a document is seen and not
// written. And the first page of a document, for its thumbnail: as the
// element the editor draws, or as a picture.

import { type Doc, importDocx } from '@rebodocs/core/internal';
import { Editor, type StatusBar, createStatusBar } from '@rebodocs/editor';

/** A document: the bytes of a .docx, or one already read with `importDocx` of `@rebodocs/core`. */
export type ViewerSource = Uint8Array | ArrayBuffer | Doc;

const docOf = (source: ViewerSource): Doc => (source instanceof Uint8Array ? importDocx(source) : source instanceof ArrayBuffer ? importDocx(new Uint8Array(source)) : source);

/** How the pages are set out: one under another, each whole on the screen, or all of them at once. */
export type ViewerLayout = 'pages' | 'all';

export interface ViewerOptions {
  /** How the pages are set out at first: one under another ('pages', as it comes), or all at once ('all'). */
  layout?: ViewerLayout;
  /** False to leave out the bar floating over the pages; the layout and the zoom are then the application's. */
  bar?: boolean;
}

export interface Viewer {
  /** The editor that draws the pages, read only. */
  readonly editor: Editor;
  /** How many pages the document has. */
  readonly pages: number;
  readonly layout: ViewerLayout;
  setLayout(mode: ViewerLayout): void;
  /** The browser's print dialog, with the pages as they are laid out: to paper, or to a PDF. */
  print(): void;
  destroy(): void;
}

const STYLE_ID = 'dx-viewer-style';
const CSS = `
.dx-viewer .dx-caret{display:none!important}
.dx-viewer-bar{position:sticky;bottom:14px;z-index:3;display:flex;align-items:center;justify-content:center;height:52px;margin-top:-52px;pointer-events:none}
.dx-viewer-bar .dx-sb{background:none;border:0;box-shadow:none}
`;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** The least width a page is shown at when all of them are, in pixels: an overview, to be read one page at a time. */
const LEAST_WIDE = 140;
/** About the gap the editor leaves between pages, in pixels. */
const GAP = 24;

/**
 * The width each page is shown at so that `pages` pages, each `ratio` times as tall as it is wide, all fit in
 * `width` × `height`, as many across as that takes: the largest that does. When none is as wide as a page is
 * still made out at, pages of a set width, and the rest is scrolled to.
 */
export function pageWidthToFit(pages: number, ratio: number, width: number, height: number): number {
  let best = 0;
  for (let across = 1; across <= pages; across++) {
    const wide = (width - GAP * (across + 1)) / across;
    const rows = Math.ceil(pages / across);
    best = Math.max(best, Math.min(wide, (height - GAP * (rows + 1)) / rows / ratio));
  }
  return best >= LEAST_WIDE ? best : Math.max(LEAST_WIDE, Math.min(220, (width - GAP * 2) / 2));
}

/**
 * A document to read in `container`, which must have a size: the editor, read only, and the status bar floating
 * over its pages. The words are those of the language set with `setLocale`.
 */
export function createViewer(container: HTMLElement, source: ViewerSource, options: ViewerOptions = {}): Viewer {
  injectStyle();
  const editor = new Editor(container, docOf(source));
  editor.readOnly = true;
  container.classList.add('dx-viewer');
  let status: StatusBar | undefined;
  let bar: HTMLElement | undefined;
  if (options.bar !== false) {
    bar = document.createElement('div');
    bar.className = 'dx-viewer-bar';
    container.appendChild(bar);
    status = createStatusBar(bar, editor, { layout: 'floating', page: 'view' });
    // Pages one under another or all at once; a document only read has no notes to open, nor language to set.
    for (const away of bar.querySelectorAll('[data-name="spread"], [data-name="flow"], [data-name="notes"], [data-name="language"]')) away.remove();
  }

  let current: ViewerLayout = options.layout ?? 'pages';
  const setLayout = (mode: ViewerLayout) => {
    current = mode;
    if (mode === 'pages') {
      editor.setView('column');
      editor.setFit('page');
    } else {
      editor.setView('grid');
      // The size of a page at zoom 1, from the one it is shown at now.
      const page = container.querySelector<HTMLElement>('.dx-page');
      const width = (page?.offsetWidth ?? 816) / editor.zoom;
      const ratio = (page?.offsetHeight ?? 1056) / (page?.offsetWidth ?? 816);
      const fits = pageWidthToFit(editor.pageCount, ratio, container.clientWidth, container.clientHeight);
      editor.setZoom(Math.min(1, fits / width));
      // The editor's own gaps and margins are not quite those reckoned: measured once it has drawn, and made smaller
      // until all of it fits, while a page is still made out and the editor goes that small.
      let tries = 0;
      const shrink = () => {
        if (current !== 'all' || tries++ >= 4 || container.scrollHeight <= container.clientHeight + 1) return;
        const smaller = editor.zoom * (container.clientHeight / container.scrollHeight) * 0.99;
        if (smaller * width < LEAST_WIDE) return;
        const before = editor.zoom;
        editor.setZoom(smaller);
        if (editor.zoom !== before) requestAnimationFrame(() => requestAnimationFrame(shrink));
      };
      if (fits >= LEAST_WIDE) requestAnimationFrame(() => requestAnimationFrame(shrink));
    }
    // From the first page, whichever way.
    container.scrollTop = 0;
  };
  setLayout(current);

  // The bar's views set the pages out as the editor does; here, so that all of them fit, or each one does.
  let shownView = editor.view;
  const offChange = editor.onChange(() => {
    if (editor.view === shownView) return;
    shownView = editor.view;
    const mode: ViewerLayout | undefined = editor.view === 'grid' ? 'all' : editor.view === 'column' ? 'pages' : undefined;
    // After the bar has done its own, which sets a zoom of its choosing once the view is set.
    if (mode) setTimeout(() => editor.view === shownView && setLayout(mode));
  });

  return {
    editor,
    get pages() {
      return editor.pageCount;
    },
    get layout() {
      return current;
    },
    setLayout,
    print: () => editor.print(),
    destroy() {
      offChange();
      status?.destroy();
      bar?.remove();
      editor.destroy();
      container.classList.remove('dx-viewer');
    },
  };
}

/** A blob as a data address, for what is drawn inside a picture, which may load nothing from elsewhere. */
const dataUrl = (blob: Blob) =>
  new Promise<string>((done, fail) => {
    const reader = new FileReader();
    reader.onload = () => done(String(reader.result));
    reader.onerror = () => fail(reader.error);
    reader.readAsDataURL(blob);
  });

/** Thumbnails made one at a time: each needs an editor laid out for a moment. */
let making: Promise<unknown> = Promise.resolve();

/**
 * The first page of a document as the editor draws it, for a thumbnail: drawn once out of sight, and given as a copy
 * of that page at its real size, its pictures in it, inside an element of the editor's class so its rules still hold
 * (`data-width` and `data-height` say the size, in pixels), to be shown made smaller.
 */
export function pageThumbnail(source: ViewerSource): Promise<HTMLElement> {
  const made = making.then(async () => {
    const doc = docOf(source);
    const box = document.createElement('div');
    box.setAttribute('aria-hidden', 'true');
    box.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:1400px;overflow:hidden;visibility:hidden;pointer-events:none';
    document.body.appendChild(box);
    const editor = new Editor(box, doc);
    try {
      editor.readOnly = true;
      editor.setZoom(1);
      // Its text is put in the page as it comes into view: a frame or two after.
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const page = box.querySelector<HTMLElement>('.dx-page');
      if (!page) throw new Error('The document has no page to show.');
      // Its pictures as data while the editor holds them: closed, it lets their addresses go.
      const originals = [...page.querySelectorAll('img')];
      await Promise.all(originals.map((img) => img.decode().catch(() => undefined)));
      const copy = page.cloneNode(true) as HTMLElement;
      await Promise.all(
        [...copy.querySelectorAll('img')].map(async (img, i) => {
          try {
            img.src = await dataUrl(await (await fetch(originals[i].src)).blob());
          } catch {
            img.remove();
          }
        }),
      );
      for (const away of copy.querySelectorAll('[contenteditable], textarea, input, .dx-caret, .dx-sel')) away.remove();
      const shell = document.createElement('div');
      shell.className = 'dx-editor dx-readonly';
      shell.dataset.width = String(page.offsetWidth);
      shell.dataset.height = String(page.offsetHeight);
      shell.appendChild(copy);
      return shell;
    } finally {
      editor.destroy();
      box.remove();
    }
  });
  making = made.catch(() => undefined);
  return made;
}

export interface PagePictureOptions {
  /** 'image/jpeg', as it comes, or 'image/png'. */
  type?: string;
  /** Of a JPEG, from 0 to 1. */
  quality?: number;
}

/**
 * The first page of a document as a picture, its longest side `size` pixels: what the editor draws, put in an SVG
 * with the editor's stylesheet and drawn on a canvas, its pictures in it. A font the document carries is drawn in
 * the one of the system nearest it.
 */
export async function pagePicture(source: ViewerSource, size: number, options: PagePictureOptions = {}): Promise<Blob> {
  const shell = await pageThumbnail(source);
  const width = Number(shell.dataset.width) || 816;
  const height = Number(shell.dataset.height) || 1056;
  // What is drawn on a canvas inside the page, as a picture: an SVG drawn as a picture reaches nothing outside it.
  for (const canvas of shell.querySelectorAll('canvas')) {
    const img = document.createElement('img');
    img.src = canvas.toDataURL();
    img.style.cssText = canvas.style.cssText;
    canvas.replaceWith(img);
  }
  const css = [...document.querySelectorAll('style')]
    .map((style) => style.textContent ?? '')
    .filter((text) => text.includes('.dx-'))
    .join('\n');
  const page = shell.querySelector<HTMLElement>('.dx-page');
  if (page) page.style.cssText += ';position:absolute;left:0;top:0;margin:0;box-shadow:none;transform:none';
  const xhtml = new XMLSerializer().serializeToString(shell);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:#fff;position:relative"><style>${css.replace(/]]>/g, '')}</style>${xhtml}</div></foreignObject></svg>`;
  const picture = new Image();
  picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await picture.decode();
  const scale = size / Math.max(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(picture, 0, 0, canvas.width, canvas.height);
  return new Promise((done, fail) => canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error('The page could not be drawn.'))), options.type ?? 'image/jpeg', options.quality ?? 0.85));
}
