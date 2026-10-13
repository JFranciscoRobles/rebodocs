# Rebodocs

[rebodocs.com](https://rebodocs.com)

A word processor for the browser, compatible with Word files (DOCX), with its
own engine. The document model,
line breaking, pagination, caret, selection, and DOCX reading and writing are
all written here. It does not use ProseMirror, `contenteditable`, or any
editing library. The only runtime dependency is `fflate`, to open and close
the ZIP a DOCX is.

It is not a copy of Microsoft Word and does not try to be one. It reads and
writes the same files, and lays them out by the same rules, so a document
looks the same in both; it leaves out much of what Word has, and adds things
of its own.

It was built to live inside another application (a CRM that fills contract
and receipt templates), so it comes as a set of packages: an engine that runs
without a browser, an editor, a React component, a collaboration server and
an MCP server for AI assistants.

```bash
npm install
npm run dev        # playground at http://localhost:5173
npm test           # 257 tests
npm run typecheck
```

## What it does

- **Opens and saves DOCX without losing what it does not understand.** A file
  that is opened and saved untouched keeps its XML; what is edited is written
  back into the original structure.
- **Lays pages out compatibly with Word.** Line breaking, justification, widow and
  orphan control, keep-with-next, tables that split across pages, headers and
  footers, page numbers, floating pictures with text wrapping. Measured
  against Word's own PDF output on real documents (see
  [Status](#status)).
- **Edits them.** Character and paragraph formatting, paragraph styles,
  lists, tables (insert, merge, split, resize columns), pictures, links,
  notes (Word comments), table of contents, find and replace, undo and redo.
- **Templates.** Any text between double braces, `{{client.name}}`, is a
  variable. They can be filled from the editor, from the command line or
  from code, with formats for dates, numbers and amounts.
- **Letterheads.** A full-page picture behind the text of every page can be
  set, replaced, extracted or removed, with margins fitted to what it prints.
- **Exports** DOCX, PDF (with embedded fonts and selectable text) and
  Markdown, in the browser or on a server.
- **Real-time collaboration.** Several people on the same document, each
  seeing the others' carets, with per-person undo.
- **Works on a phone.** Pages fit the width of the screen and are zoomed with
  two fingers; taps, selection handles and on-screen keyboards are handled.
- **AI assistants** can read and change documents through an MCP server.
- **Any language, any font.** The interface ships in Spanish and English and
  takes more as JSON; an application can register its own typefaces.

## Packages

| Package | What it is | Runs in |
| --- | --- | --- |
| [`@rebodocs/core`](packages/core) | The engine: document model, DOCX import and export, layout, PDF, templates. No DOM. | Browser, Node |
| [`@rebodocs/editor`](packages/editor) | The editor: pages, caret and selection, toolbar, menu, side panel, status bar. No framework. | Browser |
| [`@rebodocs/react`](packages/react) | The editor as a React component, and as headless hooks for an interface of your own. | Browser (SSR-safe) |
| [`@rebodocs/collab`](packages/collab) | Collaboration: the change format, the room server and its browser client. | Node, browser |
| [`@rebodocs/mcp`](packages/mcp) | A Model Context Protocol server: tools for an assistant to read and edit documents. | Node |
| [`apps/playground`](apps/playground) | The test application every package is tried in. | Browser |
| [`apps/site`](apps/site) | [rebodocs.com](https://rebodocs.com): the landing page and the developer documentation. | Static |

Each package has a README saying what it is for, how it is used, and where it
can be improved.

```
@rebodocs/core  ◄──  @rebodocs/editor  ◄──  @rebodocs/react
    ▲                 ▲                 │
    ├── @rebodocs/collab ─┴─────────────────┘
    └── @rebodocs/mcp
```

## Using it

**In a React or Next.js application:**

```tsx
'use client';
import { DocsEditor } from '@rebodocs/react';

export default function Contract({ file }: { file: Uint8Array }) {
  return (
    <div style={{ height: '100vh' }}>
      <DocsEditor docx={file} name="contract.docx" locale="en" onSave={(docx) => upload(docx)} />
    </div>
  );
}
```

**In any page:**

```ts
import { Editor, createToolbar } from '@rebodocs/editor';

const editor = new Editor(document.querySelector('#pages')!);
createToolbar(document.querySelector('#toolbar')!, editor);
editor.loadDocx(bytes);
const saved = editor.exportDocx();
```

**On a server, filling a template:**

```ts
import { importDocx, fillVariables, exportDocx } from '@rebodocs/core';

const doc = fillVariables(importDocx(template), { 'client.name': 'Ana Pérez', amount: '2500' });
const docx = exportDocx(doc);
```

```bash
npm run generate -- template.docx data.json -o receipt.pdf
```

**Several people at once:**

```bash
npm run collab -- --backend https://my-app.example/api/docs   # key in REBODOCS_COLLAB_BACKEND_KEY
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | The playground, with hot reload. |
| `npm test`, `npm run typecheck` | Tests (Vitest) and types. |
| `npm run build` | Builds the playground. |
| `npm run build:react` | Builds `@rebodocs/react` and packs it as a tarball to install elsewhere. |
| `npm run generate -- template.docx data.json -o out.pdf` | Fills a template without a browser; DOCX, PDF or Markdown by extension. |
| `npm run collab` | The collaboration server. |
| `npm run mcp` | The MCP server, over standard input and output. |
| `npm run locale -- fr texts/fr.json` | Starts a translation of the interface, or brings one up to date. |
| `npm run site`, `npm run build:site` | The website, locally; and built as static files in `apps/site/out`. |
| `npm run word-compare -- file.docx` | Compares the layout with Word's (macOS with Word, Chrome and `pdftotext`). |

## Status

This is working software that has not been used in production yet. What has
been checked, and how:

- **257 automated tests** over the engine, the change format, the
  collaboration session and the interface texts.
- **Compatibility of layout.** Real documents are compared line by line with the
  PDF Word exports; on the receipt used as reference every line is within
  0.4 pt. Other documents, fonts and versions of Word may differ, and
  `npm run word-compare` measures any file.
- **Round trip.** 18 test documents open and save without losing pictures or
  structure; Word opens what is exported without warnings.
- **The interface**, in headless Chrome with real clicks, keys and touches:
  toolbar, tables, header and footer, letterhead, collaboration between two
  tabs, the React component inside a Next.js 16 + Tailwind 4 application, and
  a phone-sized screen. Touch input was also tried on a real phone.

Known limits:

- Collaboration has not been run between machines on different networks, over
  HTTPS, or against a real storage backend. One server process holds a room.
- No sections with different page setups, no columns, no footnotes, no text
  boxes, no tracked changes. Such content is kept in the file and shown as
  plain text where it can be.
- Tables: row height is not editable, header rows do not repeat across pages.
- PDF embeds TrueType fonts only; others are drawn in a standard font.
- Fonts registered by an application are not embedded in the DOCX.
- The interface was written in Spanish first; the English texts need a review.

A long, detailed description of how everything works, and of every check
made, is in [docs/DESIGN.es.md](docs/DESIGN.es.md). It is in Spanish and has
not been translated yet.

## Roadmap

In rough order of how much each would matter:

1. Use it in a real application, and fix what that shows.
2. Publish the packages to npm (today only `@rebodocs/react` is built as a
   bundle; the others are consumed as source).
3. Collaboration: several server processes per room, permissions checked on
   every change and not only on joining, recovery after a crash.
4. Layout: sections, columns, footnotes, repeated table header rows.
5. Translate the design notes, and review the English interface.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE): anyone may use it for anything, including commercially, with
no warranty. Third-party notices are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
