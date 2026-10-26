'use client';

import { useState } from 'react';
import { useT } from '@/components/i18n';
import type { L } from '@/lib/i18n';
import { CAPTION } from '../styles';
import { Readout } from '../ui';
import { PAPERS, UNIT_POINTS, type Unit } from './data';

// Where Console listens, written again so this does not load the editor.
const RUN_EVENT = 'editor-api-run';

const UNITS = Object.keys(UNIT_POINTS) as Unit[];
const NAMES: Record<Unit, L> = {
  pt: { en: 'points', es: 'puntos', zh: '磅' },
  in: { en: 'inches', es: 'pulgadas', zh: '英寸' },
  cm: { en: 'centimetres', es: 'centímetros', zh: '厘米' },
  mm: { en: 'millimetres', es: 'milímetros', zh: '毫米' },
  px: { en: 'CSS pixels at zoom 1', es: 'píxeles CSS a zoom 1', zh: '缩放为 1 时的 CSS 像素' },
};
/** A length as it would be written in code: two decimals at most. */
const round = (n: number) => Math.round(n * 100) / 100;

const field = 'h-9 rounded-lg border border-border-strong bg-white px-2.5 text-sm text-ink';
const choice = (on: boolean) =>
  `cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink hover:bg-hover'}`;

/** Any length into points, and the other way. */
function Converter() {
  const t = useT();
  const [value, setValue] = useState('2.5');
  const [unit, setUnit] = useState<Unit>('cm');
  const n = Number(value.replace(',', '.'));
  const points = Number.isFinite(n) ? n * UNIT_POINTS[unit] : NaN;

  return (
    <div className="min-w-0 flex-[1_1_320px] rounded-2xl border border-border p-5">
      <p className={CAPTION}>{t({ en: 'Any length', es: 'Cualquier longitud', zh: '任意长度' })}</p>
      <div className="mt-3 flex gap-2">
        <input
          aria-label={t({ en: 'Length', es: 'Longitud', zh: '长度' })}
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className={`${field} w-28 font-code`}
        />
        <select aria-label={t({ en: 'Unit', es: 'Unidad', zh: '单位' })} value={unit} onChange={(event) => setUnit(event.target.value as Unit)} className={field}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {t(NAMES[u])}
            </option>
          ))}
        </select>
      </div>
      <dl className="m-0 mt-4">
        {UNITS.map((u) => (
          <div key={u} className={`flex items-baseline justify-between gap-3 border-t border-[#f0eee9] py-2 ${u === 'pt' ? 'font-semibold' : ''}`}>
            <dt className="text-[15px] text-ink-soft">{t(NAMES[u])}</dt>
            <dd className={`m-0 font-code text-[14px] ${u === 'pt' ? 'text-brand' : 'text-ink'}`}>{Number.isFinite(points) ? round(points / UNIT_POINTS[u]) : '—'}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 mt-3 text-sm leading-normal text-muted">
        {t({ en: 'In code, always the points:', es: 'En código, siempre los puntos:', zh: '在代码中始终使用磅：' })}{' '}
        <code className="font-code text-[13px] text-ink">{`{ indentLeft: ${Number.isFinite(points) ? round(points) : '…'} }`}</code>
      </p>
    </div>
  );
}

/** A page as setPage takes it, drawn to scale, and set on the editor above. */
function PageMaker() {
  const t = useT();
  const [paper, setPaper] = useState(1);
  const [landscape, setLandscape] = useState(false);
  const [margin, setMargin] = useState('2.5');
  const [unit, setUnit] = useState<'cm' | 'in'>('cm');

  const [name, w, h] = PAPERS[paper];
  const width = landscape ? h : w;
  const height = landscape ? w : h;
  const m = Number(margin.replace(',', '.'));
  const side = Number.isFinite(m) && m >= 0 ? round(m * UNIT_POINTS[unit]) : 72;
  // Margins that leave no room for text are not a page.
  const fits = side * 2 < Math.min(width, height) - 36;
  const page = { width, height, marginTop: side, marginRight: side, marginBottom: side, marginLeft: side };
  const code = `editor.setPage({ width: ${width}, height: ${height}, marginTop: ${side}, marginRight: ${side}, marginBottom: ${side}, marginLeft: ${side} })`;

  // The drawing: the larger side 220 px.
  const scale = 220 / Math.max(width, height);

  return (
    <div className="flex min-w-0 flex-[1.4_1_440px] flex-wrap gap-5 rounded-2xl border border-border p-5">
      <div className="min-w-0 flex-[1_1_240px]">
        <p className={CAPTION}>{t({ en: 'A page', es: 'Una página', zh: '页面' })}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PAPERS.map(([paperName], i) => (
            <button key={paperName} type="button" aria-pressed={paper === i} onClick={() => setPaper(i)} className={choice(paper === i)}>
              {paperName}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={!landscape} onClick={() => setLandscape(false)} className={choice(!landscape)}>
            {t({ en: 'Portrait', es: 'Vertical', zh: '纵向' })}
          </button>
          <button type="button" aria-pressed={landscape} onClick={() => setLandscape(true)} className={choice(landscape)}>
            {t({ en: 'Landscape', es: 'Horizontal', zh: '横向' })}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="page-margin" className="text-[13px] text-ink-soft">
            {t({ en: 'Margins', es: 'Márgenes', zh: '页边距' })}
          </label>
          <input id="page-margin" inputMode="decimal" value={margin} onChange={(event) => setMargin(event.target.value)} className={`${field} w-20 font-code`} />
          <select
            aria-label={t({ en: 'Unit of the margins', es: 'Unidad de los márgenes', zh: '页边距单位' })}
            value={unit}
            onChange={(event) => setUnit(event.target.value as 'cm' | 'in')}
            className={field}
          >
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </div>
        <div className="mt-4">
          <Readout
            label={t({ en: 'PageSetup, in points', es: 'PageSetup, en puntos', zh: 'PageSetup（以磅为单位）' })}
            live={false}
            lines={[
              ['width × height', `${width} × ${height}`, 'good'],
              [t({ en: 'each margin', es: 'cada margen', zh: '每边页边距' }), String(side), fits ? 'good' : 'warn'],
              [
                t({ en: 'text area', es: 'área de texto', zh: '文字区域' }),
                fits ? `${round(width - side * 2)} × ${round(height - side * 2)}` : t({ en: 'no room left', es: 'no queda espacio', zh: '没有剩余空间' }),
                fits ? 'good' : 'warn',
              ],
            ]}
          />
        </div>
        <button
          type="button"
          disabled={!fits}
          onClick={() => window.dispatchEvent(new CustomEvent(RUN_EVENT, { detail: { code, page } }))}
          className="mt-4 h-9 cursor-pointer rounded-lg border-0 bg-brand px-3.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-default disabled:opacity-40"
        >
          {t({ en: 'Set it on the editor above ↑', es: 'Fíjala en el editor de arriba ↑', zh: '应用到上面的编辑器 ↑' })}
        </button>
      </div>
      <figure className="m-0 flex flex-[0_0_auto] flex-col items-center justify-center gap-2">
        <svg
          width={width * scale + 2}
          height={height * scale + 2}
          role="img"
          aria-label={t({
            en: `${name}, ${landscape ? 'landscape' : 'portrait'}, margins of ${side} points`,
            es: `${name}, ${landscape ? 'horizontal' : 'vertical'}, márgenes de ${side} puntos`,
            zh: `${name}，${landscape ? '横向' : '纵向'}，页边距 ${side} 磅`,
          })}
          className="transition-all duration-300"
        >
          <rect x="1" y="1" width={width * scale} height={height * scale} fill="#fff" stroke="#c9c6bf" />
          {fits && <rect x={1 + side * scale} y={1 + side * scale} width={(width - side * 2) * scale} height={(height - side * 2) * scale} fill="#eef3fd" stroke="#8db4f5" strokeDasharray="3 3" />}
          {fits &&
            [0, 1, 2, 3, 4, 5, 6].map((i) => (
              <rect key={i} x={1 + side * scale + 6} y={1 + side * scale + 8 + i * 10} width={Math.max(0, (width - side * 2) * scale - 12 - (i === 6 ? 30 : 0))} height="3" rx="1.5" fill="#c3d5f7" />
            ))}
        </svg>
        <figcaption className="font-code text-[11px] text-muted">
          {name} · {width} × {height} pt
        </figcaption>
      </figure>
    </div>
  );
}

/** Lengths in points, worked out as you type. */
export function Points() {
  return (
    <div className="mt-7 flex flex-wrap gap-4">
      <Converter />
      <PageMaker />
    </div>
  );
}
