# Phones and touch

A document does not change with the screen. Its pages are the same on a phone as on a monitor: the window is a place to look at them from, nearer or further, like a desk. What adapts is the zoom, the controls and the input.

## What happens on a narrow window

With the React component it is on by default (`features.responsive`). Below 600 px:

- Pages are shown as wide as the window. A Letter page is at about 46% on a 390 px phone.
- The room around the pages shrinks from 24 to 8 px.
- The ruler goes away, and the side panel opens over the document without making it narrower.
- The toolbar and the status bar already fold what does not fit.

From there the zoom belongs to the person. When the window is wide again, the zoom it had comes back.

## Gestures

| Gesture | What it does |
| --- | --- |
| Tap | Places the caret and brings up the keyboard. A handle stays under the caret for a few seconds, to place it exactly. |
| Double tap | Selects the word. A third tap, the paragraph. |
| Hold | Selects the word; without lifting, the selection is drawn out. |
| Handles | One at each end of the selection. Dragged near the edge, the document scrolls. |
| Swipe | Scrolls, without moving the caret. |
| Pinch | Zooms around the fingers: what is under them stays under them. |
| Two fingers together | Drag the page. |

Selecting by touch brings up a small bar beside the selection, which then also offers Copy, Cut, Paste and Select all, since there are no keys for them. With a mouse none of this shows.

> Paste is only offered on a page served over HTTPS, or on `localhost`. Elsewhere the browser does not let a page read the clipboard.

## The on-screen keyboard

A phone does not make the window shorter when its keyboard comes up. It draws the keyboard over it. The editor keeps the caret in sight, and the included interface leaves the covered part empty so its bars stay above the keyboard.

Words appear as they are typed, also by keyboards that compose them (every phone keyboard does), and change when the keyboard corrects them.

## In your own interface

```tsx
function Shell() {
  const { narrow, keyboard } = useDocsResponsive(600);
  return (
    <div className="flex h-dvh flex-col" style={{ paddingBottom: keyboard }}>
      {!narrow && <Ruler />}
      <DocsSurface className="min-h-0 flex-1" />
    </div>
  );
}
```

`useDocsResponsive` fits the pages to the width, and reports `narrow` and how many pixels of the window the keyboard covers. `state.touch` is true from a touch of the screen until the mouse is used.

Without React: `createResponsive(shell, editor)`, `keyboardInset(element)` and `onKeyboard(listener)` from `@rebodocs/editor`.

## Reading view

There is one more view, which is never switched on by itself: the text set to the width of the window, with no pages, at its real size. Some people prefer it to read or write at length on a phone.

```ts
commands.setView('flow');     // and 'column' to go back to pages
```

It is the same document, and exports the same file. Tables narrow to fit, pictures shrink, and what belongs to the page (header, footer, letterhead) is not shown there.

## What to know

- It was checked in an emulated phone and tried on one real phone. Keyboards differ; report what yours does.
- No capital letter is put by itself at the start of a sentence.
- Autocorrection that rewrites a word already written is deliberately avoided, not supported.
