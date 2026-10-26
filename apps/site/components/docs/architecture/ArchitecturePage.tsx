import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { REPO } from '@/lib/site';
import { CAPTION, CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { CollabDemo } from './CollabDemo';
import { PLACES, STEPS } from './data';
import { DocxDemo } from './DocxDemo';
import { KeystrokeSteps } from './KeystrokeSteps';
import { LayoutDemo } from './LayoutDemo';
import { PagesDemo } from './PagesDemo';
import { PaintDemo } from './PaintDemo';
import { ValueDemo } from './ValueDemo';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const card = 'lift rounded-2xl border border-border p-5.5';

type Cost = { what: L; state: 'handled' | 'partly' | 'missing'; text: L; link?: [L, string] };

/** What the browser no longer does once there is no contenteditable, and what the editor does in its place. */
const COSTS: Cost[] = [
  {
    what: { en: 'Screen readers', es: 'Lectores de pantalla', zh: '屏幕阅读器' },
    state: 'handled',
    text: {
      en: 'The textarea holds none of the text, so the editor says in a live region what the caret moved over, what was selected or deleted, and the page, table or list it is in. Screen reader mode (⌘⌥Z, Ctrl+Alt+Z elsewhere) puts the paragraph in the field, so the reader’s own commands and a braille display work.',
      es: 'El textarea no contiene nada del texto, así que el editor dice en una región viva por dónde pasó el cursor, qué se seleccionó o se borró, y la página, tabla o lista en que está. El modo lector de pantalla (⌘⌥Z, Ctrl+Alt+Z en los demás) pone el párrafo en el campo, para que funcionen los comandos propios del lector y una línea braille.',
      zh: 'textarea 中不包含任何文字，因此编辑器通过 live region 告诉屏幕阅读器光标经过了什么、选中或删除了什么，以及所在的页面、表格或列表。屏幕阅读器模式（⌘⌥Z，其他系统为 Ctrl+Alt+Z）会把段落放进输入框，使阅读器自身的命令和盲文显示器可以正常工作。',
    },
    link: [{ en: 'Accessibility', es: 'Accesibilidad', zh: '无障碍' }, '/docs/accessibility/'],
  },
  {
    what: { en: 'Keyboard and high contrast', es: 'Teclado y alto contraste', zh: '键盘与高对比度' },
    state: 'handled',
    text: {
      en: 'F6 goes round the parts of the editor, Alt+F10 to the toolbar, Escape back to the document. With forced colours, the caret, the selection and what is on keep the system’s colours.',
      es: 'F6 recorre las partes del editor, Alt+F10 va a la barra de herramientas, Escape vuelve al documento. Con colores forzados, el cursor, la selección y lo activado conservan los colores del sistema.',
      zh: 'F6 在编辑器的各部分之间切换，Alt+F10 跳到工具栏，Escape 回到文档。在强制颜色模式下，光标、选区和已开启的状态都使用系统颜色。',
    },
    link: [{ en: 'The keyboard', es: 'El teclado', zh: '键盘' }, '/docs/accessibility/#the-keyboard'],
  },
  {
    what: { en: 'Other scripts and phone keyboards', es: 'Otras escrituras y teclados de teléfono', zh: '其他文字与手机键盘' },
    state: 'handled',
    text: {
      en: 'A word being composed — Japanese, Chinese, a phone that suggests — is shown as it is written and changed when the keyboard corrects it.',
      es: 'Una palabra en composición —japonés, chino, un teléfono que sugiere— se muestra mientras se escribe y cambia cuando el teclado la corrige.',
      zh: '正在输入的词——日文、中文输入法，或带联想的手机键盘——会在输入过程中显示，并在键盘修正时随之改变。',
    },
  },
  {
    what: { en: 'Find', es: 'Buscar', zh: '查找' },
    state: 'handled',
    text: {
      en: '⌘F and ⌘H (Ctrl elsewhere) open the editor’s own find bar, which searches the document, not the screen, and replaces.',
      es: '⌘F y ⌘H (Ctrl en los demás) abren la barra de búsqueda propia del editor, que busca en el documento, no en la pantalla, y reemplaza.',
      zh: '⌘F 和 ⌘H（其他系统为 Ctrl）会打开编辑器自己的查找栏，它搜索的是文档而不是屏幕，并且可以替换。',
    },
  },
  {
    what: { en: 'Copy and paste', es: 'Copiar y pegar', zh: '复制与粘贴' },
    state: 'partly',
    text: {
      en: 'Copying gives plain text, HTML and the editor’s own format. Pasting from Word, Google Docs or a page keeps the formatting, links, lists, headings, tables, with their merged cells, colours, borders and row heights, and pictures; a table inside a cell comes as lines with tabs, and a picture a web server does not let the page read stays behind.',
      es: 'Copiar da texto plano, HTML y el formato propio del editor. Pegar desde Word, Google Docs o una página conserva el formato, los enlaces, las listas, los títulos, las tablas, con sus celdas combinadas, colores, bordes y altos de fila, y las imágenes; una tabla dentro de una celda llega como líneas con tabuladores, y una imagen que un servidor web no deja leer a la página se queda fuera.',
      zh: '复制时提供纯文本、HTML 和编辑器自己的格式。从 Word、Google Docs 或网页粘贴时保留格式、链接、列表、标题、表格（包括合并单元格、颜色、边框和行高）以及图片；单元格中的嵌套表格会变成用制表符分隔的行，网页服务器不允许页面读取的图片不会粘贴进来。',
    },
    link: [{ en: 'Status', es: 'Estado', zh: '状态' }, '/docs/status/'],
  },
  {
    what: { en: 'Selecting by touch', es: 'Seleccionar al tacto', zh: '触摸选择' },
    state: 'handled',
    text: {
      en: 'The selection is drawn by the editor, with handles to drag on a phone, and pages zoom with two fingers.',
      es: 'La selección la dibuja el editor, con tiradores para arrastrar en un teléfono, y las páginas hacen zoom con dos dedos.',
      zh: '选区由编辑器绘制，在手机上带有可拖动的手柄，页面可以用双指缩放。',
    },
    link: [{ en: 'Mobile', es: 'Móvil', zh: '移动端' }, '/docs/mobile/'],
  },
  {
    what: { en: 'Spell check', es: 'Ortografía', zh: '拼写检查' },
    state: 'handled',
    text: {
      en: 'A browser checks spelling only in text it edits, and here it edits none: the editor checks it itself, with Hunspell dictionaries in a worker, and draws the red wave and the suggestions.',
      es: 'Un navegador revisa la ortografía solo en el texto que edita, y aquí no edita ninguno: el editor la revisa él mismo, con diccionarios Hunspell en un worker, y dibuja la onda roja y las sugerencias.',
      zh: '浏览器只检查它自己编辑的文字的拼写，而这里浏览器不编辑任何文字：编辑器在 worker 中使用 Hunspell 词典自行检查，并绘制红色波浪线和建议。',
    },
    link: [{ en: 'Spelling', es: 'Ortografía', zh: '拼写检查' }, '/docs/languages/#spelling'],
  },
  {
    what: { en: 'Dragging text', es: 'Arrastrar texto', zh: '拖动文字' },
    state: 'missing',
    text: {
      en: 'Text cannot be dragged to another place yet; cut and paste does it.',
      es: 'El texto todavía no se puede arrastrar a otro lugar; cortar y pegar lo hace.',
      zh: '目前还不能把文字拖到其他位置；可以用剪切和粘贴代替。',
    },
  },
];

const STATE: Record<Cost['state'], [L, string]> = {
  handled: [{ en: 'Handled', es: 'Resuelto', zh: '已解决' }, 'bg-pastel-green text-pastel-green-fg'],
  partly: [{ en: 'In part', es: 'En parte', zh: '部分解决' }, 'bg-pastel-yellow text-pastel-yellow-fg'],
  missing: [{ en: 'Not yet', es: 'Todavía no', zh: '尚未支持' }, 'bg-pastel-pink text-pastel-pink-fg'],
};

function Gains({ items }: { items: [title: L, text: L][] }) {
  const t = getT();
  return (
    <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
      {items.map(([title, text]) => (
        <div key={title.en} className={card}>
          <p className="m-0 font-display text-base font-bold tracking-[-0.01em]">{t(title)}</p>
          <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{t(text)}</p>
        </div>
      ))}
    </div>
  );
}

function Checks({ items }: { items: L[] }) {
  const t = getT();
  return (
    <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-x-8 gap-y-2.5 p-0">
      {items.map((item) => (
        <li key={item.en} className="flex items-start gap-2.5 text-[15px] leading-[1.55] text-ink-soft">
          <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true" className="mt-1 flex-none">
            <path d="M2.5 6.2l2.2 2.2L9.5 3.6" fill="none" stroke="#2E6B3C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t(item)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * "How it works": the decisions that explain most of the code, each with a
 * demo of the idea. The demos are small, made the way the engine is, not the
 * engine itself.
 */
export async function ArchitecturePage() {
  const t = getT();
  const stepCode = await Promise.all(STEPS.map((step) => highlight(step.code, step.code.startsWith('<') ? 'html' : 'ts', LIGHT_THEME)));
  const valueCode = await highlight(
    `const next = insertText(doc, { para: 3, offset: 0 }, 'Hello').doc;
next.paragraphs[0] === doc.paragraphs[0];   // true: untouched, so the very same object`,
    'ts',
    LIGHT_THEME,
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{t({ en: 'How it works', es: 'Cómo funciona', zh: '工作原理' })}</h1>
      <p className="m-0 mt-3.5 max-w-[680px] text-lg leading-[1.6] text-muted">
        {t({
          en: 'Four decisions explain most of the code, and a fifth explains how several people work on one document. Each has a small demo, made the way the engine is.',
          es: 'Cuatro decisiones explican la mayor parte del código, y una quinta explica cómo trabajan varias personas en un documento. Cada una tiene un pequeño demo, hecho como está hecho el motor.',
          zh: '四个设计决策解释了大部分代码，第五个解释了多人如何同时编辑一份文档。每个决策都有一个小演示，按引擎的实现方式制作。',
        })}
      </p>
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: follow one keystroke first', es: 'consejo: sigue primero una pulsación', zh: '提示：先跟踪一次按键' })}</HandTip>
      </div>

      <section aria-labelledby="keystroke" className="mt-16">
        <SectionHead
          id="keystroke"
          badge={t({ en: 'Start here', es: 'Empieza aquí', zh: '从这里开始' })}
          color="blue"
          title={t({ en: 'The path of a keystroke', es: 'El camino de una pulsación', zh: '一次按键的路径' })}
        >
          {t({
            en: 'One letter typed, from the key to the screen of everyone on the document. Each step is one of the decisions below.',
            es: 'Una letra escrita, desde la tecla hasta la pantalla de todos los que están en el documento. Cada paso es una de las decisiones de abajo.',
            zh: '输入的一个字母，从按键到文档中每个人的屏幕。每一步都对应下面的一个设计决策。',
          })}
        </SectionHead>
        <KeystrokeSteps code={stepCode} />
      </section>

      <section aria-labelledby="value" className="mt-24">
        <SectionHead
          id="value"
          badge={t({ en: 'Decision 1', es: 'Decisión 1', zh: '决策 1' })}
          color="blue"
          title={t({ en: 'The document is a value', es: 'El documento es un valor', zh: '文档是一个值' })}
        />
        <p className={prose}>
          {t({
            en: (
              <>
                A <code className={mono}>Doc</code> is plain immutable data: paragraphs of runs, tables, the sections and their pages, headers and footers, footnotes, text boxes, styles, numbering,
                media. Headers, footers, footnotes and text boxes are <em>stories</em>: paragraphs of their own, edited the same way as the body. Nothing mutates one. An operation takes a document and
                returns another, sharing everything it did not touch.
              </>
            ),
            es: (
              <>
                Un <code className={mono}>Doc</code> son datos simples e inmutables: párrafos de runs, tablas, las secciones y sus páginas, encabezados y pies de página, notas al pie, cuadros de
                texto, estilos, numeración, medios. Los encabezados, pies de página, notas al pie y cuadros de texto son <em>stories</em>: párrafos propios, editados igual que el cuerpo. Nada muta
                uno. Una operación toma un documento y devuelve otro, que comparte todo lo que no tocó.
              </>
            ),
            zh: (
              <>
                <code className={mono}>Doc</code> 是普通的不可变数据：由 run 组成的段落、表格、节及其页面、页眉页脚、脚注、文本框、样式、编号和媒体。页眉、页脚、脚注和文本框是 <em>story</em>
                ：拥有自己的段落，编辑方式与正文相同。任何东西都不会修改它。操作接收一份文档并返回另一份，共享所有未改动的部分。
              </>
            ),
          })}
        </p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: valueCode }} />
        <ValueDemo />
        <p className="m-0 mt-8 font-display text-lg font-bold tracking-[-0.01em]">
          {t({ en: 'That one rule gives a lot for free', es: 'Esa sola regla da mucho gratis', zh: '这一条规则带来了很多免费的好处' })}
        </p>
        <Gains
          items={[
            [
              { en: 'Undo', es: 'Deshacer', zh: '撤销' },
              { en: 'Is keeping the previous document.', es: 'Es guardar el documento anterior.', zh: '就是保留之前的文档。' },
            ],
            [
              { en: 'Change detection', es: 'Detectar cambios', zh: '变化检测' },
              { en: 'Is ===.', es: 'Es ===.', zh: '就是 ===。' },
            ],
            [
              { en: 'Layout caching', es: 'Caché de la composición', zh: '排版缓存' },
              {
                en: 'A paragraph that is the same object as last time breaks into the same lines.',
                es: 'Un párrafo que es el mismo objeto que la última vez se corta en las mismas líneas.',
                zh: '与上次是同一对象的段落，分行结果也相同。',
              },
            ],
            [
              { en: 'Collaboration', es: 'Colaboración', zh: '协作' },
              {
                en: 'The difference between two documents is found by comparing references.',
                es: 'La diferencia entre dos documentos se encuentra comparando referencias.',
                zh: '通过比较引用就能找出两份文档之间的差异。',
              },
            ],
          ]}
        />
      </section>

      <section aria-labelledby="layout" className="mt-24">
        <SectionHead
          id="layout"
          badge={t({ en: 'Decision 2', es: 'Decisión 2', zh: '决策 2' })}
          color="purple"
          title={t({ en: 'Layout is ours', es: 'La composición es nuestra', zh: '排版由我们完成' })}
        />
        <p className={prose}>
          {t({
            en: 'The browser is asked one thing: how wide is this piece of text in this font. Everything else is worked out by the engine. Because the rules are ours, they can be the ones Word documents are written for, and a file looks the same here as there — which a browser’s own line breaking would never give. The aim is compatibility, not imitation: the same document, the same pages.',
            es: 'Al navegador se le pregunta una sola cosa: qué ancho tiene este trozo de texto en esta fuente. Todo lo demás lo calcula el motor. Como las reglas son nuestras, pueden ser aquellas para las que se escriben los documentos de Word, y un archivo se ve aquí igual que allí, cosa que el corte de líneas propio de un navegador nunca daría. El objetivo es la compatibilidad, no la imitación: el mismo documento, las mismas páginas.',
            zh: '只向浏览器询问一件事：这段文字在这个字体下有多宽。其余一切都由引擎计算。因为规则由我们掌握，所以可以采用 Word 文档所依据的规则，让文件在这里和在 Word 中看起来一样——这是浏览器自身的换行永远做不到的。目标是兼容，而不是模仿：同样的文档，同样的页面。',
          })}
        </p>
        <LayoutDemo />
        <p className="m-0 mt-8 font-display text-lg font-bold tracking-[-0.01em]">{t({ en: 'What the engine works out', es: 'Lo que calcula el motor', zh: '引擎计算的内容' })}</p>
        <Checks
          items={[
            {
              en: 'Lines, with justification, tab stops, kerning from the font’s own table of pairs, and Word’s rule for how far spaces may shrink to take one more word.',
              es: 'Líneas, con justificación, tabulaciones, kerning a partir de la propia tabla de pares de la fuente, y la regla de Word sobre cuánto pueden encogerse los espacios para que quepa una palabra más.',
              zh: '分行，包括两端对齐、制表位、按字体自身字偶表进行的字距调整，以及 Word 关于空格最多能压缩多少以容纳下一个词的规则。',
            },
            {
              en: 'Chinese and Japanese, broken between any two characters, never before a closing mark nor after an opening one, and justified between their characters.',
              es: 'Chino y japonés, cortados entre dos caracteres cualesquiera, nunca antes de un signo de cierre ni después de uno de apertura, y justificados entre sus caracteres.',
              zh: '中文和日文：在任意两个字符之间换行，标点避头尾（闭合标点不在行首、开启标点不在行尾），两端对齐时在字符之间分配间距。',
            },
            {
              en: 'Pages: widow and orphan control, keep-with-next, keep-lines-together, page breaks.',
              es: 'Páginas: control de viudas y huérfanas, conservar con el siguiente, conservar líneas juntas, saltos de página.',
              zh: '分页：孤行控制、与下段同页、段中不分页、分页符。',
            },
            {
              en: 'Sections, each with its own page size, margins, columns, header and footer.',
              es: 'Secciones, cada una con su propio tamaño de página, márgenes, columnas, encabezado y pie de página.',
              zh: '分节，每节都有自己的纸张大小、页边距、分栏、页眉和页脚。',
            },
            {
              en: 'Tables, with rows that split across pages, tables inside cells, and text on its side.',
              es: 'Tablas, con filas que se dividen entre páginas, tablas dentro de celdas, y texto de lado.',
              zh: '表格，包括跨页拆分的行、单元格中的嵌套表格以及竖排文字。',
            },
            {
              en: 'Headers and footers that take room from the text when they are tall.',
              es: 'Encabezados y pies de página que le quitan espacio al texto cuando son altos.',
              zh: '较高的页眉和页脚会占用正文的空间。',
            },
            {
              en: 'Footnotes at the foot of the page that refers to them, and endnotes at the end of the document or of each section, numbered as each section says, again on each page if it asks.',
              es: 'Notas al pie al pie de la página que las nombra, y notas al final al final del documento o de cada sección, numeradas como dice cada sección, de nuevo en cada página si lo pide.',
              zh: '脚注位于引用它的页面底部，尾注位于文档或每节的末尾，按每节的设置编号，如有要求则每页重新编号。',
            },
            {
              en: 'Floating pictures and text boxes, and the text that goes round them.',
              es: 'Imágenes flotantes y cuadros de texto, y el texto que los rodea.',
              zh: '浮动图片和文本框，以及环绕它们的文字。',
            },
            { en: 'Lengths in points throughout, as in Word.', es: 'Longitudes en puntos en todas partes, como en Word.', zh: '所有长度都以磅为单位，与 Word 相同。' },
          ]}
        />
        <p className={prose}>
          {t({
            en: 'Lines then go into pages, by Word’s rules for where a page may end.',
            es: 'Luego las líneas van a páginas, según las reglas de Word sobre dónde puede terminar una página.',
            zh: '然后按照 Word 关于页面可以在哪里结束的规则，把行排进页面。',
          })}
        </p>
        <PagesDemo />
        <p className={prose}>
          {t({
            en: 'And because the only thing asked from outside is a width, the same code runs in Node with font files in place of a browser: that is how PDFs are made on a server.',
            es: 'Y como lo único que se pide de fuera es un ancho, el mismo código corre en Node con archivos de fuente en lugar de un navegador: así se hacen los PDF en un servidor.',
            zh: '而且因为唯一需要从外部获取的只是宽度，同一套代码可以在 Node 中用字体文件代替浏览器运行：服务器上就是这样生成 PDF 的。',
          })}
        </p>
      </section>

      <section aria-labelledby="painting" className="mt-24">
        <SectionHead id="painting" badge={t({ en: 'Decision 3', es: 'Decisión 3', zh: '决策 3' })} color="yellow" title={t({ en: 'Painting is placing', es: 'Pintar es colocar', zh: '绘制即定位' })} />
        <p className={prose}>
          {t({
            en: (
              <>
                The editor does not hand text to the browser to lay out. Each piece of text is a <code className={mono}>span</code> placed at the coordinates the layout gave; the browser never wraps a
                line, so what is on screen is exactly what was computed, and what will be printed. There is no <code className={mono}>contenteditable</code>: a hidden{' '}
                <code className={mono}>textarea</code> follows the caret and has the focus; what is typed arrives there and becomes an operation. Movement keys and shortcuts are taken in{' '}
                <code className={mono}>keydown</code>, and the caret and the selection are drawn by the editor.
              </>
            ),
            es: (
              <>
                El editor no le da el texto al navegador para que lo componga. Cada trozo de texto es un <code className={mono}>span</code> colocado en las coordenadas que dio la composición; el
                navegador nunca corta una línea, así que lo que hay en pantalla es exactamente lo que se calculó, y lo que se imprimirá. No hay <code className={mono}>contenteditable</code>: un{' '}
                <code className={mono}>textarea</code> oculto sigue al cursor y tiene el foco; lo que se escribe llega ahí y se convierte en una operación. Las teclas de movimiento y los atajos se
                toman en <code className={mono}>keydown</code>, y el cursor y la selección los dibuja el editor.
              </>
            ),
            zh: (
              <>
                编辑器不把文字交给浏览器排版。每段文字都是一个放在排版给出坐标处的 <code className={mono}>span</code>
                ；浏览器从不自动换行，因此屏幕上显示的与计算结果、打印结果完全一致。没有 <code className={mono}>contenteditable</code>：一个隐藏的 <code className={mono}>textarea</code>{' '}
                跟随光标并持有焦点；输入的内容到达这里并变成操作。移动键和快捷键在 <code className={mono}>keydown</code> 中处理，光标和选区由编辑器绘制。
              </>
            ),
          })}
        </p>
        <PaintDemo />
      </section>

      <section aria-labelledby="docx" className="mt-24">
        <SectionHead id="docx" badge={t({ en: 'Decision 4', es: 'Decisión 4', zh: '决策 4' })} color="green" title={t({ en: 'DOCX without loss', es: 'DOCX sin pérdidas', zh: '无损的 DOCX' })} />
        <p className={prose}>
          {t({
            en: 'A DOCX is a ZIP of XML with far more in it than any editor models. To not destroy what is not understood:',
            es: 'Un DOCX es un ZIP de XML con mucho más dentro de lo que modela cualquier editor. Para no destruir lo que no se entiende:',
            zh: 'DOCX 是一个装着 XML 的 ZIP，其中的内容远多于任何编辑器能建模的部分。为了不破坏不理解的内容：',
          })}
        </p>
        <Checks
          items={[
            {
              en: 'Every imported paragraph remembers the XML it came from.',
              es: 'Cada párrafo importado recuerda el XML del que vino.',
              zh: '每个导入的段落都记得它来自的 XML。',
            },
            {
              en: 'A paragraph that was not touched is written back byte for byte.',
              es: 'Un párrafo que no se tocó se vuelve a escribir byte por byte.',
              zh: '未改动的段落逐字节原样写回。',
            },
            {
              en: 'One that was changed is rewritten, keeping the properties the model does not know about.',
              es: 'Uno que cambió se reescribe, conservando las propiedades que el modelo no conoce.',
              zh: '修改过的段落会重新写出，并保留模型不认识的属性。',
            },
            {
              en: 'Parts of the file the editor never reads — themes, custom XML, settings — are copied through.',
              es: 'Las partes del archivo que el editor nunca lee —temas, XML personalizado, configuración— se copian tal cual.',
              zh: '编辑器从不读取的文件部分——主题、自定义 XML、设置——会原样复制。',
            },
          ]}
        />
        <DocxDemo />
      </section>

      <section aria-labelledby="collab" className="mt-24">
        <SectionHead id="collab" badge={t({ en: 'Together', es: 'Juntos', zh: '协同' })} color="pink" title={t({ en: 'Collaboration', es: 'Colaboración', zh: '协作' })} />
        <p className={prose}>
          {t({
            en: 'Paragraphs get an id while a document is shared, and a change names paragraphs by id, so it still means the same after someone added a paragraph above. Headers, footers, footnotes and text boxes are sent the same way, and tracked changes go along as part of the formatting of their text.',
            es: 'Los párrafos reciben un id mientras un documento está compartido, y un cambio nombra los párrafos por id, así que sigue significando lo mismo después de que alguien añadió un párrafo encima. Los encabezados, pies de página, notas al pie y cuadros de texto se envían igual, y los cambios controlados van como parte del formato de su texto.',
            zh: '文档共享期间段落会获得 id，更改按 id 指明段落，因此即使有人在上方添加了段落，含义也不变。页眉、页脚、脚注和文本框以同样方式发送，修订作为文字格式的一部分一起传送。',
          })}
        </p>
        <CollabDemo />
        <p className="m-0 mt-8 font-display text-lg font-bold tracking-[-0.01em]">{t({ en: 'The hard cases', es: 'Los casos difíciles', zh: '棘手的情况' })}</p>
        <Gains
          items={[
            [
              { en: 'A deletion', es: 'Una eliminación', zh: '删除' },
              {
                en: 'Carries the paragraph it takes out, so that what someone was writing in it meanwhile stays.',
                es: 'Lleva el párrafo que quita, para que lo que alguien escribía en él entretanto se quede.',
                zh: '附带被删除的段落，这样别人同时在其中输入的内容会被保留。',
              },
            ],
            [
              { en: 'Formatting', es: 'El formato', zh: '格式' },
              { en: 'Says it is formatting, and is made letter by letter.', es: 'Dice que es formato, y se hace letra por letra.', zh: '注明自己是格式更改，并逐个字符应用。' },
            ],
            [
              { en: 'Enter', es: 'Intro', zh: 'Enter' },
              { en: 'Carries the formatting of the new paragraph.', es: 'Lleva el formato del párrafo nuevo.', zh: '附带新段落的格式。' },
            ],
            [
              { en: 'Undo', es: 'Deshacer', zh: '撤销' },
              {
                en: 'Sends the inverse of your own step, transformed against what others did since: it never takes back someone else’s work.',
                es: 'Envía el inverso de tu propio paso, transformado contra lo que hicieron otros desde entonces: nunca quita el trabajo de otra persona.',
                zh: '发送你自己那一步的逆操作，并针对其他人此后所做的进行转换：绝不会撤回别人的工作。',
              },
            ],
          ]}
        />
      </section>

      <section aria-labelledby="costs" className="mt-24">
        <SectionHead id="costs" badge={t({ en: 'The price', es: 'El precio', zh: '代价' })} color="purple" title={t({ en: 'What it costs', es: 'Lo que cuesta', zh: '付出的代价' })}>
          {t({
            en: 'Without contenteditable, everything the browser gives an editable page for free has to be done again. This is what was, and what was not.',
            es: 'Sin contenteditable, todo lo que el navegador le da gratis a una página editable hay que hacerlo de nuevo. Esto es lo que se hizo, y lo que no.',
            zh: '没有 contenteditable，浏览器免费提供给可编辑页面的一切都必须重新实现。以下是已经完成的和尚未完成的。',
          })}
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4">
          {COSTS.map((cost) => (
            <div key={cost.what.en} className={card}>
              <p className="m-0 flex items-center justify-between gap-3">
                <span className="font-display text-base font-bold tracking-[-0.01em]">{t(cost.what)}</span>
                <span className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATE[cost.state][1]}`}>{t(STATE[cost.state][0])}</span>
              </p>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{t(cost.text)}</p>
              {cost.link && (
                <LocalLink href={cost.link[1]} className={`mt-2 inline-block text-sm ${LINK}`}>
                  {t(cost.link[0])} →
                </LocalLink>
              )}
            </div>
          ))}
        </div>
        <p className={prose}>
          {t({
            en: (
              <>
                What is announced was read in Chrome, not yet listened to with VoiceOver, NVDA or JAWS. The{' '}
                <LocalLink href="/docs/status/" className={LINK}>
                  status page
                </LocalLink>{' '}
                keeps the list of what is missing.
              </>
            ),
            es: (
              <>
                Lo que se anuncia se leyó en Chrome, todavía no se escuchó con VoiceOver, NVDA o JAWS. La{' '}
                <LocalLink href="/docs/status/" className={LINK}>
                  página de estado
                </LocalLink>{' '}
                lleva la lista de lo que falta.
              </>
            ),
            zh: (
              <>
                播报内容已在 Chrome 中读取验证，尚未用 VoiceOver、NVDA 或 JAWS 实际收听。
                <LocalLink href="/docs/status/" className={LINK}>
                  状态页面
                </LocalLink>
                列出了尚未完成的内容。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="files" className="mt-24">
        <SectionHead id="files" badge={t({ en: 'Reference', es: 'Referencia', zh: '参考' })} color="orange" title={t({ en: 'Where things live', es: 'Dónde vive cada cosa', zh: '代码的位置' })}>
          {t({
            en: 'To read the code from here: what each file holds, by package.',
            es: 'Para leer el código desde aquí: qué contiene cada archivo, por paquete.',
            zh: '从这里开始阅读代码：按包列出每个文件包含的内容。',
          })}
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
          {PLACES.map(({ pkg, places }) => (
            <div key={pkg} className="rounded-2xl border border-border p-5.5">
              <p className={CAPTION}>{pkg}</p>
              <dl className="m-0 mt-2.5">
                {places.map((place) => (
                  <div key={place.paths.join()} className="border-t border-[#f0eee9] py-2.5">
                    <dt className="flex flex-wrap gap-x-2">
                      {place.paths.map((path, i) => {
                        const full = i === 0 ? path : place.paths[0].replace(/[^/]+$/, path);
                        return (
                          <a key={path} href={`${REPO}/${full.endsWith('/') ? 'tree' : 'blob'}/main/${full}`} className="py-1 font-code text-[13px] text-brand hover:text-brand-hover">
                            {path}
                          </a>
                        );
                      })}
                    </dt>
                    <dd className="m-0 mt-0.5 text-[15px] leading-normal text-ink-soft">{t(place.what)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
