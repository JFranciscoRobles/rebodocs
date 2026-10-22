'use client';

import dynamic from 'next/dynamic';

/** It reads font files and makes a PDF, which is done in the browser. */
export const LazyRenderDemo = dynamic(() => import('./RenderDemo'), {
  ssr: false,
  loading: () => <p className="m-0 mt-7 grid h-[640px] place-items-center rounded-[18px] border border-border text-sm text-muted">Reading the fonts…</p>,
});
