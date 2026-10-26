'use client';

// A real editor with the versions prop, kept by this page in memory as an
// application keeps them on its server: what the editor asks of it shows as it
// asks. Each save of the document keeps a version too, as the storage demo does.

import { exportDocx } from '@rebodocs/core';
import { type DocsHandle, type VersionInfo, type Versions, DocsEditor } from '@rebodocs/react';
import { useMemo, useRef, useState } from 'react';
import { usePageEditorLocale } from '@/components/editorLocale';
import { useLocale, useT } from '@/components/i18n';
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
  const t = useT();
  const page = useLocale();
  const locale = usePageEditorLocale();
  const file = useMemo(() => exportDocx(CURRENT[page]), [page]);
  const store = useRef<Stored[]>(KEPT[page].map(({ doc, ...info }) => ({ info, docx: exportDocx(doc) })));
  const box = useRef<HTMLDivElement>(null);
  const handle = useRef<DocsHandle | undefined>(undefined);
  const [calls, setCalls] = useState<[string, string][]>([]);
  const [count, setCount] = useState(KEPT[page].length);

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
      title={t({ en: 'Your versions', es: 'Tus versiones', zh: '你的版本' })}
      aside={
        <>
          <div>
            <p className={CAPTION}>{t({ en: 'Kept by this page', es: 'Guardadas por esta página', zh: '由本页保存' })}</p>
            <p className="m-0 mt-2 text-[15px] leading-normal text-ink-soft">
              {t({
                en: (
                  <>
                    <strong className="text-ink">{count}</strong> versions, in memory, as your server would keep them.
                  </>
                ),
                es: (
                  <>
                    <strong className="text-ink">{count}</strong> versiones, en memoria, como las guardaría tu servidor.
                  </>
                ),
                zh: (
                  <>
                    <strong className="text-ink">{count}</strong> 个版本，保存在内存中，就像你的服务器会做的那样。
                  </>
                ),
              })}
            </p>
            <button
              type="button"
              onClick={() => void handle.current?.save()}
              className="mt-2.5 cursor-pointer rounded-lg border border-border bg-white px-2.5 py-1 text-[13px] font-semibold text-ink-soft hover:bg-hover"
            >
              {t({ en: 'Save the document (⌘S)', es: 'Guardar el documento (⌘S)', zh: '保存文档（⌘S）' })}
            </button>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">
              {t({
                en: 'onSave keeps a version each time, as the storage demo does.',
                es: 'onSave guarda una versión cada vez, como hace el demo de almacenamiento.',
                zh: 'onSave 每次都会保存一个版本，与存储演示的做法相同。',
              })}
            </p>
          </div>
          <Readout
            label={t({ en: 'What the editor asked', es: 'Lo que pidió el editor', zh: '编辑器的请求' })}
            lines={calls.length ? calls : [['—', t({ en: 'nothing yet', es: 'nada todavía', zh: '暂无' }), 'dim']]}
          />
          <p className="m-0 text-[13px] leading-normal text-muted">
            {t({
              en: (
                <>
                  <strong>See changes</strong> on a version reads it once: compare it again, and it is not asked for. <strong>Restore</strong> is one step to undo.
                </>
              ),
              es: (
                <>
                  <strong>Ver cambios</strong> en una versión la lee una vez: compárala de nuevo y no se vuelve a pedir. <strong>Restaurar</strong> es un paso para deshacer.
                </>
              ),
              zh: (
                <>
                  对某个版本<strong>查看更改</strong>时只读取一次：再次比较时不会重新请求。<strong>还原</strong>可一步撤销。
                </>
              ),
            })}
          </p>
        </>
      }
    >
      <div ref={box} className="-m-5 h-[540px] overflow-hidden rounded-[14px]">
        <DocsEditor docx={file} name={t({ en: 'receipt.docx', es: 'recibo.docx', zh: '收据.docx' })} locale={locale} author="Ana" versions={versions} onSave={onSave} onReady={ready} />
      </div>
    </DemoBox>
  );
}
