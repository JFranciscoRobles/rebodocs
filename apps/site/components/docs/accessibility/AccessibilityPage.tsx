import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { HEARD, KEYS, NOT_CHECKED, PARTS, PDF_TAGS, SEEN } from './data';
import { LazyListenDemo, LazyPdfDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const COLORS = ['blue', 'purple', 'yellow', 'green', 'pink', 'orange'] as const;

function Cards({ rows, min = 260 }: { rows: { title: L; text: L }[]; min?: number }) {
  const t = getT();
  return (
    <div className="mt-7 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${min}px),1fr))` }}>
      {rows.map((card, i) => (
        <div key={card.title.en} className="rounded-2xl border border-border p-5">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i % COLORS.length]]}`}>{t(card.title)}</span>
          <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{t(card.text)}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * "Accessibility": what a screen reader hears from a real editor, written down
 * as it is said; screen reader mode; the keys; what is seen; what an
 * interface of your own has to do; and what has not been checked.
 */
export async function AccessibilityPage() {
  const t = getT();
  const [mode, own, alt, pdf] = await Promise.all([
    highlight(`editor.screenReader = true;   // or let the person press ⌘⌥Z (Ctrl+Alt+Z)`, 'ts', LIGHT_THEME),
    highlight(
      `editor.announce('Document saved');        // said when the screen reader is free
editor.announce('Could not save', true);   // said at once, over what it was saying`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { altText, setAltText } from '@rebodocs/core';

altText(run.props.object);                              // 'Plan of the flat: …', or undefined
doc = setAltText(doc, { para: 7, offset: 0 }, 'Plan of the flat: a living room and two bedrooms');`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `const { pdf } = renderPdf(doc, fonts, 'Lease of the flat', 'es-MX');   // on a server
const bytes = await editor.exportPdf('Lease of the flat');            // in the browser, in the language of the text`,
      'ts',
      LIGHT_THEME,
    ),
  ]);
  const dot = t({ en: '.', es: '.', zh: '。' });

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{t({ en: 'Accessibility', es: 'Accesibilidad', zh: '无障碍' })}</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: 'The pages are drawn as positioned pieces of text a screen reader cannot follow. So the editor tells the screen reader what happens instead, and every part around the pages works from the keyboard. It follows WCAG 2.2 at level AA, with the exceptions said below.',
          es: 'Las páginas se dibujan como trozos de texto posicionados que un lector de pantalla no puede seguir. Así que el editor le dice al lector de pantalla lo que pasa, y cada parte alrededor de las páginas funciona desde el teclado. Sigue WCAG 2.2 en nivel AA, con las excepciones que se dicen abajo.',
          zh: '页面由定位好的文字片段绘制而成，屏幕阅读器无法直接跟随。因此编辑器会主动告诉屏幕阅读器发生了什么，页面周围的每个部分也都能用键盘操作。它遵循 WCAG 2.2 AA 级标准，例外情况见下文。',
        })}
      </p>
      <div className="mt-4">
        <HandTip>
          {t({
            en: 'tip: move with the arrows in the document below, and read what a screen reader would say',
            es: 'tip: muévete con las flechas en el documento de abajo, y lee lo que diría un lector de pantalla',
            zh: '提示：在下方文档中用方向键移动，看看屏幕阅读器会朗读什么',
          })}
        </HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead
          id="try"
          badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })}
          color="green"
          title={t({ en: 'What a screen reader hears', es: 'Lo que oye un lector de pantalla', zh: '屏幕阅读器听到什么' })}
        >
          {t({
            en: (
              <>
                A real editor and its live regions, the hidden places a screen reader reads aloud: each line is something it would say. A <code className={mono}>!</code> is said at once, over what it
                was saying; a dot, when it is free.
              </>
            ),
            es: (
              <>
                Un editor real y sus regiones en vivo, los lugares ocultos que un lector de pantalla lee en voz alta: cada línea es algo que diría. Un <code className={mono}>!</code> se dice de
                inmediato, encima de lo que estaba diciendo; un punto, cuando está libre.
              </>
            ),
            zh: (
              <>
                一个真实的编辑器及其实时区域——屏幕阅读器会朗读的隐藏位置：每一行都是它会说的话。标有 <code className={mono}>!</code> 的内容会立即朗读，打断正在朗读的内容；标有圆点的则在空闲时朗读。
              </>
            ),
          })}
        </SectionHead>
        <LazyListenDemo />
        <p className={prose}>
          {t({
            en: (
              <>
                The field that has the keyboard is called “Document”, and its description gives the keys to leave it. The pages, the caret and the selection are hidden from screen readers (
                <code className={mono}>aria-hidden</code>): what they show is said.
              </>
            ),
            es: (
              <>
                El campo que tiene el teclado se llama “Documento”, y su descripción da las teclas para salir de él. Las páginas, el cursor y la selección están ocultos para los lectores de pantalla (
                <code className={mono}>aria-hidden</code>): lo que muestran se dice.
              </>
            ),
            zh: (
              <>
                拥有键盘焦点的输入框名为“文档”，其描述中给出了离开它的按键。页面、光标和选区对屏幕阅读器隐藏（<code className={mono}>aria-hidden</code>）：它们显示的内容会被朗读出来。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="heard" className="mt-24">
        <SectionHead id="heard" badge={t({ en: 'Spoken', es: 'Hablado', zh: '朗读' })} color="blue" title={t({ en: 'What is said', es: 'Lo que se dice', zh: '朗读的内容' })}>
          {t({
            en: 'After each key. What the editor says is in the language of the interface; the text of the document, in the language of the text, so a screen reader reads each with its own voice.',
            es: 'Después de cada tecla. Lo que dice el editor está en el idioma de la interfaz; el texto del documento, en el idioma del texto, así que un lector de pantalla lee cada uno con su propia voz.',
            zh: '每次按键之后朗读。编辑器自身的提示使用界面语言；文档文字使用文本语言，因此屏幕阅读器会分别用对应的语音朗读。',
          })}
        </SectionHead>
        <div className="mt-7 grid max-w-[920px] gap-3">
          {HEARD.map((one, i) => (
            <div key={one.title.en} className="grid gap-x-6 gap-y-2 rounded-2xl border border-border p-5 md:grid-cols-[1fr_280px]">
              <div>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i]]}`}>{t(one.title)}</span>
                <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{t(one.text)}</p>
              </div>
              <p className="m-0 self-center rounded-lg bg-[#2f2e2b] px-3 py-2 font-code text-[12.5px] leading-[1.5] text-[#f5c443]">{t(one.example)}</p>
            </div>
          ))}
        </div>
        <h3 id="pictures" className="m-0 mt-12 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          {t({ en: 'Pictures and their description', es: 'Las imágenes y su descripción', zh: '图片及其描述' })}
        </h3>
        <p className={prose}>
          {t({
            en: (
              <>
                A picture is read by the description Word keeps for it (its “Alt Text”), which a DOCX brings and takes back. One without it is read as “Picture without a description”. Select a picture
                and press <strong>Description</strong> in the bar beside it to write one; an assistant does it with <code className={mono}>edit_image</code>, and reads it in{' '}
                <code className={mono}>[image: …]</code>. In code:
              </>
            ),
            es: (
              <>
                Una imagen se lee por la descripción que Word guarda para ella (su “Texto alternativo”), que un DOCX trae y se lleva de vuelta. Una sin ella se lee como “Imagen sin descripción”.
                Selecciona una imagen y pulsa <strong>Descripción</strong> en la barra junto a ella para escribir una; un asistente lo hace con <code className={mono}>edit_image</code>, y la lee en{' '}
                <code className={mono}>[image: …]</code>. En código:
              </>
            ),
            zh: (
              <>
                图片按照 Word 为其保存的描述（“替代文字”）朗读，该描述会随 DOCX 读入和写回。没有描述的图片会读作“没有说明的图片”。选中图片后点击旁边工具条中的<strong>说明</strong>即可填写；助手可以用{' '}
                <code className={mono}>edit_image</code> 设置，并在 <code className={mono}>[image: …]</code> 中读取。代码中：
              </>
            ),
          })}
        </p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: alt }} />
      </section>

      <section aria-labelledby="screen-reader-mode" className="mt-24">
        <SectionHead
          id="screen-reader-mode"
          badge={t({ en: 'Mode', es: 'Modo', zh: '模式' })}
          color="purple"
          title={t({ en: 'Screen reader mode', es: 'Modo de lector de pantalla', zh: '屏幕阅读器模式' })}
        >
          {t({
            en: (
              <>
                <strong>⌘⌥Z</strong> (Ctrl+Alt+Z on Windows and Linux) turns it on and off, as in Google Docs. The hidden field then holds the paragraph the caret is in, with the caret and the
                selection where they are.
              </>
            ),
            es: (
              <>
                <strong>⌘⌥Z</strong> (Ctrl+Alt+Z en Windows y Linux) lo enciende y lo apaga, como en Google Docs. El campo oculto entonces contiene el párrafo donde está el cursor, con el cursor y la
                selección donde están.
              </>
            ),
            zh: (
              <>
                按 <strong>⌘⌥Z</strong>（Windows 和 Linux 上为 Ctrl+Alt+Z）开启或关闭，与 Google 文档相同。开启后，隐藏输入框中会放入光标所在的段落，光标和选区保持原位。
              </>
            ),
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: 'The screen reader reads it with its own commands (the current line, the word, spelling it out), and a braille display shows it. The editor stops saying the text, so it is not heard twice, and says only where the caret is: the page, the table, the heading. Turn it on in the demo above and watch the hidden field.',
            es: 'El lector de pantalla lo lee con sus propios comandos (la línea actual, la palabra, deletreándola), y una pantalla braille lo muestra. El editor deja de decir el texto, para que no se oiga dos veces, y dice solo dónde está el cursor: la página, la tabla, el título. Enciéndelo en la demo de arriba y mira el campo oculto.',
            zh: '屏幕阅读器会用自己的命令朗读它（当前行、单词、逐字拼读），盲文显示器也会显示它。编辑器不再朗读文字以免重复，只说明光标所在的位置：页码、表格、标题。在上面的演示中开启它，观察隐藏输入框的变化。',
          })}
        </p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: mode }} />
        <p className={prose}>
          {t({
            en: 'What is typed in this mode goes into the document as usual. A keyboard that composes words (Chinese, Japanese, a phone’s) puts in the word when it is finished, not letter by letter.',
            es: 'Lo que se escribe en este modo va al documento como siempre. Un teclado que compone palabras (chino, japonés, el de un teléfono) pone la palabra cuando está terminada, no letra por letra.',
            zh: '在此模式下输入的内容照常进入文档。需要组合输入的键盘（中文、日文输入法或手机键盘）会在词语完成后整体写入，而不是逐字写入。',
          })}
        </p>
      </section>

      <section aria-labelledby="the-keyboard" className="mt-24">
        <SectionHead id="the-keyboard" badge={t({ en: 'Keys', es: 'Teclas', zh: '按键' })} color="orange" title={t({ en: 'The keyboard', es: 'El teclado', zh: '键盘' })}>
          {t({
            en: 'Everything around the pages can be reached and used without a mouse.',
            es: 'Todo lo que rodea las páginas se puede alcanzar y usar sin ratón.',
            zh: '页面周围的一切都可以不用鼠标访问和使用。',
          })}
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {KEYS.map((row) => (
            <div key={row.keys.en} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[200px_1fr]">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{t(row.keys)}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(row.text)}</dd>
            </div>
          ))}
        </dl>
        <Cards rows={PARTS} />
        <p className={prose}>
          {t({
            en: 'The keys of the document itself, to type and format, are on the page ',
            es: 'Las teclas del documento en sí, para escribir y dar formato, están en la página ',
            zh: '文档本身用于输入和设置格式的快捷键，见',
          })}
          <LocalLink href="/docs/editor-api/" className={LINK}>
            {t({ en: 'Editor API', es: 'API del Editor', zh: 'Editor API' })}
          </LocalLink>
          {dot}
        </p>
      </section>

      <section aria-labelledby="seen" className="mt-24">
        <SectionHead id="seen" badge={t({ en: 'Seen', es: 'Visto', zh: '视觉' })} color="yellow" title={t({ en: 'What is seen', es: 'Lo que se ve', zh: '看到的内容' })}>
          {t({
            en: 'For whoever sees the screen, but not all of it, or not in its colours.',
            es: 'Para quien ve la pantalla, pero no toda, o no en sus colores.',
            zh: '面向能看到屏幕、但看不全或无法分辨颜色的用户。',
          })}
        </SectionHead>
        <Cards rows={SEEN} min={240} />
      </section>

      <section aria-labelledby="pdf" className="mt-24">
        <SectionHead id="pdf" badge="PDF" color="green" title={t({ en: 'The PDF', es: 'El PDF', zh: 'PDF' })}>
          {t({
            en: 'A PDF made from a document is tagged: a screen reader finds in it what the document is made of, in the order it is written, and in its language.',
            es: 'Un PDF hecho a partir de un documento está etiquetado: un lector de pantalla encuentra en él de qué está hecho el documento, en el orden en que está escrito, y en su idioma.',
            zh: '由文档生成的 PDF 带有标签：屏幕阅读器可以按书写顺序、用文档的语言读取文档的结构。',
          })}
        </SectionHead>
        <LazyPdfDemo />
        <p className={prose}>
          {t({
            en: (
              <>
                The lease of the demo above, made into a PDF in this page with <code className={mono}>renderPdf</code> and read back out of the PDF: each tag, and the text the pages give it. Take the
                language or the description away and it stops saying it is PDF/UA.
              </>
            ),
            es: (
              <>
                El contrato de arrendamiento de la demo de arriba, convertido en PDF en esta página con <code className={mono}>renderPdf</code> y leído de vuelta del PDF: cada etiqueta, y el texto que
                le dan las páginas. Quita el idioma o la descripción y deja de decir que es PDF/UA.
              </>
            ),
            zh: (
              <>
                在本页面中用 <code className={mono}>renderPdf</code> 把上面演示中的租约生成 PDF，再从 PDF 中读回：每个标签以及页面赋予它的文字。去掉语言或图片描述后，它就不再声明自己符合 PDF/UA。
              </>
            ),
          })}
        </p>
        <Cards rows={PDF_TAGS} />
        <div className={`mt-7 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: pdf }} />
        <p className={prose}>
          {t({
            en: 'The language is the one given, or the one chosen at the foot of the editor, or the one the file says (in the editor, for a document that says none, the interface’s when it was opened). When the PDF has a title and a language, every font is inside it and every picture has a description, it says it is PDF/UA, the standard for PDFs anyone can read, and veraPDF, its checker, finds nothing in it. A font the browser has no file for is not inside it, so a PDF exported from the editor in that font does not say so; on a server, give ',
            es: 'El idioma es el dado, o el elegido al pie del editor, o el que dice el archivo (en el editor, para un documento que no dice ninguno, el de la interfaz al abrirlo). Cuando el PDF tiene un título y un idioma, cada fuente está dentro y cada imagen tiene descripción, dice que es PDF/UA, el estándar de PDF que cualquiera puede leer, y veraPDF, su verificador, no encuentra nada en él. Una fuente de la que el navegador no tiene archivo no va dentro, así que un PDF exportado desde el editor con esa fuente no lo dice; en un servidor, da ',
            zh: '语言为传入的语言，或在编辑器底部选择的语言，或文件中声明的语言（在编辑器中，对于未声明语言的文档，使用打开时的界面语言）。当 PDF 有标题和语言、所有字体都已嵌入、每张图片都有描述时，它会声明符合 PDF/UA（人人可读的 PDF 标准），其校验工具 veraPDF 也不会发现任何问题。浏览器没有字体文件的字体无法嵌入，因此从编辑器导出的使用该字体的 PDF 不会声明符合；在服务器上，请提供',
          })}
          <LocalLink href="/docs/fonts/" className={LINK}>
            {t({ en: 'the font files', es: 'los archivos de las fuentes', zh: '字体文件' })}
          </LocalLink>
          {t({
            en: '. What the document itself gets wrong, a heading level skipped or a picture without a description, stays in the PDF as it is.',
            es: '. Lo que el documento en sí tiene mal, un nivel de título saltado o una imagen sin descripción, queda en el PDF tal como está.',
            zh: '。文档本身的问题（如跳过了某级标题、图片没有描述）会原样保留在 PDF 中。',
          })}
        </p>
      </section>

      <section aria-labelledby="own" className="mt-24">
        <SectionHead
          id="own"
          badge={t({ en: 'Your UI', es: 'Tu interfaz', zh: '你的界面' })}
          color="pink"
          title={t({ en: 'For your own interface', es: 'Para tu propia interfaz', zh: '针对你自己的界面' })}
        >
          {t({ en: 'With the ', es: 'Con los ', zh: '使用' })}
          <LocalLink href="/docs/headless/" className={LINK}>
            {t({ en: 'headless hooks', es: 'hooks headless', zh: 'headless hooks' })}
          </LocalLink>
          {t({
            en: ' the bars are yours, and so is making them accessible.',
            es: ' las barras son tuyas, y también hacerlas accesibles.',
            zh: ' 时，工具栏由你实现，让它们无障碍也是你的责任。',
          })}
        </SectionHead>
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>
            {t({
              en: (
                <>
                  Give buttons that stay on <code className={mono}>aria-pressed</code>, buttons that open a menu <code className={mono}>aria-haspopup</code> and{' '}
                  <code className={mono}>aria-expanded</code>, and colour swatches a name.
                </>
              ),
              es: (
                <>
                  Dales <code className={mono}>aria-pressed</code> a los botones que se quedan activos, <code className={mono}>aria-haspopup</code> y <code className={mono}>aria-expanded</code> a los
                  botones que abren un menú, y un nombre a las muestras de color.
                </>
              ),
              zh: (
                <>
                  为保持开启状态的按钮设置 <code className={mono}>aria-pressed</code>，为打开菜单的按钮设置 <code className={mono}>aria-haspopup</code> 和 <code className={mono}>aria-expanded</code>
                  ，并为色块提供名称。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: 'The document keeps saying what the caret meets, as it does in the editor’s own interface: that is the editor’s, not the bars’.',
              es: 'El documento sigue diciendo lo que encuentra el cursor, como en la interfaz propia del editor: eso es del editor, no de las barras.',
              zh: '文档会继续朗读光标经过的内容，与编辑器自带界面中一样：这由编辑器负责，与工具栏无关。',
            })}
          </li>
          <li>
            {t({
              en: 'Say what your buttons do that cannot be seen from the document, through the editor’s live regions:',
              es: 'Di lo que hacen tus botones que no se puede ver desde el documento, a través de las regiones en vivo del editor:',
              zh: '你的按钮所做的、无法从文档中看出的事情，请通过编辑器的实时区域朗读出来：',
            })}
          </li>
        </ul>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: own }} />
      </section>

      <section aria-labelledby="what-is-not-checked" className="mt-24">
        <SectionHead
          id="what-is-not-checked"
          badge={t({ en: 'Honest', es: 'Con franqueza', zh: '坦白说' })}
          color="orange"
          title={t({ en: 'What is not checked', es: 'Lo que no está comprobado', zh: '尚未验证的内容' })}
        />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          {NOT_CHECKED.map((item) => (
            <li key={item.en}>{t(item)}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
