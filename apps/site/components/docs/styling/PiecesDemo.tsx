'use client';

// One document and the pieces of an interface of your own around it, each
// made with a hook and Tailwind classes: the one chosen is put where it goes,
// and its file is shown under it, as it is.

import { exportDocx } from '@rebodocs/core';
import { DocsProvider, DocsSurface, getLocale, setLocale } from '@rebodocs/react';
import { type ReactNode, useEffect, useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { CODE } from '../styles';
import { lease } from '../accessibility/sample';
import { FindBar } from './examples/FindBar';
import { Outline } from './examples/Outline';
import { Ruler } from './examples/Ruler';
import { SelectionBar } from './examples/SelectionBar';
import { StatusBar } from './examples/StatusBar';
import { Toolbar } from './examples/Toolbar';

export const PIECES = [
  { id: 'Toolbar', name: 'Toolbar', hint: 'Click in a paragraph: the style and the alignment follow the caret.' },
  { id: 'StatusBar', name: 'Status bar', hint: 'Select some words: the count follows the selection.' },
  { id: 'FindBar', name: 'Search', hint: 'Type “the”: Enter goes to the next, Shift+Enter back.' },
  { id: 'Outline', name: 'Outline', hint: 'Click a heading to go to it; move the caret and the mark follows.' },
  { id: 'SelectionBar', name: 'Selection bar', hint: 'Select some words: the bar floats above them.' },
  { id: 'Ruler', name: 'Ruler', hint: 'The ruler as it comes, recoloured: drag its markers.' },
] as const;

type Piece = (typeof PIECES)[number]['id'];

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

  useEffect(() => {
    const was = getLocale();
    setLocale('en');
    void lease().then((doc) => setFile(exportDocx(doc)));
    return () => setLocale(was);
  }, []);

  const pill = (on: boolean) => `cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold ${on ? `border-transparent ${PASTEL_CLASS.green}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`;
  const chosen = PIECES.find((one) => one.id === piece)!;

  return (
    <div className="mt-7 overflow-hidden rounded-[18px] border border-border">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-surface px-6 py-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Piece">
          {PIECES.map((one) => (
            <button key={one.id} type="button" aria-pressed={piece === one.id} className={pill(piece === one.id)} onClick={() => setPiece(one.id)}>
              {one.name}
            </button>
          ))}
        </div>
        <p className="m-0 text-[13.5px] text-ink-soft">{chosen.hint}</p>
      </div>
      {file ? (
        <DocsProvider docx={file} name="lease.docx" author="Ana">
          <Shell piece={piece} />
        </DocsProvider>
      ) : (
        <p className="m-0 grid h-[520px] place-items-center text-sm text-muted">Opening the editor…</p>
      )}
      <div className={`border-t border-border bg-white p-4 ${CODE} [&_pre]:max-h-[420px]`} dangerouslySetInnerHTML={{ __html: code[piece] ?? '' }} />
    </div>
  );
}
