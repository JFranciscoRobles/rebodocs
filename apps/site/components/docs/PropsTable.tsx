'use client';

import { useEffect, useState } from 'react';
import { PROPS, PROP_GROUPS, type PropGroup, type PropKind } from './reference';

const KIND: Record<PropKind, string> = {
  data: 'bg-pastel-blue text-pastel-blue-fg',
  fn: 'bg-pastel-purple text-pastel-purple-fg',
  obj: 'bg-pastel-yellow text-pastel-yellow-fg',
  bool: 'bg-pastel-green text-pastel-green-fg',
};
const COLUMNS = 'grid grid-cols-[1fr_1.1fr_2fr]';

/** Every prop of DocsProvider, by group. `target` is the one ⌘K went to: it is shown and lit up. */
export function PropsTable({ target }: { target?: { name: string; at: number } }) {
  const [group, setGroup] = useState<'All' | PropGroup>('All');
  const shown = PROPS.filter((prop) => group === 'All' || prop.group === group);

  useEffect(() => {
    if (!target) return;
    setGroup('All');
    requestAnimationFrame(() => document.getElementById(`prop-${target.name}`)?.scrollIntoView({ block: 'center' }));
  }, [target]);

  return (
    <>
      <div className="mt-7 flex flex-wrap items-center gap-2" role="group" aria-label="Show props">
        <span className="mr-1 text-sm text-muted">Show</span>
        {(['All', ...PROP_GROUPS] as const).map((name) => {
          const on = name === group;
          const count = name === 'All' ? PROPS.length : PROPS.filter((prop) => prop.group === name).length;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => setGroup(name)}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink-soft hover:bg-hover'}`}
            >
              {name} <span className={on ? 'opacity-80' : 'text-muted'}>{count}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 overflow-x-auto rounded-[14px] border border-border">
        <div role="table" aria-label="DocsProvider props" className="min-w-[640px]">
          <div role="row" className={`${COLUMNS} bg-surface text-xs font-semibold tracking-[0.04em] text-muted`}>
            <div role="columnheader" className="px-5 py-3">
              PROP
            </div>
            <div role="columnheader" className="px-5 py-3">
              TYPE
            </div>
            <div role="columnheader" className="px-5 py-3">
              WHAT IT DOES
            </div>
          </div>
          {shown.map((prop) => (
            <div
              key={`${prop.name}-${prop.name === target?.name ? target.at : 0}`}
              id={`prop-${prop.name}`}
              role="row"
              className={`${COLUMNS} animate-enter scroll-mt-28 border-t border-border text-[15px] transition-colors hover:bg-[#fcfcfb] ${prop.name === target?.name ? 'bg-pastel-yellow/60' : ''}`}
            >
              <div role="cell" className="px-5 py-4">
                <code className="font-code font-medium text-ink">{prop.name}</code>
              </div>
              <div role="cell" className="px-5 py-4">
                <code className={`rounded-[5px] px-1.75 py-0.5 font-code text-[12.5px] ${KIND[prop.kind]}`}>{prop.type}</code>
              </div>
              <div role="cell" className="px-5 py-4 leading-normal text-ink-soft">
                {prop.does}
                {prop.warn && (
                  <span className="ml-1.5 inline-flex items-center gap-1.25 rounded-full bg-pastel-orange px-2 py-0.5 text-xs font-semibold text-pastel-orange-fg">
                    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M6 1.5L11 10.5H1z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                      <path d="M6 5v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    {prop.warn}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <details className="mt-5 rounded-xl border border-border px-5 py-4 text-base">
        <summary className="cursor-pointer font-semibold">Why did my document reset?</summary>
        <p className="mt-2.5 leading-[1.6] text-ink-soft">
          The document is made again — and what was typed and not saved is gone — when <code className="font-code text-[13px]">docx</code> changes, when the room of{' '}
          <code className="font-code text-[13px]">collab</code> does (its <code className="font-code text-[13px]">url</code>, <code className="font-code text-[13px]">room</code> or{' '}
          <code className="font-code text-[13px]">ticket</code>), or when there is an <code className="font-code text-[13px]">onSave</code> where there was none, or the other way round. Keep{' '}
          <code className="font-code text-[13px]">docx</code> the same value between renders: a <code className="font-code text-[13px]">Uint8Array</code> held in state, not one built in the body of
          the component. The functions you pass may be new at each render; the last one given is the one called.
        </p>
      </details>
    </>
  );
}
