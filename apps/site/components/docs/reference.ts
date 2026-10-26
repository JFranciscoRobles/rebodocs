// What the page "Components and hooks" says about the components: plain data,
// read by the page on the server (to colour the code), by its parts in the
// browser, and by the search box. Each text in each language of the site.

import type { L } from '@/lib/i18n';

/** Who puts a part of the editor on the screen. */
export type Owner = 'rebodocs' | 'yours' | 'hidden';
export type Part = 'toolbar' | 'ruler' | 'pages' | 'panel' | 'status';

export interface Entry {
  want: L;
  use: string;
  /** Each part: who puts it, and, for Rebodocs, with what. */
  parts: Record<Part, [Owner, string?]>;
  code: string;
}

const all = (label: string): Entry['parts'] => ({
  toolbar: ['rebodocs', label],
  ruler: ['rebodocs', label],
  pages: ['rebodocs', label],
  panel: ['rebodocs', label],
  status: ['rebodocs', label],
});

/** "Which one do I need?", in order. */
export const ENTRIES: Entry[] = [
  {
    want: { en: 'The whole editor, as it comes', es: 'El editor completo, tal como viene', zh: '开箱即用的完整编辑器' },
    use: '<DocsEditor />',
    parts: all('DocsEditor'),
    code: `'use client';
import { DocsEditor } from '@rebodocs/react';

export function Receipt({ file }: { file: Uint8Array }) {
  return (
    <div className="h-screen">
      <DocsEditor docx={file} name="receipt.docx" onSave={save} />
    </div>
  );
}`,
  },
  {
    want: { en: 'The pages, with my own interface', es: 'Las páginas, con mi propia interfaz', zh: '只要页面，界面我自己做' },
    use: '<DocsProvider> + <DocsSurface> + hooks',
    parts: { toolbar: ['yours'], ruler: ['hidden'], pages: ['rebodocs', 'DocsSurface'], panel: ['yours'], status: ['yours'] },
    code: `import { DocsProvider, DocsSurface } from '@rebodocs/react';

<DocsProvider docx={file} name="receipt.docx" onSave={save}>
  <MyToolbar />        {/* useDocs() */}
  <DocsSurface className="min-h-0 flex-1" />
  <MyStatusBar />      {/* useDocsCount() */}
</DocsProvider>`,
  },
  {
    want: { en: 'The ruler, in my own interface', es: 'La regla, en mi propia interfaz', zh: '在我自己的界面中加上标尺' },
    use: '<DocsRuler />',
    parts: { toolbar: ['yours'], ruler: ['rebodocs', 'DocsRuler'], pages: ['rebodocs', 'DocsSurface'], panel: ['yours'], status: ['yours'] },
    code: `<DocsProvider docx={file} onSave={save}>
  <MyToolbar />
  <DocsRuler />        {/* as wide as the pages */}
  <DocsSurface className="min-h-0 flex-1" />
</DocsProvider>`,
  },
  {
    want: { en: 'The editor, without React', es: 'El editor, sin React', zh: '不用 React 的编辑器' },
    use: 'mountDocs · createDocs',
    parts: { ...all('mountDocs'), pages: ['rebodocs', 'mountDocs · createDocs'] },
    code: `import { mountDocs } from '@rebodocs/react/mount';

// the whole editor, no framework
const docs = mountDocs(element, { docx: bytes, locale: 'en', onSave });

// later
docs.destroy();`,
  },
];

export interface ComponentDoc {
  name: 'DocsEditor' | 'DocsProvider' | 'DocsSurface' | 'DocsRuler';
  summary: L;
  facts: L[];
  tips?: L[];
  /** What it is used like: one block or more, each with its language. */
  example: [lang: 'tsx' | 'css', code: string][];
}

