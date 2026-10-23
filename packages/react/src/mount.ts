// The whole editor in one element of a page: the document with its toolbar,
// ruler, side panel and status bar, as an application that has other things
// to do would put it in one of its screens. Nothing here knows of React; the
// component of this package is this, mounted and taken away at the right times.
//
// What an application of its own may not want is off unless asked for:
// opening files of the disk, the assistant, sharing from here, the choice of
// language. What every document needs is on unless switched off.

import type { Session } from '@rebodocs/collab/browser';
import {
  type Editor,
  type PanelTab,
  type Texts,
  type Theme,
  type Versions,
  addLocale,
  applyTheme,
  createBubble,
  createFindBar,
  createFocusMode,
  createPanel,
  createResponsive,
  createRuler,
  createSidebar,
  createStatusBar,
  createToolbar,
  onLocaleChange,
  setLocale,
  speaks,
} from '@rebodocs/editor';
import { type DocsCoreOptions, type LetterheadSource, createDocs } from './docs';

export interface DocsFeatures {
  /**
   * The menu of the document: the file, exporting, and the page. On unless
   * false; a screen of its own over the editor ('screen', as it comes), or a
   * card that drops from its button ('card').
   */
  menu?: boolean | 'screen' | 'card';
  /**
   * The side panel: outline, variables, notes, changes, and the versions when
   * given. On unless false: on the right of the pages ('right', as it comes),
   * on their left ('left'), or with its tabs as a rail of icons always there ('rail').
   */
  panel?: boolean | 'right' | 'left' | 'rail';
  ruler?: boolean;
  /**
   * Pages, words, the view and the zoom. On unless false: as pills that float
   * over the pages ('floating', as it comes), in chips set apart ('chips'),
   * or in one bar ('bar').
   */
  statusBar?: boolean | 'floating' | 'chips' | 'bar';
  /**
   * How the toolbar sets out its tools: the document above and the formatting
   * under it ('two-rows', as it comes), tabs for the kinds of tools ('tabs'),
   * or one row ('row').
   */
  toolbar?: 'two-rows' | 'tabs' | 'row';
  /** Find and replace. On unless false. */
  find?: boolean;
  /** Focus mode: the pages alone, full screen, from the status bar or ⌘⇧. (Ctrl+Shift+.). On unless false. */
  focus?: boolean;
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
  /** The choice of light, dark or as the system is, in the menu. Off unless true; the `theme` option says the one to start with. */
  theme?: boolean;
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
  /**
   * The versions of the document, where the application keeps them: what
   * lists them, gives one back, and keeps a new one. With them, the side
   * panel has a tab to compare the document with one and to go back to it.
   */
  versions?: Versions;
  /** The language of the interface: 'es', 'en', or one given in `locales`. Left out, the first of the browser's languages the interface speaks, or English. */
  locale?: string;
  /**
   * Languages besides Spanish and English, or other words for those: the
   * texts of each by their key. What one leaves out is said in English.
   */
  locales?: Record<string, Texts>;
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
  /** What the document is called now: the name given, or the one of a file the person opened. */
  readonly name: string;
  /** Gives the document to `onSave`, as ⌘S does: what an application that saves on its own calls. */
  save(): Promise<void>;
  setName(name: string): void;
  setAuthor(author: string): void;
  setLocale(locale: string): void;
  /** The colours of the interface: 'light', 'dark', or 'auto' for the one the system is set to. */
  setTheme(theme: Theme): void;
  /** Gives the document a letterhead, or takes it away with `null`. */
  setLetterhead(letterhead: LetterheadSource | null): Promise<void>;
  /**
   * Opens the side panel on a tab, or on the one it was on: 'variables' for
   * whoever is to fill a template, 'changes' to review. 'history' only with
   * `versions`. False when the panel is turned off.
   */
  showPanel(tab?: PanelTab): boolean;
  hidePanel(): void;
  focus(): void;
  /** Takes everything away, and leaves the room. */
  destroy(): void;
}

const STYLE_ID = 'dx-app-style';
/*
 * The editor as islands on the canvas the pages lie on: the toolbar, the side
 * panel and the status bar each a card of its own, with room around them, and
 * the ruler and the pages on the canvas itself. On a narrow screen the room
 * shrinks, and the panel comes over the pages.
 */
