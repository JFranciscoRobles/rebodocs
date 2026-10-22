// Focus mode: the pages alone, over everything around them, and the browser
// full screen where it can be. Typing, the shortcuts, the bar beside the
// selection and the find bar go on working, since nothing is taken away: the
// editor is laid over the rest. A small bar at the bottom says where the
// caret is and how to leave, and hides itself while the pointer is still.
// It only uses the public methods of the editor.

import type { Editor } from './editor';
import { speaks, t } from './i18n';
import { IS_MAC } from './platform';
import { applyTheme } from './theme';

export interface FocusMode {
  /** Whether the pages are on their own. */
  readonly on: boolean;
  enter(): void;
  exit(): void;
  toggle(): void;
  destroy(): void;
}

export interface FocusModeOptions {
  /** Told each time the mode is entered or left, to keep a button of the application in step. */
  onChange?: (on: boolean) => void;
}

/** How long the bar at the bottom stays after the pointer stops. */
const HIDE_AFTER_MS = 2500;
const STYLE_ID = 'dx-focus-style';
const CSS = `
.dx-editor.dx-focusing{position:fixed;inset:0;z-index:20;height:auto}
.dx-fm{position:fixed;left:50%;bottom:20px;z-index:21;display:flex;align-items:center;gap:12px;padding:5px 5px 5px 16px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:999px;background:rgba(255,255,255,.92);box-shadow:0 6px 22px rgba(47,46,43,.16);backdrop-filter:blur(6px);font:12px system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-muted,#5f5d58);font-variant-numeric:tabular-nums;transform:translateX(-50%);transition:opacity .3s,transform .3s;user-select:none}
.dx-fm.dx-fm-hidden{opacity:0;transform:translate(-50%,12px);pointer-events:none}
.dx-fm button{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 12px;border:0;border-radius:999px;background:var(--dx-ui-line,#e6e3dc);color:var(--dx-ui-ink,#2f2e2b);font:inherit;font-weight:600;cursor:pointer}
.dx-fm button:hover{background:var(--dx-ui-hover,#f3f1ec)}
.dx-fm button:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:2px}
.dx-fm kbd{color:var(--dx-ui-muted,#5f5d58);font:inherit;font-weight:400}
`;

/**
 * Lays `node` over the window. Where something around it keeps a fixed
 * element inside its own box (a transform, a filter, an animation of the
 * page that moved it in), it is taken to the body meanwhile, and put back
 * where it was by the function returned.
 */
function cover(node: HTMLElement): () => void {
  node.classList.add('dx-focusing');
  const at = node.getBoundingClientRect();
  if (Math.abs(at.top) < 1 && Math.abs(at.left) < 1 && at.width >= window.innerWidth - 1) return () => node.classList.remove('dx-focusing');
  const place = document.createComment('dx-focus');
  const scroll = { top: node.scrollTop, left: node.scrollLeft };
  node.replaceWith(place);
  document.body.appendChild(node);
  return () => {
    node.classList.remove('dx-focusing');
    place.replaceWith(node);
    node.scrollTop = scroll.top;
    node.scrollLeft = scroll.left;
  };
}

/** What Esc belongs to while it is open: a menu, a dialog, a panel of a bar. Some stay in the page, hidden, while closed. */
const OPEN = '[role="dialog"], [role="menu"], .dx-tb-pop, .dx-sb-pop, .dx-ig-scrim';
// No boxes: it, or what it is in, is not displayed.
const seen = (node: Element) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';

/**
 * Lays `editor` over the page and asks the browser for the full screen (the
 * whole page, so that what is drawn outside the editor, as the bar beside
 * the selection or a menu, is still seen). Esc, the browser leaving full
 * screen, the button of the bar at the bottom and ⌘⇧. (Ctrl+Shift+.) leave;
 * ⌘⇧. also enters.
 */
export function createFocusMode(editor: Editor, options: FocusModeOptions = {}): FocusMode {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  let on = false;
  let timer = 0;
  let stopChange: (() => void) | undefined;
  let restore: (() => void) | undefined;

  const bar = document.createElement('div');
  bar.className = 'dx-fm';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', t('focus.mode'));
  const where = document.createElement('span');
  const leave = document.createElement('button');
  leave.type = 'button';
  leave.dataset.name = 'focus-exit';
  leave.addEventListener('click', () => exit());
  leave.addEventListener('mousedown', (e) => e.preventDefault());
  bar.append(where, leave);

  const show = () => {
    bar.classList.remove('dx-fm-hidden');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => bar.classList.add('dx-fm-hidden'), HIDE_AFTER_MS);
  };
  const place = () => (where.textContent = t('status.page', { page: editor.currentPage, pages: editor.pageCount }));

  const enter = () => {
    if (on) return;
    on = true;
    leave.innerHTML = '';
    speaks(bar);
    leave.append(t('focus.exit'), Object.assign(document.createElement('kbd'), { textContent: 'Esc' }));
    restore = cover(editor.element);
    applyTheme(bar, editor.theme);
    document.body.appendChild(bar);
    place();
    stopChange = editor.onChange(place);
    show();
    window.addEventListener('mousemove', show);
    window.addEventListener('touchstart', show);
    window.addEventListener('keydown', onEscape, true);
    document.addEventListener('fullscreenchange', onFullscreen);
    const page = document.documentElement;
    if (page.requestFullscreen && !document.fullscreenElement) void page.requestFullscreen().catch(() => {});
    editor.focus();
    options.onChange?.(true);
  };

  const exit = () => {
    if (!on) return;
    on = false;
    restore?.();
    restore = undefined;
    bar.remove();
    stopChange?.();
    window.clearTimeout(timer);
    window.removeEventListener('mousemove', show);
    window.removeEventListener('touchstart', show);
    window.removeEventListener('keydown', onEscape, true);
    document.removeEventListener('fullscreenchange', onFullscreen);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    editor.focus();
    options.onChange?.(false);
  };

  const toggle = () => (on ? exit() : enter());

  // The browser leaves full screen with Esc on its own: with it, the mode.
  const onFullscreen = () => {
    if (!document.fullscreenElement) exit();
  };
  function onEscape(e: KeyboardEvent) {
    if (e.key !== 'Escape' || [...document.querySelectorAll(OPEN)].some(seen)) return;
    // In the find bar, or any box that is not the document, Esc is that box's.
    const target = e.target as HTMLElement | null;
    if (target?.closest('.dx-fb') || (target?.matches('input, textarea, select') && !target.classList.contains('dx-input'))) return;
    exit();
  }
  const onShortcut = (e: KeyboardEvent) => {
    if (!((IS_MAC ? e.metaKey : e.ctrlKey) && e.shiftKey && (e.key === '.' || e.code === 'Period'))) return;
    // With more than one editor on the page, the keys are the one's being typed in.
    if (on || editor.element.contains(document.activeElement)) {
      e.preventDefault();
      toggle();
    }
  };
  window.addEventListener('keydown', onShortcut);

  return {
    get on() {
      return on;
    },
    enter,
    exit,
    toggle,
    destroy() {
      exit();
      window.removeEventListener('keydown', onShortcut);
    },
  };
}
