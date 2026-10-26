# The public API of @rebodocs/core

Made by `node tools/api-report.mjs` from `src/index.ts`; do not change it by hand. What is here is what the
package promises: a change to it is a change of its API, and goes in the changelog. What the engine keeps
to itself is in `src/internal.ts`, for the packages of the repository, with no promise.

246 names.

## model

```ts
export interface RunProps {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  fontSize?: number;
  fontFamily?: string;
  fontEastAsia?: string;
  kern?: number;
  color?: string;
  highlight?: string;
  opaque?: string;
  wrap?: string;
  object?: string;
  anchor?: boolean;
  objectWidth?: number;
  objectHeight?: number;
  field?: string;
  revision?: '' | 'insert' | 'delete';
  revisionAuthor?: string;
  revisionDate?: string;
  insertedBy?: string;
  insertedDate?: string;
  revisionMove?: string;
  formatChange?: FormatChange<RunFormat>;
}
export interface FormatChange<T> {
  author: string;
  date?: string;
  before: T;
}
export const RUN_FORMAT = ['bold', 'italic', 'underline', 'strike', 'fontSize', 'fontFamily', 'color', 'highlight'] as const;
export type RunFormat = Pick<RunProps, (typeof RUN_FORMAT)[number]>;
export const HIGHLIGHT_COLORS = ['FFFF00', '00FF00', '00FFFF', 'FF00FF', '0000FF', 'FF0000', '000080', '008080', '008000', '800080', '800000', '808000', '808080…
export interface Run {
  text: string;
  props: RunProps;
}
export type Align = 'left' | 'center' | 'right' | 'justify';
export interface TabStop {
  pos: number;
  align: 'left' | 'center' | 'right' | 'decimal' | 'bar';
  leader?: 'dot' | 'hyphen' | 'underscore' | 'heavy' | 'middleDot';
}
export interface ParagraphProps {
  align?: Align;
  spacingBefore?: number;
  spacingAfter?: number;
  lineHeight?: number;
  indentLeft?: number;
  indentRight?: number;
  indentFirstLine?: number;
  pageBreakBefore?: boolean;
  keepNext?: boolean;
  keepLines?: boolean;
  widowControl?: boolean;
  numId?: number;
  listLevel?: number;
  styleId?: string;
  leaderTab?: number;
  tabs?: TabStop[];
  markRevision?: '' | 'insert' | 'delete';
  markAuthor?: string;
  markDate?: string;
  formatChange?: FormatChange<ParagraphFormat>;
}
export const PARAGRAPH_FORMAT = [
  'align',
  'spacingBefore',
  'spacingAfter',
  'lineHeight',
  'indentLeft',
  'indentRight',
  'indentFirstLine',
  'pageBreakBefore',
  'keepNext',
  'keepLines',
  'widowControl',
  'numId',
  'listLevel',
  'styleId',
  'leaderTab',
  'tabs',
] as const;
export type ParagraphFormat = Pick<ParagraphProps, (typeof PARAGRAPH_FORMAT)[number]>;
export interface ParagraphStyle {
  id: string;
  name: string;
  wordName?: string;
  paragraph: ParagraphProps;
  run: RunProps;
  outlineLevel?: number;
  next?: string;
}
export type BorderStyle = 'single' | 'double' | 'dashed' | 'dotted';
export interface Border {
  width: number;
  color: string;
  style: BorderStyle;
}
export interface CellLines {
  top?: Border;
  right?: Border;
  bottom?: Border;
  left?: Border;
}
export interface TableCell {
  id: number;
  span: number;
  merge?: 'start' | 'continue';
  borders: boolean;
  lines?: CellLines;
  shade?: string;
  valign?: 'center' | 'bottom';
  direction?: 'up' | 'down';
  borderTop?: number;
  borderBottom?: number;
  padTop?: number;
  padRight?: number;
  padBottom?: number;
  padLeft?: number;
}
export interface TableRow {
  id: number;
  before: number;
  height: number;
  exact?: boolean;
  cantSplit?: boolean;
  header?: boolean;
  cells: TableCell[];
  revision?: RowRevision;
}
export interface RowRevision {
  type: 'insert' | 'delete';
  author: string;
  date?: string;
}
export interface TableFloat {
  align?: 'left' | 'center' | 'right';
  x: number;
  y: number;
  gapLeft: number;
  gapRight: number;
  gapTop: number;
  gapBottom: number;
}
export interface Table {
  columns: number[];
  widthFraction?: number;
  fixed: boolean;
  align: 'left' | 'center' | 'right';
  indent: number;
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
  spacing?: number;
  float?: TableFloat;
  parent?: CellRef;
  rows: TableRow[];
}
export interface CellRef {
  table: number;
  row: number;
  cell: number;
}
export interface Paragraph {
  props: ParagraphProps;
  runs: Run[];
  cell?: CellRef;
  origin?: number;
  id?: string;
  section?: Section;
  mark?: RunProps;
}
export interface Columns {
  count: number;
  space: number;
  widths?: { width: number; space: number }[];
  separator?: boolean;
}
export type SectionStart = 'nextPage' | 'continuous' | 'nextColumn' | 'evenPage' | 'oddPage';
export interface NoteNumbering {
  format?: 'decimal' | 'lowerRoman' | 'upperRoman' | 'lowerLetter' | 'upperLetter';
  start?: number;
  restart?: 'section' | 'page';
}
export interface Section {
  page: PageSetup;
  columns?: Columns;
  start?: SectionStart;
  noHeader?: boolean;
  noFooter?: boolean;
  header?: Story;
  footer?: Story;
  firstPage?: { header?: Story; footer?: Story };
  endnoteNumbering?: NoteNumbering;
  footnoteNumbering?: NoteNumbering;
  noEndnotes?: boolean;
  xml?: string;
}
export interface PageSetup {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  headerDistance?: number;
  footerDistance?: number;
}
export interface Story {
  paragraphs: Paragraph[];
  tables?: Table[];
}
export interface TextBox extends Story {
  id: string;
}
export interface Footnote extends Story {
  id: string;
}
export interface Note {
  id: string;
  author: string;
  date?: string;
  text: string;
  color?: string;
  xml?: string;
}
export interface Media {
  bytes: Uint8Array;
  type: string;
}
export interface Doc {
  page: PageSetup;
  columns?: Columns;
  sectionStart?: SectionStart;
  noHeader?: boolean;
  noFooter?: boolean;
  paragraphs: Paragraph[];
  tables?: Table[];
  compatMode?: number;
  defaultTabStop?: number;
  header?: Story;
  footer?: Story;
  firstPage?: { header?: Story; footer?: Story };
  footnotes?: Footnote[];
  textBoxes?: TextBox[];
  footnoteSeparator?: Paragraph;
  endnotes?: Footnote[];
  endnoteSeparator?: Paragraph;
  endnoteNumbering?: NoteNumbering;
  footnoteNumbering?: NoteNumbering;
  endnotesAt?: 'sections';
  trackRevisions?: boolean;
  restricted?: boolean;
  media?: Record<string, Media>;
  notes?: Note[];
  styles?: ParagraphStyle[];
  numbering?: Numbering;
  source?: DocxSource;
}
export interface Position {
  para: number;
  offset: number;
}
export interface Range {
  from: Position;
  to: Position;
}
export type ResolvedRunProps = Required<Omit<RunProps, 'formatChange'>> & Pick<RunProps, 'formatChange'>;
export type ResolvedParagraphProps = Required<Omit<ParagraphProps, 'formatChange'>> & Pick<ParagraphProps, 'formatChange'>;
export const DEFAULT_PAGE: PageSetup = {
  width: 612,
  height: 792,
  marginTop: 72,
  marginRight: 72,
  marginBottom: 72,
  marginLeft: 72,
};
export function paragraphLength(p: Paragraph): number
export function paragraphText(p: Paragraph): string
export function createParagraph(text = '', runProps: RunProps = {}, props: ParagraphProps = {}): Paragraph
export function createDoc(paragraphs: Paragraph[] = [createParagraph()], page: PageSetup = DEFAULT_PAGE): Doc
```

