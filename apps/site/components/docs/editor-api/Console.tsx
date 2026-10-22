'use client';

// The editor itself on the page, with no interface of its own: the calls on
// the right are the Editor's methods, run on it as they are written, and the
// values under them are read from it at each change.

import { type Editor, type PageSetup, DocsProvider, DocsSurface, setLocale, useDocs } from '@rebodocs/react';
import { useEffect, useRef, useState } from 'react';
import { Readout } from '../ui';

setLocale('en');

export const RUN_EVENT = 'editor-api-run';
/** What the rest of the page sends: a call of CALLS by its key, or a page to set, from "Points". */
export type RunDetail = string | { code: string; page: Partial<PageSetup> };

interface Call {
  label: string;
  code: (e: Editor) => string;
  run: (e: Editor) => unknown;
}

const VALUES = { city: 'Lisbon', date: '20 October 2026', client: 'ana lópez' };

/** The calls the editor on the page can run, by the key the reference uses. */
export const CALLS: Record<string, Call> = {
  select: { label: 'Select a word', code: () => 'editor.setSelection({ para: 0, offset: 0 }, { para: 0, offset: 11 })', run: (e) => e.setSelection({ para: 0, offset: 0 }, { para: 0, offset: 11 }) },
  selectAll: { label: 'Select all', code: () => 'editor.selectAll()', run: (e) => e.selectAll() },
  bold: { label: 'Bold', code: () => "editor.toggleMark('bold')", run: (e) => e.toggleMark('bold') },
  red: { label: 'Red', code: () => "editor.setRunProps({ color: 'C0392B' })", run: (e) => e.setRunProps({ color: 'C0392B' }) },
  center: { label: 'Centre', code: () => "editor.setParagraphProps({ align: 'center' })", run: (e) => e.setParagraphProps({ align: 'center' }) },
  list: { label: 'Bullets', code: () => "editor.toggleList('bullet')", run: (e) => e.toggleList('bullet') },
  insert: { label: 'Type', code: () => "editor.insertText('Hello ')", run: (e) => e.insertText('Hello ') },
  undo: { label: 'Undo', code: () => 'editor.undo()', run: (e) => e.undo() },
  table: { label: 'Table', code: () => 'editor.insertTable(2, 3)', run: (e) => e.insertTable(2, 3) },
  note: { label: 'Comment', code: () => "editor.addNote('Check this before sending.')", run: (e) => e.addNote('Check this before sending.') },
  track: { label: 'Track changes', code: (e) => `editor.setTrackChanges(${!e.trackChanges})`, run: (e) => e.setTrackChanges(!e.trackChanges) },
  find: { label: 'Find', code: () => "editor.find('deposit')", run: (e) => e.find('deposit') },
  next: { label: 'Next', code: () => 'editor.findStep(1)', run: (e) => e.findStep(1) },
  replace: { label: 'Replace all', code: () => "editor.replaceAllFound('down payment')", run: (e) => e.replaceAllFound('down payment') },
  variables: { label: 'Variables', code: () => 'editor.variables', run: (e) => e.variables },
  fill: { label: 'Fill', code: () => `editor.fillVariables(${JSON.stringify(VALUES).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ').replace(/"/g, "'")})`, run: (e) => e.fillVariables(VALUES) },
  markdown: { label: 'Markdown', code: () => 'editor.exportMarkdown()', run: (e) => e.exportMarkdown() },
  docx: { label: 'DOCX', code: () => 'editor.exportDocx()', run: (e) => e.exportDocx() },
  zoom: { label: 'Zoom', code: (e) => (e.fit ? 'editor.setZoom(1.25)' : "editor.setFit('width')"), run: (e) => (e.fit ? e.setZoom(1.25) : e.setFit('width')) },
  flow: { label: 'Flow view', code: (e) => `editor.setView('${e.view === 'flow' ? 'column' : 'flow'}')`, run: (e) => e.setView(e.view === 'flow' ? 'column' : 'flow') },
};

const SHELVES: [string, string[]][] = [
  ['Selection', ['select', 'selectAll']],
  ['Editing', ['bold', 'red', 'center', 'list', 'insert', 'undo']],
  ['Objects', ['table', 'note', 'track']],
  ['Finding', ['find', 'next', 'replace']],
  ['Templates', ['variables', 'fill']],
  ['Out', ['markdown', 'docx']],
  ['View', ['zoom', 'flow']],
];

