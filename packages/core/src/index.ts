// What @rebodocs/core promises: the document, reading and writing it, changing it,
// laying it out, templates, tracked changes, versions and output. Each name is here
// on purpose, and `API.md` says each as the source has it; a change to either is a
// change of the API. The rest of the engine is in `internal.ts`, for the packages of
// the repository, with no promise.

export {
  type RunProps,
  type FormatChange,
  RUN_FORMAT,
  type RunFormat,
  HIGHLIGHT_COLORS,
  type Run,
  type Align,
  type TabStop,
  type ParagraphProps,
  PARAGRAPH_FORMAT,
  type ParagraphFormat,
  type ParagraphStyle,
  type BorderStyle,
  type Border,
  type CellLines,
  type TableCell,
  type TableRow,
  type RowRevision,
  type TableFloat,
  type Table,
  type CellRef,
  type Paragraph,
  type Columns,
  type SectionStart,
  type NoteNumbering,
  type Section,
  type PageSetup,
  type Story,
  type TextBox,
  type Footnote,
  type Note,
  type Media,
  type Doc,
  type Position,
  type Range,
  type ResolvedRunProps,
  type ResolvedParagraphProps,
  DEFAULT_PAGE,
  paragraphLength,
  paragraphText,
  createParagraph,
  createDoc,
} from './model';
export {
  insertText,
  splitParagraph,
  deleteRange,
  applyRunProps,
  setParagraphProps,
  textInRange,
  docText,
  toggleList,
  type ListStyle,
  setListStyle,
  restartNumbering,
  continueNumbering,
  shiftListLevel,
} from './ops';
export {
  type FontSpec,
  type FontMetrics,
  type TextMeasurer,
  type Fragment,
  type NoteMark,
  type Line,
  type Turn,
  type CellBox,
  type TableFrame,
  type FloatBox,
  type TextBoxBand,
  type FootnoteArea,
  type FootnoteBand,
  type Band,
  type LayoutPage,
  type ColumnBox,
  type Layout,
  type LayoutCache,
  layoutDocument,
  noteRules,
} from './layout';
export { type ReflowOptions, layoutReflow } from './reflow';
export type { NumFormat, ListLevel, ListInstance, Numbering, ListKind } from './numbering';
export { type PageNumberFormat, type PageNumbering, pageNumbering, setPageNumbering } from './pageNumbers';
export { setParagraphStyle } from './styles';
export { type MarkdownOptions, exportMarkdown } from './markdown';
export { type FindOptions, findAll, replaceRange, replaceAll } from './find';
export { imageTypeOf, imageExtension, insertImage, resizePicture, altText, setAltText, type PictureWrap, pictureWrap, setPictureWrap, insertImageGrid } from './images';
export {
  type Variable,
  isVariableName,
  variableText,
  type FormatId,
  formatText,
  type FormatProblem,
  type FormatOptions,
  formatValue,
  findVariables,
  variableNames,
  fillVariables,
  templateBlocks,
  findAllVariables,
  variableNotes,
  variableUses,
  variableProblems,
  type ActiveFormat,
  variableFormats,
  setVariableFormat,
} from './variables';
export type { Block, TemplateData, TemplateValue } from './blocks';
export { autoformat } from './autoformat';
export { type OutlineItem, outline, moveSection } from './outline';
export { type PdfImage, type PdfResources, type TrueType, exportPdf } from './pdf';
export { type FontFile, readFont, readFonts, FontMeasurer } from './fonts';
export { type Rendered, renderPdf } from './render';
export {
  insertTable,
  SIGNATURE_NAME,
  SIGNATURE_TITLES,
  insertSignatures,
  insertRow,
  deleteRow,
  deleteTable,
  insertColumn,
  canMergeCells,
  mergeCells,
  canSplitCell,
  type CellPatch,
  setCellProps,
  setHeaderRow,
} from './tables';
export { type ImportOptions, importDocx } from './docx/import';
export { type DocxOptions, exportDocx } from './docx/export';
// What a document read from a file keeps of it, to write it back as it was: its shape is the engine's, and changes between versions.
export { type DocxSource, type EmbeddedFont, type StorySource, type SourceSlot, type StyleSheet, type Style, type BorderSet, type CellPadding, type TablePart, documentLanguage } from './docx/source';
export type { BasePart, EndnotePart, FootnotePart, StoryPart, TextBoxPart } from './stories';
export type { XmlNode } from './docx/xml';
export { NOTE_COLORS, addNote, setNoteText, setNoteColor, removeNote } from './notes';
export { type EditableRange, addEditableRange, editableAt, editableRanges, keepsOutside, removeEditableRange, setRestricted } from './editable';
export { type TocOptions, updateToc, insertToc } from './toc';
export { setLink, removeLink, insertLink } from './links';
export {
  type Letterhead,
  letterheadOf,
  letterheadImage,
  resizeLetterhead,
  removeLetterhead,
  setLetterhead,
  type Pixels,
  letterheadMargins,
  pngLetterheadMargins,
  withLetterheadMargins,
} from './letterhead';
export { setSectionPage, setOwnFirstPage, sectionCount, setColumns, insertColumnBreak, insertSectionBreak, noteNumberingOf, setNoteNumbering, setEndnotesAt } from './sections';
export { insertEndnote, insertFootnote } from './footnotes';
export { type ChangeKind, type ChangePiece, type Change, type NoteChange, type Comparison, ADDED_COLOR, REMOVED_COLOR, compareDocs, restoreVersion, describeChange } from './versions';
export {
  type RevisionType,
  type Reviser,
  revisionColor,
  type TrackedEdit,
  trackEdit,
  trackDocEdit,
  type RevisionView,
  type RevisionChange,
  revisionsOf,
  hasRevisions,
  type ChangePick,
  acceptRevisions,
  rejectRevisions,
  byAuthor,
  decideAllRevisions,
} from './revisions';
export { type TextBoxLook, insertTextBox } from './textboxes';
export { type ClipRun, type ClipParagraph, type ClipTable, type ClipCell, type Clip, insertClip } from './clipboard';
