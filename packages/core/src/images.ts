// Pictures in the text: putting one in, changing its size and moving it. A
// picture is one character of a run whose `object` is its drawing XML, as for
// the ones a file brings. The bytes of a picture put in here are kept in
// `doc.media` until export writes them into the package.

import { insertTable, setCellProps } from './tables';
import { type Doc, type Media, type Paragraph, type Position, type Run, type RunProps, ANCHOR_CHAR, OBJECT_CHAR, defined } from './model';
import { normalizeRuns, propsAt, sliceRuns } from './ops';
import { type Anchor, type DocxSource, type StoryPart, anchoredObject, imageInPart } from './docx/source';
import { storyPath } from './stories';
import { decodeEntities, escapeXml } from './docx/xml';
import { jpegSize } from './png';

const EMU_PER_POINT = 12700;
/** What stands for the relationship id of a picture that is not in a package yet: this and its key in `doc.media`. */
const NEW = 'dx:';

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif' };

/**
 * The kind of picture some bytes are, by how they start, for one that came
 * without saying: a PNG, a JPEG or a GIF; undefined for anything else.
 */
export function imageTypeOf(bytes: Uint8Array): string | undefined {
  const starts = (...head: number[]) => head.every((byte, i) => bytes[i] === byte);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return 'image/png';
  if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (starts(0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  return undefined;
}

/** The file extension for a kind of picture that can be put in a document, or undefined. */
export function imageExtension(type: string): string | undefined {
  return EXTENSIONS[type];
}

/** The key in `doc.media` of the picture an object embeds, when it was put in here. */
export function mediaKey(xml: string): string | undefined {
  const id = /\br:embed="([^"]+)"/.exec(xml)?.[1];
  return id?.startsWith(NEW) ? id.slice(NEW.length) : undefined;
}

function drawingXml(key: string, n: number, width: number, height: number): string {
  const cx = Math.round(width * EMU_PER_POINT);
  const cy = Math.round(height * EMU_PER_POINT);
  return (
    '<w:r><w:drawing>' +
    '<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Imagen ${n}"/>` +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="${n}" name="Imagen ${n}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${NEW}${key}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
  );
}

/** The run at `pos` when it is a picture that takes room in the line. */
export function pictureAt(doc: Doc, pos: Position): Run | undefined {
  let offset = 0;
  for (const run of doc.paragraphs[pos.para]?.runs ?? []) {
    if (pos.offset >= offset && pos.offset < offset + run.text.length) {
      return run.props.object && !run.props.anchor && (run.props.objectWidth ?? 0) > 0 ? run : undefined;
    }
    offset += run.text.length;
  }
  return undefined;
}

const length = (p: Paragraph) => p.runs.reduce((n, run) => n + run.text.length, 0);

/** The paragraph with `runs` put in at `offset`. */
function withRuns(p: Paragraph, offset: number, runs: Run[]): Paragraph {
  const all = [...sliceRuns(p.runs, 0, offset), ...runs, ...sliceRuns(p.runs, offset, length(p))];
  return { ...p, runs: normalizeRuns(all, p.runs[0].props) };
}

function replaceParagraph(doc: Doc, para: number, p: Paragraph): Doc {
  const paragraphs = doc.paragraphs.slice();
  paragraphs[para] = p;
  return { ...doc, paragraphs };
}

/**
 * Puts a picture in the text at `pos`, `width` by `height` points. Returns
 * the document and the position after the picture.
 */
export function insertImage(doc: Doc, pos: Position, image: Media & { width: number; height: number }): { doc: Doc; pos: Position } {
  if (!imageExtension(image.type) || !(image.width > 0) || !(image.height > 0)) return { doc, pos };
  const media = { ...doc.media };
  let n = Object.keys(media).length + 1;
  while (media[`imagen${n}`]) n++;
  const key = `imagen${n}`;
  media[key] = { bytes: image.bytes, type: image.type };
  const p = withRuns(doc.paragraphs[pos.para], pos.offset, [pictureRun(key, n, image.width, image.height, propsAt(doc, pos))]);
  return { doc: { ...replaceParagraph(doc, pos.para, p), media }, pos: { para: pos.para, offset: pos.offset + 1 } };
}

/**
 * A picture as a run of the text, its bytes under `key` in `doc.media`, `n`
 * its number among the pictures put in here; set in the font of `like`, so
 * its line keeps its height. What insertImage puts in, and what a template
 * puts in place of a {{name | image}}.
 */
