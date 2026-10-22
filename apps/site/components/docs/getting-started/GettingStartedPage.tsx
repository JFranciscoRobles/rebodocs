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
      ['npm run typecheck', 'Types, over every package and every demo.'],
      ['npm run a11y -- <url>', 'axe on pages with the editor in them, in a Chrome without a window: what breaks WCAG 2.2 A and AA.'],
      ['npm run word-compare -- file.docx', "The editor's layout of a file against Microsoft Word's, line by line. Needs macOS, Word and pdftotext."],
    ],
  },
  {
    group: 'Tools',
    color: 'purple',
    rows: [
      ['npm run generate -- template.docx data.json -o out.pdf', 'Fills a template without a browser, into a DOCX, a PDF or Markdown.'],
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
      ['npm run build:packages', 'Builds core, editor, collab and mcp, each into its dist/.'],
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
 * "Getting started": the first component, running; installing it; the
 * repository; the engine in Node, run here; where to go next; and every
 * command of the repository.
 */
export async function GettingStartedPage() {
  const [first, clone, script, run] = await Promise.all([
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
      `git clone ${REPO}.git
cd rebodocs
npm install
npm run dev`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(
      `// tools/my-script.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { importDocx, fillVariables, exportDocx } from '../packages/core/src/index';

const doc = importDocx(new Uint8Array(readFileSync('template.docx')));
writeFileSync('out.docx', exportDocx(fillVariables(doc, { client: 'Ana Pérez' })));`,
      'ts',
      LIGHT_THEME,
    ),
    highlight('npx vite-node tools/my-script.ts', 'bash', LIGHT_THEME),
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
        <p className={prose}>That gives an empty document. To open a file, pass its bytes as <code className={mono}>docx</code>. Here it is, as written:</p>
        <LazyFirstDemo />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
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
            No React? The same package has the whole editor without it: <code className={mono}>import {'{ mountDocs }'} from &apos;@rebodocs/react/mount&apos;</code>, and npm does not install React for it,
            as it is an optional peer. See{' '}
            <a href="/docs/vanilla/" className={LINK}>
              Without a framework
            </a>
            .
          </li>
        </ul>
      </section>

      <section aria-labelledby="run-the-repository" className="mt-24">
        <SectionHead id="run-the-repository" badge="Repository" color="green" title="Run the repository">
          To try everything, to change the code, or to run the demos. It needs Node 22.12 or later.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: clone }} />
        <p className={prose}>
          Open <code className={mono}>http://localhost:5173</code>. That is the playground: the editor with everything switched on. Open a Word file from the menu and edit it.
        </p>
      </section>

      <section aria-labelledby="use-the-engine-in-node" className="mt-24">
        <SectionHead id="use-the-engine-in-node" badge="Node" color="purple" title="Use the engine in Node">
          Inside the repository, the packages import each other as TypeScript source, and scripts run with <code className={mono}>vite-node</code>. The engine needs no browser.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: script }} />
        <div className={`mt-2 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: run }} />
        <p className={prose}>The engine is the same in the browser, so here is that script, run on the agreement of the demo:</p>
        <LazyEngineDemo />
        <p className={prose}>
          A variable without a value stays as it is written. Dates and amounts are written in the language of the document, or in English when it says none, unless{' '}
          <code className={mono}>locale</code> says another. Or use the tool that is
          already there, which says what it left:
        </p>
        <div className="mt-4 max-w-[760px]">
          <InstallCommand command="npm run generate -- template.docx data.json -o out.pdf" />
        </div>
        <p className={prose}>
          See{' '}
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
