'use client';

import dynamic from 'next/dynamic';
import { Loading } from '@/components/docs/Loading';

/** The editor comes when the page is in the browser. */
export const LazyEditorDemo = dynamic(() => import('./EditorDemo'), {
  ssr: false,
  loading: () => <Loading className="m-0 mt-7 grid h-[600px] place-items-center rounded-[18px] border border-border text-sm text-muted" />,
});

/** It draws on a canvas, which the server has not. */
export const LazyMarginsDemo = dynamic(() => import('./MarginsDemo'), {
  ssr: false,
  loading: () => (
    <Loading
      className="m-0 mt-7 grid h-[520px] place-items-center rounded-[18px] border border-border text-sm text-muted"
      text={{ en: 'Drawing the letterhead…', es: 'Dibujando el membrete…', zh: '正在绘制信头…' }}
    />
  ),
});
