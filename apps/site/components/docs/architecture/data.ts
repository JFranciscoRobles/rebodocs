// What the page "How it works" says that is data: the path of a keystroke, and
// where each thing lives in the repository. Each text in each language of the
// site; the code stays as it is written.

import type { L } from '@/lib/i18n';

export type Stage = 'input' | 'operation' | 'doc' | 'layout' | 'paint' | 'others';

export const STAGES: [Stage, L][] = [
  ['input', { en: 'Hidden textarea', es: 'Textarea oculto', zh: '隐藏的 textarea' }],
  ['operation', { en: 'Operation', es: 'Operación', zh: '操作' }],
  ['doc', { en: 'New Doc', es: 'Doc nuevo', zh: '新的 Doc' }],
  ['layout', { en: 'Lines and pages', es: 'Líneas y páginas', zh: '行与页' }],
  ['paint', { en: 'Placed spans', es: 'Spans colocados', zh: '定位的 span' }],
  ['others', { en: 'The others', es: 'Los demás', zh: '其他人' }],
];

export interface Step {
  stage: Stage;
  title: L;
  text: L;
  code: string;
  /** The section of the page that explains it. */
  more: [title: L, id: string];
}

/** The letter x typed in paragraph 3, from the key to the screen of everyone on the document. */
export const STEPS: Step[] = [
  {
    stage: 'input',
    title: { en: 'A key, in a hidden textarea', es: 'Una tecla, en un textarea oculto', zh: '按键进入隐藏的 textarea' },
    text: {
      en: 'The focus is in a textarea that follows the caret. There is no contenteditable: the browser edits nothing, and what is typed arrives there.',
      es: 'El foco está en un textarea que sigue al cursor. No hay contenteditable: el navegador no edita nada, y lo que se escribe llega ahí.',
      zh: '焦点位于一个跟随光标的 textarea 中。没有 contenteditable：浏览器不编辑任何内容，输入的内容都到达这里。',
    },
    code: `// what arrives in the textarea, at the caret
'x'  →  paragraph 3, offset 12`,
    more: [{ en: 'Painting is placing', es: 'Pintar es colocar', zh: '绘制即定位' }, 'painting'],
  },
  {
    stage: 'operation',
    title: { en: 'It becomes an operation', es: 'Se convierte en una operación', zh: '变成一个操作' },
    text: {
      en: 'An operation is a pure function: it takes a document and gives another. Nothing is changed in place.',
      es: 'Una operación es una función pura: toma un documento y da otro. Nada se cambia en su sitio.',
      zh: '操作是纯函数：接收一份文档，返回另一份。不会原地修改任何内容。',
    },
    code: `const next = insertText(doc, { para: 3, offset: 12 }, 'x').doc;`,
    more: [{ en: 'The document is a value', es: 'El documento es un valor', zh: '文档是一个值' }, 'value'],
  },
  {
    stage: 'doc',
    title: { en: 'A new document, sharing the rest', es: 'Un documento nuevo, que comparte el resto', zh: '新文档，共享其余部分' },
    text: {
      en: 'The new document is the old one with one paragraph made again. Undo is keeping the old one; what changed is found with ===.',
      es: 'El documento nuevo es el viejo con un párrafo hecho de nuevo. Deshacer es guardar el viejo; lo que cambió se encuentra con ===.',
      zh: '新文档就是旧文档，只是重新生成了一个段落。撤销就是保留旧文档；用 === 就能找出变化。',
    },
    code: `next.paragraphs[0] === doc.paragraphs[0];   // true: the very same object
next.paragraphs[3] === doc.paragraphs[3];   // false: the one typed in`,
    more: [{ en: 'The document is a value', es: 'El documento es un valor', zh: '文档是一个值' }, 'value'],
  },
  {
    stage: 'layout',
    title: { en: 'Lines and pages, again where needed', es: 'Líneas y páginas, de nuevo donde hace falta', zh: '只在需要处重新分行分页' },
    text: {
      en: 'A paragraph that is the same object as last time keeps its lines; only the one typed in is broken again. The browser is asked one thing: how wide a piece of text is.',
      es: 'Un párrafo que es el mismo objeto que la última vez conserva sus líneas; solo el que se escribió se vuelve a cortar. Al navegador se le pregunta una sola cosa: qué ancho tiene un trozo de texto.',
      zh: '与上次是同一对象的段落保留原来的分行；只有输入过的段落会重新分行。只向浏览器询问一件事：一段文字有多宽。',
    },
    code: `// the one question asked of the browser, or of a font file in Node
measure('rent on the', '15px Inter')   // → 82.4`,
    more: [{ en: 'Layout is ours', es: 'La composición es nuestra', zh: '排版由我们完成' }, 'layout'],
  },
  {
    stage: 'paint',
    title: { en: 'Each piece placed where it goes', es: 'Cada trozo colocado donde va', zh: '每段文字放到应在的位置' },
    text: {
      en: 'Each piece of text is a span at the coordinates the layout gave. The browser never wraps a line; the caret and the selection are drawn by the editor.',
      es: 'Cada trozo de texto es un span en las coordenadas que dio la composición. El navegador nunca corta una línea; el cursor y la selección los dibuja el editor.',
      zh: '每段文字都是一个 span，位于排版给出的坐标处。浏览器从不自动换行；光标和选区由编辑器绘制。',
    },
    code: `<!-- simplified -->
<span style="left: 96px; top: 212px">rent on the</span>`,
    more: [{ en: 'Painting is placing', es: 'Pintar es colocar', zh: '绘制即定位' }, 'painting'],
  },
  {
    stage: 'others',
    title: { en: 'Sent to the others', es: 'Enviado a los demás', zh: '发送给其他人' },
    text: {
      en: 'In a shared document the same step travels as a change that names the paragraph by its id, so it means the same after someone added a paragraph above.',
      es: 'En un documento compartido el mismo paso viaja como un cambio que nombra el párrafo por su id, así que significa lo mismo después de que alguien añadió un párrafo encima.',
      zh: '在共享文档中，同一步骤会作为按 id 指明段落的更改传送，因此即使有人在上方添加了段落，含义也不变。',
    },
    code: `// in words, what the change says
"in paragraph k3, at offset 12, insert 'x'"`,
    more: [{ en: 'Collaboration', es: 'Colaboración', zh: '协作' }, 'collab'],
  },
];

