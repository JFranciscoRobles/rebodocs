# Rebodocs

[rebodocs.com](https://rebodocs.com) · [npm](https://www.npmjs.com/package/@rebodocs/react) · [documentation](https://rebodocs.com/docs/)

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
an MCP server for AI assistants, which also puts Claude in a chat beside the
document.

```bash
npm install
npm run dev        # playground at http://localhost:5173
npm run demo       # the React package, two ways, at http://localhost:5175
npm run storage    # documents in an S3 bucket, at http://localhost:5176 (needs apps/storage/.env)
npm run realtime   # several people on one document, at http://localhost:5177
npm run assistant  # Claude in a shared document, at http://localhost:5179 (needs an API key)
npm test           # 312 tests
npm run typecheck
```

## What it does

- **Opens and saves DOCX without losing what it does not understand.** A file
  that is opened and saved untouched keeps its XML; what is edited is written
  back into the original structure.
- **Lays pages out compatibly with Word.** Line breaking, justification, widow and
  orphan control, keep-with-next, sections and newspaper columns (with column
  breaks, balancing and the line between them), tables that split across
  pages with their heading rows repeated, table styles (heading row, banded
  rows), borders per side, merged and nested cells, floating tables, headers
  and footers, page numbers, floating pictures with text wrapping. Measured
  against Word's own PDF output on real documents (see
  [Status](#status)).
- **Edits them.** Character and paragraph formatting, paragraph styles,
  lists, columns (of a section or of a selection, with column breaks),
  tables (insert, delete, merge, split, drag the columns, the rows or the
  corner to resize, row heights, heading rows, vertical alignment, border
  lines), pictures, links,
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
- **AI assistants** can read and change documents, keeping their look: through an MCP server, or as a chat with Claude in your application.
- **Any language, any font.** The interface ships in Spanish and English and
  takes more as JSON; an application can register its own typefaces.

## Packages

| Package | What it is | Runs in |
| --- | --- | --- |
| [`@rebodocs/core`](packages/core) | The engine: document model, DOCX import and export, layout, PDF, templates. No DOM. | Browser, Node |
| [`@rebodocs/editor`](packages/editor) | The editor: pages, caret and selection, toolbar, menu, side panel, status bar. No framework. | Browser |
| [`@rebodocs/react`](packages/react) ([npm](https://www.npmjs.com/package/@rebodocs/react)) | The editor as a React component, and as headless hooks for an interface of your own. | Browser (SSR-safe) |
| [`@rebodocs/collab`](packages/collab) | Collaboration: the change format, the room server and its browser client. | Node, browser |
| [`@rebodocs/mcp`](packages/mcp) ([npm](https://www.npmjs.com/package/@rebodocs/mcp)) | A Model Context Protocol server: tools for an assistant to read and edit documents; and the route that takes a chat in the page to the Claude API. | Node |
| [`apps/playground`](apps/playground) | The test application every package is tried in. | Browser |
| [`apps/demo`](apps/demo) | The React package as an application uses it: the whole editor, and an interface of one's own built on the hooks. | Browser |
| [`apps/storage`](apps/storage) | Documents kept in an S3 bucket (Cloudflare R2, AWS S3, MinIO): open, save, and a PDF made on the server. | Browser and Node |
| [`apps/realtime`](apps/realtime) | Several people on one document at once: the collaboration server, a backend with its three routes and signed tickets, and the page. | Browser and Node |
| [`apps/assistant`](apps/assistant) | Claude in the editor: a chat beside a shared document that reads and changes it, keeping its look; the key stays on the server. | Browser and Node |
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

**In a React or Next.js application:** `npm install @rebodocs/react` ([npm](https://www.npmjs.com/package/@rebodocs/react))

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

**For an AI assistant:** `npx @rebodocs/mcp` is the MCP server for Claude
Desktop and other clients ([npm](https://www.npmjs.com/package/@rebodocs/mcp));
`@rebodocs/mcp/claude` puts Claude in a chat beside the editor of your
application ([AI assistants](https://rebodocs.com/docs/assistants/)).

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
| `npm run storage` | The demo of documents in an S3 bucket; needs `apps/storage/.env`. |
| `npm run realtime` | The demo of several people on one document at once. |
| `npm run assistant` | The demo of Claude in a shared document; needs `apps/assistant/.env`. |
| `npm run collab` | The collaboration server. |
| `npm run mcp` | The MCP server, over standard input and output. |
| `npm run locale -- fr texts/fr.json` | Starts a translation of the interface, or brings one up to date. |
| `npm run site`, `npm run build:site` | The website, locally; and built as static files in `apps/site/out`. |
| `npm run word-compare -- file.docx` | Compares the layout with Word's (macOS with Word, Chrome and `pdftotext`). |

## Demos

Small applications that use the packages the way yours would, to read and to
copy from. [The documentation](https://rebodocs.com/docs/demos/) says more of
each.

| Demo | Run it | What it shows |
| --- | --- | --- |
| [`apps/demo`](apps/demo) | `npm run demo`, or [online](https://rebodocs.com/demo/) | The editor as it comes, and an interface built from nothing on the hooks, in Spanish and English. No backend. |
| [`apps/storage`](apps/storage) | `npm run storage` | Documents in Cloudflare R2, AWS S3 or MinIO. The browser opens and saves with addresses signed for a few minutes and never has a key; the server fills a template and stores the PDF. |
| [`apps/realtime`](apps/realtime) | `npm run realtime` | Every document is a room, there only while someone is in it. The collaboration server keeps nothing: a backend gives it the document, takes it back, and lets each person in with a signed ticket. |
| [`apps/assistant`](apps/assistant) | `npm run assistant` | The real-time demo with Claude beside the document. The page holds the conversation and runs the tools on the editor; the server takes it to the Claude API with its key. |
| [`apps/playground`](apps/playground) | `npm run dev` | Everything wired together without a framework. |

## Status

`@rebodocs/react` is [on npm](https://www.npmjs.com/package/@rebodocs/react).

This is working software that has not been used in production yet. What has
been checked, and how:

- **275 automated tests** over the engine, the change format, the
  collaboration session, the interface texts, and the backends of the
  storage and real-time demos.
- **A real bucket.** The backend of the storage demo was run by hand against
  Cloudflare R2: signed addresses, the PDF made on the server, and coming
  into a room whose document is in the bucket.
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
  HTTPS, or with two browsers typing over a real bucket. One server process
  holds a room.
- Sections: their columns and margins are laid out, but every page has the
  size of the last section's, every section shows the document's header and
  footer (or none, for the first sections when they have none), and the page
  setup panel changes the last section only.
- No footnotes, no text boxes, no tracked changes, no tab stops other than
  the dotted one of a table of contents. Such content is kept in the file and
  shown as plain text where it can be.
- Tables: text set vertically in a cell is shown horizontally; a table
  inside a cell is never split across pages.
- PDF embeds TrueType fonts only; others are drawn in a standard font.
- Fonts registered by an application are not embedded in the DOCX.
- The interface was written in Spanish first; the English texts need a review.

## Roadmap

In rough order of how much each would matter:

1. Use it in a real application, and fix what that shows.
2. Publish the engine and collaboration to npm (today `@rebodocs/react` and
   `@rebodocs/mcp` are, each a bundle with the engine inside; the others are
   consumed as source).
3. Collaboration: several server processes per room, permissions checked on
   every change and not only on joining, recovery after a crash.
4. Layout: footnotes, tab stops, a page size and a header per section.
5. Translate the design notes, and review the English interface.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE): anyone may use it for anything, including commercially, with
no warranty. Third-party notices are in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
