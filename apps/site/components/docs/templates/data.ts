// What the page "Templates and variables" says that is data, each checked in
// packages/core/src/variables.ts, blocks.ts and tables.ts (insertSignatures),
// packages/editor/src/editor.ts and panel.ts, and packages/mcp/src/tools.ts.
// Each text in each language of the site; the signatures are code, the same in all.

import type { FormatId, TemplateData } from '@rebodocs/core';
import type { L } from '@/lib/i18n';

/** The line at the top of the page, in each language, with its values and the language they are written in: filled by fillVariables when the site is built. */
export const LINE: L<{ text: string; values: TemplateData; locale: string }> = {
  en: {
    text: 'Received from {{client | capital}} the amount of {{amount | currency}} on {{date | long date}}.',
    values: { client: 'ana pérez', amount: '2500', date: '2026-10-13' },
    locale: 'en-US',
  },
  es: {
    text: 'Recibí de {{cliente | nombre propio}} la cantidad de {{importe | moneda}} el {{fecha | fecha larga}}.',
    values: { cliente: 'ana pérez', importe: '2500', fecha: '2026-10-13' },
    locale: 'es-MX',
  },
  zh: {
    text: '今收到{{客户}}交来{{金额 | 货币: CNY}}，日期为{{日期 | 长日期}}。',
    values: { 客户: '王芳', 金额: '2500', 日期: '2026-10-13' },
    locale: 'zh-CN',
  },
};

/** The example of blocks, in each language: a template of paragraphs and the data that fills it. */
export const ORDER: L<{ lines: string[]; data: TemplateData; locale: string }> = {
  en: {
    lines: [
      'Order {{number}} for {{client.name}}{{#client.vip}} (priority){{/client.vip}}',
      '{{#lines}}',
      '{{lines.qty}} × {{lines.item}}: {{lines.price | currency}}',
      '{{/lines}}',
      '{{^lines}}',
      'Nothing ordered yet.',
      '{{/lines}}',
    ],
    data: {
      number: 18,
      client: { name: 'Ana Pérez', vip: true },
      lines: [
        { qty: 2, item: 'Desk lamp', price: 45 },
        { qty: 1, item: 'Chair', price: 120 },
      ],
    },
    locale: 'en-US',
  },
  es: {
    lines: [
      'Pedido {{numero}} para {{cliente.nombre}}{{#cliente.vip}} (prioridad){{/cliente.vip}}',
      '{{#lineas}}',
      '{{lineas.cantidad}} × {{lineas.articulo}}: {{lineas.precio | moneda}}',
      '{{/lineas}}',
      '{{^lineas}}',
      'Todavía no hay nada pedido.',
      '{{/lineas}}',
    ],
    data: {
      numero: 18,
      cliente: { nombre: 'Ana Pérez', vip: true },
      lineas: [
        { cantidad: 2, articulo: 'Lámpara de escritorio', precio: 45 },
        { cantidad: 1, articulo: 'Silla', precio: 120 },
      ],
    },
    locale: 'es-MX',
  },
  zh: {
    lines: [
      '订单 {{编号}}，客户：{{客户.姓名}}{{#客户.会员}}（优先处理）{{/客户.会员}}',
      '{{#明细}}',
      '{{明细.数量}} × {{明细.商品}}：{{明细.价格 | 货币: CNY}}',
      '{{/明细}}',
      '{{^明细}}',
      '尚未订购任何商品。',
      '{{/明细}}',
    ],
    data: {
      编号: 18,
      客户: { 姓名: '王芳', 会员: true },
      明细: [
        { 数量: 2, 商品: '台灯', 价格: 45 },
        { 数量: 1, 商品: '椅子', 价格: 120 },
      ],
    },
    locale: 'zh-CN',
  },
};

