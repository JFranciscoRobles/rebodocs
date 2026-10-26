import { DEFAULT_COLLAB_PORT, type Session, createRoom, joinRoom, pingServer } from '@rebodocs/collab/browser';
import {
  type Panel,
  type VersionInfo,
  type Versions,
  Editor,
  addFont,
  addLocale,
  createBubble,
  createFindBar,
  createFocusMode,
  createPanel,
  createResponsive,
  createRuler,
  createSlashMenu,
  createVariableSuggest,
  createSidebar,
  createStatusBar,
  createToolbar,
  createSpellChecker,
  applyTheme,
  getLocale,
  recallAuthor,
  setAuthor,
  setLocale,
  t,
} from '@rebodocs/editor';
import zhHans from '@rebodocs/editor/locales/zh-Hans';
import zhHant from '@rebodocs/editor/locales/zh-Hant';
import { connectAssistant } from '@rebodocs/mcp/browser';
import { sampleDoc } from './sample';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// --- Language -------------------------------------------------------------------
// The one chosen the last time, or the one of the browser the first.

const LOCALE_KEY = 'docs.locale';
function storedLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_KEY);
  } catch {
    return null;
  }
}
// Chinese, Simplified and Traditional, besides the two the editor comes with.
addLocale('zh-Hans', zhHans);
addLocale('zh-Hant', zhHant);
setLocale(storedLocale() ?? navigator.language);
document.documentElement.lang = getLocale();

const editor = new Editor($('editor'), sampleDoc());
// The sample is written in Spanish: said so, for spelling, a screen reader and the DOCX it makes.
editor.language = 'es-MX';
// The table of contents of the sample comes without pages: they are those of its layout here. Loaded again, that is not a step to undo.
if (editor.updateToc()) editor.load(editor.doc);
const fileInput = $<HTMLInputElement>('file');

// --- Files ----------------------------------------------------------------------
// Where the browser lets a page write to a file of the disk (Chrome, Edge), saving
// goes back to the file that was opened. Elsewhere, saving downloads a copy.

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const picker = () => ({ types: [{ description: t('app.wordDocument'), accept: { [DOCX_TYPE]: ['.docx'] } }] });

interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}
const pickers = window as unknown as {
  showOpenFilePicker?: (options: object) => Promise<FileHandle[]>;
  showSaveFilePicker?: (options: object) => Promise<FileHandle>;
};

let fileName = 'documento.docx';
/** The document as it was last opened or saved: while the editor holds this very one, there is nothing to save. */
let savedDoc = editor.doc;
const dirty = () => editor.doc !== savedDoc;
const markSaved = () => {
  savedDoc = editor.doc;
  mounted.toolbar.refresh();
};
/** The file on disk the document is saved to, once it is known. */
let handle: FileHandle | undefined;

const docxBlob = () => new Blob([editor.exportDocx()], { type: DOCX_TYPE });
/** A picker closed without choosing is not an error. */
const cancelled = (error: unknown) => (error as Error).name === 'AbortError';

function setFile(name: string, from?: FileHandle): void {
  fileName = name;
  handle = from;
  document.title = `${name} · Docs`;
  markSaved();
  assistant.renamed();
}

// The versions of the document, kept in this page while it is open: an
// application keeps them where it keeps its documents. They are another
// file's once another file is opened.
const kept: { info: VersionInfo; docx: Uint8Array }[] = [];
const versions: Versions = {
  list: async () => kept.map((version) => version.info),
  load: async (id) => kept.find((version) => version.info.id === id)?.docx ?? Promise.reject(new Error('there is no such version')),
  save: async (docx, info) => void kept.push({ info: { id: String(kept.length + 1), date: new Date().toISOString(), ...info }, docx }),
};

async function load(file: File, from?: FileHandle): Promise<void> {
  // Another file is not the document the others are on.
  if (session && !confirm(t('collab.leaveToOpen'))) return;
  leaveRoom();
  try {
    editor.loadDocx(await file.arrayBuffer());
    kept.length = 0;
    setFile(file.name, from);
    editor.focus();
  } catch (error) {
    alert(t('app.openFailed', { error: (error as Error).message }));
  }
}

async function openFile(): Promise<void> {
  if (!pickers.showOpenFilePicker) {
    fileInput.click();
    return;
  }
  try {
    const [picked] = await pickers.showOpenFilePicker(picker());
    await load(await picked.getFile(), picked);
  } catch (error) {
    if (!cancelled(error)) alert(t('app.openFailed', { error: (error as Error).message }));
  }
}

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (file) void load(file);
});

