import Link from 'next/link';
import { AGAINST_WORD, TESTS, linesLikeWord } from '@/components/docs/status/data';
import type { ReactNode } from 'react';
import { CodeTabs } from '@/components/CodeTabs';
import { LiveDemo } from '@/components/LiveDemo';
import { FeatureGrid } from '@/components/home/FeatureGrid';
import { HeroEditor } from '@/components/home/HeroEditor';
import { InstallPicker } from '@/components/home/InstallPicker';
import { SiteFooter, SiteHeader, primary } from '@/components/home/SiteChrome';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PACKAGES, PASTEL_CLASS, type Pastel, TAGS, VERSION, npmOf, pastelAt } from '@/lib/home';
import { NPM_ORG } from '@/lib/site';

const SAMPLES: [string, string, string][] = [
  [
    'React',
    'tsx',
    `'use client';
import { DocsEditor } from '@rebodocs/react';

export default function Contract({ file }: { file: Uint8Array }) {
  return (
    <DocsEditor
      docx={file}
      name="contract.docx"
      locale="en"
      onSave={(docx) => upload(docx)}
    />
  );
}`,
  ],
  [
    'Your UI',
    'tsx',
    `import { DocsProvider, DocsSurface, useDocs } from '@rebodocs/react';

function Bold() {
  const { state, commands } = useDocs();
  return (
    <button
      className={state.bold ? 'bg-blue-100' : ''}
      onClick={() => commands.toggleMark('bold')}
    >
      B
    </button>
  );
}

<DocsProvider docx={file}>
  <Bold />
  <DocsSurface className="h-full" />
</DocsProvider>`,
  ],
  [
    'Server',
    'ts',
    `import { importDocx, fillVariables, exportDocx } from '@rebodocs/core';

const doc = fillVariables(importDocx(template), {
  client: 'Ana Pérez',
  amount: '2500',
});

await storage.put('receipt.docx', exportDocx(doc));`,
  ],
  [
    'Versions',
    'tsx',
    `// Where versions are kept is yours: the editor lists,
// compares and restores them from its side panel.
<DocsEditor
  docx={file}
  versions={{
    list: () => api.versions(documentId),
    load: (id) => api.version(documentId, id),
    save: (docx, info) => api.keepVersion(documentId, docx, info),
  }}
/>`,
  ],
  [
    'Together',
    'tsx',
    `// Your backend decides who gets in, and keeps the file.
<DocsEditor
  collab={{
    url: 'https://collab.example.com',
    room: documentId,
    ticket,
  }}
/>`,
  ],
];

const secondary = 'rounded-xl border border-border-strong bg-white font-semibold text-ink transition-colors hover:bg-hover';

const Pill = ({ color, children }: { color: Pastel; children: ReactNode }) => (
  <span className={`rounded-full px-3 py-[5px] text-[13px] font-semibold ${PASTEL_CLASS[color]}`}>{children}</span>
);
const Title = ({ children, small }: { children: ReactNode; small?: boolean }) => (
  <h2
    className={`mt-4.5 font-display font-extrabold leading-[1.08] tracking-[-0.03em] ${small ? 'text-[clamp(34px,4.2vw,52px)]' : 'text-[clamp(36px,4.6vw,56px)]'}`}
  >
    {children}
  </h2>
);

const doodle = 'absolute hidden md:block';
/** A stroke drawn by hand, that draws itself in after `delay`. */
const drawn = (delay: string) => ({ className: 'draw animate-draw', style: { animationDelay: delay } });

