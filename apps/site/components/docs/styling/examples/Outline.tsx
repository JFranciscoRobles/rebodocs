'use client';

import { useDocsOutline } from '@rebodocs/react';

/** The headings of the document down the side, the one the caret is under marked. */
export function Outline() {
  const { items, active, goTo } = useDocsOutline();
  return (
    <nav aria-label="Outline" className="w-52 flex-none overflow-auto border-r border-stone-200 bg-stone-50 p-3">
      <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-500">Outline</p>
      {items.map((item, i) => (
        <button
          key={item.para}
          type="button"
          onClick={() => goTo(item)}
          style={{ paddingLeft: 8 + Math.max(0, item.level - 1) * 14 }}
          className={`block w-full truncate rounded-md py-1.5 pr-2 text-left text-sm ${i === active ? 'bg-emerald-100 font-semibold text-emerald-900' : 'text-stone-700 hover:bg-stone-100'}`}
        >
          {item.text}
        </button>
      ))}
    </nav>
  );
}
