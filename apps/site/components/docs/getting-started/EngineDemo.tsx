'use client';

// The script of "Use the engine in Node", run here: the engine is the same
// in the browser. It reads the agreement of the demo, fills what is typed,
// and says what it wrote and what it left.

import { type Doc, docText, documentLanguage, exportDocx, fillVariables, importDocx, variableNames } from '@rebodocs/core';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { Readout } from '../ui';

const FIELDS = [
  ['client', 'Ana Pérez'],
  ['date', '2026-10-21'],
  ['amount', '1234.5'],
] as const;

export default function EngineDemo() {
  const [template, setTemplate] = useState<Doc>();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS));
  const [locale, setLocale] = useState<string>();
  const t = useT();

  useEffect(() => {
    void fetch('/sample.docx')
      .then((response) => response.arrayBuffer())
      .then((bytes) => setTemplate(importDocx(new Uint8Array(bytes))));
  }, []);

  const filled = useMemo(() => {
    if (!template) return undefined;
    const given = Object.fromEntries(Object.entries(values).filter(([, value]) => value.trim()));
    const doc = fillVariables(template, given, locale ? { locale } : {});
    const left = variableNames(doc);
    return { doc, left, lines: docText(doc).split('\n').filter(Boolean).slice(0, 4) };
  }, [template, values, locale]);

  const download = () => {
    if (!filled) return;
    const url = URL.createObjectURL(new Blob([exportDocx(filled.doc)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'out.docx' });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const pill = (active: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1 font-code text-[12.5px] font-semibold ${active ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`;
  const code = `fillVariables(doc, { ${Object.entries(values)
    .filter(([, value]) => value.trim())
    .map(([name, value]) => `${name}: '${value}'`)
    .join(', ')} }${locale ? `, { locale: '${locale}' }` : ''})`;

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <div className="grid gap-x-6 gap-y-4 bg-surface px-6 py-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))' }}>
        {FIELDS.map(([name]) => (
          <label key={name} className="grid gap-1.5">
            <span className={`${CAPTION} normal-case! font-code! tracking-normal!`}>{name}</span>
            <input
              value={values[name]}
              onChange={(e) => setValues((was) => ({ ...was, [name]: e.target.value }))}
              className="rounded-lg border border-border-strong bg-white px-2.5 py-1.5 text-[15px] text-ink"
            />
          </label>
        ))}
        <div className="grid gap-1.5">
          <p className={`${CAPTION} normal-case! font-code! tracking-normal!`} id="gs-locale">
            locale
          </p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="gs-locale">
            <button type="button" aria-pressed={!locale} className={pill(!locale)} onClick={() => setLocale(undefined)}>
              {t({ en: 'left out', es: 'sin pasarlo', zh: '不传入' })}
            </button>
            <button type="button" aria-pressed={locale === 'es-MX'} className={pill(locale === 'es-MX')} onClick={() => setLocale('es-MX')}>
              es-MX
            </button>
          </div>
        </div>
      </div>
      <div className="grid gap-5 border-t border-border px-6 py-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))' }}>
        <div className="min-w-0">
          <p className={CAPTION}>{t({ en: 'What it wrote', es: 'Lo que escribió', zh: '写出的内容' })}</p>
          <div className="mt-2.5 rounded-xl border border-border bg-white px-4 py-3 text-[14px] leading-[1.6] text-ink-soft">
            {filled
              ? filled.lines.map((line, i) => (
                  <p key={i} className={`m-0 ${i ? 'mt-1.5' : 'font-semibold text-ink'}`}>
                    {line}
                  </p>
                ))
              : t({ en: 'Reading the template…', es: 'Leyendo la plantilla…', zh: '正在读取模板…' })}
          </div>
          <pre
            tabIndex={0}
            aria-label={t({ en: 'The call', es: 'La llamada', zh: '调用' })}
            className="m-0 mt-3 overflow-x-auto rounded-xl bg-[#2f2e2b] px-4 py-3 font-code text-[12.5px] leading-[1.65] text-[#edece8]"
          >
            {code}
          </pre>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Readout
            label={t({ en: 'What the engine says', es: 'Lo que dice el motor', zh: '引擎的输出' })}
            lines={[
              ['documentLanguage(doc)', template ? `'${documentLanguage(template) ?? '—'}'` : '—'],
              [t({ en: 'variables in the template', es: 'variables en la plantilla', zh: '模板中的变量' }), template ? String(variableNames(template).length) : '—'],
              [
                t({ en: 'left as they are', es: 'sin llenar', zh: '保持原样的' }),
                filled ? filled.left.join(', ') || t({ en: 'none', es: 'ninguna', zh: '无' }) : '—',
                filled?.left.length ? 'warn' : 'good',
              ],
            ]}
          />
          <button
            type="button"
            disabled={!filled}
            onClick={download}
            className="cursor-pointer self-start rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] font-semibold text-ink-soft hover:bg-hover disabled:opacity-50"
          >
            {t({ en: 'Download out.docx', es: 'Descargar out.docx', zh: '下载 out.docx' })}
          </button>
        </div>
      </div>
    </div>
  );
}
