# Letterheads

A letterhead is a picture the size of the page, behind the text of every page: the logo at the top, the address at the foot, a pattern across the sheet. In a DOCX it lives in the header, anchored to the page and drawn under the text, which is how Word does it and how Rebodocs reads and writes it.

Documents that already have one keep it: it is drawn, printed, put in the PDF and preserved on export.

## In the editor

The document menu has, under "Page":

- **Letterhead…** to choose a picture (PNG or JPG). The margins grow to clear what it prints at the top and bottom.
- **Fit margins to the letterhead**, to do that again later.
- **Extract the letterhead**, to save its picture and use it on another document.
- **Remove the letterhead.**

## From your application

To give every document your letterhead, whatever it came with:

```tsx
<DocsEditor docx={file} letterhead="/brand/letterhead.png" />
```

`letterhead` is an address to fetch, a `File` or `Blob`, or `{ bytes, type }`. Pass `null` for none. When you set it, the person is not offered the choice in the menu: it is yours. Leave the prop out and the document keeps its own, and the person may change it.

Headless:

```tsx
const { letterhead, setLetterhead, fitLetterheadMargins, removeLetterhead, letterheadFile } = useDocsPage();
```

On the editor: `editor.hasLetterhead`, `editor.letterhead`, `editor.setLetterheadFile(file)`, `editor.fitLetterheadMargins()`, `editor.removeLetterhead()`.

## In code

```ts
import { importDocx, setLetterhead, removeLetterhead, letterheadOf, exportDocx } from '@rebodocs/core';

let doc = importDocx(template);
doc = setLetterhead(doc, { bytes: png, type: 'image/png' });
const docx = exportDocx(doc);
```

## How margins are fitted

The picture is read pixel by pixel to find where its printing ends at the top and begins at the bottom, and the page margins are set just past those. Side margins are left alone, and so is any text already in the header.

## What to know

- A picture counts as a letterhead when it covers at least 85% of the page, is in the header, and is behind the text.
- When a letterhead is replaced or removed, its picture leaves the file on export. A DOCX is a ZIP, and what stays inside can be seen by whoever unpacks it.
- One letterhead for the whole document: no different one for the first page.
