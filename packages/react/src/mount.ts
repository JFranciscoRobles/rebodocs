// The whole editor in one element of a page: the document with its toolbar,
// ruler, side panel and status bar, as an application that has other things
// to do would put it in one of its screens. Nothing here knows of React; the
// component of this package is this, mounted and taken away at the right times.
//
// What an application of its own may not want is off unless asked for:
// opening files of the disk, the assistant, sharing from here, the choice of
// language. What every document needs is on unless switched off.

import type { Session } from '@rebodocs/collab/browser';
import { type Editor, type Messages, addLocale, createBubble, createFindBar, createPanel, createResponsive, createRuler, createSidebar, createStatusBar, createToolbar, getLocale, setLocale } from '@rebodocs/editor';
import { type DocsCoreOptions, type LetterheadSource, createDocs } from './docs';

export interface DocsFeatures {
  /** The menu of the document: exporting, and the page. On unless false. */
  menu?: boolean;
  /** The side panel: outline, variables and notes. On unless false. */
  panel?: boolean;
  ruler?: boolean;
  statusBar?: boolean;
  /** Find and replace. On unless false. */
  find?: boolean;
  /** The name of the document in the toolbar. On unless false. */
  title?: boolean;
  /**
   * Making do with a narrow window, as a phone's: the text set to its width
   * and not in pages, the panel over the document and not beside it, no
   * ruler, and room left for the keyboard of the screen. On unless false.
   */
  responsive?: boolean;
  /** Opening a file of the disk in place of the document, and saving a copy to it. Off unless true. */
  files?: boolean;
  /** The choice of language in the menu. Off unless true. */
  language?: boolean;
  /** The button that lets an AI assistant reach the document, through an MCP server: on this machine, or at `url`. Off unless given. */
  assistant?: boolean | { url?: string; token?: string };
  /**
   * The button that starts sharing the document with other people, on the
   * collaboration server at `url`; `link` says what address opens a room for
   * someone else. Off unless given. Not for a document that is already a room.
   */
  share?: { url: string; token?: string; link?: (room: string) => string };
}

export interface DocsOptions extends DocsCoreOptions {
  /** The language of the interface: 'es', 'en', or one given in `locales`. Spanish when left out. */
  locale?: string;
  /**
   * Languages besides Spanish and English, or other words for those: the
   * texts of each by their key. What one leaves out is said in English.
   */
  locales?: Record<string, Partial<Messages>>;
  features?: DocsFeatures;
}

export interface DocsHandle {
  readonly editor: Editor;
  /** The session with the others, while there is one. */
  readonly collab: Session | undefined;
  /** The document as a DOCX, as it is now. */
  exportDocx(): Uint8Array;
  /** Whether it changed since it was opened or last saved. */
  readonly dirty: boolean;
  setName(name: string): void;
  setAuthor(author: string): void;
  setLocale(locale: string): void;
  /** Gives the document a letterhead, or takes it away with `null`. */
  setLetterhead(letterhead: LetterheadSource | null): Promise<void>;
  focus(): void;
  /** Takes everything away, and leaves the room. */
  destroy(): void;
}

const STYLE_ID = 'dx-app-style';
const CSS = `
.dx-app{display:flex;flex-direction:column;height:100%;min-height:0;min-width:0;box-sizing:border-box;overflow:hidden;text-align:left}
.dx-app-main{position:relative;flex:1;min-height:0;display:flex}
.dx-app-doc{flex:1;min-width:0}
`;

