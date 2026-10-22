'use client';

// The measurements against Word, each document with how many of its lines
// fall where Word puts them; all of them, or only those that do not match.

import { useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { AGAINST_WORD } from './data';

export function WordTable() {
  const [only, setOnly] = useState(false);
  const rows = AGAINST_WORD.filter((row) => !only || row.lines[0] < row.lines[1] || row.pages[0] < row.pages[1]);
  const pill = (active: boolean) => `cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold ${active ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`;
  return (
    <div className="mt-6 max-w-[920px] overflow-hidden rounded-2xl border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-5 py-3" role="group" aria-label="Which documents">
        <button type="button" aria-pressed={!only} className={pill(!only)} onClick={() => setOnly(false)}>
          All {AGAINST_WORD.length}
        </button>
        <button type="button" aria-pressed={only} className={pill(only)} onClick={() => setOnly(true)}>
          Where it differs
        </button>
      </div>
      <ul className="m-0 list-none p-0">
        {rows.map((row) => {
          const share = row.lines[0] / row.lines[1];
          const whole = share === 1;
          return (
            <li key={row.name} className="grid items-center gap-x-5 gap-y-1.5 border-t border-[#f0eee9] px-5 py-3 first:border-t-0 md:grid-cols-[1fr_220px_120px]">
              <div className="min-w-0">
                <span className="block font-code text-[13px] font-semibold text-ink [overflow-wrap:anywhere]">{row.name}.docx</span>
                <span className="block text-[13.5px] text-muted">{row.what}</span>
              </div>
              <div>
                <div className="h-2 overflow-hidden rounded-full bg-[#efede8]" aria-hidden="true">
                  <div className={`h-full rounded-full ${whole ? 'bg-[#4caf72]' : 'bg-[#e0a43a]'}`} style={{ width: `${share * 100}%` }} />
                </div>
                <span className="mt-1 block text-[13px] text-ink-soft">
                  {row.lines[0]} of {row.lines[1]} lines ({(share * 100).toFixed(1)}%)
                </span>
              </div>
              <span className="text-[13px] text-ink-soft">
                {row.pages[0]}/{row.pages[1]} pages · ≤ {row.apart} pt
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
