// The menu of the document: a panel that slides in from the left with what is
// done to the document as a whole. Opening and saving belong to the
// application, which says what they do; exporting is done here, and so is
// the setup of the page, in a dialog of its own that the menu opens, through
// the public methods of the editor.

import { type PageSetup, imageExtension } from '@rebodocs/core';
import { arrowsThrough, holdFocus, tabbables } from './a11y';
import type { Editor } from './editor';
import { type MessageKey, getLocale, locales, t } from './i18n';
import { IS_MAC } from './platform';

export interface SidebarOptions {
  /** The name of the document, shown at the top and given to the files it is exported to. */
  fileName?: () => string;
  /** Each one shows its entry when given. */
  onOpen?: () => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  /** What to do with an exported file; by default the browser downloads it. */
  onExport?: (file: { name: string; blob: Blob }) => void;
  /** False leaves out the entries of the letterhead: where it is the application's to say, not the person's. */
  letterhead?: boolean;
  /** Shows the choice of language when given, and is told the one chosen: the menu only asks. */
  onLocale?: (locale: string) => void;
}

export interface Sidebar {
  open(): void;
  close(): void;
  toggle(): void;
  /** Shows the dialog with the size, the orientation and the margins of the page. */
  openPageSetup(): void;
  destroy(): void;
}

const PT_PER_CM = 72 / 2.54;
/** Paper sizes, in points, as held upright. */
const PAPERS: [MessageKey, number, number][] = [
  ['paper.letter', 612, 792],
  ['paper.a4', 595.3, 841.9],
  ['paper.legal', 612, 1008],
];
/** Margin presets, in points: top and bottom, then left and right. */
const MARGINS: [MessageKey, number, number][] = [
  ['margins.normal', 72, 72],
  ['margins.narrow', 36, 36],
  ['margins.moderate', 72, 54],
  ['margins.wide', 72, 144],
];
const CUSTOM = 'custom';
/** The least room, in points, the margins must leave for the text. */
const MIN_TEXT = 72;
const near = (a: number, b: number) => Math.abs(a - b) < 0.6;
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MOD = IS_MAC ? '⌘' : 'Ctrl+';
const STYLE_ID = 'dx-sidebar-style';

