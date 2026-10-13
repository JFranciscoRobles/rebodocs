# A complete interface

The repository has an application that uses `@rebodocs/react` the way yours would: [`apps/demo`](https://github.com/JFranciscoRobles/rebodocs/tree/main/apps/demo). It is running at [rebodocs.com/demo](/demo/), from the same files. It shows the same document two ways, side by side in two tabs: the whole editor as it comes (`DocsEditor`), and an interface built from nothing on the hooks, dark and laid out like a design tool. The second does everything the first does, so it is the place to copy from.

```bash
git clone https://github.com/JFranciscoRobles/rebodocs
cd rebodocs
npm install
npm run demo        # http://localhost:5175, and /#headless for the second tab
```

It opens with a sample contract that is also a template: headings for the outline, variables with a type, a table, places to sign, a header and a page number. `Abrir .docx` opens a file of yours in both tabs. Its labels are in Spanish, the language the editor speaks unless told otherwise.

It runs the package from its source, so a change in `packages/react` shows at once. Nothing else about it is special: copied into a project that installs `@rebodocs/react` from npm, it works as it is.

## What is where

| File | What it is |
| --- | --- |
| `src/App.tsx` | The two tabs, the sample document, and opening a file. Holds the `docx` both editors are given. |
| `src/FullEditor.tsx` | `DocsEditor`, in a dozen lines. |
| `src/HeadlessEditor.tsx` | The provider and the layout: title bar, formatting bar, insert rail, find bar, ruler, pages, status bar. |
| `src/headless/Panels.tsx` | The side panel and its four tabs: format, page, contents, notes. |
| `src/headless/Icon.tsx`, `options.ts` | The icons, and the lists offered: sizes, zooms, colours. |
| `src/HeadlessEditor.css` | All of its look. Every rule is under `.hd`, so it touches nothing else. |
| `scripts/sample.ts` | Writes the sample document with the engine, without a browser. |

## Which piece uses what

| Piece of the interface | Built with |
| --- | --- |
| Name, unsaved mark, save, export to Word, PDF and Markdown, print | `useDocs`: `state.name`, `state.dirty`, `docs.save()`, `docs.download()`, `editor.exportPdf()`, `editor.exportMarkdown()`, `commands.print()` |
| Undo, style, font, size, bold…, colour, alignment, lists, indent, zoom | `useDocs`, `useDocsStyles`, `fontFamilies`, `useDocsValue` for the indent |
| Table, pictures, signatures, page break | `commands.insertTable`, `insertImageFile`, `insertImageGrid`, `insertSignatures`, `insertPageBreak` |
| Link, variable and note buttons, and ⌘K | `useDocsBubble`: `bubble.ask(…)`, with `<DocsProvider bubble>` |
| Find and replace, and ⌘F | `useDocsFind`, opened by `onFindKey` |
| Ruler | `DocsRuler`, coloured with `--dx-ruler…` |
| Format tab: highlight, spacing, the cells of a table | `useDocs`, `useDocsValue` for `activeParagraphProps()`, `activeCellProps()` and `tableBorders()` |
| Page tab: size, margins, letterhead, header and footer, page number | `useDocsPage`, `commands.setArea` |
| Contents tab: table of contents, outline to drag, variables with a type | `useDocsOutline`, `useDocsVariables`, `commands.insertToc` |
| Notes tab | `useDocsNotes`, `NOTE_COLORS`, `docs.setAuthor` |
| Status bar: page, words, saved, language, view, zoom | `useDocs`, `useDocsCount`, `setLocale`, `commands.setView`, `commands.setZoom` |
| A narrow window | `useDocsResponsive`, and a media query for the layout |

Each is explained, with what it takes and gives, in [Components and hooks](/docs/components/).

## The skeleton

Everything hangs from one provider. The state a key must reach is above it; the rest is inside.

```tsx
export function HeadlessEditor({ docx, name }: { docx?: Uint8Array; name: string }) {
  const [finding, setFinding] = useState(false);
  return (
    <DocsProvider docx={docx} name={name} author="Demo" onSave={download} bubble onFindKey={() => setFinding(true)}>
      <Shell finding={finding} setFinding={setFinding} />
    </DocsProvider>
  );
}

function Shell({ finding, setFinding }: { finding: boolean; setFinding: (on: boolean) => void }) {
  const { keyboard } = useDocsResponsive();
  return (
    <div className="hd" style={{ paddingBottom: keyboard || undefined }}>
      <TitleBar />
      <Toolbar />
      <div className="hd-body">
        <Rail finding={finding} onFind={() => setFinding(!finding)} />
        <main className="hd-main">
          {finding && <FindBar onClose={() => setFinding(false)} />}
          <DocsRuler />
          <DocsSurface className="hd-surface" />
        </main>
        <Panels />
      </div>
      <StatusBar />
    </div>
  );
}
```

The column the pages are in is `display: flex; flex-direction: column; min-width: 0`, and the surface `flex: 1; min-height: 0`: that is what gives it the height it needs and lets it scroll.

## Things it had to get right

**One value for `docx`.** `App` keeps the bytes in state and gives the same `Uint8Array` at every render. A new array each time would open the document again and lose what was typed.

**Buttons that do not steal the selection.** Every command gives the keyboard back to the document, so buttons need nothing. A `<select>` or an `<input>` takes it while it is used, and the command it ends in gives it back.

**Colours as the editor has them.** `state.color` is hex without `#`; an `<input type="color">` wants one with it. `options.ts` has the two lines that go between them. A highlight is only one of Word's fifteen, so it is offered as swatches, not as a free colour.

**The same list, with what is there now.** A document may use a size or a zoom that is not in the list offered. `withCurrent` adds the present value, so the `<select>` never shows something it is not.

**Indent or level.** The two indent buttons change the level of an item inside a list (`shiftListLevel`) and the indent of the paragraph outside one (`shiftIndent`), as the included toolbar does.

**The library's own pieces, in your colours.** The ruler takes its colours from `--dx-ruler…` variables set on `.hd`. The bubble is put in `document.body`, outside `.hd`, so its rules are written against `body .dx-bb`.

**A narrow window.** Under 900 px of window, the bars become one row each that slides, the insert rail lies down, the panels open over the document from a button, and the ruler goes. That is decided with a media query, because the layout itself changes how wide the pages are; `useDocsResponsive` then fits the pages to what they are left and says how much the keyboard covers.

**Language.** The selector calls `setLocale`, which changes what the library writes: the bubble, the ruler, the names of the styles. The demo's own labels stay as written; an application with its own translations would switch them on the same `onLocaleChange`.

## Using it for a demonstration

- [rebodocs.com/demo](/demo/) has it online, with nothing to install; `/demo/#full` opens on the included interface.
- `npm run demo` and open `/#headless` to land on your own interface, or `/` for the included one.
- `Abrir .docx` shows a real document of the person you are showing it to, in both.
- `npm run build:demo` writes `apps/demo/dist`, a static site to put anywhere.
- To change what it opens with, edit `scripts/sample.ts`: it is plain data, and `npm run sample -w @rebodocs/demo` writes the file again.
