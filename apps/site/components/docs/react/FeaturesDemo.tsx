'use client';

// A real DocsEditor with the agreement of the demo in it: its features
// switched on and off, and the handle, reached through a ref, used from
// buttons outside it. The code beside it is the JSX of what is shown.

import { type DocsFeatures, type DocsHandle, DocsEditor, getLocale, setLocale } from '@rebodocs/react';
import { useEffect, useRef, useState } from 'react';
import { useEditorLocale } from '@/components/editorLocale';
import { useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { Readout } from '../ui';

type Feature = 'menu' | 'panel' | 'ruler' | 'statusBar' | 'find' | 'slash' | 'variableSuggestions' | 'forms' | 'focus' | 'title' | 'responsive' | 'files' | 'language';

/** Each switch, with whether it is on when not given. */
const FEATURES: [Feature, boolean][] = [
  ['menu', true],
  ['panel', true],
  ['ruler', true],
  ['statusBar', true],
  ['find', true],
  ['slash', true],
  ['variableSuggestions', true],
  ['forms', false],
  ['focus', true],
  ['title', true],
  ['responsive', true],
  ['files', false],
  ['language', false],
];

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

/** The JSX of what is shown: only the features that are not as they would be. */
function codeFor(features: DocsFeatures, locale: string): string {
  const given = FEATURES.filter(([name, on]) => !!features[name] !== on).map(([name]) => `${name}: ${features[name] ? 'true' : 'false'}`);
  return [
    'const docs = useRef<DocsHandle>(undefined);',
    '',
    '<DocsEditor',
    '  ref={docs}',
    '  docx={file}',
    '  name="agreement.docx"',
    `  locale="${locale}"`,
    '  onSave={(docx, name) => upload(docx, name)}',
    ...(given.length ? [`  features={{ ${given.join(', ')} }}`] : []),
    '/>',
  ].join('\n');
}

export default function FeaturesDemo() {
  const [file, setFile] = useState<Uint8Array>();
  const [features, setFeatures] = useState<DocsFeatures>(() => Object.fromEntries(FEATURES.map(([name, on]) => [name, on])));
  const docs = useRef<DocsHandle | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [changes, setChanges] = useState(0);
  const [said, setSaid] = useState<[string, string, 'good' | 'warn' | 'dim' | undefined]>(['—', '', 'dim']);
  const [mounts, setMounts] = useState(0);
  const t = useT();
  const editorLocale = useEditorLocale();

  useEffect(() => {
    const was = getLocale();
    void fetch('/sample.docx')
      .then((response) => response.arrayBuffer())
      .then((bytes) => setFile(new Uint8Array(bytes)));
    return () => setLocale(was);
  }, []);

  const toggle = (name: Feature) => setFeatures((was) => ({ ...was, [name]: !was[name] }));
  const pill = (active: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1 font-code text-[12.5px] font-semibold ${active ? `border-transparent ${PASTEL_CLASS.green}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`;
  const button = 'cursor-pointer rounded-lg border border-border bg-white px-2.5 py-1 font-code text-[12.5px] font-semibold text-ink-soft hover:bg-hover disabled:cursor-default disabled:opacity-50';

  const call = (what: string, fn: (handle: DocsHandle) => unknown) => {
    const handle = docs.current;
    if (!handle) return;
    const result = fn(handle);
    if (result instanceof Uint8Array) setSaid([what, kb(result.byteLength), 'good']);
    else if (typeof result === 'boolean') setSaid([what, String(result), result ? 'good' : 'warn']);
    else if (result instanceof Promise) void result.then(() => setDirty(handle.dirty));
    else setSaid([what, t({ en: 'done', es: 'hecho', zh: '完成' }), undefined]);
  };

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-surface px-6 py-4">
        <p className={CAPTION} id="rx-features">
          features
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="rx-features">
          {FEATURES.map(([name]) => (
            <button key={name} type="button" aria-pressed={!!features[name]} className={pill(!!features[name])} onClick={() => toggle(name)}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 border-b border-border bg-surface px-6 py-3.5">
        <p className={CAPTION} id="rx-handle">
          docs.current
        </p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="rx-handle">
          <button type="button" className={button} onClick={() => call('exportDocx()', (h) => h.exportDocx())}>
            exportDocx()
          </button>
          <button type="button" className={button} onClick={() => call('save()', (h) => h.save())}>
            save()
          </button>
          <button type="button" className={button} onClick={() => call("showPanel('variables')", (h) => h.showPanel('variables'))}>
            showPanel(&apos;variables&apos;)
          </button>
          <button type="button" className={button} onClick={() => call('hidePanel()', (h) => h.hidePanel())}>
            hidePanel()
          </button>
          <button type="button" className={button} onClick={() => call('focus()', (h) => h.focus())}>
            focus()
          </button>
        </div>
      </div>
      <div className="h-[560px] bg-white">
        {file ? (
          <DocsEditor
            ref={docs}
            docx={file}
            name="agreement.docx"
            locale={editorLocale}
            features={features}
            onReady={(handle) => {
              if (!handle) return;
              setMounts((n) => n + 1);
              setDirty(handle.dirty);
            }}
            onChange={() => {
              setChanges((n) => n + 1);
              setDirty(!!docs.current?.dirty);
            }}
            onSave={(docx, name) => setSaid([`onSave(docx, '${name}')`, kb(docx.byteLength), 'good'])}
          />
        ) : (
          <p className="m-0 grid h-full place-items-center text-sm text-muted">{t({ en: 'Opening the agreement…', es: 'Abriendo el contrato…', zh: '正在打开协议…' })}</p>
        )}
      </div>
      <div className="grid gap-5 border-t border-border bg-surface px-6 py-5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))' }}>
        <div className="min-w-0">
          <p className={CAPTION}>{t({ en: 'The code of what is shown', es: 'El código de lo que se ve', zh: '当前效果的代码' })}</p>
          <pre
            tabIndex={0}
            aria-label={t({ en: 'The code of what is shown', es: 'El código de lo que se ve', zh: '当前效果的代码' })}
            className="m-0 mt-2.5 overflow-x-auto rounded-xl bg-[#2f2e2b] px-4 py-3.5 font-code text-[12.5px] leading-[1.65] text-[#edece8]"
          >
            {codeFor(features, editorLocale)}
          </pre>
        </div>
        <Readout
          label={t({ en: 'What it says', es: 'Lo que dice', zh: '输出' })}
          lines={[
            [t({ en: 'made', es: 'creado', zh: '创建' }), t({ en: `${mounts} ${mounts === 1 ? 'time' : 'times'}`, es: `${mounts} ${mounts === 1 ? 'vez' : 'veces'}`, zh: `${mounts} 次` })],
            ['onChange', t({ en: `${changes} ${changes === 1 ? 'call' : 'calls'}`, es: `${changes} ${changes === 1 ? 'llamada' : 'llamadas'}`, zh: `${changes} 次调用` }), changes ? undefined : 'dim'],
            ['dirty', String(dirty), dirty ? 'warn' : 'dim'],
            [said[0], said[1], said[2]],
          ]}
        />
      </div>
    </div>
  );
}
