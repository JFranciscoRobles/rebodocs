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
      en: 'The editor in your browser, two ways: an interface built on the headless hooks, and the one that comes with it. Open a DOCX of your own.',
      es: 'El editor en tu navegador, de dos formas: una interfaz construida con los hooks headless, y la que trae incluida. Abre un DOCX tuyo.',
      zh: '在浏览器中体验编辑器的两种形态：基于 headless hooks 构建的界面，以及它自带的界面。可以打开你自己的 DOCX。',
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
