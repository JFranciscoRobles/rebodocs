// Rebodocs on the desktop: each window is one document, a .docx file of the
// disk. The pages are those of the editor; Tauri adds the native menu, the
// dialogs to open and save, and the documents the system asks to open.

import { createDoc, imageExtension } from '@rebodocs/core';
import {
  Editor,
  IS_MAC,
  MAX_ZOOM,
  MIN_ZOOM,
  createBubble,
  createFindBar,
  createPanel,
  createResponsive,
  createRuler,
  createSidebar,
  createStatusBar,
  createToolbar,
  getLocale,
  recallAuthor,
  setLocale,
  t,
} from '@rebodocs/editor';
import { invoke } from '@tauri-apps/api/core';
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { ask, message, open, save } from '@tauri-apps/plugin-dialog';
import { text } from './texts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const win = getCurrentWebviewWindow();

// The editor prints with `window.print()`, which the web view of a Mac leaves unanswered: Tauri's opens the dialog.
// What the editor laid out for printing stays, hidden, until the next time: the dialog may be open a while.
window.print = () => void invoke('print').catch((error) => failed('app.saveFailed', error));

// --- Language -------------------------------------------------------------------

const LOCALE_KEY = 'docs.locale';
function storedLocale(): string | null {
  try {
    return localStorage.getItem(LOCALE_KEY);
  } catch {
    return null;
  }
}
setLocale(storedLocale() ?? navigator.language);
document.documentElement.lang = getLocale();

const editor = new Editor($('editor'), createDoc());
recallAuthor(editor);

// --- The file -------------------------------------------------------------------

/** Where the document is on the disk, once it is somewhere. */
let path: string | undefined;
/** The document as it was last opened or saved: while the editor holds this very one, there is nothing to save. */
let savedDoc = editor.doc;

const dirty = () => editor.doc !== savedDoc;
const baseName = (file: string) => file.split(/[\\/]/).pop() ?? file;
/** The name shown: the file's, or that of a document never saved. */
const title = () => (path ? baseName(path) : text('untitled'));
/** The name of the file, for saving and for the files exported from it. */
const fileName = () => (path ? baseName(path) : `${text('untitled')}.docx`);
/** A window with nothing in it yet, where a document opened goes instead of in a window of its own. */
const pristine = () => !path && !dirty();

const docxFilter = () => [{ name: t('app.wordDocument'), extensions: ['docx'] }];

let shownTitle = '';
function showTitle(): void {
  const next = `${title()}${dirty() ? (IS_MAC ? ' — ' : ' • ') + (getLocale() === 'es' ? 'editado' : 'edited') : ''}`;
  if (next === shownTitle) return;
  shownTitle = next;
  document.title = next;
  void win.setTitle(next);
}

function markSaved(): void {
  savedDoc = editor.doc;
  showTitle();
  mounted.toolbar.refresh();
}

async function failed(key: 'app.openFailed' | 'app.saveFailed', error: unknown): Promise<void> {
  await message(t(key, { error: error instanceof Error ? error.message : String(error) }), { title: 'Rebodocs', kind: 'error' });
}

async function readFile(file: string): Promise<Uint8Array> {
  return new Uint8Array(await invoke<ArrayBuffer>('read_document', { path: file }));
}

/** Writes `bytes` to `file`: they go as they are, not as text, with where to in a header. */
async function writeFile(file: string, bytes: Uint8Array): Promise<void> {
  await invoke('write_document', bytes, { headers: { path: encodeURIComponent(file) } });
}

async function load(file: string): Promise<void> {
  try {
    editor.loadDocx(await readFile(file));
    path = file;
    markSaved();
    editor.focus();
  } catch (error) {
    await failed('app.openFailed', error);
  }
}

/** Opens documents: the first here when this window has nothing yet, the others each in a window of its own. */
async function openPaths(paths: string[]): Promise<void> {
  for (const file of paths) {
    if (file === path) continue;
    if (pristine()) await load(file);
    else await invoke('new_window', { path: file });
  }
}

async function openDialog(): Promise<void> {
  const picked = await open({ multiple: true, directory: false, filters: docxFilter() });
  if (picked?.length) await openPaths(picked);
}

async function saveTo(file: string): Promise<boolean> {
  try {
    await writeFile(file, editor.exportDocx());
    path = file;
    markSaved();
    return true;
  } catch (error) {
    await failed('app.saveFailed', error);
    return false;
  }
}

async function saveAs(): Promise<boolean> {
  const picked = await save({ defaultPath: fileName(), filters: docxFilter() });
  if (!picked) return false;
  return saveTo(/\.docx$/i.test(picked) ? picked : `${picked}.docx`);
}

async function saveDocument(): Promise<boolean> {
  return path ? saveTo(path) : saveAs();
}

