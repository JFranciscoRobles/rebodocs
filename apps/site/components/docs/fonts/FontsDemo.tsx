'use client';

// A font no machine has, given to the page: Courier Prime, from public/fonts.
// The document is put in it, and the PDF and the DOCX made of it say what they
// carry: read from the bytes the editor writes (pdf.ts, docx/export.ts).

import { type DocsHandle, type FontSource, DocsEditor, fontFamilies, onFontsChange } from '@rebodocs/react';
import { useEffect, useRef, useState } from 'react';
import { usePageEditorLocale } from '@/components/editorLocale';
import { useLocale, useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import { SAMPLE } from '@/lib/sample';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { FAMILY, FACES } from './data';

interface Made {
  kind: 'PDF' | 'DOCX';
  size: number;
  /** What the file says of its fonts. */
  says: string;
  good: boolean;
  url: string;
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
const latin1 = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

/** The fonts of a PDF the editor wrote: the dictionaries are not compressed, only the streams. */
function pdfFonts(bytes: Uint8Array): { embedded: number; standard: string[] } {
  const text = latin1(bytes);
  return {
    embedded: text.match(/\/FontFile[23] /g)?.length ?? 0,
    standard: [...new Set([...text.matchAll(/\/Subtype \/Type1 \/BaseFont \/([\w-]+)/g)].map((m) => m[1]))],
  };
}

/** The fonts a DOCX carries: the names of the files of a zip are written as they are. */
const docxFonts = (bytes: Uint8Array) => new Set(latin1(bytes).match(/word\/fonts\/[\w.]+\.odttf/g) ?? []).size;

export default function FontsDemo() {
  const [file, setFile] = useState<Uint8Array>();
  const [failed, setFailed] = useState(false);
  const handle = useRef<DocsHandle | undefined>(undefined);
  const [families, setFamilies] = useState<string[]>([]);
  const [fonts, setFonts] = useState<FontSource[]>();
  const [inIt, setInIt] = useState(false);
  const [embed, setEmbed] = useState<boolean | 'subset'>(true);
  const [made, setMade] = useState<Made>();
  const [busy, setBusy] = useState(false);
  const t = useT();
  const sample = SAMPLE[useLocale()];
  const locale = usePageEditorLocale();

  useEffect(() => {
    let gone = false;
    fetch(sample.file)
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setFile(new Uint8Array(bytes)))
      .catch(() => !gone && setFailed(true));
    // Given on another visit to this page, the font is there already: fonts stay with the page.
    setFamilies(fontFamilies());
    const stop = onFontsChange(() => setFamilies(fontFamilies()));
    return () => {
      gone = true;
      stop();
    };
  }, [sample.file]);

  useEffect(() => () => made && URL.revokeObjectURL(made.url), [made]);

  // Given to the editor already drawn: the prop is followed.
  const give = () => setFonts(FACES.map(({ file: name, bold, italic }) => ({ family: FAMILY, src: `/fonts/${name}`, bold, italic })));

  const putInIt = () => {
    const editor = handle.current?.editor;
    if (!editor) return;
    editor.selectAll();
    editor.setRunProps({ fontFamily: FAMILY });
    setInIt(true);
    setMade(undefined);
  };

  const make = async (kind: Made['kind']) => {
    const editor = handle.current?.editor;
    if (!editor) return;
    setBusy(true);
    if (kind === 'PDF') {
      const bytes = await editor.exportPdf('Fonts');
      const { embedded, standard } = pdfFonts(bytes);
      const says = [
        embedded && t({ en: `${embedded} embedded, cut down`, es: `${embedded} incrustadas, recortadas`, zh: `嵌入 ${embedded} 个，已精简` }),
        standard.length && t({ en: `standard: ${standard.join(', ')}`, es: `estándar: ${standard.join(', ')}`, zh: `标准字体：${standard.join(', ')}` }),
      ]
        .filter(Boolean)
        .join('; ');
      setMade({ kind, size: bytes.length, says, good: embedded > 0, url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })) });
    } else {
      const bytes = editor.exportDocx();
      const faces = docxFonts(bytes);
      setMade({
        kind,
        size: bytes.length,
        says: faces
          ? embed === 'subset'
            ? t({
                en: `${faces} face${faces === 1 ? '' : 's'} of ${FAMILY} inside, cut down`,
                es: `${faces} variante${faces === 1 ? '' : 's'} de ${FAMILY} dentro, recortadas`,
                zh: `内含 ${FAMILY} 的 ${faces} 种字形，已精简`,
              })
            : t({
                en: `${faces} face${faces === 1 ? '' : 's'} of ${FAMILY} inside, whole`,
                es: `${faces} variante${faces === 1 ? '' : 's'} de ${FAMILY} dentro, enteras`,
                zh: `内含 ${FAMILY} 的 ${faces} 种完整字形`,
              })
          : t({ en: 'no font inside', es: 'ninguna fuente dentro', zh: '未嵌入字体' }),
        good: faces > 0,
        url: URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })),
      });
    }
    setBusy(false);
  };

  const has = families.includes(FAMILY);
  const button = 'cursor-pointer rounded-lg border-0 px-3 py-1.5 text-sm font-semibold disabled:cursor-default disabled:opacity-50';
  const step = (n: number, title: string, done: boolean) => (
    <p className="m-0 flex items-center gap-2 text-sm font-semibold text-ink">
      <span className={`grid size-5 flex-none place-items-center rounded-full text-[11px] ${done ? PASTEL_CLASS.green : PASTEL_CLASS.blue}`}>{done ? '✓' : n}</span>
      {title}
    </p>
  );

  return (
    <DemoBox
      title={t({ en: 'Give it a font', es: 'Dale una fuente', zh: '添加字体' })}
      aside={
        <>
          <div className="flex flex-col gap-2.5">
            {step(1, t({ en: `Give the page ${FAMILY}`, es: `Dale ${FAMILY} a la página`, zh: `为页面添加 ${FAMILY}` }), has)}
            <button type="button" disabled={!file || !!fonts || has} onClick={give} className={`${button} self-start bg-ink text-white`}>
              fonts={'{[…3 faces]}'}
            </button>
            {step(2, t({ en: 'Put the document in it', es: 'Pon el documento en ella', zh: '把文档设为该字体' }), inIt)}
            <button type="button" disabled={!has || inIt} onClick={putInIt} className={`${button} self-start bg-ink text-white`}>
              {t({ en: `Select all, font ${FAMILY}`, es: `Seleccionar todo, fuente ${FAMILY}`, zh: `全选，字体设为 ${FAMILY}` })}
            </button>
            <p className="m-0 text-[13px] leading-normal text-muted">
              {t({
                en: 'Or choose it in the toolbar’s font box (under ⋯ here), where it comes first.',
                es: 'O elígela en el cuadro de fuentes de la barra (bajo ⋯ aquí), donde aparece primero.',
                zh: '也可以在工具栏的字体框中选择它（这里在 ⋯ 下），它排在最前面。',
              })}
            </p>
            {step(3, t({ en: 'Make the files', es: 'Genera los archivos', zh: '生成文件' }), !!made)}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={!file || busy} onClick={() => make('PDF')} className={`${button} ${PASTEL_CLASS.blue}`}>
                PDF
              </button>
              <button type="button" disabled={!file || busy} onClick={() => make('DOCX')} className={`${button} ${PASTEL_CLASS.purple}`}>
                DOCX
              </button>
              <label className="flex items-center gap-1.5 font-code text-[13px] text-ink-soft">
                embedFonts
                <select
                  value={String(embed)}
                  onChange={(e) => setEmbed(e.target.value === 'subset' ? 'subset' : e.target.value === 'true')}
                  className="rounded-md border border-border bg-white px-1.5 py-1 font-code text-[13px] text-ink"
                >
                  <option value="true">true</option>
                  <option value="subset">&apos;subset&apos;</option>
                  <option value="false">false</option>
                </select>
              </label>
            </div>
          </div>
          <Readout
            label={t({ en: 'What the editor says', es: 'Lo que dice el editor', zh: '编辑器的状态' })}
            lines={[
              ['fontFamilies()', families.length ? `[${families.map((f) => `'${f}'`).join(', ')}]` : '[]', has ? 'good' : 'dim'],
              [
                'fonts',
                fonts
                  ? t({ en: `${fonts.length} faces of ${FAMILY}`, es: `${fonts.length} variantes de ${FAMILY}`, zh: `${FAMILY} 的 ${fonts.length} 种字形` })
                  : t({ en: 'not given', es: 'sin dar', zh: '未添加' }),
                fonts ? 'good' : 'dim',
              ],
              ['embedFonts', embed === 'subset' ? "'subset'" : String(embed)],
              made
                ? [made.kind, `${kb(made.size)}, ${made.says}`, made.good ? 'good' : 'warn']
                : [t({ en: 'file', es: 'archivo', zh: '文件' }), t({ en: 'not made yet', es: 'todavía sin generar', zh: '尚未生成' }), 'dim'],
            ]}
          />
          {made && (
            <a href={made.url} download={made.kind === 'PDF' ? 'fonts.pdf' : 'fonts.docx'} className="text-sm font-medium text-brand hover:text-brand-hover">
              {t({ en: `Open the ${made.kind} it made`, es: `Abrir el ${made.kind} generado`, zh: `打开生成的 ${made.kind}` })}
            </a>
          )}
          <p className={`${CAPTION} normal-case tracking-normal`}>
            {t({
              en: 'The font stays with the page once given, until it is reloaded: going to another page of the site and back finds it there.',
              es: 'La fuente se queda con la página una vez dada, hasta que se recarga: ir a otra página del sitio y volver la encuentra ahí.',
              zh: '字体添加后会一直留在页面中，直到页面重新加载：切换到本站其他页面再回来，它仍然在。',
            })}
          </p>
        </>
      }
    >
      <div className="-m-5 h-[520px] overflow-hidden rounded-[14px]">
        {file ? (
          <DocsEditor docx={file} name={sample.name} locale={locale} fonts={fonts} embedFonts={embed} onReady={(docs) => (handle.current = docs)} />
        ) : (
          <p className="grid h-full place-items-center text-sm text-muted">
            {failed
              ? t({ en: 'The sample document could not be loaded.', es: 'No se pudo cargar el documento de ejemplo.', zh: '无法加载示例文档。' })
              : t({ en: 'Opening the document…', es: 'Abriendo el documento…', zh: '正在打开文档…' })}
          </p>
        )}
      </div>
    </DemoBox>
  );
}
