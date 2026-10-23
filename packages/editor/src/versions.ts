// The versions of the document, as the application keeps them: where it
// keeps them, and who may see them, is its own business, and this only asks
// for them. A version can be compared with the document as it is now, or
// with another version, over the document: the later one with what was taken
// out struck through and what was put in underlined, from one change to the
// next; and the document can be taken back to it, as a step to undo.

import { type Comparison, type Doc, compareDocs, importDocx } from '@rebodocs/core/internal';
import { holdFocus } from './a11y';
import { Editor } from './editor';
import { getLocale, plural, t } from './i18n';
import { IS_MAC } from './platform';
import { applyTheme } from './theme';

/** A version of the document, as the application lists it. */
export interface VersionInfo {
  /** What the application knows it by, to give it back with `load`. */
  id: string;
  /** When it was kept, as an ISO date. */
  date?: string;
  /** Who kept it. */
  author?: string;
  /** What it was called, when it was given a name. */
  label?: string;
}

/** Where the versions of the document are: the application's. */
export interface Versions {
  /** The versions there are, in any order: they are shown the newest first. */
  list(): Promise<VersionInfo[]>;
  /** One of them, as a DOCX. */
  load(id: string): Promise<Uint8Array | ArrayBuffer>;
  /**
   * Keeps the document as it is now as a version, with the name the person
   * gave it, if any. Without it, there is no button to do so: the
   * application keeps them when it wants, as each time the document is saved.
   */
  save?(docx: Uint8Array, info: { label?: string; author?: string }): Promise<unknown>;
}

/** The comparison over the document. */
export interface VersionView {
  /** Shows what changed from version `from` to version `to`, or to the document as it is now without it. */
  show(from: VersionInfo, to?: VersionInfo): Promise<void>;
  close(): void;
  readonly isOpen: boolean;
  destroy(): void;
}

export interface VersionViewOptions {
  /** Told when a version was put in place of the document. */
  onRestore?: (version: VersionInfo) => void;
  /** Told what went wrong, in the language of the interface. */
  onError?: (message: string) => void;
}