## ops

```ts
export function insertText(doc: Doc, pos: Position, text: string, props?: RunProps): { doc: Doc; pos: Position }
export function splitParagraph(doc: Doc, pos: Position): { doc: Doc; pos: Position }
export function deleteRange(doc: Doc, range: Range): Doc
export function applyRunProps(doc: Doc, range: Range, patch: RunProps): Doc
export function setParagraphProps(doc: Doc, fromPara: number, toPara: number, patch: ParagraphProps): Doc
export function textInRange(doc: Doc, range: Range): string
export function docText(doc: Doc): string
export function toggleList(doc: Doc, fromPara: number, toPara: number, kind: ListKind): Doc
export interface ListStyle {
  format: NumFormat;
  text: string;
}
export function setListStyle(doc: Doc, fromPara: number, toPara: number, style: ListStyle): Doc
export function restartNumbering(doc: Doc, para: number): Doc
export function continueNumbering(doc: Doc, para: number): Doc
export function shiftListLevel(doc: Doc, fromPara: number, toPara: number, delta: number): Doc
```

## layout

```ts
export interface FontSpec {
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
  kern?: boolean;
  eastAsia?: string;
}
export interface FontMetrics {
  ascent: number;
  descent: number;
  lineGap?: number;
}
export interface TextMeasurer {
  width(text: string, font: FontSpec): number;
  metrics(font: FontSpec): FontMetrics;
  pair?(left: string, right: string, font: FontSpec): number;
}
export interface Fragment {
  kind: 'text' | 'tab' | 'break' | 'object';
  text: string;
  start: number;
  end: number;
  x: number;
  width: number;
  props: ResolvedRunProps;
  font: FontSpec;
  ascent: number;
  descent: number;
  wordSpacing: number;
  leader?: { text: string; x: number; width: number };
  mark?: NoteMark;
}
export interface NoteMark {
  text: string;
  font: FontSpec;
  rise: number;
}
export interface Line {
  index: number;
  page: number;
  para: number;
  start: number;
  end: number;
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
  fragments: Fragment[];
  label?: Fragment;
  lastInParagraph: boolean;
  cell?: number;
  turn?: Turn;
  raw: object;
}
export interface Turn {
  angle: 90 | -90;
  x: number;
  y: number;
}
export interface CellBox {
  lines?: CellLines;
  x: number;
  y: number;
  width: number;
  height: number;
  table: number;
  row: number;
  cell: number;
  borders: boolean;
  shade?: string;
}
export interface TableFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  table: number;
  lines: CellLines;
}
export interface FloatBox {
  x: number;
  y: number;
  width: number;
  height: number;
  xml: string;
  para: number;
  offset: number;
  behind?: boolean;
  part?: StoryPart;
  fixed?: boolean;
}
export interface TextBoxBand extends Band {
  id: string;
  part: TextBoxPart;
  frame: { x: number; y: number; width: number; height: number };
  look: TextBoxLook;
  behind?: boolean;
}
export interface FootnoteArea {
  rule: { x: number; y: number; width: number; height: number };
  notes: FootnoteBand[];
  moreRules?: FootnoteArea['rule'][];
}
export interface FootnoteBand extends Band {
  id: string;
  from: number;
  part: FootnotePart | EndnotePart;
}
export interface Band {
  lines: Line[];
  cells: CellBox[];
  floats: FloatBox[];
  part?: StoryPart;
}
export interface LayoutPage {
  index: number;
  lines: Line[];
  cells: CellBox[];
  floats: FloatBox[];
  header?: Band;
  footer?: Band;
  section?: number;
  setup?: PageSetup;
  parts?: { header?: StoryPart; footer?: StoryPart };
  footnotes?: FootnoteArea;
  endnotes?: FootnoteArea;
  textBoxes?: TextBoxBand[];
  frames?: TableFrame[];
  rules?: { x: number; top: number; bottom: number }[];
  columns?: ColumnBox[];
}
export interface ColumnBox {
  x: number;
  y: number;
  width: number;
  height: number;
  from: number;
  to: number;
}
export interface Layout {
  page: PageSetup;
  pages: LayoutPage[];
  lines: Line[];
  paraFirstLine: number[];
}
export type LayoutCache = WeakMap<Paragraph, CachedParagraph>;
export function layoutDocument(doc: Doc, measurer: TextMeasurer, cache?: LayoutCache): Layout
export function noteRules(page: Pick<LayoutPage, 'footnotes' | 'endnotes'>): FootnoteArea['rule'][]
```

