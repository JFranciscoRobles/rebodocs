// What the page "On a server: DOCX and PDF" says that is data, each checked in
// packages/core/src (docx/, render.ts, fonts.ts, pdf.ts, markdown.ts,
// layout.ts, blocks.ts and the modules of CATALOG) and packages/mcp/src/generate.ts.
// Each text in each language of the site; the signatures are code, the same in all.

import type { L } from '@/lib/i18n';

/** The calls a server makes, in the order it makes them. */
export const CALLS: { sig: string; text: L }[] = [
  {
    sig: 'importDocx(bytes, { maxSize? }) → Doc',
    text: {
      en: 'A DOCX as a document. What the engine does not understand is kept, to be written back as it was. It throws for a file that is not a DOCX, and for one that says it takes more than maxSize unpacked (256 MB when not given).',
      es: 'Un DOCX como documento. Lo que el motor no entiende se conserva, para escribirlo de vuelta tal como estaba. Lanza un error con un archivo que no es DOCX, y con uno que dice ocupar más de maxSize descomprimido (256 MB si no se da).',
      zh: '把 DOCX 读成文档。引擎不理解的内容会被保留，以便原样写回。如果文件不是 DOCX，或声明解压后超过 maxSize（默认 256 MB），会抛出错误。',
    },
  },
  {
    sig: 'fillVariables(doc, data, { locale?, currency?, today? }) → Doc',
    text: {
      en: "The {{variables}} of a template filled, with their formats (upper, currency, long date…), and its blocks written out: {{#lines}} … {{/lines}} once for each item of a list, kept or taken out for true or false. data is the JSON your application has, nested objects and all. locale writes values in a language ('es-MX': 21 de octubre de 2026); without it, in the language of the document, or in English when it says none.",
      es: "Las {{variables}} de una plantilla llenas, con sus formatos (mayúsculas, moneda, fecha larga…), y sus bloques desarrollados: {{#lineas}} … {{/lineas}} una vez por cada elemento de una lista, conservados o quitados con true o false. data es el JSON que tiene tu aplicación, con objetos anidados y todo. locale escribe los valores en un idioma ('es-MX': 21 de octubre de 2026); sin él, en el idioma del documento, o en inglés cuando no dice ninguno.",
      zh: "填写模板中的 {{变量}}（按其格式：大写、货币、长日期…），并展开区块：{{#明细}} … {{/明细}} 为列表中的每一项写一次，或根据 true/false 保留或移除。data 就是你的应用已有的 JSON，包括嵌套对象。locale 指定值的书写语言（'zh-CN'：2026年10月21日）；不指定时按文档语言，文档未声明语言时使用英文。",
    },
  },
  {
    sig: 'exportDocx(doc) → Uint8Array',
    text: {
      en: 'The document as a DOCX. One opened and saved untouched comes out with the same XML.',
      es: 'El documento como DOCX. Uno abierto y guardado sin tocar sale con el mismo XML.',
      zh: '把文档输出为 DOCX。打开后未修改直接保存的文档，XML 与原来完全相同。',
    },
  },
  {
    sig: 'readFont(bytes) → FontFile | undefined',
    text: {
      en: 'A .ttf or .otf file, read for its family, weight and widths; of a collection (.ttc), its first face. Undefined for one that is not a font it reads.',
      es: 'Un archivo .ttf u .otf, leído por su familia, peso y anchos; de una colección (.ttc), su primer estilo. Undefined para uno que no es una fuente que lea.',
      zh: '读取 .ttf 或 .otf 文件的字体族、字重和字宽；对于字体集合（.ttc）读取第一个字形。无法识别的文件返回 undefined。',
    },
  },
  {
    sig: 'readFonts(bytes) → FontFile[]',
    text: {
      en: 'Every face of a file: each of a collection, as macOS keeps Helvetica, made a font of its own.',
      es: 'Cada estilo de un archivo: cada uno de una colección, como guarda macOS Helvetica, convertido en una fuente propia.',
      zh: '读取文件中的每个字形：字体集合（例如 macOS 保存 Helvetica 的方式）中的每个字形都会成为一个独立的字体。',
    },
  },
  {
    sig: 'renderPdf(doc, fonts, title?, language?) → { pdf, layout, missingFonts, missingPictures }',
    text: {
      en: 'The document laid out with those fonts and drawn as a tagged PDF: the layout it used, the families it had to stand in for, and how many pictures it could not draw. The language (es-MX) is the one the file says when not given.',
      es: 'El documento maquetado con esas fuentes y dibujado como un PDF etiquetado: la maquetación que usó, las familias que tuvo que sustituir, y cuántas imágenes no pudo dibujar. El idioma (es-MX) es el que dice el archivo si no se da.',
      zh: '用这些字体排版文档并绘制为带标签的 PDF：返回所用的排版、被替代的字体族，以及无法绘制的图片数量。未指定语言（如 zh-CN）时使用文件中声明的语言。',
    },
  },
  {
    sig: 'exportMarkdown(doc, { changes? }) → string',
    text: {
      en: 'Headings, emphasis, lists, links and tables as Markdown. No fonts, colours or pictures: for a language model, or an index. Tracked changes come accepted; or as before them (original), or marked [-taken out-]{+put in+} (marked).',
      es: 'Títulos, énfasis, listas, enlaces y tablas como Markdown. Sin fuentes, colores ni imágenes: para un modelo de lenguaje, o un índice. El control de cambios sale aceptado; o como antes de ellos (original), o marcado [-quitado-]{+puesto+} (marked).',
      zh: '把标题、强调、列表、链接和表格输出为 Markdown。不含字体、颜色和图片：适合交给语言模型或建立索引。修订默认为已接受；也可以输出修订前的版本（original），或带标记 [-删除-]{+插入+}（marked）。',
    },
  },
  {
    sig: 'layoutDocument(doc, measurer) → Layout',
    text: {
      en: 'Pages and lines, without drawing them. The measurer is anything that tells the width of a text and the height of a font.',
      es: 'Páginas y líneas, sin dibujarlas. El medidor es cualquier cosa que diga el ancho de un texto y la altura de una fuente.',
      zh: '计算页面和行，但不绘制。measurer 可以是任何能告诉文字宽度和字体高度的对象。',
    },
  },
];

