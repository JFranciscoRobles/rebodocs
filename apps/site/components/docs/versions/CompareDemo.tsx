'use client';

// compareDocs of @rebodocs/core on two versions typed here, a paragraph a line:
// what changed, as the list a program reads and as the document a person
// looks at; and restoreVersion, which takes the later one back to the earlier.

import { type Doc, compareDocs, createDoc, describeChange, restoreVersion } from '@rebodocs/core';
import { useDeferredValue, useMemo, useState } from 'react';
import { useT } from '@/components/i18n';
import type { L } from '@/lib/i18n';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { Compared, plain } from './Compared';

const docOf = (text: string): Doc => createDoc(text.split('\n').map((line) => ({ props: {}, runs: [{ text: line, props: {} }] })));

const TONE = { added: 'good', removed: 'warn', changed: undefined, formatted: 'dim' } as const;

/** The two versions to start with, in each language of the site. */
const START: L<[string, string]> = {
  en: [
    'Payment is due within 15 days of this receipt.\nLate payments add a fee.\nPrices include taxes.',
    'Payment is due within 30 days of this receipt.\nLate payments add a fee of 2% a month.\nKeys are returned at the front desk.',
  ],
  es: [
    'El pago vence a los 15 días de este recibo.\nLos pagos tardíos suman un recargo.\nLos precios incluyen impuestos.',
    'El pago vence a los 30 días de este recibo.\nLos pagos tardíos suman un recargo del 2% mensual.\nLas llaves se devuelven en la recepción.',
  ],
  zh: ['应在本收据开具后 15 天内付款。\n逾期付款将加收费用。\n价格已含税。', '应在本收据开具后 30 天内付款。\n逾期付款每月加收 2% 的费用。\n钥匙请交还前台。'],
};

export default function CompareDemo() {
  const t = useT();
  const [before, setBefore] = useState(() => t(START)[0]);
  const [after, setAfter] = useState(() => t(START)[1]);
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
            lines={
              changes.length
                ? changes.slice(0, 6).map((change, i) => [`${i + 1}. ${change.kind}`, describeChange(change, 16), TONE[change.kind]])
                : [['—', t({ en: 'no change', es: 'ningún cambio', zh: '没有更改' }), 'dim']]
            }
          />
          {changes.length > 6 && (
            <p className="m-0 -mt-2 text-[13px] text-muted">{t({ en: `and ${changes.length - 6} more`, es: `y ${changes.length - 6} más`, zh: `还有 ${changes.length - 6} 处` })}</p>
          )}
          <Readout
            label={t({ en: 'Going back', es: 'Volver atrás', zh: '还原' })}
            lines={[
              ['marks.length', String(comparison.marks.length)],
              ['restoreVersion(after, before)', restored === was ? '= before ✓' : t({ en: 'differs', es: 'difiere', zh: '不同' }), restored === was ? 'good' : 'warn'],
            ]}
          />
          <p className="m-0 text-[13px] leading-normal text-muted">
            {t({
              en: 'A paragraph with few of the same words as the one it replaced is two changes, one taken out and one put in, not one that changed.',
              es: 'Un párrafo con pocas palabras iguales a las del que reemplazó son dos cambios, uno quitado y uno puesto, no uno que cambió.',
              zh: '如果新段落与被替换的段落相同的词很少，就算作两处更改（一处删除、一处插入），而不是一处修改。',
            })}
          </p>
        </>
      }
    >
      <div className="grid gap-4">
        <label className={CAPTION}>
          {t({ en: 'Earlier version', es: 'Versión anterior', zh: '较早的版本' })}
          <textarea value={before} onChange={(e) => setBefore(e.target.value)} rows={3} className={`${box} normal-case tracking-normal`} />
        </label>
        <label className={CAPTION}>
          {t({ en: 'Later version', es: 'Versión posterior', zh: '较新的版本' })}
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
