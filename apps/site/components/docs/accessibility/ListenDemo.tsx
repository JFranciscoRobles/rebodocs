'use client';

// A real editor, and what its live regions say as you move in it: the words a
// screen reader speaks, written down. Screen reader mode can be turned on, and
// then the hidden field the screen reader reads from is shown.

import { exportDocx } from '@rebodocs/core';
import { type DocsHandle, DocsEditor, getLocale, setLocale } from '@rebodocs/react';
import { useEffect, useRef, useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { lease } from './sample';

interface Said {
  n: number;
  text: string;
  urgent: boolean;
}

export default function ListenDemo() {
  const [file, setFile] = useState<Uint8Array>();
  const handle = useRef<DocsHandle | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const [said, setSaid] = useState<Said[]>([]);
  const [reader, setReader] = useState(false);
  const [field, setField] = useState({ value: '', start: 0, end: 0 });
  const count = useRef(0);

  useEffect(() => {
    const was = getLocale();
    setLocale('en');
    void lease().then((doc) => setFile(exportDocx(doc)));
    return () => setLocale(was);
  }, []);

  const ready = (docs: DocsHandle | undefined) => {
    handle.current = docs;
    const root = box.current;
    if (!docs || !root) return;
    // What the editor puts in its live regions is what a screen reader says.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const region = (record.target.nodeType === 1 ? record.target : record.target.parentElement) as HTMLElement | null;
        const live = region?.closest<HTMLElement>('.dx-live');
        const text = live?.textContent?.replace(/ /g, '').trim();
        if (!live || !text) continue;
        const n = ++count.current;
        setSaid((was) => [{ n, text, urgent: live.getAttribute('aria-live') === 'assertive' }, ...was].slice(0, 14));
      }
    });
    for (const live of root.querySelectorAll('.dx-live')) observer.observe(live, { childList: true, characterData: true, subtree: true });
    const input = root.querySelector<HTMLTextAreaElement>('.dx-input');
    const update = () => {
      setReader(docs.editor.screenReader);
      if (input) setField({ value: input.value, start: input.selectionStart, end: input.selectionEnd });
    };
    docs.editor.onChange(update);
    input?.addEventListener('keyup', update);
    update();
    docs.editor.focus();
  };

  const pill = (on: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold ${on ? `border-transparent ${PASTEL_CLASS.green}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`;

  return (
    <DemoBox
      title="What a screen reader hears"
      aside={
        <>
          <div>
            <p className={CAPTION}>Try</p>
            <ul className="m-0 mt-2 grid list-disc gap-1 pl-5 text-[13.5px] leading-normal text-ink-soft">
              <li>↓ and ↑ through the lines: the heading, the list, the table, the picture.</li>
              <li>→ over “rules”: the note at the foot of the page, then the link.</li>
              <li>⇧→ to select, ⌘B for bold, ⌘Z to undo.</li>
              <li>F6 to go round the bars, Escape to come back.</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={reader} className={pill(reader)} onClick={() => handle.current && ((handle.current.editor.screenReader = !reader), handle.current.editor.focus())}>
              Screen reader mode (⌘⌥Z)
            </button>
          </div>
          <Readout
            label="The hidden field"
            live={false}
            lines={
              reader
                ? [
                    ['value', field.value ? `'${field.value.slice(0, 34)}${field.value.length > 34 ? '…' : ''}'` : "''"],
                    ['selection', `${field.start}–${field.end}`],
                  ]
                : [['value', "'' — the editor says the text itself", 'dim']]
            }
          />
          <div>
            <p className={CAPTION}>What it says, newest first</p>
            <ol
              tabIndex={0}
              aria-label="What the editor said"
              className="m-0 mt-2.5 grid max-h-[280px] list-none gap-1 overflow-auto rounded-xl bg-[#2f2e2b] p-3 font-code text-[12.5px] leading-[1.5] text-[#edece8]"
            >
              {said.length ? (
                said.map((one) => (
                  <li key={one.n} className={one.n === said[0].n ? 'text-[#f5c443]' : ''}>
                    <span className="text-[#a8a49a]">{one.urgent ? '! ' : '· '}</span>
                    {one.text}
                  </li>
                ))
              ) : (
                <li className="text-[#a8a49a]">Click in the document and move with the arrows.</li>
              )}
            </ol>
          </div>
        </>
      }
    >
      <div ref={box} className="-m-5 h-[640px] overflow-hidden rounded-[14px]">
        {file ? (
          <DocsEditor docx={file} name="lease.docx" locale="en" author="Ana" onReady={ready} features={{ panel: false }} />
        ) : (
          <p className="m-0 grid h-full place-items-center text-sm text-muted">Drawing the plan…</p>
        )}
      </div>
    </DemoBox>
  );
}
