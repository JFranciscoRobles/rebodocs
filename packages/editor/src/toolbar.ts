// A toolbar for an Editor: every command of the editor as a button, a list or
// a menu, kept in step with the selection. It only talks to the editor through
// its public methods, so an application can use it as it is or write its own.

import {
  type Align,
  type Border,
  type BorderStyle,
  type Columns,
  type ListKind,
  type ListStyle,
  type PageNumberFormat,
  type NoteNumbering,
  type PageNumbering,
  type ParagraphProps,
  HIGHLIGHT_COLORS,
  formatNumber,
  isVariableName,
} from '@rebodocs/core/internal';
import type { Editor, MarkKey } from './editor';
import { getLocale, plural, styleName, t } from './i18n';
import { fontFamilies } from './fonts';
import { IS_MAC } from './platform';
import { createImagePicker } from './imagegrid';
import { paragraphDialog } from './paragraphdialog';
import { colorName, installRegionKeys, markRegion } from './a11y';

export interface ToolbarOptions {
  /** Fonts offered in the list, after the ones given with `addFont`; the ones a document uses are added as they turn up. */
  fonts?: string[];
  sizes?: number[];
  /** Shown first, as a "menu" button, when given: what opens the application's menu, such as a sidebar. */
  onMenu?: () => void;
  /** Shown after the menu, as a "panel" button, when given: what shows and hides a side panel. */
  onPanel?: () => void;
  /** Whether the panel is shown, for its button to say so. */
  panelOpen?: () => boolean;
  /** The side the panel opens on, and so the end of the bar its button is at: the right, as it comes. */
  panelSide?: 'left' | 'right';
  /** Shown as a "find" button when given: what opens the search, such as a find bar. */
  onFind?: () => void;
  /** Shown as an "open" button when given; opening a file is the application's business. */
  onOpen?: () => void;
  /** Shown as a "download" button when given. */
  onExport?: () => void;
  /** The name of the document, shown in the bar when given; `dirty` says whether it has changes that are not saved. */
  title?: () => string;
  dirty?: () => boolean;
  /**
   * What asks for the name of a variable, the text of a note or the address
   * of a link, when one is chosen in the Insert menu: a bubble beside the selection, for one. Without
   * them the browser asks.
   */
  onInsertVariable?: () => void;
  onInsertNote?: () => void;
  onInsertLink?: () => void;
  /** Marking stretches that may be changed and restricting editing to them, in the Review menu. */
  forms?: boolean;
  /**
   * How the controls are set out. 'row', as it comes: one row, with what does
   * not fit under a button at its end. 'two-rows': the document above (the
   * menu, its name, undo, search) and the formatting under it. 'tabs': the
   * document above with tabs for the kinds of tools (Format, Insert, Page),
   * and under it only the tools of the tab chosen.
   */
  layout?: 'row' | 'two-rows' | 'tabs';
}

export interface Toolbar {
  /** Brings the bar in step with what is not the editor's to tell: the name of the document, and whether it is saved. */
  refresh(): void;
  destroy(): void;
}

const FONTS = ['Arial', 'Calibri', 'Cambria', 'Courier New', 'Georgia', 'Helvetica', 'Times New Roman', 'Verdana'];
/** The fonts Word offers for Chinese, after the others when the interface is in it: Simplified, or Traditional. */
const CHINESE_FONTS: Record<string, string[]> = {
  'zh-Hans': ['DengXian', 'SimSun', 'SimHei', 'Microsoft YaHei', 'KaiTi', 'FangSong'],
  'zh-Hant': ['PMingLiU', 'MingLiU', 'Microsoft JhengHei', 'DFKai-SB'],
};
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48];
const SPACINGS = [1, 1.15, 1.5, 2];
const TEXT_COLORS = ['000000', '434343', '666666', '999999', 'C00000', 'FF0000', 'FFC000', 'FFFF00', '92D050', '00B050', '00B0F0', '0070C0', '002060', '7030A0', 'C55A11', 'FFFFFF'];
/** How far one press of the indent buttons moves a paragraph, and the space the spacing toggles add. */
const INDENT_STEP = 36;
const SPACE_BEFORE = 12;
const SPACE_AFTER = 8;
/** Soft colours to put behind table cells. */
/** The labels a numbered list is offered in, `#` where the number goes; and the bullets. */
const NUMBER_STYLES: ListStyle[] = [
  { format: 'decimal', text: '#.' },
  { format: 'decimal', text: '#.-' },
  { format: 'decimal', text: '#)' },
  { format: 'lowerLetter', text: '#.' },
  { format: 'lowerLetter', text: '#.-' },
  { format: 'lowerLetter', text: '#)' },
  { format: 'upperLetter', text: '#.' },
  { format: 'upperLetter', text: '#.-' },
  { format: 'lowerRoman', text: '#.' },
  { format: 'upperRoman', text: '#.' },
  { format: 'lowerLetter', text: '(#)' },
  { format: 'decimal', text: '(#)' },
];
const BULLETS = ['•', '◦', '▪', '–', '✓', '➢'];
/** The label of the nth item of a list in a style: "c)", "iii.", "•". */
const listLabel = (style: ListStyle, n: number) => (style.format === 'bullet' ? style.text : style.text.replace('#', formatNumber(style.format, n)));

const CELL_SHADES = ['F2F2F2', 'D9D9D9', 'BFBFBF', 'FFF2CC', 'FFE699', 'FCE4D6', 'F8CBAD', 'E2EFDA', 'C6E0B4', 'DDEBF7', 'BDD7EE', 'D9E1F2', 'B4C6E7', 'EAD1DC', 'D9D2E9', 'FFFFFF'];
const GRID_COLUMNS = 8;
/** The grids of a menu, which the arrows go through by rows and columns. */
const GRIDS = '.dx-tb-grid, .dx-tb-colors';
const GRID_ROWS = 6;
const STYLE_ID = 'dx-toolbar-style';
const MOD = IS_MAC ? '⌘' : 'Ctrl+';
/** How long the pointer rests on a control before its name shows; none at all when one was showing just before. */
const TIP_DELAY = 350;
const TIP_WARM = 600;
/** The keys of a control, written after its name. */
const TIP_KEYS = / \(((?:⌘|Ctrl\+)[^()]+)\)$/;

