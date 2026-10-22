import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION, CODE, LINK } from '../styles';
import { Callout, HandTip, SectionHead } from '../ui';
import { DOES, FUNCTIONS, KINDS, SOURCE } from './data';
import { LazyFontsDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/**
 * "Fonts": a font no machine has given to the editor on the page, how to give
 * one and its faces, what goes into the PDF and the DOCX by kind of file, and
 * the fonts a DOCX carries itself.
 */
export async function FontsPage() {
  const [prop, anywhere, css, faces, server] = await Promise.all([
    highlight(
      `<DocsEditor
  docx={file}
  fonts={[
    { family: 'Raleway', src: '/fonts/Raleway-Regular.ttf' },
    { family: 'Raleway', src: '/fonts/Raleway-Bold.ttf', bold: true },
    { family: 'Raleway', src: '/fonts/Raleway-Italic.ttf', italic: true },
  ]}
/>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { addFonts } from '@rebodocs/react';   // or '@rebodocs/editor'

const read = await addFonts([{ family: 'Raleway', src: '/fonts/Raleway-Regular.ttf' }]);
// [true]: false when the file could not be read`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `@font-face {
  font-family: 'Raleway';   /* the name the documents give it */
  src: url('/fonts/raleway.woff2') format('woff2');
}`,
      'css',
      LIGHT_THEME,
    ),
    highlight(
      `addFonts([{ family: 'Raleway' }]);   // listed, and waited for before the text is measured`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { importDocx, readFont, renderPdf } from '@rebodocs/core';

const fonts = ['Raleway-Regular.ttf', 'Raleway-Bold.ttf'].flatMap((file) => readFont(readFileSync(\`fonts/\${file}\`)) ?? []);
const { pdf, missingFonts } = renderPdf(importDocx(bytes), fonts);`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Fonts</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        The editor measures and paints with the browser&apos;s fonts, so any font the machine has already works. For one it does not have, your brand&apos;s typeface or a letterhead&apos;s, give the editor
        the file.
      </p>
      <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: prop }} />
      <div className="mt-4">
        <HandTip>tip: give the page below a font, then make a PDF</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="Give it a font">
          Courier Prime is on almost no machine. Give it to the page, put the document in it, and make the files: the PDF and the DOCX say what they carry.
        </SectionHead>
        <LazyFontsDemo />
        <p className={prose}>
          Make the PDF before and after step 1: before, it names a standard font; after, it carries Courier Prime. The DOCX carries it only while its text is in it: whole, cut down with{' '}
          <code className={mono}>&apos;subset&apos;</code>, or not at all.
        </p>
      </section>

      <section aria-labelledby="what-it-does" className="mt-24">
        <SectionHead id="what-it-does" badge="Once given" color="blue" title="What a font is used for" />
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
          {DOES.map((item) => (
            <div key={item.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[item.color]}`}>{item.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{item.text}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          Fonts belong to the page, not to one editor: every editor on it uses them, and they stay once given. Giving the same face of the same family again with the same source does nothing, so a
          component that renders again does not load its fonts again; with another source, the new file takes its place.
        </p>
      </section>

      <section aria-labelledby="the-source" className="mt-24">
        <SectionHead id="the-source" badge="Giving one" color="purple" title="The source">
          The <code className={mono}>fonts</code> prop, also changed later: a font added to it is loaded then. Anywhere else, and at any time, there is <code className={mono}>addFonts</code>.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: anywhere }} />
        <div className="mt-6 max-w-[860px] overflow-hidden rounded-2xl border border-border">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface">
              <tr>
                <th className={`${CAPTION} px-5 py-2.5`}>src</th>
                <th className={`${CAPTION} px-5 py-2.5`}>When</th>
              </tr>
            </thead>
            <tbody className="text-[15px] leading-normal text-ink-soft">
              {[
                ['An address', 'The file is fetched.'],
                ['Bytes (ArrayBuffer, Uint8Array)', 'You already have it: from your API, a file input, a database.'],
                ['Left out', 'The page loads the font itself, with an @font-face rule. The editor only lists it, and waits for it before measuring.'],
              ].map(([src, when]) => (
                <tr key={src} className="border-t border-[#f0eee9]">
                  <td className="px-5 py-2.5 font-code text-[13.5px] text-ink">{src}</td>
                  <td className="px-5 py-2.5">{when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="m-0 mt-12 font-display text-xl font-bold tracking-[-0.01em]">A font the page loads itself</h3>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: css }} />
        <div className={`mt-2 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: faces }} />
        <p className={prose}>
          The family must be the name the documents give the font. <code className={mono}>next/font</code> gives its fonts names of its own (<code className={mono}>__Raleway_a1b2c3</code>), which no
          document has: for those, give the file with <code className={mono}>src</code>. A font left out goes into neither the PDF nor the DOCX: there is no file to put in.
        </p>
        <h3 id="faces" className="m-0 mt-12 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          Faces
        </h3>
        <p className={prose}>
          A family is given one face at a time: regular, bold, italic, each its own file. A face not given is imitated from the regular one, on screen by the browser, as on any web page, and in a PDF
          the same way: the letters drawn thicker, or slanted. An imitation is not the face its designer drew: give the four (bold italic is <code className={mono}>bold: true, italic: true</code>) for text in all of them.
        </p>
      </section>

      <section aria-labelledby="into-the-files" className="mt-24">
        <SectionHead id="into-the-files" badge="PDF and DOCX" color="pink" title="Into the files">
          What a font goes into depends on the kind of file it is.
        </SectionHead>
        <div className="mt-7 max-w-[920px] overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead className="bg-surface">
              <tr>
                <th className={`${CAPTION} px-5 py-2.5`}>File</th>
                <th className={`${CAPTION} px-5 py-2.5`}>On screen</th>
                <th className={`${CAPTION} px-5 py-2.5`}>In the PDF</th>
                <th className={`${CAPTION} px-5 py-2.5`}>In the DOCX</th>
              </tr>
            </thead>
            <tbody className="text-[15px] leading-normal text-ink-soft">
              {KINDS.map((row) => (
                <tr key={row.kind} className="border-t border-[#f0eee9]">
                  <td className="px-5 py-2.5 font-code text-[13.5px] text-ink">{row.kind}</td>
                  <td className="px-5 py-2.5">{row.screen}</td>
                  <td className={`px-5 py-2.5 ${row.pdf.startsWith('No') ? 'text-muted' : ''}`}>{row.pdf}</td>
                  <td className={`px-5 py-2.5 ${row.docx === 'No' ? 'text-muted' : ''}`}>{row.docx}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={prose}>
          A PDF without the file names the standard font nearest the name: Courier for a monospaced one, Times for a serif, Helvetica for the rest. Words stay where the editor measured them, so lines keep
          their length, though the letters are not the font&apos;s. Printing from the browser uses the font as shown, whatever its kind.
        </p>
        <h3 id="docx" className="m-0 mt-12 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          The DOCX
        </h3>
        <p className={prose}>
          The faces go in when some text of the document is in their family, its tables, headers, footers and styles included, as Word embeds fonts: someone who opens the file without the font installed sees it
          all the same. A font whose licence says it may not be embedded, or only as pictures, stays out.
        </p>
        <div className="mt-6 max-w-[860px] overflow-hidden rounded-2xl border border-border">
          <table className="w-full border-collapse text-left">
            <thead className="bg-surface">
              <tr>
                <th className={`${CAPTION} px-5 py-2.5`}>embedFonts</th>
                <th className={`${CAPTION} px-5 py-2.5`}>The font goes</th>
              </tr>
            </thead>
            <tbody className="text-[15px] leading-normal text-ink-soft">
              {[
                ['true (default)', 'Whole, as Word embeds it. Whoever opens the file can type anything in it.'],
                ["'subset'", 'Cut down to the characters of the document and of the keyboard, as Word’s “Embed only the characters used”: a much smaller file. A character typed later that it does not keep shows in another font for whoever lacks the font. Whole when the licence says it may not be cut down.'],
                ['false', 'Not at all.'],
              ].map(([value, goes]) => (
                <tr key={value} className="border-t border-[#f0eee9]">
                  <td className="whitespace-nowrap px-5 py-2.5 font-code text-[13.5px] text-ink">{value}</td>
                  <td className="px-5 py-2.5">{goes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={prose}>
          On <code className={mono}>DocsEditor</code> and <code className={mono}>DocsProvider</code> it is a prop, followed when it changes; on the editor, <code className={mono}>editor.embedFonts</code>.
        </p>
        <Callout title="PDF needs .ttf or .otf.">A .woff2 shows and measures as well, but the PDF draws its text in a standard font. Serve a .ttf for the editor even when the page uses .woff2.</Callout>
      </section>

      <section aria-labelledby="fonts-a-docx-carries" className="mt-24">
        <SectionHead id="fonts-a-docx-carries" badge="In the file" color="orange" title="Fonts a DOCX carries" />
        <p className={prose}>
          A DOCX saved by Word with its fonts embedded brings them along. The editor uses the ones this machine lacks, laying the document out again once they load, and draws its PDFs with them before
          any font given. Saving keeps them in the file. They are of that document: they are not listed in the toolbar, and they go when another document is opened.
        </p>
      </section>

      <section aria-labelledby="on-a-server" className="mt-24">
        <SectionHead id="on-a-server" badge="No browser" color="yellow" title="On a server">
          With no browser, <code className={mono}>addFont</code> does nothing and says false. The width of text is read from font files given to <code className={mono}>renderPdf</code>.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: server }} />
        <p className={prose}>
          See{' '}
          <a href="/docs/server/" className={LINK}>
            On a server
          </a>
          : <code className={mono}>missingFonts</code>, what stands in, and the fonts of the system.
        </p>
      </section>

      <section aria-labelledby="from-code" className="mt-24">
        <SectionHead id="from-code" badge="Reference" color="blue" title="From code">
          From <code className={mono}>@rebodocs/react</code> or <code className={mono}>@rebodocs/editor</code>; the last two, from <code className={mono}>@rebodocs/editor</code> only.
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {FUNCTIONS.map((fn) => (
            <div key={fn.name} id={`fn-${fn.name}`} className="scroll-mt-24 border-t border-[#f0eee9] py-3.5 first:border-t-0">
              <dt className="font-code text-[13.5px] text-ink">
                <span className="font-semibold">{fn.signature}</span> <span className="text-muted">→ {fn.returns}</span>
                {fn.editorOnly && <span className={`ml-2 rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold ${PASTEL_CLASS.purple}`}>editor</span>}
              </dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{fn.text}</dd>
            </div>
          ))}
        </dl>
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">FontSource</h3>
        <dl className="m-0 mt-4 max-w-[920px] rounded-2xl border border-border px-5">
          {SOURCE.map((field) => (
            <div key={field.name} className="border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="font-code text-[13.5px] text-ink">
                <span className="font-semibold">{field.name}</span>
                {field.name !== 'family' && '?'}: <span className="text-muted">{field.type}</span>
              </dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{field.text}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          On <code className={mono}>DocsEditor</code> and <code className={mono}>DocsProvider</code>, <code className={mono}>fonts?: FontSource[]</code> and{' '}
          <code className={mono}>embedFonts?: boolean | &apos;subset&apos;</code>, both followed when they change. A list of the same fonts in a new array is not read again.
        </p>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge="Limits" color="yellow" title="What to know" />
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            'There is no taking a font away once given; a page reload starts without it.',
            'A font that loads after the document is open lays every page out again: lines and page breaks can move under the person’s eyes. Give fonts before opening, or wait for addFonts.',
            'The file is fetched by the browser: an address on another domain needs CORS.',
            'A DOCX carries each face whole unless embedFonts is \'subset\': a font of 300 KB makes the file 300 KB larger.',
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
