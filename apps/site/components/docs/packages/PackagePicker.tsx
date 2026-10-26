'use client';

import { useState } from 'react';
import { useT } from '@/components/i18n';
import type { L } from '@/lib/i18n';
import { InstallCommand } from '../InstallCommand';
import { roving } from '../keys';
import { GOALS, type PackageName, type Presence, short } from './data';

interface Layout {
  id: string;
  width: number;
  height: number;
  /** The size of a box, and where each one is, in the drawing's own units. */
  box: [w: number, h: number];
  at: Record<PackageName, [x: number, y: number]>;
  /** Who uses whom, and the line between them. */
  uses: [from: PackageName, to: PackageName, path: string][];
}

/** Side by side on a wide screen; on a phone, core on top and the rest under it, so the text keeps its size. */
const LAYOUTS: Layout[] = [
  {
    id: 'wide',
    width: 600,
    height: 256,
    box: [164, 60],
    at: {
      '@rebodocs/core': [18, 28],
      '@rebodocs/editor': [218, 28],
      '@rebodocs/react': [418, 28],
      '@rebodocs/collab': [18, 168],
      '@rebodocs/mcp': [218, 168],
      '@rebodocs/viewer': [418, 168],
    },
    uses: [
      ['@rebodocs/editor', '@rebodocs/core', 'M218 58H188'],
      ['@rebodocs/react', '@rebodocs/editor', 'M418 58H388'],
      ['@rebodocs/collab', '@rebodocs/core', 'M100 168V94'],
      ['@rebodocs/mcp', '@rebodocs/core', 'M250 168L160 94'],
      ['@rebodocs/viewer', '@rebodocs/editor', 'M450 168L360 94'],
      ['@rebodocs/react', '@rebodocs/viewer', 'M520 88V162'],
      ['@rebodocs/react', '@rebodocs/collab', 'M582 58H592V244H100V234'],
    ],
  },
  {
    id: 'narrow',
    width: 320,
    height: 320,
    box: [96, 56],
    at: {
      '@rebodocs/core': [112, 14],
      '@rebodocs/editor': [8, 130],
      '@rebodocs/collab': [112, 130],
      '@rebodocs/mcp': [216, 130],
      '@rebodocs/viewer': [8, 250],
      '@rebodocs/react': [216, 250],
    },
    uses: [
      ['@rebodocs/editor', '@rebodocs/core', 'M60 130L128 76'],
      ['@rebodocs/collab', '@rebodocs/core', 'M160 130V76'],
      ['@rebodocs/mcp', '@rebodocs/core', 'M260 130L192 76'],
      ['@rebodocs/viewer', '@rebodocs/editor', 'M56 250V192'],
      ['@rebodocs/react', '@rebodocs/editor', 'M216 262L100 192'],
      ['@rebodocs/react', '@rebodocs/collab', 'M240 250L184 192'],
      ['@rebodocs/react', '@rebodocs/viewer', 'M216 290H110'],
    ],
  },
];
/** Whole class names, so Tailwind finds them. */
const LOOK: Record<Presence, { box: string; name: string; label: L }> = {
  install: { box: 'fill-pastel-blue stroke-brand', name: 'fill-brand', label: { en: 'install it', es: 'instálalo', zh: '安装' } },
  inside: { box: 'fill-pastel-yellow stroke-[#b07a00] [stroke-dasharray:5_4]', name: 'fill-pastel-yellow-fg', label: { en: 'comes inside', es: 'viene dentro', zh: '已内置' } },
  none: { box: 'fill-hover stroke-border-strong opacity-55', name: 'fill-faint', label: { en: 'not needed', es: 'no hace falta', zh: '不需要' } },
};
const smooth = 'transition-[fill,stroke,opacity] duration-350';

