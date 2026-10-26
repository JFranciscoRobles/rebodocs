import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { getT } from '@/lib/locale';
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
  const t = getT();
  const link = 'font-medium text-brand hover:text-brand-hover';
  const entryCode = await Promise.all(ENTRIES.map((entry) => highlight(entry.code, 'tsx', LIGHT_THEME)));
  const componentHtml = Object.fromEntries(
    await Promise.all(COMPONENTS.map(async (component) => [component.name, (await Promise.all(component.example.map(([lang, code]) => highlight(code, lang, LIGHT_THEME)))).join('')] as const)),
  );
  const hookHtml = Object.fromEntries(
    await Promise.all(HOOKS.map(async (hook) => [hook.name, { code: await highlight(codeOf(hook), 'tsx', LIGHT_THEME), example: await highlight(exampleOf(hook.name), 'tsx', LIGHT_THEME) }] as const)),
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {t({ en: 'Components and hooks', es: 'Componentes y hooks', zh: '组件与 Hooks' })}
      </h1>
      <p className="m-0 mt-3.5 max-w-[680px] text-lg leading-[1.6] text-muted">
        {t({ en: 'Everything ', es: 'Todo lo que exporta ', zh: '' })}
        <code className="rounded-[5px] bg-hover px-1.5 py-0.5 font-code text-[15px] text-ink">@rebodocs/react</code>
        {t({
          en: ' exports — four components, thirteen hooks, the functions beside them, and a way to use it without React.',
          es: ': cuatro componentes, trece hooks, las funciones que los acompañan, y una forma de usarlo sin React.',
          zh: ' 导出的全部内容：四个组件、十三个 hooks、配套的函数，以及不用 React 的使用方式。',
        })}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <InstallCommand command="npm install @rebodocs/react" />
        <HandTip>{t({ en: 'tip: press ⌘K to jump to any prop or hook', es: 'tip: pulsa ⌘K para saltar a cualquier prop o hook', zh: '提示：按 ⌘K 跳到任意属性或 hook' })}</HandTip>
      </div>

      <section aria-labelledby="pick" className="mt-16">
        <SectionHead
          id="pick"
          badge={t({ en: 'Start here', es: 'Empieza aquí', zh: '从这里开始' })}
          color="blue"
          title={t({ en: 'Which one do I need?', es: '¿Cuál necesito?', zh: '我需要哪一个？' })}
        >
          {t({
            en: 'Pick what you want to build. The editor on the right shows which part comes from Rebodocs and which part is yours.',
            es: 'Elige lo que quieres construir. El editor de la derecha muestra qué parte viene de Rebodocs y qué parte es tuya.',
            zh: '选择你要构建的东西。右侧的编辑器示意图显示了哪些部分由 Rebodocs 提供、哪些由你实现。',
          })}
        </SectionHead>
        <EntryPicker code={entryCode} />
        <Callout title={t({ en: 'Give it a height.', es: 'Dale una altura.', zh: '给它一个高度。' })}>
          {t({
            en: (
              <>
                The editor and the pages fill their container and scroll themselves. Use <code className={mono}>h-full</code>, or <code className={mono}>flex-1 min-h-0</code> inside a column.
              </>
            ),
            es: (
              <>
                El editor y las páginas llenan su contenedor y se desplazan solos. Usa <code className={mono}>h-full</code>, o <code className={mono}>flex-1 min-h-0</code> dentro de una columna.
              </>
            ),
            zh: (
              <>
                编辑器和页面会填满容器并自带滚动。使用 <code className={mono}>h-full</code>，或在纵向布局中使用 <code className={mono}>flex-1 min-h-0</code>。
              </>
            ),
          })}
        </Callout>
      </section>

      <section aria-labelledby="components" className="mt-24">
        <SectionHead id="components" badge={t({ en: '4 components', es: '4 componentes', zh: '4 个组件' })} color="purple" title={t({ en: 'Components', es: 'Componentes', zh: '组件' })} />
        <ComponentTabs examples={componentHtml} />
      </section>

      <section aria-labelledby="hooks" className="mt-24">
        <SectionHead id="hooks" badge={t({ en: '13 hooks', es: '13 hooks', zh: '13 个 hooks' })} color="green" title="Hooks">
          {t({
            en: (
              <>
                Use them inside a <code className="font-code text-sm">DocsProvider</code> to build your own interface. Pick one and play with it — the values on the right are what the hook returns.
              </>
            ),
            es: (
              <>
                Úsalos dentro de un <code className="font-code text-sm">DocsProvider</code> para construir tu propia interfaz. Elige uno y juega con él: los valores de la derecha son lo que devuelve
                el hook.
              </>
            ),
            zh: (
              <>
                在 <code className="font-code text-sm">DocsProvider</code> 内使用它们来构建你自己的界面。选一个试试看——右侧的值就是 hook 的返回值。
              </>
            ),
          })}
        </SectionHead>
        <HooksExplorer html={hookHtml} />
      </section>

      <section aria-label={t({ en: 'Besides the hooks', es: 'Además de los hooks', zh: 'hooks 之外' })} className="mt-24 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-5">
        <div className="lift rounded-2xl border border-border p-6">
          <span className="inline-flex size-10 items-center justify-center rounded-[11px] bg-pastel-orange" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="#A4521C" strokeWidth="1.7" />
            </svg>
          </span>
          <h3 id="languages" className="m-0 mt-3 scroll-mt-24 font-display text-lg font-bold tracking-[-0.01em]">
            {t({ en: 'Languages and fonts', es: 'Idiomas y fuentes', zh: '语言与字体' })}
          </h3>
          <p className="m-0 mt-2.5 text-[15px] leading-[1.65] text-ink-soft">
            {t({
              en: 'Not hooks, but used beside them: the language of what the library writes, and the fonts there are. See ',
              es: 'No son hooks, pero se usan junto a ellos: el idioma de lo que escribe la biblioteca, y las fuentes que hay. Ve ',
              zh: '它们不是 hooks，但常与 hooks 配合使用：库所输出文字的语言，以及可用的字体。参见',
            })}
            <LocalLink href="/docs/languages/" className={link}>
              {t({ en: 'languages', es: 'idiomas', zh: '语言' })}
            </LocalLink>
            {t({ en: ' and ', es: ' y ', zh: '和' })}
            <LocalLink href="/docs/fonts/" className={link}>
              {t({ en: 'fonts', es: 'fuentes', zh: '字体' })}
            </LocalLink>
            {t({ en: '.', es: '.', zh: '。' })}
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
            {t({ en: 'Versions and assistants', es: 'Versiones y asistentes', zh: '版本与助手' })}
          </h3>
          <p className="m-0 mt-2.5 text-[15px] leading-[1.65] text-ink-soft">
            {t({
              en: (
                <>
                  With <code className={mono}>versions</code> on <code className={mono}>DocsEditor</code>, the side panel compares and goes back. To draw that panel yourself, or to open a DOCX as one
                  more change of a shared room, use these; <code className={mono}>createAssistantChat</code> puts Claude in a chat of your own, working on the document. See{' '}
                </>
              ),
              es: (
                <>
                  Con <code className={mono}>versions</code> en <code className={mono}>DocsEditor</code>, el panel lateral compara y regresa. Para dibujar ese panel tú mismo, o para abrir un DOCX como
                  un cambio más de una sala compartida, usa estas; <code className={mono}>createAssistantChat</code> pone a Claude en un chat propio, trabajando sobre el documento. Ve{' '}
                </>
              ),
              zh: (
                <>
                  在 <code className={mono}>DocsEditor</code> 上提供 <code className={mono}>versions</code> 后，侧边栏可以对比和还原版本。如果要自己绘制这个面板，或把一个 DOCX
                  作为共享房间中的一次普通修改打开，请使用这些函数；
                  <code className={mono}>createAssistantChat</code> 则会把 Claude 放进你自己的聊天中处理文档。参见
                </>
              ),
            })}
            <LocalLink href="/docs/versions/" className={link}>
              {t({ en: 'versions', es: 'versiones', zh: '版本' })}
            </LocalLink>
            {t({ en: ' and ', es: ' y ', zh: '和' })}
            <LocalLink href="/docs/assistants/" className={link}>
              {t({ en: 'AI assistants', es: 'asistentes de IA', zh: 'AI 助手' })}
            </LocalLink>
            {t({ en: '.', es: '.', zh: '。' })}
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
            {t({ en: 'Without React', es: 'Sin React', zh: '不用 React' })}
          </h3>
          <p className="m-0 mt-2.5 text-[15px] leading-[1.65] text-ink-soft">
            {t({
              en: (
                <>
                  <code className={mono}>mountDocs</code> (from <code className={mono}>@rebodocs/react/mount</code>) puts the whole editor in an element and gives back a handle with{' '}
                  <code className={mono}>destroy()</code>. <code className={mono}>createDocs</code> puts only the pages, with <code className={mono}>state()</code>,{' '}
                  <code className={mono}>commands</code>, <code className={mono}>editor</code>, <code className={mono}>subscribe(fn)</code> and <code className={mono}>setKeys</code>.
                </>
              ),
              es: (
                <>
                  <code className={mono}>mountDocs</code> (de <code className={mono}>@rebodocs/react/mount</code>) pone el editor completo en un elemento y devuelve un handle con{' '}
                  <code className={mono}>destroy()</code>. <code className={mono}>createDocs</code> pone solo las páginas, con <code className={mono}>state()</code>,{' '}
                  <code className={mono}>commands</code>, <code className={mono}>editor</code>, <code className={mono}>subscribe(fn)</code> y <code className={mono}>setKeys</code>.
                </>
              ),
              zh: (
                <>
                  <code className={mono}>mountDocs</code>（来自 <code className={mono}>@rebodocs/react/mount</code>）会把完整编辑器放进一个元素，并返回带有 <code className={mono}>destroy()</code>{' '}
                  的句柄。<code className={mono}>createDocs</code> 只放入页面，提供 <code className={mono}>state()</code>、<code className={mono}>commands</code>、<code className={mono}>editor</code>
                  、<code className={mono}>subscribe(fn)</code> 和 <code className={mono}>setKeys</code>。
                </>
              ),
            })}
          </p>
          <LocalLink href="/docs/vanilla/" className="mt-2.5 inline-block text-sm font-semibold text-brand hover:text-brand-hover">
            {t({ en: 'Without a framework →', es: 'Sin framework →', zh: '不用框架 →' })}
          </LocalLink>
        </div>
      </section>
    </>
  );
}
