'use client';

import { DocsProvider, DocsSurface, useDocs } from '@rebodocs/react';
import type { ReactNode } from 'react';

function Toolbar() {
  const { state, commands } = useDocs();
  const button = (on: boolean) => `h-8 min-w-8 rounded-md px-2 text-sm font-semibold ${on ? 'bg-blue-100 text-blue-800' : 'hover:bg-neutral-100'}`;
  return (
    <div className="flex items-center gap-1 border-b border-neutral-200 bg-white p-2">
      <button type="button" aria-pressed={state.bold} className={`${button(state.bold)} font-bold`} onClick={() => commands.toggleMark('bold')}>
        B
      </button>
      <button type="button" aria-pressed={state.italic} className={`${button(state.italic)} italic`} onClick={() => commands.toggleMark('italic')}>
        I
      </button>
      <button type="button" aria-pressed={state.list === 'bullet'} className={button(state.list === 'bullet')} onClick={() => commands.toggleList('bullet')}>
        • List
      </button>
      <button type="button" disabled={!state.canUndo} className={`${button(false)} disabled:opacity-40`} onClick={() => commands.undo()}>
        Undo
      </button>
      <span className="ml-auto text-sm text-neutral-600">
        Page {state.page} of {state.pageCount}
      </span>
    </div>
  );
}

export function Editor({ file, children }: { file: Uint8Array; children?: ReactNode }) {
  return (
    <DocsProvider docx={file} onSave={(docx) => console.log('save', docx.length, 'bytes')}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Toolbar />
        <DocsSurface className="min-h-0 flex-1 bg-neutral-100" />
      </div>
      {children}
    </DocsProvider>
  );
}
