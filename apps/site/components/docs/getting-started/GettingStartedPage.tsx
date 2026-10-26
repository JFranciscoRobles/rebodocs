import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { REPO } from '@/lib/site';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { InstallCommand } from '../InstallCommand';
import { LazyEngineDemo, LazyFirstDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** Every script of the root package.json, by what it is for. */
const COMMANDS: { group: L; color: 'green' | 'blue' | 'purple' | 'orange'; rows: [string, L][] }[] = [
  {
    group: { en: 'Run', es: 'Correr', zh: '运行' },
    color: 'green',
    rows: [
      [
        'npm run dev',
        {
          en: 'The playground: the editor with everything switched on, with hot reload, at localhost:5173.',
          es: 'El playground: el editor con todo encendido, con recarga en caliente, en localhost:5173.',
          zh: 'Playground：开启全部功能的编辑器，支持热重载，地址为 localhost:5173。',
        },
      ],
      [
        'npm run demo',
        {
          en: 'The React package, two ways: the whole component, and an interface of its own on the hooks.',
          es: 'El paquete de React, de dos formas: el componente completo, y una interfaz propia sobre los hooks.',
          zh: 'React 软件包的两种用法：完整组件，以及基于 hooks 的自定义界面。',
        },
      ],
      ['npm run storage', { en: 'Documents in an S3 bucket, with versions.', es: 'Documentos en un bucket S3, con versiones.', zh: 'S3 存储桶中的文档，带版本。' }],
      ['npm run realtime', { en: 'Several people on one document.', es: 'Varias personas en un mismo documento.', zh: '多人编辑同一份文档。' }],
      [
        'npm run assistant',
        {
          en: 'Claude in a shared document; needs a key of the Claude API.',
          es: 'Claude en un documento compartido; necesita una clave de la API de Claude.',
          zh: '共享文档中的 Claude；需要 Claude API 密钥。',
        },
      ],
      [
        'npm run crm',
        {
          en: 'The editor inside a CRM: documents made from a template with the data of a record.',
          es: 'El editor dentro de un CRM: documentos hechos a partir de una plantilla con los datos de un registro.',
          zh: 'CRM 中的编辑器：用某条记录的数据和模板生成文档。',
        },
      ],
      ['npm run desktop', { en: 'The desktop application, with Tauri; needs Rust.', es: 'La aplicación de escritorio, con Tauri; necesita Rust.', zh: '基于 Tauri 的桌面应用；需要 Rust。' }],
      [
        'npm run site',
        {
          en: 'This website, at localhost:5174, after building @rebodocs/react.',
          es: 'Este sitio web, en localhost:5174, después de compilar @rebodocs/react.',
          zh: '本网站，在构建 @rebodocs/react 之后运行于 localhost:5174。',
        },
      ],
    ],
  },
  {
    group: { en: 'Check', es: 'Comprobar', zh: '检查' },
    color: 'blue',
    rows: [
      ['npm test', { en: 'The tests, with Vitest.', es: 'Las pruebas, con Vitest.', zh: '用 Vitest 运行测试。' }],
      [
        'npm run test:browser',
        {
          en: 'The editor itself on a page, in a Chrome without a window: keys, clicks, touches and the clipboard.',
          es: 'El editor en una página, en un Chrome sin ventana: teclas, clics, toques y el portapapeles.',
          zh: '在无窗口的 Chrome 中测试页面上的编辑器：按键、点击、触控和剪贴板。',
        },
      ],
      ['npm run typecheck', { en: 'Types, over every package and every demo.', es: 'Los tipos, en todos los paquetes y todas las demos.', zh: '对所有软件包和演示做类型检查。' }],
      ['npm run lint · format', { en: 'Biome: says what is wrong, or writes it right.', es: 'Biome: dice qué está mal, o lo escribe bien.', zh: 'Biome：指出问题，或直接修正。' }],
      ['npm run coverage', { en: 'The tests, with what of the packages they reach.', es: 'Las pruebas, con qué parte de los paquetes alcanzan.', zh: '运行测试并统计软件包的覆盖率。' }],
      [
        'npm run api -- --check',
        {
          en: 'Whether packages/core/API.md, the public API of the engine as it stands, is out of date; without --check it writes it again.',
          es: 'Si packages/core/API.md, la API pública del motor tal como está, está desactualizado; sin --check lo vuelve a escribir.',
          zh: '检查 packages/core/API.md（引擎当前的公开 API）是否过期；不加 --check 则重新生成。',
        },
      ],
      [
        'npm run a11y -- <url>',
        {
          en: 'axe on pages with the editor in them, in a Chrome without a window: what breaks WCAG 2.2 A and AA.',
          es: 'axe sobre páginas con el editor, en un Chrome sin ventana: lo que incumple WCAG 2.2 A y AA.',
          zh: '在无窗口的 Chrome 中用 axe 检查含编辑器的页面：找出违反 WCAG 2.2 A 和 AA 的地方。',
        },
      ],
      [
        'npm run word-check',
        {
          en: 'The documents of test-documents/ laid out and compared, line by line, with the PDF Word made of each; fails when one is worse than before. Needs Chrome and pdftotext, not Word.',
          es: 'Los documentos de test-documents/ maquetados y comparados, línea por línea, con el PDF que Word hizo de cada uno; falla cuando alguno queda peor que antes. Necesita Chrome y pdftotext, no Word.',
          zh: '对 test-documents/ 中的文档排版，并与 Word 为每份文档导出的 PDF 逐行对比；若有文档比之前更差则失败。需要 Chrome 和 pdftotext，不需要 Word。',
        },
      ],
      [
        'npm run word-compare -- file.docx',
        {
          en: "The editor's layout of a file against Microsoft Word's, line by line; --word has Word make its PDF, on macOS.",
          es: 'La maquetación de un archivo en el editor contra la de Microsoft Word, línea por línea; --word hace que Word genere su PDF, en macOS.',
          zh: '把编辑器对某个文件的排版与 Microsoft Word 逐行对比；在 macOS 上加 --word 可让 Word 生成 PDF。',
        },
      ],
      [
        'npm run float-cases · contract-cases',
        {
          en: 'Writes the documents of test-documents/ that measure floating pictures and long contracts against Word.',
          es: 'Escribe los documentos de test-documents/ que miden imágenes flotantes y contratos largos contra Word.',
          zh: '生成 test-documents/ 中用于与 Word 对照测量浮动图片和长合同的文档。',
        },
      ],
      [
        'npm run bench',
        {
          en: 'How long the engine takes on a long document: layout, DOCX, comparing, PDF. Run it before and after a change.',
          es: 'Cuánto tarda el motor con un documento largo: maquetación, DOCX, comparación, PDF. Córrelo antes y después de un cambio.',
          zh: '测量引擎处理长文档的耗时：排版、DOCX、对比、PDF。在修改前后各运行一次。',
        },
      ],
      [
        'npm run eval:assistant',
        {
          en: 'The assistant beside the editor, on cases of its own, with the real Claude API; needs a key.',
          es: 'El asistente junto al editor, en casos propios, con la API real de Claude; necesita una clave.',
          zh: '用真实的 Claude API 在专门的用例上评估编辑器旁的助手；需要密钥。',
        },
      ],
    ],
  },
  {
    group: { en: 'Tools', es: 'Herramientas', zh: '工具' },
    color: 'purple',
    rows: [
      [
        'npm run generate -- template.docx data.json -o out.pdf',
        {
          en: 'Fills a template without a browser, into a DOCX, a PDF or Markdown; npx -p @rebodocs/mcp rebodocs-generate outside the repository.',
          es: 'Llena una plantilla sin navegador, en un DOCX, un PDF o Markdown; npx -p @rebodocs/mcp rebodocs-generate fuera del repositorio.',
          zh: '不用浏览器填写模板，输出为 DOCX、PDF 或 Markdown；在仓库外使用 npx -p @rebodocs/mcp rebodocs-generate。',
        },
      ],
      [
        'npm run collab',
        {
          en: 'The collaboration server; npx @rebodocs/collab outside the repository.',
          es: 'El servidor de colaboración; npx @rebodocs/collab fuera del repositorio.',
          zh: '协作服务器；在仓库外使用 npx @rebodocs/collab。',
        },
      ],
      [
        'npm run mcp',
        {
          en: 'The MCP server for AI assistants; npx @rebodocs/mcp outside the repository.',
          es: 'El servidor MCP para asistentes de IA; npx @rebodocs/mcp fuera del repositorio.',
          zh: '供 AI 助手使用的 MCP 服务器；在仓库外使用 npx @rebodocs/mcp。',
        },
      ],
      ['npm run locale -- fr texts/fr.json', { en: 'Starts or updates a translation of the interface.', es: 'Empieza o actualiza una traducción de la interfaz.', zh: '开始或更新界面的某种翻译。' }],
    ],
  },
  {
    group: { en: 'Build', es: 'Compilar', zh: '构建' },
    color: 'orange',
    rows: [
      [
        'npm run build:react',
        { en: 'Builds @rebodocs/react and packs it into packages/react.', es: 'Compila @rebodocs/react y lo empaqueta en packages/react.', zh: '构建 @rebodocs/react 并打包到 packages/react。' },
      ],
      [
        'npm run build:packages',
        {
          en: 'Builds core, editor, collab and mcp, each into its dist/; build:mcp only the last.',
          es: 'Compila core, editor, collab y mcp, cada uno en su dist/; build:mcp solo el último.',
          zh: '分别构建 core、editor、collab 和 mcp 到各自的 dist/；build:mcp 只构建最后一个。',
        },
      ],
      ['npm run build:site', { en: 'This website, as static files.', es: 'Este sitio web, como archivos estáticos.', zh: '把本网站构建为静态文件。' }],
      [
        'npm run build · build:demo · build:desktop',
        { en: 'The playground, the React demo and the desktop application.', es: 'El playground, la demo de React y la aplicación de escritorio.', zh: 'Playground、React 演示和桌面应用。' },
      ],
    ],
  },
];

const NEXT: { title: L; href: string; text: L; color: 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'yellow' }[] = [
  {
    title: { en: 'React component', es: 'Componente de React', zh: 'React 组件' },
    href: '/docs/react/',
    text: { en: 'Every prop, the features, the handle, saving.', es: 'Cada prop, las funciones, el handle, guardar.', zh: '每个属性、功能、句柄和保存。' },
    color: 'blue',
  },
  {
    title: { en: 'Headless', es: 'Headless', zh: 'Headless' },
    href: '/docs/headless/',
    text: { en: 'Your own toolbar and panels, with Tailwind.', es: 'Tu propia barra de herramientas y paneles, con Tailwind.', zh: '用 Tailwind 打造你自己的工具栏和面板。' },
    color: 'purple',
  },
  {
    title: { en: 'Templates and variables', es: 'Plantillas y variables', zh: '模板与变量' },
    href: '/docs/templates/',
    text: { en: 'Documents that fill themselves.', es: 'Documentos que se llenan solos.', zh: '自动填写的文档。' },
    color: 'yellow',
  },
  {
    title: { en: 'Real-time collaboration', es: 'Colaboración en tiempo real', zh: '实时协作' },
    href: '/docs/collaboration/',
    text: { en: 'Several people at once.', es: 'Varias personas a la vez.', zh: '多人同时编辑。' },
    color: 'green',
  },
  {
    title: { en: 'AI assistants', es: 'Asistentes de IA', zh: 'AI 助手' },
    href: '/docs/assistants/',
    text: {
      en: 'Claude Desktop on your documents, or Claude in a chat of your application.',
      es: 'Claude Desktop sobre tus documentos, o Claude en un chat de tu aplicación.',
      zh: '让 Claude Desktop 处理你的文档，或在你的应用中通过聊天使用 Claude。',
    },
    color: 'pink',
  },
  {
    title: { en: 'Demos to run', es: 'Demos para correr', zh: '可运行的演示' },
    href: '/docs/demos/',
    text: { en: 'Each capability as a small application of its own.', es: 'Cada capacidad como una pequeña aplicación propia.', zh: '每项功能都是一个独立的小应用。' },
    color: 'orange',
  },
];

/**
 * "Getting started": the first component, running; opening and saving a
 * file; the engine in Node, run here; where to go next; the repository; and
 * every command of it.
 */
export async function GettingStartedPage() {
  const t = getT();
  const [first, open, clone, script, run, generate] = await Promise.all([
    highlight(
      `'use client';
import { DocsEditor } from '@rebodocs/react';

export default function Page() {
  return (
    <div style={{ height: '100vh' }}>
      <DocsEditor name="untitled.docx" locale="en" onSave={(docx, name) => console.log(name, docx.byteLength)} />
    </div>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `'use client';
import { DocsEditor } from '@rebodocs/react';
import { useEffect, useState } from 'react';

export default function Contract() {
  const [file, setFile] = useState<Uint8Array>();

  useEffect(() => {
    fetch('/api/contract')
      .then((response) => response.arrayBuffer())
      .then((bytes) => setFile(new Uint8Array(bytes)));
  }, []);

  if (!file) return <p>Opening…</p>;
  return (
    <div style={{ height: '100vh' }}>
      <DocsEditor
        docx={file}
        name="contract.docx"
        onSave={async (docx) => {
          const response = await fetch('/api/contract', { method: 'PUT', body: docx });
          if (!response.ok) throw new Error(response.statusText);
        }}
      />
    </div>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `git clone ${REPO}.git
cd rebodocs
npm install
npm run dev`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(
      `// fill.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { exportDocx, fillVariables, importDocx, variableNames } from '@rebodocs/core';

const template = importDocx(new Uint8Array(readFileSync('template.docx')));
const doc = fillVariables(template, { client: 'Ana Pérez' });
console.log('Left as they are:', variableNames(doc));
writeFileSync('out.docx', exportDocx(doc));`,
      'js',
      LIGHT_THEME,
    ),
    highlight('node fill.mjs', 'bash', LIGHT_THEME),
    highlight(
      `npx -p @rebodocs/mcp rebodocs-generate template.docx --list
npx -p @rebodocs/mcp rebodocs-generate template.docx data.json -o out.pdf`,
      'bash',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{t({ en: 'Getting started', es: 'Primeros pasos', zh: '快速上手' })}</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({ en: 'Every package is on npm: ', es: 'Todos los paquetes están en npm: ', zh: '所有软件包都已发布到 npm：' })}
        <a href="https://www.npmjs.com/package/@rebodocs/react" className={LINK}>
          @rebodocs/react
        </a>
        {t({
          en: ' for React and Next.js, and the engine, the editor without a framework, collaboration and the tools for an assistant by themselves. ',
          es: ' para React y Next.js, y por separado el motor, el editor sin framework, la colaboración y las herramientas para un asistente. ',
          zh: ' 面向 React 和 Next.js；引擎、无框架编辑器、协作以及助手工具则各自独立。',
        })}
        <LocalLink href="/docs/packages/" className={LINK}>
          {t({ en: 'Packages', es: 'Paquetes', zh: '软件包' })}
        </LocalLink>
        {t({ en: ' says which to take.', es: ' dice cuál tomar.', zh: '一页会告诉你该选哪个。' })}
      </p>
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: the example below is running — save it', es: 'tip: el ejemplo de abajo está corriendo, guárdalo', zh: '提示：下面的示例正在运行，试着保存一下' })}</HandTip>
      </div>

      <section aria-labelledby="put-it-in-a-react-application" className="mt-16">
        <SectionHead id="put-it-in-a-react-application" badge="React" color="blue" title={t({ en: 'Put it in a React application', es: 'Ponlo en una aplicación de React', zh: '放进 React 应用' })}>
          {t({
            en: 'One package, with the engine, the editor and the collaboration client inside. React 18 or later is its peer.',
            es: 'Un solo paquete, con el motor, el editor y el cliente de colaboración dentro. Su peer es React 18 o posterior.',
            zh: '一个软件包，内置引擎、编辑器和协作客户端。peer 依赖为 React 18 或更高版本。',
          })}
        </SectionHead>
        <div className="mt-6 max-w-[760px]">
          <InstallCommand command="npm install @rebodocs/react" />
        </div>
        <p className={prose}>
          {t({
            en: 'Use the component. The element it is in must have a height:',
            es: 'Usa el componente. El elemento que lo contiene debe tener una altura:',
            zh: '使用这个组件。包含它的元素必须有高度：',
          })}
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: first }} />
        <p className={prose}>
          {t({
            en: (
              <>
                That gives an empty document. To open a file, pass its bytes as <code className={mono}>docx</code>. Here it is, as written:
              </>
            ),
            es: (
              <>
                Eso da un documento vacío. Para abrir un archivo, pasa sus bytes como <code className={mono}>docx</code>. Aquí está, tal como está escrito:
              </>
            ),
            zh: (
              <>
                这样会得到一个空白文档。要打开文件，把它的字节作为 <code className={mono}>docx</code> 传入。下面就是照上面代码运行的效果：
              </>
            ),
          })}
        </p>
        <LazyFirstDemo />
        <h3 id="open-and-save" className="m-0 mt-12 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          {t({ en: 'Open a file and save it back', es: 'Abre un archivo y guárdalo', zh: '打开文件并保存回去' })}
        </h3>
        <p className={prose}>
          {t({
            en: (
              <>
                The editor keeps nothing: it is given the bytes, and gives them to <code className={mono}>onSave</code> when the person saves. Where they come from and where they go is your
                application’s:
              </>
            ),
            es: (
              <>
                El editor no guarda nada: recibe los bytes, y se los da a <code className={mono}>onSave</code> cuando la persona guarda. De dónde vienen y a dónde van es cosa de tu aplicación:
              </>
            ),
            zh: (
              <>
                编辑器本身不保存任何东西：它接收字节，并在用户保存时把字节交给 <code className={mono}>onSave</code>。字节从哪里来、到哪里去，由你的应用决定：
              </>
            ),
          })}
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: open }} />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>
            {t({
              en: (
                <>
                  Keep the bytes in state. <code className={mono}>docx</code> is compared as an object: another array, even with the same bytes, is another document, and the editor opens it again and
                  loses what was edited.
                </>
              ),
              es: (
                <>
                  Guarda los bytes en el estado. <code className={mono}>docx</code> se compara como objeto: otro arreglo, aunque tenga los mismos bytes, es otro documento, y el editor lo vuelve a
                  abrir y pierde lo editado.
                </>
              ),
              zh: (
                <>
                  把字节保存在 state 中。<code className={mono}>docx</code> 按对象比较：另一个数组即使字节相同，也会被视为另一份文档，编辑器会重新打开它，已编辑的内容就会丢失。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: (
                <>
                  When <code className={mono}>onSave</code> throws, the person is told the save failed and the document stays unsaved. <code className={mono}>fetch</code> does not throw on an error of
                  the server, hence the check.
                </>
              ),
              es: (
                <>
                  Cuando <code className={mono}>onSave</code> lanza un error, se le avisa a la persona que no se pudo guardar y el documento queda sin guardar. <code className={mono}>fetch</code> no
                  lanza un error cuando falla el servidor, de ahí la comprobación.
                </>
              ),
              zh: (
                <>
                  当 <code className={mono}>onSave</code> 抛出错误时，用户会看到保存失败的提示，文档保持未保存状态。服务器出错时 <code className={mono}>fetch</code> 并不会抛出错误，所以需要自己检查。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: 'On a server it renders an empty element, and mounts in the browser. Every prop is in ',
              es: 'En un servidor renderiza un elemento vacío, y se monta en el navegador. Cada prop está en ',
              zh: '在服务器上它只渲染一个空元素，在浏览器中才会挂载。全部属性见',
            })}
            <LocalLink href="/docs/react/" className={LINK}>
              {t({ en: 'React component', es: 'Componente de React', zh: 'React 组件' })}
            </LocalLink>
            {t({ en: '.', es: '.', zh: '。' })}
          </li>
          <li>
            {t({
              en: (
                <>
                  Without <code className={mono}>locale</code>, the interface is in the first of the browser’s languages it speaks, or in English.
                </>
              ),
              es: (
                <>
                  Sin <code className={mono}>locale</code>, la interfaz está en el primero de los idiomas del navegador que habla, o en inglés.
                </>
              ),
              zh: (
                <>
                  不指定 <code className={mono}>locale</code> 时，界面会使用浏览器语言中第一个它支持的语言，否则使用英文。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: (
                <>
                  No React? The same package has the whole editor without it: <code className={mono}>import {'{ mountDocs }'} from &apos;@rebodocs/react/mount&apos;</code>, and npm does not install
                  React for it, as it is an optional peer. See{' '}
                </>
              ),
              es: (
                <>
                  ¿Sin React? El mismo paquete tiene el editor completo sin él: <code className={mono}>import {'{ mountDocs }'} from &apos;@rebodocs/react/mount&apos;</code>, y npm no instala React
                  para eso, porque es un peer opcional. Ve{' '}
                </>
              ),
              zh: (
                <>
                  不用 React？同一个软件包也提供不依赖 React 的完整编辑器：<code className={mono}>import {'{ mountDocs }'} from &apos;@rebodocs/react/mount&apos;</code>，由于 React 是可选的 peer
                  依赖，npm 不会为此安装 React。参见
                </>
              ),
            })}
            <LocalLink href="/docs/vanilla/" className={LINK}>
              {t({ en: 'Without a framework', es: 'Sin framework', zh: '不用框架' })}
            </LocalLink>
            {t({ en: '.', es: '.', zh: '。' })}
          </li>
        </ul>
      </section>

      <section aria-labelledby="use-the-engine-in-node" className="mt-24">
        <SectionHead id="use-the-engine-in-node" badge="Node" color="purple" title={t({ en: 'Use the engine in Node', es: 'Usa el motor en Node', zh: '在 Node 中使用引擎' })}>
          {t({
            en: 'To fill templates or make PDFs on a server, with no browser and no editor: the engine is a package of its own.',
            es: 'Para llenar plantillas o hacer PDF en un servidor, sin navegador y sin editor: el motor es un paquete propio.',
            zh: '要在服务器上填写模板或生成 PDF，无需浏览器和编辑器：引擎是一个独立的软件包。',
          })}
        </SectionHead>
        <div className="mt-6 max-w-[760px]">
          <InstallCommand command="npm install @rebodocs/core" />
        </div>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: script }} />
        <div className={`mt-2 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: run }} />
        <p className={prose}>
          {t({
            en: 'The engine is the same in the browser, so here is that script, run on the agreement of the demo:',
            es: 'El motor es el mismo en el navegador, así que aquí está ese script, ejecutado sobre el contrato de la demo:',
            zh: '浏览器中的引擎与 Node 中的完全相同，所以下面就是在演示协议上运行这段脚本的结果：',
          })}
        </p>
        <LazyEngineDemo />
        <p className={prose}>
          {t({
            en: (
              <>
                A variable without a value stays as it is written. Dates and amounts are written in the language of the document, or in English when it says none, unless{' '}
                <code className={mono}>locale</code> says another.
              </>
            ),
            es: (
              <>
                Una variable sin valor se queda tal como está escrita. Las fechas y los importes se escriben en el idioma del documento, o en inglés cuando no dice ninguno, salvo que{' '}
                <code className={mono}>locale</code> diga otro.
              </>
            ),
            zh: (
              <>
                没有值的变量保持原样。日期和金额按文档的语言书写；文档未指定语言时使用英文，除非 <code className={mono}>locale</code> 指定了其他语言。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                Or, with no code, the command that comes with <code className={mono}>@rebodocs/mcp</code>: it lists the variables of a template, fills it from a JSON file into a DOCX, a PDF or
                Markdown, and says what it left.
              </>
            ),
            es: (
              <>
                O, sin código, el comando que viene con <code className={mono}>@rebodocs/mcp</code>: lista las variables de una plantilla, la llena desde un archivo JSON en un DOCX, un PDF o Markdown,
                y dice qué dejó sin llenar.
              </>
            ),
            zh: (
              <>
                或者不写代码，使用 <code className={mono}>@rebodocs/mcp</code> 自带的命令：它可以列出模板中的变量，用 JSON 文件填写并输出为 DOCX、PDF 或 Markdown，并告诉你哪些没有填。
              </>
            ),
          })}
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: generate }} />
        <p className={prose}>
          {t({ en: 'A PDF, its fonts, and the rest are in ', es: 'Un PDF, sus fuentes y lo demás están en ', zh: 'PDF、字体及其他内容请见' })}
          <LocalLink href="/docs/server/" className={LINK}>
            {t({ en: 'On a server', es: 'En un servidor', zh: '在服务器上' })}
          </LocalLink>
          {t({ en: '.', es: '.', zh: '。' })}
        </p>
      </section>

      <section aria-labelledby="where-to-go-next" className="mt-24">
        <SectionHead id="where-to-go-next" badge={t({ en: 'Next', es: 'Después', zh: '下一步' })} color="yellow" title={t({ en: 'Where to go next', es: 'A dónde ir después', zh: '接下来去哪里' })} />
        <div className="mt-6 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))' }}>
          {NEXT.map((card) => (
            <LocalLink key={card.href} href={card.href} className="block rounded-2xl border border-border p-5 no-underline transition-colors hover:bg-hover">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{t(card.title)}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{t(card.text)}</p>
            </LocalLink>
          ))}
        </div>
      </section>

      <section aria-labelledby="run-the-repository" className="mt-24">
        <SectionHead
          id="run-the-repository"
          badge={t({ en: 'Repository', es: 'Repositorio', zh: '仓库' })}
          color="green"
          title={t({ en: 'Run the repository', es: 'Corre el repositorio', zh: '运行仓库' })}
        >
          {t({
            en: 'To try everything, to change the code, or to run the demos. It needs Node 22.12 or later.',
            es: 'Para probarlo todo, cambiar el código o correr las demos. Necesita Node 22.12 o posterior.',
            zh: '用于试用全部功能、修改代码或运行演示。需要 Node 22.12 或更高版本。',
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: clone }} />
        <p className={prose}>
          {t({
            en: (
              <>
                Open <code className={mono}>http://localhost:5173</code>. That is the playground: the editor with everything switched on. Open a Word file from the menu and edit it.
              </>
            ),
            es: (
              <>
                Abre <code className={mono}>http://localhost:5173</code>. Ese es el playground: el editor con todo encendido. Abre un archivo de Word desde el menú y edítalo.
              </>
            ),
            zh: (
              <>
                打开 <code className={mono}>http://localhost:5173</code>。这就是 playground：开启了全部功能的编辑器。从菜单打开一个 Word 文件并编辑它。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                Inside the repository the packages import each other as TypeScript source, with no build: a script of your own runs with <code className={mono}>npx vite-node</code>.
              </>
            ),
            es: (
              <>
                Dentro del repositorio los paquetes se importan entre sí como código fuente de TypeScript, sin compilar: un script tuyo corre con <code className={mono}>npx vite-node</code>.
              </>
            ),
            zh: (
              <>
                在仓库内部，各软件包直接以 TypeScript 源码互相导入，无需构建：你自己的脚本可以用 <code className={mono}>npx vite-node</code> 运行。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="commands" className="mt-24">
        <SectionHead id="commands" badge={t({ en: 'Commands', es: 'Comandos', zh: '命令' })} color="orange" title={t({ en: 'Commands', es: 'Comandos', zh: '命令' })}>
          {t({ en: 'Every script of the repository, from its root.', es: 'Cada script del repositorio, desde su raíz.', zh: '仓库中的全部脚本，均在根目录下运行。' })}
        </SectionHead>
        {COMMANDS.map((group) => (
          <div key={group.group.en} className="mt-6 max-w-[920px]">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[group.color]}`}>{t(group.group)}</span>
            <dl className="m-0 mt-2.5 rounded-2xl border border-border px-5">
              {group.rows.map(([command, text]) => (
                <div key={command} className="grid gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))' }}>
                  <dt className="font-code text-[13.5px] font-semibold text-ink [overflow-wrap:anywhere]">{command}</dt>
                  <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(text)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>
    </>
  );
}
