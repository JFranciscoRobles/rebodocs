// Pictures put in by a template: {{logo | image}} filled with a picture, at
// its own size or at the width the format says ({{logo | image: 4cm}}). The
// value is the picture as a data: address (data:image/png;base64,…), so it
// travels in a JSON as any other value.
//
// One template is filled in pieces (each item of a block on its own, then
// the headers and the footers), and the pieces keep only their paragraphs and
// tables; so the pictures they take are kept here, for the whole filling, and
// put in the document's media at the end. The same picture used twice is
// kept once.

import { imageExtension, imageTypeOf, pictureRun, pictureSize } from './images';
import type { Doc, Media, Run, RunProps } from './model';

const POINTS_PER_PIXEL = 0.75;
const POINTS: Record<string, number> = { pt: 1, px: POINTS_PER_PIXEL, in: 72, cm: 72 / 2.54, mm: 72 / 25.4 };

/** The picture a value is: a data: address of a PNG, a JPEG or a GIF, its bytes saying so too; undefined for anything else. */
export function pictureOf(value: string): Media | undefined {
  const found = /^data:(image\/(?:png|jpeg|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(value.trim());
  if (!found) return undefined;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(found[2].replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  } catch {
    return undefined;
  }
  const type = imageTypeOf(bytes);
  return type && type === found[1] && imageExtension(type) ? { bytes, type } : undefined;
}

/** A length as a format writes it, in points: `4cm`, `30 mm`, `1.5in`, `120px`, `90` (points). */
function length(text: string): number | undefined {
  const found = /^(\d+(?:[.,]\d+)?)\s*(pt|px|in|cm|mm)?$/i.exec(text.trim());
  if (!found) return undefined;
  const value = Number(found[1].replace(',', '.')) * POINTS[(found[2] ?? 'pt').toLowerCase()];
  return value > 0 ? value : undefined;
}

/**
 * The size a picture is put in at, in points: what the format says (a width,
 * and the height that keeps its shape; or `4cm x 3cm`, both), else its own
 * size at 96 pixels an inch; never wider than `widest`.
 */
export function pictureFits(media: Media, arg: string, widest: number): { width: number; height: number } {
  const own = pictureSize(media.bytes, media.type) ?? { width: 100, height: 100 };
  const [across, down] = arg.split(/\s*[x×]\s*/i).map(length);
  let width = across ?? own.width * POINTS_PER_PIXEL;
  let height = down ?? (width * own.height) / own.width;
  if (width > widest) {
    height = (height * widest) / width;
    width = widest;
  }
  return { width: Math.round(width * 100) / 100, height: Math.round(height * 100) / 100 };
}

export interface Pictures {
  /** The run that stands for a picture, or undefined when the value is not one. */
  run(value: string, arg: string, like: RunProps): Run | undefined;
  /** The document with the pictures taken in its media; the same document when none was. */
  into(doc: Doc): Doc;
}

/** The pictures of one filling of a document. */
export function picturesFor(doc: Doc): Pictures {
  const media: Record<string, Media> = {};
  const keys = new Map<string, { key: string; n: number }>();
  const taken = new Set(Object.keys(doc.media ?? {}));
  let n = taken.size;
  // The width of the text of the page: a picture of a template never goes past it.
  const widest = Math.max(36, doc.page.width - doc.page.marginLeft - doc.page.marginRight);
  return {
    run(value, arg, like) {
      const picture = pictureOf(value);
      if (!picture) return undefined;
      let known = keys.get(value);
      if (!known) {
        do n++;
        while (taken.has(`imagen${n}`));
        known = { key: `imagen${n}`, n };
        taken.add(known.key);
        keys.set(value, known);
        media[known.key] = picture;
      }
      const { width, height } = pictureFits(picture, arg, widest);
      return pictureRun(known.key, known.n, width, height, like);
    },
    into(filled) {
      return keys.size ? { ...filled, media: { ...filled.media, ...media } } : filled;
    },
  };
}
