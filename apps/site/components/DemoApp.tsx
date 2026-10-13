'use client';

// The demo of the repository (`apps/demo`), on the site: the same two
// components, taken from where they are written, so that what is shown here
// is what there is to copy. Neither is drawn on the server: they are loaded
// in the browser, where the editor has something to measure with.
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const loading = () => <p className="grid h-full place-items-center text-sm text-muted">Opening the editor…</p>;
const FullEditor = dynamic(() => import('../../demo/src/FullEditor').then((m) => m.FullEditor), { ssr: false, loading });
const HeadlessEditor = dynamic(() => import('../../demo/src/HeadlessEditor').then((m) => m.HeadlessEditor), { ssr: false, loading });

const TABS = [
  { id: 'headless', label: 'Your own interface', note: 'Built on the hooks: DocsProvider, DocsSurface, DocsRuler, useDocs…' },
  { id: 'full', label: 'The included one', note: 'One component: DocsEditor.' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function DemoApp() {
  const [tab, setTab] = useState<Tab>('headless');
  const [docx, setDocx] = useState<Uint8Array>();
  const [name, setName] = useState('contrato.docx');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (window.location.hash === '#full') setTab('full');
    let gone = false;
    fetch('/sample.docx')
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setDocx((now) => now ?? new Uint8Array(bytes)))
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
    };
  }, []);

  const open = async (file: File | undefined) => {
    if (!file) return;
    setDocx(new Uint8Array(await file.arrayBuffer()));
    setName(file.name);
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-[560px] flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-soft px-4 py-2 text-sm">
        <div className="flex gap-1" role="tablist">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 font-medium ${tab === id ? 'bg-brand text-white' : 'text-muted hover:bg-white hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="hidden min-w-0 flex-1 truncate text-muted md:block">{TABS.find((t) => t.id === tab)?.note}</p>
        <label className="ml-auto cursor-pointer rounded-full border border-line bg-white px-3.5 py-1.5 font-medium hover:border-brand">
          Open a .docx
          <input type="file" accept=".docx" hidden onChange={(e) => void open(e.target.files?.[0])} />
        </label>
      </div>
      <div className="min-h-0 flex-1">
        {docx ? (
          tab === 'full' ? <FullEditor docx={docx} name={name} /> : <HeadlessEditor docx={docx} name={name} />
        ) : (
          <p className="grid h-full place-items-center text-sm text-muted">{failed ? 'The sample document could not be loaded.' : 'Opening the document…'}</p>
        )}
      </div>
    </div>
  );
}
