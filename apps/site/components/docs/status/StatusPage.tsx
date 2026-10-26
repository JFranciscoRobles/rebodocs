import type { ReactNode } from 'react';
import { LocalLink } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import { type L, formatNumber } from '@/lib/i18n';
import { getT, pageLocale } from '@/lib/locale';
import { LINK } from '../styles';
import { SectionHead } from '../ui';
import { AGAINST_WORD, MEASURED, TESTS, linesLikeWord } from './data';
import { WordTable } from './WordTable';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

const link = (href: string, text: string) => (
  <LocalLink href={href} className={LINK}>
    {text}
  </LocalLink>
);

/** Checked by hand, in headless Chrome with real clicks, keys and touches. */
const BY_HAND: L<ReactNode>[] = [
  {
    en: 'The toolbar, tables, header and footer, page numbers, letterhead.',
    es: 'La barra de herramientas, las tablas, el encabezado y el pie de página, los números de página, el membrete.',
    zh: '工具栏、表格、页眉和页脚、页码、信头。',
  },
  {
    en: 'Collaboration between two tabs, on a local network and between different networks behind an HTTPS proxy, two browsers typing over a real bucket: typing at once, undo per person, tables, reconnection.',
    es: 'La colaboración entre dos pestañas, en una red local y entre redes distintas detrás de un proxy HTTPS, dos navegadores escribiendo sobre un bucket real: escribir a la vez, deshacer por persona, tablas, reconexión.',
    zh: '协作：两个标签页之间、局域网中，以及 HTTPS 代理后不同网络之间，两个浏览器在真实存储桶上输入：同时输入、按人撤销、表格、重新连接。',
  },
  {
    en: 'The React component in a Next.js 16 application with Tailwind 4 (this site): server rendering, saving, features, the handle, the headless hooks.',
    es: 'El componente de React en una aplicación Next.js 16 con Tailwind 4 (este sitio): renderizado en servidor, guardado, features, el handle, los hooks headless.',
    zh: 'React 组件在 Next.js 16 + Tailwind 4 应用（即本站）中的表现：服务器渲染、保存、features、handle、headless hooks。',
  },
  {
    en: 'A phone-sized screen with touch: taps, a hold, pinch, the selection handles, composed input.',
    es: 'Una pantalla del tamaño de un teléfono con tacto: toques, mantener pulsado, pellizcar, los tiradores de la selección, la entrada compuesta.',
    zh: '手机尺寸的触摸屏：轻点、长按、双指缩放、选区手柄、输入法输入。',
  },
  {
    en: (
      <>
        {link('/docs/accessibility/', 'Accessibility')}: what is announced after each key, F6 and Alt+F10, every menu and dialog from the keyboard, the ruler, screen reader mode, high contrast, and
        axe on every page with an editor.
      </>
    ),
    es: (
      <>
        {link('/docs/accessibility/', 'Accesibilidad')}: lo que se anuncia tras cada tecla, F6 y Alt+F10, cada menú y diálogo desde el teclado, la regla, el modo lector de pantalla, el alto contraste,
        y axe en cada página con un editor.
      </>
    ),
    zh: <>{link('/docs/accessibility/', '无障碍')}：每次按键后的播报、F6 和 Alt+F10、用键盘操作每个菜单和对话框、标尺、屏幕阅读器模式、高对比度，以及在每个带编辑器的页面上运行 axe。</>,
  },
  {
    en: 'The real-time and CRM demos opened and driven: a room opened from the list, a contract generated from a record.',
    es: 'Los demos de tiempo real y de CRM abiertos y manejados: una sala abierta desde la lista, un contrato generado a partir de un registro.',
    zh: '打开并操作了实时演示和 CRM 演示：从列表打开房间，从记录生成合同。',
  },
  {
    en: 'Chinese, Simplified and Traditional: lines broken between characters and kept from starting with a closing mark, justified lines, the interface in both, and a PDF in Chinese read back with pdftotext.',
    es: 'Chino, simplificado y tradicional: líneas cortadas entre caracteres y sin empezar con un signo de cierre, líneas justificadas, la interfaz en ambos, y un PDF en chino leído de vuelta con pdftotext.',
    zh: '简体和繁体中文：字符间换行且行首不出现闭合标点、两端对齐的行、两种中文界面，以及用 pdftotext 读回的中文 PDF。',
  },
  { en: 'Touch on one real phone.', es: 'El tacto en un teléfono real.', zh: '在一部真实手机上测试触摸。' },
];

