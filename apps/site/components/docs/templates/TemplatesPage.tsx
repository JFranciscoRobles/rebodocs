import { type TemplateData, createDoc, docText, fillVariables, formatText, formatValue, paragraphText } from '@rebodocs/core';
import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { CAPTION, CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { ALIASES, BLOCK_KINDS, BLOCK_RULES, CORE, EDITOR, FORMAT_ROWS, FORMS, LINE, LOCALES, ORDER, PANEL, RULES, TOOLS } from './data';
import FormatsDemo from './FormatsDemo';
import { LazyEditorDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const h3 = 'm-0 mt-12 font-display text-xl font-bold tracking-[-0.01em]';

/** The line at the top of the page, filled by fillVariables when the site is built. */
const filledLine = ({ text, values, locale }: { text: string; values: TemplateData; locale: string }) =>
  paragraphText(fillVariables(createDoc([{ props: {}, runs: [{ text, props: {} }] }]), values, { locale }).paragraphs[0]);

/** The example of blocks, filled by fillVariables when the site is built. */
const filledOrder = ({ lines, data, locale }: { lines: string[]; data: TemplateData; locale: string }) =>
  docText(fillVariables(createDoc(lines.map((text) => ({ props: {}, runs: [{ text, props: {} }] }))), data, { locale })).split('\n');

function Signatures({ rows }: { rows: { sig: string; text: L }[] }) {
  const t = getT();
  return (
    <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
      {rows.map((m) => (
        <div key={m.sig} className="border-t border-[#f0eee9] py-3 first:border-t-0">
          <dt className="font-code text-[13.5px] font-semibold text-ink">{m.sig}</dt>
          <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{t(m.text)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Cards({ rows, colors }: { rows: { title: L; text: L }[]; colors: (keyof typeof PASTEL_CLASS)[] }) {
  const t = getT();
  return (
    <div className="mt-7 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
      {rows.map((card, i) => (
        <div key={card.title.en} className="rounded-2xl border border-border p-5">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[colors[i % colors.length]]}`}>{t(card.title)}</span>
          <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{t(card.text)}</p>
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
  const t = getT();
  const line = t(LINE);
  const filled = filledLine(line);
  const order = t(ORDER);
  const ordered = filledOrder(order);
  const [core, locale, cli, suggest, forms] = await Promise.all([
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
fillVariables(doc, values, { locale: 'zh-CN', currency: 'CNY' });  // 2026年10月13日 · ¥2,500.00
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
    highlight(
      `<DocsEditor
  docx={file}
  features={{
    variableSuggestions: {
      variables: [
        { name: 'client', title: 'Who signs' },
        { name: 'amount', example: '$1,200' },
      ],
    },
  }}
/>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `editor.setSelection(from, to);
editor.makeEditable();             // the selection, or an empty blank at the caret
editor.setRestricted(true);        // only the areas can change now
const docx = editor.exportDocx();  // and Word restricts it the same`,
      'ts',
      LIGHT_THEME,
    ),
  ]);

  const head = 'px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.04em] text-muted';
  const cell = 'border-t border-[#f0eee9] px-3 py-2.5 align-top';
  const strong = 'text-ink';
  const dot = t({ en: '.', es: '.', zh: '。' });

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {t({ en: 'Templates and variables', es: 'Plantillas y variables', zh: '模板与变量' })}
      </h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: (
            <>
              A variable is text between double braces, <code className={mono}>{'{{client}}'}</code>. That is all a template is, so any DOCX can be one and Word shows it as it is: write it in Word, in
              the editor, or both, and fill it in the editor, on a server or from the command line.
            </>
          ),
          es: (
            <>
              Una variable es texto entre llaves dobles, <code className={mono}>{'{{cliente}}'}</code>. Eso es todo lo que es una plantilla, así que cualquier DOCX puede serlo y Word la muestra tal
              cual: escríbela en Word, en el editor, o en ambos, y llénala en el editor, en un servidor o desde la línea de comandos.
            </>
          ),
          zh: (
            <>
              变量就是双花括号中的文字，例如 <code className={mono}>{'{{客户}}'}</code>。模板仅此而已，因此任何 DOCX 都可以是模板，Word 也会原样显示：你可以在 Word
              中、在编辑器中或两者结合编写模板，并在编辑器中、服务器上或命令行中填写。
            </>
          ),
        })}
      </p>
      <div className="mt-6 max-w-[760px] rounded-[10px] bg-surface px-5 py-4 text-[17px] leading-[1.7] text-ink">
        <p className="m-0">
          <Template text={line.text} />
        </p>
        <p className="m-0 mt-2 border-t border-border pt-2">{filled}</p>
      </div>
      <div className="mt-4">
        <HandTip>
          {t({
            en: 'tip: the second line is the first, filled by fillVariables when this page was built',
            es: 'tip: la segunda línea es la primera, llenada por fillVariables al construir esta página',
            zh: '提示：第二行就是第一行，由 fillVariables 在构建本页面时填写',
          })}
        </HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'Fill a template', es: 'Llena una plantilla', zh: '填写模板' })}>
          {t({
            en: 'A receipt with variables in its text, its header, a note at the foot of the page and its signatures. Type values in the panel and fill them, or have the page fill them as your application would, from a form.',
            es: 'Un recibo con variables en su texto, su encabezado, una nota al pie y sus firmas. Escribe valores en el panel y llénalas, o haz que la página las llene como lo haría tu aplicación, desde un formulario.',
            zh: '一张收据，正文、页眉、脚注和签名中都有变量。在面板中输入值并填写，或者像你的应用那样，让页面从表单中填写。',
          })}
        </SectionHead>
        <LazyEditorDemo />
        <p className={prose}>
          {t({
            en: (
              <>
                Undo brings the variables back in one step, and the panel keeps what was typed. Open the sliders of a variable to change how it is written: the change is made to the text of the
                variable, <code className={mono}>{'{{amount | currency}}'}</code>, so Word keeps it too.
              </>
            ),
            es: (
              <>
                Deshacer devuelve las variables en un solo paso, y el panel conserva lo escrito. Abre los deslizadores de una variable para cambiar cómo se escribe: el cambio se hace en el texto de la
                variable, <code className={mono}>{'{{importe | moneda}}'}</code>, así que Word también lo conserva.
              </>
            ),
            zh: (
              <>
                撤销一步即可恢复变量，面板会保留已输入的内容。点击变量的滑块图标可以修改它的写法：修改会直接写入变量文本，如 <code className={mono}>{'{{金额 | 货币}}'}</code>，因此 Word 也会保留。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="writing" className="mt-24">
        <SectionHead id="writing" badge={t({ en: 'Syntax', es: 'Sintaxis', zh: '语法' })} color="blue" title={t({ en: 'Writing a template', es: 'Escribir una plantilla', zh: '编写模板' })}>
          {t({
            en: 'A name between double braces, and after it, if it needs them, the formats its value is written in.',
            es: 'Un nombre entre llaves dobles, y después, si los necesita, los formatos en que se escribe su valor.',
            zh: '双花括号中写名称，如有需要，在名称后面写上值的格式。',
          })}
        </SectionHead>
        <Cards rows={RULES} colors={['blue', 'purple', 'yellow', 'green', 'pink', 'orange']} />
      </section>

      <section aria-labelledby="blocks" className="mt-24">
        <SectionHead id="blocks" badge={t({ en: 'Blocks', es: 'Bloques', zh: '区块' })} color="purple" title={t({ en: 'Lists and conditions', es: 'Listas y condiciones', zh: '列表与条件' })}>
          {t({
            en: (
              <>
                What is between <code className={mono}>{'{{#name}}'}</code> and <code className={mono}>{'{{/name}}'}</code> is written once for each item of a list, or kept only when the value is
                there. Plain text still: Word shows the marks as they are.
              </>
            ),
            es: (
              <>
                Lo que está entre <code className={mono}>{'{{#nombre}}'}</code> y <code className={mono}>{'{{/nombre}}'}</code> se escribe una vez por cada elemento de una lista, o se conserva solo
                cuando el valor está. Sigue siendo texto simple: Word muestra las marcas tal cual.
              </>
            ),
            zh: (
              <>
                <code className={mono}>{'{{#名称}}'}</code> 与 <code className={mono}>{'{{/名称}}'}</code> 之间的内容会为列表中的每一项写一次，或仅在有值时保留。它们仍是普通文字：Word
                会原样显示这些标记。
              </>
            ),
          })}
        </SectionHead>
        <div className="mt-7 grid max-w-[920px] gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border p-4">
            <p className={CAPTION}>{t({ en: 'The template', es: 'La plantilla', zh: '模板' })}</p>
            <div className="mt-2.5 grid gap-1 text-[14px] leading-[1.5] text-ink">
              {order.lines.map((text, i) => (
                <p key={i} className="m-0">
                  <Template text={text} />
                </p>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className={CAPTION}>{t({ en: 'The data', es: 'Los datos', zh: '数据' })}</p>
            <pre className="m-0 mt-2.5 overflow-x-auto font-code text-[12px] leading-[1.55] text-ink-soft">{JSON.stringify(order.data, null, 1)}</pre>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className={CAPTION}>{t({ en: 'What it makes', es: 'Lo que produce', zh: '生成结果' })}</p>
            <div className="mt-2.5 grid gap-1 text-[14px] leading-[1.5] text-ink">
              {ordered.map((text, i) => (
                <p key={i} className="m-0">
                  {text}
                </p>
              ))}
            </div>
          </div>
        </div>
        <h3 className={h3}>{t({ en: 'Where the marks are says what is repeated', es: 'Dónde están las marcas dice qué se repite', zh: '标记的位置决定重复的内容' })}</h3>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {BLOCK_KINDS.map((kind) => (
            <div key={kind.title.en} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[200px_1fr]">
              <dt className="text-[15px] font-semibold text-ink">{t(kind.title)}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">
                <span className="font-code text-[13px] text-muted">
                  {t(kind.where)}
                  {dot}
                </span>{' '}
                {t(kind.text)}
              </dd>
            </div>
          ))}
        </dl>
        <Cards rows={BLOCK_RULES} colors={['blue', 'green', 'yellow', 'orange']} />
        <p className={prose}>
          {t({
            en: 'The receipt above repeats a row for each line of what it pays for, and keeps a paragraph only while it is not paid. The same data fills it on a server, from the command line or through an assistant.',
            es: 'El recibo de arriba repite una fila por cada línea de lo que paga, y conserva un párrafo solo mientras no está pagado. Los mismos datos lo llenan en un servidor, desde la línea de comandos o a través de un asistente.',
            zh: '上面的收据为每一笔款项重复一行，并且只在未付款时保留某个段落。同样的数据也可以在服务器上、在命令行中或通过助手填写。',
          })}
        </p>
      </section>

      <section aria-labelledby="formats" className="mt-24">
        <SectionHead id="formats" badge={t({ en: 'Formats', es: 'Formatos', zh: '格式' })} color="orange" title={t({ en: 'Formats', es: 'Formatos', zh: '格式' })}>
          {t({
            en: 'What follows a bar says how the value is written. Type a variable and a value, and see each format applied in turn.',
            es: 'Lo que sigue a una barra dice cómo se escribe el valor. Escribe una variable y un valor, y mira cada formato aplicado por turno.',
            zh: '竖线后面的内容决定值的写法。输入一个变量和一个值，看看各个格式依次应用后的效果。',
          })}
        </SectionHead>
        <FormatsDemo />
        <div className="mt-8 max-w-[920px] overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr>
                <th className={head}>{t({ en: 'Format', es: 'Formato', zh: '格式' })}</th>
                <th className={head}>{t({ en: 'Value', es: 'Valor', zh: '值' })}</th>
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
                      <span className="block font-code text-[12px] text-muted">{formatText(row.id, row.arg ?? '', 'zh-CN')}</span>
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
          {t({
            en: 'Every format is read by its English name, its Spanish one and its Chinese one (under it, in grey), with or without accents, whatever the language of the document; also by ',
            es: 'Cada formato se lee por su nombre en inglés, en español y en chino (debajo, en gris), con o sin acentos, sea cual sea el idioma del documento; también por ',
            zh: '无论文档使用什么语言，每个格式都可以用英文名、西班牙文名或中文名（灰色显示在下方）书写，带不带重音符号均可；还可以用 ',
          })}
          {Object.values(ALIASES)
            .flat()
            .map((alias, i, all) => (
              <span key={alias}>
                <code className={mono}>{alias}</code>
                {i < all.length - 2 ? t({ en: ', ', es: ', ', zh: '、' }) : i === all.length - 2 ? t({ en: ' and ', es: ' y ', zh: ' 和 ' }) : ''}
              </span>
            ))}
          {t({
            en: (
              <>
                . <code className={mono}>italic</code> and <code className={mono}>underline</code> are written like <code className={mono}>bold</code>. Set from the panel, a letter case takes the
                place of another, and so does a type of data: a variable is a date or a number, in one letter case.
              </>
            ),
            es: (
              <>
                . <code className={mono}>italic</code> y <code className={mono}>underline</code> se escriben como <code className={mono}>bold</code>. Fijado desde el panel, un tipo de mayúsculas
                reemplaza a otro, y lo mismo un tipo de dato: una variable es una fecha o un número, con un solo tipo de mayúsculas.
              </>
            ),
            zh: (
              <>
                。<code className={mono}>italic</code> 和 <code className={mono}>underline</code> 的写法与 <code className={mono}>bold</code>{' '}
                相同。通过面板设置时，一种大小写会替换另一种，数据类型也是如此：变量要么是日期，要么是数字，并且只有一种大小写。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                A date is given as <code className={mono}>2026-10-13</code>, <code className={mono}>13/10/2026</code> (day first, or month first in a language that writes it so),{' '}
                <code className={mono}>2026年10月13日</code>, or <code className={mono}>today</code> / <code className={mono}>hoy</code> / <code className={mono}>今天</code>. In a pattern after{' '}
                <code className={mono}>date:</code>, <code className={mono}>d</code>, <code className={mono}>dd</code>, <code className={mono}>dddd</code> (the day of the week),{' '}
                <code className={mono}>M</code>, <code className={mono}>MM</code>, <code className={mono}>MMM</code>, <code className={mono}>MMMM</code>, <code className={mono}>yy</code> and{' '}
                <code className={mono}>yyyy</code> are replaced and every other word is kept, so <code className={mono}>d de MMMM</code> needs no quotes. A number is given plain,{' '}
                <code className={mono}>1234.5</code>; commas and a dollar sign in it are left out.
              </>
            ),
            es: (
              <>
                Una fecha se da como <code className={mono}>2026-10-13</code>, <code className={mono}>13/10/2026</code> (el día primero, o el mes primero en un idioma que la escribe así),{' '}
                <code className={mono}>2026年10月13日</code>, o <code className={mono}>today</code> / <code className={mono}>hoy</code> / <code className={mono}>今天</code>. En un patrón después de{' '}
                <code className={mono}>fecha:</code>, se reemplazan <code className={mono}>d</code>, <code className={mono}>dd</code>, <code className={mono}>dddd</code> (el día de la semana),{' '}
                <code className={mono}>M</code>, <code className={mono}>MM</code>, <code className={mono}>MMM</code>, <code className={mono}>MMMM</code>, <code className={mono}>yy</code> y{' '}
                <code className={mono}>yyyy</code>, y cualquier otra palabra se conserva, así que <code className={mono}>d de MMMM</code> no necesita comillas. Un número se da simple,{' '}
                <code className={mono}>1234.5</code>; las comas y el signo de pesos se ignoran.
              </>
            ),
            zh: (
              <>
                日期可以写成 <code className={mono}>2026-10-13</code>、<code className={mono}>13/10/2026</code>（日在前；在月份在前的语言中则月在前）、<code className={mono}>2026年10月13日</code>，或{' '}
                <code className={mono}>today</code> / <code className={mono}>hoy</code> / <code className={mono}>今天</code>。在 <code className={mono}>日期:</code> 之后的格式中，
                <code className={mono}>d</code>、<code className={mono}>dd</code>、<code className={mono}>dddd</code>（星期几）、<code className={mono}>M</code>、<code className={mono}>MM</code>、
                <code className={mono}>MMM</code>、<code className={mono}>MMMM</code>、<code className={mono}>yy</code> 和 <code className={mono}>yyyy</code> 会被替换，其他文字保持不变，因此{' '}
                <code className={mono}>yyyy年M月d日</code> 无需加引号。数字直接写成 <code className={mono}>1234.5</code>；其中的逗号和货币符号会被忽略。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="languages" className="mt-24">
        <SectionHead id="languages" badge="Locale" color="purple" title={t({ en: 'In a language', es: 'En un idioma', zh: '按语言' })}>
          {t({
            en: 'Values are written in the language of the document, or in English when it says none; give a locale for another. The names of months and days, the order of a date, the separators of numbers and the rules of capitals follow it.',
            es: 'Los valores se escriben en el idioma del documento, o en inglés cuando no dice ninguno; da un locale para otro. Los nombres de los meses y los días, el orden de una fecha, los separadores de los números y las reglas de las mayúsculas lo siguen.',
            zh: '值按文档的语言书写；文档未指定语言时使用英文；也可以传入 locale 指定其他语言。月份和星期的名称、日期的顺序、数字的分隔符以及大小写规则都随之变化。',
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: locale }} />
        <ul className="m-0 mt-6 grid max-w-[760px] list-none gap-2.5 p-0 text-base leading-[1.6] text-ink-soft">
          <li>
            {t({
              en: (
                <>
                  <strong className={strong}>A currency of its own.</strong> <code className={mono}>{'{{price | currency: EUR}}'}</code> names its own, whatever is given to the call.
                </>
              ),
              es: (
                <>
                  <strong className={strong}>Una moneda propia.</strong> <code className={mono}>{'{{precio | moneda: EUR}}'}</code> nombra la suya, sea cual sea la que se dé a la llamada.
                </>
              ),
              zh: (
                <>
                  <strong className={strong}>指定货币。</strong>
                  <code className={mono}>{'{{价格 | 货币: CNY}}'}</code> 会使用自己指定的货币，无论调用时传入什么。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: (
                <>
                  <strong className={strong}>The editor</strong> writes values in the language of the text: the one chosen at its foot, its <code className={mono}>language</code> prop, or the one the
                  file says; else that of the interface with the browser’s region: <code className={mono}>editor.formatLocale</code>.
                </>
              ),
              es: (
                <>
                  <strong className={strong}>El editor</strong> escribe los valores en el idioma del texto: el elegido a su pie, su prop <code className={mono}>language</code>, o el que dice el
                  archivo; si no, el de la interfaz con la región del navegador: <code className={mono}>editor.formatLocale</code>.
                </>
              ),
              zh: (
                <>
                  <strong className={strong}>编辑器</strong>按文本语言书写值：即在其底部选择的语言、<code className={mono}>language</code> 属性或文件中声明的语言；否则为界面语言加上浏览器的地区：
                  <code className={mono}>editor.formatLocale</code>。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: (
                <>
                  <strong className={strong}>The command line</strong> takes <code className={mono}>--locale</code> and <code className={mono}>--currency</code>, and an assistant’s{' '}
                  <code className={mono}>fill_variables</code> takes <code className={mono}>locale</code> and <code className={mono}>currency</code>.
                </>
              ),
              es: (
                <>
                  <strong className={strong}>La línea de comandos</strong> acepta <code className={mono}>--locale</code> y <code className={mono}>--currency</code>, y el{' '}
                  <code className={mono}>fill_variables</code> de un asistente acepta <code className={mono}>locale</code> y <code className={mono}>currency</code>.
                </>
              ),
              zh: (
                <>
                  <strong className={strong}>命令行</strong>支持 <code className={mono}>--locale</code> 和 <code className={mono}>--currency</code>，助手的 <code className={mono}>fill_variables</code>{' '}
                  支持 <code className={mono}>locale</code> 和 <code className={mono}>currency</code>。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: (
                <>
                  <strong className={strong}>The names of the formats</strong> the editor adds are in the language of its interface: <code className={mono}>{'{{price | currency}}'}</code> in English,{' '}
                  <code className={mono}>{'{{price | moneda}}'}</code> in Spanish, <code className={mono}>{'{{price | 货币}}'}</code> in Chinese. All are read, whichever a document has.
                </>
              ),
              es: (
                <>
                  <strong className={strong}>Los nombres de los formatos</strong> que agrega el editor están en el idioma de su interfaz: <code className={mono}>{'{{precio | currency}}'}</code> en
                  inglés, <code className={mono}>{'{{precio | moneda}}'}</code> en español, <code className={mono}>{'{{precio | 货币}}'}</code> en chino. Todos se leen, tenga el que tenga un
                  documento.
                </>
              ),
              zh: (
                <>
                  <strong className={strong}>编辑器添加的格式名称</strong>使用界面语言：英文界面为 <code className={mono}>{'{{价格 | currency}}'}</code>，西班牙文界面为{' '}
                  <code className={mono}>{'{{价格 | moneda}}'}</code>，中文界面为 <code className={mono}>{'{{价格 | 货币}}'}</code>。无论文档中用的是哪一种，都能被识别。
                </>
              ),
            })}
          </li>
        </ul>
      </section>

      <section aria-labelledby="in-the-editor" className="mt-24">
        <SectionHead id="in-the-editor" badge={t({ en: 'The interface', es: 'La interfaz', zh: '界面' })} color="blue" title={t({ en: 'In the editor', es: 'En el editor', zh: '在编辑器中' })}>
          {t({
            en: (
              <>
                Variables stand out from the text around them, in the headers, footers and notes too. The <strong>Variables</strong> tab of the side panel is for whoever fills the template, not
                whoever wrote it; <code className={mono}>handle.showPanel(&apos;variables&apos;)</code> opens it from your application.
              </>
            ),
            es: (
              <>
                Las variables resaltan del texto que las rodea, también en los encabezados, pies y notas. La pestaña <strong>Variables</strong> del panel lateral es para quien llena la plantilla, no
                para quien la escribió; <code className={mono}>handle.showPanel(&apos;variables&apos;)</code> la abre desde tu aplicación.
              </>
            ),
            zh: (
              <>
                变量会在周围文字中突出显示，页眉、页脚和注释中也是如此。侧边栏的<strong>变量</strong>标签页是给填写模板的人用的，而不是给编写模板的人；
                <code className={mono}>handle.showPanel(&apos;variables&apos;)</code> 可以从你的应用中打开它。
              </>
            ),
          })}
        </SectionHead>
        <Cards rows={PANEL} colors={['blue', 'green', 'orange', 'purple', 'yellow', 'pink']} />
        <p className={prose}>
          {t({ en: 'For a form of your own in place of the panel, ', es: 'Para un formulario propio en lugar del panel, ', zh: '如果要用你自己的表单代替面板，' })}
          <LocalLink href="/docs/components/" className={LINK}>
            useDocsVariables
          </LocalLink>
          {t({
            en: ' gives the names, their formats and uses, a preview of a value, and fill.',
            es: ' da los nombres, sus formatos y usos, una vista previa de un valor, y fill.',
            zh: ' 提供变量名称、格式和使用情况、值的预览，以及 fill。',
          })}
        </p>
        <h3 className={h3}>{t({ en: 'Typing “{{”', es: 'Escribir “{{”', zh: '输入 “{{”' })}</h3>
        <p className={prose}>
          {t({
            en: (
              <>
                Two braces bring up a list of the variables: those your application says it fills first, with what each is or a value it may have, then those the document already uses. What is typed
                after the braces narrows it, by any word of a name (<code className={mono}>cli</code> finds <code className={mono}>client_name</code>); Enter or Tab writes the one chosen whole, so a
                name is not mistyped and left unfilled. A name that is in neither is offered as a new variable. A closing brace, a <code className={mono}>#</code> or a <code className={mono}>|</code>{' '}
                leaves it, for a block or a format written by hand.
              </>
            ),
            es: (
              <>
                Dos llaves abren una lista de las variables: primero las que tu aplicación dice que llena, con lo que es cada una o un valor que puede tener, luego las que ya usa el documento. Lo que
                se escribe después de las llaves la acota, por cualquier palabra de un nombre (<code className={mono}>cli</code> encuentra <code className={mono}>client_name</code>); Enter o Tab
                escribe completa la elegida, así que un nombre no se escribe mal y se queda sin llenar. Un nombre que no está en ninguna se ofrece como variable nueva. Una llave de cierre, un{' '}
                <code className={mono}>#</code> o una <code className={mono}>|</code> la cierran, para un bloque o un formato escrito a mano.
              </>
            ),
            zh: (
              <>
                输入两个花括号会弹出变量列表：先是你的应用会填写的变量（附带说明或示例值），然后是文档中已有的变量。在花括号后继续输入可按名称中的任意单词筛选（输入 <code className={mono}>cli</code>{' '}
                可找到 <code className={mono}>client_name</code>）；按 Enter 或 Tab 会完整写入选中的变量，避免名称拼错而无法填写。两者中都没有的名称会作为新变量提供。输入右花括号、
                <code className={mono}>#</code> 或 <code className={mono}>|</code> 会关闭列表，便于手写区块或格式。
              </>
            ),
          })}
        </p>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: suggest }} />
        <p className={prose}>
          {t({
            en: (
              <>
                It is on in <code className={mono}>DocsEditor</code> unless <code className={mono}>variableSuggestions: false</code>; <code className={mono}>fromDocument: false</code> leaves out the
                names of the document, <code className={mono}>allowNew: false</code> the new one, and <code className={mono}>variables</code> may be a function, asked each time the list opens.
                Headless it is the <code className={mono}>variableSuggestions</code> option of <code className={mono}>DocsProvider</code>, off unless given; without React,{' '}
                <code className={mono}>{'createVariableSuggest(editor, { variables })'}</code>.
              </>
            ),
            es: (
              <>
                Está encendido en <code className={mono}>DocsEditor</code> salvo con <code className={mono}>variableSuggestions: false</code>; <code className={mono}>fromDocument: false</code> deja
                fuera los nombres del documento, <code className={mono}>allowNew: false</code> el nuevo, y <code className={mono}>variables</code> puede ser una función, que se consulta cada vez que
                se abre la lista. En headless es la opción <code className={mono}>variableSuggestions</code> de <code className={mono}>DocsProvider</code>, apagada salvo que se dé; sin React,{' '}
                <code className={mono}>{'createVariableSuggest(editor, { variables })'}</code>.
              </>
            ),
            zh: (
              <>
                在 <code className={mono}>DocsEditor</code> 中默认开启，设置 <code className={mono}>variableSuggestions: false</code> 可关闭；<code className={mono}>fromDocument: false</code>{' '}
                不列出文档中的变量，<code className={mono}>allowNew: false</code> 不提供新变量，<code className={mono}>variables</code> 也可以是函数，每次打开列表时调用。在 headless 模式下，它是{' '}
                <code className={mono}>DocsProvider</code> 的 <code className={mono}>variableSuggestions</code> 选项，默认关闭；不用 React 时使用{' '}
                <code className={mono}>{'createVariableSuggest(editor, { variables })'}</code>。
              </>
            ),
          })}
        </p>
        <h3 className={h3}>{t({ en: 'The Editor', es: 'El Editor', zh: 'Editor' })}</h3>
        <Signatures rows={EDITOR} />
      </section>

      <section aria-labelledby="in-code" className="mt-24">
        <SectionHead id="in-code" badge="Core" color="pink" title={t({ en: 'In code', es: 'En código', zh: '在代码中' })}>
          {t({
            en: (
              <>
                With <code className={mono}>@rebodocs/core</code>, in the browser or on a server, without an editor.
              </>
            ),
            es: (
              <>
                Con <code className={mono}>@rebodocs/core</code>, en el navegador o en un servidor, sin editor.
              </>
            ),
            zh: (
              <>
                使用 <code className={mono}>@rebodocs/core</code>，在浏览器或服务器上，无需编辑器。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: core }} />
        <Signatures rows={CORE} />
      </section>

      <section aria-labelledby="command-line" className="mt-24">
        <SectionHead id="command-line" badge="CLI" color="purple" title={t({ en: 'From the command line', es: 'Desde la línea de comandos', zh: '在命令行中' })}>
          {t({
            en: (
              <>
                A template, a JSON file of values, and a DOCX, a PDF or Markdown out, by its extension. Nested values give dotted names:{' '}
                <code className={mono}>{'{ "client": { "name": "Ana" } }'}</code> fills <code className={mono}>{'{{client.name}}'}</code>.
              </>
            ),
            es: (
              <>
                Una plantilla, un archivo JSON de valores, y sale un DOCX, un PDF o Markdown, según su extensión. Los valores anidados dan nombres con puntos:{' '}
                <code className={mono}>{'{ "cliente": { "nombre": "Ana" } }'}</code> llena <code className={mono}>{'{{cliente.nombre}}'}</code>.
              </>
            ),
            zh: (
              <>
                输入一个模板和一个存放值的 JSON 文件，按输出文件的扩展名生成 DOCX、PDF 或 Markdown。嵌套的值对应带点的名称：<code className={mono}>{'{ "客户": { "姓名": "王芳" } }'}</code> 会填写{' '}
                <code className={mono}>{'{{客户.姓名}}'}</code>。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: cli }} />
        <p className={prose}>
          {t({
            en: 'It warns of the variables left without a value and of the values a format cannot take. Every option is on the page ',
            es: 'Avisa de las variables que quedan sin valor y de los valores que un formato no puede tomar. Cada opción está en la página ',
            zh: '它会提醒哪些变量没有值、哪些值无法按格式书写。全部选项见',
          })}
          <LocalLink href="/docs/server/#the-command-line-tool" className={LINK}>
            {t({ en: 'On a server', es: 'En un servidor', zh: '在服务器上' })}
          </LocalLink>
          {dot}
        </p>
      </section>

      <section aria-labelledby="assistants" className="mt-24">
        <SectionHead id="assistants" badge="MCP" color="green" title={t({ en: 'For an assistant', es: 'Para un asistente', zh: '供助手使用' })}>
          {t({ en: 'The ', es: 'El ', zh: '' })}
          <LocalLink href="/docs/assistants/" className={LINK}>
            {t({ en: 'MCP server', es: 'servidor MCP', zh: 'MCP 服务器' })}
          </LocalLink>
          {t({
            en: ' has a tool for each step, on a file or on the document open in an editor.',
            es: ' tiene una herramienta para cada paso, sobre un archivo o sobre el documento abierto en un editor.',
            zh: '为每个步骤都提供了工具，可作用于文件，也可作用于编辑器中打开的文档。',
          })}
        </SectionHead>
        <Signatures rows={TOOLS} />
      </section>

      <section aria-labelledby="areas-to-fill-in" className="mt-24">
        <SectionHead id="areas-to-fill-in" badge="Forms" color="green" title={t({ en: 'Areas to fill in', es: 'Áreas para llenar', zh: '待填区域' })}>
          {t({
            en: 'A document restricted to some areas: whoever has it can change those and nothing else, as Word’s Restrict editing with exceptions for everyone. A template sent to be filled in, with its clauses as they were written.',
            es: 'Un documento restringido a algunas áreas: quien lo tiene puede cambiar esas y nada más, como la Restricción de edición de Word con excepciones para todos. Una plantilla enviada para llenarse, con sus cláusulas tal como se escribieron.',
            zh: '把文档限制为只能编辑某些区域：拿到文档的人只能修改这些区域，与 Word 的“限制编辑”并为所有人设置例外相同。适合把模板发给他人填写，同时保持条款原样不变。',
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: 'Outside the areas the document is read, copied and noted on; a change there is not made, the areas flash, and a screen reader is told why. Tab and Shift+Tab go from one area to the next, selecting what it holds. An area may be empty, a blank shown as a small box. The areas are shaded on the page, more strongly while the document is restricted.',
            es: 'Fuera de las áreas, el documento se lee, se copia y se anota; un cambio ahí no se hace, las áreas destellan, y se le dice a un lector de pantalla por qué. Tab y Shift+Tab van de un área a la siguiente, seleccionando lo que contiene. Un área puede estar vacía, un espacio mostrado como una cajita. Las áreas se sombrean en la página, con más fuerza mientras el documento está restringido.',
            zh: '在区域之外，文档可以阅读、复制和添加批注；修改不会生效，区域会闪烁提示，屏幕阅读器也会被告知原因。Tab 和 Shift+Tab 在区域之间切换并选中其内容。区域可以为空，空白处显示为一个小方框。区域在页面上带有底纹，文档受限时颜色更深。',
          })}
        </p>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: forms }} />
        <p className={prose}>
          {t({
            en: (
              <>
                In the file the areas are the marks Word writes (<code className={mono}>w:permStart</code> and <code className={mono}>w:permEnd</code> for everyone), and the restriction is{' '}
                <code className={mono}>w:documentProtection w:edit=&quot;readOnly&quot;</code> without a password: Word lets only the areas be changed, and its Restrict editing pane can stop it. A
                Word file restricted this way opens restricted here.
              </>
            ),
            es: (
              <>
                En el archivo, las áreas son las marcas que escribe Word (<code className={mono}>w:permStart</code> y <code className={mono}>w:permEnd</code> para todos), y la restricción es{' '}
                <code className={mono}>w:documentProtection w:edit=&quot;readOnly&quot;</code> sin contraseña: Word deja cambiar solo las áreas, y su panel Restringir edición puede quitarla. Un
                archivo de Word restringido así se abre restringido aquí.
              </>
            ),
            zh: (
              <>
                在文件中，区域就是 Word 写入的标记（面向所有人的 <code className={mono}>w:permStart</code> 和 <code className={mono}>w:permEnd</code>），限制则是不带密码的{' '}
                <code className={mono}>w:documentProtection w:edit=&quot;readOnly&quot;</code>：Word 只允许修改这些区域，其“限制编辑”窗格可以解除限制。以这种方式受限的 Word
                文件在这里打开时也是受限的。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                With <code className={mono}>features.forms</code> the interface marks them: <strong>Mark the selection as editable</strong>, <strong>Remove editable area</strong> and{' '}
                <strong>Restrict editing</strong> in the Review menu, <strong>Editable</strong> in the bar beside a selection, and <strong>Editable area</strong> in the “/” menu. It is off unless
                true, so that whoever is sent a restricted document cannot open it again; the restriction holds without it, and your code decides. Headless it is the{' '}
                <code className={mono}>forms</code> option, and <code className={mono}>state.restricted</code> and <code className={mono}>state.activeEditable</code> say where things stand.
              </>
            ),
            es: (
              <>
                Con <code className={mono}>features.forms</code> la interfaz las marca: <strong>Marcar la selección como editable</strong>, <strong>Quitar área editable</strong> y{' '}
                <strong>Restringir la edición</strong> en el menú Revisar, <strong>Editable</strong> en la barra junto a una selección, y <strong>Área editable</strong> en el menú “/”. Está apagado
                salvo con true, para que quien recibe un documento restringido no pueda volver a abrirlo; la restricción se mantiene sin esto, y tu código decide. En headless es la opción{' '}
                <code className={mono}>forms</code>, y <code className={mono}>state.restricted</code> y <code className={mono}>state.activeEditable</code> dicen cómo están las cosas.
              </>
            ),
            zh: (
              <>
                开启 <code className={mono}>features.forms</code> 后，界面会提供标记功能：“审阅”菜单中的<strong>将所选内容标记为可编辑</strong>、<strong>删除可编辑区域</strong>和
                <strong>仅允许编辑可编辑区域</strong>，选区工具条中的<strong>可编辑</strong>，以及 “/” 菜单中的<strong>可编辑区域</strong>。默认关闭（需设为
                true），这样收到受限文档的人无法解除限制；即使不开启，限制依然有效，由你的代码决定。在 headless 模式下它是 <code className={mono}>forms</code> 选项，
                <code className={mono}>state.restricted</code> 和 <code className={mono}>state.activeEditable</code> 反映当前状态。
              </>
            ),
          })}
        </p>
        <Signatures rows={FORMS} />
        <p className={prose}>
          {t({
            en: (
              <>
                A restricted document refuses your code too: open it with <code className={mono}>setRestricted(false)</code> before filling its variables outside the areas, and restrict it again
                after. Each person in a shared room has it restricted in their own copy, so a change made by someone with it open still comes in.
              </>
            ),
            es: (
              <>
                Un documento restringido también rechaza a tu código: ábrelo con <code className={mono}>setRestricted(false)</code> antes de llenar sus variables fuera de las áreas, y restríngelo de
                nuevo después. Cada persona en una sala compartida lo tiene restringido en su propia copia, así que un cambio hecho por alguien que lo tiene abierto igual llega.
              </>
            ),
            zh: (
              <>
                受限文档也会拒绝你代码的修改：在填写区域外的变量之前，先用 <code className={mono}>setRestricted(false)</code>{' '}
                解除限制，填写后再重新限制。共享房间中每个人的副本各自受限，因此已解除限制的人所做的修改依然会同步给其他人。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="signatures" className="mt-24">
        <SectionHead id="signatures" badge={t({ en: 'Signatures', es: 'Firmas', zh: '签名' })} color="yellow" title={t({ en: 'Signatures', es: 'Firmas', zh: '签名' })}>
          {t({
            en: 'A block of signature lines side by side, at the caret: a title, a line and a name under each, in a table without borders. The receipt above has one.',
            es: 'Un bloque de líneas de firma lado a lado, en el cursor: un título, una línea y un nombre debajo de cada una, en una tabla sin bordes. El recibo de arriba tiene uno.',
            zh: '在光标处插入并排的签名栏：每栏包含标题、签名线及其下方的姓名，放在一张无边框的表格中。上面的收据就有一个。',
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: (
              <>
                In the editor, <strong>Signatures</strong> in the toolbar’s Insert menu or in the bar beside the caret; in code,{' '}
                <code className={mono}>{"editor.insertSignatures(['Landlord', 'Tenant'])"}</code>. Put variables in the names, <code className={mono}>{'{{tenant | upper}}'}</code>, and they fill with
                the rest. Not inside a table.
              </>
            ),
            es: (
              <>
                En el editor, <strong>Firmas</strong> en el menú Insertar de la barra de herramientas o en la barra junto al cursor; en código,{' '}
                <code className={mono}>{"editor.insertSignatures(['Arrendador', 'Arrendatario'])"}</code>. Pon variables en los nombres, <code className={mono}>{'{{arrendatario | mayúsculas}}'}</code>
                , y se llenan con lo demás. No dentro de una tabla.
              </>
            ),
            zh: (
              <>
                在编辑器中，使用工具栏“插入”菜单或光标旁工具条中的<strong>签名</strong>；在代码中使用 <code className={mono}>{"editor.insertSignatures(['出租方', '承租方'])"}</code>
                。在姓名中放入变量，如 <code className={mono}>{'{{承租方}}'}</code>，即可与其他变量一起填写。不能插入到表格中。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge={t({ en: 'Good to know', es: 'Bueno saber', zh: '小贴士' })} color="orange" title={t({ en: 'What to know', es: 'Qué saber', zh: '须知' })} />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>
            {t({
              en: 'A value is one line: line breaks in it become spaces.',
              es: 'Un valor es una línea: los saltos de línea en él se vuelven espacios.',
              zh: '值只能是一行：其中的换行会变成空格。',
            })}
          </li>
          <li>
            {t({
              en: (
                <>
                  <code className={mono}>today</code> is the day of the machine that fills: on a server, give <code className={mono}>{'{ today }'}</code> for the day of the person.
                </>
              ),
              es: (
                <>
                  <code className={mono}>hoy</code> es el día de la máquina que llena: en un servidor, da <code className={mono}>{'{ today }'}</code> para el día de la persona.
                </>
              ),
              zh: (
                <>
                  <code className={mono}>今天</code> 指执行填写的机器上的日期：在服务器上，请传入 <code className={mono}>{'{ today }'}</code> 以使用用户所在的日期。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: 'A variable is plain text to Word: it can be found, replaced and spell-checked there like any other word.',
              es: 'Una variable es texto simple para Word: ahí se puede buscar, reemplazar y revisar su ortografía como cualquier otra palabra.',
              zh: '在 Word 看来，变量就是普通文字：可以像其他文字一样查找、替换和检查拼写。',
            })}
          </li>
        </ul>
      </section>
    </>
  );
}
