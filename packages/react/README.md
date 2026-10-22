<p align="center">
  <img src="https://rebodocs.com/logo.svg" alt="" width="56" height="56">
</p>

<h1 align="center">@rebodocs/react</h1>

<p align="center">
  A DOCX editor for React and Next.js: one component with everything in it, or headless hooks for an interface of your own.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rebodocs/react"><img src="https://img.shields.io/npm/v/@rebodocs/react?label=npm&color=0b57d0" alt="npm version"></a>
  <a href="https://github.com/JFranciscoRobles/rebodocs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-2e6b3c" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/react-%E2%89%A518-149eca" alt="React 18 or later">
</p>

<p align="center">
  <a href="https://rebodocs.com/demo/"><b>Live demo</b></a> ·
  <a href="https://rebodocs.com/docs/react/">Component</a> ·
  <a href="https://rebodocs.com/docs/headless/">Headless</a> ·
  <a href="https://rebodocs.com/docs/components/">API reference</a>
</p>

---

The editor mounts in your page, not in an iframe, and your application
decides where documents are kept, who may open them and how the interface
looks. It is one bundle: the engine, the editor and the collaboration client
are inside, and React is the only peer.

## Install

```bash
npm install @rebodocs/react
```

## The whole editor

```tsx
'use client';
import { DocsEditor } from '@rebodocs/react';

export function Contract({ file }: { file: Uint8Array }) {
  return (
    <div style={{ height: '100vh' }}>
      <DocsEditor
        docx={file}
        name="contract.docx"
        author="Ana"
        onSave={(docx, name) => upload(docx, name)}
      />
    </div>
  );
}
```

Toolbar, ruler, side panel, pages and status bar, in the element it is given,
which needs a height. It is safe to render on a server: there it draws an
empty element, and mounts in the browser.

### Props

| Prop | Type | Description |
| --- | --- | --- |
| `docx` | `Uint8Array \| ArrayBuffer` | The document to open; an empty one without it. |
| `name`, `author` | `string` | What the document is called, and who signs notes and changes. |
| `onSave` | `(docx, name) => void \| Promise` | Called on ⌘S, from the menu, or with `handle.save()`. Keeping the file is yours. |
| `locale`, `locales` | `string`, `Record<string, Texts>` | The language of the interface, and languages of your own. Default: the browser's, else English. |
| `language` | `string` | The language the text is in (`'es-MX'`): written in the DOCX, used for dates and amounts of variables, and for spelling. |
| `spellcheck` | `SpellChecker` | Spell checking: `createSpellChecker({ dictionaries })` with Hunspell dictionaries you serve. |
| `theme` | `'light' \| 'dark' \| 'auto'` | The colours of the interface. The pages stay white. |
| `versions` | `{ list, load, save? }` | Versions your application keeps, listed, compared and restored in the side panel. |
| `collab` | `{ url, room, ticket? }` | The document is a shared room on your collaboration server. |
| `letterhead` | `Blob \| { bytes, type } \| string \| null` | A picture behind every page, whatever the document came with. |
| `fonts`, `embedFonts` | `FontSource[]`, `boolean \| 'subset'` | Typefaces of your own, and whether the DOCX carries them. |
| `unsaved` | `boolean` | `docx` is a draft with changes not saved yet. |
| `features` | `DocsFeatures` | What is switched on, and the layout. See below. |
| `onChange`, `onCollab`, `onError` | functions | Notifications. |
| `ref`, `onReady` | `DocsHandle` | The handle: `exportDocx()`, `save()`, `dirty`, `showPanel()`, `setTheme()`, `editor`, … |

Every prop and what happens when it changes is in the
[documentation](https://rebodocs.com/docs/react/#props).

### Features

```tsx
<DocsEditor features={{ files: true, theme: true, panel: 'rail', statusBar: 'chips' }} />
```

On unless switched off: `menu` (`'screen'` or `'card'`), `panel` (`'right'`,
`'left'` or `'rail'`), `toolbar` (`'two-rows'`, `'tabs'` or `'row'`),
`statusBar` (`'floating'`, `'chips'` or `'bar'`), `ruler`, `find`, `focus`,
`title`, `responsive`. Off unless asked for: `files`, `language`, `theme`,
`assistant`, `share`.

## Headless

The same editor, without its interface: a provider, a surface for the pages,
and hooks to build the rest with your own components.

```tsx
import { DocsProvider, DocsSurface, useDocs } from '@rebodocs/react';

function Bold() {
  const { state, commands } = useDocs();
  return (
    <button aria-pressed={state.bold} onClick={() => commands.toggleMark('bold')}>
      B
    </button>
  );
}

export function Editor({ file }: { file: Uint8Array }) {
  return (
    <DocsProvider docx={file} onSave={upload}>
      <Bold />
      <DocsSurface className="h-full" />
    </DocsProvider>
  );
}
```

| Hook | Gives |
| --- | --- |
| `useDocs()` | `state` (a snapshot of formatting, page, zoom, history…), `commands`, `editor`. |
| `useDocsValue(select)` | Anything derived from the editor, re-rendering only when it changes. |
| `useDocsFind()` | Find and replace. |
| `useDocsLink()`, `useDocsNotes()`, `useDocsOutline()` | Links, comments, the outline of headings. |
| `useDocsVariables()` | Template variables: list, insert, fill, format. |
| `useDocsStyles()`, `useDocsPage()` | Paragraph styles; page setup, numbering and letterhead. |
| `useDocsSelectionBox()`, `useDocsBubble()` | Where the selection is on screen; the bar beside it. |
| `useDocsResponsive()`, `useDocsCount()` | Narrow windows and on-screen keyboards; words and characters. |

`<DocsRuler />` is the ruler, and `<DocsProvider bubble>` adds the bar beside
the selection. `locale` sets the language of the few texts the library still
draws there (the bar, what a screen reader is told). A [complete interface](https://github.com/JFranciscoRobles/rebodocs/tree/main/apps/demo/src/HeadlessEditor.tsx)
built on the hooks is in the repository.

## Without React

```ts
import { mountDocs } from '@rebodocs/react/mount';

const handle = mountDocs(document.querySelector('#editor')!, { docx: bytes, features: { files: true } });
```

The same editor and options, for any framework or none. npm does not install
React for it.

## Also in the package

- `createSpellChecker`, `addLocale`, `setLocale`, `addFonts`: spelling, languages and fonts.
- `createAssistantChat(editor, { endpoint })`: Claude in a chat beside the document, through a route of your backend (`@rebodocs/mcp/claude`).
- `createVersionView`, `compareDocs`: versions, compared word by word.

## Compatibility

React 18 or 19. Tried in Next.js 16 (App Router) with Tailwind 4; the bundle
starts with `'use client'`. Modern browsers; spell checking runs in a Web
Worker made from a Blob, so a Content Security Policy must allow
`worker-src blob:`.

## Status

0.9: ready to try in production; the API may change before 1.0. See the
[changelog](https://github.com/JFranciscoRobles/rebodocs/blob/main/CHANGELOG.md)
and the [known limits](https://rebodocs.com/docs/status/).

## License

[MIT](https://github.com/JFranciscoRobles/rebodocs/blob/main/LICENSE). Bundled third-party code is listed in `THIRD_PARTY_NOTICES.md`.
