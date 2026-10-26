import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight, loadPart } from '@/lib/docs';
import type { L } from '@/lib/i18n';
import { getT, pageLocale } from '@/lib/locale';
import { REPO } from '@/lib/site';
import { CAPTION, CODE, LINK } from '../styles';
import { Callout, HandTip, SectionHead } from '../ui';
import { Conflicts, LazyRoom } from './Conflicts';
import { LOG_ROUTES, OPTIONS, ROUTES } from './data';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const h3 = 'm-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]';

/** The files of apps/realtime, and what each holds. */
const DEMO_FILES: [path: string, what: L][] = [
  [
    'server/collab.ts',
    {
      en: 'The three routes, the log of each room as it comes, the tickets, the name of a room.',
      es: 'Las tres rutas, el registro de cada sala a medida que llega, los tickets, el nombre de una sala.',
      zh: '三个路由、每个房间的实时日志、票据、房间名称。',
    },
  ],
  [
    'server/api.ts',
    { en: 'What the page asks: the documents, a new one, a ticket.', es: 'Lo que pide la página: los documentos, uno nuevo, un ticket.', zh: '页面的请求：文档列表、新建文档、票据。' },
  ],
  [
    'server/store.ts',
    { en: 'Where the documents are kept: a folder, or an S3 bucket.', es: 'Dónde se guardan los documentos: una carpeta, o un bucket de S3.', zh: '文档的存放位置：文件夹或 S3 存储桶。' },
  ],
  ['server/versions.ts', { en: 'A version for each session of work.', es: 'Una versión por cada sesión de trabajo.', zh: '每次工作会话一个版本。' }],
  ['src/App.tsx', { en: 'The page.', es: 'La página.', zh: '页面。' }],
];

