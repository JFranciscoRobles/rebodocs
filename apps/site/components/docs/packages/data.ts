// What the page "Packages" says: plain data, read by the page on the server
// (to colour the code), by its parts in the browser, and by the search box.

import { PACKAGES, type Pastel } from '@/lib/home';

export type PackageName = '@rebodocs/core' | '@rebodocs/editor' | '@rebodocs/react' | '@rebodocs/collab' | '@rebodocs/mcp';

export interface PackageDoc {
  name: PackageName;
  /** The one line of the landing page, and its tag and colour. */
  what: string;
  tag: string;
  color: Pastel;
  summary: string;
  runsIn: string[];
  /** What it is built for, as `tools/package.mjs` builds it. */
  target: string;
  dependsOn: string[];
  /** Each way of getting it, with what that way is for. */
  install: [command: string, what: string][];
  /** What it has, by what it is about. */
  inside: [label: string, text: string][];
  /** The paths it is imported from, besides its own name. */
  entries?: [path: string, what: string][];
  takeIt: string;
  guides: [title: string, href: string][];
  example: [lang: 'ts' | 'tsx' | 'json' | 'bash', code: string][];
}

const landing = (name: PackageName) => {
  const { what, tag, color } = PACKAGES.find((pkg) => pkg.name === name)!;
  return { name, what, tag, color };
};

