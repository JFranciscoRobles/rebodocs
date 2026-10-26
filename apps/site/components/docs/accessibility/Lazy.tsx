'use client';

import dynamic from 'next/dynamic';
import { Loading } from '@/components/docs/Loading';

/** The editor comes when the page is in the browser. */
export const LazyListenDemo = dynamic(() => import('./ListenDemo'), {
  ssr: false,
  loading: () => <Loading className="m-0 mt-7 grid h-[700px] place-items-center rounded-[18px] border border-border text-sm text-muted" />,
});

/** The PDF is made in the browser, from the fonts of the site. */
export const LazyPdfDemo = dynamic(() => import('./PdfDemo'), {
  ssr: false,
  loading: () => (
    <Loading
      className="m-0 mt-7 grid h-[600px] place-items-center rounded-[18px] border border-border text-sm text-muted"
      text={{ en: 'Making the PDF…', es: 'Haciendo el PDF…', zh: '正在生成 PDF…' }}
    />
  ),
});
