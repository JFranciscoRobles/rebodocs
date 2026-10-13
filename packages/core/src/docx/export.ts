// Doc -> DOCX.
//
// A document that came from a DOCX is written back into its original package:
// untouched paragraphs are copied verbatim, edited ones are rebuilt on top of
// their original properties, and every other part (styles, numbering, headers,
// media...) is kept as it was. A document created from scratch gets a minimal
// package where every property is direct formatting.

import { strFromU8, strToU8, zipSync } from 'fflate';
import {
  type Doc,
  type Note,
  type Paragraph,
  type Story,
  type Table,
  type TableCell,
  type TableRow,
  type ParagraphProps,
  type ParagraphStyle,
  type ResolvedRunProps,
  type Run,
  type RunProps,
  WRAP_SEPARATOR,
  resolveParagraph,
  resolveRun,
  sameCell,
} from '../model';
import { STORY_PARTS as ALL_STORIES, type StoryPart, storyKind, storyOf } from '../stories';
import type { ListLevel, Numbering } from '../numbering';
import { paragraphStyles } from '../styles';
import { imageExtension, mediaKey } from '../images';
import { noteKey, noteMark, pruneNotes } from '../notes';
import { isFieldMark } from '../toc';
import { CUSTOM_PROPERTIES_PATH, HIGHLIGHTS, NOTE_COLORS_PROPERTY, parseRunProps, resolveStyle, val } from './import';
import type { DocxSource, SourceSlot, StorySource } from './source';
import { type XmlNode, child, childrenOf, createNode, escapeXml, parseElement, serializeXml } from './xml';

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
  const rPr =
    (font ? `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:hint="default"/>` : '') +
    (level.run.bold ? '<w:b/>' : '') +
    (level.run.italic ? '<w:i/>' : '');
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
      overrides +=
        `<w:lvlOverride w:ilvl="${i}">` +
        (start === undefined ? '' : `<w:startOverride w:val="${start}"/>`) +
        (level ? levelXml(level, i) : '') +
        '</w:lvlOverride>';
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
  files['[Content_Types].xml'] = strToU8(appendToRoot(types, 'Types', `<Override PartName="/${CUSTOM_PROPERTIES_PATH}" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>`));
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
  const added = styles.filter((style) => used.has(style.id)).map((style) => styleXml(style, normal)).join('');
  if (!added) return;
  if (existing) files[path] = strToU8(appendToRoot(strFromU8(existing), 'w:styles', added));
  else addPart(files, mainPath, 'styles.xml', STYLES_REL, STYLES_TYPE, `${XML_HEADER}<w:styles xmlns:w="${W_NS}">${added}</w:styles>`);
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

function textXml(text: string): string {
  let content = '';
  for (const part of text.split(/(\t|\n|\f)/)) {
    if (!part) continue;
    if (part === '\t') content += '<w:tab/>';
    else if (part === '\n') content += '<w:br/>';
    else if (part === '\f') content += '<w:br w:type="page"/>';
    else content += `<w:t xml:space="preserve">${escapeXml(part)}</w:t>`;
  }
  return content;
}

// --- New documents ----------------------------------------------------------

function runPropsXml(props: RunProps): string {
  const p = resolveRun(props);
  const font = escapeXml(p.fontFamily);
  const size = Math.round(p.fontSize * 2);
  return (
    '<w:rPr>' +
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>` +
    (p.bold ? '<w:b/>' : '') +
    (p.italic ? '<w:i/>' : '') +
    (p.strike ? '<w:strike/>' : '') +
    `<w:color w:val="${escapeXml(p.color)}"/>` +
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` +
    (highlightName(p.highlight) === 'none' ? '' : `<w:highlight w:val="${highlightName(p.highlight)}"/>`) +
    (p.underline ? '<w:u w:val="single"/>' : '') +
    '</w:rPr>'
  );
}

