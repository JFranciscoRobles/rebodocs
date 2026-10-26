import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS, type Pastel } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { Callout, HandTip, SectionHead } from '../ui';
import { ConfigBuilder } from './ConfigBuilder';
import { FILE_TOOLS, HTTP_SETUP, OPTIONS } from './data';
import { toolDocs } from './tools';
import { LazyRunner, ToolsReference } from './ToolsReference';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** The three ways an assistant reaches a document, each as who talks to whom. */
const WAYS: { title: L; color: Pastel; flow: [L, L, L]; text: L; href: string; cta: L }[] = [
  {
    title: { en: 'Files, from your assistant', es: 'Archivos, desde tu asistente', zh: '文件，由你的 AI 助手处理' },
    color: 'blue',
    flow: [
      { en: 'Claude Desktop, Code, Cursor', es: 'Claude Desktop, Code, Cursor', zh: 'Claude Desktop、Code、Cursor' },
      { en: 'rebodocs-mcp, on your machine', es: 'rebodocs-mcp, en tu máquina', zh: 'rebodocs-mcp（在你的电脑上）' },
      { en: 'contract.docx', es: 'contract.docx', zh: 'contract.docx' },
    ],
    text: {
      en: 'The assistant opens a .docx, changes it in memory and saves it as DOCX, PDF or Markdown. No editor needs to be open.',
      es: 'El asistente abre un .docx, lo cambia en memoria y lo guarda como DOCX, PDF o Markdown. No hace falta tener un editor abierto.',
      zh: 'AI 助手打开 .docx，在内存中修改，然后保存为 DOCX、PDF 或 Markdown。无需打开编辑器。',
    },
    href: '#setup',
    cta: { en: 'Set it up', es: 'Configúralo', zh: '配置' },
  },
  {
    title: { en: 'The editor someone has open', es: 'El editor que alguien tiene abierto', zh: '某人正在使用的编辑器' },
    color: 'purple',
    flow: [
      { en: 'Your assistant', es: 'Tu asistente', zh: '你的 AI 助手' },
      { en: 'rebodocs-mcp, on your machine', es: 'rebodocs-mcp, en tu máquina', zh: 'rebodocs-mcp（在你的电脑上）' },
      { en: 'the editor in the browser', es: 'el editor en el navegador', zh: '浏览器中的编辑器' },
    ],
    text: {
      en: 'The person switches on “AI” in the status bar, and the assistant works on what they are looking at: each change a step to undo, the view going to it.',
      es: 'La persona activa “IA” en la barra de estado, y el asistente trabaja sobre lo que está mirando: cada cambio un paso para deshacer, y la vista va a él.',
      zh: '用户在状态栏中打开“AI”，AI 助手就会处理他正在查看的文档：每处更改都可一步撤销，视图会跳到更改处。',
    },
    href: '#setup',
    cta: { en: 'Set it up', es: 'Configúralo', zh: '配置' },
  },
  {
    title: { en: 'Claude in your application', es: 'Claude en tu aplicación', zh: '在你的应用中使用 Claude' },
    color: 'green',
    flow: [
      { en: 'A chat in your page', es: 'Un chat en tu página', zh: '你页面中的聊天' },
      { en: 'your backend', es: 'tu backend', zh: '你的后端' },
      { en: 'the Claude API', es: 'la API de Claude', zh: 'Claude API' },
    ],
    text: {
      en: 'For everyone who uses your application, with your API key. The page holds the conversation and runs the tools on the editor; the server keeps nothing.',
      es: 'Para todos los que usan tu aplicación, con tu clave de API. La página guarda la conversación y ejecuta las herramientas en el editor; el servidor no guarda nada.',
      zh: '面向所有使用你的应用的人，使用你的 API 密钥。页面保存对话并在编辑器上运行工具；服务器不保存任何内容。',
    },
    href: '#app',
    cta: { en: 'Add it', es: 'Añádelo', zh: '添加' },
  },
];