/** How a variable is read, from VARIABLE and findVariables in variables.ts. */
export const RULES: { title: L; text: L }[] = [
  {
    title: { en: 'The name', es: 'El nombre', zh: '名称' },
    text: {
      en: 'Letters of any language, digits and underscores, and then also spaces, dots and dashes: {{client}}, {{client.name}}, {{fecha de firma}}, {{客户}}. Spaces inside the braces are left out: {{ client }} is {{client}}.',
      es: 'Letras de cualquier idioma, dígitos y guiones bajos, y después también espacios, puntos y guiones: {{cliente}}, {{cliente.nombre}}, {{fecha de firma}}, {{客户}}. Los espacios dentro de las llaves se ignoran: {{ cliente }} es {{cliente}}.',
      zh: '可以使用任何语言的文字、数字和下划线，之后还可以有空格、点和连字符：{{客户}}、{{客户.姓名}}、{{签约日期}}、{{client}}。花括号内首尾的空格会被忽略：{{ 客户 }} 等同于 {{客户}}。',
    },
  },
  {
    title: { en: 'Formats', es: 'Formatos', zh: '格式' },
    text: {
      en: 'Each after a bar, and applied from left to right: {{date | long date | upper}} writes the date, then puts it in capitals. A format it does not know is left out, and variableProblems names it.',
      es: 'Cada uno después de una barra, y aplicados de izquierda a derecha: {{fecha | fecha larga | mayúsculas}} escribe la fecha, y luego la pone en mayúsculas. Un formato que no conoce se omite, y variableProblems lo nombra.',
      zh: '每个格式写在竖线之后，从左到右依次应用：{{日期 | 长日期 | 大写}} 先写出日期，再转为大写。不认识的格式会被忽略，并由 variableProblems 指出。',
    },
  },
  {
    title: { en: 'Its look', es: 'Su aspecto', zh: '外观' },
    text: {
      en: 'The value takes the formatting of the text it stands in: a bold {{client}} is filled with a bold name. Word often breaks a word into pieces of the same look; the variable is found all the same.',
      es: 'El valor toma el formato del texto donde está: un {{cliente}} en negrita se llena con un nombre en negrita. Word a menudo parte una palabra en pedazos del mismo aspecto; la variable se encuentra igual.',
      zh: '值会沿用所在文字的格式：加粗的 {{客户}} 填写后，名字也是加粗的。Word 经常把一个词拆成外观相同的几段，变量依然能被找到。',
    },
  },
  {
    title: { en: 'Where', es: 'Dónde', zh: '位置' },
    text: {
      en: 'The text and its tables, every header and footer (the first page’s and each section’s among them), the notes at the foot of the page and the text boxes.',
      es: 'El texto y sus tablas, cada encabezado y pie (incluidos los de la primera página y los de cada sección), las notas al pie y los cuadros de texto.',
      zh: '正文及其表格、所有页眉页脚（包括首页和各节的页眉页脚）、脚注以及文本框。',
    },
  },
  {
    title: { en: 'Tracked changes', es: 'Control de cambios', zh: '修订' },
    text: {
      en: 'Text taken out while changes are tracked is not part of a variable: what is read is what the document says. A variable put in while they were tracked gives its value as put in, by the same person.',
      es: 'El texto quitado mientras se registran los cambios no forma parte de una variable: lo que se lee es lo que dice el documento. Una variable puesta mientras se registraban da su valor como puesto, por la misma persona.',
      zh: '开启修订时删除的文字不属于变量：读取的是文档当前呈现的内容。在修订期间插入的变量，填写后的值也会作为同一个人插入的内容。',
    },
  },
  {
    title: { en: 'Not a variable', es: 'No es una variable', zh: '不是变量' },
    text: {
      en: '{single}, {{}}, or a name with a sign in it such as {{a}b}} stay as they are. So does a variable given no value; one given an empty value is taken away.',
      es: '{simple}, {{}}, o un nombre con un signo como {{a}b}} se quedan como están. Igual una variable a la que no se le da valor; una a la que se le da un valor vacío se quita.',
      zh: '{单括号}、{{}}，或包含符号的名称（如 {{a}b}}）都保持原样。没有提供值的变量也保持原样；提供空值的变量则会被移除。',
    },
  },
];

/** How a block is written, from blocks.ts: where its marks are says what it repeats. */
export const BLOCK_KINDS: { title: L; where: L; text: L }[] = [
  {
    title: { en: 'A row of a table', es: 'Una fila de una tabla', zh: '表格中的一行' },
    where: {
      en: '{{#lines}} in a cell, {{/lines}} in a cell of the same row',
      es: '{{#lineas}} en una celda, {{/lineas}} en una celda de la misma fila',
      zh: '{{#明细}} 在一个单元格中，{{/明细}} 在同一行的某个单元格中',
    },
    text: {
      en: 'The row is written once for each item: the lines of an invoice, the people of a contract. A list without items takes the row away.',
      es: 'La fila se escribe una vez por cada elemento: las líneas de una factura, las personas de un contrato. Una lista sin elementos quita la fila.',
      zh: '为每一项写出一行：发票的明细、合同的当事人。列表为空时该行会被移除。',
    },
  },
  {
    title: { en: 'Paragraphs', es: 'Párrafos', zh: '段落' },
    where: {
      en: '{{#annex}} and {{/annex}} each a paragraph of its own',
      es: '{{#anexo}} y {{/anexo}} cada uno en su propio párrafo',
      zh: '{{#附件}} 和 {{/附件}} 各自单独成段',
    },
    text: {
      en: 'What is between them, tables included, is written once for each item, or kept or taken away. The paragraphs of the marks go.',
      es: 'Lo que está entre ellos, tablas incluidas, se escribe una vez por cada elemento, o se conserva o se quita. Los párrafos de las marcas desaparecen.',
      zh: '两者之间的内容（包括表格）会为每一项写一次，或者保留、或者移除。标记所在的段落本身会被删除。',
    },
  },
  {
    title: { en: 'Text', es: 'Texto', zh: '文字' },
    where: { en: 'both marks in one paragraph', es: 'ambas marcas en un mismo párrafo', zh: '两个标记位于同一段落' },
    text: {
      en: 'The text between them: {{#vip}}, our valued member{{/vip}}, or {{#tags}}{{tags}}, {{/tags}} for a list of words.',
      es: 'El texto entre ellas: {{#vip}}, nuestro miembro distinguido{{/vip}}, o {{#etiquetas}}{{etiquetas}}, {{/etiquetas}} para una lista de palabras.',
      zh: '两者之间的文字：{{#会员}}，尊贵的会员{{/会员}}；或用 {{#标签}}{{标签}}、{{/标签}} 生成一串词语。',
    },
  },
];

