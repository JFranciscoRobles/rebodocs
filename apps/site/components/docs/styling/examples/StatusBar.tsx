'use client';

import { useDocs, useDocsCount } from '@rebodocs/react';

/** A status bar in the colours of a brand: where the caret is, how long the document is, and the zoom. */
export function StatusBar() {
  const { state, commands } = useDocs();
  const { words, selected } = useDocsCount();
  const zoom = Math.round(state.zoom * 100);
  return (
    <div className="flex items-center gap-4 bg-violet-700 px-4 py-1.5 text-[13px] text-violet-50">
      <span>
        Page {state.page} of {state.pageCount}
      </span>
      <span className="opacity-80">{selected ? `${selected.words} of ${words} words` : `${words} words`}</span>
      <span className="ml-auto flex items-center gap-1">
        <button type="button" aria-label="Zoom out" className="size-6 rounded hover:bg-white/15" onClick={() => commands.setZoom(state.zoom - 0.1)}>
          −
        </button>
        <span className="w-12 text-center tabular-nums">{zoom} %</span>
        <button type="button" aria-label="Zoom in" className="size-6 rounded hover:bg-white/15" onClick={() => commands.setZoom(state.zoom + 0.1)}>
          +
        </button>
      </span>
    </div>
  );
}
