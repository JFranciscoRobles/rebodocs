'use client';

import { useDocs, useDocsSelectionBox } from '@rebodocs/react';

/** A small bar that floats above what is selected, where the selection is on the screen. */
export function SelectionBar() {
  const { state, commands } = useDocs();
  const box = useDocsSelectionBox();
  if (!box || state.collapsed) return null;
  const button = (on: boolean) => `size-8 rounded-md text-sm ${on ? 'bg-white text-rose-700' : 'text-white hover:bg-white/20'}`;
  return (
    <div className="fixed z-50 flex gap-0.5 rounded-lg bg-rose-600 p-1 shadow-lg" style={{ top: box.top - 44, left: box.left + box.width / 2 - 56 }}>
      <button type="button" aria-pressed={state.bold} className={`${button(state.bold)} font-bold`} onMouseDown={(e) => e.preventDefault()} onClick={() => commands.toggleMark('bold')}>
        B
      </button>
      <button type="button" aria-pressed={state.italic} className={`${button(state.italic)} italic`} onMouseDown={(e) => e.preventDefault()} onClick={() => commands.toggleMark('italic')}>
        I
      </button>
      <button type="button" aria-pressed={state.highlight !== ''} className={button(state.highlight !== '')} onMouseDown={(e) => e.preventDefault()} onClick={() => commands.setRunProps({ highlight: state.highlight ? '' : 'FFF59D' })}>
        ✎
      </button>
    </div>
  );
}
