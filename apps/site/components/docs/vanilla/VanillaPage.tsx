import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { InstallCommand } from '../InstallCommand';
import { LazyAssembleDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** Each piece, from packages/editor/src/index.ts and the create… function of each. */
const PIECES: { call: string; text: L }[] = [
  {
    call: 'new Editor(element)',
    text: {
      en: 'The pages. Holds the document, the selection and the history; the element needs a height.',
      es: 'Las páginas. Tiene el documento, la selección y el historial; el elemento necesita una altura.',
      zh: '页面。持有文档、选区和历史记录；元素需要有高度。',
    },
  },
  {
    call: 'createToolbar(el, editor, options)',
    text: {
      en: 'One row of formatting; what does not fit folds into a tray. Its options give it the buttons that open the other pieces.',
      es: 'Una fila de formato; lo que no cabe se pliega en una bandeja. Sus opciones le dan los botones que abren las demás piezas.',
      zh: '一行格式工具；放不下的会折叠进一个托盘。它的选项提供用于打开其他部件的按钮。',
    },
  },
  {
    call: 'createRuler(el, editor)',
    text: {
      en: 'Margins, indents and tab stops, to drag or to move with the keys.',
      es: 'Márgenes, sangrías y tabulaciones, para arrastrar o mover con las teclas.',
      zh: '页边距、缩进和制表位，可以拖动或用键盘移动。',
    },
  },
  {
    call: 'createPanel(el, editor, { versions?, rail?, onError?, onToggle? })',
    text: {
      en: 'The side panel: outline, template variables, notes, tracked changes, and versions when the application keeps them. show(tab?), hide(), toggle() and isOpen; onToggle is called when it opens or closes, by its own buttons too, and rail sets its tabs as icons always there.',
      es: 'El panel lateral: esquema, variables de plantilla, notas, control de cambios, y versiones cuando la aplicación las guarda. show(tab?), hide(), toggle() e isOpen; onToggle se llama cuando se abre o se cierra, también con sus propios botones, y rail pone sus pestañas como iconos siempre visibles.',
      zh: '侧边栏：大纲、模板变量、批注、修订，以及应用保存版本时的版本。提供 show(tab?)、hide()、toggle() 和 isOpen；打开或关闭时（包括通过它自己的按钮）会调用 onToggle；rail 会把标签页显示为常驻的图标。',
    },
  },
  {
    call: 'createStatusBar(el, editor, options)',
    text: {
      en: 'Pages, words, the language of the text, the view, the zoom; who is on the document and the assistant, when given.',
      es: 'Páginas, palabras, el idioma del texto, la vista, el zoom; quién está en el documento y el asistente, cuando se dan.',
      zh: '页数、字数、文本语言、视图、缩放比例；提供相应选项时，还有文档中的人员和助手。',
    },
  },
  {
    call: 'createBubble(editor, { forms? })',
    text: {
      en: 'The bar beside the selection, with what can be done to it; on a phone, copy and paste too. With forms, making the selection an area to fill in.',
      es: 'La barra junto a la selección, con lo que se puede hacer con ella; en un teléfono, también copiar y pegar. Con forms, convertir la selección en un área para llenar.',
      zh: '选区旁的工具条，提供可对选区执行的操作；在手机上还有复制和粘贴。开启 forms 后，还能把选区设为待填区域。',
    },
  },
  {
    call: 'createSlashMenu(editor, { ask?, forms?, builtIns?, commands? })',
    text: {
      en: 'The menu a “/” brings up at the start of a paragraph or after a space: headings, lists, a table, a picture, the signatures, and your own commands. See Headless, The “/” menu.',
      es: 'El menú que abre una “/” al inicio de un párrafo o después de un espacio: títulos, listas, una tabla, una imagen, las firmas, y tus propios comandos. Ve Headless, El menú “/”.',
      zh: '在段落开头或空格后输入 “/” 弹出的菜单：标题、列表、表格、图片、签名，以及你自己的命令。参见 Headless 中的“/”菜单。',
    },
  },
  {
    call: 'createVariableSuggest(editor, { variables? })',
    text: {
      en: 'The list “{{” brings up: the variables you fill, then those of the document, written whole. See Templates, In the editor.',
      es: 'La lista que abre “{{”: las variables que llenas, luego las del documento, escritas completas. Ve Plantillas, En el editor.',
      zh: '输入 “{{” 弹出的列表：先是你会填写的变量，然后是文档中的变量，选中后完整写入。参见模板一页的“在编辑器中”。',
    },
  },
  {
    call: 'createFindBar(editor)',
    text: { en: 'Find and replace, opened with open() or ⌘F (Ctrl+F).', es: 'Buscar y reemplazar, que se abre con open() o ⌘F (Ctrl+F).', zh: '查找和替换，通过 open() 或 ⌘F（Ctrl+F）打开。' },
  },
  {
    call: 'createSidebar(editor, options)',
    text: {
      en: "The document menu: open, save, export, page setup, letterhead, the language of the interface. A card from the button of the menu, or with variant: 'screen' a screen of its own. With within: an element, it stays inside that box instead of the whole window.",
      es: "El menú del documento: abrir, guardar, exportar, configurar página, membrete, el idioma de la interfaz. Una tarjeta desde el botón del menú, o con variant: 'screen' una pantalla propia. Con within: un elemento, se queda dentro de esa caja en lugar de toda la ventana.",
      zh: "文档菜单：打开、保存、导出、页面设置、信头、界面语言。默认是从菜单按钮弹出的卡片，设置 variant: 'screen' 则是独立界面。传入 within: 某个元素时，它会限制在该元素内，而不是覆盖整个窗口。",
    },
  },
  {
    call: 'createFocusMode(editor, options)',
    text: {
      en: 'The pages alone, full screen, with ⌘⇧. (Ctrl+Shift+.); Escape leaves.',
      es: 'Solo las páginas, a pantalla completa, con ⌘⇧. (Ctrl+Shift+.); Escape sale.',
      zh: '只显示页面并全屏，快捷键 ⌘⇧.（Ctrl+Shift+.）；按 Esc 退出。',
    },
  },
  {
    call: 'createResponsive(shell, editor)',
    text: {
      en: 'Narrow windows and the keyboard of a phone. See Phones and touch.',
      es: 'Ventanas angostas y el teclado de un teléfono. Ve Teléfonos y pantallas táctiles.',
      zh: '适配窄窗口和手机键盘。参见“手机与触屏”。',
    },
  },
];

/** What else the package has for an interface of plain DOM. */
const MORE: { call: string; text: L }[] = [
  {
    call: 'createVersionView(editor, versions)',
    text: { en: 'A version shown beside the document, its changes marked.', es: 'Una versión mostrada junto al documento, con sus cambios marcados.', zh: '在文档旁显示某个版本，并标出修改。' },
  },
  {
    call: 'createImagePicker(editor) · openImageGrid(editor, files)',
    text: {
      en: 'Asking for pictures, and the dialog that sets out several in a grid.',
      es: 'Pedir imágenes, y el diálogo que acomoda varias en una cuadrícula.',
      zh: '选择图片，以及把多张图片排成网格的对话框。',
    },
  },
  {
    call: 'setAuthor(editor, name) · recallAuthor(editor)',
    text: {
      en: 'The name notes and changes are signed with, kept for the next visit.',
      es: 'El nombre con que se firman las notas y los cambios, guardado para la siguiente visita.',
      zh: '批注和修订的署名，会保存到下次访问。',
    },
  },
  {
    call: 'addFont(source) · setLocale(code) · addLocale(code, texts)',
    text: {
      en: 'Fonts of your own, and the language of the interface. See Fonts and Languages.',
      es: 'Fuentes propias, y el idioma de la interfaz. Ve Fuentes e Idiomas.',
      zh: '你自己的字体，以及界面语言。参见“字体”和“语言”。',
    },
  },
  {
    call: 'createSpellChecker({ dictionaries }) → editor.spellChecker',
    text: {
      en: 'The red wave under words spelled wrong, with Hunspell dictionaries you give, read in a worker. See Spelling.',
      es: 'La onda roja bajo las palabras mal escritas, con los diccionarios Hunspell que des, leídos en un worker. Ve Ortografía.',
      zh: '在拼错的单词下显示红色波浪线，使用你提供的 Hunspell 词典，在 worker 中读取。参见“拼写”。',
    },
  },
  {
    call: 'applyTheme(element, theme) · editor.theme',
    text: {
      en: "The dark theme, or 'auto' for the system's: on the element around the pieces, and on the editor for what it shows outside it.",
      es: "El tema oscuro, o 'auto' para el del sistema: en el elemento que rodea las piezas, y en el editor para lo que muestra fuera de él.",
      zh: "深色主题，或 'auto' 跟随系统：设置在包裹各部件的元素上，以及编辑器上（作用于它在自身之外显示的内容）。",
    },
  },
];

/** The options that wire one piece to another. */
const WIRES: { option: string; text: L }[] = [
  {
    option: 'toolbar onMenu: menu.toggle',
    text: { en: 'The button at its start opens the document menu.', es: 'El botón de su inicio abre el menú del documento.', zh: '工具栏开头的按钮会打开文档菜单。' },
  },
  {
    option: 'toolbar onPanel: panel.toggle · panelOpen: () => panel.isOpen',
    text: {
      en: "The button that shows and hides the side panel, at the end of the bar, pressed while it is open; panelSide: 'left' puts it at the start, for a panel on the left.",
      es: "El botón que muestra y oculta el panel lateral, al final de la barra, presionado mientras está abierto; panelSide: 'left' lo pone al inicio, para un panel a la izquierda.",
      zh: "工具栏末尾用于显示和隐藏侧边栏的按钮，侧边栏打开时呈按下状态；panelSide: 'left' 会把它放到开头，用于左侧面板。",
    },
  },
  {
    option: 'panel onToggle: () => toolbar.refresh()',
    text: {
      en: 'The button is pressed again when the panel is closed with its own button.',
      es: 'El botón vuelve a quedar sin presionar cuando el panel se cierra con su propio botón.',
      zh: '用侧边栏自己的按钮关闭它时，工具栏按钮的状态也会同步更新。',
    },
  },
  { option: 'toolbar onFind: () => find.open()', text: { en: 'The search button at its end.', es: 'El botón de búsqueda a su final.', zh: '工具栏末尾的搜索按钮。' } },
  {
    option: 'toolbar onInsertLink · onInsertNote · onInsertVariable',
    text: {
      en: "Insert → Link, Note and Variable ask in the selection bar: () => bubble.ask('link'). Without them they ask in a prompt of the browser.",
      es: "Insertar → Enlace, Nota y Variable preguntan en la barra de la selección: () => bubble.ask('link'). Sin ellas preguntan con un prompt del navegador.",
      zh: "“插入 → 链接、批注、变量”会在选区工具条中询问：() => bubble.ask('link')。不提供时，会使用浏览器的 prompt 询问。",
    },
  },
  {
    option: 'createSlashMenu(editor, { ask: bubble.ask })',
    text: {
      en: 'The “/” menu offers a variable and a note, asked for in the selection bar; without ask, it leaves them out.',
      es: 'El menú “/” ofrece una variable y una nota, que se piden en la barra de la selección; sin ask, las deja fuera.',
      zh: '“/” 菜单会提供变量和批注，并在选区工具条中询问内容；不提供 ask 时，这两项不会出现。',
    },
  },
  {
    option: "editor.onLinkKey = () => bubble.ask('link')",
    text: {
      en: '⌘K (Ctrl+K) asks for the address there too; without it, the key is left to the browser.',
      es: '⌘K (Ctrl+K) también pide ahí la dirección; sin esto, la tecla se le deja al navegador.',
      zh: '⌘K（Ctrl+K）也会在那里询问链接地址；不设置时，该快捷键交给浏览器处理。',
    },
  },
  {
    option: 'status focus: { on: () => focus.on, toggle: focus.toggle }',
    text: { en: 'The full-screen button at the end of the status bar.', es: 'El botón de pantalla completa al final de la barra de estado.', zh: '状态栏末尾的全屏按钮。' },
  },
];

/**
 * "Without a framework": the pieces of @rebodocs/editor put on and taken off
 * a bare Editor; what each is; how they are wired; changing the language;
 * the whole of it at once with mountDocs; and the editor itself.
 */
export async function VanillaPage() {
  const t = getT();
  const [html, first, language, whole, methods] = await Promise.all([
    highlight(
      `<div id="toolbar"></div>
<div id="pages" style="height: 80vh"></div>
<div id="status"></div>`,
      'html',
      LIGHT_THEME,
    ),
    highlight(
      `import { Editor, createToolbar, createStatusBar, createBubble } from '@rebodocs/editor';

const editor = new Editor(document.querySelector('#pages')!);
createToolbar(document.querySelector('#toolbar')!, editor);
createStatusBar(document.querySelector('#status')!, editor);
createBubble(editor);

editor.loadDocx(bytes);
editor.onChange(() => console.log(editor.pageCount, 'pages'));

const docx = editor.exportDocx();
const pdf = await editor.exportPdf('Contract');`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { onLocaleChange, setLocale } from '@rebodocs/editor';

let pieces = makePieces(editor);            // your function: creates them, returns them
onLocaleChange(() => {
  pieces.forEach((piece) => piece.destroy());
  pieces = makePieces(editor);              // made again, in the new language
});
setLocale('es');`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { mountDocs } from '@rebodocs/react/mount';

const docs = mountDocs(document.querySelector('#editor')!, {
  docx: bytes,
  name: 'contract.docx',
  locale: 'en',
  onSave: (docx, name) => upload(docx, name),
});
docs.editor;      // the Editor, for everything else
docs.destroy();`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `editor.setSelection({ para: 0, offset: 0 }, { para: 0, offset: 5 });
editor.toggleMark('bold');
editor.insertText('Hello');
editor.undo();
editor.setZoom(1.25);`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  const rows = (list: { call?: string; option?: string; text: L }[], width = 300) => (
    <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
      {list.map((row) => (
        <div
          key={row.call ?? row.option}
          className="grid gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0"
          style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${width}px),1fr))` }}
        >
          <dt className="font-code text-[13.5px] font-semibold text-ink [overflow-wrap:anywhere]">{row.call ?? row.option}</dt>
          <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(row.text)}</dd>
        </div>
      ))}
    </dl>
  );
  const dot = t({ en: '.', es: '.', zh: '。' });

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{t({ en: 'Without a framework', es: 'Sin framework', zh: '不用框架' })}</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        <a href="https://www.npmjs.com/package/@rebodocs/editor" className={LINK}>
          @rebodocs/editor
        </a>{' '}
        {t({
          en: (
            <>
              is plain TypeScript and the DOM. The <code className={mono}>Editor</code> class is the pages; everything around them is a piece of its own, made if you want it, in the element you give
              it.
            </>
          ),
          es: (
            <>
              es TypeScript simple y el DOM. La clase <code className={mono}>Editor</code> son las páginas; todo lo que las rodea es una pieza aparte, que se crea si la quieres, en el elemento que le
              des.
            </>
          ),
          zh: (
            <>
              只用纯 TypeScript 和 DOM。<code className={mono}>Editor</code> 类就是页面；页面周围的一切都是独立的部件，需要时才创建，放在你提供的元素中。
            </>
          ),
        })}
      </p>
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: put the pieces on and take them off below', es: 'tip: pon y quita las piezas abajo', zh: '提示：在下方装上或拆下各个部件' })}</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'Put it together', es: 'Ármalo', zh: '组装起来' })}>
          {t({
            en: (
              <>
                One <code className={mono}>Editor</code>, made once, and the pieces around it: each choice destroys them all and makes the chosen ones again, wired to each other. The document and its
                history stay.
              </>
            ),
            es: (
              <>
                Un <code className={mono}>Editor</code>, creado una vez, y las piezas a su alrededor: cada elección las destruye todas y vuelve a crear las elegidas, conectadas entre sí. El documento
                y su historial se quedan.
              </>
            ),
            zh: (
              <>
                一个只创建一次的 <code className={mono}>Editor</code>，以及它周围的部件：每次选择都会销毁所有部件，再重新创建选中的部件并把它们连接起来。文档及其历史记录保持不变。
              </>
            ),
          })}
        </SectionHead>
        <LazyAssembleDemo />
      </section>

      <section aria-labelledby="start" className="mt-24">
        <SectionHead id="start" badge={t({ en: 'Start', es: 'Inicio', zh: '开始' })} color="blue" title={t({ en: 'The smallest page', es: 'La página más pequeña', zh: '最小的页面' })} />
        <div className="mt-6 max-w-[760px]">
          <InstallCommand command="npm install @rebodocs/editor" />
        </div>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: html }} />
        <div className={`mt-2 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: first }} />
      </section>

      <section aria-labelledby="the-pieces" className="mt-24">
        <SectionHead id="the-pieces" badge={t({ en: 'Pieces', es: 'Piezas', zh: '部件' })} color="purple" title={t({ en: 'The pieces', es: 'Las piezas', zh: '各个部件' })}>
          {t({
            en: (
              <>
                Each is a function that takes the element it goes in, when it has one, and gives back what it made, with <code className={mono}>destroy()</code>.
              </>
            ),
            es: (
              <>
                Cada una es una función que recibe el elemento donde va, cuando lo tiene, y devuelve lo que creó, con <code className={mono}>destroy()</code>.
              </>
            ),
            zh: (
              <>
                每个部件都是一个函数：接收它要放入的元素（如果需要），并返回创建的对象，其中带有 <code className={mono}>destroy()</code>。
              </>
            ),
          })}
        </SectionHead>
        {rows(PIECES)}
        <p className={prose}>{t({ en: 'And for what an interface also needs:', es: 'Y para lo demás que necesita una interfaz:', zh: '以及界面还需要的其他东西：' })}</p>
        {rows(MORE)}
      </section>

      <section aria-labelledby="wiring" className="mt-24">
        <SectionHead id="wiring" badge={t({ en: 'Wiring', es: 'Conexión', zh: '连接' })} color="yellow" title={t({ en: 'Wiring them together', es: 'Conectarlas', zh: '把它们连起来' })}>
          {t({
            en: 'A piece does not look for the others: the options of one take the methods of another. The toolbar shows the button of the menu, the panel or the search only when it is given what to open.',
            es: 'Una pieza no busca a las demás: las opciones de una toman los métodos de otra. La barra de herramientas muestra el botón del menú, del panel o de la búsqueda solo cuando se le da qué abrir.',
            zh: '部件之间不会互相查找：一个部件的选项接收另一个部件的方法。只有提供了要打开的对象，工具栏才会显示菜单、面板或搜索按钮。',
          })}
        </SectionHead>
        {rows(WIRES)}
        <p className={prose}>
          {t({
            en: (
              <>
                The code under the demo above is exactly this wiring, for the pieces chosen. A page that wires every one of them, with collaboration and an assistant as well, is{' '}
                <code className={mono}>apps/playground/src/main.ts</code> in the repository.
              </>
            ),
            es: (
              <>
                El código bajo la demo de arriba es exactamente esta conexión, para las piezas elegidas. Una página que las conecta todas, también con colaboración y un asistente, es{' '}
                <code className={mono}>apps/playground/src/main.ts</code> en el repositorio.
              </>
            ),
            zh: (
              <>
                上方演示下面的代码正是针对所选部件的这种连接方式。仓库中的 <code className={mono}>apps/playground/src/main.ts</code> 则连接了所有部件，还加上了协作和助手。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="language" className="mt-24">
        <SectionHead id="language" badge={t({ en: 'Language', es: 'Idioma', zh: '语言' })} color="pink" title={t({ en: 'Changing the language', es: 'Cambiar el idioma', zh: '切换语言' })}>
          {t({
            en: 'The pieces take their words when they are made. To change the language with everything open, destroy them and make them again; the editor keeps the document, the selection and the history.',
            es: 'Las piezas toman sus palabras al crearse. Para cambiar el idioma con todo abierto, destrúyelas y vuelve a crearlas; el editor conserva el documento, la selección y el historial.',
            zh: '部件在创建时读取文字。要在全部打开的情况下切换语言，请销毁并重新创建它们；编辑器会保留文档、选区和历史记录。',
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: language }} />
        <p className={prose}>
          {t({
            en: 'The editor itself follows the language by itself: what it says to a screen reader, and the names of the styles. See ',
            es: 'El editor en sí sigue el idioma por su cuenta: lo que le dice a un lector de pantalla, y los nombres de los estilos. Ve ',
            zh: '编辑器本身会自动跟随语言：包括告诉屏幕阅读器的内容和样式名称。参见',
          })}
          <LocalLink href="/docs/languages/" className={LINK}>
            {t({ en: 'Languages', es: 'Idiomas', zh: '语言' })}
          </LocalLink>
          {dot}
        </p>
      </section>

      <section aria-labelledby="the-whole-thing-at-once" className="mt-24">
        <SectionHead
          id="the-whole-thing-at-once"
          badge={t({ en: 'All of it', es: 'Todo', zh: '全部' })}
          color="orange"
          title={t({ en: 'The whole thing at once', es: 'Todo de una vez', zh: '一次全部装上' })}
        >
          {t({
            en: (
              <>
                <code className={mono}>mountDocs</code> builds all of that in any element, wired, with the options of the{' '}
              </>
            ),
            es: (
              <>
                <code className={mono}>mountDocs</code> construye todo eso en cualquier elemento, conectado, con las opciones del{' '}
              </>
            ),
            zh: (
              <>
                <code className={mono}>mountDocs</code> 会在任意元素中构建并连接好以上全部内容，选项与
              </>
            ),
          })}
          <LocalLink href="/docs/react/" className={LINK}>
            {t({ en: 'React component', es: 'componente de React', zh: 'React 组件' })}
          </LocalLink>
          {t({ en: ', and changes the language by itself.', es: ', y cambia el idioma por su cuenta.', zh: '相同，并且会自动切换语言。' })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: whole }} />
        <p className={prose}>
          {t({
            en: (
              <>
                It runs no React: it is the <code className={mono}>/mount</code> entry of <code className={mono}>@rebodocs/react</code>, which holds none, and React is an optional peer of the package,
                so npm does not install it. Only the components and hooks of the main entry need it.
              </>
            ),
            es: (
              <>
                No corre React: es la entrada <code className={mono}>/mount</code> de <code className={mono}>@rebodocs/react</code>, que no lo contiene, y React es un peer opcional del paquete, así
                que npm no lo instala. Solo los componentes y hooks de la entrada principal lo necesitan.
              </>
            ),
            zh: (
              <>
                它不运行 React：这是 <code className={mono}>@rebodocs/react</code> 的 <code className={mono}>/mount</code> 入口，其中不包含 React；React 是该软件包的可选 peer 依赖，所以 npm
                不会安装它。只有主入口中的组件和 hooks 才需要 React。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="working-with-the-editor" className="mt-24">
        <SectionHead id="working-with-the-editor" badge="Editor" color="green" title={t({ en: 'Working with the editor', es: 'Trabajar con el editor', zh: '使用编辑器' })}>
          {t({
            en: 'Everything the pieces do, they do through its methods, and so can you. All of them are on the page ',
            es: 'Todo lo que hacen las piezas, lo hacen a través de sus métodos, y tú también puedes. Todos están en la página ',
            zh: '部件所做的一切都是通过编辑器的方法完成的，你也可以这样做。全部方法见',
          })}
          <LocalLink href="/docs/editor-api/" className={LINK}>
            {t({ en: 'Editor API', es: 'API del Editor', zh: 'Editor API' })}
          </LocalLink>
          {t({ en: '; a few to start with:', es: '; algunos para empezar:', zh: '一页；先看几个：' })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: methods }} />
      </section>
    </>
  );
}