/** What goes into the PDF, from render.ts and pdf.ts. */
export const PDF_FACTS: { title: L; text: L }[] = [
  {
    title: { en: 'Fonts inside', es: 'Fuentes dentro', zh: '嵌入字体' },
    text: {
      en: 'TrueType ones cut down to the characters used; OpenType ones in CFF whole. The text can be selected and searched.',
      es: 'Las TrueType recortadas a los caracteres usados; las OpenType en CFF completas. El texto se puede seleccionar y buscar.',
      zh: 'TrueType 字体只嵌入用到的字符；CFF 格式的 OpenType 字体完整嵌入。文字可以选中和搜索。',
    },
  },
  {
    title: { en: 'Its own fonts first', es: 'Sus propias fuentes primero', zh: '优先使用自带字体' },
    text: {
      en: 'Fonts the DOCX carries inside are used by themselves, before the ones you give: they are the ones it was written with.',
      es: 'Las fuentes que lleva dentro el DOCX se usan solas, antes que las que das: son con las que se escribió.',
      zh: 'DOCX 内嵌的字体会被自动使用，优先于你提供的字体：因为文档就是用它们写的。',
    },
  },
  {
    title: { en: 'Stand-ins', es: 'Sustitutos', zh: '替代字体' },
    text: {
      en: 'A family you did not give is set in one of its kind you did (for a sans: Arial, Liberation Sans, Helvetica, DejaVu Sans; for a serif, Times New Roman and its likes; for a mono, Courier New), else in the first you gave, in the face of its style, and named in missingFonts.',
      es: 'Una familia que no diste se compone con una de su tipo que sí diste (para una sans: Arial, Liberation Sans, Helvetica, DejaVu Sans; para una serif, Times New Roman y similares; para una mono, Courier New), si no con la primera que diste, en el estilo que corresponde, y se nombra en missingFonts.',
      zh: '未提供的字体族会用你提供的同类字体替代（无衬线：Arial、Liberation Sans、Helvetica、DejaVu Sans；衬线：Times New Roman 等；等宽：Courier New），否则使用你提供的第一个字体的相应字形，并在 missingFonts 中列出。',
    },
  },
  {
    title: { en: 'Chinese', es: 'Chino', zh: '中文' },
    text: {
      en: 'A Chinese character the font has not is drawn in the font for Chinese the document names (w:eastAsia), when you give it, or else in the one every PDF reader has: STSong-Light, or MSung-Light for Taiwan and Hong Kong.',
      es: 'Un carácter chino que la fuente no tiene se dibuja con la fuente para chino que nombra el documento (w:eastAsia), cuando la das, o si no con la que tiene todo lector de PDF: STSong-Light, o MSung-Light para Taiwán y Hong Kong.',
      zh: '字体中没有的中文字符，会使用文档指定的中文字体（w:eastAsia，需由你提供）绘制；否则使用所有 PDF 阅读器都内置的字体：STSong-Light，台湾和香港则为 MSung-Light。',
    },
  },
  {
    title: { en: 'Pictures', es: 'Imágenes', zh: '图片' },
    text: {
      en: 'PNG of 8 or 16 bits to the sample, GIF (its first frame), and JPEG, which goes in as it is. Any other is left out and counted in missingPictures.',
      es: 'PNG de 8 o 16 bits por muestra, GIF (su primer cuadro), y JPEG, que entra tal cual. Cualquier otra se deja fuera y se cuenta en missingPictures.',
      zh: '支持每通道 8 位或 16 位的 PNG、GIF（第一帧）以及原样嵌入的 JPEG。其他格式会被忽略，并计入 missingPictures。',
    },
  },
];

