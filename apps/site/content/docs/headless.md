# Headless: your own UI

When the interface that comes with the editor is not yours, keep the pages and draw everything else yourself. The provider holds the document, the surface is where its pages go, and hooks give you what to show and what to do.

```tsx
'use client';
import { DocsProvider, DocsSurface, useDocs } from '@rebodocs/react';

function Toolbar() {
  const { state, commands } = useDocs();
  return (
    <div className="flex gap-1 border-b p-2">
      <button className={state.bold ? 'bg-blue-100' : ''} onClick={() => commands.toggleMark('bold')}>B</button>
      <button className={state.italic ? 'bg-blue-100' : ''} onClick={() => commands.toggleMark('italic')}>I</button>
      <button disabled={!state.canUndo} onClick={() => commands.undo()}>Undo</button>
      <span className="ml-auto text-sm">Page {state.page} of {state.pageCount}</span>
    </div>
  );
}

export function Editor({ file }: { file: Uint8Array }) {
  return (
    <DocsProvider docx={file} onSave={upload}>
      <div className="flex h-screen flex-col">
        <Toolbar />
        <DocsSurface className="min-h-0 flex-1 bg-neutral-100" />
      </div>
    </DocsProvider>
  );
}
```

`DocsProvider` takes the same props as `DocsEditor`, except `features`, `locale` and `locales`, which belong to the interface you are not using.

## useDocs

```ts
const { state, commands, editor, docs, ready } = useDocs();
```

`state` is a plain snapshot. It is the same object until something in it changes, so components re-render only when they must.

| In `state` | |
| --- | --- |
| Text at the selection | `bold`, `italic`, `underline`, `strike`, `fontFamily`, `fontSize`, `color`, `highlight`, `link` |
| Paragraph | `align`, `lineHeight`, `styleId`, `list` |
| What can be done | `canUndo`, `canRedo`, `collapsed`, `inTable`, `canEditTables`, `canMergeCells`, `canSplitCell`, `pictureSelected` |
| Where | `area` (body, header or footer), `page`, `pageCount` |
| View | `zoom`, `view`, `fit`, `touch` |
| Document | `name`, `dirty`, `letterhead`, `fonts` |
| Search | `findCount`, `findIndex` |
| People | `collab`, `peers`, `me` |

`commands` are the editor's methods. Each one gives the keyboard back to the document afterwards, so a click on your button does not leave the person unable to type.

| Group | Commands |
| --- | --- |
| History | `undo`, `redo` |
| Text | `toggleMark`, `setRunProps`, `insertText`, `selectAll`, `copy`, `cut`, `paste` |
| Paragraph | `setParagraphProps`, `setParagraphStyle`, `toggleList`, `shiftListLevel`, `shiftIndent`, `insertPageBreak` |
| Tables | `insertTable`, `insertTableRow`, `insertTableColumn`, `deleteTableRow`, `deleteTableColumn`, `mergeTableCells`, `splitTableCell`, `setTableCellProps`, `setTableBorders` |
| Pictures | `insertImageFile`, `insertImageGrid`, `setPictureWrap`, `fitSelectedPicture` |
| Templates | `insertVariable`, `fillVariables`, `insertSignatures` |
| Links and comments | `setLink`, `removeLink`, `addNote`, `setNoteText`, `setNoteColor`, `removeNote`, `selectNote` |
| Structure | `insertToc`, `updateToc`, `goToHeading`, `moveSection` |
| Page | `setPage`, `setPageNumbering`, `setFirstPageDifferent`, `setArea`, `setLetterhead`, `setLetterheadFile`, `fitLetterheadMargins`, `removeLetterhead` |
| Search | `find`, `findStep`, `replaceFound`, `replaceAllFound` |
| View | `setZoom`, `setFit`, `setView`, `setShowNotes`, `print` |

Before the document is there (on the server, and until the surface is on the page) `ready` is false, `state` holds neutral values and commands do nothing.

## Hooks for panels and dialogs

Each gives what there is to show and what there is to do, for a piece of interface you draw.

| Hook | Gives |
| --- | --- |
| `useDocsFind()` | `query`, `setQuery`, `options`, `count`, `index`, `next`, `previous`, `replace`, `replaceAll`, `close`. |
| `useDocsLink()` | `active` (address and text), `possible`, `set`, `remove`, `open`. |
| `useDocsNotes()` | `notes`, `active`, `add`, `setText`, `setColor`, `remove`, `select`. |
| `useDocsOutline()` | `items`, `active`, `goTo`, `move`. |
| `useDocsVariables()` | `names`, `active`, `insert`, `select`, `fill`. |
| `useDocsStyles()` | `styles`, `active`, `set`. |
| `useDocsPage()` | `page`, `set`, `numbering`, `setNumbering`, `firstPageDifferent`, and the letterhead. |
| `useDocsSelectionBox()` | Where the selection is on screen, to put a floating panel beside it. |
| `useDocsResponsive()` | Fits pages to a narrow window; `narrow`, and `keyboard` in pixels. |
| `useDocsValue(select, fallback)` | Anything else worked out from the editor, re-rendering only when it changes. |

A find bar, for example:

```tsx
function Find() {
  const find = useDocsFind();
  return (
    <div className="flex gap-2">
      <input value={find.query} onChange={(e) => find.setQuery(e.target.value)} placeholder="Find" />
      <span>{find.index} / {find.count}</span>
      <button onClick={find.previous}>↑</button>
      <button onClick={find.next}>↓</button>
    </div>
  );
}
```

## What has no headless version

The ruler and the bar that comes up beside the selection are only in the included interface. You can still create them over your own layout:

```ts
import { createRuler, createBubble } from '@rebodocs/editor';
```

They are plain DOM pieces that take the `editor` from `useDocs()`.