export const PACKAGE_DOCS: PackageDoc[] = [
  {
    ...landing('@rebodocs/react'),
    summary: 'The editor for React: the whole of it as one component, or the pages and hooks to draw your own.',
    runsIn: ['Browser', 'Safe to render on a server'],
    target: 'ES2022 browsers',
    dependsOn: ['React 18+ (peer)'],
    install: [['npm install @rebodocs/react', 'Everything it needs is inside: one install.']],
    inside: [
      ['DocsEditor', 'The whole editor as a component: toolbar, ruler, side panel, pages, status bar.'],
      ['DocsProvider, DocsSurface, hooks', 'The pages, and thirteen hooks to build an interface of your own.'],
      ['mountDocs, createDocs', 'The same two, with no React in them.'],
      ['Built in', 'The engine, the editor and the collaboration client, in one bundle.'],
    ],
    entries: [
      ['@rebodocs/react', 'The components, the hooks, createDocs, languages and fonts.'],
      ['@rebodocs/react/mount', 'mountDocs: the whole editor in an element, without React.'],
    ],
    takeIt: 'For a React or Next.js application. It is the one an application installs first.',
    guides: [
      ['React component', '/docs/react/'],
      ['Headless: your own UI', '/docs/headless/'],
      ['Components and hooks', '/docs/components/'],
    ],
    example: [
      [
        'tsx',
        `'use client';
import { DocsEditor } from '@rebodocs/react';

export function Contract({ file }: { file: Uint8Array }) {
  return (
    <div className="h-screen">
      <DocsEditor docx={file} name="contract.docx" locale="en" onSave={(docx, name) => upload(docx, name)} />
    </div>
  );
}`,
      ],
    ],
  },
  {
    ...landing('@rebodocs/editor'),
    summary: 'The editor in the browser with no framework: the Editor class and its interface, piece by piece.',
    runsIn: ['Browser'],
    target: 'ES2022 browsers',
    dependsOn: ['@rebodocs/core'],
    install: [['npm install @rebodocs/editor', 'It brings @rebodocs/core with it.']],
    inside: [
      ['Editor', 'Pages, caret, selection, history, keyboard, mouse and touch.'],
      ['Interface pieces', 'createToolbar, createStatusBar, createRuler, createPanel, createFindBar, createBubble: each in an element of yours.'],
      ['Languages and fonts', 'setLocale, addLocale, addFonts.'],
    ],
    takeIt: 'For a page without React, or to build on its pieces.',
    guides: [['Without a framework', '/docs/vanilla/']],
    example: [
      [
        'ts',
        `import { Editor, createToolbar, createStatusBar, createBubble } from '@rebodocs/editor';

const editor = new Editor(document.querySelector('#pages')!);
createToolbar(document.querySelector('#toolbar')!, editor);
createStatusBar(document.querySelector('#status')!, editor);
createBubble(editor);

editor.loadDocx(bytes);
const pdf = await editor.exportPdf('Contract');`,
      ],
    ],
  },
  {
    ...landing('@rebodocs/core'),
    summary: 'The engine: everything about a document that does not need a screen.',
    runsIn: ['Node', 'Browser'],
    target: 'ES2022: Node and browsers',
    dependsOn: ['fflate'],
    install: [['npm install @rebodocs/core', 'For code that makes or changes documents.']],
    inside: [
      ['Model', 'An immutable Doc of paragraphs, runs, tables, header and footer, styles, numbering, notes and media.'],
      ['Operations', 'Pure functions, (doc, …) => doc, for every edit.'],
      ['DOCX', 'importDocx and exportDocx, keeping what is not understood.'],
      ['Layout', 'layoutDocument: lines, pages, and where the caret and the selection go.'],
      ['Output', 'renderPdf, exportMarkdown.'],
      ['Templates and versions', 'variableNames, fillVariables, compareDocs, restoreVersion.'],
    ],
    takeIt: 'When documents are made or changed in code: on a server, in a script, in a job.',
    guides: [
      ['On a server: DOCX and PDF', '/docs/server/'],
      ['Templates and variables', '/docs/templates/'],
    ],
    example: [
      [
        'ts',
        `import { importDocx, exportDocx, fillVariables, renderPdf } from '@rebodocs/core';

let doc = importDocx(bytes);                          // Uint8Array → Doc
doc = fillVariables(doc, { client: 'Northwind S.A.' });
const docx = exportDocx(doc);                         // Doc → Uint8Array
const { pdf } = renderPdf(doc, fonts, 'Receipt 1024');   // fonts: readFont() of your .ttf files`,
      ],
    ],
  },
  {
    ...landing('@rebodocs/collab'),
    summary: 'Several people on one document: the change format, the room server, and its browser client.',
    runsIn: ['Node (the server)', 'Browser (the client)'],
    target: 'Node 22 (server) · ES2022 (client)',
    dependsOn: ['@rebodocs/core'],
    install: [
      ['npx @rebodocs/collab --backend https://…', 'The room server, as it comes.'],
      ['npm install @rebodocs/collab', 'To start it from your own code.'],
    ],
    inside: [
      ['Changes', 'Operations addressed by paragraph id, and how two at once are reconciled.'],
      ['Room server', 'Rooms in memory, saved through your backend; it checks every editor has the document, and says who changed it in each session of work.'],
      ['Client', 'What the editor connects with. @rebodocs/react already has it inside.'],
    ],
    entries: [
      ['@rebodocs/collab/server', 'createCollabServer, for a Node program of your own.'],
      ['@rebodocs/collab/storage', 'Where rooms are kept: your backend, over HTTP.'],
      ['@rebodocs/collab/browser', 'The client, for an editor without React.'],
    ],
    takeIt: 'When several people must edit at once.',
    guides: [['Real-time collaboration', '/docs/collaboration/']],
    example: [
      [
        'ts',
        `import { createCollabServer } from '@rebodocs/collab/server';
import { backendStorage } from '@rebodocs/collab/storage';

const server = createCollabServer({
  port: 7420,
  storage: backendStorage({ url: 'https://api.example.com/docs', key: process.env.KEY }),
});
await server.ready;`,
      ],
    ],
  },
  {
    ...landing('@rebodocs/mcp'),
    summary: 'Tools for an AI assistant to read and edit documents, over files or over the one open in a browser.',
    runsIn: ['Node (the server)', 'Browser (the editor’s side)'],
    target: 'Node 22 (server) · ES2022 (browser side)',
    dependsOn: ['@rebodocs/core', '@anthropic-ai/sdk'],
    install: [
      ['npx @rebodocs/mcp --root ~/Documents', 'The MCP server, for Claude Desktop and other clients.'],
      ['npm install @rebodocs/mcp', 'The tools, or Claude in a chat in your application.'],
    ],
    inside: [
      ['MCP server', 'Its tools are the editor’s operations: read, find, replace, format, notes, tables…'],
      ['Claude route', 'The route of a backend that takes a chat in the page to the Claude API.'],
      ['Browser side', 'What lets the tools work on the document open in the editor.'],
    ],
    entries: [
      ['@rebodocs/mcp/claude', 'assistantRoute: the backend of the chat beside the editor.'],
      ['@rebodocs/mcp/browser', 'The editor’s side; createAssistantChat is in @rebodocs/react.'],
    ],
    takeIt: 'To let an assistant work on documents, from a client such as Claude Desktop or inside your application.',
    guides: [['AI assistants (MCP)', '/docs/assistants/']],
    example: [
      [
        'json',
        `// claude_desktop_config.json
{
  "mcpServers": {
    "rebodocs": {
      "command": "npx",
      "args": ["-y", "@rebodocs/mcp", "--root", "/path/to/documents"]
    }
  }
}`,
      ],
    ],
  },
];