export interface Place {
  paths: string[];
  what: L;
}

/** Where things live, by package. */
export const PLACES: { pkg: string; places: Place[] }[] = [
  {
    pkg: '@rebodocs/core',
    places: [
      { paths: ['packages/core/src/model.ts'], what: { en: 'The shape of a document.', es: 'La forma de un documento.', zh: '文档的结构。' } },
      { paths: ['packages/core/src/ops.ts'], what: { en: 'The operations, and the files beside it.', es: 'Las operaciones, y los archivos a su lado.', zh: '各种操作，以及旁边的相关文件。' } },
      { paths: ['packages/core/src/layout.ts'], what: { en: 'Lines and pages.', es: 'Líneas y páginas.', zh: '分行与分页。' } },
      { paths: ['packages/core/src/docx/'], what: { en: 'Reading and writing DOCX.', es: 'Leer y escribir DOCX.', zh: '读写 DOCX。' } },
      {
        paths: ['packages/core/src/stories.ts', 'footnotes.ts', 'textboxes.ts', 'sections.ts'],
        what: { en: 'Headers, footers, footnotes, text boxes and sections.', es: 'Encabezados, pies de página, notas al pie, cuadros de texto y secciones.', zh: '页眉、页脚、脚注、文本框和分节。' },
      },
      {
        paths: ['packages/core/src/revisions.ts', 'versions.ts'],
        what: { en: 'Tracked changes; comparing and restoring versions.', es: 'Control de cambios; comparar y restaurar versiones.', zh: '修订；比较和还原版本。' },
      },
      { paths: ['packages/core/src/pdf.ts'], what: { en: 'PDF, with font subsetting.', es: 'PDF, con subconjuntos de fuentes.', zh: 'PDF，包括字体子集化。' } },
    ],
  },
  {
    pkg: '@rebodocs/editor',
    places: [
      { paths: ['packages/editor/src/editor.ts'], what: { en: 'The Editor: its API and its state.', es: 'El Editor: su API y su estado.', zh: 'Editor：它的 API 和状态。' } },
      {
        paths: ['packages/editor/src/painter.ts', 'pointer.ts', 'keys.ts'],
        what: {
          en: 'The pages and the caret drawn; the mouse and the fingers; the keys and the clipboard.',
          es: 'Las páginas y el cursor dibujados; el ratón y los dedos; las teclas y el portapapeles.',
          zh: '绘制页面和光标；鼠标与手指；按键与剪贴板。',
        },
      },
      { paths: ['packages/editor/src/'], what: { en: 'One file per interface piece.', es: 'Un archivo por cada pieza de la interfaz.', zh: '每个界面组件一个文件。' } },
    ],
  },
  {
    pkg: '@rebodocs/collab',
    places: [
      { paths: ['packages/collab/src/changes.ts'], what: { en: 'The change format and its transform.', es: 'El formato de los cambios y su transform.', zh: '更改格式及其 transform。' } },
      { paths: ['packages/collab/src/room.ts', 'server.ts'], what: { en: 'A room, and the HTTP around it.', es: 'Una sala, y el HTTP a su alrededor.', zh: '房间及其外围的 HTTP。' } },
      {
        paths: ['packages/collab/src/sync.ts', 'session.ts'],
        what: { en: 'An editor kept in step with its room, and its connection.', es: 'Un editor al paso de su sala, y su conexión.', zh: '与房间保持同步的编辑器及其连接。' },
      },
    ],
  },
];
