import {
  type Doc,
  type FindOptions,
  type Layout,
  type LayoutCache,
  type OutlineItem,
  type ListKind,
  type PageNumbering,
  type PageSetup,
  type ParagraphStyle,
  type ParagraphProps,
  type Position,
  type Range,
  type Rect,
  type ResolvedParagraphProps,
  type ResolvedRunProps,
  type RunProps,
  applyRunProps,
  autoformat,
  bandLayout,
  canMergeCells,
  canSplitCell,
  clampPosition,
  comparePositions,
  createDoc,
  createLayoutCache,
  deleteColumn,
  deleteRange,
  deleteRow,
  deleteTable,
  docEnd,
  docStart,
  exportDocx,
  exportMarkdown,
  type ActiveFormat,
  type TocOptions,
  insertToc,
  tocRange,
  updateToc,
  type EndnotePart,
  type FootnotePart,
  type StoryPart,
  storyKind,
  endnoteIdOf,
  endnotePart,
  footnoteIdOf,
  restoreVersion as versionOver,
  type TextBoxPart,
  insertTextBox,
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
  altText,
  setAltText,
  hasOwnFirstPage,
  insertEndnote,
  insertFootnote,
  shownEndnotes,
  shownFootnotes,
  noteLabels,
  hasOwnStories,
  sectionCount,
  sectionIndexOf,
  sectionMarks,
  setOwnFirstPage,
  setOwnStories,
  setSectionPage,
  storyOf,
  footnotePart,
  textByFamily,
  storySource,
  storyPart,
  withStory,
  moveFloat,
  resizeFloat,
  type PictureWrap,
  pictureWrap,
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
  type EditableRange,
  addEditableRange,
  editableAt,
  editableRanges,
  keepsOutside,
  removeEditableRange,
  setRestricted,
  type FormatId,
  type Variable,
  fillVariables,
  findAll,
  findAllVariables,
  documentLanguage,
  templateBlocks,
  type Block,
  type TemplateData,
  findVariables,
  importDocx,
  letterheadImage,
  letterheadMargins,
  withLetterheadMargins,
  letterheadOf,
  insertColumn,
  insertFragment,
  insertText as insertInParagraph,
  imageExtension,
  imageTypeOf,
  insertImage,
  insertRow,
  insertImageGrid,
  insertSignatures,
  insertTable,
  layoutDocument,
  leaveList,
  lineForPosition,
  mapFieldOffset,
  mergeCells,
  moveSection,
  listKindAt,
  locateCell,
  moveChar,
  moveWord,
  orderedRange,
  outline,
  outsideField,
  pageNumbering,
  paragraphLength,
  paragraphText,
  paragraphStyles,
  propsAt,
  replaceAll,
  replaceRange,
  sectionAt,
  setRowHeight,
  resizePicture,
  resolveParagraph,
  resolveRun,
  runsInRange,
  sameCell,
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
  setVariableFormat,
  variableFormats,
  variableNames,
  variableText,
  variableNotes,
  variableUses,
  textInRange,
  toggleList,
  wordRangeAt,
  removeLetterhead,
  setLetterhead,
  type Border,
  type CellPatch,
  cellOfTable,
  type Columns,
  ONE_COLUMN,
  columnsAt,
  insertColumnBreak,
  insertSectionBreak,
  setColumns,
  setHeaderRow,
  type Clip,
  clipHtml,
  clipOf,
  clipText,
  clipWithoutTables,
  insertClip,
  serializeClip,
  noteNumberingOf,
  setNoteNumbering,
  setEndnotesAt,
  type NoteNumbering,
} from '@rebodocs/core/internal';
import { getLocale, onLocaleChange, speaks, t, withRegion } from './i18n';
import { dropParagraphDialog } from './paragraphdialog';
import { type Announcer, VISUALLY_HIDDEN, createAnnouncer, injectA11yStyle, installRegionKeys, markRegion, spokenChar, spokenText } from './a11y';
import { clipFromHtml, hasImages, readClipImages } from './paste';
import { fontFaces, onFontsChange } from './fonts';
import { documentPdf } from './pdfexport';
import { IS_MAC } from './platform';
import { CanvasMeasurer } from './measurer';
import type { SpellChecker } from './spellcheck';
import { Spelling } from './spelling';
import { Painter } from './painter';
import { Keys } from './keys';
import { Pointer } from './pointer';
import { type Theme, applyTheme } from './theme';

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
export type EditArea = 'body' | 'header' | 'footer' | 'footnote' | 'endnote' | 'textbox';

/** The areas that are a story of their own, by its id: a note at the foot of the page or at the end, and a text box. */
export const ownStory = (area: EditArea): area is 'footnote' | 'endnote' | 'textbox' => area === 'footnote' || area === 'endnote' || area === 'textbox';

interface Snapshot {
  doc: Doc;
  selection: Selection;
  area: EditArea;
  areaPage: number;
  areaNote?: string;
}

export const PT_TO_PX = 4 / 3;

function moveOffset(pos: Position, delta: number): Position {
  return { para: pos.para, offset: pos.offset + delta };
}

