import { createDoc, trackEdit } from '@rebodocs/core';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { CORE, KEYS, MEMBERS, TOOLS, VIEW } from './data';
import { LazyReviewDemo } from './Lazy';
import { Tracked } from './Tracked';
import TrackEditDemo from './TrackEditDemo';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** What tracking does to a sentence, worked out by trackEdit when the site is built. */
const EXAMPLE = trackEdit(
  createDoc([{ props: {}, runs: [{ text: 'Payment is due within 15 days.', props: {} }] }]),
  createDoc([{ props: {}, runs: [{ text: 'Payment is due within 30 days, in writing.', props: {} }] }]),
  { author: 'Luis' },
  { words: true },
).doc;

/**
 * "Tracked changes": Word's "Track changes" in a real editor with two people,
 * trackEdit on texts typed on the page, how the keys behave, the members, the
 * functions of core, and the tools of an assistant.
 */
export async function TrackedChangesPage() {
  const [basic, headless, core, mcp] = await Promise.all([
    highlight(
      `const editor = handle.editor;

editor.setTrackChanges(true);      // ⌘⇧E / Ctrl+Shift+E
editor.revisions;                   // [{ type: 'insert', author: 'Ana', text: '30', range, … }]
editor.acceptAllRevisions();        // one step to undo`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `const { state, commands } = useDocs();

state.trackChanges;     // boolean
state.revisionCount;    // number

commands.setTrackChanges(!state.trackChanges);
commands.acceptRevision();
commands.goToRevision(1);`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { acceptRevisions, rejectRevisions, revisionsOf, trackEdit } from '@rebodocs/core';

const { doc } = trackEdit(before, after, { author: 'Contracts bot', date: new Date().toISOString() });
revisionsOf(doc);        // what changed, for a person to review
acceptRevisions(doc);    // equals after
rejectRevisions(doc);    // equals before`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `Payment is due within [-15-]{+30+} days of this receipt.
Late payments add a fee{+ of 2% a month+}.`,
      'bash',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Tracked changes</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        With tracking on, what is typed stays underlined and what is deleted stays in the text, struck through, until someone accepts or rejects it. This is Word&apos;s “Track changes”: a document
        tracked in Word opens with its changes, and what is tracked here opens in Word as tracked changes.
      </p>
      <Tracked paragraphs={EXAMPLE.paragraphs} className="mt-6 max-w-[760px] rounded-[10px] bg-surface px-5 py-4 text-[17px] leading-[1.6] text-ink" />
      <div className="mt-4">
        <HandTip>tip: be Ana, and decide on Luis&apos;s changes below</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="Review it">
          Luis changed the receipt with tracking on: a number, words put in and taken out, the formatting of two words, a row of the table. Accept or reject his changes, from here, from{' '}
          <strong>Review</strong> in the toolbar or from the <strong>Changes</strong> tab of the side panel; or type something of your own.
        </SectionHead>
        <LazyReviewDemo />
        <p className={prose}>
          As Ana, take out words Luis put in: they stay, his and taken out by you, two changes. Accept all of one person&apos;s, and the other&apos;s stay. <em>Show all accepted</em> and{' '}
          <em>original</em> show the document as it would be, without touching the changes.
        </p>
      </section>

      <section aria-labelledby="in-the-editor" className="mt-24">
        <SectionHead id="in-the-editor" badge="The interface" color="blue" title="In the editor">
          <strong>Review</strong> in the toolbar, or ⌘⇧E (Ctrl+Shift+E), turns tracking on and off; it is saved in the file, as Word saves it. Changes are signed with the editor&apos;s{' '}
          <code className={mono}>author</code>, the name notes are signed with.
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
          {[
            {
              title: 'Review menu',
              color: 'blue' as const,
              text: 'Track changes; accept or reject the change at the caret, or every change in the selection; the previous or next change; accept or reject them all; show the changes, the document with all of them accepted, or the original.',
            },
            {
              title: 'Changes tab',
              color: 'purple' as const,
              text: 'Every change with who made it, when, and where: a header, a footer or a note. Each one to go to, accept or reject; one person’s alone, to accept or reject all at once; and a switch for tracking.',
            },
            {
              title: 'On the page',
              color: 'pink' as const,
              text: 'Each person’s changes in their colour, always the same for the same name; a move in green; and a bar in the margin beside each line with a change, of its text or of its formatting.',
            },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
        <h3 id="keys" className="m-0 mt-12 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          The keys, while tracking
        </h3>
        <dl className="m-0 mt-4 max-w-[920px] rounded-2xl border border-border px-5">
          {KEYS.map((row) => (
            <div key={row.key} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[200px_1fr]">
              <dt className="text-[15px] font-semibold text-ink">{row.key}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{row.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="in-code" className="mt-24">
        <SectionHead id="in-code" badge="Editor API" color="purple" title="In code">
          The editor of <code className={mono}>onReady</code>, or of{' '}
          <a href="/docs/editor-api/" className={LINK}>
            the Editor API
          </a>
          .
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: basic }} />
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {MEMBERS.map((m) => (
            <div key={m.sig} className="border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{m.sig}</dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{m.text}</dd>
            </div>
          ))}
        </dl>
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">RevisionView</h3>
        <dl className="m-0 mt-4 max-w-[920px] rounded-2xl border border-border px-5">
          {VIEW.map((field) => (
            <div key={field.name} className="border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="font-code text-[13.5px] text-ink">
                <span className="font-semibold">{field.name}</span>: <span className="text-muted">{field.type}</span>
              </dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{field.text}</dd>
            </div>
          ))}
        </dl>
        <h3 id="headless" className="m-0 mt-10 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          Headless
        </h3>
        <p className={prose}>
          <code className={mono}>DocsState</code> has <code className={mono}>trackChanges</code> and <code className={mono}>revisionCount</code>; the commands have the editor&apos;s methods of the
          same names, from <code className={mono}>setTrackChanges</code> to <code className={mono}>selectRevision</code>, for an interface of your own.
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: headless }} />
      </section>

      <section aria-labelledby="in-core" className="mt-24">
        <SectionHead id="in-core" badge="@rebodocs/core" color="orange" title="Tracking any edit">
          Whatever turned one document into another, made by a person, a program or a template, comes back as changes for someone to review. Change either text below.
        </SectionHead>
        <TrackEditDemo />
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: core }} />
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {CORE.map((fn) => (
            <div key={fn.sig} className="border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{fn.sig}</dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{fn.text}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          A change is part of the formatting of its text: <code className={mono}>revision</code>, <code className={mono}>revisionAuthor</code> and <code className={mono}>revisionDate</code> on a run,{' '}
          <code className={mono}>markRevision</code> on a paragraph for its mark. So it moves with the text: into the file, to the others in a{' '}
          <a href="/docs/collaboration/" className={LINK}>
            shared document
          </a>
          , and into undo.
        </p>
      </section>

      <section aria-labelledby="for-an-assistant" className="mt-24">
        <SectionHead id="for-an-assistant" badge="MCP" color="pink" title="For an assistant">
          While tracking is on, everything the{' '}
          <a href="/docs/assistants/" className={LINK}>
            assistant&apos;s tools
          </a>{' '}
          change is tracked, signed “Assistant”, so a person can review what it did before keeping it.
        </SectionHead>
        <div className="mt-6 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
          {TOOLS.map((tool) => (
            <div key={tool.name} className="rounded-2xl border border-border p-4">
              <p className="m-0 font-code text-[13.5px] font-semibold text-ink">{tool.name}</p>
              <p className="m-0 mt-1.5 text-[14px] leading-[1.55] text-ink-soft">{tool.text}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          <code className={mono}>read_document</code> shows what was put in as <code className={mono}>{'{+…+}'}</code> and what was taken out as <code className={mono}>[-…-]</code>:
        </p>
        <div className={`mt-3 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: mcp }} />
        <p className={prose}>
          The name is <code className={mono}>reviser</code> of the tools&apos; context, for a server that knows who the assistant works for.
        </p>
      </section>

      <section aria-labelledby="checked-against-word" className="mt-24">
        <SectionHead id="checked-against-word" badge="Word" color="blue" title="Checked against Word" />
        <p className={prose}>
          Documents with insertions, deletions, a split paragraph and a joined one were opened in Word for Mac. Word found the same changes, by the same authors. Accepting all of them, and rejecting
          all of them, gave the same text in Word as here. Changes made in Word read back the same way, and a file opened and saved without changes keeps its XML.
        </p>
        <p className={prose}>
          Text one person put in and another took out was checked in Word for Mac too: Word keeps it, a <code className={mono}>w:del</code> inside the <code className={mono}>w:ins</code>, as it is
          written here. So were changes of formatting and rows taken out, which Word lists by the same people.
        </p>
        <p className={prose}>
          A document that does not say its language has Word give every run the one it guesses when it opens it, and with changes tracked, that is a change of formatting of every run by whoever opened
          it. The DOCX the editor makes says it: the <code className={mono}>language</code> prop, or the language of the interface with the browser&apos;s region.
        </p>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge="Limits" color="yellow" title="What it does not do" />
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            'Rows of a table are tracked, put in and taken out. Columns and merged or split cells change untracked, as in Word: there, a column put in or taken out is only a change of the widths of the table, and taking it back gives the widths, not the column.',
            'Moves Word made are read, shown in green and decided both halves together. Written back, a paragraph changed here carries its move as text taken out and text put in; moving text here, cutting and pasting it, is the same.',
            'Shown with every change accepted, or with none, the document is only to be looked at: to edit, show the changes again.',
            'A paragraph break someone else put in, taken out, goes for good; their text stays, taken out.',
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
