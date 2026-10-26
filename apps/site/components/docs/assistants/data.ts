// What the page "AI assistants" says that is data. The tools themselves —
// their names, descriptions and arguments — are read from @rebodocs/mcp when
// the site is built; here is only how they are grouped, the five that are the
// server's own, and examples to run. The descriptions of the tools are what the
// server tells an assistant, in English in every language of the site; the rest,
// in each.

import type { Pastel } from '@/lib/home';
import type { L } from '@/lib/i18n';

export interface ToolGroup {
  id: string;
  title: L;
  color: Pastel;
  tools: string[];
}

/** The tools of a document, by what they are for. Every tool of TOOLS is in one, which the page checks when it is built. */
export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'reading',
    title: { en: 'Reading', es: 'Lectura', zh: '读取' },
    color: 'blue',
    tools: ['get_overview', 'read_document', 'read_formatting', 'read_pages', 'find_text', 'list_links', 'list_notes', 'list_variables', 'compare_documents'],
  },
  {
    id: 'text',
    title: { en: 'Text', es: 'Texto', zh: '文字' },
    color: 'yellow',
    tools: ['replace_text', 'rewrite_paragraph', 'insert_paragraphs', 'delete_paragraphs', 'edit_document', 'move_section', 'renumber_clauses', 'set_style', 'set_list', 'set_link'],
  },
  { id: 'formatting', title: { en: 'Formatting', es: 'Formato', zh: '格式' }, color: 'pink', tools: ['format_text', 'format_paragraphs'] },
  {
    id: 'review',
    title: { en: 'Comments and tracked changes', es: 'Comentarios y control de cambios', zh: '批注与修订' },
    color: 'purple',
    tools: ['add_note', 'remove_note', 'track_changes', 'list_changes', 'accept_changes', 'reject_changes'],
  },
  { id: 'templates', title: { en: 'Templates', es: 'Plantillas', zh: '模板' }, color: 'green', tools: ['fill_variables'] },
  {
    id: 'objects',
    title: { en: 'Tables and pictures', es: 'Tablas e imágenes', zh: '表格与图片' },
    color: 'orange',
    tools: ['insert_table', 'edit_table', 'set_cell_text', 'insert_signatures', 'insert_image', 'edit_image'],
  },
  {
    id: 'pages',
    title: { en: 'Pages and columns', es: 'Páginas y columnas', zh: '页面与分栏' },
    color: 'blue',
    tools: [
      'set_page_setup',
      'set_letterhead',
      'set_columns',
      'insert_column_break',
      'set_page_number',
      'insert_page_break',
      'insert_footnote',
      'insert_endnote',
      'insert_text_box',
      'insert_table_of_contents',
      'update_table_of_contents',
    ],
  },
];

/** Tools that read a file of the machine: the server runs them, a page cannot. */
export const NEEDS_A_FILE = new Set(['compare_documents', 'insert_image', 'set_letterhead']);

/** The server's own tools, about files and the editor: in packages/mcp/src/server.ts. */
export const FILE_TOOLS: { name: string; description: string; params: [name: string, type: string, required: boolean, text: string][] }[] = [
  {
    name: 'open_document',
    description: 'Opens a Word file (.docx) to read it and change it. It is kept in memory: nothing is written until save_document. Gives its overview.',
    params: [['path', 'string', true, 'The path of the .docx file.']],
  },
  {
    name: 'new_document',
    description: 'Starts an empty document, to write in and save. Gives it the path it will be saved to.',
    params: [['path', 'string', true, 'Where it will be saved: a path ending in .docx.']],
  },
  {
    name: 'save_document',
    description:
      'Writes a document to a file: Word (.docx), PDF (.pdf) or Markdown (.md), by the ending of the path. A DOCX that was opened keeps everything that was not changed exactly as it was. It does not write over a file that is there unless "overwrite" is true.',
    params: [
      ['document', 'string', false, 'Which document: a path opened before, or "editor" for the one open in the browser.'],
      ['path', 'string', false, 'Where to write. Left out, the file the document was opened from.'],
      ['overwrite', 'boolean', false, 'Write over a file that is already there. False when left out.'],
    ],
  },
  {
    name: 'undo',
    description:
      'Undoes the last changes the tools made to a file that is open, one at a time or several: the way back from a mistake without opening the file again and losing the rest. Up to 50 changes. In the editor in the browser, each change is a step the person undoes there.',
    params: [
      ['document', 'string', false, 'The path of the file. Left out, the last file opened.'],
      ['steps', 'integer', false, 'How many changes to undo. 1 when left out.'],
    ],
  },
  { name: 'list_documents', description: 'The documents that can be worked on now: the files that are open, with whether each has changes not saved, and whether an editor is connected.', params: [] },
  { name: 'close_document', description: 'Forgets a file that is open, with any changes that were not saved.', params: [['path', 'string', true, 'The path of the file.']] },
];

