// What the page "Phones and touch" says that is data, each checked in
// packages/editor/src (responsive.ts, platform.ts, pointer.ts: onTouchStart,
// onTouchMove, onTouchEnd, handle, renderHandles; bubble.ts: clipboard), by
// touching a real editor in a phone-sized headless Chrome, and by the tests of
// packages/editor/test/browser/pointer.test.ts. Each text in each language of the site.

import type { L } from '@/lib/i18n';

/** What a narrow window changes, from responsive.ts and fitGap in editor.ts. */
export const NARROW: { title: L; text: L }[] = [
  {
    title: { en: 'Pages as wide as the window', es: 'Páginas tan anchas como la ventana', zh: '页面与窗口同宽' },
    text: {
      en: 'Shown whole across it to begin with: a Letter page is at 46% on a phone 390 pixels wide. From there the zoom is the person’s.',
      es: 'Se muestran completas a lo ancho para empezar: una página Carta queda al 46% en un teléfono de 390 píxeles de ancho. Desde ahí, el zoom lo decide la persona.',
      zh: '一开始整页横向铺满窗口：在 390 像素宽的手机上，Letter 页面的缩放比例为 46%。之后的缩放由用户决定。',
    },
  },
  {
    title: { en: 'Less room around them', es: 'Menos espacio alrededor', zh: '页面周围留白更少' },
    text: {
      en: 'From 24 pixels around and between the pages to 8: every pixel beside a page is one less of it.',
      es: 'De 24 píxeles alrededor y entre las páginas a 8: cada píxel junto a una página es uno menos de ella.',
      zh: '页面周围和页面之间的留白从 24 像素减到 8 像素：页面旁边多一个像素，页面就少一个像素。',
    },
  },
  {
    title: { en: 'No ruler', es: 'Sin regla', zh: '不显示标尺' },
    text: {
      en: 'It is put away. The side panel opens over the document instead of making it narrower.',
      es: 'Se guarda. El panel lateral se abre sobre el documento en lugar de hacerlo más angosto.',
      zh: '标尺被收起。侧边栏覆盖在文档上方打开，而不是挤窄文档。',
    },
  },
  {
    title: { en: 'Bars that fold', es: 'Barras que se pliegan', zh: '工具栏自动折叠' },
    text: {
      en: 'The toolbar and the status bar put what does not fit in a menu, as they do at any width.',
      es: 'La barra de herramientas y la barra de estado ponen lo que no cabe en un menú, como hacen a cualquier ancho.',
      zh: '工具栏和状态栏会把放不下的内容收进菜单，在任何宽度下都是如此。',
    },
  },
  {
    title: { en: 'The zoom comes back', es: 'El zoom regresa', zh: '缩放会恢复' },
    text: {
      en: 'When the window is wide again, the pages go back to the zoom, or the fit, they had before.',
      es: 'Cuando la ventana vuelve a ser ancha, las páginas regresan al zoom, o al ajuste, que tenían antes.',
      zh: '窗口重新变宽后，页面会恢复到之前的缩放比例或适应方式。',
    },
  },
];