const NOT: [L, L][] = [
  [
    { en: 'Every demo, clicked through.', es: 'Cada demo, recorrido entero.', zh: '逐一点击每个演示。' },
    {
      en: 'The storage and assistant demos were checked through their backends and tests; the real-time and CRM ones were opened and driven, not every flow of them.',
      es: 'Los demos de almacenamiento y de asistente se comprobaron a través de sus backends y pruebas; los de tiempo real y CRM se abrieron y manejaron, no cada uno de sus flujos.',
      zh: '存储和 AI 助手演示通过其后端和测试进行了验证；实时和 CRM 演示打开并操作过，但并未覆盖每个流程。',
    },
  ],
  [
    { en: 'Many documents.', es: 'Muchos documentos.', zh: '大量文档。' },
    {
      en: 'The pagination rules were derived from files in Arial, Times New Roman, Georgia and Verdana with Word for Mac. Other fonts and versions of Word may differ. Word kerns with the table of pairs in the font file; the browser kerns with another table of the font, and for Times New Roman leaves out the pairs with a space, so a line in Times can come out a fraction of a point apart from Word’s in the editor, though not in the PDF.',
      es: 'Las reglas de paginación se derivaron de archivos en Arial, Times New Roman, Georgia y Verdana con Word para Mac. Otras fuentes y versiones de Word pueden diferir. Word ajusta el kerning con la tabla de pares del archivo de la fuente; el navegador lo hace con otra tabla de la fuente, y para Times New Roman deja fuera los pares con un espacio, así que una línea en Times puede quedar a una fracción de punto de la de Word en el editor, aunque no en el PDF.',
      zh: '分页规则是根据 Mac 版 Word 中 Arial、Times New Roman、Georgia 和 Verdana 字体的文件推导出来的。其他字体和 Word 版本可能有所不同。Word 使用字体文件中的字偶表调整字距；浏览器使用字体的另一张表，并且对 Times New Roman 忽略含空格的字偶，因此编辑器中 Times 的一行可能与 Word 相差几分之一磅，但 PDF 中不会。',
    },
  ],
  [
    { en: 'Chinese against Word.', es: 'El chino contra Word.', zh: '中文与 Word 的对照。' },
    {
      en: 'Where lines of Chinese break was checked against Word’s rules, not measured against PDFs Word made, as the documents above are; nor were vertical writing or Japanese.',
      es: 'Dónde se cortan las líneas de chino se comprobó contra las reglas de Word, no se midió contra PDF hechos por Word, como los documentos de arriba; tampoco la escritura vertical ni el japonés.',
      zh: '中文的换行位置是按照 Word 的规则核对的，而不是像上面的文档那样与 Word 生成的 PDF 逐行比对；竖排和日文也没有测量。',
    },
  ],
  [
    { en: 'Many phones.', es: 'Muchos teléfonos.', zh: '大量手机。' },
    { en: 'One real device. Keyboards differ.', es: 'Un dispositivo real. Los teclados difieren.', zh: '只在一部真实设备上测试。各种键盘有所不同。' },
  ],
  [
    { en: 'The desktop application outside a Mac.', es: 'La aplicación de escritorio fuera de un Mac.', zh: 'Mac 以外的桌面应用。' },
    {
      en: 'Windows and Linux compile the same code but are untried, and so is opening a document with a double click in them.',
      es: 'Windows y Linux compilan el mismo código pero no se han probado, ni abrir un documento con doble clic en ellos.',
      zh: 'Windows 和 Linux 可以编译同样的代码，但尚未测试，在其中双击打开文档也未测试。',
    },
  ],
  [
    { en: 'Pasting from every program.', es: 'Pegar desde cualquier programa.', zh: '从各种程序粘贴。' },
    {
      en: 'What Word for Mac puts on the clipboard was read for sixteen tables of a document, with tests that keep it; Google Docs and web pages, with samples. Word on Windows, LibreOffice, Excel and Google Sheets write HTML of their own and are untried.',
      es: 'Lo que Word para Mac pone en el portapapeles se leyó para dieciséis tablas de un documento, con pruebas que lo conservan; Google Docs y páginas web, con muestras. Word en Windows, LibreOffice, Excel y Google Sheets escriben HTML propio y no se han probado.',
      zh: '读取过 Mac 版 Word 为一份文档中十六个表格放到剪贴板上的内容，并有测试保持；Google Docs 和网页用样例测试过。Windows 版 Word、LibreOffice、Excel 和 Google Sheets 会写出各自的 HTML，尚未测试。',
    },
  ],
  [
    { en: 'Claude with a real key.', es: 'Claude con una clave real.', zh: '使用真实密钥的 Claude。' },
    {
      en: 'The chat and its route were tested against a Claude of the tests’ own; a conversation with the real API has not been tried in the repository.',
      es: 'El chat y su ruta se probaron contra un Claude propio de las pruebas; en el repositorio no se ha probado una conversación con la API real.',
      zh: '聊天及其路由是针对测试自带的模拟 Claude 测试的；仓库中尚未用真实 API 进行过对话。',
    },
  ],
  [
    { en: 'Screen readers.', es: 'Lectores de pantalla.', zh: '屏幕阅读器。' },
    {
      en: 'What the editor announces was read in Chrome, not listened to with VoiceOver, NVDA or JAWS; the tagged PDF passes veraPDF, but no screen reader read it.',
      es: 'Lo que anuncia el editor se leyó en Chrome, no se escuchó con VoiceOver, NVDA o JAWS; el PDF etiquetado pasa veraPDF, pero ningún lector de pantalla lo leyó.',
      zh: '编辑器的播报内容已在 Chrome 中读取验证，但未用 VoiceOver、NVDA 或 JAWS 实际收听；带标签的 PDF 通过了 veraPDF，但尚未用屏幕阅读器朗读。',
    },
  ],
];

