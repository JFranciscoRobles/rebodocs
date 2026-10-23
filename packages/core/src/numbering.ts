// Lists: numbering definitions and the counters that turn them into labels.
//
// The counter rules (restarts, start overrides, legal numbering, Word-style
// letters) are ported from WordCraft's crates/doc/src/numbering.rs,
// Copyright (c) 2026 ArtCraft Team and the WordCraft contributors, MIT license
// (see THIRD_PARTY_NOTICES.md).

import type { Doc, RunProps } from './model';

export type NumFormat = 'decimal' | 'decimalZero' | 'lowerLetter' | 'upperLetter' | 'lowerRoman' | 'upperRoman' | 'bullet' | 'none';

export interface ListLevel {
  start: number;
  format: NumFormat;
  /** Label template: '%1.', '%1.%2.', or the bullet character. */
  text: string;
  /** Where the label sits relative to the number position. */
  align: 'left' | 'center' | 'right';
  /** What separates the label from the text. */
  suffix: 'tab' | 'space' | 'nothing';
  /** Indents the level gives its paragraphs, in points; same meaning as in ParagraphProps. */
  indentLeft?: number;
  indentFirstLine?: number;
  /** Label formatting (bullet font, bold numbers...), on top of the paragraph's. */
  run: RunProps;
  /** False for a level that keeps counting when a higher level is used. */
  restart: boolean;
  /** Restart only after this level (1-based) or a higher one is used; undefined = any higher level. */
  restartAfter?: number;
  /** Show every level in Arabic digits (legal numbering). */
  legal: boolean;
  /** Paragraph style linked to this level, as headings with outline numbering have. */
  style?: string;
}

export interface ListInstance {
  abstractId: number;
  /** Start values this list sets itself, by level. */
  starts: Map<number, number>;
  /** Levels this list defines itself instead of taking them from its abstract list. */
  levels: Map<number, ListLevel>;
}

export interface Numbering {
  /** Level definitions by abstract list id; the index is the level. */
  abstracts: Map<number, (ListLevel | undefined)[]>;
  /** Lists by the id paragraphs refer to (`numId`). */
  lists: Map<number, ListInstance>;
}

export const MAX_LIST_LEVEL = 8;

export function levelOf(numbering: Numbering, numId: number, level: number): ListLevel | undefined {
  const list = numbering.lists.get(numId);
  if (!list) return undefined;
  return list.levels.get(level) ?? numbering.abstracts.get(list.abstractId)?.[level];
}

/** The level of `numId` linked to a paragraph style, for paragraphs whose style gives the list but no level. */
export function listLevelOfStyle(numbering: Numbering, numId: number, styleId: string): number | undefined {
  for (let level = 0; level <= MAX_LIST_LEVEL; level++) {
    if (levelOf(numbering, numId, level)?.style === styleId) return level;
  }
  return undefined;
}

function roman(n: number): string {
  const table: [number, string][] = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];
  let out = '';
  n = Math.min(n, 50_000);
  for (const [value, digits] of table) {
    while (n >= value) {
      out += digits;
      n -= value;
    }
  }
  return out;
}

/** Word-style letters: a..z, aa..zz, aaa.. (the letter repeated, not base 26). */
function letters(n: number): string {
  if (n <= 0) return '';
  n = Math.min(n, 780);
  return String.fromCharCode(97 + ((n - 1) % 26)).repeat(Math.floor((n - 1) / 26) + 1);
}

/** Formats a counter value. Formats that are not modelled show as decimal. */
export function formatNumber(format: NumFormat, n: number): string {
  switch (format) {
    case 'decimalZero':
      return String(n).padStart(2, '0');
    case 'lowerRoman':
      return roman(n);
    case 'upperRoman':
      return roman(n).toUpperCase();
    case 'lowerLetter':
      return letters(n);
    case 'upperLetter':
      return letters(n).toUpperCase();
    case 'bullet':
    case 'none':
      return '';
    default:
      return String(n);
  }
}

export interface ListLabel {
  text: string;
  level: ListLevel;
}

/** Running list counters while walking a document in order. */
export class ListCounters {
  /** Last value shown per level, by abstract list; null for a level that has not counted since its restart. */
  private state = new Map<number, (number | null)[]>();
  /** Lists whose start overrides were already applied. */
  private seen = new Set<number>();

