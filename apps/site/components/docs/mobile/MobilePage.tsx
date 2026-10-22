import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { CODE, LINK } from '../styles';
import { Callout, HandTip, SectionHead } from '../ui';
import { GESTURES, KNOW, NARROW } from './data';
import { LazyPhoneDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const COLORS = ['blue', 'purple', 'yellow', 'green', 'pink', 'orange'] as const;

/**
 * "Phones and touch": a real editor at the width of a phone, a tablet or the
 * page; what a narrow window changes; the gestures; the bar for a finger; the
 * keyboard of the screen; the reading view; and doing it in an interface of
 * your own.
 */
export async function MobilePage() {
  const [shell, plain, reading] = await Promise.all([
    highlight(
      `function Shell() {
  const { narrow, keyboard } = useDocsResponsive(600);
  return (
    <div className="flex h-dvh flex-col" style={{ paddingBottom: keyboard }}>
      {!narrow && <Ruler />}
      <DocsSurface className="min-h-0 flex-1" />
    </div>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { createResponsive, keyboardInset, onKeyboard } from '@rebodocs/editor';

const responsive = createResponsive(shell, editor);   // shell: what the editor and its bars are in
responsive.narrow;                                     // true under 600 pixels
const stop = onKeyboard(() => console.log(keyboardInset()));  // pixels the keyboard covers`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(`commands.setView('flow');     // and 'column' to go back to the pages`, 'ts', LIGHT_THEME),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Phones and touch</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        A document does not change with the screen. Its pages are the same on a phone as on a monitor: the window is a place to look at them from, nearer or further, like a desk. What adapts is the
        zoom, the controls and the input.
      </p>
      <div className="mt-4">
        <HandTip>tip: change the width below, and watch what the editor does with it</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="At the width of a phone">
          The React component, as it comes: under 600 pixels it makes do with a narrow window by itself (<code className={mono}>features.responsive</code>, on unless switched off).
        </SectionHead>
        <LazyPhoneDemo />
      </section>

      <section aria-labelledby="narrow" className="mt-24">
        <SectionHead id="narrow" badge="Narrow" color="blue" title="What a narrow window changes">
          Never the document: how it is shown, and what is around it.
        </SectionHead>
        <div className="mt-7 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))' }}>
          {NARROW.map((card, i) => (
            <div key={card.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i % COLORS.length]]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="gestures" className="mt-24">
        <SectionHead id="gestures" badge="Touch" color="purple" title="Gestures">
          What a finger does on the pages. With a mouse, none of the handles or the bar below show.
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {GESTURES.map((row) => (
            <div key={row.gesture} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[160px_1fr]">
              <dt className="text-[15px] font-semibold text-ink">{row.gesture}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{row.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="bar" className="mt-24">
        <SectionHead id="bar" badge="Bar" color="yellow" title="The bar for a finger">
          A selection made by touch brings up the bar beside it, which then also offers Copy, Cut, Paste, Paste as text and Select all: there are no keys for them. A tap on the caret brings it up
          with Paste and Select all, as a phone does.
        </SectionHead>
        <p className={prose}>
          It is the same bar a tap of ⌘ (Ctrl) brings up beside a selection with a keyboard, with what it offers for the text, the table or the picture selected. A touch anywhere else puts it away.
        </p>
        <Callout title="Paste needs HTTPS.">
          It is only offered on a page served over HTTPS, or on <code className={mono}>localhost</code>. Elsewhere the browser does not let a page read the clipboard; copying still works.
        </Callout>
      </section>

      <section aria-labelledby="keyboard" className="mt-24">
        <SectionHead id="keyboard" badge="Keyboard" color="pink" title="The keyboard of the screen">
          A phone does not make the window shorter when its keyboard comes up: it draws the keyboard over it.
        </SectionHead>
        <p className={prose}>
          The editor keeps the caret in what is left to be seen, and the interface that comes with it leaves the covered part empty, so its bars stay above the keyboard. Words appear as they are
          typed, also with a keyboard that composes them (every phone keyboard does), and change when the keyboard corrects the one being typed.
        </p>
      </section>

      <section aria-labelledby="reading-view" className="mt-24">
        <SectionHead id="reading-view" badge="View" color="orange" title="Reading view">
          The text set to the width of the window, with no pages, at its real size. It is never switched on by itself: some people prefer it to read or write at length on a phone.
        </SectionHead>
        <p className={prose}>
          It is the first of the views at the foot of the editor (the lines at the right of the status bar; in a narrow window, the only one left), and pressed again it goes back to the pages. Try it
          in the demo above. In code:
        </p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: reading }} />
        <p className={prose}>
          It is the same document, and exports the same file. Tables narrow to fit, as far as their columns can still be read; pictures shrink; what belongs to the page (header, footer, letterhead) is
          not shown there.
        </p>
      </section>

      <section aria-labelledby="own" className="mt-24">
        <SectionHead id="own" badge="Your UI" color="green" title="In your own interface">
          With the{' '}
          <a href="/docs/headless/" className={LINK}>
            headless hooks
          </a>
          , <code className={mono}>useDocsResponsive</code> fits the pages to the width, and says whether the window is narrow and how many pixels of it the keyboard covers.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: shell }} />
        <p className={prose}>
          <code className={mono}>state.touch</code> is true from a touch of the screen until the mouse is used: there are then no keys to copy and paste with. Without React:
        </p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: plain }} />
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge="Honest" color="orange" title="What to know" />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          {KNOW.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
