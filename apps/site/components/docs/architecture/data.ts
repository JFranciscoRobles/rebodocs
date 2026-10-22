// What the page "How it works" says that is data: the path of a keystroke, and
// where each thing lives in the repository.

export type Stage = 'input' | 'operation' | 'doc' | 'layout' | 'paint' | 'others';

export const STAGES: [Stage, string][] = [
  ['input', 'Hidden textarea'],
  ['operation', 'Operation'],
  ['doc', 'New Doc'],
  ['layout', 'Lines and pages'],
  ['paint', 'Placed spans'],
  ['others', 'The others'],
];

export interface Step {
  stage: Stage;
  title: string;
  text: string;
  code: string;
  /** The section of the page that explains it. */
  more: [title: string, id: string];
}

/** The letter x typed in paragraph 3, from the key to the screen of everyone on the document. */
export const STEPS: Step[] = [
  {
    stage: 'input',
    title: 'A key, in a hidden textarea',
    text: 'The focus is in a textarea that follows the caret. There is no contenteditable: the browser edits nothing, and what is typed arrives there.',
    code: `// what arrives in the textarea, at the caret
'x'  →  paragraph 3, offset 12`,
    more: ['Painting is placing', 'painting'],
  },
  {
    stage: 'operation',
    title: 'It becomes an operation',
    text: 'An operation is a pure function: it takes a document and gives another. Nothing is changed in place.',
    code: `const next = insertText(doc, { para: 3, offset: 12 }, 'x').doc;`,
    more: ['The document is a value', 'value'],
  },
  {
    stage: 'doc',
    title: 'A new document, sharing the rest',
    text: 'The new document is the old one with one paragraph made again. Undo is keeping the old one; what changed is found with ===.',
    code: `next.paragraphs[0] === doc.paragraphs[0];   // true: the very same object
next.paragraphs[3] === doc.paragraphs[3];   // false: the one typed in`,
    more: ['The document is a value', 'value'],
  },
  {
    stage: 'layout',
    title: 'Lines and pages, again where needed',
    text: 'A paragraph that is the same object as last time keeps its lines; only the one typed in is broken again. The browser is asked one thing: how wide a piece of text is.',
    code: `// the one question asked of the browser, or of a font file in Node
measure('rent on the', '15px Inter')   // → 82.4`,
    more: ['Layout is ours', 'layout'],
  },
  {
    stage: 'paint',
    title: 'Each piece placed where it goes',
    text: 'Each piece of text is a span at the coordinates the layout gave. The browser never wraps a line; the caret and the selection are drawn by the editor.',
    code: `<!-- simplified -->
<span style="left: 96px; top: 212px">rent on the</span>`,
    more: ['Painting is placing', 'painting'],
  },
  {
    stage: 'others',
    title: 'Sent to the others',
    text: 'In a shared document the same step travels as a change that names the paragraph by its id, so it means the same after someone added a paragraph above.',
    code: `// in words, what the change says
"in paragraph k3, at offset 12, insert 'x'"`,
    more: ['Collaboration', 'collab'],
  },
];

export interface Place {
  paths: string[];
  what: string;
}

/** Where things live, by package. */
export const PLACES: { pkg: string; places: Place[] }[] = [
  {
    pkg: '@rebodocs/core',
    places: [
      { paths: ['packages/core/src/model.ts'], what: 'The shape of a document.' },
      { paths: ['packages/core/src/ops.ts'], what: 'The operations, and the files beside it.' },
      { paths: ['packages/core/src/layout.ts'], what: 'Lines and pages.' },
      { paths: ['packages/core/src/docx/'], what: 'Reading and writing DOCX.' },
      { paths: ['packages/core/src/stories.ts', 'footnotes.ts', 'textboxes.ts', 'sections.ts'], what: 'Headers, footers, footnotes, text boxes and sections.' },
      { paths: ['packages/core/src/revisions.ts', 'versions.ts'], what: 'Tracked changes; comparing and restoring versions.' },
      { paths: ['packages/core/src/pdf.ts'], what: 'PDF, with font subsetting.' },
    ],
  },
  {
    pkg: '@rebodocs/editor',
    places: [
      { paths: ['packages/editor/src/editor.ts'], what: 'The pages, the caret, input.' },
      { paths: ['packages/editor/src/'], what: 'One file per interface piece.' },
    ],
  },
  {
    pkg: '@rebodocs/collab',
    places: [{ paths: ['packages/collab/src/changes.ts'], what: 'The change format and its transform.' }],
  },
];
