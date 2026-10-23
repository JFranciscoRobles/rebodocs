// A panel beside the document with what Word has no one place for: the
// outline of the document, to move about it and reorder its sections, the
// variables of a template, to fill them in, the notes on its text, and, when
// the application keeps them, its versions. It only uses the public methods
// of the editor.

import {
  type ActiveFormat,
  type Block,
  type FormatId,
  type RevisionView,
  type TemplateData,
  flattenValues,
  valueAt,
  NOTE_COLORS,
  defined,
  formatText,
  formatValue,
  isVariableName,
  revisionColor,
} from '@rebodocs/core/internal';
import { recallAuthor, setAuthor } from './author';
import type { Editor } from './editor';
import { type MessageKey, getLocale, plural, t } from './i18n';
import { colorName, installRegionKeys, markRegion } from './a11y';
import { type VersionInfo, type Versions, UNDO_KEY, createVersionView, restoreVersionOf, sortVersions, versionDate, versionName } from './versions';

export type PanelTab = 'outline' | 'variables' | 'notes' | 'changes' | 'history';

export interface Panel {
  /** Shows the panel, on the tab given or the one it was on. */
  show(tab?: PanelTab): void;
  hide(): void;
  toggle(): void;
  /** Asks the application for its versions again, as when it kept another one. */
  refreshVersions(): void;
  destroy(): void;
}

export interface PanelOptions {
  /** The versions of the document, where the application keeps them: with them, the panel has a tab to see, compare and restore them. */
  versions?: Versions;
  /** Told what went wrong, in the language of the interface; the panel says it itself when left out. */
  onError?: (message: string) => void;
  /**
   * Its tabs as a rail of icons beside it, always there, with how many notes
   * and changes there are: one opens the panel on itself, and again closes it.
   */
  rail?: boolean;
}

const STYLE_ID = 'dx-panel-style';

