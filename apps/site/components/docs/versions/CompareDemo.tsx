'use client';

// compareDocs of @rebodocs/core on two versions typed here, a paragraph a line:
// what changed, as the list a program reads and as the document a person
// looks at; and restoreVersion, which takes the later one back to the earlier.

import { type Doc, compareDocs, createDoc, describeChange, restoreVersion } from '@rebodocs/core';
import { useDeferredValue, useMemo, useState } from 'react';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { Compared, plain } from './Compared';

const docOf = (text: string): Doc => createDoc(text.split('\n').map((line) => ({ props: {}, runs: [{ text: line, props: {} }] })));

const TONE = { added: 'good', removed: 'warn', changed: undefined, formatted: 'dim' } as const;

export default function CompareDemo() {
  const [before, setBefore] = useState('Payment is due within 15 days of this receipt.\nLate payments add a fee.\nPrices include taxes.');
  const [after, setAfter] = useState('Payment is due within 30 days of this receipt.\nLate payments add a fee of 2% a month.\nKeys are returned at the front desk.');
  const was = useDeferredValue(before);
  const now = useDeferredValue(after);

  const { comparison, restored } = useMemo(() => {
    const earlier = docOf(was);
    const later = docOf(now);
    return { comparison: compareDocs(earlier, later), restored: plain(restoreVersion(later, earlier).paragraphs) };
  }, [was, now]);
  const { changes } = comparison;

  const box = 'mt-2 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-[14px] leading-[1.6] text-ink';

  return (
    <DemoBox
      title="compareDocs"
      aside={
        <>
          <Readout
            label="changes"
            live={false}
            lines={changes.length ? changes.slice(0, 6).map((change, i) => [`${i + 1}. ${change.kind}`, describeChange(change, 16), TONE[change.kind]]) : [['—', 'no change', 'dim']]}
          />
          {changes.length > 6 && <p className="m-0 -mt-2 text-[13px] text-muted">and {changes.length - 6} more</p>}
          <Readout
            label="Going back"
            lines={[
              ['marks.length', String(comparison.marks.length)],
              ['restoreVersion(after, before)', restored === was ? '= before ✓' : 'differs', restored === was ? 'good' : 'warn'],
            ]}
          />
          <p className="m-0 text-[13px] leading-normal text-muted">A paragraph with few of the same words as the one it replaced is two changes, one taken out and one put in, not one that changed.</p>
        </>
      }
    >
      <div className="grid gap-4">
        <label className={CAPTION}>
          Earlier version
          <textarea value={before} onChange={(e) => setBefore(e.target.value)} rows={3} className={`${box} normal-case tracking-normal`} />
        </label>
        <label className={CAPTION}>
          Later version
          <textarea value={after} onChange={(e) => setAfter(e.target.value)} rows={3} className={`${box} normal-case tracking-normal`} />
        </label>
        <div>
          <p className={CAPTION}>comparison.doc</p>
          <Compared paragraphs={comparison.doc.paragraphs} className="mt-2 rounded-lg bg-surface px-4 py-3 text-[15px] leading-[1.7] text-ink" />
        </div>
      </div>
    </DemoBox>
  );
}
