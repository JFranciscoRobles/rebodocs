import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { LazyStateDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** What `state` has, from DocsState in packages/react/src/docs.ts. */
const STATE: [string, string][] = [
  ['Text at the selection', 'bold, italic, underline, strike, fontFamily, fontSize, color, highlight, link'],
  ['Paragraph', 'align, lineHeight, styleId, list'],
  ['What can be done', 'canUndo, canRedo, collapsed, inTable, canEditTables, canMergeCells, canSplitCell, pictureSelected'],
  ['Review', 'trackChanges, changesView, revisionCount'],
  ['Where', 'area (body, header or footer), page, pageCount'],
  ['View', 'zoom, view, fit, touch'],
  ['Document', 'name, dirty, saves, letterhead, fonts'],
  ['Search', 'findCount, findIndex'],
  ['People', 'collab, peers, me'],
];

/** The commands, from the list of them in docs.ts. */
const COMMANDS: [string, string][] = [
  ['History', 'undo, redo'],
  ['Text', 'toggleMark, setRunProps, insertText, selectAll, copy, cut, paste'],
  ['Paragraph', 'setParagraphProps, setParagraphStyle, toggleList, shiftListLevel, setListStyle, restartNumbering, continueNumbering, shiftIndent, insertPageBreak'],
  ['Tables', 'insertTable, insertTableRow, insertTableColumn, deleteTableRow, deleteTableColumn, deleteTable, mergeTableCells, splitTableCell, setTableCellProps, setTableBorders, setTableRowHeight, setHeaderRow'],
  ['Pictures', 'insertImageFile, insertImageGrid, setPictureWrap, fitSelectedPicture'],
  ['Templates', 'insertVariable, fillVariables, insertSignatures'],
  ['Links and notes', 'setLink, removeLink, addNote, setNoteText, setNoteColor, removeNote, selectNote'],
  ['Structure', 'insertToc, updateToc, goToHeading, moveSection, insertFootnote, insertTextBox, restoreVersion'],
  ['Review', 'setTrackChanges, setChangesView, acceptRevision, rejectRevision, acceptAllRevisions, rejectAllRevisions, goToRevision, selectRevision'],
  ['Columns and sections', 'setColumns, insertColumnBreak, insertSectionBreak'],
  ['Page', 'setPage, setPageNumbering, setFirstPageDifferent, setOwnHeaders, setArea, setLetterhead, setLetterheadFile, fitLetterheadMargins, removeLetterhead'],
  ['Search', 'find, findStep, replaceFound, replaceAllFound'],
  ['View', 'setZoom, setFit, setView, setShowNotes, print'],
];

/** The hooks, from packages/react/src/pieces.ts. */
const HOOKS: [string, string][] = [
  ['useDocsFind()', 'query, setQuery, options, setOptions, count, index, next, previous, replace, replaceAll, close'],
  ['useDocsLink()', 'active (address and text), possible, set, remove, open'],
  ['useDocsNotes()', 'notes, active, add, setText, setColor, remove, select'],
  ['useDocsOutline()', 'items, active, goTo, move'],
  ['useDocsVariables()', 'names, active, insert, select, blocks, fill; and what each asks of its value: formats, uses, setFormat, preview'],
  ['useDocsStyles()', 'styles, active, set'],
  ['useDocsPage()', 'page, set, sections, section, ownHeaders, numbering, firstPageDifferent, and the letterhead'],
  ['useDocsSelectionBox()', 'Where the selection is on the screen, to put something beside it'],
  ['useDocsCount()', 'words and characters of the document, and of what is selected'],
  ['useDocsBubble()', 'The bar beside the selection, with <DocsProvider bubble>: open, close, toggle, ask'],
  ['useDocsResponsive()', 'Fits the pages to a narrow window; narrow, and keyboard in pixels'],
  ['useDocsValue(select, fallback)', 'Anything else worked out from the editor, drawing again only when it changes'],
];

/** What was learned putting a headless editor in a CRM. */
const LESSONS = `const { editor, docs, ready } = useDocs();
useEffect(() => {
  if (!editor || !ready) return;
  let last = editor.doc;
  let timer: ReturnType<typeof setTimeout>;
  return editor.onChange(() => {
    if (editor.doc === last) return;     // the selection moved: nothing to save
    last = editor.doc;
    clearTimeout(timer);
    timer = setTimeout(() => void docs!.save(), 3000);   // calls onSave
  });
}, [editor, ready, docs]);`;

/**
 * "Headless: your own UI": the smallest headless editor, running, with its
 * state beside it; useDocs, its state and commands; the hooks; the keys; the
 * bar beside the selection; variables; the ruler; and a whole editor screen.
 */
export async function HeadlessPage() {
  const smallest = readFileSync(join(process.cwd(), 'components/docs/headless/Smallest.tsx'), 'utf8');
  const [first, use, find, keys, bubble, variable, ruler, autosave, focus, loading, replace] = await Promise.all([
    highlight(smallest, 'tsx', LIGHT_THEME),
    highlight(`const { state, commands, editor, docs, ready } = useDocs();`, 'ts', LIGHT_THEME),
    highlight(
      `function Find() {
  const find = useDocsFind();
  return (
    <div className="flex gap-2">
      <input value={find.query} onChange={(e) => find.setQuery(e.target.value)} placeholder="Find" />
      <span>{find.index} / {find.count}</span>
      <button onClick={find.previous}>↑</button>
      <button onClick={find.next}>↓</button>
    </div>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `function Editor() {
  const [finding, setFinding] = useState(false);
  const [linking, setLinking] = useState(false);
  return (
    <DocsProvider docx={file} onFindKey={() => setFinding(true)} onLinkKey={() => setLinking(true)}>
      {finding && <Find onClose={() => setFinding(false)} />}
      {linking && <LinkDialog onClose={() => setLinking(false)} />}
      <DocsSurface className="h-full" />
    </DocsProvider>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `function InsertMenu() {
  const bubble = useDocsBubble();
  return (
    <>
      <button onClick={() => bubble?.ask('variable')}>Variable</button>
      <button onClick={() => bubble?.ask('note')}>Note</button>
      <button onClick={() => bubble?.ask('link')}>Link</button>
    </>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `function Variable({ name }: { name: string }) {
  const variables = useDocsVariables();
  const [value, setValue] = useState('');
  const has = (id: FormatId) => variables.formats[name]?.some((format) => format.id === id);
  const { text, bad } = variables.preview(name, value);
  return (
    <label>
      {name}
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <button aria-pressed={has('currency')} onClick={() => variables.setFormat(name, 'currency', !has('currency'))}>$</button>
      <small>{bad ? 'Not a number' : text}</small>
    </label>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `<div className="flex h-full flex-col">
  <DocsRuler />
  <DocsSurface className="min-h-0 flex-1" />
</div>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(LESSONS, 'tsx', LIGHT_THEME),
    highlight(
      `const toDocument = () => editor?.element.querySelector<HTMLElement>('.dx-input') ?? true;
<DropdownMenuContent finalFocus={toDocument}>…</DropdownMenuContent>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `const [loaded, setLoaded] = useState(false);
useEffect(() => {
  if (!loaded && ready && (!collab || state.collab === 'on')) requestAnimationFrame(() => setLoaded(true));
}, [loaded, ready, collab, state.collab]);
// <div className="relative flex-1"><DocsSurface …/>{!loaded && <Skeleton className="absolute inset-0" />}</div>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `const doc = await loadVersion({ list: async () => [], load: async () => bytes }, file.name);
commands.restoreVersion(doc);`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  const rows = (list: [string, string][], width = 220, code = true) => (
    <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
      {list.map(([term, text]) => (
        <div key={term} className="grid gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${width}px),1fr))` }}>
          <dt className={`${code ? 'font-code text-[13.5px]' : 'text-[15px]'} font-semibold text-ink [overflow-wrap:anywhere]`}>{term}</dt>
          <dd className={`m-0 ${code ? 'text-[15px]' : 'font-code text-[13px]'} leading-[1.6] text-ink-soft [overflow-wrap:anywhere]`}>{text}</dd>
        </div>
      ))}
    </dl>
  );
  const block = (html: string, top = 'mt-5') => <div className={`${top} max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: html }} />;
  const lesson = (title: string, children: React.ReactNode) => (
    <div className="mt-8 max-w-[760px]">
      <h3 className="m-0 font-display text-lg font-bold tracking-[-0.01em]">{title}</h3>
      {children}
    </div>
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Headless: your own UI</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        When the interface that comes with the editor is not yours, keep the pages and draw everything else yourself. The provider holds the document, the surface is where its pages go, and hooks give
        you what to show and what to do.
      </p>
      <div className="mt-4">
        <HandTip>tip: click and type below, and watch the state change</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="The smallest one">
          A toolbar of five things and the pages, running, with what <code className={mono}>state</code> holds beside it. Its whole file is under it.
        </SectionHead>
        <LazyStateDemo />
        {block(first)}
        <p className={prose}>
          <code className={mono}>DocsProvider</code> takes the props of <code className={mono}>DocsEditor</code> that are about the document (<code className={mono}>docx</code>,{' '}
          <code className={mono}>name</code>, <code className={mono}>author</code>, <code className={mono}>collab</code>, <code className={mono}>onSave</code>…), and{' '}
          <code className={mono}>locale</code> and <code className={mono}>locales</code> for the texts the library still has (the bar beside the selection, what a screen reader is told); not
          those of the interface it does not draw (<code className={mono}>features</code>, <code className={mono}>className</code>, <code className={mono}>onReady</code>). It has three of its own: <code className={mono}>onLinkKey</code>, <code className={mono}>onFindKey</code> and <code className={mono}>bubble</code>, below.
          It puts nothing on the page itself: its children are where they are.
        </p>
        <p className={prose}>
          <a href="/docs/components/" className={LINK}>
            Components and hooks
          </a>{' '}
          has each piece with what it takes and an example;{' '}
          <a href="/docs/styling/#your-own-interface" className={LINK}>
            Styling
          </a>{' '}
          has six pieces made with Tailwind, running; and{' '}
          <a href="/docs/example/" className={LINK}>
            A complete interface
          </a>{' '}
          is a whole application built this way.
        </p>
      </section>

      <section aria-labelledby="usedocs" className="mt-24">
        <SectionHead id="usedocs" badge="Hook" color="blue" title="useDocs">
          What there is to show, what there is to do, and the editor itself.
        </SectionHead>
        {block(use, 'mt-6')}
        <p className={prose}>
          <code className={mono}>state</code> is a plain snapshot. It is the same object until something in it changes, so a component draws again only when it must.
        </p>
        {rows(STATE, 200, false)}
        <p className={prose}>
          <code className={mono}>commands</code> are the editor’s methods. Each gives the keyboard back to the document afterwards, so a click on your button does not leave the person unable to type.
        </p>
        {rows(COMMANDS, 200, false)}
        <p className={prose}>
          Before the document is there (on the server, and until the surface is on the page) <code className={mono}>ready</code> is false, <code className={mono}>state</code> holds neutral values, and
          the commands do nothing.
        </p>
      </section>

      <section aria-labelledby="hooks-for-panels-and-dialogs" className="mt-24">
        <SectionHead id="hooks-for-panels-and-dialogs" badge="Hooks" color="purple" title="Hooks for panels and dialogs">
          Each gives what there is to show and what there is to do, for a piece of interface you draw, and draws again only when its own value changes.
        </SectionHead>
        {rows(HOOKS, 240)}
        <p className={prose}>
          <code className={mono}>useDocsValue</code> compares what it selects as JSON at every change, so it is for small values: it warns in the console when given one as large as the document. To know
          when the document changes, <code className={mono}>editor.onChange</code>. A find bar, for example:
        </p>
        {block(find)}
      </section>

      <section aria-labelledby="keys" className="mt-24">
        <SectionHead id="keys" badge="Keys" color="yellow" title="Keys">
          Most keys are the editor’s own and work with nothing asked of you: ⌘B, ⌘I, ⌘U, ⌘Z and ⇧⌘Z, ⌘A, ⌘↵ for a page break, ⌘S (with an <code className={mono}>onSave</code>) and ⌘P, ⌘-click on a link,
          ⌘ and the wheel to zoom. Ctrl takes the place of ⌘ away from a Mac.
        </SectionHead>
        <p className={prose}>
          Two open something only an interface has, so the editor knows the key and leaves the answer to you. Each is taken from the browser only while you give it someone to call, and only while the
          keyboard is in the document.
        </p>
        {rows(
          [
            ['onLinkKey()  ·  ⌘K', 'Time to ask for the address of a link.'],
            ['onFindKey(replace)  ·  ⌘F, ⌘H', 'Time to show the search; replace is true for ⌘H.'],
          ],
          240,
        )}
        {block(keys)}
        <p className={prose}>
          Without React they are options of <code className={mono}>createDocs</code>, and <code className={mono}>docs.setKeys({'{ onLinkKey, onFindKey }'})</code> changes them later.
        </p>
      </section>

      <section aria-labelledby="the-bar-beside-the-selection" className="mt-24">
        <SectionHead id="the-bar-beside-the-selection" badge="Bar" color="pink" title="The bar beside the selection">
          <code className={mono}>{'<DocsProvider bubble>'}</code> gives the document the small bar that comes up beside what is selected, the one the included interface has.
        </SectionHead>
        <p className={prose}>
          On it: copy, cut and paste on a screen that is touched, a variable made of the words selected, a link, a note, and what can be done to a picture or a table. A tap on ⌘ shows and hides it, and
          with it ⌘K asks for a link there unless you gave an <code className={mono}>onLinkKey</code>. It is off unless asked for, and read when the document is made.
        </p>
        <p className={prose}>
          It is the one piece here with a look of its own, and it is put in <code className={mono}>document.body</code>. Give it your colours with the{' '}
          <a href="/docs/styling/#the-included-interface" className={LINK}>
            --dx-ui-… variables
          </a>{' '}
          on <code className={mono}>body</code> (or on <code className={mono}>body:has(.your-editor)</code>), not by reaching into its classes. <code className={mono}>useDocsBubble()</code> gives it to your
          own buttons:
        </p>
        {block(bubble)}
        <p className={prose}>
          To draw one of your own, <code className={mono}>useDocsSelectionBox()</code> says where the selection is: there is one running on the page{' '}
          <a href="/docs/styling/#your-own-interface" className={LINK}>
            Styling
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="variables-that-are-dates-and-amounts" className="mt-24">
        <SectionHead id="variables-that-are-dates-and-amounts" badge="Templates" color="orange" title="Variables that are dates and amounts">
          A variable may ask how its value is written: as a date, as an amount, in capitals, in bold.
        </SectionHead>
        <p className={prose}>
          <code className={mono}>useDocsVariables()</code> gives what each one asks (<code className={mono}>formats</code>), changes it for every place the variable is used (
          <code className={mono}>setFormat</code>), and says what a value would come out as, or that it cannot be written that way (<code className={mono}>preview</code>).
        </p>
        {block(variable)}
        <p className={prose}>
          The formats are <code className={mono}>date</code>, <code className={mono}>dateLong</code>, <code className={mono}>dateFull</code>, <code className={mono}>number</code>,{' '}
          <code className={mono}>currency</code>, <code className={mono}>upper</code>, <code className={mono}>lower</code>, <code className={mono}>capital</code>, <code className={mono}>bold</code>,{' '}
          <code className={mono}>italic</code> and <code className={mono}>underline</code>. One way of writing a date or a number takes the place of another, and so does a change of capitals. More on{' '}
          <a href="/docs/templates/" className={LINK}>
            Templates and variables
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="the-ruler" className="mt-24">
        <SectionHead id="the-ruler" badge="Ruler" color="green" title="The ruler">
          <code className={mono}>{'<DocsRuler />'}</code> is the ruler of the included interface: the page in centimetres, its margins and the indents of the paragraph, to drag. Put it above the{' '}
          <code className={mono}>DocsSurface</code>, as wide as it.
        </SectionHead>
        {block(ruler, 'mt-6')}
        <p className={prose}>
          It is drawn on a canvas, so its look is its colours, not classes: the six{' '}
          <a href="/docs/styling/#the-ruler" className={LINK}>
            --dx-ruler… variables
          </a>
          . It draws itself again when they change.
        </p>
      </section>

      <section aria-labelledby="a-whole-editor-screen" className="mt-24">
        <SectionHead id="a-whole-editor-screen" badge="Lessons" color="blue" title="A whole editor screen">
          What was learned putting a headless editor inside a CRM: a Next.js application with its own components, saving to its API as the person types, and rooms to work together.
        </SectionHead>
        {lesson(
          'Start from the hooks',
          <p className={prose}>
            Most panels are already one: <code className={mono}>useDocsVariables</code> for the fields of a template, <code className={mono}>useDocsPage</code> for sections and page setup,{' '}
            <code className={mono}>useDocsCount</code> for the status bar, <code className={mono}>useDocsResponsive</code> for phones, <code className={mono}>useDocsFind</code> for the search.
          </p>,
        )}
        {lesson(
          'Saving as the person types',
          <>
            <p className={prose}>
              Listen to the editor, not to React: <code className={mono}>editor.onChange</code> is called for the selection too, so compare the document itself, which is a new object only when it
              changed.
            </p>
            {block(autosave)}
            <p className={prose}>
              <code className={mono}>useDocsValue((e) =&gt; e.doc)</code> would compare the whole document as JSON at every key: a long contract then takes a second per keystroke.
            </p>
          </>,
        )}
        {lesson(
          'Menus give the keyboard back',
          <>
            <p className={prose}>
              A menu of a component library gives the focus back to the button that opened it, and the next key goes nowhere. Give it to the document instead: Base UI’s{' '}
              <code className={mono}>finalFocus</code>, Radix’s <code className={mono}>onCloseAutoFocus</code>.
            </p>
            {block(focus)}
          </>,
        )}
        {lesson(
          'A loading state',
          <>
            <p className={prose}>
              <code className={mono}>DocsSurface</code> is there before the document is: an empty page shows until <code className={mono}>ready</code>, and in a room until the room has sent it (
              <code className={mono}>state.collab === &apos;on&apos;</code>). Cover the surface until then, once:
            </p>
            {block(loading)}
          </>,
        )}
        {lesson(
          'Read only',
          <p className={prose}>
            <code className={mono}>editor.readOnly = true</code> for someone who may only look: the commands do nothing and the keys type nothing. In a room, the server’s <code className={mono}>admit</code>{' '}
            saying <code className={mono}>readOnly</code> does it for you.
          </p>,
        )}
        {lesson(
          'Opening a file without leaving the room',
          <>
            <p className={prose}>
              <code className={mono}>docs.openFile()</code> replaces the document and leaves the room. To put another DOCX in its place as one more change, which the others receive and ⌘Z takes back:
            </p>
            {block(replace)}
          </>,
        )}
        {lesson(
          'Phones',
          <p className={prose}>
            <code className={mono}>useDocsResponsive</code>, or <code className={mono}>commands.setFit(&apos;width&apos;)</code> on a narrow screen: the whole page across it, zoomed, without setting the
            text out again. See{' '}
            <a href="/docs/mobile/" className={LINK}>
              Phones and touch
            </a>
            .
          </p>,
        )}
        {lesson(
          'Full screen',
          <p className={prose}>
            The bar beside the selection, menus and toasts are drawn on the page, outside the editor. Put the page in full screen (<code className={mono}>document.documentElement.requestFullscreen()</code>)
            and the editor above everything with <code className={mono}>position: fixed</code>, rather than the editor’s own element. The bar follows an element that holds the editor into full screen;
            your menus and toasts will not.
          </p>,
        )}
        {lesson(
          'A room inside your API',
          <p className={prose}>
            <code className={mono}>createCollabServer</code> without a <code className={mono}>port</code> gives a <code className={mono}>handle</code> to mount at <code className={mono}>/collab</code> in
            Express or Nest, with a storage that calls your services straight. The browser must reach it directly: a proxy that reads the whole response first (Next’s route handlers do) never ends a
            stream of server-sent events. See{' '}
            <a href="/docs/collaboration/" className={LINK}>
              collaboration
            </a>
            .
          </p>,
        )}
        {lesson(
          'Lists',
          <p className={prose}>
            <code className={mono}>setListStyle({"{ format: 'lowerLetter', text: '#.-' }"})</code> writes “a.-”, “b.-”; <code className={mono}>restartNumbering()</code> and{' '}
            <code className={mono}>continueNumbering()</code> for the caret’s item. Tab and ⇧Tab change the level wherever the caret is in an item, and Enter on an empty item goes up one.
          </p>,
        )}
      </section>
    </>
  );
}
