'use client';

import { useState } from 'react';
import { useT } from '@/components/i18n';
import { roving } from './keys';
import { ENTRIES, type Owner, type Part } from './reference';

/** Whole class names, so Tailwind finds them. */
const OWNER: Record<Owner, string> = {
  rebodocs: 'border-solid border-brand bg-pastel-blue text-brand',
  yours: 'border-dashed border-[#b07a00] bg-pastel-yellow text-pastel-yellow-fg',
  hidden: 'border-solid border-border-strong bg-hover text-faint opacity-55',
};
const part = 'border-[1.5px] rounded-lg transition-[background-color,border-color,color,opacity] duration-350';

/** "Which one do I need?": four answers, and a drawing of the editor that shows what each one gives and what is left to you. */
export function EntryPicker({ code }: { code: string[] }) {
  const [chosen, setChosen] = useState(0);
  const entry = ENTRIES[chosen];
  const t = useT();

  // A plain call, not a component: the same element stays, so its colours can change with a transition.
  const zone = (name: Part, title: string, className = '') => {
    const [owner, by] = entry.parts[name];
    return (
      <div key={name} className={`${part} ${OWNER[owner]} flex justify-between gap-2 px-3 ${className}`}>
        <span className="font-semibold">{title}</span>
        <span className="font-code">{owner === 'rebodocs' ? by : owner === 'yours' ? 'hooks' : '—'}</span>
      </div>
    );
  };
  const [pagesOwner, pagesBy] = entry.parts.pages;
  const [panelOwner] = entry.parts.panel;

  return (
    <div className="mt-7 flex flex-wrap items-stretch gap-6">
      <div
        role="radiogroup"
        aria-label={t({ en: 'What do you want?', es: '¿Qué quieres?', zh: '你想要什么？' })}
        className="flex min-w-0 flex-[1_1_280px] flex-col gap-3"
        onKeyDown={(event) => roving(event, setChosen)}
      >
        {ENTRIES.map((e, i) => {
          const on = i === chosen;
          return (
            <button
              key={e.want.en}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setChosen(i)}
              className={`lift flex cursor-pointer items-start gap-3 rounded-[14px] border-[1.5px] px-4.5 py-4 text-left text-ink ${on ? 'border-brand bg-[#f5f9ff]' : 'border-border bg-white'}`}
            >
              <span className={`mt-0.5 flex size-5 flex-none items-center justify-center rounded-full border-2 ${on ? 'border-brand' : 'border-[#c9c6be]'}`}>
                <span className={`size-2.5 rounded-full ${on ? 'bg-brand' : ''}`} />
              </span>
              <span>
                <span className="block text-base font-semibold">{t(e.want)}</span>
                <span className={`mt-1.5 block font-code text-sm ${on ? 'text-brand' : 'text-muted'}`}>{e.use}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-[1.6_1_440px] flex-col gap-4 rounded-[18px] border border-border bg-surface p-5">
        <div
          role="img"
          aria-label={`${t({ en: 'The editor', es: 'El editor', zh: '编辑器' })}: ${(Object.keys(entry.parts) as Part[])
            .map(
              (name) =>
                `${name} ${
                  entry.parts[name][0] === 'rebodocs'
                    ? t({ en: 'from Rebodocs', es: 'de Rebodocs', zh: '由 Rebodocs 提供' })
                    : entry.parts[name][0] === 'yours'
                      ? t({ en: 'yours', es: 'tuyo', zh: '由你实现' })
                      : t({ en: 'not shown', es: 'no se muestra', zh: '不显示' })
                }`,
            )
            .join(', ')}`}
          className="flex flex-col gap-2 rounded-xl border border-border bg-white p-2.5 text-xs"
        >
          {zone('toolbar', t({ en: 'Toolbar & menu', es: 'Barra y menú', zh: '工具栏与菜单' }), 'py-2.25')}
          {zone(
            'ruler',
            t({ en: 'Ruler', es: 'Regla', zh: '标尺' }),
            'bg-[length:100%_5px] bg-bottom bg-no-repeat py-1.5 [background-image:repeating-linear-gradient(90deg,rgba(47,46,43,.18)_0_1px,transparent_1px_14px)]',
          )}
          <div className="flex min-h-[190px] gap-2">
            <div className={`${part} ${OWNER[pagesOwner]} flex flex-1 flex-col items-center gap-2 p-3.5`}>
              <div className="flex w-full justify-between">
                <span className="font-semibold">{t({ en: 'Pages', es: 'Páginas', zh: '页面' })}</span>
                <span className="font-code">{pagesBy}</span>
              </div>
              <div className="flex w-[62%] flex-1 flex-col gap-1.5 rounded-[3px] bg-white p-3 shadow-[0_2px_8px_rgba(47,46,43,0.12)]">
                <span className="h-1.75 w-[55%] rounded-[3px] bg-border-strong" />
                <span className="h-1.25 w-[92%] rounded-[3px] bg-border" />
                <span className="h-1.25 w-[84%] rounded-[3px] bg-border" />
                <span className="h-1.25 w-[70%] rounded-[3px] bg-border" />
              </div>
            </div>
            <div className={`${part} ${OWNER[panelOwner]} flex w-[30%] flex-col gap-1 p-2.5`}>
              <span className="font-semibold">{t({ en: 'Side panel', es: 'Panel lateral', zh: '侧边栏' })}</span>
              <span className="font-code">{panelOwner === 'rebodocs' ? entry.parts.panel[1] : panelOwner === 'yours' ? 'hooks' : '—'}</span>
            </div>
          </div>
          {zone('status', t({ en: 'Status bar', es: 'Barra de estado', zh: '状态栏' }), 'py-1.75')}
        </div>
        <div className="flex flex-wrap gap-4 text-[13px] text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[3px] border-[1.5px] border-brand bg-pastel-blue" />
            {t({ en: 'From Rebodocs', es: 'De Rebodocs', zh: '由 Rebodocs 提供' })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[3px] border-[1.5px] border-dashed border-[#b07a00] bg-pastel-yellow" />
            {t({ en: 'Yours, built with hooks', es: 'Tuyo, hecho con hooks', zh: '由你用 hooks 实现' })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[3px] border-[1.5px] border-border-strong bg-hover" />
            {t({ en: 'Not shown', es: 'No se muestra', zh: '不显示' })}
          </span>
        </div>
        <div
          key={chosen}
          className="animate-enter [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:bg-white! [&_pre]:px-4.5 [&_pre]:py-4 [&_pre]:font-code [&_pre]:text-[13.5px] [&_pre]:leading-[1.7]"
          dangerouslySetInnerHTML={{ __html: code[chosen] }}
        />
      </div>
    </div>
  );
}
