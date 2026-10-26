'use client';

import dynamic from 'next/dynamic';
import { Loading } from '@/components/docs/Loading';

/** It reads font files and makes a PDF, which is done in the browser. */
export const LazyRenderDemo = dynamic(() => import('./RenderDemo'), {
  ssr: false,
  loading: () => (
    <Loading
      className="m-0 mt-7 grid h-[640px] place-items-center rounded-[18px] border border-border text-sm text-muted"
      text={{ en: 'Reading the fonts…', es: 'Leyendo las fuentes…', zh: '正在读取字体…' }}
    />
  ),
});
