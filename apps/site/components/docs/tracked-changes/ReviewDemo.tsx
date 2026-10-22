'use client';

// A real editor with tracking on and Luis's changes in it, for Ana, or Luis,
// to make more and decide on them: one at a time, one person's, or all; and
// the document shown as it would be with all of them accepted, or with none.

import { exportDocx, revisionColor } from '@rebodocs/core';
import { type DocsHandle, type Editor, DocsEditor, getLocale, setLocale } from '@rebodocs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
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

const look = (editor: Editor): Seen => {
  const active = editor.activeRevision;
  const list = editor.revisions;
  return {
    track: editor.trackChanges,
    count: list.length,
    authors: [...new Set(list.map((r) => r.author))].sort(),
    view: editor.changesView,
    active: active ? `${active.type} by ${active.author}: «${active.text.slice(0, 30)}»` : 'none at the caret',
  };
};

const VIEWS: [View, string][] = [
  ['all', 'changes'],
  ['accepted', 'all accepted'],
  ['original', 'original'],
];

export default function ReviewDemo() {
  const file = useMemo(() => exportDocx(REVIEWED), []);
  const handle = useRef<DocsHandle | undefined>(undefined);
  const [author, setAuthor] = useState<(typeof PEOPLE)[number]>('Ana');
  const [seen, setSeen] = useState<Seen>();
  const [whose, setWhose] = useState('');

  useEffect(() => {
    const was = getLocale();
    setLocale('en');
    return () => setLocale(was);
  }, []);

  const ready = (docs: DocsHandle | undefined) => {
    handle.current = docs;
    if (!docs) return;
    const update = () => setSeen(look(docs.editor));
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
      title="Review it"
      aside={
        <>
          <div>
            <p className={CAPTION} id="rev-who">
              You are
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
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">The author prop: what you type is signed with it, in its colour.</p>
          </div>
          <div>
            <p className={CAPTION}>Decide</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button type="button" className={button} disabled={!seen?.count} onClick={() => run((e) => e.goToRevision(-1))}>
                ← Previous
              </button>
              <button type="button" className={button} disabled={!seen?.count} onClick={() => run((e) => e.goToRevision(1))}>
                Next →
              </button>
              <button type="button" className={button} disabled={!seen?.count} onClick={() => run((e) => e.acceptRevision())}>
                Accept
              </button>
              <button type="button" className={button} disabled={!seen?.count} onClick={() => run((e) => e.rejectRevision())}>
                Reject
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <select
                aria-label="Whose changes"
                value={whose}
                onChange={(e) => setWhose(e.target.value)}
                className="rounded-lg border border-border bg-white px-2 py-1 text-[13px] text-ink"
              >
                <option value="">everyone&apos;s</option>
                {seen?.authors.map((name) => (
                  <option key={name} value={name}>
                    {name}&apos;s
                  </option>
                ))}
              </select>
              <button type="button" className={button} disabled={!seen?.count} onClick={() => run((e) => e.acceptAllRevisions(whose || undefined))}>
                Accept all
              </button>
              <button type="button" className={button} disabled={!seen?.count} onClick={() => run((e) => e.rejectAllRevisions(whose || undefined))}>
                Reject all
              </button>
            </div>
          </div>
          <div>
            <p className={CAPTION} id="rev-view">
              Show
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
                  {label}
                </button>
              ))}
            </div>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">Shown without its changes, the document is only to be looked at; they are still in it.</p>
          </div>
          <Readout
            label="What the editor says"
            live={false}
            lines={[
              ['trackChanges', String(seen?.track ?? '—'), seen?.track ? 'good' : 'warn'],
              ['revisions.length', String(seen?.count ?? '—')],
              ['activeRevision', seen?.active ?? '—', seen?.active.startsWith('none') ? 'dim' : undefined],
              ['changesView', `'${seen?.view ?? 'all'}'`, seen?.view === 'all' ? 'dim' : 'good'],
            ]}
          />
        </>
      }
    >
      <div className="-m-5 h-[520px] overflow-hidden rounded-[14px]">
        <DocsEditor docx={file} name="receipt.docx" locale="en" author={author} onReady={ready} />
      </div>
    </DemoBox>
  );
}
