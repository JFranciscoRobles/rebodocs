// What the landing page says: one place for the version, the packages and the
// features, so the badge, the install picker and the table change together.

import { version } from '../package.json';
import type { L } from './i18n';

/** The version every package is published at; the site moves with them. */
export const VERSION = version;

/** The six pastel pairs, background and text, that take turns on tags, icons and packages. */
export type Pastel = 'blue' | 'yellow' | 'green' | 'pink' | 'purple' | 'orange';
export const PASTELS: Pastel[] = ['blue', 'yellow', 'green', 'pink', 'purple', 'orange'];
/** Whole class names, so Tailwind finds them. */
export const PASTEL_CLASS: Record<Pastel, string> = {
  blue: 'bg-pastel-blue text-pastel-blue-fg',
  yellow: 'bg-pastel-yellow text-pastel-yellow-fg',
  green: 'bg-pastel-green text-pastel-green-fg',
  pink: 'bg-pastel-pink text-pastel-pink-fg',
  purple: 'bg-pastel-purple text-pastel-purple-fg',
  orange: 'bg-pastel-orange text-pastel-orange-fg',
};
export const pastelAt = (i: number) => PASTELS[i % PASTELS.length];

export const TAGS: L[] = [
  { en: 'DOCX in & out', es: 'DOCX de ida y vuelta', zh: 'DOCX 读写' },
  { en: 'Tracked changes', es: 'Control de cambios', zh: '修订' },
  { en: 'Versions', es: 'Versiones', zh: '版本' },
  { en: 'Live cursors', es: 'Cursores en vivo', zh: '实时光标' },
  { en: 'Templates', es: 'Plantillas', zh: '模板' },
  { en: 'Fill-in forms', es: 'Formularios para llenar', zh: '可填写表单' },
  { en: '“/” commands', es: 'Comandos con “/”', zh: '“/” 命令' },
  { en: 'Footnotes & endnotes', es: 'Notas al pie y al final', zh: '脚注与尾注' },
  { en: 'Paste from Word', es: 'Pegar desde Word', zh: '从 Word 粘贴' },
  { en: 'PDF in Node', es: 'PDF en Node', zh: 'Node 生成 PDF' },
  { en: 'Embedded fonts', es: 'Fuentes incrustadas', zh: '嵌入字体' },
  { en: 'Chinese text', es: 'Texto en chino', zh: '中文排版' },
  { en: 'Keyboard & screen reader', es: 'Teclado y lector de pantalla', zh: '键盘与屏幕阅读器' },
  { en: 'Claude via MCP', es: 'Claude vía MCP', zh: '通过 MCP 接入 Claude' },
];

export interface Package {
  name: string;
  what: L;
  tag: L;
  color: Pastel;
}

