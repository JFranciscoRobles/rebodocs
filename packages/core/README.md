<h1 align="center">@rebodocs/core</h1>

<p align="center">
  The document engine of Rebodocs: DOCX in and out, Word-compatible layout, PDF and templates. No DOM, no Node APIs.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rebodocs/core"><img src="https://img.shields.io/npm/v/@rebodocs/core?label=npm&color=0b57d0" alt="npm version"></a>
  <a href="https://github.com/JFranciscoRobles/rebodocs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-2e6b3c" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/dependencies-1-2e6b3c" alt="One dependency">
</p>

<p align="center">
  <a href="https://rebodocs.com/docs/server/">On a server</a> ·
  <a href="https://rebodocs.com/docs/templates/">Templates</a> ·
  <a href="https://rebodocs.com/docs/architecture/">How it works</a>
</p>

---

Everything about a document that does not need a screen: what it is, how it
is read from and written to a DOCX, how it is changed, and where every line
falls on a page. The same code runs in the browser, Node, Deno, Bun and
Workers; its one dependency is `fflate`. The editor, the collaboration server
and the MCP server are built on it.

## Install

```bash
npm install @rebodocs/core
```

## Usage

```ts
import { importDocx, exportDocx, insertText, fillVariables, renderPdf, readFont } from '@rebodocs/core';

// Open, change, save.
let doc = importDocx(bytes);
doc = insertText(doc, { para: 0, offset: 0 }, 'Hello ').doc;
const docx = exportDocx(doc);

// Fill a template: {{client.name}}, and {{#lines}} … {{/lines}} once per item.
const filled = fillVariables(doc, { client: { name: 'Ana Pérez' }, lines: [{ item: 'Desk', price: 250 }] }, { locale: 'es-MX' });

// Lay it out and make a PDF, measuring with font files (.ttf or .otf).
const fonts = fontFiles.flatMap((file) => readFont(file) ?? []);
const { pdf, missingFonts } = renderPdf(filled, fonts);
```

A `Doc` is an immutable value, and a position in it is `{ para, offset }`.
Every operation returns a new `Doc` sharing what it did not touch, which
makes undo, layout caching and change detection cheap.

## What is in it

| Area | What it does |
| --- | --- |
| **DOCX** | `importDocx`, `exportDocx`. The original XML is kept: an untouched paragraph is written back as it was, a changed one keeps the properties the model does not know. |
| **Layout** | `layoutDocument`: lines and pages by Word's rules (justification, kerning, widow control, keep-with-next, sections, columns, tables across pages, floating objects, footnotes, endnotes at the end of the document or of each section, numbered as each section says). `layoutReflow` sets text to the width of a screen. |
| **Editing** | Pure functions `(doc, …) => doc`: text, formatting, styles, lists, tables, pictures, links, comments, footnotes, endnotes, text boxes, table of contents, page numbers, letterheads. |
| **Templates** | `fillVariables`, `findVariables`, `templateBlocks`: variables with formats (case, dates, numbers, amounts) and blocks that repeat or are kept only when a value is there. |
| **Tracked changes** | `trackEdit` turns any edit into Word's tracked changes; accept, reject, list. |
| **Versions** | `compareDocs`: two versions compared paragraph by paragraph and word by word. `restoreVersion`: an earlier one as a change to the current document. |
| **Output** | `renderPdf` (tagged, with TrueType fonts subsetted and OpenType embedded), `exportMarkdown`. |
| **Clipboard** | A piece of a document with its formatting and its tables (merged cells, widths, colours, borders, row heights), as HTML for Word and other programs, and written back at a position. |

## The API

What `@rebodocs/core` exports is chosen: [`API.md`](API.md) lists every name
with its declaration, and a test checks that the two agree, so that a change
to the API shows in a diff. The rest of the engine is in
`@rebodocs/core/internal`, for the editor, the collaboration server and the
MCP server, with no promise: it changes between versions without notice.

## Fidelity

Layout is measured line by line against the PDF Word exports, with
documents made up for it and kept in `test-documents/` with Word's PDF of
each: `npm run word-check` in the repository runs them all, and `npm run
word-compare` measures any file. Details and known limits
are on the [status page](https://rebodocs.com/docs/status/).

## Status

0.10: ready to try in production; the API may change before 1.0. See the
[changelog](https://github.com/JFranciscoRobles/rebodocs/blob/main/CHANGELOG.md).

## License

[MIT](https://github.com/JFranciscoRobles/rebodocs/blob/main/LICENSE). Third-party notices are in `THIRD_PARTY_NOTICES.md`.
