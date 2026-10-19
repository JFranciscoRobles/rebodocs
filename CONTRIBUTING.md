# Contributing

## Setting up

```bash
npm install
npm run dev         # the playground, at http://localhost:5173
npm test            # Vitest
npm run typecheck   # tsc, over every package
```

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
- Layout changes should be checked against Word when possible:
  `npm run word-compare -- file.docx` (macOS with Word, Chrome and
  `pdftotext`).
- Interface changes should be tried in the playground, also at the width of
  a phone.

## Documents

**Never commit a real document.** DOCX files at the root of the repository,
`fixtures/` and `salas/` are ignored by git for that reason: test files
often come from real contracts, with names and amounts in them. Tests build
their documents in code. If a bug needs a file to reproduce, reduce it to
one made from scratch.

## Commits

One change per commit, with a message that says what changed and why.