/** In the order of the table. */
export const PACKAGES: Package[] = [
  {
    name: '@rebodocs/core',
    what: {
      en: 'The engine: document model, DOCX import and export, page layout, PDF and templates.',
      es: 'El motor: modelo del documento, importación y exportación de DOCX, maquetación de páginas, PDF y plantillas.',
      zh: '引擎：文档模型、DOCX 导入导出、分页排版、PDF 和模板。',
    },
    tag: { en: 'No DOM', es: 'Sin DOM', zh: '无需 DOM' },
    color: 'blue',
  },
  {
    name: '@rebodocs/editor',
    what: {
      en: 'A DOCX editor for the browser: pages, caret and selection, toolbar, menu, side panel and status bar.',
      es: 'Un editor de DOCX para el navegador: páginas, cursor y selección, barra de herramientas, menú, panel lateral y barra de estado.',
      zh: '浏览器中的 DOCX 编辑器：页面、光标与选区、工具栏、菜单、侧边栏和状态栏。',
    },
    tag: { en: 'No framework', es: 'Sin framework', zh: '无需框架' },
    color: 'green',
  },
  {
    name: '@rebodocs/react',
    what: {
      en: 'The DOCX editor as a React component, or as headless hooks, with everything it needs inside.',
      es: 'El editor de DOCX como componente de React, o como hooks headless, con todo lo que necesita dentro.',
      zh: '以 React 组件或 headless hooks 形式提供的 DOCX 编辑器，所需的一切都已内置。',
    },
    tag: { en: 'React', es: 'React', zh: 'React' },
    color: 'purple',
  },
  {
    name: '@rebodocs/viewer',
    what: {
      en: 'A DOCX document only to read: its pages read only, a bar to zoom and print, and its first page as a thumbnail.',
      es: 'Un documento DOCX solo para leer: sus páginas en solo lectura, una barra para hacer zoom e imprimir, y su primera página como miniatura.',
      zh: '只读的 DOCX 文档：只读页面、缩放和打印工具条，以及首页缩略图。',
    },
    tag: { en: 'Read only', es: 'Solo lectura', zh: '只读' },
    color: 'orange',
  },
  {
    name: '@rebodocs/collab',
    what: {
      en: 'Real-time collaboration: the change format, the room server and its browser client.',
      es: 'Colaboración en tiempo real: el formato de los cambios, el servidor de salas y su cliente para el navegador.',
      zh: '实时协作：变更格式、房间服务器及其浏览器客户端。',
    },
    tag: { en: 'Realtime', es: 'Tiempo real', zh: '实时' },
    color: 'pink',
  },
  {
    name: '@rebodocs/mcp',
    what: {
      en: 'Tools for an AI assistant to read and edit DOCX: an MCP server for Claude Desktop and other clients, and Claude in a chat beside the editor.',
      es: 'Herramientas para que un asistente de IA lea y edite DOCX: un servidor MCP para Claude Desktop y otros clientes, y Claude en un chat junto al editor.',
      zh: '供 AI 助手读取和编辑 DOCX 的工具：面向 Claude Desktop 及其他客户端的 MCP 服务器，以及编辑器旁的 Claude 聊天。',
    },
    tag: { en: 'MCP', es: 'MCP', zh: 'MCP' },
    color: 'yellow',
  },
];
/** In the order of the install picker: the one an application installs first. */
export const INSTALL_ORDER = ['@rebodocs/react', '@rebodocs/editor', '@rebodocs/viewer', '@rebodocs/core', '@rebodocs/collab', '@rebodocs/mcp'];

export const npmOf = (name: string) => `https://www.npmjs.com/package/${name}`;