  /** Advances the counter of `numId` at `level` and returns its label, or undefined when the level shows none. */
  next(numbering: Numbering, numId: number, level: number): ListLabel | undefined {
    const list = numbering.lists.get(numId);
    if (!list) return undefined;
    const lv = Math.max(0, Math.min(level, MAX_LIST_LEVEL));
    const def = levelOf(numbering, numId, lv);
    // A 'none' level shows no label at all, not even its text.
    if (!def || def.format === 'none') return undefined;

    let values = this.state.get(list.abstractId);
    if (!values) {
      values = new Array<number | null>(MAX_LIST_LEVEL + 1).fill(null);
      this.state.set(list.abstractId, values);
    }
    if (!this.seen.has(numId)) {
      this.seen.add(numId);
      for (const [l, start] of list.starts) if (l <= MAX_LIST_LEVEL) values[l] = start - 1;
    }
    const last = values[lv];
    values[lv] = last === null ? def.start : last + 1;
    // Deeper levels restart, unless they never do or only restart after a level above this one.
    for (let d = lv + 1; d <= MAX_LIST_LEVEL; d++) {
      const deeper = levelOf(numbering, numId, d);
      if (!deeper || (deeper.restart && (deeper.restartAfter === undefined || lv < deeper.restartAfter))) {
        values[d] = null;
      }
    }

    if (def.format === 'bullet') return { text: def.text, level: def };
    const text = def.text.replace(/%([1-9])/g, (_, digit: string) => {
      const k = Number(digit) - 1;
      const other = levelOf(numbering, numId, k);
      const value = values[k] ?? other?.start ?? 1;
      const format = other?.format ?? 'decimal';
      return formatNumber(def.legal && format !== 'decimalZero' ? 'decimal' : format, value);
    });
    return { text, level: def };
  }
}

/** The label of every paragraph, in document order; undefined for paragraphs outside a list. */
export function listLabels(doc: Doc): (ListLabel | undefined)[] {
  const { numbering } = doc;
  if (!numbering) return [];
  const counters = new ListCounters();
  return doc.paragraphs.map((p) => (p.props.numId ? counters.next(numbering, p.props.numId, p.props.listLevel ?? 0) : undefined));
}

// Bullets Word writes as codes of its symbol fonts (as U+F0xx, or as the plain
// 8-bit code), mapped to characters ordinary fonts have. Only the bullets of
// Word's galleries are listed; the values follow Unicode's published tables for
// Symbol and Wingdings, with a common look-alike where the exact character is
// one few fonts carry.
const SYMBOL_BULLETS: Record<string, Record<number, string>> = {
  symbol: { 0xb7: '•', 0xa8: '♦', 0xae: '→', 0xde: '⇒' },
  wingdings: {
    0x6c: '●',
    0x6e: '■',
    0x6f: '□',
    0x71: '❑',
    0x75: '◆',
    0x76: '❖',
    0x9f: '•',
    0xa7: '▪',
    0xa8: '□',
    0xd8: '➢',
    0xe0: '→',
    0xe8: '➔',
    0xf0: '⇨',
    0xfc: '✓',
  },
};

export function isSymbolFont(family: string | undefined): boolean {
  return !!family && family.trim().toLowerCase() in SYMBOL_BULLETS;
}

/** Text of a label set in a symbol font, as characters to draw in an ordinary font. */
export function symbolText(text: string, family: string): string {
  const table = SYMBOL_BULLETS[family.trim().toLowerCase()];
  if (!table) return text;
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const code = cp >= 0xf020 && cp <= 0xf0ff ? cp - 0xf000 : cp;
    // A code outside the table still has to show as a bullet, not as a missing glyph.
    out += table[code] ?? (cp >= 0xf020 && cp <= 0xf0ff ? '•' : ch);
  }
  return out;
}

export type ListKind = 'bullet' | 'number';

/** Whether a level shows bullets or numbers; undefined for one that shows no label. */
export function listKind(numbering: Numbering | undefined, numId: number, level: number): ListKind | undefined {
  const def = numbering && levelOf(numbering, numId, level);
  if (!def || def.format === 'none') return undefined;
  return def.format === 'bullet' ? 'bullet' : 'number';
}

// The bullets Word's own lists use, written as it writes them: a code of a symbol font.
const BULLETS: { text: string; font: string }[] = [
  { text: '', font: 'Symbol' },
  { text: 'o', font: 'Courier New' },
  { text: '', font: 'Wingdings' },
];
const NUMBER_FORMATS: NumFormat[] = ['decimal', 'lowerLetter', 'lowerRoman'];

/** The nine levels of a new list: half an inch deeper per level, with the label a quarter inch before the text. */
function newListLevels(kind: ListKind): ListLevel[] {
  return Array.from({ length: MAX_LIST_LEVEL + 1 }, (_, i): ListLevel => {
    const bullet = BULLETS[i % 3];
    return {
      start: 1,
      format: kind === 'bullet' ? 'bullet' : NUMBER_FORMATS[i % 3],
      text: kind === 'bullet' ? bullet.text : `%${i + 1}.`,
      align: 'left',
      suffix: 'tab',
      indentLeft: 36 * (i + 1),
      indentFirstLine: -18,
      run: kind === 'bullet' ? { fontFamily: bullet.font } : {},
      restart: true,
      legal: false,
    };
  });
}

/**
 * Adds a new list and returns its id. `usedNumId` is the highest list id the
 * document's paragraphs refer to, which may not be defined in `numbering`.
 */
export function addList(numbering: Numbering | undefined, kind: ListKind, usedNumId = 0): { numbering: Numbering; numId: number } {
  const abstracts = new Map(numbering?.abstracts);
  const lists = new Map(numbering?.lists);
  const abstractId = Math.max(-1, ...abstracts.keys()) + 1;
  const numId = Math.max(0, usedNumId, ...lists.keys()) + 1;
  abstracts.set(abstractId, newListLevels(kind));
  lists.set(numId, { abstractId, starts: new Map(), levels: new Map() });
  return { numbering: { abstracts, lists }, numId };
}
