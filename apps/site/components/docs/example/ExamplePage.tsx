import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { LazyLiveDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const COLORS = ['blue', 'purple', 'yellow', 'green', 'pink', 'orange'] as const;
const REPO = 'https://github.com/JFranciscoRobles/rebodocs/tree/main/apps/demo';

/** The files of apps/demo, each checked there. */
const FILES: { file: string; text: L }[] = [
  {
    file: 'src/App.tsx',
    text: {
      en: 'The two tabs, opening a file, and the sample it starts with. Holds the docx both editors are given.',
      es: 'Las dos pestañas, abrir un archivo, y el ejemplo con que empieza. Guarda el docx que reciben los dos editores.',
      zh: '两个标签页、打开文件，以及初始示例。保存两个编辑器共用的 docx。',
    },
  },
  { file: 'src/FullEditor.tsx', text: { en: 'DocsEditor, in a dozen lines.', es: 'DocsEditor, en una docena de líneas.', zh: 'DocsEditor，十几行代码。' } },
  {
    file: 'src/HeadlessEditor.tsx',
    text: {
      en: 'The provider and the layout: title bar, formatting bar, insert rail, find bar, ruler, pages, status bar.',
      es: 'El provider y la disposición: barra de título, barra de formato, riel de inserción, barra de búsqueda, regla, páginas, barra de estado.',
      zh: 'provider 和布局：标题栏、格式栏、插入侧栏、查找栏、标尺、页面、状态栏。',
    },
  },
  {
    file: 'src/headless/Panels.tsx',
    text: {
      en: 'The side panel and its four tabs: format, page, content, notes.',
      es: 'El panel lateral y sus cuatro pestañas: formato, página, contenido, notas.',
      zh: '侧边栏及其四个标签页：格式、页面、内容、批注。',
    },
  },
  {
    file: 'src/headless/texts.ts',
    text: {
      en: 'The interface’s own words, in Spanish and English, and useTexts, which draws a component again when the language changes.',
      es: 'Las palabras propias de la interfaz, en español e inglés, y useTexts, que vuelve a dibujar un componente cuando cambia el idioma.',
      zh: '界面自身的文字（西班牙文和英文），以及在语言切换时重新渲染组件的 useTexts。',
    },
  },
  {
    file: 'src/headless/Icon.tsx · options.ts',
    text: {
      en: 'The icons, and the lists offered: sizes, zooms, line heights, highlights, cell shades.',
      es: 'Los iconos, y las listas que se ofrecen: tamaños, zooms, interlineados, resaltados, sombreados de celda.',
      zh: '图标，以及提供的选项列表：字号、缩放比例、行距、突出显示颜色、单元格底纹。',
    },
  },
  {
    file: 'src/download.ts',
    text: {
      en: 'Handing a file to the person: there is no backend, so saving downloads the DOCX.',
      es: 'Entregarle un archivo a la persona: no hay backend, así que guardar descarga el DOCX.',
      zh: '把文件交给用户：没有后端，因此保存时会下载 DOCX。',
    },
  },
  {
    file: 'src/HeadlessEditor.css',
    text: {
      en: 'All of its look. Every rule is under .hd, so it touches nothing else; the colours of what the library puts in the body are set on body:has(.hd).',
      es: 'Todo su aspecto. Cada regla está bajo .hd, así que no toca nada más; los colores de lo que la biblioteca pone en el body se fijan en body:has(.hd).',
      zh: '全部外观样式。每条规则都限定在 .hd 下，不影响其他内容；库放到 body 中的元素，其颜色在 body:has(.hd) 上设置。',
    },
  },
  {
    file: 'scripts/sample.ts',
    text: {
      en: 'Writes the sample agreement with the engine, without a browser, in English.',
      es: 'Escribe el contrato de ejemplo con el motor, sin navegador, en inglés.',
      zh: '用引擎在没有浏览器的情况下生成英文示例协议。',
    },
  },
];

/** Which piece of the interface is made with what, from HeadlessEditor.tsx and Panels.tsx. */
const USES: { piece: L; with: string }[] = [
  {
    piece: {
      en: 'Name, unsaved mark, save, export to Word, PDF and Markdown, print',
      es: 'Nombre, marca de sin guardar, guardar, exportar a Word, PDF y Markdown, imprimir',
      zh: '名称、未保存标记、保存、导出为 Word/PDF/Markdown、打印',
    },
    with: 'useDocs: state.name, state.dirty, docs.save(), docs.download(), editor.exportPdf(), editor.exportMarkdown(), commands.print()',
  },
  {
    piece: {
      en: 'Undo, style, font, size, bold…, colour, alignment, lists, indent, zoom',
      es: 'Deshacer, estilo, fuente, tamaño, negrita…, color, alineación, listas, sangría, zoom',
      zh: '撤销、样式、字体、字号、加粗…、颜色、对齐、列表、缩进、缩放',
    },
    with: 'useDocs, useDocsStyles, fontFamilies, useDocsValue for the indent',
  },
  {
    piece: { en: 'Table, pictures, signatures, page break', es: 'Tabla, imágenes, firmas, salto de página', zh: '表格、图片、签名、分页符' },
    with: 'commands.insertTable, insertImageFile, insertImageGrid, insertSignatures, insertPageBreak',
  },
  {
    piece: { en: 'Link, variable and note buttons, and ⌘K', es: 'Botones de enlace, variable y nota, y ⌘K', zh: '链接、变量和批注按钮，以及 ⌘K' },
    with: 'useDocsBubble: bubble.ask(…), with <DocsProvider bubble>; useDocsLink, useDocsVariables and useDocsNotes say when each is on',
  },
  { piece: { en: 'Find and replace, and ⌘F', es: 'Buscar y reemplazar, y ⌘F', zh: '查找和替换，以及 ⌘F' }, with: 'useDocsFind, opened by onFindKey' },
  { piece: { en: 'Ruler', es: 'Regla', zh: '标尺' }, with: 'DocsRuler, coloured with --dx-ruler…' },
  {
    piece: { en: 'Format tab: highlight, spacing, the cells of a table', es: 'Pestaña Formato: resaltado, espaciado, las celdas de una tabla', zh: '格式标签页：突出显示、间距、表格单元格' },
    with: 'useDocs, useDocsValue for activeParagraphProps(), activeCellProps() and tableBorders()',
  },
  {
    piece: {
      en: 'Page tab: size, margins, columns, letterhead, header and footer, page number',
      es: 'Pestaña Página: tamaño, márgenes, columnas, membrete, encabezado y pie, número de página',
      zh: '页面标签页：纸张大小、页边距、分栏、信头、页眉页脚、页码',
    },
    with: 'useDocsPage, useDocsValue for the columns, commands.setArea',
  },
  {
    piece: {
      en: 'Content tab: table of contents, outline to drag, variables with a type',
      es: 'Pestaña Contenido: tabla de contenido, esquema para arrastrar, variables con tipo',
      zh: '内容标签页：目录、可拖动的大纲、带类型的变量',
    },
    with: 'useDocsOutline, useDocsVariables, commands.insertToc',
  },
  { piece: { en: 'Notes tab', es: 'Pestaña Notas', zh: '批注标签页' }, with: 'useDocsNotes, NOTE_COLORS, docs.setAuthor' },
  {
    piece: {
      en: 'Status bar: page, style and font, words and characters, saved, language, view, notes, zoom',
      es: 'Barra de estado: página, estilo y fuente, palabras y caracteres, guardado, idioma, vista, notas, zoom',
      zh: '状态栏：页码、样式和字体、字数和字符数、保存状态、语言、视图、批注、缩放',
    },
    with: 'useDocs, useDocsStyles, useDocsCount, setLocale, commands.setView, setShowNotes, setZoom',
  },
  { piece: { en: 'A narrow window', es: 'Una ventana angosta', zh: '窄窗口' }, with: 'useDocsResponsive, and a media query for the layout' },
];

/** What it had to get right. */
const RIGHT: { title: L; text: L }[] = [
  {
    title: { en: 'One value for docx', es: 'Un solo valor para docx', zh: 'docx 保持同一个值' },
    text: {
      en: 'App keeps the bytes in state and gives the same Uint8Array at every render. A new array each time would open the document again and lose what was typed.',
      es: 'App guarda los bytes en el estado y da el mismo Uint8Array en cada render. Un arreglo nuevo cada vez abriría el documento de nuevo y perdería lo escrito.',
      zh: 'App 把字节保存在 state 中，每次渲染都传入同一个 Uint8Array。如果每次都传新数组，文档会被重新打开，已输入的内容就会丢失。',
    },
  },
  {
    title: { en: 'Buttons that keep the selection', es: 'Botones que conservan la selección', zh: '按钮不丢失选区' },
    text: {
      en: 'Every command gives the keyboard back to the document, so buttons need nothing. A select or an input takes it while it is used, and the command it ends in gives it back.',
      es: 'Cada comando le devuelve el teclado al documento, así que los botones no necesitan nada. Un select o un input lo toma mientras se usa, y el comando en que termina lo devuelve.',
      zh: '每个命令都会把键盘焦点交还给文档，所以按钮无需额外处理。select 或 input 在使用期间会占用焦点，最后执行的命令会把焦点交还。',
    },
  },
  {
    title: { en: 'Colours as the editor has them', es: 'Los colores como los tiene el editor', zh: '按编辑器的格式处理颜色' },
    text: {
      en: 'state.color is hex without #; a colour input wants one with it: options.ts has the line between them. A highlight is one of Word’s fifteen, so it is offered as swatches.',
      es: 'state.color es hex sin #; un input de color lo quiere con él: options.ts tiene la línea que los une. Un resaltado es uno de los quince de Word, así que se ofrece como muestras.',
      zh: 'state.color 是不带 # 的十六进制；颜色输入框则需要带 #：options.ts 中有一行负责转换。突出显示只能是 Word 的十五种颜色之一，因此以色块形式提供。',
    },
  },
  {
    title: { en: 'The list, with what is there now', es: 'La lista, con lo que hay ahora', zh: '列表中包含当前值' },
    text: {
      en: 'A document may use a size or a zoom that is not in the list offered. withCurrent adds the present one, so a select never shows something it is not.',
      es: 'Un documento puede usar un tamaño o un zoom que no está en la lista ofrecida. withCurrent agrega el actual, así que un select nunca muestra algo que no es.',
      zh: '文档可能使用了列表中没有的字号或缩放比例。withCurrent 会把当前值加进去，这样 select 永远不会显示错误的值。',
    },
  },
  {
    title: { en: 'Indent or level', es: 'Sangría o nivel', zh: '缩进还是级别' },
    text: {
      en: 'The two indent buttons change the level of an item in a list (shiftListLevel) and the indent of a paragraph outside one (shiftIndent), as the included toolbar does.',
      es: 'Los dos botones de sangría cambian el nivel de un elemento de una lista (shiftListLevel) y la sangría de un párrafo fuera de una (shiftIndent), como hace la barra incluida.',
      zh: '两个缩进按钮在列表项上改变级别（shiftListLevel），在列表外的段落上改变缩进（shiftIndent），与自带工具栏的行为一致。',
    },
  },
  {
    title: { en: 'Language', es: 'Idioma', zh: '语言' },
    text: {
      en: 'The selector calls setLocale: the library’s own words change (the bar, the ruler, the names of styles), and useTexts draws the demo’s again. The ruler is made again, with a key, to take its words.',
      es: 'El selector llama setLocale: cambian las palabras propias de la biblioteca (la barra, la regla, los nombres de los estilos), y useTexts vuelve a dibujar las de la demo. La regla se crea de nuevo, con una key, para tomar sus palabras.',
      zh: '语言选择器调用 setLocale：库自身的文字（工具条、标尺、样式名称）随之改变，useTexts 则重新渲染演示自己的文字。标尺通过 key 重新创建，以获取新语言的文字。',
    },
  },
];

/**
 * "A complete interface": apps/demo on the page, its files, which piece uses
 * which hook, its skeleton read from its own file, what it had to get right,
 * and running it.
 */
export async function ExamplePage() {
  const t = getT();
  const source = readFileSync(join(process.cwd(), '../demo/src/HeadlessEditor.tsx'), 'utf8');
  const skeletonSource = source.slice(source.indexOf('/** What is inside the provider')).trim();
  const [run, skeleton] = await Promise.all([
    highlight(
      `git clone https://github.com/JFranciscoRobles/rebodocs
cd rebodocs
npm install
npm run demo        # http://localhost:5175, and /#headless for the second tab`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(skeletonSource, 'tsx', LIGHT_THEME),
  ]);

  const rows = (list: [string, string][], width = 280) => (
    <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
      {list.map(([term, text]) => (
        <div key={term} className="grid gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${width}px),1fr))` }}>
          <dt className="text-[15px] font-semibold text-ink [overflow-wrap:anywhere]">{term}</dt>
          <dd className="m-0 font-code text-[13px] leading-[1.6] text-ink-soft [overflow-wrap:anywhere]">{text}</dd>
        </div>
      ))}
    </dl>
  );
  const demoLink = (
    <LocalLink href="/demo/" className={LINK}>
      {t({ en: 'rebodocs.com/demo', es: 'rebodocs.com/es/demo', zh: 'rebodocs.com/zh/demo' })}
    </LocalLink>
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {t({ en: 'A complete interface', es: 'Una interfaz completa', zh: '一套完整的界面' })}
      </h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: (
            <>
              The repository has an application that uses <code className={mono}>@rebodocs/react</code> the way yours would:{' '}
            </>
          ),
          es: (
            <>
              El repositorio tiene una aplicación que usa <code className={mono}>@rebodocs/react</code> como lo haría la tuya:{' '}
            </>
          ),
          zh: (
            <>
              仓库中有一个以你的应用会采用的方式使用 <code className={mono}>@rebodocs/react</code> 的应用：
            </>
          ),
        })}
        <a href={REPO} className={LINK}>
          apps/demo
        </a>
        {t({
          en: (
            <>
              . It shows a document two ways: the editor as it comes (<code className={mono}>DocsEditor</code>), and an interface built from nothing on the hooks, dark and laid out like a design tool.
              The second does everything the first does, so it is the place to copy from.
            </>
          ),
          es: (
            <>
              . Muestra un documento de dos formas: el editor tal como viene (<code className={mono}>DocsEditor</code>), y una interfaz construida desde cero sobre los hooks, oscura y dispuesta como
              una herramienta de diseño. La segunda hace todo lo que hace la primera, así que es de donde copiar.
            </>
          ),
          zh: (
            <>
              。它用两种方式展示文档：开箱即用的编辑器（<code className={mono}>DocsEditor</code>），以及基于 hooks 从零构建、深色且布局类似设计工具的界面。第二种能做第一种能做的一切，所以最适合借鉴。
            </>
          ),
        })}
      </p>
      <div className="mt-4">
        <HandTip>
          {t({
            en: 'tip: this is the second one, running: try the panels at its right',
            es: 'tip: esta es la segunda, corriendo: prueba los paneles de su derecha',
            zh: '提示：这就是第二种界面，正在运行，试试右侧的面板',
          })}
        </HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead
          id="try"
          badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })}
          color="green"
          title={t({ en: 'Your own interface, running', es: 'Tu propia interfaz, corriendo', zh: '你自己的界面，正在运行' })}
        >
          {t({
            en: (
              <>
                The component of <code className={mono}>apps/demo/src/HeadlessEditor.tsx</code>, imported here as it is, on the contract it opens with: a template in English with headings, variables
                with a type, a table, text in two columns, places to sign, a header and a page number. The interface opens in the language of this page; the selector in its status bar changes it.
              </>
            ),
            es: (
              <>
                El componente de <code className={mono}>apps/demo/src/HeadlessEditor.tsx</code>, importado aquí tal cual, con el contrato con que abre: una plantilla en inglés con títulos, variables
                con tipo, una tabla, texto en dos columnas, lugares para firmar, un encabezado y un número de página. La interfaz abre en el idioma de esta página; el selector de su barra de estado lo
                cambia.
              </>
            ),
            zh: (
              <>
                这里原样导入了 <code className={mono}>apps/demo/src/HeadlessEditor.tsx</code>{' '}
                中的组件，打开的是它默认的合同：一份英文模板，包含标题、带类型的变量、表格、两栏文字、签名处、页眉和页码。界面以本页面的语言打开；状态栏中的语言选择器可以切换。
              </>
            ),
          })}
        </SectionHead>
        <LazyLiveDemo />
        <p className={prose}>
          {t({ en: 'Both tabs, full screen, with a DOCX of your own: ', es: 'Las dos pestañas, a pantalla completa, con un DOCX tuyo: ', zh: '全屏查看两个标签页，并打开你自己的 DOCX：' })}
          {demoLink}
          {t({
            en: (
              <>
                {' '}
                (<code className={mono}>/demo/#full</code> opens on the included one).
              </>
            ),
            es: (
              <>
                {' '}
                (<code className={mono}>/demo/#full</code> abre en la incluida).
              </>
            ),
            zh: (
              <>
                （<code className={mono}>/demo/#full</code> 会直接打开自带界面）。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="run" className="mt-24">
        <SectionHead id="run" badge={t({ en: 'Run', es: 'Correr', zh: '运行' })} color="blue" title={t({ en: 'Run it', es: 'Córrela', zh: '运行它' })}>
          {t({
            en: (
              <>
                It runs the package from its source, so a change in <code className={mono}>packages/react</code> shows at once. That is the one line of its <code className={mono}>vite.config.ts</code>{' '}
                a copy in a project of yours leaves out: there, <code className={mono}>@rebodocs/react</code> comes from npm.
              </>
            ),
            es: (
              <>
                Corre el paquete desde su código fuente, así que un cambio en <code className={mono}>packages/react</code> se ve de inmediato. Esa es la única línea de su{' '}
                <code className={mono}>vite.config.ts</code> que deja fuera una copia en un proyecto tuyo: ahí, <code className={mono}>@rebodocs/react</code> viene de npm.
              </>
            ),
            zh: (
              <>
                它直接运行软件包的源码，因此 <code className={mono}>packages/react</code> 中的改动会立即生效。复制到你自己的项目时，只需去掉 <code className={mono}>vite.config.ts</code>{' '}
                中的这一行：在那里，
                <code className={mono}>@rebodocs/react</code> 来自 npm。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: run }} />
        <p className={prose}>
          {t({
            en: (
              <>
                <strong>Open a .docx</strong> opens a file in both tabs; there is no backend, so saving downloads it.
              </>
            ),
            es: (
              <>
                <strong>Open a .docx</strong> abre un archivo en las dos pestañas; no hay backend, así que guardar lo descarga.
              </>
            ),
            zh: (
              <>
                <strong>Open a .docx</strong> 会在两个标签页中同时打开文件；没有后端，所以保存时会下载文件。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="what-is-where" className="mt-24">
        <SectionHead id="what-is-where" badge={t({ en: 'Files', es: 'Archivos', zh: '文件' })} color="purple" title={t({ en: 'What is where', es: 'Qué está dónde', zh: '各部分在哪里' })} />
        {rows(FILES.map((one) => [one.file, t(one.text)]))}
      </section>

      <section aria-labelledby="which-piece-uses-what" className="mt-24">
        <SectionHead id="which-piece-uses-what" badge="Hooks" color="yellow" title={t({ en: 'Which piece uses what', es: 'Qué pieza usa qué', zh: '各部件用了什么' })}>
          {t({ en: 'Each hook is on the page ', es: 'Cada hook está en la página ', zh: '每个 hook 都在' })}
          <LocalLink href="/docs/components/" className={LINK}>
            {t({ en: 'Components and hooks', es: 'Componentes y hooks', zh: '组件与 Hooks' })}
          </LocalLink>
          {t({ en: ', with what it takes and gives.', es: ', con lo que recibe y lo que da.', zh: '一页中，附有参数和返回值。' })}
        </SectionHead>
        {rows(
          USES.map((one) => [t(one.piece), one.with]),
          300,
        )}
      </section>

      <section aria-labelledby="the-skeleton" className="mt-24">
        <SectionHead id="the-skeleton" badge={t({ en: 'Skeleton', es: 'Esqueleto', zh: '骨架' })} color="pink" title={t({ en: 'The skeleton', es: 'El esqueleto', zh: '骨架' })}>
          {t({
            en: (
              <>
                Everything hangs from one provider. What a key must reach (⌘F opens the find bar) is above it; the rest is inside. This is the end of <code className={mono}>HeadlessEditor.tsx</code>,
                read from the file.
              </>
            ),
            es: (
              <>
                Todo cuelga de un solo provider. Lo que una tecla debe alcanzar (⌘F abre la barra de búsqueda) está por encima; el resto, dentro. Este es el final de{' '}
                <code className={mono}>HeadlessEditor.tsx</code>, leído del archivo.
              </>
            ),
            zh: (
              <>
                一切都挂在同一个 provider 下。快捷键需要访问的东西（⌘F 打开查找栏）放在它上方，其余都在内部。下面是从文件中读取的 <code className={mono}>HeadlessEditor.tsx</code> 末尾部分。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[920px] ${CODE}`} dangerouslySetInnerHTML={{ __html: skeleton }} />
        <p className={prose}>
          {t({
            en: (
              <>
                The column the pages are in is <code className={mono}>display: flex; flex-direction: column; min-width: 0</code>, and the surface <code className={mono}>flex: 1; min-height: 0</code>:
                that is what gives it the height it needs and lets it scroll. Under 900 pixels of window a media query lays it out again: the bars become one row each that slides, the insert rail lies
                down, the panels open over the document from a button, and the ruler goes.
              </>
            ),
            es: (
              <>
                La columna donde están las páginas es <code className={mono}>display: flex; flex-direction: column; min-width: 0</code>, y la superficie{' '}
                <code className={mono}>flex: 1; min-height: 0</code>: eso le da la altura que necesita y le permite desplazarse. Con menos de 900 píxeles de ventana, una media query la reacomoda: las
                barras se vuelven una fila cada una que se desliza, el riel de inserción se acuesta, los paneles se abren sobre el documento desde un botón, y la regla desaparece.
              </>
            ),
            zh: (
              <>
                页面所在的列使用 <code className={mono}>display: flex; flex-direction: column; min-width: 0</code>，surface 使用 <code className={mono}>flex: 1; min-height: 0</code>
                ：这样它才能获得所需的高度并可以滚动。窗口宽度小于 900 像素时，媒体查询会重新布局：各个工具栏变成可横向滑动的单行，插入侧栏改为横向，面板通过按钮覆盖在文档上方打开，标尺则被隐藏。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="things-it-had-to-get-right" className="mt-24">
        <SectionHead
          id="things-it-had-to-get-right"
          badge={t({ en: 'Details', es: 'Detalles', zh: '细节' })}
          color="orange"
          title={t({ en: 'Things it had to get right', es: 'Lo que tuvo que resolver bien', zh: '必须做对的事' })}
        />
        <div className="mt-7 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))' }}>
          {RIGHT.map((card, i) => (
            <div key={card.title.en} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i % COLORS.length]]}`}>{t(card.title)}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{t(card.text)}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          {t({
            en: (
              <>
                The library’s own pieces take its colours from variables, not from rules that reach into their classes: the ruler from <code className={mono}>--dx-ruler…</code> set on{' '}
                <code className={mono}>.hd</code>; the bar beside the selection, and the rest the library puts in <code className={mono}>document.body</code> outside <code className={mono}>.hd</code>,
                from the{' '}
              </>
            ),
            es: (
              <>
                Las piezas propias de la biblioteca toman sus colores de variables, no de reglas que se meten en sus clases: la regla de <code className={mono}>--dx-ruler…</code> fijadas en{' '}
                <code className={mono}>.hd</code>; la barra junto a la selección, y lo demás que la biblioteca pone en <code className={mono}>document.body</code> fuera de{' '}
                <code className={mono}>.hd</code>, de las{' '}
              </>
            ),
            zh: (
              <>
                库自身的部件通过变量获取颜色，而不是通过深入其类名的规则：标尺使用设置在 <code className={mono}>.hd</code> 上的 <code className={mono}>--dx-ruler…</code>；选区旁的工具条，以及库放到{' '}
                <code className={mono}>.hd</code> 之外 <code className={mono}>document.body</code> 中的其他元素，则使用
              </>
            ),
          })}
          <LocalLink href="/docs/styling/#the-included-interface" className={LINK}>
            {t({ en: '--dx-ui-… variables', es: 'variables --dx-ui-…', zh: '--dx-ui-… 变量' })}
          </LocalLink>
          {t({
            en: (
              <>
                {' '}
                set on <code className={mono}>body:has(.hd)</code>, while the interface is on the page.
              </>
            ),
            es: (
              <>
                {' '}
                fijadas en <code className={mono}>body:has(.hd)</code>, mientras la interfaz está en la página.
              </>
            ),
            zh: (
              <>
                （在界面位于页面上时设置在 <code className={mono}>body:has(.hd)</code> 上）。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="using-it-for-a-demonstration" className="mt-24">
        <SectionHead
          id="using-it-for-a-demonstration"
          badge={t({ en: 'Show it', es: 'Muéstrala', zh: '演示' })}
          color="green"
          title={t({ en: 'Using it for a demonstration', es: 'Usarla para una demostración', zh: '用于演示' })}
        />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>
            {demoLink}
            {t({ en: ' has it online, with nothing to install.', es: ' la tiene en línea, sin instalar nada.', zh: ' 提供在线版本，无需安装任何东西。' })}
          </li>
          <li>
            {t({
              en: (
                <>
                  <code className={mono}>npm run demo</code> and open <code className={mono}>/#headless</code> for your own interface, or <code className={mono}>/</code> for the included one.
                </>
              ),
              es: (
                <>
                  <code className={mono}>npm run demo</code> y abre <code className={mono}>/#headless</code> para tu propia interfaz, o <code className={mono}>/</code> para la incluida.
                </>
              ),
              zh: (
                <>
                  运行 <code className={mono}>npm run demo</code>，打开 <code className={mono}>/#headless</code> 查看你自己的界面，或打开 <code className={mono}>/</code> 查看自带界面。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: (
                <>
                  <strong>Open a .docx</strong> shows a real document of the person you are showing it to, in both.
                </>
              ),
              es: (
                <>
                  <strong>Open a .docx</strong> muestra un documento real de la persona a quien se lo enseñas, en las dos.
                </>
              ),
              zh: (
                <>
                  <strong>Open a .docx</strong> 可以在两种界面中展示观众自己的真实文档。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: (
                <>
                  <code className={mono}>npm run build:demo</code> writes <code className={mono}>apps/demo/dist</code>, a static site to put anywhere.
                </>
              ),
              es: (
                <>
                  <code className={mono}>npm run build:demo</code> escribe <code className={mono}>apps/demo/dist</code>, un sitio estático para poner en cualquier lado.
                </>
              ),
              zh: (
                <>
                  <code className={mono}>npm run build:demo</code> 会生成 <code className={mono}>apps/demo/dist</code>，这是一个可以部署到任何地方的静态站点。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: (
                <>
                  To change what it opens with, edit <code className={mono}>scripts/sample.ts</code>: <code className={mono}>npm run sample -w @rebodocs/demo</code> writes the file again.
                </>
              ),
              es: (
                <>
                  Para cambiar con qué abre, edita <code className={mono}>scripts/sample.ts</code>: <code className={mono}>npm run sample -w @rebodocs/demo</code> vuelve a escribir el archivo.
                </>
              ),
              zh: (
                <>
                  要修改默认打开的文档，请编辑 <code className={mono}>scripts/sample.ts</code>：运行 <code className={mono}>npm run sample -w @rebodocs/demo</code> 重新生成文件。
                </>
              ),
            })}
          </li>
        </ul>
      </section>
    </>
  );
}
