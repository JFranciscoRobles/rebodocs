'use client';

// A font no machine has, given to the page: Courier Prime, from public/fonts.
// The document is put in it, and the PDF and the DOCX made of it say what they
// carry: read from the bytes the editor writes (pdf.ts, docx/export.ts).

import { type DocsHandle, type FontSource, DocsEditor, fontFamilies, getLocale, onFontsChange, setLocale } from '@rebodocs/react';
import { useEffect, useRef, useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
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

  useEffect(() => {
    let gone = false;
    fetch('/demo.docx')
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setFile(new Uint8Array(bytes)))
      .catch(() => !gone && setFailed(true));
    const was = getLocale();
    setLocale('en');
    // Given on another visit to this page, the font is there already: fonts stay with the page.
    setFamilies(fontFamilies());
    const stop = onFontsChange(() => setFamilies(fontFamilies()));
    return () => {
      gone = true;
      stop();
      setLocale(was);
    };
  }, []);

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
      const says = [embedded && `${embedded} embedded, cut down`, standard.length && `standard: ${standard.join(', ')}`].filter(Boolean).join('; ');
      setMade({ kind, size: bytes.length, says, good: embedded > 0, url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })) });
    } else {
      const bytes = editor.exportDocx();
      const faces = docxFonts(bytes);
      setMade({
        kind,
        size: bytes.length,
        says: faces ? `${faces} face${faces === 1 ? '' : 's'} of ${FAMILY} inside${embed === 'subset' ? ', cut down' : ', whole'}` : 'no font inside',
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
      title="Give it a font"
      aside={
        <>
          <div className="flex flex-col gap-2.5">
            {step(1, `Give the page ${FAMILY}`, has)}
            <button type="button" disabled={!file || !!fonts || has} onClick={give} className={`${button} self-start bg-ink text-white`}>
              fonts={'{[…3 faces]}'}
            </button>
            {step(2, 'Put the document in it', inIt)}
            <button type="button" disabled={!has || inIt} onClick={putInIt} className={`${button} self-start bg-ink text-white`}>
              Select all, font {FAMILY}
            </button>
            <p className="m-0 text-[13px] leading-normal text-muted">Or choose it in the toolbar&apos;s font box (under ⋯ here), where it comes first.</p>
            {step(3, 'Make the files', !!made)}
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
            label="What the editor says"
            lines={[
              ['fontFamilies()', families.length ? `[${families.map((f) => `'${f}'`).join(', ')}]` : '[]', has ? 'good' : 'dim'],
              ['fonts', fonts ? `${fonts.length} faces of ${FAMILY}` : 'not given', fonts ? 'good' : 'dim'],
              ['embedFonts', embed === 'subset' ? "'subset'" : String(embed)],
              made ? [made.kind, `${kb(made.size)}, ${made.says}`, made.good ? 'good' : 'warn'] : ['file', 'not made yet', 'dim'],
            ]}
          />
          {made && (
            <a href={made.url} download={made.kind === 'PDF' ? 'fonts.pdf' : 'fonts.docx'} className="text-sm font-medium text-brand hover:text-brand-hover">
              Open the {made.kind} it made
            </a>
          )}
          <p className={`${CAPTION} normal-case tracking-normal`}>The font stays with the page once given, until it is reloaded: going to another page of the site and back finds it there.</p>
        </>
      }
    >
      <div className="-m-5 h-[520px] overflow-hidden rounded-[14px]">
        {file ? (
          <DocsEditor docx={file} name="receipt.docx" locale="en" fonts={fonts} embedFonts={embed} onReady={(docs) => (handle.current = docs)} />
        ) : (
          <p className="grid h-full place-items-center text-sm text-muted">{failed ? 'The sample document could not be loaded.' : 'Opening the document…'}</p>
        )}
      </div>
    </DemoBox>
  );
}
