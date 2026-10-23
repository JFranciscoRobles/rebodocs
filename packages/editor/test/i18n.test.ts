import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLURALS, addLocale, getLocale, locales, messages, onLocaleChange, plural, setLocale, styleName, t, withRegion } from '../src/i18n';

// The tests are written in Spanish first, as the interface was.
beforeEach(() => setLocale('es'));

describe('languages of the interface', () => {
  it('gives each text in the language set, with its values put in', () => {
    expect(getLocale()).toBe('es');
    expect(t('menu.save')).toBe('Guardar');
    expect(t('status.page', { page: 2, pages: 9 })).toBe('Página 2 de 9');
    setLocale('en');
    expect(t('menu.save')).toBe('Save');
    expect(t('status.page', { page: 2, pages: 9 })).toBe('Page 2 of 9');
    // The braces of a variable stay around its name.
    expect(t('bubble.toVariable', { name: 'client' })).toBe('Turns the selection into the variable {{client}}');
    expect(locales()).toEqual([
      { code: 'es', name: 'Español' },
      { code: 'en', name: 'English' },
    ]);
  });

  it("starts in the first of the browser's languages it speaks, or in English", async () => {
    const startsIn = async (languages: string[]) => {
      vi.resetModules();
      vi.stubGlobal('navigator', { languages, language: languages[0] });
      const fresh = await import('../src/i18n');
      vi.unstubAllGlobals();
      return fresh.getLocale();
    };
    expect(await startsIn(['ja-JP', 'es-MX', 'en-US'])).toBe('es');
    expect(await startsIn(['en-GB'])).toBe('en');
    expect(await startsIn(['ja-JP', 'de-DE'])).toBe('en');
    expect(await startsIn([])).toBe('en');
  });

  it('takes the tag of a browser, and falls back to English for a language it does not speak', () => {
    setLocale('en-US');
    expect(getLocale()).toBe('en');
    setLocale('es_MX');
    expect(getLocale()).toBe('es');
    setLocale('ja');
    expect(getLocale()).toBe('en');
  });

  it('tells whoever listens that the language changed, and only then', () => {
    let calls = 0;
    const stop = onLocaleChange(() => calls++);
    setLocale('es');
    expect(calls).toBe(0);
    setLocale('en');
    setLocale('en');
    expect(calls).toBe(1);
    stop();
    setLocale('es');
    expect(calls).toBe(1);
  });

  it('takes another language, saying in English what it leaves out', () => {
    addLocale('fr', { 'locale.name': 'Français', 'menu.save': 'Enregistrer' });
    setLocale('fr-CA');
    expect(getLocale()).toBe('fr');
    expect(t('menu.save')).toBe('Enregistrer');
    expect(t('menu.print')).toBe('Print…');
    expect(locales().map((l) => l.name)).toContain('Français');
  });

  it('names a language by what it calls itself when it does not say', () => {
    addLocale('pt', { 'menu.save': 'Guardar' });
    expect(locales().find((l) => l.code === 'pt')?.name).toBe('Português');
  });

  it('gives every text of a language, to start a translation from', () => {
    const english = messages();
    expect(english['menu.save']).toBe('Save');
    expect(Object.keys(messages('es'))).toEqual(Object.keys(english));
    expect(messages('es')['menu.save']).toBe('Guardar');
    // A copy: changing it changes nothing here.
    english['menu.save'] = 'x';
    expect(messages()['menu.save']).toBe('Save');
  });

  it('tells whoever listens when the language being shown is given other words', () => {
    addLocale('it', { 'menu.save': 'Salva' });
    setLocale('it');
    let calls = 0;
    const stop = onLocaleChange(() => calls++);
    addLocale('it', { 'menu.print': 'Stampa…' });
    addLocale('fr', { 'menu.print': 'Imprimer…' });
    stop();
    expect(calls).toBe(1);
    expect(t('menu.save')).toBe('Salva');
    expect(t('menu.print')).toBe('Stampa…');
  });

  it('names the standard styles in the language, and leaves the ones of a document alone', () => {
    setLocale('en');
    expect(styleName({ name: 'Título 1', wordName: 'heading 1' })).toBe('Heading 1');
    expect(styleName({ name: 'Cláusula', wordName: 'Clausula' })).toBe('Cláusula');
    expect(styleName({ name: 'Mi estilo' })).toBe('Mi estilo');
  });

  it('says a number of things in the plural category of the number, in each language', () => {
    expect(plural('status.words', 1)).toBe('palabra');
    expect(plural('status.words', 2)).toBe('palabras');
    expect(plural('compare.count', 1, { n: 1 })).toBe('1 cambio');
    setLocale('en');
    expect(plural('compare.count', 3, { n: 3 })).toBe('3 changes');
    // The size of a table: each number in its own plural, in one sentence.
    const size = (columns: number, rows: number) => t('table.cells', { columns: plural('table.columns', columns, { n: columns }), rows: plural('table.rows', rows, { n: rows }) });
    expect(size(1, 1)).toBe('1 column by 1 row');
    expect(size(3, 2)).toBe('3 columns by 2 rows');
    // In Russian 1 and 21 are "one", 2 to 4 "few", 5 to 20 "many": a form for each, the key for what it leaves out.
    addLocale('ru', { 'status.words': 'слов', 'status.words.one': 'слово', 'status.words.few': 'слова' });
    setLocale('ru');
    expect([1, 2, 5, 21, 22].map((n) => plural('status.words', n))).toEqual(['слово', 'слова', 'слов', 'слово', 'слова']);
    // French says 0 in the singular; without forms, its "one" is the text of one.
    addLocale('fr', { 'status.word': 'mot', 'status.words': 'mots' });
    setLocale('fr');
    expect([0, 1, 2].map((n) => plural('status.words', n))).toEqual(['mot', 'mot', 'mots']);
  });

  it('knows every text said of a number, and the text of one of each', () => {
    const keys = Object.keys(messages());
    for (const [many, one] of Object.entries(PLURALS)) {
      expect(keys).toContain(many);
      if (one) expect(keys).toContain(one);
    }
  });
});

describe('withRegion', () => {
  it('gives a language its region, as Word knows languages', () => {
    expect(withRegion('es-mx')).toBe('es-MX');
    expect(withRegion('pt_BR')).toBe('pt-BR');
    // Alone, the browser's region if it speaks the language, else the one where it is most spoken.
    expect(withRegion('es')).toMatch(/^es-[A-Z]{2}$/);
    expect(withRegion('en')).toMatch(/^en-[A-Z]{2}$/);
  });
});
