// Doc -> DOCX.
//
// A document that came from a DOCX is written back into its original package:
// untouched paragraphs are copied verbatim, edited ones are rebuilt on top of
// their original properties, and every other part (styles, numbering, headers,
// media...) is kept as it was. A document created from scratch gets a minimal
// package where every property is direct formatting.

import { strFromU8, strToU8, zipSync } from 'fflate';
import {
  type Border,
  type CellLines,
  type Columns,
  type Doc,
  type Footnote,
  type Note,
  type Paragraph,
  type Story,
  type Table,
  type TableCell,
  type TableRow,
  type TabStop,
  type ParagraphProps,
  type ResolvedParagraphProps,
  type ParagraphStyle,
  type ResolvedRunProps,
  type Run,
  type RunProps,
  type NoteNumbering,
  type Section,
  type SectionStart,
  DEFAULT_BORDER,
  WRAP_SEPARATOR,
  resolveParagraph,
  resolveRun,
  sameCell,
} from '../model';
import { STORY_PARTS as ALL_STORIES, type BasePart, type StoryPart, sectionEnds, sectionPart, storyKind, storyOf, storySource } from '../stories';
import type { ListLevel, Numbering } from '../numbering';
import { paragraphStyles } from '../styles';
import { imageExtension, mediaKey } from '../images';
import { noteKey, noteMark, pruneNotes } from '../notes';
import { editableMark } from '../editable';
import { isFieldMark } from '../toc';
import { isColumnBreak } from '../layout';
import { isCjkFont } from '../cjk';
import { type NoteKind, endnoteReferenceId, footnoteReferenceId, isEndnoteMark, isFootnoteMark, noteReferences } from '../footnotes';
import { textBoxId, textBoxOf } from '../textboxes';
import { CUSTOM_PROPERTIES_PATH, HIGHLIGHTS, NOTE_COLORS_PROPERTY, mergeTabs, parseRunProps, resolveStyle, val } from './import';
import { type DocxSource, type EmbeddedFont, type SourceSlot, type StorySource, relationships } from './source';
import { type XmlNode, child, childrenOf, createNode, escapeXml, parseElement, parseXml, serializeXml } from './xml';
import { textByFamily } from '../fonts';
import { parseTrueType, subsetTrueType } from '../pdf';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const CONTENT_TYPES =
  XML_HEADER +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

const ROOT_RELS =
  XML_HEADER +
  `<Relationships xmlns="${RELS_NS}">` +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const STORY_PARTS = {
  header: {
    root: 'w:hdr',
    reference: 'w:headerReference',
    rel: `${R_NS}/header`,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml',
  },
  footer: {
    root: 'w:ftr',
    reference: 'w:footerReference',
    rel: `${R_NS}/footer`,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml',
  },
} as const;

/** The relationship ids of a header and a footer the package did not have, to be named in the section. */
type StoryRefs = Partial<Record<StoryPart, string>>;

const NUMBERING_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml';
const NUMBERING_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering';

const STYLES_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml';
const STYLES_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles';

const twips = (pt: number) => Math.round(pt * 20);

/** Word's name for a highlight colour; 'none' for no highlight or a colour it does not have. */
function highlightName(hex: string): string {
  return Object.keys(HIGHLIGHTS).find((name) => hex && HIGHLIGHTS[name] === hex.toUpperCase()) ?? 'none';
}

// --- Lists ------------------------------------------------------------------

function numPrXml(numId: number, level: number): string {
  return `<w:numPr><w:ilvl w:val="${level}"/><w:numId w:val="${numId}"/></w:numPr>`;
}

function levelXml(level: ListLevel, index: number): string {
  const left = level.indentLeft ?? 0;
  const first = level.indentFirstLine ?? 0;
  const firstLine = first < 0 ? ` w:hanging="${twips(-first)}"` : ` w:firstLine="${twips(first)}"`;
  const font = level.run.fontFamily === undefined ? '' : escapeXml(level.run.fontFamily);
  const rPr = (font ? `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:hint="default"/>` : '') + (level.run.bold ? '<w:b/>' : '') + (level.run.italic ? '<w:i/>' : '');
  return (
    `<w:lvl w:ilvl="${index}">` +
    `<w:start w:val="${level.start}"/>` +
    `<w:numFmt w:val="${level.format}"/>` +
    (!level.restart ? '<w:lvlRestart w:val="0"/>' : level.restartAfter ? `<w:lvlRestart w:val="${level.restartAfter}"/>` : '') +
    (level.style ? `<w:pStyle w:val="${escapeXml(level.style)}"/>` : '') +
    (level.legal ? '<w:isLgl/>' : '') +
    (level.suffix === 'tab' ? '' : `<w:suff w:val="${level.suffix}"/>`) +
    `<w:lvlText w:val="${escapeXml(level.text)}"/>` +
    `<w:lvlJc w:val="${level.align}"/>` +
    `<w:pPr><w:ind w:left="${twips(left)}"${firstLine}/></w:pPr>` +
    (rPr ? `<w:rPr>${rPr}</w:rPr>` : '') +
    '</w:lvl>'
  );
}

/** The definitions of `numbering` that `known` lacks, as the two runs of elements a numbering part holds. */
function numberingXml(numbering: Numbering, known?: Numbering): { abstracts: string; lists: string } {
  let abstracts = '';
  let lists = '';
  for (const [id, levels] of numbering.abstracts) {
    if (known?.abstracts.has(id)) continue;
    const body = levels.map((level, i) => (level ? levelXml(level, i) : '')).join('');
    abstracts += `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="hybridMultilevel"/>${body}</w:abstractNum>`;
  }
  for (const [id, list] of numbering.lists) {
    if (known?.lists.has(id)) continue;
    let overrides = '';
    for (let i = 0; i < 9; i++) {
      const start = list.starts.get(i);
      const level = list.levels.get(i);
      if (start === undefined && !level) continue;
      overrides += `<w:lvlOverride w:ilvl="${i}">` + (start === undefined ? '' : `<w:startOverride w:val="${start}"/>`) + (level ? levelXml(level, i) : '') + '</w:lvlOverride>';
    }
    lists += `<w:num w:numId="${id}"><w:abstractNumId w:val="${list.abstractId}"/>${overrides}</w:num>`;
  }
  return { abstracts, lists };
}

/** Adds `content` as the last child of the root element, which may be written as an empty tag. */
function appendToRoot(xml: string, root: string, content: string): string {
  const close = xml.lastIndexOf(`</${root}>`);
  if (close >= 0) return xml.slice(0, close) + content + xml.slice(close);
  return xml.replace(new RegExp(`<${root}\\b([^>]*?)/>`), (_, attrs: string) => `<${root}${attrs}>${content}</${root}>`);
}

/** Inserts `content` before the first match of `before`, or at the end of the root element. */
function insertBefore(xml: string, before: RegExp, root: string, content: string): string {
  const at = xml.search(before);
  return at >= 0 ? xml.slice(0, at) + content + xml.slice(at) : appendToRoot(xml, root, content);
}

/**
 * Adds a part next to the main one: the part itself, its content type and the
 * relationship that ties it to the main part. Returns the id of that relationship.
 */
function addPart(files: Record<string, Uint8Array>, mainPath: string, name: string, relType: string, contentType: string, xml: string): string {
  const slash = mainPath.lastIndexOf('/') + 1;
  const dir = mainPath.slice(0, slash);
  files[dir + name] = strToU8(xml);
  const types = files['[Content_Types].xml'];
  if (types) {
    const override = `<Override PartName="/${dir}${name}" ContentType="${contentType}"/>`;
    files['[Content_Types].xml'] = strToU8(appendToRoot(strFromU8(types), 'Types', override));
  }
  const relsPath = `${dir}_rels/${mainPath.slice(slash)}.rels`;
  const rels = files[relsPath] ? strFromU8(files[relsPath]) : `${XML_HEADER}<Relationships xmlns="${RELS_NS}"/>`;
  let n = 1;
  while (rels.includes(`"rId${n}"`)) n++;
  files[relsPath] = strToU8(appendToRoot(rels, 'Relationships', `<Relationship Id="rId${n}" Type="${relType}" Target="${name}"/>`));
  return `rId${n}`;
}

/**
 * Writes into `files` the pictures put in since the document was opened that
 * `xml`, the main part, still shows, and returns `xml` naming each by the
 * relationship it was given.
 */
function writeMedia(doc: Doc, files: Record<string, Uint8Array>, mainPath: string, xml: string): string {
  const slash = mainPath.lastIndexOf('/') + 1;
  const dir = mainPath.slice(0, slash);
  const ids = new Map<string, string>();
  return xml.replace(/\br:embed="dx:([^"]+)"/g, (whole, key: string) => {
    const media = doc.media?.[key];
    const extension = media && imageExtension(media.type);
    if (!media || !extension) return whole;
    let id = ids.get(key);
    if (!id) {
      let n = 1;
      while (files[`${dir}media/dx${n}.${extension}`]) n++;
      const name = `media/dx${n}.${extension}`;
      files[dir + name] = media.bytes;
      const types = strFromU8(files['[Content_Types].xml']);
      if (!new RegExp(`Extension="${extension}"`, 'i').test(types)) {
        // Defaults go before the parts named one by one.
        const entry = `<Default Extension="${extension}" ContentType="${media.type}"/>`;
        files['[Content_Types].xml'] = strToU8(insertBefore(types, /<Override\b/, 'Types', entry));
      }
      const relsPath = `${dir}_rels/${mainPath.slice(slash)}.rels`;
      const rels = files[relsPath] ? strFromU8(files[relsPath]) : `${XML_HEADER}<Relationships xmlns="${RELS_NS}"/>`;
      let r = 1;
      while (rels.includes(`"rId${r}"`)) r++;
      id = `rId${r}`;
      files[relsPath] = strToU8(appendToRoot(rels, 'Relationships', `<Relationship Id="${id}" Type="${R_NS}/image" Target="${name}"/>`));
      ids.set(key, id);
    }
    return `r:embed="${id}"`;
  });
}

// --- Fonts carried in the file ----------------------------------------------------

/**
 * Whether a font file may go inside a document: TrueType outlines, the kind
 * Word embeds, and a licence that lets it. A font that says it may not be
 * embedded, or only as bitmaps, stays out.
 */
function embeddable(bytes: Uint8Array): boolean {
  const fsType = licence(bytes);
  // Of the licence bits, the least strict one that is set holds: 'restricted' alone keeps it out.
  return fsType !== undefined && (fsType & 0x0200) === 0 && (fsType & 0x000f) !== 0x0002;
}

/** The licence bits of a TrueType file (fsType, in OS/2): 0 when it has none to say. Undefined for another kind of file. */
function licence(bytes: Uint8Array): number | undefined {
  if (bytes.length < 12) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(0);
  if (version !== 0x00010000 && version !== 0x74727565) return undefined;
  for (let i = 0; i < view.getUint16(4); i++) {
    const record = 12 + i * 16;
    if (String.fromCharCode(bytes[record], bytes[record + 1], bytes[record + 2], bytes[record + 3]) === 'OS/2') return view.getUint16(view.getUint32(record + 8) + 8);
  }
  return 0;
}

/** What a font cut down keeps besides the text of the document: the letters, digits and signs of the keyboard, for page numbers, list numbers and a word typed later. */
const KEYBOARD = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');

/**
 * The font file with the glyphs of `text` and of the keyboard alone, when its
 * licence lets it be cut down; otherwise undefined, and it goes whole.
 */
function cutDown(bytes: Uint8Array, text: string): Uint8Array | undefined {
  if ((licence(bytes) ?? 0x0100) & 0x0100) return undefined;
  const font = parseTrueType(bytes);
  if (!font) return undefined;
  const glyphs = new Set<number>();
  for (const ch of KEYBOARD + text) glyphs.add(font.glyph(ch.codePointAt(0)!));
  return subsetTrueType(bytes, glyphs, true);
}

