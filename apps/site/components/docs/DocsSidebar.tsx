'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useT } from '@/components/i18n';
import type { Pastel } from '@/lib/home';
import { localize } from '@/lib/i18n';
import { NAV, hrefOf } from '@/lib/site';

/** Whole class names, so Tailwind finds them. */
const DOT: Record<Pastel, string> = {
  blue: 'bg-pastel-blue-fg',
  yellow: 'bg-pastel-yellow-fg',
  green: 'bg-pastel-green-fg',
  pink: 'bg-pastel-pink-fg',
  purple: 'bg-pastel-purple-fg',
  orange: 'bg-pastel-orange-fg',
};

/** The pages, by group: the column beside them, and what the sheet shows on a phone. */
export function SidebarNav({ onGo }: { onGo?: () => void }) {
  const path = usePathname().replace(/\/?$/, '/');
  const locale = useLocale();
  const t = useT();
  return (
    <nav aria-label={t({ en: 'Documentation', es: 'Documentación', zh: '文档' })} className="flex flex-col gap-5.5">
      {NAV.map((group) => (
        <div key={group.title.en}>
          <p className="m-0 flex items-center gap-2 px-2.5 pb-1.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
            <span className={`size-2 rounded-[3px] ${DOT[group.color]}`} aria-hidden="true" />
            {t(group.title)}
          </p>
          <ul className="m-0 list-none p-0">
            {group.items.map((item) => {
              const href = localize(hrefOf(item.slug), locale);
              const on = href === path;
              return (
                <li key={item.slug}>
                  <Link
                    href={href}
                    onClick={onGo}
                    aria-current={on ? 'page' : undefined}
                    className={`block rounded-[7px] px-2.5 py-1.25 text-sm transition-colors ${on ? 'bg-pastel-blue font-semibold text-brand' : 'text-ink-soft hover:bg-hover hover:text-ink'}`}
                  >
                    {t(item.title)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** The column on a wide screen: it stays in sight and scrolls by itself. */
export function DocsSidebar() {
  return (
    <aside className="sticky top-[61px] hidden h-[calc(100vh-61px)] max-w-[260px] flex-[1_1_220px] overflow-y-auto py-8 lg:block">
      <SidebarNav />
    </aside>
  );
}
