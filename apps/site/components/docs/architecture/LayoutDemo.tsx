'use client';

import { useRef, useState } from 'react';
import { DemoBox, Readout } from '../ui';
import { useFontOf, useLines } from './lines';

const TEXT =
  'The tenant pays the rent on the first day of each month, by bank transfer. Rent is late after the fifth, and late rent adds a fee of five per cent, which the landlord may waive in writing.';
const LINE = 26;

/** A paragraph broken into lines by code, not by the browser: drag the width and watch it ask for nothing it already knows. */
export function LayoutDemo() {
  const [width, setWidth] = useState(360);
  const [justify, setJustify] = useState(false);
  const sample = useRef<HTMLDivElement>(null);
  const font = useFontOf(sample);
  const { lines, asked, known } = useLines(TEXT, font, width, LINE, justify);

  return (
    <DemoBox
      aside={
        <>
          <Readout
            label="What the engine did"
            lines={[
              ['lines', String(lines.length), 'good'],
              ['widths asked of the browser', String(asked), asked ? 'warn' : 'good'],
              ['widths it already knew', String(known), 'good'],
              ['line breaks by the browser', '0', 'good'],
            ]}
          />
          <p className="m-0 text-[15px] leading-[1.6] text-ink-soft">
            Drag the width: the lines change, but after the first time no width is asked again — each word is known. Here the browser measures; in Node, a font file does, and the same code makes the PDF.
          </p>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="layout-width" className="text-[13px] text-ink-soft">
          Width
        </label>
        <input id="layout-width" type="range" min={200} max={460} step={2} value={width} onChange={(event) => setWidth(Number(event.target.value))} className="flex-[1_1_160px] accent-brand" />
        <span className="w-[60px] font-code text-[13px]">{width} px</span>
        <button
          type="button"
          aria-pressed={justify}
          onClick={() => setJustify(!justify)}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${justify ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink hover:bg-hover'}`}
        >
          Justify
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <div
          ref={sample}
          role="img"
          aria-label={`The paragraph in ${lines.length} lines`}
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