export const COMPONENTS: ComponentDoc[] = [
  {
    name: 'DocsEditor',
    summary: {
      en: 'The whole editor — toolbar, ruler, side panel, pages and status bar.',
      es: 'El editor completo: barra de herramientas, regla, panel lateral, páginas y barra de estado.',
      zh: '完整的编辑器：工具栏、标尺、侧边栏、页面和状态栏。',
    },
    facts: [
      { en: 'Fills its container', es: 'Llena su contenedor', zh: '填满容器' },
      { en: 'Needs a height', es: 'Necesita una altura', zh: '需要高度' },
      { en: 'Takes DocsProvider props', es: 'Acepta las props de DocsProvider', zh: '接受 DocsProvider 的属性' },
    ],
    example: [
      [
        'tsx',
        `'use client';
import { useRef } from 'react';
import { DocsEditor, type DocsHandle } from '@rebodocs/react';

export function Contract({ file }: { file: Uint8Array }) {
  const editor = useRef<DocsHandle>(undefined);
  // The handle, for what your own buttons do with the document.
  const send = () => upload(editor.current!.exportDocx(), 'contract.docx');
  return (
    <div className="flex h-screen flex-col">
      <button onClick={send}>Send for signature</button>
      <div className="min-h-0 flex-1">
        <DocsEditor ref={editor} docx={file} name="contract.docx" locale="en" onReady={(handle) => handle?.focus()} />
      </div>
    </div>
  );
}`,
      ],
    ],
  },
  {
    name: 'DocsProvider',
    summary: { en: 'Holds one document for its children. It draws nothing.', es: 'Tiene un documento para sus hijos. No dibuja nada.', zh: '为子组件持有一份文档。自身不绘制任何内容。' },
    facts: [
      { en: 'Wrap your own UI with it', es: 'Envuelve tu propia interfaz con él', zh: '用它包裹你自己的界面' },
      { en: 'Keep docx stable', es: 'Mantén docx estable', zh: '保持 docx 不变' },
      { en: 'Latest callback wins', es: 'Gana el último callback', zh: '以最新的回调为准' },
    ],
    example: [
      [
        'tsx',
        `// State a key must reach lives outside the provider, or in a child of it.
function Editor({ file }: { file: Uint8Array }) {
  const [finding, setFinding] = useState(false);
  return (
    <DocsProvider docx={file} name="contract.docx" onSave={upload} onFindKey={() => setFinding(true)}>
      <MyToolbar />
      {finding && <FindBar onClose={() => setFinding(false)} />}
      <DocsSurface className="h-full" />
    </DocsProvider>
  );
}`,
      ],
    ],
  },
  {
    name: 'DocsSurface',
    summary: { en: 'The pages of the document. Exactly one per provider.', es: 'Las páginas del documento. Exactamente una por provider.', zh: '文档的页面。每个 provider 有且只有一个。' },
    facts: [
      { en: 'Scrolls itself', es: 'Se desplaza solo', zh: '自带滚动' },
      { en: 'Needs a height', es: 'Necesita una altura', zh: '需要高度' },
      { en: 'className · style', es: 'className · style', zh: 'className · style' },
    ],
    tips: [
      {
        en: 'Give it a height: h-full in something that has one, or flex-1 min-h-0 inside a column.',
        es: 'Dale una altura: h-full dentro de algo que tenga una, o flex-1 min-h-0 dentro de una columna.',
        zh: '给它一个高度：放在有高度的容器中用 h-full，或在纵向 flex 布局中用 flex-1 min-h-0。',
      },
      {
        en: 'Set the variables on the surface or on anything above it, in CSS or in style.',
        es: 'Fija las variables en la superficie o en cualquier cosa por encima, en CSS o en style.',
        zh: '把变量设置在 surface 或其任意祖先元素上，用 CSS 或 style 都可以。',
      },
      {
        en: 'The pages themselves are not for styling: where each letter goes is worked out, not left to the browser.',
        es: 'Las páginas en sí no son para darles estilo: dónde va cada letra se calcula, no se le deja al navegador.',
        zh: '页面本身不应通过样式修改：每个字符的位置都是计算出来的，而不是交给浏览器决定。',
      },
    ],
    example: [
      [
        'tsx',
        `<DocsSurface
  className="min-h-0 flex-1"
  style={{ '--dx-canvas': '#f6eedf', '--dx-selection': '#fbe3a6', '--dx-caret': '#b07a00' } as CSSProperties}
/>`,
      ],
      [
        'css',
        `/* Or in your CSS, on the surface or on anything above it */
.editor {
  --dx-canvas: #f6eedf;
  --dx-page-shadow: 0 2px 10px rgb(120 80 20 / 0.16);
}`,
      ],
    ],
  },
  {
    name: 'DocsRuler',
    summary: {
      en: 'The ruler: the page in centimetres, with margins and indents you can drag.',
      es: 'La regla: la página en centímetros, con márgenes y sangrías que se pueden arrastrar.',
      zh: '标尺：以厘米显示页面，可以拖动页边距和缩进。',
    },
    facts: [
      { en: 'Drawn on a canvas', es: 'Dibujada en un canvas', zh: '绘制在 canvas 上' },
      { en: 'className · style', es: 'className · style', zh: 'className · style' },
      { en: 'Leave it out on narrow windows', es: 'Déjala fuera en ventanas angostas', zh: '窄窗口中不要显示' },
    ],
    tips: [
      {
        en: 'Put it right above the surface, as wide as it: it lines itself up with the page under it.',
        es: 'Ponla justo encima de la superficie, del mismo ancho: se alinea sola con la página de abajo.',
        zh: '把它放在 surface 正上方，宽度相同：它会自动与下方的页面对齐。',
      },
      {
        en: 'After setLocale, give it a key that changes with the language to have its markers in the new one.',
        es: 'Después de setLocale, dale una key que cambie con el idioma para tener sus marcadores en el nuevo.',
        zh: '调用 setLocale 后，给它一个随语言变化的 key，这样标记就会使用新语言。',
      },
      {
        en: 'A narrow window has no room for it; leave it out there.',
        es: 'Una ventana angosta no tiene espacio para ella; déjala fuera ahí.',
        zh: '窄窗口放不下标尺，这时不要显示它。',
      },
    ],
    example: [
      [
        'tsx',
        `function Pages() {
  const { narrow } = useDocsResponsive();
  const locale = useSyncExternalStore(onLocaleChange, getLocale);
  return (
    <div className="flex h-full flex-col" style={{ '--dx-ruler': '#fffbf2', '--dx-ruler-on': '#b07a00' } as CSSProperties}>
      {!narrow && <DocsRuler key={locale} />}
      <DocsSurface className="min-h-0 flex-1" />
    </div>
  );
}`,
      ],
    ],
  },
];

