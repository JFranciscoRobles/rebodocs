import type { ReactNode } from 'react';
import { LocalLink } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import type { T } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { REPO } from '@/lib/site';
import { LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { InstallCommand } from '../InstallCommand';
import { TryHere } from './TryHere';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

type Pastel = 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'yellow';

interface Demo {
  id: string;
  title: string;
  color: Pastel;
  app: string;
  command: string;
  /** Where it opens, from the port of its vite.config.ts. */
  at?: string;
  /** What it needs before it runs. */
  needs: string;
  /** Whether it runs with nothing set up. */
  ready: boolean;
  short: string;
  intro: ReactNode;
  points: [string, ReactNode][];
  after?: ReactNode;
}

const NOTHING = { en: 'Nothing', es: 'Nada', zh: '无' };

/** The demos, in the language of the page. */
const demos = (t: T): Demo[] => [
  {
    id: 'the-react-package',
    title: t({ en: 'The React package', es: 'El paquete de React', zh: 'React 软件包' }),
    color: 'blue',
    app: 'apps/demo',
    command: 'npm run demo',
    at: 'http://localhost:5175',
    needs: t(NOTHING),
    ready: true,
    short: t({
      en: 'The editor as it comes, and an interface built from nothing on the hooks.',
      es: 'El editor tal como viene, y una interfaz construida desde cero sobre los hooks.',
      zh: '开箱即用的编辑器，以及基于 hooks 从零构建的界面。',
    }),
    intro: t({
      en: 'The same agreement in two tabs. On this site it is at /demo, which takes the whole window.',
      es: 'El mismo contrato en dos pestañas. En este sitio está en /demo, que ocupa toda la ventana.',
      zh: '同一份协议，分两个标签页展示。在本网站上它位于 /demo，占满整个窗口。',
    }),
    points: [
      [
        t({ en: 'The included one.', es: 'La incluida.', zh: '自带的界面。' }),
        t({ en: 'DocsEditor: the whole editor in a dozen lines.', es: 'DocsEditor: el editor completo en una docena de líneas.', zh: 'DocsEditor：十几行代码就是一个完整的编辑器。' }),
      ],
      [
        t({ en: 'Your own interface.', es: 'Tu propia interfaz.', zh: '你自己的界面。' }),
        t({
          en: 'A toolbar, a rail, panels, a find bar, a ruler and a status bar built on DocsProvider, DocsSurface and the hooks. It does everything the first does.',
          es: 'Una barra de herramientas, un riel, paneles, una barra de búsqueda, una regla y una barra de estado construidos sobre DocsProvider, DocsSurface y los hooks. Hace todo lo que hace la primera.',
          zh: '基于 DocsProvider、DocsSurface 和 hooks 构建的工具栏、侧边栏、面板、查找栏、标尺和状态栏。第一个界面能做的，它都能做。',
        }),
      ],
      [
        t({ en: 'Two languages.', es: 'Dos idiomas.', zh: '两种语言。' }),
        t({
          en: (
            <>
              It opens in English; the selector in its status bar puts both the library and the demo’s own labels in Spanish. Those are in <code className={mono}>src/headless/texts.ts</code>, which
              follows the language of the editor.
            </>
          ),
          es: (
            <>
              Abre en inglés; el selector de su barra de estado pone en español tanto la biblioteca como las etiquetas propias de la demo. Esas están en{' '}
              <code className={mono}>src/headless/texts.ts</code>, que sigue el idioma del editor.
            </>
          ),
          zh: (
            <>
              默认以英文打开；状态栏中的语言选择器会把库和演示自身的标签都切换为西班牙文。演示自身的标签位于 <code className={mono}>src/headless/texts.ts</code>，会跟随编辑器的语言。
            </>
          ),
        }),
      ],
      [
        t({ en: 'No backend.', es: 'Sin backend.', zh: '无后端。' }),
        t({ en: 'Saving hands the file back as a download.', es: 'Al guardar, devuelve el archivo como descarga.', zh: '保存时以下载的方式返回文件。' }),
      ],
    ],
    after: (
      <>
        <TryHere />
        <p className={prose}>
          <LocalLink href="/docs/example/" className={LINK}>
            {t({ en: 'A complete interface', es: 'Una interfaz completa', zh: '一套完整的界面' })}
          </LocalLink>
          {t({ en: ' walks through it, piece by piece.', es: ' la recorre, pieza por pieza.', zh: '一页会逐个部件地讲解它。' })}
        </p>
      </>
    ),
  },
  {
    id: 'an-s3-bucket',
    title: t({ en: 'An S3 bucket', es: 'Un bucket S3', zh: 'S3 存储桶' }),
    color: 'yellow',
    app: 'apps/storage',
    command: 'npm run storage',
    at: 'http://localhost:5176',
    needs: t({ en: 'A bucket and its keys in apps/storage/.env', es: 'Un bucket y sus claves en apps/storage/.env', zh: '在 apps/storage/.env 中配置存储桶及其密钥' }),
    ready: false,
    short: t({
      en: 'Documents kept in Cloudflare R2, AWS S3 or MinIO: open, save, versions, and a PDF made on the server.',
      es: 'Documentos guardados en Cloudflare R2, AWS S3 o MinIO: abrir, guardar, versiones, y un PDF hecho en el servidor.',
      zh: '保存在 Cloudflare R2、AWS S3 或 MinIO 中的文档：打开、保存、版本，以及在服务器上生成的 PDF。',
    }),
    intro: t({
      en: 'The port is part of the origin the bucket is told to let in, so it is always 5176.',
      es: 'El puerto es parte del origen al que se le dice al bucket que deje entrar, así que siempre es 5176.',
      zh: '端口是存储桶允许访问的来源的一部分，因此固定为 5176。',
    }),
    points: [
      [t({ en: 'The list.', es: 'La lista.', zh: '文件列表。' }), t({ en: 'The .docx and .pdf in the bucket.', es: 'Los .docx y .pdf del bucket.', zh: '存储桶中的 .docx 和 .pdf。' })],
      [
        t({ en: 'Signed addresses.', es: 'Direcciones firmadas.', zh: '签名地址。' }),
        t({
          en: 'Opening and saving with addresses signed for a few minutes: the browser reads from and writes to the bucket itself, and never has a key.',
          es: 'Abrir y guardar con direcciones firmadas por unos minutos: el navegador lee y escribe directamente en el bucket, y nunca tiene una clave.',
          zh: '打开和保存使用有效期几分钟的签名地址：浏览器直接读写存储桶，始终不接触密钥。',
        }),
      ],
      [
        t({ en: 'Versions.', es: 'Versiones.', zh: '版本。' }),
        t({
          en: 'One kept with each save, under versions/; the side panel compares the document with one and goes back to it.',
          es: 'Se guarda una con cada guardado, en versions/; el panel lateral compara el documento con una y regresa a ella.',
          zh: '每次保存都会在 versions/ 下保留一个版本；侧边栏可以把文档与某个版本对比，并还原到该版本。',
        }),
      ],
      [
        t({ en: 'PDF on the server.', es: 'PDF en el servidor.', zh: '服务器端 PDF。' }),
        t({
          en: 'The server fills the variables of a template, lays it out with font files and stores the PDF beside it.',
          es: 'El servidor llena las variables de una plantilla, la maqueta con archivos de fuentes y guarda el PDF junto a ella.',
          zh: '服务器填写模板中的变量，用字体文件排版，并把 PDF 存放在模板旁边。',
        }),
      ],
    ],
    after: (
      <p className={prose}>
        <LocalLink href="/docs/storage/" className={LINK}>
          {t({ en: 'Documents in an S3 bucket', es: 'Documentos en un bucket S3', zh: 'S3 存储桶中的文档' })}
        </LocalLink>
        {t({
          en: ' has every step for Cloudflare R2, what changes for another S3, and the code to copy.',
          es: ' tiene cada paso para Cloudflare R2, qué cambia para otro S3, y el código para copiar.',
          zh: '一页包含 Cloudflare R2 的每个步骤、换成其他 S3 时需要改什么，以及可直接复制的代码。',
        })}
      </p>
    ),
  },
  {
    id: 'real-time',
    title: t({ en: 'Real time', es: 'Tiempo real', zh: '实时' }),
    color: 'green',
    app: 'apps/realtime',
    command: 'npm run realtime',
    at: 'http://localhost:5177',
    needs: t(NOTHING),
    ready: true,
    short: t({
      en: 'Several people on one document at once, through a backend of your own.',
      es: 'Varias personas en un mismo documento a la vez, a través de un backend propio.',
      zh: '通过你自己的后端，让多人同时编辑同一份文档。',
    }),
    intro: t({
      en: 'The documents are kept in a folder, or in a bucket when its .env names one. The collaboration server starts with it, on port 7421.',
      es: 'Los documentos se guardan en una carpeta, o en un bucket cuando su .env nombra uno. El servidor de colaboración arranca con ella, en el puerto 7421.',
      zh: '文档保存在一个文件夹中；如果 .env 指定了存储桶，则保存在存储桶中。协作服务器随之启动，端口为 7421。',
    }),
    points: [
      [
        t({ en: 'Every document is a room.', es: 'Cada documento es una sala.', zh: '每份文档就是一个房间。' }),
        t({ en: 'There is no other way to open one.', es: 'No hay otra forma de abrirlo.', zh: '这是打开文档的唯一方式。' }),
      ],
      [
        t({ en: 'A room is there only while someone is in it.', es: 'Una sala existe solo mientras alguien está en ella.', zh: '房间只在有人时存在。' }),
        t({
          en: 'It opens when the first person comes in; a moment after the last one leaves, the document is saved and the room let go of. The list says which rooms are open, and who is in each.',
          es: 'Se abre cuando entra la primera persona; un momento después de que sale la última, el documento se guarda y la sala se libera. La lista dice qué salas están abiertas, y quién está en cada una.',
          zh: '第一个人进入时房间打开；最后一个人离开片刻后，文档被保存，房间随之释放。列表会显示哪些房间是打开的，以及每个房间里有谁。',
        }),
      ],
      [
        t({ en: 'The collaboration server keeps nothing.', es: 'El servidor de colaboración no guarda nada.', zh: '协作服务器不保存任何东西。' }),
        t({
          en: 'A backend gives it the document, takes it back, and says who may come in, with a signed ticket for each person.',
          es: 'Un backend le da el documento, lo recibe de vuelta, y dice quién puede entrar, con un ticket firmado para cada persona.',
          zh: '由后端把文档交给它、再把文档取回，并通过为每个人签发的票据决定谁可以进入。',
        }),
      ],
      [
        t({ en: 'A version of each session.', es: 'Una versión de cada sesión.', zh: '每次会话一个版本。' }),
        t({
          en: 'When everybody has left a document they changed, the backend keeps a version, signed by who changed it. The Versions tab lists them, compares, goes back to one, and keeps one by hand.',
          es: 'Cuando todos salen de un documento que cambiaron, el backend guarda una versión, firmada por quien lo cambió. La pestaña Versiones las lista, compara, regresa a una, y guarda una a mano.',
          zh: '当所有人都离开一份被修改过的文档后，后端会保存一个版本，并署上修改者的名字。“版本”标签页可以列出、对比、还原版本，也可以手动保存一个版本。',
        }),
      ],
    ],
    after: (
      <p className={prose}>
        {t({
          en: (
            <>
              Open a document, press <strong className="font-semibold text-ink">Copy link</strong> and open the link in another window.{' '}
            </>
          ),
          es: (
            <>
              Abre un documento, pulsa <strong className="font-semibold text-ink">Copy link</strong> y abre el enlace en otra ventana.{' '}
            </>
          ),
          zh: (
            <>
              打开一份文档，点击 <strong className="font-semibold text-ink">Copy link</strong>，然后在另一个窗口中打开该链接。
            </>
          ),
        })}
        <LocalLink href="/docs/collaboration/#a-demo-to-run" className={LINK}>
          {t({ en: 'Real-time collaboration', es: 'Colaboración en tiempo real', zh: '实时协作' })}
        </LocalLink>
        {t({ en: ' explains each part.', es: ' explica cada parte.', zh: '一页解释了每个部分。' })}
      </p>
    ),
  },
  {
    id: 'claude-in-the-editor',
    title: t({ en: 'Claude in the editor', es: 'Claude en el editor', zh: '编辑器中的 Claude' }),
    color: 'pink',
    app: 'apps/assistant',
    command: 'npm run assistant',
    at: 'http://localhost:5179',
    needs: t({ en: 'A key of the Claude API in apps/assistant/.env', es: 'Una clave de la API de Claude en apps/assistant/.env', zh: '在 apps/assistant/.env 中配置 Claude API 密钥' }),
    ready: false,
    short: t({
      en: 'A chat beside a shared document that reads and changes it, keeping its look.',
      es: 'Un chat junto a un documento compartido que lo lee y lo cambia, conservando su aspecto.',
      zh: '共享文档旁的聊天，可以读取和修改文档，并保持原有外观。',
    }),
    intro: t({
      en: 'The real-time demo with a chat beside the document. The documents are kept in a folder, or in a bucket as in the storage demo.',
      es: 'La demo de tiempo real con un chat junto al documento. Los documentos se guardan en una carpeta, o en un bucket como en la demo de almacenamiento.',
      zh: '在实时演示的基础上，在文档旁加了一个聊天。文档保存在文件夹中，或像存储演示那样保存在存储桶中。',
    }),
    points: [
      [
        t({ en: 'Ask for something to be done.', es: 'Pide que se haga algo.', zh: '提出你的要求。' }),
        t({
          en: '“Translate it into English keeping the format”, “put the obligations in two columns”, “make the table repeat its heading row”. Claude reads the document, does it with the same tools the MCP server has, and says what it did.',
          es: '“Tradúcelo al inglés conservando el formato”, “pon las obligaciones en dos columnas”, “haz que la tabla repita su fila de encabezado”. Claude lee el documento, lo hace con las mismas herramientas que tiene el servidor MCP, y dice qué hizo.',
          zh: '“保持格式翻译成英文”“把义务条款排成两栏”“让表格重复标题行”。Claude 会读取文档，用与 MCP 服务器相同的工具完成任务，并说明它做了什么。',
        }),
      ],
      [
        t({ en: 'What it does is yours.', es: 'Lo que hace es tuyo.', zh: '它做的修改归你所有。' }),
        t({
          en: 'Each change is a step to undo and, in a room, the others see it happen.',
          es: 'Cada cambio es un paso que se puede deshacer y, en una sala, los demás lo ven pasar.',
          zh: '每处修改都可以撤销；在房间中，其他人会实时看到修改发生。',
        }),
      ],
      [
        t({ en: 'The key stays on the server.', es: 'La clave se queda en el servidor.', zh: '密钥留在服务器上。' }),
        t({
          en: 'The page sends the conversation to its backend, which takes it to the Claude API; the tools run in the page.',
          es: 'La página manda la conversación a su backend, que la lleva a la API de Claude; las herramientas corren en la página.',
          zh: '页面把对话发送到它的后端，再由后端转发给 Claude API；工具在页面中运行。',
        }),
      ],
    ],
    after: (
      <p className={prose}>
        <LocalLink href="/docs/assistants/#app" className={LINK}>
          {t({ en: 'AI assistants', es: 'Asistentes de IA', zh: 'AI 助手' })}
        </LocalLink>
        {t({ en: ' has the code to put it in an application.', es: ' tiene el código para ponerlo en una aplicación.', zh: '一页提供了把它放进应用的代码。' })}
      </p>
    ),
  },
  {
    id: 'inside-a-crm',
    title: t({ en: 'Inside a CRM', es: 'Dentro de un CRM', zh: '在 CRM 中' }),
    color: 'orange',
    app: 'apps/crm',
    command: 'npm run crm',
    at: 'http://localhost:5180',
    needs: t({ en: 'Nothing; a key of the Claude API for its assistant', es: 'Nada; una clave de la API de Claude para su asistente', zh: '无；如需使用助手，需要 Claude API 密钥' }),
    ready: true,
    short: t({
      en: 'A contract made from a template with the data of a record, edited in its page, saved on its own, with versions, review and an assistant.',
      es: 'Un contrato hecho a partir de una plantilla con los datos de un registro, editado en su página, guardado solo, con versiones, revisión y un asistente.',
      zh: '用某条记录的数据和模板生成合同，在记录页面中编辑，自动保存，带版本、审阅和助手。',
    }),
    intro: t({
      en: 'A made-up real-estate CRM, in Spanish, where the documents never leave the page of their property.',
      es: 'Un CRM inmobiliario inventado, en español, donde los documentos nunca salen de la página de su inmueble.',
      zh: '一个虚构的西班牙语房地产 CRM，文档始终留在所属房产的页面中。',
    }),
    points: [
      [
        t({ en: 'From the record to the contract.', es: 'Del registro al contrato.', zh: '从记录到合同。' }),
        t({
          en: 'Documentos → Generar contrato de mediación fills a template with the record’s data, in Spanish, and opens it in the page as its first version.',
          es: 'Documentos → Generar contrato de mediación llena una plantilla con los datos del registro, en español, y la abre en la página como su primera versión.',
          zh: '“Documentos → Generar contrato de mediación”会用记录的数据填写西班牙语模板，并在页面中打开，作为它的第一个版本。',
        }),
      ],
      [
        t({ en: 'Saved on its own.', es: 'Se guarda solo.', zh: '自动保存。' }),
        t({
          en: 'A moment after each change; the bar says when. Leaving the document keeps a version, signed by who worked on it.',
          es: 'Un momento después de cada cambio; la barra dice cuándo. Al salir del documento se guarda una versión, firmada por quien trabajó en él.',
          zh: '每次修改片刻后自动保存，状态栏会显示保存时间。离开文档时会保存一个版本，并署上编辑者的名字。',
        }),
      ],
      [
        t({ en: 'Review.', es: 'Revisión.', zh: '审阅。' }),
        t({
          en: 'Switch “Trabajas como”, at the top, to Luis Mena · Jurídico and turn on tracked changes: what they change stays marked with their name.',
          es: 'Cambia “Trabajas como”, arriba, a Luis Mena · Jurídico y activa el control de cambios: lo que cambie queda marcado con su nombre.',
          zh: '把顶部的“Trabajas como”切换为 Luis Mena · Jurídico 并开启修订：他修改的内容会标记上他的名字。',
        }),
      ],
      [
        t({ en: 'The assistant', es: 'El asistente', zh: '助手' }),
        t({
          en: 'beside the document, as in the demo above, without the rooms.',
          es: 'junto al documento, como en la demo de arriba, sin las salas.',
          zh: '位于文档旁，与上面的演示相同，只是没有房间。',
        }),
      ],
    ],
    after: (
      <p className={prose}>
        {t({
          en: (
            <>
              The documents are kept in the browser, in IndexedDB: in a CRM of your own, <code className={mono}>src/store.ts</code> is the file that becomes calls to your backend. Its README says what
              to change.
            </>
          ),
          es: (
            <>
              Los documentos se guardan en el navegador, en IndexedDB: en un CRM propio, <code className={mono}>src/store.ts</code> es el archivo que se convierte en llamadas a tu backend. Su README
              dice qué cambiar.
            </>
          ),
          zh: (
            <>
              文档保存在浏览器的 IndexedDB 中：在你自己的 CRM 里，<code className={mono}>src/store.ts</code> 就是要改为调用你后端的那个文件。它的 README 说明了需要修改什么。
            </>
          ),
        })}
      </p>
    ),
  },
  {
    id: 'only-to-read',
    title: t({ en: 'Only to read', es: 'Solo para leer', zh: '只读' }),
    color: 'yellow',
    app: 'apps/viewer',
    command: 'npm run viewer',
    at: 'http://localhost:5181',
    needs: t(NOTHING),
    ready: true,
    short: t({
      en: 'A shelf of documents with the first page of each as a thumbnail, and each one opened in the viewer.',
      es: 'Un estante de documentos con la primera página de cada uno como miniatura, y cada uno abierto en el visor.',
      zh: '一个文档书架，以每份文档的首页作为缩略图，点击即可在查看器中打开。',
    }),
    intro: t({
      en: '@rebodocs/viewer, the package for an application that shows documents and does not edit them.',
      es: '@rebodocs/viewer, el paquete para una aplicación que muestra documentos y no los edita.',
      zh: '@rebodocs/viewer：面向只展示、不编辑文档的应用的软件包。',
    }),
    points: [
      [
        t({ en: 'A shelf.', es: 'Un estante.', zh: '书架。' }),
        t({
          en: 'Four documents to start with, three of them saved by Word, each with its first page made into a picture in the page by pagePicture. Open .docx adds more.',
          es: 'Cuatro documentos para empezar, tres de ellos guardados por Word, cada uno con su primera página convertida en imagen en la página por pagePicture. Open .docx agrega más.',
          zh: '初始有四份文档，其中三份由 Word 保存；每份文档的首页都由 pagePicture 在页面中转换成图片。点击 Open .docx 可以添加更多。',
        }),
      ],
      [
        t({ en: 'A reader.', es: 'Un lector.', zh: '阅读器。' }),
        t({
          en: 'One of them in DocsViewer: one page under another or all at once, and printed.',
          es: 'Uno de ellos en DocsViewer: una página debajo de otra o todas a la vez, e impreso.',
          zh: '在 DocsViewer 中打开其中一份：逐页向下排列或一次显示全部，也可以打印。',
        }),
      ],
      [
        t({ en: 'On a phone.', es: 'En un teléfono.', zh: '在手机上。' }),
        t({
          en: 'Its server listens on the network: open it at the address of your computer.',
          es: 'Su servidor escucha en la red: ábrelo en la dirección de tu computadora.',
          zh: '它的服务器监听局域网：用你电脑的地址在手机上打开。',
        }),
      ],
      [t({ en: 'No backend.', es: 'Sin backend.', zh: '无后端。' }), t({ en: 'Nothing leaves the page.', es: 'Nada sale de la página.', zh: '所有内容都不会离开页面。' })],
    ],
    after: (
      <p className={prose}>
        <LocalLink href="/docs/viewer/" className={LINK}>
          {t({ en: 'A document only to read', es: 'Un documento solo para leer', zh: '只读文档' })}
        </LocalLink>
        {t({ en: ' is its page here.', es: ' es su página aquí.', zh: '是它在本网站上的页面。' })}
      </p>
    ),
  },
  {
    id: 'the-desktop',
    title: t({ en: 'The desktop', es: 'El escritorio', zh: '桌面应用' }),
    color: 'purple',
    app: 'apps/desktop',
    command: 'npm run desktop',
    needs: t({
      en: 'Rust, from rustup.rs; the first run compiles for a few minutes',
      es: 'Rust, de rustup.rs; la primera vez compila durante unos minutos',
      zh: 'Rust（从 rustup.rs 安装）；首次运行需要编译几分钟',
    }),
    ready: false,
    short: t({
      en: 'A desktop application with Tauri: .docx files of the disk, a native menu, PDF.',
      es: 'Una aplicación de escritorio con Tauri: archivos .docx del disco, un menú nativo, PDF.',
      zh: '基于 Tauri 的桌面应用：读写磁盘上的 .docx、原生菜单、PDF。',
    }),
    intro: (
      <>
        {t({ en: 'A window of its own, made with ', es: 'Una ventana propia, hecha con ', zh: '一个独立的窗口，使用 ' })}
        <a href="https://tauri.app" className={LINK}>
          Tauri
        </a>
        {t({ en: '.', es: '.', zh: ' 构建。' })}
      </>
    ),
    points: [
      [
        t({ en: 'Each window is a document,', es: 'Cada ventana es un documento,', zh: '每个窗口就是一份文档，' }),
        t({
          en: 'a .docx file of the disk. Open, Save and Save as use the dialogs of the system, and closing a window with changes asks first.',
          es: 'un archivo .docx del disco. Abrir, Guardar y Guardar como usan los diálogos del sistema, y cerrar una ventana con cambios pregunta primero.',
          zh: '即磁盘上的一个 .docx 文件。打开、保存和另存为都使用系统对话框，关闭有未保存修改的窗口时会先询问。',
        }),
      ],
      [
        t({ en: 'A native menu:', es: 'Un menú nativo:', zh: '原生菜单：' }),
        t({
          en: 'File, Edit, View, with the usual keys. Edit has Paste as text.',
          es: 'Archivo, Edición, Ver, con las teclas de siempre. Edición tiene Pegar como texto.',
          zh: '文件、编辑、视图，使用常用快捷键。“编辑”中有“粘贴为纯文本”。',
        }),
      ],
      [
        t({ en: 'Export as PDF', es: 'Exportar como PDF', zh: '导出为 PDF' }),
        t({
          en: 'to a file of the disk, and the other exports of the side menu.',
          es: 'a un archivo del disco, y las demás exportaciones del menú lateral.',
          zh: '到磁盘上的文件，以及侧边菜单中的其他导出方式。',
        }),
      ],
      [
        t({ en: 'Documents from the system:', es: 'Documentos del sistema:', zh: '来自系统的文档：' }),
        t({
          en: 'dropped on the window, or opened with a double click in the Finder or the Explorer once the application is built (npm run build:desktop).',
          es: 'soltados sobre la ventana, o abiertos con doble clic en el Finder o el Explorador una vez compilada la aplicación (npm run build:desktop).',
          zh: '拖放到窗口上；或者在构建应用后（npm run build:desktop），在访达或资源管理器中双击打开。',
        }),
      ],
    ],
    after: (
      <p className={prose}>
        {t({
          en: (
            <>
              The pages are the editor without a framework, as in the playground; what Rust adds is small, in <code className={mono}>src-tauri/src/lib.rs</code>: reading and writing files, a window
              per document, and the documents the system asks to open.
            </>
          ),
          es: (
            <>
              Las páginas son el editor sin framework, como en el playground; lo que agrega Rust es poco, en <code className={mono}>src-tauri/src/lib.rs</code>: leer y escribir archivos, una ventana
              por documento, y los documentos que el sistema pide abrir.
            </>
          ),
          zh: (
            <>
              页面就是不依赖框架的编辑器，与 playground 相同；Rust 只添加了很少的代码，位于 <code className={mono}>src-tauri/src/lib.rs</code>：读写文件、每份文档一个窗口，以及打开系统请求打开的文档。
            </>
          ),
        })}
      </p>
    ),
  },
  {
    id: 'the-playground',
    title: t({ en: 'The playground', es: 'El playground', zh: 'Playground' }),
    color: 'green',
    app: 'apps/playground',
    command: 'npm run dev',
    at: 'http://localhost:5173',
    needs: t(NOTHING),
    ready: true,
    short: t({ en: 'Everything wired together without a framework.', es: 'Todo conectado sin framework.', zh: '不用框架，把一切连接起来。' }),
    intro: t({ en: 'The page every package is tried in while it is written.', es: 'La página donde se prueba cada paquete mientras se escribe.', zh: '开发每个软件包时用来试用它的页面。' }),
    points: [
      [
        t({ en: 'No framework.', es: 'Sin framework.', zh: '不用框架。' }),
        t({ en: 'The editor and every piece around it, wired by hand.', es: 'El editor y cada pieza a su alrededor, conectados a mano.', zh: '编辑器及其周围的每个部件，都是手动连接的。' }),
      ],
      [
        t({ en: 'Share.', es: 'Compartir.', zh: '共享。' }),
        t({
          en: 'Collaboration started from the Share button in the status bar, on the collaboration server of this machine (npm run collab).',
          es: 'La colaboración se inicia con el botón Compartir de la barra de estado, en el servidor de colaboración de esta máquina (npm run collab).',
          zh: '点击状态栏中的“共享”按钮即可开始协作，使用本机的协作服务器（npm run collab）。',
        }),
      ],
      [
        t({ en: 'An assistant.', es: 'Un asistente.', zh: '助手。' }),
        t({
          en: 'The MCP server reaches the document open in it (npm run mcp).',
          es: 'El servidor MCP llega al documento abierto en él (npm run mcp).',
          zh: 'MCP 服务器可以访问其中打开的文档（npm run mcp）。',
        }),
      ],
    ],
    after: (
      <p className={prose}>
        {t({
          en: (
            <>
              Its <code className={mono}>src/main.ts</code> is the shortest example of everything wired together. See{' '}
            </>
          ),
          es: (
            <>
              Su <code className={mono}>src/main.ts</code> es el ejemplo más corto de todo conectado. Ve{' '}
            </>
          ),
          zh: (
            <>
              它的 <code className={mono}>src/main.ts</code> 是把一切连接起来的最短示例。参见
            </>
          ),
        })}
        <LocalLink href="/docs/vanilla/" className={LINK}>
          {t({ en: 'Without a framework', es: 'Sin framework', zh: '不用框架' })}
        </LocalLink>
        {t({ en: '.', es: '.', zh: '。' })}
      </p>
    ),
  },
];

/**
 * "Demos to run": the eight applications of the repository, at a glance with
 * what each needs, the React one running in a frame, each in its section,
 * and what they have in common.
 */
export async function DemosPage() {
  const t = getT();
  const DEMOS = demos(t);
  const caption = 'text-[13px] font-semibold uppercase tracking-[0.04em] text-muted';
  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{t({ en: 'Demos to run', es: 'Demos para correr', zh: '可运行的演示' })}</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: 'Eight applications in the repository use the packages the way yours would. Each is small, and is there to be read and copied from.',
          es: 'Ocho aplicaciones del repositorio usan los paquetes como lo haría la tuya. Cada una es pequeña, y está ahí para leerla y copiar de ella.',
          zh: '仓库中有八个应用，以你的应用会采用的方式使用这些软件包。每个应用都很小，可以阅读和借鉴。',
        })}
      </p>
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: the first one opens right here', es: 'tip: la primera se abre aquí mismo', zh: '提示：第一个可以直接在这里打开' })}</HandTip>
      </div>

      <section aria-label={t({ en: 'The demos at a glance', es: 'Las demos de un vistazo', zh: '演示一览' })}>
        <div className="mt-8 max-w-[920px]">
          <InstallCommand command={`git clone ${REPO} && cd rebodocs && npm install`} />
        </div>

        <div
          className="mt-8 grid gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))',
          }}
        >
          {DEMOS.map((demo) => (
            <a key={demo.id} href={`#${demo.id}`} className="flex flex-col rounded-2xl border border-border p-5 no-underline transition-colors hover:bg-hover">
              <span className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[demo.color]}`}>{demo.title}</span>
              <span className="mt-2.5 text-[15px] leading-[1.55] text-ink-soft">{demo.short}</span>
              <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3.5">
                <code className="font-code text-[13px] font-semibold text-ink">{demo.command}</code>
                <span className={`text-[12.5px] font-semibold ${demo.ready ? 'text-[#2f7a4a]' : 'text-muted'}`}>
                  {demo.ready ? t({ en: 'Nothing to set up', es: 'Nada que configurar', zh: '无需配置' }) : t({ en: 'Needs setup', es: 'Requiere configuración', zh: '需要配置' })}
                </span>
              </span>
            </a>
          ))}
        </div>
      </section>

      {DEMOS.map((demo, i) => (
        <section key={demo.id} aria-labelledby={demo.id} className={i ? 'mt-24' : 'mt-20'}>
          <SectionHead id={demo.id} badge={demo.app} color={demo.color} title={demo.title}>
            {demo.intro}
          </SectionHead>
          <dl className="m-0 mt-6 grid max-w-[920px] gap-x-6 gap-y-2 rounded-2xl border border-border bg-surface px-5 py-4 sm:grid-cols-[110px_1fr]">
            <dt className={caption}>{t({ en: 'Run it', es: 'Córrela', zh: '运行' })}</dt>
            <dd className="m-0 font-code text-[13.5px] font-semibold text-ink">{demo.command}</dd>
            {demo.at && (
              <>
                <dt className={caption}>{t({ en: 'Opens at', es: 'Abre en', zh: '地址' })}</dt>
                <dd className="m-0 font-code text-[13.5px] text-ink-soft">{demo.at}</dd>
              </>
            )}
            <dt className={caption}>{t({ en: 'Needs', es: 'Necesita', zh: '需要' })}</dt>
            <dd className="m-0 text-[15px] text-ink-soft">{demo.needs}</dd>
          </dl>
          <ul className="m-0 mt-5 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
            {demo.points.map(([lead, text]) => (
              <li key={lead}>
                <strong className="font-semibold text-ink">{lead}</strong> {text}
              </li>
            ))}
          </ul>
          {demo.after}
        </section>
      ))}

      <section aria-labelledby="what-they-have-in-common" className="mt-24">
        <SectionHead
          id="what-they-have-in-common"
          badge={t({ en: 'All of them', es: 'Todas', zh: '全部' })}
          color="yellow"
          title={t({ en: 'What they have in common', es: 'Qué tienen en común', zh: '共同点' })}
        />
        <div
          className="mt-6 grid max-w-[920px] gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))',
          }}
        >
          {[
            {
              title: t({ en: 'From their source', es: 'Desde su código fuente', zh: '直接使用源码' }),
              text: t({
                en: 'They take the packages from their source, so a change in a package shows at once. Copied into a project that installs @rebodocs/react from npm, they work without the alias in vite.config.ts.',
                es: 'Toman los paquetes de su código fuente, así que un cambio en un paquete se ve de inmediato. Copiadas a un proyecto que instala @rebodocs/react desde npm, funcionan sin el alias de vite.config.ts.',
                zh: '它们直接引用软件包的源码，因此软件包的改动会立即生效。复制到从 npm 安装 @rebodocs/react 的项目中时，去掉 vite.config.ts 中的别名即可使用。',
              }),
              color: 'blue' as const,
            },
            {
              title: t({ en: 'For your machine', es: 'Para tu máquina', zh: '仅供本机使用' }),
              text: t({
                en: 'The ones with a backend check nobody: where an application decides who may do what is marked in their code. The ones with Claude spend from your API key, a few steps a minute for each address.',
                es: 'Las que tienen backend no comprueban a nadie: dónde una aplicación decide quién puede hacer qué está marcado en su código. Las que usan Claude gastan de tu clave de API, unos pocos pasos por minuto por cada dirección.',
                zh: '带后端的演示不做任何身份校验：应用应在哪里决定谁能做什么，已在代码中标注。使用 Claude 的演示会消耗你的 API 密钥额度，每个地址每分钟限几步。',
              }),
              color: 'orange' as const,
            },
            {
              title: t({ en: 'A README each', es: 'Un README cada una', zh: '各有 README' }),
              text: t({
                en: 'Each says what is where, and where it can improve.',
                es: 'Cada uno dice qué está dónde, y dónde se puede mejorar.',
                zh: '每个都说明了各部分在哪里，以及可以改进的地方。',
              }),
              color: 'green' as const,
            },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