/** A key of the kind a font is obfuscated with, as a GUID: {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}. */
function fontKey(): string {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}}`;
}

/** The kinds of face of a font, as the font table names the file of each. */
const EMBEDS = [
  ['w:embedRegular', false, false],
  ['w:embedBold', true, false],
  ['w:embedItalic', false, true],
  ['w:embedBoldItalic', true, true],
] as const;

/**
 * Puts the faces of `fonts` the file does not carry yet into it, as Word does
 * when it embeds fonts: each file obfuscated with a key of its own (its first
 * 32 bytes XOR the key), named in the font table, and the setting that says
 * the document carries its fonts.
 */
function writeFonts(files: Record<string, Uint8Array>, mainPath: string, fonts: EmbeddedFont[], text?: Map<string, string>): void {
  const faces = fonts.filter((font) => font.family && embeddable(font.bytes));
  if (!faces.length) return;
  const slash = mainPath.lastIndexOf('/') + 1;
  const dir = mainPath.slice(0, slash);
  const tablePath = `${dir}fontTable.xml`;
  if (!files[tablePath]) {
    addPart(
      files,
      mainPath,
      'fontTable.xml',
      `${R_NS}/fontTable`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml',
      `${XML_HEADER}<w:fonts xmlns:w="${W_NS}" xmlns:r="${R_NS}"/>`,
    );
  }
  const table = parseElement(strFromU8(files[tablePath]));
  if (!table) return;
  table.attrs['xmlns:r'] ??= R_NS;
  const relsPath = `${dir}_rels/fontTable.xml.rels`;
  let rels = files[relsPath] ? strFromU8(files[relsPath]) : `${XML_HEADER}<Relationships xmlns="${RELS_NS}"/>`;
  let added = false;
  let cut = false;
  for (const face of faces) {
    let font = childrenOf(table, 'w:font').find((f) => f.attrs['w:name']?.toLowerCase() === face.family.toLowerCase());
    if (!font) {
      font = createNode('w:font', { 'w:name': face.family });
      table.children.push(font);
    }
    const kind = EMBEDS.find(([, bold, italic]) => bold === face.bold && italic === face.italic)!;
    if (child(font, kind[0])) continue;
    const key = fontKey();
    const hex = key.replace(/[^0-9A-F]/g, '');
    const smaller = text && cutDown(face.bytes, text.get(face.family.toLowerCase()) ?? '');
    if (smaller) cut = true;
    const bytes = smaller ?? face.bytes.slice();
    for (let i = 0; i < 32; i++) bytes[i] ^= parseInt(hex.slice(30 - 2 * (i % 16), 32 - 2 * (i % 16)), 16);
    let n = 1;
    while (files[`${dir}fonts/dxfont${n}.odttf`]) n++;
    files[`${dir}fonts/dxfont${n}.odttf`] = bytes;
    let r = 1;
    while (rels.includes(`"rId${r}"`)) r++;
    rels = appendToRoot(rels, 'Relationships', `<Relationship Id="rId${r}" Type="${R_NS}/font" Target="fonts/dxfont${n}.odttf"/>`);
    // The faces of a font go in their order, after what else it says of itself.
    font.children.push(createNode(kind[0], { 'r:id': `rId${r}`, 'w:fontKey': key, ...(smaller ? { 'w:subsetted': '1' } : {}) }));
    const order = EMBEDS.map(([name]) => name as string);
    const rank = (c: XmlNode) => order.indexOf(c.name);
    font.children.sort((a, b) => (rank(a) < 0 || rank(b) < 0 ? 0 : rank(a) - rank(b)));
    added = true;
  }
  if (!added) return;
  files[tablePath] = strToU8(XML_HEADER + serializeXml(table));
  files[relsPath] = strToU8(rels);
  const types = strFromU8(files['[Content_Types].xml']);
  if (!/Extension="odttf"/i.test(types)) {
    files['[Content_Types].xml'] = strToU8(insertBefore(types, /<Override\b/, 'Types', '<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>'));
  }
  // Word keeps the fonts in the file it saves only when its settings say the document carries them; cut down, when they say that too.
  const settingsPath = `${dir}settings.xml`;
  const say = ['w:embedTrueTypeFonts', ...(cut ? ['w:saveSubsetFonts'] : [])];
  if (!files[settingsPath]) {
    addPart(
      files,
      mainPath,
      'settings.xml',
      `${R_NS}/settings`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml',
      `${XML_HEADER}<w:settings xmlns:w="${W_NS}">${say.map((name) => `<${name}/>`).join('')}</w:settings>`,
    );
  } else {
    const settings = parseElement(strFromU8(files[settingsPath]));
    const missing = say.filter((name) => settings && !child(settings, name));
    if (settings && missing.length) {
      for (const name of missing) insertOrdered(settings, SETTINGS_ORDER, createNode(name));
      files[settingsPath] = strToU8(XML_HEADER + serializeXml(settings));
    }
  }
}

/** Says in the settings whether changes are tracked, when that is not what the file said. */
function writeTracking(doc: Doc, files: Record<string, Uint8Array>, mainPath: string, source: DocxSource | undefined): void {
  const on = !!doc.trackRevisions;
  if (on === !!source?.trackRevisions) return;
  const dir = mainPath.slice(0, mainPath.lastIndexOf('/') + 1);
  const settingsPath = `${dir}settings.xml`;
  if (!files[settingsPath]) {
    if (!on) return;
    addPart(
      files,
      mainPath,
      'settings.xml',
      `${R_NS}/settings`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml',
      `${XML_HEADER}<w:settings xmlns:w="${W_NS}"><w:trackRevisions/></w:settings>`,
    );
    return;
  }
  const settings = parseElement(strFromU8(files[settingsPath]));
  if (!settings) return;
  settings.children = settings.children.filter((c) => c.name !== 'w:trackRevisions');
  if (on) insertOrdered(settings, SETTINGS_ORDER, createNode('w:trackRevisions'));
  files[settingsPath] = strToU8(XML_HEADER + serializeXml(settings));
}

/**
 * Says in the settings whether only the stretches marked for it may be
 * changed, when that is not what the file said: no changes with exceptions
 * for everyone, without a password, which is how Word restricts it and lets
 * whoever opens it stop restricting it.
 */
function writeRestriction(doc: Doc, files: Record<string, Uint8Array>, mainPath: string, source: DocxSource | undefined): void {
  const on = !!doc.restricted;
  if (on === !!source?.restricted) return;
  const dir = mainPath.slice(0, mainPath.lastIndexOf('/') + 1);
  const settingsPath = `${dir}settings.xml`;
  const protection = () => createNode('w:documentProtection', { 'w:edit': 'readOnly', 'w:enforcement': '1' });
  if (!files[settingsPath]) {
    if (!on) return;
    addPart(
      files,
      mainPath,
      'settings.xml',
      `${R_NS}/settings`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml',
      `${XML_HEADER}<w:settings xmlns:w="${W_NS}"><w:documentProtection w:edit="readOnly" w:enforcement="1"/></w:settings>`,
    );
    return;
  }
  const settings = parseElement(strFromU8(files[settingsPath]));
  if (!settings) return;
  settings.children = settings.children.filter((c) => c.name !== 'w:documentProtection');
  if (on) insertOrdered(settings, SETTINGS_ORDER, protection());
  files[settingsPath] = strToU8(XML_HEADER + serializeXml(settings));
}

/** Says in the settings where the notes at the end go, when that is not what the file said: at the end of each section, or of the document. */
function writeEndnotePlacement(doc: Doc, files: Record<string, Uint8Array>, mainPath: string): void {
  const dir = mainPath.slice(0, mainPath.lastIndexOf('/') + 1);
  const settingsPath = `${dir}settings.xml`;
  const pos = '<w:endnotePr><w:pos w:val="sectEnd"/></w:endnotePr>';
  const want = doc.endnotesAt === 'sections';
  if (!files[settingsPath]) {
    if (want)
      addPart(
        files,
        mainPath,
        'settings.xml',
        `${R_NS}/settings`,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml',
        `${XML_HEADER}<w:settings xmlns:w="${W_NS}">${pos}</w:settings>`,
      );
    return;
  }
  const settings = parseElement(strFromU8(files[settingsPath]));
  if (!settings) return;
  const props = child(settings, 'w:endnotePr');
  const said = val(child(props, 'w:pos')) === 'sectEnd';
  if (said === want) return;
  if (props) {
    // Its numbering stays as it was; only where they go changes. The position comes first in it.
    props.children = props.children.filter((c) => c.name !== 'w:pos');
    if (want) props.children.unshift(createNode('w:pos', { 'w:val': 'sectEnd' }));
  } else insertOrdered(settings, SETTINGS_ORDER, parseElement(pos)!);
  files[settingsPath] = strToU8(XML_HEADER + serializeXml(settings));
}

/** The children of the settings, in the order the schema gives them. */
const SETTINGS_ORDER = [
  'w:writeProtection',
  'w:view',
  'w:zoom',
  'w:removePersonalInformation',
  'w:removeDateAndTime',
  'w:doNotDisplayPageBoundaries',
  'w:displayBackgroundShape',
  'w:printPostScriptOverText',
  'w:printFractionalCharacterWidth',
  'w:printFormsData',
  'w:embedTrueTypeFonts',
  'w:embedSystemFonts',
  'w:saveSubsetFonts',
  'w:saveFormsData',
  'w:mirrorMargins',
  'w:alignBordersAndEdges',
  'w:bordersDoNotSurroundHeader',
  'w:bordersDoNotSurroundFooter',
  'w:gutterAtTop',
  'w:hideSpellingErrors',
  'w:hideGrammaticalErrors',
  'w:activeWritingStyle',
  'w:proofState',
  'w:formsDesign',
  'w:attachedTemplate',
  'w:linkStyles',
  'w:stylePaneFormatFilter',
  'w:stylePaneSortMethod',
  'w:documentType',
  'w:mailMerge',
  'w:revisionView',
  'w:trackRevisions',
  'w:doNotTrackMoves',
  'w:doNotTrackFormatting',
  'w:documentProtection',
  'w:autoFormatOverride',
  'w:styleLockTheme',
  'w:styleLockQFSet',
  'w:defaultTabStop',
  'w:autoHyphenation',
  'w:consecutiveHyphenLimit',
  'w:hyphenationZone',
  'w:doNotHyphenateCaps',
  'w:showEnvelope',
  'w:summaryLength',
  'w:clickAndTypeStyle',
  'w:defaultTableStyle',
  'w:evenAndOddHeaders',
  'w:bookFoldRevPrinting',
  'w:bookFoldPrinting',
  'w:bookFoldPrintingSheets',
  'w:drawingGridHorizontalSpacing',
  'w:drawingGridVerticalSpacing',
  'w:displayHorizontalDrawingGridEvery',
  'w:displayVerticalDrawingGridEvery',
  'w:doNotUseMarginsForDrawingGridOrigin',
  'w:drawingGridHorizontalOrigin',
  'w:drawingGridVerticalOrigin',
  'w:doNotShadeFormData',
  'w:noPunctuationKerning',
  'w:characterSpacingControl',
  'w:printTwoOnOne',
  'w:strictFirstAndLastChars',
  'w:noLineBreaksAfter',
  'w:noLineBreaksBefore',
  'w:savePreviewPicture',
  'w:doNotValidateAgainstSchema',
  'w:saveInvalidXml',
  'w:ignoreMixedContent',
  'w:alwaysShowPlaceholderText',
  'w:doNotDemarcateInvalidXml',
  'w:saveXmlDataOnly',
  'w:useXSLTWhenSaving',
  'w:saveThroughXslt',
  'w:showXMLTags',
  'w:alwaysMergeEmptyNamespace',
  'w:updateFields',
  'w:hdrShapeDefaults',
  'w:footnotePr',
  'w:endnotePr',
  'w:compat',
  'w:docVars',
  'w:rsids',
  'm:mathPr',
  'w:attachedSchema',
  'w:themeFontLang',
  'w:clrSchemeMapping',
  'w:doNotIncludeSubdocsInStats',
  'w:doNotAutoCompressPictures',
  'w:forceUpgrade',
  'w:captions',
  'w:readModeInkLockDown',
  'w:smartTagType',
  'sl:schemaLibrary',
  'w:shapeDefaults',
  'w:doNotEmbedSmartTags',
  'w:decimalSymbol',
  'w:listSeparator',
];

/** A note as a comment of the comments part. */
/**
 * Gives a relationship of the part at `partPath` to each link of `xml` that
 * carries its own address, and returns `xml` naming each by it. An address the
 * part already has a relationship for uses that one.
 */
function writeLinks(files: Record<string, Uint8Array>, partPath: string, xml: string): string {
  if (!xml.includes('r:id="dx:')) return xml;
  const slash = partPath.lastIndexOf('/') + 1;
  const relsPath = `${partPath.slice(0, slash)}_rels/${partPath.slice(slash)}.rels`;
  let rels = files[relsPath] ? strFromU8(files[relsPath]) : `${XML_HEADER}<Relationships xmlns="${RELS_NS}"/>`;
  const ids = new Map<string, string>();
  for (const [rel] of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]*)"/.exec(rel)?.[1];
    const target = /\bTarget="([^"]*)"/.exec(rel)?.[1];
    if (id && target !== undefined && /\bType="[^"]*\/hyperlink"/.test(rel) && /\bTargetMode="External"/.test(rel)) ids.set(target, id);
  }
  let n = 1;
  const out = xml.replace(/(<w:hyperlink\b[^>]*?\br:id=")dx:([^"]*)"/g, (_, open: string, href: string) => {
    let id = ids.get(href);
    if (!id) {
      while (rels.includes(`"rId${n}"`)) n++;
      id = `rId${n}`;
      rels = appendToRoot(rels, 'Relationships', `<Relationship Id="${id}" Type="${R_NS}/hyperlink" Target="${href}" TargetMode="External"/>`);
      ids.set(href, id);
    }
    return `${open}${id}"`;
  });
  files[relsPath] = strToU8(rels);
  return out;
}

function commentXml(note: Note): string {
  const date = note.date ? ` w:date="${escapeXml(note.date)}"` : '';
  const initials = note.author
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
  const lines = note.text.split('\n').map((line, i) => {
    // The first paragraph of a comment starts with the mark Word numbers it by.
    const ref = i === 0 ? '<w:r><w:annotationRef/></w:r>' : '';
    return `<w:p>${ref}${line ? `<w:r>${textXml(line)}</w:r>` : ''}</w:p>`;
  });
  return `<w:comment w:id="${escapeXml(note.id)}" w:author="${escapeXml(note.author)}"${date} w:initials="${escapeXml(initials)}">${lines.join('')}</w:comment>`;
}

const CUSTOM_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties';
const VT_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes';
/** The id every custom property of a document is filed under. */
const CUSTOM_FMTID = '{D5CDD505-2E9C-101B-9397-08002B2CF9AE}';

/**
 * Writes the colours of the notes as a custom property of the document,
 * which is where Word keeps what it does not know; the other properties the
 * package had stay. Without colours to keep, the property is taken away.
 */
function writeNoteColors(notes: Note[], files: Record<string, Uint8Array>): void {
  const value = notes
    .filter((note) => note.color)
    .map((note) => `${noteKey(note)}=${note.color}`)
    .join(';');
  const had = files[CUSTOM_PROPERTIES_PATH] ? strFromU8(files[CUSTOM_PROPERTIES_PATH]) : undefined;
  const ours = new RegExp(`<property\\b[^>]*\\bname="${NOTE_COLORS_PROPERTY}"[^>]*>[\\s\\S]*?</property>`);
  if (had === undefined && !value) return;
  const others = (had ?? `${XML_HEADER}<Properties xmlns="${CUSTOM_NS}" xmlns:vt="${VT_NS}"/>`).replace(ours, '');
  // Each property has a number of its own, from 2 up.
  let pid = 2;
  for (const match of others.matchAll(/\bpid="(\d+)"/g)) pid = Math.max(pid, Number(match[1]) + 1);
  const property = `<property fmtid="${CUSTOM_FMTID}" pid="${pid}" name="${NOTE_COLORS_PROPERTY}"><vt:lpwstr>${escapeXml(value)}</vt:lpwstr></property>`;
  files[CUSTOM_PROPERTIES_PATH] = strToU8(value ? appendToRoot(others, 'Properties', property) : others);
  if (had !== undefined) return;
  // A new part: the package says what it is and where it hangs from.
  const types = strFromU8(files['[Content_Types].xml']);
  files['[Content_Types].xml'] = strToU8(
    appendToRoot(types, 'Types', `<Override PartName="/${CUSTOM_PROPERTIES_PATH}" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>`),
  );
  const rels = files['_rels/.rels'] ? strFromU8(files['_rels/.rels']) : `${XML_HEADER}<Relationships xmlns="${RELS_NS}"/>`;
  let n = 1;
  while (rels.includes(`"rId${n}"`)) n++;
  files['_rels/.rels'] = strToU8(appendToRoot(rels, 'Relationships', `<Relationship Id="rId${n}" Type="${R_NS}/custom-properties" Target="${CUSTOM_PROPERTIES_PATH}"/>`));
}

