// What the page "Fonts" says that is data, each checked in
// packages/editor/src/fonts.ts, packages/editor/src/editor.ts (exportDocx,
// exportPdf, loadEmbeddedFonts), packages/core/src/pdf.ts and
// packages/core/src/docx/export.ts (embeddable, writeFonts).

/** The font of the demo: OFL, in public/fonts with its licence, one file per face. */
export const FAMILY = 'Courier Prime';
export const FACES: { file: string; bold?: boolean; italic?: boolean }[] = [
  { file: 'CourierPrime-Regular.ttf' },
  { file: 'CourierPrime-Bold.ttf', bold: true },
  { file: 'CourierPrime-Italic.ttf', italic: true },
];

/** What a given font is used for. */
export const DOES: { title: string; text: string; color: 'blue' | 'green' | 'purple' | 'pink' | 'yellow' | 'orange' }[] = [
  { title: 'Offered', color: 'blue', text: 'First in the toolbar’s font box, also in a bar made before it came. Headless, in state.fonts.' },
  {
    title: 'Measured and painted',
    color: 'green',
    text: 'Text in that family is set with it. Every open document is laid out again when it loads, since the width of its lines changes: a page may break elsewhere.',
  },
  { title: 'In the PDF', color: 'purple', text: 'When the file is TrueType or OpenType, the PDF carries it, and its text can be selected and searched.' },
  { title: 'In the DOCX', color: 'pink', text: 'When it is TrueType and its licence lets it, whole or cut down, for whoever opens the file in Word without the font installed.' },
];

/** What each kind of file does, from parseTrueType and subsetTrueType (pdf.ts) and embeddable (docx/export.ts). */
export const KINDS: { kind: string; screen: string; pdf: string; docx: string }[] = [
  { kind: '.ttf', screen: 'Yes', pdf: 'Cut down to the characters used', docx: 'If the licence lets it: whole, or cut down' },
  { kind: '.otf, TrueType outlines', screen: 'Yes', pdf: 'Cut down to the characters used', docx: 'If the licence lets it: whole, or cut down' },
  { kind: '.otf, CFF outlines', screen: 'Yes', pdf: 'Whole', docx: 'No' },
  { kind: '.woff, .woff2', screen: 'Yes', pdf: 'No: Helvetica, Times or Courier', docx: 'No' },
  { kind: 'Left out (CSS)', screen: 'Yes', pdf: 'No: Helvetica, Times or Courier', docx: 'No' },
];

/** The functions of the fonts. */
export const FUNCTIONS: { name: string; signature: string; returns: string; text: string; editorOnly?: boolean }[] = [
  {
    name: 'addFont',
    signature: 'addFont(font: FontSource)',
    returns: 'Promise<boolean>',
    text: 'Gives the page a face of a family. Says whether it could be read: false for an address that does not answer with a font, a file the browser cannot read, or no browser at all.',
  },
  { name: 'addFonts', signature: 'addFonts(fonts: FontSource[])', returns: 'Promise<boolean[]>', text: 'Several at once, read side by side; the documents are laid out again once, when all are in.' },
  { name: 'fontFamilies', signature: 'fontFamilies()', returns: 'string[]', text: 'The families given, in the order they came, each once.' },
  { name: 'onFontsChange', signature: 'onFontsChange(listener: () => void)', returns: '() => void', text: 'Calls listener when a font is given. Returns how to stop.' },
  {
    name: 'fontFile',
    signature: 'fontFile(spec: { family: string; bold: boolean; italic: boolean })',
    returns: 'Uint8Array | undefined',
    text: 'The file of that face, or of the regular one of its family: what a PDF embeds.',
    editorOnly: true,
  },
  { name: 'fontFaces', signature: 'fontFaces()', returns: '{ family, bold, italic, bytes }[]', text: 'Every face given with its file: what a DOCX can carry.', editorOnly: true },
];

/** FontSource, as fonts.ts declares it. */
export const SOURCE: { name: string; type: string; text: string }[] = [
  { name: 'family', type: 'string', text: 'The name the document gives the font. Compared without minding capitals.' },
  { name: 'src', type: 'string | ArrayBuffer | Uint8Array', text: 'An address to fetch, the bytes, or nothing for a font the page loads itself.' },
  { name: 'bold', type: 'boolean', text: 'The file is the bold face.' },
  { name: 'italic', type: 'boolean', text: 'The file is the italic face. Neither: the regular one.' },
];
