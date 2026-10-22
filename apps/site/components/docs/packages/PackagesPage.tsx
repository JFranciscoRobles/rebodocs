import { LIGHT_THEME, highlight } from '@/lib/docs';
import { NPM_ORG } from '@/lib/site';
import { PASTEL_CLASS, VERSION } from '@/lib/home';
import { Callout, HandTip, SectionHead } from '../ui';
import { ALL_PACKAGES, APPS, PACKAGE_DOCS } from './data';
import { PackagePicker } from './PackagePicker';
import { PackageTabs } from './PackageTabs';

const mono = 'font-code text-[13px]';
const COLUMNS = 'grid grid-cols-[1.15fr_1.2fr_1.1fr_1.2fr]';

/**
 * "Packages": the five, which one to install, where each runs, and the
 * applications in the repository that use them. The code is coloured here,
 * when the site is built.
 */
export async function PackagesPage() {
  const examples = Object.fromEntries(
    await Promise.all(PACKAGE_DOCS.map(async (pkg) => [pkg.name, (await Promise.all(pkg.example.map(([lang, code]) => highlight(code, lang, LIGHT_THEME)))).join('')] as const)),
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Packages</h1>
      <p className="m-0 mt-3.5 max-w-[680px] text-lg leading-[1.6] text-muted">
        Five packages, each for one thing, all{' '}
        <a href={NPM_ORG} className="font-medium text-brand hover:text-brand-hover">
          on npm
        </a>{' '}
        at the same version, <code className="rounded-[5px] bg-hover px-1.5 py-0.5 font-code text-[15px] text-ink">{VERSION}</code>. Most applications need one.
      </p>
      <div className="mt-4">
        <HandTip>tip: press ⌘K to jump to any package</HandTip>
      </div>

      <section aria-labelledby="pick" className="mt-16">
        <SectionHead id="pick" badge="Start here" color="blue" title="Which one do I install?">
          Pick what you are making. The drawing shows what you install, what comes inside it, and who uses whom.
        </SectionHead>
        <PackagePicker />
        <Callout title="One engine, not two.">
          <code className={mono}>@rebodocs/react</code> is built as one file with the engine, the editor and the collaboration client inside. The others ask npm for{' '}
          <code className={mono}>@rebodocs/core</code> and share one copy of it, so a <code className={mono}>Doc</code> made with core is the one they take. An application that installs both{' '}
          <code className={mono}>@rebodocs/react</code> and <code className={mono}>@rebodocs/core</code> has the engine twice.
        </Callout>
      </section>

      <section aria-labelledby="where" className="mt-24">
        <SectionHead id="where" badge="At a glance" color="green" title="Where each one runs">
          The five side by side: where each runs, what it is built for, and what it brings with it.
        </SectionHead>
        <ul className="m-0 mt-6 flex list-none flex-wrap items-center gap-2 p-0">
          <li className="mr-1 text-sm text-muted">All five:</li>
          {ALL_PACKAGES.map((fact) => (
            <li key={fact} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.5 6.2l2.2 2.2L9.5 3.6" fill="none" stroke="#2E6B3C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {fact}
            </li>
          ))}
        </ul>
        <div className="mt-4 overflow-x-auto rounded-[14px] border border-border">
          <div role="table" aria-label="Where each package runs" className="min-w-[760px]">
            <div role="row" className={`${COLUMNS} bg-surface text-xs font-semibold tracking-[0.04em] text-muted`}>
              <div role="columnheader" className="px-5 py-3">
                PACKAGE
              </div>
              <div role="columnheader" className="px-5 py-3">
                RUNS IN
              </div>
              <div role="columnheader" className="px-5 py-3">
                BUILT FOR
              </div>
              <div role="columnheader" className="px-5 py-3">
                DEPENDS ON
              </div>
            </div>
            {PACKAGE_DOCS.map((pkg) => (
              <div key={pkg.name} role="row" className={`${COLUMNS} border-t border-border text-[15px] transition-colors hover:bg-[#fcfcfb]`}>
                <div role="cell" className="flex flex-wrap items-center gap-2 px-5 py-4">
                  <a href={`#package-${pkg.name.replace('@rebodocs/', '')}`} className="font-code font-medium text-ink hover:text-brand">
                    {pkg.name}
                  </a>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PASTEL_CLASS[pkg.color]}`}>{pkg.tag}</span>
                </div>
                <div role="cell" className="px-5 py-4 leading-normal text-ink-soft">
                  {pkg.runsIn.join(' · ')}
                </div>
                <div role="cell" className="px-5 py-4 font-code text-[13px] leading-normal text-muted">
                  {pkg.target}
                </div>
                <div role="cell" className="flex flex-wrap gap-1.5 px-5 py-4">
                  {pkg.dependsOn.map((dependency) => (
                    <code key={dependency} className="rounded-[5px] bg-hover px-1.75 py-0.5 font-code text-[12.5px] text-ink">
                      {dependency}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Callout title="Same version, all of them.">
          Every package is published at the same version, and they expect each other at it: update them together. Rebodocs is 0.x and pre-release, so a new version may change an API; what is
          done and what is coming is in{' '}
          <a href="/docs/status/" className="font-medium text-brand hover:text-brand-hover">
            Status and roadmap
          </a>
          .
        </Callout>
      </section>

      <section aria-labelledby="packages" className="mt-24">
        <SectionHead id="packages" badge="5 packages" color="purple" title="The packages">
          One at a time: how to get it, what it has, and the least code that uses it.
        </SectionHead>
        <PackageTabs examples={examples} />
      </section>

      <section aria-labelledby="apps" className="mt-24">
        <SectionHead id="apps" badge={`${APPS.length} applications`} color="orange" title="The applications">
          Besides the packages, the repository has small applications that use them: each one a way of putting the editor in a product. See{' '}
          <a href="/docs/demos/" className="font-medium text-brand hover:text-brand-hover">
            Demos to run
          </a>
          .
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
          {APPS.map((app) => (
            <div key={app.path} className="lift flex flex-col gap-2.5 rounded-2xl border border-border p-5.5">
              <code className="font-code text-[15px] font-medium text-ink">{app.path}</code>
              <p className="m-0 flex-1 text-[15px] leading-[1.6] text-ink-soft">{app.what}</p>
              {app.run && <code className="self-start rounded-md border border-border bg-surface px-2 py-0.75 font-code text-[12.5px] text-muted">$ {app.run}</code>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
