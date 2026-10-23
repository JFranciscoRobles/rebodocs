'use client';

// A real editor in a frame as wide as a phone, a tablet or the page: what the
// editor makes of each width, read from the editor itself. On a phone, it is
// the editor under the finger.

import { exportDocx } from '@rebodocs/core';
import { type DocsHandle, DocsEditor, getLocale, setLocale } from '@rebodocs/react';
import { useEffect, useRef, useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { Readout } from '../ui';
import { lease } from '../accessibility/sample';

const WIDTHS = [
  [360, 'Small phone'],
  [390, 'Phone'],
  [768, 'Tablet'],
  [0, 'All of it'],
] as const;

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

  useEffect(() => {
    const was = getLocale();
    setLocale('en');
    void lease().then((doc) => setFile(exportDocx(doc)));
    return () => setLocale(was);
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
          <p className={CAPTION}>Width of the window</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {WIDTHS.map(([px, name]) => (
              <button key={name} type="button" aria-pressed={width === px} className={pill(width === px)} onClick={() => setWidth(px)}>
                {name}
                {px ? ` · ${px}` : ''}
              </button>
            ))}
          </div>
        </div>
        <button type="button" aria-pressed={reading} className={pill(reading)} onClick={toggleReading}>
          Reading view
        </button>
      </div>
      <div className="flex flex-wrap items-start justify-center gap-6 bg-[#ebe9e4] px-4 py-6">
        <div
          ref={frame}
          className="h-[640px] max-w-full overflow-hidden rounded-[22px] border-[6px] border-[#2f2e2b] bg-white shadow-lg transition-[width] duration-300"
          style={{ width: width ? width + 12 : '100%' }}
        >
          {file ? (
            <DocsEditor docx={file} name="lease.docx" locale="en" author="Ana" onReady={ready} features={{ panel: false }} />
          ) : (
            <p className="m-0 grid h-full place-items-center text-sm text-muted">Opening the editor…</p>
          )}
        </div>
        <div className="w-[260px] max-w-full">
          <Readout
            label="What the editor made of it"
            lines={
              seen
                ? [
                    ['width', `${seen.width} px`],
                    ['narrow', seen.narrow ? 'yes, under 600' : 'no', seen.narrow ? 'good' : 'dim'],
                    ['zoom', `${Math.round(seen.zoom * 100)} %`],
                    ['around pages', seen.gap],
                    ['ruler', seen.ruler ? 'shown' : 'put away', seen.ruler ? 'dim' : 'good'],
                    ['view', seen.view === 'flow' ? 'reading' : 'pages'],
                    ['by touch', seen.touch ? 'yes' : 'no', seen.touch ? 'good' : 'dim'],
                  ]
                : [['', 'opening…', 'dim']]
            }
          />
          <p className="m-0 mt-3 text-[13.5px] leading-normal text-ink-soft">Open this page on a phone to try the gestures on it: “by touch” turns on with the first touch.</p>
        </div>
      </div>
    </div>
  );
}
