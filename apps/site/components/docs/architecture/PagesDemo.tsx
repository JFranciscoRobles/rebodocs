'use client';

import { useRef, useState } from 'react';
import { useT } from '@/components/i18n';
import type { L } from '@/lib/i18n';
import { DemoBox, Readout } from '../ui';
import { lineText, tokensOf, useFontOf, useLines } from './lines';

const WIDTH = 210;
const LINE = 20;
/** Lines a page holds. */
const ROOM = 9;
const PAD = 16;

/** The lease in each language of the site: a first paragraph, the text that grows it, a heading and what follows it. */
const TEXTS: L<{ intro: string; more: string; heading: string; body: string }> = {
  en: {
    intro: 'The tenant pays the rent on the first day of each month, by bank transfer to the account the landlord names in writing, and keeps the receipts for a year.',
    more: ' The deposit is one month of rent, and it is given back within thirty days of the end of the lease.',
    heading: '2. Late payments',
    body: 'Rent is late after the fifth. Late rent adds a fee of five per cent, which the landlord may waive in writing, once a year.',
  },
  es: {
    intro: 'El inquilino paga la renta el primer día de cada mes, por transferencia bancaria a la cuenta que el arrendador indique por escrito, y guarda los recibos durante un año.',
    more: ' El depósito es de un mes de renta, y se devuelve en los treinta días siguientes al fin del contrato.',
    heading: '2. Pagos atrasados',
    body: 'La renta se retrasa después del día cinco. La renta atrasada suma un recargo del cinco por ciento, que el arrendador puede perdonar por escrito, una vez al año.',
  },
  zh: {
    intro: '承租人应于每月第一天以银行转账方式向出租人书面指定的账户支付租金，并保留收据一年。',
    more: '押金为一个月租金，于租约结束后三十天内退还。',
    heading: '2. 逾期付款',
    body: '租金在每月五日之后视为逾期。逾期租金加收百分之五的滞纳金，出租人每年可以书面形式免除一次。',
  },
};