const CSS = `
.dx-tb{position:relative;display:flex;align-items:center;padding:6px 10px;background:var(--dx-ui-bar,#fbfaf8);border-bottom:1px solid var(--dx-ui-line,#e6e3dc);font:13px system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-ink,#2f2e2b);user-select:none}
.dx-tb-group{flex:none;display:flex;align-items:center;gap:1px}
.dx-tb.dx-tb-two-rows,.dx-tb.dx-tb-tabs{flex-direction:column;align-items:stretch;padding:0}
.dx-tb-top{display:flex;align-items:center;gap:2px;min-width:0;padding:6px 8px}
.dx-tb-row{position:relative;display:flex;align-items:center;min-width:0;padding:5px 8px;border-top:1px solid var(--dx-ui-line,#e6e3dc)}
.dx-tb-top>.dx-tb-sep:first-child,.dx-tb-row>.dx-tb-sep:first-child{display:none}
.dx-tb-tablist{display:flex;gap:2px;margin:0 auto;padding:3px;border-radius:11px;background:var(--dx-ui-hover,#f3f1ec)}
.dx-tb-tablist button{height:28px;padding:0 14px;border:0;border-radius:8px;background:none;color:var(--dx-ui-muted,#5f5d58);font:inherit;font-weight:600;cursor:pointer}
.dx-tb-tablist button:hover{color:var(--dx-ui-ink,#2f2e2b)}
.dx-tb-tablist button[aria-pressed=true]{background:var(--dx-ui-bg,#fff);color:var(--dx-ui-accent,#0b57d0);box-shadow:0 1px 3px rgba(47,46,43,.14)}
.dx-tb-tablist button:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-2px}
.dx-tb-tabs .dx-tb-end,.dx-tb-two-rows .dx-tb-end{margin-left:0}
.dx-tb-two-rows .dx-tb-top .dx-tb-end{margin-left:auto}
.dx-tb-tabs .dx-tb-top{flex-wrap:wrap;row-gap:6px}
.dx-tb-tabs .dx-tb-top .dx-tb-end{margin-left:auto}
.dx-tb-tabs .dx-tb-tablist{order:0}
@media (max-width:640px){
.dx-tb-tabs .dx-tb-tablist{order:5;flex-basis:100%;margin:0}
.dx-tb-tablist button{flex:1}
}
.dx-tb-tray{position:absolute;right:8px;top:100%;z-index:19;display:none;flex-wrap:wrap;align-items:center;row-gap:4px;max-width:calc(100% - 16px);box-sizing:border-box;margin-top:4px;padding:6px 8px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:14px;background:var(--dx-ui-bg,#fff);box-shadow:0 6px 20px rgba(47,46,43,.14)}
.dx-tb-tray.dx-open{display:flex}
.dx-tb-group[hidden]{display:none}
.dx-tb-tray>.dx-tb-sep:first-child{display:none}
.dx-tb-sep{flex:none;width:1px;height:20px;margin:0 6px;background:var(--dx-ui-line,#e6e3dc)}
.dx-tb-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:2px;height:32px;min-width:32px;padding:0 6px;border:0;border-radius:9px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.dx-tb-badge{position:absolute;top:1px;right:0;min-width:15px;height:15px;padding:0 4px;box-sizing:border-box;border-radius:8px;background:var(--dx-ui-accent,#0b57d0);color:#fff;font:600 10px/15px system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;pointer-events:none}
.dx-tb-btn:hover:not(:disabled){background:var(--dx-ui-hover,#f3f1ec)}
.dx-tb-btn.dx-on{background:var(--dx-ui-active,#e8f0fd);color:var(--dx-ui-accent,#0b57d0)}
.dx-tb-btn:disabled{opacity:.35;cursor:default}
.dx-tb-btn:focus-visible,.dx-tb-item:focus-visible,.dx-tb-select:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-2px}
.dx-tb-btn svg{flex:none}
.dx-tb-btn.dx-tb-text{gap:5px;padding:0 8px}
.dx-tb-title{position:relative;max-width:220px;padding:0 6px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dx-tb-title.dx-dirty::before{content:"•";position:absolute;left:0;width:6px;text-align:center;color:#c5221f}
.dx-tb-end{margin-left:auto}
.dx-tb-item svg{flex:none;color:var(--dx-ui-muted,#5f5d58)}
.dx-tb-mark{font:600 15px/1 Georgia,"Times New Roman",serif}
.dx-tb-swatch{position:absolute;left:7px;right:7px;bottom:4px;height:3px;border-radius:1px;box-shadow:0 0 0 .5px rgba(0,0,0,.25)}
.dx-tb-num{width:72px;height:32px;padding:0 6px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;background:transparent;color:inherit;font:inherit}
.dx-tb-unit{align-self:center;padding:0 8px 0 4px;opacity:.7}
.dx-tb-select{height:32px;max-width:150px;padding:0 6px;border:1px solid transparent;border-radius:9px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.dx-tb-select:hover{background:var(--dx-ui-hover,#f3f1ec)}
.dx-tb-pop{position:absolute;z-index:20;padding:6px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:14px;background:var(--dx-ui-bg,#fff);box-shadow:0 6px 20px rgba(47,46,43,.14)}
.dx-tb-item{display:flex;align-items:center;gap:8px;width:100%;height:34px;padding:0 10px;border:0;border-radius:9px;background:none;color:inherit;font:inherit;text-align:left;white-space:nowrap;cursor:pointer}
.dx-tb-item:hover:not(:disabled){background:var(--dx-ui-hover,#f3f1ec)}
.dx-tb-item:disabled{opacity:.4;cursor:default}
.dx-tb-item.dx-on::before{content:"✓";width:12px;margin-left:-4px;color:var(--dx-ui-accent,#0b57d0)}
.dx-tb-item:not(.dx-on).dx-check::before{content:"";width:12px;margin-left:-4px}
.dx-tb-rule{height:1px;margin:6px 0;background:var(--dx-ui-line,#e6e3dc)}
.dx-tb-head{padding:6px 10px 2px;color:var(--dx-ui-muted,#5f5d58);font-size:11px;letter-spacing:.04em;text-transform:uppercase}
.dx-tb-seg{display:flex;gap:2px;padding:2px 6px 4px}
.dx-tb-seg .dx-tb-btn{flex:1;padding:0 10px;border:1px solid var(--dx-ui-line,#e6e3dc)}
.dx-tb-seg .dx-tb-btn.dx-on{border-color:var(--dx-ui-active-line,#a8c7fa)}
.dx-tb-item kbd{margin-left:auto;padding-left:16px;color:var(--dx-ui-muted,#5f5d58);font:inherit}
.dx-tb-grid{display:grid;grid-template-columns:repeat(${GRID_COLUMNS},22px);gap:2px;padding:4px}
.dx-tb-cell{width:22px;height:22px;padding:0;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:2px;background:var(--dx-ui-bg,#fff);cursor:pointer}
.dx-tb-cell.dx-on{border-color:var(--dx-ui-accent,#0b57d0);background:var(--dx-ui-active,#e8f0fd)}
.dx-tb-hint{padding:2px 6px 4px;color:var(--dx-ui-muted,#5f5d58);text-align:center}
.dx-tb-btn.dx-tb-split{min-width:14px;width:14px;margin-left:-1px;padding:0}
.dx-tb-lists{display:grid;grid-template-columns:repeat(3,76px);gap:6px;padding:4px 6px}
.dx-tb-sample{display:flex;flex-direction:column;gap:4px;padding:7px 6px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:10px;background:var(--dx-ui-bg,#fff);color:inherit;cursor:pointer}
.dx-tb-sample:hover{border-color:var(--dx-ui-active-line,#a8c7fa);background:var(--dx-ui-hover,#f3f1ec)}
.dx-tb-sample.dx-on{border-color:var(--dx-ui-accent,#0b57d0);background:var(--dx-ui-active,#e8f0fd)}
.dx-tb-sample:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:1px}
.dx-tb-sample span{display:flex;align-items:center;gap:5px}
.dx-tb-sample b{flex:none;width:24px;font:500 11px/1 system-ui,sans-serif;text-align:right;font-variant-numeric:tabular-nums}
.dx-tb-sample i{flex:1;height:3px;border-radius:2px;background:var(--dx-ui-line,#e6e3dc)}
.dx-tb-note{max-width:250px;padding:6px 10px 4px;color:var(--dx-ui-muted,#5f5d58);font-size:12px;line-height:1.4;white-space:normal}
.dx-tb-colors{display:grid;grid-template-columns:repeat(8,22px);gap:4px;padding:4px}
.dx-tb-color{width:22px;height:22px;padding:0;border:1px solid rgba(0,0,0,.25);border-radius:50%;cursor:pointer}
.dx-tb-color:hover{transform:scale(1.15)}
.dx-tb-tip{position:absolute;z-index:25;display:flex;align-items:center;gap:8px;max-width:280px;padding:6px 10px;border-radius:8px;background:#2f2e2b;color:#fff;font-size:12px;line-height:1.35;box-shadow:0 4px 14px rgba(47,46,43,.22);pointer-events:none;opacity:0;transition:opacity .08s}
.dx-tb-tip.dx-on{opacity:1}
@media (pointer:coarse){
.dx-tb-btn,.dx-tb-select{height:38px;min-width:38px}
.dx-tb-item{height:40px}
.dx-tb-colors{grid-template-columns:repeat(8,30px)}
.dx-tb-color{width:30px;height:30px}
.dx-tb-grid{grid-template-columns:repeat(${GRID_COLUMNS},26px)}
.dx-tb-cell{width:26px;height:26px}
}
.dx-tb-tip kbd{flex:none;padding:0 5px;border-radius:4px;background:rgba(255,255,255,.18);font:inherit;white-space:nowrap}
`;