## reflow

```ts
export interface ReflowOptions {
  width: number;
  margin?: number;
}
export function layoutReflow(doc: Doc, measurer: TextMeasurer, options: ReflowOptions, cache?: LayoutCache): Layout
```

## numbering

```ts
export type NumFormat = 'decimal' | 'decimalZero' | 'lowerLetter' | 'upperLetter' | 'lowerRoman' | 'upperRoman' | 'bullet' | 'none';
export interface ListLevel {
  start: number;
  format: NumFormat;
  text: string;
  align: 'left' | 'center' | 'right';
  suffix: 'tab' | 'space' | 'nothing';
  indentLeft?: number;
  indentFirstLine?: number;
  run: RunProps;
  restart: boolean;
  restartAfter?: number;
  legal: boolean;
  style?: string;
}
export interface ListInstance {
  abstractId: number;
  starts: Map<number, number>;
  levels: Map<number, ListLevel>;
}
export interface Numbering {
  abstracts: Map<number, (ListLevel | undefined)[]>;
  lists: Map<number, ListInstance>;
}
export type ListKind = 'bullet' | 'number';
```

## pageNumbers

```ts
export type PageNumberFormat =
  | 'number'
  | 'numberOfTotal'
  | 'page'
  | 'pageOfTotal';
export interface PageNumbering {
  place: 'header' | 'footer';
  align: Exclude<Align, 'justify'>;
  format: PageNumberFormat;
  words?: { page: string; of: string };
}
export function pageNumbering(doc: Doc): PageNumbering | undefined
export function setPageNumbering(doc: Doc, numbering: PageNumbering | undefined): Doc
```

