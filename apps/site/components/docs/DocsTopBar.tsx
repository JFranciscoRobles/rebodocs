'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { Logo } from '@/components/home/SiteChrome';
import { VERSION } from '@/lib/home';
import { NPM_ORG } from '@/lib/site';
import { SidebarNav } from './DocsSidebar';
import { SearchCommand } from './SearchCommand';
import type { SearchEntry } from './searchIndex';

const ghost = 'rounded-lg px-2.75 py-1.75 text-ink transition-colors hover:bg-hover';

/** The bar above every page of the documentation; on a phone, its menu button opens the pages as a sheet. */
export function DocsTopBar({ index }: { index: SearchEntry[] }) {
  const sheet = useRef<HTMLDialogElement>(null);
  const close = () => sheet.current?.close();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/92 backdrop-blur-[8px]">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3 px-6 py-3">
        <button
          type="button"
          aria-label="Pages of the documentation"
          onClick={() => sheet.current?.showModal()}
          className="-ml-2 flex size-9 cursor-pointer items-center justify-center rounded-lg text-ink transition-colors hover:bg-hover lg:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
        <Link href="/" className="flex items-center gap-2.5 text-ink">
          <Logo size={28} />
          <span className="font-display text-lg font-extrabold tracking-[-0.03em]">Rebodocs</span>
          <span className="rounded-md bg-hover px-2 py-0.75 text-[13px] font-semibold text-muted">Docs</span>
        </Link>
        <SearchCommand index={index} />
        <nav aria-label="Top" className="ml-auto flex flex-wrap items-center gap-0.5 text-sm font-medium">
          <Link href="/" className={ghost}>
            Home
          </Link>
          <Link href="/docs/editor-api/" className={ghost}>
            API
          </Link>
          <a href={NPM_ORG} className={ghost}>
            npm
          </a>
          <span className="ml-1 rounded-full bg-pastel-green px-2.5 py-1.25 text-xs font-medium text-pastel-green-fg">v{VERSION}</span>
        </nav>
      </div>

      <dialog
        ref={sheet}
        aria-label="Pages of the documentation"
        className="sheet m-0 h-dvh w-[min(320px,86vw)]"
        onClick={(event) => event.target === sheet.current && close()}
      >
        <div className="flex h-full flex-col overflow-y-auto bg-white px-4 py-5 shadow-menu">
          <div className="mb-5 flex items-center justify-between px-2.5">
            <span className="font-display text-lg font-extrabold tracking-[-0.03em]">Docs</span>
            <button type="button" onClick={close} className="cursor-pointer rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-hover">
              Close
            </button>
          </div>
          <SidebarNav onGo={close} />
        </div>
      </dialog>
    </header>
  );
}
