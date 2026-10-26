import type { ReactNode } from 'react';
import { DocsSidebar } from '@/components/docs/DocsSidebar';
import { DocsTopBar } from '@/components/docs/DocsTopBar';
import { searchIndex } from '@/components/docs/searchIndex';
import type { Locale } from '@/lib/i18n';
import { setPageLocale } from '@/lib/locale';

// The frame of every page of the documentation: the bar, the pages beside it,
// and the page itself, which brings its own "On this page".
export function DocsFrame({ locale, children }: { locale: Locale; children: ReactNode }) {
  setPageLocale(locale);
  return (
    <div className="home min-h-screen bg-white text-ink">
      <DocsTopBar index={searchIndex(locale)} />
      <div className="mx-auto flex max-w-[1400px] gap-x-12 px-4 sm:px-6">
        <DocsSidebar />
        <div className="min-w-0 flex-[999_1_600px]">{children}</div>
      </div>
    </div>
  );
}
