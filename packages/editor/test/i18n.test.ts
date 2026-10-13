import { afterEach, describe, expect, it } from 'vitest';
import { addLocale, getLocale, locales, messages, onLocaleChange, setLocale, styleName, t } from '../src/i18n';

afterEach(() => setLocale('es'));

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
    expect(locales()).toEqual([{ code: 'es', name: 'Español' }, { code: 'en', name: 'English' }]);
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
});