/** What keeps an assistant to what it was given, each checked in packages/mcp/src (server.ts, bridge.ts, browser.ts, claude.ts). */
const SAFETY: [title: L, text: L][] = [
  [
    { en: 'Only the folders you name', es: 'Solo las carpetas que nombras', zh: '只限你指定的文件夹' },
    {
      en: 'With --root, a path outside those folders is refused, and the assistant is told why. Without it, the server may use any file the machine lets it.',
      es: 'Con --root, una ruta fuera de esas carpetas se rechaza, y se le dice al asistente por qué. Sin él, el servidor puede usar cualquier archivo que la máquina le permita.',
      zh: '使用 --root 时，这些文件夹之外的路径会被拒绝，并告诉 AI 助手原因。不使用时，服务器可以使用这台机器允许它访问的任何文件。',
    },
  ],
  [
    { en: 'Nothing written until it saves', es: 'Nada escrito hasta que guarda', zh: '保存之前不写入' },
    {
      en: 'An opened file is changed in memory. save_document writes it, and never over a file that is there unless the assistant says overwrite; new_document will not take a path that exists.',
      es: 'Un archivo abierto se cambia en memoria. save_document lo escribe, y nunca sobre un archivo que ya existe salvo que el asistente diga overwrite; new_document no acepta una ruta que existe.',
      zh: '打开的文件在内存中修改。由 save_document 写入，除非 AI 助手指定 overwrite，否则绝不覆盖已有文件；new_document 不接受已存在的路径。',
    },
  ],
  [
    { en: 'Only this machine, unless you say', es: 'Solo esta máquina, salvo que digas', zh: '默认只限本机' },
    {
      en: 'The server listens on 127.0.0.1. A page connects from localhost, or from an --origin you name. To listen for other machines (--host) it will not start without a --token of 12 characters or more.',
      es: 'El servidor escucha en 127.0.0.1. Una página se conecta desde localhost, o desde un --origin que nombres. Para escuchar a otras máquinas (--host) no arranca sin un --token de 12 caracteres o más.',
      zh: '服务器监听 127.0.0.1。页面只能从 localhost 或你指定的 --origin 连接。要监听其他机器（--host），没有 12 个字符以上的 --token 就不会启动。',
    },
  ],
  [
    { en: 'The person switches it on', es: 'La persona lo activa', zh: '由用户开启' },
    {
      en: 'The editor connects only when “AI” is switched on, and not again after a reload. Each change is a step to undo, and the view goes to it.',
      es: 'El editor solo se conecta cuando se activa “IA”, y no de nuevo tras recargar. Cada cambio es un paso para deshacer, y la vista va a él.',
      zh: '只有打开“AI”时编辑器才会连接，重新加载后不会自动再连接。每处更改都可一步撤销，视图会跳到更改处。',
    },
  ],
  [
    { en: 'Suggestions, not edits', es: 'Sugerencias, no ediciones', zh: '是建议，而不是直接修改' },
    {
      en: 'With track_changes on, what the tools change stays marked, signed “Assistant”, for the person to accept or reject.',
      es: 'Con track_changes activado, lo que cambian las herramientas queda marcado, firmado “Assistant”, para que la persona lo acepte o lo rechace.',
      zh: '开启 track_changes 后，工具做出的更改会保留标记，署名“Assistant”，由用户接受或拒绝。',
    },
  ],
  [
    { en: 'A way back', es: 'Un camino de vuelta', zh: '可以回退' },
    {
      en: 'On a file, undo goes back from the last changes, up to 50; in the editor, each change is a step the person undoes. edit_document makes all its edits or none.',
      es: 'En un archivo, undo vuelve atrás desde los últimos cambios, hasta 50; en el editor, cada cambio es un paso que la persona deshace. edit_document hace todas sus ediciones o ninguna.',
      zh: '对于文件，undo 可以从最近的更改往回撤销，最多 50 处；在编辑器中，每处更改都是用户可以撤销的一步。edit_document 要么完成全部编辑，要么一个也不做。',
    },
  ],
  [
    { en: 'The client knows what only reads', es: 'El cliente sabe qué solo lee', zh: '客户端知道哪些只读' },
    {
      en: 'Each tool says whether it only reads, whether doing it again changes more, and whether it can lose work: only save_document and close_document can. A client can let the reading ones run without asking.',
      es: 'Cada herramienta dice si solo lee, si hacerla de nuevo cambia más, y si puede perder trabajo: solo save_document y close_document pueden. Un cliente puede dejar correr sin preguntar las que leen.',
      zh: '每个工具都会说明它是否只读、重复执行是否会改变更多内容，以及是否可能丢失工作：只有 save_document 和 close_document 可能。客户端可以让只读工具无需确认直接运行。',
    },
  ],
  [
    { en: 'In your application: who, and how often', es: 'En tu aplicación: quién, y cada cuánto', zh: '在你的应用中：谁可以用、多频繁' },
    {
      en: 'assistantRoute asks allow who may use it and gives each user perMinute steps, told apart by key; the key stays on your server, and the conversation in the page.',
      es: 'assistantRoute le pregunta a allow quién puede usarlo y le da a cada usuario perMinute pasos, distinguidos por key; la clave se queda en tu servidor, y la conversación en la página.',
      zh: 'assistantRoute 通过 allow 判断谁可以使用，并按 key 区分用户，给每个用户 perMinute 个步骤；API 密钥留在你的服务器上，对话留在页面中。',
    },
  ],
];

/** Names of options and tools in a sentence, as code that does not break at its hyphen. */
const NAMES = /(--[a-z-]+|\b(?:save_document|new_document|close_document|track_changes|edit_document|undo|assistantRoute|allow|perMinute|key|overwrite)\b)/;
const withNames = (text: string) =>
  text.split(NAMES).map((piece, i) =>
    i % 2 ? (
      <code key={i} className="whitespace-nowrap font-code text-[13.5px] text-ink">
        {piece}
      </code>
    ) : (
      piece
    ),
  );

