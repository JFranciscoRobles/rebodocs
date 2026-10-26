'use client';

// A real document for the hooks: one DocsProvider with the agreement of the
// demo, the piece of interface of the hook chosen (the very file shown under
// "Use it"), the pages, and what the hook gives right now, read by calling it.

import {
  DocsProvider,
  DocsSurface,
  getLocale,
  setLocale,
  useDocs,
  useDocsBubble,
  useDocsCount,
  useDocsFind,
  useDocsLink,
  useDocsNotes,
  useDocsOutline,
  useDocsPage,
  useDocsResponsive,
  useDocsSelectionBox,
  useDocsStyles,
  useDocsValue,
  useDocsVariables,
} from '@rebodocs/react';
import { type ComponentType, useEffect, useState } from 'react';
import { useEditorLocale } from '@/components/editorLocale';
import { useT } from '@/components/i18n';
import type { LiveValue } from './hooks';
import { live, useEmit } from './live';
import Docs from './examples/useDocs';
import Bubble from './examples/useDocsBubble';
import Count from './examples/useDocsCount';
import Find from './examples/useDocsFind';
import Link from './examples/useDocsLink';
import Notes from './examples/useDocsNotes';
import Outline from './examples/useDocsOutline';
import Page from './examples/useDocsPage';
import Responsive from './examples/useDocsResponsive';
import SelectionBox from './examples/useDocsSelectionBox';
import Styles from './examples/useDocsStyles';
import Value from './examples/useDocsValue';
import Variables from './examples/useDocsVariables';

type Emit = (values: LiveValue[]) => void;

/** A text as the panel shows it: quoted, cut when long, or undefined. */
const text = (key: string, value: string | undefined, max = 40): LiveValue => (value === undefined ? live.empty(key) : live.str(key, `'${value.length > max ? `${value.slice(0, max)}…` : value}'`));
const fn = (key: string) => live.call(key, 'ƒ');

/** Each hook, called, and what it gives put as values: a hook of its own each, called the same way at every render. */
const PROBES: Record<string, () => LiveValue[]> = {
  useDocs: () => {
    const { ready, state } = useDocs();
    return [
      live.bool('ready', ready),
      live.bool('state.bold', state.bold),
      live.num('state.fontSize', state.fontSize),
      text('state.styleId', state.styleId),
      live.bool('state.collapsed', state.collapsed),
      live.bool('state.dirty', state.dirty),
      live.num('state.page · pageCount', `${state.page} · ${state.pageCount}`),
      fn('commands.toggleMark'),
      fn('docs.save'),
    ];
  },
  useDocsValue: () => {
    const spaced = useDocsValue((e) => e.activeParagraphProps().spacingAfter > 0, false);
    const after = useDocsValue((e) => e.activeParagraphProps().spacingAfter, 0);
    return [live.bool('value', spaced), live.demo(live.num('spacingAfter', `${after} pt`))];
  },
  useDocsCount: () => {
    const { words, characters, selected } = useDocsCount();
    return [live.num('words', words), live.num('characters', characters), selected ? live.str('selected', `{ words: ${selected.words}, characters: ${selected.characters} }`) : live.empty('selected')];
  },
  useDocsFind: () => {
    const find = useDocsFind();
    // query and options are the find bar's own, kept by the call there; count and index are the document's.
    return [live.num('count', find.count), live.num('index', find.index), fn('setQuery'), fn('next'), fn('replace'), live.demo(live.str('query · options', 'kept by the find bar above'))];
  },
  useDocsLink: () => {
    const link = useDocsLink();
    return [link.active ? live.str('active', `{ href: '${link.active.href}' }`) : live.empty('active'), live.bool('possible', link.possible), fn('set'), fn('remove')];
  },
  useDocsNotes: () => {
    const notes = useDocsNotes();
    return [
      live.num('notes', `${notes.notes.length} ${notes.notes.length === 1 ? 'note' : 'notes'}`),
      ...notes.notes.slice(0, 3).map((note, i) => text(`notes[${i}].text`, note.text, 24)),
      text('active', notes.active),
      fn('add'),
    ];
  },
  useDocsVariables: () => {
    const variables = useDocsVariables();
    return [
      live.str('names', `[${variables.names.join(', ')}]`),
      text('active', variables.active),
      live.num('blocks', variables.blocks.length),
      live.str('formats.amount', JSON.stringify((variables.formats.amount ?? []).map((format) => format.id))),
      live.str("preview('amount', '1500')", `'${variables.preview('amount', '1500').text}'`),
    ];
  },
  useDocsStyles: () => {
    const { styles, active } = useDocsStyles();
    return [live.num('styles', `${styles.length} styles`), text('active', active), fn('set')];
  },
  useDocsOutline: () => {
    const { items, active } = useDocsOutline();
    return [
      live.num('items', `${items.length} headings`),
      ...items.slice(0, 4).map((item, i) => live.str(`items[${i}]`, `{ level: ${item.level}, text: '${item.text}' }`)),
      live.num('active', active),
    ];
  },
  useDocsPage: () => {
    const { page, numbering, sections, section, letterhead } = useDocsPage();
    return [
      page ? live.str('page', `${Math.round(page.width)} × ${Math.round(page.height)} pt`) : live.empty('page'),
      page ? live.num('page.marginLeft', `${page.marginLeft.toFixed(1)} pt`) : live.empty('page.marginLeft'),
      numbering ? live.str('numbering', `{ place: '${numbering.place}', format: '${numbering.format}' }`) : live.empty('numbering'),
      live.num('section · sections', `${section} · ${sections}`),
      live.bool('letterhead', letterhead),
    ];
  },
  useDocsSelectionBox: () => {
    const box = useDocsSelectionBox();
    return box
      ? [live.num('top', Math.round(box.top)), live.num('left', Math.round(box.left)), live.num('width', Math.round(box.width)), live.num('height', Math.round(box.height))]
      : [live.empty('box')];
  },
  useDocsBubble: () => {
    const bubble = useDocsBubble();
    return bubble ? [fn('open'), fn('close'), fn('toggle'), fn('ask')] : [live.empty('bubble')];
  },
  useDocsResponsive: () => {
    const { narrow, keyboard } = useDocsResponsive(600);
    return [live.bool('narrow', narrow), live.num('keyboard', keyboard)];
  },
};

