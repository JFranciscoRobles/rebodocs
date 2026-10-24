// The menu a "/" brings up: typed at the start of a paragraph, or after a
// space, it offers what can be put there or made of the paragraph, and what
// is typed after it narrows the list. Enter or a click does the one chosen in
// place of the "/" and what was typed after it; Escape leaves them as text.
// The list itself is the one of typeahead.ts.

import { paragraphText } from '@rebodocs/core/internal';
import type { Bubble } from './bubble';
import type { Editor } from './editor';
import { type MessageKey, t } from './i18n';
import { createImagePicker } from './imagegrid';
import { clipFromHtml } from './paste';
import { type TypeaheadItem, createTypeahead } from './typeahead';

export interface SlashMenu {
  close(): void;
  destroy(): void;
}

/** The commands the menu comes with, by the name they are left out or kept by. */
export type SlashCommandId =
  | 'normal'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullets'
  | 'numbers'
  | 'table'
  | 'image'
  | 'pageBreak'
  | 'toc'
  | 'textBox'
  | 'footnote'
  | 'variable'
  | 'signatures'
  | 'note'
  | 'field';

/** A command of the application's own. */
export interface SlashCommand {
  /** Its name in the menu, and what finds it first. */
  label: string;
  /** What it does, under its name; it finds it too. */
  title?: string;
  /** The heading it goes under; "More" when not given. Commands of one heading go together, after those of the menu. */
  group?: string;
  /** Other words it is found by, apart by spaces. */
  keywords?: string;
  /** What it puts where the "/" was: text, a paragraph for each line. */
  text?: string;
  /** Or HTML, with its formatting, as pasting it would put it in. */
  html?: string;
  /** Or what it does, once the "/" and what was typed after it are gone. */
  run?: (editor: Editor) => void;
  /** Whether it is offered where the caret is; always, without it. */
  when?: (editor: Editor) => boolean;
}

/** What the menu offers, past the editor: what a whole interface takes as `features.slash`. */
export interface SlashMenuSettings {
  /** The commands the menu comes with: all of them (true, as it comes), none (false), or only these. */
  builtIns?: boolean | SlashCommandId[];
  /** The application's own, after those; a function is asked each time the menu opens, for a list that changes. */
  commands?: SlashCommand[] | (() => SlashCommand[]);
}

export interface SlashMenuOptions extends SlashMenuSettings {
  /** What asks for the name of a variable and the text of a note: without it, neither is offered. */
  ask?: Bubble['ask'];
  /** A blank that may be changed while editing is restricted, put in from the menu. */
  forms?: boolean;
}

/** Longer than this after the "/", with nothing found, and it was not a command. */
const MAX_QUERY = 24;

/** The word before `end` in `text`, and where it starts; undefined when there is none. */
const wordBefore = (text: string, end: number): { from: number; to: number } | undefined => {
  const found = /([\p{L}\p{N}_]+)[^\p{L}\p{N}_]*$/u.exec(text.slice(0, end));
  return found ? { from: found.index, to: found.index + found[1].length } : undefined;
};

