'use client';

// What a server does with @rebodocs/core, run in this page: a template filled
// with the JSON typed here, laid out with font files read by readFont, and
// turned into a PDF, a DOCX and Markdown. No browser API takes part in it: the
// same calls, with the same fonts, give the same pages in Node.

import {
  type Doc,
  type FontFile,
  type TemplateData,
  applyRunProps,
  createDoc,
  exportDocx,
  exportMarkdown,
  fillVariables,
  insertTable,
  insertText,
  paragraphText,
  readFont,
  renderPdf,
  setParagraphStyle,
} from '@rebodocs/core';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';

/** A receipt with variables, set in `family`. */
function template(family: string): Doc {
  const lines = [
    'Receipt {{number}}',
    'Received from {{client | upper}} the amount of {{amount | currency}}, on {{date | long date}}, for the reservation of {{property}}.',
    'What it pays for:',
    '',
    '{{^paid}}The balance, {{balance | currency}}, is paid on the day the keys are handed over.{{/paid}}{{#paid}}Paid in full: thank you.{{/paid}}',
  ];
  let doc = setParagraphStyle(createDoc(lines.map((text) => ({ props: {}, runs: [{ text, props: {} }] }))), 0, 0, 'Heading1');
  doc = insertTable(doc, { para: 3, offset: 0 }, 3, 2).doc;
  const cells = doc.paragraphs.flatMap((p, i) => (p.cell ? [i] : []));
  // The middle row is written once for each item of "lines".
  ['Item', 'Amount', '{{#lines}}{{lines.item}}', '{{lines.amount | currency}}{{/lines}}', 'Total', '{{amount | currency}}'].forEach(
    (text, k) => (doc = insertText(doc, { para: cells[k], offset: 0 }, text).doc),
  );
  const last = doc.paragraphs.length - 1;
  return applyRunProps(doc, { from: { para: 0, offset: 0 }, to: { para: last, offset: paragraphText(doc.paragraphs[last]).length } }, { fontFamily: family });
}

const VALUES = `{
  "number": "1024",
  "client": "Ana Pérez",
  "amount": 2650,
  "date": "2026-10-21",
  "property": "the room on the third floor",
  "lines": [
    { "item": "Deposit", "amount": 2500 },
    { "item": "Cleaning", "amount": 150 }
  ],
  "paid": false,
  "balance": 7500
}`;

type Output = 'pdf' | 'markdown';

