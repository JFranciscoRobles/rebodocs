// What the page "Accessibility" says that is data, each checked in
// packages/editor/src (a11y.ts, keys.ts: announceMove, whereIs, spokenObject;
// ruler.ts, toolbar.ts, bubble.ts, panel.ts, sidebar.ts) and by driving a real
// editor with keys in headless Chrome, reading its live regions after each.
// Each text in each language of the site; the examples are what the editor
// says in that language, of the English document of the demo.

import type { L } from '@/lib/i18n';

/** What the live region says, and when. */
export const HEARD: { title: L; text: L; example: L }[] = [
  {
    title: { en: 'What the caret moved over', es: 'Lo que recorrió el cursor', zh: '光标经过的内容' },
    text: {
      en: 'The letter with the arrows, the word with Alt (Ctrl on Windows) and an arrow, the line with up, down, Home and End. A space, a tab and the end of a paragraph by their name.',
      es: 'La letra con las flechas, la palabra con Alt (Ctrl en Windows) y una flecha, la línea con arriba, abajo, Inicio y Fin. Un espacio, una tabulación y el fin de un párrafo por su nombre.',
      zh: '用方向键时朗读字符，用 Alt（Windows 上为 Ctrl）加方向键时朗读单词，用上下键、Home 和 End 时朗读整行。空格、制表符和段落结尾会读出名称。',
    },
    example: {
      en: 'e · Reservation · space · end of paragraph',
      es: 'e · Reservation · espacio · fin de párrafo',
      zh: 'e · Reservation · 空格 · 段落结束',
    },
  },
  {
    title: { en: 'Where it is, when that changes', es: 'Dónde está, cuando eso cambia', zh: '位置变化时说明位置' },
    text: {
      en: 'Before the text, on reaching another paragraph: the page, a heading, a table cell, leaving the table, a list and its level; and a link, or a change someone made, on reaching it.',
      es: 'Antes del texto, al llegar a otro párrafo: la página, un título, una celda de tabla, salir de la tabla, una lista y su nivel; y un enlace, o un cambio que alguien hizo, al llegar a él.',
      zh: '进入另一个段落时，在朗读文字前先说明：页码、标题、表格单元格、离开表格、列表及其级别；遇到链接或他人的修订时也会说明。',
    },
    example: {
      en: 'Table, row 2, column 1. Deposit',
      es: 'Tabla, fila 2, columna 1. Deposit',
      zh: '表格，第 2 行，第 1 列。Deposit',
    },
  },
  {
    title: { en: 'What is there that is not text', es: 'Lo que hay que no es texto', zh: '非文字的内容' },
    text: {
      en: 'A picture by its description, as Word keeps it; a text box; the number of a note at the foot of the page, and then the letter after it.',
      es: 'Una imagen por su descripción, como la guarda Word; un cuadro de texto; el número de una nota al pie, y luego la letra que le sigue.',
      zh: '图片按 Word 保存的描述朗读；文本框；脚注编号，然后是其后的字符。',
    },
    example: {
      en: 'Picture: Plan of the flat… · Footnote 1, space',
      es: 'Imagen: Plan of the flat… · Nota al pie 1, espacio',
      zh: '图片：Plan of the flat… · 脚注 1，空格',
    },
  },
  {
    title: { en: 'What was selected', es: 'Lo que se seleccionó', zh: '选中的内容' },
    text: {
      en: 'What a key added to the selection or took from it. A long selection gives its start and its length, not the whole text.',
      es: 'Lo que una tecla agregó a la selección o le quitó. Una selección larga da su inicio y su longitud, no el texto completo.',
      zh: '按键在选区中增加或减少的内容。较长的选区只朗读开头和长度，而不是全部文字。',
    },
    example: { en: 'r, selected · All selected', es: 'r, seleccionado · Todo seleccionado', zh: 'r，已选中 · 已全选' },
  },
  {
    title: { en: 'What a key did', es: 'Lo que hizo una tecla', zh: '按键做了什么' },
    text: {
      en: 'What it deleted, a format turned on or off, undoing and redoing, pasting, going into the header or the footer.',
      es: 'Lo que borró, un formato que se activó o desactivó, deshacer y rehacer, pegar, entrar al encabezado o al pie.',
      zh: '删除了什么、开启或关闭了哪种格式、撤销和重做、粘贴、进入页眉或页脚。',
    },
    example: {
      en: 'o, deleted · Bold, on · Nothing to undo',
      es: 'o, borrado · Se activó Negrita · Nada que deshacer',
      zh: 'o，已删除 · 加粗，开 · 没有可撤销的操作',
    },
  },
];