const LIMITS: { area: L; color: 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'yellow'; items: L<ReactNode>[] }[] = [
  {
    area: { en: 'The format', es: 'El formato', zh: '格式' },
    color: 'blue',
    items: [
      {
        en: 'Text boxes are drawn as rectangles with a plain fill and line, not turned; one too small for its text loses whole lines where Word cuts one in half. Those only in VML, from old files, are kept but not shown.',
        es: 'Los cuadros de texto se dibujan como rectángulos con un relleno y una línea simples, sin girar; uno demasiado pequeño para su texto pierde líneas enteras donde Word corta una por la mitad. Los que solo están en VML, de archivos viejos, se conservan pero no se muestran.',
        zh: '文本框绘制为带纯色填充和线条的矩形，不会旋转；文字放不下时会丢掉整行，而 Word 会把一行截成两半。只以 VML 存在的文本框（来自旧文件）会被保留，但不显示。',
      },
      {
        en: <>Columns of a table and merged or split cells change untracked, as in Word; rows and changes of formatting are tracked (see {link('/docs/tracked-changes/', 'tracked changes')}).</>,
        es: (
          <>
            Las columnas de una tabla y las celdas combinadas o divididas cambian sin control, como en Word; las filas y los cambios de formato se controlan (mira{' '}
            {link('/docs/tracked-changes/', 'control de cambios')}).
          </>
        ),
        zh: <>表格的列以及合并或拆分单元格的更改不记录为修订，与 Word 相同；行和格式更改会被记录（参见{link('/docs/tracked-changes/', '修订')}）。</>,
      },
      {
        en: 'Footnotes of a section in columns go across the whole page, and a reference in a table cell does not make room for its note.',
        es: 'Las notas al pie de una sección en columnas van a todo lo ancho de la página, y una referencia en una celda de tabla no le hace sitio a su nota.',
        zh: '分栏节中的脚注会横跨整页，表格单元格中的脚注引用不会为脚注预留空间。',
      },
      {
        en: 'Comparing versions covers the text and its look, not the page, the sections, style definitions or the size of pictures. A change of look is listed but not marked.',
        es: 'Comparar versiones cubre el texto y su aspecto, no la página, las secciones, las definiciones de estilos ni el tamaño de las imágenes. Un cambio de aspecto se lista pero no se marca.',
        zh: '版本比较涵盖文字及其格式，不包括页面设置、分节、样式定义和图片尺寸。格式更改会被列出，但不会被标记。',
      },
      {
        en: 'No right-to-left text, and no scripts that need shaping. Chinese and Japanese are laid out in horizontal lines only, not written vertically.',
        es: 'No hay texto de derecha a izquierda, ni escrituras que necesiten shaping. El chino y el japonés se componen solo en líneas horizontales, no en escritura vertical.',
        zh: '不支持从右向左的文字，也不支持需要字形整形的文字。中文和日文只按横排排版，不支持竖排。',
      },
      {
        en: 'No hyphenation: a line breaks only where there is a space or a hyphen, or between two characters of Chinese or Japanese.',
        es: 'Sin división silábica: una línea solo se corta donde hay un espacio o un guion, o entre dos caracteres de chino o japonés.',
        zh: '不支持连字符断词：只在空格或连字符处，或在两个中日文字符之间换行。',
      },
    ],
  },
  {
    area: { en: 'Output', es: 'Salida', zh: '输出' },
    color: 'green',
    items: [
      {
        en: 'PDF embeds TrueType and OpenType fonts, TrueType ones cut down to the characters used; OpenType ones in CFF go whole. It is tagged, and passes veraPDF’s PDF/UA-1 checks when every font is in it, the document has a title and a language, and every picture has a description.',
        es: 'El PDF incrusta fuentes TrueType y OpenType, las TrueType recortadas a los caracteres usados; las OpenType en CFF van enteras. Está etiquetado, y pasa las comprobaciones PDF/UA-1 de veraPDF cuando todas las fuentes están en él, el documento tiene título e idioma, y cada imagen tiene descripción.',
        zh: 'PDF 会嵌入 TrueType 和 OpenType 字体，TrueType 字体精简为用到的字符；CFF 格式的 OpenType 字体完整嵌入。PDF 带有标签，当所有字体都已嵌入、文档有标题和语言、每张图片都有描述时，可以通过 veraPDF 的 PDF/UA-1 检查。',
      },
      {
        en: 'Chinese characters a font has not are drawn in the font for Chinese the document carries, or in the one every PDF reader has, which is not embedded: the reader shows it in a font of its own.',
        es: 'Los caracteres chinos que una fuente no tiene se dibujan en la fuente para chino que lleva el documento, o en la que tiene todo lector de PDF, que no se incrusta: el lector la muestra en una fuente propia.',
        zh: '字体中没有的中文字符，会使用文档携带的中文字体绘制，或者使用所有 PDF 阅读器都具备的字体（不嵌入）：阅读器会用自己的字体显示。',
      },
      {
        en: (
          <>
            Fonts an application gives go into the DOCX only when they are TrueType and their licence lets them: whole, or cut down to the characters used with{' '}
            <code className={mono}>embedFonts: &apos;subset&apos;</code>.
          </>
        ),
        es: (
          <>
            Las fuentes que da una aplicación van en el DOCX solo cuando son TrueType y su licencia lo permite: enteras, o recortadas a los caracteres usados con{' '}
            <code className={mono}>embedFonts: &apos;subset&apos;</code>.
          </>
        ),
        zh: (
          <>
            应用提供的字体只有在为 TrueType 且许可允许时才会嵌入 DOCX：完整嵌入，或使用 <code className={mono}>embedFonts: &apos;subset&apos;</code> 精简为用到的字符。
          </>
        ),
      },
    ],
  },
  {
    area: { en: 'The editor', es: 'El editor', zh: '编辑器' },
    color: 'purple',
    items: [
      {
        en: 'Pasting from Word, Google Docs or a web page keeps the formatting of the text, links, lists, headings, tables (their merged cells, widths and heading rows) and pictures in the lines; a picture a web server does not let the page read stays behind, as does one that floats in Word, which comes in the line; a table inside a cell comes as lines with tabs, and the colours a table style gives the bands of a table do not come, as Word leaves them out of what it puts on the clipboard. No drag and drop of text.',
        es: 'Pegar desde Word, Google Docs o una página web conserva el formato del texto, los enlaces, las listas, los títulos, las tablas (sus celdas combinadas, anchos y filas de encabezado) y las imágenes en línea; una imagen que un servidor web no deja leer a la página se queda fuera, y una que flota en Word llega en la línea; una tabla dentro de una celda llega como líneas con tabuladores, y los colores que un estilo de tabla les da a las bandas de una tabla no llegan, porque Word los deja fuera de lo que pone en el portapapeles. No se puede arrastrar y soltar texto.',
        zh: '从 Word、Google Docs 或网页粘贴时，会保留文字格式、链接、列表、标题、表格（合并单元格、宽度和标题行）以及行内图片；网页服务器不允许页面读取的图片不会粘贴进来，Word 中的浮动图片会变成行内图片；单元格中的嵌套表格会变成用制表符分隔的行，表格样式为表格条纹设置的颜色也不会保留，因为 Word 放到剪贴板上的内容中没有它们。不支持拖放文字。',
      },
      {
        en: (
          <>
            A screen reader hears the document through announcements, or through the paragraph in {link('/docs/accessibility/#screen-reader-mode', 'screen reader mode')}; it cannot browse the pages as
            a web page.
          </>
        ),
        es: (
          <>
            Un lector de pantalla oye el documento por los anuncios, o por el párrafo en el {link('/docs/accessibility/#screen-reader-mode', 'modo lector de pantalla')}; no puede recorrer las páginas
            como una página web.
          </>
        ),
        zh: <>屏幕阅读器通过播报或{link('/docs/accessibility/#screen-reader-mode', '屏幕阅读器模式')}中的段落来听取文档；它无法像浏览网页那样浏览这些页面。</>,
      },
      {
        en: (
          <>Spelling needs dictionaries the application gives, Hunspell’s; the text of a language without one is not checked, nor is grammar (see {link('/docs/languages/#spelling', 'spelling')}).</>
        ),
        es: (
          <>
            La ortografía necesita diccionarios que dé la aplicación, de Hunspell; el texto de un idioma sin uno no se revisa, ni la gramática (mira {link('/docs/languages/#spelling', 'ortografía')}).
          </>
        ),
        zh: <>拼写检查需要应用提供的 Hunspell 词典；没有词典的语言不会检查，也不检查语法（参见{link('/docs/languages/#spelling', '拼写检查')}）。</>,
      },
      {
        en: 'Only the pages near the view are drawn, but the whole document is laid out again on each change: on a desktop computer that is about 9 ms a key at 200 pages.',
        es: 'Solo se dibujan las páginas cercanas a la vista, pero todo el documento se vuelve a componer en cada cambio: en un ordenador de escritorio son unos 9 ms por tecla con 200 páginas.',
        zh: '只绘制可视区域附近的页面，但每次更改都会重新排版整份文档：在台式电脑上，200 页的文档每次按键约需 9 毫秒。',
      },
    ],
  },
  {
    area: { en: 'Templates', es: 'Plantillas', zh: '模板' },
    color: 'yellow',
    items: [
      {
        en: (
          <>
            Without a currency code, <code className={mono}>currency</code> writes a dollar sign, whatever the language.
          </>
        ),
        es: (
          <>
            Sin código de moneda, <code className={mono}>currency</code> escribe un signo de dólar, sea cual sea el idioma.
          </>
        ),
        zh: (
          <>
            不指定货币代码时，无论什么语言，<code className={mono}>currency</code> 都会写出美元符号。
          </>
        ),
      },
    ],
  },
  {
    area: { en: 'Collaboration', es: 'Colaboración', zh: '协作' },
    color: 'orange',
    items: [
      { en: 'One server process holds a room.', es: 'Un proceso del servidor lleva una sala.', zh: '一个房间由一个服务器进程持有。' },
      {
        en: 'Access is checked on joining, and while connected only when the server is told to (--recheck-every, server.recheck()).',
        es: 'El acceso se comprueba al entrar, y mientras se está conectado solo cuando se le dice al servidor (--recheck-every, server.recheck()).',
        zh: '权限在加入时校验；连接期间只有在要求服务器时才会再次校验（--recheck-every、server.recheck()）。',
      },
      {
        en: (
          <>
            Two people cutting, joining and taking out paragraphs around the same place at the same instant can, rarely, end with different documents for a moment: the server’s check finds it within a
            couple of seconds and the editor loads the room again, keeping what was typed, but what can be undone starts over (see{' '}
            {link('/docs/collaboration/#when-two-people-change-the-same-thing', 'collaboration')}).
          </>
        ),
        es: (
          <>
            Dos personas cortando, uniendo y quitando párrafos en torno al mismo lugar en el mismo instante pueden, rara vez, terminar con documentos distintos por un momento: la comprobación del
            servidor lo encuentra en un par de segundos y el editor vuelve a cargar la sala, conservando lo escrito, pero lo que se puede deshacer empieza de nuevo (mira{' '}
            {link('/docs/collaboration/#when-two-people-change-the-same-thing', 'colaboración')}).
          </>
        ),
        zh: (
          <>
            两个人在同一时刻于同一位置附近拆分、合并和删除段落时，偶尔会短暂得到不同的文档：服务器的核对会在几秒内发现，编辑器重新加载房间并保留已输入的内容，但可撤销的历史会重新开始（参见
            {link('/docs/collaboration/#when-two-people-change-the-same-thing', '协作')}）。
          </>
        ),
      },
      {
        en: (
          <>
            A hard crash of the server loses the changes since the last save: 5 seconds after people stop typing, 30 at most while they go on (<code className={mono}>--save-after</code>,{' '}
            <code className={mono}>--save-every</code>). The server keeps no versions: the application does, and the editor compares and restores them (see {link('/docs/versions/', 'versions')}).
          </>
        ),
        es: (
          <>
            Una caída brusca del servidor pierde los cambios desde el último guardado: 5 segundos después de que la gente deja de escribir, 30 como mucho mientras sigue (
            <code className={mono}>--save-after</code>, <code className={mono}>--save-every</code>). El servidor no guarda versiones: las guarda la aplicación, y el editor las compara y restaura (mira{' '}
            {link('/docs/versions/', 'versiones')}).
          </>
        ),
        zh: (
          <>
            服务器崩溃会丢失上次保存之后的更改：停止输入后 5 秒内的，持续输入时最多 30 秒内的（<code className={mono}>--save-after</code>、<code className={mono}>--save-every</code>
            ）。服务器不保存版本：版本由应用保存，编辑器负责比较和还原（参见{link('/docs/versions/', '版本')}）。
          </>
        ),
      },
    ],
  },
  {
    area: { en: 'Packaging', es: 'Paquetes', zh: '打包' },
    color: 'pink',
    items: [
      {
        en: (
          <>
            Every package is on npm. <code className={mono}>@rebodocs/react</code> has the engine inside; an application that also installs <code className={mono}>@rebodocs/core</code> carries the
            engine twice.
          </>
        ),
        es: (
          <>
            Todos los paquetes están en npm. <code className={mono}>@rebodocs/react</code> lleva el motor dentro; una aplicación que también instala <code className={mono}>@rebodocs/core</code> lleva
            el motor dos veces.
          </>
        ),
        zh: (
          <>
            所有包都已发布到 npm。<code className={mono}>@rebodocs/react</code> 内置了引擎；如果应用同时安装了 <code className={mono}>@rebodocs/core</code>，就会包含两份引擎。
          </>
        ),
      },
      {
        en: 'The English and Chinese interface texts were translated from Spanish and need a native review.',
        es: 'Los textos de la interfaz en inglés y en chino se tradujeron del español y necesitan una revisión nativa.',
        zh: '英文和中文界面文本是从西班牙语翻译的，需要母语人士审阅。',
      },
    ],
  },
];

