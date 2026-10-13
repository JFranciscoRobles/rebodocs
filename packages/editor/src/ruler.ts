// The ruler over an Editor, as in Word: the width of the page in centimetres,
// its margins, and the indents of the paragraph the caret is in. The edges of
// the margins and the indent markers can be dragged. Like the toolbar, it only
// uses the public methods of the editor.

import type { Editor } from './editor';
import { type MessageKey, t } from './i18n';

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
.dx-ruler{position:relative;flex:none;height:${HEIGHT}px;overflow:hidden;background:#f3f5f9;border-bottom:1px solid #d9dce3;user-select:none}
.dx-ruler canvas{position:absolute;left:0;top:0;width:100%;height:100%}
.dx-ruler-h{position:absolute;width:11px;margin-left:-5.5px;cursor:pointer;z-index:2}
.dx-ruler-h svg{display:block;fill:#5f6470;stroke:#fff;stroke-width:.6}
.dx-ruler-h:hover svg,.dx-ruler-h.dx-on svg{fill:#0b57d0}
.dx-ruler-first{top:0;height:9px}
.dx-ruler-hanging,.dx-ruler-right{top:11px;height:8px}
.dx-ruler-left{top:19px;height:5px}
.dx-ruler-m{position:absolute;top:0;width:9px;height:100%;cursor:ew-resize;z-index:1}
.dx-ruler-guide{position:fixed;width:0;border-left:1px dashed #0b57d0;pointer-events:none;z-index:30}
`;

const DOWN = '<svg viewBox="0 0 11 9" width="11" height="9"><path d="M1 1h9v3.5L5.5 8.5 1 4.5z"/></svg>';
const UP = '<svg viewBox="0 0 11 8" width="11" height="8"><path d="M5.5.5 10 4.5V8H1V4.5z"/></svg>';
const BOX = '<svg viewBox="0 0 11 5" width="11" height="5"><path d="M1 0h9v4.5H1z"/></svg>';

const HANDLES: [Handle, MessageKey, string][] = [
  ['marginLeft', 'ruler.marginLeft', ''],
  ['marginRight', 'ruler.marginRight', ''],
  ['first', 'ruler.first', DOWN],
  ['hanging', 'ruler.hanging', UP],
  ['left', 'ruler.left', BOX],
  ['right', 'ruler.right', UP],
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
    handles[name] = node;
    bar.appendChild(node);
  }

  // Clicks on the ruler must not take the keyboard away from the document.
  bar.addEventListener('mousedown', (e) => e.preventDefault());

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
  }

  const read = (): State => {
    const { width, marginLeft, marginRight } = editor.doc.page;
    const { indentLeft, indentFirstLine, indentRight } = editor.activeParagraphProps();
    return { width, marginLeft, marginRight, ...editor.textColumn(), indentLeft, indentFirstLine, indentRight };
  };

  /** Pixels from the left of the ruler to the left of the page, and pixels per point. */
  const frame = () => {
    const page = editor.pageBounds();
    return { origin: page.left - bar.getBoundingClientRect().left, scale: page.width / editor.doc.page.width };
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
    // The page, with the room for text in white and what is outside it in grey.
    g.fillStyle = '#cfd4dd';
    g.fillRect(x(0), BAND_TOP, state.width * scale, BAND_BOTTOM - BAND_TOP);
    g.fillStyle = '#fff';
    g.fillRect(x(state.left), BAND_TOP, (state.right - state.left) * scale, BAND_BOTTOM - BAND_TOP);

    // Centimetres from the left edge of the text, both ways: numbers on each, a line on the halves, a dot on the quarters.
    const cm = PT_PER_CM * scale;
    const middle = (BAND_TOP + BAND_BOTTOM) / 2;
    const every = cm < 22 ? 2 : 1;
    g.fillStyle = '#5f6470';
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
        if (!drag) refresh();
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

  const endDrag = (apply: boolean) => {
    if (!drag) return;
    const { handle, from, now, guide } = drag;
    drag = undefined;
    guide.remove();
    handles[handle].classList.remove('dx-on');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('keydown', onKey, true);
    if (apply) {
      // The document changes once, when the marker is let go: laying it out on every move would drag.
      if (handle === 'marginLeft' || handle === 'marginRight') {
        if (now.marginLeft !== from.marginLeft || now.marginRight !== from.marginRight) editor.setPage({ marginLeft: now.marginLeft, marginRight: now.marginRight });
      } else if (now.indentLeft !== from.indentLeft || now.indentFirstLine !== from.indentFirstLine || now.indentRight !== from.indentRight) {
        editor.setParagraphProps({ indentLeft: now.indentLeft, indentFirstLine: now.indentFirstLine, indentRight: now.indentRight });
      }
    }
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

  // The ruler follows the page: when the document or the caret changes, and when the page moves under it.
  const unsubscribe = editor.onChange(schedule);
  editor.element.addEventListener('scroll', schedule, { passive: true });
  const observer = new ResizeObserver(schedule);
  observer.observe(bar);
  observer.observe(editor.element);
  container.appendChild(bar);
  refresh();

  return {
    destroy() {
      endDrag(false);
      unsubscribe();
      editor.element.removeEventListener('scroll', schedule);
      observer.disconnect();
      if (queued) cancelAnimationFrame(queued);
      bar.remove();
    },
  };
}