export function pictureRun(key: string, n: number, width: number, height: number, like: RunProps = {}): Run {
  // Ids of drawings must not clash with the ones a file has: these start high.
  const xml = drawingXml(key, 9000 + n, width, height);
  return { text: OBJECT_CHAR, props: defined({ fontFamily: like.fontFamily, fontSize: like.fontSize, object: xml, anchor: false, objectWidth: width, objectHeight: height }) };
}

/** A run put at a place of the text, as one piece. */
export function putRun(doc: Doc, pos: Position, run: Run): Doc {
  return replaceParagraph(doc, pos.para, withRuns(doc.paragraphs[pos.para], pos.offset, [run]));
}

/** How many pixels across and down a PNG, a JPEG or a GIF is, by its header; undefined for anything else. */
export function pictureSize(bytes: Uint8Array, type: string): { width: number; height: number } | undefined {
  const at = (i: number) => bytes[i] ?? 0;
  if (type === 'image/png' && bytes.length >= 24) {
    const size = { width: (at(16) << 24) | (at(17) << 16) | (at(18) << 8) | at(19), height: (at(20) << 24) | (at(21) << 16) | (at(22) << 8) | at(23) };
    return size.width > 0 && size.height > 0 ? size : undefined;
  }
  if (type === 'image/gif' && bytes.length >= 10) {
    const size = { width: at(6) | (at(7) << 8), height: at(8) | (at(9) << 8) };
    return size.width > 0 && size.height > 0 ? size : undefined;
  }
  if (type === 'image/jpeg') return jpegSize(bytes);
  return undefined;
}

/** Gives the picture at `pos` another size, in points. */
export function resizePicture(doc: Doc, pos: Position, width: number, height: number): Doc {
  const run = pictureAt(doc, pos);
  if (!run || !(width > 0) || !(height > 0)) return doc;
  const xml = sized(run.props.object!, width, height);
  const p = doc.paragraphs[pos.para];
  const resized: Run = { text: OBJECT_CHAR, props: { ...run.props, object: xml, objectWidth: width, objectHeight: height } };
  const without = { ...p, runs: [...sliceRuns(p.runs, 0, pos.offset), ...sliceRuns(p.runs, pos.offset + 1, length(p))] };
  return replaceParagraph(doc, pos.para, withRuns({ ...without, runs: without.runs.length ? without.runs : [{ text: '', props: p.runs[0].props }] }, pos.offset, [resized]));
}

// --- Alternative text ---------------------------------------------------------------
// What a picture or a shape is, for whoever cannot see it: Word's "Alt Text",
// kept in the drawing as the description of its properties (wp:docPr descr).

const DOC_PR = /<wp:docPr\b[^>]*?>/;

/** The description of a drawing for whoever cannot see it, as Word keeps it; undefined when it has none. */
export function altText(xml: string | undefined): string | undefined {
  const tag = xml && DOC_PR.exec(xml)?.[0];
  const descr = tag && /\bdescr="([^"]*)"/.exec(tag)?.[1];
  return descr ? decodeEntities(descr) : undefined;
}

/** Whether Word was told the drawing is only there to look at ("Mark as decorative"): it has nothing to say, and a reader skips it. */
export function isDecorative(xml: string | undefined): boolean {
  return !!xml && /<(?:\w+:)?decorative\b[^>]*\bval="(?:1|true)"/.test(xml);
}

/** Gives the picture or the shape at `pos`, in the line or floating, a description for whoever cannot see it; an empty one takes it away. */
export function setAltText(doc: Doc, pos: Position, text: string): Doc {
  const run = runAt(doc, pos);
  const xml = run?.props.object;
  const tag = xml && DOC_PR.exec(xml)?.[0];
  if (!run || !xml || !tag) return doc;
  const without = tag.replace(/\s+descr="[^"]*"/, '');
  const value = text.replace(/\s+/g, ' ').trim();
  const next = value ? without.replace(/^<wp:docPr\b/, `<wp:docPr descr="${escapeXml(value)}"`) : without;
  if (next === tag) return doc;
  const p = doc.paragraphs[pos.para];
  return replaceParagraph(doc, pos.para, { ...p, runs: p.runs.map((one) => (one === run ? { ...run, props: { ...run.props, object: xml.replace(tag, next) } } : one)) });
}

// --- Floating pictures ------------------------------------------------------------
// One that is not in the line: it is anchored at a place of the text, which a
// mark with no width stands for, and put on the page where its anchor says.

function runAt(doc: Doc, pos: Position): Run | undefined {
  let offset = 0;
  for (const run of doc.paragraphs[pos.para]?.runs ?? []) {
    if (pos.offset >= offset && pos.offset < offset + run.text.length) return run;
    offset += run.text.length;
  }
  return undefined;
}

