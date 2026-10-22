import { beforeEach, describe, expect, it } from 'vitest';
import { colorName, spokenChar, spokenText } from '../src/a11y';
import { setLocale } from '../src/i18n';

// The tests are written in Spanish first, as the interface was.
beforeEach(() => setLocale('es'));

describe('what a screen reader is told', () => {
  it('names a colour, not its number', () => {
    expect(colorName('434343')).toBe('gris oscuro');
    expect(colorName('#FF0000')).toBe('rojo');
    expect(colorName('002060')).toBe('azul oscuro');
    expect(colorName('')).toBe('sin color');
    setLocale('en');
    expect(colorName('434343')).toBe('dark gray');
    expect(colorName('C0C0C0')).toBe('light gray');
  });

  it('gives each colour of a palette a name of its own', () => {
    const text = ['000000', '434343', '666666', '999999', 'C00000', 'FF0000', 'FFC000', 'FFFF00', '92D050', '00B050', '00B0F0', '0070C0', '002060', '7030A0', 'C55A11', 'FFFFFF'];
    const highlight = ['FFFF00', '00FF00', '00FFFF', 'FF00FF', '0000FF', 'FF0000', '000080', '008080', '008000', '800080', '800000', '808000', '808080', 'C0C0C0', '000000'];
    for (const palette of [text, highlight]) expect(new Set(palette.map(colorName)).size).toBe(palette.length);
  });

  it('says a space or the end of a paragraph by its name, and not a whole page of text', () => {
    expect(spokenChar(' ')).toBe('espacio');
    expect(spokenChar(undefined)).toBe('fin de párrafo');
    expect(spokenText('   ')).toBe('en blanco');
    expect(spokenText('a'.repeat(400))).toContain('400');
  });
});
