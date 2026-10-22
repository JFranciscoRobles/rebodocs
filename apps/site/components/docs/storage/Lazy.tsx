'use client';

import dynamic from 'next/dynamic';

/** The editor comes when the page is in the browser. */
export const LazyRequestsDemo = dynamic(() => import('./RequestsDemo'), {
  ssr: false,
  loading: () => <p className="m-0 mt-7 grid h-[580px] place-items-center rounded-[18px] border border-border text-sm text-muted">Opening the editor…</p>,
});

export const LazyEnvDemo = dynamic(() => import('./EnvDemo'), {
  ssr: false,
  loading: () => <p className="m-0 mt-7 grid h-[420px] place-items-center rounded-[18px] border border-border text-sm text-muted">…</p>,
});
