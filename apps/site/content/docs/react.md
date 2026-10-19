# React component

`DocsEditor` is the whole editor in one component: toolbar, ruler, side panel, pages and status bar. It mounts in your page, not in an iframe.

```bash
npm install @rebodocs/react
```

The package is [`@rebodocs/react` on npm](https://www.npmjs.com/package/@rebodocs/react). Everything it exports is listed, with an example each, in [Components and hooks](/docs/components/).

```tsx
'use client';
import { DocsEditor } from '@rebodocs/react';

export function Contract({ file }: { file: Uint8Array }) {
  return (
    <div className="h-screen">
      <DocsEditor
        docx={file}
        name="contract.docx"
        author="Ana"
        locale="en"
        onSave={(docx, name) => upload(docx, name)}
      />
    </div>
  );
}
```

The element around it must have a height: the editor fills what it is given.

It is safe to render on a server. There it draws an empty element, and mounts once the page is in the browser. The bundle starts with `'use client'`.

## Props

| Prop | What it does |
| --- | --- |
| `docx` | The document to open: `Uint8Array` or `ArrayBuffer`. An empty document without it. Changing it opens the new one. |
| `collab` | `{ url, room, ticket }`. The document is a shared room and comes from there. See [collaboration](/docs/collaboration/). |
| `onSave` | Called with `(docx, name)` when the person saves, from the menu or with ⌘S / Ctrl+S. Keeping the file is yours to do. |
| `name` | What the document is called: shown in the toolbar and given to what is exported. |
| `author` | Who the person is: what their comments are signed with, and what others see them as. |
| `locale` | Language of the interface: `'es'`, `'en'`, or one you add. |
| `locales` | More languages, as `{ fr: texts }`. See [languages](/docs/languages/). |
| `fonts` | Typefaces of your own, as `[{ family, src }]`. See [fonts](/docs/fonts/). |
| `embedFonts` | Whether the DOCX carries the fonts given in `fonts` that its text is in (TrueType ones whose licence lets them). On unless `false`. |
| `versions` | Where your application keeps the versions of the document: `{ list, load, save? }`. The side panel then lists, compares and restores them. See [versions](/docs/versions/). |
| `letterhead` | A picture to use as letterhead, whatever the document came with; `null` for none. See [letterheads](/docs/letterhead/). |
| `features` | What is switched on. See below. |
| `onChange` | Called with the editor when the document changes. |
| `onCollab` | Called with the connection state and who is on the document. |
| `onError` | Told what went wrong, in the language of the interface. Without it, an `alert`. |
| `onReady`, `ref` | Give the handle, once the editor is there. |
| `className`, `style` | For the element the editor is in. |

`name`, `author`, `locale` and `letterhead` follow their props without mounting the editor again.

## Features

What an application of its own may not want is off until asked for. What every document needs is on until switched off.

| Feature | Default | What it is |
| --- | --- | --- |
| `menu` | on | The document menu: export, page setup, letterhead. |
| `panel` | on | The side panel: outline, variables, comments, tracked changes, and versions when given. |
| `ruler` | on | The ruler, with indents and margins. |
| `statusBar` | on | Pages, words, view and zoom. |
| `find` | on | Find and replace. |
| `title` | on | The name of the document in the toolbar. |
| `responsive` | on | Making do with a narrow window. See [phones and touch](/docs/mobile/). |
| `files` | off | Opening a file from the disk in place of the document, and saving a copy to it. |
| `language` | off | The choice of language in the menu. |
| `assistant` | off | The button that lets an AI assistant in: `true`, or `{ url, token }`. |
| `share` | off | The button that starts sharing from here: `{ url, token, link }`. |

```tsx
<DocsEditor docx={file} features={{ ruler: false, files: true }} />
```

## The handle

`onReady` and `ref` give an object to reach the editor from outside:

```tsx
const docs = useRef<DocsHandle>(null);

<DocsEditor ref={docs} docx={file} />
<button onClick={() => upload(docs.current!.exportDocx())}>Save</button>
```

| Member | What it is |
| --- | --- |
| `exportDocx()` | The document as a DOCX, as it is now. |
| `dirty` | Whether it changed since it was opened or last saved. |
| `editor` | The `Editor` itself. See [Editor API](/docs/editor-api/). |
| `collab` | The session with the others, while there is one. |
| `setName`, `setAuthor`, `setLocale`, `setLetterhead` | Change what the props set. |
| `focus()` | Gives the keyboard to the document. |

## Saving

There are two ways, and they can be combined:

- **The person saves.** Pass `onSave`. The menu shows "Save", ⌘S works, and the dot beside the title says there are unsaved changes.
- **You save.** Call `exportDocx()` from the handle whenever you like: on a timer, on leaving the page, from your own button.

With `collab`, the room saves itself through your backend and neither is needed.

## Without React

The same editor mounts in any element, with the same options:

```ts
import { mountDocs } from '@rebodocs/react/mount';

const docs = mountDocs(document.querySelector('#editor')!, { docx: bytes, locale: 'en' });
docs.destroy();
```
