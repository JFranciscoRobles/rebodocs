// What kind of machine the page is on. Asked once, and not at all where there
// is no browser: a page drawn on a server first loads this code there.

/** Whether the keys are an Apple keyboard's: ⌘ where others have Ctrl. */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const KEYBOARD_MIN = 120;

/**
 * How much of the bottom of `el`, or of the window when there is none, in
 * pixels, an on-screen keyboard covers.
 * A phone does not make the window shorter when its keyboard comes up: it
 * draws the keyboard over it, and only says what is left to be seen.
 */
export function keyboardInset(el?: Element): number {
  const seen = typeof window === 'undefined' ? undefined : window.visualViewport;
  if (!seen) return 0;
  // Pinched in, what is seen is short for another reason than a keyboard.
  if (seen.scale > 1.01) return 0;
  const bottom = seen.offsetTop + seen.height;
  // Anything shorter than this is a bar of the browser coming and going.
  if (window.innerHeight - bottom < KEYBOARD_MIN) return 0;
  return Math.max(0, Math.round((el ? el.getBoundingClientRect().bottom : window.innerHeight) - bottom));
}

/** Calls `listener` when an on-screen keyboard comes up, goes away or changes size. Returns how to stop. */
export function onKeyboard(listener: () => void): () => void {
  const seen = typeof window === 'undefined' ? undefined : window.visualViewport;
  if (!seen) return () => {};
  seen.addEventListener('resize', listener);
  seen.addEventListener('scroll', listener);
  return () => {
    seen.removeEventListener('resize', listener);
    seen.removeEventListener('scroll', listener);
  };
}