/** When a version was kept, as the person reads a date and a time. */
export function versionDate(info: VersionInfo): string {
  const when = info.date ? new Date(info.date) : undefined;
  if (!when || Number.isNaN(when.getTime())) return '';
  return when.toLocaleString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** What a version is called in a list: its name, or when it was kept. */
export function versionName(info: VersionInfo): string {
  return info.label || versionDate(info) || t('history.untitled');
}

/** The newest first; those without a date last, as they came. */
export function sortVersions(list: VersionInfo[]): VersionInfo[] {
  const time = (info: VersionInfo) => {
    const at = info.date ? Date.parse(info.date) : NaN;
    return Number.isNaN(at) ? -Infinity : at;
  };
  return list
    .map((info, i) => ({ info, i }))
    .sort((a, b) => time(b.info) - time(a.info) || a.i - b.i)
    .map(({ info }) => info);
}

/** The versions read so far, by their id: a version does not change once kept. */
const read = new WeakMap<Versions, Map<string, Promise<Doc>>>();

/** A version of the document, read. */
export function loadVersion(versions: Versions, id: string): Promise<Doc> {
  let docs = read.get(versions);
  if (!docs) read.set(versions, (docs = new Map()));
  let doc = docs.get(id);
  if (!doc) {
    doc = versions.load(id).then((data) => importDocx(data instanceof Uint8Array ? data : new Uint8Array(data)));
    docs.set(id, doc);
    // A version that could not be read may be read another time.
    doc.catch(() => docs!.delete(id));
  }
  return doc;
}

/** Takes the document back to a version, as a step to undo. */
export async function restoreVersionOf(editor: Editor, versions: Versions, info: VersionInfo): Promise<void> {
  editor.restoreVersion(await loadVersion(versions, info.id));
}

export const UNDO_KEY = IS_MAC ? '⌘Z' : 'Ctrl+Z';

const STYLE_ID = 'dx-versions-style';
const CSS = `
.dx-vv{position:absolute;z-index:30;display:flex;flex-direction:column;background:var(--dx-ui-line,#e6e3dc);font:13px system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-ink,#2f2e2b)}
.dx-vv-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 12px;border-bottom:1px solid var(--dx-ui-line,#e6e3dc);background:var(--dx-ui-bg,#fff)}
.dx-vv-title{font-weight:600}
.dx-vv-bar label{display:flex;align-items:center;gap:6px;color:var(--dx-ui-muted,#5f5d58)}
.dx-vv-bar select{max-width:220px;height:30px;padding:0 6px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit}
.dx-vv-count{color:var(--dx-ui-muted,#5f5d58);font-variant-numeric:tabular-nums}
.dx-vv-nav{display:inline-flex;align-items:center;gap:6px}
.dx-vv-gap{flex:1}
.dx-vv-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;height:30px;min-width:30px;padding:0 10px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit;cursor:pointer;white-space:nowrap}
.dx-vv-btn:hover:not(:disabled){background:var(--dx-ui-hover,#f3f1ec)}
.dx-vv-btn:disabled{opacity:.4;cursor:default}
.dx-vv-btn.dx-vv-main{border-color:var(--dx-ui-accent,#0b57d0);background:var(--dx-ui-accent,#0b57d0);color:var(--dx-ui-on-accent,#fff)}
.dx-vv-btn.dx-vv-main:hover:not(:disabled){background:var(--dx-ui-accent-hover,#08398a)}
.dx-vv-seg{display:inline-flex;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;overflow:hidden}
.dx-vv-seg button{height:28px;padding:0 10px;border:0;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit;cursor:pointer}
.dx-vv-seg button+button{border-left:1px solid var(--dx-ui-line,#e6e3dc)}
.dx-vv-seg button.dx-on{background:var(--dx-ui-active,#e8f0fd);color:var(--dx-ui-accent,#0b57d0)}
.dx-vv-legend{padding:4px 12px;border-bottom:1px solid var(--dx-ui-line,#e6e3dc);background:var(--dx-ui-bar,#fbfaf8);color:var(--dx-ui-muted,#5f5d58);font-size:12px}
.dx-vv-legend s{color:#c62828}
.dx-vv-legend u{color:#1a7f37}
.dx-vv-doc{position:relative;flex:1;min-height:0}
.dx-vv-btn:focus-visible,.dx-vv-seg button:focus-visible,.dx-vv-bar select:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-2px}
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function button(className: string, text: string, title = ''): HTMLButtonElement {
  const node = el('button', className, text);
  node.type = 'button';
  if (title) {
    node.title = title;
    node.setAttribute('aria-label', title);
  }
  return node;
}

/**
 * The comparison of two versions, over the pages of `editor` and as large as
 * they are, until it is closed: the document under it is not touched.
 */
export function createVersionView(editor: Editor, versions: Versions, options: VersionViewOptions = {}): VersionView {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const root = el('div', 'dx-vv');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', t('compare.title'));
  root.setAttribute('aria-modal', 'true');
  /** Gives the keyboard back to what had it when the comparison opened. */
  let release: ((restore?: boolean) => void) | undefined;
  const bar = el('div', 'dx-vv-bar');
  const title = el('span', 'dx-vv-title', t('compare.title'));
  const fromLabel = el('label', '', t('compare.from'));
  const fromSelect = el('select', '');
  fromSelect.dataset.name = 'compare-from';
  fromLabel.appendChild(fromSelect);
  const toLabel = el('label', '', t('compare.to'));
  const toSelect = el('select', '');
  toSelect.dataset.name = 'compare-to';
  toLabel.appendChild(toSelect);
  const count = el('span', 'dx-vv-count');
  count.setAttribute('aria-live', 'polite');
  const prev = button('dx-vv-btn', '‹', t('compare.prev'));
  prev.dataset.name = 'compare-prev';
  const next = button('dx-vv-btn', '›', t('compare.next'));
  next.dataset.name = 'compare-next';
  const seg = el('div', 'dx-vv-seg');
  const marked = button('', t('compare.changes'));
  const plain = button('', t('compare.plain'));
  marked.dataset.name = 'compare-marked';
  plain.dataset.name = 'compare-plain';
  seg.append(marked, plain);
  const restore = button('dx-vv-btn dx-vv-main', t('compare.restore'));
  restore.dataset.name = 'compare-restore';
  const close = button('dx-vv-btn', '✕', t('compare.close'));
  close.dataset.name = 'compare-close';
  const nav = el('span', 'dx-vv-nav');
  nav.append(prev, count, next);
  bar.append(title, fromLabel, toLabel, nav, el('span', 'dx-vv-gap'), seg, restore, close);
  const legend = el('div', 'dx-vv-legend');
  legend.innerHTML = t('compare.legend')
    .replace(/^([^.:]+)/, '<s>$1</s>')
    .replace(/\. ([^.:]+)/, '. <u>$1</u>');
  const docEl = el('div', 'dx-vv-doc');
  root.append(bar, legend, docEl);

  let viewer: Editor | undefined;
  let list: VersionInfo[] = [];
  let from: VersionInfo | undefined;
  let to: VersionInfo | undefined;
  let comparison: Comparison | undefined;
  let fromDoc: Doc | undefined;
  let showMarked = true;
  let at = -1;
  /** Bumped by each comparison asked for: one that is answered late gives way to the one after it. */
  let asked = 0;

  const place = () => {
    const target = editor.element;
    const host = target.parentElement;
    if (!host) return;
    if (root.parentElement !== host) host.appendChild(root);
    applyTheme(root, editor.theme);
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    root.style.left = `${target.offsetLeft}px`;
    root.style.top = `${target.offsetTop}px`;
    root.style.width = `${target.offsetWidth}px`;
    root.style.height = `${target.offsetHeight}px`;
  };
  const resize = new ResizeObserver(() => !root.hidden && place());
  resize.observe(editor.element);

  const option = (info: VersionInfo | undefined, value: string) => {
    const node = new Option(info ? [versionName(info), info.label ? versionDate(info) : ''].filter(Boolean).join(' · ') : t('history.current'), value);
    return node;
  };
  const fillSelects = () => {
    fromSelect.replaceChildren(...list.map((info) => option(info, info.id)));
    toSelect.replaceChildren(option(undefined, ''), ...list.map((info) => option(info, info.id)));
    fromSelect.value = from?.id ?? '';
    toSelect.value = to?.id ?? '';
  };

  const marks = () => comparison?.marks ?? [];
  const renderCount = () => {
    const changes = comparison?.changes ?? [];
    const inText = changes.filter((change) => !change.part).length;
    const elsewhere = changes.length - inText;
    const words = inText === 0 ? t('compare.none') : plural('compare.count', inText, { n: inText });
    const notes = comparison?.notes.length ?? 0;
    count.textContent = [words, elsewhere ? t('compare.elsewhere', { n: elsewhere }) : '', notes ? t('compare.notes', { n: notes }) : ''].filter(Boolean).join(' · ');
    const n = marks().length;
    prev.disabled = !showMarked || n === 0 || at <= 0;
    next.disabled = !showMarked || n === 0 || at >= n - 1;
    marked.classList.toggle('dx-on', showMarked);
    plain.classList.toggle('dx-on', !showMarked);
    marked.setAttribute('aria-pressed', String(showMarked));
    plain.setAttribute('aria-pressed', String(!showMarked));
    legend.hidden = !showMarked;
  };
  const go = (index: number) => {
    const mark = marks()[index];
    if (!mark || !viewer) return;
    at = index;
    viewer.goTo(mark.pos, mark.part);
    renderCount();
  };
  const showDoc = () => {
    const doc = showMarked ? comparison?.doc : fromDoc;
    if (!doc) return;
    if (!viewer) {
      viewer = new Editor(docEl, doc);
      viewer.readOnly = true;
    } else viewer.load(doc);
    viewer.readOnly = true;
    if (editor.fit) viewer.setFit(editor.fit);
    else viewer.setZoom(editor.zoom);
    at = -1;
    renderCount();
  };

  const compare = async () => {
    const mine = ++asked;
    if (!from) return;
    count.textContent = t('history.loading');
    try {
      const before = await loadVersion(versions, from.id);
      // The document as it would be kept: a version is a file, and what a file cannot hold is no change.
      const after = to ? await loadVersion(versions, to.id) : importDocx(editor.exportDocx());
      if (mine !== asked) return;
      fromDoc = before;
      comparison = compareDocs(before, after);
      restore.title = t('history.restoreTitle');
      showDoc();
      if (showMarked && marks().length) go(0);
    } catch (error) {
      if (mine !== asked) return;
      count.textContent = '';
      options.onError?.(t('history.openFailed', { error: (error as Error).message }));
    }
  };

  const shut = () => {
    if (root.hidden) return;
    asked++;
    root.hidden = true;
    viewer?.destroy();
    viewer = undefined;
    comparison = undefined;
    fromDoc = undefined;
    if (release) release();
    else editor.focus();
    release = undefined;
  };

  fromSelect.addEventListener('change', () => {
    from = list.find((info) => info.id === fromSelect.value);
    void compare();
  });
  toSelect.addEventListener('change', () => {
    to = list.find((info) => info.id === toSelect.value);
    void compare();
  });
  prev.addEventListener('click', () => go(at - 1));
  next.addEventListener('click', () => go(at + 1));
  marked.addEventListener('click', () => {
    if (showMarked) return;
    showMarked = true;
    showDoc();
    if (marks().length) go(0);
  });
  plain.addEventListener('click', () => {
    if (!showMarked) return;
    showMarked = false;
    showDoc();
  });
  restore.addEventListener('click', async () => {
    const version = from;
    if (!version) return;
    try {
      await restoreVersionOf(editor, versions, version);
      shut();
      options.onRestore?.(version);
    } catch (error) {
      options.onError?.(t('history.openFailed', { error: (error as Error).message }));
    }
  });
  close.addEventListener('click', shut);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      shut();
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.altKey) {
      // Alt and an arrow: from one change to the next, as in Word's comparison.
      e.preventDefault();
      go(at + (e.key === 'ArrowDown' ? 1 : -1));
    }
  });

  return {
    async show(version, against) {
      from = version;
      to = against;
      showMarked = true;
      try {
        list = sortVersions(await versions.list());
      } catch {
        list = [];
      }
      if (!list.some((info) => info.id === version.id)) list.unshift(version);
      if (against && !list.some((info) => info.id === against.id)) list.push(against);
      fillSelects();
      root.hidden = false;
      release ??= holdFocus(root, () => editor.focus());
      place();
      await compare();
      close.focus();
    },
    close: shut,
    get isOpen() {
      return !root.hidden;
    },
    destroy() {
      shut();
      resize.disconnect();
      root.remove();
    },
  };
}
