'use client';

import { useDocsFind } from '@rebodocs/react';

/** A search box of your own: it finds as it is typed, and says where it is. */
export function FindBar() {
  const find = useDocsFind();
  return (
    <div className="flex items-center gap-2 border-b border-sky-200 bg-sky-50 px-3 py-2">
      <input
        value={find.query}
        onChange={(e) => find.setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.shiftKey ? find.previous() : find.next())}
        placeholder="Find in the document"
        aria-label="Find"
        className="h-8 w-56 rounded-lg border border-sky-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-sky-400"
      />
      <span className="min-w-16 text-sm text-sky-900 tabular-nums">{!find.query ? '' : !find.count ? 'none' : find.index ? `${find.index} of ${find.count}` : `${find.count} found`}</span>
      <button type="button" className="rounded-lg px-2 py-1 text-sm text-sky-900 hover:bg-sky-100" onClick={find.previous}>
        Previous
      </button>
      <button type="button" className="rounded-lg bg-sky-600 px-3 py-1 text-sm font-semibold text-white hover:bg-sky-700" onClick={find.next}>
        Next
      </button>
    </div>
  );
}
