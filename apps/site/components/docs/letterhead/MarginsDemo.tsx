'use client';

// letterheadMargins of @rebodocs/core on a letterhead drawn here: the band at
// the top and the address at the foot made taller or left out, a faint pattern
// on or off, and the margins it asks for drawn over it.

import { letterheadMargins } from '@rebodocs/core';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import type { T } from '@/lib/i18n';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { type Design, DESIGNS, PAGE, drawLetterhead } from './draw';

/** As the editor reads a picture: small, 320 pixels across. */
function margins(source: HTMLCanvasElement) {
  const width = 320;
  const height = Math.round((source.height * width) / source.width);
  const small = document.createElement('canvas');
  small.width = width;
  small.height = height;
  const g = small.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(source, 0, 0, width, height);
  return letterheadMargins({ width, height, data: g.getImageData(0, 0, width, height).data }, PAGE);
}

const pt = (value: number | undefined, t: T) => (value === undefined ? t({ en: 'nothing asked', es: 'no pide nada', zh: '无要求' }) : `${value.toFixed(1)} pt`);

export default function MarginsDemo() {
  const t = useT();
  const [design, setDesign] = useState<Design>(DESIGNS.studio);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [asked, setAsked] = useState<{ top?: number; bottom?: number }>({});

  useEffect(() => {
    if (!canvas.current) return;
    drawLetterhead(canvas.current, design, 1);
    setAsked(margins(canvas.current));
  }, [design]);

  const set = (patch: Partial<Design>) => setDesign((was) => ({ ...was, ...patch }));
  const slider = 'mt-2 w-full accent-[#1f4e8c]';

  return (
    <DemoBox
      title="letterheadMargins"
      aside={
        <>
          <label className={CAPTION}>
            {t({ en: 'Band at the top', es: 'Franja de arriba', zh: '顶部色带' })} · {design.top} pt
            <input type="range" min={0} max={320} value={design.top} onChange={(e) => set({ top: Number(e.target.value) })} className={slider} />
          </label>
          <label className={CAPTION}>
            {t({ en: 'Address at the foot', es: 'Dirección al pie', zh: '底部地址' })} · {design.bottom} pt
            <input type="range" min={0} max={320} value={design.bottom} onChange={(e) => set({ bottom: Number(e.target.value) })} className={slider} />
          </label>
          <button
            type="button"
            aria-pressed={design.pattern}
            onClick={() => set({ pattern: !design.pattern })}
            className={`self-start cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold ${design.pattern ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`}
          >
            {t({ en: 'Faint pattern', es: 'Motivo tenue', zh: '淡色图案' })}
          </button>
          <Readout
            label={t({ en: 'What it asks for', es: 'Lo que pide', zh: '所需页边距' })}
            lines={[
              ['top', pt(asked.top, t), asked.top === undefined ? 'dim' : 'good'],
              ['bottom', pt(asked.bottom, t), asked.bottom === undefined ? 'dim' : 'good'],
            ]}
          />
          <p className="m-0 text-[13px] leading-normal text-muted">
            {t({
              en: 'Where the printing ends, plus 18 pt. A band reaching past 35% of the page is not at its edge, and the faint pattern is not in the way: neither asks for anything. The editor never gives a margin more than 40% of the page.',
              es: 'Donde termina lo impreso, más 18 pt. Una franja que pasa del 35% de la página no está en su borde, y el motivo tenue no estorba: ninguno pide nada. El editor nunca da un margen de más del 40% de la página.',
              zh: '印刷内容结束的位置再加 18 pt。超过页面 35% 的色带不算位于边缘，淡色图案也不碍事：两者都不要求调整页边距。编辑器给出的页边距绝不会超过页面的 40%。',
            })}
          </p>
        </>
      }
    >
      <div className="relative mx-auto w-full max-w-[340px] shadow-[0_1px_4px_rgba(0,0,0,0.12)]">
        <canvas ref={canvas} className="block h-auto w-full" aria-label={t({ en: 'The letterhead', es: 'El membrete', zh: '信头' })} />
        {asked.top !== undefined && (
          <div className="absolute inset-x-0 border-t-2 border-dashed border-[#d6336c]" style={{ top: `${(Math.min(asked.top, PAGE.height) / PAGE.height) * 100}%` }}>
            <span className="absolute right-1 top-0.5 rounded bg-white/90 px-1 font-code text-[11px] text-[#d6336c]">marginTop</span>
          </div>
        )}
        {asked.bottom !== undefined && (
          <div className="absolute inset-x-0 border-b-2 border-dashed border-[#d6336c]" style={{ bottom: `${(Math.min(asked.bottom, PAGE.height) / PAGE.height) * 100}%` }}>
            <span className="absolute bottom-0.5 right-1 rounded bg-white/90 px-1 font-code text-[11px] text-[#d6336c]">marginBottom</span>
          </div>
        )}
      </div>
    </DemoBox>
  );
}
