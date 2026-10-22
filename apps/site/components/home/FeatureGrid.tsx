'use client';

import { useState } from 'react';
import { FEATURES, PASTEL_CLASS, pastelAt } from '@/lib/home';

/** The features as cards that open: the first one starts open, and several may be open at once. */
export function FeatureGrid() {
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));
  const toggle = (i: number) =>
    setOpen((was) => {
      const now = new Set(was);
      if (!now.delete(i)) now.add(i);
      return now;
    });

  return (
    <div className="reveal grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]">
      {FEATURES.map(([title, text, icon], i) => {
        const on = open.has(i);
        return (
          <div key={title} className="group self-start overflow-hidden rounded-2xl border border-border bg-white transition duration-250 hover:-translate-y-1 hover:shadow-lift">
            <button
              type="button"
              aria-expanded={on}
              onClick={() => toggle(i)}
              className="flex w-full cursor-pointer items-center gap-3.5 rounded-2xl p-4.5 text-left transition-colors hover:bg-surface"
            >
              <span className={`inline-flex size-11 flex-none items-center justify-center rounded-xl ${PASTEL_CLASS[pastelAt(i)]}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="group-hover:animate-wiggle">
                  <path d={icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="flex-1 font-display text-[17px] font-bold tracking-[-0.01em]">{title}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className={`transition-transform duration-250 ${on ? 'rotate-90' : ''}`}>
                <path d="M5 3l4 4-4 4" fill="none" stroke="var(--color-faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {on && (
              <p className="animate-pop-in pb-4.5 pl-19 pr-4.5 text-[15px] leading-[1.55] text-muted opacity-0">
                {text}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
