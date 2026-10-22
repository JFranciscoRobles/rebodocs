'use client';

// The interface of `apps/demo` built on the hooks, as it is written there, on
// the sample contract the demo opens with: the component itself, not a copy.

import { getLocale, setLocale } from '@rebodocs/react';
import { useEffect, useState } from 'react';
import { HeadlessEditor } from '../../../../demo/src/HeadlessEditor';

export default function LiveDemo() {
  const [docx, setDocx] = useState<Uint8Array>();

  useEffect(() => {
    const was = getLocale();
    setLocale('en');
    let gone = false;
    fetch('/sample.docx')
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setDocx((now) => now ?? new Uint8Array(bytes)))
      .catch(() => {});
    return () => {
      gone = true;
      setLocale(was);
    };
  }, []);

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <div className="h-[680px]">{docx ? <HeadlessEditor docx={docx} name="agreement.docx" /> : <p className="m-0 grid h-full place-items-center text-sm text-muted">Opening the editor…</p>}</div>
    </div>
  );
}
