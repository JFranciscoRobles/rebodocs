'use client';

// The smallest headless editor (Smallest.tsx, shown under it as it is), and
// beside it what `useDocs().state` holds as it changes: the same object
// until something in it does.

import { exportDocx } from '@rebodocs/core';
import { getLocale, setLocale, useDocs } from '@rebodocs/react';
import { useEffect, useRef, useState } from 'react';
import { CAPTION } from '../styles';
import { lease } from '../accessibility/sample';
import { Editor } from './Smallest';

const SHOWN = ['bold', 'italic', 'list', 'align', 'styleId', 'fontSize', 'collapsed', 'inTable', 'canUndo', 'page', 'pageCount', 'zoom', 'dirty'] as const;

/** What `state` holds, the fields that changed last marked, and how many times it was a new object. */
function StateView() {
  const { state, ready } = useDocs();
  const before = useRef(state);
  const [seen, setSeen] = useState({ times: 0, changed: [] as string[] });
  useEffect(() => {
    if (before.current === state) return;
    const changed = SHOWN.filter((key) => before.current[key] !== state[key]);
    setSeen((was) => ({ times: was.times + 1, changed }));
    before.current = state;
  }, [state]);
  return (
    <div className="w-full flex-none overflow-auto border-t border-border bg-surface p-4 sm:w-[260px] sm:border-l sm:border-t-0">
      <p className={CAPTION}>useDocs().state</p>
      <div tabIndex={0} role="group" aria-label="The state" className="mt-2.5 rounded-xl bg-[#2f2e2b] px-4 py-3 font-code text-[12.5px] leading-[1.7] text-[#edece8]">
        <div className="text-[#a8a49a]">ready: {String(ready)}</div>
        {SHOWN.map((key) => (
          <div key={key} className={seen.changed.includes(key) ? 'text-[#f5c443]' : ''}>
            <span className="text-[#9cc0fa]">{key}</span>: {JSON.stringify(state[key]) ?? 'undefined'}
          </div>
        ))}
      </div>
      <p className="m-0 mt-3 text-[13px] leading-normal text-ink-soft">A new object {seen.times} times. Moving the caret in the same paragraph, with nothing else changing, makes none.</p>
    </div>
  );
}

export default function StateDemo() {
  const [file, setFile] = useState<Uint8Array>();
  useEffect(() => {
    const was = getLocale();
    setLocale('en');
    void lease().then((doc) => setFile(exportDocx(doc)));
    return () => setLocale(was);
  }, []);
  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      {file ? (
        // The provider puts nothing of its own on the page: the editor's column and the view of the state are side by side here.
        <div className="flex h-[820px] flex-col sm:h-[560px] sm:flex-row">
          <Editor file={file}>
            <StateView />
          </Editor>
        </div>
      ) : (
        <p className="m-0 grid h-[560px] place-items-center text-sm text-muted">Opening the editor…</p>
      )}
    </div>
  );
}
