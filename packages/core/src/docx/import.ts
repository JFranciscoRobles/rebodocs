// DOCX -> Doc. Styles are flattened into resolved formatting on import; the
// original XML is kept alongside so export can write back what was not touched.

import { strFromU8, unzipSync } from 'fflate';
import {
  type Border,
  type FormatChange,
  PARAGRAPH_FORMAT,
  RUN_FORMAT,
  type BorderStyle,
  type CellLines,
  type CellRef,
  type TableCell,
  type TableFloat,
  type Columns,
  type Doc,
  type Footnote,
  type Note,
  type PageSetup,
  type Paragraph,
  type ParagraphProps,
  type ParagraphStyle,
  type Run,
  type RunProps,
  type NoteNumbering,
  type Section,
  type SectionStart,
  type Story,
  type Table,
  type TableRow,
  type TextBox,
  type TabStop,
  ANCHOR_CHAR,
  DEFAULT_BORDER,
  DEFAULT_PAGE,
  OBJECT_CHAR,
  WRAP_SEPARATOR,
  defined,
} from '../model';
import { type ListInstance, type ListLevel, type NumFormat, type Numbering, MAX_LIST_LEVEL, levelOf, listLevelOfStyle } from '../numbering';
import { noteKey } from '../notes';
import { normalizeRuns } from '../ops';
import { STORY_PARTS } from '../stories';
import { standardStyles } from '../styles';
import { textBoxId } from '../textboxes';
import {
  type BasePart,
  type BorderSet,
  type CellPadding,
  type DocxSource,
  type SourceSlot,
  type StorySource,
  type Style,
  type StyleSheet,
  type TablePart,
  inlineObjectSize,
  relationships,
} from './source';
import { type XmlNode, child, childrenOf, escapeXml, parseXml, textOf } from './xml';

// What Word applies when a document declares no defaults of its own.
const WORD_RUN_DEFAULTS: RunProps = { fontFamily: 'Times New Roman', fontSize: 10 };
const WORD_PARAGRAPH_DEFAULTS: ParagraphProps = { spacingBefore: 0, spacingAfter: 0, lineHeight: 1 };

const TWIPS = 20;

export function val(node: XmlNode | undefined): string | undefined {
  return node?.attrs['w:val'];
}

function toggle(parent: XmlNode, name: string): boolean | undefined {
  const node = child(parent, name);
  if (!node) return undefined;
  const v = val(node);
  return !(v === '0' || v === 'false' || v === 'off');
}

