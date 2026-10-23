'use client';

import { useDocsFind } from '@rebodocs/react';
import { useState } from 'react';

const field = 'w-32 rounded-md border border-neutral-300 px-2 py-1 text-sm';
const button = 'rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-sm aria-pressed:bg-blue-100 disabled:opacity-40';

function FindBar({ onClose }: { onClose: () => void }) {
  const find = useDocsFind();
  const [replacement, setReplacement] = useState('');
  const close = () => {
    find.close();
    onClose();
  };
  return (
    <div role="search" className="flex flex-wrap items-center gap-1.5">
      <input
        aria-label="Find"
        className={field}
        value={find.query}
        onChange={(e) => find.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.shiftKey ? find.previous : find.next)();
          if (e.key === 'Escape') close();
        }}
      />
      <button className={button} aria-pressed={!!find.options.matchCase} onClick={() => find.setOptions({ ...find.options, matchCase: !find.options.matchCase })}>
        Aa
      </button>
      <span className="text-sm text-neutral-600">{find.count ? `${find.index} of ${find.count}` : 'Nothing found'}</span>
      <input aria-label="Replace with" className={field} value={replacement} onChange={(e) => setReplacement(e.target.value)} />
      <button className={button} disabled={!find.count} onClick={() => find.replace(replacement)}>
        Replace
      </button>
      <button className={button} disabled={!find.count} onClick={() => find.replaceAll(replacement)}>
        All
      </button>
      <button className={button} onClick={close}>
        Close
      </button>
    </div>
  );
}

// ---- On this page ----

export default function Example() {
  const [open, setOpen] = useState(true);
  return open ? (
    <FindBar onClose={() => setOpen(false)} />
  ) : (
    <button className={button} onClick={() => setOpen(true)}>
      Find
    </button>
  );
}
