'use client';

// The PDF of the lease, made here with renderPdf and the fonts of this site,
// and read back: the tree of tags a screen reader finds in it, with the text
// of each, read out of the PDF itself, not out of the document.

import { type Doc, type FontFile, readFont, renderPdf, setAltText } from '@rebodocs/core';
import { unzlibSync } from 'fflate';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@/components/i18n';
import type { L } from '@/lib/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { DemoBox, Readout } from '../ui';
import { lease } from './sample';

const latin1 = (bytes: Uint8Array) => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return out;
};
const utf16 = (hex: string) => String.fromCharCode(...(hex.match(/.{4}/g) ?? []).map((h) => parseInt(h, 16)));

/** The objects of a PDF by number, their streams unsqueezed. */
function objects(pdf: Uint8Array): Map<number, string> {
  const text = latin1(pdf);
  const out = new Map<number, string>();
  for (const match of text.matchAll(/(\d+) 0 obj\n([^\n]*)\n(stream\n)?/g)) {
    let body = match[2];
    if (match[3]) {
      const start = match.index + match[0].length;
      const data = pdf.slice(start, start + Number(/\/Length (\d+)/.exec(body)?.[1] ?? 0));
      body += `\n${body.includes('/FlateDecode') ? latin1(unzlibSync(data)) : latin1(data)}`;
    }
    out.set(Number(match[1]), body);
  }
  return out;
}

interface Tag {
  type: string;
  depth: number;
  text: string;
  alt?: string;
}

/** The tree of tags of a PDF, each with the text of the pieces of the pages that are its own. */
function readTags(pdf: Uint8Array): Tag[] {
  const all = objects(pdf);
  const find = (start: string) => [...all.values()].find((body) => body.startsWith(start)) ?? '';
  // What each font's codes stand for: its ToUnicode map, or the codes of a font every reader has.
  const fonts = new Map<string, Map<string, string> | undefined>();
  const resources = /\/Font << ([^>]*) >>/.exec([...all.values()].find((body) => body.includes('/XObject <<')) ?? '')?.[1] ?? '';
  for (const [, name, id] of resources.matchAll(/\/(\w+) (\d+) 0 R/g)) {
    const toUnicode = /\/ToUnicode (\d+) 0 R/.exec(all.get(Number(id)) ?? '')?.[1];
    const map = toUnicode ? new Map([...(all.get(Number(toUnicode)) ?? '').matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/g)].map((m) => [m[1], utf16(m[2])])) : undefined;
    fonts.set(name, map);
  }
  // The text of each piece, by its page and its number.
  const pieces = new Map<string, string>();
  for (const [, page] of find('<< /Type /Pages').matchAll(/(\d+) 0 R/g)) {
    const content = all.get(Number(/\/Contents (\d+) 0 R/.exec(all.get(Number(page)) ?? '')?.[1])) ?? '';
    let mcid: string | undefined;
    let font: Map<string, string> | undefined;
    for (const op of content.matchAll(/<<\/MCID (\d+)>> BDC|\/Artifact BMC|EMC|\/(\w+) [\d.]+ Tf|<([0-9A-F]*)> Tj/g)) {
      if (op[1]) mcid = `${page}:${op[1]}`;
      else if (op[0] === 'EMC' || op[0] === '/Artifact BMC') mcid = undefined;
      else if (op[2]) font = fonts.get(op[2]);
      else if (op[3] !== undefined && mcid) {
        const codes = font ? (op[3].match(/.{4}/g) ?? []) : (op[3].match(/.{2}/g) ?? []);
        pieces.set(mcid, (pieces.get(mcid) ?? '') + codes.map((code) => (font ? (font.get(code) ?? '') : String.fromCharCode(parseInt(code, 16)))).join(''));
      }
    }
  }
  const tags: Tag[] = [];
  const walk = (id: number, depth: number) => {
    const body = all.get(id) ?? '';
    const tag: Tag = { type: /\/S \/(\w+)/.exec(body)?.[1] ?? '?', depth, text: '' };
    const alt = /\/Alt <FEFF([0-9A-F]*)>/.exec(body)?.[1];
    if (alt !== undefined) tag.alt = utf16(alt);
    tags.push(tag);
    for (const kid of (/\/K \[(.*)\] >>$/.exec(body)?.[1] ?? '').matchAll(/<< \/Type \/MCR \/Pg (\d+) 0 R \/MCID (\d+) >>|<< \/Type \/OBJR[^>]*>>|(\d+) 0 R/g)) {
      if (kid[1]) tag.text += pieces.get(`${kid[1]}:${kid[2]}`) ?? '';
      else if (kid[3]) walk(Number(kid[3]), depth + 1);
    }
    tag.text = tag.text.replace(/\s+/g, ' ').trim();
  };
  const root = /\/StructTreeRoot (\d+) 0 R/.exec(find('<< /Type /Catalog'))?.[1];
  const top = /\/K (\d+) 0 R/.exec(all.get(Number(root)) ?? '')?.[1];
  if (top) walk(Number(top), 0);
  return tags;
}

const LANGUAGES: [string, L][] = [
  ['en-GB', { en: 'English', es: 'Inglés', zh: '英文' }],
  ['es-MX', { en: 'Spanish', es: 'Español', zh: '西班牙文' }],
  ['zh-CN', { en: 'Chinese', es: 'Chino', zh: '中文' }],
  ['', { en: 'None', es: 'Ninguno', zh: '无' }],
];

