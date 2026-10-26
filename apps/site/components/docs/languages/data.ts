// What the page "Languages" says that is data: a language started on the page,
// the words that can be changed in the demo, and the functions of the language,
// each checked in packages/editor/src/i18n.ts and packages/react/src/mount.ts.
// Each text in each language of the site.

import type { MessageKey, Messages } from '@rebodocs/react';
import type { L } from '@/lib/i18n';

/**
 * French, the way a translation is the day it is started: what shows in the
 * status bar, the styles and the File menu. "Print…" and the rest are left
 * out on purpose, to be seen in English.
 */
export const FRENCH: Partial<Messages> = {
  'locale.name': 'Français',
  language: 'Langue',
  'status.page': 'Page {page} sur {pages}',
  'status.word': 'mot',
  'status.words': 'mots',
  'status.char': 'caractère',
  'status.chars': 'caractères',
  'style.normal': 'Normal',
  'style.title': 'Titre',
  'style.subtitle': 'Sous-titre',
  'style.heading1': 'Titre 1',
  'style.heading2': 'Titre 2',
  'style.heading3': 'Titre 3',
  'menu.file': 'Fichier',
  'menu.open': 'Ouvrir un document…',
  'menu.save': 'Enregistrer',
  'menu.saveAs': 'Enregistrer sous…',
  'menu.export': 'Exporter',
  'toolbar.undo': 'Annuler',
  'toolbar.redo': 'Rétablir',
  'mark.bold': 'Gras',
  'mark.italic': 'Italique',
  'mark.underline': 'Souligné',
};

/** Words to change in the demo: ones that are on screen without opening anything, or one click away. */
export const WORDS: { key: MessageKey; where: L }[] = [
  { key: 'status.page', where: { en: 'the status bar', es: 'la barra de estado', zh: '状态栏' } },
  { key: 'style.normal', where: { en: 'the style box', es: 'el cuadro de estilos', zh: '样式框' } },
  { key: 'menu.file', where: { en: 'the menu (☰)', es: 'el menú (☰)', zh: '菜单（☰）' } },
  { key: 'menu.saveAs', where: { en: 'the menu (☰)', es: 'el menú (☰)', zh: '菜单（☰）' } },
];

/** The languages of the demo: the two the interface comes with, the Chinese of its module, and the one started above. */
export const DEMO_LOCALES: { code: string; name: string; note: L }[] = [
  { code: 'es', name: 'Español', note: { en: 'as it comes', es: 'como viene', zh: '自带' } },
  { code: 'en', name: 'English', note: { en: 'as it comes', es: 'como viene', zh: '自带' } },
  { code: 'zh-Hans', name: '简体中文', note: { en: 'from @rebodocs/editor/locales/zh-Hans', es: 'de @rebodocs/editor/locales/zh-Hans', zh: '来自 @rebodocs/editor/locales/zh-Hans' } },
  { code: 'fr', name: 'Français', note: { en: 'started, partly translated', es: 'empezado, traducido en parte', zh: '刚开始翻译，只译了一部分' } },
];

