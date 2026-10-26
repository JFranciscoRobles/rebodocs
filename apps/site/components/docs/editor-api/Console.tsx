'use client';

// The editor itself on the page, with no interface of its own: the calls on
// the right are the Editor's methods, run on it as they are written, and the
// values under them are read from it at each change.

import { paragraphText } from '@rebodocs/core';
import { type Editor, type PageSetup, DocsProvider, DocsSurface, useDocs } from '@rebodocs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePageEditorLocale } from '@/components/editorLocale';
import { useLocale, useT } from '@/components/i18n';
import type { L, Locale, T } from '@/lib/i18n';
import { SAMPLE } from '@/lib/sample';
import { Readout } from '../ui';

export const RUN_EVENT = 'editor-api-run';
/** What the rest of the page sends: a call of CALLS by its key, or a page to set, from "Points". */
export type RunDetail = string | { code: string; page: Partial<PageSetup> };

interface Call {
  label: L;
  code: (e: Editor) => string;
  run: (e: Editor) => unknown;
}

/** The words of the sample document the calls use, in each language of the site: public/demo*.docx. */
const WORDS: L<{ values: Record<string, string>; hello: string; note: string; find: string; replace: string }> = {
  en: { values: { city: 'Lisbon', date: '20 October 2026', client: 'ana lópez' }, hello: 'Hello ', note: 'Check this before sending.', find: 'deposit', replace: 'down payment' },
  es: { values: { ciudad: 'Guadalajara', fecha: '2026-10-20', cliente: 'ana lópez' }, hello: 'Hola ', note: 'Revisar esto antes de enviarlo.', find: 'anticipo', replace: 'enganche' },
  zh: { values: { 城市: '上海', 日期: '2026-10-20', 客户: '李华' }, hello: '你好', note: '发送前请检查。', find: '定金', replace: '预付款' },
};

/** Where the first word of the title ends: at its first space, or after two characters of a title in Chinese. */
const firstWord = (e: Editor) => {
  const text = paragraphText(e.doc.paragraphs[0]);
  const space = text.search(/\s/);
  return space > 0 ? space : Math.min(2, text.length);
};

const quote = (text: string) => `'${text.replace(/'/g, "\\'")}'`;