/** The keys of the parts around the document, from a11y.ts, toolbar.ts, bubble.ts, typeahead.ts, keys.ts and panel.ts. */
export const KEYS: { keys: L; text: L }[] = [
  { keys: { en: 'Alt+F10', es: 'Alt+F10', zh: 'Alt+F10' }, text: { en: 'To the toolbar.', es: 'A la barra de herramientas.', zh: '进入工具栏。' } },
  {
    keys: { en: 'F6 · Shift+F6', es: 'F6 · Shift+F6', zh: 'F6 · Shift+F6' },
    text: {
      en: 'From one part to the next, as they are on the page: the toolbar, the ruler, the side panel, the document, the status bar, and the find bar while it is open.',
      es: 'De una parte a la siguiente, como están en la página: la barra de herramientas, la regla, el panel lateral, el documento, la barra de estado, y la barra de búsqueda mientras está abierta.',
      zh: '按页面上的顺序在各部分之间切换：工具栏、标尺、侧边栏、文档、状态栏，以及打开时的查找栏。',
    },
  },
  {
    keys: { en: 'Escape', es: 'Escape', zh: 'Esc' },
    text: {
      en: 'From any part back to the document. In a menu, back to the button that opened it.',
      es: 'De cualquier parte de vuelta al documento. En un menú, de vuelta al botón que lo abrió.',
      zh: '从任何部分返回文档。在菜单中则返回打开它的按钮。',
    },
  },
  {
    keys: { en: 'Tab', es: 'Tab', zh: 'Tab' },
    text: {
      en: 'In the toolbar, one stop; the arrows, Home and End go along it.',
      es: 'En la barra de herramientas, una sola parada; las flechas, Inicio y Fin la recorren.',
      zh: '工具栏只占一个 Tab 停靠点；用方向键、Home 和 End 在其中移动。',
    },
  },
  {
    keys: { en: 'Enter · ↓', es: 'Enter · ↓', zh: 'Enter · ↓' },
    text: {
      en: 'On a button with a menu, opens it with the keyboard inside; the arrows go through it, and through grids (the size of a table, colours) in both directions.',
      es: 'En un botón con menú, lo abre con el teclado dentro; las flechas lo recorren, y recorren las cuadrículas (el tamaño de una tabla, los colores) en ambas direcciones.',
      zh: '在带菜单的按钮上按下时打开菜单并把焦点移入；用方向键在菜单中移动，在网格（表格大小、颜色）中可上下左右移动。',
    },
  },
  {
    keys: { en: 'A tap of ⌘ (Ctrl)', es: 'Un toque de ⌘ (Ctrl)', zh: '轻按 ⌘（Ctrl）' },
    text: {
      en: 'Shows the bar beside the selection. Tab goes into it, the arrows along it, Tab or Escape back to the text.',
      es: 'Muestra la barra junto a la selección. Tab entra en ella, las flechas la recorren, Tab o Escape regresan al texto.',
      zh: '显示选区旁的工具条。按 Tab 进入，用方向键在其中移动，按 Tab 或 Esc 返回文字。',
    },
  },
  {
    keys: { en: '/', es: '/', zh: '/' },
    text: {
      en: 'At the start of a paragraph or after a space, the “/” menu: it is said, with how to use it; the keyboard stays in the text, ↑ and ↓ go through it and say each one, Enter or Tab does it, Escape leaves the “/” as text.',
      es: 'Al inicio de un párrafo o después de un espacio, el menú “/”: se anuncia, con cómo usarlo; el teclado se queda en el texto, ↑ y ↓ lo recorren y dicen cada opción, Enter o Tab la ejecuta, Escape deja la “/” como texto.',
      zh: '在段落开头或空格后输入，弹出 “/” 菜单：会朗读菜单及用法；键盘焦点留在文字中，用 ↑ 和 ↓ 浏览并朗读每一项，按 Enter 或 Tab 执行，按 Esc 则把 “/” 保留为文字。',
    },
  },
  {
    keys: { en: '{{', es: '{{', zh: '{{' },
    text: {
      en: 'The list of the variables, used as the “/” menu is; the one chosen is written whole.',
      es: 'La lista de las variables, que se usa como el menú “/”; la elegida se escribe completa.',
      zh: '变量列表，用法与 “/” 菜单相同；选中的变量会完整写入。',
    },
  },
  {
    keys: { en: 'Tab · Shift+Tab', es: 'Tab · Shift+Tab', zh: 'Tab · Shift+Tab' },
    text: {
      en: 'In a document restricted to areas to fill in, from one area to the next, selecting what it holds; a change outside them is refused and said to be.',
      es: 'En un documento restringido a áreas para llenar, de un área a la siguiente, seleccionando lo que contiene; un cambio fuera de ellas se rechaza y se anuncia.',
      zh: '在限制为只能编辑待填区域的文档中，在区域之间切换并选中其内容；对区域外的修改会被拒绝并朗读提示。',
    },
  },
  {
    keys: { en: '⌘⌥Z (Ctrl+Alt+Z)', es: '⌘⌥Z (Ctrl+Alt+Z)', zh: '⌘⌥Z（Ctrl+Alt+Z）' },
    text: { en: 'Screen reader mode, on and off.', es: 'Modo de lector de pantalla, encendido y apagado.', zh: '开启或关闭屏幕阅读器模式。' },
  },
];

