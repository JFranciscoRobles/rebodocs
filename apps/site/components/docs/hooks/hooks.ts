// The thirteen hooks of @rebodocs/react, as the explorer shows them. Plain
// data: what runs is in `examples/`, one file each, and the page colours the code on the server.
// Each text in each language of the site; the keys are code, the same in all.

import type { L } from '@/lib/i18n';

export type HookCategory = 'Document' | 'Writing' | 'Page' | 'Interface';
export const HOOK_CATEGORIES: HookCategory[] = ['Document', 'Writing', 'Page', 'Interface'];

/** What each kind of hook is called. */
export const CATEGORY_NAMES: Record<HookCategory | 'All', L> = {
  All: { en: 'All', es: 'Todos', zh: '全部' },
  Document: { en: 'Document', es: 'Documento', zh: '文档' },
  Writing: { en: 'Writing', es: 'Escritura', zh: '写作' },
  Page: { en: 'Page', es: 'Página', zh: '页面' },
  Interface: { en: 'Interface', es: 'Interfaz', zh: '界面' },
};

/** A value on the dark panel, coloured by what it is. */
export interface LiveValue {
  key: string;
  value: string;
  kind: 'string' | 'number' | 'boolean' | 'call' | 'empty' | 'error';
  /** Not something the hook gives: what the demo did with it, shown apart. */
  demo?: boolean;
}

export interface HookDoc {
  name: string;
  /** How it is called, when it takes something; `${name}()` otherwise. */
  sig?: string;
  category: HookCategory;
  short: L;
  description: L;
  returns: { key: string; description: L }[];
  /** The code beside it; without it, what it returns taken apart. */
  code?: string;
  note?: L;
}

