import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS, type Pastel } from '@/lib/home';
import { CODE, LINK } from '../styles';
import { Callout, HandTip, SectionHead } from '../ui';
import { ConfigBuilder } from './ConfigBuilder';
import { FILE_TOOLS, HTTP_SETUP, OPTIONS } from './data';
import { toolDocs } from './tools';
import { LazyRunner, ToolsReference } from './ToolsReference';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** The three ways an assistant reaches a document, each as who talks to whom. */
const WAYS: { title: string; color: Pastel; flow: [string, string, string]; text: string; href: string; cta: string }[] = [
  {
    title: 'Files, from your assistant',
    color: 'blue',
    flow: ['Claude Desktop, Code, Cursor', 'rebodocs-mcp, on your machine', 'contract.docx'],
    text: 'The assistant opens a .docx, changes it in memory and saves it as DOCX, PDF or Markdown. No editor needs to be open.',
    href: '#setup',
    cta: 'Set it up',
  },
  {
    title: 'The editor someone has open',
    color: 'purple',
    flow: ['Your assistant', 'rebodocs-mcp, on your machine', 'the editor in the browser'],
    text: 'The person switches on “AI” in the status bar, and the assistant works on what they are looking at: each change a step to undo, the view going to it.',
    href: '#setup',
    cta: 'Set it up',
  },
  {
    title: 'Claude in your application',
    color: 'green',
    flow: ['A chat in your page', 'your backend', 'the Claude API'],
    text: 'For everyone who uses your application, with your API key. The page holds the conversation and runs the tools on the editor; the server keeps nothing.',
    href: '#app',
    cta: 'Add it',
  },
];

/** What keeps an assistant to what it was given, each checked in packages/mcp/src (server.ts, bridge.ts, browser.ts, claude.ts). */
const SAFETY: [title: string, text: string][] = [
  ['Only the folders you name', 'With --root, a path outside those folders is refused, and the assistant is told why. Without it, the server may use any file the machine lets it.'],
  [
    'Nothing written until it saves',
    'An opened file is changed in memory. save_document writes it, and never over a file that is there unless the assistant says overwrite; new_document will not take a path that exists.',
  ],
  [
    'Only this machine, unless you say',
    'The server listens on 127.0.0.1. A page connects from localhost, or from an --origin you name. To listen for other machines (--host) it will not start without a --token of 12 characters or more.',
  ],
  ['The person switches it on', 'The editor connects only when “AI” is switched on, and not again after a reload. Each change is a step to undo, and the view goes to it.'],
  ['Suggestions, not edits', 'With track_changes on, what the tools change stays marked, signed “Assistant”, for the person to accept or reject.'],
  ['A way back', 'On a file, undo goes back from the last changes, up to 50; in the editor, each change is a step the person undoes. edit_document makes all its edits or none.'],
  [
    'The client knows what only reads',
    'Each tool says whether it only reads, whether doing it again changes more, and whether it can lose work: only save_document and close_document can. A client can let the reading ones run without asking.',
  ],
  [
    'In your application: who, and how often',
    'assistantRoute asks allow who may use it and gives each user perMinute steps, told apart by key; the key stays on your server, and the conversation in the page.',
  ],
];

/** Names of options and tools in a sentence, as code that does not break at its hyphen. */
const NAMES = /(--[a-z-]+|\b(?:save_document|new_document|close_document|track_changes|edit_document|undo|assistantRoute|allow|perMinute|key|overwrite)\b)/;
const withNames = (text: string) =>
  text.split(NAMES).map((piece, i) =>
    i % 2 ? (
      <code key={i} className="whitespace-nowrap font-code text-[13.5px] text-ink">
        {piece}
      </code>
    ) : (
      piece
    ),
  );

/** What the tools do for a contract beyond its text, each checked in packages/mcp/src/tools. */
const CONTRACTS: [tool: string, text: string][] = [
  [
    'edit_document',
    'Several changes in one call, all or none: replace, rewrite, insert, delete, style, format, notes, moving a clause, a cell. Every paragraph number in them is the one of a single reading, so the assistant does not read again after each insertion.',
  ],
  [
    'renumber_clauses',
    'Puts in order the numbers written at the start of the headings, after a clause was put in, taken out or moved: “Primera.”, “CLÁUSULA 3.” or “IV.”, each kept as written. It lists the places of the text that name a clause by a number that changed, without changing them.',
  ],
  ['move_section', 'Moves a heading with everything under it, as dragging it in the outline does: the clause keeps its look and its notes.'],
  ['set_cell_text', 'Writes a cell by its table, row and cell, empty or not: the way to fill a row just put in.'],
  ['read_pages', 'How the document falls on its pages, in words: a paragraph cut by a page, a heading left at the foot of one, a last page of a line, a table over two pages.'],
  [
    'edit_table',
    'With keep_together, a block of signatures stays whole on one page, and goes to the next only when it does not fit; format_paragraphs keeps a paragraph whole with keep_lines_together, or with the next with keep_with_next.',
  ],
];

