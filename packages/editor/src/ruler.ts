// The ruler over an Editor, as in Word: the width of the page in centimetres,
// its margins, and the indents and tab stops of the paragraph the caret is in.
// The edges of the margins and the markers can be dragged; a click on the scale
// sets a tab stop of the kind the button at the corner shows, and a stop dragged
// off the ruler goes. Like the toolbar, it only uses the public methods of the editor.

import type { TabStop } from '@rebodocs/core';
import { installRegionKeys, markRegion } from './a11y';
import type { Editor } from './editor';
import { paragraphDialog } from './paragraphdialog';
import { type MessageKey, getLocale, t } from './i18n';

export interface Ruler {
  destroy(): void;
}

type Handle = 'first' | 'hanging' | 'left' | 'right' | 'marginLeft' | 'marginRight';

const PT_PER_CM = 72 / 2.54;
/** What a dragged marker snaps to, unless Alt is held: a quarter of a centimetre. */
const SNAP = PT_PER_CM / 4;
/** The least room, in points, left for the text of a paragraph and for that of the page. */
const MIN_TEXT = 36;
const MIN_COLUMN = 72;
const HEIGHT = 24;
/** The band of the scale inside the ruler, from top to bottom, in pixels. */
const BAND_TOP = 5;
const BAND_BOTTOM = 19;
const STYLE_ID = 'dx-ruler-style';

const CSS = `
.dx-ruler{position:relative;flex:none;height:${HEIGHT}px;overflow:hidden;background:var(--dx-ruler,#fbfaf8);border-bottom:1px solid var(--dx-ruler-line,#e6e3dc);user-select:none}
.dx-ruler canvas{position:absolute;left:0;top:0;width:100%;height:100%}
.dx-ruler canvas{border:0 solid;border-left-color:var(--dx-ruler-margin,#e6e3dc);border-right-color:var(--dx-ruler-text,#fff);border-top-color:var(--dx-ruler-ink,#5f5d58);transition:border-color 1ms}
.dx-ruler-h{position:absolute;width:11px;margin-left:-5.5px;cursor:pointer;z-index:2}
.dx-ruler-h svg{display:block;fill:var(--dx-ruler-ink,#5f5d58);stroke:var(--dx-ruler-text,#fff);stroke-width:.6}
.dx-ruler-h:hover svg,.dx-ruler-h.dx-on svg{fill:var(--dx-ruler-on,#0b57d0)}
.dx-ruler-first{top:0;height:9px}
.dx-ruler-hanging,.dx-ruler-right{top:11px;height:8px}
.dx-ruler-left{top:19px;height:5px}
.dx-ruler-m{position:absolute;top:0;width:9px;height:100%;cursor:ew-resize;z-index:1}
.dx-ruler-tab{position:absolute;top:13px;width:9px;height:8px;margin-left:-4.5px;cursor:pointer;z-index:2}
.dx-ruler-tab svg,.dx-ruler-kind svg{display:block;fill:none;stroke:var(--dx-ruler-ink,#5f5d58);stroke-width:1.5}
.dx-ruler-tab:hover svg,.dx-ruler-tab.dx-on svg{stroke:var(--dx-ruler-on,#0b57d0)}
.dx-ruler-kind{position:absolute;left:0;top:0;width:24px;height:24px;border-radius:3px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:3}
.dx-ruler-kind:hover{background:var(--dx-ruler-margin,#e6e3dc)}
.dx-ruler-guide{position:fixed;width:0;border-left:1px dashed var(--dx-ruler-on,#0b57d0);pointer-events:none;z-index:30}
`;

const DOWN = '<svg viewBox="0 0 11 9" width="11" height="9"><path d="M1 1h9v3.5L5.5 8.5 1 4.5z"/></svg>';
const UP = '<svg viewBox="0 0 11 8" width="11" height="8"><path d="M5.5.5 10 4.5V8H1V4.5z"/></svg>';
const BOX = '<svg viewBox="0 0 11 5" width="11" height="5"><path d="M1 0h9v4.5H1z"/></svg>';

