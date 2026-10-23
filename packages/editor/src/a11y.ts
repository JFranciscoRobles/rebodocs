// What a screen reader is told. The pages are drawn as positioned pieces a
// screen reader cannot follow, and the field that has the keys holds nothing
// of the text: so the editor says, in a live region, what the caret moved
// over, what was selected or deleted, and where the caret is.

import { type MessageKey, onLocaleChange, plural, speaks, t } from './i18n';

/** A piece of what is said: words of the interface, or text of the document in the language it is in. */
export type Spoken = string | { text: string; lang?: string };

export interface Announcer {
  /** Says `text`, or its pieces one after another; `urgent` interrupts what is being said, as for the result of a key. */
  say(text: string | Spoken[], urgent?: boolean): void;
  readonly element: HTMLElement;
  destroy(): void;
}

/** Hidden from sight, not from a screen reader. */
export const VISUALLY_HIDDEN = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0';

/** The longest text read out at once: a whole selected page is not read, its length is. */
const MAX_SPOKEN = 300;

export function createAnnouncer(parent: HTMLElement): Announcer {
  const polite = document.createElement('div');
  const assertive = document.createElement('div');
  for (const [el, live] of [
    [polite, 'polite'],
    [assertive, 'assertive'],
  ] as const) {
    el.className = 'dx-live';
    el.setAttribute('aria-live', live);
    el.setAttribute('aria-atomic', 'true');
    el.style.cssText = VISUALLY_HIDDEN;
    speaks(el);
    parent.appendChild(el);
  }
  // What it says is in the language of the interface, which may change while it is there.
  const stopLocale = onLocaleChange(() => [polite, assertive].forEach(speaks));
  let flip = false;
  return {
    element: polite,
    say(text, urgent = false) {
      const pieces = typeof text === 'string' ? [text] : text;
      if (!pieces.some((piece) => (typeof piece === 'string' ? piece : piece.text))) return;
      const el = urgent ? assertive : polite;
      // The same words twice in a row are said twice: a space that comes and goes makes them new.
      flip = !flip;
      // Text of the document in a language of its own is marked so, for the screen reader to read it with that voice.
      const nodes = pieces.map((piece) => {
        if (typeof piece === 'string' || !piece.lang) return document.createTextNode(typeof piece === 'string' ? piece : piece.text);
        const span = document.createElement('span');
        span.lang = piece.lang;
        span.textContent = piece.text;
        return span;
      });
      el.replaceChildren(...nodes, document.createTextNode(flip ? '\u00a0' : ''));
    },
    destroy() {
      stopLocale();
      polite.remove();
      assertive.remove();
    },
  };
}

/** A character as it is read: a space or a tab by its name, a letter as it is. */
export function spokenChar(ch: string | undefined): string {
  if (ch === undefined || ch === '') return t('a11y.endOfParagraph');
  if (ch === ' ' || ch === '\u00a0') return t('a11y.space');
  if (ch === '\t') return t('a11y.tab');
  if (ch === '\n') return t('a11y.lineBreak');
  if (ch === '\f') return t('a11y.pageBreak');
  if (ch === '\uFFFC') return t('a11y.object');
  return ch;
}

/** Text as it is read: without the characters that stand for objects and marks, and not too long. */
export function spokenText(text: string): string {
  const clean = text
    .replace(/[\u2060\u200B]/g, '')
    .replace(/\uFFFC/g, ` ${t('a11y.object')} `)
    .replace(/\f/g, ' ')
    .replace(/[\t\n]+/g, ' ')
    .trim();
  if (!clean) return t('a11y.blank');
  if (clean.length <= MAX_SPOKEN) return clean;
  return plural('a11y.long', clean.length, { start: clean.slice(0, 80), count: clean.length });
}

// --- Regions -----------------------------------------------------------------------
// The keyboard goes from the document to the bars around it and back as in
// Word: F6 and Shift+F6 go round the parts of the editor, Alt+F10 goes to the
// toolbar, and Escape in a bar comes back to the document.

export type RegionName = 'toolbar' | 'ruler' | 'document' | 'panel' | 'status' | 'find';