/** One question in a chat of your own, from the person to the last change. From chat.ts and claude.ts. */
const LOOP: [title: string, text: string][] = [
  ['The person asks', 'createAssistantChat sends the conversation so far to POST /api/assistant, on your server.'],
  [
    'Your route asks Claude',
    'assistantRoute (or assistantHandler, in Next.js) checks who may ask (allow) and how often (perMinute), and sends the conversation to Claude with the tools of the document. The answer comes back as Claude writes it: a line of JSON for each piece of text and each tool it asks for, and the whole answer at the end.',
  ],
  ['The page runs the tools', 'Each tool Claude asks for is run on the editor the person has open, as a step they can undo; in a shared room, the others see it as the person’s own change.'],
  [
    '…until it is done',
    'The results go back to Claude in the next step, until it has nothing more to do: 40 steps at most for one question (maxSteps). The conversation lives in the page; the server keeps nothing.',
  ],
];

/**
 * "AI assistants": the three ways an assistant reaches a document, the tools
 * run on a real editor, and every tool as the server tells it to the
 * assistant, read from @rebodocs/mcp when the site is built.
 */
export async function AssistantsPage() {
  const tools = toolDocs();
  const [buttonCode, routeCode, chatCode, httpCode] = await Promise.all([
    highlight(
      `// The “AI” button, for a server on the person's machine
<DocsEditor features={{ assistant: true }} />

// …or one on another machine, started with --host and --token
<DocsEditor features={{ assistant: { url: 'http://10.0.0.5:7411', token } }} />`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { assistantHandler, assistantRoute } from '@rebodocs/mcp/claude';

// ANTHROPIC_API_KEY in the environment.
// Next.js: app/api/assistant/route.ts
export const POST = assistantHandler({
  allow: async (request) => !!(await sessionOf(request)),
  key: async (request) => (await sessionOf(request))!.userId,  // perMinute counts per user
  context: async (request) => \`The adviser is \${(await sessionOf(request))!.name}.\`,
});

// A server of Node's own: answers POST /api/assistant.
const assistant = assistantRoute({ allow: (request) => isSignedIn(request) });
http.createServer(async (request, response) => {
  if (await assistant(request, response)) return;
  // …the rest of your server
});`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { createAssistantChat } from '@rebodocs/react';

const chat = createAssistantChat(handle.editor, { onChange: redraw });
await chat.send('Translate the document into English, keeping its format.');

chat.entries;   // what to show: the person, Claude, each tool it used
chat.busy;      // true while it works; chat.stop() ends it after this step`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(HTTP_SETUP, 'bash', LIGHT_THEME),
  ]);
  const writes = tools.filter((tool) => tool.writes).length;

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">AI assistants</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        <code className="rounded-[5px] bg-hover px-1.5 py-0.5 font-code text-[15px] text-ink">@rebodocs/mcp</code> gives an assistant the operations a person has in the editor, as{' '}
        {tools.length + FILE_TOOLS.length} tools of the{' '}
        <a href="https://modelcontextprotocol.io" className={LINK}>
          Model Context Protocol
        </a>
        . “Fill this contract” or “turn this list into a table” is done on the real document, its layout and formatting intact, not on a copy of its text.
      </p>
      <div className="mt-4">
        <HandTip>tip: be the assistant below, no API key needed</HandTip>
      </div>

      <section aria-labelledby="ways" className="mt-16">
        <SectionHead id="ways" badge="Start here" color="blue" title="Which way?">
          The same tools reach a document three ways. The first two run a server on your machine; the third puts Claude in your own application.
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
          {WAYS.map((way) => (
            <div key={way.title} className="lift flex flex-col rounded-2xl border border-border p-5">
              <p className="m-0 font-display text-base font-bold tracking-[-0.01em]">{way.title}</p>
              <ol className="m-0 mt-3.5 flex list-none flex-col items-start gap-1 p-0" aria-label="Who talks to whom">
                {way.flow.map((step, i) => (
                  <li key={step} className="flex flex-col items-start gap-1">
                    {i > 0 && (
                      <span aria-hidden="true" className="pl-3 font-code text-xs leading-none text-muted">
                        ⇅
                      </span>
                    )}
                    <span className={`rounded-lg px-2.5 py-1 font-code text-[12.5px] ${i === 1 ? PASTEL_CLASS[way.color] : 'border border-border bg-surface text-ink-soft'}`}>{step}</span>
                  </li>
                ))}
              </ol>
              <p className="m-0 mt-3.5 flex-1 text-[15px] leading-[1.6] text-ink-soft">{way.text}</p>
              <a href={way.href} className={`mt-3 text-sm ${LINK}`}>
                {way.cta} ↓
              </a>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="try" className="mt-24">
        <SectionHead id="try" badge="Live" color="green" title="Be the assistant">
          The sample document in the real editor, and the tools an assistant calls, run on it by the same code the server and the chat run. What comes back is word for word what the assistant reads.
        </SectionHead>
        <LazyRunner tools={tools} />
        <p className={prose}>
          Paragraphs go by number, as <code className={mono}>read_document</code> shows them, and every tool that changes text answers with what it did: the assistant does not have to read the whole
          document again after each step. A wrong argument comes back as a plain sentence, for it to correct itself. Of the {tools.length} tools of a document, {writes} change it and the rest read.
        </p>
      </section>

      <section aria-labelledby="setup" className="mt-24">
        <SectionHead id="setup" badge="Your machine" color="purple" title="Set it up">
          For the first two ways: the server starts when your assistant does. Choose yours, and copy what it needs.
        </SectionHead>
        <ConfigBuilder />
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">Options of the server</h3>
        <dl className="m-0 mt-3 max-w-[860px] rounded-2xl border border-border px-5">
          {OPTIONS.map(([option, text]) => (
            <div key={option} className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="w-[150px] flex-none font-code text-[13.5px] font-semibold text-ink">{option}</dt>
              <dd className="m-0 min-w-0 flex-[1_1_300px] text-[15px] leading-normal text-ink-soft">{text}</dd>
            </div>
          ))}
        </dl>
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">Over HTTP</h3>
        <p className={prose}>
          For a client that connects to a server instead of starting one, or one on another machine: with <code className={mono}>--http</code> the server listens at <code className={mono}>/mcp</code>{' '}
          (the protocol’s Streamable HTTP), and each client has a session of its own, with its own open files. The editors in the browser are the same for all of them.
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: httpCode }} />
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">The button, in your own editor</h3>
        <p className={prose}>The editor connects only when the person switches “AI” on, and does not remember it between reloads. Each thing the assistant does is one step to undo.</p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: buttonCode }} />
      </section>

      <section aria-labelledby="safety" className="mt-24">
        <SectionHead id="safety" badge="Safety" color="pink" title="What an assistant may touch">
          An assistant does what its tools let it, where the server lets it. These are the limits, and who sets each.
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
          {SAFETY.map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-border p-5">
              <p className="m-0 flex items-center gap-2 font-display text-base font-bold tracking-[-0.01em]">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="flex-none">
                  <path d="M8 1.5l5.5 2v4c0 3.3-2.3 5.9-5.5 7-3.2-1.1-5.5-3.7-5.5-7v-4z" fill="none" stroke="#2E6B3C" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M5.6 8.1l1.7 1.7 3.2-3.4" fill="none" stroke="#2E6B3C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {title}
              </p>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{withNames(text)}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="tools" className="mt-24">
        <SectionHead id="tools" badge="Reference" color="orange" title="Every tool">
          What the server tells the assistant about each, read from the source of <code className={mono}>@rebodocs/mcp</code> when this page was built. “Try it” loads one in the editor above.
        </SectionHead>
        <ToolsReference tools={tools} />
      </section>

      <section aria-labelledby="look" className="mt-24">
        <SectionHead id="look" badge="Good to know" color="pink" title="Keeping the look">
          An assistant sees the text by default, not how it looks. <code className={mono}>read_formatting</code> tells it, paragraph by paragraph: style, alignment, indents, spacing, and each stretch
          with its font, size and marks.
        </SectionHead>
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
          {[
            [
              'rewrite_paragraph',
              'Writes a paragraph anew, as in a translation, keeping its alignment, indents and spacing, and the font, size and colour most of its text had. Given in segments, the words that were bold or italic stay so.',
            ],
            ['insert_paragraphs', 'With like_paragraph, new paragraphs look like one that is there.'],
            ['replace_text', 'Keeps the look of the text it replaces.'],
          ].map(([name, text]) => (
            <div key={name} className="lift rounded-2xl border border-border p-5">
              <a href={`#tool-${name}`} className="font-code text-[14px] font-semibold text-ink hover:text-brand">
                {name}
              </a>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          See it in the editor above: “How it looks” reads paragraph 4, “Translate, keeping the bold” writes paragraph 10 in Spanish with its bold and red words still so, and “Add one like it” puts in
          a bullet that matches the ones around it. The chat in your application tells Claude so before every conversation: read the formatting before rewriting, and change fonts, sizes or spacing
          only when asked.
        </p>
      </section>

      <section aria-labelledby="contracts" className="mt-24">
        <SectionHead id="contracts" badge="Good to know" color="blue" title="Working on a contract">
          Contracts have numbered clauses, tables of amounts and signatures that must not be cut by a page. These tools are for that, besides reading and writing text.
        </SectionHead>
        <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
          {CONTRACTS.map(([name, text]) => (
            <div key={name} className="lift rounded-2xl border border-border p-5">
              <a href={`#tool-${name}`} className="font-code text-[14px] font-semibold text-ink hover:text-brand">
                {name}
              </a>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
        <p className={prose}>“Several at once” and “How it falls on pages”, in the editor above, run the first and the last of them on the sample document.</p>
      </section>

      <section aria-labelledby="app" className="mt-24">
        <SectionHead id="app" badge="Your application" color="green" title="In your own application">
          The “AI” button reaches a server on the person’s machine. To have Claude in your application, for anyone who uses it, the page talks to your backend, and your backend to the Claude API.
        </SectionHead>
        <ol className="m-0 mt-7 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-4 p-0">
          {LOOP.map(([title, text], i) => (
            <li key={title} className="rounded-2xl border border-border p-5">
              <span className="grid size-7 place-items-center rounded-full bg-pastel-green font-code text-[13px] font-semibold text-pastel-green-fg">{i + 1}</span>
              <p className="m-0 mt-3 font-display text-base font-bold tracking-[-0.01em]">{title}</p>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{text}</p>
            </li>
          ))}
        </ol>
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">On your server</h3>
        <p className={prose}>
          <code className={mono}>npm install @rebodocs/mcp</code>, and a route that takes the conversation to Claude with your key. It asks Claude Opus 5.5 at medium effort unless given another{' '}
          <code className={mono}>model</code> or <code className={mono}>effort</code>, and gives each user 40 steps a minute (<code className={mono}>perMinute</code>). Without{' '}
          <code className={mono}>key</code>, a user is the address the request comes from, which behind a proxy is the same for everyone: give it the user of your session.{' '}
          <code className={mono}>context</code> tells Claude what your application knows, after its instructions. <code className={mono}>toolSearch: true</code> has Claude search for the tools of
          tables, pages and reviewing when it needs one, instead of reading all of them on every step.
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: routeCode }} />
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">In the page</h3>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: chatCode }} />
        <Callout title="Your key, your bill.">
          Whoever runs the server pays for what open pages ask. Give <code className={mono}>allow</code> your session check, and keep <code className={mono}>perMinute</code> low. To see it working,{' '}
          <code className={mono}>npm run assistant</code> runs{' '}
          <a href="/docs/demos/#claude-in-the-editor" className={LINK}>
            the demo
          </a>
          .
        </Callout>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge="Limits" color="yellow" title="What to know" />
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            'Paragraph numbers move after an insertion or a deletion. edit_document makes several edits in the numbers of one reading; after it, or after one tool alone, an assistant reads again before using an old number.',
            'Lengths in the tools are in centimetres and points, as people say them; the editor’s own API is in points.',
            'While changes are tracked, what the tools change is tracked too, signed “Assistant”.',
            'A chat in your application cannot insert a picture or a letterhead from a path, or compare with a file: those need the server’s disk.',
            'read_pages says how the text falls on the pages in words; there is no picture of a page for an assistant to look at.',
            'A client that cancels a call stops the server waiting for the editor; a change the editor already made stays, as a step to undo.',
            'In a shared room, an assistant works through the editor of the person who asked: the others see its changes as that person’s, but not the conversation.',
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