/** A file made from the document (a PDF, a copy in Markdown...), saved where the person says. */
async function exportFile(file: { name: string; blob: Blob }): Promise<void> {
  const extension = file.name.split('.').pop() ?? '';
  const picked = await save({ defaultPath: file.name, filters: [{ name: extension.toUpperCase(), extensions: [extension] }] });
  if (!picked) return;
  try {
    await writeFile(picked, new Uint8Array(await file.blob.arrayBuffer()));
  } catch (error) {
    await failed('app.saveFailed', error);
  }
}

async function exportPdf(): Promise<void> {
  const pdf = await editor.exportPdf(title().replace(/\.docx$/i, ''));
  await exportFile({ name: fileName().replace(/\.docx$/i, '.pdf'), blob: new Blob([pdf as BlobPart], { type: 'application/pdf' }) });
}

// Closing a window with changes asks first, also when the whole application is quit.
void win.onCloseRequested(async (event) => {
  if (!dirty()) return;
  const close = await ask(text('unsaved', { name: title() }), {
    title: 'Rebodocs',
    kind: 'warning',
    okLabel: text('closeAnyway'),
    cancelLabel: text('cancel'),
  });
  if (!close) event.preventDefault();
});

// The documents the system asks to open: the one this window was made for, and those that come while it is in front.
const takeOpened = async () => openPaths(await invoke<string[]>('take_opened'));
void win.listen('documents-opened', () => void takeOpened());

// What is dropped on the window: documents are opened, pictures go in where the caret is.
void getCurrentWebview().onDragDropEvent(async (event) => {
  if (event.payload.type !== 'drop') return;
  const documents = event.payload.paths.filter((file) => /\.docx$/i.test(file));
  if (documents.length) await openPaths(documents);
  for (const file of event.payload.paths) {
    const type = `image/${(file.split('.').pop() ?? '').toLowerCase().replace('jpg', 'jpeg')}`;
    if (!imageExtension(type)) continue;
    try {
      await editor.insertImageFile(new Blob([(await readFile(file)) as BlobPart], { type }));
    } catch (error) {
      await failed('app.openFailed', error);
    }
  }
});

// --- Editing commands of the menu ---------------------------------------------------
// A field of the interface (the search, a dialog) has the keys while it has the
// focus: the menu then works on it, as the menu of any application would.

function focusedField(): HTMLInputElement | HTMLTextAreaElement | undefined {
  const el = document.activeElement;
  if (el instanceof HTMLInputElement || (el instanceof HTMLTextAreaElement && !$('editor').contains(el))) return el;
  return undefined;
}

function undo(redo: boolean): void {
  if (focusedField()) document.execCommand(redo ? 'redo' : 'undo');
  else if (redo) editor.redo();
  else editor.undo();
}

function selectAll(): void {
  const field = focusedField();
  if (field) field.select();
  else editor.selectAll();
}

async function pastePlain(): Promise<void> {
  const pasted = await readText().catch(() => '');
  if (!pasted) return;
  if (focusedField()) document.execCommand('insertText', false, pasted);
  else editor.insertText(pasted);
}

function zoomBy(step: number): void {
  const next = Math.round((editor.zoom + step) * 10) / 10;
  editor.setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)));
}

// --- Native menu --------------------------------------------------------------------
// On a Mac there is one menu bar for the application: the window in front puts
// its own there, so that the commands work on its document. On Windows and
// Linux each window has its menu.

