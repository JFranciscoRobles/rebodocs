'use client';

import { useDocs, useDocsValue } from '@rebodocs/react';

function SpaceAfter() {
  const { commands } = useDocs();
  const spaced = useDocsValue((e) => e.activeParagraphProps().spacingAfter > 0, false);
  return (
    <button
      className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-sm aria-pressed:bg-blue-100"
      aria-pressed={spaced}
      onClick={() => commands.setParagraphProps({ spacingAfter: spaced ? 0 : 8 })}
    >
      Space after
    </button>
  );
}

// ---- On this page ----

export default function Example() {
  return <SpaceAfter />;
}
