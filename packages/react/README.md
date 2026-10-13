# @rebodocs/react

The editor for a React application: a component with everything in it, or a
set of hooks to build an interface of your own.

## Purpose

To put the editor in a screen of another application (it was made for a CRM
written in Next.js) without an iframe, with the application deciding where
documents are kept, who may open them and what the interface looks like.

```bash
npm install @rebodocs/react
```

It is built as a bundle: `@rebodocs/core`, `@rebodocs/editor` and the
collaboration client are inside it, so it installs as one dependency. React
18 or later is the only peer.

[npm](https://www.npmjs.com/package/@rebodocs/react) · [documentation](https://rebodocs.com/docs/) · [source](https://github.com/JFranciscoRobles/rebodocs/tree/main/packages/react)

## Two ways to use it

### The whole editor

```tsx
'use client';
import { DocsEditor } from '@rebodocs/react';

<DocsEditor
  docx={file}                       // Uint8Array or ArrayBuffer; empty document without it
  name="contract.docx"
  author="Ana"
  locale="en"
  onSave={(docx, name) => upload(docx, name)}
  features={{ files: false, assistant: false }}
/>
```

It draws the toolbar, ruler, side panel, pages and status bar in the element
it is given, which must have a height. On the server it renders an empty
element and mounts in the browser.

| Prop | What it does |
| --- | --- |
| `docx` | The document to open. |
| `collab` | `{ url, room, ticket }`: the document is a shared room; see `@rebodocs/collab`. |
| `onSave` | Receives the DOCX when the person saves (menu or ⌘S). |
| `name`, `author`, `locale` | Follow their props without remounting. |
| `letterhead` | A picture to use as letterhead whatever the document came with; `null` for none. |
| `fonts`, `locales` | Fonts and languages of the application's own. |
| `features` | What is switched on: `menu`, `panel`, `ruler`, `statusBar`, `find`, `title`, `responsive` (on by default); `files`, `language`, `assistant`, `share` (off by default). |
| `onChange`, `onCollab`, `onError` | Notifications. |
| `onReady` / `ref` | The handle: `exportDocx()`, `dirty`, `editor`, `collab`. |

### Headless

```tsx
import { DocsProvider, DocsSurface, useDocs } from '@rebodocs/react';

function Toolbar() {
  const { state, commands } = useDocs();
  return (
    <button className={state.bold ? 'bg-blue-100' : ''} onClick={() => commands.toggleMark('bold')}>
      B
    </button>
  );
}

<DocsProvider docx={file} onSave={upload}>
  <Toolbar />
  <DocsSurface className="h-full bg-neutral-100" />
</DocsProvider>
```

`state` is a plain snapshot (formatting at the selection, page, zoom, what can
be undone…) that is the same object until something in it changes.
`commands` are the editor's methods, and give the keyboard back to the
document after each one.

| Hook | Gives |
| --- | --- |
| `useDocs()` | `state`, `commands`, `editor`, `ready`. |
| `useDocsValue(select, fallback)` | Anything else derived from the editor, re-rendering only when it changes. |
| `useDocsFind()` | Find and replace. |
| `useDocsLink()`, `useDocsNotes()`, `useDocsOutline()` | Links, comments, the outline of headings. |
| `useDocsVariables()` | Template variables: list, insert, fill. |
| `useDocsStyles()`, `useDocsPage()` | Paragraph styles; page setup, numbering and letterhead. |
| `useDocsSelectionBox()` | Where the selection is on screen, to place a panel beside it. |
| `useDocsResponsive()` | Fits pages to a narrow window; reports the on-screen keyboard. |
| `useDocsBubble()` | The bar beside the selection, when the provider was given `bubble`. |

The editor answers its own keys (⌘B, ⌘Z, ⌘S, ⌘-click on a link…). Three open
something only an interface has, and are yours to answer, as props of
`DocsProvider`: `onLinkKey()` for ⌘K, and `onFindKey(replace)` for ⌘F and ⌘H.
Each is taken from the browser only while it is given.

`<DocsProvider bubble>` adds the bar that comes up beside the selection: copy,
cut and paste on a touch screen, a variable made of the words selected, a
link, a note. It is the one headless piece with a look of its own (classes
`dx-bb…`); with it, ⌘K asks for a link there unless there is an `onLinkKey`.

`mountDocs(element, options)` (also at `@rebodocs/react/mount`) is the whole
editor without React, for any other framework.

## Building and publishing

```bash
npm run build:react                  # builds it and packs packages/react/rebodocs-react-<version>.tgz
npm publish -w @rebodocs/react       # builds it again, and publishes it
```

The bundle starts with `'use client'`, so it can be imported from a Next.js
app directory. It was tried in Next.js 16 with React 19 and Tailwind 4.

## Where it can improve

- **Publishing.** It is on npm as one bundle. The other packages should be
  built and published too, so that it can depend on them and not carry them.
- **Headless coverage.** The ruler has no headless version, and the bar
  beside the selection comes as it is drawn or not at all: there is no hook
  that gives its actions to draw one's own. Hooks for tables and pictures
  would save reaching for `editor`.
- **Bundle size.** Everything is in one file of about 550 kB (160 kB
  gzipped). The collaboration client and the MCP bridge could be separate
  entry points loaded only when used.
- **Controlled document.** The document is given once (`docx`) and read back
  on save. There is no `value`/`onChange` pair with the document as data,
  which some applications will expect.
- **Types.** Declarations are emitted by `scripts/types.mjs` as a tree
  mirroring the source of the packages. A single rolled-up `.d.ts` would be
  cleaner to consume.
- **Tests.** None of its own: it was verified by hand in a scratch Next.js
  application. Component tests belong here.
