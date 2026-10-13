'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV, PAGES, hrefOf } from '@/lib/site';

/** The pages of the documentation: a column beside them, or, on a narrow screen, a list that opens above them. */
export function DocsNav() {
  const path = usePathname().replace(/\/?$/, '/');
  const [open, setOpen] = useState(false);
  // Going to a page puts the list away.
  useEffect(() => setOpen(false), [path]);
  const here = PAGES.find((page) => hrefOf(page.slug) === path);

  return (
    <aside className="border-b border-line py-3 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto lg:border-0 lg:py-8">
      <button className="flex w-full items-center justify-between text-sm font-semibold lg:hidden" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{here?.title ?? 'Documentation'}</span>
        <span className="text-muted">{open ? 'Close' : 'Menu'}</span>
      </button>
      <nav className={`${open ? 'block pt-4' : 'hidden'} lg:block`}>
        {NAV.map((group) => (
          <div key={group.title} className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{group.title}</p>
            <ul>
              {group.items.map((item) => {
                const href = hrefOf(item.slug);
                const on = href === path;
                return (
                  <li key={item.slug}>
                    <Link
                      href={href}
                      aria-current={on ? 'page' : undefined}
                      className={`-ml-px block border-l py-1.5 pl-3 text-sm ${on ? 'border-brand font-semibold text-brand' : 'border-line text-muted hover:border-muted hover:text-ink'}`}
                    >
                      {item.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