function Hero() {
  return (
    <section id="top" className="relative mx-auto max-w-[1180px] px-6 pb-10 pt-18 text-center">
      <svg width="70" height="70" viewBox="0 0 70 70" aria-hidden="true" className={`${doodle} left-[6%] top-[90px] animate-float`}>
        <path {...drawn('1.2s')} d="M35 8l6 18 18 6-18 6-6 18-6-18-18-6 18-6z" fill="none" stroke="#E0A526" strokeWidth="2.5" strokeLinejoin="round" />
      </svg>
      <svg width="90" height="60" viewBox="0 0 90 60" aria-hidden="true" className={`${doodle} right-[7%] top-[120px] animate-float-slow`}>
        <path {...drawn('1.8s')} d="M6 40c12-28 24 18 36-6s22-20 42-6" fill="none" stroke="#E86A8C" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {/* Dotted, so it comes in instead of being drawn. */}
      <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true" className={`${doodle} right-[13%] top-[330px] animate-float`}>
        <circle className="animate-pop-in opacity-0" style={{ animationDelay: '0.6s' }} cx="28" cy="28" r="20" fill="none" stroke="#6BAF7B" strokeWidth="2.5" strokeDasharray="4 7" />
      </svg>

      <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-2 pr-3.5 text-sm text-muted">
        <span className="rounded-full border border-border bg-white px-2 py-0.5 text-xs font-semibold text-ink">New</span>
        Claude edits real documents through MCP
      </p>
      <h1 className="mx-auto mt-7 max-w-[900px] text-balance font-display text-[clamp(44px,6.6vw,84px)] font-extrabold leading-[1.04] tracking-[-0.03em]">
        The document editor you{' '}
        <span className="relative whitespace-nowrap text-brand">
          build into
          <svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true" className="absolute -bottom-2.5 left-0 h-[18px] w-full">
            <path {...drawn('0s')} d="M4 14C70 4 160 4 296 10" fill="none" stroke="#F5C443" strokeWidth="7" strokeLinecap="round" />
          </svg>
        </span>{' '}
        your app.
      </h1>
      <p className="mx-auto mt-7 max-w-[640px] text-[19px] leading-[1.6] text-muted">
        A word processor for the browser, compatible with Word files. Open, edit and save .docx with tracked changes, versions, collaboration, templates and PDF — in packages you take
        one at a time.
      </p>
      <p className="mt-8 flex flex-wrap justify-center gap-2.5 text-base">
        <Link href="/docs/getting-started/" className={`rounded-xl px-5.5 py-3.5 ${primary}`}>
          Get started
        </Link>
        <a href="#demo" className={`px-5.5 py-3.5 ${secondary}`}>
          Try it below
        </a>
      </p>
      <InstallPicker />
      <HeroEditor />
    </section>
  );
}