/** Who holds what: the parts, left to right. */
function Parts() {
  const t = getT();
  const box = 'rounded-xl border border-border bg-white px-4 py-3';
  const arrow = (
    <span className="self-center px-1 font-code text-lg text-muted" aria-hidden="true">
      ⇄
    </span>
  );
  return (
    <div
      className="mt-8 flex flex-wrap items-stretch gap-2 rounded-[18px] border border-border bg-surface p-5"
      role="figure"
      aria-label={t({
        en: 'The browsers talk to the collaboration server, which talks to your backend',
        es: 'Los navegadores hablan con el servidor de colaboración, que habla con tu backend',
        zh: '浏览器与协作服务器通信，协作服务器再与你的后端通信',
      })}
    >
      <div className="flex min-w-[150px] flex-[1_1_150px] flex-col gap-2">
        <p className={CAPTION}>{t({ en: 'The people', es: 'Las personas', zh: '用户' })}</p>
        {['Ana', 'Luis', 'Eva']
          .map((who) => t({ en: `${who}’s browser`, es: `Navegador de ${who}`, zh: `${who} 的浏览器` }))
          .map((name) => (
            <div key={name} className={`${box} font-code text-[13px] text-ink-soft`}>
              {name}
            </div>
          ))}
      </div>
      {arrow}
      <div className="flex min-w-[200px] flex-[1.2_1_200px] flex-col gap-2">
        <p className={CAPTION}>{t({ en: 'Collaboration server', es: 'Servidor de colaboración', zh: '协作服务器' })}</p>
        <div className={`${box} flex-1 border-[#bfd3f7] bg-pastel-blue`}>
          <p className="m-0 font-semibold text-pastel-blue-fg">{t({ en: 'Rooms, in memory', es: 'Salas, en memoria', zh: '房间（内存中）' })}</p>
          <p className="m-0 mt-1 text-sm leading-normal text-ink-soft">
            {t({
              en: 'One per document while someone is in it. Puts everybody’s changes in one order, and forgets the room when it empties.',
              es: 'Una por documento mientras alguien está en él. Pone los cambios de todos en un mismo orden, y olvida la sala cuando se vacía.',
              zh: '有人编辑时每份文档一个房间。把所有人的更改排成同一顺序，房间清空后就释放。',
            })}
          </p>
        </div>
      </div>
      {arrow}
      <div className="flex min-w-[220px] flex-[1.3_1_220px] flex-col gap-2">
        <p className={CAPTION}>{t({ en: 'Your backend', es: 'Tu backend', zh: '你的后端' })}</p>
        <div className={`${box} flex-1`}>
          {ROUTES.map(([route]) => (
            <p key={route} className="m-0 font-code text-[12.5px] leading-[1.9] text-ink">
              {route}
            </p>
          ))}
          <p className="m-0 mt-1.5 text-sm leading-normal text-ink-soft">
            {t({
              en: 'Keeps the files and says who may come in: S3, R2, a disk, a database.',
              es: 'Guarda los archivos y dice quién puede entrar: S3, R2, un disco, una base de datos.',
              zh: '保存文件并决定谁可以进入：S3、R2、磁盘或数据库。',
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * "Real-time collaboration": two editors in one room on the page, the cases
 * of two people changing the same thing set up in them, the three steps to
 * set it up, and how it works inside.
 */
export async function CollaborationPage() {
  const t = getT();
  const [inside, server, runCode, serverCode, nextCode, accessCode, versionCode, ticketCode, logCode, recheckCode, routingCode] = await Promise.all([
    loadPart('collaboration-inside', pageLocale()),
    loadPart('collaboration-server', pageLocale()),
    highlight(
      `git clone https://github.com/JFranciscoRobles/rebodocs && cd rebodocs && npm install
npm run realtime          # http://localhost:5177`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(
      `REBODOCS_COLLAB_BACKEND_KEY=a-long-secret \\
  npx @rebodocs/collab --host 0.0.0.0 --backend https://api.example.com/docs`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(
      `// app/api/docs/[id]/route.ts
const allowed = (request: Request) => request.headers.get('authorization') === \`Bearer \${process.env.REBODOCS_COLLAB_BACKEND_KEY}\`;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  const file = await storage.get(\`docs/\${(await params).id}.docx\`);
  return file ? new Response(file) : new Response(null, { status: 404 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  await storage.put(\`docs/\${(await params).id}.docx\`, await request.arrayBuffer());
  return new Response(null, { status: 204 });
}`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `// app/api/docs/[id]/access/route.ts
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  const { ticket } = await request.json();
  const user = await verifyTicket(ticket, (await params).id);    // your own signed, short-lived token
  return user ? Response.json({ name: user.name }) : new Response(null, { status: 403 });
}`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  const id = (await params).id;
  const docx = new Uint8Array(await request.arrayBuffer());
  await storage.put(\`docs/\${id}.docx\`, docx);
  if (request.headers.get('x-rebodocs-session-end') === '1') {
    const authors = (request.headers.get('x-rebodocs-authors') ?? '').split(',').filter(Boolean).map(decodeURIComponent);
    await storage.put(\`versions/\${id}/\${Date.now()}.docx\`, docx, { authors });
  }
  return new Response(null, { status: 204 });
}`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(`<DocsEditor collab={{ url: 'https://collab.example.com', room: documentId, ticket }} />`, 'tsx', LIGHT_THEME),
    highlight(
      `// app/api/docs/[id]/changes/route.ts — with --backend-log: lines of text, kept as they come
const logOf = async (params: Promise<{ id: string }>) => \`logs/\${(await params).id}.jsonl\`;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  await storage.put(await logOf(params), await request.text());          // a log starts
  return new Response(null, { status: 204 });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  const key = await logOf(params);
  const log = (await storage.getText(key)) ?? '';
  // Optional: none went missing in between.
  if (Number(request.headers.get('x-rebodocs-from')) !== log.split('\\n').filter(Boolean).length - 1) return new Response(null, { status: 409 });
  await storage.put(key, log + (await request.text()));                 // more lines, after those
  return new Response(null, { status: 204 });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  const log = await storage.getText(await logOf(params));
  return log ? new Response(log) : new Response(null, { status: 404 });
}

// And in PUT /docs/<id>: the session ended, so the document is the whole of it.
if (request.headers.get('x-rebodocs-session-end') === '1') await storage.delete(\`logs/\${id}.jsonl\`);`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `// Your backend, when it takes someone's access away or changes it
await fetch(\`https://collab.example.com/collab/rooms/\${documentId}/recheck\`, {
  method: 'POST',
  headers: { Authorization: \`Bearer \${process.env.REBODOCS_COLLAB_BACKEND_KEY}\` },
});`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `# nginx: each room to one process, by the id in its address
map $uri $room { ~^/collab/rooms/([^/]+) $1; default $uri; }

upstream collab {
  hash $room consistent;
  server 10.0.0.11:7420;
  server 10.0.0.12:7420;
}

server {
  location /collab/ {
    proxy_pass http://collab;
    proxy_http_version 1.1;
    proxy_buffering off;        # the stream of events
    proxy_read_timeout 1h;
  }
}`,
      'nginx',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {t({ en: 'Real-time collaboration', es: 'Colaboración en tiempo real', zh: '实时协作' })}
      </h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: 'Several people on the same document at once, each seeing where the others are, with an undo of their own. The collaboration server only coordinates; your backend keeps the files and decides who may open them.',
          es: 'Varias personas en el mismo documento a la vez, cada una viendo dónde están las demás, con su propio deshacer. El servidor de colaboración solo coordina; tu backend guarda los archivos y decide quién puede abrirlos.',
          zh: '多人同时编辑同一份文档，每个人都能看到其他人的位置，并拥有自己的撤销记录。协作服务器只负责协调；文件由你的后端保存，并由它决定谁可以打开。',
        })}
      </p>
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: hold the network below, and type in both', es: 'consejo: retén la red de abajo y escribe en los dos', zh: '提示：暂停下面的网络，然后在两边都输入' })}</HandTip>
      </div>
      <Parts />

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'Two people, one room', es: 'Dos personas, una sala', zh: '两个人，一个房间' })}>
          {t({
            en: (
              <>
                Ana and Luis in two real editors on this page. The changes travel in the format of <code className={mono}>@rebodocs/collab</code> and are put in order by its own{' '}
                <code className={mono}>transform</code>; only the network between them is this page’s, held in memory so you can stop it and choose who arrives first.
              </>
            ),
            es: (
              <>
                Ana y Luis en dos editores reales en esta página. Los cambios viajan en el formato de <code className={mono}>@rebodocs/collab</code> y los ordena su propio{' '}
                <code className={mono}>transform</code>; solo la red entre ellos es de esta página, en memoria para que puedas detenerla y elegir quién llega primero.
              </>
            ),
            zh: (
              <>
                本页上两个真实的编辑器中分别是 Ana 和 Luis。更改以 <code className={mono}>@rebodocs/collab</code> 的格式传输，并由它自己的 <code className={mono}>transform</code>{' '}
                排序；只有两者之间的网络是本页模拟的，保存在内存中，你可以暂停它并选择谁先到达。
              </>
            ),
          })}
        </SectionHead>
        <LazyRoom />
        <p className={prose}>
          {t({
            en: 'Hold the network, type in both at the same place, then let one through first and the other after: the log shows the server moving the second change over the first, and the badge checks that all three documents are the same, with the digest the real server sends.',
            es: 'Retén la red, escribe en los dos en el mismo lugar, y luego deja pasar uno primero y el otro después: el registro muestra al servidor moviendo el segundo cambio sobre el primero, y la insignia comprueba que los tres documentos son iguales, con el digest que envía el servidor real.',
            zh: '暂停网络，在两边的同一位置输入，然后先放行一方，再放行另一方：日志会显示服务器针对第一个更改转换第二个更改，徽标会用真实服务器发送的 digest 核对三份文档是否一致。',
          })}
        </p>
      </section>

      <section aria-labelledby="when-two-people-change-the-same-thing" className="mt-24">
        <SectionHead
          id="when-two-people-change-the-same-thing"
          badge={t({ en: 'The rules', es: 'Las reglas', zh: '规则' })}
          color="purple"
          title={t({ en: 'When two people change the same thing', es: 'Cuando dos personas cambian lo mismo', zh: '两人同时修改同一处时' })}
        >
          {t({
            en: 'What everybody ends with, whichever order the server takes the two changes in. The ones marked “Try it” are set up in the editors above.',
            es: 'Con qué termina cada uno, sea cual sea el orden en que el servidor toma los dos cambios. Los marcados con “Pruébalo” se preparan en los editores de arriba.',
            zh: '无论服务器以什么顺序接收两个更改，所有人最终得到的结果。标有“试一试”的案例可以在上面的编辑器中演示。',
          })}
        </SectionHead>
        <Conflicts />
        <p className={prose}>
          {t({
            en: (
              <>
                These rules have unit tests for pairs of concurrent changes, and tests with two clients typing through a real server. <code className={mono}>test/convergence.test.ts</code> makes two
                people edit at random — typing, deleting across paragraphs, Enter, bold, alignment — from 3,000 seeds, with one edit each and with up to three, and checks that both end with the same
                document whichever way round the server takes them. They all do. With more seeds and more edits a few still do not (6 in 20,000 with three edits each): both people cut, join and take
                out paragraphs around the same place at the same instant. Tables are not in the random edits, and concurrent changes to the structure of the same table are the weakest part.
              </>
            ),
            es: (
              <>
                Estas reglas tienen pruebas unitarias para pares de cambios concurrentes, y pruebas con dos clientes escribiendo a través de un servidor real.{' '}
                <code className={mono}>test/convergence.test.ts</code> hace que dos personas editen al azar —escribir, borrar a través de párrafos, Intro, negrita, alineación— con 3.000 semillas, con
                una edición cada una y con hasta tres, y comprueba que ambas terminan con el mismo documento sea cual sea el orden en que el servidor las tome. Todas lo hacen. Con más semillas y más
                ediciones unas pocas todavía no (6 de 20.000 con tres ediciones cada una): las dos personas cortan, unen y quitan párrafos en torno al mismo lugar en el mismo instante. Las tablas no
                están en las ediciones al azar, y los cambios concurrentes a la estructura de la misma tabla son la parte más débil.
              </>
            ),
            zh: (
              <>
                这些规则有针对成对并发更改的单元测试，也有两个客户端通过真实服务器输入的测试。<code className={mono}>test/convergence.test.ts</code>{' '}
                让两个人随机编辑——输入、跨段删除、Enter、加粗、对齐——使用 3,000
                个随机种子，每人一次编辑以及最多三次编辑，并检查无论服务器以哪种顺序接收，两人最终的文档都相同。全部通过。种子和编辑次数更多时，仍有少数未通过（每人三次编辑时 20,000 次中有 6
                次）：两人在同一时刻于同一位置附近拆分、合并和删除段落。随机编辑中不包括表格，同一表格结构的并发更改是最薄弱的部分。
              </>
            ),
          })}
        </p>
        <Callout title={t({ en: 'Whatever the rules get wrong lasts seconds.', es: 'Lo que las reglas hagan mal dura segundos.', zh: '规则出错也只会持续几秒。' })}>
          {t({
            en: (
              <>
                A moment after the changes stop, the server tells the room a digest of its document. An editor whose document differs loads the room again, keeping what the person had typed and not
                sent; what they can undo starts over. See{' '}
                <a href="#inside" className={LINK}>
                  how it works inside
                </a>
                .
              </>
            ),
            es: (
              <>
                Un momento después de que paran los cambios, el servidor le dice a la sala un digest de su documento. Un editor cuyo documento difiere vuelve a cargar la sala, conservando lo que la
                persona había escrito y no enviado; lo que puede deshacer empieza de nuevo. Mira{' '}
                <a href="#inside" className={LINK}>
                  cómo funciona por dentro
                </a>
                .
              </>
            ),
            zh: (
              <>
                更改停止片刻后，服务器会把文档的 digest 告诉房间。文档不一致的编辑器会重新加载房间，并保留用户已输入但尚未发送的内容；可撤销的历史重新开始。参见
                <a href="#inside" className={LINK}>
                  内部原理
                </a>
                。
              </>
            ),
          })}
        </Callout>
      </section>

      <section aria-labelledby="a-demo-to-run" className="mt-24">
        <SectionHead
          id="a-demo-to-run"
          badge={t({ en: 'Start here', es: 'Empieza aquí', zh: '从这里开始' })}
          color="blue"
          title={t({ en: 'A demo to run', es: 'Un demo para ejecutar', zh: '可运行的演示' })}
        >
          <a href={`${REPO}/tree/main/apps/realtime`} className={LINK}>
            apps/realtime
          </a>{' '}
          {t({
            en: 'is all of this page working: the collaboration server, a backend with the three routes and signed tickets, and the page. Nothing to set up.',
            es: 'es todo lo de esta página funcionando: el servidor de colaboración, un backend con las tres rutas y tickets firmados, y la página. Nada que configurar.',
            zh: '就是本页内容的完整可运行版本：协作服务器、带三个路由和签名票据的后端，以及页面。无需任何配置。',
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: runCode }} />
        <p className={prose}>
          {t({
            en: (
              <>
                Every document is a room. Open <code className={mono}>contract.docx</code>, press <strong>Copy link</strong> and open the link in another window, or another browser; give each a name
                in <strong>You are</strong>. A room opens with the document the backend has, gives it back every 10 seconds while someone types, and once more a moment after the last one leaves. The
                demo starts the collaboration server in its own process, on port 7421, and reaches the backend as it would from anywhere: over HTTP, with the key. With the names of a bucket in{' '}
                <code className={mono}>apps/realtime/.env</code> the documents go to S3 instead of a folder, with no other change.{' '}
                <LocalLink href="/docs/demos/#claude-in-the-editor" className={LINK}>
                  apps/assistant
                </LocalLink>{' '}
                is the same demo with Claude in a chat beside the document.
              </>
            ),
            es: (
              <>
                Cada documento es una sala. Abre <code className={mono}>contract.docx</code>, pulsa <strong>Copy link</strong> y abre el enlace en otra ventana, u otro navegador; dale a cada uno un
                nombre en <strong>You are</strong>. Una sala se abre con el documento que tiene el backend, se lo devuelve cada 10 segundos mientras alguien escribe, y una vez más un momento después
                de que sale el último. El demo arranca el servidor de colaboración en su propio proceso, en el puerto 7421, y llega al backend como lo haría desde cualquier lugar: por HTTP, con la
                clave. Con los nombres de un bucket en <code className={mono}>apps/realtime/.env</code> los documentos van a S3 en lugar de a una carpeta, sin otro cambio.{' '}
                <LocalLink href="/docs/demos/#claude-in-the-editor" className={LINK}>
                  apps/assistant
                </LocalLink>{' '}
                es el mismo demo con Claude en un chat junto al documento.
              </>
            ),
            zh: (
              <>
                每份文档都是一个房间。打开 <code className={mono}>contract.docx</code>，点击 <strong>Copy link</strong>，然后在另一个窗口或另一个浏览器中打开该链接；在 <strong>You are</strong>{' '}
                中给每个人起个名字。房间打开时使用后端中的文档，有人输入时每 10 秒交还一次，最后一人离开片刻后再交还一次。演示在独立进程中于 7421 端口启动协作服务器，并像从任何地方一样访问后端：通过
                HTTP，带上密钥。在 <code className={mono}>apps/realtime/.env</code> 中填入存储桶名称后，文档就会存到 S3 而不是文件夹，无需其他改动。
                <LocalLink href="/docs/demos/#claude-in-the-editor" className={LINK}>
                  apps/assistant
                </LocalLink>{' '}
                是同一个演示，只是在文档旁多了一个与 Claude 对话的窗口。
              </>
            ),
          })}
        </p>
        <dl className="m-0 mt-5 max-w-[860px] rounded-2xl border border-border px-5">
          {DEMO_FILES.map(([path, what]) => (
            <div key={path} className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="w-[170px] flex-none">
                <a href={`${REPO}/blob/main/apps/realtime/${path}`} className="font-code text-[13.5px] text-brand hover:text-brand-hover">
                  {path}
                </a>
              </dt>
              <dd className="m-0 min-w-0 flex-[1_1_300px] text-[15px] leading-normal text-ink-soft">{t(what)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="setup" className="mt-24">
        <SectionHead
          id="setup"
          badge={t({ en: 'Your system', es: 'Tu sistema', zh: '你的系统' })}
          color="orange"
          title={t({ en: 'Set it up in three steps', es: 'Configúralo en tres pasos', zh: '三步完成配置' })}
        >
          {t({
            en: 'The server, three routes in your backend, and a ticket for each person. No storage credentials reach the browser, and none reach the collaboration server.',
            es: 'El servidor, tres rutas en tu backend y un ticket para cada persona. Ninguna credencial de almacenamiento llega al navegador, ni al servidor de colaboración.',
            zh: '服务器、后端中的三个路由，以及给每个人的票据。存储凭据既不会到达浏览器，也不会到达协作服务器。',
          })}
        </SectionHead>

        <h3 className={h3}>{t({ en: '1. Run the server', es: '1. Ejecuta el servidor', zh: '1. 运行服务器' })}</h3>
        <p className={prose}>
          {t({
            en: (
              <>
                It is <code className={mono}>@rebodocs/collab</code> on npm: plain Node with no dependencies. Put it behind HTTPS with your usual proxy; it uses server-sent events and POST, not
                WebSockets, so nothing special is needed.
              </>
            ),
            es: (
              <>
                Es <code className={mono}>@rebodocs/collab</code> en npm: Node simple sin dependencias. Ponlo detrás de HTTPS con tu proxy de siempre; usa server-sent events y POST, no WebSockets, así
                que no hace falta nada especial.
              </>
            ),
            zh: (
              <>
                即 npm 上的 <code className={mono}>@rebodocs/collab</code>：纯 Node，没有任何依赖。用你常用的代理为它加上 HTTPS；它使用 server-sent events 和 POST，而不是
                WebSocket，因此不需要特殊配置。
              </>
            ),
          })}
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: serverCode }} />
        <dl className="m-0 mt-5 max-w-[860px] rounded-2xl border border-border px-5">
          {OPTIONS.map(([option, env, text]) => (
            <div key={option} className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="w-[170px] flex-none font-code text-[13.5px] font-semibold text-ink">{option}</dt>
              <dd className="m-0 min-w-0 flex-[1_1_300px] text-[15px] leading-normal text-ink-soft">
                {t(text)}
                {env && <span className="mt-0.5 block font-code text-[12.5px] text-muted">{env}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <h3 className={h3}>{t({ en: '2. Three routes in your backend', es: '2. Tres rutas en tu backend', zh: '2. 后端中的三个路由' })}</h3>
        <p className={prose}>{t({ en: 'Each request carries the key, so check it.', es: 'Cada petición lleva la clave, así que compruébala.', zh: '每个请求都带有密钥，请进行校验。' })}</p>
        <dl className="m-0 mt-4 max-w-[860px] rounded-2xl border border-border px-5">
          {ROUTES.map(([route, when, what]) => (
            <div key={route} className="border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{route}</dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">
                <span className="text-muted">{t(when)}</span> {t(what)}
              </dd>
            </div>
          ))}
        </dl>
        <p className={prose}>{t({ en: 'A sketch, with Next.js route handlers:', es: 'Un boceto, con route handlers de Next.js:', zh: '一个使用 Next.js route handler 的示例：' })}</p>
        <div className={`mt-4 max-w-[860px] ${CODE}`} dangerouslySetInnerHTML={{ __html: nextCode + accessCode }} />

        <h3 className={h3}>{t({ en: '3. Give each person a ticket', es: '3. Dale un ticket a cada persona', zh: '3. 给每个人一张票据' })}</h3>
        <p className={prose}>
          {t({
            en: 'A ticket is whatever your backend can verify: a signed, short-lived token saying who the person is and which document they may open. Make it when you render the page, and pass it on. The demo signs the room, the name and when it expires with a secret only the backend has, so it keeps nothing to check one.',
            es: 'Un ticket es lo que tu backend pueda verificar: un token firmado y de corta vida que dice quién es la persona y qué documento puede abrir. Créalo al renderizar la página y pásalo. El demo firma la sala, el nombre y cuándo caduca con un secreto que solo tiene el backend, así que no guarda nada para comprobar uno.',
            zh: '票据可以是任何你的后端能验证的东西：一个经过签名、有效期很短的令牌，说明此人是谁、可以打开哪份文档。在渲染页面时生成并传入。演示用只有后端知道的密钥对房间、名字和过期时间签名，因此无需保存任何东西即可校验。',
          })}
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: ticketCode }} />
        <p className={prose}>
          {t({
            en: (
              <>
                The document comes from the room, so <code className={mono}>docx</code> is not used; it saves itself through your backend, so <code className={mono}>onSave</code> is not needed either.
              </>
            ),
            es: (
              <>
                El documento viene de la sala, así que <code className={mono}>docx</code> no se usa; se guarda solo a través de tu backend, así que tampoco hace falta{' '}
                <code className={mono}>onSave</code>.
              </>
            ),
            zh: (
              <>
                文档来自房间，因此不使用 <code className={mono}>docx</code>；它会通过你的后端自动保存，所以也不需要 <code className={mono}>onSave</code>。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="a-version-for-each-session" className="mt-24">
        <SectionHead
          id="a-version-for-each-session"
          badge={t({ en: 'Versions', es: 'Versiones', zh: '版本' })}
          color="yellow"
          title={t({ en: 'A version for each session', es: 'Una versión por cada sesión', zh: '每次会话一个版本' })}
        >
          {t({
            en: 'The PUT made when the last person leaves, if anybody changed anything, says so: the moment to keep a version, signed by who worked on it, and not one every 30 seconds.',
            es: 'El PUT que se hace cuando sale la última persona, si alguien cambió algo, lo dice: el momento de guardar una versión, firmada por quienes trabajaron en ella, y no una cada 30 segundos.',
            zh: '最后一人离开时发出的 PUT，如果有人做过修改，会注明这一点：这正是保存一个版本的时机，由参与编辑的人署名，而不是每 30 秒保存一个。',
          })}
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[860px] rounded-2xl border border-border px-5">
          {[
            [
              'X-Rebodocs-Session-End: 1',
              t({
                en: 'This is the document as the session of work leaves it: everybody has gone.',
                es: 'Este es el documento tal como lo deja la sesión de trabajo: todos se han ido.',
                zh: '这是工作会话结束时的文档：所有人都已离开。',
              }),
            ],
            [
              'X-Rebodocs-Authors',
              t({
                en: 'Who changed it in the session, as /access named them, each URL-encoded, separated by commas, in the order they first changed it. Someone who only looked is not there.',
                es: 'Quiénes lo cambiaron en la sesión, como los nombró /access, cada uno codificado para URL, separados por comas, en el orden en que lo cambiaron por primera vez. Quien solo miró no está.',
                zh: '在会话中修改过文档的人，使用 /access 给出的名字，各自经过 URL 编码，以逗号分隔，按首次修改的先后排列。只查看过的人不在其中。',
              }),
            ],
          ].map(([header, text]) => (
            <div key={header} className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="w-[230px] flex-none font-code text-[13.5px] font-semibold text-ink">{header}</dt>
              <dd className="m-0 min-w-0 flex-[1_1_300px] text-[15px] leading-normal text-ink-soft">{text}</dd>
            </div>
          ))}
        </dl>
        <div className={`mt-5 max-w-[860px] ${CODE}`} dangerouslySetInnerHTML={{ __html: versionCode }} />
        <p className={prose}>
          {t({
            en: (
              <>
                Give the editor those versions (<code className={mono}>versions</code> of <code className={mono}>DocsEditor</code>) and everybody in the room can see them, compare the document with
                one, and go back to one: going back is one more change, sent to the others. A session ends when the room is let go of, <code className={mono}>idle</code> after the last person left (30
                s by default); someone who comes back before that is in the same session. A server that stops while people are in it gives the document back without the headers. See{' '}
                <LocalLink href="/docs/versions/" className={LINK}>
                  versions
                </LocalLink>
                .
              </>
            ),
            es: (
              <>
                Dale esas versiones al editor (<code className={mono}>versions</code> de <code className={mono}>DocsEditor</code>) y todos en la sala pueden verlas, comparar el documento con una y
                volver a una: volver es un cambio más, enviado a los demás. Una sesión termina cuando se suelta la sala, <code className={mono}>idle</code> después de que salió la última persona (30 s
                por defecto); quien vuelve antes está en la misma sesión. Un servidor que se detiene con gente dentro devuelve el documento sin los encabezados. Mira{' '}
                <LocalLink href="/docs/versions/" className={LINK}>
                  versiones
                </LocalLink>
                .
              </>
            ),
            zh: (
              <>
                把这些版本交给编辑器（<code className={mono}>DocsEditor</code> 的 <code className={mono}>versions</code>
                ），房间里的所有人都能看到它们、把文档与某个版本比较，并还原到某个版本：还原只是又一次更改，会发送给其他人。房间被释放时会话结束，即最后一人离开 <code className={mono}>idle</code>{' '}
                之后（默认 30 秒）；在此之前回来的人仍在同一会话中。有人在时服务器停止，交还的文档不带这些头。参见
                <LocalLink href="/docs/versions/" className={LINK}>
                  版本
                </LocalLink>
                。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="when-the-server-stops" className="mt-24">
        <SectionHead
          id="when-the-server-stops"
          badge={t({ en: 'No lost work', es: 'Sin trabajo perdido', zh: '不丢失工作' })}
          color="green"
          title={t({ en: 'When the server stops all at once', es: 'Cuando el servidor se detiene de golpe', zh: '服务器突然停止时' })}
        >
          {t({
            en: (
              <>
                By itself the server gives your backend the document a few seconds after the changes stop: if it is killed before, those seconds of work are gone. With{' '}
                <code className={mono}>--backend-log</code> it gives your backend every change as it comes, and none is lost.
              </>
            ),
            es: (
              <>
                Por sí solo, el servidor le da a tu backend el documento unos segundos después de que paran los cambios: si lo matan antes, esos segundos de trabajo se pierden. Con{' '}
                <code className={mono}>--backend-log</code> le da a tu backend cada cambio en cuanto llega, y no se pierde ninguno.
              </>
            ),
            zh: (
              <>
                默认情况下，服务器会在更改停止几秒后把文档交给你的后端：如果在此之前被终止，这几秒的工作就会丢失。使用 <code className={mono}>--backend-log</code>{' '}
                后，它会把每次更改实时交给后端，不会丢失任何内容。
              </>
            ),
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: 'The log is lines of text, one per change, after one with the file they are made to. Keep them as they come and give them back as they were: a file, a row, an object in a bucket. A room that opens with a log starts again from where it was, with the same epoch, so the editors that were in it come back as from a dropped connection, with what they had not sent. Each change goes as soon as it comes, one request at a time: what can still be lost is what was on its way.',
            es: 'El registro son líneas de texto, una por cambio, después de una con el archivo al que se aplican. Guárdalas como llegan y devuélvelas como eran: un archivo, una fila, un objeto en un bucket. Una sala que se abre con un registro vuelve a empezar desde donde estaba, con el mismo epoch, así que los editores que estaban en ella vuelven como de una conexión cortada, con lo que no habían enviado. Cada cambio sale en cuanto llega, una petición a la vez: lo que todavía puede perderse es lo que iba en camino.',
            zh: '日志由文本行组成，每次更改一行，第一行是这些更改所基于的文件。按到达的顺序保存，并原样交还：可以是文件、数据库行或存储桶中的对象。带日志打开的房间会以相同的 epoch 从原来的位置继续，因此原本在其中的编辑器就像网络断开后重连一样回来，并带上尚未发送的内容。每次更改一到就发送，一次一个请求：仍可能丢失的只有正在途中的那一个。',
          })}
        </p>
        <dl className="m-0 mt-5 max-w-[860px] rounded-2xl border border-border px-5">
          {LOG_ROUTES.map(([route, when, what]) => (
            <div key={route} className="border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{route}</dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">
                <span className="text-muted">{t(when)}</span> {t(what)}
              </dd>
            </div>
          ))}
        </dl>
        <div className={`mt-5 max-w-[860px] ${CODE}`} dangerouslySetInnerHTML={{ __html: logCode }} />
        <p className={prose}>
          {t({
            en: (
              <>
                The PUT of the document that ends a session ends the log too: let it go then, in the same request. A log left behind, by a server that stopped, is how the room picks up again; it is
                not a history. In code it is <code className={mono}>{'backendStorage({ url, key, log: true })'}</code>.
              </>
            ),
            es: (
              <>
                El PUT del documento que termina una sesión también termina el registro: suéltalo entonces, en la misma petición. Un registro que queda, de un servidor que se detuvo, es como la sala
                retoma; no es un historial. En código es <code className={mono}>{'backendStorage({ url, key, log: true })'}</code>.
              </>
            ),
            zh: (
              <>
                结束会话的那次文档 PUT 也意味着日志结束：在同一个请求中删除它即可。服务器停止后留下的日志用于让房间继续，而不是历史记录。在代码中写作{' '}
                <code className={mono}>{'backendStorage({ url, key, log: true })'}</code>。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="taking-access-away" className="mt-24">
        <SectionHead id="taking-access-away" badge={t({ en: 'Access', es: 'Acceso', zh: '权限' })} color="pink" title={t({ en: 'Taking access away', es: 'Quitar el acceso', zh: '收回权限' })}>
          {t({
            en: 'The ticket is checked when someone comes in. When your system takes their access away, or lets them only watch, have the server ask again at once.',
            es: 'El ticket se comprueba cuando alguien entra. Cuando tu sistema le quita el acceso, o le deja solo mirar, haz que el servidor vuelva a preguntar en el acto.',
            zh: '票据在有人进入时校验。当你的系统收回某人的权限，或改为只能查看时，请让服务器立即重新询问。',
          })}
        </SectionHead>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: recheckCode }} />
        <p className={prose}>
          {t({
            en: (
              <>
                With <code className={mono}>--backend-key</code>, <code className={mono}>POST /collab/rooms/&lt;id&gt;/recheck</code> asks <code className={mono}>/access</code> again for everybody in
                that room, and <code className={mono}>POST /collab/recheck</code> for every room of the process. Whoever it no longer lets in is sent away, and their editor says they no longer have
                access; whoever it now lets only watch, or edit, comes back as that. Without a key there is no such route; <code className={mono}>--recheck-every</code> asks every so many seconds
                instead, and <code className={mono}>server.recheck(id)</code> does it from code.
              </>
            ),
            es: (
              <>
                Con <code className={mono}>--backend-key</code>, <code className={mono}>POST /collab/rooms/&lt;id&gt;/recheck</code> vuelve a preguntar a <code className={mono}>/access</code> por
                todos en esa sala, y <code className={mono}>POST /collab/recheck</code> por todas las salas del proceso. A quien ya no deja entrar se le expulsa, y su editor dice que ya no tiene
                acceso; quien ahora solo puede mirar, o editar, vuelve como tal. Sin clave no existe esa ruta; <code className={mono}>--recheck-every</code> pregunta cada tantos segundos en su lugar,
                y <code className={mono}>server.recheck(id)</code> lo hace desde código.
              </>
            ),
            zh: (
              <>
                设置 <code className={mono}>--backend-key</code> 后，<code className={mono}>POST /collab/rooms/&lt;id&gt;/recheck</code> 会为该房间中的每个人再次询问{' '}
                <code className={mono}>/access</code>，<code className={mono}>POST /collab/recheck</code>{' '}
                则针对该进程的所有房间。不再被允许的人会被移出，其编辑器会提示已无权限；现在只能查看或可以编辑的人会以新身份回来。没有密钥时不存在该路由；可以改用{' '}
                <code className={mono}>--recheck-every</code> 每隔一定秒数询问，或在代码中调用 <code className={mono}>server.recheck(id)</code>。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="several-processes" className="mt-24">
        <SectionHead id="several-processes" badge={t({ en: 'Scale', es: 'Escala', zh: '扩展' })} color="purple" title={t({ en: 'Several processes', es: 'Varios procesos', zh: '多个进程' })}>
          {t({
            en: 'A room is held by one process, in its memory. To run several, send every request of a room to the same one: the id of the room is in the address.',
            es: 'Una sala la lleva un proceso, en su memoria. Para ejecutar varios, envía cada petición de una sala al mismo: el id de la sala está en la dirección.',
            zh: '一个房间由一个进程保存在内存中。要运行多个进程，请把同一房间的所有请求发送到同一个进程：房间 id 就在地址中。',
          })}
        </SectionHead>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: routingCode }} />
        <p className={prose}>
          {t({
            en: (
              <>
                It takes <code className={mono}>--backend</code>, so that any process can open any document, and <code className={mono}>--backend-log</code>, so that a room whose process stops opens
                in another where it was: its editors come back to the address they had, and the balancer sends them to the one that has it now. <code className={mono}>--instance</code> names each
                process, in <code className={mono}>X-Rebodocs-Instance</code>, to see where a room is. Should a room open in two processes at once, while the balancer changes, your backend’s 409 to
                the log says so. A recheck for every room reaches only the process the request goes to: ask room by room.
              </>
            ),
            es: (
              <>
                Necesita <code className={mono}>--backend</code>, para que cualquier proceso pueda abrir cualquier documento, y <code className={mono}>--backend-log</code>, para que una sala cuyo
                proceso se detiene se abra en otro donde estaba: sus editores vuelven a la dirección que tenían, y el balanceador los manda al que la tiene ahora.{' '}
                <code className={mono}>--instance</code> nombra cada proceso, en <code className={mono}>X-Rebodocs-Instance</code>, para ver dónde está una sala. Si una sala se abriera en dos procesos
                a la vez, mientras cambia el balanceador, el 409 de tu backend al registro lo dice. Un recheck de todas las salas solo llega al proceso al que va la petición: pregunta sala por sala.
              </>
            ),
            zh: (
              <>
                这需要 <code className={mono}>--backend</code>，以便任何进程都能打开任何文档；还需要 <code className={mono}>--backend-log</code>
                ，以便某个进程停止后，其房间能在另一个进程中从原处继续：编辑器回到原来的地址，负载均衡器会把它们转到现在持有该房间的进程。<code className={mono}>--instance</code> 在{' '}
                <code className={mono}>X-Rebodocs-Instance</code> 中为每个进程命名，便于查看房间所在的位置。如果在负载均衡器切换期间某个房间同时在两个进程中打开，你的后端对日志返回的 409
                会指出这一点。针对所有房间的 recheck 只会到达请求所去的那个进程：请逐个房间询问。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="what-people-see" className="mt-24">
        <SectionHead
          id="what-people-see"
          badge={t({ en: 'In the editor', es: 'En el editor', zh: '在编辑器中' })}
          color="pink"
          title={t({ en: 'What people see', es: 'Lo que ve la gente', zh: '用户看到的内容' })}
        />
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
          {[
            [
              t({ en: 'Each other', es: 'A los demás', zh: '彼此' }),
              t({
                en: 'The others’ carets and selections, each in a colour with their name, and who is on the document in the status bar.',
                es: 'Los cursores y selecciones de los demás, cada uno en un color con su nombre, y quién está en el documento en la barra de estado.',
                zh: '其他人的光标和选区，各用一种颜色并标有名字；状态栏中显示谁在编辑该文档。',
              }),
            ],
            [
              t({ en: 'Their own undo', es: 'Su propio deshacer', zh: '自己的撤销' }),
              t({
                en: 'Undo takes back your own steps and leaves the others’ in place.',
                es: 'Deshacer quita tus propios pasos y deja en su lugar los de los demás.',
                zh: '撤销只撤回你自己的操作，保留其他人的。',
              }),
            ],
            [
              t({ en: 'No lost work', es: 'Sin trabajo perdido', zh: '不丢失工作' }),
              t({
                en: 'If the connection drops, the editor says so, keeps working, and sends what was typed when it comes back.',
                es: 'Si se corta la conexión, el editor lo dice, sigue funcionando y envía lo escrito cuando vuelve.',
                zh: '连接中断时，编辑器会提示，继续正常工作，并在恢复后发送期间输入的内容。',
              }),
            ],
            [
              t({ en: 'From outside', es: 'Desde fuera', zh: '从外部' }),
              t({
                en: "onCollab={(state, peers) => …} tells your application the same: state is 'connecting', 'on' or 'offline'.",
                es: "onCollab={(state, peers) => …} le dice lo mismo a tu aplicación: state es 'connecting', 'on' u 'offline'.",
                zh: "onCollab={(state, peers) => …} 会把同样的信息告诉你的应用：state 为 'connecting'、'on' 或 'offline'。",
              }),
            ],
          ].map(([title, text]) => (
            <div key={title} className="lift rounded-2xl border border-border p-5">
              <p className="m-0 font-display text-base font-bold tracking-[-0.01em]">{title}</p>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="inside" className="mt-24">
        <SectionHead id="inside" badge={t({ en: 'Inside', es: 'Por dentro', zh: '内部' })} color="blue" title={t({ en: 'How it works inside', es: 'Cómo funciona por dentro', zh: '内部原理' })}>
          {t({
            en: 'What travels, in what order, and what the editor does with it. None of it is needed to use the component.',
            es: 'Qué viaja, en qué orden, y qué hace el editor con ello. Nada de esto hace falta para usar el componente.',
            zh: '传输什么、以什么顺序，以及编辑器如何处理。使用组件时无需了解这些。',
          })}
        </SectionHead>
        <div className="doc doc-part mt-6 max-w-[860px]" dangerouslySetInnerHTML={{ __html: inside }} />
      </section>

      <section aria-labelledby="server" className="mt-24">
        <SectionHead
          id="server"
          badge={t({ en: 'Reference', es: 'Referencia', zh: '参考' })}
          color="orange"
          title={t({ en: 'The server in your own program', es: 'El servidor en tu propio programa', zh: '在你自己的程序中运行服务器' })}
        >
          {t({
            en: 'Its options and storage, mounted inside the API you already have, what goes over the wire, and the editor without React.',
            es: 'Sus opciones y su almacenamiento, montado dentro de la API que ya tienes, qué viaja por la red, y el editor sin React.',
            zh: '它的选项和存储、嵌入你已有的 API、通信协议，以及不使用 React 的编辑器。',
          })}
        </SectionHead>
        <div className="doc doc-part mt-6 max-w-[860px]" dangerouslySetInnerHTML={{ __html: server }} />
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge={t({ en: 'Limits', es: 'Límites', zh: '限制' })} color="yellow" title={t({ en: 'What to know', es: 'Qué saber', zh: '注意事项' })}>
          {t({
            en: 'Collaboration has run with two tabs, two browsers on a local network and between different networks behind an HTTPS proxy, over a real bucket; the demo’s backend has automated tests with two people typing through it, over a folder.',
            es: 'La colaboración ha funcionado con dos pestañas, dos navegadores en una red local y entre redes distintas detrás de un proxy HTTPS, sobre un bucket real; el backend del demo tiene pruebas automáticas con dos personas escribiendo a través de él, sobre una carpeta.',
            zh: '协作功能已在两个标签页、局域网中的两个浏览器，以及 HTTPS 代理后不同网络之间运行过，使用的是真实的存储桶；演示的后端有自动化测试，模拟两个人通过它输入，使用文件夹存储。',
          })}
        </SectionHead>
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            t({
              en: 'A room is named with letters, digits, - and _, from 8 to 64 of them. The id of a document in your system will do; the demo, which has file names, uses a digest of the name.',
              es: 'Una sala se nombra con letras, dígitos, - y _, de 8 a 64. El id de un documento en tu sistema sirve; el demo, que tiene nombres de archivo, usa un digest del nombre.',
              zh: '房间名称由字母、数字、- 和 _ 组成，长度为 8 到 64 个字符。直接使用你系统中的文档 id 即可；演示使用的是文件名，因此取文件名的摘要。',
            }),
            t({
              en: 'One process holds a room: with several, route each room to one of them (see Several processes).',
              es: 'Un proceso lleva una sala: con varios, enruta cada sala a uno de ellos (ver Varios procesos).',
              zh: '一个房间由一个进程持有：有多个进程时，请把每个房间路由到其中一个（参见“多个进程”）。',
            }),
            t({
              en: 'The ticket is checked on joining, and again when your backend asks for it, with --recheck-every or server.recheck(): otherwise someone whose access you revoke stays until they disconnect.',
              es: 'El ticket se comprueba al entrar, y de nuevo cuando tu backend lo pide, con --recheck-every o server.recheck(): si no, alguien cuyo acceso revocas se queda hasta que se desconecta.',
              zh: '票据在加入时校验，并在你的后端要求时（通过 --recheck-every 或 server.recheck()）再次校验：否则被你收回权限的人会一直留到断开连接为止。',
            }),
            t({
              en: 'Without --backend-log, a hard crash loses the changes since the last save: up to --save-after seconds (5) after people stop typing, up to --save-every (30) while they go on.',
              es: 'Sin --backend-log, una caída brusca pierde los cambios desde el último guardado: hasta --save-after segundos (5) después de que la gente deja de escribir, hasta --save-every (30) mientras sigue.',
              zh: '不使用 --backend-log 时，服务器崩溃会丢失上次保存之后的更改：停止输入后最多 --save-after 秒（5 秒），持续输入时最多 --save-every 秒（30 秒）。',
            }),
            t({
              en: 'The server keeps no versions: your application does, and the editor compares and restores them. Who changed what travels with tracked changes.',
              es: 'El servidor no guarda versiones: las guarda tu aplicación, y el editor las compara y restaura. Quién cambió qué viaja con el control de cambios.',
              zh: '服务器不保存版本：版本由你的应用保存，编辑器负责比较和还原。谁修改了什么由修订记录传递。',
            }),
            t({
              en: 'An editor and a server that speak different versions of the protocol do not meet: the editor is turned away and says one of them needs updating (session.reason is outdated).',
              es: 'Un editor y un servidor que hablan versiones distintas del protocolo no se encuentran: el editor es rechazado y dice que uno de los dos necesita actualizarse (session.reason es outdated).',
              zh: '协议版本不同的编辑器和服务器无法连接：编辑器会被拒绝，并提示其中一方需要更新（session.reason 为 outdated）。',
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
