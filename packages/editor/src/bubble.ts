// A small bar that comes up beside the selection, with what can be done to
// the thing selected: text, a variable, a picture or the cells of a table.
// A tap on ⌘ (Ctrl elsewhere) on its own shows it and hides it. It only uses
// the public methods of the editor.

import { type FormatId, NOTE_COLORS, cleanHref, isVariableName } from '@rebodocs/core/internal';
import { recallAuthor, setAuthor } from './author';
import type { Editor, MarkKey } from './editor';
import { arrowsThrough, colorName } from './a11y';
import { type MessageKey, speaks, t } from './i18n';
import { IS_MAC } from './platform';
import { createImagePicker } from './imagegrid';
import { applyTheme } from './theme';

export interface Bubble {
  /** Shows the bar beside the selection. */
  open(): void;
  close(): void;
  toggle(): void;
  /** Shows the bar asking for the name of a variable to insert, the text of a note for the selection, or the address of a link. */
  ask(what: 'variable' | 'note' | 'link'): void;
  destroy(): void;
}

const STYLE_ID = 'dx-bubble-style';
const MAC = IS_MAC;
/** The key that, tapped on its own, shows the bar. */
const TAP_KEY = MAC ? 'Meta' : 'Control';
const MOD = MAC ? '⌘' : 'Ctrl+';
/** Longer than this between pressing and letting go, and it was not a tap. */
const TAP_MS = 500;
/** The room, in pixels, between the selection and the bar, and between the bar and the window. */
const GAP = 8;
const HIGHLIGHT = 'FFFF00';
const SHADE = 'E8EEF9';

const CSS = `
.dx-bb{position:fixed;z-index:30;display:none;align-items:center;gap:2px;max-width:calc(100vw - 16px);flex-wrap:wrap;padding:4px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:14px;background:var(--dx-ui-bg,#fff);box-shadow:0 6px 22px rgba(47,46,43,.18);font:13px system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--dx-ui-ink,#2f2e2b);user-select:none}
.dx-bb.dx-bb-open{display:flex}
.dx-bb-what{padding:0 8px 0 6px;color:var(--dx-ui-muted,#5f5d58);font-size:11px;letter-spacing:.04em;text-transform:uppercase}
.dx-bb button{display:inline-flex;align-items:center;justify-content:center;height:30px;min-width:30px;padding:0 9px;border:0;border-radius:10px;background:transparent;color:inherit;font:inherit;white-space:nowrap;cursor:pointer}
.dx-bb button:hover:not(:disabled){background:var(--dx-ui-hover,#f3f1ec)}
.dx-bb button.dx-on{background:var(--dx-ui-active,#e8f0fd);color:var(--dx-ui-accent,#0b57d0)}
.dx-bb button:disabled{opacity:.35;cursor:default}
.dx-bb button:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-2px}
@media (pointer:coarse){.dx-bb button{height:38px;min-width:38px;padding:0 10px}.dx-bb input{height:38px}}
.dx-bb button.dx-bb-mark{padding:0;font:15px Georgia,serif}
.dx-bb button.dx-bb-danger:hover{background:#fce8e6;color:#b3261e}
.dx-bb input{width:150px;height:30px;padding:0 9px;border:1px solid var(--dx-ui-line,#e6e3dc);border-radius:9px;font:inherit;color:inherit}
.dx-bb input:focus-visible{outline:2px solid var(--dx-ui-accent,#0b57d0);outline-offset:-2px}
.dx-bb input.dx-bb-author{width:120px}
.dx-bb-dots{display:inline-flex;align-items:center;gap:6px;padding:0 6px}
.dx-bb button.dx-bb-dot{width:18px;min-width:18px;height:18px;padding:0;border:2px solid var(--dx-ui-bg,#fff);border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.2)}
.dx-bb button.dx-bb-dot.dx-on{box-shadow:0 0 0 2px var(--dx-ui-ink,#2f2e2b)}
.dx-bb-words{max-width:360px;padding:0 6px;line-height:1.35;white-space:normal}
.dx-bb-sep{flex:none;width:1px;height:18px;margin:0 4px;background:var(--dx-ui-line,#e6e3dc)}
`;

function injectStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

