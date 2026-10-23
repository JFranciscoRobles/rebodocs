<h1 align="center">@rebodocs/editor</h1>

<p align="center">
  A DOCX editor for any web page: the pages, caret and selection, and the interface around them. Plain TypeScript and the DOM, no framework.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rebodocs/editor"><img src="https://img.shields.io/npm/v/@rebodocs/editor?label=npm&color=0b57d0" alt="npm version"></a>
  <a href="https://github.com/JFranciscoRobles/rebodocs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-2e6b3c" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://rebodocs.com/docs/vanilla/">Without a framework</a> ·
  <a href="https://rebodocs.com/docs/editor-api/">Editor API</a> ·
  <a href="https://rebodocs.com/docs/styling/">Styling</a> ·
  <a href="https://rebodocs.com/docs/accessibility/">Accessibility</a>
</p>

---

The `Editor` holds the document, the selection and the undo history, paints
the layout `@rebodocs/core` computes, and takes keys, clicks and touches. The
pieces of interface around it are separate functions, so you take the ones
you want, or none. For React, use [`@rebodocs/react`](https://www.npmjs.com/package/@rebodocs/react),
which is built on this package.

## Install

```bash
npm install @rebodocs/editor
```

## Usage

```ts
import { Editor, createToolbar, createStatusBar, createBubble, createResponsive } from '@rebodocs/editor';

const editor = new Editor(document.querySelector('#pages')!); // the element needs a height
createToolbar(document.querySelector('#toolbar')!, editor);
createStatusBar(document.querySelector('#status')!, editor);
createBubble(editor);
createResponsive(document.body, editor);

editor.loadDocx(bytes);
editor.onChange(() => console.log(editor.pageCount));

const docx = editor.exportDocx();
const pdf = await editor.exportPdf('Contract');
```

## Pieces

| Function | What it adds |
| --- | --- |
| `createToolbar` | Formatting, insert and review, in two rows, tabs or one row. What does not fit folds into a tray. |
| `createSidebar` | The document menu: open, save, export, page setup, letterhead, language, appearance. A screen or a card. |
| `createPanel` | The side panel: outline, variables, comments, tracked changes, versions. |
| `createStatusBar` | Pages, words, the language of the text, the view, the zoom, who else is on the document. |
| `createRuler` | Margins, indents and tab stops, by mouse or keyboard. |
| `createBubble` | The bar beside the selection, with spelling suggestions and, on a phone, copy and paste. |
| `createFindBar` | Find and replace (⌘F, ⌘H). |
| `createFocusMode` | The pages alone, full screen. |
| `createResponsive` | Narrow windows and on-screen keyboards. |
| `createSpellChecker` | Spell checking with Hunspell dictionaries you give, read in a worker: `editor.spellChecker = createSpellChecker({ dictionaries: { es: { aff, dic } } })`. |
| `createVersionView` | Two versions compared, over the document. |

## Theming

Colours are CSS variables: the canvas, the selection and the caret
(`--dx-canvas`, `--dx-selection`, …), the ruler (`--dx-ruler-*`) and the
interface (`--dx-ui-*`). A dark theme comes with it:

```ts
editor.theme = 'dark';                               // or 'auto', to follow the system
applyTheme(document.querySelector('#app')!, 'dark'); // the element around the pieces
```

The base rules sit in a CSS layer, so utility classes such as Tailwind's win
over them. See [styling](https://rebodocs.com/docs/styling/).

## Languages and fonts

```ts
import fr from './texts/fr.json'; // npm run locale -- fr texts/fr.json, in the repository
addLocale('fr', fr);
setLocale('fr');

await addFonts([
  { family: 'Raleway', src: '/fonts/Raleway-Regular.ttf' },
  { family: 'Raleway', src: '/fonts/Raleway-Bold.ttf', bold: true },
]);
```

The interface ships in English and Spanish. Fonts you add are listed in the
toolbar, embedded in PDFs, and carried in the DOCX when their licence allows
(`editor.embedFonts = 'subset'` keeps only the characters used).

## How it works

- **No `contenteditable`.** A hidden `textarea` follows the caret; what is
  typed there goes into the model, and on-screen keyboards compose as usual.
- **Painting is placing.** Each piece of text is an absolutely positioned
  `span` where the layout put it; the browser never wraps a line. Only the
  pages near the view are drawn.
- **Zoom is a transform**, so zooming never re-breaks lines.
- **Accessible.** A screen reader hears what the caret moves over and where
  it is; every piece works from the keyboard (F6, Alt+F10), and high
  contrast is kept.

## Compatibility

Modern browsers. Spell checking runs in a Web Worker made from a Blob, so a
Content Security Policy must allow `worker-src blob:`.

## Status

0.10: ready to try in production; the API may change before 1.0. See the
[changelog](https://github.com/JFranciscoRobles/rebodocs/blob/main/CHANGELOG.md)
and the [known limits](https://rebodocs.com/docs/status/).

## License

[MIT](https://github.com/JFranciscoRobles/rebodocs/blob/main/LICENSE). Bundled third-party code is listed in `THIRD_PARTY_NOTICES.md`.
