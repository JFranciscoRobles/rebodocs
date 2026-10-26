'use client';

// A real editor whose documents are in a bucket played by sim.ts: opening,
// saving and the versions go as in apps/storage, each request shown as it is
// made, to the backend or to the bucket. Take the rule of origins away, send
// another type, or let five minutes pass, and see what the bucket answers.

import { createDoc, exportDocx, setParagraphStyle } from '@rebodocs/core';
import { type DocsHandle, type Versions, DocsEditor } from '@rebodocs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorLocale } from '@/components/editorLocale';
import { useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { type Request, DOCX, Storage, URL_LIFE } from './sim';

const CONTRACT = setParagraphStyle(
  createDoc(
    ['Service contract', 'Norte Studio and {{client}} agree that the work starts on {{start}}.', 'Payment is due within 30 days of each invoice.'].map((text) => ({
      props: {},
      runs: [{ text, props: {} }],
    })),
  ),
  0,
  0,
  'Title',
);

const KEY = 'contract.docx';

export default function RequestsDemo() {
  const [requests, setRequests] = useState<(Request & { n: number })[]>([]);
  const count = useRef(0);
  const storage = useMemo(() => {
    const made = new Storage((request) => {
      const n = ++count.current;
      setRequests((all) => [...all, { ...request, n }].slice(-7));
    });
    made.files.set(KEY, { key: KEY, bytes: exportDocx(CONTRACT), type: DOCX, modified: new Date().toISOString() });
    return made;
  }, []);
  const [docx, setDocx] = useState<Uint8Array>();
  const [files, setFiles] = useState<{ key: string; size: number }[]>([]);
  const [cors, setCors] = useState(true);
  const [wrongType, setWrongType] = useState(false);
  const [late, setLate] = useState(false);
  const [said, setSaid] = useState<{ text: string; bad?: boolean }>({ text: '' });
  const handle = useRef<DocsHandle | undefined>(undefined);
  const t = useT();
  const editorLocale = useEditorLocale();

  const refresh = () => setFiles([...storage.files.values()].map((file) => ({ key: file.key, size: file.bytes.length })).sort((a, b) => a.key.localeCompare(b.key)));

  /** An address used after its five minutes: the bucket's clock moved on before the request. */
  const send = (url: string, init?: Parameters<Storage['fetch']>[1]) => {
    if (!late) return storage.fetch(url, init);
    const was = storage.now;
    storage.now = () => was() + (URL_LIFE + 1) * 1000;
    try {
      return storage.fetch(url, init);
    } finally {
      storage.now = was;
    }
  };

  /** A PUT with an address of the backend, as src/api.ts makes it. */
  const put = (url: string, type: string, body: Uint8Array) => {
    const answer = send(url, { method: 'PUT', type: wrongType ? 'application/octet-stream' : type, body });
    if (answer.status !== 200)
      throw new Error(
        answer.status === 0
          ? t({
              en: 'The bucket did not let this page in: its rule of origins.',
              es: 'El bucket no dejó entrar a esta página: su regla de orígenes.',
              zh: '存储桶拒绝了本页面的访问：原因是它的来源规则。',
            })
          : t({ en: `The bucket answered ${answer.status}.`, es: `El bucket respondió ${answer.status}.`, zh: `存储桶返回了 ${answer.status}。` }),
      );
  };

  // Opening: the list, an address to read it from, and the file from the bucket itself.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    storage.listFiles();
    const answer = storage.fetch(storage.readUrl(KEY));
    if (answer.body) setDocx(answer.body);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage]);

  useEffect(() => {
    storage.cors = cors;
  }, [storage, cors]);

  const versions = useMemo<Versions>(
    () => ({
      list: async () => storage.listVersions(KEY),
      load: async (id) => {
        const answer = send(storage.readUrl(id));
        if (!answer.body)
          throw new Error(
            answer.status === 0
              ? t({ en: 'blocked by the browser', es: 'bloqueado por el navegador', zh: '被浏览器拦截' })
              : t({ en: `The bucket answered ${answer.status}.`, es: `El bucket respondió ${answer.status}.`, zh: `存储桶返回了 ${answer.status}。` }),
          );
        return answer.body;
      },
      save: async (file, meta) => {
        const { url, type } = storage.versionUrl(KEY, meta);
        put(url, type, file);
        refresh();
      },
    }),
    // The toggles are read when a request is made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storage, wrongType, late],
  );

  const onSave = async (file: Uint8Array) => {
    try {
      const { url, type } = storage.writeUrl(KEY);
      put(url, type, file);
      const version = storage.versionUrl(KEY, { author: 'Ana' });
      put(version.url, version.type, file);
      setSaid({ text: t({ en: 'Saved to the bucket, and kept as a version.', es: 'Guardado en el bucket, y conservado como versión.', zh: '已保存到存储桶，并保留为一个版本。' }) });
    } catch (error) {
      setSaid({ text: (error as Error).message, bad: true });
      throw error;
    } finally {
      refresh();
    }
  };

  const toggle = (on: boolean, set: (value: boolean) => void, label: string, warn: boolean) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => set(!on)}
      className={`cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold ${on ? `border-transparent ${warn ? PASTEL_CLASS.yellow : PASTEL_CLASS.green}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`}
    >
      {label}
    </button>
  );

  return (
    <DemoBox
      title={t({ en: 'The requests of a save', es: 'Las peticiones de un guardado', zh: '一次保存的请求' })}
      aside={
        <>
          <div>
            <p className={CAPTION}>{t({ en: 'The bucket holds', es: 'El bucket contiene', zh: '存储桶中的内容' })}</p>
            <ul className="m-0 mt-2 list-none p-0 font-code text-[12.5px] leading-[1.7] text-ink-soft">
              {files.map((file) => (
                <li key={file.key} className="truncate">
                  {file.key} <span className="text-muted">· {Math.max(1, Math.round(file.size / 1024))} KB</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className={CAPTION}>{t({ en: 'Break it', es: 'Rómpelo', zh: '制造故障' })}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {toggle(cors, setCors, t({ en: 'CORS rule', es: 'Regla CORS', zh: 'CORS 规则' }), false)}
              {toggle(wrongType, setWrongType, t({ en: 'PUT another type', es: 'PUT de otro tipo', zh: '用其他类型 PUT' }), true)}
              {toggle(late, setLate, t({ en: '5 minutes later', es: '5 minutos después', zh: '5 分钟后' }), true)}
            </div>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">
              {t({
                en: 'Change the contract and save (⌘S), or keep a version from the Versions tab.',
                es: 'Cambia el contrato y guarda (⌘S), o conserva una versión desde la pestaña Versiones.',
                zh: '修改合同并保存（⌘S），或在“版本”标签页中保存一个版本。',
              })}
            </p>
          </div>
          <Readout
            label={t({ en: 'Requests, in order', es: 'Peticiones, en orden', zh: '请求（按顺序）' })}
            live={false}
            lines={
              requests.length
                ? requests.map((r) => [
                    `${r.n}. ${r.to === 'backend' ? 'api' : 's3 '} ${r.method} ${r.path.replace('?key=contract.docx', '')}`,
                    r.status ? `${r.status} ${r.note}` : r.note,
                    r.status === 200 ? 'good' : 'warn',
                  ])
                : [['—', t({ en: 'nothing yet', es: 'nada todavía', zh: '暂无' }), 'dim']]
            }
          />
          {said.text && <p className={`m-0 text-[13px] leading-normal ${said.bad ? 'text-[#b3261e]' : 'text-muted'}`}>{said.text}</p>}
        </>
      }
    >
      <div className="-m-5 h-[540px] overflow-hidden rounded-[14px]">
        {docx ? (
          <DocsEditor
            docx={docx}
            name={KEY}
            locale={editorLocale}
            author="Ana"
            versions={versions}
            onSave={onSave}
            onReady={(docs) => (handle.current = docs)}
            onError={(text) => setSaid({ text, bad: true })}
          />
        ) : (
          <p className="m-0 grid h-full place-items-center text-sm text-muted">{t({ en: 'Reading the bucket…', es: 'Leyendo el bucket…', zh: '正在读取存储桶…' })}</p>
        )}
      </div>
    </DemoBox>
  );
}
