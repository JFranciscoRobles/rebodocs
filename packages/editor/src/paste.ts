// What is pasted from other programs as HTML (a web page, Word, Google Docs,
// a mail), read into a clip with the formatting it shows: bold, italics,
// underlines, colours, sizes and fonts, links, lists, headings, alignment.

import { type Border, type CellLines, type Clip, type ClipCell, type ClipParagraph, type ClipRun, type ClipTable, type RunProps, HIGHLIGHT_COLORS, defined, parseClip } from '@rebodocs/core/internal';

const BLOCKS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'TR',
  'TABLE',
  'UL',
  'OL',
  'DL',
  'DT',
  'DD',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'ASIDE',
  'NAV',
  'MAIN',
  'FIGURE',
  'FIGCAPTION',
  'ADDRESS',
  'HR',
  'CENTER',
]);
const SKIPPED = new Set(['SCRIPT', 'STYLE', 'HEAD', 'TITLE', 'META', 'LINK', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'BUTTON', 'SELECT', 'INPUT', 'TEXTAREA', 'IMG']);
const GENERIC_FONTS = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-\w+|-apple-system|blinkmacsystemfont|inherit|initial)$/i;

interface Inherited {
  props: RunProps;
  href?: string;
  pre: boolean;
}

/**
 * Colours CSS names by a word that are written for text: Word writes `white`
 * for white text. Black is left out, as `windowtext` and `auto` are: it is the
 * colour of text that has none, which a dark page shows light.
 */
const COLOR_NAMES: Record<string, string> = {
  white: 'FFFFFF',
  red: 'FF0000',
  green: '008000',
  blue: '0000FF',
  yellow: 'FFFF00',
  navy: '000080',
  maroon: '800000',
  purple: '800080',
  teal: '008080',
  olive: '808000',
  gray: '808080',
  grey: '808080',
  silver: 'C0C0C0',
  orange: 'FFA500',
};

