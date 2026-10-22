'use client';

import { useEffect, useState } from 'react';
import { INSTALL_ORDER, PACKAGES } from '@/lib/home';

/** One package at a time: the command to install it, a button that copies it, and what it is. */
export function InstallPicker() {
  const [name, setName] = useState(INSTALL_ORDER[0]);
  const [copied, setCopied] = useState(false);
  const command = `npm install ${name}`;
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    navigator.clipboard?.writeText(command).then(
      () => setCopied(true),
      () => {},
    );
  };

  return (
    <div className="mx-auto mt-7 max-w-[560px] rounded-2xl border border-border bg-surface p-2 text-left">
      <div role="tablist" aria-label="Packages" className="flex flex-wrap gap-1">
        {INSTALL_ORDER.map((pkg) => {
          const on = pkg === name;
          return (
            <button
              key={pkg}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setName(pkg);
                setCopied(false);
              }}
              className={`cursor-pointer rounded-lg border px-[11px] py-1.5 text-[13px] font-medium transition-colors ${on ? 'border-border bg-white text-brand' : 'border-transparent text-muted hover:bg-hover'}`}
            >
              {pkg.replace('@rebodocs/', '')}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={copy}
        className="mt-2 flex w-full cursor-pointer items-center gap-3 rounded-[10px] border border-border bg-white py-3 pl-4 pr-3 text-left font-code text-sm text-ink transition duration-250 hover:-translate-y-1 hover:shadow-lift"
      >
        <span className="text-faint" aria-hidden="true">
          $
        </span>
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{command}</span>
        <span
          aria-live="polite"
          className={`flex-none rounded-md border border-border px-[9px] py-[3px] font-text text-xs font-semibold ${copied ? 'bg-pastel-green text-pastel-green-fg' : 'bg-white text-ink'}`}
        >
          {copied ? 'Copied' : 'Copy'}
        </span>
      </button>
      <p key={name} className="m-0 animate-pop-in px-2 pb-1 pt-2.5 text-sm leading-normal text-muted opacity-0">
        {PACKAGES.find((pkg) => pkg.name === name)?.what}
      </p>
    </div>
  );
}