export const BLOCK_RULES: { title: L; text: L }[] = [
  {
    title: { en: 'Lists', es: 'Listas', zh: '列表' },
    text: {
      en: 'An item that is an object gives its fields by the name of the block: {{lines.price}}. An item that is text is the name itself: {{tags}}. Blocks go inside blocks, {{#orders.lines}} inside {{#orders}}, each with its own item.',
      es: 'Un elemento que es un objeto da sus campos por el nombre del bloque: {{lineas.precio}}. Un elemento que es texto es el nombre mismo: {{etiquetas}}. Los bloques van dentro de bloques, {{#pedidos.lineas}} dentro de {{#pedidos}}, cada uno con su propio elemento.',
      zh: '对象类型的项通过区块名访问字段：{{明细.价格}}。文字类型的项直接用区块名表示：{{标签}}。区块可以嵌套，例如 {{#订单.明细}} 放在 {{#订单}} 内，各自对应自己的项。',
    },
  },
  {
    title: { en: 'Yes or no', es: 'Sí o no', zh: '是或否' },
    text: {
      en: 'A value that is not a list keeps the block once, or takes it away when it is false, empty, 0, "false" or "0", or a list without items. {{^name}} … {{/name}} is the other way round: for “nothing ordered”.',
      es: 'Un valor que no es una lista conserva el bloque una vez, o lo quita cuando es false, vacío, 0, "false" o "0", o una lista sin elementos. {{^nombre}} … {{/nombre}} es al revés: para “no se pidió nada”.',
      zh: '非列表的值会让区块保留一次；当值为 false、空、0、"false"、"0" 或空列表时则移除区块。{{^名称}} … {{/名称}} 正好相反：用于“尚未订购”之类的情况。',
    },
  },
  {
    title: { en: 'Not given', es: 'Sin valor', zh: '未提供' },
    text: {
      en: 'A block with no value stays as it is, marks and all, as a variable does: a document can be filled in steps.',
      es: 'Un bloque sin valor se queda como está, con sus marcas, igual que una variable: un documento se puede llenar por pasos.',
      zh: '没有值的区块会连同标记一起原样保留，与变量相同：文档可以分步填写。',
    },
  },
  {
    title: { en: 'What is not repeated', es: 'Lo que no se repite', zh: '不会重复的内容' },
    text: {
      en: 'A section break, a table inside the row to repeat, and marks that are neither in one paragraph, nor in one row, nor paragraphs of their own: those blocks stay as they are. Copies after the first leave out notes, bookmarks and floating pictures, which a document has once.',
      es: 'Un salto de sección, una tabla dentro de la fila a repetir, y marcas que no están ni en un párrafo, ni en una fila, ni son párrafos propios: esos bloques se quedan como están. Las copias después de la primera dejan fuera notas, marcadores e imágenes flotantes, que un documento tiene una sola vez.',
      zh: '包含分节符、要重复的行中含有嵌套表格，或标记既不在同一段落、也不在同一行、又不是独立段落的区块，都会原样保留。第一份之后的副本不包含批注、书签和浮动图片，因为文档中它们只能出现一次。',
    },
  },
];

/** The names a format is read by, besides its English, Spanish and Chinese ones, from FORMATS. */
export const ALIASES: Record<FormatId, string[]> = {
  upper: ['uppercase', 'mayúscula'],
  lower: ['lowercase', 'minúscula'],
  capital: ['title case', 'capitalizar'],
  bold: ['negritas', '粗体'],
  italic: ['cursivas', 'itálica', '斜体'],
  underline: [],
  date: ['fecha corta', '短日期'],
  dateLong: ['dateLong'],
  dateFull: ['dateFull'],
  number: [],
  currency: ['importe', '金额'],
  image: ['picture', 'foto'],
};

