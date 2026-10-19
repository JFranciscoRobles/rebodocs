// The editor without an interface of its own: the pages of the document in an
// element, and around them nothing. What a toolbar would show is here as a
// state to read, and what its buttons would do as commands to call, so that
// whoever uses it draws their own, with their own styles. The interface this
// package comes with is built on this too.
//
// The pages themselves are not for styling: where each letter goes is worked
// out, not left to the browser. What is around them is: the background they
// lie on, their shadow, the colour of the selection.

import { type CollabState, type Peer, type Session, createRoom, joinRoom, pingServer } from '@rebodocs/collab/browser';
import { letterheadImage } from '@rebodocs/core';
import { type Bubble, type EditArea, type FontSource, type Versions, type ViewMode, type ZoomFit, Editor, IS_MAC, addFonts, fontFamilies, createBubble, recallAuthor, setAuthor, t } from '@rebodocs/editor';
import { type AssistantLink, type AssistantOptions, connectAssistant } from '@rebodocs/mcp/browser';

export interface DocsCoreOptions {
  /** The document to open, as a DOCX; an empty one without it. Not used with `collab`, where the room has it. */
  docx?: Uint8Array | ArrayBuffer;
  /** What the document is called: given to what is exported and saved. */
  name?: string;
  /** Who the person is: what their notes are signed with, and what the others see them as. */
  author?: string;
  /** A document several people work on at once: the collaboration server, the room, and what lets this person in. */
  collab?: { url: string; room: string; ticket?: string };
  /**
   * The letterhead the document is to have, whatever it came with: a picture
   * (PNG or JPG) as a file, as its bytes, or as the address to fetch it from.
   * `null` for none. Left out, the document keeps its own and the person may
   * change it. It is put once the document is there, and the margins grow to
   * clear what it prints.
   */
  letterhead?: LetterheadSource | null;
  /**
   * Fonts of the application's own, besides the ones the machine has: each
   * with its family and its file. They are for the whole page, not for this
   * document alone, and stay once given.
   */
  fonts?: FontSource[];
  /**
   * Whether the DOCX made of the document carries the fonts given in `fonts`
   * that its text is in (the TrueType ones whose licence lets them). On unless false.
   */
  embedFonts?: boolean;
  /**
   * The versions of the document, where the application keeps them: what
   * lists them, gives one back, and keeps a new one. With them, the side
   * panel has a tab to compare the document with one and to go back to it.
   */
  versions?: Versions;
  /** Given the document when the person saves (⌘S, or `save()`): keeping it is the application's business. */
  onSave?: (docx: Uint8Array, name: string) => void | Promise<void>;
  /** Called when the document changes. */
  onChange?: (editor: Editor) => void;
  /** Called when the connection to the others, or who they are, changes. */
  onCollab?: (state: CollabState | 'off', peers: Peer[]) => void;
  /** Told what went wrong, in the language of the interface; the browser says it when left out. */
  onError?: (message: string) => void;
}

/**
 * The keys the editor knows but whose answer is the interface's: it has no
 * dialog for a link and no bar to search in. Each is taken from the browser
 * only while it has someone to call.
 */
export interface DocsKeys {
  /** ⌘K (Ctrl+K elsewhere), with the keyboard in the document: time to ask for the address of a link. Without it, the bar beside the selection asks, when there is one. */
  onLinkKey?: () => void;
  /** ⌘F and ⌘H (Ctrl elsewhere), with the keyboard in the document: time to show the search, with replacing (`replace`) or without. */
  onFindKey?: (replace: boolean) => void;
}

/** What a document without an interface takes besides what every document does. */
export interface DocsHeadlessOptions extends DocsCoreOptions, DocsKeys {
  /**
   * The bar that comes up beside the selection, with what can be done to it:
   * copying and pasting on a screen that is touched, making a variable of the
   * words selected, a link, a note. It is the one thing here with a look of
   * its own (the classes `dx-bb…`). Off unless true; read when the document
   * is made.
   */
  bubble?: boolean;
}

