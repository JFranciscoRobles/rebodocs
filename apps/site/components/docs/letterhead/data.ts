// What the page "Letterheads" says that is data, each checked in
// packages/core/src/letterhead.ts, packages/editor/src/editor.ts (Letterhead),
// sidebar.ts (the document menu), packages/react/src/docs.ts (the prop) and
// pieces.ts (useDocsPage). Each text in each language of the site.

import type { L } from '@/lib/i18n';

/** When a picture is the letterhead, as isLetterhead and parts in letterhead.ts say. */
export const RULES: { title: L; text: L }[] = [
  {
    title: { en: 'In a header', es: 'En un encabezado', zh: '位于页眉中' },
    text: {
      en: 'The header of every page, the first page’s own, or that of a section with a header of its own.',
      es: 'El encabezado de cada página, el propio de la primera página, o el de una sección con encabezado propio.',
      zh: '每一页的页眉、首页的独立页眉，或拥有独立页眉的某一节的页眉。',
    },
  },
  {
    title: { en: 'Behind the text', es: 'Detrás del texto', zh: '位于文字下方' },
    text: { en: 'Drawn under it, with the text not wrapping around it.', es: 'Dibujada debajo de él, sin que el texto la rodee.', zh: '绘制在文字下方，文字不会环绕它。' },
  },
  {
    title: { en: 'Measured from the page', es: 'Medida desde la página', zh: '相对页面定位' },
    text: {
      en: 'Placed from the edges of the sheet, not from the margins or a paragraph.',
      es: 'Colocada desde los bordes de la hoja, no desde los márgenes ni un párrafo.',
      zh: '以纸张边缘为基准定位，而不是以页边距或段落为基准。',
    },
  },
  {
    title: { en: 'The size of the page', es: 'Del tamaño de la página', zh: '与页面同样大小' },
    text: {
      en: 'At least 85% of the width and of the height of the page it is on. A smaller picture behind the text is a picture in the header, not the letterhead.',
      es: 'Al menos el 85% del ancho y del alto de la página donde está. Una imagen más pequeña detrás del texto es una imagen en el encabezado, no el membrete.',
      zh: '至少达到所在页面宽度和高度的 85%。较小的、位于文字下方的图片只是页眉中的图片，而不是信头。',
    },
  },
];

/** The document menu, under Page, as sidebar.ts builds it. */
export const MENU: { item: L; text: L }[] = [
  {
    item: { en: 'Letterhead… · Change the letterhead…', es: 'Membrete… · Cambiar el membrete…', zh: '信头… · 更改信头…' },
    text: {
      en: 'A PNG or JPG from the disk. The top and bottom margins grow to clear what it prints; the one there was goes. One step to undo.',
      es: 'Un PNG o JPG del disco. Los márgenes de arriba y abajo crecen para librar lo que imprime; el que había se va. Un paso para deshacer.',
      zh: '从磁盘选择 PNG 或 JPG。上下页边距会自动增大以避开信头的内容；原有的信头会被替换。可一步撤销。',
    },
  },
  {
    item: { en: 'Fit the margins to the letterhead', es: 'Ajustar los márgenes al membrete', zh: '根据信头调整页边距' },
    text: { en: 'Does that again, after the margins were changed by hand.', es: 'Vuelve a hacerlo, después de cambiar los márgenes a mano.', zh: '在手动修改页边距之后，再次执行上述调整。' },
  },
  {
    item: { en: 'Extract the letterhead', es: 'Extraer el membrete', zh: '提取信头' },
    text: {
      en: 'Saves its picture as a file, named after the document, to use on another one.',
      es: 'Guarda su imagen como archivo, con el nombre del documento, para usarla en otro.',
      zh: '把信头图片保存为文件（以文档名命名），以便用在其他文档中。',
    },
  },
  {
    item: { en: 'Remove the letterhead', es: 'Quitar el membrete', zh: '删除信头' },
    text: { en: 'Takes the picture away. What else the header has stays.', es: 'Quita la imagen. Lo demás que tiene el encabezado se queda.', zh: '移除信头图片。页眉中的其他内容保留。' },
  },
];

