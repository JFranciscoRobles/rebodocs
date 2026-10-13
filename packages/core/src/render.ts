// A document turned into a PDF with nothing but font files: laid out by
// measuring with them, and drawn with them. This is what a server uses.

import type { Doc } from './model';
import { type FontFile, FontMeasurer, readFont } from './fonts';
import { docImage } from './images';
import { type Layout, layoutDocument } from './layout';
import { type PdfImage, exportPdf } from './pdf';
import { pdfImage } from './png';
import { embeddedFonts } from './docx/source';

export interface Rendered {
  pdf: Uint8Array;
  layout: Layout;
  /** Families the document asks for that no font was given for, and the one each was set in. */
  missingFonts: Map<string, string>;
}

/**
 * The document as a PDF, set in `fonts` and in the ones it carries itself.
 * The fonts are the ones the pages are measured with, so they decide where
 * lines and pages break: for the pages a browser shows, give the same ones.
 */
export function renderPdf(doc: Doc, fonts: FontFile[], title?: string): Rendered {
  const own = doc.source
    ? embeddedFonts(doc.source)
        .map((font) => readFont(font.bytes, font))
        .filter((font): font is FontFile => !!font)
    : [];
  // The fonts of the document come first: they are the ones it was written with.
  const measurer = new FontMeasurer([...own, ...fonts]);
  const layout = layoutDocument(doc, measurer);
  const pictures = new Map<string, PdfImage | undefined>();
  const pdf = exportPdf(layout, {
    measurer,
    title,
    font: (spec) => measurer.fontFor(spec)?.bytes,
    image: (xml, part) => {
      const key = `${part ?? ''}\n${xml}`;
      if (!pictures.has(key)) {
        const media = docImage(doc, xml, part);
        pictures.set(key, media && pdfImage(media));
      }
      return pictures.get(key);
    },
  });
  return { pdf, layout, missingFonts: measurer.missing };
}