/** Marks `el` as a part of the editor F6 goes to, and what in it takes the keyboard. */
export function markRegion(el: HTMLElement, name: RegionName, target: () => HTMLElement | null | undefined = () => el): void {
  el.dataset.dxRegion = name;
  targets.set(el, target);
}

const targets = new WeakMap<HTMLElement, () => HTMLElement | null | undefined>();
let installed = false;

const shown = (el: HTMLElement) => el.isConnected && el.getClientRects().length > 0 && !el.closest('[hidden], [inert]');

function regions(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-dx-region]')].filter((el) => shown(el) && !!targets.get(el)?.());
}

/** Gives the keyboard to the part named, or the next (1) or previous (-1) one from where it is. */
export function focusRegion(to: RegionName | 1 | -1): boolean {
  const all = regions();
  let next: HTMLElement | undefined;
  if (typeof to === 'string') next = all.find((el) => el.dataset.dxRegion === to);
  else if (all.length) {
    const at = all.findIndex((el) => el.contains(document.activeElement));
    // From outside all of them, F6 goes to the first and Shift+F6 to the last.
    const from = at < 0 ? (to > 0 ? -1 : 0) : at;
    next = all[(from + to + all.length) % all.length];
  }
  const target = next && targets.get(next)?.();
  if (!target) return false;
  target.focus();
  return true;
}

/** The keys that go round the parts, listened to once for the whole page. */
export function installRegionKeys(): void {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'F6' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (focusRegion(e.shiftKey ? -1 : 1)) e.preventDefault();
      } else if (e.key === 'F10' && e.altKey && !e.ctrlKey && !e.metaKey) {
        if (focusRegion('toolbar')) e.preventDefault();
      }
    },
    true,
  );
  // Escape in any of the parts around the document, when nothing there took it, goes back to the document.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const from = document.activeElement;
    if (!(from instanceof HTMLElement) || from.matches('input, textarea, select')) return;
    const region = from.closest<HTMLElement>('[data-dx-region]');
    if (!region || region.dataset.dxRegion === 'document') return;
    if (focusRegion('document')) e.preventDefault();
  });
}

// --- Dialogs -----------------------------------------------------------------------
// While a dialog or a menu that covers the page is open, Tab goes round what
// is in it and not out of it; on closing, the keyboard goes back to where it
// was when it opened.

const TABBABLE = 'button, [href], input, select, textarea, [tabindex]';

/** What Tab stops at in `container`, in order. */
export function tabbables(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0 && !el.closest('[hidden], [inert]'),
  );
}

/**
 * Keeps Tab and Shift+Tab inside `container` until the function it returns
 * is called, which gives the keyboard back to what had it before: or, when
 * that is gone or was the document, calls `fallback`.
 */
export function holdFocus(container: HTMLElement, fallback: () => void): (restore?: boolean) => void {
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
    const all = tabbables(container);
    if (!all.length) return;
    const at = all.indexOf(document.activeElement as HTMLElement);
    const next = e.shiftKey ? (at <= 0 ? all.length - 1 : at - 1) : at < 0 || at === all.length - 1 ? 0 : at + 1;
    // Only at the ends is it taken over: in between, the browser's own order is the same.
    if (at < 0 || (e.shiftKey ? at === 0 : at === all.length - 1)) {
      e.preventDefault();
      all[next].focus();
    }
  };
  container.addEventListener('keydown', onKey);
  return (restore = true) => {
    container.removeEventListener('keydown', onKey);
    if (!restore) return;
    // The document's own field is given back by the editor, which also puts the caret in view.
    if (before && before.isConnected && before.getClientRects().length > 0 && !before.classList.contains('dx-input')) before.focus();
    else fallback();
  };
}

/** Moves the keyboard with the arrows among `items`, as in a menu: down and up, Home and End. */
export function arrowsThrough(container: HTMLElement, items: () => HTMLElement[], keys: { next: string[]; prev: string[] } = { next: ['ArrowDown'], prev: ['ArrowUp'] }): void {
  container.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (at < 0 || !all.length) return;
    let next = -1;
    if (keys.next.includes(e.key)) next = (at + 1) % all.length;
    else if (keys.prev.includes(e.key)) next = (at - 1 + all.length) % all.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = all.length - 1;
    if (next < 0) return;
    e.preventDefault();
    all[next].focus();
  });
}