function download(name: string, blob: Blob): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function write(to: FileHandle): Promise<void> {
  const writable = await to.createWritable();
  await writable.write(docxBlob());
  await writable.close();
}

async function saveAs(): Promise<void> {
  if (!pickers.showSaveFilePicker) {
    download(fileName, docxBlob());
    markSaved();
    return;
  }
  try {
    const picked = await pickers.showSaveFilePicker({ ...picker(), suggestedName: fileName });
    await write(picked);
    setFile(picked.name, picked);
  } catch (error) {
    if (!cancelled(error)) alert(t('app.saveFailed', { error: (error as Error).message }));
  }
}

async function save(): Promise<void> {
  if (!handle) return saveAs();
  try {
    await write(handle);
    markSaved();
  } catch (error) {
    if (!cancelled(error)) alert(t('app.saveFailed', { error: (error as Error).message }));
  }
}

// The usual keys, which would otherwise save or open a web page.
window.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
  const key = e.key?.toLowerCase();
  if (key !== 's' && key !== 'o' && key !== 'p') return;
  e.preventDefault();
  if (key === 'p') editor.print();
  else void (key === 's' ? save() : openFile());
});

// --- Interface ------------------------------------------------------------------
// Everything around the document is built by `mount`, and built again in
// another language when one is chosen: the document and its history stay.

interface Mounted {
  toolbar: ReturnType<typeof createToolbar>;
  status: ReturnType<typeof createStatusBar>;
  panel: Panel;
  destroy(): void;
}

function mount(): Mounted {
  const sidebar = createSidebar(editor, {
    fileName: () => fileName,
    onOpen: () => void openFile(),
    onSave: () => void save(),
    onSaveAs: () => void saveAs(),
    onLocale: changeLocale,
    // Light, dark or as the system is: on the islands and on the editor.
    onTheme: (theme) => {
      applyTheme($('app'), theme);
      editor.theme = theme;
    },
    // As DocsEditor comes: a screen of its own, over the editor and not the whole page.
    variant: 'screen',
    within: $('app'),
    dirty,
  });
  const findBar = createFindBar(editor);
  const panel = createPanel($('panel'), editor, { versions, onToggle: () => toolbar.refresh() });
  const bubble = createBubble(editor, { forms: true });
  editor.onLinkKey = () => bubble.ask('link');
  const slash = createSlashMenu(editor, { ask: bubble.ask, forms: true });
  const suggest = createVariableSuggest(editor);
  const toolbar = createToolbar($('toolbar'), editor, {
    layout: 'two-rows',
    onMenu: sidebar.toggle,
    onPanel: panel.toggle,
    panelOpen: () => panel.isOpen,
    onFind: () => findBar.open(),
    title: () => fileName,
    dirty,
    onInsertVariable: () => bubble.ask('variable'),
    onInsertNote: () => bubble.ask('note'),
    onInsertLink: () => bubble.ask('link'),
    forms: true,
  });
  const status = createStatusBar($('status'), editor, {
    layout: 'floating',
    focus: { on: () => focus.on, toggle: focus.toggle },
    assistant: { state: () => assistant.state, toggle: () => (assistant.state === 'off' ? assistant.connect() : assistant.disconnect()) },
    collab: {
      state: () => (session ? (session.state === 'closed' ? 'off' : session.state) : starting ? 'connecting' : 'off'),
      peers: () => session?.peers ?? [],
      color: () => session?.color ?? '',
      name: () => editor.author,
      rename: (name) => {
        setAuthor(editor, name);
        session?.rename(editor.author);
      },
      link: () => roomLink(),
      start: () => void shareDocument(),
      leave: leaveRoom,
    },
  });
  const parts = [sidebar, findBar, panel, toolbar, createRuler($('ruler'), editor), status, bubble, slash, suggest];
  return { toolbar, status, panel, destroy: () => parts.forEach((part) => part.destroy()) };
}

// The way in for an assistant: the MCP server of this machine, which the person lets in with the "AI" button
// of the bar at the bottom, and not before. `?mcp=` names another address for it, and `&token=` the word it asks
// of a page that is not on its own machine.
const query = new URLSearchParams(location.search);
const assistant = connectAssistant(editor, {
  url: query.get('mcp') ?? undefined,
  token: query.get('token') ?? undefined,
  name: () => fileName,
  onChange: () => mounted.status.refresh(),
});

// --- Working with other people ------------------------------------------------------
// A document is shared by giving it to a collaboration server, which makes a room for it; whoever opens the
// link of the room works on the same document. The server is the one that served this page when it is one,
// the one `?collab=` names, or else the one of this machine.