export const EDITOR_ADDS = ['features', 'versions', 'className', 'style', 'onReady', 'ref'];
export const EDITOR_HANDLE = ['exportDocx()', 'save()', 'dirty', 'name', 'editor', 'collab', 'setName', 'setAuthor', 'setLocale', 'setTheme', 'setLetterhead', 'showPanel', 'hidePanel', 'focus'];

export type PropGroup = 'Data' | 'Events' | 'Keys' | 'Together';
/** How the type chip is coloured: data, a function, an object, a boolean. */
export type PropKind = 'data' | 'fn' | 'obj' | 'bool';

export interface PropDoc {
  name: string;
  type: string;
  kind: PropKind;
  group: PropGroup;
  does: L;
  /** What to watch out for, on the pill beside it. */
  warn?: L;
}

/** What each group of props is called. */
export const PROP_GROUP_NAMES: Record<PropGroup | 'All', L> = {
  All: { en: 'All', es: 'Todas', zh: '全部' },
  Data: { en: 'Data', es: 'Datos', zh: '数据' },
  Events: { en: 'Events', es: 'Eventos', zh: '事件' },
  Keys: { en: 'Keys', es: 'Teclas', zh: '按键' },
  Together: { en: 'Together', es: 'En equipo', zh: '协作' },
};

const RECREATES: L = { en: 'Recreates the document', es: 'Vuelve a crear el documento', zh: '会重新创建文档' };
const AT_CREATION: L = { en: 'Read only at creation', es: 'Solo se lee al crear', zh: '仅在创建时读取' };

