import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { getT } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { KNOW, ROUTES, STEPS } from './data';
import { Flow } from './Flow';
import { LazyEnvDemo, LazyRequestsDemo } from './Lazy';

const REPO = 'https://github.com/JFranciscoRobles/rebodocs';
const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/**
 * "Documents in an S3 bucket": the storage demo's protocol played on the page
 * with a real editor, how to run the demo, the .env for each S3, the routes of
 * its backend, the page's side, the PDF on the server, and what to know.
 */
export async function StoragePage() {
  const t = getT();
  const [run, signing, page, pdf] = await Promise.all([
    highlight(
      `git clone ${REPO} && cd rebodocs && npm install
cp apps/storage/.env.example apps/storage/.env     # and fill it in
npm run cors -w @rebodocs/storage-demo             # lets http://localhost:5176 reach the bucket
npm run seed -w @rebodocs/storage-demo             # puts contract.docx in it
npm run storage                                    # http://localhost:5176`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(
      `import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'auto',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const readUrl = (Key: string) => getSignedUrl(client, new GetObjectCommand({ Bucket, Key }), { expiresIn: 300 });
const writeUrl = (Key: string, ContentType: string) =>
  getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType }), { expiresIn: 300, signableHeaders: new Set(['content-type']) });`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { DocsEditor } from '@rebodocs/react';

async function read(key: string) {
  const { url } = await (await fetch(\`/api/url?key=\${encodeURIComponent(key)}\`)).json();
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

async function write(key: string, docx: Uint8Array) {
  const { url, type } = await (await fetch(\`/api/url?key=\${encodeURIComponent(key)}\`, { method: 'POST' })).json();
  await fetch(url, { method: 'PUT', headers: { 'content-type': type }, body: docx });
}

<DocsEditor key={key} docx={file} name={key} onSave={(docx) => write(key, docx)} />`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { fillVariables, importDocx, renderPdf } from '@rebodocs/core';

const template = importDocx(await bucket.get('contract.docx'));
const { pdf, missingFonts } = renderPdf(fillVariables(template, values), fonts, 'contract');
await bucket.put('contract.pdf', pdf, 'application/pdf');`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {t({ en: 'Documents in an S3 bucket', es: 'Documentos en un bucket S3', zh: 'S3 存储桶中的文档' })}
      </h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: 'Where documents live is your application’s business. This page shows one common answer, with a demo to run: the files in a bucket that speaks S3 (Cloudflare R2, AWS S3, MinIO, Backblaze B2…), a small backend that holds the keys, and the editor in the browser.',
          es: 'Dónde viven los documentos es asunto de tu aplicación. Esta página muestra una respuesta común, con una demo para correr: los archivos en un bucket compatible con S3 (Cloudflare R2, AWS S3, MinIO, Backblaze B2…), un backend pequeño que tiene las claves, y el editor en el navegador.',
          zh: '文档存放在哪里由你的应用决定。本页展示一种常见方案，并附有可运行的演示：文件存放在兼容 S3 的存储桶中（Cloudflare R2、AWS S3、MinIO、Backblaze B2…），一个持有密钥的小型后端，以及浏览器中的编辑器。',
        })}
      </p>
      <Flow />
      <p className={prose}>
        {t({
          en: 'The browser never has a key of the bucket. It asks the backend for an address signed for one file and five minutes, and reads from or writes to the bucket itself, so the files do not pass through your server. Only the PDF is made by the server, because that is work for one.',
          es: 'El navegador nunca tiene una clave del bucket. Le pide al backend una dirección firmada para un archivo y cinco minutos, y lee o escribe en el bucket directamente, así que los archivos no pasan por tu servidor. Solo el PDF lo hace el servidor, porque es trabajo para un servidor.',
          zh: '浏览器从不持有存储桶的密钥。它向后端申请一个只对某个文件有效、期限五分钟的签名地址，然后直接读写存储桶，因此文件不会经过你的服务器。只有 PDF 由服务器生成，因为那本来就是服务器该做的工作。',
        })}
      </p>
      <div className="mt-4">
        <HandTip>
          {t({
            en: 'tip: save the contract below and watch where each request goes',
            es: 'tip: guarda el contrato de abajo y mira a dónde va cada petición',
            zh: '提示：保存下方的合同，观察每个请求的去向',
          })}
        </HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'The requests of a save', es: 'Las peticiones de un guardado', zh: '一次保存的请求' })}>
          {t({
            en: 'A real editor over the same protocol as the demo, with the backend and the bucket played in this page: the addresses are signed and checked as an S3 checks them, but nothing leaves the browser.',
            es: 'Un editor real sobre el mismo protocolo que la demo, con el backend y el bucket simulados en esta página: las direcciones se firman y se comprueban como las comprueba un S3, pero nada sale del navegador.',
            zh: '一个真实的编辑器，使用与演示相同的协议，后端和存储桶在本页面中模拟：地址的签名和校验方式与真实 S3 相同，但所有内容都不会离开浏览器。',
          })}
        </SectionHead>
        <LazyRequestsDemo />
        <p className={prose}>
          {t({
            en: (
              <>
                Opening is a list, an address and a read from the bucket. A save is two addresses and two writes: the document, and a copy of it under <code className={mono}>versions/</code>. Take the{' '}
                <em>CORS rule</em> away and the browser never reaches the bucket; a <em>PUT of another type</em> breaks the signature; <em>five minutes later</em> the address has run out.
              </>
            ),
            es: (
              <>
                Abrir es una lista, una dirección y una lectura del bucket. Guardar son dos direcciones y dos escrituras: el documento, y una copia bajo <code className={mono}>versions/</code>. Quita
                la <em>regla CORS</em> y el navegador nunca llega al bucket; un <em>PUT de otro tipo</em> rompe la firma; <em>cinco minutos después</em> la dirección ya caducó.
              </>
            ),
            zh: (
              <>
                打开文档需要一次列表请求、一个地址和一次存储桶读取。保存则需要两个地址和两次写入：文档本身，以及放在 <code className={mono}>versions/</code> 下的副本。去掉 <em>CORS 规则</em>
                ，浏览器就无法访问存储桶；
                <em>用其他类型 PUT</em> 会导致签名失效；<em>五分钟后</em>地址就会过期。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="run-it" className="mt-24">
        <SectionHead
          id="run-it"
          badge={t({ en: 'Start here', es: 'Empieza aquí', zh: '从这里开始' })}
          color="blue"
          title={t({ en: 'Run it with Cloudflare R2', es: 'Córrelo con Cloudflare R2', zh: '用 Cloudflare R2 运行' })}
        >
          {t({ en: 'The demo is ', es: 'La demo es ', zh: '演示位于 ' })}
          <a href={`${REPO}/tree/main/apps/storage`} className={LINK}>
            apps/storage
          </a>
          {t({
            en: '. It runs on your machine, with a bucket of your own.',
            es: '. Corre en tu máquina, con un bucket tuyo.',
            zh: '。它在你的电脑上运行，使用你自己的存储桶。',
          })}
        </SectionHead>
        <ol className="m-0 mt-6 grid max-w-[920px] list-none gap-3 p-0 [counter-reset:step]">
          {STEPS.map((step) => (
            <li
              key={step.title.en}
              className="flex gap-4 rounded-2xl border border-border px-5 py-4 [counter-increment:step] before:font-display before:text-xl before:font-extrabold before:text-brand before:content-[counter(step)]"
            >
              <div>
                <p className="m-0 text-[15px] font-semibold text-ink">{t(step.title)}</p>
                <p className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{t(step.text)}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: run }} />
        <p className={prose}>
          {t({
            en: (
              <>
                Open <code className={mono}>contract.docx</code> from the list, change it, save: it is written to the bucket, and a version beside it, signed with the name you give your notes. If the
                document is written and its version is not, the demo says so apart: the document is saved. <strong>PDF on the server…</strong> asks for the values of its variables and leaves{' '}
                <code className={mono}>contract.pdf</code> beside it. <strong>New</strong> starts an empty document that goes to the bucket when it is saved.
              </>
            ),
            es: (
              <>
                Abre <code className={mono}>contract.docx</code> de la lista, cámbialo, guarda: se escribe en el bucket, y una versión a su lado, firmada con el nombre que les das a tus notas. Si el
                documento se escribe y su versión no, la demo lo dice aparte: el documento sí quedó guardado. <strong>PDF on the server…</strong> pide los valores de sus variables y deja{' '}
                <code className={mono}>contract.pdf</code> a su lado. <strong>New</strong> empieza un documento vacío que va al bucket cuando se guarda.
              </>
            ),
            zh: (
              <>
                从列表中打开 <code className={mono}>contract.docx</code>
                ，修改后保存：它会被写入存储桶，旁边还会保存一个版本，署名为你给批注使用的名字。如果文档写入成功而版本写入失败，演示会单独提示：文档已经保存。
                <strong>PDF on the server…</strong> 会询问变量的值，并在旁边生成 <code className={mono}>contract.pdf</code>。<strong>New</strong> 会新建一个空白文档，保存时写入存储桶。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="another-s3" className="mt-24">
        <SectionHead id="another-s3" badge={t({ en: 'Any S3', es: 'Cualquier S3', zh: '任意 S3' })} color="purple" title={t({ en: 'Another S3', es: 'Otro S3', zh: '其他 S3' })}>
          {t({
            en: 'The code is the same; the environment says which one. Pick yours, and copy what it writes.',
            es: 'El código es el mismo; el entorno dice cuál. Elige el tuyo, y copia lo que escribe.',
            zh: '代码完全相同；由环境变量决定使用哪一个。选择你的服务，复制生成的内容即可。',
          })}
        </SectionHead>
        <LazyEnvDemo />
      </section>

      <section aria-labelledby="the-backend" className="mt-24">
        <SectionHead id="the-backend" badge="Node" color="orange" title={t({ en: 'The backend', es: 'El backend', zh: '后端' })}>
          {t({ en: 'Seven routes, in ', es: 'Siete rutas, en ', zh: '七条路由，位于 ' })}
          <a href={`${REPO}/blob/main/apps/storage/server/api.ts`} className={LINK}>
            server/api.ts
          </a>
          {t({
            en: (
              <>
                . It is a plain Node handler, <code className={mono}>(request, response)</code>, so it goes as it is into Express, a Next.js route or a server of your own.
              </>
            ),
            es: (
              <>
                . Es un handler simple de Node, <code className={mono}>(request, response)</code>, así que va tal cual en Express, una ruta de Next.js o un servidor propio.
              </>
            ),
            zh: (
              <>
                。它是一个普通的 Node 处理函数 <code className={mono}>(request, response)</code>，可以直接放进 Express、Next.js 路由或你自己的服务器中。
              </>
            ),
          })}
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {ROUTES.map((row) => (
            <div key={row.route} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[230px_1fr]">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{row.route}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(row.text)}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          {t({
            en: (
              <>
                A version is a file under <code className={mono}>versions/&lt;key&gt;/</code>. Its key holds when it was kept and, encoded, who kept it and its name, so that one listing request gives
                them all; the editor’s side panel lists them, compares them and restores them. It is written once and never again: the backend signs no address to write over one. Fifty are kept of
                each document, or what <code className={mono}>VERSIONS_KEPT</code> says, and the oldest go as new ones come. See{' '}
              </>
            ),
            es: (
              <>
                Una versión es un archivo bajo <code className={mono}>versions/&lt;key&gt;/</code>. Su key guarda cuándo se guardó y, codificados, quién la guardó y su nombre, para que una sola
                petición de listado los dé todos; el panel lateral del editor las lista, las compara y las restaura. Se escribe una vez y nunca más: el backend no firma ninguna dirección para
                sobrescribir una. Se guardan cincuenta por documento, o las que diga <code className={mono}>VERSIONS_KEPT</code>, y las más viejas se van conforme llegan nuevas. Ve{' '}
              </>
            ),
            zh: (
              <>
                版本就是 <code className={mono}>versions/&lt;key&gt;/</code> 下的文件。它的 key
                中包含保存时间，并以编码形式包含保存者和版本名称，因此一次列表请求就能获得全部信息；编辑器的侧边栏会列出、对比和还原它们。版本只写入一次，之后永不修改：后端不会为覆盖版本签发地址。每份文档保留
                50 个版本（或 <code className={mono}>VERSIONS_KEPT</code> 指定的数量），有新版本时会删除最旧的。参见
              </>
            ),
          })}
          <LocalLink href="/docs/versions/" className={LINK}>
            {t({ en: 'versions', es: 'versiones', zh: '版本' })}
          </LocalLink>
          {t({
            en: '. Signing an address is two lines with the AWS SDK:',
            es: '. Firmar una dirección son dos líneas con el SDK de AWS:',
            zh: '。用 AWS SDK 签发地址只需两行代码：',
          })}
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: signing }} />
      </section>

      <section aria-labelledby="the-page" className="mt-24">
        <SectionHead id="the-page" badge="React" color="pink" title={t({ en: 'The page', es: 'La página', zh: '页面' })}>
          {t({
            en: (
              <>
                Opening is a file given to the component, and saving is what <code className={mono}>onSave</code> hands back.
              </>
            ),
            es: (
              <>
                Abrir es un archivo que se le da al componente, y guardar es lo que devuelve <code className={mono}>onSave</code>.
              </>
            ),
            zh: (
              <>
                打开就是把文件交给组件，保存就是处理 <code className={mono}>onSave</code> 返回的内容。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: page }} />
      </section>

      <section aria-labelledby="a-pdf-on-the-server" className="mt-24">
        <SectionHead id="a-pdf-on-the-server" badge="@rebodocs/core" color="orange" title={t({ en: 'A PDF on the server', es: 'Un PDF en el servidor', zh: '在服务器上生成 PDF' })}>
          {t({
            en: 'The server reads the template from the bucket, fills it, lays it out with font files and stores the result. See ',
            es: 'El servidor lee la plantilla del bucket, la llena, la maqueta con archivos de fuentes y guarda el resultado. Ve ',
            zh: '服务器从存储桶读取模板，填写后用字体文件排版，并保存结果。每个调用的作用见',
          })}
          <LocalLink href="/docs/server/" className={LINK}>
            {t({ en: 'On a server', es: 'En un servidor', zh: '在服务器上' })}
          </LocalLink>
          {t({ en: ' for what each call does.', es: ' para lo que hace cada llamada.', zh: '一页。' })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: pdf }} />
        <p className={prose}>
          {t({
            en: (
              <>
                The demo looks for <code className={mono}>.ttf</code> and <code className={mono}>.otf</code> files in the fonts of the system, or in the folder <code className={mono}>FONTS_DIR</code>{' '}
                names. A server of yours has no fonts unless you put them there: ship the ones your documents use, and read <code className={mono}>missingFonts</code> to know when one was stood in
                for.
              </>
            ),
            es: (
              <>
                La demo busca archivos <code className={mono}>.ttf</code> y <code className={mono}>.otf</code> en las fuentes del sistema, o en la carpeta que nombre{' '}
                <code className={mono}>FONTS_DIR</code>. Un servidor tuyo no tiene fuentes salvo que las pongas ahí: lleva las que usan tus documentos, y lee <code className={mono}>missingFonts</code>{' '}
                para saber cuándo se sustituyó una.
              </>
            ),
            zh: (
              <>
                演示会在系统字体或 <code className={mono}>FONTS_DIR</code> 指定的目录中查找 <code className={mono}>.ttf</code> 和 <code className={mono}>.otf</code>{' '}
                文件。你的服务器上默认没有字体，需要自己放上去：部署文档用到的字体，并读取 <code className={mono}>missingFonts</code> 了解哪些字体被替代了。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge={t({ en: 'Limits', es: 'Límites', zh: '限制' })} color="yellow" title={t({ en: 'What to know', es: 'Qué saber', zh: '须知' })} />
        <div className="mt-6 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3">
          {KNOW.map((item) => (
            <div key={item.title.en} className="rounded-2xl border border-border p-4">
              <p className="m-0 text-[15px] font-semibold text-ink">{t(item.title)}</p>
              <p className="m-0 mt-1.5 text-[14px] leading-[1.55] text-ink-soft">{t(item.text)}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          {t({
            en: (
              <>
                <strong>How it has been checked.</strong> The backend has automated tests against an S3 kept in memory: listing, signed addresses, writing as a browser does, the variables, the PDF (on
                a machine with fonts), versions kept, pruned and never written over, and the rule of origins. Against a bucket of Cloudflare R2 the same was run by hand from Node, with the origin rule
                in place.
              </>
            ),
            es: (
              <>
                <strong>Cómo se ha comprobado.</strong> El backend tiene pruebas automatizadas contra un S3 en memoria: listado, direcciones firmadas, escritura como lo hace un navegador, las
                variables, el PDF (en una máquina con fuentes), versiones guardadas, podadas y nunca sobrescritas, y la regla de orígenes. Contra un bucket de Cloudflare R2 se corrió lo mismo a mano
                desde Node, con la regla de origen puesta.
              </>
            ),
            zh: (
              <>
                <strong>验证方式。</strong>后端有针对内存 S3
                的自动化测试：列表、签名地址、模拟浏览器的写入、变量、PDF（在有字体的机器上）、版本的保存与清理且永不覆盖，以及来源规则。在设置好来源规则后，还在 Node 中手动对 Cloudflare R2
                存储桶运行了同样的流程。
              </>
            ),
          })}
        </p>
      </section>
    </>
  );
}
