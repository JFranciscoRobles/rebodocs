'use client';

import { useState } from 'react';
import { roving, useHash } from '../keys';
import { HookDetail, panelId } from './HookDetail';
import { HOOKS, HOOK_CATEGORIES, type HookCategory, hookHash } from './hooks';

const pill = (on: boolean) =>
  `cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink-soft hover:bg-hover'}`;

/**
 * The thirteen hooks: filtered by kind, one chosen, and that one open with
 * its demo. `#hooks-useDocsFind` in the address opens that one.
 */
export function HooksExplorer({ html }: { html: Record<string, { code: string; example: string }> }) {
  const [category, setCategory] = useState<'All' | HookCategory>('All');
  const [selected, setSelected] = useState('useDocs');

  useHash((hash) => {
    const hook = HOOKS.find((h) => hookHash(h.name) === hash);
    if (!hook) return;
    setCategory('All');
    setSelected(hook.name);
    document.getElementById(hash)?.scrollIntoView({ block: 'center' });
  });

  // A filter that hides the one chosen leaves the panel as it is.
  const shown = HOOKS.filter((hook) => category === 'All' || hook.category === category);
  const focusable = shown.some((hook) => hook.name === selected) ? selected : shown[0]?.name;

  return (
    <>
      <div className="mt-7 flex flex-wrap gap-2" aria-label="Kinds of hook" role="group">
        {(['All', ...HOOK_CATEGORIES] as const).map((name) => (
          <button key={name} type="button" aria-pressed={name === category} onClick={() => setCategory(name)} className={pill(name === category)}>
            {name}
          </button>
        ))}
      </div>
      <div role="tablist" aria-label="Hooks" className="mt-4 flex snap-x gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible" onKeyDown={(event) => roving(event, (i) => setSelected(shown[i].name))}>
        {shown.map((h) => {
          const on = h.name === selected;
          return (
            <button
              key={h.name}
              id={hookHash(h.name)}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={panelId(h.name)}
              tabIndex={h.name === focusable ? 0 : -1}
              onClick={() => setSelected(h.name)}
              className={`lift flex-none cursor-pointer snap-start scroll-mt-24 rounded-[10px] border-[1.5px] px-3.5 py-2.5 text-left ${on ? 'border-brand bg-[#f5f9ff]' : 'border-border bg-white'}`}
            >
              <span className={`block font-code text-sm font-medium ${on ? 'text-brand' : 'text-ink'}`}>{h.name}</span>
              <span className="mt-0.5 block text-[13px] text-muted">{h.short}</span>
            </button>
          );
        })}
      </div>
      {HOOKS.map((hook) => (
        <HookDetail
          key={hook.name}
          hook={hook}
          html={html[hook.name]}
          on={hook.name === selected}
          onFound={() => {
            setCategory('All');
            setSelected(hook.name);
          }}
        />
      ))}
    </>
  );
}
