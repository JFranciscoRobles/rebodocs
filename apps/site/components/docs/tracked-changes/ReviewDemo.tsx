'use client';

// A real editor with tracking on and Luis's changes in it, for Ana, or Luis,
// to make more and decide on them: one at a time, one person's, or all; and
// the document shown as it would be with all of them accepted, or with none.

import { exportDocx, revisionColor } from '@rebodocs/core';
import { type DocsHandle, type Editor, DocsEditor } from '@rebodocs/react';
import { useMemo, useRef, useState } from 'react';
import { usePageEditorLocale } from '@/components/editorLocale';
import { useLocale, useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import type { L, T } from '@/lib/i18n';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { PEOPLE, REVIEWED } from './data';

type View = 'all' | 'accepted' | 'original';

interface Seen {
  track: boolean;
  count: number;
  authors: string[];
  view: View;
  active: string;
}

const look = (editor: Editor, t: T): Seen => {
  const active = editor.activeRevision;
  const list = editor.revisions;
  return {
    track: editor.trackChanges,
    count: list.length,
    authors: [...new Set(list.map((r) => r.author))].sort(),
    view: editor.changesView,
    active: active ? t({ en: `${active.type} by ${active.author}`, es: `${active.type} de ${active.author}`, zh: `${active.author} 的 ${active.type}` }) + `: «${active.text.slice(0, 30)}»` : '',
  };
};

const VIEWS: [View, L][] = [
  ['all', { en: 'changes', es: 'cambios', zh: '修订' }],
  ['accepted', { en: 'all accepted', es: 'todos aceptados', zh: '全部接受' }],
  ['original', { en: 'original', es: 'original', zh: '原始' }],
];

export default function ReviewDemo() {
  const t = useT();
  const page = useLocale();
  const locale = usePageEditorLocale();
  const file = useMemo(() => exportDocx(REVIEWED[page]), [page]);
  const handle = useRef<DocsHandle | undefined>(undefined);
  const [author, setAuthor] = useState<(typeof PEOPLE)[number]>('Ana');
  const [seen, setSeen] = useState<Seen>();
  const [whose, setWhose] = useState('');

  const ready = (docs: DocsHandle | undefined) => {
    handle.current = docs;
    if (!docs) return;
    const update = () => setSeen(look(docs.editor, t));
    update();
    docs.editor.onChange(update);
  };

  const run = (fn: (editor: Editor) => unknown) => {
    const editor = handle.current?.editor;
    if (!editor) return;
    fn(editor);
    editor.focus();
  };

  const button = 'cursor-pointer rounded-lg border border-border bg-white px-2.5 py-1 text-[13px] font-semibold text-ink-soft hover:bg-hover disabled:cursor-default disabled:opacity-50';

  return (
    <DemoBox
      title={t({ en: 'Review it', es: 'Revísalo', zh: '审阅' })}
      aside={
        <>
          <div>
            <p className={CAPTION} id="rev-who">
              {t({ en: 'You are', es: 'Eres', zh: '你是' })}
            </p>
            <div role="group" aria-labelledby="rev-who" className="mt-2.5 flex gap-2">
              {PEOPLE.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={author === name}
                  onClick={() => setAuthor(name)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${
                    author === name ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'
                  }`}
                >
                  <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: `#${revisionColor(name)}` }} />
                  {name}
                </button>
              ))}
            </div>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">
              {t({
                en: 'The author prop: what you type is signed with it, in its colour.',
                es: 'La prop author: lo que escribes se firma con ella, en su color.',
                zh: 'author 属性：你输入的内容以它署名，并使用它的颜色。',
              })}
            </p>
          </div>
          <div>
            <p className={CAPTION}>{t({ en: 'Decide', es: 'Decidir', zh: '处理' })}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button type="button" className={button} disabled={!seen?.count} onClick={() => run((e) => e.goToRevision(-1))}>
                {t({ en: '← Previous', es: '← Anterior', zh: '← 上一处' })}
              </button>
              <button type="button" className={button} disabled={!seen?.count} onClick={() => run((e) => e.goToRevision(1))}>
                {t({ en: 'Next →', es: 'Siguiente →', zh: '下一处 →' })}
              </button>
              <button type="button" className={button} disabled={!seen?.count} onClick={() => run((e) => e.acceptRevision())}>
                {t({ en: 'Accept', es: 'Aceptar', zh: '接受' })}
              </button>
              <button type="button" className={button} disabled={!seen?.count} onClick={() => run((e) => e.rejectRevision())}>
                {t({ en: 'Reject', es: 'Rechazar', zh: '拒绝' })}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <select
                aria-label={t({ en: 'Whose changes', es: 'De quién', zh: '谁的修订' })}
                value={whose}
                onChange={(e) => setWhose(e.target.value)}
                className="rounded-lg border border-border bg-white px-2 py-1 text-[13px] text-ink"
              >
                <option value="">{t({ en: 'everyone’s', es: 'de todos', zh: '所有人的' })}</option>
                {seen?.authors.map((name) => (
                  <option key={name} value={name}>
                    {t({ en: `${name}’s`, es: `de ${name}`, zh: `${name} 的` })}
                  </option>
                ))}
              </select>
              <button type="button" className={button} disabled={!seen?.count} onClick={() => run((e) => e.acceptAllRevisions(whose || undefined))}>
                {t({ en: 'Accept all', es: 'Aceptar todos', zh: '全部接受' })}
              </button>
              <button type="button" className={button} disabled={!seen?.count} onClick={() => run((e) => e.rejectAllRevisions(whose || undefined))}>
                {t({ en: 'Reject all', es: 'Rechazar todos', zh: '全部拒绝' })}
              </button>
            </div>
          </div>
          <div>
            <p className={CAPTION} id="rev-view">
              {t({ en: 'Show', es: 'Mostrar', zh: '显示' })}
            </p>
            <div role="group" aria-labelledby="rev-view" className="mt-2.5 flex flex-wrap gap-1.5">
              {VIEWS.map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  aria-pressed={seen?.view === view}
                  onClick={() => run((e) => e.setChangesView(view))}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold ${seen?.view === view ? `border-transparent ${PASTEL_CLASS.green}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">
              {t({
                en: 'Shown without its changes, the document is only to be looked at; they are still in it.',
                es: 'Mostrado sin sus cambios, el documento es solo para mirar; siguen en él.',
                zh: '不显示修订时，文档只能查看；修订仍然在文档中。',
              })}
            </p>
          </div>
          <Readout
            label={t({ en: 'What the editor says', es: 'Lo que dice el editor', zh: '编辑器的状态' })}
            live={false}
            lines={[
              ['trackChanges', String(seen?.track ?? '—'), seen?.track ? 'good' : 'warn'],
              ['revisions.length', String(seen?.count ?? '—')],
              ['activeRevision', seen ? seen.active || t({ en: 'none at the caret', es: 'ninguno en el cursor', zh: '光标处没有' }) : '—', seen?.active ? undefined : 'dim'],
              ['changesView', `'${seen?.view ?? 'all'}'`, seen?.view === 'all' ? 'dim' : 'good'],
            ]}
          />
        </>
      }
    >
      <div className="-m-5 h-[520px] overflow-hidden rounded-[14px]">
        <DocsEditor docx={file} name={t({ en: 'receipt.docx', es: 'recibo.docx', zh: '收据.docx' })} locale={locale} author={author} onReady={ready} />
      </div>
    </DemoBox>
  );
}