const TYPING_MERGE_MS = 1000;
export const SCROLL_MARGIN = 24;
/** The space around and between the pages, in CSS pixels; it does not grow with the zoom. */
const PAGE_GAP = 24;
/** The same in a window as narrow as a phone's, where every pixel beside the page is one less of it. */
const NARROW_GAP = 8;
const NARROW_WINDOW = 600;
/** How much of a wheel turn doubles the zoom, with Ctrl or a pinch. */
const WHEEL_ZOOM = 300;
const STYLE_ID = 'dx-editor-style';
/** The keys that turn the mode for screen readers on and off, as in Google Docs. */
const READER_KEYS = IS_MAC ? '⌘⌥Z' : 'Ctrl+Alt+Z';
/** How many editors were made, so that the ids of each are its own. */
let editors = 0;
/** The width, in points, of the margin the notes are shown in beside each page. */
export const NOTE_MARGIN = 170;
/** With the text as wide as the window: how far its size goes. */
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
/* A stretch that may be changed: Word's shading of the exceptions of a restricted document, and stronger for a moment when a change outside them was refused. */
.dx-field{position:absolute;background:rgba(255,213,79,.18);border-bottom:1pt dotted rgba(176,132,0,.7);box-sizing:border-box;pointer-events:none}
.dx-restricted .dx-field{background:rgba(255,213,79,.32)}
.dx-field.dx-field-empty{border:1pt dotted rgba(176,132,0,.8);border-radius:2pt}
.dx-form-nudge .dx-field{animation:dx-nudge .7s}
@keyframes dx-nudge{30%{background:rgba(255,193,7,.75);box-shadow:0 0 0 2pt rgba(255,193,7,.5)}}
@media (prefers-reduced-motion:reduce){.dx-form-nudge .dx-field{animation:none}}
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
.dx-sel,.dx-var,.dx-find,.dx-note,.dx-field,.dx-peer-sel{mix-blend-mode:multiply}
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
  /** The pages of what is shown, laid out; `layoutOf(doc)` lays out any document. */
  /** @internal */ layout!: Layout;
  /** How large the pages are shown: 1 is their real size. */
  zoom = 1;
  view: ViewMode = 'column';
  /** Whether the notes are shown in a margin beside the pages. */
  showNotes = false;
  /** Set while the zoom follows the size of the window. */
  fit: ZoomFit | undefined;
  /** Set while nothing typed or done may change the document. */
  /** @internal */ locked = false;
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
    if (this.spelling.checker) this.painter.renderSelection();
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
    if (this.spelling.checker) this.painter.renderSelection();
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
  /** @internal */ areaPage = 0;
  /** The note at the foot of the page whose text the caret is in, by its id. */
  /** @internal */ areaNote: string | undefined;
  private textView: { doc: Doc; part: StoryPart; view: Doc } | undefined;
  /** What is being searched for, and where it is found in the text the selection is in. */
  private finding: { query: string; options: FindOptions } | undefined;
  /** @internal */ found: Range[] = [];

  /** @internal */ measurer = new CanvasMeasurer();
  /** @internal */ layoutCache: LayoutCache = createLayoutCache();
  /** The lines of the paragraphs at the width of the window, kept apart from those at the width of the page. */
  /** @internal */ flowCache: LayoutCache = createLayoutCache();
  /** @internal */ flowWidth = 0;
  /** The room around and between the pages, in pixels: less of it in a narrow window. */
  private gap = PAGE_GAP;
  /** The pages of the document while it is not shown in them, worked out when something asks. */
  /** @internal */ pagedView: { doc: Doc; layout: Layout } | undefined;
  /** The zoom the pages had before the text was set to the window, to go back to. */
  private pagedZoom: { zoom: number; fit: ZoomFit | undefined } | undefined;
  /** @internal */ root: HTMLElement;
  /** @internal */ pagesEl: HTMLElement;
  /** @internal */ input: HTMLTextAreaElement;
  /** @internal */ caretEl: HTMLElement;
  /** @internal */ pageEls: HTMLElement[] = [];
  private resizeObserver: ResizeObserver;
  /** What is drawn: the pages near the view, and over them the selection, the caret and the others. */
  /** @internal */ readonly painter = new Painter(this);
  /** The hidden field the keys, typed text and the clipboard go to. */
  private readonly keys = new Keys(this);
  /** The mouse and the fingers on the pages. */
  /** @internal */ readonly pointer = new Pointer(this);
  /** The words spelled wrong in what is shown. */
  /** @internal */ spelling = new Spelling({
    language: () => this.textLanguage,
    paragraphs: () => this.text.paragraphs,
    checking: () => this.area === 'body' && !this.locked,
    underline: (range) => this.painter.underline(range),
    redraw: () => this.painter.renderSelection(),
    connected: () => this.root.isConnected,
  });

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
  /** @internal */ peers: PeerCaret[] = [];
  private lastEdit = { kind: '', time: 0 };
  /** Formatting toggled with a collapsed selection, applied to the next typed text. */
  /** @internal */ pendingProps: RunProps | null = null;
  /** Column kept while moving vertically. */
  /** @internal */ goalX: number | null = null;
  /** @internal */ composing = false;
  /** What a screen reader is told. */
  /** @internal */ announcer!: Announcer;
  /** The keys to leave the document, for a screen reader. */
  private hint = document.createElement('div');
  /**
   * With the mode for screen readers on: the paragraph the caret is in, as the
   * hidden field holds it, and the part of it selected there. Off, the field
   * holds only a mark, and what the caret meets is said by the editor.
   */
  /** @internal */ mirror: { text: string; start: number; end: number } | undefined;
  /** True from a touch of the screen until the mouse is used: the selection then has handles to drag it by. */
  byTouch = false;
  /** Called when a selection was made by touch, for what offers something to do with it. */
  onTouchSelect: (() => void) | undefined;
  /** Called when a word spelled wrong is pressed with the other button: the caret is in it, for its suggestions to be offered. */
  onSpellingMenu: (() => void) | undefined;
  private listeners = new Set<() => void>();
  /** Its own labels over the pages are written again when the language changes. */
  private stopLocale = onLocaleChange(() => {
    this.input.setAttribute('aria-label', t('a11y.document'));
    this.hint.textContent = t('a11y.hint', { reader: READER_KEYS });
    speaks(this.hint);
    this.painter.renderSelection();
  });
  /** A font the application gives changes how wide its text is: everything is measured again. */
  private stopFonts = onFontsChange(() => this.painter.refont());

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
    this.pointer.handleLayer.className = 'dx-handles';
    this.pagesEl.appendChild(this.pointer.handleLayer);
    this.pointer.handles = { anchor: this.pointer.handle('anchor'), focus: this.pointer.handle('focus'), caret: this.pointer.handle('caret') };
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
    this.keys.resetInput();

    this.pointer.listen();
    this.keys.listen();
    window.visualViewport?.addEventListener('resize', this.painter.onViewport);
    this.input.addEventListener('focus', () => this.root.classList.add('dx-focused'));
    this.input.addEventListener('blur', () => this.root.classList.remove('dx-focused'));
    this.root.addEventListener('wheel', this.onWheel, { passive: false });
    this.root.addEventListener('scroll', this.painter.onScroll, { passive: true });
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
      this.painter.render();
      this.painter.renderSelection();
      this.emit();
    });
    this.resizeObserver.observe(this.root);

    this.fitGap();
    this.painter.render();
    this.painter.renderSelection();
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
    this.pointer.stop();
    window.visualViewport?.removeEventListener('resize', this.painter.onViewport);
    this.root.removeEventListener('wheel', this.onWheel);
    this.root.removeEventListener('scroll', this.painter.onScroll);
    cancelAnimationFrame(this.painter.scrollFrame);
    this.spelling.stop();
    this.resizeObserver.disconnect();
    this.painter.releaseImages();
    for (const face of this.painter.fontFaces) document.fonts.delete(face);
    this.pagesEl.remove();
    this.root.classList.remove('dx-editor', 'dx-focused', 'dx-touch', 'dx-theme-dark', 'dx-theme-auto');
  }

  /** @internal */ themeName: Theme = 'light';
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
    this.keys.resetInput();
    this.announcer.say(t(on ? 'a11y.readerOn' : 'a11y.readerOff'), true);
    this.emit();
  }

  /** Puts in the hidden field the paragraph the caret is in, and the selection in it, when the mode for screen readers is on. */
  /** @internal */ syncMirror(): void {
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
  /** @internal */ readerInput(): void {
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

  // --- How the changes are shown ------------------------------------------

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
    this.painter.render();
    this.painter.renderSelection();
    this.emit();
  }

  /** The document as it is shown: itself, or with its changes decided as `changesView` says. */
  /** @internal */ get shown(): Doc {
    if (this.changesShown === 'all') return this.doc;
    if (this.shownCache?.doc !== this.doc || this.shownCache.view !== this.changesShown) {
      this.shownCache = { doc: this.doc, view: this.changesShown, shown: decideAllRevisions(this.doc, this.changesShown === 'accepted') };
    }
    return this.shownCache.shown;
  }

  // --- Document -----------------------------------------------------------

  load(doc: Doc): void {
    this.painter.releaseImages();
    this.painter.painted = [];
    this.doc = doc;
    this.finding = undefined;
    this.found = [];
    this.area = 'body';
    this.areaPage = 0;
    this.areaNote = undefined;
    this.syncArea();
    this.painter.loadEmbeddedFonts();
    // A language chosen for the document before is not this one's.
    this.chosenLanguage = undefined;
    this.startLanguage = withRegion(getLocale());
    this.syncLanguage();
    this.selection = { anchor: docStart(), focus: docStart() };
    this.undoStack = [];
    this.redoStack = [];
    this.pendingProps = null;
    this.goalX = null;
    this.root.classList.toggle('dx-restricted', this.restricted);
    this.painter.render();
    this.painter.renderSelection();
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
    const before = this.painter.caretBox().top - this.root.scrollTop;
    const inView = before >= 0 && before <= this.root.clientHeight;
    const scroll = this.root.scrollTop;
    this.doc = doc;
    this.selection = selection;
    this.afterDocChange(reveal);
    if (reveal) return;
    // Lines that came or went above the caret would move it under the person's eyes.
    this.root.scrollTop = inView ? scroll + (this.painter.caretBox().top - scroll - before) : scroll;
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
      const end = endnoteIdOf(part);
      const box = textBoxIdOf(part);
      if (note !== undefined) this.setArea('footnote', undefined, note);
      else if (end !== undefined) this.setArea('endnote', undefined, end);
      else if (box !== undefined) this.setArea('textbox', undefined, box);
      else {
        const kind = storyKind(part as Exclude<StoryPart, FootnotePart | EndnotePart | TextBoxPart>);
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

  // --- Restricted editing ------------------------------------------------

  /**
   * Whether only the stretches marked for it may be changed (`editableRanges`),
   * and the rest only read, copied and noted on, as Word's "Restrict editing".
   * It is said in the file, so Word restricts it too. A change outside them is
   * not made, and said not to be: what an application asks of the document as
   * well, until it opens it again.
   */
  get restricted(): boolean {
    return !!this.doc.restricted;
  }

  /** Restricts the document to its stretches that may be changed, or opens it all again. Not a step to undo. */
  setRestricted(on: boolean): void {
    if (on === this.restricted || this.locked) return;
    this.doc = setRestricted(this.doc, on);
    this.afterDocChange(false);
  }

  /** The stretches of the text that may be changed while the document is restricted, in their order. */
  get editableRanges(): EditableRange[] {
    return editableRanges(this.doc);
  }

  /** The stretch the caret is in, its ends included. */
  get activeEditable(): string | undefined {
    return this.area === 'body' ? editableAt(this.doc, this.selection.focus)?.id : undefined;
  }

  /**
   * Makes the selection a stretch that may be changed, or the caret an empty
   * one to write in, and leaves the caret at its end; returns its id. Not while
   * the document is restricted: what may be changed is decided with it open.
   */
  makeEditable(): string | undefined {
    if (this.area !== 'body' || this.restricted || this.locked) return undefined;
    const { doc, id } = addEditableRange(this.doc, this.range);
    const end = editableRanges(doc).find((one) => one.id === id)?.range.to;
    if (!end) return undefined;
    this.commitDoc(doc, { anchor: end, focus: end });
    return id;
  }

  /** Takes away the stretch `id`, or the one the caret is in: its text stays, and is like the rest again. Not while restricted. */
  removeEditable(id = this.activeEditable): void {
    if (id === undefined || this.restricted) return;
    const doc = removeEditableRange(this.doc, id);
    if (doc !== this.doc) this.commitDoc(doc, this.selection);
  }

  /**
   * Selects what the next stretch that may be changed holds, or the one
   * before with -1, from the caret and going round: Tab and Shift+Tab while
   * the document is restricted. False when there is none.
   */
  nextEditable(dir: 1 | -1 = 1): boolean {
    const ranges = this.editableRanges;
    if (!ranges.length || this.area !== 'body') return false;
    const at = this.selection.focus;
    const current = ranges.findIndex(({ id }) => id === this.activeEditable);
    let index: number;
    if (current >= 0) index = (current + dir + ranges.length) % ranges.length;
    else if (dir > 0)
      index = Math.max(
        0,
        ranges.findIndex(({ range }) => comparePositions(range.from, at) > 0),
      );
    else index = ranges.reduce((last, { range }, i) => (comparePositions(range.to, at) < 0 ? i : last), -1);
    // None before the caret: round to the last.
    if (index < 0) index = ranges.length - 1;
    const { from, to } = ranges[index].range;
    this.setSelection(from, to);
    return true;
  }

  /** A change was not made, being outside what may be changed: said, and the stretches that may be are shown. */
  private refuse(): void {
    this.announcer.say(t('form.outside'), true);
    this.root.classList.remove('dx-form-nudge');
    // Again from its start, for a second key that is refused too.
    void this.root.offsetWidth;
    this.root.classList.add('dx-form-nudge');
    // Taken off once it has been shown: the stretches drawn again would show it again.
    clearTimeout(this.nudged);
    this.nudged = setTimeout(() => this.root.classList.remove('dx-form-nudge'), 700);
    this.onRefused?.();
  }

  private nudged: ReturnType<typeof setTimeout> | undefined;

  /** Called when a change is not made, the document being restricted and the change outside what may be changed: for an interface to say so. */
  onRefused: (() => void) | undefined;

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
    this.painter.renderSelection();
  }

  /** The page each paragraph of `doc` would start on, from 1, laid out as this editor lays documents out. */
  pagesOf(doc: Doc): (para: number) => number {
    const { lines, paraFirstLine } = this.layoutOf(doc);
    return (para) => (lines[paraFirstLine[para]]?.page ?? 0) + 1;
  }

  /** `doc` laid out in pages as this editor lays documents out: the one it shows, for the document it has open. */
  layoutOf(doc: Doc): Layout {
    return doc === this.doc ? this.paged : layoutDocument(doc, this.measurer);
  }

  loadDocx(data: ArrayBuffer | Uint8Array): void {
    this.load(importDocx(data instanceof Uint8Array ? data : new Uint8Array(data)));
  }

  exportDocx(): Uint8Array<ArrayBuffer> {
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
    this.painter.drawAll = true;
    this.painter.paint();
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
    this.painter.sheetEls.forEach((_, i) => sizeOf(i));
    style.textContent = `@page{size:${first.width}pt ${first.height}pt;margin:0}` + [...sizes].map(([size, name]) => `@page ${name}{size:${size};margin:0}`).join('');
    holder.appendChild(style);
    for (const [i, sheet] of this.painter.sheetEls.entries()) {
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
    this.painter.drawAll = false;
    if (flow) this.setView('flow');
    else this.painter.paint();
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
  /** @internal */ get paged(): Layout {
    if (this.view !== 'flow') return this.layout;
    const shown = this.shown;
    if (this.pagedView?.doc !== shown) this.pagedView = { doc: shown, layout: layoutDocument(shown, this.measurer, this.layoutCache) };
    return this.pagedView.layout;
  }

  /** How wide the window is, in points of the document at the size it is shown. */
  /** @internal */ windowWidth(): number {
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
    return !!this.painter.selectedPicture();
  }

  /** What the selected picture is, for whoever cannot see it, as Word keeps it ("Alt Text"): what a screen reader says of it. Undefined without one. */
  get pictureDescription(): string | undefined {
    const picture = this.painter.selectedPicture();
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
    const picture = this.painter.selectedPicture();
    if (!picture || this.locked) return;
    const doc = setAltText(this.text, picture.pos, text);
    if (doc !== this.text) this.commit(doc, this.selection, '', false);
  }

  /** Gives the selected picture `fraction` of the width of the column it is in, keeping its shape. */
  fitSelectedPicture(fraction: number): void {
    const picture = this.painter.selectedPicture();
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
    const picture = this.painter.selectedPicture();
    return picture && pictureWrap(this.text, picture.pos);
  }

  /** Says how the selected picture sits in the text. It stays where it is on the page, as far as it can. */
  setPictureWrap(wrap: PictureWrap): void {
    const picture = this.painter.selectedPicture();
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
  /** @internal */ floatBoxIn(text: Doc, pos: Position): Rect | undefined {
    const layout = layoutDocument(this.merged(text), this.measurer);
    // In a header or a footer, the one of the page being edited: its positions are those of the page.
    const flow = (this.areaKey && bandLayout(layout, this.areaKey, this.areaPage)) || layout;
    for (const page of flow.pages) {
      const float = page.floats.find((f) => f.para === pos.para && f.offset === pos.offset);
      if (float) return { page: this.pageOf(page.index), x: float.x, y: float.y, width: float.width, height: float.height };
    }
    return undefined;
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

  /** Where the notes at the end go: after the last line of the document, or after that of each section. */
  get endnotesAt(): 'document' | 'sections' {
    return this.doc.endnotesAt ?? 'document';
  }

  /** Sets the notes at the end out at the end of the document, or at the end of each section. */
  setEndnotesAt(at: 'document' | 'sections'): void {
    const doc = setEndnotesAt(this.doc, at);
    if (doc !== this.doc) this.commitDoc(doc, this.selection);
  }

  /** How the section numbers the notes of `kind` its text refers to: undefined for 1, 2, 3 at the foot of the page and i, ii, iii at the end, the count going on from the section before. */
  noteNumbering(kind: 'footnote' | 'endnote'): NoteNumbering | undefined {
    return noteNumberingOf(this.doc, kind, this.sectionIndex);
  }

  /** Numbers the notes of `kind` of the section as `numbering` says: their format, the number they start at, and whether the count starts again in it, or on each page for notes at the foot of the page. */
  setNoteNumbering(kind: 'footnote' | 'endnote', numbering: NoteNumbering | undefined): void {
    const doc = setNoteNumbering(this.doc, kind, this.sectionIndex, numbering);
    if (doc !== this.doc) this.commitDoc(doc, this.selection);
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
    if (flowed) this.painter.render();
    this.pageEls.forEach((_, i) => this.sizePage(i));
    this.painter.renderSelection();
    this.painter.scrollCaretIntoView();
    this.emit();
  }

  /** Shows the notes in a margin to the right of the pages, as Word shows its comments, or puts the margin away. */
  setShowNotes(on: boolean): void {
    if (on === this.showNotes) return;
    this.showNotes = on;
    // The pages share the window with the margin: a zoom that follows it is worked out again.
    if (this.fit) this.zoom = this.clampZoom(this.fitZoom(this.fit));
    this.pageEls.forEach((_, i) => this.sizePage(i));
    this.painter.renderSelection();
    this.painter.scrollCaretIntoView();
    this.emit();
  }

  /**
   * Changes the zoom keeping under a point of the window what was under it:
   * what two fingers, or the pointer with the wheel, are on.
   */
  /** @internal */ zoomAt(zoom: number, clientX: number, clientY: number): void {
    const page = this.pageEls[this.pointer.pageAt(clientY)];
    const was = page.getBoundingClientRect();
    const fx = (clientX - was.left) / was.width;
    const fy = (clientY - was.top) / was.height;
    this.fit = undefined;
    if (!this.applyZoom(zoom)) return;
    const now = page.getBoundingClientRect();
    this.root.scrollLeft += now.left + fx * now.width - clientX;
    this.root.scrollTop += now.top + fy * now.height - clientY;
  }

  /** @internal */ clampZoom(zoom: number): number {
    const [min, max] = this.view === 'flow' ? [FLOW_MIN_ZOOM, FLOW_MAX_ZOOM] : [MIN_ZOOM, MAX_ZOOM];
    return Math.min(max, Math.max(min, Number.isFinite(zoom) ? zoom : 1));
  }

  /** The zoom at which the pages across the window, or one whole page, just fit in it. */
  /** @internal */ fitZoom(fit: ZoomFit): number {
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
    if (this.view === 'flow') this.painter.render();
    else this.pageEls.forEach((_, i) => this.sizePage(i));
    this.painter.renderSelection();
    this.root.scrollTop = middle * this.root.scrollHeight - clientHeight / 2;
    this.emit();
    return true;
  }

  /** The size and margins of page `i` of what is shown: those of its section. */
  /** @internal */ setupOf(i: number): PageSetup {
    return this.layout.pages[i]?.setup ?? this.layout.page;
  }

  /** @internal */ sizePage(i: number): void {
    const { width, height } = this.setupOf(i);
    this.pageEls[i].style.width = `${width * this.zoom}pt`;
    this.pageEls[i].style.height = `${height * this.zoom}pt`;
    const sheet = this.painter.sheetEls[i].style;
    sheet.width = `${width}pt`;
    sheet.height = `${height}pt`;
    sheet.transform = this.zoom === 1 ? '' : `scale(${this.zoom})`;
    // Text as wide as the window fills it to the bottom, however short it is.
    this.pageEls[i].style.minHeight = this.view === 'flow' ? `${this.root.clientHeight}px` : '';
  }

  private onWheel = (e: WheelEvent): void => {
    this.pointer.hideNoteTip();
    // Ctrl and the wheel, which is also what a pinch on a trackpad sends.
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    this.zoomAt(this.zoom * Math.exp(-e.deltaY / WHEEL_ZOOM), e.clientX, e.clientY);
  };

  // --- Header and footer --------------------------------------------------

  /**
   * Moves the selection into the header or the footer, on `page` (counting
   * from 0, the caret's by default), or back into the text of the document.
   * One that does not exist yet starts as an empty paragraph, and is dropped
   * again if it is left empty.
   */
  setArea(area: EditArea, page?: number, note?: string): void {
    if (this.view === 'flow' && area !== 'body') return;
    // A note is edited on the page its text starts on, unless another page that shows some of it is asked for; a text box, on one it is on.
    const own = ownStory(area);
    if (own && (note === undefined || this.notePage(note, page, area) === undefined)) return;
    const at = own ? this.notePage(note!, page, area as 'footnote' | 'endnote' | 'textbox')! : Math.max(0, Math.min(page ?? this.currentPage - 1, this.pageCount - 1));
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
    this.painter.render();
    this.refind();
    // Back in the text, the caret goes to the page that was being looked at.
    const first = area === 'body' ? this.paged.pages[at]?.lines[0] : undefined;
    const pos = first ? { para: first.para, offset: first.start } : docStart();
    this.setSelection(pos);
    const name = this.area === 'body' ? t('a11y.body') : t(`area.${this.area}`);
    this.announcer.say(this.area === 'body' ? name : `${name}, ${t('a11y.page', { page: this.pageOf(this.areaPage) + 1 })}`, true);
  }

  /** The document the selection is in: the real one, or the header or footer seen as one. */
  /** @internal */ get text(): Doc {
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
  /** @internal */ get part(): StoryPart | undefined {
    if (this.area === 'footnote') return footnotePart(this.areaNote!);
    if (this.area === 'endnote') return endnotePart(this.areaNote!);
    if (this.area === 'textbox') return textBoxPart(this.areaNote!);
    return this.area === 'body' ? undefined : storyPart(this.paged, this.area, this.areaPage);
  }

  /** What `bandLayout` knows the area being edited by, when it is not the text. */
  private get areaKey(): 'header' | 'footer' | FootnotePart | EndnotePart | TextBoxPart | undefined {
    if (this.area === 'body') return undefined;
    if (this.area === 'footnote') return footnotePart(this.areaNote!);
    if (this.area === 'endnote') return endnotePart(this.areaNote!);
    return this.area === 'textbox' ? textBoxPart(this.areaNote!) : this.area;
  }

  /** The page that shows note `id`, at the foot or at the end, or text box `id`: `page` when it shows it, otherwise the first that does. */
  private notePage(id: string, page?: number, area: 'footnote' | 'endnote' | 'textbox' = 'footnote'): number | undefined {
    const shows = (i: number) => {
      const at = this.paged.pages[i];
      if (area === 'textbox') return at?.textBoxes?.some((box) => box.id === id);
      return (area === 'endnote' ? at?.endnotes : at?.footnotes)?.notes.some((note) => note.id === id);
    };
    if (page !== undefined && shows(page)) return page;
    const first = this.paged.pages.findIndex((_, i) => shows(i));
    return first < 0 ? undefined : first;
  }

  /** The layout the selection is in: every page, or the header or footer of the page being edited. */
  /** @internal */ get flow(): Layout {
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
  /** @internal */ mapOffset(pos: Position, shown: boolean): Position {
    const story = this.part && storyOf(this.doc, this.part);
    if (!story) return pos;
    const model = story.paragraphs[pos.para];
    const onPage = story && storyOnPage(story, this.areaPage + 1, this.pageCount).paragraphs[pos.para];
    if (!model || !onPage || model === onPage) return pos;
    return { para: pos.para, offset: shown ? mapFieldOffset(model, onPage, pos.offset) : mapFieldOffset(onPage, model, pos.offset) };
  }

  /** The page of the document a page of the flow is. */
  /** @internal */ pageOf(flowPage: number): number {
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
    if (!part || ownStory(this.area)) return;
    const paragraphs = storyOf(this.doc, part)?.paragraphs ?? [];
    if (paragraphs.length !== 1 || paragraphs[0].origin !== undefined || paragraphs[0].runs.some((run) => run.text)) return;
    this.doc = withStory(this.doc, part, undefined);
  }

  private syncArea(): void {
    // A note is edited where it is, as the text is: nothing else is dimmed.
    this.root.classList.toggle('dx-editing', this.area === 'header' || this.area === 'footer');
    this.root.classList.toggle('dx-editing-header', this.area === 'header');
    this.root.classList.toggle('dx-editing-footer', this.area === 'footer');
    // A note at the end is edited as one at the foot of the page is.
    this.root.classList.toggle('dx-editing-footnote', this.area === 'footnote' || this.area === 'endnote');
    this.root.classList.toggle('dx-editing-textbox', this.area === 'textbox');
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
    this.spelling.typedAt = undefined;
    this.selection = { anchor: clampPosition(this.text, anchor), focus: clampPosition(this.text, focus) };
    this.pendingProps = null;
    this.goalX = null;
    this.lastEdit.kind = '';
    this.painter.renderSelection();
    this.painter.scrollCaretIntoView();
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

  /** A new line in the same paragraph, as Shift+Enter makes in Word: what `insertText('\n')` would make another paragraph. */
  insertLineBreak(): void {
    const range = this.range;
    const { field: _, ...props } = this.pendingProps ?? this.activeRunProps();
    const doc = this.collapsed ? this.text : deleteRange(this.text, range);
    const result = insertInParagraph(doc, outsideField(doc, range.from), '\n', props);
    this.commit(result.doc, { anchor: result.pos, focus: result.pos });
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
    this.painter.renderSelection();
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

  // --- Table of contents --------------------------------------------------

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
    this.root.scrollTop = this.painter.caretBox().top - SCROLL_MARGIN * 2;
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
    const { top } = this.painter.caretBox();
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
  async exportPdf(title?: string): Promise<Uint8Array<ArrayBuffer>> {
    this.updateToc();
    return documentPdf(this.paged, this.doc, { measurer: this.measurer, title, language: this.textLanguage });
  }

  // --- Styles -------------------------------------------------------------

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

  // --- Tables -------------------------------------------------------------

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

  // --- Lists and indents --------------------------------------------------

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
  // --- Text boxes, notes, breaks and the page -----------------------------

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
    return (this.doc.textBoxes ?? []).map((box) => ({
      id: box.id,
      text: box.paragraphs
        .map((p) => p.runs.map((run) => run.text).join(''))
        .join('\n')
        .replace(/[\u2060\uFFFC]/g, ''),
    }));
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

  /** Puts a note at the end of the document at the caret, and goes to its text, after its number, to write it. */
  insertEndnote(text = ''): void {
    if (this.area !== 'body') return;
    const doc = this.collapsed ? this.doc : deleteRange(this.doc, this.range);
    const result = insertEndnote(doc, outsideField(doc, this.range.from), text);
    this.commitDoc(result.doc, { anchor: result.pos, focus: result.pos });
    if (this.view === 'flow') return;
    this.setArea('endnote', undefined, result.id);
    const note = this.text.paragraphs;
    const end = { para: note.length - 1, offset: paragraphLength(note[note.length - 1]) };
    this.setSelection(end);
  }

  /** The notes at the end of the document that the text refers to, in the order of their numbers, each with what it shows as its number (i, ii, iii). */
  get endnotes(): { id: string; number: number; label: string; text: string }[] {
    const labels = noteLabels(this.doc, 'endnote');
    return shownEndnotes(this.doc).map((note, k) => ({
      id: note.id,
      number: k + 1,
      label: labels.get(note.id)!,
      text: note.paragraphs
        .map((p) => paragraphText(p).replace(/[\u2060\uFFFC]/g, ''))
        .join('\n')
        .trim(),
    }));
  }

  /** The notes at the foot of the pages that the text refers to, in the order of their numbers. */
  get footnotes(): { id: string; number: number; text: string }[] {
    const numbers = footnoteNumbers(this.doc);
    return shownFootnotes(this.doc).map((note) => ({
      id: note.id,
      number: numbers.get(note.id)!,
      text: note.paragraphs
        .map((p) => paragraphText(p).replace(/[\u2060\uFFFC]/g, ''))
        .join('\n')
        .trim(),
    }));
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
  /** @internal */ tabChangesLevel(): boolean {
    const { from, to } = this.range;
    for (let i = from.para; i <= to.para; i++) if (!this.text.paragraphs[i].props.numId) return false;
    return true;
  }

  // --- Undo ---------------------------------------------------------------

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
  /** @internal */ commit(text: Doc, selection: Selection, kind = '', tracked = true): void {
    this.spelling.typedAt = kind === 'type' ? selection.focus : undefined;
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
  /** @internal */ commitDoc(doc: Doc, selection: Selection, kind = ''): void {
    if (this.locked) return;
    if (this.doc.restricted && !keepsOutside(this.doc, doc)) {
      this.refuse();
      return;
    }
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
    this.root.classList.toggle('dx-restricted', this.restricted);
    // What was changed may not be what the selection is in: the page number, from inside the footer.
    this.selection = { anchor: clampPosition(this.text, this.selection.anchor), focus: clampPosition(this.text, this.selection.focus) };
    this.pendingProps = null;
    this.goalX = null;
    this.lastEdit.kind = '';
    this.refind();
    this.painter.render();
    // The page whose header was being edited may be gone; a note may have gone to another page, or away with its reference.
    this.areaPage = Math.min(this.areaPage, this.pageCount - 1);
    if (ownStory(this.area)) {
      const page = this.notePage(this.areaNote!, this.areaPage, this.area);
      if (page === undefined) {
        this.area = 'body';
        this.areaNote = undefined;
        this.syncArea();
        this.selection = { anchor: clampPosition(this.doc, this.selection.anchor), focus: clampPosition(this.doc, this.selection.focus) };
      } else this.areaPage = page;
    }
    this.painter.renderSelection();
    if (reveal) this.painter.scrollCaretIntoView();
    this.emit();
  }

  /** @internal */ emit(): void {
    for (const listener of this.listeners) listener();
  }

  // --- Spelling -----------------------------------------------------------

  /**
   * What says which words are spelled wrong; none, and nothing is marked.
   * Only the words of the pages near the view are asked about, a moment after
   * typing stops, in the language of the text (`textLanguage`).
   */
  get spellChecker(): SpellChecker | undefined {
    return this.spelling.checker;
  }

  set spellChecker(checker: SpellChecker | undefined) {
    if (this.spelling.use(checker)) this.painter.renderSelection();
  }

  /** The word spelled wrong the caret is in, or at the end of; undefined when there is none, or it is not known yet. */
  get misspelling(): { word: string; range: Range } | undefined {
    if (this.area !== 'body' || !this.collapsed) return undefined;
    const { para, offset } = this.selection.focus;
    return this.spelling.wrongAt(para, offset);
  }

  /** What the word spelled wrong at the caret could be instead, the likeliest first. */
  spellingSuggestions(): Promise<string[]> {
    const wrong = this.misspelling;
    return wrong ? this.spelling.suggest(wrong.word) : Promise.resolve([]);
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
    this.spelling.ignore(wrong.word);
    this.painter.renderSelection();
    this.emit();
  }

  /** Whether the dictionary takes new words, for "Add to dictionary". */
  get canAddWords(): boolean {
    return !!this.spelling.checker?.add;
  }

  /** Gives the word spelled wrong at the caret to the dictionary, as spelled right from now on. */
  addMisspelling(): void {
    const wrong = this.misspelling;
    if (!wrong || !this.spelling.add(wrong.word)) return;
    this.painter.renderSelection();
    this.emit();
  }

  /** The other button on a word spelled wrong: the caret goes into it and its suggestions are offered, in place of the browser's menu. */
  private onContextMenu = (e: MouseEvent): void => {
    if (!this.spelling.checker || this.area !== 'body') return;
    const pos = this.pointer.positionFromPoint(e.clientX, e.clientY);
    if (!this.spelling.wrongAt(pos.para, pos.offset)) return;
    e.preventDefault();
    this.focus();
    this.setSelection(pos);
    this.onSpellingMenu?.();
  };

  // --- Clipboard without a keyboard ---------------------------------------

  /** The selection, with its formatting, apart from the document. */
  /** @internal */ selectedClip(): Clip | undefined {
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
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
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
          const rtf = item.types.includes('text/rtf') ? await (await item.getType('text/rtf')).text() : undefined;
          if (clip) return this.insertClip(hasImages(clip) ? await readClipImages(clip, rtf) : clip);
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
      // Nor does a table go in it: its rows come as lines.
      clip = clipWithoutTables(clip);
      clip = { paragraphs: clip.paragraphs.map((p) => ({ ...p, runs: p.runs.map((r) => ({ ...r, text: r.text.replace(/\f/g, '') })) })) };
    }
    if (!clipText(clip) && !hasImages(clip)) return false;
    const range = this.range;
    const doc = this.collapsed ? this.text : deleteRange(this.text, range);
    const result = insertClip(doc, outsideField(doc, range.from), clip);
    this.commit(result.doc, { anchor: result.pos, focus: result.pos });
    this.announcer.say(t('a11y.pasted'));
    return true;
  }
}
