import type { ReactNode } from 'react';
import { DocsFrame } from '@/components/pages/DocsFrame';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <DocsFrame locale="en">{children}</DocsFrame>;
}
