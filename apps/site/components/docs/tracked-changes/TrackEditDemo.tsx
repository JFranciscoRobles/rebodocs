'use client';

// trackEdit of @rebodocs/core on two texts typed here: whatever turned one into
// the other comes back as changes, word by word or letter by letter. Accepting
// them gives the later text, rejecting them the earlier one.

import { type Doc, acceptRevisions, createDoc, rejectRevisions, revisionsOf, trackEdit } from '@rebodocs/core';
import { useDeferredValue, useMemo, useState } from 'react';
import { useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { Tracked, plain } from './Tracked';

const docOf = (text: string): Doc => createDoc(text.split('\n').map((line) => ({ props: {}, runs: [{ text: line, props: {} }] })));

/** The two texts to start with, in each language of the site. */
const START: L<[string, string]> = {
  en: ['Payment is due within 15 days of this receipt.\nLate payments add a fee.', 'Payment is due within 50 days of this receipt, in writing.\nLate payments add a fee of 2%.'],
  es: ['El pago vence a los 15 días de este recibo.\nLos pagos tardíos suman un recargo.', 'El pago vence a los 50 días de este recibo, por escrito.\nLos pagos tardíos suman un recargo del 2%.'],
  zh: ['应在本收据开具后 15 天内付款。\n逾期付款加收费用。', '应在本收据开具后 50 天内以书面形式付款。\n逾期付款加收 2% 的费用。'],
};

export default function TrackEditDemo() {
  const t = useT();
  const [before, setBefore] = useState(() => t(START)[0]);
  const [after, setAfter] = useState(() => t(START)[1]);
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
              {t({ en: 'Changes go', es: 'Los cambios van', zh: '修订粒度' })}
            </p>
            <div role="group" aria-labelledby="te-unit" className="mt-2.5 flex gap-2">
              {[
                [true, t({ en: 'word by word', es: 'palabra por palabra', zh: '逐词' })],
                [false, t({ en: 'letter by letter', es: 'letra por letra', zh: '逐字符' })],
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
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">
              {t({
                en: 'The editor tracks letter by letter as you type; trackDocEdit, word by word.',
                es: 'El editor controla letra por letra mientras escribes; trackDocEdit, palabra por palabra.',
                zh: '编辑器在你输入时逐字符记录修订；trackDocEdit 则逐词记录。',
              })}
            </p>
          </div>
          <Readout
            label="revisionsOf(doc)"
            live={false}
            lines={
              changes.length
                ? changes.slice(0, 6).map((r, i) => [`${i + 1}. ${r.type}`, `«${r.text}»`, r.type === 'insert' ? 'good' : 'warn'])
                : [['—', t({ en: 'no change', es: 'ningún cambio', zh: '没有更改' }), 'dim']]
            }
          />
          {changes.length > 6 && (
            <p className="m-0 -mt-2 text-[13px] text-muted">{t({ en: `and ${changes.length - 6} more`, es: `y ${changes.length - 6} más`, zh: `还有 ${changes.length - 6} 处` })}</p>
          )}
          <Readout
            label={t({ en: 'Settled', es: 'Resuelto', zh: '处理结果' })}
            lines={[
              [
                'acceptRevisions(doc)',
                accepted === now ? t({ en: 'the later text ✓', es: 'el texto posterior ✓', zh: '较新的文字 ✓' }) : t({ en: 'differs', es: 'difiere', zh: '不同' }),
                accepted === now ? 'good' : 'warn',
              ],
              [
                'rejectRevisions(doc)',
                rejected === was ? t({ en: 'the earlier text ✓', es: 'el texto anterior ✓', zh: '较早的文字 ✓' }) : t({ en: 'differs', es: 'difiere', zh: '不同' }),
                rejected === was ? 'good' : 'warn',
              ],
            ]}
          />
        </>
      }
    >
      <div className="grid gap-4">
        <label className={CAPTION}>
          {t({ en: 'Before', es: 'Antes', zh: '之前' })}
          <textarea value={before} onChange={(e) => setBefore(e.target.value)} rows={2} className={`${box} normal-case tracking-normal`} />
        </label>
        <label className={CAPTION}>
          {t({ en: 'After', es: 'Después', zh: '之后' })}
          <textarea value={after} onChange={(e) => setAfter(e.target.value)} rows={2} className={`${box} normal-case tracking-normal`} />
        </label>
        <div>
          <p className={CAPTION}>{t({ en: 'Tracked, by Luis', es: 'Controlado, por Luis', zh: '修订，由 Luis 做出' })}</p>
          <Tracked paragraphs={doc.paragraphs} className="mt-2 rounded-lg bg-surface px-4 py-3 text-[15px] leading-[1.7] text-ink" />
        </div>
      </div>
    </DemoBox>
  );
}
