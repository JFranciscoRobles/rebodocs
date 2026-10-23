'use client';

import { type KeyboardEvent, type MouseEvent, useRef, useState } from 'react';
import { DemoBox, Readout } from '../ui';
import { useFontOf, useLines } from './lines';

const START = 'Payment is due within fifteen days of this receipt, by bank transfer to the account below. Late payments add a fee each month.';
const MAX = 260;
const WIDTH = 300;
const LINE = 24;
const PAD = 22;

const toggle = (on: boolean) =>
  `cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink hover:bg-hover'}`;

/** Where each word of `text` starts and ends, in the order the line breaker places them. */
const tokensOf = (text: string) => [...text.matchAll(/\S+/g)].map((m) => ({ start: m.index, end: m.index + m[0].length }));

/**
 * A page as the editor paints it, and typed in as the editor is: a hidden
 * textarea at the caret takes the keys, each one becomes a change to the text,
 * and the text is broken into lines and placed again.
 */
export function PaintDemo() {
  const [text, setText] = useState(START);
  const [caret, setCaret] = useState(START.indexOf(' within'));
  const [last, setLast] = useState<string>();
  const [focused, setFocused] = useState(false);
  const [spans, setSpans] = useState(true);
  const [textarea, setTextarea] = useState(true);
  const [zoom, setZoom] = useState(100);
  const page = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const canvas = useRef<CanvasRenderingContext2D | null>(null);
  const composing = useRef(false);
  const font = useFontOf(page);
  const { lines, asked } = useLines(text, font, WIDTH, LINE, false);

  const measure = (piece: string) => {
    if (!font || !piece) return 0;
    canvas.current ??= document.createElement('canvas').getContext('2d');
    canvas.current!.font = font;
    return canvas.current!.measureText(piece).width;
  };
  const tokens = tokensOf(text);
  const placed = lines.flatMap((line) => line.words.map((word) => ({ ...word, y: line.y })));

  // The caret's place on the page, from its offset in the text.
  let at = { x: PAD, y: PAD };
  let i = tokens.length - 1;
  while (i >= 0 && tokens[i].start > caret) i--;
  if (i >= 0 && placed[i]) {
    const word = placed[i];
    const x = caret <= tokens[i].end ? word.x + measure(text.slice(tokens[i].start, caret)) : word.x + word.width + measure(' ');
    at = { x: PAD + x, y: PAD + word.y };
  }

  const count = placed.length;
  const scale = zoom / 100;
  const pageWidth = WIDTH + PAD * 2;
  const pageHeight = Math.max(1, lines.length) * LINE + PAD * 2;

  const change = (next: string, to: number, op: string) => {
    setText(next);
    setCaret(Math.max(0, Math.min(next.length, to)));
    setLast(op);
  };
  const insert = (typed: string) => {
    const room = MAX - text.length;
    const piece = typed.replace(/\n/g, ' ').slice(0, room);
    const shown = piece.length > 10 ? `${piece.slice(0, 10)}…` : piece;
    if (piece) change(text.slice(0, caret) + piece + text.slice(caret), caret + piece.length, `insertText(offset ${caret}, '${shown}')`);
  };

  // A press on the page puts the caret at the nearest letter, and gives the keys to the textarea.
  const press = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    input.current?.focus({ preventScroll: true });
    const box = page.current!.getBoundingClientRect();
    const x = (event.clientX - box.left) / scale - PAD;
    const l = Math.max(0, Math.min(lines.length - 1, Math.floor(((event.clientY - box.top) / scale - PAD) / LINE)));
    let best = { offset: text.length, distance: Infinity };
    placed.forEach((word, w) => {
      if (word.y !== l * LINE) return;
      const token = tokens[w];
      for (let k = 0; k <= token.end - token.start; k++) {
        const distance = Math.abs(word.x + measure(text.slice(token.start, token.start + k)) - x);
        if (distance < best.distance) best = { offset: token.start + k, distance };
      }
    });
    setCaret(best.offset);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (composing.current || event.nativeEvent.isComposing) return;
    const key = event.key;
    if (key === 'Backspace' && caret > 0) change(text.slice(0, caret - 1) + text.slice(caret), caret - 1, `deleteBackward(offset ${caret})`);
    else if (key === 'Delete' && caret < text.length) change(text.slice(0, caret) + text.slice(caret + 1), caret, `deleteForward(offset ${caret})`);
    else if (key === 'ArrowLeft') setCaret(Math.max(0, caret - 1));
    else if (key === 'ArrowRight') setCaret(Math.min(text.length, caret + 1));
    else if (key === 'Home') setCaret(0);
    else if (key === 'End') setCaret(text.length);
    else if (key !== 'Enter') return;
    event.preventDefault();
  };

  return (
    <DemoBox
      aside={
        <>
          <Readout
            label="On the page"
            lines={[
              ['last operation', last ?? 'none yet', last ? 'warn' : 'dim'],
              ['widths asked', `${asked}, new words only`, asked ? 'warn' : 'good'],
              ['spans placed', String(count), 'good'],
              ['lines', `${lines.length}, at any zoom`, 'good'],
              ['zoom', zoom === 100 ? 'none' : `transform: scale(${scale})`, 'warn'],
              ['focus', focused ? `hidden textarea at ${Math.round(at.x)}, ${Math.round(at.y)}` : 'elsewhere', focused ? 'warn' : 'dim'],
              ['contenteditable', 'none', 'good'],
            ]}
          />
          <p className="m-0 text-[15px] leading-[1.6] text-ink-soft">
            Click in the text and type: the keys go to a real textarea at the caret, each becomes a change to the text, and the lines are broken and placed again. Zoom scales pages laid out at their
            real size, so no line breaks differently.
          </p>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={spans} onClick={() => setSpans(!spans)} className={toggle(spans)}>
          Show the spans
        </button>
        <button type="button" aria-pressed={textarea} onClick={() => setTextarea(!textarea)} className={toggle(textarea)}>
          Show the textarea
        </button>
        <label htmlFor="paint-zoom" className="ml-auto text-[13px] text-ink-soft">
          Zoom
        </label>
        <input id="paint-zoom" type="range" min={60} max={140} step={10} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-[120px] accent-brand" />
        <span className="w-[44px] font-code text-[13px]">{zoom}%</span>
      </div>
      <div className="mt-4 overflow-x-auto rounded-[10px] bg-[#e9eaee] p-4">
        <div style={{ width: pageWidth * scale, height: pageHeight * scale }} className="mx-auto transition-[width,height] duration-200">
          <div
            ref={page}
            onMouseDown={press}
            className="relative origin-top-left cursor-text bg-white text-[15px] text-[#37352f] shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200"
            style={{ width: pageWidth, height: pageHeight, transform: `scale(${scale})` }}
          >
            {placed.map((word, w) => (
              <span
                key={w}
                title={`left ${Math.round(PAD + word.x)}, top ${PAD + word.y}`}
                className={`absolute whitespace-pre leading-[24px] ${spans ? 'outline-1 outline-[#8db4f5] outline-dashed' : ''}`}
                style={{ left: PAD + word.x, top: PAD + word.y }}
              >
                {word.text}
              </span>
            ))}
            <textarea
              ref={input}
              aria-label="The paragraph of the demo: type to change it"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={onKeyDown}
              onCompositionStart={() => (composing.current = true)}
              onCompositionEnd={(event) => {
                composing.current = false;
                insert(event.currentTarget.value);
                event.currentTarget.value = '';
              }}
              onInput={(event) => {
                if (composing.current) return;
                insert(event.currentTarget.value);
                event.currentTarget.value = '';
              }}
              className="absolute m-0 h-[24px] w-px resize-none overflow-hidden border-0 p-0 text-[16px] opacity-0 outline-0"
              style={{ left: at.x, top: at.y }}
            />
            <span aria-hidden="true" className={`absolute w-[1.5px] bg-black ${focused ? 'animate-blink' : 'opacity-40'}`} style={{ left: at.x, top: at.y + 3, height: LINE - 6 }} />
            {textarea && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute flex h-[20px] items-start rounded-[3px] border border-dashed border-[#b07a00] px-1 font-code text-[9px] leading-[12px] text-pastel-yellow-fg transition-[left,top] duration-200"
                style={{ left: at.x + 2, top: at.y + 2, width: 64 }}
              >
                textarea
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 text-[13px] text-muted">
        <span>{text.length >= MAX ? 'That is as long as the demo goes.' : 'Click in the text and type; ← → and Backspace work too.'}</span>
        {text !== START && (
          <button
            type="button"
            onClick={() => {
              setText(START);
              setCaret(START.indexOf(' within'));
              setLast(undefined);
            }}
            className="ml-auto cursor-pointer border-0 bg-transparent p-0 text-[13px] text-muted underline"
          >
            Start again
          </button>
        )}
      </div>
    </DemoBox>
  );
}
