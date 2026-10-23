'use client';

import { useState } from 'react';
import { CAPTION } from '../styles';
import { CLIENTS, type Client } from './data';

const field = 'h-9 min-w-0 rounded-lg border border-border-strong bg-white px-2.5 font-code text-[13px] text-ink';
const choice = (on: boolean) =>
  `cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink hover:bg-hover'}`;

/** A word of a command line, quoted when it has to be. */
const quoted = (word: string) => (/^[\w@./:~=-]+$/.test(word) ? word : `"${word.replace(/"/g, '\\"')}"`);

/** The configuration of an MCP client, written as you choose. */
export function ConfigBuilder() {
  const [client, setClient] = useState<Client>('desktop');
  const [root, setRoot] = useState('/Users/you/Documents/contracts');
  const [fonts, setFonts] = useState('');
  const [editor, setEditor] = useState(true);
  const [npx, setNpx] = useState('npx');
  const [copied, setCopied] = useState(false);

  const args = ['-y', '@rebodocs/mcp', ...(root.trim() ? ['--root', root.trim()] : []), ...(fonts.trim() ? ['--fonts', fonts.trim()] : []), ...(editor ? [] : ['--no-editor'])];
  const command = npx.trim() || 'npx';
  const text = client === 'code' ? `claude mcp add rebodocs -- ${[command, ...args].map(quoted).join(' ')}` : JSON.stringify({ mcpServers: { rebodocs: { command, args } } }, null, 2);
  const where = CLIENTS.find(([id]) => id === client)![2];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-7 flex flex-wrap overflow-hidden rounded-[18px] border border-border">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 bg-surface px-6 py-5">
        <div>
          <p className={CAPTION}>Your assistant</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CLIENTS.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={client === id} onClick={() => setClient(id)} className={choice(client === id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={CAPTION}>Folder of documents (--root)</span>
          <input value={root} onChange={(event) => setRoot(event.target.value)} spellCheck={false} placeholder="leave empty for anywhere" className={field} />
          {!root.trim() && <span className="text-[13px] text-pastel-yellow-fg">Without one, the assistant may read and write files anywhere on the machine.</span>}
          {client !== 'code' && /(^|\s)~/.test(`${root} ${fonts}`) && (
            <span className="text-[13px] text-pastel-yellow-fg">Write the whole path: the server does not turn ~ into your home folder, and no shell does it here.</span>
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={CAPTION}>Fonts folder (--fonts), optional</span>
          <input value={fonts} onChange={(event) => setFonts(event.target.value)} spellCheck={false} placeholder="/Users/you/Library/Fonts/company" className={field} />
        </label>
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" checked={editor} onChange={(event) => setEditor(event.target.checked)} className="size-4 accent-brand" />
          Also the editor open in the browser (the “AI” button)
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={CAPTION}>npx</span>
          <input value={npx} onChange={(event) => setNpx(event.target.value)} spellCheck={false} className={field} />
          <span className="text-[13px] leading-normal text-muted">With Node from nvm on a Mac, Claude Desktop does not find your terminal’s npx: paste what `which npx` says.</span>
        </label>
      </div>
      <div className="flex min-w-0 flex-[1.3_1_380px] flex-col gap-3 px-6 py-5">
        <p className={CAPTION}>{client === 'code' ? 'Run it' : 'Put it in'}</p>
        <p className="m-0 font-code text-[13px] leading-normal text-ink-soft">{where}</p>
        <div className="relative">
          <pre className="m-0 overflow-x-auto rounded-xl bg-[#2f2e2b] px-4 py-3.5 font-code text-[13px] leading-[1.65] text-[#edece8]">{text}</pre>
          <button type="button" onClick={copy} className="absolute top-2.5 right-2.5 cursor-pointer rounded-md border-0 bg-white/10 px-2 py-1 text-xs text-[#edece8] hover:bg-white/20">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="m-0 text-sm leading-normal text-muted">
          It comes from npm, with the engine as its dependency: there is nothing to clone. Then ask the assistant: “Open {root.trim() ? `${root.trim().replace(/\/$/, '')}/` : ''}lease.docx and fill it
          for Ana López”.
        </p>
      </div>
    </div>
  );
}
