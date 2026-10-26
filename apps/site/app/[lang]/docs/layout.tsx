import type { ReactNode } from 'react';
import { DocsFrame } from '@/components/pages/DocsFrame';
import type { Locale } from '@/lib/i18n';

type Props = { children: ReactNode; params: Promise<{ lang: string }> };

export default async function DocsLayout({ children, params }: Props) {
  return <DocsFrame locale={(await params).lang as Locale}>{children}</DocsFrame>;
}