export default function RenderDemo() {
  const [fonts, setFonts] = useState<FontFile[]>([]);
  const [own, setOwn] = useState<FontFile[]>([]);
  const [arial, setArial] = useState(false);
  const [values, setValues] = useState(VALUES);
  const [output, setOutput] = useState<Output>('pdf');
  const typed = useDeferredValue(values);

  useEffect(() => {
    // The files a server would read from its disk; here, from the site.
    Promise.all(['CourierPrime-Regular', 'CourierPrime-Bold', 'CourierPrime-Italic'].map(async (name) => readFont(new Uint8Array(await (await fetch(`/fonts/${name}.ttf`)).arrayBuffer())))).then(
      (read) => setFonts(read.filter((font): font is FontFile => !!font)),
    );
  }, []);

  const made = useMemo(() => {
    let data: TemplateData;
    try {
      data = JSON.parse(typed) as TemplateData;
    } catch {
      return { error: 'That is not JSON.' };
    }
    if (!fonts.length) return undefined;
    const started = performance.now();
    const doc = fillVariables(template(arial ? 'Arial' : 'Courier Prime'), data, { locale: 'en-US' });
    const { pdf, layout, missingFonts } = renderPdf(doc, [...own, ...fonts], 'Receipt');
    const ms = performance.now() - started;
    return { pdf, pages: layout.pages.length, lines: layout.lines.length, missing: [...missingFonts], ms, docx: exportDocx(doc), markdown: exportMarkdown(doc) };
  }, [typed, fonts, own, arial]);

  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!made || 'error' in made) return;
    const next = URL.createObjectURL(new Blob([made.pdf], { type: 'application/pdf' }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [made]);

  const add = async (files: FileList | null) => {
    const read = await Promise.all([...(files ?? [])].map(async (file) => readFont(new Uint8Array(await file.arrayBuffer()))));
    setOwn((was) => [...was, ...read.filter((font): font is FontFile => !!font)]);
  };

  const download = (bytes: Uint8Array<ArrayBuffer> | string, name: string, type: string) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([bytes], { type }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const pill = (on: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold ${on ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`;
  const ok = made && !('error' in made) ? made : undefined;

  return (
    <DemoBox
      title="renderPdf"
      aside={
        <>
          <label className={CAPTION}>
            The data, as JSON
            <textarea
              value={values}
              onChange={(e) => setValues(e.target.value)}
              rows={14}
              spellCheck={false}
              className="mt-2 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 font-code text-[12.5px] normal-case leading-[1.55] tracking-normal text-ink"
            />
          </label>
          <div>
            <p className={CAPTION}>The fonts</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <button type="button" aria-pressed={arial} onClick={() => setArial(!arial)} className={pill(arial)}>
                The template asks for Arial
              </button>
              <label className="cursor-pointer rounded-full border border-border bg-white px-3 py-1 text-[13px] font-semibold text-ink-soft hover:bg-hover">
                Give a .ttf…
                <input type="file" accept=".ttf,.otf" multiple className="sr-only" onChange={(e) => void add(e.target.files)} />
              </label>
            </div>
            <p className="m-0 mt-1.5 text-[13px] leading-normal text-muted">Given: Courier Prime{own.length ? `, ${[...new Set(own.map((font) => font.family))].join(', ')}` : ''}.</p>
          </div>
          <Readout
            label="What it gives"
            lines={
              made && 'error' in made
                ? [['JSON.parse', made.error ?? '', 'warn']]
                : [
                    ['layout.pages.length', ok ? String(ok.pages) : '…'],
                    ['pdf.length', ok ? `${(ok.pdf.length / 1024).toFixed(1)} KB` : '…'],
                    ['missingFonts', ok ? (ok.missing.length ? ok.missing.map(([asked, used]) => `${asked} → ${used}`).join(', ') : 'none') : '…', ok?.missing.length ? 'warn' : 'good'],
                    ['time', ok ? `${Math.round(ok.ms)} ms` : '…', 'dim'],
                  ]
            }
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={!ok}
              onClick={() => ok && download(ok.docx, 'receipt.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
              className="cursor-pointer rounded-lg border border-border bg-white px-2.5 py-1 text-[13px] font-semibold text-ink-soft hover:bg-hover disabled:opacity-50"
            >
              receipt.docx
            </button>
            <button
              type="button"
              disabled={!ok}
              onClick={() => ok && download(ok.pdf, 'receipt.pdf', 'application/pdf')}
              className="cursor-pointer rounded-lg border border-border bg-white px-2.5 py-1 text-[13px] font-semibold text-ink-soft hover:bg-hover disabled:opacity-50"
            >
              receipt.pdf
            </button>
          </div>
        </>
      }
    >
      <div role="group" aria-label="What to look at" className="mb-3 flex gap-1.5">
        {(
          [
            ['pdf', 'The PDF'],
            ['markdown', 'exportMarkdown'],
          ] as [Output, string][]
        ).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={output === value} onClick={() => setOutput(value)} className={pill(output === value)}>
            {label}
          </button>
        ))}
      </div>
      {output === 'pdf' ? (
        url ? (
          <iframe title="The PDF" src={`${url}#toolbar=0&view=FitH`} className="h-[520px] w-full rounded-lg border border-border bg-white" />
        ) : (
          <p className="m-0 grid h-[520px] place-items-center text-sm text-muted">Reading the fonts…</p>
        )
      ) : (
        <pre className="m-0 h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-surface px-4 py-3 font-code text-[13px] leading-[1.6] text-ink">{ok?.markdown ?? ''}</pre>
      )}
    </DemoBox>
  );
}
