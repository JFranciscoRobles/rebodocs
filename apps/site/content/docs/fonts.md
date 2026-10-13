# Fonts

The editor measures and paints with the browser's fonts, so any font the machine has already works. For the ones it does not have (your brand's typeface, a letterhead's) there is `addFont`.

```tsx
<DocsEditor
  docx={file}
  fonts={[
    { family: 'Raleway', src: '/fonts/Raleway-Regular.ttf' },
    { family: 'Raleway', src: '/fonts/Raleway-Bold.ttf', bold: true },
    { family: 'Raleway', src: '/fonts/Raleway-Italic.ttf', italic: true },
  ]}
/>
```

Or, anywhere:

```ts
import { addFonts } from '@rebodocs/react';   // or '@rebodocs/editor'

await addFonts([{ family: 'Raleway', src: '/fonts/Raleway-Regular.ttf' }]);
```

With that, the font:

- is listed in the toolbar, at the top (headless: `state.fonts`);
- is used to measure and paint, and open documents are laid out again once it loads, since the width of their text changes;
- goes into PDFs, cut down to the characters used, when the file is TrueType.

## The source

| `src` | When |
| --- | --- |
| An address | The file is fetched. |
| Bytes (`ArrayBuffer`, `Uint8Array`) | You already have it. |
| Left out | The page loads the font by itself, with CSS or `next/font`. It is only listed, and waited for. |

A family is given one face at a time: regular, bold, italic. A missing face is imitated by the browser, as on any web page.

Fonts belong to the page, not to one document, and stay once given.

## What to know

- **PDF needs `.ttf`.** A `.woff2` or `.otf` shows and measures fine, but the PDF draws its text in a standard font.
- **The font is not put inside the DOCX.** Someone who opens it in Word without the font installed sees another in its place. Fonts a DOCX already carries embedded are kept, and used.
- **On a server** fonts are given apart: see [On a server](/docs/server/).
- If the same family and face is given again with the same source, nothing happens: a component that re-renders does not reload its fonts.