function int(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

function twips(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n / TWIPS : undefined;
}

// The colours Word's highlighter has, by the name the file gives them.
export const HIGHLIGHTS: Record<string, string> = {
  yellow: 'FFFF00',
  green: '00FF00',
  cyan: '00FFFF',
  magenta: 'FF00FF',
  blue: '0000FF',
  red: 'FF0000',
  darkBlue: '000080',
  darkCyan: '008080',
  darkGreen: '008000',
  darkMagenta: '800080',
  darkRed: '800000',
  darkYellow: '808000',
  darkGray: '808080',
  lightGray: 'C0C0C0',
  black: '000000',
  white: 'FFFFFF',
  none: '',
};

export function parseRunProps(rPr: XmlNode | undefined): RunProps {
  if (!rPr) return {};
  const underline = val(child(rPr, 'w:u'));
  const size = Number(val(child(rPr, 'w:sz')));
  const color = val(child(rPr, 'w:color'));
  const fonts = child(rPr, 'w:rFonts');
  return defined<RunProps>({
    highlight: HIGHLIGHTS[val(child(rPr, 'w:highlight')) ?? '?'],
    bold: toggle(rPr, 'w:b'),
    italic: toggle(rPr, 'w:i'),
    strike: toggle(rPr, 'w:strike'),
    underline: underline === undefined ? undefined : underline !== 'none',
    fontSize: size > 0 ? size / 2 : undefined,
    kern: child(rPr, 'w:kern') ? Math.max(0, Number(val(child(rPr, 'w:kern'))) || 0) / 2 : undefined,
    color: color === undefined ? undefined : /^[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : '000000',
    fontFamily: fonts?.attrs['w:ascii'] ?? fonts?.attrs['w:hAnsi'],
  });
}

/** The right tab stop with a dotted leader of a paragraph, if it has one. */
function leaderStop(pPr: XmlNode | undefined): XmlNode | undefined {
  return childrenOf(child(pPr, 'w:tabs'), 'w:tab').find((tab) => (tab.attrs['w:val'] === 'right' || tab.attrs['w:val'] === 'end') && tab.attrs['w:leader'] === 'dot');
}

/** Where the right tab stop with a dotted leader of a paragraph is, if it has one; 0 when its tabs are cleared. */
function leaderTab(pPr: XmlNode): number | undefined {
  if (!child(pPr, 'w:tabs')) return undefined;
  const stop = leaderStop(pPr);
  return stop ? twips(stop.attrs['w:pos']) : undefined;
}

/** A tab stop as a file has it: one of the paragraph's own, or one that takes away the stop its style has at that place. */
type ReadTab = TabStop | { pos: number; align: 'clear' };

const TAB_ALIGN: Record<string, ReadTab['align']> = { left: 'left', start: 'left', num: 'left', center: 'center', right: 'right', end: 'right', decimal: 'decimal', bar: 'bar', clear: 'clear' };
const TAB_LEADER: Record<string, TabStop['leader']> = { dot: 'dot', hyphen: 'hyphen', underscore: 'underscore', heavy: 'heavy', middleDot: 'middleDot' };

/** The tab stops a paragraph sets, its dotted right one left out: that is its `leaderTab`. */
function parseTabs(pPr: XmlNode): ReadTab[] | undefined {
  const tabs = child(pPr, 'w:tabs');
  if (!tabs) return undefined;
  const leader = leaderStop(pPr);
  const out: ReadTab[] = [];
  for (const tab of childrenOf(tabs, 'w:tab')) {
    const align = TAB_ALIGN[tab.attrs['w:val'] ?? ''];
    const pos = twips(tab.attrs['w:pos']);
    if (!align || pos === undefined || tab === leader) continue;
    const kind = TAB_LEADER[tab.attrs['w:leader'] ?? ''];
    out.push(align === 'clear' ? { pos, align } : defined<TabStop>({ pos, align, leader: kind }));
  }
  return out;
}

/**
 * The tab stops of a style or a paragraph over those of what it is based on:
 * its own, and the others where it does not take them away. In order.
 */
export function mergeTabs(base: TabStop[] | undefined, over: TabStop[] | undefined): TabStop[] | undefined {
  if (!base && !over) return undefined;
  const own = (over ?? []) as ReadTab[];
  const kept = ((base ?? []) as ReadTab[]).filter((tab) => tab.align !== 'clear' && !own.some((o) => Math.abs(o.pos - tab.pos) < 0.5));
  return [...kept, ...own.filter((tab) => tab.align !== 'clear')].sort((a, b) => a.pos - b.pos) as TabStop[];
}

export function parseParagraphProps(pPr: XmlNode | undefined): ParagraphProps {
  if (!pPr) return {};
  const jc = val(child(pPr, 'w:jc'));
  const spacing = child(pPr, 'w:spacing');
  const ind = child(pPr, 'w:ind');
  const rule = spacing?.attrs['w:lineRule'];
  const line = Number(spacing?.attrs['w:line']);
  const hanging = twips(ind?.attrs['w:hanging']);
  const numPr = child(pPr, 'w:numPr');
  const numId = int(val(child(numPr, 'w:numId')));
  const level = int(val(child(numPr, 'w:ilvl')));
  const align: Record<string, ParagraphProps['align']> = {
    left: 'left',
    start: 'left',
    center: 'center',
    right: 'right',
    end: 'right',
    both: 'justify',
    distribute: 'justify',
  };
  return defined<ParagraphProps>({
    align: jc ? align[jc] : undefined,
    spacingBefore: twips(spacing?.attrs['w:before']),
    spacingAfter: twips(spacing?.attrs['w:after']),
    // Only proportional spacing is modelled; exact/atLeast values are ignored.
    lineHeight: line > 0 && (!rule || rule === 'auto') ? line / 240 : undefined,
    indentLeft: twips(ind?.attrs['w:left'] ?? ind?.attrs['w:start']),
    indentRight: twips(ind?.attrs['w:right'] ?? ind?.attrs['w:end']),
    indentFirstLine: hanging !== undefined ? -hanging : twips(ind?.attrs['w:firstLine']),
    pageBreakBefore: toggle(pPr, 'w:pageBreakBefore'),
    keepNext: toggle(pPr, 'w:keepNext'),
    keepLines: toggle(pPr, 'w:keepLines'),
    widowControl: toggle(pPr, 'w:widowControl'),
    leaderTab: leaderTab(pPr),
    // Read with the ones that take away a stop of the style: `mergeTabs` puts them over it.
    tabs: parseTabs(pPr) as TabStop[] | undefined,
    numId,
    listLevel: level === undefined ? undefined : Math.min(level, MAX_LIST_LEVEL),
  });
}

const NUM_FORMATS = new Set<string>(['decimal', 'decimalZero', 'lowerLetter', 'upperLetter', 'lowerRoman', 'upperRoman', 'bullet', 'none']);
const LABEL_ALIGN: Record<string, ListLevel['align']> = { center: 'center', right: 'right', end: 'right' };
const LABEL_SUFFIX: Record<string, ListLevel['suffix']> = { space: 'space', nothing: 'nothing' };

function parseLevel(lvl: XmlNode): ListLevel {
  const format = val(child(lvl, 'w:numFmt')) ?? 'decimal';
  const restart = int(val(child(lvl, 'w:lvlRestart')));
  const indents = parseParagraphProps(child(lvl, 'w:pPr'));
  return defined<ListLevel>({
    start: int(val(child(lvl, 'w:start'))) ?? 1,
    // Formats that are not modelled count in decimal.
    format: NUM_FORMATS.has(format) ? (format as NumFormat) : 'decimal',
    text: val(child(lvl, 'w:lvlText')) ?? '',
    align: LABEL_ALIGN[val(child(lvl, 'w:lvlJc')) ?? ''] ?? 'left',
    suffix: LABEL_SUFFIX[val(child(lvl, 'w:suff')) ?? ''] ?? 'tab',
    indentLeft: indents.indentLeft,
    indentFirstLine: indents.indentFirstLine,
    run: parseRunProps(child(lvl, 'w:rPr')),
    // w:lvlRestart 0 means the level never restarts.
    restart: restart !== 0,
    restartAfter: restart ? restart : undefined,
    legal: toggle(lvl, 'w:isLgl') ?? false,
    style: val(child(lvl, 'w:pStyle')),
  });
}

function parseNumbering(xml: string | undefined): Numbering | undefined {
  if (!xml) return undefined;
  const root = child(parseXml(xml), 'w:numbering');
  const numbering: Numbering = { abstracts: new Map(), lists: new Map() };
  for (const node of childrenOf(root, 'w:abstractNum')) {
    const id = int(node.attrs['w:abstractNumId']);
    if (id === undefined) continue;
    const levels: (ListLevel | undefined)[] = [];
    for (const lvl of childrenOf(node, 'w:lvl')) {
      const index = int(lvl.attrs['w:ilvl']);
      if (index !== undefined && index <= MAX_LIST_LEVEL) levels[index] = parseLevel(lvl);
    }
    numbering.abstracts.set(id, levels);
  }
  for (const node of childrenOf(root, 'w:num')) {
    const id = int(node.attrs['w:numId']);
    const abstractId = int(val(child(node, 'w:abstractNumId')));
    if (id === undefined || abstractId === undefined) continue;
    const list: ListInstance = { abstractId, starts: new Map(), levels: new Map() };
    for (const override of childrenOf(node, 'w:lvlOverride')) {
      const index = int(override.attrs['w:ilvl']);
      if (index === undefined || index > MAX_LIST_LEVEL) continue;
      const start = int(val(child(override, 'w:startOverride')));
      if (start !== undefined) list.starts.set(index, start);
      const lvl = child(override, 'w:lvl');
      if (lvl) list.levels.set(index, parseLevel(lvl));
    }
    numbering.lists.set(id, list);
  }
  return numbering.lists.size || numbering.abstracts.size ? numbering : undefined;
}

/** The colour a shading fills with, when it is a plain one. */
function shadeOf(shd: XmlNode | undefined): string | undefined {
  const fill = shd?.attrs['w:fill'];
  return fill && /^[0-9a-fA-F]{6}$/.test(fill) && fill.toUpperCase() !== 'FFFFFF' ? fill.toUpperCase() : undefined;
}

/** The kinds of line Word has, by the four the layout draws. */
const BORDER_STYLES: Record<string, BorderStyle> = {
  double: 'double',
  triple: 'double',
  thinThickSmallGap: 'double',
  thickThinSmallGap: 'double',
  thinThickMediumGap: 'double',
  thickThinMediumGap: 'double',
  thinThickLargeGap: 'double',
  thickThinLargeGap: 'double',
  doubleWave: 'double',
  dashed: 'dashed',
  dashSmallGap: 'dashed',
  dashDotStroked: 'dashed',
  dotDash: 'dashed',
  dotDotDash: 'dashed',
  dotted: 'dotted',
};

/** One border of a set: the line, null when it is switched off, undefined when the set does not name it. */
function parseBorder(node: XmlNode | undefined): Border | null | undefined {
  if (!node) return undefined;
  const kind = val(node);
  if (!kind || kind === 'none' || kind === 'nil') return null;
  const color = node.attrs['w:color'];
  return {
    // Sizes are in eighths of a point; Word draws an unsized border half a point thick.
    width: (int(node.attrs['w:sz']) ?? 4) / 8,
    color: color && /^[0-9a-fA-F]{6}$/.test(color) ? color.toUpperCase() : '000000',
    style: BORDER_STYLES[kind] ?? 'single',
  };
}

function parseBorders(borders: XmlNode | undefined): BorderSet | undefined {
  if (!borders) return undefined;
  const side = (...names: string[]) => {
    for (const name of names) {
      const border = parseBorder(child(borders, name));
      if (border !== undefined) return border;
    }
    return undefined;
  };
  const set: BorderSet = {
    top: side('w:top'),
    bottom: side('w:bottom'),
    left: side('w:left', 'w:start'),
    right: side('w:right', 'w:end'),
    insideH: side('w:insideH'),
    insideV: side('w:insideV'),
  };
  for (const key of Object.keys(set) as (keyof BorderSet)[]) if (set[key] === undefined) delete set[key];
  return set;
}

/** `over` on top of `under`, side by side. */
function mergeBorders(under: BorderSet | undefined, over: BorderSet | undefined): BorderSet | undefined {
  return under && over ? { ...under, ...over } : (over ?? under);
}

const VALIGN: Record<string, 'center' | 'bottom'> = { center: 'center', bottom: 'bottom' };
/** The vertical directions of the text of a cell, by their names in a file of either kind of the format. */
const DIRECTION: Record<string, 'up' | 'down'> = { btLr: 'up', lr: 'up', lrV: 'up', tbRl: 'down', tbRlV: 'down', rl: 'down', rlV: 'down' };

/** How a part of a table looks, from the `w:tblStylePr` of a table style. */
function parseTablePart(node: XmlNode): TablePart {
  const tcPr = child(node, 'w:tcPr');
  return defined<TablePart>({
    pPr: parseParagraphProps(child(node, 'w:pPr')),
    rPr: parseRunProps(child(node, 'w:rPr')),
    shade: shadeOf(child(tcPr, 'w:shd')),
    cellBorders: parseBorders(child(tcPr, 'w:tcBorders')),
    borders: parseBorders(child(child(node, 'w:tblPr'), 'w:tblBorders')),
    valign: VALIGN[val(child(tcPr, 'w:vAlign')) ?? ''],
  });
}

function parsePadding(margins: XmlNode | undefined): CellPadding | undefined {
  if (!margins) return undefined;
  const side = (...names: string[]) => {
    for (const name of names) {
      const w = twips(child(margins, name)?.attrs['w:w']);
      if (w !== undefined) return w;
    }
    return undefined;
  };
  return defined<CellPadding>({
    padTop: side('w:top'),
    padRight: side('w:right', 'w:end'),
    padBottom: side('w:bottom'),
    padLeft: side('w:left', 'w:start'),
  });
}

function parseStyles(xml: string | undefined): StyleSheet {
  const sheet: StyleSheet = {
    runDefaults: { ...WORD_RUN_DEFAULTS },
    paragraphDefaults: { ...WORD_PARAGRAPH_DEFAULTS },
    styles: new Map(),
  };
  if (!xml) return sheet;
  const root = child(parseXml(xml), 'w:styles');
  const defaults = child(root, 'w:docDefaults');
  const runDefault = child(child(defaults, 'w:rPrDefault'), 'w:rPr');
  // Defaults of its own for text kern only when they say so; Word's, from 1 point, are for a file that gives none. Measured against Word.
  if (runDefault) sheet.runDefaults.kern = 0;
  Object.assign(sheet.runDefaults, parseRunProps(runDefault));
  Object.assign(sheet.paragraphDefaults, parseParagraphProps(child(child(defaults, 'w:pPrDefault'), 'w:pPr')));
  for (const node of childrenOf(root, 'w:style')) {
    const id = node.attrs['w:styleId'];
    if (!id) continue;
    const tblPr = child(node, 'w:tblPr');
    const parts: Record<string, TablePart> = {};
    for (const part of childrenOf(node, 'w:tblStylePr')) if (part.attrs['w:type']) parts[part.attrs['w:type']] = parseTablePart(part);
    sheet.styles.set(
      id,
      defined<Style>({
        name: val(child(node, 'w:name')),
        type: node.attrs['w:type'],
        basedOn: val(child(node, 'w:basedOn')),
        pPr: parseParagraphProps(child(node, 'w:pPr')),
        rPr: parseRunProps(child(node, 'w:rPr')),
        borders: parseBorders(child(tblPr, 'w:tblBorders')),
        padding: parsePadding(child(tblPr, 'w:tblCellMar')),
        shade: shadeOf(child(child(node, 'w:tcPr'), 'w:shd')) ?? shadeOf(child(tblPr, 'w:shd')),
        parts: Object.keys(parts).length ? parts : undefined,
      }),
    );
    const isDefault = node.attrs['w:default'] === '1' || node.attrs['w:default'] === 'true';
    if (isDefault && node.attrs['w:type'] === 'paragraph') sheet.defaultParagraphStyle = id;
    if (isDefault && node.attrs['w:type'] === 'table') sheet.defaultTableStyle = id;
  }
  return sheet;
}

/**
 * The paragraph styles to offer for a document: its default one, the standard
 * titles and headings (its own where it has them), and whichever others its
 * paragraphs use. Undefined when the file has no default style to build on.
 */
function styleCatalog(sheet: StyleSheet, used: Set<string>): ParagraphStyle[] | undefined {
  const normalId = sheet.defaultParagraphStyle;
  if (!normalId) return undefined;
  const entry = (id: string): ParagraphStyle => {
    const { pPr, rPr } = resolveStyle(sheet, id);
    // A list a style brings is not modelled as part of the style.
    const { numId: _, listLevel: __, ...paragraph } = defined({ ...sheet.paragraphDefaults, ...pPr, tabs: mergeTabs(sheet.paragraphDefaults.tabs, pPr.tabs) });
    const run = { ...sheet.runDefaults, ...rPr };
    return {
      id,
      name: sheet.styles.get(id)?.name ?? id,
      paragraph,
      run: defined<RunProps>({ fontFamily: run.fontFamily, fontSize: run.fontSize, bold: !!run.bold, italic: !!run.italic, color: run.color ?? '000000' }),
    };
  };
  const byName = new Map<string, string>();
  for (const [id, style] of sheet.styles) {
    if (style.type === 'paragraph' && style.name) byName.set(style.name.toLowerCase(), id);
  }
  const own = (wordName: string) => {
    const id = byName.get(wordName.toLowerCase());
    return id === undefined || id === normalId ? undefined : entry(id);
  };
  const styles = standardStyles(entry(normalId), own, (id) => sheet.styles.has(id));
  const listed = new Set(styles.map((style) => style.id));
  const others = [...used]
    .filter((id) => !listed.has(id) && sheet.styles.get(id)?.type === 'paragraph')
    .map(entry)
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...styles, ...others];
}

/** Merges a style with everything it is based on, base first. */
export function resolveStyle(sheet: StyleSheet, id: string | undefined): Required<Pick<Style, 'pPr' | 'rPr' | 'padding'>> & Pick<Style, 'borders' | 'shade' | 'parts'> {
  const chain: Style[] = [];
  const seen = new Set<string>();
  while (id && !seen.has(id)) {
    seen.add(id);
    const style = sheet.styles.get(id);
    if (!style) break;
    chain.unshift(style);
    id = style.basedOn;
  }
  const out: ReturnType<typeof resolveStyle> = { pPr: {}, rPr: {}, padding: {} };
  for (const style of chain) {
    const tabs = mergeTabs(out.pPr.tabs, style.pPr.tabs);
    Object.assign(out.pPr, style.pPr);
    if (tabs) out.pPr.tabs = tabs;
    Object.assign(out.rPr, style.rPr);
    Object.assign(out.padding, style.padding);
    out.borders = mergeBorders(out.borders, style.borders);
    out.shade = style.shade ?? out.shade;
    // A part a style sets out goes over the same part of the style it is based on.
    for (const [name, part] of Object.entries(style.parts ?? {})) {
      const was = out.parts?.[name];
      out.parts = {
        ...out.parts,
        [name]: was
          ? defined<TablePart>({
              pPr: defined({ ...was.pPr, ...part.pPr, tabs: mergeTabs(was.pPr?.tabs, part.pPr?.tabs) }),
              rPr: { ...was.rPr, ...part.rPr },
              shade: part.shade ?? was.shade,
              cellBorders: mergeBorders(was.cellBorders, part.cellBorders),
              borders: mergeBorders(was.borders, part.borders),
              valign: part.valign ?? was.valign,
            })
          : part,
      };
    }
  }
  return out;
}

/** Reading state shared by everything inside one paragraph. */
interface InlineContext {
  xml: string;
  moves: Moves;
  sheet: StyleSheet;
  /** Formatting the paragraph style gives to its runs. */
  base: RunProps;
  /** Formatting of the last text run, inherited by the anchors that follow it. */
  last: RunProps;
  out: Run[];
  /** The field being read: its code, and whether the runs now coming are its result. */
  field?: { code: string; result: boolean; filled?: boolean };
  /** Where the links of the part go outside the document, by relationship id. */
  links?: Map<string, string>;
  /** The tracked change the runs now coming are part of: inside a `w:ins` or a `w:del`, or a `w:del` inside a `w:ins`. */
  revision?: Pick<RunProps, 'revision' | 'revisionAuthor' | 'revisionDate' | 'insertedBy' | 'insertedDate' | 'revisionMove'>;
  /** Told of each drawing with a text box in it: its `w:txbxContent`, and the XML of the run. */
  box?: (content: XmlNode, objectXml: string) => void;
}

/** The keys given of an object, those set. */
const pick = <T extends object>(props: T, keys: readonly string[]): T => {
  const out: Record<string, unknown> = {};
  for (const key of keys) if ((props as Record<string, unknown>)[key] !== undefined) out[key] = (props as Record<string, unknown>)[key];
  return out as T;
};

/** A change of formatting as Word keeps one, `w:rPrChange` or `w:pPrChange`: who, when, and the formatting before, read from the element inside. */
function formatChangeOf<T>(change: XmlNode | undefined, before: (old: XmlNode | undefined) => T, inner: string): FormatChange<T> | undefined {
  if (!change) return undefined;
  return defined<FormatChange<T>>({ author: change.attrs['w:author'] ?? '', date: change.attrs['w:date'], before: before(child(change, inner)) });
}

/** A tracked change as an element says it: put in or taken out, by whom, when. */
function revisionOf(node: XmlNode, type: 'insert' | 'delete'): Pick<RunProps, 'revision' | 'revisionAuthor' | 'revisionDate'> {
  return defined({ revision: type, revisionAuthor: node.attrs['w:author'] ?? '', revisionDate: node.attrs['w:date'] });
}

/** Tracked changes, and what they are: a move is a change too, taken out where it was and put in where it went. */
const REVISIONS: Record<string, 'insert' | 'delete'> = { 'w:ins': 'insert', 'w:moveTo': 'insert', 'w:del': 'delete', 'w:moveFrom': 'delete' };

/**
 * The moves being read in one file: the name of each, from where its range
 * starts to where it ends, which may be paragraphs later. A move without its
 * range is named by who made it and when, which its two halves share.
 */
interface Moves {
  ranges: Map<string, string>;
  unnamed: Map<string, string>;
}
const newMoves = (): Moves => ({ ranges: new Map(), unnamed: new Map() });
function moveName(moves: Moves, kind: 'From' | 'To', change: XmlNode): string {
  for (const [key, name] of moves.ranges) if (key.startsWith(kind)) return name;
  const key = `${change.attrs['w:author'] ?? ''}\u0000${change.attrs['w:date'] ?? ''}`;
  if (!moves.unnamed.has(key)) moves.unnamed.set(key, `dxmove${moves.unnamed.size + 1}`);
  return moves.unnamed.get(key)!;
}

/** The fields whose result changes from page to page. */
function pageField(field: InlineContext['field']): string | undefined {
  const name = field?.result ? field.code.trim().split(/\s+/)[0].toUpperCase() : '';
  return name === 'PAGE' || name === 'NUMPAGES' ? name : undefined;
}

function objectRun(props: RunProps, xml: string): Run {
  const size = inlineObjectSize(xml);
  return {
    text: size ? OBJECT_CHAR : ANCHOR_CHAR,
    props: { ...props, object: xml, anchor: !size, objectWidth: size?.width ?? 0, objectHeight: size?.height ?? 0 },
  };
}

function collectRun(r: XmlNode, wrap: string, ctx: InlineContext): void {
  if (r.openEnd === r.end) return;
  const { xml, sheet } = ctx;
  const rPr = child(r, 'w:rPr');
  const charStyle = resolveStyle(sheet, val(child(rPr, 'w:rStyle'))).rPr;
  const props = defined<RunProps>({
    ...ctx.base,
    ...charStyle,
    ...parseRunProps(rPr),
    opaque: rPr ? xml.slice(rPr.openEnd, rPr.closeStart) : undefined,
    wrap: wrap || undefined,
    ...ctx.revision,
    formatChange: formatChangeOf(child(rPr, 'w:rPrChange'), (old) => pick({ ...ctx.base, ...resolveStyle(sheet, val(child(old, 'w:rStyle'))).rPr, ...parseRunProps(old) }, RUN_FORMAT), 'w:rPr'),
  });
  ctx.last = props;

  let text = '';
  const flush = () => {
    const field = pageField(ctx.field);
    if (text) ctx.out.push({ text, props: field ? { ...props, field } : props });
    if (text && field) ctx.field!.filled = true;
    text = '';
  };
  for (const c of r.children) {
    switch (c.name) {
      case '#text':
      case 'w:rPr':
      // A rendering hint Word recomputes; not worth carrying.
      case 'w:lastRenderedPageBreak':
        break;
      case 'w:t':
      // What a tracked change took out is still text, struck through.
      case 'w:delText':
        text += textOf(c);
        break;
      case 'w:tab':
        text += '\t';
        break;
      case 'w:cr':
        text += '\n';
        break;
      case 'w:noBreakHyphen':
        text += '‑';
        break;
      default: {
        const type = c.attrs['w:type'];
        if (c.name === 'w:br' && (!type || type === 'textWrapping' || type === 'page')) {
          text += type === 'page' ? '\f' : '\n';
          break;
        }
        // Anything else (drawings, field marks, note references...) is kept as a
        // run of its own holding just that element.
        flush();
        if (c.name === 'w:fldChar') {
          const stage = c.attrs['w:fldCharType'];
          if (stage === 'begin') ctx.field = { code: '', result: false };
          else if (stage === 'separate' && ctx.field) ctx.field.result = true;
          else if (stage === 'end') {
            // A page number written with nothing in it, as some programs leave it: it is given a number to show.
            const empty = ctx.field && !ctx.field.filled ? pageField(ctx.field) : undefined;
            if (empty) ctx.out.push({ text: '1', props: { ...props, field: empty } });
            ctx.field = undefined;
          }
        } else if ((c.name === 'w:instrText' || c.name === 'w:delInstrText') && ctx.field) {
          ctx.field.code += textOf(c);
        }
        const rPrXml = rPr ? xml.slice(rPr.start, rPr.end) : '';
        const objectXml = `${xml.slice(r.start, r.openEnd)}${rPrXml}${xml.slice(c.start, c.end)}</w:r>`;
        ctx.out.push(objectRun(props, objectXml));
        // A shape with text of its own: its text is read as a story of the document.
        const content = ctx.box && (c.name === 'w:drawing' || c.name === 'mc:AlternateContent') ? descendant(c, 'w:txbxContent') : undefined;
        if (content) ctx.box!(content, objectXml);
      }
    }
  }
  flush();
}

function joinWrap(outer: string, prefix: string, suffix: string): string {
  if (!outer) return prefix + WRAP_SEPARATOR + suffix;
  const [outerPrefix, outerSuffix] = outer.split(WRAP_SEPARATOR);
  return outerPrefix + prefix + WRAP_SEPARATOR + suffix + outerSuffix;
}

// Elements that only wrap runs; their runs are part of the visible text.
const INLINE_WRAPPERS = new Set(['w:hyperlink', 'w:smartTag', 'w:fldSimple', 'w:customXml', 'w:dir', 'w:bdo']);

function collectInline(node: XmlNode, wrap: string, ctx: InlineContext): void {
  const { xml } = ctx;
  for (const c of node.children) {
    if (c.name === '#text' || c.name === 'w:pPr' || c.name === 'w:proofErr') continue;
    if (c.name === 'w:r') {
      collectRun(c, wrap, ctx);
      continue;
    }
    // A tracked change: its runs are part of the text, marked as put in or taken out.
    const revision = REVISIONS[c.name];
    if (revision) {
      const outer = ctx.revision;
      let own: InlineContext['revision'] = revisionOf(c, revision);
      if (c.name === 'w:moveFrom' || c.name === 'w:moveTo') own = { ...own, revisionMove: moveName(ctx.moves, c.name === 'w:moveFrom' ? 'From' : 'To', c) };
      // Taken out of what someone put in: two changes, each to decide on its own.
      if (revision === 'delete' && outer?.revision === 'insert') own = defined({ ...own, insertedBy: outer.revisionAuthor ?? '', insertedDate: outer.revisionDate });
      ctx.revision = own;
      collectInline(c, wrap, ctx);
      ctx.revision = outer;
      continue;
    }
    // For w:sdt the runs live one level down, in w:sdtContent.
    const content = c.name === 'w:sdt' ? child(c, 'w:sdtContent') : INLINE_WRAPPERS.has(c.name) ? c : undefined;
    if (content && content.openEnd !== content.end) {
      let prefix = xml.slice(c.start, content.openEnd);
      // A link out of the document carries its address with it, not the relationship that names it.
      const href = c.name === 'w:hyperlink' ? ctx.links?.get(c.attrs['r:id'] ?? '') : undefined;
      if (href !== undefined) prefix = prefix.replace(/\br:id="[^"]*"/, () => `r:id="dx:${escapeXml(href)}"`);
      const suffix = xml.slice(content.closeStart, c.end);
      const outer = ctx.field;
      if (c.name === 'w:fldSimple') ctx.field = { code: c.attrs['w:instr'] ?? '', result: true };
      collectInline(content, joinWrap(wrap, prefix, suffix), ctx);
      ctx.field = outer;
      continue;
    }
    // Where a move started and ended: what names the changes of the move inside, written again around them.
    const range = /^w:move(From|To)Range(Start|End)$/.exec(c.name);
    if (range) {
      const key = `${range[1]}\u0000${c.attrs['w:id'] ?? ''}`;
      if (range[2] === 'Start') ctx.moves.ranges.set(key, c.attrs['w:name'] ?? `dxmove-${c.attrs['w:id'] ?? ''}`);
      else ctx.moves.ranges.delete(key);
      continue;
    }
    // Bookmarks, comment ranges, math... carried as anchors, part of the change they are inside, if any.
    const props = defined<RunProps>({
      ...ctx.last,
      wrap: wrap || undefined,
      revision: undefined,
      revisionAuthor: undefined,
      revisionDate: undefined,
      insertedBy: undefined,
      insertedDate: undefined,
      revisionMove: undefined,
      ...ctx.revision,
    });
    ctx.out.push(objectRun(props, xml.slice(c.start, c.end)));
  }
}

/**
 * Paragraph formatting from, in rising priority: document defaults, style and
 * direct formatting. A list level's indents sit between the style and the
 * direct formatting, except when it is the style that puts the paragraph in
 * the list: then the style's own indents win over the level's, as in Word.
 */
function resolveParagraphProps(sheet: StyleSheet, numbering: Numbering | undefined, styleId: string | undefined, styled: ParagraphProps, direct: ParagraphProps): ParagraphProps {
  const tabs = mergeTabs(mergeTabs(sheet.paragraphDefaults.tabs, styled.tabs), direct.tabs);
  const props = defined({ ...sheet.paragraphDefaults, ...styled, ...direct, tabs });
  if (!numbering || !props.numId) return props;
  const level = props.listLevel ?? (styleId ? listLevelOfStyle(numbering, props.numId, styleId) : undefined) ?? 0;
  const def = levelOf(numbering, props.numId, level);
  const indents = defined<ParagraphProps>({ indentLeft: def?.indentLeft, indentFirstLine: def?.indentFirstLine });
  const fromStyle = direct.numId === undefined;
  return {
    ...sheet.paragraphDefaults,
    ...(fromStyle ? indents : {}),
    ...styled,
    ...(fromStyle ? {} : indents),
    ...direct,
    ...(tabs ? { tabs } : {}),
    listLevel: level,
  };
}

/** Reading state shared by the blocks of a document. */
interface BlockContext {
  xml: string;
  moves: Moves;
  sheet: StyleSheet;
  numbering: Numbering | undefined;
  slots: SourceSlot[];
  tables: Table[];
  /** The element each table was read from, by table index. */
  tableNodes: XmlNode[];
  out: Paragraph[];
  /** Set while reading the inside of a table cell. */
  cell?: CellRef;
  /** Formatting the table's style gives to the paragraphs of its cells. */
  tableStyle?: { pPr: ParagraphProps; rPr: RunProps };
  /** Where the links of the part go outside the document, by relationship id. */
  links?: Map<string, string>;
  /** The path of the part being read. */
  path?: string;
  /** Reads the text of a text box whose drawing is in this part, the first time it comes. */
  boxes?: (content: XmlNode, objectXml: string, ctx: BlockContext) => void;
}

/** The first element called `name` down from `node`, itself included. */
function descendant(node: XmlNode, name: string): XmlNode | undefined {
  if (node.name === name) return node;
  for (const c of node.children) {
    const found = descendant(c, name);
    if (found) return found;
  }
  return undefined;
}

/** The addresses the links of a part go to, by the id of the relationship that names each. */
function externalLinks(files: Record<string, Uint8Array>, partPath: string): Map<string, string> | undefined {
  const slash = partPath.lastIndexOf('/') + 1;
  const part = files[`${partPath.slice(0, slash)}_rels/${partPath.slice(slash)}.rels`];
  if (!part) return undefined;
  const links = new Map<string, string>();
  for (const rel of childrenOf(child(parseXml(strFromU8(part)), 'Relationships'), 'Relationship')) {
    if (rel.attrs.Id && rel.attrs.Target && rel.attrs.TargetMode === 'External' && rel.attrs.Type?.endsWith('/hyperlink')) links.set(rel.attrs.Id, rel.attrs.Target);
  }
  return links.size ? links : undefined;
}

function parseParagraph(p: XmlNode, ctx: BlockContext): Paragraph {
  const { xml, sheet, slots } = ctx;
  const pPr = child(p, 'w:pPr');
  const styleId = val(child(pPr, 'w:pStyle')) ?? sheet.defaultParagraphStyle;
  const style = resolveStyle(sheet, styleId);
  // A table style sits between the document defaults and the paragraph style.
  const styled = defined({ ...ctx.tableStyle?.pPr, ...style.pPr, tabs: mergeTabs(ctx.tableStyle?.pPr.tabs, style.pPr.tabs) });
  const props = resolveParagraphProps(sheet, ctx.numbering, styleId, styled, parseParagraphProps(pPr));
  const base = { ...sheet.runDefaults, ...ctx.tableStyle?.rPr, ...style.rPr };
  const inline: InlineContext = { xml, moves: ctx.moves, sheet, base, last: base, out: [], links: ctx.links, box: ctx.boxes && ((content, objectXml) => ctx.boxes!(content, objectXml, ctx)) };
  collectInline(p, '', inline);
  // An empty paragraph takes the formatting of its paragraph mark.
  const mark = child(pPr, 'w:rPr');
  const markProps = defined<RunProps>({
    ...base,
    ...parseRunProps(mark),
    opaque: mark ? xml.slice(mark.openEnd, mark.closeStart) : undefined,
  });
  // One with marks and no text, the anchor of a picture say, is as tall as its paragraph mark makes it, like an empty one.
  const onlyMarks = inline.out.length > 0 && inline.out.every((run) => run.props.anchor);
  const runs = onlyMarks ? inline.out.map((run) => ({ ...run, props: defined<RunProps>({ ...run.props, fontSize: markProps.fontSize, fontFamily: markProps.fontFamily }) })) : inline.out;
  // A section break inside a table cell is not one Word honours.
  const sect = ctx.cell ? undefined : child(pPr, 'w:sectPr');
  // The mark that ends the paragraph, put in or taken out while changes were tracked.
  const markChange = mark?.children.find((c) => c.name === 'w:ins' || c.name === 'w:del' || c.name === 'w:moveTo' || c.name === 'w:moveFrom');
  const markRevision = markChange && revisionOf(markChange, REVISIONS[markChange.name]);
  const marked = markRevision ? defined({ ...props, markRevision: markRevision.revision, markAuthor: markRevision.revisionAuthor, markDate: markRevision.revisionDate }) : props;
  // Its formatting changed while changes were tracked: what it was, read as the paragraph is.
  const formatChange = formatChangeOf(
    child(pPr, 'w:pPrChange'),
    (old) => {
      const oldStyle = val(child(old, 'w:pStyle')) ?? sheet.defaultParagraphStyle;
      const was = resolveStyle(sheet, oldStyle);
      const styledWas = defined({ ...ctx.tableStyle?.pPr, ...was.pPr, tabs: mergeTabs(ctx.tableStyle?.pPr.tabs, was.pPr.tabs) });
      return pick({ ...resolveParagraphProps(sheet, ctx.numbering, oldStyle, styledWas, parseParagraphProps(old)), styleId: oldStyle }, PARAGRAPH_FORMAT);
    },
    'w:pPr',
  );
  const own = formatChange ? { ...marked, formatChange } : marked;
  const paragraph = defined<Paragraph>({
    props: styleId ? { ...own, styleId } : own,
    runs: normalizeRuns(runs, markProps),
    cell: ctx.cell,
    origin: slots.length,
    section: sect && parseSection(sect, xml),
    // The label of a list item is set in the formatting of the mark. Measured against Word: a label of Arial, the font of
    // the style, made the first line of a paragraph of Georgia taller.
    mark: props.numId ? defined<RunProps>({ fontFamily: markProps.fontFamily, fontSize: markProps.fontSize, bold: markProps.bold, italic: markProps.italic, color: markProps.color }) : undefined,
  });
  slots.push({ node: p, paragraph, baseRun: base });
  return paragraph;
}

const DEFAULT_CELL_PADDING = { padTop: 0, padRight: 5.4, padBottom: 0, padLeft: 5.4 };
const TABLE_ALIGN: Record<string, Table['align']> = { center: 'center', right: 'right', end: 'right', left: 'left', start: 'left' };

/** Which parts of its style a table shows: its heading row, its banded rows... As `w:tblLook` says, in words or in bits. */
interface TableLook {
  firstRow: boolean;
  lastRow: boolean;
  firstColumn: boolean;
  lastColumn: boolean;
  bandRows: boolean;
  bandColumns: boolean;
}

function parseLook(tblPr: XmlNode | undefined): TableLook {
  const look = child(tblPr, 'w:tblLook');
  const bits = parseInt(look?.attrs['w:val'] ?? '', 16);
  // Without one, what Word gives a new table: a heading row, a first column and banded rows.
  const flag = (name: string, bit: number, otherwise: boolean) => {
    const value = look?.attrs[`w:${name}`];
    if (value !== undefined) return value === '1' || value === 'true' || value === 'on';
    return Number.isNaN(bits) ? otherwise : (bits & bit) !== 0;
  };
  return {
    firstRow: flag('firstRow', 0x20, true),
    lastRow: flag('lastRow', 0x40, false),
    firstColumn: flag('firstColumn', 0x80, true),
    lastColumn: flag('lastColumn', 0x100, false),
    bandRows: !flag('noHBand', 0x200, false),
    bandColumns: !flag('noVBand', 0x400, true),
  };
}

/** Where a cell is in its table, as the parts of a table style see it. */
interface CellPlace {
  row: number;
  rows: number;
  /** Its place among the cells of its row. */
  cell: number;
  cells: number;
}

/**
 * The parts of a table style a cell is in, in the order they go one over
 * another: the whole table, the bands, the first and last column, the first
 * and last row, and the corners.
 */
function partsOf(look: TableLook, at: CellPlace, rowBand: number, columnBand: number): { name: string; across: boolean }[] {
  const firstRow = look.firstRow && at.row === 0;
  const lastRow = look.lastRow && at.row === at.rows - 1 && at.rows > 1;
  const firstColumn = look.firstColumn && at.cell === 0;
  const lastColumn = look.lastColumn && at.cell === at.cells - 1 && at.cells > 1;
  // A part is either a row of cells (`across`) or a column of them.
  const parts: { name: string; across: boolean }[] = [{ name: 'wholeTable', across: true }];
  if (look.bandColumns && !firstColumn && !lastColumn) {
    const k = at.cell - (look.firstColumn ? 1 : 0);
    parts.push({ name: Math.floor(k / columnBand) % 2 ? 'band2Vert' : 'band1Vert', across: false });
  }
  if (look.bandRows && !firstRow && !lastRow) {
    const k = at.row - (look.firstRow ? 1 : 0);
    parts.push({ name: Math.floor(k / rowBand) % 2 ? 'band2Horz' : 'band1Horz', across: true });
  }
  if (firstColumn) parts.push({ name: 'firstCol', across: false });
  if (lastColumn) parts.push({ name: 'lastCol', across: false });
  if (firstRow) parts.push({ name: 'firstRow', across: true });
  if (lastRow) parts.push({ name: 'lastRow', across: true });
  if (firstRow && firstColumn) parts.push({ name: 'nwCell', across: true });
  if (firstRow && lastColumn) parts.push({ name: 'neCell', across: true });
  if (lastRow && firstColumn) parts.push({ name: 'swCell', across: true });
  if (lastRow && lastColumn) parts.push({ name: 'seCell', across: true });
  return parts;
}

type Sides = Partial<Record<'top' | 'bottom' | 'left' | 'right', Border | null>>;

/**
 * The sides of a cell a set of table borders gives it: the outer ones where
 * the cell is at the edge of what the set is around, the inside ones elsewhere.
 * `edges` says at which edges it is.
 */
function sidesFrom(set: BorderSet | undefined, edges: { top: boolean; bottom: boolean; left: boolean; right: boolean }): Sides {
  if (!set) return {};
  const sides: Sides = {
    top: edges.top ? set.top : set.insideH,
    bottom: edges.bottom ? set.bottom : set.insideH,
    left: edges.left ? set.left : set.insideV,
    right: edges.right ? set.right : set.insideV,
  };
  for (const key of Object.keys(sides) as (keyof Sides)[]) if (sides[key] === undefined) delete sides[key];
  return sides;
}

const sameBorder = (a: Border | undefined, b: Border | undefined) => a === b || (!!a && !!b && a.width === b.width && a.color === b.color && a.style === b.style);

/** Whether a colour is dark enough for Word to show its automatic text colour on it as white. */
function darkColor(hex: string): boolean {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45;
}

/** How much room a border takes across the edge it is on: a double line is two lines and the room between them. */
export function borderRoom(border: Border | undefined): number {
  return !border ? 0 : border.style === 'double' ? border.width * 3 : border.width;
}

/** A table the text goes round, from its `w:tblpPr`. */
function parseTableFloat(tblpPr: XmlNode | undefined): TableFloat | undefined {
  if (!tblpPr) return undefined;
  const at = (name: string) => twips(tblpPr.attrs[name]) ?? 0;
  const spec = tblpPr.attrs['w:tblpXSpec'];
  return defined<TableFloat>({
    align: spec === 'center' ? 'center' : spec === 'right' || spec === 'outside' ? 'right' : spec === 'left' || spec === 'inside' ? 'left' : undefined,
    x: at('w:tblpX'),
    y: at('w:tblpY'),
    gapLeft: at('w:leftFromText'),
    gapRight: at('w:rightFromText'),
    gapTop: at('w:topFromText'),
    gapBottom: at('w:bottomFromText'),
  });
}

/** Reads the structure of a table and, through `ctx`, the paragraphs of its cells. */
function parseTable(tbl: XmlNode, ctx: BlockContext): void {
  const { sheet } = ctx;
  const tblPr = child(tbl, 'w:tblPr');
  const style = resolveStyle(sheet, val(child(tblPr, 'w:tblStyle')) ?? sheet.defaultTableStyle);
  // The table's own borders go over its style's, side by side.
  const tableBorders = mergeBorders(style.borders, parseBorders(child(tblPr, 'w:tblBorders')));
  const tableShade = shadeOf(child(tblPr, 'w:shd')) ?? style.shade;
  const look = parseLook(tblPr);
  const rowBand = Math.max(1, int(val(child(tblPr, 'w:tblStyleRowBandSize'))) ?? 1);
  const columnBand = Math.max(1, int(val(child(tblPr, 'w:tblStyleColBandSize'))) ?? 1);
  const width = child(tblPr, 'w:tblW');
  const widthValue = width?.attrs['w:w'] ?? '';
  // A relative width is written in fiftieths of a percent, or as a percentage.
  const fraction = width?.attrs['w:type'] === 'pct' ? Number(widthValue) / 5000 : widthValue.endsWith('%') ? parseFloat(widthValue) / 100 : NaN;

  const index = ctx.tables.length;
  const rows: TableRow[] = [];
  const table: Table = {
    columns: childrenOf(child(tbl, 'w:tblGrid'), 'w:gridCol').map((col) => twips(col.attrs['w:w']) ?? 0),
    fixed: child(tblPr, 'w:tblLayout')?.attrs['w:type'] === 'fixed',
    align: TABLE_ALIGN[val(child(tblPr, 'w:jc')) ?? ''] ?? 'left',
    indent: twips(child(tblPr, 'w:tblInd')?.attrs['w:w']) ?? 0,
    ...DEFAULT_CELL_PADDING,
    ...style.padding,
    ...parsePadding(child(tblPr, 'w:tblCellMar')),
    rows,
  };
  if (fraction > 0) table.widthFraction = fraction;
  const spacing = twips(child(tblPr, 'w:tblCellSpacing')?.attrs['w:w']);
  if (spacing) table.spacing = spacing;
  // A table inside another is set in its cell, not beside the text.
  const float = ctx.cell ? undefined : parseTableFloat(child(tblPr, 'w:tblpPr'));
  if (float) table.float = float;
  if (ctx.cell) table.parent = ctx.cell;
  ctx.tables.push(table);
  ctx.tableNodes.push(tbl);

  const trs = childrenOf(tbl, 'w:tr');
  let header = true;
  trs.forEach((tr, r) => {
    const trPr = child(tr, 'w:trPr');
    const tcs = childrenOf(tr, 'w:tc');
    const trHeight = child(trPr, 'w:trHeight');
    // Rows and cells are numbered as they come in the file, which is how export finds their XML again.
    const row: TableRow = {
      id: rows.length,
      before: int(val(child(trPr, 'w:gridBefore'))) ?? 0,
      height: twips(trHeight?.attrs['w:val']) ?? 0,
      cells: [],
    };
    if (trHeight?.attrs['w:hRule'] === 'exact' && row.height > 0) row.exact = true;
    if (trPr && toggle(trPr, 'w:cantSplit')) row.cantSplit = true;
    // Only the rows the table starts with are headings: one in the middle that says it is, is not.
    header &&= !!trPr && !!toggle(trPr, 'w:tblHeader');
    if (header) row.header = true;
    // A row put in or taken out while changes were tracked.
    const change = trPr?.children.find((c) => c.name === 'w:ins' || c.name === 'w:del');
    if (change) row.revision = defined({ type: change.name === 'w:ins' ? ('insert' as const) : ('delete' as const), author: change.attrs['w:author'] ?? '', date: change.attrs['w:date'] });
    tcs.forEach((tc, c) => {
      const tcPr = child(tc, 'w:tcPr');
      const merge = child(tcPr, 'w:vMerge');
      const parts = partsOf(look, { row: r, rows: trs.length, cell: c, cells: tcs.length }, rowBand, columnBand)
        .map((part) => ({ ...part, look: style.parts?.[part.name] }))
        .filter((part) => part.look);
      const edges = { top: r === 0, bottom: r === trs.length - 1, left: c === 0, right: c === tcs.length - 1 };
      // The lines of each side: the table's, then those of the parts of its style it is in, then its own.
      const sides: Sides = sidesFrom(tableBorders, edges);
      for (const { across, look: part } of parts) {
        Object.assign(sides, sidesFrom(part!.borders, across ? { ...edges, top: true, bottom: true } : { ...edges, left: true, right: true }));
        Object.assign(sides, sidesFrom(part!.cellBorders, { top: true, bottom: true, left: true, right: true }));
      }
      Object.assign(sides, sidesFrom(parseBorders(child(tcPr, 'w:tcBorders')), { top: true, bottom: true, left: true, right: true }));
      const lines: CellLines = {};
      for (const key of ['top', 'right', 'bottom', 'left'] as const) if (sides[key]) lines[key] = sides[key]!;
      const drawn = Object.keys(lines).length > 0;
      // Four plain lines are what a cell with borders is drawn with anyway.
      const plain = (['top', 'right', 'bottom', 'left'] as const).every((key) => sameBorder(lines[key], DEFAULT_BORDER));
      const partShade = parts.reduce<string | undefined>((shade, part) => part.look!.shade ?? shade, undefined);
      const valign = VALIGN[val(child(tcPr, 'w:vAlign')) ?? ''] ?? parts.reduce<TableCell['valign']>((v, part) => part.look!.valign ?? v, undefined);
      row.cells.push(
        defined<TableCell>({
          id: row.cells.length,
          borderTop: borderRoom(lines.top),
          borderBottom: borderRoom(lines.bottom),
          span: Math.max(1, int(val(child(tcPr, 'w:gridSpan'))) ?? 1),
          merge: merge ? (val(merge) === 'restart' ? ('start' as const) : ('continue' as const)) : undefined,
          borders: drawn,
          lines: drawn && !plain ? lines : undefined,
          shade: shadeOf(child(tcPr, 'w:shd')) ?? partShade ?? tableShade,
          valign,
          direction: DIRECTION[val(child(tcPr, 'w:textDirection')) ?? ''],
          ...parsePadding(child(tcPr, 'w:tcMar')),
        }),
      );
      // The paragraphs of the cell take the formatting of the table's style, and of the parts of it the cell is in.
      const tableStyle = { pPr: { ...style.pPr }, rPr: { ...style.rPr } };
      for (const { look: part } of parts) {
        Object.assign(tableStyle.pPr, part!.pPr);
        Object.assign(tableStyle.rPr, part!.rPr);
      }
      // Text of no colour of its own is white on a dark cell, as Word shows its automatic colour.
      const cellShade = row.cells[row.cells.length - 1].shade;
      if (cellShade && tableStyle.rPr.color === undefined && darkColor(cellShade)) tableStyle.rPr.color = 'FFFFFF';
      collectBlocks(tc, { ...ctx, tableStyle, cell: { table: index, row: rows.length, cell: row.cells.length - 1 } });
    });
    rows.push(row);
  });

  // A table without a usable grid gets equal columns across the text area.
  const count = Math.max(1, ...rows.map((row) => row.before + row.cells.reduce((n, cell) => n + cell.span, 0)));
  if (table.columns.length < count || table.columns.some((w) => w <= 0)) {
    table.columns = new Array<number>(count).fill(1);
    table.widthFraction ??= 1;
  }
}

function collectBlocks(node: XmlNode, ctx: BlockContext): void {
  for (const c of node.children) {
    switch (c.name) {
      case 'w:p':
        ctx.out.push(parseParagraph(c, ctx));
        break;
      case 'w:tbl':
        // A table inside a cell is a table of its own, which says which cell it is in.
        parseTable(c, ctx);
        break;
      case 'w:sdt': {
        const content = child(c, 'w:sdtContent');
        if (content) collectBlocks(content, ctx);
        break;
      }
    }
  }
}

function parsePage(sect: XmlNode | undefined): PageSetup {
  const size = child(sect, 'w:pgSz');
  const margin = child(sect, 'w:pgMar');
  return {
    width: twips(size?.attrs['w:w']) ?? DEFAULT_PAGE.width,
    height: twips(size?.attrs['w:h']) ?? DEFAULT_PAGE.height,
    marginTop: twips(margin?.attrs['w:top']) ?? DEFAULT_PAGE.marginTop,
    marginRight: twips(margin?.attrs['w:right']) ?? DEFAULT_PAGE.marginRight,
    marginBottom: twips(margin?.attrs['w:bottom']) ?? DEFAULT_PAGE.marginBottom,
    marginLeft: twips(margin?.attrs['w:left']) ?? DEFAULT_PAGE.marginLeft,
    headerDistance: twips(margin?.attrs['w:header']) ?? 36,
    footerDistance: twips(margin?.attrs['w:footer']) ?? 36,
  };
}

const SECTION_STARTS = new Set<string>(['nextPage', 'continuous', 'nextColumn', 'evenPage', 'oddPage']);

/** The columns a section's properties ask for, or nothing for the one that runs the whole width. */
export function parseColumns(sect: XmlNode | undefined): Columns | undefined {
  const cols = child(sect, 'w:cols');
  const count = int(cols?.attrs['w:num']) ?? 1;
  if (!cols || count < 2) return undefined;
  const columns: Columns = { count, space: twips(cols.attrs['w:space']) ?? 36 };
  const equal = cols.attrs['w:equalWidth'];
  const own = childrenOf(cols, 'w:col');
  // Columns of their own widths are listed one by one, each with the room after it.
  if ((equal === '0' || equal === 'false' || equal === 'off') && own.length >= 2) {
    columns.count = own.length;
    columns.widths = own.map((col) => ({ width: twips(col.attrs['w:w']) ?? 0, space: twips(col.attrs['w:space']) ?? 0 }));
  }
  const sep = cols.attrs['w:sep'];
  if (sep !== undefined && sep !== '0' && sep !== 'false' && sep !== 'off') columns.separator = true;
  return columns;
}

/** How a section is set out, from its properties. */
const NOTE_FORMATS = ['decimal', 'lowerRoman', 'upperRoman', 'lowerLetter', 'upperLetter'] as const;
const NOTE_RESTARTS: Record<string, NoteNumbering['restart']> = { eachSect: 'section', eachPage: 'page' };

/**
 * How a section numbers its notes, as its `w:footnotePr` or `w:endnotePr`
 * says: undefined when it says nothing that is not what they are anyway
 * (1, 2, 3 at the foot of the page, i, ii, iii at the end). Notes at the end
 * cannot start again on each page.
 */
export function parseNoteNumbering(sect: XmlNode | undefined, kind: 'footnote' | 'endnote'): NoteNumbering | undefined {
  const props = child(sect, kind === 'footnote' ? 'w:footnotePr' : 'w:endnotePr');
  if (!props) return undefined;
  const format = NOTE_FORMATS.find((f) => f === val(child(props, 'w:numFmt')));
  const start = Number(val(child(props, 'w:numStart')));
  const restart = NOTE_RESTARTS[val(child(props, 'w:numRestart')) ?? ''];
  const numbering = defined<NoteNumbering>({
    format: format === (kind === 'footnote' ? 'decimal' : 'lowerRoman') ? undefined : format,
    start: Number.isInteger(start) && start > 1 ? start : undefined,
    restart: restart === 'page' && kind === 'endnote' ? undefined : restart,
  });
  return Object.keys(numbering).length ? numbering : undefined;
}

function parseSection(sect: XmlNode, xml: string): Section {
  const start = val(child(sect, 'w:type'));
  return defined<Section>({
    page: parsePage(sect),
    columns: parseColumns(sect),
    start: start && SECTION_STARTS.has(start) && start !== 'nextPage' ? (start as SectionStart) : undefined,
    endnoteNumbering: parseNoteNumbering(sect, 'endnote'),
    footnoteNumbering: parseNoteNumbering(sect, 'footnote'),
    noEndnotes: toggle(sect, 'w:noEndnote') || undefined,
    xml: xml.slice(sect.start, sect.end),
  });
}

/** The text of a comment: its paragraphs, one to a line. */
function commentText(node: XmlNode): string {
  const inline = (n: XmlNode): string => n.children.map((c) => (c.name === 'w:t' ? textOf(c) : c.name === 'w:tab' ? '\t' : c.name === 'w:br' ? '\n' : c.name === 'w:p' ? '' : inline(c))).join('');
  const paragraphs: string[] = [];
  const walk = (n: XmlNode) => {
    for (const c of n.children) {
      if (c.name === 'w:p') paragraphs.push(inline(c));
      else walk(c);
    }
  };
  walk(node);
  return paragraphs.join('\n').trim();
}

/** The notes of a package: the comments of the part its main part points to. */
function readNotes(files: Record<string, Uint8Array>, mainPath: string): { path: string; notes: Note[] } | undefined {
  const slash = mainPath.lastIndexOf('/') + 1;
  const dir = mainPath.slice(0, slash);
  const rels = files[`${dir}_rels/${mainPath.slice(slash)}.rels`];
  const rel = rels && /<Relationship\b[^>]*\bType="[^"]*\/comments"[^>]*>/.exec(strFromU8(rels))?.[0];
  const target = rel && /\bTarget="([^"]*)"/.exec(rel)?.[1];
  const path = target ? (target.startsWith('/') ? target.slice(1) : dir + target) : `${dir}comments.xml`;
  const part = files[path];
  if (!part) return undefined;
  const xml = strFromU8(part);
  const colors = readNoteColors(files);
  const notes = childrenOf(child(parseXml(xml), 'w:comments'), 'w:comment')
    .filter((c) => c.attrs['w:id'] !== undefined)
    .map((c) => {
      const note: Note = defined({ id: c.attrs['w:id'], author: c.attrs['w:author'] ?? '', date: c.attrs['w:date'], text: commentText(c), xml: xml.slice(c.start, c.end) });
      return defined<Note>({ ...note, color: colors.get(noteKey(note)) });
    });
  return { path, notes };
}

