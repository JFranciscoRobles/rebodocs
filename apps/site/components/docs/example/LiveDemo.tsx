'use client';

// The interface of `apps/demo` built on the hooks, as it is written there, on
// the sample contract the demo opens with: the component itself, not a copy.

import { getLocale, setLocale } from '@rebodocs/react';
import { useEffect, useState } from 'react';
import { useEditorLocale } from '@/components/editorLocale';
import { useT } from '@/components/i18n';
import { HeadlessEditor } from '../../../../demo/src/HeadlessEditor';

export default function LiveDemo() {
  const [docx, setDocx] = useState<Uint8Array>();
  const t = useT();
  const editorLocale = useEditorLocale();

  useEffect(() => {
    const was = getLocale();
    setLocale(editorLocale);
    let gone = false;
    fetch('/sample.docx')
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setDocx((now) => now ?? new Uint8Array(bytes)))
      .catch(() => {});
    return () => {
      gone = true;
      setLocale(was);
    };
  }, [editorLocale]);

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <div className="h-[680px]">
        {docx ? (
          <HeadlessEditor docx={docx} name="agreement.docx" />
        ) : (
          <p className="m-0 grid h-full place-items-center text-sm text-muted">{t({ en: 'Opening the editor…', es: 'Abriendo el editor…', zh: '正在打开编辑器…' })}</p>
        )}
      </div>
    </div>
  );
}
