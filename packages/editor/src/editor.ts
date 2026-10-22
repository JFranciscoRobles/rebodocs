import {
  type Doc,
  type FindOptions,
  type Fragment,
  type CellBox,
  type Band,
  type FloatBox,
  type Layout,
  type LayoutCache,
  type OutlineItem,
  type Line,
  type Turn,
  type ListKind,
  type PageNumbering,
  type PageSetup,
  type PdfImage,
  type ParagraphStyle,
  type ParagraphProps,
  type Position,
  type Range,
  type Rect,
  type ResolvedParagraphProps,
  type ResolvedRunProps,
  type RunProps,
  adjacentLine,
  applyRunProps,
  autoformat,
  bandLayout,
  canMergeCells,
  canSplitCell,
  caretRect,
  clampPosition,
  comparePositions,
  createDoc,
  createLayoutCache,
  deleteColumn,
  deleteRange,
  deleteRow,
  deleteTable,
  docImage,
  docEnd,
  docStart,
  embeddedFonts,
  exportDocx,
  exportMarkdown,
  exportPdf,
  type ActiveFormat,
  type TocOptions,
  insertToc,
  tocRange,
  tocTarget,
  updateToc,
  type FootnotePart,
  type Paragraph,
  type Run,
  type Story,
  type StoryPart,
  storyKind,
  footnoteIdOf,
  restoreVersion as versionOver,
  type TextBoxBand,
  type TextBoxPart,
  insertTextBox,
  textBoxId,
  textBoxIdOf,
  textParts,
  textBoxPart,
  type RevisionChange,
  type RevisionView,
  acceptRevisions,
  byAuthor,
  decideAllRevisions,
  hasRevisions,
  rejectRevisions,
  revisionAt,
  revisionNow,
  revisionsIn,
  revisionsOf,
  trackDocEdit,
  trackEdit,
  footnoteNumbers,
  footnoteReferenceId,
  altText,
  setAltText,
  hasOwnFirstPage,
  insertFootnote,
  shownFootnotes,
  pageAt,
  hasOwnStories,
  sectionCount,
  sectionIndexOf,
  sectionMarks,
  setOwnFirstPage,
  setOwnStories,
  setSectionPage,
  storyOf,
  footnotePart,
  splitPart,
  textByFamily,
  storySource,
  storyPart,
  withStory,
  floatAt,
  moveFloat,
  resizeFloat,
  type PictureWrap,
  pictureWrap,
  reanchorFloat,
  setPictureWrap,
  cleanHref,
  linkAt,
  linkHref,
  removeLink,
  setLink,
  insertLink,
  NOTE_COLORS,
  addNote,
  setNoteColor,
  noteExcerpt,
  noteRanges,
  notesAt,
  removeNote,
  setNoteText,
  type FormatId,
  type Variable,
  fillVariables,
  findAll,
  findAllVariables,
  documentLanguage,
  findBlockMarks,
  templateBlocks,
  type Block,
  type TemplateData,
  findVariables,
  hitTest,
  importDocx,
  letterheadImage,
  letterheadMargins,
  withLetterheadMargins,
  letterheadOf,
  insertColumn,
  insertFragment,
  imageExtension,
  imageTypeOf,
  insertImage,
  insertRow,
  insertImageGrid,
  insertSignatures,
  insertTable,
  layoutDocument,
  layoutReflow,
  leaveList,
  lineEndOffset,
  lineForPosition,
  mapFieldOffset,
  mergeCells,
  movePicture,
  moveSection,
  listKindAt,
  locateCell,
  moveChar,
  moveWord,
  neighbourCell,
  offsetAtX,
  orderedRange,
  outline,
  outsideField,
  pageNumbering,
  paragraphLength,
  paragraphText,
  paragraphStyles,
  pictureAt,
  propsAt,
  replaceAll,
  replaceRange,
  sectionAt,
  resizeColumn,
  resizeRow,
  setRowHeight,
  resizeTable,
  MIN_ROW_HEIGHT,
  resizePicture,
  resolveParagraph,
  resolveRun,
  runsInRange,
  sameCell,
  selectionRects,
  setCellProps,
  setPageNumbering,
  setParagraphProps,
  setParagraphStyle,
  shiftListLevel,
  type ListStyle,
  listStyleAt,
  setListStyle,
  restartNumbering,
  continueNumbering,
  splitCell,
  splitParagraph,
  storyOnPage,
  styleIdAt,
  tableGeometry,
  setVariableFormat,
  variableFormats,
  variableNames,
  variableText,
  variableNotes,
  variableUses,
  textInRange,
  toggleList,
  wordRangeAt,
  xAtOffset,
  removeLetterhead,
  setLetterhead,
  type Border,
  type CellPatch,
  cellOfTable,
  type LayoutPage,
  type Columns,
  ONE_COLUMN,
  boxLines,
  columnsAt,
  insertColumnBreak,
  insertSectionBreak,
  setColumns,
  setHeaderRow,
  type Clip,
  clipHtml,
  clipOf,
  clipText,
  insertClip,
  parseClip,
  serializeClip,
} from '@rebodocs/core';
import { getLocale, onLocaleChange, speaks, styleName, t, withRegion } from './i18n';
import { dropParagraphDialog } from './paragraphdialog';
import { type Announcer, type Spoken, VISUALLY_HIDDEN, createAnnouncer, injectA11yStyle, installRegionKeys, markRegion, spokenChar, spokenText } from './a11y';
import { clipFromHtml } from './paste';
import { fontFaces, fontFile, onFontsChange } from './fonts';
import { IS_MAC, keyboardInset } from './platform';
import { CanvasMeasurer, cssFont } from './measurer';
import { type SpellChecker, type SpelledWord, wordsToCheck } from './spellcheck';
import { type Theme, applyTheme, inkOn } from './theme';

/** Someone else's caret on the document: who they are, and where their selection is. */
export interface PeerCaret {
  name: string;
  /** Hex RGB without '#'. */
  color: string;
  /** The header or footer it is in, and the page it is being edited on; the text when there is none. */
  part?: StoryPart;
  page: number;
  anchor: Position;
  focus: Position;
}

export interface Selection {
  anchor: Position;
  focus: Position;
}

/** A note as the interface shows it: what it says, and the text it is about. */
export interface NoteView {
  id: string;
  author: string;
  date?: string;
  text: string;
  excerpt: string;
  /** The colour its text is marked with, as hex RGB without '#'. */
  color: string;
}

export type MarkKey = 'bold' | 'italic' | 'underline' | 'strike';

/**
 * How the document is set out: its pages one under another, two across, or
 * as many as fit across; or, in 'flow', not in pages at all: its text as wide
 * as the window, which is how a document is read and written on a phone.
 */
export type ViewMode = 'column' | 'spread' | 'grid' | 'flow';
/** How tracked changes are shown: marked, or the document as it would be with all of them accepted, or with none. */
export type ChangesView = 'all' | 'accepted' | 'original';
/** A zoom that follows the size of the window: the page as wide as it, or the whole page in it. */
export type ZoomFit = 'width' | 'page';

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;

/** What the selection is in and typing goes to: the text of the document, its header or footer, or a note at the foot of a page. */
export type EditArea = 'body' | 'header' | 'footer' | 'footnote' | 'textbox';

interface Snapshot {
  doc: Doc;
  selection: Selection;
  area: EditArea;
  areaPage: number;
  areaNote?: string;
}

const PT_TO_PX = 4 / 3;

function moveOffset(pos: Position, delta: number): Position {
  return { para: pos.para, offset: pos.offset + delta };
}
/** The variables of a header, a footer or a note as a page shows it, kept while it is the same: every page draws them again. */
const shownVariables = new WeakMap<Story['paragraphs'], { range: Range }[]>();
function variablesOf(story: Pick<Doc, 'paragraphs'>): { range: Range }[] {
  let found = shownVariables.get(story.paragraphs);
  if (!found) shownVariables.set(story.paragraphs, (found = [...findVariables(story), ...findBlockMarks(story)]));
  return found;
}

/** The variables of paragraphs `first` to `last` only: each is inside one paragraph, and the others are on pages not drawn. */
function variablesIn(story: Pick<Doc, 'paragraphs'>, [first, last]: [number, number]): { range: Range }[] {
  const some = { paragraphs: story.paragraphs.slice(first, last + 1) };
  const back = (pos: Position): Position => ({ ...pos, para: pos.para + first });
  return [...findVariables(some), ...findBlockMarks(some)].map(({ range }) => ({ range: { from: back(range.from), to: back(range.to) } }));
}

const TYPING_MERGE_MS = 1000;
/** How long after the last key the words not known yet are asked about. */
const SPELL_WAIT_MS = 250;
const SCROLL_MARGIN = 24;
/** How the key that follows a link is written: the command key, or Ctrl where there is none. */
const MOD_KEY = IS_MAC ? '⌘' : 'Ctrl';
/** The space around and between the pages, in CSS pixels; it does not grow with the zoom. */
const PAGE_GAP = 24;
/** The same in a window as narrow as a phone's, where every pixel beside the page is one less of it. */
const NARROW_GAP = 8;
const NARROW_WINDOW = 600;
/** How much of a wheel turn doubles the zoom, with Ctrl or a pinch. */
const WHEEL_ZOOM = 300;
/** The tag on the edge of the header or the footer while it is being edited. */
const MAX_FIND_MARKS = 400;
/** How near the edge of a column, in pixels, the pointer takes hold of it. */
const COLUMN_GRIP = 3;
/** How near the bottom right corner of a table, in pixels, it can be taken to make the whole table larger or smaller. */
const TABLE_GRIP = 6;
/** The smallest a picture is dragged to, in points, and how far a press must move to become a drag. */
const MIN_PICTURE = 8;
const DRAG_START = 4;
/** The longest side, in pixels, a picture keeps in a PDF. */
const MAX_PDF_PIXELS = 2400;
/** How far into the left margin, in points, the bar beside a line with a tracked change goes. */
const CHANGE_BAR_GAP = 14;
const STYLE_ID = 'dx-editor-style';
/**
 * What the hidden field the keyboard writes to always holds, ahead of what is
 * typed: a character that shows nothing. An on-screen keyboard says nothing
 * of a Backspace in an empty field; with this in it, it takes the character
 * away, and that is how the key is known.
 */
const INPUT_MARK = '\u200B';
/** The keys that turn the mode for screen readers on and off, as in Google Docs. */
const READER_KEYS = IS_MAC ? '⌘⌥Z' : 'Ctrl+Alt+Z';
/** How many editors were made, so that the ids of each are its own. */
let editors = 0;
/** A finger held still this long selects the word under it; one that moves this far, in pixels, is scrolling. */
const HOLD_MS = 450;
const TOUCH_SLOP = 10;
/** What this editor puts on the clipboard for itself: the copied text, whole, with its formatting. */
const CLIP_TYPE = 'application/x-rebodocs+json';
/** Taps this close together, in time and in pixels, count as one: the second selects a word, the third a paragraph. */
const TAP_AGAIN_MS = 350;
const TAP_AGAIN_PX = 28;
/** How long the handle under the caret stays after a tap. */
const CARET_HANDLE_MS = 4000;
/** How near the edge of the window, in pixels, dragging a handle scrolls it, and how fast. */
const HANDLE_SCROLL_EDGE = 44;
const HANDLE_SCROLL_STEP = 14;
/** The width, in points, of the margin the notes are shown in beside each page. */
const NOTE_MARGIN = 170;
/** With the text as wide as the window: the room on each side of it, in points, and how far its size goes. */
const FLOW_MARGIN = 12;
const FLOW_MIN_ZOOM = 0.6;
const FLOW_MAX_ZOOM = 3;

const CSS = `
.dx-pages{touch-action:pan-x pan-y;position:relative;display:flex;flex-direction:column;align-items:center;gap:var(--dx-gap,${PAGE_GAP}px);padding:var(--dx-gap,${PAGE_GAP}px);min-width:max-content;box-sizing:border-box}
.dx-pages.dx-spread{display:grid;grid-template-columns:repeat(2,max-content);justify-content:center}
.dx-pages.dx-grid{flex-direction:row;flex-wrap:wrap;justify-content:safe center;align-content:flex-start;min-width:0}
.dx-pages.dx-flow{align-items:flex-start;gap:0;padding:0}
.dx-flow .dx-page{box-shadow:none}
.dx-page{position:relative;flex:none;overflow:hidden;background:#fff;box-shadow:var(--dx-page-shadow,0 1px 2px rgba(47,46,43,.08),0 10px 28px -10px rgba(47,46,43,.22));cursor:text}
.dx-sheet{position:absolute;left:0;top:0;transform-origin:0 0}
.dx-frag{position:absolute;white-space:pre;font-kerning:none;user-select:none;pointer-events:none}
.dx-object{position:absolute;box-sizing:border-box;max-width:none;max-height:none;pointer-events:none;user-select:none}
.dx-object:not(img){border:1px dashed #9aa0ac;background:#f1f2f5}
.dx-cell{position:absolute;box-sizing:border-box;pointer-events:none}
.dx-cell-lines{outline:.5pt solid #000;outline-offset:-.25pt}
.dx-cell-guide{outline:.5pt dashed #a9c3ee;outline-offset:-.25pt}
.dx-rule{position:absolute;border-left:.5pt solid #000;pointer-events:none}
.dx-notes-rule{position:absolute;background:#000;pointer-events:none}
.dx-change-bar{position:absolute;width:1px;background:#5f6470;pointer-events:none}
.dx-textbox{position:absolute;box-sizing:border-box;pointer-events:none}
.dx-textbox.dx-on{outline:1px dashed var(--dx-ui-accent,#0b57d0);outline-offset:2px}
.dx-band{position:absolute;left:0;top:0}
.dx-turn{position:absolute;overflow:hidden}
.dx-turn .dx-turn{overflow:visible;width:0;height:0}
.dx-editing .dx-band{opacity:.4}
.dx-editing-header .dx-band-header,.dx-editing-footer .dx-band-footer{opacity:1}
.dx-edge{position:absolute;left:0;right:0;height:0;border-top:1px dashed var(--dx-ui-accent,#0b57d0);pointer-events:none}
.dx-edge span{position:absolute;left:12pt;padding:1pt 6pt;background:var(--dx-ui-accent,#0b57d0);color:var(--dx-ui-on-accent,#fff);font:8pt/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;white-space:nowrap}
.dx-edge-header span{top:0;border-radius:0 0 3pt 3pt}
.dx-edge-footer span{bottom:1px;border-radius:3pt 3pt 0 0}
.dx-var{position:absolute;border-radius:2pt;background:rgba(11,87,208,.1);box-shadow:inset 0 0 0 .5pt rgba(11,87,208,.45);pointer-events:none}
.dx-find{position:absolute;background:rgba(255,196,0,.45);pointer-events:none}
/* A word spelled wrong: a red wave under it, as every word processor draws it. */
.dx-spell{position:absolute;height:3pt;pointer-events:none;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='3'%3E%3Cpath d='M0 2.5Q1 .5 2 1.5T4 1.5' fill='none' stroke='%23d93025' stroke-width='.8'/%3E%3C/svg%3E") repeat-x left bottom/4pt 3pt}
.dx-note{position:absolute;border-bottom:1.2pt solid;box-sizing:border-box;pointer-events:none}
.dx-over-link .dx-page{cursor:pointer}
.dx-toc-chip{position:absolute;display:inline-flex;align-items:center;gap:3pt;height:15pt;padding:0 6pt;border:1px solid var(--dx-ui-active-line,#a8c7fa);border-radius:8pt;background:var(--dx-ui-bg,#fff);color:var(--dx-ui-accent,#0b57d0);font:8pt/1 system-ui,-apple-system,"Segoe UI",sans-serif;white-space:nowrap;cursor:pointer;user-select:none}
.dx-toc-chip:hover{background:var(--dx-ui-hover,#f3f1ec)}
.dx-notes-on .dx-page{overflow:visible}
.dx-notes-on .dx-sheet{overflow:hidden}
.dx-margin{position:absolute;left:100%;top:0;height:0;transform-origin:0 0;cursor:default}
.dx-mnote{position:absolute;left:8pt;right:6pt;padding:5pt 7pt;border:1px solid var(--dx-ui-line,#e6e3dc);border-left:3pt solid;border-radius:5pt;background:var(--dx-ui-bg,#fff);box-shadow:0 1px 2px rgba(47,46,43,.08);font:8.5pt/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-ink,#2f2e2b);cursor:pointer;user-select:none}
.dx-mnote:hover{box-shadow:0 2px 8px rgba(47,46,43,.16)}
.dx-mnote.dx-on{border-color:var(--dx-ui-accent,#0b57d0);box-shadow:0 2px 10px rgba(11,87,208,.22);z-index:1}
.dx-mnote-by{padding-bottom:1pt;color:var(--dx-ui-muted,#5f5d58);font-size:7.5pt;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dx-mnote-text{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:6;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere}
.dx-mnote.dx-on .dx-mnote-text{-webkit-line-clamp:unset}
.dx-note-tip{position:fixed;z-index:35;max-width:300px;padding:8px 10px;border:1px solid var(--dx-ui-line,#e6e3dc);border-left:4px solid;border-radius:8px;background:var(--dx-ui-bg,#fff);box-shadow:0 6px 20px rgba(47,46,43,.16);font:13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-ink,#2f2e2b);white-space:pre-wrap;overflow-wrap:anywhere;pointer-events:none}
.dx-link-tip{border-left-color:#0563c1;white-space:normal}
.dx-note-by{padding-bottom:2px;color:var(--dx-ui-muted,#5f5d58);font-size:11px;font-weight:600}
.dx-objsel{position:absolute;box-sizing:border-box;border:1px solid var(--dx-ui-accent,#0b57d0);pointer-events:none}
.dx-objh{position:absolute;width:9px;height:9px;margin:-5px;box-sizing:border-box;border:1px solid var(--dx-ui-bg,#fff);border-radius:50%;background:var(--dx-ui-accent,#0b57d0);pointer-events:auto}
.dx-objh-nw{left:0;top:0;cursor:nwse-resize}.dx-objh-se{left:100%;top:100%;cursor:nwse-resize}
.dx-objh-ne{left:100%;top:0;cursor:nesw-resize}.dx-objh-sw{left:0;top:100%;cursor:nesw-resize}
.dx-col-resize .dx-page{cursor:col-resize}
.dx-guide{position:absolute;width:0;border-left:1px dashed var(--dx-ui-accent,#0b57d0);pointer-events:none;z-index:3}
.dx-guide-row{position:absolute;height:0;border-top:1px dashed var(--dx-ui-accent,#0b57d0);pointer-events:none;z-index:3}
.dx-guide-box{position:absolute;border:1px dashed var(--dx-ui-accent,#0b57d0);pointer-events:none;z-index:3}
.dx-row-resize .dx-page{cursor:row-resize}
.dx-table-resize .dx-page{cursor:nwse-resize}
.dx-print{display:none}
@media print{
body>:not(.dx-print){display:none!important}
.dx-print{display:block;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.dx-print-page{position:relative;overflow:hidden;break-after:page;break-inside:avoid}
.dx-print-page:last-child{break-after:auto}
}
.dx-sel{position:absolute;background:var(--dx-selection,rgba(11,87,208,.2));pointer-events:none}
.dx-peer-sel{position:absolute;opacity:.25;pointer-events:none}
.dx-sel,.dx-var,.dx-find,.dx-note,.dx-peer-sel{mix-blend-mode:multiply}
.dx-peer{position:absolute;width:2px;margin-left:-1px;pointer-events:none;z-index:2}
.dx-peer span{position:absolute;left:0;bottom:100%;padding:1pt 4pt;border-radius:3pt 3pt 3pt 0;font:600 7.5pt/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;white-space:nowrap}
.dx-caret{position:absolute;width:1.5px;background:var(--dx-caret,#000);pointer-events:none;display:none}
.dx-focused .dx-caret{display:block;animation:dx-blink 1.06s steps(1) infinite}
.dx-readonly .dx-caret{display:none!important}
@keyframes dx-blink{50%{opacity:0}}
.dx-input{position:absolute;width:1px;height:1em;padding:0;border:0;outline:0;opacity:0;resize:none;overflow:hidden;white-space:pre;pointer-events:none;font-size:16px}
.dx-handles{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.dx-handle{position:absolute;display:none;pointer-events:auto;width:20px;height:20px;margin:3px 0 0 -10px;border-radius:0 50% 50% 50%;background:var(--dx-handle,#0b57d0);transform:rotate(45deg);touch-action:none;z-index:4}
.dx-handle::before{content:"";position:absolute;inset:0 -12px -12px 0}
.dx-touch.dx-focused .dx-handle.dx-on{display:block}
`;

/**
 * What the element the pages are in looks like, for whoever does not say: in
 * a layer, and ahead of every other style of the page, so that any class
 * given to the element wins over it, those of a framework that keeps its own
 * in layers included.
 */
