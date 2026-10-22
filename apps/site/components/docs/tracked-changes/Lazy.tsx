'use client';

import dynamic from 'next/dynamic';

/** The editor comes when the page is in the browser. */
export const LazyReviewDemo = dynamic(() => import('./ReviewDemo'), {
  ssr: false,
  loading: () => <p className="m-0 mt-7 grid h-[560px] place-items-center rounded-[18px] border border-border text-sm text-muted">Opening the editor…</p>,
});