/** The rows of the table of formats: the "written as" columns are worked out by formatValue when the site is built. */
export const FORMAT_ROWS: { id: FormatId; arg?: string; value: string }[] = [
  { id: 'upper', value: 'ana pérez' },
  { id: 'lower', value: 'ANA PÉREZ' },
  { id: 'capital', value: 'ana pérez' },
  { id: 'bold', value: 'Ana' },
  { id: 'number', value: '1234567.5' },
  { id: 'number', arg: '2', value: '1234.5' },
  { id: 'currency', value: '2500' },
  { id: 'currency', arg: 'EUR', value: '2500' },
  { id: 'date', value: '2026-10-13' },
  { id: 'date', arg: 'd MMMM yyyy', value: '2026-10-13' },
  { id: 'dateLong', value: '2026-10-13' },
  { id: 'dateFull', value: '2026-10-13' },
];

/** The languages of the table of formats. None given is en-US. */
export const LOCALES = ['en-US', 'es-MX', 'zh-CN', 'de-DE'];

/** @rebodocs/core, from variables.ts and tables.ts. */
export const CORE: { sig: string; text: L }[] = [
  {
    sig: 'variableNames(doc) → string[]',
    text: {
      en: 'The names of the variables, each once, in the order they first appear: the text first, then the headers and footers, the notes and the text boxes.',
      es: 'Los nombres de las variables, cada uno una vez, en el orden en que aparecen primero: el texto primero, luego los encabezados y pies, las notas y los cuadros de texto.',
      zh: '变量名称，每个只出现一次，按首次出现的顺序排列：先是正文，然后是页眉页脚、注释和文本框。',
    },
  },
  {
    sig: 'fillVariables(doc, values, { locale?, currency?, today? }) → Doc',
    text: {
      en: 'The document with each variable that has a value replaced by it, as its formats ask, in every part. A variable left out of values stays as it is, so a document can be filled in steps. The same document comes back when there was nothing to fill. Without a locale, values are written in the language of the document, or in English.',
      es: 'El documento con cada variable que tiene valor reemplazada por él, como piden sus formatos, en cada parte. Una variable que no está en values se queda como está, así que un documento se puede llenar por pasos. Regresa el mismo documento cuando no había nada que llenar. Sin locale, los valores se escriben en el idioma del documento, o en inglés.',
      zh: '返回一份新文档：其中每个有值的变量都按格式要求替换为对应的值，作用于文档的所有部分。values 中没有的变量保持原样，因此文档可以分步填写。没有可填写的内容时返回同一份文档。未指定 locale 时，值按文档的语言书写，否则使用英文。',
    },
  },
  {
    sig: 'variableProblems(doc, values, options?) → { name, format, kind }[]',
    text: {
      en: 'What would go wrong, before you fill: kind "format" for a format there is not, "value" for a value that is not what its format is for (not a date, not a number), which would be put as given.',
      es: 'Lo que saldría mal, antes de llenar: kind "format" para un formato que no existe, "value" para un valor que no es para lo que es su formato (no es una fecha, no es un número), que se pondría tal como se dio.',
      zh: '在填写之前找出会出错的地方：kind 为 "format" 表示格式不存在；为 "value" 表示值不符合格式（不是日期、不是数字），这种值会原样写入。',
    },
  },
  {
    sig: 'formatValue(value, formats, options?) → { text, props, problems }',
    text: {
      en: 'One value as its formats ask, without a document: the text, the bold, italic or underline they add, and what could not be applied. Without a locale, in English (en-US).',
      es: 'Un valor como piden sus formatos, sin documento: el texto, la negrita, cursiva o subrayado que agregan, y lo que no se pudo aplicar. Sin locale, en inglés (en-US).',
      zh: '在没有文档的情况下按格式处理单个值：返回文字、格式附加的加粗/倾斜/下划线，以及无法应用的格式。未指定 locale 时使用英文（en-US）。',
    },
  },
  {
    sig: 'findAllVariables(doc) → (Variable & { part? })[]',
    text: {
      en: "Every use of every variable, in every part, with the part it is in (none for the text) and its range in that part: 'firstHeader', 'header@0' for a section’s own, 'footnote:1', 'textbox:7'.",
      es: "Cada uso de cada variable, en cada parte, con la parte donde está (ninguna para el texto) y su rango en esa parte: 'firstHeader', 'header@0' para el de una sección, 'footnote:1', 'textbox:7'.",
      zh: "所有变量在所有部分中的每一处使用，附带所在部分（正文则无）及其在该部分中的范围：'firstHeader'、某一节独立页眉为 'header@0'、'footnote:1'、'textbox:7'。",
    },
  },
  {
    sig: 'templateBlocks(doc) → { name, inverted, kind }[]',
    text: {
      en: "The blocks of the template in every part, each once by its name and sign: kind is 'row', 'paragraphs' or 'text'.",
      es: "Los bloques de la plantilla en cada parte, cada uno una vez por su nombre y signo: kind es 'row', 'paragraphs' o 'text'.",
      zh: "模板中所有部分的区块，按名称和符号各列一次：kind 为 'row'、'paragraphs' 或 'text'。",
    },
  },
  { sig: 'variableUses(doc, name) → number', text: { en: 'How many times a variable is used.', es: 'Cuántas veces se usa una variable.', zh: '变量被使用的次数。' } },
  {
    sig: 'variableNotes(doc) → Record<string, string[]>',
    text: {
      en: 'For each variable a note is on, or on a part of, what those notes say, in the order of the text: a description for whoever fills it.',
      es: 'Para cada variable que tiene una nota encima, o sobre una parte de ella, lo que dicen esas notas, en el orden del texto: una descripción para quien la llena.',
      zh: '对于带有批注（或部分带有批注）的每个变量，按文本顺序返回这些批注的内容：可以作为给填写者的说明。',
    },
  },
  {
    sig: 'variableFormats(doc, name) → { id, arg }[]',
    text: {
      en: 'The formats every use of a variable has: what the panel shows as set.',
      es: 'Los formatos que tiene cada uso de una variable: lo que el panel muestra como fijado.',
      zh: '变量每一处使用都具有的格式：即面板中显示为已设置的格式。',
    },
  },
  {
    sig: 'setVariableFormat(doc, name, id, on, arg?, language?) → Doc',
    text: {
      en: 'Gives a format to every use of a variable, or takes it away. A way of writing a date or a number takes the place of the one there was, and so does a change of capitals; bold, italic and underline add up. Written in the language given, or else the document’s: Spanish names when it starts with "es", Chinese ones when it starts with "zh", English ones otherwise or when there is none.',
      es: 'Le da un formato a cada uso de una variable, o se lo quita. Una forma de escribir una fecha o un número reemplaza a la que había, y lo mismo un cambio de mayúsculas; negrita, cursiva y subrayado se suman. Se escribe en el idioma dado, o si no en el del documento: nombres en español cuando empieza con "es", en chino cuando empieza con "zh", en inglés en otro caso o cuando no hay ninguno.',
      zh: '为变量的每一处使用添加或移除某个格式。日期或数字的写法会替换原有的写法，大小写变化也是如此；加粗、倾斜和下划线则会叠加。格式名称按给定的语言书写，否则按文档语言：以 "es" 开头时用西班牙文名称，以 "zh" 开头时用中文名称，其他情况或未指定时用英文名称。',
    },
  },
  {
    sig: 'formatText(id, arg?, language?) → string',
    text: {
      en: "How a format is written in a document: formatText('date', 'dd/MM/yyyy') is \"date: dd/MM/yyyy\"; with 'es', \"fecha: dd/MM/yyyy\"; with 'zh-CN', \"日期: dd/MM/yyyy\".",
      es: "Cómo se escribe un formato en un documento: formatText('date', 'dd/MM/yyyy') es \"date: dd/MM/yyyy\"; con 'es', \"fecha: dd/MM/yyyy\"; con 'zh-CN', \"日期: dd/MM/yyyy\".",
      zh: "格式在文档中的写法：formatText('date', 'dd/MM/yyyy') 为 \"date: dd/MM/yyyy\"；传入 'es' 为 \"fecha: dd/MM/yyyy\"；传入 'zh-CN' 为 \"日期: dd/MM/yyyy\"。",
    },
  },
  {
    sig: 'findVariables(doc) → Variable[]',
    text: {
      en: 'The variables of the paragraphs given, with where each is: { name, formats, range }. Give it a header as { paragraphs } to look in that part.',
      es: 'Las variables de los párrafos dados, con dónde está cada una: { name, formats, range }. Dale un encabezado como { paragraphs } para buscar en esa parte.',
      zh: '给定段落中的变量及其位置：{ name, formats, range }。传入 { paragraphs } 形式的页眉即可在该部分中查找。',
    },
  },
  {
    sig: 'variableText(name, formats?) · isVariableName(name)',
    text: {
      en: 'The text of a variable, {{name | format}}, and whether a name can be one.',
      es: 'El texto de una variable, {{nombre | formato}}, y si un nombre puede serlo.',
      zh: '变量的文本形式 {{名称 | 格式}}，以及某个名称能否作为变量名。',
    },
  },
  {
    sig: 'insertSignatures(doc, pos, titles?, name?) → { doc, pos, name? }',
    text: {
      en: 'A place to sign for each title, side by side, at pos: a table of one row without borders, each cell with the title, a line and a name under it, centred and bold. name is the range of the first name, to type over it.',
      es: 'Un lugar para firmar por cada título, uno al lado del otro, en pos: una tabla de una fila sin bordes, cada celda con el título, una línea y un nombre debajo, centrados y en negrita. name es el rango del primer nombre, para escribir encima.',
      zh: '在 pos 处为每个标题并排插入一个签名位置：一张无边框的单行表格，每个单元格包含标题、一条签名线及其下方的姓名，居中加粗。name 是第一个姓名的范围，可直接覆盖输入。',
    },
  },
];

