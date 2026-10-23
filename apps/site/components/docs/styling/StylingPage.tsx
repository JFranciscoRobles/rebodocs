import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { RULER_VARS, SURFACE_VARS, THEMES, UI_VARS } from '../reference';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { LazyPiecesDemo, LazyThemeDemo } from './Lazy';

/** The examples of pieces of your own, by the name of their file: the code shown is the code that runs. */
const EXAMPLES = ['Toolbar', 'StatusBar', 'FindBar', 'Outline', 'SelectionBar', 'Ruler'];

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** The variables of one part, each with what it colours and what it is when not set. */
function Vars({ rows }: { rows: [string, string][] }) {
  const defaults = THEMES[0].vars;
  return (
    <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
      {rows.map(([name, what]) => (
        <div key={name} className="grid items-center gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[220px_1fr_auto]">
          <dt className="font-code text-[13.5px] font-semibold text-ink">{name}</dt>
          <dd className="m-0 text-[15px] leading-normal text-ink-soft">{what}</dd>
          <dd className="m-0 flex items-center gap-2 font-code text-[12.5px] text-muted">
            <span
              aria-hidden="true"
              className="size-4 flex-none rounded border border-border-strong"
              style={name === '--dx-page-shadow' ? { background: '#fff', boxShadow: defaults[name] } : { background: defaults[name] }}
            />
            {defaults[name]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * "Styling and Tailwind": a real editor recoloured by the CSS variables; the
 * element the pages are in and its variables; the ruler's; an interface of
 * your own with the headless hooks; Tailwind; and the interface included.
 */
export async function StylingPage() {
  const examples = await Promise.all(
    EXAMPLES.map(async (name) => {
      const source = readFileSync(join(process.cwd(), 'components/docs/styling/examples', `${name}.tsx`), 'utf8').replace(/^'use client';\n\n/, '');
      return [name, await highlight(source, 'tsx', LIGHT_THEME)] as const;
    }),
  );
  const [surface, bold] = await Promise.all([
    highlight(`<DocsSurface className="h-full bg-neutral-100 dark:bg-neutral-900" />`, 'tsx', LIGHT_THEME),
    highlight(
      `function Bold() {
  const { state, commands } = useDocs();
  return (
    <button
      onClick={() => commands.toggleMark('bold')}
      aria-pressed={state.bold}
      className={\`rounded px-2 py-1 font-bold \${state.bold ? 'bg-blue-600 text-white' : 'hover:bg-neutral-100'}\`}
    >
      B
    </button>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Styling and Tailwind</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        Two levels: recolour what comes with the editor with a few CSS variables, or draw the interface yourself with the headless hooks and whatever classes you like.
      </p>
      <div className="mt-4">
        <HandTip>tip: pick a theme below, then open a menu</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="Recolour it">
          The variables are set on the element the editor is in, and the editor reads them: the canvas, the ruler and every bar, menu and dialog of the interface included. Nothing else changes.
        </SectionHead>
        <LazyThemeDemo />
      </section>

      <section aria-labelledby="the-pages" className="mt-24">
        <SectionHead id="the-pages" badge="Pages" color="blue" title="The pages">
          The element the pages are in takes classes like any other.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: surface }} />
        <p className={prose}>
          Its rule (the colour behind the pages, its height, that it scrolls) is in a CSS layer of its own, put before any other, so the utilities of a framework that keeps them in layers, as Tailwind
          4 does, win over it. The rest of the editor’s styles are not in a layer: they are for elements inside it, which your classes do not reach.
        </p>
        <Vars rows={SURFACE_VARS} />
        <p className={prose}>The page itself is white because paper is: a document says what colour its text is, and it takes white behind it for granted.</p>
      </section>

      <section aria-labelledby="the-ruler" className="mt-24">
        <SectionHead id="the-ruler" badge="Ruler" color="purple" title="The ruler">
          Its own six, set on the same element or on any around it.
        </SectionHead>
        <Vars rows={RULER_VARS} />
      </section>

      <section aria-labelledby="the-included-interface" className="mt-24">
        <SectionHead id="the-included-interface" badge="Interface" color="orange" title="The interface included">
          The toolbar, the menus, the side panel, the status bar, the dialogs and the bar beside the selection take eleven variables. Not set, each is the colour it always was.
        </SectionHead>
        <Vars rows={UI_VARS} />
        <p className={prose}>
          <strong>A dark theme comes with it.</strong> <code className={mono}>theme=&quot;dark&quot;</code> on <code className={mono}>DocsEditor</code> or <code className={mono}>DocsProvider</code> (
          <code className={mono}>editor.theme = &apos;dark&apos;</code> without React), or <code className={mono}>&apos;auto&apos;</code> to follow the system. It sets these variables to dark values
          whose text reads at 4.5:1, makes the tints of the menu and the reds that are not variables readable on dark, and is taken by the bars and menus shown outside the editor too.{' '}
          <code className={mono}>features=&#123;&#123; theme: true &#125;&#125;</code> puts the choice in the menu, for the person to make. A variable set on the element still wins over it.
        </p>
        <p className={prose}>
          For a dark theme of your own, set <code className={mono}>color-scheme: dark</code> on the same element as well: the lists that drop down from a select and the scroll bars are the browser’s,
          and it draws them dark only when told. A text colour of the document is the document’s, and the page stays white.
        </p>
        <div className="mt-7 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))' }}>
          {[
            {
              title: 'For fingers',
              text: 'Where the pointer is a finger, the buttons grow: 38 pixels in the toolbar and the bar beside the selection, 34 in the status bar, 44 the items of the menu.',
              color: 'blue' as const,
            },
            {
              title: 'High contrast',
              text: 'With the colours of the system forced on the page, as Windows does, what is on and what has the keyboard stay visible, whatever the theme.',
              color: 'green' as const,
            },
            {
              title: 'Contrast is yours',
              text: 'The default colours keep text at 4.5:1 or more. A theme of your own has to as well: check its text against its backgrounds.',
              color: 'yellow' as const,
            },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="your-own-interface" className="mt-24">
        <SectionHead id="your-own-interface" badge="Your UI" color="yellow" title="Pieces of your own">
          With the{' '}
          <a href="/docs/headless/" className={LINK}>
            headless hooks
          </a>{' '}
          each piece is yours to draw, one at a time: a hook gives what to show and what to do, and the JSX and its classes are yours. Six of them, each on a real document, with its whole file under
          it.
        </SectionHead>
        <LazyPiecesDemo code={Object.fromEntries(examples)} />
        <p className={prose}>The smallest of all, a button:</p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: bold }} />
      </section>

      <section aria-labelledby="with-tailwind" className="mt-24">
        <SectionHead id="with-tailwind" badge="Tailwind" color="pink" title="With Tailwind">
          This site is Tailwind 4 in Next.js 16, with the editor in it. Nothing needs adding to the configuration.
        </SectionHead>
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>
            Tailwind’s reset gives every picture <code className={mono}>max-width: 100%</code>, which would squeeze the pictures of a document. The editor undoes it for its own.
          </li>
          <li>The editor’s styles win over the reset’s, which Tailwind keeps in a layer, and your utilities win over the rule of the element the pages are in.</li>
        </ul>
      </section>
    </>
  );
}
