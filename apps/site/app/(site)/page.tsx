import Link from 'next/link';
import { CodeTabs } from '@/components/CodeTabs';
import { LiveDemo } from '@/components/LiveDemo';
import { highlight } from '@/lib/docs';
import { NPM, NPM_ORG, REPO } from '@/lib/site';

const FEATURES = [
  ['Compatible with Word files', 'It reads and writes DOCX, and lays pages out by the same rules, so a document looks the same here and there. Text pasted from Word, Google Docs or the web keeps its look.'],
  ['DOCX in, the same DOCX out', 'What the editor does not understand stays in the file untouched. Nothing is lost by opening and saving.'],
  ['Templates', 'Any text in double braces is a variable. Fill contracts and receipts from the editor, from code or from the command line.'],
  ['Real-time collaboration', 'Several people on one document, each seeing the others’ carets, with undo of their own. Your backend keeps the files, and a version of each session of work.'],
  ['Tracked changes', 'What is typed stays underlined and what is deleted stays struck through, signed by who did it, until someone accepts or rejects it. Word reads the same changes.'],
  ['Versions', 'Your application keeps the versions; the editor shows what changed between two of them, word by word, and goes back to one as a step to undo.'],
  ['Whole documents', 'Sections with a page of their own, footnotes, text boxes, tab stops, tables inside cells and text on its side, laid out where Word puts them.'],
  ['Fonts that travel', 'Fonts of your own, TrueType or OpenType, go into the PDF, and into the DOCX when their licence lets them, so it looks the same where they are not installed.'],
  ['PDF without a browser', 'The same layout runs in Node. Generate a PDF with embedded fonts and selectable text on your server.'],
  ['On a phone and on the desktop', 'Pages fit the screen and zoom with two fingers. On a computer, a Tauri application opens and saves .docx files of the disk, with a native menu.'],
  ['Yours to style', 'Use the interface that comes with it, or build your own with headless hooks and Tailwind.'],
  ['AI assistants', 'Claude reads and changes the real document, keeping its look: from Claude Desktop through an MCP server, or in a chat beside the editor of your application.'],
];

const PACKAGES = [
  ['@rebodocs/core', 'The engine: model, DOCX, layout, PDF, templates. No DOM.', '/docs/packages/#rebodocs-core'],
  ['@rebodocs/editor', 'The editor in the browser. No framework.', '/docs/vanilla/'],
  ['@rebodocs/react', 'A component, or headless hooks.', '/docs/react/'],
  ['@rebodocs/collab', 'Rooms, changes and carets in real time.', '/docs/collaboration/'],
  ['@rebodocs/mcp', 'Tools for AI assistants.', '/docs/assistants/'],
];

const SAMPLES: [string, string, string][] = [
  [
    'React',
    'tsx',
    `'use client';
import { DocsEditor } from '@rebodocs/react';

export default function Contract({ file }: { file: Uint8Array }) {
  return (
    <DocsEditor
      docx={file}
      name="contract.docx"
      locale="en"
      onSave={(docx) => upload(docx)}
    />
  );
}`,
  ],
  [
    'Your own UI',
    'tsx',
    `import { DocsProvider, DocsSurface, useDocs } from '@rebodocs/react';

function Bold() {
  const { state, commands } = useDocs();
  return (
    <button
      className={state.bold ? 'bg-blue-100' : ''}
      onClick={() => commands.toggleMark('bold')}
    >
      B
    </button>
  );
}

<DocsProvider docx={file}>
  <Bold />
  <DocsSurface className="h-full" />
</DocsProvider>`,
  ],
  [
    'Server',
    'ts',
    `import { importDocx, fillVariables, exportDocx } from '@rebodocs/core';

const doc = fillVariables(importDocx(template), {
  client: 'Ana Pérez',
  amount: '2500',
});

await storage.put('receipt.docx', exportDocx(doc));`,
  ],
  [
    'Versions',
    'tsx',
    `// Where versions are kept is yours: the editor lists,
// compares and restores them from its side panel.
<DocsEditor
  docx={file}
  versions={{
    list: () => api.versions(documentId),
    load: (id) => api.version(documentId, id),
    save: (docx, info) => api.keepVersion(documentId, docx, info),
  }}
/>`,
  ],
  [
    'Together',
    'tsx',
    `// Your backend decides who gets in, and keeps the file.
<DocsEditor
  collab={{
    url: 'https://collab.example.com',
    room: documentId,
    ticket,
  }}
/>`,
  ],
];

const Eyebrow = ({ children }: { children: string }) => <p className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-brand">{children}</p>;
const Title = ({ children }: { children: string }) => <h2 className="text-[clamp(26px,3.4vw,36px)] font-bold leading-[1.15] tracking-tight">{children}</h2>;