export interface Example {
  label: L;
  tool: string;
  args: Record<string, unknown>;
}

/** The words of the sample document the examples act on: public/demo*.docx, made by scripts/demo.ts, have the same paragraphs in each language. */
const SAMPLE: L<{
  deposit: string;
  payment: string;
  terms: string;
  cancel: string;
  note: string;
  values: Record<string, string>;
  translation: Record<string, unknown>[];
  added: string;
  table: string[][];
}> = {
  en: {
    deposit: 'deposit',
    payment: 'down payment',
    terms: 'Terms',
    cancel: 'cancel in writing',
    note: 'Should we give a deadline?',
    values: { city: 'Lisbon', date: '20 October 2026', client: 'ana lópez', property: 'Rua Augusta 12' },
    translation: [{ text: 'Selecciona una palabra y ponla en ' }, { text: 'negrita', bold: true }, { text: ', ' }, { text: 'roja', color: 'C0392B' }, { text: ' o resáltala.' }],
    added: 'Ask Claude to fill the template and translate it, keeping its look.',
    table: [
      ['Item', 'Amount'],
      ['Deposit', '1,500 €'],
      ['Balance', '13,500 €'],
    ],
  },
  es: {
    deposit: 'anticipo',
    payment: 'enganche',
    terms: 'Condiciones',
    cancel: 'cancelar por escrito',
    note: '¿Damos un plazo?',
    values: { ciudad: 'Guadalajara', fecha: '2026-10-20', cliente: 'ana lópez', importe: '1500', inmueble: 'Av. Juárez 12' },
    translation: [{ text: 'Select a word and make it ' }, { text: 'bold', bold: true }, { text: ', ' }, { text: 'red', color: 'C0392B' }, { text: ' or highlight it.' }],
    added: 'Pídele a Claude que llene la plantilla y la traduzca, conservando su aspecto.',
    table: [
      ['Concepto', 'Importe'],
      ['Anticipo', '$1,500'],
      ['Saldo', '$13,500'],
    ],
  },
  zh: {
    deposit: '定金',
    payment: '预付款',
    terms: '条款',
    cancel: '书面形式取消',
    note: '要不要给一个期限？',
    values: { 城市: '上海', 日期: '2026-10-20', 客户: '李华', 金额: '1500', 房产: '南京路 12 号' },
    translation: [{ text: 'Select a word and make it ' }, { text: 'bold', bold: true }, { text: ', ' }, { text: 'red', color: 'C0392B' }, { text: ' or highlight it.' }],
    added: '让 Claude 填写模板并翻译，同时保留原有格式。',
    table: [
      ['项目', '金额'],
      ['定金', '¥1,500'],
      ['余款', '¥13,500'],
    ],
  },
};

