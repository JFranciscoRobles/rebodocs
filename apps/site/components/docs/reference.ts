// What the page "Components and hooks" says about the components: plain data,
// read by the page on the server (to colour the code), by its parts in the
// browser, and by the search box.

/** Who puts a part of the editor on the screen. */
export type Owner = 'rebodocs' | 'yours' | 'hidden';
export type Part = 'toolbar' | 'ruler' | 'pages' | 'panel' | 'status';

export interface Entry {
  want: string;
  use: string;
  /** Each part: who puts it, and, for Rebodocs, with what. */
  parts: Record<Part, [Owner, string?]>;
  code: string;
}

const all = (label: string): Entry['parts'] => ({
  toolbar: ['rebodocs', label],
  ruler: ['rebodocs', label],
  pages: ['rebodocs', label],
  panel: ['rebodocs', label],
  status: ['rebodocs', label],
});

/** "Which one do I need?", in order. */
export const ENTRIES: Entry[] = [
  {
    want: 'The whole editor, as it comes',
    use: '<DocsEditor />',
    parts: all('DocsEditor'),
    code: `'use client';
import { DocsEditor } from '@rebodocs/react';

export function Receipt({ file }: { file: Uint8Array }) {
  return (
    <div className="h-screen">
      <DocsEditor docx={file} name="receipt.docx" onSave={save} />
    </div>
  );
}`,
  },
  {
    want: 'The pages, with my own interface',
    use: '<DocsProvider> + <DocsSurface> + hooks',
    parts: { toolbar: ['yours'], ruler: ['hidden'], pages: ['rebodocs', 'DocsSurface'], panel: ['yours'], status: ['yours'] },
    code: `import { DocsProvider, DocsSurface } from '@rebodocs/react';

<DocsProvider docx={file} name="receipt.docx" onSave={save}>
  <MyToolbar />        {/* useDocs() */}
  <DocsSurface className="min-h-0 flex-1" />
  <MyStatusBar />      {/* useDocsCount() */}
</DocsProvider>`,
  },
  {
    want: 'The ruler, in my own interface',
    use: '<DocsRuler />',
    parts: { toolbar: ['yours'], ruler: ['rebodocs', 'DocsRuler'], pages: ['rebodocs', 'DocsSurface'], panel: ['yours'], status: ['yours'] },
    code: `<DocsProvider docx={file} onSave={save}>
  <MyToolbar />
  <DocsRuler />        {/* as wide as the pages */}
  <DocsSurface className="min-h-0 flex-1" />
</DocsProvider>`,
  },
  {
    want: 'The editor, without React',
    use: 'mountDocs · createDocs',
    parts: { ...all('mountDocs'), pages: ['rebodocs', 'mountDocs · createDocs'] },
    code: `import { mountDocs } from '@rebodocs/react/mount';

// the whole editor, no framework
const docs = mountDocs(element, { docx: bytes, locale: 'en', onSave });

// later
docs.destroy();`,
  },
];

export interface ComponentDoc {
  name: 'DocsEditor' | 'DocsProvider' | 'DocsSurface' | 'DocsRuler';
  summary: string;
  facts: string[];
  tips?: string[];
  /** What it is used like: one block or more, each with its language. */
  example: [lang: 'tsx' | 'css', code: string][];
}

