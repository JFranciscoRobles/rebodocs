// What the editor draws: the pages near the view, each with its lines, cells,
// pictures, text boxes and the bars beside tracked changes, the notes in the
// margin; and over the pages the selection, the caret, the others' carets and
// the marks of what is found, of variables and of words spelled wrong. Pages
// far from the view are boxes of their size, drawn when they come near.

import {
  type Story,
  type Doc,
  type Fragment,
  type CellBox,
  type Band,
  type FloatBox,
  type Line,
  type Turn,
  type Position,
  type Range,
  type Rect,
  bandLayout,
  caretRect,
  clampPosition,
  comparePositions,
  createLayoutCache,
  docImage,
  embeddedFonts,
  tocRange,
  type EndnotePart,
  type FootnotePart,
  type StoryPart,
  storyKind,
  type TextBoxBand,
  type TextBoxPart,
  textBoxId,
  storyOf,
  splitPart,
  storyPart,
  floatAt,
  linkHref,
  NOTE_COLORS,
  noteRanges,
  editableRanges,
  findBlockMarks,
  findVariables,
  layoutDocument,
  layoutReflow,
  mapFieldOffset,
  orderedRange,
  pictureAt,
  selectionRects,
  storyOnPage,
  type Border,
  type LayoutPage,
  boxLines,
  noteRules,
} from '@rebodocs/core/internal';
import { t } from './i18n';
import { keyboardInset } from './platform';
import { cssFont } from './measurer';
import { inkOn } from './theme';
import { type Editor, NOTE_MARGIN, PT_TO_PX, SCROLL_MARGIN, ownStory } from './editor';

/** How far into the left margin, in points, the bar beside a line with a tracked change goes. */
const CHANGE_BAR_GAP = 14;
/** With the text as wide as the window: the room on each side of it, in points. */
const FLOW_MARGIN = 12;
/** The most places a search finds that are marked on the pages at once. */
const MAX_FIND_MARKS = 400;

/** The variables of a header, a footer or a note as a page shows it, kept while it is the same: every page draws them again. */
const shownVariables = new WeakMap<Story['paragraphs'], { range: Range }[]>();

/** The variables of paragraphs `first` to `last` only: each is inside one paragraph, and the others are on pages not drawn. */
function variablesIn(story: Pick<Doc, 'paragraphs'>, [first, last]: [number, number]): { range: Range }[] {
  const some = { paragraphs: story.paragraphs.slice(first, last + 1) };
  const back = (pos: Position): Position => ({ ...pos, para: pos.para + first });
  return [...findVariables(some), ...findBlockMarks(some)].map(({ range }) => ({ range: { from: back(range.from), to: back(range.to) } }));
}

function variablesOf(story: Pick<Doc, 'paragraphs'>): { range: Range }[] {
  let found = shownVariables.get(story.paragraphs);
  if (!found) shownVariables.set(story.paragraphs, (found = [...findVariables(story), ...findBlockMarks(story)]));
  return found;
}

export class Painter {
  constructor(private readonly editor: Editor) {}

  private marginEls: HTMLElement[] = [];
  /** Inside each page element, what holds its contents at their real size, scaled by the zoom. */
  sheetEls: HTMLElement[] = [];
  private selLayers: HTMLElement[] = [];
  /** What each page element currently shows: the line boxes and where they sit, and the table cells. */
  painted: ({ lines: { raw: object; y: number; turn?: Turn }[]; cells: CellBox[]; floats: number; rules: string } | undefined)[] = [];

  /**
   * The pages that have their text in the page, from the first to the last: those in view and a screen
   * either side. The others are boxes of their size, empty until they come near, so a long document
   * costs what the part of it in view costs.
   */
  private drawn: [number, number] = [0, -1];
  /** Every page drawn, whatever is in view: to print them. */
  drawAll = false;
  scrollFrame = 0;
  /** Object URLs of the pictures of the loaded document, by the part they are in and their XML. */
  private imageUrls = new Map<string, string | null>();
  /** Fonts the loaded document carries with it, registered with the page while it is open. */
  fontFaces: FontFace[] = [];

  render(): void {
    if (this.editor.view === 'flow') {
      this.editor.flowWidth = this.editor.windowWidth();
      this.editor.layout = layoutReflow(this.editor.shown, this.editor.measurer, { width: this.editor.flowWidth, margin: FLOW_MARGIN }, this.editor.flowCache);
    } else {
      this.editor.layout = layoutDocument(this.editor.shown, this.editor.measurer, this.editor.layoutCache);
    }
    // The page may have changed size under a zoom that follows the window.
    if (this.editor.fit) this.editor.zoom = this.editor.clampZoom(this.editor.fitZoom(this.editor.fit));
    this.paint();
  }

  /** Which pages are in view, with a screen above and below; all of them when there is no view to go by. */
  private pagesInView(): [number, number] {
    const last = this.editor.pageEls.length - 1;
    const view = this.editor.root.getBoundingClientRect();
    if (this.drawAll || view.height === 0 || last < 0) return [0, last];
    const top = view.top - view.height;
    const bottom = view.bottom + view.height;
    let first = -1;
    let end = -1;
    // From the top down: pages go down the window in their order, or row by row side by side.
    for (let i = 0; i <= last; i++) {
      const rect = this.editor.pageEls[i].getBoundingClientRect();
      if (rect.bottom < top) continue;
      if (rect.top > bottom) break;
      if (first < 0) first = i;
      end = i;
    }
    return first < 0 ? [0, -1] : [first, end];
  }

