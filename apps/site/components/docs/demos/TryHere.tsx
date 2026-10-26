'use client';

// The React demo of the repository, as this site builds it at /demo: in a
// frame, once asked for, so the page does not load a second editor for nothing.

import { useState } from 'react';
import { LocalLink, useLocale, useT } from '@/components/i18n';
import { localize } from '@/lib/i18n';

export function TryHere() {
  const [open, setOpen] = useState(false);
  const t = useT();
  const locale = useLocale();
  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      {open ? (
        <iframe
          src={localize('/demo/', locale)}
          title={t({ en: 'The React demo, apps/demo', es: 'La demo de React, apps/demo', zh: 'React 演示（apps/demo）' })}
          className="block h-[680px] w-full border-0 bg-white"
        />
      ) : (
        <div className="grid h-[280px] place-items-center bg-surface px-6 text-center">
          <div>
            <p className="m-0 text-[15px] leading-normal text-ink-soft">
              {t({
                en: 'apps/demo, as this site builds it: the included editor and your own interface, on the same agreement.',
                es: 'apps/demo, tal como lo compila este sitio: el editor incluido y tu propia interfaz, sobre el mismo contrato.',
                zh: '本网站构建的 apps/demo：在同一份协议上展示自带的编辑器和你自己的界面。',
              })}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => setOpen(true)} className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover">
                {t({ en: 'Open it here', es: 'Ábrela aquí', zh: '在此打开' })}
              </button>
              <LocalLink href="/demo/" className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-ink-soft no-underline hover:bg-hover">
                {t({ en: 'Full window', es: 'Ventana completa', zh: '全屏打开' })}
              </LocalLink>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
