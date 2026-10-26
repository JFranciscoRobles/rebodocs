'use client';

// Every text of the interface, by key, in the two languages it comes with and
// in the Simplified Chinese of its module: what a translation has to say, and
// what can be changed with addLocale.

import { useDeferredValue, useState } from 'react';
import { useT } from '@/components/i18n';
import { CAPTION } from '../styles';

export type TextRow = [key: string, es: string, en: string, zh: string];

/** A text with each {name} marked: what a translation leaves as it is. */
function Marked({ text }: { text: string }) {
  return text.split(/(\{\w+\})/).map((piece, i) =>
    i % 2 ? (
      <code key={i} className="rounded bg-pastel-purple px-1 font-code text-[12.5px] text-pastel-purple-fg">
        {piece}
      </code>
    ) : (
      piece
    ),
  );
}

export function Texts({ rows }: { rows: TextRow[] }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const groups = [...new Set(rows.map(([key]) => key.split('.')[0]))].sort();
  const shown = rows.filter(([key, es, en, zh]) => (!group || key.split('.')[0] === group) && (!deferred || `${key}\n${es}\n${en}\n${zh}`.toLowerCase().includes(deferred)));

  return (
    <div className="mt-7 overflow-hidden rounded-2xl border border-border">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-5 py-3.5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t({ en: 'Find a key or a text: save, page, tabla…', es: 'Busca una clave o un texto: save, página, table…', zh: '查找键或文本：save、页面、tabla…' })}
          aria-label={t({ en: 'Find a text', es: 'Buscar un texto', zh: '查找文本' })}
          className="min-w-0 flex-[1_1_260px] rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-ink"
        />
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          aria-label={t({ en: 'Part of the interface', es: 'Parte de la interfaz', zh: '界面部分' })}
          className="rounded-lg border border-border bg-white px-2.5 py-1.5 font-code text-[13px] text-ink"
        >
          <option value="">{t({ en: 'every part', es: 'todas las partes', zh: '所有部分' })}</option>
          {groups.map((name) => (
            <option key={name} value={name}>
              {name}.
            </option>
          ))}
        </select>
        <span aria-live="polite" className="text-[13px] text-muted">
          {shown.length === rows.length
            ? t({ en: `${rows.length} texts`, es: `${rows.length} textos`, zh: `${rows.length} 段文本` })
            : t({ en: `${shown.length} of ${rows.length}`, es: `${shown.length} de ${rows.length}`, zh: `${shown.length} / ${rows.length}` })}
        </span>
      </div>
      {/* It scrolls: the keyboard reaches it. */}
      <div tabIndex={0} role="region" aria-label={t({ en: 'Every text of the interface', es: 'Todos los textos de la interfaz', zh: '界面的全部文本' })} className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead className="sticky top-0 bg-white shadow-[0_1px_0_var(--color-border)]">
            <tr>
              <th className={`${CAPTION} w-[22%] px-5 py-2.5`}>{t({ en: 'Key', es: 'Clave', zh: '键' })}</th>
              <th className={`${CAPTION} px-5 py-2.5`}>Español</th>
              <th className={`${CAPTION} px-5 py-2.5`}>English</th>
              <th className={`${CAPTION} px-5 py-2.5`}>简体中文</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(([key, es, en, zh]) => (
              <tr key={key} className="border-t border-[#f0eee9] align-top first:border-t-0">
                <td className="break-all px-5 py-2 font-code text-[13px] text-ink">{key}</td>
                <td lang="es" className="px-5 py-2 text-[14px] leading-normal text-ink-soft">
                  <Marked text={es} />
                </td>
                <td lang="en" className="px-5 py-2 text-[14px] leading-normal text-ink-soft">
                  <Marked text={en} />
                </td>
                <td lang="zh-Hans" className="px-5 py-2 text-[14px] leading-normal text-ink-soft">
                  <Marked text={zh} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="m-0 px-5 py-6 text-sm text-muted">{t({ en: 'No text has that.', es: 'Ningún texto tiene eso.', zh: '没有包含该内容的文本。' })}</p>}
      </div>
    </div>
  );
}
