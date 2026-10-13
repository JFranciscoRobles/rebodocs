# On a server: DOCX and PDF

`@rebodocs/core` has no DOM. The code that lays a document out in the browser runs in Node, so a document generated on a server breaks its lines and pages where the editor would.

## Open, change, save

```ts
import { importDocx, exportDocx, insertText, fillVariables } from '@rebodocs/core';

let doc = importDocx(bytes);                                  // Uint8Array → Doc
doc = fillVariables(doc, { client: 'Ana Pérez' });
doc = insertText(doc, { para: 0, offset: 0 }, 'DRAFT · ').doc;
const out = exportDocx(doc);                                  // Doc → Uint8Array
```

A `Doc` is an immutable value. Every operation returns a new one and leaves the old one as it was. A position is `{ para, offset }`: the paragraph, and the character in it.

What the engine does not understand in a file is kept in it. A document opened and saved untouched comes out with the same XML.

## PDF

Laying out needs to know how wide text is. In the browser that is asked of the browser; on a server it is read from font files:

```ts
import { readFileSync } from 'node:fs';
import { importDocx, readFont, renderPdf } from '@rebodocs/core';

const fonts = ['Arial.ttf', 'Arial Bold.ttf', 'Arial Italic.ttf']
  .flatMap((file) => readFont(new Uint8Array(readFileSync(`fonts/${file}`))) ?? []);

const { pdf, missingFonts } = renderPdf(importDocx(bytes), fonts, 'Receipt 1024');
```

- Fonts are embedded, cut down to the characters used. The text of the PDF can be selected and searched.
- `missingFonts` says which families the document asks for that you did not give, and what stood in for each. A stand-in has other widths, so lines may break elsewhere: give the real fonts for a faithful result.
- Fonts the DOCX carries inside are used by themselves.
- Only TrueType (`.ttf`) files are read.

## The command-line tool

The same, without writing code:

```bash
npm run generate -- template.docx data.json -o receipt.pdf --fonts ./fonts
npm run generate -- template.docx data.json -o receipt.docx
npm run generate -- contract.docx -o contract.md
```

Without `--fonts` it looks in the fonts of the system.

## Markdown

```ts
import { exportMarkdown } from '@rebodocs/core';

const text = exportMarkdown(doc);
```

Headings, emphasis, lists, links and tables. No fonts, colours or pictures. Useful to give a document to a language model, or to index it.

## Laying out yourself

```ts
import { layoutDocument, FontMeasurer } from '@rebodocs/core';

const layout = layoutDocument(doc, new FontMeasurer(fonts));
layout.pages.length;                    // how many pages
layout.lines[0];                        // where the first line is, and what is on it
```

`layoutDocument` takes anything that can say the width of a text and the height of a font (`TextMeasurer`), which is how the browser and the server share it.

## A typical backend

For an application that fills templates and lets people edit the result:

1. Keep templates as DOCX in your storage.
2. To generate: `importDocx` → `fillVariables` → `exportDocx` (or `renderPdf`), and store the result.
3. To edit: give the stored DOCX to the [React component](/docs/react/) and store what `onSave` hands back.
4. For several people at once, see [collaboration](/docs/collaboration/).