export type LetterheadSource = Blob | { bytes: Uint8Array; type: string } | string;

/** What an interface shows of the document and the selection, as plain values: the same object until one of them changes. */
export interface DocsState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  fontFamily: string;
  fontSize: number;
  /** Hex RGB without '#'. */
  color: string;
  /** Hex RGB without '#'; '' for none. */
  highlight: string;
  align: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  /** The paragraph style of the selection, an id among `editor.styles`; undefined when it covers several. */
  styleId: string | undefined;
  list: 'bullet' | 'number' | undefined;
  /** The address of the link the caret is in. */
  link: string | undefined;
  canUndo: boolean;
  canRedo: boolean;
  /** Whether nothing is selected: the selection is a caret. */
  collapsed: boolean;
  inTable: boolean;
  canEditTables: boolean;
  canMergeCells: boolean;
  canSplitCell: boolean;
  pictureSelected: boolean;
  /** Whether the document has a letterhead: a picture the size of the page under the text. */
  letterhead: boolean;
  /** Whether what is typed and deleted is tracked, as changes to accept or reject. */
  trackChanges: boolean;
  /** How many changes there are to accept or reject; `editor.revisions` lists them. */
  revisionCount: number;
  /** Where typing goes: the text, or the header or footer. */
  area: EditArea;
  page: number;
  pageCount: number;
  zoom: number;
  view: ViewMode;
  fit: ZoomFit | undefined;
  /** The families of the fonts the application gave, to offer besides the usual ones. */
  fonts: string[];
  /** True from a touch of the screen until the mouse is used: there are then no keys to copy and paste with. */
  touch: boolean;
  /** How many places the search found, and which of them the selection is, from 1; 0 when it is none of them. */
  findCount: number;
  findIndex: number;
  name: string;
  /** Whether it changed since it was opened or last saved. With others on it, it is kept as it changes. */
  dirty: boolean;
  collab: CollabState | 'off';
  /** The others on the document, and this person among them. */
  peers: Peer[];
  me: { name: string; color: string };
}

/** What a button of an interface calls. Each is the editor's own, and gives the keyboard back to the document after. */
const COMMANDS = [
  'undo',
  'redo',
  'toggleMark',
  'setRunProps',
  'setParagraphProps',
  'setParagraphStyle',
  'toggleList',
  'shiftListLevel',
  'shiftIndent',
  'insertText',
  'insertPageBreak',
  'insertTable',
  'insertTableRow',
  'insertTableColumn',
  'deleteTableRow',
  'deleteTableColumn',
  'deleteTable',
  'mergeTableCells',
  'splitTableCell',
  'setTableCellProps',
  'setTableBorders',
  'setHeaderRow',
  'setTableRowHeight',
  'setColumns',
  'insertColumnBreak',
  'insertImageFile',
  'insertImageGrid',
  'setPictureWrap',
  'fitSelectedPicture',
  'insertVariable',
  'fillVariables',
  'setLink',
  'removeLink',
  'addNote',
  'setNoteText',
  'setNoteColor',
  'removeNote',
  'selectNote',
  'insertToc',
  'updateToc',
  'goToHeading',
  'moveSection',
  'insertSignatures',
  'insertFootnote',
  'insertTextBox',
  'restoreVersion',
  'setTrackChanges',
  'acceptRevision',
  'rejectRevision',
  'acceptAllRevisions',
  'rejectAllRevisions',
  'goToRevision',
  'selectRevision',
  'setPage',
  'setPageNumbering',
  'setFirstPageDifferent',
  'setOwnHeaders',
  'setLetterhead',
  'setLetterheadFile',
  'fitLetterheadMargins',
  'removeLetterhead',
  'setArea',
  'find',
  'findStep',
  'replaceFound',
  'replaceAllFound',
  'selectAll',
  'copy',
  'cut',
  'paste',
  'setZoom',
  'setFit',
  'setView',
  'setShowNotes',
  'print',
] as const satisfies readonly (keyof Editor)[];

