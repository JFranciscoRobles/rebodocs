'use client';

// The editor in the three languages of the page: the two it comes with, and a
// French started the way any translation starts, partly done. A word of any of
// them can be changed, and the bars are built again with it.

import { type DocsHandle, type MessageKey, type Messages, DocsEditor, addLocale, getLocale, locales, messages, onLocaleChange, setLocale, t } from '@rebodocs/react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { DEMO_LOCALES, FRENCH, WORDS } from './data';

type Changed = Record<string, Partial<Messages>>;

const TOTAL = Object.keys(messages()).length;
const TRANSLATED = Object.keys(FRENCH).filter((key) => key !== 'locale.name').length;

/** `locales` as it would be written in an application, for the line under the demo. */
function written(locale: string, changed: Changed): string {
  const texts = (all: Partial<Messages>) => Object.entries(all).map(([key, text]) => `'${key}': '${String(text).replace(/'/g, "\\'")}'`).join(', ');
  const parts = Object.entries(changed).filter(([code]) => code !== 'fr').map(([code, all]) => `${code}: { ${texts(all)} }`);
  parts.unshift(changed.fr ? `fr: { ...fr, ${texts(changed.fr)} }` : 'fr');
  return `<DocsEditor locale="${locale}" locales={{ ${parts.join(', ')} }} />`;
}

export default function Switcher() {
  const [file, setFile] = useState<Uint8Array>();
  const [failed, setFailed] = useState(false);
  const handle = useRef<DocsHandle | undefined>(undefined);
  const locale = useSyncExternalStore(onLocaleChange, getLocale, () => 'en');
  const [changed, setChanged] = useState<Changed>({});
  const [key, setKey] = useState<MessageKey>(WORDS[0].key);
  const [text, setText] = useState('');
  // What each changed word said before, to give it back when the page is left: the languages are the whole page's.
  const before = useRef<Changed>({});

  useEffect(() => {
    let gone = false;
    fetch('/demo.docx')
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setFile(new Uint8Array(bytes)))
      .catch(() => !gone && setFailed(true));
    // The page is in English, and so is the editor until another language is chosen.
    const was = getLocale();
    setLocale('en');
    return () => {
      gone = true;
      for (const [code, texts] of Object.entries(before.current)) addLocale(code, texts);
      setLocale(was);
    };
  }, []);

  // The word in the box is the one the language has, until it is changed.
  useEffect(() => setText(t(key)), [key, locale, changed]);

  const given = useMemo(() => ({ ...changed, fr: { ...FRENCH, ...changed.fr } }), [changed]);

  const change = () => {
    if (!text || text === t(key)) return;
    const was = (before.current[locale] ??= {});
    if (!(key in was)) was[key] = (locale === 'fr' && FRENCH[key]) || messages(locale)[key];
    setChanged((all) => ({ ...all, [locale]: { ...all[locale], [key]: text } }));
  };
  const undo = () => {
    for (const [code, texts] of Object.entries(before.current)) addLocale(code, texts);
    before.current = {};
    setChanged({});
  };

  const inFrench = locale === 'fr';
  const missing = t('menu.print');
  const where = WORDS.find((word) => word.key === key)!.where;

  return (
    <DemoBox
      title="Switch it"
      aside={
        <>
          <div>
            <p className={CAPTION} id="lang-pick">
              Language
            </p>
            <div role="group" aria-labelledby="lang-pick" className="mt-2.5 flex flex-wrap gap-2">
              {DEMO_LOCALES.map(({ code, name, note }) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={locale === code}
                  disabled={!file}
                  onClick={() => handle.current?.setLocale(code)}
                  title={note}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold disabled:cursor-default disabled:opacity-50 ${
                    locale === code ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="lang-word" className={CAPTION}>
              Change a word of {locales().find((l) => l.code === locale)?.name ?? locale}
            </label>
            <select
              id="lang-word"
              value={key}
              onChange={(e) => setKey(e.target.value as MessageKey)}
              className="mt-2.5 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 font-code text-[13px] text-ink"
            >
              {WORDS.map((word) => (
                <option key={word.key} value={word.key}>
                  {word.key}
                </option>
              ))}
            </select>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                change();
              }}
            >
              <input
                aria-label={`Text for ${key}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm text-ink"
              />
              <button type="submit" disabled={!file} className="cursor-pointer rounded-lg border-0 bg-ink px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                Change
              </button>
            </form>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">
              Shown in {where}.{key === 'status.page' && ' Keep {page} and {pages}.'}{' '}
              {Object.keys(changed).length > 0 && (
                <button type="button" onClick={undo} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-brand hover:text-brand-hover">
                  Put the words back
                </button>
              )}
            </p>
          </div>
          <Readout
            label="What the functions say"
            lines={[
              ['getLocale()', `'${locale}'`],
              ['locales()', locales().map((l) => l.name).join(', ')],
              ["t('status.page', …)", t('status.page', { page: 1, pages: 2 }), 'good'],
              ["t('menu.print')", missing, inFrench ? 'warn' : 'good'],
              inFrench ? ['translated', `${TRANSLATED} of ${TOTAL}, the rest in English`, 'warn'] : ['translated', `${TOTAL} of ${TOTAL}`, 'good'],
            ]}
          />
          <p className="m-0 break-all font-code text-[12.5px] leading-[1.6] text-ink-soft">{written(locale, changed)}</p>
        </>
      }
    >
      <div className="-m-5 h-[520px] overflow-hidden rounded-[14px]">
        {file ? (
          <DocsEditor
            docx={file}
            name="receipt.docx"
            locale={locale}
            locales={given}
            features={{ files: true, language: true }}
            onReady={(ready) => (handle.current = ready)}
          />
        ) : (
          <p className="grid h-full place-items-center text-sm text-muted">{failed ? 'The sample document could not be loaded.' : 'Opening the document…'}</p>
        )}
      </div>
    </DemoBox>
  );
}
