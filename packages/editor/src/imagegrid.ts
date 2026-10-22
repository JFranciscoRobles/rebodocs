// Choosing pictures to put in the document. One goes in where the caret is.
// Several open a dialog that shows them as the grid they will be: how many
// across is chosen there, and they are dragged into the order wanted. It
// only uses the public methods of the editor.

import { MAX_GRID_COLUMNS } from '@rebodocs/core';
import { holdFocus } from './a11y';
import type { Editor } from './editor';
import { plural, t } from './i18n';
import { applyTheme } from './theme';

const STYLE_ID = 'dx-imagegrid-style';
const ACCEPT = 'image/png,image/jpeg,image/gif';

const CSS = `
.dx-ig-scrim{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(20,24,32,.32)}
.dx-ig{display:flex;flex-direction:column;width:640px;max-width:100%;max-height:100%;border-radius:18px;background:var(--dx-ui-bg,#fff);box-shadow:0 12px 40px rgba(47,46,43,.28);font:13px system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-ink,#2f2e2b)}
.dx-ig-top{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--dx-ui-line,#e6e3dc)}
.dx-ig-title{flex:1;font-weight:600;font-size:14px}
.dx-ig-cols{display:flex;align-items:center;gap:4px;color:var(--dx-ui-muted,#5f5d58)}
.dx-ig-cols button{width:30px;height:30px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit;cursor:pointer}
.dx-ig-cols button:hover:not(:disabled){background:var(--dx-ui-hover,#f3f1ec)}
.dx-ig-cols button.dx-on{border-color:var(--dx-ui-active-line,#a8c7fa);background:var(--dx-ui-active,#e8f0fd);color:var(--dx-ui-accent,#0b57d0)}
.dx-ig-cols button:disabled{opacity:.35;cursor:default}
.dx-ig-body{flex:1;min-height:120px;overflow-y:auto;padding:16px;background:var(--dx-ui-line,#e6e3dc)}
.dx-ig-sheet{display:grid;gap:6px;padding:14px;background:var(--dx-ui-bg,#fff);box-shadow:0 1px 4px rgba(47,46,43,.18)}
.dx-ig-cell{position:relative;aspect-ratio:1;border:1px dashed var(--dx-ui-active,#e8f0fd);border-radius:2px;background:var(--dx-ui-bg,#fff);cursor:grab}
.dx-ig-cell img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none}
.dx-ig-cell.dx-ig-drag{opacity:.35}
.dx-ig-cell.dx-ig-drop{border:2px solid var(--dx-ui-accent,#0b57d0)}
.dx-ig-n{position:absolute;left:4px;top:4px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:rgba(32,36,44,.72);color:var(--dx-ui-on-accent,#fff);font-size:11px;line-height:18px;text-align:center}
.dx-ig-x{position:absolute;right:4px;top:4px;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:rgba(32,36,44,.72);color:var(--dx-ui-on-accent,#fff);font:15px/24px system-ui,sans-serif;cursor:pointer;opacity:0}
.dx-ig-mv{position:absolute;bottom:4px;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:rgba(32,36,44,.72);color:var(--dx-ui-on-accent,#fff);font:15px/24px system-ui,sans-serif;cursor:pointer;opacity:0}
.dx-ig-mv:disabled{display:none}
.dx-ig-earlier{left:4px}
.dx-ig-later{right:4px}
.dx-ig-cell:hover .dx-ig-x,.dx-ig-x:focus-visible,.dx-ig-cell:hover .dx-ig-mv,.dx-ig-mv:focus-visible{opacity:1}
@media (hover:none){.dx-ig-x,.dx-ig-mv{opacity:1}}
.dx-ig-foot{display:flex;align-items:center;gap:8px;padding:12px 16px 16px;border-top:1px solid var(--dx-ui-line,#e6e3dc)}
.dx-ig-note{flex:1;color:var(--dx-ui-muted,#5f5d58);font-size:12px;line-height:1.4}
.dx-ig-foot button{height:32px;padding:0 16px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit;white-space:nowrap;cursor:pointer}
.dx-ig-foot button:hover:not(:disabled){background:var(--dx-ui-hover,#f3f1ec)}
.dx-ig-foot button.dx-main{border-color:var(--dx-ui-accent,#0b57d0);background:var(--dx-ui-accent,#0b57d0);color:var(--dx-ui-on-accent,#fff)}
.dx-ig-foot button.dx-main:hover:not(:disabled){background:var(--dx-ui-accent-hover,#08398a)}
.dx-ig-foot button:disabled{opacity:.4;cursor:default}
.dx-ig button:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:2px}
`;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  if (node instanceof HTMLButtonElement) node.type = 'button';
  return node;
}

