// The menu of the document: what is done to the document as a whole. It comes
// two ways. As a card that drops from the button of the menu, with the
// document at its top, its actions as tiles and its formats as cards; or as a
// screen of its own over the editor, with the parts of the document down one
// side and each one, larger, beside them. Opening and saving belong to the
// application, which says what they do; exporting is done here, and so is the
// setup of the page, in a dialog of its own, through the public methods of the editor.

import { type PageSetup, docText, imageExtension } from '@rebodocs/core/internal';
import { arrowsThrough, holdFocus, tabbables } from './a11y';
import type { Editor } from './editor';
import { type MessageKey, getLocale, locales, plural, speaks, t } from './i18n';
import { IS_MAC } from './platform';
import { type Theme, applyTheme } from './theme';

export interface SidebarOptions {
  /** The name of the document, shown at the top and given to the files it is exported to. */
  fileName?: () => string;
  /** Whether the document has changes not saved: said at the top of the menu. */
  dirty?: () => boolean;
  /** Each one shows its entry when given. */
  onOpen?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  /** What to do with an exported file; by default the browser downloads it. */
  onExport?: (file: { name: string; blob: Blob }) => void;
  /** False leaves out the entries of the letterhead: where it is the application's to say, not the person's. */
  letterhead?: boolean;
  /** Shows the choice of language when given, and is told the one chosen: the menu only asks. */
  onLocale?: (locale: string) => void;
  /** Shows the choice of light or dark when given, and is told the one chosen: the menu only asks. */
  onTheme?: (theme: Theme) => void;
  /** Told what went wrong, in the language of the interface; the browser says it when left out. */
  onError?: (message: string) => void;
  /**
   * How the menu comes: 'card', a card that drops from the button of the menu
   * (a sheet from the bottom on a narrow screen); or 'screen', a screen of its
   * own over the editor. A card unless said.
   */
  variant?: 'card' | 'screen';
  /**
   * The box the menu stays inside, positioned (relative or absolute): the
   * screen covers it, the card drops within it, and narrow is its width that
   * says. The whole window when left out.
   */
  within?: HTMLElement;
}

export interface Sidebar {
  open(): void;
  close(): void;
  toggle(): void;
  /** Shows the dialog with the size, the orientation and the margins of the page. */
  openPageSetup(): void;
  destroy(): void;
}

const PT_PER_CM = 72 / 2.54;
/** Paper sizes, in points, as held upright. */
const PAPERS: [MessageKey, number, number][] = [
  ['paper.letter', 612, 792],
  ['paper.a4', 595.3, 841.9],
  ['paper.legal', 612, 1008],
];
/** Margin presets, in points: top and bottom, then left and right. */
const MARGINS: [MessageKey, number, number][] = [
  ['margins.normal', 72, 72],
  ['margins.narrow', 36, 36],
  ['margins.moderate', 72, 54],
  ['margins.wide', 72, 144],
];
const CUSTOM = 'custom';
/** The least room, in points, the margins must leave for the text. */
const MIN_TEXT = 72;
const near = (a: number, b: number) => Math.abs(a - b) < 0.6;
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MOD = IS_MAC ? '⌘' : 'Ctrl+';
const STYLE_ID = 'dx-sidebar-style';
/** Below this width, of the window or of the box it stays in, the card is a sheet from the bottom, and the screen puts its parts in a row. */
const NARROW = 560;