/** Calls to try on the sample document, as an assistant would make them, in a sensible order. */
export function examplesOf(locale: keyof typeof SAMPLE): Example[] {
  const w = SAMPLE[locale];
  return [
    { label: { en: 'What is in it?', es: '¿Qué tiene?', zh: '里面有什么？' }, tool: 'get_overview', args: {} },
    { label: { en: 'Read it', es: 'Léelo', zh: '读取' }, tool: 'read_document', args: { from: 1, to: 8 } },
    { label: { en: 'How it looks', es: 'Cómo se ve', zh: '格式' }, tool: 'read_formatting', args: { from: 4, to: 4 } },
    { label: { en: `Find “${SAMPLE.en.deposit}”`, es: `Busca “${SAMPLE.es.deposit}”`, zh: `查找“${SAMPLE.zh.deposit}”` }, tool: 'find_text', args: { query: w.deposit } },
    { label: { en: 'Fill the template', es: 'Llena la plantilla', zh: '填写模板' }, tool: 'fill_variables', args: { values: w.values } },
    { label: { en: 'Replace a word', es: 'Reemplaza una palabra', zh: '替换词语' }, tool: 'replace_text', args: { find: w.deposit, replace: w.payment, all: true } },
    {
      label: { en: 'Several at once', es: 'Varias a la vez', zh: '一次多项' },
      tool: 'edit_document',
      args: {
        edits: [
          { tool: 'replace_text', find: w.deposit, replace: w.payment, all: true },
          { tool: 'format_text', find: w.terms, bold: true },
        ],
      },
    },
    { label: { en: 'How it falls on pages', es: 'Cómo cae en páginas', zh: '分页情况' }, tool: 'read_pages', args: {} },
    { label: { en: 'Track changes', es: 'Controla los cambios', zh: '开启修订' }, tool: 'track_changes', args: { on: true } },
    { label: { en: 'Comment', es: 'Comenta', zh: '添加批注' }, tool: 'add_note', args: { find: w.cancel, note: w.note } },
    {
      label: { en: 'Translate, keeping the bold', es: 'Traduce, conservando la negrita', zh: '翻译并保留加粗' },
      tool: 'rewrite_paragraph',
      args: { paragraph: 10, segments: w.translation },
    },
    {
      label: { en: 'Add one like it', es: 'Añade uno igual', zh: '添加同样格式的段落' },
      tool: 'insert_paragraphs',
      args: { after_paragraph: 14, like_paragraph: 13, paragraphs: [{ text: w.added }] },
    },
    { label: { en: 'Add a table', es: 'Añade una tabla', zh: '添加表格' }, tool: 'insert_table', args: { after_paragraph: 4, header: true, rows: w.table } },
    { label: { en: 'Bold', es: 'Negrita', zh: '加粗' }, tool: 'format_text', args: { find: w.terms, bold: true, color: 'C0392B' } },
  ];
}

