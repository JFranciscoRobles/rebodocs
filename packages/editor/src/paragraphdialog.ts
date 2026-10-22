// The indents of the paragraphs selected, typed in centimetres: what the
// handles of the ruler set by dragging, for whoever cannot drag them, or
// wants a measure to the millimetre. Opened from the spacing menu of the
// toolbar, and by a double click on the ruler, as Word does.

import type { Editor } from './editor';
import { holdFocus, tabbables } from './a11y';
import { getLocale, t } from './i18n';
import { applyTheme } from './theme';

const PT_PER_CM = 72 / 2.54;
const STYLE_ID = 'dx-pd-style';
const CSS = `
.dx-pd-scrim{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(20,24,32,.32)}
.dx-pd-scrim.dx-pd-open{display:flex}
.dx-pd{width:360px;max-width:100%;border-radius:18px;background:var(--dx-ui-bg,#fff);box-shadow:0 12px 40px rgba(47,46,43,.28);font:13px system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-ink,#2f2e2b)}
.dx-pd h2{margin:0;padding:16px 16px 6px;font-size:15px;font-weight:600}
.dx-pd-body{display:grid;gap:8px;padding:6px 16px 4px}
.dx-pd label{display:flex;align-items:center;gap:8px}
.dx-pd label>span{flex:none;width:96px;color:var(--dx-ui-muted,#5f5d58)}
.dx-pd input,.dx-pd select{flex:1;min-width:0;height:32px;padding:0 6px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit}
.dx-pd input{text-align:right;font-variant-numeric:tabular-nums}
.dx-pd label>em{flex:none;width:20px;color:var(--dx-ui-muted,#5f5d58);font-style:normal}
.dx-pd-foot{display:flex;justify-content:flex-end;gap:8px;padding:14px 16px 16px}
.dx-pd-foot button{height:32px;padding:0 16px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;background:var(--dx-ui-bg,#fff);color:inherit;font:inherit;cursor:pointer}
.dx-pd-foot button:hover{background:var(--dx-ui-hover,#f3f1ec)}
.dx-pd-foot .dx-main{border-color:var(--dx-ui-accent,#0b57d0);background:var(--dx-ui-accent,#0b57d0);color:var(--dx-ui-on-accent,#fff)}
.dx-pd-foot .dx-main:hover{background:var(--dx-ui-accent-hover,#08398a)}
.dx-pd :focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:1px}
@media (forced-colors:active){.dx-pd :focus-visible{outline:3px solid Highlight}}
`;

export interface ParagraphDialog {
  open(): void;
  destroy(): void;
}

/** One dialog for each editor, whoever opens it. */
const made = new WeakMap<Editor, ParagraphDialog>();

/** Takes away the dialog of an editor that is going, when it was made. */
export function dropParagraphDialog(editor: Editor): void {
  made.get(editor)?.destroy();
}

export function paragraphDialog(editor: Editor): ParagraphDialog {
  let dialog = made.get(editor);
  if (!dialog) made.set(editor, (dialog = createParagraphDialog(editor)));
  return dialog;
}

function createParagraphDialog(editor: Editor): ParagraphDialog {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const scrim = el('div', 'dx-pd-scrim');
  const box = el('div', 'dx-pd');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  const title = el('h2');
  title.id = `dx-pd-title-${Math.random().toString(36).slice(2, 8)}`;
  box.setAttribute('aria-labelledby', title.id);
  const body = el('div', 'dx-pd-body');
  const number = (name: string) => {
    const input = el('input');
    input.type = 'number';
    input.step = '0.1';
    input.dataset.name = name;
    return input;
  };
  const left = number('indent-left');
  const right = number('indent-right');
  const by = number('indent-by');
  by.min = '0';
  const special = el('select');
  special.dataset.name = 'indent-special';
  const row = (label: () => string, control: HTMLElement, unit = true) => {
    const node = el('label');
    const text = el('span');
    node.append(text, control);
    if (unit) node.appendChild(el('em', '', 'cm'));
    return { node, label: () => (text.textContent = label()) };
  };
  const rows = [row(() => t('indent.left'), left), row(() => t('indent.right'), right), row(() => t('indent.special'), special, false), row(() => t('indent.by'), by)];
  body.append(...rows.map((one) => one.node));
  const foot = el('div', 'dx-pd-foot');
  const cancel = el('button');
  cancel.type = 'button';
  const accept = el('button', 'dx-main');
  accept.type = 'button';
  accept.dataset.name = 'indent-accept';
  foot.append(cancel, accept);
  box.append(title, body, foot);
  scrim.appendChild(box);
  applyTheme(scrim, editor.theme);
  document.body.appendChild(scrim);

  const cm = (pt: number) => String(Math.round((pt / PT_PER_CM) * 100) / 100);
  const pt = (input: HTMLInputElement) => {
    const value = Number(input.value.replace(',', '.'));
    return Number.isFinite(value) ? value * PT_PER_CM : 0;
  };
  /** The texts, in the language of the interface when the dialog is opened. */
  const words = () => {
    title.textContent = t('indent.title');
    rows.forEach((one) => one.label());
    cancel.textContent = t('cancel');
    accept.textContent = t('accept');
    const was = special.value;
    special.replaceChildren(new Option(t('indent.none'), 'none'), new Option(t('indent.firstLine'), 'first'), new Option(t('indent.hanging'), 'hanging'));
    special.value = was || 'none';
    for (const node of [box]) node.lang = getLocale();
  };
  const byShown = () => (rows[3].node.hidden = special.value === 'none');
  special.addEventListener('change', () => {
    byShown();
    if (special.value !== 'none' && !Number(by.value)) by.value = '1.25';
  });

  let release: ((restore?: boolean) => void) | undefined;
  const close = (keep: boolean) => {
    if (!release) return;
    if (keep) {
      const first = special.value === 'none' ? 0 : pt(by) * (special.value === 'hanging' ? -1 : 1);
      // A hanging line cannot start before the edge of the page's text.
      const indentLeft = Math.max(pt(left), special.value === 'hanging' ? -first : -Infinity);
      editor.setParagraphProps({ indentLeft, indentRight: pt(right), indentFirstLine: first });
    }
    scrim.classList.remove('dx-pd-open');
    const done = release;
    release = undefined;
    done();
  };
  accept.addEventListener('click', () => close(true));
  cancel.addEventListener('click', () => close(false));
  scrim.addEventListener('mousedown', (e) => {
    if (e.target === scrim) close(false);
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(false);
    } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      close(true);
    }
  });

  return {
    open() {
      if (release || editor.readOnly) return;
      words();
      const { indentLeft, indentRight, indentFirstLine } = editor.activeParagraphProps();
      left.value = cm(indentLeft);
      right.value = cm(indentRight);
      special.value = indentFirstLine > 0 ? 'first' : indentFirstLine < 0 ? 'hanging' : 'none';
      by.value = cm(Math.abs(indentFirstLine));
      byShown();
      scrim.classList.add('dx-pd-open');
      release = holdFocus(box, () => editor.focus());
      tabbables(box)[0]?.focus();
    },
    destroy() {
      close(false);
      scrim.remove();
      made.delete(editor);
    },
  };
}
