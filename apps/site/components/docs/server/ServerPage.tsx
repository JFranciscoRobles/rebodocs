import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { InstallCommand } from '../InstallCommand';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { CALLS, CATALOG, CLI, PDF_FACTS, PDF_HAS, PDF_HAS_NOT, RUNTIMES, SPEED } from './data';
import { LazyRenderDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const h3 = 'm-0 mt-12 font-display text-xl font-bold tracking-[-0.01em]';
const COLORS = ['blue', 'purple', 'yellow', 'green', 'pink', 'orange'] as const;

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

function Code({ html }: { html: string }) {
  return <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * "On a server: DOCX and PDF": @rebodocs/core without a browser. A template
 * filled and rendered in the page as a server renders it, where it runs, a
 * route that makes a PDF, the calls and how to find where to edit, all the
 * core does, the PDF and what it has, how fast it is, documents sent by
 * others, the command-line tool, laying out by hand, and a backend that uses them.
 */
export async function ServerPage() {
  const [basic, find, express, route, pdf, cli, layout, untrusted] = await Promise.all([
    highlight(
      `import { importDocx, exportDocx, insertText, fillVariables } from '@rebodocs/core';

let doc = importDocx(bytes);                                  // Uint8Array → Doc
doc = fillVariables(doc, { client: { name: 'Ana Pérez' }, lines: [{ item: 'Desk', price: 250 }] });
doc = insertText(doc, { para: 0, offset: 0 }, 'DRAFT · ').doc;
const out = exportDocx(doc);                                  // Doc → Uint8Array`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { findAll, replaceAll, paragraphText, insertText } from '@rebodocs/core';

const [where] = findAll(doc, 'Payment is due');               // [{ from: { para, offset }, to }]
doc = insertText(doc, where.to, ' in full').doc;              // after what was found

doc = replaceAll(doc, '15 days', '30 days', { wholeWord: true }).doc;

const title = doc.paragraphs.findIndex((p) => paragraphText(p).startsWith('Annex'));`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import express from 'express';
import { readFileSync } from 'node:fs';
import { fillVariables, importDocx, readFonts, renderPdf } from '@rebodocs/core';

// Read once, when the server starts. A Doc is never changed in place,
// so one template serves every request at the same time.
const template = importDocx(new Uint8Array(readFileSync('templates/receipt.docx')));
const fonts = ['Arial.ttf', 'Arial Bold.ttf', 'Arial Italic.ttf', 'Arial Bold Italic.ttf']
  .flatMap((file) => readFonts(new Uint8Array(readFileSync(\`fonts/\${file}\`))));

const app = express();
app.post('/receipts', express.json(), (req, res) => {
  const doc = fillVariables(template, req.body, { locale: 'en-US' });
  const { pdf, missingFonts } = renderPdf(doc, fonts, \`Receipt \${req.body.number}\`);
  if (missingFonts.size) console.warn('Stood in for:', missingFonts);
  res.type('application/pdf')
    .set('Content-Disposition', \`attachment; filename="receipt-\${req.body.number}.pdf"\`)
    .send(Buffer.from(pdf));
});`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `// app/receipts/route.ts — the same in Next.js, and with Request and Response
// as they are, in Deno, Bun or a Worker (where the files come by fetch).
import { readFile } from 'node:fs/promises';
import { exportDocx, fillVariables, importDocx, readFonts, renderPdf } from '@rebodocs/core';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ready = (async () => ({
  template: importDocx(new Uint8Array(await readFile('templates/receipt.docx'))),
  fonts: (await Promise.all(['Arial.ttf', 'Arial Bold.ttf'].map((file) => readFile(\`fonts/\${file}\`))))
    .flatMap((bytes) => readFonts(new Uint8Array(bytes))),
}))();

export async function POST(request: Request) {
  const { template, fonts } = await ready;
  const doc = fillVariables(template, await request.json());
  if (new URL(request.url).searchParams.get('as') === 'docx') {
    return new Response(exportDocx(doc), { headers: { 'Content-Type': DOCX } });
  }
  const { pdf } = renderPdf(doc, fonts, 'Receipt');
  return new Response(pdf, { headers: { 'Content-Type': 'application/pdf' } });
}`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `import { readFileSync } from 'node:fs';
import { importDocx, readFonts, renderPdf } from '@rebodocs/core';

const fonts = ['Arial.ttf', 'Arial Bold.ttf', 'Arial Italic.ttf']
  .flatMap((file) => readFonts(new Uint8Array(readFileSync(\`fonts/\${file}\`))));

const { pdf, layout, missingFonts, missingPictures } = renderPdf(importDocx(bytes), fonts, 'Receipt 1024');
layout.pages.length;    // how many pages it made
missingFonts;           // e.g. Map { 'Calibri' => 'Arial' }: give the real one for the same lines
missingPictures;        // pictures of a kind it does not draw, left out`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `npx -p @rebodocs/mcp rebodocs-generate template.docx data.json -o receipt.pdf --fonts ./fonts --locale en-US
npx -p @rebodocs/mcp rebodocs-generate template.docx data.json -o receipt.docx
npx -p @rebodocs/mcp rebodocs-generate contract.docx -o contract.md
npx -p @rebodocs/mcp rebodocs-generate template.docx --list`,
      'bash',
      LIGHT_THEME,
    ),
    highlight(
      `import { FontMeasurer, layoutDocument } from '@rebodocs/core';

const layout = layoutDocument(doc, new FontMeasurer(fonts));
layout.pages.length;    // how many pages
layout.lines[0];        // where the first line is, and what is on it`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `let doc;
try {
  doc = importDocx(upload, { maxSize: 50 * 1024 * 1024 });   // 50 MB unpacked at most
} catch (error) {
  return new Response(\`Not a document we can read: \${(error as Error).message}\`, { status: 400 });
}`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  const head = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.04em] text-muted';
  const cell = 'border-t border-[#f0eee9] px-4 py-2.5';

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">On a server: DOCX and PDF</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        <a href="https://www.npmjs.com/package/@rebodocs/core" className={LINK}>
          @rebodocs/core
        </a>{' '}
        has no DOM and uses no API of Node. The code that lays a document out in the browser runs on your server, so a document made there breaks its lines and pages where the editor would, given the same
        fonts.
      </p>
      <div className="mt-5">
        <InstallCommand command="npm install @rebodocs/core" />
      </div>
      <div className="mt-4">
        <HandTip>tip: change the data below, add a line, set paid to true, and the PDF is made again</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="A template, filled and rendered">
          What a server does, run in this page with the same calls: the template filled with the JSON, its row repeated for each line, laid out with font files read by{' '}
          <code className={mono}>readFont</code>, and drawn as a PDF. No browser API takes part in it.
        </SectionHead>
        <LazyRenderDemo />
        <p className={prose}>
          Have the template ask for Arial, which the page does not give: <code className={mono}>missingFonts</code> says so, and the text is set in the font it has. Give the Arial of your
          machine, and it is set in Arial. The fonts decide where lines and pages break, so the pages a server makes are those of the editor when both have the same ones.
        </p>
      </section>

      <section aria-labelledby="where" className="mt-24">
        <SectionHead id="where" badge="Runtimes" color="purple" title="Where it runs">
          Wherever JavaScript does: the package needs the language and <code className={mono}>Intl</code>, and takes files as bytes, <code className={mono}>Uint8Array</code>, whatever read them.
        </SectionHead>
        <div className="mt-7 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-3">
          {RUNTIMES.map((one, i) => (
            <div key={one.title} className="rounded-2xl border border-border p-4">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i]]}`}>{one.title}</span>
              <p className="m-0 mt-2.5 text-[14px] leading-[1.55] text-ink-soft">{one.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="route" className="mt-24">
        <SectionHead id="route" badge="Recipe" color="orange" title="A route that makes a PDF">
          The data comes in as JSON, the document goes out as a PDF, or as a DOCX to be edited. The template and the fonts are read once.
        </SectionHead>
        <Code html={express} />
        <Code html={route} />
        <p className={prose}>
          The data is the JSON your application already has: nested objects fill <code className={mono}>{'{{client.name}}'}</code>, a list repeats a block, true or false keeps one or takes it out.
          How to write them is on the page{' '}
          <a href="/docs/templates/#blocks" className={LINK}>
            Templates and variables
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="open-change-save" className="mt-24">
        <SectionHead id="open-change-save" badge="DOCX" color="blue" title="Open, change, save">
          A <code className={mono}>Doc</code> is an immutable value: every operation returns a new one and leaves the old one as it was. A position is{' '}
          <code className={mono}>{'{ para, offset }'}</code>, the paragraph and the character in it.
        </SectionHead>
        <Code html={basic} />
        <Signatures rows={CALLS} />
        <h3 id="finding" className={`${h3} scroll-mt-24`}>
          Finding where to edit
        </h3>
        <p className={prose}>
          Positions are not typed by hand: they come from the text. <code className={mono}>findAll</code> gives the range of each place a text is, and <code className={mono}>paragraphText</code> the text
          of a paragraph; a table’s paragraphs are among the others, each with the <code className={mono}>cell</code> it is in.
        </p>
        <Code html={find} />
      </section>

      <section aria-labelledby="catalog" className="mt-24">
        <SectionHead id="catalog" badge="Core" color="pink" title="Everything else it does">
          What the editor does to a document, the core does without one: every button of the editor is one of these calls. Each takes a document and gives back a new one.
        </SectionHead>
        <div className="mt-7 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3">
          {CATALOG.map((group, i) => (
            <div key={group.title} className="rounded-2xl border border-border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i % COLORS.length]]}`}>{group.title}</span>
                <span className="font-code text-[11.5px] text-muted">{group.module}</span>
              </div>
              <p className="m-0 mt-2.5 flex flex-wrap gap-x-2 gap-y-1">
                {group.calls.map((call) => (
                  <code key={call} className="font-code text-[13px] text-ink">
                    {call}
                  </code>
                ))}
              </p>
            </div>
          ))}
        </div>
        <p className={prose}>
          The comments in the source say what each takes and gives: the file to open is the module named. The editor’s own methods, which call these, are on the page{' '}
          <a href="/docs/editor-api/" className={LINK}>
            Editor API
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="pdf" className="mt-24">
        <SectionHead id="pdf" badge="PDF" color="orange" title="PDF">
          Laying out needs to know how wide text is. In the browser that is asked of the browser; on a server it is read from font files.
        </SectionHead>
        <Code html={pdf} />
        <div className="mt-7 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-3">
          {PDF_FACTS.map((fact, i) => (
            <div key={fact.title} className="rounded-2xl border border-border p-4">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i % 4]]}`}>{fact.title}</span>
              <p className="m-0 mt-2.5 text-[14px] leading-[1.55] text-ink-soft">{fact.text}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          A server has no fonts unless you put them there. Ship the ones your documents use, as the{' '}
          <a href="/docs/fonts/" className={LINK}>
            fonts
          </a>{' '}
          page tells, and read <code className={mono}>missingFonts</code> to know when one was stood in for.
        </p>
        <div className="mt-8 grid max-w-[920px] gap-3 md:grid-cols-2">
          {[
            { title: 'It has', items: PDF_HAS, color: 'green' as const },
            { title: 'It has not, yet', items: PDF_HAS_NOT, color: 'orange' as const },
          ].map((side) => (
            <div key={side.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[side.color]}`}>{side.title}</span>
              <ul className="m-0 mt-3 grid list-disc gap-1.5 pl-5 text-[14.5px] leading-[1.55] text-ink-soft">
                {side.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="speed" className="mt-24">
        <SectionHead id="speed" badge="Speed" color="green" title="How fast">
          The receipt of the demo, its block repeated to make longer documents, filled and written on an Apple M1 with Node 22, the fonts already read. The median of seven runs.
        </SectionHead>
        <div className="mt-7 max-w-[760px] overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr>
                <th className={head}>Pages</th>
                <th className={head}>fillVariables</th>
                <th className={head}>exportDocx</th>
                <th className={head}>renderPdf</th>
                <th className={head}>PDF size</th>
              </tr>
            </thead>
            <tbody>
              {SPEED.map((row) => (
                <tr key={row.pages}>
                  <td className={`${cell} font-semibold text-ink`}>{row.pages}</td>
                  <td className={`${cell} text-ink-soft`}>{row.fill}</td>
                  <td className={`${cell} text-ink-soft`}>{row.docx}</td>
                  <td className={`${cell} text-ink-soft`}>{row.pdf}</td>
                  <td className={`${cell} text-ink-soft`}>{row.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={prose}>
          It all runs on the thread that calls it: a long document holds that thread for as long as it takes. For many at once, or very long ones, make them in a worker or a queue. Reading the fonts takes
          longer than a page: keep them read.
        </p>
      </section>

      <section aria-labelledby="untrusted" className="mt-24">
        <SectionHead id="untrusted" badge="Safety" color="yellow" title="Documents sent by others">
          A DOCX is a zip file, and one made to harm can say it unpacks to far more than it weighs. <code className={mono}>importDocx</code> adds up what each file of it says it takes before
          unpacking any, and refuses one past <code className={mono}>maxSize</code>.
        </SectionHead>
        <Code html={untrusted} />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>No macro, script or link in a document is run or followed: what the engine does not understand is kept as XML, to be written back.</li>
          <li>The limit is on what the package says. Give your server a limit of its own too, on the size of what it is sent and the time a request may take.</li>
          <li>Pictures of a document are drawn from its own bytes: nothing is fetched from an address in it.</li>
        </ul>
      </section>

      <section aria-labelledby="the-command-line-tool" className="mt-24">
        <SectionHead id="the-command-line-tool" badge="CLI" color="purple" title="The command-line tool">
          The same without writing code. It comes with <code className={mono}>@rebodocs/mcp</code>, which reads the fonts of the machine; in a clone of the repository,{' '}
          <code className={mono}>npm run generate -- …</code> runs it from its source.
        </SectionHead>
        <Code html={cli} />
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {CLI.map((row) => (
            <div key={row.flag} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[250px_1fr]">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{row.flag}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{row.text}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>It warns of the variables and blocks left without a value, and of a value a format cannot take, which is then put as it is.</p>
      </section>

      <section aria-labelledby="laying-out-yourself" className="mt-24">
        <SectionHead id="laying-out-yourself" badge="Layout" color="blue" title="Laying out yourself">
          To know how many pages a document has, or where a line falls, without drawing it.
        </SectionHead>
        <Code html={layout} />
        <p className={prose}>
          <code className={mono}>layoutDocument</code> takes anything that can say the width of a text and the height of a font (<code className={mono}>TextMeasurer</code>), which is how the
          browser and the server share it: the editor measures with the browser, <code className={mono}>FontMeasurer</code> with font files.
        </p>
      </section>

      <section aria-labelledby="a-typical-backend" className="mt-24">
        <SectionHead id="a-typical-backend" badge="Recipe" color="pink" title="A typical backend">
          For an application that fills templates and lets people edit the result:
        </SectionHead>
        <ol className="m-0 mt-6 grid max-w-[920px] list-none gap-3 p-0 [counter-reset:step]">
          {[
            <>Keep the templates as DOCX in your storage, and the fonts they use beside your code.</>,
            <>
              To make one: <code className={mono}>importDocx</code> → <code className={mono}>fillVariables</code> → <code className={mono}>exportDocx</code>, or{' '}
              <code className={mono}>renderPdf</code>, and store the result.
            </>,
            <>
              To edit it: give the stored DOCX to the{' '}
              <a href="/docs/react/" className={LINK}>
                React component
              </a>{' '}
              and store what <code className={mono}>onSave</code> hands back.{' '}
              <a href="/docs/storage/" className={LINK}>
                Documents in an S3 bucket
              </a>{' '}
              does it, with a demo to run.
            </>,
            <>
              For several people at once, see{' '}
              <a href="/docs/collaboration/" className={LINK}>
                collaboration
              </a>
              .
            </>,
          ].map((step, i) => (
            <li key={i} className="flex gap-4 rounded-2xl border border-border px-5 py-4 [counter-increment:step] before:font-display before:text-xl before:font-extrabold before:text-brand before:content-[counter(step)]">
              <p className="m-0 text-[15px] leading-normal text-ink-soft">{step}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
