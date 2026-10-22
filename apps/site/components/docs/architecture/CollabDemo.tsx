'use client';

import { useState } from 'react';
import { CAPTION } from '../ui';

type Mark = 'mine' | 'theirs';
/** A paragraph; its text can be in pieces, to mark the letters one change put in. */
type Para = { id: string; text: string | [text: string, mark?: Mark][]; mark?: Mark };
type Step = { title: string; text: string; ana: Para[]; luis: Para[]; server: string[]; check?: boolean };

const K3 = 'Late payments add a fee.';
const K3_AFTER = 'Late payments add a fee each month.';
const LUIS_CHANGE = "in k3, at offset 23, insert ' each month'";
const ANA_CHANGE = "after k1, insert paragraph k4 'No. 1024'";

/** What each of them sees, and what the server knows, at each step: two changes in different paragraphs. */
const APART: Step[] = [
  {
    title: 'The same document, shared',
    text: 'While a document is shared, each paragraph has an id. Ana and Luis have the same three.',
    ana: [{ id: 'k1', text: 'Receipt' }, { id: 'k2', text: 'Payment is due within 15 days.' }, { id: 'k3', text: K3 }],
    luis: [{ id: 'k1', text: 'Receipt' }, { id: 'k2', text: 'Payment is due within 15 days.' }, { id: 'k3', text: K3 }],
    server: [],
  },
  {
    title: 'Luis types, and sees it at once',
    text: 'His own change is applied without waiting for the server. It names the paragraph by id, not by position.',
    ana: [{ id: 'k1', text: 'Receipt' }, { id: 'k2', text: 'Payment is due within 15 days.' }, { id: 'k3', text: K3 }],
    luis: [{ id: 'k1', text: 'Receipt' }, { id: 'k2', text: 'Payment is due within 15 days.' }, { id: 'k3', text: K3_AFTER, mark: 'mine' }],
    server: [`Luis: ${LUIS_CHANGE}`],
  },
  {
    title: 'Ana, at the same time, adds a paragraph above',
    text: 'Neither has seen the other’s change yet. By position, Luis’s paragraph is now the fourth on Ana’s screen.',
    ana: [{ id: 'k1', text: 'Receipt' }, { id: 'k4', text: 'No. 1024', mark: 'mine' }, { id: 'k2', text: 'Payment is due within 15 days.' }, { id: 'k3', text: K3 }],
    luis: [{ id: 'k1', text: 'Receipt' }, { id: 'k2', text: 'Payment is due within 15 days.' }, { id: 'k3', text: K3_AFTER, mark: 'mine' }],
    server: [`Luis: ${LUIS_CHANGE}`, `Ana: ${ANA_CHANGE}`],
  },
  {
    title: 'The server puts them in one order',
    text: 'Everyone’s changes go in one order, each rebased against the ones its author had not seen yet. Each editor rebases its own when that order arrives.',
    ana: [{ id: 'k1', text: 'Receipt' }, { id: 'k4', text: 'No. 1024', mark: 'mine' }, { id: 'k2', text: 'Payment is due within 15 days.' }, { id: 'k3', text: K3 }],
    luis: [{ id: 'k1', text: 'Receipt' }, { id: 'k2', text: 'Payment is due within 15 days.' }, { id: 'k3', text: K3_AFTER, mark: 'mine' }],
    server: [`1. Luis: ${LUIS_CHANGE}`, `2. Ana: ${ANA_CHANGE}`],
  },
  {
    title: 'Both arrive, and mean the same',
    text: 'Luis’s change says k3, so it lands in the right paragraph although one was added above it. Both screens are now the same document.',
    ana: [{ id: 'k1', text: 'Receipt' }, { id: 'k4', text: 'No. 1024' }, { id: 'k2', text: 'Payment is due within 15 days.' }, { id: 'k3', text: K3_AFTER, mark: 'theirs' }],
    luis: [{ id: 'k1', text: 'Receipt' }, { id: 'k4', text: 'No. 1024', mark: 'theirs' }, { id: 'k2', text: 'Payment is due within 15 days.' }, { id: 'k3', text: K3_AFTER }],
    server: [`1. Luis: ${LUIS_CHANGE}`, `2. Ana: ${ANA_CHANGE}`],
  },
  {
    title: 'A moment later, a check',
    text: 'The rules are tested with two people editing at random from thousands of seeds, not proven. So when the changes stop, the server sends a digest of its document; an editor whose document differs loads the room again, keeping what it had not sent.',
    ana: [{ id: 'k1', text: 'Receipt' }, { id: 'k4', text: 'No. 1024' }, { id: 'k2', text: 'Payment is due within 15 days.' }, { id: 'k3', text: K3_AFTER }],
    luis: [{ id: 'k1', text: 'Receipt' }, { id: 'k4', text: 'No. 1024' }, { id: 'k2', text: 'Payment is due within 15 days.' }, { id: 'k3', text: K3_AFTER }],
    server: [`1. Luis: ${LUIS_CHANGE}`, `2. Ana: ${ANA_CHANGE}`, 'digest of the document → both match'],
    check: true,
  },
];

