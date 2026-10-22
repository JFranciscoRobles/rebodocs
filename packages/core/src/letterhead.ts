// The letterhead of a document: one picture the size of the page, under the
// text of every page, with the logo, the pattern and the address a company
// prints its paper with. It is what Word has when a picture is put in the
// header, behind the text and measured from the page: a document made here
// with one opens there with it, and one that came with it is found here.

import { type Doc, type Media, type PageSetup, type Paragraph, type Run, type Story, ANCHOR_CHAR } from './model';
import { type StoryPart, anchoredObject } from './docx/source';
import { docImage, imageExtension } from './images';
import { propsAt } from './ops';
import { sectionEnds, sectionPart, storyOf, withStory } from './stories';
import { drawingIds } from './textboxes';
import { decodePng } from './png';

const EMU_PER_POINT = 12700;
/** How much of the page a picture behind the text has to cover to be its letterhead, and not a picture in the header. */
const WHOLE = 0.85;

export interface Letterhead {
  /** The header it is in, and where in it. */
  part: StoryPart;
  para: number;
  offset: number;
  xml: string;
}

/** A header a letterhead can be in, and the page it covers there. */
interface Place {
  part: StoryPart;
  page: PageSetup;
}

function isLetterhead(page: PageSetup, run: Run): boolean {
  if (!run.props.anchor || !run.props.object) return false;
  const anchor = anchoredObject(run.props.object);
  return !!anchor && anchor.behind && anchor.wrap === 'none' && anchor.fromX === 'page' && anchor.fromY === 'page' && anchor.width >= page.width * WHOLE && anchor.height >= page.height * WHOLE;
}

function find(doc: Doc, { part, page }: Place): Letterhead | undefined {
  const paragraphs = storyOf(doc, part)?.paragraphs ?? [];
  for (let para = 0; para < paragraphs.length; para++) {
    let offset = 0;
    for (const run of paragraphs[para].runs) {
      if (isLetterhead(page, run)) return { part, para, offset, xml: run.props.object! };
      offset += run.text.length;
    }
  }
  return undefined;
}

/**
 * The headers a letterhead goes in: the one of every page, the first page's
 * own when it has its own, and those of each section that does not show the
 * document's, on the page of that section.
 */
function places(doc: Doc): Place[] {
  const out: Place[] = [{ part: 'header', page: doc.page }];
  if (doc.firstPage) out.push({ part: 'firstHeader', page: doc.page });
  sectionEnds(doc).forEach((para, k) => {
    const section = doc.paragraphs[para].section!;
    if (section.header || section.noHeader) out.push({ part: sectionPart('header', k), page: section.page });
    if (section.firstPage) out.push({ part: sectionPart('firstHeader', k), page: section.page });
  });
  return out;
}

/** The letterhead of the document, when it has one. */
export function letterheadOf(doc: Doc): Letterhead | undefined {
  for (const place of places(doc)) {
    const found = find(doc, place);
    if (found) return found;
  }
  return undefined;
}

/** The picture the letterhead is. */
export function letterheadImage(doc: Doc): Media | undefined {
  const found = letterheadOf(doc);
  return found && docImage(doc, found.xml, found.part);
}

