'use client';

// The demo of the repository (`apps/demo`), on the site: the same two
// components, taken from where they are written, so that what is shown here
// is what there is to copy. Neither is drawn on the server: they are loaded
// in the browser, where the editor has something to measure with.
import dynamic from 'next/dynamic';
import { getLocale, setLocale } from '@rebodocs/react';
import { useEffect, useRef, useState } from 'react';
import { useEditorLocale } from './editorLocale';
import { LocalLink as Link, useT } from './i18n';

function Loading() {
  const t = useT();
  return <p className="grid h-full place-items-center text-sm text-muted">{t({ en: 'Opening the editor…', es: 'Abriendo el editor…', zh: '正在打开编辑器…' })}</p>;
}
const loading = () => <Loading />;
const FullEditor = dynamic(() => import('../../demo/src/FullEditor').then((m) => m.FullEditor), { ssr: false, loading });
const HeadlessEditor = dynamic(() => import('../../demo/src/HeadlessEditor').then((m) => m.HeadlessEditor), { ssr: false, loading });
const DemoViewer = dynamic(() => import('./DemoViewer').then((m) => m.DemoViewer), { ssr: false, loading });

const TABS = [
  {
    id: 'headless',
    label: { en: 'Your own interface', es: 'Tu propia interfaz', zh: '你自己的界面' },
    short: { en: 'Your own', es: 'Propia', zh: '自定义' },
    note: {
      en: 'Built on the hooks: DocsProvider, DocsSurface, DocsRuler, useDocs…',
      es: 'Construida con los hooks: DocsProvider, DocsSurface, DocsRuler, useDocs…',
      zh: '基于 hooks 构建：DocsProvider、DocsSurface、DocsRuler、useDocs…',
    },
    dot: 'bg-pastel-purple-fg',
  },
  {
    id: 'full',
    label: { en: 'The included one', es: 'La incluida', zh: '自带的界面' },
    short: { en: 'Included', es: 'Incluida', zh: '自带' },
    note: {
      en: 'DocsEditor as it comes: two rows of tools, the panel on the right, the zoom floating, ☰ a screen of its own.',
      es: 'DocsEditor tal como viene: dos filas de herramientas, el panel a la derecha, el zoom flotando, ☰ una pantalla propia.',
      zh: '开箱即用的 DocsEditor：两行工具栏、右侧面板、浮动的缩放控件，☰ 打开独立的界面。',
    },
    dot: 'bg-brand',
  },
  {
    id: 'screen',
    label: { en: 'Another layout', es: 'Otra disposición', zh: '另一种布局' },
    short: { en: 'Another', es: 'Otra', zh: '其他' },
    note: {
      en: "features={{ toolbar: 'tabs', panel: 'rail', statusBar: 'chips', menu: 'card' }}",
      es: "features={{ toolbar: 'tabs', panel: 'rail', statusBar: 'chips', menu: 'card' }}",
      zh: "features={{ toolbar: 'tabs', panel: 'rail', statusBar: 'chips', menu: 'card' }}",
    },
    dot: 'bg-pastel-pink-fg',
  },
  {
    id: 'viewer',
    label: { en: 'Only to read', es: 'Solo lectura', zh: '只读' },
    short: { en: 'Viewer', es: 'Visor', zh: '查看器' },
    note: {
      en: 'DocsViewer of @rebodocs/viewer: the pages and their bar, nothing to edit.',
      es: 'DocsViewer de @rebodocs/viewer: las páginas y su barra, nada que editar.',
      zh: '@rebodocs/viewer 的 DocsViewer：只有页面和它的工具栏，不能编辑。',
    },
    dot: 'bg-pastel-green-fg',
  },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function DemoApp() {
  const [tab, setTab] = useState<Tab>('headless');
  const [docx, setDocx] = useState<Uint8Array>();
  const [name, setName] = useState('agreement.docx');
  const [failed, setFailed] = useState(false);
  const t = useT();
  const editorLocale = useEditorLocale();

  useEffect(() => {
    const asked = TABS.find((t) => `#${t.id}` === window.location.hash);
    if (asked) setTab(asked.id);
    // In the language of the page to begin with; the selector in its status bar changes it.
    const was = getLocale();
    setLocale(editorLocale);
    let gone = false;
    fetch('/sample.docx')
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setDocx((now) => now ?? new Uint8Array(bytes)))
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
      setLocale(was);
    };
  }, [editorLocale]);

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
        <Link
          href="/"
          title={t({ en: 'Back to the site', es: 'Volver al sitio', zh: '返回网站' })}
          className="flex items-center gap-2 rounded-lg py-1 pr-1 font-display text-[17px] font-bold tracking-tight text-ink"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" width={24} height={24} />
          <span className="hidden sm:inline">Rebodocs</span>
          <span className="rounded-md bg-hover px-1.5 py-0.5 font-text text-xs font-semibold text-ink-soft">{t({ en: 'Demo', es: 'Demo', zh: '演示' })}</span>
        </Link>

        {/* The tabs, as a segmented control: the arrows move between them. */}
        <div
          role="tablist"
          aria-label={t({ en: 'Which editor', es: 'Qué editor', zh: '选择编辑器' })}
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
              <span className="sm:hidden">{t(short)}</span>
              <span className="hidden sm:inline">{t(label)}</span>
            </button>
          ))}
        </div>

        <p className="hidden min-w-0 flex-1 truncate text-sm text-muted lg:block">{t(current.note)}</p>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/docs/getting-started/" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-hover hover:text-ink md:block">
            {t({ en: 'Docs', es: 'Documentación', zh: '文档' })}
          </Link>
          <button
            type="button"
            onClick={() => picker.current?.click()}
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover pointer-coarse:min-h-11"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 10.5V2.5M4.5 6L8 2.5 11.5 6M3 10v3h10v-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t({ en: 'Open a .docx', es: 'Abrir un .docx', zh: '打开 .docx' })}
          </button>
          <input ref={picker} type="file" accept=".docx" hidden onChange={(e) => void open(e.target.files?.[0])} />
        </div>
      </header>
      <div id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${tab}`} className="min-h-0 flex-1">
        {docx ? (
          tab === 'headless' ? (
            <HeadlessEditor docx={docx} name={name} />
          ) : tab === 'viewer' ? (
            <DemoViewer docx={docx} locale={editorLocale} />
          ) : (
            <FullEditor key={tab} docx={docx} name={name} layout={tab === 'screen' ? 'another' : 'included'} />
          )
        ) : (
          <p className="grid h-full place-items-center text-sm text-muted">
            {failed
              ? t({ en: 'The sample document could not be loaded.', es: 'No se pudo cargar el documento de ejemplo.', zh: '无法载入示例文档。' })
              : t({ en: 'Opening the document…', es: 'Abriendo el documento…', zh: '正在打开文档…' })}
          </p>
        )}
      </div>
    </div>
  );
}