function runXml(run: Run): string {
  // Objects only make sense inside the package they came from, but for what was put in here: pictures, notes and the marks of a table of contents.
  if (run.props.object) {
    const ours = mediaKey(run.props.object) !== undefined || !!noteMark(run.props.object) || isFieldMark(run.props.object);
    return ours ? run.props.object.repeat(run.text.length) : '';
  }
  if (!run.text) return '';
  const rPr = runPropsXml(run.props);
  if (!run.props.field) return `<w:r>${rPr}${textXml(run.text)}</w:r>`;
  // The result of a field, with the marks and the code that make it one.
  const mark = (type: string) => `<w:r>${rPr}<w:fldChar w:fldCharType="${type}"/></w:r>`;
  return (
    mark('begin') +
    `<w:r>${rPr}<w:instrText xml:space="preserve"> ${escapeXml(run.props.field)} </w:instrText></w:r>` +
    mark('separate') +
    `<w:r>${rPr}${textXml(run.text)}</w:r>` +
    mark('end')
  );
}

/** A right tab stop with a dotted leader, `at` points from the left edge of the text. */
const leaderTabXml = (at: number) => `<w:tab w:val="right" w:leader="dot" w:pos="${twips(at)}"/>`;

function paragraphXml(para: Paragraph): string {
  const p = resolveParagraph(para.props);
  const firstLine =
    p.indentFirstLine < 0
      ? ` w:hanging="${twips(-p.indentFirstLine)}"`
      : ` w:firstLine="${twips(p.indentFirstLine)}"`;
  const jc = p.align === 'justify' ? 'both' : p.align;
  const isEmpty = para.runs.every((r) => !r.text);
  return (
    '<w:p><w:pPr>' +
    (p.styleId ? `<w:pStyle w:val="${escapeXml(p.styleId)}"/>` : '') +
    (p.keepNext ? '<w:keepNext/>' : '') +
    (p.keepLines ? '<w:keepLines/>' : '') +
    (p.pageBreakBefore ? '<w:pageBreakBefore/>' : '') +
    // Widow and orphan control is on unless a paragraph switches it off.
    (p.widowControl ? '' : '<w:widowControl w:val="0"/>') +
    (p.numId ? numPrXml(p.numId, p.listLevel) : '') +
    (p.leaderTab > 0 ? `<w:tabs>${leaderTabXml(p.leaderTab)}</w:tabs>` : '') +
    `<w:spacing w:before="${twips(p.spacingBefore)}" w:after="${twips(p.spacingAfter)}"` +
    ` w:line="${Math.round(p.lineHeight * 240)}" w:lineRule="auto"/>` +
    `<w:ind w:left="${twips(p.indentLeft)}" w:right="${twips(p.indentRight)}"${firstLine}/>` +
    `<w:jc w:val="${jc}"/>` +
    // The paragraph mark carries the formatting of an empty paragraph.
    (isEmpty ? runPropsXml(para.runs[0].props) : '') +
    '</w:pPr>' +
    wrappedRunsXml(para.runs) +
    '</w:p>'
  );
}

/** The runs of a paragraph written from the model, each stretch inside the wrapper it has: the link of an entry of a table of contents. */
function wrappedRunsXml(runs: Run[]): string {
  let out = '';
  let wrap = '';
  const close = () => (wrap ? wrap.split(WRAP_SEPARATOR)[1] : '');
  for (const run of runs) {
    if (!run.text) continue;
    const next = run.props.wrap ?? '';
    if (next !== wrap) {
      out += close();
      wrap = next;
      if (wrap) out += wrap.split(WRAP_SEPARATOR)[0];
    }
    out += runXml(run);
  }
  return out + close();
}

// --- Tables written from the model ---------------------------------------------

const TCPR_ORDER = [
  'w:cnfStyle', 'w:tcW', 'w:gridSpan', 'w:hMerge', 'w:vMerge', 'w:tcBorders', 'w:shd', 'w:noWrap', 'w:tcMar',
  'w:textDirection', 'w:tcFitText', 'w:vAlign', 'w:hideMark',
];

