// A template of the bucket, filled and drawn as a PDF with no browser: the
// same layout the editor shows, measured with font files.

import { type Doc, fillVariables, renderPdf } from '@rebodocs/core';
// Looks for .ttf and .otf files in a folder and in the fonts of the system. An application
// of your own reads the ones it ships with `readFont`, as the server guide shows.
import { fontsFor } from '../../../packages/mcp/src/fonts';
import { Refused } from './refused';

export interface MadePdf {
  pdf: Uint8Array;
  pages: number;
  /** Families the document asks for that were not found, and what stood in for each. */
  missingFonts: Record<string, string>;
}

export function makePdf(template: Doc, values: Record<string, string>, title: string, fontDirs: string[] = []): MadePdf {
  const doc = fillVariables(template, values);
  const fonts = fontsFor(doc, fontDirs);
  // The person can mend this one, so it is said to them: 503, the server is not ready to make PDFs.
  if (!fonts.length) throw new Refused(503, 'The server has no .ttf or .otf font to lay the document out with. Set FONTS_DIR to a folder that has some.');
  const { pdf, layout, missingFonts } = renderPdf(doc, fonts, title);
  return { pdf, pages: layout.pages.length, missingFonts: Object.fromEntries(missingFonts) };
}
