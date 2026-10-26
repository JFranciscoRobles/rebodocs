'use client';

import dynamic from 'next/dynamic';
import { Loading } from '@/components/docs/Loading';

/** The editor comes when the page is in the browser. */
export const LazyFeaturesDemo = dynamic(() => import('./FeaturesDemo'), {
  ssr: false,
  loading: () => <Loading className="m-0 mt-7 grid h-[760px] place-items-center rounded-[18px] border border-border text-sm text-muted" />,
});
