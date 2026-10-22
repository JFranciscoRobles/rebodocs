'use client';

// You are the assistant: the tools an assistant calls, called on the sample
// document in the real editor, by the same code the MCP server and the chat
// run (runOnEditor of @rebodocs/mcp/browser). What comes back is word for word
// what the assistant reads.

import { runOnEditor } from '@rebodocs/mcp/browser';
import { DocsProvider, DocsSurface, setLocale, useDocs } from '@rebodocs/react';
import { useEffect, useRef, useState } from 'react';
import { CAPTION } from '../styles';
import { EXAMPLES, NEEDS_A_FILE } from './data';
import type { ToolDoc } from './types';

setLocale('en');

export const TRY_EVENT = 'assistants-try';

/** Arguments to start from for a tool with no example: each required one, empty. */
export function skeleton(tool: ToolDoc): Record<string, unknown> {
  const example = EXAMPLES.find((e) => e.tool === tool.name);
  if (example) return example.args;
  const blank: Record<string, unknown> = { string: '', integer: 1, number: 1, boolean: true, array: [], object: {} };
  return Object.fromEntries(tool.params.filter((p) => p.required).map((p) => [p.name, p.enum?.[0] ?? blank[p.type] ?? '']));
}

const pretty = (args: Record<string, unknown>) => JSON.stringify(args, null, 2);

function Panel({ tools }: { tools: ToolDoc[] }) {
  const { editor, state } = useDocs();
  const usable = tools.filter((tool) => !NEEDS_A_FILE.has(tool.name));
  const [name, setName] = useState('get_overview');
  const [args, setArgs] = useState('{}');
  const [answer, setAnswer] = useState<{ name: string; input: string; ok: boolean; text: string }>();
  const [steps, setSteps] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const tool = usable.find((t) => t.name === name)!;

  useEffect(() => editor?.setFit('width'), [editor]);

  const choose = (next: string, given?: Record<string, unknown>) => {
    const t = usable.find((u) => u.name === next);
    if (!t) return;
    setName(next);
    setArgs(pretty(given ?? skeleton(t)));
  };

  // "Try it" of the list of tools below.
  useEffect(() => {
    const onTry = (event: Event) => {
      box.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      choose((event as CustomEvent<string>).detail);
    };
    window.addEventListener(TRY_EVENT, onTry);
    return () => window.removeEventListener(TRY_EVENT, onTry);
  });

  const call = () => {
    if (!editor) return;
    let input: Record<string, unknown>;
    try {
      input = args.trim() ? JSON.parse(args) : {};
    } catch (error) {
      setAnswer({ name, input: args, ok: false, text: `The arguments are not JSON: ${(error as Error).message}` });
      return;
    }
    const before = editor.doc;
    const result = runOnEditor(editor, name, input);
    if (editor.doc !== before) setSteps((n) => n + 1);
    setAnswer({ name, input: JSON.stringify(input), ok: result.ok, text: result.text });
  };

  return (
    <div ref={box} className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5 px-6 py-5">
      <div>
        <p className={CAPTION}>Try one</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              disabled={!editor}
              onClick={() => choose(example.tool, example.args)}
              className={`h-7.5 cursor-pointer rounded-[7px] border px-2.5 text-[13px] transition-colors disabled:opacity-40 ${name === example.tool && args === pretty(example.args) ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink hover:bg-hover'}`}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="runner-tool" className={CAPTION}>
          Tool
        </label>
        <select id="runner-tool" value={name} onChange={(event) => choose(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-border-strong bg-white px-2 font-code text-[13px] text-ink">
          {usable.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
              {t.writes ? '' : '  · reads'}
            </option>
          ))}
        </select>
      </div>
      <p className="m-0 text-sm leading-normal text-muted">{tool.description}</p>
      <div>
        <label htmlFor="runner-args" className={CAPTION}>
          Arguments, as JSON
        </label>
        <textarea
          id="runner-args"
          value={args}
          onChange={(event) => setArgs(event.target.value)}
          spellCheck={false}
          rows={Math.min(9, Math.max(3, args.split('\n').length))}
          className="mt-1.5 block w-full resize-y rounded-lg border border-border-strong bg-white px-3 py-2 font-code text-[12.5px] leading-[1.55] text-ink outline-0 focus:border-brand"
        />
        {tool.params.length > 0 && (
          <p className="m-0 mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-code text-[12px] text-muted">
            {tool.params.map((p) => (
              <span key={p.name} title={p.description}>
                {p.name}
                {p.required ? '' : '?'}: <span className="text-pastel-purple-fg">{p.enum ? p.enum.map((v) => `'${v}'`).join(' | ') : p.type}</span>
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" disabled={!editor} onClick={call} className="h-9 cursor-pointer rounded-lg border-0 bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-40">
          Call {name}
        </button>
        <button
          type="button"
          disabled={!state.canUndo}
          onClick={() => editor?.undo()}
          className="h-9 cursor-pointer rounded-lg border border-border-strong bg-white px-3 text-sm text-ink hover:bg-hover disabled:cursor-default disabled:opacity-40"
        >
          Undo
        </button>
        <span className="ml-auto text-[13px] text-muted">{steps ? `${steps} ${steps === 1 ? 'change' : 'changes'}, each a step to undo` : ''}</span>
      </div>
      <div className="min-h-[140px] rounded-xl bg-[#2f2e2b] px-4 py-3.5 font-code text-[12.5px] leading-[1.65] text-[#edece8]" aria-live="polite">
        {answer ? (
          <>
            <div className="text-[#a8a49a]">{'// the call, as the assistant sends it'}</div>
            <div className="break-all text-[#9cc0fa]">
              {answer.name} {answer.input}
            </div>
            <div className="mt-2 text-[#a8a49a]">{answer.ok ? '// what it reads back' : '// what it reads back: an error, to correct itself'}</div>
            <div className={`max-h-[260px] overflow-y-auto whitespace-pre-wrap ${answer.ok ? 'text-[#edece8]' : 'text-[#f5a3a3]'}`}>{answer.text}</div>
          </>
        ) : (
          <div className="text-[#a8a49a]">{'// pick a call above, or write your own, and call it'}</div>
        )}
      </div>
    </div>
  );
}

/** The sample document in the editor, beside the tools. */
export default function Runner({ tools }: { tools: ToolDoc[] }) {
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
          <div className="h-[620px] min-w-0 flex-[1.3_1_420px] bg-[#e9eaee]">
            <DocsSurface className="h-full" />
          </div>
          <Panel tools={tools} />
        </DocsProvider>
      ) : (
        <p className="m-0 grid h-[620px] w-full place-items-center text-sm text-muted">{failed ? 'The sample document could not be loaded.' : 'Opening the document…'}</p>
      )}
    </div>
  );
}