export function mountDocs(container: HTMLElement, options: DocsOptions = {}): DocsHandle {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const features = options.features ?? {};
  const on = (feature: boolean | undefined) => feature !== false;
  for (const [code, texts] of Object.entries(options.locales ?? {})) addLocale(code, texts);
  if (options.locale) setLocale(options.locale);

  const root = document.createElement('div');
  root.className = 'dx-app';
  const part = (name: string, into: HTMLElement = root) => {
    const node = document.createElement('div');
    node.className = `dx-app-${name}`;
    into.appendChild(node);
    return node;
  };
  const toolbarEl = part('toolbar');
  const rulerEl = part('ruler');
  const main = part('main');
  const panelEl = part('panel', main);
  const docEl = part('doc', main);
  const statusEl = part('status');
  container.appendChild(root);

  const docs = createDocs(docEl, options);
  const { editor } = docs;
  const share = features.share;
  const assistant = features.assistant ? docs.connectAssistant(features.assistant === true ? {} : features.assistant) : undefined;
  const openFile = features.files ? () => void docs.openFile() : undefined;

  // Its own keys besides the ones every document has: the ones of the files, when it has them.
  const onKey = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || !features.files) return;
    const key = e.key.toLowerCase();
    if (key === 's' && !options.onSave) {
      e.preventDefault();
      docs.download();
    } else if (key === 'o') {
      e.preventDefault();
      void docs.openFile();
    }
  };
  root.addEventListener('keydown', onKey);

  // --- The interface --------------------------------------------------------------
  // Built again, in another language, when one is chosen: the document and its history stay.

  interface Mounted {
    toolbar: ReturnType<typeof createToolbar>;
    status?: ReturnType<typeof createStatusBar>;
    destroy(): void;
  }
  const changeLocale = (locale: string) => {
    setLocale(locale);
    mounted?.destroy();
    mounted = mount();
  };
  const mount = (): Mounted => {
    const name = () => docs.state().name;
    const sidebar = on(features.menu)
      ? createSidebar(editor, {
          fileName: name,
          onOpen: openFile,
          onSave: options.onSave ? () => void docs.save() : undefined,
          onSaveAs: features.files ? docs.download : undefined,
          onLocale: features.language ? changeLocale : undefined,
          // The letterhead the application gives is not the person's to change.
          letterhead: options.letterhead === undefined,
        })
      : undefined;
    const findBar = on(features.find) ? createFindBar(editor) : undefined;
    const panel = on(features.panel) ? createPanel(panelEl, editor) : undefined;
    const bubble = createBubble(editor);
    editor.onLinkKey = () => bubble.ask('link');
    const toolbar = createToolbar(toolbarEl, editor, {
      onMenu: sidebar?.toggle,
      onPanel: panel?.toggle,
      onFind: findBar ? () => findBar.open() : undefined,
      title: on(features.title) ? name : undefined,
      dirty: options.onSave || features.files ? () => docs.state().dirty : undefined,
      onInsertVariable: () => bubble.ask('variable'),
      onInsertNote: () => bubble.ask('note'),
      onInsertLink: () => bubble.ask('link'),
    });
    const ruler = on(features.ruler) ? createRuler(rulerEl, editor) : undefined;
    const status = on(features.statusBar)
      ? createStatusBar(statusEl, editor, {
          assistant: assistant && { state: () => assistant.state, toggle: () => (assistant.state === 'off' ? assistant.connect() : assistant.disconnect()) },
          collab:
            options.collab || share
              ? {
                  state: () => docs.state().collab as 'off' | 'connecting' | 'on' | 'offline',
                  peers: () => docs.state().peers,
                  color: () => docs.state().me.color,
                  name: () => docs.state().me.name,
                  // Where the application says who may come in, it also says what they are called.
                  rename: options.collab?.ticket ? undefined : (next) => docs.setAuthor(next),
                  // Only a room started here has an address of its own to give; the application has its own way in to the others.
                  ...(share
                    ? {
                        link: () => (docs.collab ? (share.link?.(docs.collab.room) ?? docs.collab.room) : undefined),
                        start: () => void docs.share(share).then((room) => room && mounted?.status?.showCollab()),
                        leave: docs.leave,
                      }
                    : {}),
                }
              : undefined,
        })
      : undefined;
    const parts = [sidebar, findBar, panel, toolbar, ruler, status, bubble];
    return { toolbar, status, destroy: () => parts.forEach((one) => one?.destroy()) };
  };
  let mounted: Mounted | undefined = mount();

  // A narrow window, as a phone's: the text set to its width, and the panel over the document.
  const responsive = on(features.responsive) ? createResponsive(root, editor) : undefined;

  // What is not the editor's to tell changes too: the name, and the people on the document.
  const unsubscribe = docs.subscribe(() => {
    mounted?.toolbar.refresh();
    mounted?.status?.refresh();
  });

  return {
    editor,
    get collab() {
      return docs.collab;
    },
    exportDocx: docs.exportDocx,
    get dirty() {
      return docs.state().dirty;
    },
    setName: docs.setName,
    setAuthor: docs.setAuthor,
    setLocale(locale) {
      if (locale !== getLocale()) changeLocale(locale);
    },
    setLetterhead: docs.setLetterhead,
    focus: docs.focus,
    destroy() {
      unsubscribe();
      responsive?.destroy();
      root.removeEventListener('keydown', onKey);
      mounted?.destroy();
      mounted = undefined;
      editor.onLinkKey = undefined;
      docs.destroy();
      root.remove();
    },
  };
}
