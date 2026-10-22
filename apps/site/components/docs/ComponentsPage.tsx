import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { ComponentTabs } from './ComponentTabs';
import { EntryPicker } from './EntryPicker';
import { HOOKS, codeOf } from './hooks/hooks';
import { HooksExplorer } from './hooks/HooksExplorer';
import { InstallCommand } from './InstallCommand';
import { COMPONENTS, ENTRIES, LANG_FNS, VERSION_FNS } from './reference';
import { Callout, HandTip, SectionHead } from './ui';

const mono = 'font-code text-[13px]';

/** The piece of interface of a hook, as its file has it, without what only this page needs. */
const exampleOf = (name: string) =>
  readFileSync(join(process.cwd(), 'components/docs/hooks/examples', `${name}.tsx`), 'utf8')
    .replace(/^'use client';\n\n/, '')
    .split('\n// ---- On this page ----')[0]
    .trimEnd();

/**
 * "Components and hooks": everything @rebodocs/react exports, to try rather
 * than to read. The code is coloured here, when the site is built; what moves
 * is in the parts it draws. Each hook runs on a real document, with the piece
 * of interface its file has; the code under it is that file.
 */
export async function ComponentsPage() {
  const entryCode = await Promise.all(ENTRIES.map((entry) => highlight(entry.code, 'tsx', LIGHT_THEME)));
  const componentHtml = Object.fromEntries(
    await Promise.all(
      COMPONENTS.map(async (component) => [component.name, (await Promise.all(component.example.map(([lang, code]) => highlight(code, lang, LIGHT_THEME)))).join('')] as const),
    ),
  );
  const hookHtml = Object.fromEntries(
    await Promise.all(
      HOOKS.map(async (hook) => [hook.name, { code: await highlight(codeOf(hook), 'tsx', LIGHT_THEME), example: await highlight(exampleOf(hook.name), 'tsx', LIGHT_THEME) }] as const),
    ),
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Components and hooks</h1>
      <p className="m-0 mt-3.5 max-w-[680px] text-lg leading-[1.6] text-muted">
        Everything <code className="rounded-[5px] bg-hover px-1.5 py-0.5 font-code text-[15px] text-ink">@rebodocs/react</code> exports — four components, thirteen hooks, the functions beside them, and a way to use it without React.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <InstallCommand command="npm install @rebodocs/react" />
        <HandTip>tip: press ⌘K to jump to any prop or hook</HandTip>
      </div>

      <section aria-labelledby="pick" className="mt-16">
        <SectionHead id="pick" badge="Start here" color="blue" title="Which one do I need?">
          Pick what you want to build. The editor on the right shows which part comes from Rebodocs and which part is yours.
        </SectionHead>
        <EntryPicker code={entryCode} />
        <Callout title="Give it a height.">
          The editor and the pages fill their container and scroll themselves. Use <code className={mono}>h-full</code>, or <code className={mono}>flex-1 min-h-0</code> inside a column.
        </Callout>
      </section>

      <section aria-labelledby="components" className="mt-24">
        <SectionHead id="components" badge="4 components" color="purple" title="Components" />
        <ComponentTabs examples={componentHtml} />
      </section>

      <section aria-labelledby="hooks" className="mt-24">
        <SectionHead id="hooks" badge="13 hooks" color="green" title="Hooks">
          Use them inside a <code className="font-code text-sm">DocsProvider</code> to build your own interface. Pick one and play with it — the values on the right are what the hook returns.
        </SectionHead>
        <HooksExplorer html={hookHtml} />
      </section>

      <section aria-label="Besides the hooks" className="mt-24 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5">
        <div className="lift rounded-2xl border border-border p-6">
          <span className="inline-flex size-10 items-center justify-center rounded-[11px] bg-pastel-orange" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="#A4521C" strokeWidth="1.7" />
            </svg>
          </span>
          <h3 id="languages" className="m-0 mt-3 scroll-mt-24 font-display text-lg font-bold tracking-[-0.01em]">
            Languages and fonts
          </h3>
          <p className="m-0 mt-2.5 text-[15px] leading-[1.65] text-ink-soft">
            Not hooks, but used beside them: the language of what the library writes, and the fonts there are. See{' '}
            <a href="/docs/languages/" className="font-medium text-brand hover:text-brand-hover">
              languages
            </a>{' '}
            and{' '}
            <a href="/docs/fonts/" className="font-medium text-brand hover:text-brand-hover">
              fonts
            </a>
            .
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {LANG_FNS.map((fn) => (
              <code key={fn} className="rounded-md border border-border bg-surface px-2 py-0.75 font-code text-[12.5px]">
                {fn}
              </code>
            ))}
          </div>
        </div>
        <div className="lift rounded-2xl border border-border p-6">
          <span className="inline-flex size-10 items-center justify-center rounded-[11px] bg-pastel-blue" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4" fill="none" stroke="#0B57D0" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h3 id="versions" className="m-0 mt-3 scroll-mt-24 font-display text-lg font-bold tracking-[-0.01em]">
            Versions and assistants
          </h3>
          <p className="m-0 mt-2.5 text-[15px] leading-[1.65] text-ink-soft">
            With <code className={mono}>versions</code> on <code className={mono}>DocsEditor</code>, the side panel compares and goes back. To draw that panel yourself, or to open a DOCX as one more change of a shared room,
            use these; <code className={mono}>createAssistantChat</code> puts Claude in a chat of your own, working on the document. See{' '}
            <a href="/docs/versions/" className="font-medium text-brand hover:text-brand-hover">
              versions
            </a>{' '}
            and{' '}
            <a href="/docs/assistants/" className="font-medium text-brand hover:text-brand-hover">
              AI assistants
            </a>
            .
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {VERSION_FNS.map((fn) => (
              <code key={fn} className="rounded-md border border-border bg-surface px-2 py-0.75 font-code text-[12.5px]">
                {fn}
              </code>
            ))}
          </div>
        </div>
        <div className="lift rounded-2xl border border-border p-6">
          <span className="inline-flex size-10 items-center justify-center rounded-[11px] bg-pastel-pink" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" fill="none" stroke="#A23A5E" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h3 id="without-react" className="m-0 mt-3 scroll-mt-24 font-display text-lg font-bold tracking-[-0.01em]">
            Without React
          </h3>
          <p className="m-0 mt-2.5 text-[15px] leading-[1.65] text-ink-soft">
            <code className={mono}>mountDocs</code> (from <code className={mono}>@rebodocs/react/mount</code>) puts the whole editor in an element and gives back a handle with{' '}
            <code className={mono}>destroy()</code>. <code className={mono}>createDocs</code> puts only the pages, with <code className={mono}>state()</code>, <code className={mono}>commands</code>,{' '}
            <code className={mono}>editor</code>, <code className={mono}>subscribe(fn)</code> and <code className={mono}>setKeys</code>.
          </p>
          <a href="/docs/vanilla/" className="mt-2.5 inline-block text-sm font-semibold text-brand hover:text-brand-hover">
            Without a framework →
          </a>
        </div>
      </section>
    </>
  );
}
