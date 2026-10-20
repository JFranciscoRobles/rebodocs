// The editor for whoever draws their own interface, in React: a provider that
// holds the document, the element its pages go in, and a hook that gives what
// to show and what to do. Nothing here has a look of its own.
//
//   <DocsProvider docx={file} onSave={keep}>
//     <MyToolbar />            uses useDocs()
//     <DocsSurface className="flex-1 bg-slate-100" />
//   </DocsProvider>

import { type CSSProperties, type ReactNode, createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Editor } from '@rebodocs/editor';
import { type Docs, type DocsCommands, type DocsHeadlessOptions, type DocsState, createDocs } from './docs';

export interface DocsProviderProps extends DocsHeadlessOptions {
  children?: ReactNode;
}

interface Held {
  docs: Docs | undefined;
  /** What the surface calls with the element the pages go in, and with nothing when it is gone. */
  attach: (element: HTMLElement | null) => void;
}

const Context = createContext<Held | undefined>(undefined);

/** What there is to show before the document is there: on the server, and until the surface is on the page. */
const EMPTY: DocsState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  fontFamily: '',
  fontSize: 0,
  color: '000000',
  highlight: '',
  align: 'left',
  lineHeight: 1,
  styleId: undefined,
  list: undefined,
  link: undefined,
  canUndo: false,
  canRedo: false,
  collapsed: true,
  inTable: false,
  canEditTables: false,
  canMergeCells: false,
  canSplitCell: false,
  pictureSelected: false,
  letterhead: false,
  trackChanges: false,
  revisionCount: 0,
  area: 'body',
  page: 1,
  pageCount: 1,
  zoom: 1,
  view: 'column',
  fit: undefined,
  fonts: [],
  touch: false,
  findCount: 0,
  findIndex: 0,
  name: '',
  dirty: false,
  collab: 'off',
  peers: [],
  me: { name: '', color: '' },
};

/**
 * Holds a document for what is inside it: one `DocsSurface`, where its pages
 * go, and whatever uses `useDocs`. The document changes for another when what
 * it is changes: the file given, the room, or what lets the person in. Whether
 * it has the bar beside the selection (`bubble`) is read when it is made.
 */
export function DocsProvider({ children, ...options }: DocsProviderProps): ReactNode {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [docs, setDocs] = useState<Docs>();
  // The functions given are the ones of the last render, without making the document again for them.
  const latest = useRef(options);
  latest.current = options;
  const { docx, collab, name, author, letterhead } = options;
  const saves = !!options.onSave;
  const linkKey = !!options.onLinkKey;
  const findKey = !!options.onFindKey;

  useEffect(() => {
    if (!element) return;
    const now = latest.current;
    const made = createDocs(element, {
      ...now,
      onSave: now.onSave && ((file, called) => latest.current.onSave?.(file, called)),
      onChange: (editor) => latest.current.onChange?.(editor),
      onCollab: (state, peers) => latest.current.onCollab?.(state, peers),
      onError: (message) => (latest.current.onError ?? ((text: string) => alert(text)))(message),
    });
    setDocs(made);
    return () => {
      setDocs(undefined);
      made.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, docx, collab?.url, collab?.room, collab?.ticket, saves]);

  // Whether a key is answered may change; who answers it is whoever was given last.
  useEffect(() => {
    docs?.setKeys({
      onLinkKey: linkKey ? () => latest.current.onLinkKey?.() : undefined,
      onFindKey: findKey ? (replace) => latest.current.onFindKey?.(replace) : undefined,
    });
  }, [docs, linkKey, findKey]);

  useEffect(() => {
    if (name !== undefined) docs?.setName(name);
  }, [docs, name]);
  useEffect(() => {
    if (author !== undefined) docs?.setAuthor(author);
  }, [docs, author]);

  // The one it was made with is already on its way; another one given later takes its place.
  const given = useRef<{ docs: Docs | undefined; letterhead: typeof letterhead }>({ docs: undefined, letterhead });
  useEffect(() => {
    const was = given.current;
    given.current = { docs, letterhead };
    if (docs && was.docs === docs && was.letterhead !== letterhead && letterhead !== undefined) void docs.setLetterhead(letterhead);
  }, [docs, letterhead]);

  const held = useMemo<Held>(() => ({ docs, attach: setElement }), [docs]);
  return createElement(Context.Provider, { value: held }, children);
}

function useHeld(): Held {
  const held = useContext(Context);
  if (!held) throw new Error('useDocs and DocsSurface go inside a DocsProvider.');
  return held;
}

export interface DocsSurfaceProps {
  /** For what is around the pages: the size of the element, and the background they lie on. */
  className?: string;
  style?: CSSProperties;
}

/**
 * The pages of the document. It scrolls by itself, so something must give it
 * a height. Its look is its classes; `--dx-canvas`, `--dx-page-shadow`,
 * `--dx-selection` and `--dx-caret` change the rest.
 */
export function DocsSurface({ className, style }: DocsSurfaceProps): ReactNode {
  const { attach } = useHeld();
  const ref = useCallback((element: HTMLDivElement | null) => attach(element), [attach]);
  return createElement('div', { ref, className, style });
}

const nothing = () => () => {};
const refused = new Proxy({}, { get: () => () => undefined }) as DocsCommands;

export interface UseDocs {
  /** False on the server and until the pages are on the page: the state is an empty one and the commands do nothing. */
  ready: boolean;
  state: DocsState;
  commands: DocsCommands;
  /** Everything else: saving, sharing, the editor itself. */
  docs: Docs | undefined;
  editor: Editor | undefined;
}

/** What to show and what to do. Whatever uses it is drawn again when the state changes, and only then. */
export function useDocs(): UseDocs {
  const { docs } = useHeld();
  const state = useSyncExternalStore(docs?.subscribe ?? nothing, docs?.state ?? (() => EMPTY), () => EMPTY);
  return useMemo(() => ({ ready: !!docs, state, commands: docs?.commands ?? refused, docs, editor: docs?.editor }), [docs, state]);
}

/**
 * Something else of the document, worked out from the editor each time it
 * changes: its outline, its notes, its styles. What uses it is drawn again
 * only when what `select` gives is no longer the same, compared as JSON.
 * For small values: the whole document (`editor.doc`) is made into JSON at
 * every key, pictures and all. To know when it changes, `editor.onChange`.
 */
let warned = false;

export function useDocsValue<T>(select: (editor: Editor) => T, fallback: T): T {
  const { docs } = useHeld();
  const selector = useRef(select);
  selector.current = select;
  const kept = useRef<{ key: string; value: T }>(undefined);
  // The one given first: one made anew at each render would never be "the same as before".
  const empty = useRef(fallback).current;
  const read = useCallback(() => {
    if (!docs) return empty;
    const value = selector.current(docs.editor);
    const key = JSON.stringify(value);
    // A value this large makes each key slow: said once, with what to use instead.
    if (key && key.length > 200_000 && !warned) {
      warned = true;
      console.warn('useDocsValue: the value selected is too large to compare at every change (as the whole document would be). Use editor.onChange for that.');
    }
    if (kept.current?.key !== key) kept.current = { key, value };
    return kept.current.value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);
  return useSyncExternalStore(docs?.subscribe ?? nothing, read, () => empty);
}
