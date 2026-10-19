// What is copied and pasted with its formatting: a piece of a document, apart
// from it. It goes to other programs as HTML, and comes back from this editor
// whole; what comes as HTML from elsewhere is read into one by the editor.

import { type ListKind, levelOf, MAX_LIST_LEVEL, addList } from './numbering';
import { LINK_COLOR, cleanHref, linkHref, linkProps } from './links';
import { escapeXml } from './docx/xml';
import {
  type Doc,
  type Paragraph,
  type ParagraphProps,
  type Position,
  type Range,
  type RunProps,
  defined,
  paragraphLength,
  resolveRun,
} from './model';
import { insertText, listKindAt, propsAt, sliceRuns, splitParagraph } from './ops';
import { paragraphStyles } from './styles';

/** A run of a clip: its formatting is what it has of its own, on top of the text it lands in. */
export interface ClipRun {
  text: string;
  props: RunProps;
  /** Where it goes, when it is a link. */
  href?: string;
}

export interface ClipParagraph {
  runs: ClipRun[];
  props: ParagraphProps;
  /** The list it is in: items with the same `id` are in one list. */
  list?: { id: number; kind: ListKind; level: number };
  /** The name Word knows its style by ('heading 1', 'Title'...), when it has one but Normal. */
  style?: string;
}

export interface Clip {
  paragraphs: ClipParagraph[];
}

/** The formatting of a run that means something outside the document it is in. */
function portableRun(props: RunProps): RunProps {
  const { bold, italic, underline, strike, fontSize, fontFamily, color, highlight } = props;
  return defined({ bold, italic, underline, strike, fontSize, fontFamily, color, highlight });
}

function portableParagraph(props: ParagraphProps): ParagraphProps {
  const { align, spacingBefore, spacingAfter, lineHeight, indentLeft, indentRight, indentFirstLine, keepNext, keepLines, tabs } = props;
  return defined({ align, spacingBefore, spacingAfter, lineHeight, indentLeft, indentRight, indentFirstLine, keepNext, keepLines, tabs });
}

/** The text of `range`, with its formatting, apart from the document. Pictures and fields stay behind. */
export function clipOf(doc: Doc, range: Range): Clip {
  const styles = paragraphStyles(doc);
  const paragraphs: ClipParagraph[] = [];
  for (let i = range.from.para; i <= range.to.para; i++) {
    const p = doc.paragraphs[i];
    const a = i === range.from.para ? range.from.offset : 0;
    const b = i === range.to.para ? range.to.offset : paragraphLength(p);
    const runs: ClipRun[] = [];
    for (const run of sliceRuns(p.runs, a, b)) {
      // Text taken out while changes were tracked is not there for the person.
      if (run.props.object || run.props.revision === 'delete') continue;
      // The size and the font go even when they are the document's own, which elsewhere are not.
      const { fontSize, fontFamily } = resolveRun(run.props);
      runs.push(defined({ text: run.text, props: portableRun({ ...run.props, fontSize, fontFamily }), href: linkHref(run.props) }));
    }
    const kind = listKindAt(doc, i);
    const style = styles.find((s) => s.id === p.props.styleId && s !== styles[0]);
    paragraphs.push(
      defined<ClipParagraph>({
        runs,
        props: portableParagraph(p.props),
        list: kind ? { id: p.props.numId!, kind, level: p.props.listLevel ?? 0 } : undefined,
        style: style?.wordName,
      }),
    );
  }
  return { paragraphs };
}

/** The plain text of a clip, paragraphs separated by '\n'. */
export function clipText(clip: Clip): string {
  return clip.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n');
}

const pt = (n: number): string => `${Math.round(n * 100) / 100}pt`;

