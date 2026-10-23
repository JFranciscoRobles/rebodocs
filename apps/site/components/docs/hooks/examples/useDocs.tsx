'use client';

import { useDocs } from '@rebodocs/react';

const button = 'rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-sm aria-pressed:bg-blue-100 disabled:opacity-40';

function Bold() {
  const { state, commands } = useDocs();
  return (
    <button className={`${button} font-bold`} aria-pressed={state.bold} onClick={() => commands.toggleMark('bold')}>
      B
    </button>
  );
}

function FontSize() {
  const { state, commands } = useDocs();
  return (
    <select aria-label="Font size" className={button} value={state.fontSize} onChange={(e) => commands.setRunProps({ fontSize: Number(e.target.value) })}>
      {[10, 11, 12, 14, 18, 24, 26].map((size) => (
        <option key={size}>{size}</option>
      ))}
    </select>
  );
}

function Save() {
  const { state, docs } = useDocs();
  return (
    <>
      <button className={button} disabled={!state.dirty} onClick={() => docs?.save()}>
        Save
      </button>
      <button className={button} disabled={!docs} onClick={() => docs?.download()}>
        Word
      </button>
    </>
  );
}

// ---- On this page ----

export default function Example() {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Bold />
      <FontSize />
      <Save />
    </div>
  );
}
