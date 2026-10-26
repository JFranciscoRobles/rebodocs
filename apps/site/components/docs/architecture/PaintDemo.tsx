'use client';

import { type KeyboardEvent, type MouseEvent, useRef, useState } from 'react';
import { useT } from '@/components/i18n';
import type { L } from '@/lib/i18n';
import { DemoBox, Readout } from '../ui';
import { tokensOf, useFontOf, useLines } from './lines';

/** The paragraph of the demo, and the words before which the caret starts, in each language of the site. */
const STARTS: L<[text: string, caret: string]> = {
  en: ['Payment is due within fifteen days of this receipt, by bank transfer to the account below. Late payments add a fee each month.', ' within'],
  es: ['El pago vence a los quince días de este recibo, por transferencia bancaria a la cuenta de abajo. Los pagos tardíos suman un recargo cada mes.', ' a los'],
  zh: ['应在本收据开具后十五天内，以银行转账方式付款至下方账户。逾期付款每月加收费用。', '十五天'],
};
const MAX = 260;
const WIDTH = 300;
const LINE = 24;
const PAD = 22;

const toggle = (on: boolean) =>
  `cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink hover:bg-hover'}`;

/**
 * A page as the editor paints it, and typed in as the editor is: a hidden
 * textarea at the caret takes the keys, each one becomes a change to the text,
 * and the text is broken into lines and placed again.
 */
export function PaintDemo() {
  const t = useT();
  const [START, from] = t(STARTS);
  const [text, setText] = useState(START);
  const [caret, setCaret] = useState(START.indexOf(from));
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
    const x = caret <= tokens[i].end ? word.x + measure(text.slice(tokens[i].start, caret)) : word.x + word.width + (word.space ? measure(' ') : 0);
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
            label={t({ en: 'On the page', es: 'En la página', zh: '页面上' })}
            lines={[
              [t({ en: 'last operation', es: 'última operación', zh: '最近的操作' }), last ?? t({ en: 'none yet', es: 'ninguna todavía', zh: '暂无' }), last ? 'warn' : 'dim'],
              [
                t({ en: 'widths asked', es: 'anchos pedidos', zh: '询问的宽度' }),
                t({ en: `${asked}, new words only`, es: `${asked}, solo palabras nuevas`, zh: `${asked}，仅限新词` }),
                asked ? 'warn' : 'good',
              ],
              [t({ en: 'spans placed', es: 'spans colocados', zh: '定位的 span' }), String(count), 'good'],
              [t({ en: 'lines', es: 'líneas', zh: '行数' }), t({ en: `${lines.length}, at any zoom`, es: `${lines.length}, a cualquier zoom`, zh: `${lines.length}，任何缩放下都相同` }), 'good'],
              [t({ en: 'zoom', es: 'zoom', zh: '缩放' }), zoom === 100 ? t({ en: 'none', es: 'ninguno', zh: '无' }) : `transform: scale(${scale})`, 'warn'],
              [
                t({ en: 'focus', es: 'foco', zh: '焦点' }),
                focused
                  ? t({
                      en: `hidden textarea at ${Math.round(at.x)}, ${Math.round(at.y)}`,
                      es: `textarea oculto en ${Math.round(at.x)}, ${Math.round(at.y)}`,
                      zh: `隐藏的 textarea，位于 ${Math.round(at.x)}, ${Math.round(at.y)}`,
                    })
                  : t({ en: 'elsewhere', es: 'en otro lugar', zh: '在别处' }),
                focused ? 'warn' : 'dim',
              ],
              ['contenteditable', t({ en: 'none', es: 'ninguno', zh: '无' }), 'good'],
            ]}
          />
          <p className="m-0 text-[15px] leading-[1.6] text-ink-soft">
            {t({
              en: 'Click in the text and type: the keys go to a real textarea at the caret, each becomes a change to the text, and the lines are broken and placed again. Zoom scales pages laid out at their real size, so no line breaks differently.',
              es: 'Haz clic en el texto y escribe: las teclas van a un textarea real en el cursor, cada una se convierte en un cambio del texto, y las líneas se vuelven a cortar y colocar. El zoom escala páginas compuestas a su tamaño real, así que ninguna línea se corta distinto.',
              zh: '在文字中点击并输入：按键进入光标处真实的 textarea，每次按键都变成对文字的一次更改，然后重新分行和定位。缩放只是按比例放大按真实尺寸排好的页面，因此任何一行的换行位置都不会改变。',
            })}
          </p>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={spans} onClick={() => setSpans(!spans)} className={toggle(spans)}>
          {t({ en: 'Show the spans', es: 'Mostrar los spans', zh: '显示 span' })}
        </button>
        <button type="button" aria-pressed={textarea} onClick={() => setTextarea(!textarea)} className={toggle(textarea)}>
          {t({ en: 'Show the textarea', es: 'Mostrar el textarea', zh: '显示 textarea' })}
        </button>
        <label htmlFor="paint-zoom" className="ml-auto text-[13px] text-ink-soft">
          {t({ en: 'Zoom', es: 'Zoom', zh: '缩放' })}
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
              aria-label={t({ en: 'The paragraph of the demo: type to change it', es: 'El párrafo del demo: escribe para cambiarlo', zh: '演示段落：输入即可修改' })}
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
        <span>
          {text.length >= MAX
            ? t({ en: 'That is as long as the demo goes.', es: 'Hasta ahí llega el demo.', zh: '演示最多只能这么长。' })
            : t({
                en: 'Click in the text and type; ← → and Backspace work too.',
                es: 'Haz clic en el texto y escribe; ← → y Retroceso también funcionan.',
                zh: '在文字中点击并输入；← → 和 Backspace 也可以使用。',
              })}
        </span>
        {text !== START && (
          <button
            type="button"
            onClick={() => {
              setText(START);
              setCaret(START.indexOf(from));
              setLast(undefined);
            }}
            className="ml-auto cursor-pointer border-0 bg-transparent p-0 text-[13px] text-muted underline"
          >
            {t({ en: 'Start again', es: 'Empezar de nuevo', zh: '重新开始' })}
          </button>
        )}
      </div>
    </DemoBox>
  );
}
