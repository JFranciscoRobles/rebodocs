// Find and replace: a small panel over the top right corner of the editor.
// It only uses the public methods of the editor.

import type { Editor } from './editor';
import { getLocale, t } from './i18n';
import { IS_MAC } from './platform';

export interface FindBar {
  /** Opens the panel; with `replace`, with the row to replace in view. */
  open(replace?: boolean): void;
  close(): void;
  destroy(): void;
}

const STYLE_ID = 'dx-findbar-style';
const MOD = IS_MAC;

const CSS = `
.dx-fb{position:fixed;z-index:25;display:none;flex-direction:column;gap:6px;padding:8px;border:1px solid #d2d6de;border-radius:8px;background:#fff;box-shadow:0 6px 20px rgba(0,0,0,.14);font:13px system-ui,-apple-system,"Segoe UI",sans-serif;color:#2b2f38}
.dx-fb.dx-fb-open{display:flex}
.dx-fb-row{display:flex;align-items:center;gap:4px}
.dx-fb input{width:190px;height:28px;padding:0 8px;border:1px solid #d2d6de;border-radius:6px;font:inherit;color:inherit}
.dx-fb input:focus-visible,.dx-fb button:focus-visible{outline:2px solid #0b57d0;outline-offset:-2px}
.dx-fb-count{min-width:62px;padding:0 4px;color:#5f6470;font-size:12px;font-variant-numeric:tabular-nums;text-align:center;white-space:nowrap}
.dx-fb button{display:inline-flex;align-items:center;justify-content:center;height:28px;min-width:28px;padding:0 6px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.dx-fb button:hover:not(:disabled){background:#e2e6ee}
.dx-fb button.dx-on{background:#d3e3fd;color:#0b57d0}
.dx-fb button:disabled{opacity:.35;cursor:default}
.dx-fb button.dx-fb-text{padding:0 10px;border:1px solid #d2d6de}
`;

const svg = (body: string) =>
  `<svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICONS = {
  up: svg('<path d="m5 11 4-4 4 4"/>'),
  down: svg('<path d="m5 7 4 4 4-4"/>'),
  close: svg('<path d="m4.5 4.5 9 9M13.5 4.5l-9 9"/>'),
  replace: svg('<path d="M3 6.5h9.5M10 4l2.5 2.5L10 9M15 11.5H5.5M8 9l-2.5 2.5L8 14"/>'),
};

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export function createFindBar(editor: Editor): FindBar {
  injectStyle();
  const bar = document.createElement('div');
  bar.className = 'dx-fb';
  bar.setAttribute('role', 'search');
  let isOpen = false;
  let matchCase = false;
  let wholeWord = false;

  const row = () => {
    const node = document.createElement('div');
    node.className = 'dx-fb-row';
    bar.appendChild(node);
    return node;
  };
  const input = (name: string, label: string) => {
    const node = document.createElement('input');
    node.type = 'text';
    node.placeholder = label;
    node.dataset.name = name;
    node.setAttribute('aria-label', label);
    node.spellcheck = false;
    return node;
  };
  const button = (name: string, label: string, html: string, onClick: () => void) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.innerHTML = html;
    node.title = label;
    node.dataset.name = name;
    node.setAttribute('aria-label', label);
    // The inputs keep the keyboard: a click on a button must not take it.
    node.addEventListener('mousedown', (e) => e.preventDefault());
    node.addEventListener('click', onClick);
    return node;
  };

  const query = input('find', t('find.find'));
  const count = document.createElement('span');
  count.className = 'dx-fb-count';
  count.setAttribute('aria-live', 'polite');
  const replacement = input('replace', t('find.replaceWith'));

  const search = () => editor.find(query.value, { matchCase, wholeWord });
  /** Searches again and shows the first place found from the caret on. */
  const searchAndShow = () => {
    if (search()) editor.findStep(1);
  };
  const step = (dir: -1 | 1) => {
    if (!editor.findCount) search();
    editor.findStep(dir);
  };
  const toggle = (node: HTMLElement, on: boolean) => {
    node.classList.toggle('dx-on', on);
    node.setAttribute('aria-pressed', String(on));
  };

  const prev = button('prev', t('find.previous'), ICONS.up, () => step(-1));
  const next = button('next', t('find.next'), ICONS.down, () => step(1));
  const caseButton = button('case', t('find.matchCase'), 'Aa', () => {
    matchCase = !matchCase;
    toggle(caseButton, matchCase);
    searchAndShow();
  });
  const wordButton = button('word', t('find.wholeWord'), '<u>ab</u>', () => {
    wholeWord = !wholeWord;
    toggle(wordButton, wholeWord);
    searchAndShow();
  });
  const expand = button('expand', t('find.replace'), ICONS.replace, () => showReplace(replaceRow.hidden));
  const first = row();
  first.append(query, count, prev, next, caseButton, wordButton, expand, button('close', t('find.close'), ICONS.close, () => close()));

  const replaceRow = row();
  const one = button('replace-one', t('find.replaceOne'), t('find.replace'), () => editor.replaceFound(replacement.value));
  const all = button('replace-all', t('find.replaceAll'), t('find.all'), () => editor.replaceAllFound(replacement.value));
  one.classList.add('dx-fb-text');
  all.classList.add('dx-fb-text');
  replaceRow.append(replacement, one, all);
  const showReplace = (show: boolean) => {
    replaceRow.hidden = !show;
    replaceRow.style.display = show ? '' : 'none';
    toggle(expand, show);
    if (show) replacement.focus();
  };
  showReplace(false);

  const refresh = () => {
    if (!isOpen) return;
    const total = editor.findCount;
    count.textContent = !query.value ? '' : total ? t('find.count', { index: editor.findIndex || '–', total: total.toLocaleString(getLocale()) }) : t('find.none');
    for (const node of [prev, next, one, all]) node.disabled = !total;
  };
  const place = () => {
    const area = editor.element.getBoundingClientRect();
    bar.style.top = `${area.top + 10}px`;
    bar.style.right = `${Math.max(8, window.innerWidth - area.right + 24)}px`;
  };

  const open = (replace = false) => {
    isOpen = true;
    bar.classList.add('dx-fb-open');
    place();
    // What is selected is what one most likely wants to look for.
    const selected = editor.selectedText;
    if (selected && !selected.includes('\n')) query.value = selected;
    if (replace) showReplace(true);
    search();
    refresh();
    (replace && query.value ? replacement : query).focus();
    query.select();
  };
  function close(): void {
    if (!isOpen) return;
    isOpen = false;
    bar.classList.remove('dx-fb-open');
    editor.find('');
    editor.focus();
  }

  query.addEventListener('input', searchAndShow);
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.target === replacement) editor.replaceFound(replacement.value);
      else step(e.shiftKey ? -1 : 1);
    }
  });
  // The usual key opens it, in place of the search of the browser.
  const onKey = (e: KeyboardEvent) => {
    if (!(MOD ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey) return;
    const key = e.key.toLowerCase();
    if (key !== 'f' && key !== 'h') return;
    e.preventDefault();
    open(key === 'h');
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', place);
  const unsubscribe = editor.onChange(refresh);
  document.body.appendChild(bar);

  return {
    open,
    close,
    destroy() {
      unsubscribe();
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', place);
      bar.remove();
    },
  };
}
