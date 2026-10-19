// What is pasted from other programs as HTML (a web page, Word, Google Docs,
// a mail), read into a clip with the formatting it shows: bold, italics,
// underlines, colours, sizes and fonts, links, lists, headings, alignment.

import { type Clip, type ClipParagraph, type ClipRun, type RunProps, HIGHLIGHT_COLORS, defined, parseClip } from '@rebodocs/core';

const BLOCKS = new Set([
  'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'TR', 'TABLE', 'UL', 'OL', 'DL', 'DT', 'DD',
  'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'MAIN', 'FIGURE', 'FIGCAPTION', 'ADDRESS', 'HR', 'CENTER',
]);
const SKIPPED = new Set(['SCRIPT', 'STYLE', 'HEAD', 'TITLE', 'META', 'LINK', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'BUTTON', 'SELECT', 'INPUT', 'TEXTAREA', 'IMG']);
const GENERIC_FONTS = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-\w+|-apple-system|blinkmacsystemfont|inherit|initial)$/i;

interface Inherited {
  props: RunProps;
  href?: string;
  pre: boolean;
}

/** A colour of CSS as hex RGB, or undefined for none, a transparent one or one CSS names by a word. */
export function cssColor(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (m) return (m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]).toUpperCase();
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (!m) return undefined;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return undefined;
  return [m[1], m[2], m[3]].map((n) => Math.min(255, +n).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** The highlight of Word's palette nearest to `hex`; undefined for white, which is no highlight. */
function nearestHighlight(hex: string): string | undefined {
  const rgb = (h: string): number[] => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  if (r > 240 && g > 240 && b > 240) return undefined;
  let best = HIGHLIGHT_COLORS[0];
  let distance = Infinity;
  for (const color of HIGHLIGHT_COLORS) {
    const [cr, cg, cb] = rgb(color);
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < distance) [best, distance] = [color, d];
  }
  return best;
}

/** A length of CSS in points; undefined for one relative to something else. */
export function cssPoints(value: string): number | undefined {
  const m = /^(-?[\d.]+)(pt|px|in|cm|mm)$/.exec(value.trim().toLowerCase());
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  const factor = { pt: 1, px: 0.75, in: 72, cm: 72 / 2.54, mm: 72 / 25.4 }[m[2] as 'pt'];
  return Math.round(n * factor * 2) / 2;
}

/** The sizes CSS names by a word, in points. */
const SIZE_WORDS: Record<string, number> = { 'xx-small': 7, 'x-small': 7.5, small: 10, medium: 12, large: 13.5, 'x-large': 18, 'xx-large': 24, 'xxx-large': 36 };
/** The sizes of `<font size>`, from 1 to 7, in points. */
const FONT_SIZES = [7.5, 10, 12, 13.5, 18, 24, 36];
/** What a size relative to another is relative to when nothing gave one: the 16 pixels of a browser. */
const BROWSER_SIZE = 12;

const half = (n: number): number => Math.round(n * 2) / 2;

/** A font size of CSS in points, `inherited` being that of the text around it. */
export function cssFontSize(value: string, inherited = BROWSER_SIZE): number | undefined {
  const v = value.trim().toLowerCase();
  if (v in SIZE_WORDS) return SIZE_WORDS[v];
  if (v === 'smaller') return half(inherited / 1.2);
  if (v === 'larger') return half(inherited * 1.2);
  const m = /^([\d.]+)(em|rem|%)$/.exec(v);
  if (m) return half((m[2] === 'rem' ? BROWSER_SIZE : inherited) * parseFloat(m[1]) / (m[2] === '%' ? 100 : 1));
  return cssPoints(v);
}

/**
 * The line height of CSS as one of Word's: a multiple of the natural height
 * of a line. Word writes its own as a percentage, 115% for 1.15; a plain
 * number is of the size of the font, whose natural line is about 1.2 of it.
 */
