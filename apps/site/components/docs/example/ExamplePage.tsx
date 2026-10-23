import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { LazyLiveDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const COLORS = ['blue', 'purple', 'yellow', 'green', 'pink', 'orange'] as const;
const REPO = 'https://github.com/JFranciscoRobles/rebodocs/tree/main/apps/demo';

/** The files of apps/demo, each checked there. */
const FILES: { file: string; text: string }[] = [
  { file: 'src/App.tsx', text: 'The two tabs, opening a file, and the sample it starts with. Holds the docx both editors are given.' },
  { file: 'src/FullEditor.tsx', text: 'DocsEditor, in a dozen lines.' },
  { file: 'src/HeadlessEditor.tsx', text: 'The provider and the layout: title bar, formatting bar, insert rail, find bar, ruler, pages, status bar.' },
  { file: 'src/headless/Panels.tsx', text: 'The side panel and its four tabs: format, page, content, notes.' },
  { file: 'src/headless/texts.ts', text: 'The interface’s own words, in Spanish and English, and useTexts, which draws a component again when the language changes.' },
  { file: 'src/headless/Icon.tsx · options.ts', text: 'The icons, and the lists offered: sizes, zooms, line heights, highlights, cell shades.' },
  { file: 'src/download.ts', text: 'Handing a file to the person: there is no backend, so saving downloads the DOCX.' },
  { file: 'src/HeadlessEditor.css', text: 'All of its look. Every rule is under .hd, so it touches nothing else; the colours of what the library puts in the body are set on body:has(.hd).' },
  { file: 'scripts/sample.ts', text: 'Writes the sample agreement with the engine, without a browser, in English.' },
];

/** Which piece of the interface is made with what, from HeadlessEditor.tsx and Panels.tsx. */
const USES: { piece: string; with: string }[] = [
  {
    piece: 'Name, unsaved mark, save, export to Word, PDF and Markdown, print',
    with: 'useDocs: state.name, state.dirty, docs.save(), docs.download(), editor.exportPdf(), editor.exportMarkdown(), commands.print()',
  },
  { piece: 'Undo, style, font, size, bold…, colour, alignment, lists, indent, zoom', with: 'useDocs, useDocsStyles, fontFamilies, useDocsValue for the indent' },
  { piece: 'Table, pictures, signatures, page break', with: 'commands.insertTable, insertImageFile, insertImageGrid, insertSignatures, insertPageBreak' },
  { piece: 'Link, variable and note buttons, and ⌘K', with: 'useDocsBubble: bubble.ask(…), with <DocsProvider bubble>; useDocsLink, useDocsVariables and useDocsNotes say when each is on' },
  { piece: 'Find and replace, and ⌘F', with: 'useDocsFind, opened by onFindKey' },
  { piece: 'Ruler', with: 'DocsRuler, coloured with --dx-ruler…' },
  { piece: 'Format tab: highlight, spacing, the cells of a table', with: 'useDocs, useDocsValue for activeParagraphProps(), activeCellProps() and tableBorders()' },
  { piece: 'Page tab: size, margins, columns, letterhead, header and footer, page number', with: 'useDocsPage, useDocsValue for the columns, commands.setArea' },
  { piece: 'Content tab: table of contents, outline to drag, variables with a type', with: 'useDocsOutline, useDocsVariables, commands.insertToc' },
  { piece: 'Notes tab', with: 'useDocsNotes, NOTE_COLORS, docs.setAuthor' },
  {
    piece: 'Status bar: page, style and font, words and characters, saved, language, view, notes, zoom',
    with: 'useDocs, useDocsStyles, useDocsCount, setLocale, commands.setView, setShowNotes, setZoom',
  },
  { piece: 'A narrow window', with: 'useDocsResponsive, and a media query for the layout' },
];

/** What it had to get right. */
const RIGHT: { title: string; text: string }[] = [
  { title: 'One value for docx', text: 'App keeps the bytes in state and gives the same Uint8Array at every render. A new array each time would open the document again and lose what was typed.' },
  {
    title: 'Buttons that keep the selection',
    text: 'Every command gives the keyboard back to the document, so buttons need nothing. A select or an input takes it while it is used, and the command it ends in gives it back.',
  },
  {
    title: 'Colours as the editor has them',
    text: 'state.color is hex without #; a colour input wants one with it: options.ts has the line between them. A highlight is one of Word’s fifteen, so it is offered as swatches.',
  },
  {
    title: 'The list, with what is there now',
    text: 'A document may use a size or a zoom that is not in the list offered. withCurrent adds the present one, so a select never shows something it is not.',
  },
  {
    title: 'Indent or level',
    text: 'The two indent buttons change the level of an item in a list (shiftListLevel) and the indent of a paragraph outside one (shiftIndent), as the included toolbar does.',
  },
  {
    title: 'Language',
    text: 'The selector calls setLocale: the library’s own words change (the bar, the ruler, the names of styles), and useTexts draws the demo’s again. The ruler is made again, with a key, to take its words.',
  },
];

/**
 * "A complete interface": apps/demo on the page, its files, which piece uses
 * which hook, its skeleton read from its own file, what it had to get right,
 * and running it.
 */
export async function ExamplePage() {
  const source = readFileSync(join(process.cwd(), '../demo/src/HeadlessEditor.tsx'), 'utf8');
  const skeletonSource = source.slice(source.indexOf('/** What is inside the provider')).trim();
  const [run, skeleton] = await Promise.all([
    highlight(
      `git clone https://github.com/JFranciscoRobles/rebodocs
cd rebodocs
npm install
npm run demo        # http://localhost:5175, and /#headless for the second tab`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(skeletonSource, 'tsx', LIGHT_THEME),
  ]);

  const rows = (list: [string, string][], width = 280) => (
    <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
      {list.map(([term, text]) => (
        <div key={term} className="grid gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${width}px),1fr))` }}>
          <dt className="text-[15px] font-semibold text-ink [overflow-wrap:anywhere]">{term}</dt>
          <dd className="m-0 font-code text-[13px] leading-[1.6] text-ink-soft [overflow-wrap:anywhere]">{text}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">A complete interface</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        The repository has an application that uses <code className={mono}>@rebodocs/react</code> the way yours would:{' '}
        <a href={REPO} className={LINK}>
          apps/demo
        </a>
        . It shows a document two ways: the editor as it comes (<code className={mono}>DocsEditor</code>), and an interface built from nothing on the hooks, dark and laid out like a design tool. The
        second does everything the first does, so it is the place to copy from.
      </p>
      <div className="mt-4">
        <HandTip>tip: this is the second one, running: try the panels at its right</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="Your own interface, running">
          The component of <code className={mono}>apps/demo/src/HeadlessEditor.tsx</code>, imported here as it is, on the contract it opens with: a template in English with headings, variables with a
          type, a table, text in two columns, places to sign, a header and a page number. The interface opens in English; the selector in its status bar puts it in Spanish.
        </SectionHead>
        <LazyLiveDemo />
        <p className={prose}>
          Both tabs, full screen, with a DOCX of your own:{' '}
          <a href="/demo/" className={LINK}>
            rebodocs.com/demo
          </a>{' '}
          (<code className={mono}>/demo/#full</code> opens on the included one).
        </p>
      </section>

      <section aria-labelledby="run" className="mt-24">
        <SectionHead id="run" badge="Run" color="blue" title="Run it">
          It runs the package from its source, so a change in <code className={mono}>packages/react</code> shows at once. That is the one line of its <code className={mono}>vite.config.ts</code> a
          copy in a project of yours leaves out: there, <code className={mono}>@rebodocs/react</code> comes from npm.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: run }} />
        <p className={prose}>
          <strong>Open a .docx</strong> opens a file in both tabs; there is no backend, so saving downloads it.
        </p>
      </section>

      <section aria-labelledby="what-is-where" className="mt-24">
        <SectionHead id="what-is-where" badge="Files" color="purple" title="What is where" />
        {rows(FILES.map((one) => [one.file, one.text]))}
      </section>

      <section aria-labelledby="which-piece-uses-what" className="mt-24">
        <SectionHead id="which-piece-uses-what" badge="Hooks" color="yellow" title="Which piece uses what">
          Each hook is on the page{' '}
          <a href="/docs/components/" className={LINK}>
            Components and hooks
          </a>
          , with what it takes and gives.
        </SectionHead>
        {rows(
          USES.map((one) => [one.piece, one.with]),
          300,
        )}
      </section>

      <section aria-labelledby="the-skeleton" className="mt-24">
        <SectionHead id="the-skeleton" badge="Skeleton" color="pink" title="The skeleton">
          Everything hangs from one provider. What a key must reach (⌘F opens the find bar) is above it; the rest is inside. This is the end of <code className={mono}>HeadlessEditor.tsx</code>, read
          from the file.
        </SectionHead>
        <div className={`mt-6 max-w-[920px] ${CODE}`} dangerouslySetInnerHTML={{ __html: skeleton }} />
        <p className={prose}>
          The column the pages are in is <code className={mono}>display: flex; flex-direction: column; min-width: 0</code>, and the surface <code className={mono}>flex: 1; min-height: 0</code>: that
          is what gives it the height it needs and lets it scroll. Under 900 pixels of window a media query lays it out again: the bars become one row each that slides, the insert rail lies down, the
          panels open over the document from a button, and the ruler goes.
        </p>
      </section>

      <section aria-labelledby="things-it-had-to-get-right" className="mt-24">
        <SectionHead id="things-it-had-to-get-right" badge="Details" color="orange" title="Things it had to get right" />
        <div className="mt-7 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))' }}>
          {RIGHT.map((card, i) => (
            <div key={card.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i % COLORS.length]]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          The library’s own pieces take its colours from variables, not from rules that reach into their classes: the ruler from <code className={mono}>--dx-ruler…</code> set on{' '}
          <code className={mono}>.hd</code>; the bar beside the selection, and the rest the library puts in <code className={mono}>document.body</code> outside <code className={mono}>.hd</code>, from
          the{' '}
          <a href="/docs/styling/#the-included-interface" className={LINK}>
            --dx-ui-… variables
          </a>{' '}
          set on <code className={mono}>body:has(.hd)</code>, while the interface is on the page.
        </p>
      </section>

      <section aria-labelledby="using-it-for-a-demonstration" className="mt-24">
        <SectionHead id="using-it-for-a-demonstration" badge="Show it" color="green" title="Using it for a demonstration" />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>
            <a href="/demo/" className={LINK}>
              rebodocs.com/demo
            </a>{' '}
            has it online, with nothing to install.
          </li>
          <li>
            <code className={mono}>npm run demo</code> and open <code className={mono}>/#headless</code> for your own interface, or <code className={mono}>/</code> for the included one.
          </li>
          <li>
            <strong>Open a .docx</strong> shows a real document of the person you are showing it to, in both.
          </li>
          <li>
            <code className={mono}>npm run build:demo</code> writes <code className={mono}>apps/demo/dist</code>, a static site to put anywhere.
          </li>
          <li>
            To change what it opens with, edit <code className={mono}>scripts/sample.ts</code>: <code className={mono}>npm run sample -w @rebodocs/demo</code> writes the file again.
          </li>
        </ul>
      </section>
    </>
  );
}
