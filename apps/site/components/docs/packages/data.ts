// What the page "Packages" says: plain data, read by the page on the server
// (to colour the code), by its parts in the browser, and by the search box.
// Each text in each language of the site; the code is the same in all.

import { PACKAGES, type Pastel } from '@/lib/home';
import type { L } from '@/lib/i18n';

export type PackageName = '@rebodocs/core' | '@rebodocs/editor' | '@rebodocs/react' | '@rebodocs/viewer' | '@rebodocs/collab' | '@rebodocs/mcp';

export interface PackageDoc {
  name: PackageName;
  /** The one line of the landing page, and its tag and colour. */
  what: L;
  tag: L;
  color: Pastel;
  summary: L;
  runsIn: L[];
  /** What it is built for, as `tools/package.mjs` builds it. */
  target: L;
  dependsOn: L[];
  /** Each way of getting it, with what that way is for. */
  install: [command: string, what: L][];
  /** What it has, by what it is about. */
  inside: [label: L, text: L][];
  /** The paths it is imported from, besides its own name. */
  entries?: [path: string, what: L][];
  takeIt: L;
  guides: [title: L, href: string][];
  example: [lang: 'ts' | 'tsx' | 'json' | 'bash', code: string][];
}

const landing = (name: PackageName) => {
  const { what, tag, color } = PACKAGES.find((pkg) => pkg.name === name)!;
  return { name, what, tag, color };
};

/** A name that is the same in every language: a component, a function. */
const same = (text: string): L => ({ en: text, es: text, zh: text });

const BROWSER: L = { en: 'Browser', es: 'Navegador', zh: '浏览器' };
const ES2022: L = { en: 'ES2022 browsers', es: 'Navegadores ES2022', zh: 'ES2022 浏览器' };