/** What the tools do for a contract beyond its text, each checked in packages/mcp/src/tools. */
const CONTRACTS: [tool: string, text: L][] = [
  [
    'edit_document',
    {
      en: 'Several changes in one call, all or none: replace, rewrite, insert, delete, style, format, notes, moving a clause, a cell. Every paragraph number in them is the one of a single reading, so the assistant does not read again after each insertion.',
      es: 'Varios cambios en una llamada, todos o ninguno: reemplazar, reescribir, insertar, borrar, estilo, formato, notas, mover una cláusula, una celda. Cada número de párrafo en ellos es el de una sola lectura, así que el asistente no vuelve a leer tras cada inserción.',
      zh: '一次调用完成多项更改，要么全部完成，要么一个也不做：替换、改写、插入、删除、样式、格式、批注、移动条款、单元格。其中的段落编号都基于同一次读取，因此 AI 助手不必每次插入后都重新读取。',
    },
  ],
  [
    'renumber_clauses',
    {
      en: 'Puts in order the numbers written at the start of the headings, after a clause was put in, taken out or moved: “Primera.”, “CLÁUSULA 3.” or “IV.”, each kept as written. It lists the places of the text that name a clause by a number that changed, without changing them.',
      es: 'Ordena los números escritos al principio de los títulos, después de poner, quitar o mover una cláusula: “Primera.”, “CLÁUSULA 3.” o “IV.”, cada uno conservado como está escrito. Lista los lugares del texto que nombran una cláusula por un número que cambió, sin cambiarlos.',
      zh: '在插入、删除或移动条款之后，重新排列标题开头写的编号：“Primera.”、“CLÁUSULA 3.”或“IV.”，各自保持原有写法。它会列出正文中以已变化的编号引用条款的位置，但不修改它们。',
    },
  ],
  [
    'move_section',
    {
      en: 'Moves a heading with everything under it, as dragging it in the outline does: the clause keeps its look and its notes.',
      es: 'Mueve un título con todo lo que tiene debajo, como arrastrarlo en el esquema: la cláusula conserva su aspecto y sus notas.',
      zh: '移动一个标题及其下的所有内容，就像在大纲中拖动它一样：条款保留其格式和批注。',
    },
  ],
  [
    'set_cell_text',
    {
      en: 'Writes a cell by its table, row and cell, empty or not: the way to fill a row just put in.',
      es: 'Escribe una celda por su tabla, fila y celda, vacía o no: la forma de llenar una fila recién puesta.',
      zh: '按表格、行和单元格写入一个单元格，无论是否为空：这是填写刚插入的行的方法。',
    },
  ],
  [
    'read_pages',
    {
      en: 'How the document falls on its pages, in words: a paragraph cut by a page, a heading left at the foot of one, a last page of a line, a table over two pages.',
      es: 'Cómo cae el documento en sus páginas, en palabras: un párrafo cortado por una página, un título que queda al pie de una, una última página de una línea, una tabla en dos páginas.',
      zh: '用文字描述文档的分页情况：被分页截断的段落、留在页尾的标题、只有一行的最后一页、跨两页的表格。',
    },
  ],
  [
    'edit_table',
    {
      en: 'With keep_together, a block of signatures stays whole on one page, and goes to the next only when it does not fit; format_paragraphs keeps a paragraph whole with keep_lines_together, or with the next with keep_with_next.',
      es: 'Con keep_together, un bloque de firmas se queda entero en una página, y pasa a la siguiente solo cuando no cabe; format_paragraphs mantiene un párrafo entero con keep_lines_together, o con el siguiente con keep_with_next.',
      zh: '使用 keep_together 时，签名栏会完整地留在同一页，放不下时才整体移到下一页；format_paragraphs 用 keep_lines_together 让段落不被拆开，用 keep_with_next 让它与下一段在同一页。',
    },
  ],
];

/** One question in a chat of your own, from the person to the last change. From chat.ts and claude.ts. */
const LOOP: [title: L, text: L][] = [
  [
    { en: 'The person asks', es: 'La persona pregunta', zh: '用户提问' },
    {
      en: 'createAssistantChat sends the conversation so far to POST /api/assistant, on your server.',
      es: 'createAssistantChat envía la conversación hasta ahora a POST /api/assistant, en tu servidor.',
      zh: 'createAssistantChat 把目前为止的对话发送到你服务器上的 POST /api/assistant。',
    },
  ],
  [
    { en: 'Your route asks Claude', es: 'Tu ruta le pregunta a Claude', zh: '你的路由询问 Claude' },
    {
      en: 'assistantRoute (or assistantHandler, in Next.js) checks who may ask (allow) and how often (perMinute), and sends the conversation to Claude with the tools of the document. The answer comes back as Claude writes it: a line of JSON for each piece of text and each tool it asks for, and the whole answer at the end.',
      es: 'assistantRoute (o assistantHandler, en Next.js) comprueba quién puede preguntar (allow) y cada cuánto (perMinute), y envía la conversación a Claude con las herramientas del documento. La respuesta vuelve a medida que Claude la escribe: una línea de JSON por cada trozo de texto y cada herramienta que pide, y la respuesta entera al final.',
      zh: 'assistantRoute（在 Next.js 中为 assistantHandler）检查谁可以提问（allow）以及频率（perMinute），然后把对话连同文档工具发送给 Claude。回答会随 Claude 的生成逐步返回：每段文字和每个工具请求各一行 JSON，最后是完整的回答。',
    },
  ],
  [
    { en: 'The page runs the tools', es: 'La página ejecuta las herramientas', zh: '页面运行工具' },
    {
      en: 'Each tool Claude asks for is run on the editor the person has open, as a step they can undo; in a shared room, the others see it as the person’s own change.',
      es: 'Cada herramienta que pide Claude se ejecuta en el editor que la persona tiene abierto, como un paso que puede deshacer; en una sala compartida, los demás lo ven como un cambio de la propia persona.',
      zh: 'Claude 请求的每个工具都会在用户打开的编辑器上运行，作为可撤销的一步；在共享房间中，其他人看到的是该用户自己的更改。',
    },
  ],
  [
    { en: '…until it is done', es: '…hasta que termina', zh: '……直到完成' },
    {
      en: 'The results go back to Claude in the next step, until it has nothing more to do: 40 steps at most for one question (maxSteps). The conversation lives in the page; the server keeps nothing.',
      es: 'Los resultados vuelven a Claude en el siguiente paso, hasta que no tiene nada más que hacer: 40 pasos como mucho por pregunta (maxSteps). La conversación vive en la página; el servidor no guarda nada.',
      zh: '结果会在下一步交还给 Claude，直到它无事可做：每个问题最多 40 步（maxSteps）。对话保存在页面中；服务器不保存任何内容。',
    },
  ],
];