const CSS = `
.dx-side-scrim{position:fixed;inset:0;z-index:40;background:rgba(20,24,32,.32);opacity:0;visibility:hidden;transition:opacity .18s,visibility .18s}
.dx-side{position:fixed;left:0;top:0;bottom:0;z-index:41;display:flex;flex-direction:column;width:300px;max-width:88vw;background:#fff;box-shadow:4px 0 24px rgba(0,0,0,.18);font:13px system-ui,-apple-system,"Segoe UI",sans-serif;color:#2b2f38;transform:translateX(-105%);visibility:hidden;transition:transform .18s,visibility .18s}
.dx-side-open.dx-side-scrim{opacity:1;visibility:visible}
.dx-side-open.dx-side{transform:none;visibility:visible;transition:transform .18s}
.dx-side-top{display:flex;align-items:center;gap:8px;padding:12px 12px 12px 16px;border-bottom:1px solid #e3e6ec}
.dx-side-name{flex:1;min-width:0;overflow:hidden;font-weight:600;font-size:14px;text-overflow:ellipsis;white-space:nowrap}
.dx-side-body{flex:1;overflow-y:auto;padding:6px 8px 16px}
.dx-side-head{padding:14px 8px 4px;color:#5f6470;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
@media (pointer:coarse){.dx-side-item{height:44px}.dx-side-x{width:40px;height:40px}}
.dx-side-item[hidden]{display:none}
.dx-side-item{display:flex;align-items:center;gap:10px;width:100%;height:34px;padding:0 8px;border:0;border-radius:6px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.dx-side-item:hover{background:#eef1f6}
.dx-side-item svg{flex:none;color:#5f6470}
.dx-side-item kbd{margin-left:auto;color:#5f6470;font:inherit}
.dx-side-item small{margin-left:auto;color:#5f6470;font-size:12px}
.dx-side-x{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:6px;background:none;color:#5f6470;cursor:pointer}
.dx-side-x:hover{background:#eef1f6}
.dx-side-item:focus-visible,.dx-side-x:focus-visible,.dx-side-field select:focus-visible,.dx-side-field input:focus-visible,.dx-side-seg button:focus-visible{outline:2px solid #0b57d0;outline-offset:-2px}
.dx-side-field{display:flex;align-items:center;gap:8px;padding:4px 8px}
.dx-side-field>span{flex:none;width:76px;color:#4a4f5a}
.dx-side-field select,.dx-side-field input{flex:1;min-width:0;height:30px;padding:0 6px;border:1px solid #d2d6de;border-radius:6px;background:#fff;color:inherit;font:inherit}
.dx-side-field input{text-align:right;font-variant-numeric:tabular-nums}
.dx-side-field em{flex:none;color:#5f6470;font-style:normal}
.dx-side-seg{display:flex;flex:1;gap:4px}
.dx-side-seg button{flex:1;height:30px;border:1px solid #d2d6de;border-radius:6px;background:#fff;color:inherit;font:inherit;cursor:pointer}
.dx-side-seg button.dx-on{border-color:#a8c7fa;background:#d3e3fd;color:#0b57d0}
.dx-side-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.dx-side-pair .dx-side-field{flex-wrap:wrap;row-gap:2px}
.dx-side-pair .dx-side-field>span{width:100%;font-size:12px}
.dx-side-note{padding:6px 8px 0;color:#5f6470;font-size:12px;line-height:1.4}
.dx-page-scrim{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(20,24,32,.32)}
.dx-page-scrim.dx-side-open{display:flex}
.dx-page-dlg{display:flex;flex-direction:column;width:420px;max-width:100%;max-height:100%;border-radius:12px;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.28);font:13px system-ui,-apple-system,"Segoe UI",sans-serif;color:#2b2f38}
.dx-page-dlg .dx-side-body{padding:10px 12px 4px}
.dx-page-foot{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px 16px}
.dx-page-foot button{height:32px;padding:0 16px;border:1px solid #d2d6de;border-radius:6px;background:#fff;color:inherit;font:inherit;cursor:pointer}
.dx-page-foot button:hover{background:#eef1f6}
.dx-page-foot button.dx-main{border-color:#0b57d0;background:#0b57d0;color:#fff}
.dx-page-foot button.dx-main:hover{background:#0a4dba}
.dx-page-foot button:focus-visible{outline:2px solid #0b57d0;outline-offset:2px}
`;

