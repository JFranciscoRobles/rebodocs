import type { ReactNode } from 'react';
import { PASTEL_CLASS } from '@/lib/home';
import { LINK } from '../styles';
import { SectionHead } from '../ui';
import { AGAINST_WORD, MEASURED, TESTS, linesLikeWord } from './data';
import { WordTable } from './WordTable';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

const link = (href: string, text: string) => (
  <a href={href} className={LINK}>
    {text}
  </a>
);

/** Checked by hand, in headless Chrome with real clicks, keys and touches. */
const BY_HAND: ReactNode[] = [
  'The toolbar, tables, header and footer, page numbers, letterhead.',
  'Collaboration between two tabs, on a local network and between different networks behind an HTTPS proxy, two browsers typing over a real bucket: typing at once, undo per person, tables, reconnection.',
  'The React component in a Next.js 16 application with Tailwind 4 (this site): server rendering, saving, features, the handle, the headless hooks.',
  'A phone-sized screen with touch: taps, a hold, pinch, the selection handles, composed input.',
  <>
    {link('/docs/accessibility/', 'Accessibility')}: what is announced after each key, F6 and Alt+F10, every menu and dialog from the keyboard, the ruler, screen reader mode, high contrast, and axe on
    every page with an editor.
  </>,
  'The real-time and CRM demos opened and driven: a room opened from the list, a contract generated from a record.',
  'Touch on one real phone.',
];

const NOT: [string, ReactNode][] = [
  ['Every demo, clicked through.', 'The storage and assistant demos were checked through their backends and tests; the real-time and CRM ones were opened and driven, not every flow of them.'],
  [
    'Many documents.',
    'The pagination rules were derived from files in Arial, Times New Roman, Georgia and Verdana with Word for Mac. Other fonts and versions of Word may differ. Word kerns with the table of pairs in the font file; the browser kerns with another table of the font, and for Times New Roman leaves out the pairs with a space, so a line in Times can come out a fraction of a point apart from Word’s in the editor, though not in the PDF.',
  ],
  ['Many phones.', 'One real device. Keyboards differ.'],
  ['The desktop application outside a Mac.', 'Windows and Linux compile the same code but are untried, and so is opening a document with a double click in them.'],
  [
    'Pasting from every program.',
    'What Word for Mac puts on the clipboard was read for sixteen tables of a document, with tests that keep it; Google Docs and web pages, with samples. Word on Windows, LibreOffice, Excel and Google Sheets write HTML of their own and are untried.',
  ],
  ['Claude with a real key.', 'The chat and its route were tested against a Claude of the tests’ own; a conversation with the real API has not been tried in the repository.'],
  ['Screen readers.', 'What the editor announces was read in Chrome, not listened to with VoiceOver, NVDA or JAWS; the tagged PDF passes veraPDF, but no screen reader read it.'],
];