function drawing(key: string, n: number, width: number, height: number): string {
  const cx = Math.round(width * EMU_PER_POINT);
  const cy = Math.round(height * EMU_PER_POINT);
  return (
    '<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>' +
    '<wp:anchor xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">' +
    '<wp:simplePos x="0" y="0"/>' +
    '<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>' +
    '<wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV>' +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="${n}" name="Membrete"/><wp:cNvGraphicFramePr/>` +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="${n}" name="Membrete"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="dx:${key}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    '</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>'
  );
}

/** `doc` with the run of `found` changed by `change`, or taken out when it gives nothing. */
function withRun(doc: Doc, found: Letterhead, change: (run: Run) => Run | undefined): Doc {
  const story = storyOf(doc, found.part)!;
  const p = story.paragraphs[found.para];
  let offset = 0;
  const runs: Run[] = [];
  for (const run of p.runs) {
    const at = found.offset - offset;
    offset += run.text.length;
    if (at < 0 || at >= run.text.length) {
      runs.push(run);
      continue;
    }
    // The picture is one character of its run; what is before and after it stays.
    const before = run.text.slice(0, at);
    const after = run.text.slice(at + 1);
    if (before) runs.push({ ...run, text: before });
    const changed = change({ ...run, text: run.text[at] });
    if (changed) runs.push(changed);
    if (after) runs.push({ ...run, text: after });
  }
  // A paragraph always has a run; the one left takes the look of the text, not of the picture that was there.
  const { object: _o, anchor: _a, objectWidth: _w, objectHeight: _h, ...plain } = p.runs[0].props;
  const paragraphs = story.paragraphs.slice();
  paragraphs[found.para] = { ...p, runs: runs.length ? runs : [{ text: '', props: plain }] };
  return withStory(doc, found.part, { ...story, paragraphs });
}

function without(doc: Doc): Doc {
  let out = doc;
  for (const place of places(doc)) for (let found = find(out, place); found; found = find(out, place)) out = withRun(out, found, () => undefined);
  return out;
}

/**
 * The letterhead of the headers of a page made the size of a page of `width`
 * by `height` points, as when the paper or its orientation changes: it is the
 * size of the page, and stays so. `section` is the index of the section whose
 * page changes, for one before the last; the last's are the document's.
 */
export function resizeLetterhead(doc: Doc, width: number, height: number, section?: number): Doc {
  let out = doc;
  const cx = Math.round(width * EMU_PER_POINT);
  const cy = Math.round(height * EMU_PER_POINT);
  const mine = (part: StoryPart) => (section === undefined ? !part.includes('@') : part.endsWith(`@${section}`));
  for (const place of places(doc)) {
    if (!mine(place.part)) continue;
    const found = find(out, place);
    if (!found) continue;
    const xml = found.xml.replace(/<wp:extent cx="\d+" cy="\d+"\/>/, `<wp:extent cx="${cx}" cy="${cy}"/>`).replace(/(<a:xfrm>(?:(?!<\/a:xfrm>)[\s\S])*?<a:ext )cx="\d+" cy="\d+"/, `$1cx="${cx}" cy="${cy}"`);
    if (xml !== found.xml) out = withRun(out, found, (run) => ({ ...run, props: { ...run.props, object: xml } }));
  }
  return out;
}

/** The document without its letterhead. What else its header has stays. */
export function removeLetterhead(doc: Doc): Doc {
  return letterheadOf(doc) ? without(doc) : doc;
}

/**
 * Gives the document a letterhead: `image`, stretched over the whole page,
 * under the text of every page, the first pages and those of sections with a
 * header of their own too. The one it had is taken away. A picture of a kind
 * that cannot be put in a document leaves it as it was.
 */
export function setLetterhead(doc: Doc, image: Media): Doc {
  if (!imageExtension(image.type) || !image.bytes.length) return doc;
  let out = without(doc);
  const media = { ...out.media };
  let n = Object.keys(media).length + 1;
  while (media[`membrete${n}`]) n++;
  const key = `membrete${n}`;
  media[key] = { bytes: image.bytes, type: image.type };
  out = { ...out, media };
  const like = propsAt(doc, { para: 0, offset: 0 });
  // Each drawing has an id of its own, none of those the document has; these start high.
  let id = Math.max(9500, ...drawingIds(out));
  for (const { part, page } of places(out)) {
    const run: Run = { text: ANCHOR_CHAR, props: { fontFamily: like.fontFamily, fontSize: like.fontSize, object: drawing(key, ++id, page.width, page.height), anchor: true } };
    const story: Story | undefined = storyOf(out, part);
    const first: Paragraph | undefined = story?.paragraphs[0];
    const paragraphs = first ? [{ ...first, runs: [run, ...first.runs] }, ...story!.paragraphs.slice(1)] : [{ props: {}, runs: [run] }];
    out = withStory(out, part, { ...story, paragraphs });
  }
  return out;
}

/** The pixels of a picture, four bytes each: red, green, blue and how solid. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/** The room kept between what a letterhead prints and the text, in points. */
const CLEAR = 18;
/** How far down the page what is printed at its top may start and end, and the same from the bottom, as parts of its height. */
const EDGE = 0.2;
const REACH = 0.35;
/** Two printed things further apart than this part of the height are two things, not one. */
const GAP = 0.03;

/**
 * The margins a letterhead asks for, in points: where what it prints at the
 * top of the page ends, and where what it prints at the bottom starts, with
 * some room. What is faint (a pattern under the text) is not in the way, and
 * neither is what is printed in the middle of the page. A side with nothing
 * printed asks for nothing.
 */
export function letterheadMargins(pixels: Pixels, page: { height: number }): { top?: number; bottom?: number } {
  const { width, height, data } = pixels;
  if (!(width > 0) || !(height > 0) || data.length < width * height * 4) return {};
  const light = (i: number) => {
    const solid = data[i + 3] / 255;
    // What shows through is the paper, which is white.
    return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) * solid + 255 * (1 - solid);
  };
  // The paper is the tone there is most of.
  const tones = new Uint32Array(256);
  for (let i = 0; i < width * height * 4; i += 4) tones[Math.round(light(i))]++;
  let paper = 255;
  for (let tone = 0; tone < 256; tone++) if (tones[tone] > tones[paper]) paper = tone;
  const need = Math.max(2, Math.round(width * 0.006));
  const printed: boolean[] = [];
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width && count < need; x++) if (Math.abs(light((y * width + x) * 4) - paper) > 60) count++;
    printed.push(count >= need);
  }
  // Stretches of printed rows, joined when what is between them is short.
  const blocks: { from: number; to: number }[] = [];
  for (let y = 0; y < height; y++) {
    if (!printed[y]) continue;
    const last = blocks[blocks.length - 1];
    if (last && y - last.to <= height * GAP) last.to = y;
    else blocks.push({ from: y, to: y });
  }
  const out: { top?: number; bottom?: number } = {};
  const scale = page.height / height;
  const above = blocks.filter((b) => b.from < height * EDGE && b.to < height * REACH).pop();
  if (above) out.top = (above.to + 1) * scale + CLEAR;
  const below = blocks.find((b) => b.to >= height * (1 - EDGE) && b.from >= height * (1 - REACH));
  if (below) out.bottom = (height - below.from) * scale + CLEAR;
  return out;
}

/**
 * The margins a PNG asks for as a letterhead, read without a browser, as on a
 * server; undefined for a picture whose pixels are not read here, as a JPEG.
 */
export function pngLetterheadMargins(bytes: Uint8Array, page: { height: number }): { top?: number; bottom?: number } | undefined {
  const png = decodePng(bytes);
  if (!png) return undefined;
  const { width, height, rgb, alpha } = png;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = rgb[i * 3];
    data[i * 4 + 1] = rgb[i * 3 + 1];
    data[i * 4 + 2] = rgb[i * 3 + 2];
    data[i * 4 + 3] = alpha ? alpha[i] : 255;
  }
  return letterheadMargins({ width, height, data }, page);
}

/**
 * The document with its top and bottom margins grown to what a letterhead
 * asks for: they only grow, never past 40% of the page, so that room is left
 * for the text; to the twentieth of a point, which is what a file can say.
 */
export function withLetterheadMargins(doc: Doc, asked: { top?: number; bottom?: number }): Doc {
  const { page } = doc;
  const most = page.height * 0.4;
  const whole = (value: number) => Math.ceil(Math.min(value, most) * 20 - 1e-6) / 20;
  const marginTop = Math.max(page.marginTop, whole(asked.top ?? 0));
  const marginBottom = Math.max(page.marginBottom, whole(asked.bottom ?? 0));
  if (marginTop === page.marginTop && marginBottom === page.marginBottom) return doc;
  return { ...doc, page: { ...page, marginTop, marginBottom } };
}