export default function PdfDemo() {
  const [doc, setDoc] = useState<Doc>();
  const [fonts, setFonts] = useState<FontFile[]>([]);
  const [language, setLanguage] = useState('en-GB');
  const [described, setDescribed] = useState(true);
  const t = useT();

  useEffect(() => {
    void lease().then(setDoc);
    void Promise.all(['CourierPrime-Regular', 'CourierPrime-Bold', 'CourierPrime-Italic'].map(async (name) => readFont(new Uint8Array(await (await fetch(`/fonts/${name}.ttf`)).arrayBuffer())))).then(
      (read) => setFonts(read.filter((font): font is FontFile => !!font)),
    );
  }, []);

  const made = useMemo(() => {
    if (!doc || !fonts.length) return undefined;
    // The paragraph of the picture, found by its drawing.
    const picture = doc.paragraphs.findIndex((p) => p.runs.some((run) => run.props.object?.includes('<wp:docPr')));
    const shown = described ? doc : setAltText(doc, { para: picture, offset: 0 }, '');
    const { pdf } = renderPdf(shown, fonts, 'Lease of the flat', language || undefined);
    const text = latin1(pdf);
    return {
      pdf,
      tags: readTags(pdf),
      universal: text.includes('<pdfuaid:part>1'),
      bookmarks: (text.match(/\/Title <FEFF[0-9A-F]*> \/Parent/g) ?? []).length,
      lang: /\/Lang \(([^)]*)\)/.exec(text)?.[1],
    };
  }, [doc, fonts, language, described]);

  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!made) return;
    const link = URL.createObjectURL(new Blob([made.pdf], { type: 'application/pdf' }));
    setUrl(link);
    return () => URL.revokeObjectURL(link);
  }, [made]);

  const pill = (on: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold ${on ? `border-transparent ${PASTEL_CLASS.green}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`;
  const why = !made
    ? ''
    : made.universal
      ? t({ en: 'said', es: 'lo dice', zh: '已声明' })
      : !made.lang
        ? t({ en: 'not said: no language', es: 'no lo dice: sin idioma', zh: '未声明：没有语言' })
        : !described
          ? t({ en: 'not said: a picture has no description', es: 'no lo dice: una imagen no tiene descripción', zh: '未声明：有图片没有描述' })
          : t({ en: 'not said', es: 'no lo dice', zh: '未声明' });

  return (
    <DemoBox
      title={t({ en: 'What a screen reader finds in the PDF', es: 'Lo que encuentra un lector de pantalla en el PDF', zh: '屏幕阅读器在 PDF 中找到的内容' })}
      aside={
        <>
          <div>
            <p className={CAPTION}>{t({ en: 'Language', es: 'Idioma', zh: '语言' })}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {LANGUAGES.map(([tag, name]) => (
                <button key={name.en} type="button" aria-pressed={language === tag} className={pill(language === tag)} onClick={() => setLanguage(tag)}>
                  {t(name)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-pressed={described} className={pill(described)} onClick={() => setDescribed(!described)}>
              {t({ en: 'The picture has a description', es: 'La imagen tiene descripción', zh: '图片有描述' })}
            </button>
          </div>
          <Readout
            label={t({ en: 'The PDF', es: 'El PDF', zh: 'PDF' })}
            lines={
              made
                ? [
                    [t({ en: 'tagged', es: 'etiquetado', zh: '带标签' }), t({ en: 'yes', es: 'sí', zh: '是' }), 'good'],
                    [t({ en: 'language', es: 'idioma', zh: '语言' }), made.lang ?? t({ en: 'none', es: 'ninguno', zh: '无' }), made.lang ? 'good' : 'warn'],
                    [t({ en: 'bookmarks', es: 'marcadores', zh: '书签' }), String(made.bookmarks)],
                    ['PDF/UA', why, made.universal ? 'good' : 'warn'],
                    [t({ en: 'size', es: 'tamaño', zh: '大小' }), `${(made.pdf.length / 1024).toFixed(0)} KB`, 'dim'],
                  ]
                : [['', t({ en: 'making it…', es: 'haciéndolo…', zh: '正在生成…' }), 'dim']]
            }
          />
          {url && (
            <a href={url} download="lease.pdf" className="self-start rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white no-underline hover:opacity-90">
              {t({ en: 'Download the PDF', es: 'Descargar el PDF', zh: '下载 PDF' })}
            </a>
          )}
        </>
      }
    >
      <ol
        tabIndex={0}
        aria-label={t({ en: 'The tags of the PDF', es: 'Las etiquetas del PDF', zh: 'PDF 的标签' })}
        className="m-0 grid max-h-[560px] list-none gap-0.5 overflow-auto p-0 font-code text-[13px] leading-[1.55]"
      >
        {made ? (
          made.tags.map((tag, i) => (
            <li key={i} className="flex gap-2" style={{ paddingLeft: tag.depth * 18 }}>
              <span className="flex-none font-semibold text-[#8250df]">{tag.type}</span>
              {tag.alt !== undefined && (
                <span className={tag.alt ? 'text-[#1a7f37]' : 'text-[#a04100]'}>{tag.alt ? `“${tag.alt}”` : t({ en: 'no description', es: 'sin descripción', zh: '无描述' })}</span>
              )}
              {tag.text && <span className="min-w-0 text-ink-soft">{tag.text}</span>}
            </li>
          ))
        ) : (
          <li className="text-muted">{t({ en: 'Making the PDF…', es: 'Haciendo el PDF…', zh: '正在生成 PDF…' })}</li>
        )}
      </ol>
    </DemoBox>
  );
}