const LIMITS: { area: string; color: 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'yellow'; items: ReactNode[] }[] = [
  {
    area: 'The format',
    color: 'blue',
    items: [
      'Text boxes are drawn as rectangles with a plain fill and line, not turned; one too small for its text loses whole lines where Word cuts one in half. Those only in VML, from old files, are kept but not shown.',
      <>Columns of a table and merged or split cells change untracked, as in Word; rows and changes of formatting are tracked (see {link('/docs/tracked-changes/', 'tracked changes')}).</>,
      'Footnotes of a section in columns go across the whole page, and a reference in a table cell does not make room for its note.',
      'Comparing versions covers the text and its look, not the page, the sections, style definitions or the size of pictures. A change of look is listed but not marked.',
      'No right-to-left text, and no scripts that need shaping.',
      'No hyphenation: a line breaks only where there is a space or a hyphen.',
    ],
  },
  {
    area: 'Output',
    color: 'green',
    items: [
      'PDF embeds TrueType and OpenType fonts, TrueType ones cut down to the characters used; OpenType ones in CFF go whole. It is tagged, and passes veraPDF’s PDF/UA-1 checks when every font is in it, the document has a title and a language, and every picture has a description.',
      <>
        Fonts an application gives go into the DOCX only when they are TrueType and their licence lets them: whole, or cut down to the characters used with{' '}
        <code className={mono}>embedFonts: &apos;subset&apos;</code>.
      </>,
    ],
  },
  {
    area: 'The editor',
    color: 'purple',
    items: [
      'Pasting from Word, Google Docs or a web page keeps the formatting of the text, links, lists, headings and tables (their merged cells, widths and heading rows), but not the pictures in it; a table inside a cell comes as lines with tabs, and the colours a table style gives the bands of a table do not come, as Word leaves them out of what it puts on the clipboard. No drag and drop of text.',
      <>
        A screen reader hears the document through announcements, or through the paragraph in {link('/docs/accessibility/#screen-reader-mode', 'screen reader mode')}; it cannot browse the pages as a
        web page.
      </>,
      <>Spelling needs dictionaries the application gives, Hunspell’s; the text of a language without one is not checked, nor is grammar (see {link('/docs/languages/#spelling', 'spelling')}).</>,
      'Only the pages near the view are drawn, but the whole document is laid out again on each change: on a desktop computer that is about 9 ms a key at 200 pages.',
    ],
  },
  {
    area: 'Templates',
    color: 'yellow',
    items: [
      <>
        Without a currency code, <code className={mono}>currency</code> writes a dollar sign, whatever the language.
      </>,
    ],
  },
  {
    area: 'Collaboration',
    color: 'orange',
    items: [
      'One server process holds a room.',
      'Access is checked on joining, and while connected only when the server is told to (--recheck-every, server.recheck()).',
      <>
        Two people cutting, joining and taking out paragraphs around the same place at the same instant can, rarely, end with different documents for a moment: the server’s check finds it within a
        couple of seconds and the editor loads the room again, keeping what was typed, but what can be undone starts over (see{' '}
        {link('/docs/collaboration/#when-two-people-change-the-same-thing', 'collaboration')}).
      </>,
      <>
        A hard crash of the server loses the changes since the last save: 5 seconds after people stop typing, 30 at most while they go on (<code className={mono}>--save-after</code>,{' '}
        <code className={mono}>--save-every</code>). The server keeps no versions: the application does, and the editor compares and restores them (see {link('/docs/versions/', 'versions')}).
      </>,
    ],
  },
  {
    area: 'Packaging',
    color: 'pink',
    items: [
      <>
        Every package is on npm. <code className={mono}>@rebodocs/react</code> has the engine inside; an application that also installs <code className={mono}>@rebodocs/core</code> carries the engine
        twice.
      </>,
      'The English interface texts were translated from Spanish and need a native review.',
    ],
  },
];

const ROADMAP: [string, string][] = [
  ['Use it in a real application,', 'and fix what that shows.'],
  ['More of it tested in a browser.', 'The editor has its tests in Chrome now; the toolbar, the panels and the demos have none yet, and the measurements against Word could run there too.'],
  ['Collaboration that scales:', 'several server processes per room, and a log kept as it is written.'],
  [
    'Versions while people work:',
    'a version every so often of editing (versionEvery), signed by who changed the document in that time, besides the one when the last person leaves; a room left open all day keeps none until then.',
  ],
  ['Screen readers for real:', 'VoiceOver, NVDA and JAWS on the editor and on its PDF.'],
  ['Pasting pictures', 'from Word and the web: tables come with their look, pictures do not yet.'],
];

/**
 * "Status and roadmap": what is checked, with the tests by package and the
 * measurements against Word as they were taken; what is not; the known
 * limits; the roadmap; contributing; the license.
 */
