// Chinese, and the other languages written without spaces between words
// (Japanese). A line of them may break between any two characters, as in
// Word, except where a mark of punctuation would start a line ("。", "，",
// "」") or end one ("「", "（"): the rules Word follows for Chinese, its
// kinsoku. Korean is left out: it puts spaces between its words.

/** A character of a script written without spaces: Han, kana, bopomofo, and the punctuation and full-width forms they are set with. */
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Bopomofo}　-〿ー︰-﹏＀-￯]/u;

/** What may not start a line: closing marks and the punctuation that follows a word. Word's list for Chinese, Simplified and Traditional. */
const NO_START = new Set(
  '!%),.:;?]}¢°·’”†‡›℃∶、。〃〆〕〗〞﹚﹜！＂％＇），．：；？］｝～」』】〉》〙〛〟﹐﹑﹒﹔﹕﹖﹗﹘﹞︰︱︳︴︶︸︺︼︾﹀﹂﹄｠｡｣､･ーぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ…‥',
);
/** What may not end a line: opening marks, and the signs that go before a number. */
const NO_END = new Set('$(£¥‘“〈《「『【〔〖〘〚〝﹙﹛﹝＄（［｛￡￥｟｢');

/** The fonts made for Chinese and Japanese, and any whose name is written in them (宋体, 微软雅黑). */
const CJK_FONT =
  /[^ -~]|^(?:N?SimSun|SimHei|SimKai|SimFang|FangSong|KaiTi|DengXian|Microsoft (?:YaHei|JhengHei)|PingFang|Heiti|Songti|Kaiti|ST(?:Song|Heiti|Kaiti|Fangsong|Xihei|Zhongsong)|P?MingLiU|DFKai-SB|Noto (?:Sans|Serif) (?:CJK|SC|TC|HK|JP)|Source Han|MS (?:P?Mincho|P?Gothic)|Yu (?:Gothic|Mincho)|Meiryo|Hiragino)/i;

/** Whether a font is one for Chinese or Japanese: chosen for a text, it is the font of its Chinese characters too, as in Word. */
export const isCjkFont = (family: string): boolean => CJK_FONT.test(family.trim());

/** Whether a character is of a script written without spaces between words. */
export const isCjk = (ch: string): boolean => CJK.test(ch);

/** Whether a text has any character written without spaces between words. */
export const hasCjk = (text: string): boolean => CJK.test(text);

/** The last character of a text, the two halves of one past the first plane together. */
export function lastChar(text: string): string {
  const code = text.codePointAt(text.length - 2);
  return code !== undefined && code > 0xffff ? text.slice(-2) : text.slice(-1);
}

/**
 * Whether a line may break between `before` and `after`, two characters with
 * no space between them: where either is Chinese, unless the punctuation
 * says no.
 */
export function breaksBetween(before: string, after: string): boolean {
  if (!before || !after) return false;
  if (!isCjk(before) && !isCjk(after)) return false;
  return !NO_START.has(after) && !NO_END.has(before);
}

/** A word of text, without spaces, cut where a line may break inside it: each Chinese character a piece, its punctuation kept with it. */
export function cjkPieces(word: string): { text: string; from: number }[] {
  if (!hasCjk(word)) return [{ text: word, from: 0 }];
  const out: { text: string; from: number }[] = [];
  let from = 0;
  let before = '';
  let i = 0;
  for (const ch of word) {
    if (before && breaksBetween(before, ch)) {
      out.push({ text: word.slice(from, i), from });
      from = i;
    }
    before = ch;
    i += ch.length;
  }
  out.push({ text: word.slice(from), from });
  return out;
}

/** How many words a text has, as Word counts them: what spaces part, and each Chinese character one. */
export function countWords(text: string): number {
  let n = 0;
  for (const chunk of text.split(/\s+/)) {
    if (!chunk) continue;
    if (!hasCjk(chunk)) {
      n++;
      continue;
    }
    // Each character one word; what is between them, written in another script, one more.
    let other = false;
    for (const ch of chunk) {
      if (isCjk(ch)) {
        if (/[\p{L}\p{N}]/u.test(ch)) n++;
        if (other) n++;
        other = false;
      } else if (/[\p{L}\p{N}]/u.test(ch)) {
        other = true;
      }
    }
    if (other) n++;
  }
  return n;
}

let segmenter: Intl.Segmenter | null | undefined;

/**
 * Where the word that holds `offset` starts and ends in a run of Chinese text,
 * as the browser's dictionary for the language finds its words; one character
 * when there is none to ask.
 */
export function cjkWordAt(text: string, offset: number): { from: number; to: number } {
  if (segmenter === undefined) {
    try {
      segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('zh', { granularity: 'word' }) : null;
    } catch {
      segmenter = null;
    }
  }
  if (segmenter) {
    for (const part of segmenter.segment(text)) {
      if (offset >= part.index && offset < part.index + part.segment.length) return { from: part.index, to: part.index + part.segment.length };
    }
  }
  const code = text.codePointAt(offset);
  return { from: offset, to: offset + (code !== undefined && code > 0xffff ? 2 : 1) };
}
