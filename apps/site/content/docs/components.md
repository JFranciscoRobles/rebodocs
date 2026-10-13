# Components and hooks

Everything `@rebodocs/react` exports, one by one: what it is for, what it takes, what it gives, and the least code that uses it. [React component](/docs/react/) and [Headless](/docs/headless/) explain the two ways of using the package; this page is where to look a name up.

```bash
npm install @rebodocs/react
```

| You want | Use |
| --- | --- |
| The whole editor, as it comes | [`DocsEditor`](#docseditor) |
| The pages, and an interface of your own | [`DocsProvider`](#docsprovider) + [`DocsSurface`](#docssurface) + the hooks |
| The ruler in an interface of your own | [`DocsRuler`](#docsruler) |
| The editor without React | [`mountDocs`](#mountdocs-and-createdocs), `createDocs` |

[A complete interface](/docs/example/) shows all of them working together in an application you can run, and [the demo](/demo/) is that application in your browser.

## DocsEditor

The whole editor in one component: toolbar, ruler, side panel, pages, status bar.

```tsx
'use client';
import { DocsEditor } from '@rebodocs/react';

<div style={{ height: '100vh' }}>
  <DocsEditor docx={file} name="contract.docx" author="Ana" locale="en" onSave={(docx, name) => upload(docx, name)} />
</div>
```

- It fills the element it is in, so that element needs a height.
- It takes every prop of [`DocsProvider`](#docsprovider) except `bubble`, `onLinkKey` and `onFindKey` (it answers those itself), and adds `locale`, `locales`, `features`, `className`, `style`, `onReady` and a `ref`.
- `features` switches its parts on and off; the list is in [React component](/docs/react/#features).
- `ref` and `onReady` give a handle: `exportDocx()`, `dirty`, `editor`, `collab`, `setName`, `setAuthor`, `setLocale`, `setLetterhead`, `focus`.

Use it when the interface that comes with the editor will do. When it will not, everything below is for building your own.

## DocsProvider

Holds one document for whatever is inside it. It draws nothing.

```tsx
<DocsProvider docx={file} name="contract.docx" author="Ana" onSave={upload}>
  <MyToolbar />
  <DocsSurface className="h-full" />
</DocsProvider>
```

| Prop | What it does |
| --- | --- |
| `docx` | The document to open, as `Uint8Array` or `ArrayBuffer`; an empty one without it. Another value opens another document. |
| `name` | What the document is called; given to what is saved and exported. Follows its prop. |
| `author` | Who the person is: what their notes are signed with. Follows its prop. |
| `onSave(docx, name)` | Called on ⌘S and on `docs.save()`. Keeping the file is yours to do. |
| `onChange(editor)` | Called when the document changes. |
| `onError(message)` | Told what went wrong; an `alert` without it. |
| `collab` | `{ url, room, ticket }`: the document is a shared room. See [collaboration](/docs/collaboration/). |
| `onCollab(state, peers)` | Called when the connection, or who is on the document, changes. |
| `letterhead` | A picture to use as letterhead; `null` for none. See [letterheads](/docs/letterhead/). |
| `fonts` | Typefaces of your own. See [fonts](/docs/fonts/). |
| `bubble` | `true` for the bar beside the selection. Read when the document is made. See [`useDocsBubble`](#usedocsbubble). |
| `onLinkKey()` | Answers ⌘K. |
| `onFindKey(replace)` | Answers ⌘F and ⌘H; `replace` is true for ⌘H. |

Things to know:

- The document is made again, and what was typed is gone, when `docx`, the room of `collab`, or whether there is an `onSave` changes. Keep `docx` the same value between renders: a `Uint8Array` held in state, not one built in the body of the component.
- The functions you pass may be new at each render; the last one given is the one called.
- State that a key must reach lives outside the provider or in a child of it. To open a find bar on ⌘F:

```tsx
function Editor({ file }: { file: Uint8Array }) {
  const [finding, setFinding] = useState(false);
  return (
    <DocsProvider docx={file} onFindKey={() => setFinding(true)}>
      {finding && <FindBar onClose={() => setFinding(false)} />}
      <DocsSurface className="h-full" />
    </DocsProvider>
  );
}
```

## DocsSurface

The pages of the document. Exactly one inside a provider.

```tsx
<DocsSurface className="min-h-0 flex-1 bg-neutral-100" />
```

| Prop | What it does |
| --- | --- |
| `className`, `style` | For the element around the pages: its size, and the background they lie on. |

- It scrolls by itself, so it needs a height: `h-full` in something that has one, or `flex-1 min-h-0` in a column.
- The pages are not for styling: where each letter goes is worked out, not left to the browser. What is around them is yours, through CSS variables set on the surface or above it: `--dx-canvas`, `--dx-page-shadow`, `--dx-selection`, `--dx-caret`, `--dx-handle`. See [styling](/docs/styling/).

## DocsRuler

The ruler: the page in centimetres, its margins and the indents of the paragraph the caret is in, all of them to drag.

```tsx
<div className="flex h-full flex-col">
  <DocsRuler />
  <DocsSurface className="min-h-0 flex-1" />
</div>
```

| Prop | What it does |
| --- | --- |
| `className`, `style` | For the element the ruler is put in. |

- Put it right above the surface and as wide as it: it lines itself up with the page under it.
- It is drawn on a canvas, so its look is colours, not classes. Set them on the ruler or above it:

| Variable | What it colours |
| --- | --- |
| `--dx-ruler` | Behind it |
| `--dx-ruler-line` | The line under it |
| `--dx-ruler-margin` | The page outside the text |
| `--dx-ruler-text` | The room of the text |
| `--dx-ruler-ink` | Numbers and markers |
| `--dx-ruler-on` | The marker being dragged, and its guide |

- What its markers are called is read when it is made. After `setLocale`, give it a `key` that changes with the language to have them in the new one.
- A narrow window has no room for it; leave it out there.

## useDocs

What every piece of an interface starts from.

```tsx
const { ready, state, commands, docs, editor } = useDocs();
```

| | What it is |
| --- | --- |
| `ready` | False on the server and until the pages are on the page. |
| `state` | What to show, as plain values. The same object until one of them changes. |
| `commands` | What buttons call. Each gives the keyboard back to the document. |
| `docs` | The document as a whole: `save()`, `download()`, `exportDocx()`, `openFile()`, `share()`, `leave()`, `setLetterhead()`, `connectAssistant()`, `setName()`, `setAuthor()`, `focus()`. Undefined until `ready`. |
| `editor` | The `Editor` itself, for what has no command: `exportPdf()`, `exportMarkdown()`, `activeParagraphProps()`… See [Editor API](/docs/editor-api/). Undefined until `ready`. |

A button that shows a state and changes it:

```tsx
function Bold() {
  const { state, commands } = useDocs();
  return (
    <button aria-pressed={state.bold} onClick={() => commands.toggleMark('bold')}>
      B
    </button>
  );
}
```

A select bound to the selection:

```tsx
function FontSize() {
  const { state, commands } = useDocs();
  return (
    <select value={state.fontSize} onChange={(e) => commands.setRunProps({ fontSize: Number(e.target.value) })}>
      {[10, 11, 12, 14, 18, 24].map((size) => <option key={size}>{size}</option>)}
    </select>
  );
}
```

Saving and exporting:

```tsx
function Save() {
  const { state, docs, editor } = useDocs();
  const pdf = async () => {
    const bytes = await editor!.exportPdf(state.name);
    window.open(URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })));
  };
  return (
    <>
      <button disabled={!state.dirty} onClick={() => docs?.save()}>Save</button>
      <button disabled={!docs} onClick={() => docs?.download()}>Word</button>
      <button disabled={!editor} onClick={pdf}>PDF</button>
    </>
  );
}
```

Before `ready`, `state` holds neutral values and `commands` do nothing, so the interface can be drawn on a server with no checks. The lists of what is in `state` and of the commands are in [Headless](/docs/headless/#usedocs).

Colours are hex without `#` (`'C0392B'`), sizes are points, and a highlight is one of the colours Word has for it.

## useDocsValue

Anything of the document that `state` does not carry, kept up to date.

```tsx
const value = useDocsValue((editor) => /* read it */, fallback);
```

```tsx
const spaced = useDocsValue((e) => e.activeParagraphProps().spacingAfter > 0, false);
const hasToc = useDocsValue((e) => e.hasToc, false);
const cell = useDocsValue((e) => e.activeCellProps() ?? null, null);
```

- `select` runs each time the document or the selection changes; the component is drawn again only when what it gives is different, compared as JSON. So give back plain data, and `null` where the editor says `undefined`.
- `fallback` is what there is before the document is there. The one given first is kept.

## useDocsFind

Find and replace, for a bar of your own.

| | |
| --- | --- |
| `query`, `setQuery(text)` | What is looked for. Searching happens as it is typed, and the keyboard stays in your field. |
| `options`, `setOptions(o)` | `{ matchCase, wholeWord }`. |
| `count`, `index` | How many places, and which is selected, from 1. |
| `next()`, `previous()` | Go to another. |
| `replace(text)`, `replaceAll(text)` | Replace the one selected, or all as one step to undo. |
| `close()` | Stops the search and gives the keyboard back to the document. |

```tsx
function FindBar({ onClose }: { onClose: () => void }) {
  const find = useDocsFind();
  const [replacement, setReplacement] = useState('');
  const close = () => {
    find.close();
    onClose();
  };
  return (
    <div role="search">
      <input
        autoFocus
        value={find.query}
        onChange={(e) => find.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.shiftKey ? find.previous : find.next)();
          if (e.key === 'Escape') close();
        }}
      />
      <button aria-pressed={!!find.options.matchCase} onClick={() => find.setOptions({ ...find.options, matchCase: !find.options.matchCase })}>Aa</button>
      <span>{find.count ? `${find.index} of ${find.count}` : 'Nothing found'}</span>
      <input value={replacement} onChange={(e) => setReplacement(e.target.value)} />
      <button disabled={!find.count} onClick={() => find.replace(replacement)}>Replace</button>
      <button disabled={!find.count} onClick={() => find.replaceAll(replacement)}>All</button>
      <button onClick={close}>Close</button>
    </div>
  );
}
```

Open it from a button, and from ⌘F with `onFindKey` on the [provider](#docsprovider).

## useDocsLink

The link at the caret, and making one.

| | |
| --- | --- |
| `active` | `{ href, text }` of the link the caret is in. |
| `possible` | Whether there is something to link: text selected, or the caret in a link. |
| `set(address)` | Links the selection, or changes the link at the caret. False for what is not an address. |
| `remove()`, `open()` | Unlink it; open it in another tab. |

```tsx
function LinkButton() {
  const link = useDocsLink();
  const ask = () => {
    const address = window.prompt('Address', link.active?.href ?? 'https://');
    if (address === null) return;
    if (address === '') link.remove();
    else if (!link.set(address)) window.alert('That is not an address.');
  };
  return <button aria-pressed={!!link.active} disabled={!link.possible} onClick={ask}>Link</button>;
}
```

With the [bubble](#usedocsbubble) on, `bubble.ask('link')` asks for the address beside the selection instead.

## useDocsNotes

The notes of the document (Word's comments).

| | |
| --- | --- |
| `notes` | Each `{ id, author, date, text, excerpt, color }`; `excerpt` is the text it is about. |
| `active` | The id of the note the caret is in the text of. |
| `add(text)` | Puts one on the selection, or on the word at the caret; gives its id. |
| `setText(id, text)`, `setColor(id, color)`, `remove(id)` | Change one. |
| `select(id)` | Selects the text it is about and brings it into view. |

```tsx
import { NOTE_COLORS, useDocsNotes } from '@rebodocs/react';

function Notes() {
  const notes = useDocsNotes();
  return notes.notes.map((note) => (
    <article key={note.id} style={{ borderLeft: `4px solid #${note.color}` }}>
      <button onClick={() => notes.select(note.id)}>“{note.excerpt}”</button>
      <textarea value={note.text} onChange={(e) => notes.setText(note.id, e.target.value)} />
      {NOTE_COLORS.map((color) => (
        <button key={color} aria-label={color} style={{ background: `#${color}` }} onClick={() => notes.setColor(note.id, color)} />
      ))}
      <button onClick={() => notes.remove(note.id)}>Delete</button>
    </article>
  ));
}
```

Notes are signed with the `author` of the provider; `docs.setAuthor(name)` changes it. `commands.setShowNotes(true)` shows them beside the page.

## useDocsOutline

The title and the headings of the document.

| | |
| --- | --- |
| `items` | Each `{ para, level, text }`; `level` is 0 for the title, then 1, 2… |
| `active` | Which of them the caret is under, as a place in `items`, or -1. |
| `goTo(item)` | Puts the caret there and brings it into view. |
| `move(item, before?)` | Moves a heading, with everything under it, to before another, or to the end. |

```tsx
function Outline() {
  const { items, active, goTo } = useDocsOutline();
  return (
    <nav>
      {items.map((item, i) => (
        <button key={item.para} aria-current={i === active} style={{ paddingLeft: item.level * 12 }} onClick={() => goTo(item)}>
          {item.text}
        </button>
      ))}
    </nav>
  );
}
```

`move` is what dragging a section calls on drop. `commands.insertToc()` puts a table of contents in the document, and `commands.updateToc()` brings it up to date.

## useDocsVariables

The variables of a template: `{{client}}` in the text. See [templates](/docs/templates/).

| | |
| --- | --- |
| `names` | Each variable once, in order. |
| `active` | The one the caret is in. |
| `insert(name)`, `select(name)` | Put one at the caret; go to the next place one is used. |
| `fill(values)` | Puts a value in place of each variable that has one, everywhere, as one step to undo. |
| `formats`, `uses` | By name: what each asks of its value, and how many times it is used. |
| `setFormat(name, id, on, arg?)` | Gives a format to every use of a variable, or takes it away. |
| `preview(name, value)` | `{ text, bad }`: what the value would come out as, and whether it cannot be written as asked. |

```tsx
function Variables() {
  const variables = useDocsVariables();
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <form onSubmit={(e) => { e.preventDefault(); variables.fill(values); }}>
      {variables.names.map((name) => {
        const money = variables.formats[name]?.some((format) => format.id === 'currency') ?? false;
        const { text, bad } = variables.preview(name, values[name] ?? '');
        return (
          <label key={name}>
            {name}
            <input value={values[name] ?? ''} onFocus={() => variables.select(name)} onChange={(e) => setValues({ ...values, [name]: e.target.value })} />
            <button type="button" aria-pressed={money} onClick={() => variables.setFormat(name, 'currency', !money)}>$</button>
            <small>{bad ? 'Not a number' : text}</small>
          </label>
        );
      })}
      <button>Fill</button>
    </form>
  );
}
```

The formats are `date`, `dateLong`, `dateFull`, `number`, `currency` (how a value is written), `upper`, `lower`, `capital` (its letters) and `bold`, `italic`, `underline`. One of a kind takes the place of another.

## useDocsStyles

The paragraph styles of the document: Normal, Title, Heading 1…

| | |
| --- | --- |
| `styles` | Each `{ id, name }`, the default first. |
| `active` | The id of the style of the selection; undefined when it covers several. |
| `set(id)` | Gives the paragraphs of the selection a style. |

```tsx
function Style() {
  const { styles, active, set } = useDocsStyles();
  return (
    <select value={active ?? ''} onChange={(e) => set(e.target.value)}>
      {active === undefined && <option value="">Mixed</option>}
      {styles.map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}
    </select>
  );
}
```

## useDocsPage

The page: its size and margins, its number, its header and footer, its letterhead.

| | |
| --- | --- |
| `page`, `set(patch)` | `{ width, height, marginTop, marginRight, marginBottom, marginLeft }` in points (1/72 in). |
| `numbering`, `setNumbering(n)` | `{ place, align, format }`, or undefined for none. |
| `firstPageDifferent`, `setFirstPageDifferent(on)` | A header and footer for the first page alone. |
| `letterhead` | Whether the document has one. |
| `setLetterhead(file, fit?)`, `fitLetterheadMargins()`, `removeLetterhead()`, `letterheadFile()` | Set it from a PNG or JPG, fit the margins to it, remove it, get it back as a file. |

```tsx
const CM = 72 / 2.54;

function PageSetup() {
  const { page, set, numbering, setNumbering } = useDocsPage();
  if (!page) return null;
  return (
    <>
      <button onClick={() => set({ width: page.height, height: page.width })}>Turn</button>
      <input type="number" step="0.1" value={(page.marginLeft / CM).toFixed(1)} onChange={(e) => set({ marginLeft: e.target.valueAsNumber * CM })} />
      <button onClick={() => setNumbering(numbering ? undefined : { place: 'footer', align: 'center', format: 'pageOfTotal' })}>
        Page numbers
      </button>
    </>
  );
}
```

Letter is 612 × 792 points and A4 is 595.3 × 841.9. The formats of a number are `number` (3), `numberOfTotal` (3 / 9), `page` (Page 3) and `pageOfTotal` (Page 3 of 9). To type in the header or the footer, `commands.setArea('header')`; `state.area` says where typing goes.

## useDocsCount

How long the document is.

```tsx
function Count() {
  const { words, characters, selected } = useDocsCount();
  return <span>{selected ? `${selected.words} of ${words} words` : `${words} words`} · {characters} characters</span>;
}
```

`selected` is the same of what is selected, and undefined when nothing is. The whole is counted again only when the document changes.

## useDocsSelectionBox

Where the selection is in the window, to put something of your own beside it: `{ top, left, width, height }`, or undefined while there is none to show. It follows scrolling and resizing.

```tsx
function FloatingBar() {
  const box = useDocsSelectionBox();
  const { state, commands } = useDocs();
  if (!box || state.collapsed) return null;
  return (
    <div style={{ position: 'fixed', top: box.top - 44, left: box.left }} onMouseDown={(e) => e.preventDefault()}>
      <button onClick={() => commands.toggleMark('bold')}>B</button>
      <button onClick={() => commands.copy()}>Copy</button>
    </div>
  );
}
```

The `onMouseDown` keeps a press on the bar from taking the selection away.

## useDocsBubble

The bar beside the selection that the included interface has, for a document made with `<DocsProvider bubble>`. Undefined without it.

| | |
| --- | --- |
| `open()`, `close()`, `toggle()` | Show it and hide it. A tap on ⌘ does the same. |
| `ask('variable' \| 'note' \| 'link')` | Shows it asking for the name of a variable, the text of a note, or the address of a link. |

```tsx
function Insert() {
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

It is what gives copy, cut and paste on a screen that is touched. It comes with a look; restyle it through its classes, which are on `document.body`, not inside your component:

```css
body .dx-bb { background: #323232; color: #eee; border-color: #505050; }
body .dx-bb button.dx-on { background: #4a4a4a; }
body .dx-bb input { background: #262626; border-color: #505050; }
```

## useDocsResponsive

What a narrow window asks of an interface.

```tsx
const { narrow, keyboard } = useDocsResponsive(600);
```

- While the surface is less than that many pixels across (600 if not said), the pages are fitted to its width, and the zoom there was comes back when there is room again.
- `narrow` says so, to lay the interface out another way. If your layout changes how wide the surface is (a panel that goes from beside it to over it), decide the layout from the window, with a media query, and not from `narrow`: otherwise each change undoes the other.
- `keyboard` is how many pixels of the bottom of the window the on-screen keyboard covers. Leave them as padding so that your bars stay in sight:

```tsx
<div className="flex h-dvh flex-col" style={{ paddingBottom: keyboard }}>
```

See [phones and touch](/docs/mobile/).

## Languages and fonts

Not hooks, but used beside them:

| | |
| --- | --- |
| `setLocale('en')`, `getLocale()`, `onLocaleChange(fn)` | The language of what the library itself writes: the bubble, the ruler, the names of the styles. `useSyncExternalStore(onLocaleChange, getLocale)` follows it in a component. |
| `addLocale(code, texts)`, `t(key)` | Add a language, and read a text of the library. See [languages](/docs/languages/). |
| `fontFamilies()` | The families there are to offer in a list. |
| `addFont(source)`, `addFonts(sources)` | Register typefaces of your own. See [fonts](/docs/fonts/). |

## mountDocs and createDocs

The same two things without React.

```ts
import { mountDocs } from '@rebodocs/react/mount';

const docs = mountDocs(element, { docx: bytes, locale: 'en', onSave });   // the whole editor
docs.destroy();
```

```ts
import { createDocs } from '@rebodocs/react';

const docs = createDocs(element, { docx: bytes, bubble: true, onFindKey: openMyFindBar });   // only the pages
docs.subscribe(() => render(docs.state()));
boldButton.onclick = () => docs.commands.toggleMark('bold');
```

`createDocs` gives what `useDocs` gives (`state()`, `commands`, `editor`), `subscribe` to be told of changes, and `setKeys` to change who answers ⌘K and ⌘F. See [without a framework](/docs/vanilla/).