type Kind = 'intro' | 'heading' | 'body';
/** A line on a page, and the rule that sent it there, if one did. */
interface Placed {
  kind: Kind;
  text: string;
  moved?: 'widow' | 'orphan' | 'keep';
}

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
  const t = useT();
  const { intro: INTRO, more: MORE, heading: HEADING, body: BODY } = t(TEXTS);
  // The text above grows a word at a time, or a character at a time in Chinese.
  const more = tokensOf(MORE);
  const [above, setAbove] = useState(0);
  const [widows, setWidows] = useState(true);
  const [keep, setKeep] = useState(true);
  const sample = useRef<HTMLDivElement>(null);
  const font = useFontOf(sample);
  const intro = useLines(INTRO + MORE.slice(0, more[above]?.end ?? 0), font, WIDTH, LINE, false).lines.map(lineText);
  const body = useLines(BODY, font, WIDTH, LINE, false).lines.map(lineText);

  const { pages, moved } = paginate(
    [
      { kind: 'intro', lines: intro },
      { kind: 'heading', lines: [HEADING], keepNext: keep },
      { kind: 'body', lines: body },
    ],
    widows,
  );
  const shown = pages.slice(0, 2);
  const steps = more.length - 1;

  return (
    <DemoBox
      title={t({ en: 'Try it: pages', es: 'Pruébalo: páginas', zh: '试一试：分页' })}
      aside={
        <>
          <Readout
            label={t({ en: 'Where the lines went', es: 'Adónde fueron las líneas', zh: '各行的去向' })}
            lines={[
              [
                t({ en: 'page 1', es: 'página 1', zh: '第 1 页' }),
                t({ en: `${shown[0].length} of ${ROOM} lines`, es: `${shown[0].length} de ${ROOM} líneas`, zh: `${ROOM} 行中的 ${shown[0].length} 行` }),
                'good',
              ],
              [t({ en: 'page 2', es: 'página 2', zh: '第 2 页' }), t({ en: `${shown[1]?.length ?? 0} lines`, es: `${shown[1]?.length ?? 0} líneas`, zh: `${shown[1]?.length ?? 0} 行` }), 'good'],
              [
                t({ en: 'widow control', es: 'control de viudas', zh: '孤行控制' }),
                !widows
                  ? t({ en: 'off', es: 'desactivado', zh: '关闭' })
                  : moved.widow
                    ? t({ en: `took ${moved.widow} line along`, es: `se llevó ${moved.widow} línea consigo`, zh: `带走了 ${moved.widow} 行` })
                    : moved.orphan
                      ? t({ en: 'sent a lone first line on', es: 'mandó adelante una primera línea sola', zh: '把单独的首行移到了下一页' })
                      : t({ en: 'nothing to do', es: 'nada que hacer', zh: '无需处理' }),
                moved.widow || moved.orphan ? 'warn' : 'dim',
              ],
              [
                t({ en: 'keep with next', es: 'conservar con el siguiente', zh: '与下段同页' }),
                !keep
                  ? t({ en: 'off', es: 'desactivado', zh: '关闭' })
                  : moved.keep
                    ? t({ en: 'moved the heading', es: 'movió el título', zh: '移动了标题' })
                    : t({ en: 'nothing to do', es: 'nada que hacer', zh: '无需处理' }),
                moved.keep ? 'warn' : 'dim',
              ],
            ]}
          />
          <p className="m-0 text-[15px] leading-[1.6] text-ink-soft">
            {t({
              en: 'Drag the text above until the last paragraph meets the foot of the page. With the rules on, no line is left alone and the heading never ends a page; turn them off to see what they prevent. These are the rules of the engine, made small: the real ones also keep lines together, break before a paragraph and split table rows.',
              es: 'Arrastra el texto de arriba hasta que el último párrafo llegue al pie de la página. Con las reglas activadas, ninguna línea queda sola y el título nunca termina una página; desactívalas para ver lo que evitan. Son las reglas del motor, en pequeño: las de verdad también mantienen líneas juntas, cortan antes de un párrafo y dividen filas de tablas.',
              zh: '拖动上方的文字，直到最后一段到达页面底部。开启规则时，不会有单独的一行，标题也不会出现在页尾；关闭规则就能看到它们避免了什么。这些是引擎规则的简化版：真正的规则还包括段中不分页、段前分页以及跨页拆分表格行。',
            })}
          </p>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="pages-above" className="text-[13px] text-ink-soft">
          {t({ en: 'Text above', es: 'Texto de arriba', zh: '上方文字' })}
        </label>
        <input id="pages-above" type="range" min={0} max={steps} value={above} onChange={(event) => setAbove(Number(event.target.value))} className="flex-[1_1_120px] accent-brand" />
        <button type="button" aria-pressed={widows} onClick={() => setWidows(!widows)} className={toggle(widows)}>
          {t({ en: 'Widow control', es: 'Control de viudas', zh: '孤行控制' })}
        </button>
        <button type="button" aria-pressed={keep} onClick={() => setKeep(!keep)} className={toggle(keep)}>
          {t({ en: 'Keep heading with next', es: 'Título con el siguiente', zh: '标题与下段同页' })}
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
                  {t({
                    en: `${ROOM - shown[0].length} ${ROOM - shown[0].length === 1 ? 'line' : 'lines'} left empty`,
                    es: `${ROOM - shown[0].length} ${ROOM - shown[0].length === 1 ? 'línea queda vacía' : 'líneas quedan vacías'}`,
                    zh: `空出 ${ROOM - shown[0].length} 行`,
                  })}
                </div>
              )}
            </div>
            <span className="font-code text-[11px] text-muted">{t({ en: `page ${p + 1}`, es: `página ${p + 1}`, zh: `第 ${p + 1} 页` })}</span>
          </div>
        ))}
      </div>
    </DemoBox>
  );
}
