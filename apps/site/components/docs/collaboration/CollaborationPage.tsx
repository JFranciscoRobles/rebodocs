import { LIGHT_THEME, highlight, loadPart } from '@/lib/docs';
import { REPO } from '@/lib/site';
import { CAPTION, CODE, LINK } from '../styles';
import { Callout, HandTip, SectionHead } from '../ui';
import { Conflicts, LazyRoom } from './Conflicts';
import { OPTIONS, ROUTES } from './data';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const h3 = 'm-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]';

/** The files of apps/realtime, and what each holds. */
const DEMO_FILES: [path: string, what: string][] = [
  ['server/collab.ts', 'The three routes, the tickets, the name of a room.'],
  ['server/api.ts', 'What the page asks: the documents, a new one, a ticket.'],
  ['server/store.ts', 'Where the documents are kept: a folder, or an S3 bucket.'],
  ['server/versions.ts', 'A version for each session of work.'],
  ['src/App.tsx', 'The page.'],
];

/** Who holds what: the parts, left to right. */
function Parts() {
  const box = 'rounded-xl border border-border bg-white px-4 py-3';
  const arrow = (
    <span className="self-center px-1 font-code text-lg text-muted" aria-hidden="true">
      ⇄
    </span>
  );
  return (
    <div
      className="mt-8 flex flex-wrap items-stretch gap-2 rounded-[18px] border border-border bg-surface p-5"
      role="figure"
      aria-label="The browsers talk to the collaboration server, which talks to your backend"
    >
      <div className="flex min-w-[150px] flex-[1_1_150px] flex-col gap-2">
        <p className={CAPTION}>The people</p>
        {['Ana’s browser', 'Luis’s browser', 'Eva’s browser'].map((name) => (
          <div key={name} className={`${box} font-code text-[13px] text-ink-soft`}>
            {name}
          </div>
        ))}
      </div>
      {arrow}
      <div className="flex min-w-[200px] flex-[1.2_1_200px] flex-col gap-2">
        <p className={CAPTION}>Collaboration server</p>
        <div className={`${box} flex-1 border-[#bfd3f7] bg-pastel-blue`}>
          <p className="m-0 font-semibold text-pastel-blue-fg">Rooms, in memory</p>
          <p className="m-0 mt-1 text-sm leading-normal text-ink-soft">One per document while someone is in it. Puts everybody’s changes in one order, and forgets the room when it empties.</p>
        </div>
      </div>
      {arrow}
      <div className="flex min-w-[220px] flex-[1.3_1_220px] flex-col gap-2">
        <p className={CAPTION}>Your backend</p>
        <div className={`${box} flex-1`}>
          {ROUTES.map(([route]) => (
            <p key={route} className="m-0 font-code text-[12.5px] leading-[1.9] text-ink">
              {route}
            </p>
          ))}
          <p className="m-0 mt-1.5 text-sm leading-normal text-ink-soft">Keeps the files and says who may come in: S3, R2, a disk, a database.</p>
        </div>
      </div>
    </div>
  );
}

/**
 * "Real-time collaboration": two editors in one room on the page, the cases
 * of two people changing the same thing set up in them, the three steps to
 * set it up, and how it works inside.
 */
