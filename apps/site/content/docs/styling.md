# Styling and Tailwind

There are two levels: recolour what comes with the editor, or draw the interface yourself.

## The pages

The element the pages are in takes classes like any other. Its base rule sits in a CSS layer, so utilities from a framework that keeps its own in layers, as Tailwind 4 does, win over it:

```tsx
<DocsSurface className="h-full bg-neutral-100 dark:bg-neutral-900" />
```

A few CSS variables change the rest:

| Variable | What it colours | Default |
| --- | --- | --- |
| `--dx-canvas` | Behind the pages | `#e9eaee` |
| `--dx-page-shadow` | The shadow of each page | a soft shadow |
| `--dx-selection` | Selected text | translucent blue |
| `--dx-caret` | The caret | black |
| `--dx-handle` | Touch selection handles | `#0b57d0` |

```css
.my-editor {
  --dx-canvas: #f4f1ea;
  --dx-selection: rgb(232 113 10 / 0.25);
  --dx-handle: #e8710a;
}
```

The page itself is white because paper is: a document says what colour its text is, and it assumes white behind it.

## Your own interface

For a toolbar, panels and dialogs that are yours, use the [headless](/docs/headless/) hooks. They hold no markup and no styles: you write the JSX, with whatever classes you like.

```tsx
function Bold() {
  const { state, commands } = useDocs();
  return (
    <button
      onClick={() => commands.toggleMark('bold')}
      className={`rounded px-2 py-1 font-bold ${state.bold ? 'bg-blue-600 text-white' : 'hover:bg-neutral-100'}`}
    >
      B
    </button>
  );
}
```

## With Tailwind

It was tried with Tailwind 4 in Next.js 16. Two things are taken care of for you:

- Tailwind's reset gives every image `max-width: 100%`, which would collapse the pictures of a document. The editor undoes it for its own.
- The editor's base styles are in a layer, so your utilities are not overridden by them.

Nothing needs adding to your Tailwind configuration.

## The included interface

The toolbar, menu, panel and status bar have fixed light colours and no dark mode. If they do not fit your application, that is the case for headless. They do grow for fingers: where the pointer is coarse, buttons are about 38 px.