export default async function Home() {
  const samples = await Promise.all(SAMPLES.map(async ([name, lang, code]) => ({ name, html: await highlight(code, lang) })));
  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 pb-4 pt-16 text-center sm:px-6 sm:pt-24">
        <p className="mx-auto mb-5 w-fit rounded-full border border-line bg-soft px-3.5 py-1 text-[13px] font-medium text-muted">Open source · MIT · v0.8.0</p>
        <h1 className="mx-auto max-w-[17ch] text-[clamp(38px,6.4vw,68px)] font-extrabold leading-[1.04] tracking-[-0.035em]">
          The document editor you <span className="bg-gradient-to-r from-brand to-accent bg-clip-text text-transparent">build into your app</span>
        </h1>
        <p className="mx-auto mt-6 max-w-[60ch] text-lg leading-relaxed text-muted">
          A word processor for the browser, compatible with Word files: open, edit and save DOCX, with tracked changes, versions, collaboration, templates and PDF, in packages you take one by one.
        </p>
        <p className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/docs/getting-started/" className="rounded-full bg-brand px-6 py-2.5 font-semibold text-white hover:bg-brand-dark">
            Get started
          </Link>
          <a href="#try" className="rounded-full border border-line px-6 py-2.5 font-semibold hover:bg-soft">
            Try it below
          </a>
          <a href={REPO} className="rounded-full border border-line px-6 py-2.5 font-semibold hover:bg-soft">
            GitHub
          </a>
        </p>
        <p className="mt-6">
          <a href={NPM} className="inline-block rounded-lg border border-line bg-soft px-4 py-2 font-mono text-sm text-ink hover:border-brand">
            <span className="select-none text-muted">$ </span>npm install @rebodocs/react
          </a>
        </p>
      </section>

      <section id="try" className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <Eyebrow>Not a screenshot</Eyebrow>
        <Title>This is the editor. Type in it.</Title>
        <p className="mb-7 mt-3.5 max-w-[62ch] text-[17px] leading-relaxed text-muted">
          Open your own .docx from the menu, fill the template from the side panel, track your changes from Review, keep a version and compare it, export a PDF. Nothing leaves your browser.
        </p>
        <LiveDemo />
        <p className="mt-5 text-[15px] text-muted">
          This is the interface that comes with it.{' '}
          <Link href="/demo/" className="font-semibold text-brand hover:underline">
            See the same document in an interface built from scratch on the hooks →
          </Link>
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <Eyebrow>What it does</Eyebrow>
        <Title>An editor you can trust with real documents</Title>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([title, text]) => (
            <article key={title} className="rounded-xl border border-line bg-soft p-5">
              <h3 className="mb-2 font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-20 sm:px-6 lg:grid-cols-[5fr_6fr]">
        <div>
          <Eyebrow>For developers</Eyebrow>
          <Title>A component, not an iframe</Title>
          <p className="mt-3.5 max-w-[62ch] text-[17px] leading-relaxed text-muted">
            It mounts in your page, takes your fonts and your language, and hands you the file when the person saves. Where documents live and who may open them stays your
            application’s business.
          </p>
          <p className="mt-5">
            <Link href="/docs/react/" className="font-semibold text-brand hover:underline">
              Read the guide →
            </Link>
          </p>
        </div>
        <CodeTabs samples={samples} />
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <Eyebrow>Take what you need</Eyebrow>
        <Title>Five packages</Title>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PACKAGES.map(([name, text, href]) => (
            <Link key={name} href={href} className="flex flex-col gap-2 rounded-xl border border-line p-4 transition-colors hover:border-brand">
              <code className="font-mono text-[13px] font-semibold text-brand">{name}</code>
              <span className="text-sm leading-normal text-muted">{text}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="rounded-2xl bg-soft p-6 sm:p-10">
          <Title>Where it stands</Title>
          <p className="mt-3.5 max-w-[66ch] text-[17px] leading-relaxed text-muted">
            Rebodocs works and has 394 automated tests, and it has not been used in production yet. Every package is{' '}
            <a href={NPM_ORG} className="font-semibold text-brand hover:underline">
              on npm
            </a>
            : the editor for React, and the engine, the editor without a framework, collaboration and the tools for an assistant by themselves.
            Anyone may use it for anything. It is a word processor of its own that is compatible with Word files, not a copy of Word, and it does not try to be one.
          </p>
          <p className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/docs/getting-started/" className="rounded-full bg-brand px-6 py-2.5 font-semibold text-white hover:bg-brand-dark">
              Get started
            </Link>
            <Link href="/docs/status/" className="font-semibold text-brand hover:underline">
              What is checked, and what is missing →
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