/** Every prop of DocsProvider, as `DocsHeadlessOptions` has them. */
export const PROPS: PropDoc[] = [
  {
    name: 'docx',
    type: 'Uint8Array | ArrayBuffer',
    kind: 'data',
    group: 'Data',
    does: { en: 'The document to open; an empty one without it.', es: 'El documento que se abre; uno vacío si no se da.', zh: '要打开的文档；不传则为空白文档。' },
    warn: RECREATES,
  },
  {
    name: 'unsaved',
    type: 'boolean',
    kind: 'bool',
    group: 'Data',
    does: {
      en: 'Whether docx has changes not saved yet, as a draft your app kept: dirty from the start.',
      es: 'Si docx tiene cambios aún sin guardar, como un borrador que guardó tu aplicación: con cambios desde el inicio.',
      zh: 'docx 是否包含尚未保存的修改，比如你的应用保存的草稿：一开始就标记为已修改。',
    },
    warn: { en: 'Read with docx', es: 'Se lee con docx', zh: '随 docx 读取' },
  },
  {
    name: 'name',
    type: 'string',
    kind: 'data',
    group: 'Data',
    does: {
      en: 'What the document is called, given to what is saved and exported. Follows its prop.',
      es: 'Cómo se llama el documento, que se da a lo que se guarda y se exporta. Sigue a su prop.',
      zh: '文档名称，会传给保存和导出的文件。随属性更新。',
    },
  },
  {
    name: 'author',
    type: 'string',
    kind: 'data',
    group: 'Data',
    does: {
      en: 'Who the person is: what their notes are signed with. Follows its prop.',
      es: 'Quién es la persona: con qué se firman sus notas. Sigue a su prop.',
      zh: '当前用户是谁：用于给批注署名。随属性更新。',
    },
  },
  {
    name: 'locale',
    type: 'string',
    kind: 'data',
    group: 'Data',
    does: {
      en: "The language of the texts the library still has: the bar beside the selection, what a screen reader is told. 'es', 'en', or one in locales; left out, the browser's, or English. The whole page's, as setLocale. Follows its prop.",
      es: "El idioma de los textos que aún tiene la biblioteca: la barra junto a la selección, lo que se le dice a un lector de pantalla. 'es', 'en', o uno en locales; si no se da, el del navegador, o inglés. Es de toda la página, como setLocale. Sigue a su prop.",
      zh: "库中仍保留的文本所用的语言：选区旁的工具条、告诉屏幕阅读器的内容。可以是 'es'、'en' 或 locales 中的某种语言；不传时使用浏览器语言，否则使用英文。与 setLocale 一样作用于整个页面。随属性更新。",
    },
  },
  {
    name: 'locales',
    type: 'Record<string, Texts>',
    kind: 'data',
    group: 'Data',
    does: {
      en: 'More languages, or other words for these, as { fr: texts }; the Chinese ones are in @rebodocs/editor/locales.',
      es: 'Más idiomas, u otras palabras para estos, como { fr: texts }; los de chino están en @rebodocs/editor/locales.',
      zh: '更多语言，或替换现有语言的用词，形如 { fr: texts }；中文位于 @rebodocs/editor/locales。',
    },
  },
  {
    name: 'letterhead',
    type: 'Blob | { bytes, type } | string | null',
    kind: 'obj',
    group: 'Data',
    does: {
      en: 'A PNG or JPG to use as letterhead, as a file, its bytes or its address; null for none.',
      es: 'Un PNG o JPG para usar como membrete, como archivo, sus bytes o su dirección; null para ninguno.',
      zh: '用作信头的 PNG 或 JPG，可以是文件、字节或地址；null 表示不使用。',
    },
  },
  {
    name: 'fonts',
    type: 'FontSource[]',
    kind: 'obj',
    group: 'Data',
    does: {
      en: 'Typefaces of your own, each with its family and its file. For the whole page; one added later is loaded then.',
      es: 'Tipografías propias, cada una con su familia y su archivo. Para toda la página; una agregada después se carga entonces.',
      zh: '你自己的字体，每个包含字体族和文件。作用于整个页面；之后新增的字体会在那时加载。',
    },
  },
  {
    name: 'embedFonts',
    type: "boolean | 'subset'",
    kind: 'data',
    group: 'Data',
    does: {
      en: "Whether the DOCX carries the fonts of fonts its text uses, when their licence lets it: whole unless false, or cut down to the characters used with 'subset'. Follows its prop.",
      es: "Si el DOCX lleva las fuentes de fonts que usa su texto, cuando su licencia lo permite: completas salvo con false, o recortadas a los caracteres usados con 'subset'. Sigue a su prop.",
      zh: "在许可证允许时，DOCX 是否嵌入 fonts 中文本用到的字体：除非设为 false，否则嵌入完整字体；设为 'subset' 则只嵌入用到的字符。随属性更新。",
    },
  },
  {
    name: 'spellcheck',
    type: 'SpellChecker',
    kind: 'data',
    group: 'Data',
    does: {
      en: 'What marks the words spelled wrong, with a red wave, and offers what they could be: createSpellChecker with the dictionaries you give, or one of your own. Follows its prop.',
      es: 'Lo que marca las palabras mal escritas, con una onda roja, y ofrece lo que podrían ser: createSpellChecker con los diccionarios que des, o uno propio. Sigue a su prop.',
      zh: '用红色波浪线标出拼错的单词并给出建议：使用你提供词典的 createSpellChecker，或你自己的实现。随属性更新。',
    },
  },
  {
    name: 'theme',
    type: "'light' | 'dark' | 'auto'",
    kind: 'data',
    group: 'Data',
    does: {
      en: "The colours of what the editor draws around the pages and the menus it shows: light as it comes, dark, or 'auto' for the system's. Follows its prop.",
      es: "Los colores de lo que el editor dibuja alrededor de las páginas y de los menús que muestra: claro como viene, oscuro, o 'auto' para el del sistema. Sigue a su prop.",
      zh: "编辑器在页面周围绘制的内容及其菜单的配色：默认浅色、深色，或 'auto' 跟随系统。随属性更新。",
    },
  },
  {
    name: 'language',
    type: 'string',
    kind: 'data',
    group: 'Data',
    does: {
      en: "The language the text is in, as a tag ('es-MX'), written in the DOCX for spelling and so Word does not guess one, and the language variables are filled in (dates, numbers). Left out, the one the file says, or else the interface's with the browser's region; the person can choose another at the foot of the editor. Follows its prop.",
      es: "El idioma en que está el texto, como etiqueta ('es-MX'), que se escribe en el DOCX para la ortografía y para que Word no adivine uno, y en el que se llenan las variables (fechas, números). Si no se da, el que dice el archivo, o si no el de la interfaz con la región del navegador; la persona puede elegir otro al pie del editor. Sigue a su prop.",
      zh: "文本所用的语言标签（如 'zh-CN'）：写入 DOCX，用于拼写检查并避免 Word 自行猜测，填写变量（日期、数字）时也使用它。不传时使用文件中声明的语言，否则使用界面语言加上浏览器的地区；用户可以在编辑器底部选择其他语言。随属性更新。",
    },
  },
  {
    name: 'onSave',
    type: '(docx, name) => void',
    kind: 'fn',
    group: 'Events',
    does: {
      en: 'Called on ⌘S and on docs.save(). Keeping the file is yours to do.',
      es: 'Se llama con ⌘S y con docs.save(). Guardar el archivo te toca a ti.',
      zh: '按 ⌘S 或调用 docs.save() 时调用。由你负责保存文件。',
    },
    warn: { en: 'Adding or removing it recreates the document', es: 'Agregarlo o quitarlo vuelve a crear el documento', zh: '新增或移除它会重新创建文档' },
  },
  { name: 'onChange', type: '(editor) => void', kind: 'fn', group: 'Events', does: { en: 'Called when the document changes.', es: 'Se llama cuando cambia el documento.', zh: '文档变化时调用。' } },
  {
    name: 'onError',
    type: '(message) => void',
    kind: 'fn',
    group: 'Events',
    does: { en: 'Told what went wrong; an alert without it.', es: 'Recibe qué salió mal; una alerta si no se da.', zh: '接收错误信息；不传时弹出 alert。' },
  },
  { name: 'onLinkKey', type: '() => void', kind: 'fn', group: 'Keys', does: { en: 'Answers ⌘K.', es: 'Responde a ⌘K.', zh: '响应 ⌘K。' } },
  {
    name: 'onFindKey',
    type: '(replace) => void',
    kind: 'fn',
    group: 'Keys',
    does: { en: 'Answers ⌘F and ⌘H; replace is true for ⌘H.', es: 'Responde a ⌘F y ⌘H; replace es true con ⌘H.', zh: '响应 ⌘F 和 ⌘H；按 ⌘H 时 replace 为 true。' },
  },
  {
    name: 'bubble',
    type: 'boolean',
    kind: 'bool',
    group: 'Keys',
    does: {
      en: 'true for the bar beside the selection. See useDocsBubble.',
      es: 'true para la barra junto a la selección. Ve useDocsBubble.',
      zh: '设为 true 显示选区旁的工具条。参见 useDocsBubble。',
    },
    warn: AT_CREATION,
  },
  {
    name: 'slash',
    type: 'boolean | { builtIns?, commands? }',
    kind: 'obj',
    group: 'Keys',
    does: {
      en: 'The menu a “/” brings up; with settings, which of its commands it keeps and your own. Its variable and note need bubble too.',
      es: 'El menú que abre una “/”; con configuración, cuáles de sus comandos conserva y los tuyos. Su variable y su nota también necesitan bubble.',
      zh: '输入 “/” 弹出的菜单；传入配置时可指定保留哪些内置命令以及你自己的命令。其中的变量和批注还需要开启 bubble。',
    },
    warn: AT_CREATION,
  },
  {
    name: 'variableSuggestions',
    type: 'boolean | { variables?, fromDocument?, allowNew? }',
    kind: 'obj',
    group: 'Keys',
    does: { en: 'The list “{{” brings up, of the variables.', es: 'La lista de variables que abre “{{”.', zh: '输入 “{{” 弹出的变量列表。' },
    warn: AT_CREATION,
  },
  {
    name: 'forms',
    type: 'boolean',
    kind: 'bool',
    group: 'Keys',
    does: {
      en: 'Marking areas that can be changed from the bubble and the “/” menu.',
      es: 'Marcar áreas que se pueden cambiar desde la burbuja y el menú “/”.',
      zh: '通过选区工具条和 “/” 菜单标记可修改的区域。',
    },
    warn: AT_CREATION,
  },
  {
    name: 'collab',
    type: '{ url, room, ticket? }',
    kind: 'obj',
    group: 'Together',
    does: {
      en: 'The document is a shared room on your collaboration server.',
      es: 'El documento es una sala compartida en tu servidor de colaboración.',
      zh: '文档是你协作服务器上的一个共享房间。',
    },
    warn: { en: 'Changing the room recreates the document', es: 'Cambiar la sala vuelve a crear el documento', zh: '更换房间会重新创建文档' },
  },
  {
    name: 'onCollab',
    type: '(state, peers) => void',
    kind: 'fn',
    group: 'Together',
    does: {
      en: 'Called when the connection, or who is on the document, changes.',
      es: 'Se llama cuando cambia la conexión, o quién está en el documento.',
      zh: '连接状态或文档中的人员变化时调用。',
    },
  },
];
export const PROP_GROUPS: PropGroup[] = ['Data', 'Events', 'Keys', 'Together'];