const CSS = `
.dx-side-scrim{position:fixed;inset:0;z-index:40;background:rgba(47,46,43,.28);opacity:0;visibility:hidden;transition:opacity .18s,visibility .18s}
.dx-side-open.dx-side-scrim{opacity:1;visibility:visible}
.dx-side{position:fixed;z-index:41;display:flex;flex-direction:column;box-sizing:border-box;background:var(--dx-ui-bg,#fff);color:var(--dx-ui-ink,#2f2e2b);font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;visibility:hidden;opacity:0}
.dx-side *{box-sizing:border-box}
/* Visible at once on opening, so that the keyboard can go in: only on closing does it wait for the fade. */
.dx-side-open.dx-side{visibility:visible;opacity:1}
.dx-side button,.dx-side select{font:inherit;color:inherit}
.dx-side :focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:2px}

/* --- The card ---------------------------------------------------------------- */
.dx-side-card{width:min(408px,calc(100vw - 16px));max-height:calc(100vh - 24px);overflow-y:auto;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:18px;box-shadow:0 24px 56px -12px rgba(47,46,43,.28),0 2px 6px rgba(47,46,43,.06);transform:translateY(-6px) scale(.98);transform-origin:top left;transition:opacity .16s,transform .16s,visibility .16s}
.dx-side-open.dx-side-card{transform:none;transition:opacity .16s,transform .16s}
.dx-side-card .dx-side-in{padding:14px}
.dx-side-sheet{left:0;right:0;bottom:0;width:100%;max-height:88vh;border-radius:20px 20px 0 0;transform:translateY(24px);transform-origin:bottom center}
.dx-side-sheet::before{content:"";display:block;width:36px;height:4px;margin:8px auto 0;border-radius:2px;background:var(--dx-ui-line,#e6e3dc)}

/* --- The screen -------------------------------------------------------------- */
.dx-side-screen{inset:0;flex-direction:row;background:var(--dx-ui-bar,#fbfaf8);transform:scale(1.01);transition:opacity .18s,transform .18s,visibility .18s}
.dx-side-open.dx-side-screen{transform:none;transition:opacity .18s,transform .18s}
.dx-side-nav{flex:none;display:flex;flex-direction:column;gap:2px;width:260px;padding:18px 14px;border-right:1px solid var(--dx-ui-line,#e6e3dc);overflow-y:auto}
.dx-side-back{display:flex;align-items:center;gap:8px;height:38px;margin-bottom:14px;padding:0 10px;border:0;border-radius:10px;background:none;font-weight:600;cursor:pointer}
.dx-side-back:hover{background:var(--dx-ui-hover,#f3f1ec)}
.dx-side-tab{display:flex;align-items:center;gap:10px;height:40px;padding:0 12px;border:0;border-radius:10px;background:none;text-align:left;font-size:14px;cursor:pointer}
.dx-side-tab svg{color:var(--dx-ui-muted,#5f5d58)}
.dx-side-tab:hover{background:var(--dx-ui-hover,#f3f1ec)}
.dx-side-tab[aria-selected=true]{background:var(--dx-ui-bg,#fff);color:var(--dx-ui-accent,#0b57d0);font-weight:600;box-shadow:0 1px 3px rgba(47,46,43,.12)}
.dx-side-tab[aria-selected=true] svg{color:var(--dx-ui-accent,#0b57d0)}
.dx-side-nav .dx-side-doc{margin-top:auto;padding:12px;border-radius:12px;background:var(--dx-ui-bg,#fff);border:1px solid var(--dx-ui-line,#e6e3dc)}
.dx-side-main{flex:1;min-width:0;overflow-y:auto;padding:40px clamp(20px,5vw,64px)}
.dx-side-pane{max-width:760px}
.dx-side-pane[hidden]{display:none}
.dx-side-pane h2{margin:0 0 6px;font-size:28px;font-weight:800;letter-spacing:-.02em}
.dx-side-pane>p{margin:0 0 24px;color:var(--dx-ui-muted,#5f5d58);font-size:14px}
.dx-side-screen .dx-side-tiles{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.dx-side-screen .dx-side-tile{min-height:104px}
.dx-side-screen .dx-side-formats{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.dx-side-screen .dx-side-format{flex-direction:row;align-items:center;gap:14px;padding:16px;text-align:left}
.dx-side-screen .dx-side-format small{display:block}
.dx-side-main>.dx-side-x{position:absolute;right:16px;top:16px}
/* Narrow: the parts in a row along the top. */
.dx-side-narrow.dx-side-screen{flex-direction:column}
.dx-side-narrow .dx-side-nav{flex-direction:row;width:auto;margin-right:48px;padding:10px;gap:4px;border-right:0;overflow-x:auto}
.dx-side-narrow .dx-side-main>.dx-side-x{top:12px;right:8px}
.dx-side-narrow .dx-side-nav .dx-side-doc{display:none}
.dx-side-narrow .dx-side-back{margin:0;padding:0 8px}
.dx-side-narrow .dx-side-back span{display:none}
.dx-side-narrow .dx-side-tab{flex:none;padding:0 12px}
.dx-side-narrow .dx-side-main{padding:22px 16px;border-top:1px solid var(--dx-ui-line,#e6e3dc)}
.dx-side-narrow .dx-side-pane h2{font-size:22px}

/* --- What both have ---------------------------------------------------------- */
.dx-side-doc{display:flex;align-items:center;gap:12px}
.dx-side-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;background:#e8f0fd;color:#0b57d0}
.dx-side-name{min-width:0;overflow:hidden;font-weight:700;font-size:15px;text-overflow:ellipsis;white-space:nowrap}
.dx-side-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;color:var(--dx-ui-muted,#5f5d58);font-size:12px}
.dx-side-dirty{display:inline-flex;align-items:center;gap:5px;padding:1px 8px;border-radius:999px;background:#fbf3db;color:#7a4f00;font-weight:600}
.dx-side-dirty::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.dx-side-dirty[hidden]{display:none}
.dx-side-x{flex:none;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;margin-left:auto;border:0;border-radius:9px;background:none;color:var(--dx-ui-muted,#5f5d58);cursor:pointer}
.dx-side-x:hover{background:var(--dx-ui-hover,#f3f1ec);color:var(--dx-ui-ink,#2f2e2b)}
.dx-side-head{margin:18px 2px 8px;color:var(--dx-ui-muted,#5f5d58);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.dx-side-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px}
.dx-side-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:84px;padding:8px 4px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:14px;background:var(--dx-ui-bg,#fff);font-weight:600;font-size:12.5px;text-align:center;cursor:pointer;transition:border-color .12s,background .12s,transform .12s}
.dx-side-tile:hover{border-color:var(--dx-ui-active-line,#a8c7fa);background:var(--dx-ui-hover,#f3f1ec)}
.dx-side-tile:active{transform:scale(.97)}
.dx-side-tile svg{flex:none;color:var(--dx-ui-accent,#0b57d0)}
.dx-side-tile kbd{color:var(--dx-ui-muted,#5f5d58);font:500 11px system-ui,sans-serif}
.dx-side-formats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.dx-side-format{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:12px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:14px;background:var(--dx-ui-bg,#fff);text-align:left;cursor:pointer;transition:border-color .12s,background .12s}
.dx-side-format:hover{border-color:var(--dx-ui-active-line,#a8c7fa);background:var(--dx-ui-hover,#f3f1ec)}
.dx-side-format b{display:block;font-size:13.5px}
.dx-side-format small{display:none;margin-top:2px;color:var(--dx-ui-muted,#5f5d58);font-size:12px;line-height:1.35}
.dx-side-format span>i{font-style:normal;color:var(--dx-ui-muted,#5f5d58);font-size:12px}
.dx-side-badge{flex:none;display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;font:800 13px/1 system-ui,sans-serif;letter-spacing:-.02em}
.dx-side-badge.dx-docx{background:#e8f0fd;color:#0b57d0}
.dx-side-badge.dx-pdf{background:#fbe8ef;color:#a23a5e}
.dx-side-badge.dx-md{background:#f0ebf8;color:#6a4a9c}
.dx-side-badge.dx-print{background:#e7f3ea;color:#2e6b3c}
.dx-side-row{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:10px 12px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:14px;background:var(--dx-ui-bg,#fff);text-align:left;cursor:pointer;transition:border-color .12s,background .12s}
.dx-side-row+.dx-side-row,.dx-side-row+.dx-side-chips{margin-top:8px}
.dx-side-row:hover{border-color:var(--dx-ui-active-line,#a8c7fa);background:var(--dx-ui-hover,#f3f1ec)}
.dx-side-row>svg:first-child{flex:none;color:var(--dx-ui-muted,#5f5d58)}
.dx-side-row span{flex:1;min-width:0}
.dx-side-row b{display:block;font-weight:600}
.dx-side-row small{display:block;color:var(--dx-ui-muted,#5f5d58);font-size:12px}
.dx-side-row em{flex:none;color:var(--dx-ui-accent,#0b57d0);font-style:normal;font-weight:600}
.dx-side-chips{display:flex;flex-wrap:wrap;gap:6px}
.dx-side-chips[hidden]{display:none}
.dx-side-chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:999px;background:var(--dx-ui-bg,#fff);font-size:12.5px;font-weight:600;cursor:pointer}
.dx-side-chip:hover{background:var(--dx-ui-hover,#f3f1ec)}
.dx-side-chip.dx-danger{color:#a3271c}
.dx-side-lang{display:flex;align-items:center;gap:10px;margin-top:8px}
.dx-side-lang span{flex:1;color:var(--dx-ui-muted,#5f5d58)}
.dx-side-lang select{height:36px;padding:0 10px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:10px;background:var(--dx-ui-bg,#fff);cursor:pointer}
.dx-side-preview{position:relative;flex:none;width:120px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:4px;background:#fff;box-shadow:0 8px 20px -8px rgba(47,46,43,.25)}
.dx-side-preview i{position:absolute;border:1px dashed var(--dx-ui-active-line,#a8c7fa);background:repeating-linear-gradient(#fff 0 5px,#eceae4 5px 6px)}
.dx-side-pagebox{display:flex;align-items:flex-start;gap:24px;margin-bottom:16px}
.dx-side-pagebox>div:not(.dx-side-preview){flex:1;min-width:0}
@media (pointer:coarse){.dx-side-x{width:44px;height:44px}.dx-side-chip{height:40px}.dx-side-tab,.dx-side-back{height:44px}}

/* --- The dialog of the page -------------------------------------------------- */
.dx-page-scrim{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(47,46,43,.32)}
.dx-page-scrim.dx-side-open{display:flex}
.dx-page-dlg{display:flex;flex-direction:column;width:440px;max-width:100%;max-height:100%;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:18px;background:var(--dx-ui-bg,#fff);box-shadow:0 24px 56px -12px rgba(47,46,43,.32);font:13px system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-ink,#2f2e2b)}
.dx-page-top{display:flex;align-items:center;gap:8px;padding:16px 16px 8px 20px}
.dx-page-top div{flex:1;font-weight:700;font-size:16px}
.dx-page-body{flex:1;overflow-y:auto;padding:4px 14px 4px}
.dx-side-field{display:flex;align-items:center;gap:8px;padding:5px 6px}
.dx-side-field[hidden]{display:none}
.dx-side-field>span{flex:none;width:84px;color:var(--dx-ui-muted,#5f5d58)}
.dx-side-field select,.dx-side-field input{flex:1;min-width:0;height:34px;padding:0 8px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit}
.dx-side-field input{text-align:right;font-variant-numeric:tabular-nums}
.dx-side-field em{flex:none;color:var(--dx-ui-muted,#5f5d58);font-style:normal}
.dx-side-seg{display:flex;flex:1;gap:2px;padding:3px;border-radius:11px;background:var(--dx-ui-hover,#f3f1ec)}
.dx-side-seg button{flex:1;height:30px;border:0;border-radius:8px;background:none;color:inherit;font:inherit;cursor:pointer}
.dx-side-seg button.dx-on{background:var(--dx-ui-bg,#fff);color:var(--dx-ui-accent,#0b57d0);font-weight:600;box-shadow:0 1px 3px rgba(47,46,43,.14)}
.dx-side-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.dx-side-pair .dx-side-field{flex-wrap:wrap;row-gap:2px}
.dx-side-pair .dx-side-field>span{width:100%;font-size:12px}
.dx-side-note{padding:6px 6px 0;color:var(--dx-ui-muted,#5f5d58);font-size:12px;line-height:1.4}
.dx-page-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 16px 16px}
.dx-page-foot button{height:36px;padding:0 16px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:10px;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit;font-weight:600;cursor:pointer}
.dx-page-foot button:hover{background:var(--dx-ui-hover,#f3f1ec)}
.dx-page-foot button.dx-main{border-color:var(--dx-ui-accent,#0b57d0);background:var(--dx-ui-accent,#0b57d0);color:var(--dx-ui-on-accent,#fff)}
.dx-page-foot button.dx-main:hover{background:var(--dx-ui-accent-hover,#08398a)}
.dx-page-dlg :focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:2px}
@media (prefers-reduced-motion:reduce){.dx-side,.dx-side-scrim{transition:none!important}}

/* Inside a box of its own, rather than over the whole window. */
.dx-side-boxed{position:absolute}
.dx-side-boxed.dx-side-sheet{max-height:88%}
`;

