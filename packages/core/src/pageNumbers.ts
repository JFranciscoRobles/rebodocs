// Page numbers: a paragraph in the header or the footer whose text holds the
// PAGE field (and NUMPAGES, for "of n"). Layout fills the fields in per page.

import { type Align, type Doc, type Paragraph, type Run, type RunProps, type Story, defined } from './model';

export type PageNumberFormat =
  /** "3" */
  | 'number'
  /** "3 / 9" */
  | 'numberOfTotal'
  /** "Página 3" */
  | 'page'
  /** "Página 3 de 9" */
  | 'pageOfTotal';

export interface PageNumbering {
  place: 'header' | 'footer';
  align: Exclude<Align, 'justify'>;
  format: PageNumberFormat;
  /** The word that goes before the number and the one between it and the total, when they are not the Spanish ones. */
  words?: { page: string; of: string };
}

/** The word that goes before the number, and the one between it and the total. */
const WORD = 'Página';
const OF = 'de';

/** What a paragraph that is only a page number may hold besides the fields: the words and marks around them. */
const AROUND = /^[\s\-–—|/.·]*(?:p[áa]g(?:ina|\.)?|page)?[\s\-–—|/.·]*(?:de|of)?[\s\-–—|/.·]*$/i;

const isField = (run: Run, name: string) => run.props.field === name;
/** The text of a paragraph that is neither a field result nor an object. */
const ownText = (p: Paragraph) =>
  p.runs
    .filter((run) => !run.props.field && !run.props.object)
    .map((run) => run.text)
    .join(' ');

/**
 * True for a paragraph that is a page number and nothing else, which is what
 * setting or removing the page number replaces. A page number inside a line
 * with other text ("Confidencial · 3") is left alone.
 */
function isPageNumber(p: Paragraph): boolean {
  return p.runs.some((run) => isField(run, 'PAGE')) && AROUND.test(ownText(p));
}

/** The page numbering the document has, read from its header and footer; undefined when it has none. */
export function pageNumbering(doc: Doc): PageNumbering | undefined {
  for (const place of ['footer', 'header'] as const) {
    const p = doc[place]?.paragraphs.find(isPageNumber);
    if (!p) continue;
    const total = p.runs.some((run) => isField(run, 'NUMPAGES'));
    const worded = /[a-záé]/i.test(ownText(p).replace(/\b(?:de|of)\b/gi, ''));
    const align = p.props.align === 'center' || p.props.align === 'right' ? p.props.align : 'left';
    return { place, align, format: worded ? (total ? 'pageOfTotal' : 'page') : total ? 'numberOfTotal' : 'number' };
  }
  return undefined;
}

/** Formatting for the number: the font of the body, a little smaller, and nothing tied to the text it is taken from. */
function numberProps(doc: Doc): RunProps {
  // The first run with text of its own: a document may start with marks that take no room and carry another font.
  const like = doc.paragraphs.flatMap((p) => p.runs).find((run) => run.text.trim() && !run.props.object)?.props ?? {};
  return defined<RunProps>({ fontFamily: like.fontFamily, fontSize: 10, color: '000000' });
}

function numberParagraph(doc: Doc, { align, format, words }: PageNumbering): Paragraph {
  const props = numberProps(doc);
  const text = (value: string): Run => ({ text: value, props });
  // The result text is a placeholder: layout and Word both replace it with the real number.
  const field = (name: string): Run => ({ text: '1', props: { ...props, field: name } });
  const worded = format === 'page' || format === 'pageOfTotal';
  const total = format === 'numberOfTotal' || format === 'pageOfTotal';
  const runs = [
    ...(worded ? [text(`${words?.page ?? WORD} `)] : []),
    field('PAGE'),
    ...(total ? [text(worded ? ` ${words?.of ?? OF} ` : ' / '), field('NUMPAGES')] : []),
  ];
  return { props: { align, spacingBefore: 0, spacingAfter: 0, lineHeight: 1 }, runs };
}

/**
 * Puts the page number where `numbering` says, replacing the one the document
 * had, or takes it away when `numbering` is undefined. The rest of the header
 * and the footer stays as it was.
 */
export function setPageNumbering(doc: Doc, numbering: PageNumbering | undefined): Doc {
  const without = (story: Story | undefined): Story | undefined => {
    if (!story?.paragraphs.some(isPageNumber)) return story;
    return { ...story, paragraphs: story.paragraphs.filter((p) => !isPageNumber(p)) };
  };
  let header = without(doc.header);
  let footer = without(doc.footer);
  if (numbering) {
    const paragraph = numberParagraph(doc, numbering);
    // In a header the number goes first, above whatever else it has; in a footer, last.
    if (numbering.place === 'header') header = { ...header, paragraphs: [paragraph, ...(header?.paragraphs ?? [])] };
    else footer = { ...footer, paragraphs: [...(footer?.paragraphs ?? []), paragraph] };
  }
  if (header === doc.header && footer === doc.footer) return doc;
  return defined<Doc>({ ...doc, header, footer });
}
