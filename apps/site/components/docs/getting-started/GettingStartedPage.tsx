import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { REPO } from '@/lib/site';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { InstallCommand } from '../InstallCommand';
import { LazyEngineDemo, LazyFirstDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** Every script of the root package.json, by what it is for. */
const COMMANDS: { group: string; color: 'green' | 'blue' | 'purple' | 'orange'; rows: [string, string][] }[] = [
  {
    group: 'Run',
    color: 'green',
    rows: [
      ['npm run dev', 'The playground: the editor with everything switched on, with hot reload, at localhost:5173.'],
      ['npm run demo', 'The React package, two ways: the whole component, and an interface of its own on the hooks.'],
      ['npm run storage', 'Documents in an S3 bucket, with versions.'],
      ['npm run realtime', 'Several people on one document.'],
      ['npm run assistant', 'Claude in a shared document; needs a key of the Claude API.'],
      ['npm run crm', 'The editor inside a CRM: documents made from a template with the data of a record.'],
      ['npm run desktop', 'The desktop application, with Tauri; needs Rust.'],
      ['npm run site', 'This website, at localhost:5174, after building @rebodocs/react.'],
    ],
  },
  {
    group: 'Check',
    color: 'blue',
    rows: [
      ['npm test', 'The tests, with Vitest.'],
      ['npm run test:browser', 'The editor itself on a page, in a Chrome without a window: keys, clicks, touches and the clipboard.'],
      ['npm run typecheck', 'Types, over every package and every demo.'],
      ['npm run lint · format', 'Biome: says what is wrong, or writes it right.'],
      ['npm run coverage', 'The tests, with what of the packages they reach.'],
      ['npm run api -- --check', 'Whether packages/core/API.md, the public API of the engine as it stands, is out of date; without --check it writes it again.'],
      ['npm run a11y -- <url>', 'axe on pages with the editor in them, in a Chrome without a window: what breaks WCAG 2.2 A and AA.'],
      [
        'npm run word-check',
        'The documents of test-documents/ laid out and compared, line by line, with the PDF Word made of each; fails when one is worse than before. Needs Chrome and pdftotext, not Word.',
      ],
      ['npm run word-compare -- file.docx', "The editor's layout of a file against Microsoft Word's, line by line; --word has Word make its PDF, on macOS."],
      ['npm run float-cases · contract-cases', 'Writes the documents of test-documents/ that measure floating pictures and long contracts against Word.'],
      ['npm run bench', 'How long the engine takes on a long document: layout, DOCX, comparing, PDF. Run it before and after a change.'],
      ['npm run eval:assistant', 'The assistant beside the editor, on cases of its own, with the real Claude API; needs a key.'],
    ],
  },
  {
    group: 'Tools',
    color: 'purple',
    rows: [
      ['npm run generate -- template.docx data.json -o out.pdf', 'Fills a template without a browser, into a DOCX, a PDF or Markdown; npx -p @rebodocs/mcp rebodocs-generate outside the repository.'],
      ['npm run collab', 'The collaboration server; npx @rebodocs/collab outside the repository.'],
      ['npm run mcp', 'The MCP server for AI assistants; npx @rebodocs/mcp outside the repository.'],
      ['npm run locale -- fr texts/fr.json', 'Starts or updates a translation of the interface.'],
    ],
  },
  {
    group: 'Build',
    color: 'orange',
    rows: [
      ['npm run build:react', 'Builds @rebodocs/react and packs it into packages/react.'],
      ['npm run build:packages', 'Builds core, editor, collab and mcp, each into its dist/; build:mcp only the last.'],
      ['npm run build:site', 'This website, as static files.'],
      ['npm run build · build:demo · build:desktop', 'The playground, the React demo and the desktop application.'],
    ],
  },
];

const NEXT: { title: string; href: string; text: string; color: 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'yellow' }[] = [
  { title: 'React component', href: '/docs/react/', text: 'Every prop, the features, the handle, saving.', color: 'blue' },
  { title: 'Headless', href: '/docs/headless/', text: 'Your own toolbar and panels, with Tailwind.', color: 'purple' },
  { title: 'Templates and variables', href: '/docs/templates/', text: 'Documents that fill themselves.', color: 'yellow' },
  { title: 'Real-time collaboration', href: '/docs/collaboration/', text: 'Several people at once.', color: 'green' },
  { title: 'AI assistants', href: '/docs/assistants/', text: 'Claude Desktop on your documents, or Claude in a chat of your application.', color: 'pink' },
  { title: 'Demos to run', href: '/docs/demos/', text: 'Each capability as a small application of its own.', color: 'orange' },
];

/**
 * "Getting started": the first component, running; opening and saving a
 * file; the engine in Node, run here; where to go next; the repository; and
 * every command of it.
 */
export async function GettingStartedPage() {
  const [first, open, clone, script, run, generate] = await Promise.all([
    highlight(
      `'use client';
import { DocsEditor } from '@rebodocs/react';

export default function Page() {
  return (
    <div style={{ height: '100vh' }}>
      <DocsEditor name="untitled.docx" locale="en" onSave={(docx, name) => console.log(name, docx.byteLength)} />
    </div>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `'use client';
import { DocsEditor } from '@rebodocs/react';
import { useEffect, useState } from 'react';

export default function Contract() {
  const [file, setFile] = useState<Uint8Array>();

  useEffect(() => {
    fetch('/api/contract')
      .then((response) => response.arrayBuffer())
      .then((bytes) => setFile(new Uint8Array(bytes)));
  }, []);

  if (!file) return <p>Opening…</p>;
  return (
    <div style={{ height: '100vh' }}>
      <DocsEditor
        docx={file}
        name="contract.docx"
        onSave={async (docx) => {
          const response = await fetch('/api/contract', { method: 'PUT', body: docx });
          if (!response.ok) throw new Error(response.statusText);
        }}
      />
    </div>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `git clone ${REPO}.git
cd rebodocs
npm install
npm run dev`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(
      `// fill.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { exportDocx, fillVariables, importDocx, variableNames } from '@rebodocs/core';

const template = importDocx(new Uint8Array(readFileSync('template.docx')));
const doc = fillVariables(template, { client: 'Ana Pérez' });
console.log('Left as they are:', variableNames(doc));
writeFileSync('out.docx', exportDocx(doc));`,
      'js',
      LIGHT_THEME,
    ),
    highlight('node fill.mjs', 'bash', LIGHT_THEME),
    highlight(
      `npx -p @rebodocs/mcp rebodocs-generate template.docx --list
npx -p @rebodocs/mcp rebodocs-generate template.docx data.json -o out.pdf`,
      'bash',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Getting started</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        Every package is on npm:{' '}
        <a href="https://www.npmjs.com/package/@rebodocs/react" className={LINK}>
          @rebodocs/react
        </a>{' '}
        for React and Next.js, and the engine, the editor without a framework, collaboration and the tools for an assistant by themselves.{' '}
        <a href="/docs/packages/" className={LINK}>
          Packages
        </a>{' '}
        says which to take.
      </p>
      <div className="mt-4">
        <HandTip>tip: the example below is running — save it</HandTip>
      </div>

      <section aria-labelledby="put-it-in-a-react-application" className="mt-16">
        <SectionHead id="put-it-in-a-react-application" badge="React" color="blue" title="Put it in a React application">
          One package, with the engine, the editor and the collaboration client inside. React 18 or later is its peer.
        </SectionHead>
        <div className="mt-6 max-w-[760px]">
          <InstallCommand command="npm install @rebodocs/react" />
        </div>
        <p className={prose}>Use the component. The element it is in must have a height:</p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: first }} />
        <p className={prose}>
          That gives an empty document. To open a file, pass its bytes as <code className={mono}>docx</code>. Here it is, as written:
        </p>
        <LazyFirstDemo />
        <h3 id="open-and-save" className="m-0 mt-12 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          Open a file and save it back
        </h3>
        <p className={prose}>
          The editor keeps nothing: it is given the bytes, and gives them to <code className={mono}>onSave</code> when the person saves. Where they come from and where they go is your application’s:
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: open }} />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>
            Keep the bytes in state. <code className={mono}>docx</code> is compared as an object: another array, even with the same bytes, is another document, and the editor opens it again and loses
            what was edited.
          </li>
          <li>
            When <code className={mono}>onSave</code> throws, the person is told the save failed and the document stays unsaved. <code className={mono}>fetch</code> does not throw on an error of the
            server, hence the check.
          </li>
          <li>
            On a server it renders an empty element, and mounts in the browser. Every prop is in{' '}
            <a href="/docs/react/" className={LINK}>
              React component
            </a>
            .
          </li>
          <li>
            Without <code className={mono}>locale</code>, the interface is in the first of the browser’s languages it speaks, or in English.
          </li>
          <li>
            No React? The same package has the whole editor without it: <code className={mono}>import {'{ mountDocs }'} from &apos;@rebodocs/react/mount&apos;</code>, and npm does not install React
            for it, as it is an optional peer. See{' '}
            <a href="/docs/vanilla/" className={LINK}>
              Without a framework
            </a>
            .
          </li>
        </ul>
      </section>

      <section aria-labelledby="use-the-engine-in-node" className="mt-24">
        <SectionHead id="use-the-engine-in-node" badge="Node" color="purple" title="Use the engine in Node">
          To fill templates or make PDFs on a server, with no browser and no editor: the engine is a package of its own.
        </SectionHead>
        <div className="mt-6 max-w-[760px]">
          <InstallCommand command="npm install @rebodocs/core" />
        </div>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: script }} />
        <div className={`mt-2 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: run }} />
        <p className={prose}>The engine is the same in the browser, so here is that script, run on the agreement of the demo:</p>
        <LazyEngineDemo />
        <p className={prose}>
          A variable without a value stays as it is written. Dates and amounts are written in the language of the document, or in English when it says none, unless <code className={mono}>locale</code>{' '}
          says another.
        </p>
        <p className={prose}>
          Or, with no code, the command that comes with <code className={mono}>@rebodocs/mcp</code>: it lists the variables of a template, fills it from a JSON file into a DOCX, a PDF or Markdown, and
          says what it left.
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: generate }} />
        <p className={prose}>
          A PDF, its fonts, and the rest are in{' '}
          <a href="/docs/server/" className={LINK}>
            On a server
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="where-to-go-next" className="mt-24">
        <SectionHead id="where-to-go-next" badge="Next" color="yellow" title="Where to go next" />
        <div className="mt-6 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))' }}>
          {NEXT.map((card) => (
            <a key={card.href} href={card.href} className="block rounded-2xl border border-border p-5 no-underline transition-colors hover:bg-hover">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </a>
          ))}
        </div>
      </section>

      <section aria-labelledby="run-the-repository" className="mt-24">
        <SectionHead id="run-the-repository" badge="Repository" color="green" title="Run the repository">
          To try everything, to change the code, or to run the demos. It needs Node 22.12 or later.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: clone }} />
        <p className={prose}>
          Open <code className={mono}>http://localhost:5173</code>. That is the playground: the editor with everything switched on. Open a Word file from the menu and edit it.
        </p>
        <p className={prose}>
          Inside the repository the packages import each other as TypeScript source, with no build: a script of your own runs with <code className={mono}>npx vite-node</code>.
        </p>
      </section>

      <section aria-labelledby="commands" className="mt-24">
        <SectionHead id="commands" badge="Commands" color="orange" title="Commands">
          Every script of the repository, from its root.
        </SectionHead>
        {COMMANDS.map((group) => (
          <div key={group.group} className="mt-6 max-w-[920px]">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[group.color]}`}>{group.group}</span>
            <dl className="m-0 mt-2.5 rounded-2xl border border-border px-5">
              {group.rows.map(([command, text]) => (
                <div key={command} className="grid gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))' }}>
                  <dt className="font-code text-[13.5px] font-semibold text-ink [overflow-wrap:anywhere]">{command}</dt>
                  <dd className="m-0 text-[15px] leading-normal text-ink-soft">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>
    </>
  );
}
