'use client';

import { useDocs, useDocsStyles } from '@rebodocs/react';

/** A dark toolbar in pills: the style of the paragraph, the marks, the alignment, undo. */
export function Toolbar() {
  const { state, commands } = useDocs();
  const { styles, active, set } = useDocsStyles();
  const pill = (on: boolean) => `h-8 min-w-8 rounded-full px-2.5 text-sm font-semibold ${on ? 'bg-amber-300 text-neutral-900' : 'text-neutral-200 hover:bg-white/10'}`;
  return (
    <div role="toolbar" aria-label="Format" className="flex flex-wrap items-center gap-1 bg-neutral-900 px-3 py-2">
      <select value={active ?? ''} onChange={(e) => set(e.target.value)} aria-label="Style" className="h-8 rounded-full bg-white/10 px-3 text-sm text-neutral-100 [color-scheme:dark]">
        {styles.map((style) => (
          <option key={style.id} value={style.id}>
            {style.name}
          </option>
        ))}
      </select>
      <span className="mx-1 h-5 w-px bg-white/20" />
      <button type="button" aria-pressed={state.bold} className={`${pill(state.bold)} font-bold`} onClick={() => commands.toggleMark('bold')}>B</button>
      <button type="button" aria-pressed={state.italic} className={`${pill(state.italic)} italic`} onClick={() => commands.toggleMark('italic')}>I</button>
      <button type="button" aria-pressed={state.underline} className={`${pill(state.underline)} underline`} onClick={() => commands.toggleMark('underline')}>U</button>
      <span className="mx-1 h-5 w-px bg-white/20" />
      {(['left', 'center', 'right', 'justify'] as const).map((align) => (
        <button key={align} type="button" aria-pressed={state.align === align} className={pill(state.align === align)} onClick={() => commands.setParagraphProps({ align })}>
          {align[0].toUpperCase() + align.slice(1)}
        </button>
      ))}
      <button type="button" disabled={!state.canUndo} className={`${pill(false)} ml-auto disabled:opacity-30`} onClick={() => commands.undo()}>
        Undo
      </button>
    </div>
  );
}