/** The editor's members, as editor.ts declares them. */
export const MEMBERS: { sig: string; text: L }[] = [
  { sig: 'hasLetterhead: boolean', text: { en: 'Whether the document has one.', es: 'Si el documento tiene uno.', zh: '文档是否有信头。' } },
  {
    sig: 'letterhead: { bytes, type } | undefined',
    text: {
      en: 'Its picture, as the document keeps it: to save apart, or to put on another document.',
      es: 'Su imagen, como la guarda el documento: para guardarla aparte, o ponerla en otro documento.',
      zh: '文档中保存的信头图片：可以单独保存，或用在另一份文档中。',
    },
  },
  {
    sig: 'setLetterheadFile(file, fit = true) → Promise<boolean>',
    text: {
      en: 'Gives it the letterhead a PNG or JPG file is, and, unless fit is false, grows the margins to clear it: one step to undo. A file that does not say its kind is told by how it starts. False when it is not a picture that can be one.',
      es: 'Le da el membrete que es un archivo PNG o JPG y, salvo que fit sea false, agranda los márgenes para librarlo: un paso para deshacer. Un archivo que no dice su tipo se reconoce por cómo empieza. False cuando no es una imagen que pueda serlo.',
      zh: '把 PNG 或 JPG 文件设为信头；除非 fit 为 false，否则会增大页边距以避开它：可一步撤销。未声明类型的文件会根据文件开头识别。不是可用作信头的图片时返回 false。',
    },
  },
  {
    sig: 'setLetterhead(bytes, type)',
    text: { en: 'The same from bytes, without touching the margins.', es: 'Lo mismo a partir de bytes, sin tocar los márgenes.', zh: '同样的操作，但使用字节，且不修改页边距。' },
  },
  {
    sig: 'fitLetterheadMargins() → Promise<boolean>',
    text: {
      en: 'Grows the top and bottom margins to clear what it prints; one that already clears it stays. False when nothing changed.',
      es: 'Agranda los márgenes de arriba y abajo para librar lo que imprime; uno que ya lo libra se queda. False cuando nada cambió.',
      zh: '增大上下页边距以避开信头内容；已经足够的页边距保持不变。没有任何变化时返回 false。',
    },
  },
  { sig: 'removeLetterhead()', text: { en: 'Takes it away.', es: 'Lo quita.', zh: '删除信头。' } },
];

/** useDocsPage, as pieces.ts gives it. */
export const HEADLESS: { sig: string; text: L }[] = [
  {
    sig: 'letterhead: boolean',
    text: {
      en: 'Whether the document has one; also state.letterhead of useDocs.',
      es: 'Si el documento tiene uno; también state.letterhead de useDocs.',
      zh: '文档是否有信头；也可以用 useDocs 的 state.letterhead。',
    },
  },
  { sig: 'setLetterhead(file, fit?) → Promise<boolean>', text: { en: 'The editor’s setLetterheadFile.', es: 'El setLetterheadFile del editor.', zh: '即编辑器的 setLetterheadFile。' } },
  { sig: 'fitLetterheadMargins() → Promise<boolean>', text: { en: 'As on the editor.', es: 'Como en el editor.', zh: '与编辑器上的相同。' } },
  { sig: 'removeLetterhead()', text: { en: 'As on the editor.', es: 'Como en el editor.', zh: '与编辑器上的相同。' } },
  {
    sig: 'letterheadFile() → Blob | undefined',
    text: { en: 'Its picture as a file, for a button that saves it.', es: 'Su imagen como archivo, para un botón que la guarde.', zh: '以文件形式返回信头图片，供保存按钮使用。' },
  },
];