export function cssLineHeight(value: string): number | undefined {
  const m = /^([\d.]+)(%?)$/.exec(value.trim());
  if (!m) return undefined;
  const n = m[2] ? parseFloat(m[1]) / 100 : parseFloat(m[1]) / 1.2;
  return n >= 0.5 && n <= 5 ? Math.round(n * 100) / 100 : undefined;
}

/**
 * Puts the rules of the style sheets of the page into the inline style of
 * what they apply to, before what the element has of its own. Word gives the
 * font, size and spacing of its ordinary paragraphs only there.
 */
function inlineStyleSheets(page: Document): void {
  const own = new Map<Element, string[]>();
  for (const sheet of page.querySelectorAll('style')) {
    const css = (sheet.textContent ?? '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--|-->/g, '');
    // Rules inside @media, @font-face, @page... are not about the text.
    const flat = css.replace(/@[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    for (const [, selectors, body] of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = selectors.split(',').map((x) => x.trim()).filter((x) => x && !x.includes(':')).join(',');
      if (!selector) continue;
      let found: NodeListOf<Element>;
      try {
        found = page.body.querySelectorAll(selector);
      } catch {
        continue;
      }
      for (const el of found) own.set(el, [...(own.get(el) ?? []), body.trim()]);
    }
  }
  for (const [el, bodies] of own) el.setAttribute('style', [...bodies, el.getAttribute('style') ?? ''].join(';'));
}

/** What the inline style of `el` changes in the formatting of its text. */
function styleProps(el: HTMLElement, props: RunProps): RunProps {
  const s = el.style;
  const out = { ...props };
  const weight = s.fontWeight;
  if (weight) out.bold = weight === 'bold' || weight === 'bolder' || parseInt(weight, 10) >= 600;
  if (s.fontStyle) out.italic = s.fontStyle === 'italic' || s.fontStyle === 'oblique';
  const lines = s.textDecorationLine || s.textDecoration;
  if (lines) {
    if (/underline/.test(lines)) out.underline = true;
    if (/line-through/.test(lines)) out.strike = true;
    if (/^none/.test(lines)) out.underline = out.strike = false;
  }
  const color = s.color && cssColor(s.color);
  if (color) out.color = color;
  const background = s.backgroundColor && cssColor(s.backgroundColor);
  if (background) out.highlight = nearestHighlight(background);
  const size = s.fontSize && cssFontSize(s.fontSize, props.fontSize);
  if (size && size >= 1 && size <= 400) out.fontSize = size;
  if (s.fontFamily) {
    const family = s.fontFamily.split(',').map((f) => f.trim().replace(/^["']|["']$/g, '')).find((f) => f && !GENERIC_FONTS.test(f));
    if (family) out.fontFamily = family;
  }
  return out;
}

/** What an old `<font>` says: the face, the size from 1 to 7, the colour. */
function fontProps(el: HTMLElement, props: RunProps): RunProps {
  const out = { ...props };
  const face = el.getAttribute('face')?.split(',')[0].trim();
  if (face) out.fontFamily = face;
  const size = el.getAttribute('size')?.trim();
  if (size) {
    const n = /^[+-]/.test(size) ? 3 + parseInt(size, 10) : parseInt(size, 10);
    if (n) out.fontSize = FONT_SIZES[Math.max(1, Math.min(7, n)) - 1];
  }
  const color = cssColor(el.getAttribute('color') ?? '');
  if (color) out.color = color;
  return out;
}

/** What the tag of `el` itself says of the formatting of its text. */
function tagProps(tag: string, props: RunProps): RunProps {
  switch (tag) {
    case 'B':
    case 'STRONG':
    case 'TH':
      return { ...props, bold: true };
    case 'I':
    case 'EM':
    case 'CITE':
    case 'DFN':
      return { ...props, italic: true };
    case 'U':
    case 'INS':
      return { ...props, underline: true };
    case 'S':
    case 'STRIKE':
    case 'DEL':
      return { ...props, strike: true };
    case 'CODE':
    case 'KBD':
    case 'SAMP':
    case 'TT':
    case 'PRE':
      return { ...props, fontFamily: 'Courier New' };
    case 'MARK':
      return { ...props, highlight: 'FFFF00' };
    case 'SMALL':
      return { ...props, fontSize: half((props.fontSize ?? BROWSER_SIZE) / 1.2) };
    case 'BIG':
      return { ...props, fontSize: half((props.fontSize ?? BROWSER_SIZE) * 1.2) };
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      return { ...props, bold: true };
  }
  return props;
}

const ALIGNS: Record<string, ClipParagraph['props']['align']> = {
  left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', justify: 'justify',
  // What Chrome writes for the alignment of <center> and of align="...".
  '-webkit-left': 'left', '-webkit-center': 'center', '-webkit-right': 'right', '-moz-left': 'left', '-moz-center': 'center', '-moz-right': 'right',
};

/** The list Word's own HTML says a paragraph is in: `mso-list: l0 level2 lfo1`. */
function msoList(el: HTMLElement): { id: number; level: number } | undefined {
  const m = /mso-list:\s*l(\d+)\s+level(\d+)/i.exec(el.getAttribute('style') ?? '');
  return m ? { id: 1000 + +m[1], level: +m[2] - 1 } : undefined;
}

/**
 * Reads the HTML of the clipboard into a clip. A clip copied from this editor
 * comes back whole; undefined when there is no text in it.
 */
export function clipFromHtml(html: string): Clip | undefined {
  const page = new DOMParser().parseFromString(html, 'text/html');
  const own = parseClip(page.querySelector('[data-rebodocs]')?.getAttribute('data-rebodocs'));
  if (own) return own;
  inlineStyleSheets(page);

  const paragraphs: ClipParagraph[] = [];
  let current: ClipParagraph | undefined;
  /** The paragraph being written, made when text first comes. */
  const paragraph = (): ClipParagraph => (current ??= { runs: [], props: {} });
  /** Ends the paragraph being written; what comes next starts another. */
  const end = (): void => {
    if (current) paragraphs.push(current);
    current = undefined;
  };
  let blockProps: ClipParagraph['props'] = {};
  let blockList: ClipParagraph['list'];
  let blockStyle: string | undefined;
  const lists: { id: number; kind: 'bullet' | 'number' }[] = [];
  let listIds = 0;

  const text = (value: string, at: Inherited): void => {
    let t = value.replace(/\r/g, '');
    if (!at.pre) {
      t = t.replace(/[ \t\n\f]+/g, ' ');
      // Spaces at the start of a paragraph are the indentation of the HTML, not text.
      if (!current?.runs.length || /[ \n]$/.test(current.runs[current.runs.length - 1].text)) t = t.replace(/^ +/, '');
      // A space that does not break is a space all the same.
      t = t.replace(/\u00a0/g, ' ');
    }
    if (!t) return;
    const p = paragraph();
    if (!p.runs.length) Object.assign(p, defined({ props: { ...blockProps }, list: blockList, style: blockStyle }));
    const last = p.runs[p.runs.length - 1];
    const props = defined({ ...at.props });
    if (last && last.href === at.href && JSON.stringify(last.props) === JSON.stringify(props)) last.text += t;
    else p.runs.push(defined<ClipRun>({ text: t, props, href: at.href }));
  };

  const walk = (node: Node, at: Inherited): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      text(node.textContent ?? '', at);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (SKIPPED.has(tag) || el.hidden || el.style.display === 'none') return;
    // Word writes the label of a list item as text, marked to be left out.
    if (/mso-list:\s*ignore/i.test(el.getAttribute('style') ?? '')) {
      const label = el.textContent?.trim() ?? '';
      if (blockList && /^[\w]{1,4}[.)]$/.test(label)) blockList = { ...blockList, kind: 'number' };
      return;
    }
    if (tag === 'BR') {
      // A line break ends a line inside the paragraph; at its very end it is nothing.
      if (el.nextSibling || el.parentElement?.lastChild !== el) text('\n', { ...at, pre: true });
      return;
    }
    const tagged = tag === 'FONT' ? fontProps(el, at.props) : tagProps(tag, at.props);
    let next: Inherited = { ...at, props: styleProps(el, tagged) };
    if (tag === 'A') {
      const href = el.getAttribute('href') ?? '';
      if (/^(https?:|mailto:|tel:)/i.test(href)) next = { ...next, href };
    }
    if (tag === 'PRE' || /^pre/.test(el.style.whiteSpace)) next = { ...next, pre: true };
    if (tag === 'TD' || tag === 'TH') {
      // Cells of a row are set apart by a tab.
      if (current?.runs.length) text('\t', { ...next, pre: true });
      el.childNodes.forEach((child) => walk(child, next));
      return;
    }
    if (!BLOCKS.has(tag)) {
      el.childNodes.forEach((child) => walk(child, next));
      return;
    }

    const saved = { blockProps, blockList, blockStyle };
    end();
    if (tag === 'UL' || tag === 'OL') {
      lists.push({ id: ++listIds, kind: tag === 'OL' ? 'number' : 'bullet' });
      el.childNodes.forEach((child) => walk(child, next));
      lists.pop();
      end();
      return;
    }
    const align = ALIGNS[el.style.textAlign] ?? (tag === 'CENTER' ? 'center' : undefined) ?? (el.getAttribute('align') ? ALIGNS[el.getAttribute('align')!.toLowerCase()] : undefined);
    // The space around a block is its own, not that of the blocks inside it.
    const { spacingBefore: _b, spacingAfter: _a, ...rest } = blockProps;
    const props: ClipParagraph['props'] = rest;
    if (align) props.align = align;
    const indent = el.style.marginLeft && cssPoints(el.style.marginLeft);
    if (indent && indent > 0 && tag !== 'LI') props.indentLeft = (props.indentLeft ?? 0) + indent;
    if (tag === 'BLOCKQUOTE') props.indentLeft = (props.indentLeft ?? 0) + 36;
    const first = el.style.textIndent && cssPoints(el.style.textIndent);
    if (first) props.indentFirstLine = first;
    if (tag !== 'TABLE' && tag !== 'TR') {
      const before = cssPoints(el.style.marginTop || '-');
      const after = cssPoints(el.style.marginBottom || '-');
      if (before !== undefined && before >= 0) props.spacingBefore = before;
      if (after !== undefined && after >= 0) props.spacingAfter = after;
      const line = cssLineHeight(el.style.lineHeight || '-');
      if (line) props.lineHeight = line;
    }
    blockProps = props;
    const heading = /^H([1-6])$/.exec(tag)?.[1];
    if (heading) blockStyle = +heading <= 3 ? `heading ${heading}` : undefined;
    if (tag === 'LI') {
      const list = lists[lists.length - 1];
      const level = Math.max(0, (+(el.getAttribute('aria-level') ?? 0) || lists.length) - 1);
      if (list) blockList = { id: lists[0].id, kind: list.kind, level };
    } else if (tag === 'P' || tag === 'DIV') {
      const mso = msoList(el);
      blockList = mso ? { id: mso.id, kind: 'bullet', level: mso.level } : blockList;
    }
    el.childNodes.forEach((child) => walk(child, next));
    // An empty paragraph of Word or Google Docs is a line left blank on purpose.
    if (!current && (tag === 'P' || /^H[1-6]$/.test(tag)) && el.textContent === '' && el.querySelector('br')) paragraph();
    end();
    ({ blockProps, blockList, blockStyle } = saved);
  };

  walk(page.body, { props: {}, pre: false });
  end();

  // Blank lines around what was copied are where it was cut from, not part of it.
  while (paragraphs.length && !paragraphs[0].runs.some((r) => r.text.trim())) paragraphs.shift();
  while (paragraphs.length && !paragraphs[paragraphs.length - 1].runs.some((r) => r.text.trim())) paragraphs.pop();
  for (const p of paragraphs) {
    const last = p.runs[p.runs.length - 1];
    if (last) last.text = last.text.replace(/[ \n]+$/, '');
  }
  return paragraphs.length ? { paragraphs } : undefined;
}
