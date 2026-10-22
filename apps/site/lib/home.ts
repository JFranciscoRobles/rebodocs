// What the landing page says: one place for the version, the packages and the
// features, so the badge, the install picker and the table change together.

import { version } from '../package.json';

/** The version every package is published at; the site moves with them. */
export const VERSION = version;

/** The six pastel pairs, background and text, that take turns on tags, icons and packages. */
export type Pastel = 'blue' | 'yellow' | 'green' | 'pink' | 'purple' | 'orange';
export const PASTELS: Pastel[] = ['blue', 'yellow', 'green', 'pink', 'purple', 'orange'];
/** Whole class names, so Tailwind finds them. */
export const PASTEL_CLASS: Record<Pastel, string> = {
  blue: 'bg-pastel-blue text-pastel-blue-fg',
  yellow: 'bg-pastel-yellow text-pastel-yellow-fg',
  green: 'bg-pastel-green text-pastel-green-fg',
  pink: 'bg-pastel-pink text-pastel-pink-fg',
  purple: 'bg-pastel-purple text-pastel-purple-fg',
  orange: 'bg-pastel-orange text-pastel-orange-fg',
};
export const pastelAt = (i: number) => PASTELS[i % PASTELS.length];

export const TAGS = [
  'DOCX in & out',
  'Tracked changes',
  'Versions',
  'Live cursors',
  'Templates',
  'Footnotes',
  'PDF in Node',
  'Embedded fonts',
  'Keyboard & screen reader',
  'Claude via MCP',
];

export interface Package {
  name: string;
  what: string;
  tag: string;
  color: Pastel;
}

/** In the order of the table. */
export const PACKAGES: Package[] = [
  { name: '@rebodocs/core', what: 'The engine: document model, DOCX import and export, page layout, PDF and templates.', tag: 'No DOM', color: 'blue' },
  { name: '@rebodocs/editor', what: 'A DOCX editor for the browser: pages, caret and selection, toolbar, menu, side panel and status bar.', tag: 'No framework', color: 'green' },
  { name: '@rebodocs/react', what: 'The DOCX editor as a React component, or as headless hooks, with everything it needs inside.', tag: 'React', color: 'purple' },
  { name: '@rebodocs/collab', what: 'Real-time collaboration: the change format, the room server and its browser client.', tag: 'Realtime', color: 'pink' },
  {
    name: '@rebodocs/mcp',
    what: 'Tools for an AI assistant to read and edit DOCX: an MCP server for Claude Desktop and other clients, and Claude in a chat beside the editor.',
    tag: 'MCP',
    color: 'yellow',
  },
];
/** In the order of the install picker: the one an application installs first. */
export const INSTALL_ORDER = ['@rebodocs/react', '@rebodocs/editor', '@rebodocs/core', '@rebodocs/collab', '@rebodocs/mcp'];

export const npmOf = (name: string) => `https://www.npmjs.com/package/${name}`;

/** Title, description and the path of a 24 × 24 icon, drawn with a stroke. */
export const FEATURES: [string, string, string][] = [
  ['Works with .docx files', 'Reads and writes DOCX, with its layout measured line by line against Word. What it does not understand, it keeps.', 'M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h4'],
  [
    'Templates',
    'Text in double braces is a variable — fill it from the editor, from code or from the command line.',
    'M8 4C5 4 5 7 5 8s-2 3-2 4 2 0 2 3 0 5 3 5M16 4c3 0 3 3 3 4s2 3 2 4-2 0-2 3 0 5-3 5',
  ],
  [
    'Real-time collaboration',
    'Several people at once, visible cursors, and undo that is yours alone.',
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 3-5 6-5s6 2 6 5M17 11a2.5 2.5 0 1 0 0-5M21 19c0-2-1.5-3.6-4-4',
  ],
  ['Tracked changes', 'Insertions and deletions marked and signed by author until someone accepts or rejects them.', 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4'],
  ['Versions', 'Your app stores the versions; the editor shows the differences word by word.', 'M12 7v5l3 2M3 12a9 9 0 1 0 3-6.7M3 4v4h4'],
  ['Whole documents', 'Sections, footnotes, text boxes, tab stops, tables and vertical text.', 'M4 5h16M4 10h16M4 15h10M4 20h7M17 15v6M14 18h6'],
  ['Fonts that travel', 'TrueType or OpenType embedded in the PDF and, when they are TrueType and the license allows, in the DOCX.', 'M6 18l5-13 5 13M8 13h6M18 9v10'],
  ['PDF without a browser', 'The same engine runs in Node and produces PDFs with selectable text, tagged for screen readers.', 'M6 3h9l3 3v15H6zM9 13l3 3 3-3M12 9v7'],
  ['Phone and desktop', 'Pinch to zoom, plus a Tauri app that opens and saves .docx on disk.', 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2'],
  ['Accessible', 'What happens is told to screen readers, everything works from the keyboard, and high contrast is kept.', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18M12 12h9'],
  [
    'Your style',
    'Use the built-in UI, or your own with unstyled hooks and Tailwind.',
    'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4-4-8-9-8zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
  ],
  [
    'AI assistants',
    'Claude works on the real document through an MCP server, or a chat beside the editor.',
    'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 15l1 2.5 2.5 1-2.5 1L19 22l-1-2.5-2.5-1 2.5-1z',
  ],
];
