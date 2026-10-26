// What the page "Fonts" says that is data, each checked in
// packages/editor/src/fonts.ts, packages/editor/src/editor.ts (exportDocx,
// exportPdf, loadEmbeddedFonts), packages/core/src/pdf.ts and
// packages/core/src/docx/export.ts (embeddable, writeFonts). Each text in each
// language of the site.

import type { L } from '@/lib/i18n';

/** The font of the demo: OFL, in public/fonts with its licence, one file per face. */
export const FAMILY = 'Courier Prime';
export const FACES: { file: string; bold?: boolean; italic?: boolean }[] = [
  { file: 'CourierPrime-Regular.ttf' },
  { file: 'CourierPrime-Bold.ttf', bold: true },
  { file: 'CourierPrime-Italic.ttf', italic: true },
];

/** What a given font is used for. */
export const DOES: { title: L; text: L; color: 'blue' | 'green' | 'purple' | 'pink' | 'yellow' | 'orange' }[] = [
  {
    title: { en: 'Offered', es: 'Ofrecida', zh: '可供选择' },
    color: 'blue',
    text: {
      en: 'First in the toolbar’s font box, also in a bar made before it came. Headless, in state.fonts.',
      es: 'La primera en el cuadro de fuentes de la barra, también en una barra creada antes de que llegara. Headless, en state.fonts.',
      zh: '排在工具栏字体框的最前面，即使工具栏在字体加载之前就已创建。Headless 模式下在 state.fonts 中。',
    },
  },
  {
    title: { en: 'Measured and painted', es: 'Medida y pintada', zh: '测量与绘制' },
    color: 'green',
    text: {
      en: 'Text in that family is set with it. Every open document is laid out again when it loads, since the width of its lines changes: a page may break elsewhere.',
      es: 'El texto de esa familia se compone con ella. Cada documento abierto se vuelve a componer cuando carga, porque cambia el ancho de sus líneas: una página puede cortarse en otro lugar.',
      zh: '该字体族的文字会用它排版。字体加载后，所有打开的文档都会重新排版，因为行宽会变化：分页位置可能改变。',
    },
  },
  {
    title: { en: 'In the PDF', es: 'En el PDF', zh: '在 PDF 中' },
    color: 'purple',
    text: {
      en: 'When the file is TrueType or OpenType, the PDF carries it, and its text can be selected and searched.',
      es: 'Cuando el archivo es TrueType u OpenType, el PDF la lleva, y su texto se puede seleccionar y buscar.',
      zh: '字体文件为 TrueType 或 OpenType 时，PDF 会嵌入它，其中的文字可以选择和搜索。',
    },
  },
  {
    title: { en: 'In the DOCX', es: 'En el DOCX', zh: '在 DOCX 中' },
    color: 'pink',
    text: {
      en: 'When it is TrueType and its licence lets it, whole or cut down, for whoever opens the file in Word without the font installed.',
      es: 'Cuando es TrueType y su licencia lo permite, entera o recortada, para quien abra el archivo en Word sin la fuente instalada.',
      zh: '字体为 TrueType 且许可允许时，会完整或精简后嵌入，供未安装该字体的人在 Word 中打开文件。',
    },
  },
];

const YES: L = { en: 'Yes', es: 'Sí', zh: '是' };
const NO: L = { en: 'No', es: 'No', zh: '否' };
const CUT: L = { en: 'Cut down to the characters used', es: 'Recortada a los caracteres usados', zh: '精简为用到的字符' };
const LICENCE: L = { en: 'If the licence lets it: whole, or cut down', es: 'Si la licencia lo permite: entera o recortada', zh: '许可允许时：完整或精简' };
const STANDARD: L = { en: 'No: Helvetica, Times or Courier', es: 'No: Helvetica, Times o Courier', zh: '否：使用 Helvetica、Times 或 Courier' };

/** What each kind of file does, from parseTrueType and subsetTrueType (pdf.ts) and embeddable (docx/export.ts). */
export const KINDS: { kind: L; screen: L; pdf: L; docx: L; none: { pdf: boolean; docx: boolean } }[] = [
  { kind: { en: '.ttf', es: '.ttf', zh: '.ttf' }, screen: YES, pdf: CUT, docx: LICENCE, none: { pdf: false, docx: false } },
  {
    kind: { en: '.otf, TrueType outlines', es: '.otf, contornos TrueType', zh: '.otf，TrueType 轮廓' },
    screen: YES,
    pdf: CUT,
    docx: LICENCE,
    none: { pdf: false, docx: false },
  },
  { kind: { en: '.otf, CFF outlines', es: '.otf, contornos CFF', zh: '.otf，CFF 轮廓' }, screen: YES, pdf: { en: 'Whole', es: 'Entera', zh: '完整' }, docx: NO, none: { pdf: false, docx: true } },
  { kind: { en: '.woff, .woff2', es: '.woff, .woff2', zh: '.woff、.woff2' }, screen: YES, pdf: STANDARD, docx: NO, none: { pdf: true, docx: true } },
  { kind: { en: 'Left out (CSS)', es: 'Omitido (CSS)', zh: '省略（CSS）' }, screen: YES, pdf: STANDARD, docx: NO, none: { pdf: true, docx: true } },
];

