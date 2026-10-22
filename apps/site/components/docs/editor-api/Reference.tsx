'use client';

import dynamic from 'next/dynamic';
import { PASTEL_CLASS } from '@/lib/home';
import { type ReactNode, useState } from 'react';
import { GROUPS, type Member, TYPES, memberHash, nameOf } from './data';

/** The editor is large: it comes when the page is in the browser, not with the page. */
export const LazyConsole = dynamic(() => import('./Console'), {
  ssr: false,
  loading: () => <p className="m-0 mt-7 grid h-[560px] place-items-center rounded-[18px] border border-border text-sm text-muted">Opening the editor…</p>,
});

// The same name as Console's, written here so the reference does not load the editor to send it.
const RUN_EVENT = 'editor-api-run';

const matches = (member: Member, words: string[]) => {
  const text = `${member.sigs.join(' ')} ${member.text ?? ''} ${member.nothing ?? ''}`.toLowerCase();
  // From the start of a word: "table" is not in "immutable".
  return words.every((word) => new RegExp(`(^|[^a-z])${word.replace(/[^a-z0-9]/g, '')}`).test(text));
};

const TYPE_NAMES = new RegExp(`\\b(${[...TYPES.map((type) => type.name), 'Range'].join('|')})\\b`);

/** A signature, with the types this page describes as links to them. */
function linked(text: string): ReactNode[] {
  return text.split(TYPE_NAMES).map((piece, i) =>
    i % 2 ? (
      <a key={i} href={`#type-${piece === 'Range' ? 'Position' : piece}`} className="text-brand underline decoration-[#bcd0f2] underline-offset-2 hover:text-brand-hover">
        {piece}
      </a>
    ) : (
      piece
    ),
  );
}

/** The signature as it is called, and what it returns after an arrow, quieter. */
function Sig({ sig }: { sig: string }) {
  const [call, returns] = sig.split(' → ');
  return (
    <>
      {linked(call)}
      {returns && <span className="font-normal text-muted"> → {linked(returns)}</span>}
    </>
  );
}

function Row({ member }: { member: Member }) {
  const [first, ...rest] = member.sigs;
  return (
    <div id={memberHash(first)} className="group scroll-mt-24 border-t border-[#f0eee9] py-3.5 first:border-t-0 target:bg-pastel-yellow/40">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <code className="font-code text-[14px] font-semibold text-ink">
          <a href={`#${memberHash(first)}`} className="text-inherit hover:text-brand">
            {nameOf(first)}
          </a>
          <Sig sig={first.slice(nameOf(first).length)} />
        </code>
        {rest.map((sig) => (
          <code key={sig} id={nameOf(sig) === nameOf(first) ? undefined : memberHash(sig)} className="scroll-mt-24 rounded-md bg-surface px-1.5 py-0.5 font-code text-[13px] text-ink-soft">
            <Sig sig={sig} />
          </code>
        ))}
        {member.run && (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(RUN_EVENT, { detail: member.run }))}
            className="ml-auto cursor-pointer rounded-full border-0 bg-pastel-blue px-2.5 py-0.5 text-xs font-semibold text-pastel-blue-fg hover:brightness-95"
          >
            Run it ↑
          </button>
        )}
      </div>
      {member.text && <p className="m-0 mt-1 max-w-[820px] text-[15px] leading-[1.6] text-ink-soft">{member.text}</p>}
      {member.nothing && (
        <p className="m-0 mt-1.5 flex max-w-[820px] items-start gap-2 text-[14px] leading-[1.55] text-[#6b5a2e]">
          <span className="mt-px flex-none rounded-[5px] bg-pastel-yellow px-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-pastel-yellow-fg">Does nothing</span>
          <span>{member.nothing}</span>
        </p>
      )}
    </div>
  );
}

/** Every member, by what it is for, with a filter. */
export function Reference() {
  const [query, setQuery] = useState('');
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const groups = GROUPS.map((group) => ({ ...group, shown: group.members.filter((member) => matches(member, words)) })).filter((group) => group.shown.length);
  const count = groups.reduce((n, group) => n + group.shown.length, 0);

  return (
    <>
      <div className="sticky top-[61px] z-10 mt-7 flex flex-wrap items-center gap-2 border-b border-border bg-white/95 py-3 backdrop-blur">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter: table, zoom, find…"
          aria-label="Filter the members"
          className="h-9 w-[min(100%,280px)] rounded-lg border border-border-strong bg-white px-3 text-sm text-ink"
        />
        <nav aria-label="Groups" className="flex flex-wrap gap-1.5">
          {groups.map((group) => (
            <a key={group.id} href={`#${group.id}`} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PASTEL_CLASS[group.color]} hover:brightness-95`}>
              {group.title}
            </a>
          ))}
        </nav>
        {words.length > 0 && (
          <span className="ml-auto text-[13px] text-muted" aria-live="polite">
            {count} {count === 1 ? 'row' : 'rows'}
          </span>
        )}
      </div>
      {!groups.length && <p className="m-0 mt-8 text-[15px] text-muted">Nothing matches “{query}”. The source, packages/editor/src/editor.ts, has every public member.</p>}
      <div className="mt-4 flex flex-col gap-10">
        {groups.map((group) => (
          <div key={group.id}>
            <h3 id={group.id} className="m-0 flex scroll-mt-32 items-center gap-2.5 font-display text-xl font-bold tracking-[-0.01em]">
              <span className={`size-2.5 rounded-full ${PASTEL_CLASS[group.color]}`} aria-hidden="true" />
              {group.title}
            </h3>
            {group.intro && <p className="m-0 mt-1.5 max-w-[820px] text-[15px] leading-[1.6] text-muted">{group.intro}</p>}
            <div className="mt-2 rounded-2xl border border-border px-5">
              {group.shown.map((member) => (
                <Row key={member.sigs[0]} member={member} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
