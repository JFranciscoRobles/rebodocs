// The document as a PDF, page for page as the editor shows it. What the
// browser does for it is reading the pictures: decoding them, and making
// those that are not JPEG into the colours and transparency a PDF takes.

import { type Band, type Doc, type FloatBox, type Layout, type PdfImage, type TextMeasurer, docImage, embeddedFonts, exportPdf } from '@rebodocs/core/internal';
import { fontFile } from './fonts';

/** The longest side, in pixels, a picture keeps in a PDF. */
const MAX_PDF_PIXELS = 2400;

/**
 * The fonts the file carries go into it, then those the application gave;
 * any other is named by the nearest of the three every PDF reader has, with
 * each word where it is on the page.
 */
export async function documentPdf(layout: Layout, doc: Doc, options: { measurer: TextMeasurer; title?: string; language: string }): Promise<Uint8Array> {
  // The pictures are read first: decoding one takes the browser a moment.
  const pictures = new Map<string, PdfImage>();
  const wanted = new Map<string, { xml: string; part?: FloatBox['part'] }>();
  for (const page of layout.pages) {
    for (const [band, usual] of [
      [page.header, 'header'],
      [page, undefined],
      [page.footer, 'footer'],
    ] as const) {
      if (!band) continue;
      // The first page may have a header of its own, whose pictures live in another part.
      const part = (band as Band).part ?? usual;
      for (const float of band.floats) wanted.set(`${float.part ?? ''}\n${float.xml}`, { xml: float.xml, part: float.part });
      for (const line of band.lines) {
        for (const f of line.fragments) {
          if (f.kind === 'object' && f.width > 0) wanted.set(`${part ?? ''}\n${f.props.object}`, { xml: f.props.object, part });
        }
      }
    }
  }
  for (const [key, { xml, part }] of wanted) {
    const media = docImage(doc, xml, part);
    if (!media) continue;
    try {
      const bitmap = await createImageBitmap(new Blob([media.bytes as BlobPart], { type: media.type }));
      const shrink = Math.min(1, MAX_PDF_PIXELS / Math.max(bitmap.width, bitmap.height));
      if (media.type === 'image/jpeg' && shrink === 1) {
        pictures.set(key, { width: bitmap.width, height: bitmap.height, jpeg: media.bytes });
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * shrink));
        canvas.height = Math.max(1, Math.round(bitmap.height * shrink));
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const rgb = new Uint8Array(canvas.width * canvas.height * 3);
        const alpha = new Uint8Array(canvas.width * canvas.height);
        for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
          rgb[i * 3] = data[p];
          rgb[i * 3 + 1] = data[p + 1];
          rgb[i * 3 + 2] = data[p + 2];
          alpha[i] = data[p + 3];
        }
        pictures.set(key, { width: canvas.width, height: canvas.height, rgb, alpha });
      }
      bitmap.close();
    } catch {
      // A picture the browser cannot read is left out, as it is on the page.
    }
  }
  const fonts = doc.source ? embeddedFonts(doc.source) : [];
  return exportPdf(layout, {
    measurer: options.measurer,
    title: options.title,
    doc,
    language: options.language,
    font: (spec) => {
      const family = fonts.filter((font) => font.family.toLowerCase() === spec.family.toLowerCase());
      // The ones the document carries, then the ones the application gave.
      return (family.find((font) => font.bold === spec.bold && font.italic === spec.italic) ?? family.find((font) => !font.bold && !font.italic))?.bytes ?? fontFile(spec);
    },
    image: (xml, part) => pictures.get(`${part ?? ''}\n${xml}`),
  });
}
