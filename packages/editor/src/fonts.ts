// The fonts an application gives the editor besides the ones the machine
// has: its own typeface, a letterhead's. One list for the page, as the fonts
// of a page are: every editor on it measures and paints with them, offers
// them in its toolbar and puts them in the PDFs it makes.

export interface FontSource {
  /** The name the font goes by: what the document says its text is in. */
  family: string;
  /**
   * The font file: its address, to fetch, or its bytes. A TrueType file
   * (.ttf) also goes into the PDFs; any other kind the browser reads is shown
   * and measured, and a PDF draws its text in a standard font. Left out for a
   * font the page already loads by itself, with CSS: it is only put in the list.
   */
  src?: string | ArrayBuffer | Uint8Array;
  /** Which face of the family the file is. The regular one when neither is set. */
  bold?: boolean;
  italic?: boolean;
}

interface Held {
  family: string;
  bold: boolean;
  italic: boolean;
  bytes?: Uint8Array;
  face?: FontFace;
  /** What it was read from, to tell the same font given again. */
  src?: FontSource['src'];
}

const held: Held[] = [];
const listeners = new Set<() => void>();

const same = (a: Pick<Held, 'family' | 'bold' | 'italic'>, b: Pick<Held, 'family' | 'bold' | 'italic'>) =>
  a.family.toLowerCase() === b.family.toLowerCase() && a.bold === b.bold && a.italic === b.italic;

/**
 * Gives the editor a font: the text in it is measured and painted with it
 * from then on, the toolbar offers it, and, when it is a TrueType file, PDFs
 * carry it. A family is given a face at a time: its regular one, its bold...
 * Says whether the font could be read. Where there is no browser it does nothing.
 */
export async function addFont(font: FontSource): Promise<boolean> {
  const added = await read(font);
  if (added === 'new') tell();
  return added !== 'no';
}

const tell = () => {
  for (const listener of [...listeners]) listener();
};

async function read(font: FontSource): Promise<'new' | 'had' | 'no'> {
  if (typeof document === 'undefined' || !font.family.trim()) return 'no';
  const entry: Held = { family: font.family.trim(), bold: !!font.bold, italic: !!font.italic, src: font.src };
  // The same file for the same face, given again: a component drawn again gives its fonts again.
  if (held.some((one) => same(one, entry) && one.src === entry.src)) return 'had';
  const css = `${entry.italic ? 'italic ' : ''}${entry.bold ? 'bold ' : ''}16px "${entry.family.replace(/["\\]/g, '')}"`;
  try {
    if (font.src === undefined) {
      // One the page loads itself: asked for now, so that it is there when the text is measured.
      await document.fonts.load(css);
    } else {
      const data = typeof font.src === 'string' ? await (await fetch(font.src)).arrayBuffer() : font.src;
      // A copy: a font face keeps the buffer it is given, and the PDF needs the bytes too.
      entry.bytes = new Uint8Array(data instanceof Uint8Array ? data : new Uint8Array(data));
      entry.face = new FontFace(entry.family, entry.bytes.slice().buffer, { weight: entry.bold ? 'bold' : 'normal', style: entry.italic ? 'italic' : 'normal' });
      await entry.face.load();
      document.fonts.add(entry.face);
    }
  } catch {
    return 'no';
  }
  const at = held.findIndex((one) => same(one, entry));
  if (at >= 0) {
    const [was] = held.splice(at, 1, entry);
    if (was.face) document.fonts.delete(was.face);
  } else {
    held.push(entry);
  }
  return 'new';
}

/** Gives several fonts at once; says, for each, whether it could be read. */
export async function addFonts(fonts: FontSource[]): Promise<boolean[]> {
  const added = await Promise.all(fonts.map(read));
  // Told once for all of them: each telling lays every document out again.
  if (added.includes('new')) tell();
  return added.map((one) => one !== 'no');
}

/** The families given, in the order they came. */
export function fontFamilies(): string[] {
  return [...new Set(held.map((font) => font.family))];
}

/** The file of the face asked for, or of the regular one of its family, when one was given: what a PDF embeds. */
export function fontFile(spec: { family: string; bold: boolean; italic: boolean }): Uint8Array | undefined {
  const family = held.filter((font) => font.bytes && font.family.toLowerCase() === spec.family.toLowerCase());
  return (family.find((font) => font.bold === spec.bold && font.italic === spec.italic) ?? family.find((font) => !font.bold && !font.italic))?.bytes;
}

/** Calls `listener` when a font is given. Returns how to stop. */
export function onFontsChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
