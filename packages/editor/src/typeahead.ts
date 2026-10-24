// A list that comes up at the caret when some characters are typed, as the
// "/" of the commands and the "{{" of the variables: what is typed after them
// narrows it, the arrows choose, Enter, Tab or a click does the one chosen in
// place of the characters and what followed them, and Escape leaves them as
// text. It only uses the public methods of the editor, and the document's text.

import { paragraphText } from '@rebodocs/core/internal';
import type { Editor } from './editor';
import { speaks, t } from './i18n';
import { keyboardInset } from './platform';
import { applyTheme } from './theme';

export interface TypeaheadItem {
  /** The heading it goes under while nothing narrows the list; none, and it has none. */
  group?: string;
  label: string;
  title: string;
  /** Other words it is found by, besides its name and what it says. */
  also?: string;
  run: () => void;
}

export interface TypeaheadSpec {
  /** What, typed last, opens it: "/", "{{". */
  trigger: string;
  /** Whether the text of the paragraph before the trigger lets it open there. */
  opensAfter?: (before: string) => boolean;
  /** What it offers there, `before` being the text of the paragraph before the trigger. */
  items: (before: string) => TypeaheadItem[];
  /** What it offers past those found for what was typed, after them. */
  more?: (query: string, found: TypeaheadItem[]) => TypeaheadItem[];
  /** Whether it stays open with this typed after the trigger and this found. */
  keeps: (query: string, found: number) => boolean;
  /** What it says with nothing to offer for what was typed; "No results" without it. */
  empty?: (query: string) => string;
  /** What it is called, and how it is used, for a screen reader. */
  label: string;
  hint: string;
}

export interface Typeahead {
  readonly isOpen: boolean;
  close(): void;
  destroy(): void;
}

const STYLE_ID = 'dx-slash-style';
/** The room, in pixels, between the caret and the list, and between the list and the window. */
const GAP = 6;

const CSS = `
.dx-sl{position:fixed;z-index:30;display:none;flex-direction:column;width:280px;max-width:calc(100vw - 16px);overflow-y:auto;overscroll-behavior:contain;padding:4px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:12px;background:var(--dx-ui-bg,#fff);box-shadow:0 6px 22px rgba(47,46,43,.18);font:13px system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-ink,#2f2e2b);user-select:none}
.dx-sl.dx-sl-open{display:flex}
.dx-sl-group{padding:8px 10px 4px;color:var(--dx-ui-muted,#5f5d58);font-size:11px;letter-spacing:.04em;text-transform:uppercase}
.dx-sl button{display:flex;flex-direction:column;align-items:flex-start;gap:1px;width:100%;padding:6px 10px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dx-sl button.dx-on{background:var(--dx-ui-active,#e8f0fd)}
.dx-sl-name{font-weight:500;overflow-wrap:anywhere}
.dx-sl-title{color:var(--dx-ui-muted,#5f5d58);font-size:12px;line-height:1.3}
.dx-sl-none{padding:8px 10px;color:var(--dx-ui-muted,#5f5d58)}
@media (pointer:coarse){.dx-sl button{padding:9px 12px}}
`;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** Lower case and without accents: "titulo" finds "Título". */
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Those whose name, or a word of it, starts with what was typed first, then those that have it anywhere. */
function matching(all: TypeaheadItem[], query: string): TypeaheadItem[] {
  const q = fold(query.trim());
  if (!q) return all;
  const starts = all.filter(
    (one) =>
      fold(`${one.label} ${one.also ?? ''}`)
        .split(/[\s._-]/)
        .some((word) => word.startsWith(q)) || fold(one.label).startsWith(q),
  );
  const has = all.filter((one) => !starts.includes(one) && fold(`${one.label} ${one.title}`).includes(q));
  return [...starts, ...has];
}