/** A value as the console of a browser would show it, short. */
function shown(value: unknown): [string, 'good' | 'warn' | 'dim'] {
  if (value === undefined) return ['undefined', 'dim'];
  if (value instanceof Uint8Array) return [`Uint8Array(${value.length.toLocaleString('en')} bytes)`, 'good'];
  if (typeof value === 'string') return [JSON.stringify(value.length > 60 ? `${value.slice(0, 60)}…` : value), 'warn'];
  return [JSON.stringify(value), 'good'];
}

const pos = (p: { para: number; offset: number }) => `{ para: ${p.para}, offset: ${p.offset} }`;

type Result = [string, 'good' | 'warn' | 'dim'];

function Panel() {
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
        setLast({ code, result: ['Promise (pending)', 'dim'] });
        value.then(
          (done) => setLast({ code, result: shown(done) }),
          (error) => setLast({ code, result: [String(error), 'warn'] }),
        );
      } else setLast({ code, result: shown(value) });
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
    const text = typed.trim().replace(/^editor\./, '').replace(/;$/, '');
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
          <div key={shelf} className="flex flex-wrap items-center gap-1.5">
            <span className="w-[72px] flex-none text-xs font-semibold uppercase tracking-[0.04em] text-muted">{shelf}</span>
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                disabled={!e}
                title={e ? CALLS[key].code(e) : undefined}
                onClick={() => call(key)}
                className="h-7.5 cursor-pointer rounded-[7px] border border-border-strong bg-white px-2.5 text-[13px] text-ink transition-colors hover:bg-hover disabled:cursor-default disabled:opacity-40"
              >
                {CALLS[key].label}
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
        <button type="submit" disabled={!e || !typed.trim()} className="h-9 flex-none cursor-pointer border-0 bg-brand px-3 text-[13px] font-semibold text-white hover:bg-brand-hover disabled:cursor-default disabled:opacity-40">
          Run
        </button>
      </form>
      <Readout
        label="You ran"
        lines={
          last
            ? [
                ['>', last.code, 'warn'],
                ['returned', last.result[0], last.result[1]],
              ]
            : [['>', 'press a call above, or click in the page', 'dim']]
        }
      />
      <Readout
        label="Read from the editor, at each change"
        live={false}
        lines={
          e
            ? [
                ['selection.anchor', pos(e.selection.anchor), 'good'],
                ['selection.focus', pos(e.selection.focus), 'good'],
                ['collapsed', String(e.collapsed), 'good'],
                ['selectedText', shown(e.selectedText)[0], 'warn'],
                ['activeRunProps().bold', String(e.activeRunProps().bold), 'good'],
                ['activeParagraphProps().align', JSON.stringify(e.activeParagraphProps().align), 'warn'],
                ['currentPage / pageCount', `${e.currentPage} / ${e.pageCount}`, 'good'],
                ['canUndo', String(e.canUndo), 'good'],
                ['findCount', String(e.findCount), 'good'],
                ['area', JSON.stringify(e.area), 'warn'],
                ['onChange calls: doc !== before / same doc', `${changes.doc} / ${changes.other}`, 'good'],
                ['zoom, fit', `${Math.round(e.zoom * 100) / 100}, ${JSON.stringify(e.fit)}`, 'good'],
              ]
            : [['editor', 'opening…', 'dim']]
        }
      />
    </div>
  );
}

/** The demo document, in a real editor, beside the calls. */
export default function Console() {
  const [file, setFile] = useState<Uint8Array>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let gone = false;
    fetch('/demo.docx')
      .then((answer) => (answer.ok ? answer.arrayBuffer() : Promise.reject(new Error(String(answer.status)))))
      .then((bytes) => !gone && setFile(new Uint8Array(bytes)))
      .catch(() => !gone && setFailed(true));
    return () => {
      gone = true;
    };
  }, []);

  return (
    <div className="mt-7 flex flex-wrap overflow-hidden rounded-[18px] border border-border">
      {file ? (
        <DocsProvider docx={file} name="receipt.docx">
          <div className="h-[560px] min-w-0 flex-[1.4_1_420px] border-border bg-[#e9eaee]">
            <DocsSurface className="h-full" />
          </div>
          <Panel />
        </DocsProvider>
      ) : (
        <p className="m-0 grid h-[560px] w-full place-items-center text-sm text-muted">{failed ? 'The sample document could not be loaded.' : 'Opening the document…'}</p>
      )}
    </div>
  );
}