export const PACKAGE_DOCS: PackageDoc[] = [
  {
    ...landing('@rebodocs/react'),
    summary: {
      en: 'The editor for React: the whole of it as one component, or the pages and hooks to draw your own.',
      es: 'El editor para React: completo como un solo componente, o las páginas y los hooks para dibujar el tuyo.',
      zh: '面向 React 的编辑器：可以作为一个完整的组件使用，也可以用页面和 hooks 绘制你自己的界面。',
    },
    runsIn: [BROWSER, { en: 'Safe to render on a server', es: 'Se puede renderizar en un servidor', zh: '可安全地在服务器端渲染' }],
    target: ES2022,
    dependsOn: [{ en: 'React 18+ (peer)', es: 'React 18+ (peer)', zh: 'React 18+（peer 依赖）' }],
    install: [
      ['npm install @rebodocs/react', { en: 'Everything it needs is inside: one install.', es: 'Todo lo que necesita viene dentro: una sola instalación.', zh: '所需的一切都已内置：只需安装一次。' }],
    ],
    inside: [
      [
        same('DocsEditor'),
        {
          en: 'The whole editor as a component: toolbar, ruler, side panel, pages, status bar.',
          es: 'El editor completo como componente: barra de herramientas, regla, panel lateral, páginas, barra de estado.',
          zh: '作为组件的完整编辑器：工具栏、标尺、侧边栏、页面、状态栏。',
        },
      ],
      [
        { en: 'DocsProvider, DocsSurface, hooks', es: 'DocsProvider, DocsSurface, hooks', zh: 'DocsProvider、DocsSurface、hooks' },
        {
          en: 'The pages, and thirteen hooks to build an interface of your own.',
          es: 'Las páginas, y trece hooks para construir una interfaz propia.',
          zh: '页面，以及用于构建自定义界面的十三个 hooks。',
        },
      ],
      [
        { en: 'mountDocs, createDocs', es: 'mountDocs, createDocs', zh: 'mountDocs、createDocs' },
        { en: 'The same two, with no React in them.', es: 'Los mismos dos, sin React.', zh: '同样的两种用法，但不依赖 React。' },
      ],
      [
        same('DocsViewer'),
        { en: 'A document only to read, the component of @rebodocs/viewer.', es: 'Un documento solo para leer, el componente de @rebodocs/viewer.', zh: '只读文档，即 @rebodocs/viewer 的组件。' },
      ],
      [
        { en: 'Built in', es: 'Incluido', zh: '内置' },
        {
          en: 'The engine, the editor, the viewer and the collaboration client, in one bundle.',
          es: 'El motor, el editor, el visor y el cliente de colaboración, en un solo bundle.',
          zh: '引擎、编辑器、查看器和协作客户端，打包在一起。',
        },
      ],
    ],
    entries: [
      [
        '@rebodocs/react',
        { en: 'The components, the hooks, createDocs, languages and fonts.', es: 'Los componentes, los hooks, createDocs, idiomas y fuentes.', zh: '组件、hooks、createDocs、语言和字体。' },
      ],
      [
        '@rebodocs/react/mount',
        {
          en: 'mountDocs: the whole editor in an element, without React.',
          es: 'mountDocs: el editor completo en un elemento, sin React.',
          zh: 'mountDocs：不用 React，把完整编辑器挂载到一个元素中。',
        },
      ],
    ],
    takeIt: {
      en: 'For a React or Next.js application. It is the one an application installs first.',
      es: 'Para una aplicación de React o Next.js. Es el que una aplicación instala primero.',
      zh: '适用于 React 或 Next.js 应用。这是应用首先要安装的软件包。',
    },
    guides: [
      [{ en: 'React component', es: 'Componente de React', zh: 'React 组件' }, '/docs/react/'],
      [{ en: 'Headless: your own UI', es: 'Headless: tu propia interfaz', zh: 'Headless：你自己的界面' }, '/docs/headless/'],
      [{ en: 'Components and hooks', es: 'Componentes y hooks', zh: '组件与 Hooks' }, '/docs/components/'],
    ],
    example: [
      [
        'tsx',
        `'use client';
import { DocsEditor } from '@rebodocs/react';

export function Contract({ file }: { file: Uint8Array }) {
  return (
    <div className="h-screen">
      <DocsEditor docx={file} name="contract.docx" locale="en" onSave={(docx, name) => upload(docx, name)} />
    </div>
  );
}`,
      ],
    ],
  },
  {
    ...landing('@rebodocs/editor'),
    summary: {
      en: 'The editor in the browser with no framework: the Editor class and its interface, piece by piece.',
      es: 'El editor en el navegador sin framework: la clase Editor y su interfaz, pieza por pieza.',
      zh: '不依赖框架的浏览器编辑器：Editor 类及其界面，可逐个部件使用。',
    },
    runsIn: [BROWSER],
    target: ES2022,
    dependsOn: [same('@rebodocs/core')],
    install: [['npm install @rebodocs/editor', { en: 'It brings @rebodocs/core with it.', es: 'Trae consigo @rebodocs/core.', zh: '会同时安装 @rebodocs/core。' }]],
    inside: [
      [
        same('Editor'),
        {
          en: 'Pages, caret, selection, history, keyboard, mouse and touch.',
          es: 'Páginas, cursor, selección, historial, teclado, ratón y táctil.',
          zh: '页面、光标、选区、历史记录、键盘、鼠标和触控。',
        },
      ],
      [
        { en: 'Interface pieces', es: 'Piezas de la interfaz', zh: '界面部件' },
        {
          en: 'createToolbar, createStatusBar, createRuler, createPanel, createFindBar, createBubble, createSlashMenu, createVariableSuggest: each in an element of yours, or over the page.',
          es: 'createToolbar, createStatusBar, createRuler, createPanel, createFindBar, createBubble, createSlashMenu, createVariableSuggest: cada una en un elemento tuyo, o sobre la página.',
          zh: 'createToolbar、createStatusBar、createRuler、createPanel、createFindBar、createBubble、createSlashMenu、createVariableSuggest：每个都可放在你自己的元素中，或浮在页面上。',
        },
      ],
      [
        { en: 'Languages and fonts', es: 'Idiomas y fuentes', zh: '语言与字体' },
        {
          en: 'setLocale, addLocale, addFonts; Chinese in @rebodocs/editor/locales.',
          es: 'setLocale, addLocale, addFonts; el chino en @rebodocs/editor/locales.',
          zh: 'setLocale、addLocale、addFonts；中文界面位于 @rebodocs/editor/locales。',
        },
      ],
    ],
    entries: [
      [
        '@rebodocs/editor/locales/zh-Hans',
        { en: 'The interface in Simplified Chinese, for addLocale.', es: 'La interfaz en chino simplificado, para addLocale.', zh: '简体中文界面，用于 addLocale。' },
      ],
      [
        '@rebodocs/editor/locales/zh-Hant',
        { en: 'The interface in Traditional Chinese, for addLocale.', es: 'La interfaz en chino tradicional, para addLocale.', zh: '繁体中文界面，用于 addLocale。' },
      ],
    ],
    takeIt: {
      en: 'For a page without React, or to build on its pieces.',
      es: 'Para una página sin React, o para construir sobre sus piezas.',
      zh: '适用于不使用 React 的页面，或在其部件基础上构建。',
    },
    guides: [[{ en: 'Without a framework', es: 'Sin framework', zh: '不用框架' }, '/docs/vanilla/']],
    example: [
      [
        'ts',
        `import { Editor, createToolbar, createStatusBar, createBubble } from '@rebodocs/editor';

const editor = new Editor(document.querySelector('#pages')!);
createToolbar(document.querySelector('#toolbar')!, editor);
createStatusBar(document.querySelector('#status')!, editor);
createBubble(editor);

editor.loadDocx(bytes);
const pdf = await editor.exportPdf('Contract');`,
      ],
    ],
  },
  {
    ...landing('@rebodocs/viewer'),
    summary: {
      en: 'A document only to read: the pages of the editor read only, a bar to zoom and print, and the first page as a thumbnail.',
      es: 'Un documento solo para leer: las páginas del editor en solo lectura, una barra para hacer zoom e imprimir, y la primera página como miniatura.',
      zh: '只读文档：编辑器的只读页面、缩放和打印工具条，以及首页缩略图。',
    },
    runsIn: [BROWSER, { en: 'Safe to render on a server (React)', es: 'Se puede renderizar en un servidor (React)', zh: '可安全地在服务器端渲染（React）' }],
    target: ES2022,
    dependsOn: [same('@rebodocs/editor'), same('@rebodocs/core'), { en: 'React 18+ (optional peer)', es: 'React 18+ (peer opcional)', zh: 'React 18+（可选 peer 依赖）' }],
    install: [
      [
        'npm install @rebodocs/viewer',
        { en: 'It brings @rebodocs/editor and @rebodocs/core with it.', es: 'Trae consigo @rebodocs/editor y @rebodocs/core.', zh: '会同时安装 @rebodocs/editor 和 @rebodocs/core。' },
      ],
    ],
    inside: [
      [
        same('createViewer'),
        {
          en: 'The document in an element, from the bytes of a .docx: one page under another, or all at once; print().',
          es: 'El documento en un elemento, a partir de los bytes de un .docx: una página debajo de otra, o todas a la vez; print().',
          zh: '根据 .docx 的字节把文档显示在一个元素中：逐页向下排列或一次显示全部；print()。',
        },
      ],
      [
        same('DocsViewer'),
        {
          en: 'The same as a React component, in @rebodocs/viewer/react.',
          es: 'Lo mismo como componente de React, en @rebodocs/viewer/react.',
          zh: '同样的功能，作为 React 组件，位于 @rebodocs/viewer/react。',
        },
      ],
      [
        { en: 'pagePicture, pageThumbnail', es: 'pagePicture, pageThumbnail', zh: 'pagePicture、pageThumbnail' },
        {
          en: 'The first page as a JPEG or a PNG, or as the element the editor draws.',
          es: 'La primera página como JPEG o PNG, o como el elemento que dibuja el editor.',
          zh: '把首页输出为 JPEG 或 PNG，或输出为编辑器绘制的元素。',
        },
      ],
    ],
    entries: [['@rebodocs/viewer/react', { en: 'DocsViewer: the viewer as a React component.', es: 'DocsViewer: el visor como componente de React.', zh: 'DocsViewer：作为 React 组件的查看器。' }]],
    takeIt: {
      en: 'For an application that shows documents and does not edit them: a file manager, a preview, a page that shows a contract.',
      es: 'Para una aplicación que muestra documentos y no los edita: un administrador de archivos, una vista previa, una página que muestra un contrato.',
      zh: '适用于只展示、不编辑文档的应用：文件管理器、预览、展示合同的页面。',
    },
    guides: [[{ en: 'A document only to read', es: 'Un documento solo para leer', zh: '只读文档' }, '/docs/viewer/']],
    example: [
      [
        'ts',
        `import { createViewer, pagePicture } from '@rebodocs/viewer';

const viewer = createViewer(document.querySelector('#pages')!, bytes);
viewer.setLayout('all');

const thumbnail = await pagePicture(bytes, 480); // a JPEG`,
      ],
    ],
  },
  {
    ...landing('@rebodocs/core'),
    summary: {
      en: 'The engine: everything about a document that does not need a screen.',
      es: 'El motor: todo lo de un documento que no necesita una pantalla.',
      zh: '引擎：文档中一切不需要屏幕的处理。',
    },
    runsIn: [same('Node'), BROWSER],
    target: { en: 'ES2022: Node and browsers', es: 'ES2022: Node y navegadores', zh: 'ES2022：Node 和浏览器' },
    dependsOn: [same('fflate')],
    install: [['npm install @rebodocs/core', { en: 'For code that makes or changes documents.', es: 'Para código que crea o cambia documentos.', zh: '用于创建或修改文档的代码。' }]],
    inside: [
      [
        { en: 'Model', es: 'Modelo', zh: '模型' },
        {
          en: 'An immutable Doc of paragraphs, runs, tables, header and footer, styles, numbering, notes and media.',
          es: 'Un Doc inmutable de párrafos, runs, tablas, encabezado y pie, estilos, numeración, notas y medios.',
          zh: '不可变的 Doc，包含段落、文本片段、表格、页眉页脚、样式、编号、注释和媒体。',
        },
      ],
      [
        { en: 'Operations', es: 'Operaciones', zh: '操作' },
        { en: 'Pure functions, (doc, …) => doc, for every edit.', es: 'Funciones puras, (doc, …) => doc, para cada edición.', zh: '每种编辑都是纯函数：(doc, …) => doc。' },
      ],
      [
        same('DOCX'),
        { en: 'importDocx and exportDocx, keeping what is not understood.', es: 'importDocx y exportDocx, conservando lo que no se entiende.', zh: 'importDocx 和 exportDocx，不理解的内容原样保留。' },
      ],
      [
        { en: 'Layout', es: 'Maquetación', zh: '排版' },
        {
          en: 'layoutDocument: lines, pages, and where the caret and the selection go.',
          es: 'layoutDocument: líneas, páginas, y dónde van el cursor y la selección.',
          zh: 'layoutDocument：行、页，以及光标和选区的位置。',
        },
      ],
      [
        { en: 'Output', es: 'Salida', zh: '输出' },
        { en: 'renderPdf, exportMarkdown.', es: 'renderPdf, exportMarkdown.', zh: 'renderPdf、exportMarkdown。' },
      ],
      [
        { en: 'Templates and versions', es: 'Plantillas y versiones', zh: '模板与版本' },
        {
          en: 'variableNames, fillVariables, compareDocs, restoreVersion.',
          es: 'variableNames, fillVariables, compareDocs, restoreVersion.',
          zh: 'variableNames、fillVariables、compareDocs、restoreVersion。',
        },
      ],
    ],
    takeIt: {
      en: 'When documents are made or changed in code: on a server, in a script, in a job.',
      es: 'Cuando los documentos se crean o cambian en código: en un servidor, en un script, en una tarea programada.',
      zh: '当需要用代码创建或修改文档时：在服务器上、在脚本中、在后台任务里。',
    },
    guides: [
      [{ en: 'On a server: DOCX and PDF', es: 'En un servidor: DOCX y PDF', zh: '在服务器上：DOCX 与 PDF' }, '/docs/server/'],
      [{ en: 'Templates and variables', es: 'Plantillas y variables', zh: '模板与变量' }, '/docs/templates/'],
    ],
    example: [
      [
        'ts',
        `import { importDocx, exportDocx, fillVariables, renderPdf } from '@rebodocs/core';

let doc = importDocx(bytes);                          // Uint8Array → Doc
doc = fillVariables(doc, { client: 'Northwind S.A.' });
const docx = exportDocx(doc);                         // Doc → Uint8Array
const { pdf } = renderPdf(doc, fonts, 'Receipt 1024');   // fonts: readFont() of your .ttf files`,
      ],
    ],
  },
  {
    ...landing('@rebodocs/collab'),
    summary: {
      en: 'Several people on one document: the change format, the room server, and its browser client.',
      es: 'Varias personas en un mismo documento: el formato de los cambios, el servidor de salas y su cliente para el navegador.',
      zh: '多人编辑同一份文档：变更格式、房间服务器及其浏览器客户端。',
    },
    runsIn: [
      { en: 'Node (the server)', es: 'Node (el servidor)', zh: 'Node（服务器）' },
      { en: 'Browser (the client)', es: 'Navegador (el cliente)', zh: '浏览器（客户端）' },
    ],
    target: { en: 'Node 22 (server) · ES2022 (client)', es: 'Node 22 (servidor) · ES2022 (cliente)', zh: 'Node 22（服务器）· ES2022（客户端）' },
    dependsOn: [same('@rebodocs/core')],
    install: [
      ['npx @rebodocs/collab --backend https://…', { en: 'The room server, as it comes.', es: 'El servidor de salas, tal como viene.', zh: '开箱即用的房间服务器。' }],
      ['npm install @rebodocs/collab', { en: 'To start it from your own code.', es: 'Para arrancarlo desde tu propio código.', zh: '用于在你自己的代码中启动它。' }],
    ],
    inside: [
      [
        { en: 'Changes', es: 'Cambios', zh: '变更' },
        {
          en: 'Operations addressed by paragraph id, and how two at once are reconciled.',
          es: 'Operaciones dirigidas por el id del párrafo, y cómo se concilian dos a la vez.',
          zh: '按段落 id 定位的操作，以及两个同时发生的操作如何协调。',
        },
      ],
      [
        { en: 'Room server', es: 'Servidor de salas', zh: '房间服务器' },
        {
          en: 'Rooms in memory, saved through your backend; it checks every editor has the document, and says who changed it in each session of work.',
          es: 'Salas en memoria, guardadas a través de tu backend; comprueba que cada editor tenga el documento, y dice quién lo cambió en cada sesión de trabajo.',
          zh: '房间保存在内存中，并通过你的后端持久化；它会核对每个编辑器持有的文档是否一致，并记录每次工作会话中谁做了修改。',
        },
      ],
      [
        { en: 'Client', es: 'Cliente', zh: '客户端' },
        {
          en: 'What the editor connects with. @rebodocs/react already has it inside.',
          es: 'Con lo que se conecta el editor. @rebodocs/react ya lo trae dentro.',
          zh: '编辑器用来连接的部分。@rebodocs/react 已内置。',
        },
      ],
    ],
    entries: [
      [
        '@rebodocs/collab/server',
        { en: 'createCollabServer, for a Node program of your own.', es: 'createCollabServer, para un programa propio de Node.', zh: 'createCollabServer，用于你自己的 Node 程序。' },
      ],
      ['@rebodocs/collab/storage', { en: 'Where rooms are kept: your backend, over HTTP.', es: 'Dónde se guardan las salas: tu backend, por HTTP.', zh: '房间保存在哪里：通过 HTTP 存到你的后端。' }],
      ['@rebodocs/collab/browser', { en: 'The client, for an editor without React.', es: 'El cliente, para un editor sin React.', zh: '客户端，用于不使用 React 的编辑器。' }],
    ],
    takeIt: { en: 'When several people must edit at once.', es: 'Cuando varias personas deben editar a la vez.', zh: '当多人需要同时编辑时。' },
    guides: [[{ en: 'Real-time collaboration', es: 'Colaboración en tiempo real', zh: '实时协作' }, '/docs/collaboration/']],
    example: [
      [
        'ts',
        `import { createCollabServer } from '@rebodocs/collab/server';
import { backendStorage } from '@rebodocs/collab/storage';

const server = createCollabServer({
  port: 7420,
  storage: backendStorage({ url: 'https://api.example.com/docs', key: process.env.KEY }),
});
await server.ready;`,
      ],
    ],
  },
  {
    ...landing('@rebodocs/mcp'),
    summary: {
      en: 'Tools for an AI assistant to read and edit documents, over files or over the one open in a browser.',
      es: 'Herramientas para que un asistente de IA lea y edite documentos, sobre archivos o sobre el que está abierto en un navegador.',
      zh: '供 AI 助手读取和编辑文档的工具，可作用于文件，也可作用于浏览器中打开的文档。',
    },
    runsIn: [
      { en: 'Node (the server)', es: 'Node (el servidor)', zh: 'Node（服务器）' },
      { en: 'Browser (the editor’s side)', es: 'Navegador (el lado del editor)', zh: '浏览器（编辑器端）' },
    ],
    target: { en: 'Node 22 (server) · ES2022 (browser side)', es: 'Node 22 (servidor) · ES2022 (lado del navegador)', zh: 'Node 22（服务器）· ES2022（浏览器端）' },
    dependsOn: [same('@rebodocs/core'), same('@anthropic-ai/sdk')],
    install: [
      [
        'npx @rebodocs/mcp --root ~/Documents',
        { en: 'The MCP server, for Claude Desktop and other clients.', es: 'El servidor MCP, para Claude Desktop y otros clientes.', zh: 'MCP 服务器，供 Claude Desktop 和其他客户端使用。' },
      ],
      [
        'npm install @rebodocs/mcp',
        { en: 'The tools, or Claude in a chat in your application.', es: 'Las herramientas, o Claude en un chat dentro de tu aplicación.', zh: '工具本身，或你应用中的 Claude 聊天。' },
      ],
    ],
    inside: [
      [
        { en: 'MCP server', es: 'Servidor MCP', zh: 'MCP 服务器' },
        {
          en: 'Its tools are the editor’s operations, and some of its own for contracts: read, find, replace, format, notes, tables, clauses, pages. Over standard input and output, or HTTP.',
          es: 'Sus herramientas son las operaciones del editor, y algunas propias para contratos: leer, buscar, reemplazar, dar formato, notas, tablas, cláusulas, páginas. Por entrada y salida estándar, o HTTP.',
          zh: '它的工具就是编辑器的操作，另有一些专门处理合同的工具：读取、查找、替换、设置格式、批注、表格、条款、页面。通过标准输入输出或 HTTP 通信。',
        },
      ],
      [
        { en: 'Claude route', es: 'Ruta de Claude', zh: 'Claude 路由' },
        {
          en: 'The route of a backend that takes a chat in the page to the Claude API.',
          es: 'La ruta de un backend que lleva un chat de la página a la API de Claude.',
          zh: '后端的一条路由，把页面中的聊天转发给 Claude API。',
        },
      ],
      [
        { en: 'Browser side', es: 'Lado del navegador', zh: '浏览器端' },
        {
          en: 'What lets the tools work on the document open in the editor.',
          es: 'Lo que permite a las herramientas trabajar sobre el documento abierto en el editor.',
          zh: '让工具能够处理编辑器中打开的文档的部分。',
        },
      ],
    ],
    entries: [
      [
        '@rebodocs/mcp/claude',
        {
          en: 'assistantHandler and assistantRoute: the backend of the chat beside the editor.',
          es: 'assistantHandler y assistantRoute: el backend del chat junto al editor.',
          zh: 'assistantHandler 和 assistantRoute：编辑器旁聊天的后端。',
        },
      ],
      [
        '@rebodocs/mcp/browser',
        {
          en: 'The editor’s side; createAssistantChat is in @rebodocs/react.',
          es: 'El lado del editor; createAssistantChat está en @rebodocs/react.',
          zh: '编辑器端；createAssistantChat 位于 @rebodocs/react。',
        },
      ],
    ],
    takeIt: {
      en: 'To let an assistant work on documents, from a client such as Claude Desktop or inside your application.',
      es: 'Para dejar que un asistente trabaje en documentos, desde un cliente como Claude Desktop o dentro de tu aplicación.',
      zh: '让助手处理文档：可以通过 Claude Desktop 等客户端，也可以在你的应用内部。',
    },
    guides: [[{ en: 'AI assistants (MCP)', es: 'Asistentes de IA (MCP)', zh: 'AI 助手（MCP）' }, '/docs/assistants/']],
    example: [
      [
        'json',
        `// claude_desktop_config.json
{
  "mcpServers": {
    "rebodocs": {
      "command": "npx",
      "args": ["-y", "@rebodocs/mcp", "--root", "/path/to/documents"]
    }
  }
}`,
      ],
    ],
  },
];