/** generate.ts in packages/mcp. */
export const CLI: { flag: string; text: L }[] = [
  { flag: 'template.docx', text: { en: 'The template.', es: 'La plantilla.', zh: '模板。' } },
  {
    flag: 'data.json',
    text: {
      en: 'Its values. Nested objects give dotted names: { "client": { "name": "Ana" } } fills {{client.name}}; a list fills a block, {{#lines}} … {{/lines}}.',
      es: 'Sus valores. Los objetos anidados dan nombres con puntos: { "cliente": { "nombre": "Ana" } } llena {{cliente.nombre}}; una lista llena un bloque, {{#lineas}} … {{/lineas}}.',
      zh: '模板的值。嵌套对象对应带点的名称：{ "客户": { "姓名": "王芳" } } 填写 {{客户.姓名}}；列表用于填写区块 {{#明细}} … {{/明细}}。',
    },
  },
  { flag: '-o out.pdf | out.docx | out.md', text: { en: 'What to make, by its extension.', es: 'Qué hacer, según su extensión.', zh: '按扩展名决定输出格式。' } },
  {
    flag: '--fonts folder',
    text: {
      en: 'Where the .ttf, .otf and .ttc files are, for a PDF; more than one may be given. Then those of the system.',
      es: 'Dónde están los archivos .ttf, .otf y .ttc, para un PDF; se puede dar más de una. Luego las del sistema.',
      zh: '生成 PDF 时 .ttf、.otf 和 .ttc 文件所在的目录；可以指定多个。之后使用系统字体。',
    },
  },
  {
    flag: '--locale en-US · --currency EUR',
    text: {
      en: 'The language dates and numbers are written in, and the currency of currency. Left out, the language of the document (or English) and a dollar sign.',
      es: 'El idioma en que se escriben las fechas y los números, y la moneda de currency. Si no se dan, el idioma del documento (o inglés) y un signo de pesos.',
      zh: '日期和数字的书写语言，以及 currency 格式使用的货币。不指定时使用文档语言（或英文）和美元符号。',
    },
  },
  {
    flag: '--list',
    text: {
      en: 'Only the names of the variables of the template, one a line, and its blocks.',
      es: 'Solo los nombres de las variables de la plantilla, uno por línea, y sus bloques.',
      zh: '只列出模板中的变量名称（每行一个）及其区块。',
    },
  },
];