/** "Which one do I install?": what you are making, and the packages that takes, drawn with who uses whom. */
export function PackagePicker() {
  const [chosen, setChosen] = useState(0);
  const goal = GOALS[chosen];
  const t = useT();

  return (
    <div className="mt-7 flex flex-wrap items-stretch gap-6">
      <div
        role="radiogroup"
        aria-label={t({ en: 'What are you making?', es: '¿Qué estás haciendo?', zh: '你要做什么？' })}
        className="flex min-w-0 flex-[1_1_280px] flex-col gap-3"
        onKeyDown={(event) => roving(event, setChosen)}
      >
        {GOALS.map((g, i) => {
          const on = i === chosen;
          return (
            <button
              key={g.want.en}
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
                <span className="block text-base font-semibold">{t(g.want)}</span>
                <span className={`mt-1.5 block font-code text-sm ${on ? 'text-brand' : 'text-muted'}`}>{g.use}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-[1.6_1_440px] flex-col gap-4 rounded-[18px] border border-border bg-surface p-5">
        <div className="rounded-xl border border-border bg-white p-3">
          {LAYOUTS.map((layout) => (
            <Drawing key={layout.id} layout={layout} presence={goal.presence} />
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-[13px] text-ink-soft">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[3px] border-[1.5px] border-brand bg-pastel-blue" />
            {t({ en: 'Install it', es: 'Instálalo', zh: '需要安装' })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[3px] border-[1.5px] border-dashed border-[#b07a00] bg-pastel-yellow" />
            {t({ en: 'Comes inside what you install', es: 'Viene dentro de lo que instalas', zh: '已内置在你安装的包中' })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-[3px] border-[1.5px] border-border-strong bg-hover" />
            {t({ en: 'Not needed', es: 'No hace falta', zh: '不需要' })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-[1.6px] border-brand" />
            {t({ en: 'uses', es: 'usa', zh: '依赖' })}
          </span>
        </div>
        <div key={chosen} className="flex animate-enter flex-col items-start gap-2.5">
          {goal.commands.map((command) => (
            <InstallCommand key={command} command={command} />
          ))}
          <p className="m-0 text-[15px] leading-normal text-ink-soft">{t(goal.note)}</p>
        </div>
      </div>
    </div>
  );
}

/** The packages and who uses whom, each box coloured by how it is in the application. */
function Drawing({ layout, presence }: { layout: Layout; presence: Record<PackageName, Presence> }) {
  const t = useT();
  const [w, h] = layout.box;
  const names = Object.keys(layout.at) as PackageName[];
  const arrow = (live: boolean) => `pkg-${layout.id}-${live ? 'on' : 'off'}`;
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="img"
      aria-label={names.map((name) => `${name}: ${t(LOOK[presence[name]].label)}`).join(', ')}
      className={`h-auto w-full ${layout.id === 'wide' ? 'hidden sm:block' : 'mx-auto block max-w-[360px] sm:hidden'}`}
    >
      <defs>
        {[true, false].map((live) => (
          <marker key={String(live)} id={arrow(live)} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill={live ? '#0b57d0' : '#c9c6be'} />
          </marker>
        ))}
      </defs>
      {layout.uses.map(([from, to, path]) => {
        const live = presence[from] !== 'none' && presence[to] !== 'none';
        return <path key={path} d={path} fill="none" strokeWidth="1.6" markerEnd={`url(#${arrow(live)})`} className={`${smooth} ${live ? 'stroke-brand' : 'stroke-[#c9c6be]'}`} />;
      })}
      {names.map((name) => {
        const [x, y] = layout.at[name];
        const look = LOOK[presence[name]];
        return (
          <g key={name}>
            <rect x={x} y={y} width={w} height={h} rx="10" strokeWidth="1.6" className={`${smooth} ${look.box}`} />
            <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" className={`${smooth} font-code text-[15px] font-medium ${look.name}`}>
              {short(name)}
            </text>
            <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" className={`${smooth} font-text text-[11.5px] ${look.name}`}>
              {t(look.label)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
