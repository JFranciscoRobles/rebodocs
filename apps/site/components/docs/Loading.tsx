'use client';

import type { L } from '@/lib/i18n';
import { useT } from '../i18n';

/** What a demo shows while it loads in the browser, in the language of the page: by default, that the editor is opening. */
export function Loading({ className, text }: { className: string; text?: L }) {
  const t = useT();
  return <p className={className}>{t(text ?? { en: 'Opening the editor…', es: 'Abriendo el editor…', zh: '正在打开编辑器…' })}</p>;
}