export async function CollaborationPage() {
  const [inside, server, runCode, serverCode, nextCode, accessCode, versionCode, ticketCode] = await Promise.all([
    loadPart('collaboration-inside'),
    loadPart('collaboration-server'),
    highlight(
      `git clone https://github.com/JFranciscoRobles/rebodocs && cd rebodocs && npm install
npm run realtime          # http://localhost:5177`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(
      `REBODOCS_COLLAB_BACKEND_KEY=a-long-secret \\
  npx @rebodocs/collab --host 0.0.0.0 --backend https://api.example.com/docs`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(
      `// app/api/docs/[id]/route.ts
const allowed = (request: Request) => request.headers.get('authorization') === \`Bearer \${process.env.REBODOCS_COLLAB_BACKEND_KEY}\`;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  const file = await storage.get(\`docs/\${(await params).id}.docx\`);
  return file ? new Response(file) : new Response(null, { status: 404 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  await storage.put(\`docs/\${(await params).id}.docx\`, await request.arrayBuffer());
  return new Response(null, { status: 204 });
}`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `// app/api/docs/[id]/access/route.ts
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  const { ticket } = await request.json();
  const user = await verifyTicket(ticket, (await params).id);    // your own signed, short-lived token
  return user ? Response.json({ name: user.name }) : new Response(null, { status: 403 });
}`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  const id = (await params).id;
  const docx = new Uint8Array(await request.arrayBuffer());
  await storage.put(\`docs/\${id}.docx\`, docx);
  if (request.headers.get('x-rebodocs-session-end') === '1') {
    const authors = (request.headers.get('x-rebodocs-authors') ?? '').split(',').filter(Boolean).map(decodeURIComponent);
    await storage.put(\`versions/\${id}/\${Date.now()}.docx\`, docx, { authors });
  }
  return new Response(null, { status: 204 });
}`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(`<DocsEditor collab={{ url: 'https://collab.example.com', room: documentId, ticket }} />`, 'tsx', LIGHT_THEME),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Real-time collaboration</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        Several people on the same document at once, each seeing where the others are, with an undo of their own. The collaboration server only coordinates; your backend keeps the files and decides
        who may open them.
      </p>
      <div className="mt-4">
        <HandTip>tip: hold the network below, and type in both</HandTip>
      </div>
      <Parts />

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="Two people, one room">
          Ana and Luis in two real editors on this page. The changes travel in the format of <code className={mono}>@rebodocs/collab</code> and are put in order by its own{' '}
          <code className={mono}>transform</code>; only the network between them is this page’s, held in memory so you can stop it and choose who arrives first.
        </SectionHead>
        <LazyRoom />
        <p className={prose}>
          Hold the network, type in both at the same place, then let one through first and the other after: the log shows the server moving the second change over the first, and the badge checks that
          all three documents are the same, with the digest the real server sends.
        </p>
      </section>

      <section aria-labelledby="when-two-people-change-the-same-thing" className="mt-24">
        <SectionHead id="when-two-people-change-the-same-thing" badge="The rules" color="purple" title="When two people change the same thing">
          What everybody ends with, whichever order the server takes the two changes in. The ones marked “Try it” are set up in the editors above.
        </SectionHead>
        <Conflicts />
        <p className={prose}>
          These rules have unit tests for pairs of concurrent changes, and tests with two clients typing through a real server. <code className={mono}>test/convergence.test.ts</code> makes two people
          edit at random — typing, deleting across paragraphs, Enter, bold, alignment — from 3,000 seeds, with one edit each and with up to three, and checks that both end with the same document
          whichever way round the server takes them. They all do. With more seeds and more edits a few still do not (6 in 20,000 with three edits each): both people cut, join and take out paragraphs
          around the same place at the same instant. Tables are not in the random edits, and concurrent changes to the structure of the same table are the weakest part.
        </p>
        <Callout title="Whatever the rules get wrong lasts seconds.">
          A moment after the changes stop, the server tells the room a digest of its document. An editor whose document differs loads the room again, keeping what the person had typed and not sent;
          what they can undo starts over. See{' '}
          <a href="#inside" className={LINK}>
            how it works inside
          </a>
          .
        </Callout>
      </section>

      <section aria-labelledby="a-demo-to-run" className="mt-24">
        <SectionHead id="a-demo-to-run" badge="Start here" color="blue" title="A demo to run">
          <a href={`${REPO}/tree/main/apps/realtime`} className={LINK}>
            apps/realtime
          </a>{' '}
          is all of this page working: the collaboration server, a backend with the three routes and signed tickets, and the page. Nothing to set up.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: runCode }} />
        <p className={prose}>
          Every document is a room. Open <code className={mono}>contract.docx</code>, press <strong>Copy link</strong> and open the link in another window, or another browser; give each a name in{' '}
          <strong>You are</strong>. A room opens with the document the backend has, gives it back every 10 seconds while someone types, and once more a moment after the last one leaves. The demo
          starts the collaboration server in its own process, on port 7421, and reaches the backend as it would from anywhere: over HTTP, with the key. With the names of a bucket in{' '}
          <code className={mono}>apps/realtime/.env</code> the documents go to S3 instead of a folder, with no other change.{' '}
          <a href="/docs/demos/#claude-in-the-editor" className={LINK}>
            apps/assistant
          </a>{' '}
          is the same demo with Claude in a chat beside the document.
        </p>
        <dl className="m-0 mt-5 max-w-[860px] rounded-2xl border border-border px-5">
          {DEMO_FILES.map(([path, what]) => (
            <div key={path} className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="w-[170px] flex-none">
                <a href={`${REPO}/blob/main/apps/realtime/${path}`} className="font-code text-[13.5px] text-brand hover:text-brand-hover">
                  {path}
                </a>
              </dt>
              <dd className="m-0 min-w-0 flex-[1_1_300px] text-[15px] leading-normal text-ink-soft">{what}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="setup" className="mt-24">
        <SectionHead id="setup" badge="Your system" color="orange" title="Set it up in three steps">
          The server, three routes in your backend, and a ticket for each person. No storage credentials reach the browser, and none reach the collaboration server.
        </SectionHead>

        <h3 className={h3}>1. Run the server</h3>
        <p className={prose}>
          It is <code className={mono}>@rebodocs/collab</code> on npm: plain Node with no dependencies. Put it behind HTTPS with your usual proxy; it uses server-sent events and POST, not WebSockets,
          so nothing special is needed.
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: serverCode }} />
        <dl className="m-0 mt-5 max-w-[860px] rounded-2xl border border-border px-5">
          {OPTIONS.map(([option, env, text]) => (
            <div key={option} className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="w-[170px] flex-none font-code text-[13.5px] font-semibold text-ink">{option}</dt>
              <dd className="m-0 min-w-0 flex-[1_1_300px] text-[15px] leading-normal text-ink-soft">
                {text}
                {env && <span className="mt-0.5 block font-code text-[12.5px] text-muted">{env}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <h3 className={h3}>2. Three routes in your backend</h3>
        <p className={prose}>Each request carries the key, so check it.</p>
        <dl className="m-0 mt-4 max-w-[860px] rounded-2xl border border-border px-5">
          {ROUTES.map(([route, when, what]) => (
            <div key={route} className="border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{route}</dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">
                <span className="text-muted">{when}</span> {what}
              </dd>
            </div>
          ))}
        </dl>
        <p className={prose}>A sketch, with Next.js route handlers:</p>
        <div className={`mt-4 max-w-[860px] ${CODE}`} dangerouslySetInnerHTML={{ __html: nextCode + accessCode }} />

        <h3 className={h3}>3. Give each person a ticket</h3>
        <p className={prose}>
          A ticket is whatever your backend can verify: a signed, short-lived token saying who the person is and which document they may open. Make it when you render the page, and pass it on. The
          demo signs the room, the name and when it expires with a secret only the backend has, so it keeps nothing to check one.
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: ticketCode }} />
        <p className={prose}>
          The document comes from the room, so <code className={mono}>docx</code> is not used; it saves itself through your backend, so <code className={mono}>onSave</code> is not needed either.
        </p>
      </section>

      <section aria-labelledby="a-version-for-each-session" className="mt-24">
        <SectionHead id="a-version-for-each-session" badge="Versions" color="yellow" title="A version for each session">
          The PUT made when the last person leaves, if anybody changed anything, says so: the moment to keep a version, signed by who worked on it, and not one every 30 seconds.
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[860px] rounded-2xl border border-border px-5">
          {[
            ['X-Rebodocs-Session-End: 1', 'This is the document as the session of work leaves it: everybody has gone.'],
            [
              'X-Rebodocs-Authors',
              'Who changed it in the session, as /access named them, each URL-encoded, separated by commas, in the order they first changed it. Someone who only looked is not there.',
            ],
          ].map(([header, text]) => (
            <div key={header} className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="w-[230px] flex-none font-code text-[13.5px] font-semibold text-ink">{header}</dt>
              <dd className="m-0 min-w-0 flex-[1_1_300px] text-[15px] leading-normal text-ink-soft">{text}</dd>
            </div>
          ))}
        </dl>
        <div className={`mt-5 max-w-[860px] ${CODE}`} dangerouslySetInnerHTML={{ __html: versionCode }} />
        <p className={prose}>
          Give the editor those versions (<code className={mono}>versions</code> of <code className={mono}>DocsEditor</code>) and everybody in the room can see them, compare the document with one, and
          go back to one: going back is one more change, sent to the others. A session ends when the room is let go of, <code className={mono}>idle</code> after the last person left (30 s by default);
          someone who comes back before that is in the same session. A server that stops while people are in it gives the document back without the headers. See{' '}
          <a href="/docs/versions/" className={LINK}>
            versions
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="what-people-see" className="mt-24">
        <SectionHead id="what-people-see" badge="In the editor" color="pink" title="What people see" />
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
          {[
            ['Each other', 'The others’ carets and selections, each in a colour with their name, and who is on the document in the status bar.'],
            ['Their own undo', 'Undo takes back your own steps and leaves the others’ in place.'],
            ['No lost work', 'If the connection drops, the editor says so, keeps working, and sends what was typed when it comes back.'],
            ['From outside', "onCollab={(state, peers) => …} tells your application the same: state is 'connecting', 'on' or 'offline'."],
          ].map(([title, text]) => (
            <div key={title} className="lift rounded-2xl border border-border p-5">
              <p className="m-0 font-display text-base font-bold tracking-[-0.01em]">{title}</p>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="inside" className="mt-24">
        <SectionHead id="inside" badge="Inside" color="blue" title="How it works inside">
          What travels, in what order, and what the editor does with it. None of it is needed to use the component.
        </SectionHead>
        <div className="doc doc-part mt-6 max-w-[860px]" dangerouslySetInnerHTML={{ __html: inside }} />
      </section>

      <section aria-labelledby="server" className="mt-24">
        <SectionHead id="server" badge="Reference" color="orange" title="The server in your own program">
          Its options and storage, mounted inside the API you already have, what goes over the wire, and the editor without React.
        </SectionHead>
        <div className="doc doc-part mt-6 max-w-[860px]" dangerouslySetInnerHTML={{ __html: server }} />
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge="Limits" color="yellow" title="What to know">
          Collaboration has run with two tabs, two browsers on a local network and between different networks behind an HTTPS proxy, over a real bucket; the demo’s backend has automated tests with two
          people typing through it, over a folder.
        </SectionHead>
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            'A room is named with letters, digits, - and _, from 8 to 64 of them. The id of a document in your system will do; the demo, which has file names, uses a digest of the name.',
            'One process holds a room. Do not run several behind a load balancer without routing each room to one of them.',
            'The ticket is checked on joining, and again only with --recheck-every or server.recheck(): without them, someone whose access you revoke stays until they disconnect.',
            'A hard crash loses the changes since the last save: up to --save-after seconds (5) after people stop typing, up to --save-every (30) while they go on.',
            'The server keeps no versions: your application does, and the editor compares and restores them. Who changed what travels with tracked changes.',
            'Clients of different versions in one room can end with different formatting: update the editors and the server together.',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[15px] leading-[1.55] text-ink-soft">
              <span aria-hidden="true" className="mt-2 size-1.5 flex-none rounded-full bg-[#c9c6bf]" />
              {item}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
