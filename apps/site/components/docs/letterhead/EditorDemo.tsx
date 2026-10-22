'use client';

// A real editor with a letter in it, and the letterheads of draw.ts to give
// it as an application gives it, through the handle: the margins grow to
// clear what each prints. Or one of your own, from the document menu.

import { createDoc, exportDocx, letterheadOf } from '@rebodocs/core';
import { type DocsHandle, type Editor, DocsEditor, getLocale, setLocale } from '@rebodocs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { DESIGNS, letterheadFile } from './draw';

const LETTER = createDoc(
  [
    'Mexico City, October 21, 2026',
    'Dear Ms. Herrera,',
    'Thank you for choosing us for the renovation of your office. As agreed on Tuesday, the work starts on November 3 and takes six weeks.',
    'The first payment, of a third of the total, is due on the day the work starts. The rest is paid in two parts, at the end of the third week and on the day the work is handed over.',
    'Should anything change, write to us at the address at the foot of this page.',
    'Kind regards,',
    'Ana Robles',
  ].map((text) => ({ props: {}, runs: [{ text, props: {} }] })),
);

type Pick = keyof typeof DESIGNS | 'none';

const CHOICES: [Pick, string][] = [
  ['studio', 'Band and address'],
  ['clinic', 'Tall band, pattern'],
  ['pattern', 'Pattern only'],
  ['none', 'None'],
];

interface Seen {
  has: boolean;
  part: string;
  top: number;
  bottom: number;
}

const look = (editor: Editor): Seen => ({
  has: editor.hasLetterhead,
  part: letterheadOf(editor.doc)?.part ?? '—',
  top: editor.doc.page.marginTop,
  bottom: editor.doc.page.marginBottom,
});

export default function EditorDemo() {
  const file = useMemo(() => exportDocx(LETTER), []);
  const handle = useRef<DocsHandle | undefined>(undefined);
  const [picked, setPicked] = useState<Pick>('none');
  const [seen, setSeen] = useState<Seen>();

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

  const give = async (pick: Pick) => {
    const docs = handle.current;
    if (!docs) return;
    setPicked(pick);
    await docs.setLetterhead(pick === 'none' ? null : await letterheadFile(DESIGNS[pick]));
  };

  const run = (fn: (editor: Editor) => unknown) => {
    const editor = handle.current?.editor;
    if (editor) fn(editor);
  };

  const button = 'cursor-pointer rounded-lg border border-border bg-white px-2.5 py-1 text-[13px] font-semibold text-ink-soft hover:bg-hover disabled:cursor-default disabled:opacity-50';

  return (
    <DemoBox
      title="Give it a letterhead"
      aside={
        <>
          <div>
            <p className={CAPTION} id="lh-pick">
              The application gives
            </p>
            <div role="group" aria-labelledby="lh-pick" className="mt-2.5 flex flex-wrap gap-2">
              {CHOICES.map(([pick, label]) => (
                <button
                  key={pick}
                  type="button"
                  aria-pressed={picked === pick}
                  onClick={() => void give(pick)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold ${picked === pick ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">handle.setLetterhead(file), or null for none. Or pick a picture of your own from the menu, under Page.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={button} disabled={!seen?.has} onClick={() => run((e) => void e.fitLetterheadMargins())}>
              Fit the margins
            </button>
            <button type="button" className={button} onClick={() => run((e) => e.setPage({ marginTop: 72, marginBottom: 72 }, true))}>
              Margins back to 1 in
            </button>
          </div>
          <Readout
            label="What the editor says"
            lines={[
              ['hasLetterhead', String(seen?.has ?? '—'), seen?.has ? 'good' : 'dim'],
              ['letterheadOf(doc).part', seen?.has ? `'${seen.part}'` : '—', seen?.has ? undefined : 'dim'],
              ['page.marginTop', seen ? `${seen.top} pt` : '—'],
              ['page.marginBottom', seen ? `${seen.bottom} pt` : '—'],
            ]}
          />
          <p className="m-0 text-[13px] leading-normal text-muted">Margins only grow: go from the tall band to the short one, and the top margin stays. Bring them back to an inch first.</p>
        </>
      }
    >
      <div className="-m-5 h-[560px] overflow-hidden rounded-[14px]">
        <DocsEditor docx={file} name="letter.docx" locale="en" author="Ana" onReady={ready} />
      </div>
    </DemoBox>
  );
}
