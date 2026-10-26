'use client';

// A real editor with a letter in it, and the letterheads of draw.ts to give
// it as an application gives it, through the handle: the margins grow to
// clear what each prints. Or one of your own, from the document menu.

import { createDoc, exportDocx, letterheadOf } from '@rebodocs/core';
import { type DocsHandle, type Editor, DocsEditor } from '@rebodocs/react';
import { useMemo, useRef, useState } from 'react';
import { usePageEditorLocale } from '@/components/editorLocale';
import { useLocale, useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { DESIGNS, letterheadFile } from './draw';

const LETTER: L<string[]> = {
  en: [
    'Mexico City, October 21, 2026',
    'Dear Ms. Herrera,',
    'Thank you for choosing us for the renovation of your office. As agreed on Tuesday, the work starts on November 3 and takes six weeks.',
    'The first payment, of a third of the total, is due on the day the work starts. The rest is paid in two parts, at the end of the third week and on the day the work is handed over.',
    'Should anything change, write to us at the address at the foot of this page.',
    'Kind regards,',
    'Ana Robles',
  ],
  es: [
    'Ciudad de México, 21 de octubre de 2026',
    'Estimada Sra. Herrera:',
    'Gracias por elegirnos para la remodelación de su oficina. Como acordamos el martes, la obra empieza el 3 de noviembre y dura seis semanas.',
    'El primer pago, de un tercio del total, vence el día en que empieza la obra. El resto se paga en dos partes, al final de la tercera semana y el día de la entrega.',
    'Si algo cambia, escríbanos a la dirección al pie de esta página.',
    'Saludos cordiales,',
    'Ana Robles',
  ],
  zh: [
    '2026年10月21日，墨西哥城',
    '尊敬的埃雷拉女士：',
    '感谢您选择我们来翻修您的办公室。按照周二的约定，工程将于11月3日开工，工期六周。',
    '首期款为总额的三分之一，于开工当日支付。其余款项分两次支付：第三周结束时一次，交付当日一次。',
    '如有任何变动，请按本页底部的地址与我们联系。',
    '此致敬礼',
    '安娜·罗夫莱斯',
  ],
};

type Pick = keyof typeof DESIGNS | 'none';

const CHOICES: [Pick, L][] = [
  ['studio', { en: 'Band and address', es: 'Franja y dirección', zh: '色带和地址' }],
  ['clinic', { en: 'Tall band, pattern', es: 'Franja alta, motivo', zh: '高色带和图案' }],
  ['pattern', { en: 'Pattern only', es: 'Solo motivo', zh: '仅图案' }],
  ['none', { en: 'None', es: 'Ninguno', zh: '无' }],
];

interface Seen {
  has: boolean;
  part: string;
  top: number;
  bottom: number;
}

const look = (editor: Editor): Seen => ({
  has: editor.hasLetterhead,
  part: letterheadOf(editor.doc)?.part ?? '—',
  top: editor.doc.page.marginTop,
  bottom: editor.doc.page.marginBottom,
});

export default function EditorDemo() {
  const t = useT();
  const page = useLocale();
  const locale = usePageEditorLocale();
  const file = useMemo(() => exportDocx(createDoc(LETTER[page].map((text) => ({ props: {}, runs: [{ text, props: {} }] })))), [page]);
  const handle = useRef<DocsHandle | undefined>(undefined);
  const [picked, setPicked] = useState<Pick>('none');
  const [seen, setSeen] = useState<Seen>();

  const ready = (docs: DocsHandle | undefined) => {
    handle.current = docs;
    if (!docs) return;
    const update = () => setSeen(look(docs.editor));
    update();
    docs.editor.onChange(update);
  };

  const give = async (pick: Pick) => {
    const docs = handle.current;
    if (!docs) return;
    setPicked(pick);
    await docs.setLetterhead(pick === 'none' ? null : await letterheadFile(DESIGNS[pick]));
  };

  const run = (fn: (editor: Editor) => unknown) => {
    const editor = handle.current?.editor;
    if (editor) fn(editor);
  };

  const button = 'cursor-pointer rounded-lg border border-border bg-white px-2.5 py-1 text-[13px] font-semibold text-ink-soft hover:bg-hover disabled:cursor-default disabled:opacity-50';

  return (
    <DemoBox
      title={t({ en: 'Give it a letterhead', es: 'Dale un membrete', zh: '加上信头' })}
      aside={
        <>
          <div>
            <p className={CAPTION} id="lh-pick">
              {t({ en: 'The application gives', es: 'La aplicación da', zh: '应用设置' })}
            </p>
            <div role="group" aria-labelledby="lh-pick" className="mt-2.5 flex flex-wrap gap-2">
              {CHOICES.map(([pick, label]) => (
                <button
                  key={pick}
                  type="button"
                  aria-pressed={picked === pick}
                  onClick={() => void give(pick)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold ${picked === pick ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`}
                >
                  {t(label)}
                </button>
              ))}
            </div>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">
              {t({
                en: 'handle.setLetterhead(file), or null for none. Or pick a picture of your own from the menu, under Page.',
                es: 'handle.setLetterhead(file), o null para ninguno. O elige una imagen tuya en el menú, en Página.',
                zh: 'handle.setLetterhead(file)，传入 null 表示无信头。也可以在菜单的“页面”下选择你自己的图片。',
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={button} disabled={!seen?.has} onClick={() => run((e) => void e.fitLetterheadMargins())}>
              {t({ en: 'Fit the margins', es: 'Ajustar los márgenes', zh: '调整页边距' })}
            </button>
            <button type="button" className={button} onClick={() => run((e) => e.setPage({ marginTop: 72, marginBottom: 72 }, true))}>
              {t({ en: 'Margins back to 1 in', es: 'Márgenes de vuelta a 2,54 cm', zh: '页边距恢复为 2.54 厘米' })}
            </button>
          </div>
          <Readout
            label={t({ en: 'What the editor says', es: 'Lo que dice el editor', zh: '编辑器的状态' })}
            lines={[
              ['hasLetterhead', String(seen?.has ?? '—'), seen?.has ? 'good' : 'dim'],
              ['letterheadOf(doc).part', seen?.has ? `'${seen.part}'` : '—', seen?.has ? undefined : 'dim'],
              ['page.marginTop', seen ? `${seen.top} pt` : '—'],
              ['page.marginBottom', seen ? `${seen.bottom} pt` : '—'],
            ]}
          />
          <p className="m-0 text-[13px] leading-normal text-muted">
            {t({
              en: 'Margins only grow: go from the tall band to the short one, and the top margin stays. Bring them back to an inch first.',
              es: 'Los márgenes solo crecen: pasa de la franja alta a la corta y el margen de arriba se queda. Devuélvelos primero a 2,54 cm.',
              zh: '页边距只增不减：从高色带换成矮色带时，上边距保持不变。请先把页边距恢复为 2.54 厘米。',
            })}
          </p>
        </>
      }
    >
      <div className="-m-5 h-[560px] overflow-hidden rounded-[14px]">
        <DocsEditor docx={file} name="letter.docx" locale={locale} author="Ana" onReady={ready} />
      </div>
    </DemoBox>
  );
}