export type DocsCommands = Pick<Editor, (typeof COMMANDS)[number]>;

export interface Docs {
  /** The editor itself: everything the commands and the state are made of, and more. */
  readonly editor: Editor;
  readonly commands: DocsCommands;
  /** What there is to show, as it is now. The same object until something in it changes. */
  state(): DocsState;
  /** Calls `listener` when the document, the selection, the name or the people on it change. Returns what stops it. */
  subscribe(listener: () => void): () => void;
  /** The session with the others, while there is one. */
  readonly collab: Session | undefined;
  readonly assistant: AssistantLink | undefined;
  /** The document as a DOCX, as it is now. */
  exportDocx(): Uint8Array;
  /** Gives the document to `onSave`. */
  save(): Promise<void>;
  /** Downloads the document as a DOCX. */
  download(): void;
  /** Opens a DOCX in place of the document: the one given, or one the person picks. Leaves the room, if in one. */
  openFile(file?: Blob & { name?: string }): Promise<boolean>;
  /** Starts sharing the document on a collaboration server; gives the name of the room it made. */
  share(server: { url: string; token?: string }): Promise<string | undefined>;
  /** Stops working with the others; the document stays as it is. */
  leave(): void;
  /** Gives the document a letterhead, or takes it away with `null`. One it already has, the very same, is left alone. */
  setLetterhead(letterhead: LetterheadSource | null): Promise<void>;
  /** Lets an AI assistant reach the document, through an MCP server. */
  connectAssistant(options?: Pick<AssistantOptions, 'url' | 'token'>): AssistantLink;
  /** The bar beside the selection, when the document was made with one: to show it, or to have it ask for a variable, a note or a link. */
  readonly bubble: Bubble | undefined;
  /** Changes who answers the keys of the interface; one left out is no longer answered. */
  setKeys(keys: DocsKeys): void;
  setName(name: string): void;
  setAuthor(author: string): void;
  focus(): void;
  destroy(): void;
}

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Puts the pages of a document in `container`, and gives what an interface needs to work on it. */
export function createDocs(container: HTMLElement, options: DocsHeadlessOptions = {}): Docs {
  const editor = new Editor(container);
  if (options.fonts?.length) void addFonts(options.fonts);
  if (options.embedFonts === false) editor.embedFonts = false;
  if (options.author) editor.author = options.author;
  else recallAuthor(editor);
  let name = options.name ?? '';
  const fail = (message: string) => (options.onError ?? ((text: string) => alert(text)))(message);
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  const loadFile = (data: Uint8Array | ArrayBuffer): boolean => {
    try {
      editor.loadDocx(data);
      return true;
    } catch (error) {
      fail(t('app.openFailed', { error: (error as Error).message }));
      return false;
    }
  };
  if (options.docx && !options.collab) loadFile(options.docx);
  /** The document as it was opened or last saved: while the editor holds this very one, there is nothing to save. */
  let savedDoc = editor.doc;

  // --- The letterhead ------------------------------------------------------------

  const applyLetterhead = async (given: LetterheadSource | null) => {
    if (given === null) {
      if (editor.hasLetterhead) editor.removeLetterhead();
      return;
    }
    try {
      const blob = typeof given === 'string' ? await (await fetch(given)).blob() : given instanceof Blob ? given : new Blob([given.bytes as BlobPart], { type: given.type });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const now = letterheadImage(editor.doc)?.bytes;
      // The one it has: a template that came with it, or someone else on the document who put it first.
      if (now && now.length === bytes.length && now.every((byte, i) => byte === bytes[i])) return;
      if (!(await editor.setLetterheadFile(blob))) fail(t('letterhead.failed'));
    } catch {
      fail(t('letterhead.failed'));
    }
  };
  /** The letterhead the application gives is how the document starts: not a change of the person's to undo or to save. */
  const startWith = async (given: LetterheadSource | null | undefined) => {
    if (given === undefined) return;
    const before = editor.commits;
    await applyLetterhead(given);
    if (session || editor.commits !== before + 1) return;
    editor.load(editor.doc);
    savedDoc = editor.doc;
    emit();
  };

  // --- The others -----------------------------------------------------------------

  let session: Session | undefined;
  let starting = false;
  const collabState = (): CollabState | 'off' => (session ? (session.state === 'closed' ? 'off' : session.state) : starting ? 'connecting' : 'off');
  const enterRoom = (url: string, room: string, ticket?: string) => {
    let titled = false;
    const joined = joinRoom(editor, room, {
      url,
      name: editor.author,
      ticket,
      onChange: () => {
        if (session !== joined) return;
        if (joined.state === 'on' && !titled) {
          titled = true;
          if (joined.title && !options.name) name = joined.title;
          // Who the person is, is for the application to say when it says who may come in: their notes are signed with it too.
          if (ticket && joined.name) editor.author = joined.name;
          savedDoc = editor.doc;
          void startWith(options.letterhead);
        }
        if (joined.state === 'closed') {
          // Not left from here: the room is not there, or is not this person's to come into.
          session = undefined;
          fail(t('collab.gone'));
        }
        emit();
        options.onCollab?.(collabState(), session?.peers ?? []);
      },
    });
    session = joined;
  };
  const room = () => session?.room;
  const leave = () => {
    if (!session) return;
    const left = session;
    session = undefined;
    left.leave();
    emit();
    options.onCollab?.('off', []);
  };
  if (options.collab) enterRoom(options.collab.url, options.collab.room, options.collab.ticket);
  else void startWith(options.letterhead);

  // --- Files ----------------------------------------------------------------------

  const save = async () => {
    if (!options.onSave) return;
    try {
      await options.onSave(editor.exportDocx(), name);
      savedDoc = editor.doc;
      emit();
    } catch (error) {
      fail(t('app.saveFailed', { error: (error as Error).message }));
    }
  };
  const pick = (): Promise<File | undefined> =>
    new Promise((done) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.docx';
      input.addEventListener('change', () => done(input.files?.[0]));
      input.addEventListener('cancel', () => done(undefined));
      input.click();
    });

  // --- The keys of the interface --------------------------------------------------

  const bubble = options.bubble ? createBubble(editor) : undefined;
  let keys: DocsKeys = {};
  const setKeys = (next: DocsKeys) => {
    keys = { onLinkKey: next.onLinkKey, onFindKey: next.onFindKey };
    // Only with someone to call: the editor leaves the key to the browser otherwise.
    if (keys.onLinkKey) editor.onLinkKey = () => keys.onLinkKey?.();
    else editor.onLinkKey = bubble && (() => bubble.ask('link'));
  };
  // The whole interface puts its own in place of these: it is given neither.
  if (bubble || options.onLinkKey || options.onFindKey) setKeys(options);

  // The usual keys, while the keyboard is in the document; elsewhere on the page they are the application's.
  const onKey = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
    const key = e.key.toLowerCase();
    if (key === 's' && options.onSave) {
      e.preventDefault();
      void save();
    } else if (key === 'p') {
      e.preventDefault();
      editor.print();
    } else if ((key === 'f' || key === 'h') && keys.onFindKey && (IS_MAC ? e.metaKey : e.ctrlKey)) {
      e.preventDefault();
      keys.onFindKey(key === 'h');
    }
  };
  container.addEventListener('keydown', onKey);

  // --- What there is to show ------------------------------------------------------

  let assistant: AssistantLink | undefined;
  let shown: DocsState | undefined;
  let shownKey = '';
  const state = (): DocsState => {
    const run = editor.activeRunProps();
    const paragraph = editor.activeParagraphProps();
    const next: DocsState = {
      bold: run.bold,
      italic: run.italic,
      underline: run.underline,
      strike: run.strike,
      fontFamily: run.fontFamily,
      fontSize: run.fontSize,
      color: run.color,
      highlight: run.highlight,
      align: paragraph.align,
      lineHeight: paragraph.lineHeight,
      styleId: editor.activeStyleId(),
      list: editor.activeListKind(),
      link: editor.activeLink?.href,
      canUndo: editor.canUndo,
      canRedo: editor.canRedo,
      collapsed: editor.collapsed,
      inTable: editor.inTable,
      canEditTables: editor.canEditTables,
      canMergeCells: editor.canMergeCells,
      canSplitCell: editor.canSplitCell,
      pictureSelected: editor.pictureSelected,
      letterhead: editor.hasLetterhead,
      trackChanges: editor.trackChanges,
      revisionCount: editor.revisions.length,
      area: editor.area,
      page: editor.currentPage,
      pageCount: editor.pageCount,
      zoom: editor.zoom,
      view: editor.view,
      fit: editor.fit,
      fonts: fontFamilies(),
      touch: editor.byTouch,
      findCount: editor.findCount,
      findIndex: editor.findIndex,
      name,
      dirty: !session && editor.doc !== savedDoc,
      collab: collabState(),
      peers: session?.peers ?? [],
      me: { name: session?.name || editor.author, color: session?.color ?? '' },
    };
    const key = JSON.stringify(next);
    if (key !== shownKey || !shown) {
      shown = next;
      shownKey = key;
    }
    return shown;
  };

  const commands = {} as Record<string, unknown>;
  for (const command of COMMANDS) {
    commands[command] = (...args: unknown[]) => {
      const result = (editor[command] as (...given: unknown[]) => unknown)(...args);
      // The press of a button took the keyboard away from the document.
      editor.focus();
      return result;
    };
  }

  let lastDoc = editor.doc;
  const unsubscribe = editor.onChange(() => {
    if (editor.doc !== lastDoc) {
      lastDoc = editor.doc;
      options.onChange?.(editor);
    }
    emit();
  });

  return {
    editor,
    commands: commands as unknown as DocsCommands,
    state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get collab() {
      return session;
    },
    get assistant() {
      return assistant;
    },
    exportDocx: () => editor.exportDocx(),
    save,
    download() {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([editor.exportDocx() as BlobPart], { type: DOCX_TYPE }));
      link.download = `${(name || t('file.default')).replace(/\.docx$/i, '')}.docx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    },
    async openFile(given) {
      const file = given ?? (await pick());
      if (!file) return false;
      const data = await file.arrayBuffer();
      // Another file is not the document the others are on.
      if (session && !confirm(t('collab.leaveToOpen'))) return false;
      leave();
      if (!loadFile(data)) return false;
      if (file.name) name = file.name;
      savedDoc = editor.doc;
      emit();
      editor.focus();
      return true;
    },
    async share(server) {
      if (session || starting) return room();
      starting = true;
      emit();
      try {
        if (!(await pingServer(server.url))) fail(t('collab.noServer', { url: server.url }));
        else enterRoom(server.url, await createRoom(server.url, editor.exportDocx(), name, server.token));
      } catch (error) {
        fail(t('collab.failed', { error: (error as Error).message }));
      } finally {
        starting = false;
        emit();
      }
      return room();
    },
    leave,
    setLetterhead: applyLetterhead,
    connectAssistant(where = {}) {
      assistant ??= connectAssistant(editor, { ...where, name: () => name, onChange: emit });
      return assistant;
    },
    bubble,
    setKeys,
    setName(next) {
      name = next;
      assistant?.renamed();
      emit();
    },
    setAuthor(author) {
      setAuthor(editor, author);
      session?.rename(editor.author);
      emit();
    },
    focus: () => editor.focus(),
    destroy() {
      unsubscribe();
      listeners.clear();
      container.removeEventListener('keydown', onKey);
      // Let go of first: a room left from here is not one that is gone, and is not said to be.
      const left = session;
      session = undefined;
      left?.leave();
      assistant?.disconnect();
      bubble?.destroy();
      editor.onLinkKey = undefined;
      editor.destroy();
    },
  };
}
