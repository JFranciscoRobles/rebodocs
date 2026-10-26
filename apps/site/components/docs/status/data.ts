// What the page says was measured, as it was measured: these numbers come
// from running the commands, not from memory. Run them again and update them.
// Each text in each language of the site.

import type { L } from '@/lib/i18n';

/** When the numbers below were taken. */
export const MEASURED: L = { en: 'October 26, 2026', es: '26 de octubre de 2026', zh: '2026年10月26日' };

/** `npx vitest run --reporter=json`, its tests by where they are. */
export const TESTS: { where: L; count: number; what: L }[] = [
  {
    where: { en: 'packages/core', es: 'packages/core', zh: 'packages/core' },
    count: 394,
    what: {
      en: 'Import and export, layout, tables, lists, notes, sections, tracked changes, versions, templates, PDF and its tags, fonts, Chinese text.',
      es: 'Importar y exportar, composición, tablas, listas, notas, secciones, control de cambios, versiones, plantillas, PDF y sus etiquetas, fuentes, texto en chino.',
      zh: '导入与导出、排版、表格、列表、批注、分节、修订、版本、模板、PDF 及其标签、字体、中文文字。',
    },
  },
  {
    where: { en: 'packages/collab', es: 'packages/collab', zh: 'packages/collab' },
    count: 111,
    what: {
      en: 'The change format, two sessions converging, an editor’s sync and a room on their own, reconnection, folding with people in, keys and limits, the server and its backend.',
      es: 'El formato de los cambios, dos sesiones que convergen, la sincronización de un editor y una sala por separado, la reconexión, el pliegue con gente dentro, claves y límites, el servidor y su backend.',
      zh: '更改格式、两个会话的收敛、编辑器同步与房间各自的行为、重新连接、有人时的合并、密钥与限制、服务器及其后端。',
    },
  },
  {
    where: { en: 'packages/mcp', es: 'packages/mcp', zh: 'packages/mcp' },
    count: 100,
    what: {
      en: 'The tools for an assistant, its server, and its chat against a Claude of the tests’ own.',
      es: 'Las herramientas para un asistente, su servidor, y su chat contra un Claude propio de las pruebas.',
      zh: 'AI 助手的工具、其服务器，以及针对测试自带的模拟 Claude 的聊天。',
    },
  },
  {
    where: { en: 'packages/editor', es: 'packages/editor', zh: 'packages/editor' },
    count: 32,
    what: {
      en: 'The texts of the interface, what a screen reader is told, the words spelling checks, the contrast of the dark theme, and tables pasted from Word.',
      es: 'Los textos de la interfaz, lo que se le dice a un lector de pantalla, las palabras que revisa la ortografía, el contraste del tema oscuro, y las tablas pegadas desde Word.',
      zh: '界面文本、告诉屏幕阅读器的内容、拼写检查的词、深色主题的对比度，以及从 Word 粘贴的表格。',
    },
  },
  {
    where: { en: 'packages/editor, in Chrome', es: 'packages/editor, en Chrome', zh: 'packages/editor（Chrome 中）' },
    count: 66,
    what: {
      en: 'The editor itself, on a page: keys, the mouse, touch, the clipboard and pictures pasted from Word, keyboards that compose, the pages drawn, the files it makes, spelling, pictures and tables taken hold of; its toolbar, side panel and status bar.',
      es: 'El propio editor, en una página: teclas, el ratón, el tacto, el portapapeles e imágenes pegadas desde Word, teclados que componen, las páginas dibujadas, los archivos que genera, la ortografía, imágenes y tablas tomadas con el ratón; su barra de herramientas, su panel lateral y su barra de estado.',
      zh: '编辑器本身在页面中的表现：按键、鼠标、触摸、剪贴板及从 Word 粘贴的图片、输入法、页面绘制、生成的文件、拼写检查、对图片和表格的拖动操作，以及工具栏、侧边面板和状态栏。',
    },
  },
  {
    where: { en: 'packages/viewer, in Chrome', es: 'packages/viewer, en Chrome', zh: 'packages/viewer（Chrome 中）' },
    count: 10,
    what: {
      en: 'The viewer read only, its bar and the page in view, both layouts, printing, the bytes of a .docx, and thumbnails with their pictures.',
      es: 'El visor de solo lectura, su barra y la página a la vista, las dos disposiciones, la impresión, los bytes de un .docx, y las miniaturas con sus imágenes.',
      zh: '只读查看器、其工具栏和当前页面、两种布局、打印、.docx 的字节，以及带图片的缩略图。',
    },
  },
  {
    where: { en: 'apps/storage', es: 'apps/storage', zh: 'apps/storage' },
    count: 12,
    what: {
      en: 'The backend of the storage demo, on a bucket kept in memory.',
      es: 'El backend del demo de almacenamiento, sobre un bucket en memoria.',
      zh: '存储演示的后端，使用内存中的存储桶。',
    },
  },
  {
    where: { en: 'apps/realtime', es: 'apps/realtime', zh: 'apps/realtime' },
    count: 12,
    what: {
      en: 'The backend of the real-time demo: two people typing through its three routes.',
      es: 'El backend del demo en tiempo real: dos personas escribiendo a través de sus tres rutas.',
      zh: '实时演示的后端：两个人通过它的三个路由输入。',
    },
  },
];

