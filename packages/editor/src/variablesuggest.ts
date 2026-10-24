// The list "{{" brings up: the variables a template may have, those the
// application says it fills and those the document already uses, narrowed by
// what is typed after it. The one chosen is written whole, {{name}}, so its
// name is not mistyped and left unfilled. A name that is not there yet can be
// written too. The list itself is the one of typeahead.ts.

import { isVariableName } from '@rebodocs/core/internal';
import type { Editor } from './editor';
import { t } from './i18n';
import { type TypeaheadItem, createTypeahead } from './typeahead';

/** A variable the application fills: its name, and what to say of it. */
export interface VariableInfo {
  name: string;
  /** What it is, under its name. */
  title?: string;
  /** A value it may have, shown when there is no title: "Ana López". */
  example?: string;
}

/** What the list offers: what a whole interface takes as `features.variableSuggestions`. */
export interface VariableSuggestSettings {
  /** The variables the application fills, the first in the list; a function is asked each time the list opens. */
  variables?: (string | VariableInfo)[] | (() => (string | VariableInfo)[]);
  /** The variables the document already uses, after those. On unless false. */
  fromDocument?: boolean;
  /** A name typed that is not in the list may be written as a new variable. On unless false. */
  allowNew?: boolean;
}

export interface VariableSuggest {
  close(): void;
  destroy(): void;
}

/** Longer than this after the "{{" and it is not the name of a variable. */
const MAX_NAME = 60;

export function createVariableSuggest(editor: Editor, settings: VariableSuggestSettings = {}): VariableSuggest {
  const known = (): VariableInfo[] => {
    const given = typeof settings.variables === 'function' ? settings.variables() : (settings.variables ?? []);
    const list = given.map((one) => (typeof one === 'string' ? { name: one } : one)).filter((one) => isVariableName(one.name));
    const names = new Set(list.map((one) => one.name));
    if (settings.fromDocument !== false) for (const name of editor.variables) if (!names.has(name)) list.push({ name, title: t('suggest.inDocument') });
    return list;
  };
  const item = (info: VariableInfo): TypeaheadItem => ({
    label: info.name,
    title: info.title ?? (info.example ? t('suggest.example', { value: info.example }) : ''),
    run: () => editor.insertVariable(info.name),
  });

  const list = createTypeahead(editor, {
    trigger: '{{',
    items: () => known().map(item),
    more: (query, found) => {
      const name = query.trim();
      if (settings.allowNew === false || !isVariableName(name) || found.some((one) => one.label === name)) return [];
      return [{ label: `{{${name}}}`, title: t('suggest.new'), run: () => editor.insertVariable(name) }];
    },
    // What a name has, and nothing else: "}" or another character, and it was written by hand.
    keeps: (query, found) => query.length <= MAX_NAME && (query.trim() === '' || isVariableName(query.trim())) && (found > 0 || settings.allowNew !== false),
    empty: (query) => (query.trim() ? t('slash.none') : t('suggest.type')),
    label: t('suggest.label'),
    hint: t('slash.hint'),
  });

  return { close: list.close, destroy: list.destroy };
}