export type CssVar = [name: string, what: L];
export const SURFACE_VARS: CssVar[] = [
  ['--dx-canvas', { en: 'Behind the pages', es: 'Detrás de las páginas', zh: '页面背后' }],
  ['--dx-page-shadow', { en: 'The shadow of each page', es: 'La sombra de cada página', zh: '每页的阴影' }],
  ['--dx-selection', { en: 'The selection', es: 'La selección', zh: '选区' }],
  ['--dx-caret', { en: 'The caret', es: 'El cursor', zh: '光标' }],
  ['--dx-handle', { en: 'The handles on a touch screen', es: 'Los tiradores en una pantalla táctil', zh: '触屏上的拖动手柄' }],
];
export const RULER_VARS: CssVar[] = [
  ['--dx-ruler', { en: 'Behind it', es: 'Detrás de ella', zh: '背景' }],
  ['--dx-ruler-line', { en: 'The line under it', es: 'La línea de abajo', zh: '底部的线' }],
  ['--dx-ruler-margin', { en: 'The page outside the text', es: 'La página fuera del texto', zh: '文字区域之外的页面' }],
  ['--dx-ruler-text', { en: 'The room of the text', es: 'El espacio del texto', zh: '文字区域' }],
  ['--dx-ruler-ink', { en: 'Numbers and markers', es: 'Números y marcadores', zh: '数字和标记' }],
  ['--dx-ruler-on', { en: 'The marker being dragged', es: 'El marcador que se arrastra', zh: '正在拖动的标记' }],
];