## styles

```ts
export function setParagraphStyle(doc: Doc, fromPara: number, toPara: number, id: string): Doc
```

## markdown

```ts
export interface MarkdownOptions {
  changes?: 'accepted' | 'original' | 'marked';
}
export function exportMarkdown(doc: Doc, options: MarkdownOptions = {}): string
```

## find

```ts
export interface FindOptions {
  matchCase?: boolean;
  wholeWord?: boolean;
}
export function findAll(doc: Doc, query: string, options: FindOptions = {}): Range[]
export function replaceRange(doc: Doc, range: Range, text: string): { doc: Doc; pos: Position }
export function replaceAll(doc: Doc, query: string, text: string, options: FindOptions = {}): { doc: Doc; count: number }
```

## images

```ts
export function imageTypeOf(bytes: Uint8Array): string | undefined
export function imageExtension(type: string): string | undefined
export function insertImage(doc: Doc, pos: Position, image: Media & { width: number; height: number }): { doc: Doc; pos: Position }
export function resizePicture(doc: Doc, pos: Position, width: number, height: number): Doc
export function altText(xml: string | undefined): string | undefined
export function setAltText(doc: Doc, pos: Position, text: string): Doc
export type PictureWrap = 'inline' | 'square' | 'topBottom' | 'none' | 'behind';
export function pictureWrap(doc: Doc, pos: Position): PictureWrap | undefined
export function setPictureWrap(doc: Doc, pos: Position, wrap: PictureWrap): Doc
export function insertImageGrid(doc: Doc, pos: Position, images: (Media & { width: number; height: number })[], columns: number): { doc: Doc; pos: Position }
```

## variables

