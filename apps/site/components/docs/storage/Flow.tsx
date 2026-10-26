'use client';

// Who talks to whom in apps/storage, drawn as the packages page draws who uses
// whom: the browser, the backend that has the keys, and the bucket. Pick what
// happens, opening, saving or making the PDF, and its requests light up in
// order, each told below. Checked in apps/storage/src/api.ts and server/api.ts.

import { useState } from 'react';
import { useT } from '@/components/i18n';
import type { L } from '@/lib/i18n';
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

const BOXES: Record<Who, { name: L; says: L }> = {
  browser: { name: { en: 'The browser', es: 'El navegador', zh: '浏览器' }, says: { en: 'the editor · no keys', es: 'el editor · sin claves', zh: '编辑器 · 无密钥' } },
  backend: { name: { en: 'Your backend', es: 'Tu backend', zh: '你的后端' }, says: { en: 'has the keys · signs', es: 'tiene las claves · firma', zh: '持有密钥 · 签名' } },
  bucket: { name: { en: 'The bucket', es: 'El bucket', zh: '存储桶' }, says: { en: 'R2 · S3 · MinIO · B2', es: 'R2 · S3 · MinIO · B2', zh: 'R2 · S3 · MinIO · B2' } },
};

interface Step {
  edge: Edge;
  what: string;
  text: L;
}

const FLOWS: { name: L; sums: L; steps: Step[] }[] = [
  {
    name: { en: 'Open a document', es: 'Abrir un documento', zh: '打开文档' },
    sums: { en: 'The file comes from the bucket straight to the browser.', es: 'El archivo va del bucket directo al navegador.', zh: '文件直接从存储桶到达浏览器。' },
    steps: [
      {
        edge: 'browser>backend',
        what: 'GET /api/url?key=contract.docx',
        text: { en: 'An address to read this file from, please.', es: 'Una dirección para leer este archivo, por favor.', zh: '请给我一个读取该文件的地址。' },
      },
      {
        edge: 'backend>browser',
        what: '{ url }',
        text: { en: 'Signed with the keys, for this file and five minutes.', es: 'Firmada con las claves, para este archivo y cinco minutos.', zh: '用密钥签名，仅对该文件有效，期限五分钟。' },
      },
      {
        edge: 'browser>bucket',
        what: 'GET url',
        text: {
          en: 'The browser goes to the bucket with it: no key, only the address.',
          es: 'El navegador va al bucket con ella: sin clave, solo la dirección.',
          zh: '浏览器带着它访问存储桶：没有密钥，只有地址。',
        },
      },
      { edge: 'bucket>browser', what: 'the DOCX', text: { en: 'The bytes, given to the editor as its docx.', es: 'Los bytes, dados al editor como su docx.', zh: '字节作为 docx 交给编辑器。' } },
    ],
  },
  {
    name: { en: 'Save it', es: 'Guardarlo', zh: '保存文档' },
    sums: {
      en: 'What onSave hands back goes to the bucket, not through your server.',
      es: 'Lo que devuelve onSave va al bucket, no pasa por tu servidor.',
      zh: 'onSave 返回的内容直接写入存储桶，不经过你的服务器。',
    },
    steps: [
      {
        edge: 'browser>backend',
        what: 'POST /api/url?key=contract.docx',
        text: { en: 'An address to write this file to.', es: 'Una dirección para escribir este archivo.', zh: '请给我一个写入该文件的地址。' },
      },
      {
        edge: 'backend>browser',
        what: '{ url, type }',
        text: { en: 'Signed for a PUT of that Content-Type and no other.', es: 'Firmada para un PUT de ese Content-Type y ningún otro.', zh: '签名只允许使用该 Content-Type 的 PUT。' },
      },
      {
        edge: 'browser>bucket',
        what: 'PUT url · content-type',
        text: { en: 'The document, sent with the type that was signed.', es: 'El documento, enviado con el tipo que se firmó.', zh: '以签名时的类型发送文档。' },
      },
      {
        edge: 'bucket>browser',
        what: '200',
        text: {
          en: 'Stored. A version goes beside it the same way, through POST /api/versions.',
          es: 'Guardado. Una versión va a su lado de la misma forma, con POST /api/versions.',
          zh: '已保存。版本也以同样的方式通过 POST /api/versions 保存在旁边。',
        },
      },
    ],
  },
  {
    name: { en: 'Make the PDF', es: 'Hacer el PDF', zh: '生成 PDF' },
    sums: {
      en: 'The one thing the server does with the files itself: work for a server.',
      es: 'Lo único que el servidor hace con los archivos él mismo: trabajo para un servidor.',
      zh: '这是服务器唯一亲自处理文件的环节：本来就是服务器的工作。',
    },
    steps: [
      {
        edge: 'browser>backend',
        what: 'POST /api/pdf · { client, … }',
        text: { en: 'The values of the variables, as JSON.', es: 'Los valores de las variables, como JSON.', zh: '变量的值，以 JSON 形式发送。' },
      },
      {
        edge: 'backend>bucket',
        what: 'GET contract.docx',
        text: { en: 'The template, as it was last saved, read with the keys.', es: 'La plantilla, como se guardó por última vez, leída con las claves.', zh: '用密钥读取最近一次保存的模板。' },
      },
      {
        edge: 'backend>bucket',
        what: 'PUT contract.pdf',
        text: {
          en: 'Filled, laid out with font files, and stored beside it.',
          es: 'Llenada, maquetada con archivos de fuentes, y guardada a su lado.',
          zh: '填写后用字体文件排版，并保存在模板旁边。',
        },
      },
      {
        edge: 'backend>browser',
        what: '{ key, url, pages }',
        text: { en: 'Where it is, with an address to open it from.', es: 'Dónde está, con una dirección para abrirlo.', zh: '返回 PDF 的位置及打开它的地址。' },
      },
    ],
  },
];

