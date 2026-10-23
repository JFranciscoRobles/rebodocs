// The mouse and the fingers on the pages: where a press puts the caret, what
// a double or a triple press selects, dragging a selection out, the edges of
// tables and the corners of pictures taken hold of, the header and the notes
// gone into, and, by touch, holding a word, the handles of the selection and
// two fingers that zoom. What is under a point of the screen is found here.

import {
  type Doc,
  type FloatBox,
  type PageSetup,
  type Position,
  type Rect,
  caretRect,
  comparePositions,
  tocRange,
  tocTarget,
  pageAt,
  moveFloat,
  resizeFloat,
  reanchorFloat,
  NOTE_COLORS,
  hitTest,
  movePicture,
  outsideField,
  paragraphLength,
  resizeColumn,
  resizeRow,
  resizeTable,
  MIN_ROW_HEIGHT,
  resizePicture,
  tableGeometry,
  wordRangeAt,
} from '@rebodocs/core/internal';
import { speaks, t } from './i18n';
import { IS_MAC, keyboardInset } from './platform';
import { applyTheme } from './theme';
import { type Editor, type EditArea, PT_TO_PX } from './editor';

/** How long the handle under the caret stays after a tap. */
const CARET_HANDLE_MS = 4000;
/** How near the edge of a column, in pixels, the pointer takes hold of it. */
const COLUMN_GRIP = 3;
/** How near the bottom right corner of a table, in pixels, it can be taken to make the whole table larger or smaller. */
const TABLE_GRIP = 6;
/** The smallest a picture is dragged to, in points, and how far a press must move to become a drag. */
const MIN_PICTURE = 8;
const DRAG_START = 4;
/** How near the edge of the window, in pixels, dragging a handle scrolls it, and how fast. */
const HANDLE_SCROLL_EDGE = 44;
const HANDLE_SCROLL_STEP = 14;
/** A finger held still this long selects the word under it; one that moves this far, in pixels, is scrolling. */
const HOLD_MS = 450;
const TOUCH_SLOP = 10;
/** Taps this close together, in time and in pixels, count as one: the second selects a word, the third a paragraph. */
const TAP_AGAIN_MS = 350;
const TAP_AGAIN_PX = 28;
/** How the key that follows a link is written: the command key, or Ctrl where there is none. */
const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl';

export class Pointer {
  constructor(private readonly editor: Editor) {}

