// The name the notes a person makes are signed with, remembered between
// visits wherever the browser lets a page keep something.

import type { Editor } from './editor';

const AUTHOR_KEY = 'docs.author';

/** Gives the editor the name kept from the last visit, unless it already has one. */
export function recallAuthor(editor: Editor): void {
  if (editor.author) return;
  try {
    editor.author = localStorage.getItem(AUTHOR_KEY) ?? '';
  } catch {
    // Nowhere to keep it: it is asked for again.
  }
}

/** Sets the name the notes are signed with, and keeps it for the next visit. */
export function setAuthor(editor: Editor, name: string): void {
  editor.author = name.trim();
  try {
    localStorage.setItem(AUTHOR_KEY, editor.author);
  } catch {
    // It lasts until the page is closed.
  }
}