/** What every package is, as it goes to npm. */
export const ALL_PACKAGES: L[] = [
  { en: 'ESM only', es: 'Solo ESM', zh: '仅 ESM' },
  { en: 'TypeScript types included', es: 'Tipos de TypeScript incluidos', zh: '自带 TypeScript 类型' },
  { en: 'Tree-shakeable', es: 'Tree-shakeable', zh: '支持 Tree-shaking' },
  same('MIT'),
];

/** How each package is in an application: installed, inside one installed, or not there. */
export type Presence = 'install' | 'inside' | 'none';

export interface Goal {
  want: L;
  use: string;
  presence: Record<PackageName, Presence>;
  commands: string[];
  note: L;
}

const none: Record<PackageName, Presence> = {
  '@rebodocs/core': 'none',
  '@rebodocs/editor': 'none',
  '@rebodocs/react': 'none',
  '@rebodocs/viewer': 'none',
  '@rebodocs/collab': 'none',
  '@rebodocs/mcp': 'none',
};

/** "Which one do I install?", in order. */
export const GOALS: Goal[] = [
  {
    want: { en: 'A React or Next.js application', es: 'Una aplicación de React o Next.js', zh: 'React 或 Next.js 应用' },
    use: '@rebodocs/react',
    presence: { ...none, '@rebodocs/react': 'install', '@rebodocs/editor': 'inside', '@rebodocs/viewer': 'inside', '@rebodocs/core': 'inside', '@rebodocs/collab': 'inside' },
    commands: ['npm install @rebodocs/react'],
    note: {
      en: 'One install: the engine, the editor and the collaboration client come inside.',
      es: 'Una sola instalación: el motor, el editor y el cliente de colaboración vienen dentro.',
      zh: '只需安装一次：引擎、编辑器和协作客户端都已内置。',
    },
  },
  {
    want: { en: 'A page without React', es: 'Una página sin React', zh: '不使用 React 的页面' },
    use: '@rebodocs/editor',
    presence: { ...none, '@rebodocs/editor': 'install', '@rebodocs/core': 'inside' },
    commands: ['npm install @rebodocs/editor'],
    note: {
      en: 'Or mountDocs from @rebodocs/react/mount, for the whole editor with no framework.',
      es: 'O mountDocs de @rebodocs/react/mount, para el editor completo sin framework.',
      zh: '或者使用 @rebodocs/react/mount 中的 mountDocs，在不依赖框架的情况下获得完整编辑器。',
    },
  },
  {
    want: { en: 'To show documents, not edit them', es: 'Mostrar documentos, no editarlos', zh: '只展示文档，不编辑' },
    use: '@rebodocs/viewer',
    presence: { ...none, '@rebodocs/viewer': 'install', '@rebodocs/editor': 'inside', '@rebodocs/core': 'inside' },
    commands: ['npm install @rebodocs/viewer'],
    note: {
      en: 'The pages read only, and thumbnails; with React from @rebodocs/viewer/react, or without it.',
      es: 'Las páginas en solo lectura, y miniaturas; con React desde @rebodocs/viewer/react, o sin él.',
      zh: '只读页面和缩略图；可通过 @rebodocs/viewer/react 配合 React 使用，也可以不用 React。',
    },
  },
  {
    want: { en: 'Documents in code, on a server', es: 'Documentos en código, en un servidor', zh: '在服务器上用代码处理文档' },
    use: '@rebodocs/core',
    presence: { ...none, '@rebodocs/core': 'install' },
    commands: ['npm install @rebodocs/core'],
    note: {
      en: 'Fill templates, change documents, make PDFs: no browser, no DOM.',
      es: 'Llenar plantillas, cambiar documentos, hacer PDF: sin navegador, sin DOM.',
      zh: '填写模板、修改文档、生成 PDF：不需要浏览器，也不需要 DOM。',
    },
  },
  {
    want: { en: 'Several people on one document', es: 'Varias personas en un mismo documento', zh: '多人编辑同一份文档' },
    use: '@rebodocs/react + @rebodocs/collab',
    presence: { ...none, '@rebodocs/react': 'install', '@rebodocs/collab': 'install', '@rebodocs/editor': 'inside', '@rebodocs/viewer': 'inside', '@rebodocs/core': 'inside' },
    commands: ['npm install @rebodocs/react', 'npx @rebodocs/collab --backend https://…'],
    note: {
      en: 'The editor in the page, the room server beside your backend.',
      es: 'El editor en la página, el servidor de salas junto a tu backend.',
      zh: '编辑器放在页面中，房间服务器部署在你的后端旁边。',
    },
  },
  {
    want: { en: 'An AI assistant on documents', es: 'Un asistente de IA sobre documentos', zh: '处理文档的 AI 助手' },
    use: '@rebodocs/mcp',
    presence: { ...none, '@rebodocs/mcp': 'install', '@rebodocs/core': 'inside' },
    commands: ['npx @rebodocs/mcp --root ~/Documents'],
    note: {
      en: 'For Claude Desktop. For Claude in a chat in your application, add @rebodocs/react.',
      es: 'Para Claude Desktop. Para Claude en un chat dentro de tu aplicación, agrega @rebodocs/react.',
      zh: '用于 Claude Desktop。若要在你的应用中通过聊天使用 Claude，再加上 @rebodocs/react。',
    },
  },
  {
    want: { en: 'An application for the desktop', es: 'Una aplicación de escritorio', zh: '桌面应用' },
    use: '@rebodocs/editor',
    presence: { ...none, '@rebodocs/editor': 'install', '@rebodocs/core': 'inside' },
    commands: ['npm run desktop'],
    note: {
      en: 'apps/desktop in the repository is the editor in Tauri: .docx files on disk, a native menu, PDF. Start from it.',
      es: 'apps/desktop en el repositorio es el editor en Tauri: archivos .docx en disco, un menú nativo, PDF. Empieza desde ahí.',
      zh: '仓库中的 apps/desktop 就是基于 Tauri 的编辑器：读写磁盘上的 .docx、原生菜单、PDF。可以从它开始。',
    },
  },
];