export const COMPONENTS: ComponentDoc[] = [
  {
    name: 'DocsEditor',
    summary: 'The whole editor — toolbar, ruler, side panel, pages and status bar.',
    facts: ['Fills its container', 'Needs a height', 'Takes DocsProvider props'],
    example: [
      [
        'tsx',
        `'use client';
import { useRef } from 'react';
import { DocsEditor, type DocsHandle } from '@rebodocs/react';

export function Contract({ file }: { file: Uint8Array }) {
  const editor = useRef<DocsHandle>(undefined);
  // The handle, for what your own buttons do with the document.
  const send = () => upload(editor.current!.exportDocx(), 'contract.docx');
  return (
    <div className="flex h-screen flex-col">
      <button onClick={send}>Send for signature</button>
      <div className="min-h-0 flex-1">
        <DocsEditor ref={editor} docx={file} name="contract.docx" locale="en" onReady={(handle) => handle?.focus()} />
      </div>
    </div>
  );
}`,
      ],
    ],
  },
  {
    name: 'DocsProvider',
    summary: 'Holds one document for its children. It draws nothing.',
    facts: ['Wrap your own UI with it', 'Keep docx stable', 'Latest callback wins'],
    example: [
      [
        'tsx',
        `// State a key must reach lives outside the provider, or in a child of it.
function Editor({ file }: { file: Uint8Array }) {
  const [finding, setFinding] = useState(false);
  return (
    <DocsProvider docx={file} name="contract.docx" onSave={upload} onFindKey={() => setFinding(true)}>
      <MyToolbar />
      {finding && <FindBar onClose={() => setFinding(false)} />}
      <DocsSurface className="h-full" />
    </DocsProvider>
  );
}`,
      ],
    ],
  },
  {
    name: 'DocsSurface',
    summary: 'The pages of the document. Exactly one per provider.',
    facts: ['Scrolls itself', 'Needs a height', 'className · style'],
    tips: [
      'Give it a height: h-full in something that has one, or flex-1 min-h-0 inside a column.',
      'Set the variables on the surface or on anything above it, in CSS or in style.',
      'The pages themselves are not for styling: where each letter goes is worked out, not left to the browser.',
    ],
    example: [
      [
        'tsx',
        `<DocsSurface
  className="min-h-0 flex-1"
  style={{ '--dx-canvas': '#f6eedf', '--dx-selection': '#fbe3a6', '--dx-caret': '#b07a00' } as CSSProperties}
/>`,
      ],
      [
        'css',
        `/* Or in your CSS, on the surface or on anything above it */
.editor {
  --dx-canvas: #f6eedf;
  --dx-page-shadow: 0 2px 10px rgb(120 80 20 / 0.16);
}`,
      ],
    ],
  },
  {
    name: 'DocsRuler',
    summary: 'The ruler: the page in centimetres, with margins and indents you can drag.',
    facts: ['Drawn on a canvas', 'className · style', 'Leave it out on narrow windows'],
    tips: [
      'Put it right above the surface, as wide as it: it lines itself up with the page under it.',
      'After setLocale, give it a key that changes with the language to have its markers in the new one.',
      'A narrow window has no room for it; leave it out there.',
    ],
    example: [
      [
        'tsx',
        `function Pages() {
  const { narrow } = useDocsResponsive();
  const locale = useSyncExternalStore(onLocaleChange, getLocale);
  return (
    <div className="flex h-full flex-col" style={{ '--dx-ruler': '#fffbf2', '--dx-ruler-on': '#b07a00' } as CSSProperties}>
      {!narrow && <DocsRuler key={locale} />}
      <DocsSurface className="min-h-0 flex-1" />
    </div>
  );
}`,
      ],
    ],
  },
];

export const EDITOR_ADDS = ['features', 'versions', 'className', 'style', 'onReady', 'ref'];
export const EDITOR_HANDLE = ['exportDocx()', 'save()', 'dirty', 'name', 'editor', 'collab', 'setName', 'setAuthor', 'setLocale', 'setTheme', 'setLetterhead', 'showPanel', 'hidePanel', 'focus'];

export type PropGroup = 'Data' | 'Events' | 'Keys' | 'Together';
/** How the type chip is coloured: data, a function, an object, a boolean. */
export type PropKind = 'data' | 'fn' | 'obj' | 'bool';

export interface PropDoc {
  name: string;
  type: string;
  kind: PropKind;
  group: PropGroup;
  does: string;
  /** What to watch out for, on the pill beside it. */
  warn?: string;
}