/** The other parts that work from the keyboard. */
export const PARTS: { title: L; text: L }[] = [
  {
    title: { en: 'The ruler', es: 'La regla', zh: '标尺' },
    text: {
      en: 'Each margin and indent is a slider read in centimetres: the arrows move it a quarter of a centimetre, Shift a whole one, Alt a point. On the button at its corner, Enter changes the kind of tab stop and Insert sets one at the caret; a tab stop moves with the arrows and goes with Delete.',
      es: 'Cada margen y sangría es un deslizador que se lee en centímetros: las flechas lo mueven un cuarto de centímetro, Shift uno entero, Alt un punto. En el botón de su esquina, Enter cambia el tipo de tabulación e Insert pone una en el cursor; una tabulación se mueve con las flechas y se quita con Suprimir.',
      zh: '每个页边距和缩进都是以厘米朗读的滑块：方向键每次移动四分之一厘米，Shift 移动一厘米，Alt 移动一磅。在标尺角落的按钮上，Enter 更改制表位类型，Insert 在光标处设置制表位；制表位用方向键移动，用 Delete 删除。',
    },
  },
  {
    title: { en: 'Dialogs and the menu', es: 'Los diálogos y el menú', zh: '对话框与菜单' },
    text: {
      en: 'The document menu, page setup, indents, the picture grid and the comparison of versions keep Tab inside them while they are open, and give the keyboard back to what had it when they close. Pictures in the grid move with buttons as well as by dragging.',
      es: 'El menú del documento, la configuración de página, las sangrías, la cuadrícula de imágenes y la comparación de versiones mantienen Tab dentro de ellos mientras están abiertos, y devuelven el teclado a lo que lo tenía al cerrarse. Las imágenes de la cuadrícula se mueven con botones además de arrastrándolas.',
      zh: '文档菜单、页面设置、缩进、图片网格和版本对比在打开时会把 Tab 限制在其内部，关闭后把键盘焦点交还给之前的元素。网格中的图片除了拖动，也可以用按钮移动。',
    },
  },
  {
    title: { en: 'The side panel', es: 'El panel lateral', zh: '侧边栏' },
    text: {
      en: 'Its tabs are a tab list: one stop, and the arrows go from one to the next.',
      es: 'Sus pestañas son una lista de pestañas: una sola parada, y las flechas van de una a la siguiente.',
      zh: '它的标签页是一个标签列表：只占一个 Tab 停靠点，用方向键在标签之间切换。',
    },
  },
];

