// The languages of the site. English is at the root (/docs/react/), as it
// always was; Spanish and Chinese under their code (/es/docs/react/,
// /zh/docs/react/). Every text the site says is written once in each, side by
// side where it is used, so a page changed in one language shows what to
// change in the others: `t({ en: 'Save', es: 'Guardar', zh: '保存' })`.

export const LOCALES = ['en', 'es', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** A text, or anything else that changes with the language, in each language of the site. */
export type L<T = string> = Record<Locale, T>;

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

/** What each language is, as the page, the search engines and the social networks say it. */
export const LANGUAGES: Record<Locale, { tag: string; og: string; name: string; short: string }> = {
  en: { tag: 'en', og: 'en_US', name: 'English', short: 'EN' },
  es: { tag: 'es', og: 'es_ES', name: 'Español', short: 'ES' },
  // Mandarin, written in Simplified characters.
  zh: { tag: 'zh-Hans', og: 'zh_CN', name: '简体中文', short: '中文' },
};

/** The language the editor's own interface is in on a page of the site: Chinese is the Simplified one of `@rebodocs/editor/locales`. */
export const EDITOR_LOCALE: L = { en: 'en', es: 'es', zh: 'zh-Hans' };

/** The address of a page of the site in a language: `/docs/` is `/es/docs/` in Spanish. Addresses of other sites, anchors and files are left as they are. */
export function localize(href: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE || !href.startsWith('/') || href.startsWith('//')) return href;
  // Files the site serves as they are, in every language: the sample documents, the fonts, the Markdown for language models.
  if (/\.(docx|md|txt|xml|svg|png|jpg|ttf|woff2?)$/.test(href.split(/[?#]/)[0])) return href;
  if (isLocale(href.split('/')[1])) return href;
  return `/${locale}${href}`;
}

/** The language of an address of the site, and the address without it. */
export function delocalize(path: string): { locale: Locale; path: string } {
  const first = path.split('/')[1];
  if (isLocale(first) && first !== DEFAULT_LOCALE) return { locale: first, path: path.slice(first.length + 1) || '/' };
  return { locale: DEFAULT_LOCALE, path };
}

/** A function that takes a text in each language and gives the one of `locale`. */
export const translator =
  (locale: Locale) =>
  <T>(text: L<T>): T =>
    text[locale];

export type T = ReturnType<typeof translator>;

/** A number written as the language writes it. */
export const formatNumber = (n: number, locale: Locale) => n.toLocaleString(LANGUAGES[locale].tag);
