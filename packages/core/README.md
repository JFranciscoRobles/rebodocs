# @rebodocs/core

[npm](https://www.npmjs.com/package/@rebodocs/core) · `npm install @rebodocs/core`

The engine. Everything about a document that does not need a screen: what it
is, how it is read from and written to a DOCX, how it is changed, and where
every line of it falls on a page.

It has no DOM and one dependency (`fflate`), so the same code runs in the
browser and in Node. The editor, the collaboration server, the MCP server and
the command-line tools are all built on it.

## Using it

```bash
npm install @rebodocs/core
```

```ts
import { importDocx, fillVariables, exportDocx, renderPdf } from '@rebodocs/core';

const doc = fillVariables(importDocx(template), { client: 'Ana Pérez', amount: '2500' });
const docx = exportDocx(doc);
const { pdf } = renderPdf(doc, fonts); // fonts: font files, read with readFont
```

It is the engine `@rebodocs/editor`, `@rebodocs/collab` and `@rebodocs/mcp`
use, at the same version: a `Doc` made here is the one they take.
`@rebodocs/react` has a copy of its own inside, to be one file.

## Purpose

Two things have to be true for an editor to be trusted with real documents:
a file that goes in must come out the same, and a page must look as it does
in Word. Both are decided here, away from the interface, where they can be
tested with plain data.

## What is in it

| Area | Files | What it does |
| --- | --- | --- |
| Model | `model.ts`, `styles.ts`, `stories.ts` | An immutable `Doc`: paragraphs of runs, tables, header and footer, page setup, numbering, styles, notes, media. |
| Operations | `ops.ts`, `tables.ts`, `sections.ts`, `images.ts`, `links.ts`, `notes.ts`, `toc.ts`, `numbering.ts`, `pageNumbers.ts`, `letterhead.ts` | Pure functions: `(doc, …) => doc`. Insert and delete text, split and join paragraphs, format, lists, tables, pictures, links, comments, table of contents, page numbers, letterhead. |
| DOCX | `docx/import.ts`, `docx/export.ts`, `docx/source.ts`, `docx/xml.ts` | Reads a DOCX into a `Doc` and writes it back. The original XML is kept, and only what changed is rewritten. |
| Layout | `layout.ts`, `reflow.ts` | Breaks paragraphs into lines and lines into pages, with a `TextMeasurer` given from outside. Hit testing, caret and selection rectangles. `layoutReflow` sets the same document to the width of a screen. |
| Output | `pdf.ts`, `render.ts`, `fonts.ts`, `png.ts`, `markdown.ts` | PDF with embedded TrueType (subsetted) and OpenType fonts, measuring from font files where there is no browser, Markdown. |
| Templates | `variables.ts` | `{{name}}` variables: find, fill, formats (case, dates, numbers, amounts). |
| Editing aids | `find.ts`, `outline.ts`, `autoformat.ts` | Find and replace, the outline of headings, Markdown-like shortcuts while typing. |
| Text boxes | `textboxes.ts` | A shape with paragraphs of its own: its text is a story (`Doc.textBoxes`), found by the id of its drawing; how it looks; putting one in. |
| Tracked changes | `revisions.ts`, `diffing.ts` | `trackEdit`: any edit as tracked changes, what it took out kept struck through; accepting, rejecting and listing them. |
| Versions | `versions.ts` | `compareDocs`: what changed between two versions, paragraph by paragraph and word by word, and the later one with the changes marked. `restoreVersion`: an earlier version as a change to the current document. |

## Using it

```ts
import { importDocx, exportDocx, insertText, fillVariables, renderPdf, readFont } from '@rebodocs/core';

// Open, change, save.
let doc = importDocx(bytes);
doc = insertText(doc, { para: 0, offset: 0 }, 'Hello ').doc;
const docx = exportDocx(doc);

// Fill a template.
const filled = fillVariables(doc, { 'client.name': 'Ana Pérez' });

// Lay it out and make a PDF on a server, measuring with font files (.ttf or .otf).
const fonts = fontFiles.flatMap((file) => readFont(file) ?? []);
const { pdf, missingFonts } = renderPdf(filled, fonts);
```

A position in a document is `{ para, offset }`. Every operation returns a new
`Doc` and shares what it did not touch with the old one, which is what makes
undo, layout caching and change detection cheap.

## How it works

- **The model is a value.** Nothing mutates a `Doc`. Undo is keeping the
  previous one.
- **Layout is ours.** The browser is asked how wide a piece of text is and
  nothing else. Line breaking, justification (with Word's rule for shrinking
  spaces), pagination, widow control, keep-with-next and table splitting are
  computed here, which is why a document's pages come out the same as in Word, and why the same layout can be
  printed, exported to PDF and run on a server.
- **DOCX round trip.** Each imported paragraph remembers the XML it came
  from. An untouched paragraph is written back byte for byte; a changed one
  is rewritten keeping the properties the model does not know about.
- **Layout cache.** Paragraphs are immutable, so a paragraph that is the same
  object as last time breaks into the same lines; typing re-breaks one
  paragraph and re-paginates.

## Where it can improve

- **Coverage of the format.** Endnotes survive a round trip but are not laid
  out. Text boxes are drawn as plain rectangles; tracked changes of
  formatting are kept but not settled.
- **Tables.** A row split across pages does not apply widow control inside its
  cells.
- **Fidelity is measured on few documents.** The pagination rules were
  derived from two real files in Arial with Word for Mac. A larger corpus,
  with other fonts and versions of Word, would find where they do not hold.
- **Performance on long documents.** Pagination runs over the whole document
  on every change. Paginating from the first page that changed would matter
  beyond a few hundred pages.
- **Right-to-left and complex scripts.** Text is measured and broken as
  left-to-right runs. Arabic, Hebrew and scripts that need shaping are not
  handled.
- **PDF.** OpenType fonts in CFF go in whole, not cut down to the letters used;
  font collections (.ttc) are not read. No tagged PDF (accessibility), no links
  or outline.
- **Hyphenation.** Words are never hyphenated, as Word does not by default.
- **The API is wide.** `index.ts` exports nearly everything. Before a stable
  release it should be cut to what other packages actually need.