const ROADMAP: [L, L][] = [
  [
    { en: 'Use it in a real application,', es: 'Usarlo en una aplicación real,', zh: '在真实应用中使用，' },
    { en: 'and fix what that shows.', es: 'y arreglar lo que eso muestre.', zh: '并修复由此发现的问题。' },
  ],
  [
    { en: 'More of it tested in a browser.', es: 'Más de él probado en un navegador.', zh: '在浏览器中测试更多内容。' },
    {
      en: 'The editor, its toolbar, side panel and status bar have their tests in Chrome now; the menu, the dialogs and the demos have none yet, and the measurements against Word could run there too.',
      es: 'El editor, su barra de herramientas, su panel lateral y su barra de estado ya tienen sus pruebas en Chrome; el menú, los diálogos y los demos todavía no, y las mediciones contra Word también podrían correr ahí.',
      zh: '编辑器及其工具栏、侧边面板和状态栏现在已有 Chrome 中的测试；菜单、对话框和演示还没有，与 Word 的对照测量也可以在那里运行。',
    },
  ],
  [
    { en: 'Collaboration that scales:', es: 'Colaboración que escala:', zh: '可扩展的协作：' },
    {
      en: 'several server processes per room, and a log kept as it is written.',
      es: 'varios procesos del servidor por sala, y un registro guardado a medida que se escribe.',
      zh: '每个房间使用多个服务器进程，并实时保存日志。',
    },
  ],
  [
    { en: 'Versions while people work:', es: 'Versiones mientras la gente trabaja:', zh: '编辑过程中的版本：' },
    {
      en: 'a version every so often of editing (versionEvery), signed by who changed the document in that time, besides the one when the last person leaves; a room left open all day keeps none until then.',
      es: 'una versión cada cierto tiempo de edición (versionEvery), firmada por quienes cambiaron el documento en ese tiempo, además de la de cuando sale la última persona; una sala abierta todo el día no guarda ninguna hasta entonces.',
      zh: '每隔一段编辑时间保存一个版本（versionEvery），由这段时间内修改过文档的人署名，最后一人离开时的版本除外；整天开着的房间在那之前不会保存任何版本。',
    },
  ],
  [
    { en: 'Screen readers for real:', es: 'Lectores de pantalla de verdad:', zh: '真实的屏幕阅读器测试：' },
    { en: 'VoiceOver, NVDA and JAWS on the editor and on its PDF.', es: 'VoiceOver, NVDA y JAWS en el editor y en su PDF.', zh: '在编辑器及其 PDF 上使用 VoiceOver、NVDA 和 JAWS。' },
  ],
];

