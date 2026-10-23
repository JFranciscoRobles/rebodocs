import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { HEARD, KEYS, NOT_CHECKED, PARTS, PDF_TAGS, SEEN } from './data';
import { LazyListenDemo, LazyPdfDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const COLORS = ['blue', 'purple', 'yellow', 'green', 'pink', 'orange'] as const;

function Cards({ rows, min = 260 }: { rows: { title: string; text: string }[]; min?: number }) {
  return (
    <div className="mt-7 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${min}px),1fr))` }}>
      {rows.map((card, i) => (
        <div key={card.title} className="rounded-2xl border border-border p-5">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i % COLORS.length]]}`}>{card.title}</span>
          <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * "Accessibility": what a screen reader hears from a real editor, written down
 * as it is said; screen reader mode; the keys; what is seen; what an
 * interface of your own has to do; and what has not been checked.
 */
export async function AccessibilityPage() {
  const [mode, own, alt, pdf] = await Promise.all([
    highlight(`editor.screenReader = true;   // or let the person press ⌘⌥Z (Ctrl+Alt+Z)`, 'ts', LIGHT_THEME),
    highlight(
      `editor.announce('Document saved');        // said when the screen reader is free
editor.announce('Could not save', true);   // said at once, over what it was saying`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { altText, setAltText } from '@rebodocs/core';

altText(run.props.object);                              // 'Plan of the flat: …', or undefined
doc = setAltText(doc, { para: 7, offset: 0 }, 'Plan of the flat: a living room and two bedrooms');`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `const { pdf } = renderPdf(doc, fonts, 'Lease of the flat', 'es-MX');   // on a server
const bytes = await editor.exportPdf('Lease of the flat');            // in the browser, in the language of the text`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Accessibility</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        The pages are drawn as positioned pieces of text a screen reader cannot follow. So the editor tells the screen reader what happens instead, and every part around the pages works from the
        keyboard. It follows WCAG 2.2 at level AA, with the exceptions said below.
      </p>
      <div className="mt-4">
        <HandTip>tip: move with the arrows in the document below, and read what a screen reader would say</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="What a screen reader hears">
          A real editor and its live regions, the hidden places a screen reader reads aloud: each line is something it would say. A <code className={mono}>!</code> is said at once, over what it was
          saying; a dot, when it is free.
        </SectionHead>
        <LazyListenDemo />
        <p className={prose}>
          The field that has the keyboard is called “Document”, and its description gives the keys to leave it. The pages, the caret and the selection are hidden from screen readers (
          <code className={mono}>aria-hidden</code>): what they show is said.
        </p>
      </section>

      <section aria-labelledby="heard" className="mt-24">
        <SectionHead id="heard" badge="Spoken" color="blue" title="What is said">
          After each key. What the editor says is in the language of the interface; the text of the document, in the language of the text, so a screen reader reads each with its own voice.
        </SectionHead>
        <div className="mt-7 grid max-w-[920px] gap-3">
          {HEARD.map((one, i) => (
            <div key={one.title} className="grid gap-x-6 gap-y-2 rounded-2xl border border-border p-5 md:grid-cols-[1fr_280px]">
              <div>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i]]}`}>{one.title}</span>
                <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{one.text}</p>
              </div>
              <p className="m-0 self-center rounded-lg bg-[#2f2e2b] px-3 py-2 font-code text-[12.5px] leading-[1.5] text-[#f5c443]">{one.example}</p>
            </div>
          ))}
        </div>
        <h3 id="pictures" className="m-0 mt-12 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          Pictures and their description
        </h3>
        <p className={prose}>
          A picture is read by the description Word keeps for it (its “Alt Text”), which a DOCX brings and takes back. One without it is read as “Picture without a description”. Select a picture and
          press <strong>Description</strong> in the bar beside it to write one; an assistant does it with <code className={mono}>edit_image</code>, and reads it in{' '}
          <code className={mono}>[image: …]</code>. In code:
        </p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: alt }} />
      </section>

      <section aria-labelledby="screen-reader-mode" className="mt-24">
        <SectionHead id="screen-reader-mode" badge="Mode" color="purple" title="Screen reader mode">
          <strong>⌘⌥Z</strong> (Ctrl+Alt+Z on Windows and Linux) turns it on and off, as in Google Docs. The hidden field then holds the paragraph the caret is in, with the caret and the selection
          where they are.
        </SectionHead>
        <p className={prose}>
          The screen reader reads it with its own commands (the current line, the word, spelling it out), and a braille display shows it. The editor stops saying the text, so it is not heard twice,
          and says only where the caret is: the page, the table, the heading. Turn it on in the demo above and watch the hidden field.
        </p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: mode }} />
        <p className={prose}>
          What is typed in this mode goes into the document as usual. A keyboard that composes words (Chinese, Japanese, a phone’s) puts in the word when it is finished, not letter by letter.
        </p>
      </section>

      <section aria-labelledby="the-keyboard" className="mt-24">
        <SectionHead id="the-keyboard" badge="Keys" color="orange" title="The keyboard">
          Everything around the pages can be reached and used without a mouse.
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {KEYS.map((row) => (
            <div key={row.keys} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[200px_1fr]">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{row.keys}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{row.text}</dd>
            </div>
          ))}
        </dl>
        <Cards rows={PARTS} />
        <p className={prose}>
          The keys of the document itself, to type and format, are on the page{' '}
          <a href="/docs/editor-api/" className={LINK}>
            Editor API
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="seen" className="mt-24">
        <SectionHead id="seen" badge="Seen" color="yellow" title="What is seen">
          For whoever sees the screen, but not all of it, or not in its colours.
        </SectionHead>
        <Cards rows={SEEN} min={240} />
      </section>

      <section aria-labelledby="pdf" className="mt-24">
        <SectionHead id="pdf" badge="PDF" color="green" title="The PDF">
          A PDF made from a document is tagged: a screen reader finds in it what the document is made of, in the order it is written, and in its language.
        </SectionHead>
        <LazyPdfDemo />
        <p className={prose}>
          The lease of the demo above, made into a PDF in this page with <code className={mono}>renderPdf</code> and read back out of the PDF: each tag, and the text the pages give it. Take the
          language or the description away and it stops saying it is PDF/UA.
        </p>
        <Cards rows={PDF_TAGS} />
        <div className={`mt-7 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: pdf }} />
        <p className={prose}>
          The language is the one given, or the one chosen at the foot of the editor, or the one the file says (in the editor, for a document that says none, the interface’s when it was opened). When
          the PDF has a title and a language, every font is inside it and every picture has a description, it says it is PDF/UA, the standard for PDFs anyone can read, and veraPDF, its checker, finds
          nothing in it. A font the browser has no file for is not inside it, so a PDF exported from the editor in that font does not say so; on a server, give{' '}
          <a href="/docs/fonts/" className={LINK}>
            the font files
          </a>
          . What the document itself gets wrong, a heading level skipped or a picture without a description, stays in the PDF as it is.
        </p>
      </section>

      <section aria-labelledby="own" className="mt-24">
        <SectionHead id="own" badge="Your UI" color="pink" title="For your own interface">
          With the{' '}
          <a href="/docs/headless/" className={LINK}>
            headless hooks
          </a>{' '}
          the bars are yours, and so is making them accessible.
        </SectionHead>
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>
            Give buttons that stay on <code className={mono}>aria-pressed</code>, buttons that open a menu <code className={mono}>aria-haspopup</code> and <code className={mono}>aria-expanded</code>,
            and colour swatches a name.
          </li>
          <li>The document keeps saying what the caret meets, as it does in the editor’s own interface: that is the editor’s, not the bars’.</li>
          <li>Say what your buttons do that cannot be seen from the document, through the editor’s live regions:</li>
        </ul>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: own }} />
      </section>

      <section aria-labelledby="what-is-not-checked" className="mt-24">
        <SectionHead id="what-is-not-checked" badge="Honest" color="orange" title="What is not checked" />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          {NOT_CHECKED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
