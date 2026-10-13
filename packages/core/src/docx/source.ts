// The DOCX package a document was read from, kept so export can reuse it.

import { strFromU8 } from 'fflate';
import type { Note, PageSetup, Paragraph, ParagraphProps, RunProps, Story, Table } from '../model';
import type { Numbering } from '../numbering';
import { type XmlNode, child, childrenOf, parseXml } from './xml';

export interface Style {
  /** The name Word shows, and 'paragraph', 'character' or 'table'. */
  name?: string;
  type?: string;
  basedOn?: string;
  pPr: ParagraphProps;
  rPr: RunProps;
  /** Table styles only: whether the style draws borders, how thick, and its cell margins. */
  borders?: boolean;
  borderWidths?: BorderWidths;
  padding?: CellPadding;
}

/** Thickness, in points, of the horizontal borders a table gives its cells; 0 for none. */
export interface BorderWidths {
  top: number;
  bottom: number;
  inside: number;
}

export type CellPadding = Partial<Record<'padTop' | 'padRight' | 'padBottom' | 'padLeft', number>>;

export interface StyleSheet {
  runDefaults: RunProps;
  paragraphDefaults: ParagraphProps;
  styles: Map<string, Style>;
  defaultParagraphStyle?: string;
  defaultTableStyle?: string;
}

/** A header or footer part as it was read. */
export interface StorySource {
  path: string;
  xml: string;
  /** The w:hdr or w:ftr element. */
  root: XmlNode;
  /** The paragraphs of the part as read, by their `origin`, in the order they are in the XML. */
  slots: SourceSlot[];
  /** The story as read; a different object means it changed. */
  story: Story;
}

/** A w:p of the source document together with the paragraph it was imported as. */
export interface SourceSlot {
  node: XmlNode;
  paragraph: Paragraph;
  /** Run formatting the paragraph's style gives to its text. */
  baseRun: RunProps;
}

export interface DocxSource {
  /** Every part of the original package, by path. */
  files: Record<string, Uint8Array>;
  mainPath: string;
  /** Text of the main document part; `body` and the slot nodes hold offsets into it. */
  xml: string;
  body: XmlNode;
  sheet: StyleSheet;
  /** The page as it was read; export rewrites the section's page settings when it is no longer the same. */
  page?: PageSetup;
  /** Whether the last section gives the first page a header and a footer of its own. */
  titlePage?: boolean;
  /**
   * The tables of the body as they were read, and the element each came from.
   * A table that is no longer the same object changed shape and is written anew.
   */
  tables?: Table[];
  tableNodes?: XmlNode[];
  /** The lists the package defines; export adds the ones created since. */
  numbering?: Numbering;
  slots: SourceSlot[];
  /** The parts the header and the footer were read from. */
  headerPath?: string;
  footerPath?: string;
  /** What is needed to write a changed header or footer back into its part. */
  /** The parts of the header and the footer the first page has to itself, when it has them. */
  firstHeaderPath?: string;
  firstFooterPath?: string;
  firstHeaderSource?: StorySource;
  firstFooterSource?: StorySource;
  headerSource?: StorySource;
  footerSource?: StorySource;
  /** The part the notes were read from, and the notes as they were read: export writes it again when they are not the same. */
  notesPath?: string;
  notes?: Note[];
  /** Relationships of each part that was asked for them, by part path and then by id. */
  relationships?: Map<string, Map<string, string>>;
}

const EMU_PER_POINT = 12700;

/** Size in points of an inline drawing, or undefined when the XML is not one. */
export function inlineObjectSize(xml: string): { width: number; height: number } | undefined {
  if (!xml.includes('<wp:inline')) return undefined;
  const extent = /<wp:extent\b[^>]*>/.exec(xml)?.[0];
  const cx = Number(/\bcx="(\d+)"/.exec(extent ?? '')?.[1]);
  const cy = Number(/\bcy="(\d+)"/.exec(extent ?? '')?.[1]);
  return cx > 0 && cy > 0 ? { width: cx / EMU_PER_POINT, height: cy / EMU_PER_POINT } : undefined;
}

/** Targets of the relationships of a part, by id, as package paths. */
export function relationships(source: DocxSource, partPath = source.mainPath): Map<string, string> {
  source.relationships ??= new Map();
  let map = source.relationships.get(partPath);
  if (map) return map;
  map = new Map();
  const slash = partPath.lastIndexOf('/') + 1;
  const dir = partPath.slice(0, slash);
  const part = source.files[`${dir}_rels/${partPath.slice(slash)}.rels`];
  if (part) {
    const root = child(parseXml(strFromU8(part)), 'Relationships');
    for (const rel of childrenOf(root, 'Relationship')) {
      const target = rel.attrs.Target;
      if (!rel.attrs.Id || !target || rel.attrs.TargetMode === 'External') continue;
      map.set(rel.attrs.Id, target.startsWith('/') ? target.slice(1) : dir + target);
    }
  }
  source.relationships.set(partPath, map);
  return map;
}

const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

/** A part of the package that is not its main one: the header or the footer of every page, or those of the first page alone. */
export type StoryPart = 'header' | 'footer' | 'firstHeader' | 'firstFooter';

/** The picture an object embeds, when it is in a format browsers can show. `part` is where the object lives. */
export function objectImage(
  source: DocxSource,
  xml: string,
  part?: StoryPart,
): { bytes: Uint8Array; type: string } | undefined {
  const id = /\br:embed="([^"]+)"/.exec(xml)?.[1];
  const partPath = part ? source[`${part}Path`] : source.mainPath;
  const path = id && partPath ? relationships(source, partPath).get(id) : undefined;
  const bytes = path ? source.files[path] : undefined;
  const type = IMAGE_TYPES[path?.slice(path.lastIndexOf('.') + 1).toLowerCase() ?? ''];
  return bytes && type ? { bytes, type } : undefined;
}

