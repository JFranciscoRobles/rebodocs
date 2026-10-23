'use client';

import { useDocsPage } from '@rebodocs/react';

const CM = 72 / 2.54;
const button = 'rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-sm aria-pressed:bg-blue-100';

function PageSetup() {
  const { page, set, numbering, setNumbering } = useDocsPage();
  if (!page) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button className={button} onClick={() => set({ width: page.height, height: page.width })}>
        Turn
      </button>
      <label className="text-sm text-neutral-600">
        Left margin, cm{' '}
        <input
          type="number"
          step="0.1"
          className="w-16 rounded border border-neutral-300 px-1 py-0.5"
          value={(page.marginLeft / CM).toFixed(1)}
          onChange={(e) => set({ marginLeft: e.target.valueAsNumber * CM })}
        />
      </label>
      <button className={button} aria-pressed={!!numbering} onClick={() => setNumbering(numbering ? undefined : { place: 'footer', align: 'center', format: 'pageOfTotal' })}>
        Page numbers
      </button>
    </div>
  );
}

// ---- On this page ----

export default function Example() {
  return <PageSetup />;
}
