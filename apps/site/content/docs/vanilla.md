# Without a framework

```bash
npm install @rebodocs/editor
```

[`@rebodocs/editor`](https://www.npmjs.com/package/@rebodocs/editor) is plain TypeScript and the DOM. The `Editor` class is the pages; everything around it is a separate piece you create if you want it.

```html
<div id="toolbar"></div>
<div id="pages" style="height: 80vh"></div>
<div id="status"></div>
```

```ts
import { Editor, createToolbar, createStatusBar, createBubble, createResponsive } from '@rebodocs/editor';

const editor = new Editor(document.querySelector('#pages')!);
const toolbar = createToolbar(document.querySelector('#toolbar')!, editor);
createStatusBar(document.querySelector('#status')!, editor);
createBubble(editor);
createResponsive(document.body, editor);

editor.loadDocx(bytes);
editor.onChange(() => console.log(editor.pageCount, 'pages'));

const docx = editor.exportDocx();
const pdf = await editor.exportPdf('Contract');
```

The element given to the editor needs a height.

> For the whole editor at once, with its menu and panels, and nothing to wire, `mountDocs` from `@rebodocs/react/mount` does it without React: see below.

## The pieces

| Piece | What it is |
| --- | --- |
| `new Editor(element)` | The pages. Holds the document, the selection and the history. |
| `createToolbar(el, editor, options)` | One row of formatting. What does not fit folds into a tray. |
| `createSidebar(editor, options)` | The document menu, as a drawer: open, save, export, page, letterhead, language. |
| `createPanel(el, editor)` | Side panel: outline, template variables, comments. |
| `createStatusBar(el, editor, options)` | Pages, words, view, zoom, who is on the document. |
| `createBubble(editor)` | A bar beside the selection with what can be done to it. |
| `createFindBar(editor)` | Find and replace. |
| `createRuler(el, editor)` | The ruler. |
| `createResponsive(shell, editor)` | Narrow windows and the on-screen keyboard. |

Every piece has `destroy()`. They take their texts when created, so to change language with everything open, destroy and create them again; the editor and its history stay.

The smallest page that wires all of them together is `apps/playground/src/main.ts`.

## The whole thing at once

`mountDocs` builds that layout for you, in any element, with the options of the [React component](/docs/react/):

```ts
import { mountDocs } from '@rebodocs/react/mount';

const docs = mountDocs(document.querySelector('#editor')!, {
  docx: bytes,
  name: 'contract.docx',
  locale: 'en',
  onSave: (docx, name) => upload(docx, name),
});
```

## Working with the editor

See [Editor API](/docs/editor-api/) for its methods. A few to start with:

```ts
editor.setSelection({ para: 0, offset: 0 }, { para: 0, offset: 5 });
editor.toggleMark('bold');
editor.insertText('Hello');
editor.undo();
editor.setZoom(1.25);
```