```ts
export interface Variable {
  name: string;
  formats: string[];
  range: Range;
}
export function isVariableName(name: string): boolean
export function variableText(name: string, formats: string[] = []): string
export type FormatId = 'upper' | 'lower' | 'capital' | 'bold' | 'italic' | 'underline' | 'date' | 'dateLong' | 'dateFull' | 'number' | 'currency' | 'image';
export function formatText(id: FormatId, arg = '', language = 'en'): string
export interface FormatProblem {
  format: string;
  kind: 'format' | 'value';
}
export interface FormatOptions {
  today?: Date;
  locale?: string;
  currency?: string;
}
export function formatValue(value: string, formats: string[], options: FormatOptions = {}): { text: string; props: RunProps; problems: FormatProblem[] }
export function findVariables(doc: Pick<Doc, 'paragraphs'>): Variable[]
export function variableNames(doc: Doc): string[]
export function fillVariables(doc: Doc, values: TemplateData, given: FormatOptions = {}): Doc
export function templateBlocks(doc: Doc): Block[]
export function findAllVariables(doc: Doc): (Variable & { part?: StoryPart })[]
export function variableNotes(doc: Doc): Record<string, string[]>
export function variableUses(doc: Doc, name: string): number
export function variableProblems(doc: Doc, data: TemplateData, given: FormatOptions = {}): (FormatProblem & { name: string })[]
export interface ActiveFormat {
  id: FormatId;
  arg: string;
}
export function variableFormats(doc: Doc, name: string): ActiveFormat[]
export function setVariableFormat(doc: Doc, name: string, id: FormatId, on: boolean, arg = '', language?: string): Doc
```

## blocks

```ts
export interface Block {
  name: string;
  inverted: boolean;
  kind: 'text' | 'row' | 'paragraphs';
}
export interface TemplateData {
  [name: string]: TemplateValue;
}
export type TemplateValue = string | number | boolean | null | undefined | TemplateData | TemplateValue[];
```

## autoformat

```ts
export function autoformat(doc: Doc, pos: Position, typed: string): { doc: Doc; pos: Position; mark?: 'bold' | 'italic' | 'strike' } | undefined
```

## outline

```ts
export interface OutlineItem {
  para: number;
  level: number;
  text: string;
}
export function outline(doc: Doc): OutlineItem[]
export function moveSection(doc: Doc, from: number, before?: number): { doc: Doc; para: number }
```

## pdf

```ts
export interface PdfImage {
  width: number;
  height: number;
  jpeg?: Uint8Array;
  rgb?: Uint8Array;
  alpha?: Uint8Array;
}
export interface PdfResources {
  measurer: TextMeasurer;
  font?(spec: FontSpec): Uint8Array | undefined;
  image?(xml: string, part?: StoryPart): PdfImage | undefined;
  title?: string;
  doc?: Doc;
  language?: string;
}
export interface TrueType {
  family: string;
  bold: boolean;
  italic: boolean;
  unitsPerEm: number;
  bbox: [number, number, number, number];
  ascent: number;
  descent: number;
  lineGap: number;
  capHeight: number;
  italicAngle: number;
  glyph(codePoint: number): number;
  advance(glyph: number): number;
  kerning?(left: number, right: number): number;
  cff?: boolean;
}
export function exportPdf(layout: Layout, resources: PdfResources): Uint8Array<ArrayBuffer>
```

## fonts

```ts
export interface FontFile extends TrueType {
  bytes: Uint8Array;
}
export function readFont(bytes: Uint8Array, as?: { family: string; bold: boolean; italic: boolean }): FontFile | undefined
export function readFonts(bytes: Uint8Array): FontFile[]
export class FontMeasurer implements TextMeasurer
```

## render

```ts
export interface Rendered {
  pdf: Uint8Array<ArrayBuffer>;
  layout: Layout;
  missingFonts: Map<string, string>;
  missingPictures: number;
}
export function renderPdf(doc: Doc, fonts: FontFile[], title?: string, language?: string): Rendered
```

## tables

