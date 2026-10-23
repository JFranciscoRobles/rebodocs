import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { CODE, LINK } from '../styles';
import { Callout, HandTip, SectionHead } from '../ui';
import { InstallCommand } from '../InstallCommand';
import { LazyFeaturesDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

type Change = 'follows' | 'mounts' | 'latest' | 'opens' | 'withDocx';

/** What happens when a prop changes, from the effects of DocsEditor.ts. */
const CHANGE: Record<Change, { label: string; color: 'green' | 'orange' | 'blue' | 'purple' | 'yellow' }> = {
  follows: { label: 'Follows', color: 'green' },
  latest: { label: 'Last one called', color: 'blue' },
  mounts: { label: 'Made again', color: 'orange' },
  opens: { label: 'Opens it', color: 'purple' },
  withDocx: { label: 'Read with docx', color: 'yellow' },
};

/** Every prop of DocsEditor, from DocsCoreOptions, DocsOptions and DocsEditorProps. */
const PROPS: { name: string; type: string; text: string; change: Change; link?: [string, string] }[] = [
  {
    name: 'docx',
    type: 'Uint8Array | ArrayBuffer',
    text: 'The document to open; an empty one without it. Another one opens in its place. Not read with collab, where the room has the document.',
    change: 'opens',
  },
  { name: 'unsaved', type: 'boolean', text: 'Whether docx has changes not saved yet, as a draft your application kept: dirty from the start, with the dot beside the title.', change: 'withDocx' },
  { name: 'name', type: 'string', text: 'What the document is called: shown in the toolbar, given to onSave and to what is exported.', change: 'follows' },
  {
    name: 'author',
    type: 'string',
    text: 'Who the person is: what their notes and changes are signed with, and what the others see them as. Without it, the name the person gave last time, kept by the browser.',
    change: 'follows',
  },
  {
    name: 'locale',
    type: 'string',
    text: "The language of the interface: 'en', 'es', or one given in locales. Left out, the first of the browser’s languages it speaks, or English. It is the whole page's, not this editor's alone.",
    change: 'follows',
    link: ['Languages', '/docs/languages/'],
  },
  {
    name: 'locales',
    type: 'Record<string, Texts>',
    text: 'More languages, or other words for these, as { fr: texts }. What one leaves out is said in English.',
    change: 'follows',
    link: ['Languages', '/docs/languages/'],
  },
  {
    name: 'language',
    type: 'string',
    text: "The language the text is in, as a tag ('en-US'): written in the DOCX, used for the variables that are dates and amounts, and the one a screen reader reads the text with. Left out, the one the file says, or else the interface's. The person can choose another at the foot of the editor.",
    change: 'follows',
  },
  {
    name: 'spellcheck',
    type: 'SpellChecker',
    text: 'What marks the words spelled wrong with a red wave and offers what they could be: createSpellChecker with the dictionaries you give, or one of your own.',
    change: 'follows',
    link: ['Spelling', '/docs/languages/#spelling'],
  },
  {
    name: 'theme',
    type: "'light' | 'dark' | 'auto'",
    text: "The colours of the interface: light as it comes, dark, or 'auto' for the one the system is set to. The pages stay white, as paper.",
    change: 'follows',
    link: ['Styling', '/docs/styling/'],
  },
  {
    name: 'fonts',
    type: 'FontSource[]',
    text: 'Typefaces of your own, each with its family and its file. For the whole page, and they stay; the same ones in a new array are not loaded again.',
    change: 'follows',
    link: ['Fonts', '/docs/fonts/'],
  },
  {
    name: 'embedFonts',
    type: "boolean | 'subset'",
    text: "Whether the DOCX carries the fonts of fonts its text is in, when they are TrueType and their licence lets it: whole unless false, or cut down to the characters used with 'subset'.",
    change: 'follows',
  },
  {
    name: 'letterhead',
    type: 'Blob | { bytes, type } | string | null',
    text: 'A PNG or JPG to use as letterhead, whatever the document came with; null for none. Given, the menu no longer offers to change it.',
    change: 'follows',
    link: ['Letterheads', '/docs/letterhead/'],
  },
  {
    name: 'versions',
    type: '{ list, load, save? }',
    text: 'Where your application keeps the versions. The side panel then lists them, compares the document with one and goes back to it; with save, it keeps one.',
    change: 'mounts',
    link: ['Versions', '/docs/versions/'],
  },
  {
    name: 'collab',
    type: '{ url, room, ticket? }',
    text: 'The document is a room on your collaboration server, and comes from there.',
    change: 'opens',
    link: ['Collaboration', '/docs/collaboration/'],
  },
  { name: 'features', type: 'DocsFeatures', text: 'What is switched on. See below.', change: 'mounts' },
  {
    name: 'onSave',
    type: '(docx, name) => void | Promise',
    text: 'Given the document when the person saves, from the menu or with ⌘S (Ctrl+S), or when you call save(). Keeping it is yours to do; a promise that fails is told to onError.',
    change: 'latest',
  },
  { name: 'onChange', type: '(editor) => void', text: 'Called when the document changes.', change: 'latest' },
  { name: 'onCollab', type: '(state, peers) => void', text: 'Called when the connection, or who is on the document, changes.', change: 'latest' },
  { name: 'onError', type: '(message) => void', text: 'Told what went wrong, in the language of the interface. Without it, an alert.', change: 'latest' },
  { name: 'onReady', type: '(handle | undefined) => void', text: 'Given the handle once the editor is there, and undefined when it goes: on every mount.', change: 'latest' },
  { name: 'ref', type: 'Ref<DocsHandle | undefined>', text: 'The same handle, kept in a ref: given on every mount, and undefined when the editor goes.', change: 'follows' },
  { name: 'className · style', type: 'string · CSSProperties', text: 'For the element the editor is in. Its height is 100% of what it is in.', change: 'follows' },
];

/** Every feature, from DocsFeatures in mount.ts. */
const FEATURES: { name: string; on: boolean; text: string }[] = [
  { name: 'menu', on: true, text: "The document menu: the file, export, the page, the letterhead. A screen of its own over the editor, or 'card' for a card that drops from its button." },
  {
    name: 'panel',
    on: true,
    text: "The side panel: outline, variables, notes, tracked changes, and versions when given. On the right of the pages; 'left', or 'rail' for a rail of icons always there, with counts.",
  },
  { name: 'ruler', on: true, text: 'The ruler, with margins, indents and tab stops.' },
  {
    name: 'statusBar',
    on: true,
    text: "Pages, words, the language of the text, the view, the zoom, and who is on the document, as pills floating over the pages; 'chips' or 'bar' to set them under them.",
  },
  { name: 'toolbar', on: true, text: "The document above and the formatting under it; 'tabs' for tabs of tools (Format, Insert, Page), or 'row' for one row." },
  { name: 'find', on: true, text: 'Find and replace, from the toolbar or ⌘F (Ctrl+F).' },
  { name: 'focus', on: true, text: 'The pages alone, full screen, from the status bar or ⌘⇧. (Ctrl+Shift+.). Escape leaves.' },
  { name: 'title', on: true, text: 'The name of the document in the toolbar; with onSave or files, a dot beside it while there are changes not saved.' },
  { name: 'responsive', on: true, text: 'Making do with a narrow window and the keyboard of a phone. See Phones and touch.' },
  { name: 'files', on: false, text: 'Open a file from the disk in place of the document (⌘O), and save a copy to it; ⌘S downloads it when there is no onSave.' },
  { name: 'language', on: false, text: 'The choice of the interface language, in the menu.' },
  { name: 'theme', on: false, text: 'The choice of light, dark or as the system is, in the menu; the theme prop says the one to start with.' },
  { name: 'assistant', on: false, text: 'The button in the status bar that lets an AI assistant in: true for the MCP server on this machine, or { url, token }.' },
  { name: 'share', on: false, text: 'The button that starts sharing from here: { url, token?, link? }. Not for a document that is already a room.' },
];

/** Every member of DocsHandle a component's handle is for (destroy is the component's). */
const HANDLE: { name: string; text: string }[] = [
  { name: 'exportDocx()', text: 'The document as a DOCX, as it is now.' },
  { name: 'save()', text: 'Gives the document to onSave, as ⌘S does, and once it is kept, dirty is false. What an application that saves on its own calls, a moment after each change.' },
  { name: 'dirty', text: 'Whether it changed since it was opened or last saved.' },
  { name: 'name', text: 'What the document is called now: the name given, or the one of a file the person opened.' },
  {
    name: 'showPanel(tab?)',
    text: "Opens the side panel on a tab ('outline', 'variables', 'notes', 'changes', or 'history' with versions), or on the one it was on. false when the panel is turned off.",
  },
  { name: 'hidePanel()', text: 'Closes it.' },
  { name: 'focus()', text: 'Gives the keyboard to the document.' },
  { name: 'setName · setAuthor · setLocale · setTheme · setLetterhead', text: 'Change what the props set, for whoever keeps them outside React.' },
  { name: 'editor', text: 'The Editor itself, for everything else.' },
  { name: 'collab', text: 'The session with the others, while there is one.' },
];

/**
 * "React component": DocsEditor running, its features switched on and off and
 * its handle used through a ref; installing it; every prop and what happens
 * when it changes; the features; the handle; saving; and without React.
 */
export async function ReactPage() {
  const [first, handle, features, whole] = await Promise.all([
    highlight(
      `'use client';
import { DocsEditor } from '@rebodocs/react';

export function Contract({ file }: { file: Uint8Array }) {
  return (
    <div className="h-screen">
      <DocsEditor
        docx={file}
        name="contract.docx"
        author="Ana"
        locale="en"
        onSave={(docx, name) => upload(docx, name)}
      />
    </div>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `const docs = useRef<DocsHandle>(undefined);

<DocsEditor ref={docs} docx={file} />
<button onClick={() => upload(docs.current!.exportDocx())}>Send</button>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(`<DocsEditor docx={file} features={{ ruler: false, files: true }} />`, 'tsx', LIGHT_THEME),
    highlight(
      `import { mountDocs } from '@rebodocs/react/mount';

const docs = mountDocs(document.querySelector('#editor')!, { docx: bytes, locale: 'en' });
docs.destroy();`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  const chip = (change: Change) => (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[CHANGE[change].color]}`}>{CHANGE[change].label}</span>
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">React component</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        <code className={mono}>DocsEditor</code> is the whole editor in one component: toolbar, ruler, side panel, pages and status bar. It mounts in your page, not in an iframe.
      </p>
      <div className="mt-4">
        <HandTip>tip: switch the features, then call the handle</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="Switch it on and off">
          A real <code className={mono}>DocsEditor</code> with the agreement of the demo. The features are read when it is made, so each switch makes it again, with the document as it is: type
          something, then switch one. The buttons above it use the handle, through a <code className={mono}>ref</code>.
        </SectionHead>
        <LazyFeaturesDemo />
      </section>

      <section aria-labelledby="start" className="mt-24">
        <SectionHead id="start" badge="Start" color="blue" title="Put it in a page">
          The package is{' '}
          <a href="https://www.npmjs.com/package/@rebodocs/react" className={LINK}>
            @rebodocs/react
          </a>
          . Everything it exports is in{' '}
          <a href="/docs/components/" className={LINK}>
            Components and hooks
          </a>
          .
        </SectionHead>
        <div className="mt-6 max-w-[760px]">
          <InstallCommand command="npm install @rebodocs/react" />
        </div>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: first }} />
        <ul className="m-0 mt-5 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>The element around it must have a height: the editor fills what it is given.</li>
          <li>
            It is safe to render on a server. There it draws an empty element, and mounts once the page is in the browser; the bundle starts with <code className={mono}>&apos;use client&apos;</code>.
          </li>
          <li>
            Without <code className={mono}>locale</code>, the interface is in the first of the browser’s languages it speaks, or in English.
          </li>
        </ul>
      </section>

      <section aria-labelledby="props" className="mt-24">
        <SectionHead id="props" badge="Props" color="purple" title="Props">
          Each with what happens when it changes. <strong className="font-semibold text-ink">Follows</strong>: the editor takes the new one as it is.{' '}
          <strong className="font-semibold text-ink">Last one called</strong>: a new function in each render is fine. <strong className="font-semibold text-ink">Made again</strong>: the editor is made
          again with the document as it is, unsaved changes and all, but without what there was to undo. <strong className="font-semibold text-ink">Opens it</strong>: another document, or another
          room, takes the place of this one.
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {PROPS.map((prop) => (
            <div key={prop.name} className="grid gap-x-6 gap-y-1.5 border-t border-[#f0eee9] py-3.5 first:border-t-0 md:grid-cols-[240px_1fr]">
              <dt className="min-w-0">
                <span className="block font-code text-[13.5px] font-semibold text-ink">{prop.name}</span>
                <span className="block font-code text-[12px] text-muted [overflow-wrap:anywhere]">{prop.type}</span>
              </dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">
                {chip(prop.change)} {prop.text}
                {prop.link && (
                  <>
                    {' '}
                    See{' '}
                    <a href={prop.link[1]} className={LINK}>
                      {prop.link[0]}
                    </a>
                    .
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          With <code className={mono}>onSave</code> and <code className={mono}>versions</code>, the functions are always the last given; only giving one where there was none, or taking it away, makes
          the editor again.
        </p>
      </section>

      <section aria-labelledby="features" className="mt-24">
        <SectionHead id="features" badge="Features" color="yellow" title="Features">
          What an application of its own may not want is off until asked for. What every document needs is on until switched off.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: features }} />
        <dl className="m-0 mt-5 max-w-[920px] rounded-2xl border border-border px-5">
          {FEATURES.map((feature) => (
            <div key={feature.name} className="grid items-baseline gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[130px_60px_1fr]">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{feature.name}</dt>
              <dd className={`m-0 font-code text-[12.5px] font-semibold ${feature.on ? 'text-[#2f7a4a]' : 'text-muted'}`}>{feature.on ? 'on' : 'off'}</dd>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{feature.text}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          The bar beside the selection is always there. To lay the pieces out yourself, see{' '}
          <a href="/docs/vanilla/" className={LINK}>
            Without a framework
          </a>{' '}
          or{' '}
          <a href="/docs/headless/" className={LINK}>
            Headless
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="the-handle" className="mt-24">
        <SectionHead id="the-handle" badge="Handle" color="pink" title="The handle">
          <code className={mono}>ref</code> and <code className={mono}>onReady</code> give the same object, to reach the editor from outside.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: handle }} />
        <dl className="m-0 mt-5 max-w-[920px] rounded-2xl border border-border px-5">
          {HANDLE.map((member) => (
            <div key={member.name} className="grid gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))' }}>
              <dt className="font-code text-[13.5px] font-semibold text-ink [overflow-wrap:anywhere]">{member.name}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{member.text}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          A new handle comes with each mount, and the old one is of an editor that is gone: keep the one the ref has now, not one kept from before. For the methods of the editor, see{' '}
          <a href="/docs/editor-api/" className={LINK}>
            Editor API
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="saving" className="mt-24">
        <SectionHead id="saving" badge="Saving" color="orange" title="Saving">
          Two ways, and they can be combined.
        </SectionHead>
        <div className="mt-6 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))' }}>
          {[
            { title: 'The person saves', text: 'Pass onSave. The menu shows Save, ⌘S works, and the dot beside the title says there are changes not saved.', color: 'blue' as const },
            {
              title: 'You save',
              text: 'Call exportDocx() whenever you like: on a timer, on leaving the page, from your own button. Or save(), to go through onSave and clear dirty.',
              color: 'green' as const,
            },
            { title: 'The room saves', text: 'With collab, the collaboration server keeps the document through your backend, and neither is needed.', color: 'purple' as const },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 max-w-[760px]">
          <Callout title="Saving on its own">
            Call <code className={mono}>save()</code> a moment after the last change, from <code className={mono}>onChange</code>, and on leaving the page when <code className={mono}>dirty</code> is
            true. The person never has to think of it, and nothing is sent while nothing changed.
          </Callout>
        </div>
      </section>

      <section aria-labelledby="without-react" className="mt-24">
        <SectionHead id="without-react" badge="No React" color="green" title="Without React">
          The same editor mounts in any element, with the same options, and gives the same handle, with <code className={mono}>destroy()</code>.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: whole }} />
        <p className={prose}>
          It is the <code className={mono}>/mount</code> entry of the package, which holds no React; React is an optional peer, so npm does not install it for this. See{' '}
          <a href="/docs/vanilla/" className={LINK}>
            Without a framework
          </a>
          .
        </p>
      </section>
    </>
  );
}
