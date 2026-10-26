import type { ReactNode } from 'react';
import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { InstallCommand } from '../InstallCommand';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { CALLS, CATALOG, CLI, PDF_FACTS, PDF_HAS, PDF_HAS_NOT, RUNTIMES, SPEED } from './data';
import { LazyRenderDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const h3 = 'm-0 mt-12 font-display text-xl font-bold tracking-[-0.01em]';
const COLORS = ['blue', 'purple', 'yellow', 'green', 'pink', 'orange'] as const;

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
  const t = getT();
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
  const dot = t({ en: '.', es: '.', zh: '。' });
  const link = (href: string, text: L) => (
    <LocalLink href={href} className={LINK}>
      {t(text)}
    </LocalLink>
  );
  const steps: L<ReactNode>[] = [
    {
      en: <>Keep the templates as DOCX in your storage, and the fonts they use beside your code.</>,
      es: <>Guarda las plantillas como DOCX en tu almacenamiento, y las fuentes que usan junto a tu código.</>,
      zh: <>把模板作为 DOCX 存放在你的存储中，把它们用到的字体放在代码旁边。</>,
    },
    {
      en: (
        <>
          To make one: <code className={mono}>importDocx</code> → <code className={mono}>fillVariables</code> → <code className={mono}>exportDocx</code>, or <code className={mono}>renderPdf</code>,
          and store the result.
        </>
      ),
      es: (
        <>
          Para hacer uno: <code className={mono}>importDocx</code> → <code className={mono}>fillVariables</code> → <code className={mono}>exportDocx</code>, o <code className={mono}>renderPdf</code>,
          y guarda el resultado.
        </>
      ),
      zh: (
        <>
          生成文档：<code className={mono}>importDocx</code> → <code className={mono}>fillVariables</code> → <code className={mono}>exportDocx</code> 或 <code className={mono}>renderPdf</code>
          ，然后保存结果。
        </>
      ),
    },
    {
      en: (
        <>
          To edit it: give the stored DOCX to the {link('/docs/react/', { en: 'React component', es: 'componente de React', zh: 'React 组件' })} and store what <code className={mono}>onSave</code>{' '}
          hands back. {link('/docs/storage/', { en: 'Documents in an S3 bucket', es: 'Documentos en un bucket S3', zh: 'S3 存储桶中的文档' })} does it, with a demo to run.
        </>
      ),
      es: (
        <>
          Para editarlo: dale el DOCX guardado al {link('/docs/react/', { en: 'React component', es: 'componente de React', zh: 'React 组件' })} y guarda lo que devuelve{' '}
          <code className={mono}>onSave</code>. {link('/docs/storage/', { en: 'Documents in an S3 bucket', es: 'Documentos en un bucket S3', zh: 'S3 存储桶中的文档' })} lo hace, con una demo para
          correr.
        </>
      ),
      zh: (
        <>
          编辑文档：把保存的 DOCX 交给 {link('/docs/react/', { en: 'React component', es: 'componente de React', zh: 'React 组件' })}，并保存 <code className={mono}>onSave</code> 返回的内容。
          {link('/docs/storage/', { en: 'Documents in an S3 bucket', es: 'Documentos en un bucket S3', zh: 'S3 存储桶中的文档' })}一页演示了完整流程，并附有可运行的演示。
        </>
      ),
    },
    {
      en: <>For several people at once, see {link('/docs/collaboration/', { en: 'collaboration', es: 'colaboración', zh: '协作' })}.</>,
      es: <>Para varias personas a la vez, ve {link('/docs/collaboration/', { en: 'collaboration', es: 'colaboración', zh: '协作' })}.</>,
      zh: <>多人同时编辑请参见{link('/docs/collaboration/', { en: 'collaboration', es: 'colaboración', zh: '协作' })}。</>,
    },
  ];

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {t({ en: 'On a server: DOCX and PDF', es: 'En un servidor: DOCX y PDF', zh: '在服务器上：DOCX 与 PDF' })}
      </h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        <a href="https://www.npmjs.com/package/@rebodocs/core" className={LINK}>
          @rebodocs/core
        </a>{' '}
        {t({
          en: 'has no DOM and uses no API of Node. The code that lays a document out in the browser runs on your server, so a document made there breaks its lines and pages where the editor would, given the same fonts.',
          es: 'no tiene DOM y no usa ninguna API de Node. El código que maqueta un documento en el navegador corre en tu servidor, así que un documento hecho ahí corta sus líneas y páginas donde lo haría el editor, con las mismas fuentes.',
          zh: '不依赖 DOM，也不使用任何 Node API。在浏览器中排版文档的代码同样运行在你的服务器上，因此只要字体相同，服务器生成的文档断行和分页与编辑器完全一致。',
        })}
      </p>
      <div className="mt-5">
        <InstallCommand command="npm install @rebodocs/core" />
      </div>
      <div className="mt-4">
        <HandTip>
          {t({
            en: 'tip: change the data below, add a line, set paid to true, and the PDF is made again',
            es: 'tip: cambia los datos de abajo, agrega una línea, pon paid en true, y el PDF se vuelve a hacer',
            zh: '提示：修改下方的数据、添加一行或把 paid 设为 true，PDF 都会重新生成',
          })}
        </HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead
          id="try"
          badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })}
          color="green"
          title={t({ en: 'A template, filled and rendered', es: 'Una plantilla, llenada y convertida', zh: '填写并渲染模板' })}
        >
          {t({
            en: (
              <>
                What a server does, run in this page with the same calls: the template filled with the JSON, its row repeated for each line, laid out with font files read by{' '}
                <code className={mono}>readFont</code>, and drawn as a PDF. No browser API takes part in it.
              </>
            ),
            es: (
              <>
                Lo que hace un servidor, corrido en esta página con las mismas llamadas: la plantilla llenada con el JSON, su fila repetida por cada línea, maquetada con archivos de fuentes leídos por{' '}
                <code className={mono}>readFont</code>, y dibujada como PDF. Ninguna API del navegador interviene.
              </>
            ),
            zh: (
              <>
                在本页面中用相同的调用运行服务器所做的事：用 JSON 填写模板，为每条明细重复一行，用 <code className={mono}>readFont</code> 读取的字体文件排版，并绘制为 PDF。整个过程不涉及任何浏览器
                API。
              </>
            ),
          })}
        </SectionHead>
        <LazyRenderDemo />
        <p className={prose}>
          {t({
            en: (
              <>
                Have the template ask for Arial, which the page does not give: <code className={mono}>missingFonts</code> says so, and the text is set in the font it has. Give the Arial of your
                machine, and it is set in Arial. The fonts decide where lines and pages break, so the pages a server makes are those of the editor when both have the same ones.
              </>
            ),
            es: (
              <>
                Haz que la plantilla pida Arial, que la página no da: <code className={mono}>missingFonts</code> lo dice, y el texto se compone con la fuente que tiene. Da el Arial de tu máquina, y se
                compone en Arial. Las fuentes deciden dónde se cortan las líneas y las páginas, así que las páginas que hace un servidor son las del editor cuando ambos tienen las mismas.
              </>
            ),
            zh: (
              <>
                让模板使用页面没有提供的 Arial：<code className={mono}>missingFonts</code> 会报告这一点，文字则用现有字体排版。提供你电脑上的 Arial 后，文字就会用 Arial
                排版。字体决定了断行和分页的位置，因此只要字体相同，服务器生成的页面就与编辑器一致。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="where" className="mt-24">
        <SectionHead id="where" badge={t({ en: 'Runtimes', es: 'Entornos', zh: '运行环境' })} color="purple" title={t({ en: 'Where it runs', es: 'Dónde corre', zh: '运行环境' })}>
          {t({
            en: (
              <>
                Wherever JavaScript does: the package needs the language and <code className={mono}>Intl</code>, and takes files as bytes, <code className={mono}>Uint8Array</code>, whatever read them.
              </>
            ),
            es: (
              <>
                Donde corra JavaScript: el paquete necesita el lenguaje e <code className={mono}>Intl</code>, y recibe los archivos como bytes, <code className={mono}>Uint8Array</code>, los haya leído
                quien los haya leído.
              </>
            ),
            zh: (
              <>
                只要能运行 JavaScript 就行：该软件包只需要语言本身和 <code className={mono}>Intl</code>，文件以字节（<code className={mono}>Uint8Array</code>）形式传入，无论用什么方式读取。
              </>
            ),
          })}
        </SectionHead>
        <div className="mt-7 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-3">
          {RUNTIMES.map((one, i) => (
            <div key={one.title.en} className="rounded-2xl border border-border p-4">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i]]}`}>{t(one.title)}</span>
              <p className="m-0 mt-2.5 text-[14px] leading-[1.55] text-ink-soft">{t(one.text)}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="route" className="mt-24">
        <SectionHead
          id="route"
          badge={t({ en: 'Recipe', es: 'Receta', zh: '示例' })}
          color="orange"
          title={t({ en: 'A route that makes a PDF', es: 'Una ruta que hace un PDF', zh: '生成 PDF 的路由' })}
        >
          {t({
            en: 'The data comes in as JSON, the document goes out as a PDF, or as a DOCX to be edited. The template and the fonts are read once.',
            es: 'Los datos entran como JSON, el documento sale como PDF, o como DOCX para editarse. La plantilla y las fuentes se leen una vez.',
            zh: '数据以 JSON 传入，文档以 PDF 或可编辑的 DOCX 输出。模板和字体只读取一次。',
          })}
        </SectionHead>
        <Code html={express} />
        <Code html={route} />
        <p className={prose}>
          {t({
            en: (
              <>
                The data is the JSON your application already has: nested objects fill <code className={mono}>{'{{client.name}}'}</code>, a list repeats a block, true or false keeps one or takes it
                out. How to write them is on the page{' '}
              </>
            ),
            es: (
              <>
                Los datos son el JSON que tu aplicación ya tiene: los objetos anidados llenan <code className={mono}>{'{{cliente.nombre}}'}</code>, una lista repite un bloque, true o false conserva
                uno o lo quita. Cómo escribirlos está en la página{' '}
              </>
            ),
            zh: (
              <>
                数据就是你的应用已有的 JSON：嵌套对象用于填写 <code className={mono}>{'{{客户.姓名}}'}</code>，列表用于重复区块，true 或 false 决定保留或移除区块。具体写法见
              </>
            ),
          })}
          {link('/docs/templates/#blocks', { en: 'Templates and variables', es: 'Plantillas y variables', zh: '模板与变量' })}
          {dot}
        </p>
      </section>

      <section aria-labelledby="open-change-save" className="mt-24">
        <SectionHead id="open-change-save" badge="DOCX" color="blue" title={t({ en: 'Open, change, save', es: 'Abrir, cambiar, guardar', zh: '打开、修改、保存' })}>
          {t({
            en: (
              <>
                A <code className={mono}>Doc</code> is an immutable value: every operation returns a new one and leaves the old one as it was. A position is{' '}
                <code className={mono}>{'{ para, offset }'}</code>, the paragraph and the character in it.
              </>
            ),
            es: (
              <>
                Un <code className={mono}>Doc</code> es un valor inmutable: cada operación devuelve uno nuevo y deja el viejo como estaba. Una posición es{' '}
                <code className={mono}>{'{ para, offset }'}</code>, el párrafo y el carácter dentro de él.
              </>
            ),
            zh: (
              <>
                <code className={mono}>Doc</code> 是不可变的值：每次操作都返回一个新的 Doc，原来的保持不变。位置用 <code className={mono}>{'{ para, offset }'}</code> 表示，即段落及其中的字符位置。
              </>
            ),
          })}
        </SectionHead>
        <Code html={basic} />
        <Signatures rows={CALLS} />
        <h3 id="finding" className={`${h3} scroll-mt-24`}>
          {t({ en: 'Finding where to edit', es: 'Encontrar dónde editar', zh: '找到要编辑的位置' })}
        </h3>
        <p className={prose}>
          {t({
            en: (
              <>
                Positions are not typed by hand: they come from the text. <code className={mono}>findAll</code> gives the range of each place a text is, and <code className={mono}>paragraphText</code>{' '}
                the text of a paragraph; a table’s paragraphs are among the others, each with the <code className={mono}>cell</code> it is in.
              </>
            ),
            es: (
              <>
                Las posiciones no se escriben a mano: salen del texto. <code className={mono}>findAll</code> da el rango de cada lugar donde está un texto, y{' '}
                <code className={mono}>paragraphText</code> el texto de un párrafo; los párrafos de una tabla están entre los demás, cada uno con la <code className={mono}>cell</code> donde está.
              </>
            ),
            zh: (
              <>
                位置不需要手写：它们来自文字本身。<code className={mono}>findAll</code> 返回某段文字每次出现的范围，<code className={mono}>paragraphText</code>{' '}
                返回段落的文字；表格中的段落与其他段落排在一起，各自带有所在的 <code className={mono}>cell</code>。
              </>
            ),
          })}
        </p>
        <Code html={find} />
      </section>

      <section aria-labelledby="catalog" className="mt-24">
        <SectionHead id="catalog" badge="Core" color="pink" title={t({ en: 'Everything else it does', es: 'Todo lo demás que hace', zh: '其他功能' })}>
          {t({
            en: 'What the editor does to a document, the core does without one: every button of the editor is one of these calls. Each takes a document and gives back a new one.',
            es: 'Lo que el editor le hace a un documento, el core lo hace sin él: cada botón del editor es una de estas llamadas. Cada una recibe un documento y devuelve uno nuevo.',
            zh: '编辑器能对文档做的，core 不需要编辑器也能做：编辑器的每个按钮都对应下面的某个调用。每个调用都接收一份文档并返回一份新文档。',
          })}
        </SectionHead>
        <div className="mt-7 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3">
          {CATALOG.map((group, i) => (
            <div key={group.title.en} className="rounded-2xl border border-border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i % COLORS.length]]}`}>{t(group.title)}</span>
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
          {t({
            en: 'The comments in the source say what each takes and gives: the file to open is the module named. The editor’s own methods, which call these, are on the page ',
            es: 'Los comentarios del código fuente dicen qué recibe y qué da cada una: el archivo a abrir es el módulo nombrado. Los métodos propios del editor, que llaman a estas, están en la página ',
            zh: '源码中的注释说明了每个调用的参数和返回值：要查看的文件就是上面列出的模块。编辑器自身调用它们的方法见',
          })}
          {link('/docs/editor-api/', { en: 'Editor API', es: 'API del Editor', zh: 'Editor API' })}
          {dot}
        </p>
      </section>

      <section aria-labelledby="pdf" className="mt-24">
        <SectionHead id="pdf" badge="PDF" color="orange" title="PDF">
          {t({
            en: 'Laying out needs to know how wide text is. In the browser that is asked of the browser; on a server it is read from font files.',
            es: 'Maquetar necesita saber qué tan ancho es el texto. En el navegador se le pregunta al navegador; en un servidor se lee de los archivos de fuentes.',
            zh: '排版需要知道文字的宽度。在浏览器中由浏览器提供；在服务器上则从字体文件中读取。',
          })}
        </SectionHead>
        <Code html={pdf} />
        <div className="mt-7 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-3">
          {PDF_FACTS.map((fact, i) => (
            <div key={fact.title.en} className="rounded-2xl border border-border p-4">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i % COLORS.length]]}`}>{t(fact.title)}</span>
              <p className="m-0 mt-2.5 text-[14px] leading-[1.55] text-ink-soft">{t(fact.text)}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          {t({
            en: 'A server has no fonts unless you put them there. Ship the ones your documents use, as the ',
            es: 'Un servidor no tiene fuentes salvo que las pongas ahí. Lleva las que usan tus documentos, como dice la página de ',
            zh: '服务器上默认没有字体，除非你放上去。请按照',
          })}
          {link('/docs/fonts/', { en: 'fonts', es: 'fuentes', zh: '字体' })}
          {t({
            en: (
              <>
                {' '}
                page tells, and read <code className={mono}>missingFonts</code> to know when one was stood in for.
              </>
            ),
            es: (
              <>
                , y lee <code className={mono}>missingFonts</code> para saber cuándo se sustituyó una.
              </>
            ),
            zh: (
              <>
                一页的说明部署文档用到的字体，并读取 <code className={mono}>missingFonts</code> 了解哪些字体被替代了。
              </>
            ),
          })}
        </p>
        <div className="mt-8 grid max-w-[920px] gap-3 md:grid-cols-2">
          {[
            { title: t({ en: 'It has', es: 'Tiene', zh: '具备' }), items: PDF_HAS, color: 'green' as const },
            { title: t({ en: 'It has not, yet', es: 'Todavía no tiene', zh: '暂不具备' }), items: PDF_HAS_NOT, color: 'orange' as const },
          ].map((side) => (
            <div key={side.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[side.color]}`}>{side.title}</span>
              <ul className="m-0 mt-3 grid list-disc gap-1.5 pl-5 text-[14.5px] leading-[1.55] text-ink-soft">
                {side.items.map((item) => (
                  <li key={item.en}>{t(item)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="speed" className="mt-24">
        <SectionHead id="speed" badge={t({ en: 'Speed', es: 'Velocidad', zh: '速度' })} color="green" title={t({ en: 'How fast', es: 'Qué tan rápido', zh: '速度' })}>
          {t({
            en: 'The receipt of the demo, its block repeated to make longer documents, filled and written on an Apple M1 with Node 22, the fonts already read. The median of seven runs.',
            es: 'El recibo de la demo, con su bloque repetido para hacer documentos más largos, llenado y escrito en un Apple M1 con Node 22, con las fuentes ya leídas. La mediana de siete corridas.',
            zh: '以演示中的收据为例，重复其区块生成更长的文档，在 Apple M1 和 Node 22 上填写并输出，字体已预先读取。取七次运行的中位数。',
          })}
        </SectionHead>
        <div className="mt-7 max-w-[760px] overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr>
                <th className={head}>{t({ en: 'Pages', es: 'Páginas', zh: '页数' })}</th>
                <th className={head}>fillVariables</th>
                <th className={head}>exportDocx</th>
                <th className={head}>renderPdf</th>
                <th className={head}>{t({ en: 'PDF size', es: 'Tamaño del PDF', zh: 'PDF 大小' })}</th>
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
          {t({
            en: 'It all runs on the thread that calls it: a long document holds that thread for as long as it takes. For many at once, or very long ones, make them in a worker or a queue. Reading the fonts takes longer than a page: keep them read.',
            es: 'Todo corre en el hilo que lo llama: un documento largo ocupa ese hilo mientras tarde. Para muchos a la vez, o muy largos, hazlos en un worker o una cola. Leer las fuentes tarda más que una página: mantenlas leídas.',
            zh: '所有操作都在调用它的线程上运行：长文档会一直占用该线程直到完成。如果同时处理很多文档或非常长的文档，请放到 worker 或队列中。读取字体比生成一页还慢：请读取一次后保留。',
          })}
        </p>
      </section>

      <section aria-labelledby="untrusted" className="mt-24">
        <SectionHead
          id="untrusted"
          badge={t({ en: 'Safety', es: 'Seguridad', zh: '安全' })}
          color="yellow"
          title={t({ en: 'Documents sent by others', es: 'Documentos que envían otros', zh: '他人发来的文档' })}
        >
          {t({
            en: (
              <>
                A DOCX is a zip file, and one made to harm can say it unpacks to far more than it weighs. <code className={mono}>importDocx</code> adds up what each file of it says it takes before
                unpacking any, and refuses one past <code className={mono}>maxSize</code>.
              </>
            ),
            es: (
              <>
                Un DOCX es un archivo zip, y uno hecho para dañar puede decir que se descomprime en mucho más de lo que pesa. <code className={mono}>importDocx</code> suma lo que dice ocupar cada
                archivo antes de descomprimir ninguno, y rechaza uno que pase de <code className={mono}>maxSize</code>.
              </>
            ),
            zh: (
              <>
                DOCX 是一个 zip 文件，恶意构造的文件可能声称解压后远大于其本身。<code className={mono}>importDocx</code> 会在解压前累加每个文件声明的大小，超过 <code className={mono}>maxSize</code>{' '}
                时拒绝处理。
              </>
            ),
          })}
        </SectionHead>
        <Code html={untrusted} />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>
            {t({
              en: 'No macro, script or link in a document is run or followed: what the engine does not understand is kept as XML, to be written back.',
              es: 'Ninguna macro, script o enlace de un documento se ejecuta o se sigue: lo que el motor no entiende se conserva como XML, para escribirlo de vuelta.',
              zh: '文档中的宏、脚本或链接都不会被执行或访问：引擎不理解的内容会以 XML 形式保留，以便写回。',
            })}
          </li>
          <li>
            {t({
              en: 'The limit is on what the package says. Give your server a limit of its own too, on the size of what it is sent and the time a request may take.',
              es: 'El límite es sobre lo que dice el paquete. Dale también a tu servidor un límite propio, sobre el tamaño de lo que le envían y el tiempo que puede tomar una petición.',
              zh: '这个限制针对的是压缩包内声明的大小。请再为你的服务器设置自己的限制：限制上传大小和请求耗时。',
            })}
          </li>
          <li>
            {t({
              en: 'Pictures of a document are drawn from its own bytes: nothing is fetched from an address in it.',
              es: 'Las imágenes de un documento se dibujan a partir de sus propios bytes: no se descarga nada de una dirección que contenga.',
              zh: '文档中的图片都从其自身的字节绘制：不会从文档中的任何地址下载内容。',
            })}
          </li>
        </ul>
      </section>

      <section aria-labelledby="the-command-line-tool" className="mt-24">
        <SectionHead id="the-command-line-tool" badge="CLI" color="purple" title={t({ en: 'The command-line tool', es: 'La herramienta de línea de comandos', zh: '命令行工具' })}>
          {t({
            en: (
              <>
                The same without writing code. It comes with <code className={mono}>@rebodocs/mcp</code>, which reads the fonts of the machine; in a clone of the repository,{' '}
                <code className={mono}>npm run generate -- …</code> runs it from its source.
              </>
            ),
            es: (
              <>
                Lo mismo sin escribir código. Viene con <code className={mono}>@rebodocs/mcp</code>, que lee las fuentes de la máquina; en un clon del repositorio,{' '}
                <code className={mono}>npm run generate -- …</code> lo corre desde su código fuente.
              </>
            ),
            zh: (
              <>
                不写代码也能完成同样的事。它随 <code className={mono}>@rebodocs/mcp</code> 一起提供，会读取本机的字体；在克隆的仓库中，<code className={mono}>npm run generate -- …</code>{' '}
                会从源码运行它。
              </>
            ),
          })}
        </SectionHead>
        <Code html={cli} />
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {CLI.map((row) => (
            <div key={row.flag} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[250px_1fr]">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{row.flag}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(row.text)}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          {t({
            en: 'It warns of the variables and blocks left without a value, and of a value a format cannot take, which is then put as it is.',
            es: 'Avisa de las variables y bloques que quedan sin valor, y de un valor que un formato no puede tomar, que entonces se pone tal cual.',
            zh: '它会提醒哪些变量和区块没有值，以及哪些值无法按格式书写（这些值会原样写入）。',
          })}
        </p>
      </section>

      <section aria-labelledby="laying-out-yourself" className="mt-24">
        <SectionHead
          id="laying-out-yourself"
          badge={t({ en: 'Layout', es: 'Maquetación', zh: '排版' })}
          color="blue"
          title={t({ en: 'Laying out yourself', es: 'Maquetar por tu cuenta', zh: '自行排版' })}
        >
          {t({
            en: 'To know how many pages a document has, or where a line falls, without drawing it.',
            es: 'Para saber cuántas páginas tiene un documento, o dónde cae una línea, sin dibujarlo.',
            zh: '在不绘制的情况下，得知文档有多少页、某一行落在哪里。',
          })}
        </SectionHead>
        <Code html={layout} />
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>layoutDocument</code> takes anything that can say the width of a text and the height of a font (<code className={mono}>TextMeasurer</code>), which is how the
                browser and the server share it: the editor measures with the browser, <code className={mono}>FontMeasurer</code> with font files.
              </>
            ),
            es: (
              <>
                <code className={mono}>layoutDocument</code> acepta cualquier cosa que pueda decir el ancho de un texto y la altura de una fuente (<code className={mono}>TextMeasurer</code>), que es
                como lo comparten el navegador y el servidor: el editor mide con el navegador, <code className={mono}>FontMeasurer</code> con archivos de fuentes.
              </>
            ),
            zh: (
              <>
                <code className={mono}>layoutDocument</code> 接受任何能给出文字宽度和字体高度的对象（<code className={mono}>TextMeasurer</code>），浏览器和服务器正是这样共用它的：编辑器用浏览器测量，
                <code className={mono}>FontMeasurer</code> 则用字体文件测量。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="a-typical-backend" className="mt-24">
        <SectionHead id="a-typical-backend" badge={t({ en: 'Recipe', es: 'Receta', zh: '示例' })} color="pink" title={t({ en: 'A typical backend', es: 'Un backend típico', zh: '典型的后端' })}>
          {t({
            en: 'For an application that fills templates and lets people edit the result:',
            es: 'Para una aplicación que llena plantillas y deja que la gente edite el resultado:',
            zh: '适用于填写模板并允许用户编辑结果的应用：',
          })}
        </SectionHead>
        <ol className="m-0 mt-6 grid max-w-[920px] list-none gap-3 p-0 [counter-reset:step]">
          {steps.map((step, i) => (
            <li
              key={i}
              className="flex gap-4 rounded-2xl border border-border px-5 py-4 [counter-increment:step] before:font-display before:text-xl before:font-extrabold before:text-brand before:content-[counter(step)]"
            >
              <p className="m-0 text-[15px] leading-normal text-ink-soft">{t(step)}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