/** The functions of @rebodocs/core. */
export const CORE: { sig: string; text: L }[] = [
  {
    sig: 'setLetterhead(doc, { bytes, type }) → Doc',
    text: {
      en: 'The picture stretched over the whole page, in the header of every page, the first page’s own and that of each section with its own, each the size of its page; the one there was goes. A kind of picture a document cannot hold leaves it as it was. The margins are not touched.',
      es: 'La imagen estirada sobre toda la página, en el encabezado de cada página, el propio de la primera página y el de cada sección con el suyo, cada una del tamaño de su página; la que había se va. Un tipo de imagen que un documento no puede contener lo deja como estaba. Los márgenes no se tocan.',
      zh: '把图片拉伸铺满整页，放入每一页的页眉、首页的独立页眉以及每个拥有独立页眉的节中，各自与所在页面同样大小；原有的信头会被替换。文档无法容纳的图片类型会让文档保持原样。页边距不会被修改。',
    },
  },
  {
    sig: 'removeLetterhead(doc) → Doc',
    text: { en: 'Without it; the rest of the header stays.', es: 'Sin él; el resto del encabezado se queda.', zh: '删除信头；页眉中的其他内容保留。' },
  },
  {
    sig: 'letterheadOf(doc) → { part, para, offset, xml } | undefined',
    text: { en: 'Where it is: the header and the place in it.', es: 'Dónde está: el encabezado y el lugar dentro de él.', zh: '信头的位置：所在页眉及其中的具体位置。' },
  },
  { sig: 'letterheadImage(doc) → { bytes, type } | undefined', text: { en: 'Its picture.', es: 'Su imagen.', zh: '信头图片。' } },
  {
    sig: 'letterheadMargins(pixels, page) → { top?, bottom? }',
    text: {
      en: 'The margins a picture asks for, read from its pixels (RGBA, as a canvas gives them). A side with nothing printed asks for nothing.',
      es: 'Los márgenes que pide una imagen, leídos de sus píxeles (RGBA, como los da un canvas). Un lado sin nada impreso no pide nada.',
      zh: '根据图片像素（canvas 提供的 RGBA）计算所需的页边距。没有印刷内容的一侧不需要调整。',
    },
  },
  {
    sig: 'pngLetterheadMargins(bytes, page) → { top?, bottom? } | undefined',
    text: {
      en: 'The same from the bytes of a PNG, without a browser, as on a server. Undefined for a JPEG, whose pixels are not read here.',
      es: 'Lo mismo a partir de los bytes de un PNG, sin navegador, como en un servidor. Undefined para un JPEG, cuyos píxeles no se leen aquí.',
      zh: '同样的计算，但直接读取 PNG 的字节，不需要浏览器，适合在服务器上使用。JPEG 返回 undefined，因为这里不读取它的像素。',
    },
  },
  {
    sig: 'withLetterheadMargins(doc, asked) → Doc',
    text: {
      en: 'The top and bottom margins grown to what was asked: never shrunk, never past 40% of the page. What the editor does after reading a picture.',
      es: 'Los márgenes de arriba y abajo agrandados a lo que se pidió: nunca encogidos, nunca más allá del 40% de la página. Lo que hace el editor después de leer una imagen.',
      zh: '把上下页边距增大到所需的值：只增不减，且不超过页面的 40%。编辑器读取图片后就是这样做的。',
    },
  },
  {
    sig: 'resizeLetterhead(doc, width, height, section?) → Doc',
    text: {
      en: 'The letterhead made the size of another page. setSectionPage does it when the paper or its orientation changes, so it is called by hand only for a page set some other way.',
      es: 'El membrete hecho del tamaño de otra página. setSectionPage lo hace cuando cambia el papel o su orientación, así que solo se llama a mano para una página fijada de otra forma.',
      zh: '把信头调整为另一种页面尺寸。纸张或方向改变时 setSectionPage 会自动调用它，因此只有在以其他方式设置页面时才需要手动调用。',
    },
  },
  {
    sig: 'imageTypeOf(bytes) → string | undefined',
    text: {
      en: 'image/png, image/jpeg or image/gif, by how the bytes start, for a file that did not say.',
      es: 'image/png, image/jpeg o image/gif, según cómo empiezan los bytes, para un archivo que no lo dijo.',
      zh: '根据字节开头识别 image/png、image/jpeg 或 image/gif，用于未声明类型的文件。',
    },
  },
];
