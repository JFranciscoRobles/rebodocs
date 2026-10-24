'use client';

// A bare Editor, and the pieces around it put on and taken off: each choice
// takes every piece away (destroy) and makes the chosen ones again, wired to
// each other, as an application would. The code beside it is the code that
// makes what is shown.

import { exportDocx } from '@rebodocs/core';
import {
  Editor,
  createBubble,
  createFindBar,
  createFocusMode,
  createPanel,
  createRuler,
  createSidebar,
  createSlashMenu,
  createStatusBar,
  createVariableSuggest,
  createToolbar,
  getLocale,
  setLocale,
} from '@rebodocs/editor';
import { useEffect, useRef, useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION } from '../styles';
import { lease } from '../accessibility/sample';

const PIECES = [
  ['toolbar', 'Toolbar'],
  ['ruler', 'Ruler'],
  ['panel', 'Side panel'],
  ['status', 'Status bar'],
  ['bubble', 'Selection bar'],
  ['slash', '“/” menu'],
  ['suggest', '“{{” list'],
  ['find', 'Find'],
  ['menu', 'Menu'],
  ['focus', 'Full screen'],
] as const;

type Piece = (typeof PIECES)[number][0];

/** The code that makes the pieces chosen, wired as they are here. */
function codeFor(on: Set<Piece>): string {
  const has = (piece: Piece) => on.has(piece);
  const imports = [
    'Editor',
    has('toolbar') && 'createToolbar',
    has('ruler') && 'createRuler',
    has('panel') && 'createPanel',
    has('status') && 'createStatusBar',
    has('bubble') && 'createBubble',
    has('slash') && 'createSlashMenu',
    has('suggest') && 'createVariableSuggest',
    has('find') && 'createFindBar',
    has('menu') && 'createSidebar',
    has('focus') && 'createFocusMode',
  ].filter(Boolean);
  const lines = [`import { ${imports.join(', ')} } from '@rebodocs/editor';`, '', `const editor = new Editor(document.querySelector('#pages')!);`, 'editor.loadDocx(bytes);'];
  if (has('menu')) lines.push(`const menu = createSidebar(editor, {\n  fileName: () => 'lease.docx',\n  within: document.querySelector('#app')!,   // over the editor, not the whole page\n});`);
  if (has('find')) lines.push('const find = createFindBar(editor);');
  if (has('panel'))
    lines.push(
      `const panel = createPanel(document.querySelector('#panel')!, editor${has('toolbar') ? ', {\n  onToggle: () => toolbar.refresh(),   // the button is pressed while it is open\n}' : ''});`,
    );
  if (has('bubble')) lines.push('const bubble = createBubble(editor);', `editor.onLinkKey = () => bubble.ask('link');     // ⌘K`);
  if (has('slash')) lines.push(`createSlashMenu(editor${has('bubble') ? ', { ask: bubble.ask }' : ''});${has('bubble') ? '' : '   // without the bubble: no variable, no note'}`);
  if (has('suggest')) lines.push(`createVariableSuggest(editor, { variables: ['tenant', 'rent'] });`);
  if (has('focus')) lines.push('const focus = createFocusMode(editor);');
  if (has('toolbar')) {
    const options = [
      has('menu') && 'onMenu: menu.toggle',
      has('panel') && 'onPanel: panel.toggle',
      has('panel') && 'panelOpen: () => panel.isOpen',
      has('find') && 'onFind: () => find.open()',
      has('bubble') && `onInsertLink: () => bubble.ask('link')`,
    ].filter(Boolean);
    lines.push(`${has('panel') ? 'const toolbar = ' : ''}createToolbar(document.querySelector('#toolbar')!, editor${options.length ? `, {\n  ${options.join(',\n  ')},\n}` : ''});`);
  }
  if (has('ruler')) lines.push(`createRuler(document.querySelector('#ruler')!, editor);`);
  if (has('status')) lines.push(`createStatusBar(document.querySelector('#status')!, editor${has('focus') ? ', {\n  focus: { on: () => focus.on, toggle: focus.toggle },\n}' : ''});`);
  return lines.join('\n');
}

