'use client';

import { useState } from 'react';
import { LocalLink, useT } from '@/components/i18n';
import { CssVarsPlayground } from './CssVarsPlayground';
import { roving, useHash, useUntilFound } from './keys';
import { PropsTable } from './PropsTable';
import { COMPONENTS, type ComponentDoc, EDITOR_ADDS, EDITOR_HANDLE, PROPS } from './reference';

const card = 'flex-[1_1_300px] rounded-[14px] border border-border px-5.5 py-5';
const caption = 'm-0 text-xs font-semibold tracking-[0.04em] text-muted';
const code = '[&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-[10px] [&_pre]:bg-surface! [&_pre]:px-5 [&_pre]:py-4 [&_pre]:font-code [&_pre]:text-[13.5px] [&_pre]:leading-[1.7] [&_pre+pre]:mt-2';

/**
 * The four components, one at a time. `#component-DocsRuler` opens that one,
 * and `#prop-docx` opens DocsProvider with that prop lit up. Every panel is on
 * the page, the ones not chosen `hidden="until-found"`, as the hooks' are.
 */
export function ComponentTabs({ examples }: { examples: Record<string, string> }) {
  const [chosen, setChosen] = useState(1);
  const [target, setTarget] = useState<{ name: string; at: number }>();
  const [theme, setTheme] = useState(0);
  const t = useT();

  useHash((hash) => {
    const tab = COMPONENTS.findIndex((c) => `component-${c.name}` === hash);
    if (tab >= 0) return setChosen(tab);
    const prop = PROPS.find((p) => `prop-${p.name}` === hash);
    if (!prop) return;
    setChosen(1);
    // A new object each time, so going to the same prop again lights it up again.
    setTarget({ name: prop.name, at: Date.now() });
  });

  return (
    <>
      <div
        role="tablist"
        aria-label={t({ en: 'Components', es: 'Componentes', zh: '组件' })}
        className="mt-6 flex flex-wrap gap-1.5 border-b border-border pb-2.5"
        onKeyDown={(event) => roving(event, setChosen)}
      >
        {COMPONENTS.map((c, i) => {
          const on = i === chosen;
          return (
            <button
              key={c.name}
              id={`component-${c.name}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`component-panel-${c.name}`}
              tabIndex={on ? 0 : -1}
              onClick={() => setChosen(i)}
              className={`cursor-pointer scroll-mt-24 rounded-[9px] border px-3 py-2 font-code text-sm font-medium transition-colors ${on ? 'border-[#d9ccee] bg-pastel-purple text-pastel-purple-fg' : 'border-border bg-white text-ink-soft hover:bg-hover'}`}
            >
              &lt;{c.name} /&gt;
            </button>
          );
        })}
      </div>

      {COMPONENTS.map((component, i) => (
        <Panel key={component.name} component={component} on={i === chosen} onFound={() => setChosen(i)} example={examples[component.name]}>
          {component.name === 'DocsEditor' && (
            <div className="mt-7 flex flex-wrap gap-5">
              <div className={card}>
                <p className={caption}>{t({ en: 'ADDS THESE PROPS', es: 'AGREGA ESTAS PROPS', zh: '新增的属性' })}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {EDITOR_ADDS.map((name) => (
                    <code key={name} className="rounded-md bg-pastel-purple px-2 py-0.75 font-code text-[13px] text-pastel-purple-fg">
                      {name}
                    </code>
                  ))}
                </div>
                <p className="mt-3.5 text-[15px] leading-[1.6] text-muted">
                  {t({ en: 'Plus every ', es: 'Además de cada prop de ', zh: '此外还接受 ' })}
                  <button type="button" onClick={() => setChosen(1)} className="cursor-pointer border-0 bg-transparent p-0 font-medium text-brand hover:text-brand-hover">
                    DocsProvider
                  </button>
                  {t({
                    en: (
                      <>
                        {' '}
                        prop except <code className="font-code text-[12.5px]">bubble</code>, <code className="font-code text-[12.5px]">onLinkKey</code> and{' '}
                        <code className="font-code text-[12.5px]">onFindKey</code>: it answers those itself. Changing features, versions or whether there is an onSave makes it again with the document
                        as it is, unsaved changes and all; another docx or room opens that one.{' '}
                      </>
                    ),
                    es: (
                      <>
                        {' '}
                        salvo <code className="font-code text-[12.5px]">bubble</code>, <code className="font-code text-[12.5px]">onLinkKey</code> y{' '}
                        <code className="font-code text-[12.5px]">onFindKey</code>: esas las responde él mismo. Cambiar features, versions o si hay un onSave lo vuelve a crear con el documento tal
                        como está, cambios sin guardar incluidos; otro docx u otra sala abre ese.{' '}
                      </>
                    ),
                    zh: (
                      <>
                        {' '}
                        的全部属性，但 <code className="font-code text-[12.5px]">bubble</code>、<code className="font-code text-[12.5px]">onLinkKey</code> 和{' '}
                        <code className="font-code text-[12.5px]">onFindKey</code> 除外：这些由它自己处理。修改 features、versions 或是否提供
                        onSave，会用当前文档（包括未保存的修改）重新创建编辑器；传入另一个 docx 或房间则会打开它。
                      </>
                    ),
                  })}
                  <LocalLink href="/docs/react/#features" className="font-medium text-brand hover:text-brand-hover">
                    {t({ en: 'What features switches', es: 'Qué enciende features', zh: 'features 能开关什么' })}
                  </LocalLink>
                  {t({ en: '.', es: '.', zh: '。' })}
                </p>
              </div>
              <div className={card}>
                <p className={caption}>{t({ en: 'THE HANDLE (ref / onReady)', es: 'EL HANDLE (ref / onReady)', zh: '句柄（ref / onReady）' })}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {EDITOR_HANDLE.map((name) => (
                    <code key={name} className="rounded-md bg-pastel-blue px-2 py-0.75 font-code text-[13px] text-pastel-blue-fg">
                      {name}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          )}

          {component.name === 'DocsProvider' && <PropsTable target={target} />}

          {component.tips && (
            <>
              <CssVarsPlayground ruler={component.name === 'DocsRuler'} theme={theme} setTheme={setTheme} />
              <ul className="mt-5 list-disc pl-5 text-base leading-[1.7] text-ink-soft">
                {component.tips.map((tip) => (
                  <li key={tip.en}>{t(tip)}</li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      ))}
    </>
  );
}

/** One component's panel: its summary and facts, what is particular to it, and an example to copy. */
function Panel({ component, on, onFound, example, children }: { component: ComponentDoc; on: boolean; onFound: () => void; example: string; children: React.ReactNode }) {
  const box = useUntilFound(on, onFound);
  const t = useT();

  return (
    <div ref={box} hidden={!on}>
      <div role="tabpanel" id={`component-panel-${component.name}`} aria-labelledby={`component-${component.name}`}>
        <div className={`mt-6 ${on ? 'animate-enter' : ''}`}>
          <p className="m-0 font-display text-xl font-bold tracking-[-0.01em]">{t(component.summary)}</p>
          <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
            {component.facts.map((fact) => (
              <li key={fact.en} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M2.5 6.2l2.2 2.2L9.5 3.6" fill="none" stroke="#2E6B3C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t(fact)}
              </li>
            ))}
          </ul>
        </div>
        {children}
        <div className="mt-8">
          <p className={caption}>{t({ en: 'USE IT', es: 'ÚSALO', zh: '使用' })}</p>
          <div className={`mt-2.5 ${code}`} dangerouslySetInnerHTML={{ __html: example }} />
        </div>
      </div>
    </div>
  );
}
