'use client';

import { useRef, useState } from 'react';
import { DemoBox, Readout } from '../ui';
import { type Line, useFontOf, useLines } from './lines';

const WIDTH = 210;
const LINE = 20;
/** Lines a page holds. */
const ROOM = 9;
const PAD = 16;

const INTRO = 'The tenant pays the rent on the first day of each month, by bank transfer to the account the landlord names in writing, and keeps the receipts for a year.';
const MORE = ' The deposit is one month of rent, and it is given back within thirty days of the end of the lease.';
const HEADING = '2. Late payments';
const BODY = 'Rent is late after the fifth. Late rent adds a fee of five per cent, which the landlord may waive in writing, once a year.';

type Kind = 'intro' | 'heading' | 'body';
/** A line on a page, and the rule that sent it there, if one did. */
interface Placed {
  kind: Kind;
  text: string;
  moved?: 'widow' | 'orphan' | 'keep';
}

const words = (line: Line) => line.words.map((word) => word.text).join(' ');

/**
 * The paragraphs into pages, by the rules the engine has from Word: a last
 * line alone on the next page takes the one before it along, a first line
 * alone at the foot of a page goes on with the rest, and a heading kept with
 * the next paragraph goes where that paragraph's first lines go.
 */
function paginate(blocks: { kind: Kind; lines: string[]; keepNext?: boolean }[], widows: boolean) {
  const pages: Placed[][] = [[]];
  const room = () => ROOM - pages[pages.length - 1].length;
  // How many lines of a paragraph go on a page with `space` left, by the rules.
  const fits = (total: number, done: number, space: number) => {
    let fit = Math.min(space, total - done);
    const rest = total - done - fit;
    if (widows && rest > 0) {
      if (rest === 1 && fit > 1) fit--;
      if (done === 0 && fit === 1) fit = 0;
    }
    return fit;
  };
  const moved = { widow: 0, orphan: 0, keep: false };

  blocks.forEach((block, b) => {
    let reason: Placed['moved'];
    const next = blocks[b + 1];
    if (block.keepNext && next && pages[pages.length - 1].length) {
      // The heading and the first lines of what follows it, together or not at all.
      const space = room() - block.lines.length;
      if (space < 0 || fits(next.lines.length, 0, space) === 0) {
        pages.push([]);
        moved.keep = true;
        reason = 'keep';
      }
    }
    let done = 0;
    while (done < block.lines.length) {
      const plain = Math.min(room(), block.lines.length - done);
      let fit = fits(block.lines.length, done, room());
      if (fit === 0 && pages[pages.length - 1].length === 0) fit = 1;
      if (fit < plain && !reason) {
        if (done === 0 && fit === 0) {
          reason = 'orphan';
          moved.orphan = 1;
        } else {
          reason = 'widow';
          moved.widow = plain - fit;
        }
      }
      for (let k = 0; k < fit; k++, done++) pages[pages.length - 1].push({ kind: block.kind, text: block.lines[done], moved: pages.length > 1 ? reason : undefined });
      if (done < block.lines.length) pages.push([]);
    }
  });
  return { pages, moved };
}

const toggle = (on: boolean) =>
  `cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink hover:bg-hover'}`;

/** Lines become pages: the text above grows, and the rules keep a line from being left alone. */
export function PagesDemo() {
  const [above, setAbove] = useState(0);
  const [widows, setWidows] = useState(true);
  const [keep, setKeep] = useState(true);
  const sample = useRef<HTMLDivElement>(null);
  const font = useFontOf(sample);
  const intro = useLines(INTRO + MORE.split(' ').slice(0, above + 1).join(' '), font, WIDTH, LINE, false).lines.map(words);
  const body = useLines(BODY, font, WIDTH, LINE, false).lines.map(words);

  const { pages, moved } = paginate(
    [
      { kind: 'intro', lines: intro },
      { kind: 'heading', lines: [HEADING], keepNext: keep },
      { kind: 'body', lines: body },
    ],
    widows,
  );
  const shown = pages.slice(0, 2);
  const steps = MORE.split(' ').length - 1;

  return (
    <DemoBox
      title="Try it: pages"
      aside={
        <>
          <Readout
            label="Where the lines went"
            lines={[
              ['page 1', `${shown[0].length} of ${ROOM} lines`, 'good'],
              ['page 2', `${shown[1]?.length ?? 0} lines`, 'good'],
              ['widow control', !widows ? 'off' : moved.widow ? `took ${moved.widow} line along` : moved.orphan ? 'sent a lone first line on' : 'nothing to do', moved.widow || moved.orphan ? 'warn' : 'dim'],
              ['keep with next', !keep ? 'off' : moved.keep ? 'moved the heading' : 'nothing to do', moved.keep ? 'warn' : 'dim'],
            ]}
          />
          <p className="m-0 text-[15px] leading-[1.6] text-ink-soft">
            Drag the text above until the last paragraph meets the foot of the page. With the rules on, no line is left alone and the heading never ends a page; turn them off to see what they prevent. These are the rules of the
            engine, made small: the real ones also keep lines together, break before a paragraph and split table rows.
          </p>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="pages-above" className="text-[13px] text-ink-soft">
          Text above
        </label>
        <input id="pages-above" type="range" min={0} max={steps} value={above} onChange={(event) => setAbove(Number(event.target.value))} className="flex-[1_1_120px] accent-brand" />
        <button type="button" aria-pressed={widows} onClick={() => setWidows(!widows)} className={toggle(widows)}>
          Widow control
        </button>
        <button type="button" aria-pressed={keep} onClick={() => setKeep(!keep)} className={toggle(keep)}>
          Keep heading with next
        </button>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-4 overflow-x-auto rounded-[10px] bg-[#e9eaee] p-4">
        {[0, 1].map((p) => (
          <div key={p} className="flex flex-col items-center gap-1.5">
            <div
              ref={p === 0 ? sample : undefined}
              className="relative bg-white text-[13px] text-[#37352f] shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
              style={{ width: WIDTH + PAD * 2, height: ROOM * LINE + PAD * 2, padding: PAD }}
            >
              {(shown[p] ?? []).map((line, i) => (
                <div
                  key={`${line.kind}-${i}-${line.text}`}
                  className={`overflow-visible whitespace-nowrap rounded-[2px] transition-colors duration-300 ${line.kind === 'heading' ? 'font-bold' : ''} ${line.moved ? 'bg-pastel-yellow' : ''}`}
                  style={{ height: LINE, lineHeight: `${LINE}px` }}
                >
                  {line.text}
                </div>
              ))}
              {p === 0 && shown[0].length < ROOM && (
                <div
                  className="absolute inset-x-4 flex items-center justify-center rounded-[3px] border border-dashed border-[#c9c6bf] text-[11px] text-muted"
                  style={{ top: PAD + shown[0].length * LINE + 3, bottom: PAD }}
                >
                  {ROOM - shown[0].length} {ROOM - shown[0].length === 1 ? 'line' : 'lines'} left empty
                </div>
              )}
            </div>
            <span className="font-code text-[11px] text-muted">page {p + 1}</span>
          </div>
        ))}
      </div>
    </DemoBox>
  );
}
