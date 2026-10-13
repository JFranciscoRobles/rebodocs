// Making do with a narrow window, as a phone's. The document stays what it
// is, its pages as they are on paper: the window is a place to look at them
// from, as near or as far as the person likes. So a page is shown whole
// across the window to begin with, and two fingers bring it nearer; what
// stood beside the document goes over it, and the room the keyboard of the
// screen takes is left empty. It only uses the public methods of the editor.

import type { Editor, ZoomFit } from './editor';
import { keyboardInset, onKeyboard } from './platform';

export interface Responsive {
  /** Whether the window is being treated as a narrow one. */
  readonly narrow: boolean;
  destroy(): void;
}

export interface ResponsiveOptions {
  /** Narrower than this, in pixels, the window is a narrow one. 600 unless said. */
  below?: number;
}

const STYLE_ID = 'dx-responsive-style';
const CSS = `
.dx-narrow .dx-ruler{display:none}
.dx-narrow .dx-pn{position:absolute;left:0;top:0;bottom:0;z-index:18;max-width:88vw;box-shadow:4px 0 24px rgba(0,0,0,.18)}
`;

/**
 * Watches the width of `shell`, the element the editor and what is around it
 * are in. While it is narrow it has the class `dx-narrow`, the pages are
 * shown as wide as the window, the ruler is put away and the side panel goes
 * over the document: what the panel is in has to be positioned for that. The
 * zoom the person gives the pages meanwhile is theirs; the one they had comes
 * back when the window is wide again.
 *
 * While the keyboard of the screen is up for something in `shell`, the part
 * of it the keyboard covers is left as padding, so that what it holds is laid
 * out in what can be seen.
 */
export function createResponsive(shell: HTMLElement, editor: Editor, options: ResponsiveOptions = {}): Responsive {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const below = options.below ?? 600;
  let narrow = false;
  /** The zoom the pages had before the window got narrow, to go back to when it is wide again. */
  let before: { zoom: number; fit: ZoomFit | undefined } | undefined;
  const fitWidth = () => {
    const now = shell.clientWidth > 0 && shell.clientWidth < below;
    if (now === narrow) return;
    narrow = now;
    shell.classList.toggle('dx-narrow', now);
    // Text set to the window, when that is what is being looked at, already fits it.
    if (editor.view === 'flow') return;
    if (now) {
      before = { zoom: editor.zoom, fit: editor.fit };
      editor.setFit('width');
    } else if (before) {
      if (before.fit) editor.setFit(before.fit);
      else editor.setZoom(before.zoom);
      before = undefined;
    }
  };
  const fitKeyboard = () => {
    shell.style.paddingBottom = '';
    const inset = shell.contains(document.activeElement) ? keyboardInset(shell) : 0;
    if (!inset) return;
    shell.style.boxSizing = 'border-box';
    shell.style.paddingBottom = `${inset}px`;
  };
  const watcher = new ResizeObserver(fitWidth);
  watcher.observe(shell);
  fitWidth();
  const stopKeyboard = onKeyboard(fitKeyboard);
  shell.addEventListener('focusout', fitKeyboard);

  return {
    get narrow() {
      return narrow;
    },
    destroy() {
      watcher.disconnect();
      stopKeyboard();
      shell.removeEventListener('focusout', fitKeyboard);
      shell.classList.remove('dx-narrow');
      shell.style.paddingBottom = '';
    },
  };
}
