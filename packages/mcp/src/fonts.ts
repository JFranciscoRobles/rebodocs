// Finding font files on the machine, for laying a document out with no
// browser: to number its pages and to draw it as a PDF. Node only.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { type Doc, type FontFile, readFonts, resolveRun } from '@rebodocs/core';

export const SYSTEM_FONTS = [
  // Its Supplemental folder is inside: Arial and the others; the collections (.ttc) of Helvetica and its kin are here.
  '/System/Library/Fonts',
  '/Library/Fonts',
  join(homedir(), 'Library/Fonts'),
  '/usr/share/fonts',
  '/usr/local/share/fonts',
  join(homedir(), '.fonts'),
  'C:\\Windows\\Fonts',
];
/** Families read even when the document does not name them, to stand in for the ones that are missing. */
export const STAND_INS = ['Arial', 'Times New Roman', 'Courier New', 'Liberation Sans', 'Liberation Serif', 'Liberation Mono', 'DejaVu Sans', 'DejaVu Serif'];

/** Every .ttf, .otf and .ttc under a folder. */
function fontFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) fontFiles(path, out);
    else if (/\.(ttf|otf|ttc)$/i.test(name)) out.push(path);
  }
  return out;
}

/** The font families the text of a document is in. */
export function familiesOf(doc: Doc): Set<string> {
  const families = new Set<string>();
  for (const part of [doc, doc.header, doc.footer]) {
    for (const p of part?.paragraphs ?? []) for (const run of p.runs) families.add(resolveRun(run.props).fontFamily);
  }
  return families;
}

/** The fonts of the folders whose file name starts like one of the families: reading them all would take long. */
export function loadFonts(dirs: string[], families: Iterable<string>): FontFile[] {
  const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = [...families].map(squash).filter(Boolean);
  const fonts: FontFile[] = [];
  for (const dir of dirs) {
    for (const path of fontFiles(dir)) {
      const name = squash(basename(path, extname(path)));
      if (!wanted.some((family) => name.startsWith(family))) continue;
      fonts.push(...readFonts(new Uint8Array(readFileSync(path))));
    }
  }
  return fonts;
}

/** The fonts to set a document in: the ones it names and the ones that stand in for those the machine lacks. */
export const fontsFor = (doc: Doc, dirs: string[] = []): FontFile[] => loadFonts([...dirs, ...SYSTEM_FONTS], [...familiesOf(doc), ...STAND_INS]);
