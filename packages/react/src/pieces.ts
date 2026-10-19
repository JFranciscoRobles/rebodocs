// What the panels and the dialogs of an interface are made of, without the
// panels and the dialogs: finding and replacing, the link, the notes, the
// outline, the variables of a template, the styles, the page. Each is a hook
// that gives what there is to show and what there is to do, for whoever draws
// them their own way. All of them go inside a `DocsProvider`.

import { type CSSProperties, type ReactNode, createElement, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { type ActiveFormat, type FindOptions, type FormatId, type OutlineItem, type PageNumbering, type PageSetup, docText, formatText, formatValue } from '@rebodocs/core';
import { type Bubble, type NoteView, type ZoomFit, createRuler, getLocale, keyboardInset, onKeyboard, onLocaleChange, styleName } from '@rebodocs/editor';
import { useDocs, useDocsValue } from './headless';

export interface DocsFind {
  query: string;
  options: FindOptions;
  /** Looks for it as it is typed; an empty one stops the search. The keyboard stays where it is: in the field it is typed in. */
  setQuery(query: string): void;
  setOptions(options: FindOptions): void;
  /** How many places it is in, and which of them is selected, from 1; 0 for none. */
  count: number;
  index: number;
  next(): void;
  previous(): void;
  /** Replaces the place selected and goes to the next; says whether there was one. */
  replace(text: string): boolean;
  /** Replaces every place, as one step to undo; says how many there were. */
  replaceAll(text: string): number;
  /** Stops the search and gives the keyboard back to the document. */
  close(): void;
}

export function useDocsFind(): DocsFind {
  const { editor, state } = useDocs();
  const [query, setText] = useState('');
  const [options, setChosen] = useState<FindOptions>({});
  const setQuery = useCallback(
    (next: string) => {
      setText(next);
      editor?.find(next, options);
    },
    [editor, options],
  );
  const setOptions = useCallback(
    (next: FindOptions) => {
      setChosen(next);
      editor?.find(query, next);
    },
    [editor, query],
  );
  return useMemo(
    () => ({
      query,
      options,
      setQuery,
      setOptions,
      count: state.findCount,
      index: state.findIndex,
      next: () => void editor?.findStep(1),
      previous: () => void editor?.findStep(-1),
      replace: (text) => editor?.replaceFound(text) ?? false,
      replaceAll: (text) => editor?.replaceAllFound(text) ?? 0,
      close: () => {
        setText('');
        editor?.find('');
        editor?.focus();
      },
    }),
    [editor, query, options, setQuery, setOptions, state.findCount, state.findIndex],
  );
}

export interface DocsLink {
  /** The link the caret is in: its address and its text. */
  active: { href: string; text: string } | undefined;
  /** Whether there is something to make a link of, or one to change: text selected, or the caret in a link. */
  possible: boolean;
  /** Makes the selection a link to an address, or changes the one the caret is in; false for an address that is not one. */
  set(address: string): boolean;
  remove(): void;
  /** Opens the link the caret is in, in another tab. */
  open(): void;
}

export function useDocsLink(): DocsLink {
  const { editor, state, commands } = useDocs();
  const active = useDocsValue((e) => e.activeLink ?? null, null);
  return useMemo(
    () => ({
      active: active ?? undefined,
      possible: !!active || !state.collapsed,
      set: (address) => commands.setLink(address) ?? false,
      remove: () => commands.removeLink(),
      open: () => active && editor?.openLink(active.href),
    }),
    [editor, commands, active, state.collapsed],
  );
}

/**
 * The bar beside the selection of a document made with one (`<DocsProvider bubble>`):
 * to show it from a button, or to have it ask for a variable, a note or a link.
 * Undefined without one, and until the document is there.
 */
export function useDocsBubble(): Bubble | undefined {
  return useDocs().docs?.bubble;
}

export interface DocsNotes {
  notes: NoteView[];
  /** The note the caret is in the text of. */
  active: string | undefined;
  /** Puts a note on the selection; gives its id, or nothing when there is nothing selected to put it on. */
  add(text: string): string | undefined;
  setText(id: string, text: string): void;
  setColor(id: string, color: string): void;
  remove(id: string): void;
  /** Selects the text a note is about, and brings it into view. */
  select(id: string): void;
}

export function useDocsNotes(): DocsNotes {
  const { editor } = useDocs();
  const notes = useDocsValue((e) => e.notes, []);
  const active = useDocsValue((e) => e.activeNote ?? null, null);
  return useMemo(
    () => ({
      notes,
      active: active ?? undefined,
      // Not through the commands: the text of a note is typed in a field of its own, which keeps the keyboard.
      add: (text) => editor?.addNote(text),
      setText: (id, text) => editor?.setNoteText(id, text),
      setColor: (id, color) => editor?.setNoteColor(id, color),
      remove: (id) => editor?.removeNote(id),
      select: (id) => void editor?.selectNote(id),
    }),
    [editor, notes, active],
  );
}

export interface DocsOutline {
  /** The title and the headings of the document, in order. */
  items: OutlineItem[];
  /** Which of them the caret is under: its place in `items`, or -1. */
  active: number;
  goTo(item: OutlineItem): void;
  /** Moves a heading, with everything under it, to before another one, or to the end. */
  move(item: OutlineItem, before?: OutlineItem): void;
}

export function useDocsOutline(): DocsOutline {
  const { commands } = useDocs();
  const items = useDocsValue((e) => e.outline, []);
  const active = useDocsValue((e) => e.activeHeading, -1);
  return useMemo(() => ({ items, active, goTo: (item) => commands.goToHeading(item.para), move: (item, before) => commands.moveSection(item.para, before?.para) }), [commands, items, active]);
}

export interface DocsVariables {
  /** The variables of the template, `{{like this}}` in the text, each once. */
  names: string[];
  /** The one the caret is in. */
  active: string | undefined;
  insert(name: string): void;
  /** Selects the next place a variable is used. */
  select(name: string): void;
  /** Puts a value in place of each variable that has one, everywhere, as one step to undo. */
  fill(values: Record<string, string>): void;
  /** What every use of each variable asks of its value: capitals, bold, how a date or a number is written. */
  formats: Record<string, ActiveFormat[]>;
  /** How many times each is used in the document, its header and its footer. */
  uses: Record<string, number>;
  /** Gives a format to every use of a variable, or takes it away. A way of writing a date or a number takes the place of the one there was, and so does a change of capitals. */
  setFormat(name: string, id: FormatId, on: boolean, arg?: string): void;
  /** What a value would come out as in the place of a variable, and whether it cannot be written as its formats ask: not a date, not a number. */
  preview(name: string, value: string): { text: string; bad: boolean };
}

export function useDocsVariables(): DocsVariables {
  const { editor, commands } = useDocs();
  const names = useDocsValue((e) => e.variables, []);
  const active = useDocsValue((e) => e.activeVariable ?? null, null);
  const formats = useDocsValue((e) => Object.fromEntries(e.variables.map((name) => [name, e.variableFormats(name)])), {} as Record<string, ActiveFormat[]>);
  const uses = useDocsValue((e) => Object.fromEntries(e.variables.map((name) => [name, e.variableUses(name)])), {} as Record<string, number>);
  return useMemo(
    () => ({
      names,
      active: active ?? undefined,
      insert: (name) => commands.insertVariable(name),
      select: (name) => void editor?.selectVariable(name),
      fill: (values) => commands.fillVariables(values),
      formats,
      uses,
      setFormat: (name, id, on, arg) => editor?.setVariableFormat(name, id, on, arg),
      preview: (name, value) => {
        const { text, problems } = formatValue(value, (formats[name] ?? []).map((format) => formatText(format.id, format.arg)));
        return { text, bad: value !== '' && problems.length > 0 };
      },
    }),
    [editor, commands, names, active, formats, uses],
  );
}

export interface DocsStyles {
  /** Each with its name in the language of the interface; a style of the document's own keeps the name it has. */
  styles: { id: string; name: string }[];
  /** The style of the selection; undefined when it covers several. */
  active: string | undefined;
  set(id: string): void;
}

export function useDocsStyles(): DocsStyles {
  const { state, commands } = useDocs();
  // Read again when the language changes: the standard styles are called another way.
  useSyncExternalStore(onLocaleChange, getLocale, getLocale);
  const styles = useDocsValue((e) => e.styles.map((style) => ({ id: style.id, name: styleName(style) })), []);
  return useMemo(() => ({ styles, active: state.styleId, set: (id) => commands.setParagraphStyle(id) }), [commands, styles, state.styleId]);
}

export interface DocsPage {
  /** The size of the page and its margins, in points (1/72 in): those of the section being edited. */
  page: PageSetup | undefined;
  /** Changes them for the section being edited, or, with `everywhere`, for every section. */
  set(patch: Partial<PageSetup>, everywhere?: boolean): void;
  /** How many sections the document has, and which one, from 0, is being edited: the caret's. */
  sections: number;
  section: number;
  /** Whether that section has a header and a footer of its own; the others show the document's, which are the last section's. */
  ownHeaders: boolean;
  setOwnHeaders(on: boolean): void;
  /** Where the page number is and how it is written; undefined for none. */
  numbering: PageNumbering | undefined;
  setNumbering(numbering: PageNumbering | undefined): void;
  /** Whether the first page of the section has a header and a footer of its own. */
  firstPageDifferent: boolean;
  setFirstPageDifferent(on: boolean): void;
  /** Whether the document has a letterhead: a picture the size of the page, under the text of every page. */
  letterhead: boolean;
  /**
   * Gives it the letterhead a PNG or JPG file is, in place of the one it had; resolves to whether the file is one.
   * The top and bottom margins grow to clear what it prints, unless `fit` is false.
   */
  setLetterhead(file: Blob, fit?: boolean): Promise<boolean>;
  /** Makes the margins clear what the letterhead it has prints at the top and the bottom of the page. */
  fitLetterheadMargins(): Promise<boolean>;
  removeLetterhead(): void;
  /** The picture the letterhead is, as a file: to save it apart, or to put it on another document. */
  letterheadFile(): Blob | undefined;
}

export function useDocsPage(): DocsPage {
  const { commands, state, editor } = useDocs();
  const page = useDocsValue((e) => e.page, null);
  const numbering = useDocsValue((e) => e.pageNumbering ?? null, null);
  const first = useDocsValue((e) => e.firstPageDifferent, false);
  const sections = useDocsValue((e) => e.sectionCount, 1);
  const section = useDocsValue((e) => e.sectionIndex, 0);
  const own = useDocsValue((e) => e.ownHeaders, true);
  return useMemo(
    () => ({
      page: page ?? undefined,
      set: (patch, everywhere) => commands.setPage(patch, everywhere),
      sections,
      section,
      ownHeaders: own,
      setOwnHeaders: (on) => commands.setOwnHeaders(on),
      numbering: numbering ?? undefined,
      setNumbering: (next) => commands.setPageNumbering(next),
      firstPageDifferent: first,
      setFirstPageDifferent: (on) => commands.setFirstPageDifferent(on),
      letterhead: state.letterhead,
      setLetterhead: async (file, fit) => (await commands.setLetterheadFile(file, fit)) ?? false,
      fitLetterheadMargins: async () => (await commands.fitLetterheadMargins()) ?? false,
      removeLetterhead: () => commands.removeLetterhead(),
      letterheadFile: () => {
        const image = editor?.letterhead;
        return image && new Blob([image.bytes as BlobPart], { type: image.type });
      },
    }),
    [commands, editor, page, numbering, first, sections, section, own, state.letterhead],
  );
}

/** Where on the screen the selection is: what to put a panel of one's own beside. Undefined while there is none to show. */
export interface DocsSelectionBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function useDocsSelectionBox(): DocsSelectionBox | undefined {
  const { editor } = useDocs();
  const [box, setBox] = useState<DocsSelectionBox>();
  useEffect(() => {
    if (!editor) return;
    const read = () => {
      const at = editor.selectionBounds();
      const next = at && { top: at.top, left: at.left, width: at.width, height: at.height };
      setBox((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
    };
    read();
    const stop = editor.onChange(read);
    // The pages move under the selection when they are scrolled, and when the window changes size.
    editor.element.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    return () => {
      stop();
      editor.element.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, [editor]);
  return editor ? box : undefined;
}

/** What a narrow window, as a phone's, asks of an interface. */
export interface DocsResponsive {
  /** Whether the document has less than the width asked for to be shown in. */
  narrow: boolean;
  /**
   * How much of the bottom of the window, in pixels, the keyboard of the
   * screen covers: a phone draws it over the page and does not make the
   * window shorter. What must stay in sight is kept that far from the bottom.
   */
  keyboard: number;
}

/**
 * Makes do with a narrow window: while the document has less than `below`
 * pixels across, its pages are shown as wide as the window, for the person
 * to bring nearer with two fingers; the zoom they had comes back when there
 * is room again.
 */
export function useDocsResponsive(below = 600): DocsResponsive {
  const { editor } = useDocs();
  const [narrow, setNarrow] = useState(false);
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    if (!editor) return;
    let was: boolean | undefined;
    let before: { zoom: number; fit: ZoomFit | undefined } | undefined;
    const fit = () => {
      const width = editor.element.clientWidth;
      const now = width > 0 && width < below;
      if (now === was) return;
      was = now;
      setNarrow(now);
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
    const watcher = new ResizeObserver(fit);
    watcher.observe(editor.element);
    fit();
    const stop = onKeyboard(() => setKeyboard(keyboardInset()));
    return () => {
      watcher.disconnect();
      stop();
    };
  }, [editor, below]);
  return useMemo(() => ({ narrow, keyboard }), [narrow, keyboard]);
}

export interface DocsCount {
  words: number;
  characters: number;
  /** The same of what is selected; undefined when nothing is. */
  selected: { words: number; characters: number } | undefined;
}

const countOf = (text: string) => ({ words: text.split(/\s+/).filter(Boolean).length, characters: text.replace(/[\n\r\f\uFFFC]/g, '').length });
const NO_COUNT: DocsCount = { words: 0, characters: 0, selected: undefined };

/** How long the document is, and what is selected of it. The whole is counted again only when the document changes, not at each move of the caret. */
export function useDocsCount(): DocsCount {
  const counted = useRef<{ doc: unknown; total: { words: number; characters: number } }>(undefined);
  return useDocsValue((e) => {
    if (counted.current?.doc !== e.doc) counted.current = { doc: e.doc, total: countOf(docText(e.doc)) };
    return { ...counted.current.total, selected: e.collapsed ? undefined : countOf(e.selectedText) };
  }, NO_COUNT);
}

export interface DocsRulerProps {
  className?: string;
  style?: CSSProperties;
}

/**
 * The ruler of the document: the width of the page in centimetres, its
 * margins and the indents of the paragraph the caret is in, to drag. It goes
 * above the `DocsSurface`, as wide as it. It is drawn as the included
 * interface draws it; `--dx-ruler`, `--dx-ruler-line`, `--dx-ruler-margin`,
 * `--dx-ruler-text`, `--dx-ruler-ink` and `--dx-ruler-on` change its colours.
 */
export function DocsRuler({ className, style }: DocsRulerProps): ReactNode {
  const { editor } = useDocs();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!element || !editor) return;
    const ruler = createRuler(element, editor);
    return () => {
      ruler.destroy();
      element.replaceChildren();
    };
  }, [element, editor]);
  return createElement('div', { ref: setElement, className, style });
}