export interface App {
  path: string;
  what: L;
  run?: string;
}

export const APPS: App[] = [
  {
    path: 'apps/playground',
    what: {
      en: 'The page every package is tried in. Its src/main.ts is the shortest example of everything wired together.',
      es: 'La página donde se prueba cada paquete. Su src/main.ts es el ejemplo más corto de todo conectado.',
      zh: '试用每个软件包的页面。它的 src/main.ts 是把一切连接起来的最短示例。',
    },
    run: 'npm run dev',
  },
  {
    path: 'apps/demo',
    what: {
      en: '@rebodocs/react as an application uses it: the whole editor, and an interface of its own on the hooks.',
      es: '@rebodocs/react tal como lo usa una aplicación: el editor completo, y una interfaz propia sobre los hooks.',
      zh: '应用中实际使用 @rebodocs/react 的方式：完整编辑器，以及基于 hooks 的自定义界面。',
    },
  },
  {
    path: 'apps/viewer',
    what: {
      en: 'Documents only to read: a shelf of them with their thumbnails, and each one opened in the viewer.',
      es: 'Documentos solo para leer: un estante de ellos con sus miniaturas, y cada uno abierto en el visor.',
      zh: '只读文档：一个带缩略图的文档书架，每份文档都在查看器中打开。',
    },
    run: 'npm run viewer',
  },
  {
    path: 'apps/storage',
    what: {
      en: 'Documents in an S3 bucket: open, save, and a PDF made on the server.',
      es: 'Documentos en un bucket S3: abrir, guardar, y un PDF hecho en el servidor.',
      zh: 'S3 存储桶中的文档：打开、保存，以及在服务器上生成 PDF。',
    },
  },
  {
    path: 'apps/realtime',
    what: {
      en: 'Several people on one document, through a backend with its three routes and signed tickets.',
      es: 'Varias personas en un mismo documento, a través de un backend con sus tres rutas y tickets firmados.',
      zh: '多人编辑同一份文档，通过一个带三条路由和签名票据的后端实现。',
    },
    run: 'npm run realtime',
  },
  {
    path: 'apps/assistant',
    what: {
      en: 'Claude in a chat beside a shared document: the page runs the tools, the backend talks to the Claude API.',
      es: 'Claude en un chat junto a un documento compartido: la página ejecuta las herramientas, el backend habla con la API de Claude.',
      zh: '共享文档旁的 Claude 聊天：页面运行工具，后端与 Claude API 通信。',
    },
  },
  {
    path: 'apps/desktop',
    what: {
      en: 'The editor as a desktop application, with Tauri: .docx files on disk, a native menu, PDF.',
      es: 'El editor como aplicación de escritorio, con Tauri: archivos .docx en disco, un menú nativo, PDF.',
      zh: '基于 Tauri 的桌面版编辑器：读写磁盘上的 .docx、原生菜单、PDF。',
    },
    run: 'npm run desktop',
  },
  { path: 'apps/site', what: { en: 'This website.', es: 'Este sitio web.', zh: '本网站。' } },
];

export const short = (name: string) => name.replace('@rebodocs/', '');