const svg = (body: string) =>
  `<svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const SHEET = '<path d="M4.5 2.5h6L14 6v9.5H4.5z"/><path d="M10.5 2.5V6H14"/>';
const ICONS = {
  open: svg('<path d="M2.5 5.5a1 1 0 0 1 1-1h3l1.5 1.5h6.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z"/>'),
  save: svg('<path d="M3.5 2.5h9l2 2v11h-11z"/><path d="M6 2.5v4h5.5v-4M6 15.5v-5h6v5"/>'),
  saveAs: svg('<path d="M3.5 2.5h9l2 2v5M3.5 2.5v13H8"/><path d="M6 2.5v4h5.5v-4M10.5 15.5l.6-2.4 4-4 1.8 1.8-4 4z"/>'),
  docx: svg(`${SHEET}<path d="m6.6 9 1 4 1.4-3 1.4 3 1-4"/>`),
  pdf: svg(`${SHEET}<path d="M7 13V9h1.2a1.2 1.2 0 0 1 0 2.4H7M11 9v4"/>`),
  markdown: svg(`${SHEET}<path d="M6.5 13V9.5L8 11.2l1.5-1.7V13M11.8 9.5v3.3M10.7 11.8l1.1 1.2 1.1-1.2"/>`),
  page: svg('<rect x="3.5" y="2.5" width="11" height="13" rx="1"/><path d="M6 2.5v13M3.5 5.5h11" stroke-dasharray="1.5 1.5"/>'),
  letterhead: svg('<rect x="3.5" y="2.5" width="11" height="13" rx="1"/><path d="M5.5 5h3M5.5 13.5h7"/><circle cx="11.5" cy="5.2" r=".9" fill="currentColor" stroke="none"/>'),
  fitLetterhead: svg('<rect x="3.5" y="2.5" width="11" height="13" rx="1"/><path d="M5.5 6h7M5.5 12h7M9 7.5v3M7.8 8.6 9 7.5l1.2 1.1M7.8 9.4 9 10.5l1.2-1.1"/>'),
  saveLetterhead: svg('<rect x="3.5" y="2.5" width="11" height="13" rx="1"/><path d="M9 5.5v6M6.8 9.3 9 11.5l2.2-2.2M6 13.5h6"/>'),
  noLetterhead: svg('<rect x="3.5" y="2.5" width="11" height="13" rx="1"/><path d="m6.5 6.5 5 5M11.5 6.5l-5 5"/>'),
  print: svg('<path d="M5 6.5v-4h8v4M5 12.5H3.5v-5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v5H13"/><path d="M5 10.5h8v5H5z"/>'),
  close: svg('<path d="m4.5 4.5 9 9M13.5 4.5l-9 9"/>'),
};

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, html = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.innerHTML = html;
  return node;
}

function download({ name, blob }: { name: string; blob: Blob }): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function createSidebar(editor: Editor, options: SidebarOptions = {}): Sidebar {
  injectStyle();
  const scrim = el('div', 'dx-side-scrim');
  const side = el('aside', 'dx-side');
  side.setAttribute('role', 'dialog');
  side.setAttribute('aria-label', t('menu.title'));
  side.setAttribute('aria-modal', 'true');
  const top = el('div', 'dx-side-top');
  const name = el('div', 'dx-side-name');
  const x = el('button', 'dx-side-x', ICONS.close);
  x.type = 'button';
  x.title = t('menu.close');
  x.setAttribute('aria-label', t('menu.close'));
  top.append(name, x);
  const body = el('div', 'dx-side-body');
  side.append(top, body);
  /** What to do, on every change of the document, to keep a control in step. */
  const updates: (() => void)[] = [];
  let isOpen = false;

  const baseName = () => (options.fileName?.() || t('file.default')).replace(/\.(docx|md|pdf)$/i, '');
  const give = options.onExport ?? download;

  /** Says in the menu whether there is a letterhead to change or to take away, each time it opens. */
  let letterheadItems = () => {};
  /** Gives the keyboard back to what had it when the menu opened, and lets Tab out again. */
  let release: ((restore?: boolean) => void) | undefined;
  const close = (restore = true) => {
    if (!isOpen) return;
    isOpen = false;
    scrim.classList.remove('dx-side-open');
    side.classList.remove('dx-side-open');
    release?.(restore);
    release = undefined;
  };
  const open = () => {
    if (isOpen) return;
    isOpen = true;
    refresh();
    letterheadItems();
    scrim.classList.add('dx-side-open');
    side.classList.add('dx-side-open');
    release = holdFocus(side, () => editor.focus());
    // The first thing to do, not the button that closes: Escape does that.
    (body.querySelector<HTMLElement>('.dx-side-item:not([hidden])') ?? x).focus();
  };
  // Up and down the entries, as in a menu.
  arrowsThrough(side, () => tabbables(body).filter((node) => node.classList.contains('dx-side-item')));

  const head = (label: string) => {
    const node = el('div', 'dx-side-head');
    node.textContent = label;
    body.appendChild(node);
  };
  /** An entry that does something and closes the menu. */
  const item = (id: string, icon: string, label: string, action: () => void, hint = '') => {
    const node = el('button', 'dx-side-item', icon);
    node.type = 'button';
    node.dataset.name = id;
    node.append(label);
    if (hint) node.appendChild(el(hint.length <= 3 ? 'kbd' : 'small', '', hint));
    node.addEventListener('click', () => {
      close();
      action();
    });
    body.appendChild(node);
    return node;
  };
  const field = (label: string, ...controls: HTMLElement[]) => {
    const node = el('label', 'dx-side-field');
    const text = el('span', '');
    text.textContent = label;
    node.append(text, ...controls);
    return node;
  };

  // --- File ---------------------------------------------------------------------

  if (options.onOpen || options.onSave || options.onSaveAs) head(t('menu.file'));
  if (options.onOpen) item('open', ICONS.open, t('menu.open'), options.onOpen, `${MOD}O`);
  if (options.onSave) item('save', ICONS.save, t('menu.save'), options.onSave, `${MOD}S`);
  if (options.onSaveAs) item('save-as', ICONS.saveAs, t('menu.saveAs'), options.onSaveAs);

  // --- Export -------------------------------------------------------------------

  head(t('menu.export'));
  item('export-docx', ICONS.docx, 'Word', () => give({ name: `${baseName()}.docx`, blob: new Blob([editor.exportDocx() as BlobPart], { type: DOCX_TYPE }) }), '.docx');
  item('export-pdf', ICONS.pdf, 'PDF', () => {
    void editor.exportPdf(baseName()).then((bytes) => give({ name: `${baseName()}.pdf`, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) }));
  }, '.pdf');
  item('export-md', ICONS.markdown, 'Markdown', () => give({ name: `${baseName()}.md`, blob: new Blob([editor.exportMarkdown()], { type: 'text/markdown;charset=utf-8' }) }), '.md');

  // The print dialog of the browser, which also saves as PDF, with the fonts of this machine.
  item('print', ICONS.print, t('menu.print'), () => editor.print(), `${MOD}P`);

  // --- Page setup ---------------------------------------------------------------

  // A dialog of its own, over the document, which shows each change behind it as it is made.
  const pageScrim = el('div', 'dx-page-scrim');
  const dialog = el('div', 'dx-page-dlg');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', t('pageSetup.title'));
  const dialogTop = el('div', 'dx-side-top');
  const dialogName = el('div', 'dx-side-name');
  dialogName.textContent = t('pageSetup.title');
  const dialogX = el('button', 'dx-side-x', ICONS.close);
  dialogX.type = 'button';
  dialogX.title = t('cancel');
  dialogX.setAttribute('aria-label', t('cancel'));
  dialogTop.append(dialogName, dialogX);
  const form = el('div', 'dx-side-body');
  const dialogFoot = el('div', 'dx-page-foot');
  const cancel = el('button', '');
  cancel.type = 'button';
  cancel.textContent = t('cancel');
  cancel.dataset.name = 'page-cancel';
  const accept = el('button', 'dx-main');
  accept.type = 'button';
  accept.textContent = t('accept');
  accept.dataset.name = 'page-accept';
  dialogFoot.append(cancel, accept);
  dialog.append(dialogTop, form, dialogFoot);
  pageScrim.appendChild(dialog);
  /** The page of each section as it was when the dialog was opened, to go back to on cancelling. */
  let pageBefore: PageSetup[] | undefined;
  /** Whether what is set goes to every section, and not only to the one being edited. */
  let everywhere = false;
  const setPage = (patch: Partial<PageSetup>) => editor.setPage(patch, everywhere);
  let releaseDialog: ((restore?: boolean) => void) | undefined;
  const openPageSetup = () => {
    if (pageBefore) return;
    close();
    pageBefore = editor.sectionPages();
    everywhere = false;
    refresh();
    pageScrim.classList.add('dx-side-open');
    releaseDialog = holdFocus(dialog, () => editor.focus());
    tabbables(form)[0]?.focus();
  };
  const closePageSetup = (keep: boolean) => {
    if (!pageBefore) return;
    // A field being typed in is taken before closing.
    (document.activeElement as HTMLElement | null)?.blur();
    if (!keep) editor.setSectionPages(pageBefore);
    pageBefore = undefined;
    pageScrim.classList.remove('dx-side-open');
    releaseDialog?.();
    releaseDialog = undefined;
  };
  accept.addEventListener('click', () => closePageSetup(true));
  cancel.addEventListener('click', () => closePageSetup(false));
  dialogX.addEventListener('click', () => closePageSetup(false));
  pageScrim.addEventListener('mousedown', (e) => {
    if (e.target === pageScrim) closePageSetup(false);
  });

  head(t('page.word'));
  item('page-setup', ICONS.page, t('pageSetup.open'), openPageSetup);
  // The paper of the company: a picture under the text of every page, picked from the disk.
  const pickLetterhead = () => {
    const input = el('input', '');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) void editor.setLetterheadFile(file).then((ok) => ok || alert(t('letterhead.failed')));
    });
    input.click();
  };
  if (options.letterhead !== false) {
    const letterhead = item('letterhead', ICONS.letterhead, t('letterhead.set'), pickLetterhead);
    const fitLetterhead = item('letterhead-fit', ICONS.fitLetterhead, t('letterhead.fit'), () => void editor.fitLetterheadMargins());
    // The picture as the document keeps it, as a file of its own: to use it on another document.
    const saveLetterhead = item('letterhead-save', ICONS.saveLetterhead, t('letterhead.save'), () => {
      const image = editor.letterhead;
      if (image) give({ name: `${baseName()}-${t('letterhead.name')}.${imageExtension(image.type) ?? 'png'}`, blob: new Blob([image.bytes as BlobPart], { type: image.type }) });
    });
    const noLetterhead = item('letterhead-remove', ICONS.noLetterhead, t('letterhead.remove'), () => editor.removeLetterhead());
    letterheadItems = () => {
      letterhead.lastChild!.textContent = t(editor.hasLetterhead ? 'letterhead.change' : 'letterhead.set');
      fitLetterhead.hidden = saveLetterhead.hidden = noLetterhead.hidden = !editor.hasLetterhead;
    };
  }
  if (options.onLocale) {
    head(t('language'));
    const language = el('select', '');
    language.dataset.name = 'language';
    for (const { code, name } of locales()) language.add(new Option(name, code));
    language.value = getLocale();
    language.addEventListener('change', () => options.onLocale?.(language.value));
    body.appendChild(field(t('language'), language));
  }

  const page = () => editor.page;
  const upright = () => {
    const { width, height } = page();
    return width > height ? { short: height, long: width, landscape: true } : { short: width, long: height, landscape: false };
  };
  const cm = (pt: number) => String(Math.round((pt / PT_PER_CM) * 100) / 100);
  const select = (id: string, labels: string[], onChange: (index: number) => void, current: () => number) => {
    const node = el('select', '');
    node.dataset.name = id;
    labels.forEach((label, i) => node.add(new Option(label, String(i))));
    node.add(new Option(t('pageSetup.custom'), CUSTOM));
    node.addEventListener('change', () => {
      if (node.value !== CUSTOM) onChange(Number(node.value));
      refresh();
    });
    updates.push(() => {
      const index = current();
      node.value = index < 0 ? CUSTOM : String(index);
    });
    return node;
  };
  /** A length in centimetres; `write` gets it in points, already within what `limits` allows. */
  const length = (id: string, readPt: () => number, write: (pt: number) => void, limits: () => [number, number]) => {
    const node = el('input', '');
    node.type = 'number';
    node.step = '0.1';
    node.min = '0';
    node.dataset.name = id;
    node.addEventListener('change', () => {
      const value = Number(node.value.replace(',', '.'));
      const [min, max] = limits();
      if (Number.isFinite(value) && node.value !== '') write(Math.max(min, Math.min(value * PT_PER_CM, Math.max(min, max))));
      // What was typed gives way to what was taken: a length out of range is brought back in.
      node.value = cm(readPt());
      refresh();
    });
    updates.push(() => {
      if (document.activeElement !== node) node.value = cm(readPt());
    });
    return node;
  };
  const unit = () => el('em', '', 'cm');

  // In a document of several sections: the one being edited, or all of them.
  const scope = (label: string, all: boolean) => {
    const node = el('button', '');
    node.type = 'button';
    node.textContent = label;
    node.dataset.name = all ? 'page-everywhere' : 'page-section';
    node.addEventListener('click', () => {
      everywhere = all;
      refresh();
    });
    updates.push(() => {
      node.classList.toggle('dx-on', everywhere === all);
      node.setAttribute('aria-pressed', String(everywhere === all));
    });
    return node;
  };
  const scopes = el('div', 'dx-side-seg');
  scopes.append(scope(t('pageSetup.thisSection'), false), scope(t('pageSetup.wholeDocument'), true));
  const scopeField = field(t('pageSetup.applyTo'), scopes);
  updates.push(() => (scopeField.hidden = editor.sectionCount < 2));
  form.appendChild(scopeField);

  form.appendChild(
    field(
      t('pageSetup.size'),
      select(
        'paper',
        PAPERS.map(([label]) => t(label)),
        (i) => {
          // The paper keeps the way it is turned.
          const [, width, height] = PAPERS[i];
          setPage(upright().landscape ? { width: height, height: width } : { width, height });
        },
        () => PAPERS.findIndex(([, width, height]) => near(upright().short, width) && near(upright().long, height)),
      ),
    ),
  );
  // Any other size is typed in: the least is what the margins need.
  const sizes = el('div', 'dx-side-pair');
  sizes.append(
    field(t('pageSetup.width'), length('width', () => page().width, (width) => setPage({ width }), () => [page().marginLeft + page().marginRight + MIN_TEXT, 3600]), unit()),
    field(t('pageSetup.height'), length('height', () => page().height, (height) => setPage({ height }), () => [page().marginTop + page().marginBottom + MIN_TEXT, 3600]), unit()),
  );
  form.appendChild(sizes);

  const turn = (label: string, landscape: boolean) => {
    const node = el('button', '');
    node.type = 'button';
    node.textContent = label;
    node.dataset.name = landscape ? 'landscape' : 'portrait';
    node.addEventListener('click', () => {
      const { short, long } = upright();
      setPage(landscape ? { width: long, height: short } : { width: short, height: long });
    });
    updates.push(() => {
      const on = upright().landscape === landscape;
      node.classList.toggle('dx-on', on);
      node.setAttribute('aria-pressed', String(on));
    });
    return node;
  };
  const turns = el('div', 'dx-side-seg');
  turns.append(turn(t('pageSetup.portrait'), false), turn(t('pageSetup.landscape'), true));
  const orientation = field(t('pageSetup.orientation'), turns);
  form.appendChild(orientation);

  form.appendChild(
    field(
      t('pageSetup.margins'),
      select(
        'margins',
        MARGINS.map(([label]) => t(label)),
        (i) => {
          const [, vertical, sides] = MARGINS[i];
          setPage({ marginTop: vertical, marginBottom: vertical, marginLeft: sides, marginRight: sides });
        },
        () => {
          const p = page();
          return MARGINS.findIndex(([, v, s]) => near(p.marginTop, v) && near(p.marginBottom, v) && near(p.marginLeft, s) && near(p.marginRight, s));
        },
      ),
    ),
  );
  const margin = (label: string, key: 'marginTop' | 'marginBottom' | 'marginLeft' | 'marginRight') => {
    const vertical = key === 'marginTop' || key === 'marginBottom';
    const other: keyof PageSetup = { marginTop: 'marginBottom', marginBottom: 'marginTop', marginLeft: 'marginRight', marginRight: 'marginLeft' }[key] as keyof PageSetup;
    // A margin goes as far as leaves room for the text against the one across.
    const limits = (): [number, number] => [0, (vertical ? page().height : page().width) - (page()[other] ?? 0) - MIN_TEXT];
    return field(label, length(key, () => page()[key], (value) => setPage({ [key]: value }), limits), unit());
  };
  const margins = el('div', 'dx-side-pair');
  margins.append(margin(t('pageSetup.top'), 'marginTop'), margin(t('pageSetup.bottom'), 'marginBottom'), margin(t('pageSetup.left'), 'marginLeft'), margin(t('pageSetup.right'), 'marginRight'));
  form.appendChild(margins);
  const note = el('div', 'dx-side-note');
  note.textContent = t('pageSetup.note');
  form.appendChild(note);

  const refresh = () => {
    name.textContent = options.fileName?.() || t('file.untitled');
    for (const update of updates) update();
  };

  x.addEventListener('click', () => close());
  scrim.addEventListener('click', () => close());
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && pageBefore) {
      e.stopPropagation();
      closePageSetup(false);
    } else if (e.key === 'Enter' && pageBefore && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLSelectElement)) {
      e.preventDefault();
      e.stopPropagation();
      closePageSetup(true);
    } else if (e.key === 'Escape' && isOpen) {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKey, true);
  const unsubscribe = editor.onChange(() => {
    if (isOpen || pageBefore) refresh();
  });
  document.body.append(scrim, side, pageScrim);

  return {
    open,
    close,
    toggle: () => (isOpen ? close() : open()),
    openPageSetup,
    destroy() {
      unsubscribe();
      document.removeEventListener('keydown', onKey, true);
      scrim.remove();
      side.remove();
      pageScrim.remove();
    },
  };
}
