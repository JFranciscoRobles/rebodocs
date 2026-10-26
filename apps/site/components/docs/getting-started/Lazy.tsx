'use client';

import dynamic from 'next/dynamic';
import { Loading } from '../Loading';

/** The editor comes when the page is in the browser. */
export const LazyFirstDemo = dynamic(() => import('./FirstDemo'), {
  ssr: false,
  loading: () => <Loading className="m-0 mt-7 grid h-[700px] place-items-center rounded-[18px] border border-border text-sm text-muted" />,
});

/** The engine reads the template in the browser. */
export const LazyEngineDemo = dynamic(() => import('./EngineDemo'), {
  ssr: false,
  loading: () => (
    <Loading
      className="m-0 mt-7 grid h-[420px] place-items-center rounded-[18px] border border-border text-sm text-muted"
      text={{ en: 'Reading the template…', es: 'Leyendo la plantilla…', zh: '正在读取模板…' }}
    />
  ),
});
