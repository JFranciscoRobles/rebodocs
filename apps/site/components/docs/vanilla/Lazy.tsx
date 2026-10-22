'use client';

import dynamic from 'next/dynamic';

/** The editor comes when the page is in the browser. */
export const LazyAssembleDemo = dynamic(() => import('./AssembleDemo'), {
  ssr: false,
  loading: () => <p className="m-0 mt-7 grid h-[900px] place-items-center rounded-[18px] border border-border text-sm text-muted">Opening the editor…</p>,
});
