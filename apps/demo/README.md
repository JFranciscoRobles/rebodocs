# Demo

`@rebodocs/react` as an application uses it. The same document two ways, in
two tabs:

- **DocsEditor**: the whole editor as it comes, in a dozen lines
  (`src/FullEditor.tsx`).
- **Headless**: an interface built from nothing on the hooks, dark and laid
  out like a design tool, that does everything the first does
  (`src/HeadlessEditor.tsx`, `src/headless/`).

```bash
npm run demo          # from the root: http://localhost:5175
npm run build:demo    # apps/demo/dist, a static site
```

It is also on the site, at [rebodocs.com/demo](https://rebodocs.com/demo/):
`apps/site` takes these same components from here.

`/#headless` opens on the second tab. It starts with a sample contract that
`scripts/sample.ts` writes with the engine: headings, variables with a type,
text in two columns, a table with a heading row, places to sign. `Abrir .docx` opens a file of the disk in both tabs.
Saving hands the DOCX back as a download: there is no backend.

It opens in Spanish, the language the editor speaks unless told otherwise. The
selector in the status bar changes it for what the library writes and for the
labels of the demo, which are in `src/headless/texts.ts`.

## Purpose

To show the package to someone, and to copy from. It is the answer to "how
do I build my own toolbar, panel, find bar, ruler": every piece of the
headless tab is one or two hooks, and
[the documentation](https://rebodocs.com/docs/example/) says which.

It takes the package from its source (an alias in `vite.config.ts`), so a
change in `packages/react` shows at once with nothing to build. Copied into a
project that installs `@rebodocs/react` from npm, it works without the alias.

## What is where

| File | What it is |
| --- | --- |
| `src/App.tsx` | The two tabs, the sample document, opening a file. |
| `src/FullEditor.tsx` | `DocsEditor`. |
| `src/HeadlessEditor.tsx` | The provider and the layout: bars, find, ruler, pages. |
| `src/headless/Panels.tsx` | The side panel: format, page, contents, notes. |
| `src/headless/texts.ts` | Its labels in Spanish and English, and the hook that follows the language. |
| `src/HeadlessEditor.css` | Its look, all under `.hd`. |
| `scripts/sample.ts` | Writes `public/sample.docx`. |

## Where it can improve

- **Tests.** None: it was checked by eye, in Chrome, at a wide and a narrow
  window. It is the natural place for component tests of the hooks.
- **No dialogs of its own.** A link, a variable and a note are asked for by
  the bar beside the selection. A panel made with `useDocsSelectionBox`
  would show the other way.
- **No collaboration.** `collab`, `share` and the people on a document are
  not shown; `apps/realtime` and `apps/playground` have them, and
  `apps/assistant` has Claude in a shared document.