const TBLPR_ORDER = [
  'w:tblStyle', 'w:tblpPr', 'w:tblOverlap', 'w:bidiVisual', 'w:tblStyleRowBandSize', 'w:tblStyleColBandSize', 'w:tblW',
  'w:jc', 'w:tblCellSpacing', 'w:tblInd', 'w:tblBorders', 'w:shd', 'w:tblLayout', 'w:tblCellMar', 'w:tblLook',
];

const cellKey = (table: number, row: number, cell: number) => `${table}:${row}:${cell}`;

/** The paragraphs of every table cell of the document, by table, row id and cell id. */
function paragraphsByCell(doc: Doc): Map<string, Paragraph[]> {
  const map = new Map<string, Paragraph[]>();
  for (const para of doc.paragraphs) {
    if (!para.cell) continue;
    const key = cellKey(para.cell.table, para.cell.row, para.cell.cell);
    const list = map.get(key);
    if (list) list.push(para);
    else map.set(key, [para]);
  }
  return map;
}

function border(side: string): string {
  return `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="auto"/>`;
}

/**
 * A table written from the model. When it was read from a file (`from`), the
 * properties of the table, of each row and of each cell that still exists are
 * taken from there, so what the model does not interpret survives; rows and
 * cells added since take theirs from the nearest one that has them.
 */
