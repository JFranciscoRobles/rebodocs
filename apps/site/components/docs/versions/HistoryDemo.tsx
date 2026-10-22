'use client';

// A real editor with the versions prop, kept by this page in memory as an
// application keeps them on its server: what the editor asks of it shows as it
// asks. Each save of the document keeps a version too, as the storage demo does.

import { exportDocx } from '@rebodocs/core';
import { type DocsHandle, type VersionInfo, type Versions, DocsEditor, getLocale, setLocale } from '@rebodocs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { CURRENT, KEPT } from './data';

interface Stored {
  info: VersionInfo;
  docx: Uint8Array;
}

/** As long as a request to a server near by takes. */
const later = <T,>(value: T) => new Promise<T>((done) => setTimeout(() => done(value), 120));

export default function HistoryDemo() {
  const file = useMemo(() => exportDocx(CURRENT), []);
  const store = useRef<Stored[]>(KEPT.map(({ doc, ...info }) => ({ info, docx: exportDocx(doc) })));
  const box = useRef<HTMLDivElement>(null);
  const handle = useRef<DocsHandle | undefined>(undefined);
  const [calls, setCalls] = useState<[string, string][]>([]);
  const [count, setCount] = useState(KEPT.length);

  const asked = useRef(0);
  const log = (call: string, result: string) => {
    const line: [string, string] = [`${++asked.current}. ${call}`, result];
    setCalls((all) => [...all, line].slice(-6));
  };

  const keep = (docx: Uint8Array, info: { label?: string; author?: string }) => {
    const id = `v${store.current.length + 1}`;
    store.current.push({ info: { id, date: new Date().toISOString(), ...info }, docx });
    setCount(store.current.length);
    return id;
  };

  const versions = useMemo<Versions>(
    () => ({
      list: () => {
        log('list()', `${store.current.length} versions`);
        return later(store.current.map((one) => one.info));
      },
      load: (id) => {
        log(`load('${id}')`, 'its DOCX');
        return later(store.current.find((one) => one.info.id === id)!.docx);
      },
      save: (docx, info) => {
        const id = keep(docx, info);
        log(`save(docx, { label: ${info.label ? `'${info.label}'` : 'undefined'} })`, `kept ${id}`);
        return later(id);
      },
    }),
    [],
  );

  useEffect(() => {
    const was = getLocale();
    setLocale('en');
    return () => setLocale(was);
  }, []);

  const ready = (docs: DocsHandle | undefined) => {
    handle.current = docs;
    // The Versions tab, open from the start.
    if (docs) box.current?.querySelector<HTMLButtonElement>('.dx-pn-tab[data-name="history"]')?.click();
  };

  const onSave = async (docx: Uint8Array) => {
    const id = keep(docx, { author: 'Ana' });
    log('onSave(docx)', `the application kept ${id}`);
    await later(id);
  };

  return (
    <DemoBox
      title="Your versions"
      aside={
        <>
          <div>
            <p className={CAPTION}>Kept by this page</p>
            <p className="m-0 mt-2 text-[15px] leading-normal text-ink-soft">
              <strong className="text-ink">{count}</strong> versions, in memory, as your server would keep them.
            </p>
            <button
              type="button"
              onClick={() => void handle.current?.save()}
              className="mt-2.5 cursor-pointer rounded-lg border border-border bg-white px-2.5 py-1 text-[13px] font-semibold text-ink-soft hover:bg-hover"
            >
              Save the document (⌘S)
            </button>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">onSave keeps a version each time, as the storage demo does.</p>
          </div>
          <Readout label="What the editor asked" lines={calls.length ? calls : [['—', 'nothing yet', 'dim']]} />
          <p className="m-0 text-[13px] leading-normal text-muted">
            <strong>See changes</strong> on a version reads it once: compare it again, and it is not asked for. <strong>Restore</strong> is one step to undo.
          </p>
        </>
      }
    >
      <div ref={box} className="-m-5 h-[540px] overflow-hidden rounded-[14px]">
        <DocsEditor docx={file} name="receipt.docx" locale="en" author="Ana" versions={versions} onSave={onSave} onReady={ready} />
      </div>
    </DemoBox>
  );
}