/**
 * "Status and roadmap": what is checked, with the tests by package and the
 * measurements against Word as they were taken; what is not; the known
 * limits; the roadmap; contributing; the license.
 */
export async function StatusPage() {
  const t = getT();
  const locale = pageLocale();
  const total = TESTS.reduce((sum, row) => sum + row.count, 0);
  const most = Math.max(...TESTS.map((row) => row.count));
  const like = formatNumber(linesLikeWord(), locale);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {t({ en: 'Status and roadmap', es: 'Estado y hoja de ruta', zh: '现状与路线图' })}
      </h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: 'Rebodocs is a word processor compatible with Word files. It is not a copy of Word and is not meant to become one. It is tested and published on npm. This page says what has been checked and how, and what is missing, without rounding up.',
          es: 'Rebodocs es un procesador de textos compatible con archivos de Word. No es una copia de Word ni pretende serlo. Está probado y publicado en npm. Esta página dice qué se ha comprobado y cómo, y qué falta, sin redondear hacia arriba.',
          zh: 'Rebodocs 是一个兼容 Word 文件的文字处理器。它不是 Word 的复制品，也无意成为 Word。它经过测试并已发布到 npm。本页如实说明已经验证了什么、如何验证，以及还缺什么，不做任何夸大。',
        })}
      </p>

      <section aria-labelledby="what-is-checked" className="mt-16">
        <SectionHead
          id="what-is-checked"
          badge={t({ en: 'Checked', es: 'Comprobado', zh: '已验证' })}
          color="green"
          title={t({ en: 'What is checked', es: 'Qué está comprobado', zh: '已验证的内容' })}
        >
          {t({
            en: `The numbers here were taken on ${t(MEASURED)}, by running the commands named.`,
            es: `Los números de aquí se tomaron el ${t(MEASURED)}, ejecutando los comandos que se nombran.`,
            zh: `这里的数字取自 ${t(MEASURED)}，通过运行文中列出的命令得到。`,
          })}
        </SectionHead>

        <h3 className="m-0 mt-10 font-display text-xl font-bold">{t({ en: `${total} automated tests`, es: `${total} pruebas automáticas`, zh: `${total} 个自动化测试` })}</h3>
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>npm test</code>, every one passing:
              </>
            ),
            es: (
              <>
                <code className={mono}>npm test</code>, todas pasando:
              </>
            ),
            zh: (
              <>
                <code className={mono}>npm test</code>，全部通过：
              </>
            ),
          })}
        </p>
        <ul className="m-0 mt-5 grid max-w-[920px] list-none gap-3 p-0">
          {TESTS.map((row) => (
            <li key={row.where.en} className="grid items-center gap-x-5 gap-y-1 md:grid-cols-[150px_200px_1fr]">
              <code className="font-code text-[13px] font-semibold text-ink">{t(row.where)}</code>
              <span className="flex items-center gap-2.5">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#efede8]" aria-hidden="true">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${(row.count / most) * 100}%` }} />
                </span>
                <span className="w-9 text-right font-code text-[13px] text-ink">{row.count}</span>
              </span>
              <span className="text-[14px] leading-normal text-ink-soft">{t(row.what)}</span>
            </li>
          ))}
        </ul>

        <h3 className="m-0 mt-14 font-display text-xl font-bold">{t({ en: 'The layout, against Word', es: 'La composición, contra Word', zh: '排版与 Word 的对照' })}</h3>
        <p className={prose}>
          {t({
            en: (
              <>
                Each document is laid out here and compared, line by line, with the PDF Word for Mac exports of it: which lines start with the same text at the same height, and how far apart they are.
                They are made up for it, with invented text and pictures of one colour, and kept in the repository with Word’s PDF of each, in <code className={mono}>test-documents/</code>: anyone can
                run <code className={mono}>npm run word-check</code> without Word, and <code className={mono}>npm run word-compare -- file.docx</code> measures a document of one’s own.
              </>
            ),
            es: (
              <>
                Cada documento se compone aquí y se compara, línea por línea, con el PDF que exporta de él Word para Mac: qué líneas empiezan con el mismo texto a la misma altura, y qué tan separadas
                están. Están hechos para ello, con texto inventado e imágenes de un solo color, y se guardan en el repositorio con el PDF de Word de cada uno, en{' '}
                <code className={mono}>test-documents/</code>: cualquiera puede ejecutar <code className={mono}>npm run word-check</code> sin Word, y{' '}
                <code className={mono}>npm run word-compare -- file.docx</code> mide un documento propio.
              </>
            ),
            zh: (
              <>
                每份文档都在这里排版，并与 Mac 版 Word 导出的 PDF 逐行比较：哪些行以相同的文字从相同的高度开始，以及相差多少。这些文档是专门为此制作的，使用虚构的文字和单色图片，与 Word 导出的 PDF
                一起保存在仓库的 <code className={mono}>test-documents/</code> 中：任何人都可以在没有 Word 的情况下运行 <code className={mono}>npm run word-check</code>，
                <code className={mono}>npm run word-compare -- file.docx</code> 则可以测量你自己的文档。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                Across the {AGAINST_WORD.length}, <strong className="font-semibold text-ink">{like}%</strong> of the lines Word wrote are where Word puts them. The work goes on to reach all of them.
              </>
            ),
            es: (
              <>
                En los {AGAINST_WORD.length}, el <strong className="font-semibold text-ink">{like}%</strong> de las líneas que escribió Word están donde las pone Word. El trabajo sigue hasta llegar a
                todas.
              </>
            ),
            zh: (
              <>
                在这 {AGAINST_WORD.length} 份文档中，Word 写出的行有 <strong className="font-semibold text-ink">{like}%</strong> 与 Word 的位置一致。工作仍在继续，目标是全部一致。
              </>
            ),
          })}
        </p>
        <WordTable />
        <p className={prose}>
          {t({
            en: 'Where it differs: three cases of floating pictures, where a line at the foot of a page, beside a picture or just below one, goes on to the next page in Word with a point or less to spare in the editor; every line after it is then a line off.',
            es: 'Donde difiere: tres casos de imágenes flotantes, en los que una línea al pie de una página, junto a una imagen o justo debajo de una, pasa a la página siguiente en Word con un punto o menos de margen en el editor; cada línea después de ella queda entonces una línea corrida.',
            zh: '存在差异的地方：三个浮动图片的案例中，位于页面底部、图片旁边或正下方的一行，在 Word 中被移到了下一页，而在编辑器中只差一磅或更少；此后的每一行都会因此错开一行。',
          })}
        </p>

        <h3 className="m-0 mt-14 font-display text-xl font-bold">{t({ en: 'Round trip', es: 'Ida y vuelta', zh: '往返' })}</h3>
        <p className={prose}>
          {t({
            en: 'The 17 documents measured open and save again with the same text, the same paragraphs and the same pictures. Word opens what is exported without warnings.',
            es: 'Los 17 documentos medidos se abren y se vuelven a guardar con el mismo texto, los mismos párrafos y las mismas imágenes. Word abre lo exportado sin advertencias.',
            zh: '测量的 17 份文档打开后再保存，文字、段落和图片都保持不变。Word 打开导出的文件时不会出现警告。',
          })}
        </p>

        <h3 className="m-0 mt-14 font-display text-xl font-bold">{t({ en: 'The interface', es: 'La interfaz', zh: '界面' })}</h3>
        <ul className="m-0 mt-5 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          {BY_HAND.map((item, i) => (
            <li key={i}>{t(item)}</li>
          ))}
        </ul>

        <h3 className="m-0 mt-14 font-display text-xl font-bold">{t({ en: 'A real bucket', es: 'Un bucket real', zh: '真实的存储桶' })}</h3>
        <p className={prose}>
          {t({
            en: (
              <>
                The backend of the {link('/docs/storage/', 'storage demo')} was run by hand, from Node, against Cloudflare R2: listing, reading and writing with signed addresses, the origin rule, the
                PDF made on the server, and coming into a room whose document is in the bucket.
              </>
            ),
            es: (
              <>
                El backend del {link('/docs/storage/', 'demo de almacenamiento')} se ejecutó a mano, desde Node, contra Cloudflare R2: listar, leer y escribir con direcciones firmadas, la regla de
                origen, el PDF hecho en el servidor, y entrar en una sala cuyo documento está en el bucket.
              </>
            ),
            zh: <>{link('/docs/storage/', '存储演示')}的后端在 Node 中手动针对 Cloudflare R2 运行过：使用签名地址列出、读取和写入，来源规则，在服务器上生成 PDF，以及进入文档存放在存储桶中的房间。</>,
          })}
        </p>
      </section>

      <section aria-labelledby="what-is-not" className="mt-24">
        <SectionHead id="what-is-not" badge={t({ en: 'Untried', es: 'Sin probar', zh: '未测试' })} color="yellow" title={t({ en: 'What is not', es: 'Qué no', zh: '未验证的内容' })} />
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {NOT.map(([title, text]) => (
            <div key={title.en} className="grid gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3.5 first:border-t-0 md:grid-cols-[260px_1fr]">
              <dt className="text-[15px] font-semibold text-ink">{t(title)}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(text)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="known-limits" className="mt-24">
        <SectionHead id="known-limits" badge={t({ en: 'Limits', es: 'Límites', zh: '限制' })} color="orange" title={t({ en: 'Known limits', es: 'Límites conocidos', zh: '已知限制' })} />
        <div className="mt-6 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))' }}>
          {LIMITS.map((group) => (
            <div key={group.area.en} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[group.color]}`}>{t(group.area)}</span>
              <ul className="m-0 mt-3 grid list-none gap-2.5 p-0">
                {group.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.55] text-ink-soft">
                    <span aria-hidden="true" className="mt-2 size-1.5 flex-none rounded-full bg-[#c9c6bf]" />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="roadmap" className="mt-24">
        <SectionHead id="roadmap" badge={t({ en: 'Next', es: 'Lo siguiente', zh: '下一步' })} color="purple" title={t({ en: 'Roadmap', es: 'Hoja de ruta', zh: '路线图' })}>
          {t({ en: 'In rough order of how much each would matter.', es: 'En orden aproximado de cuánto importaría cada uno.', zh: '大致按重要程度排序。' })}
        </SectionHead>
        <ol className="m-0 mt-6 grid max-w-[760px] list-decimal gap-2.5 pl-6 text-base leading-[1.6] text-ink-soft">
          {ROADMAP.map(([lead, text]) => (
            <li key={lead.en}>
              <strong className="font-semibold text-ink">{t(lead)}</strong> {t(text)}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="contributing" className="mt-24">
        <SectionHead id="contributing" badge={t({ en: 'Help', es: 'Ayuda', zh: '参与' })} color="blue" title={t({ en: 'Contributing', es: 'Contribuir', zh: '贡献' })} />
        <p className={prose}>
          {t({
            en: (
              <>
                The repository’s <code className={mono}>CONTRIBUTING.md</code> says how to set up and what the conventions are. Each package’s README ends with a list of where it can improve: good
                places to start.
              </>
            ),
            es: (
              <>
                El <code className={mono}>CONTRIBUTING.md</code> del repositorio dice cómo prepararlo y cuáles son las convenciones. El README de cada paquete termina con una lista de dónde puede
                mejorar: buenos lugares para empezar.
              </>
            ),
            zh: (
              <>
                仓库中的 <code className={mono}>CONTRIBUTING.md</code> 说明了如何搭建环境以及有哪些约定。每个包的 README 末尾都列出了可以改进的地方：很适合作为起点。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="license" className="mt-24">
        <SectionHead id="license" badge="MIT" color="green" title={t({ en: 'License', es: 'Licencia', zh: '许可证' })} />
        <p className={prose}>{t({ en: 'MIT. Anyone may use it for anything.', es: 'MIT. Cualquiera puede usarlo para cualquier cosa.', zh: 'MIT。任何人都可以将它用于任何用途。' })}</p>
      </section>
    </>
  );
}