export async function StatusPage() {
  const total = TESTS.reduce((sum, row) => sum + row.count, 0);
  const most = Math.max(...TESTS.map((row) => row.count));

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Status and roadmap</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        Rebodocs is a word processor compatible with Word files. It is not a copy of Word and is not meant to become one. It is tested and published on npm. This page says what has been checked and
        how, and what is missing, without rounding up.
      </p>

      <section aria-labelledby="what-is-checked" className="mt-16">
        <SectionHead id="what-is-checked" badge="Checked" color="green" title="What is checked">
          The numbers here were taken on {MEASURED}, by running the commands named.
        </SectionHead>

        <h3 className="m-0 mt-10 font-display text-xl font-bold">{total} automated tests</h3>
        <p className={prose}>
          <code className={mono}>npm test</code>, every one passing:
        </p>
        <ul className="m-0 mt-5 grid max-w-[920px] list-none gap-3 p-0">
          {TESTS.map((row) => (
            <li key={row.where} className="grid items-center gap-x-5 gap-y-1 md:grid-cols-[150px_200px_1fr]">
              <code className="font-code text-[13px] font-semibold text-ink">{row.where}</code>
              <span className="flex items-center gap-2.5">
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#efede8]" aria-hidden="true">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${(row.count / most) * 100}%` }} />
                </span>
                <span className="w-9 text-right font-code text-[13px] text-ink">{row.count}</span>
              </span>
              <span className="text-[14px] leading-normal text-ink-soft">{row.what}</span>
            </li>
          ))}
        </ul>

        <h3 className="m-0 mt-14 font-display text-xl font-bold">The layout, against Word</h3>
        <p className={prose}>
          Each document is laid out here and compared, line by line, with the PDF Word for Mac exports of it: which lines start with the same text at the same height, and how far apart they are. They
          are made up for it, with invented text and pictures of one colour, and kept in the repository with Word’s PDF of each, in <code className={mono}>test-documents/</code>: anyone can run{' '}
          <code className={mono}>npm run word-check</code> without Word, and <code className={mono}>npm run word-compare -- file.docx</code> measures a document of one’s own.
        </p>
        <p className={prose}>
          Across the {AGAINST_WORD.length}, <strong className="font-semibold text-ink">{linesLikeWord()}%</strong> of the lines Word wrote are where Word puts them. The work goes on to reach all of
          them.
        </p>
        <WordTable />
        <p className={prose}>
          Where it differs: three cases of floating pictures, where a line at the foot of a page, beside a picture or just below one, goes on to the next page in Word with a point or less to spare in
          the editor; every line after it is then a line off.
        </p>

        <h3 className="m-0 mt-14 font-display text-xl font-bold">Round trip</h3>
        <p className={prose}>The 17 documents measured open and save again with the same text, the same paragraphs and the same pictures. Word opens what is exported without warnings.</p>

        <h3 className="m-0 mt-14 font-display text-xl font-bold">The interface</h3>
        <ul className="m-0 mt-5 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          {BY_HAND.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>

        <h3 className="m-0 mt-14 font-display text-xl font-bold">A real bucket</h3>
        <p className={prose}>
          The backend of the {link('/docs/storage/', 'storage demo')} was run by hand, from Node, against Cloudflare R2: listing, reading and writing with signed addresses, the origin rule, the PDF
          made on the server, and coming into a room whose document is in the bucket.
        </p>
      </section>

      <section aria-labelledby="what-is-not" className="mt-24">
        <SectionHead id="what-is-not" badge="Untried" color="yellow" title="What is not" />
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {NOT.map(([title, text]) => (
            <div key={title} className="grid gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3.5 first:border-t-0 md:grid-cols-[260px_1fr]">
              <dt className="text-[15px] font-semibold text-ink">{title}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="known-limits" className="mt-24">
        <SectionHead id="known-limits" badge="Limits" color="orange" title="Known limits" />
        <div className="mt-6 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))' }}>
          {LIMITS.map((group) => (
            <div key={group.area} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[group.color]}`}>{group.area}</span>
              <ul className="m-0 mt-3 grid list-none gap-2.5 p-0">
                {group.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[15px] leading-[1.55] text-ink-soft">
                    <span aria-hidden="true" className="mt-2 size-1.5 flex-none rounded-full bg-[#c9c6bf]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="roadmap" className="mt-24">
        <SectionHead id="roadmap" badge="Next" color="purple" title="Roadmap">
          In rough order of how much each would matter.
        </SectionHead>
        <ol className="m-0 mt-6 grid max-w-[760px] list-decimal gap-2.5 pl-6 text-base leading-[1.6] text-ink-soft">
          {ROADMAP.map(([lead, text]) => (
            <li key={lead}>
              <strong className="font-semibold text-ink">{lead}</strong> {text}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="contributing" className="mt-24">
        <SectionHead id="contributing" badge="Help" color="blue" title="Contributing" />
        <p className={prose}>
          The repository’s <code className={mono}>CONTRIBUTING.md</code> says how to set up and what the conventions are. Each package’s README ends with a list of where it can improve: good places to
          start.
        </p>
      </section>

      <section aria-labelledby="license" className="mt-24">
        <SectionHead id="license" badge="MIT" color="green" title="License" />
        <p className={prose}>MIT. Anyone may use it for anything.</p>
      </section>
    </>
  );
}
