# Contributing

## Setting up

```bash
npm install
npm run dev         # the playground, at http://localhost:5173
npm test            # Vitest
npm run test:browser  # the editor itself, driven in Chrome (Playwright)
npm run typecheck   # tsc, over every package
npm run lint        # Biome: the format and the lint rules, as biome.json says
npm run format      # Biome, writing: the format and the fixes that are safe
npm run api         # packages/core/API.md, after changing what the core exports
npm run coverage    # what the tests reach, file by file
npm run bench       # how long the engine takes on a long document
```

The format is Biome's, 200 characters wide; `npm run format` before a
commit leaves nothing for `npm run lint` to say about it. Lint warnings
(accessibility, React hooks, keys) are for judging one by one, not errors.

Node 22.12 or later. The repository is an npm workspace; packages import each
other as source, so there is no build step while developing.

`apps/desktop` also needs Rust ([rustup.rs](https://rustup.rs)) to compile
its Tauri side; nothing else in the repository does.

## Where things go

- A rule about documents (what a change does, where a line breaks, how
  something is written to DOCX) belongs in `packages/core`, as a pure
  function with a test.
- What a person sees or touches belongs in `packages/editor`, using only the
  public API of core.
- `packages/react` holds no editing logic: it mounts the editor and exposes
  it.

Each package's README ends with a list of where it can improve. Those are
good places to start.

## Conventions

- **TypeScript, strict.** No `any`.
- **The model is immutable.** An operation returns a new `Doc` and shares
  what it did not change. Never mutate one.
- **Comments say why, not what**, in plain English, in the voice of the ones
  already there.
- **Every text a person reads goes through `t()`** in
  `packages/editor/src/i18n.ts`, in Spanish and English.
- **No new runtime dependencies** without a very good reason. There is one.

## Tests

- Engine changes need a test in `packages/core/test`.
- Layout changes are checked against Word with `npm run word-check`: the
  documents of `test-documents/`, each with the PDF Word made of it, laid out
  again and compared line by line (Chrome and `pdftotext`; no Word needed).
  A new case is made in code; see `test-documents/README.md`.
- Editor changes are checked in a browser with `npm run test:browser`: the
  tests of `packages/editor/test/browser` make an editor on a page and give
  it keys, clicks, touches and the clipboard, in Chrome without a window. The
  Chrome installed is used when there is one; otherwise, once,
  `npx playwright install chromium`.
- Interface changes should be tried in the playground, also at the width of
  a phone.

## The editor, file by file

`packages/editor/src/editor.ts` is the `Editor`: its API and its state. What
it does on the screen is in pieces of their own, each given the editor:

| File | What it does |
| --- | --- |
| `painter.ts` | Draws the pages near the view, and over them the selection, the caret, the others' carets and the marks. |
| `pointer.ts` | The mouse and the fingers: what a press, a drag, a hold or a pinch does, and what is under a point of the screen. |
| `keys.ts` | The hidden field: keys, text composed by a keyboard, what a screen reader is told, the clipboard. |
| `spelling.ts` | Which words are spelled wrong, asked of the spell checker a moment after typing stops. |
| `pdfexport.ts` | The document as a PDF, with its pictures read by the browser. |

What a piece needs of the editor that no one else may use is marked
`/** @internal */` there: the pieces reach it, and the published types leave
it out.

## Documents

**Never commit a real document.** DOCX files at the root of the repository,
`fixtures/`, `rooms/` and `salas/` are ignored by git for that reason: test files
often come from real contracts, with names and amounts in them. Tests build
their documents in code, and so do the generators of `test-documents/`, the
only documents the repository keeps. If a bug needs a file to reproduce,
reduce it to one made from scratch.

## Commits

One change per commit, with a message that says what changed and why.