/** A colour of CSS as hex RGB, or undefined for none, a transparent one, black, or a word it does not know. */
export function cssColor(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (v in COLOR_NAMES) return COLOR_NAMES[v];
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
  if (m) return (m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]).toUpperCase();
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (!m) return undefined;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return undefined;
  return [m[1], m[2], m[3]]
    .map((n) => Math.min(255, +n).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
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
  if (m) return half(((m[2] === 'rem' ? BROWSER_SIZE : inherited) * parseFloat(m[1])) / (m[2] === '%' ? 100 : 1));
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
      const selector = selectors
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x && !x.includes(':'))
        .join(',');
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
    const family = s.fontFamily
      .split(',')
      .map((f) => f.trim().replace(/^["']|["']$/g, ''))
      .find((f) => f && !GENERIC_FONTS.test(f));
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
  left: 'left',
  start: 'left',
  center: 'center',
  right: 'right',
  end: 'right',
  justify: 'justify',
  // What Chrome writes for the alignment of <center> and of align="...".
  '-webkit-left': 'left',
  '-webkit-center': 'center',
  '-webkit-right': 'right',
  '-moz-left': 'left',
  '-moz-center': 'center',
  '-moz-right': 'right',
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
  const tables: ClipTable[] = [];
  /** The cell of a table being read, and how deep in tables the reading is: a table inside a cell comes as lines. */
  let cellAt: ClipParagraph['cell'];
  let depth = 0;
  let current: ClipParagraph | undefined;
  /** The paragraph being written, made when text first comes. */
  const paragraph = (): ClipParagraph => (current ??= defined<ClipParagraph>({ runs: [], props: {}, cell: cellAt }));
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
    if (tag === 'TABLE' && depth === 0 && isTable(el as HTMLTableElement)) {
      end();
      readTable(el as HTMLTableElement, next);
      return;
    }
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

  /**
   * A table: its grid, worked out from the cells each row has and those that
   * span rows and columns into it; each cell's paragraphs, read as any other;
   * the widths its cells or columns say, and the rows that are its heading.
   */
  const readTable = (el: HTMLTableElement, at: Inherited): void => {
    const rows = rowsOf(el);
    const index = tables.length;
    const table: ClipTable = { rows: rows.length, columns: 0 };
    tables.push(table);
    const taken = new Set<string>();
    const merges: NonNullable<ClipTable['merges']> = [];
    const cells: ClipCell[] = [];
    const heights: NonNullable<ClipTable['heights']> = [];
    rows.forEach((tr, r) => {
      const said = declarations(tr);
      // Word says it on the row, and again on its cells; a browser on either.
      const height = cssLength(said.get('height') ?? '') ?? Math.max(0, ...cellsOf(tr).map((td) => cssLength(declarations(td).get('height') ?? '') ?? 0));
      if (height > 0) heights.push(defined({ row: r, height, exact: said.get('mso-height-rule') === 'exactly' || undefined }));
    });
    const widths: number[] = [];
    [...el.children]
      .flatMap((child) => (child.tagName.toUpperCase() === 'COLGROUP' ? [...child.children] : [child]))
      .filter((col) => col.tagName.toUpperCase() === 'COL')
      .forEach((col, c) => {
        if (!(col instanceof HTMLElement)) return;
        const w = cssPoints(col.style.width || '-') ?? (Number(col.getAttribute('width')) * 0.75 || undefined);
        if (w && w > 0) widths[c] = w;
      });
    const saved = { blockProps, blockList, blockStyle };
    rows.forEach((tr, r) => {
      let c = 0;
      for (const td of cellsOf(tr)) {
        while (taken.has(`${r}:${c}`)) c++;
        const columns = Math.max(1, Math.min(63, Number(td.getAttribute('colspan')) || 1));
        const down = Math.max(1, Math.min(rows.length - r, Number(td.getAttribute('rowspan')) || 1));
        for (let rr = r; rr < r + down; rr++) for (let cc = c; cc < c + columns; cc++) taken.add(`${rr}:${cc}`);
        if (columns > 1 || down > 1) merges.push({ row: r, column: c, rows: down, columns });
        if (columns === 1 && widths[c] === undefined) {
          const w = cssPoints(td.style.width || '-') ?? (Number(td.getAttribute('width')) * 0.75 || undefined);
          if (w && w > 0) widths[c] = w;
        }
        const look = cellLook(td, r, c);
        if (look) cells.push(look);
        // A place Word keeps for a row that starts or ends further in than the others is no cell to write in.
        if (declarations(td).get('mso-cell-special') === 'placeholder') {
          c += columns;
          continue;
        }
        // A cell starts afresh: the look of the blocks around the table is not its own.
        cellAt = { table: index, row: r, column: c };
        ({ blockProps, blockList, blockStyle } = { blockProps: {}, blockList: undefined, blockStyle: undefined });
        depth++;
        td.childNodes.forEach((child) => walk(child, at));
        depth--;
        end();
        c += columns;
      }
    });
    cellAt = undefined;
    ({ blockProps, blockList, blockStyle } = saved);
    table.columns = Math.max(1, ...[...taken].map((key) => Number(key.split(':')[1]) + 1));
    if (merges.length) table.merges = merges;
    if (cells.length) table.cells = cells;
    if (heights.length) table.heights = heights;
    if (widths.length === table.columns && widths.every((w) => w > 0)) table.widths = widths;
    let header = 0;
    while (header < rows.length - 1 && (rows[header].parentElement?.tagName.toUpperCase() === 'THEAD' || cellsOf(rows[header]).every((td) => td.tagName.toUpperCase() === 'TH'))) header++;
    if (header) table.header = header;
  };

  walk(page.body, { props: {}, pre: false });
  end();

  // Blank lines around what was copied are where it was cut from, not part of it; an empty cell is part of its table.
  const blank = (p: ClipParagraph) => !p.cell && !p.runs.some((r) => r.text.trim());
  while (paragraphs.length && blank(paragraphs[0])) paragraphs.shift();
  while (paragraphs.length && blank(paragraphs[paragraphs.length - 1])) paragraphs.pop();
  for (const p of paragraphs) {
    const last = p.runs[p.runs.length - 1];
    if (last) last.text = last.text.replace(/[ \n]+$/, '');
  }
  // A table nothing of which was read is not kept; the others keep their numbers.
  if (!paragraphs.length) return undefined;
  return tables.length ? { paragraphs, tables } : { paragraphs };
}

/**
 * The declarations of an element's style as written, by property in lower
 * case: a browser drops those it does not know, and Word says what its tables
 * are in its own (`mso-border-alt`, `mso-height-rule`).
 */
function declarations(el: Element): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (el.getAttribute('style') ?? '').split(';')) {
    const colon = part.indexOf(':');
    if (colon > 0)
      out.set(
        part.slice(0, colon).trim().toLowerCase(),
        part
          .slice(colon + 1)
          .trim()
          .replace(/\s+/g, ' '),
      );
  }
  return out;
}

/** A length of CSS in points, unrounded: the lines of a table are as thin as a quarter of a point. */
function cssLength(value: string): number | undefined {
  const m = /^(-?[\d.]+)(pt|px|in|cm|mm)$/.exec(value.trim().toLowerCase());
  if (!m) return undefined;
  return Math.round(parseFloat(m[1]) * { pt: 1, px: 0.75, in: 72, cm: 72 / 2.54, mm: 72 / 25.4 }[m[2] as 'pt'] * 100) / 100;
}

