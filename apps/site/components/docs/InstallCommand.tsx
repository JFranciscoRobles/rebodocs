'use client';

import { useEffect, useState } from 'react';

/** A command to install, as a button that copies it. */
export function InstallCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => navigator.clipboard?.writeText(command).then(() => setCopied(true), () => {})}
      className="inline-flex max-w-full cursor-pointer items-center gap-3 rounded-[10px] border border-border bg-surface py-2.25 pl-3.5 pr-2.5 font-code text-sm text-ink transition-colors hover:bg-hover"
    >
      <span className="text-faint" aria-hidden="true">
        $
      </span>
      <span className="min-w-0 [overflow-wrap:anywhere]">{command}</span>
      <span aria-live="polite" className={`flex-none rounded-md border border-border px-2.25 py-0.75 font-text text-xs font-semibold ${copied ? 'bg-pastel-green text-pastel-green-fg' : 'bg-white text-ink'}`}>
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  );
}
