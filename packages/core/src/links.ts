// Links from the text to somewhere outside the document: a page of the web,
// a mail address, a telephone. A link is the `w:hyperlink` Word puts around
// the runs it covers, which the model carries as their wrapper. A file names
// the address through a relationship of the part; here it travels in the
// wrapper itself, as `r:id="dx:<address>"`, and export gives it a relationship.

import { type Doc, type Position, type Range, type Run, type RunProps, WRAP_SEPARATOR, defined, paragraphLength } from './model';
import { insertText, normalizeRuns, propsAt, sliceRuns } from './ops';
import { decodeEntities, escapeXml } from './docx/xml';

/** The blue Word gives to links. */
export const LINK_COLOR = '0563C1';

const OPEN = /<w:hyperlink\b[^>]*>/;
const HREF = /<w:hyperlink\b[^>]*\br:id="dx:([^"]*)"/;
const CLOSE = '</w:hyperlink>';
/** What a link may open: nothing that runs. */
const SCHEMES = /^(https?:\/\/|mailto:|tel:)/i;

/**
 * The address as a link keeps it: a bare domain goes to the web, a mail
 * address writes to it. Undefined for what cannot be an address, or is not
 * one a link may open.
 */
export function cleanHref(text: string): string | undefined {
  const href = text.trim();
  if (!href || /[\s<>"]/.test(href)) return undefined;
  if (SCHEMES.test(href)) return href;
  if (/^[^@/:]+@[^@/:]+\.[^@/:]+$/.test(href)) return `mailto:${href}`;
  // Any other scheme; a port after a host name is not one.
  if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(href)) return undefined;
  return `https://${href}`;
}

/** Where the link a run is part of goes, when it goes outside the document. */
export function linkHref(props: RunProps): string | undefined {
  const found = props.wrap ? HREF.exec(props.wrap)?.[1] : undefined;
  return found === undefined ? undefined : decodeEntities(found);
}

function withoutLink(wrap: string | undefined): string | undefined {
  if (!wrap || !OPEN.test(wrap)) return wrap;
  const [open, close] = wrap.split(WRAP_SEPARATOR);
  const rest = [open.replace(OPEN, ''), close.replace(CLOSE, '')];
  return rest[0] || rest[1] ? rest.join(WRAP_SEPARATOR) : undefined;
}

function withLink(wrap: string | undefined, href: string): string {
  const [open = '', close = ''] = withoutLink(wrap)?.split(WRAP_SEPARATOR) ?? [];
  // The link goes innermost: it holds runs, and nothing else.
  return `${open}<w:hyperlink r:id="dx:${escapeXml(href)}" w:history="1">${WRAP_SEPARATOR}${CLOSE}${close}`;
}

const linked = (props: RunProps, href: string): RunProps => ({ ...props, wrap: withLink(props.wrap, href), color: LINK_COLOR, underline: true });

/** The runs of the paragraphs of `range`, each changed by `change` where it is inside the range. */
function mapRuns(doc: Doc, range: Range, change: (run: Run, para: number) => Run): Doc {
  const paragraphs = doc.paragraphs.slice();
  for (let i = range.from.para; i <= range.to.para; i++) {
    const p = paragraphs[i];
    const len = paragraphLength(p);
    const a = i === range.from.para ? range.from.offset : 0;
    const b = i === range.to.para ? range.to.offset : len;
    if (a >= b) continue;
    const middle = sliceRuns(p.runs, a, b).map((run) => change(run, i));
    paragraphs[i] = { ...p, runs: normalizeRuns([...sliceRuns(p.runs, 0, a), ...middle, ...sliceRuns(p.runs, b, len)], p.runs[0].props) };
  }
  return { ...doc, paragraphs };
}

export interface LinkAt {
  href: string;
  range: Range;
}

/** The link `pos` is in or beside: where it goes, and the text it covers. */
export function linkAt(doc: Pick<Doc, 'paragraphs'>, pos: Position): LinkAt | undefined {
  const p = doc.paragraphs[pos.para];
  if (!p) return undefined;
  const spans: { from: number; to: number; href: string | undefined }[] = [];
  let offset = 0;
  for (const run of p.runs) {
    const href = linkHref(run.props);
    const last = spans[spans.length - 1];
    if (last && last.href === href) last.to += run.text.length;
    else spans.push({ from: offset, to: offset + run.text.length, href });
    offset += run.text.length;
  }
  const at = spans.find((span) => span.href !== undefined && span.to > span.from && pos.offset >= span.from && pos.offset <= span.to);
  return at && { href: at.href!, range: { from: { para: pos.para, offset: at.from }, to: { para: pos.para, offset: at.to } } };
}

/** Makes a link of the text of `range`, as links look: blue and underlined. A link already there goes to `href` instead. */
export function setLink(doc: Doc, range: Range, href: string): Doc {
  return mapRuns(doc, range, (run) => ({ text: run.text, props: linked(run.props, href) }));
}

/** Takes away the links of the text of `range`; the text stays, looking like the text around it. */
export function removeLink(doc: Doc, range: Range): Doc {
  return mapRuns(doc, range, (run, para) => {
    if (linkHref(run.props) === undefined) return run;
    // The colour of the paragraph is that of its text that is not a link.
    const plain = doc.paragraphs[para].runs.find((other) => other.text && !other.props.object && linkHref(other.props) === undefined);
    const opaque = run.props.opaque?.replace(/<w:rStyle\b[^>]*\/>/, '');
    return { text: run.text, props: defined({ ...run.props, wrap: withoutLink(run.props.wrap), color: plain?.props.color, underline: plain?.props.underline ?? false, opaque: opaque || undefined }) };
  });
}

/** Writes `text` at `pos` as a link to `href`. Returns the document and the text written. */
export function insertLink(doc: Doc, pos: Position, text: string, href: string): { doc: Doc; range: Range } {
  const { field: _, ...props } = propsAt(doc, pos);
  const result = insertText(doc, pos, text.replace(/[\r\n\f]+/g, ' '), linked(props, href));
  return { doc: result.doc, range: { from: pos, to: result.pos } };
}
