'use client';

import { useState } from 'react';
import { roving } from '../keys';
import { CAPTION, CODE } from '../ui';
import { STAGES, STEPS } from './data';

/** One letter, typed, followed from the key to the screens of everyone on the document. */
export function KeystrokeSteps({ code }: { code: string[] }) {
  const [at, setAt] = useState(0);
  const step = STEPS[at];
  const reached = STAGES.findIndex(([stage]) => stage === step.stage);

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <ol aria-label="The path of a keystroke" className="m-0 flex list-none flex-wrap items-center gap-y-2 bg-surface px-7 py-5" role="list">
        {STAGES.map(([stage, label], i) => (
          <li key={stage} className="flex items-center">
            <span
              className={`rounded-lg border-[1.5px] px-3 py-1.5 text-[13px] font-semibold transition-colors duration-300 ${
                i === reached ? 'border-brand bg-pastel-blue text-brand' : i < reached ? 'border-[#bfd3f7] bg-white text-brand' : 'border-border bg-white text-muted'
              }`}
            >
              {label}
            </span>
            {i < STAGES.length - 1 && (
              <span aria-hidden="true" className={`mx-1.5 transition-colors duration-300 ${i < reached ? 'text-brand' : 'text-[#c9c6be]'}`}>
                →
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap border-t border-[#f0eee9]">
        <div role="radiogroup" aria-label="Steps" className="flex min-w-0 flex-[1_1_260px] flex-col gap-1 px-5 py-5" onKeyDown={(event) => roving(event, setAt)}>
          {STEPS.map((s, i) => {
            const on = i === at;
            return (
              <button
                key={s.title}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setAt(i)}
                className={`flex cursor-pointer items-start gap-3 rounded-[10px] border-0 px-3 py-2.5 text-left transition-colors ${on ? 'bg-pastel-blue' : 'bg-transparent hover:bg-hover'}`}
              >
                <span className={`flex size-6 flex-none items-center justify-center rounded-full text-xs font-bold ${on ? 'bg-brand text-white' : i < at ? 'bg-[#bfd3f7] text-brand' : 'bg-hover text-muted'}`}>{i + 1}</span>
                <span className={`pt-0.5 text-[15px] ${on ? 'font-semibold text-brand' : 'text-ink'}`}>{s.title}</span>
              </button>
            );
          })}
        </div>

        <div key={at} className="flex min-w-0 flex-[1.5_1_380px] animate-enter flex-col gap-4 border-[#f0eee9] px-7 py-6 lg:border-l">
          <p className={CAPTION}>Step {at + 1} of {STEPS.length}</p>
          <p className="m-0 font-display text-xl font-bold tracking-[-0.01em]">{step.title}</p>
          <p className="m-0 text-base leading-[1.6] text-ink-soft">{step.text}</p>
          <div className={CODE} dangerouslySetInnerHTML={{ __html: code[at] }} />
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={at === 0}
              onClick={() => setAt(at - 1)}
              className="h-9 cursor-pointer rounded-lg border border-border-strong bg-white px-3 text-sm text-ink hover:bg-hover disabled:cursor-default disabled:opacity-40"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={at === STEPS.length - 1}
              onClick={() => setAt(at + 1)}
              className="h-9 cursor-pointer rounded-lg border-0 bg-brand px-3.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-default disabled:opacity-40"
            >
              Next step →
            </button>
            <a href={`#${step.more[1]}`} className="ml-auto text-sm font-semibold text-brand hover:text-brand-hover">
              More in “{step.more[0]}” ↓
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