  /** Starts taking the mouse and the fingers on the pages. Moves and releases are heard on the whole window, for a drag that leaves them. */
  listen(): void {
    const pages = this.editor.pagesEl;
    pages.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    pages.addEventListener('touchstart', this.onTouchStart, { passive: false });
    pages.addEventListener('touchmove', this.onTouchMove, { passive: false });
    pages.addEventListener('touchend', this.onTouchEnd, { passive: false });
    pages.addEventListener('touchcancel', this.onTouchCancel);
    // Safari's own pinch, which would make the whole page of the browser larger.
    pages.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  /** Stops, with the editor: what it listens to on the window, and what waits to happen. */
  stop(): void {
    this.hideNoteTip();
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.clearTimeout(this.touch?.timer);
    window.clearTimeout(this.caretHandleTimer);
    if (this.pinch) cancelAnimationFrame(this.pinch.frame);
  }

  /** A drag under way that is not a selection: the edge of a column, the corner of a picture, or a picture. */
  private columnDrag: { table: number; boundary: number; startX: number; scale: number; guide: HTMLElement } | undefined;
  /** The bottom edge of a table row being dragged: the row, how tall it is drawn, and the line that shows where it goes. */
  private rowDrag: { table: number; row: number; height: number; startY: number; scale: number; guide: HTMLElement } | undefined;
  /** The corner of a table being dragged: the table, where it is on the page in pixels, and the box that shows its new size. */
  private tableDrag: { table: number; startX: number; startY: number; width: number; height: number; guide: HTMLElement } | undefined;
  private pictureResize: { pos: Position; corner: string; startX: number; box: Rect; frame: HTMLElement; width: number; height: number; max: number; floating: boolean } | undefined;
  /** A floating picture being dragged to another place on its page. */
  private floatDrag: { pos: Position; x: number; y: number; active: boolean; box: Rect } | undefined;
  private pictureDrag: { from: Position; x: number; y: number; active: boolean; to?: Position } | undefined;
  private dragging = false;
  private touch: { x: number; y: number; moved: boolean; held: boolean; timer: number } | undefined;
  private pinch: { distance: number; zoom: number; frame: number; next: number; x: number; y: number } | undefined;
  private lastTap = { time: 0, x: 0, y: 0, count: 0 };
  /** The handles of the selection: at its anchor and at its focus, and one under the caret. */
  handles!: Record<'anchor' | 'focus' | 'caret', HTMLElement>;
  handleLayer = document.createElement('div');
  private caretHandleUntil = 0;
  private caretHandleTimer = 0;
  /** The page of the section table `table` is in. */
  private pageOfTable(table: number): PageSetup {
    return pageAt(
      this.editor.doc,
      Math.max(
        0,
        this.editor.doc.paragraphs.findIndex((p) => p.cell?.table === table),
      ),
    );
  }

  /** The text box under a point of the window, the one on top when several are, and whether the point is on its edge. */
  private textBoxAt(clientX: number, clientY: number): { page: number; id: string; edge: boolean } | undefined {
    const page = this.pageAt(clientY);
    const boxes = this.editor.layout.pages[page]?.textBoxes;
    if (!boxes?.length) return undefined;
    const rect = this.editor.pageEls[page].getBoundingClientRect();
    const scale = this.editor.setupOf(page).width / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    // Within a few pixels of the line round it, at any zoom.
    const near = 5 * scale;
    const hit = [...boxes].reverse().find(({ frame: f }) => x >= f.x - near && x <= f.x + f.width + near && y >= f.y - near && y <= f.y + f.height + near);
    if (!hit) return undefined;
    const { frame: f } = hit;
    const edge = x < f.x + near || x > f.x + f.width - near || y < f.y + near || y > f.y + f.height - near;
    return { page, id: hit.id, edge };
  }

  /** Which page a point of the window is on, and which part of it: its header, its text or its footer. */
  private zoneAt(clientY: number): { page: number; area: EditArea; note?: string } {
    const page = this.pageAt(clientY);
    if (this.editor.view === 'flow') return { page, area: 'body' };
    const rect = this.editor.pageEls[page].getBoundingClientRect();
    const { height, marginTop, marginBottom } = this.editor.setupOf(page);
    const y = (clientY - rect.top) * (height / rect.height);
    const { header, footer, footnotes, endnotes } = this.editor.layout.pages[page];
    // The notes at the foot of the page, and those at the end, from the line above them down: each as far down as its last line.
    const noteAt = (area: NonNullable<typeof footnotes>) => {
      if (y < area.rule.y || !area.notes.length) return undefined;
      const note = area.notes.find((_, k) => k === area.notes.length - 1 || y < Math.max(...area.notes[k + 1].lines.map((l) => l.y), 0));
      const bottomOf = Math.max(...area.notes.flatMap((n) => n.lines.map((l) => l.y + l.height)));
      return note && y <= bottomOf ? note.id : undefined;
    };
    const atFoot = footnotes && noteAt(footnotes);
    if (atFoot !== undefined) return { page, area: 'footnote', note: atFoot };
    const atEnd = endnotes && noteAt(endnotes);
    if (atEnd !== undefined) return { page, area: 'endnote', note: atEnd };
    // A header taller than its margin reaches as far as its last line, and so does the footer.
    const top = Math.max(marginTop, ...(header?.lines ?? []).map((l) => l.y + l.height));
    const bottom = Math.min(height - marginBottom, ...(footer?.lines ?? []).map((l) => l.y));
    return { page, area: y < top ? 'header' : y >= bottom ? 'footer' : 'body' };
  }

  /** The floating pictures of what is being edited, the text or a header or footer, each with where it is drawn. */
  floats(): { float: FloatBox; box: Rect }[] {
    return this.editor.flow.pages.flatMap((page) =>
      page.floats.map((float) => ({ float, box: { page: this.editor.pageOf(page.index), x: float.x, y: float.y, width: float.width, height: float.height } })),
    );
  }

  /** The floating picture under a point of the window, as the position of its anchor in the text. The one on top, when several are. */
  private floatAtPoint(clientX: number, clientY: number): { pos: Position; box: Rect } | undefined {
    const index = this.editor.area === 'body' ? this.pageAt(clientY) : this.editor.areaPage;
    const rect = this.editor.pageEls[index].getBoundingClientRect();
    const scale = this.editor.setupOf(index).width / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    // Text over a picture that is under it is what the click is for: the picture is taken where it shows by itself.
    const onText = (this.editor.flow.pages[this.editor.area === 'body' ? index : 0]?.lines ?? []).some(
      (line) => y >= line.y && y <= line.y + line.height && line.fragments.some((f) => f.kind === 'text' && f.text.trim() && x >= f.x && x <= f.x + f.width),
    );
    const hit = this.floats()
      .reverse()
      .find(({ box, float }) => box.page === index && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height && !(float.behind && onText));
    return hit && { pos: this.editor.mapOffset({ para: hit.float.para, offset: hit.float.offset }, false), box: hit.box };
  }

  /** The picture under a point of the window, as its position in the text. */
  private pictureAtPoint(clientX: number, clientY: number): Position | undefined {
    const index = this.editor.area === 'body' ? this.pageAt(clientY) : this.editor.areaPage;
    const rect = this.editor.pageEls[index].getBoundingClientRect();
    const scale = this.editor.setupOf(index).width / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    const page = this.editor.flow.pages[this.editor.area === 'body' ? index : 0];
    for (const line of page?.lines ?? []) {
      for (const f of line.fragments) {
        if (f.kind !== 'object' || f.width <= 0) continue;
        const top = line.baseline - f.ascent;
        if (x >= f.x && x <= f.x + f.width && y >= top && y <= top + f.ascent) return this.editor.mapOffset({ para: line.para, offset: f.start }, false);
      }
    }
    return undefined;
  }

  /** The edge of a table column near a point of the window, which can be dragged to make the column wider. */
  private columnEdgeAt(clientX: number, clientY: number): { table: number; boundary: number; scale: number } | undefined {
    if (this.editor.area !== 'body') return undefined;
    const index = this.pageAt(clientY);
    const rect = this.editor.pageEls[index].getBoundingClientRect();
    const scale = this.editor.setupOf(index).width / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    for (const cell of this.editor.layout.pages[index].cells) {
      if (y < cell.y || y > cell.y + cell.height || Math.abs(x - (cell.x + cell.width)) > COLUMN_GRIP * scale) continue;
      const row = this.editor.doc.tables?.[cell.table]?.rows[cell.row];
      if (!row?.cells[cell.cell]) continue;
      let boundary = row.before;
      for (let i = 0; i <= cell.cell; i++) boundary += row.cells[i].span;
      return { table: cell.table, boundary, scale };
    }
    return undefined;
  }

  /** The bottom edge of a table row under the point: dragging it makes the row taller or shorter. */
  private rowEdgeAt(clientX: number, clientY: number): { table: number; row: number; height: number; scale: number } | undefined {
    if (this.editor.area !== 'body') return undefined;
    const index = this.pageAt(clientY);
    const rect = this.editor.pageEls[index].getBoundingClientRect();
    const scale = this.editor.setupOf(index).width / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    const cells = this.editor.layout.pages[index].cells;
    // The last of them: of a table in a cell and the cell, the inner one.
    let edge: { table: number; bottom: number } | undefined;
    for (const cell of cells) {
      if (x < cell.x || x > cell.x + cell.width || Math.abs(y - (cell.y + cell.height)) > COLUMN_GRIP * scale) continue;
      edge = { table: cell.table, bottom: cell.y + cell.height };
    }
    if (!edge) return undefined;
    const { table, bottom } = edge;
    // A cell merged down ends with the last row it covers: the row is the lowest of those ending at the edge.
    const ending = cells.filter((c) => c.table === table && Math.abs(c.y + c.height - bottom) < 0.5);
    const row = Math.max(...ending.map((c) => c.row));
    if (!this.editor.doc.tables?.[table]?.rows[row]) return undefined;
    // As tall as its cells that cover it alone; a cell merged down is taller.
    const height = Math.min(...cells.filter((c) => c.table === table && c.row === row).map((c) => c.height));
    return { table, row, height, scale };
  }

  /** The bottom right corner of a table under the point: dragging it makes the whole table larger or smaller. */
  private tableCornerAt(clientX: number, clientY: number): { table: number; scale: number } | undefined {
    if (this.editor.area !== 'body') return undefined;
    const index = this.pageAt(clientY);
    const rect = this.editor.pageEls[index].getBoundingClientRect();
    const scale = this.editor.setupOf(index).width / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    const corners = new Map<number, { right: number; bottom: number }>();
    for (const cell of this.editor.layout.pages[index].cells) {
      const at = corners.get(cell.table) ?? { right: -Infinity, bottom: -Infinity };
      corners.set(cell.table, { right: Math.max(at.right, cell.x + cell.width), bottom: Math.max(at.bottom, cell.y + cell.height) });
    }
    const grip = TABLE_GRIP * scale;
    let found: number | undefined;
    for (const [table, { right, bottom }] of corners) {
      // The table's last page: the corner is where the table ends.
      if (this.editor.layout.pages.slice(index + 1).some((p) => p.cells.some((c) => c.table === table))) continue;
      if (x >= right - grip && x <= right + grip && y >= bottom - grip && y <= bottom + grip) found = table;
    }
    return found === undefined ? undefined : { table: found, scale };
  }

  /** How tall each row of a table is drawn, over all the pages it is on. */
  private rowHeights(tableIndex: number): number[] {
    const table = this.editor.doc.tables?.[tableIndex];
    if (!table) return [];
    const heights = table.rows.map(() => 0);
    for (const page of this.editor.layout.pages) {
      const least = new Map<number, number>();
      for (const c of page.cells) if (c.table === tableIndex) least.set(c.row, Math.min(least.get(c.row) ?? Infinity, c.height));
      for (const [row, height] of least) heights[row] += height;
    }
    return heights;
  }

  /** The page a point of the window is on, or the nearest one. */
  pageAt(clientY: number): number {
    let index = 0;
    let best = Infinity;
    this.editor.pageEls.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const distance = clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0;
      if (distance < best) {
        best = distance;
        index = i;
      }
    });
    return index;
  }

  positionFromPoint(clientX: number, clientY: number): Position {
    // In a header or footer the point is taken on the page being edited, wherever it is.
    const index = this.editor.area === 'body' ? this.pageAt(clientY) : this.editor.areaPage;
    const rect = this.editor.pageEls[index].getBoundingClientRect();
    const scale = this.editor.setupOf(index).width / rect.width;
    const pos = hitTest(this.editor.flow, this.editor.measurer, this.editor.area === 'body' ? index : 0, (clientX - rect.left) * scale, (clientY - rect.top) * scale);
    return this.editor.mapOffset(pos, false);
  }

  private onMouseDown = (e: MouseEvent): void => {
    this.hideNoteTip();
    if (e.button !== 0) return;
    e.preventDefault();
    this.setByTouch(false);
    this.press(e);
  };

  /** A press on the pages, by the mouse or by a finger: what it selects, or takes hold of. */
  private press(e: Pick<MouseEvent, 'clientX' | 'clientY' | 'detail' | 'shiftKey' | 'target'>): void {
    // A word half written by an on-screen keyboard is left as it is: blurring ends it.
    if (this.editor.composing) this.editor.input.blur();
    this.editor.focus();
    // A corner of the selected picture: dragging it gives the picture another size.
    const corner = (e.target as HTMLElement).closest<HTMLElement>('.dx-objh');
    const picked = corner && this.editor.painter.selectedPicture();
    if (corner && picked) {
      const frame = corner.parentElement as HTMLElement;
      const column = this.editor.textColumn();
      // A floating picture can be as wide as the page; one in the line, as its column.
      const max = picked.floating ? this.editor.setupOf(picked.box.page).width : column.right - column.left;
      this.pictureResize = {
        pos: picked.pos,
        corner: corner.dataset.corner ?? 'se',
        startX: e.clientX,
        box: picked.box,
        frame,
        width: picked.box.width,
        height: picked.box.height,
        max,
        floating: picked.floating,
      };
      return;
    }
    // The corner of a table: dragging it makes the whole table larger or smaller.
    const grip = e.detail === 1 && this.editor.view !== 'flow' ? this.tableCornerAt(e.clientX, e.clientY) : undefined;
    if (grip) {
      const boxes = this.editor.layout.pages[this.pageAt(e.clientY)].cells.filter((c) => c.table === grip.table);
      const pageEl = this.editor.pageEls[this.pageAt(e.clientY)];
      const px = 1 / grip.scale;
      const left = Math.min(...boxes.map((c) => c.x));
      const top = Math.min(...boxes.map((c) => c.y));
      const width = (Math.max(...boxes.map((c) => c.x + c.width)) - left) * px;
      const height = (Math.max(...boxes.map((c) => c.y + c.height)) - top) * px;
      const guide = document.createElement('div');
      guide.className = 'dx-guide-box';
      Object.assign(guide.style, { left: `${pageEl.offsetLeft + left * px}px`, top: `${pageEl.offsetTop + top * px}px`, width: `${width}px`, height: `${height}px` });
      this.editor.pagesEl.appendChild(guide);
      this.tableDrag = { table: grip.table, startX: e.clientX, startY: e.clientY, width, height, guide };
      return;
    }
    // The bottom edge of a table row: dragging it makes the row taller or shorter.
    const rowEdge = e.detail === 1 && this.editor.view !== 'flow' ? this.rowEdgeAt(e.clientX, e.clientY) : undefined;
    if (rowEdge) {
      const guide = document.createElement('div');
      guide.className = 'dx-guide-row';
      const pageEl = this.editor.pageEls[this.pageAt(e.clientY)];
      guide.style.left = `${pageEl.offsetLeft}px`;
      guide.style.width = `${pageEl.offsetWidth}px`;
      guide.style.top = `${e.clientY - this.editor.pagesEl.getBoundingClientRect().top}px`;
      this.editor.pagesEl.appendChild(guide);
      this.rowDrag = { ...rowEdge, startY: e.clientY, guide };
      return;
    }
    // The edge of a table column: dragging it moves the edge.
    const edge = e.detail === 1 && this.editor.view !== 'flow' ? this.columnEdgeAt(e.clientX, e.clientY) : undefined;
    if (edge) {
      const guide = document.createElement('div');
      guide.className = 'dx-guide';
      const pageEl = this.editor.pageEls[this.pageAt(e.clientY)];
      guide.style.top = `${pageEl.offsetTop}px`;
      guide.style.height = `${pageEl.offsetHeight}px`;
      guide.style.left = `${e.clientX - this.editor.pagesEl.getBoundingClientRect().left}px`;
      this.editor.pagesEl.appendChild(guide);
      this.columnDrag = { ...edge, startX: e.clientX, guide };
      return;
    }
    // A click in a text box goes into it, to write in it; one on its edge takes the box itself, to move it or make it larger.
    const box = this.editor.view !== 'flow' ? this.textBoxAt(e.clientX, e.clientY) : undefined;
    if (box && !box.edge) {
      const same = this.editor.area === 'textbox' && this.editor.areaNote === box.id;
      if (!same || this.editor.areaPage !== box.page) this.editor.setArea('textbox', box.page, box.id);
      if (this.editor.area === 'textbox') {
        const pos = this.positionFromPoint(e.clientX, e.clientY);
        if (e.detail === 2) {
          const word = wordRangeAt(this.editor.text, pos);
          this.editor.setSelection(word.from, word.to);
        } else if (e.detail >= 3) {
          this.editor.setSelection({ para: pos.para, offset: 0 }, { para: pos.para, offset: paragraphLength(this.editor.text.paragraphs[pos.para]) });
        } else {
          this.editor.setSelection(e.shiftKey && same ? this.editor.selection.anchor : pos, pos);
          this.dragging = true;
        }
        return;
      }
    }
    // Out of the box, back to the text.
    if (this.editor.area === 'textbox') this.editor.setArea('body');
    const zone = this.zoneAt(e.clientY);
    // A click on a note, at the foot of the page or at the end, goes into it, and one on the text from a note comes back out, as in Word.
    const isNote = (area: EditArea) => area === 'footnote' || area === 'endnote';
    const intoNote = isNote(zone.area) && (this.editor.area !== zone.area || zone.note !== this.editor.areaNote || zone.page !== this.editor.areaPage);
    if (intoNote || (isNote(this.editor.area) && zone.area === 'body')) {
      this.editor.setArea(zone.area, zone.page, zone.note);
      this.editor.setSelection(this.positionFromPoint(e.clientX, e.clientY));
      return;
    }
    if (zone.area !== this.editor.area) {
      // A double click on the header or the footer goes into it, and one on the text comes back out.
      if (e.detail === 2) {
        this.editor.setArea(zone.area, zone.page, zone.note);
        this.editor.setSelection(this.positionFromPoint(e.clientX, e.clientY));
        return;
      }
      if (this.editor.area !== 'body') return;
    } else if (this.editor.area !== 'body' && zone.page !== this.editor.areaPage) {
      this.editor.setArea(this.editor.area, zone.page, zone.note);
    }
    // A click on a picture selects it; dragging from there moves it.
    const picture = e.detail === 1 && !e.shiftKey ? this.pictureAtPoint(e.clientX, e.clientY) : undefined;
    if (picture) {
      this.editor.setSelection(picture, { para: picture.para, offset: picture.offset + 1 });
      if (this.editor.view !== 'flow') this.pictureDrag = { from: picture, x: e.clientX, y: e.clientY, active: false };
      return;
    }
    // A click on a floating picture selects it too; dragging from there moves it about its page.
    const float = e.detail === 1 && !e.shiftKey ? this.floatAtPoint(e.clientX, e.clientY) : undefined;
    if (float) {
      // Its anchor may be lines away from where it is drawn: the view stays on the picture that was clicked.
      const top = this.editor.root.scrollTop;
      this.editor.setSelection(float.pos, { para: float.pos.para, offset: float.pos.offset + 1 });
      this.editor.root.scrollTop = top;
      this.floatDrag = { pos: float.pos, x: e.clientX, y: e.clientY, active: false, box: float.box };
      return;
    }
    const pos = this.positionFromPoint(e.clientX, e.clientY);
    if (e.detail === 2) {
      const word = wordRangeAt(this.editor.text, pos);
      this.editor.setSelection(word.from, word.to);
    } else if (e.detail >= 3) {
      const length = paragraphLength(this.editor.text.paragraphs[pos.para]);
      this.editor.setSelection({ para: pos.para, offset: 0 }, { para: pos.para, offset: length });
    } else {
      this.editor.setSelection(e.shiftKey ? this.editor.selection.anchor : pos, pos);
      this.dragging = true;
    }
  }

  /** The note shown beside the pointer while it is over the text the note is about. */
  private noteTip: HTMLElement | undefined;
  private noteTipFor = '';

  hideNoteTip(): void {
    this.linkTip?.remove();
    this.linkTip = undefined;
    this.noteTip?.remove();
    this.noteTip = undefined;
    this.noteTipFor = '';
  }

  /** The table of contents of the document it was last looked for in. */
  private tocSeen: { doc: Doc; range: ReturnType<typeof tocRange> } | undefined;
  /** The pointer is a hand over an entry of the table of contents, which a click follows. */
  private hoverLink(e: MouseEvent): void {
    let link = false;
    if (this.editor.area === 'body' && !e.buttons && e.target instanceof Node && this.editor.pagesEl.contains(e.target)) {
      if (this.tocSeen?.doc !== this.editor.doc) this.tocSeen = { doc: this.editor.doc, range: tocRange(this.editor.doc) };
      const range = this.tocSeen.range;
      if (range) {
        const para = this.positionFromPoint(e.clientX, e.clientY).para;
        link = para >= range.first && para <= range.last && tocTarget(this.editor.doc, para) !== undefined;
      }
    }
    // A link out of the document says where it goes; it is followed with the command key held, as in Word.
    const out = e.buttons ? undefined : this.linkUnder(e);
    this.showLinkTip(out, e);
    this.editor.pagesEl.classList.toggle('dx-over-link', link || (out !== undefined && (e.metaKey || e.ctrlKey)));
  }

  /** Where the link under the pointer goes. The text lets the mouse through, so it is found by where it is. */
  private linkUnder(e: MouseEvent): string | undefined {
    if (!(e.target instanceof Node) || !this.editor.pagesEl.contains(e.target)) return undefined;
    for (const part of this.editor.pagesEl.querySelectorAll<HTMLElement>('[data-href]')) {
      const r = part.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return part.dataset.href;
    }
    return undefined;
  }

  private linkTip: HTMLElement | undefined;

  private showLinkTip(href: string | undefined, e: MouseEvent): void {
    if (href === undefined) {
      this.linkTip?.remove();
      this.linkTip = undefined;
      return;
    }
    if (this.linkTip?.dataset.href !== href) {
      this.linkTip?.remove();
      const tip = document.createElement('div');
      tip.className = 'dx-note-tip dx-link-tip';
      tip.setAttribute('role', 'tooltip');
      tip.dataset.href = href;
      const address = document.createElement('div');
      address.textContent = href;
      const how = document.createElement('div');
      how.className = 'dx-note-by';
      how.textContent = t('link.follow', { key: MOD_KEY });
      speaks(how);
      tip.append(address, how);
      applyTheme(tip, this.editor.themeName);
      document.body.appendChild(tip);
      this.linkTip = tip;
    }
    const tip = this.linkTip!;
    const { width, height } = tip.getBoundingClientRect();
    const below = e.clientY + 18;
    tip.style.left = `${Math.max(8, Math.min(e.clientX + 10, window.innerWidth - width - 8))}px`;
    tip.style.top = `${below + height > window.innerHeight - 8 ? Math.max(8, e.clientY - height - 10) : below}px`;
  }

  /** Shows the note whose text is under the pointer, or puts it away when there is none there. */
  private hoverNote(e: MouseEvent): void {
    // The marks let the mouse through to the text, so they are found by where they are.
    let id: string | undefined;
    let size = Infinity;
    if (!e.buttons && e.target instanceof Node && this.editor.pagesEl.contains(e.target)) {
      for (const mark of this.editor.pagesEl.querySelectorAll<HTMLElement>('.dx-note')) {
        const r = mark.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
        // Inside another, the smaller one is the one meant.
        const whole = [...this.editor.pagesEl.querySelectorAll<HTMLElement>(`.dx-note[data-note="${mark.dataset.note}"]`)].reduce((sum, part) => sum + part.offsetWidth, 0);
        if (whole < size) {
          size = whole;
          id = mark.dataset.note;
        }
      }
    }
    const note = id === undefined ? undefined : this.editor.doc.notes?.find((other) => other.id === id);
    if (!note) {
      this.hideNoteTip();
      return;
    }
    if (this.noteTipFor !== note.id) {
      this.hideNoteTip();
      const tip = document.createElement('div');
      tip.className = 'dx-note-tip';
      tip.setAttribute('role', 'tooltip');
      tip.style.borderLeftColor = `#${note.color ?? NOTE_COLORS[0]}`;
      const by = document.createElement('div');
      by.className = 'dx-note-by';
      by.textContent = note.author;
      const text = document.createElement('div');
      text.textContent = note.text;
      tip.append(by, text);
      applyTheme(tip, this.editor.themeName);
      document.body.appendChild(tip);
      this.noteTip = tip;
      this.noteTipFor = note.id;
    }
    // Under the pointer, or above it where there is no room below; never off the window.
    const tip = this.noteTip!;
    const { width, height } = tip.getBoundingClientRect();
    const below = e.clientY + 18;
    tip.style.left = `${Math.max(8, Math.min(e.clientX + 10, window.innerWidth - width - 8))}px`;
    tip.style.top = `${below + height > window.innerHeight - 8 ? Math.max(8, e.clientY - height - 10) : below}px`;
  }

  private onMouseMove = (e: MouseEvent): void => {
    this.hoverNote(e);
    this.hoverLink(e);
    if (this.columnDrag) {
      this.columnDrag.guide.style.left = `${e.clientX - this.editor.pagesEl.getBoundingClientRect().left}px`;
      return;
    }
    if (this.rowDrag) {
      const drag = this.rowDrag;
      // Not above the least a row can be.
      const lowest = drag.startY - (drag.height - MIN_ROW_HEIGHT) / drag.scale;
      drag.guide.style.top = `${Math.max(lowest, e.clientY) - this.editor.pagesEl.getBoundingClientRect().top}px`;
      return;
    }
    if (this.tableDrag) {
      const drag = this.tableDrag;
      drag.guide.style.width = `${Math.max(8, drag.width + e.clientX - drag.startX)}px`;
      drag.guide.style.height = `${Math.max(8, drag.height + e.clientY - drag.startY)}px`;
      return;
    }
    if (this.pictureResize) {
      // The corner follows the pointer sideways; the picture keeps its proportions, and the corner across stays put.
      const drag = this.pictureResize;
      const { box } = drag;
      const moved = ((e.clientX - drag.startX) / (PT_TO_PX * this.editor.zoom)) * (drag.corner.includes('e') ? 1 : -1);
      drag.width = Math.max(MIN_PICTURE, Math.min(box.width + moved, drag.max));
      drag.height = (drag.width * box.height) / box.width;
      Object.assign(drag.frame.style, {
        width: `${drag.width}pt`,
        height: `${drag.height}pt`,
        left: `${drag.corner.includes('w') ? box.x + box.width - drag.width : box.x}pt`,
        top: `${drag.corner.includes('n') ? box.y + box.height - drag.height : box.y}pt`,
      });
      return;
    }
    if (this.floatDrag) {
      const drag = this.floatDrag;
      if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_START) return;
      drag.active = true;
      // Its frame follows the pointer; the picture goes there when it is let go.
      const frame = this.editor.root.querySelector<HTMLElement>('.dx-objsel');
      const scale = 1 / (PT_TO_PX * this.editor.zoom);
      if (frame) Object.assign(frame.style, { left: `${drag.box.x + (e.clientX - drag.x) * scale}pt`, top: `${drag.box.y + (e.clientY - drag.y) * scale}pt` });
      return;
    }
    if (this.pictureDrag) {
      const drag = this.pictureDrag;
      if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_START) return;
      drag.active = true;
      // The caret shows where the picture will go.
      drag.to = this.positionFromPoint(e.clientX, e.clientY);
      this.editor.painter.placeCaret(drag.to, true);
      return;
    }
    if (!this.dragging) {
      // Over the edge of a column the pointer says it can be dragged.
      const on = this.editor.view !== 'flow' && this.editor.pagesEl.contains(e.target as Node);
      const corner = on && !!this.tableCornerAt(e.clientX, e.clientY);
      const row = on && !corner && !!this.rowEdgeAt(e.clientX, e.clientY);
      this.editor.pagesEl.classList.toggle('dx-table-resize', corner);
      this.editor.pagesEl.classList.toggle('dx-row-resize', row);
      this.editor.pagesEl.classList.toggle('dx-col-resize', on && !corner && !row && !!this.columnEdgeAt(e.clientX, e.clientY));
      return;
    }
    const pos = this.positionFromPoint(e.clientX, e.clientY);
    if (comparePositions(pos, this.editor.selection.focus) !== 0) this.editor.setSelection(this.editor.selection.anchor, pos);
  };

  private onMouseUp = (e: MouseEvent): void => {
    // A plain click on an entry of the table of contents, not a drag over it, goes to its heading.
    const clicked = this.dragging && this.editor.collapsed && this.editor.area === 'body' && !e.shiftKey;
    this.dragging = false;
    const heading = clicked ? tocTarget(this.editor.doc, this.editor.selection.focus.para) : undefined;
    if (heading !== undefined) this.editor.goToHeading(heading);
    // With the command key held, a click on a link opens what it goes to.
    const out = this.editor.collapsed && (e.metaKey || e.ctrlKey) && !e.shiftKey && e.button === 0 ? this.linkUnder(e) : undefined;
    if (out !== undefined) this.editor.openLink(out);
    if (this.rowDrag) {
      const { table, row, height, startY, scale, guide } = this.rowDrag;
      this.rowDrag = undefined;
      guide.remove();
      const doc = resizeRow(this.editor.doc, table, row, height + (e.clientY - startY) * scale);
      if (doc !== this.editor.doc) this.editor.commitDoc(doc, this.editor.selection);
      return;
    }
    if (this.tableDrag) {
      const { table, startX, startY, width, height, guide } = this.tableDrag;
      this.tableDrag = undefined;
      guide.remove();
      const laidOut = this.editor.doc.tables?.[table];
      if (!laidOut) return;
      const { width: pageWidth, marginLeft, marginRight } = this.pageOfTable(table);
      const columns = tableGeometry(laidOut, pageWidth - marginLeft - marginRight).columns;
      const scaleX = Math.max(8, width + e.clientX - startX) / width;
      const scaleY = Math.max(8, height + e.clientY - startY) / height;
      const doc = resizeTable(this.editor.doc, table, columns, scaleX, this.rowHeights(table), scaleY);
      if (doc !== this.editor.doc) this.editor.commitDoc(doc, this.editor.selection);
      return;
    }
    if (this.columnDrag) {
      const { table, boundary, startX, scale, guide } = this.columnDrag;
      this.columnDrag = undefined;
      guide.remove();
      const { width, marginLeft, marginRight } = this.pageOfTable(table);
      const laidOut = this.editor.doc.tables?.[table];
      if (!laidOut) return;
      const columns = tableGeometry(laidOut, width - marginLeft - marginRight).columns;
      const doc = resizeColumn(this.editor.doc, table, boundary, (e.clientX - startX) * scale, columns);
      if (doc !== this.editor.doc) this.editor.commitDoc(doc, this.editor.selection);
      return;
    }
    if (this.pictureResize) {
      const { pos, width, height, box, floating, corner } = this.pictureResize;
      this.pictureResize = undefined;
      if (Math.abs(width - box.width) < 0.5) this.editor.painter.renderSelection();
      else if (!floating) this.editor.commit(resizePicture(this.editor.text, pos, width, height), this.editor.selection);
      // The corner across from the one dragged stays where it was.
      else
        this.editor.commit(
          moveFloat(resizeFloat(this.editor.text, pos, width, height), pos, corner.includes('w') ? box.width - width : 0, corner.includes('n') ? box.height - height : 0),
          this.editor.selection,
        );
      return;
    }
    if (this.floatDrag) {
      const { pos, x, y, active, box } = this.floatDrag;
      this.floatDrag = undefined;
      const scale = 1 / (PT_TO_PX * this.editor.zoom);
      if (!active) {
        this.editor.painter.renderSelection();
        return;
      }
      const dx = (e.clientX - x) * scale;
      const dy = (e.clientY - y) * scale;
      // Let go over another paragraph of the text, it is anchored there from then on, as in Word: it goes
      // with that paragraph, and to its page. Where it is drawn is where it was let go.
      const to = this.positionFromPoint(e.clientX, e.clientY);
      const target = this.editor.text.paragraphs[to.para];
      if (to.para !== pos.para && target) {
        const from = this.editor.pageEls[box.page].getBoundingClientRect();
        // A header or a footer is that of the page it is being edited on.
        const page = this.editor.area === 'body' ? this.pageAt(e.clientY) : this.editor.areaPage;
        const onto = this.editor.pageEls[page].getBoundingClientRect();
        // Where its corner was let go, in the coordinates of the page it is over.
        const wanted = { x: box.x + dx + (from.left - onto.left) * scale, y: box.y + dy + (from.top - onto.top) * scale };
        const anchored = reanchorFloat(this.editor.text, pos, outsideField(this.editor.text, { para: to.para, offset: 0 }));
        // Put where it was let go; the text going round it may move its paragraph, so it is tried again until it stays.
        let placed = anchored.doc;
        for (let pass = 0; pass < 4; pass++) {
          const now = this.editor.floatBoxIn(placed, anchored.pos);
          if (!now || now.page !== page || (Math.abs(wanted.x - now.x) < 0.5 && Math.abs(wanted.y - now.y) < 0.5)) break;
          placed = moveFloat(placed, anchored.pos, wanted.x - now.x, wanted.y - now.y);
        }
        if (anchored.doc !== this.editor.text) {
          this.editor.commit(placed, { anchor: anchored.pos, focus: { para: anchored.pos.para, offset: anchored.pos.offset + 1 } });
          return;
        }
      }
      const moved = moveFloat(this.editor.text, pos, dx, dy);
      if (moved !== this.editor.text) this.editor.commit(moved, this.editor.selection);
      else this.editor.painter.renderSelection();
      return;
    }
    if (this.pictureDrag) {
      const { from, to, active } = this.pictureDrag;
      this.pictureDrag = undefined;
      const moved = active && to ? movePicture(this.editor.text, from, outsideField(this.editor.text, to)) : undefined;
      if (moved && moved.doc !== this.editor.text) this.editor.commit(moved.doc, { anchor: moved.pos, focus: { para: moved.pos.para, offset: moved.pos.offset + 1 } });
      else this.editor.painter.renderSelection();
    }
  };

  private setByTouch(on: boolean): void {
    if (on === this.editor.byTouch) return;
    this.editor.byTouch = on;
    this.editor.root.classList.toggle('dx-touch', on);
    this.renderHandles();
  }

  handle(end: 'anchor' | 'focus' | 'caret'): HTMLElement {
    const el = document.createElement('div');
    el.className = 'dx-handle';
    this.handleLayer.appendChild(el);
    /** How far the finger is from the line of text the handle hangs under. */
    let lift = 0;
    let held = false;
    /** Whether the drag moved what the handle hangs under: one that did not was a tap on it. */
    let moved = false;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      held = true;
      moved = false;
      const box = el.getBoundingClientRect();
      lift = e.clientY - box.top + (parseFloat(el.dataset.line ?? '0') || 0) / 2;
    });
    el.addEventListener('pointermove', (e) => {
      if (!held) return;
      // Near the top or the bottom of the window, the document moves under the finger.
      const bounds = this.editor.root.getBoundingClientRect();
      const bottom = bounds.bottom - keyboardInset(this.editor.root);
      if (e.clientY < bounds.top + HANDLE_SCROLL_EDGE) this.editor.root.scrollTop -= HANDLE_SCROLL_STEP;
      else if (e.clientY > bottom - HANDLE_SCROLL_EDGE) this.editor.root.scrollTop += HANDLE_SCROLL_STEP;
      const pos = this.positionFromPoint(e.clientX, e.clientY - lift);
      const { anchor, focus } = this.editor.selection;
      const next = end === 'caret' ? { anchor: pos, focus: pos } : end === 'anchor' ? { anchor: pos, focus } : { anchor, focus: pos };
      // Its two ends never meet: a selection of nothing would lose the handle being dragged.
      if (end !== 'caret' && comparePositions(next.anchor, next.focus) === 0) return;
      if (comparePositions(next.anchor, anchor) === 0 && comparePositions(next.focus, focus) === 0) return;
      moved = true;
      this.caretHandleUntil = Date.now() + CARET_HANDLE_MS;
      this.editor.selection = next;
      this.editor.goalX = null;
      this.editor.pendingProps = null;
      this.editor.painter.renderSelection();
      this.editor.emit();
    });
    const done = (e: PointerEvent) => {
      if (!held) return;
      held = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (end !== 'caret') return this.editor.onTouchSelect?.();
      this.showCaretHandle();
      // A tap on the handle of the caret: what can be done there, Paste first, as a phone offers it.
      if (!moved) this.editor.onTouchSelect?.();
    };
    el.addEventListener('pointerup', done);
    el.addEventListener('pointercancel', done);
    return el;
  }

  /** Shows the handle under the caret for a while: what a tap does, so the caret can be put exactly. */
  private showCaretHandle(): void {
    this.caretHandleUntil = Date.now() + CARET_HANDLE_MS;
    window.clearTimeout(this.caretHandleTimer);
    this.caretHandleTimer = window.setTimeout(() => this.renderHandles(), CARET_HANDLE_MS + 20);
    this.renderHandles();
  }

  /** Puts the handles where the selection is: under each of its ends, or under the caret after a tap. */
  renderHandles(): void {
    const scale = PT_TO_PX * this.editor.zoom;
    const put = (el: HTMLElement, pos: Position | undefined) => {
      el.classList.toggle('dx-on', !!pos);
      if (!pos) return;
      const caret = caretRect(this.editor.flow, this.editor.measurer, this.editor.mapOffset(pos, true));
      const pageEl = this.editor.pageEls[this.editor.pageOf(caret.page)];
      el.style.left = `${pageEl.offsetLeft + caret.x * scale}px`;
      el.style.top = `${pageEl.offsetTop + (caret.y + caret.height) * scale}px`;
      el.dataset.line = String(caret.height * scale);
    };
    const ranged = this.editor.byTouch && !this.editor.collapsed && !this.editor.painter.selectedPicture();
    put(this.handles.anchor, ranged ? this.editor.selection.anchor : undefined);
    put(this.handles.focus, ranged ? this.editor.selection.focus : undefined);
    put(this.handles.caret, this.editor.byTouch && this.editor.collapsed && Date.now() < this.caretHandleUntil ? this.editor.selection.focus : undefined);
  }

  private onTouchStart = (e: TouchEvent): void => {
    this.setByTouch(true);
    this.hideNoteTip();
    window.clearTimeout(this.touch?.timer);
    this.touch = undefined;
    // A handle is dragged by itself; a note in the margin and the button of the contents take the tap as a click.
    if ((e.target as HTMLElement).closest('.dx-handle, .dx-mnote, .dx-toc-chip')) return;
    if (e.touches.length === 2) {
      // Two fingers change the size of what is shown, here and not in the browser.
      e.preventDefault();
      this.touch = undefined;
      const [a, b] = [e.touches[0], e.touches[1]];
      this.pinch = {
        distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
        zoom: this.editor.zoom,
        frame: 0,
        next: this.editor.zoom,
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
      };
      return;
    }
    if (e.touches.length !== 1) return;
    const { clientX: x, clientY: y } = e.touches[0];
    const target = e.target;
    const timer = window.setTimeout(() => {
      const touch = this.touch;
      if (!touch || touch.moved) return;
      // Held still: the word under the finger, which is then dragged out from.
      touch.held = true;
      this.press({ clientX: x, clientY: y, detail: 2, shiftKey: false, target });
      this.onMouseUp(new MouseEvent('mouseup'));
      navigator.vibrate?.(10);
    }, HOLD_MS);
    this.touch = { x, y, moved: false, held: false, timer };
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (this.pinch && e.touches.length === 2) {
      e.preventDefault();
      const pinch = this.pinch;
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch.next = (pinch.zoom * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)) / pinch.distance;
      // The two fingers also carry the pages with them, as a sheet of paper under them would go.
      const x = (a.clientX + b.clientX) / 2;
      const y = (a.clientY + b.clientY) / 2;
      this.editor.root.scrollLeft -= x - pinch.x;
      this.editor.root.scrollTop -= y - pinch.y;
      pinch.x = x;
      pinch.y = y;
      // Once a frame: with the text as wide as the window, every size is laid out again.
      pinch.frame ||= requestAnimationFrame(() => {
        pinch.frame = 0;
        this.editor.zoomAt(pinch.next, pinch.x, pinch.y);
      });
      return;
    }
    const touch = this.touch;
    if (!touch || e.touches.length !== 1) return;
    const { clientX, clientY } = e.touches[0];
    if (touch.held) {
      // After a hold, the finger draws the selection out; the window does not scroll under it.
      e.preventDefault();
      const pos = this.positionFromPoint(clientX, clientY);
      if (comparePositions(pos, this.editor.selection.focus) !== 0 && comparePositions(pos, this.editor.selection.anchor) !== 0) this.editor.setSelection(this.editor.selection.anchor, pos);
      return;
    }
    if (Math.hypot(clientX - touch.x, clientY - touch.y) > TOUCH_SLOP) {
      touch.moved = true;
      window.clearTimeout(touch.timer);
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (this.pinch && e.touches.length < 2) {
      cancelAnimationFrame(this.pinch.frame);
      this.editor.zoomAt(this.pinch.next, this.pinch.x, this.pinch.y);
      this.pinch = undefined;
      this.editor.emit();
      e.preventDefault();
      return;
    }
    const touch = this.touch;
    this.touch = undefined;
    if (!touch) return;
    window.clearTimeout(touch.timer);
    if (touch.moved && !touch.held) return;
    // The browser would follow this with the clicks of a mouse it makes up: it is dealt with here.
    e.preventDefault();
    if (touch.held) {
      this.editor.onTouchSelect?.();
      return;
    }
    const now = Date.now();
    const again = now - this.lastTap.time < TAP_AGAIN_MS && Math.hypot(touch.x - this.lastTap.x, touch.y - this.lastTap.y) < TAP_AGAIN_PX;
    const count = again ? this.lastTap.count + 1 : 1;
    this.lastTap = { time: now, x: touch.x, y: touch.y, count };
    /** Where the caret was, when the document had it: a tap on it again offers what can be done there. */
    const caret = this.editor.collapsed && document.activeElement === this.editor.input ? this.editor.selection.focus : undefined;
    this.press({ clientX: touch.x, clientY: touch.y, detail: count, shiftKey: false, target: e.target });
    this.onMouseUp(new MouseEvent('mouseup'));
    if (!this.editor.collapsed) this.editor.onTouchSelect?.();
    else {
      this.showCaretHandle();
      // A tap on a word spelled wrong offers what it could be, as a phone does.
      if (count === 1 && this.editor.misspelling) this.editor.onSpellingMenu?.();
      else if (count === 1 && caret && comparePositions(caret, this.editor.selection.focus) === 0) this.editor.onTouchSelect?.();
    }
  };

  private onTouchCancel = (): void => {
    window.clearTimeout(this.touch?.timer);
    this.touch = undefined;
    if (this.pinch) cancelAnimationFrame(this.pinch.frame);
    this.pinch = undefined;
  };
}
