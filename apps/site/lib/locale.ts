// The language of the page being made, for the server components inside it:
// set once by the page and its layout from the address, read by any of them
// without handing it down. It lasts the making of one page.

import { cache } from 'react';
import { DEFAULT_LOCALE, type Locale, translator } from './i18n';

const current = cache(() => ({ locale: DEFAULT_LOCALE as Locale }));

/** Says which language the page being made is in. */
export function setPageLocale(locale: Locale): void {
  current().locale = locale;
}

/** The language of the page being made. */
export const pageLocale = (): Locale => current().locale;

/** The texts of the page being made: `t({ en, es, zh })` gives the one in its language. */
export const getT = () => translator(pageLocale());