/** Where @rebodocs/core runs: it uses no API of Node (no node:, Buffer or process), only the language and Intl. */
export const RUNTIMES: { title: L; text: L }[] = [
  {
    title: { en: 'Node', es: 'Node', zh: 'Node' },
    text: {
      en: 'Any version still supported; it is tested on 22. Read templates and fonts with fs, once, when the server starts.',
      es: 'Cualquier versión con soporte; se prueba en la 22. Lee las plantillas y fuentes con fs, una vez, al arrancar el servidor.',
      zh: '任何仍受支持的版本；在 22 上测试。在服务器启动时用 fs 读取一次模板和字体。',
    },
  },
  { title: { en: 'Deno and Bun', es: 'Deno y Bun', zh: 'Deno 与 Bun' }, text: { en: 'The same package, from npm.', es: 'El mismo paquete, desde npm.', zh: '同一个 npm 软件包。' } },
  {
    title: { en: 'Workers and the edge', es: 'Workers y el edge', zh: 'Workers 与边缘计算' },
    text: {
      en: 'Cloudflare Workers, Vercel and Netlify Edge: there is no disk, so templates and fonts come as bytes, bundled or fetched.',
      es: 'Cloudflare Workers, Vercel y Netlify Edge: no hay disco, así que las plantillas y fuentes llegan como bytes, empaquetadas o descargadas.',
      zh: 'Cloudflare Workers、Vercel 和 Netlify Edge：没有磁盘，因此模板和字体以字节形式提供，打包进来或通过 fetch 获取。',
    },
  },
  {
    title: { en: 'The browser', es: 'El navegador', zh: '浏览器' },
    text: {
      en: 'As on this page: the demo above makes its PDF without a server.',
      es: 'Como en esta página: la demo de arriba hace su PDF sin servidor.',
      zh: '就像本页面一样：上面的演示无需服务器即可生成 PDF。',
    },
  },
];

/** What @rebodocs/core does without an editor, by what it is for: the names, from its modules. */
export const CATALOG: { title: L; module: string; calls: string[] }[] = [
  {
    title: { en: 'Text', es: 'Texto', zh: '文字' },
    module: 'ops.ts, find.ts',
    calls: ['insertText', 'deleteRange', 'splitParagraph', 'findAll', 'replaceAll', 'replaceRange', 'textInRange', 'docText'],
  },
  {
    title: { en: 'Look', es: 'Aspecto', zh: '外观' },
    module: 'ops.ts, styles.ts',
    calls: ['applyRunProps', 'setParagraphProps', 'setParagraphStyle', 'toggleList', 'setListStyle', 'restartNumbering'],
  },
  {
    title: { en: 'Tables', es: 'Tablas', zh: '表格' },
    module: 'tables.ts',
    calls: ['insertTable', 'insertRow', 'deleteRow', 'insertColumn', 'mergeCells', 'setCellProps', 'setHeaderRow', 'insertSignatures'],
  },
  { title: { en: 'Pictures', es: 'Imágenes', zh: '图片' }, module: 'images.ts', calls: ['insertImage', 'insertImageGrid', 'resizePicture', 'setPictureWrap', 'imageTypeOf'] },
  {
    title: { en: 'Page', es: 'Página', zh: '页面' },
    module: 'sections.ts, pageNumbers.ts',
    calls: ['setSectionPage', 'insertSectionBreak', 'setColumns', 'setPageNumbering', 'setOwnFirstPage', 'setEndnotesAt', 'setNoteNumbering'],
  },
  {
    title: { en: 'Links and contents', es: 'Enlaces y contenido', zh: '链接与目录' },
    module: 'links.ts, toc.ts, footnotes.ts',
    calls: ['insertLink', 'setLink', 'insertToc', 'updateToc', 'insertFootnote', 'insertEndnote'],
  },
  {
    title: { en: 'Review', es: 'Revisión', zh: '审阅' },
    module: 'revisions.ts, notes.ts',
    calls: ['revisionsOf', 'acceptRevisions', 'rejectRevisions', 'decideAllRevisions', 'addNote', 'removeNote', 'removeAllNotes'],
  },
  { title: { en: 'Versions', es: 'Versiones', zh: '版本' }, module: 'versions.ts', calls: ['compareDocs', 'describeChange', 'restoreVersion'] },
  { title: { en: 'Letterhead', es: 'Membrete', zh: '信头' }, module: 'letterhead.ts', calls: ['setLetterhead', 'removeLetterhead', 'pngLetterheadMargins', 'withLetterheadMargins'] },
  { title: { en: 'Templates', es: 'Plantillas', zh: '模板' }, module: 'variables.ts, blocks.ts', calls: ['variableNames', 'templateBlocks', 'fillVariables', 'variableProblems', 'formatValue'] },
];

