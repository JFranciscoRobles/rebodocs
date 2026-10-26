'use client';

// The language of the page, for the components that run in the browser: the
// layout gives it, and they ask for it with `useT()` and `useLocale()`.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ComponentProps, type ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_LOCALE, LANGUAGES, LOCALES, type Locale, delocalize, localize, translator } from '@/lib/i18n';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

/** The texts of the page: `t({ en, es, zh })` gives the one in its language. */
export const useT = () => translator(useLocale());

/** A link to a page of the site, in the language of the page it is on. */
export function LocalLink({ href, ...props }: ComponentProps<typeof Link> & { href: string }) {
  return <Link href={localize(href, useLocale())} {...props} />;
}

/** The languages of the site, each a link to the page being read in it. */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const { path } = delocalize(usePathname() ?? '/');
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const t = translator(locale);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', away);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', away);
    };
  }, [open]);

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t({ en: 'Language', es: 'Idioma', zh: '语言' })}
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.75 text-sm font-medium text-ink transition-colors hover:bg-hover"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.6 9h16.8M3.6 15h16.8M12 3c-2.5 2.6-3.5 5.6-3.5 9s1 6.4 3.5 9M12 3c2.5 2.6 3.5 5.6 3.5 9s-1 6.4-3.5 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
        {LANGUAGES[locale].short}
      </button>
      {open && (
        <ul className="absolute right-0 z-50 m-0 mt-1 min-w-[150px] list-none rounded-xl border border-border bg-white p-1 shadow-menu">
          {LOCALES.map((one) => (
            <li key={one}>
              <a
                href={localize(path, one)}
                hrefLang={LANGUAGES[one].tag}
                lang={LANGUAGES[one].tag}
                aria-current={one === locale ? 'true' : undefined}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${one === locale ? 'bg-pastel-blue font-semibold text-brand' : 'text-ink hover:bg-hover'}`}
              >
                {LANGUAGES[one].name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
