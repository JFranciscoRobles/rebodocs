'use client';

// The editors on the pages of the site speak the language of the page: the
// Simplified Chinese of `@rebodocs/editor/locales` on /zh/, given to the
// editor once, as an application would.

import zhHans from '@rebodocs/editor/locales/zh-Hans';
import { addLocale, getLocale, setLocale } from '@rebodocs/react';
import { useEffect } from 'react';
import { EDITOR_LOCALE } from '@/lib/i18n';
import { useLocale } from './i18n';

let given = false;
/** Gives the editor the languages of the site it does not come with. */
export function giveLanguages(): void {
  if (given) return;
  // The site chooses the language by the page, not by the browser: keeping the
  // one there was stops addLocale from switching to Chinese in a Chinese browser.
  const was = getLocale();
  addLocale('zh-Hans', zhHans);
  setLocale(was);
  given = true;
}

/** The editor's language for the page being read: what to give `setLocale` and the `locale` prop. */
export function useEditorLocale(): string {
  giveLanguages();
  return EDITOR_LOCALE[useLocale()];
}

/** Sets the editor's interface in the language of the page while the component is on it, and back as it was after. */
export function usePageEditorLocale(): string {
  const locale = useEditorLocale();
  useEffect(() => {
    const was = getLocale();
    setLocale(locale);
    return () => setLocale(was);
  }, [locale]);
  return locale;
}
