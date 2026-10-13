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
| `useDocsVariables()` | `names`, `active`, `insert`, `select`, `fill`; and what each asks of its value: `formats`, `uses`, `setFormat`, `preview`. |
| `useDocsStyles()` | `styles`, `active`, `set`. |
| `useDocsPage()` | `page`, `set`, `numbering`, `setNumbering`, `firstPageDifferent`, and the letterhead. |
| `useDocsSelectionBox()` | Where the selection is on screen, to put a floating panel beside it. |
| `useDocsCount()` | `words` and `characters` of the document, and of what is `selected`. |
| `useDocsBubble()` | The bar beside the selection, with `<DocsProvider bubble>`: `open`, `close`, `toggle`, `ask`. |
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

## Keys

Most keys are the editor's own and work with nothing asked of you: ⌘B, ⌘I and ⌘U, ⌘Z and ⇧⌘Z, ⌘A, ⌘↵ for a page break, ⌘S (when there is an `onSave`) and ⌘P, ⌘-click on a link to open it, ⌘ and the wheel to zoom. Ctrl takes the place of ⌘ away from a Mac.

Three of them open something only an interface has, so the editor knows the key and leaves the answer to you. Each is taken from the browser only while you give it someone to call, and only while the keyboard is in the document.

| Prop of `DocsProvider` | Key | When it is called |
| --- | --- | --- |
| `onLinkKey()` | ⌘K | Time to ask for the address of a link. |
| `onFindKey(replace)` | ⌘F, ⌘H | Time to show the search; `replace` is true for ⌘H. |

```tsx
function Editor() {
  const [finding, setFinding] = useState(false);
  const [linking, setLinking] = useState(false);
  return (
    <DocsProvider docx={file} onFindKey={() => setFinding(true)} onLinkKey={() => setLinking(true)}>
      {finding && <Find onClose={() => setFinding(false)} />}
      {linking && <LinkDialog onClose={() => setLinking(false)} />}
      <DocsSurface className="h-full" />
    </DocsProvider>
  );
}
```

Without React they are options of `createDocs`, and `docs.setKeys({ onLinkKey, onFindKey })` changes them later.

## The bar beside the selection

`<DocsProvider bubble>` gives the document the small bar that comes up beside what is selected, the same one the included interface has: copy, cut and paste on a screen that is touched, a variable made of the words selected, a link, a note, and what can be done to a picture or to the cells of a table. A tap on ⌘ shows it and hides it, and with it ⌘K asks for a link there unless you gave an `onLinkKey`.

It is off unless asked for, and read when the document is made. It is the one piece here that comes with a look: restyle it through its classes (`dx-bb`, `dx-bb-open`, `dx-bb-sep`…).

`useDocsBubble()` gives it to your own buttons:

```tsx
function InsertMenu() {
  const bubble = useDocsBubble();
  return (
    <>
      <button onClick={() => bubble?.ask('variable')}>Variable</button>
      <button onClick={() => bubble?.ask('note')}>Note</button>
      <button onClick={() => bubble?.ask('link')}>Link</button>
    </>
  );
}
```

To draw one of your own, `useDocsSelectionBox()` says where the selection is.

## Variables that are dates and amounts

A variable may ask how its value is written: as a date, as an amount, in capitals, in bold. `useDocsVariables()` gives what each one asks (`formats`), changes it for every place the variable is used (`setFormat`), and says what a value would come out as, or that it cannot be written that way (`preview`).

```tsx
function Variable({ name }: { name: string }) {
  const variables = useDocsVariables();
  const [value, setValue] = useState('');
  const has = (id: FormatId) => variables.formats[name]?.some((format) => format.id === id);
  const { text, bad } = variables.preview(name, value);
  return (
    <label>
      {name}
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <button aria-pressed={has('currency')} onClick={() => variables.setFormat(name, 'currency', !has('currency'))}>$</button>
      <small>{bad ? 'Not a number' : text}</small>
    </label>
  );
}
```

The formats are `date`, `dateLong`, `dateFull`, `number`, `currency`, `upper`, `lower`, `capital`, `bold`, `italic` and `underline`. One way of writing a date or a number takes the place of another, and so does a change of capitals.

## The ruler

`<DocsRuler />` is the ruler of the included interface: the page in centimetres, its margins and the indents of the paragraph, to drag. Put it above the `DocsSurface`, as wide as it.

```tsx
<div className="flex h-full flex-col">
  <DocsRuler />
  <DocsSurface className="min-h-0 flex-1" />
</div>
```

It is drawn on a canvas, so its look is its colours and not classes: `--dx-ruler` behind it, `--dx-ruler-line` under it, `--dx-ruler-margin` for the page outside the text, `--dx-ruler-text` for the room of the text, `--dx-ruler-ink` for the numbers and the markers, `--dx-ruler-on` for the marker being dragged.