export function createTypeahead(editor: Editor, spec: TypeaheadSpec): Typeahead {
  injectStyle();
  const menu = document.createElement('div');
  menu.className = 'dx-sl';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', spec.label);
  speaks(menu);

  /** Where the trigger is while the list is open. */
  let at: { para: number; offset: number } | undefined;
  /** What the list offers for what is typed after the trigger, and the one chosen of them. */
  let shown: TypeaheadItem[] = [];
  let active = 0;
  /** The caret and its paragraph at the last change: one character more, ending the trigger, is the trigger typed. */
  let last: { para: number; offset: number; length: number } | undefined;

  const paragraph = (para: number) => paragraphText(editor.text.paragraphs[para]);

  const render = (query: string) => {
    menu.replaceChildren();
    if (!shown.length) {
      const none = document.createElement('div');
      none.className = 'dx-sl-none';
      none.textContent = spec.empty?.(query) ?? t('slash.none');
      menu.appendChild(none);
      return;
    }
    let group: string | undefined;
    shown.forEach((item, index) => {
      // Set out in kinds while nothing narrows it; narrowed, the best is first, whatever its kind.
      if (!query && item.group && item.group !== group) {
        group = item.group;
        const head = document.createElement('div');
        head.className = 'dx-sl-group';
        head.textContent = group;
        menu.appendChild(head);
      }
      const node = document.createElement('button');
      node.type = 'button';
      node.tabIndex = -1;
      node.setAttribute('role', 'option');
      node.setAttribute('aria-selected', String(index === active));
      node.classList.toggle('dx-on', index === active);
      const name = document.createElement('span');
      name.className = 'dx-sl-name';
      name.textContent = item.label;
      node.appendChild(name);
      if (item.title) {
        const title = document.createElement('span');
        title.className = 'dx-sl-title';
        title.textContent = item.title;
        node.appendChild(title);
      }
      node.addEventListener('click', () => choose(index));
      // A pointer over one makes it the one chosen, as the arrows do.
      node.addEventListener('mousemove', () => {
        if (active !== index) setActive(index, false);
      });
      menu.appendChild(node);
    });
  };

  const items = () => [...menu.querySelectorAll<HTMLButtonElement>('button')];
  /** From the arrows, the one chosen is brought into sight and said; under the pointer, it is already in sight, and the list is the pointer's to scroll. */
  const setActive = (index: number, byKey = true) => {
    active = index;
    items().forEach((node, i) => {
      node.classList.toggle('dx-on', i === index);
      node.setAttribute('aria-selected', String(i === index));
    });
    if (!byKey) return;
    items()[index]?.scrollIntoView({ block: 'nearest' });
    if (shown[index]) editor.announce(shown[index].label, true);
  };

  /** Under the caret, or over it when there is more room there: above the keyboard of a phone, too. */
  const place = () => {
    const bounds = editor.selectionBounds();
    if (!bounds) return;
    const bottom = window.innerHeight - keyboardInset();
    // How tall all of it is, whatever its height now: the height is not taken away to measure it, which would scroll it back to the top.
    const natural = Math.min(menu.scrollHeight, 320);
    const below = bottom - bounds.bottom - 2 * GAP;
    const above = bounds.top - 2 * GAP;
    const under = below >= natural || below >= above;
    const height = Math.max(Math.min(natural, 80), Math.min(natural, under ? below : above));
    menu.style.maxHeight = `${Math.round(height)}px`;
    const width = menu.getBoundingClientRect().width;
    menu.style.left = `${Math.round(Math.max(GAP, Math.min(bounds.left, window.innerWidth - width - GAP)))}px`;
    menu.style.top = `${Math.round(under ? bounds.bottom + GAP : Math.max(GAP, bounds.top - GAP - height))}px`;
  };

  const open = (para: number, offset: number) => {
    at = { para, offset };
    active = 0;
    applyTheme(menu, editor.theme);
    menu.classList.add('dx-sl-open');
    update();
    if (at && !editor.byTouch) editor.announce(`${spec.label}. ${spec.hint}`);
  };

  const close = () => {
    if (!at) return;
    at = undefined;
    shown = [];
    menu.classList.remove('dx-sl-open');
  };

  /** What is typed after the trigger, while the caret is still after it in its paragraph and the trigger is still there. */
  const query = (): string | undefined => {
    if (!at || !editor.collapsed) return undefined;
    const { para, offset } = editor.selection.focus;
    const end = at.offset + spec.trigger.length;
    if (para !== at.para || offset < end || para >= editor.text.paragraphs.length) return undefined;
    const text = paragraph(para);
    if (!text.startsWith(spec.trigger, at.offset)) return undefined;
    return text.slice(end, offset);
  };

  const update = () => {
    const typed = query();
    if (typed === undefined || !at) return close();
    const found = matching(spec.items(paragraph(at.para).slice(0, at.offset)), typed);
    if (!spec.keeps(typed, found.length)) return close();
    const was = shown[active]?.label;
    shown = [...found, ...(spec.more?.(typed, found) ?? [])];
    const kept = typed ? shown.findIndex((item) => item.label === was) : -1;
    active = Math.max(0, kept);
    render(typed);
    place();
  };

  /** Takes the trigger and what was typed after it away, and does the one chosen in their place. */
  const choose = (index: number) => {
    const item = shown[index];
    const from = at;
    if (!item || !from) return;
    const { offset } = editor.selection.focus;
    close();
    editor.setSelection({ para: from.para, offset: from.offset }, { para: from.para, offset });
    editor.deleteBackward();
    item.run();
  };

  const caret = () => {
    const { para, offset } = editor.selection.focus;
    return { para, offset, length: para < editor.text.paragraphs.length ? paragraph(para).length : 0 };
  };
  const onChange = () => {
    const was = last;
    last = caret();
    const { para, offset, length } = last;
    if (at) return update();
    // Only a character typed: not the caret coming to rest after one already there.
    if (editor.readOnly || !editor.collapsed || !was || was.para !== para || offset !== was.offset + 1 || length !== was.length + 1) return;
    const from = offset - spec.trigger.length;
    if (from < 0) return;
    const text = paragraph(para);
    if (text.startsWith(spec.trigger, from) && (spec.opensAfter?.(text.slice(0, from)) ?? true)) open(para, from);
  };

  // --- Keys and pointers ------------------------------------------------------

  const inEditor = () => editor.element.contains(document.activeElement);
  const onKeyDown = (e: KeyboardEvent) => {
    if (!at || !inEditor() || e.isComposing) return;
    const plain = !e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey;
    const used = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (e.key === 'Escape') {
      used();
      close();
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && shown.length && plain) {
      used();
      setActive((active + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length);
    } else if ((e.key === 'Enter' || e.key === 'Tab') && shown.length && plain) {
      used();
      choose(active);
    }
  };
  // Its buttons act where the trigger is: the keyboard stays in the text.
  menu.addEventListener('mousedown', (e) => e.preventDefault());
  const onPointerOutside = (e: Event) => {
    if (at && !menu.contains(e.target as Node)) close();
  };
  // The page scrolling takes the caret with it; the list scrolling in itself does not.
  const onMove = (e: Event) => {
    if (at && e.target !== menu) place();
  };

  last = caret();
  const unsubscribe = editor.onChange(onChange);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('mousedown', onPointerOutside, true);
  document.addEventListener('touchstart', onPointerOutside, true);
  window.addEventListener('resize', onMove);
  document.addEventListener('scroll', onMove, true);
  window.visualViewport?.addEventListener('resize', onMove);
  // On the page, or in what is shown full screen when that holds the document: outside it nothing shows.
  const mount = () => {
    const full = document.fullscreenElement;
    const host = full && full !== document.documentElement && full.contains(editor.element) ? full : document.body;
    if (menu.parentElement !== host) host.append(menu);
  };
  mount();
  document.addEventListener('fullscreenchange', mount);

  return {
    get isOpen() {
      return !!at;
    },
    close,
    destroy() {
      unsubscribe();
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onPointerOutside, true);
      document.removeEventListener('touchstart', onPointerOutside, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('scroll', onMove, true);
      window.visualViewport?.removeEventListener('resize', onMove);
      document.removeEventListener('fullscreenchange', mount);
      menu.remove();
    },
  };
}
