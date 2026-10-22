'use client';

import dynamic from 'next/dynamic';
import { CONFLICTS } from './data';

/** The two editors come when the page is in the browser. */
export const LazyRoom = dynamic(() => import('./Room'), {
  ssr: false,
  loading: () => <p className="m-0 mt-7 grid h-[460px] place-items-center rounded-[18px] border border-border text-sm text-muted">Opening the room…</p>,
});

// Where Room listens, written again so the table does not load the editors.
const SCENARIO_EVENT = 'collab-scenario';

/** What happens when two people change the same thing at once; the ones that can be set up, with a button to. */
export function Conflicts() {
  return (
    <div className="mt-7 overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="bg-surface">
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-muted">What happens at once</th>
            <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.04em] text-muted">What everybody ends with</th>
            <th className="w-[110px] px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {CONFLICTS.map(([what, result, scenario]) => (
            <tr key={what} className="border-t border-[#f0eee9] align-top">
              <td className="w-[42%] px-5 py-3 text-[15px] leading-[1.55] text-ink">{what}</td>
              <td className="px-5 py-3 text-[15px] leading-[1.55] text-ink-soft">{result}</td>
              <td className="px-5 py-3 text-right">
                {scenario && (
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent(SCENARIO_EVENT, { detail: scenario }))}
                    className="cursor-pointer rounded-full border-0 bg-pastel-blue px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-pastel-blue-fg hover:brightness-95"
                  >
                    Try it ↑
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
