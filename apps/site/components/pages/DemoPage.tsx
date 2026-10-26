import type { Metadata } from 'next';
import { DemoApp } from '@/components/DemoApp';
import { type Locale, translator } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export function demoMetadata(locale: Locale): Metadata {
  const t = translator(locale);
  return pageMetadata({
    locale,
    path: '/demo/',
    title: t({ en: 'Demo', es: 'Demo', zh: '演示' }),
    description: t({
      en: 'The editor in your browser: an interface built on the headless hooks, the one that comes with it in two layouts, and the viewer, only to read. Open a DOCX of your own.',
      es: 'El editor en tu navegador: una interfaz construida con los hooks headless, la que trae incluida en dos disposiciones, y el visor, solo para leer. Abre un DOCX tuyo.',
      zh: '在浏览器中体验编辑器：基于 headless hooks 构建的界面、自带界面的两种布局，以及只读的查看器。可以打开你自己的 DOCX。',
    }),
  });
}

export function DemoPage() {
  return (
    <main>
      <DemoApp />
    </main>
  );
}