interface Action {
  label: string;
  title: string;
  run: () => void;
  on?: boolean;
  disabled?: boolean;
  /** Extra class and inline style: the letter of a mark drawn as the mark. */
  className?: string;
  css?: string;
  /** The bar goes away after it: there is nothing left to act on. */
  closes?: boolean;
  /** Words to read, not a button to press. */
  plain?: boolean;
}
type Item = Action | 'sep';

const MARKS: [MarkKey, MessageKey, MessageKey, string][] = [
  ['bold', 'mark.bold.letter', 'mark.bold', 'font-weight:700'],
  ['italic', 'mark.italic.letter', 'mark.italic', 'font-style:italic'],
  ['underline', 'mark.underline.letter', 'mark.underline', 'text-decoration:underline'],
  ['strike', 'mark.strike.letter', 'mark.strike', 'text-decoration:line-through'],
];

export function createBubble(editor: Editor): Bubble {
  injectStyle();
  const bar = document.createElement('div');
  bar.className = 'dx-bb';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', t('bubble.label'));
  speaks(bar);
  let isOpen = false;
  /** True while one of its own buttons changes the document: the bar stays for the next one. */
  let acting = false;
  /** What it is asking for in a field of its own: the name of a variable to insert, the text of a note, or the address of a link. */
  let naming: 'variable' | 'note' | 'link' | 'describe' | false = false;

  const picker = createImagePicker(editor);

  const styleId = (level: number) => editor.styles.find((style) => style.outlineLevel === level)?.id;

  // --- What each kind of selection offers ---------------------------------------

  /** How the picture sits in the text: in the line, or floating, and then what the text does about it. */
  const wraps = (): Item[] => {
    const now = editor.pictureWrap;
    if (!now) return [];
    const wrap = (kind: NonNullable<typeof now>, label: MessageKey, title: MessageKey): Action => ({ label: t(label), title: t(title), on: now === kind, run: () => editor.setPictureWrap(kind) });
    return [
      wrap('inline', 'wrap.inline', 'wrap.inlineTitle'),
      wrap('square', 'wrap.square', 'wrap.squareTitle'),
      wrap('topBottom', 'wrap.topBottom', 'wrap.topBottomTitle'),
      wrap('none', 'wrap.none', 'wrap.noneTitle'),
      wrap('behind', 'wrap.behind', 'wrap.behindTitle'),
      'sep',
    ];
  };

  /** The size of a picture and how it sits in the text are those it has on its page: not offered while there are no pages. */
  const shaping = (): Item[] =>
    editor.view === 'flow'
      ? []
      : [
          ...[0.25, 0.5, 1].map((fraction): Action => ({ label: `${fraction * 100} %`, title: t('bubble.fit', { n: fraction * 100 }), run: () => editor.fitSelectedPicture(fraction) })),
          'sep',
          ...wraps(),
        ];
  const picture = (): Item[] => [
    ...shaping(),
    // What a screen reader says of it: Word's "Alt Text".
    { label: t('alt.word'), title: t('alt.title'), on: !!editor.pictureDescription, run: () => (naming = 'describe') },
    { label: t('bubble.delete'), title: t('bubble.deleteTitle'), className: 'dx-bb-danger', closes: true, run: () => editor.deleteBackward() },
  ];

  const variable = (name: string): Item[] => {
    const active = editor.variableFormats(name);
    const has = (id: FormatId) => active.some((format) => format.id === id);
    const format = (id: FormatId, label: string, title: string, rest: Partial<Action> = {}): Action => ({
      label,
      title,
      on: has(id),
      run: () => editor.setVariableFormat(name, id, !has(id)),
      ...rest,
    });
    return [
      format('bold', t('mark.bold.letter'), t('mark.bold'), { className: 'dx-bb-mark', css: 'font-weight:700' }),
      format('italic', t('mark.italic.letter'), t('mark.italic'), { className: 'dx-bb-mark', css: 'font-style:italic' }),
      format('underline', t('mark.underline.letter'), t('mark.underline'), { className: 'dx-bb-mark', css: 'text-decoration:underline' }),
      'sep',
      format('upper', t('bubble.upper'), t('bubble.upperTitle')),
      format('capital', t('case.capital'), t('bubble.capitalTitle')),
      'sep',
      format('dateLong', t('bubble.date'), t('bubble.dateTitle')),
      format('currency', t('bubble.currency'), t('bubble.currencyTitle')),
    ];
  };

  const marks = (): Item[] => {
    const props = editor.activeRunProps();
    return [
      ...MARKS.map(([key, label, title, css]): Action => ({ label: t(label), title: t(title), css, className: 'dx-bb-mark', on: !!props[key], run: () => editor.toggleMark(key) })),
      { label: t('bubble.highlight'), title: t('bubble.highlightTitle'), on: !!props.highlight, run: () => editor.setRunProps({ highlight: props.highlight ? '' : HIGHLIGHT }) },
    ];
  };

  const toNote = (): Item[] => [{ label: t('note.word'), title: t('bubble.noteTitle'), disabled: editor.area !== 'body', run: () => (naming = 'note') }];

  const toLink = (): Item[] => [{ label: t('link.word'), title: t('link.title', { key: MOD }), run: () => (naming = 'link') }];

  /** The link the caret is in: where it goes, opening it, sending it elsewhere and taking it away. */
  const link = (href: string): Item[] => [
    { label: href.length > 60 ? `${href.slice(0, 60)}…` : href, title: href, plain: true, run: () => undefined },
    'sep',
    { label: t('link.open'), title: t('link.openTitle'), closes: true, run: () => editor.openLink(href) },
    { label: t('link.edit'), title: t('link.editTitle'), run: () => (naming = 'link') },
    { label: t('link.remove'), title: t('link.removeTitle'), className: 'dx-bb-danger', closes: true, run: () => editor.removeLink() },
  ];

  /** The suggestions of the word spelled wrong last asked about, once they come. */
  let suggested: { word: string; words?: string[] } | undefined;
  /** A word spelled wrong: what it could be instead, leaving it as it is, and taking it as right. */
  const spelling = (word: string): Item[] => {
    if (suggested?.word !== word) {
      suggested = { word };
      void editor.spellingSuggestions().then((words) => {
        if (suggested?.word !== word) return;
        suggested.words = words.slice(0, 5);
        if (isOpen && !naming) refresh();
      });
    }
    const words = suggested.words;
    const offered: Item[] = !words
      ? [{ label: t('spell.looking'), title: t('spell.looking'), plain: true, run: () => undefined }]
      : words.length
        ? words.map((other): Action => ({ label: other, title: t('spell.replace', { word: other }), closes: true, css: 'font-weight:600', run: () => editor.replaceMisspelling(other) }))
        : [{ label: t('spell.none'), title: t('spell.none'), plain: true, run: () => undefined }];
    return [
      ...offered,
      'sep',
      { label: t('spell.ignore'), title: t('spell.ignoreTitle'), closes: true, run: () => editor.ignoreMisspelling() },
      ...(editor.canAddWords ? [{ label: t('spell.add'), title: t('spell.addTitle'), closes: true, run: () => editor.addMisspelling() } as Action] : []),
    ];
  };

  /** The note the caret is in: what it says, and taking it away. */
  const note = (id: string): Item[] => {
    const text = editor.notes.find((other) => other.id === id)?.text ?? '';
    return [
      { label: text.length > 90 ? `${text.slice(0, 90)}…` : text, title: text, plain: true, run: () => undefined },
      'sep',
      { label: t('note.delete'), title: t('note.delete'), className: 'dx-bb-danger', closes: true, run: () => editor.removeNote(id) },
    ];
  };

  const toVariable = (): Item[] => {
    const name = editor.selectedText.trim().replace(/\s+/g, ' ');
    const fits = name.length <= 40 && isVariableName(name);
    return [{ label: '{{ }} Variable', title: fits ? t('bubble.toVariable', { name }) : t('bubble.toVariableNo'), disabled: !fits, run: () => editor.insertVariable(name) }];
  };

  const paragraph = (): Item[] => {
    const current = editor.activeStyleId();
    const style = (label: string, id: string | undefined): Action => ({
      label,
      title: t('bubble.style', { name: label }),
      on: !!id && current === id,
      disabled: !id,
      run: () => id && editor.setParagraphStyle(id),
    });
    const list = editor.activeListKind();
    return [
      style(t('style.normal'), editor.styles[0]?.id),
      style(t('style.heading1'), styleId(1)),
      style(t('style.heading2'), styleId(2)),
      'sep',
      { label: t('bubble.bullets'), title: t('list.bullet'), on: list === 'bullet', run: () => editor.toggleList('bullet') },
      { label: t('bubble.numbers'), title: t('list.number'), on: list === 'number', run: () => editor.toggleList('number') },
    ];
  };

  /** What can be put in at the caret. */
  const insert = (): Item[] => {
    const outside = !editor.inTable && editor.canEditTables;
    return [
      { label: t('table.word'), title: t('bubble.tableTitle'), disabled: !outside, closes: true, run: () => editor.insertTable(3, 3) },
      { label: t('bubble.signatures'), title: t('bubble.signaturesTitle'), disabled: !outside, closes: true, run: () => editor.insertSignatures() },
      { label: t('toc.insert'), title: t('toc.insertTitle'), disabled: !outside || editor.area !== 'body' || editor.hasToc, closes: true, run: () => editor.insertToc() },
      { label: t('bubble.image'), title: t('bubble.imageTitle'), closes: true, run: () => picker.click() },
      { label: '{{ }} Variable', title: t('bubble.variableTitle'), run: () => (naming = 'variable') },
      ...toLink(),
      { label: t('bubble.pageBreak'), title: t('bubble.pageBreakTitle'), disabled: editor.inTable || editor.area !== 'body', closes: true, run: () => editor.insertPageBreak() },
    ];
  };

  const table = (): Item[] => [
    { label: t('bubble.addRow'), title: t('bubble.addRowTitle'), run: () => editor.insertTableRow(true) },
    { label: t('bubble.addColumn'), title: t('bubble.addColumnTitle'), run: () => editor.insertTableColumn(true) },
    { label: t('bubble.delRow'), title: t('bubble.delRowTitle'), run: () => editor.deleteTableRow() },
    { label: t('bubble.delColumn'), title: t('bubble.delColumnTitle'), run: () => editor.deleteTableColumn() },
    'sep',
    editor.canSplitCell
      ? { label: t('bubble.split'), title: t('bubble.splitTitle'), run: () => editor.splitTableCell() }
      : { label: t('bubble.merge'), title: t('bubble.mergeTitle'), disabled: !editor.canMergeCells, run: () => editor.mergeTableCells() },
    {
      label: editor.tableBorders() ? t('bubble.noBorders') : t('bubble.borders'),
      title: editor.tableBorders() ? t('bubble.noBordersTitle') : t('bubble.bordersTitle'),
      run: () => editor.setTableBorders(!editor.tableBorders()),
    },
    { label: t('bubble.shade'), title: t('bubble.shadeTitle'), on: !!editor.activeCellProps()?.shade, run: () => editor.setTableCellProps({ shade: editor.activeCellProps()?.shade ? '' : SHADE }) },
    'sep',
    { label: t('bubble.delTable'), title: t('bubble.delTableTitle'), className: 'dx-bb-danger', closes: true, run: () => editor.deleteTable() },
  ];

  /** What a keyboard has keys for and a finger does not: only offered to a finger. */
  const clipboard = (): Item[] => {
    if (!editor.byTouch) return [];
    const paste: Item[] = editor.canPaste
      ? [
          { label: t('bubble.paste'), title: t('bubble.paste'), closes: true, run: () => void editor.paste() },
          { label: t('bubble.pastePlain'), title: t('bubble.pastePlain'), closes: true, run: () => void editor.paste({ plain: true }) },
        ]
      : [];
    const all: Action = { label: t('bubble.selectAll'), title: t('bubble.selectAll'), closes: true, run: () => (editor.selectAll(), editor.onTouchSelect?.()) };
    if (editor.collapsed) return [...paste, all, 'sep'];
    return [
      { label: t('bubble.copy'), title: t('bubble.copy'), closes: true, run: () => void editor.copy() },
      { label: t('bubble.cut'), title: t('bubble.cut'), closes: true, run: () => void editor.cut() },
      ...paste,
      all,
      'sep',
    ];
  };

  /** What the bar is about, and what it offers for it. */
  const content = (): { what: string; items: Item[] } => {
    const { what, items } = about();
    return { what, items: editor.pictureSelected ? items : [...clipboard(), ...items] };
  };
  const about = (): { what: string; items: Item[] } => {
    if (editor.pictureSelected) return { what: t('bubble.image'), items: picture() };
    const name = editor.activeVariable;
    if (name) return { what: 'Variable', items: variable(name) };
    const wrong = editor.misspelling;
    if (wrong) return { what: t('spell.word'), items: spelling(wrong.word) };
    const linked = editor.collapsed ? editor.activeLink : undefined;
    if (linked) return { what: t('link.word'), items: link(linked.href) };
    const noted = editor.collapsed ? editor.activeNote : undefined;
    if (noted !== undefined) return { what: t('note.word'), items: note(noted) };
    const cells = editor.inTable && editor.canEditTables;
    if (!editor.collapsed)
      return { what: cells ? t('bubble.cells') : t('type.text'), items: [...marks(), 'sep', ...toVariable(), ...toNote(), ...toLink(), ...(cells ? (['sep', ...table()] as Item[]) : [])] };
    if (cells) return { what: t('table.word'), items: table() };
    // On an empty line what is wanted is to put something there; in a written one, to change it.
    if (editor.paragraphEmpty) return { what: t('insert'), items: [...insert(), 'sep', ...paragraph()] };
    return { what: t('bubble.paragraph'), items: [...paragraph(), 'sep', ...insert()] };
  };

  // --- The bar ------------------------------------------------------------------

  const place = () => {
    const at = editor.selectionBounds();
    if (!at) return;
    const { width, height } = bar.getBoundingClientRect();
    // Centred on a selection; from a caret, it starts where the caret is.
    const wanted = at.width < 4 ? at.left - 2 * GAP : at.left + at.width / 2 - width / 2;
    const left = Math.max(GAP, Math.min(wanted, window.innerWidth - width - GAP));
    // Above the selection, or below it when there is no room above.
    const above = at.top - height - GAP;
    const top = above >= GAP ? above : Math.min(at.bottom + GAP, window.innerHeight - height - GAP);
    bar.style.left = `${Math.round(left)}px`;
    bar.style.top = `${Math.round(Math.max(GAP, top))}px`;
  };

  /** The row that asks for the name of a variable, in place of the buttons. */
  const renderNaming = () => {
    const label = document.createElement('span');
    label.className = 'dx-bb-what';
    const forNote = naming === 'note';
    const forLink = naming === 'link';
    const forAlt = naming === 'describe';
    label.textContent = forNote ? t('note.word') : forLink ? t('link.word') : forAlt ? t('alt.word') : 'Variable';
    const name = document.createElement('input');
    name.type = 'text';
    name.placeholder = forNote ? t('bubble.notePlaceholder') : forLink ? t('link.placeholder') : forAlt ? t('alt.placeholder') : t('bubble.namePlaceholder');
    name.spellcheck = forNote || forAlt;
    if (forNote || forLink || forAlt) name.style.width = '260px';
    name.setAttribute('aria-label', forNote ? t('bubble.notePlaceholder') : forLink ? t('link.address') : forAlt ? t('alt.title') : t('bubble.name'));
    if (forAlt) name.value = editor.pictureDescription ?? '';
    // A link already there shows where it goes, to be changed.
    const current = forLink ? editor.activeLink : undefined;
    if (forLink) {
      name.type = 'url';
      name.value = current?.href ?? '';
    }
    // An empty description takes the one there was away.
    const valid = () => (forAlt ? true : forNote ? !!name.value.trim() : forLink ? cleanHref(name.value) !== undefined : isVariableName(name.value.trim()));
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = current || forAlt ? t('link.save') : forLink && !editor.collapsed ? t('link.apply') : t('insert');
    add.disabled = !valid();
    const done = () => {
      if (!valid()) return;
      if (forNote) editor.addNote(name.value);
      else if (forLink) editor.setLink(name.value);
      else if (forAlt) editor.setPictureDescription(name.value);
      else editor.insertVariable(name.value);
      close();
      editor.focus();
    };
    name.addEventListener('input', () => (add.disabled = !valid()));
    // The key is used up here: left alone, it would go on to the document, which by then has the keyboard.
    const onEnter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      done();
    };
    name.addEventListener('keydown', onEnter);
    add.addEventListener('click', done);
    bar.replaceChildren(label, name);
    if (forNote) {
      // Its colour and who signs it, as in the panel: both are kept for the next one.
      recallAuthor(editor);
      const colors = document.createElement('span');
      colors.className = 'dx-bb-dots';
      colors.setAttribute('role', 'radiogroup');
      colors.setAttribute('aria-label', t('note.color'));
      const mark = () =>
        colors.querySelectorAll<HTMLElement>('button').forEach((dot) => {
          const on = dot.dataset.color === editor.noteColor;
          dot.classList.toggle('dx-on', on);
          dot.setAttribute('aria-checked', String(on));
        });
      for (const color of NOTE_COLORS) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'dx-bb-dot';
        dot.dataset.color = color;
        dot.title = colorName(color);
        dot.setAttribute('aria-label', colorName(color));
        dot.setAttribute('role', 'radio');
        dot.style.background = `#${color}`;
        dot.addEventListener('click', () => {
          editor.noteColor = color;
          mark();
          name.focus();
        });
        colors.appendChild(dot);
      }
      mark();
      const author = document.createElement('input');
      author.type = 'text';
      author.className = 'dx-bb-author';
      author.placeholder = t('note.author');
      author.title = t('note.authorTitle');
      author.setAttribute('aria-label', t('note.author'));
      author.value = editor.author;
      author.addEventListener('input', () => setAuthor(editor, author.value));
      author.addEventListener('keydown', onEnter);
      bar.append(colors, author);
    }
    bar.appendChild(add);
    bar.dataset.kind = forNote ? 'Nota' : forLink ? 'Enlace' : forAlt ? 'Descripción' : 'Variable';
    name.focus();
    name.select();
  };

  const render = () => {
    if (naming) return renderNaming();
    const { what, items } = content();
    const label = document.createElement('span');
    label.className = 'dx-bb-what';
    label.textContent = what;
    bar.replaceChildren(label);
    bar.dataset.kind = what;
    for (const item of items) {
      if (item === 'sep') {
        const sep = document.createElement('span');
        sep.className = 'dx-bb-sep';
        bar.appendChild(sep);
        continue;
      }
      if (item.plain) {
        const words = document.createElement('span');
        words.className = 'dx-bb-words';
        words.textContent = item.label;
        words.title = item.title;
        bar.appendChild(words);
        continue;
      }
      const node = document.createElement('button');
      node.type = 'button';
      node.className = `${item.className ?? ''}${item.on ? ' dx-on' : ''}`;
      node.textContent = item.label;
      node.title = item.title;
      node.setAttribute('aria-label', item.title);
      if (item.on !== undefined) node.setAttribute('aria-pressed', String(item.on));
      if (item.css) node.style.cssText = item.css;
      node.disabled = !!item.disabled;
      node.tabIndex = -1;
      node.addEventListener('click', (e) => {
        // From the keyboard, the keyboard stays on the bar for the next button; a click gives it back to the text.
        const keyed = e.detail === 0 && bar.contains(document.activeElement);
        const at = buttons().indexOf(node);
        acting = true;
        try {
          item.run();
        } finally {
          acting = false;
        }
        if (!naming && !(keyed && !item.closes)) editor.focus();
        if (item.closes) close();
        else if (isOpen) {
          refresh();
          if (keyed && !naming) buttons()[Math.min(at, buttons().length - 1)]?.focus();
        }
      });
      bar.appendChild(node);
    }
    const first = buttons()[0];
    if (first) first.tabIndex = 0;
  };
  const buttons = () => [...bar.querySelectorAll<HTMLButtonElement>(':scope > button:not(:disabled)')];
  // Along the bar with the arrows, as along the toolbar; the one with the keyboard is the one Tab comes back to.
  arrowsThrough(bar, buttons, { next: ['ArrowRight', 'ArrowDown'], prev: ['ArrowLeft', 'ArrowUp'] });
  bar.addEventListener('focusin', (e) => {
    if (!(e.target instanceof HTMLButtonElement) || e.target.parentElement !== bar) return;
    for (const other of buttons()) other.tabIndex = other === e.target ? 0 : -1;
  });
  const refresh = () => {
    render();
    place();
  };

  const open = () => {
    naming = false;
    isOpen = true;
    applyTheme(bar, editor.theme);
    bar.classList.add('dx-bb-open');
    refresh();
    // Shown by the key, it says what it is about and how to reach it: the keyboard stays in the text.
    if (inEditor() && !editor.byTouch) editor.announce(`${t('bubble.label')}: ${bar.dataset.kind ?? ''}. ${t('a11y.bubbleHint')}`);
  };
  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    const had = bar.contains(document.activeElement);
    bar.classList.remove('dx-bb-open');
    // The name of a variable was being typed in it, or its buttons had the keyboard: it goes back to the document.
    if (naming || had) editor.focus();
    naming = false;
  };
  const toggle = () => (isOpen ? close() : open());

  // Its buttons act on the selection, which must stay where it is.
  bar.addEventListener('mousedown', (e) => {
    if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
  });

  // --- The tap ------------------------------------------------------------------

  const inEditor = () => editor.element.contains(document.activeElement);
  /** When the key went down with nothing else, until something else happens. */
  let armed = 0;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === TAP_KEY && !e.repeat && !e.altKey && !e.shiftKey && (MAC ? !e.ctrlKey : !e.metaKey) && inEditor()) {
      armed = Date.now();
      return;
    }
    armed = 0;
    if (!isOpen || e.key === TAP_KEY) return;
    // Tab from the text goes to its buttons.
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && inEditor() && !naming) {
      const to = buttons().find((node) => node.tabIndex === 0) ?? buttons()[0];
      if (to) {
        e.preventDefault();
        e.stopPropagation();
        to.focus();
        return;
      }
    }
    // Tab from its buttons goes back to the text, and the bar goes with it.
    if (e.key === 'Tab' && !naming && bar.contains(e.target as Node)) {
      e.preventDefault();
      close();
      return;
    }
    // What is typed in its own field, and what moves along its buttons, is for it.
    if (bar.contains(e.target as Node) && e.key !== 'Escape') return;
    // Escape only puts the bar away; any other key goes on to do what it does, without it.
    if (e.key === 'Escape') e.stopPropagation();
    close();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key !== TAP_KEY) return;
    const tapped = armed && Date.now() - armed < TAP_MS;
    armed = 0;
    if (tapped) toggle();
  };
  const disarm = () => (armed = 0);
  const onMouseDown = (e: MouseEvent) => {
    armed = 0;
    if (isOpen && !bar.contains(e.target as Node)) close();
  };
  const onMove = () => {
    if (isOpen) place();
  };
  // A finger anywhere else puts it away, as a click does; one that selects something brings it up.
  const onTouchStart = (e: TouchEvent) => {
    if (isOpen && !bar.contains(e.target as Node)) close();
  };
  document.addEventListener('touchstart', onTouchStart, true);
  editor.onTouchSelect = () => open();
  editor.onSpellingMenu = () => open();
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('blur', disarm);
  window.addEventListener('resize', onMove);
  document.addEventListener('scroll', onMove, true);
  // A change it did not make is the selection going elsewhere, or the document changing under it.
  const unsubscribe = editor.onChange(() => {
    if (isOpen && !acting) close();
  });
  // On the page, or in what is shown full screen when that holds the document: outside it nothing shows.
  const mount = () => {
    const full = document.fullscreenElement;
    const host = full && full !== document.documentElement && full.contains(editor.element) ? full : document.body;
    if (bar.parentElement !== host) host.append(bar, picker);
  };
  mount();
  document.addEventListener('fullscreenchange', mount);

  return {
    open,
    close,
    toggle,
    ask(what) {
      open();
      naming = what;
      refresh();
    },
    destroy() {
      unsubscribe();
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('touchstart', onTouchStart, true);
      editor.onTouchSelect = undefined;
      editor.onSpellingMenu = undefined;
      window.removeEventListener('blur', disarm);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('scroll', onMove, true);
      document.removeEventListener('fullscreenchange', mount);
      bar.remove();
      picker.remove();
    },
  };
}
