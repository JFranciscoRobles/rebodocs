'use client';

import dynamic from 'next/dynamic';
import { Loading } from '@/components/docs/Loading';

/** The viewer comes when the page is in the browser. */
export const LazyViewerDemo = dynamic(() => import('./ViewerDemo'), {
  ssr: false,
  loading: () => (
    <Loading
      className="m-0 mt-7 grid h-[640px] place-items-center rounded-[18px] border border-border text-sm text-muted"
      text={{ en: 'Opening the viewer…', es: 'Abriendo el visor…', zh: '正在打开查看器…' }}
    />
  ),
});
