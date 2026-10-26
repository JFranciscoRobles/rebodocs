'use client';

import { useState } from 'react';
import { useT } from '@/components/i18n';
import type { L } from '@/lib/i18n';
import { DemoBox, Readout } from '../ui';

/** A paragraph, with the number of the object it is: the same number is the same object. */
interface Para {
  object: number;
  text: string;
}

/** The receipt, and the words typed at the start of a paragraph, in each language of the site. */
const TEXTS: L<{ lines: string[]; words: string[]; join: string }> = {
  en: { lines: ['Receipt', 'Payment is due within 15 days.', 'Late payments add a fee.', 'Signed, Ana'], words: ['Hello', 'Now', 'Note:', 'Also'], join: ' ' },
  es: { lines: ['Recibo', 'El pago vence a los 15 días.', 'Los pagos tardíos suman un recargo.', 'Firmado, Ana'], words: ['Hola', 'Ahora', 'Nota:', 'También'], join: ' ' },
  zh: { lines: ['收据', '应在 15 天内付款。', '逾期付款将加收费用。', '签名：Ana'], words: ['你好', '现在', '注：', '另外'], join: '' },
};
const startOf = (lines: string[]): Para[] => lines.map((text, i) => ({ object: i + 1, text }));
const MAX = 8;

function Column({ title, doc, other, onEdit }: { title: string; doc: Para[]; other?: Para[]; onEdit?: (i: number) => void }) {
  const t = useT();
  return (
    <div className="min-w-0 flex-[1_1_220px]">
      <p className="m-0 font-code text-[13px] font-medium text-muted">{title}</p>
      <ol className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
        {doc.map((para, i) => {
          const shared = other ? other[i]?.object === para.object : undefined;
          const look = shared === undefined ? 'border-border bg-white' : shared ? 'border-[#b7dcc0] bg-pastel-green' : 'border-[#e8c66a] bg-pastel-yellow';
          const body = (
            <>
              <span className="min-w-0 flex-1 truncate text-sm text-[#37352f]">{para.text}</span>
              <span className="flex-none font-code text-[11px] text-muted">#{para.object}</span>
            </>
          );
          return (
            <li key={i}>
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(i)}
                  aria-label={t({ en: `Type in paragraph ${i}: ${para.text}`, es: `Escribir en el párrafo ${i}: ${para.text}`, zh: `在第 ${i} 段中输入：${para.text}` })}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors duration-300 hover:border-brand ${look}`}
                >
                  {body}
                </button>
              ) : (
                <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors duration-300 ${look}`}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Typing makes a new document that shares every paragraph it did not touch; undo is going back to the one before. */
export function ValueDemo() {
  const t = useT();
  const { lines, words: WORDS, join } = t(TEXTS);
  const START = startOf(lines);
  const [versions, setVersions] = useState<Para[][]>([START]);
  const [made, setMade] = useState(START.length);
  const [last, setLast] = useState<number>();

  const doc = versions[versions.length - 1];
  const before = versions[versions.length - 2];
  const shared = before ? doc.filter((para, i) => before[i].object === para.object).length : doc.length;

  const edit = (i: number) => {
    const word = WORDS[(versions.length - 1) % WORDS.length];
    const next = doc.map((para, j) => (j === i ? { object: made + 1, text: `${word}${join}${para.text}` } : para));
    setVersions([...versions, next].slice(-MAX));
    setMade(made + 1);
    setLast(i);
  };

  return (
    <DemoBox
      aside={
        <>
          <Readout
            label={t({ en: 'What the engine sees', es: 'Lo que ve el motor', zh: '引擎看到的' })}
            lines={[
              [t({ en: 'versions kept', es: 'versiones guardadas', zh: '保留的版本' }), String(versions.length), 'good'],
              [
                t({ en: 'shared with the last one', es: 'compartidos con la anterior', zh: '与上一版共享' }),
                before ? t({ en: `${shared} of ${doc.length} paragraphs`, es: `${shared} de ${doc.length} párrafos`, zh: `${doc.length} 段中的 ${shared} 段` }) : '—',
                before ? 'good' : 'dim',
              ],
              [
                t({ en: 'made again', es: 'hechos de nuevo', zh: '重新生成' }),
                before ? t({ en: `${doc.length - shared} (paragraph ${last})`, es: `${doc.length - shared} (párrafo ${last})`, zh: `${doc.length - shared}（第 ${last} 段）` }) : '—',
                before ? 'warn' : 'dim',
              ],
              [
                t({ en: 'laid out again', es: 'compuestos de nuevo', zh: '重新排版' }),
                before
                  ? t({
                      en: `${doc.length - shared} of ${doc.length}: the rest keep their lines`,
                      es: `${doc.length - shared} de ${doc.length}: el resto conserva sus líneas`,
                      zh: `${doc.length} 段中的 ${doc.length - shared} 段：其余保留原来的分行`,
                    })
                  : '—',
                before ? 'warn' : 'dim',
              ],
              [
                t({ en: 'sent to the others', es: 'enviado a los demás', zh: '发送给其他人' }),
                before ? t({ en: `one change, naming paragraph ${last}`, es: `un cambio, que nombra el párrafo ${last}`, zh: `一处更改，指明第 ${last} 段` }) : '—',
                before ? 'warn' : 'dim',
              ],
              [t({ en: 'how it is found', es: 'cómo se encuentra', zh: '如何发现' }), before ? 'doc.paragraphs[i] !== before.paragraphs[i]' : '—', 'dim'],
            ]}
          />
          <p className="m-0 text-[15px] leading-[1.6] text-ink-soft">
            {t({
              en: 'Green is the very same object in both documents: nothing to copy, nothing to lay out again, nothing to send. Yellow is the one paragraph made again — the only one the layout below breaks into lines again, and the only one the change sent to the others is about.',
              es: 'El verde es exactamente el mismo objeto en los dos documentos: nada que copiar, nada que volver a componer, nada que enviar. El amarillo es el único párrafo hecho de nuevo: el único que la composición de abajo vuelve a cortar en líneas, y el único del que trata el cambio enviado a los demás.',
              zh: '绿色表示两份文档中完全相同的对象：无需复制、无需重新排版、无需发送。黄色是唯一重新生成的段落——也是下面的排版唯一需要重新分行的段落，以及发送给其他人的更改唯一涉及的段落。',
            })}
          </p>
        </>
      }
    >
      <p className="m-0 text-sm text-muted">
        {t({
          en: 'Click a paragraph to type in it. The number is which object it is.',
          es: 'Haz clic en un párrafo para escribir en él. El número dice qué objeto es.',
          zh: '点击一个段落即可在其中输入。编号表示它是哪个对象。',
        })}
      </p>
      <div className="mt-4 flex flex-wrap gap-5">
        {before && <Column title="before" doc={before} />}
        <Column title={before ? 'next' : 'doc'} doc={doc} other={before} onEdit={edit} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!before}
          onClick={() => setVersions(versions.slice(0, -1))}
          className="h-9 cursor-pointer rounded-lg border border-border-strong bg-white px-3 text-sm text-ink hover:bg-hover disabled:cursor-default disabled:opacity-40"
        >
          {t({ en: 'Undo: go back to the one before', es: 'Deshacer: volver al anterior', zh: '撤销：回到上一个' })}
        </button>
        <button type="button" onClick={() => setVersions([START])} className="cursor-pointer border-0 bg-transparent text-[13px] text-muted underline">
          {t({ en: 'Start again', es: 'Empezar de nuevo', zh: '重新开始' })}
        </button>
      </div>
    </DemoBox>
  );
}
