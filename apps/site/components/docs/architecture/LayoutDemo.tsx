'use client';

import { useRef, useState } from 'react';
import { useT } from '@/components/i18n';
import type { L } from '@/lib/i18n';
import { DemoBox, Readout } from '../ui';
import { useFontOf, useLines } from './lines';

const TEXT: L = {
  en: 'The tenant pays the rent on the first day of each month, by bank transfer. Rent is late after the fifth, and late rent adds a fee of five per cent, which the landlord may waive in writing.',
  es: 'El inquilino paga la renta el primer día de cada mes, por transferencia bancaria. La renta se retrasa después del día cinco, y la renta atrasada suma un recargo del cinco por ciento, que el arrendador puede perdonar por escrito.',
  zh: '承租人应于每月第一天以银行转账方式支付租金。租金在每月五日之后视为逾期，逾期租金加收百分之五的滞纳金，出租人可以书面形式予以免除。',
};
const LINE = 26;

/** A paragraph broken into lines by code, not by the browser: drag the width and watch it ask for nothing it already knows. */
export function LayoutDemo() {
  const t = useT();
  const [width, setWidth] = useState(360);
  const [justify, setJustify] = useState(false);
  const sample = useRef<HTMLDivElement>(null);
  const font = useFontOf(sample);
  const { lines, asked, known } = useLines(t(TEXT), font, width, LINE, justify);

  return (
    <DemoBox
      aside={
        <>
          <Readout
            label={t({ en: 'What the engine did', es: 'Lo que hizo el motor', zh: '引擎做了什么' })}
            lines={[
              [t({ en: 'lines', es: 'líneas', zh: '行数' }), String(lines.length), 'good'],
              [t({ en: 'widths asked of the browser', es: 'anchos pedidos al navegador', zh: '向浏览器询问的宽度' }), String(asked), asked ? 'warn' : 'good'],
              [t({ en: 'widths it already knew', es: 'anchos que ya conocía', zh: '已知的宽度' }), String(known), 'good'],
              [t({ en: 'line breaks by the browser', es: 'cortes de línea del navegador', zh: '浏览器做的换行' }), '0', 'good'],
            ]}
          />
          <p className="m-0 text-[15px] leading-[1.6] text-ink-soft">
            {t({
              en: 'Drag the width: the lines change, but after the first time no width is asked again — each word is known. Here the browser measures; in Node, a font file does, and the same code makes the PDF.',
              es: 'Arrastra el ancho: las líneas cambian, pero después de la primera vez no se vuelve a pedir ningún ancho: cada palabra ya se conoce. Aquí mide el navegador; en Node, un archivo de fuente, y el mismo código genera el PDF.',
              zh: '拖动宽度：行会变化，但第一次之后不会再询问任何宽度——每个词（每个汉字）都已知。这里由浏览器测量；在 Node 中由字体文件测量，生成 PDF 的是同一套代码。',
            })}
          </p>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="layout-width" className="text-[13px] text-ink-soft">
          {t({ en: 'Width', es: 'Ancho', zh: '宽度' })}
        </label>
        <input id="layout-width" type="range" min={200} max={460} step={2} value={width} onChange={(event) => setWidth(Number(event.target.value))} className="flex-[1_1_160px] accent-brand" />
        <span className="w-[60px] font-code text-[13px]">{width} px</span>
        <button
          type="button"
          aria-pressed={justify}
          onClick={() => setJustify(!justify)}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${justify ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink hover:bg-hover'}`}
        >
          {t({ en: 'Justify', es: 'Justificar', zh: '两端对齐' })}
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div
          ref={sample}
          role="img"
          aria-label={t({ en: `The paragraph in ${lines.length} lines`, es: `El párrafo en ${lines.length} líneas`, zh: `该段落共 ${lines.length} 行` })}
          className="relative border-x border-dashed border-[#8db4f5] text-[15px] text-[#37352f]"
          style={{ width, height: Math.max(1, lines.length) * LINE }}
        >
          {lines.map((line) =>
            line.words.map((word, i) => (
              <span key={`${line.y}-${i}`} className="absolute whitespace-pre leading-[26px] transition-[left,top] duration-150" style={{ left: word.x, top: line.y }}>
                {word.text}
              </span>
            )),
          )}
        </div>
      </div>
    </DemoBox>
  );
}
