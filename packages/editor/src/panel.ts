// A panel beside the document with what Word has no one place for: the
// outline of the document, to move about it and reorder its sections, the
// variables of a template, to fill them in, and the notes on its text. It only uses the public
// methods of the editor.

import { type FormatId, NOTE_COLORS, formatText, formatValue, isVariableName } from '@rebodocs/core';
import { recallAuthor, setAuthor } from './author';
import type { Editor } from './editor';
import { type MessageKey, getLocale, t } from './i18n';

export type PanelTab = 'outline' | 'variables' | 'notes';

export interface Panel {
  /** Shows the panel, on the tab given or the one it was on. */
  show(tab?: PanelTab): void;
  hide(): void;
  toggle(): void;
  destroy(): void;
}

const STYLE_ID = 'dx-panel-style';

const CSS = `
.dx-pn{display:none;flex:none;flex-direction:column;width:340px;max-width:45vw;height:100%;box-sizing:border-box;border-right:1px solid #d9dce3;background:#fafbfc;font:13px system-ui,-apple-system,"Segoe UI",sans-serif;color:#2b2f38}
.dx-pn.dx-pn-open{display:flex}
.dx-pn-tabs{display:flex;gap:2px;padding:8px 8px 0;border-bottom:1px solid #e3e6ec}
.dx-pn-tab{flex:1;height:32px;border:0;border-bottom:2px solid transparent;background:none;color:#5f6470;font:inherit;cursor:pointer}
.dx-pn-tab.dx-on{border-bottom-color:#0b57d0;color:#0b57d0;font-weight:600}
.dx-pn-body{flex:1;overflow-y:auto;padding:8px}
.dx-pn-empty{padding:12px 8px;color:#5f6470;line-height:1.45}
.dx-pn-empty code{padding:1px 4px;border-radius:4px;background:#eceff4;font:12px ui-monospace,Menlo,monospace}
.dx-pn-item{position:relative;display:block;width:100%;padding:6px 8px;border:0;border-radius:6px;background:none;color:inherit;font:inherit;text-align:left;line-height:1.3;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dx-pn-item:hover{background:#eef1f6}
.dx-pn-item.dx-on{background:#d3e3fd;color:#0b57d0}
.dx-pn-item.dx-pn-l0{font-weight:600}
.dx-pn-item.dx-pn-drop::before{content:"";position:absolute;left:4px;right:4px;top:0;border-top:2px solid #0b57d0}
.dx-pn-end{height:28px;border-radius:6px}
.dx-pn-end.dx-pn-drop{box-shadow:inset 0 2px 0 #0b57d0}
.dx-pn-item:focus-visible,.dx-pn-tab:focus-visible,.dx-pn input:focus-visible,.dx-pn-btn:focus-visible{outline:2px solid #0b57d0;outline-offset:-2px}
.dx-pn-row{display:flex;gap:6px;padding:2px 0 8px}
.dx-pn input[type=text]{flex:1;min-width:0;height:30px;padding:0 8px;border:1px solid #d2d6de;border-radius:6px;background:#fff;color:inherit;font:inherit}
.dx-pn-btn{flex:none;height:30px;padding:0 10px;border:1px solid #d2d6de;border-radius:6px;background:#fff;color:inherit;font:inherit;cursor:pointer;white-space:nowrap}
.dx-pn-btn:hover:not(:disabled){background:#eef1f6}
.dx-pn-btn:disabled{opacity:.4;cursor:default}
.dx-pn-btn.dx-pn-main{flex:1;border-color:#0b57d0;background:#0b57d0;color:#fff}
.dx-pn-btn.dx-pn-main:hover:not(:disabled){background:#0a4dba}
.dx-pn-var{padding:6px 0}
.dx-pn-var button{display:flex;align-items:baseline;gap:6px;width:100%;padding:0 2px 4px;border:0;background:none;color:inherit;font:600 12px ui-monospace,Menlo,monospace;text-align:left;cursor:pointer}
.dx-pn-var button:hover{color:#0b57d0}
.dx-pn-var small{margin-left:auto;color:#5f6470;font:11px system-ui,sans-serif}
.dx-pn-var input{width:100%;box-sizing:border-box}
.dx-pn-fmt{display:flex;gap:4px;padding-top:4px}
.dx-pn-fmt select{flex:1;min-width:0;height:26px;padding:0 2px;border:1px solid #d2d6de;border-radius:6px;background:#fff;color:inherit;font:12px system-ui,sans-serif}
.dx-pn-var .dx-pn-chip{flex:none;display:inline-flex;justify-content:center;align-items:center;width:26px;height:26px;padding:0;border:1px solid #d2d6de;border-radius:6px;background:#fff;font:13px Georgia,serif}
.dx-pn-var .dx-pn-chip.dx-on{border-color:#0b57d0;background:#d3e3fd;color:#0b57d0}
.dx-pn-preview{padding:4px 2px 0;color:#5f6470;font-size:12px;line-height:1.35;overflow-wrap:anywhere}
.dx-pn-preview.dx-pn-bad{color:#b3261e}
.dx-pn-foot{display:flex;flex-direction:column;gap:6px;padding:8px;border-top:1px solid #e3e6ec}
.dx-pn-foot .dx-pn-row{flex-direction:column;padding:0}
.dx-pn-foot .dx-pn-btn{flex:none;width:100%}
.dx-pn-note{color:#5f6470;font-size:12px;line-height:1.4}
.dx-pn textarea{display:block;width:100%;box-sizing:border-box;min-height:54px;padding:6px 8px;border:1px solid #d2d6de;border-radius:6px;background:#fff;color:inherit;font:inherit;line-height:1.35;resize:vertical}
.dx-pn textarea:focus-visible{outline:2px solid #0b57d0;outline-offset:-2px}
.dx-pn-add{display:flex;flex-direction:column;gap:6px;padding:2px 0 10px}
.dx-pn-card{margin-bottom:8px;padding:8px;border:1px solid #e3e6ec;border-left:3px solid #e0a800;border-radius:6px;background:#fff}
.dx-pn-card.dx-on{background:#f6f8fc;box-shadow:0 0 0 1px #c9d6ee}
.dx-pn-quote{display:block;width:100%;padding:0 0 4px;border:0;background:none;color:#5f6470;font:italic 12px/1.35 system-ui,sans-serif;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dx-pn-quote:hover{color:#0b57d0}
.dx-pn-by{display:flex;align-items:center;gap:6px;padding-top:6px;color:#5f6470;font-size:11px}
.dx-pn-by span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dx-pn-by button{flex:none;height:24px;padding:0 8px;border:0;border-radius:5px;background:none;color:#5f6470;font:inherit;cursor:pointer}
.dx-pn-by button:hover{background:#fce8e6;color:#b3261e}
.dx-pn-dots{display:flex;align-items:center;gap:6px}
.dx-pn-dot{flex:none;width:18px;height:18px;padding:0;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.2);cursor:pointer}
.dx-pn-dot.dx-on{box-shadow:0 0 0 2px #2b2f38}
.dx-pn-dot:focus-visible{outline:2px solid #0b57d0;outline-offset:2px}
.dx-pn-label{display:block;color:#5f6470;font-size:12px}
.dx-pn-label input{display:block;width:100%;height:30px;margin-top:4px;box-sizing:border-box}
`;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/** `{ cliente: { nombre: "Ana" } }` as `{ "cliente.nombre": "Ana" }`: the names variables go by. */
function flatten(data: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) flatten(value, prefix ? `${prefix}.${key}` : key, out);
  } else if (prefix && data !== null && data !== undefined) {
    out[prefix] = String(data);
  }
  return out;
}