/** Of every line Word wrote in the documents measured, how many are where Word puts them, in percent with one decimal. */
export const linesLikeWord = (): number => {
  const [same, all] = AGAINST_WORD.reduce(([a, b], row) => [a + row.lines[0], b + row.lines[1]], [0, 0]);
  return Math.floor((same / all) * 1000) / 10;
};

/**
 * `npm run word-check`: the documents of test-documents/, against the PDF Word for Mac made of each, kept
 * beside them. The float-* ones are made by `npm run float-cases` and the contract-* ones by
 * `npm run contract-cases`, with these names; none comes from a real document.
 */
export const AGAINST_WORD: { name: string; what: L; pages: [number, number]; lines: [number, number]; apart: number }[] = [
  {
    name: 'contract-times-justified',
    what: {
      en: '28 clauses in Times New Roman, justified, at 1.15 lines',
      es: '28 cláusulas en Times New Roman, justificadas, a 1,15 líneas',
      zh: '28 条条款，Times New Roman，两端对齐，1.15 倍行距',
    },
    pages: [7, 7],
    lines: [230, 230],
    apart: 0.8,
  },
  {
    name: 'contract-georgia-lists',
    what: {
      en: 'Numbered obligations in Georgia, lettered items under each',
      es: 'Obligaciones numeradas en Georgia, con incisos con letras debajo de cada una',
      zh: 'Georgia 字体的编号义务条款，每条下有字母编号的子项',
    },
    pages: [5, 5],
    lines: [166, 166],
    apart: 0.8,
  },
  {
    name: 'contract-verdana-tables',
    what: {
      en: 'A table of 60 payments in Verdana over two pages, its heading on each, and the signatures',
      es: 'Una tabla de 60 pagos en Verdana en dos páginas, con su encabezado en cada una, y las firmas',
      zh: 'Verdana 字体的 60 笔付款表格，跨两页，每页都有表头，以及签名',
    },
    pages: [2, 2],
    lines: [71, 71],
    apart: 0.6,
  },
  {
    name: 'contract-arial-sections',
    what: {
      en: 'A contract upright and its annex across the page, in Arial, with other margins',
      es: 'Un contrato en vertical y su anexo en horizontal, en Arial, con otros márgenes',
      zh: 'Arial 字体的纵向合同及其横向附件，页边距不同',
    },
    pages: [5, 5],
    lines: [150, 150],
    apart: 0.5,
  },
  {
    name: 'contract-times-columns',
    what: {
      en: 'Clauses across the page and a glossary in two columns, in Times New Roman',
      es: 'Cláusulas a todo lo ancho y un glosario en dos columnas, en Times New Roman',
      zh: 'Times New Roman 字体的通栏条款和两栏术语表',
    },
    pages: [3, 3],
    lines: [101, 101],
    apart: 0.7,
  },
  {
    name: 'contract-times-endnotes',
    what: {
      en: 'Endnotes in Times New Roman, after the last clause, under their line',
      es: 'Notas al final en Times New Roman, después de la última cláusula, bajo su línea',
      zh: 'Times New Roman 字体的尾注，位于最后一条之后的分隔线下',
    },
    pages: [3, 3],
    lines: [87, 87],
    apart: 0.8,
  },
  {
    name: 'contract-times-endnotes-long',
    what: {
      en: 'Endnotes that go on to a page of their own, one cut across the two',
      es: 'Notas al final que pasan a una página propia, una cortada entre las dos',
      zh: '延续到单独一页的尾注，其中一条跨两页',
    },
    pages: [4, 4],
    lines: [144, 144],
    apart: 0.8,
  },
  {
    name: 'contract-times-endnotes-sections',
    what: {
      en: 'Endnotes at the end of each section: one section leaves its own to the next',
      es: 'Notas al final de cada sección: una sección deja las suyas a la siguiente',
      zh: '每节末尾的尾注：其中一节把自己的尾注留给下一节',
    },
    pages: [5, 5],
    lines: [126, 126],
    apart: 0.8,
  },
  {
    name: 'contract-arial-tables',
    what: {
      en: 'Tables in every way Word makes them: merged, apart, beside the text, inside a cell, on their side',
      es: 'Tablas de todas las formas en que las hace Word: combinadas, separadas, junto al texto, dentro de una celda, de lado',
      zh: 'Word 生成的各种表格：合并单元格、分开、文字环绕、单元格嵌套、竖排',
    },
    pages: [4, 4],
    lines: [154, 154],
    apart: 1.8,
  },
  {
    name: 'contract-arial-keep',
    what: {
      en: 'Paragraphs kept whole, headings kept with their text and a clause that starts a page, in Arial',
      es: 'Párrafos conservados enteros, títulos con su texto y una cláusula que empieza página, en Arial',
      zh: 'Arial 字体：段中不分页、标题与正文同页、从新页开始的条款',
    },
    pages: [6, 6],
    lines: [192, 192],
    apart: 0.7,
  },
  {
    name: 'float-brochure',
    what: {
      en: 'A brochure of two pages, its pictures on either side and across the page',
      es: 'Un folleto de dos páginas, con sus imágenes a cada lado y a todo lo ancho',
      zh: '两页的宣传册，图片位于两侧或通栏',
    },
    pages: [1, 3],
    lines: [70, 90],
    apart: 1.0,
  },
  {
    name: 'float-reach',
    what: { en: 'How far under its text a line is still beside a picture', es: 'Hasta dónde bajo su texto una línea sigue junto a una imagen', zh: '文字下方多远的行仍算在图片旁边' },
    pages: [2, 2],
    lines: [40, 40],
    apart: 0.5,
  },
  {
    name: 'float-top-and-bottom',
    what: { en: 'The whole width left free, with and without room round it', es: 'Todo el ancho libre, con y sin espacio alrededor', zh: '整个宽度留空，带或不带周围间距' },
    pages: [2, 2],
    lines: [33, 33],
    apart: 0.5,
  },
  {
    name: 'float-edges',
    what: { en: 'Which lines are beside a picture, at its top and bottom edges', es: 'Qué líneas están junto a una imagen, en sus bordes de arriba y abajo', zh: '图片上下边缘处哪些行算在图片旁边' },
    pages: [0, 2],
    lines: [24, 35],
    apart: 0.5,
  },
  {
    name: 'float-relative-to',
    what: {
      en: 'Measured from the page and from its margins, or put at a side by name',
      es: 'Medida desde la página y desde sus márgenes, o puesta a un lado por nombre',
      zh: '相对页面或页边距定位，或按名称放在某一侧',
    },
    pages: [2, 2],
    lines: [47, 47],
    apart: 0.5,
  },
  {
    name: 'float-both-sides',
    what: {
      en: 'In the middle of the column, text down both sides; then at each edge',
      es: 'En medio de la columna, con texto por ambos lados; luego en cada borde',
      zh: '位于栏中间、两侧都有文字；然后分别位于两边',
    },
    pages: [1, 1],
    lines: [37, 37],
    apart: 0.5,
  },
  { name: 'float-in-front', what: { en: 'Over the text and under it', es: 'Sobre el texto y bajo él', zh: '位于文字上方和下方' }, pages: [1, 1], lines: [20, 20], apart: 0.5 },
  {
    name: 'float-narrow',
    what: {
      en: 'Little room on one side: how narrow a stretch Word still writes in',
      es: 'Poco espacio a un lado: qué tan estrecho es el tramo en que Word todavía escribe',
      zh: '一侧空间很小：Word 仍会在多窄的区域里写字',
    },
    pages: [0, 2],
    lines: [37, 47],
    apart: 0.5,
  },
  {
    name: 'float-page-end',
    what: { en: 'Near the foot of a page, and taller than what is left of it', es: 'Cerca del pie de una página, y más alta que lo que queda de ella', zh: '靠近页面底部，且高于页面剩余空间' },
    pages: [3, 3],
    lines: [74, 74],
    apart: 0.5,
  },
  {
    name: 'float-sides',
    what: { en: 'Told which side the text may go down', es: 'Indicado por qué lado puede bajar el texto', zh: '指定文字可以沿哪一侧排列' },
    pages: [2, 2],
    lines: [42, 42],
    apart: 0.5,
  },
  {
    name: 'float-least-room',
    what: { en: 'Short words: the least room Word writes in', es: 'Palabras cortas: el menor espacio en que escribe Word', zh: '短词：Word 写字所需的最小空间' },
    pages: [2, 2],
    lines: [60, 60],
    apart: 0.5,
  },
  {
    name: 'float-mid-paragraph',
    what: { en: 'Anchored in the middle of a paragraph, with other line spacings', es: 'Anclada en medio de un párrafo, con otros interlineados', zh: '锚定在段落中间，使用不同的行距' },
    pages: [2, 2],
    lines: [47, 47],
    apart: 0.5,
  },
  {
    name: 'float-table-and-header',
    what: { en: 'In a cell of a table, and in the header', es: 'En una celda de una tabla, y en el encabezado', zh: '位于表格单元格中和页眉中' },
    pages: [1, 1],
    lines: [33, 33],
    apart: 0.5,
  },
];
