import type { ReactNode } from 'react';
import { RootDocument, rootMetadata } from '@/components/pages/RootDocument';
import { type Locale, LOCALES, DEFAULT_LOCALE } from '@/lib/i18n';

type Props = { children: ReactNode; params: Promise<{ lang: string }> };

// The other languages, each under its code: /es/, /zh/.
export const dynamicParams = false;
export function generateStaticParams() {
  return LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: Props) {
  return rootMetadata((await params).lang as Locale);
}
export { viewport } from '@/components/pages/RootDocument';

export default async function LanguageLayout({ children, params }: Props) {
  return <RootDocument locale={(await params).lang as Locale}>{children}</RootDocument>;
}