async function buildMenu(): Promise<Menu> {
  const item = (id: string, label: string, action: () => unknown, accelerator?: string) =>
    MenuItem.new({ id, text: label, accelerator, action: () => void action() });
  const separator = () => PredefinedMenuItem.new({ item: 'Separator' });

  const app = IS_MAC
    ? [
        await Submenu.new({
          text: 'Rebodocs',
          items: [
            await PredefinedMenuItem.new({ item: { About: { name: 'Rebodocs', version: '0.8.0' } }, text: text('about') }),
            await separator(),
            await PredefinedMenuItem.new({ item: 'Hide', text: text('hide') }),
            await PredefinedMenuItem.new({ item: 'HideOthers', text: text('hideOthers') }),
            await PredefinedMenuItem.new({ item: 'ShowAll', text: text('showAll') }),
            await separator(),
            await item('quit', text('quit'), () => invoke('quit'), 'CmdOrCtrl+Q'),
          ],
        }),
      ]
    : [];

  const file = await Submenu.new({
    text: text('file'),
    items: [
      await item('new', text('newDocument'), () => invoke('new_window', { path: null }), 'CmdOrCtrl+N'),
      await item('open', t('menu.open'), openDialog, 'CmdOrCtrl+O'),
      await separator(),
      await item('save', t('menu.save'), saveDocument, 'CmdOrCtrl+S'),
      await item('saveAs', t('menu.saveAs'), saveAs, 'CmdOrCtrl+Shift+S'),
      await item('exportPdf', text('exportPdf'), exportPdf),
      await separator(),
      await item('print', t('menu.print'), () => editor.print(), 'CmdOrCtrl+P'),
      await separator(),
      await item('close', text('closeWindow'), () => win.close(), 'CmdOrCtrl+W'),
      ...(IS_MAC ? [] : [await item('quit', text('quit'), () => invoke('quit'), 'CmdOrCtrl+Q')]),
    ],
  });

  // Cut, copy and paste are the system's on a Mac, which hands them to the page as the keys would.
  // Elsewhere the keys do it, and the menu does not offer what it could not do.
  const clipboard = IS_MAC
    ? [
        await PredefinedMenuItem.new({ item: 'Cut', text: t('bubble.cut') }),
        await PredefinedMenuItem.new({ item: 'Copy', text: t('bubble.copy') }),
        await PredefinedMenuItem.new({ item: 'Paste', text: t('bubble.paste') }),
      ]
    : [];
  const edit = await Submenu.new({
    text: text('edit'),
    items: [
      await item('undo', text('undo'), () => undo(false), 'CmdOrCtrl+Z'),
      await item('redo', text('redo'), () => undo(true), 'CmdOrCtrl+Shift+Z'),
      await separator(),
      ...clipboard,
      await item('pastePlain', t('bubble.pastePlain'), pastePlain, 'CmdOrCtrl+Shift+V'),
      await item('selectAll', t('bubble.selectAll'), selectAll, 'CmdOrCtrl+A'),
      await separator(),
      await item('find', text('find'), () => mounted.findBar.open(), 'CmdOrCtrl+F'),
      await item('replace', text('replace'), () => mounted.findBar.open(true), IS_MAC ? 'Cmd+Alt+F' : 'Ctrl+H'),
    ],
  });

  const view = await Submenu.new({
    text: text('view'),
    items: [
      await item('zoomIn', text('zoomIn'), () => zoomBy(0.1), 'CmdOrCtrl+='),
      await item('zoomOut', text('zoomOut'), () => zoomBy(-0.1), 'CmdOrCtrl+-'),
      await item('actualSize', text('actualSize'), () => editor.setZoom(1), 'CmdOrCtrl+0'),
      await separator(),
      await item('fitWidth', text('fitWidth'), () => editor.setFit('width')),
      await item('fitPage', text('fitPage'), () => editor.setFit('page')),
      ...(IS_MAC ? [await separator(), await PredefinedMenuItem.new({ item: 'Fullscreen', text: text('fullscreen') })] : []),
    ],
  });

  const window = IS_MAC
    ? [
        await Submenu.new({
          text: text('window'),
          items: [
            await PredefinedMenuItem.new({ item: 'Minimize', text: text('minimize') }),
            await PredefinedMenuItem.new({ item: 'Maximize', text: text('maximize') }),
          ],
        }),
      ]
    : [];

  return Menu.new({ items: [...app, file, edit, view, ...window] });
}

let menu: Menu | undefined;
async function installMenu(): Promise<void> {
  menu = await buildMenu();
  if (!IS_MAC) await menu.setAsWindowMenu(win);
  else if (await win.isFocused()) await menu.setAsAppMenu();
}
void win.onFocusChanged(({ payload: focused }) => {
  if (focused && IS_MAC) void menu?.setAsAppMenu();
});

// --- Interface ------------------------------------------------------------------
// Built again in another language when one is chosen: the document and its history stay.

interface Mounted {
  toolbar: ReturnType<typeof createToolbar>;
  findBar: ReturnType<typeof createFindBar>;
  destroy(): void;
}

function mount(): Mounted {
  const sidebar = createSidebar(editor, {
    fileName,
    onOpen: () => void openDialog(),
    onSave: () => void saveDocument(),
    onSaveAs: () => void saveAs(),
    onExport: (file) => void exportFile(file),
    onLocale: changeLocale,
  });
  const findBar = createFindBar(editor);
  const panel = createPanel($('panel'), editor);
  const bubble = createBubble(editor);
  editor.onLinkKey = () => bubble.ask('link');
  const toolbar = createToolbar($('toolbar'), editor, {
    onMenu: sidebar.toggle,
    onPanel: panel.toggle,
    onFind: () => findBar.open(),
    title,
    dirty,
    onInsertVariable: () => bubble.ask('variable'),
    onInsertNote: () => bubble.ask('note'),
    onInsertLink: () => bubble.ask('link'),
  });
  const status = createStatusBar($('status'), editor);
  const parts = [sidebar, findBar, panel, toolbar, createRuler($('ruler'), editor), status, bubble];
  return { toolbar, findBar, destroy: () => parts.forEach((part) => part.destroy()) };
}

function changeLocale(locale: string): void {
  setLocale(locale);
  document.documentElement.lang = getLocale();
  try {
    localStorage.setItem(LOCALE_KEY, getLocale());
  } catch {
    // Nowhere to keep it: it lasts until the window is closed.
  }
  mounted.destroy();
  mounted = mount();
  shownTitle = '';
  showTitle();
  void installMenu();
  editor.focus();
}

let mounted = mount();
createResponsive(document.body, editor);
editor.onChange(showTitle);
showTitle();
void installMenu();
void takeOpened();
editor.focus();