/** The custom property the colours of the notes are kept in: Word has no colour for a comment, and keeps the properties it does not know. */
export const NOTE_COLORS_PROPERTY = 'DxNoteColors';
export const CUSTOM_PROPERTIES_PATH = 'docProps/custom.xml';

/** The colour of each note that has one, by who wrote it and when. */
function readNoteColors(files: Record<string, Uint8Array>): Map<string, string> {
  const colors = new Map<string, string>();
  const part = files[CUSTOM_PROPERTIES_PATH];
  if (!part) return colors;
  const properties = childrenOf(child(parseXml(strFromU8(part)), 'Properties'), 'property');
  const value = properties.find((p) => p.attrs.name === NOTE_COLORS_PROPERTY)?.children.find((c) => c.name !== '#text');
  // One after another, each ending in its colour.
  for (const entry of (value ? textOf(value) : '').split(/(?<==[0-9A-F]{6});/)) {
    const at = entry.lastIndexOf('=');
    if (at > 0 && /^[0-9A-F]{6}$/.test(entry.slice(at + 1))) colors.set(entry.slice(0, at), entry.slice(at + 1));
  }
  return colors;
}

/** The part of a type the main part points to, such as its 'footnotes'. */
function partOfType(files: Record<string, Uint8Array>, mainPath: string, type: string): string | undefined {
  const slash = mainPath.lastIndexOf('/') + 1;
  const dir = mainPath.slice(0, slash);
  const rels = files[`${dir}_rels/${mainPath.slice(slash)}.rels`];
  if (!rels) return undefined;
  const rel = childrenOf(child(parseXml(strFromU8(rels)), 'Relationships'), 'Relationship').find((r) => r.attrs.Type?.endsWith(`/${type}`) && r.attrs.TargetMode !== 'External');
  const target = rel?.attrs.Target;
  return target ? (target.startsWith('/') ? target.slice(1) : dir + target) : undefined;
}

