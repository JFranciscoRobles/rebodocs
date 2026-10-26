'use client';

import { useState } from 'react';
import { useT } from '@/components/i18n';
import type { L, T } from '@/lib/i18n';
import { DemoBox, Readout } from '../ui';

/** The properties of the paragraphs of a file as it came, each with one the model does not know. */
const PROPS = [
  { pPr: '<w:pStyle w:val="Title"/><w:suppressLineNumbers/>', unknown: 'w:suppressLineNumbers' },
  { pPr: '<w:snapToGrid w:val="0"/>', unknown: 'w:snapToGrid' },
  { pPr: '<w:kinsoku w:val="0"/>', unknown: 'w:kinsoku' },
  { pPr: '<w:textAlignment w:val="top"/>', unknown: 'w:textAlignment' },
];
/** What each paragraph says, and what it says once changed, in each language of the site. */
const TEXTS: L<[text: string, edited: string][]> = {
  en: [
    ['Receipt', 'Receipt No. 1024'],
    ['Payment is due within 15 days.', 'Payment is due within 30 days.'],
    ['Late payments add a fee.', 'Late payments add a fee each month.'],
    ['Signed, Ana', 'Signed, Ana López'],
  ],
  es: [
    ['Recibo', 'Recibo n.º 1024'],
    ['El pago vence a los 15 días.', 'El pago vence a los 30 días.'],
    ['Los pagos tardíos suman un recargo.', 'Los pagos tardíos suman un recargo cada mes.'],
    ['Firmado, Ana', 'Firmado, Ana López'],
  ],
  zh: [
    ['收据', '收据 第 1024 号'],
    ['应在 15 天内付款。', '应在 30 天内付款。'],
    ['逾期付款将加收费用。', '逾期付款每月加收费用。'],
    ['签名：Ana', '签名：Ana López'],
  ],
};
const paragraphsOf = (t: T) => t(TEXTS).map(([text, edited], i) => ({ text, edited, ...PROPS[i] }));
type Paragraph = ReturnType<typeof paragraphsOf>[number];
/** A paragraph's XML, simplified: its properties as they came, and a run with the text. */
const xmlOf = (pPr: string, text: string) => `<w:p><w:pPr>${pPr}</w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;

/** The XML, with the property the model does not know in purple and the new text in yellow. */
function Xml({ xml, unknown, text }: { xml: string; unknown: string; text?: string }) {
  const pieces = xml.split(new RegExp(`(${unknown}|${text ? text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '$^'})`));
  return (
    <code className="block whitespace-pre-wrap break-all rounded-lg bg-surface px-3 py-2.5 font-code text-[12px] leading-[1.6] text-ink-soft">
      {pieces.map((piece, i) =>
        piece === unknown ? (
          <mark key={i} className="rounded-[3px] bg-pastel-purple px-0.5 text-pastel-purple-fg">
            {piece}
          </mark>
        ) : piece === text ? (
          <mark key={i} className="rounded-[3px] bg-pastel-yellow px-0.5 text-pastel-yellow-fg">
            {piece}
          </mark>
        ) : (
          piece
        ),
      )}
    </code>
  );
}

const paragraphs = (n: number, t: T) => t({ en: `${n} ${n === 1 ? 'paragraph' : 'paragraphs'}`, es: `${n} ${n === 1 ? 'párrafo' : 'párrafos'}`, zh: `${n} 个段落` });
/** Parts of the file the editor never reads. */
const UNREAD = ['word/theme/theme1.xml', 'word/settings.xml', 'customXml/item1.xml'];

/** Open, change some paragraphs, save: what is written back as it was, what is written again, what is carried through. */
export function DocxDemo() {
  const t = useT();
  const PARAGRAPHS = paragraphsOf(t);
  const [changed, setChanged] = useState<Set<number>>(new Set([1]));
  const [saved, setSaved] = useState(false);
  const [look, setLook] = useState(1);

  const flip = (i: number) => {
    setLook(i);
    const next = new Set(changed);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setChanged(next);
    setSaved(false);
  };

  return (
    <DemoBox
      aside={
        <>
          <Readout
            label={saved ? t({ en: 'What was written', es: 'Lo que se escribió', zh: '写出的内容' }) : t({ en: 'Not saved yet', es: 'Sin guardar todavía', zh: '尚未保存' })}
            lines={
              saved
                ? [
                    [t({ en: 'byte for byte', es: 'byte por byte', zh: '逐字节相同' }), paragraphs(PARAGRAPHS.length - changed.size, t), 'good'],
                    [t({ en: 'written again', es: 'escritos de nuevo', zh: '重新写出' }), paragraphs(changed.size, t), changed.size ? 'warn' : 'dim'],
                    [t({ en: 'unknown properties', es: 'propiedades desconocidas', zh: '未知属性' }), t({ en: 'all kept', es: 'todas conservadas', zh: '全部保留' }), 'good'],
                    [
                      t({ en: 'copied through', es: 'copiadas tal cual', zh: '原样复制' }),
                      t({ en: `${UNREAD.length} parts never read`, es: `${UNREAD.length} partes nunca leídas`, zh: `${UNREAD.length} 个从不读取的部分` }),
                      'good',
                    ],
                  ]
                : [[t({ en: 'save', es: 'guardar', zh: '保存' }), t({ en: 'press “Save” to see', es: 'pulsa “Guardar” para verlo', zh: '点击“保存”查看' }), 'dim']]
            }
          />
          <p className="m-0 text-[15px] leading-[1.6] text-ink-soft">
            {t({
              en: 'Each paragraph remembers the XML it came from. Change none and save: the file comes out the same — that is tested on a set of real documents.',
              es: 'Cada párrafo recuerda el XML del que vino. No cambies ninguno y guarda: el archivo sale igual; eso se prueba con un conjunto de documentos reales.',
              zh: '每个段落都记得它来自的 XML。不做任何修改直接保存：文件保持不变——这一点已在一组真实文档上测试过。',
            })}
          </p>
        </>
      }
    >
      <p className="m-0 text-sm text-muted">{t({ en: 'Mark the paragraphs you changed, then save.', es: 'Marca los párrafos que cambiaste y luego guarda.', zh: '勾选你修改过的段落，然后保存。' })}</p>
      <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
        {PARAGRAPHS.map((para, i) => {
          const edited = changed.has(i);
          const state = !saved ? '' : edited ? 'border-[#e8c66a] bg-pastel-yellow' : 'border-[#b7dcc0] bg-pastel-green';
          return (
            <li key={para.text} className={`rounded-lg border px-3 py-2 transition-colors duration-300 ${state || 'border-border bg-white'}`}>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input type="checkbox" checked={edited} onChange={() => flip(i)} className="size-4 accent-brand" />
                <span className="min-w-0 flex-1 text-sm text-[#37352f]">{edited ? para.edited : para.text}</span>
                {saved && (
                  <span className={`flex-none text-xs font-semibold ${edited ? 'text-pastel-yellow-fg' : 'text-pastel-green-fg'}`}>
                    {edited ? t({ en: 'written again', es: 'escrito de nuevo', zh: '重新写出' }) : t({ en: 'byte for byte', es: 'byte por byte', zh: '逐字节相同' })}
                  </span>
                )}
              </label>
              <code className="mt-1 block truncate pl-6.5 font-code text-[11.5px] text-muted">
                {'<w:pPr>'}
                <mark className="rounded-[3px] bg-pastel-purple px-0.5 text-pastel-purple-fg">{para.unknown}</mark>
                {'…'}
              </code>
            </li>
          );
        })}
      </ul>
      <p className="m-0 mt-4 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{t({ en: 'Parts it never reads', es: 'Partes que nunca lee', zh: '从不读取的部分' })}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {UNREAD.map((part) => (
          <code
            key={part}
            className={`rounded-md border px-2 py-0.75 font-code text-[12px] transition-colors duration-300 ${saved ? 'border-[#b7dcc0] bg-pastel-green text-pastel-green-fg' : 'border-border bg-surface text-muted'}`}
          >
            {part}
            {saved && ' ✓'}
          </code>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={() => setSaved(true)} className="h-9 cursor-pointer rounded-lg border-0 bg-brand px-3.5 text-sm font-semibold text-white hover:bg-brand-hover">
          {t({ en: 'Save', es: 'Guardar', zh: '保存' })}
        </button>
        <span className="text-[13px] text-muted">
          {t({
            en: (
              <>
                <mark className="rounded-[3px] bg-pastel-purple px-1 text-pastel-purple-fg">purple</mark> is what the model does not know, and keeps.
              </>
            ),
            es: (
              <>
                el <mark className="rounded-[3px] bg-pastel-purple px-1 text-pastel-purple-fg">morado</mark> es lo que el modelo no conoce, y conserva.
              </>
            ),
            zh: (
              <>
                <mark className="rounded-[3px] bg-pastel-purple px-1 text-pastel-purple-fg">紫色</mark>表示模型不认识但会保留的内容。
              </>
            ),
          })}
        </span>
      </div>
      {saved && <Written paragraphs={PARAGRAPHS} para={PARAGRAPHS[look]} edited={changed.has(look)} onPick={setLook} />}
    </DemoBox>
  );
}

/** One paragraph's XML as it came and as it was written, side by side. */
function Written({ paragraphs: PARAGRAPHS, para, edited, onPick }: { paragraphs: Paragraph[]; para: Paragraph; edited: boolean; onPick: (i: number) => void }) {
  const t = useT();
  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="docx-look" className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
          {t({ en: 'The XML of', es: 'El XML de', zh: '查看 XML：' })}
        </label>
        <select
          id="docx-look"
          value={PARAGRAPHS.indexOf(para)}
          onChange={(event) => onPick(Number(event.target.value))}
          className="h-8 rounded-lg border border-border-strong bg-white px-2 text-[13px] text-ink"
        >
          {PARAGRAPHS.map((p, i) => (
            <option key={p.text} value={i}>
              {p.text}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-muted">{t({ en: 'simplified', es: 'simplificado', zh: '简化版' })}</span>
      </div>
      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
        <div>
          <p className="m-0 mb-1.5 text-[13px] text-muted">{t({ en: 'As it came', es: 'Como vino', zh: '原样' })}</p>
          <Xml xml={xmlOf(para.pPr, para.text)} unknown={para.unknown} />
        </div>
        <div>
          <p className="m-0 mb-1.5 text-[13px] text-muted">
            {edited
              ? t({ en: 'Written again: the properties patched, not rebuilt', es: 'Escrito de nuevo: las propiedades parcheadas, no reconstruidas', zh: '重新写出：属性被修补，而非重建' })
              : t({ en: 'Written: the very same bytes', es: 'Escrito: exactamente los mismos bytes', zh: '写出：完全相同的字节' })}
          </p>
          <Xml xml={xmlOf(para.pPr, edited ? para.edited : para.text)} unknown={para.unknown} text={edited ? para.edited : undefined} />
        </div>
      </div>
    </div>
  );
}