export default function AssembleDemo() {
  const [on, setOn] = useState<Set<Piece>>(() => new Set(['toolbar', 'ruler', 'status', 'bubble', 'slash', 'suggest', 'find']));
  const [ready, setReady] = useState(false);
  const editorRef = useRef<Editor | undefined>(undefined);
  const box = {
    app: useRef<HTMLDivElement>(null),
    toolbar: useRef<HTMLDivElement>(null),
    ruler: useRef<HTMLDivElement>(null),
    panel: useRef<HTMLDivElement>(null),
    pages: useRef<HTMLDivElement>(null),
    status: useRef<HTMLDivElement>(null),
  };

  // The editor, once: the pieces come and go around it, and the document and its history stay.
  useEffect(() => {
    const was = getLocale();
    setLocale('en');
    const editor = new Editor(box.pages.current!);
    editorRef.current = editor;
    void lease().then((doc) => {
      editor.loadDocx(exportDocx(doc));
      setReady(true);
    });
    return () => {
      editor.destroy();
      setLocale(was);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !ready) return;
    const has = (piece: Piece) => on.has(piece);
    const parts: { destroy(): void }[] = [];
    const keep = <T extends { destroy(): void }>(part: T) => (parts.push(part), part);
    const menu = has('menu') ? keep(createSidebar(editor, { fileName: () => 'lease.docx', within: box.app.current! })) : undefined;
    const find = has('find') ? keep(createFindBar(editor)) : undefined;
    let toolbar: ReturnType<typeof createToolbar> | undefined;
    const panel = has('panel') ? keep(createPanel(box.panel.current!, editor, { onToggle: () => toolbar?.refresh() })) : undefined;
    const bubble = has('bubble') ? keep(createBubble(editor)) : undefined;
    editor.onLinkKey = bubble ? () => bubble.ask('link') : undefined;
    if (has('slash')) keep(createSlashMenu(editor, { ask: bubble?.ask }));
    if (has('suggest')) keep(createVariableSuggest(editor, { variables: ['tenant', 'rent'] }));
    const focus = has('focus') ? keep(createFocusMode(editor)) : undefined;
    if (has('toolbar'))
      toolbar = keep(
        createToolbar(box.toolbar.current!, editor, {
          onMenu: menu?.toggle,
          onPanel: panel?.toggle,
          panelOpen: () => !!panel?.isOpen,
          onFind: find ? () => find.open() : undefined,
          onInsertLink: bubble ? () => bubble.ask('link') : undefined,
        }),
      );
    if (has('ruler')) keep(createRuler(box.ruler.current!, editor));
    if (has('status')) keep(createStatusBar(box.status.current!, editor, focus ? { focus: { on: () => focus.on, toggle: focus.toggle } } : {}));
    return () => {
      parts.forEach((part) => part.destroy());
      editor.onLinkKey = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, ready]);

  const toggle = (piece: Piece) =>
    setOn((was) => {
      const next = new Set(was);
      if (next.has(piece)) next.delete(piece);
      else next.add(piece);
      return next;
    });
  const pill = (active: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold ${active ? `border-transparent ${PASTEL_CLASS.green}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`;

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-surface px-6 py-4">
        <p className={CAPTION}>Pieces</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pieces">
          {PIECES.map(([piece, name]) => (
            <button key={piece} type="button" aria-pressed={on.has(piece)} className={pill(on.has(piece))} onClick={() => toggle(piece)}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div ref={box.app} className="relative flex h-[560px] flex-col overflow-hidden bg-white">
        <div ref={box.toolbar} />
        <div ref={box.ruler} />
        <div className="relative flex min-h-0 flex-1">
          <div ref={box.pages} className="min-w-0 flex-1" />
          <div ref={box.panel} />
        </div>
        <div ref={box.status} />
      </div>
      <div className="border-t border-border bg-surface px-6 py-5">
        <p className={CAPTION}>The code of what is shown</p>
        <pre tabIndex={0} aria-label="The code of what is shown" className="m-0 mt-2.5 overflow-x-auto rounded-xl bg-[#2f2e2b] px-4 py-3.5 font-code text-[12.5px] leading-[1.65] text-[#edece8]">
          {codeFor(on)}
        </pre>
      </div>
    </div>
  );
}