  private isDrawn(page: number): boolean {
    return page >= this.drawn[0] && page <= this.drawn[1];
  }

  /** Scrolling brings other pages near: they are drawn, and the ones gone far are emptied. */
  onScroll = (): void => {
    if (this.scrollFrame) return;
    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = 0;
      const [first, last] = this.pagesInView();
      if (first === this.drawn[0] && last === this.drawn[1]) return;
      this.paint();
      this.renderSelection();
    });
  };
  /** Puts the text of the pages near the view in them, and takes it out of the others. */
  paint(): void {
    const { pages } = this.editor.layout;
    while (this.editor.pageEls.length > pages.length) {
      this.editor.pageEls.pop()!.remove();
      this.sheetEls.pop();
      this.selLayers.pop();
    }
    this.painted.length = Math.min(this.painted.length, pages.length);
    // Every page in its place and at its size first: which are in view depends on it.
    pages.forEach((_, i) => {
      let el = this.editor.pageEls[i];
      if (!el) {
        el = document.createElement('div');
        el.className = 'dx-page';
        // Positioned pieces of text a screen reader cannot follow: what the caret meets is said instead.
        el.setAttribute('aria-hidden', 'true');
        this.editor.pagesEl.insertBefore(el, this.editor.input);
        const sheet = document.createElement('div');
        sheet.className = 'dx-sheet';
        el.appendChild(sheet);
        this.editor.pageEls.push(el);
        this.sheetEls.push(sheet);
        this.selLayers.push(document.createElement('div'));
      }
      this.editor.sizePage(i);
    });
    this.drawn = this.pagesInView();
    pages.forEach((layoutPage, i) => {
      if (!this.isDrawn(i)) {
        // Far from the view: an empty sheet, drawn again when it comes near.
        if (this.painted[i]) this.sheetEls[i].replaceChildren(this.selLayers[i]);
        this.painted[i] = undefined;
        return;
      }

      // A page whose lines are the same boxes at the same place already shows them.
      // Everything the page shows: its header, its text and its footer.
      // Text boxes under the text first, the others over it, after everything else.
      const boxes = layoutPage.textBoxes ?? [];
      const parts: { name: 'header' | 'body' | 'footer' | 'footnote' | 'textbox'; band: Band | LayoutPage | undefined }[] = [
        ...boxes.filter((box) => box.behind).map((band) => ({ name: 'textbox' as const, band })),
        ...(['header', 'body', 'footer'] as const).map((name) => ({ name, band: name === 'body' ? layoutPage : layoutPage[name] })),
        ...(layoutPage.footnotes?.notes ?? []).map((band) => ({ name: 'footnote' as const, band })),
        // Those at the end are painted as those at the foot of the page are.
        ...(layoutPage.endnotes?.notes ?? []).map((band) => ({ name: 'footnote' as const, band })),
        ...boxes.filter((box) => !box.behind).map((band) => ({ name: 'textbox' as const, band })),
      ];
      const bands = parts.map((part) => part.band).filter((band) => band !== undefined);
      const lines = bands.flatMap((band) => band.lines);
      const cells = bands.flatMap((band) => band.cells);
      const floats = bands.flatMap((band) => band.floats);
      const before = this.painted[i];
      if (
        before?.lines.length === lines.length &&
        before.cells.length === cells.length &&
        before.floats === floats.length &&
        lines.every((l, k) => l.raw === before.lines[k].raw && l.y === before.lines[k].y && l.turn?.x === before.lines[k].turn?.x && l.turn?.y === before.lines[k].turn?.y) &&
        cells.every((c, k) => {
          const was = before.cells[k];
          return c.y === was.y && c.height === was.height && c.x === was.x && c.width === was.width && c.borders === was.borders && c.shade === was.shade && c.lines === was.lines;
        }) &&
        JSON.stringify([layoutPage.rules ?? [], noteRules(layoutPage), layoutPage.frames ?? [], boxes.map((box) => [box.frame, box.look])]) === before.rules
      ) {
        return;
      }
      this.painted[i] = {
        lines: lines.map((l) => ({ raw: l.raw, y: l.y, turn: l.turn })),
        cells,
        floats: floats.length,
        rules: JSON.stringify([layoutPage.rules ?? [], noteRules(layoutPage), layoutPage.frames ?? [], boxes.map((box) => [box.frame, box.look])]),
      };

      const sheet = document.createDocumentFragment();
      // Each part in a box of its own, so the ones not being edited can be dimmed.
      for (const { name, band } of parts) {
        if (!band) continue;
        const content = document.createElement('div');
        content.className = `dx-band dx-band-${name}`;
        // A text box: what fills it and the line round it, centred on its edge as in Word.
        if (name === 'textbox') {
          const { frame, look } = band as TextBoxBand;
          const edge = look.line?.width ?? 0;
          const node = document.createElement('div');
          node.className = 'dx-textbox';
          node.dataset.box = (band as TextBoxBand).id;
          Object.assign(node.style, {
            left: `${frame.x - edge / 2}pt`,
            top: `${frame.y - edge / 2}pt`,
            width: `${frame.width + edge}pt`,
            height: `${frame.height + edge}pt`,
            background: look.fill ? `#${look.fill}` : 'transparent',
            border: look.line ? `${edge}pt solid #${look.line.color}` : '0',
          });
          content.appendChild(node);
        }
        // The pictures that go under the text first; the ones over it, once it is drawn. A text box is not one: it was drawn above.
        for (const float of band.floats) if (float.behind && textBoxId(float.xml) === undefined) content.appendChild(this.pictureElement(float.xml, float, float.part));
        for (const cell of band.cells) {
          const box = document.createElement('div');
          const sides = boxLines(cell);
          const whole = !!(sides.top && sides.right && sides.bottom && sides.left);
          // A cell without borders shows where it is with a faint line, which is not part of the document.
          box.className = !cell.lines && cell.borders ? 'dx-cell dx-cell-lines' : whole ? 'dx-cell' : 'dx-cell dx-cell-guide';
          if (cell.shade) box.style.background = `#${cell.shade}`;
          box.style.left = `${cell.x}pt`;
          box.style.top = `${cell.y}pt`;
          box.style.width = `${cell.width}pt`;
          box.style.height = `${cell.height}pt`;
          content.appendChild(box);
          if (cell.lines) content.appendChild(this.cellLinesElement(cell));
        }
        // The line round a table whose cells stand apart.
        for (const frame of (band as LayoutPage).frames ?? []) content.appendChild(this.cellLinesElement({ ...frame, row: -1, cell: -1, borders: true }));
        // The line above the notes at the foot of the page, and the one above those at the end.
        for (const notesRule of noteRules(band as LayoutPage)) {
          const line = document.createElement('div');
          line.className = 'dx-notes-rule';
          Object.assign(line.style, { left: `${notesRule.x}pt`, top: `${notesRule.y}pt`, width: `${notesRule.width}pt`, height: `${notesRule.height}pt` });
          content.appendChild(line);
        }
        // The lines down between the columns of a section.
        for (const rule of (band as LayoutPage).rules ?? []) {
          const line = document.createElement('div');
          line.className = 'dx-rule';
          line.style.left = `${rule.x - 0.25}pt`;
          line.style.top = `${rule.top}pt`;
          line.style.height = `${rule.bottom - rule.top}pt`;
          content.appendChild(line);
        }
        /** The text set vertically of each cell: turned about its corner, and cut to its cell. */
        const turned = new Map<Turn, HTMLElement>();
        const holder = (line: Line): HTMLElement => {
          const cell = line.turn && line.cell !== undefined ? band.cells[line.cell] : undefined;
          if (!line.turn || !cell) return content;
          let inner = turned.get(line.turn);
          if (!inner) {
            const clip = document.createElement('div');
            clip.className = 'dx-turn';
            Object.assign(clip.style, { left: `${cell.x}pt`, top: `${cell.y}pt`, width: `${cell.width}pt`, height: `${cell.height}pt` });
            inner = document.createElement('div');
            inner.className = 'dx-turn';
            // Placed back at the corner of the page, so that what it holds is in page coordinates.
            Object.assign(inner.style, { left: `${-cell.x}pt`, top: `${-cell.y}pt`, transformOrigin: `${line.turn.x}pt ${line.turn.y}pt`, transform: `rotate(${line.turn.angle}deg)` });
            clip.appendChild(inner);
            content.appendChild(clip);
            turned.set(line.turn, inner);
          }
          return inner;
        };
        // A line with a tracked change has a bar beside it in the margin, as in Word: one that only
        // put in or took out a paragraph mark has nothing else to show it by.
        const paragraphsOf = name === 'body' ? this.editor.shown.paragraphs : (band as Band).part ? storyOf(this.editor.shown, (band as Band).part!)?.paragraphs : undefined;
        const barAt = this.editor.setupOf(i).marginLeft - CHANGE_BAR_GAP;
        for (const line of band.lines) {
          const into = holder(line);
          const para = paragraphsOf?.[line.para];
          if (!line.turn && (line.fragments.some((f) => f.props.revision || f.props.formatChange) || para?.props.formatChange || (line.lastInParagraph && para?.props.markRevision))) {
            const bar = document.createElement('div');
            bar.className = 'dx-change-bar';
            Object.assign(bar.style, { left: `${barAt}pt`, top: `${line.y}pt`, height: `${line.height}pt` });
            content.appendChild(bar);
          }
          if (line.label) into.appendChild(this.textElement(line.label, line));
          for (const f of line.fragments) {
            if (f.mark) {
              // The number of a note: smaller, and raised.
              into.appendChild(this.textElement({ ...f, kind: 'text', text: f.mark.text, font: f.mark.font, wordSpacing: 0 }, { ...line, baseline: line.baseline - f.mark.rise }));
            } else if (f.kind === 'object' && f.width > 0 && textBoxId(f.props.object) === undefined) {
              const box = { x: f.x, y: line.baseline - f.ascent, width: f.width, height: f.ascent };
              into.appendChild(this.pictureElement(f.props.object, box, name === 'body' ? undefined : ((band as Band).part ?? (name as 'header' | 'footer'))));
            } else if (f.kind === 'text') {
              into.appendChild(this.textElement(f, line));
            } else if (f.leader) {
              into.appendChild(this.textElement({ ...f, kind: 'text', ...f.leader, wordSpacing: 0 }, line));
            }
          }
        }
        for (const float of band.floats) if (!float.behind && textBoxId(float.xml) === undefined) content.appendChild(this.pictureElement(float.xml, float, float.part));
        sheet.appendChild(content);
      }
      // The selection and the other marks go over everything, and darken what is under them as a marker pen
      // does: under the text they would be hidden by a letterhead that covers the page, or by text with a
      // background of its own, white included.
      sheet.appendChild(this.selLayers[i]);
      this.sheetEls[i].replaceChildren(sheet);
    });
  }

  /** The lines of a cell that has its own, each side with its line, centred on the edge of the cell. */
  private cellLinesElement(cell: CellBox): HTMLElement {
    const sides = boxLines(cell);
    const room = (line: Border | undefined) => (!line ? 0 : line.style === 'double' ? line.width * 3 : line.width);
    const [top, right, bottom, left] = [sides.top, sides.right, sides.bottom, sides.left].map(room);
    const node = document.createElement('div');
    node.className = 'dx-cell';
    const s = node.style;
    s.left = `${cell.x - left / 2}pt`;
    s.top = `${cell.y - top / 2}pt`;
    s.width = `${cell.width + (left + right) / 2}pt`;
    s.height = `${cell.height + (top + bottom) / 2}pt`;
    for (const [side, line] of Object.entries(sides) as [string, Border][]) {
      // CSS draws a double line as two in a border three times as thick as each.
      s.setProperty(`border-${side}`, `${Math.max(0.5, room(line))}pt ${line.style === 'single' ? 'solid' : line.style} #${line.color}`);
    }
    return node;
  }

  private textElement(f: Fragment, line: Line): HTMLElement {
    const span = document.createElement('span');
    span.className = 'dx-frag';
    span.textContent = f.text;
    const s = span.style;
    s.font = cssFont(f.font);
    // Painted kerned where it was measured so, the letters where the layout put them.
    if (f.font.kern) s.fontKerning = 'normal';
    s.lineHeight = `${f.ascent + f.descent}pt`;
    s.left = `${f.x}pt`;
    s.top = `${line.baseline - f.ascent}pt`;
    s.color = `#${f.props.color}`;
    if (f.props.highlight) s.backgroundColor = `#${f.props.highlight}`;
    const decoration = `${f.props.underline ? 'underline ' : ''}${f.props.strike ? 'line-through' : ''}`.trim();
    if (decoration) s.textDecoration = decoration;
    if (f.wordSpacing) s.wordSpacing = `${f.wordSpacing}pt`;
    const href = linkHref(f.props);
    if (href !== undefined) span.dataset.href = href;
    return span;
  }

  /** The picture of an object, at `box` in page coordinates. `part` is where the object lives, when not in the body. */
  private pictureElement(xml: string, box: Pick<FloatBox, 'x' | 'y' | 'width' | 'height'>, part?: FloatBox['part']): HTMLElement {
    const key = `${part ?? ''}\n${xml}`;
    let url = this.imageUrls.get(key);
    if (url === undefined) {
      const image = docImage(this.editor.doc, xml, part);
      url = image ? URL.createObjectURL(new Blob([image.bytes as BlobPart], { type: image.type })) : null;
      this.imageUrls.set(key, url);
    }
    // Pictures in a format the browser cannot show keep their place as an empty box.
    const el = document.createElement(url ? 'img' : 'div');
    if (url) (el as HTMLImageElement).src = url;
    el.className = 'dx-object';
    el.style.left = `${box.x}pt`;
    el.style.top = `${box.y}pt`;
    el.style.width = `${box.width}pt`;
    el.style.height = `${box.height}pt`;
    return el;
  }

  /**
   * Registers the fonts embedded in the document that this machine lacks, then
   * lays the document out again: until they load, their text is measured and
   * painted with a stand-in.
   */
  loadEmbeddedFonts(): void {
    for (const face of this.fontFaces) document.fonts.delete(face);
    this.fontFaces = [];
    const { source } = this.editor.doc;
    if (!source) return;
    const faces = embeddedFonts(source)
      .filter((font) => !this.editor.measurer.hasFont(font.family))
      .map(
        (font) =>
          new FontFace(font.family, font.bytes.buffer as ArrayBuffer, {
            weight: font.bold ? 'bold' : 'normal',
            style: font.italic ? 'italic' : 'normal',
          }),
      );
    if (!faces.length) return;
    void Promise.allSettled(faces.map((face) => face.load())).then((results) => {
      // Another document may have been opened while these were loading.
      if (this.editor.doc.source !== source) return;
      results.forEach((result, i) => {
        if (result.status !== 'fulfilled') return;
        document.fonts.add(faces[i]);
        this.fontFaces.push(faces[i]);
      });
      if (this.fontFaces.length) this.refont();
    });
  }

  /** Lays the document out again from nothing: the fonts behind the names of its text are no longer the same. */
  refont(): void {
    this.editor.measurer.reset();
    this.editor.layoutCache = createLayoutCache();
    this.editor.flowCache = createLayoutCache();
    this.editor.pagedView = undefined;
    this.painted = [];
    this.render();
    this.renderSelection();
    this.editor.emit();
  }

  releaseImages(): void {
    for (const url of this.imageUrls.values()) if (url) URL.revokeObjectURL(url);
    this.imageUrls.clear();
  }

  /**
   * The notes beside the pages, each level with the text it is about and
   * pushed down where the one above leaves no room: the margin Word shows
   * its comments in.
   */
  private renderMargin(): void {
    const on = this.editor.showNotes && this.editor.view !== 'grid' && this.editor.view !== 'flow' && this.editor.area === 'body';
    this.editor.root.classList.toggle('dx-notes-on', on);
    this.editor.pageEls.forEach((page, i) => {
      page.style.marginRight = on ? `${NOTE_MARGIN * this.editor.zoom}pt` : '';
      let margin = this.marginEls[i];
      if (!on) {
        margin?.remove();
        delete this.marginEls[i];
        return;
      }
      if (!margin?.isConnected) {
        margin = document.createElement('div');
        margin.className = 'dx-margin';
        page.appendChild(margin);
        this.marginEls[i] = margin;
      }
      margin.style.width = `${NOTE_MARGIN}pt`;
      margin.style.transform = this.editor.zoom === 1 ? '' : `scale(${this.editor.zoom})`;
      margin.replaceChildren();
    });
    this.marginEls.length = Math.min(this.marginEls.length, this.editor.pageEls.length);
    if (!on || !this.editor.doc.notes?.length) return;
    const active = this.editor.activeNote;
    const byId = new Map(this.editor.doc.notes.map((note) => [note.id, note]));
    const flow = this.editor.flow;
    /** Where the next note of each page can start, in pixels from its top. */
    const free: number[] = [];
    const paras = this.drawnParas();
    for (const { id, range } of noteRanges(this.editor.doc)) {
      // The card of a note on a page not drawn waits until the page comes near.
      if (paras && (this.editor.mapOffset(range.to, true).para < paras[0] || this.editor.mapOffset(range.from, true).para > paras[1])) continue;
      const note = byId.get(id);
      // A note is level with where its text starts; one on no text at all, with where it is.
      const at =
        selectionRects(flow, this.editor.measurer, { from: this.editor.mapOffset(range.from, true), to: this.editor.mapOffset(range.to, true) })[0] ??
        caretRect(flow, this.editor.measurer, this.editor.mapOffset(range.from, true));
      const margin = note && at && this.isDrawn(this.editor.pageOf(at.page)) && this.marginEls[this.editor.pageOf(at.page)];
      if (!note || !margin) continue;
      const page = this.editor.pageOf(at.page);
      const card = document.createElement('div');
      card.className = id === active ? 'dx-mnote dx-on' : 'dx-mnote';
      card.dataset.note = id;
      card.style.borderLeftColor = `#${note.color ?? NOTE_COLORS[0]}`;
      const by = document.createElement('div');
      by.className = 'dx-mnote-by';
      by.textContent = note.author;
      const text = document.createElement('div');
      text.className = 'dx-mnote-text';
      text.textContent = note.text;
      card.append(by, text);
      // A press on it is not a press on the page: the caret stays until the note is chosen.
      card.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      card.addEventListener('click', () => {
        this.editor.selectNote(id);
        this.editor.focus();
      });
      margin.appendChild(card);
      const top = Math.max(at.y * PT_TO_PX - 2, free[page] ?? 0);
      card.style.top = `${top}px`;
      free[page] = top + card.offsetHeight + 6;
    }
  }

  /** A small button over the table of contents, at the right of its first line, that brings it up to date. */
  private renderTocChip(): void {
    if (this.editor.area !== 'body' || this.editor.locked) return;
    const range = tocRange(this.editor.doc);
    if (!range) return;
    const at = caretRect(this.editor.flow, this.editor.measurer, this.editor.mapOffset({ para: range.first, offset: 0 }, true));
    const chip = document.createElement('div');
    chip.className = 'dx-toc-chip';
    chip.dataset.name = 'toc-update';
    chip.setAttribute('role', 'button');
    chip.textContent = `↻ ${t('toc.update')}`;
    chip.style.right = `${this.editor.setupOf(at.page).marginRight}pt`;
    chip.style.top = `${at.y - 19}pt`;
    // A press on it is not a press on the page.
    chip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    chip.addEventListener('click', () => {
      this.editor.updateToc();
      this.editor.focus();
    });
    this.selLayers[this.editor.pageOf(at.page)].appendChild(chip);
  }

  /** Draws the mark under a word spelled wrong, on the pages drawn. */
  underline(range: Range): void {
    for (const rect of selectionRects(this.editor.flow, this.editor.measurer, range)) {
      if (!this.isDrawn(rect.page)) continue;
      const div = document.createElement('div');
      div.className = 'dx-spell';
      div.style.left = `${rect.x}pt`;
      div.style.top = `${rect.y + rect.height - 3}pt`;
      div.style.width = `${rect.width}pt`;
      this.selLayers[rect.page].appendChild(div);
    }
  }

  /** The paragraphs of the body the drawn pages show, first and last, as the pages show them; undefined when that is not known. */
  private drawnParas(): [number, number] | undefined {
    if (this.editor.area !== 'body') return undefined;
    let first = Infinity;
    let last = -Infinity;
    for (let i = this.drawn[0]; i <= this.drawn[1]; i++) {
      for (const line of this.editor.layout.pages[i]?.lines ?? []) {
        first = Math.min(first, line.para);
        last = Math.max(last, line.para);
      }
    }
    return first <= last ? [first, last] : undefined;
  }

  /** @internal */ renderSelection(): void {
    // The view may have moved under a change of zoom or of view: the pages near it are drawn first.
    const near = this.pagesInView();
    if (near[0] !== this.drawn[0] || near[1] !== this.drawn[1]) this.paint();
    for (const layer of this.selLayers) if (layer.firstChild) layer.replaceChildren();
    const paras = this.drawnParas();
    /** Whether a stretch of the body, given as the document has it, is on no page drawn: nothing to mark for it. */
    const away = (range: { from: Position; to: Position }) => !!paras && (this.editor.mapOffset(range.to, true).para < paras[0] || this.editor.mapOffset(range.from, true).para > paras[1]);
    // The text box being written in shows where its edges are.
    for (const node of this.editor.pagesEl.querySelectorAll<HTMLElement>('.dx-textbox')) node.classList.toggle('dx-on', this.editor.area === 'textbox' && node.dataset.box === this.editor.areaNote);
    const { from, to } = this.editor.range;
    const flow = this.editor.flow;
    for (const rect of selectionRects(flow, this.editor.measurer, { from: this.editor.mapOffset(from, true), to: this.editor.mapOffset(to, true) })) {
      if (!this.isDrawn(this.editor.pageOf(rect.page))) continue;
      const div = document.createElement('div');
      div.className = 'dx-sel';
      div.style.left = `${rect.x}pt`;
      div.style.top = `${rect.y}pt`;
      div.style.width = `${rect.width}pt`;
      div.style.height = `${rect.height}pt`;
      this.selLayers[this.editor.pageOf(rect.page)].appendChild(div);
    }
    // The variables of a template stand out from the text around them, in the part being edited and in the others the pages show.
    const markVariable = (rect: Rect, page: number) => {
      if (!this.isDrawn(page)) return;
      const div = document.createElement('div');
      div.className = 'dx-var';
      div.style.left = `${rect.x}pt`;
      div.style.top = `${rect.y}pt`;
      div.style.width = `${rect.width}pt`;
      div.style.height = `${rect.height}pt`;
      this.selLayers[page]?.prepend(div);
    };
    for (const variable of paras ? variablesIn(this.editor.text, paras) : variablesOf(this.editor.text)) {
      if (away(variable.range)) continue;
      for (const rect of selectionRects(flow, this.editor.measurer, { from: this.editor.mapOffset(variable.range.from, true), to: this.editor.mapOffset(variable.range.to, true) }))
        markVariable(rect, this.editor.pageOf(rect.page));
    }
    this.editor.spelling.mark(paras);
    if (this.editor.view !== 'flow')
      this.editor.layout.pages.forEach((page, i) => {
        if (!this.isDrawn(i)) return;
        const bands: ['header' | 'footer' | FootnotePart | EndnotePart | TextBoxPart, StoryPart][] = [
          ['header', storyPart(this.editor.paged, 'header', i)],
          ['footer', storyPart(this.editor.paged, 'footer', i)],
          ...(page.footnotes?.notes ?? []).map((note): [FootnotePart | EndnotePart, StoryPart] => [note.part, note.part]),
          ...(page.endnotes?.notes ?? []).map((note): [FootnotePart | EndnotePart, StoryPart] => [note.part, note.part]),
          ...(page.textBoxes ?? []).map((box): [TextBoxPart, StoryPart] => [box.part, box.part]),
        ];
        for (const [key, part] of bands) {
          if (part === this.editor.part && (i === this.editor.areaPage || ownStory(this.editor.area))) continue;
          const story = storyOf(this.editor.shown, part);
          const band = story && bandLayout(this.editor.layout, key, i);
          if (!band) continue;
          const shown = storyOnPage(story, i + 1, this.editor.pageCount);
          for (const variable of variablesOf(shown)) {
            if (band.paraFirstLine[variable.range.from.para] === undefined) continue;
            for (const rect of selectionRects(band, this.editor.measurer, variable.range)) markVariable(rect, i);
          }
        }
      });
    // The text each note is about, and more so the one the caret is in.
    if (this.editor.area === 'body' && this.editor.doc.notes?.length) {
      const active = this.editor.activeNote;
      const colors = new Map(this.editor.doc.notes.map((note) => [note.id, note.color ?? NOTE_COLORS[0]]));
      for (const note of noteRanges(this.editor.doc)) {
        const color = colors.get(note.id);
        if (!color || away(note.range)) continue;
        const rgb = [0, 2, 4].map((i) => parseInt(color.slice(i, i + 2), 16)).join(',');
        for (const rect of selectionRects(flow, this.editor.measurer, { from: this.editor.mapOffset(note.range.from, true), to: this.editor.mapOffset(note.range.to, true) })) {
          if (!this.isDrawn(this.editor.pageOf(rect.page))) continue;
          const div = document.createElement('div');
          div.className = note.id === active ? 'dx-note dx-note-on' : 'dx-note';
          div.dataset.note = note.id;
          div.style.background = `rgba(${rgb},${note.id === active ? 0.4 : 0.2})`;
          div.style.borderBottomColor = `rgba(${rgb},.85)`;
          div.style.left = `${rect.x}pt`;
          div.style.top = `${rect.y}pt`;
          div.style.width = `${rect.width}pt`;
          div.style.height = `${rect.height}pt`;
          this.selLayers[this.editor.pageOf(rect.page)].prepend(div);
        }
      }
    }
    // The stretches that may be changed while the document is restricted; an empty one, a box as wide as a few letters, to be seen and pressed.
    if (this.editor.area === 'body') {
      for (const field of editableRanges(this.editor.doc)) {
        if (away(field.range)) continue;
        const from = this.editor.mapOffset(field.range.from, true);
        const to = this.editor.mapOffset(field.range.to, true);
        const empty = comparePositions(from, to) === 0;
        const rects = empty ? [{ ...caretRect(flow, this.editor.measurer, from), width: 18 }] : selectionRects(flow, this.editor.measurer, { from, to });
        for (const rect of rects) {
          const page = this.editor.pageOf(rect.page);
          if (!this.isDrawn(page)) continue;
          const div = document.createElement('div');
          div.className = empty ? 'dx-field dx-field-empty' : 'dx-field';
          div.style.left = `${rect.x}pt`;
          div.style.top = `${rect.y}pt`;
          div.style.width = `${rect.width}pt`;
          div.style.height = `${rect.height}pt`;
          this.selLayers[page].prepend(div);
        }
      }
    }
    // Every place the search finds, under the selection; past a few hundred they stop being told apart anyway.
    for (const match of this.editor.found.slice(0, MAX_FIND_MARKS)) {
      if (this.editor.area === 'body' && away(match)) continue;
      for (const rect of selectionRects(flow, this.editor.measurer, { from: this.editor.mapOffset(match.from, true), to: this.editor.mapOffset(match.to, true) })) {
        if (!this.isDrawn(this.editor.pageOf(rect.page))) continue;
        const div = document.createElement('div');
        div.className = 'dx-find';
        div.style.left = `${rect.x}pt`;
        div.style.top = `${rect.y}pt`;
        div.style.width = `${rect.width}pt`;
        div.style.height = `${rect.height}pt`;
        this.selLayers[this.editor.pageOf(rect.page)].prepend(div);
      }
    }
    // A selected picture gets a frame with a handle on each corner, to drag it to another size.
    const picture = this.selectedPicture();
    if (picture) {
      const frame = document.createElement('div');
      frame.className = 'dx-objsel';
      frame.style.left = `${picture.box.x}pt`;
      frame.style.top = `${picture.box.y}pt`;
      frame.style.width = `${picture.box.width}pt`;
      frame.style.height = `${picture.box.height}pt`;
      // Its size and its place are those it has on its page, and are changed there.
      for (const corner of this.editor.view === 'flow' ? [] : ['nw', 'ne', 'sw', 'se']) {
        const handle = document.createElement('div');
        handle.className = `dx-objh dx-objh-${corner}`;
        handle.dataset.corner = corner;
        frame.appendChild(handle);
      }
      this.selLayers[picture.box.page].appendChild(frame);
    }
    this.renderPeers();
    if (this.editor.area === 'header' || this.editor.area === 'footer') {
      // A line along the edge of what is being edited, with its name.
      const { height, marginTop, marginBottom } = this.editor.setupOf(this.editor.areaPage);
      const lines = flow.lines;
      const y = this.editor.area === 'header' ? Math.max(marginTop, ...lines.map((l) => l.y + l.height)) : Math.min(height - marginBottom, ...lines.map((l) => l.y));
      const edge = document.createElement('div');
      edge.className = `dx-edge dx-edge-${this.editor.area}`;
      edge.style.top = `${y}pt`;
      const label = document.createElement('span');
      // The first page's own says so: it is not the one the other pages show.
      const base = this.editor.part && splitPart(this.editor.part).base;
      const own = base === 'firstHeader' || base === 'firstFooter';
      // In a document of several sections, of which one.
      const section = this.editor.sectionCount > 1 ? ` · ${t('area.section', { n: this.editor.sectionIndex + 1 })}` : '';
      label.textContent = t(this.editor.area === 'header' ? (own ? 'area.firstHeader' : 'area.header') : own ? 'area.firstFooter' : 'area.footer') + section;
      edge.appendChild(label);
      this.selLayers[this.editor.areaPage].appendChild(edge);
    }

    this.renderMargin();
    this.renderTocChip();
    this.placeCaret(this.editor.selection.focus, this.editor.collapsed);
    this.editor.syncMirror();
    this.editor.pointer.renderHandles();

    // Restart the blink so the caret stays solid while it moves.
    this.editor.caretEl.style.animation = 'none';
    void this.editor.caretEl.offsetWidth;
    this.editor.caretEl.style.animation = '';
  }

  /** The carets and selections of the other people on the document, each in its colour and under its name. */
  private renderPeers(): void {
    for (const peer of this.editor.peers) {
      // In a header or a footer, on the page they are editing it on; it is the same on the others.
      const page = Math.max(0, Math.min(peer.page, this.editor.pageCount - 1));
      const kind = peer.part && storyKind(peer.part);
      const own = kind === 'footnote' || kind === 'endnote' || kind === 'textbox';
      const band = peer.part && bandLayout(this.editor.layout, own ? (peer.part as FootnotePart | EndnotePart | TextBoxPart) : (kind as 'header' | 'footer'), page);
      if (peer.part && (!band || (!own && storyPart(this.editor.layout, kind as 'header' | 'footer', page) !== peer.part))) continue;
      const flow = band || this.editor.layout;
      const story = peer.part ? storyOf(this.editor.doc, peer.part) : this.editor.doc;
      if (!story) continue;
      const shown = (pos: Position): Position => {
        const at = clampPosition({ ...this.editor.doc, paragraphs: story.paragraphs }, pos);
        if (!peer.part) return at;
        // The digits of a page number are not the ones the document holds.
        const onPage = storyOnPage(story, page + 1, this.editor.pageCount).paragraphs[at.para];
        const model = story.paragraphs[at.para];
        return onPage && onPage !== model ? { para: at.para, offset: mapFieldOffset(model, onPage, at.offset) } : at;
      };
      const pageOf = (flowPage: number) => (peer.part ? page : flowPage);
      const color = `#${peer.color}`;
      const range = orderedRange(shown(peer.anchor), shown(peer.focus));
      if (comparePositions(range.from, range.to) !== 0) {
        for (const rect of selectionRects(flow, this.editor.measurer, range)) {
          const div = document.createElement('div');
          div.className = 'dx-peer-sel';
          Object.assign(div.style, { left: `${rect.x}pt`, top: `${rect.y}pt`, width: `${rect.width}pt`, height: `${rect.height}pt`, background: color });
          this.selLayers[pageOf(rect.page)]?.prepend(div);
        }
      }
      const caret = caretRect(flow, this.editor.measurer, shown(peer.focus));
      const bar = document.createElement('div');
      bar.className = 'dx-peer';
      Object.assign(bar.style, {
        left: `${caret.x}pt`,
        top: `${caret.y}pt`,
        height: `${caret.height || 1.5}pt`,
        ...(caret.width ? { width: `${caret.width}pt`, marginLeft: '0' } : {}),
        background: color,
      });
      const label = document.createElement('span');
      label.textContent = peer.name || t('collab.someone');
      label.style.background = color;
      // Black on the light ones, white on the dark: the name is read on any of them.
      label.style.color = inkOn(peer.color);
      bar.appendChild(label);
      this.selLayers[pageOf(caret.page)]?.appendChild(bar);
    }
  }

  /** Puts the caret, and the hidden input the keyboard writes to, at a position; `show` says whether it is drawn. */
  /**
   * Where the caret is in what the window scrolls over, in pixels. Read from
   * where it was placed, not from how it is laid out: while the document does
   * not have the keyboard the caret is not shown, and a thing not shown is nowhere.
   */
  caretBox(): { top: number; height: number; left: number } {
    return {
      top: this.editor.pagesEl.offsetTop + (parseFloat(this.editor.caretEl.style.top) || 0),
      height: parseFloat(this.editor.caretEl.style.height) || 0,
      left: this.editor.pagesEl.offsetLeft + (parseFloat(this.editor.caretEl.style.left) || 0),
    };
  }

  /** @internal */ placeCaret(pos: Position, show: boolean): void {
    const caret = caretRect(this.editor.flow, this.editor.measurer, this.editor.mapOffset(pos, true));
    const pageEl = this.editor.pageEls[this.editor.pageOf(caret.page)];
    const scale = PT_TO_PX * this.editor.zoom;
    const left = `${pageEl.offsetLeft + caret.x * scale}px`;
    const top = `${pageEl.offsetTop + caret.y * scale}px`;
    // In text set vertically the caret lies across the line.
    const height = caret.width > 0 ? '1.5px' : `${caret.height * scale}px`;
    const width = caret.width > 0 ? `${caret.width * scale}px` : '';
    Object.assign(this.editor.caretEl.style, { left, top, width, height, visibility: show ? 'visible' : 'hidden' });
    Object.assign(this.editor.input.style, { left, top, height });
  }

  /** Where on its page the picture at a position of the text is drawn. */
  private pictureBox(pos: Position): Rect | undefined {
    const flow = this.editor.flow;
    const shown = this.editor.mapOffset(pos, true);
    for (let i = flow.paraFirstLine[shown.para] ?? flow.lines.length; i < flow.lines.length && flow.lines[i].para === shown.para; i++) {
      const line = flow.lines[i];
      const f = line.fragments.find((fragment) => fragment.kind === 'object' && fragment.width > 0 && fragment.start === shown.offset);
      if (f) return { page: this.editor.pageOf(line.page), x: f.x, y: line.baseline - f.ascent, width: f.width, height: f.ascent };
    }
    return undefined;
  }

  /** The picture the selection is, when it is one picture and nothing else: one in the line, or a floating one. */
  /** @internal */ selectedPicture(): { pos: Position; box: Rect; floating: boolean } | undefined {
    const { from, to } = this.editor.range;
    if (from.para !== to.para || to.offset - from.offset !== 1) return undefined;
    if (pictureAt(this.editor.text, from)) {
      const box = this.pictureBox(from);
      return box && { pos: from, box, floating: false };
    }
    if (!floatAt(this.editor.text, from)) return undefined;
    // With the text set to the window, one that floats on its page is shown in its line.
    if (this.editor.view === 'flow') {
      const box = this.pictureBox(from);
      return box && { pos: from, box, floating: true };
    }
    const shown = this.editor.mapOffset(from, true);
    const found = this.editor.pointer.floats().find(({ float }) => float.para === shown.para && float.offset === shown.offset);
    return found && { pos: from, box: found.box, floating: true };
  }

  scrollCaretIntoView(): void {
    const { top, height, left } = this.caretBox();
    const bottom = top + height;
    // Sideways too, where the page is wider than the window: zoomed in on a phone.
    if (this.editor.root.scrollWidth > this.editor.root.clientWidth + 1) {
      if (left - SCROLL_MARGIN < this.editor.root.scrollLeft) this.editor.root.scrollLeft = left - SCROLL_MARGIN;
      else if (left + SCROLL_MARGIN > this.editor.root.scrollLeft + this.editor.root.clientWidth) this.editor.root.scrollLeft = left + SCROLL_MARGIN - this.editor.root.clientWidth;
    }
    // What an on-screen keyboard covers of the window is not there to see the caret in.
    const seen = this.editor.root.clientHeight - keyboardInset(this.editor.root);
    if (top - SCROLL_MARGIN < this.editor.root.scrollTop) {
      this.editor.root.scrollTop = top - SCROLL_MARGIN;
    } else if (bottom + SCROLL_MARGIN > this.editor.root.scrollTop + seen) {
      this.editor.root.scrollTop = bottom + SCROLL_MARGIN - seen;
    }
  }

  /** The keyboard came up or went away: the caret is kept where it can be seen. */
  onViewport = (): void => {
    if (document.activeElement === this.editor.input) this.scrollCaretIntoView();
  };
}
