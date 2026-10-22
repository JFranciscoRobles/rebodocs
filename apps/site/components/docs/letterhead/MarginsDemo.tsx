'use client';

// letterheadMargins of @rebodocs/core on a letterhead drawn here: the band at
// the top and the address at the foot made taller or left out, a faint pattern
// on or off, and the margins it asks for drawn over it.

import { letterheadMargins } from '@rebodocs/core';
import { useEffect, useRef, useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
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

const pt = (value: number | undefined) => (value === undefined ? 'nothing asked' : `${value.toFixed(1)} pt`);

export default function MarginsDemo() {
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
            Band at the top · {design.top} pt
            <input type="range" min={0} max={320} value={design.top} onChange={(e) => set({ top: Number(e.target.value) })} className={slider} />
          </label>
          <label className={CAPTION}>
            Address at the foot · {design.bottom} pt
            <input type="range" min={0} max={320} value={design.bottom} onChange={(e) => set({ bottom: Number(e.target.value) })} className={slider} />
          </label>
          <button
            type="button"
            aria-pressed={design.pattern}
            onClick={() => set({ pattern: !design.pattern })}
            className={`self-start cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold ${design.pattern ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`}
          >
            Faint pattern
          </button>
          <Readout
            label="What it asks for"
            lines={[
              ['top', pt(asked.top), asked.top === undefined ? 'dim' : 'good'],
              ['bottom', pt(asked.bottom), asked.bottom === undefined ? 'dim' : 'good'],
            ]}
          />
          <p className="m-0 text-[13px] leading-normal text-muted">
            Where the printing ends, plus 18 pt. A band reaching past 35% of the page is not at its edge, and the faint pattern is not in the way: neither asks for anything. The editor never gives a margin more than 40% of the page.
          </p>
        </>
      }
    >
      <div className="relative mx-auto w-full max-w-[340px] shadow-[0_1px_4px_rgba(0,0,0,0.12)]">
        <canvas ref={canvas} className="block h-auto w-full" aria-label="The letterhead" />
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
