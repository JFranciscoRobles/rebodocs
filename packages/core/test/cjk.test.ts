import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  type Doc,
  type FontSpec,
  type TextMeasurer,
  createDoc,
  createParagraph,
  exportDocx,
  findAll,
  formatText,
  formatValue,
  importDocx,
  layoutDocument,
  moveWord,
  revisionsOf,
  trackEdit,
  wordRangeAt,
} from '../src/internal';
import { breaksBetween, cjkPieces, countWords } from '../src/cjk';

// Monospace fake: every character is half the font size wide; a Chinese one, the whole size, as in a Chinese font.
const measurer: TextMeasurer = {
  width: (text: string, font: FontSpec) => [...text].reduce((w, ch) => w + (/[　-鿿＀-￯]/.test(ch) ? font.size : font.size * 0.5), 0),
  metrics: (font: FontSpec) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

// 10pt text: a Chinese character is 10pt, a latin one 5pt; 100pt of text in a line.
const PAGE = { width: 120, height: 400, marginTop: 10, marginRight: 10, marginBottom: 10, marginLeft: 10 };

function docOf(text: string, para: Record<string, unknown> = {}): Doc {
  return createDoc([createParagraph(text, { fontSize: 10 }, { spacingAfter: 0, lineHeight: 1, ...para })], PAGE);
}

const lineTexts = (doc: Doc) => layoutDocument(doc, measurer).lines.map((line) => line.fragments.map((f) => f.text).join(''));

describe('Chinese text', () => {
  it('breaks a line between any two characters', () => {
    // Fourteen characters: ten fit in a line.
    expect(lineTexts(docOf('我们今天去公园散步然后回家吃饭'))).toEqual(['我们今天去公园散步然', '后回家吃饭']);
  });

  it('does not start a line with a comma or a full stop', () => {
    // The tenth character is "，": it goes with the one before it to the next line.
    expect(lineTexts(docOf('我们今天去公园散步了，然后回家'))).toEqual(['我们今天去公园散步', '了，然后回家']);
  });

  it('does not end a line with an opening mark', () => {
    expect(lineTexts(docOf('我们今天去公园散步「然后」回家'))).toEqual(['我们今天去公园散步', '「然后」回家']);
  });

  it('keeps a latin word whole beside Chinese', () => {
    // "Word" does not fit after nine characters: it starts the next line, not the Chinese before it.
    expect(lineTexts(docOf('我们今天去公园散步了Word文件'))).toEqual(['我们今天去公园散步了', 'Word文件']);
  });

  it('justifies a line by the room between its characters', () => {
    // Nine characters and "，" make 100pt; with a full stop that cannot start the next line, the first holds nine, 90pt.
    const layout = layoutDocument(docOf('一二三四五六七八九十。一二三', { align: 'justify' }), measurer);
    const first = layout.lines[0];
    expect(first.fragments.map((f) => f.text).join('')).toBe('一二三四五六七八九');
    expect(first.width).toBeCloseTo(100);
    // The last character ends at the right edge.
    const last = first.fragments[first.fragments.length - 1];
    expect(last.x + last.width).toBeCloseTo(110);
    // Each of the eight gaps takes 10/8 pt.
    expect(first.fragments[1].x - first.fragments[0].x).toBeCloseTo(11.25);
  });

  it('leaves alone a line of latin text', () => {
    expect(cjkPieces('approved')).toEqual([{ text: 'approved', from: 0 }]);
    expect(breaksBetween('a', 'b')).toBe(false);
  });

  it('keeps the two halves of a character past the first plane together', () => {
    // 𠀀 is two code units.
    expect(cjkPieces('𠀀𠀁')).toEqual([
      { text: '𠀀', from: 0 },
      { text: '𠀁', from: 2 },
    ]);
  });

  it('counts each character a word, as Word does', () => {
    expect(countWords('我们今天去公园。')).toBe(7);
    expect(countWords('我用Word写文件 hello')).toBe(7);
    expect(countWords('two words')).toBe(2);
  });
});

describe('Chinese words', () => {
  it('selects a word, not the whole sentence, with a double click', () => {
    const doc = docOf('我们今天去公园散步');
    const range = wordRangeAt(doc, { para: 0, offset: 5 });
    // The browser's dictionary finds the word: 公园, "park".
    expect(range.to.offset - range.from.offset).toBeLessThan(9);
    expect(range.from.offset).toBeLessThanOrEqual(5);
    expect(range.to.offset).toBeGreaterThan(5);
  });

  it('moves a word at a time through Chinese', () => {
    const doc = docOf('我们今天去公园');
    const next = moveWord(doc, { para: 0, offset: 0 }, 1);
    expect(next.offset).toBeGreaterThan(0);
    expect(next.offset).toBeLessThan(7);
  });

  it('finds a whole word beside Chinese characters', () => {
    expect(findAll(docOf('我用Word写文件'), 'Word', { wholeWord: true })).toHaveLength(1);
    expect(findAll(docOf('我们今天'), '今天', { wholeWord: true })).toHaveLength(1);
  });

  it('tracks an edit to Chinese text character by character, not the whole sentence', () => {
    const { doc } = trackEdit(docOf('任何一方均可以电话或书面形式取消。'), docOf('任何一方均可以书面形式取消。'), { author: 'Luis' }, { words: true });
    expect(revisionsOf(doc).map((r) => [r.type, r.text])).toEqual([['delete', '电话或']]);
  });

  it('writes the font of its Chinese characters back to Word', () => {
    const doc = createDoc([createParagraph('宋体文字', { fontFamily: 'SimSun' })]);
    const xml = strFromU8(unzipSync(exportDocx(doc))['word/document.xml']);
    expect(xml).toContain('w:eastAsia="SimSun"');
    const back = importDocx(exportDocx(doc));
    expect(back.paragraphs[0].runs[0].props.fontEastAsia).toBe('SimSun');
  });
});

describe('Chinese dates in variables', () => {
  it('reads a day written in Chinese, and 今天', () => {
    const today = new Date(2026, 9, 26);
    expect(formatValue('2026年10月12日', ['fecha larga'], { today, locale: 'es-MX' }).text).toBe('12 de octubre de 2026');
    expect(formatValue('今天', ['fecha larga'], { today, locale: 'es-MX' }).text).toBe('26 de octubre de 2026');
  });
});

describe('Chinese names of the formats of a variable', () => {
  it('reads them, and writes them in a document in Chinese', () => {
    const today = new Date(2026, 9, 26);
    expect(formatValue('2500', ['货币: CNY'], { today, locale: 'zh-CN' }).text).toBe('¥2,500.00');
    expect(formatValue('x', ['加粗']).props).toEqual({ bold: true });
    expect(formatValue('x', ['粗體']).props).toEqual({ bold: true });
    expect(formatText('currency', '', 'zh-CN')).toBe('货币');
    expect(formatText('currency', '', 'zh-TW')).toBe('貨幣');
    expect(formatText('dateLong', '', 'zh-Hant-HK')).toBe('長日期');
  });
});
