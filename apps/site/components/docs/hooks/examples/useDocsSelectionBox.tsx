'use client';

import { useDocs, useDocsSelectionBox } from '@rebodocs/react';

function FloatingBar() {
  const box = useDocsSelectionBox();
  const { state, commands } = useDocs();
  if (!box || state.collapsed) return null;
  return (
    <div
      className="fixed z-10 flex gap-1 rounded-lg bg-neutral-900 p-1 shadow-lg"
      style={{ top: box.top - 44, left: box.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className="rounded px-2 py-0.5 text-sm font-bold text-white hover:bg-white/15" onClick={() => commands.toggleMark('bold')}>B</button>
      <button className="rounded px-2 py-0.5 text-sm text-white hover:bg-white/15" onClick={() => commands.copy()}>Copy</button>
    </div>
  );
}

// ---- On this page ----

export default function Example() {
  return (
    <>
      <FloatingBar />
      <p className="m-0 text-sm text-neutral-600">Select some words in the page below.</p>
    </>
  );
}
