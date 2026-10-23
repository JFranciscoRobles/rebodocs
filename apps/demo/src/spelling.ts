import { createSpellChecker } from '@rebodocs/react';

/**
 * The dictionaries of the demo, Hunspell's from wooorm/dictionaries, read from
 * a CDN: an application would serve them itself. The Spanish one is under
 * GPL, LGPL or MPL, the English one under MIT and BSD.
 */
const dictionary = (language: string) => ({
  aff: `https://cdn.jsdelivr.net/npm/dictionary-${language}@4.0.0/index.aff`,
  dic: `https://cdn.jsdelivr.net/npm/dictionary-${language}@4.0.0/index.dic`,
});

/** One for the whole page: each dictionary is loaded once, whichever editor asks first. */
export const spellcheck = typeof Worker === 'undefined' ? undefined : createSpellChecker({ dictionaries: { en: dictionary('en'), es: dictionary('es') } });
