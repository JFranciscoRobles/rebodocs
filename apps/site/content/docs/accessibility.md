# Accessibility

The pages are drawn letter by letter, in positioned pieces a screen reader cannot follow. So the editor tells a screen reader what happens instead, and every part of the interface around the pages works from the keyboard. This follows WCAG 2.2 at level AA. It has been checked in headless Chrome by reading what is announced after each key, not yet with VoiceOver, NVDA or JAWS: see [what is not checked](#what-is-not-checked).

## What a screen reader hears

The field that has the keyboard is named "Document", and its description gives the keys to leave it. After each key, a live region says:

- **What the caret moved over**: the letter with the arrows, the word with Alt or Ctrl and an arrow, the line with up, down, Home and End. A space, a tab and the end of a paragraph are said by their name.
- **Where it is, when that changes**, before the text: the page, a heading, "Table, row 2, column 1", "Left the table", "Numbered list, level 2", "Link to…", "Inserted by Luis".
- **What was selected**: "…, selected" or "…, unselected", and "All selected". A long selection gives its start and its length, not the whole text.
- **What a key did**: "o, deleted", bold turned on or off, "Undone" or "Nothing to undo", "Pasted", entering the header or the footer.

The pages themselves are hidden from screen readers (`aria-hidden`), as are the caret and the selection.

## Screen reader mode

**⌘⌥Z** (Ctrl+Alt+Z on Windows and Linux) turns it on and off, as in Google Docs. With it on, the hidden field holds the paragraph the caret is in, with the caret and the selection where they are. The screen reader then reads it with its own commands (the current line, the word, spelling it out), and a braille display shows it. The editor stops saying the text, so it is not heard twice, and only says where the caret is: the page, the table, the heading.

```ts
editor.screenReader = true; // or let the person press the keys
```

What is typed in this mode goes into the document as usual. A keyboard that composes words (Chinese, Japanese, a phone's) puts in the word when it is finished, not letter by letter.

## The keyboard

| Keys | What they do |
| --- | --- |
| **Alt+F10** | To the toolbar. |
| **F6**, **Shift+F6** | From one part to the next: toolbar, ruler, side panel, document, status bar, and the find bar while it is open. |
| **Escape** | From any part back to the document. In a menu, back to the button that opened it. |
| **Tab** | In the toolbar, one stop; the arrows, Home and End go along it. |
| **Enter**, **↓** | On a button with a menu, open it with the keyboard inside; the arrows go through it, and through grids (the size of a table, colours) in two directions. |
| **Tap of ⌘** (Ctrl) | Shows the bar beside the selection. **Tab** goes into it, the arrows along it, Tab or Escape back to the text. |
| **⌘⌥Z** (Ctrl+Alt+Z) | Screen reader mode. |

**The ruler.** Each margin and indent is a slider: the arrows move it a quarter of a centimetre, Shift a whole one, Alt a point, and its value is read in centimetres. On the button at its corner, Enter changes the kind of tab stop and Insert sets one at the caret. A tab stop moves with the arrows and goes with Delete.

**Dialogs and the menu.** The document menu, page setup, the picture grid and the comparison of versions keep Tab inside them while they are open, and give the keyboard back to what had it when they close. Pictures in the grid move with buttons as well as by dragging.

**The side panel.** Its tabs are a tab list: one stop, and the arrows go from one to the next.

## What is seen

- A ring around whatever has the keyboard, in every part.
- Text in the interface is at least 4.5:1 against its background.
- Buttons and choices are at least 24 pixels, or that far apart.
- Colours are read by name ("dark gray", "sky blue"), not by number, and the colour button says the one in use.
- **High contrast.** With the colours of the system forced on the page, as Windows does, the selection, the caret, the find results, what is on and what has the keyboard stay visible. The pages keep their own colours: they are the document as it will print.
- **Less motion.** With "reduce motion" set, the caret does not blink and the menu does not slide.

## For your own interface

With the [headless hooks](/docs/headless/), the bars are yours: give buttons `aria-pressed`, menus `aria-haspopup` and `aria-expanded`, and colour swatches a name. `editor.announce(text)` says something through the editor's live region:

```ts
editor.announce('Document saved');
```

## What is not checked

- **Real screen readers.** VoiceOver, NVDA and JAWS each read a live region and a text field in their own way. What is announced was checked in Chrome, not by listening.
- **Screen reader mode** relies on the screen reader following the caret of a field the editor moves. That is how they work, but it needs trying with each one.
- **The PDF** exported is not tagged: a screen reader cannot read its structure.
- **An automated audit** (axe, Lighthouse) has not been run as part of the tests.