function runHtml(run: ClipRun): string {
  const { props } = run;
  const css: string[] = [];
  if (props.fontFamily) css.push(`font-family:'${props.fontFamily.replace(/'/g, '')}'`);
  if (props.fontSize) css.push(`font-size:${pt(props.fontSize)}`);
  if (props.color && !(run.href && props.color === LINK_COLOR)) css.push(`color:#${props.color}`);
  if (props.highlight) css.push(`background-color:#${props.highlight}`);
  css.push(`font-weight:${props.bold ? 'bold' : 'normal'}`);
  if (props.italic) css.push('font-style:italic');
  const lines = [props.underline && !run.href ? 'underline' : '', props.strike ? 'line-through' : ''].filter(Boolean);
  if (lines.length) css.push(`text-decoration:${lines.join(' ')}`);
  const text = escapeXml(run.text).replace(/\n/g, '<br>').replace(/\t/g, '&emsp;').replace(/\f/g, '');
  const span = `<span style="${css.join(';')}">${text}</span>`;
  return run.href ? `<a href="${escapeXml(run.href)}">${span}</a>` : span;
}

function paragraphCss(props: ParagraphProps): string {
  const css: string[] = ['margin:0'];
  if (props.align) css.push(`text-align:${props.align}`);
  if (props.spacingBefore) css.push(`margin-top:${pt(props.spacingBefore)}`);
  if (props.spacingAfter) css.push(`margin-bottom:${pt(props.spacingAfter)}`);
  if (props.indentLeft) css.push(`margin-left:${pt(props.indentLeft)}`);
  if (props.indentRight) css.push(`margin-right:${pt(props.indentRight)}`);
  if (props.indentFirstLine) css.push(`text-indent:${pt(props.indentFirstLine)}`);
  // As Word writes it: a percentage of the natural line.
  if (props.lineHeight) css.push(`line-height:${Math.round(props.lineHeight * 100)}%`);
  return css.join(';');
}

const HEADING = /^heading ([1-6])$/i;

/**
 * The clip as HTML, for the programs it is pasted into: Word, Google Docs, a
 * mail. `data` is put in it as well, for this editor to read back whole.
 */
export function clipHtml(clip: Clip, data?: string): string {
  const out: string[] = [];
  let openList: { id: number; tag: string } | undefined;
  const closeList = (): void => {
    if (openList) out.push(`</${openList.tag}>`);
    openList = undefined;
  };
  for (const p of clip.paragraphs) {
    const inner = p.runs.map(runHtml).join('') || '<br>';
    if (p.list) {
      const tag = p.list.kind === 'bullet' ? 'ul' : 'ol';
      if (openList?.id !== p.list.id || openList.tag !== tag) {
        closeList();
        openList = { id: p.list.id, tag };
        out.push(`<${tag} style="margin:0">`);
      }
      out.push(`<li style="margin-left:${pt(18 * p.list.level)}">${inner}</li>`);
      continue;
    }
    closeList();
    const level = p.style ? HEADING.exec(p.style)?.[1] : undefined;
    const tag = level ? `h${level}` : 'p';
    out.push(`<${tag} style="${paragraphCss(p.props)}">${inner}</${tag}>`);
  }
  closeList();
  const attr = data ? ` data-rebodocs="${escapeXml(data)}"` : '';
  return `<div${attr}>${out.join('')}</div>`;
}

/** The clip written to be read back by `parseClip`. */
export function serializeClip(clip: Clip): string {
  return JSON.stringify(clip);
}

/** A clip written by `serializeClip`, or undefined for anything else. */
export function parseClip(data: string | undefined | null): Clip | undefined {
  if (!data) return undefined;
  try {
    const clip = JSON.parse(data) as Clip;
    if (!Array.isArray(clip?.paragraphs)) return undefined;
    const ok = clip.paragraphs.every((p) => p && Array.isArray(p.runs) && p.runs.every((r) => typeof r?.text === 'string'));
    return ok && clip.paragraphs.length ? clip : undefined;
  } catch {
    return undefined;
  }
}