// The same paragraph: Ana writes "small " at offset 20 of k3, Luis " each month" at 23.
const K2 = { id: 'k2', text: 'Payment is due within 15 days.' };
const K1 = { id: 'k1', text: 'Receipt' };
const ANA_SAME = "in k3, at offset 20, insert 'small '";
const LUIS_SAME = "in k3, at offset 23, insert ' each month'";
const BOTH: [string, Mark?][] = [['Late payments add a '], ['small '], ['fee'], [' each month'], ['.']];
const marked = (ana?: Mark, luis?: Mark): [string, Mark?][] => [BOTH[0], [BOTH[1][0], ana], BOTH[2], [BOTH[3][0], luis], BOTH[4]];

/** Two changes in one paragraph: the second to arrive is moved over the letters of the first. */
const TOGETHER: Step[] = [
  {
    title: 'The same paragraph, on both screens',
    text: 'This time both will write in k3. An id is no longer enough: what has to agree is where in the paragraph.',
    ana: [K1, K2, { id: 'k3', text: K3 }],
    luis: [K1, K2, { id: 'k3', text: K3 }],
    server: [],
  },
  {
    title: 'Both type at once',
    text: 'Ana puts “small ” before “fee”, at offset 20. Luis, who has not seen it, puts “ each month” before the full stop, at offset 23. Each sees their own at once.',
    ana: [K1, K2, { id: 'k3', text: [['Late payments add a '], ['small ', 'mine'], ['fee.']] }],
    luis: [K1, K2, { id: 'k3', text: [['Late payments add a fee'], [' each month', 'mine'], ['.']] }],
    server: [`Ana: ${ANA_SAME}`, `Luis: ${LUIS_SAME}`],
  },
  {
    title: 'The server rebases the second',
    text: 'Ana’s arrived first and goes in as it is. Luis’s was written against the paragraph before hers: six letters went in before his offset, so 23 becomes 29. Without this, “ each month” would land inside “fee”.',
    ana: [K1, K2, { id: 'k3', text: [['Late payments add a '], ['small ', 'mine'], ['fee.']] }],
    luis: [K1, K2, { id: 'k3', text: [['Late payments add a fee'], [' each month', 'mine'], ['.']] }],
    server: [`1. Ana: ${ANA_SAME}`, `2. Luis: ${LUIS_SAME}`, "   rebased over 1 → in k3, at offset 29, insert ' each month'"],
  },
  {
    title: 'Both arrive, and mean the same',
    text: 'Ana receives Luis’s change at offset 29. Luis receives Ana’s at offset 20, before his own letters, so it needs no moving on his side, and his own is moved over it, as the server did.',
    ana: [K1, K2, { id: 'k3', text: marked('mine', 'theirs') }],
    luis: [K1, K2, { id: 'k3', text: marked('theirs', 'mine') }],
    server: [`1. Ana: ${ANA_SAME}`, "2. Luis: in k3, at offset 29, insert ' each month'"],
  },
  {
    title: 'A moment later, a check',
    text: 'The digest of the server’s document matches both: “Late payments add a small fee each month.” Where both type at the very same place, the change the server put second goes after the first, on every screen.',
    ana: [K1, K2, { id: 'k3', text: marked() }],
    luis: [K1, K2, { id: 'k3', text: marked() }],
    server: [`1. Ana: ${ANA_SAME}`, "2. Luis: in k3, at offset 29, insert ' each month'", 'digest of the document → both match'],
    check: true,
  },
];

const SCENARIOS = [
  ['Different paragraphs', APART],
  ['The same paragraph', TOGETHER],
] as const;