```ts
export function insertTable(doc: Doc, pos: Position, rowCount: number, columnCount: number): { doc: Doc; pos: Position }
export const SIGNATURE_NAME = 'NOMBRE COMPLETO';
export const SIGNATURE_TITLES = ['ASESOR', 'CLIENTE'];
export function insertSignatures(doc: Doc, pos: Position, titles: string[] = SIGNATURE_TITLES, name = SIGNATURE_NAME): { doc: Doc; pos: Position; name?: { from: Position; to: Position } }
export function insertRow(doc: Doc, para: number, below: boolean): Doc
export function deleteRow(doc: Doc, para: number): { doc: Doc; pos: Position }
export function deleteTable(doc: Doc, para: number): { doc: Doc; pos: Position }
export function insertColumn(doc: Doc, para: number, right: boolean): Doc
export function canMergeCells(doc: Doc, paraA: number, paraB: number): boolean
export function mergeCells(doc: Doc, paraA: number, paraB: number): { doc: Doc; pos: Position }
export function canSplitCell(doc: Doc, para: number): boolean
export interface CellPatch {
  borders?: boolean;
  line?: Border | null;
  shade?: string;
  valign?: 'top' | 'center' | 'bottom';
  direction?: 'level' | 'up' | 'down';
}
export function setCellProps(doc: Doc, paraA: number, paraB: number, patch: CellPatch): Doc
export function setHeaderRow(doc: Doc, para: number, on: boolean): Doc
```

## docx/import

```ts
export interface ImportOptions {
  maxSize?: number;
}
export function importDocx(data: Uint8Array, options: ImportOptions = {}): Doc
```

## docx/export

```ts
export interface DocxOptions {
  fonts?: EmbeddedFont[];
  language?: string;
  replaceLanguage?: boolean;
  subsetFonts?: boolean;
}
export function exportDocx(whole: Doc, options: DocxOptions = {}): Uint8Array<ArrayBuffer>
```

## docx/source

```ts
export interface DocxSource {
  files: Record<string, Uint8Array>;
  mainPath: string;
  xml: string;
  body: XmlNode;
  sheet: StyleSheet;
  page?: PageSetup;
  columns?: Columns;
  sectionStart?: SectionStart;
  endnoteNumbering?: NoteNumbering;
  footnoteNumbering?: NoteNumbering;
  titlePage?: boolean;
  tables?: Table[];
  tableNodes?: XmlNode[];
  numbering?: Numbering;
  slots: SourceSlot[];
  headerPath?: string;
  footerPath?: string;
  firstHeaderPath?: string;
  firstFooterPath?: string;
  firstHeaderSource?: StorySource;
  firstFooterSource?: StorySource;
  headerSource?: StorySource;
  footerSource?: StorySource;
  sectionStories?: Record<number, Partial<Record<BasePart, StorySource>>>;
  footnotesPath?: string;
  footnoteSources?: Map<string, StorySource>;
  endnotesPath?: string;
  endnoteSources?: Map<string, StorySource>;
  notesPath?: string;
  notes?: Note[];
  textBoxSources?: Map<string, StorySource>;
  trackRevisions?: boolean;
  restricted?: boolean;
  relationships?: Map<string, Map<string, string>>;
}
export interface EmbeddedFont {
  family: string;
  bold: boolean;
  italic: boolean;
  bytes: Uint8Array;
}
export interface StorySource {
  path: string;
  xml: string;
  root: XmlNode;
  slots: SourceSlot[];
  story: Story;
}
export interface SourceSlot {
  node: XmlNode;
  paragraph: Paragraph;
  baseRun: RunProps;
}
export interface StyleSheet {
  runDefaults: RunProps;
  paragraphDefaults: ParagraphProps;
  styles: Map<string, Style>;
  defaultParagraphStyle?: string;
  defaultTableStyle?: string;
}
export interface Style {
  name?: string;
  type?: string;
  basedOn?: string;
  pPr: ParagraphProps;
  rPr: RunProps;
  borders?: BorderSet;
  padding?: CellPadding;
  shade?: string;
  parts?: Record<string, TablePart>;
}
export type BorderSet = Partial<Record<'top' | 'bottom' | 'left' | 'right' | 'insideH' | 'insideV', Border | null>>;
export type CellPadding = Partial<Record<'padTop' | 'padRight' | 'padBottom' | 'padLeft', number>>;
export interface TablePart {
  pPr: ParagraphProps;
  rPr: RunProps;
  shade?: string;
  cellBorders?: BorderSet;
  borders?: BorderSet;
  valign?: 'center' | 'bottom';
}
export function documentLanguage(doc: { source?: DocxSource }): string | undefined
```

