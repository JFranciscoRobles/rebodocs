<p align="center">
  <img src="apps/site/public/logo.svg" alt="" width="64" height="64">
</p>

<h1 align="center">Rebodocs</h1>

<p align="center">
  A DOCX editor for the browser, with an engine of its own.<br>
  Open, edit and save Word files in your application: tracked changes, versions, templates, real-time collaboration and PDF.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rebodocs/react"><img src="https://img.shields.io/npm/v/@rebodocs/react?label=npm&color=0b57d0" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2e6b3c" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/tests-737%20passing-2e6b3c" alt="737 tests passing">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178c6" alt="TypeScript">
</p>

<p align="center">
  <a href="https://rebodocs.com/demo/"><b>Live demo</b></a> ·
  <a href="https://rebodocs.com/docs/">Documentation</a> ·
  <a href="https://rebodocs.com/docs/getting-started/">Getting started</a> ·
  <a href="https://rebodocs.com/docs/status/">Status</a>
</p>

---

Rebodocs writes its own document model, line breaking, pagination, caret,
selection and DOCX reader and writer. It does not use ProseMirror,
`contenteditable` or any editing library, and the engine's only runtime
dependency is `fflate`. Pages are laid out by Word's rules, so a document
looks the same in both, and what the editor does not understand is kept in
the file untouched.

It is not a copy of Word. It leaves out much of what Word has, and adds
things of its own, such as template variables and an MCP server for AI
assistants.

## Quick start

```bash
npm install @rebodocs/react
```

```tsx
'use client';
import { DocsEditor } from '@rebodocs/react';

export default function Contract({ file }: { file: Uint8Array }) {
  return (
    <div style={{ height: '100vh' }}>
      <DocsEditor docx={file} name="contract.docx" onSave={(docx) => upload(docx)} />
    </div>
  );
}
```