/** The text of a paragraph of a clip written at `pos`: its runs on top of `base`, the formatting of the text there. */
function writeRuns(doc: Doc, pos: Position, runs: ClipRun[], base: RunProps): { doc: Doc; pos: Position } {
  let state = { doc, pos };
  for (const run of runs) {
    const text = run.text.replace(/\r/g, '');
    if (!text) continue;
    const props = defined({ ...base, ...portableRun(run.props) });
    const href = run.href && cleanHref(run.href);
    state = insertText(state.doc, state.pos, text, href ? linkProps(props, href) : props);
  }
  return state;
}

/**
 * Writes `clip` at `pos` with its formatting, as Word's paste that keeps the
 * formatting of where it comes from. What the clip does not say, such as a
 * font, the text takes from where it lands. One paragraph goes into the one
 * at `pos`; more of them bring their own paragraph formatting, lists and
 * styles. Returns the document and where the pasted text ends.
 */
export function insertClip(doc: Doc, pos: Position, clip: Clip): { doc: Doc; pos: Position } {
  const parts = clip.paragraphs;
  if (!parts.length) return { doc, pos };
  const base = propsAt(doc, pos);
  const styles = paragraphStyles(doc);
  const startedEmpty = paragraphLength(doc.paragraphs[pos.para]) === 0;

  // Each list of the clip becomes a list of the document.
  let numbering = doc.numbering;
  let used = Math.max(0, ...doc.paragraphs.map((p) => p.props.numId ?? 0));
  const lists = new Map<string, number>();
  for (const p of parts) {
    if (!p.list || parts.length === 1) continue;
    const key = `${p.list.id}:${p.list.kind}`;
    if (lists.has(key)) continue;
    const added = addList(numbering, p.list.kind, used);
    numbering = added.numbering;
    used = added.numId;
    lists.set(key, added.numId);
  }
  let state = { doc: numbering === doc.numbering ? doc : { ...doc, numbering }, pos };

  /** The paragraph formatting `part` gives the paragraph it is written in. */
  const paragraphProps = (part: ClipParagraph, current: ParagraphProps): ParagraphProps => {
    const style = part.style ? styles.find((s) => s.wordName?.toLowerCase() === part.style!.toLowerCase()) : undefined;
    const props: ParagraphProps = { ...(style ? style.paragraph : {}), ...portableParagraph(part.props), styleId: style?.id ?? '' };
    const numId = part.list && lists.get(`${part.list.id}:${part.list.kind}`);
    if (numId) {
      const level = Math.max(0, Math.min(part.list!.level, MAX_LIST_LEVEL));
      const def = levelOf(state.doc.numbering!, numId, level);
      Object.assign(props, { numId, listLevel: level, indentLeft: def?.indentLeft ?? 0, indentFirstLine: def?.indentFirstLine ?? 0 });
    } else {
      Object.assign(props, { numId: 0, listLevel: undefined });
    }
    return defined({ ...props, pageBreakBefore: current.pageBreakBefore });
  };
  const setProps = (para: number, part: ClipParagraph): void => {
    const paragraphs = state.doc.paragraphs.slice();
    const p = paragraphs[para];
    paragraphs[para] = { ...p, props: paragraphProps(part, p.props) } satisfies Paragraph;
    state = { ...state, doc: { ...state.doc, paragraphs } };
  };

  parts.forEach((part, i) => {
    if (i > 0) state = splitParagraph(state.doc, state.pos);
    const runBase = i === 0 ? base : propsAt(state.doc, state.pos);
    const style = part.style ? styles.find((s) => s.wordName?.toLowerCase() === part.style!.toLowerCase()) : undefined;
    state = writeRuns(state.doc, state.pos, part.runs, style ? { ...runBase, ...style.run } : runBase);
    // A piece of a paragraph is text in the paragraph it lands in; whole paragraphs, or one in an empty paragraph, bring their own looks.
    if (startedEmpty ? i === 0 || parts.length > 1 : parts.length > 1 && (i > 0 || pos.offset === 0)) setProps(state.pos.para, part);
  });
  return state;
}
