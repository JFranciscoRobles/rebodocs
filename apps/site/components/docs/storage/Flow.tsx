'use client';

// Who talks to whom in apps/storage, drawn as the packages page draws who uses
// whom: the browser, the backend that has the keys, and the bucket. Pick what
// happens, opening, saving or making the PDF, and its requests light up in
// order, each told below. Checked in apps/storage/src/api.ts and server/api.ts.

import { useState } from 'react';
import { roving } from '../keys';

type Who = 'browser' | 'backend' | 'bucket';
type Edge = `${Who}>${Who}`;

interface Layout {
  id: string;
  width: number;
  height: number;
  at: Record<Who, [x: number, y: number, w: number, h: number]>;
  /** Each way between two of them, as a straight line: two lanes for each pair, one each way. */
  edges: Partial<Record<Edge, [x1: number, y1: number, x2: number, y2: number]>>;
}

const LAYOUTS: Layout[] = [
  {
    id: 'wide',
    width: 600,
    height: 236,
    at: { browser: [16, 158, 168, 62], backend: [216, 16, 168, 62], bucket: [416, 158, 168, 62] },
    edges: {
      'browser>backend': [112, 158, 236, 78],
      'backend>browser': [272, 78, 156, 158],
      'backend>bucket': [328, 78, 444, 158],
      'bucket>backend': [488, 158, 364, 78],
      'browser>bucket': [184, 176, 416, 176],
      'bucket>browser': [416, 202, 184, 202],
    },
  },
  {
    id: 'narrow',
    width: 320,
    height: 300,
    at: { browser: [6, 228, 122, 62], backend: [90, 10, 140, 62], bucket: [192, 228, 122, 62] },
    edges: {
      'browser>backend': [40, 228, 104, 72],
      'backend>browser': [136, 72, 84, 228],
      'backend>bucket': [184, 72, 236, 228],
      'bucket>backend': [280, 228, 216, 72],
      'browser>bucket': [128, 246, 192, 246],
      'bucket>browser': [192, 272, 128, 272],
    },
  },
];

const BOXES: Record<Who, { name: string; says: string }> = {
  browser: { name: 'The browser', says: 'the editor · no keys' },
  backend: { name: 'Your backend', says: 'has the keys · signs' },
  bucket: { name: 'The bucket', says: 'R2 · S3 · MinIO · B2' },
};

interface Step {
  edge: Edge;
  what: string;
  text: string;
}

const FLOWS: { name: string; sums: string; steps: Step[] }[] = [
  {
    name: 'Open a document',
    sums: 'The file comes from the bucket straight to the browser.',
    steps: [
      { edge: 'browser>backend', what: 'GET /api/url?key=contract.docx', text: 'An address to read this file from, please.' },
      { edge: 'backend>browser', what: '{ url }', text: 'Signed with the keys, for this file and five minutes.' },
      { edge: 'browser>bucket', what: 'GET url', text: 'The browser goes to the bucket with it: no key, only the address.' },
      { edge: 'bucket>browser', what: 'the DOCX', text: 'The bytes, given to the editor as its docx.' },
    ],
  },
  {
    name: 'Save it',
    sums: 'What onSave hands back goes to the bucket, not through your server.',
    steps: [
      { edge: 'browser>backend', what: 'POST /api/url?key=contract.docx', text: 'An address to write this file to.' },
      { edge: 'backend>browser', what: '{ url, type }', text: 'Signed for a PUT of that Content-Type and no other.' },
      { edge: 'browser>bucket', what: 'PUT url · content-type', text: 'The document, sent with the type that was signed.' },
      { edge: 'bucket>browser', what: '200', text: 'Stored. A version goes beside it the same way, through POST /api/versions.' },
    ],
  },
  {
    name: 'Make the PDF',
    sums: 'The one thing the server does with the files itself: work for a server.',
    steps: [
      { edge: 'browser>backend', what: 'POST /api/pdf · { client, … }', text: 'The values of the variables, as JSON.' },
      { edge: 'backend>bucket', what: 'GET contract.docx', text: 'The template, as it was last saved, read with the keys.' },
      { edge: 'backend>bucket', what: 'PUT contract.pdf', text: 'Filled, laid out with font files, and stored beside it.' },
      { edge: 'backend>browser', what: '{ key, url, pages }', text: 'Where it is, with an address to open it from.' },
    ],
  },
];