/** Path of the main document part, read from the package relationships. */
function mainPartPath(files: Record<string, Uint8Array>): string {
  const rels = files['_rels/.rels'];
  if (rels) {
    const root = child(parseXml(strFromU8(rels)), 'Relationships');
    const rel = childrenOf(root, 'Relationship').find((r) => r.attrs.Type?.endsWith('/officeDocument'));
    const target = rel?.attrs.Target?.replace(/^\//, '');
    if (target && files[target]) return target;
  }
  return 'word/document.xml';
}

export interface ImportOptions {
  /**
   * The most the files of the package may take unpacked, in bytes, as the
   * package says it; 256 MB when not given. A DOCX that says more is refused
   * before it is unpacked: one sent by someone else may be made to fill the memory.
   */
  maxSize?: number;
}

/** The most a package may take unpacked when nothing else is said. */
export const MAX_DOCX_SIZE = 256 * 1024 * 1024;

export function importDocx(data: Uint8Array, options: ImportOptions = {}): Doc {
  const moves = newMoves();
  const limit = options.maxSize ?? MAX_DOCX_SIZE;
  let total = 0;
  const files = unzipSync(data, {
    filter: (file) => {
      total += file.originalSize;
      if (total > limit) throw new Error(`The DOCX is too large unpacked: more than ${Math.round(limit / 1024 / 1024)} MB`);
      return true;
    },
  });
  const mainPath = mainPartPath(files);
  const main = files[mainPath];
  if (!main) throw new Error('Not a DOCX file: the main document part is missing');

  const dir = mainPath.slice(0, mainPath.lastIndexOf('/') + 1);
  const stylesPart = files[`${dir}styles.xml`];
  const sheet = parseStyles(stylesPart ? strFromU8(stylesPart) : undefined);
  const numberingPart = files[`${dir}numbering.xml`];
  const numbering = parseNumbering(numberingPart ? strFromU8(numberingPart) : undefined);

  const xml = strFromU8(main);
  const body = child(child(parseXml(xml), 'w:document'), 'w:body');
  if (!body) throw new Error('Not a DOCX file: the document has no body');

  // The text of the text boxes, read where their drawings are: once each, by the id of its drawing.
  const textBoxes: TextBox[] = [];
  const boxSources = new Map<string, StorySource>();
  const boxes = (content: XmlNode, objectXml: string, ctx: BlockContext) => {
    const id = textBoxId(objectXml);
    if (id === undefined || boxSources.has(id)) return;
    const boxSlots: SourceSlot[] = [];
    const boxTables: Table[] = [];
    const out: Paragraph[] = [];
    collectBlocks(content, { ...ctx, slots: boxSlots, tables: boxTables, tableNodes: [], out, cell: undefined, tableStyle: undefined });
    if (!out.length) return;
    const box = defined<TextBox>({ id, paragraphs: out, tables: boxTables.length ? boxTables : undefined });
    textBoxes.push(box);
    boxSources.set(id, { path: ctx.path ?? mainPath, xml: ctx.xml, root: content, slots: boxSlots, story: box });
  };

  const paragraphs: Paragraph[] = [];
  const slots: SourceSlot[] = [];
  const tables: Table[] = [];
  const tableNodes: XmlNode[] = [];
  collectBlocks(body, { xml, moves, sheet, numbering, slots, tables, tableNodes, out: paragraphs, links: externalLinks(files, mainPath), path: mainPath, boxes });
  if (!paragraphs.length) {
    paragraphs.push({ props: { ...sheet.paragraphDefaults }, runs: [{ text: '', props: { ...sheet.runDefaults } }] });
  }
  const source = defined<DocxSource>({ files, mainPath, xml, body, sheet, numbering, slots });
  if (tables.length) Object.assign(source, { tables: tables.slice(), tableNodes });

  // The header and footer every page shows: the ones the last section marks as default.
  const sect = child(body, 'w:sectPr');
  /** The parts read, by path: sections that name the same one share what was read from it. */
  const read = new Map<string, StorySource | undefined>();
  const readPart = (path: string | undefined, rootName: string): StorySource | undefined => {
    if (!path) return undefined;
    if (!read.has(path)) read.set(path, readStory(path, rootName));
    return read.get(path);
  };
  const readStory = (path: string, rootName: string): StorySource | undefined => {
    const part = files[path];
    if (!part) return undefined;
    const partXml = strFromU8(part);
    const root = child(parseXml(partXml), rootName);
    if (!root) return undefined;
    const storyTables: Table[] = [];
    const storySlots: SourceSlot[] = [];
    const out: Paragraph[] = [];
    collectBlocks(root, { xml: partXml, moves, sheet, numbering, slots: storySlots, tables: storyTables, tableNodes: [], out, links: externalLinks(files, path), path, boxes });
    const made = defined<Story>({ paragraphs: out, tables: storyTables.length ? storyTables : undefined });
    return { path, xml: partXml, root, slots: storySlots, story: made };
  };
  // What each section shows: a section that names no part of a kind shows the one the section before it shows, as in Word.
  const ROOTS = { header: 'w:hdr', footer: 'w:ftr', firstHeader: 'w:hdr', firstFooter: 'w:ftr' } as const;
  const REFS = {
    header: ['w:headerReference', 'default'],
    footer: ['w:footerReference', 'default'],
    firstHeader: ['w:headerReference', 'first'],
    firstFooter: ['w:footerReference', 'first'],
  } as const;
  const named = (node: XmlNode | undefined, base: BasePart) => {
    const [reference, type] = REFS[base];
    const ref = childrenOf(node, reference).find((r) => (r.attrs['w:type'] ?? 'default') === type);
    return ref && relationships(source).get(ref.attrs['r:id'] ?? '');
  };
  const ownsFirst = (node: XmlNode | undefined) => {
    const titlePg = child(node, 'w:titlePg');
    return !!titlePg && !['0', 'false', 'off'].includes(titlePg.attrs['w:val'] ?? '1');
  };
  const marks = paragraphs.filter((p) => p.section);
  const nodes = [...marks.map((p) => child(child(slots[p.origin!].node, 'w:pPr'), 'w:sectPr')), sect];
  const shows: Partial<Record<BasePart, string>>[] = [];
  nodes.forEach((node, k) => {
    const was = shows[k - 1] ?? {};
    shows.push(Object.fromEntries(STORY_PARTS.map((base) => [base, named(node, base) ?? was[base]])));
  });
  const last = shows[shows.length - 1];
  const story = (base: BasePart) => readPart(last[base], ROOTS[base]);
  const header = story('header');
  const footer = story('footer');
  if (header) Object.assign(source, { headerPath: header.path, headerSource: header });
  if (footer) Object.assign(source, { footerPath: footer.path, footerSource: footer });
  // A first page with a header and a footer of its own.
  const ownFirst = ownsFirst(sect);
  const firstHeader = ownFirst ? story('firstHeader') : undefined;
  const firstFooter = ownFirst ? story('firstFooter') : undefined;
  if (firstHeader) Object.assign(source, { firstHeaderPath: firstHeader.path, firstHeaderSource: firstHeader });
  if (firstFooter) Object.assign(source, { firstFooterPath: firstFooter.path, firstFooterSource: firstFooter });
  source.titlePage = ownFirst;
  const firstPage = ownFirst ? defined({ header: firstHeader?.story, footer: firstFooter?.story }) : undefined;

  const settings = files[`${dir}settings.xml`];
  const compat = settings && /<w:compatSetting\b[^>]*w:name="compatibilityMode"[^>]*>/.exec(strFromU8(settings))?.[0];
  // A file that says no version Word opens as one of Word 2007, and lays out by its rules. Measured against Word: a table
  // floated to the right hung the margins of its cells past the margin of the page, as Word 2007 sets tables.
  const compatMode = int(/w:val="(\d+)"/.exec(compat || '')?.[1]) ?? 12;
  const defaultTabStop = twips(settings && /<w:defaultTabStop\b[^>]*w:val="(\d+)"/.exec(strFromU8(settings))?.[1]);
  // Whether the document keeps the changes made to it, as Word's "Track changes" says.
  const tracking = settings ? /<w:trackRevisions\b(?![^>]*w:val="(?:0|false|off)")[^>]*\/?>/.test(strFromU8(settings)) : false;
  source.trackRevisions = tracking;
  // Whether only the stretches marked for it may be changed, as Word's "Restrict editing" set to no changes says.
  const protection = settings ? /<w:documentProtection\b[^>]*>/.exec(strFromU8(settings))?.[0] : undefined;
  const restricted = !!protection && /\bw:edit="readOnly"/.test(protection) && /\bw:enforcement="(?:1|true|on)"/.test(protection);
  source.restricted = restricted;

  const page = parsePage(sect);
  source.page = page;
  const columns = parseColumns(sect);
  if (columns) source.columns = columns;
  const lastStart = val(child(sect, 'w:type'));
  if (lastStart && SECTION_STARTS.has(lastStart) && lastStart !== 'nextPage') source.sectionStart = lastStart as SectionStart;
  const endnoteNumbering = parseNoteNumbering(sect, 'endnote');
  if (endnoteNumbering) source.endnoteNumbering = endnoteNumbering;
  const footnoteNumbering = parseNoteNumbering(sect, 'footnote');
  if (footnoteNumbering) source.footnoteNumbering = footnoteNumbering;

  // A section before the last shows the document's header when it shows the same part; one of its own when it shows another, and none when none.
  marks.forEach((p, k) => {
    const section = p.section!;
    const own: Partial<Record<BasePart, StorySource>> = {};
    for (const kind of ['header', 'footer'] as const) {
      const path = shows[k][kind];
      if (!path || !readPart(path, ROOTS[kind])) section[kind === 'header' ? 'noHeader' : 'noFooter'] = true;
      else if (path !== last[kind]) own[kind] = readPart(path, ROOTS[kind]);
    }
    if (ownsFirst(nodes[k])) {
      own.firstHeader = readPart(shows[k].firstHeader, ROOTS.firstHeader);
      own.firstFooter = readPart(shows[k].firstFooter, ROOTS.firstFooter);
      section.firstPage = defined({ header: own.firstHeader?.story, footer: own.firstFooter?.story });
    }
    if (own.header) section.header = own.header.story;
    if (own.footer) section.footer = own.footer.story;
    if (Object.values(own).some(Boolean)) (source.sectionStories ??= {})[p.origin!] = defined(own);
  });
  const header0 = !!header;
  const footer0 = !!footer;

  // The notes at the foot of the pages and at the end, each a story of its own; the separator above them, as the file draws it.
  const readNoteKind = (kind: 'footnote' | 'endnote') => {
    const notes: Footnote[] = [];
    let separator: Paragraph | undefined;
    const path = partOfType(files, mainPath, `${kind}s`);
    const sources = new Map<string, StorySource>();
    if (!path || !files[path]) return { notes, separator, path: undefined, sources };
    const partXml = strFromU8(files[path]);
    const root = child(parseXml(partXml), `w:${kind}s`);
    for (const node of childrenOf(root, `w:${kind}`)) {
      const id = node.attrs['w:id'];
      const type = node.attrs['w:type'] ?? 'normal';
      if (id === undefined) continue;
      const storyTables: Table[] = [];
      const storySlots: SourceSlot[] = [];
      const out: Paragraph[] = [];
      collectBlocks(node, {
        xml: partXml,
        moves,
        sheet,
        numbering,
        slots: storySlots,
        tables: storyTables,
        tableNodes: [],
        out,
        links: externalLinks(files, path),
        path,
        boxes,
      });
      if (type === 'separator') {
        separator ??= out[0];
        continue;
      }
      if (type !== 'normal' || !out.length) continue;
      const note = defined<Footnote>({ id, paragraphs: out, tables: storyTables.length ? storyTables : undefined });
      notes.push(note);
      sources.set(id, { path, xml: partXml, root: node, slots: storySlots, story: note });
    }
    return { notes, separator, path, sources };
  };
  const foot = readNoteKind('footnote');
  const footnotes = foot.notes;
  const footnoteSeparator = foot.separator;
  if (foot.path) Object.assign(source, { footnotesPath: foot.path, footnoteSources: foot.sources });
  const end = readNoteKind('endnote');
  if (end.path) Object.assign(source, { endnotesPath: end.path, endnoteSources: end.sources });
  // Where they go is the settings' to say: Word reads it nowhere else.
  const endnotesAt = settings && /<w:endnotePr>(?:(?!<\/w:endnotePr>)[\s\S])*<w:pos\b[^>]*w:val="sectEnd"/.test(strFromU8(settings)) ? ('sections' as const) : undefined;

  const notes = readNotes(files, mainPath);
  if (notes) Object.assign(source, { notesPath: notes.path, notes: notes.notes });

  const used = new Set<string>();
  if (boxSources.size) source.textBoxSources = boxSources;
  for (const p of [
    ...paragraphs,
    ...[...read.values()].flatMap((part) => part?.story.paragraphs ?? []),
    ...footnotes.flatMap((note) => note.paragraphs),
    ...end.notes.flatMap((note) => note.paragraphs),
    ...textBoxes.flatMap((box) => box.paragraphs),
  ]) {
    if (p.props.styleId) used.add(p.props.styleId);
  }

  return defined<Doc>({
    page,
    columns,
    sectionStart: source.sectionStart,
    noHeader: header0 ? undefined : true,
    noFooter: footer0 ? undefined : true,
    compatMode,
    ...(defaultTabStop ? { defaultTabStop } : {}),
    trackRevisions: tracking || undefined,
    restricted: restricted || undefined,
    paragraphs,
    tables: tables.length ? tables : undefined,
    header: header?.story,
    footer: footer?.story,
    firstPage,
    notes: notes?.notes.length ? notes.notes : undefined,
    footnotes: footnotes.length ? footnotes : undefined,
    footnoteSeparator,
    endnotes: end.notes.length ? end.notes : undefined,
    endnoteSeparator: end.separator,
    endnoteNumbering,
    footnoteNumbering,
    endnotesAt,
    textBoxes: textBoxes.length ? textBoxes : undefined,
    styles: styleCatalog(sheet, used),
    numbering,
    source,
  });
}