## stories

```ts
export { BasePart } // re-exported
export { EndnotePart } // re-exported
export { FootnotePart } // re-exported
export { StoryPart } // re-exported
export { TextBoxPart } // re-exported
```

## docx/xml

```ts
export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
  start: number;
  openEnd: number;
  closeStart: number;
  end: number;
}
```

## notes

```ts
export const NOTE_COLORS = ['F4B400', '34A853', '4285F4', 'EA4335', 'A142F4', '80868B'];
export function addNote(doc: Doc, range: Range, note: { text: string; author: string; date?: string; color?: string }): { doc: Doc; id?: string }
export function setNoteText(doc: Doc, id: string, text: string): Doc
export function setNoteColor(doc: Doc, id: string, color: string): Doc
export function removeNote(doc: Doc, id: string): Doc
```

## editable

```ts
export interface EditableRange {
  id: string;
  range: Range;
}
export function addEditableRange(doc: Doc, range: Range): { doc: Doc; id: string }
export function editableAt(doc: Pick<Doc, 'paragraphs'>, pos: Position): EditableRange | undefined
export function editableRanges(doc: Pick<Doc, 'paragraphs'>): EditableRange[]
export function keepsOutside(before: Doc, after: Doc): boolean
export function removeEditableRange(doc: Doc, id: string): Doc
export function setRestricted(doc: Doc, on: boolean): Doc
```

## toc

```ts
export interface TocOptions {
  pageOf: (para: number) => number;
  emptyText?: string;
}
export function updateToc(doc: Doc, options: TocOptions): Doc
export function insertToc(doc: Doc, pos: Position, options: TocOptions & { title?: string }): { doc: Doc; pos: Position }
```

## links

```ts
export function setLink(doc: Doc, range: Range, href: string): Doc
export function removeLink(doc: Doc, range: Range): Doc
export function insertLink(doc: Doc, pos: Position, text: string, href: string): { doc: Doc; range: Range }
```

## letterhead

```ts
export interface Letterhead {
  part: StoryPart;
  para: number;
  offset: number;
  xml: string;
}
export function letterheadOf(doc: Doc): Letterhead | undefined
export function letterheadImage(doc: Doc): Media | undefined
export function resizeLetterhead(doc: Doc, width: number, height: number, section?: number): Doc
export function removeLetterhead(doc: Doc): Doc
export function setLetterhead(doc: Doc, image: Media): Doc
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}
export function letterheadMargins(pixels: Pixels, page: { height: number }): { top?: number; bottom?: number }
export function pngLetterheadMargins(bytes: Uint8Array, page: { height: number }): { top?: number; bottom?: number } | undefined
export function withLetterheadMargins(doc: Doc, asked: { top?: number; bottom?: number }): Doc
```

## sections

```ts
export function setSectionPage(doc: Doc, para: number, patch: Partial<PageSetup>): Doc
export function setOwnFirstPage(doc: Doc, index: number, on: boolean): Doc
export function sectionCount(doc: Doc): number
export function setColumns(doc: Doc, range: Range, columns: Columns): Doc
export function insertColumnBreak(doc: Doc, pos: Position): { doc: Doc; pos: Position }
export function insertSectionBreak(doc: Doc, pos: Position, start: SectionStart = 'nextPage'): { doc: Doc; pos: Position }
export function noteNumberingOf(doc: Doc, kind: 'footnote' | 'endnote', index: number): NoteNumbering | undefined
export function setNoteNumbering(doc: Doc, kind: 'footnote' | 'endnote', index: number, numbering: NoteNumbering | undefined): Doc
export function setEndnotesAt(doc: Doc, at: 'sections' | 'document'): Doc
```

## footnotes

```ts
export const insertEndnote = (doc: Doc, pos: Position, text = ''): { doc: Doc; pos: Position; id: string } => …
export const insertFootnote = (doc: Doc, pos: Position, text = ''): { doc: Doc; pos: Position; id: string } => …
```