/** The interface included: the toolbar, the menus, the side panel, the status bar, the dialogs and the bar beside the selection. */
export const UI_VARS: CssVar[] = [
  ['--dx-ui-bar', { en: 'Behind the toolbar and the status bar', es: 'Detrás de la barra de herramientas y la barra de estado', zh: '工具栏和状态栏的背景' }],
  ['--dx-ui-bg', { en: 'Behind menus, the panel and dialogs', es: 'Detrás de los menús, el panel y los diálogos', zh: '菜单、面板和对话框的背景' }],
  ['--dx-ui-ink', { en: 'Text', es: 'Texto', zh: '文字' }],
  ['--dx-ui-muted', { en: 'Icons, hints and headings of groups', es: 'Iconos, pistas y encabezados de grupos', zh: '图标、提示和分组标题' }],
  ['--dx-ui-line', { en: 'Borders and separators', es: 'Bordes y separadores', zh: '边框和分隔线' }],
  ['--dx-ui-hover', { en: 'Under the pointer', es: 'Bajo el puntero', zh: '鼠标悬停处' }],
  ['--dx-ui-active', { en: 'What is on', es: 'Lo que está activo', zh: '激活项' }],
  ['--dx-ui-active-line', { en: 'The border of what is on', es: 'El borde de lo que está activo', zh: '激活项的边框' }],
  ['--dx-ui-accent', { en: 'Main buttons, links, focus rings', es: 'Botones principales, enlaces, anillos de foco', zh: '主按钮、链接、焦点环' }],
  ['--dx-ui-accent-hover', { en: 'A main button under the pointer', es: 'Un botón principal bajo el puntero', zh: '鼠标悬停时的主按钮' }],
  ['--dx-ui-on-accent', { en: 'Text on the accent', es: 'Texto sobre el color de acento', zh: '强调色上的文字' }],
];