/** The functions of the fonts. */
export const FUNCTIONS: { name: string; signature: string; returns: string; text: L; editorOnly?: boolean }[] = [
  {
    name: 'addFont',
    signature: 'addFont(font: FontSource)',
    returns: 'Promise<boolean>',
    text: {
      en: 'Gives the page a face of a family. Says whether it could be read: false for an address that does not answer with a font, a file the browser cannot read, or no browser at all.',
      es: 'Le da a la página una variante de una familia. Dice si se pudo leer: false para una dirección que no responde con una fuente, un archivo que el navegador no puede leer, o si no hay navegador.',
      zh: '为页面添加某个字体族的一种字形。返回是否读取成功：地址返回的不是字体、浏览器无法读取文件或根本没有浏览器时返回 false。',
    },
  },
  {
    name: 'addFonts',
    signature: 'addFonts(fonts: FontSource[])',
    returns: 'Promise<boolean[]>',
    text: {
      en: 'Several at once, read side by side; the documents are laid out again once, when all are in.',
      es: 'Varias a la vez, leídas en paralelo; los documentos se vuelven a componer una sola vez, cuando están todas.',
      zh: '一次添加多个，并行读取；全部加载后文档只重新排版一次。',
    },
  },
  {
    name: 'fontFamilies',
    signature: 'fontFamilies()',
    returns: 'string[]',
    text: { en: 'The families given, in the order they came, each once.', es: 'Las familias dadas, en el orden en que llegaron, cada una una vez.', zh: '已添加的字体族，按添加顺序排列，不重复。' },
  },
  {
    name: 'onFontsChange',
    signature: 'onFontsChange(listener: () => void)',
    returns: '() => void',
    text: {
      en: 'Calls listener when a font is given. Returns how to stop.',
      es: 'Llama a listener cuando se da una fuente. Devuelve cómo dejar de hacerlo.',
      zh: '添加字体时调用 listener。返回用于取消监听的函数。',
    },
  },
  {
    name: 'fontFile',
    signature: 'fontFile(spec: { family: string; bold: boolean; italic: boolean })',
    returns: 'Uint8Array | undefined',
    text: {
      en: 'The file of that face, or of the regular one of its family: what a PDF embeds.',
      es: 'El archivo de esa variante, o el de la normal de su familia: lo que incrusta un PDF.',
      zh: '该字形的文件，或其字体族常规字形的文件：即 PDF 嵌入的内容。',
    },
    editorOnly: true,
  },
  {
    name: 'fontFaces',
    signature: 'fontFaces()',
    returns: '{ family, bold, italic, bytes }[]',
    text: {
      en: 'Every face given with its file: what a DOCX can carry.',
      es: 'Cada variante dada con su archivo: lo que puede llevar un DOCX.',
      zh: '所有已添加的字形及其文件：即 DOCX 可以携带的内容。',
    },
    editorOnly: true,
  },
];

/** FontSource, as fonts.ts declares it. */
export const SOURCE: { name: string; type: string; text: L }[] = [
  {
    name: 'family',
    type: 'string',
    text: {
      en: 'The name the document gives the font. Compared without minding capitals.',
      es: 'El nombre que el documento le da a la fuente. Se compara sin importar mayúsculas.',
      zh: '文档中使用的字体名称。比较时不区分大小写。',
    },
  },
  {
    name: 'src',
    type: 'string | ArrayBuffer | Uint8Array',
    text: {
      en: 'An address to fetch, the bytes, or nothing for a font the page loads itself.',
      es: 'Una dirección que descargar, los bytes, o nada para una fuente que la página carga por sí misma.',
      zh: '要获取的地址、字节，或者省略（字体由页面自行加载）。',
    },
  },
  { name: 'bold', type: 'boolean', text: { en: 'The file is the bold face.', es: 'El archivo es la variante negrita.', zh: '该文件是粗体字形。' } },
  {
    name: 'italic',
    type: 'boolean',
    text: { en: 'The file is the italic face. Neither: the regular one.', es: 'El archivo es la variante cursiva. Ninguna de las dos: la normal.', zh: '该文件是斜体字形。两者都不是时为常规字形。' },
  },
];
