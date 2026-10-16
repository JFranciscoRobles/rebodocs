import Link from 'next/link';
import type { ReactNode } from 'react';
import { NPM_ORG, REPO } from '@/lib/site';

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={26} height={26} />
          Rebodocs
        </Link>
        <nav className="ml-auto flex items-center gap-5 text-sm font-medium text-muted">
          <Link href="/demo/" className="hover:text-ink">
            Demo
          </Link>
          <Link href="/docs/" className="hover:text-ink">
            Docs
          </Link>
          <Link href="/docs/status/" className="hidden hover:text-ink sm:inline">
            Status
          </Link>
          <a href={NPM_ORG} className="hidden hover:text-ink sm:inline">
            npm
          </a>
          <a href={REPO} className="hover:text-ink">
            GitHub
          </a>
          <Link href="/docs/getting-started/" className="hidden whitespace-nowrap rounded-full bg-brand px-4 py-1.5 text-white hover:bg-brand-dark sm:inline-block">
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:px-6">
        <p>Rebodocs is open source under the MIT license, and pre-release.</p>
        <p className="flex gap-5 sm:ml-auto">
          <Link href="/docs/" className="hover:text-ink">
            Docs
          </Link>
          <Link href="/docs/status/" className="hover:text-ink">
            Status and roadmap
          </Link>
          <a href={NPM_ORG} className="hover:text-ink">
            npm
          </a>
          <a href={REPO} className="hover:text-ink">
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