export function Flow() {
  const [chosen, setChosen] = useState(0);
  const flow = FLOWS[chosen];
  const t = useT();

  return (
    <div className="mt-7 flex flex-wrap items-stretch gap-6">
      <div
        role="radiogroup"
        aria-label={t({ en: 'What happens?', es: '¿Qué pasa?', zh: '发生了什么？' })}
        className="flex min-w-0 flex-[1_1_240px] flex-col gap-3"
        onKeyDown={(event) => roving(event, setChosen)}
      >
        {FLOWS.map((f, i) => {
          const on = i === chosen;
          return (
            <button
              key={f.name.en}
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
                <span className="block text-base font-semibold">{t(f.name)}</span>
                <span className={`mt-1.5 block text-sm leading-snug ${on ? 'text-ink-soft' : 'text-muted'}`}>{t(f.sums)}</span>
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
                <code className="font-code text-[13.5px] text-ink">{step.what}</code> — {t(step.text)}
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
  const t = useT();
  const arrow = (live: boolean) => `flow-${layout.id}-${live ? 'on' : 'off'}`;
  const lanes = Object.keys(layout.edges) as Edge[];
  /** The numbers on each lane: a lane taken twice carries both. */
  const numbers = (edge: Edge) => steps.flatMap((step, i) => (step.edge === edge ? [i + 1] : []));
  const used = (who: Who) => steps.some((step) => step.edge.split('>').includes(who));
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={steps
        .map((step, i) => {
          const [from, to] = step.edge.split('>') as [Who, Who];
          return `${i + 1}. ${t(BOXES[from].name)} → ${t(BOXES[to].name)}: ${step.what}`;
        })
        .join('; ')}
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
          <path key={edge} d={`M${x1} ${y1}L${x2} ${y2}`} fill="none" strokeWidth="1.6" markerEnd={`url(#${arrow(live)})`} className={`${smooth} ${live ? 'stroke-brand' : 'stroke-[#e4e1da]'}`} />
        );
      })}
      {(Object.keys(BOXES) as Who[]).map((who) => {
        const [x, y, w, h] = layout.at[who];
        const on = used(who);
        const keys = who === 'backend';
        return (
          <g key={who}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              rx="10"
              strokeWidth="1.6"
              className={`${smooth} ${on ? (keys ? 'fill-pastel-blue stroke-brand' : 'fill-white stroke-brand') : 'fill-hover stroke-border-strong'}`}
            />
            <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" className={`${smooth} font-text text-[15px] font-semibold ${on ? 'fill-ink' : 'fill-faint'}`}>
              {t(BOXES[who].name)}
            </text>
            <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" className={`${smooth} font-code text-[11px] ${on ? 'fill-muted' : 'fill-faint'}`}>
              {t(BOXES[who].says)}
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
