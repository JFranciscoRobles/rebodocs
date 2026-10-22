// The thirteen hooks of @rebodocs/react, as the explorer shows them. Plain
// data: what runs is in `examples/`, one file each, and the page colours the code on the server.

export type HookCategory = 'Document' | 'Writing' | 'Page' | 'Interface';
export const HOOK_CATEGORIES: HookCategory[] = ['Document', 'Writing', 'Page', 'Interface'];

/** A value on the dark panel, coloured by what it is. */
export interface LiveValue {
  key: string;
  value: string;
  kind: 'string' | 'number' | 'boolean' | 'call' | 'empty' | 'error';
  /** Not something the hook gives: what the demo did with it, shown apart. */
  demo?: boolean;
}

export interface HookDoc {
  name: string;
  /** How it is called, when it takes something; `${name}()` otherwise. */
  sig?: string;
  category: HookCategory;
  short: string;
  description: string;
  returns: { key: string; description: string }[];
  /** The code beside it; without it, what it returns taken apart. */
  code?: string;
  note?: string;
}

export const HOOKS: HookDoc[] = [
  {
    name: 'useDocs',
    category: 'Document',
    short: 'State, commands, actions',
    description: 'What every piece of an interface starts from: what to show, what buttons call, and the document as a whole.',
    returns: [
      { key: 'ready', description: 'False on the server and until the pages are on the page' },
      { key: 'state', description: 'What to show, as plain values — neutral until ready' },
      { key: 'commands', description: 'What buttons call: toggleMark(mark), setRunProps(props)…' },
      { key: 'docs', description: 'save(), download(), exportDocx(), openFile(), share(), setName()…' },
      { key: 'editor', description: 'The Editor itself — exportPdf(), exportMarkdown()…' },
    ],
    note: 'Colours are hex without #, sizes are points. Each command gives the keyboard back to the document.',
  },
  {
    name: 'useDocsValue',
    sig: 'useDocsValue(select, fallback)',
    category: 'Document',
    short: 'Read any value',
    description: 'Anything of the document that state does not carry, kept up to date. Your component is drawn again only when what select gives is different.',
    returns: [{ key: 'value', description: 'Whatever select gives, compared as JSON' }],
    code: `const pages = useDocsValue((editor) => editor.pageCount, 1);
const hasToc = useDocsValue((editor) => editor.hasToc, false);
const cell = useDocsValue((editor) => editor.activeCellProps() ?? null, null);`,
    note: 'Give back plain data, and null where the editor says undefined. The first fallback given is kept.',
  },
  {
    name: 'useDocsCount',
    category: 'Document',
    short: 'Words and characters',
    description: 'How long the document is, and the selection. The whole is counted again only when the document changes.',
    returns: [
      { key: 'words', description: 'Words in the document' },
      { key: 'characters', description: 'Characters in the document' },
      { key: 'selected', description: 'The same for the selection, or undefined' },
    ],
  },
  {
    name: 'useDocsFind',
    category: 'Writing',
    short: 'Find and replace',
    description: 'Everything a find-and-replace bar of your own needs. The keyboard stays in your field while it searches.',
    returns: [
      { key: 'query · setQuery(text)', description: 'What is looked for' },
      { key: 'options · setOptions(o)', description: '{ matchCase, wholeWord }' },
      { key: 'count · index', description: 'How many places, and which one is selected, from 1' },
      { key: 'next() · previous()', description: 'Go to another' },
      { key: 'replace(text) · replaceAll(text)', description: 'The one selected, or all as one step to undo' },
      { key: 'close()', description: 'Stops and gives the keyboard back' },
    ],
    note: 'query and options are kept by the component that calls it: call it once, in your find bar, and pass it down. count and index are the document’s. Open the bar from ⌘F with onFindKey on the provider.',
  },
  {
    name: 'useDocsLink',
    category: 'Writing',
    short: 'Link at the caret',
    description: 'The link the caret is in, and making one.',
    returns: [
      { key: 'active', description: '{ href, text } of the link at the caret' },
      { key: 'possible', description: 'Whether there is something to link' },
      { key: 'set(address)', description: 'Links the selection; false for what is not an address' },
      { key: 'remove() · open()', description: 'Unlink it; open it in another tab' },
    ],
  },
  {
    name: 'useDocsNotes',
    category: 'Writing',
    short: 'Comments',
    description: 'The notes of the document (Word’s comments), to show them your way.',
    returns: [
      { key: 'notes', description: 'Each { id, author, date, text, excerpt, color }' },
      { key: 'active', description: 'The id of the note the caret is in' },
      { key: 'add(text)', description: 'Puts one on the selection; gives its id' },
      { key: 'setText(id, text) · setColor(id, color) · remove(id)', description: 'Change one' },
      { key: 'select(id)', description: 'Selects its text and brings it into view' },
    ],
    note: 'NOTE_COLORS is exported too. commands.setShowNotes(true) shows notes beside the page.',
  },
  {
    name: 'useDocsVariables',
    category: 'Writing',
    short: 'Template variables',
    description: 'The variables of a template — {{client}} in the text — with their formats and a preview of each value.',
    returns: [
      { key: 'names · active', description: 'Each variable once, and the one at the caret' },
      { key: 'insert(name) · select(name)', description: 'Put one at the caret; go to where one is' },
      { key: 'fill(values)', description: 'Fill them all, as one step to undo' },
      { key: 'blocks', description: 'The {{#name}} … {{/name}} blocks: each with its name and kind' },
      { key: 'formats · uses', description: 'By name: its formats, and how many times it is used' },
      { key: 'setFormat(name, id, on, arg?)', description: 'date, number, currency, upper, bold…' },
      { key: 'preview(name, value)', description: '{ text, bad }: how the value would come out' },
    ],
  },
  {
    name: 'useDocsStyles',
    category: 'Writing',
    short: 'Paragraph styles',
    description: 'The paragraph styles of the document — Normal, Title, Heading 1… — and the one of the selection.',
    returns: [
      { key: 'styles', description: 'Each { id, name }, the default first' },
      { key: 'active', description: 'The style of the selection; undefined when mixed' },
      { key: 'set(id)', description: 'Gives the paragraphs a style' },
    ],
  },
  {
    name: 'useDocsOutline',
    category: 'Writing',
    short: 'Title and headings',
    description: 'The title and the headings of the document, for a panel to move around in.',
    returns: [
      { key: 'items', description: 'Each { para, level, text }; level 0 is the title' },
      { key: 'active', description: 'Which one the caret is under, or -1' },
      { key: 'goTo(item)', description: 'Puts the caret there' },
      { key: 'move(item, before?)', description: 'Moves a heading with everything under it' },
    ],
    note: 'commands.insertToc() and commands.updateToc() handle the table of contents.',
  },
  {
    name: 'useDocsPage',
    category: 'Page',
    short: 'Page setup and letterhead',
    description: 'The page: its size and margins, its sections, header and footer, its number and its letterhead.',
    returns: [
      { key: 'page · set(patch, everywhere?)', description: 'Width, height and margins, in points' },
      { key: 'sections · section', description: 'How many, and which one is being edited' },
      { key: 'ownHeaders · setOwnHeaders(on)', description: 'A header and footer for this section alone' },
      { key: 'numbering · setNumbering(n)', description: '{ place, align, format }, or undefined' },
      { key: 'firstPageDifferent · setFirstPageDifferent(on)', description: 'Another header for the first page' },
      { key: 'letterhead · setLetterhead(file, fit?)', description: 'Whether there is one; set it from a PNG or JPG' },
      { key: 'fitLetterheadMargins() · removeLetterhead() · letterheadFile()', description: 'Margins that clear it; take it away; the picture it is, to download' },
    ],
    note: 'Letter is 612 × 792 pt, A4 is 595.3 × 841.9 pt.',
  },
  {
    name: 'useDocsSelectionBox',
    category: 'Interface',
    short: 'Where the selection is',
    description: 'Where the selection is in the window, to put something of your own beside it. It follows scrolling and resizing.',
    returns: [{ key: 'top · left · width · height', description: 'In pixels; undefined while there is none' }],
    code: `const box = useDocsSelectionBox();
if (!box) return null;
// put your popover at box.top - 44, box.left`,
    note: 'onMouseDown={(e) => e.preventDefault()} on your bar keeps a press from taking the selection away.',
  },
  {
    name: 'useDocsBubble',
    category: 'Interface',
    short: 'Selection bar',
    description: 'The bar beside the selection that the included interface has. For a document made with <DocsProvider bubble>; undefined without it.',
    returns: [
      { key: 'open() · close() · toggle()', description: 'Show it and hide it' },
      { key: 'ask(kind)', description: "'variable', 'note' or 'link'" },
    ],
    code: `const bubble = useDocsBubble();   // undefined without bubble
bubble?.ask('note');`,
    note: 'It comes with a look, and is put in document.body: give it your colours with the --dx-ui-… variables there (see Styling).',
  },
  {
    name: 'useDocsResponsive',
    sig: 'useDocsResponsive(600)',
    category: 'Interface',
    short: 'Phones and narrow windows',
    description: 'What a narrow window asks of an interface: below the width given, the pages fit the surface.',
    returns: [
      { key: 'narrow', description: 'true while the surface is under the width given' },
      { key: 'keyboard', description: 'Pixels the on-screen keyboard covers' },
    ],
    note: 'Decide your layout with a media query, not with narrow: otherwise each change undoes the other.',
  },
];

/** The code beside a hook: its own, or what it returns taken apart. */
export function codeOf(hook: HookDoc): string {
  if (hook.code) return hook.code;
  const keys = hook.returns.flatMap((r) => r.key.split(' · ').map((key) => key.replace(/\(.*\)/, '')));
  return `const { ${keys.join(', ')} } = ${hook.sig ?? `${hook.name}()`};`;
}

/** Where a hook is on the page: the explorer opens it from this. */
export const hookHash = (name: string) => `hooks-${name}`;