const ROOT_CSS = `@layer dx{.dx-editor{position:relative;overflow:auto;height:100%;background:var(--dx-canvas,#efede8)}}`;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const root = document.createElement('style');
  root.textContent = ROOT_CSS;
  document.head.prepend(root);
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export class Editor {
  doc: Doc;
  selection: Selection = { anchor: docStart(), focus: docStart() };
  layout!: Layout;
  /** How large the pages are shown: 1 is their real size. */
  zoom = 1;
  view: ViewMode = 'column';
  /** Whether the notes are shown in a margin beside the pages. */
  showNotes = false;
  private marginEls: HTMLElement[] = [];
  /** Set while the zoom follows the size of the window. */
  fit: ZoomFit | undefined;
  /** Set while nothing typed or done may change the document. */
  private locked = false;
  /** Set while Delete is being done: a caret goes after what it takes out, which stays while changes are tracked. */
  private forward = false;
  /** Whether typing "# ", "- " or **text** formats as Markdown would. */
  autoformat = true;
  /**
   * Whether a DOCX the editor makes carries the fonts the application gave it
   * that its text is in, for whoever opens it without them: the TrueType ones
   * whose licence lets them be embedded. Whole with true, as Word embeds them;
   * with 'subset', cut down to the characters of the document and of the
   * keyboard, as Word's "Embed only the characters used".
   */
  embedFonts: boolean | 'subset' = true;
  /**
   * The language the text of the document is in, as a tag ('es-MX', 'en-US'):
   * written in the DOCX the editor makes, when the file does not say one
   * already, for spelling and so that Word does not guess it. The language of
   * the interface when not set. A screen reader reads the text in it.
   */
  get language(): string | undefined {
    return this.languageTag;
  }

  set language(tag: string | undefined) {
    this.languageTag = tag;
    this.syncLanguage();
    // Spelled in another language, the words are another matter.
    if (this.speller) this.renderSelection();
  }

  private languageTag: string | undefined;
  /** The language a person chose for the text of this document, which goes into the DOCX over the one the file said. */
  private chosenLanguage: string | undefined;
  /**
   * For a document that says no language: the one of the interface when it
   * was opened. It stays that when the interface changes language later: the
   * text has not changed language.
   */
  private startLanguage = withRegion(getLocale());

  /**
   * Sets the language the text is in, as a person chooses it from the status
   * bar: for spelling in Word, for a screen reader, for how dates and numbers
   * of variables are written. Written into the DOCX the editor makes, over
   * the one the file said.
   */
  setTextLanguage(tag: string): void {
    if (!tag || tag === this.textLanguage) return;
    this.chosenLanguage = tag;
    this.syncLanguage();
    if (this.speller) this.renderSelection();
    this.emit();
  }

  /**
   * The language the text is in, for a screen reader to read it with the
   * right voice: the one chosen, the one set, or the one the file says; for a
   * document that says none, the language of the interface when it was
   * opened. Changing the interface's later does not change it.
   */
  get textLanguage(): string {
    return this.chosenLanguage || this.languageTag || documentLanguage(this.doc) || this.startLanguage;
  }

  /** The field of the document marked with the language of its text, apart from the bars around it. */
  private syncLanguage(): void {
    const lang = this.textLanguage;
    if (this.input && this.input.lang !== lang) this.input.lang = lang;
  }
  /** Where the selection is. In the header or the footer, the commands act on its text. */
  area: EditArea = 'body';
  /** The page whose header or footer shows the caret; every page has the same one. */
  private areaPage = 0;
  /** The note at the foot of the page whose text the caret is in, by its id. */
  private areaNote: string | undefined;
  private textView: { doc: Doc; part: StoryPart; view: Doc } | undefined;
  /** What is being searched for, and where it is found in the text the selection is in. */
  private finding: { query: string; options: FindOptions } | undefined;
  private found: Range[] = [];
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

  private measurer = new CanvasMeasurer();
  private layoutCache: LayoutCache = createLayoutCache();
  /** The lines of the paragraphs at the width of the window, kept apart from those at the width of the page. */
  private flowCache: LayoutCache = createLayoutCache();
  private flowWidth = 0;
  /** The room around and between the pages, in pixels: less of it in a narrow window. */
  private gap = PAGE_GAP;
  /** The pages of the document while it is not shown in them, worked out when something asks. */
  private pagedView: { doc: Doc; layout: Layout } | undefined;
  /** The zoom the pages had before the text was set to the window, to go back to. */
  private pagedZoom: { zoom: number; fit: ZoomFit | undefined } | undefined;
  private root: HTMLElement;
  private pagesEl: HTMLElement;
  private input: HTMLTextAreaElement;
  private caretEl: HTMLElement;
  private pageEls: HTMLElement[] = [];
  /** Inside each page element, what holds its contents at their real size, scaled by the zoom. */
  private sheetEls: HTMLElement[] = [];
  private resizeObserver: ResizeObserver;
  private selLayers: HTMLElement[] = [];
  /** What each page element currently shows: the line boxes and where they sit, and the table cells. */
  private painted: ({ lines: { raw: object; y: number; turn?: Turn }[]; cells: CellBox[]; floats: number; rules: string } | undefined)[] = [];
  /**
   * The pages that have their text in the page, from the first to the last: those in view and a screen
   * either side. The others are boxes of their size, empty until they come near, so a long document
   * costs what the part of it in view costs.
   */
  private drawn: [number, number] = [0, -1];
  // --- Spelling ---
  private speller: SpellChecker | undefined;
  /** What the dictionary said of each word, by the language it was asked in. */
  private spelled = new Map<string, Map<string, boolean>>();
  /** Words seen on the pages drawn and not yet asked about, and whether a question is on its way. */
  private spellWaiting = new Set<string>();
  private spellAsking = false;
  private spellTimer = 0;
  /** Words the person said to leave alone in this document. */
  private spellIgnored = new Set<string>();
  /** The suggestions for each word, once asked. */
  private spellSuggestions = new Map<string, Promise<string[]>>();
  /** Where the caret was left by typing: the word it ends is not marked until it is finished. */
  private typedAt: Position | undefined;
  /** Every page drawn, whatever is in view: to print them. */
  private drawAll = false;
  private scrollFrame = 0;
  /** Object URLs of the pictures of the loaded document, by the part they are in and their XML. */
  private imageUrls = new Map<string, string | null>();
  /** Fonts the loaded document carries with it, registered with the page while it is open. */
  private fontFaces: FontFace[] = [];

  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  /** How many changes the person made, and how many of them were steps of their own to undo. */
  commits = 0;
  steps = 0;
  /**
   * Who undoes in place of the editor, when someone does: with several people
   * on the document, taking a step back must not take back what the others did.
   */
  history: { undo(): void; redo(): void; readonly canUndo: boolean; readonly canRedo: boolean } | undefined;
  /** Where the other people working on the document are. */
  private peers: PeerCaret[] = [];
  private lastEdit = { kind: '', time: 0 };
  /** Formatting toggled with a collapsed selection, applied to the next typed text. */
  private pendingProps: RunProps | null = null;
  /** Column kept while moving vertically. */
  private goalX: number | null = null;
  private composing = false;
  /** Set by the keys of a paste without formatting, for the paste that follows them. */
  private plainPaste = false;
  /** What a screen reader is told. */
  private announcer!: Announcer;
  /** The keys to leave the document, for a screen reader. */
  private hint = document.createElement('div');
  /** How the last key moved the caret, for saying what it moved over. */
  private moved: 'char' | 'word' | 'line' | 'all' | undefined;
  /** The page last said, so that a new one is said once. */
  private spokenPage = -1;
  /**
   * With the mode for screen readers on: the paragraph the caret is in, as the
   * hidden field holds it, and the part of it selected there. Off, the field
   * holds only a mark, and what the caret meets is said by the editor.
   */
  private mirror: { text: string; start: number; end: number } | undefined;
  /** What of the text in the hidden field is already in the document: a word still being composed, as far as it has got. */
  private typed = '';
  /** Where the caret was left by what was typed, which is where the rest of it goes. */
  private typedEnd: Position | undefined;
  private dragging = false;
  /** True from a touch of the screen until the mouse is used: the selection then has handles to drag it by. */
  byTouch = false;
  /** Called when a selection was made by touch, for what offers something to do with it. */
  onTouchSelect: (() => void) | undefined;
  /** Called when a word spelled wrong is pressed with the other button: the caret is in it, for its suggestions to be offered. */
  onSpellingMenu: (() => void) | undefined;
  private touch: { x: number; y: number; moved: boolean; held: boolean; timer: number } | undefined;
  private pinch: { distance: number; zoom: number; frame: number; next: number; x: number; y: number } | undefined;
  private lastTap = { time: 0, x: 0, y: 0, count: 0 };
  /** The handles of the selection: at its anchor and at its focus, and one under the caret. */
  private handles: Record<'anchor' | 'focus' | 'caret', HTMLElement>;
  private handleLayer = document.createElement('div');
  private caretHandleUntil = 0;
  private caretHandleTimer = 0;
  private listeners = new Set<() => void>();
  /** Its own labels over the pages are written again when the language changes. */
  private stopLocale = onLocaleChange(() => {
    this.input.setAttribute('aria-label', t('a11y.document'));
    this.hint.textContent = t('a11y.hint', { reader: READER_KEYS });
    speaks(this.hint);
    this.renderSelection();
  });
  /** A font the application gives changes how wide its text is: everything is measured again. */
  private stopFonts = onFontsChange(() => this.refont());

  constructor(container: HTMLElement, doc: Doc = createDoc()) {
    injectStyle();
    injectA11yStyle();
    this.doc = doc;
    this.root = container;
    this.root.classList.add('dx-editor');

    this.pagesEl = document.createElement('div');
    this.pagesEl.className = 'dx-pages';
    this.input = document.createElement('textarea');
    this.input.className = 'dx-input';
    this.input.setAttribute('autocapitalize', 'off');
    this.input.setAttribute('autocorrect', 'off');
    this.input.spellcheck = false;
    // A screen reader takes the field for the document: what it holds is the editor's, what the caret meets is said.
    this.input.setAttribute('aria-label', t('a11y.document'));
    this.input.setAttribute('aria-multiline', 'true');
    this.caretEl = document.createElement('div');
    this.caretEl.setAttribute('aria-hidden', 'true');
    this.caretEl.className = 'dx-caret';
    this.pagesEl.append(this.input, this.caretEl);
    // In a layer as large as the pages and no larger: a handle at their edge does not make them wider.
    this.handleLayer.className = 'dx-handles';
    this.pagesEl.appendChild(this.handleLayer);
    this.handles = { anchor: this.handle('anchor'), focus: this.handle('focus'), caret: this.handle('caret') };
    this.root.appendChild(this.pagesEl);
    this.announcer = createAnnouncer(this.root);
    // What the keys to leave the document are, said when it is reached.
    this.hint.id = `dx-hint-${++editors}`;
    this.hint.style.cssText = VISUALLY_HIDDEN;
    this.hint.textContent = t('a11y.hint', { reader: READER_KEYS });
    speaks(this.hint);
    this.root.appendChild(this.hint);
    this.syncLanguage();
    this.input.setAttribute('aria-describedby', this.hint.id);
    markRegion(this.root, 'document', () => this.input);
    installRegionKeys();
    this.resetInput();

    this.pagesEl.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    this.input.addEventListener('keydown', this.onKeyDown);
    this.input.addEventListener('input', this.onInput);
    this.input.addEventListener('compositionstart', () => (this.composing = true));
    this.input.addEventListener('compositionend', this.onCompositionEnd);
    this.pagesEl.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.pagesEl.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.pagesEl.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.pagesEl.addEventListener('touchcancel', this.onTouchCancel);
    // Safari's own pinch, which would make the whole page of the browser larger.
    this.pagesEl.addEventListener('gesturestart', (e) => e.preventDefault());
    window.visualViewport?.addEventListener('resize', this.onViewport);
    this.input.addEventListener('copy', this.onCopy);
    this.input.addEventListener('cut', this.onCut);
    this.input.addEventListener('paste', this.onPaste);
    this.input.addEventListener('focus', () => this.root.classList.add('dx-focused'));
    this.input.addEventListener('blur', () => this.root.classList.remove('dx-focused'));
    this.root.addEventListener('wheel', this.onWheel, { passive: false });
    this.root.addEventListener('scroll', this.onScroll, { passive: true });
    this.pagesEl.addEventListener('contextmenu', this.onContextMenu);
    this.resizeObserver = new ResizeObserver(() => {
      this.fitGap();
      if (this.fit) this.applyZoom(this.fitZoom(this.fit));
      // Text as wide as the window is laid out again when the window is another width.
      if (this.view !== 'flow') return;
      if (this.windowWidth() === this.flowWidth) {
        this.pageEls.forEach((_, i) => this.sizePage(i));
        return;
      }
      this.render();
      this.renderSelection();
      this.emit();
    });
    this.resizeObserver.observe(this.root);

    this.fitGap();
    this.render();
    this.renderSelection();
  }

  private fitGap(): void {
    const width = this.root.clientWidth;
    const gap = width > 0 && width < NARROW_WINDOW ? NARROW_GAP : PAGE_GAP;
    if (gap === this.gap) return;
    this.gap = gap;
    this.pagesEl.style.setProperty('--dx-gap', `${gap}px`);
  }

  destroy(): void {
    this.stopLocale();
    this.announcer.destroy();
    dropParagraphDialog(this);
    this.stopFonts();
    this.hideNoteTip();
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.visualViewport?.removeEventListener('resize', this.onViewport);
    window.clearTimeout(this.touch?.timer);
    window.clearTimeout(this.caretHandleTimer);
    if (this.pinch) cancelAnimationFrame(this.pinch.frame);
    this.root.removeEventListener('wheel', this.onWheel);
    this.root.removeEventListener('scroll', this.onScroll);
    cancelAnimationFrame(this.scrollFrame);
    window.clearTimeout(this.spellTimer);
    this.resizeObserver.disconnect();
    this.releaseImages();
    for (const face of this.fontFaces) document.fonts.delete(face);
    this.pagesEl.remove();
    this.root.classList.remove('dx-editor', 'dx-focused', 'dx-touch', 'dx-theme-dark', 'dx-theme-auto');
  }

  private themeName: Theme = 'light';
  /**
   * The colours of the interface: 'light', 'dark', or 'auto' for the one the
   * system is set to. The bars and menus made for this editor take it too,
   * also those shown outside it. The pages stay white, as paper.
   */
  get theme(): Theme {
    return this.themeName;
  }

  set theme(theme: Theme) {
    this.themeName = theme;
    applyTheme(this.root, theme);
    this.emit();
  }

  /** Subscribes to document and selection changes. Returns the unsubscribe function. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  focus(): void {
    this.input.focus({ preventScroll: true });
  }

  /** Says `text` to a screen reader, as the editor says what the keys do: for the bars and panels around it. */
  announce(text: string, urgent = false): void {
    this.announcer.say(text, urgent);
  }

  /**
   * The mode for screen readers: the field that has the keyboard holds the
   * paragraph the caret is in, with the caret and the selection where they
   * are, so that the screen reader reads it with its own commands (the
   * current line, the word, spelling it out) and a braille display shows it.
   * The editor then leaves saying the text to the screen reader, and says
   * only where the caret is: the page, the table, the heading. Off unless
   * set; ⌘⌥Z (Ctrl+Alt+Z elsewhere) turns it on and off.
   */
  get screenReader(): boolean {
    return !!this.mirror;
  }

  set screenReader(on: boolean) {
    if (on === this.screenReader) return;
    this.mirror = on ? { text: '', start: 0, end: 0 } : undefined;
    this.root.classList.toggle('dx-reader', on);
    this.resetInput();
    this.announcer.say(t(on ? 'a11y.readerOn' : 'a11y.readerOff'), true);
    this.emit();
  }

  /** Puts in the hidden field the paragraph the caret is in, and the selection in it, when the mode for screen readers is on. */
  private syncMirror(): void {
    if (!this.mirror || this.composing) return;
    const { anchor, focus } = this.selection;
    const text = paragraphText(this.text.paragraphs[focus.para]);
    // A selection that goes on into other paragraphs is shown as far as the edge of this one.
    const other = anchor.para === focus.para ? anchor.offset : anchor.para < focus.para ? 0 : text.length;
    const start = Math.min(other, focus.offset);
    const end = Math.max(other, focus.offset);
    this.mirror = { text, start, end };
    if (this.input.value !== text) this.input.value = text;
    if (this.input.selectionStart !== start || this.input.selectionEnd !== end) this.input.setSelectionRange(start, end, other > focus.offset ? 'backward' : 'forward');
  }

  /**
   * What was typed in the field while it holds the paragraph: what took the
   * place of the selection there, or, when something else changed, as the
   * corrections of a keyboard do, what differs from what it held.
   */
  private readerInput(): void {
    const mirror = this.mirror;
    if (!mirror || this.composing) return;
    const { text: was, start, end } = mirror;
    const now = this.input.value;
    const kept = was.length - end;
    let added: string;
    if (now.length >= start + kept && now.startsWith(was.slice(0, start)) && now.endsWith(was.slice(end))) {
      added = now.slice(start, now.length - kept);
    } else {
      let from = 0;
      while (from < was.length && from < now.length && was[from] === now[from]) from++;
      let back = 0;
      while (back < was.length - from && back < now.length - from && was[was.length - 1 - back] === now[now.length - 1 - back]) back++;
      const { para } = this.selection.focus;
      this.setSelection({ para, offset: from }, { para, offset: was.length - back });
      added = now.slice(from, now.length - back);
    }
    const entered = added.endsWith('\n');
    if (entered) added = added.slice(0, -1);
    if (added) this.insertText(added);
    else if (!this.collapsed) this.deleteBackward();
    if (entered) this.insertParagraphBreak();
    this.syncMirror();
  }

  /**
   * Whether the document is only to be looked at: it can be selected, copied
   * and moved about, but nothing typed or done changes it, and undoing does
   * nothing. Off unless set.
   */
  get readOnly(): boolean {
    return this.readOnlySet;
  }

  set readOnly(on: boolean) {
    this.readOnlySet = on;
    this.lock();
    this.emit();
  }

  /** Whether it is set to be only looked at, apart from being shown with its changes decided. */
  private readOnlySet = false;

  /** Nothing typed or done changes the document: while it is read only, or shown without its changes. */
  private lock(): void {
    const on = this.readOnlySet || this.changesShown !== 'all';
    this.locked = on;
    this.input.readOnly = on;
    this.root.classList.toggle('dx-readonly', on);
  }

  // --- How the changes are shown --------------------------------------------

  private changesShown: ChangesView = 'all';
  private shownCache?: { doc: Doc; view: ChangesView; shown: Doc };

  /**
   * How the tracked changes are shown: all of them, marked ('all'); the
   * document as it would be with every one accepted ('accepted'), or with
   * none ('original'), as Word's "No Markup" and "Original". Shown so, it is
   * only to be looked at; the changes are still there, in the document.
   */
  get changesView(): ChangesView {
    return this.changesShown;
  }

  setChangesView(view: ChangesView): void {
    if (view === this.changesShown) return;
    this.changesShown = view;
    this.lock();
    this.textView = undefined;
    const shown = this.shown;
    if (this.area !== 'body') this.setArea('body');
    this.selection = { anchor: clampPosition(shown, this.selection.anchor), focus: clampPosition(shown, this.selection.focus) };
    this.render();
    this.renderSelection();
    this.emit();
  }

  /** The document as it is shown: itself, or with its changes decided as `changesView` says. */
  private get shown(): Doc {
    if (this.changesShown === 'all') return this.doc;
    if (this.shownCache?.doc !== this.doc || this.shownCache.view !== this.changesShown) {
      this.shownCache = { doc: this.doc, view: this.changesShown, shown: decideAllRevisions(this.doc, this.changesShown === 'accepted') };
    }
    return this.shownCache.shown;
  }

  // --- Document -----------------------------------------------------------

  load(doc: Doc): void {
    this.releaseImages();
    this.painted = [];
    this.doc = doc;
    this.finding = undefined;
    this.found = [];
    this.area = 'body';
    this.areaPage = 0;
    this.areaNote = undefined;
    this.syncArea();
    this.loadEmbeddedFonts();
    // A language chosen for the document before is not this one's.
    this.chosenLanguage = undefined;
    this.startLanguage = withRegion(getLocale());
    this.syncLanguage();
    this.selection = { anchor: docStart(), focus: docStart() };
    this.undoStack = [];
    this.redoStack = [];
    this.pendingProps = null;
    this.goalX = null;
    this.render();
    this.renderSelection();
    this.root.scrollTop = 0;
    this.emit();
  }

  /**
   * Changes the document as a whole from outside, as one step to undo: what an
   * assistant does to it. With `reveal`, the caret goes there and it is brought
   * into view; without, the selection stays where it was, as far as it still can.
   */
  edit(change: (doc: Doc) => Doc, reveal?: Position): void {
    let doc = change(this.doc);
    if (doc === this.doc) return;
    // While changes are tracked, so are these: word by word, as what is changed at once is read.
    if (this.doc.trackRevisions && doc.trackRevisions) doc = trackDocEdit(this.doc, doc, this.reviser());
    if (this.area !== 'body') this.setArea('body');
    const at = (pos: Position) => clampPosition(doc, pos);
    this.commitDoc(doc, reveal ? { anchor: at(reveal), focus: at(reveal) } : { anchor: at(this.selection.anchor), focus: at(this.selection.focus) });
    if (reveal) this.centerCaret();
  }

  /** Where the selection is: the part when it is a header or a footer, and the page it is being edited on. */
  get place(): { part?: StoryPart; page: number } {
    const part = this.part;
    return part ? { part, page: this.areaPage } : { page: 0 };
  }

  /**
   * Shows another document in place of this one: the same one as someone
   * else, working on it at the same time, left it. Not a step to undo, and
   * what is being looked at stays where it is on the screen, unless `reveal`.
   */
  replace(doc: Doc, selection: Selection, reveal = false): void {
    const before = this.caretBox().top - this.root.scrollTop;
    const inView = before >= 0 && before <= this.root.clientHeight;
    const scroll = this.root.scrollTop;
    this.doc = doc;
    this.selection = selection;
    this.afterDocChange(reveal);
    if (reveal) return;
    // Lines that came or went above the caret would move it under the person's eyes.
    this.root.scrollTop = inView ? scroll + (this.caretBox().top - scroll - before) : scroll;
  }

  /**
   * Puts the caret at `pos` and brings it to the middle of the view: in the
   * text, or with `part` in that header, footer or note, on the first page
   * that shows it.
   */
  goTo(pos: Position, part?: StoryPart): void {
    if (!part) {
      if (this.area !== 'body') this.setArea('body');
    } else {
      const note = footnoteIdOf(part);
      const box = textBoxIdOf(part);
      if (note !== undefined) this.setArea('footnote', undefined, note);
      else if (box !== undefined) this.setArea('textbox', undefined, box);
      else {
        const kind = storyKind(part as Exclude<StoryPart, FootnotePart | TextBoxPart>);
        const page = this.paged.pages.findIndex((_, i) => storyPart(this.paged, kind, i) === part);
        if (page < 0) return;
        this.setArea(kind, page);
      }
      if (this.part !== part) return;
    }
    this.setSelection(pos);
    this.centerCaret();
  }

  /**
   * Takes the document back to an earlier version of it, as one step to
   * undo: what did not change since stays as it is, and the others working
   * on it are sent only what did.
   */
  restoreVersion(version: Doc): void {
    this.edit((doc) => versionOver(doc, version));
  }

  // --- Tracked changes ----------------------------------------------------

  /** Whether what is typed and taken out is kept as changes to accept or reject (⌘⇧E / Ctrl+Shift+E). It is said in the file. */
  get trackChanges(): boolean {
    return !!this.doc.trackRevisions;
  }

  /** Starts or stops tracking changes. Not a step to undo: what was tracked stays. */
  setTrackChanges(on: boolean): void {
    if (on === this.trackChanges || this.locked) return;
    const { trackRevisions: _, ...rest } = this.doc;
    this.doc = on ? { ...this.doc, trackRevisions: true } : rest;
    this.afterDocChange(false);
  }

  /** The changes of the document, of its text first and then of its headers, footers and notes. */
  get revisions(): RevisionView[] {
    return revisionsOf(this.doc);
  }

  /** Whether there is any change to accept or reject. */
  get hasRevisions(): boolean {
    return hasRevisions(this.doc);
  }

  /** The change the caret is in, or the first the selection takes in. */
  get activeRevision(): RevisionView | undefined {
    const { from, to } = this.range;
    const part = this.part;
    const at = revisionAt(this.text.paragraphs, from);
    if (at && (this.collapsed || comparePositions(at.range.from, to) < 0)) return part ? { ...at, part } : at;
    if (this.collapsed) return undefined;
    const inside = revisionsIn(this.text.paragraphs).find((r) => comparePositions(r.range.from, to) < 0 && comparePositions(from, r.range.to) < 0);
    return inside && (part ? { ...inside, part } : inside);
  }

  /**
   * Accepts the change given; without one, the changes the selection takes in,
   * or the one the caret is in. Says whether there was any. A move is accepted
   * whole, both its halves.
   */
  acceptRevision(revision?: RevisionView): boolean {
    return this.decideRevision(true, revision);
  }

  /** Rejects the change given, or those of the selection, or the one at the caret, as `acceptRevision`. */
  rejectRevision(revision?: RevisionView): boolean {
    return this.decideRevision(false, revision);
  }

  private decideRevision(accept: boolean, given?: RevisionView): boolean {
    if (this.locked) return false;
    if (given && (given.part ?? undefined) !== (this.part ?? undefined)) this.goTo(given.range.from, given.part);
    const active = given ?? this.activeRevision;
    if (!active) return false;
    // One change: the letters of its range that are of it, not another's change over the same text.
    const one = given || this.collapsed;
    const range = one ? active.range : this.range;
    const pick = one ? (change: RevisionChange) => change.type === active.type && change.author === active.author && (change.move ?? '') === (active.move ?? '') : undefined;
    const text = accept ? acceptRevisions(this.text, range, pick) : rejectRevisions(this.text, range, pick);
    if (text.paragraphs === this.text.paragraphs || text.paragraphs.every((p, i) => p === this.text.paragraphs[i])) return false;
    this.commit(text, { anchor: range.from, focus: range.from }, '', false);
    return true;
  }

  /** Accepts every change of the document, or every one of `author`'s, as one step to undo. */
  acceptAllRevisions(author?: string): void {
    this.decideAll(true, author);
  }

  /** Rejects every change of the document, or every one of `author`'s, as one step to undo. */
  rejectAllRevisions(author?: string): void {
    this.decideAll(false, author);
  }

  private decideAll(accept: boolean, author?: string): void {
    if (this.locked || !this.hasRevisions) return;
    if (this.area !== 'body') this.setArea('body');
    const doc = decideAllRevisions(this.doc, accept, author === undefined ? undefined : byAuthor(author));
    if (doc === this.doc) return;
    this.commitDoc(doc, { anchor: clampPosition(doc, this.selection.anchor), focus: clampPosition(doc, this.selection.anchor) });
  }

  /** Selects the next change of the text being edited after the caret, or the one before it; says whether there was one. */
  goToRevision(dir: 1 | -1): boolean {
    const all = revisionsIn(this.text.paragraphs);
    const { from } = this.range;
    // From a caret, the change it is at the start of is the next; from a selection, the one after it.
    const after = (r: RevisionView) => comparePositions(r.range.from, from) > (this.collapsed ? -1 : 0);
    const found = dir > 0 ? all.find(after) : [...all].reverse().find((r) => comparePositions(r.range.from, from) < 0);
    if (!found) return false;
    this.selectRevision(this.part ? { ...found, part: this.part } : found);
    return true;
  }

  /** Selects a change, in its header, footer or note when it is in one. */
  selectRevision(revision: RevisionView): void {
    this.goTo(revision.range.from, revision.part);
    const end = clampPosition(this.text, revision.range.to);
    this.setSelection(revision.range.from, end);
  }

  /** Where the other people working on the document are, to draw their carets. */
  setPeers(peers: PeerCaret[]): void {
    if (!peers.length && !this.peers.length) return;
    this.peers = peers;
    this.renderSelection();
  }

  /** The page each paragraph of `doc` would start on, from 1, laid out as this editor lays documents out. */
  pagesOf(doc: Doc): (para: number) => number {
    const { lines, paraFirstLine } = doc === this.doc ? this.paged : layoutDocument(doc, this.measurer);
    return (para) => (lines[paraFirstLine[para]]?.page ?? 0) + 1;
  }

  loadDocx(data: ArrayBuffer | Uint8Array): void {
    this.load(importDocx(data instanceof Uint8Array ? data : new Uint8Array(data)));
  }

  exportDocx(): Uint8Array {
    this.updateToc();
    const said = { language: withRegion(this.textLanguage), replaceLanguage: !!this.chosenLanguage };
    return exportDocx(this.doc, this.embedFonts ? { ...said, fonts: this.givenFontsInUse(), subsetFonts: this.embedFonts === 'subset' } : said);
  }

  /** The faces the application gave whose family some text of the document is in, its notes and styles included. */
  private givenFontsInUse(): ReturnType<typeof fontFaces> {
    const faces = fontFaces();
    if (!faces.length) return [];
    const used = textByFamily(this.doc);
    return faces.filter((face) => used.has(face.family.toLowerCase()));
  }

  /** The text of the document as Markdown: headings, emphasis, lists and tables; no fonts, colours or pictures. */
  exportMarkdown(): string {
    // The tracked changes as they are shown: the original text when that is what is looked at, else all of them accepted.
    return exportMarkdown(this.doc, { changes: this.changesView === 'original' ? 'original' : 'accepted' });
  }

  /**
   * Opens the print dialog of the browser with the pages as they are shown,
   * one sheet each at the size of the page; saving as PDF from there gives the
   * document as a PDF. Nothing else of the window is printed.
   */
  print(): void {
    this.updateToc();
    document.querySelector('.dx-print')?.remove();
    // What is printed is the pages, also when they are not what is being shown.
    const flow = this.view === 'flow';
    if (flow) this.setView('column');
    // Every page, not only those near the view.
    this.drawAll = true;
    this.paint();
    const holder = document.createElement('div');
    holder.className = 'dx-print';
    const style = document.createElement('style');
    // Each sheet of the size of its page: a named page for each size the document has.
    const sizes = new Map<string, string>();
    const sizeOf = (i: number) => {
      const { width, height } = this.setupOf(i);
      const key = `${width}pt ${height}pt`;
      if (!sizes.has(key)) sizes.set(key, `dx-size-${sizes.size}`);
      return { width, height, name: sizes.get(key)! };
    };
    const first = sizeOf(0);
    this.sheetEls.forEach((_, i) => sizeOf(i));
    style.textContent = `@page{size:${first.width}pt ${first.height}pt;margin:0}` + [...sizes].map(([size, name]) => `@page ${name}{size:${size};margin:0}`).join('');
    holder.appendChild(style);
    for (const [i, sheet] of this.sheetEls.entries()) {
      const { width, height, name } = sizeOf(i);
      const page = document.createElement('div');
      page.className = 'dx-print-page';
      page.style.width = `${width}pt`;
      page.style.height = `${height}pt`;
      page.style.setProperty('page', name);
      const copy = sheet.cloneNode(true) as HTMLElement;
      copy.style.transform = '';
      // The selection and the marks of the editor are not part of the document.
      copy.querySelectorAll('.dx-sel, .dx-edge, .dx-note, .dx-toc-chip').forEach((el) => el.remove());
      copy.querySelectorAll('.dx-cell-guide').forEach((el) => el.classList.remove('dx-cell-guide'));
      page.appendChild(copy);
      holder.appendChild(page);
    }
    this.drawAll = false;
    if (flow) this.setView('flow');
    else this.paint();
    document.body.appendChild(holder);
    window.addEventListener('afterprint', () => holder.remove(), { once: true });
    window.print();
  }

  get pageCount(): number {
    return this.paged.pages.length;
  }

  /**
   * The document in its pages: what is shown, or, while its text is set to
   * the window, what it would show. The pages are what is printed, numbered
   * and counted, whatever is on the screen.
   */
  private get paged(): Layout {
    if (this.view !== 'flow') return this.layout;
    const shown = this.shown;
    if (this.pagedView?.doc !== shown) this.pagedView = { doc: shown, layout: layoutDocument(shown, this.measurer, this.layoutCache) };
    return this.pagedView.layout;
  }

  /** How wide the window is, in points of the document at the size it is shown. */
  private windowWidth(): number {
    return Math.floor(this.root.clientWidth / (PT_TO_PX * this.zoom)) || this.doc.page.width;
  }

  // --- View ---------------------------------------------------------------

  /** The element the pages scroll in, for what is laid out around the editor and has to follow it. */
  get element(): HTMLElement {
    return this.root;
  }

  /** Where a page is in the window (the caret's, unless another is asked for), at the size the zoom shows it. */
  pageBounds(page = this.currentPage - 1): DOMRect {
    return this.pageEls[Math.max(0, Math.min(page, this.pageEls.length - 1))].getBoundingClientRect();
  }

  /**
   * The edges, in points from the left of the page, of the column the caret's
   * paragraph is set in: the margins of the page, or the inside of its table
   * cell. Its indents are measured from them.
   */
  textColumn(): { left: number; right: number } {
    const flow = this.flow;
    const line = lineForPosition(flow, this.mapOffset(this.selection.focus, true));
    const { width, marginLeft, marginRight } = this.setupOf(this.pageOf(line.page));
    const box = line.cell === undefined ? undefined : flow.pages[line.page]?.cells[line.cell];
    const at = box && locateCell(this.text, this.selection.focus.para);
    if (!box || !at) return { left: marginLeft, right: width - marginRight };
    return { left: box.x + (at.cell.padLeft ?? at.table.padLeft), right: box.x + box.width - (at.cell.padRight ?? at.table.padRight) };
  }

  /** Where the selection is in the window: the selected text or picture, or the caret when nothing is. */
  selectionBounds(): DOMRect | undefined {
    const marks = [...this.root.querySelectorAll('.dx-sel, .dx-objsel')];
    // The caret is not shown while the document does not have the keyboard: the hidden field stands where it is.
    const rects = (marks.length ? marks : [this.caretEl, this.input]).map((el) => el.getBoundingClientRect()).filter((r) => r.height > 0);
    if (!rects.length) return undefined;
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    return new DOMRect(left, top, Math.max(...rects.map((r) => r.right)) - left, Math.max(...rects.map((r) => r.bottom)) - top);
  }

  /** True when the selection is one picture and nothing else. */
  get pictureSelected(): boolean {
    return !!this.selectedPicture();
  }

  /** What the selected picture is, for whoever cannot see it, as Word keeps it ("Alt Text"): what a screen reader says of it. Undefined without one. */
  get pictureDescription(): string | undefined {
    const picture = this.selectedPicture();
    if (!picture) return undefined;
    let offset = 0;
    for (const run of this.text.paragraphs[picture.pos.para].runs) {
      if (picture.pos.offset >= offset && picture.pos.offset < offset + run.text.length) return altText(run.props.object);
      offset += run.text.length;
    }
    return undefined;
  }

  /** Gives the selected picture a description for whoever cannot see it, or takes it away with an empty one. Not a change to track: Word does not. */
  setPictureDescription(text: string): void {
    const picture = this.selectedPicture();
    if (!picture || this.locked) return;
    const doc = setAltText(this.text, picture.pos, text);
    if (doc !== this.text) this.commit(doc, this.selection, '', false);
  }

  /** Gives the selected picture `fraction` of the width of the column it is in, keeping its shape. */
  fitSelectedPicture(fraction: number): void {
    const picture = this.selectedPicture();
    // The size a picture has is the one it has on its page: it is given another there.
    if (!picture || !(fraction > 0) || this.view === 'flow') return;
    const column = this.textColumn();
    const width = (column.right - column.left) * Math.min(fraction, 1);
    const resize = picture.floating ? resizeFloat : resizePicture;
    this.commit(resize(this.text, picture.pos, width, (picture.box.height * width) / picture.box.width), this.selection);
  }

  /**
   * How the selected picture sits in the text: in the line ('inline'), or
   * floating with the text round it ('square'), above and below it
   * ('topBottom'), under it ('none') or over it ('behind'). Undefined when no
   * picture is selected.
   */
  get pictureWrap(): PictureWrap | undefined {
    const picture = this.selectedPicture();
    return picture && pictureWrap(this.text, picture.pos);
  }

  /** Says how the selected picture sits in the text. It stays where it is on the page, as far as it can. */
  setPictureWrap(wrap: PictureWrap): void {
    const picture = this.selectedPicture();
    if (!picture || this.view === 'flow') return;
    let doc = setPictureWrap(this.text, picture.pos, wrap);
    if (doc === this.text) return;
    // One taken out of its line floats from the top of its paragraph: it is put back where it was drawn. The
    // text closes up where it was and goes round it, which may move its paragraph: it is tried again until it
    // stays. When its paragraph ends up on another page it cannot be where it was, which was on that one:
    // it goes beside its paragraph, as far across as it was.
    if (!picture.floating) {
      for (let pass = 0; pass < 4; pass++) {
        const now = this.floatBoxIn(doc, picture.pos);
        if (!now) break;
        const dx = picture.box.x - now.x;
        const dy = now.page === picture.box.page ? picture.box.y - now.y : 0;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) break;
        doc = moveFloat(doc, picture.pos, dx, dy);
      }
    }
    this.commit(doc, this.selection);
  }

  /** Where the floating picture anchored at `pos` of `text`, a changed copy of what is being edited, would be drawn. */
  private floatBoxIn(text: Doc, pos: Position): Rect | undefined {
    const layout = layoutDocument(this.merged(text), this.measurer);
    // In a header or a footer, the one of the page being edited: its positions are those of the page.
    const flow = (this.areaKey && bandLayout(layout, this.areaKey, this.areaPage)) || layout;
    for (const page of flow.pages) {
      const float = page.floats.find((f) => f.para === pos.para && f.offset === pos.offset);
      if (float) return { page: this.pageOf(page.index), x: float.x, y: float.y, width: float.width, height: float.height };
    }
    return undefined;
  }

  /** The page of the section table `table` is in. */
  private pageOfTable(table: number): PageSetup {
    return pageAt(this.doc, Math.max(0, this.doc.paragraphs.findIndex((p) => p.cell?.table === table)));
  }

  /** How many sections the document is set out in. */
  get sectionCount(): number {
    return sectionCount(this.doc);
  }

  /**
   * The section, counting from 0, that what is being edited is in: the
   * caret's, or that of the page whose header or footer is being edited.
   */
  get sectionIndex(): number {
    if (this.area === 'body') return sectionIndexOf(this.doc, this.selection.focus.para);
    return this.paged.pages[this.areaPage]?.section ?? this.sectionCount - 1;
  }

  /** The size and the margins of the page of that section. */
  get page(): PageSetup {
    return this.sectionPages()[this.sectionIndex] ?? this.doc.page;
  }

  /** The page of each section, in order. */
  sectionPages(): PageSetup[] {
    return [...sectionMarks(this.doc).map((i) => this.doc.paragraphs[i].section!.page), this.doc.page];
  }

  /** Whether the first page of the section has a header and a footer of its own, which its other pages do not show. */
  get firstPageDifferent(): boolean {
    return hasOwnFirstPage(this.doc, this.sectionIndex);
  }

  /**
   * Gives the first page of the section a header and a footer of its own,
   * empty to begin with, or takes them away: it then shows the ones its other pages show.
   */
  setFirstPageDifferent(on: boolean): void {
    const index = this.sectionIndex;
    if (on === hasOwnFirstPage(this.doc, index)) return;
    // What is being edited may be what goes, or what the first page stops showing.
    if (this.area !== 'body') this.setArea('body');
    this.commitDoc(setOwnFirstPage(this.doc, index, on), this.selection);
  }

  /**
   * Whether the section has a header and a footer of its own. Those without
   * show the document's, which are the last section's; that one always has them.
   */
  get ownHeaders(): boolean {
    return hasOwnStories(this.doc, this.sectionIndex);
  }

  /** Gives the section a header and a footer of its own, copies of the document's to begin with, or has it show the document's again. */
  setOwnHeaders(on: boolean): void {
    const index = this.sectionIndex;
    if (index >= this.sectionCount - 1 || on === hasOwnStories(this.doc, index)) return;
    const area = this.area;
    const page = this.areaPage;
    if (area !== 'body') this.setArea('body');
    this.commitDoc(setOwnStories(this.doc, index, on), this.selection);
    if (area !== 'body') this.setArea(area, page);
  }

  /** True when the caret is in a paragraph with nothing in it. */
  get paragraphEmpty(): boolean {
    return this.collapsed && this.text.paragraphs[this.selection.focus.para].runs.every((run) => !run.text);
  }

  /** The variable the selection is inside of, or is. */
  get activeVariable(): string | undefined {
    const { from, to } = this.range;
    return findVariables(this.text).find(({ range }) => comparePositions(range.from, from) <= 0 && comparePositions(to, range.to) <= 0)?.name;
  }

  /** Shows the pages at `zoom` times their size, and stops following the window. */
  setZoom(zoom: number): void {
    this.fit = undefined;
    if (!this.applyZoom(zoom)) this.emit();
  }

  /** Keeps the zoom at what fits the width of the page, or the whole page, in the window. */
  setFit(fit: ZoomFit): void {
    // Text as wide as the window already fits it.
    if (this.view === 'flow') return;
    this.fit = fit;
    if (!this.applyZoom(this.fitZoom(fit))) this.emit();
  }

  setView(view: ViewMode): void {
    if (view === this.view) return;
    const flowed = view === 'flow' || this.view === 'flow';
    // A header or a footer is of a page: with no pages, there is none to edit.
    if (view === 'flow' && this.area !== 'body') this.setArea('body');
    if (view === 'flow') {
      // The text is shown at its real size, and the pages get their zoom back afterwards.
      this.pagedZoom = { zoom: this.zoom, fit: this.fit };
      this.fit = undefined;
      this.zoom = 1;
    } else if (this.view === 'flow' && this.pagedZoom) {
      ({ zoom: this.zoom, fit: this.fit } = this.pagedZoom);
      this.pagedZoom = undefined;
    }
    this.view = view;
    this.pagesEl.classList.toggle('dx-spread', view === 'spread');
    this.pagesEl.classList.toggle('dx-grid', view === 'grid');
    this.pagesEl.classList.toggle('dx-flow', view === 'flow');
    if (this.fit) this.zoom = this.clampZoom(this.fitZoom(this.fit));
    if (flowed) this.render();
    this.pageEls.forEach((_, i) => this.sizePage(i));
    this.renderSelection();
    this.scrollCaretIntoView();
    this.emit();
  }

  /** Shows the notes in a margin to the right of the pages, as Word shows its comments, or puts the margin away. */
  setShowNotes(on: boolean): void {
    if (on === this.showNotes) return;
    this.showNotes = on;
    // The pages share the window with the margin: a zoom that follows it is worked out again.
    if (this.fit) this.zoom = this.clampZoom(this.fitZoom(this.fit));
    this.pageEls.forEach((_, i) => this.sizePage(i));
    this.renderSelection();
    this.scrollCaretIntoView();
    this.emit();
  }

  /**
   * Changes the zoom keeping under a point of the window what was under it:
   * what two fingers, or the pointer with the wheel, are on.
   */
  private zoomAt(zoom: number, clientX: number, clientY: number): void {
    const page = this.pageEls[this.pageAt(clientY)];
    const was = page.getBoundingClientRect();
    const fx = (clientX - was.left) / was.width;
    const fy = (clientY - was.top) / was.height;
    this.fit = undefined;
    if (!this.applyZoom(zoom)) return;
    const now = page.getBoundingClientRect();
    this.root.scrollLeft += now.left + fx * now.width - clientX;
    this.root.scrollTop += now.top + fy * now.height - clientY;
  }

  private clampZoom(zoom: number): number {
    const [min, max] = this.view === 'flow' ? [FLOW_MIN_ZOOM, FLOW_MAX_ZOOM] : [MIN_ZOOM, MAX_ZOOM];
    return Math.min(max, Math.max(min, Number.isFinite(zoom) ? zoom : 1));
  }

  /** The zoom at which the pages across the window, or one whole page, just fit in it. */
  private fitZoom(fit: ZoomFit): number {
    // The page the caret is on, or the widest when they are all to fit across.
    const { height } = this.setupOf(this.currentPage - 1);
    const width = fit === 'width' ? Math.max(...this.layout.pages.map((_, i) => this.setupOf(i).width)) : this.setupOf(this.currentPage - 1).width;
    const across = this.view === 'spread' ? 2 : 1;
    const beside = this.showNotes && this.view !== 'grid' && this.view !== 'flow' ? NOTE_MARGIN * across : 0;
    const byWidth = (this.root.clientWidth - this.gap * (across + 1)) / ((width * across + beside) * PT_TO_PX);
    if (fit === 'width') return byWidth;
    return Math.min(byWidth, (this.root.clientHeight - this.gap * 2) / (height * PT_TO_PX));
  }

  /** Changes the zoom keeping in view what was in the middle of the window. Returns whether it changed. */
  private applyZoom(zoom: number): boolean {
    const next = this.clampZoom(zoom);
    if (Math.abs(next - this.zoom) < 0.001) return false;
    const { scrollTop, scrollHeight, clientHeight } = this.root;
    const middle = (scrollTop + clientHeight / 2) / scrollHeight;
    this.zoom = next;
    // Text as wide as the window is broken into other lines at another size.
    if (this.view === 'flow') this.render();
    else this.pageEls.forEach((_, i) => this.sizePage(i));
    this.renderSelection();
    this.root.scrollTop = middle * this.root.scrollHeight - clientHeight / 2;
    this.emit();
    return true;
  }

  /** The size and margins of page `i` of what is shown: those of its section. */
  private setupOf(i: number): PageSetup {
    return this.layout.pages[i]?.setup ?? this.layout.page;
  }

  private sizePage(i: number): void {
    const { width, height } = this.setupOf(i);
    this.pageEls[i].style.width = `${width * this.zoom}pt`;
    this.pageEls[i].style.height = `${height * this.zoom}pt`;
    const sheet = this.sheetEls[i].style;
    sheet.width = `${width}pt`;
    sheet.height = `${height}pt`;
    sheet.transform = this.zoom === 1 ? '' : `scale(${this.zoom})`;
    // Text as wide as the window fills it to the bottom, however short it is.
    this.pageEls[i].style.minHeight = this.view === 'flow' ? `${this.root.clientHeight}px` : '';
  }

  private onWheel = (e: WheelEvent): void => {
    this.hideNoteTip();
    // Ctrl and the wheel, which is also what a pinch on a trackpad sends.
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    this.zoomAt(this.zoom * Math.exp(-e.deltaY / WHEEL_ZOOM), e.clientX, e.clientY);
  };

  // --- Header and footer ---------------------------------------------------

  /**
   * Moves the selection into the header or the footer, on `page` (counting
   * from 0, the caret's by default), or back into the text of the document.
   * One that does not exist yet starts as an empty paragraph, and is dropped
   * again if it is left empty.
   */
  setArea(area: EditArea, page?: number, note?: string): void {
    if (this.view === 'flow' && area !== 'body') return;
    // A note is edited on the page its text starts on, unless another page that shows some of it is asked for; a text box, on one it is on.
    const own = area === 'footnote' || area === 'textbox';
    if (own && (note === undefined || this.notePage(note, page, area) === undefined)) return;
    const at = own ? this.notePage(note!, page, area)! : Math.max(0, Math.min(page ?? this.currentPage - 1, this.pageCount - 1));
    if (area === this.area && (area === 'body' || at === this.areaPage) && (!own || note === this.areaNote)) return;
    this.dropEmptyStory();
    this.area = area;
    this.areaPage = at;
    this.areaNote = own ? note : undefined;
    this.ensureStory();
    // Only to be looked at, a header or a footer that is not there cannot be made.
    if (this.locked && this.part && !storyOf(this.doc, this.part)?.paragraphs.length) {
      this.area = 'body';
      this.areaPage = 0;
      this.areaNote = undefined;
    }
    this.syncArea();
    this.render();
    this.refind();
    // Back in the text, the caret goes to the page that was being looked at.
    const first = area === 'body' ? this.paged.pages[at]?.lines[0] : undefined;
    const pos = first ? { para: first.para, offset: first.start } : docStart();
    this.setSelection(pos);
    const name = this.area === 'body' ? t('a11y.body') : t(`area.${this.area}`);
    this.announcer.say(this.area === 'body' ? name : `${name}, ${t('a11y.page', { page: this.pageOf(this.areaPage) + 1 })}`, true);
  }

  /** The document the selection is in: the real one, or the header or footer seen as one. */
  private get text(): Doc {
    const part = this.part;
    const doc = this.shown;
    if (!part) return doc;
    if (this.textView?.doc !== doc || this.textView.part !== part) {
      const story = storyOf(doc, part) ?? { paragraphs: [] };
      const view: Doc = { ...doc, paragraphs: story.paragraphs, tables: story.tables, header: undefined, footer: undefined, firstPage: undefined };
      this.textView = { doc, part, view };
    }
    return this.textView.view;
  }

  /**
   * The part being edited when it is not the text: the header or the footer
   * every page shows, or the first page's own when the document gives it one
   * and that is the page being edited.
   */
  private get part(): StoryPart | undefined {
    if (this.area === 'footnote') return footnotePart(this.areaNote!);
    if (this.area === 'textbox') return textBoxPart(this.areaNote!);
    return this.area === 'body' ? undefined : storyPart(this.paged, this.area, this.areaPage);
  }

  /** What `bandLayout` knows the area being edited by, when it is not the text. */
  private get areaKey(): 'header' | 'footer' | FootnotePart | TextBoxPart | undefined {
    return this.area === 'body' ? undefined : this.area === 'footnote' ? footnotePart(this.areaNote!) : this.area === 'textbox' ? textBoxPart(this.areaNote!) : this.area;
  }

  /** The page that shows note `id`, or text box `id`: `page` when it shows it, otherwise the first that does. */
  private notePage(id: string, page?: number, area: 'footnote' | 'textbox' = 'footnote'): number | undefined {
    const shows = (i: number) => (area === 'textbox' ? this.paged.pages[i]?.textBoxes?.some((box) => box.id === id) : this.paged.pages[i]?.footnotes?.notes.some((note) => note.id === id));
    if (page !== undefined && shows(page)) return page;
    const first = this.paged.pages.findIndex((_, i) => shows(i));
    return first < 0 ? undefined : first;
  }

  /** The layout the selection is in: every page, or the header or footer of the page being edited. */
  private get flow(): Layout {
    return (this.areaKey && bandLayout(this.layout, this.areaKey, this.areaPage)) || this.layout;
  }

  /** The real document with a changed `text` put back where it came from. */
  private merged(text: Doc): Doc {
    const part = this.part;
    if (!part || text === this.text) return part ? this.doc : text;
    const story = text.tables ? { paragraphs: text.paragraphs, tables: text.tables } : { paragraphs: text.paragraphs };
    const doc = withStory(this.doc, part, story);
    // Lists made in a header are defined with those of the document, and so are the pictures put in it.
    if (text.numbering !== this.doc.numbering) doc.numbering = text.numbering;
    if (text.media !== this.doc.media) doc.media = text.media;
    return doc;
  }

  /**
   * A position of the selection as the layout has it (`shown`) or back. They
   * differ in a header or footer with a page number, whose digits are not the
   * ones the document holds.
   */
  private mapOffset(pos: Position, shown: boolean): Position {
    const story = this.part && storyOf(this.doc, this.part);
    if (!story) return pos;
    const model = story.paragraphs[pos.para];
    const onPage = story && storyOnPage(story, this.areaPage + 1, this.pageCount).paragraphs[pos.para];
    if (!model || !onPage || model === onPage) return pos;
    return { para: pos.para, offset: shown ? mapFieldOffset(model, onPage, pos.offset) : mapFieldOffset(onPage, model, pos.offset) };
  }

  /** The page of the document a page of the flow is. */
  private pageOf(flowPage: number): number {
    return this.area === 'body' ? flowPage : this.areaPage;
  }

  private ensureStory(): void {
    const part = this.part;
    if (!part || this.locked || storyOf(this.doc, part)?.paragraphs.length) return;
    // In the font the document opens with, at the usual size: its first text may well be a title.
    const props: RunProps = { fontFamily: resolveRun(propsAt(this.doc, docStart())).fontFamily };
    this.doc = withStory(this.doc, part, { paragraphs: [{ props: {}, runs: [{ text: '', props }] }] });
  }

  /** Takes away the header or footer being left when it is a single empty paragraph made here. */
  private dropEmptyStory(): void {
    const part = this.part;
    // A note is there while its reference is, whatever it holds; and a text box while its drawing is.
    if (!part || this.area === 'footnote' || this.area === 'textbox') return;
    const paragraphs = storyOf(this.doc, part)?.paragraphs ?? [];
    if (paragraphs.length !== 1 || paragraphs[0].origin !== undefined || paragraphs[0].runs.some((run) => run.text)) return;
    this.doc = withStory(this.doc, part, undefined);
  }

  private syncArea(): void {
    // A note is edited where it is, as the text is: nothing else is dimmed.
    this.root.classList.toggle('dx-editing', this.area === 'header' || this.area === 'footer');
    this.root.classList.toggle('dx-editing-header', this.area === 'header');
    this.root.classList.toggle('dx-editing-footer', this.area === 'footer');
    this.root.classList.toggle('dx-editing-footnote', this.area === 'footnote');
    this.root.classList.toggle('dx-editing-textbox', this.area === 'textbox');
  }

  /** The text box under a point of the window, the one on top when several are, and whether the point is on its edge. */
  private textBoxAt(clientX: number, clientY: number): { page: number; id: string; edge: boolean } | undefined {
    const page = this.pageAt(clientY);
    const boxes = this.layout.pages[page]?.textBoxes;
    if (!boxes?.length) return undefined;
    const rect = this.pageEls[page].getBoundingClientRect();
    const scale = this.setupOf(page).width / rect.width;
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
    if (this.view === 'flow') return { page, area: 'body' };
    const rect = this.pageEls[page].getBoundingClientRect();
    const { height, marginTop, marginBottom } = this.setupOf(page);
    const y = (clientY - rect.top) * (height / rect.height);
    const { header, footer, footnotes } = this.layout.pages[page];
    // The notes at the foot of the page, from the line above them down: each as far down as its last line.
    if (footnotes && y >= footnotes.rule.y) {
      const note = footnotes.notes.find((_, k) => k === footnotes.notes.length - 1 || y < Math.max(...footnotes.notes[k + 1].lines.map((l) => l.y), 0));
      const bottomOf = Math.max(...footnotes.notes.flatMap((n) => n.lines.map((l) => l.y + l.height)));
      if (note && y <= bottomOf) return { page, area: 'footnote', note: note.id };
    }
    // A header taller than its margin reaches as far as its last line, and so does the footer.
    const top = Math.max(marginTop, ...(header?.lines ?? []).map((l) => l.y + l.height));
    const bottom = Math.min(height - marginBottom, ...(footer?.lines ?? []).map((l) => l.y));
    return { page, area: y < top ? 'header' : y >= bottom ? 'footer' : 'body' };
  }

  /** The text selected, as plain text. */
  get selectedText(): string {
    return this.collapsed ? '' : textInRange(this.text, this.range);
  }

  // --- Selection ----------------------------------------------------------

  get range(): Range {
    return orderedRange(this.selection.anchor, this.selection.focus);
  }

  get collapsed(): boolean {
    return comparePositions(this.selection.anchor, this.selection.focus) === 0;
  }

  setSelection(anchor: Position, focus: Position = anchor): void {
    this.typedAt = undefined;
    this.selection = { anchor: clampPosition(this.text, anchor), focus: clampPosition(this.text, focus) };
    this.pendingProps = null;
    this.goalX = null;
    this.lastEdit.kind = '';
    this.renderSelection();
    this.scrollCaretIntoView();
    this.emit();
  }

  selectAll(): void {
    this.setSelection(docStart(), docEnd(this.text));
    this.announcer.say(t('a11y.allSelected'), true);
  }

  /** Formatting of the selection start, or of the text about to be typed. */
  activeRunProps(): ResolvedRunProps {
    if (this.pendingProps) return resolveRun(this.pendingProps);
    const { from } = this.range;
    // What is typed at the end of a link is not part of it.
    const link = this.collapsed ? linkAt(this.text, from) : undefined;
    if (link && comparePositions(link.range.to, from) === 0) return resolveRun(propsAt(removeLink(this.text, link.range), from));
    const inside = !this.collapsed && from.offset < paragraphLength(this.text.paragraphs[from.para]);
    return resolveRun(propsAt(this.text, inside ? { para: from.para, offset: from.offset + 1 } : from));
  }

  activeParagraphProps(): ResolvedParagraphProps {
    return resolveParagraph(this.text.paragraphs[this.selection.focus.para].props);
  }

  // --- Editing commands ---------------------------------------------------

  insertText(text: string): void {
    // A header or footer is one piece: it cannot be broken into pages.
    if (this.area !== 'body') text = text.replace(/\f/g, '');
    if (!text) return;
    const range = this.range;
    // Text typed next to a page number is not part of the number.
    const { field: _, ...props } = this.pendingProps ?? this.activeRunProps();
    const wasCollapsed = this.collapsed;
    const doc = wasCollapsed ? this.text : deleteRange(this.text, range);
    const result = insertFragment(doc, outsideField(doc, range.from), text, props);
    const mergeable = wasCollapsed && !/[\r\n]/.test(text);
    this.commit(result.doc, { anchor: result.pos, focus: result.pos }, mergeable ? 'type' : '');
    // What the character completes is a step of its own: undoing it leaves what was typed.
    const formatted = this.autoformat && mergeable && text.length === 1 ? autoformat(this.text, this.selection.focus, text) : undefined;
    if (formatted) {
      this.commit(formatted.doc, { anchor: formatted.pos, focus: formatted.pos });
      // The marks closed the format: what is typed next is plain again.
      if (formatted.mark) {
        this.pendingProps = { ...propsAt(this.text, formatted.pos), [formatted.mark]: false };
        this.emit();
      }
    }
  }

  insertParagraphBreak(): void {
    const { para } = this.selection.focus;
    const { numId, listLevel } = this.text.paragraphs[para].props;
    if (this.collapsed && numId && paragraphLength(this.text.paragraphs[para]) === 0) {
      // Enter on an empty item moves it up a level; at the top level it ends the list.
      const doc = listLevel ? shiftListLevel(this.text, para, para, -1) : leaveList(this.text, para);
      this.commit(doc, this.selection);
      return;
    }
    const range = this.range;
    const doc = this.collapsed ? this.text : deleteRange(this.text, range);
    const at = outsideField(doc, range.from);
    let result = splitParagraph(doc, at);
    // After a title or a heading comes ordinary text, when Enter is pressed at its end.
    const style = this.styles.find((s) => s.id === styleIdAt(doc, at.para));
    if (style?.next && at.offset === paragraphLength(doc.paragraphs[at.para])) {
      result = { doc: setParagraphStyle(result.doc, result.pos.para, result.pos.para, style.next), pos: result.pos };
    }
    this.commit(result.doc, { anchor: result.pos, focus: result.pos });
  }

  deleteBackward(byWord = false): void {
    this.deleteDirection(-1, byWord);
  }

  deleteForward(byWord = false): void {
    this.deleteDirection(1, byWord);
  }

  private deleteDirection(dir: -1 | 1, byWord: boolean): void {
    const { para, offset } = this.selection.focus;
    if (dir < 0 && this.collapsed && offset === 0) {
      // At the start of a list item Backspace first removes the label, then the indent,
      // and only after that joins the paragraph to the one above.
      const props = this.text.paragraphs[para].props;
      if (props.numId) {
        this.commit(leaveList(this.text, para, true), this.selection);
        return;
      }
      if (props.numId === 0 && props.indentLeft) {
        this.commit(setParagraphProps(this.text, para, para, { indentLeft: 0 }), this.selection);
        return;
      }
    }
    let range = this.range;
    if (this.collapsed) {
      const focus = this.selection.focus;
      const other = byWord ? moveWord(this.text, focus, dir) : moveChar(this.text, focus, dir);
      if (comparePositions(other, focus) === 0) return;
      // Paragraphs are not joined across the edge of a table cell.
      const { paragraphs } = this.text;
      if (other.para !== focus.para && !sameCell(paragraphs[other.para].cell, paragraphs[focus.para].cell)) return;
      range = orderedRange(other, focus);
      if (!byWord && other.para === focus.para) {
        // moveChar steps over anchors on its way; delete only the visible character it reached.
        range = dir < 0 ? { from: other, to: moveOffset(other, 1) } : { from: moveOffset(other, -1), to: other };
      }
    }
    const kind = this.collapsed && !byWord ? (dir < 0 ? 'backspace' : 'delete') : '';
    const gone = textInRange(this.text, range);
    this.announcer.say(t('a11y.deleted', { text: gone.length === 1 ? spokenChar(gone) : spokenText(gone) }), true);
    this.forward = dir > 0;
    try {
      this.commit(deleteRange(this.text, range), { anchor: range.from, focus: range.from }, kind);
    } finally {
      this.forward = false;
    }
  }

  toggleMark(key: MarkKey): void {
    const say = (on: boolean) => this.announcer.say(t(on ? 'a11y.on' : 'a11y.off', { name: t(`mark.${key}`) }), true);
    if (this.collapsed) {
      const current = this.pendingProps ?? propsAt(this.text, this.selection.focus);
      const on = !resolveRun(current)[key];
      this.pendingProps = { ...current, [key]: on };
      this.emit();
      say(on);
      return;
    }
    const allOn = runsInRange(this.text, this.range).every((r) => resolveRun(r.props)[key]);
    this.commit(applyRunProps(this.text, this.range, { [key]: !allOn }), this.selection);
    say(!allOn);
  }

  setRunProps(patch: RunProps): void {
    if (this.collapsed) {
      this.pendingProps = { ...(this.pendingProps ?? propsAt(this.text, this.selection.focus)), ...patch };
      this.emit();
      return;
    }
    this.commit(applyRunProps(this.text, this.range, patch), this.selection);
  }

  setParagraphProps(patch: ParagraphProps): void {
    const { from, to } = this.range;
    this.commit(setParagraphProps(this.text, from.para, to.para, patch), this.selection);
  }

  // --- Find and replace ---------------------------------------------------

  /**
   * Looks for `query` in the text the selection is in and marks every place it
   * is found; an empty query stops the search. Returns how many there are.
   */
  find(query: string, options: FindOptions = {}): number {
    this.finding = query ? { query, options } : undefined;
    this.refind();
    this.renderSelection();
    this.emit();
    return this.found.length;
  }

  get findCount(): number {
    return this.found.length;
  }

  /** Which of the places found the selection is, counting from 1; 0 when it is none of them. */
  get findIndex(): number {
    const { from, to } = this.range;
    return this.found.findIndex((r) => comparePositions(r.from, from) === 0 && comparePositions(r.to, to) === 0) + 1;
  }

  /** Selects the next place found after the selection (1) or the one before it (-1), going round at the ends. */
  findStep(dir: -1 | 1): boolean {
    if (!this.found.length) return false;
    const { from, to } = this.range;
    const after = this.findIndex ? to : from;
    const match =
      dir > 0
        ? (this.found.find((r) => comparePositions(r.from, after) >= 0) ?? this.found[0])
        : ([...this.found].reverse().find((r) => comparePositions(r.from, from) < 0) ?? this.found[this.found.length - 1]);
    this.setSelection(match.from, match.to);
    return true;
  }

  /** Replaces the place found that is selected and goes on to the next; with none selected, it only goes to the next. */
  replaceFound(text: string): boolean {
    const index = this.findIndex;
    if (!index) return this.findStep(1) && false;
    const result = replaceRange(this.text, this.found[index - 1], text);
    this.commit(result.doc, { anchor: result.pos, focus: result.pos });
    this.findStep(1);
    return true;
  }

  /** Replaces every place found, as one step to undo. Returns how many there were. */
  replaceAllFound(text: string): number {
    if (!this.finding) return 0;
    const result = replaceAll(this.text, this.finding.query, text, this.finding.options);
    if (result.count) this.commit(result.doc, this.selection);
    return result.count;
  }

  private refind(): void {
    this.found = this.finding ? findAll(this.text, this.finding.query, this.finding.options) : [];
  }

  // --- Templates ----------------------------------------------------------

  /** The names of the variables of the document, written {{name}} in its text, a header, a footer, a note or a text box. */
  get variables(): string[] {
    return variableNames(this.doc);
  }

  /** The blocks of the template: what is repeated for each item of a list, or kept only when a value is there ({{#name}} … {{/name}}). */
  get blocks(): Block[] {
    return templateBlocks(this.doc);
  }

  /** Puts a variable at the caret, or in place of the selection. */
  insertVariable(name: string): void {
    if (name.trim()) this.insertText(variableText(name));
  }

  /**
   * Selects the next place the variable is used after the caret, going round
   * at the end: in the text, then in the headers and footers, the notes and
   * the text boxes, going into the one it is in.
   */
  selectVariable(name: string): boolean {
    const uses = findAllVariables(this.doc).filter((variable) => variable.name === name);
    if (!uses.length) return false;
    // The parts in the order they are gone through, the text first.
    const order = [undefined, ...textParts(this.doc)];
    const here = order.indexOf(this.part);
    const after = (use: (typeof uses)[number]) => {
      const at = order.indexOf(use.part);
      return at > here || (at === here && comparePositions(use.range.from, this.range.to) >= 0);
    };
    const next = uses.find(after) ?? uses[0];
    if (next.part !== this.part) this.goTo(next.range.from, next.part);
    if (next.part !== this.part) return false;
    this.setSelection(next.range.from, next.range.to);
    this.centerCaret();
    return true;
  }

  /** The formats every use of the variable has: capitals, bold, how a date or a number is written. */
  variableFormats(name: string): ActiveFormat[] {
    return variableFormats(this.doc, name);
  }

  /** What the notes on the variable say, on it or on a part of it: in a template, what to fill it with. */
  variableNotes(name: string): string[] {
    if (this.notesOfVariables?.doc !== this.doc) this.notesOfVariables = { doc: this.doc, notes: variableNotes(this.doc) };
    return this.notesOfVariables.notes[name] ?? [];
  }
  /** Those of every variable, kept while the document is the same: the panel asks for each one. */
  private notesOfVariables: { doc: Doc; notes: Record<string, string[]> } | undefined;

  /** How many times the variable is used in the document, its headers, footers, notes and text boxes. */
  variableUses(name: string): number {
    return variableUses(this.doc, name);
  }

  /** Gives a format to every use of the variable, or takes it away, as one step to undo. */
  setVariableFormat(name: string, id: FormatId, on: boolean, arg = ''): void {
    // Written in the language of the interface, as the person reads it: {{price | moneda}}, {{price | currency}}.
    let doc = setVariableFormat(this.doc, name, id, on, arg, getLocale());
    if (doc === this.doc) return;
    if (this.doc.trackRevisions) doc = trackDocEdit(this.doc, doc, this.reviser());
    // The text of each use changes length: a use that was selected stays selected.
    const inside = ({ range }: Variable) => comparePositions(range.from, this.range.from) <= 0 && comparePositions(this.range.to, range.to) <= 0;
    const use = findVariables(this.text).findIndex(inside);
    this.commitDoc(doc, this.selection);
    const now = use < 0 ? undefined : findVariables(this.text)[use];
    if (now) this.setSelection(now.range.from, now.range.to);
  }

  /**
   * The language variables are written in: dates, numbers, capitals. The
   * language of the text (`textLanguage`: the one chosen, the `language`
   * set, the one the file says, or the interface's when it was opened),
   * with the browser's region.
   */
  get formatLocale(): string {
    return withRegion(this.textLanguage);
  }

  /**
   * Replaces each variable that has a value by it, everywhere in the document,
   * and writes out each block that has one: a list repeats it, yes or no keeps
   * it or takes it away. As one step to undo.
   */
  fillVariables(values: TemplateData): void {
    let doc = fillVariables(this.doc, values, { locale: this.formatLocale });
    if (doc === this.doc) return;
    // While changes are tracked, so is this: the variable taken out, its value put in.
    if (this.doc.trackRevisions) doc = trackDocEdit(this.doc, doc, this.reviser());
    this.commitDoc(doc, this.selection);
  }

  // --- Links --------------------------------------------------------------

  /** The link the caret is in, or the selection is inside of: where it goes, and the text it covers. */
  get activeLink(): { href: string; text: string } | undefined {
    const { from, to } = this.range;
    // A selection that starts where a link ends is not in it.
    const link = linkAt(this.text, this.collapsed ? from : { para: from.para, offset: from.offset + 1 });
    if (!link || comparePositions(to, link.range.to) > 0) return undefined;
    return { href: link.href, text: textInRange(this.text, link.range) };
  }

  /**
   * Makes a link to `address` of the selected text; with nothing selected, the
   * link the caret is in goes there instead, or the address is written as a
   * link. Returns false for what is not an address a link may open.
   */
  setLink(address: string): boolean {
    const href = cleanHref(address);
    if (href === undefined) return false;
    const inLink = this.collapsed ? linkAt(this.text, this.range.from) : undefined;
    if (inLink) {
      this.commit(setLink(this.text, inLink.range, href), this.selection);
      return true;
    }
    // What is typed after the link is text like the text before it.
    const plain = propsAt(this.text, this.range.from);
    const made = this.collapsed ? insertLink(this.text, this.range.from, address.trim(), href) : { doc: setLink(this.text, this.range, href), range: this.range };
    this.commit(made.doc, { anchor: made.range.to, focus: made.range.to });
    this.pendingProps = linkHref(plain) === undefined ? plain : null;
    this.emit();
    return true;
  }

  /** Takes away the link the caret is in, or the links of the selection; their text stays. */
  removeLink(): void {
    const range = this.collapsed ? linkAt(this.text, this.range.from)?.range : this.range;
    if (range && runsInRange(this.text, range).some((run) => linkHref(run.props) !== undefined)) this.commit(removeLink(this.text, range), this.selection);
  }

  /** Opens what a link goes to, in another window. */
  openLink(href: string): void {
    const safe = cleanHref(href);
    if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
  }

  // --- Notes --------------------------------------------------------------

  /** What ⌘K does, when given: asking for the address of a link is for whoever shows the editor. */
  onLinkKey: (() => void) | undefined;

  /** Who the notes made here are by. */
  author = '';
  /** The colour the notes made here are marked with: one of `NOTE_COLORS`. */
  noteColor = NOTE_COLORS[0];

  /** The notes of the document, in the order of the text they are about. */
  get notes(): NoteView[] {
    const doc = this.doc;
    const byId = new Map((doc.notes ?? []).map((note) => [note.id, note]));
    return noteRanges(doc).flatMap(({ id, range }) => {
      const note = byId.get(id);
      return note ? [{ id, author: note.author, date: note.date, text: note.text, excerpt: noteExcerpt(doc, range), color: note.color ?? NOTE_COLORS[0] }] : [];
    });
  }

  /** The note the caret is in, or the selection is inside of; the shortest, when one is inside another. */
  get activeNote(): string | undefined {
    if (this.area !== 'body') return undefined;
    const known = new Set((this.doc.notes ?? []).map((note) => note.id));
    const { from, to } = this.range;
    return notesAt(this.doc, from).find(({ id, range }) => known.has(id) && comparePositions(to, range.to) <= 0)?.id;
  }

  /**
   * Puts a note on the selected text, or on the word the caret is in.
   * Returns its id, or nothing when there is no text to put it on.
   */
  addNote(text: string): string | undefined {
    if (this.area !== 'body') return undefined;
    const range = this.collapsed ? wordRangeAt(this.doc, this.range.from) : this.range;
    if (comparePositions(range.from, range.to) >= 0) return undefined;
    const { doc, id } = addNote(this.doc, range, { text, author: this.author || t('note.anonymous'), color: this.noteColor, date: new Date().toISOString().replace(/\.\d+Z$/, 'Z') });
    if (id === undefined) return undefined;
    // The caret is left at the end of the noted text, not the text selected: the next key must not replace it.
    const end = noteRanges(doc).find((note) => note.id === id)!.range.to;
    this.commit(doc, { anchor: end, focus: end });
    return id;
  }

  /** Changes what a note says. */
  setNoteText(id: string, text: string): void {
    const doc = setNoteText(this.doc, id, text);
    if (doc !== this.doc) this.commitDoc(doc, this.selection);
  }

  /** Changes the colour a note is marked with. */
  setNoteColor(id: string, color: string): void {
    const doc = setNoteColor(this.doc, id, color);
    if (doc !== this.doc) this.commitDoc(doc, this.selection);
  }

  /** Takes a note away; the text it was about stays. */
  removeNote(id: string): void {
    const doc = removeNote(this.doc, id);
    if (doc !== this.doc) this.commitDoc(doc, this.selection);
  }

  /** Selects the text a note is about, and brings it into view. */
  selectNote(id: string): boolean {
    const note = noteRanges(this.doc).find((other) => other.id === id);
    if (!note) return false;
    if (this.area !== 'body') this.setArea('body');
    this.setSelection(note.range.from, note.range.to);
    this.centerCaret();
    return true;
  }

  // --- Table of contents ----------------------------------------------------

  /** Whether the document has a table of contents. */
  get hasToc(): boolean {
    return !!tocRange(this.doc);
  }

  /** What a table of contents is written from: the page each paragraph starts on, as laid out now. */
  private tocOptions(): TocOptions {
    const { lines, paraFirstLine } = this.paged;
    return { pageOf: (para) => (lines[paraFirstLine[para]]?.page ?? 0) + 1, emptyText: t('toc.empty') };
  }

  /**
   * Puts a table of contents in at the caret, under a title: the headings of
   * the document, each with its page. Only in the text of the document,
   * outside tables, and only one.
   */
  insertToc(): void {
    if (this.area !== 'body' || this.inTable || this.hasToc) return;
    const doc = this.collapsed ? this.doc : deleteRange(this.doc, this.range);
    const result = insertToc(doc, outsideField(doc, this.range.from), { ...this.tocOptions(), title: t('toc.title') });
    if (result.doc === doc) return;
    this.commit(result.doc, { anchor: result.pos, focus: result.pos });
    // Its pages were those of the document without it: now that it takes room of its own, they are worked out again.
    this.settleToc();
  }

  /**
   * Writes the table of contents again from the headings and the pages the
   * document has now. Returns whether there was anything to change. Saving,
   * exporting and printing do it by themselves.
   */
  updateToc(): boolean {
    const doc = updateToc(this.doc, this.tocOptions());
    if (doc === this.doc) return false;
    this.commitDoc(doc, this.selection);
    this.settleToc();
    return true;
  }

  /** Brings the table up to date again while doing so moves its own headings to other pages; it settles in a pass or two. */
  private settleToc(): void {
    if (this.locked) return;
    for (let pass = 0; pass < 3; pass++) {
      const doc = updateToc(this.doc, this.tocOptions());
      if (doc === this.doc) return;
      // Part of the same change: it does not get a step of its own to undo.
      this.doc = doc;
      this.afterDocChange();
    }
  }

  /** Selects the table of contents, and brings it into view. */
  goToToc(): boolean {
    const range = tocRange(this.doc);
    if (!range) return false;
    if (this.area !== 'body') this.setArea('body');
    this.setSelection({ para: range.first, offset: 0 });
    this.centerCaret();
    return true;
  }

  // --- Outline ------------------------------------------------------------

  /** The titles and headings of the document. */
  get outline(): OutlineItem[] {
    return outline(this.doc);
  }

  /** Which heading of the outline the caret is under; -1 before the first, or in the header or footer. */
  get activeHeading(): number {
    return this.area === 'body' ? sectionAt(this.doc, this.selection.focus.para) : -1;
  }

  /** Puts the caret at the start of a heading and brings it to the top of the window. */
  goToHeading(para: number): void {
    if (this.area !== 'body') this.setArea('body');
    this.setSelection({ para, offset: 0 });
    this.root.scrollTop = this.caretBox().top - SCROLL_MARGIN * 2;
  }

  /** Moves the section a heading opens to just before the paragraph `before`, or to the end. */
  moveSection(from: number, before?: number): void {
    const result = moveSection(this.doc, from, before);
    if (result.doc === this.doc) return;
    if (this.area !== 'body') this.setArea('body');
    const pos = { para: result.para, offset: 0 };
    this.commitDoc(result.doc, { anchor: pos, focus: pos });
  }

  /** Scrolls so the caret is in the middle of the window, for a place that was jumped to. */
  private centerCaret(): void {
    const { top } = this.caretBox();
    if (top < this.root.scrollTop || top > this.root.scrollTop + this.root.clientHeight - SCROLL_MARGIN * 3) {
      this.root.scrollTop = top - this.root.clientHeight / 2;
    }
  }

  // --- Pictures -----------------------------------------------------------

  /**
   * Puts a picture at the caret, `width` by `height` points, made smaller if
   * it does not fit the page. PNG, JPEG and GIF.
   */
  insertImage(bytes: Uint8Array, type: string, width: number, height: number): void {
    const column = this.textColumn();
    const { height: pageHeight, marginTop, marginBottom } = this.page;
    const fit = Math.min(1, (column.right - column.left) / width, (pageHeight - marginTop - marginBottom - 24) / height);
    const doc = this.collapsed ? this.text : deleteRange(this.text, this.range);
    const result = insertImage(doc, outsideField(doc, this.range.from), { bytes, type, width: width * fit, height: height * fit });
    if (result.doc !== doc) this.commit(result.doc, { anchor: result.pos, focus: result.pos });
  }

  /**
   * Puts several pictures in as a grid of `columns` across, in the order
   * given: a table without borders, with each picture as large as its cell
   * allows. Resolves to how many could be read.
   */
  async insertImageGrid(files: Blob[], columns: number): Promise<number> {
    if (this.inTable || !this.canEditTables) return 0;
    const images: { bytes: Uint8Array; type: string; width: number; height: number }[] = [];
    for (const file of files) {
      if (!imageExtension(file.type)) continue;
      try {
        const bitmap = await createImageBitmap(file);
        images.push({ bytes: new Uint8Array(await file.arrayBuffer()), type: file.type, width: bitmap.width / PT_TO_PX, height: bitmap.height / PT_TO_PX });
        bitmap.close();
      } catch {
        // A file that is not the picture it says it is: the others still go in.
      }
    }
    const doc = this.collapsed ? this.text : deleteRange(this.text, this.range);
    const result = insertImageGrid(doc, outsideField(doc, this.range.from), images, columns);
    if (result.doc === doc) return 0;
    this.commit(result.doc, { anchor: result.pos, focus: result.pos });
    return images.length;
  }

  /** Puts in a picture from a file, at the size it has at 96 pixels to the inch. Resolves to whether it could be read. */
  async insertImageFile(file: Blob): Promise<boolean> {
    if (!imageExtension(file.type)) return false;
    try {
      const bitmap = await createImageBitmap(file);
      const { width, height } = bitmap;
      bitmap.close();
      this.insertImage(new Uint8Array(await file.arrayBuffer()), file.type, width / PT_TO_PX, height / PT_TO_PX);
      return true;
    } catch {
      return false;
    }
  }

  // --- Letterhead ---------------------------------------------------------

  /** Whether the document has a letterhead: a picture the size of the page under the text of every page. */
  get hasLetterhead(): boolean {
    return !!letterheadOf(this.doc);
  }

  /** The picture the letterhead is, as it is kept in the document: to save it apart, or to put it on another one. */
  get letterhead(): { bytes: Uint8Array; type: string } | undefined {
    return letterheadImage(this.doc);
  }

  /** Gives the document a letterhead, in place of the one it had: a picture, stretched over the whole page. */
  setLetterhead(bytes: Uint8Array, type: string): void {
    const doc = setLetterhead(this.doc, { bytes, type });
    if (doc !== this.doc) this.commitDoc(doc, this.selection);
  }

  /**
   * Gives the document the letterhead a file is. Unless `fit` is false, the
   * top and bottom margins grow to clear what the letterhead prints there: a
   * logo, an address. All of it is one step to undo. Resolves to whether the
   * file is a picture that can be a letterhead.
   */
  async setLetterheadFile(file: Blob, fit = true): Promise<boolean> {
    if (!imageExtension(file.type)) {
      // A file that does not say what it is, as one from a server that does not: the picture says it by how it starts.
      const type = imageTypeOf(new Uint8Array(await file.slice(0, 8).arrayBuffer()));
      if (!type) return false;
      file = new Blob([file], { type });
    }
    try {
      // Read as a picture first: a file that is not the picture it says it is must not get into the document.
      const asked = fit ? await this.marginsFor(file) : ((await createImageBitmap(file)).close(), {});
      let doc = setLetterhead(this.doc, { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type });
      if (doc === this.doc) return false;
      doc = withLetterheadMargins(doc, asked);
      this.commitDoc(doc, this.selection);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Makes the top and bottom margins clear what the letterhead prints at the
   * top and the bottom of the page. They only grow: a margin that already
   * clears it stays. Resolves to whether there was anything to change.
   */
  async fitLetterheadMargins(): Promise<boolean> {
    const image = letterheadImage(this.doc);
    if (!image) return false;
    try {
      const doc = withLetterheadMargins(this.doc, await this.marginsFor(new Blob([image.bytes as BlobPart], { type: image.type })));
      if (doc === this.doc) return false;
      this.commitDoc(doc, this.selection);
      return true;
    } catch {
      return false;
    }
  }

  /** The margins a picture asks for as a letterhead, read from its pixels, small: its shapes are what matters. */
  private async marginsFor(file: Blob): Promise<{ top?: number; bottom?: number }> {
    const bitmap = await createImageBitmap(file);
    const width = Math.min(320, bitmap.width);
    const height = Math.max(1, Math.round((bitmap.height * width) / bitmap.width));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return letterheadMargins({ width, height, data: context.getImageData(0, 0, width, height).data }, this.doc.page);
  }

  removeLetterhead(): void {
    const doc = removeLetterhead(this.doc);
    if (doc !== this.doc) this.commitDoc(doc, this.selection);
  }

  // --- PDF ----------------------------------------------------------------

  /**
   * The document as a PDF, page for page as it is shown. The fonts the file
   * carries go into it; any other is named by the nearest of the three every
   * PDF reader has, with each word where it is here.
   */
  async exportPdf(title?: string): Promise<Uint8Array> {
    this.updateToc();
    const layout = this.paged;
    const doc = this.doc;
    // The pictures are read first: decoding one takes the browser a moment.
    const pictures = new Map<string, PdfImage>();
    const wanted = new Map<string, { xml: string; part?: FloatBox['part'] }>();
    for (const page of layout.pages) {
      for (const [band, usual] of [[page.header, 'header'], [page, undefined], [page.footer, 'footer']] as const) {
        if (!band) continue;
        // The first page may have a header of its own, whose pictures live in another part.
        const part = (band as Band).part ?? usual;
        for (const float of band.floats) wanted.set(`${float.part ?? ''}\n${float.xml}`, { xml: float.xml, part: float.part });
        for (const line of band.lines) {
          for (const f of line.fragments) {
            if (f.kind === 'object' && f.width > 0) wanted.set(`${part ?? ''}\n${f.props.object}`, { xml: f.props.object, part });
          }
        }
      }
    }
    for (const [key, { xml, part }] of wanted) {
      const media = docImage(doc, xml, part);
      if (!media) continue;
      try {
        const bitmap = await createImageBitmap(new Blob([media.bytes as BlobPart], { type: media.type }));
        const shrink = Math.min(1, MAX_PDF_PIXELS / Math.max(bitmap.width, bitmap.height));
        if (media.type === 'image/jpeg' && shrink === 1) {
          pictures.set(key, { width: bitmap.width, height: bitmap.height, jpeg: media.bytes });
        } else {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(bitmap.width * shrink));
          canvas.height = Math.max(1, Math.round(bitmap.height * shrink));
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const rgb = new Uint8Array(canvas.width * canvas.height * 3);
          const alpha = new Uint8Array(canvas.width * canvas.height);
          for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
            rgb[i * 3] = data[p];
            rgb[i * 3 + 1] = data[p + 1];
            rgb[i * 3 + 2] = data[p + 2];
            alpha[i] = data[p + 3];
          }
          pictures.set(key, { width: canvas.width, height: canvas.height, rgb, alpha });
        }
        bitmap.close();
      } catch {
        // A picture the browser cannot read is left out, as it is on the page.
      }
    }
    const fonts = doc.source ? embeddedFonts(doc.source) : [];
    return exportPdf(layout, {
      measurer: this.measurer,
      title,
      doc,
      language: this.textLanguage,
      font: (spec) => {
        const family = fonts.filter((font) => font.family.toLowerCase() === spec.family.toLowerCase());
        // The ones the document carries, then the ones the application gave.
        return (family.find((font) => font.bold === spec.bold && font.italic === spec.italic) ?? family.find((font) => !font.bold && !font.italic))?.bytes ?? fontFile(spec);
      },
      image: (xml, part) => pictures.get(`${part ?? ''}\n${xml}`),
    });
  }

  /** The paragraph styles on offer, the default one first. */
  get styles(): ParagraphStyle[] {
    return paragraphStyles(this.doc);
  }

  /** The style every paragraph of the selection has, or undefined when they differ. */
  activeStyleId(): string | undefined {
    const { from, to } = this.range;
    const id = styleIdAt(this.text, from.para);
    for (let i = from.para + 1; i <= to.para; i++) if (styleIdAt(this.text, i) !== id) return undefined;
    return id;
  }

  /** Gives the paragraphs of the selection a style: Normal, a title, a heading... */
  setParagraphStyle(id: string): void {
    const { from, to } = this.range;
    const doc = setParagraphStyle(this.text, from.para, to.para, id);
    if (doc !== this.text) this.commit(doc, this.selection);
  }

  /** True when the caret is in a table, where rows and columns can be added and removed. */
  get inTable(): boolean {
    return !!this.text.paragraphs[this.selection.focus.para].cell;
  }

  /**
   * Whether a table can be made at the caret, or the one it is in reshaped.
   * False in a table a header or a footer came with from its file: its cells
   * can be written in, but the file is written back with the shape it had.
   */
  get canEditTables(): boolean {
    if (this.area === 'body') return true;
    const fixed = storySource(this.doc, this.part!)?.story.tables?.length ?? 0;
    const table = this.text.paragraphs[this.selection.focus.para]?.cell?.table;
    return table === undefined || table >= fixed;
  }

  /** Inserts an empty table at the caret. Not inside another table. */
  insertTable(rows: number, columns: number): void {
    if (this.inTable || !this.canEditTables) return;
    const doc = this.collapsed ? this.text : deleteRange(this.text, this.range);
    const result = insertTable(doc, this.range.from, rows, columns);
    if (result.doc !== doc) this.commit(result.doc, { anchor: result.pos, focus: result.pos });
  }

  /** Puts in a place to sign for each of the titles (an adviser and a client, if none are given), side by side, with the first name selected to type over. */
  insertSignatures(titles: string[] = [t('sign.adviser'), t('sign.client')]): void {
    if (this.inTable || !this.canEditTables) return;
    const doc = this.collapsed ? this.text : deleteRange(this.text, this.range);
    const result = insertSignatures(doc, this.range.from, titles, t('sign.name'));
    if (result.doc === doc) return;
    this.commit(result.doc, { anchor: result.name?.from ?? result.pos, focus: result.name?.to ?? result.pos });
  }

  /** Adds a row above or below the caret's, or a column to its left or right. */
  insertTableRow(below: boolean): void {
    if (!this.canEditTables) return;
    this.reshapeTable(insertRow(this.text, this.selection.focus.para, below));
  }

  insertTableColumn(right: boolean): void {
    if (!this.canEditTables) return;
    this.reshapeTable(insertColumn(this.text, this.selection.focus.para, right));
  }

  deleteTableRow(): void {
    if (!this.canEditTables) return;
    const result = deleteRow(this.text, this.selection.focus.para);
    if (result.doc !== this.text) this.commit(result.doc, { anchor: result.pos, focus: result.pos });
  }

  deleteTableColumn(): void {
    if (!this.canEditTables) return;
    const result = deleteColumn(this.text, this.selection.focus.para);
    if (result.doc !== this.text) this.commit(result.doc, { anchor: result.pos, focus: result.pos });
  }

  /** Removes the whole table the caret is in, the innermost for a table in a cell. */
  deleteTable(): void {
    if (!this.canEditTables) return;
    const result = deleteTable(this.text, this.selection.focus.para);
    if (result.doc !== this.text) this.commit(result.doc, { anchor: result.pos, focus: result.pos });
  }

  /** True when the selection covers several cells of a table, which can be made one. */
  get canMergeCells(): boolean {
    return this.canEditTables && canMergeCells(this.text, this.selection.anchor.para, this.selection.focus.para);
  }

  /** Makes one cell of the cells the selection covers. */
  mergeTableCells(): void {
    if (!this.canMergeCells) return;
    const result = mergeCells(this.text, this.selection.anchor.para, this.selection.focus.para);
    if (result.doc !== this.text) this.commit(result.doc, { anchor: result.pos, focus: result.pos });
  }

  /** True when the caret's cell is a merged one, which can be split back. */
  get canSplitCell(): boolean {
    return this.canEditTables && canSplitCell(this.text, this.selection.focus.para);
  }

  splitTableCell(): void {
    if (this.canSplitCell) this.reshapeTable(splitCell(this.text, this.selection.focus.para));
  }

  /** The borders, the line, the shading, the place and the direction of the text of the caret's cell, and whether its row is a heading; undefined outside a table. */
  activeCellProps():
    | { borders: boolean; shade: string; valign: 'top' | 'center' | 'bottom'; direction: 'level' | 'up' | 'down'; line?: Border; header: boolean; height: number; exact: boolean }
    | undefined {
    const loc = locateCell(this.text, this.selection.focus.para);
    if (!loc) return undefined;
    const { cell, row } = loc;
    const sides = cell.lines;
    // The line the cell is drawn with, when all its sides have the same one.
    const line = sides?.top && (['right', 'bottom', 'left'] as const).every((k) => JSON.stringify(sides[k]) === JSON.stringify(sides.top)) ? sides.top : undefined;
    return { borders: cell.borders, shade: cell.shade ?? '', valign: cell.valign ?? 'top', direction: cell.direction ?? 'level', line, header: !!row.header, height: row.height, exact: !!row.exact };
  }

  /** Sets the borders, their line, the shading ('' for none), the place or the direction of the text of the cells the selection covers. */
  setTableCellProps(patch: CellPatch): void {
    if (!this.canEditTables) return;
    const doc = setCellProps(this.text, this.selection.anchor.para, this.selection.focus.para, patch);
    if (doc !== this.text) this.commit(doc, this.selection);
  }

  /** The first and the last paragraph of the table the caret is in. */
  private tableSpan(): { from: number; to: number } | undefined {
    const table = this.text.paragraphs[this.selection.focus.para].cell?.table;
    if (table === undefined) return undefined;
    // The paragraphs of a table are consecutive, those of the tables in its cells among them.
    const { paragraphs, tables } = this.text;
    const from = paragraphs.findIndex((p) => cellOfTable(tables, p.cell, table));
    let to = from;
    while (cellOfTable(tables, paragraphs[to + 1]?.cell, table)) to++;
    return { from, to };
  }

  /** Whether any cell of the caret's table has borders; undefined outside a table. */
  tableBorders(): boolean | undefined {
    const table = locateCell(this.text, this.selection.focus.para)?.table;
    return table && table.rows.some((row) => row.cells.some((cell) => cell.borders));
  }

  /** Shows or hides the borders of every cell of the caret's table. */
  setTableBorders(on: boolean): void {
    const span = this.tableSpan();
    if (!span || !this.canEditTables) return;
    const doc = setCellProps(this.text, span.from, span.to, { borders: on });
    if (doc !== this.text) this.commit(doc, this.selection);
  }

  /** Makes the caret's row, and those above it, heading rows shown again on every page the table goes on to; or makes it an ordinary row again. */
  /** Sets the height of the caret's row, in points: the least it is given or, `exact`, the one it has whatever it holds; 0 for as tall as what it holds. */
  setTableRowHeight(height: number, exact = false): void {
    if (!this.canEditTables) return;
    const doc = setRowHeight(this.text, this.selection.focus.para, height, exact);
    if (doc !== this.text) this.commit(doc, this.selection);
  }

  setHeaderRow(on: boolean): void {
    if (!this.canEditTables) return;
    const doc = setHeaderRow(this.text, this.selection.focus.para, on);
    if (doc !== this.text) this.commit(doc, this.selection);
  }

  /** Commits a change of shape that kept the caret's paragraph, which may now be at another index. */
  private reshapeTable(doc: Doc): void {
    if (doc === this.text) return;
    const { focus } = this.selection;
    const para = doc.paragraphs.indexOf(this.text.paragraphs[focus.para]);
    const pos = para < 0 ? clampPosition(doc, focus) : { para, offset: focus.offset };
    this.commit(doc, { anchor: pos, focus: pos });
  }

  /** The kind of list every paragraph of the selection is in, if they all share one. */
  activeListKind(): ListKind | undefined {
    const { from, to } = this.range;
    const kind = listKindAt(this.text, from.para);
    for (let i = from.para + 1; i <= to.para; i++) if (listKindAt(this.text, i) !== kind) return undefined;
    return kind;
  }

  toggleList(kind: ListKind): void {
    const { from, to } = this.range;
    this.commit(toggleList(this.text, from.para, to.para, kind), this.selection);
  }

  /** Moves the list items of the selection one level deeper (1) or shallower (-1). */
  shiftListLevel(delta: -1 | 1): void {
    const { from, to } = this.range;
    const doc = shiftListLevel(this.text, from.para, to.para, delta);
    if (doc.paragraphs.some((p, i) => p !== this.text.paragraphs[i])) this.commit(doc, this.selection);
  }

  /** How the label of the caret's list level is written; undefined outside a list. */
  get listStyle(): ListStyle | undefined {
    return listStyleAt(this.text, this.range.from.para);
  }

  /**
   * Writes the labels of the selection's lists another way: "a.-", "1)",
   * "I.", a "–" for a bullet. Paragraphs outside a list are put in one first,
   * of numbers or bullets as the style is. As one step to undo.
   */
  setListStyle(style: ListStyle): void {
    const { from, to } = this.range;
    let doc = this.text;
    const kind: ListKind = style.format === 'bullet' ? 'bullet' : 'number';
    for (let i = from.para; i <= to.para; i++) {
      if (!doc.paragraphs[i].props.numId) {
        doc = toggleList(doc, from.para, to.para, kind);
        break;
      }
    }
    doc = setListStyle(doc, from.para, to.para, style);
    if (doc !== this.text) this.commit(doc, this.selection);
  }

  /** The caret's list item counts from the start again, and those after it with it. */
  restartNumbering(): void {
    const doc = restartNumbering(this.text, this.selection.focus.para);
    if (doc !== this.text) this.commit(doc, this.selection);
  }

  /** The caret's list item, and those after it, go on with the numbering of the list before. */
  continueNumbering(): boolean {
    const doc = continueNumbering(this.text, this.selection.focus.para);
    if (doc === this.text) return false;
    this.commit(doc, this.selection);
    return true;
  }

  /** Moves the left indent of the selected paragraphs by `delta` points; it never goes past the margin. */
  shiftIndent(delta: number): void {
    const { from, to } = this.range;
    let doc = this.text;
    for (let i = from.para; i <= to.para; i++) {
      const indentLeft = Math.max(0, resolveParagraph(doc.paragraphs[i].props).indentLeft + delta);
      if (indentLeft !== resolveParagraph(doc.paragraphs[i].props).indentLeft) doc = setParagraphProps(doc, i, i, { indentLeft });
    }
    if (doc !== this.text) this.commit(doc, this.selection);
  }

  /**
   * Puts a note at the foot of the page at the caret, in place of what is
   * selected, and takes the caret into it to write it. Notes are numbered in
   * the order of their references in the text.
   */
  /**
   * Puts a text box in at the caret, anchored to its paragraph and with the
   * text going round it, and takes the caret into it. Says its id.
   */
  insertTextBox(text = ''): string | undefined {
    if (this.locked || this.area !== 'body') return undefined;
    const width = Math.min(180, this.textColumn().right - this.textColumn().left);
    const made = insertTextBox(this.text, this.range.from, { width, height: 54, text });
    this.commit(made.doc, { anchor: made.pos, focus: made.pos });
    this.setArea('textbox', undefined, made.id);
    if ((this.area as EditArea) === 'textbox') this.setSelection(docEnd(this.text));
    return made.id;
  }

  /** The text boxes of the document, each with its id and its text. */
  get textBoxes(): { id: string; text: string }[] {
    return (this.doc.textBoxes ?? []).map((box) => ({ id: box.id, text: box.paragraphs.map((p) => p.runs.map((run) => run.text).join('')).join('\n').replace(/[\u2060\uFFFC]/g, '') }));
  }

  insertFootnote(text = ''): void {
    if (this.area !== 'body') return;
    const doc = this.collapsed ? this.doc : deleteRange(this.doc, this.range);
    const result = insertFootnote(doc, outsideField(doc, this.range.from), text);
    this.commitDoc(result.doc, { anchor: result.pos, focus: result.pos });
    if (this.view === 'flow') return;
    this.setArea('footnote', undefined, result.id);
    const note = this.text.paragraphs;
    const end = { para: note.length - 1, offset: paragraphLength(note[note.length - 1]) };
    this.setSelection(end);
  }

  /** The notes at the foot of the pages that the text refers to, in the order of their numbers. */
  get footnotes(): { id: string; number: number; text: string }[] {
    const numbers = footnoteNumbers(this.doc);
    return shownFootnotes(this.doc).map((note) => ({ id: note.id, number: numbers.get(note.id)!, text: note.paragraphs.map((p) => paragraphText(p).replace(/[\u2060\uFFFC]/g, '')).join('\n').trim() }));
  }

  /** Starts a new page at the caret. */
  insertPageBreak(): void {
    // In a cell the break stays in its paragraph: a cell is not split into pages by a paragraph of its own.
    if (this.inTable || this.area !== 'body') {
      this.insertText('\f');
      return;
    }
    const range = this.range;
    const { field: _, ...props } = this.pendingProps ?? this.activeRunProps();
    const doc = this.collapsed ? this.text : deleteRange(this.text, range);
    const broken = insertFragment(doc, outsideField(doc, range.from), '\f', props);
    // As Word's Ctrl+Enter: the break ends its paragraph, and what follows starts a new one at the top of
    // the next page, the caret in it. A break at the very end would leave that page with no line to be on.
    const split = splitParagraph(broken.doc, broken.pos);
    this.commit(split.doc, { anchor: split.pos, focus: split.pos });
  }

  /** The columns of the section the caret is in; one outside the body of the document. */
  get columns(): Columns {
    return this.area === 'body' ? columnsAt(this.doc, this.selection.focus.para) : ONE_COLUMN;
  }

  /**
   * Sets the text in columns: the whole section the caret is in or, with a
   * selection, the selected paragraphs alone, as a section of their own on
   * the same page as what is around them.
   */
  setColumns(columns: Columns): void {
    if (this.area !== 'body') return;
    const doc = setColumns(this.doc, this.range, columns);
    if (doc !== this.doc) this.commitDoc(doc, this.selection);
  }

  /** Goes on in the next column from the caret: what follows starts at the top of it. */
  insertColumnBreak(): void {
    if (this.area !== 'body' || this.inTable) return;
    const doc = this.collapsed ? this.doc : deleteRange(this.doc, this.range);
    const result = insertColumnBreak(doc, this.range.from);
    if (result.doc !== doc) this.commitDoc(result.doc, { anchor: result.pos, focus: result.pos });
  }

  /**
   * Starts a new section at the caret, as Word's section break: on the next
   * page, or `continuous` on the same one. What comes before keeps how it is
   * set out; what follows can then be given another page, other margins,
   * columns or a header of its own.
   */
  insertSectionBreak(start: 'nextPage' | 'continuous' = 'nextPage'): void {
    if (this.area !== 'body' || this.inTable) return;
    const doc = this.collapsed ? this.doc : deleteRange(this.doc, this.range);
    const result = insertSectionBreak(doc, this.range.from, start);
    if (result.doc === doc) return;
    this.commitDoc(result.doc, { anchor: result.pos, focus: result.pos });
    this.announcer.say(t('area.section', { n: this.sectionIndex + 1 }), true);
  }

  /** Changes the size or the margins of the page of the section, or, with `everywhere`, of every section. */
  setPage(patch: Partial<PageSetup>, everywhere = false): void {
    const marks = sectionMarks(this.doc);
    const index = this.sectionIndex;
    let doc = this.doc;
    for (const [k, para] of [...marks, this.doc.paragraphs.length - 1].entries()) if (everywhere || k === index) doc = setSectionPage(doc, para, patch);
    if (doc !== this.doc) this.commitDoc(doc, this.selection);
  }

  /** Gives each section the page it had: `pages` as `sectionPages` gave them, for a document with the same sections. */
  setSectionPages(pages: PageSetup[]): void {
    const marks = sectionMarks(this.doc);
    if (pages.length !== marks.length + 1) return;
    let doc = this.doc;
    for (const [k, para] of [...marks, this.doc.paragraphs.length - 1].entries()) doc = setSectionPage(doc, para, pages[k]);
    if (doc !== this.doc) this.commitDoc(doc, this.selection);
  }

  /** Where the page number is and how it reads; undefined when the document has none. */
  get pageNumbering(): PageNumbering | undefined {
    return pageNumbering(this.doc);
  }

  /** Puts the page number in the header or the footer, moves it, or takes it away. */
  setPageNumbering(numbering: PageNumbering | undefined): void {
    // The words around the number are text of the document, written in the language of the interface.
    const doc = setPageNumbering(this.doc, numbering && { words: { page: t('page.word'), of: t('page.of') }, ...numbering });
    if (doc !== this.doc) this.commitDoc(doc, this.selection);
  }

  /** The page the caret is on, counting from 1. */
  get currentPage(): number {
    if (this.area !== 'body') return this.areaPage + 1;
    return lineForPosition(this.paged, this.selection.focus).page + 1;
  }

  /** True when Tab changes the list level instead of typing a tab: at the start of an item, or over several. */
  /**
   * In a list item, Tab and Shift+Tab change its level wherever the caret is
   * in it, as in Google Docs: going back up after a sublist is one key, not a
   * trip to the start of the line.
   */
  private tabChangesLevel(): boolean {
    const { from, to } = this.range;
    for (let i = from.para; i <= to.para; i++) if (!this.text.paragraphs[i].props.numId) return false;
    return true;
  }

  undo(): void {
    const could = this.canUndo;
    if (this.history) this.history.undo();
    else this.restore(this.undoStack, this.redoStack);
    this.announcer.say(t(could ? 'a11y.undone' : 'a11y.nothingToUndo'), true);
  }

  redo(): void {
    const could = this.canRedo;
    if (this.history) this.history.redo();
    else this.restore(this.redoStack, this.undoStack);
    this.announcer.say(t(could ? 'a11y.redone' : 'a11y.nothingToRedo'), true);
  }

  get canUndo(): boolean {
    return this.history ? this.history.canUndo : this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.history ? this.history.canRedo : this.redoStack.length > 0;
  }

  private restore(from: Snapshot[], to: Snapshot[]): void {
    if (this.locked) return;
    const snapshot = from.pop();
    if (!snapshot) return;
    to.push(this.snapshot());
    this.doc = snapshot.doc;
    this.area = snapshot.area;
    this.areaPage = snapshot.areaPage;
    this.areaNote = snapshot.areaNote;
    this.selection = snapshot.selection;
    this.syncArea();
    this.afterDocChange();
  }

  private snapshot(): Snapshot {
    return { doc: this.doc, selection: this.selection, area: this.area, areaPage: this.areaPage, areaNote: this.areaNote };
  }

  /**
   * Commits a change to the text the selection is in. While changes are
   * tracked, what it took out stays, marked, and what it put in is marked,
   * unless `tracked` is false: accepting and rejecting are no changes to track.
   */
  private commit(text: Doc, selection: Selection, kind = '', tracked = true): void {
    this.typedAt = kind === 'type' ? selection.focus : undefined;
    if (tracked && this.doc.trackRevisions && !this.locked && text !== this.text) {
      const edit = trackEdit(this.text, text, this.reviser());
      const caret = comparePositions(selection.anchor, selection.focus) === 0 ? (this.forward ? 'forward' : 'back') : undefined;
      selection = { anchor: edit.map(selection.anchor, caret), focus: edit.map(selection.focus, caret) };
      text = edit.doc;
    }
    this.commitDoc(this.merged(text), selection, kind);
  }

  /** Who the changes made here are by, and when: now. */
  private reviser(): { author: string; date: string } {
    return { author: this.author || t('note.anonymous'), date: revisionNow() };
  }

  /** Commits a change to the document as a whole. */
  private commitDoc(doc: Doc, selection: Selection, kind = ''): void {
    if (this.locked) return;
    const now = Date.now();
    const merge = kind !== '' && kind === this.lastEdit.kind && now - this.lastEdit.time < TYPING_MERGE_MS;
    this.commits++;
    if (!merge) {
      this.steps++;
      if (!this.history) this.undoStack.push(this.snapshot());
    }
    this.redoStack = [];
    this.doc = doc;
    this.selection = selection;
    this.afterDocChange();
    this.lastEdit = { kind, time: now };
  }

  private afterDocChange(reveal = true): void {
    this.ensureStory();
    // What was changed may not be what the selection is in: the page number, from inside the footer.
    this.selection = { anchor: clampPosition(this.text, this.selection.anchor), focus: clampPosition(this.text, this.selection.focus) };
    this.pendingProps = null;
    this.goalX = null;
    this.lastEdit.kind = '';
    this.refind();
    this.render();
    // The page whose header was being edited may be gone; a note may have gone to another page, or away with its reference.
    this.areaPage = Math.min(this.areaPage, this.pageCount - 1);
    if (this.area === 'footnote' || this.area === 'textbox') {
      const page = this.notePage(this.areaNote!, this.areaPage, this.area);
      if (page === undefined) {
        this.area = 'body';
        this.areaNote = undefined;
        this.syncArea();
        this.selection = { anchor: clampPosition(this.doc, this.selection.anchor), focus: clampPosition(this.doc, this.selection.focus) };
      } else this.areaPage = page;
    }
    this.renderSelection();
    if (reveal) this.scrollCaretIntoView();
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  // --- Rendering ----------------------------------------------------------

  private render(): void {
    if (this.view === 'flow') {
      this.flowWidth = this.windowWidth();
      this.layout = layoutReflow(this.shown, this.measurer, { width: this.flowWidth, margin: FLOW_MARGIN }, this.flowCache);
    } else {
      this.layout = layoutDocument(this.shown, this.measurer, this.layoutCache);
    }
    // The page may have changed size under a zoom that follows the window.
    if (this.fit) this.zoom = this.clampZoom(this.fitZoom(this.fit));
    this.paint();
  }

  /** Which pages are in view, with a screen above and below; all of them when there is no view to go by. */
  private pagesInView(): [number, number] {
    const last = this.pageEls.length - 1;
    const view = this.root.getBoundingClientRect();
    if (this.drawAll || view.height === 0 || last < 0) return [0, last];
    const top = view.top - view.height;
    const bottom = view.bottom + view.height;
    let first = -1;
    let end = -1;
    // From the top down: pages go down the window in their order, or row by row side by side.
    for (let i = 0; i <= last; i++) {
      const rect = this.pageEls[i].getBoundingClientRect();
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
  private onScroll = (): void => {
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
  private paint(): void {
    const { pages } = this.layout;
    while (this.pageEls.length > pages.length) {
      this.pageEls.pop()!.remove();
      this.sheetEls.pop();
      this.selLayers.pop();
    }
    this.painted.length = Math.min(this.painted.length, pages.length);
    // Every page in its place and at its size first: which are in view depends on it.
    pages.forEach((_, i) => {
      let el = this.pageEls[i];
      if (!el) {
        el = document.createElement('div');
        el.className = 'dx-page';
        // Positioned pieces of text a screen reader cannot follow: what the caret meets is said instead.
        el.setAttribute('aria-hidden', 'true');
        this.pagesEl.insertBefore(el, this.input);
        const sheet = document.createElement('div');
        sheet.className = 'dx-sheet';
        el.appendChild(sheet);
        this.pageEls.push(el);
        this.sheetEls.push(sheet);
        this.selLayers.push(document.createElement('div'));
      }
      this.sizePage(i);
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
        JSON.stringify([layoutPage.rules ?? [], layoutPage.footnotes?.rule ?? null, boxes.map((box) => [box.frame, box.look])]) === before.rules
      ) {
        return;
      }
      this.painted[i] = { lines: lines.map((l) => ({ raw: l.raw, y: l.y, turn: l.turn })), cells, floats: floats.length, rules: JSON.stringify([layoutPage.rules ?? [], layoutPage.footnotes?.rule ?? null, boxes.map((box) => [box.frame, box.look])]) };

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
        // The line above the notes at the foot of the page.
        const notesRule = (band as LayoutPage).footnotes?.rule;
        if (notesRule) {
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
        const paragraphsOf = name === 'body' ? this.shown.paragraphs : (band as Band).part ? storyOf(this.shown, (band as Band).part!)?.paragraphs : undefined;
        const barAt = this.setupOf(i).marginLeft - CHANGE_BAR_GAP;
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
      const image = docImage(this.doc, xml, part);
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
  private loadEmbeddedFonts(): void {
    for (const face of this.fontFaces) document.fonts.delete(face);
    this.fontFaces = [];
    const { source } = this.doc;
    if (!source) return;
    const faces = embeddedFonts(source)
      .filter((font) => !this.measurer.hasFont(font.family))
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
      if (this.doc.source !== source) return;
      results.forEach((result, i) => {
        if (result.status !== 'fulfilled') return;
        document.fonts.add(faces[i]);
        this.fontFaces.push(faces[i]);
      });
      if (this.fontFaces.length) this.refont();
    });
  }

  /** Lays the document out again from nothing: the fonts behind the names of its text are no longer the same. */
  private refont(): void {
    this.measurer.reset();
    this.layoutCache = createLayoutCache();
    this.flowCache = createLayoutCache();
    this.pagedView = undefined;
    this.painted = [];
    this.render();
    this.renderSelection();
    this.emit();
  }

  private releaseImages(): void {
    for (const url of this.imageUrls.values()) if (url) URL.revokeObjectURL(url);
    this.imageUrls.clear();
  }

  /**
   * The notes beside the pages, each level with the text it is about and
   * pushed down where the one above leaves no room: the margin Word shows
   * its comments in.
   */
  private renderMargin(): void {
    const on = this.showNotes && this.view !== 'grid' && this.view !== 'flow' && this.area === 'body';
    this.root.classList.toggle('dx-notes-on', on);
    this.pageEls.forEach((page, i) => {
      page.style.marginRight = on ? `${NOTE_MARGIN * this.zoom}pt` : '';
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
      margin.style.transform = this.zoom === 1 ? '' : `scale(${this.zoom})`;
      margin.replaceChildren();
    });
    this.marginEls.length = Math.min(this.marginEls.length, this.pageEls.length);
    if (!on || !this.doc.notes?.length) return;
    const active = this.activeNote;
    const byId = new Map(this.doc.notes.map((note) => [note.id, note]));
    const flow = this.flow;
    /** Where the next note of each page can start, in pixels from its top. */
    const free: number[] = [];
    const paras = this.drawnParas();
    for (const { id, range } of noteRanges(this.doc)) {
      // The card of a note on a page not drawn waits until the page comes near.
      if (paras && (this.mapOffset(range.to, true).para < paras[0] || this.mapOffset(range.from, true).para > paras[1])) continue;
      const note = byId.get(id);
      // A note is level with where its text starts; one on no text at all, with where it is.
      const at = selectionRects(flow, this.measurer, { from: this.mapOffset(range.from, true), to: this.mapOffset(range.to, true) })[0] ?? caretRect(flow, this.measurer, this.mapOffset(range.from, true));
      const margin = note && at && this.isDrawn(this.pageOf(at.page)) && this.marginEls[this.pageOf(at.page)];
      if (!note || !margin) continue;
      const page = this.pageOf(at.page);
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
        this.selectNote(id);
        this.focus();
      });
      margin.appendChild(card);
      const top = Math.max(at.y * PT_TO_PX - 2, free[page] ?? 0);
      card.style.top = `${top}px`;
      free[page] = top + card.offsetHeight + 6;
    }
  }

  /** A small button over the table of contents, at the right of its first line, that brings it up to date. */
  private renderTocChip(): void {
    if (this.area !== 'body' || this.locked) return;
    const range = tocRange(this.doc);
    if (!range) return;
    const at = caretRect(this.flow, this.measurer, this.mapOffset({ para: range.first, offset: 0 }, true));
    const chip = document.createElement('div');
    chip.className = 'dx-toc-chip';
    chip.dataset.name = 'toc-update';
    chip.setAttribute('role', 'button');
    chip.textContent = `↻ ${t('toc.update')}`;
    chip.style.right = `${this.setupOf(at.page).marginRight}pt`;
    chip.style.top = `${at.y - 19}pt`;
    // A press on it is not a press on the page.
    chip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    chip.addEventListener('click', () => {
      this.updateToc();
      this.focus();
    });
    this.selLayers[this.pageOf(at.page)].appendChild(chip);
  }

  // --- Spelling -------------------------------------------------------------

  /**
   * What says which words are spelled wrong; none, and nothing is marked.
   * Only the words of the pages near the view are asked about, a moment after
   * typing stops, in the language of the text (`textLanguage`).
   */
  get spellChecker(): SpellChecker | undefined {
    return this.speller;
  }

  set spellChecker(checker: SpellChecker | undefined) {
    if (checker === this.speller) return;
    this.speller = checker;
    this.spelled.clear();
    this.spellWaiting.clear();
    this.spellSuggestions.clear();
    this.renderSelection();
  }

  /** The words of a paragraph to check, kept while it is the same. */
  private spellWords = new WeakMap<Paragraph, SpelledWord[]>();
  private wordsOfParagraph(para: Paragraph): SpelledWord[] {
    let words = this.spellWords.get(para);
    if (!words) {
      // Text taken out, while the change waits, is not checked.
      const gone: [number, number][] = [];
      let at = 0;
      for (const run of para.runs) {
        if (run.props.revision === 'delete') gone.push([at, at + run.text.length]);
        at += run.text.length;
      }
      words = wordsToCheck(paragraphText(para)).filter((word) => !gone.some(([from, to]) => word.from < to && word.to > from));
      this.spellWords.set(para, words);
    }
    return words;
  }

  /** What the dictionary said of a word in the language of the text: undefined until it has said. */
  private spelledRight(word: string): boolean | undefined {
    if (this.spellIgnored.has(word)) return true;
    return this.spelled.get(this.textLanguage)?.get(word);
  }

  /** Marks the words spelled wrong on the pages drawn, and asks about those not known yet. */
  private markSpelling(paras: [number, number] | undefined): void {
    if (!this.speller || this.area !== 'body' || !paras || this.locked) return;
    const typed = this.typedAt;
    for (let p = paras[0]; p <= paras[1]; p++) {
      const para = this.text.paragraphs[p];
      if (!para) continue;
      for (const word of this.wordsOfParagraph(para)) {
        // The word being written is not finished yet.
        if (typed && typed.para === p && typed.offset === word.to) continue;
        const right = this.spelledRight(word.word);
        if (right === undefined) this.spellWaiting.add(word.word);
        if (right !== false) continue;
        for (const rect of selectionRects(this.flow, this.measurer, { from: { para: p, offset: word.from }, to: { para: p, offset: word.to } })) {
          if (!this.isDrawn(rect.page)) continue;
          const div = document.createElement('div');
          div.className = 'dx-spell';
          div.style.left = `${rect.x}pt`;
          div.style.top = `${rect.y + rect.height - 3}pt`;
          div.style.width = `${rect.width}pt`;
          this.selLayers[rect.page].appendChild(div);
        }
      }
    }
    if (this.spellWaiting.size) {
      window.clearTimeout(this.spellTimer);
      this.spellTimer = window.setTimeout(() => void this.askSpelling(), SPELL_WAIT_MS);
    }
  }

  /** Asks the dictionary about the words waiting, in one question, and marks what it says. */
  private async askSpelling(): Promise<void> {
    const speller = this.speller;
    if (!speller || this.spellAsking || !this.spellWaiting.size) return;
    const language = this.textLanguage;
    const words = [...this.spellWaiting];
    this.spellWaiting.clear();
    this.spellAsking = true;
    let known = this.spelled.get(language);
    if (!known) this.spelled.set(language, (known = new Map()));
    try {
      const answers = await speller.check(words, language);
      words.forEach((word, i) => known.set(word, answers[i] !== false));
    } catch {
      // A dictionary that cannot be had marks nothing, rather than every word.
      for (const word of words) known.set(word, true);
    } finally {
      this.spellAsking = false;
    }
    if (speller !== this.speller || !this.root.isConnected) return;
    this.renderSelection();
    if (this.spellWaiting.size) void this.askSpelling();
  }

  /** The word spelled wrong the caret is in, or at the end of; undefined when there is none, or it is not known yet. */
  get misspelling(): { word: string; range: Range } | undefined {
    if (!this.speller || this.area !== 'body' || !this.collapsed) return undefined;
    const { para, offset } = this.selection.focus;
    const paragraph = this.text.paragraphs[para];
    const word = paragraph && this.wordsOfParagraph(paragraph).find((one) => one.from <= offset && offset <= one.to);
    if (!word || this.spelledRight(word.word) !== false) return undefined;
    return { word: word.word, range: { from: { para, offset: word.from }, to: { para, offset: word.to } } };
  }

  /** What the word spelled wrong at the caret could be instead, the likeliest first. */
  spellingSuggestions(): Promise<string[]> {
    const wrong = this.misspelling;
    if (!wrong || !this.speller) return Promise.resolve([]);
    const key = `${this.textLanguage}\n${wrong.word}`;
    let asked = this.spellSuggestions.get(key);
    if (!asked) {
      asked = Promise.resolve(this.speller.suggest(wrong.word, this.textLanguage)).catch(() => []);
      this.spellSuggestions.set(key, asked);
    }
    return asked;
  }

  /** Puts `text` in place of the word spelled wrong at the caret: an edit like any other, undone with ⌘Z and tracked when changes are. */
  replaceMisspelling(text: string): void {
    const wrong = this.misspelling;
    if (!wrong || !text) return;
    this.setSelection(wrong.range.from, wrong.range.to);
    this.insertText(text);
  }

  /** Leaves the word spelled wrong at the caret, and every other one like it, unmarked in this document. */
  ignoreMisspelling(): void {
    const wrong = this.misspelling;
    if (!wrong) return;
    this.spellIgnored.add(wrong.word);
    this.renderSelection();
    this.emit();
  }

  /** Whether the dictionary takes new words, for "Add to dictionary". */
  get canAddWords(): boolean {
    return !!this.speller?.add;
  }

  /** Gives the word spelled wrong at the caret to the dictionary, as spelled right from now on. */
  addMisspelling(): void {
    const wrong = this.misspelling;
    if (!wrong || !this.speller?.add) return;
    this.speller.add(wrong.word, this.textLanguage);
    this.spelled.get(this.textLanguage)?.set(wrong.word, true);
    this.renderSelection();
    this.emit();
  }

  /** The other button on a word spelled wrong: the caret goes into it and its suggestions are offered, in place of the browser's menu. */
  private onContextMenu = (e: MouseEvent): void => {
    if (!this.speller || this.area !== 'body') return;
    const pos = this.positionFromPoint(e.clientX, e.clientY);
    const paragraph = this.text.paragraphs[pos.para];
    const word = paragraph && this.wordsOfParagraph(paragraph).find((one) => one.from <= pos.offset && pos.offset <= one.to);
    if (!word || this.spelledRight(word.word) !== false) return;
    e.preventDefault();
    this.focus();
    this.setSelection(pos);
    this.onSpellingMenu?.();
  };

  /** The paragraphs of the body the drawn pages show, first and last, as the pages show them; undefined when that is not known. */
  private drawnParas(): [number, number] | undefined {
    if (this.area !== 'body') return undefined;
    let first = Infinity;
    let last = -Infinity;
    for (let i = this.drawn[0]; i <= this.drawn[1]; i++) {
      for (const line of this.layout.pages[i]?.lines ?? []) {
        first = Math.min(first, line.para);
        last = Math.max(last, line.para);
      }
    }
    return first <= last ? [first, last] : undefined;
  }

  private renderSelection(): void {
    // The view may have moved under a change of zoom or of view: the pages near it are drawn first.
    const near = this.pagesInView();
    if (near[0] !== this.drawn[0] || near[1] !== this.drawn[1]) this.paint();
    for (const layer of this.selLayers) if (layer.firstChild) layer.replaceChildren();
    const paras = this.drawnParas();
    /** Whether a stretch of the body, given as the document has it, is on no page drawn: nothing to mark for it. */
    const away = (range: { from: Position; to: Position }) => !!paras && (this.mapOffset(range.to, true).para < paras[0] || this.mapOffset(range.from, true).para > paras[1]);
    // The text box being written in shows where its edges are.
    for (const node of this.pagesEl.querySelectorAll<HTMLElement>('.dx-textbox')) node.classList.toggle('dx-on', this.area === 'textbox' && node.dataset.box === this.areaNote);
    const { from, to } = this.range;
    const flow = this.flow;
    for (const rect of selectionRects(flow, this.measurer, { from: this.mapOffset(from, true), to: this.mapOffset(to, true) })) {
      if (!this.isDrawn(this.pageOf(rect.page))) continue;
      const div = document.createElement('div');
      div.className = 'dx-sel';
      div.style.left = `${rect.x}pt`;
      div.style.top = `${rect.y}pt`;
      div.style.width = `${rect.width}pt`;
      div.style.height = `${rect.height}pt`;
      this.selLayers[this.pageOf(rect.page)].appendChild(div);
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
    for (const variable of paras ? variablesIn(this.text, paras) : variablesOf(this.text)) {
      if (away(variable.range)) continue;
      for (const rect of selectionRects(flow, this.measurer, { from: this.mapOffset(variable.range.from, true), to: this.mapOffset(variable.range.to, true) })) markVariable(rect, this.pageOf(rect.page));
    }
    this.markSpelling(paras);
    if (this.view !== 'flow') this.layout.pages.forEach((page, i) => {
      if (!this.isDrawn(i)) return;
      const bands: ['header' | 'footer' | FootnotePart | TextBoxPart, StoryPart][] = [
        ['header', storyPart(this.paged, 'header', i)],
        ['footer', storyPart(this.paged, 'footer', i)],
        ...(page.footnotes?.notes ?? []).map((note): [FootnotePart, StoryPart] => [note.part, note.part]),
        ...(page.textBoxes ?? []).map((box): [TextBoxPart, StoryPart] => [box.part, box.part]),
      ];
      for (const [key, part] of bands) {
        if (part === this.part && (i === this.areaPage || this.area === 'footnote' || this.area === 'textbox')) continue;
        const story = storyOf(this.shown, part);
        const band = story && bandLayout(this.layout, key, i);
        if (!band) continue;
        const shown = storyOnPage(story, i + 1, this.pageCount);
        for (const variable of variablesOf(shown)) {
          if (band.paraFirstLine[variable.range.from.para] === undefined) continue;
          for (const rect of selectionRects(band, this.measurer, variable.range)) markVariable(rect, i);
        }
      }
    });
    // The text each note is about, and more so the one the caret is in.
    if (this.area === 'body' && this.doc.notes?.length) {
      const active = this.activeNote;
      const colors = new Map(this.doc.notes.map((note) => [note.id, note.color ?? NOTE_COLORS[0]]));
      for (const note of noteRanges(this.doc)) {
        const color = colors.get(note.id);
        if (!color || away(note.range)) continue;
        const rgb = [0, 2, 4].map((i) => parseInt(color.slice(i, i + 2), 16)).join(',');
        for (const rect of selectionRects(flow, this.measurer, { from: this.mapOffset(note.range.from, true), to: this.mapOffset(note.range.to, true) })) {
          if (!this.isDrawn(this.pageOf(rect.page))) continue;
          const div = document.createElement('div');
          div.className = note.id === active ? 'dx-note dx-note-on' : 'dx-note';
          div.dataset.note = note.id;
          div.style.background = `rgba(${rgb},${note.id === active ? 0.4 : 0.2})`;
          div.style.borderBottomColor = `rgba(${rgb},.85)`;
          div.style.left = `${rect.x}pt`;
          div.style.top = `${rect.y}pt`;
          div.style.width = `${rect.width}pt`;
          div.style.height = `${rect.height}pt`;
          this.selLayers[this.pageOf(rect.page)].prepend(div);
        }
      }
    }
    // Every place the search finds, under the selection; past a few hundred they stop being told apart anyway.
    for (const match of this.found.slice(0, MAX_FIND_MARKS)) {
      if (this.area === 'body' && away(match)) continue;
      for (const rect of selectionRects(flow, this.measurer, { from: this.mapOffset(match.from, true), to: this.mapOffset(match.to, true) })) {
        if (!this.isDrawn(this.pageOf(rect.page))) continue;
        const div = document.createElement('div');
        div.className = 'dx-find';
        div.style.left = `${rect.x}pt`;
        div.style.top = `${rect.y}pt`;
        div.style.width = `${rect.width}pt`;
        div.style.height = `${rect.height}pt`;
        this.selLayers[this.pageOf(rect.page)].prepend(div);
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
      for (const corner of this.view === 'flow' ? [] : ['nw', 'ne', 'sw', 'se']) {
        const handle = document.createElement('div');
        handle.className = `dx-objh dx-objh-${corner}`;
        handle.dataset.corner = corner;
        frame.appendChild(handle);
      }
      this.selLayers[picture.box.page].appendChild(frame);
    }
    this.renderPeers();
    if (this.area === 'header' || this.area === 'footer') {
      // A line along the edge of what is being edited, with its name.
      const { height, marginTop, marginBottom } = this.setupOf(this.areaPage);
      const lines = flow.lines;
      const y = this.area === 'header' ? Math.max(marginTop, ...lines.map((l) => l.y + l.height)) : Math.min(height - marginBottom, ...lines.map((l) => l.y));
      const edge = document.createElement('div');
      edge.className = `dx-edge dx-edge-${this.area}`;
      edge.style.top = `${y}pt`;
      const label = document.createElement('span');
      // The first page's own says so: it is not the one the other pages show.
      const base = this.part && splitPart(this.part).base;
      const own = base === 'firstHeader' || base === 'firstFooter';
      // In a document of several sections, of which one.
      const section = this.sectionCount > 1 ? ` · ${t('area.section', { n: this.sectionIndex + 1 })}` : '';
      label.textContent = t(this.area === 'header' ? (own ? 'area.firstHeader' : 'area.header') : own ? 'area.firstFooter' : 'area.footer') + section;
      edge.appendChild(label);
      this.selLayers[this.areaPage].appendChild(edge);
    }

    this.renderMargin();
    this.renderTocChip();
    this.placeCaret(this.selection.focus, this.collapsed);
    this.syncMirror();
    this.renderHandles();

    // Restart the blink so the caret stays solid while it moves.
    this.caretEl.style.animation = 'none';
    void this.caretEl.offsetWidth;
    this.caretEl.style.animation = '';
  }

  /** The carets and selections of the other people on the document, each in its colour and under its name. */
  private renderPeers(): void {
    for (const peer of this.peers) {
      // In a header or a footer, on the page they are editing it on; it is the same on the others.
      const page = Math.max(0, Math.min(peer.page, this.pageCount - 1));
      const kind = peer.part && storyKind(peer.part);
      const own = kind === 'footnote' || kind === 'textbox';
      const band = peer.part && bandLayout(this.layout, own ? (peer.part as FootnotePart | TextBoxPart) : (kind as 'header' | 'footer'), page);
      if (peer.part && (!band || (!own && storyPart(this.layout, kind as 'header' | 'footer', page) !== peer.part))) continue;
      const flow = band || this.layout;
      const story = peer.part ? storyOf(this.doc, peer.part) : this.doc;
      if (!story) continue;
      const shown = (pos: Position): Position => {
        const at = clampPosition({ ...this.doc, paragraphs: story.paragraphs }, pos);
        if (!peer.part) return at;
        // The digits of a page number are not the ones the document holds.
        const onPage = storyOnPage(story, page + 1, this.pageCount).paragraphs[at.para];
        const model = story.paragraphs[at.para];
        return onPage && onPage !== model ? { para: at.para, offset: mapFieldOffset(model, onPage, at.offset) } : at;
      };
      const pageOf = (flowPage: number) => (peer.part ? page : flowPage);
      const color = `#${peer.color}`;
      const range = orderedRange(shown(peer.anchor), shown(peer.focus));
      if (comparePositions(range.from, range.to) !== 0) {
        for (const rect of selectionRects(flow, this.measurer, range)) {
          const div = document.createElement('div');
          div.className = 'dx-peer-sel';
          Object.assign(div.style, { left: `${rect.x}pt`, top: `${rect.y}pt`, width: `${rect.width}pt`, height: `${rect.height}pt`, background: color });
          this.selLayers[pageOf(rect.page)]?.prepend(div);
        }
      }
      const caret = caretRect(flow, this.measurer, shown(peer.focus));
      const bar = document.createElement('div');
      bar.className = 'dx-peer';
      Object.assign(bar.style, { left: `${caret.x}pt`, top: `${caret.y}pt`, height: `${caret.height || 1.5}pt`, ...(caret.width ? { width: `${caret.width}pt`, marginLeft: '0' } : {}), background: color });
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
  private caretBox(): { top: number; height: number; left: number } {
    return { top: this.pagesEl.offsetTop + (parseFloat(this.caretEl.style.top) || 0), height: parseFloat(this.caretEl.style.height) || 0, left: this.pagesEl.offsetLeft + (parseFloat(this.caretEl.style.left) || 0) };
  }

  private placeCaret(pos: Position, show: boolean): void {
    const caret = caretRect(this.flow, this.measurer, this.mapOffset(pos, true));
    const pageEl = this.pageEls[this.pageOf(caret.page)];
    const scale = PT_TO_PX * this.zoom;
    const left = `${pageEl.offsetLeft + caret.x * scale}px`;
    const top = `${pageEl.offsetTop + caret.y * scale}px`;
    // In text set vertically the caret lies across the line.
    const height = caret.width > 0 ? '1.5px' : `${caret.height * scale}px`;
    const width = caret.width > 0 ? `${caret.width * scale}px` : '';
    Object.assign(this.caretEl.style, { left, top, width, height, visibility: show ? 'visible' : 'hidden' });
    Object.assign(this.input.style, { left, top, height });
  }

  /** Where on its page the picture at a position of the text is drawn. */
  private pictureBox(pos: Position): Rect | undefined {
    const flow = this.flow;
    const shown = this.mapOffset(pos, true);
    for (let i = flow.paraFirstLine[shown.para] ?? flow.lines.length; i < flow.lines.length && flow.lines[i].para === shown.para; i++) {
      const line = flow.lines[i];
      const f = line.fragments.find((fragment) => fragment.kind === 'object' && fragment.width > 0 && fragment.start === shown.offset);
      if (f) return { page: this.pageOf(line.page), x: f.x, y: line.baseline - f.ascent, width: f.width, height: f.ascent };
    }
    return undefined;
  }

  /** The picture the selection is, when it is one picture and nothing else: one in the line, or a floating one. */
  private selectedPicture(): { pos: Position; box: Rect; floating: boolean } | undefined {
    const { from, to } = this.range;
    if (from.para !== to.para || to.offset - from.offset !== 1) return undefined;
    if (pictureAt(this.text, from)) {
      const box = this.pictureBox(from);
      return box && { pos: from, box, floating: false };
    }
    if (!floatAt(this.text, from)) return undefined;
    // With the text set to the window, one that floats on its page is shown in its line.
    if (this.view === 'flow') {
      const box = this.pictureBox(from);
      return box && { pos: from, box, floating: true };
    }
    const shown = this.mapOffset(from, true);
    const found = this.floats().find(({ float }) => float.para === shown.para && float.offset === shown.offset);
    return found && { pos: from, box: found.box, floating: true };
  }

  /** The floating pictures of what is being edited, the text or a header or footer, each with where it is drawn. */
  private floats(): { float: FloatBox; box: Rect }[] {
    return this.flow.pages.flatMap((page) => page.floats.map((float) => ({ float, box: { page: this.pageOf(page.index), x: float.x, y: float.y, width: float.width, height: float.height } })));
  }

  /** The floating picture under a point of the window, as the position of its anchor in the text. The one on top, when several are. */
  private floatAtPoint(clientX: number, clientY: number): { pos: Position; box: Rect } | undefined {
    const index = this.area === 'body' ? this.pageAt(clientY) : this.areaPage;
    const rect = this.pageEls[index].getBoundingClientRect();
    const scale = this.setupOf(index).width / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    // Text over a picture that is under it is what the click is for: the picture is taken where it shows by itself.
    const onText = (this.flow.pages[this.area === 'body' ? index : 0]?.lines ?? []).some(
      (line) => y >= line.y && y <= line.y + line.height && line.fragments.some((f) => f.kind === 'text' && f.text.trim() && x >= f.x && x <= f.x + f.width),
    );
    const hit = this.floats()
      .reverse()
      .find(({ box, float }) => box.page === index && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height && !(float.behind && onText));
    return hit && { pos: this.mapOffset({ para: hit.float.para, offset: hit.float.offset }, false), box: hit.box };
  }

  /** The picture under a point of the window, as its position in the text. */
  private pictureAtPoint(clientX: number, clientY: number): Position | undefined {
    const index = this.area === 'body' ? this.pageAt(clientY) : this.areaPage;
    const rect = this.pageEls[index].getBoundingClientRect();
    const scale = this.setupOf(index).width / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    const page = this.flow.pages[this.area === 'body' ? index : 0];
    for (const line of page?.lines ?? []) {
      for (const f of line.fragments) {
        if (f.kind !== 'object' || f.width <= 0) continue;
        const top = line.baseline - f.ascent;
        if (x >= f.x && x <= f.x + f.width && y >= top && y <= top + f.ascent) return this.mapOffset({ para: line.para, offset: f.start }, false);
      }
    }
    return undefined;
  }

  /** The edge of a table column near a point of the window, which can be dragged to make the column wider. */
  private columnEdgeAt(clientX: number, clientY: number): { table: number; boundary: number; scale: number } | undefined {
    if (this.area !== 'body') return undefined;
    const index = this.pageAt(clientY);
    const rect = this.pageEls[index].getBoundingClientRect();
    const scale = this.setupOf(index).width / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    for (const cell of this.layout.pages[index].cells) {
      if (y < cell.y || y > cell.y + cell.height || Math.abs(x - (cell.x + cell.width)) > COLUMN_GRIP * scale) continue;
      const row = this.doc.tables?.[cell.table]?.rows[cell.row];
      if (!row?.cells[cell.cell]) continue;
      let boundary = row.before;
      for (let i = 0; i <= cell.cell; i++) boundary += row.cells[i].span;
      return { table: cell.table, boundary, scale };
    }
    return undefined;
  }

  /** The bottom edge of a table row under the point: dragging it makes the row taller or shorter. */
  private rowEdgeAt(clientX: number, clientY: number): { table: number; row: number; height: number; scale: number } | undefined {
    if (this.area !== 'body') return undefined;
    const index = this.pageAt(clientY);
    const rect = this.pageEls[index].getBoundingClientRect();
    const scale = this.setupOf(index).width / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    const cells = this.layout.pages[index].cells;
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
    if (!this.doc.tables?.[table]?.rows[row]) return undefined;
    // As tall as its cells that cover it alone; a cell merged down is taller.
    const height = Math.min(...cells.filter((c) => c.table === table && c.row === row).map((c) => c.height));
    return { table, row, height, scale };
  }

  /** The bottom right corner of a table under the point: dragging it makes the whole table larger or smaller. */
  private tableCornerAt(clientX: number, clientY: number): { table: number; scale: number } | undefined {
    if (this.area !== 'body') return undefined;
    const index = this.pageAt(clientY);
    const rect = this.pageEls[index].getBoundingClientRect();
    const scale = this.setupOf(index).width / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    const corners = new Map<number, { right: number; bottom: number }>();
    for (const cell of this.layout.pages[index].cells) {
      const at = corners.get(cell.table) ?? { right: -Infinity, bottom: -Infinity };
      corners.set(cell.table, { right: Math.max(at.right, cell.x + cell.width), bottom: Math.max(at.bottom, cell.y + cell.height) });
    }
    const grip = TABLE_GRIP * scale;
    let found: number | undefined;
    for (const [table, { right, bottom }] of corners) {
      // The table's last page: the corner is where the table ends.
      if (this.layout.pages.slice(index + 1).some((p) => p.cells.some((c) => c.table === table))) continue;
      if (x >= right - grip && x <= right + grip && y >= bottom - grip && y <= bottom + grip) found = table;
    }
    return found === undefined ? undefined : { table: found, scale };
  }

  /** How tall each row of a table is drawn, over all the pages it is on. */
  private rowHeights(tableIndex: number): number[] {
    const table = this.doc.tables?.[tableIndex];
    if (!table) return [];
    const heights = table.rows.map(() => 0);
    for (const page of this.layout.pages) {
      const least = new Map<number, number>();
      for (const c of page.cells) if (c.table === tableIndex) least.set(c.row, Math.min(least.get(c.row) ?? Infinity, c.height));
      for (const [row, height] of least) heights[row] += height;
    }
    return heights;
  }

  private scrollCaretIntoView(): void {
    const { top, height, left } = this.caretBox();
    const bottom = top + height;
    // Sideways too, where the page is wider than the window: zoomed in on a phone.
    if (this.root.scrollWidth > this.root.clientWidth + 1) {
      if (left - SCROLL_MARGIN < this.root.scrollLeft) this.root.scrollLeft = left - SCROLL_MARGIN;
      else if (left + SCROLL_MARGIN > this.root.scrollLeft + this.root.clientWidth) this.root.scrollLeft = left + SCROLL_MARGIN - this.root.clientWidth;
    }
    // What an on-screen keyboard covers of the window is not there to see the caret in.
    const seen = this.root.clientHeight - keyboardInset(this.root);
    if (top - SCROLL_MARGIN < this.root.scrollTop) {
      this.root.scrollTop = top - SCROLL_MARGIN;
    } else if (bottom + SCROLL_MARGIN > this.root.scrollTop + seen) {
      this.root.scrollTop = bottom + SCROLL_MARGIN - seen;
    }
  }

  /** The keyboard came up or went away: the caret is kept where it can be seen. */
  private onViewport = (): void => {
    if (document.activeElement === this.input) this.scrollCaretIntoView();
  };

  // --- Mouse --------------------------------------------------------------

  /** The page a point of the window is on, or the nearest one. */
  private pageAt(clientY: number): number {
    let index = 0;
    let best = Infinity;
    this.pageEls.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const distance = clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0;
      if (distance < best) {
        best = distance;
        index = i;
      }
    });
    return index;
  }

  private positionFromPoint(clientX: number, clientY: number): Position {
    // In a header or footer the point is taken on the page being edited, wherever it is.
    const index = this.area === 'body' ? this.pageAt(clientY) : this.areaPage;
    const rect = this.pageEls[index].getBoundingClientRect();
    const scale = this.setupOf(index).width / rect.width;
    const pos = hitTest(this.flow, this.measurer, this.area === 'body' ? index : 0, (clientX - rect.left) * scale, (clientY - rect.top) * scale);
    return this.mapOffset(pos, false);
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
    if (this.composing) this.input.blur();
    this.focus();
    // A corner of the selected picture: dragging it gives the picture another size.
    const corner = (e.target as HTMLElement).closest<HTMLElement>('.dx-objh');
    const picked = corner && this.selectedPicture();
    if (corner && picked) {
      const frame = corner.parentElement as HTMLElement;
      const column = this.textColumn();
      // A floating picture can be as wide as the page; one in the line, as its column.
      const max = picked.floating ? this.setupOf(picked.box.page).width : column.right - column.left;
      this.pictureResize = { pos: picked.pos, corner: corner.dataset.corner ?? 'se', startX: e.clientX, box: picked.box, frame, width: picked.box.width, height: picked.box.height, max, floating: picked.floating };
      return;
    }
    // The corner of a table: dragging it makes the whole table larger or smaller.
    const grip = e.detail === 1 && this.view !== 'flow' ? this.tableCornerAt(e.clientX, e.clientY) : undefined;
    if (grip) {
      const boxes = this.layout.pages[this.pageAt(e.clientY)].cells.filter((c) => c.table === grip.table);
      const pageEl = this.pageEls[this.pageAt(e.clientY)];
      const px = 1 / grip.scale;
      const left = Math.min(...boxes.map((c) => c.x));
      const top = Math.min(...boxes.map((c) => c.y));
      const width = (Math.max(...boxes.map((c) => c.x + c.width)) - left) * px;
      const height = (Math.max(...boxes.map((c) => c.y + c.height)) - top) * px;
      const guide = document.createElement('div');
      guide.className = 'dx-guide-box';
      Object.assign(guide.style, { left: `${pageEl.offsetLeft + left * px}px`, top: `${pageEl.offsetTop + top * px}px`, width: `${width}px`, height: `${height}px` });
      this.pagesEl.appendChild(guide);
      this.tableDrag = { table: grip.table, startX: e.clientX, startY: e.clientY, width, height, guide };
      return;
    }
    // The bottom edge of a table row: dragging it makes the row taller or shorter.
    const rowEdge = e.detail === 1 && this.view !== 'flow' ? this.rowEdgeAt(e.clientX, e.clientY) : undefined;
    if (rowEdge) {
      const guide = document.createElement('div');
      guide.className = 'dx-guide-row';
      const pageEl = this.pageEls[this.pageAt(e.clientY)];
      guide.style.left = `${pageEl.offsetLeft}px`;
      guide.style.width = `${pageEl.offsetWidth}px`;
      guide.style.top = `${e.clientY - this.pagesEl.getBoundingClientRect().top}px`;
      this.pagesEl.appendChild(guide);
      this.rowDrag = { ...rowEdge, startY: e.clientY, guide };
      return;
    }
    // The edge of a table column: dragging it moves the edge.
    const edge = e.detail === 1 && this.view !== 'flow' ? this.columnEdgeAt(e.clientX, e.clientY) : undefined;
    if (edge) {
      const guide = document.createElement('div');
      guide.className = 'dx-guide';
      const pageEl = this.pageEls[this.pageAt(e.clientY)];
      guide.style.top = `${pageEl.offsetTop}px`;
      guide.style.height = `${pageEl.offsetHeight}px`;
      guide.style.left = `${e.clientX - this.pagesEl.getBoundingClientRect().left}px`;
      this.pagesEl.appendChild(guide);
      this.columnDrag = { ...edge, startX: e.clientX, guide };
      return;
    }
    // A click in a text box goes into it, to write in it; one on its edge takes the box itself, to move it or make it larger.
    const box = this.view !== 'flow' ? this.textBoxAt(e.clientX, e.clientY) : undefined;
    if (box && !box.edge) {
      const same = this.area === 'textbox' && this.areaNote === box.id;
      if (!same || this.areaPage !== box.page) this.setArea('textbox', box.page, box.id);
      if (this.area === 'textbox') {
        const pos = this.positionFromPoint(e.clientX, e.clientY);
        if (e.detail === 2) {
          const word = wordRangeAt(this.text, pos);
          this.setSelection(word.from, word.to);
        } else if (e.detail >= 3) {
          this.setSelection({ para: pos.para, offset: 0 }, { para: pos.para, offset: paragraphLength(this.text.paragraphs[pos.para]) });
        } else {
          this.setSelection(e.shiftKey && same ? this.selection.anchor : pos, pos);
          this.dragging = true;
        }
        return;
      }
    }
    // Out of the box, back to the text.
    if (this.area === 'textbox') this.setArea('body');
    const zone = this.zoneAt(e.clientY);
    // A click on a note at the foot of the page goes into it, and one on the text from a note comes back out, as in Word.
    const intoNote = zone.area === 'footnote' && (this.area !== 'footnote' || zone.note !== this.areaNote || zone.page !== this.areaPage);
    if (intoNote || (this.area === 'footnote' && zone.area === 'body')) {
      this.setArea(zone.area, zone.page, zone.note);
      this.setSelection(this.positionFromPoint(e.clientX, e.clientY));
      return;
    }
    if (zone.area !== this.area) {
      // A double click on the header or the footer goes into it, and one on the text comes back out.
      if (e.detail === 2) {
        this.setArea(zone.area, zone.page, zone.note);
        this.setSelection(this.positionFromPoint(e.clientX, e.clientY));
        return;
      }
      if (this.area !== 'body') return;
    } else if (this.area !== 'body' && zone.page !== this.areaPage) {
      this.setArea(this.area, zone.page, zone.note);
    }
    // A click on a picture selects it; dragging from there moves it.
    const picture = e.detail === 1 && !e.shiftKey ? this.pictureAtPoint(e.clientX, e.clientY) : undefined;
    if (picture) {
      this.setSelection(picture, { para: picture.para, offset: picture.offset + 1 });
      if (this.view !== 'flow') this.pictureDrag = { from: picture, x: e.clientX, y: e.clientY, active: false };
      return;
    }
    // A click on a floating picture selects it too; dragging from there moves it about its page.
    const float = e.detail === 1 && !e.shiftKey ? this.floatAtPoint(e.clientX, e.clientY) : undefined;
    if (float) {
      // Its anchor may be lines away from where it is drawn: the view stays on the picture that was clicked.
      const top = this.root.scrollTop;
      this.setSelection(float.pos, { para: float.pos.para, offset: float.pos.offset + 1 });
      this.root.scrollTop = top;
      this.floatDrag = { pos: float.pos, x: e.clientX, y: e.clientY, active: false, box: float.box };
      return;
    }
    const pos = this.positionFromPoint(e.clientX, e.clientY);
    if (e.detail === 2) {
      const word = wordRangeAt(this.text, pos);
      this.setSelection(word.from, word.to);
    } else if (e.detail >= 3) {
      const length = paragraphLength(this.text.paragraphs[pos.para]);
      this.setSelection({ para: pos.para, offset: 0 }, { para: pos.para, offset: length });
    } else {
      this.setSelection(e.shiftKey ? this.selection.anchor : pos, pos);
      this.dragging = true;
    }
  }

  /** The note shown beside the pointer while it is over the text the note is about. */
  private noteTip: HTMLElement | undefined;
  private noteTipFor = '';

  private hideNoteTip(): void {
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
    if (this.area === 'body' && !e.buttons && e.target instanceof Node && this.pagesEl.contains(e.target)) {
      if (this.tocSeen?.doc !== this.doc) this.tocSeen = { doc: this.doc, range: tocRange(this.doc) };
      const range = this.tocSeen.range;
      if (range) {
        const para = this.positionFromPoint(e.clientX, e.clientY).para;
        link = para >= range.first && para <= range.last && tocTarget(this.doc, para) !== undefined;
      }
    }
    // A link out of the document says where it goes; it is followed with the command key held, as in Word.
    const out = e.buttons ? undefined : this.linkUnder(e);
    this.showLinkTip(out, e);
    this.pagesEl.classList.toggle('dx-over-link', link || (out !== undefined && (e.metaKey || e.ctrlKey)));
  }

  /** Where the link under the pointer goes. The text lets the mouse through, so it is found by where it is. */
  private linkUnder(e: MouseEvent): string | undefined {
    if (!(e.target instanceof Node) || !this.pagesEl.contains(e.target)) return undefined;
    for (const part of this.pagesEl.querySelectorAll<HTMLElement>('[data-href]')) {
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
      applyTheme(tip, this.themeName);
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
    if (!e.buttons && e.target instanceof Node && this.pagesEl.contains(e.target)) {
      for (const mark of this.pagesEl.querySelectorAll<HTMLElement>('.dx-note')) {
        const r = mark.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
        // Inside another, the smaller one is the one meant.
        const whole = [...this.pagesEl.querySelectorAll<HTMLElement>(`.dx-note[data-note="${mark.dataset.note}"]`)].reduce((sum, part) => sum + part.offsetWidth, 0);
        if (whole < size) {
          size = whole;
          id = mark.dataset.note;
        }
      }
    }
    const note = id === undefined ? undefined : this.doc.notes?.find((other) => other.id === id);
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
      applyTheme(tip, this.themeName);
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
      this.columnDrag.guide.style.left = `${e.clientX - this.pagesEl.getBoundingClientRect().left}px`;
      return;
    }
    if (this.rowDrag) {
      const drag = this.rowDrag;
      // Not above the least a row can be.
      const lowest = drag.startY - (drag.height - MIN_ROW_HEIGHT) / drag.scale;
      drag.guide.style.top = `${Math.max(lowest, e.clientY) - this.pagesEl.getBoundingClientRect().top}px`;
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
      const moved = ((e.clientX - drag.startX) / (PT_TO_PX * this.zoom)) * (drag.corner.includes('e') ? 1 : -1);
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
      const frame = this.root.querySelector<HTMLElement>('.dx-objsel');
      const scale = 1 / (PT_TO_PX * this.zoom);
      if (frame) Object.assign(frame.style, { left: `${drag.box.x + (e.clientX - drag.x) * scale}pt`, top: `${drag.box.y + (e.clientY - drag.y) * scale}pt` });
      return;
    }
    if (this.pictureDrag) {
      const drag = this.pictureDrag;
      if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < DRAG_START) return;
      drag.active = true;
      // The caret shows where the picture will go.
      drag.to = this.positionFromPoint(e.clientX, e.clientY);
      this.placeCaret(drag.to, true);
      return;
    }
    if (!this.dragging) {
      // Over the edge of a column the pointer says it can be dragged.
      const on = this.view !== 'flow' && this.pagesEl.contains(e.target as Node);
      const corner = on && !!this.tableCornerAt(e.clientX, e.clientY);
      const row = on && !corner && !!this.rowEdgeAt(e.clientX, e.clientY);
      this.pagesEl.classList.toggle('dx-table-resize', corner);
      this.pagesEl.classList.toggle('dx-row-resize', row);
      this.pagesEl.classList.toggle('dx-col-resize', on && !corner && !row && !!this.columnEdgeAt(e.clientX, e.clientY));
      return;
    }
    const pos = this.positionFromPoint(e.clientX, e.clientY);
    if (comparePositions(pos, this.selection.focus) !== 0) this.setSelection(this.selection.anchor, pos);
  };

  private onMouseUp = (e: MouseEvent): void => {
    // A plain click on an entry of the table of contents, not a drag over it, goes to its heading.
    const clicked = this.dragging && this.collapsed && this.area === 'body' && !e.shiftKey;
    this.dragging = false;
    const heading = clicked ? tocTarget(this.doc, this.selection.focus.para) : undefined;
    if (heading !== undefined) this.goToHeading(heading);
    // With the command key held, a click on a link opens what it goes to.
    const out = this.collapsed && (e.metaKey || e.ctrlKey) && !e.shiftKey && e.button === 0 ? this.linkUnder(e) : undefined;
    if (out !== undefined) this.openLink(out);
    if (this.rowDrag) {
      const { table, row, height, startY, scale, guide } = this.rowDrag;
      this.rowDrag = undefined;
      guide.remove();
      const doc = resizeRow(this.doc, table, row, height + (e.clientY - startY) * scale);
      if (doc !== this.doc) this.commitDoc(doc, this.selection);
      return;
    }
    if (this.tableDrag) {
      const { table, startX, startY, width, height, guide } = this.tableDrag;
      this.tableDrag = undefined;
      guide.remove();
      const laidOut = this.doc.tables?.[table];
      if (!laidOut) return;
      const { width: pageWidth, marginLeft, marginRight } = this.pageOfTable(table);
      const columns = tableGeometry(laidOut, pageWidth - marginLeft - marginRight).columns;
      const scaleX = Math.max(8, width + e.clientX - startX) / width;
      const scaleY = Math.max(8, height + e.clientY - startY) / height;
      const doc = resizeTable(this.doc, table, columns, scaleX, this.rowHeights(table), scaleY);
      if (doc !== this.doc) this.commitDoc(doc, this.selection);
      return;
    }
    if (this.columnDrag) {
      const { table, boundary, startX, scale, guide } = this.columnDrag;
      this.columnDrag = undefined;
      guide.remove();
      const { width, marginLeft, marginRight } = this.pageOfTable(table);
      const laidOut = this.doc.tables?.[table];
      if (!laidOut) return;
      const columns = tableGeometry(laidOut, width - marginLeft - marginRight).columns;
      const doc = resizeColumn(this.doc, table, boundary, (e.clientX - startX) * scale, columns);
      if (doc !== this.doc) this.commitDoc(doc, this.selection);
      return;
    }
    if (this.pictureResize) {
      const { pos, width, height, box, floating, corner } = this.pictureResize;
      this.pictureResize = undefined;
      if (Math.abs(width - box.width) < 0.5) this.renderSelection();
      else if (!floating) this.commit(resizePicture(this.text, pos, width, height), this.selection);
      // The corner across from the one dragged stays where it was.
      else this.commit(moveFloat(resizeFloat(this.text, pos, width, height), pos, corner.includes('w') ? box.width - width : 0, corner.includes('n') ? box.height - height : 0), this.selection);
      return;
    }
    if (this.floatDrag) {
      const { pos, x, y, active, box } = this.floatDrag;
      this.floatDrag = undefined;
      const scale = 1 / (PT_TO_PX * this.zoom);
      if (!active) {
        this.renderSelection();
        return;
      }
      const dx = (e.clientX - x) * scale;
      const dy = (e.clientY - y) * scale;
      // Let go over another paragraph of the text, it is anchored there from then on, as in Word: it goes
      // with that paragraph, and to its page. Where it is drawn is where it was let go.
      const to = this.positionFromPoint(e.clientX, e.clientY);
      const target = this.text.paragraphs[to.para];
      if (to.para !== pos.para && target) {
        const from = this.pageEls[box.page].getBoundingClientRect();
        // A header or a footer is that of the page it is being edited on.
        const page = this.area === 'body' ? this.pageAt(e.clientY) : this.areaPage;
        const onto = this.pageEls[page].getBoundingClientRect();
        // Where its corner was let go, in the coordinates of the page it is over.
        const wanted = { x: box.x + dx + (from.left - onto.left) * scale, y: box.y + dy + (from.top - onto.top) * scale };
        const anchored = reanchorFloat(this.text, pos, outsideField(this.text, { para: to.para, offset: 0 }));
        // Put where it was let go; the text going round it may move its paragraph, so it is tried again until it stays.
        let placed = anchored.doc;
        for (let pass = 0; pass < 4; pass++) {
          const now = this.floatBoxIn(placed, anchored.pos);
          if (!now || now.page !== page || (Math.abs(wanted.x - now.x) < 0.5 && Math.abs(wanted.y - now.y) < 0.5)) break;
          placed = moveFloat(placed, anchored.pos, wanted.x - now.x, wanted.y - now.y);
        }
        if (anchored.doc !== this.text) {
          this.commit(placed, { anchor: anchored.pos, focus: { para: anchored.pos.para, offset: anchored.pos.offset + 1 } });
          return;
        }
      }
      const moved = moveFloat(this.text, pos, dx, dy);
      if (moved !== this.text) this.commit(moved, this.selection);
      else this.renderSelection();
      return;
    }
    if (this.pictureDrag) {
      const { from, to, active } = this.pictureDrag;
      this.pictureDrag = undefined;
      const moved = active && to ? movePicture(this.text, from, outsideField(this.text, to)) : undefined;
      if (moved && moved.doc !== this.text) this.commit(moved.doc, { anchor: moved.pos, focus: { para: moved.pos.para, offset: moved.pos.offset + 1 } });
      else this.renderSelection();
    }
  };

  // --- Keyboard and clipboard ---------------------------------------------

  private moveTo(pos: Position, extend: boolean): void {
    this.setSelection(extend ? this.selection.anchor : pos, pos);
  }

  private moveHorizontal(dir: -1 | 1, byWord: boolean, extend: boolean): void {
    if (!extend && !this.collapsed) {
      this.moved = 'char';
      this.moveTo(dir < 0 ? this.range.from : this.range.to, false);
      return;
    }
    const focus = this.selection.focus;
    this.moved = byWord ? 'word' : 'char';
    this.moveTo(byWord ? moveWord(this.text, focus, dir) : moveChar(this.text, focus, dir), extend);
  }

  private moveVertical(dir: -1 | 1, extend: boolean): void {
    const focus = this.selection.focus;
    const shown = this.mapOffset(focus, true);
    const line = lineForPosition(this.flow, shown);
    const x = this.goalX ?? xAtOffset(line, shown.offset, this.measurer);
    const target = adjacentLine(this.flow, line, x, dir);
    const pos = target
      ? this.mapOffset({ para: target.para, offset: offsetAtX(target, x, this.measurer) }, false)
      : dir < 0
        ? docStart()
        : docEnd(this.text);
    this.moved = 'line';
    this.moveTo(pos, extend);
    this.goalX = x;
  }

  /** Selects the contents of the next (1) or previous (-1) table cell, as Tab does in Word. */
  private moveToCell(dir: -1 | 1): void {
    let cell = neighbourCell(this.text, this.selection.focus.para, dir);
    if (!cell && dir > 0) {
      // Tab in the last cell adds a row and goes on into it.
      this.insertTableRow(true);
      cell = neighbourCell(this.text, this.selection.focus.para, dir);
    }
    if (!cell) return;
    this.moved = 'line';
    const end = { para: cell.to, offset: paragraphLength(this.text.paragraphs[cell.to]) };
    this.setSelection({ para: cell.from, offset: 0 }, end);
  }

  private moveToLineEdge(dir: -1 | 1, extend: boolean): void {
    const line = lineForPosition(this.flow, this.mapOffset(this.selection.focus, true));
    this.moved = 'line';
    this.moveTo(this.mapOffset({ para: line.para, offset: dir < 0 ? line.start : lineEndOffset(line) }, false), extend);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const before = this.selection;
    this.moved = undefined;
    this.handleKey(e);
    if (this.moved) this.announceMove(before);
    this.moved = undefined;
  };

  private handleKey(e: KeyboardEvent): void {
    this.hideNoteTip();
    if (e.isComposing || this.composing) return;
    const mod = e.metaKey || e.ctrlKey;
    const byWord = e.altKey || (e.ctrlKey && !e.metaKey);
    let handled = true;
    // Ctrl+Shift+V pastes the text alone, as it pastes in Word and in browsers; the paste itself is the browser's.
    this.plainPaste = mod && e.shiftKey && e.code === 'KeyV';
    if (this.plainPaste && IS_MAC && !e.altKey) {
      // A Mac has no paste for ⌘⇧V: the text is read from the clipboard here.
      e.preventDefault();
      this.plainPaste = false;
      void this.paste({ plain: true });
      return;
    }

    if ((IS_MAC ? e.metaKey : e.ctrlKey) && e.altKey && !e.shiftKey && e.code === 'KeyZ') {
      this.screenReader = !this.screenReader;
      e.preventDefault();
      return;
    }
    if (mod && e.altKey && e.code === 'KeyF') {
      // A note at the foot of the page, with the keys Word has for it.
      this.insertFootnote();
      e.preventDefault();
      return;
    }
    if (mod && e.shiftKey && !e.altKey && e.code === 'KeyE') {
      // Tracking changes on and off, with the keys Word has for it.
      this.setTrackChanges(!this.trackChanges);
      e.preventDefault();
      return;
    }
    if (mod && !e.altKey) {
      switch (e.key?.toLowerCase()) {
        case 'b':
          this.toggleMark('bold');
          break;
        case 'i':
          this.toggleMark('italic');
          break;
        case 'u':
          this.toggleMark('underline');
          break;
        case 'k':
          if (this.onLinkKey) this.onLinkKey();
          else handled = false;
          break;
        case 'a':
          this.selectAll();
          break;
        case 'z':
          if (e.shiftKey) this.redo();
          else this.undo();
          break;
        case 'y':
          this.redo();
          break;
        case 'enter':
          this.insertPageBreak();
          break;
        case 'arrowleft':
          if (e.metaKey) this.moveToLineEdge(-1, e.shiftKey);
          else this.moveHorizontal(-1, true, e.shiftKey);
          break;
        case 'arrowright':
          if (e.metaKey) this.moveToLineEdge(1, e.shiftKey);
          else this.moveHorizontal(1, true, e.shiftKey);
          break;
        case 'arrowup':
        case 'home':
          this.moveTo(docStart(), e.shiftKey);
          break;
        case 'arrowdown':
        case 'end':
          this.moveTo(docEnd(this.text), e.shiftKey);
          break;
        case 'backspace':
          this.deleteBackward(true);
          break;
        case 'delete':
          this.deleteForward(true);
          break;
        default:
          handled = false;
      }
    } else {
      switch (e.key) {
        case 'ArrowLeft':
          this.moveHorizontal(-1, byWord, e.shiftKey);
          break;
        case 'ArrowRight':
          this.moveHorizontal(1, byWord, e.shiftKey);
          break;
        case 'ArrowUp':
          this.moveVertical(-1, e.shiftKey);
          break;
        case 'ArrowDown':
          this.moveVertical(1, e.shiftKey);
          break;
        case 'Home':
          this.moveToLineEdge(-1, e.shiftKey);
          break;
        case 'End':
          this.moveToLineEdge(1, e.shiftKey);
          break;
        case 'Backspace':
          this.deleteBackward(byWord);
          break;
        case 'Delete':
          this.deleteForward(byWord);
          break;
        case 'Enter':
          if (e.shiftKey) this.insertText('\n');
          else this.insertParagraphBreak();
          break;
        case 'Escape':
          if (this.area === 'body') handled = false;
          else this.setArea('body');
          break;
        case 'Tab':
          if (this.text.paragraphs[this.selection.focus.para].cell) this.moveToCell(e.shiftKey ? -1 : 1);
          else if (this.tabChangesLevel()) this.shiftListLevel(e.shiftKey ? -1 : 1);
          else this.insertText('\t');
          break;
        default:
          handled = false;
      }
    }
    if (handled) e.preventDefault();
  }

  /**
   * Says what a key moved the caret over: the character, the word or the line
   * it is now at, or what it added to the selection or took from it; and,
   * before that, where it is when that changed: the page, a table cell, a
   * heading, a list, a link, a tracked change.
   */
  private announceMove(before: Selection): void {
    const { anchor, focus } = this.selection;
    if (comparePositions(focus, before.focus) === 0 && comparePositions(anchor, before.anchor) === 0) return;
    const doc = this.text;
    const parts: Spoken[] = [];
    /** Text of the document, in its language when it has one of its own. */
    const lang = this.textLanguage;
    const own = (text: string): Spoken => (lang ? { text, lang } : text);
    if (this.area === 'body') {
      const page = lineForPosition(this.flow, this.mapOffset(focus, true)).page;
      if (page !== this.spokenPage && this.spokenPage >= 0) parts.push(t('a11y.page', { page: this.pageOf(page) + 1 }));
      this.spokenPage = page;
    }
    // Shift and an arrow that brings the focus back to the anchor takes the last of the selection away: that is said too.
    const selecting = comparePositions(anchor, focus) !== 0 || (comparePositions(before.anchor, before.focus) !== 0 && comparePositions(anchor, before.anchor) === 0);
    // While selecting, what is said is what was selected, not where it is.
    if (focus.para !== before.focus.para && !selecting) parts.push(...this.whereIs(focus.para, before.focus.para));
    // In the mode for screen readers, the text is the screen reader's to read, from the field: only where it is is said.
    const reader = !!this.mirror;
    if (reader && selecting) {
      // Nothing is said of a selection: the screen reader says what it selected.
    } else if (selecting) {
      // By where the focus went: away from the anchor, or past it to the other side, is more selected. Pictures count, which the text leaves out.
      const side = comparePositions(anchor, focus);
      const step = comparePositions(focus, before.focus);
      const crossed = comparePositions(anchor, before.focus) !== 0 && Math.sign(comparePositions(anchor, before.focus)) !== Math.sign(side);
      const grew = side !== 0 && (comparePositions(anchor, before.anchor) !== 0 || crossed || (side < 0 ? step > 0 : step < 0));
      const range = orderedRange(before.focus, focus);
      const moved = range.from.para === range.to.para ? this.spokenSlice(doc.paragraphs[range.from.para], range.from.offset, range.to.offset) : textInRange(doc, range);
      // A character that is the mark between two paragraphs is the end of the first.
      const said = range.from.para !== range.to.para && moved === '\n' ? t('a11y.endOfParagraph') : this.moved === 'char' && moved.length <= 1 ? spokenChar(moved) : spokenText(moved);
      parts.push(t(grew ? 'a11y.selected' : 'a11y.unselected', { text: said }));
    } else {
      const text = paragraphText(doc.paragraphs[focus.para]);
      if (reader) {
        // What the caret is at is read from the field.
      } else if (this.moved === 'char') {
        // The marks the caret stepped over to get here are said too: going left, a note's number is behind it.
        const p = doc.paragraphs[focus.para];
        if (before.focus.para === focus.para && before.focus.offset > focus.offset) {
          const crossed = this.spokenSlice(p, focus.offset + 1, before.focus.offset).trim();
          if (crossed) parts.push(crossed);
        }
        const at = this.spokenAt(p, focus.offset);
        // A letter is the document's; a space or a picture is said in the words of the interface.
        parts.push(at === text[focus.offset] ? own(at) : at);
      }
      else if (this.moved === 'word') {
        const word = wordRangeAt(doc, focus);
        parts.push(word.to.offset > word.from.offset ? own(text.slice(word.from.offset, word.to.offset)) : spokenChar(text[focus.offset]));
      } else {
        const line = lineForPosition(this.flow, this.mapOffset(focus, true));
        const from = this.mapOffset({ para: line.para, offset: line.start }, false).offset;
        const to = this.mapOffset({ para: line.para, offset: line.end }, false).offset;
        const said = spokenText(this.spokenSlice(doc.paragraphs[focus.para], from, to));
        parts.push(said === t('a11y.blank') ? said : own(said));
      }
      const link = linkAt(doc, focus);
      const was = linkAt(doc, before.focus);
      if (link?.href && link.href !== was?.href) parts.push(t('a11y.link', { href: link.href }));
      const revision = revisionAt(doc.paragraphs, focus);
      const left = revisionAt(doc.paragraphs, before.focus);
      // Each call makes the change anew: it is the same one when it starts at the same place, of the same kind.
      const same = left && revision && left.type === revision.type && comparePositions(left.range.from, revision.range.from) === 0;
      if (revision && !same) {
        parts.push(t(revision.type === 'delete' ? 'a11y.removed' : revision.type === 'format' ? 'a11y.formatted' : 'a11y.inserted', { author: revision.author }));
      }
    }
    // Under what the screen reader reads from the field, not over it. A part that ends a sentence needs no other stop.
    const said: Spoken[] = [];
    for (const part of parts) {
      const last = said[said.length - 1];
      if (last !== undefined) said.push(/[.!?:…]$/.test(typeof last === 'string' ? last : last.text) ? ' ' : '. ');
      said.push(part);
    }
    this.announcer.say(said, !reader);
  }

  /**
   * What an object of the text is called, read out: a picture with its
   * description, a text box, the number of a note at the foot of the page.
   * Undefined for the marks that are nothing to hear (where a comment starts
   * or ends, a bookmark).
   */
  private spokenObject(run: Run): string | undefined {
    const xml = run.props.object;
    if (!xml) return undefined;
    const note = footnoteReferenceId(xml);
    if (note !== undefined) return t('a11y.footnoteRef', { n: footnoteNumbers(this.doc).get(note) ?? '' });
    if (!/<w:drawing\b|<w:pict\b/.test(xml)) return undefined;
    if (/<w:txbxContent\b/.test(xml)) return t('a11y.textBox');
    const alt = altText(xml);
    return alt ? t('a11y.picture', { alt }) : t('a11y.pictureNoAlt');
  }

  /** What is at `offset` of a paragraph, read out: a picture by its name; past marks that take no room, what they are and the character after them. */
  private spokenAt(p: Paragraph, offset: number): string {
    const said: string[] = [];
    let at = offset;
    let start = 0;
    for (const run of p.runs) {
      const end = start + run.text.length;
      if (at >= start && at < end) {
        if (!run.props.object) break;
        const name = this.spokenObject(run);
        // A picture in the line is what the caret is at; a mark the caret steps over is said, and so is what follows it.
        if (!run.props.anchor) return name ?? spokenChar(run.text[at - start]);
        if (name) said.push(name);
        at = end;
      }
      start = end;
    }
    said.push(spokenChar(paragraphText(p)[at]));
    return said.join(', ');
  }

  /** A stretch of a paragraph as it is read: each object by its name. */
  private spokenSlice(p: Paragraph, from: number, to: number): string {
    let out = '';
    let start = 0;
    for (const run of p.runs) {
      const end = start + run.text.length;
      if (end > from && start < to) {
        const name = run.props.object ? this.spokenObject(run) : undefined;
        out += run.props.object ? (name ? ` ${name} ` : '') : run.text.slice(Math.max(0, from - start), Math.min(run.text.length, to - start));
      }
      start = end;
    }
    return out;
  }

  /** What changed of where the caret is, from paragraph `was` to paragraph `para`: a table cell, a heading, a list. */
  private whereIs(para: number, was: number): string[] {
    const doc = this.text;
    const out: string[] = [];
    const cell = locateCell(doc, para);
    const before = locateCell(doc, was);
    if (cell && (cell.tableIndex !== before?.tableIndex || cell.rowIndex !== before.rowIndex || cell.cellIndex !== before.cellIndex)) {
      out.push(t('a11y.cell', { row: cell.rowIndex + 1, column: cell.column + 1 }));
    } else if (!cell && before) out.push(t('a11y.leftTable'));
    const style = styleIdAt(doc, para);
    const styles = paragraphStyles(doc);
    if (style !== styleIdAt(doc, was) && style !== styles[0].id) {
      const found = styles.find((s) => s.id === style);
      if (found) out.push(styleName(found));
    }
    const list = listKindAt(doc, para);
    const level = doc.paragraphs[para].props.listLevel ?? 0;
    if (list && (list !== listKindAt(doc, was) || level !== (doc.paragraphs[was].props.listLevel ?? 0))) {
      const name = t(list === 'bullet' ? 'a11y.bulletList' : 'a11y.numberList');
      out.push(level ? `${name}, ${t('a11y.level', { level: level + 1 })}` : name);
    }
    return out;
  }

  private onInput = (): void => {
    if (this.mirror) return this.readerInput();
    const raw = this.input.value;
    const marked = raw.startsWith(INPUT_MARK);
    // The mark is gone and nothing else is there: it was taken away, which is a Backspace.
    if (!marked && !raw && !this.typed && !this.composing) {
      this.resetInput();
      this.deleteBackward();
      return;
    }
    const text = marked ? raw.slice(INPUT_MARK.length) : raw;
    // Enter, from a keyboard that writes it in the field and does not say the key: Shift and Enter never gets here.
    const entered = !this.composing && text.endsWith('\n');
    this.compose(entered ? text.slice(0, -1) : text);
    if (!this.composing) this.resetInput();
    if (entered) this.insertParagraphBreak();
  };

  private onCompositionEnd = (): void => {
    this.composing = false;
    this.onInput();
    // Some browsers say what was composed once more after it ended, in an input of their own: by the time
    // this runs they have, and the field was emptied twice over.
    window.setTimeout(() => {
      if (!this.composing && !this.mirror && this.input.value !== INPUT_MARK) this.onInput();
    });
  };

  /**
   * Brings the document up to `text`, what the hidden field holds: a word is
   * shown as it is written, also by a keyboard that composes it, as those of
   * phones do, and changes with it when the keyboard corrects it.
   */
  private compose(text: string): void {
    let had = this.typed;
    // The caret went elsewhere meanwhile: what was written there is no longer this word.
    if (had && (!this.collapsed || !this.typedEnd || comparePositions(this.selection.focus, this.typedEnd) !== 0)) had = text;
    this.typed = text;
    if (text === had) return;
    let same = 0;
    while (same < had.length && same < text.length && had[same] === text[same]) same++;
    const gone = Math.min(had.length - same, this.selection.focus.offset);
    const added = text.slice(same);
    if (!gone) {
      this.insertText(added);
    } else {
      const to = this.selection.focus;
      const from = { para: to.para, offset: to.offset - gone };
      const { field: _, ...props } = this.pendingProps ?? this.activeRunProps();
      const cut = deleteRange(this.text, { from, to });
      const result = added ? insertFragment(cut, outsideField(cut, from), added, props) : { doc: cut, pos: from };
      this.commit(result.doc, { anchor: result.pos, focus: result.pos }, 'type');
    }
    this.typedEnd = this.selection.focus;
  }

  /** Leaves the hidden field with nothing typed in it. */
  private resetInput(): void {
    this.typed = '';
    this.typedEnd = undefined;
    if (this.mirror) this.syncMirror();
    else if (this.input.value !== INPUT_MARK) this.input.value = INPUT_MARK;
  }

  // --- Touch --------------------------------------------------------------

  private setByTouch(on: boolean): void {
    if (on === this.byTouch) return;
    this.byTouch = on;
    this.root.classList.toggle('dx-touch', on);
    this.renderHandles();
  }

  private handle(end: 'anchor' | 'focus' | 'caret'): HTMLElement {
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
      const bounds = this.root.getBoundingClientRect();
      const bottom = bounds.bottom - keyboardInset(this.root);
      if (e.clientY < bounds.top + HANDLE_SCROLL_EDGE) this.root.scrollTop -= HANDLE_SCROLL_STEP;
      else if (e.clientY > bottom - HANDLE_SCROLL_EDGE) this.root.scrollTop += HANDLE_SCROLL_STEP;
      const pos = this.positionFromPoint(e.clientX, e.clientY - lift);
      const { anchor, focus } = this.selection;
      const next = end === 'caret' ? { anchor: pos, focus: pos } : end === 'anchor' ? { anchor: pos, focus } : { anchor, focus: pos };
      // Its two ends never meet: a selection of nothing would lose the handle being dragged.
      if (end !== 'caret' && comparePositions(next.anchor, next.focus) === 0) return;
      if (comparePositions(next.anchor, anchor) === 0 && comparePositions(next.focus, focus) === 0) return;
      moved = true;
      this.caretHandleUntil = Date.now() + CARET_HANDLE_MS;
      this.selection = next;
      this.goalX = null;
      this.pendingProps = null;
      this.renderSelection();
      this.emit();
    });
    const done = (e: PointerEvent) => {
      if (!held) return;
      held = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (end !== 'caret') return this.onTouchSelect?.();
      this.showCaretHandle();
      // A tap on the handle of the caret: what can be done there, Paste first, as a phone offers it.
      if (!moved) this.onTouchSelect?.();
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
  private renderHandles(): void {
    const scale = PT_TO_PX * this.zoom;
    const put = (el: HTMLElement, pos: Position | undefined) => {
      el.classList.toggle('dx-on', !!pos);
      if (!pos) return;
      const caret = caretRect(this.flow, this.measurer, this.mapOffset(pos, true));
      const pageEl = this.pageEls[this.pageOf(caret.page)];
      el.style.left = `${pageEl.offsetLeft + caret.x * scale}px`;
      el.style.top = `${pageEl.offsetTop + (caret.y + caret.height) * scale}px`;
      el.dataset.line = String(caret.height * scale);
    };
    const ranged = this.byTouch && !this.collapsed && !this.selectedPicture();
    put(this.handles.anchor, ranged ? this.selection.anchor : undefined);
    put(this.handles.focus, ranged ? this.selection.focus : undefined);
    put(this.handles.caret, this.byTouch && this.collapsed && Date.now() < this.caretHandleUntil ? this.selection.focus : undefined);
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
      this.pinch = { distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, zoom: this.zoom, frame: 0, next: this.zoom, x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
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
      this.root.scrollLeft -= x - pinch.x;
      this.root.scrollTop -= y - pinch.y;
      pinch.x = x;
      pinch.y = y;
      // Once a frame: with the text as wide as the window, every size is laid out again.
      pinch.frame ||= requestAnimationFrame(() => {
        pinch.frame = 0;
        this.zoomAt(pinch.next, pinch.x, pinch.y);
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
      if (comparePositions(pos, this.selection.focus) !== 0 && comparePositions(pos, this.selection.anchor) !== 0) this.setSelection(this.selection.anchor, pos);
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
      this.zoomAt(this.pinch.next, this.pinch.x, this.pinch.y);
      this.pinch = undefined;
      this.emit();
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
      this.onTouchSelect?.();
      return;
    }
    const now = Date.now();
    const again = now - this.lastTap.time < TAP_AGAIN_MS && Math.hypot(touch.x - this.lastTap.x, touch.y - this.lastTap.y) < TAP_AGAIN_PX;
    const count = again ? this.lastTap.count + 1 : 1;
    this.lastTap = { time: now, x: touch.x, y: touch.y, count };
    /** Where the caret was, when the document had it: a tap on it again offers what can be done there. */
    const caret = this.collapsed && document.activeElement === this.input ? this.selection.focus : undefined;
    this.press({ clientX: touch.x, clientY: touch.y, detail: count, shiftKey: false, target: e.target });
    this.onMouseUp(new MouseEvent('mouseup'));
    if (!this.collapsed) this.onTouchSelect?.();
    else {
      this.showCaretHandle();
      // A tap on a word spelled wrong offers what it could be, as a phone does.
      if (count === 1 && this.misspelling) this.onSpellingMenu?.();
      else if (count === 1 && caret && comparePositions(caret, this.selection.focus) === 0) this.onTouchSelect?.();
    }
  };

  private onTouchCancel = (): void => {
    window.clearTimeout(this.touch?.timer);
    this.touch = undefined;
    if (this.pinch) cancelAnimationFrame(this.pinch.frame);
    this.pinch = undefined;
  };

  // --- Clipboard without a keyboard ---------------------------------------

  /** The selection, with its formatting, apart from the document. */
  private selectedClip(): Clip | undefined {
    return this.collapsed ? undefined : clipOf(this.text, this.range);
  }

  /** Copies the selection with its formatting, for where there are no keys to do it with. */
  async copy(): Promise<boolean> {
    const clip = this.selectedClip();
    if (!clip) return false;
    const text = clipText(clip);
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        const html = clipHtml(clip, serializeClip(clip));
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      return true;
    } catch {
      // A page not served over HTTPS has no clipboard to write to: the old way still copies from a field.
      const field = document.createElement('textarea');
      field.value = text;
      field.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px';
      document.body.appendChild(field);
      field.select();
      let done = false;
      try {
        done = document.execCommand('copy');
      } catch {
        done = false;
      }
      field.remove();
      this.focus();
      return done;
    }
  }

  /** Whether what was copied can be read here: only a page served over HTTPS, or on this machine, may. */
  get canPaste(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;
  }

  async cut(): Promise<boolean> {
    if (!(await this.copy())) return false;
    this.deleteBackward();
    return true;
  }

  /**
   * Puts in what was copied: with the formatting it had where it was copied
   * from, or, with `plain`, as text that looks like the text around it. The
   * browser may ask the person first.
   */
  async paste(options: { plain?: boolean } = {}): Promise<boolean> {
    try {
      if (!options.plain && navigator.clipboard.read) {
        for (const item of await navigator.clipboard.read()) {
          if (!item.types.includes('text/html')) continue;
          const clip = clipFromHtml(await (await item.getType('text/html')).text());
          if (clip) return this.insertClip(clip);
        }
      }
      const text = await navigator.clipboard.readText();
      if (text) this.insertText(text);
      return !!text;
    } catch {
      return false;
    }
  }

  /** Writes `clip` over the selection, with its formatting. */
  insertClip(clip: Clip): boolean {
    // A header or footer is one piece: it cannot be broken into pages.
    if (this.area !== 'body') {
      clip = { paragraphs: clip.paragraphs.map((p) => ({ ...p, runs: p.runs.map((r) => ({ ...r, text: r.text.replace(/\f/g, '') })) })) };
    }
    if (!clipText(clip)) return false;
    const range = this.range;
    const doc = this.collapsed ? this.text : deleteRange(this.text, range);
    const result = insertClip(doc, outsideField(doc, range.from), clip);
    this.commit(result.doc, { anchor: result.pos, focus: result.pos });
    this.announcer.say(t('a11y.pasted'));
    return true;
  }

  private onCopy = (e: ClipboardEvent): void => {
    e.preventDefault();
    const clip = this.selectedClip();
    if (!clip || !e.clipboardData) return;
    const data = serializeClip(clip);
    e.clipboardData.setData('text/plain', clipText(clip));
    e.clipboardData.setData('text/html', clipHtml(clip, data));
    e.clipboardData.setData(CLIP_TYPE, data);
  };

  private onCut = (e: ClipboardEvent): void => {
    this.onCopy(e);
    if (!this.collapsed) this.deleteBackward();
  };

  private onPaste = (e: ClipboardEvent): void => {
    e.preventDefault();
    const plain = this.plainPaste;
    this.plainPaste = false;
    const data = e.clipboardData;
    const text = data?.getData('text/plain') ?? '';
    if (!plain && data) {
      const clip = parseClip(data.getData(CLIP_TYPE)) ?? (data.types.includes('text/html') ? clipFromHtml(data.getData('text/html')) : undefined);
      if (clip && this.insertClip(clip)) return;
    }
    // A copied picture comes as a file; Word sends one of what was copied along with its text, which is what is wanted then.
    const picture = text ? undefined : [...(data?.files ?? [])].find((file) => imageExtension(file.type));
    if (picture) {
      void this.insertImageFile(picture);
      return;
    }
    this.insertText(text);
  };
}