/** The kinds of tab stop the corner button goes through, each with its mark and its name. */
type TabKind = 'left' | 'center' | 'right' | 'decimal';
const TAB_KINDS: TabKind[] = ['left', 'center', 'right', 'decimal'];
const TAB_MARKS: Record<TabKind, string> = {
  left: '<path d="M4.5 0v7h4.5"/>',
  center: '<path d="M4.5 0v7M0 7h9"/>',
  right: '<path d="M4.5 0v7H0"/>',
  decimal: '<path d="M4.5 0v7M0 7h9"/><circle cx="7.5" cy="3" r=".8" fill="currentColor"/>',
};
const TAB_NAMES: Record<TabKind, MessageKey> = { left: 'ruler.tabLeft', center: 'ruler.tabCenter', right: 'ruler.tabRight', decimal: 'ruler.tabDecimal' };
const tabMark = (kind: TabKind) => `<svg viewBox="0 0 9 8" width="9" height="8">${TAB_MARKS[kind]}</svg>`;
/** How far from the ruler, in pixels, a dragged tab stop is let go of to take it away. */
const TAB_DROP = 18;

/** In the order Tab goes through them: from left to right, as they stand on the ruler. */
const HANDLES: [Handle, MessageKey, string][] = [
  ['marginLeft', 'ruler.marginLeft', ''],
  ['first', 'ruler.first', DOWN],
  ['hanging', 'ruler.hanging', UP],
  ['left', 'ruler.left', BOX],
  ['right', 'ruler.right', UP],
  ['marginRight', 'ruler.marginRight', ''],
];

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
const round = (value: number) => Math.round(value * 100) / 100;

