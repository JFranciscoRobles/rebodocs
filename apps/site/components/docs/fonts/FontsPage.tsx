import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { getT } from '@/lib/locale';
import { CAPTION, CODE, LINK } from '../styles';
import { Callout, HandTip, SectionHead } from '../ui';
import { DOES, FUNCTIONS, KINDS, SOURCE } from './data';
import { LazyFontsDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/**
 * "Fonts": a font no machine has given to the editor on the page, how to give
 * one and its faces, what goes into the PDF and the DOCX by kind of file, and
 * the fonts a DOCX carries itself.
 */
export async function FontsPage() {
  const t = getT();
  const [prop, anywhere, css, faces, server] = await Promise.all([
    highlight(
      `<DocsEditor
  docx={file}
  fonts={[
    { family: 'Raleway', src: '/fonts/Raleway-Regular.ttf' },
    { family: 'Raleway', src: '/fonts/Raleway-Bold.ttf', bold: true },
    { family: 'Raleway', src: '/fonts/Raleway-Italic.ttf', italic: true },
  ]}
/>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { addFonts } from '@rebodocs/react';   // or '@rebodocs/editor'

const read = await addFonts([{ family: 'Raleway', src: '/fonts/Raleway-Regular.ttf' }]);
// [true]: false when the file could not be read`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `@font-face {
  font-family: 'Raleway';   /* the name the documents give it */
  src: url('/fonts/raleway.woff2') format('woff2');
}`,
      'css',
      LIGHT_THEME,
    ),
    highlight(`addFonts([{ family: 'Raleway' }]);   // listed, and waited for before the text is measured`, 'ts', LIGHT_THEME),
    highlight(
      `import { importDocx, readFont, renderPdf } from '@rebodocs/core';

const fonts = ['Raleway-Regular.ttf', 'Raleway-Bold.ttf'].flatMap((file) => readFont(readFileSync(\`fonts/\${file}\`)) ?? []);
const { pdf, missingFonts } = renderPdf(importDocx(bytes), fonts);`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{t({ en: 'Fonts', es: 'Fuentes', zh: '字体' })}</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: 'The editor measures and paints with the browser’s fonts, so any font the machine has already works. For one it does not have, your brand’s typeface or a letterhead’s, give the editor the file.',
          es: 'El editor mide y pinta con las fuentes del navegador, así que cualquier fuente que tenga la máquina ya funciona. Para una que no tiene, la tipografía de tu marca o la de un membrete, dale el archivo al editor.',
          zh: '编辑器使用浏览器的字体来测量和绘制，因此本机已有的任何字体都能直接使用。对于本机没有的字体，比如你的品牌字体或信头所用的字体，把字体文件交给编辑器即可。',
        })}
      </p>
      <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: prop }} />
      <div className="mt-4">
        <HandTip>
          {t({ en: 'tip: give the page below a font, then make a PDF', es: 'consejo: dale una fuente a la página de abajo y luego genera un PDF', zh: '提示：给下面的页面添加字体，然后生成 PDF' })}
        </HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'Give it a font', es: 'Dale una fuente', zh: '添加字体' })}>
          {t({
            en: 'Courier Prime is on almost no machine. Give it to the page, put the document in it, and make the files: the PDF and the DOCX say what they carry.',
            es: 'Courier Prime casi no está en ninguna máquina. Dásela a la página, pon el documento en ella y genera los archivos: el PDF y el DOCX dicen lo que llevan.',
            zh: '几乎没有电脑装有 Courier Prime。把它添加到页面，把文档设为该字体，然后生成文件：PDF 和 DOCX 会说明它们携带了什么。',
          })}
        </SectionHead>
        <LazyFontsDemo />
        <p className={prose}>
          {t({
            en: (
              <>
                Make the PDF before and after step 1: before, it names a standard font; after, it carries Courier Prime. The DOCX carries it only while its text is in it: whole, cut down with{' '}
                <code className={mono}>&apos;subset&apos;</code>, or not at all.
              </>
            ),
            es: (
              <>
                Genera el PDF antes y después del paso 1: antes, nombra una fuente estándar; después, lleva Courier Prime. El DOCX la lleva solo mientras su texto esté en ella: entera, recortada con{' '}
                <code className={mono}>&apos;subset&apos;</code>, o nada.
              </>
            ),
            zh: (
              <>
                在第 1 步之前和之后各生成一次 PDF：之前，它引用标准字体；之后，它嵌入了 Courier Prime。只有当文档文字使用该字体时，DOCX 才会携带它：完整嵌入、用{' '}
                <code className={mono}>&apos;subset&apos;</code> 精简嵌入，或者不嵌入。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="what-it-does" className="mt-24">
        <SectionHead
          id="what-it-does"
          badge={t({ en: 'Once given', es: 'Una vez dada', zh: '添加之后' })}
          color="blue"
          title={t({ en: 'What a font is used for', es: 'Para qué se usa una fuente', zh: '字体的用途' })}
        />
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
          {DOES.map((item) => (
            <div key={item.color} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[item.color]}`}>{t(item.title)}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{t(item.text)}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          {t({
            en: 'Fonts belong to the page, not to one editor: every editor on it uses them, and they stay once given. Giving the same face of the same family again with the same source does nothing, so a component that renders again does not load its fonts again; with another source, the new file takes its place.',
            es: 'Las fuentes son de la página, no de un editor: todos los editores de la página las usan, y se quedan una vez dadas. Volver a dar la misma variante de la misma familia con la misma fuente de origen no hace nada, así que un componente que se vuelve a renderizar no vuelve a cargar sus fuentes; con otro origen, el archivo nuevo toma su lugar.',
            zh: '字体属于页面，而不属于某个编辑器：页面上的所有编辑器都会使用它们，添加后就一直保留。用相同的来源再次添加同一字体族的同一字形不会有任何效果，因此组件重新渲染时不会重复加载字体；来源不同时，新文件会取而代之。',
          })}
        </p>
      </section>

      <section aria-labelledby="the-source" className="mt-24">
        <SectionHead id="the-source" badge={t({ en: 'Giving one', es: 'Dar una', zh: '添加字体' })} color="purple" title={t({ en: 'The source', es: 'El origen', zh: '来源' })}>
          {t({
            en: (
              <>
                The <code className={mono}>fonts</code> prop, also changed later: a font added to it is loaded then. Anywhere else, and at any time, there is <code className={mono}>addFonts</code>.
              </>
            ),
            es: (
              <>
                La prop <code className={mono}>fonts</code>, también cambiada después: una fuente añadida a ella se carga en ese momento. En cualquier otro lugar, y en cualquier momento, está{' '}
                <code className={mono}>addFonts</code>.
              </>
            ),
            zh: (
              <>
                使用 <code className={mono}>fonts</code> 属性，之后也可以修改：新加入的字体会在那时加载。在其他任何地方、任何时候，都可以使用 <code className={mono}>addFonts</code>。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: anywhere }} />
        <div className="mt-6 max-w-[860px] overflow-hidden rounded-2xl border border-border">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface">
              <tr>
                <th className={`${CAPTION} px-5 py-2.5`}>src</th>
                <th className={`${CAPTION} px-5 py-2.5`}>{t({ en: 'When', es: 'Cuándo', zh: '适用场景' })}</th>
              </tr>
            </thead>
            <tbody className="text-[15px] leading-normal text-ink-soft">
              {[
                [t({ en: 'An address', es: 'Una dirección', zh: '地址' }), t({ en: 'The file is fetched.', es: 'Se descarga el archivo.', zh: '会获取该文件。' })],
                [
                  t({ en: 'Bytes (ArrayBuffer, Uint8Array)', es: 'Bytes (ArrayBuffer, Uint8Array)', zh: '字节（ArrayBuffer、Uint8Array）' }),
                  t({
                    en: 'You already have it: from your API, a file input, a database.',
                    es: 'Ya lo tienes: de tu API, un input de archivo, una base de datos.',
                    zh: '你已经有了文件：来自你的 API、文件输入框或数据库。',
                  }),
                ],
                [
                  t({ en: 'Left out', es: 'Omitido', zh: '省略' }),
                  t({
                    en: 'The page loads the font itself, with an @font-face rule. The editor only lists it, and waits for it before measuring.',
                    es: 'La página carga la fuente por sí misma, con una regla @font-face. El editor solo la lista, y la espera antes de medir.',
                    zh: '页面通过 @font-face 规则自行加载字体。编辑器只列出它，并在测量前等待它加载完成。',
                  }),
                ],
              ].map(([src, when]) => (
                <tr key={src} className="border-t border-[#f0eee9]">
                  <td className="px-5 py-2.5 font-code text-[13.5px] text-ink">{src}</td>
                  <td className="px-5 py-2.5">{when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="m-0 mt-12 font-display text-xl font-bold tracking-[-0.01em]">
          {t({ en: 'A font the page loads itself', es: 'Una fuente que la página carga sola', zh: '由页面自行加载的字体' })}
        </h3>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: css }} />
        <div className={`mt-2 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: faces }} />
        <p className={prose}>
          {t({
            en: (
              <>
                The family must be the name the documents give the font. <code className={mono}>next/font</code> gives its fonts names of its own (<code className={mono}>__Raleway_a1b2c3</code>),
                which no document has: for those, give the file with <code className={mono}>src</code>. A font left out goes into neither the PDF nor the DOCX: there is no file to put in.
              </>
            ),
            es: (
              <>
                La familia debe ser el nombre que los documentos le dan a la fuente. <code className={mono}>next/font</code> les da a sus fuentes nombres propios (
                <code className={mono}>__Raleway_a1b2c3</code>), que ningún documento tiene: para esas, da el archivo con <code className={mono}>src</code>. Una fuente sin archivo no va ni en el PDF
                ni en el DOCX: no hay archivo que poner.
              </>
            ),
            zh: (
              <>
                字体族必须是文档中使用的字体名称。<code className={mono}>next/font</code> 会给字体起自己的名字（<code className={mono}>__Raleway_a1b2c3</code>
                ），没有文档会用这样的名字：对于这类字体，请用 <code className={mono}>src</code> 提供文件。省略文件的字体既不会进入 PDF，也不会进入 DOCX：因为没有文件可以放进去。
              </>
            ),
          })}
        </p>
        <h3 id="faces" className="m-0 mt-12 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          {t({ en: 'Faces', es: 'Variantes', zh: '字形' })}
        </h3>
        <p className={prose}>
          {t({
            en: (
              <>
                A family is given one face at a time: regular, bold, italic, each its own file. A face not given is imitated from the regular one, on screen by the browser, as on any web page, and in
                a PDF the same way: the letters drawn thicker, or slanted. An imitation is not the face its designer drew: give the four (bold italic is{' '}
                <code className={mono}>bold: true, italic: true</code>) for text in all of them.
              </>
            ),
            es: (
              <>
                Una familia se da variante por variante: normal, negrita, cursiva, cada una su archivo. Una variante no dada se imita a partir de la normal, en pantalla por el navegador, como en
                cualquier página web, y en un PDF de la misma forma: las letras dibujadas más gruesas, o inclinadas. Una imitación no es la variante que dibujó su diseñador: da las cuatro (negrita
                cursiva es <code className={mono}>bold: true, italic: true</code>) para texto en todas ellas.
              </>
            ),
            zh: (
              <>
                字体族的字形要逐个添加：常规、粗体、斜体，各自一个文件。没有提供的字形会由常规字形模拟出来：屏幕上由浏览器模拟（与任何网页一样），PDF
                中也是如此——把字母画得更粗或倾斜。模拟的效果并不是设计师绘制的字形：如果文字会用到全部四种字形，请都提供（粗斜体为 <code className={mono}>bold: true, italic: true</code>）。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="into-the-files" className="mt-24">
        <SectionHead id="into-the-files" badge={t({ en: 'PDF and DOCX', es: 'PDF y DOCX', zh: 'PDF 与 DOCX' })} color="pink" title={t({ en: 'Into the files', es: 'En los archivos', zh: '写入文件' })}>
          {t({
            en: 'What a font goes into depends on the kind of file it is.',
            es: 'En qué archivos va una fuente depende del tipo de archivo que sea.',
            zh: '字体会写入哪些文件，取决于字体文件的类型。',
          })}
        </SectionHead>
        <div className="mt-7 max-w-[920px] overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead className="bg-surface">
              <tr>
                <th className={`${CAPTION} px-5 py-2.5`}>{t({ en: 'File', es: 'Archivo', zh: '文件' })}</th>
                <th className={`${CAPTION} px-5 py-2.5`}>{t({ en: 'On screen', es: 'En pantalla', zh: '屏幕上' })}</th>
                <th className={`${CAPTION} px-5 py-2.5`}>{t({ en: 'In the PDF', es: 'En el PDF', zh: '在 PDF 中' })}</th>
                <th className={`${CAPTION} px-5 py-2.5`}>{t({ en: 'In the DOCX', es: 'En el DOCX', zh: '在 DOCX 中' })}</th>
              </tr>
            </thead>
            <tbody className="text-[15px] leading-normal text-ink-soft">
              {KINDS.map((row) => (
                <tr key={row.kind.en} className="border-t border-[#f0eee9]">
                  <td className="px-5 py-2.5 font-code text-[13.5px] text-ink">{t(row.kind)}</td>
                  <td className="px-5 py-2.5">{t(row.screen)}</td>
                  <td className={`px-5 py-2.5 ${row.none.pdf ? 'text-muted' : ''}`}>{t(row.pdf)}</td>
                  <td className={`px-5 py-2.5 ${row.none.docx ? 'text-muted' : ''}`}>{t(row.docx)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={prose}>
          {t({
            en: 'A PDF without the file names the standard font nearest the name: Courier for a monospaced one, Times for a serif, Helvetica for the rest. Words stay where the editor measured them, so lines keep their length, though the letters are not the font’s. Printing from the browser uses the font as shown, whatever its kind.',
            es: 'Un PDF sin el archivo nombra la fuente estándar más cercana al nombre: Courier para una monoespaciada, Times para una con serifa, Helvetica para el resto. Las palabras quedan donde el editor las midió, así que las líneas conservan su largo, aunque las letras no sean las de la fuente. Imprimir desde el navegador usa la fuente tal como se ve, sea del tipo que sea.',
            zh: '没有字体文件时，PDF 会引用与名称最接近的标准字体：等宽字体用 Courier，衬线字体用 Times，其他用 Helvetica。文字仍位于编辑器测量的位置，因此行长不变，只是字母不是该字体的样子。从浏览器打印时使用屏幕上显示的字体，无论其类型。',
          })}
        </p>
        <p className={prose}>
          {t({
            en: 'Chinese and Japanese characters the font has not are drawn in the font for them the document carries, given as the font of its Chinese text; or else in the one every PDF reader has: STSong-Light for Simplified Chinese, MSung-Light for Taiwan and Hong Kong, KozMinPro-Regular for Japanese.',
            es: 'Los caracteres chinos y japoneses que la fuente no tiene se dibujan en la fuente para ellos que lleva el documento, dada como fuente de su texto chino; o si no, en la que tiene todo lector de PDF: STSong-Light para chino simplificado, MSung-Light para Taiwán y Hong Kong, KozMinPro-Regular para japonés.',
            zh: '字体中没有的中文和日文字符，会使用文档携带的、作为中文文字字体设置的字体来绘制；如果没有，则使用所有 PDF 阅读器都具备的字体：简体中文用 STSong-Light，台湾和香港用 MSung-Light，日文用 KozMinPro-Regular。',
          })}
        </p>
        <h3 id="docx" className="m-0 mt-12 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          {t({ en: 'The DOCX', es: 'El DOCX', zh: 'DOCX' })}
        </h3>
        <p className={prose}>
          {t({
            en: 'The faces go in when some text of the document is in their family, its tables, headers, footers and styles included, as Word embeds fonts: someone who opens the file without the font installed sees it all the same. A font whose licence says it may not be embedded, or only as pictures, stays out.',
            es: 'Las variantes entran cuando algún texto del documento está en su familia, incluidas sus tablas, encabezados, pies de página y estilos, como incrusta Word las fuentes: quien abra el archivo sin la fuente instalada la ve igual. Una fuente cuya licencia dice que no puede incrustarse, o solo como imágenes, se queda fuera.',
            zh: '只要文档中有文字（包括表格、页眉、页脚和样式中的文字）使用某个字体族，它的字形就会被嵌入，与 Word 嵌入字体的方式相同：未安装该字体的人打开文件也能看到同样的效果。许可证规定不得嵌入或只能以图片形式嵌入的字体不会被嵌入。',
          })}
        </p>
        <div className="mt-6 max-w-[860px] overflow-hidden rounded-2xl border border-border">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface">
              <tr>
                <th className={`${CAPTION} px-5 py-2.5`}>embedFonts</th>
                <th className={`${CAPTION} px-5 py-2.5`}>{t({ en: 'The font goes', es: 'La fuente va', zh: '字体的嵌入方式' })}</th>
              </tr>
            </thead>
            <tbody className="text-[15px] leading-normal text-ink-soft">
              {[
                [
                  t({ en: 'true (default)', es: 'true (por defecto)', zh: 'true（默认）' }),
                  t({
                    en: 'Whole, as Word embeds it. Whoever opens the file can type anything in it.',
                    es: 'Entera, como la incrusta Word. Quien abra el archivo puede escribir cualquier cosa en ella.',
                    zh: '完整嵌入，与 Word 相同。打开文件的人可以用它输入任何内容。',
                  }),
                ],
                [
                  "'subset'",
                  t({
                    en: 'Cut down to the characters of the document and of the keyboard, as Word’s “Embed only the characters used”: a much smaller file. A character typed later that it does not keep shows in another font for whoever lacks the font. Whole when the licence says it may not be cut down.',
                    es: 'Recortada a los caracteres del documento y del teclado, como el “Incrustar solo los caracteres utilizados” de Word: un archivo mucho más pequeño. Un carácter escrito después que no conserva se ve en otra fuente para quien no tenga la fuente. Entera cuando la licencia dice que no puede recortarse.',
                    zh: '精简为文档中和键盘上的字符，与 Word 的“仅嵌入文档中使用的字符”相同：文件会小得多。之后输入的、未包含在内的字符，在没有该字体的电脑上会以其他字体显示。许可证规定不得精简时则完整嵌入。',
                  }),
                ],
                ['false', t({ en: 'Not at all.', es: 'No va.', zh: '不嵌入。' })],
              ].map(([value, goes]) => (
                <tr key={value} className="border-t border-[#f0eee9]">
                  <td className="whitespace-nowrap px-5 py-2.5 font-code text-[13.5px] text-ink">{value}</td>
                  <td className="px-5 py-2.5">{goes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={prose}>
          {t({
            en: (
              <>
                On <code className={mono}>DocsEditor</code> and <code className={mono}>DocsProvider</code> it is a prop, followed when it changes; on the editor,{' '}
                <code className={mono}>editor.embedFonts</code>.
              </>
            ),
            es: (
              <>
                En <code className={mono}>DocsEditor</code> y <code className={mono}>DocsProvider</code> es una prop, seguida cuando cambia; en el editor,{' '}
                <code className={mono}>editor.embedFonts</code>.
              </>
            ),
            zh: (
              <>
                在 <code className={mono}>DocsEditor</code> 和 <code className={mono}>DocsProvider</code> 上它是一个属性，修改后会生效；在编辑器上是 <code className={mono}>editor.embedFonts</code>。
              </>
            ),
          })}
        </p>
        <Callout title={t({ en: 'PDF needs .ttf or .otf.', es: 'El PDF necesita .ttf u .otf.', zh: 'PDF 需要 .ttf 或 .otf。' })}>
          {t({
            en: 'A .woff2 shows and measures as well, but the PDF draws its text in a standard font. Serve a .ttf for the editor even when the page uses .woff2.',
            es: 'Un .woff2 se ve y se mide igual de bien, pero el PDF dibuja su texto en una fuente estándar. Sirve un .ttf para el editor aunque la página use .woff2.',
            zh: '.woff2 同样可以显示和测量，但 PDF 会用标准字体绘制它的文字。即使页面使用 .woff2，也请为编辑器提供 .ttf。',
          })}
        </Callout>
      </section>

      <section aria-labelledby="fonts-a-docx-carries" className="mt-24">
        <SectionHead
          id="fonts-a-docx-carries"
          badge={t({ en: 'In the file', es: 'En el archivo', zh: '文件中' })}
          color="orange"
          title={t({ en: 'Fonts a DOCX carries', es: 'Fuentes que lleva un DOCX', zh: 'DOCX 自带的字体' })}
        />
        <p className={prose}>
          {t({
            en: 'A DOCX saved by Word with its fonts embedded brings them along. The editor uses the ones this machine lacks, laying the document out again once they load, and draws its PDFs with them before any font given. Saving keeps them in the file. They are of that document: they are not listed in the toolbar, and they go when another document is opened.',
            es: 'Un DOCX guardado por Word con sus fuentes incrustadas las trae consigo. El editor usa las que le faltan a esta máquina, volviendo a componer el documento cuando cargan, y dibuja sus PDF con ellas antes que con cualquier fuente dada. Al guardar se conservan en el archivo. Son de ese documento: no se listan en la barra, y se van cuando se abre otro documento.',
            zh: 'Word 保存时嵌入了字体的 DOCX 会自带这些字体。编辑器会使用本机缺少的字体，加载后重新排版文档，并在生成 PDF 时优先使用它们，然后才是添加的字体。保存时它们会保留在文件中。这些字体只属于该文档：不会列在工具栏中，打开其他文档时就会移除。',
          })}
        </p>
      </section>

      <section aria-labelledby="on-a-server" className="mt-24">
        <SectionHead id="on-a-server" badge={t({ en: 'No browser', es: 'Sin navegador', zh: '无浏览器' })} color="yellow" title={t({ en: 'On a server', es: 'En un servidor', zh: '在服务器上' })}>
          {t({
            en: (
              <>
                With no browser, <code className={mono}>addFont</code> does nothing and says false. The width of text is read from font files given to <code className={mono}>renderPdf</code>.
              </>
            ),
            es: (
              <>
                Sin navegador, <code className={mono}>addFont</code> no hace nada y dice false. El ancho del texto se lee de los archivos de fuente dados a <code className={mono}>renderPdf</code>.
              </>
            ),
            zh: (
              <>
                没有浏览器时，<code className={mono}>addFont</code> 什么也不做，并返回 false。文字宽度从传给 <code className={mono}>renderPdf</code> 的字体文件中读取。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: server }} />
        <p className={prose}>
          {t({
            en: (
              <>
                See{' '}
                <LocalLink href="/docs/server/" className={LINK}>
                  On a server
                </LocalLink>
                : <code className={mono}>missingFonts</code>, what stands in, and the fonts of the system.
              </>
            ),
            es: (
              <>
                Mira{' '}
                <LocalLink href="/docs/server/" className={LINK}>
                  En un servidor
                </LocalLink>
                : <code className={mono}>missingFonts</code>, qué la sustituye y las fuentes del sistema.
              </>
            ),
            zh: (
              <>
                参见
                <LocalLink href="/docs/server/" className={LINK}>
                  在服务器上
                </LocalLink>
                ：<code className={mono}>missingFonts</code>、替代字体以及系统字体。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                Text is kerned as Word kerns it: the pairs of letters the font file lists are set closer, a space and the letter after it too, in a run as big as its{' '}
                <code className={mono}>w:kern</code> or bigger. The PDF moves the letters of each pair together, from the file. In the editor the browser kerns them, from another table of the font,
                and leaves out the pairs with a space of Times New Roman, so a line of it can be a fraction of a point apart from Word&apos;s on screen, not in the PDF.
              </>
            ),
            es: (
              <>
                El texto se ajusta como lo ajusta Word: los pares de letras que lista el archivo de la fuente se acercan, también un espacio y la letra que lo sigue, en un run tan grande como su{' '}
                <code className={mono}>w:kern</code> o más. El PDF junta las letras de cada par, según el archivo. En el editor las ajusta el navegador, con otra tabla de la fuente, y deja fuera los
                pares con espacio de Times New Roman, así que una línea suya puede diferir en una fracción de punto de la de Word en pantalla, no en el PDF.
              </>
            ),
            zh: (
              <>
                字距调整与 Word 相同：对于大小不小于其 <code className={mono}>w:kern</code> 的 run，字体文件中列出的字母对会靠得更近，空格与其后的字母也是如此。PDF
                根据字体文件把每对字母移近。在编辑器中由浏览器根据字体的另一张表来调整，并且会忽略 Times New Roman 中含空格的字母对，因此屏幕上的一行可能与 Word 相差几分之一磅，但 PDF 中不会。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="from-code" className="mt-24">
        <SectionHead id="from-code" badge={t({ en: 'Reference', es: 'Referencia', zh: '参考' })} color="blue" title={t({ en: 'From code', es: 'Desde código', zh: '在代码中' })}>
          {t({
            en: (
              <>
                From <code className={mono}>@rebodocs/react</code> or <code className={mono}>@rebodocs/editor</code>; the last two, from <code className={mono}>@rebodocs/editor</code> only.
              </>
            ),
            es: (
              <>
                De <code className={mono}>@rebodocs/react</code> o <code className={mono}>@rebodocs/editor</code>; las dos últimas, solo de <code className={mono}>@rebodocs/editor</code>.
              </>
            ),
            zh: (
              <>
                来自 <code className={mono}>@rebodocs/react</code> 或 <code className={mono}>@rebodocs/editor</code>；最后两个只来自 <code className={mono}>@rebodocs/editor</code>。
              </>
            ),
          })}
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {FUNCTIONS.map((fn) => (
            <div key={fn.name} id={`fn-${fn.name}`} className="scroll-mt-24 border-t border-[#f0eee9] py-3.5 first:border-t-0">
              <dt className="font-code text-[13.5px] text-ink">
                <span className="font-semibold">{fn.signature}</span> <span className="text-muted">→ {fn.returns}</span>
                {fn.editorOnly && <span className={`ml-2 rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold ${PASTEL_CLASS.purple}`}>editor</span>}
              </dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{t(fn.text)}</dd>
            </div>
          ))}
        </dl>
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">FontSource</h3>
        <dl className="m-0 mt-4 max-w-[920px] rounded-2xl border border-border px-5">
          {SOURCE.map((field) => (
            <div key={field.name} className="border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="font-code text-[13.5px] text-ink">
                <span className="font-semibold">{field.name}</span>
                {field.name !== 'family' && '?'}: <span className="text-muted">{field.type}</span>
              </dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{t(field.text)}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          {t({
            en: (
              <>
                On <code className={mono}>DocsEditor</code> and <code className={mono}>DocsProvider</code>, <code className={mono}>fonts?: FontSource[]</code> and{' '}
                <code className={mono}>embedFonts?: boolean | &apos;subset&apos;</code>, both followed when they change. A list of the same fonts in a new array is not read again.
              </>
            ),
            es: (
              <>
                En <code className={mono}>DocsEditor</code> y <code className={mono}>DocsProvider</code>, <code className={mono}>fonts?: FontSource[]</code> y{' '}
                <code className={mono}>embedFonts?: boolean | &apos;subset&apos;</code>, ambas seguidas cuando cambian. Una lista de las mismas fuentes en un array nuevo no se vuelve a leer.
              </>
            ),
            zh: (
              <>
                在 <code className={mono}>DocsEditor</code> 和 <code className={mono}>DocsProvider</code> 上有 <code className={mono}>fonts?: FontSource[]</code> 和{' '}
                <code className={mono}>embedFonts?: boolean | &apos;subset&apos;</code>，修改后都会生效。以新数组传入相同的字体列表不会重新读取。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge={t({ en: 'Limits', es: 'Límites', zh: '限制' })} color="yellow" title={t({ en: 'What to know', es: 'Qué saber', zh: '注意事项' })} />
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            t({
              en: 'There is no taking a font away once given; a page reload starts without it.',
              es: 'Una fuente dada no se puede quitar; al recargar la página se empieza sin ella.',
              zh: '字体添加后无法移除；重新加载页面后就没有了。',
            }),
            t({
              en: 'A font that loads after the document is open lays every page out again: lines and page breaks can move under the person’s eyes. Give fonts before opening, or wait for addFonts.',
              es: 'Una fuente que carga después de abrir el documento vuelve a componer cada página: las líneas y los saltos de página pueden moverse ante los ojos de la persona. Da las fuentes antes de abrir, o espera a addFonts.',
              zh: '文档打开后才加载的字体会让每一页重新排版：行和分页可能在用户眼前移动。请在打开文档前添加字体，或等待 addFonts 完成。',
            }),
            t({
              en: 'The file is fetched by the browser: an address on another domain needs CORS.',
              es: 'El archivo lo descarga el navegador: una dirección de otro dominio necesita CORS.',
              zh: '文件由浏览器获取：其他域名的地址需要配置 CORS。',
            }),
            t({
              en: "A DOCX carries each face whole unless embedFonts is 'subset': a font of 300 KB makes the file 300 KB larger.",
              es: "Un DOCX lleva cada variante entera salvo que embedFonts sea 'subset': una fuente de 300 KB agranda el archivo 300 KB.",
              zh: "除非 embedFonts 为 'subset'，否则 DOCX 会完整嵌入每种字形：300 KB 的字体会让文件增大 300 KB。",
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