const CSS = `
.dx-app{display:flex;flex-direction:column;gap:8px;height:100%;min-height:0;min-width:0;box-sizing:border-box;padding:8px;overflow:hidden;text-align:left;background:var(--dx-canvas,#efede8)}
.dx-app-toolbar .dx-tb,.dx-app-status .dx-sb:not(.dx-sb-chips):not(.dx-sb-floating),.dx-app-panel .dx-pn,.dx-app-panel .dx-pn-rail{border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:14px;background:var(--dx-ui-bar,#fbfaf8);box-shadow:0 1px 2px rgba(47,46,43,.05),0 10px 30px -18px rgba(47,46,43,.28)}
.dx-app-toolbar .dx-tb:not(.dx-tb-tabs):not(.dx-tb-two-rows){padding:6px 8px}
.dx-app{position:relative}
.dx-app-panel{display:flex;gap:8px;min-height:0}
.dx-app-panel .dx-pn{height:auto}
.dx-app-right .dx-app-panel{order:2}
.dx-app-status:has(.dx-sb-floating){position:absolute;left:20px;right:20px;bottom:18px;z-index:6;pointer-events:none}
.dx-app-right:has(.dx-pn-open) .dx-app-status:has(.dx-sb-floating){right:calc(min(340px,45vw) + 32px)}
.dx-app:not(.dx-app-right):has(.dx-pn-open) .dx-app-status:has(.dx-sb-floating){left:calc(min(340px,45vw) + 32px)}
.dx-narrow .dx-app-status:has(.dx-sb-floating){left:10px!important;right:10px!important;bottom:10px}
/* On a narrow screen the rail is a row above the pages, which keep the whole width; its panel comes over them. */
.dx-narrow .dx-app-main:has(.dx-pn-rail){flex-direction:column;gap:6px}
.dx-narrow .dx-app-panel .dx-pn-rail{flex-direction:row;align-self:flex-start;width:auto;height:auto;padding:3px}
.dx-narrow .dx-app-panel .dx-pn-rail .dx-pn-tab{width:38px;height:38px}
.dx-narrow .dx-app-panel .dx-pn-rail+.dx-pn{left:0;top:52px}
.dx-narrow.dx-app-right .dx-pn{left:auto;right:0}
.dx-app-ruler:empty{display:none}
.dx-app-ruler{margin:-4px 0 -8px}
.dx-app-ruler .dx-ruler{background:transparent;border-bottom:0}
.dx-app-main{position:relative;flex:1;min-height:0;display:flex;gap:8px}
.dx-app-panel:empty{display:none}
.dx-app-panel .dx-pn{max-width:min(340px,45vw)}
/* The element the pages scroll in: its corners rounded, and its scrolling the editor's own. */
.dx-app-doc{flex:1;min-width:0;border-radius:14px}
.dx-app-status .dx-sb{padding:0 6px}
.dx-app-status:empty{display:none}
.dx-narrow.dx-app{gap:6px;padding:6px}
.dx-narrow .dx-app-main{gap:0}
.dx-narrow .dx-app-panel .dx-pn{border-radius:14px}
`;

