'use client';

import { useState } from 'react';
import { CAPTION } from '../styles';
import { Readout } from '../ui';
import { PAPERS, UNIT_POINTS, type Unit } from './data';

// Where Console listens, written again so this does not load the editor.
const RUN_EVENT = 'editor-api-run';

const UNITS = Object.keys(UNIT_POINTS) as Unit[];
const NAMES: Record<Unit, string> = { pt: 'points', in: 'inches', cm: 'centimetres', mm: 'millimetres', px: 'CSS pixels at zoom 1' };
/** A length as it would be written in code: two decimals at most. */
const round = (n: number) => Math.round(n * 100) / 100;

const field = 'h-9 rounded-lg border border-border-strong bg-white px-2.5 text-sm text-ink';
const choice = (on: boolean) =>
  `cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink hover:bg-hover'}`;

/** Any length into points, and the other way. */
function Converter() {
  const [value, setValue] = useState('2.5');
  const [unit, setUnit] = useState<Unit>('cm');
  const n = Number(value.replace(',', '.'));
  const points = Number.isFinite(n) ? n * UNIT_POINTS[unit] : NaN;

  return (
    <div className="min-w-0 flex-[1_1_320px] rounded-2xl border border-border p-5">
      <p className={CAPTION}>Any length</p>
      <div className="mt-3 flex gap-2">
        <input aria-label="Length" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} className={`${field} w-28 font-code`} />
        <select aria-label="Unit" value={unit} onChange={(event) => setUnit(event.target.value as Unit)} className={field}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {NAMES[u]}
            </option>
          ))}
        </select>
      </div>
      <dl className="m-0 mt-4">
        {UNITS.map((u) => (
          <div key={u} className={`flex items-baseline justify-between gap-3 border-t border-[#f0eee9] py-2 ${u === 'pt' ? 'font-semibold' : ''}`}>
            <dt className="text-[15px] text-ink-soft">{NAMES[u]}</dt>
            <dd className={`m-0 font-code text-[14px] ${u === 'pt' ? 'text-brand' : 'text-ink'}`}>{Number.isFinite(points) ? round(points / UNIT_POINTS[u]) : '—'}</dd>
          </div>
        ))}
      </dl>
      <p className="m-0 mt-3 text-sm leading-normal text-muted">
        In code, always the points: <code className="font-code text-[13px] text-ink">{`{ indentLeft: ${Number.isFinite(points) ? round(points) : '…'} }`}</code>
      </p>
    </div>
  );
}

/** A page as setPage takes it, drawn to scale, and set on the editor above. */
function PageMaker() {
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
        <p className={CAPTION}>A page</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PAPERS.map(([paperName], i) => (
            <button key={paperName} type="button" aria-pressed={paper === i} onClick={() => setPaper(i)} className={choice(paper === i)}>
              {paperName}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" aria-pressed={!landscape} onClick={() => setLandscape(false)} className={choice(!landscape)}>
            Portrait
          </button>
          <button type="button" aria-pressed={landscape} onClick={() => setLandscape(true)} className={choice(landscape)}>
            Landscape
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="page-margin" className="text-[13px] text-ink-soft">
            Margins
          </label>
          <input id="page-margin" inputMode="decimal" value={margin} onChange={(event) => setMargin(event.target.value)} className={`${field} w-20 font-code`} />
          <select aria-label="Unit of the margins" value={unit} onChange={(event) => setUnit(event.target.value as 'cm' | 'in')} className={field}>
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </div>
        <div className="mt-4">
          <Readout
            label="PageSetup, in points"
            live={false}
            lines={[
              ['width × height', `${width} × ${height}`, 'good'],
              ['each margin', String(side), fits ? 'good' : 'warn'],
              ['text area', fits ? `${round(width - side * 2)} × ${round(height - side * 2)}` : 'no room left', fits ? 'good' : 'warn'],
            ]}
          />
        </div>
        <button
          type="button"
          disabled={!fits}
          onClick={() => window.dispatchEvent(new CustomEvent(RUN_EVENT, { detail: { code, page } }))}
          className="mt-4 h-9 cursor-pointer rounded-lg border-0 bg-brand px-3.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-default disabled:opacity-40"
        >
          Set it on the editor above ↑
        </button>
      </div>
      <figure className="m-0 flex flex-[0_0_auto] flex-col items-center justify-center gap-2">
        <svg
          width={width * scale + 2}
          height={height * scale + 2}
          role="img"
          aria-label={`${name}, ${landscape ? 'landscape' : 'portrait'}, margins of ${side} points`}
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