const railIcon = (body: string) =>
  `<svg viewBox="0 0 18 18" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
/** The icon of each tab on the rail. */
const RAIL_ICONS: Record<PanelTab, string> = {
  outline: railIcon('<path d="M3 4.5h12M5.5 9h9.5M8 13.5h7M3 9h.01M3 13.5h.01M5.5 13.5h.01"/>'),
  variables: railIcon('<path d="M6.5 3.5c-1.5 0-2 .8-2 2v2c0 .9-.6 1.5-1.5 1.5.9 0 1.5.6 1.5 1.5v2c0 1.2.5 2 2 2M11.5 3.5c1.5 0 2 .8 2 2v2c0 .9.6 1.5 1.5 1.5-.9 0-1.5.6-1.5 1.5v2c0 1.2-.5 2-2 2"/>'),
  notes: railIcon('<path d="M3.5 4.5h11v8h-6l-3 2.5v-2.5h-2z"/>'),
  changes: railIcon('<path d="M3 13.5V15h1.5l7.4-7.4-1.5-1.5L3 13.5zM12.6 4.4l1.5 1.5 1.2-1.2a1 1 0 0 0 0-1.4l-.1-.1a1 1 0 0 0-1.4 0l-1.2 1.2z"/>'),
  history: railIcon('<path d="M9 5.5V9l2.5 1.5M3 9a6 6 0 1 0 1.8-4.3M3 3.5v3h3"/>'),
};

const CSS = `
.dx-pn{display:none;flex:none;flex-direction:column;width:340px;max-width:45vw;height:100%;box-sizing:border-box;border-right:1px solid var(--dx-ui-line,#e6e3dc);background:var(--dx-ui-bar,#fbfaf8);font:13px system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-ink,#2f2e2b)}
.dx-pn.dx-pn-open{display:flex}
.dx-pn-rail{flex:none;display:flex;flex-direction:column;gap:4px;width:52px;height:100%;box-sizing:border-box;padding:8px 6px;border-right:1px solid var(--dx-ui-line,#e6e3dc);background:var(--dx-ui-bar,#fbfaf8)}
.dx-pn-rail .dx-pn-tab{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:11px;color:var(--dx-ui-muted,#5f5d58)}
.dx-pn-rail .dx-pn-tab:hover{background:var(--dx-ui-hover,#f3f1ec);color:var(--dx-ui-ink,#2f2e2b)}
.dx-pn-rail .dx-pn-tab.dx-on{background:var(--dx-ui-active,#e8f0fd);color:var(--dx-ui-accent,#0b57d0);box-shadow:none}
.dx-pn-rail .dx-pn-tab:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-2px}
.dx-pn-rail .dx-pn-tab b{position:absolute;right:3px;top:3px;min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:8px;background:var(--dx-ui-accent,#0b57d0);color:var(--dx-ui-on-accent,#fff);font:700 10px/16px system-ui,sans-serif}
.dx-pn-rail .dx-pn-tab b:empty{display:none}
.dx-pn-label{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.dx-pn-head{margin:14px 14px 4px;font-weight:700;font-size:15px}
.dx-pn-head:empty{display:none}
.dx-pn-tabs{display:flex;gap:2px;margin:10px 10px 4px;padding:3px;border-radius:12px;background:var(--dx-ui-hover,#f3f1ec)}
.dx-pn-tab{flex:1;min-width:0;height:30px;border:0;border-radius:9px;background:none;color:var(--dx-ui-muted,#5f5d58);font:inherit;cursor:pointer}
.dx-pn-tab.dx-on{background:var(--dx-ui-bg,#fff);color:var(--dx-ui-accent,#0b57d0);font-weight:600;box-shadow:0 1px 3px rgba(47,46,43,.14)}
.dx-pn-body{flex:1;overflow-y:auto;padding:8px}
.dx-pn-empty{padding:12px 8px;color:var(--dx-ui-muted,#5f5d58);line-height:1.45}
.dx-pn-empty code{padding:1px 4px;border-radius:4px;background:var(--dx-ui-line,#e6e3dc);font:12px ui-monospace,Menlo,monospace}
.dx-pn-item{position:relative;display:block;width:100%;padding:7px 9px;border:0;border-radius:9px;background:none;color:inherit;font:inherit;text-align:left;line-height:1.3;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dx-pn-item:hover{background:var(--dx-ui-hover,#f3f1ec)}
.dx-pn-item.dx-on{background:var(--dx-ui-active,#e8f0fd);color:var(--dx-ui-accent,#0b57d0)}
.dx-pn-item.dx-pn-l0{font-weight:600}
.dx-pn-item.dx-pn-drop::before{content:"";position:absolute;left:4px;right:4px;top:0;border-top:2px solid var(--dx-ui-accent,#0b57d0)}
.dx-pn-end{height:28px;border-radius:6px}
.dx-pn-end.dx-pn-drop{box-shadow:inset 0 2px 0 var(--dx-ui-accent,#0b57d0)}
.dx-pn-item:focus-visible,.dx-pn-tab:focus-visible,.dx-pn input:focus-visible,.dx-pn-btn:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-2px}
.dx-pn-row{display:flex;gap:6px;padding:2px 0 8px}
.dx-pn input[type=text]{flex:1;min-width:0;height:32px;padding:0 9px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit}
.dx-pn-btn{flex:none;height:32px;padding:0 12px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit;cursor:pointer;white-space:nowrap}
.dx-pn-btn:hover:not(:disabled){background:var(--dx-ui-hover,#f3f1ec)}
.dx-pn-btn:disabled{opacity:.4;cursor:default}
.dx-pn-btn.dx-pn-main{flex:1;border-color:var(--dx-ui-accent,#0b57d0);background:var(--dx-ui-accent,#0b57d0);color:var(--dx-ui-on-accent,#fff)}
.dx-pn-btn.dx-pn-main:hover:not(:disabled){background:var(--dx-ui-accent-hover,#08398a)}
.dx-pn-intro{padding:2px 4px 8px;color:var(--dx-ui-muted,#5f5d58);font-size:12px;line-height:1.4}
.dx-pn input.dx-pn-search{display:block;width:100%;box-sizing:border-box;margin-bottom:6px}
.dx-pn-group[hidden],.dx-pn-field[hidden],.dx-pn-empty[hidden],.dx-pn-fmt[hidden],.dx-pn-one[hidden]{display:none}
.dx-pn-ghead{display:flex;align-items:center;gap:6px;width:100%;padding:8px 4px 6px;border:0;background:none;color:var(--dx-ui-muted,#5f5d58);font:600 11px system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;text-align:left;cursor:pointer}
.dx-pn-ghead:hover{color:var(--dx-ui-ink,#2f2e2b)}
.dx-pn-ghead svg{flex:none;transition:transform .15s}
.dx-pn-closed .dx-pn-ghead svg{transform:rotate(-90deg)}
.dx-pn-ghead small{margin-left:auto;font-weight:400;letter-spacing:0;text-transform:none;font-variant-numeric:tabular-nums}
.dx-pn-glist{display:flex;flex-direction:column;gap:8px;padding-bottom:6px}
.dx-pn-field{padding:9px 11px 11px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:12px;background:var(--dx-ui-bg,#fff);transition:border-color .15s,background .15s}
.dx-pn-field.dx-on{border-color:var(--dx-ui-active-line,#a8c7fa);background:var(--dx-ui-hover,#f3f1ec)}
.dx-pn-ftop{display:flex;align-items:center;gap:2px;margin-bottom:6px}
.dx-pn-ftop label{flex:1;min-width:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dx-pn-ftop small{flex:none;margin-right:2px;padding:1px 7px;border-radius:999px;background:var(--dx-ui-line,#e6e3dc);color:var(--dx-ui-muted,#5f5d58);font-size:10.5px}
.dx-pn-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:0;border-radius:50%;background:none;color:var(--dx-ui-muted,#5f5d58);cursor:pointer}
.dx-pn-icon:hover{background:var(--dx-ui-hover,#f3f1ec);color:var(--dx-ui-ink,#2f2e2b)}
.dx-pn-icon.dx-on{color:var(--dx-ui-accent,#0b57d0)}
.dx-pn-icon:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-2px}
.dx-pn-frow{display:flex;gap:6px}
.dx-pn-frow .dx-pn-one{width:30px;padding:0;color:var(--dx-ui-accent,#0b57d0);font-weight:700}
.dx-pn-new{display:flex;flex-direction:column;gap:4px;padding-top:8px;border-top:1px solid var(--dx-ui-line,#e6e3dc)}
.dx-pn-foot .dx-pn-new .dx-pn-row{flex-direction:row}
.dx-pn-foot .dx-pn-new .dx-pn-btn{width:auto}
.dx-pn-fmt{display:flex;flex-wrap:wrap;gap:4px;padding-top:6px}
.dx-pn-field>.dx-pn-detail{width:100%;margin-top:6px;height:28px;box-sizing:border-box;padding:0 6px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:6px;background:var(--dx-ui-bg,#fff);color:inherit;font:12px system-ui,sans-serif}
.dx-pn-gstatic{cursor:default}
.dx-pn-fmt .dx-pn-detail{flex:1 0 100%;min-width:0;height:26px;box-sizing:border-box;padding:0 6px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:6px;background:var(--dx-ui-bg,#fff);color:inherit;font:12px system-ui,sans-serif}
.dx-pn-fmt select{flex:1;min-width:0;height:26px;padding:0 2px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:6px;background:var(--dx-ui-bg,#fff);color:inherit;font:12px system-ui,sans-serif}
.dx-pn-field .dx-pn-chip{flex:none;display:inline-flex;justify-content:center;align-items:center;width:26px;height:26px;padding:0;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:6px;background:var(--dx-ui-bg,#fff);font:13px Georgia,serif}
.dx-pn-field .dx-pn-chip.dx-on{border-color:var(--dx-ui-accent,#0b57d0);background:var(--dx-ui-active,#e8f0fd);color:var(--dx-ui-accent,#0b57d0)}
.dx-pn-fnote{margin:-2px 2px 6px;color:var(--dx-ui-muted,#5f5d58);font-size:12px;line-height:1.35;white-space:pre-line;overflow-wrap:anywhere}
.dx-pn-preview{padding:4px 2px 0;color:var(--dx-ui-muted,#5f5d58);font-size:12px;line-height:1.35;overflow-wrap:anywhere}
.dx-pn-preview.dx-pn-bad{color:#b3261e}
.dx-pn-foot{display:flex;flex-direction:column;gap:6px;padding:8px;border-top:1px solid var(--dx-ui-line,#e6e3dc)}
.dx-pn-foot .dx-pn-row{flex-direction:column;padding:0}
.dx-pn-foot .dx-pn-btn{flex:none;width:100%}
.dx-pn-note{color:var(--dx-ui-muted,#5f5d58);font-size:12px;line-height:1.4}
.dx-pn textarea{display:block;width:100%;box-sizing:border-box;min-height:54px;padding:6px 8px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:6px;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit;line-height:1.35;resize:vertical}
.dx-pn textarea:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-2px}
.dx-pn-add{display:flex;flex-direction:column;gap:6px;padding:2px 0 10px}
.dx-pn-card{margin-bottom:8px;padding:8px;border:1px solid var(--dx-ui-line,#e6e3dc);border-left:3px solid #e0a800;border-radius:6px;background:var(--dx-ui-bg,#fff)}
.dx-pn-card.dx-on{background:var(--dx-ui-bar,#fbfaf8);box-shadow:0 0 0 1px var(--dx-ui-active,#e8f0fd)}
.dx-pn-quote{display:block;width:100%;padding:0 0 4px;border:0;background:none;color:var(--dx-ui-muted,#5f5d58);font:italic 12px/1.35 system-ui,sans-serif;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dx-pn-quote:hover{color:var(--dx-ui-accent,#0b57d0)}
.dx-pn-by{display:flex;align-items:center;gap:6px;padding-top:6px;color:var(--dx-ui-muted,#5f5d58);font-size:11px}
.dx-pn-by span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dx-pn-by button{flex:none;height:24px;padding:0 8px;border:0;border-radius:5px;background:none;color:var(--dx-ui-muted,#5f5d58);font:inherit;cursor:pointer}
.dx-pn-by button:hover{background:#fce8e6;color:#b3261e}
.dx-pn-dots{display:flex;align-items:center;gap:6px}
.dx-pn-dot{flex:none;width:18px;height:18px;padding:0;border:2px solid var(--dx-ui-bg,#fff);border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.2);cursor:pointer}
.dx-pn-dot.dx-on{box-shadow:0 0 0 2px var(--dx-ui-ink,#2f2e2b)}
.dx-pn-dot:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:2px}
.dx-pn-label{display:block;color:var(--dx-ui-muted,#5f5d58);font-size:12px}
.dx-pn-label input{display:block;width:100%;height:30px;margin-top:4px;box-sizing:border-box}
.dx-pn-add input[type=text]{flex:none}
.dx-pn-ver{margin-bottom:8px;padding:8px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:6px;background:var(--dx-ui-bg,#fff)}
.dx-pn-ver b{display:block;overflow:hidden;font-weight:600;text-overflow:ellipsis;white-space:nowrap}
.dx-pn-ver small{display:block;padding:2px 0 6px;color:var(--dx-ui-muted,#5f5d58);font-size:11px}
.dx-pn-ver .dx-pn-row{padding:0}
.dx-pn-ver .dx-pn-btn{flex:1}
.dx-pn-msg{padding:6px 8px 10px;color:var(--dx-ui-muted,#5f5d58);font-size:12px;line-height:1.4}
.dx-pn-tabs .dx-pn-tab{padding:0 2px;font-size:12.5px}
.dx-pn-switch{display:flex;align-items:center;gap:8px;padding:4px 2px 10px;cursor:pointer}
.dx-pn-who{display:flex;align-items:center;gap:8px;padding:0 2px 10px}
.dx-pn-who select{flex:1;min-width:0;padding:4px 6px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:6px;background:var(--dx-ui-bg,#fff);font:inherit}
.dx-pn-switch input{margin:0}
.dx-pn-chg{margin-bottom:8px;padding:8px;border:1px solid var(--dx-ui-line,#e6e3dc);border-left:3px solid #888;border-radius:6px;background:var(--dx-ui-bg,#fff)}
.dx-pn-chg.dx-on{background:var(--dx-ui-bar,#fbfaf8);box-shadow:0 0 0 1px var(--dx-ui-active,#e8f0fd)}
.dx-pn-chg .dx-pn-quote{font-style:normal;color:var(--dx-ui-ink,#2f2e2b)}
.dx-pn-chg .dx-pn-quote s{color:#b3261e}
.dx-pn-chg .dx-pn-row{padding:6px 0 0}
.dx-pn-chg .dx-pn-btn{flex:1;height:26px}
.dx-pn-msg.dx-pn-bad{color:#b3261e}
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
  return node;
}

/** How a value is written: one of each list at most. */
const TYPES: [FormatId | '', MessageKey][] = [
  ['', 'type.text'],
  ['date', 'type.date'],
  ['dateLong', 'type.dateLong'],
  ['dateFull', 'type.dateFull'],
  ['number', 'type.number'],
  ['currency', 'type.currency'],
];
/** What each type is shown with, written as the editor will write it: 12/10/2026, October 12, 2026, $1,234.50… */
const SAMPLES: Partial<Record<FormatId, string>> = { date: '2026-10-12', dateLong: '2026-10-12', dateFull: '2026-10-12', number: '1234.5', currency: '1234.5' };
const CASES: [FormatId | '', MessageKey][] = [
  ['', 'case.none'],
  ['upper', 'case.upper'],
  ['lower', 'case.lower'],
  ['capital', 'case.capital'],
];
const MARKS: [FormatId, MessageKey, MessageKey, string][] = [
  ['bold', 'mark.bold.letter', 'mark.bold', 'font-weight:700'],
  ['italic', 'mark.italic.letter', 'mark.italic', 'font-style:italic'],
  ['underline', 'mark.underline.letter', 'mark.underline', 'text-decoration:underline'],
];

/** How many panels were made, so that the ids of each are its own; and the boxes of their variables. */
let panels = 0;
let fields = 0;
/** More variables than this, and there is a box to find one. */
const SEARCH_FROM = 6;

const icon = (body: string, size = 14) =>
  `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON_TARGET = icon('<circle cx="8" cy="8" r="5"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/>');
const ICON_SLIDERS = icon('<path d="M2.5 4.5h5M10.5 4.5h3M2.5 11.5h2M7.5 11.5h6"/><circle cx="9" cy="4.5" r="1.5"/><circle cx="6" cy="11.5" r="1.5"/>');
const ICON_CARET = icon('<path d="m4.5 6 3.5 3.5L11.5 6"/>', 12);

/** Without accents or capitals, to find "Dirección" by "direccion". */
const plain = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** `clienteFechaNacimiento`, `cliente_fecha` or `cliente.fecha` in its words: ["cliente", "fecha", …]. */
const wordsOf = (name: string) =>
  name
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .split(/[\s_.-]+/u)
    .filter(Boolean)
    .map((word) => word.toLowerCase());

/**
 * The variables by the first word of their names, where several share it
 * (cliente…, inmueble…), each with the rest of its name as words to read;
 * the ones that share it with none go last, under "" .
 */
export function groupVariables(names: string[]): [string, { name: string; label: string }[]][] {
  const heads = new Map<string, number>();
  for (const name of names) {
    const [head] = wordsOf(name);
    if (head) heads.set(head, (heads.get(head) ?? 0) + 1);
  }
  const groups = new Map<string, { name: string; label: string }[]>();
  for (const name of names) {
    const words = wordsOf(name);
    const grouped = words.length > 1 && (heads.get(words[0]) ?? 0) > 1;
    const group = grouped ? capital(words[0]) : '';
    const label = capital((grouped ? words.slice(1) : words).join(' ')) || name;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push({ name, label });
  }
  return [...groups].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : 0));
}

export function createPanel(container: HTMLElement, editor: Editor, options: PanelOptions = {}): Panel {
  injectStyle();
  const root = el('div', 'dx-pn');
  const tabs = el('div', 'dx-pn-tabs');
  tabs.setAttribute('role', 'tablist');
  const body = el('div', 'dx-pn-body');
  const foot = el('div', 'dx-pn-foot');
  const head = el('div', 'dx-pn-head');
  const rail = options.rail ? el('div', 'dx-pn-rail') : undefined;
  if (rail) {
    // The tabs are the rail, beside the panel; the panel says above what it shows.
    rail.appendChild(tabs);
    tabs.style.display = 'contents';
    tabs.setAttribute('aria-orientation', 'vertical');
    root.append(head, body, foot);
  } else root.append(tabs, body, foot);
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', t('a11y.panel'));
  body.setAttribute('role', 'tabpanel');
  body.id = `dx-pn-body-${++panels}`;
  // The tabs are one stop of Tab; the arrows go from one to the next, as in a list of tabs of the system.
  tabs.addEventListener('keydown', (e) => {
    const at = tabButtons.indexOf(e.target as HTMLButtonElement);
    if (at < 0) return;
    const to =
      e.key === 'ArrowRight' || (rail && e.key === 'ArrowDown')
        ? at + 1
        : e.key === 'ArrowLeft' || (rail && e.key === 'ArrowUp')
          ? at - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tabButtons.length - 1
              : undefined;
    if (to === undefined) return;
    const next = tabButtons[(to + tabButtons.length) % tabButtons.length];
    // Along the rail the arrows only move: Enter or a click opens.
    if (rail) next.focus();
    else {
      show(next.dataset.name as PanelTab);
      next.focus();
    }
    e.preventDefault();
  });
  markRegion(root, 'panel', () => (isOpen ? tabButtons.find((node) => node.dataset.name === tab) : undefined));
  installRegionKeys();
  let tab: PanelTab = 'outline';
  let isOpen = false;
  /** What was typed for each variable; it outlives the variable, so undoing a fill brings both back. */
  const values = new Map<string, string>();
  /** The data last loaded from a file, lists and all; and the blocks decided here, kept or taken away. */
  let loaded: TemplateData = {};
  const blockChoice = new Map<string, boolean>();

  const { versions } = options;
  const tabButtons = (['outline', 'variables', 'notes', 'changes', ...(versions ? (['history'] as const) : [])] as const).map((name) => {
    const node = el('button', 'dx-pn-tab', rail ? '' : t(`panel.${name}`));
    // On the rail, its icon, its name for a screen reader, and a count of what there is in it.
    if (rail) node.innerHTML = `${RAIL_ICONS[name]}<span class="dx-pn-label"></span><b></b>`;
    node.querySelector('.dx-pn-label')?.append(t(`panel.${name}`));
    node.type = 'button';
    node.dataset.name = name;
    node.id = `dx-pn-tab-${panels}-${name}`;
    node.setAttribute('role', 'tab');
    node.setAttribute('aria-controls', body.id);
    if (rail) node.title = t(`panel.${name}`);
    // On the rail, the tab that is open closes the panel.
    node.addEventListener('click', () => (rail && isOpen && tab === name ? hide() : show(name)));
    tabs.appendChild(node);
    return node;
  });

  // --- Outline --------------------------------------------------------------------

  /** The heading being dragged, as the index of its paragraph. */
  let dragging: number | undefined;
  const clearDrop = () => body.querySelectorAll('.dx-pn-drop').forEach((node) => node.classList.remove('dx-pn-drop'));

  /** What the outline last showed, to leave it alone while it does not change: a drag must not lose its items. */
  let shownOutline = '';
  const renderOutline = () => {
    const items = editor.outline;
    const active = editor.activeHeading;
    const key = JSON.stringify(items);
    if (key === shownOutline) {
      body.querySelectorAll('.dx-pn-item').forEach((node, i) => node.classList.toggle('dx-on', i === active));
      return;
    }
    shownOutline = key;
    body.replaceChildren();
    if (!items.length) {
      const empty = el('div', 'dx-pn-empty');
      empty.innerHTML = t('panel.outlineEmpty');
      body.appendChild(empty);
      return;
    }
    const least = Math.min(...items.map((item) => item.level));
    items.forEach((item, i) => {
      const node = el('button', `dx-pn-item dx-pn-l${item.level}${i === active ? ' dx-on' : ''}`, item.text);
      node.type = 'button';
      node.title = item.text;
      node.style.paddingLeft = `${8 + (item.level - least) * 14}px`;
      node.draggable = true;
      node.addEventListener('click', () => {
        editor.goToHeading(item.para);
        editor.focus();
      });
      node.addEventListener('dragstart', (e) => {
        dragging = item.para;
        e.dataTransfer?.setData('text/plain', item.text);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      // Dropped on a heading, the section goes just above it.
      node.addEventListener('dragover', (e) => {
        if (dragging === undefined) return;
        e.preventDefault();
        clearDrop();
        node.classList.add('dx-pn-drop');
      });
      node.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = dragging;
        dragging = undefined;
        clearDrop();
        if (from !== undefined) editor.moveSection(from, item.para);
      });
      node.addEventListener('dragend', () => {
        dragging = undefined;
        clearDrop();
      });
      body.appendChild(node);
    });
    // Dropped below them all, the section goes to the end of the document.
    const end = el('div', 'dx-pn-end');
    end.addEventListener('dragover', (e) => {
      if (dragging === undefined) return;
      e.preventDefault();
      clearDrop();
      end.classList.add('dx-pn-drop');
    });
    end.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = dragging;
      dragging = undefined;
      clearDrop();
      if (from !== undefined) editor.moveSection(from);
    });
    body.appendChild(end);
  };

  // The table of contents: put in at the caret, or brought up to date when the document has one.
  const toc = el('button', 'dx-pn-btn', '');
  toc.type = 'button';
  toc.dataset.name = 'toc';
  toc.addEventListener('mousedown', (e) => e.preventDefault());
  toc.addEventListener('click', () => {
    if (editor.hasToc) {
      if (!editor.updateToc()) editor.goToToc();
    } else editor.insertToc();
    editor.focus();
  });
  const tocNote = el('div', 'dx-pn-note', t('toc.note'));
  const renderToc = () => {
    const has = editor.hasToc;
    toc.textContent = t(has ? 'toc.update' : 'toc.insertHere');
    toc.disabled = !has && (editor.area !== 'body' || editor.inTable || !editor.outline.some((item) => item.level >= 1));
    tocNote.style.display = has ? '' : 'none';
  };

  // --- Variables ------------------------------------------------------------------
  // For whoever fills a template, not whoever wrote it: each variable by a name
  // that reads (clienteNombre is "Nombre", under "Cliente"), grouped by what the
  // names share, with a box for its value. How the value is written is one
  // press away instead of always in view; Enter fills that one alone.

  const name = el('input', '');
  name.type = 'text';
  name.id = `dx-pn-new-${panels}`;
  name.placeholder = t('var.namePlaceholder');
  name.dataset.name = 'variable-name';
  name.spellcheck = false;
  const insert = el('button', 'dx-pn-btn', t('insert'));
  insert.type = 'button';
  insert.dataset.name = 'variable-insert';
  insert.title = t('var.insertTitle');
  const add = () => {
    if (!isVariableName(name.value.trim())) return;
    editor.insertVariable(name.value);
    name.value = '';
    insert.disabled = true;
    editor.focus();
  };
  insert.addEventListener('mousedown', (e) => e.preventDefault());
  insert.addEventListener('click', add);
  name.addEventListener('input', () => (insert.disabled = !isVariableName(name.value.trim())));
  name.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    // Used up here, or it would go on to the document, which `add` gives the keyboard to.
    e.preventDefault();
    add();
  });
  insert.disabled = true;
  const adder = el('div', 'dx-pn-row');
  adder.append(name, insert);
  const creator = el('div', 'dx-pn-new');
  const nameLabel = el('label', 'dx-pn-label', t('var.newHere'));
  nameLabel.htmlFor = name.id;
  creator.append(nameLabel, adder);

  const fill = el('button', 'dx-pn-btn dx-pn-main', '');
  fill.type = 'button';
  fill.dataset.name = 'variables-fill';
  const filled = () => Object.fromEntries([...values].filter(([key, value]) => value.trim() !== '' && editor.variables.includes(key)));
  /** The blocks given a value: kept or taken away here, or a list from the data loaded. */
  const given = () => editor.blocks.filter((block) => blockChoice.has(block.name) || valueAt(loaded, block.name) !== undefined).map((block) => block.name);
  /** What filling puts in: the data loaded, the blocks decided here, and what was typed in the boxes. */
  const data = (): TemplateData => ({ ...loaded, ...Object.fromEntries(blockChoice), ...filled() });
  const updateFill = () => {
    const n = Object.keys(filled()).length + new Set(given()).size;
    fill.disabled = !n;
    fill.textContent = !n ? t('var.fillNone') : plural('var.fillFields', n, { n });
  };
  fill.addEventListener('click', () => {
    editor.fillVariables(data());
    editor.focus();
  });
  const load = el('button', 'dx-pn-btn', t('var.load'));
  load.type = 'button';
  load.dataset.name = 'variables-load';
  load.title = t('var.loadTitle');
  const picker = el('input', '');
  picker.type = 'file';
  picker.accept = '.json,application/json';
  picker.hidden = true;
  load.addEventListener('click', () => picker.click());
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    picker.value = '';
    if (!file) return;
    try {
      setValues(JSON.parse(await file.text()));
    } catch {
      alert(t('var.badJson'));
    }
  });
  const setValues = (read: unknown) => {
    if (!read || typeof read !== 'object' || Array.isArray(read)) return;
    // Lists stay as they came, for the blocks to repeat; the rest goes in the boxes.
    loaded = read as TemplateData;
    for (const [key, value] of Object.entries(flattenValues(loaded))) values.set(key, value);
    shownVariables = '';
    refresh();
  };
  const actions = el('div', 'dx-pn-row');
  actions.append(fill, load);
  const note = el('div', 'dx-pn-note', t('var.note'));

  const search = el('input', 'dx-pn-search');
  search.type = 'text';
  search.placeholder = t('var.search');
  search.setAttribute('aria-label', t('var.search'));
  search.dataset.name = 'variables-search';
  /** The variables whose formats are in view, and the groups folded away. */
  const opened = new Set<string>();
  const folded = new Set<string>();
  /** What keeps the counts of the groups in step with what is typed. */
  let counters: (() => void)[] = [];
  const noMatch = el('div', 'dx-pn-empty');
  const applySearch = () => {
    const query = plain(search.value.trim());
    let shown = 0;
    for (const group of body.querySelectorAll<HTMLElement>('.dx-pn-group')) {
      let any = false;
      for (const card of group.querySelectorAll<HTMLElement>('.dx-pn-field')) {
        const match = !query || card.dataset.search!.includes(query);
        card.hidden = !match;
        any ||= match;
      }
      group.hidden = !any;
      if (any) shown++;
    }
    noMatch.hidden = shown > 0;
    noMatch.textContent = t('var.noMatch', { query: search.value.trim() });
  };
  search.addEventListener('input', applySearch);

  const iconButton = (name: string, label: string, icon: string, onClick: () => void) => {
    const node = el('button', 'dx-pn-icon');
    node.type = 'button';
    node.innerHTML = icon;
    node.title = label;
    node.dataset.name = name;
    node.setAttribute('aria-label', label);
    node.addEventListener('click', onClick);
    return node;
  };

  /** What the type of a value may say besides: the decimals of a number, the currency of an amount, the pattern of a date. */
  const typeDetail = (variable: string, label: string, active: ActiveFormat[]): HTMLElement | undefined => {
    const format = active.find((one) => one.id === 'number' || one.id === 'currency' || one.id === 'date');
    if (!format) return undefined;
    const set = (arg: string) => arg !== format.arg && editor.setVariableFormat(variable, format.id, true, arg);
    if (format.id === 'number') {
      const select = el('select', 'dx-pn-detail');
      select.dataset.name = 'variable-decimals';
      select.setAttribute('aria-label', t('var.controlOf', { title: t('var.decimals'), name: label }));
      select.add(new Option(t('var.decimalsAuto'), ''));
      for (let n = 0; n <= 4; n++) select.add(new Option(`${t('var.decimals')}: ${n}`, String(n)));
      select.value = /^\d$/.test(format.arg) ? format.arg : '';
      select.addEventListener('change', () => set(select.value));
      return select;
    }
    const currency = format.id === 'currency';
    const input = el('input', 'dx-pn-detail');
    input.type = 'text';
    input.spellcheck = false;
    input.value = format.arg;
    input.dataset.name = currency ? 'variable-currency' : 'variable-pattern';
    input.placeholder = t(currency ? 'var.currencyCode' : 'var.datePattern');
    input.title = t(currency ? 'var.currencyTitle' : 'var.datePatternTitle');
    input.setAttribute('aria-label', t('var.controlOf', { title: input.placeholder, name: label }));
    if (currency) input.maxLength = 3;
    const apply = () => {
      const arg = currency ? input.value.trim().toUpperCase() : input.value.trim();
      // A currency is its code of three letters, or a number of decimals.
      if (currency && arg && !/^([A-Z]{3}|\d)$/.test(arg)) return;
      set(arg);
    };
    input.addEventListener('change', apply);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      apply();
    });
    return input;
  };

  const fieldCard = (variable: string, label: string, group: string) => {
    const card = el('div', 'dx-pn-field');
    card.dataset.variable = variable;
    card.dataset.search = plain(`${group} ${label} ${variable}`);
    const input = el('input', '');
    input.type = 'text';
    input.id = `dx-pn-var-${panels}-${++fields}`;
    input.dataset.variable = variable;
    input.setAttribute('aria-label', t('var.valueOf', { name: label }));
    input.value = values.get(variable) ?? '';
    // How the value is written. It is part of the text of the variable, {{fecha | fecha larga}}, so Word keeps it.
    const active = editor.variableFormats(variable);
    const has = (id: FormatId | '') => active.some((format) => format.id === id);
    const isDate = has('date') || has('dateLong') || has('dateFull');
    const isNumber = has('number') || has('currency');
    input.placeholder = isDate ? t('var.datePlaceholder') : isNumber ? t('var.numberPlaceholder') : t('var.value');
    if (isNumber) input.inputMode = 'decimal';

    const top = el('div', 'dx-pn-ftop');
    const title = el('label', '', label);
    title.htmlFor = input.id;
    title.title = `{{${variable}}}`;
    top.appendChild(title);
    const uses = editor.variableUses(variable);
    if (uses > 1) top.appendChild(el('small', '', plural('var.uses', uses, { n: uses })));
    top.appendChild(iconButton('variable-go', t('var.goTo'), ICON_TARGET, () => editor.selectVariable(variable)));

    // What a note on the variable says: what to fill it with.
    const said = editor.variableNotes(variable).join('\n');
    const note = said ? el('div', 'dx-pn-fnote', '') : undefined;
    if (note) {
      note.textContent = said;
      note.id = `${input.id}-note`;
      input.setAttribute('aria-describedby', note.id);
    }

    const formats = el('div', 'dx-pn-fmt');
    formats.hidden = !opened.has(variable);
    const gear = iconButton('variable-formats', t('var.formats'), ICON_SLIDERS, () => {
      formats.hidden = !formats.hidden;
      if (formats.hidden) opened.delete(variable);
      else opened.add(variable);
      gear.setAttribute('aria-expanded', String(!formats.hidden));
    });
    gear.setAttribute('aria-expanded', String(!formats.hidden));
    // A variable written some way of its own says so before it is opened.
    gear.classList.toggle('dx-on', active.length > 0);
    top.appendChild(gear);

    const choice = (options: [FormatId | '', MessageKey][], title: string) => {
      const select = el('select', '');
      select.title = title;
      select.setAttribute('aria-label', t('var.controlOf', { title, name: label }));
      for (const [id, text] of options) {
        const sample = id && SAMPLES[id];
        select.add(new Option(sample ? `${t(text)} (${formatValue(sample, [formatText(id)], { locale: editor.formatLocale }).text})` : t(text), id));
      }
      const current = options.find(([id]) => id && has(id))?.[0] ?? '';
      select.value = current;
      select.addEventListener('change', () => {
        const next = select.value as FormatId | '';
        if (next) editor.setVariableFormat(variable, next, true);
        else if (current) editor.setVariableFormat(variable, current, false);
      });
      return select;
    };
    const type = choice(TYPES, t('var.type'));
    type.dataset.name = 'variable-type';
    const letters = choice(CASES, t('var.case'));
    letters.dataset.name = 'variable-case';
    letters.style.flex = '0 0 96px';
    formats.append(type, letters);
    for (const [id, text, title, css] of MARKS) {
      const chip = el('button', `dx-pn-chip${has(id) ? ' dx-on' : ''}`, t(text));
      chip.type = 'button';
      chip.title = t(title);
      chip.dataset.name = `variable-${id}`;
      chip.style.cssText = css;
      chip.setAttribute('aria-pressed', String(has(id)));
      chip.addEventListener('click', () => editor.setVariableFormat(variable, id, !has(id)));
      formats.appendChild(chip);
    }
    const detail = typeDetail(variable, label, active);
    if (detail) formats.appendChild(detail);

    // Filling this one alone: the button, or Enter in its box.
    const fillOne = () => {
      const value = input.value.trim();
      if (!value) return;
      editor.fillVariables({ [variable]: value });
      editor.focus();
    };
    const one = el('button', 'dx-pn-btn dx-pn-one', '✓');
    one.type = 'button';
    one.title = t('var.fillOne');
    one.dataset.name = 'variable-fill';
    one.setAttribute('aria-label', t('var.fillOne'));
    one.addEventListener('click', fillOne);
    const row = el('div', 'dx-pn-frow');
    row.append(input, one);

    // What the value will come out as, or why it cannot.
    const preview = el('div', 'dx-pn-preview');
    const showPreview = () => {
      one.hidden = !input.value.trim();
      const written = active.map((format) => formatText(format.id, format.arg));
      const { text, problems } = formatValue(input.value, written, { locale: editor.formatLocale });
      const bad = input.value !== '' && problems.length > 0;
      preview.classList.toggle('dx-pn-bad', bad);
      preview.textContent = bad ? (isNumber ? t('var.notNumber') : t('var.notDate')) : input.value !== '' && text !== input.value ? `→ ${text}` : '';
    };
    input.addEventListener('input', () => {
      values.set(variable, input.value);
      updateFill();
      showPreview();
      for (const count of counters) count();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      fillOne();
    });
    showPreview();
    card.append(top, ...(note ? [note] : []), row, formats, preview);
    return card;
  };

  /** The blocks, each by its name: kept or taken away, or repeated for each item of a list in the data loaded. */
  const blockSection = (blocks: Block[]) => {
    const section = el('section', 'dx-pn-group');
    section.appendChild(el('div', 'dx-pn-ghead dx-pn-gstatic', t('var.blocks')));
    const list = el('div', 'dx-pn-glist');
    for (const name of [...new Set(blocks.map((block) => block.name))]) {
      const own = blocks.filter((block) => block.name === name);
      const card = el('div', 'dx-pn-field');
      card.dataset.block = name;
      card.dataset.search = plain(name);
      const top = el('div', 'dx-pn-ftop');
      top.appendChild(el('label', '', name));
      card.appendChild(top);
      const kind = own[0].kind === 'row' ? 'var.blockRow' : own[0].kind === 'text' ? 'var.blockText' : 'var.blockParagraphs';
      card.appendChild(el('div', 'dx-pn-note', own.every((block) => block.inverted) ? `${t(kind)} · ${t('var.blockInverted')}` : t(kind)));
      const select = el('select', 'dx-pn-detail');
      select.dataset.name = 'block-choice';
      select.setAttribute('aria-label', t('var.valueOf', { name }));
      const listed = valueAt(loaded, name);
      if (Array.isArray(listed)) select.add(new Option(plural('var.blockList', listed.length, { n: listed.length }), 'list'));
      select.add(new Option(t('var.blockUnset'), ''));
      select.add(new Option(t('var.blockYes'), 'yes'));
      select.add(new Option(t('var.blockNo'), 'no'));
      select.value = blockChoice.has(name) ? (blockChoice.get(name) ? 'yes' : 'no') : Array.isArray(listed) ? 'list' : '';
      select.addEventListener('change', () => {
        if (select.value === 'yes' || select.value === 'no') blockChoice.set(name, select.value === 'yes');
        else blockChoice.delete(name);
        updateFill();
      });
      card.appendChild(select);
      list.appendChild(card);
    }
    section.appendChild(list);
    section.appendChild(el('div', 'dx-pn-note', t('var.blockHint')));
    return section;
  };

  let shownVariables = '';
  const renderVariables = () => {
    const names = editor.variables;
    const blocks = editor.blocks;
    updateFill();
    const key = JSON.stringify([names.map((variable) => [variable, editor.variableFormats(variable), editor.variableUses(variable), editor.variableNotes(variable)]), blocks]);
    if (key !== shownVariables || !body.firstChild) {
      shownVariables = key;
      // The box being typed in is made again: the keyboard comes back to the same variable's.
      const typing = (document.activeElement as HTMLElement | null)?.dataset?.variable;
      counters = [];
      body.replaceChildren();
      if (!names.length && !blocks.length) {
        const empty = el('div', 'dx-pn-empty');
        empty.innerHTML = t('panel.variablesEmpty');
        body.appendChild(empty);
      } else {
        body.appendChild(el('div', 'dx-pn-intro', t('var.intro')));
        if (names.length > SEARCH_FROM) body.appendChild(search);
        for (const [group, members] of groupVariables(names)) {
          const heading = group || t('var.other');
          const section = el('section', 'dx-pn-group');
          const head = el('button', 'dx-pn-ghead');
          head.type = 'button';
          head.innerHTML = ICON_CARET;
          head.append(heading);
          const count = head.appendChild(el('small', ''));
          const list = el('div', 'dx-pn-glist');
          const fold = (closed: boolean) => {
            list.hidden = closed;
            section.classList.toggle('dx-pn-closed', closed);
            head.setAttribute('aria-expanded', String(!closed));
          };
          fold(folded.has(heading));
          head.addEventListener('click', () => {
            if (folded.has(heading)) folded.delete(heading);
            else folded.add(heading);
            fold(folded.has(heading));
          });
          const update = () => (count.textContent = `${members.filter(({ name: variable }) => values.get(variable)?.trim()).length}/${members.length}`);
          counters.push(update);
          update();
          for (const { name: variable, label } of members) list.appendChild(fieldCard(variable, label, heading));
          section.append(head, list);
          body.appendChild(section);
        }
        if (blocks.length) body.appendChild(blockSection(blocks));
        body.appendChild(noMatch);
        applySearch();
      }
      if (typing) body.querySelector<HTMLInputElement>(`input[data-variable="${window.CSS.escape(typing)}"]`)?.focus();
    }
    // The one the caret is on, as it moves.
    const current = editor.activeVariable;
    for (const card of body.querySelectorAll<HTMLElement>('.dx-pn-field')) card.classList.toggle('dx-on', card.dataset.variable === current);
  };

  // --- Notes ----------------------------------------------------------------------

  recallAuthor(editor);
  const noteText = el('textarea', '');
  noteText.placeholder = t('note.placeholder');
  noteText.dataset.name = 'note-text';
  noteText.setAttribute('aria-label', t('note.placeholder'));
  const noteAdd = el('button', 'dx-pn-btn dx-pn-main', t('note.add'));
  noteAdd.type = 'button';
  noteAdd.dataset.name = 'note-add';
  noteAdd.title = t('note.addTitle');
  noteAdd.style.flex = 'none';
  noteAdd.disabled = true;
  noteText.addEventListener('input', () => (noteAdd.disabled = !noteText.value.trim()));
  noteAdd.addEventListener('click', () => {
    if (editor.addNote(noteText.value) === undefined) return;
    noteText.value = '';
    noteAdd.disabled = true;
    editor.focus();
  });
  /** A row of the colours a note can have; `pick` is told the one pressed. */
  const dots = (current: () => string, pick: (color: string) => void) => {
    const row = el('div', 'dx-pn-dots');
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', t('note.color'));
    const mark = () =>
      row.querySelectorAll<HTMLElement>('.dx-pn-dot').forEach((dot) => {
        const on = dot.dataset.color === current();
        dot.classList.toggle('dx-on', on);
        dot.setAttribute('aria-checked', String(on));
      });
    for (const color of NOTE_COLORS) {
      const dot = el('button', 'dx-pn-dot');
      dot.type = 'button';
      dot.dataset.color = color;
      dot.title = colorName(color);
      dot.setAttribute('aria-label', colorName(color));
      dot.setAttribute('role', 'radio');
      dot.style.background = `#${color}`;
      dot.addEventListener('click', () => {
        pick(color);
        mark();
      });
      row.appendChild(dot);
    }
    mark();
    return row;
  };
  const noteAdder = el('div', 'dx-pn-add');
  const nextColor = dots(
    () => editor.noteColor,
    (color) => (editor.noteColor = color),
  );
  nextColor.dataset.name = 'note-color';
  noteAdder.append(noteText, nextColor, noteAdd);

  const author = el('input', '');
  author.type = 'text';
  author.dataset.name = 'note-author';
  author.value = editor.author;
  author.addEventListener('input', () => setAuthor(editor, author.value));
  const authorLabel = el('label', 'dx-pn-label', t('note.author'));
  authorLabel.title = t('note.authorTitle');
  authorLabel.appendChild(author);

  const day = (date: string | undefined) => {
    const when = date ? new Date(date) : undefined;
    return when && !Number.isNaN(when.getTime()) ? when.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  };

  let shownNotes = '';
  const renderNotes = () => {
    const notes = editor.notes;
    const active = editor.activeNote;
    const key = JSON.stringify(notes);
    if (key === shownNotes && body.firstChild) {
      body.querySelectorAll<HTMLElement>('.dx-pn-card').forEach((node) => node.classList.toggle('dx-on', node.dataset.note === active));
      return;
    }
    shownNotes = key;
    body.replaceChildren(noteAdder);
    if (!notes.length) {
      const empty = el('div', 'dx-pn-empty');
      empty.innerHTML = t('note.empty');
      body.appendChild(empty);
      return;
    }
    for (const note of notes) {
      const card = el('div', `dx-pn-card${note.id === active ? ' dx-on' : ''}`);
      card.dataset.note = note.id;
      card.style.borderLeftColor = `#${note.color}`;
      const quote = el('button', 'dx-pn-quote', `«${note.excerpt}»`);
      quote.type = 'button';
      quote.title = t('note.goTo');
      quote.addEventListener('click', () => {
        editor.selectNote(note.id);
        editor.focus();
      });
      const text = el('textarea', '');
      text.value = note.text;
      text.setAttribute('aria-label', t('note.textOf'));
      // Taken when the field is left; emptied, it goes back to what it said.
      text.addEventListener('change', () => {
        if (text.value.trim()) editor.setNoteText(note.id, text.value);
        else text.value = note.text;
      });
      const by = el('div', 'dx-pn-by');
      const remove = el('button', '', t('note.delete'));
      remove.type = 'button';
      remove.addEventListener('click', () => {
        editor.removeNote(note.id);
        editor.focus();
      });
      by.append(el('span', '', [note.author, day(note.date)].filter(Boolean).join(' · ')), remove);
      const colors = dots(
        () => note.color,
        (color) => editor.setNoteColor(note.id, color),
      );
      colors.style.paddingTop = '6px';
      card.append(quote, text, colors, by);
      body.appendChild(card);
    }
  };

  // --- Tracked changes ---------------------------------------------------------------

  const trackLabel = el('label', 'dx-pn-switch');
  const track = el('input', '');
  track.type = 'checkbox';
  track.dataset.name = 'changes-track';
  track.addEventListener('change', () => editor.setTrackChanges(track.checked));
  trackLabel.append(track, t('review.track'));
  const acceptAll = el('button', 'dx-pn-btn', t('review.acceptAll'));
  acceptAll.type = 'button';
  acceptAll.dataset.name = 'changes-accept-all';
  acceptAll.addEventListener('click', () => {
    editor.acceptAllRevisions(who || undefined);
    editor.focus();
  });
  const rejectAll = el('button', 'dx-pn-btn', t('review.rejectAll'));
  rejectAll.type = 'button';
  rejectAll.dataset.name = 'changes-reject-all';
  rejectAll.addEventListener('click', () => {
    editor.rejectAllRevisions(who || undefined);
    editor.focus();
  });
  const allRow = el('div', 'dx-pn-row');
  allRow.append(acceptAll, rejectAll);
  // Whose changes are listed, and accepted or rejected all at once: everyone's, or one person's.
  let who = '';
  const whoLabel = el('label', 'dx-pn-who');
  const whoSelect = el('select', '');
  whoSelect.dataset.name = 'changes-author';
  whoSelect.addEventListener('change', () => {
    who = whoSelect.value;
    shownChanges = '';
    renderChanges();
  });
  whoLabel.append(t('changes.by'), whoSelect);

  const where = (r: RevisionView) => {
    if (!r.part) return '';
    if (r.part.startsWith('footnote:')) return t('area.footnote');
    if (r.part.startsWith('endnote:')) return t('area.endnote');
    return t(r.part.startsWith('header') || r.part.startsWith('firstHeader') ? 'area.header' : 'area.footer');
  };
  /** The names of what a change of formatting changes, as the toolbar calls them. */
  const FORMAT_NAMES: Record<string, MessageKey> = {
    bold: 'mark.bold',
    italic: 'mark.italic',
    underline: 'mark.underline',
    strike: 'mark.strike',
    fontSize: 'toolbar.fontSize',
    fontFamily: 'toolbar.font',
    color: 'toolbar.color',
    highlight: 'toolbar.highlight',
    align: 'toolbar.align',
    styleId: 'toolbar.style',
    numId: 'changes.list',
    listLevel: 'changes.list',
    spacingBefore: 'changes.spacing',
    spacingAfter: 'changes.spacing',
    lineHeight: 'changes.spacing',
    indentLeft: 'changes.indent',
    indentRight: 'changes.indent',
    indentFirstLine: 'changes.indent',
  };
  const sameRevision = (a: RevisionView | undefined, b: RevisionView) =>
    !!a && a.part === b.part && a.type === b.type && a.author === b.author && a.range.from.para === b.range.from.para && a.range.from.offset === b.range.from.offset;
  let shownChanges = '';
  const renderChanges = () => {
    track.checked = editor.trackChanges;
    const every = editor.revisions;
    const authors = [...new Set(every.map((r) => r.author))].sort((a, b) => a.localeCompare(b));
    if (who && !authors.includes(who)) who = '';
    const list = who ? every.filter((r) => r.author === who) : every;
    // Shown without its changes, the document is only to be looked at: nothing to decide until they show again.
    const marked = editor.changesView === 'all';
    acceptAll.disabled = rejectAll.disabled = !list.length || !marked;
    track.disabled = !marked;
    acceptAll.textContent = who ? t('changes.acceptBy', { author: who }) : t('review.acceptAll');
    rejectAll.textContent = who ? t('changes.rejectBy', { author: who }) : t('review.rejectAll');
    const active = editor.activeRevision;
    const key = JSON.stringify([who, marked, list]);
    if (key === shownChanges && body.firstChild) {
      body.querySelectorAll<HTMLElement>('.dx-pn-chg').forEach((node, i) => node.classList.toggle('dx-on', sameRevision(active, list[i])));
      return;
    }
    shownChanges = key;
    body.replaceChildren(trackLabel);
    // The filter, once there is more than one person to choose.
    if (authors.length > 1) {
      whoSelect.replaceChildren(new Option(t('changes.everyone'), ''), ...authors.map((name) => new Option(name || t('note.anonymous'), name)));
      whoSelect.value = who;
      body.appendChild(whoLabel);
    }
    if (!list.length) {
      const empty = el('div', 'dx-pn-empty');
      empty.innerHTML = t('changes.empty');
      body.appendChild(empty);
      return;
    }
    for (const r of list) {
      const card = el('div', `dx-pn-chg${sameRevision(active, r) ? ' dx-on' : ''}`);
      card.style.borderLeftColor = `#${revisionColor(r.author)}`;
      const text = r.text
        .replace(/[\u2060\uFFFC]/g, '')
        .replace(/¶$/, '')
        .trim();
      const quote = el('button', 'dx-pn-quote');
      quote.type = 'button';
      quote.title = t('changes.goTo');
      const what = el(r.type === 'delete' ? 's' : 'span', '', text ? `«${text.length > 80 ? `${text.slice(0, 80)}…` : text}»` : t('changes.paragraph'));
      const label: MessageKey =
        r.type === 'format'
          ? 'changes.formatted'
          : r.row
            ? r.type === 'insert'
              ? 'changes.rowInserted'
              : 'changes.rowDeleted'
            : r.move
              ? r.type === 'insert'
                ? 'changes.movedTo'
                : 'changes.movedFrom'
              : r.type === 'insert'
                ? 'changes.inserted'
                : 'changes.deleted';
      quote.append(`${t(label)} `, what);
      // What a change of formatting changed: bold, the font, the alignment...
      if (r.format?.length) quote.append(`: ${[...new Set(r.format.map((key) => t(FORMAT_NAMES[key] ?? 'changes.layout')))].join(', ')}`);
      quote.addEventListener('click', () => {
        editor.selectRevision(r);
        editor.focus();
      });
      const by = el('div', 'dx-pn-by');
      by.appendChild(el('span', '', [r.author, day(r.date), where(r)].filter(Boolean).join(' · ')));
      const row = el('div', 'dx-pn-row');
      const decide = (accept: boolean) => {
        if (accept) editor.acceptRevision(r);
        else editor.rejectRevision(r);
        editor.focus();
      };
      const yes = el('button', 'dx-pn-btn', t('changes.accept'));
      yes.type = 'button';
      yes.dataset.name = 'change-accept';
      yes.addEventListener('click', () => decide(true));
      yes.disabled = !marked;
      const no = el('button', 'dx-pn-btn', t('changes.reject'));
      no.type = 'button';
      no.dataset.name = 'change-reject';
      no.addEventListener('click', () => decide(false));
      no.disabled = !marked;
      row.append(yes, no);
      card.append(quote, by, row);
      body.appendChild(card);
    }
  };

  // --- Versions -------------------------------------------------------------------

  /** What the list of versions says, below what keeps a new one. */
  const message = el('div', 'dx-pn-msg');
  message.setAttribute('aria-live', 'polite');
  const say = (text: string, bad = false) => {
    message.textContent = text;
    message.classList.toggle('dx-pn-bad', bad);
  };
  const fail = (text: string) => {
    if (options.onError) options.onError(text);
    else say(text, true);
  };
  const view = versions && createVersionView(editor, versions, { onError: fail, onRestore: () => say(t('history.restored', { undo: UNDO_KEY })) });
  const label = el('input', '');
  label.type = 'text';
  label.placeholder = t('history.label');
  label.dataset.name = 'version-label';
  label.setAttribute('aria-label', t('history.label'));
  const keep = el('button', 'dx-pn-btn dx-pn-main', t('history.save'));
  keep.type = 'button';
  keep.dataset.name = 'version-save';
  keep.title = t('history.saveTitle');
  keep.style.flex = 'none';
  const keeper = el('div', 'dx-pn-add');
  keeper.append(label, keep);
  const saveVersion = async () => {
    if (!versions?.save) return;
    keep.disabled = true;
    try {
      await versions.save(editor.exportDocx(), defined({ label: label.value.trim() || undefined, author: editor.author || undefined }));
      label.value = '';
      say('');
      refreshVersions();
    } catch (error) {
      fail(t('history.saveFailed', { error: (error as Error).message }));
    } finally {
      keep.disabled = false;
    }
  };
  keep.addEventListener('click', () => void saveVersion());
  label.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void saveVersion();
  });

  /** The versions as last listed; undefined while they are asked for. */
  let listed: VersionInfo[] | undefined;
  let listing = 0;
  const refreshVersions = () => {
    if (!versions) return;
    const mine = ++listing;
    listed = undefined;
    if (isOpen && tab === 'history') renderHistory();
    versions.list().then(
      (list) => {
        if (mine !== listing) return;
        listed = sortVersions(list);
        if (isOpen && tab === 'history') renderHistory();
      },
      (error: Error) => {
        if (mine !== listing) return;
        listed = [];
        fail(t('history.failed', { error: error.message }));
        if (isOpen && tab === 'history') renderHistory();
      },
    );
  };
  const renderHistory = () => {
    body.replaceChildren(...(versions?.save ? [keeper] : []), message);
    if (!listed) {
      body.appendChild(el('div', 'dx-pn-empty', t('history.loading')));
      return;
    }
    if (!listed.length) {
      body.appendChild(el('div', 'dx-pn-empty', t(versions?.save ? 'history.empty' : 'history.none')));
      return;
    }
    for (const info of listed) {
      const card = el('div', 'dx-pn-ver');
      card.dataset.version = info.id;
      const name = el('b', '', versionName(info));
      name.title = name.textContent!;
      const meta = el('small', '', [info.label ? versionDate(info) : '', info.author].filter(Boolean).join(' · '));
      const row = el('div', 'dx-pn-row');
      const compare = el('button', 'dx-pn-btn', t('history.compare'));
      compare.type = 'button';
      compare.dataset.name = 'version-compare';
      compare.title = t('history.compareTitle');
      compare.addEventListener('click', () => void view?.show(info));
      const back = el('button', 'dx-pn-btn', t('history.restore'));
      back.type = 'button';
      back.dataset.name = 'version-restore';
      back.title = t('history.restoreTitle');
      back.addEventListener('click', async () => {
        try {
          view?.close();
          await restoreVersionOf(editor, versions!, info);
          say(t('history.restored', { undo: UNDO_KEY }));
          editor.focus();
        } catch (error) {
          fail(t('history.openFailed', { error: (error as Error).message }));
        }
      });
      row.append(compare, back);
      card.append(name, ...(meta.textContent ? [meta] : []), row);
      body.appendChild(card);
    }
  };

  // --- The panel ------------------------------------------------------------------

  /** The tab the foot of the panel was last filled for. */
  let footFor: PanelTab | undefined;
  /** The rail: which one is open, and how many notes and changes there are, said on their icons. */
  const refreshRail = () => {
    if (!rail) return;
    const counts: Partial<Record<PanelTab, number>> = { notes: editor.notes.length, changes: editor.revisions.length };
    tabButtons.forEach((node) => {
      const name = node.dataset.name as PanelTab;
      const on = isOpen && name === tab;
      node.classList.toggle('dx-on', on);
      node.setAttribute('aria-selected', String(on));
      node.tabIndex = name === tab ? 0 : -1;
      const n = counts[name] ?? 0;
      const badge = node.querySelector('b')!;
      const text = n ? String(n > 99 ? '99+' : n) : '';
      if (badge.textContent !== text) badge.textContent = text;
      node.setAttribute('aria-label', n ? `${t(`panel.${name}`)} (${n})` : t(`panel.${name}`));
    });
  };
  const refresh = () => {
    refreshRail();
    if (!isOpen) return;
    head.textContent = rail ? t(`panel.${tab}`) : '';
    tabButtons.forEach((node) => {
      const on = node.dataset.name === tab;
      node.classList.toggle('dx-on', on);
      node.setAttribute('aria-selected', String(on));
      node.tabIndex = on ? 0 : -1;
    });
    body.setAttribute('aria-labelledby', tabButtons.find((node) => node.dataset.name === tab)?.id ?? '');
    // The name may have been given elsewhere, where a note was made.
    if (document.activeElement !== author) author.value = editor.author;
    nextColor.querySelectorAll<HTMLElement>('.dx-pn-dot').forEach((dot) => dot.classList.toggle('dx-on', dot.dataset.color === editor.noteColor));
    if (footFor !== tab) {
      footFor = tab;
      foot.replaceChildren(...(tab === 'variables' ? [actions, picker, note, creator] : tab === 'notes' ? [authorLabel] : tab === 'changes' ? [allRow] : tab === 'history' ? [] : [toc, tocNote]));
      foot.hidden = tab === 'history';
    }
    if (tab === 'outline') {
      renderOutline();
      renderToc();
    } else if (tab === 'variables') renderVariables();
    else if (tab === 'notes') renderNotes();
    else if (tab === 'changes') renderChanges();
  };
  function show(next: PanelTab = tab): void {
    // Without versions there is no tab for them.
    if (next === 'history' && !versions) next = tab;
    if (next !== tab) {
      shownOutline = '';
      shownVariables = '';
      shownNotes = '';
      shownChanges = '';
      body.replaceChildren();
    }
    const entering = next === 'history' && (tab !== 'history' || !isOpen);
    tab = next;
    isOpen = true;
    root.classList.add('dx-pn-open');
    refresh();
    // The versions are asked for each time their tab is opened: the application may have kept more.
    if (entering) refreshVersions();
  }
  const hide = () => {
    isOpen = false;
    root.classList.remove('dx-pn-open');
    refreshRail();
    editor.focus();
  };

  const unsubscribe = editor.onChange(refresh);
  if (rail) container.appendChild(rail);
  container.appendChild(root);
  refreshRail();

  return {
    show,
    hide,
    toggle: () => (isOpen ? hide() : show()),
    refreshVersions,
    destroy() {
      unsubscribe();
      view?.destroy();
      root.remove();
      rail?.remove();
    },
  };
}
