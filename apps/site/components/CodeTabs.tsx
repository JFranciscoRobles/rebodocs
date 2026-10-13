'use client';

import { useState } from 'react';

/** Samples of code, one shown at a time. Each comes already coloured, as HTML. */
export function CodeTabs({ samples }: { samples: { name: string; html: string }[] }) {
  const [shown, setShown] = useState(0);
  return (
    <div className="code min-w-0 overflow-hidden rounded-xl bg-[#22272e] shadow-[0_20px_50px_-24px_rgba(15,30,70,0.45)]">
      <div className="flex gap-0.5 overflow-x-auto bg-[#1b1f25] px-2 pt-2" role="tablist">
        {samples.map((sample, i) => (
          <button
            key={sample.name}
            role="tab"
            aria-selected={shown === i}
            onClick={() => setShown(i)}
            className={`whitespace-nowrap rounded-t-lg px-3.5 py-2 text-[13px] font-semibold ${shown === i ? 'bg-[#22272e] text-white' : 'text-[#9aa4b8] hover:text-white'}`}
          >
            {sample.name}
          </button>
        ))}
      </div>
      <div className="min-h-[330px] [&_pre]:rounded-none" dangerouslySetInnerHTML={{ __html: samples[shown].html }} />
    </div>
  );
}
