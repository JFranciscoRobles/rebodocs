import { LIGHT_THEME, highlight } from '@/lib/docs';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { InstallCommand } from '../InstallCommand';
import { LazyAssembleDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** Each piece, from packages/editor/src/index.ts and the create… function of each. */
const PIECES: { call: string; text: string }[] = [
  { call: 'new Editor(element)', text: 'The pages. Holds the document, the selection and the history; the element needs a height.' },
  { call: 'createToolbar(el, editor, options)', text: 'One row of formatting; what does not fit folds into a tray. Its options give it the buttons that open the other pieces.' },
  { call: 'createRuler(el, editor)', text: 'Margins, indents and tab stops, to drag or to move with the keys.' },
  { call: 'createPanel(el, editor, { versions? })', text: 'The side panel: outline, template variables, notes, tracked changes, and versions when the application keeps them.' },
  { call: 'createStatusBar(el, editor, options)', text: 'Pages, words, the language of the text, the view, the zoom; who is on the document and the assistant, when given.' },
  { call: 'createBubble(editor)', text: 'The bar beside the selection, with what can be done to it; on a phone, copy and paste too.' },
  { call: 'createFindBar(editor)', text: 'Find and replace, opened with open() or ⌘F (Ctrl+F).' },
  {
    call: 'createSidebar(editor, options)',
    text: "The document menu: open, save, export, page setup, letterhead, the language of the interface. A card from the button of the menu, or with variant: 'screen' a screen of its own. With within: an element, it stays inside that box instead of the whole window.",
  },
  { call: 'createFocusMode(editor, options)', text: 'The pages alone, full screen, with ⌘⇧. (Ctrl+Shift+.); Escape leaves.' },
  { call: 'createResponsive(shell, editor)', text: 'Narrow windows and the keyboard of a phone. See Phones and touch.' },
];

/** What else the package has for an interface of plain DOM. */
const MORE: { call: string; text: string }[] = [
  { call: 'createVersionView(editor, versions)', text: 'A version shown beside the document, its changes marked.' },
  { call: 'createImagePicker(editor) · openImageGrid(editor, files)', text: 'Asking for pictures, and the dialog that sets out several in a grid.' },
  { call: 'setAuthor(editor, name) · recallAuthor(editor)', text: 'The name notes and changes are signed with, kept for the next visit.' },
  { call: 'addFont(source) · setLocale(code) · addLocale(code, texts)', text: 'Fonts of your own, and the language of the interface. See Fonts and Languages.' },
  { call: 'createSpellChecker({ dictionaries }) → editor.spellChecker', text: 'The red wave under words spelled wrong, with Hunspell dictionaries you give, read in a worker. See Spelling.' },
  { call: 'applyTheme(element, theme) · editor.theme', text: "The dark theme, or 'auto' for the system's: on the element around the pieces, and on the editor for what it shows outside it." },
];

/** The options that wire one piece to another. */
const WIRES: { option: string; text: string }[] = [
  { option: 'toolbar onMenu: menu.toggle', text: 'The button at its start opens the document menu.' },
  { option: 'toolbar onPanel: panel.toggle', text: 'The button that shows and hides the side panel.' },
  { option: 'toolbar onFind: () => find.open()', text: 'The search button at its end.' },
  {
    option: 'toolbar onInsertLink · onInsertNote · onInsertVariable',
    text: "Insert → Link, Note and Variable ask in the selection bar: () => bubble.ask('link'). Without them they ask in a prompt of the browser.",
  },
  { option: "editor.onLinkKey = () => bubble.ask('link')", text: '⌘K (Ctrl+K) asks for the address there too; without it, the key is left to the browser.' },
  { option: 'status focus: { on: () => focus.on, toggle: focus.toggle }', text: 'The full-screen button at the end of the status bar.' },
];

/**
 * "Without a framework": the pieces of @rebodocs/editor put on and taken off
 * a bare Editor; what each is; how they are wired; changing the language;
 * the whole of it at once with mountDocs; and the editor itself.
 */
export async function VanillaPage() {
  const [html, first, language, whole, methods] = await Promise.all([
    highlight(
      `<div id="toolbar"></div>
<div id="pages" style="height: 80vh"></div>
<div id="status"></div>`,
      'html',
      LIGHT_THEME,
    ),
    highlight(
      `import { Editor, createToolbar, createStatusBar, createBubble } from '@rebodocs/editor';

const editor = new Editor(document.querySelector('#pages')!);
createToolbar(document.querySelector('#toolbar')!, editor);
createStatusBar(document.querySelector('#status')!, editor);
createBubble(editor);

editor.loadDocx(bytes);
editor.onChange(() => console.log(editor.pageCount, 'pages'));

const docx = editor.exportDocx();
const pdf = await editor.exportPdf('Contract');`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { onLocaleChange, setLocale } from '@rebodocs/editor';

let pieces = makePieces(editor);            // your function: creates them, returns them
onLocaleChange(() => {
  pieces.forEach((piece) => piece.destroy());
  pieces = makePieces(editor);              // made again, in the new language
});
setLocale('es');`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { mountDocs } from '@rebodocs/react/mount';

const docs = mountDocs(document.querySelector('#editor')!, {
  docx: bytes,
  name: 'contract.docx',
  locale: 'en',
  onSave: (docx, name) => upload(docx, name),
});
docs.editor;      // the Editor, for everything else
docs.destroy();`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `editor.setSelection({ para: 0, offset: 0 }, { para: 0, offset: 5 });
editor.toggleMark('bold');
editor.insertText('Hello');
editor.undo();
editor.setZoom(1.25);`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  const rows = (list: { call?: string; option?: string; text: string }[], width = 300) => (
    <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
      {list.map((row) => (
        <div
          key={row.call ?? row.option}
          className="grid gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0"
          style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${width}px),1fr))` }}
        >
          <dt className="font-code text-[13.5px] font-semibold text-ink [overflow-wrap:anywhere]">{row.call ?? row.option}</dt>
          <dd className="m-0 text-[15px] leading-normal text-ink-soft">{row.text}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Without a framework</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        <a href="https://www.npmjs.com/package/@rebodocs/editor" className={LINK}>
          @rebodocs/editor
        </a>{' '}
        is plain TypeScript and the DOM. The <code className={mono}>Editor</code> class is the pages; everything around them is a piece of its own, made if you want it, in the element you give it.
      </p>
      <div className="mt-4">
        <HandTip>tip: put the pieces on and take them off below</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="Put it together">
          One <code className={mono}>Editor</code>, made once, and the pieces around it: each choice destroys them all and makes the chosen ones again, wired to each other. The document and its
          history stay.
        </SectionHead>
        <LazyAssembleDemo />
      </section>

      <section aria-labelledby="start" className="mt-24">
        <SectionHead id="start" badge="Start" color="blue" title="The smallest page" />
        <div className="mt-6 max-w-[760px]">
          <InstallCommand command="npm install @rebodocs/editor" />
        </div>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: html }} />
        <div className={`mt-2 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: first }} />
      </section>

      <section aria-labelledby="the-pieces" className="mt-24">
        <SectionHead id="the-pieces" badge="Pieces" color="purple" title="The pieces">
          Each is a function that takes the element it goes in, when it has one, and gives back what it made, with <code className={mono}>destroy()</code>.
        </SectionHead>
        {rows(PIECES)}
        <p className={prose}>And for what an interface also needs:</p>
        {rows(MORE)}
      </section>

      <section aria-labelledby="wiring" className="mt-24">
        <SectionHead id="wiring" badge="Wiring" color="yellow" title="Wiring them together">
          A piece does not look for the others: the options of one take the methods of another. The toolbar shows the button of the menu, the panel or the search only when it is given what to open.
        </SectionHead>
        {rows(WIRES)}
        <p className={prose}>
          The code under the demo above is exactly this wiring, for the pieces chosen. A page that wires every one of them, with collaboration and an assistant as well, is{' '}
          <code className={mono}>apps/playground/src/main.ts</code> in the repository.
        </p>
      </section>

      <section aria-labelledby="language" className="mt-24">
        <SectionHead id="language" badge="Language" color="pink" title="Changing the language">
          The pieces take their words when they are made. To change the language with everything open, destroy them and make them again; the editor keeps the document, the selection and the history.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: language }} />
        <p className={prose}>
          The editor itself follows the language by itself: what it says to a screen reader, and the names of the styles. See{' '}
          <a href="/docs/languages/" className={LINK}>
            Languages
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="the-whole-thing-at-once" className="mt-24">
        <SectionHead id="the-whole-thing-at-once" badge="All of it" color="orange" title="The whole thing at once">
          <code className={mono}>mountDocs</code> builds all of that in any element, wired, with the options of the{' '}
          <a href="/docs/react/" className={LINK}>
            React component
          </a>
          , and changes the language by itself.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: whole }} />
        <p className={prose}>
          It runs no React: it is the <code className={mono}>/mount</code> entry of <code className={mono}>@rebodocs/react</code>, which holds none, and React is an optional peer of the package, so
          npm does not install it. Only the components and hooks of the main entry need it.
        </p>
      </section>

      <section aria-labelledby="working-with-the-editor" className="mt-24">
        <SectionHead id="working-with-the-editor" badge="Editor" color="green" title="Working with the editor">
          Everything the pieces do, they do through its methods, and so can you. All of them are on the page{' '}
          <a href="/docs/editor-api/" className={LINK}>
            Editor API
          </a>
          ; a few to start with:
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: methods }} />
      </section>
    </>
  );
}
