'use client';

import { LanguageSwitcher, LocalLink as Link, useT } from '@/components/i18n';
import { VERSION } from '@/lib/home';
import { primary } from './buttons';
import { NPM_ORG, REPO } from '@/lib/site';

const ghost = 'rounded-lg px-3 py-2 text-ink transition-colors hover:bg-hover';

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="8" fill="#E8F0FD" />
      <path d="M10 9h9l4 4v10a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z" fill="#FFFFFF" stroke="#0B57D0" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12.5 15h7M12.5 18.5h5" stroke="#0B57D0" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** The header of the landing page. Its links go down to a second line on a narrow screen. */
export function SiteHeader() {
  const t = useT();
  return (
    <header className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4.5">
      <Link href="/" className="flex items-center gap-2.5 text-ink">
        <Logo />
        <span className="font-display text-xl font-extrabold tracking-[-0.03em]">Rebodocs</span>
      </Link>
      <span className="rounded-full bg-pastel-green px-2.5 py-1 text-xs font-medium text-pastel-green-fg">
        {t({ en: 'Open source', es: 'Código abierto', zh: '开源' })} · MIT · v{VERSION}
      </span>
      <nav aria-label={t({ en: 'Main', es: 'Principal', zh: '主导航' })} className="ml-auto flex flex-wrap items-center gap-0.5 text-[15px] font-medium">
        <Link href="/demo/" className={ghost}>
          {t({ en: 'Demo', es: 'Demo', zh: '演示' })}
        </Link>
        <Link href="/docs/" className={ghost}>
          {t({ en: 'Docs', es: 'Documentación', zh: '文档' })}
        </Link>
        <Link href="/docs/status/" className={ghost}>
          {t({ en: 'Status', es: 'Estado', zh: '现状' })}
        </Link>
        <a href={NPM_ORG} className={ghost}>
          npm
        </a>
        <a href={REPO} className={ghost}>
          GitHub
        </a>
        <LanguageSwitcher />
        <Link href="/docs/getting-started/" className={`ml-2 rounded-[10px] px-4 py-2.5 ${primary}`}>
          {t({ en: 'Get started', es: 'Empezar', zh: '开始使用' })}
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-6 gap-y-3 px-6 pb-10 pt-8 text-sm text-muted">
        <span className="font-display text-base font-extrabold tracking-[-0.03em] text-ink">Rebodocs</span>
        <Link href="/docs/" className="hover:text-ink">
          {t({ en: 'Docs', es: 'Documentación', zh: '文档' })}
        </Link>
        <Link href="/docs/status/" className="hover:text-ink">
          {t({ en: 'Status & roadmap', es: 'Estado y hoja de ruta', zh: '现状与路线图' })}
        </Link>
        <a href={NPM_ORG} className="hover:text-ink">
          npm
        </a>
        <a href={REPO} className="hover:text-ink">
          GitHub
        </a>
        <span className="sm:ml-auto">{t({ en: 'Open source under the MIT license.', es: 'Código abierto con licencia MIT.', zh: '基于 MIT 许可证开源。' })}</span>
      </div>
    </footer>
  );
}
