import { describe, expect, it } from 'vitest';
import { dictionaryFor, wordsToCheck } from '../src/spellcheck';
import { DARK_THEME } from '../src/theme';

const words = (text: string) => wordsToCheck(text).map((one) => one.word);

describe('the words of a paragraph to check', () => {
  it('finds each word with where it starts and ends', () => {
    expect(wordsToCheck('El arrendatario pagará')).toEqual([
      { word: 'El', from: 0, to: 2 },
      { word: 'arrendatario', from: 3, to: 15 },
      { word: 'pagará', from: 16, to: 22 },
    ]);
  });

  it('keeps an apostrophe inside a word', () => {
    expect(words("don't l’eau")).toEqual(["don't", 'l’eau']);
  });

  it('leaves out single letters, capitals, words joined to digits, variables, addresses and emails', () => {
    expect(words('y a IVA 3er A4 {{cliente}} {{#items}} https://rebodocs.com www.example.com ana@example.com renta')).toEqual(['renta']);
  });
});

describe('the dictionary of a language', () => {
  const dictionaries = { es: 1, 'en-GB': 2, en: 3 };
  it('is the one of the whole tag, or else of the language alone', () => {
    expect(dictionaryFor(dictionaries, 'es-MX')).toBe('es');
    expect(dictionaryFor(dictionaries, 'en-GB')).toBe('en-GB');
    expect(dictionaryFor(dictionaries, 'en-us')).toBe('en');
    expect(dictionaryFor(dictionaries, 'fr-FR')).toBeUndefined();
  });
});

describe('the dark theme', () => {
  /** Contrast between two colours as #rrggbb, as WCAG counts it. */
  const contrast = (a: string, b: string) => {
    const light = (hex: string) => {
      const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [light(a), light(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  it('has text that reads at 4.5:1 or more on every background of the interface', () => {
    const { '--dx-ui-ink': ink, '--dx-ui-muted': muted, '--dx-ui-accent': accent } = DARK_THEME;
    for (const background of [DARK_THEME['--dx-ui-bg'], DARK_THEME['--dx-ui-bar'], DARK_THEME['--dx-ui-hover']]) {
      for (const text of [ink, muted, accent]) expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(DARK_THEME['--dx-ui-accent'], DARK_THEME['--dx-ui-active'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(DARK_THEME['--dx-ui-on-accent'], DARK_THEME['--dx-ui-accent'])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('inkOn', () => {
  it('gives the ink that stands out more on each colour of the people of a room', async () => {
    const { inkOn } = await import('../src/theme');
    const { PEER_COLORS } = await import('../../collab/src/server');
    const lum = (hex: string) =>
      [0, 2, 4]
        .map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    for (const color of PEER_COLORS) {
      const l = lum(color);
      const ratio = inkOn(color) === '#000' ? (l + 0.05) / 0.05 : 1.05 / (l + 0.05);
      expect(ratio, color).toBeGreaterThanOrEqual(4.5);
    }
    expect(inkOn('FFFFFF')).toBe('#000');
    expect(inkOn('000000')).toBe('#fff');
  });
});

describe('Chinese in a paragraph to check', () => {
  it('leaves out the Chinese, which has no dictionary, and checks the latin words beside it', () => {
    expect(words('我们用Wrod写文件')).toEqual(['Wrod']);
    expect(words('我们今天去公园')).toEqual([]);
  });
});
