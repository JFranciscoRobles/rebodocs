'use client';

import { useDocsLink } from '@rebodocs/react';

function LinkButton() {
  const link = useDocsLink();
  const ask = () => {
    const address = window.prompt('Address', link.active?.href ?? 'https://');
    if (address === null) return;
    if (address === '') link.remove();
    else if (!link.set(address)) window.alert('That is not an address.');
  };
  return (
    <button className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-sm aria-pressed:bg-blue-100 disabled:opacity-40" aria-pressed={!!link.active} disabled={!link.possible} onClick={ask}>
      Link
    </button>
  );
}

// ---- On this page ----

export default function Example() {
  return <LinkButton />;
}