## versions

```ts
export type ChangeKind = 'added' | 'removed' | 'changed' | 'formatted';
export interface ChangePiece {
  kind: 'same' | 'added' | 'removed';
  text: string;
}
export interface Change {
  kind: ChangeKind;
  part?: StoryPart;
  before?: number;
  after?: number;
  pieces: ChangePiece[];
}
export interface NoteChange {
  kind: 'added' | 'removed' | 'changed';
  author: string;
  date?: string;
  before?: string;
  after?: string;
  pieces: ChangePiece[];
}
export interface Comparison {
  changes: Change[];
  notes: NoteChange[];
  doc: Doc;
  marks: { part?: StoryPart; pos: Position }[];
}
export const ADDED_COLOR = '1A7F37';
export const REMOVED_COLOR = 'C62828';
export function compareDocs(before: Doc, after: Doc): Comparison
export function restoreVersion(current: Doc, version: Doc): Doc
export function describeChange(change: Pick<Change, 'kind' | 'pieces'>, context = 40): string
```

## revisions

```ts
export type RevisionType = 'insert' | 'delete' | 'format';
export interface Reviser {
  author: string;
  date?: string;
}
export function revisionColor(author: string): string
export interface TrackedEdit {
  doc: Doc;
  map(pos: Position, caret?: 'back' | 'forward'): Position;
}
export function trackEdit(before: Doc, after: Doc, by: Reviser, options: { words?: boolean } = {}): TrackedEdit
export function trackDocEdit(before: Doc, after: Doc, by: Reviser, words = true): Doc
export interface RevisionView {
  type: RevisionType;
  author: string;
  date?: string;
  range: Range;
  text: string;
  part?: StoryPart;
  move?: string;
  format?: string[];
  paragraph?: true;
  row?: true;
}
export interface RevisionChange {
  type: RevisionType;
  author: string;
  date?: string;
  move?: string;
}
export function revisionsOf(doc: Doc): RevisionView[]
export function hasRevisions(doc: Doc): boolean
export type ChangePick = (change: RevisionChange) => boolean;
export function acceptRevisions<T extends Pick<Doc, 'paragraphs'>>(doc: T, range?: Range, pick?: ChangePick): T
export function rejectRevisions<T extends Pick<Doc, 'paragraphs'>>(doc: T, range?: Range, pick?: ChangePick): T
export const byAuthor =
export function decideAllRevisions(doc: Doc, accept: boolean, pick?: ChangePick): Doc
```

## textboxes

```ts
export interface TextBoxLook {
  fill?: string;
  line?: { color: string; width: number };
  inset: { top: number; right: number; bottom: number; left: number };
  align: 'top' | 'middle' | 'bottom';
  grows: boolean;
}
export function insertTextBox(doc: Doc, pos: Position, options: { width?: number; height?: number; text?: string } = {}): { doc: Doc; pos: Position; id: string }
```

## clipboard

```ts
export interface ClipRun {
  text: string;
  props: RunProps;
  href?: string;
  image?: ClipImage;
}
export interface ClipImage {
  src: string;
  width: number;
  height: number;
  alt?: string;
}
export interface ClipParagraph {
  runs: ClipRun[];
  props: ParagraphProps;
  list?: { id: number; kind: ListKind; level: number };
  style?: string;
  cell?: { table: number; row: number; column: number };
}
export interface ClipTable {
  rows: number;
  columns: number;
  merges?: { row: number; column: number; rows: number; columns: number }[];
  widths?: number[];
  header?: number;
  cells?: ClipCell[];
  heights?: { row: number; height: number; exact?: boolean }[];
}
export interface ClipCell {
  row: number;
  column: number;
  shade?: string;
  lines?: CellLines;
  valign?: 'center' | 'bottom';
}
export interface Clip {
  paragraphs: ClipParagraph[];
  tables?: ClipTable[];
}
export function insertClip(doc: Doc, pos: Position, clip: Clip): { doc: Doc; pos: Position }
```