/** What every package is, as it goes to npm. */
export const ALL_PACKAGES = ['ESM only', 'TypeScript types included', 'Tree-shakeable', 'MIT'];

/** How each package is in an application: installed, inside one installed, or not there. */
export type Presence = 'install' | 'inside' | 'none';

export interface Goal {
  want: string;
  use: string;
  presence: Record<PackageName, Presence>;
  commands: string[];
  note: string;
}

const none: Record<PackageName, Presence> = { '@rebodocs/core': 'none', '@rebodocs/editor': 'none', '@rebodocs/react': 'none', '@rebodocs/collab': 'none', '@rebodocs/mcp': 'none' };

/** "Which one do I install?", in order. */
export const GOALS: Goal[] = [
  {
    want: 'A React or Next.js application',
    use: '@rebodocs/react',
    presence: { ...none, '@rebodocs/react': 'install', '@rebodocs/editor': 'inside', '@rebodocs/core': 'inside', '@rebodocs/collab': 'inside' },
    commands: ['npm install @rebodocs/react'],
    note: 'One install: the engine, the editor and the collaboration client come inside.',
  },
  {
    want: 'A page without React',
    use: '@rebodocs/editor',
    presence: { ...none, '@rebodocs/editor': 'install', '@rebodocs/core': 'inside' },
    commands: ['npm install @rebodocs/editor'],
    note: 'Or mountDocs from @rebodocs/react/mount, for the whole editor with no framework.',
  },
  {
    want: 'Documents in code, on a server',
    use: '@rebodocs/core',
    presence: { ...none, '@rebodocs/core': 'install' },
    commands: ['npm install @rebodocs/core'],
    note: 'Fill templates, change documents, make PDFs: no browser, no DOM.',
  },
  {
    want: 'Several people on one document',
    use: '@rebodocs/react + @rebodocs/collab',
    presence: { ...none, '@rebodocs/react': 'install', '@rebodocs/collab': 'install', '@rebodocs/editor': 'inside', '@rebodocs/core': 'inside' },
    commands: ['npm install @rebodocs/react', 'npx @rebodocs/collab --backend https://…'],
    note: 'The editor in the page, the room server beside your backend.',
  },
  {
    want: 'An AI assistant on documents',
    use: '@rebodocs/mcp',
    presence: { ...none, '@rebodocs/mcp': 'install', '@rebodocs/core': 'inside' },
    commands: ['npx @rebodocs/mcp --root ~/Documents'],
    note: 'For Claude Desktop. For Claude in a chat in your application, add @rebodocs/react.',
  },
  {
    want: 'An application for the desktop',
    use: '@rebodocs/editor',
    presence: { ...none, '@rebodocs/editor': 'install', '@rebodocs/core': 'inside' },
    commands: ['npm run desktop'],
    note: 'apps/desktop in the repository is the editor in Tauri: .docx files on disk, a native menu, PDF. Start from it.',
  },
];

export interface App {
  path: string;
  what: string;
  run?: string;
}

export const APPS: App[] = [
  { path: 'apps/playground', what: 'The page every package is tried in. Its src/main.ts is the shortest example of everything wired together.', run: 'npm run dev' },
  { path: 'apps/demo', what: '@rebodocs/react as an application uses it: the whole editor, and an interface of its own on the hooks.' },
  { path: 'apps/storage', what: 'Documents in an S3 bucket: open, save, and a PDF made on the server.' },
  { path: 'apps/realtime', what: 'Several people on one document, through a backend with its three routes and signed tickets.', run: 'npm run realtime' },
  { path: 'apps/assistant', what: 'Claude in a chat beside a shared document: the page runs the tools, the backend talks to the Claude API.' },
  { path: 'apps/desktop', what: 'The editor as a desktop application, with Tauri: .docx files on disk, a native menu, PDF.', run: 'npm run desktop' },
  { path: 'apps/site', what: 'This website.' },
];

export const short = (name: string) => name.replace('@rebodocs/', '');