/** What is seen, from the styles of a11y.ts and the bars. */
export const SEEN: { title: L; text: L }[] = [
  {
    title: { en: 'Focus', es: 'Foco', zh: '焦点' },
    text: {
      en: 'A ring around whatever has the keyboard, in every part.',
      es: 'Un anillo alrededor de lo que tiene el teclado, en cada parte.',
      zh: '在每个部分中，拥有键盘焦点的元素周围都有一个焦点环。',
    },
  },
  {
    title: { en: 'Contrast', es: 'Contraste', zh: '对比度' },
    text: {
      en: 'Text of the interface is at least 4.5:1 against its background: measured on every piece of text of the toolbar, the ruler, the side panel and the status bar.',
      es: 'El texto de la interfaz tiene al menos 4.5:1 contra su fondo: medido en cada texto de la barra de herramientas, la regla, el panel lateral y la barra de estado.',
      zh: '界面文字与背景的对比度至少为 4.5:1：已对工具栏、标尺、侧边栏和状态栏中的每段文字进行测量。',
    },
  },
  {
    title: { en: 'Target size', es: 'Tamaño de los objetivos', zh: '点击目标尺寸' },
    text: {
      en: 'Buttons and choices are at least 24 pixels, or that far apart. The handles of the ruler are smaller, as WCAG allows when a control of that size does the same: Page setup for the margins, and Indents… (in the spacing menu of the toolbar, or a double click on a handle) for the indents, typed in centimetres.',
      es: 'Los botones y opciones miden al menos 24 píxeles, o están así de separados. Los tiradores de la regla son más pequeños, como permite WCAG cuando un control de ese tamaño hace lo mismo: Configurar página para los márgenes, y Sangrías… (en el menú de espaciado de la barra de herramientas, o con doble clic en un tirador) para las sangrías, escritas en centímetros.',
      zh: '按钮和选项至少为 24 像素，或彼此间隔至少 24 像素。标尺上的手柄更小，这是 WCAG 允许的，因为有相同功能且尺寸达标的控件：页边距可在“页面设置”中设置，缩进可在“缩进…”（位于工具栏的间距菜单中，或双击手柄打开）中以厘米输入。',
    },
  },
  {
    title: { en: 'The language of the text', es: 'El idioma del texto', zh: '文本语言' },
    text: {
      en: 'Chosen at the foot of the editor, or given with the language prop, or the one the file says; for a document that says none, the interface’s when it was opened, which changing the interface later leaves as it is. The field of the document and what is read from it are marked with it, so a screen reader reads a Spanish text with a Spanish voice under an English interface.',
      es: 'Elegido al pie del editor, o dado con la prop language, o el que dice el archivo; para un documento que no dice ninguno, el de la interfaz al abrirlo, que cambiar la interfaz después deja como está. El campo del documento y lo que se lee de él se marcan con él, así que un lector de pantalla lee un texto en español con voz en español bajo una interfaz en inglés.',
      zh: '可在编辑器底部选择，或通过 language 属性指定，或使用文件中声明的语言；对于未声明语言的文档，使用打开时的界面语言，之后切换界面语言也不会改变它。文档输入框及其朗读内容都会标记该语言，因此即使界面是英文，屏幕阅读器也会用中文语音朗读中文文本。',
    },
  },
  {
    title: { en: 'Colours by name', es: 'Colores por nombre', zh: '颜色以名称表示' },
    text: {
      en: '“Dark gray”, “sky blue”, not a number; the colour button says the one in use.',
      es: '“Gris oscuro”, “azul cielo”, no un número; el botón de color dice el que está en uso.',
      zh: '读作“深灰色”“天蓝色”，而不是一串数字；颜色按钮会说明当前使用的颜色。',
    },
  },
  {
    title: { en: 'High contrast', es: 'Alto contraste', zh: '高对比度' },
    text: {
      en: 'With the colours of the system forced on the page, as Windows does, the selection, the caret, the find results, what is on and what has the keyboard stay visible. The pages keep their own colours: they are the document as it prints.',
      es: 'Con los colores del sistema forzados en la página, como hace Windows, la selección, el cursor, los resultados de búsqueda, lo que está activo y lo que tiene el teclado siguen visibles. Las páginas conservan sus propios colores: son el documento como se imprime.',
      zh: '当系统强制在页面上使用系统颜色时（例如 Windows），选区、光标、查找结果、激活项和拥有键盘焦点的元素都保持可见。页面保持自身颜色：它们就是打印出来的文档。',
    },
  },
  {
    title: { en: 'Less motion', es: 'Menos movimiento', zh: '减少动态效果' },
    text: {
      en: 'With “reduce motion” set, the caret does not blink and the menu does not slide.',
      es: 'Con “reducir movimiento” activado, el cursor no parpadea y el menú no se desliza.',
      zh: '开启“减少动态效果”后，光标不再闪烁，菜单也不再滑动。',
    },
  },
];