const BORDER_STYLES: Record<string, Border['style'] | null> = { solid: 'single', double: 'double', dashed: 'dashed', dotted: 'dotted', none: null, hidden: null };
const BORDER_WIDTHS: Record<string, number> = { thin: 0.75, medium: 2.25, thick: 3.75 };
/** The words for black, which a line is drawn in when it says no other colour. */
const COLOR_WORDS: Record<string, string> = { black: '000000', windowtext: '000000', auto: '000000' };

/** A border of CSS, `solid #8EAADB .5pt`: null for none, undefined when it says nothing to go by. */
function cssBorder(value: string): Border | null | undefined {
  let style: Border['style'] | null | undefined;
  let width: number | undefined;
  let color = '000000';
  for (const token of value.toLowerCase().split(' ')) {
    if (token in BORDER_STYLES) style = BORDER_STYLES[token];
    else if (token in BORDER_WIDTHS) width = BORDER_WIDTHS[token];
    else if (cssLength(token) !== undefined) width = cssLength(token);
    else color = cssColor(token) ?? COLOR_WORDS[token] ?? color;
  }
  if (style === null || width === 0) return null;
  if (!style) return undefined;
  // A double line's width in CSS is the whole of it, two lines and the room between; the model's is one of them.
  const whole = width ?? 0.75;
  return { style, width: style === 'double' ? Math.round((whole / 3) * 100) / 100 : whole, color };
}

/**
 * The look of a cell of a table pasted: its colour, where its text sits, and
 * the line of each side. Word writes each line twice: in CSS, thickened for a
 * browser and left out where the cell beside draws it, and as it is in its
 * own (`mso-border-alt`, `mso-border-top-alt`), which is the one taken.
 * Measured on what Word for Mac puts on the clipboard.
 */
function cellLook(td: HTMLElement, row: number, column: number): ClipCell | undefined {
  const said = declarations(td);
  // A place Word keeps for a row that starts or ends further in than the others is drawn with nothing.
  if (said.get('mso-cell-special') === 'placeholder') return { row, column, lines: {} };
  const background = said.get('background-color') ?? said.get('background');
  const shade = background ? cssColor(background.split(' ')[0]) : undefined;
  // A cell HTML does not say otherwise of has its text in the middle: Word says top where it is at the top.
  const align = (said.get('vertical-align') ?? td.getAttribute('valign') ?? 'middle').toLowerCase();
  const valign = align === 'middle' || align === 'center' ? ('center' as const) : align === 'bottom' ? ('bottom' as const) : undefined;
  const read = (property: string) => {
    const value = said.get(property);
    return value === undefined ? undefined : cssBorder(value);
  };
  const lines: CellLines = {};
  let lined = false;
  const all = read('mso-border-alt');
  for (const key of ['top', 'right', 'bottom', 'left'] as const) {
    const css = read(`border-${key}`) ?? read('border');
    const own = read(`mso-border-${key}-alt`);
    // Its own first; then, where CSS draws a line, what Word says all its lines are.
    const line = own !== undefined ? own : css === null ? null : css && all !== undefined ? all : css;
    if (line === undefined) continue;
    lined = true;
    if (line) lines[key] = line;
  }
  const look = defined<ClipCell>({ row, column, shade, valign, lines: lined ? lines : undefined });
  return Object.keys(look).length > 2 ? look : undefined;
}

/** Whether an HTML table is a table of data, not one a page or a mail is laid out with: one cell, or one that says so. */
function isTable(el: HTMLTableElement): boolean {
  if (el.getAttribute('role') === 'presentation' || el.getAttribute('role') === 'none') return false;
  const rows = rowsOf(el);
  return rows.length > 1 || (rows[0] ? cellsOf(rows[0]).length > 1 : false);
}

/** The rows of a table, its own and not those of a table inside it: in it, or in its head, body and foot. */
function rowsOf(table: Element): HTMLElement[] {
  const tag = (el: Element) => el.tagName.toUpperCase();
  return [...table.children].flatMap((child) => (['THEAD', 'TBODY', 'TFOOT'].includes(tag(child)) ? [...child.children] : [child])).filter((row): row is HTMLElement => tag(row) === 'TR');
}

/** The cells of a row. */
const cellsOf = (row: Element): HTMLElement[] => [...row.children].filter((cell): cell is HTMLElement => ['TD', 'TH'].includes(cell.tagName.toUpperCase()));