let session: Session | undefined;
let starting = false;
let collabUrl: string | undefined;

async function findServer(): Promise<string> {
  const named = query.get('collab');
  if (named) return named;
  if (await pingServer(location.origin)) return location.origin;
  return `${location.protocol}//${location.hostname}:${DEFAULT_COLLAB_PORT}`;
}

/** The address of the room: the one to give to someone else, or this person's own, with what lets them in. */
function roomLink(own = false): string | undefined {
  if (!session) return undefined;
  const link = new URL(location.origin + location.pathname);
  link.searchParams.set('room', session.room);
  if (collabUrl && collabUrl !== location.origin) link.searchParams.set('collab', collabUrl);
  // The ticket is this person's, from the system the document belongs to: the others get theirs there.
  if (own && query.get('ticket')) link.searchParams.set('ticket', query.get('ticket')!);
  return link.href;
}

function enterRoom(room: string, url: string): void {
  collabUrl = url;
  let titled = false;
  const joined = joinRoom(editor, room, {
    url,
    name: editor.author,
    ticket: query.get('ticket') ?? undefined,
    onChange: () => {
      if (session !== joined) return;
      if (joined.state === 'on' && !titled && joined.title) {
        titled = true;
        setFile(joined.title);
      }
      if (joined.state === 'closed') {
        // Not left from here: the room is not on the server.
        session = undefined;
        history.replaceState(null, '', location.pathname);
        alert(t('collab.gone'));
      }
      mounted.status.refresh();
      mounted.toolbar.refresh();
    },
  });
  session = joined;
  history.replaceState(null, '', roomLink(true));
}

async function shareDocument(): Promise<void> {
  if (session || starting) return;
  starting = true;
  mounted.status.refresh();
  try {
    const url = await findServer();
    const server = await pingServer(url);
    if (!server) {
      alert(t('collab.noServer', { url }));
      return;
    }
    const token = server.token ? (prompt(t('collab.askToken')) ?? undefined) : undefined;
    if (server.token && !token) return;
    enterRoom(await createRoom(url, editor.exportDocx(), fileName, token), url);
    mounted.status.showCollab();
  } catch (error) {
    alert(t('collab.failed', { error: (error as Error).message }));
  } finally {
    starting = false;
    mounted.status.refresh();
  }
}

function leaveRoom(): void {
  if (!session) return;
  const left = session;
  session = undefined;
  left.leave();
  history.replaceState(null, '', location.pathname);
  mounted.status.refresh();
}

// The pages alone, full screen: the button at the end of the bar at the bottom, or ⌘⇧. (Ctrl+Shift+.).
// Made once, outside `mount`: a change of language does not take the person out of it.
const focus = createFocusMode(editor, { onChange: () => mounted.status.refresh() });

recallAuthor(editor);
// Spelling, with Hunspell's dictionaries from a CDN; an application would serve them itself.
const dictionary = (language: string) => ({ aff: `https://cdn.jsdelivr.net/npm/dictionary-${language}@4.0.0/index.aff`, dic: `https://cdn.jsdelivr.net/npm/dictionary-${language}@4.0.0/index.dic` });
editor.spellChecker = createSpellChecker({ dictionaries: { es: dictionary('es'), en: dictionary('en') } });
// `?theme=dark` (or `auto`) for the dark interface, on the islands and on the editor.
const theme = query.get('theme');
if (theme === 'dark' || theme === 'auto') {
  applyTheme($('app'), theme);
  editor.theme = theme;
}
let mounted = mount();
// Open from the start where there is room for it beside the pages.
if (window.innerWidth >= 900) mounted.panel.show();
// A narrow window, as a phone's: the text set to its width, and the panel over the document.
createResponsive($('app'), editor);
if (query.get('room')) void findServer().then((url) => enterRoom(query.get('room')!, url));

function changeLocale(locale: string): void {
  setLocale(locale);
  document.documentElement.lang = getLocale();
  try {
    localStorage.setItem(LOCALE_KEY, getLocale());
  } catch {
    // Nowhere to keep it: it lasts until the page is closed.
  }
  // The panel stays as it was, open or not.
  const open = mounted.panel.isOpen;
  mounted.destroy();
  mounted = mount();
  if (open) mounted.panel.show();
  editor.focus();
}

editor.focus();

// Handle for poking at the engine from the browser console.
// At hand in the console, to try a font or a language out: `addFont({ family, src })`, `addLocale('fr', texts)`.
Object.assign(window, { editor, changeLocale, assistant, focus, collab: () => session, addFont, addLocale });
