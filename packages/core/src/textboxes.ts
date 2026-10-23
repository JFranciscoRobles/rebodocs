// Text boxes: shapes on the page with paragraphs of their own, as Word draws
// them (`wps:txbx` in a DrawingML shape). The shape is the object of a run of
// the text, whose drawing says where it goes and how it looks; its text is a
// story of the document, `Doc.textBoxes`, found by the id of the drawing.

import { type Doc, type Paragraph, type Position, type RunProps, type Story, type TextBox, ANCHOR_CHAR, defined, resolveRun } from './model';
import { escapeXml } from './docx/xml';
import { insertText, propsAt } from './ops';

import type { TextBoxPart } from './docx/source';

export type { TextBoxPart };

/** The part the text of text box `id` is. */
export const textBoxPart = (id: string): TextBoxPart => `textbox:${id}`;

/** The id of the text box a part is the text of, when it is one. */
export const textBoxIdOf = (part: string): string | undefined => (part.startsWith('textbox:') ? part.slice('textbox:'.length) : undefined);

/** The id of the text box a run's object draws, when it draws one: the id its drawing gives itself. */
export function textBoxId(xml: string | undefined): string | undefined {
  if (!xml || !xml.includes('txbxContent')) return undefined;
  return /<wp:docPr\b[^>]*?\bid="(\d+)"/.exec(xml)?.[1];
}

export function textBoxOf(doc: Pick<Doc, 'textBoxes'>, id: string): TextBox | undefined {
  return doc.textBoxes?.find((box) => box.id === id);
}

/** The document with the text of box `id` replaced by `story`, or without the box when it is undefined. */
export function withTextBox<T extends Pick<Doc, 'textBoxes'>>(doc: T, id: string, story: Story | undefined): T {
  const others = (doc.textBoxes ?? []).filter((box) => box.id !== id);
  if (!story) {
    const { textBoxes: _, ...rest } = doc;
    return (others.length ? { ...rest, textBoxes: others } : rest) as T;
  }
  const made = defined<TextBox>({ id, paragraphs: story.paragraphs, tables: story.tables });
  const had = (doc.textBoxes ?? []).some((box) => box.id === id);
  return { ...doc, textBoxes: had ? doc.textBoxes!.map((box) => (box.id === id ? made : box)) : [...others, made] };
}

// --- How a text box looks ----------------------------------------------------------

export interface TextBoxLook {
  /** What fills it, as hex RGB; nothing for none. */
  fill?: string;
  /** The line round it. */
  line?: { color: string; width: number };
  /** The room between its edges and its text, in points: its own, and half the line round it. */
  inset: { top: number; right: number; bottom: number; left: number };
  /** Where its text goes when there is room to spare. */
  align: 'top' | 'middle' | 'bottom';
  /** Whether it is as tall as its text, as Word's "Resize shape to fit text": taller or shorter than its drawing says. */
  grows: boolean;
}

const EMU_PER_POINT = 12700;

/** The colours of the Office theme the colours of a shape may be named by. */
const THEME: Record<string, string> = {
  lt1: 'FFFFFF',
  bg1: 'FFFFFF',
  dk1: '000000',
  tx1: '000000',
  lt2: 'E7E6E6',
  bg2: 'E7E6E6',
  dk2: '44546A',
  tx2: '44546A',
  accent1: '4472C4',
  accent2: 'ED7D31',
  accent3: 'A5A5A5',
  accent4: 'FFC000',
  accent5: '5B9BD5',
  accent6: '70AD47',
};
const PRESET: Record<string, string> = { black: '000000', white: 'FFFFFF', red: 'FF0000', blue: '0000FF', green: '008000', gray: '808080' };

/** The colour a `solidFill`, or the reference of a style, gives. */
function colorIn(xml: string): string | undefined {
  const rgb = /<a:srgbClr\b[^>]*\bval="([0-9A-Fa-f]{6})"/.exec(xml)?.[1];
  if (rgb) return rgb.toUpperCase();
  const scheme = /<a:schemeClr\b[^>]*\bval="(\w+)"/.exec(xml)?.[1];
  if (scheme) return THEME[scheme] ?? '000000';
  const preset = /<a:prstClr\b[^>]*\bval="(\w+)"/.exec(xml)?.[1];
  if (preset) return PRESET[preset] ?? '000000';
  return undefined;
}