/** The gestures, from the touch handlers of pointer.ts. */
export const GESTURES: { gesture: L; text: L }[] = [
  {
    gesture: { en: 'Tap', es: 'Toque', zh: '轻点' },
    text: {
      en: 'Places the caret and brings up the keyboard. A handle stays under the caret for four seconds, to drag it exactly where it should be.',
      es: 'Coloca el cursor y saca el teclado. Un tirador se queda bajo el cursor cuatro segundos, para arrastrarlo exactamente adonde debe ir.',
      zh: '放置光标并弹出键盘。光标下方会显示拖动手柄四秒钟，可以把光标精确拖到需要的位置。',
    },
  },
  {
    gesture: { en: 'Tap on the caret', es: 'Toque sobre el cursor', zh: '轻点光标' },
    text: {
      en: 'Again where the caret is, or on its handle: brings up the bar with Paste, Paste as text and Select all.',
      es: 'Otra vez donde está el cursor, o sobre su tirador: saca la barra con Pegar, Pegar como texto y Seleccionar todo.',
      zh: '再次点击光标处或其手柄：弹出包含“粘贴”“粘贴为纯文本”和“全选”的工具条。',
    },
  },
  {
    gesture: { en: 'Double tap', es: 'Doble toque', zh: '双击' },
    text: { en: 'Selects the word. A third tap, the paragraph.', es: 'Selecciona la palabra. Un tercer toque, el párrafo.', zh: '选中词语。第三次点击选中整个段落。' },
  },
  {
    gesture: { en: 'Hold', es: 'Mantener presionado', zh: '长按' },
    text: {
      en: 'Selects the word under the finger; without lifting it, the selection is drawn out.',
      es: 'Selecciona la palabra bajo el dedo; sin levantarlo, la selección se extiende.',
      zh: '选中手指下的词语；不抬起手指继续移动，即可扩展选区。',
    },
  },
  {
    gesture: { en: 'Handles', es: 'Tiradores', zh: '拖动手柄' },
    text: {
      en: 'One at each end of a selection. Dragged near the top or the bottom of the window, the document scrolls under them.',
      es: 'Uno en cada extremo de una selección. Arrastrados cerca de la parte de arriba o de abajo de la ventana, el documento se desplaza bajo ellos.',
      zh: '选区两端各有一个手柄。拖到窗口顶部或底部附近时，文档会在手柄下方滚动。',
    },
  },
  {
    gesture: { en: 'Swipe', es: 'Deslizar', zh: '滑动' },
    text: { en: 'Scrolls, without moving the caret.', es: 'Desplaza, sin mover el cursor.', zh: '滚动页面，不移动光标。' },
  },
  {
    gesture: { en: 'Pinch', es: 'Pellizcar', zh: '双指缩放' },
    text: {
      en: 'Zooms around the fingers: what is under them stays under them, and the two fingers carry the page as they go.',
      es: 'Hace zoom alrededor de los dedos: lo que está bajo ellos se queda bajo ellos, y los dos dedos llevan la página consigo.',
      zh: '以手指为中心缩放：手指下的内容始终保持在手指下，双指移动时页面也随之移动。',
    },
  },
];

export const KNOW: L[] = [
  {
    en: 'It was checked in a phone emulated in Chrome, with real touch events, and tried on one real phone. On-screen keyboards differ (Gboard, iOS, Samsung): say what yours does.',
    es: 'Se comprobó en un teléfono emulado en Chrome, con eventos táctiles reales, y se probó en un teléfono real. Los teclados de pantalla varían (Gboard, iOS, Samsung): cuéntanos qué hace el tuyo.',
    zh: '已在 Chrome 模拟的手机中用真实触控事件验证，并在一部真机上试用过。各家屏幕键盘（Gboard、iOS、三星）表现不同：欢迎反馈你的键盘的情况。',
  },
  {
    en: 'No capital letter is put by itself at the start of a sentence, and the keyboard is asked not to correct: the field has autocapitalize and autocorrect off.',
    es: 'No se pone una mayúscula sola al inicio de una oración, y se le pide al teclado que no corrija: el campo tiene autocapitalize y autocorrect apagados.',
    zh: '不会在句首自动大写，也会要求键盘不要自动纠正：输入框关闭了 autocapitalize 和 autocorrect。',
  },
  {
    en: 'A keyboard that goes back and rewrites a word already written is not followed: the word being typed is.',
    es: 'Un teclado que regresa y reescribe una palabra ya escrita no se sigue: sí la palabra que se está escribiendo.',
    zh: '如果键盘回头改写已经输入完的词，这种修改不会被跟随；正在输入的词则会跟随。',
  },
  {
    en: 'Chinese and Japanese are typed with the keyboard that composes them (pinyin, kana): what is being composed shows in place, and the characters it ends in take its place.',
    es: 'El chino y el japonés se escriben con el teclado que los compone (pinyin, kana): lo que se está componiendo se ve en su lugar, y los caracteres en que termina lo reemplazan.',
    zh: '中文和日文通过输入法（拼音、假名）输入：正在组合的内容会直接显示在原位，确认后由最终的字符替换。',
  },
];