/** The Editor, from editor.ts. */
export const EDITOR: { sig: string; text: L }[] = [
  {
    sig: 'editor.variables',
    text: { en: 'The names of the variables of the document, in every part.', es: 'Los nombres de las variables del documento, en cada parte.', zh: '文档所有部分中的变量名称。' },
  },
  {
    sig: 'editor.activeVariable',
    text: { en: 'The variable the caret is in, or the selection is.', es: 'La variable donde está el cursor, o la selección.', zh: '光标或选区所在的变量。' },
  },
  {
    sig: 'editor.blocks',
    text: { en: 'The blocks of the template, as templateBlocks gives them.', es: 'Los bloques de la plantilla, como los da templateBlocks.', zh: '模板中的区块，与 templateBlocks 的返回值相同。' },
  },
  {
    sig: 'editor.insertVariable(name)',
    text: { en: 'Puts {{name}} at the caret, or in place of the selection.', es: 'Pone {{nombre}} en el cursor, o en lugar de la selección.', zh: '在光标处插入 {{名称}}，或替换选中的内容。' },
  },
  {
    sig: 'editor.fillVariables(data)',
    text: {
      en: 'Fills them everywhere and writes out the blocks given a value, in the language of formatLocale, as one step to undo. While changes are tracked, the filling is tracked: each variable taken out, its value put in.',
      es: 'Las llena en todas partes y desarrolla los bloques que tienen valor, en el idioma de formatLocale, como un solo paso para deshacer. Mientras se registran los cambios, el llenado se registra: cada variable quitada, su valor puesto.',
      zh: '在所有位置填写变量并展开有值的区块，使用 formatLocale 的语言，可一步撤销。开启修订时，填写过程也会被追踪：每个变量显示为删除，其值显示为插入。',
    },
  },
  {
    sig: 'editor.selectVariable(name)',
    text: {
      en: 'Selects the next place the variable is used after the caret, going round at the end: in the text, then the headers and footers, the notes and the text boxes, going into the one it is in.',
      es: 'Selecciona el siguiente lugar donde se usa la variable después del cursor, volviendo al inicio al final: en el texto, luego los encabezados y pies, las notas y los cuadros de texto, entrando en el que lo contiene.',
      zh: '选中光标之后变量的下一处使用，到末尾后从头开始：依次为正文、页眉页脚、注释和文本框，并进入所在的部分。',
    },
  },
  {
    sig: 'editor.variableFormats(name) · editor.variableUses(name) · editor.variableNotes(name)',
    text: { en: 'As in the core, on the document of the editor.', es: 'Como en el core, sobre el documento del editor.', zh: '与 core 中相同，作用于编辑器中的文档。' },
  },
  {
    sig: 'editor.setVariableFormat(name, id, on, arg?)',
    text: {
      en: 'As in the core, written in the language of the interface, as one step to undo, and tracked while changes are.',
      es: 'Como en el core, escrito en el idioma de la interfaz, como un solo paso para deshacer, y registrado mientras se registran los cambios.',
      zh: '与 core 中相同，以界面语言书写，可一步撤销，开启修订时会被追踪。',
    },
  },
  {
    sig: 'editor.formatLocale',
    text: {
      en: 'The language values are written in: the language of the text (chosen at the foot of the editor, the language prop, the one the file says, or the interface’s when the document was opened), with the browser’s region.',
      es: 'El idioma en que se escriben los valores: el idioma del texto (elegido al pie del editor, la prop language, el que dice el archivo, o el de la interfaz al abrir el documento), con la región del navegador.',
      zh: '书写值所用的语言：即文本语言（在编辑器底部选择、通过 language 属性指定、文件中声明，或打开文档时的界面语言），加上浏览器的地区。',
    },
  },
  {
    sig: 'editor.insertSignatures(titles?)',
    text: {
      en: 'Signatures at the caret, ADVISER and CLIENT when no titles are given, with the first name selected to type over.',
      es: 'Firmas en el cursor, ASESOR y CLIENTE cuando no se dan títulos, con el primer nombre seleccionado para escribir encima.',
      zh: '在光标处插入签名；未提供标题时为“顾问”和“客户”，并选中第一个姓名以便直接输入。',
    },
  },
];

