import type { Metadata, Viewport } from 'next';
import { Caveat, Inter, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { LocaleProvider } from '@/components/i18n';
import { LANGUAGES, type Locale, translator } from '@/lib/i18n';
import { SITE } from '@/lib/site';
import '../../app/globals.css';

// The fonts of the landing page, as CSS variables: `globals.css` turns them into
// `font-display`, `font-text`, `font-code` and `font-hand`. Chinese is set in the
// system's font for it, after these: they have no Chinese characters.
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-jakarta' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains' });
const caveat = Caveat({ subsets: ['latin'], weight: '600', variable: '--font-caveat' });

/** What every page of a language has: its title template, its description, and where the site is. */
export function rootMetadata(locale: Locale): Metadata {
  const t = translator(locale);
  return {
    metadataBase: new URL(SITE),
    title: {
      default: t({
        en: 'Rebodocs: the document editor you build into your app',
        es: 'Rebodocs: el editor de documentos que integras en tu aplicación',
        zh: 'Rebodocs：嵌入你的应用的文档编辑器',
      }),
      template: '%s · Rebodocs',
    },
    description: t({
      en: 'A word processor for the browser, compatible with Word (DOCX) files, with its own engine: real-time collaboration, templates and PDF. Open source, built to live inside your application.',
      es: 'Un procesador de textos para el navegador, compatible con archivos de Word (DOCX), con motor propio: colaboración en tiempo real, plantillas y PDF. De código abierto, hecho para vivir dentro de tu aplicación.',
      zh: '浏览器中的文字处理器，兼容 Word（DOCX）文件，拥有自己的排版引擎：实时协作、模板和 PDF。开源，专为嵌入你的应用而设计。',
    }),
    applicationName: 'Rebodocs',
    keywords: t({
      en: ['docx editor', 'word processor', 'react document editor', 'docx to pdf', 'real-time collaboration', 'tracked changes', 'document templates', 'open source'],
      es: ['editor docx', 'procesador de textos', 'editor de documentos react', 'docx a pdf', 'colaboración en tiempo real', 'control de cambios', 'plantillas de documentos', 'código abierto'],
      zh: ['DOCX 编辑器', '文字处理器', 'React 文档编辑器', 'DOCX 转 PDF', '实时协作', '修订', '文档模板', '开源'],
    }),
    icons: { icon: '/logo.svg' },
    openGraph: { type: 'website', siteName: 'Rebodocs', url: SITE, locale: LANGUAGES[locale].og },
    formatDetection: { telephone: false },
  };
}
export const viewport: Viewport = { themeColor: '#0b57d0' };

/**
 * What every page has: the document in its language. The header and the
 * footer of the site are in the frame of the documentation and in the landing
 * page itself: a demo takes the whole window, and has neither.
 */
export function RootDocument({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <html lang={LANGUAGES[locale].tag} className={`${jakarta.variable} ${inter.variable} ${jetbrains.variable} ${caveat.variable}`}>
      <body className="font-sans antialiased">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
