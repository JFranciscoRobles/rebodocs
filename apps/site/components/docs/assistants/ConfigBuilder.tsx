'use client';

import { useState } from 'react';
import { useT } from '@/components/i18n';
import { CAPTION } from '../styles';
import { CLIENTS, type Client } from './data';

const field = 'h-9 min-w-0 rounded-lg border border-border-strong bg-white px-2.5 font-code text-[13px] text-ink';
const choice = (on: boolean) =>
  `cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink hover:bg-hover'}`;

/** A word of a command line, quoted when it has to be. */
const quoted = (word: string) => (/^[\w@./:~=-]+$/.test(word) ? word : `"${word.replace(/"/g, '\\"')}"`);

/** The configuration of an MCP client, written as you choose. */
export function ConfigBuilder() {
  const t = useT();
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
  const folder = root.trim() ? `${root.trim().replace(/\/$/, '')}/` : '';

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
          <p className={CAPTION}>{t({ en: 'Your assistant', es: 'Tu asistente', zh: '你的 AI 助手' })}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CLIENTS.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={client === id} onClick={() => setClient(id)} className={choice(client === id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className={CAPTION}>{t({ en: 'Folder of documents (--root)', es: 'Carpeta de documentos (--root)', zh: '文档文件夹（--root）' })}</span>
          <input
            value={root}
            onChange={(event) => setRoot(event.target.value)}
            spellCheck={false}
            placeholder={t({ en: 'leave empty for anywhere', es: 'vacío para cualquier lugar', zh: '留空表示任何位置' })}
            className={field}
          />
          {!root.trim() && (
            <span className="text-[13px] text-pastel-yellow-fg">
              {t({
                en: 'Without one, the assistant may read and write files anywhere on the machine.',
                es: 'Sin ella, el asistente puede leer y escribir archivos en cualquier lugar de la máquina.',
                zh: '不指定时，AI 助手可以读写这台机器上任何位置的文件。',
              })}
            </span>
          )}
          {client !== 'code' && /(^|\s)~/.test(`${root} ${fonts}`) && (
            <span className="text-[13px] text-pastel-yellow-fg">
              {t({
                en: 'Write the whole path: the server does not turn ~ into your home folder, and no shell does it here.',
                es: 'Escribe la ruta completa: el servidor no convierte ~ en tu carpeta personal, y aquí no lo hace ningún shell.',
                zh: '请写完整路径：服务器不会把 ~ 转换为你的主文件夹，这里也没有 shell 帮你转换。',
              })}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={CAPTION}>{t({ en: 'Fonts folder (--fonts), optional', es: 'Carpeta de fuentes (--fonts), opcional', zh: '字体文件夹（--fonts），可选' })}</span>
          <input value={fonts} onChange={(event) => setFonts(event.target.value)} spellCheck={false} placeholder="/Users/you/Library/Fonts/company" className={field} />
        </label>
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" checked={editor} onChange={(event) => setEditor(event.target.checked)} className="size-4 accent-brand" />
          {t({
            en: 'Also the editor open in the browser (the “AI” button)',
            es: 'También el editor abierto en el navegador (el botón “IA”)',
            zh: '同时连接浏览器中打开的编辑器（“AI”按钮）',
          })}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={CAPTION}>npx</span>
          <input value={npx} onChange={(event) => setNpx(event.target.value)} spellCheck={false} className={field} />
          <span className="text-[13px] leading-normal text-muted">
            {t({
              en: 'With Node from nvm on a Mac, Claude Desktop does not find your terminal’s npx: paste what `which npx` says.',
              es: 'Con Node de nvm en un Mac, Claude Desktop no encuentra el npx de tu terminal: pega lo que dice `which npx`.',
              zh: '在 Mac 上通过 nvm 安装 Node 时，Claude Desktop 找不到终端里的 npx：请粘贴 `which npx` 的输出。',
            })}
          </span>
        </label>
      </div>
      <div className="flex min-w-0 flex-[1.3_1_380px] flex-col gap-3 px-6 py-5">
        <p className={CAPTION}>{client === 'code' ? t({ en: 'Run it', es: 'Ejecútalo', zh: '运行' }) : t({ en: 'Put it in', es: 'Ponlo en', zh: '写入' })}</p>
        <p className="m-0 font-code text-[13px] leading-normal text-ink-soft">{t(where)}</p>
        <div className="relative">
          <pre className="m-0 overflow-x-auto rounded-xl bg-[#2f2e2b] px-4 py-3.5 font-code text-[13px] leading-[1.65] text-[#edece8]">{text}</pre>
          <button type="button" onClick={copy} className="absolute top-2.5 right-2.5 cursor-pointer rounded-md border-0 bg-white/10 px-2 py-1 text-xs text-[#edece8] hover:bg-white/20">
            {copied ? t({ en: 'Copied', es: 'Copiado', zh: '已复制' }) : t({ en: 'Copy', es: 'Copiar', zh: '复制' })}
          </button>
        </div>
        <p className="m-0 text-sm leading-normal text-muted">
          {t({
            en: `It comes from npm, with the engine as its dependency: there is nothing to clone. Then ask the assistant: “Open ${folder}lease.docx and fill it for Ana López”.`,
            es: `Viene de npm, con el motor como dependencia: no hay nada que clonar. Luego pídele al asistente: “Abre ${folder}lease.docx y llénalo para Ana López”.`,
            zh: `它来自 npm，引擎作为其依赖：无需克隆任何内容。然后对 AI 助手说：“打开 ${folder}lease.docx，为 Ana López 填写”。`,
          })}
        </p>
      </div>
    </div>
  );
}