// --- Colours -----------------------------------------------------------------------

/** A colour by its name, as it is read out: "dark grey" for 434343, not its number. */
export function colorName(hex: string | undefined): string {
  const value = (hex ?? '').replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return value ? `#${value}` : t('color.none');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const shade = (name: MessageKey, dark: number, light: number) => {
    const word = t(name);
    return l < dark ? t('color.dark', { name: word }) : l > light ? t('color.light', { name: word }) : word;
  };
  if (s < 0.15 || d < 0.08) {
    if (l < 0.1) return t('color.black');
    if (l > 0.98) return t('color.white');
    return shade('color.gray', 0.35, 0.58);
  }
  let hue = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  if (hue < 15 || hue >= 345) return shade('color.red', 0.38, 0.78);
  if (hue < 42) return l < 0.33 ? t('color.brown') : shade('color.orange', 0.38, 0.78);
  if (hue < 50) return l < 0.35 ? t('color.olive') : l > 0.8 ? t('color.light', { name: t('color.yellow') }) : t('color.gold');
  if (hue < 70) return l < 0.35 ? t('color.olive') : shade('color.yellow', 0.38, 0.8);
  if (hue < 100) return l < 0.3 ? t('color.olive') : shade('color.lime', 0.3, 0.8);
  if (hue < 165) return shade('color.green', 0.3, 0.78);
  if (hue < 195) return shade('color.cyan', 0.3, 0.8);
  // A light blue going to cyan has a name of its own, as the sky.
  if (hue < 215 && l >= 0.42) return shade('color.sky', 0.3, 0.8);
  if (hue < 255) return shade('color.blue', 0.3, 0.78);
  if (hue < 290) return shade('color.purple', 0.3, 0.8);
  if (hue < 330) return shade('color.magenta', 0.3, 0.8);
  return shade('color.pink', 0.3, 0.8);
}

// --- What is seen ------------------------------------------------------------------
// The ring around what has the keyboard, in every part, and what the parts
// look like with the colours of the system forced on them, as Windows does in
// high contrast: there, a colour given as a background is taken away, and the
// selection, the caret and what is on or off would be lost with it.

const STYLE_ID = 'dx-a11y-style';
const CSS = `
:where(.dx-tb,.dx-pn,.dx-sb,.dx-bb,.dx-fb,.dx-side,.dx-page-dlg,.dx-ig,.dx-vv,.dx-ruler) :focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-2px}
.dx-ruler [tabindex]:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:1px;border-radius:2px}
@media (prefers-reduced-motion:reduce){
.dx-focused .dx-caret{animation:none!important}
.dx-side,.dx-side-scrim{transition:none!important}
}
@media (forced-colors:active){
.dx-sel{forced-color-adjust:none;background:Highlight;mix-blend-mode:normal;opacity:.45}
.dx-caret{forced-color-adjust:none;background:CanvasText}
.dx-find{forced-color-adjust:none;outline:2px solid Highlight;background:transparent}
.dx-page{forced-color-adjust:none}
.dx-tb-color,.dx-tb-swatch,.dx-bb-dot,.dx-pn-dot,.dx-sb-dot,.dx-tb-cell{forced-color-adjust:none}
:where(.dx-tb,.dx-pn,.dx-sb,.dx-bb,.dx-fb,.dx-side,.dx-page-dlg,.dx-ig,.dx-vv) .dx-on{outline:2px solid Highlight;outline-offset:-2px}
:where(.dx-tb,.dx-pn,.dx-sb,.dx-bb,.dx-fb,.dx-side,.dx-page-dlg,.dx-ig,.dx-vv) :focus-visible{outline:3px solid Highlight}
.dx-ruler canvas{forced-color-adjust:none}
}
`;

/** Puts in the page, once, how what has the keyboard is shown and how high contrast is kept. */
export function injectA11yStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}
