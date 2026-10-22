// What the page "Phones and touch" says that is data, each checked in
// packages/editor/src (responsive.ts, platform.ts, editor.ts: onTouchStart,
// onTouchMove, onTouchEnd, handle, renderHandles; bubble.ts: clipboard) and by
// touching a real editor in a phone-sized headless Chrome.

/** What a narrow window changes, from responsive.ts and fitGap in editor.ts. */
export const NARROW: { title: string; text: string }[] = [
  { title: 'Pages as wide as the window', text: 'Shown whole across it to begin with: a Letter page is at 46% on a phone 390 pixels wide. From there the zoom is the person’s.' },
  { title: 'Less room around them', text: 'From 24 pixels around and between the pages to 8: every pixel beside a page is one less of it.' },
  { title: 'No ruler', text: 'It is put away. The side panel opens over the document instead of making it narrower.' },
  { title: 'Bars that fold', text: 'The toolbar and the status bar put what does not fit in a menu, as they do at any width.' },
  { title: 'The zoom comes back', text: 'When the window is wide again, the pages go back to the zoom, or the fit, they had before.' },
];

/** The gestures, from the touch handlers of editor.ts. */
export const GESTURES: { gesture: string; text: string }[] = [
  { gesture: 'Tap', text: 'Places the caret and brings up the keyboard. A handle stays under the caret for four seconds, to drag it exactly where it should be.' },
  { gesture: 'Tap on the caret', text: 'Again where the caret is, or on its handle: brings up the bar with Paste, Paste as text and Select all.' },
  { gesture: 'Double tap', text: 'Selects the word. A third tap, the paragraph.' },
  { gesture: 'Hold', text: 'Selects the word under the finger; without lifting it, the selection is drawn out.' },
  { gesture: 'Handles', text: 'One at each end of a selection. Dragged near the top or the bottom of the window, the document scrolls under them.' },
  { gesture: 'Swipe', text: 'Scrolls, without moving the caret.' },
  { gesture: 'Pinch', text: 'Zooms around the fingers: what is under them stays under them, and the two fingers carry the page as they go.' },
];

export const KNOW: string[] = [
  'It was checked in a phone emulated in Chrome, with real touch events, and tried on one real phone. On-screen keyboards differ (Gboard, iOS, Samsung): say what yours does.',
  'No capital letter is put by itself at the start of a sentence, and the keyboard is asked not to correct: the field has autocapitalize and autocorrect off.',
  'A keyboard that goes back and rewrites a word already written is not followed: the word being typed is.',
];
