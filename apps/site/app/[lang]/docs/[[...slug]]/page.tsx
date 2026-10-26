import { DocPage, docMetadata, docParams, slugOf } from '@/components/pages/DocPage';
import type { Locale } from '@/lib/i18n';

type Props = { params: Promise<{ lang: string; slug?: string[] }> };

export const dynamicParams = false;
export const generateStaticParams = docParams;

export async function generateMetadata({ params }: Props) {
  const { lang, slug } = await params;
  return docMetadata(slugOf(slug), lang as Locale);
}

export default async function Doc({ params }: Props) {
  const { lang, slug } = await params;
  return <DocPage slug={slugOf(slug)} locale={lang as Locale} />;
}