/** The calls the editor on the page can run, by the key the reference uses. */
export function callsOf(locale: Locale): Record<string, Call> {
  const w = WORDS[locale];
  return {
    select: {
      label: { en: 'Select a word', es: 'Selecciona una palabra', zh: '选择一个词' },
      code: (e) => `editor.setSelection({ para: 0, offset: 0 }, { para: 0, offset: ${firstWord(e)} })`,
      run: (e) => e.setSelection({ para: 0, offset: 0 }, { para: 0, offset: firstWord(e) }),
    },
    selectAll: { label: { en: 'Select all', es: 'Seleccionar todo', zh: '全选' }, code: () => 'editor.selectAll()', run: (e) => e.selectAll() },
    bold: { label: { en: 'Bold', es: 'Negrita', zh: '加粗' }, code: () => "editor.toggleMark('bold')", run: (e) => e.toggleMark('bold') },
    red: { label: { en: 'Red', es: 'Rojo', zh: '红色' }, code: () => "editor.setRunProps({ color: 'C0392B' })", run: (e) => e.setRunProps({ color: 'C0392B' }) },
    center: { label: { en: 'Centre', es: 'Centrar', zh: '居中' }, code: () => "editor.setParagraphProps({ align: 'center' })", run: (e) => e.setParagraphProps({ align: 'center' }) },
    list: { label: { en: 'Bullets', es: 'Viñetas', zh: '项目符号' }, code: () => "editor.toggleList('bullet')", run: (e) => e.toggleList('bullet') },
    insert: { label: { en: 'Type', es: 'Escribir', zh: '输入' }, code: () => `editor.insertText(${quote(w.hello)})`, run: (e) => e.insertText(w.hello) },
    undo: { label: { en: 'Undo', es: 'Deshacer', zh: '撤销' }, code: () => 'editor.undo()', run: (e) => e.undo() },
    table: { label: { en: 'Table', es: 'Tabla', zh: '表格' }, code: () => 'editor.insertTable(2, 3)', run: (e) => e.insertTable(2, 3) },
    note: { label: { en: 'Comment', es: 'Comentar', zh: '批注' }, code: () => `editor.addNote(${quote(w.note)})`, run: (e) => e.addNote(w.note) },
    track: {
      label: { en: 'Track changes', es: 'Controlar cambios', zh: '修订' },
      code: (e) => `editor.setTrackChanges(${!e.trackChanges})`,
      run: (e) => e.setTrackChanges(!e.trackChanges),
    },
    find: { label: { en: 'Find', es: 'Buscar', zh: '查找' }, code: () => `editor.find(${quote(w.find)})`, run: (e) => e.find(w.find) },
    next: { label: { en: 'Next', es: 'Siguiente', zh: '下一个' }, code: () => 'editor.findStep(1)', run: (e) => e.findStep(1) },
    replace: { label: { en: 'Replace all', es: 'Reemplazar todo', zh: '全部替换' }, code: () => `editor.replaceAllFound(${quote(w.replace)})`, run: (e) => e.replaceAllFound(w.replace) },
    variables: { label: { en: 'Variables', es: 'Variables', zh: '变量' }, code: () => 'editor.variables', run: (e) => e.variables },
    fill: {
      label: { en: 'Fill', es: 'Llenar', zh: '填写' },
      code: () =>
        `editor.fillVariables(${JSON.stringify(w.values)
          .replace(/"([^"]+)":/g, '$1: ')
          .replace(/,/g, ', ')
          .replace(/"/g, "'")})`,
      run: (e) => e.fillVariables(w.values),
    },
    markdown: { label: { en: 'Markdown', es: 'Markdown', zh: 'Markdown' }, code: () => 'editor.exportMarkdown()', run: (e) => e.exportMarkdown() },
    docx: { label: { en: 'DOCX', es: 'DOCX', zh: 'DOCX' }, code: () => 'editor.exportDocx()', run: (e) => e.exportDocx() },
    zoom: {
      label: { en: 'Zoom', es: 'Zoom', zh: '缩放' },
      code: (e) => (e.fit ? 'editor.setZoom(1.25)' : "editor.setFit('width')"),
      run: (e) => (e.fit ? e.setZoom(1.25) : e.setFit('width')),
    },
    flow: {
      label: { en: 'Flow view', es: 'Vista continua', zh: '流式视图' },
      code: (e) => `editor.setView('${e.view === 'flow' ? 'column' : 'flow'}')`,
      run: (e) => e.setView(e.view === 'flow' ? 'column' : 'flow'),
    },
  };
}

const SHELVES: [L, string[]][] = [
  [{ en: 'Selection', es: 'Selección', zh: '选区' }, ['select', 'selectAll']],
  [{ en: 'Editing', es: 'Edición', zh: '编辑' }, ['bold', 'red', 'center', 'list', 'insert', 'undo']],
  [{ en: 'Objects', es: 'Objetos', zh: '对象' }, ['table', 'note', 'track']],
  [{ en: 'Finding', es: 'Buscar', zh: '查找' }, ['find', 'next', 'replace']],
  [{ en: 'Templates', es: 'Plantillas', zh: '模板' }, ['variables', 'fill']],
  [{ en: 'Out', es: 'Salida', zh: '导出' }, ['markdown', 'docx']],
  [{ en: 'View', es: 'Vista', zh: '视图' }, ['zoom', 'flow']],
];

/** A value as the console of a browser would show it, short. */
function shown(value: unknown, t: T): [string, 'good' | 'warn' | 'dim'] {
  if (value === undefined) return ['undefined', 'dim'];
  if (value instanceof Uint8Array) return [`Uint8Array(${value.length.toLocaleString('en')} ${t({ en: 'bytes', es: 'bytes', zh: '字节' })})`, 'good'];
  if (typeof value === 'string') return [JSON.stringify(value.length > 60 ? `${value.slice(0, 60)}…` : value), 'warn'];
  return [JSON.stringify(value), 'good'];
}

const pos = (p: { para: number; offset: number }) => `{ para: ${p.para}, offset: ${p.offset} }`;