const svg = (body: string, size = 18) =>
  `<svg viewBox="0 0 18 18" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const SHEET = '<path d="M4.5 2.5h6L14 6v9.5H4.5z"/><path d="M10.5 2.5V6H14"/>';
const PATHS = {
  open: '<path d="M2.5 5.5a1 1 0 0 1 1-1h3l1.5 1.5h6.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/>',
  save: '<path d="M3.5 2.5h9l2 2v11h-11z"/><path d="M6 2.5v4h5.5v-4M6 15.5v-5h6v5"/>',
  saveAs: '<path d="M3.5 2.5h9l2 2v5M3.5 2.5v13H8"/><path d="M6 2.5v4h5.5v-4M10.5 15.5l.6-2.4 4-4 1.8 1.8-4 4z"/>',
  print: '<path d="M5 6.5v-4h8v4M5 12.5H3.5v-5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v5H13"/><path d="M5 10.5h8v5H5z"/>',
  doc: `${SHEET}<path d="M7 9.5h4.5M7 12h3"/>`,
  export: '<path d="M9 2.5v8M5.5 7 9 10.5 12.5 7M3.5 12.5v2.5h11v-2.5"/>',
  page: '<rect x="3.5" y="2.5" width="11" height="13" rx="1"/><path d="M6 2.5v13M3.5 5.5h11" stroke-dasharray="1.5 1.5"/>',
  letterhead: '<rect x="3.5" y="2.5" width="11" height="13" rx="1"/><path d="M5.5 5h3M5.5 13.5h7"/><circle cx="11.5" cy="5.2" r=".9" fill="currentColor" stroke="none"/>',
  language: '<circle cx="9" cy="9" r="6.5"/><path d="M2.5 9h13M9 2.5c2 2 2 11 0 13M9 2.5c-2 2-2 11 0 13"/>',
  theme: '<circle cx="9" cy="9" r="6.5"/><path d="M9 2.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/>',
  close: '<path d="m4.5 4.5 9 9M13.5 4.5l-9 9"/>',
  back: '<path d="M11 4 6 9l5 5"/>',
  chevron: '<path d="m7 4 5 5-5 5"/>',
};

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, html = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.innerHTML = html;
  return node;
}

function download({ name, blob }: { name: string; blob: Blob }): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

export function createSidebar(editor: Editor, options: SidebarOptions = {}): Sidebar {
  injectStyle();
  const screen = options.variant === 'screen';
  const scrim = el('div', 'dx-side-scrim');
  const side = el('div', `dx-side ${screen ? 'dx-side-screen' : 'dx-side-card'}`);
  side.setAttribute('role', 'dialog');
  side.setAttribute('aria-label', t('menu.title'));
  side.setAttribute('aria-modal', 'true');
  speaks(side);
  /** What to do, on every change of the document and each time the menu opens, to keep a part in step. */
  const updates: (() => void)[] = [];
  let isOpen = false;

  const baseName = () => (options.fileName?.() || t('file.default')).replace(/\.(docx|md|pdf)$/i, '');
  const give = options.onExport ?? download;

  /** Gives the keyboard back to what had it when the menu opened, and lets Tab out again. */
  let release: ((restore?: boolean) => void) | undefined;
  const close = (restore = true) => {
    if (!isOpen) return;
    isOpen = false;
    scrim.classList.remove('dx-side-open');
    side.classList.remove('dx-side-open');
    release?.(restore);
    release = undefined;
  };

  // --- The document: its name, how long it is, whether it is saved -------------------

  const docCard = () => {
    const node = el('div', 'dx-side-doc');
    const icon = el('span', 'dx-side-icon', svg(PATHS.doc, 20));
    const text = el('div', '');
    text.style.minWidth = '0';
    const name = el('div', 'dx-side-name');
    const meta = el('div', 'dx-side-meta');
    const length = el('span', '');
    const dirty = el('span', 'dx-side-dirty');
    dirty.textContent = t('menu.unsaved');
    meta.append(length, dirty);
    text.append(name, meta);
    node.append(icon, text);
    updates.push(() => {
      name.textContent = options.fileName?.() || t('file.untitled');
      const n = editor.pageCount;
      const count = words(docText(editor.doc));
      length.textContent = `${plural('menu.pages', n, { n })} · ${count.toLocaleString(getLocale())} ${plural('status.words', count)}`;
      dirty.hidden = !options.dirty?.();
    });
    return node;
  };
  const closeButton = () => {
    const x = el('button', 'dx-side-x', svg(PATHS.close));
    x.type = 'button';
    x.title = t('menu.close');
    x.setAttribute('aria-label', t('menu.close'));
    x.addEventListener('click', () => close());
    return x;
  };
  const head = (label: string) => {
    const node = el('div', 'dx-side-head');
    node.textContent = label;
    return node;
  };
  /** Something done to the document, which closes the menu first. */
  const act = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, id: string, html: string, action: () => void) => {
    const node = el(tag, `${className} dx-side-act`, html) as HTMLElementTagNameMap[K] & HTMLButtonElement;
    node.type = 'button';
    node.dataset.name = id;
    node.addEventListener('click', () => {
      close();
      action();
    });
    return node;
  };

  // --- The file: open, save, save a copy, print -------------------------------------------

  const tiles = () => {
    const node = el('div', 'dx-side-tiles');
    const tile = (id: string, path: string, label: string, action: () => void, keys = '') => {
      const button = act('button', 'dx-side-tile', id, svg(path, 22), action);
      button.append(label);
      if (keys) button.appendChild(el('kbd', '', keys));
      node.appendChild(button);
    };
    if (options.onOpen) tile('open', PATHS.open, t('menu.openShort'), options.onOpen, `${MOD}O`);
    if (options.onSave) tile('save', PATHS.save, t('menu.save'), options.onSave, `${MOD}S`);
    if (options.onSaveAs) tile('save-as', PATHS.saveAs, t('menu.saveAs').replace('…', ''), options.onSaveAs);
    // The print dialog of the browser, which also saves as PDF, with the fonts of this machine.
    tile('print', PATHS.print, t('menu.print').replace('…', ''), () => editor.print(), `${MOD}P`);
    return node;
  };

  // --- Export ------------------------------------------------------------------------------

  const formats = (withPrint: boolean) => {
    const node = el('div', 'dx-side-formats');
    const format = (id: string, badge: string, kind: string, label: string, ext: string, note: string, action: () => void) => {
      const button = act('button', 'dx-side-format', id, `<span class="dx-side-badge ${kind}" aria-hidden="true">${badge}</span>`, action);
      const text = el('span', '');
      const title = el('b', '');
      title.textContent = label;
      const extension = el('i', '');
      extension.textContent = ext;
      const small = el('small', '');
      small.textContent = note;
      text.append(title, extension, small);
      button.appendChild(text);
      button.setAttribute('aria-label', `${label} ${ext}. ${note}`);
      node.appendChild(button);
    };
    format('export-docx', 'W', 'dx-docx', 'Word', '.docx', t('menu.docxNote'), () => give({ name: `${baseName()}.docx`, blob: new Blob([editor.exportDocx()], { type: DOCX_TYPE }) }));
    format('export-pdf', 'PDF', 'dx-pdf', 'PDF', '.pdf', t('menu.pdfNote'), () => {
      void editor.exportPdf(baseName()).then((bytes) => give({ name: `${baseName()}.pdf`, blob: new Blob([bytes], { type: 'application/pdf' }) }));
    });
    format('export-md', 'M↓', 'dx-md', 'Markdown', '.md', t('menu.mdNote'), () =>
      give({ name: `${baseName()}.md`, blob: new Blob([editor.exportMarkdown()], { type: 'text/markdown;charset=utf-8' }) }),
    );
    if (withPrint) format('print', svg(PATHS.print, 20), 'dx-print', t('menu.print').replace('…', ''), MOD + 'P', t('menu.printNote'), () => editor.print());
    return node;
  };

  // --- The page and its letterhead ---------------------------------------------------------

  const page = () => editor.page;
  const upright = () => {
    const { width, height } = page();
    return width > height ? { short: height, long: width, landscape: true } : { short: width, long: height, landscape: false };
  };
  const cm = (pt: number) => String(Math.round((pt / PT_PER_CM) * 100) / 100);
  /** The page in words: its paper, how it is turned and its margins. */
  const pageWords = () => {
    const { short, long, landscape } = upright();
    const paper = PAPERS.find(([, width, height]) => near(short, width) && near(long, height));
    const p = page();
    const margins = MARGINS.find(([, v, s]) => near(p.marginTop, v) && near(p.marginBottom, v) && near(p.marginLeft, s) && near(p.marginRight, s));
    return {
      paper: paper ? t(paper[0]) : `${cm(p.width)} × ${cm(p.height)} cm`,
      rest: `${t(landscape ? 'pageSetup.landscape' : 'pageSetup.portrait')} · ${t('pageSetup.margins')}: ${margins ? t(margins[0]) : t('menu.marginsCustom')}`,
    };
  };
  const row = (id: string, path: string, action: () => void, read: () => { title: string; note: string }, end: () => string) => {
    const button = act('button', 'dx-side-row', id, svg(path, 20), action);
    const text = el('span', '');
    const title = el('b', '');
    const note = el('small', '');
    text.append(title, note);
    const more = el('em', '');
    button.append(text, more);
    updates.push(() => {
      const { title: a, note: b } = read();
      title.textContent = a;
      note.textContent = b;
      more.textContent = end();
    });
    return button;
  };
  /** The page drawn small: its shape, and the room the margins leave for the text. */
  const preview = () => {
    const node = el('div', 'dx-side-preview');
    node.setAttribute('aria-hidden', 'true');
    const text = el('i', '');
    node.appendChild(text);
    updates.push(() => {
      const p = page();
      node.style.height = `${(120 * p.height) / p.width}px`;
      text.style.left = `${(p.marginLeft / p.width) * 100}%`;
      text.style.right = `${(p.marginRight / p.width) * 100}%`;
      text.style.top = `${(p.marginTop / p.height) * 100}%`;
      text.style.bottom = `${(p.marginBottom / p.height) * 100}%`;
    });
    return node;
  };
  // The paper of the company: a picture under the text of every page, picked from the disk.
  const pickLetterhead = () => {
    const input = el('input', '');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) void editor.setLetterheadFile(file).then((ok) => ok || (options.onError ?? alert)(t('letterhead.failed')));
    });
    input.click();
  };
  const letterheadParts = (): HTMLElement[] => {
    if (options.letterhead === false) return [];
    const choose = row(
      'letterhead',
      PATHS.letterhead,
      pickLetterhead,
      () => ({ title: t(editor.hasLetterhead ? 'menu.letterheadOn' : 'menu.noLetterhead'), note: t(editor.hasLetterhead ? 'letterhead.change' : 'letterhead.set') }),
      () => '',
    );
    const chips = el('div', 'dx-side-chips');
    const chip = (id: string, label: string, action: () => void, danger = false) => chips.appendChild(act('button', `dx-side-chip${danger ? ' dx-danger' : ''}`, id, '', action)).append(label);
    chip('letterhead-fit', t('letterhead.fit'), () => void editor.fitLetterheadMargins());
    // The picture as the document keeps it, as a file of its own: to use it on another document.
    chip('letterhead-save', t('letterhead.save'), () => {
      const image = editor.letterhead;
      if (image) give({ name: `${baseName()}-${t('letterhead.name')}.${imageExtension(image.type) ?? 'png'}`, blob: new Blob([image.bytes as BlobPart], { type: image.type }) });
    });
    chip('letterhead-remove', t('letterhead.remove'), () => editor.removeLetterhead(), true);
    updates.push(() => (chips.hidden = !editor.hasLetterhead));
    return [choose, chips];
  };
  const languagePart = (): HTMLElement[] => {
    if (!options.onLocale) return [];
    const node = el('label', 'dx-side-lang');
    const label = el('span', '');
    label.textContent = t('menu.interface');
    const language = el('select', '');
    language.dataset.name = 'language';
    for (const { code, name } of locales()) language.add(new Option(name, code));
    language.addEventListener('change', () => options.onLocale?.(language.value));
    updates.push(() => (language.value = getLocale()));
    node.append(label, language);
    return [node];
  };

  /** Light, dark, or as the system is set: three buttons, the one in use pressed. */
  const themePart = (): HTMLElement[] => {
    if (!options.onTheme) return [];
    const node = el('div', 'dx-side-seg dx-side-theme');
    node.setAttribute('role', 'group');
    node.setAttribute('aria-label', t('menu.theme'));
    const choices: [Theme, MessageKey][] = [
      ['light', 'theme.light'],
      ['dark', 'theme.dark'],
      ['auto', 'theme.auto'],
    ];
    const buttons = choices.map(([theme, label]) => {
      const button = el('button', '');
      button.type = 'button';
      button.dataset.name = `theme-${theme}`;
      button.textContent = t(label);
      button.addEventListener('click', () => {
        options.onTheme?.(theme);
        // The menu itself takes the colours at once.
        for (const node of [scrim, side, pageScrim]) applyTheme(node, editor.theme);
        refresh();
      });
      return button;
    });
    updates.push(() =>
      buttons.forEach((button, i) => {
        const on = choices[i][0] === editor.theme;
        button.classList.toggle('dx-on', on);
        button.setAttribute('aria-pressed', String(on));
      }),
    );
    node.append(...buttons);
    return [node];
  };

  // --- The setup of the page, in a dialog over the document ---------------------------------

  // A dialog of its own, which shows each change behind it as it is made.
  const pageScrim = el('div', 'dx-page-scrim');
  const dialog = el('div', 'dx-page-dlg');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', t('pageSetup.title'));
  speaks(dialog);
  const dialogTop = el('div', 'dx-page-top');
  const dialogName = el('div', '');
  dialogName.textContent = t('pageSetup.title');
  const dialogX = el('button', 'dx-side-x', svg(PATHS.close));
  dialogX.type = 'button';
  dialogX.title = t('cancel');
  dialogX.setAttribute('aria-label', t('cancel'));
  dialogTop.append(dialogName, dialogX);
  const form = el('div', 'dx-page-body');
  const dialogFoot = el('div', 'dx-page-foot');
  const cancel = el('button', '');
  cancel.type = 'button';
  cancel.textContent = t('cancel');
  cancel.dataset.name = 'page-cancel';
  const accept = el('button', 'dx-main');
  accept.type = 'button';
  accept.textContent = t('accept');
  accept.dataset.name = 'page-accept';
  dialogFoot.append(cancel, accept);
  dialog.append(dialogTop, form, dialogFoot);
  pageScrim.appendChild(dialog);
  /** The page of each section as it was when the dialog was opened, to go back to on cancelling. */
  let pageBefore: PageSetup[] | undefined;
  /** Whether what is set goes to every section, and not only to the one being edited. */
  let everywhere = false;
  const setPage = (patch: Partial<PageSetup>) => editor.setPage(patch, everywhere);
  let releaseDialog: ((restore?: boolean) => void) | undefined;
  const openPageSetup = () => {
    if (pageBefore) return;
    close(false);
    pageBefore = editor.sectionPages();
    everywhere = false;
    refresh();
    pageScrim.classList.add('dx-side-open');
    releaseDialog = holdFocus(dialog, () => editor.focus());
    tabbables(form)[0]?.focus();
  };
  const closePageSetup = (keep: boolean) => {
    if (!pageBefore) return;
    // A field being typed in is taken before closing.
    (document.activeElement as HTMLElement | null)?.blur();
    if (!keep) editor.setSectionPages(pageBefore);
    pageBefore = undefined;
    pageScrim.classList.remove('dx-side-open');
    releaseDialog?.();
    releaseDialog = undefined;
  };
  accept.addEventListener('click', () => closePageSetup(true));
  cancel.addEventListener('click', () => closePageSetup(false));
  dialogX.addEventListener('click', () => closePageSetup(false));
  pageScrim.addEventListener('mousedown', (e) => {
    if (e.target === pageScrim) closePageSetup(false);
  });
  const field = (label: string, ...controls: HTMLElement[]) => {
    const node = el('label', 'dx-side-field');
    const text = el('span', '');
    text.textContent = label;
    node.append(text, ...controls);
    return node;
  };
  const pageRow = () =>
    row(
      'page-setup',
      PATHS.page,
      openPageSetup,
      () => ({ title: pageWords().paper, note: pageWords().rest }),
      () => t('pageSetup.title'),
    );

  const select = (id: string, labels: string[], onChange: (index: number) => void, current: () => number) => {
    const node = el('select', '');
    node.dataset.name = id;
    labels.forEach((label, i) => node.add(new Option(label, String(i))));
    node.add(new Option(t('pageSetup.custom'), CUSTOM));
    node.addEventListener('change', () => {
      if (node.value !== CUSTOM) onChange(Number(node.value));
      refresh();
    });
    updates.push(() => {
      const index = current();
      node.value = index < 0 ? CUSTOM : String(index);
    });
    return node;
  };
  /** A length in centimetres; `write` gets it in points, already within what `limits` allows. */
  const length = (id: string, readPt: () => number, write: (pt: number) => void, limits: () => [number, number]) => {
    const node = el('input', '');
    node.type = 'number';
    node.step = '0.1';
    node.min = '0';
    node.dataset.name = id;
    node.addEventListener('change', () => {
      const value = Number(node.value.replace(',', '.'));
      const [min, max] = limits();
      if (Number.isFinite(value) && node.value !== '') write(Math.max(min, Math.min(value * PT_PER_CM, Math.max(min, max))));
      // What was typed gives way to what was taken: a length out of range is brought back in.
      node.value = cm(readPt());
      refresh();
    });
    updates.push(() => {
      if (document.activeElement !== node) node.value = cm(readPt());
    });
    return node;
  };
  const unit = () => el('em', '', 'cm');

  // In a document of several sections: the one being edited, or all of them.
  const scope = (label: string, all: boolean) => {
    const node = el('button', '');
    node.type = 'button';
    node.textContent = label;
    node.dataset.name = all ? 'page-everywhere' : 'page-section';
    node.addEventListener('click', () => {
      everywhere = all;
      refresh();
    });
    updates.push(() => {
      node.classList.toggle('dx-on', everywhere === all);
      node.setAttribute('aria-pressed', String(everywhere === all));
    });
    return node;
  };
  const scopes = el('div', 'dx-side-seg');
  scopes.append(scope(t('pageSetup.thisSection'), false), scope(t('pageSetup.wholeDocument'), true));
  const scopeField = field(t('pageSetup.applyTo'), scopes);
  updates.push(() => (scopeField.hidden = editor.sectionCount < 2));
  form.appendChild(scopeField);

  form.appendChild(
    field(
      t('pageSetup.size'),
      select(
        'paper',
        PAPERS.map(([label]) => t(label)),
        (i) => {
          // The paper keeps the way it is turned.
          const [, width, height] = PAPERS[i];
          setPage(upright().landscape ? { width: height, height: width } : { width, height });
        },
        () => PAPERS.findIndex(([, width, height]) => near(upright().short, width) && near(upright().long, height)),
      ),
    ),
  );
  // Any other size is typed in: the least is what the margins need.
  const sizes = el('div', 'dx-side-pair');
  sizes.append(
    field(
      t('pageSetup.width'),
      length(
        'width',
        () => page().width,
        (width) => setPage({ width }),
        () => [page().marginLeft + page().marginRight + MIN_TEXT, 3600],
      ),
      unit(),
    ),
    field(
      t('pageSetup.height'),
      length(
        'height',
        () => page().height,
        (height) => setPage({ height }),
        () => [page().marginTop + page().marginBottom + MIN_TEXT, 3600],
      ),
      unit(),
    ),
  );
  form.appendChild(sizes);

  const turn = (label: string, landscape: boolean) => {
    const node = el('button', '');
    node.type = 'button';
    node.textContent = label;
    node.dataset.name = landscape ? 'landscape' : 'portrait';
    node.addEventListener('click', () => {
      const { short, long } = upright();
      setPage(landscape ? { width: long, height: short } : { width: short, height: long });
    });
    updates.push(() => {
      const on = upright().landscape === landscape;
      node.classList.toggle('dx-on', on);
      node.setAttribute('aria-pressed', String(on));
    });
    return node;
  };
  const turns = el('div', 'dx-side-seg');
  turns.append(turn(t('pageSetup.portrait'), false), turn(t('pageSetup.landscape'), true));
  const orientation = field(t('pageSetup.orientation'), turns);
  form.appendChild(orientation);

  form.appendChild(
    field(
      t('pageSetup.margins'),
      select(
        'margins',
        MARGINS.map(([label]) => t(label)),
        (i) => {
          const [, vertical, sides] = MARGINS[i];
          setPage({ marginTop: vertical, marginBottom: vertical, marginLeft: sides, marginRight: sides });
        },
        () => {
          const p = page();
          return MARGINS.findIndex(([, v, s]) => near(p.marginTop, v) && near(p.marginBottom, v) && near(p.marginLeft, s) && near(p.marginRight, s));
        },
      ),
    ),
  );
  const margin = (label: string, key: 'marginTop' | 'marginBottom' | 'marginLeft' | 'marginRight') => {
    const vertical = key === 'marginTop' || key === 'marginBottom';
    const other: keyof PageSetup = { marginTop: 'marginBottom', marginBottom: 'marginTop', marginLeft: 'marginRight', marginRight: 'marginLeft' }[key] as keyof PageSetup;
    // A margin goes as far as leaves room for the text against the one across.
    const limits = (): [number, number] => [0, (vertical ? page().height : page().width) - (page()[other] ?? 0) - MIN_TEXT];
    return field(
      label,
      length(
        key,
        () => page()[key],
        (value) => setPage({ [key]: value }),
        limits,
      ),
      unit(),
    );
  };
  const margins = el('div', 'dx-side-pair');
  margins.append(margin(t('pageSetup.top'), 'marginTop'), margin(t('pageSetup.bottom'), 'marginBottom'), margin(t('pageSetup.left'), 'marginLeft'), margin(t('pageSetup.right'), 'marginRight'));
  form.appendChild(margins);
  const note = el('div', 'dx-side-note');
  note.textContent = t('pageSetup.note');
  form.appendChild(note);

  // --- The card --------------------------------------------------------------------------------

  /** Where the card goes: under the button that opened it, or a sheet from the bottom on a narrow screen. */
  let anchor: HTMLElement | null = null;
  const place = () => {
    // The box it stays in, as a rectangle of the window: the window itself when there is none.
    const box = options.within?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const narrow = box.width < NARROW;
    side.classList.toggle('dx-side-narrow', narrow);
    if (screen) return;
    side.classList.toggle('dx-side-sheet', narrow);
    if (narrow) {
      side.style.left = side.style.top = side.style.maxHeight = '';
      return;
    }
    const at = anchor?.getBoundingClientRect();
    const width = side.offsetWidth || 408;
    const left = Math.max(8, Math.min((at ? at.left - box.left : 12) - 4, box.width - width - 8));
    const top = Math.max(8, (at ? at.bottom - box.top : 56) + 8);
    side.style.left = `${left}px`;
    side.style.top = `${top}px`;
    side.style.maxHeight = `${box.height - top - 12}px`;
  };

  if (!screen) {
    const inner = el('div', 'dx-side-in');
    const top = docCard();
    top.appendChild(closeButton());
    inner.append(top, tiles(), head(t('menu.export')), formats(false), head(t('page.word')), pageRow(), ...letterheadParts());
    if (options.onLocale) inner.append(head(t('language')), ...languagePart());
    if (options.onTheme) inner.append(head(t('menu.theme')), ...themePart());
    side.appendChild(inner);
  }

  // --- The screen ------------------------------------------------------------------------------

  const tabs: HTMLButtonElement[] = [];
  const panes: HTMLElement[] = [];
  const show = (index: number) => {
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    panes.forEach((pane, i) => (pane.hidden = i !== index));
  };
  if (screen) {
    const nav = el('nav', 'dx-side-nav');
    nav.setAttribute('aria-label', t('menu.title'));
    const back = el('button', 'dx-side-back', svg(PATHS.back));
    back.type = 'button';
    back.appendChild(el('span', '', t('menu.back')));
    back.setAttribute('aria-label', t('menu.back'));
    back.addEventListener('click', () => close());
    const list = el('div', '');
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-orientation', 'vertical');
    list.style.display = 'contents';
    nav.append(back, list);
    const main = el('div', 'dx-side-main');
    const pane = (id: string, path: string, label: string, intro: string, ...content: HTMLElement[]) => {
      const index = tabs.length;
      const tab = el('button', 'dx-side-tab', svg(path));
      tab.type = 'button';
      tab.id = `dx-side-tab-${id}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', `dx-side-pane-${id}`);
      tab.append(label);
      tab.addEventListener('click', () => show(index));
      list.appendChild(tab);
      tabs.push(tab);
      const node = el('section', 'dx-side-pane');
      node.id = `dx-side-pane-${id}`;
      node.setAttribute('role', 'tabpanel');
      node.setAttribute('aria-labelledby', tab.id);
      const title = el('h2', '');
      title.textContent = label;
      const text = el('p', '');
      text.textContent = intro;
      node.append(title, ...(intro ? [text] : []), ...content);
      main.appendChild(node);
      panes.push(node);
    };
    const info = docCard();
    info.style.marginBottom = '8px';
    pane('document', PATHS.doc, t('menu.document'), '', info, tiles());
    pane('export', PATHS.export, t('menu.export'), '', formats(true));
    const box = el('div', 'dx-side-pagebox');
    const rows = el('div', '');
    rows.append(pageRow());
    box.append(preview(), rows);
    pane('page', PATHS.page, t('page.word'), '', box, ...letterheadParts());
    if (options.onLocale) pane('language', PATHS.language, t('language'), '', ...languagePart());
    if (options.onTheme) pane('theme', PATHS.theme, t('menu.theme'), '', ...themePart());
    const corner = docCard();
    corner.querySelector('.dx-side-icon')?.remove();
    nav.appendChild(corner);
    main.appendChild(closeButton());
    side.append(nav, main);
    // Up and down the parts, as in a list of tabs.
    arrowsThrough(list, () => tabs, { next: ['ArrowDown', 'ArrowRight'], prev: ['ArrowUp', 'ArrowLeft'] });
    list.addEventListener('keydown', () => {
      const at = tabs.indexOf(document.activeElement as HTMLButtonElement);
      if (at >= 0) show(at);
    });
    show(0);
  }

  // Through the things to do with the arrows, as in a menu.
  if (!screen) arrowsThrough(side, () => tabbables(side).filter((node) => node.classList.contains('dx-side-act')), { next: ['ArrowDown', 'ArrowRight'], prev: ['ArrowUp', 'ArrowLeft'] });

  const refresh = () => {
    for (const update of updates) update();
  };

  const open = () => {
    if (isOpen) return;
    isOpen = true;
    const active = document.activeElement;
    anchor = active instanceof HTMLElement && active.dataset.name === 'menu' ? active : (options.within ?? document).querySelector<HTMLElement>('.dx-tb-btn[data-name="menu"]');
    refresh();
    if (screen) show(0);
    // In the colours of its editor, also when it is shown over the whole page.
    for (const node of [scrim, side, pageScrim]) applyTheme(node, editor.theme);
    scrim.classList.add('dx-side-open');
    side.classList.add('dx-side-open');
    place();
    release = holdFocus(side, () => editor.focus());
    // The first thing to do, not the button that closes: Escape does that.
    (screen ? tabs[0] : side.querySelector<HTMLElement>('.dx-side-act'))?.focus();
  };

  scrim.addEventListener('click', () => close());
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && pageBefore) {
      e.stopPropagation();
      closePageSetup(false);
    } else if (e.key === 'Enter' && pageBefore && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLSelectElement)) {
      e.preventDefault();
      e.stopPropagation();
      closePageSetup(true);
    } else if (e.key === 'Escape' && isOpen) {
      e.stopPropagation();
      close();
    }
  };
  const onResize = () => isOpen && place();
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', onResize);
  const unsubscribe = editor.onChange(() => {
    if (isOpen || pageBefore) refresh();
  });
  const within = options.within;
  if (within) for (const node of [scrim, side, pageScrim]) node.classList.add('dx-side-boxed');
  // The box can change its size without the window changing its own.
  const resized = within && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : undefined;
  resized?.observe(within!);
  (within ?? document.body).append(scrim, side, pageScrim);

  return {
    open,
    close,
    toggle: () => (isOpen ? close() : open()),
    openPageSetup,
    destroy() {
      unsubscribe();
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      resized?.disconnect();
      scrim.remove();
      side.remove();
      pageScrim.remove();
    },
  };
}
