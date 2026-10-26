'use client';

// A real editor in a frame as wide as a phone, a tablet or the page: what the
// editor makes of each width, read from the editor itself. On a phone, it is
// the editor under the finger.

import { exportDocx } from '@rebodocs/core';
import { type DocsHandle, DocsEditor } from '@rebodocs/react';
import { useEffect, useRef, useState } from 'react';
import { useEditorLocale } from '@/components/editorLocale';
import { useT } from '@/components/i18n';
import type { L } from '@/lib/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { Readout } from '../ui';
import { lease } from '../accessibility/sample';

const WIDTHS: [number, L][] = [
  [360, { en: 'Small phone', es: 'Teléfono pequeño', zh: '小屏手机' }],
  [390, { en: 'Phone', es: 'Teléfono', zh: '手机' }],
  [768, { en: 'Tablet', es: 'Tableta', zh: '平板' }],
  [0, { en: 'All of it', es: 'Todo', zh: '全宽' }],
];

interface Seen {
  width: number;
  narrow: boolean;
  zoom: number;
  gap: string;
  ruler: boolean;
  view: string;
  touch: boolean;
}

export default function PhoneDemo() {
  const [file, setFile] = useState<Uint8Array>();
  const [width, setWidth] = useState(390);
  const [seen, setSeen] = useState<Seen>();
  const handle = useRef<DocsHandle | undefined>(undefined);
  const frame = useRef<HTMLDivElement>(null);
  const t = useT();
  const editorLocale = useEditorLocale();

  useEffect(() => {
    void lease().then((doc) => setFile(exportDocx(doc)));
  }, []);

  /** What the editor makes of the width it has, read from it. */
  const read = () => {
    const docs = handle.current;
    const box = frame.current;
    if (!docs || !box) return;
    const editor = docs.editor;
    const ruler = box.querySelector<HTMLElement>('.dx-ruler');
    setSeen({
      width: box.clientWidth,
      narrow: !!box.querySelector('.dx-narrow'),
      zoom: editor.zoom,
      gap:
        getComputedStyle(box.querySelector('.dx-pages') ?? box)
          .getPropertyValue('--dx-gap')
          .trim() || '24px',
      ruler: !!ruler && ruler.offsetParent !== null,
      view: editor.view,
      touch: editor.byTouch,
    });
  };

  useEffect(() => {
    const box = frame.current;
    if (!box) return;
    // After the editor has fitted itself to the new width.
    const watcher = new ResizeObserver(() => requestAnimationFrame(read));
    watcher.observe(box);
    return () => watcher.disconnect();
  }, [file]);

  const ready = (docs: DocsHandle | undefined) => {
    handle.current = docs;
    if (!docs) return;
    docs.editor.onChange(() => requestAnimationFrame(read));
    read();
  };

  const reading = seen?.view === 'flow';
  const toggleReading = () => {
    const editor = handle.current?.editor;
    if (!editor) return;
    editor.setView(reading ? 'column' : 'flow');
    // Back to the pages in a narrow window: whole across it, as they started.
    if (reading && seen?.narrow) editor.setFit('width');
  };

  const pill = (on: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold ${on ? `border-transparent ${PASTEL_CLASS.green}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`;

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4 border-b border-border bg-surface px-6 py-5">
        <div>
          <p className={CAPTION}>{t({ en: 'Width of the window', es: 'Ancho de la ventana', zh: '窗口宽度' })}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {WIDTHS.map(([px, name]) => (
              <button key={name.en} type="button" aria-pressed={width === px} className={pill(width === px)} onClick={() => setWidth(px)}>
                {t(name)}
                {px ? ` · ${px}` : ''}
              </button>
            ))}
          </div>
        </div>
        <button type="button" aria-pressed={reading} className={pill(reading)} onClick={toggleReading}>
          {t({ en: 'Reading view', es: 'Vista de lectura', zh: '阅读视图' })}
        </button>
      </div>
      <div className="flex flex-wrap items-start justify-center gap-6 bg-[#ebe9e4] px-4 py-6">
        <div
          ref={frame}
          className="h-[640px] max-w-full overflow-hidden rounded-[22px] border-[6px] border-[#2f2e2b] bg-white shadow-lg transition-[width] duration-300"
          style={{ width: width ? width + 12 : '100%' }}
        >
          {file ? (
            <DocsEditor docx={file} name="lease.docx" locale={editorLocale} author="Ana" onReady={ready} features={{ panel: false }} />
          ) : (
            <p className="m-0 grid h-full place-items-center text-sm text-muted">{t({ en: 'Opening the editor…', es: 'Abriendo el editor…', zh: '正在打开编辑器…' })}</p>
          )}
        </div>
        <div className="w-[260px] max-w-full">
          <Readout
            label={t({ en: 'What the editor made of it', es: 'Lo que hizo el editor con eso', zh: '编辑器的处理结果' })}
            lines={
              seen
                ? [
                    [t({ en: 'width', es: 'ancho', zh: '宽度' }), `${seen.width} px`],
                    [
                      t({ en: 'narrow', es: 'angosto', zh: '窄屏' }),
                      seen.narrow ? t({ en: 'yes, under 600', es: 'sí, menos de 600', zh: '是，小于 600' }) : t({ en: 'no', es: 'no', zh: '否' }),
                      seen.narrow ? 'good' : 'dim',
                    ],
                    ['zoom', `${Math.round(seen.zoom * 100)} %`],
                    [t({ en: 'around pages', es: 'alrededor de las páginas', zh: '页面周围' }), seen.gap],
                    [
                      t({ en: 'ruler', es: 'regla', zh: '标尺' }),
                      seen.ruler ? t({ en: 'shown', es: 'visible', zh: '显示' }) : t({ en: 'put away', es: 'guardada', zh: '收起' }),
                      seen.ruler ? 'dim' : 'good',
                    ],
                    [t({ en: 'view', es: 'vista', zh: '视图' }), seen.view === 'flow' ? t({ en: 'reading', es: 'lectura', zh: '阅读' }) : t({ en: 'pages', es: 'páginas', zh: '分页' })],
                    [t({ en: 'by touch', es: 'táctil', zh: '触控' }), seen.touch ? t({ en: 'yes', es: 'sí', zh: '是' }) : t({ en: 'no', es: 'no', zh: '否' }), seen.touch ? 'good' : 'dim'],
                  ]
                : [['', t({ en: 'opening…', es: 'abriendo…', zh: '正在打开…' }), 'dim']]
            }
          />
          <p className="m-0 mt-3 text-[13.5px] leading-normal text-ink-soft">
            {t({
              en: 'Open this page on a phone to try the gestures on it: “by touch” turns on with the first touch.',
              es: 'Abre esta página en un teléfono para probar los gestos: “táctil” se enciende con el primer toque.',
              zh: '在手机上打开本页面即可试用手势：首次触摸后“触控”会变为“是”。',
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
