// What the page "Documents in an S3 bucket" says that is data, each checked
// in apps/storage: server/api.ts (the routes), server/bucket.ts (the client,
// the signed addresses, the rule of origins), .env.example, scripts/ and
// src/App.tsx. Each text in each language of the site.

import type { L } from '@/lib/i18n';

export interface Provider {
  name: string;
  /** S3_ENDPOINT, with `<place>` for what the person gives; empty when it is left out. */
  endpoint: string;
  /** S3_REGION, or `<place>`. */
  region: string;
  pathStyle?: boolean;
  /** What to ask for, put in `<place>`. */
  ask?: string;
  placeholder: string;
  note: L;
}

export const PROVIDERS: Provider[] = [
  {
    name: 'Cloudflare R2',
    endpoint: 'https://<place>.r2.cloudflarestorage.com',
    region: 'auto',
    ask: 'Account id',
    placeholder: '<account-id>',
    note: {
      en: 'The account id is in the dashboard, R2, and in the address of the S3 API. Not the r2.dev address: that one serves the files to anyone, and the backend refuses it.',
      es: 'El account id está en el panel, R2, y en la dirección de la API de S3. No la dirección r2.dev: esa sirve los archivos a cualquiera, y el backend la rechaza.',
      zh: 'account id 在控制台的 R2 页面以及 S3 API 的地址中。不要使用 r2.dev 地址：它会向任何人公开文件，后端会拒绝它。',
    },
  },
  {
    name: 'AWS S3',
    endpoint: '',
    region: '<place>',
    ask: 'Region of the bucket',
    placeholder: 'eu-west-1',
    note: { en: 'Without an endpoint, the SDK finds the bucket by its region.', es: 'Sin endpoint, el SDK encuentra el bucket por su región.', zh: '不设置 endpoint 时，SDK 会根据区域找到存储桶。' },
  },
  {
    name: 'MinIO',
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    pathStyle: true,
    placeholder: '',
    note: {
      en: 'MinIO takes the bucket in the path, not in the name of the host: S3_FORCE_PATH_STYLE. Any region does.',
      es: 'MinIO toma el bucket en la ruta, no en el nombre del host: S3_FORCE_PATH_STYLE. Cualquier región sirve.',
      zh: 'MinIO 把存储桶放在路径中，而不是主机名中：需要 S3_FORCE_PATH_STYLE。区域可以随意填写。',
    },
  },
  {
    name: 'Backblaze B2',
    endpoint: 'https://s3.<place>.backblazeb2.com',
    region: '<place>',
    ask: 'Region',
    placeholder: 'us-west-004',
    note: {
      en: 'The region is in the endpoint of the bucket, on its page in Backblaze.',
      es: 'La región está en el endpoint del bucket, en su página de Backblaze.',
      zh: '区域包含在存储桶的 endpoint 中，可在 Backblaze 的存储桶页面找到。',
    },
  },
];

