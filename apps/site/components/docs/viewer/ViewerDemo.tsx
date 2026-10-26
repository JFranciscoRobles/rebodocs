'use client';

// The viewer on the sample agreement: its two ways of setting the pages out,
// printing, and the first page as a picture, made in the page by pagePicture.

import zhHans from '@rebodocs/editor/locales/zh-Hans';
import { type Viewer, type ViewerLayout, addLocale, pagePicture } from '@rebodocs/viewer';
import { DocsViewer } from '@rebodocs/viewer/react';
import { useEffect, useState } from 'react';
import { useLocale, useT } from '@/components/i18n';
import { EDITOR_LOCALE } from '@/lib/i18n';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';

// The viewer is a package of its own, with the editor's words in it: Chinese is given to it here, as to the editor.
addLocale('zh-Hans', zhHans);

const button = 'rounded-lg border border-border bg-white px-3 py-1.5 text-[14px] text-ink disabled:opacity-50 aria-pressed:border-brand aria-pressed:bg-[#e8f0fd]';

export default function ViewerDemo() {
  const [docx, setDocx] = useState<Uint8Array>();
  const [layout, setLayout] = useState<ViewerLayout>('pages');
  const [viewer, setViewer] = useState<Viewer>();
  const [thumbnail, setThumbnail] = useState<{ url: string; bytes: number; ms: number }>();
  const t = useT();
  const locale = EDITOR_LOCALE[useLocale()];

  // The sample the site writes when it is built (`apps/demo/scripts/sample.ts`).
  useEffect(() => {
    fetch('/sample.docx')
      .then((answer) => answer.arrayBuffer())
      .then((bytes) => setDocx(new Uint8Array(bytes)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!docx) return;
    let url = '';
    const started = performance.now();
    pagePicture(docx, 360)
      .then((jpeg) => {
        url = URL.createObjectURL(jpeg);
        setThumbnail({ url, bytes: jpeg.size, ms: Math.round(performance.now() - started) });
      })
      .catch(() => {});
    return () => URL.revokeObjectURL(url);
  }, [docx]);

  return (
    <DemoBox
      title="DocsViewer"
      aside={
        <>
          <Readout
            label="viewer"
            lines={[
              ['viewer.pages', viewer ? String(viewer.pages) : '…'],
              ['viewer.layout', `'${layout}'`],
              ['viewer.editor.readOnly', viewer ? String(viewer.editor.readOnly) : '…', 'good'],
            ]}
          />
          <div>
            <p className={CAPTION}>pagePicture(docx, 360)</p>
            <div className="mt-2.5 flex items-start gap-4">
              {thumbnail ? (
                <img
                  src={thumbnail.url}
                  alt={t({ en: 'The first page of the agreement', es: 'La primera página del contrato', zh: '协议的首页' })}
                  className="w-[120px] rounded border border-border shadow-sm"
                />
              ) : (
                <span className="grid h-[155px] w-[120px] place-items-center rounded border border-border text-[12px] text-muted">{t({ en: 'drawing…', es: 'dibujando…', zh: '正在绘制…' })}</span>
              )}
              {thumbnail && (
                <p className="m-0 text-[13px] leading-normal text-muted">
                  {t({
                    en: `A JPEG of ${Math.round(thumbnail.bytes / 1024)} KB, made in this page in ${thumbnail.ms} ms, its longest side 360 pixels.`,
                    es: `Un JPEG de ${Math.round(thumbnail.bytes / 1024)} KB, hecho en esta página en ${thumbnail.ms} ms, con su lado más largo de 360 píxeles.`,
                    zh: `一张 ${Math.round(thumbnail.bytes / 1024)} KB 的 JPEG，在本页面中用 ${thumbnail.ms} 毫秒生成，最长边 360 像素。`,
                  })}
                </p>
              )}
            </div>
          </div>
        </>
      }
    >
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} aria-pressed={layout === 'pages'} onClick={() => setLayout('pages')}>
          {t({ en: 'One under another', es: 'Una debajo de otra', zh: '逐页排列' })}
        </button>
        <button type="button" className={button} aria-pressed={layout === 'all'} onClick={() => setLayout('all')}>
          {t({ en: 'All at once', es: 'Todas a la vez', zh: '全部显示' })}
        </button>
        <button type="button" className={button} disabled={!viewer} onClick={() => viewer?.print()}>
          {t({ en: 'Print', es: 'Imprimir', zh: '打印' })}
        </button>
      </div>
      <div className="mt-4 h-[520px] overflow-hidden rounded-lg border border-border">{docx && <DocsViewer docx={docx} layout={layout} locale={locale} onReady={setViewer} />}</div>
    </DemoBox>
  );
}
