'use client';

import { useDocsStyles } from '@rebodocs/react';

function Style() {
  const { styles, active, set } = useDocsStyles();
  return (
    <select aria-label="Style" className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm" value={active ?? ''} onChange={(e) => set(e.target.value)}>
      {active === undefined && <option value="">Mixed</option>}
      {styles.map((style) => (
        <option key={style.id} value={style.id}>
          {style.name}
        </option>
      ))}
    </select>
  );
}

// ---- On this page ----

export default function Example() {
  return <Style />;
}
