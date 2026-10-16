# @rebodocs/editor

[npm](https://www.npmjs.com/package/@rebodocs/editor) · `npm install @rebodocs/editor`

The editor in the browser: the pages, the caret and the selection, and the
pieces of interface around them. Plain TypeScript and the DOM, with no
framework.

## Purpose

To be the one place where a person's keys, clicks and touches become changes
to a document, and where the layout `@rebodocs/core` computes becomes something to
look at. It is separate from React so that it can be used anywhere, and its
interface pieces are separate from the `Editor` class so that an application
can take only the ones it wants, or none.

## What is in it

| Piece | What it is |
| --- | --- |
| `Editor` | The pages in an element. Holds the document, the selection and the undo history; paints the layout; takes the keyboard, the mouse and touch. The edges of a table's columns and rows, and its bottom right corner, are dragged to resize it. Everything else talks to it through public methods. |
| `createToolbar` | One row of formatting; what does not fit folds into a "more" tray. Its table menu has rows, columns, merging, heading rows, row height, where the text sits in a cell and the lines around it, and deleting the table; its columns menu sets the text in one, two or three columns. |
| `createSidebar` | The document menu: open, save, export, page setup, letterhead, language. |
| `createPanel` | Side panel: outline, template variables, notes. |
| `createStatusBar` | Page count, words, view, zoom, who is on the document. Drops what matters least as it gets narrower. |
| `createBubble` | A small bar beside the selection with what can be done to it: to text, a link, a note, a picture, or a table (deleting it among it). A tap on ⌘ (Ctrl elsewhere) shows it. |
| `createFindBar`, `createRuler` | Find and replace; the ruler with indents and margins. |
| `createResponsive` | Makes do with a narrow window and an on-screen keyboard. |
| `addLocale`, `setLocale`, `t` | The texts of the interface, by key. |
| `addFont`, `addFonts` | Fonts of the application's own. |

## Using it

```ts
import { Editor, createToolbar, createStatusBar, createBubble, createResponsive } from '@rebodocs/editor';

const editor = new Editor(document.querySelector('#pages')!);
createToolbar(document.querySelector('#toolbar')!, editor);
createStatusBar(document.querySelector('#status')!, editor);
createBubble(editor);
createResponsive(document.body, editor);

editor.loadDocx(bytes);
editor.onChange(() => console.log(editor.pageCount));
const docx = editor.exportDocx();
const pdf = await editor.exportPdf('Contract');
```

The element the editor is given needs a height. Colours can be changed with
CSS variables (`--dx-canvas`, `--dx-page-shadow`, `--dx-selection`,
`--dx-caret`, `--dx-handle`); the base rule sits in a CSS layer, so utility
classes from a framework such as Tailwind win over it.

### Languages

```bash
npm run locale -- fr texts/fr.json     # every text, in English, to translate
```

```ts
import fr from './texts/fr.json';
addLocale('fr', fr);
setLocale('fr');
```

The language shows up in the menu by itself. Running the command again on
the same file keeps what is translated and adds what the interface has
gained since.

### Fonts

```ts
await addFonts([
  { family: 'Raleway', src: '/fonts/Raleway-Regular.ttf' },
  { family: 'Raleway', src: '/fonts/Raleway-Bold.ttf', bold: true },
]);
```

The font is listed in the toolbar, open documents are measured again with
it, and PDFs embed it when the file is TrueType. For a font the page already
loads with CSS, `addFont({ family: 'Raleway' })` is enough.

## How it works

- **Painting is placing.** Every piece of text is an absolutely positioned
  `span` at coordinates the layout gave. The browser never wraps a line.
- **No `contenteditable`.** A hidden `textarea` follows the caret and has the
  focus. What is typed arrives there and is inserted into the model. A word
  an on-screen keyboard is still composing is shown as it changes.
- **Zoom is a transform.** Pages are laid out at their real size and scaled,
  so zooming does not re-break lines. Pinching and Ctrl+wheel zoom around the
  point under the fingers or the pointer.
- **Touch.** A tap places the caret, two select a word, a hold selects and
  extends; the selection has handles. Two fingers zoom and drag the page.
- **The views** are of the editor, not of the document: one page, two, a
  grid, or (optionally) the text set to the width of the window.

## Where it can improve

- **Tests.** The interface is checked with scripted runs of headless Chrome
  that are not in the repository. Bringing them in as a browser test suite
  (Playwright) is the single most useful thing to do here.
- **`editor.ts` is one file of about 3,650 lines.** Input (keyboard, mouse,
  touch), painting and commands should be split into modules.
- **Accessibility.** The pages are positioned spans a screen reader cannot
  follow. It needs an accessible mirror of the text, or ARIA live
  announcements at least, and keyboard access to every menu.
- **Real phones.** Touch was tried on one phone. On-screen keyboards differ
  (Gboard, iOS, Samsung), and autocorrection that rewrites an earlier word is
  deliberately avoided, not supported. No capital letter is put at the start
  of a sentence.
- **Large documents.** Every page is in the DOM. Painting only the pages near
  the window would keep long documents fast.
- **Editing gaps.** No drag and drop of text, no rich paste (pasting keeps
  text only), no format painter, no spell check (the hidden field cannot use
  the browser's).
- **Theming.** A handful of CSS variables; the interface pieces have fixed
  light colours and no dark mode.
- **English texts** were translated from Spanish and need a native review.
