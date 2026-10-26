<p align="center">
  <img src="https://rebodocs.com/logo.svg" alt="" width="56" height="56">
</p>

<h1 align="center">@rebodocs/viewer</h1>

<p align="center">
  A DOCX document only to read, in the browser: its pages as Word lays them out, a bar to zoom and print, and its first page as a thumbnail. With or without React.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rebodocs/viewer"><img src="https://img.shields.io/npm/v/@rebodocs/viewer?label=npm&color=0b57d0" alt="npm version"></a>
  <a href="https://github.com/JFranciscoRobles/rebodocs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-2e6b3c" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://rebodocs.com/docs/viewer/">Guide</a> ·
  <a href="https://rebodocs.com/docs/packages/">Packages</a>
</p>

---

For an application that shows documents and does not edit them: a file
manager, a preview, a page where a client reads a contract. The pages are
those of the Rebodocs editor, read only and with no caret, so a document looks
as it does in Word and in the editor. Nothing is sent anywhere: the file is
read in the page.

## Install

```bash
npm install @rebodocs/viewer
```

It brings `@rebodocs/core` and `@rebodocs/editor` with it; a bundler keeps
only what the viewer uses of them.

## Without a framework

```ts
import { createViewer, pagePicture, setLocale } from '@rebodocs/viewer';

setLocale('es');
const viewer = createViewer(element, bytes); // the bytes of a .docx; element has a size
viewer.setLayout('all'); // every page at once, as large as lets them fit; 'pages' for one under another
viewer.print();
viewer.destroy();
```

One page under another, each whole on the screen, and a bar floating over
them with the page one is on, the zoom, and its views: the grid sets every
page out at once, as `setLayout('all')` does. `bar: false` leaves it out,
and the layout and the zoom are then the application's, through
`viewer.editor`.

## React

```tsx
'use client';
import { DocsViewer } from '@rebodocs/viewer/react';

<DocsViewer docx={bytes} locale="es" style={{ height: 600 }} onReady={(viewer) => (printer.current = viewer)} />;
```

It is safe to render on a server: there it draws an empty element, and
mounts in the browser. `layout="all"` starts with every page at once;
`onReady` gives the viewer, to `print()` or `setLayout()`. React is a peer,
and an optional one: npm does not install it for the page without React.

## A thumbnail

```ts
import { pagePicture, pageThumbnail } from '@rebodocs/viewer';

const jpeg = await pagePicture(bytes, 480); // the first page, its longest side 480 pixels
const png = await pagePicture(bytes, 240, { type: 'image/png' });
const element = await pageThumbnail(bytes); // the page as the editor draws it, to show made smaller
```

Drawn out of sight, one at a time, with the pictures of the page in it. A
font the document carries is drawn in the one of the system nearest it.

## Also in the package

- `setLocale`, `addLocale`, `locales`: the language of the bar.
- `addFont`, `addFonts`: the fonts a document is written in, when the system
  has not got them.
- A document already read with `importDocx` of `@rebodocs/core` may be given
  instead of its bytes, to every function.

The whole editor, to write as well as read, is
[`@rebodocs/react`](https://www.npmjs.com/package/@rebodocs/react), which has
`DocsViewer` too.

## Status

0.11: ready to try in production; the API may change before 1.0. See the
[changelog](https://github.com/JFranciscoRobles/rebodocs/blob/main/CHANGELOG.md)
and the [known limits](https://rebodocs.com/docs/status/).

## License

[MIT](https://github.com/JFranciscoRobles/rebodocs/blob/main/LICENSE).
