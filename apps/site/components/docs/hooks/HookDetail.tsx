'use client';

import dynamic from 'next/dynamic';
import { Loading } from '@/components/docs/Loading';
import { useState } from 'react';
import { LocalLink, useT } from '@/components/i18n';
import { useUntilFound } from '../keys';
import { CATEGORY_NAMES, type HookCategory, type HookDoc, type LiveValue, hookHash } from './hooks';
import { LiveValues } from './LiveValues';

export const CATEGORY: Record<HookCategory, string> = {
  Document: 'bg-pastel-blue text-pastel-blue-fg',
  Writing: 'bg-pastel-purple text-pastel-purple-fg',
  Page: 'bg-pastel-yellow text-pastel-yellow-fg',
  Interface: 'bg-pastel-pink text-pastel-pink-fg',
};

const label = 'm-0 text-xs font-semibold uppercase tracking-[0.04em] text-muted';
const code = '[&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-[10px] [&_pre]:bg-surface! [&_pre]:px-5 [&_pre]:py-4 [&_pre]:font-code [&_pre]:text-[13.5px] [&_pre]:leading-[1.7]';

/** The real document, loaded with the first hook opened. */
const Stage = dynamic(() => import('./Stage'), { ssr: false, loading: () => <Loading className="m-0 grid h-[420px] place-items-center text-sm text-muted" /> });

/** The id of a hook's panel, for the tab that opens it. */
export const panelId = (name: string) => `hook-panel-${name}`;

/**
 * One hook: what it is, a real document to try it on, what it gives right now, and the code.
 * Every hook's panel is on the page; the ones not chosen are `hidden="until-found"`,
 * so that the browser's find and search engines still see their text, and
 * finding something in one opens it. Only the chosen one has the real document.
 */
export function HookDetail({ hook, html, on, onFound }: { hook: HookDoc; html: { code: string; example: string }; on: boolean; onFound: () => void }) {
  const [values, setValues] = useState<LiveValue[]>([]);
  const box = useUntilFound(on, onFound);
  const t = useT();

  return (
    <div ref={box} hidden={!on}>
      <div role="tabpanel" id={panelId(hook.name)} aria-labelledby={hookHash(hook.name)} className={`mt-6 overflow-hidden rounded-[18px] border border-border ${on ? 'animate-enter' : ''}`}>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-[#f0eee9] px-7 py-5.5">
          <h3 className="m-0 font-code text-xl font-medium">{hook.sig ?? `${hook.name}()`}</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CATEGORY[hook.category]}`}>{t(CATEGORY_NAMES[hook.category])}</span>
          <LocalLink href="/demo/" className="ml-auto text-sm font-semibold text-brand hover:text-brand-hover">
            {t({ en: 'Open the full demo →', es: 'Abrir la demo completa →', zh: '打开完整演示 →' })}
          </LocalLink>
          <p className="m-0 mt-1 max-w-[720px] basis-full text-base leading-[1.6] text-ink-soft">{t(hook.description)}</p>
        </div>

        {/* The demo and what it gives, side by side: what is compared. */}
        <div className="flex flex-wrap">
          <div className="min-w-0 flex-[1.6_1_420px] bg-surface px-7 py-6">
            <p className={`${label} flex items-center gap-2`}>
              <span className="size-2 animate-pulse-dot rounded-full bg-brand" aria-hidden="true" />
              {t({ en: 'Try it', es: 'Pruébalo', zh: '试一试' })}
            </p>
            <div className="mt-3 min-h-[260px] rounded-[14px] border border-border bg-white p-4">{on && <Stage name={hook.name} onValues={setValues} />}</div>
          </div>
          <div className="min-w-0 flex-[1_1_300px] px-7 py-6">
            <p className={label}>{t({ en: 'What the hook returns — live', es: 'Lo que devuelve el hook, en vivo', zh: 'Hook 的实时返回值' })}</p>
            <LiveValues values={on ? values : []} />
          </div>
        </div>

        {/* What to look up, below what to try. */}
        <div className="flex flex-wrap gap-x-10 gap-y-6 border-t border-[#f0eee9] px-7 py-6">
          <div className="min-w-0 flex-[1_1_340px]">
            <p className={label}>{t({ en: 'All it gives you', es: 'Todo lo que te da', zh: '全部返回内容' })}</p>
            <dl className="m-0 mt-2">
              {hook.returns.map((r) => (
                <div key={r.key} className="flex gap-4 border-t border-[#f0eee9] py-2.5 text-[15px]">
                  <dt className="min-w-[140px] max-w-[45%] flex-none font-code text-[13px] leading-[1.6] text-brand [overflow-wrap:anywhere]">{r.key}</dt>
                  <dd className="m-0 leading-normal text-ink-soft">{t(r.description)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5">
            <p className={label}>{t({ en: 'Taking it apart', es: 'Desarmándolo', zh: '解构' })}</p>
            <div className={code} dangerouslySetInnerHTML={{ __html: html.code }} />
            {hook.note && (
              <p className="m-0 flex gap-2.5 rounded-[10px] bg-pastel-blue px-4 py-3 text-[15px] leading-normal text-[#1b3f80]">
                <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 flex-none">
                  <circle cx="10" cy="10" r="8" fill="none" stroke="#0B57D0" strokeWidth="1.6" />
                  <path d="M10 9v5M10 6v.5" stroke="#0B57D0" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span>{t(hook.note)}</span>
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-[#f0eee9] px-7 py-6">
          <p className={label}>{t({ en: 'Use it', es: 'Úsalo', zh: '使用' })}</p>
          <p className="m-0 mt-1.5 text-[15px] text-muted">
            {t({
              en: 'The piece running above, as its file has it: it goes anywhere inside a DocsProvider.',
              es: 'La pieza que corre arriba, tal como está en su archivo: va en cualquier lugar dentro de un DocsProvider.',
              zh: '上方运行的部件，与其文件中的代码一致：可以放在 DocsProvider 内的任何位置。',
            })}
          </p>
          <div className={`mt-3 ${code}`} dangerouslySetInnerHTML={{ __html: html.example }} />
        </div>
      </div>
    </div>
  );
}