/**
 * Writes the notes into the comments part, when they are not the ones the
 * package came with: a note the file had and that was not touched goes back
 * as it was, and the part is made, with what ties it to the main one, for a
 * document that had none.
 */
function writeNotes(doc: Doc, files: Record<string, Uint8Array>, mainPath: string, source: DocxSource | undefined): void {
  const notes = doc.notes ?? [];
  if (notes === source?.notes || (!notes.length && !source?.notes?.length)) return;
  writeNoteColors(notes, files);
  const body = notes.map((note) => note.xml ?? commentXml(note)).join('');
  const path = source?.notesPath;
  const original = path && files[path] ? strFromU8(files[path]) : undefined;
  const open = original && /<w:comments\b[^>]*?(\/?)>/.exec(original);
  if (path && original && open) {
    // The root keeps the namespaces the comments of the file were written with.
    const head = original.slice(0, open.index) + open[0].replace(/\/>$/, '>');
    files[path] = strToU8(`${head}${body}</w:comments>`);
    return;
  }
  if (!notes.length) return;
  const xml = `${XML_HEADER}<w:comments xmlns:w="${W_NS}">${body}</w:comments>`;
  addPart(files, mainPath, 'comments.xml', `${R_NS}/comments`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml', xml);
}

/** A paragraph style as a definition for the styles part. */
function styleXml(style: ParagraphStyle, normal: string | undefined): string {
  const p = resolveParagraph(style.paragraph);
  const jc = p.align === 'justify' ? 'both' : p.align;
  const isNormal = normal === undefined || style.id === normal;
  return (
    `<w:style w:type="paragraph"${isNormal ? ' w:default="1"' : ''} w:styleId="${escapeXml(style.id)}">` +
    `<w:name w:val="${escapeXml(style.wordName ?? style.name)}"/>` +
    (isNormal ? '' : `<w:basedOn w:val="${escapeXml(normal)}"/>`) +
    (style.next ? `<w:next w:val="${escapeXml(style.next)}"/>` : '') +
    '<w:qFormat/><w:pPr>' +
    (p.keepNext ? '<w:keepNext/>' : '') +
    (p.keepLines ? '<w:keepLines/>' : '') +
    `<w:spacing w:before="${twips(p.spacingBefore)}" w:after="${twips(p.spacingAfter)}" w:line="${Math.round(p.lineHeight * 240)}" w:lineRule="auto"/>` +
    `<w:jc w:val="${jc}"/>` +
    (style.outlineLevel ? `<w:outlineLvl w:val="${style.outlineLevel - 1}"/>` : '') +
    '</w:pPr>' +
    runPropsXml(style.run) +
    '</w:style>'
  );
}

/**
 * Writes into `files` the definition of the styles the paragraphs use and the
 * package does not have: the standard titles and headings, in a file that
 * came without them, and all the ones used in a new document.
 */
function writeStyles(doc: Doc, files: Record<string, Uint8Array>, mainPath: string, source: DocxSource | undefined): void {
  const used = new Set<string>();
  for (const p of [...doc.paragraphs, ...(doc.header?.paragraphs ?? []), ...(doc.footer?.paragraphs ?? [])]) {
    if (p.props.styleId && !source?.sheet.styles.has(p.props.styleId)) used.add(p.props.styleId);
  }
  if (!used.size) return;
  const styles = paragraphStyles(doc);
  const path = `${mainPath.slice(0, mainPath.lastIndexOf('/') + 1)}styles.xml`;
  const existing = files[path];
  // A package without styles gets the default one too, for the others to build on.
  const normal = existing ? source?.sheet.defaultParagraphStyle : styles[0].id;
  if (!existing) used.add(styles[0].id);
  const added = styles
    .filter((style) => used.has(style.id))
    .map((style) => styleXml(style, normal))
    .join('');
  if (!added) return;
  if (existing) files[path] = strToU8(appendToRoot(strFromU8(existing), 'w:styles', added));
  else addPart(files, mainPath, 'styles.xml', STYLES_REL, STYLES_TYPE, `${XML_HEADER}<w:styles xmlns:w="${W_NS}">${added}</w:styles>`);
}

/**
 * Says in the defaults of the styles which language the text is in, when the
 * file does not say it already: without one, Word gives every run the language
 * it guesses when it opens the file, and with changes tracked, that is a change
 * of formatting of every run, by whoever opened it.
 */
function writeLanguage(files: Record<string, Uint8Array>, mainPath: string, language: string, replace = false): void {
  const path = `${mainPath.slice(0, mainPath.lastIndexOf('/') + 1)}styles.xml`;
  // Chinese or Japanese is the language of the characters Word calls East Asian too, which it sets in a font for it.
  const eastAsia = /^(zh|ja)\b/i.test(language) ? language : undefined;
  const lang = `<w:lang w:val="${escapeXml(language)}"${eastAsia ? ` w:eastAsia="${escapeXml(eastAsia)}"` : ''}/>`;
  if (!files[path]) {
    addPart(
      files,
      mainPath,
      'styles.xml',
      STYLES_REL,
      STYLES_TYPE,
      `${XML_HEADER}<w:styles xmlns:w="${W_NS}"><w:docDefaults><w:rPrDefault><w:rPr>${lang}</w:rPr></w:rPrDefault></w:docDefaults></w:styles>`,
    );
    return;
  }
  const styles = parseElement(strFromU8(files[path]));
  if (!styles) return;
  let defaults = child(styles, 'w:docDefaults');
  if (!defaults) {
    defaults = createNode('w:docDefaults');
    styles.children.unshift(defaults);
  }
  let rPrDefault = child(defaults, 'w:rPrDefault');
  if (!rPrDefault) {
    rPrDefault = createNode('w:rPrDefault');
    defaults.children.unshift(rPrDefault);
  }
  let rPr = child(rPrDefault, 'w:rPr');
  if (!rPr) {
    rPr = createNode('w:rPr');
    rPrDefault.children.push(rPr);
  }
  const had = child(rPr, 'w:lang');
  if (had && !replace) return;
  if (had) {
    if (had.attrs['w:val'] === language && (!eastAsia || had.attrs['w:eastAsia'] === eastAsia)) return;
    had.attrs['w:val'] = language;
    if (eastAsia) had.attrs['w:eastAsia'] = eastAsia;
  } else insertOrdered(rPr, RPR_ORDER, parseElement(lang)!);
  files[path] = strToU8(XML_HEADER + serializeXml(styles));
}

/** Writes into `files` the lists the package does not define yet: all of them for a new document. */
function writeNumbering(doc: Doc, files: Record<string, Uint8Array>, mainPath: string, source: DocxSource | undefined): void {
  if (!doc.numbering || doc.numbering === source?.numbering) return;
  const added = numberingXml(doc.numbering, source?.numbering);
  if (!added.abstracts && !added.lists) return;
  const path = `${mainPath.slice(0, mainPath.lastIndexOf('/') + 1)}numbering.xml`;
  const existing = files[path];
  if (existing) {
    // A numbering part lists every abstract list first, then every list.
    let xml = insertBefore(strFromU8(existing), /<w:num[\s>]/, 'w:numbering', added.abstracts);
    xml = insertBefore(xml, /<w:numIdMacAtCleanup\b/, 'w:numbering', added.lists);
    files[path] = strToU8(xml);
    return;
  }
  const xml = `${XML_HEADER}<w:numbering xmlns:w="${W_NS}">${added.abstracts}${added.lists}</w:numbering>`;
  addPart(files, mainPath, 'numbering.xml', NUMBERING_REL, NUMBERING_TYPE, xml);
}

/**
 * A header or footer part with its paragraphs as the story now has them: the
 * untouched ones as they were, the edited ones rebuilt on their original, the
 * ones the story no longer has taken out and the new ones put in.
 */
/** The paragraphs and tables of a header, a footer or a new document, written from the model in the order they are in. */
function blocksXml(view: Doc): string {
  const cells = paragraphsByCell(view);
  const written = new Set<number>();
  let blocks = '';
  for (const para of view.paragraphs) {
    const table = para.cell?.table;
    if (table === undefined) {
      blocks += paragraphXml(para);
    } else if (!written.has(table) && view.tables?.[table]) {
      written.add(table);
      blocks += tableXml(view, table, (row, cell) => (cells.get(cellKey(table, row.id, cell.id)) ?? []).map(paragraphXml).join(''));
    }
  }
  return blocks;
}

/** A header or a footer seen as a document, for what writes tables to find them in. */
const storyView = (doc: Doc, story: Story | undefined): Doc => ({ ...doc, paragraphs: story?.paragraphs ?? [], tables: story?.tables });

function storyXml(doc: Doc, story: Story | undefined, from: StorySource, source: DocxSource): string {
  const { xml, root, slots } = from;
  // A table made since the part was read is written from the model, whole, where its paragraphs are;
  // seen from outside it is one more new block, not paragraphs of a cell.
  const had = from.story.tables?.length ?? 0;
  const added = (para: Paragraph) => !!para.cell && para.cell.table >= had;
  const cellOf = (para: Paragraph) => (added(para) ? undefined : para.cell);
  const view = storyView(doc, story);
  const cells = paragraphsByCell(view);
  const tablesWritten = new Set<number>();
  /** A paragraph that was not in the part: itself, or the table it is the first paragraph seen of. */
  const fresh = (para: Paragraph): string => {
    if (!added(para)) return paragraphXml(para);
    const table = para.cell!.table;
    if (tablesWritten.has(table) || !view.tables?.[table]) return '';
    tablesWritten.add(table);
    return tableXml(view, table, (row, cell) => (cells.get(cellKey(table, row.id, cell.id)) ?? []).map(paragraphXml).join(''));
  };
  // The paragraphs of the part are rebuilt from its own XML, with the styles of the document.
  const part: DocxSource = { ...source, xml };
  // Paragraphs grouped under the paragraph of the part they descend from. A new one follows the
  // one before it; ahead of them all it opens the part, and one that is not in the cell the one
  // before it is in waits for the next paragraph outside a table, or closes the part.
  const groups = new Map<number, Paragraph[]>();
  const lead: Paragraph[] = [];
  let waiting: Paragraph[] = [];
  let last: Paragraph | undefined;
  for (const para of story?.paragraphs ?? []) {
    if (para.origin !== undefined && slots[para.origin] && !added(para)) {
      const group = groups.get(para.origin) ?? [];
      groups.set(para.origin, group);
      if (!para.cell) {
        group.push(...waiting);
        waiting = [];
      }
      group.push(para);
      last = para;
    } else if (!last) {
      lead.push(para);
    } else if (sameCell(cellOf(para), last.cell)) {
      groups.get(last.origin!)!.push(para);
    } else {
      waiting.push(para);
    }
  }

  let inner = lead.map(fresh).join('');
  let cursor = root.openEnd;
  slots.forEach((slot, index) => {
    const group = groups.get(index) ?? [];
    const descends = (para: Paragraph) => para.origin !== undefined && !added(para);
    inner += xml.slice(cursor, slot.node.start);
    cursor = slot.node.end;
    group.forEach((para, i) => {
      if (!descends(para)) inner += fresh(para);
      else if (para === slot.paragraph) inner += xml.slice(slot.node.start, slot.node.end);
      else inner += editedParagraphXml(part, slot, para, !group.slice(0, i).some(descends), !group.slice(i + 1).some(descends));
    });
    // A table cell must end in a paragraph.
    if (!group.length && slot.paragraph.cell) inner += '<w:p/>';
  });
  inner += xml.slice(cursor, root.closeStart) + waiting.map(fresh).join('');
  // A part cannot end in a table: Word wants a paragraph after it.
  if (/<\/w:tbl>$/.test(inner)) inner += '<w:p/>';
  // A header or footer must hold at least one paragraph.
  if (!/<w:(?:p|tbl)[\s>/]/.test(inner)) inner += '<w:p/>';
  return xml.slice(0, root.openEnd) + inner + xml.slice(root.closeStart);
}

/**
 * Writes into `files` the header and the footer that changed. One the package
 * already had is rewritten in its part; one it did not have gets a part of its
 * own, and its relationship id is returned for the section to refer to.
 */
function writeStories(doc: Doc, files: Record<string, Uint8Array>, mainPath: string, source: DocxSource | undefined): StoryRefs {
  const refs: StoryRefs = {};
  const dir = mainPath.slice(0, mainPath.lastIndexOf('/') + 1);
  /** The pictures and the links put in here are named by relationships of the part they are in. */
  const finish = (path: string, xml: string) => writeLinks(files, path, writeMedia(doc, files, path, xml));
  for (const name of ALL_STORIES) {
    const kind = storyKind(name);
    // The first page's own are left as they are in a document that no longer gives it any.
    if (name !== kind && !doc.firstPage) continue;
    const story = storyOf(doc, name);
    const from = source?.[`${name}Source`];
    const part = STORY_PARTS[kind];
    // A part written as an empty tag has nowhere to put paragraphs in: it is written anew below.
    if (from && from.root.openEnd !== from.root.end) {
      if (story !== from.story) files[from.path] = strToU8(finish(from.path, storyXml(doc, story, from, source!)));
      continue;
    }
    if (from ? story === from.story : !story?.paragraphs.length) continue;
    const blocks = blocksXml(storyView(doc, story));
    // A part cannot be empty, nor end in a table.
    const xml = `${XML_HEADER}<${part.root} xmlns:w="${W_NS}" xmlns:r="${R_NS}">${blocks}${!blocks || blocks.endsWith('</w:tbl>') ? '<w:p/>' : ''}</${part.root}>`;
    if (from) {
      files[from.path] = strToU8(finish(from.path, xml));
      continue;
    }
    let n = 1;
    while (files[`${dir}${kind}${n}.xml`]) n++;
    refs[name] = addPart(files, mainPath, `${kind}${n}.xml`, part.rel, part.type, finish(`${dir}${kind}${n}.xml`, xml));
  }
  return refs;
}

/** The line above the notes of a page, and the one above the rest of a note that goes on from the page before, as Word writes them. */
const separators = (tag: string) =>
  `<w:${tag} w:type="separator" w:id="-1"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:separator/></w:r></w:p></w:${tag}>` +
  `<w:${tag} w:type="continuationSeparator" w:id="0"><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:continuationSeparator/></w:r></w:p></w:${tag}>`;

/**
 * Writes the notes of a kind into their part, footnotes.xml or endnotes.xml:
 * those of the file as they were when untouched, those that changed written
 * again in their place, the new ones after them. A note no reference names
 * any more goes.
 */
function writeReferencedNotes(doc: Doc, files: Record<string, Uint8Array>, mainPath: string, source: DocxSource | undefined, kind: NoteKind): void {
  const tag = kind;
  const named = new Set(noteReferences(doc, kind).map((ref) => ref.id));
  const notes = ((kind === 'footnote' ? doc.footnotes : doc.endnotes) ?? []).filter((note) => named.has(note.id));
  const sources = kind === 'footnote' ? source?.footnoteSources : source?.endnoteSources;
  const path = kind === 'footnote' ? source?.footnotesPath : source?.endnotesPath;
  const finish = (at: string, xml: string) => writeLinks(files, at, writeMedia(doc, files, at, xml));
  const fresh = (note: Footnote) => `<w:${tag} w:id="${escapeXml(note.id)}">${blocksXml(storyView(doc, note)) || '<w:p/>'}</w:${tag}>`;
  if (path && sources && files[path]) {
    const all = [...sources.values()];
    const same = all.length === notes.length && notes.every((note) => sources.get(note.id)?.story === note);
    if (same) return;
    const xml = all[0]?.xml ?? strFromU8(files[path]);
    const root = child(parseXml(xml), `w:${tag}s`);
    if (!root) return;
    const byId = new Map(notes.map((note) => [note.id, note]));
    let inner = '';
    let cursor = root.openEnd;
    for (const node of root.children) {
      if (node.name !== `w:${tag}`) continue;
      const id = node.attrs['w:id'] ?? '';
      const from = sources.get(id);
      if (!from) continue;
      inner += xml.slice(cursor, node.start);
      cursor = node.end;
      const note = byId.get(id);
      byId.delete(id);
      if (!note) continue;
      if (note === from.story) inner += xml.slice(node.start, node.end);
      else {
        const whole = storyXml(doc, note, from, source!);
        inner += whole.slice(node.start, whole.length - (xml.length - node.end));
      }
    }
    inner += xml.slice(cursor, root.closeStart) + [...byId.values()].map(fresh).join('');
    files[path] = strToU8(finish(path, xml.slice(0, root.openEnd) + inner + xml.slice(root.closeStart)));
    return;
  }
  if (!notes.length) return;
  const dir = mainPath.slice(0, mainPath.lastIndexOf('/') + 1);
  const xml = `${XML_HEADER}<w:${tag}s xmlns:w="${W_NS}" xmlns:r="${R_NS}">${separators(tag)}${notes.map(fresh).join('')}</w:${tag}s>`;
  const type = `application/vnd.openxmlformats-officedocument.wordprocessingml.${tag}s+xml`;
  addPart(files, mainPath, `${tag}s.xml`, `${R_NS}/${tag}s`, type, finish(`${dir}${tag}s.xml`, xml));
}

function textXml(text: string, deleted = false): string {
  const tag = deleted ? 'w:delText' : 'w:t';
  let content = '';
  for (const part of text.split(/(\t|\n|\f)/)) {
    if (!part) continue;
    if (part === '\t') content += '<w:tab/>';
    else if (part === '\n') content += '<w:br/>';
    else if (part === '\f') content += '<w:br w:type="page"/>';
    else content += `<${tag} xml:space="preserve">${escapeXml(part)}</${tag}>`;
  }
  return content;
}

// --- Text boxes -----------------------------------------------------------------

/** The text boxes of the document being written, while it is: their text is written into their drawings. */
let boxesOf: Doc | undefined;

/**
 * The drawing of a text box made here, with its text in it: one read from the
 * file keeps its own, which is written again in the part it is in when it changed.
 */
function freshBoxXml(xml: string): string {
  const id = textBoxId(xml);
  if (id === undefined || !boxesOf || boxesOf.source?.textBoxSources?.has(id)) return xml;
  const box = textBoxOf(boxesOf, id);
  if (!box) return xml;
  const content = `<w:txbxContent>${box.paragraphs.map(paragraphXml).join('') || '<w:p/>'}</w:txbxContent>`;
  return xml.replace(/<w:txbxContent\b[^>]*\/>|<w:txbxContent\b[^>]*>[\s\S]*?<\/w:txbxContent>/g, () => content);
}

/**
 * The parts with a text box of the file whose text changed, with it written
 * again: every copy of it there is, the one Word shows and the one for older
 * programs, takes its new text. `xmlOf` is the part as written so far.
 */
function changedBoxes(doc: Doc, source: DocxSource | undefined): { path: string; from: string; to: string }[] {
  const out: { path: string; from: string; to: string }[] = [];
  for (const [id, from] of source?.textBoxSources ?? []) {
    const box = textBoxOf(doc, id);
    if (!box || box === from.story) continue;
    const whole = storyXml(doc, box, from, source!);
    const content = whole.slice(from.root.start, whole.length - (from.xml.length - from.root.end));
    out.push({ path: from.path, from: from.xml.slice(from.root.start, from.root.end), to: content });
  }
  return out;
}

const replaceBoxes = (xml: string, path: string, changes: { path: string; from: string; to: string }[]) =>
  changes.reduce((now, change) => (change.path === path ? now.split(change.from).join(change.to) : now), xml);

// --- Tracked changes ------------------------------------------------------------

/** The ids of the changes written: unique in the file, above the ones it may already have. */
let revisionIds = 0;
const FIRST_REVISION_ID = 900000;

/** What a change says of itself: its id, who made it and when. */
function revisionAttrs(author: string | undefined, date: string | undefined): string {
  return ` w:id="${FIRST_REVISION_ID + revisionIds++}" w:author="${escapeXml(author || 'Rebodocs')}"${date ? ` w:date="${escapeXml(date)}"` : ''}`;
}

const revisionTag = (type: string | undefined) => (type === 'insert' ? 'w:ins' : type === 'delete' ? 'w:del' : '');

/** The element a paragraph mark put in or taken out has in the `w:rPr` of its paragraph, or nothing. */
function markRevisionXml(props: ParagraphProps): string {
  const tag = revisionTag(props.markRevision);
  return tag ? `<${tag}${revisionAttrs(props.markAuthor, props.markDate)}/>` : '';
}

/**
 * Writes runs inside the changes they are part of: one `w:ins` or `w:del`
 * around each stretch of the same change, inside the wrapper the runs share.
 * Text taken out of what another put in goes in a `w:del` inside a `w:ins`,
 * as Word writes it. A move goes as the text taken out and the text put in:
 * written as Word's own move, with its ranges, the file did not open in Word
 * for Mac, which reads the two as it reads any other.
 */
function revisionWriter(): { open(props: RunProps): string; close(): string } {
  let key = '';
  let closing = '';
  return {
    open(props) {
      const next = props.revision
        ? [props.revision, props.revisionAuthor, props.revisionDate, props.insertedBy, props.insertedDate].map((v) => v ?? '').join('\u0000') + (props.insertedBy !== undefined ? '\u0000n' : '')
        : '';
      if (next === key) return '';
      const out = this.close();
      key = next;
      const tag = revisionTag(props.revision);
      if (!tag) return out;
      let open = '';
      if (props.revision === 'delete' && props.insertedBy !== undefined) {
        open += `<w:ins${revisionAttrs(props.insertedBy, props.insertedDate)}>`;
        closing = '</w:del></w:ins>';
      } else closing = `</${tag}>`;
      return out + open + `<${tag}${revisionAttrs(props.revisionAuthor, props.revisionDate)}>`;
    },
    close() {
      const out = closing;
      key = '';
      closing = '';
      return out;
    },
  };
}

// --- New documents ----------------------------------------------------------

/** The font Word sets the Chinese characters of a run in: its own, or the font of the run when that is one for Chinese. */
function eastAsiaFont(p: ResolvedRunProps): string | undefined {
  return p.fontEastAsia || (isCjkFont(p.fontFamily) ? p.fontFamily : undefined);
}

function runPropsXml(props: RunProps): string {
  const p = resolveRun(props);
  const font = escapeXml(p.fontFamily);
  const size = Math.round(p.fontSize * 2);
  return (
    '<w:rPr>' +
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}"${eastAsiaFont(p) ? ` w:eastAsia="${escapeXml(eastAsiaFont(p)!)}"` : ''} w:cs="${font}"/>` +
    (p.bold ? '<w:b/>' : '') +
    (p.italic ? '<w:i/>' : '') +
    (p.strike ? '<w:strike/>' : '') +
    `<w:color w:val="${escapeXml(p.color)}"/>` +
    // Kerning when the run says so itself; what a document without styles does, Word does without being told.
    (props.kern ? `<w:kern w:val="${Math.round(props.kern * 2)}"/>` : '') +
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` +
    (highlightName(p.highlight) === 'none' ? '' : `<w:highlight w:val="${highlightName(p.highlight)}"/>`) +
    (p.underline ? '<w:u w:val="single"/>' : '') +
    rPrChangeXml(props) +
    '</w:rPr>'
  );
}

/** The change of formatting of a run, as Word keeps one: who, when, and its formatting before. */
function rPrChangeXml(props: RunProps): string {
  const change = props.formatChange;
  return change ? `<w:rPrChange${revisionAttrs(change.author, change.date)}>${runPropsXml(change.before)}</w:rPrChange>` : '';
}

/** The change of formatting of a paragraph, as Word keeps one. */
function pPrChangeXml(props: ParagraphProps): string {
  const change = props.formatChange;
  return change ? `<w:pPrChange${revisionAttrs(change.author, change.date)}><w:pPr>${paragraphFormatXml(resolveParagraph(change.before))}</w:pPr></w:pPrChange>` : '';
}

function runXml(run: Run): string {
  // Objects only make sense inside the package they came from, but for what was put in here: pictures, notes, stretches that may be changed and the marks of a table of contents.
  if (run.props.object) {
    const ours =
      mediaKey(run.props.object) !== undefined ||
      !!noteMark(run.props.object) ||
      !!editableMark(run.props.object) ||
      isFieldMark(run.props.object) ||
      isColumnBreak(run.props.object) ||
      footnoteReferenceId(run.props.object) !== undefined ||
      isFootnoteMark(run.props.object) ||
      endnoteReferenceId(run.props.object) !== undefined ||
      isEndnoteMark(run.props.object) ||
      textBoxId(run.props.object) !== undefined;
    return ours ? freshBoxXml(run.props.object).repeat(run.text.length) : '';
  }
  if (!run.text) return '';
  const rPr = runPropsXml(run.props);
  const deleted = run.props.revision === 'delete';
  if (!run.props.field) return `<w:r>${rPr}${textXml(run.text, deleted)}</w:r>`;
  // The result of a field, with the marks and the code that make it one.
  const mark = (type: string) => `<w:r>${rPr}<w:fldChar w:fldCharType="${type}"/></w:r>`;
  const instr = deleted ? 'w:delInstrText' : 'w:instrText';
  return (
    mark('begin') + `<w:r>${rPr}<${instr} xml:space="preserve"> ${escapeXml(run.props.field)} </${instr}></w:r>` + mark('separate') + `<w:r>${rPr}${textXml(run.text, deleted)}</w:r>` + mark('end')
  );
}

/** A right tab stop with a dotted leader, `at` points from the left edge of the text. */
const leaderTabXml = (at: number) => `<w:tab w:val="right" w:leader="dot" w:pos="${twips(at)}"/>`;

const sameTab = (a: TabStop, b: TabStop) => Math.abs(a.pos - b.pos) < 0.5 && a.align === b.align && a.leader === b.leader;

/**
 * The `w:tabs` of a paragraph with its leader tab and these stops, over the
 * ones its style has: the stops the style lacks, and a clearing one for each
 * of the style's the paragraph does not have. Empty when there is nothing to say.
 */
function tabsXml(leaderTab: number, tabs: TabStop[], style: TabStop[] = []): string {
  const own = tabs.filter((tab) => !style.some((s) => sameTab(s, tab)));
  const cleared = style.filter((s) => !tabs.some((tab) => sameTab(s, tab)) && !(leaderTab > 0 && Math.abs(s.pos - leaderTab) < 0.5));
  const stops = [
    ...cleared.map((s) => ({ pos: s.pos, xml: `<w:tab w:val="clear" w:pos="${twips(s.pos)}"/>` })),
    ...own.map((tab) => ({ pos: tab.pos, xml: `<w:tab w:val="${tab.align}"${tab.leader ? ` w:leader="${tab.leader}"` : ''} w:pos="${twips(tab.pos)}"/>` })),
    ...(leaderTab > 0 ? [{ pos: leaderTab, xml: leaderTabXml(leaderTab) }] : []),
  ].sort((a, b) => a.pos - b.pos);
  return stops.length ? `<w:tabs>${stops.map((stop) => stop.xml).join('')}</w:tabs>` : '';
}

/** The formatting of a paragraph, as the first children of its `w:pPr`. */
function paragraphFormatXml(p: ResolvedParagraphProps): string {
  const firstLine = p.indentFirstLine < 0 ? ` w:hanging="${twips(-p.indentFirstLine)}"` : ` w:firstLine="${twips(p.indentFirstLine)}"`;
  const jc = p.align === 'justify' ? 'both' : p.align;
  return (
    (p.styleId ? `<w:pStyle w:val="${escapeXml(p.styleId)}"/>` : '') +
    (p.keepNext ? '<w:keepNext/>' : '') +
    (p.keepLines ? '<w:keepLines/>' : '') +
    (p.pageBreakBefore ? '<w:pageBreakBefore/>' : '') +
    // Widow and orphan control is on unless a paragraph switches it off.
    (p.widowControl ? '' : '<w:widowControl w:val="0"/>') +
    (p.numId ? numPrXml(p.numId, p.listLevel) : '') +
    tabsXml(p.leaderTab, p.tabs) +
    `<w:spacing w:before="${twips(p.spacingBefore)}" w:after="${twips(p.spacingAfter)}"` +
    ` w:line="${Math.round(p.lineHeight * 240)}" w:lineRule="auto"/>` +
    `<w:ind w:left="${twips(p.indentLeft)}" w:right="${twips(p.indentRight)}"${firstLine}/>` +
    `<w:jc w:val="${jc}"/>`
  );
}

function paragraphXml(para: Paragraph): string {
  const p = resolveParagraph(para.props);
  const isEmpty = para.runs.every((r) => !r.text);
  return (
    '<w:p><w:pPr>' +
    paragraphFormatXml(p) +
    // The paragraph mark carries the formatting of an empty paragraph, and the change that put it in or took it out.
    (isEmpty ? runPropsXml(para.runs[0].props).replace('<w:rPr>', `<w:rPr>${markRevisionXml(para.props)}`) : markRevisionXml(para.props) ? `<w:rPr>${markRevisionXml(para.props)}</w:rPr>` : '') +
    (para.section ? sectionXml(para.section) : '') +
    pPrChangeXml(para.props) +
    '</w:pPr>' +
    wrappedRunsXml(para.runs) +
    '</w:p>'
  );
}

/** The runs of a paragraph written from the model, each stretch inside the wrapper it has: the link of an entry of a table of contents. */
function wrappedRunsXml(runs: Run[]): string {
  let out = '';
  let wrap = '';
  const revision = revisionWriter();
  const close = () => revision.close() + (wrap ? wrap.split(WRAP_SEPARATOR)[1] : '');
  for (const run of runs) {
    if (!run.text) continue;
    const next = run.props.wrap ?? '';
    if (next !== wrap) {
      out += close();
      wrap = next;
      if (wrap) out += wrap.split(WRAP_SEPARATOR)[0];
    }
    out += revision.open(run.props) + runXml(run);
  }
  return out + close();
}

// --- Tables written from the model ---------------------------------------------

const TCPR_ORDER = ['w:cnfStyle', 'w:tcW', 'w:gridSpan', 'w:hMerge', 'w:vMerge', 'w:tcBorders', 'w:shd', 'w:noWrap', 'w:tcMar', 'w:textDirection', 'w:tcFitText', 'w:vAlign', 'w:hideMark'];

const TBLPR_ORDER = [
  'w:tblStyle',
  'w:tblpPr',
  'w:tblOverlap',
  'w:bidiVisual',
  'w:tblStyleRowBandSize',
  'w:tblStyleColBandSize',
  'w:tblW',
  'w:jc',
  'w:tblCellSpacing',
  'w:tblInd',
  'w:tblBorders',
  'w:shd',
  'w:tblLayout',
  'w:tblCellMar',
  'w:tblLook',
];

const cellKey = (table: number, row: number, cell: number) => `${table}:${row}:${cell}`;

/** The paragraphs of every table cell of the document, by table, row id and cell id: those of a table in a cell among the cell's. */
function paragraphsByCell(doc: Doc): Map<string, Paragraph[]> {
  const map = new Map<string, Paragraph[]>();
  for (const para of doc.paragraphs) {
    for (let at = para.cell, depth = 0; at && depth < 32; at = doc.tables?.[at.table]?.parent, depth++) {
      const key = cellKey(at.table, at.row, at.cell);
      const list = map.get(key);
      if (list) list.push(para);
      else map.set(key, [para]);
    }
  }
  return map;
}

/** The table, inside table `table`, that a paragraph of one of its cells is in at the first level down; undefined for the cell's own paragraphs. */
function nestedIn(doc: Doc, para: Paragraph, table: number): number | undefined {
  for (let at = para.cell, depth = 0; at && depth < 32; depth++) {
    const parent = doc.tables?.[at.table]?.parent;
    if (!parent) return undefined;
    if (parent.table === table) return at.table;
    at = parent;
  }
  return undefined;
}

function border(side: string): string {
  return `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`;
}

/** One side of a cell as `w:tcBorders` has it: its line, or none. */
function sideXml(side: string, line: Border | undefined): string {
  if (!line) return `<w:${side} w:val="nil"/>`;
  return `<w:${side} w:val="${line.style}" w:sz="${Math.max(2, Math.round(line.width * 8))}" w:space="0" w:color="${line.color}"/>`;
}

/** The lines of a cell: its own, the plain ones of a cell with borders, or none. */
function cellLines(cell: TableCell): CellLines {
  return cell.lines ?? (cell.borders ? { top: DEFAULT_BORDER, left: DEFAULT_BORDER, bottom: DEFAULT_BORDER, right: DEFAULT_BORDER } : {});
}

/** What a cell's borders are, to tell whether they changed. */
const bordersKey = (cell: TableCell) => JSON.stringify(cellLines(cell));

/** `w:trPr` with what the model says of a row on top of what the file had: its height, and whether it is a heading or must not be split. */
function patchRow(trPr: XmlNode, row: TableRow): void {
  trPr.children = trPr.children.filter((c) => c.name !== 'w:trHeight' && c.name !== 'w:cantSplit' && c.name !== 'w:tblHeader' && c.name !== 'w:ins' && c.name !== 'w:del');
  // Put in or taken out while changes were tracked, as the model says now.
  if (row.revision) insertOrdered(trPr, TRPR_ORDER, parseElement(`<${row.revision.type === 'insert' ? 'w:ins' : 'w:del'}${revisionAttrs(row.revision.author, row.revision.date)}/>`)!);
  if (row.cantSplit) insertOrdered(trPr, TRPR_ORDER, createNode('w:cantSplit'));
  if (row.height) insertOrdered(trPr, TRPR_ORDER, createNode('w:trHeight', row.exact ? { 'w:val': String(twips(row.height)), 'w:hRule': 'exact' } : { 'w:val': String(twips(row.height)) }));
  if (row.header) insertOrdered(trPr, TRPR_ORDER, createNode('w:tblHeader'));
}

const TRPR_ORDER = [
  'w:cnfStyle',
  'w:divId',
  'w:gridBefore',
  'w:gridAfter',
  'w:wBefore',
  'w:wAfter',
  'w:cantSplit',
  'w:trHeight',
  'w:tblHeader',
  'w:tblCellSpacing',
  'w:jc',
  'w:hidden',
  'w:ins',
  'w:del',
  'w:trPrChange',
];

/**
 * A table written from the model. When it was read from a file (`from`), the
 * properties of the table, of each row and of each cell that still exists are
 * taken from there, so what the model does not interpret survives; rows and
 * cells added since take theirs from the nearest one that has them.
 */
function tableXml(doc: Doc, tableIndex: number, cellContent: (row: TableRow, cell: TableCell) => string, from?: { xml: string; node: XmlNode; original?: Table }): string {
  const table = doc.tables![tableIndex];
  const slice = (node: XmlNode) => from!.xml.slice(node.start, node.end);
  const rowNodes = from ? childrenOf(from.node, 'w:tr') : [];
  const tblPr = from && child(from.node, 'w:tblPr');
  const total = table.columns.reduce((a, b) => a + b, 0);
  const anyBorders = table.rows.some((row) => row.cells.some((cell) => cell.borders));

  let out = from ? from.xml.slice(from.node.start, from.node.openEnd) : '<w:tbl>';
  /** The properties the table had, with its width made the sum of its columns when they were given by hand. */
  const ownTblPr = () => {
    const was = from?.original;
    const resized = was && (was.widthFraction !== table.widthFraction || was.fixed !== table.fixed) && !table.widthFraction;
    if (!resized) return slice(tblPr!);
    const node = parseElement(slice(tblPr!))!;
    patchChild(node, TBLPR_ORDER, 'w:tblW', { 'w:w': String(twips(total)), 'w:type': 'dxa' });
    patchChild(node, TBLPR_ORDER, 'w:tblLayout', { 'w:type': 'fixed' });
    return serializeXml(node);
  };
  out += tblPr
    ? ownTblPr()
    : '<w:tblPr>' +
      `<w:tblW w:w="${twips(total)}" w:type="dxa"/>` +
      (table.align === 'left' ? '' : `<w:jc w:val="${table.align}"/>`) +
      (table.indent ? `<w:tblInd w:w="${twips(table.indent)}" w:type="dxa"/>` : '') +
      (anyBorders ? `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders>` : '') +
      '<w:tblLayout w:type="fixed"/>' +
      '<w:tblCellMar>' +
      `<w:top w:w="${twips(table.padTop)}" w:type="dxa"/><w:left w:w="${twips(table.padLeft)}" w:type="dxa"/>` +
      `<w:bottom w:w="${twips(table.padBottom)}" w:type="dxa"/><w:right w:w="${twips(table.padRight)}" w:type="dxa"/>` +
      '</w:tblCellMar></w:tblPr>';
  out += `<w:tblGrid>${table.columns.map((w) => `<w:gridCol w:w="${twips(w)}"/>`).join('')}</w:tblGrid>`;

  // A row added since takes its properties from the row before it that has some, or the first after it.
  let model = table.rows.map((row) => rowNodes[row.id]).find((node) => node);
  for (const row of table.rows) {
    const own = rowNodes[row.id];
    model = own ?? model;
    out += own ? from!.xml.slice(own.start, own.openEnd) : '<w:tr>';
    const wasRow = from?.original?.rows.find((r) => r.id === row.id);
    const rowKey = (r: TableRow) => `${r.height}:${!!r.exact}:${!!r.cantSplit}:${!!r.header}:${JSON.stringify(r.revision ?? null)}`;
    if (model) {
      out += model.children
        .filter((c) => c.name === 'w:tblPrEx')
        .map(slice)
        .join('');
      const kept = child(model, 'w:trPr');
      // The row's properties as the file had them, unless the ones the model has changed.
      if (own && wasRow && rowKey(wasRow) === rowKey(row)) out += kept ? slice(kept) : '';
      else {
        const trPr = (kept && parseElement(slice(kept))) ?? createNode('w:trPr');
        patchRow(trPr, row);
        if (trPr.children.length) out += serializeXml(trPr);
      }
    } else if (row.before || row.height || row.cantSplit || row.header || row.revision) {
      const trPr = createNode('w:trPr');
      if (row.before) insertOrdered(trPr, TRPR_ORDER, createNode('w:gridBefore', { 'w:val': String(row.before) }));
      patchRow(trPr, row);
      out += serializeXml(trPr);
    }
    const cellNodes = model ? childrenOf(model, 'w:tc') : [];
    let column = row.before;
    row.cells.forEach((cell, i) => {
      const like = cellNodes[cell.id] ?? cellNodes[Math.min(i, cellNodes.length - 1)];
      const source = like && child(like, 'w:tcPr');
      const tcPr = (source && parseElement(slice(source))) ?? createNode('w:tcPr');
      const width = table.columns.slice(column, column + cell.span).reduce((a, b) => a + b, 0);
      column += cell.span;
      patchChild(tcPr, TCPR_ORDER, 'w:tcW', { 'w:w': String(twips(width)), 'w:type': 'dxa' });
      tcPr.children = tcPr.children.filter((c) => c.name !== 'w:gridSpan' && c.name !== 'w:vMerge');
      if (cell.span > 1) insertOrdered(tcPr, TCPR_ORDER, createNode('w:gridSpan', { 'w:val': String(cell.span) }));
      if (cell.merge) insertOrdered(tcPr, TCPR_ORDER, createNode('w:vMerge', cell.merge === 'start' ? { 'w:val': 'restart' } : {}));
      // The cell as the file had it, to write only the borders and the shading that changed.
      const was = from?.original?.rows.find((r) => r.id === row.id)?.cells.find((c) => c.id === cell.id);
      if (from ? was && bordersKey(was) !== bordersKey(cell) : (anyBorders && !cell.borders) || cell.lines) {
        tcPr.children = tcPr.children.filter((c) => c.name !== 'w:tcBorders');
        const lines = cellLines(cell);
        const sides = (['top', 'left', 'bottom', 'right'] as const).map((side) => sideXml(side, lines[side]));
        insertOrdered(tcPr, TCPR_ORDER, parseElement(`<w:tcBorders>${sides.join('')}</w:tcBorders>`)!);
      }
      if (from ? was && was.valign !== cell.valign : cell.valign) {
        tcPr.children = tcPr.children.filter((c) => c.name !== 'w:vAlign');
        if (cell.valign) insertOrdered(tcPr, TCPR_ORDER, createNode('w:vAlign', { 'w:val': cell.valign }));
        else if (was?.valign) insertOrdered(tcPr, TCPR_ORDER, createNode('w:vAlign', { 'w:val': 'top' }));
      }
      if (from ? was && was.direction !== cell.direction : cell.direction) {
        tcPr.children = tcPr.children.filter((c) => c.name !== 'w:textDirection');
        if (cell.direction) insertOrdered(tcPr, TCPR_ORDER, createNode('w:textDirection', { 'w:val': cell.direction === 'up' ? 'btLr' : 'tbRl' }));
      }
      if (from ? was && was.shade !== cell.shade : cell.shade) {
        tcPr.children = tcPr.children.filter((c) => c.name !== 'w:shd');
        if (cell.shade) insertOrdered(tcPr, TCPR_ORDER, createNode('w:shd', { 'w:val': 'clear', 'w:color': 'auto', 'w:fill': cell.shade }));
      }
      // A cell must hold at least one paragraph.
      out += `<w:tc>${serializeXml(tcPr)}${cellContent(row, cell) || '<w:p/>'}</w:tc>`;
    });
    out += '</w:tr>';
  }
  return `${out}</w:tbl>`;
}

// Child order the schema requires inside w:sectPr.
const SECTPR_ORDER = [
  'w:headerReference',
  'w:footerReference',
  'w:footnotePr',
  'w:endnotePr',
  'w:type',
  'w:pgSz',
  'w:pgMar',
  'w:paperSrc',
  'w:pgBorders',
  'w:lnNumType',
  'w:pgNumType',
  'w:cols',
  'w:formProt',
  'w:vAlign',
  'w:noEndnote',
  'w:titlePg',
  'w:textDirection',
  'w:bidi',
  'w:rtlGutter',
  'w:docGrid',
  'w:printerSettings',
  'w:sectPrChange',
];

/**
 * Section properties with the size and margins of `page`, on top of whatever
 * else `original` says, and referring to the header and footer in `refs`.
 * `declare` adds the namespace of the reference ids, for a document that lacks it.
 */
function pageSectPr(
  page: Doc['page'],
  original?: string,
  refs: StoryRefs = {},
  declare = false,
  ownFirst?: boolean,
  layout?: { columns?: Columns; start?: SectionStart; noEndnotes?: boolean; endnoteNumbering?: NoteNumbering; footnoteNumbering?: NoteNumbering },
): string {
  const sectPr = (original ? parseElement(original) : undefined) ?? createNode('w:sectPr');
  if (layout) {
    // Where the section starts and its columns, as the model has them.
    sectPr.children = sectPr.children.filter((c) => c.name !== 'w:type' && c.name !== 'w:cols');
    if (layout.start && layout.start !== 'nextPage') insertOrdered(sectPr, SECTPR_ORDER, createNode('w:type', { 'w:val': layout.start }));
    insertOrdered(sectPr, SECTPR_ORDER, parseElement(colsXml(layout.columns))!);
    sectPr.children = sectPr.children.filter((c) => c.name !== 'w:noEndnote');
    if (layout.noEndnotes) insertOrdered(sectPr, SECTPR_ORDER, createNode('w:noEndnote'));
    writeNoteNumbering(sectPr, 'w:footnotePr', layout.footnoteNumbering);
    writeNoteNumbering(sectPr, 'w:endnotePr', layout.endnoteNumbering);
  }
  // Whether the first page has a header and a footer of its own is said by the section, parts or no parts.
  if (ownFirst !== undefined) {
    sectPr.children = sectPr.children.filter((c) => c.name !== 'w:titlePg');
    if (ownFirst) insertOrdered(sectPr, SECTPR_ORDER, createNode('w:titlePg'));
    // Given one now, it starts with nothing: a header the section named for a first page it did not have is not it.
    if (ownFirst) sectPr.children = sectPr.children.filter((c) => !/^w:(header|footer)Reference$/.test(c.name) || c.attrs['w:type'] !== 'first');
  }
  for (const name of ['firstFooter', 'firstHeader', 'footer', 'header'] as const) {
    const id = refs[name];
    if (!id) continue;
    const { reference } = STORY_PARTS[storyKind(name)];
    // The one every page shows, or the first page's own: it takes the place of any the section already named as such.
    const type = name === storyKind(name) ? 'default' : 'first';
    sectPr.children = sectPr.children.filter((c) => c.name !== reference || (c.attrs['w:type'] ?? 'default') !== type);
    const attrs: Record<string, string> = { 'w:type': type, 'r:id': id };
    if (declare) attrs['xmlns:r'] = R_NS;
    sectPr.children.unshift(createNode(reference, attrs));
    // A first page with a part of its own is one the section says is different.
    if (type === 'first' && !child(sectPr, 'w:titlePg')) insertOrdered(sectPr, SECTPR_ORDER, createNode('w:titlePg'));
  }
  // A page wider than tall has to say so, or Word prints it turned.
  const size: Record<string, string> = { 'w:w': String(twips(page.width)), 'w:h': String(twips(page.height)) };
  if (page.width > page.height) size['w:orient'] = 'landscape';
  patchChild(sectPr, SECTPR_ORDER, 'w:pgSz', size, ['w:orient']);
  const margins: Record<string, string> = {
    'w:top': String(twips(page.marginTop)),
    'w:right': String(twips(page.marginRight)),
    'w:bottom': String(twips(page.marginBottom)),
    'w:left': String(twips(page.marginLeft)),
    'w:header': String(twips(page.headerDistance ?? 35.4)),
    'w:footer': String(twips(page.footerDistance ?? 35.4)),
  };
  const existing = child(sectPr, 'w:pgMar');
  if (!existing?.attrs['w:gutter']) margins['w:gutter'] = '0';
  patchChild(sectPr, SECTPR_ORDER, 'w:pgMar', margins);
  return serializeXml(sectPr);
}

/** The numbering of a section's notes in its `w:footnotePr` or `w:endnotePr`, in place of what it said of it; whatever else it says stays. */
function writeNoteNumbering(sectPr: XmlNode, name: 'w:footnotePr' | 'w:endnotePr', numbering: NoteNumbering | undefined): void {
  let props = child(sectPr, name);
  if (!props && !numbering) return;
  if (!props) insertOrdered(sectPr, SECTPR_ORDER, (props = createNode(name)));
  const order = ['w:pos', 'w:numFmt', 'w:numStart', 'w:numRestart', 'w:footnote', 'w:endnote'];
  props.children = props.children.filter((c) => !['w:numFmt', 'w:numStart', 'w:numRestart'].includes(c.name));
  if (numbering?.format) insertOrdered(props, order, createNode('w:numFmt', { 'w:val': numbering.format }));
  if (numbering?.start) insertOrdered(props, order, createNode('w:numStart', { 'w:val': String(numbering.start) }));
  if (numbering?.restart) insertOrdered(props, order, createNode('w:numRestart', { 'w:val': numbering.restart === 'page' ? 'eachPage' : 'eachSect' }));
  if (!props.children.some((c) => c.name !== '#text')) sectPr.children = sectPr.children.filter((c) => c !== props);
}

function newDocumentXml(doc: Doc, refs: StoryRefs = {}, lastSection: (sectPr: string) => string = (x) => x): string {
  const pg = doc.page;
  const blocks = blocksXml(doc);
  return (
    XML_HEADER +
    `<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:body>` +
    blocks +
    lastSection(
      pageSectPr(pg, undefined, refs, false, doc.firstPage ? true : undefined, {
        columns: doc.columns,
        start: doc.sectionStart,
        endnoteNumbering: doc.endnoteNumbering,
        footnoteNumbering: doc.footnoteNumbering,
      }),
    ) +
    '</w:body></w:document>'
  );
}

/** `w:cols` for the columns of a section; one, as wide as the text, when it has none. */
function colsXml(columns: Columns | undefined): string {
  if (!columns || columns.count < 2) return '<w:cols w:space="720"/>';
  const sep = columns.separator ? ' w:sep="1"' : '';
  if (!columns.widths?.length) return `<w:cols w:num="${columns.count}" w:space="${twips(columns.space)}"${sep}/>`;
  const each = columns.widths.map((col, i) => `<w:col w:w="${twips(col.width)}"${i < columns.widths!.length - 1 ? ` w:space="${twips(col.space)}"` : ''}/>`).join('');
  return `<w:cols w:num="${columns.widths.length}" w:space="${twips(columns.space)}"${sep} w:equalWidth="0">${each}</w:cols>`;
}

/** The properties of a section that is not the last: what it had in the file, with what the model says of its page, its columns and its start. */
function sectionXml(section: Section): string {
  return (
    sectionProps?.get(section) ??
    pageSectPr(section.page, section.xml, {}, false, undefined, {
      columns: section.columns,
      start: section.start,
      noEndnotes: section.noEndnotes,
      endnoteNumbering: section.endnoteNumbering,
      footnoteNumbering: section.footnoteNumbering,
    })
  );
}

/**
 * While a document of several sections whose sections changed is written: the
 * properties each section before the last is written with, every one naming
 * its header and footer, so that none goes on to show the one before it.
 */
let sectionProps: Map<Section, string> | undefined;

/** The ids of the parts a section names, by the part each is. */
type SectionRefs = Partial<Record<BasePart, string>>;

/** Section properties naming the headers and the footers of `refs` and no others; with `titlePg` for a first page of its own. */
function withRefs(sectPrXml: string, refs: SectionRefs, titlePg: boolean, declare: boolean): string {
  const sectPr = parseElement(sectPrXml)!;
  sectPr.children = sectPr.children.filter((c) => !/^w:(header|footer)Reference$/.test(c.name) && c.name !== 'w:titlePg');
  const named: XmlNode[] = [];
  for (const base of ['header', 'footer', 'firstHeader', 'firstFooter'] as const) {
    const id = refs[base];
    if (!id) continue;
    const attrs: Record<string, string> = { 'w:type': base === storyKind(base) ? 'default' : 'first', 'r:id': id };
    if (declare) attrs['xmlns:r'] = R_NS;
    named.push(createNode(STORY_PARTS[storyKind(base)].reference, attrs));
  }
  sectPr.children.unshift(...named);
  if (titlePg) insertOrdered(sectPr, SECTPR_ORDER, createNode('w:titlePg'));
  return serializeXml(sectPr);
}

/**
 * For a document of several sections whose sections are not as they were
 * read: writes the headers and footers the sections have of their own, works
 * out what each section names, and returns how to write the last one's.
 * Undefined when the sections can be written as they were.
 */
function writeSections(doc: Doc, files: Record<string, Uint8Array>, mainPath: string, source: DocxSource | undefined, refs: StoryRefs): ((sectPr: string) => string) | undefined {
  const ends = sectionEnds(doc);
  if (!ends.length) return undefined;
  if (source) {
    const read = source.slots.filter((slot) => slot.paragraph.section && !slot.paragraph.cell).length;
    const same =
      read === ends.length &&
      ends.every((i) => {
        const p = doc.paragraphs[i];
        return p.origin !== undefined && source.slots[p.origin]?.paragraph.section === p.section;
      });
    if (same) return undefined;
  }
  const dir = mainPath.slice(0, mainPath.lastIndexOf('/') + 1);
  const ids = new Map<string, string>();
  if (source) for (const [id, path] of relationships(source)) ids.set(path, id);
  const finish = (path: string, xml: string) => writeLinks(files, path, writeMedia(doc, files, path, xml));
  const newPart = (kind: 'header' | 'footer', blocks: string) => {
    const part = STORY_PARTS[kind];
    const xml = `${XML_HEADER}<${part.root} xmlns:w="${W_NS}" xmlns:r="${R_NS}">${blocks}${!blocks || blocks.endsWith('</w:tbl>') ? '<w:p/>' : ''}</${part.root}>`;
    let n = 1;
    while (files[`${dir}${kind}${n}.xml`]) n++;
    return addPart(files, mainPath, `${kind}${n}.xml`, part.rel, part.type, finish(`${dir}${kind}${n}.xml`, xml));
  };

  // The parts of the file that still hold what was read from them, which no changed header may be written over.
  const kept = new Set<string>();
  for (const base of ALL_STORIES) {
    const from = source?.[`${base}Source`];
    if (from) kept.add(from.path);
  }
  ends.forEach((_, k) => {
    for (const base of ALL_STORIES) {
      const part = sectionPart(base, k);
      const from = storySource(doc, part);
      if (from && from.story === storyOf(doc, part)) kept.add(from.path);
    }
  });
  // The sections' own headers and footers: as they were, written over their part, or in a part of their own.
  const own = new Map<Story, string>();
  ends.forEach((_, k) => {
    for (const base of ALL_STORIES) {
      const part = sectionPart(base, k);
      const story = storyOf(doc, part);
      if (!story?.paragraphs.length || own.has(story)) continue;
      const from = storySource(doc, part);
      const id = from && ids.get(from.path);
      if (from && id && from.story === story) {
        own.set(story, id);
      } else if (from && id && !kept.has(from.path) && from.root.openEnd !== from.root.end) {
        files[from.path] = strToU8(finish(from.path, storyXml(doc, story, from, source!)));
        kept.add(from.path);
        own.set(story, id);
      } else {
        own.set(story, newPart(storyKind(base), blocksXml(storyView(doc, story))));
      }
    }
  });
  // The document's: the last section's, which the others without their own show.
  const docId = (base: BasePart) => {
    if (!storyOf(doc, base)?.paragraphs.length) return undefined;
    const path = source?.[`${base}Path`];
    return refs[base] ?? (path ? ids.get(path) : undefined);
  };
  const empties: Partial<Record<'header' | 'footer', string>> = {};
  const empty = (kind: 'header' | 'footer') => (empties[kind] ??= newPart(kind, ''));
  /** What a section names; one that shows nothing after one that names something names an empty part, as it would show that one otherwise. */
  const shown = { header: false, footer: false, firstHeader: false, firstFooter: false };
  const namesOf = (holder: { header?: Story; footer?: Story; firstPage?: { header?: Story; footer?: Story }; noHeader?: boolean; noFooter?: boolean }, last: boolean): SectionRefs => {
    const out: SectionRefs = {};
    for (const kind of ['header', 'footer'] as const) {
      const mine = last ? undefined : holder[kind];
      const none = kind === 'header' ? holder.noHeader : holder.noFooter;
      let id = mine ? own.get(mine) : none ? undefined : docId(kind);
      if (!id && shown[kind]) id = empty(kind);
      if (id) shown[kind] = true;
      out[kind] = id;
      if (holder.firstPage) {
        const first = holder.firstPage[kind];
        const base = kind === 'header' ? 'firstHeader' : 'firstFooter';
        let firstId = first ? (last ? docId(base) : own.get(first)) : undefined;
        if (!firstId && shown[base]) firstId = empty(kind);
        if (firstId) shown[base] = true;
        out[base] = firstId;
      }
    }
    return out;
  };
  const declare = !!source && !/\sxmlns:r=/.test(source.xml.slice(0, source.body.start));
  sectionProps = new Map();
  for (const i of ends) {
    const section = doc.paragraphs[i].section!;
    const base = pageSectPr(section.page, section.xml, {}, false, undefined, {
      columns: section.columns,
      start: section.start,
      noEndnotes: section.noEndnotes,
      endnoteNumbering: section.endnoteNumbering,
      footnoteNumbering: section.footnoteNumbering,
    });
    sectionProps.set(section, withRefs(base, namesOf(section, false), !!section.firstPage, declare));
  }
  const last = namesOf(doc, true);
  return (sectPr) => withRefs(sectPr, last, !!doc.firstPage, declare);
}

const sameColumns = (a: Columns | undefined, b: Columns | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Whether two sections are set out the same, whatever their objects. */
function sameSection(a: Section, b: Section): boolean {
  const page = (Object.keys({ ...a.page, ...b.page }) as (keyof Doc['page'])[]).every((key) => a.page[key] === b.page[key]);
  return page && sameColumns(a.columns, b.columns) && (a.start ?? 'nextPage') === (b.start ?? 'nextPage');
}

// --- Documents read from a DOCX ---------------------------------------------

// Child order the schema requires inside w:pPr and w:rPr.
const PPR_ORDER = [
  'w:pStyle',
  'w:keepNext',
  'w:keepLines',
  'w:pageBreakBefore',
  'w:framePr',
  'w:widowControl',
  'w:numPr',
  'w:suppressLineNumbers',
  'w:pBdr',
  'w:shd',
  'w:tabs',
  'w:suppressAutoHyphens',
  'w:kinsoku',
  'w:wordWrap',
  'w:overflowPunct',
  'w:topLinePunct',
  'w:autoSpaceDE',
  'w:autoSpaceDN',
  'w:bidi',
  'w:adjustRightInd',
  'w:snapToGrid',
  'w:spacing',
  'w:ind',
  'w:contextualSpacing',
  'w:mirrorIndents',
  'w:suppressOverlap',
  'w:jc',
  'w:textDirection',
  'w:textAlignment',
  'w:textboxTightWrap',
  'w:outlineLvl',
  'w:divId',
  'w:cnfStyle',
  'w:rPr',
  'w:sectPr',
  'w:pPrChange',
];
const RPR_ORDER = [
  'w:rStyle',
  'w:rFonts',
  'w:b',
  'w:bCs',
  'w:i',
  'w:iCs',
  'w:caps',
  'w:smallCaps',
  'w:strike',
  'w:dstrike',
  'w:outline',
  'w:shadow',
  'w:emboss',
  'w:imprint',
  'w:noProof',
  'w:snapToGrid',
  'w:vanish',
  'w:webHidden',
  'w:color',
  'w:spacing',
  'w:w',
  'w:kern',
  'w:position',
  'w:sz',
  'w:szCs',
  'w:highlight',
  'w:u',
  'w:effect',
  'w:bdr',
  'w:shd',
  'w:fitText',
  'w:vertAlign',
  'w:rtl',
  'w:cs',
  'w:em',
  'w:lang',
  'w:eastAsianLayout',
  'w:specVanish',
  'w:oMath',
  'w:rPrChange',
];
// Tracked-change marks that are valid on a paragraph mark but not on a run.
const MARK_ONLY = new Set(['w:ins', 'w:del', 'w:moveFrom', 'w:moveTo']);

function orderOf(order: string[], name: string): number {
  const index = order.indexOf(name);
  return index < 0 ? order.length : index;
}

function insertOrdered(parent: XmlNode, order: string[], node: XmlNode): void {
  const rank = orderOf(order, node.name);
  const at = parent.children.findIndex((c) => c.name !== '#text' && orderOf(order, c.name) > rank);
  parent.children.splice(at < 0 ? parent.children.length : at, 0, node);
}

/** Sets attributes on a child element, creating it at its schema position if missing. */
function patchChild(parent: XmlNode, order: string[], name: string, set: Record<string, string>, remove: string[] = []): void {
  let node = child(parent, name);
  if (!node) {
    node = createNode(name);
    insertOrdered(parent, order, node);
  }
  for (const key of remove) delete node.attrs[key];
  Object.assign(node.attrs, set);
}

function patchToggle(parent: XmlNode, order: string[], name: string, on: boolean): void {
  if (on) patchChild(parent, order, name, {}, ['w:val']);
  else patchChild(parent, order, name, { 'w:val': '0' });
}

/**
 * The run's original w:rPr with only the properties that differ from what it
 * resolved to on import rewritten, so style and theme links survive.
 */
function patchedRunProps(source: DocxSource, base: RunProps, props: RunProps, forMark: boolean): XmlNode {
  const rPr = parseElement(`<w:rPr>${props.opaque ?? ''}</w:rPr>`) ?? createNode('w:rPr');
  if (!forMark) rPr.children = rPr.children.filter((c) => !MARK_ONLY.has(c.name));

  const charStyle = resolveStyle(source.sheet, val(child(rPr, 'w:rStyle'))).rPr;
  const before: ResolvedRunProps = resolveRun({ ...base, ...charStyle, ...parseRunProps(rPr) });
  const now = resolveRun(props);

  if (now.bold !== before.bold) {
    patchToggle(rPr, RPR_ORDER, 'w:b', now.bold);
    patchToggle(rPr, RPR_ORDER, 'w:bCs', now.bold);
  }
  if (now.italic !== before.italic) {
    patchToggle(rPr, RPR_ORDER, 'w:i', now.italic);
    patchToggle(rPr, RPR_ORDER, 'w:iCs', now.italic);
  }
  if (now.strike !== before.strike) patchToggle(rPr, RPR_ORDER, 'w:strike', now.strike);
  if (now.underline !== before.underline) {
    patchChild(rPr, RPR_ORDER, 'w:u', { 'w:val': now.underline ? 'single' : 'none' });
  }
  if (now.fontSize !== before.fontSize) {
    const size = String(Math.round(now.fontSize * 2));
    patchChild(rPr, RPR_ORDER, 'w:sz', { 'w:val': size });
    patchChild(rPr, RPR_ORDER, 'w:szCs', { 'w:val': size });
  }
  if (now.kern !== before.kern) {
    if (now.kern) patchChild(rPr, RPR_ORDER, 'w:kern', { 'w:val': String(Math.round(now.kern * 2)) });
    else rPr.children = rPr.children.filter((c) => c.name !== 'w:kern');
  }
  if (now.highlight !== before.highlight) patchChild(rPr, RPR_ORDER, 'w:highlight', { 'w:val': highlightName(now.highlight) });
  if (now.color !== before.color) {
    patchChild(rPr, RPR_ORDER, 'w:color', { 'w:val': now.color }, ['w:themeColor', 'w:themeTint', 'w:themeShade']);
  }
  if (now.fontFamily !== before.fontFamily) {
    const font = now.fontFamily;
    patchChild(rPr, RPR_ORDER, 'w:rFonts', { 'w:ascii': font, 'w:hAnsi': font, 'w:cs': font }, ['w:asciiTheme', 'w:hAnsiTheme', 'w:cstheme']);
  }
  if (now.fontEastAsia !== before.fontEastAsia || (now.fontFamily !== before.fontFamily && isCjkFont(now.fontFamily))) {
    const font = eastAsiaFont(now);
    if (font) patchChild(rPr, RPR_ORDER, 'w:rFonts', { 'w:eastAsia': font }, ['w:eastAsiaTheme']);
    else delete child(rPr, 'w:rFonts')?.attrs['w:eastAsia'];
  }
  // The change of formatting as the model has it now: kept, decided, or made here.
  rPr.children = rPr.children.filter((c) => c.name !== 'w:rPrChange');
  const change = rPrChangeXml(props);
  if (change) insertOrdered(rPr, RPR_ORDER, parseElement(change)!);
  return rPr;
}

function patchedParagraphProps(source: DocxSource, slot: SourceSlot, para: Paragraph, keepSection: boolean): XmlNode {
  const original = child(slot.node, 'w:pPr');
  const pPr = (original && parseElement(source.xml.slice(original.start, original.end))) ?? createNode('w:pPr');
  const before = resolveParagraph(slot.paragraph.props);
  const now = resolveParagraph(para.props);
  const changed = (key: keyof ParagraphProps) => now[key] !== before[key];

  // The formatting of the new style is written on the paragraph as well, as what changed from the old one.
  if (changed('styleId')) {
    pPr.children = pPr.children.filter((c) => c.name !== 'w:pStyle');
    if (now.styleId) patchChild(pPr, PPR_ORDER, 'w:pStyle', { 'w:val': now.styleId });
  }
  if (changed('pageBreakBefore')) patchToggle(pPr, PPR_ORDER, 'w:pageBreakBefore', now.pageBreakBefore);
  if (changed('keepNext')) patchToggle(pPr, PPR_ORDER, 'w:keepNext', now.keepNext);
  if (changed('keepLines')) patchToggle(pPr, PPR_ORDER, 'w:keepLines', now.keepLines);
  if (changed('widowControl')) patchToggle(pPr, PPR_ORDER, 'w:widowControl', now.widowControl);
  if (changed('numId') || changed('listLevel')) {
    pPr.children = pPr.children.filter((c) => c.name !== 'w:numPr');
    // A list the style gives has to be switched off explicitly, with list 0.
    const styleId = val(child(pPr, 'w:pStyle')) ?? source.sheet.defaultParagraphStyle;
    if (now.numId || resolveStyle(source.sheet, styleId).pPr.numId) {
      const numPr = parseElement(numPrXml(now.numId, now.listLevel))!;
      if (!now.numId) numPr.children = numPr.children.filter((c) => c.name !== 'w:ilvl');
      insertOrdered(pPr, PPR_ORDER, numPr);
    }
  }
  if (changed('leaderTab') || JSON.stringify(now.tabs) !== JSON.stringify(before.tabs)) {
    // Written again whole, over the stops of the paragraph's style.
    pPr.children = pPr.children.filter((c) => c.name !== 'w:tabs');
    const styleId = val(child(pPr, 'w:pStyle')) ?? source.sheet.defaultParagraphStyle;
    const tabs = tabsXml(now.leaderTab, now.tabs, mergeTabs(source.sheet.paragraphDefaults.tabs, resolveStyle(source.sheet, styleId).pPr.tabs));
    if (tabs) insertOrdered(pPr, PPR_ORDER, parseElement(tabs)!);
  }
  if (changed('spacingBefore')) {
    const set = { 'w:before': String(twips(now.spacingBefore)) };
    patchChild(pPr, PPR_ORDER, 'w:spacing', set, ['w:beforeLines', 'w:beforeAutospacing']);
  }
  if (changed('spacingAfter')) {
    const set = { 'w:after': String(twips(now.spacingAfter)) };
    patchChild(pPr, PPR_ORDER, 'w:spacing', set, ['w:afterLines', 'w:afterAutospacing']);
  }
  if (changed('lineHeight')) {
    const set = { 'w:line': String(Math.round(now.lineHeight * 240)), 'w:lineRule': 'auto' };
    patchChild(pPr, PPR_ORDER, 'w:spacing', set);
  }
  if (changed('indentLeft')) {
    const set = { 'w:left': String(twips(now.indentLeft)) };
    patchChild(pPr, PPR_ORDER, 'w:ind', set, ['w:start', 'w:leftChars', 'w:startChars']);
  }
  if (changed('indentRight')) {
    const set = { 'w:right': String(twips(now.indentRight)) };
    patchChild(pPr, PPR_ORDER, 'w:ind', set, ['w:end', 'w:rightChars', 'w:endChars']);
  }
  if (changed('indentFirstLine')) {
    const set: Record<string, string> = now.indentFirstLine < 0 ? { 'w:hanging': String(twips(-now.indentFirstLine)) } : { 'w:firstLine': String(twips(now.indentFirstLine)) };
    patchChild(pPr, PPR_ORDER, 'w:ind', set, ['w:firstLine', 'w:hanging', 'w:firstLineChars', 'w:hangingChars']);
  }
  if (changed('align')) {
    patchChild(pPr, PPR_ORDER, 'w:jc', { 'w:val': now.align === 'justify' ? 'both' : now.align });
  }

  // A section break is the one the paragraph has now: the one it had in the file when it is the same and
  // the paragraph is the last that came out of the original one, or one written from the model.
  const sectPr = child(pPr, 'w:sectPr');
  pPr.children = pPr.children.filter((c) => c.name !== 'w:sectPr');
  const had = slot.paragraph.section;
  if (para.section) {
    const same = keepSection && sectPr && had && sameSection(had, para.section) && !sectionProps?.has(para.section);
    insertOrdered(pPr, PPR_ORDER, same ? sectPr : parseElement(sectionXml(para.section))!);
  }

  // The paragraph mark carries the formatting of an empty paragraph.
  if (para.runs.every((r) => !r.text)) {
    const mark = patchedRunProps(source, slot.baseRun, para.runs[0].props, true);
    pPr.children = pPr.children.filter((c) => c.name !== 'w:rPr');
    if (mark.children.length) insertOrdered(pPr, PPR_ORDER, mark);
  }
  // And the change that put it in or took it out: the one the model says, the file's gone.
  const markRPr = child(pPr, 'w:rPr');
  if (markRPr) markRPr.children = markRPr.children.filter((c) => !MARK_ONLY.has(c.name));
  const change = markRevisionXml(para.props);
  if (change) {
    const into = markRPr ?? createNode('w:rPr');
    into.children.unshift(parseElement(change)!);
    if (!markRPr) insertOrdered(pPr, PPR_ORDER, into);
  } else if (markRPr && !markRPr.children.some((c) => c.name !== '#text')) pPr.children = pPr.children.filter((c) => c !== markRPr);
  // The change of its formatting as the model has it now.
  pPr.children = pPr.children.filter((c) => c.name !== 'w:pPrChange');
  const formatted = pPrChangeXml(para.props);
  if (formatted) insertOrdered(pPr, PPR_ORDER, parseElement(formatted)!);
  return pPr;
}

function runsXml(source: DocxSource, slot: SourceSlot, runs: Run[]): string {
  let out = '';
  let wrap = '';
  const revision = revisionWriter();
  const close = () => revision.close() + (wrap ? wrap.split(WRAP_SEPARATOR)[1] : '');
  /** Set between the marks of a field the file had, which come as objects around its result. */
  let inField = false;
  for (const run of runs) {
    if (!run.text) continue;
    const runWrap = run.props.wrap ?? '';
    if (runWrap !== wrap) {
      out += close();
      wrap = runWrap;
      if (wrap) out += wrap.split(WRAP_SEPARATOR)[0];
    }
    out += revision.open(run.props);
    if (run.props.object) {
      const mark = /w:fldCharType="(\w+)"/.exec(run.props.object)?.[1];
      if (mark) inField = mark !== 'end';
      out += freshBoxXml(run.props.object).repeat(run.text.length);
      continue;
    }
    // A field made here has no marks of its own yet: it is written with them.
    if (run.props.field && !inField) {
      out += runXml(run);
      continue;
    }
    const rPr = patchedRunProps(source, slot.baseRun, run.props, false);
    out += `<w:r>${rPr.children.length ? serializeXml(rPr) : ''}${textXml(run.text, run.props.revision === 'delete')}</w:r>`;
  }
  return out + close();
}

/** Rebuilds an edited paragraph on top of the source paragraph it descends from. */
function editedParagraphXml(source: DocxSource, slot: SourceSlot, para: Paragraph, first: boolean, last: boolean): string {
  const { node } = slot;
  let open = node.openEnd === node.end ? '<w:p>' : source.xml.slice(node.start, node.openEnd);
  // Paragraph ids must stay unique, so only the first descendant keeps them.
  if (!first) open = open.replace(/\s+w14:(?:paraId|textId)="[^"]*"/g, '');
  const pPr = patchedParagraphProps(source, slot, para, last);
  return `${open}${pPr.children.length ? serializeXml(pPr) : ''}${runsXml(source, slot, para.runs)}</w:p>`;
}

function sourcedDocumentXml(doc: Doc, source: DocxSource, refs: StoryRefs = {}, lastSection?: (sectPr: string) => string): string {
  const { xml, slots } = source;
  const slotOf = new Map<XmlNode, number>();
  slots.forEach((slot, i) => slotOf.set(slot.node, i));
  const cells = paragraphsByCell(doc);
  const sourceTables = source.tables ?? [];
  /** A table of the file whose shape changed: it is written from the model, where its element was. */
  const reshaped = (table: number) => table < sourceTables.length && doc.tables?.[table] !== sourceTables[table];
  // The page of the last section, which is the one the model has. Compared field by field: the
  // object is replaced by any change, including one that is later undone.
  const was = source.page;
  // Said again only when it is not what the file says.
  const ownFirst = !!doc.firstPage === !!source.titlePage ? undefined : !!doc.firstPage;
  const layoutChanged =
    !sameColumns(doc.columns, source.columns) ||
    (doc.sectionStart ?? 'nextPage') !== (source.sectionStart ?? 'nextPage') ||
    JSON.stringify(doc.endnoteNumbering ?? {}) !== JSON.stringify(source.endnoteNumbering ?? {}) ||
    JSON.stringify(doc.footnoteNumbering ?? {}) !== JSON.stringify(source.footnoteNumbering ?? {});
  const pageChanged =
    !!lastSection ||
    layoutChanged ||
    Object.keys(refs).length > 0 ||
    ownFirst !== undefined ||
    (!!was && (Object.keys({ ...was, ...doc.page }) as (keyof Doc['page'])[]).some((key) => was[key] !== doc.page[key]));
  const lastLayout = layoutChanged ? { columns: doc.columns, start: doc.sectionStart, endnoteNumbering: doc.endnoteNumbering, footnoteNumbering: doc.footnoteNumbering } : undefined;
  // The ids of the references need their namespace, which nearly every document declares at the top.
  const declare = !/\sxmlns:r=/.test(xml.slice(0, source.body.start));
  let sectionWritten = false;
  /** A table created since the file was read: it is written where its paragraphs are. */
  const added = (table: number) => table >= sourceTables.length;

  // Paragraphs grouped under the source paragraph they descend from. What has
  // no origin (new tables, mostly) follows the paragraph before it, unless a
  // table of the file lies in between: then it goes before the next one, or it
  // would end up inside that table's last cell.
  const groups = new Map<number, Paragraph[]>();
  const push = (index: number, ...paras: Paragraph[]) => {
    const group = groups.get(index);
    if (group) group.push(...paras);
    else groups.set(index, paras);
  };
  let current = 0;
  let flowSlot: number | undefined;
  let waiting: Paragraph[] = [];
  for (const para of doc.paragraphs) {
    if (para.cell && reshaped(para.cell.table)) {
      flowSlot = undefined;
    } else if (para.origin === undefined || (para.cell && added(para.cell.table))) {
      if (flowSlot === undefined) waiting.push(para);
      else push(flowSlot, para);
    } else {
      // Its own place, not the furthest one seen: the paragraphs may have been put in another order.
      current = para.origin;
      if (para.cell) {
        flowSlot = undefined;
        push(current, para);
      } else {
        flowSlot = current;
        push(current, ...waiting, para);
        waiting = [];
      }
    }
  }

  /** Where in the document each paragraph is. */
  const placeOf = new Map<Paragraph, number>();
  doc.paragraphs.forEach((para, i) => placeOf.set(para, i));

  /** XML of a run of paragraphs; `slotFor` says which source paragraph each one is rebuilt on. */
  /** XML of a run of paragraphs; `within` is the table whose cell they are in, when they are. */
  const emitList = (list: Paragraph[], slotFor: (para: Paragraph) => SourceSlot | undefined, inCell: boolean, within?: number) => {
    let out = '';
    let count = 0;
    const tables = new Set<number>();
    /** The table a paragraph stands for here: one created since, seen from outside its cells. */
    const newTable = (para: Paragraph) => (!inCell && para.cell && added(para.cell.table) ? para.cell.table : undefined);
    list.forEach((para, i) => {
      // A table in the cell is written where its first paragraph is: as the file had it, or from the model when its shape changed.
      const inner = within === undefined ? undefined : nestedIn(doc, para, within);
      if (inner !== undefined) {
        if (!tables.has(inner) && doc.tables?.[inner]?.rows.length) {
          tables.add(inner);
          count++;
          const node = source.tableNodes?.[inner];
          out += node && !reshaped(inner) ? emitTable(node) : tableXml(doc, inner, (row, cell) => cellXml(inner, row, cell), node && { xml, node, original: sourceTables[inner] });
        }
        return;
      }
      const table = newTable(para);
      if (table !== undefined) {
        if (!tables.has(table) && doc.tables?.[table]) {
          tables.add(table);
          count++;
          out += tableXml(doc, table, (row, cell) => cellXml(table, row, cell));
        }
        return;
      }
      count++;
      const slot = slotFor(para);
      if (!slot) {
        out += paragraphXml(para);
      } else if (para === slot.paragraph) {
        out += xml.slice(slot.node.start, slot.node.end);
      } else {
        const same = (other: Paragraph) => newTable(other) === undefined && slotFor(other) === slot;
        out += editedParagraphXml(source, slot, para, !list.slice(0, i).some(same), !list.slice(i + 1).some(same));
      }
    });
    return { xml: out, count };
  };

  const cellXml = (table: number, row: TableRow, cell: TableCell): string =>
    emitList(cells.get(cellKey(table, row.id, cell.id)) ?? [], (para) => (para.origin === undefined ? undefined : slots[para.origin]), true, table).xml;

  const emitSlot = (index: number) => emitList(groups.get(index) ?? [], (para) => (para.origin === undefined ? undefined : slots[index]), false);

  /** Inner XML of a block container, with its paragraphs replaced by their current state. */
  const emitBlocks = (container: XmlNode): { xml: string; count: number } => {
    let out = '';
    let count = 0;
    let cursor = container.openEnd;
    // The blocks of the body go in the order the document has them now, which may not be the one
    // of the file: each is kept with the place in the document of its first paragraph.
    const top = container === source.body;
    const pieces: { xml: string; place: number }[] = [];
    const replace = (node: XmlNode, replacement: string, place = NaN) => {
      const piece = xml.slice(cursor, node.start) + replacement;
      if (top) pieces.push({ xml: piece, place });
      else out += piece;
      cursor = node.end;
    };
    for (const c of container.children) {
      if (c.name === 'w:p') {
        const index = slotOf.get(c)!;
        const emitted = emitSlot(index);
        count += emitted.count;
        replace(c, emitted.xml, placeOf.get(groups.get(index)?.[0] as Paragraph));
      } else if (c.name === 'w:tbl') {
        const table = source.tableNodes?.indexOf(c) ?? -1;
        const place = table >= 0 ? doc.paragraphs.findIndex((p) => p.cell?.table === table) : -1;
        if (table >= 0 && reshaped(table)) {
          // A table left without rows is gone.
          const rows = doc.tables?.[table]?.rows.length;
          replace(c, rows ? tableXml(doc, table, (row, cell) => cellXml(table, row, cell), { xml, node: c, original: sourceTables[table] }) : '', place < 0 ? NaN : place);
        } else {
          replace(c, emitTable(c), place < 0 ? NaN : place);
        }
      } else if (c.name === 'w:sectPr' && container === source.body) {
        // The properties of the section close the body, wherever its blocks went.
        const section = xml.slice(c.start, c.end);
        replace(c, pageChanged ? (lastSection ?? String)(pageSectPr(doc.page, section, refs, declare, ownFirst, lastLayout)) : section, Infinity);
        sectionWritten ||= pageChanged;
      } else if (c.name === 'w:sdt') {
        const content = child(c, 'w:sdtContent');
        if (!content) continue;
        const inner = emitBlocks(content);
        count += inner.count;
        replace(c, xml.slice(c.start, content.openEnd) + inner.xml + xml.slice(content.closeStart, c.end));
      }
    }
    if (top) {
      // A block with no paragraph left, or none of its own, stays next to the one before it.
      let last = -1;
      for (const piece of pieces) last = piece.place = Number.isNaN(piece.place) ? last : piece.place;
      const moved = pieces.some((piece, i) => i > 0 && piece.place < pieces[i - 1].place);
      if (moved) pieces.sort((a, b) => a.place - b.place);
      out = pieces.map((piece) => piece.xml).join('');
    }
    return { xml: out + xml.slice(cursor, container.closeStart), count };
  };

  const emitTable = (table: XmlNode): string => {
    let out = '';
    let cursor = table.start;
    for (const row of table.children) {
      if (row.name !== 'w:tr') continue;
      for (const cell of row.children) {
        if (cell.name !== 'w:tc') continue;
        const inner = emitBlocks(cell);
        // A cell must hold at least one paragraph.
        out += xml.slice(cursor, cell.openEnd) + inner.xml + (inner.count ? '' : '<w:p/>');
        cursor = cell.closeStart;
      }
    }
    return out + xml.slice(cursor, table.end);
  };

  const { body } = source;
  let inner = emitBlocks(body).xml;
  // A body that had no paragraphs at all: the current ones go first.
  if (!slots.length) inner = emitList(doc.paragraphs, () => undefined, false).xml + inner;
  else if (waiting.length) {
    // New content after the last paragraph that could take it: it goes at the end, before the section properties.
    const tail = emitList(waiting, () => undefined, false).xml;
    const at = inner.lastIndexOf('<w:sectPr');
    inner = at < 0 ? inner + tail : inner.slice(0, at) + tail + inner.slice(at);
  }
  // A body that had no section properties gets them when the page was changed.
  if (pageChanged && !sectionWritten) inner += (lastSection ?? String)(pageSectPr(doc.page, undefined, refs, declare, ownFirst, lastLayout));
  return xml.slice(0, body.openEnd) + inner + xml.slice(body.closeStart);
}

export function documentXml(doc: Doc): string {
  return doc.source ? sourcedDocumentXml(doc, doc.source) : newDocumentXml(doc);
}

/**
 * Takes out of the package the pictures nothing shows any more: one that was
 * deleted, or changed for another, would otherwise stay in the file for
 * whoever opens it as the archive it is. A picture goes when no part names
 * it: first the relationships to pictures a part no longer uses, then the
 * pictures no relationship leads to.
 */
function dropUnusedPictures(files: Record<string, Uint8Array>): void {
  const used = new Set<string>();
  for (const relsPath of Object.keys(files)) {
    const at = /^(.*\/)?_rels\/([^/]*)\.rels$/.exec(relsPath);
    if (!at) continue;
    const folder = at[1] ?? '';
    let rels = strFromU8(files[relsPath]);
    const part = at[2] ? files[folder + at[2]] : undefined;
    if (part && rels.includes('/image"')) {
      const xml = strFromU8(part);
      const kept = rels.replace(/<Relationship\b[^>]*\/>/g, (el) => {
        if (!/\bType="[^"]*\/image"/.test(el) || /\bTargetMode="External"/.test(el)) return el;
        const id = /\bId="([^"]*)"/.exec(el)?.[1];
        return id && xml.includes(`"${id}"`) ? el : '';
      });
      if (kept !== rels) {
        rels = kept;
        files[relsPath] = strToU8(rels);
      }
    }
    for (const [el, target] of rels.matchAll(/<Relationship\b[^>]*\bTarget="([^"]*)"[^>]*\/>/g)) {
      if (/\bTargetMode="External"/.test(el)) continue;
      const steps: string[] = [];
      for (const step of (target.startsWith('/') ? target.slice(1) : folder + target).split('/')) {
        if (step === '..') steps.pop();
        else if (step && step !== '.') steps.push(step);
      }
      used.add(steps.join('/'));
    }
  }
  for (const path of Object.keys(files)) if (/(^|\/)media\//.test(path) && !used.has(path)) delete files[path];
}

export interface DocxOptions {
  /**
   * Fonts to put in the file, for whoever opens it without them: the faces of
   * the families its text is in. Only TrueType files whose licence lets them
   * be embedded go in, and only the faces the file does not carry already.
   */
  fonts?: EmbeddedFont[];
  /**
   * The language the text is in, as a tag ('es-MX', 'en'): said in the defaults
   * of its styles, for spelling and for Word not to guess one, when the file
   * does not say it already.
   */
  language?: string;
  /** Says `language` even where the file says another one: for a language a person chose for the text. */
  replaceLanguage?: boolean;
  /**
   * Whether those fonts go in cut down to the characters of the document and
   * of the keyboard, as Word's "Embed only the characters used": a much
   * smaller file, in which a character typed later that the font does not keep
   * is shown in another font by whoever lacks it. Whole when the licence says so.
   */
  subsetFonts?: boolean;
}

export function exportDocx(whole: Doc, options: DocxOptions = {}): Uint8Array<ArrayBuffer> {
  revisionIds = 0;
  // What editing left of notes that are no longer whole does not go into the file.
  const doc = pruneNotes(whole);
  boxesOf = doc;
  const { source } = doc;
  const mainPath = source?.mainPath ?? 'word/document.xml';
  const files: Record<string, Uint8Array> = source ? { ...source.files } : { '[Content_Types].xml': strToU8(CONTENT_TYPES), '_rels/.rels': strToU8(ROOT_RELS) };
  writeStyles(doc, files, mainPath, source);
  if (options.language) writeLanguage(files, mainPath, options.language, options.replaceLanguage);
  writeNumbering(doc, files, mainPath, source);
  writeNotes(doc, files, mainPath, source);
  writeReferencedNotes(doc, files, mainPath, source, 'footnote');
  writeReferencedNotes(doc, files, mainPath, source, 'endnote');
  const refs = writeStories(doc, files, mainPath, source);
  let xml: string;
  const boxes = changedBoxes(doc, source);
  try {
    const lastSection = writeSections(doc, files, mainPath, source, refs);
    xml = source ? sourcedDocumentXml(doc, source, refs, lastSection) : newDocumentXml(doc, refs, lastSection);
  } finally {
    sectionProps = undefined;
  }
  // The text boxes of the other parts whose text changed: those parts as they are now, with it.
  for (const path of new Set(boxes.map((box) => box.path))) {
    if (path !== mainPath && files[path]) files[path] = strToU8(replaceBoxes(strFromU8(files[path]), path, boxes));
  }
  xml = replaceBoxes(xml, mainPath, boxes);
  files[mainPath] = strToU8(writeLinks(files, mainPath, writeMedia(doc, files, mainPath, xml)));
  if (options.fonts?.length) writeFonts(files, mainPath, options.fonts, options.subsetFonts ? textByFamily(doc) : undefined);
  writeTracking(doc, files, mainPath, source);
  writeRestriction(doc, files, mainPath, source);
  writeEndnotePlacement(doc, files, mainPath);
  dropUnusedPictures(files);
  // fflate makes it on an ArrayBuffer of its own; its types only say Uint8Array.
  return zipSync(files) as Uint8Array<ArrayBuffer>;
}
