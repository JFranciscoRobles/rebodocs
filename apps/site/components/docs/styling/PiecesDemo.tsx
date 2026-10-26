'use client';

// One document and the pieces of an interface of your own around it, each
// made with a hook and Tailwind classes: the one chosen is put where it goes,
// and its file is shown under it, as it is.

import { exportDocx } from '@rebodocs/core';
import { DocsProvider, DocsSurface } from '@rebodocs/react';
import { type ReactNode, useEffect, useState } from 'react';
import { usePageEditorLocale } from '@/components/editorLocale';
import { useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { CODE } from '../styles';
import { lease } from '../accessibility/sample';
import { FindBar } from './examples/FindBar';
import { Outline } from './examples/Outline';
import { Ruler } from './examples/Ruler';
import { SelectionBar } from './examples/SelectionBar';
import { StatusBar } from './examples/StatusBar';
import { Toolbar } from './examples/Toolbar';

type Piece = 'Toolbar' | 'StatusBar' | 'FindBar' | 'Outline' | 'SelectionBar' | 'Ruler';

export const PIECES: { id: Piece; name: L; hint: L }[] = [
  {
    id: 'Toolbar',
    name: { en: 'Toolbar', es: 'Barra de herramientas', zh: '工具栏' },
    hint: {
      en: 'Click in a paragraph: the style and the alignment follow the caret.',
      es: 'Haz clic en un párrafo: el estilo y la alineación siguen al cursor.',
      zh: '点击某个段落：样式和对齐方式会跟随光标变化。',
    },
  },
  {
    id: 'StatusBar',
    name: { en: 'Status bar', es: 'Barra de estado', zh: '状态栏' },
    hint: { en: 'Select some words: the count follows the selection.', es: 'Selecciona unas palabras: el conteo sigue a la selección.', zh: '选中几个词：计数会跟随选区变化。' },
  },
  {
    id: 'FindBar',
    name: { en: 'Search', es: 'Búsqueda', zh: '搜索' },
    hint: {
      en: 'Type “the”: Enter goes to the next, Shift+Enter back.',
      es: 'Escribe “the”: Enter va al siguiente, Shift+Enter regresa.',
      zh: '输入 “the”：按 Enter 跳到下一个，Shift+Enter 返回上一个。',
    },
  },
  {
    id: 'Outline',
    name: { en: 'Outline', es: 'Esquema', zh: '大纲' },
    hint: {
      en: 'Click a heading to go to it; move the caret and the mark follows.',
      es: 'Haz clic en un título para ir a él; mueve el cursor y la marca lo sigue.',
      zh: '点击标题即可跳转；移动光标时标记会跟随。',
    },
  },
  {
    id: 'SelectionBar',
    name: { en: 'Selection bar', es: 'Barra de selección', zh: '选区工具条' },
    hint: { en: 'Select some words: the bar floats above them.', es: 'Selecciona unas palabras: la barra flota sobre ellas.', zh: '选中几个词：工具条会浮在它们上方。' },
  },
  {
    id: 'Ruler',
    name: { en: 'Ruler', es: 'Regla', zh: '标尺' },
    hint: { en: 'The ruler as it comes, recoloured: drag its markers.', es: 'La regla tal como viene, recoloreada: arrastra sus marcadores.', zh: '换了配色的自带标尺：拖动它的标记试试。' },
  },
];

/** Where each piece goes around the pages. */
function Shell({ piece }: { piece: Piece }) {
  const surface = <DocsSurface className="min-h-0 min-w-0 flex-1" />;
  const around: Record<Piece, ReactNode> = {
    Toolbar: (
      <>
        <Toolbar />
        {surface}
      </>
    ),
    StatusBar: (
      <>
        {surface}
        <StatusBar />
      </>
    ),
    FindBar: (
      <>
        <FindBar />
        {surface}
      </>
    ),
    Outline: (
      <div className="flex min-h-0 flex-1">
        <Outline />
        {surface}
      </div>
    ),
    SelectionBar: (
      <>
        {surface}
        <SelectionBar />
      </>
    ),
    Ruler: (
      <>
        <Ruler />
        {surface}
      </>
    ),
  };
  return <div className="flex h-[520px] flex-col">{around[piece]}</div>;
}

export default function PiecesDemo({ code }: { code: Record<string, string> }) {
  const [file, setFile] = useState<Uint8Array>();
  const [piece, setPiece] = useState<Piece>('Toolbar');
  const t = useT();
  usePageEditorLocale();

  useEffect(() => {
    void lease().then((doc) => setFile(exportDocx(doc)));
  }, []);

  const pill = (on: boolean) =>
    `cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold ${on ? `border-transparent ${PASTEL_CLASS.green}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`;
  const chosen = PIECES.find((one) => one.id === piece)!;

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-surface px-6 py-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t({ en: 'Piece', es: 'Pieza', zh: '部件' })}>
          {PIECES.map((one) => (
            <button key={one.id} type="button" aria-pressed={piece === one.id} className={pill(piece === one.id)} onClick={() => setPiece(one.id)}>
              {t(one.name)}
            </button>
          ))}
        </div>
        <p className="m-0 text-[13.5px] text-ink-soft">{t(chosen.hint)}</p>
      </div>
      {file ? (
        <DocsProvider docx={file} name="lease.docx" author="Ana">
          <Shell piece={piece} />
        </DocsProvider>
      ) : (
        <p className="m-0 grid h-[520px] place-items-center text-sm text-muted">{t({ en: 'Opening the editor…', es: 'Abriendo el editor…', zh: '正在打开编辑器…' })}</p>
      )}
      <div className={`border-t border-border bg-white p-4 ${CODE} [&_pre]:max-h-[420px]`} dangerouslySetInnerHTML={{ __html: code[piece] ?? '' }} />
    </div>
  );
}
