'use client';

// trackEdit of @rebodocs/core on two texts typed here: whatever turned one into
// the other comes back as changes, word by word or letter by letter. Accepting
// them gives the later text, rejecting them the earlier one.

import { type Doc, acceptRevisions, createDoc, rejectRevisions, revisionsOf, trackEdit } from '@rebodocs/core';
import { useDeferredValue, useMemo, useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { Tracked, plain } from './Tracked';

const docOf = (text: string): Doc => createDoc(text.split('\n').map((line) => ({ props: {}, runs: [{ text: line, props: {} }] })));

export default function TrackEditDemo() {
  const [before, setBefore] = useState('Payment is due within 15 days of this receipt.\nLate payments add a fee.');
  const [after, setAfter] = useState('Payment is due within 50 days of this receipt, in writing.\nLate payments add a fee of 2%.');
  const [words, setWords] = useState(true);
  const was = useDeferredValue(before);
  const now = useDeferredValue(after);

  const { doc, changes, accepted, rejected } = useMemo(() => {
    const tracked = trackEdit(docOf(was), docOf(now), { author: 'Luis', date: '2026-10-19T09:30:00Z' }, { words }).doc;
    return {
      doc: tracked,
      changes: revisionsOf(tracked),
      accepted: plain(acceptRevisions(tracked).paragraphs),
      rejected: plain(rejectRevisions(tracked).paragraphs),
    };
  }, [was, now, words]);

  const box = 'mt-2 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-[14px] leading-[1.6] text-ink';

  return (
    <DemoBox
      title="trackEdit"
      aside={
        <>
          <div>
            <p className={CAPTION} id="te-unit">
              Changes go
            </p>
            <div role="group" aria-labelledby="te-unit" className="mt-2.5 flex gap-2">
              {[
                [true, 'word by word'],
                [false, 'letter by letter'],
              ].map(([value, label]) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={words === value}
                  onClick={() => setWords(value as boolean)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold ${words === value ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`}
                >
                  {label as string}
                </button>
              ))}
            </div>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">The editor tracks letter by letter as you type; trackDocEdit, word by word.</p>
          </div>
          <Readout
            label="revisionsOf(doc)"
            live={false}
            lines={
              changes.length
                ? changes.slice(0, 6).map((r, i) => [`${i + 1}. ${r.type}`, `«${r.text}»`, r.type === 'insert' ? 'good' : 'warn'])
                : [['—', 'no change', 'dim']]
            }
          />
          {changes.length > 6 && <p className="m-0 -mt-2 text-[13px] text-muted">and {changes.length - 6} more</p>}
          <Readout
            label="Settled"
            lines={[
              ['acceptRevisions(doc)', accepted === now ? 'the later text ✓' : 'differs', accepted === now ? 'good' : 'warn'],
              ['rejectRevisions(doc)', rejected === was ? 'the earlier text ✓' : 'differs', rejected === was ? 'good' : 'warn'],
            ]}
          />
        </>
      }
    >
      <div className="grid gap-4">
        <label className={CAPTION}>
          Before
          <textarea value={before} onChange={(e) => setBefore(e.target.value)} rows={2} className={`${box} normal-case tracking-normal`} />
        </label>
        <label className={CAPTION}>
          After
          <textarea value={after} onChange={(e) => setAfter(e.target.value)} rows={2} className={`${box} normal-case tracking-normal`} />
        </label>
        <div>
          <p className={CAPTION}>Tracked, by Luis</p>
          <Tracked paragraphs={doc.paragraphs} className="mt-2 rounded-lg bg-surface px-4 py-3 text-[15px] leading-[1.7] text-ink" />
        </div>
      </div>
    </DemoBox>
  );
}