/** The routes of server/api.ts. */
export const ROUTES: { route: string; text: L }[] = [
  {
    route: 'GET /api/files',
    text: {
      en: 'The .docx and .pdf of the bucket, the newest first: key, size, modified. The versions are not among them.',
      es: 'Los .docx y .pdf del bucket, los más nuevos primero: key, size, modified. Las versiones no están entre ellos.',
      zh: '存储桶中的 .docx 和 .pdf，最新的在前：key、size、modified。不包含版本文件。',
    },
  },
  {
    route: 'GET /api/url?key=…',
    text: {
      en: '{ url }: an address to read that file from, good for five minutes.',
      es: '{ url }: una dirección para leer ese archivo, válida por cinco minutos.',
      zh: '{ url }：读取该文件的地址，有效期五分钟。',
    },
  },
  {
    route: 'POST /api/url?key=…',
    text: {
      en: '{ url, type }: an address to write a .docx to, sending that Content-Type and no other. Never one of a version: those stay as they were kept.',
      es: '{ url, type }: una dirección para escribir un .docx, enviando ese Content-Type y ningún otro. Nunca una de una versión: esas se quedan como se guardaron.',
      zh: '{ url, type }：写入 .docx 的地址，只能使用该 Content-Type。永远不会为版本文件签发写入地址：版本保存后不再改变。',
    },
  },
  { route: 'GET /api/variables?key=…', text: { en: '{ names }: the variables of a template.', es: '{ names }: las variables de una plantilla.', zh: '{ names }：模板中的变量。' } },
  {
    route: 'POST /api/pdf?key=…',
    text: {
      en: 'Fills the template with the JSON of the body, stores the PDF beside it, and answers { key, url, pages, missingFonts }. A server with no font says so, with a 503.',
      es: 'Llena la plantilla con el JSON del cuerpo, guarda el PDF junto a ella, y responde { key, url, pages, missingFonts }. Un servidor sin ninguna fuente lo dice, con un 503.',
      zh: '用请求体中的 JSON 填写模板，把 PDF 保存在模板旁边，并返回 { key, url, pages, missingFonts }。服务器上没有任何字体时返回 503 说明情况。',
    },
  },
  {
    route: 'GET /api/versions?key=…',
    text: {
      en: 'The versions kept of a document: id (its key, read with GET /api/url), date, author, label.',
      es: 'Las versiones guardadas de un documento: id (su key, que se lee con GET /api/url), date, author, label.',
      zh: '文档已保存的版本：id（即其 key，用 GET /api/url 读取）、date、author、label。',
    },
  },
  {
    route: 'POST /api/versions?key=…',
    text: {
      en: '{ url, type, version }: an address to write a new version to. The JSON of the body names it: { label, author }. The oldest beyond the 50 kept (VERSIONS_KEPT) go first.',
      es: '{ url, type, version }: una dirección para escribir una versión nueva. El JSON del cuerpo la nombra: { label, author }. Las más viejas por encima de las 50 guardadas (VERSIONS_KEPT) se van primero.',
      zh: '{ url, type, version }：写入新版本的地址。请求体中的 JSON 为其命名：{ label, author }。超过保留数量 50 个（VERSIONS_KEPT）时，最旧的版本先被删除。',
    },
  },
];

/** The steps to run the demo with Cloudflare R2. */
export const STEPS: { title: L; text: L }[] = [
  {
    title: { en: 'A bucket', es: 'Un bucket', zh: '一个存储桶' },
    text: {
      en: 'In the Cloudflare dashboard, R2, Create bucket. Call it rebodocs-demo, or what you like.',
      es: 'En el panel de Cloudflare, R2, Create bucket. Llámalo rebodocs-demo, o como quieras.',
      zh: '在 Cloudflare 控制台中进入 R2，点击 Create bucket。命名为 rebodocs-demo 或任意名称。',
    },
  },
  {
    title: { en: 'Keys', es: 'Claves', zh: '密钥' },
    text: {
      en: 'R2, Manage API tokens, Create API token, with Object Read & Write for that bucket only. It shows the Access Key ID and the Secret Access Key once.',
      es: 'R2, Manage API tokens, Create API token, con Object Read & Write solo para ese bucket. Muestra el Access Key ID y el Secret Access Key una sola vez.',
      zh: '在 R2 中进入 Manage API tokens，点击 Create API token，仅为该存储桶授予 Object Read & Write 权限。Access Key ID 和 Secret Access Key 只显示一次。',
    },
  },
  {
    title: { en: 'The environment', es: 'El entorno', zh: '环境变量' },
    text: {
      en: 'Copy apps/storage/.env.example to .env and fill it in: the generator below writes it for the S3 you pick.',
      es: 'Copia apps/storage/.env.example a .env y llénalo: el generador de abajo lo escribe para el S3 que elijas.',
      zh: '把 apps/storage/.env.example 复制为 .env 并填写：下方的生成器会根据你选择的 S3 生成内容。',
    },
  },
  {
    title: { en: 'Let the page in', es: 'Deja entrar a la página', zh: '允许页面访问' },
    text: {
      en: 'npm run cors -w @rebodocs/storage-demo tells the bucket the page may use its addresses. Keys for objects only may not change that: it then prints the rule to paste.',
      es: 'npm run cors -w @rebodocs/storage-demo le dice al bucket que la página puede usar sus direcciones. Unas claves solo para objetos pueden no tener permiso para cambiar eso: entonces imprime la regla para pegarla.',
      zh: 'npm run cors -w @rebodocs/storage-demo 会告诉存储桶允许该页面使用其地址。仅有对象权限的密钥可能无法修改此设置：此时它会打印出需要手动粘贴的规则。',
    },
  },
  {
    title: { en: 'A document, and the demo', es: 'Un documento, y la demo', zh: '一份文档，然后运行演示' },
    text: {
      en: 'npm run seed -w @rebodocs/storage-demo puts contract.docx, a template, in the bucket; npm run storage opens http://localhost:5176.',
      es: 'npm run seed -w @rebodocs/storage-demo pone contract.docx, una plantilla, en el bucket; npm run storage abre http://localhost:5176.',
      zh: 'npm run seed -w @rebodocs/storage-demo 会把模板 contract.docx 放进存储桶；npm run storage 会打开 http://localhost:5176。',
    },
  },
];