/** Every prop of DocsProvider, as `DocsHeadlessOptions` has them. */
export const PROPS: PropDoc[] = [
  { name: 'docx', type: 'Uint8Array | ArrayBuffer', kind: 'data', group: 'Data', does: 'The document to open; an empty one without it.', warn: 'Recreates the document' },
  { name: 'unsaved', type: 'boolean', kind: 'bool', group: 'Data', does: 'Whether docx has changes not saved yet, as a draft your app kept: dirty from the start.', warn: 'Read with docx' },
  { name: 'name', type: 'string', kind: 'data', group: 'Data', does: 'What the document is called, given to what is saved and exported. Follows its prop.' },
  { name: 'author', type: 'string', kind: 'data', group: 'Data', does: 'Who the person is: what their notes are signed with. Follows its prop.' },
  { name: 'locale', type: 'string', kind: 'data', group: 'Data', does: "The language of the texts the library still has: the bar beside the selection, what a screen reader is told. 'es', 'en', or one in locales; left out, the browser's, or English. The whole page's, as setLocale. Follows its prop." },
  { name: 'locales', type: 'Record<string, Texts>', kind: 'data', group: 'Data', does: 'More languages, or other words for these, as { fr: texts }.' },
  { name: 'letterhead', type: 'Blob | { bytes, type } | string | null', kind: 'obj', group: 'Data', does: 'A PNG or JPG to use as letterhead, as a file, its bytes or its address; null for none.' },
  { name: 'fonts', type: 'FontSource[]', kind: 'obj', group: 'Data', does: 'Typefaces of your own, each with its family and its file. For the whole page; one added later is loaded then.' },
  { name: 'embedFonts', type: "boolean | 'subset'", kind: 'data', group: 'Data', does: "Whether the DOCX carries the fonts of fonts its text uses, when their licence lets it: whole unless false, or cut down to the characters used with 'subset'. Follows its prop." },
  { name: 'spellcheck', type: 'SpellChecker', kind: 'data', group: 'Data', does: 'What marks the words spelled wrong, with a red wave, and offers what they could be: createSpellChecker with the dictionaries you give, or one of your own. Follows its prop.' },
  { name: 'theme', type: "'light' | 'dark' | 'auto'", kind: 'data', group: 'Data', does: "The colours of what the editor draws around the pages and the menus it shows: light as it comes, dark, or 'auto' for the system's. Follows its prop." },
  { name: 'language', type: 'string', kind: 'data', group: 'Data', does: "The language the text is in, as a tag ('es-MX'), written in the DOCX for spelling and so Word does not guess one, and the language variables are filled in (dates, numbers). Left out, the one the file says, or else the interface's with the browser's region; the person can choose another at the foot of the editor. Follows its prop." },
  { name: 'onSave', type: '(docx, name) => void', kind: 'fn', group: 'Events', does: 'Called on ⌘S and on docs.save(). Keeping the file is yours to do.', warn: 'Adding or removing it recreates the document' },
  { name: 'onChange', type: '(editor) => void', kind: 'fn', group: 'Events', does: 'Called when the document changes.' },
  { name: 'onError', type: '(message) => void', kind: 'fn', group: 'Events', does: 'Told what went wrong; an alert without it.' },
  { name: 'onLinkKey', type: '() => void', kind: 'fn', group: 'Keys', does: 'Answers ⌘K.' },
  { name: 'onFindKey', type: '(replace) => void', kind: 'fn', group: 'Keys', does: 'Answers ⌘F and ⌘H; replace is true for ⌘H.' },
  { name: 'bubble', type: 'boolean', kind: 'bool', group: 'Keys', does: 'true for the bar beside the selection. See useDocsBubble.', warn: 'Read only at creation' },
  { name: 'collab', type: '{ url, room, ticket? }', kind: 'obj', group: 'Together', does: 'The document is a shared room on your collaboration server.', warn: 'Changing the room recreates the document' },
  { name: 'onCollab', type: '(state, peers) => void', kind: 'fn', group: 'Together', does: 'Called when the connection, or who is on the document, changes.' },
];
export const PROP_GROUPS: PropGroup[] = ['Data', 'Events', 'Keys', 'Together'];

export type CssVar = [name: string, what: string];
export const SURFACE_VARS: CssVar[] = [
  ['--dx-canvas', 'Behind the pages'],
  ['--dx-page-shadow', 'The shadow of each page'],
  ['--dx-selection', 'The selection'],
  ['--dx-caret', 'The caret'],
  ['--dx-handle', 'The handles on a touch screen'],
];
export const RULER_VARS: CssVar[] = [
  ['--dx-ruler', 'Behind it'],
  ['--dx-ruler-line', 'The line under it'],
  ['--dx-ruler-margin', 'The page outside the text'],
  ['--dx-ruler-text', 'The room of the text'],
  ['--dx-ruler-ink', 'Numbers and markers'],
  ['--dx-ruler-on', 'The marker being dragged'],
];

/** The interface included: the toolbar, the menus, the side panel, the status bar, the dialogs and the bar beside the selection. */
export const UI_VARS: CssVar[] = [
  ['--dx-ui-bar', 'Behind the toolbar and the status bar'],
  ['--dx-ui-bg', 'Behind menus, the panel and dialogs'],
  ['--dx-ui-ink', 'Text'],
  ['--dx-ui-muted', 'Icons, hints and headings of groups'],
  ['--dx-ui-line', 'Borders and separators'],
  ['--dx-ui-hover', 'Under the pointer'],
  ['--dx-ui-active', 'What is on'],
  ['--dx-ui-active-line', 'The border of what is on'],
  ['--dx-ui-accent', 'Main buttons, links, focus rings'],
  ['--dx-ui-accent-hover', 'A main button under the pointer'],
  ['--dx-ui-on-accent', 'Text on the accent'],
];