/** What a person sees, and in which language. */
export const WHAT: { title: L; answer: L; text: L; color: 'blue' | 'green' | 'purple' | 'pink' | 'yellow' | 'orange' }[] = [
  {
    title: { en: 'The interface', es: 'La interfaz', zh: '界面' },
    answer: { en: 'All of it', es: 'Toda', zh: '全部' },
    color: 'blue',
    text: {
      en: 'The toolbar, the menus, the panels, the dialogs, the status bar, the titles of the buttons and what a screen reader is told. Each part carries its language (lang), for a screen reader to read it with the right voice.',
      es: 'La barra de herramientas, los menús, los paneles, los diálogos, la barra de estado, los títulos de los botones y lo que se le dice a un lector de pantalla. Cada parte lleva su idioma (lang), para que un lector de pantalla la lea con la voz correcta.',
      zh: '工具栏、菜单、面板、对话框、状态栏、按钮的标题以及告诉屏幕阅读器的内容。每个部分都带有自己的语言（lang），以便屏幕阅读器用正确的语音朗读。',
    },
  },
  {
    title: { en: 'The document', es: 'El documento', zh: '文档' },
    answer: { en: 'Nothing', es: 'Nada', zh: '不翻译' },
    color: 'pink',
    text: {
      en: 'It is the person’s text. Opening a Spanish contract in an English interface leaves it in Spanish. The DOCX says the language its text is in, for spelling in Word: the language prop, or the interface’s, with the browser’s region.',
      es: 'Es el texto de la persona. Abrir un contrato en español en una interfaz en inglés lo deja en español. El DOCX dice el idioma en que está su texto, para la ortografía de Word: la prop language, o el de la interfaz, con la región del navegador.',
      zh: '那是用户自己的文字。在英文界面中打开西班牙语合同，合同仍是西班牙语。DOCX 会声明文字所用的语言，供 Word 拼写检查使用：取自 language 属性，或界面语言加上浏览器的地区。',
    },
  },
  {
    title: { en: 'What the editor writes', es: 'Lo que escribe el editor', zh: '编辑器写入的内容' },
    answer: { en: 'At the time', es: 'En el momento', zh: '插入时' },
    color: 'purple',
    text: {
      en: '“Page 1 of 3” in a page number and the titles of a signature block are written in the language of the interface when they are inserted. After that they are text of the document, and stay.',
      es: '“Página 1 de 3” en un número de página y los títulos de un bloque de firmas se escriben en el idioma de la interfaz cuando se insertan. Después son texto del documento, y se quedan.',
      zh: '页码中的“第 1 页，共 3 页”和签名栏的标题会在插入时以界面语言写入。之后它们就是文档的文字，不再改变。',
    },
  },
  {
    title: { en: 'Standard styles', es: 'Estilos estándar', zh: '标准样式' },
    answer: { en: 'Shown translated', es: 'Se muestran traducidos', zh: '显示为译名' },
    color: 'green',
    text: {
      en: 'Normal, Title and Heading 1–3 are shown as Título 1 or Heading 1; a style of the document’s own keeps its name. The file keeps the style as Word knows it.',
      es: 'Normal, Título y Título 1–3 se muestran como Título 1 o Heading 1; un estilo propio del documento conserva su nombre. El archivo guarda el estilo como lo conoce Word.',
      zh: '“正文”“标题”和“标题 1–3”会显示为界面语言的名称（如 Título 1 或 Heading 1）；文档自定义的样式保留原名。文件中保存的样式仍是 Word 认识的样子。',
    },
  },
  {
    title: { en: 'Dates and numbers', es: 'Fechas y números', zh: '日期和数字' },
    answer: { en: 'In the language', es: 'En el idioma', zh: '按语言显示' },
    color: 'yellow',
    text: {
      en: 'The dates of versions and notes, the counts in the status bar and the find bar, the centimetres of the ruler and the line spacing: 1,15 in Spanish, 1.15 in English.',
      es: 'Las fechas de las versiones y las notas, los recuentos de la barra de estado y de la barra de búsqueda, los centímetros de la regla y el interlineado: 1,15 en español, 1.15 en inglés.',
      zh: '版本和批注的日期、状态栏和查找栏中的计数、标尺的厘米数以及行距：西班牙语为 1,15，英语和中文为 1.15。',
    },
  },
  {
    title: { en: 'The letters on the buttons', es: 'Las letras de los botones', zh: '按钮上的字母' },
    answer: { en: 'Texts too', es: 'También son textos', zh: '也是文本' },
    color: 'orange',
    text: {
      en: 'Bold, italic, underline and strikethrough are drawn as letters: B I U S in English, N K S T in Spanish. They are mark.bold.letter and the like, to translate as the rest.',
      es: 'Negrita, cursiva, subrayado y tachado se dibujan como letras: B I U S en inglés, N K S T en español. Son mark.bold.letter y similares, para traducir como el resto.',
      zh: '加粗、倾斜、下划线和删除线以字母显示：英语为 B I U S，西班牙语为 N K S T。它们是 mark.bold.letter 等键，与其他文本一样可以翻译。',
    },
  },
];

