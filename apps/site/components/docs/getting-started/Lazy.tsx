'use client';

import dynamic from 'next/dynamic';

/** The editor comes when the page is in the browser. */
export const LazyFirstDemo = dynamic(() => import('./FirstDemo'), {
  ssr: false,
  loading: () => <p className="m-0 mt-7 grid h-[700px] place-items-center rounded-[18px] border border-border text-sm text-muted">Opening the editor…</p>,
});

/** The engine reads the template in the browser. */
export const LazyEngineDemo = dynamic(() => import('./EngineDemo'), {
  ssr: false,
  loading: () => <p className="m-0 mt-7 grid h-[420px] place-items-center rounded-[18px] border border-border text-sm text-muted">Reading the template…</p>,
});
