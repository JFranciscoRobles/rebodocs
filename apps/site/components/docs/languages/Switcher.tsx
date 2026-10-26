'use client';

// The editor in the languages of the page: the two it comes with, the
// Simplified Chinese of its module, and a French started the way any
// translation starts, partly done. A word of any of
// them can be changed, and the bars are built again with it.

import { type DocsHandle, type MessageKey, type Messages, DocsEditor, addLocale, getLocale, locales, messages, onLocaleChange, setLocale, t } from '@rebodocs/react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useEditorLocale } from '@/components/editorLocale';
import { useLocale, useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import { SAMPLE } from '@/lib/sample';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { DEMO_LOCALES, FRENCH, WORDS } from './data';

type Changed = Record<string, Partial<Messages>>;

const TOTAL = Object.keys(messages()).length;
const TRANSLATED = Object.keys(FRENCH).filter((key) => key !== 'locale.name').length;

/** `locales` as it would be written in an application, for the line under the demo. */
function written(locale: string, changed: Changed): string {
  const texts = (all: Partial<Messages>) =>
    Object.entries(all)
      .map(([key, text]) => `'${key}': '${String(text).replace(/'/g, "\\'")}'`)
      .join(', ');
  const parts = Object.entries(changed)
    .filter(([code]) => code !== 'fr')
    .map(([code, all]) => `${code}: { ${texts(all)} }`);
  parts.unshift(changed.fr ? `fr: { ...fr, ${texts(changed.fr)} }` : 'fr');
  return `<DocsEditor locale="${locale}" locales={{ ${parts.join(', ')} }} />`;
}

export default function Switcher() {
  const tr = useT();
  const sample = SAMPLE[useLocale()];
  const start = useEditorLocale();
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
    fetch(sample.file)
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setFile(new Uint8Array(bytes)))
      .catch(() => !gone && setFailed(true));
    // The editor is in the language of the page until another is chosen.
    const was = getLocale();
    setLocale(start);
    return () => {
      gone = true;
      for (const [code, texts] of Object.entries(before.current)) addLocale(code, texts);
      setLocale(was);
    };
  }, [sample.file, start]);

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
      title={tr({ en: 'Switch it', es: 'Cámbialo', zh: '切换语言' })}
      aside={
        <>
          <div>
            <p className={CAPTION} id="lang-pick">
              {tr({ en: 'Language', es: 'Idioma', zh: '语言' })}
            </p>
            <div role="group" aria-labelledby="lang-pick" className="mt-2.5 flex flex-wrap gap-2">
              {DEMO_LOCALES.map(({ code, name, note }) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={locale === code}
                  disabled={!file}
                  onClick={() => handle.current?.setLocale(code)}
                  title={tr(note)}
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
              {tr({ en: 'Change a word of', es: 'Cambia una palabra de', zh: '修改这种语言的用词：' })} {locales().find((l) => l.code === locale)?.name ?? locale}
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
                aria-label={tr({ en: `Text for ${key}`, es: `Texto de ${key}`, zh: `${key} 的文本` })}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm text-ink"
              />
              <button type="submit" disabled={!file} className="cursor-pointer rounded-lg border-0 bg-ink px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                {tr({ en: 'Change', es: 'Cambiar', zh: '修改' })}
              </button>
            </form>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">
              {tr({ en: `Shown in ${tr(where)}.`, es: `Se muestra en ${tr(where)}.`, zh: `显示在${tr(where)}中。` })}
              {key === 'status.page' && tr({ en: ' Keep {page} and {pages}.', es: ' Conserva {page} y {pages}.', zh: '请保留 {page} 和 {pages}。' })}{' '}
              {Object.keys(changed).length > 0 && (
                <button type="button" onClick={undo} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-medium text-brand hover:text-brand-hover">
                  {tr({ en: 'Put the words back', es: 'Devolver las palabras', zh: '恢复原来的用词' })}
                </button>
              )}
            </p>
          </div>
          <Readout
            label={tr({ en: 'What the functions say', es: 'Lo que dicen las funciones', zh: '函数的返回值' })}
            lines={[
              ['getLocale()', `'${locale}'`],
              [
                'locales()',
                locales()
                  .map((l) => l.name)
                  .join(', '),
              ],
              ["t('status.page', …)", t('status.page', { page: 1, pages: 2 }), 'good'],
              ["t('menu.print')", missing, inFrench ? 'warn' : 'good'],
              inFrench
                ? [
                    tr({ en: 'translated', es: 'traducidos', zh: '已翻译' }),
                    tr({ en: `${TRANSLATED} of ${TOTAL}, the rest in English`, es: `${TRANSLATED} de ${TOTAL}, el resto en inglés`, zh: `${TOTAL} 中的 ${TRANSLATED}，其余为英语` }),
                    'warn',
                  ]
                : [tr({ en: 'translated', es: 'traducidos', zh: '已翻译' }), tr({ en: `${TOTAL} of ${TOTAL}`, es: `${TOTAL} de ${TOTAL}`, zh: `${TOTAL} / ${TOTAL}` }), 'good'],
            ]}
          />
          <p className="m-0 break-all font-code text-[12.5px] leading-[1.6] text-ink-soft">{written(locale, changed)}</p>
        </>
      }
    >
      <div className="-m-5 h-[520px] overflow-hidden rounded-[14px]">
        {file ? (
          <DocsEditor docx={file} name={sample.name} locale={locale} locales={given} features={{ files: true, language: true }} onReady={(ready) => (handle.current = ready)} />
        ) : (
          <p className="grid h-full place-items-center text-sm text-muted">
            {failed
              ? tr({ en: 'The sample document could not be loaded.', es: 'No se pudo cargar el documento de ejemplo.', zh: '无法加载示例文档。' })
              : tr({ en: 'Opening the document…', es: 'Abriendo el documento…', zh: '正在打开文档…' })}
          </p>
        )}
      </div>
    </DemoBox>
  );
}