export const HOOKS: HookDoc[] = [
  {
    name: 'useDocs',
    category: 'Document',
    short: { en: 'State, commands, actions', es: 'Estado, comandos, acciones', zh: '状态、命令、操作' },
    description: {
      en: 'What every piece of an interface starts from: what to show, what buttons call, and the document as a whole.',
      es: 'De donde parte cada pieza de una interfaz: qué mostrar, qué llaman los botones, y el documento completo.',
      zh: '界面每个部件的起点：要显示什么、按钮调用什么，以及整个文档。',
    },
    returns: [
      {
        key: 'ready',
        description: { en: 'False on the server and until the pages are on the page', es: 'False en el servidor y hasta que las páginas están en la página', zh: '在服务器上以及页面挂载前为 false' },
      },
      {
        key: 'state',
        description: { en: 'What to show, as plain values — neutral until ready', es: 'Qué mostrar, como valores simples; neutros hasta ready', zh: '要显示的内容，以普通值表示；ready 之前为中性值' },
      },
      {
        key: 'commands',
        description: {
          en: 'What buttons call: toggleMark(mark), setRunProps(props)…',
          es: 'Lo que llaman los botones: toggleMark(mark), setRunProps(props)…',
          zh: '按钮调用的命令：toggleMark(mark)、setRunProps(props)…',
        },
      },
      {
        key: 'docs',
        description: {
          en: 'save(), download(), exportDocx(), openFile(), share(), setName()…',
          es: 'save(), download(), exportDocx(), openFile(), share(), setName()…',
          zh: 'save()、download()、exportDocx()、openFile()、share()、setName()…',
        },
      },
      {
        key: 'editor',
        description: { en: 'The Editor itself — exportPdf(), exportMarkdown()…', es: 'El Editor en sí: exportPdf(), exportMarkdown()…', zh: 'Editor 实例本身：exportPdf()、exportMarkdown()…' },
      },
    ],
    note: {
      en: 'Colours are hex without #, sizes are points. Each command gives the keyboard back to the document.',
      es: 'Los colores son hex sin #, los tamaños son puntos. Cada comando le devuelve el teclado al documento.',
      zh: '颜色是不带 # 的十六进制，字号以磅为单位。每个命令执行后都会把键盘焦点交还给文档。',
    },
  },
  {
    name: 'useDocsValue',
    sig: 'useDocsValue(select, fallback)',
    category: 'Document',
    short: { en: 'Read any value', es: 'Leer cualquier valor', zh: '读取任意值' },
    description: {
      en: 'Anything of the document that state does not carry, kept up to date. Your component is drawn again only when what select gives is different.',
      es: 'Cualquier cosa del documento que state no trae, siempre al día. Tu componente se vuelve a dibujar solo cuando lo que da select es distinto.',
      zh: 'state 中没有的任何文档信息，并保持最新。只有 select 返回的值不同时，你的组件才会重新渲染。',
    },
    returns: [{ key: 'value', description: { en: 'Whatever select gives, compared as JSON', es: 'Lo que dé select, comparado como JSON', zh: 'select 返回的任意值，以 JSON 比较' } }],
    code: `const pages = useDocsValue((editor) => editor.pageCount, 1);
const hasToc = useDocsValue((editor) => editor.hasToc, false);
const cell = useDocsValue((editor) => editor.activeCellProps() ?? null, null);`,
    note: {
      en: 'Give back plain data, and null where the editor says undefined. The first fallback given is kept.',
      es: 'Devuelve datos simples, y null donde el editor dice undefined. Se conserva el primer fallback dado.',
      zh: '返回普通数据；编辑器返回 undefined 的地方请返回 null。只保留第一次传入的 fallback。',
    },
  },
  {
    name: 'useDocsCount',
    category: 'Document',
    short: { en: 'Words and characters', es: 'Palabras y caracteres', zh: '字数与字符数' },
    description: {
      en: 'How long the document is, and the selection. The whole is counted again only when the document changes.',
      es: 'Qué tan largo es el documento, y la selección. El total se vuelve a contar solo cuando cambia el documento.',
      zh: '文档和选区的长度。只有文档变化时才会重新统计全文。',
    },
    returns: [
      { key: 'words', description: { en: 'Words in the document', es: 'Palabras del documento', zh: '文档字数' } },
      { key: 'characters', description: { en: 'Characters in the document', es: 'Caracteres del documento', zh: '文档字符数' } },
      { key: 'selected', description: { en: 'The same for the selection, or undefined', es: 'Lo mismo para la selección, o undefined', zh: '选区的相同统计，或 undefined' } },
    ],
  },
  {
    name: 'useDocsFind',
    category: 'Writing',
    short: { en: 'Find and replace', es: 'Buscar y reemplazar', zh: '查找和替换' },
    description: {
      en: 'Everything a find-and-replace bar of your own needs. The keyboard stays in your field while it searches.',
      es: 'Todo lo que necesita una barra propia de buscar y reemplazar. El teclado se queda en tu campo mientras busca.',
      zh: '自定义查找替换栏所需的一切。搜索时键盘焦点保留在你的输入框中。',
    },
    returns: [
      { key: 'query · setQuery(text)', description: { en: 'What is looked for', es: 'Lo que se busca', zh: '搜索内容' } },
      { key: 'options · setOptions(o)', description: { en: '{ matchCase, wholeWord }', es: '{ matchCase, wholeWord }', zh: '{ matchCase, wholeWord }' } },
      {
        key: 'count · index',
        description: { en: 'How many places, and which one is selected, from 1', es: 'Cuántos lugares, y cuál está seleccionado, desde 1', zh: '匹配数量，以及当前选中的是第几个（从 1 开始）' },
      },
      { key: 'next() · previous()', description: { en: 'Go to another', es: 'Ir a otro', zh: '跳到另一个' } },
      {
        key: 'replace(text) · replaceAll(text)',
        description: { en: 'The one selected, or all as one step to undo', es: 'El seleccionado, o todos como un solo paso para deshacer', zh: '替换当前项，或一次替换全部（可一步撤销）' },
      },
      { key: 'close()', description: { en: 'Stops and gives the keyboard back', es: 'Termina y devuelve el teclado', zh: '结束搜索并交还键盘焦点' } },
    ],
    note: {
      en: 'query and options are kept by the component that calls it: call it once, in your find bar, and pass it down. count and index are the document’s. Open the bar from ⌘F with onFindKey on the provider.',
      es: 'query y options los guarda el componente que lo llama: llámalo una vez, en tu barra de búsqueda, y pásalo hacia abajo. count e index son del documento. Abre la barra con ⌘F usando onFindKey en el provider.',
      zh: 'query 和 options 由调用它的组件保存：只在查找栏中调用一次，再向下传递。count 和 index 属于文档。在 provider 上设置 onFindKey，即可用 ⌘F 打开查找栏。',
    },
  },
  {
    name: 'useDocsLink',
    category: 'Writing',
    short: { en: 'Link at the caret', es: 'Enlace en el cursor', zh: '光标处的链接' },
    description: { en: 'The link the caret is in, and making one.', es: 'El enlace donde está el cursor, y crear uno.', zh: '光标所在的链接，以及创建链接。' },
    returns: [
      { key: 'active', description: { en: '{ href, text } of the link at the caret', es: '{ href, text } del enlace en el cursor', zh: '光标处链接的 { href, text }' } },
      { key: 'possible', description: { en: 'Whether there is something to link', es: 'Si hay algo que enlazar', zh: '是否有可以添加链接的内容' } },
      {
        key: 'set(address)',
        description: { en: 'Links the selection; false for what is not an address', es: 'Enlaza la selección; false si no es una dirección', zh: '为选区添加链接；不是有效地址时返回 false' },
      },
      { key: 'remove() · open()', description: { en: 'Unlink it; open it in another tab', es: 'Quitar el enlace; abrirlo en otra pestaña', zh: '移除链接；在新标签页中打开' } },
    ],
  },
  {
    name: 'useDocsNotes',
    category: 'Writing',
    short: { en: 'Comments', es: 'Comentarios', zh: '批注' },
    description: {
      en: 'The notes of the document (Word’s comments), to show them your way.',
      es: 'Las notas del documento (los comentarios de Word), para mostrarlas a tu manera.',
      zh: '文档中的批注（即 Word 的批注），可以按你的方式展示。',
    },
    returns: [
      {
        key: 'notes',
        description: { en: 'Each { id, author, date, text, excerpt, color }', es: 'Cada { id, author, date, text, excerpt, color }', zh: '每条为 { id, author, date, text, excerpt, color }' },
      },
      { key: 'active', description: { en: 'The id of the note the caret is in', es: 'El id de la nota donde está el cursor', zh: '光标所在批注的 id' } },
      { key: 'add(text)', description: { en: 'Puts one on the selection; gives its id', es: 'Pone una en la selección; da su id', zh: '在选区上添加批注；返回其 id' } },
      { key: 'setText(id, text) · setColor(id, color) · remove(id)', description: { en: 'Change one', es: 'Cambiar una', zh: '修改某条批注' } },
      { key: 'select(id)', description: { en: 'Selects its text and brings it into view', es: 'Selecciona su texto y lo trae a la vista', zh: '选中批注对应的文字并滚动到可见位置' } },
    ],
    note: {
      en: 'NOTE_COLORS is exported too. commands.setShowNotes(true) shows notes beside the page.',
      es: 'NOTE_COLORS también se exporta. commands.setShowNotes(true) muestra las notas junto a la página.',
      zh: '同时导出了 NOTE_COLORS。commands.setShowNotes(true) 会在页面旁显示批注。',
    },
  },
  {
    name: 'useDocsVariables',
    category: 'Writing',
    short: { en: 'Template variables', es: 'Variables de plantilla', zh: '模板变量' },
    description: {
      en: 'The variables of a template — {{client}} in the text — with their formats and a preview of each value.',
      es: 'Las variables de una plantilla ({{cliente}} en el texto), con sus formatos y una vista previa de cada valor.',
      zh: '模板中的变量（文本中的 {{客户}}），以及它们的格式和每个值的预览。',
    },
    returns: [
      { key: 'names · active', description: { en: 'Each variable once, and the one at the caret', es: 'Cada variable una vez, y la que está en el cursor', zh: '每个变量各一次，以及光标处的变量' } },
      {
        key: 'insert(name) · select(name)',
        description: { en: 'Put one at the caret; go to where one is', es: 'Poner una en el cursor; ir a donde está una', zh: '在光标处插入变量；跳到变量所在位置' },
      },
      { key: 'fill(values)', description: { en: 'Fill them all, as one step to undo', es: 'Llenarlas todas, como un solo paso para deshacer', zh: '一次填写全部变量（可一步撤销）' } },
      {
        key: 'blocks',
        description: {
          en: 'The {{#name}} … {{/name}} blocks: each with its name and kind',
          es: 'Los bloques {{#nombre}} … {{/nombre}}: cada uno con su nombre y tipo',
          zh: '{{#名称}} … {{/名称}} 区块：每个包含名称和类型',
        },
      },
      {
        key: 'formats · uses',
        description: { en: 'By name: its formats, and how many times it is used', es: 'Por nombre: sus formatos, y cuántas veces se usa', zh: '按名称：格式，以及使用次数' },
      },
      { key: 'setFormat(name, id, on, arg?)', description: { en: 'date, number, currency, upper, bold…', es: 'date, number, currency, upper, bold…', zh: 'date、number、currency、upper、bold…' } },
      { key: 'preview(name, value)', description: { en: '{ text, bad }: how the value would come out', es: '{ text, bad }: cómo quedaría el valor', zh: '{ text, bad }：值最终会写成什么样' } },
    ],
  },
  {
    name: 'useDocsStyles',
    category: 'Writing',
    short: { en: 'Paragraph styles', es: 'Estilos de párrafo', zh: '段落样式' },
    description: {
      en: 'The paragraph styles of the document — Normal, Title, Heading 1… — and the one of the selection.',
      es: 'Los estilos de párrafo del documento (Normal, Título, Título 1…) y el de la selección.',
      zh: '文档的段落样式（正文、标题、标题 1…）以及选区的样式。',
    },
    returns: [
      { key: 'styles', description: { en: 'Each { id, name }, the default first', es: 'Cada { id, name }, el predeterminado primero', zh: '每个为 { id, name }，默认样式排在最前' } },
      { key: 'active', description: { en: 'The style of the selection; undefined when mixed', es: 'El estilo de la selección; undefined si es mixto', zh: '选区的样式；混合时为 undefined' } },
      { key: 'set(id)', description: { en: 'Gives the paragraphs a style', es: 'Les da un estilo a los párrafos', zh: '为段落应用样式' } },
    ],
  },
  {
    name: 'useDocsOutline',
    category: 'Writing',
    short: { en: 'Title and headings', es: 'Título y encabezados', zh: '标题与小标题' },
    description: {
      en: 'The title and the headings of the document, for a panel to move around in.',
      es: 'El título y los encabezados del documento, para un panel con el que moverse.',
      zh: '文档的标题和各级小标题，用于导航面板。',
    },
    returns: [
      {
        key: 'items',
        description: { en: 'Each { para, level, text }; level 0 is the title', es: 'Cada { para, level, text }; el nivel 0 es el título', zh: '每项为 { para, level, text }；level 0 为文档标题' },
      },
      { key: 'active', description: { en: 'Which one the caret is under, or -1', es: 'Bajo cuál está el cursor, o -1', zh: '光标所在的那一项，或 -1' } },
      { key: 'goTo(item)', description: { en: 'Puts the caret there', es: 'Pone el cursor ahí', zh: '把光标移到该处' } },
      { key: 'move(item, before?)', description: { en: 'Moves a heading with everything under it', es: 'Mueve un encabezado con todo lo que tiene debajo', zh: '移动某个标题及其下的全部内容' } },
    ],
    note: {
      en: 'commands.insertToc() and commands.updateToc() handle the table of contents.',
      es: 'commands.insertToc() y commands.updateToc() se encargan de la tabla de contenido.',
      zh: 'commands.insertToc() 和 commands.updateToc() 负责目录。',
    },
  },
  {
    name: 'useDocsPage',
    category: 'Page',
    short: { en: 'Page setup and letterhead', es: 'Configuración de página y membrete', zh: '页面设置与信头' },
    description: {
      en: 'The page: its size and margins, its sections, header and footer, its number, its notes at the end and its letterhead.',
      es: 'La página: su tamaño y márgenes, sus secciones, encabezado y pie, su número, sus notas al final y su membrete.',
      zh: '页面：纸张大小和页边距、分节、页眉页脚、页码、尾注和信头。',
    },
    returns: [
      { key: 'page · set(patch, everywhere?)', description: { en: 'Width, height and margins, in points', es: 'Ancho, alto y márgenes, en puntos', zh: '宽度、高度和页边距，以磅为单位' } },
      { key: 'sections · section', description: { en: 'How many, and which one is being edited', es: 'Cuántas, y cuál se está editando', zh: '分节数量，以及正在编辑的是哪一节' } },
      {
        key: 'ownHeaders · setOwnHeaders(on)',
        description: { en: 'A header and footer for this section alone', es: 'Un encabezado y pie solo para esta sección', zh: '本节独立的页眉和页脚' },
      },
      { key: 'numbering · setNumbering(n)', description: { en: '{ place, align, format }, or undefined', es: '{ place, align, format }, o undefined', zh: '{ place, align, format }，或 undefined' } },
      {
        key: 'firstPageDifferent · setFirstPageDifferent(on)',
        description: { en: 'Another header for the first page', es: 'Otro encabezado para la primera página', zh: '首页使用不同的页眉' },
      },
      {
        key: 'endnotesAt · setEndnotesAt(at)',
        description: { en: "'document' or 'sections': where the endnotes go", es: "'document' o 'sections': dónde van las notas al final", zh: "'document' 或 'sections'：尾注放在哪里" },
      },
      {
        key: 'noteNumbering · setNoteNumbering(kind, n)',
        description: {
          en: 'How the section numbers its footnotes and endnotes: { format, start, restart }, or undefined',
          es: 'Cómo numera la sección sus notas al pie y al final: { format, start, restart }, o undefined',
          zh: '本节脚注和尾注的编号方式：{ format, start, restart }，或 undefined',
        },
      },
      {
        key: 'letterhead · setLetterhead(file, fit?)',
        description: { en: 'Whether there is one; set it from a PNG or JPG', es: 'Si hay uno; ponerlo desde un PNG o JPG', zh: '是否有信头；用 PNG 或 JPG 设置信头' },
      },
      {
        key: 'fitLetterheadMargins() · removeLetterhead() · letterheadFile()',
        description: {
          en: 'Margins that clear it; take it away; the picture it is, to download',
          es: 'Márgenes que lo libran; quitarlo; la imagen que es, para descargarla',
          zh: '调整页边距避开信头；移除信头；获取信头图片以便下载',
        },
      },
    ],
    note: { en: 'Letter is 612 × 792 pt, A4 is 595.3 × 841.9 pt.', es: 'Carta es 612 × 792 pt, A4 es 595.3 × 841.9 pt.', zh: 'Letter 为 612 × 792 磅，A4 为 595.3 × 841.9 磅。' },
  },
  {
    name: 'useDocsSelectionBox',
    category: 'Interface',
    short: { en: 'Where the selection is', es: 'Dónde está la selección', zh: '选区位置' },
    description: {
      en: 'Where the selection is in the window, to put something of your own beside it. It follows scrolling and resizing.',
      es: 'Dónde está la selección en la ventana, para poner algo propio a su lado. Sigue al desplazamiento y al cambio de tamaño.',
      zh: '选区在窗口中的位置，用于在旁边放置你自己的元素。会随滚动和窗口大小变化而更新。',
    },
    returns: [
      {
        key: 'top · left · width · height',
        description: { en: 'In pixels; undefined while there is none', es: 'En píxeles; undefined mientras no haya ninguna', zh: '以像素为单位；没有选区时为 undefined' },
      },
    ],
    code: `const box = useDocsSelectionBox();
if (!box) return null;
// put your popover at box.top - 44, box.left`,
    note: {
      en: 'onMouseDown={(e) => e.preventDefault()} on your bar keeps a press from taking the selection away.',
      es: 'onMouseDown={(e) => e.preventDefault()} en tu barra evita que un clic se lleve la selección.',
      zh: '在你的工具条上设置 onMouseDown={(e) => e.preventDefault()}，可防止点击时丢失选区。',
    },
  },
  {
    name: 'useDocsBubble',
    category: 'Interface',
    short: { en: 'Selection bar', es: 'Barra de selección', zh: '选区工具条' },
    description: {
      en: 'The bar beside the selection that the included interface has. For a document made with <DocsProvider bubble>; undefined without it.',
      es: 'La barra junto a la selección que tiene la interfaz incluida. Para un documento hecho con <DocsProvider bubble>; undefined sin él.',
      zh: '自带界面中选区旁的工具条。适用于使用 <DocsProvider bubble> 创建的文档；否则为 undefined。',
    },
    returns: [
      { key: 'open() · close() · toggle()', description: { en: 'Show it and hide it', es: 'Mostrarla y ocultarla', zh: '显示和隐藏' } },
      { key: 'ask(kind)', description: { en: "'variable', 'note' or 'link'", es: "'variable', 'note' o 'link'", zh: "'variable'、'note' 或 'link'" } },
    ],
    code: `const bubble = useDocsBubble();   // undefined without bubble
bubble?.ask('note');`,
    note: {
      en: 'It comes with a look, and is put in document.body: give it your colours with the --dx-ui-… variables there (see Styling).',
      es: 'Viene con un aspecto propio, y se pone en document.body: dale tus colores con las variables --dx-ui-… ahí (ve Estilos).',
      zh: '它自带外观，并放在 document.body 中：请在那里用 --dx-ui-… 变量设置颜色（参见“样式”）。',
    },
  },
  {
    name: 'useDocsResponsive',
    sig: 'useDocsResponsive(600)',
    category: 'Interface',
    short: { en: 'Phones and narrow windows', es: 'Teléfonos y ventanas angostas', zh: '手机与窄窗口' },
    description: {
      en: 'What a narrow window asks of an interface: below the width given, the pages fit the surface.',
      es: 'Lo que una ventana angosta le pide a una interfaz: por debajo del ancho dado, las páginas se ajustan a la superficie.',
      zh: '窄窗口对界面的要求：宽度小于给定值时，页面会适应 surface 的宽度。',
    },
    returns: [
      {
        key: 'narrow',
        description: { en: 'true while the surface is under the width given', es: 'true mientras la superficie está por debajo del ancho dado', zh: 'surface 宽度小于给定值时为 true' },
      },
      { key: 'keyboard', description: { en: 'Pixels the on-screen keyboard covers', es: 'Píxeles que cubre el teclado de la pantalla', zh: '屏幕键盘遮挡的像素数' } },
    ],
    note: {
      en: 'Decide your layout with a media query, not with narrow: otherwise each change undoes the other.',
      es: 'Decide tu disposición con una media query, no con narrow: si no, cada cambio deshace al otro.',
      zh: '用媒体查询决定布局，而不是用 narrow：否则两者会相互抵消。',
    },
  },
];

/** The code beside a hook: its own, or what it returns taken apart. */
export function codeOf(hook: HookDoc): string {
  if (hook.code) return hook.code;
  const keys = hook.returns.flatMap((r) => r.key.split(' · ').map((key) => key.replace(/\(.*\)/, '')));
  return `const { ${keys.join(', ')} } = ${hook.sig ?? `${hook.name}()`};`;
}

/** Where a hook is on the page: the explorer opens it from this. */
export const hookHash = (name: string) => `hooks-${name}`;