export interface Anchor {
  width: number;
  height: number;
  /** What each offset is measured from, as OOXML names it: 'page', 'margin', 'column', 'paragraph'... */
  fromX: string;
  fromY: string;
  x: number;
  y: number;
  /** Alignment used instead of an offset: 'left', 'center', 'right' / 'top', 'center', 'bottom'. */
  alignX?: string;
  alignY?: string;
  /**
   * What the text does about it: nothing ('none': the picture is over or under
   * it), goes down one side of it ('square'), or leaves the whole width of it
   * free ('topBottom').
   */
  wrap: 'none' | 'square' | 'topBottom';
  /** True when it is drawn under the text and not over it. */
  behind: boolean;
  /** Which sides of it the text may go down, when it goes round it: both, one, or whichever is wider. */
  side: 'both' | 'left' | 'right' | 'largest';
  /** The room kept clear between the picture and the text that goes round it, in points. */
  gap: { top: number; bottom: number; left: number; right: number };
}

const anchors = new Map<string, Anchor | null>();

/**
 * Placement of a floating picture, in points, and what the text does about
 * it. Undefined for anything else: an inline picture has its place in the line.
 */
export function anchoredObject(xml: string): Anchor | undefined {
  let anchor = anchors.get(xml);
  if (anchor === undefined) {
    anchor = null;
    const extent = /<wp:extent\b[^>]*>/.exec(xml)?.[0] ?? '';
    const cx = Number(/\bcx="(\d+)"/.exec(extent)?.[1]);
    const cy = Number(/\bcy="(\d+)"/.exec(extent)?.[1]);
    if (xml.includes('<wp:anchor') && cx > 0 && cy > 0) {
      const axis = (name: string) => {
        const node = new RegExp(`<wp:${name}\\b[^>]*relativeFrom="([^"]*)"[^>]*>(.*?)</wp:${name}>`, 's').exec(xml);
        const offset = Number(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/.exec(node?.[2] ?? '')?.[1] ?? 0);
        return { from: node?.[1] ?? '', offset: offset / EMU_PER_POINT, align: /<wp:align>(\w+)<\/wp:align>/.exec(node?.[2] ?? '')?.[1] };
      };
      const h = axis('positionH');
      const v = axis('positionV');
      // How the text goes round it is said by an element; the room to keep, by that element or by the anchor itself.
      const wrapTag = /<wp:wrap(None|Square|Tight|Through|TopAndBottom)\b[^>]*>/.exec(xml);
      const kind = wrapTag?.[1] ?? 'None';
      const open = /<wp:anchor\b[^>]*>/.exec(xml)?.[0] ?? '';
      const dist = (side: string) => Number(new RegExp(`\\bdist${side}="(\\d+)"`).exec(wrapTag?.[0] ?? '')?.[1] ?? new RegExp(`\\bdist${side}="(\\d+)"`).exec(open)?.[1] ?? 0) / EMU_PER_POINT;
      anchor = {
        width: cx / EMU_PER_POINT,
        height: cy / EMU_PER_POINT,
        fromX: h.from,
        fromY: v.from,
        x: h.offset,
        y: v.offset,
        // Round its outline is taken as round its box.
        wrap: kind === 'None' ? 'none' : kind === 'TopAndBottom' ? 'topBottom' : 'square',
        behind: /\bbehindDoc="(1|true)"/.test(open),
        side: ({ left: 'left', right: 'right', largest: 'largest' } as const)[/\bwrapText="(\w+)"/.exec(wrapTag?.[0] ?? '')?.[1] ?? ''] ?? 'both',
        gap: { top: dist('T'), bottom: dist('B'), left: dist('L'), right: dist('R') },
      };
      if (h.align) anchor.alignX = h.align;
      if (v.align) anchor.alignY = v.align;
    }
    if (anchors.size > 2000) anchors.clear();
    anchors.set(xml, anchor);
  }
  return anchor ?? undefined;
}

export interface EmbeddedFont {
  family: string;
  bold: boolean;
  italic: boolean;
  /** The font file, ready to load. */
  bytes: Uint8Array;
}

/**
 * The fonts a document carries with it. Word stores them obfuscated: the first
 * 32 bytes are XORed with the font's key, a GUID read backwards.
 */
export function embeddedFonts(source: DocxSource): EmbeddedFont[] {
  const dir = source.mainPath.slice(0, source.mainPath.lastIndexOf('/') + 1);
  const path = `${dir}fontTable.xml`;
  const part = source.files[path];
  if (!part) return [];
  const rels = relationships(source, path);
  const out: EmbeddedFont[] = [];
  for (const font of childrenOf(child(parseXml(strFromU8(part)), 'w:fonts'), 'w:font')) {
    const family = font.attrs['w:name'];
    for (const [name, bold, italic] of [
      ['w:embedRegular', false, false],
      ['w:embedBold', true, false],
      ['w:embedItalic', false, true],
      ['w:embedBoldItalic', true, true],
    ] as const) {
      const embed = child(font, name);
      const file = source.files[rels.get(embed?.attrs['r:id'] ?? '') ?? ''];
      const key = (embed?.attrs['w:fontKey'] ?? '').replace(/[^0-9a-fA-F]/g, '');
      if (!family || !file || file.length < 32) continue;
      const bytes = file.slice();
      if (key.length === 32) {
        for (let i = 0; i < 32; i++) bytes[i] ^= parseInt(key.slice(30 - 2 * (i % 16), 32 - 2 * (i % 16)), 16);
      }
      out.push({ family, bold, italic, bytes });
    }
  }
  return out;
}