That is the whole editor: toolbar, ruler, side panel, pages and status bar.
For an interface of your own, the same package has headless hooks
(`DocsProvider`, `useDocs`, …). See [React component](https://rebodocs.com/docs/react/)
and [Headless](https://rebodocs.com/docs/headless/).

## Features

- **Faithful DOCX round trip.** A file opened and saved keeps its XML; what is edited is written back into the original structure.
- **Word-compatible layout.** Sections, columns, tables that split across pages, floating pictures and tables, headers and footers, footnotes and endnotes, text boxes, kerning. Measured line by line against Word's own PDFs, with 47 documents kept in `test-documents/` that anyone can run: 99% of Word's lines land where Word puts them.
- **Copy and paste with Word.** A table copied in Word comes with its merged cells, widths, colours, borders and row heights, and goes back to Word the same way.
- **Tracked changes** as Word's, accepted or rejected in the editor, from code or by an assistant.
- **Versions** compared word by word and restored. Your application keeps them; the editor lists them.
- **Templates.** `{{client.name}}` is a variable, with formats for dates and amounts, and `{{#lines}} … {{/lines}}` repeats rows or paragraphs. Fill them in the editor, on a server or from the command line.
- **Real-time collaboration** with per-person undo. Your backend keeps the files and decides who gets in.
- **PDF and DOCX on a server**, with the same layout and no browser. The PDF is tagged for screen readers.
- **Spell checking** with Hunspell dictionaries, a **dark theme**, and long documents that stay fast: only the pages in view are drawn.
- **Phones and touch**: fit to width, pinch to zoom, touch selection.
- **Accessible**: every bar, menu and dialog works from the keyboard, and a screen reader hears what the caret moves over.
- **AI assistants** read and edit documents through an MCP server, or as Claude in a chat beside the editor.
- **Any language**: the interface ships in English and Spanish and takes more as JSON.

## Packages

| Package | What it is | Runs in |
| --- | --- | --- |
| [`@rebodocs/react`](packages/react) | The editor as a React component, and headless hooks. Everything below is bundled in. | Browser (SSR-safe) |
| [`@rebodocs/editor`](packages/editor) | The editor and its interface pieces, without a framework. | Browser |
| [`@rebodocs/viewer`](packages/viewer) | A document only to read, with or without React, and the first page as a thumbnail. | Browser (SSR-safe) |
| [`@rebodocs/core`](packages/core) | The engine: document model, DOCX, layout, PDF, templates. No DOM. | Browser, Node, Deno, Bun, Workers |
| [`@rebodocs/collab`](packages/collab) | The collaboration server and its browser client. | Node, browser |
| [`@rebodocs/mcp`](packages/mcp) | An MCP server for AI assistants, and the route that takes a chat to the Claude API. | Node |

```
@rebodocs/core ◄── @rebodocs/editor ◄── @rebodocs/viewer ◄── @rebodocs/react
      ▲                                                            │
      ├─ @rebodocs/collab ◄────────────────────────────────────────┘
      └─ @rebodocs/mcp
```

### Other ways in

```ts
// Any page, no framework
import { Editor, createToolbar } from '@rebodocs/editor';
const editor = new Editor(document.querySelector('#pages')!);
createToolbar(document.querySelector('#toolbar')!, editor);
editor.loadDocx(bytes);
```

```ts
// A server, filling a template
import { importDocx, fillVariables, exportDocx } from '@rebodocs/core';
const docx = exportDocx(fillVariables(importDocx(template), { client: { name: 'Ana Pérez' }, amount: 2500 }));
```

```bash
npx @rebodocs/mcp --root ~/Documents/contracts       # MCP server for Claude Desktop and other clients
npx @rebodocs/collab --backend https://app.example/api/docs   # collaboration server
```

## Demos

Each is a small application that uses the packages the way yours would. Run them from the repository.

| Demo | Command | What it shows |
| --- | --- | --- |
| [`apps/demo`](apps/demo) | `npm run demo` · [online](https://rebodocs.com/demo/) | The editor as it comes, another layout, and an interface built on the hooks. |
| [`apps/storage`](apps/storage) | `npm run storage` | Documents in S3, R2 or MinIO through signed addresses; a PDF made on the server. |
| [`apps/realtime`](apps/realtime) | `npm run realtime` | Several people on one document, a backend with signed tickets, a version per session. |
| [`apps/assistant`](apps/assistant) | `npm run assistant` | Claude beside a shared document; the API key stays on the server. |
| [`apps/viewer`](apps/viewer) | `npm run viewer` | Documents only to read: a shelf with their thumbnails, each opened in the viewer. |
| [`apps/crm`](apps/crm) | `npm run crm` | The editor inside a CRM: contracts from templates, autosave, review, the assistant. |
| [`apps/desktop`](apps/desktop) | `npm run desktop` | A Tauri desktop application for `.docx` files on disk. |
| [`apps/playground`](apps/playground) | `npm run dev` | Every piece wired together without a framework, on a 100-page document. |

## Development

Node 22.12 or later.

```bash
git clone https://github.com/JFranciscoRobles/rebodocs.git
cd rebodocs
npm install
npm run dev          # playground at http://localhost:5173
npm test             # Vitest
npm run test:browser # the editor itself, in Chrome
npm run typecheck
```

| Command | What it does |
| --- | --- |
| `npm run build:packages` | Builds core, editor, collab and mcp into `packages/<name>/dist`. |
| `npm run build:react` | Builds `@rebodocs/react` and packs it as a tarball. |
| `npm run site` | The documentation site at http://localhost:5174. |
| `npm run generate -- template.docx data.json -o out.pdf` | Fills a template without a browser; `npx -p @rebodocs/mcp rebodocs-generate` outside the repository. |
| `npm run word-check` | Lays out the documents of `test-documents/` and compares them with the PDFs Word made of them. |
| `npm run word-compare -- file.docx` | Compares one document with Word's PDF of it; `--word` has Word make it (macOS). |
| `npm run locale -- fr texts/fr.json` | Starts or updates a translation of the interface. |

## Status

**0.13: ready to try in production, not yet stable.** The API may still
change before 1.0; every change is listed in the [changelog](CHANGELOG.md).

What is checked, and how, is on the [status page](https://rebodocs.com/docs/status/):
737 automated tests, 76 of them driving the editor and the viewer in Chrome
(`npm run test:browser`), layout measured line by line against Word with the
documents of `test-documents/` (`npm run word-check`), a round trip of real
documents, collaboration across networks, and the rest of the interface
driven in a browser by hand. The main limits today:

- Pasting from Word or the web keeps text formatting, links, lists, tables and pictures, except pictures a web server does not let the page read; a table inside a cell comes as lines.
- One collaboration server process holds a room.
- Screen readers have been tested by reading what is announced, not yet with VoiceOver, NVDA or JAWS.
- No right-to-left text or hyphenation.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Third-party notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