function tableXml(
  doc: Doc,
  tableIndex: number,
  cellContent: (row: TableRow, cell: TableCell) => string,
  from?: { xml: string; node: XmlNode; original?: Table },
): string {
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
    out += model
      ? model.children.filter((c) => c.name === 'w:tblPrEx' || c.name === 'w:trPr').map(slice).join('')
      : row.before || row.height || row.cantSplit
        ? '<w:trPr>' +
          (row.before ? `<w:gridBefore w:val="${row.before}"/>` : '') +
          (row.cantSplit ? '<w:cantSplit/>' : '') +
          (row.height ? `<w:trHeight w:val="${twips(row.height)}"/>` : '') +
          '</w:trPr>'
        : '';
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
      const sides = ['top', 'left', 'bottom', 'right'];
      if (from ? was && was.borders !== cell.borders : anyBorders && !cell.borders) {
        tcPr.children = tcPr.children.filter((c) => c.name !== 'w:tcBorders');
        const lines = cell.borders ? sides.map(border) : sides.map((side) => `<w:${side} w:val="nil"/>`);
        insertOrdered(tcPr, TCPR_ORDER, parseElement(`<w:tcBorders>${lines.join('')}</w:tcBorders>`)!);
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
  'w:headerReference', 'w:footerReference', 'w:footnotePr', 'w:endnotePr', 'w:type', 'w:pgSz', 'w:pgMar', 'w:paperSrc',
  'w:pgBorders', 'w:lnNumType', 'w:pgNumType', 'w:cols', 'w:formProt', 'w:vAlign', 'w:noEndnote', 'w:titlePg',
  'w:textDirection', 'w:bidi', 'w:rtlGutter', 'w:docGrid', 'w:printerSettings', 'w:sectPrChange',
];

/**
 * Section properties with the size and margins of `page`, on top of whatever
 * else `original` says, and referring to the header and footer in `refs`.
 * `declare` adds the namespace of the reference ids, for a document that lacks it.
 */
function pageSectPr(page: Doc['page'], original?: string, refs: StoryRefs = {}, declare = false, ownFirst?: boolean): string {
  const sectPr = (original ? parseElement(original) : undefined) ?? createNode('w:sectPr');
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

function newDocumentXml(doc: Doc, refs: StoryRefs = {}): string {
  const pg = doc.page;
  const blocks = blocksXml(doc);
  return (
    XML_HEADER +
    `<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:body>` +
    blocks +
    pageSectPr(pg, undefined, refs, false, doc.firstPage ? true : undefined) +
    '</w:body></w:document>'
  );
}

// --- Documents read from a DOCX ---------------------------------------------

// Child order the schema requires inside w:pPr and w:rPr.
const PPR_ORDER = [
  'w:pStyle', 'w:keepNext', 'w:keepLines', 'w:pageBreakBefore', 'w:framePr', 'w:widowControl', 'w:numPr',
  'w:suppressLineNumbers', 'w:pBdr', 'w:shd', 'w:tabs', 'w:suppressAutoHyphens', 'w:kinsoku', 'w:wordWrap',
  'w:overflowPunct', 'w:topLinePunct', 'w:autoSpaceDE', 'w:autoSpaceDN', 'w:bidi', 'w:adjustRightInd',
  'w:snapToGrid', 'w:spacing', 'w:ind', 'w:contextualSpacing', 'w:mirrorIndents', 'w:suppressOverlap', 'w:jc',
  'w:textDirection', 'w:textAlignment', 'w:textboxTightWrap', 'w:outlineLvl', 'w:divId', 'w:cnfStyle', 'w:rPr',
  'w:sectPr', 'w:pPrChange',
];
const RPR_ORDER = [
  'w:rStyle', 'w:rFonts', 'w:b', 'w:bCs', 'w:i', 'w:iCs', 'w:caps', 'w:smallCaps', 'w:strike', 'w:dstrike',
  'w:outline', 'w:shadow', 'w:emboss', 'w:imprint', 'w:noProof', 'w:snapToGrid', 'w:vanish', 'w:webHidden',
  'w:color', 'w:spacing', 'w:w', 'w:kern', 'w:position', 'w:sz', 'w:szCs', 'w:highlight', 'w:u', 'w:effect',
  'w:bdr', 'w:shd', 'w:fitText', 'w:vertAlign', 'w:rtl', 'w:cs', 'w:em', 'w:lang', 'w:eastAsianLayout',
  'w:specVanish', 'w:oMath', 'w:rPrChange',
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
function patchChild(
  parent: XmlNode,
  order: string[],
  name: string,
  set: Record<string, string>,
  remove: string[] = [],
): void {
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
  if (now.highlight !== before.highlight) patchChild(rPr, RPR_ORDER, 'w:highlight', { 'w:val': highlightName(now.highlight) });
  if (now.color !== before.color) {
    patchChild(rPr, RPR_ORDER, 'w:color', { 'w:val': now.color }, ['w:themeColor', 'w:themeTint', 'w:themeShade']);
  }
  if (now.fontFamily !== before.fontFamily) {
    const font = now.fontFamily;
    patchChild(rPr, RPR_ORDER, 'w:rFonts', { 'w:ascii': font, 'w:hAnsi': font, 'w:cs': font }, [
      'w:asciiTheme',
      'w:hAnsiTheme',
      'w:cstheme',
    ]);
  }
  return rPr;
}

function patchedParagraphProps(
  source: DocxSource,
  slot: SourceSlot,
  para: Paragraph,
  keepSection: boolean,
): XmlNode {
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
  if (changed('leaderTab')) {
    pPr.children = pPr.children.filter((c) => c.name !== 'w:tabs');
    if (now.leaderTab > 0) insertOrdered(pPr, PPR_ORDER, parseElement(`<w:tabs>${leaderTabXml(now.leaderTab)}</w:tabs>`)!);
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
    const set: Record<string, string> =
      now.indentFirstLine < 0
        ? { 'w:hanging': String(twips(-now.indentFirstLine)) }
        : { 'w:firstLine': String(twips(now.indentFirstLine)) };
    patchChild(pPr, PPR_ORDER, 'w:ind', set, ['w:firstLine', 'w:hanging', 'w:firstLineChars', 'w:hangingChars']);
  }
  if (changed('align')) {
    patchChild(pPr, PPR_ORDER, 'w:jc', { 'w:val': now.align === 'justify' ? 'both' : now.align });
  }

  // A section break belongs to the last paragraph that came out of the original one.
  if (!keepSection) pPr.children = pPr.children.filter((c) => c.name !== 'w:sectPr');

  // The paragraph mark carries the formatting of an empty paragraph.
  if (para.runs.every((r) => !r.text)) {
    const mark = patchedRunProps(source, slot.baseRun, para.runs[0].props, true);
    pPr.children = pPr.children.filter((c) => c.name !== 'w:rPr');
    if (mark.children.length) insertOrdered(pPr, PPR_ORDER, mark);
  }
  return pPr;
}

function runsXml(source: DocxSource, slot: SourceSlot, runs: Run[]): string {
  let out = '';
  let wrap = '';
  const close = () => (wrap ? wrap.split(WRAP_SEPARATOR)[1] : '');
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
    if (run.props.object) {
      const mark = /w:fldCharType="(\w+)"/.exec(run.props.object)?.[1];
      if (mark) inField = mark !== 'end';
      out += run.props.object.repeat(run.text.length);
      continue;
    }
    // A field made here has no marks of its own yet: it is written with them.
    if (run.props.field && !inField) {
      out += runXml(run);
      continue;
    }
    const rPr = patchedRunProps(source, slot.baseRun, run.props, false);
    out += `<w:r>${rPr.children.length ? serializeXml(rPr) : ''}${textXml(run.text)}</w:r>`;
  }
  return out + close();
}

/** Rebuilds an edited paragraph on top of the source paragraph it descends from. */
function editedParagraphXml(
  source: DocxSource,
  slot: SourceSlot,
  para: Paragraph,
  first: boolean,
  last: boolean,
): string {
  const { node } = slot;
  let open = node.openEnd === node.end ? '<w:p>' : source.xml.slice(node.start, node.openEnd);
  // Paragraph ids must stay unique, so only the first descendant keeps them.
  if (!first) open = open.replace(/\s+w14:(?:paraId|textId)="[^"]*"/g, '');
  const pPr = patchedParagraphProps(source, slot, para, last);
  return `${open}${pPr.children.length ? serializeXml(pPr) : ''}${runsXml(source, slot, para.runs)}</w:p>`;
}

function sourcedDocumentXml(doc: Doc, source: DocxSource, refs: StoryRefs = {}): string {
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
  const pageChanged =
    Object.keys(refs).length > 0 ||
    ownFirst !== undefined ||
    (!!was && (Object.keys({ ...was, ...doc.page }) as (keyof Doc['page'])[]).some((key) => was[key] !== doc.page[key]));
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
  const emitList = (list: Paragraph[], slotFor: (para: Paragraph) => SourceSlot | undefined, inCell: boolean) => {
    let out = '';
    let count = 0;
    const tables = new Set<number>();
    /** The table a paragraph stands for here: one created since, seen from outside its cells. */
    const newTable = (para: Paragraph) => (!inCell && para.cell && added(para.cell.table) ? para.cell.table : undefined);
    list.forEach((para, i) => {
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
    emitList(cells.get(cellKey(table, row.id, cell.id)) ?? [], (para) => (para.origin === undefined ? undefined : slots[para.origin]), true).xml;

  const emitSlot = (index: number) =>
    emitList(groups.get(index) ?? [], (para) => (para.origin === undefined ? undefined : slots[index]), false);

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
        replace(c, pageChanged ? pageSectPr(doc.page, section, refs, declare, ownFirst) : section, Infinity);
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
  if (pageChanged && !sectionWritten) inner += pageSectPr(doc.page, undefined, refs, declare, ownFirst);
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

export function exportDocx(whole: Doc): Uint8Array {
  // What editing left of notes that are no longer whole does not go into the file.
  const doc = pruneNotes(whole);
  const { source } = doc;
  const mainPath = source?.mainPath ?? 'word/document.xml';
  const files: Record<string, Uint8Array> = source
    ? { ...source.files }
    : { '[Content_Types].xml': strToU8(CONTENT_TYPES), '_rels/.rels': strToU8(ROOT_RELS) };
  writeStyles(doc, files, mainPath, source);
  writeNumbering(doc, files, mainPath, source);
  writeNotes(doc, files, mainPath, source);
  const refs = writeStories(doc, files, mainPath, source);
  const xml = source ? sourcedDocumentXml(doc, source, refs) : newDocumentXml(doc, refs);
  files[mainPath] = strToU8(writeLinks(files, mainPath, writeMedia(doc, files, mainPath, xml)));
  dropUnusedPictures(files);
  return zipSync(files);
}