/**
 * "AI assistants": the three ways an assistant reaches a document, the tools
 * run on a real editor, and every tool as the server tells it to the
 * assistant, read from @rebodocs/mcp when the site is built.
 */
export async function AssistantsPage() {
  const t = getT();
  const tools = toolDocs();
  const [buttonCode, routeCode, chatCode, httpCode] = await Promise.all([
    highlight(
      `// The “AI” button, for a server on the person's machine
<DocsEditor features={{ assistant: true }} />

// …or one on another machine, started with --host and --token
<DocsEditor features={{ assistant: { url: 'http://10.0.0.5:7411', token } }} />`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { assistantHandler, assistantRoute } from '@rebodocs/mcp/claude';

// ANTHROPIC_API_KEY in the environment.
// Next.js: app/api/assistant/route.ts
export const POST = assistantHandler({
  allow: async (request) => !!(await sessionOf(request)),
  key: async (request) => (await sessionOf(request))!.userId,  // perMinute counts per user
  context: async (request) => \`The adviser is \${(await sessionOf(request))!.name}.\`,
});

// A server of Node's own: answers POST /api/assistant.
const assistant = assistantRoute({ allow: (request) => isSignedIn(request) });
http.createServer(async (request, response) => {
  if (await assistant(request, response)) return;
  // …the rest of your server
});`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { createAssistantChat } from '@rebodocs/react';

const chat = createAssistantChat(handle.editor, { onChange: redraw });
await chat.send('Translate the document into English, keeping its format.');

chat.entries;   // what to show: the person, Claude, each tool it used
chat.busy;      // true while it works; chat.stop() ends it after this step`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(HTTP_SETUP, 'bash', LIGHT_THEME),
  ]);
  const writes = tools.filter((tool) => tool.writes).length;

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{t({ en: 'AI assistants', es: 'Asistentes de IA', zh: 'AI 助手' })}</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        <code className="rounded-[5px] bg-hover px-1.5 py-0.5 font-code text-[15px] text-ink">@rebodocs/mcp</code>{' '}
        {t({
          en: (
            <>
              gives an assistant the operations a person has in the editor, as {tools.length + FILE_TOOLS.length} tools of the{' '}
              <a href="https://modelcontextprotocol.io" className={LINK}>
                Model Context Protocol
              </a>
              . “Fill this contract” or “turn this list into a table” is done on the real document, its layout and formatting intact, not on a copy of its text.
            </>
          ),
          es: (
            <>
              le da a un asistente las operaciones que una persona tiene en el editor, como {tools.length + FILE_TOOLS.length} herramientas del{' '}
              <a href="https://modelcontextprotocol.io" className={LINK}>
                Model Context Protocol
              </a>
              . “Llena este contrato” o “convierte esta lista en una tabla” se hace sobre el documento real, con su composición y su formato intactos, no sobre una copia de su texto.
            </>
          ),
          zh: (
            <>
              把用户在编辑器中能做的操作，以 {tools.length + FILE_TOOLS.length} 个{' '}
              <a href="https://modelcontextprotocol.io" className={LINK}>
                Model Context Protocol
              </a>{' '}
              工具的形式提供给 AI 助手。“填写这份合同”或“把这个列表变成表格”都是在真实文档上完成的，排版和格式完好无损，而不是在文字副本上操作。
            </>
          ),
        })}
      </p>
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: be the assistant below, no API key needed', es: 'consejo: sé el asistente abajo, sin clave de API', zh: '提示：在下面扮演 AI 助手，无需 API 密钥' })}</HandTip>
      </div>

      <section aria-labelledby="ways" className="mt-16">
        <SectionHead id="ways" badge={t({ en: 'Start here', es: 'Empieza aquí', zh: '从这里开始' })} color="blue" title={t({ en: 'Which way?', es: '¿Qué camino?', zh: '选择哪种方式？' })}>
          {t({
            en: 'The same tools reach a document three ways. The first two run a server on your machine; the third puts Claude in your own application.',
            es: 'Las mismas herramientas llegan a un documento de tres formas. Las dos primeras ejecutan un servidor en tu máquina; la tercera pone a Claude en tu propia aplicación.',
            zh: '同一套工具可以通过三种方式作用于文档。前两种在你的电脑上运行服务器；第三种把 Claude 放进你自己的应用。',
          })}
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
          {WAYS.map((way) => (
            <div key={way.title.en} className="lift flex flex-col rounded-2xl border border-border p-5">
              <p className="m-0 font-display text-base font-bold tracking-[-0.01em]">{t(way.title)}</p>
              <ol className="m-0 mt-3.5 flex list-none flex-col items-start gap-1 p-0" aria-label={t({ en: 'Who talks to whom', es: 'Quién habla con quién', zh: '谁与谁通信' })}>
                {way.flow.map((step, i) => (
                  <li key={step.en} className="flex flex-col items-start gap-1">
                    {i > 0 && (
                      <span aria-hidden="true" className="pl-3 font-code text-xs leading-none text-muted">
                        ⇅
                      </span>
                    )}
                    <span className={`rounded-lg px-2.5 py-1 font-code text-[12.5px] ${i === 1 ? PASTEL_CLASS[way.color] : 'border border-border bg-surface text-ink-soft'}`}>{t(step)}</span>
                  </li>
                ))}
              </ol>
              <p className="m-0 mt-3.5 flex-1 text-[15px] leading-[1.6] text-ink-soft">{t(way.text)}</p>
              <a href={way.href} className={`mt-3 text-sm ${LINK}`}>
                {t(way.cta)} ↓
              </a>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="try" className="mt-24">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'Be the assistant', es: 'Sé el asistente', zh: '扮演 AI 助手' })}>
          {t({
            en: 'The sample document in the real editor, and the tools an assistant calls, run on it by the same code the server and the chat run. What comes back is word for word what the assistant reads.',
            es: 'El documento de ejemplo en el editor real, y las herramientas que llama un asistente, ejecutadas sobre él por el mismo código que ejecutan el servidor y el chat. Lo que vuelve es palabra por palabra lo que lee el asistente.',
            zh: '真实编辑器中的示例文档，以及 AI 助手调用的工具，由服务器和聊天使用的同一套代码在其上运行。返回的内容与 AI 助手读到的一字不差。',
          })}
        </SectionHead>
        <LazyRunner tools={tools} />
        <p className={prose}>
          {t({
            en: (
              <>
                Paragraphs go by number, as <code className={mono}>read_document</code> shows them, and every tool that changes text answers with what it did: the assistant does not have to read the
                whole document again after each step. A wrong argument comes back as a plain sentence, for it to correct itself. Of the {tools.length} tools of a document, {writes} change it and the
                rest read. The descriptions of the tools are what the server tells an assistant, in English.
              </>
            ),
            es: (
              <>
                Los párrafos van por número, como los muestra <code className={mono}>read_document</code>, y cada herramienta que cambia texto responde con lo que hizo: el asistente no tiene que
                volver a leer todo el documento tras cada paso. Un argumento erróneo vuelve como una frase simple, para que se corrija. De las {tools.length} herramientas de un documento, {writes} lo
                cambian y el resto leen. Las descripciones de las herramientas son lo que el servidor le dice a un asistente, en inglés.
              </>
            ),
            zh: (
              <>
                段落按编号引用，与 <code className={mono}>read_document</code> 显示的一致；每个修改文字的工具都会回答它做了什么：AI
                助手不必在每一步之后重新读取整份文档。错误的参数会以一句普通的话返回，供它自行纠正。在文档的 {tools.length} 个工具中，{writes} 个会修改文档，其余只读。工具说明是服务器告诉 AI
                助手的原文，为英文。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="setup" className="mt-24">
        <SectionHead id="setup" badge={t({ en: 'Your machine', es: 'Tu máquina', zh: '你的电脑' })} color="purple" title={t({ en: 'Set it up', es: 'Configúralo', zh: '配置' })}>
          {t({
            en: 'For the first two ways: the server starts when your assistant does. Choose yours, and copy what it needs.',
            es: 'Para las dos primeras formas: el servidor arranca cuando arranca tu asistente. Elige el tuyo y copia lo que necesita.',
            zh: '适用于前两种方式：服务器会随 AI 助手一起启动。选择你的 AI 助手，复制它需要的配置。',
          })}
        </SectionHead>
        <ConfigBuilder />
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">{t({ en: 'Options of the server', es: 'Opciones del servidor', zh: '服务器选项' })}</h3>
        <dl className="m-0 mt-3 max-w-[860px] rounded-2xl border border-border px-5">
          {OPTIONS.map(([option, text]) => (
            <div key={option} className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="w-[150px] flex-none font-code text-[13.5px] font-semibold text-ink">{option}</dt>
              <dd className="m-0 min-w-0 flex-[1_1_300px] text-[15px] leading-normal text-ink-soft">{t(text)}</dd>
            </div>
          ))}
        </dl>
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">{t({ en: 'Over HTTP', es: 'Por HTTP', zh: '通过 HTTP' })}</h3>
        <p className={prose}>
          {t({
            en: (
              <>
                For a client that connects to a server instead of starting one, or one on another machine: with <code className={mono}>--http</code> the server listens at{' '}
                <code className={mono}>/mcp</code> (the protocol’s Streamable HTTP), and each client has a session of its own, with its own open files. The editors in the browser are the same for all
                of them.
              </>
            ),
            es: (
              <>
                Para un cliente que se conecta a un servidor en lugar de arrancarlo, o uno en otra máquina: con <code className={mono}>--http</code> el servidor escucha en{' '}
                <code className={mono}>/mcp</code> (el Streamable HTTP del protocolo), y cada cliente tiene su propia sesión, con sus propios archivos abiertos. Los editores del navegador son los
                mismos para todos.
              </>
            ),
            zh: (
              <>
                适用于连接到服务器而不是自己启动服务器的客户端，或位于其他机器上的服务器：使用 <code className={mono}>--http</code> 时，服务器在 <code className={mono}>/mcp</code> 监听（协议的
                Streamable HTTP），每个客户端都有自己的会话和自己打开的文件。浏览器中的编辑器对所有客户端都是同一组。
              </>
            ),
          })}
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: httpCode }} />
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">
          {t({ en: 'The button, in your own editor', es: 'El botón, en tu propio editor', zh: '在你自己的编辑器中添加按钮' })}
        </h3>
        <p className={prose}>
          {t({
            en: 'The editor connects only when the person switches “AI” on, and does not remember it between reloads. Each thing the assistant does is one step to undo.',
            es: 'El editor solo se conecta cuando la persona activa “IA”, y no lo recuerda entre recargas. Cada cosa que hace el asistente es un paso para deshacer.',
            zh: '只有用户打开“AI”时编辑器才会连接，并且重新加载后不会记住该设置。AI 助手做的每件事都可一步撤销。',
          })}
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: buttonCode }} />
      </section>

      <section aria-labelledby="safety" className="mt-24">
        <SectionHead
          id="safety"
          badge={t({ en: 'Safety', es: 'Seguridad', zh: '安全' })}
          color="pink"
          title={t({ en: 'What an assistant may touch', es: 'Qué puede tocar un asistente', zh: 'AI 助手可以访问什么' })}
        >
          {t({
            en: 'An assistant does what its tools let it, where the server lets it. These are the limits, and who sets each.',
            es: 'Un asistente hace lo que sus herramientas le permiten, donde el servidor se lo permite. Estos son los límites, y quién pone cada uno.',
            zh: 'AI 助手只能做工具允许的事，且只能在服务器允许的范围内。以下是这些限制，以及分别由谁设置。',
          })}
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
          {SAFETY.map(([title, text]) => (
            <div key={title.en} className="rounded-2xl border border-border p-5">
              <p className="m-0 flex items-center gap-2 font-display text-base font-bold tracking-[-0.01em]">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-none">
                  <path d="M8 1.5l5.5 2v4c0 3.3-2.3 5.9-5.5 7-3.2-1.1-5.5-3.7-5.5-7v-4z" fill="none" stroke="#2E6B3C" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M5.6 8.1l1.7 1.7 3.2-3.4" fill="none" stroke="#2E6B3C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t(title)}
              </p>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{withNames(t(text))}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="tools" className="mt-24">
        <SectionHead id="tools" badge={t({ en: 'Reference', es: 'Referencia', zh: '参考' })} color="orange" title={t({ en: 'Every tool', es: 'Todas las herramientas', zh: '全部工具' })}>
          {t({
            en: (
              <>
                What the server tells the assistant about each, read from the source of <code className={mono}>@rebodocs/mcp</code> when this page was built. “Try it” loads one in the editor above.
              </>
            ),
            es: (
              <>
                Lo que el servidor le dice al asistente de cada una, leído del código de <code className={mono}>@rebodocs/mcp</code> cuando se construyó esta página, en inglés. “Pruébalo” carga una en
                el editor de arriba.
              </>
            ),
            zh: (
              <>
                服务器告诉 AI 助手的每个工具的说明（英文），在构建本页时从 <code className={mono}>@rebodocs/mcp</code> 的源码中读取。“试一试”会把它加载到上面的编辑器中。
              </>
            ),
          })}
        </SectionHead>
        <ToolsReference tools={tools} />
      </section>

      <section aria-labelledby="look" className="mt-24">
        <SectionHead id="look" badge={t({ en: 'Good to know', es: 'Bueno saberlo', zh: '小知识' })} color="pink" title={t({ en: 'Keeping the look', es: 'Conservar el aspecto', zh: '保留格式' })}>
          {t({
            en: (
              <>
                An assistant sees the text by default, not how it looks. <code className={mono}>read_formatting</code> tells it, paragraph by paragraph: style, alignment, indents, spacing, and each
                stretch with its font, size and marks.
              </>
            ),
            es: (
              <>
                Un asistente ve el texto por defecto, no cómo se ve. <code className={mono}>read_formatting</code> se lo dice, párrafo por párrafo: estilo, alineación, sangrías, espaciado, y cada
                tramo con su fuente, tamaño y marcas.
              </>
            ),
            zh: (
              <>
                默认情况下，AI 助手看到的是文字，而不是它的样子。<code className={mono}>read_formatting</code> 会逐段告诉它：样式、对齐、缩进、间距，以及每一段文字的字体、字号和标记。
              </>
            ),
          })}
        </SectionHead>
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
          {[
            [
              'rewrite_paragraph',
              t({
                en: 'Writes a paragraph anew, as in a translation, keeping its alignment, indents and spacing, and the font, size and colour most of its text had. Given in segments, the words that were bold or italic stay so.',
                es: 'Escribe un párrafo de nuevo, como en una traducción, conservando su alineación, sangrías y espaciado, y la fuente, tamaño y color que tenía la mayor parte de su texto. Dado en segmentos, las palabras que estaban en negrita o cursiva siguen así.',
                zh: '重写一个段落（例如翻译），保留其对齐、缩进和间距，以及大部分文字原有的字体、字号和颜色。按片段提供时，原来加粗或倾斜的词仍保持原样。',
              }),
            ],
            [
              'insert_paragraphs',
              t({
                en: 'With like_paragraph, new paragraphs look like one that is there.',
                es: 'Con like_paragraph, los párrafos nuevos se ven como uno que ya está.',
                zh: '使用 like_paragraph 时，新段落的格式与已有的某个段落相同。',
              }),
            ],
            ['replace_text', t({ en: 'Keeps the look of the text it replaces.', es: 'Conserva el aspecto del texto que reemplaza.', zh: '保留被替换文字的格式。' })],
          ].map(([name, text]) => (
            <div key={name} className="lift rounded-2xl border border-border p-5">
              <a href={`#tool-${name}`} className="font-code text-[14px] font-semibold text-ink hover:text-brand">
                {name}
              </a>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          {t({
            en: 'See it in the editor above: “How it looks” reads paragraph 4, “Translate, keeping the bold” writes paragraph 10 in Spanish with its bold and red words still so, and “Add one like it” puts in a bullet that matches the ones around it. The chat in your application tells Claude so before every conversation: read the formatting before rewriting, and change fonts, sizes or spacing only when asked.',
            es: 'Míralo en el editor de arriba: “Cómo se ve” lee el párrafo 4, “Traduce, conservando la negrita” escribe el párrafo 10 en inglés con sus palabras en negrita y en rojo todavía así, y “Añade uno igual” pone una viñeta que coincide con las de alrededor. El chat en tu aplicación se lo dice a Claude antes de cada conversación: leer el formato antes de reescribir, y cambiar fuentes, tamaños o espaciado solo cuando se le pide.',
            zh: '可以在上面的编辑器中查看：“格式”读取第 4 段，“翻译并保留加粗”把第 10 段译成英文，加粗和红色的词仍保持原样，“添加同样格式的段落”会插入一个与周围一致的项目符号。你的应用中的聊天会在每次对话前这样告诉 Claude：改写前先读取格式，只有在被要求时才修改字体、字号或间距。',
          })}
        </p>
      </section>

      <section aria-labelledby="contracts" className="mt-24">
        <SectionHead
          id="contracts"
          badge={t({ en: 'Good to know', es: 'Bueno saberlo', zh: '小知识' })}
          color="blue"
          title={t({ en: 'Working on a contract', es: 'Trabajar en un contrato', zh: '处理合同' })}
        >
          {t({
            en: 'Contracts have numbered clauses, tables of amounts and signatures that must not be cut by a page. These tools are for that, besides reading and writing text.',
            es: 'Los contratos tienen cláusulas numeradas, tablas de importes y firmas que no deben cortarse por una página. Estas herramientas son para eso, además de leer y escribir texto.',
            zh: '合同有编号的条款、金额表格，以及不能被分页截断的签名。除了读写文字之外，这些工具就是为此而设计的。',
          })}
        </SectionHead>
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
          {CONTRACTS.map(([name, text]) => (
            <div key={name} className="lift rounded-2xl border border-border p-5">
              <a href={`#tool-${name}`} className="font-code text-[14px] font-semibold text-ink hover:text-brand">
                {name}
              </a>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{t(text)}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          {t({
            en: '“Several at once” and “How it falls on pages”, in the editor above, run the first and the last of them on the sample document.',
            es: '“Varias a la vez” y “Cómo cae en páginas”, en el editor de arriba, ejecutan la primera y la última de ellas sobre el documento de ejemplo.',
            zh: '上面编辑器中的“一次多项”和“分页情况”会在示例文档上运行其中的第一个和最后一个工具。',
          })}
        </p>
      </section>

      <section aria-labelledby="app" className="mt-24">
        <SectionHead
          id="app"
          badge={t({ en: 'Your application', es: 'Tu aplicación', zh: '你的应用' })}
          color="green"
          title={t({ en: 'In your own application', es: 'En tu propia aplicación', zh: '在你自己的应用中' })}
        >
          {t({
            en: 'The “AI” button reaches a server on the person’s machine. To have Claude in your application, for anyone who uses it, the page talks to your backend, and your backend to the Claude API.',
            es: 'El botón “IA” llega a un servidor en la máquina de la persona. Para tener a Claude en tu aplicación, para cualquiera que la use, la página habla con tu backend, y tu backend con la API de Claude.',
            zh: '“AI”按钮连接的是用户电脑上的服务器。要在你的应用中为所有用户提供 Claude，页面与你的后端通信，你的后端再与 Claude API 通信。',
          })}
        </SectionHead>
        <ol className="m-0 mt-7 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-4 p-0">
          {LOOP.map(([title, text], i) => (
            <li key={title.en} className="rounded-2xl border border-border p-5">
              <span className="grid size-7 place-items-center rounded-full bg-pastel-green font-code text-[13px] font-semibold text-pastel-green-fg">{i + 1}</span>
              <p className="m-0 mt-3 font-display text-base font-bold tracking-[-0.01em]">{t(title)}</p>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{t(text)}</p>
            </li>
          ))}
        </ol>
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">{t({ en: 'On your server', es: 'En tu servidor', zh: '在你的服务器上' })}</h3>
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>npm install @rebodocs/mcp</code>, and a route that takes the conversation to Claude with your key. It asks Claude Opus 5.5 at medium effort unless given another{' '}
                <code className={mono}>model</code> or <code className={mono}>effort</code>, and gives each user 40 steps a minute (<code className={mono}>perMinute</code>). Without{' '}
                <code className={mono}>key</code>, a user is the address the request comes from, which behind a proxy is the same for everyone: give it the user of your session.{' '}
                <code className={mono}>context</code> tells Claude what your application knows, after its instructions. <code className={mono}>toolSearch: true</code> has Claude search for the tools
                of tables, pages and reviewing when it needs one, instead of reading all of them on every step.
              </>
            ),
            es: (
              <>
                <code className={mono}>npm install @rebodocs/mcp</code>, y una ruta que lleva la conversación a Claude con tu clave. Le pregunta a Claude Opus 5.5 con esfuerzo medio salvo que se dé
                otro <code className={mono}>model</code> u <code className={mono}>effort</code>, y le da a cada usuario 40 pasos por minuto (<code className={mono}>perMinute</code>). Sin{' '}
                <code className={mono}>key</code>, un usuario es la dirección de la que viene la petición, que detrás de un proxy es la misma para todos: dale el usuario de tu sesión.{' '}
                <code className={mono}>context</code> le dice a Claude lo que sabe tu aplicación, después de sus instrucciones. <code className={mono}>toolSearch: true</code> hace que Claude busque
                las herramientas de tablas, páginas y revisión cuando necesita una, en lugar de leerlas todas en cada paso.
              </>
            ),
            zh: (
              <>
                <code className={mono}>npm install @rebodocs/mcp</code>，再加一个用你的密钥把对话交给 Claude 的路由。除非指定其他 <code className={mono}>model</code> 或{' '}
                <code className={mono}>effort</code>，它会以中等 effort 调用 Claude Opus 5.5，并给每个用户每分钟 40 个步骤（<code className={mono}>perMinute</code>）。不提供{' '}
                <code className={mono}>key</code> 时，用户按请求来源地址区分，而在代理之后所有人的地址都相同：请传入你会话中的用户。<code className={mono}>context</code> 在指令之后告诉 Claude
                你的应用知道的信息。<code className={mono}>toolSearch: true</code> 让 Claude 在需要时再搜索表格、页面和审阅相关的工具，而不是每一步都读取全部工具。
              </>
            ),
          })}
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: routeCode }} />
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">{t({ en: 'In the page', es: 'En la página', zh: '在页面中' })}</h3>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: chatCode }} />
        <Callout title={t({ en: 'Your key, your bill.', es: 'Tu clave, tu factura.', zh: '你的密钥，你的账单。' })}>
          {t({
            en: (
              <>
                Whoever runs the server pays for what open pages ask. Give <code className={mono}>allow</code> your session check, and keep <code className={mono}>perMinute</code> low. To see it
                working, <code className={mono}>npm run assistant</code> runs{' '}
                <LocalLink href="/docs/demos/#claude-in-the-editor" className={LINK}>
                  the demo
                </LocalLink>
                .
              </>
            ),
            es: (
              <>
                Quien ejecuta el servidor paga lo que piden las páginas abiertas. Dale a <code className={mono}>allow</code> tu comprobación de sesión, y mantén <code className={mono}>perMinute</code>{' '}
                bajo. Para verlo funcionar, <code className={mono}>npm run assistant</code> ejecuta{' '}
                <LocalLink href="/docs/demos/#claude-in-the-editor" className={LINK}>
                  el demo
                </LocalLink>
                .
              </>
            ),
            zh: (
              <>
                运行服务器的人要为打开的页面发出的请求付费。请在 <code className={mono}>allow</code> 中校验会话，并把 <code className={mono}>perMinute</code> 设低一些。想看实际效果，可以运行{' '}
                <code className={mono}>npm run assistant</code> 启动
                <LocalLink href="/docs/demos/#claude-in-the-editor" className={LINK}>
                  演示
                </LocalLink>
                。
              </>
            ),
          })}
        </Callout>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge={t({ en: 'Limits', es: 'Límites', zh: '限制' })} color="yellow" title={t({ en: 'What to know', es: 'Qué saber', zh: '注意事项' })} />
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            t({
              en: 'Paragraph numbers move after an insertion or a deletion. edit_document makes several edits in the numbers of one reading; after it, or after one tool alone, an assistant reads again before using an old number.',
              es: 'Los números de párrafo se mueven tras una inserción o una eliminación. edit_document hace varias ediciones con los números de una sola lectura; después de ella, o de una herramienta sola, un asistente vuelve a leer antes de usar un número viejo.',
              zh: '插入或删除后段落编号会变化。edit_document 用同一次读取的编号完成多项编辑；在它之后，或在单个工具之后，AI 助手需要重新读取才能使用旧编号。',
            }),
            t({
              en: 'Lengths in the tools are in centimetres and points, as people say them; the editor’s own API is in points.',
              es: 'Las longitudes en las herramientas van en centímetros y puntos, como las dice la gente; la API propia del editor va en puntos.',
              zh: '工具中的长度以厘米和磅为单位，与人们的说法一致；编辑器自己的 API 以磅为单位。',
            }),
            t({
              en: 'While changes are tracked, what the tools change is tracked too, signed “Assistant”.',
              es: 'Mientras se controlan los cambios, lo que cambian las herramientas también se controla, firmado “Assistant”.',
              zh: '开启修订期间，工具做出的更改也会记录为修订，署名“Assistant”。',
            }),
            t({
              en: 'A chat in your application cannot insert a picture or a letterhead from a path, or compare with a file: those need the server’s disk.',
              es: 'Un chat en tu aplicación no puede insertar una imagen o un membrete desde una ruta, ni comparar con un archivo: eso necesita el disco del servidor.',
              zh: '你的应用中的聊天无法从路径插入图片或信头，也无法与文件比较：这些需要服务器的磁盘。',
            }),
            t({
              en: 'read_pages says how the text falls on the pages in words; there is no picture of a page for an assistant to look at.',
              es: 'read_pages dice en palabras cómo cae el texto en las páginas; no hay una imagen de una página para que un asistente la mire.',
              zh: 'read_pages 用文字描述文字的分页情况；没有页面图片供 AI 助手查看。',
            }),
            t({
              en: 'A client that cancels a call stops the server waiting for the editor; a change the editor already made stays, as a step to undo.',
              es: 'Un cliente que cancela una llamada hace que el servidor deje de esperar al editor; un cambio que el editor ya hizo se queda, como un paso para deshacer.',
              zh: '客户端取消调用后，服务器不再等待编辑器；编辑器已经做出的更改会保留，可一步撤销。',
            }),
            t({
              en: 'In a shared room, an assistant works through the editor of the person who asked: the others see its changes as that person’s, but not the conversation.',
              es: 'En una sala compartida, un asistente trabaja a través del editor de la persona que preguntó: los demás ven sus cambios como de esa persona, pero no la conversación.',
              zh: '在共享房间中，AI 助手通过提问者的编辑器工作：其他人看到的更改属于该用户，但看不到对话内容。',
            }),
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[15px] leading-[1.55] text-ink-soft">
              <span aria-hidden="true" className="mt-2 size-1.5 flex-none rounded-full bg-[#c9c6bf]" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