const looks = new Map<string, TextBoxLook>();

/** How the text box a drawing makes looks: what fills it, its line, and where its text goes inside it. */
export function textBoxLook(xml: string): TextBoxLook {
  let look = looks.get(xml);
  if (look) return look;
  const spPr = /<wps:spPr\b[^>]*>([\s\S]*?)<\/wps:spPr>/.exec(xml)?.[1] ?? '';
  const ln = /<a:ln\b([^>]*)(?:\/>|>([\s\S]*?)<\/a:ln>)/.exec(spPr);
  const withoutLine = ln ? spPr.replace(ln[0], '') : spPr;
  const style = /<wps:style>([\s\S]*?)<\/wps:style>/.exec(xml)?.[1] ?? '';
  const ref = (name: string) => {
    const found = new RegExp(`<a:${name}\\b[^>]*\\bidx="(\\d+)"[^>]*(?:/>|>([\\s\\S]*?)</a:${name}>)`).exec(style);
    return found && found[1] !== '0' ? (colorIn(found[2] ?? '') ?? '000000') : undefined;
  };
  const solid = /<a:solidFill>([\s\S]*?)<\/a:solidFill>/.exec(withoutLine);
  const fill = solid ? colorIn(solid[1]) : /<a:noFill\s*\/>/.test(withoutLine) ? undefined : ref('fillRef');
  let line: TextBoxLook['line'];
  if (ln) {
    const inner = ln[2] ?? '';
    const width = Number(/\bw="(\d+)"/.exec(ln[1])?.[1] ?? 9525) / EMU_PER_POINT;
    const color = /<a:noFill\s*\/>/.test(inner) ? undefined : (colorIn(inner) ?? ref('lnRef') ?? '000000');
    if (color) line = { color, width };
  } else {
    const color = ref('lnRef');
    if (color) line = { color, width: 0.75 };
  }
  const bodyPr = /<wps:bodyPr\b([^>]*)(?:\/>|>([\s\S]*?)<\/wps:bodyPr>)/.exec(xml);
  const attr = (name: string, fallback: number) => Number(new RegExp(`\\b${name}="(\\d+)"`).exec(bodyPr?.[1] ?? '')?.[1] ?? fallback) / EMU_PER_POINT;
  const anchor = /\banchor="(\w+)"/.exec(bodyPr?.[1] ?? '')?.[1];
  const half = (line?.width ?? 0) / 2;
  look = defined<TextBoxLook>({
    fill,
    line,
    // The text goes inside the line round the box, not under it: half the line more on each side. Measured against Word.
    inset: { top: attr('tIns', 45720) + half, right: attr('rIns', 91440) + half, bottom: attr('bIns', 45720) + half, left: attr('lIns', 91440) + half },
    align: anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top',
    grows: /<a:spAutoFit\s*\/>/.test(bodyPr?.[2] ?? ''),
  });
  if (looks.size > 500) looks.clear();
  looks.set(xml, look);
  return look;
}

// --- Putting one in ----------------------------------------------------------------

const NS = {
  mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
  wps: 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
};

/**
 * The drawing of a text box `width` by `height` points as Word makes one: in
 * a line round which the text goes, at the left of the column and the top of
 * its paragraph, white with a thin black line, and as tall as its text needs.
 * Its text is written into it when the document is.
 */
