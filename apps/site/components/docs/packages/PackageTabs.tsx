'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PASTEL_CLASS, npmOf } from '@/lib/home';
import { REPO } from '@/lib/site';
import { InstallCommand } from '../InstallCommand';
import { roving, useHash } from '../keys';
import { CAPTION, CODE, TabPanel } from '../ui';
import { PACKAGE_DOCS, short } from './data';

/** Where a package is on the page: the tabs open it from this. */
export const packageHash = (name: string) => `package-${short(name)}`;

const row = 'border-t border-[#f0eee9] px-7 py-6';

/**
 * The five packages, one at a time, each with how to get it, what it has and
 * how it is used. `#package-collab` opens that one. Every panel is on the page.
 */
export function PackageTabs({ examples }: { examples: Record<string, string> }) {
  const [chosen, setChosen] = useState(0);

  useHash((hash) => {
    const at = PACKAGE_DOCS.findIndex((pkg) => packageHash(pkg.name) === hash);
    if (at < 0) return;
    setChosen(at);
    document.getElementById(hash)?.scrollIntoView({ block: 'center' });
  });

  return (
    <>
      <div role="tablist" aria-label="Packages" className="mt-6 flex flex-wrap gap-2 border-b border-border pb-2.5" onKeyDown={(event) => roving(event, setChosen)}>
        {PACKAGE_DOCS.map((pkg, i) => {
          const on = i === chosen;
          return (
            <button
              key={pkg.name}
              id={packageHash(pkg.name)}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${packageHash(pkg.name)}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => setChosen(i)}
              className={`inline-flex cursor-pointer scroll-mt-24 items-center gap-2 rounded-[9px] border px-3.5 py-2 font-code text-sm font-medium transition-colors ${on ? `border-transparent ${PASTEL_CLASS[pkg.color]}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`}
            >
              {pkg.name}
            </button>
          );
        })}
      </div>

      {PACKAGE_DOCS.map((pkg, i) => (
        <TabPanel key={pkg.name} id={`${packageHash(pkg.name)}-panel`} labelledBy={packageHash(pkg.name)} on={i === chosen} onFound={() => setChosen(i)}>
          <div className="mt-6 overflow-hidden rounded-[18px] border border-border">
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 px-7 py-5.5">
              <h3 className="m-0 font-code text-xl font-medium">{pkg.name}</h3>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PASTEL_CLASS[pkg.color]}`}>{pkg.tag}</span>
              <span className="ml-auto flex gap-4 text-sm font-semibold">
                <a href={`${REPO}/tree/main/packages/${short(pkg.name)}#readme`} className="text-brand hover:text-brand-hover">
                  README →
                </a>
                <a href={npmOf(pkg.name)} className="text-brand hover:text-brand-hover">
                  On npm →
                </a>
              </span>
              <p className="m-0 mt-1 max-w-[720px] basis-full font-display text-xl font-bold tracking-[-0.01em]">{pkg.summary}</p>
              <ul className="m-0 mt-2 flex basis-full list-none flex-wrap gap-2 p-0">
                {pkg.runsIn.map((place) => (
                  <li key={place} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft">
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M2.5 6.2l2.2 2.2L9.5 3.6" fill="none" stroke="#2E6B3C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {place}
                  </li>
                ))}
                <li className="inline-flex items-center rounded-full border border-border bg-white px-3 py-1.5 font-code text-[13px] text-muted">{pkg.target}</li>
              </ul>
            </div>

            <div className={`${row} flex flex-wrap gap-x-10 gap-y-6 bg-surface`}>
              <div className="flex min-w-0 flex-[1.4_1_340px] flex-col items-start gap-3">
                <p className={CAPTION}>Get it</p>
                {pkg.install.map(([command, what]) => (
                  <div key={command} className="flex max-w-full flex-col items-start gap-1.5">
                    <InstallCommand command={command} />
                    <span className="text-sm text-muted">{what}</span>
                  </div>
                ))}
              </div>
              <div className="min-w-0 flex-[1_1_220px]">
                <p className={CAPTION}>Depends on</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pkg.dependsOn.map((dependency) => (
                    <code key={dependency} className="rounded-md border border-border bg-white px-2 py-0.75 font-code text-[13px]">
                      {dependency}
                    </code>
                  ))}
                </div>
              </div>
            </div>

            <div className={`${row} flex flex-wrap gap-x-10 gap-y-6`}>
              <div className="min-w-0 flex-[1_1_340px]">
                <p className={CAPTION}>What is inside</p>
                <dl className="m-0 mt-2">
                  {pkg.inside.map(([label, text]) => (
                    <div key={label} className="flex gap-4 border-t border-[#f0eee9] py-2.5 text-[15px]">
                      <dt className="w-[150px] flex-none font-semibold text-ink">{label}</dt>
                      <dd className="m-0 leading-normal text-ink-soft">{text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6">
                {pkg.entries && (
                  <div>
                    <p className={CAPTION}>Import it from</p>
                    <dl className="m-0 mt-2">
                      {pkg.entries.map(([path, what]) => (
                        <div key={path} className="border-t border-[#f0eee9] py-2.5">
                          <dt className="font-code text-[13px] text-brand">{path}</dt>
                          <dd className="m-0 mt-0.5 text-sm leading-normal text-ink-soft">{what}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
                <div>
                  <p className={CAPTION}>Take it</p>
                  <p className="m-0 mt-2 text-[15px] leading-[1.6] text-ink-soft">{pkg.takeIt}</p>
                  <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
                    {pkg.guides.map(([title, href]) => (
                      <li key={href}>
                        <Link href={href} className="text-sm font-semibold text-brand hover:text-brand-hover">
                          {title} →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className={row}>
              <p className={CAPTION}>Use it</p>
              <div className={`mt-3 ${CODE}`} dangerouslySetInnerHTML={{ __html: examples[pkg.name] }} />
            </div>
          </div>
        </TabPanel>
      ))}
    </>
  );
}