/** Title, description and the path of a 24 × 24 icon, drawn with a stroke. */
export const FEATURES: [L, L, string][] = [
  [
    { en: 'Works with .docx files', es: 'Funciona con archivos .docx', zh: '兼容 .docx 文件' },
    {
      en: 'Reads and writes DOCX, its layout measured line by line against Word. What it does not understand, it keeps; tables and pictures copied in Word paste whole.',
      es: 'Lee y escribe DOCX, con su maquetación medida línea por línea contra Word. Lo que no entiende, lo conserva; las tablas y las imágenes copiadas en Word se pegan completas.',
      zh: '读写 DOCX，排版与 Word 逐行比对。不理解的内容原样保留；从 Word 复制的表格和图片可以完整粘贴。',
    },
    'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h4',
  ],
  [
    { en: 'Templates', es: 'Plantillas', zh: '模板' },
    {
      en: 'Text in double braces is a variable — typing “{{” lists the ones you fill. Fill them from the editor, from code or from the command line.',
      es: 'El texto entre llaves dobles es una variable: al escribir “{{” aparecen las que llenas. Llénalas desde el editor, desde código o desde la línea de comandos.',
      zh: '双花括号中的文字就是变量——输入 “{{” 即列出可填写的变量。可以在编辑器中、通过代码或在命令行中填写。',
    },
    'M8 4C5 4 5 7 5 8s-2 3-2 4 2 0 2 3 0 5 3 5M16 4c3 0 3 3 3 4s2 3 2 4-2 0-2 3 0 5-3 5',
  ],
  [
    { en: 'Real-time collaboration', es: 'Colaboración en tiempo real', zh: '实时协作' },
    {
      en: 'Several people at once, visible cursors, undo that is yours alone; your backend says who edits and who only watches.',
      es: 'Varias personas a la vez, cursores visibles, un deshacer que es solo tuyo; tu backend decide quién edita y quién solo mira.',
      zh: '多人同时编辑，光标彼此可见，撤销只影响你自己；由你的后端决定谁能编辑、谁只能查看。',
    },
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 3-5 6-5s6 2 6 5M17 11a2.5 2.5 0 1 0 0-5M21 19c0-2-1.5-3.6-4-4',
  ],
  [
    { en: 'Fill-in forms', es: 'Formularios para llenar', zh: '可填写表单' },
    {
      en: 'Restrict a document to the areas meant to be filled; the rest is read-only, in Word too. Tab goes from one blank to the next.',
      es: 'Restringe un documento a las áreas que se deben llenar; el resto queda en solo lectura, también en Word. Tab pasa de un espacio al siguiente.',
      zh: '把文档限制为只能编辑待填区域，其余部分只读，在 Word 中同样有效。按 Tab 跳到下一个空白处。',
    },
    'M4 4h16v16H4zM8 9h8M8 13h3M13 13h3M8 17h8',
  ],
  [
    { en: 'Commands with “/”', es: 'Comandos con “/”', zh: '“/” 命令' },
    {
      en: 'Type “/” for headings, lists, tables, pictures and signatures — plus your own commands, from text, HTML or code.',
      es: 'Escribe “/” para títulos, listas, tablas, imágenes y firmas, además de tus propios comandos, desde texto, HTML o código.',
      zh: '输入 “/” 即可插入标题、列表、表格、图片和签名，还可以用文本、HTML 或代码定义你自己的命令。',
    },
    'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM14 8l-4 8',
  ],
  [
    { en: 'Tracked changes', es: 'Control de cambios', zh: '修订' },
    {
      en: 'Insertions and deletions marked and signed by author until someone accepts or rejects them.',
      es: 'Inserciones y eliminaciones marcadas y firmadas por su autor hasta que alguien las acepta o las rechaza.',
      zh: '插入和删除都会被标记并署上作者，直到有人接受或拒绝。',
    },
    'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  ],
  [
    { en: 'Versions', es: 'Versiones', zh: '版本' },
    {
      en: 'Your app stores the versions; the editor shows the differences word by word.',
      es: 'Tu aplicación guarda las versiones; el editor muestra las diferencias palabra por palabra.',
      zh: '你的应用保存版本，编辑器逐词显示差异。',
    },
    'M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4',
  ],
  [
    { en: 'Whole documents', es: 'Documentos completos', zh: '完整的文档' },
    {
      en: 'Sections, footnotes and endnotes, text boxes, tab stops, tables and vertical text.',
      es: 'Secciones, notas al pie y al final, cuadros de texto, tabulaciones, tablas y texto vertical.',
      zh: '分节、脚注和尾注、文本框、制表位、表格以及竖排文字。',
    },
    'M4 5h16M4 10h16M4 15h10M4 20h7M17 15v6M14 18h6',
  ],
  [
    { en: 'Chinese and other languages', es: 'Chino y otros idiomas', zh: '中文及其他语言' },
    {
      en: 'Chinese lines break between characters, never before “。” or “，”, and justify between them; the interface speaks English, Spanish and Chinese.',
      es: 'Las líneas en chino se cortan entre caracteres, nunca antes de “。” o “，”, y se justifican entre ellos; la interfaz habla inglés, español y chino.',
      zh: '中文按字符断行，遵守避头尾规则（“。”“，”不会出现在行首），两端对齐时在字符间均匀分配；界面支持中文、英文和西班牙文。',
    },
    'M4 5h8M8 3v2M5 9c1 3 4 5 7 6M11 5c-1 4-3 7-7 9M13 21l4-9 4 9M14.5 18h5',
  ],
  [
    { en: 'Spell checking', es: 'Revisión ortográfica', zh: '拼写检查' },
    {
      en: 'Words spelled wrong get a red wave and suggestions, from the Hunspell dictionaries you give, checked in a worker.',
      es: 'Las palabras mal escritas reciben una onda roja y sugerencias, de los diccionarios Hunspell que le des, revisadas en un worker.',
      zh: '拼错的单词会显示红色波浪线和修改建议，使用你提供的 Hunspell 词典，在 worker 中检查。',
    },
    'M4 17l3.5-10L11 17M5.3 13.5h4.4M13 15l2.5 2.5L20 12',
  ],
  [
    { en: 'Fonts that travel', es: 'Fuentes que viajan', zh: '随文件携带的字体' },
    {
      en: 'TrueType or OpenType embedded in the PDF and, when they are TrueType and the license allows, in the DOCX.',
      es: 'TrueType u OpenType incrustadas en el PDF y, cuando son TrueType y la licencia lo permite, en el DOCX.',
      zh: 'TrueType 或 OpenType 字体嵌入 PDF；若为 TrueType 且许可证允许，也会嵌入 DOCX。',
    },
    'M6 18l5-13 5 13M8 13h6M18 9v10',
  ],
  [
    { en: 'PDF without a browser', es: 'PDF sin navegador', zh: '无需浏览器的 PDF' },
    {
      en: 'The same engine runs in Node and produces PDFs with selectable text, tagged for screen readers.',
      es: 'El mismo motor corre en Node y produce PDF con texto seleccionable, etiquetados para lectores de pantalla.',
      zh: '同一个引擎可在 Node 中运行，生成文字可选中、带屏幕阅读器标签的 PDF。',
    },
    'M6 3h9l3 3v15H6zM9 13l3 3 3-3M12 9v7',
  ],
  [
    { en: 'Phone and desktop', es: 'Teléfono y escritorio', zh: '手机与桌面' },
    {
      en: 'Pinch to zoom, plus a Tauri app that opens and saves .docx on disk.',
      es: 'Pellizca para hacer zoom, y además una app de Tauri que abre y guarda .docx en el disco.',
      zh: '双指缩放，另有一个 Tauri 桌面应用，可直接打开和保存磁盘上的 .docx。',
    },
    'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  ],
  [
    { en: 'Accessible', es: 'Accesible', zh: '无障碍' },
    {
      en: 'What happens is told to screen readers, everything works from the keyboard, and high contrast is kept.',
      es: 'Lo que pasa se le dice al lector de pantalla, todo funciona desde el teclado y se respeta el alto contraste.',
      zh: '所有操作都会告知屏幕阅读器，一切都能用键盘完成，并支持高对比度。',
    },
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M12 12h9',
  ],
  [
    { en: 'Your style', es: 'Tu estilo', zh: '你的风格' },
    {
      en: 'Use the built-in UI, or your own with unstyled hooks and Tailwind.',
      es: 'Usa la interfaz incluida, o la tuya con hooks sin estilos y Tailwind.',
      zh: '使用自带的界面，或用无样式的 hooks 加 Tailwind 打造你自己的界面。',
    },
    'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4-4-8-9-8zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
  ],
  [
    { en: 'AI assistants', es: 'Asistentes de IA', zh: 'AI 助手' },
    {
      en: 'Claude works on the real document through an MCP server, or a chat beside the editor.',
      es: 'Claude trabaja sobre el documento real a través de un servidor MCP, o en un chat junto al editor.',
      zh: 'Claude 通过 MCP 服务器或编辑器旁的聊天直接处理真实文档。',
    },
    'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2.5 2.5 1-2.5 1L19 22l-1-2.5-2.5-1 2.5-1z',
  ],
];
