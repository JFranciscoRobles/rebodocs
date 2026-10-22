'use client';

// The demo of the repository (`apps/demo`), on the site: the same two
// components, taken from where they are written, so that what is shown here
// is what there is to copy. Neither is drawn on the server: they are loaded
// in the browser, where the editor has something to measure with.
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getLocale, setLocale } from '@rebodocs/react';
import { useEffect, useRef, useState } from 'react';

const loading = () => <p className="grid h-full place-items-center text-sm text-muted">Opening the editor…</p>;
const FullEditor = dynamic(() => import('../../demo/src/FullEditor').then((m) => m.FullEditor), { ssr: false, loading });
const HeadlessEditor = dynamic(() => import('../../demo/src/HeadlessEditor').then((m) => m.HeadlessEditor), { ssr: false, loading });

const TABS = [
  { id: 'headless', label: 'Your own interface', short: 'Your own', note: 'Built on the hooks: DocsProvider, DocsSurface, DocsRuler, useDocs…', dot: 'bg-pastel-purple-fg' },
  { id: 'full', label: 'The included one', short: 'Included', note: 'DocsEditor as it comes: two rows of tools, the panel on the right, the zoom floating, ☰ a screen of its own.', dot: 'bg-brand' },
  { id: 'screen', label: 'Another layout', short: 'Another', note: "features={{ toolbar: 'tabs', panel: 'rail', statusBar: 'chips', menu: 'card' }}", dot: 'bg-pastel-pink-fg' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function DemoApp() {
  const [tab, setTab] = useState<Tab>('headless');
  const [docx, setDocx] = useState<Uint8Array>();
  const [name, setName] = useState('agreement.docx');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const asked = TABS.find((t) => `#${t.id}` === window.location.hash);
    if (asked) setTab(asked.id);
    // In English to begin with, as the demo of the repository; the selector in its status bar changes it.
    const was = getLocale();
    setLocale('en');
    let gone = false;
    fetch('/sample.docx')
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setDocx((now) => now ?? new Uint8Array(bytes)))
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
      setLocale(was);
    };
  }, []);

  const picker = useRef<HTMLInputElement>(null);
  const open = async (file: File | undefined) => {
    if (!file) return;
    setDocx(new Uint8Array(await file.arrayBuffer()));
    setName(file.name);
  };
  const choose = (next: Tab) => {
    setTab(next);
    // The address says which one is shown, to send it to someone.
    history.replaceState(null, '', next === 'headless' ? window.location.pathname : `#${next}`);
  };
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="flex h-dvh min-h-[560px] flex-col bg-surface text-ink">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-white px-3 py-2 sm:px-4">
        <Link href="/" title="Back to the site" className="flex items-center gap-2 rounded-lg py-1 pr-1 font-display text-[17px] font-bold tracking-tight text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={24} height={24} />
          <span className="hidden sm:inline">Rebodocs</span>
          <span className="rounded-md bg-hover px-1.5 py-0.5 font-text text-xs font-semibold text-ink-soft">Demo</span>
        </Link>

        {/* Two tabs, as a segmented control: the arrows move between them. */}
        <div
          role="tablist"
          aria-label="Which editor"
          className="order-3 flex w-full rounded-xl bg-surface p-1 sm:order-none sm:w-auto"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const step = event.key === 'ArrowRight' ? 1 : TABS.length - 1;
            const next = TABS[(TABS.findIndex((t) => t.id === tab) + step) % TABS.length].id;
            choose(next);
            document.getElementById(`demo-tab-${next}`)?.focus();
          }}
        >
          {TABS.map(({ id, label, short, dot }) => (
            <button
              key={id}
              id={`demo-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              aria-controls="demo-panel"
              tabIndex={tab === id ? 0 : -1}
              onClick={() => choose(id)}
              className={`flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors pointer-coarse:min-h-11 sm:flex-none ${
                tab === id ? 'bg-white text-ink shadow-[0_1px_3px_rgba(47,46,43,0.14)]' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <span aria-hidden="true" className={`size-2 rounded-full ${tab === id ? dot : 'bg-border-strong'}`} />
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <p className="hidden min-w-0 flex-1 truncate text-sm text-muted lg:block">{current.note}</p>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/docs/getting-started/" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-hover hover:text-ink md:block">
            Docs
          </Link>
          <button
            type="button"
            onClick={() => picker.current?.click()}
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover pointer-coarse:min-h-11"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 10.5V2.5M4.5 6L8 2.5 11.5 6M3 10v3h10v-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Open a .docx
          </button>
          <input ref={picker} type="file" accept=".docx" hidden onChange={(e) => void open(e.target.files?.[0])} />
        </div>
      </header>
      <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${tab}`} className="min-h-0 flex-1">
        {docx ? (
          tab === 'headless' ? <HeadlessEditor docx={docx} name={name} /> : <FullEditor key={tab} docx={docx} name={name} layout={tab === 'screen' ? 'another' : 'included'} />
        ) : (
          <p className="grid h-full place-items-center text-sm text-muted">{failed ? 'The sample document could not be loaded.' : 'Opening the document…'}</p>
        )}
      </div>
    </div>
  );
}