/** The floating picture whose anchor is at `pos`: where it goes and what the text does about it. */
export function floatAt(doc: Doc, pos: Position): Anchor | undefined {
  const run = runAt(doc, pos);
  return run?.props.object && run.props.anchor ? anchoredObject(run.props.object) : undefined;
}

/** The document with the drawing of the floating picture at `pos` rewritten by `change`. */
function redrawn(doc: Doc, pos: Position, change: (xml: string, anchor: Anchor) => string): Doc {
  const anchor = floatAt(doc, pos);
  const run = runAt(doc, pos);
  if (!anchor || !run) return doc;
  const xml = change(run.props.object!, anchor);
  if (xml === run.props.object) return doc;
  const p = doc.paragraphs[pos.para];
  const made: Run = { text: run.text.slice(0, 1), props: { ...run.props, object: xml } };
  const without = [...sliceRuns(p.runs, 0, pos.offset), made, ...sliceRuns(p.runs, pos.offset + 1, length(p))];
  return replaceParagraph(doc, pos.para, { ...p, runs: without });
}

const sized = (xml: string, width: number, height: number): string => {
  const cx = Math.round(width * EMU_PER_POINT);
  const cy = Math.round(height * EMU_PER_POINT);
  // The size is said twice in a drawing: for the room it takes and for the picture itself.
  const size = (tag: string) => tag.replace(/\bcx="\d+"/, `cx="${cx}"`).replace(/\bcy="\d+"/, `cy="${cy}"`);
  return xml.replace(/<wp:extent\b[^>]*>/, size).replace(/(<a:xfrm\b[^>]*>(?:<a:off\b[^>]*\/>)?)(<a:ext\b[^>]*>)/, (_, lead: string, ext: string) => lead + size(ext));
};

/** Gives the floating picture at `pos` another size, in points. */
export function resizeFloat(doc: Doc, pos: Position, width: number, height: number): Doc {
  if (!(width > 0) || !(height > 0)) return doc;
  return redrawn(doc, pos, (xml) => sized(xml, width, height));
}

/**
 * Moves the floating picture at `pos` by `dx` and `dy` points. It stays
 * anchored where it was, and measured from what it was measured from: only
 * how far from it changes. One that was aligned (centred, say) is from then
 * on at a distance.
 */
export function moveFloat(doc: Doc, pos: Position, dx: number, dy: number): Doc {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return doc;
  const { width, marginLeft, marginRight } = doc.page;
  return redrawn(doc, pos, (xml, anchor) => {
    const span = anchor.fromX === 'page' ? width : width - marginLeft - marginRight;
    const x = anchor.alignX === 'center' ? (span - anchor.width) / 2 : anchor.alignX === 'right' ? span - anchor.width : anchor.alignX ? 0 : anchor.x;
    const place = (name: string, from: string, offset: number) => (whole: string) =>
      /relativeFrom=/.test(whole) ? `<wp:${name} relativeFrom="${from}"><wp:posOffset>${Math.round(offset * EMU_PER_POINT)}</wp:posOffset></wp:${name}>` : whole;
    return xml
      .replace(/<wp:positionH\b[^>]*>.*?<\/wp:positionH>/s, place('positionH', anchor.fromX || 'column', x + dx))
      .replace(/<wp:positionV\b[^>]*>.*?<\/wp:positionV>/s, place('positionV', anchor.fromY || 'paragraph', anchor.y + dy));
  });
}

/**
 * How a picture sits in the text: in the line like a letter ('inline'), or
 * floating, with the text going round it ('square'), leaving its whole width
 * free ('topBottom'), running under it ('none') or over it ('behind').
 */
export type PictureWrap = 'inline' | 'square' | 'topBottom' | 'none' | 'behind';

const WRAPS: Record<Anchor['wrap'], string> = {
  square: '<wp:wrapSquare wrapText="bothSides"/>',
  topBottom: '<wp:wrapTopAndBottom/>',
  none: '<wp:wrapNone/>',
};

/** How the picture at `pos` sits in the text; undefined when there is none there. */
export function pictureWrap(doc: Doc, pos: Position): PictureWrap | undefined {
  if (pictureAt(doc, pos)) return 'inline';
  const anchor = floatAt(doc, pos);
  return anchor && (anchor.wrap === 'none' && anchor.behind ? 'behind' : anchor.wrap);
}

