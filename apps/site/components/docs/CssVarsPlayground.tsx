'use client';

import type { CSSProperties } from 'react';
import { RULER_VARS, SURFACE_VARS, THEMES } from './reference';

const smooth = 'transition-[background-color,box-shadow,color] duration-350';

/**
 * The variables that colour the surface or the ruler, and three themes to try:
 * the preview is drawn with the very variables listed, set on it in `style`.
 * The theme is the tabs', so that the surface and the ruler share it.
 */
export function CssVarsPlayground({ ruler, theme, setTheme }: { ruler: boolean; theme: number; setTheme: (theme: number) => void }) {
  const vars = THEMES[theme].vars;
  const listed = ruler ? RULER_VARS : SURFACE_VARS;

  return (
    <div className="mt-7 flex flex-wrap items-stretch gap-6">
      <div className="min-w-0 flex-[1_1_300px]">
        <p className="m-0 text-xs font-semibold tracking-[0.04em] text-muted">STYLE IT WITH CSS VARIABLES</p>
        <ul className="m-0 mt-2.5 list-none overflow-hidden rounded-xl border border-border p-0">
          {listed.map(([name, what], i) => (
            <li key={name} className={`flex items-center gap-3 px-4 py-3 text-sm ${i ? 'border-t border-[#f0eee9]' : ''}`}>
              <span
                aria-hidden="true"
                className={`size-5.5 flex-none rounded-md border border-border-strong ${smooth}`}
                style={name === '--dx-page-shadow' ? { background: '#fff', boxShadow: vars[name] } : { background: vars[name] }}
              />
              <span className="min-w-0 flex-1">
                <code className="block font-code text-ink">{name}</code>
                <span className="block text-[13px] text-muted">{what}</span>
              </span>
              <code className="max-w-[45%] text-right font-code text-xs text-muted [overflow-wrap:anywhere]">{vars[name]}</code>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Try a theme">
          <span className="mr-1 text-sm text-muted">Try a theme</span>
          {THEMES.map((t, i) => (
            <button
              key={t.label}
              type="button"
              aria-pressed={i === theme}
              onClick={() => setTheme(i)}
              className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium text-ink transition-colors ${i === theme ? 'border-ink bg-hover' : 'border-border-strong bg-white hover:bg-hover'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div aria-hidden="true" className={`flex min-w-0 flex-[1_1_300px] flex-col gap-2.5 rounded-[14px] bg-(--dx-canvas) p-7 ${smooth}`} style={vars as CSSProperties}>
        {ruler && (
          <div className={`relative h-6 rounded-[4px] border-b border-(--dx-ruler-line) bg-(--dx-ruler) ${smooth}`}>
            <span className={`absolute inset-y-1 left-[6%] right-[6%] bg-(--dx-ruler-margin) ${smooth}`} />
            <span className={`absolute inset-y-1 left-[18%] right-[18%] bg-(--dx-ruler-text) ${smooth}`} />
            <span className="absolute inset-x-[6%] bottom-1 h-1.5 [background-image:repeating-linear-gradient(90deg,var(--dx-ruler-ink)_0_1px,transparent_1px_12px)]" />
            <span className="absolute -bottom-px left-[18%] size-0 -translate-x-1/2 border-x-[5px] border-b-[7px] border-x-transparent border-b-(--dx-ruler-on)" />
          </div>
        )}
        <div className={`min-h-[200px] flex-1 rounded-[3px] bg-white px-6 py-5.5 text-[13px] leading-[1.7] text-[#37352f] shadow-(--dx-page-shadow) ${smooth}`}>
          <div className="text-base font-bold">Receipt</div>
          <div className="mt-1.5">
            Payment is due within <span className={`bg-(--dx-selection) ${smooth}`}>15 days of this receipt</span>
            <span className="ml-px inline-block h-[1.1em] w-0.5 animate-blink bg-(--dx-caret) align-[-0.2em]" />
          </div>
          <div className="mt-1.5 text-muted">The selection and the caret take the colours of your theme.</div>
        </div>
      </div>
    </div>
  );
}