const MARK = { mine: 'border-[#e8c66a] bg-pastel-yellow', theirs: 'border-[#bfd3f7] bg-pastel-blue' };

function Screen({ who, doc, check }: { who: string; doc: Para[]; check?: boolean }) {
  return (
    <div className="min-w-0 flex-[1_1_220px] rounded-xl border border-border bg-white p-3.5">
      <p className="m-0 flex items-center justify-between text-[13px] font-semibold text-ink">
        {who}’s screen
        {check && <span className="rounded-full bg-pastel-green px-2 py-0.5 text-[11px] font-semibold text-pastel-green-fg">digest ✓</span>}
      </p>
      <ol className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
        {doc.map((para) => (
          <li key={para.id} className={`flex animate-enter items-center gap-2 rounded-lg border px-2.5 py-1.75 transition-colors duration-300 ${para.mark ? MARK[para.mark] : 'border-border'}`}>
            <code className="flex-none rounded bg-hover px-1.5 font-code text-[11px] text-muted">{para.id}</code>
            <span className="min-w-0 flex-1 text-sm text-[#37352f]">
              {typeof para.text === 'string'
                ? para.text
                : para.text.map(([piece, mark], i) =>
                    mark ? (
                      <mark key={i} className={`rounded-[3px] border px-0.5 text-inherit ${MARK[mark]}`}>
                        {piece}
                      </mark>
                    ) : (
                      <span key={i}>{piece}</span>
                    ),
                  )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Two people on one document, change by change. */
export function CollabDemo() {
  const [scenario, setScenario] = useState(0);
  const [at, setAt] = useState(0);
  const STEPS = SCENARIOS[scenario][1];
  const step = STEPS[at];

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <div className="bg-surface px-7 py-6">
        <div className="mb-4 inline-flex rounded-lg border border-border bg-white p-0.5">
          {SCENARIOS.map(([name], i) => (
            <button
              key={name}
              type="button"
              aria-pressed={scenario === i}
              onClick={() => {
                setScenario(i);
                setAt(0);
              }}
              className={`cursor-pointer rounded-md border-0 px-3 py-1.5 text-[13px] font-medium transition-colors ${scenario === i ? 'bg-ink text-white' : 'bg-transparent text-ink-soft hover:bg-hover'}`}
            >
              {name}
            </button>
          ))}
        </div>
        <p className={`${CAPTION} flex items-center gap-2`}>
          <span className="size-2 animate-pulse-dot rounded-full bg-brand" aria-hidden="true" />
          Step {at + 1} of {STEPS.length}
        </p>
        <div key={`${scenario}-${at}`} className="animate-enter">
          <p className="m-0 mt-2 font-display text-xl font-bold tracking-[-0.01em]">{step.title}</p>
          <p className="m-0 mt-1.5 max-w-[760px] text-base leading-[1.6] text-ink-soft">{step.text}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <Screen who="Ana" doc={step.ana} check={step.check} />
          <Screen who="Luis" doc={step.luis} check={step.check} />
        </div>
        <div className="mt-4 rounded-xl bg-[#2f2e2b] px-4 py-3.5 font-code text-[13px] leading-[1.75] text-[#edece8]" aria-live="polite">
          <div className="text-[#a8a49a]">{'// the server'}</div>
          {step.server.length ? (
            step.server.map((line) => (
              <div key={line} className={`whitespace-pre-wrap ${line.startsWith('digest') ? 'text-[#9ee0b0]' : line.includes('rebased') ? 'text-[#9cc0fa]' : 'text-[#f5c443]'}`}>
                {line}
              </div>
            ))
          ) : (
            <div className="text-[#a8a49a]">nothing yet</div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={at === 0}
            onClick={() => setAt(at - 1)}
            className="h-9 cursor-pointer rounded-lg border border-border-strong bg-white px-3 text-sm text-ink hover:bg-hover disabled:cursor-default disabled:opacity-40"
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={at === STEPS.length - 1}
            onClick={() => setAt(at + 1)}
            className="h-9 cursor-pointer rounded-lg border-0 bg-brand px-3.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-default disabled:opacity-40"
          >
            Next →
          </button>
          <span className="ml-auto flex flex-wrap gap-3 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-[3px] border border-[#e8c66a] bg-pastel-yellow" />
              their own change
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-[3px] border border-[#bfd3f7] bg-pastel-blue" />
              arrived from the other
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
