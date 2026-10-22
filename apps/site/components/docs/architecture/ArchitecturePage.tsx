import { LIGHT_THEME, highlight } from '@/lib/docs';
import { REPO } from '@/lib/site';
import { CAPTION, CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { CollabDemo } from './CollabDemo';
import { PLACES, STEPS } from './data';
import { DocxDemo } from './DocxDemo';
import { KeystrokeSteps } from './KeystrokeSteps';
import { LayoutDemo } from './LayoutDemo';
import { PagesDemo } from './PagesDemo';
import { PaintDemo } from './PaintDemo';
import { ValueDemo } from './ValueDemo';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const card = 'lift rounded-2xl border border-border p-5.5';

type Cost = { what: string; state: 'handled' | 'partly' | 'missing'; text: string; link?: [string, string] };

/** What the browser no longer does once there is no contenteditable, and what the editor does in its place. */
const COSTS: Cost[] = [
  {
    what: 'Screen readers',
    state: 'handled',
    text: 'The textarea holds none of the text, so the editor says in a live region what the caret moved over, what was selected or deleted, and the page, table or list it is in. Screen reader mode (⌘⌥Z, Ctrl+Alt+Z elsewhere) puts the paragraph in the field, so the reader’s own commands and a braille display work.',
    link: ['Accessibility', '/docs/accessibility/'],
  },
  {
    what: 'Keyboard and high contrast',
    state: 'handled',
    text: 'F6 goes round the parts of the editor, Alt+F10 to the toolbar, Escape back to the document. With forced colours, the caret, the selection and what is on keep the system’s colours.',
    link: ['The keyboard', '/docs/accessibility/#the-keyboard'],
  },
  {
    what: 'Other scripts and phone keyboards',
    state: 'handled',
    text: 'A word being composed — Japanese, Chinese, a phone that suggests — is shown as it is written and changed when the keyboard corrects it.',
  },
  {
    what: 'Find',
    state: 'handled',
    text: '⌘F and ⌘H (Ctrl elsewhere) open the editor’s own find bar, which searches the document, not the screen, and replaces.',
  },
  {
    what: 'Copy and paste',
    state: 'partly',
    text: 'Copying gives plain text, HTML and the editor’s own format. Pasting from Word, Google Docs or a page keeps the formatting, links, lists and headings, but not pictures, and a table comes as lines with tabs.',
    link: ['Status', '/docs/status/'],
  },
  {
    what: 'Selecting by touch',
    state: 'handled',
    text: 'The selection is drawn by the editor, with handles to drag on a phone, and pages zoom with two fingers.',
    link: ['Mobile', '/docs/mobile/'],
  },
  {
    what: 'Spell check',
    state: 'handled',
    text: 'A browser checks spelling only in text it edits, and here it edits none: the editor checks it itself, with Hunspell dictionaries in a worker, and draws the red wave and the suggestions.',
    link: ['Spelling', '/docs/languages/#spelling'],
  },
  { what: 'Dragging text', state: 'missing', text: 'Text cannot be dragged to another place yet; cut and paste does it.' },
];

const STATE = {
  handled: ['Handled', 'bg-pastel-green text-pastel-green-fg'],
  partly: ['In part', 'bg-pastel-yellow text-pastel-yellow-fg'],
  missing: ['Not yet', 'bg-pastel-pink text-pastel-pink-fg'],
} as const;

function Gains({ items }: { items: [title: string, text: string][] }) {
  return (
    <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
      {items.map(([title, text]) => (
        <div key={title} className={card}>
          <p className="m-0 font-display text-base font-bold tracking-[-0.01em]">{title}</p>
          <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{text}</p>
        </div>
      ))}
    </div>
  );
}

function Checks({ items }: { items: string[] }) {
  return (
    <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-x-8 gap-y-2.5 p-0">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-[15px] leading-[1.55] text-ink-soft">
          <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true" className="mt-1 flex-none">
            <path d="M2.5 6.2l2.2 2.2L9.5 3.6" fill="none" stroke="#2E6B3C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * "How it works": the decisions that explain most of the code, each with a
 * demo of the idea. The demos are small, made the way the engine is, not the
 * engine itself.
 */
export async function ArchitecturePage() {
  const stepCode = await Promise.all(STEPS.map((step) => highlight(step.code, step.code.startsWith('<') ? 'html' : 'ts', LIGHT_THEME)));
  const valueCode = await highlight(
    `const next = insertText(doc, { para: 3, offset: 0 }, 'Hello').doc;
next.paragraphs[0] === doc.paragraphs[0];   // true: untouched, so the very same object`,
    'ts',
    LIGHT_THEME,
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">How it works</h1>
      <p className="m-0 mt-3.5 max-w-[680px] text-lg leading-[1.6] text-muted">Four decisions explain most of the code, and a fifth explains how several people work on one document. Each has a small demo, made the way the engine is.</p>
      <div className="mt-4">
        <HandTip>tip: follow one keystroke first</HandTip>
      </div>

      <section aria-labelledby="keystroke" className="mt-16">
        <SectionHead id="keystroke" badge="Start here" color="blue" title="The path of a keystroke">
          One letter typed, from the key to the screen of everyone on the document. Each step is one of the decisions below.
        </SectionHead>
        <KeystrokeSteps code={stepCode} />
      </section>

      <section aria-labelledby="value" className="mt-24">
        <SectionHead id="value" badge="Decision 1" color="blue" title="The document is a value" />
        <p className={prose}>
          A <code className={mono}>Doc</code> is plain immutable data: paragraphs of runs, tables, the sections and their pages, headers and footers, footnotes, text boxes, styles, numbering, media.
          Headers, footers, footnotes and text boxes are <em>stories</em>: paragraphs of their own, edited the same way as the body. Nothing mutates one. An operation takes a document and returns
          another, sharing everything it did not touch.
        </p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: valueCode }} />
        <ValueDemo />
        <p className="m-0 mt-8 font-display text-lg font-bold tracking-[-0.01em]">That one rule gives a lot for free</p>
        <Gains
          items={[
            ['Undo', 'Is keeping the previous document.'],
            ['Change detection', 'Is ===.'],
            ['Layout caching', 'A paragraph that is the same object as last time breaks into the same lines.'],
            ['Collaboration', 'The difference between two documents is found by comparing references.'],
          ]}
        />
      </section>

      <section aria-labelledby="layout" className="mt-24">
        <SectionHead id="layout" badge="Decision 2" color="purple" title="Layout is ours" />
        <p className={prose}>
          The browser is asked one thing: how wide is this piece of text in this font. Everything else is worked out by the engine. Because the rules are ours, they can be the ones Word documents are
          written for, and a file looks the same here as there — which a browser’s own line breaking would never give. The aim is compatibility, not imitation: the same document, the same pages.
        </p>
        <LayoutDemo />
        <p className="m-0 mt-8 font-display text-lg font-bold tracking-[-0.01em]">What the engine works out</p>
        <Checks
          items={[
            'Lines, with justification, tab stops, and Word’s rule for how far spaces may shrink to take one more word.',
            'Pages: widow and orphan control, keep-with-next, keep-lines-together, page breaks.',
            'Sections, each with its own page size, margins, columns, header and footer.',
            'Tables, with rows that split across pages, tables inside cells, and text on its side.',
            'Headers and footers that take room from the text when they are tall.',
            'Footnotes at the foot of the page that refers to them.',
            'Floating pictures and text boxes, and the text that goes round them.',
            'Lengths in points throughout, as in Word.',
          ]}
        />
        <p className={prose}>Lines then go into pages, by Word’s rules for where a page may end.</p>
        <PagesDemo />
        <p className={prose}>
          And because the only thing asked from outside is a width, the same code runs in Node with font files in place of a browser: that is how PDFs are made on a server.
        </p>
      </section>

      <section aria-labelledby="painting" className="mt-24">
        <SectionHead id="painting" badge="Decision 3" color="yellow" title="Painting is placing" />
        <p className={prose}>
          The editor does not hand text to the browser to lay out. Each piece of text is a <code className={mono}>span</code> placed at the coordinates the layout gave; the browser never wraps a line, so
          what is on screen is exactly what was computed, and what will be printed. There is no <code className={mono}>contenteditable</code>: a hidden <code className={mono}>textarea</code> follows the
          caret and has the focus; what is typed arrives there and becomes an operation. Movement keys and shortcuts are taken in <code className={mono}>keydown</code>, and the caret and the selection
          are drawn by the editor.
        </p>
        <PaintDemo />
      </section>

      <section aria-labelledby="docx" className="mt-24">
        <SectionHead id="docx" badge="Decision 4" color="green" title="DOCX without loss" />
        <p className={prose}>A DOCX is a ZIP of XML with far more in it than any editor models. To not destroy what is not understood:</p>
        <Checks
          items={[
            'Every imported paragraph remembers the XML it came from.',
            'A paragraph that was not touched is written back byte for byte.',
            'One that was changed is rewritten, keeping the properties the model does not know about.',
            'Parts of the file the editor never reads — themes, custom XML, settings — are copied through.',
          ]}
        />
        <DocxDemo />
      </section>

      <section aria-labelledby="collab" className="mt-24">
        <SectionHead id="collab" badge="Together" color="pink" title="Collaboration" />
        <p className={prose}>
          Paragraphs get an id while a document is shared, and a change names paragraphs by id, so it still means the same after someone added a paragraph above. Headers, footers, footnotes and text
          boxes are sent the same way, and tracked changes go along as part of the formatting of their text.
        </p>
        <CollabDemo />
        <p className="m-0 mt-8 font-display text-lg font-bold tracking-[-0.01em]">The hard cases</p>
        <Gains
          items={[
            ['A deletion', 'Carries the paragraph it takes out, so that what someone was writing in it meanwhile stays.'],
            ['Formatting', 'Says it is formatting, and is made letter by letter.'],
            ['Enter', 'Carries the formatting of the new paragraph.'],
            ['Undo', 'Sends the inverse of your own step, transformed against what others did since: it never takes back someone else’s work.'],
          ]}
        />
      </section>

      <section aria-labelledby="costs" className="mt-24">
        <SectionHead id="costs" badge="The price" color="purple" title="What it costs">
          Without contenteditable, everything the browser gives an editable page for free has to be done again. This is what was, and what was not.
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4">
          {COSTS.map((cost) => (
            <div key={cost.what} className={card}>
              <p className="m-0 flex items-center justify-between gap-3">
                <span className="font-display text-base font-bold tracking-[-0.01em]">{cost.what}</span>
                <span className={`flex-none rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATE[cost.state][1]}`}>{STATE[cost.state][0]}</span>
              </p>
              <p className="m-0 mt-1.5 text-[15px] leading-[1.6] text-ink-soft">{cost.text}</p>
              {cost.link && (
                <a href={cost.link[1]} className={`mt-2 inline-block text-sm ${LINK}`}>
                  {cost.link[0]} →
                </a>
              )}
            </div>
          ))}
        </div>
        <p className={prose}>
          What is announced was read in Chrome, not yet listened to with VoiceOver, NVDA or JAWS. The <a href="/docs/status/" className={LINK}>status page</a> keeps the list of what is missing.
        </p>
      </section>

      <section aria-labelledby="files" className="mt-24">
        <SectionHead id="files" badge="Reference" color="orange" title="Where things live">
          To read the code from here: what each file holds, by package.
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-5">
          {PLACES.map(({ pkg, places }) => (
            <div key={pkg} className="rounded-2xl border border-border p-5.5">
              <p className={CAPTION}>{pkg}</p>
              <dl className="m-0 mt-2.5">
                {places.map((place) => (
                  <div key={place.paths.join()} className="border-t border-[#f0eee9] py-2.5">
                    <dt className="flex flex-wrap gap-x-2">
                      {place.paths.map((path, i) => {
                        const full = i === 0 ? path : place.paths[0].replace(/[^/]+$/, path);
                        return (
                          <a key={path} href={`${REPO}/${full.endsWith('/') ? 'tree' : 'blob'}/main/${full}`} className="py-1 font-code text-[13px] text-brand hover:text-brand-hover">
                            {path}
                          </a>
                        );
                      })}
                    </dt>
                    <dd className="m-0 mt-0.5 text-[15px] leading-normal text-ink-soft">{place.what}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
