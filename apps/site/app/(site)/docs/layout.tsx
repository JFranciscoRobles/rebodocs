import type { ReactNode } from 'react';
import { DocsNav } from '@/components/DocsNav';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10">
      <DocsNav />
      {children}
    </div>
  );
}
