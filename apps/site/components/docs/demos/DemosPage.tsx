import type { ReactNode } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { REPO } from '@/lib/site';
import { LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { InstallCommand } from '../InstallCommand';
import { TryHere } from './TryHere';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

type Pastel = 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'yellow';

interface Demo {
  id: string;
  title: string;
  color: Pastel;
  app: string;
  command: string;
  /** Where it opens, from the port of its vite.config.ts. */
  at?: string;
  /** What it needs before it runs. */
  needs: string;
  /** Whether it runs with nothing set up. */
  ready: boolean;
  short: string;
  intro: ReactNode;
  points: [string, ReactNode][];
  after?: ReactNode;
}

const DEMOS: Demo[] = [
  {
    id: 'the-react-package',
    title: 'The React package',
    color: 'blue',
    app: 'apps/demo',
    command: 'npm run demo',
    at: 'http://localhost:5175',
    needs: 'Nothing',
    ready: true,
    short: 'The editor as it comes, and an interface built from nothing on the hooks.',
    intro: <>The same agreement in two tabs. On this site it is at /demo, which takes the whole window.</>,
    points: [
      ['The included one.', <>DocsEditor: the whole editor in a dozen lines.</>],
      ['Your own interface.', <>A toolbar, a rail, panels, a find bar, a ruler and a status bar built on DocsProvider, DocsSurface and the hooks. It does everything the first does.</>],
      [
        'Two languages.',
        <>
          It opens in English; the selector in its status bar puts both the library and the demo’s own labels in Spanish. Those are in <code className={mono}>src/headless/texts.ts</code>, which
          follows the language of the editor.
        </>,
      ],
      ['No backend.', <>Saving hands the file back as a download.</>],
    ],
    after: (
      <>
        <TryHere />
        <p className={prose}>
          <a href="/docs/example/" className={LINK}>
            A complete interface
          </a>{' '}
          walks through it, piece by piece.
        </p>
      </>
    ),
  },
  {
    id: 'an-s3-bucket',
    title: 'An S3 bucket',
    color: 'yellow',
    app: 'apps/storage',
    command: 'npm run storage',
    at: 'http://localhost:5176',
    needs: 'A bucket and its keys in apps/storage/.env',
    ready: false,
    short: 'Documents kept in Cloudflare R2, AWS S3 or MinIO: open, save, versions, and a PDF made on the server.',
    intro: <>The port is part of the origin the bucket is told to let in, so it is always 5176.</>,
    points: [
      ['The list.', <>The .docx and .pdf in the bucket.</>],
      ['Signed addresses.', <>Opening and saving with addresses signed for a few minutes: the browser reads from and writes to the bucket itself, and never has a key.</>],
      ['Versions.', <>One kept with each save, under versions/; the side panel compares the document with one and goes back to it.</>],
      ['PDF on the server.', <>The server fills the variables of a template, lays it out with font files and stores the PDF beside it.</>],
    ],
    after: (
      <p className={prose}>
        <a href="/docs/storage/" className={LINK}>
          Documents in an S3 bucket
        </a>{' '}
        has every step for Cloudflare R2, what changes for another S3, and the code to copy.
      </p>
    ),
  },
  {
    id: 'real-time',
    title: 'Real time',
    color: 'green',
    app: 'apps/realtime',
    command: 'npm run realtime',
    at: 'http://localhost:5177',
    needs: 'Nothing',
    ready: true,
    short: 'Several people on one document at once, through a backend of your own.',
    intro: <>The documents are kept in a folder, or in a bucket when its .env names one. The collaboration server starts with it, on port 7421.</>,
    points: [
      ['Every document is a room.', <>There is no other way to open one.</>],
      [
        'A room is there only while someone is in it.',
        <>It opens when the first person comes in; a moment after the last one leaves, the document is saved and the room let go of. The list says which rooms are open, and who is in each.</>,
      ],
      ['The collaboration server keeps nothing.', <>A backend gives it the document, takes it back, and says who may come in, with a signed ticket for each person.</>],
      [
        'A version of each session.',
        <>When everybody has left a document they changed, the backend keeps a version, signed by who changed it. The Versions tab lists them, compares, goes back to one, and keeps one by hand.</>,
      ],
    ],
    after: (
      <p className={prose}>
        Open a document, press <strong className="font-semibold text-ink">Copy link</strong> and open the link in another window.{' '}
        <a href="/docs/collaboration/#a-demo-to-run" className={LINK}>
          Real-time collaboration
        </a>{' '}
        explains each part.
      </p>
    ),
  },
  {
    id: 'claude-in-the-editor',
    title: 'Claude in the editor',
    color: 'pink',
    app: 'apps/assistant',
    command: 'npm run assistant',
    at: 'http://localhost:5179',
    needs: 'A key of the Claude API in apps/assistant/.env',
    ready: false,
    short: 'A chat beside a shared document that reads and changes it, keeping its look.',
    intro: <>The real-time demo with a chat beside the document. The documents are kept in a folder, or in a bucket as in the storage demo.</>,
    points: [
      [
        'Ask for something to be done.',
        <>
          “Translate it into English keeping the format”, “put the obligations in two columns”, “make the table repeat its heading row”. Claude reads the document, does it with the same tools the MCP
          server has, and says what it did.
        </>,
      ],
      ['What it does is yours.', <>Each change is a step to undo and, in a room, the others see it happen.</>],
      ['The key stays on the server.', <>The page sends the conversation to its backend, which takes it to the Claude API; the tools run in the page.</>],
    ],
    after: (
      <p className={prose}>
        <a href="/docs/assistants/#app" className={LINK}>
          AI assistants
        </a>{' '}
        has the code to put it in an application.
      </p>
    ),
  },
  {
    id: 'inside-a-crm',
    title: 'Inside a CRM',
    color: 'orange',
    app: 'apps/crm',
    command: 'npm run crm',
    at: 'http://localhost:5180',
    needs: 'Nothing; a key of the Claude API for its assistant',
    ready: true,
    short: 'A contract made from a template with the data of a record, edited in its page, saved on its own, with versions, review and an assistant.',
    intro: <>A made-up real-estate CRM, in Spanish, where the documents never leave the page of their property.</>,
    points: [
      ['From the record to the contract.', <>Documentos → Generar contrato de mediación fills a template with the record’s data, in Spanish, and opens it in the page as its first version.</>],
      ['Saved on its own.', <>A moment after each change; the bar says when. Leaving the document keeps a version, signed by who worked on it.</>],
      ['Review.', <>Switch “Trabajas como”, at the top, to Luis Mena · Jurídico and turn on tracked changes: what they change stays marked with their name.</>],
      ['The assistant', <>beside the document, as in the demo above, without the rooms.</>],
    ],
    after: (
      <p className={prose}>
        The documents are kept in the browser, in IndexedDB: in a CRM of your own, <code className={mono}>src/store.ts</code> is the file that becomes calls to your backend. Its README says what to
        change.
      </p>
    ),
  },
  {
    id: 'the-desktop',
    title: 'The desktop',
    color: 'purple',
    app: 'apps/desktop',
    command: 'npm run desktop',
    needs: 'Rust, from rustup.rs; the first run compiles for a few minutes',
    ready: false,
    short: 'A desktop application with Tauri: .docx files of the disk, a native menu, PDF.',
    intro: (
      <>
        A window of its own, made with{' '}
        <a href="https://tauri.app" className={LINK}>
          Tauri
        </a>
        .
      </>
    ),
    points: [
      ['Each window is a document,', <>a .docx file of the disk. Open, Save and Save as use the dialogs of the system, and closing a window with changes asks first.</>],
      ['A native menu:', <>File, Edit, View, with the usual keys. Edit has Paste as text.</>],
      ['Export as PDF', <>to a file of the disk, and the other exports of the side menu.</>],
      ['Documents from the system:', <>dropped on the window, or opened with a double click in the Finder or the Explorer once the application is built (npm run build:desktop).</>],
    ],
    after: (
      <p className={prose}>
        The pages are the editor without a framework, as in the playground; what Rust adds is small, in <code className={mono}>src-tauri/src/lib.rs</code>: reading and writing files, a window per
        document, and the documents the system asks to open.
      </p>
    ),
  },
  {
    id: 'the-playground',
    title: 'The playground',
    color: 'green',
    app: 'apps/playground',
    command: 'npm run dev',
    at: 'http://localhost:5173',
    needs: 'Nothing',
    ready: true,
    short: 'Everything wired together without a framework.',
    intro: <>The page every package is tried in while it is written.</>,
    points: [
      ['No framework.', <>The editor and every piece around it, wired by hand.</>],
      ['Share.', <>Collaboration started from the Share button in the status bar, on the collaboration server of this machine (npm run collab).</>],
      ['An assistant.', <>The MCP server reaches the document open in it (npm run mcp).</>],
    ],
    after: (
      <p className={prose}>
        Its <code className={mono}>src/main.ts</code> is the shortest example of everything wired together. See{' '}
        <a href="/docs/vanilla/" className={LINK}>
          Without a framework
        </a>
        .
      </p>
    ),
  },
];

/**
 * "Demos to run": the seven applications of the repository, at a glance with
 * what each needs, the React one running in a frame, each in its section,
 * and what they have in common.
 */
export async function DemosPage() {
  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Demos to run</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        Seven applications in the repository use the packages the way yours would. Each is small, and is there to be read and copied from.
      </p>
      <div className="mt-4">
        <HandTip>tip: the first one opens right here</HandTip>
      </div>

      <section aria-label="The demos at a glance">
        <div className="mt-8 max-w-[920px]">
          <InstallCommand command={`git clone ${REPO} && cd rebodocs && npm install`} />
        </div>

        <div
          className="mt-8 grid gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))',
          }}
        >
          {DEMOS.map((demo) => (
            <a key={demo.id} href={`#${demo.id}`} className="flex flex-col rounded-2xl border border-border p-5 no-underline transition-colors hover:bg-hover">
              <span className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[demo.color]}`}>{demo.title}</span>
              <span className="mt-2.5 text-[15px] leading-[1.55] text-ink-soft">{demo.short}</span>
              <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3.5">
                <code className="font-code text-[13px] font-semibold text-ink">{demo.command}</code>
                <span className={`text-[12.5px] font-semibold ${demo.ready ? 'text-[#2f7a4a]' : 'text-muted'}`}>{demo.ready ? 'Nothing to set up' : 'Needs setup'}</span>
              </span>
            </a>
          ))}
        </div>
      </section>

      {DEMOS.map((demo, i) => (
        <section key={demo.id} aria-labelledby={demo.id} className={i ? 'mt-24' : 'mt-20'}>
          <SectionHead id={demo.id} badge={demo.app} color={demo.color} title={demo.title}>
            {demo.intro}
          </SectionHead>
          <dl className="m-0 mt-6 grid max-w-[920px] gap-x-6 gap-y-2 rounded-2xl border border-border bg-surface px-5 py-4 sm:grid-cols-[110px_1fr]">
            <dt className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Run it</dt>
            <dd className="m-0 font-code text-[13.5px] font-semibold text-ink">{demo.command}</dd>
            {demo.at && (
              <>
                <dt className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Opens at</dt>
                <dd className="m-0 font-code text-[13.5px] text-ink-soft">{demo.at}</dd>
              </>
            )}
            <dt className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Needs</dt>
            <dd className="m-0 text-[15px] text-ink-soft">{demo.needs}</dd>
          </dl>
          <ul className="m-0 mt-5 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
            {demo.points.map(([lead, text]) => (
              <li key={lead}>
                <strong className="font-semibold text-ink">{lead}</strong> {text}
              </li>
            ))}
          </ul>
          {demo.after}
        </section>
      ))}

      <section aria-labelledby="what-they-have-in-common" className="mt-24">
        <SectionHead id="what-they-have-in-common" badge="All of them" color="yellow" title="What they have in common" />
        <div
          className="mt-6 grid max-w-[920px] gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))',
          }}
        >
          {[
            {
              title: 'From their source',
              text: 'They take the packages from their source, so a change in a package shows at once. Copied into a project that installs @rebodocs/react from npm, they work without the alias in vite.config.ts.',
              color: 'blue' as const,
            },
            {
              title: 'For your machine',
              text: 'The ones with a backend check nobody: where an application decides who may do what is marked in their code. The ones with Claude spend from your API key, a few steps a minute for each address.',
              color: 'orange' as const,
            },
            {
              title: 'A README each',
              text: 'Each says what is where, and where it can improve.',
              color: 'green' as const,
            },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
