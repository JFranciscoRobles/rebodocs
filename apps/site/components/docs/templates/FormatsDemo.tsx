'use client';

// One variable and its value, written as its formats ask, one after another,
// in the language picked: formatValue, the same call fillVariables makes for
// each variable it fills.

import { createDoc, findVariables, formatValue } from '@rebodocs/core';
import { useState } from 'react';
import { useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';

const PRESETS: [variable: string, value: string][] = [
  ['{{amount | currency}}', '2500'],
  ['{{date | long date | upper}}', '2026-10-13'],
  ['{{date | date: dddd d MMMM}}', 'today'],
  ['{{client | capital | bold}}', 'ana pérez'],
  ['{{price | currency: EUR}}', '1234.5'],
  ['{{total | number: 2}}', '1234567'],
  ['{{date | long date}}', '13/10/2026'],
  ['{{金额 | 货币: CNY}}', '2500'],
  ['{{日期 | 长日期}}', '今天'],
  ['{{amount | money}}', '2500'],
];

const LOCALES = ['', 'en-US', 'en-GB', 'es-MX', 'es-ES', 'zh-CN', 'zh-TW', 'de-DE', 'fr-FR', 'ja-JP'];
const CURRENCIES = ['', 'USD', 'EUR', 'MXN', 'CNY', 'GBP', 'JPY'];

const field = 'mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 font-code text-[13px] normal-case tracking-normal text-ink';

export default function FormatsDemo() {
  const [variable, setVariable] = useState(PRESETS[0][0]);
  const [value, setValue] = useState(PRESETS[0][1]);
  const [locale, setLocale] = useState('');
  const [currency, setCurrency] = useState('');
  const t = useT();

  const [found] = findVariables(createDoc([{ props: {}, runs: [{ text: variable, props: {} }] }]));
  const options = { ...(locale ? { locale } : {}), ...(currency ? { currency } : {}) };
  const formats = found?.formats ?? [];
  const result = formatValue(value, formats, options);
  // The value after each format, to see them applied one after another.
  const steps = formats.map((format, i) => ({ format, ...formatValue(value, formats.slice(0, i + 1), options) }));
  const style = { fontWeight: result.props.bold ? 700 : undefined, fontStyle: result.props.italic ? 'italic' : undefined, textDecoration: result.props.underline ? 'underline' : undefined };

  const pick = (preset: [string, string]) => {
    setVariable(preset[0]);
    setValue(preset[1]);
  };

  return (
    <DemoBox
      title="formatValue"
      aside={
        <>
          <label className={CAPTION}>
            {t({ en: 'The variable', es: 'La variable', zh: '变量' })}
            <input value={variable} onChange={(e) => setVariable(e.target.value)} spellCheck={false} className={field} />
          </label>
          <label className={CAPTION}>
            {t({ en: 'Its value', es: 'Su valor', zh: '值' })}
            <input value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={CAPTION}>
              locale
              <select value={locale} onChange={(e) => setLocale(e.target.value)} className={field}>
                {LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {code || t({ en: 'none: en-US', es: 'ninguno: en-US', zh: '无：en-US' })}
                  </option>
                ))}
              </select>
            </label>
            <label className={CAPTION}>
              currency
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={field}>
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code || t({ en: 'none: en-US', es: 'ninguna: en-US', zh: '无：en-US' })}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Readout
            label={t({ en: 'What it gives', es: 'Lo que da', zh: '输出' })}
            live={false}
            lines={
              found
                ? [
                    ['name', `'${found.name}'`],
                    ['formats', formats.length ? formats.map((f) => `'${f}'`).join(', ') : '[]'],
                    ['text', `'${result.text}'`, 'good'],
                    ['props', Object.keys(result.props).length ? Object.keys(result.props).join(', ') : '{}', Object.keys(result.props).length ? undefined : 'dim'],
                    [
                      'problems',
                      result.problems.length ? result.problems.map((p) => `${p.kind}: ${p.format}`).join(', ') : t({ en: 'none', es: 'ninguno', zh: '无' }),
                      result.problems.length ? 'warn' : 'good',
                    ],
                  ]
                : [['findVariables', t({ en: 'not a variable', es: 'no es una variable', zh: '不是变量' }), 'warn']]
            }
          />
        </>
      }
    >
      <div role="group" aria-label={t({ en: 'Examples', es: 'Ejemplos', zh: '示例' })} className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => {
          const on = preset[0] === variable && preset[1] === value;
          return (
            <button
              key={preset.join()}
              type="button"
              aria-pressed={on}
              onClick={() => pick(preset)}
              className={`cursor-pointer rounded-full border px-2.5 py-0.5 font-code text-[12px] ${on ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`}
            >
              {preset[0]}
            </button>
          );
        })}
      </div>
      <p className="m-0 mt-8 text-center font-[Georgia,serif] text-[clamp(22px,3vw,30px)] leading-snug text-ink" style={style} aria-live="polite">
        {found ? result.text || ' ' : variable}
      </p>
      <ol className="m-0 mt-8 list-none p-0">
        <li className="flex items-baseline gap-3 border-t border-[#f0eee9] py-2 text-[14px]">
          <span className="w-[150px] shrink-0 font-code text-[12.5px] text-muted">{t({ en: 'the value', es: 'el valor', zh: '原始值' })}</span>
          <span className="font-code text-ink">{value || ' '}</span>
        </li>
        {steps.map((step, i) => {
          const bad = step.problems.length > (steps[i - 1]?.problems.length ?? 0);
          return (
            <li key={i} className="flex items-baseline gap-3 border-t border-[#f0eee9] py-2 text-[14px]">
              <span className="w-[150px] shrink-0 truncate font-code text-[12.5px] text-muted">| {step.format}</span>
              <span className={`font-code ${bad ? 'text-[#b4690e]' : 'text-ink'}`}>
                {bad
                  ? `${
                      step.problems[step.problems.length - 1].kind === 'format'
                        ? t({ en: 'no such format', es: 'no existe ese formato', zh: '没有这个格式' })
                        : t({ en: 'cannot write this value', es: 'no se puede escribir este valor', zh: '无法书写此值' })
                    }${t({ en: ': left as it was', es: ': se deja como estaba', zh: '：保持原样' })}`
                  : step.text}
              </span>
            </li>
          );
        })}
      </ol>
    </DemoBox>
  );
}
