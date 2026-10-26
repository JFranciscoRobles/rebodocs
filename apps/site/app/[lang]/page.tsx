import { HomePage, homeMetadata } from '@/components/pages/HomePage';
import type { Locale } from '@/lib/i18n';

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props) {
  return homeMetadata((await params).lang as Locale);
}

export default async function Home({ params }: Props) {
  return <HomePage locale={(await params).lang as Locale} />;
}