export function createSlashMenu(editor: Editor, options: SlashMenuOptions = {}): SlashMenu {
  const picker = createImagePicker(editor);
  const styleId = (level: number) => editor.styles.find((style) => style.outlineLevel === level)?.id;
  const paragraph = (para: number) => paragraphText(editor.text.paragraphs[para]);

  /** Those the menu comes with that can be done where the "/" is: what cannot, is not offered. */
  const builtIns = (before: string): TypeaheadItem[] => {
    const kept = options.builtIns ?? true;
    if (kept === false) return [];
    const body = editor.area === 'body';
    const outside = !editor.inTable && editor.canEditTables;
    const [text, insert, template] = [t('slash.text'), t('slash.insert'), t('slash.template')];
    const list: [SlashCommandId, TypeaheadItem | false][] = [];
    const normal = editor.styles[0]?.id;
    if (normal) list.push(['normal', { group: text, label: t('style.normal'), title: t('slash.normalTitle'), also: 'p', run: () => editor.setParagraphStyle(normal) }]);
    for (const level of [1, 2, 3] as const) {
      const id = styleId(level);
      if (id)
        list.push([
          `heading${level}`,
          { group: text, label: t(`style.heading${level}` as MessageKey), title: t('slash.headingTitle', { n: level }), also: `h${level}`, run: () => editor.setParagraphStyle(id) },
        ]);
    }
    list.push(
      ['bullets', { group: text, label: t('list.bullet'), title: t('slash.bulletsTitle'), also: 'ul', run: () => editor.toggleList('bullet') }],
      ['numbers', { group: text, label: t('list.number'), title: t('slash.numbersTitle'), also: 'ol', run: () => editor.toggleList('number') }],
      ['table', outside && { group: insert, label: t('table.word'), title: t('bubble.tableTitle'), run: () => editor.insertTable(3, 3) }],
      ['image', { group: insert, label: t('bubble.image'), title: t('bubble.imageTitle'), run: () => picker.click() }],
      ['pageBreak', !editor.inTable && body && { group: insert, label: t('bubble.pageBreak'), title: t('bubble.pageBreakTitle'), run: () => editor.insertPageBreak() }],
      ['toc', outside && body && !editor.hasToc && { group: insert, label: t('toc.insert'), title: t('toc.insertTitle'), also: 'toc', run: () => editor.insertToc() }],
      ['textBox', body && { group: insert, label: t('insert.textBox'), title: t('slash.textBoxTitle'), run: () => void editor.insertTextBox() }],
      ['footnote', body && { group: insert, label: t('insert.footnote'), title: t('slash.footnoteTitle'), run: () => editor.insertFootnote() }],
      ['variable', !!options.ask && { group: template, label: 'Variable', title: t('bubble.variableTitle'), also: '{{', run: () => options.ask?.('variable') }],
      ['signatures', outside && { group: template, label: t('bubble.signatures'), title: t('bubble.signaturesTitle'), run: () => editor.insertSignatures() }],
      ['note', !!options.ask && body && !!wordBefore(before, before.length) && { group: template, label: t('note.word'), title: t('slash.noteTitle'), run: () => noteOnWordBefore() }],
      ['field', !!options.forms && body && !editor.restricted && { group: template, label: t('form.zone'), title: t('form.fieldTitle'), run: () => void editor.makeEditable() }],
    );
    return list.filter(([id, one]) => one && (kept === true || kept.includes(id))).map(([, one]) => one as TypeaheadItem);
  };

  /** The application's own that are offered where the caret is, those of one heading together. */
  const own = (): TypeaheadItem[] => {
    const given = typeof options.commands === 'function' ? options.commands() : (options.commands ?? []);
    const more = t('slash.more');
    const list = given
      .filter((one) => !one.when || one.when(editor))
      .map((one): TypeaheadItem => ({ group: one.group || more, label: one.label, title: one.title ?? '', also: one.keywords, run: () => runOwn(one) }));
    const groups = [...new Set(list.map((one) => one.group))];
    return groups.flatMap((group) => list.filter((one) => one.group === group));
  };

  const runOwn = (command: SlashCommand) => {
    if (command.run) return command.run(editor);
    if (command.html !== undefined) {
      const clip = clipFromHtml(command.html);
      if (clip) editor.insertClip(clip);
    } else if (command.text) editor.insertText(command.text);
  };

  /** A note is on words: it goes on the one before where the "/" was. */
  const noteOnWordBefore = () => {
    const { para, offset } = editor.selection.focus;
    const word = wordBefore(paragraph(para), offset);
    if (!word) return;
    editor.setSelection({ para, offset: word.from }, { para, offset: word.to });
    options.ask?.('note');
  };

  const list = createTypeahead(editor, {
    trigger: '/',
    // At the start of the paragraph or after a space: not in 12/05, y/o or an address.
    opensAfter: (before) => !before || /\s$/.test(before),
    items: (before) => [...builtIns(before), ...own()],
    // A space with nothing found, or a long word, is text that started with a "/".
    keeps: (query, found) => found > 0 || !(/\s$/.test(query) || query.length > MAX_QUERY),
    label: t('slash.label'),
    hint: t('slash.hint'),
  });
  document.body.appendChild(picker);

  return {
    close: list.close,
    destroy() {
      list.destroy();
      picker.remove();
    },
  };
}
