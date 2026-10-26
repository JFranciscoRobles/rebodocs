import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { InstallCommand } from '../InstallCommand';
import { LazyViewerDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** What the package exports, from packages/viewer/src/index.ts and react.ts. */
const API: { call: string; text: L }[] = [
  {
    call: 'createViewer(element, docx, { layout?, bar? })',
    text: {
      en: 'The document read only in an element that has a size. docx is the bytes of a .docx (Uint8Array or ArrayBuffer) or a Doc already read. layout: "pages", as it comes, or "all"; bar: false to leave the bar out.',
      es: 'El documento en solo lectura en un elemento que tiene tamaño. docx son los bytes de un .docx (Uint8Array o ArrayBuffer) o un Doc ya leído. layout: "pages", como viene, o "all"; bar: false para dejar fuera la barra.',
      zh: '在一个有尺寸的元素中以只读方式显示文档。docx 是 .docx 的字节（Uint8Array 或 ArrayBuffer），或已读取的 Doc。layout：默认 "pages"，或 "all"；bar: false 表示不显示工具条。',
    },
  },
  {
    call: 'viewer.setLayout("pages" | "all")',
    text: {
      en: 'One page under another, each whole on the screen; or every page at once, as large as lets them fit, down to a least size for a long document.',
      es: 'Una página debajo de otra, cada una completa en la pantalla; o todas las páginas a la vez, tan grandes como permita que quepan, hasta un tamaño mínimo para un documento largo.',
      zh: '逐页向下排列，每页完整显示在屏幕上；或一次显示所有页面，尽可能放大到恰好放得下，长文档则缩小到某个最小尺寸为止。',
    },
  },
  {
    call: 'viewer.print()',
    text: {
      en: 'The print dialog of the browser, with the pages as they are laid out: to paper, or to a PDF.',
      es: 'El diálogo de impresión del navegador, con las páginas tal como están maquetadas: a papel, o a un PDF.',
      zh: '打开浏览器的打印对话框，按当前排版打印页面：打印到纸上或保存为 PDF。',
    },
  },
  {
    call: 'viewer.pages, viewer.layout',
    text: { en: 'How many pages it has, and how they are set out now.', es: 'Cuántas páginas tiene, y cómo están dispuestas ahora.', zh: '页数，以及当前的排列方式。' },
  },
  {
    call: 'viewer.editor',
    text: {
      en: 'The Editor that draws the pages, read only: its zoom, its fit, its events, for an application that leaves the bar out.',
      es: 'El Editor que dibuja las páginas, en solo lectura: su zoom, su ajuste, sus eventos, para una aplicación que deja fuera la barra.',
      zh: '绘制页面的只读 Editor：它的缩放、适应方式和事件，供不使用工具条的应用调用。',
    },
  },
  { call: 'viewer.destroy()', text: { en: 'Takes it away, with its bar.', es: 'Lo quita, con su barra.', zh: '移除查看器及其工具条。' } },
  {
    call: '<DocsViewer docx layout? bar? locale? onReady? />',
    text: {
      en: 'The same, in React, from @rebodocs/viewer/react. It takes the height of what it is in; onReady gives the viewer, and nothing once it is gone.',
      es: 'Lo mismo, en React, desde @rebodocs/viewer/react. Toma la altura de lo que lo contiene; onReady da el visor, y nada una vez que se fue.',
      zh: '同样的功能，React 版本，位于 @rebodocs/viewer/react。高度取自容器；onReady 会传入查看器，移除后传入空值。',
    },
  },
  {
    call: 'pagePicture(docx, size, { type?, quality? })',
    text: {
      en: 'The first page as a picture, a JPEG unless type says "image/png", its longest side size pixels.',
      es: 'La primera página como imagen, un JPEG salvo que type diga "image/png", con su lado más largo de size píxeles.',
      zh: '把首页输出为图片：默认 JPEG，type 为 "image/png" 时输出 PNG，最长边为 size 像素。',
    },
  },
  {
    call: 'pageThumbnail(docx)',
    text: {
      en: 'The first page as the element the editor draws, at its real size (data-width and data-height say it), its pictures in it as data: to show made smaller.',
      es: 'La primera página como el elemento que dibuja el editor, a su tamaño real (data-width y data-height lo dicen), con sus imágenes dentro como datos: para mostrarla más pequeña.',
      zh: '把首页输出为编辑器绘制的元素，保持实际尺寸（由 data-width 和 data-height 给出），图片以 data URL 内嵌：适合缩小后展示。',
    },
  },
  {
    call: 'setLocale, addLocale, addFonts',
    text: {
      en: 'The language of the bar, and the fonts a document is written in when the system has not got them.',
      es: 'El idioma de la barra, y las fuentes en que está escrito un documento cuando el sistema no las tiene.',
      zh: '工具条的语言，以及系统中没有、但文档用到的字体。',
    },
  },
];

/**
 * "A document only to read": @rebodocs/viewer on the sample agreement; the
 * smallest page, with React and without; what it has; thumbnails; phones;
 * and what it weighs beside the whole editor.
 */
export async function ViewerPage() {
  const t = getT();
  const [vanilla, react, thumbs] = await Promise.all([
    highlight(
      `import { createViewer, setLocale } from '@rebodocs/viewer';

setLocale('es');
const bytes = new Uint8Array(await (await fetch('/contract.docx')).arrayBuffer());
const viewer = createViewer(document.querySelector('#pages')!, bytes); // #pages has a height

viewer.setLayout('all');
viewer.print();
viewer.destroy();`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `'use client';
import { DocsViewer } from '@rebodocs/viewer/react';

export function Contract({ file }: { file: Uint8Array }) {
  return (
    <div style={{ height: '80vh' }}>
      <DocsViewer docx={file} locale="es" onReady={(viewer) => (printer.current = viewer)} />
    </div>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { pagePicture } from '@rebodocs/viewer';

const jpeg = await pagePicture(bytes, 480);   // a Blob: its longest side 480 pixels
img.src = URL.createObjectURL(jpeg);
await upload(\`thumbnails/\${id}.jpg\`, jpeg);  // or keep it beside the file`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  const rows = (list: { call: string; text: L }[]) => (
    <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
      {list.map((row) => (
        <div key={row.call} className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0">
          <dt className="font-code text-[13.5px] font-semibold text-ink [overflow-wrap:anywhere]">{row.call}</dt>
          <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(row.text)}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {t({ en: 'A document only to read', es: 'Un documento solo para leer', zh: '只读文档' })}
      </h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        <a href="https://www.npmjs.com/package/@rebodocs/viewer" className={LINK}>
          @rebodocs/viewer
        </a>{' '}
        {t({
          en: 'is for an application that shows documents and does not edit them: a file manager, a preview, a page where a client reads a contract. The pages are those of the editor, read only, with a bar to zoom and print, and the first page of a document as a thumbnail.',
          es: 'es para una aplicación que muestra documentos y no los edita: un administrador de archivos, una vista previa, una página donde un cliente lee un contrato. Las páginas son las del editor, en solo lectura, con una barra para hacer zoom e imprimir, y la primera página de un documento como miniatura.',
          zh: '适用于只展示、不编辑文档的应用：文件管理器、预览、让客户阅读合同的页面。页面与编辑器相同但只读，带有缩放和打印工具条，还能把文档首页生成缩略图。',
        })}
      </p>
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: set the pages out both ways below', es: 'tip: acomoda las páginas de las dos formas abajo', zh: '提示：在下方试试两种页面排列方式' })}</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'See it', es: 'Míralo', zh: '看一看' })}>
          {t({
            en: (
              <>
                The sample agreement in <code className={mono}>DocsViewer</code>, and its first page made into a picture beside it, in this page.
              </>
            ),
            es: (
              <>
                El contrato de ejemplo en <code className={mono}>DocsViewer</code>, y su primera página convertida en imagen a su lado, en esta página.
              </>
            ),
            zh: (
              <>
                示例协议显示在 <code className={mono}>DocsViewer</code> 中，旁边是在本页面中把首页转换成的图片。
              </>
            ),
          })}
        </SectionHead>
        <LazyViewerDemo />
        <p className={prose}>
          {t({
            en: 'The bar over the pages says the page in view, as they scroll; its views do what the buttons above do. Nothing on the pages can be selected to change: there is no caret.',
            es: 'La barra sobre las páginas dice la página a la vista, mientras se desplazan; sus vistas hacen lo mismo que los botones de arriba. Nada en las páginas se puede seleccionar para cambiarlo: no hay cursor.',
            zh: '页面上方的工具条会随滚动显示当前可见的页码；它的视图按钮与上方按钮的作用相同。页面上的内容无法选中修改：没有光标。',
          })}
        </p>
      </section>

      <section aria-labelledby="start" className="mt-24">
        <SectionHead id="start" badge={t({ en: 'Start', es: 'Inicio', zh: '开始' })} color="blue" title={t({ en: 'The smallest page', es: 'La página más pequeña', zh: '最小的页面' })}>
          {t({
            en: 'The bytes of a .docx and an element with a height: there is no document to read first.',
            es: 'Los bytes de un .docx y un elemento con altura: no hay que leer el documento antes.',
            zh: '只需 .docx 的字节和一个有高度的元素：无需先读取文档。',
          })}
        </SectionHead>
        <div className="mt-6 max-w-[760px]">
          <InstallCommand command="npm install @rebodocs/viewer" />
        </div>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: vanilla }} />
        <p className={prose}>
          {t({
            en: 'In React, from the entry of its own; it is safe to render on a server, where it draws an empty element, and mounts in the browser:',
            es: 'En React, desde su propia entrada; se puede renderizar en un servidor, donde dibuja un elemento vacío, y se monta en el navegador:',
            zh: 'React 版本使用独立的入口；可以安全地在服务器端渲染（输出空元素），并在浏览器中挂载：',
          })}
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: react }} />
        <p className={prose}>
          {t({
            en: 'React is an optional peer: npm does not install it for a page without React. An application that already has ',
            es: 'React es un peer opcional: npm no lo instala para una página sin React. Una aplicación que ya tiene ',
            zh: 'React 是可选的 peer 依赖：没有 React 的页面不会安装它。已经使用 ',
          })}
          <LocalLink href="/docs/react/" className={LINK}>
            @rebodocs/react
          </LocalLink>
          {t({
            en: (
              <>
                {' '}
                has the same <code className={mono}>DocsViewer</code> in it, and needs nothing more.
              </>
            ),
            es: (
              <>
                {' '}
                tiene el mismo <code className={mono}>DocsViewer</code> dentro, y no necesita nada más.
              </>
            ),
            zh: (
              <>
                {' '}
                的应用已经包含同样的 <code className={mono}>DocsViewer</code>，无需再安装其他东西。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="what-it-has" className="mt-24">
        <SectionHead id="what-it-has" badge="API" color="purple" title={t({ en: 'What it has', es: 'Qué tiene', zh: '它包含什么' })} />
        {rows(API)}
      </section>

      <section aria-labelledby="thumbnails" className="mt-24">
        <SectionHead id="thumbnails" badge={t({ en: 'Thumbnails', es: 'Miniaturas', zh: '缩略图' })} color="yellow" title={t({ en: 'Thumbnails', es: 'Miniaturas', zh: '缩略图' })}>
          {t({
            en: 'The first page as the editor draws it: laid out out of sight, one document at a time, and drawn on a canvas with its pictures.',
            es: 'La primera página tal como la dibuja el editor: maquetada fuera de la vista, un documento a la vez, y dibujada en un canvas con sus imágenes.',
            zh: '与编辑器绘制效果一致的首页：在不可见处逐份文档排版，再连同图片绘制到 canvas 上。',
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: thumbs }} />
        <p className={prose}>
          {t({
            en: 'It needs a browser: a picture is made in the page that has the file, and kept by the application if it wants it again. A font the document carries is drawn in the nearest one the system has.',
            es: 'Necesita un navegador: la imagen se hace en la página que tiene el archivo, y la aplicación la guarda si la quiere de nuevo. Una fuente que lleva el documento se dibuja con la más parecida que tenga el sistema.',
            zh: '它需要浏览器：图片在持有文件的页面中生成，应用如需再次使用可以自行保存。文档自带的字体会用系统中最接近的字体绘制。',
          })}
        </p>
      </section>

      <section aria-labelledby="on-a-phone" className="mt-24">
        <SectionHead id="on-a-phone" badge={t({ en: 'Phones', es: 'Teléfonos', zh: '手机' })} color="pink" title={t({ en: 'On a phone', es: 'En un teléfono', zh: '在手机上' })}>
          {t({
            en: 'The pages are the same on a phone, only smaller: one fits the width of the screen, and the text is not set out again for it.',
            es: 'Las páginas son las mismas en un teléfono, solo más pequeñas: una cabe en el ancho de la pantalla, y el texto no se reacomoda por eso.',
            zh: '在手机上页面完全相同，只是更小：一页恰好占满屏幕宽度，文字不会因此重新排版。',
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: (
              <>
                The buttons of the bar make the pages larger, and the pages are then moved sideways with a finger; what does not fit in the bar is left out, what matters least first.{' '}
                <code className={mono}>apps/viewer</code> in the repository is a shelf of documents with their thumbnails, made to be tried on a phone: its server listens on the network.
              </>
            ),
            es: (
              <>
                Los botones de la barra agrandan las páginas, y luego las páginas se mueven de lado con un dedo; lo que no cabe en la barra se deja fuera, lo menos importante primero.{' '}
                <code className={mono}>apps/viewer</code> en el repositorio es un estante de documentos con sus miniaturas, hecho para probarse en un teléfono: su servidor escucha en la red.
              </>
            ),
            zh: (
              <>
                工具条上的按钮可以放大页面，放大后用手指左右拖动；工具条放不下的按钮会被隐藏，最不重要的先隐藏。仓库中的 <code className={mono}>apps/viewer</code>{' '}
                是一个带缩略图的文档书架，专为在手机上试用而做：它的服务器监听局域网。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="what-it-weighs" className="mt-24">
        <SectionHead id="what-it-weighs" badge={t({ en: 'Size', es: 'Tamaño', zh: '体积' })} color="orange" title={t({ en: 'What it weighs', es: 'Cuánto pesa', zh: '体积' })}>
          {t({
            en: 'It brings @rebodocs/editor and @rebodocs/core with it, and a bundler keeps of them what the viewer uses.',
            es: 'Trae consigo @rebodocs/editor y @rebodocs/core, y un bundler conserva de ellos lo que usa el visor.',
            zh: '它会带上 @rebodocs/editor 和 @rebodocs/core，打包工具只会保留查看器用到的部分。',
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: (
              <>
                Built into an application, <code className={mono}>createViewer</code> is about 160 KB compressed with gzip, and the whole editor with its interface about 260 KB. Most of it is the
                engine that lays the pages out as Word does, which a viewer needs as much as an editor.
              </>
            ),
            es: (
              <>
                Compilado en una aplicación, <code className={mono}>createViewer</code> pesa unos 160 KB comprimido con gzip, y el editor completo con su interfaz unos 260 KB. La mayor parte es el
                motor que maqueta las páginas como Word, que un visor necesita tanto como un editor.
              </>
            ),
            zh: (
              <>
                打包进应用后，<code className={mono}>createViewer</code> 经 gzip 压缩约 160 KB，而带界面的完整编辑器约 260 KB。其中大部分是按 Word 规则排版页面的引擎，查看器和编辑器同样需要它。
              </>
            ),
          })}
        </p>
      </section>
    </>
  );
}