/** The options of the server, from packages/mcp/src/main.ts. */
export const OPTIONS: [option: string, text: L][] = [
  [
    '--root DIR',
    {
      en: 'A folder files may be read from and written to; several can be given. Give one: without, anywhere on the machine.',
      es: 'Una carpeta de la que se pueden leer archivos y en la que se pueden escribir; se pueden dar varias. Da una: sin ella, cualquier lugar de la máquina.',
      zh: '允许读写文件的文件夹；可以指定多个。请至少指定一个：不指定时，整台机器上的任何位置都可以。',
    },
  ],
  [
    '--fonts DIR',
    {
      en: 'A folder to look for fonts in before the system’s, to lay out and make PDFs.',
      es: 'Una carpeta donde buscar fuentes antes que en las del sistema, para componer y generar PDF.',
      zh: '在系统字体之前查找字体的文件夹，用于排版和生成 PDF。',
    },
  ],
  [
    '--port N',
    {
      en: 'Where the editor in the browser connects. 7411 by default, or REBODOCS_MCP_PORT.',
      es: 'Dónde se conecta el editor del navegador. 7411 por defecto, o REBODOCS_MCP_PORT.',
      zh: '浏览器中的编辑器连接的端口。默认为 7411，或使用 REBODOCS_MCP_PORT。',
    },
  ],
  ['--no-editor', { en: 'Files only: do not listen for an editor.', es: 'Solo archivos: no escuchar a un editor.', zh: '只处理文件：不监听编辑器。' }],
  ['--origin URL', { en: 'A page allowed to connect, besides localhost.', es: 'Una página a la que se permite conectarse, además de localhost.', zh: '除 localhost 外允许连接的页面。' }],
  [
    '--host ADDR',
    {
      en: 'To listen for editors, and with --http for clients, on other machines. A --token of 12 characters or more is then required, or REBODOCS_MCP_TOKEN.',
      es: 'Para escuchar a editores, y con --http a clientes, en otras máquinas. Entonces hace falta un --token de 12 caracteres o más, o REBODOCS_MCP_TOKEN.',
      zh: '用于监听其他机器上的编辑器（配合 --http 时还包括客户端）。此时需要 12 个字符以上的 --token，或 REBODOCS_MCP_TOKEN。',
    },
  ],
  [
    '--http N',
    {
      en: 'Listen for assistants over HTTP at http://127.0.0.1:N/mcp (Streamable HTTP), each with a session of its own, instead of over standard input and output. With --token, a client gives it as “Authorization: Bearer”.',
      es: 'Escuchar a los asistentes por HTTP en http://127.0.0.1:N/mcp (Streamable HTTP), cada uno con su propia sesión, en lugar de por la entrada y salida estándar. Con --token, un cliente lo da como “Authorization: Bearer”.',
      zh: '通过 HTTP 在 http://127.0.0.1:N/mcp（Streamable HTTP）监听 AI 助手，每个助手有自己的会话，而不是使用标准输入输出。设置 --token 时，客户端以“Authorization: Bearer”提供。',
    },
  ],
  [
    '--timeout S',
    {
      en: 'How many seconds to wait for the editor to answer a tool: 30 by default.',
      es: 'Cuántos segundos esperar a que el editor responda una herramienta: 30 por defecto.',
      zh: '等待编辑器响应工具调用的秒数：默认为 30。',
    },
  ],
  [
    '--editor-url URL',
    {
      en: 'The address of your editor, told to the assistant when no editor is connected, so it can say where to open it.',
      es: 'La dirección de tu editor, que se le dice al asistente cuando no hay un editor conectado, para que pueda decir dónde abrirlo.',
      zh: '你的编辑器的地址：没有编辑器连接时告诉 AI 助手，以便它说明在哪里打开。',
    },
  ],
];

/** Starting the server for clients over HTTP, and pointing a client at it. */
export const HTTP_SETUP = `# The server, listening for assistants at http://127.0.0.1:7412/mcp
npx -y @rebodocs/mcp --root /path/to/documents --http 7412

# Claude Code, pointed at it
claude mcp add --transport http rebodocs http://127.0.0.1:7412/mcp

# From another machine: --host and a --token of 12 characters or more,
# which the client gives as "Authorization: Bearer <token>"
npx -y @rebodocs/mcp --root /srv/documents --http 7412 --host 0.0.0.0 --token "$REBODOCS_MCP_TOKEN"`;

export type Client = 'desktop' | 'code' | 'cursor';

export const CLIENTS: [Client, string, L][] = [
  [
    'desktop',
    'Claude Desktop',
    {
      en: '~/Library/Application Support/Claude/claude_desktop_config.json (on Windows, %APPDATA%\\Claude\\claude_desktop_config.json). Restart it after changing it.',
      es: '~/Library/Application Support/Claude/claude_desktop_config.json (en Windows, %APPDATA%\\Claude\\claude_desktop_config.json). Reinícialo después de cambiarlo.',
      zh: '~/Library/Application Support/Claude/claude_desktop_config.json（Windows 上为 %APPDATA%\\Claude\\claude_desktop_config.json）。修改后请重启它。',
    },
  ],
  ['code', 'Claude Code', { en: 'In the terminal, in your project.', es: 'En la terminal, en tu proyecto.', zh: '在终端中，在你的项目里运行。' }],
  [
    'cursor',
    'Cursor',
    { en: '~/.cursor/mcp.json, or .cursor/mcp.json in a project.', es: '~/.cursor/mcp.json, o .cursor/mcp.json en un proyecto.', zh: '~/.cursor/mcp.json，或项目中的 .cursor/mcp.json。' },
  ],
];
