import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { CORE, HEADLESS, MEMBERS, MENU, RULES } from './data';
import { LazyEditorDemo, LazyMarginsDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

function Signatures({ rows }: { rows: { sig: string; text: string }[] }) {
  return (
    <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
      {rows.map((m) => (
        <div key={m.sig} className="border-t border-[#f0eee9] py-3 first:border-t-0">
          <dt className="font-code text-[13.5px] font-semibold text-ink">{m.sig}</dt>
          <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{m.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A sheet with a letterhead, drawn: the band, the text kept clear of it, the address. */
function Sheet() {
  return (
    <svg
      viewBox="0 0 612 792"
      role="img"
      aria-label="A page with a band at the top, an address at the foot, and the text between them"
      className="h-auto w-[150px] flex-none rounded shadow-[0_1px_4px_rgba(0,0,0,0.15)]"
    >
      <rect width="612" height="792" fill="#fff" />
      <rect width="612" height="92" fill="#1f4e8c" />
      <circle cx="54" cy="46" r="18" fill="#fff" />
      <rect x="84" y="38" width="170" height="16" rx="3" fill="#fff" />
      {[150, 190, 214, 238, 262, 300, 324, 348].map((y, i) => (
        <rect key={y} x="72" y={y} width={i === 0 ? 200 : i % 3 === 2 ? 320 : 468} height="9" rx="2" fill="#d4d2cc" />
      ))}
      <path d="M0 128h612M0 666h612" stroke="#d6336c" strokeWidth="3" strokeDasharray="12 9" />
      <rect x="48" y="748" width="516" height="2" fill="#1f4e8c" />
      <rect x="48" y="758" width="360" height="9" rx="2" fill="#1f4e8c" opacity=".7" />
    </svg>
  );
}

/**
 * "Letterheads": a picture the size of the page under the text, given to a
 * real editor on the page, how its margins are read from its pixels, from an
 * application, from code, and what counts as one.
 */
export async function LetterheadPage() {
  const [prop, headless, core, mcp] = await Promise.all([
    highlight(`<DocsEditor docx={file} letterhead="/brand/letterhead.png" />`, 'tsx', LIGHT_THEME),
    highlight(
      `const { letterhead, setLetterhead, fitLetterheadMargins, removeLetterhead, letterheadFile } = useDocsPage();

<input type="file" accept="image/png,image/jpeg" onChange={(e) => e.target.files?.[0] && setLetterhead(e.target.files[0])} />`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { exportDocx, importDocx, letterheadOf, setLetterhead } from '@rebodocs/core';

let doc = importDocx(template);
doc = setLetterhead(doc, { bytes: png, type: 'image/png' });
letterheadOf(doc);           // { part: 'header', para: 0, offset: 0, xml }
const docx = exportDocx(doc);`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `set_letterhead { "path": "/brand/norte-studio.png" }      // the band and address above
→ Letterhead set, behind the text of every page. Top margin 3.9 cm, bottom 2.5 cm, to clear what it prints.`,
      'bash',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Letterheads</h1>
      <div className="mt-3.5 flex flex-wrap items-start gap-8">
        <div className="min-w-0 flex-[1_1_420px]">
          <p className="m-0 max-w-[640px] text-lg leading-[1.6] text-muted">
            A letterhead is a picture the size of the page, behind the text of every page: the logo at the top, the address at the foot, a pattern across the sheet. In a DOCX it lives in the header,
            placed from the page and drawn under the text, which is how Word does it and how Rebodocs reads and writes it.
          </p>
          <p className="m-0 mt-4 max-w-[640px] text-base leading-[1.7] text-ink-soft">
            Documents that come with one keep it: it is drawn, printed, put in the PDF, and written back to the DOCX. Given one, the margins grow to clear what it prints at the top and the foot, the
            dashed lines of the sheet.
          </p>
          <div className="mt-4">
            <HandTip>tip: give the letter below a letterhead</HandTip>
          </div>
        </div>
        <Sheet />
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="Give it a letterhead">
          A real editor with a letter. Give it one of three letterheads drawn on this page, as your application would give its own, and watch the margins; or open the menu and pick a picture of yours.
        </SectionHead>
        <LazyEditorDemo />
      </section>

      <section aria-labelledby="in-the-editor" className="mt-24">
        <SectionHead id="in-the-editor" badge="The interface" color="blue" title="In the editor">
          The document menu (☰), under <strong>Page</strong>. Fit, extract and remove show only when there is a letterhead.
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {MENU.map((row) => (
            <div key={row.item} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[300px_1fr]">
              <dt className="text-[15px] font-semibold text-ink">{row.item}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{row.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="how-margins-are-fitted" className="mt-24">
        <SectionHead id="how-margins-are-fitted" badge="@rebodocs/core" color="orange" title="How margins are fitted">
          The picture is read pixel by pixel, at 320 across: where its printing ends at the top, and where it starts at the foot. Make the band and the address taller, or take them away.
        </SectionHead>
        <LazyMarginsDemo />
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
          {[
            { title: 'The paper', color: 'blue' as const, text: 'The tone there is most of. A row is printed when enough of it is far from that tone; what is see-through counts as white paper.' },
            {
              title: 'Top and foot',
              color: 'purple' as const,
              text: 'Printing that starts in the top fifth and ends before 35% of the page asks for the top margin; the same from the foot. What is in the middle asks for nothing.',
            },
            {
              title: 'Only growing',
              color: 'pink' as const,
              text: 'The margins grow, never shrink, and never past 40% of the page. Side margins are left alone, and so is any text already in the header.',
            },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="from-your-application" className="mt-24">
        <SectionHead id="from-your-application" badge="React" color="purple" title="From your application">
          To give every document your letterhead, whatever it came with:
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: prop }} />
        <p className={prose}>
          <code className={mono}>letterhead</code> is an address to fetch, a <code className={mono}>File</code> or <code className={mono}>Blob</code>, or{' '}
          <code className={mono}>{'{ bytes, type }'}</code>; <code className={mono}>null</code> for none. A server that does not say what it sends is no trouble: the picture is told by how it starts.
          Set, it is yours: the menu does not offer it to the person. Left out, the document keeps its own, and the person may change it.
        </p>
        <p className={prose}>
          It is put once the document is open, and is how the document starts: not a step to undo, and the document is not left unsaved by it. A document that has the very same picture is left alone,
          so in a{' '}
          <a href="/docs/collaboration/" className={LINK}>
            shared room
          </a>{' '}
          the second person to come in does not put it again. Changing the prop later gives the new one as a change; the handle&apos;s <code className={mono}>setLetterhead(source | null)</code> does
          the same.
        </p>
        <h3 id="headless" className="m-0 mt-10 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          Headless
        </h3>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: headless }} />
        <Signatures rows={HEADLESS} />
        <h3 id="editor" className="m-0 mt-10 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          On the editor
        </h3>
        <Signatures rows={MEMBERS} />
      </section>

      <section aria-labelledby="in-code" className="mt-24">
        <SectionHead id="in-code" badge="@rebodocs/core" color="orange" title="In code">
          On a server, to stamp a template before it is filled or sent.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: core }} />
        <Signatures rows={CORE} />
      </section>

      <section aria-labelledby="for-an-assistant" className="mt-24">
        <SectionHead id="for-an-assistant" badge="MCP" color="pink" title="For an assistant">
          The{' '}
          <a href="/docs/assistants/" className={LINK}>
            MCP server
          </a>{' '}
          has <code className={mono}>set_letterhead</code>, and <code className={mono}>get_overview</code> says when the document has one.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: mcp }} />
        <p className={prose}>
          The server reads the file, which is why it is not among the tools of an assistant in a page. For a PNG it reads the pixels and grows the margins as the editor does; for a JPEG it leaves
          them, and says so. <code className={mono}>{'"remove": true'}</code> takes the letterhead away.
        </p>
      </section>

      <section aria-labelledby="checked-against-word" className="mt-24">
        <SectionHead id="checked-against-word" badge="Word" color="blue" title="Checked against Word" />
        <p className={prose}>
          A document of two sections, the first turned to landscape with a header of its own, was given a letterhead here and opened in Word for Mac. Word drew it under the text of both pages, each
          the size of its page, and put it in the PDF so. Saved by Word and read back here, it was still the letterhead of both headers.
        </p>
      </section>

      <section aria-labelledby="what-counts" className="mt-24">
        <SectionHead id="what-counts" badge="Rules" color="blue" title="What counts as a letterhead">
          A picture is the document&apos;s letterhead when all four are true. Word has nothing called a letterhead; this is what a letterhead is in a file Word made.
        </SectionHead>
        <div className="mt-6 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
          {RULES.map((rule) => (
            <div key={rule.title} className="rounded-2xl border border-border p-4">
              <p className="m-0 text-[15px] font-semibold text-ink">{rule.title}</p>
              <p className="m-0 mt-1.5 text-[14px] leading-[1.55] text-ink-soft">{rule.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge="Limits" color="yellow" title="What to know" />
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            'The picture is stretched to the page: one of other proportions is distorted. Make it the shape of the paper.',
            'When a letterhead is replaced or removed, its picture leaves the file on export: it is not left inside the ZIP for whoever unpacks it.',
            'One letterhead for the whole document: every page, the first ones and the sections with headers of their own show the same picture, each stretched to its page. Turning the paper of a section turns its own.',
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
