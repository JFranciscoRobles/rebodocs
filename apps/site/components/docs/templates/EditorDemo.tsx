'use client';

// A real editor with a template in it, the Variables tab of its side panel
// open, and what an application would do from its code: fill the template
// with the values of a form, with changes tracked or not.

import { exportDocx } from '@rebodocs/core';
import { type DocsHandle, type Editor, DocsEditor, getLocale, setLocale } from '@rebodocs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { DemoBox, Readout } from '../ui';
import { SAMPLE, receipt } from './template';

interface Seen {
  names: string[];
  active?: string;
  uses: number;
  tracking: boolean;
  canUndo: boolean;
}

const look = (editor: Editor): Seen => ({
  names: editor.variables,
  active: editor.activeVariable,
  uses: editor.activeVariable ? editor.variableUses(editor.activeVariable) : 0,
  tracking: editor.trackChanges,
  canUndo: editor.canUndo,
});

export default function EditorDemo() {
  const file = useMemo(() => exportDocx(receipt()), []);
  const handle = useRef<DocsHandle | undefined>(undefined);
  const [seen, setSeen] = useState<Seen>();
  const [round, setRound] = useState(0);

  useEffect(() => {
    const was = getLocale();
    setLocale('en');
    return () => setLocale(was);
  }, []);

  const ready = (docs: DocsHandle | undefined) => {
    handle.current = docs;
    if (!docs) return;
    const update = () => setSeen(look(docs.editor));
    update();
    docs.editor.onChange(update);
    // The panel, on its Variables tab: where whoever fills the template works; the page as wide as what is left.
    docs.showPanel('variables');
    docs.editor.setFit('width');
  };

  const run = (fn: (editor: Editor) => unknown) => {
    const editor = handle.current?.editor;
    if (editor) fn(editor);
  };

  const button = 'cursor-pointer rounded-lg border border-border bg-white px-2.5 py-1 font-code text-[12.5px] text-ink-soft hover:bg-hover disabled:cursor-default disabled:opacity-50';

  return (
    <DemoBox title="A template in the editor">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={button} disabled={!seen?.names.length} onClick={() => run((e) => e.fillVariables(SAMPLE))}>
          editor.fillVariables(form)
        </button>
        <button type="button" aria-pressed={!!seen?.tracking} onClick={() => run((e) => e.setTrackChanges(!e.trackChanges))} className={`${button} ${seen?.tracking ? `border-transparent ${PASTEL_CLASS.green}` : ''}`}>
          setTrackChanges({String(!seen?.tracking)})
        </button>
        <button type="button" className={button} disabled={!seen?.canUndo} onClick={() => run((e) => e.undo())}>
          editor.undo()
        </button>
        <button type="button" className={button} onClick={() => setRound(round + 1)}>
          Start over
        </button>
      </div>
      <div className="-mx-5 mt-4 h-[600px] overflow-hidden border-y border-border">
        <DocsEditor key={round} docx={file} name="receipt.docx" locale="en" language="en-US" author="Ana" onReady={ready} />
      </div>
      <div className="mt-4 grid gap-3">
        <Readout
          label="What the editor says"
          lines={[
            ['editor.variables', seen ? (seen.names.length ? `${seen.names.length}: ${seen.names.slice(0, 4).join(', ')}${seen.names.length > 4 ? ', …' : ''}` : '[] — all filled') : '…', seen?.names.length ? undefined : 'good'],
            ['editor.activeVariable', seen?.active ? `'${seen.active}'` : 'undefined', seen?.active ? undefined : 'dim'],
            ['variableUses(active)', seen?.active ? String(seen.uses) : '—', seen?.active ? undefined : 'dim'],
          ]}
        />
        <p className="m-0 max-w-[760px] text-[13.5px] leading-normal text-muted">
          The values of the form are the page’s: <code className="font-code text-[12.5px]">clientName</code> is “ana pérez”, written “Ana Pérez” by <code className="font-code text-[12.5px]">capital</code> and in capitals in the signature. The header and the note at the foot of the page are filled too. Track changes first, and the filling is a change to accept or reject.
        </p>
      </div>
    </DemoBox>
  );
}
