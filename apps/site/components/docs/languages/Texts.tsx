'use client';

// Every text of the interface, by key, in the two languages it comes with:
// what a translation has to say, and what can be changed with addLocale.

import { useDeferredValue, useState } from 'react';
import { CAPTION } from '../styles';

export type TextRow = [key: string, es: string, en: string];

/** A text with each {name} marked: what a translation leaves as it is. */
function Marked({ text }: { text: string }) {
  return text.split(/(\{\w+\})/).map((piece, i) =>
    i % 2 ? (
      <code key={i} className="rounded bg-pastel-purple px-1 font-code text-[12.5px] text-pastel-purple-fg">
        {piece}
      </code>
    ) : (
      piece
    ),
  );
}

export function Texts({ rows }: { rows: TextRow[] }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('');
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const groups = [...new Set(rows.map(([key]) => key.split('.')[0]))].sort();
  const shown = rows.filter(([key, es, en]) => (!group || key.split('.')[0] === group) && (!deferred || `${key}\n${es}\n${en}`.toLowerCase().includes(deferred)));

  return (
    <div className="mt-7 overflow-hidden rounded-2xl border border-border">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface px-5 py-3.5">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a key or a text: save, page, tabla…"
          aria-label="Find a text"
          className="min-w-0 flex-[1_1_260px] rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-ink"
        />
        <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Part of the interface" className="rounded-lg border border-border bg-white px-2.5 py-1.5 font-code text-[13px] text-ink">
          <option value="">every part</option>
          {groups.map((name) => (
            <option key={name} value={name}>
              {name}.
            </option>
          ))}
        </select>
        <span aria-live="polite" className="text-[13px] text-muted">
          {shown.length === rows.length ? `${rows.length} texts` : `${shown.length} of ${rows.length}`}
        </span>
      </div>
      {/* It scrolls: the keyboard reaches it. */}
      <div tabIndex={0} role="region" aria-label="Every text of the interface" className="max-h-[520px] overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="sticky top-0 bg-white shadow-[0_1px_0_var(--color-border)]">
            <tr>
              <th className={`${CAPTION} w-[28%] px-5 py-2.5`}>Key</th>
              <th className={`${CAPTION} px-5 py-2.5`}>Español</th>
              <th className={`${CAPTION} px-5 py-2.5`}>English</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(([key, es, en]) => (
              <tr key={key} className="border-t border-[#f0eee9] align-top first:border-t-0">
                <td className="break-all px-5 py-2 font-code text-[13px] text-ink">{key}</td>
                <td className="px-5 py-2 text-[14px] leading-normal text-ink-soft">
                  <Marked text={es} />
                </td>
                <td className="px-5 py-2 text-[14px] leading-normal text-ink-soft">
                  <Marked text={en} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="m-0 px-5 py-6 text-sm text-muted">No text has that.</p>}
      </div>
    </div>
  );
}