export function Flow() {
  const [chosen, setChosen] = useState(0);
  const flow = FLOWS[chosen];

  return (
    <div className="mt-7 flex flex-wrap items-stretch gap-6">
      <div role="radiogroup" aria-label="What happens?" className="flex min-w-0 flex-[1_1_240px] flex-col gap-3" onKeyDown={(event) => roving(event, setChosen)}>
        {FLOWS.map((f, i) => {
          const on = i === chosen;
          return (
            <button
              key={f.name}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setChosen(i)}
              className={`lift flex cursor-pointer items-start gap-3 rounded-[14px] border-[1.5px] px-4.5 py-4 text-left text-ink ${on ? 'border-brand bg-[#f5f9ff]' : 'border-border bg-white'}`}
            >
              <span className={`mt-0.5 flex size-5 flex-none items-center justify-center rounded-full border-2 ${on ? 'border-brand' : 'border-[#c9c6be]'}`}>
                <span className={`size-2.5 rounded-full ${on ? 'bg-brand' : ''}`} />
              </span>
              <span>
                <span className="block text-base font-semibold">{f.name}</span>
                <span className={`mt-1.5 block text-sm leading-snug ${on ? 'text-ink-soft' : 'text-muted'}`}>{f.sums}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-[1.6_1_440px] flex-col gap-4 rounded-[18px] border border-border bg-surface p-5">
        <div className="rounded-xl border border-border bg-white p-3">
          {LAYOUTS.map((layout) => (
            <Drawing key={layout.id} layout={layout} steps={flow.steps} />
          ))}
        </div>
        <ol key={chosen} className="m-0 flex animate-enter list-none flex-col gap-2.5 p-0">
          {flow.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-5.5 flex-none items-center justify-center rounded-full bg-brand font-code text-[12px] font-semibold text-white">{i + 1}</span>
              <span className="text-[15px] leading-normal text-ink-soft">
                <code className="font-code text-[13.5px] text-ink">{step.what}</code> — {step.text}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const smooth = 'transition-[stroke,opacity,fill] duration-350';

/** The three, and the lines between them: those the requests take lit, with their number on them. */
function Drawing({ layout, steps }: { layout: Layout; steps: Step[] }) {
  const arrow = (live: boolean) => `flow-${layout.id}-${live ? 'on' : 'off'}`;
  const lanes = Object.keys(layout.edges) as Edge[];
  /** The numbers on each lane: a lane taken twice carries both. */
  const numbers = (edge: Edge) => steps.flatMap((step, i) => (step.edge === edge ? [i + 1] : []));
  const used = (who: Who) => steps.some((step) => step.edge.split('>').includes(who));
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={steps.map((step, i) => `${i + 1}. ${step.edge.replace('>', ' to ')}: ${step.what}`).join('; ')}
      className={`h-auto w-full ${layout.id === 'wide' ? 'hidden sm:block' : 'mx-auto block max-w-[360px] sm:hidden'}`}
    >
      <defs>
        {[true, false].map((live) => (
          <marker key={String(live)} id={arrow(live)} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={live ? '#0b57d0' : '#d9d6cf'} />
          </marker>
        ))}
      </defs>
      {lanes.map((edge) => {
        const [x1, y1, x2, y2] = layout.edges[edge]!;
        const live = numbers(edge).length > 0;
        return (
          <path
            key={edge}
            d={`M${x1} ${y1}L${x2} ${y2}`}
            fill="none"
            strokeWidth="1.6"
            markerEnd={`url(#${arrow(live)})`}
            className={`${smooth} ${live ? 'stroke-brand' : 'stroke-[#e4e1da]'}`}
          />
        );
      })}
      {(Object.keys(BOXES) as Who[]).map((who) => {
        const [x, y, w, h] = layout.at[who];
        const on = used(who);
        const keys = who === 'backend';
        return (
          <g key={who}>
            <rect x={x} y={y} width={w} height={h} rx="10" strokeWidth="1.6" className={`${smooth} ${on ? (keys ? 'fill-pastel-blue stroke-brand' : 'fill-white stroke-brand') : 'fill-hover stroke-border-strong'}`} />
            <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" className={`${smooth} font-text text-[15px] font-semibold ${on ? 'fill-ink' : 'fill-faint'}`}>
              {BOXES[who].name}
            </text>
            <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" className={`${smooth} font-code text-[11px] ${on ? 'fill-muted' : 'fill-faint'}`}>
              {BOXES[who].says}
            </text>
          </g>
        );
      })}
      {lanes.map((edge) => {
        const all = numbers(edge);
        if (!all.length) return null;
        const [x1, y1, x2, y2] = layout.edges[edge]!;
        const [cx, cy] = [(x1 + x2) / 2, (y1 + y2) / 2];
        const label = all.join('·');
        const width = 12 + label.length * 7;
        return (
          <g key={`n-${edge}`} className="animate-enter">
            <rect x={cx - width / 2} y={cy - 10} width={width} height="20" rx="10" className="fill-brand" />
            <text x={cx} y={cy + 4.5} textAnchor="middle" className="fill-white font-code text-[12px] font-semibold">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
