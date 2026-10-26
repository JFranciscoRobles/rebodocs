'use client';

import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';

// A line breaker the size of a demo, made the way the engine's is: the browser
// is asked how wide a word is, and the rest — where lines break, where each
// word goes — is worked out here. The engine does far more (tab stops, Word's
// rule for shrinking spaces, hyphens, pages); this is enough to see the idea.
// Chinese and Japanese, which have no spaces, break between any two
// characters, never before a closing mark: the engine's rule, made small.

export interface Placed {
  text: string;
  x: number;
  width: number;
  /** Whether a space follows it in the text. */
  space: boolean;
}

const HAN = '\\u2e80-\\u9fff\\uf900-\\ufaff\\u3000-\\u303f\\uff00-\\uffef';
/** A word, or one character of Chinese or Japanese. */
const TOKEN = new RegExp(`[${HAN}]|[^\\s${HAN}]+`, 'g');
/** What never starts a line: the closing marks. */
const NO_START = /^[，。、；：？！）」』】》〉…—·．,.;:?!)]/;

/** Where each word of `text` starts and ends, in the order the line breaker places them. */
export const tokensOf = (text: string) => [...text.matchAll(TOKEN)].map((m) => ({ text: m[0], start: m.index, end: m.index + m[0].length, space: /\s/.test(text[m.index + m[0].length] ?? '') }));

/** The text of a line, its words joined as they were. */
export const lineText = (line: Line) =>
  line.words
    .map((word) => word.text + (word.space ? ' ' : ''))
    .join('')
    .trimEnd();
export interface Line {
  y: number;
  words: Placed[];
}

/** The font of an element, as a canvas takes it, once the page's fonts are loaded. */
export function useFontOf(element: RefObject<HTMLElement | null>) {
  const [font, setFont] = useState<string>();
  useEffect(() => {
    // From its parts: the `font` shorthand can come back empty.
    const read = () => {
      if (!element.current) return;
      const style = getComputedStyle(element.current);
      setFont(`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`);
    };
    // Only once the fonts are there: a width measured in the fallback font would be kept under the real one's name.
    if (document.fonts) document.fonts.ready.then(read);
    else read();
  }, [element]);
  return font;
}

/**
 * The paragraph broken into lines `width` pixels wide, each word at its place.
 * `asked` is how many widths this time had to ask the browser, and `known` how
 * many it already had: the same word in the same font is asked once.
 */
export function useLines(text: string, font: string | undefined, width: number, lineHeight: number, justify: boolean) {
  const widths = useRef(new Map<string, number>());
  const canvas = useRef<CanvasRenderingContext2D | null>(null);

  return useMemo(() => {
    if (!font) return { lines: [] as Line[], asked: 0, known: 0 };
    let asked = 0;
    let known = 0;
    canvas.current ??= document.createElement('canvas').getContext('2d');
    const g = canvas.current!;
    const measure = (piece: string) => {
      const key = `${font}|${piece}`;
      let w = widths.current.get(key);
      if (w === undefined) {
        g.font = font;
        w = g.measureText(piece).width;
        widths.current.set(key, w);
        asked++;
      } else known++;
      return w;
    };

    const space = measure(' ');
    const out: Line[] = [];
    let line: Placed[] = [];
    let x = 0;
    const close = (last: boolean) => {
      if (justify && !last && line.length > 1) {
        const used = line.reduce((sum, word) => sum + word.width, 0);
        const gap = (width - used) / (line.length - 1);
        let at = 0;
        line = line.map((word) => {
          const placed = { ...word, x: at };
          at += word.width + gap;
          return placed;
        });
      }
      out.push({ y: out.length * lineHeight, words: line });
      line = [];
      x = 0;
    };
    for (const token of tokensOf(text)) {
      const w = measure(token.text);
      if (line.length && x + w > width && !NO_START.test(token.text)) close(false);
      line.push({ text: token.text, x, width: w, space: token.space });
      x += w + (token.space ? space : 0);
    }
    if (line.length) close(true);
    return { lines: out, asked, known };
  }, [text, font, width, lineHeight, justify]);
}