export function textBoxDrawingXml(id: string, width: number, height: number, name = `Cuadro de texto ${id}`): string {
  const cx = Math.round(width * EMU_PER_POINT);
  const cy = Math.round(height * EMU_PER_POINT);
  return (
    `<w:r><mc:AlternateContent xmlns:mc="${NS.mc}"><mc:Choice xmlns:wps="${NS.wps}" Requires="wps"><w:drawing>` +
    `<wp:anchor xmlns:wp="${NS.wp}" distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251659264" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">` +
    '<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH>' +
    '<wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>' +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapSquare wrapText="bothSides"/>` +
    `<wp:docPr id="${escapeXml(id)}" name="${escapeXml(name)}"/><wp:cNvGraphicFramePr/>` +
    `<a:graphic xmlns:a="${NS.a}"><a:graphicData uri="${NS.wps}"><wps:wsp><wps:cNvSpPr txBox="1"/>` +
    `<wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    '<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="6350"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></wps:spPr>' +
    '<wps:txbx><w:txbxContent></w:txbxContent></wps:txbx>' +
    '<wps:bodyPr rot="0" vert="horz" wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="t" anchorCtr="0"><a:spAutoFit/></wps:bodyPr>' +
    '</wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice></mc:AlternateContent></w:r>'
  );
}

/** Every id the drawings of the document give themselves: a new one must not be one of them. */
export function drawingIds(doc: Doc): number[] {
  const ids: number[] = [];
  const scan = (paragraphs: Paragraph[]) => {
    for (const p of paragraphs) for (const run of p.runs) for (const found of run.props.object?.matchAll(/<wp:docPr\b[^>]*?\bid="(\d+)"/g) ?? []) ids.push(Number(found[1]));
  };
  scan(doc.paragraphs);
  for (const story of [doc.header, doc.footer, doc.firstPage?.header, doc.firstPage?.footer, ...(doc.footnotes ?? []), ...(doc.endnotes ?? []), ...(doc.textBoxes ?? [])])
    if (story) scan(story.paragraphs);
  for (const p of doc.paragraphs) for (const story of [p.section?.header, p.section?.footer, p.section?.firstPage?.header, p.section?.firstPage?.footer]) if (story) scan(story.paragraphs);
  return ids;
}

/**
 * Puts a text box at `pos`: anchored to its paragraph, at the left of the
 * column, `width` by `height` points, saying `text`. Returns the document,
 * where the caret goes after its anchor, and the id of the box.
 */
export function insertTextBox(doc: Doc, pos: Position, options: { width?: number; height?: number; text?: string } = {}): { doc: Doc; pos: Position; id: string } {
  const id = String(Math.max(9500, ...drawingIds(doc)) + 1);
  const like = propsAt(doc, pos);
  const { opaque: _, wrap: __, object: ___, anchor: ____, field: _____, ...plain } = like;
  const xml = textBoxDrawingXml(id, options.width ?? 144, options.height ?? 54);
  const inserted = insertText(doc, pos, ANCHOR_CHAR, { ...plain, object: xml, anchor: true });
  const run: RunProps = defined({ fontFamily: resolveRun(plain).fontFamily, fontSize: plain.fontSize });
  const box: TextBox = { id, paragraphs: [{ props: { spacingBefore: 0, spacingAfter: 0 }, runs: [{ text: options.text ?? '', props: run }] }] };
  return { doc: { ...inserted.doc, textBoxes: [...(inserted.doc.textBoxes ?? []), box] }, pos: inserted.pos, id };
}

/** The ids of the text boxes some run of the document draws, in the order they come. */
export function drawnTextBoxes(doc: Doc): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const scan = (paragraphs: Paragraph[]) => {
    for (const p of paragraphs)
      for (const run of p.runs) {
        const id = textBoxId(run.props.object);
        if (id !== undefined && !seen.has(id)) {
          seen.add(id);
          out.push(id);
        }
      }
  };
  scan(doc.paragraphs);
  for (const story of [doc.header, doc.footer, doc.firstPage?.header, doc.firstPage?.footer, ...(doc.footnotes ?? []), ...(doc.endnotes ?? []), ...(doc.textBoxes ?? [])])
    if (story) scan(story.paragraphs);
  for (const p of doc.paragraphs) for (const story of [p.section?.header, p.section?.footer, p.section?.firstPage?.header, p.section?.firstPage?.footer]) if (story) scan(story.paragraphs);
  return out;
}