/** The Variables tab of the side panel, from panel.ts. */
export const PANEL: { title: L; text: L }[] = [
  {
    title: { en: 'A box for each', es: 'Una casilla por cada una', zh: '每个变量一个输入框' },
    text: {
      en: 'Named so it reads: clientName, client_name and client.name all show as “Name”, under “Client” when other variables start with client. With more than six, a box to find one.',
      es: 'Nombrada para que se lea bien: clientName, client_name y client.name se muestran como “Name”, bajo “Client” cuando otras variables empiezan con client. Con más de seis, una casilla para buscar.',
      zh: '名称会转换成易读的形式：clientName、client_name 和 client.name 都显示为 “Name”；当其他变量也以 client 开头时，会归在 “Client” 分组下。超过六个变量时会出现搜索框。',
    },
  },
  {
    title: { en: 'Fill', es: 'Llenar', zh: '填写' },
    text: {
      en: '“Fill 3 variables in the document” puts every value typed in, as one step to undo; Enter in a box, or its ✓, fills that one alone. The values stay in the boxes, so undoing gives the variables back with them.',
      es: '“Llenar 3 variables en el documento” pone cada valor escrito, como un solo paso para deshacer; Enter en una casilla, o su ✓, llena solo esa. Los valores se quedan en las casillas, así que deshacer devuelve las variables con ellos.',
      zh: '“填写文档中的 3 个变量”会写入所有已输入的值，可一步撤销；在某个输入框中按 Enter 或点击其 ✓，只填写该变量。值会保留在输入框中，因此撤销后变量回来时值依然在。',
    },
  },
  {
    title: { en: 'How it is written', es: 'Cómo se escribe', zh: '写法' },
    text: {
      en: 'The sliders open the data type (text, date, long date, full date, number, currency, each shown as it will come out), the letter case, and bold, italic or underline. A number also takes its decimals, an amount its currency (EUR, MXN), a date a pattern (d MMMM yyyy). Under the box, what the value will come out as, or why it cannot.',
      es: 'Los deslizadores abren el tipo de dato (texto, fecha, fecha larga, fecha completa, número, moneda, cada uno mostrado como saldrá), las mayúsculas, y negrita, cursiva o subrayado. Un número también toma sus decimales, un importe su moneda (EUR, MXN), una fecha un patrón (d MMMM yyyy). Bajo la casilla, cómo saldrá el valor, o por qué no puede.',
      zh: '点击滑块图标可设置数据类型（文本、日期、长日期、完整日期、数字、货币，每种都会显示最终效果）、大小写，以及加粗、倾斜或下划线。数字还可以设置小数位数，金额可以设置货币（CNY、EUR），日期可以设置格式（yyyy年M月d日）。输入框下方会显示值最终的样子，或无法这样书写的原因。',
    },
  },
  {
    title: { en: 'Load data…', es: 'Cargar datos…', zh: '载入数据…' },
    text: {
      en: 'The values from a .json file: { "client": { "name": "Ana" } } fills client.name, and a list is kept as it is for the block of its name.',
      es: 'Los valores de un archivo .json: { "cliente": { "nombre": "Ana" } } llena cliente.nombre, y una lista se conserva tal cual para el bloque de su nombre.',
      zh: '从 .json 文件读取值：{ "客户": { "姓名": "王芳" } } 会填写 客户.姓名；列表会原样保留，供同名区块使用。',
    },
  },
  {
    title: { en: 'Blocks', es: 'Bloques', zh: '区块' },
    text: {
      en: 'Each block, with what it repeats: kept or taken out, or once for each item of a list loaded. Its marks stand out in the text like variables.',
      es: 'Cada bloque, con lo que repite: conservado o quitado, o una vez por cada elemento de una lista cargada. Sus marcas resaltan en el texto como las variables.',
      zh: '列出每个区块及其重复的内容：保留、移除，或为载入列表中的每一项重复一次。区块标记在文本中会像变量一样突出显示。',
    },
  },
  {
    title: { en: 'Go to', es: 'Ir a', zh: '跳转' },
    text: {
      en: 'The target selects the next place the variable is used, in the header or a note too. A count says how many there are, when more than one.',
      es: 'La diana selecciona el siguiente lugar donde se usa la variable, también en el encabezado o una nota. Un contador dice cuántos hay, cuando son más de uno.',
      zh: '点击靶心图标会选中变量的下一处使用，包括页眉或注释中。有多处使用时会显示数量。',
    },
  },
  {
    title: { en: 'New variable', es: 'Nueva variable', zh: '新变量' },
    text: {
      en: 'A name and Insert puts it at the caret. Or select a word and press {{ }} Variable in the bar beside the selection; or Insert → Variable… in the toolbar.',
      es: 'Un nombre e Insertar la pone en el cursor. O selecciona una palabra y pulsa {{ }} Variable en la barra junto a la selección; o Insertar → Variable… en la barra de herramientas.',
      zh: '输入名称并点击“插入”即可放到光标处。也可以选中一个词，点击选区工具条中的“{{ }} 变量”；或使用工具栏中的“插入 → 变量…”。',
    },
  },
];

