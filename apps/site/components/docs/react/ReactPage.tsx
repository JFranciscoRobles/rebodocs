import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { Callout, HandTip, SectionHead } from '../ui';
import { InstallCommand } from '../InstallCommand';
import { LazyFeaturesDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

type Change = 'follows' | 'mounts' | 'latest' | 'opens' | 'withDocx';

/** What happens when a prop changes, from the effects of DocsEditor.ts. */
const CHANGE: Record<Change, { label: L; color: 'green' | 'orange' | 'blue' | 'purple' | 'yellow' }> = {
  follows: { label: { en: 'Follows', es: 'Lo sigue', zh: '随之更新' }, color: 'green' },
  latest: { label: { en: 'Last one called', es: 'Se llama la última', zh: '调用最新的' }, color: 'blue' },
  mounts: { label: { en: 'Made again', es: 'Se vuelve a crear', zh: '重新创建' }, color: 'orange' },
  opens: { label: { en: 'Opens it', es: 'Lo abre', zh: '打开新文档' }, color: 'purple' },
  withDocx: { label: { en: 'Read with docx', es: 'Se lee con docx', zh: '随 docx 读取' }, color: 'yellow' },
};

const LANGUAGES_LINK: [L, string] = [{ en: 'Languages', es: 'Idiomas', zh: '语言' }, '/docs/languages/'];

/** Every prop of DocsEditor, from DocsCoreOptions, DocsOptions and DocsEditorProps. */
const PROPS: { name: string; type: string; text: L; change: Change; link?: [L, string] }[] = [
  {
    name: 'docx',
    type: 'Uint8Array | ArrayBuffer',
    text: {
      en: 'The document to open; an empty one without it. Another one opens in its place. Not read with collab, where the room has the document.',
      es: 'El documento que se abre; uno vacío si no se da. Otro se abre en su lugar. No se lee con collab, donde la sala tiene el documento.',
      zh: '要打开的文档；不传则为空白文档。传入另一个时会替换当前文档。使用 collab 时不读取它，因为文档由房间提供。',
    },
    change: 'opens',
  },
  {
    name: 'unsaved',
    type: 'boolean',
    text: {
      en: 'Whether docx has changes not saved yet, as a draft your application kept: dirty from the start, with the dot beside the title.',
      es: 'Si docx tiene cambios aún sin guardar, como un borrador que guardó tu aplicación: con cambios desde el inicio, con el punto junto al título.',
      zh: 'docx 是否包含尚未保存的修改，比如你的应用保存的草稿：一开始就标记为已修改，标题旁显示圆点。',
    },
    change: 'withDocx',
  },
  {
    name: 'name',
    type: 'string',
    text: {
      en: 'What the document is called: shown in the toolbar, given to onSave and to what is exported.',
      es: 'Cómo se llama el documento: se muestra en la barra de herramientas, se le da a onSave y a lo que se exporta.',
      zh: '文档名称：显示在工具栏中，并传给 onSave 和导出的文件。',
    },
    change: 'follows',
  },
  {
    name: 'author',
    type: 'string',
    text: {
      en: 'Who the person is: what their notes and changes are signed with, and what the others see them as. Without it, the name the person gave last time, kept by the browser.',
      es: 'Quién es la persona: con qué se firman sus notas y cambios, y cómo la ven los demás. Sin él, el nombre que la persona dio la última vez, guardado por el navegador.',
      zh: '当前用户是谁：用于给批注和修订署名，也是其他人看到的名字。不传时使用用户上次输入并由浏览器保存的名字。',
    },
    change: 'follows',
  },
  {
    name: 'locale',
    type: 'string',
    text: {
      en: "The language of the interface: 'en', 'es', or one given in locales, such as the Chinese of @rebodocs/editor/locales. Left out, the first of the browser’s languages it speaks, or English. It is the whole page's, not this editor's alone.",
      es: "El idioma de la interfaz: 'en', 'es', o uno dado en locales, como el chino de @rebodocs/editor/locales. Si no se da, el primero de los idiomas del navegador que habla, o inglés. Es de toda la página, no solo de este editor.",
      zh: "界面语言：'en'、'es'，或通过 locales 提供的语言，例如 @rebodocs/editor/locales 中的中文。不传时使用浏览器语言中第一个支持的语言，否则使用英文。它作用于整个页面，而不仅仅是这个编辑器。",
    },
    change: 'follows',
    link: LANGUAGES_LINK,
  },
  {
    name: 'locales',
    type: 'Record<string, Texts>',
    text: {
      en: 'More languages, or other words for these, as { fr: texts }. What one leaves out is said in English.',
      es: 'Más idiomas, u otras palabras para estos, como { fr: texts }. Lo que uno deja fuera se dice en inglés.',
      zh: '更多语言，或替换现有语言的用词，形如 { fr: texts }。缺少的文本以英文显示。',
    },
    change: 'follows',
    link: LANGUAGES_LINK,
  },
  {
    name: 'language',
    type: 'string',
    text: {
      en: "The language the text is in, as a tag ('en-US'): written in the DOCX, used for the variables that are dates and amounts, and the one a screen reader reads the text with. Left out, the one the file says, or else the interface's. The person can choose another at the foot of the editor.",
      es: "El idioma en que está el texto, como etiqueta ('es-MX'): se escribe en el DOCX, se usa para las variables que son fechas e importes, y es con el que un lector de pantalla lee el texto. Si no se da, el que dice el archivo, o si no el de la interfaz. La persona puede elegir otro al pie del editor.",
      zh: "文本所用的语言标签（如 'zh-CN'）：写入 DOCX，用于日期和金额类变量，也是屏幕阅读器朗读文本时使用的语言。不传时使用文件中声明的语言，否则使用界面语言。用户可以在编辑器底部选择其他语言。",
    },
    change: 'follows',
  },
  {
    name: 'spellcheck',
    type: 'SpellChecker',
    text: {
      en: 'What marks the words spelled wrong with a red wave and offers what they could be: createSpellChecker with the dictionaries you give, or one of your own.',
      es: 'Lo que marca las palabras mal escritas con una onda roja y ofrece lo que podrían ser: createSpellChecker con los diccionarios que des, o uno propio.',
      zh: '用红色波浪线标出拼错的单词并给出建议：使用你提供词典的 createSpellChecker，或你自己的实现。',
    },
    change: 'follows',
    link: [{ en: 'Spelling', es: 'Ortografía', zh: '拼写' }, '/docs/languages/#spelling'],
  },
  {
    name: 'theme',
    type: "'light' | 'dark' | 'auto'",
    text: {
      en: "The colours of the interface: light as it comes, dark, or 'auto' for the one the system is set to. The pages stay white, as paper.",
      es: "Los colores de la interfaz: claro como viene, oscuro, o 'auto' para el que tenga el sistema. Las páginas siguen blancas, como el papel.",
      zh: "界面配色：默认浅色、深色，或 'auto' 跟随系统设置。页面始终保持白色，就像纸张。",
    },
    change: 'follows',
    link: [{ en: 'Styling', es: 'Estilos', zh: '样式' }, '/docs/styling/'],
  },
  {
    name: 'fonts',
    type: 'FontSource[]',
    text: {
      en: 'Typefaces of your own, each with its family and its file. For the whole page, and they stay; the same ones in a new array are not loaded again.',
      es: 'Tipografías propias, cada una con su familia y su archivo. Para toda la página, y se quedan; las mismas en un arreglo nuevo no se vuelven a cargar.',
      zh: '你自己的字体，每个包含字体族和文件。作用于整个页面并一直保留；放在新数组中的相同字体不会重复加载。',
    },
    change: 'follows',
    link: [{ en: 'Fonts', es: 'Fuentes', zh: '字体' }, '/docs/fonts/'],
  },
  {
    name: 'embedFonts',
    type: "boolean | 'subset'",
    text: {
      en: "Whether the DOCX carries the fonts of fonts its text is in, when they are TrueType and their licence lets it: whole unless false, or cut down to the characters used with 'subset'.",
      es: "Si el DOCX lleva las fuentes de fonts en que está su texto, cuando son TrueType y su licencia lo permite: completas salvo con false, o recortadas a los caracteres usados con 'subset'.",
      zh: "当 fonts 中的字体为 TrueType 且许可证允许时，DOCX 是否嵌入文本所用的字体：除非设为 false，否则嵌入完整字体；设为 'subset' 则只嵌入用到的字符。",
    },
    change: 'follows',
  },
  {
    name: 'letterhead',
    type: 'Blob | { bytes, type } | string | null',
    text: {
      en: 'A PNG or JPG to use as letterhead, whatever the document came with; null for none. Given, the menu no longer offers to change it.',
      es: 'Un PNG o JPG para usar como membrete, traiga lo que traiga el documento; null para ninguno. Si se da, el menú ya no ofrece cambiarlo.',
      zh: '用作信头的 PNG 或 JPG，无论文档原来带的是什么；null 表示不使用。传入后，菜单不再提供更换信头的选项。',
    },
    change: 'follows',
    link: [{ en: 'Letterheads', es: 'Membretes', zh: '信头' }, '/docs/letterhead/'],
  },
  {
    name: 'versions',
    type: '{ list, load, save? }',
    text: {
      en: 'Where your application keeps the versions. The side panel then lists them, compares the document with one and goes back to it; with save, it keeps one.',
      es: 'Dónde guarda tu aplicación las versiones. El panel lateral entonces las lista, compara el documento con una y regresa a ella; con save, guarda una.',
      zh: '你的应用保存版本的位置。侧边栏会列出版本、把文档与某个版本对比并还原；提供 save 时还可以保存新版本。',
    },
    change: 'mounts',
    link: [{ en: 'Versions', es: 'Versiones', zh: '版本' }, '/docs/versions/'],
  },
  {
    name: 'collab',
    type: '{ url, room, ticket? }',
    text: {
      en: 'The document is a room on your collaboration server, and comes from there.',
      es: 'El documento es una sala en tu servidor de colaboración, y viene de ahí.',
      zh: '文档是你协作服务器上的一个房间，并从那里获取。',
    },
    change: 'opens',
    link: [{ en: 'Collaboration', es: 'Colaboración', zh: '协作' }, '/docs/collaboration/'],
  },
  { name: 'features', type: 'DocsFeatures', text: { en: 'What is switched on. See below.', es: 'Qué está encendido. Ve abajo.', zh: '开启哪些功能。见下文。' }, change: 'mounts' },
  {
    name: 'onSave',
    type: '(docx, name) => void | Promise',
    text: {
      en: 'Given the document when the person saves, from the menu or with ⌘S (Ctrl+S), or when you call save(). Keeping it is yours to do; a promise that fails is told to onError.',
      es: 'Recibe el documento cuando la persona guarda, desde el menú o con ⌘S (Ctrl+S), o cuando llamas save(). Guardarlo te toca a ti; una promesa que falla se le avisa a onError.',
      zh: '当用户通过菜单或 ⌘S（Ctrl+S）保存，或你调用 save() 时，接收文档。由你负责保存；失败的 promise 会通知 onError。',
    },
    change: 'latest',
  },
  { name: 'onChange', type: '(editor) => void', text: { en: 'Called when the document changes.', es: 'Se llama cuando cambia el documento.', zh: '文档变化时调用。' }, change: 'latest' },
  {
    name: 'onCollab',
    type: '(state, peers) => void',
    text: { en: 'Called when the connection, or who is on the document, changes.', es: 'Se llama cuando cambia la conexión, o quién está en el documento.', zh: '连接状态或文档中的人员变化时调用。' },
    change: 'latest',
  },
  {
    name: 'onError',
    type: '(message) => void',
    text: {
      en: 'Told what went wrong, in the language of the interface. Without it, an alert.',
      es: 'Recibe qué salió mal, en el idioma de la interfaz. Sin él, una alerta.',
      zh: '以界面语言接收错误信息。不传时弹出 alert。',
    },
    change: 'latest',
  },
  {
    name: 'onReady',
    type: '(handle | undefined) => void',
    text: {
      en: 'Given the handle once the editor is there, and undefined when it goes: on every mount.',
      es: 'Recibe el handle cuando el editor está listo, y undefined cuando se va: en cada montaje.',
      zh: '编辑器就绪时接收句柄，编辑器移除时接收 undefined：每次挂载都会调用。',
    },
    change: 'latest',
  },
  {
    name: 'ref',
    type: 'Ref<DocsHandle | undefined>',
    text: {
      en: 'The same handle, kept in a ref: given on every mount, and undefined when the editor goes.',
      es: 'El mismo handle, guardado en un ref: se da en cada montaje, y undefined cuando el editor se va.',
      zh: '同一个句柄，保存在 ref 中：每次挂载时赋值，编辑器移除时为 undefined。',
    },
    change: 'follows',
  },
  {
    name: 'className · style',
    type: 'string · CSSProperties',
    text: {
      en: 'For the element the editor is in. Its height is 100% of what it is in.',
      es: 'Para el elemento en que está el editor. Su altura es el 100% de lo que lo contiene.',
      zh: '作用于编辑器所在的元素。它的高度为容器高度的 100%。',
    },
    change: 'follows',
  },
];

/** Every feature, from DocsFeatures in mount.ts. */
const FEATURES: { name: string; on: boolean; text: L }[] = [
  {
    name: 'menu',
    on: true,
    text: {
      en: "The document menu: the file, export, the page, the letterhead. A screen of its own over the editor, or 'card' for a card that drops from its button.",
      es: "El menú del documento: el archivo, exportar, la página, el membrete. Una pantalla propia sobre el editor, o 'card' para una tarjeta que cae desde su botón.",
      zh: "文档菜单：文件、导出、页面、信头。默认是覆盖在编辑器上的独立界面，设为 'card' 则是从按钮下拉的卡片。",
    },
  },
  {
    name: 'panel',
    on: true,
    text: {
      en: "The side panel: outline, variables, notes, tracked changes, and versions when given. On the right of the pages; 'left', or 'rail' for a rail of icons always there, with counts.",
      es: "El panel lateral: esquema, variables, notas, control de cambios, y versiones cuando se dan. A la derecha de las páginas; 'left', o 'rail' para un riel de iconos siempre visible, con contadores.",
      zh: "侧边栏：大纲、变量、批注、修订，以及提供版本时的版本。默认位于页面右侧；可设为 'left'，或设为 'rail' 显示常驻的图标栏和计数。",
    },
  },
  {
    name: 'panelOpen',
    on: false,
    text: {
      en: "The side panel open from the start, on a window wide enough for it to go beside the pages: true, or the tab to open it on ('variables', 'history'…). On a phone it starts closed, as it would cover the pages.",
      es: "El panel lateral abierto desde el inicio, en una ventana lo bastante ancha para ponerlo junto a las páginas: true, o la pestaña en que se abre ('variables', 'history'…). En un teléfono empieza cerrado, porque taparía las páginas.",
      zh: "当窗口宽度足以把侧边栏放在页面旁时，一开始就打开侧边栏：true，或指定打开的标签页（'variables'、'history'…）。在手机上默认关闭，因为它会遮住页面。",
    },
  },
  { name: 'ruler', on: true, text: { en: 'The ruler, with margins, indents and tab stops.', es: 'La regla, con márgenes, sangrías y tabulaciones.', zh: '标尺，包含页边距、缩进和制表位。' } },
  {
    name: 'statusBar',
    on: true,
    text: {
      en: "Pages, words, the language of the text, the view, the zoom, and who is on the document, as pills floating over the pages; 'chips' or 'bar' to set them under them.",
      es: "Páginas, palabras, el idioma del texto, la vista, el zoom, y quién está en el documento, como píldoras flotando sobre las páginas; 'chips' o 'bar' para ponerlas debajo.",
      zh: "页数、字数、文本语言、视图、缩放比例以及文档中的人员，以浮在页面上的胶囊形式显示；设为 'chips' 或 'bar' 则放在页面下方。",
    },
  },
  {
    name: 'toolbar',
    on: true,
    text: {
      en: "The document above and the formatting under it; 'tabs' for tabs of tools (Format, Insert, Page), or 'row' for one row.",
      es: "El documento arriba y el formato debajo; 'tabs' para pestañas de herramientas (Formato, Insertar, Página), o 'row' para una sola fila.",
      zh: "上方是文档操作，下方是格式设置；设为 'tabs' 则以标签页组织工具（格式、插入、页面），设为 'row' 则只有一行。",
    },
  },
  {
    name: 'find',
    on: true,
    text: { en: 'Find and replace, from the toolbar or ⌘F (Ctrl+F).', es: 'Buscar y reemplazar, desde la barra de herramientas o con ⌘F (Ctrl+F).', zh: '查找和替换，通过工具栏或 ⌘F（Ctrl+F）打开。' },
  },
  {
    name: 'slash',
    on: true,
    text: {
      en: 'The menu a "/" brings up, typed at the start of a paragraph or after a space: headings, lists, a table, a picture, a page break, a variable, the signatures. Or { builtIns, commands }: which of those it keeps (false for none), and your own. See Headless, The “/” menu.',
      es: 'El menú que abre una "/", escrita al inicio de un párrafo o después de un espacio: títulos, listas, una tabla, una imagen, un salto de página, una variable, las firmas. O { builtIns, commands }: cuáles de esos conserva (false para ninguno), y los tuyos. Ve Headless, El menú “/”.',
      zh: '在段落开头或空格后输入 "/" 弹出的菜单：标题、列表、表格、图片、分页符、变量、签名。也可以传 { builtIns, commands }：保留哪些内置命令（false 表示都不保留），以及你自己的命令。参见 Headless 中的“/”菜单。',
    },
  },
  {
    name: 'variableSuggestions',
    on: true,
    text: {
      en: 'The list "{{" brings up: the variables you fill, then those of the document. Or { variables, fromDocument, allowNew }. See Templates, In the editor.',
      es: 'La lista que abre "{{": las variables que llenas, luego las del documento. O { variables, fromDocument, allowNew }. Ve Plantillas, En el editor.',
      zh: '输入 "{{" 弹出的列表：先是你会填写的变量，然后是文档中已有的变量。也可以传 { variables, fromDocument, allowNew }。参见模板一页的“在编辑器中”。',
    },
  },
  {
    name: 'forms',
    on: false,
    text: {
      en: 'Marking areas that can be changed and restricting editing to them, from the Review menu, the bar and the “/” menu. A restricted document is restricted without it. See Templates, Areas to fill in.',
      es: 'Marcar áreas que se pueden cambiar y restringir la edición a ellas, desde el menú Revisar, la barra y el menú “/”. Un documento restringido lo está aun sin esto. Ve Plantillas, Áreas para llenar.',
      zh: '通过“审阅”菜单、工具条和“/”菜单标记可修改的区域，并把编辑限制在这些区域内。已受限的文档即使不开启此项也保持受限。参见模板一页的“待填区域”。',
    },
  },
  {
    name: 'focus',
    on: true,
    text: {
      en: 'The pages alone, full screen, from the status bar or ⌘⇧. (Ctrl+Shift+.). Escape leaves.',
      es: 'Solo las páginas, a pantalla completa, desde la barra de estado o ⌘⇧. (Ctrl+Shift+.). Escape sale.',
      zh: '只显示页面并全屏，通过状态栏或 ⌘⇧.（Ctrl+Shift+.）进入。按 Esc 退出。',
    },
  },
  {
    name: 'title',
    on: true,
    text: {
      en: 'The name of the document in the toolbar; with onSave or files, a dot beside it while there are changes not saved.',
      es: 'El nombre del documento en la barra de herramientas; con onSave o files, un punto a su lado mientras haya cambios sin guardar.',
      zh: '工具栏中的文档名称；提供 onSave 或开启 files 时，有未保存修改的情况下名称旁显示圆点。',
    },
  },
  {
    name: 'responsive',
    on: true,
    text: {
      en: 'Making do with a narrow window and the keyboard of a phone. See Phones and touch.',
      es: 'Arreglárselas con una ventana angosta y el teclado de un teléfono. Ve Teléfonos y pantallas táctiles.',
      zh: '适配窄窗口和手机键盘。参见“手机与触屏”。',
    },
  },
  {
    name: 'files',
    on: false,
    text: {
      en: 'Open a file from the disk in place of the document (⌘O), and save a copy to it; ⌘S downloads it when there is no onSave.',
      es: 'Abrir un archivo del disco en lugar del documento (⌘O), y guardar una copia en él; ⌘S lo descarga cuando no hay onSave.',
      zh: '从磁盘打开文件替换当前文档（⌘O），并把副本保存到磁盘；没有 onSave 时，⌘S 会下载文件。',
    },
  },
  { name: 'language', on: false, text: { en: 'The choice of the interface language, in the menu.', es: 'La elección del idioma de la interfaz, en el menú.', zh: '在菜单中选择界面语言。' } },
  {
    name: 'theme',
    on: false,
    text: {
      en: 'The choice of light, dark or as the system is, in the menu; the theme prop says the one to start with.',
      es: 'La elección de claro, oscuro o como el sistema, en el menú; la prop theme dice con cuál empezar.',
      zh: '在菜单中选择浅色、深色或跟随系统；theme 属性决定初始配色。',
    },
  },
  {
    name: 'assistant',
    on: false,
    text: {
      en: 'The button in the status bar that lets an AI assistant in: true for the MCP server on this machine, or { url, token }.',
      es: 'El botón de la barra de estado que deja entrar a un asistente de IA: true para el servidor MCP de esta máquina, o { url, token }.',
      zh: '状态栏中允许 AI 助手接入的按钮：true 表示连接本机的 MCP 服务器，或传 { url, token }。',
    },
  },
  {
    name: 'share',
    on: false,
    text: {
      en: 'The button that starts sharing from here: { url, token?, link? }. Not for a document that is already a room.',
      es: 'El botón que empieza a compartir desde aquí: { url, token?, link? }. No para un documento que ya es una sala.',
      zh: '从这里开始共享的按钮：{ url, token?, link? }。不适用于已经是房间的文档。',
    },
  },
];

/** Every member of DocsHandle a component's handle is for (destroy is the component's). */
const HANDLE: { name: string; text: L }[] = [
  { name: 'exportDocx()', text: { en: 'The document as a DOCX, as it is now.', es: 'El documento como DOCX, tal como está ahora.', zh: '以 DOCX 形式返回当前文档。' } },
  {
    name: 'save()',
    text: {
      en: 'Gives the document to onSave, as ⌘S does, and once it is kept, dirty is false. What an application that saves on its own calls, a moment after each change.',
      es: 'Le da el documento a onSave, como ⌘S, y una vez guardado, dirty es false. Lo que llama una aplicación que guarda sola, un momento después de cada cambio.',
      zh: '像 ⌘S 一样把文档交给 onSave，保存完成后 dirty 变为 false。自动保存的应用会在每次修改片刻后调用它。',
    },
  },
  { name: 'dirty', text: { en: 'Whether it changed since it was opened or last saved.', es: 'Si cambió desde que se abrió o se guardó por última vez.', zh: '自打开或上次保存以来是否有修改。' } },
  {
    name: 'name',
    text: {
      en: 'What the document is called now: the name given, or the one of a file the person opened.',
      es: 'Cómo se llama ahora el documento: el nombre dado, o el de un archivo que abrió la persona.',
      zh: '文档当前的名称：传入的名称，或用户打开的文件的名称。',
    },
  },
  {
    name: 'showPanel(tab?)',
    text: {
      en: "Opens the side panel on a tab ('outline', 'variables', 'notes', 'changes', or 'history' with versions), or on the one it was on. false when the panel is turned off.",
      es: "Abre el panel lateral en una pestaña ('outline', 'variables', 'notes', 'changes', o 'history' con versiones), o en la que estaba. false cuando el panel está apagado.",
      zh: "在指定标签页打开侧边栏（'outline'、'variables'、'notes'、'changes'，提供版本时还有 'history'），或打开上次所在的标签页。侧边栏被关闭时返回 false。",
    },
  },
  { name: 'hidePanel()', text: { en: 'Closes it.', es: 'Lo cierra.', zh: '关闭侧边栏。' } },
  { name: 'focus()', text: { en: 'Gives the keyboard to the document.', es: 'Le da el teclado al documento.', zh: '把键盘焦点交给文档。' } },
  {
    name: 'setName · setAuthor · setLocale · setTheme · setLetterhead',
    text: {
      en: 'Change what the props set, for whoever keeps them outside React.',
      es: 'Cambian lo que fijan las props, para quien las guarda fuera de React.',
      zh: '修改属性所设置的值，供在 React 之外保存这些值的场景使用。',
    },
  },
  { name: 'editor', text: { en: 'The Editor itself, for everything else.', es: 'El Editor en sí, para todo lo demás.', zh: 'Editor 实例本身，用于其他一切操作。' } },
  { name: 'collab', text: { en: 'The session with the others, while there is one.', es: 'La sesión con los demás, mientras la haya.', zh: '与其他人的协作会话（如果存在）。' } },
];

/**
 * "React component": DocsEditor running, its features switched on and off and
 * its handle used through a ref; installing it; every prop and what happens
 * when it changes; the features; the handle; saving; and without React.
 */
export async function ReactPage() {
  const t = getT();
  const [first, handle, features, whole] = await Promise.all([
    highlight(
      `'use client';
import { DocsEditor } from '@rebodocs/react';

export function Contract({ file }: { file: Uint8Array }) {
  return (
    <div className="h-screen">
      <DocsEditor
        docx={file}
        name="contract.docx"
        author="Ana"
        locale="en"
        onSave={(docx, name) => upload(docx, name)}
      />
    </div>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `const docs = useRef<DocsHandle>(undefined);

<DocsEditor ref={docs} docx={file} />
<button onClick={() => upload(docs.current!.exportDocx())}>Send</button>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(`<DocsEditor docx={file} features={{ ruler: false, files: true }} />`, 'tsx', LIGHT_THEME),
    highlight(
      `import { mountDocs } from '@rebodocs/react/mount';

const docs = mountDocs(document.querySelector('#editor')!, { docx: bytes, locale: 'en' });
docs.destroy();`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  const chip = (change: Change) => (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[CHANGE[change].color]}`}>{t(CHANGE[change].label)}</span>
  );
  const strong = 'font-semibold text-ink';

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {t({ en: 'React component', es: 'Componente de React', zh: 'React 组件' })}
      </h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        <code className={mono}>DocsEditor</code>{' '}
        {t({
          en: 'is the whole editor in one component: toolbar, ruler, side panel, pages and status bar. It mounts in your page, not in an iframe.',
          es: 'es el editor completo en un componente: barra de herramientas, regla, panel lateral, páginas y barra de estado. Se monta en tu página, no en un iframe.',
          zh: '就是一个组件形式的完整编辑器：工具栏、标尺、侧边栏、页面和状态栏。它直接挂载在你的页面中，而不是 iframe 里。',
        })}
      </p>
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: switch the features, then call the handle', es: 'tip: cambia las funciones, luego llama al handle', zh: '提示：切换功能，然后调用句柄' })}</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'Switch it on and off', es: 'Enciéndelo y apágalo', zh: '开关功能' })}>
          {t({
            en: (
              <>
                A real <code className={mono}>DocsEditor</code> with the agreement of the demo. The features are read when it is made, so each switch makes it again, with the document as it is: type
                something, then switch one. The buttons above it use the handle, through a <code className={mono}>ref</code>.
              </>
            ),
            es: (
              <>
                Un <code className={mono}>DocsEditor</code> real con el contrato de la demo. Las funciones se leen al crearlo, así que cada interruptor lo vuelve a crear, con el documento tal como
                está: escribe algo, luego cambia uno. Los botones de arriba usan el handle, a través de un <code className={mono}>ref</code>.
              </>
            ),
            zh: (
              <>
                一个加载了演示协议的真实 <code className={mono}>DocsEditor</code>。功能在创建时读取，所以每次切换都会用当前文档重新创建编辑器：先输入点内容，再切换某个功能试试。上方的按钮通过{' '}
                <code className={mono}>ref</code> 使用句柄。
              </>
            ),
          })}
        </SectionHead>
        <LazyFeaturesDemo />
      </section>

      <section aria-labelledby="start" className="mt-24">
        <SectionHead id="start" badge={t({ en: 'Start', es: 'Inicio', zh: '开始' })} color="blue" title={t({ en: 'Put it in a page', es: 'Ponlo en una página', zh: '放进页面' })}>
          {t({ en: 'The package is ', es: 'El paquete es ', zh: '软件包为 ' })}
          <a href="https://www.npmjs.com/package/@rebodocs/react" className={LINK}>
            @rebodocs/react
          </a>
          {t({ en: '. Everything it exports is in ', es: '. Todo lo que exporta está en ', zh: '。它导出的全部内容见' })}
          <LocalLink href="/docs/components/" className={LINK}>
            {t({ en: 'Components and hooks', es: 'Componentes y hooks', zh: '组件与 Hooks' })}
          </LocalLink>
          {t({ en: '.', es: '.', zh: '。' })}
        </SectionHead>
        <div className="mt-6 max-w-[760px]">
          <InstallCommand command="npm install @rebodocs/react" />
        </div>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: first }} />
        <ul className="m-0 mt-5 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>
            {t({
              en: 'The element around it must have a height: the editor fills what it is given.',
              es: 'El elemento que lo rodea debe tener una altura: el editor llena lo que se le da.',
              zh: '包裹它的元素必须有高度：编辑器会填满给定的空间。',
            })}
          </li>
          <li>
            {t({
              en: (
                <>
                  It is safe to render on a server. There it draws an empty element, and mounts once the page is in the browser; the bundle starts with{' '}
                  <code className={mono}>&apos;use client&apos;</code>.
                </>
              ),
              es: (
                <>
                  Se puede renderizar en un servidor. Ahí dibuja un elemento vacío, y se monta una vez que la página está en el navegador; el bundle empieza con{' '}
                  <code className={mono}>&apos;use client&apos;</code>.
                </>
              ),
              zh: (
                <>
                  可以安全地在服务器端渲染。在服务器上它只输出一个空元素，页面到达浏览器后才挂载；打包文件以 <code className={mono}>&apos;use client&apos;</code> 开头。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: (
                <>
                  Without <code className={mono}>locale</code>, the interface is in the first of the browser’s languages it speaks, or in English.
                </>
              ),
              es: (
                <>
                  Sin <code className={mono}>locale</code>, la interfaz está en el primero de los idiomas del navegador que habla, o en inglés.
                </>
              ),
              zh: (
                <>
                  不指定 <code className={mono}>locale</code> 时，界面使用浏览器语言中第一个支持的语言，否则使用英文。
                </>
              ),
            })}
          </li>
        </ul>
      </section>

      <section aria-labelledby="props" className="mt-24">
        <SectionHead id="props" badge="Props" color="purple" title={t({ en: 'Props', es: 'Props', zh: '属性' })}>
          {t({
            en: (
              <>
                Each with what happens when it changes. <strong className={strong}>Follows</strong>: the editor takes the new one as it is. <strong className={strong}>Last one called</strong>: a new
                function in each render is fine. <strong className={strong}>Made again</strong>: the editor is made again with the document as it is, unsaved changes and all, but without what there
                was to undo. <strong className={strong}>Opens it</strong>: another document, or another room, takes the place of this one.
              </>
            ),
            es: (
              <>
                Cada una con lo que pasa cuando cambia. <strong className={strong}>Lo sigue</strong>: el editor toma la nueva tal como está. <strong className={strong}>Se llama la última</strong>: una
                función nueva en cada render está bien. <strong className={strong}>Se vuelve a crear</strong>: el editor se crea de nuevo con el documento tal como está, cambios sin guardar incluidos,
                pero sin lo que había para deshacer. <strong className={strong}>Lo abre</strong>: otro documento, u otra sala, toma el lugar de este.
              </>
            ),
            zh: (
              <>
                每个属性都标明了变化时会发生什么。<strong className={strong}>随之更新</strong>：编辑器直接采用新值。<strong className={strong}>调用最新的</strong>：每次渲染传入新函数也没问题。
                <strong className={strong}>重新创建</strong>：用当前文档（包括未保存的修改）重新创建编辑器，但撤销记录会丢失。<strong className={strong}>打开新文档</strong>
                ：另一份文档或另一个房间取代当前文档。
              </>
            ),
          })}
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {PROPS.map((prop) => (
            <div key={prop.name} className="grid gap-x-6 gap-y-1.5 border-t border-[#f0eee9] py-3.5 first:border-t-0 md:grid-cols-[240px_1fr]">
              <dt className="min-w-0">
                <span className="block font-code text-[13.5px] font-semibold text-ink">{prop.name}</span>
                <span className="block font-code text-[12px] text-muted [overflow-wrap:anywhere]">{prop.type}</span>
              </dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">
                {chip(prop.change)} {t(prop.text)}
                {prop.link && (
                  <>
                    {' '}
                    {t({ en: 'See ', es: 'Ve ', zh: '参见' })}
                    <LocalLink href={prop.link[1]} className={LINK}>
                      {t(prop.link[0])}
                    </LocalLink>
                    {t({ en: '.', es: '.', zh: '。' })}
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          {t({
            en: (
              <>
                With <code className={mono}>onSave</code> and <code className={mono}>versions</code>, the functions are always the last given; only giving one where there was none, or taking it away,
                makes the editor again.
              </>
            ),
            es: (
              <>
                Con <code className={mono}>onSave</code> y <code className={mono}>versions</code>, las funciones siempre son las últimas dadas; solo dar una donde no había, o quitarla, vuelve a crear
                el editor.
              </>
            ),
            zh: (
              <>
                对于 <code className={mono}>onSave</code> 和 <code className={mono}>versions</code>，使用的总是最后传入的函数；只有从无到有或从有到无时，才会重新创建编辑器。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="features" className="mt-24">
        <SectionHead id="features" badge={t({ en: 'Features', es: 'Funciones', zh: '功能' })} color="yellow" title={t({ en: 'Features', es: 'Funciones', zh: '功能' })}>
          {t({
            en: 'What an application of its own may not want is off until asked for. What every document needs is on until switched off.',
            es: 'Lo que una aplicación propia podría no querer está apagado hasta que se pide. Lo que todo documento necesita está encendido hasta que se apaga.',
            zh: '应用可能不需要的功能默认关闭，需要时再开启；每份文档都需要的功能默认开启，可以手动关闭。',
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: features }} />
        <dl className="m-0 mt-5 max-w-[920px] rounded-2xl border border-border px-5">
          {FEATURES.map((feature) => (
            <div key={feature.name} className="grid items-baseline gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[130px_60px_1fr]">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{feature.name}</dt>
              <dd className={`m-0 font-code text-[12.5px] font-semibold ${feature.on ? 'text-[#2f7a4a]' : 'text-muted'}`}>
                {feature.on ? t({ en: 'on', es: 'sí', zh: '开' }) : t({ en: 'off', es: 'no', zh: '关' })}
              </dd>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(feature.text)}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          {t({
            en: 'The bar beside the selection is always there. To lay the pieces out yourself, see ',
            es: 'La barra junto a la selección siempre está. Para acomodar las piezas tú mismo, ve ',
            zh: '选区旁的工具条始终存在。如果要自己布置各个部件，参见',
          })}
          <LocalLink href="/docs/vanilla/" className={LINK}>
            {t({ en: 'Without a framework', es: 'Sin framework', zh: '不用框架' })}
          </LocalLink>
          {t({ en: ' or ', es: ' o ', zh: '或' })}
          <LocalLink href="/docs/headless/" className={LINK}>
            Headless
          </LocalLink>
          {t({ en: '.', es: '.', zh: '。' })}
        </p>
      </section>

      <section aria-labelledby="the-handle" className="mt-24">
        <SectionHead id="the-handle" badge="Handle" color="pink" title={t({ en: 'The handle', es: 'El handle', zh: '句柄' })}>
          {t({
            en: (
              <>
                <code className={mono}>ref</code> and <code className={mono}>onReady</code> give the same object, to reach the editor from outside.
              </>
            ),
            es: (
              <>
                <code className={mono}>ref</code> y <code className={mono}>onReady</code> dan el mismo objeto, para llegar al editor desde fuera.
              </>
            ),
            zh: (
              <>
                <code className={mono}>ref</code> 和 <code className={mono}>onReady</code> 提供同一个对象，用于从外部访问编辑器。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: handle }} />
        <dl className="m-0 mt-5 max-w-[920px] rounded-2xl border border-border px-5">
          {HANDLE.map((member) => (
            <div key={member.name} className="grid gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))' }}>
              <dt className="font-code text-[13.5px] font-semibold text-ink [overflow-wrap:anywhere]">{member.name}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(member.text)}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          {t({
            en: 'A new handle comes with each mount, and the old one is of an editor that is gone: keep the one the ref has now, not one kept from before. For the methods of the editor, see ',
            es: 'Con cada montaje llega un handle nuevo, y el viejo es de un editor que ya no está: usa el que tiene el ref ahora, no uno guardado de antes. Para los métodos del editor, ve ',
            zh: '每次挂载都会产生一个新句柄，旧句柄属于已经移除的编辑器：请使用 ref 当前持有的句柄，而不是之前保存的。编辑器的方法请见',
          })}
          <LocalLink href="/docs/editor-api/" className={LINK}>
            {t({ en: 'Editor API', es: 'API del Editor', zh: 'Editor API' })}
          </LocalLink>
          {t({ en: '.', es: '.', zh: '。' })}
        </p>
      </section>

      <section aria-labelledby="saving" className="mt-24">
        <SectionHead id="saving" badge={t({ en: 'Saving', es: 'Guardar', zh: '保存' })} color="orange" title={t({ en: 'Saving', es: 'Guardar', zh: '保存' })}>
          {t({ en: 'Two ways, and they can be combined.', es: 'Dos formas, y se pueden combinar.', zh: '两种方式，可以组合使用。' })}
        </SectionHead>
        <div className="mt-6 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))' }}>
          {[
            {
              title: t({ en: 'The person saves', es: 'La persona guarda', zh: '由用户保存' }),
              text: t({
                en: 'Pass onSave. The menu shows Save, ⌘S works, and the dot beside the title says there are changes not saved.',
                es: 'Pasa onSave. El menú muestra Guardar, ⌘S funciona, y el punto junto al título dice que hay cambios sin guardar.',
                zh: '传入 onSave。菜单中会显示“保存”，⌘S 生效，标题旁的圆点表示有未保存的修改。',
              }),
              color: 'blue' as const,
            },
            {
              title: t({ en: 'You save', es: 'Tú guardas', zh: '由你保存' }),
              text: t({
                en: 'Call exportDocx() whenever you like: on a timer, on leaving the page, from your own button. Or save(), to go through onSave and clear dirty.',
                es: 'Llama exportDocx() cuando quieras: con un temporizador, al salir de la página, desde tu propio botón. O save(), para pasar por onSave y limpiar dirty.',
                zh: '随时调用 exportDocx()：定时、离开页面时或通过你自己的按钮。也可以调用 save()，经由 onSave 保存并清除 dirty。',
              }),
              color: 'green' as const,
            },
            {
              title: t({ en: 'The room saves', es: 'La sala guarda', zh: '由房间保存' }),
              text: t({
                en: 'With collab, the collaboration server keeps the document through your backend, and neither is needed.',
                es: 'Con collab, el servidor de colaboración guarda el documento a través de tu backend, y no hace falta ninguno de los dos.',
                zh: '使用 collab 时，协作服务器通过你的后端保存文档，以上两种方式都不需要。',
              }),
              color: 'purple' as const,
            },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 max-w-[760px]">
          <Callout title={t({ en: 'Saving on its own', es: 'Guardar solo', zh: '自动保存' })}>
            {t({
              en: (
                <>
                  Call <code className={mono}>save()</code> a moment after the last change, from <code className={mono}>onChange</code>, and on leaving the page when{' '}
                  <code className={mono}>dirty</code> is true. The person never has to think of it, and nothing is sent while nothing changed.
                </>
              ),
              es: (
                <>
                  Llama <code className={mono}>save()</code> un momento después del último cambio, desde <code className={mono}>onChange</code>, y al salir de la página cuando{' '}
                  <code className={mono}>dirty</code> es true. La persona nunca tiene que pensar en ello, y no se manda nada mientras nada cambie.
                </>
              ),
              zh: (
                <>
                  在 <code className={mono}>onChange</code> 中于最后一次修改片刻后调用 <code className={mono}>save()</code>，并在离开页面且 <code className={mono}>dirty</code> 为 true
                  时也调用一次。用户完全不用操心，没有修改时也不会发送任何东西。
                </>
              ),
            })}
          </Callout>
        </div>
      </section>

      <section aria-labelledby="without-react" className="mt-24">
        <SectionHead id="without-react" badge={t({ en: 'No React', es: 'Sin React', zh: '不用 React' })} color="green" title={t({ en: 'Without React', es: 'Sin React', zh: '不用 React' })}>
          {t({
            en: (
              <>
                The same editor mounts in any element, with the same options, and gives the same handle, with <code className={mono}>destroy()</code>.
              </>
            ),
            es: (
              <>
                El mismo editor se monta en cualquier elemento, con las mismas opciones, y da el mismo handle, con <code className={mono}>destroy()</code>.
              </>
            ),
            zh: (
              <>
                同一个编辑器可以挂载到任意元素上，选项相同，提供的句柄也相同，另外多了 <code className={mono}>destroy()</code>。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: whole }} />
        <p className={prose}>
          {t({
            en: (
              <>
                It is the <code className={mono}>/mount</code> entry of the package, which holds no React; React is an optional peer, so npm does not install it for this. See{' '}
              </>
            ),
            es: (
              <>
                Es la entrada <code className={mono}>/mount</code> del paquete, que no contiene React; React es un peer opcional, así que npm no lo instala para esto. Ve{' '}
              </>
            ),
            zh: (
              <>
                这是软件包的 <code className={mono}>/mount</code> 入口，其中不包含 React；React 是可选的 peer 依赖，因此 npm 不会为此安装它。参见
              </>
            ),
          })}
          <LocalLink href="/docs/vanilla/" className={LINK}>
            {t({ en: 'Without a framework', es: 'Sin framework', zh: '不用框架' })}
          </LocalLink>
          {t({ en: '.', es: '.', zh: '。' })}
        </p>
      </section>
    </>
  );
}