/** Every function of the languages, as @rebodocs/react exports them. */
export const FUNCTIONS: { name: string; signature: string; returns: string; text: L }[] = [
  {
    name: 't',
    signature: 't(key: MessageKey, values?: Record<string, string | number>)',
    returns: 'string',
    text: {
      en: 'The text in the language of the interface, each {name} replaced by its value. A name with no value stays as it is written.',
      es: 'El texto en el idioma de la interfaz, con cada {name} reemplazado por su valor. Un nombre sin valor se queda como está escrito.',
      zh: '界面语言下的文本，其中每个 {name} 都会替换为对应的值。没有值的名称保持原样。',
    },
  },
  {
    name: 'getLocale',
    signature: 'getLocale()',
    returns: 'string',
    text: {
      en: 'The language of the interface: until one is set, the first of the browser’s languages it speaks, or English.',
      es: 'El idioma de la interfaz: hasta que se fije uno, el primero de los idiomas del navegador que habla, o inglés.',
      zh: '界面语言：在设置之前，为浏览器语言中它支持的第一种，否则为英语。',
    },
  },
  {
    name: 'setLocale',
    signature: 'setLocale(locale: string)',
    returns: 'nothing',
    text: {
      en: 'Sets the language: a code, one added, or a browser tag. One it does not speak gives English. Tells whoever listens, and nobody when it was already that one.',
      es: 'Fija el idioma: un código, uno añadido, o una etiqueta del navegador. Uno que no habla da inglés. Avisa a quien escuche, y a nadie si ya era ese.',
      zh: '设置语言：可以是代码、已添加的语言或浏览器标签。不支持的语言会变成英语。会通知监听者；如果已经是该语言，则不通知。',
    },
  },
  {
    name: 'onLocaleChange',
    signature: 'onLocaleChange(listener: () => void)',
    returns: '() => void',
    text: {
      en: 'Calls listener whenever the language changes. Returns how to stop.',
      es: 'Llama a listener cada vez que cambia el idioma. Devuelve cómo dejar de hacerlo.',
      zh: '语言改变时调用 listener。返回用于取消监听的函数。',
    },
  },
  {
    name: 'addLocale',
    signature: 'addLocale(locale: string, texts: Texts)',
    returns: 'nothing',
    text: {
      en: 'Adds a language, or changes texts of one there is. What it leaves out is said in English. When it is the language being shown, tells whoever listens. Until the application sets a language, it switches to this one if it is the language the browser asks for.',
      es: 'Añade un idioma, o cambia textos de uno que ya hay. Lo que deja fuera se dice en inglés. Cuando es el idioma que se muestra, avisa a quien escuche. Mientras la aplicación no fije un idioma, cambia a este si es el que pide el navegador.',
      zh: '添加一种语言，或修改已有语言的文本。未提供的文本以英语显示。如果是当前显示的语言，会通知监听者。在应用设置语言之前，如果这正是浏览器要求的语言，就会切换到它。',
    },
  },
  {
    name: 'plural',
    signature: 'plural(key: MessageKey, n: number, values?: Record<string, string | number>)',
    returns: 'string',
    text: {
      en: 'The text said of n things: the form the language gives for the plural category of n, or else the text of one when that category is “one”, or else the text of the key.',
      es: 'El texto dicho de n cosas: la forma que da el idioma para la categoría plural de n, o si no el texto de uno cuando esa categoría es “one”, o si no el texto de la clave.',
      zh: '描述 n 个事物的文本：该语言为 n 的复数类别提供的形式；没有时，如果类别是“one”则用单数文本；否则用该键的文本。',
    },
  },
  {
    name: 'messages',
    signature: 'messages(locale?: string)',
    returns: 'Messages',
    text: {
      en: 'Every text of a language, by key: English when none is given. A copy; changing it changes nothing.',
      es: 'Todos los textos de un idioma, por clave: inglés si no se da ninguno. Una copia; cambiarla no cambia nada.',
      zh: '某种语言的所有文本（按键）：不传参数时为英语。返回的是副本，修改它不会产生任何影响。',
    },
  },
  {
    name: 'locales',
    signature: 'locales()',
    returns: '{ code: string; name: string }[]',
    text: {
      en: 'The languages there are, each with its name in itself: what the menu lists.',
      es: 'Los idiomas que hay, cada uno con su nombre en sí mismo: lo que lista el menú.',
      zh: '现有的语言，每种都以其自身语言写出名称：即菜单中列出的内容。',
    },
  },
];
