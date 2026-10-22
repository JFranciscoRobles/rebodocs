'use client';

import { DocsSurface, useDocsResponsive } from '@rebodocs/react';
import type { ReactNode } from 'react';

function Editor({ toolbar }: { toolbar: ReactNode }) {
  const { keyboard } = useDocsResponsive(600);
  return (
    <div className="flex h-dvh flex-col" style={{ paddingBottom: keyboard }}>
      {toolbar}
      <DocsSurface className="min-h-0 flex-1" />
    </div>
  );
}

// ---- On this page ----

/** The surface is already on the page: here only what the hook says, while the page is made narrow. */
export default function Example() {
  const { narrow, keyboard } = useDocsResponsive(600);
  return (
    <p className="m-0 text-sm text-neutral-600">
      {narrow ? 'Narrow: the pages fit the width, to bring nearer with two fingers.' : 'Wide: the pages at their zoom.'} Keyboard covers {keyboard}px.
    </p>
  );
}

export { Editor };