export function mountDocs(container: HTMLElement, options: DocsOptions = {}): DocsHandle {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const features = options.features ?? {};
  const on = (feature: boolean | string | undefined) => feature !== false;
  for (const [code, texts] of Object.entries(options.locales ?? {})) addLocale(code, texts);
  if (options.locale) setLocale(options.locale);

  const root = document.createElement('div');
  // What comes when nothing else is asked: the panel on the right, the status bar floating, two rows of tools, the menu a screen.
  const panelKind = features.panel === false ? undefined : typeof features.panel === 'string' ? features.panel : 'right';
  const statusLayout = typeof features.statusBar === 'string' ? features.statusBar : 'floating';
  const menuVariant = typeof features.menu === 'string' ? features.menu : 'screen';
  root.className = panelKind === 'right' ? 'dx-app dx-app-right' : 'dx-app';
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
  // The islands around the pages take the theme too, not the pages alone.
  applyTheme(root, options.theme ?? 'light');
  const setTheme = (theme: Theme) => {
    applyTheme(root, theme);
    docs.editor.theme = theme;
  };

  const docs = createDocs(docEl, options);
  const { editor } = docs;
  const share = features.share;
  const assistant = features.assistant ? docs.connectAssistant(features.assistant === true ? {} : features.assistant) : undefined;
  const openFile = features.files ? () => void docs.openFile() : undefined;
  // Outside the interface that is built again in another language: changing it does not take the person out.
  const focus = on(features.focus) ? createFocusMode(editor, { onChange: () => mounted?.status?.refresh() }) : undefined;

  // Its own keys besides the ones every document has: the ones of the files, when it has them.
  const onKey = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || !features.files) return;
    const key = e.key?.toLowerCase();
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
    panel?: ReturnType<typeof createPanel>;
    status?: ReturnType<typeof createStatusBar>;
    destroy(): void;
  }
  const mount = (): Mounted => {
    // The bars are in the language of the interface; the document, between them, in the person's.
    for (const node of [toolbarEl, rulerEl, panelEl, statusEl]) speaks(node);
    const name = () => docs.state().name;
    const sidebar = on(features.menu)
      ? createSidebar(editor, {
          fileName: name,
          variant: menuVariant,
          // Over the editor, not over the page it is on.
          within: root,
          dirty: options.onSave || features.files ? () => docs.state().dirty : undefined,
          onOpen: openFile,
          onSave: options.onSave ? () => void docs.save() : undefined,
          onSaveAs: features.files ? docs.download : undefined,
          onLocale: features.language ? setLocale : undefined,
          onTheme: features.theme ? (theme) => setTheme(theme) : undefined,
          onError: options.onError,
          // The letterhead the application gives is not the person's to change.
          letterhead: options.letterhead === undefined,
        })
      : undefined;
    const findBar = on(features.find) ? createFindBar(editor) : undefined;
    const panel = on(features.panel) ? createPanel(panelEl, editor, { versions: options.versions, onError: options.onError, rail: panelKind === 'rail' }) : undefined;
    const bubble = createBubble(editor);
    editor.onLinkKey = () => bubble.ask('link');
    const toolbar = createToolbar(toolbarEl, editor, {
      onMenu: sidebar?.toggle,
      // With a rail, the rail opens the panel: the toolbar needs no button for it.
      onPanel: panelKind === 'rail' ? undefined : panel?.toggle,
      layout: features.toolbar ?? 'two-rows',
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
          layout: statusLayout,
          focus: focus && { on: () => focus.on, toggle: focus.toggle },
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
    return { toolbar, status, panel, destroy: () => parts.forEach((one) => one?.destroy()) };
  };
  let mounted: Mounted | undefined = mount();
  // The language is the whole page's: chosen in this menu, in another editor's or from code, or a
  // text of it changed with addLocale, the interface is built again in it.
  const stopLocale = onLocaleChange(() => {
    mounted?.destroy();
    mounted = mount();
  });

  // A narrow window, as a phone's: the text set to its width, and the panel over the document.
  const responsive = on(features.responsive) ? createResponsive(root, editor) : undefined;

  // What is not the editor's to tell changes too: the name, and the people on the document.
  let saves = docs.state().saves;
  const unsubscribe = docs.subscribe(() => {
    mounted?.toolbar.refresh();
    mounted?.status?.refresh();
    // Saved, changed or not: the application may have kept a version of it.
    if (docs.state().saves !== saves) mounted?.panel?.refreshVersions();
    saves = docs.state().saves;
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
    get name() {
      return docs.state().name;
    },
    save: docs.save,
    setName: docs.setName,
    setAuthor: docs.setAuthor,
    setLocale,
    setTheme,
    setLetterhead: docs.setLetterhead,
    showPanel(tab) {
      if (!mounted?.panel) return false;
      mounted.panel.show(tab);
      return true;
    },
    hidePanel: () => mounted?.panel?.hide(),
    focus: docs.focus,
    destroy() {
      unsubscribe();
      stopLocale();
      responsive?.destroy();
      focus?.destroy();
      root.removeEventListener('keydown', onKey);
      mounted?.destroy();
      mounted = undefined;
      editor.onLinkKey = undefined;
      docs.destroy();
      root.remove();
    },
  };
}