/** The drawing of a floating picture with what the text does about it said another way. */
function rewrapped(xml: string, wrap: Exclude<PictureWrap, 'inline'>): string {
  const element = WRAPS[wrap === 'behind' ? 'none' : wrap];
  const was = /<wp:wrap(\w+)\b[^>]*\/>|<wp:wrap(\w+)\b[^>]*>.*?<\/wp:wrap\2>/s;
  // The room to keep round it is said on the anchor too, where it stays. Without one, it goes after
  // the size of the picture and what its effects add to it.
  const out = was.test(xml) ? xml.replace(was, element) : xml.replace(/(<wp:effectExtent\b[^>]*\/>|<wp:extent\b[^>]*\/>)(?!\s*<wp:effectExtent)/, (found) => found + element);
  const behind = wrap === 'behind' ? '1' : '0';
  return out.replace(/<wp:anchor\b[^>]*>/, (open) =>
    /\bbehindDoc="/.test(open) ? open.replace(/\bbehindDoc="[^"]*"/, `behindDoc="${behind}"`) : open.replace('<wp:anchor', `<wp:anchor behindDoc="${behind}"`),
  );
}

/** The namespaces an element declares for itself, which what takes its place has to declare too. */
const namespaces = (attrs: string) => (attrs.match(/\sxmlns:\w+="[^"]*"/g) ?? []).join('');

/** What a floating picture needs said that one in the line does not: where it is, measured from its paragraph. */
const FLOATING =
  ' distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">' +
  '<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>';

/**
 * Makes the picture at `pos` sit in the text as `wrap` says. One in the line
 * that becomes a floating one starts at the top left of its paragraph; a
 * floating one that goes into the line goes where its anchor is.
 */
export function setPictureWrap(doc: Doc, pos: Position, wrap: PictureWrap): Doc {
  const now = pictureWrap(doc, pos);
  const run = runAt(doc, pos);
  if (!now || !run || now === wrap) return doc;
  const p = doc.paragraphs[pos.para];
  const put = (made: Run) => replaceParagraph(doc, pos.para, { ...p, runs: [...sliceRuns(p.runs, 0, pos.offset), made, ...sliceRuns(p.runs, pos.offset + 1, length(p))] });
  const xml = run.props.object!;
  if (now !== 'inline' && wrap !== 'inline') return put({ text: ANCHOR_CHAR, props: { ...run.props, object: rewrapped(xml, wrap) } });
  if (wrap === 'inline') {
    const anchor = floatAt(doc, pos)!;
    // What says where it floats goes; what the picture is, stays.
    const made = xml.replace(/<wp:anchor\b([^>]*)>(.*?)<\/wp:anchor>/s, (_, attrs: string, inner: string) => {
      const kept = inner.replace(/<wp:simplePos\b[^>]*\/>|<wp:position[HV]\b[^>]*>.*?<\/wp:position[HV]>|<wp:wrap(\w+)\b[^>]*\/>|<wp:wrap(\w+)\b[^>]*>.*?<\/wp:wrap\2>/gs, '');
      return `<wp:inline${namespaces(attrs)} distT="0" distB="0" distL="0" distR="0">${kept}</wp:inline>`;
    });
    if (made === xml) return doc;
    return put({ text: OBJECT_CHAR, props: { ...run.props, object: made, anchor: false, objectWidth: anchor.width, objectHeight: anchor.height } });
  }
  const made = xml.replace(
    /<wp:inline\b([^>]*)>(\s*<wp:extent\b[^>]*\/>(?:\s*<wp:effectExtent\b[^>]*\/>)?)(.*?)<\/wp:inline>/s,
    (_, attrs: string, size: string, rest: string) => `<wp:anchor${namespaces(attrs)}${FLOATING}${size}${WRAPS.square}${rest}</wp:anchor>`,
  );
  if (made === xml) return doc;
  const { objectWidth: _w, objectHeight: _h, ...props } = run.props;
  return put({ text: ANCHOR_CHAR, props: { ...props, object: wrap === 'square' ? made : rewrapped(made, wrap), anchor: true, objectWidth: 0, objectHeight: 0 } });
}

/**
 * Anchors the floating picture at `from` at `to` instead: another place of
 * the text, which it is then measured from. Returns the document and where
 * its anchor is now.
 */
export function reanchorFloat(doc: Doc, from: Position, to: Position): { doc: Doc; pos: Position } {
  const run = runAt(doc, from);
  if (!floatAt(doc, from) || !run || !doc.paragraphs[to.para]) return { doc, pos: from };
  const same = from.para === to.para;
  if (same && (to.offset === from.offset || to.offset === from.offset + 1)) return { doc, pos: from };
  const source = doc.paragraphs[from.para];
  const rest = [...sliceRuns(source.runs, 0, from.offset), ...sliceRuns(source.runs, from.offset + 1, length(source))];
  const { object: _o, anchor: _a, objectWidth: _w, objectHeight: _h, ...plain } = source.runs[0].props;
  const moved = replaceParagraph(doc, from.para, { ...source, runs: normalizeRuns(rest, plain) });
  const at = same && to.offset > from.offset ? to.offset - 1 : to.offset;
  const target = moved.paragraphs[to.para];
  const made: Run = { text: run.text.slice(0, 1), props: run.props };
  return { doc: replaceParagraph(moved, to.para, { ...target, runs: [...sliceRuns(target.runs, 0, at), made, ...sliceRuns(target.runs, at, length(target))] }), pos: { para: to.para, offset: at } };
}

/** Moves the picture at `from` to `to`. Returns the document and where the picture is now. */
export function movePicture(doc: Doc, from: Position, to: Position): { doc: Doc; pos: Position } {
  const run = pictureAt(doc, from);
  const same = from.para === to.para;
  if (!run || (same && (to.offset === from.offset || to.offset === from.offset + 1))) return { doc, pos: from };
  const source = doc.paragraphs[from.para];
  const rest = [...sliceRuns(source.runs, 0, from.offset), ...sliceRuns(source.runs, from.offset + 1, length(source))];
  // A paragraph left empty keeps the look of the text around the picture, not the picture's own nature.
  const { object: _o, anchor: _a, objectWidth: _w, objectHeight: _h, ...plain } = source.runs[0].props;
  const taken: Paragraph = { ...source, runs: normalizeRuns(rest, plain) };
  // Taking it out moves what came after it in its paragraph one place back.
  const at = same && to.offset > from.offset ? to.offset - 1 : to.offset;
  const moved = replaceParagraph(doc, from.para, taken);
  const target = moved.paragraphs[to.para];
  return { doc: replaceParagraph(moved, to.para, withRuns(target, at, [{ text: OBJECT_CHAR, props: run.props }])), pos: { para: to.para, offset: at } };
}

/** The picture an object embeds: one put in here, or one of the package the document came from. */
export function docImage(doc: Pick<Doc, 'media' | 'paragraphs'> & { source?: DocxSource }, xml: string, part?: StoryPart): Media | undefined {
  const key = mediaKey(xml);
  if (key !== undefined) return doc.media?.[key];
  return doc.source ? imageInPart(doc.source, xml, part ? storyPath(doc, part) : doc.source.mainPath) : undefined;
}

/** The room, in points, above and below each picture of a grid. */
const GRID_GAP = 3;
/** The most columns a grid of pictures can have. */
export const MAX_GRID_COLUMNS = 6;

/**
 * Puts several pictures in at `pos` as a grid of `columns` across, in the
 * order given: a table without borders with one picture in each cell, every
 * one as large as fits a square of the width of its column, and centred.
 * Returns the document and the position below the grid.
 */
export function insertImageGrid(doc: Doc, pos: Position, images: (Media & { width: number; height: number })[], columns: number): { doc: Doc; pos: Position } {
  const good = images.filter((image) => imageExtension(image.type) && image.width > 0 && image.height > 0);
  if (!good.length) return { doc, pos };
  const across = Math.max(1, Math.min(Math.round(columns), MAX_GRID_COLUMNS, good.length));
  const rows = Math.ceil(good.length / across);
  const made = insertTable(doc, pos, rows, across);
  const table = made.doc.tables?.[made.doc.tables.length - 1];
  if (made.doc === doc || !table) return { doc, pos };
  const first = made.pos.para;
  const side = table.columns[0] - table.padLeft - table.padRight;
  // A picture alone in a column must still leave room on its page for the lines around it.
  const tall = Math.min(side, doc.page.height - doc.page.marginTop - doc.page.marginBottom - 48);
  let next = made.doc;
  good.forEach((image, i) => {
    const cell = next.paragraphs[first + i];
    const centred: Paragraph = { ...cell, props: { ...cell.props, align: 'center', spacingBefore: GRID_GAP, spacingAfter: GRID_GAP } };
    const scale = Math.min(side / image.width, tall / image.height);
    next = insertImage(replaceParagraph(next, first + i, centred), { para: first + i, offset: 0 }, { ...image, width: image.width * scale, height: image.height * scale }).doc;
  });
  const last = first + rows * across - 1;
  return { doc: setCellProps(next, first, last, { borders: false }), pos: { para: last + 1, offset: 0 } };
}
