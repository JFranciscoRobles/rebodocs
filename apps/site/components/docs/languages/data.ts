// What the page "Languages" says that is data: a language started on the page,
// the words that can be changed in the demo, and the functions of the language,
// each checked in packages/editor/src/i18n.ts and packages/react/src/mount.ts.

import type { MessageKey, Messages } from '@rebodocs/react';

/**
 * French, the way a translation is the day it is started: what shows in the
 * status bar, the styles and the File menu. "Print…" and the rest are left
 * out on purpose, to be seen in English.
 */
export const FRENCH: Partial<Messages> = {
  'locale.name': 'Français',
  language: 'Langue',
  'status.page': 'Page {page} sur {pages}',
  'status.word': 'mot',
  'status.words': 'mots',
  'status.char': 'caractère',
  'status.chars': 'caractères',
  'style.normal': 'Normal',
  'style.title': 'Titre',
  'style.subtitle': 'Sous-titre',
  'style.heading1': 'Titre 1',
  'style.heading2': 'Titre 2',
  'style.heading3': 'Titre 3',
  'menu.file': 'Fichier',
  'menu.open': 'Ouvrir un document…',
  'menu.save': 'Enregistrer',
  'menu.saveAs': 'Enregistrer sous…',
  'menu.export': 'Exporter',
  'toolbar.undo': 'Annuler',
  'toolbar.redo': 'Rétablir',
  'mark.bold': 'Gras',
  'mark.italic': 'Italique',
  'mark.underline': 'Souligné',
};

/** Words to change in the demo: ones that are on screen without opening anything, or one click away. */
export const WORDS: { key: MessageKey; where: string }[] = [
  { key: 'status.page', where: 'the status bar' },
  { key: 'style.normal', where: 'the style box' },
  { key: 'menu.file', where: 'the menu (☰)' },
  { key: 'menu.saveAs', where: 'the menu (☰)' },
];

/** The languages of the demo: the two the interface comes with, and the one started above. */
export const DEMO_LOCALES: { code: string; name: string; note: string }[] = [
  { code: 'es', name: 'Español', note: 'as it comes' },
  { code: 'en', name: 'English', note: 'as it comes' },
  { code: 'fr', name: 'Français', note: 'started, partly translated' },
];

/** What a person sees, and in which language. */
export const WHAT: { title: string; answer: string; text: string; color: 'blue' | 'green' | 'purple' | 'pink' | 'yellow' | 'orange' }[] = [
  {
    title: 'The interface',
    answer: 'All of it',
    color: 'blue',
    text: 'The toolbar, the menus, the panels, the dialogs, the status bar, the titles of the buttons and what a screen reader is told. Each part carries its language (lang), for a screen reader to read it with the right voice.',
  },
  {
    title: 'The document',
    answer: 'Nothing',
    color: 'pink',
    text: 'It is the person’s text. Opening a Spanish contract in an English interface leaves it in Spanish. The DOCX says the language its text is in, for spelling in Word: the language prop, or the interface’s, with the browser’s region.',
  },
  {
    title: 'What the editor writes',
    answer: 'At the time',
    color: 'purple',
    text: '“Page 1 of 3” in a page number and the titles of a signature block are written in the language of the interface when they are inserted. After that they are text of the document, and stay.',
  },
  {
    title: 'Standard styles',
    answer: 'Shown translated',
    color: 'green',
    text: 'Normal, Title and Heading 1–3 are shown as Título 1 or Heading 1; a style of the document’s own keeps its name. The file keeps the style as Word knows it.',
  },
  {
    title: 'Dates and numbers',
    answer: 'In the language',
    color: 'yellow',
    text: 'The dates of versions and notes, the counts in the status bar and the find bar, the centimetres of the ruler and the line spacing: 1,15 in Spanish, 1.15 in English.',
  },
  {
    title: 'The letters on the buttons',
    answer: 'Texts too',
    color: 'orange',
    text: 'Bold, italic, underline and strikethrough are drawn as letters: B I U S in English, N K S T in Spanish. They are mark.bold.letter and the like, to translate as the rest.',
  },
];

/** Every function of the languages, as @rebodocs/react exports them. */
export const FUNCTIONS: { name: string; signature: string; returns: string; text: string }[] = [
  { name: 't', signature: 't(key: MessageKey, values?: Record<string, string | number>)', returns: 'string', text: 'The text in the language of the interface, each {name} replaced by its value. A name with no value stays as it is written.' },
  { name: 'getLocale', signature: 'getLocale()', returns: 'string', text: 'The language of the interface: \'es\' until another is set.' },
  {
    name: 'setLocale',
    signature: 'setLocale(locale: string)',
    returns: 'nothing',
    text: 'Sets the language: a code, one added, or a browser tag. One it does not speak gives English. Tells whoever listens, and nobody when it was already that one.',
  },
  { name: 'onLocaleChange', signature: 'onLocaleChange(listener: () => void)', returns: '() => void', text: 'Calls listener whenever the language changes. Returns how to stop.' },
  {
    name: 'addLocale',
    signature: 'addLocale(locale: string, texts: Texts)',
    returns: 'nothing',
    text: 'Adds a language, or changes texts of one there is. What it leaves out is said in English. When it is the language being shown, tells whoever listens.',
  },
  {
    name: 'plural',
    signature: 'plural(key: MessageKey, n: number, values?: Record<string, string | number>)',
    returns: 'string',
    text: 'The text said of n things: the form the language gives for the plural category of n, or else the text of one when that category is “one”, or else the text of the key.',
  },
  { name: 'messages', signature: 'messages(locale?: string)', returns: 'Messages', text: 'Every text of a language, by key: English when none is given. A copy; changing it changes nothing.' },
  { name: 'locales', signature: 'locales()', returns: '{ code: string; name: string }[]', text: 'The languages there are, each with its name in itself: what the menu lists.' },
];