/** "Default" is what the package uses when nothing is set; the others are examples. `scheme` is the colour scheme the browser draws its own controls in. */
export const THEMES: { label: string; scheme?: 'dark'; vars: Record<string, string> }[] = [
  {
    label: 'Default',
    vars: {
      '--dx-canvas': '#efede8',
      '--dx-page-shadow': '0 1px 2px rgba(47,46,43,.08), 0 10px 28px -10px rgba(47,46,43,.22)',
      '--dx-selection': 'rgba(11,87,208,.2)',
      '--dx-caret': '#000',
      '--dx-handle': '#0b57d0',
      '--dx-ruler': '#fbfaf8',
      '--dx-ruler-line': '#e6e3dc',
      '--dx-ruler-margin': '#e6e3dc',
      '--dx-ruler-text': '#fff',
      '--dx-ruler-ink': '#5f5d58',
      '--dx-ruler-on': '#0b57d0',
      '--dx-ui-bar': '#fbfaf8',
      '--dx-ui-bg': '#fff',
      '--dx-ui-ink': '#2f2e2b',
      '--dx-ui-muted': '#5f5d58',
      '--dx-ui-line': '#e6e3dc',
      '--dx-ui-hover': '#f3f1ec',
      '--dx-ui-active': '#e8f0fd',
      '--dx-ui-active-line': '#a8c7fa',
      '--dx-ui-accent': '#0b57d0',
      '--dx-ui-accent-hover': '#08398a',
      '--dx-ui-on-accent': '#fff',
    },
  },
  {
    label: 'Warm',
    vars: {
      '--dx-canvas': '#f6eedf',
      '--dx-page-shadow': '0 2px 10px rgba(120,80,20,.16)',
      '--dx-selection': '#fbe3a6',
      '--dx-caret': '#b07a00',
      '--dx-handle': '#b07a00',
      '--dx-ruler': '#fffbf2',
      '--dx-ruler-line': '#e6d8bd',
      '--dx-ruler-margin': '#ecdfc4',
      '--dx-ruler-text': '#fffbf2',
      '--dx-ruler-ink': '#8a5a00',
      '--dx-ruler-on': '#b07a00',
      '--dx-ui-bar': '#fbf4e6',
      '--dx-ui-bg': '#fffbf2',
      '--dx-ui-ink': '#3d2f17',
      '--dx-ui-muted': '#7a6440',
      '--dx-ui-line': '#e6d8bd',
      '--dx-ui-hover': '#f4e9d2',
      '--dx-ui-active': '#fbe3a6',
      '--dx-ui-active-line': '#e8c66a',
      '--dx-ui-accent': '#8a5a00',
      '--dx-ui-accent-hover': '#6f4800',
      '--dx-ui-on-accent': '#fff',
    },
  },
  {
    label: 'Dark',
    scheme: 'dark',
    vars: {
      '--dx-canvas': '#15171b',
      '--dx-page-shadow': '0 4px 18px rgba(0,0,0,.45)',
      '--dx-selection': '#f5d0dd',
      '--dx-caret': '#a23a5e',
      '--dx-handle': '#a23a5e',
      '--dx-ruler': '#1f2228',
      '--dx-ruler-line': '#3c414b',
      '--dx-ruler-margin': '#3a3f49',
      '--dx-ruler-text': '#4a505c',
      '--dx-ruler-ink': '#c9ccd3',
      '--dx-ruler-on': '#f2a7c3',
      '--dx-ui-bar': '#1f2228',
      '--dx-ui-bg': '#2a2e36',
      '--dx-ui-ink': '#e6e8ec',
      '--dx-ui-muted': '#a4aab5',
      '--dx-ui-line': '#3c414b',
      '--dx-ui-hover': '#353a44',
      '--dx-ui-active': '#2c3f63',
      '--dx-ui-active-line': '#4a6aa5',
      '--dx-ui-accent': '#8ab4f8',
      '--dx-ui-accent-hover': '#a6c5fa',
      '--dx-ui-on-accent': '#10213f',
    },
  },
];

export const LANG_FNS = ['setLocale(code)', 'getLocale()', 'onLocaleChange(fn)', 'addLocale(code, texts)', 'locales()', 'messages(locale)', 't(key)', 'plural(key, n)', 'fontFamilies()', 'addFont(source)', 'addFonts(sources)', 'onFontsChange(fn)', 'createSpellChecker(options)'];
export const VERSION_FNS = ['createVersionView(editor, versions)', 'loadVersion(versions, id)', 'compareDocs(before, after)', 'createAssistantChat(editor, options)'];
