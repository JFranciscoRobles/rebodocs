import { type TemplateData, createDoc, docText, fillVariables, formatText, formatValue, paragraphText } from '@rebodocs/core';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { CAPTION, CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { ALIASES, BLOCK_KINDS, BLOCK_RULES, CORE, EDITOR, FORMAT_ROWS, LOCALES, PANEL, RULES, TOOLS } from './data';
import FormatsDemo from './FormatsDemo';
import { LazyEditorDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const h3 = 'm-0 mt-12 font-display text-xl font-bold tracking-[-0.01em]';

const LINE = 'Received from {{client | capital}} the amount of {{amount | currency}} on {{date | long date}}.';
/** The line of the top of the page, filled by fillVariables when the site is built. */
const FILLED = paragraphText(fillVariables(createDoc([{ props: {}, runs: [{ text: LINE, props: {} }] }]), { client: 'ana pérez', amount: '2500', date: '2026-10-13' }, { locale: 'en-US' }).paragraphs[0]);

/** The example of blocks: a template of paragraphs, the data, and what fillVariables makes of them when the site is built. */
const ORDER = ['Order {{number}} for {{client.name}}{{#client.vip}} (priority){{/client.vip}}', '{{#lines}}', '{{lines.qty}} × {{lines.item}}: {{lines.price | currency}}', '{{/lines}}', '{{^lines}}', 'Nothing ordered yet.', '{{/lines}}'];
const ORDER_DATA: TemplateData = { number: 18, client: { name: 'Ana Pérez', vip: true }, lines: [{ qty: 2, item: 'Desk lamp', price: 45 }, { qty: 1, item: 'Chair', price: 120 }] };
const ORDERED = docText(fillVariables(createDoc(ORDER.map((text) => ({ props: {}, runs: [{ text, props: {} }] }))), ORDER_DATA, { locale: 'en-US' })).split('\n');

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

function Cards({ rows, colors }: { rows: { title: string; text: string }[]; colors: (keyof typeof PASTEL_CLASS)[] }) {
  return (
    <div className="mt-7 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
      {rows.map((card, i) => (
        <div key={card.title} className="rounded-2xl border border-border p-5">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[colors[i % colors.length]]}`}>{card.title}</span>
          <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
        </div>
      ))}
    </div>
  );
}

/** A line of a template with its variables standing out, as the editor shows them. */
function Template({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{\{[^}]*\}\})/).map((piece, i) =>
        piece.startsWith('{{') ? (
          <span key={i} className="rounded bg-[#fdf3d1] px-0.5 font-code text-[0.86em] text-[#8a5a00]">
            {piece}
          </span>
        ) : (
          piece
        ),
      )}
    </>
  );
}

/**
 * "Templates and variables": a template filled in a real editor, how a
 * variable is read, its formats tried and tabled as the code writes them, in
 * a language, the panel, the calls, the tools of an assistant and signatures.
 */
export async function TemplatesPage() {
  const [core, locale, cli] = await Promise.all([
    highlight(
      `import { importDocx, variableNames, variableProblems, fillVariables, exportDocx } from '@rebodocs/core';

const doc = importDocx(template);
variableNames(doc);                  // ['client', 'amount', 'date']

const values = { client: 'ana pérez', amount: '2500', date: '2026-10-13' };
variableProblems(doc, values);       // [] — or { name, format, kind } for each that would go wrong

const docx = exportDocx(fillVariables(doc, values, { locale: 'en-US' }));`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `fillVariables(doc, values);                                        // 13 de octubre de 2026 · $2,500.00
fillVariables(doc, values, { locale: 'en-US' });                   // October 13, 2026 · $2,500.00
fillVariables(doc, values, { locale: 'de-DE', currency: 'EUR' });  // 13. Oktober 2026 · 2.500,00 €`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `npx -p @rebodocs/mcp rebodocs-generate template.docx --list
npx -p @rebodocs/mcp rebodocs-generate template.docx data.json -o out.docx --locale en-US
npx -p @rebodocs/mcp rebodocs-generate template.docx data.json -o out.pdf --fonts ./fonts`,
      'bash',
      LIGHT_THEME,
    ),
  ]);

  const head = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.04em] text-muted';
  const cell = 'border-t border-[#f0eee9] px-3 py-2.5 align-top';

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Templates and variables</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        A variable is text between double braces, <code className={mono}>{'{{client}}'}</code>. That is all a template is, so any DOCX can be one and Word shows it as it is: write it in Word, in the editor, or both,
        and fill it in the editor, on a server or from the command line.
      </p>
      <div className="mt-6 max-w-[760px] rounded-[10px] bg-surface px-5 py-4 text-[17px] leading-[1.7] text-ink">
        <p className="m-0">
          <Template text={LINE} />
        </p>
        <p className="m-0 mt-2 border-t border-border pt-2">{FILLED}</p>
      </div>
      <div className="mt-4">
        <HandTip>tip: the second line is the first, filled by fillVariables when this page was built</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge="Live" color="green" title="Fill a template">
          A receipt with variables in its text, its header, a note at the foot of the page and its signatures. Type values in the panel and fill them, or have the page fill them as your application would,
          from a form.
        </SectionHead>
        <LazyEditorDemo />
        <p className={prose}>
          Undo brings the variables back in one step, and the panel keeps what was typed. Open the sliders of a variable to change how it is written: the change is made to the text of the variable,{' '}
          <code className={mono}>{'{{amount | currency}}'}</code>, so Word keeps it too.
        </p>
      </section>

      <section aria-labelledby="writing" className="mt-24">
        <SectionHead id="writing" badge="Syntax" color="blue" title="Writing a template">
          A name between double braces, and after it, if it needs them, the formats its value is written in.
        </SectionHead>
        <Cards rows={RULES} colors={['blue', 'purple', 'yellow', 'green', 'pink', 'orange']} />
      </section>

      <section aria-labelledby="blocks" className="mt-24">
        <SectionHead id="blocks" badge="Blocks" color="purple" title="Lists and conditions">
          What is between <code className={mono}>{'{{#name}}'}</code> and <code className={mono}>{'{{/name}}'}</code> is written once for each item of a list, or kept only when the value is there.
          Plain text still: Word shows the marks as they are.
        </SectionHead>
        <div className="mt-7 grid max-w-[920px] gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border p-4">
            <p className={CAPTION}>The template</p>
            <div className="mt-2.5 grid gap-1 text-[14px] leading-[1.5] text-ink">
              {ORDER.map((line, i) => (
                <p key={i} className="m-0">
                  <Template text={line} />
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className={CAPTION}>The data</p>
            <pre className="m-0 mt-2.5 overflow-x-auto font-code text-[12px] leading-[1.55] text-ink-soft">{JSON.stringify(ORDER_DATA, null, 1)}</pre>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className={CAPTION}>What it makes</p>
            <div className="mt-2.5 grid gap-1 text-[14px] leading-[1.5] text-ink">
              {ORDERED.map((line, i) => (
                <p key={i} className="m-0">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
        <h3 className={h3}>Where the marks are says what is repeated</h3>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {BLOCK_KINDS.map((kind) => (
            <div key={kind.title} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[200px_1fr]">
              <dt className="text-[15px] font-semibold text-ink">{kind.title}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">
                <span className="font-code text-[13px] text-muted">{kind.where}.</span> {kind.text}
              </dd>
            </div>
          ))}
        </dl>
        <Cards rows={BLOCK_RULES} colors={['blue', 'green', 'yellow', 'orange']} />
        <p className={prose}>
          The receipt above repeats a row for each line of what it pays for, and keeps a paragraph only while it is not paid. The same data fills it on a server, from the command line or through an
          assistant.
        </p>
      </section>

      <section aria-labelledby="formats" className="mt-24">
        <SectionHead id="formats" badge="Formats" color="orange" title="Formats">
          What follows a bar says how the value is written. Type a variable and a value, and see each format applied in turn.
        </SectionHead>
        <FormatsDemo />
        <div className="mt-8 max-w-[920px] overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr>
                <th className={head}>Format</th>
                <th className={head}>Value</th>
                {LOCALES.map((code) => (
                  <th key={code} className={head}>
                    {code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FORMAT_ROWS.map((row) => {
                const english = formatText(row.id, row.arg ?? '', 'en');
                return (
                  <tr key={english}>
                    <td className={cell}>
                      <code className="font-code text-[13px] font-semibold text-ink">{english}</code>
                      <span className="block font-code text-[12px] text-muted">{formatText(row.id, row.arg ?? '', 'es')}</span>
                    </td>
                    <td className={`${cell} font-code text-[13px] text-ink-soft`}>{row.value}</td>
                    {LOCALES.map((code) => {
                      const { text, props } = formatValue(row.value, [english], { locale: code });
                      return (
                        <td key={code} className={`${cell} text-ink ${props.bold ? 'font-bold' : ''}`}>
                          {text}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={prose}>
          Every format is read by its English name and its Spanish one (under it, in grey), with or without accents, whatever the language of the document; also by{' '}
          {Object.values(ALIASES)
            .flat()
            .map((alias, i, all) => (
              <span key={alias}>
                <code className={mono}>{alias}</code>
                {i < all.length - 2 ? ', ' : i === all.length - 2 ? ' and ' : ''}
              </span>
            ))}
          . <code className={mono}>italic</code> and <code className={mono}>underline</code> are written like <code className={mono}>bold</code>. Set from the panel, a letter case takes the place of another, and so
          does a type of data: a variable is a date or a number, in one letter case.
        </p>
        <p className={prose}>
          A date is given as <code className={mono}>2026-10-13</code>, <code className={mono}>13/10/2026</code> (day first, or month first in a language that writes it so), or{' '}
          <code className={mono}>today</code> / <code className={mono}>hoy</code>. In a pattern after <code className={mono}>date:</code>, <code className={mono}>d</code>,{' '}
          <code className={mono}>dd</code>, <code className={mono}>dddd</code> (the day of the week), <code className={mono}>M</code>, <code className={mono}>MM</code>, <code className={mono}>MMM</code>,{' '}
          <code className={mono}>MMMM</code>, <code className={mono}>yy</code> and <code className={mono}>yyyy</code> are replaced and every other word is kept, so <code className={mono}>d de MMMM</code> needs no
          quotes. A number is given plain, <code className={mono}>1234.5</code>; commas and a dollar sign in it are left out.
        </p>
      </section>

      <section aria-labelledby="languages" className="mt-24">
        <SectionHead id="languages" badge="Locale" color="purple" title="In a language">
          Values are written in the language of the document, or in English when it says none; give a locale for another. The names of months and days, the order of a date, the separators of
          numbers and the rules of capitals follow it.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: locale }} />
        <ul className="m-0 mt-6 grid max-w-[760px] list-none gap-2.5 p-0 text-base leading-[1.6] text-ink-soft">
          <li>
            <strong className="text-ink">A currency of its own.</strong> <code className={mono}>{'{{price | currency: EUR}}'}</code> names its own, whatever is given to the call.
          </li>
          <li>
            <strong className="text-ink">The editor</strong> writes values in the language of the text: the one chosen at its foot, its <code className={mono}>language</code> prop, or the one the
            file says; else that of the interface with the browser’s region: <code className={mono}>editor.formatLocale</code>.
          </li>
          <li>
            <strong className="text-ink">The command line</strong> takes <code className={mono}>--locale</code> and <code className={mono}>--currency</code>, and an assistant’s{' '}
            <code className={mono}>fill_variables</code> takes <code className={mono}>locale</code> and <code className={mono}>currency</code>.
          </li>
          <li>
            <strong className="text-ink">The names of the formats</strong> the editor adds are in the language of its interface: <code className={mono}>{'{{price | currency}}'}</code> in English,{' '}
            <code className={mono}>{'{{price | moneda}}'}</code> in Spanish. Both are read, whichever a document has.
          </li>
        </ul>
      </section>

      <section aria-labelledby="in-the-editor" className="mt-24">
        <SectionHead id="in-the-editor" badge="The interface" color="blue" title="In the editor">
          Variables stand out from the text around them, in the headers, footers and notes too. The <strong>Variables</strong> tab of the side panel is for whoever fills the template, not whoever
          wrote it; <code className={mono}>handle.showPanel(&apos;variables&apos;)</code> opens it from your application.
        </SectionHead>
        <Cards rows={PANEL} colors={['blue', 'green', 'orange', 'purple', 'yellow', 'pink']} />
        <p className={prose}>
          For a form of your own in place of the panel,{' '}
          <a href="/docs/components/" className={LINK}>
            useDocsVariables
          </a>{' '}
          gives the names, their formats and uses, a preview of a value, and fill.
        </p>
        <h3 className={h3}>The Editor</h3>
        <Signatures rows={EDITOR} />
      </section>

      <section aria-labelledby="in-code" className="mt-24">
        <SectionHead id="in-code" badge="Core" color="pink" title="In code">
          With <code className={mono}>@rebodocs/core</code>, in the browser or on a server, without an editor.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: core }} />
        <Signatures rows={CORE} />
      </section>

      <section aria-labelledby="command-line" className="mt-24">
        <SectionHead id="command-line" badge="CLI" color="purple" title="From the command line">
          A template, a JSON file of values, and a DOCX, a PDF or Markdown out, by its extension. Nested values give dotted names: <code className={mono}>{'{ "client": { "name": "Ana" } }'}</code> fills{' '}
          <code className={mono}>{'{{client.name}}'}</code>.
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: cli }} />
        <p className={prose}>
          It warns of the variables left without a value and of the values a format cannot take. Every option is on the page{' '}
          <a href="/docs/server/#the-command-line-tool" className={LINK}>
            On a server
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="assistants" className="mt-24">
        <SectionHead id="assistants" badge="MCP" color="green" title="For an assistant">
          The{' '}
          <a href="/docs/assistants/" className={LINK}>
            MCP server
          </a>{' '}
          has a tool for each step, on a file or on the document open in an editor.
        </SectionHead>
        <Signatures rows={TOOLS} />
      </section>

      <section aria-labelledby="signatures" className="mt-24">
        <SectionHead id="signatures" badge="Signatures" color="yellow" title="Signatures">
          A block of signature lines side by side, at the caret: a title, a line and a name under each, in a table without borders. The receipt above has one.
        </SectionHead>
        <p className={prose}>
          In the editor, <strong>Signatures</strong> in the toolbar’s Insert menu or in the bar beside the caret; in code,{' '}
          <code className={mono}>{"editor.insertSignatures(['Landlord', 'Tenant'])"}</code>. Put variables in the names, <code className={mono}>{'{{tenant | upper}}'}</code>, and they fill with the rest. Not inside a
          table.
        </p>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge="Good to know" color="orange" title="What to know" />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>A value is one line: line breaks in it become spaces.</li>
          <li>
            <code className={mono}>today</code> is the day of the machine that fills: on a server, give <code className={mono}>{'{ today }'}</code> for the day of the person.
          </li>
          <li>A variable is plain text to Word: it can be found, replaced and spell-checked there like any other word.</li>
        </ul>
      </section>
    </>
  );
}