/** The tools of an assistant, from mcp/src/tools.ts. */
export const TOOLS: { sig: string; text: L }[] = [
  {
    sig: 'list_variables',
    text: {
      en: 'Each variable with how many times it is used and the formats it is given, and each block with what it repeats.',
      es: 'Cada variable con cuántas veces se usa y los formatos que tiene, y cada bloque con lo que repite.',
      zh: '列出每个变量的使用次数和格式，以及每个区块重复的内容。',
    },
  },
  {
    sig: 'fill_variables { values, locale?, currency? }',
    text: {
      en: 'Fills them everywhere, lists and yes or no for the blocks among the values, and says how many it filled, which are still without a value, which names are not variables of the document, and which values a format could not write.',
      es: 'Las llena en todas partes, listas y sí o no para los bloques entre los valores, y dice cuántas llenó, cuáles siguen sin valor, qué nombres no son variables del documento, y qué valores no pudo escribir un formato.',
      zh: '在所有位置填写变量（values 中也可以包含区块用的列表和是/否值），并报告填写了多少个、哪些仍没有值、哪些名称不是文档中的变量，以及哪些值无法按格式书写。',
    },
  },
  {
    sig: 'insert_signatures',
    text: {
      en: 'Signature lines after a paragraph, with the titles and names given.',
      es: 'Líneas de firma después de un párrafo, con los títulos y nombres dados.',
      zh: '在某个段落之后插入签名线，使用给定的标题和姓名。',
    },
  },
];