type Result = [string, 'good' | 'warn' | 'dim'];

function Panel() {
  const t = useT();
  const locale = useLocale();
  const CALLS = useMemo(() => callsOf(locale), [locale]);
  const { editor } = useDocs();
  const [, setTick] = useState(0);
  const [last, setLast] = useState<{ code: string; result: Result }>();
  const [typed, setTyped] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [back, setBack] = useState(-1);
  // How many changes replaced the document, and how many moved only the selection or the view.
  const [changes, setChanges] = useState({ doc: 0, other: 0 });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;
    let before = editor.doc;
    return editor.onChange(() => {
      const replaced = editor.doc !== before;
      before = editor.doc;
      setChanges((n) => ({ doc: n.doc + (replaced ? 1 : 0), other: n.other + (replaced ? 0 : 1) }));
      setTick((n) => n + 1);
    });
  }, [editor]);
  // The page as wide as the pane, whatever its width.
  useEffect(() => editor?.setFit('width'), [editor]);

  const perform = (code: string, run: (e: Editor) => unknown, focus = true) => {
    if (!editor) return;
    try {
      const value = run(editor);
      if (value instanceof Promise) {
        setLast({ code, result: [t({ en: 'Promise (pending)', es: 'Promise (pendiente)', zh: 'Promise（等待中）' }), 'dim'] });
        value.then(
          (done) => setLast({ code, result: shown(done, t) }),
          (error) => setLast({ code, result: [String(error), 'warn'] }),
        );
      } else setLast({ code, result: shown(value, t) });
    } catch (error) {
      setLast({ code, result: [String(error), 'warn'] });
    }
    // The keyboard back to the document, as a toolbar does, so the selection stays seen.
    if (focus) editor.focus();
  };
  const call = (detail: RunDetail) => {
    if (!editor) return;
    if (typeof detail !== 'string') return perform(detail.code, (e) => e.setPage(detail.page));
    const c = CALLS[detail];
    if (c) perform(c.code(editor), c.run);
  };
  // What was typed after "editor.", run as it is written: in this browser, on the sample document.
  const runTyped = () => {
    const text = typed
      .trim()
      .replace(/^editor\./, '')
      .replace(/;$/, '');
    if (!text) return;
    let run: (e: Editor) => unknown;
    try {
      run = new Function('editor', `return (editor.${text});`) as (e: Editor) => unknown;
    } catch (error) {
      setLast({ code: `editor.${text}`, result: [String(error), 'warn'] });
      return;
    }
    perform(`editor.${text}`, run, false);
    setHistory((h) => [text, ...h.filter((x) => x !== text)].slice(0, 20));
    setBack(-1);
    setTyped('');
  };
  const callRef = useRef(call);
  callRef.current = call;

  // A "Run it" of the reference below.
  useEffect(() => {
    const onRun = (event: Event) => {
      box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      callRef.current((event as CustomEvent<RunDetail>).detail);
    };
    window.addEventListener(RUN_EVENT, onRun);
    return () => window.removeEventListener(RUN_EVENT, onRun);
  }, []);

  const e = editor;
  return (
    <div ref={box} className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 px-6 py-5">
      <div className="flex flex-col gap-2.5">
        {SHELVES.map(([shelf, keys]) => (
          <div key={shelf.en} className="flex flex-wrap items-center gap-1.5">
            <span className="w-[72px] flex-none text-xs font-semibold uppercase tracking-[0.04em] text-muted">{t(shelf)}</span>
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                disabled={!e}
                title={e ? CALLS[key].code(e) : undefined}
                onClick={() => call(key)}
                className="h-7.5 cursor-pointer rounded-[7px] border border-border-strong bg-white px-2.5 text-[13px] text-ink transition-colors hover:bg-hover disabled:cursor-default disabled:opacity-40"
              >
                {t(CALLS[key].label)}
              </button>
            ))}
          </div>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          runTyped();
        }}
        className="flex items-center gap-0 overflow-hidden rounded-lg border border-border-strong bg-white focus-within:border-brand"
      >
        <label htmlFor="api-typed" className="flex-none py-2 pl-3 font-code text-[13px] text-muted">
          editor.
        </label>
        <input
          id="api-typed"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            // Up and down go through what was run before, as in a console.
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            const to = Math.max(-1, Math.min(history.length - 1, back + (event.key === 'ArrowUp' ? 1 : -1)));
            setBack(to);
            setTyped(to < 0 ? '' : history[to]);
          }}
          disabled={!e}
          spellCheck={false}
          autoComplete="off"
          placeholder="setZoom(1.5)  ·  find('rent', { matchCase: true })"
          className="min-w-0 flex-1 border-0 bg-transparent py-2 pr-2 font-code text-[13px] text-ink outline-0"
        />
        <button
          type="submit"
          disabled={!e || !typed.trim()}
          className="h-9 flex-none cursor-pointer border-0 bg-brand px-3 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:cursor-default disabled:opacity-40"
        >
          {t({ en: 'Run', es: 'Ejecutar', zh: '运行' })}
        </button>
      </form>
      <Readout
        label={t({ en: 'You ran', es: 'Ejecutaste', zh: '你运行了' })}
        lines={
          last
            ? [
                ['>', last.code, 'warn'],
                [t({ en: 'returned', es: 'devolvió', zh: '返回' }), last.result[0], last.result[1]],
              ]
            : [['>', t({ en: 'press a call above, or click in the page', es: 'pulsa una llamada de arriba, o haz clic en la página', zh: '点击上面的调用，或在页面中点击' }), 'dim']]
        }
      />
      <Readout
        label={t({ en: 'Read from the editor, at each change', es: 'Leído del editor, en cada cambio', zh: '每次变化时从编辑器读取' })}
        live={false}
        lines={
          e
            ? [
                ['selection.anchor', pos(e.selection.anchor), 'good'],
                ['selection.focus', pos(e.selection.focus), 'good'],
                ['collapsed', String(e.collapsed), 'good'],
                ['selectedText', shown(e.selectedText, t)[0], 'warn'],
                ['activeRunProps().bold', String(e.activeRunProps().bold), 'good'],
                ['activeParagraphProps().align', JSON.stringify(e.activeParagraphProps().align), 'warn'],
                ['currentPage / pageCount', `${e.currentPage} / ${e.pageCount}`, 'good'],
                ['canUndo', String(e.canUndo), 'good'],
                ['findCount', String(e.findCount), 'good'],
                ['area', JSON.stringify(e.area), 'warn'],
                [
                  t({ en: 'onChange calls: doc !== before / same doc', es: 'llamadas a onChange: doc !== before / mismo doc', zh: 'onChange 调用：doc !== before / 同一 doc' }),
                  `${changes.doc} / ${changes.other}`,
                  'good',
                ],
                ['zoom, fit', `${Math.round(e.zoom * 100) / 100}, ${JSON.stringify(e.fit)}`, 'good'],
              ]
            : [['editor', t({ en: 'opening…', es: 'abriendo…', zh: '正在打开…' }), 'dim']]
        }
      />
    </div>
  );
}

/** The demo document, in a real editor, beside the calls. */
export default function Console() {
  const t = useT();
  const sample = SAMPLE[useLocale()];
  usePageEditorLocale();
  const [file, setFile] = useState<Uint8Array>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let gone = false;
    fetch(sample.file)
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setFile(new Uint8Array(bytes)))
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
    };
  }, [sample.file]);

  return (
    <div className="mt-7 flex flex-wrap overflow-hidden rounded-[18px] border border-border">
      {file ? (
        <DocsProvider docx={file} name={sample.name}>
          <div className="h-[560px] min-w-0 flex-[1.4_1_420px] border-border bg-[#e9eaee]">
            <DocsSurface className="h-full" />
          </div>
          <Panel />
        </DocsProvider>
      ) : (
        <p className="m-0 grid h-[560px] w-full place-items-center text-sm text-muted">
          {failed
            ? t({ en: 'The sample document could not be loaded.', es: 'No se pudo cargar el documento de ejemplo.', zh: '无法加载示例文档。' })
            : t({ en: 'Opening the document…', es: 'Abriendo el documento…', zh: '正在打开文档…' })}
        </p>
      )}
    </div>
  );
}
