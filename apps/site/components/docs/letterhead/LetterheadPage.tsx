import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { CORE, HEADLESS, MEMBERS, MENU, RULES } from './data';
import { LazyEditorDemo, LazyMarginsDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

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

/** A sheet with a letterhead, drawn: the band, the text kept clear of it, the address. */
function Sheet() {
  const t = getT();
  return (
    <svg
      viewBox="0 0 612 792"
      role="img"
      aria-label={t({
        en: 'A page with a band at the top, an address at the foot, and the text between them',
        es: 'Una página con una franja arriba, una dirección al pie y el texto entre ambas',
        zh: '顶部有色带、底部有地址、文字位于两者之间的页面',
      })}
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
  const t = getT();
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
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{t({ en: 'Letterheads', es: 'Membretes', zh: '信头' })}</h1>
      <div className="mt-3.5 flex flex-wrap items-start gap-8">
        <div className="min-w-0 flex-[1_1_420px]">
          <p className="m-0 max-w-[640px] text-lg leading-[1.6] text-muted">
            {t({
              en: 'A letterhead is a picture the size of the page, behind the text of every page: the logo at the top, the address at the foot, a pattern across the sheet. In a DOCX it lives in the header, placed from the page and drawn under the text, which is how Word does it and how Rebodocs reads and writes it.',
              es: 'Un membrete es una imagen del tamaño de la página, detrás del texto de cada página: el logo arriba, la dirección al pie, un motivo a lo largo de la hoja. En un DOCX vive en el encabezado, colocado desde la página y dibujado bajo el texto, que es como lo hace Word y como Rebodocs lo lee y lo escribe.',
              zh: '信头是一张与页面同样大小、位于每一页文字下方的图片：顶部的标志、底部的地址、铺满纸张的图案。在 DOCX 中，它存放在页眉里，以页面为基准定位并绘制在文字下方——Word 就是这样做的，Rebodocs 也按同样的方式读取和写入。',
            })}
          </p>
          <p className="m-0 mt-4 max-w-[640px] text-base leading-[1.7] text-ink-soft">
            {t({
              en: 'Documents that come with one keep it: it is drawn, printed, put in the PDF, and written back to the DOCX. Given one, the margins grow to clear what it prints at the top and the foot, the dashed lines of the sheet.',
              es: 'Los documentos que traen uno lo conservan: se dibuja, se imprime, va en el PDF y se vuelve a escribir en el DOCX. Al darle uno, los márgenes crecen para librar lo que imprime arriba y al pie, las líneas punteadas de la hoja.',
              zh: '自带信头的文档会保留它：信头会被绘制、打印、放进 PDF，并写回 DOCX。设置信头后，页边距会增大，以避开它在顶部和底部印刷的内容，也就是纸张上的虚线。',
            })}
          </p>
          <div className="mt-4">
            <HandTip>{t({ en: 'tip: give the letter below a letterhead', es: 'consejo: dale un membrete a la carta de abajo', zh: '提示：给下面的信件加上信头' })}</HandTip>
          </div>
        </div>
        <Sheet />
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'Give it a letterhead', es: 'Dale un membrete', zh: '加上信头' })}>
          {t({
            en: 'A real editor with a letter. Give it one of three letterheads drawn on this page, as your application would give its own, and watch the margins; or open the menu and pick a picture of yours.',
            es: 'Un editor real con una carta. Dale uno de los tres membretes dibujados en esta página, como tu aplicación daría el suyo, y mira los márgenes; o abre el menú y elige una imagen tuya.',
            zh: '一个装着信件的真实编辑器。给它设置本页绘制的三种信头之一（就像你的应用设置自己的信头那样），然后观察页边距；也可以打开菜单，选择你自己的图片。',
          })}
        </SectionHead>
        <LazyEditorDemo />
      </section>

      <section aria-labelledby="in-the-editor" className="mt-24">
        <SectionHead id="in-the-editor" badge={t({ en: 'The interface', es: 'La interfaz', zh: '界面' })} color="blue" title={t({ en: 'In the editor', es: 'En el editor', zh: '在编辑器中' })}>
          {t({
            en: (
              <>
                The document menu (☰), under <strong>Page</strong>. Fit, extract and remove show only when there is a letterhead.
              </>
            ),
            es: (
              <>
                El menú del documento (☰), en <strong>Página</strong>. Ajustar, extraer y quitar solo aparecen cuando hay un membrete.
              </>
            ),
            zh: (
              <>
                在文档菜单（☰）的<strong>页面</strong>下。只有存在信头时，才会显示调整、提取和删除。
              </>
            ),
          })}
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {MENU.map((row) => (
            <div key={row.item.en} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[300px_1fr]">
              <dt className="text-[15px] font-semibold text-ink">{t(row.item)}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(row.text)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="how-margins-are-fitted" className="mt-24">
        <SectionHead id="how-margins-are-fitted" badge="@rebodocs/core" color="orange" title={t({ en: 'How margins are fitted', es: 'Cómo se ajustan los márgenes', zh: '如何调整页边距' })}>
          {t({
            en: 'The picture is read pixel by pixel, at 320 across: where its printing ends at the top, and where it starts at the foot. Make the band and the address taller, or take them away.',
            es: 'La imagen se lee píxel a píxel, a 320 de ancho: dónde termina lo impreso arriba y dónde empieza al pie. Haz más alta la franja y la dirección, o quítalas.',
            zh: '图片会按 320 像素宽逐个像素读取：顶部印刷内容在哪里结束，底部印刷内容从哪里开始。试着把色带和地址调高，或者去掉它们。',
          })}
        </SectionHead>
        <LazyMarginsDemo />
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4">
          {[
            {
              title: t({ en: 'The paper', es: 'El papel', zh: '纸张' }),
              color: 'blue' as const,
              text: t({
                en: 'The tone there is most of. A row is printed when enough of it is far from that tone; what is see-through counts as white paper.',
                es: 'El tono que más hay. Una fila está impresa cuando bastante de ella se aleja de ese tono; lo transparente cuenta como papel blanco.',
                zh: '图片中占比最多的色调。一行中有足够多的像素偏离这个色调时，就视为有印刷内容；透明部分视为白纸。',
              }),
            },
            {
              title: t({ en: 'Top and foot', es: 'Arriba y al pie', zh: '顶部和底部' }),
              color: 'purple' as const,
              text: t({
                en: 'Printing that starts in the top fifth and ends before 35% of the page asks for the top margin; the same from the foot. What is in the middle asks for nothing.',
                es: 'Lo impreso que empieza en el quinto superior y termina antes del 35% de la página pide el margen de arriba; lo mismo desde el pie. Lo que está en medio no pide nada.',
                zh: '从页面顶部五分之一内开始、并在页面 35% 之前结束的印刷内容决定上边距；底部同理。位于中间的内容不影响页边距。',
              }),
            },
            {
              title: t({ en: 'Only growing', es: 'Solo crecen', zh: '只增不减' }),
              color: 'pink' as const,
              text: t({
                en: 'The margins grow, never shrink, and never past 40% of the page. Side margins are left alone, and so is any text already in the header.',
                es: 'Los márgenes crecen, nunca encogen, y nunca más allá del 40% de la página. Los márgenes laterales no se tocan, ni el texto que ya haya en el encabezado.',
                zh: '页边距只会增大，不会缩小，也不会超过页面的 40%。左右页边距保持不变，页眉中已有的文字也不受影响。',
              }),
            },
          ].map((card) => (
            <div key={card.color} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="from-your-application" className="mt-24">
        <SectionHead id="from-your-application" badge="React" color="purple" title={t({ en: 'From your application', es: 'Desde tu aplicación', zh: '从你的应用设置' })}>
          {t({
            en: 'To give every document your letterhead, whatever it came with:',
            es: 'Para darle tu membrete a cada documento, traiga el que traiga:',
            zh: '无论文档原本带有什么信头，都为每份文档设置你的信头：',
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: prop }} />
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>letterhead</code> is an address to fetch, a <code className={mono}>File</code> or <code className={mono}>Blob</code>, or{' '}
                <code className={mono}>{'{ bytes, type }'}</code>; <code className={mono}>null</code> for none. A server that does not say what it sends is no trouble: the picture is told by how it
                starts. Set, it is yours: the menu does not offer it to the person. Left out, the document keeps its own, and the person may change it.
              </>
            ),
            es: (
              <>
                <code className={mono}>letterhead</code> es una dirección que descargar, un <code className={mono}>File</code> o <code className={mono}>Blob</code>, o{' '}
                <code className={mono}>{'{ bytes, type }'}</code>; <code className={mono}>null</code> para ninguno. Un servidor que no dice qué envía no es problema: la imagen se reconoce por cómo
                empieza. Fijado, es tuyo: el menú no se lo ofrece a la persona. Si se omite, el documento conserva el suyo y la persona puede cambiarlo.
              </>
            ),
            zh: (
              <>
                <code className={mono}>letterhead</code> 可以是要获取的地址、<code className={mono}>File</code> 或 <code className={mono}>Blob</code>，或者{' '}
                <code className={mono}>{'{ bytes, type }'}</code>；<code className={mono}>null</code>{' '}
                表示没有信头。服务器没有说明发送的内容类型也没关系：图片会根据开头识别。设置后，信头由你掌控：菜单不会向用户提供它。不设置时，文档保留自己的信头，用户可以更改。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                It is put once the document is open, and is how the document starts: not a step to undo, and the document is not left unsaved by it. A document that has the very same picture is left
                alone, so in a{' '}
                <LocalLink href="/docs/collaboration/" className={LINK}>
                  shared room
                </LocalLink>{' '}
                the second person to come in does not put it again. Changing the prop later gives the new one as a change; the handle&apos;s <code className={mono}>setLetterhead(source | null)</code>{' '}
                does the same.
              </>
            ),
            es: (
              <>
                Se pone una vez abierto el documento, y es como el documento empieza: no es un paso para deshacer, y el documento no queda sin guardar por ello. Un documento que tiene exactamente la
                misma imagen se deja como está, así que en una{' '}
                <LocalLink href="/docs/collaboration/" className={LINK}>
                  sala compartida
                </LocalLink>{' '}
                la segunda persona en entrar no lo vuelve a poner. Cambiar la prop después da el nuevo como un cambio; <code className={mono}>setLetterhead(source | null)</code> del handle hace lo
                mismo.
              </>
            ),
            zh: (
              <>
                信头在文档打开后设置，作为文档的初始状态：它不是可撤销的步骤，也不会让文档变成未保存状态。已经带有完全相同图片的文档不会被改动，因此在
                <LocalLink href="/docs/collaboration/" className={LINK}>
                  共享房间
                </LocalLink>
                中，第二个进入的人不会再次设置它。之后修改该 prop 会把新信头作为一次更改应用；handle 的 <code className={mono}>setLetterhead(source | null)</code> 效果相同。
              </>
            ),
          })}
        </p>
        <h3 id="headless" className="m-0 mt-10 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          Headless
        </h3>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: headless }} />
        <Signatures rows={HEADLESS} />
        <h3 id="editor" className="m-0 mt-10 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          {t({ en: 'On the editor', es: 'En el editor', zh: '编辑器上' })}
        </h3>
        <Signatures rows={MEMBERS} />
      </section>

      <section aria-labelledby="in-code" className="mt-24">
        <SectionHead id="in-code" badge="@rebodocs/core" color="orange" title={t({ en: 'In code', es: 'En código', zh: '在代码中' })}>
          {t({
            en: 'On a server, to stamp a template before it is filled or sent.',
            es: 'En un servidor, para estampar una plantilla antes de llenarla o enviarla.',
            zh: '在服务器上，在填写或发送模板之前为它加上信头。',
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: core }} />
        <Signatures rows={CORE} />
      </section>

      <section aria-labelledby="for-an-assistant" className="mt-24">
        <SectionHead id="for-an-assistant" badge="MCP" color="pink" title={t({ en: 'For an assistant', es: 'Para un asistente', zh: '供 AI 助手使用' })}>
          {t({
            en: (
              <>
                The{' '}
                <LocalLink href="/docs/assistants/" className={LINK}>
                  MCP server
                </LocalLink>{' '}
                has <code className={mono}>set_letterhead</code>, and <code className={mono}>get_overview</code> says when the document has one.
              </>
            ),
            es: (
              <>
                El{' '}
                <LocalLink href="/docs/assistants/" className={LINK}>
                  servidor MCP
                </LocalLink>{' '}
                tiene <code className={mono}>set_letterhead</code>, y <code className={mono}>get_overview</code> dice cuándo el documento tiene uno.
              </>
            ),
            zh: (
              <>
                <LocalLink href="/docs/assistants/" className={LINK}>
                  MCP 服务器
                </LocalLink>
                提供 <code className={mono}>set_letterhead</code>，<code className={mono}>get_overview</code> 会说明文档是否有信头。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: mcp }} />
        <p className={prose}>
          {t({
            en: (
              <>
                The server reads the file, which is why it is not among the tools of an assistant in a page. For a PNG it reads the pixels and grows the margins as the editor does; for a JPEG it
                leaves them, and says so. <code className={mono}>{'"remove": true'}</code> takes the letterhead away.
              </>
            ),
            es: (
              <>
                El servidor lee el archivo, por eso no está entre las herramientas de un asistente en una página. Para un PNG lee los píxeles y agranda los márgenes como lo hace el editor; para un
                JPEG los deja, y lo dice. <code className={mono}>{'"remove": true'}</code> quita el membrete.
              </>
            ),
            zh: (
              <>
                该工具由服务器读取文件，因此不在页面内 AI 助手的工具之列。对于 PNG，它会读取像素并像编辑器一样增大页边距；对于 JPEG，它不修改页边距，并会说明这一点。
                <code className={mono}>{'"remove": true'}</code> 会删除信头。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="checked-against-word" className="mt-24">
        <SectionHead id="checked-against-word" badge="Word" color="blue" title={t({ en: 'Checked against Word', es: 'Comprobado con Word', zh: '与 Word 对照验证' })} />
        <p className={prose}>
          {t({
            en: 'A document of two sections, the first turned to landscape with a header of its own, was given a letterhead here and opened in Word for Mac. Word drew it under the text of both pages, each the size of its page, and put it in the PDF so. Saved by Word and read back here, it was still the letterhead of both headers.',
            es: 'A un documento de dos secciones, la primera girada a horizontal con encabezado propio, se le dio un membrete aquí y se abrió en Word para Mac. Word lo dibujó bajo el texto de ambas páginas, cada uno del tamaño de su página, y así lo puso en el PDF. Guardado por Word y leído de nuevo aquí, seguía siendo el membrete de ambos encabezados.',
            zh: '我们在这里为一份包含两节的文档设置了信头（第一节为横向，且有独立页眉），然后在 Mac 版 Word 中打开。Word 在两页的文字下方都绘制了信头，各自与所在页面同样大小，导出的 PDF 也是如此。由 Word 保存后再在这里读取，它仍然是两个页眉的信头。',
          })}
        </p>
      </section>

      <section aria-labelledby="what-counts" className="mt-24">
        <SectionHead
          id="what-counts"
          badge={t({ en: 'Rules', es: 'Reglas', zh: '规则' })}
          color="blue"
          title={t({ en: 'What counts as a letterhead', es: 'Qué cuenta como membrete', zh: '什么算作信头' })}
        >
          {t({
            en: 'A picture is the document’s letterhead when all four are true. Word has nothing called a letterhead; this is what a letterhead is in a file Word made.',
            es: 'Una imagen es el membrete del documento cuando se cumplen las cuatro. Word no tiene nada llamado membrete; esto es lo que es un membrete en un archivo hecho por Word.',
            zh: '图片同时满足以下四点时，才是文档的信头。Word 中没有名为“信头”的功能；这里描述的是 Word 生成的文件中信头的样子。',
          })}
        </SectionHead>
        <div className="mt-6 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
          {RULES.map((rule) => (
            <div key={rule.title.en} className="rounded-2xl border border-border p-4">
              <p className="m-0 text-[15px] font-semibold text-ink">{t(rule.title)}</p>
              <p className="m-0 mt-1.5 text-[14px] leading-[1.55] text-ink-soft">{t(rule.text)}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge={t({ en: 'Limits', es: 'Límites', zh: '限制' })} color="yellow" title={t({ en: 'What to know', es: 'Qué saber', zh: '注意事项' })} />
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            t({
              en: 'The picture is stretched to the page: one of other proportions is distorted. Make it the shape of the paper.',
              es: 'La imagen se estira a la página: una de otras proporciones se deforma. Hazla con la forma del papel.',
              zh: '图片会被拉伸到整页：比例不同的图片会变形。请让图片与纸张形状一致。',
            }),
            t({
              en: 'When a letterhead is replaced or removed, its picture leaves the file on export: it is not left inside the ZIP for whoever unpacks it.',
              es: 'Cuando un membrete se reemplaza o se quita, su imagen sale del archivo al exportar: no se queda dentro del ZIP para quien lo descomprima.',
              zh: '信头被替换或删除后，导出时它的图片也会从文件中移除：不会留在 ZIP 包里被解压的人看到。',
            }),
            t({
              en: 'One letterhead for the whole document: every page, the first ones and the sections with headers of their own show the same picture, each stretched to its page. Turning the paper of a section turns its own.',
              es: 'Un membrete para todo el documento: cada página, las primeras y las secciones con encabezado propio muestran la misma imagen, cada una estirada a su página. Girar el papel de una sección gira el suyo.',
              zh: '整个文档只有一个信头：每一页、各首页以及拥有独立页眉的节都显示同一张图片，各自拉伸到所在页面。旋转某一节的纸张方向时，该节的信头也会随之旋转。',
            }),
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
