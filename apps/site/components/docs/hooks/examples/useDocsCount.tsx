'use client';

import { useDocsCount } from '@rebodocs/react';

function Count() {
  const { words, characters, selected } = useDocsCount();
  return (
    <span className="text-sm text-neutral-600">
      {selected ? `${selected.words} of ${words} words` : `${words} words`} · {characters} characters
    </span>
  );
}

// ---- On this page ----

export default function Example() {
  return <Count />;
}