export function createRuler(container: HTMLElement, editor: Editor): Ruler {
  injectStyle();
  const bar = document.createElement('div');
  bar.className = 'dx-ruler';
  const canvas = document.createElement('canvas');
  bar.appendChild(canvas);
  const handles = {} as Record<Handle, HTMLElement>;
  for (const [name, label, html] of HANDLES) {
    const node = document.createElement('div');
    node.className = html ? `dx-ruler-h dx-ruler-${name}` : 'dx-ruler-m';
    node.innerHTML = html;
    node.title = t(label);
    node.dataset.name = name;
    node.addEventListener('mousedown', (e) => startDrag(e, name));
    // The indents typed in, to the millimetre, as a double click on them does in Word.
    if (html) node.addEventListener('dblclick', () => paragraphDialog(editor).open());
    // From the keyboard, each marker is a slider: the arrows move it a quarter of a centimetre, with Shift a whole one.
    node.tabIndex = 0;
    node.setAttribute('role', 'slider');
    node.setAttribute('aria-label', t(label));
    node.setAttribute('aria-orientation', 'horizontal');
    node.addEventListener('keydown', (e) => {
      const by = step(e);
      if (!by) return;
      e.preventDefault();
      const from = read();
      apply(name, from, moved(from, name, positionOf(from, name) + by, true));
    });
    handles[name] = node;
    bar.appendChild(node);
  }
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', t('a11y.ruler'));
  markRegion(bar, 'ruler', () => bar.querySelector<HTMLElement>('[tabindex="0"]'));
  installRegionKeys();
  /** How far an arrow moves a marker, in points: a quarter of a centimetre, a whole one with Shift, a point with Alt. */
  const step = (e: KeyboardEvent): number => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir || e.ctrlKey || e.metaKey) return 0;
    return dir * (e.shiftKey ? PT_PER_CM : e.altKey ? 1 : SNAP);
  };
  const cm = (pt: number) => t('a11y.cm', { value: (Math.round((pt / PT_PER_CM) * 100) / 100).toLocaleString(getLocale()) });

  // Clicks on the ruler must not take the keyboard away from the document.
  bar.addEventListener('mousedown', (e) => e.preventDefault());

  // The kind of tab stop a click on the scale sets, at the corner; a click on it goes on to the next.
  let kind: TabKind = 'left';
  const kindButton = document.createElement('div');
  kindButton.className = 'dx-ruler-kind';
  const showKind = () => {
    kindButton.innerHTML = tabMark(kind);
    kindButton.title = `${t(TAB_NAMES[kind])}. ${t('ruler.tabHint')}`;
    kindButton.setAttribute('aria-label', t('a11y.tabKind', { kind: t(TAB_NAMES[kind]) }));
  };
  showKind();
  kindButton.tabIndex = 0;
  kindButton.setAttribute('role', 'button');
  kindButton.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      kind = TAB_KINDS[(TAB_KINDS.indexOf(kind) + 1) % TAB_KINDS.length];
      showKind();
      editor.announce(t(TAB_NAMES[kind]), true);
    } else if (e.key === 'Insert' || e.key === '+') {
      // A stop where the caret is, as a click on the scale above it would set.
      e.preventDefault();
      const at = editor.selectionBounds();
      if (!at) return;
      const state = read();
      const { origin, scale } = frame();
      const pos = round(Math.round(((at.left - bar.getBoundingClientRect().left - origin) / scale - state.left) / SNAP) * SNAP);
      if (pos <= 0 || pos >= state.right - state.left) return;
      setTabs([...state.tabs.filter((tab) => Math.abs(tab.pos - pos) > 0.5), { pos, align: kind }]);
      editor.announce(t('a11y.tabAt', { kind: t(TAB_NAMES[kind]), value: cm(pos) }), true);
    }
  });
  kindButton.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    kind = TAB_KINDS[(TAB_KINDS.indexOf(kind) + 1) % TAB_KINDS.length];
    showKind();
  });
  // First for Tab, as it is first on the ruler.
  canvas.after(kindButton);
  /** The marks of the tab stops of the paragraph, one for each. */
  let tabMarks: HTMLElement[] = [];
  // A click on the scale, inside the text, sets a stop there.
  bar.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || (e.target !== bar && e.target !== canvas)) return;
    const state = read();
    const { origin, scale } = frame();
    const pos = (e.clientX - bar.getBoundingClientRect().left - origin) / scale - state.left;
    if (pos <= 0 || pos >= state.right - state.left) return;
    const at = round(e.altKey ? pos : Math.round(pos / SNAP) * SNAP);
    setTabs([...state.tabs.filter((tab) => Math.abs(tab.pos - at) > 0.5), { pos: at, align: kind }]);
  });

  /** Everything the ruler shows, in points from the left edge of the page. */
  interface State {
    width: number;
    marginLeft: number;
    marginRight: number;
    /** The column the paragraph is set in, and its indents as positions. */
    left: number;
    right: number;
    indentLeft: number;
    indentFirstLine: number;
    indentRight: number;
    /** Its tab stops, from the left of the column. */
    tabs: TabStop[];
  }

  const read = (): State => {
    const { width, marginLeft, marginRight } = editor.page;
    const { indentLeft, indentFirstLine, indentRight, tabs } = editor.activeParagraphProps();
    return { width, marginLeft, marginRight, ...editor.textColumn(), indentLeft, indentFirstLine, indentRight, tabs };
  };

  /** Gives the paragraphs of the selection these tab stops, in order. */
  const setTabs = (tabs: TabStop[]) => editor.setParagraphProps({ tabs: tabs.slice().sort((a, b) => a.pos - b.pos) });

  /** Pixels from the left of the ruler to the left of the page, and pixels per point. */
  const frame = () => {
    const page = editor.pageBounds();
    return { origin: page.left - bar.getBoundingClientRect().left, scale: page.width / editor.page.width };
  };

  const draw = (state: State) => {
    const { origin, scale } = frame();
    const x = (pt: number) => origin + pt * scale;
    const ratio = window.devicePixelRatio || 1;
    const width = bar.clientWidth;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== HEIGHT * ratio) {
      canvas.width = Math.round(width * ratio);
      canvas.height = HEIGHT * ratio;
    }
    const g = canvas.getContext('2d');
    if (!g) return;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, width, HEIGHT);
    // A canvas knows nothing of the styles of the page: the colours are read from the bar.
    const styles = getComputedStyle(bar);
    const colour = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    // The page, with the room for text in white and what is outside it in grey.
    g.fillStyle = colour('--dx-ruler-margin', '#e6e3dc');
    g.fillRect(x(0), BAND_TOP, state.width * scale, BAND_BOTTOM - BAND_TOP);
    g.fillStyle = colour('--dx-ruler-text', '#fff');
    g.fillRect(x(state.left), BAND_TOP, (state.right - state.left) * scale, BAND_BOTTOM - BAND_TOP);

    // Centimetres from the left edge of the text, both ways: numbers on each, a line on the halves, a dot on the quarters.
    const cm = PT_PER_CM * scale;
    const middle = (BAND_TOP + BAND_BOTTOM) / 2;
    const every = cm < 22 ? 2 : 1;
    g.fillStyle = colour('--dx-ruler-ink', '#5f5d58');
    g.font = '9px system-ui,-apple-system,"Segoe UI",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const first = Math.ceil((-state.left / PT_PER_CM) * 4);
    const last = Math.floor(((state.width - state.left) / PT_PER_CM) * 4);
    for (let quarter = first; quarter <= last; quarter++) {
      const at = Math.round(x(state.left) + (quarter / 4) * cm);
      if (quarter % 4 === 0) {
        const n = Math.abs(quarter / 4);
        if (n && n % every === 0) g.fillText(String(n), at, middle + 0.5);
        else if (n) g.fillRect(at, middle - 3, 1, 6);
      } else if (quarter % 2 === 0) {
        g.fillRect(at, middle - 3, 1, 6);
      } else if (cm >= 44) {
        g.fillRect(at, middle - 1, 1, 2);
      }
    }
  };

  const place = (state: State) => {
    const { origin, scale } = frame();
    const at = (name: Handle, pt: number, shift = 0) => (handles[name].style.left = `${origin + pt * scale + shift}px`);
    at('first', state.left + state.indentLeft + state.indentFirstLine);
    at('hanging', state.left + state.indentLeft);
    at('left', state.left + state.indentLeft);
    at('right', state.right - state.indentRight);
    // The edges of the margins are taken from just outside the text, clear of the indent markers.
    at('marginLeft', state.marginLeft, -9);
    at('marginRight', state.width - state.marginRight);
    // A mark for each tab stop that is a stop, made again when they change.
    const stops = state.tabs.map((tab, index) => ({ tab, index })).filter(({ tab }) => tab.align !== 'bar');
    if (tabMarks.length !== stops.length || stops.some(({ tab }, k) => tabMarks[k].dataset.kind !== tab.align)) {
      for (const mark of tabMarks) mark.remove();
      tabMarks = stops.map(({ tab, index }) => {
        const mark = document.createElement('div');
        mark.className = 'dx-ruler-tab';
        mark.dataset.kind = tab.align;
        mark.innerHTML = tabMark(tab.align as TabKind);
        mark.title = `${t(TAB_NAMES[tab.align as TabKind])}. ${t('ruler.tabDrag')}`;
        mark.addEventListener('mousedown', (e) => startTabDrag(e, Number(mark.dataset.index)));
        mark.tabIndex = 0;
        mark.setAttribute('role', 'slider');
        mark.setAttribute('aria-label', t('a11y.tabStop', { kind: t(TAB_NAMES[tab.align as TabKind]) }));
        mark.addEventListener('keydown', (e) => {
          const from = read();
          const index = Number(mark.dataset.index);
          const was = from.tabs[index];
          if (!was) return;
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            kindButton.focus();
            setTabs(from.tabs.filter((_, i) => i !== index));
            return;
          }
          const by = step(e);
          if (!by) return;
          e.preventDefault();
          const pos = round(clamp(was.pos + by, 0, from.right - from.left));
          setTabs([...from.tabs.filter((tab, i) => i !== index && Math.abs(tab.pos - pos) > 0.5), { ...was, pos }]);
        });
        mark.dataset.index = String(index);
        bar.appendChild(mark);
        return mark;
      });
    }
    stops.forEach(({ tab, index }, k) => {
      tabMarks[k].dataset.index = String(index);
      tabMarks[k].style.left = `${origin + (state.left + tab.pos) * scale}px`;
      tabMarks[k].setAttribute('aria-valuetext', cm(tab.pos));
    });
    // What each marker stands at, for a screen reader.
    const values: Record<Handle, number> = {
      first: state.indentLeft + state.indentFirstLine,
      hanging: state.indentLeft,
      left: state.indentLeft,
      right: state.indentRight,
      marginLeft: state.marginLeft,
      marginRight: state.marginRight,
    };
    for (const [name, node] of Object.entries(handles) as [Handle, HTMLElement][]) node.setAttribute('aria-valuetext', cm(values[name]));
  };

  const refresh = (state = read()) => {
    draw(state);
    place(state);
  };
  let queued = 0;
  const schedule = () => {
    if (!queued) {
      queued = requestAnimationFrame(() => {
        queued = 0;
        if (!drag && !tabDrag) refresh();
      });
    }
  };

  // --- Dragging -------------------------------------------------------------------

  let drag: { handle: Handle; from: State; now: State; guide: HTMLElement } | undefined;

  /** `from` with `handle` moved to `pt`, points from the left of the page. */
  const moved = (from: State, handle: Handle, pt: number, free: boolean): State => {
    const snap = (value: number) => (free ? value : Math.round(value / SNAP) * SNAP);
    const column = from.right - from.left;
    const next = { ...from };
    switch (handle) {
      case 'first': {
        const position = clamp(snap(pt - from.left), 0, column - from.indentRight - MIN_TEXT);
        next.indentFirstLine = round(position - from.indentLeft);
        break;
      }
      case 'hanging': {
        // The first line stays where it is; the rest of the paragraph moves.
        next.indentLeft = round(clamp(snap(pt - from.left), 0, column - from.indentRight - MIN_TEXT));
        next.indentFirstLine = round(from.indentLeft + from.indentFirstLine - next.indentLeft);
        break;
      }
      case 'left':
        // The whole paragraph moves, its first line with it.
        next.indentLeft = round(clamp(snap(pt - from.left), Math.max(0, -from.indentFirstLine), column - from.indentRight - MIN_TEXT));
        break;
      case 'right':
        next.indentRight = round(clamp(snap(from.right - pt), 0, column - Math.max(from.indentLeft, from.indentLeft + from.indentFirstLine) - MIN_TEXT));
        break;
      case 'marginLeft': {
        next.marginLeft = round(clamp(snap(pt), 0, from.width - from.marginRight - MIN_COLUMN));
        // The text and its markers go with the margin.
        if (from.left === from.marginLeft) next.left = next.marginLeft;
        break;
      }
      case 'marginRight': {
        next.marginRight = round(clamp(snap(from.width - pt), 0, from.width - from.marginLeft - MIN_COLUMN));
        if (from.right === from.width - from.marginRight) next.right = from.width - next.marginRight;
        break;
      }
    }
    return next;
  };

  /** Where the dragged thing is, in points from the left of the page, for the guide. */
  const positionOf = (state: State, handle: Handle): number => {
    switch (handle) {
      case 'first':
        return state.left + state.indentLeft + state.indentFirstLine;
      case 'hanging':
      case 'left':
        return state.left + state.indentLeft;
      case 'right':
        return state.right - state.indentRight;
      case 'marginLeft':
        return state.marginLeft;
      case 'marginRight':
        return state.width - state.marginRight;
    }
  };

  const onMove = (e: MouseEvent) => {
    if (!drag) return;
    const page = editor.pageBounds();
    const scale = page.width / drag.from.width;
    drag.now = moved(drag.from, drag.handle, (e.clientX - page.left) / scale, e.altKey);
    refresh(drag.now);
    drag.guide.style.left = `${page.left + positionOf(drag.now, drag.handle) * scale}px`;
  };

  /** Gives the document what a marker moved from `from` to `now` says. */
  const apply = (handle: Handle, from: State, now: State) => {
    if (handle === 'marginLeft' || handle === 'marginRight') {
      if (now.marginLeft !== from.marginLeft || now.marginRight !== from.marginRight) editor.setPage({ marginLeft: now.marginLeft, marginRight: now.marginRight });
    } else if (now.indentLeft !== from.indentLeft || now.indentFirstLine !== from.indentFirstLine || now.indentRight !== from.indentRight) {
      editor.setParagraphProps({ indentLeft: now.indentLeft, indentFirstLine: now.indentFirstLine, indentRight: now.indentRight });
    }
  };

  const endDrag = (keep: boolean) => {
    if (!drag) return;
    const { handle, from, now, guide } = drag;
    drag = undefined;
    guide.remove();
    handles[handle].classList.remove('dx-on');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('keydown', onKey, true);
    // The document changes once, when the marker is let go: laying it out on every move would drag.
    if (keep) apply(handle, from, now);
    refresh();
    editor.focus();
  };
  const onUp = () => endDrag(true);
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    endDrag(false);
  };

  function startDrag(e: MouseEvent, handle: Handle): void {
    if (e.button !== 0) return;
    e.preventDefault();
    const from = read();
    // A line down the page shows where the edge will be.
    const guide = document.createElement('div');
    guide.className = 'dx-ruler-guide';
    const area = editor.element.getBoundingClientRect();
    guide.style.top = `${area.top}px`;
    guide.style.height = `${area.height}px`;
    document.body.appendChild(guide);
    drag = { handle, from, now: from, guide };
    handles[handle].classList.add('dx-on');
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey, true);
    onMove(e);
  }

  // --- Dragging a tab stop: along the ruler to move it, off it to take it away -------------

  let tabDrag: { index: number; from: State; at: number; off: boolean; guide: HTMLElement } | undefined;

  const onTabMove = (e: MouseEvent) => {
    if (!tabDrag) return;
    const page = editor.pageBounds();
    const scale = page.width / tabDrag.from.width;
    const box = bar.getBoundingClientRect();
    const pos = (e.clientX - page.left) / scale - tabDrag.from.left;
    tabDrag.at = round(clamp(e.altKey ? pos : Math.round(pos / SNAP) * SNAP, 0, tabDrag.from.right - tabDrag.from.left));
    tabDrag.off = e.clientY < box.top - TAB_DROP || e.clientY > box.bottom + TAB_DROP;
    const tabs = tabDrag.from.tabs.map((tab, i) => (i === tabDrag!.index ? { ...tab, pos: tabDrag!.at } : tab)).filter((_, i) => !(tabDrag!.off && i === tabDrag!.index));
    place({ ...tabDrag.from, tabs });
    tabDrag.guide.style.display = tabDrag.off ? 'none' : '';
    tabDrag.guide.style.left = `${page.left + (tabDrag.from.left + tabDrag.at) * scale}px`;
  };

  const endTabDrag = (apply: boolean) => {
    if (!tabDrag) return;
    const { index, from, at, off, guide } = tabDrag;
    tabDrag = undefined;
    guide.remove();
    window.removeEventListener('mousemove', onTabMove);
    window.removeEventListener('mouseup', onTabUp);
    window.removeEventListener('keydown', onTabKey, true);
    const was = from.tabs[index];
    if (apply && was && (off || Math.abs(at - was.pos) > 0.01)) {
      const rest = from.tabs.filter((_, i) => i !== index);
      setTabs(off ? rest : [...rest.filter((tab) => Math.abs(tab.pos - at) > 0.5), { ...was, pos: at }]);
    }
    refresh();
    editor.focus();
  };
  const onTabUp = () => endTabDrag(true);
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    endTabDrag(false);
  };

  function startTabDrag(e: MouseEvent, index: number): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const from = read();
    const guide = document.createElement('div');
    guide.className = 'dx-ruler-guide';
    const area = editor.element.getBoundingClientRect();
    guide.style.top = `${area.top}px`;
    guide.style.height = `${area.height}px`;
    document.body.appendChild(guide);
    tabDrag = { index, from, at: from.tabs[index]?.pos ?? 0, off: false, guide };
    window.addEventListener('mousemove', onTabMove);
    window.addEventListener('mouseup', onTabUp);
    window.addEventListener('keydown', onTabKey, true);
    onTabMove(e);
  }

  // The ruler follows the page: when the document or the caret changes, and when the page moves under it.
  const unsubscribe = editor.onChange(schedule);
  editor.element.addEventListener('scroll', schedule, { passive: true });
  const observer = new ResizeObserver(schedule);
  observer.observe(bar);
  observer.observe(editor.element);
  // The colours the canvas is drawn in are those of the variables when it was drawn: a change of them, which the
  // borders of the canvas follow with a transition of no length, draws it again, whatever brought it (a theme, dark mode).
  canvas.addEventListener('transitionend', schedule);
  container.appendChild(bar);
  refresh();

  return {
    destroy() {
      endDrag(false);
      endTabDrag(false);
      unsubscribe();
      editor.element.removeEventListener('scroll', schedule);
      observer.disconnect();
      if (queued) cancelAnimationFrame(queued);
      bar.remove();
    },
  };
}