/** How a value is written: one of each list at most. */
const TYPES: [FormatId | '', MessageKey][] = [
  ['', 'type.text'],
  ['date', 'type.date'],
  ['dateLong', 'type.dateLong'],
  ['dateFull', 'type.dateFull'],
  ['number', 'type.number'],
  ['currency', 'type.currency'],
];
const CASES: [FormatId | '', MessageKey][] = [
  ['', 'case.none'],
  ['upper', 'case.upper'],
  ['lower', 'case.lower'],
  ['capital', 'case.capital'],
];
const MARKS: [FormatId, MessageKey, MessageKey, string][] = [
  ['bold', 'mark.bold.letter', 'mark.bold', 'font-weight:700'],
  ['italic', 'mark.italic.letter', 'mark.italic', 'font-style:italic'],
  ['underline', 'mark.underline.letter', 'mark.underline', 'text-decoration:underline'],
];

export function createPanel(container: HTMLElement, editor: Editor): Panel {
  injectStyle();
  const root = el('div', 'dx-pn');
  const tabs = el('div', 'dx-pn-tabs');
  tabs.setAttribute('role', 'tablist');
  const body = el('div', 'dx-pn-body');
  const foot = el('div', 'dx-pn-foot');
  root.append(tabs, body, foot);
  let tab: PanelTab = 'outline';
  let isOpen = false;
  /** What was typed for each variable; it outlives the variable, so undoing a fill brings both back. */
  const values = new Map<string, string>();

  const tabButtons = (['outline', 'variables', 'notes'] as const).map((name) => {
    const node = el('button', 'dx-pn-tab', t(`panel.${name}`));
    node.type = 'button';
    node.dataset.name = name;
    node.setAttribute('role', 'tab');
    node.addEventListener('click', () => show(name));
    tabs.appendChild(node);
    return node;
  });

  // --- Outline --------------------------------------------------------------------

  /** The heading being dragged, as the index of its paragraph. */
  let dragging: number | undefined;
  const clearDrop = () => body.querySelectorAll('.dx-pn-drop').forEach((node) => node.classList.remove('dx-pn-drop'));

  /** What the outline last showed, to leave it alone while it does not change: a drag must not lose its items. */
  let shownOutline = '';
  const renderOutline = () => {
    const items = editor.outline;
    const active = editor.activeHeading;
    const key = JSON.stringify(items);
    if (key === shownOutline) {
      body.querySelectorAll('.dx-pn-item').forEach((node, i) => node.classList.toggle('dx-on', i === active));
      return;
    }
    shownOutline = key;
    body.replaceChildren();
    if (!items.length) {
      const empty = el('div', 'dx-pn-empty');
      empty.innerHTML = t('panel.outlineEmpty');
      body.appendChild(empty);
      return;
    }
    const least = Math.min(...items.map((item) => item.level));
    items.forEach((item, i) => {
      const node = el('button', `dx-pn-item dx-pn-l${item.level}${i === active ? ' dx-on' : ''}`, item.text);
      node.type = 'button';
      node.title = item.text;
      node.style.paddingLeft = `${8 + (item.level - least) * 14}px`;
      node.draggable = true;
      node.addEventListener('click', () => {
        editor.goToHeading(item.para);
        editor.focus();
      });
      node.addEventListener('dragstart', (e) => {
        dragging = item.para;
        e.dataTransfer?.setData('text/plain', item.text);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      // Dropped on a heading, the section goes just above it.
      node.addEventListener('dragover', (e) => {
        if (dragging === undefined) return;
        e.preventDefault();
        clearDrop();
        node.classList.add('dx-pn-drop');
      });
      node.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = dragging;
        dragging = undefined;
        clearDrop();
        if (from !== undefined) editor.moveSection(from, item.para);
      });
      node.addEventListener('dragend', () => {
        dragging = undefined;
        clearDrop();
      });
      body.appendChild(node);
    });
    // Dropped below them all, the section goes to the end of the document.
    const end = el('div', 'dx-pn-end');
    end.addEventListener('dragover', (e) => {
      if (dragging === undefined) return;
      e.preventDefault();
      clearDrop();
      end.classList.add('dx-pn-drop');
    });
    end.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = dragging;
      dragging = undefined;
      clearDrop();
      if (from !== undefined) editor.moveSection(from);
    });
    body.appendChild(end);
  };

  // The table of contents: put in at the caret, or brought up to date when the document has one.
  const toc = el('button', 'dx-pn-btn', '');
  toc.type = 'button';
  toc.dataset.name = 'toc';
  toc.addEventListener('mousedown', (e) => e.preventDefault());
  toc.addEventListener('click', () => {
    if (editor.hasToc) {
      if (!editor.updateToc()) editor.goToToc();
    } else editor.insertToc();
    editor.focus();
  });
  const tocNote = el('div', 'dx-pn-note', t('toc.note'));
  const renderToc = () => {
    const has = editor.hasToc;
    toc.textContent = t(has ? 'toc.update' : 'toc.insertHere');
    toc.disabled = !has && (editor.area !== 'body' || editor.inTable || !editor.outline.some((item) => item.level >= 1));
    tocNote.style.display = has ? '' : 'none';
  };

  // --- Variables ------------------------------------------------------------------

  const name = el('input', '');
  name.type = 'text';
  name.placeholder = t('var.namePlaceholder');
  name.dataset.name = 'variable-name';
  name.setAttribute('aria-label', t('var.newName'));
  name.spellcheck = false;
  const insert = el('button', 'dx-pn-btn', t('insert'));
  insert.type = 'button';
  insert.dataset.name = 'variable-insert';
  insert.title = t('var.insertTitle');
  const add = () => {
    if (!isVariableName(name.value.trim())) return;
    editor.insertVariable(name.value);
    name.value = '';
    insert.disabled = true;
    editor.focus();
  };
  insert.addEventListener('mousedown', (e) => e.preventDefault());
  insert.addEventListener('click', add);
  name.addEventListener('input', () => (insert.disabled = !isVariableName(name.value.trim())));
  name.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    // Used up here, or it would go on to the document, which `add` gives the keyboard to.
    e.preventDefault();
    add();
  });
  insert.disabled = true;
  const adder = el('div', 'dx-pn-row');
  adder.append(name, insert);

  const fill = el('button', 'dx-pn-btn dx-pn-main', t('var.fill'));
  fill.type = 'button';
  fill.dataset.name = 'variables-fill';
  const filled = () => Object.fromEntries([...values].filter(([key, value]) => value !== '' && editor.variables.includes(key)));
  fill.addEventListener('click', () => {
    editor.fillVariables(filled());
    editor.focus();
  });
  const load = el('button', 'dx-pn-btn', t('var.load'));
  load.type = 'button';
  load.dataset.name = 'variables-load';
  load.title = t('var.loadTitle');
  const picker = el('input', '');
  picker.type = 'file';
  picker.accept = '.json,application/json';
  picker.hidden = true;
  load.addEventListener('click', () => picker.click());
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0];
    picker.value = '';
    if (!file) return;
    try {
      setValues(JSON.parse(await file.text()));
    } catch {
      alert(t('var.badJson'));
    }
  });
  const setValues = (data: unknown) => {
    for (const [key, value] of Object.entries(flatten(data))) values.set(key, value);
    shownVariables = '';
    refresh();
  };
  const actions = el('div', 'dx-pn-row');
  actions.append(fill, load);
  const note = el('div', 'dx-pn-note', t('var.note'));

  let shownVariables = '';
  const renderVariables = () => {
    const names = editor.variables;
    fill.disabled = !Object.keys(filled()).length;
    const key = JSON.stringify(names.map((variable) => [variable, editor.variableFormats(variable), editor.variableUses(variable)]));
    if (key === shownVariables && body.firstChild) return;
    shownVariables = key;
    body.replaceChildren(adder);
    if (!names.length) {
      const empty = el('div', 'dx-pn-empty');
      empty.innerHTML = t('panel.variablesEmpty');
      body.appendChild(empty);
      return;
    }
    for (const variable of names) {
      const row = el('div', 'dx-pn-var');
      const label = el('button', '', variable);
      label.type = 'button';
      label.title = t('var.goTo');
      label.addEventListener('click', () => editor.selectVariable(variable));
      const input = el('input', '');
      input.type = 'text';
      input.dataset.variable = variable;
      input.placeholder = t('var.value');
      input.setAttribute('aria-label', t('var.valueOf', { name: variable }));
      input.value = values.get(variable) ?? '';
      // How the value is written. It is part of the text of the variable, {{fecha | fecha larga}}, so Word keeps it.
      const active = editor.variableFormats(variable);
      const has = (id: FormatId | '') => active.some((format) => format.id === id);
      const formats = el('div', 'dx-pn-fmt');
      const choice = (options: [FormatId | '', MessageKey][], title: string) => {
        const select = el('select', '');
        select.title = title;
        select.setAttribute('aria-label', t('var.controlOf', { title, name: variable }));
        for (const [id, text] of options) select.add(new Option(t(text), id));
        const current = options.find(([id]) => id && has(id))?.[0] ?? '';
        select.value = current;
        select.addEventListener('change', () => {
          const next = select.value as FormatId | '';
          if (next) editor.setVariableFormat(variable, next, true);
          else if (current) editor.setVariableFormat(variable, current, false);
        });
        return select;
      };
      const type = choice(TYPES, t('var.type'));
      type.dataset.name = 'variable-type';
      const letters = choice(CASES, t('var.case'));
      letters.dataset.name = 'variable-case';
      letters.style.flex = '0 0 96px';
      formats.append(type, letters);
      for (const [id, text, title, css] of MARKS) {
        const chip = el('button', `dx-pn-chip${has(id) ? ' dx-on' : ''}`, t(text));
        chip.type = 'button';
        chip.title = t(title);
        chip.dataset.name = `variable-${id}`;
        chip.style.cssText = css;
        chip.setAttribute('aria-pressed', String(has(id)));
        chip.addEventListener('click', () => editor.setVariableFormat(variable, id, !has(id)));
        formats.appendChild(chip);
      }
      // What the value will come out as, or why it cannot.
      const preview = el('div', 'dx-pn-preview');
      const showPreview = () => {
        const written = active.map((format) => formatText(format.id, format.arg));
        const { text, problems } = formatValue(input.value, written);
        const bad = input.value !== '' && problems.length > 0;
        preview.classList.toggle('dx-pn-bad', bad);
        preview.textContent = bad ? (has('number') || has('currency') ? t('var.notNumber') : t('var.notDate')) : input.value !== '' && text !== input.value ? `→ ${text}` : '';
      };
      input.addEventListener('input', () => {
        values.set(variable, input.value);
        fill.disabled = !Object.keys(filled()).length;
        showPreview();
      });
      showPreview();
      const uses = editor.variableUses(variable);
      if (uses > 1) label.appendChild(el('small', '', t('var.uses', { n: uses })));
      row.append(label, input, formats, preview);
      body.appendChild(row);
    }
  };

  // --- Notes ----------------------------------------------------------------------

  recallAuthor(editor);
  const noteText = el('textarea', '');
  noteText.placeholder = t('note.placeholder');
  noteText.dataset.name = 'note-text';
  noteText.setAttribute('aria-label', t('note.placeholder'));
  const noteAdd = el('button', 'dx-pn-btn dx-pn-main', t('note.add'));
  noteAdd.type = 'button';
  noteAdd.dataset.name = 'note-add';
  noteAdd.title = t('note.addTitle');
  noteAdd.style.flex = 'none';
  noteAdd.disabled = true;
  noteText.addEventListener('input', () => (noteAdd.disabled = !noteText.value.trim()));
  noteAdd.addEventListener('click', () => {
    if (editor.addNote(noteText.value) === undefined) return;
    noteText.value = '';
    noteAdd.disabled = true;
    editor.focus();
  });
  /** A row of the colours a note can have; `pick` is told the one pressed. */
  const dots = (current: () => string, pick: (color: string) => void) => {
    const row = el('div', 'dx-pn-dots');
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', t('note.color'));
    const mark = () => row.querySelectorAll<HTMLElement>('.dx-pn-dot').forEach((dot) => {
      const on = dot.dataset.color === current();
      dot.classList.toggle('dx-on', on);
      dot.setAttribute('aria-checked', String(on));
    });
    for (const color of NOTE_COLORS) {
      const dot = el('button', 'dx-pn-dot');
      dot.type = 'button';
      dot.dataset.color = color;
      dot.title = t('note.color');
      dot.setAttribute('role', 'radio');
      dot.style.background = `#${color}`;
      dot.addEventListener('click', () => {
        pick(color);
        mark();
      });
      row.appendChild(dot);
    }
    mark();
    return row;
  };
  const noteAdder = el('div', 'dx-pn-add');
  const nextColor = dots(() => editor.noteColor, (color) => (editor.noteColor = color));
  nextColor.dataset.name = 'note-color';
  noteAdder.append(noteText, nextColor, noteAdd);

  const author = el('input', '');
  author.type = 'text';
  author.dataset.name = 'note-author';
  author.value = editor.author;
  author.addEventListener('input', () => setAuthor(editor, author.value));
  const authorLabel = el('label', 'dx-pn-label', t('note.author'));
  authorLabel.title = t('note.authorTitle');
  authorLabel.appendChild(author);

  const day = (date: string | undefined) => {
    const when = date ? new Date(date) : undefined;
    return when && !Number.isNaN(when.getTime()) ? when.toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  };

  let shownNotes = '';
  const renderNotes = () => {
    const notes = editor.notes;
    const active = editor.activeNote;
    const key = JSON.stringify(notes);
    if (key === shownNotes && body.firstChild) {
      body.querySelectorAll<HTMLElement>('.dx-pn-card').forEach((node) => node.classList.toggle('dx-on', node.dataset.note === active));
      return;
    }
    shownNotes = key;
    body.replaceChildren(noteAdder);
    if (!notes.length) {
      const empty = el('div', 'dx-pn-empty');
      empty.innerHTML = t('note.empty');
      body.appendChild(empty);
      return;
    }
    for (const note of notes) {
      const card = el('div', `dx-pn-card${note.id === active ? ' dx-on' : ''}`);
      card.dataset.note = note.id;
      card.style.borderLeftColor = `#${note.color}`;
      const quote = el('button', 'dx-pn-quote', `«${note.excerpt}»`);
      quote.type = 'button';
      quote.title = t('note.goTo');
      quote.addEventListener('click', () => {
        editor.selectNote(note.id);
        editor.focus();
      });
      const text = el('textarea', '');
      text.value = note.text;
      text.setAttribute('aria-label', t('note.textOf'));
      // Taken when the field is left; emptied, it goes back to what it said.
      text.addEventListener('change', () => {
        if (text.value.trim()) editor.setNoteText(note.id, text.value);
        else text.value = note.text;
      });
      const by = el('div', 'dx-pn-by');
      const remove = el('button', '', t('note.delete'));
      remove.type = 'button';
      remove.addEventListener('click', () => {
        editor.removeNote(note.id);
        editor.focus();
      });
      by.append(el('span', '', [note.author, day(note.date)].filter(Boolean).join(' · ')), remove);
      const colors = dots(() => note.color, (color) => editor.setNoteColor(note.id, color));
      colors.style.paddingTop = '6px';
      card.append(quote, text, colors, by);
      body.appendChild(card);
    }
  };

  // --- The panel ------------------------------------------------------------------

  /** The tab the foot of the panel was last filled for. */
  let footFor: PanelTab | undefined;
  const refresh = () => {
    if (!isOpen) return;
    tabButtons.forEach((node) => {
      const on = node.dataset.name === tab;
      node.classList.toggle('dx-on', on);
      node.setAttribute('aria-selected', String(on));
    });
    // The name may have been given elsewhere, where a note was made.
    if (document.activeElement !== author) author.value = editor.author;
    nextColor.querySelectorAll<HTMLElement>('.dx-pn-dot').forEach((dot) => dot.classList.toggle('dx-on', dot.dataset.color === editor.noteColor));
    if (footFor !== tab) {
      footFor = tab;
      foot.replaceChildren(...(tab === 'variables' ? [actions, picker, note] : tab === 'notes' ? [authorLabel] : [toc, tocNote]));
    }
    if (tab === 'outline') {
      renderOutline();
      renderToc();
    }
    else if (tab === 'variables') renderVariables();
    else renderNotes();
  };
  function show(next: PanelTab = tab): void {
    if (next !== tab) {
      shownOutline = '';
      shownVariables = '';
      shownNotes = '';
      body.replaceChildren();
    }
    tab = next;
    isOpen = true;
    root.classList.add('dx-pn-open');
    refresh();
  }
  const hide = () => {
    isOpen = false;
    root.classList.remove('dx-pn-open');
    editor.focus();
  };

  const unsubscribe = editor.onChange(refresh);
  container.appendChild(root);

  return {
    show,
    hide,
    toggle: () => (isOpen ? hide() : show()),
    destroy() {
      unsubscribe();
      root.remove();
    },
  };
}
