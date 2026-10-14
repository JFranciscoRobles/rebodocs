# How it works

Four decisions explain most of the code.

## The document is a value

A `Doc` is plain immutable data: paragraphs of runs, tables, a header and a footer, the page, styles, numbering, media. Nothing mutates one. An operation takes a document and returns another, sharing everything it did not touch:

```ts
const next = insertText(doc, { para: 3, offset: 0 }, 'Hello').doc;
next.paragraphs[0] === doc.paragraphs[0];   // true: untouched, so the very same object
```

That one rule gives a lot for free:

- **Undo** is keeping the previous document.
- **Change detection** is `===`.
- **Layout caching:** a paragraph that is the same object as last time breaks into the same lines.
- **Collaboration:** the difference between two documents is found by comparing references.

## Layout is ours

The browser is asked one thing: how wide is this piece of text in this font. Everything else is computed by the engine:

- breaking a paragraph into lines, with justification and Word's rule for how far spaces may shrink to take one more word;
- paginating: widow and orphan control, keep-with-next, keep-lines-together, page breaks;
- tables, with rows that split across pages;
- headers and footers that take room from the text when they are tall;
- floating pictures, and the text that goes round them.

Because the rules are ours, they can be the ones Word documents are written for, and a file looks the same here as there, which a browser's own line breaking would never give. The aim is compatibility, not imitation: the same document, the same pages. And because the only thing asked from outside is a width, the same code runs in Node with font files in place of a browser: that is how PDFs are made on a server.

Lengths are in points throughout, as in Word.

## Painting is placing

The editor does not hand text to the browser to lay out. Each piece of text is a `span` placed at the coordinates the layout gave. The browser never wraps a line, so what is on screen is exactly what was computed, and what will be printed.

There is no `contenteditable`. A hidden `textarea` follows the caret and has the focus. What is typed arrives there and becomes an operation on the model. Movement keys and shortcuts are taken in `keydown`. The caret and the selection are drawn by the editor.

Zoom is a CSS transform over pages laid out at their real size, so zooming never breaks lines differently.

## DOCX without loss

A DOCX is a ZIP of XML with far more in it than any editor models. To not destroy what is not understood:

- every imported paragraph remembers the XML it came from;
- a paragraph that was not touched is written back byte for byte;
- one that was changed is rewritten, keeping the properties the model does not know about;
- parts of the file the editor never reads (themes, custom XML, settings) are copied through.

Opening a file and saving it untouched gives the same XML. That is tested on a set of real documents.

## Collaboration

Paragraphs get an id while a document is shared. A change is a list of operations that name paragraphs by id ("in paragraph `k3`, at offset 12, insert `x`"), so it still means the same after someone added a paragraph above.

The server puts everyone's changes in one order, rebasing each against the ones its author had not seen yet. A client applies its own changes at once, without waiting, and rebases them when the server's order arrives. Undo sends the inverse of your own step, transformed against what others did since, so it never takes back someone else's work.

## Where things live

| Folder | What is there |
| --- | --- |
| `packages/core/src/model.ts` | The shape of a document. |
| `packages/core/src/ops.ts` and neighbours | The operations. |
| `packages/core/src/layout.ts` | Lines and pages. |
| `packages/core/src/docx/` | Reading and writing DOCX. |
| `packages/core/src/pdf.ts` | PDF, with font subsetting. |
| `packages/editor/src/editor.ts` | The pages, the caret, input. |
| `packages/editor/src/*.ts` | One file per interface piece. |
| `packages/collab/src/changes.ts` | The change format and its transform. |
