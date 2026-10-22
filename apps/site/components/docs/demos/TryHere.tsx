'use client';

// The React demo of the repository, as this site builds it at /demo: in a
// frame, once asked for, so the page does not load a second editor for nothing.

import { useState } from 'react';

export function TryHere() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      {open ? (
        <iframe src="/demo/" title="The React demo, apps/demo" className="block h-[680px] w-full border-0 bg-white" />
      ) : (
        <div className="grid h-[280px] place-items-center bg-surface px-6 text-center">
          <div>
            <p className="m-0 text-[15px] leading-normal text-ink-soft">apps/demo, as this site builds it: the included editor and your own interface, on the same agreement.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => setOpen(true)} className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover">
                Open it here
              </button>
              <a href="/demo/" className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-ink-soft no-underline hover:bg-hover">
                Full window
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
