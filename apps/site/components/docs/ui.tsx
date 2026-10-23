'use client';

import type { ReactNode } from 'react';
import type { Pastel } from '@/lib/home';
import { PASTEL_CLASS } from '@/lib/home';
import { useUntilFound } from './keys';
import { CAPTION } from './styles';

// What the pages of the documentation written in React share: how a section
// starts, the yellow warning, the hand-written tip, and code coloured on the server.

export { CAPTION, CODE, LINK } from './styles';

/** A pill, a heading and a line under it: how each section of the page starts. */
export function SectionHead({ id, badge, color, title, children }: { id: string; badge: string; color: Pastel; title: string; children?: ReactNode }) {
  return (
    <>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PASTEL_CLASS[color]}`}>{badge}</span>
      <h2 id={id} className="m-0 mt-3.5 scroll-mt-24 font-display text-[30px] font-extrabold tracking-[-0.03em]">
        {title}
      </h2>
      {children && <p className="m-0 mt-2.5 max-w-[720px] text-[17px] leading-[1.6] text-muted">{children}</p>}
    </>
  );
}

/** Something that goes wrong if it is not known. */
export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <p className="m-0 mt-6 flex items-start gap-3 rounded-xl bg-pastel-yellow px-5 py-4 text-[15px] leading-[1.55] text-[#5c4a1e]">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 flex-none">
        <circle cx="10" cy="10" r="8" fill="none" stroke="#8A5A00" strokeWidth="1.6" />
        <path d="M10 6v5M10 13.5v.5" stroke="#8A5A00" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span>
        <strong className="text-[#3e2f00]">{title}</strong> {children}
      </span>
    </p>
  );
}

export function HandTip({ children }: { children: ReactNode }) {
  return <span className="ml-2 font-hand text-[22px] leading-none text-pastel-pink-fg">{children}</span>;
}

/** One panel of a set of tabs. The ones not chosen stay on the page, `hidden="until-found"`: see `useUntilFound`. */
export function TabPanel({ id, labelledBy, on, onFound, children }: { id: string; labelledBy: string; on: boolean; onFound: () => void; children: ReactNode }) {
  const box = useUntilFound(on, onFound);
  return (
    <div ref={box} hidden={!on}>
      <div role="tabpanel" id={id} aria-labelledby={labelledBy} className={on ? 'animate-enter' : ''}>
        {children}
      </div>
    </div>
  );
}

/** A demo to try, with a line on what it shows; `aside` goes beside it, `children` is the demo itself. */
export function DemoBox({ children, aside, title = 'Try it' }: { children: ReactNode; aside?: ReactNode; title?: string }) {
  return (
    <div className="mt-7 flex flex-wrap overflow-hidden rounded-[18px] border border-border">
      <div className="min-w-0 flex-[1.6_1_440px] bg-surface px-7 py-6">
        <p className={`${CAPTION} flex items-center gap-2`}>
          <span className="size-2 animate-pulse-dot rounded-full bg-brand" aria-hidden="true" />
          {title}
        </p>
        <div className="mt-3 rounded-[14px] border border-border bg-white p-5">{children}</div>
      </div>
      {aside && <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 px-7 py-6">{aside}</div>}
    </div>
  );
}

/** What the engine says while a demo runs: the dark panel of the hooks, with plain lines. */
/** `live: false` for values that change at every key, which a screen reader would read out each time. */
export function Readout({ label, lines, live = true }: { label: string; lines: [key: string, value: string, tone?: 'good' | 'warn' | 'dim'][]; live?: boolean }) {
  const TONE = { good: 'text-[#9ee0b0]', warn: 'text-[#f5c443]', dim: 'text-[#a8a49a]' };
  return (
    <div>
      <p className={CAPTION}>{label}</p>
      {/* It scrolls when a line is long: the keyboard reaches it. */}
      <div
        tabIndex={0}
        role="group"
        aria-label={label}
        aria-live={live ? 'polite' : undefined}
        className="mt-2.5 overflow-x-auto rounded-xl bg-[#2f2e2b] px-4 py-3.5 font-code text-[13px] leading-[1.75] text-[#edece8]"
      >
        {lines.map(([key, value, tone]) => (
          <div key={key} className="flex gap-2.5 whitespace-nowrap">
            <span className="text-[#9cc0fa]">{key}</span>
            <span className="text-[#a8a49a]" aria-hidden="true">
              →
            </span>
            <span className={tone ? TONE[tone] : 'text-[#f5c443]'}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