export default async function Home() {
  const samples = await Promise.all(SAMPLES.map(async ([name, lang, code]) => ({ name, html: await highlight(code, lang, LIGHT_THEME) })));
  return (
    <div className="home overflow-x-clip text-ink">
      <SiteHeader />
      <main>
        <Hero />

        <ul className="reveal mx-auto flex max-w-[1180px] flex-wrap justify-center gap-2.5 px-6 pb-6 pt-14" aria-label="What it does">
          {TAGS.map((tag, i) => (
            <li key={tag} className={`rounded-full px-3.5 py-[7px] text-sm font-medium transition duration-250 hover:-translate-y-1 hover:shadow-lift ${PASTEL_CLASS[pastelAt(i)]}`}>
              {tag}
            </li>
          ))}
        </ul>

        <section id="demo" className="mx-auto max-w-[1180px] px-6 pb-15 pt-25">
          <div className="reveal mx-auto max-w-[720px] text-center">
            <Pill color="blue">Live demo</Pill>
            <Title>This is the editor. Type in it.</Title>
            <p className="mt-4.5 text-lg leading-[1.6] text-muted">
              Open your own .docx from the menu, fill the template from the side panel, track changes from Review, save a version and compare it, export to PDF. Nothing leaves the
              browser.
            </p>
          </div>
          <div className="reveal mt-11 rounded-3xl border border-border bg-surface p-3.5">
            <LiveDemo />
          </div>
          <p className="mt-4.5 text-center text-[15px] text-muted">
            Same document, your own UI →{' '}
            <Link href="/demo/" className="font-medium text-brand hover:text-brand-hover">
              see it built with headless hooks
            </Link>
          </p>
        </section>

        <section className="mx-auto max-w-[1180px] px-6 py-20">
          <div className="reveal mx-auto mb-12 max-w-[720px] text-center">
            <Pill color="green">Features</Pill>
            <Title>An editor you can trust with real documents.</Title>
          </div>
          <FeatureGrid />
        </section>

        <section id="docs" className="mx-auto max-w-[1180px] px-6 py-20">
          <div className="flex flex-wrap items-center gap-12 rounded-[28px] bg-surface p-[clamp(28px,5vw,64px)]">
            <div className="reveal min-w-0 flex-[1_1_360px]">
              <Pill color="purple">For developers</Pill>
              <Title small>It feels like part of your app — because it is.</Title>
              <p className="mt-4.5 text-[17px] leading-[1.65] text-muted">
                It mounts in your page, uses your fonts and your language, and hands you the file when someone saves. Where documents live and who can open them stays your app’s business.
              </p>
              <Link href="/docs/react/" className="mt-5 inline-flex items-center gap-1.5 font-semibold text-brand hover:text-brand-hover">
                Read the guide <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="reveal min-w-0 flex-[1.2_1_480px]">
              <CodeTabs samples={samples} />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-6 py-20">
          <div className="reveal mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Pill color="orange">Packages</Pill>
              <Title small>Take what you need.</Title>
            </div>
            <p className="max-w-[380px] text-base leading-[1.6] text-muted">
              Five packages on npm. The engine has no DOM, so the same core renders PDFs in Node.{' '}
              <a href={NPM_ORG} className="font-medium text-brand hover:text-brand-hover">
                See them on npm →
              </a>
            </p>
          </div>
          <div className="reveal overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[680px] border-collapse text-left text-[15px]">
              <colgroup>
                <col className="w-[27%]" />
                <col className="w-[49%]" />
                <col />
              </colgroup>
              <thead className="bg-surface text-[13px] font-medium text-muted">
                <tr>
                  <th className="px-4.5 py-[11px] font-medium">Package</th>
                  <th className="border-l border-border px-4.5 py-[11px] font-medium">What it does</th>
                  <th className="border-l border-border px-4.5 py-[11px] font-medium">Runs in</th>
                </tr>
              </thead>
              <tbody>
                {PACKAGES.map((pkg) => (
                  <tr key={pkg.name} className="border-t border-border align-top transition-colors hover:bg-surface">
                    <td className="px-4.5 py-3.5">
                      <a href={npmOf(pkg.name)} className="font-code text-sm font-medium text-ink underline decoration-border-strong underline-offset-4 hover:decoration-current">
                        {pkg.name}
                      </a>
                      <div className="mt-1 text-xs text-muted">v{VERSION}</div>
                    </td>
                    <td className="border-l border-border px-4.5 py-3.5 text-ink-soft">{pkg.what}</td>
                    <td className="border-l border-border px-4.5 py-3">
                      <span className={`rounded-md px-[9px] py-[3px] text-[13px] font-medium ${PASTEL_CLASS[pkg.color]}`}>{pkg.tag}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="status" className="mx-auto max-w-[1180px] px-6 pb-25 pt-15">
          <div className="reveal flex flex-wrap items-center gap-10 rounded-[28px] bg-pastel-yellow p-[clamp(28px,5vw,64px)]">
            <div className="min-w-0 flex-[1_1_340px]">
              <span className="rounded-full bg-white px-3 py-[5px] text-[13px] font-semibold text-pastel-yellow-fg">Where it stands</span>
              <p className="mt-4.5 font-display text-[clamp(80px,11vw,140px)] font-extrabold leading-[0.9] tracking-[-0.03em]">{TESTS.reduce((sum, row) => sum + row.count, 0)}</p>
              <p className="mt-2 text-lg text-[#5c4a1e]">automated tests passing</p>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white" aria-hidden="true">
                <div className="h-full w-0 animate-grow rounded-full bg-brand" />
              </div>
              <p className="mt-2.5 font-hand text-2xl font-semibold text-pastel-yellow-fg">measured against Word, line by line</p>
            </div>
            <div className="min-w-0 flex-[1_1_380px]">
              <p className="font-display text-[clamp(24px,2.6vw,32px)] font-bold leading-[1.3] tracking-[-0.03em]">Tested, measured, and published on npm.</p>
              <p className="mt-4 text-[17px] leading-[1.6] text-[#5c4a1e]">
                Its own word processor, with its own engine, that opens and saves .docx files. In the {AGAINST_WORD.length} documents measured against Word, {linesLikeWord()}% of the lines fall where Word
                puts them, and the work goes on to reach all of them. Open source under MIT.
              </p>
              <p className="mt-6.5 flex flex-wrap gap-2.5">
                <Link href="/docs/getting-started/" className={`rounded-xl px-5 py-[13px] ${primary}`}>
                  Get started
                </Link>
                <Link href="/docs/status/" className="rounded-xl bg-white px-5 py-[13px] font-semibold text-ink transition-colors hover:bg-hover">
                  What’s checked, what’s missing →
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