/** What to know, from the code and from running it. */
export const KNOW: { title: L; text: L }[] = [
  {
    title: { en: 'Check who is asking before signing.', es: 'Comprueba quién pide antes de firmar.', zh: '签名前先确认请求者身份。' },
    text: {
      en: 'The demo signs for anyone who reaches it, which is right for a machine of your own and wrong anywhere else. In your application the routes know the person and decide which keys they may read and write: a prefix for each account, for one.',
      es: 'La demo firma para cualquiera que llegue a ella, lo cual está bien en una máquina propia y mal en cualquier otro lado. En tu aplicación las rutas conocen a la persona y deciden qué keys puede leer y escribir: un prefijo por cuenta, por ejemplo.',
      zh: '演示会为任何访问者签名，这在你自己的电脑上没问题，在其他地方就不行了。在你的应用中，路由应识别用户身份，并决定其可以读写哪些 key：例如每个账户一个前缀。',
    },
  },
  {
    title: { en: 'Sign the type too.', es: 'Firma también el tipo.', zh: '把类型也签进去。' },
    text: {
      en: 'With signableHeaders, an address to write takes one Content-Type and refuses a PUT with another. Without it, the bucket stores whatever type the browser says.',
      es: 'Con signableHeaders, una dirección para escribir acepta un solo Content-Type y rechaza un PUT con otro. Sin eso, el bucket guarda el tipo que diga el navegador.',
      zh: '使用 signableHeaders 后，写入地址只接受一种 Content-Type，其他类型的 PUT 会被拒绝。否则存储桶会保存浏览器声明的任意类型。',
    },
  },
  {
    title: { en: 'No checksums the browser cannot send.', es: 'Sin checksums que el navegador no pueda mandar.', zh: '不要使用浏览器无法发送的校验和。' },
    text: {
      en: 'Recent versions of the AWS SDK add a checksum to what they sign, as headers a browser does not send, and not every S3 takes them. The two WHEN_REQUIRED lines turn that off.',
      es: 'Las versiones recientes del SDK de AWS agregan un checksum a lo que firman, como encabezados que un navegador no manda, y no todo S3 los acepta. Las dos líneas WHEN_REQUIRED lo apagan.',
      zh: '新版 AWS SDK 会在签名中加入校验和（以浏览器不会发送的请求头形式），并非所有 S3 都支持。两行 WHEN_REQUIRED 配置可以关闭它。',
    },
  },
  {
    title: { en: 'The origin has to be allowed.', es: 'El origen tiene que estar permitido.', zh: '必须允许页面的来源。' },
    text: {
      en: 'A request the browser refuses before it is answered is, nearly always, the CORS rule: the port and the protocol are part of the origin.',
      es: 'Una petición que el navegador rechaza antes de que se responda es, casi siempre, la regla CORS: el puerto y el protocolo son parte del origen.',
      zh: '浏览器在收到响应前就拒绝的请求，几乎都是 CORS 规则的问题：端口和协议都是来源的一部分。',
    },
  },
  {
    title: { en: 'The last one to save wins.', es: 'Gana el último que guarda.', zh: '最后保存的人生效。' },
    text: {
      en: 'Two people on the same file overwrite each other. For several at once, see collaboration: its demo can keep its documents in this same bucket.',
      es: 'Dos personas en el mismo archivo se sobrescriben. Para varias a la vez, ve colaboración: su demo puede guardar sus documentos en este mismo bucket.',
      zh: '两个人编辑同一个文件会互相覆盖。多人同时编辑请参见“协作”：它的演示可以把文档保存在同一个存储桶中。',
    },
  },
  {
    title: { en: 'The PDF is made from what is stored,', es: 'El PDF se hace con lo guardado,', zh: 'PDF 基于已保存的内容生成，' },
    text: {
      en: 'not from what is on screen: save first. The button waits until the document is in the bucket.',
      es: 'no con lo que está en pantalla: guarda primero. El botón espera hasta que el documento esté en el bucket.',
      zh: '而不是屏幕上的内容：请先保存。按钮会等到文档写入存储桶后才执行。',
    },
  },
];