/** What a PDF made here has, and what it has not, from pdf.ts and render.ts. */
export const PDF_HAS: L[] = [
  {
    en: 'The fonts inside it, and text that can be selected, searched and copied.',
    es: 'Las fuentes dentro, y texto que se puede seleccionar, buscar y copiar.',
    zh: '嵌入的字体，以及可以选中、搜索和复制的文字。',
  },
  {
    en: 'Links that open: to an address, and inside the document to its bookmarks, as the entries of a table of contents do.',
    es: 'Enlaces que se abren: a una dirección, y dentro del documento a sus marcadores, como hacen las entradas de una tabla de contenido.',
    zh: '可点击的链接：指向网址，或在文档内部指向书签（目录条目就是这样）。',
  },
  {
    en: 'Headers, footers, page numbers, notes at the foot of the page and at the end, tables, columns, text boxes and letterheads, where the editor puts them.',
    es: 'Encabezados, pies, números de página, notas al pie y al final, tablas, columnas, cuadros de texto y membretes, donde los pone el editor.',
    zh: '页眉、页脚、页码、脚注和尾注、表格、分栏、文本框和信头，位置与编辑器中一致。',
  },
  {
    en: 'Chinese text, in the font for Chinese of the document or the one every reader has.',
    es: 'Texto en chino, con la fuente para chino del documento o la que tiene todo lector.',
    zh: '中文文字，使用文档的中文字体或所有阅读器都内置的中文字体。',
  },
  { en: 'Its title, the one given to renderPdf, and its language.', es: 'Su título, el que se da a renderPdf, y su idioma.', zh: '传给 renderPdf 的标题，以及语言。' },
  {
    en: 'Tags for screen readers: headings, lists, tables, notes, links, and pictures with their description. See Accessibility.',
    es: 'Etiquetas para lectores de pantalla: títulos, listas, tablas, notas, enlaces, e imágenes con su descripción. Ve Accesibilidad.',
    zh: '供屏幕阅读器使用的标签：标题、列表、表格、注释、链接，以及带描述的图片。参见“无障碍”。',
  },
  { en: 'The headings as bookmarks in the side bar of the reader.', es: 'Los títulos como marcadores en la barra lateral del lector.', zh: '标题会作为书签显示在阅读器的侧栏中。' },
];
export const PDF_HAS_NOT: L[] = [
  {
    en: 'PDF/A for archiving, forms to fill, a password or a signature.',
    es: 'PDF/A para archivo, formularios para llenar, una contraseña o una firma.',
    zh: '用于归档的 PDF/A、可填写的表单、密码或数字签名。',
  },
  { en: 'Author, subject or keywords.', es: 'Autor, asunto o palabras clave.', zh: '作者、主题或关键词。' },
];

/** Measured on an Apple M1 with Node 22: a template of the receipt below, its block repeated, the median of seven runs, with the fonts already read. */
export const SPEED: { pages: number; fill: string; docx: string; pdf: string; size: string }[] = [
  { pages: 1, fill: '1 ms', docx: '0.6 ms', pdf: '3 ms', size: '12 KB' },
  { pages: 6, fill: '7 ms', docx: '0.9 ms', pdf: '17 ms', size: '25 KB' },
  { pages: 30, fill: '26 ms', docx: '3 ms', pdf: '77 ms', size: '81 KB' },
];
