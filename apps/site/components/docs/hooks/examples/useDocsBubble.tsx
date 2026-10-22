'use client';

import { useDocsBubble } from '@rebodocs/react';

const button = 'rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-sm';

function Insert() {
  const bubble = useDocsBubble();
  return (
    <div className="flex gap-1.5">
      <button className={button} onClick={() => bubble?.ask('variable')}>Variable</button>
      <button className={button} onClick={() => bubble?.ask('note')}>Note</button>
      <button className={button} onClick={() => bubble?.ask('link')}>Link</button>
    </div>
  );
}

// Its colours, through variables on the body, where it is put:
// body { --dx-ui-bg: #323232; --dx-ui-ink: #eee; --dx-ui-line: #505050; --dx-ui-active: #4a4a4a; }

// ---- On this page ----

export default function Example() {
  return <Insert />;
}
