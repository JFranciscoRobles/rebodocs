'use client';

// The editor itself, on the page: the same component an application installs.
import { DocsEditor } from '@rebodocs/react';
import { useEffect, useState } from 'react';

export function LiveDemo() {
  const [file, setFile] = useState<Uint8Array>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let gone = false;
    fetch('/demo.docx')
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setFile(new Uint8Array(bytes)))
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_24px_60px_-24px_rgba(15,30,70,0.35)]">
      <div className="flex h-9 items-center gap-1.5 border-b border-[#d5d8df] bg-[#e9ebf0] px-3">
        <i className="size-2.5 rounded-full bg-[#c3c7d0]" />
        <i className="size-2.5 rounded-full bg-[#c3c7d0]" />
        <i className="size-2.5 rounded-full bg-[#c3c7d0]" />
        <span className="ml-2 text-xs text-muted">receipt.docx</span>
      </div>
      <div className="h-[min(720px,78vh)] min-h-[460px]">
        {file ? (
          <DocsEditor docx={file} name="receipt.docx" locale="en" features={{ files: true, language: true }} />
        ) : (
          <p className="grid h-full place-items-center text-sm text-muted">{failed ? 'The sample document could not be loaded.' : 'Opening the document…'}</p>
        )}
      </div>
    </div>
  );
}