const PIECES: Record<string, ComponentType> = {
  useDocs: Docs,
  useDocsValue: Value,
  useDocsCount: Count,
  useDocsFind: Find,
  useDocsLink: Link,
  useDocsNotes: Notes,
  useDocsVariables: Variables,
  useDocsStyles: Styles,
  useDocsOutline: Outline,
  useDocsPage: Page,
  useDocsSelectionBox: SelectionBox,
  useDocsBubble: Bubble,
  useDocsResponsive: Responsive,
};

/** The pieces that are panels, beside the pages rather than above them. */
const BESIDE = new Set(['useDocsNotes', 'useDocsVariables', 'useDocsOutline']);

/** The page as wide as the room there is here; the hook of narrow windows is left to do its own. */
function FitWidth() {
  const { ready, commands } = useDocs();
  useEffect(() => {
    if (ready) commands.setFit('width');
  }, [ready, commands]);
  return null;
}

function Probe({ name, onValues }: { name: string; onValues: Emit }) {
  useEmit(onValues, PROBES[name]());
  return null;
}

let sample: Promise<Uint8Array> | undefined;
const loadSample = () => (sample ??= fetch('/sample.docx').then(async (response) => new Uint8Array(await response.arrayBuffer())));

export default function Stage({ name, onValues }: { name: string; onValues: Emit }) {
  const [file, setFile] = useState<Uint8Array>();
  const [narrow, setNarrow] = useState(false);
  const t = useT();
  const editorLocale = useEditorLocale();
  useEffect(() => {
    const was = getLocale();
    setLocale(editorLocale);
    void loadSample().then(setFile);
    return () => setLocale(was);
  }, [editorLocale]);
  const Piece = PIECES[name];
  const beside = BESIDE.has(name);
  const responsive = name === 'useDocsResponsive';

  if (!file) return <p className="m-0 grid h-[420px] place-items-center text-sm text-muted">{t({ en: 'Opening the agreement…', es: 'Abriendo el contrato…', zh: '正在打开协议…' })}</p>;
  return (
    <DocsProvider docx={file} name="agreement.docx" author="Ana" bubble>
      <div className={beside ? 'grid gap-3 md:grid-cols-[240px_1fr]' : 'grid gap-3'}>
        <div className={beside ? 'min-w-0 max-h-[420px] overflow-y-auto' : 'min-w-0'}>
          <Piece />
        </div>
        <div className="min-w-0">
          {responsive && (
            <div className="mb-2 flex gap-1.5" role="group" aria-label={t({ en: 'Width of the pages', es: 'Ancho de las páginas', zh: '页面宽度' })}>
              {[false, true].map((on) => (
                <button
                  key={String(on)}
                  type="button"
                  aria-pressed={narrow === on}
                  onClick={() => setNarrow(on)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-[13px] font-semibold ${narrow === on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink-soft'}`}
                >
                  {on ? '360 px' : t({ en: 'All the width', es: 'Todo el ancho', zh: '全宽' })}
                </button>
              ))}
            </div>
          )}
          <div className="relative mx-auto h-[380px] overflow-hidden rounded-lg border border-border" style={{ maxWidth: responsive && narrow ? 360 : undefined }}>
            <DocsSurface className="h-full" />
          </div>
        </div>
      </div>
      {!responsive && <FitWidth />}
      <Probe key={name} name={name} onValues={onValues} />
    </DocsProvider>
  );
}