/** The Editor's members for stretches that may be changed, from editor.ts. */
export const FORMS: { sig: string; text: L }[] = [
  {
    sig: 'editor.makeEditable()',
    text: {
      en: 'Makes the selection an area that can be changed, or the caret an empty one to write in, and returns its id. Not while restricted.',
      es: 'Convierte la selección en un área que se puede cambiar, o el cursor en una vacía para escribir, y devuelve su id. No mientras está restringido.',
      zh: '把选区设为可修改的区域，或在光标处创建一个可输入的空白区域，并返回其 id。受限状态下不可用。',
    },
  },
  {
    sig: 'editor.removeEditable(id?)',
    text: {
      en: 'Takes away that area, or the one the caret is in; its text stays. Not while restricted.',
      es: 'Quita esa área, o la del cursor; su texto se queda. No mientras está restringido.',
      zh: '移除指定区域或光标所在的区域；其中的文字保留。受限状态下不可用。',
    },
  },
  {
    sig: 'editor.editableRanges · editor.activeEditable',
    text: {
      en: 'The areas, each with its id and range, in their order; the id of the one the caret is in.',
      es: 'Las áreas, cada una con su id y rango, en su orden; el id de la del cursor.',
      zh: '按顺序列出所有区域及其 id 和范围；以及光标所在区域的 id。',
    },
  },
  {
    sig: 'editor.setRestricted(on) · editor.restricted',
    text: {
      en: 'Restricts the document to its areas, or opens it all again. It is said in the file; it is not a step to undo.',
      es: 'Restringe el documento a sus áreas, o lo abre todo de nuevo. Se guarda en el archivo; no es un paso para deshacer.',
      zh: '把文档限制为只能编辑其区域，或重新全部开放。该状态会写入文件；它不是可撤销的步骤。',
    },
  },
  {
    sig: 'editor.nextEditable(dir?)',
    text: {
      en: 'Selects what the next area holds, or the one before with -1, going round: what Tab and Shift+Tab do while restricted.',
      es: 'Selecciona lo que contiene la siguiente área, o la anterior con -1, dando la vuelta: lo que hacen Tab y Shift+Tab mientras está restringido.',
      zh: '选中下一个区域的内容（传 -1 则为上一个），循环往复：即受限状态下 Tab 和 Shift+Tab 的作用。',
    },
  },
  {
    sig: 'editor.onRefused',
    text: {
      en: 'Called when a change outside the areas is not made, for your interface to say so as well.',
      es: 'Se llama cuando un cambio fuera de las áreas no se hace, para que tu interfaz también lo diga.',
      zh: '当区域外的修改被拒绝时调用，便于你的界面也给出提示。',
    },
  },
];