/** What a PDF made from a document keeps for a screen reader, from pdf.ts and pdftags.ts, each checked with veraPDF and Poppler. */
export const PDF_TAGS: { title: L; text: L }[] = [
  {
    title: { en: 'Headings', es: 'Títulos', zh: '标题' },
    text: {
      en: 'By the level of their style, Title and Heading 1 as H1. They are the bookmarks in the side bar of the reader as well.',
      es: 'Por el nivel de su estilo, Título y Título 1 como H1. También son los marcadores en la barra lateral del lector.',
      zh: '按样式级别标记，“标题”和“标题 1”为 H1。它们同时也是阅读器侧栏中的书签。',
    },
  },
  {
    title: { en: 'Lists', es: 'Listas', zh: '列表' },
    text: {
      en: 'Each item with its number or bullet apart from its text, a deeper level inside the item before it.',
      es: 'Cada elemento con su número o viñeta aparte de su texto, un nivel más profundo dentro del elemento anterior.',
      zh: '每个列表项的编号或项目符号与文字分开标记，下一级列表嵌套在上一项之内。',
    },
  },
  {
    title: { en: 'Tables', es: 'Tablas', zh: '表格' },
    text: {
      en: 'Rows and cells, a heading row as heading cells of their column, merged cells with the rows and columns they cover. A heading row drawn again on the next page is read once.',
      es: 'Filas y celdas, una fila de encabezado como celdas de encabezado de su columna, celdas combinadas con las filas y columnas que cubren. Una fila de encabezado que se repite en la página siguiente se lee una sola vez.',
      zh: '标记行和单元格；标题行作为所在列的标题单元格；合并单元格标明其跨越的行和列。在下一页重复显示的标题行只朗读一次。',
    },
  },
  {
    title: { en: 'Pictures', es: 'Imágenes', zh: '图片' },
    text: {
      en: 'Read by their description. One Word was told is decorative is skipped, as are those of headers.',
      es: 'Se leen por su descripción. Una que Word marcó como decorativa se salta, igual que las de los encabezados.',
      zh: '按描述朗读。在 Word 中标记为装饰性的图片会被跳过，页眉中的图片也是如此。',
    },
  },
  {
    title: { en: 'Notes and links', es: 'Notas y enlaces', zh: '注释与链接' },
    text: {
      en: 'A note after the paragraph of its reference; a link with the address it goes to, and Tab goes through the links in the order they are read.',
      es: 'Una nota después del párrafo de su referencia; un enlace con la dirección a la que va, y Tab recorre los enlaces en el orden en que se leen.',
      zh: '注释位于其引用所在段落之后；链接带有目标地址，按 Tab 会按朗读顺序依次经过各个链接。',
    },
  },
  {
    title: { en: 'What is not read', es: 'Lo que no se lee', zh: '不朗读的内容' },
    text: {
      en: 'Headers, footers, borders, shading and the lines between columns are marked as decoration, which a screen reader skips.',
      es: 'Encabezados, pies, bordes, sombreados y las líneas entre columnas se marcan como decoración, que un lector de pantalla salta.',
      zh: '页眉、页脚、边框、底纹和分栏线都标记为装饰，屏幕阅读器会跳过。',
    },
  },
];

/** What has not been checked. */
export const NOT_CHECKED: L[] = [
  {
    en: 'Real screen readers. VoiceOver, NVDA and JAWS each read a live region and a text field in their own way. What is announced was checked in Chrome, by reading the live regions after each key, not by listening.',
    es: 'Lectores de pantalla reales. VoiceOver, NVDA y JAWS leen cada uno una región en vivo y un campo de texto a su manera. Lo que se anuncia se comprobó en Chrome, leyendo las regiones en vivo después de cada tecla, no escuchando.',
    zh: '真实的屏幕阅读器。VoiceOver、NVDA 和 JAWS 对实时区域和文本框的朗读方式各不相同。朗读内容是在 Chrome 中通过每次按键后读取实时区域来验证的，而不是实际收听。',
  },
  {
    en: 'Screen reader mode relies on the screen reader following the caret of a field the editor moves. That is how they work, but it needs trying with each one.',
    es: 'El modo de lector de pantalla depende de que el lector siga el cursor de un campo que mueve el editor. Así es como funcionan, pero hay que probarlo con cada uno.',
    zh: '屏幕阅读器模式依赖于屏幕阅读器跟随编辑器所移动的输入框光标。屏幕阅读器通常就是这样工作的，但需要逐一实际测试。',
  },
  {
    en: 'The tagged PDF was checked with veraPDF and read back with Poppler, not with Acrobat or a screen reader reading it.',
    es: 'El PDF etiquetado se comprobó con veraPDF y se leyó de vuelta con Poppler, no con Acrobat ni con un lector de pantalla leyéndolo.',
    zh: '带标签的 PDF 已用 veraPDF 验证，并用 Poppler 读回，但未用 Acrobat 或屏幕阅读器实际阅读。',
  },
  {
    en: 'The automated audit needs a browser, so it is not run with the tests: npm run a11y -- <url> runs axe on the editor of a page, in a Chrome without a window, as it opens and with the caret in it. It finds nothing on the pages of this site.',
    es: 'La auditoría automática necesita un navegador, así que no se corre con las pruebas: npm run a11y -- <url> corre axe sobre el editor de una página, en un Chrome sin ventana, al abrirse y con el cursor dentro. No encuentra nada en las páginas de este sitio.',
    zh: '自动审计需要浏览器，因此不随测试一起运行：npm run a11y -- <url> 会在无窗口的 Chrome 中，对页面中的编辑器（打开时以及光标在其中时）运行 axe。在本网站的页面上没有发现任何问题。',
  },
];
