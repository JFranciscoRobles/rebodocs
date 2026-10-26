// What a page tells search engines and social networks, in its language: its
// title and description, its own address as the one to index, and the same
// page in the other languages (hreflang), English the one for anyone else.

import type { Metadata } from 'next';
import { DEFAULT_LOCALE, LANGUAGES, LOCALES, type Locale, localize } from './i18n';
import { SITE } from './site';

/** The same page in every language, by hreflang, and English for the rest of the world: what `alternates.languages` and the sitemap say. */
export function languageAlternates(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of LOCALES) out[LANGUAGES[locale].tag] = `${SITE}${localize(path, locale)}`;
  out['x-default'] = `${SITE}${localize(path, DEFAULT_LOCALE)}`;
  return out;
}

/**
 * The metadata of a page: `path` is its address in English (`/docs/react/`).
 * The title goes through the template of the layout; `absoluteTitle` for one
 * that does not, as the landing page's.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  absoluteTitle,
  extra,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  absoluteTitle?: boolean;
  extra?: Metadata['alternates'];
}): Metadata {
  const url = localize(path, locale);
  // The picture shown when the page is shared: the name and what it is, in the page's language (public/og*.png).
  const image = locale === DEFAULT_LOCALE ? '/og.png' : `/og-${locale}.png`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path), ...extra },
    openGraph: {
      type: 'website',
      siteName: 'Rebodocs',
      url,
      title,
      description,
      locale: LANGUAGES[locale].og,
      alternateLocale: LOCALES.filter((one) => one !== locale).map((one) => LANGUAGES[one].og),
      images: [{ url: image, width: 1200, height: 630, alt: 'Rebodocs' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
