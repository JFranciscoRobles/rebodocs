'use client';

import dynamic from 'next/dynamic';
import { Loading } from '@/components/docs/Loading';
import { useT } from '@/components/i18n';
import { useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { FILE_TOOLS, NEEDS_A_FILE, TOOL_GROUPS } from './data';
import type { ParamDoc, ToolDoc } from './types';

/** The editor and the tools come when the page is in the browser. */
export const LazyRunner = dynamic(() => import('./Runner'), {
  ssr: false,
  loading: () => <Loading className="m-0 mt-7 grid h-[620px] place-items-center rounded-[18px] border border-border text-sm text-muted" />,
});

// Where Runner listens, written again so the list does not load the editor.
const TRY_EVENT = 'assistants-try';

const badge = 'rounded-full px-2 py-0.5 text-[11px] font-semibold';

function Params({ params }: { params: ParamDoc[] }) {
  const t = useT();
  if (!params.length) return <p className="m-0 mt-2 text-[13px] text-muted">{t({ en: 'No arguments.', es: 'Sin argumentos.', zh: '没有参数。' })}</p>;
  return (
    <dl className="m-0 mt-2.5 grid grid-cols-[minmax(0,max-content)_1fr] gap-x-4 gap-y-1.5">
      {params.map((p) => (
        <div key={p.name} className="contents">
          <dt className="font-code text-[13px] whitespace-nowrap">
            <span className="font-semibold text-ink">{p.name}</span>
            {p.required ? '' : <span className="text-muted">?</span>} <span className="text-pastel-purple-fg">{p.enum ? 'enum' : p.type}</span>
          </dt>
          <dd className="m-0 text-[14px] leading-normal text-ink-soft">
            {p.description}
            {p.enum && <span className="mt-0.5 block font-code text-[12px] text-muted">{p.enum.map((v) => `'${v}'`).join(' · ')}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Row({ tool, server = false }: { tool: ToolDoc; server?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const file = server || NEEDS_A_FILE.has(tool.name);
  return (
    <div id={`tool-${tool.name}`} className="scroll-mt-32 border-t border-[#f0eee9] py-3.5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <a href={`#tool-${tool.name}`} className="font-code text-[14px] font-semibold text-ink hover:text-brand">
          {tool.name}
        </a>
        {!server && (
          <span className={`${badge} ${tool.writes ? 'bg-pastel-yellow text-pastel-yellow-fg' : 'bg-pastel-green text-pastel-green-fg'}`}>
            {tool.writes ? t({ en: 'changes', es: 'cambia', zh: '修改' }) : t({ en: 'reads', es: 'lee', zh: '只读' })}
          </span>
        )}
        {tool.areas && <span className={`${badge} bg-hover text-muted`}>{t({ en: 'header, footer, notes too', es: 'también encabezado, pie, notas', zh: '也适用于页眉、页脚、脚注' })}</span>}
        {file && !server && <span className={`${badge} bg-hover text-muted`}>{t({ en: 'server only: reads a file', es: 'solo el servidor: lee un archivo', zh: '仅限服务器：需读取文件' })}</span>}
        <span className="ml-auto flex gap-1.5">
          {tool.params.length > 0 && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="cursor-pointer rounded-full border border-border bg-white px-2.5 py-0.5 text-xs text-ink-soft hover:bg-hover"
            >
              {open ? t({ en: 'Hide', es: 'Ocultar', zh: '隐藏' }) : t({ en: 'Arguments', es: 'Argumentos', zh: '参数' })} ({tool.params.length})
            </button>
          )}
          {!file && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(TRY_EVENT, { detail: tool.name }))}
              className="cursor-pointer rounded-full border-0 bg-pastel-blue px-2.5 py-0.5 text-xs font-semibold text-pastel-blue-fg hover:brightness-95"
            >
              {t({ en: 'Try it ↑', es: 'Pruébalo ↑', zh: '试一试 ↑' })}
            </button>
          )}
        </span>
      </div>
      <p className="m-0 mt-1 max-w-[860px] text-[15px] leading-[1.6] text-ink-soft">{tool.description}</p>
      {open && <Params params={tool.params} />}
    </div>
  );
}

/** Every tool, by what it is for, with what the server tells the assistant about each. */
export function ToolsReference({ tools }: { tools: ToolDoc[] }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (text: string) => words.every((word) => text.toLowerCase().includes(word));
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  const files = FILE_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    writes: false,
    areas: false,
    params: tool.params.map(([name, type, required, description]) => ({ name, type, required, description })),
  }));
  const groups = [
    {
      id: 'files',
      title: t({ en: 'Files', es: 'Archivos', zh: '文件' }),
      color: 'green' as const,
      list: files,
      note: t({
        en: 'The server’s own: a chat in your application has no files, so it has none of these.',
        es: 'Propias del servidor: un chat en tu aplicación no tiene archivos, así que no tiene ninguna de estas.',
        zh: '服务器独有：你的应用中的聊天没有文件，因此没有这些工具。',
      }),
    },
    ...TOOL_GROUPS.map((group) => ({ ...group, title: t(group.title), list: group.tools.map((name) => byName.get(name)!), note: undefined })),
  ]
    .map((group) => ({ ...group, list: group.list.filter((tool) => hit(`${tool.name} ${tool.description} ${tool.params.map((p) => p.name).join(' ')}`)) }))
    .filter((group) => group.list.length);
  const total = tools.length + FILE_TOOLS.length;

  return (
    <>
      <div className="sticky top-[61px] z-10 mt-7 flex flex-wrap items-center gap-2 border-b border-border bg-white/95 py-3 backdrop-blur">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t({ en: `Filter the ${total} tools: table, note, page…`, es: `Filtra las ${total} herramientas: table, note, page…`, zh: `筛选 ${total} 个工具：table、note、page…` })}
          aria-label={t({ en: 'Filter the tools', es: 'Filtrar las herramientas', zh: '筛选工具' })}
          className="h-9 w-[min(100%,300px)] rounded-lg border border-border-strong bg-white px-3 text-sm text-ink"
        />
        <nav aria-label={t({ en: 'Groups', es: 'Grupos', zh: '分组' })} className="flex flex-wrap gap-1.5">
          {groups.map((group) => (
            <a key={group.id} href={`#tools-${group.id}`} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PASTEL_CLASS[group.color]} hover:brightness-95`}>
              {group.title} <span>{group.list.length}</span>
            </a>
          ))}
        </nav>
      </div>
      {!groups.length && (
        <p className="m-0 mt-8 text-[15px] text-muted">{t({ en: `No tool matches “${query}”.`, es: `Ninguna herramienta coincide con “${query}”.`, zh: `没有与“${query}”匹配的工具。` })}</p>
      )}
      <div className="mt-4 flex flex-col gap-10">
        {groups.map((group) => (
          <div key={group.id}>
            <h3 id={`tools-${group.id}`} className="m-0 flex scroll-mt-32 items-center gap-2.5 font-display text-xl font-bold tracking-[-0.01em]">
              <span className={`size-2.5 rounded-full ${PASTEL_CLASS[group.color]}`} aria-hidden="true" />
              {group.title}
            </h3>
            {group.note && <p className="m-0 mt-1.5 text-[15px] text-muted">{group.note}</p>}
            <div className="mt-2 rounded-2xl border border-border px-5">
              {group.list.map((tool) => (
                <Row key={tool.name} tool={tool} server={group.id === 'files'} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