const svg = (body: string) =>
  `<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const dot = (y: number) => `<circle cx="3.5" cy="${y}" r="1.1" fill="currentColor" stroke="none"/>`;
const digit = (y: number, n: number) => `<text x="1.8" y="${y}" font-size="5.5" font-family="system-ui,sans-serif" fill="currentColor" stroke="none">${n}</text>`;

const ICONS = {
  find: svg('<circle cx="8" cy="8" r="4.5"/><path d="m11.5 11.5 3.5 3.5"/>'),
  more: svg(
    '<circle cx="4" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="14" cy="9" r="1.2" fill="currentColor" stroke="none"/>',
  ),
  image: svg('<rect x="2.5" y="3.5" width="13" height="11" rx="1"/><circle cx="6.5" cy="7.5" r="1.2"/><path d="m2.5 12.5 3.5-3 3 2.5 2.5-2 4 3.5"/>'),
  panel: svg('<rect x="2.5" y="3.5" width="13" height="11" rx="1"/><path d="M7 3.5v11M4.3 6.5h1M4.3 9h1"/>'),
  panelRight: svg('<rect x="2.5" y="3.5" width="13" height="11" rx="1"/><path d="M11 3.5v11M12.7 6.5h1M12.7 9h1"/>'),
  menu: svg('<path d="M3 5h12M3 9h12M3 13h12"/>'),
  open: svg('<path d="M2.5 5.5a1 1 0 0 1 1-1h3l1.5 1.5h6.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/>'),
  download: svg('<path d="M9 3v8M5.5 8 9 11.5 12.5 8M3.5 14.5h11"/>'),
  undo: svg('<path d="M6 4 3 7l3 3"/><path d="M3 7h7a4 4 0 0 1 0 8H7"/>'),
  redo: svg('<path d="m12 4 3 3-3 3"/><path d="M15 7H8a4 4 0 0 0 0 8h3"/>'),
  left: svg('<path d="M3 4h12M3 7.5h8M3 11h12M3 14.5h8"/>'),
  center: svg('<path d="M3 4h12M5 7.5h8M3 11h12M5 14.5h8"/>'),
  right: svg('<path d="M3 4h12M7 7.5h8M3 11h12M7 14.5h8"/>'),
  justify: svg('<path d="M3 4h12M3 7.5h12M3 11h12M3 14.5h12"/>'),
  spacing: svg('<path d="M8.5 4h6.5M8.5 9h6.5M8.5 14h6.5M4 4.5v9M2.5 6 4 4.5 5.5 6M2.5 12 4 13.5 5.5 12"/>'),
  bullet: svg(`${dot(4.5)}${dot(9)}${dot(13.5)}<path d="M7 4.5h8M7 9h8M7 13.5h8"/>`),
  number: svg(`${digit(6.3, 1)}${digit(10.8, 2)}${digit(15.3, 3)}<path d="M7 4.5h8M7 9h8M7 13.5h8"/>`),
  outdent: svg('<path d="M3 4h12M9 7.5h6M9 11h6M3 14.5h12M6 7.4 3.5 9.25 6 11.1"/>'),
  indent: svg('<path d="M3 4h12M9 7.5h6M9 11h6M3 14.5h12M3.5 7.4 6 9.25 3.5 11.1"/>'),
  numbers: svg('<path d="M4.5 2.5h9v13h-9z"/><path d="M7.2 10.4h4M7 12.4h4M8.5 9.2 8 13.6M10.5 9.2 10 13.6"/>'),
  page: svg('<path d="M4.5 2.5h6L14 6v9.5H4.5z"/><path d="M10.5 2.5V6H14M7 9.5h4.5M7 12h4.5"/>'),
  table: svg('<rect x="2.5" y="3.5" width="13" height="11" rx="1"/><path d="M2.5 7.5h13M2.5 11h13M7 3.5v11M11.5 3.5v11"/>'),
  highlight: svg('<path d="m10.5 3 4 4-6.5 6.5H4.5V10z"/><path d="M9 4.5 13 8.5"/>'),
  toc: svg('<path d="M3 4.5h7M3 9h5M3 13.5h6"/><path d="M12 4.5h.01M10 9h.01M11 13.5h.01" stroke-dasharray=".1 2"/><path d="M14.5 4.5h.5M14.5 9h.5M14.5 13.5h.5"/>'),
  plus: svg('<path d="M9 4v10M4 9h10"/>'),
  sign: svg('<path d="M3 14.5h12M4 11.5c2-4 3.2-6.5 4.2-6.5s-.2 5 1.3 5 1.6-2.5 3.5-2.5"/>'),
  variable: svg('<path d="M6.5 3.5c-1.5 0-2 .8-2 2v2c0 .9-.6 1.5-1.5 1.5.9 0 1.5.6 1.5 1.5v2c0 1.2.5 2 2 2M11.5 3.5c1.5 0 2 .8 2 2v2c0 .9.6 1.5 1.5 1.5-.9 0-1.5.6-1.5 1.5v2c0 1.2-.5 2-2 2"/>'),
  link: svg('<path d="M7.5 10.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-.9.9"/><path d="M10.5 7.5a3 3 0 0 0-4.2 0L4 9.8A3 3 0 0 0 8.2 14l.9-.9"/>'),
  note: svg('<path d="M3.5 4.5h11v8h-6l-3 2.5v-2.5h-2z"/>'),
  textBox: svg('<rect x="2.5" y="3.5" width="13" height="11" rx="1"/><path d="M5.5 7h7M9 7v5"/>'),
  review: svg('<path d="M3 13.5V15h1.5l7.4-7.4-1.5-1.5L3 13.5zM12.6 4.4l1.5 1.5 1.2-1.2a1 1 0 0 0 0-1.4l-.1-.1a1 1 0 0 0-1.4 0l-1.2 1.2zM9 15h6"/>'),
  footnote: svg('<path d="M2.5 15.5h13M2.5 12.5h7M3 4l4.5 5M7.5 4L3 9M11 3.5l1.5-1v4"/>'),
  // The text, and at its end a line over the note, with its "i".
  endnote: svg('<path d="M2.5 3.5h13M2.5 6.5h13M2.5 9.5h9M2.5 12.5h4M2.5 15.5h8M13.5 12v3.5M13.5 10v.2"/>'),
  pageBreak: svg('<path d="M4.5 2.5v4h9v-4M4.5 15.5v-4h9v4M2.5 9h2M6.5 9h2M10.5 9h2M14.5 9h1"/>'),
  sectionBreak: svg('<path d="M4.5 2.5v3.5h9V2.5M4.5 15.5V12h9v3.5M2.5 8h13M2.5 10h13"/>'),
  columns: svg('<path d="M2.5 4h5.5M2.5 7h5.5M2.5 10h5.5M2.5 13h4M10 4h5.5M10 7h5.5M10 10h5.5M10 13h3"/>'),
  colOne: svg('<path d="M3 4h12M3 7h12M3 10h12M3 13h8"/>'),
  colTwo: svg('<path d="M2.5 4h5.5M2.5 7h5.5M2.5 10h5.5M2.5 13h4M10 4h5.5M10 7h5.5M10 10h5.5M10 13h3"/>'),
  colThree: svg('<path d="M2 4h3.6M2 7h3.6M2 10h3.6M7.2 4h3.6M7.2 7h3.6M7.2 10h3.6M12.4 4h3.6M12.4 7h3.6M12.4 10h2"/>'),
  colLeft: svg('<path d="M2.5 4h3M2.5 7h3M2.5 10h3M7.5 4h8M7.5 7h8M7.5 10h8M7.5 13h5"/>'),
  colRight: svg('<path d="M2.5 4h8M2.5 7h8M2.5 10h8M2.5 13h5M12.5 4h3M12.5 7h3M12.5 10h3"/>'),
  alignTop: svg('<path d="M3 3h12M9 15V6.5M6 9.5l3-3 3 3"/>'),
  alignMiddle: svg('<path d="M3 9h12M9 2.5v4M7 4.8l2 1.7 2-1.7M9 15.5v-4M7 13.2l2-1.7 2 1.7"/>'),
  alignBottom: svg('<path d="M3 15h12M9 3v8.5M6 8.5l3 3 3-3"/>'),
  textLevel: svg('<path d="M3 5h8M7 5v8M12 12h4M14 10l2 2-2 2"/>'),
  textUp: svg('<path d="M5 15V7M5 11h4M12 16V4M10 6l2-2 2 2"/>'),
  textDown: svg('<path d="M5 3v8M5 7h4M12 2v12M10 12l2 2 2-2"/>'),
  lineSingle: svg('<path d="M2.5 9h13"/>'),
  lineDouble: svg('<path d="M2.5 7.5h13M2.5 10.5h13"/>'),
  lineDashed: svg('<path d="M2.5 9h13" stroke-dasharray="3 2"/>'),
  lineDotted: svg('<path d="M2.5 9h13" stroke-dasharray=".1 2.5" stroke-width="2"/>'),
  columnBreak: svg('<path d="M3 4h4.5M3 7h4.5M3 10h2.5M10.5 8h4.5M10.5 11h4.5M10.5 14h4.5M6.5 13.5 9 11 6.5 8.5"/>'),
  caret: '<svg viewBox="0 0 8 8" width="8" height="8" fill="currentColor" aria-hidden="true"><path d="M1 2.5h6L4 6z"/></svg>',
};

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

/** Points in a centimetre. */
const PT_PER_CM = 72 / 2.54;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, html = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.innerHTML = html;
  return node;
}

export function createToolbar(container: HTMLElement, editor: Editor, options: ToolbarOptions = {}): Toolbar {
  injectStyle();
  const bar = el('div', 'dx-tb');
  bar.setAttribute('role', 'toolbar');
  const layout = options.layout ?? 'row';
  // In one row everything is in the bar; in two, the document above and the tools under it.
  const top = layout === 'row' ? bar : el('div', 'dx-tb-top');
  const row = layout === 'row' ? bar : el('div', 'dx-tb-row');
  if (layout !== 'row') {
    bar.classList.add(`dx-tb-${layout}`);
    bar.append(top, row);
  }
  /** What the groups made next are about: the document, or a kind of tool, which is a tab of its own in 'tabs'. */
  type Section = 'document' | 'format' | 'insert' | 'page';
  let section: Section = 'document';
  bar.setAttribute('aria-label', t('toolbar.label'));
  /** What to do, on every change of the document or the selection, to keep a control in step. */
  const updates: (() => void)[] = [];
  let popover: HTMLElement | null = null;
  /** The button the menu that is open came from. */
  let popoverFrom: HTMLElement | null = null;

  const closePopover = () => {
    popover?.remove();
    popover = null;
    popoverFrom?.setAttribute('aria-expanded', 'false');
    popoverFrom = null;
  };

  // The name of the control under the pointer, and its keys: said sooner than the browser says a title, and in the look of the bar.
  const tip = el('div', 'dx-tb-tip');
  tip.setAttribute('role', 'tooltip');
  let tipFor: HTMLElement | null = null;
  let tipTimer = 0;
  let tipHidden = 0;
  const hideTip = () => {
    window.clearTimeout(tipTimer);
    if (tip.classList.contains('dx-on')) tipHidden = Date.now();
    tip.classList.remove('dx-on');
    tipFor = null;
  };
  const showTip = (target: HTMLElement) => {
    const text = target.dataset.tip ?? '';
    // The button of a menu that is open has said what it is.
    if (!text || !target.isConnected || (popover && popover.dataset.for === target.dataset.name)) return;
    const keys = TIP_KEYS.exec(text);
    const label = el('span', '');
    label.textContent = keys ? text.slice(0, keys.index) : text;
    tip.replaceChildren(label);
    if (keys) tip.appendChild(el('kbd', '')).textContent = keys[1];
    bar.appendChild(tip);
    // Under the control and centred on it, inside the bar.
    const at = target.getBoundingClientRect();
    const box = bar.getBoundingClientRect();
    const left = at.left - box.left + at.width / 2 - tip.offsetWidth / 2;
    tip.style.left = `${Math.round(Math.max(4, Math.min(left, bar.clientWidth - tip.offsetWidth - 4)))}px`;
    tip.style.top = `${Math.round(at.bottom - box.top + 6)}px`;
    tip.classList.add('dx-on');
  };
  const aimTip = (target: HTMLElement | null) => {
    if (target === tipFor) return;
    hideTip();
    tipFor = target;
    if (!target) return;
    if (Date.now() - tipHidden < TIP_WARM) showTip(target);
    else tipTimer = window.setTimeout(() => showTip(target), TIP_DELAY);
  };
  const tipTarget = (node: EventTarget | null) => (node instanceof Element ? node.closest<HTMLElement>('[data-tip]') : null);
  bar.addEventListener('mouseover', (e) => aimTip(tipTarget(e.target)));
  bar.addEventListener('mouseleave', hideTip);
  // Pressing it is the answer to what it does; so is reaching it with the keyboard.
  bar.addEventListener(
    'mousedown',
    (e) => {
      hideTip();
      // It does not come back while the pointer stays on what was pressed.
      tipFor = tipTarget(e.target);
      tipHidden = 0;
    },
    true,
  );
  bar.addEventListener('focusin', (e) => {
    const target = tipTarget(e.target);
    if (target?.matches(':focus-visible') && !(target instanceof HTMLSelectElement)) aimTip(target);
  });
  bar.addEventListener('focusout', hideTip);

  /** Shows `content` in a panel under `anchor`; any other panel closes. */
  const openPopover = (anchor: HTMLElement, content: HTMLElement) => {
    const wasMine = popover?.dataset.for === anchor.dataset.name;
    closePopover();
    if (wasMine) return;
    popover = el('div', 'dx-tb-pop');
    popover.dataset.for = anchor.dataset.name;
    popover.appendChild(content);
    bar.appendChild(popover);
    // Under its control wherever that is: in the bar, or among the ones that did not fit in it.
    const at = anchor.getBoundingClientRect();
    const box = bar.getBoundingClientRect();
    const left = Math.min(at.left - box.left, Math.max(0, bar.clientWidth - popover.offsetWidth - 8));
    popover.style.left = `${Math.max(0, left)}px`;
    popover.style.top = `${at.bottom - box.top + 4}px`;
    popoverFrom = anchor;
    anchor.setAttribute('aria-expanded', 'true');
    // Opened from the keyboard (a click leaves it in the document): the keyboard goes into the menu.
    if (document.activeElement === anchor) focusables(popover)[0]?.focus();
  };

  /** Runs a command and gives the keyboard back to the document. */
  const run = (command: () => void) => () => {
    closePopover();
    const before = document.activeElement;
    command();
    // Back to the text, unless what was done gave the keyboard to something of its own, as a menu or a dialog does.
    if (document.activeElement === before || document.activeElement === document.body) editor.focus();
  };

  /** The groups of the bar in their order, each with the line before it; `keep` for the ones that never leave the bar. */
  const groups: { sep?: HTMLElement; node: HTMLElement; keep: boolean; section: Section }[] = [];
  const group = (...children: HTMLElement[]) => {
    const into = section === 'document' ? top : row;
    const sep = into.children.length ? el('span', 'dx-tb-sep') : undefined;
    if (sep) into.appendChild(sep);
    const node = el('div', 'dx-tb-group');
    node.append(...children);
    into.appendChild(node);
    // Above the tools, the document's groups never go under the button of the rest.
    groups.push({ sep, node, keep: layout !== 'row' && section === 'document', section });
    return groups[groups.length - 1];
  };

  const button = (name: string, label: string, html: string, onClick: () => void, state?: () => { on?: boolean; disabled?: boolean }) => {
    const node = el('button', 'dx-tb-btn', html);
    node.type = 'button';
    node.dataset.tip = label;
    node.dataset.name = name;
    node.setAttribute('aria-label', label);
    node.addEventListener('click', onClick);
    if (state) {
      updates.push(() => {
        const { on = false, disabled = false } = state();
        node.classList.toggle('dx-on', on);
        node.setAttribute('aria-pressed', String(on));
        node.disabled = disabled;
      });
    }
    return node;
  };

  /** A button that opens a menu or a panel under it. */
  const menuButton = (...args: Parameters<typeof button>) => {
    const node = button(...args);
    node.setAttribute('aria-haspopup', 'true');
    node.setAttribute('aria-expanded', 'false');
    return node;
  };

  const head = (label: string) => {
    const node = el('div', 'dx-tb-head');
    node.textContent = label;
    return node;
  };

  const item = (label: string, onClick: () => void, disabled = false, on?: boolean, keys?: string, icon = '') => {
    const node = el('button', `dx-tb-item${on === undefined ? '' : ' dx-check'}${on ? ' dx-on' : ''}`, icon);
    node.type = 'button';
    node.append(label);
    if (on !== undefined) node.setAttribute('aria-checked', String(on));
    if (keys) node.appendChild(el('kbd', '', keys));
    node.disabled = disabled;
    node.addEventListener('click', run(onClick));
    return node;
  };

  const select = (name: string, label: string, values: string[], onChange: (value: string) => void, current: () => string) => {
    const node = el('select', 'dx-tb-select');
    node.dataset.tip = label;
    node.dataset.name = name;
    node.setAttribute('aria-label', label);
    for (const value of values) node.add(new Option(value, value));
    node.addEventListener('change', () => {
      onChange(node.value);
      editor.focus();
    });
    updates.push(() => {
      // A font the application gave after the bar was made.
      if (name === 'font') for (const family of fontFamilies()) if (![...node.options].some((option) => option.value === family)) node.add(new Option(family, family), 0);
      const value = current();
      // A document may use a font or a size that is not in the list yet.
      if (![...node.options].some((option) => option.value === value)) node.add(new Option(value, value));
      node.value = value;
    });
    return node;
  };

  /** A button that opens a palette; the bar under its icon shows the colour in use. */
  const colorButton = (name: string, label: string, html: string, colors: string[], current: () => string, apply: (color: string) => void, none?: string) => {
    const swatch = el('span', 'dx-tb-swatch');
    const node = menuButton(name, label, `${html}`, () => {
      const panel = el('div', '');
      const grid = el('div', 'dx-tb-colors');
      for (const color of colors) {
        const choice = el('button', 'dx-tb-color');
        choice.type = 'button';
        // Read out by its name, as in Word: a number says nothing to whoever does not see it.
        choice.dataset.tip = colorName(color);
        choice.setAttribute('aria-label', colorName(color));
        if (color === current()) choice.setAttribute('aria-current', 'true');
        choice.style.background = `#${color}`;
        choice.addEventListener(
          'click',
          run(() => apply(color)),
        );
        grid.appendChild(choice);
      }
      panel.appendChild(grid);
      if (none)
        panel.append(
          el('div', 'dx-tb-rule'),
          item(none, () => apply('')),
        );
      openPopover(node, panel);
    });
    node.appendChild(swatch);
    updates.push(() => {
      swatch.style.background = current() ? `#${current()}` : 'transparent';
      node.setAttribute('aria-label', t('color.current', { name: label, color: colorName(current()) }));
    });
    return node;
  };

  // --- File and history -------------------------------------------------------

  const lead: HTMLElement[] = [];
  if (options.onMenu) lead.push(button('menu', t('menu.title'), ICONS.menu, run(options.onMenu)));
  /**
   * The side panel, at the end of the bar it opens on: pressed while it is
   * shown, and with how many notes and changes there are to see in it.
   */
  const panelButton = () => {
    if (!options.onPanel) return undefined;
    const right = options.panelSide !== 'left';
    const node = button('panel', t('toolbar.panel'), right ? ICONS.panelRight : ICONS.panel, run(options.onPanel), () => ({ on: !!options.panelOpen?.() }));
    const badge = node.appendChild(el('span', 'dx-tb-badge'));
    updates.push(() => {
      const count = editor.notes.length + (editor.hasRevisions ? editor.revisions.length : 0);
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = !count;
      node.setAttribute('aria-label', count ? `${t('toolbar.panel')} (${count})` : t('toolbar.panel'));
    });
    return node;
  };
  const panelAtEnd = options.panelSide !== 'left';
  if (!panelAtEnd) {
    const node = panelButton();
    if (node) lead.push(node);
  }
  if (lead.length) group(...lead).keep = true;

  // The document: its name, and a mark while it has changes that are not saved.
  if (options.title) {
    const name = el('span', 'dx-tb-title');
    name.dataset.name = 'title';
    updates.push(() => {
      const text = options.title?.() ?? '';
      const dirty = !!options.dirty?.();
      if (name.textContent !== text) name.textContent = text;
      name.classList.toggle('dx-dirty', dirty);
      name.dataset.tip = dirty ? `${text} — ${t('toolbar.unsaved')}` : text;
    });
    group(name).keep = true;
  }

  const file: HTMLElement[] = [];
  if (options.onOpen) file.push(button('open', t('toolbar.open'), ICONS.open, run(options.onOpen)));
  if (options.onExport) file.push(button('export', t('toolbar.download'), ICONS.download, run(options.onExport)));
  if (file.length) group(...file);

  group(
    button(
      'undo',
      `${t('toolbar.undo')} (${MOD}Z)`,
      ICONS.undo,
      run(() => editor.undo()),
      () => ({ disabled: !editor.canUndo }),
    ),
    button(
      'redo',
      `${t('toolbar.redo')} (${MOD}Y)`,
      ICONS.redo,
      run(() => editor.redo()),
      () => ({ disabled: !editor.canRedo }),
    ),
  );

  // --- Characters ---------------------------------------------------------------

  section = 'format';

  // The styles are those of the document: the list is filled again when another one is opened.
  const style = el('select', 'dx-tb-select');
  style.dataset.tip = t('toolbar.style');
  style.dataset.name = 'style';
  style.setAttribute('aria-label', t('toolbar.style'));
  style.addEventListener('change', () => {
    editor.setParagraphStyle(style.value);
    editor.focus();
  });
  let listed: unknown;
  updates.push(() => {
    if (listed !== editor.styles) {
      listed = editor.styles;
      style.replaceChildren(...editor.styles.map((s) => new Option(styleName(s), s.id)));
    }
    // Paragraphs of different styles show none.
    style.value = editor.activeStyleId() ?? '';
  });

  group(
    style,
    select(
      'font',
      t('toolbar.font'),
      [...new Set([...fontFamilies(), ...(options.fonts ?? [...FONTS, ...(CHINESE_FONTS[getLocale()] ?? [])])])],
      (fontFamily) => editor.setRunProps({ fontFamily }),
      () => editor.activeRunProps().fontFamily,
    ),
    select(
      'size',
      t('toolbar.fontSize'),
      (options.sizes ?? SIZES).map(String),
      (size) => editor.setRunProps({ fontSize: Number(size) }),
      () => String(editor.activeRunProps().fontSize),
    ),
  );

  const marks: [MarkKey, string, string][] = [
    // The letter of each is that of its name in the language of the bar, as everywhere else they are offered.
    ['bold', `${t('mark.bold')} (${MOD}B)`, `<span class="dx-tb-mark">${t('mark.bold.letter')}</span>`],
    ['italic', `${t('mark.italic')} (${MOD}I)`, `<span class="dx-tb-mark" style="font-style:italic">${t('mark.italic.letter')}</span>`],
    ['underline', `${t('mark.underline')} (${MOD}U)`, `<span class="dx-tb-mark" style="text-decoration:underline">${t('mark.underline.letter')}</span>`],
    ['strike', t('mark.strike'), `<span class="dx-tb-mark" style="text-decoration:line-through">${t('mark.strike.letter')}</span>`],
  ];
  group(
    ...marks.map(([key, label, html]) =>
      button(
        key,
        label,
        html,
        run(() => editor.toggleMark(key)),
        () => ({ on: editor.activeRunProps()[key] }),
      ),
    ),
    colorButton(
      'color',
      t('toolbar.color'),
      '<span class="dx-tb-mark" style="margin-top:-4px">A</span>',
      TEXT_COLORS,
      () => editor.activeRunProps().color,
      (color) => editor.setRunProps({ color }),
    ),
    colorButton(
      'highlight',
      t('toolbar.highlight'),
      ICONS.highlight.replace('<svg ', '<svg style="margin-top:-4px" '),
      HIGHLIGHT_COLORS,
      () => editor.activeRunProps().highlight,
      (highlight) => editor.setRunProps({ highlight }),
      t('toolbar.noHighlight'),
    ),
  );

  // --- Paragraphs -----------------------------------------------------------------

  const aligns: [Align, string][] = [
    ['left', t('align.left')],
    ['center', t('align.center')],
    ['right', t('align.right')],
    ['justify', t('align.justify')],
  ];
  const spacing = menuButton('spacing', t('spacing.title'), ICONS.spacing + ICONS.caret, () => {
    const panel = el('div', '');
    const props = editor.activeParagraphProps();
    const toggle = (label: string, on: boolean, patch: ParagraphProps) => item(label, () => editor.setParagraphProps(patch), false, on);
    panel.appendChild(head(t('spacing.line')));
    for (const value of SPACINGS) {
      const label = value.toLocaleString(getLocale(), { minimumFractionDigits: 1 });
      panel.appendChild(toggle(label, Math.abs(props.lineHeight - value) < 0.005, { lineHeight: value }));
    }
    panel.append(
      el('div', 'dx-tb-rule'),
      toggle(t('spacing.before'), props.spacingBefore > 0, { spacingBefore: props.spacingBefore > 0 ? 0 : SPACE_BEFORE }),
      toggle(t('spacing.after'), props.spacingAfter > 0, { spacingAfter: props.spacingAfter > 0 ? 0 : SPACE_AFTER }),
      el('div', 'dx-tb-rule'),
      head(t('spacing.pagination')),
      toggle(t('spacing.widows'), props.widowControl, { widowControl: !props.widowControl }),
      toggle(t('spacing.keepNext'), props.keepNext, { keepNext: !props.keepNext }),
      toggle(t('spacing.keepLines'), props.keepLines, { keepLines: !props.keepLines }),
      toggle(t('spacing.breakBefore'), props.pageBreakBefore, { pageBreakBefore: !props.pageBreakBefore }),
      el('div', 'dx-tb-rule'),
      // The indents typed in: what the handles of the ruler do, for whoever does not drag them.
      item(t('indent.dialog'), () => paragraphDialog(editor).open()),
    );
    openPopover(spacing, panel);
  });
  // One button for the four: it shows the alignment of the paragraph, and opens the others.
  const alignment = menuButton('align', t('toolbar.align'), '', () => {
    const panel = el('div', '');
    const now = editor.activeParagraphProps().align;
    for (const [align, label] of aligns) {
      const choice = item(label, () => editor.setParagraphProps({ align }), false, now === align, undefined, ICONS[align]);
      choice.dataset.name = `align-${align}`;
      panel.appendChild(choice);
    }
    openPopover(alignment, panel);
  });
  updates.push(() => {
    const now = editor.activeParagraphProps().align;
    if (alignment.dataset.align === now) return;
    alignment.dataset.align = now;
    alignment.innerHTML = ICONS[now] + ICONS.caret;
  });
  group(alignment, spacing);

  const lists: [ListKind, string][] = [
    ['bullet', t('list.bullet')],
    ['number', t('list.number')],
  ];
  // Next to each list, the arrow of its styles: the label of the level the caret is at (a), 1.-, ➢…),
  // and what is done with the levels and the numbering.
  const sameStyle = (a: ListStyle | undefined, b: ListStyle) => !!a && a.format === b.format && a.text === b.text;
  const listStyles = (kind: ListKind, label: string) => {
    const name = `${kind}-styles`;
    const node = menuButton(name, label, ICONS.caret, () => {
      const panel = el('div', '');
      const current = editor.listStyle;
      const styles = kind === 'bullet' ? BULLETS.map((text): ListStyle => ({ format: 'bullet', text })) : NUMBER_STYLES;
      panel.appendChild(head(t(kind === 'bullet' ? 'list.bulletsOfLevel' : 'list.numbersOfLevel')));
      const grid = el('div', 'dx-tb-lists');
      for (const style of styles) {
        const on = sameStyle(current, style);
        const sample = el('button', `dx-tb-sample${on ? ' dx-on' : ''}`);
        sample.type = 'button';
        sample.dataset.name = `list-style-${style.format}-${style.text}`;
        sample.setAttribute('aria-label', t('list.styleOf', { sample: listLabel(style, 1) }));
        sample.setAttribute('aria-pressed', String(on));
        for (let n = 1; n <= 3; n++) {
          const line = sample.appendChild(el('span', ''));
          line.append(el('b', '', listLabel(style, n)), el('i', ''));
        }
        sample.addEventListener(
          'click',
          run(() => editor.setListStyle(style)),
        );
        grid.appendChild(sample);
      }
      panel.append(grid, el('div', 'dx-tb-rule'));
      const inList = !!editor.activeListKind();
      panel.append(
        item(t('list.down'), () => editor.shiftListLevel(1), !inList, undefined, 'Tab', ICONS.indent),
        item(t('list.up'), () => editor.shiftListLevel(-1), !inList, undefined, '⇧Tab', ICONS.outdent),
      );
      if (kind === 'number') {
        const numbered = editor.activeListKind() === 'number';
        panel.append(
          el('div', 'dx-tb-rule'),
          item(t('list.restart'), () => editor.restartNumbering(), !numbered),
          item(t('list.continue'), () => void editor.continueNumbering(), !numbered),
        );
      }
      panel.appendChild(el('div', 'dx-tb-note', t('list.hint')));
      openPopover(node, panel);
    });
    node.classList.add('dx-tb-split');
    return node;
  };
  group(
    ...lists.flatMap(([kind, label]) => [
      button(
        kind,
        label,
        ICONS[kind],
        run(() => editor.toggleList(kind)),
        () => ({ on: editor.activeListKind() === kind }),
      ),
      listStyles(kind, t(kind === 'bullet' ? 'list.bulletStyles' : 'list.numberStyles')),
    ]),
    // In a list these change the level of the item; anywhere else, the indent of the paragraph.
    button(
      'outdent',
      t('indent.less'),
      ICONS.outdent,
      run(() => (editor.activeListKind() ? editor.shiftListLevel(-1) : editor.shiftIndent(-INDENT_STEP))),
      () => ({ disabled: !editor.activeListKind() && editor.activeParagraphProps().indentLeft <= 0 }),
    ),
    button(
      'indent',
      t('indent.more'),
      ICONS.indent,
      run(() => (editor.activeListKind() ? editor.shiftListLevel(1) : editor.shiftIndent(INDENT_STEP))),
    ),
  );

  // --- Tables ---------------------------------------------------------------------

  // Pictures come from a file, which this input asks for.
  // One goes in at the caret; several, as a grid whose order is chosen first.
  const picker = createImagePicker(editor);
  bar.appendChild(picker);

  // --- Insert -----------------------------------------------------------------------

  /** Asks for the name of a variable, or the text of a note, once the menu has given the keyboard back. */
  const ask = (hook: (() => void) | undefined, prompt: string, use: (text: string) => void) => () => {
    if (hook) {
      setTimeout(hook, 0);
      return;
    }
    const text = window.prompt(prompt)?.trim();
    if (text) use(text);
  };
  const insert = menuButton('insert', t('toolbar.insertTools'), `${ICONS.plus}<span>${t('insert')}</span>${ICONS.caret}`, () => {
    const panel = el('div', '');
    const body = editor.area === 'body';
    const outside = !editor.inTable && editor.canEditTables;
    if (outside) {
      // A grid to pick the size of a new table from; a table cannot go inside another.
      const grid = el('div', 'dx-tb-grid');
      const hint = el('div', 'dx-tb-hint');
      hint.textContent = t('table.insert');
      const cells: HTMLElement[] = [];
      const mark = (rows: number, columns: number) => {
        cells.forEach((cell, i) => cell.classList.toggle('dx-on', Math.floor(i / GRID_COLUMNS) < rows && i % GRID_COLUMNS < columns));
        hint.textContent = rows ? `${columns} × ${rows}` : t('table.insert');
      };
      for (let i = 0; i < GRID_ROWS * GRID_COLUMNS; i++) {
        const rows = Math.floor(i / GRID_COLUMNS) + 1;
        const columns = (i % GRID_COLUMNS) + 1;
        const cell = el('button', 'dx-tb-cell');
        cell.type = 'button';
        // Each number in its own plural: "1 column by 2 rows", in the order the language puts them.
        cell.setAttribute('aria-label', t('table.cells', { columns: plural('table.columns', columns, { n: columns }), rows: plural('table.rows', rows, { n: rows }) }));
        cell.addEventListener('mouseenter', () => mark(rows, columns));
        cell.addEventListener('focus', () => mark(rows, columns));
        cell.addEventListener(
          'click',
          run(() => editor.insertTable(rows, columns)),
        );
        cells.push(cell);
        grid.appendChild(cell);
      }
      grid.addEventListener('mouseleave', () => mark(0, 0));
      panel.append(grid, hint, el('div', 'dx-tb-rule'));
    }
    const entry = (name: string, ...rest: Parameters<typeof item>) => {
      const node = item(...rest);
      node.dataset.name = `insert-${name}`;
      return node;
    };
    panel.append(
      entry('image', t('insert.image'), () => picker.click(), false, undefined, undefined, ICONS.image),
      entry('signatures', t('bubble.signatures'), () => editor.insertSignatures(), !outside, undefined, undefined, ICONS.sign),
      entry(
        'variable',
        t('insert.variable'),
        ask(options.onInsertVariable, t('bubble.name'), (name) => isVariableName(name) && editor.insertVariable(name)),
        false,
        undefined,
        undefined,
        ICONS.variable,
      ),
      entry(
        'link',
        t('insert.link'),
        ask(options.onInsertLink, t('link.address'), (address) => editor.setLink(address)),
        false,
        undefined,
        `${MOD}K`,
        ICONS.link,
      ),
      entry('footnote', t('insert.footnote'), () => editor.insertFootnote(), !body, undefined, IS_MAC ? '⌘⌥F' : 'Ctrl+Alt+F', ICONS.footnote),
      entry('endnote', t('insert.endnote'), () => editor.insertEndnote(), !body, undefined, IS_MAC ? '⌘⌥D' : 'Ctrl+Alt+D', ICONS.endnote),
      entry('text-box', t('insert.textBox'), () => editor.insertTextBox(), !body, undefined, undefined, ICONS.textBox),
      entry(
        'note',
        t('insert.note'),
        ask(options.onInsertNote, t('bubble.notePlaceholder'), (text) => editor.addNote(text)),
        !body,
        undefined,
        undefined,
        ICONS.note,
      ),
      // A document has one: once it is there, this brings it up to date.
      editor.hasToc
        ? entry('toc', t('toc.update'), () => editor.updateToc(), false, undefined, undefined, ICONS.toc)
        : entry('toc', t('toc.insert'), () => editor.insertToc(), !outside || !body, undefined, undefined, ICONS.toc),
      el('div', 'dx-tb-rule'),
      entry('page-break', t('bubble.pageBreak'), () => editor.insertPageBreak(), !body || editor.inTable, undefined, `${MOD}↵`, ICONS.pageBreak),
      // A part of its own: another orientation, other margins, another header from there on.
      entry('section-break', t('insert.sectionNextPage'), () => editor.insertSectionBreak('nextPage'), !body || editor.inTable, undefined, undefined, ICONS.sectionBreak),
      entry('section-continuous', t('insert.sectionContinuous'), () => editor.insertSectionBreak('continuous'), !body || editor.inTable, undefined, undefined, ICONS.sectionBreak),
      entry('page-number', t('insert.pageNumber'), () => openPopover(page, pagePanel()), false, undefined, undefined, ICONS.numbers),
    );
    openPopover(insert, panel);
  });
  insert.classList.add('dx-tb-text');
  // In tabs there is room for what is put in most, each a button with its name; the menu keeps the rest.
  const labeled = (name: string, label: string, icon: string, action: () => void, state?: () => { disabled?: boolean }) => {
    const node = button(`quick-${name}`, label, `${icon}<span>${label.replace('…', '')}</span>`, run(action), state);
    node.classList.add('dx-tb-text');
    return node;
  };
  const inBody = () => ({ disabled: editor.area !== 'body' });
  const quick =
    layout === 'tabs'
      ? [
          labeled('image', t('insert.image'), ICONS.image, () => picker.click()),
          labeled(
            'link',
            t('insert.link'),
            ICONS.link,
            ask(options.onInsertLink, t('link.address'), (address) => editor.setLink(address)),
          ),
          labeled(
            'note',
            t('insert.note'),
            ICONS.note,
            ask(options.onInsertNote, t('bubble.notePlaceholder'), (text) => editor.addNote(text)),
            inBody,
          ),
          labeled(
            'variable',
            t('insert.variable'),
            ICONS.variable,
            ask(options.onInsertVariable, t('bubble.name'), (name) => isVariableName(name) && editor.insertVariable(name)),
          ),
          labeled('footnote', t('insert.footnote'), ICONS.footnote, () => editor.insertFootnote(), inBody),
          labeled('endnote', t('insert.endnote'), ICONS.endnote, () => editor.insertEndnote(), inBody),
          labeled(
            'page-break',
            t('bubble.pageBreak'),
            ICONS.pageBreak,
            () => editor.insertPageBreak(),
            () => ({ disabled: editor.area !== 'body' || editor.inTable }),
          ),
        ]
      : [];

  // --- Review -----------------------------------------------------------------------

  // Tracked changes: on and off, and accepting or rejecting what was tracked. On, the button says so.
  const review = menuButton(
    'review',
    t('review.tools'),
    `${ICONS.review}<span>${t('review')}</span>${ICONS.caret}`,
    () => {
      const panel = el('div', '');
      const entry = (name: string, ...rest: Parameters<typeof item>) => {
        const node = item(...rest);
        node.dataset.name = `review-${name}`;
        return node;
      };
      // Shown without its changes, the document is only to be looked at: nothing to decide until they show again.
      const marked = editor.changesView === 'all';
      const active = marked && !!editor.activeRevision;
      const any = marked && editor.hasRevisions;
      const view = editor.changesView;
      panel.append(
        entry('track', t('review.track'), () => editor.setTrackChanges(!editor.trackChanges), !marked, editor.trackChanges, IS_MAC ? '⌘⇧E' : 'Ctrl+Shift+E'),
        el('div', 'dx-tb-rule'),
        entry('accept', t('review.accept'), () => editor.acceptRevision(), !active),
        entry('reject', t('review.reject'), () => editor.rejectRevision(), !active),
        entry('prev', t('review.prev'), () => editor.goToRevision(-1), !any),
        entry('next', t('review.next'), () => editor.goToRevision(1), !any),
        el('div', 'dx-tb-rule'),
        entry('accept-all', t('review.acceptAll'), () => editor.acceptAllRevisions(), !any),
        entry('reject-all', t('review.rejectAll'), () => editor.rejectAllRevisions(), !any),
        el('div', 'dx-tb-rule'),
        entry('delete-notes', t('note.deleteAll'), () => editor.removeAllNotes(), !editor.notes.length),
        el('div', 'dx-tb-rule'),
        entry('show-all', t('review.showAll'), () => editor.setChangesView('all'), false, view === 'all'),
        entry('show-accepted', t('review.showAccepted'), () => editor.setChangesView('accepted'), false, view === 'accepted'),
        entry('show-original', t('review.showOriginal'), () => editor.setChangesView('original'), false, view === 'original'),
      );
      if (options.forms) {
        const restricted = editor.restricted;
        panel.append(
          el('div', 'dx-tb-rule'),
          entry('editable', t('form.makeMenu'), () => editor.makeEditable(), restricted || editor.area !== 'body'),
          entry('not-editable', t('form.remove'), () => editor.removeEditable(), restricted || editor.activeEditable === undefined),
          entry('restrict', t('form.restrict'), () => editor.setRestricted(!restricted), false, restricted),
        );
      }
      openPopover(review, panel);
    },
    () => ({ on: editor.trackChanges }),
  );
  review.classList.add('dx-tb-text');

  // --- Tables ---------------------------------------------------------------------

  // What is done to a table there is: its rows, its columns and its cells. A new one is in the Insert menu.
  const table = menuButton(
    'table',
    t('toolbar.tableTools'),
    ICONS.table + ICONS.caret,
    () => {
      const panel = el('div', '');
      const inside = editor.inTable;
      panel.append(
        item(t('table.merge'), () => editor.mergeTableCells(), !editor.canMergeCells),
        item(t('table.split'), () => editor.splitTableCell(), !editor.canSplitCell),
        el('div', 'dx-tb-rule'),
        item(t('table.rowAbove'), () => editor.insertTableRow(false), !inside),
        item(t('table.rowBelow'), () => editor.insertTableRow(true), !inside),
        item(t('table.columnLeft'), () => editor.insertTableColumn(false), !inside),
        item(t('table.columnRight'), () => editor.insertTableColumn(true), !inside),
        el('div', 'dx-tb-rule'),
        item(t('table.deleteRow'), () => editor.deleteTableRow(), !inside),
        item(t('table.deleteColumn'), () => editor.deleteTableColumn(), !inside),
        item(t('table.deleteTable'), () => editor.deleteTable(), !inside),
      );
      const cell = editor.activeCellProps();
      if (cell) {
        // For the cells the selection covers: their lines, and the colour behind them.
        const shades = el('div', 'dx-tb-colors');
        for (const color of CELL_SHADES) {
          const choice = el('button', 'dx-tb-color');
          choice.type = 'button';
          choice.dataset.tip = `#${color}`;
          choice.setAttribute('aria-label', `#${color}`);
          choice.style.background = `#${color}`;
          choice.addEventListener(
            'click',
            run(() => editor.setTableCellProps({ shade: color })),
          );
          shades.appendChild(choice);
        }
        /** One of a row of choices for the cells, of which one is on. */
        const choice = (html: string, label: string, on: boolean, onClick: () => void) => {
          const node = el('button', `dx-tb-btn${on ? ' dx-on' : ''}`, html);
          node.type = 'button';
          node.dataset.tip = label;
          node.setAttribute('aria-label', label);
          node.setAttribute('aria-pressed', String(on));
          node.addEventListener('click', run(onClick));
          return node;
        };
        const segments = (...children: HTMLElement[]) => {
          const node = el('div', 'dx-tb-seg');
          node.append(...children);
          return node;
        };
        /** The height of the caret's row, in centimetres: empty for as tall as what it holds, and whether it is exact. */
        const rowHeight = (now: { height: number; exact: boolean }) => {
          const node = el('div', 'dx-tb-seg');
          const input = el('input', 'dx-tb-num');
          input.type = 'number';
          input.min = '0';
          input.step = '0.1';
          input.placeholder = t('table.rowAuto');
          input.value = now.height ? String(Math.round((now.height / PT_PER_CM) * 100) / 100) : '';
          input.setAttribute('aria-label', t('table.rowHeight'));
          const set = (exact: boolean) => {
            const cm = input.valueAsNumber;
            editor.setTableRowHeight(Number.isFinite(cm) && cm > 0 ? cm * PT_PER_CM : 0, exact);
          };
          input.addEventListener('change', () => set(now.exact));
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') run(() => set(now.exact))();
          });
          const unit = el('span', 'dx-tb-unit');
          unit.textContent = 'cm';
          node.append(
            input,
            unit,
            item(t('table.rowExact'), () => set(!now.exact), !now.height, now.exact),
          );
          return node;
        };
        // The line of the borders of the cells, all round: as thick as the one they have, black unless it has a colour.
        const line = (style: BorderStyle): Border => ({ width: style === 'double' ? 0.75 : Math.max(0.5, cell.line?.width ?? 0.5), color: cell.line?.color ?? '000000', style });
        const lineStyle = cell.line?.style ?? (cell.borders ? 'single' : undefined);
        panel.append(
          el('div', 'dx-tb-rule'),
          item(t('table.headerRow'), () => editor.setHeaderRow(!cell.header), false, cell.header),
          head(t('table.rowHeight')),
          rowHeight(cell),
          head(t('table.align')),
          segments(
            choice(ICONS.alignTop, t('table.alignTop'), cell.valign === 'top', () => editor.setTableCellProps({ valign: 'top' })),
            choice(ICONS.alignMiddle, t('table.alignCenter'), cell.valign === 'center', () => editor.setTableCellProps({ valign: 'center' })),
            choice(ICONS.alignBottom, t('table.alignBottom'), cell.valign === 'bottom', () => editor.setTableCellProps({ valign: 'bottom' })),
          ),
          head(t('table.direction')),
          segments(
            choice(ICONS.textLevel, t('table.directionLevel'), cell.direction === 'level', () => editor.setTableCellProps({ direction: 'level' })),
            choice(ICONS.textUp, t('table.directionUp'), cell.direction === 'up', () => editor.setTableCellProps({ direction: 'up' })),
            choice(ICONS.textDown, t('table.directionDown'), cell.direction === 'down', () => editor.setTableCellProps({ direction: 'down' })),
          ),
          el('div', 'dx-tb-rule'),
          item(editor.tableBorders() ? t('table.hideBorders') : t('table.showBorders'), () => editor.setTableBorders(!editor.tableBorders())),
          item(t('table.cellBorders'), () => editor.setTableCellProps({ borders: !cell.borders }), false, cell.borders),
          head(t('table.lineStyle')),
          segments(
            choice(ICONS.lineSingle, t('table.lineSingle'), lineStyle === 'single', () => editor.setTableCellProps({ line: line('single') })),
            choice(ICONS.lineDouble, t('table.lineDouble'), lineStyle === 'double', () => editor.setTableCellProps({ line: line('double') })),
            choice(ICONS.lineDashed, t('table.lineDashed'), lineStyle === 'dashed', () => editor.setTableCellProps({ line: line('dashed') })),
            choice(ICONS.lineDotted, t('table.lineDotted'), lineStyle === 'dotted', () => editor.setTableCellProps({ line: line('dotted') })),
          ),
          head(t('table.shading')),
          shades,
          item(t('table.noShading'), () => editor.setTableCellProps({ shade: '' }), !cell.shade),
        );
      }
      openPopover(table, panel);
    },
    // In a header or a footer the tables that are there can be written in, not made or reshaped.
    () => ({ on: editor.inTable, disabled: !editor.inTable || !editor.canEditTables }),
  );
  // Off, it says what turns it on.
  updates.push(() => (table.dataset.tip = editor.inTable ? t('toolbar.tableTools') : `${t('toolbar.tableTools')} — ${t('toolbar.tableOff')}`));
  section = 'insert';
  if (quick.length) group(...quick);
  group(insert, review, table);

  // --- Page -----------------------------------------------------------------------

  // The header and the footer, and the page number that goes in one of them: where it goes and how it reads.
  // Choosing among the numbers leaves the panel open, so they can be tried in turn.
  const page = menuButton(
    'page',
    t('toolbar.pageTools'),
    ICONS.page + ICONS.caret,
    () => openPopover(page, pagePanel()),
    () => ({ on: editor.area !== 'body' }),
  );
  const pagePanel = (): HTMLElement => {
    const panel = el('div', '');
    panel.style.minWidth = '270px';
    const now = editor.pageNumbering;
    const apply = (next: PageNumbering | undefined) => () => {
      editor.setPageNumbering(next);
      editor.focus();
      popover?.replaceChildren(pagePanel());
    };
    const edit = (label: string, area: 'header' | 'footer') => item(label, () => editor.setArea(editor.area === area ? 'body' : area), false, editor.area === area);
    // A header and a footer for the first page alone: a cover does not show the ones of the pages after it.
    const first = item(t('page.firstDifferent'), () => editor.setFirstPageDifferent(!editor.firstPageDifferent), false, editor.firstPageDifferent);
    first.dataset.name = 'first-page';
    panel.append(edit(t('toolbar.editHeader'), 'header'), edit(t('toolbar.editFooter'), 'footer'), first);
    // A section before the last may show the document's header and footer, or have its own.
    if (editor.sectionIndex < editor.sectionCount - 1) {
      const own = item(
        t('page.ownHeaders'),
        () => {
          editor.setOwnHeaders(!editor.ownHeaders);
          popover?.replaceChildren(pagePanel());
        },
        false,
        editor.ownHeaders,
      );
      own.dataset.name = 'own-headers';
      panel.append(own);
    }
    panel.append(el('div', 'dx-tb-rule'));
    /** One of a row of choices of which a single one is on. */
    const choice = (html: string, label: string, on: boolean, next: PageNumbering | undefined, disabled = false) => {
      const node = el('button', `dx-tb-btn${on ? ' dx-on' : ''}`, html);
      node.type = 'button';
      node.dataset.tip = label;
      node.setAttribute('aria-label', label);
      node.setAttribute('aria-pressed', String(on));
      node.disabled = disabled;
      node.addEventListener('click', apply(next));
      return node;
    };
    const row = (...children: HTMLElement[]) => {
      const node = el('div', 'dx-tb-seg');
      node.append(...children);
      return node;
    };
    // Starting from none, the number goes centred and bare; after that each choice keeps the other two.
    const base: PageNumbering = now ?? { place: 'footer', align: 'center', format: 'number' };
    const total = editor.pageCount;
    const current = editor.currentPage;
    const formats: [PageNumberFormat, string][] = [
      ['number', `${current}`],
      ['numberOfTotal', `${current} / ${total}`],
      ['page', `${t('page.word')} ${current}`],
      ['pageOfTotal', `${t('page.word')} ${current} ${t('page.of')} ${total}`],
    ];
    panel.append(
      head(t('pageNumber.title')),
      row(
        choice(t('pageNumber.none'), t('pageNumber.noneTitle'), !now, undefined),
        choice(t('area.header'), t('pageNumber.inHeader'), now?.place === 'header', { ...base, place: 'header' }),
        choice(t('pageNumber.footer'), t('pageNumber.inFooter'), now?.place === 'footer', { ...base, place: 'footer' }),
      ),
      head(t('pageNumber.position')),
      row(
        choice(ICONS.left, t('pageNumber.left'), now?.align === 'left', { ...base, align: 'left' }, !now),
        choice(ICONS.center, t('pageNumber.center'), now?.align === 'center', { ...base, align: 'center' }, !now),
        choice(ICONS.right, t('pageNumber.right'), now?.align === 'right', { ...base, align: 'right' }, !now),
      ),
      head(t('pageNumber.format')),
    );
    for (const [format, example] of formats) {
      const node = el('button', `dx-tb-item dx-check${now?.format === format ? ' dx-on' : ''}`);
      node.type = 'button';
      node.textContent = example;
      node.disabled = !now;
      node.setAttribute('aria-checked', String(now?.format === format));
      node.addEventListener('click', apply({ ...base, format }));
      panel.appendChild(node);
    }
    if (editor.endnotes.length) panel.append(el('div', 'dx-tb-rule'), ...endnotesPart());
    return panel;
  };
  /** Where the notes at the end go, and how the section the caret is in numbers them: there only when the document has some. */
  const endnotesPart = (): HTMLElement[] => {
    const numbering = editor.noteNumbering('endnote');
    const set = (next: NoteNumbering) => () => {
      editor.setNoteNumbering('endnote', next);
      popover?.replaceChildren(pagePanel());
    };
    const several = editor.sectionCount > 1;
    const out: HTMLElement[] = [head(t('endnotes.title'))];
    if (several) {
      const sections = editor.endnotesAt === 'sections';
      out.push(
        item(
          t('endnotes.inSections'),
          () => {
            editor.setEndnotesAt(sections ? 'document' : 'sections');
            popover?.replaceChildren(pagePanel());
          },
          false,
          sections,
        ),
      );
    }
    const formats: [NoteNumbering['format'], string][] = [
      [undefined, 'i, ii, iii'],
      ['decimal', '1, 2, 3'],
      ['lowerLetter', 'a, b, c'],
      ['upperLetter', 'A, B, C'],
      ['upperRoman', 'I, II, III'],
    ];
    const row = el('div', 'dx-tb-seg');
    for (const [format, example] of formats) {
      const on = numbering?.format === format;
      const node = el('button', `dx-tb-btn${on ? ' dx-on' : ''}`);
      node.type = 'button';
      node.textContent = example.split(',')[0];
      node.dataset.tip = t('endnotes.format', { example });
      node.setAttribute('aria-label', t('endnotes.format', { example }));
      node.setAttribute('aria-pressed', String(on));
      node.addEventListener('click', set({ ...numbering, format }));
      row.appendChild(node);
    }
    out.push(row);
    if (several) out.push(item(t('endnotes.restart'), set({ ...numbering, restart: numbering?.restart ? undefined : 'section' }), false, !!numbering?.restart));
    return out;
  };

  // --- Columns --------------------------------------------------------------------

  // The text in one, two or three columns: the section the caret is in, or the selection on its own.
  const columns = menuButton(
    'columns',
    t('toolbar.columns'),
    ICONS.columns + ICONS.caret,
    () => openPopover(columns, columnsPanel()),
    () => ({ on: editor.columns.count > 1, disabled: editor.area !== 'body' }),
  );
  const columnsPanel = (): HTMLElement => {
    const panel = el('div', '');
    panel.style.minWidth = '260px';
    const now = editor.columns;
    const { width, marginLeft, marginRight } = editor.page;
    const space = 36;
    const room = width - marginLeft - marginRight - space;
    // A narrow column is a third of the text's width, as in Word's columns to one side.
    const narrow = Math.round(room / 3);
    const presets: [string, string, string, Columns][] = [
      ['one', ICONS.colOne, t('columns.one'), { count: 1, space }],
      ['two', ICONS.colTwo, t('columns.two'), { count: 2, space }],
      ['three', ICONS.colThree, t('columns.three'), { count: 3, space }],
      [
        'left',
        ICONS.colLeft,
        t('columns.left'),
        {
          count: 2,
          space,
          widths: [
            { width: narrow, space },
            { width: room - narrow, space: 0 },
          ],
        },
      ],
      [
        'right',
        ICONS.colRight,
        t('columns.right'),
        {
          count: 2,
          space,
          widths: [
            { width: room - narrow, space },
            { width: narrow, space: 0 },
          ],
        },
      ],
    ];
    const kind = (c: Columns) =>
      c.count < 2
        ? 'one'
        : c.widths?.length === 2 && Math.abs(c.widths[0].width - c.widths[1].width) > 1
          ? c.widths[0].width < c.widths[1].width
            ? 'left'
            : 'right'
          : c.count === 2
            ? 'two'
            : c.count === 3
              ? 'three'
              : '';
    const apply = (next: Columns) => () => {
      editor.setColumns(next);
      editor.focus();
      popover?.replaceChildren(columnsPanel());
    };
    const choices = el('div', 'dx-tb-seg');
    for (const [name, icon, label, preset] of presets) {
      const on = kind(now) === name;
      const node = el('button', `dx-tb-btn${on ? ' dx-on' : ''}`, icon);
      node.type = 'button';
      node.dataset.name = `columns-${name}`;
      node.dataset.tip = label;
      node.setAttribute('aria-label', label);
      node.setAttribute('aria-pressed', String(on));
      // A choice of columns keeps the line between them, if they had one.
      node.addEventListener('click', apply(preset.count > 1 ? { ...preset, separator: now.separator } : preset));
      choices.appendChild(node);
    }
    const separator = item(t('columns.separator'), apply({ ...now, separator: !now.separator }), now.count < 2, !!now.separator);
    separator.dataset.name = 'columns-separator';
    const breaks = item(t('columns.break'), () => editor.insertColumnBreak(), editor.inTable, undefined, undefined, ICONS.columnBreak);
    breaks.dataset.name = 'column-break';
    // Whether it is the section or the selection that the columns are set for.
    const hint = el('div', 'dx-tb-hint');
    hint.textContent = editor.collapsed ? t('columns.forSection') : t('columns.forSelection');
    panel.append(head(t('columns.title')), choices, hint, el('div', 'dx-tb-rule'), separator, breaks);
    return panel;
  };
  section = 'page';
  group(page, columns);

  // What does not fit in the bar waits under a button at its end, in the same order, instead of making a second row.
  const tray = el('div', 'dx-tb-tray');
  const closeTray = () => tray.classList.remove('dx-open');
  const more = el('div', 'dx-tb-group');
  more.appendChild(
    menuButton('more', t('toolbar.more'), ICONS.more, () => {
      closePopover();
      tray.classList.toggle('dx-open');
      moreButton.setAttribute('aria-expanded', String(tray.classList.contains('dx-open')));
      // Opened from the keyboard: it goes on into what was under the button.
      if (tray.classList.contains('dx-open') && document.activeElement === moreButton) focusables(tray)[0]?.focus();
    }),
  );
  // Searching is not editing: it goes at the far end of the bar.
  const end = el('div', 'dx-tb-group dx-tb-end');
  if (options.onFind) end.appendChild(button('find', `${t('toolbar.find')} (${MOD}F)`, ICONS.find, options.onFind));
  if (panelAtEnd) {
    const node = panelButton();
    if (node) end.appendChild(node);
  }
  if (layout === 'row') bar.append(more, end, tray);
  else {
    row.append(more, tray);
    top.appendChild(end);
  }
  // The tabs of the kinds of tools, above them: only those of the one chosen are shown.
  let shownTab: Exclude<Section, 'document'> = 'format';
  const tabButtons: HTMLButtonElement[] = [];
  const showTab = (next: Exclude<Section, 'document'>) => {
    shownTab = next;
    for (const button of tabButtons) button.setAttribute('aria-pressed', String(button.dataset.tab === next));
    let first = true;
    for (const one of groups) {
      if (one.section === 'document') continue;
      one.node.hidden = one.section !== next;
      // The first group of a tab has no line before it.
      if (one.sep) one.sep.hidden = one.node.hidden || first;
      if (!one.node.hidden) first = false;
    }
    closePopover();
    fit(true);
  };
  if (layout === 'tabs') {
    const list = el('div', 'dx-tb-tablist');
    list.setAttribute('role', 'group');
    list.setAttribute('aria-label', t('toolbar.tabs'));
    for (const [tab, label] of [
      ['format', t('toolbar.tabFormat')],
      ['insert', t('toolbar.tabInsert')],
      ['page', t('toolbar.tabPage')],
    ] as const) {
      const button = el('button', '');
      button.type = 'button';
      button.dataset.tab = tab;
      button.dataset.name = `tab-${tab}`;
      button.textContent = label;
      button.addEventListener('click', () => showTab(tab));
      list.appendChild(button);
      tabButtons.push(button);
    }
    top.insertBefore(list, end);
  }
  const moreButton = more.querySelector('button')!;

  let fitted = '';
  /** Puts in the bar the groups that fit in it, and the rest under the button. */
  const fit = (force = false) => {
    const key = `${row.clientWidth}|${bar.querySelector('.dx-tb-title')?.textContent ?? ''}|${shownTab}`;
    if (!row.clientWidth || (key === fitted && !force)) return;
    fitted = key;
    for (const { sep, node, section: kind } of groups) {
      // Above the tools, the document's groups stay where they are.
      if (layout !== 'row' && kind === 'document') continue;
      if (sep) row.insertBefore(sep, more);
      row.insertBefore(node, more);
    }
    more.hidden = true;
    const style = getComputedStyle(row);
    const room = row.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const width = (node: HTMLElement) => {
      if (node.hidden) return 0;
      const margins = getComputedStyle(node);
      // The far end is pushed there by a margin that takes whatever room is left: it asks for none.
      return node.offsetWidth + (node === end ? 0 : parseFloat(margins.marginLeft) + parseFloat(margins.marginRight));
    };
    const needed = () =>
      groups.reduce((sum, { sep, node }) => sum + (node.parentElement === row ? width(node) + (sep ? width(sep) : 0) : 0), width(more) + (end.parentElement === row ? width(end) : 0));
    for (let i = groups.length - 1; i >= 0 && needed() > room; i--) {
      const { sep, node, keep } = groups[i];
      if (keep || node.hidden) continue;
      more.hidden = false;
      tray.prepend(node);
      if (sep) tray.prepend(sep);
    }
    if (more.hidden) closeTray();
  };
  const resize = new ResizeObserver(() => fit());
  resize.observe(row);
  if (layout === 'tabs') showTab('format');

  // Clicks on the toolbar must not take the keyboard away from the document; lists need it to open.
  const keepFocus = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest('select')) e.preventDefault();
  };
  const closeOutside = (e: MouseEvent) => {
    if (bar.contains(e.target as Node)) return;
    closePopover();
    closeTray();
  };
  const closeOnEscape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !(popover || tray.classList.contains('dx-open'))) return;
    // From the keyboard in the bar, it goes back to the button the menu came from; else to the document.
    const from = bar.contains(document.activeElement) ? (popover ? popoverFrom : moreButton) : null;
    // One at a time: the menu that is open first, then what it was opened from.
    if (popover) closePopover();
    else {
      closeTray();
      moreButton.setAttribute('aria-expanded', 'false');
    }
    refresh();
    if (from) from.focus();
    else editor.focus();
    e.preventDefault();
    e.stopPropagation();
  };

  // --- Keyboard -----------------------------------------------------------------
  // One stop of Tab for the whole bar; the arrows go along it, as in a toolbar
  // of the system. In a menu, up and down go through what it offers.

  /** What takes the keyboard in `root`, in order: what is hidden or disabled is passed over. */
  function focusables(root: HTMLElement): HTMLElement[] {
    return [...root.querySelectorAll<HTMLElement>('button, select, input, [tabindex="0"]')].filter((node) => !(node as HTMLButtonElement).disabled && node.getClientRects().length > 0);
  }
  /** The controls of the bar in the order the arrows take: what is under the button of the rest comes after it. */
  const controls = () => {
    const all = focusables(bar).filter((node) => !node.closest('.dx-tb-pop, .dx-tb-tip'));
    const inTray = all.filter((node) => tray.contains(node));
    const rest = all.filter((node) => !tray.contains(node));
    const at = rest.indexOf(moreButton);
    return at < 0 ? rest : [...rest.slice(0, at + 1), ...inTray, ...rest.slice(at + 1)];
  };
  /** The control the bar's one stop of Tab goes to. */
  let current: HTMLElement | null = null;
  const rove = () => {
    const list = controls();
    if (!current || !list.includes(current)) current = list[0] ?? null;
    for (const node of focusables(bar)) if (!node.closest('.dx-tb-pop')) node.tabIndex = node === current ? 0 : -1;
  };
  bar.addEventListener('focusin', (e) => {
    const target = e.target as HTMLElement;
    if (controls().includes(target)) {
      current = target;
      rove();
    }
  });
  bar.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (popover?.contains(target)) {
      if (!e.key.startsWith('Arrow')) return;
      // A field of the menu keeps its arrows.
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
      // A grid (the size of a table, a palette of colours) goes by rows and columns; up and down leave it at its edges.
      const grid = target.parentElement?.matches(GRIDS) ? target.parentElement : null;
      if (grid) {
        const cells = focusables(grid);
        const at = cells.indexOf(target);
        const columns = cells.filter((cell) => cell.offsetTop === cells[0].offsetTop).length || 1;
        const to = { ArrowRight: at + 1, ArrowLeft: at - 1, ArrowDown: at + columns, ArrowUp: at - columns }[e.key];
        e.preventDefault();
        if (to !== undefined && to >= 0 && to < cells.length) {
          cells[to].focus();
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return;
      } else if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      // Up and down go through what the menu offers, a grid being one of them.
      const items = focusables(popover).filter((node) => !node.parentElement?.matches(GRIDS) || node === target || node === focusables(node.parentElement)[0]);
      const at = items.indexOf(target);
      items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
      e.preventDefault();
      return;
    }
    const list = controls();
    const at = list.indexOf(target);
    if (at < 0) return;
    let next: HTMLElement | undefined;
    if (e.key === 'ArrowRight') next = list[(at + 1) % list.length];
    else if (e.key === 'ArrowLeft') next = list[(at - 1 + list.length) % list.length];
    else if (e.key === 'Home') next = list[0];
    else if (e.key === 'End') next = list[list.length - 1];
    else if (e.key === 'ArrowDown' && target.getAttribute('aria-haspopup') && target.getAttribute('aria-expanded') !== 'true') {
      // Down on the button of a menu opens it, and goes into it.
      target.click();
      e.preventDefault();
      return;
    } else if (e.key === 'Escape' && !popover && !tray.classList.contains('dx-open')) {
      editor.focus();
      e.preventDefault();
      return;
    }
    if (!next) return;
    next.focus();
    e.preventDefault();
  });
  markRegion(bar, 'toolbar', () => {
    rove();
    return current;
  });
  installRegionKeys();
  bar.addEventListener('mousedown', keepFocus);
  document.addEventListener('mousedown', closeOutside);
  // Before the page's own Escape, which would send the keyboard to the document first.
  document.addEventListener('keydown', closeOnEscape, true);

  const refresh = () => {
    for (const update of updates) update();
    // A name of another length leaves another room for the rest.
    fit();
    rove();
  };
  const unsubscribe = editor.onChange(refresh);
  container.appendChild(bar);
  refresh();

  return {
    refresh,
    destroy() {
      unsubscribe();
      resize.disconnect();
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape, true);
      bar.remove();
    },
  };
}