/** As many across as makes the grid about as wide as it is tall. */
const suggested = (count: number) => Math.max(2, Math.min(Math.ceil(Math.sqrt(count)), 4));

/**
 * Shows the pictures as the grid they will be in the document, to choose how
 * many go across and in which order, and puts them in. Resolves when the
 * dialog is closed, to how many pictures went in.
 */
export function openImageGrid(editor: Editor, files: File[]): Promise<number> {
  injectStyle();
  return new Promise((resolve) => {
    let items = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
    let columns = suggested(items.length);
    /** The place in the grid of the picture being dragged. */
    let dragging: number | undefined;

    const scrim = el('div', 'dx-ig-scrim');
    const dialog = el('div', 'dx-ig');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', t('grid.title'));
    const top = el('div', 'dx-ig-top');
    const title = el('div', 'dx-ig-title');
    const cols = el('div', 'dx-ig-cols');
    cols.append(t('grid.columns'));
    const colButtons = Array.from({ length: MAX_GRID_COLUMNS }, (_, i) => {
      const node = el('button', '', String(i + 1));
      node.dataset.columns = String(i + 1);
      node.addEventListener('click', () => {
        columns = i + 1;
        render();
      });
      cols.appendChild(node);
      return node;
    });
    top.append(title, cols);
    const body = el('div', 'dx-ig-body');
    const sheet = el('div', 'dx-ig-sheet');
    body.appendChild(sheet);
    const foot = el('div', 'dx-ig-foot');
    const note = el('div', 'dx-ig-note');
    const more = el('button', '', t('grid.more'));
    more.dataset.name = 'grid-more';
    const cancel = el('button', '', t('cancel'));
    cancel.dataset.name = 'grid-cancel';
    const accept = el('button', 'dx-main', t('insert'));
    accept.dataset.name = 'grid-accept';
    foot.append(note, more, cancel, accept);
    const picker = el('input', '');
    picker.type = 'file';
    picker.accept = ACCEPT;
    picker.multiple = true;
    picker.hidden = true;
    dialog.append(top, body, foot, picker);
    scrim.appendChild(dialog);

    const render = () => {
      const count = items.length;
      const across = Math.min(columns, Math.max(count, 1));
      const rows = Math.ceil(count / across);
      title.textContent = plural('grid.many', count, { n: count });
      note.textContent = count ? t('grid.note', { across, rows }) : t('grid.empty');
      colButtons.forEach((node, i) => {
        node.classList.toggle('dx-on', i + 1 === across);
        node.setAttribute('aria-pressed', String(i + 1 === across));
        node.disabled = i + 1 > Math.max(count, 1);
      });
      accept.disabled = !count;
      sheet.style.gridTemplateColumns = `repeat(${across}, minmax(0, 1fr))`;
      sheet.replaceChildren(
        ...items.map((item, i) => {
          const cell = el('div', 'dx-ig-cell');
          cell.draggable = true;
          cell.title = item.file.name;
          const img = el('img', '');
          img.src = item.url;
          img.alt = item.file.name;
          const x = el('button', 'dx-ig-x', '×');
          x.title = t('grid.remove');
          x.setAttribute('aria-label', t('grid.removeName', { name: item.file.name }));
          x.addEventListener('click', () => {
            URL.revokeObjectURL(item.url);
            items = items.filter((other) => other !== item);
            render();
            // The button that had the keyboard is gone with its picture.
            if (!dialog.contains(document.activeElement)) (accept.disabled ? more : accept).focus();
          });
          // Moved with a button as well as by dragging: from the keyboard, and by a hand that cannot drag.
          const move = (by: -1 | 1) => {
            const mover = el('button', `dx-ig-mv ${by < 0 ? 'dx-ig-earlier' : 'dx-ig-later'}`, by < 0 ? '‹' : '›');
            mover.title = t(by < 0 ? 'grid.earlier' : 'grid.later', { name: '' }).replace(/\s+/g, ' ').trim();
            mover.setAttribute('aria-label', t(by < 0 ? 'grid.earlier' : 'grid.later', { name: item.file.name }));
            mover.disabled = i + by < 0 || i + by >= items.length;
            mover.addEventListener('click', () => {
              const next = items.slice();
              const [moved] = next.splice(i, 1);
              next.splice(i + by, 0, moved);
              items = next;
              render();
              const to = i + by;
              editor.announce(t('grid.place', { name: item.file.name, n: to + 1, total: items.length }));
              // The keyboard goes with the picture; at an end, to the button that can still move it.
              const cells = sheet.querySelectorAll<HTMLElement>('.dx-ig-cell');
              const same = cells[to]?.querySelector<HTMLButtonElement>(by < 0 ? '.dx-ig-earlier' : '.dx-ig-later');
              (same && !same.disabled ? same : cells[to]?.querySelector<HTMLButtonElement>(by < 0 ? '.dx-ig-later' : '.dx-ig-earlier'))?.focus();
            });
            return mover;
          };
          cell.append(img, el('span', 'dx-ig-n', String(i + 1)), x, move(-1), move(1));
          cell.addEventListener('dragstart', (e) => {
            dragging = i;
            cell.classList.add('dx-ig-drag');
            e.dataTransfer?.setData('text/plain', item.file.name);
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
          });
          cell.addEventListener('dragover', (e) => {
            if (dragging === undefined || dragging === i) return;
            e.preventDefault();
            cell.classList.add('dx-ig-drop');
          });
          cell.addEventListener('dragleave', () => cell.classList.remove('dx-ig-drop'));
          // Dropped on another, a picture takes its place and the ones between move along.
          cell.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dragging === undefined || dragging === i) return;
            const next = items.slice();
            const [moved] = next.splice(dragging, 1);
            next.splice(i, 0, moved);
            items = next;
            dragging = undefined;
            render();
          });
          cell.addEventListener('dragend', () => {
            dragging = undefined;
            render();
          });
          return cell;
        }),
      );
    };

    const close = (inserted: number) => {
      for (const item of items) URL.revokeObjectURL(item.url);
      document.removeEventListener('keydown', onKey, true);
      scrim.remove();
      release();
      resolve(inserted);
    };
    const insert = async () => {
      if (!items.length) return;
      accept.disabled = true;
      close(await editor.insertImageGrid(items.map((item) => item.file), columns));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(0);
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        e.stopPropagation();
        void insert();
      }
    };
    accept.addEventListener('click', () => void insert());
    cancel.addEventListener('click', () => close(0));
    more.addEventListener('click', () => picker.click());
    picker.addEventListener('change', () => {
      items = [...items, ...[...(picker.files ?? [])].map((file) => ({ file, url: URL.createObjectURL(file) }))];
      picker.value = '';
      render();
    });
    scrim.addEventListener('mousedown', (e) => {
      if (e.target === scrim) close(0);
    });
    document.addEventListener('keydown', onKey, true);
    applyTheme(scrim, editor.theme);
    document.body.appendChild(scrim);
    render();
    const release = holdFocus(dialog, () => editor.focus());
    accept.focus();
  });
}

/**
 * Puts in the pictures chosen: one where the caret is, several through the
 * dialog of the grid.
 */
export function insertPictures(editor: Editor, files: File[]): void {
  if (files.length > 1) void openImageGrid(editor, files);
  else if (files[0]) void editor.insertImageFile(files[0]).then(() => editor.focus());
}

/** A hidden input that asks for one or more pictures and puts them in; `click()` on it opens the file dialog. */
export function createImagePicker(editor: Editor): HTMLInputElement {
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = ACCEPT;
  picker.multiple = true;
  picker.hidden = true;
  picker.addEventListener('change', () => {
    const files = [...(picker.files ?? [])];
    picker.value = '';
    insertPictures(editor, files);
  });
  return picker;
}
