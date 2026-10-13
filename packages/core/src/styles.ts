// Paragraph styles: the named looks a paragraph can take (Normal, Title,
// Heading 1...). The model keeps the formatting of every paragraph resolved,
// so applying a style writes its formatting into the paragraph and remembers
// its name; the name is what Word shows, and what makes a heading a heading.

import {
  type Doc,
  type Paragraph,
  type ParagraphProps,
  type ParagraphStyle,
  type RunProps,
  DEFAULT_RUN,
  defined,
} from './model';

const NORMAL: ParagraphStyle = {
  id: 'Normal',
  name: 'Normal',
  wordName: 'Normal',
  paragraph: {},
  run: { fontSize: DEFAULT_RUN.fontSize, bold: false, italic: false, color: DEFAULT_RUN.color },
};

/** What the styles every document offers add to Normal, when the file does not bring its own. */
const STANDARD: (Pick<ParagraphStyle, 'id' | 'name' | 'outlineLevel'> & { wordName: string; paragraph: ParagraphProps; run: RunProps })[] = [
  { id: 'Title', name: 'Título', wordName: 'Title', paragraph: { spacingBefore: 0, spacingAfter: 3, keepNext: true }, run: { fontSize: 26 } },
  { id: 'Subtitle', name: 'Subtítulo', wordName: 'Subtitle', paragraph: { spacingBefore: 0, spacingAfter: 16, keepNext: true }, run: { fontSize: 15, color: '666666' } },
  { id: 'Heading1', name: 'Título 1', wordName: 'heading 1', outlineLevel: 1, paragraph: { spacingBefore: 20, spacingAfter: 6, keepNext: true }, run: { fontSize: 20 } },
  { id: 'Heading2', name: 'Título 2', wordName: 'heading 2', outlineLevel: 2, paragraph: { spacingBefore: 18, spacingAfter: 6, keepNext: true }, run: { fontSize: 16 } },
  { id: 'Heading3', name: 'Título 3', wordName: 'heading 3', outlineLevel: 3, paragraph: { spacingBefore: 16, spacingAfter: 4, keepNext: true }, run: { fontSize: 14, color: '434343' } },
];

/**
 * The standard styles on top of `normal`, which goes first. `own` gives the
 * style a document already has under one of their names, to use in its place;
 * `taken` says whether an id is in use for something else.
 */
export function standardStyles(
  normal: ParagraphStyle = NORMAL,
  own: (wordName: string) => ParagraphStyle | undefined = () => undefined,
  taken: (id: string) => boolean = () => false,
): ParagraphStyle[] {
  const styles = STANDARD.map((standard): ParagraphStyle => {
    const { id, name, wordName, outlineLevel } = standard;
    const mine = own(wordName);
    if (mine) return defined<ParagraphStyle>({ ...mine, name, wordName, outlineLevel, next: normal.id });
    return defined<ParagraphStyle>({
      id: taken(id) ? `${id}Dx` : id,
      name,
      wordName,
      outlineLevel,
      next: normal.id,
      paragraph: { ...normal.paragraph, ...standard.paragraph },
      run: { ...normal.run, ...standard.run },
    });
  });
  return [normal, ...styles];
}

const BUILTIN_STYLES = standardStyles();

/** The styles a paragraph of the document can take; the first one is the one paragraphs have by default. */
export function paragraphStyles(doc: Doc): ParagraphStyle[] {
  return doc.styles?.length ? doc.styles : BUILTIN_STYLES;
}

/** The id of the style of a paragraph. */
export function styleIdAt(doc: Doc, para: number): string {
  const styles = paragraphStyles(doc);
  const id = doc.paragraphs[para].props.styleId;
  return id && styles.some((style) => style.id === id) ? id : styles[0].id;
}

/**
 * Gives the paragraphs from `fromPara` to `toPara` the style `id`: its
 * paragraph formatting, and its font size, weight, slant and colour on all
 * their text. Underline, strike-through and highlight stay, and so does the
 * list a paragraph is in.
 */
export function setParagraphStyle(doc: Doc, fromPara: number, toPara: number, id: string): Doc {
  const style = paragraphStyles(doc).find((s) => s.id === id);
  if (!style) return doc;
  const paragraphs = doc.paragraphs.slice();
  for (let i = fromPara; i <= toPara; i++) {
    const p = paragraphs[i];
    const { numId, listLevel, indentLeft, indentFirstLine, pageBreakBefore } = p.props;
    const kept = numId ? { numId, listLevel, indentLeft, indentFirstLine } : {};
    const props = defined<ParagraphProps>({ ...style.paragraph, ...kept, pageBreakBefore, styleId: id });
    const runs = p.runs.map((run) => (run.props.object ? run : { text: run.text, props: { ...run.props, ...style.run } }));
    paragraphs[i] = { ...p, props, runs } satisfies Paragraph;
  }
  return { ...doc, paragraphs };
}