/** "Default" is what the package uses when nothing is set; the others are examples. `scheme` is the colour scheme the browser draws its own controls in. */
export const THEMES: { label: L; scheme?: 'dark'; vars: Record<string, string> }[] = [
  {
    label: { en: 'Default', es: 'Predeterminado', zh: '默认' },
    vars: {
      '--dx-canvas': '#efede8',
      '--dx-page-shadow': '0 1px 2px rgba(47,46,43,.08), 0 10px 28px -10px rgba(47,46,43,.22)',
      '--dx-selection': 'rgba(11,87,208,.2)',
      '--dx-caret': '#000',
      '--dx-handle': '#0b57d0',
      '--dx-ruler': '#fbfaf8',
      '--dx-ruler-line': '#e6e3dc',
      '--dx-ruler-margin': '#e6e3dc',
      '--dx-ruler-text': '#fff',
      '--dx-ruler-ink': '#5f5d58',
      '--dx-ruler-on': '#0b57d0',
      '--dx-ui-bar': '#fbfaf8',
      '--dx-ui-bg': '#fff',
      '--dx-ui-ink': '#2f2e2b',
      '--dx-ui-muted': '#5f5d58',
      '--dx-ui-line': '#e6e3dc',
      '--dx-ui-hover': '#f3f1ec',
      '--dx-ui-active': '#e8f0fd',
      '--dx-ui-active-line': '#a8c7fa',
      '--dx-ui-accent': '#0b57d0',
      '--dx-ui-accent-hover': '#08398a',
      '--dx-ui-on-accent': '#fff',
    },
  },
  {
    label: { en: 'Warm', es: 'Cálido', zh: '暖色' },
    vars: {
      '--dx-canvas': '#f6eedf',
      '--dx-page-shadow': '0 2px 10px rgba(120,80,20,.16)',
      '--dx-selection': '#fbe3a6',
      '--dx-caret': '#b07a00',
      '--dx-handle': '#b07a00',
      '--dx-ruler': '#fffbf2',
      '--dx-ruler-line': '#e6d8bd',
      '--dx-ruler-margin': '#ecdfc4',
      '--dx-ruler-text': '#fffbf2',
      '--dx-ruler-ink': '#8a5a00',
      '--dx-ruler-on': '#b07a00',
      '--dx-ui-bar': '#fbf4e6',
      '--dx-ui-bg': '#fffbf2',
      '--dx-ui-ink': '#3d2f17',
      '--dx-ui-muted': '#7a6440',
      '--dx-ui-line': '#e6d8bd',
      '--dx-ui-hover': '#f4e9d2',
      '--dx-ui-active': '#fbe3a6',
      '--dx-ui-active-line': '#e8c66a',
      '--dx-ui-accent': '#8a5a00',
      '--dx-ui-accent-hover': '#6f4800',
      '--dx-ui-on-accent': '#fff',
    },
  },
  {
    label: { en: 'Dark', es: 'Oscuro', zh: '深色' },
    scheme: 'dark',
    vars: {
      '--dx-canvas': '#15171b',
      '--dx-page-shadow': '0 4px 18px rgba(0,0,0,.45)',
      '--dx-selection': '#f5d0dd',
      '--dx-caret': '#a23a5e',
      '--dx-handle': '#a23a5e',
      '--dx-ruler': '#1f2228',
      '--dx-ruler-line': '#3c414b',
      '--dx-ruler-margin': '#3a3f49',
      '--dx-ruler-text': '#4a505c',
      '--dx-ruler-ink': '#c9ccd3',
      '--dx-ruler-on': '#f2a7c3',
      '--dx-ui-bar': '#1f2228',
      '--dx-ui-bg': '#2a2e36',
      '--dx-ui-ink': '#e6e8ec',
      '--dx-ui-muted': '#a4aab5',
      '--dx-ui-line': '#3c414b',
      '--dx-ui-hover': '#353a44',
      '--dx-ui-active': '#2c3f63',
      '--dx-ui-active-line': '#4a6aa5',
      '--dx-ui-accent': '#8ab4f8',
      '--dx-ui-accent-hover': '#a6c5fa',
      '--dx-ui-on-accent': '#10213f',
    },
  },
];

export const LANG_FNS = [
  'setLocale(code)',
  'getLocale()',
  'onLocaleChange(fn)',
  'addLocale(code, texts)',
  'locales()',
  'messages(locale)',
  't(key)',
  'plural(key, n)',
  'fontFamilies()',
  'addFont(source)',
  'addFonts(sources)',
  'onFontsChange(fn)',
  'createSpellChecker(options)',
];
export const VERSION_FNS = ['createVersionView(editor, versions)', 'loadVersion(versions, id)', 'compareDocs(before, after)', 'createAssistantChat(editor, options)'];
