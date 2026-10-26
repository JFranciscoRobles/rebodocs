'use client';

// The editor itself, on the page: the same component an application installs.
import { type Versions, DocsEditor } from '@rebodocs/react';
import { useEffect, useState } from 'react';
import { SAMPLE } from '@/lib/sample';
import { spellcheck } from '../../demo/src/spelling';
import { useEditorLocale } from './editorLocale';
import { useLocale, useT } from './i18n';

// The versions kept on this page, while it is open: an application keeps them beside its documents.
const kept: { id: string; date: string; label?: string; author?: string; docx: Uint8Array }[] = [];
const versions: Versions = {
  list: async () => kept.map(({ docx, ...info }) => info),
  load: async (id) => kept.find((version) => version.id === id)?.docx ?? Promise.reject(new Error('There is no such version.')),
  save: async (docx, info) => void kept.push({ id: String(kept.length + 1), date: new Date().toISOString(), ...info, docx }),
};

export function LiveDemo() {
  const [file, setFile] = useState<Uint8Array>();
  const [failed, setFailed] = useState(false);
  const t = useT();
  const { file: url, name } = SAMPLE[useLocale()];
  const editorLocale = useEditorLocale();
  useEffect(() => {
    let gone = false;
    fetch(url)
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setFile(new Uint8Array(bytes)))
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
    };
  }, [url]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="flex h-11 items-center gap-2 border-b border-[#f0eee9] px-4">
        <i className="size-2.75 rounded-full bg-[#f2c9c4]" />
        <i className="size-2.75 rounded-full bg-[#f5e2b0]" />
        <i className="size-2.75 rounded-full bg-[#c8e3cd]" />
        <span className="ml-2.5 text-sm font-semibold text-ink">{name}</span>
      </div>
      <div className="h-[min(720px,78vh)] min-h-[460px]">
        {file ? (
          <DocsEditor
            docx={file}
            name={name}
            locale={editorLocale}
            features={{ files: true, language: true, theme: true, forms: true, panelOpen: 'variables' }}
            versions={versions}
            spellcheck={spellcheck}
          />
        ) : (
          <p className="grid h-full place-items-center text-sm text-muted">
            {failed
              ? t({ en: 'The sample document could not be loaded.', es: 'No se pudo cargar el documento de ejemplo.', zh: '无法载入示例文档。' })
              : t({ en: 'Opening the document…', es: 'Abriendo el documento…', zh: '正在打开文档…' })}
          </p>
        )}
      </div>
    </div>
  );
}
