import { createDoc, trackEdit } from '@rebodocs/core';
import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { CORE, KEYS, MEMBERS, TOOLS, VIEW } from './data';
import { LazyReviewDemo } from './Lazy';
import { Tracked } from './Tracked';
import TrackEditDemo from './TrackEditDemo';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** The sentence before and after, in each language of the site. */
const SENTENCE: L<[string, string]> = {
  en: ['Payment is due within 15 days.', 'Payment is due within 30 days, in writing.'],
  es: ['El pago vence a los 15 días.', 'El pago vence a los 30 días, por escrito.'],
  zh: ['应在 15 天内付款。', '应在 30 天内以书面形式付款。'],
};

/** What tracking does to a sentence, worked out by trackEdit when the site is built. */
const example = ([before, after]: [string, string]) =>
  trackEdit(createDoc([{ props: {}, runs: [{ text: before, props: {} }] }]), createDoc([{ props: {}, runs: [{ text: after, props: {} }] }]), { author: 'Luis' }, { words: true }).doc;

/**
 * "Tracked changes": Word's "Track changes" in a real editor with two people,
 * trackEdit on texts typed on the page, how the keys behave, the members, the
 * functions of core, and the tools of an assistant.
 */
export async function TrackedChangesPage() {
  const t = getT();
  const sample = example(t(SENTENCE));
  const [basic, headless, core, mcp] = await Promise.all([
    highlight(
      `const editor = handle.editor;

editor.setTrackChanges(true);      // ⌘⇧E / Ctrl+Shift+E
editor.revisions;                   // [{ type: 'insert', author: 'Ana', text: '30', range, … }]
editor.acceptAllRevisions();        // one step to undo`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `const { state, commands } = useDocs();

state.trackChanges;     // boolean
state.revisionCount;    // number

commands.setTrackChanges(!state.trackChanges);
commands.acceptRevision();
commands.goToRevision(1);`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { acceptRevisions, rejectRevisions, revisionsOf, trackEdit } from '@rebodocs/core';

const { doc } = trackEdit(before, after, { author: 'Contracts bot', date: new Date().toISOString() });
revisionsOf(doc);        // what changed, for a person to review
acceptRevisions(doc);    // equals after
rejectRevisions(doc);    // equals before`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `Payment is due within [-15-]{+30+} days of this receipt.
Late payments add a fee{+ of 2% a month+}.`,
      'bash',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{t({ en: 'Tracked changes', es: 'Control de cambios', zh: '修订' })}</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: 'With tracking on, what is typed stays underlined and what is deleted stays in the text, struck through, until someone accepts or rejects it. This is Word’s “Track changes”: a document tracked in Word opens with its changes, and what is tracked here opens in Word as tracked changes.',
          es: 'Con el control activado, lo que se escribe queda subrayado y lo que se borra se queda en el texto, tachado, hasta que alguien lo acepta o lo rechaza. Es el “Control de cambios” de Word: un documento con cambios controlados en Word se abre con sus cambios, y lo que se controla aquí se abre en Word como cambios controlados.',
          zh: '开启修订后，输入的内容会带下划线，删除的内容会以删除线保留在文字中，直到有人接受或拒绝。这就是 Word 的“修订”功能：在 Word 中带修订的文档打开时会保留修订，在这里记录的修订在 Word 中打开也是修订。',
        })}
      </p>
      <Tracked paragraphs={sample.paragraphs} className="mt-6 max-w-[760px] rounded-[10px] bg-surface px-5 py-4 text-[17px] leading-[1.6] text-ink" />
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: be Ana, and decide on Luis’s changes below', es: 'consejo: sé Ana y decide sobre los cambios de Luis abajo', zh: '提示：扮演 Ana，在下面处理 Luis 的修订' })}</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'Review it', es: 'Revísalo', zh: '审阅' })}>
          {t({
            en: (
              <>
                Luis changed the receipt with tracking on: a number, words put in and taken out, the formatting of two words, a row of the table. Accept or reject his changes, from here, from{' '}
                <strong>Review</strong> in the toolbar or from the <strong>Changes</strong> tab of the side panel; or type something of your own.
              </>
            ),
            es: (
              <>
                Luis cambió el recibo con el control activado: un número, palabras puestas y quitadas, el formato de unas palabras, una fila de la tabla. Acepta o rechaza sus cambios desde aquí, desde{' '}
                <strong>Revisar</strong> en la barra de herramientas o desde la pestaña <strong>Cambios</strong> del panel lateral; o escribe algo tuyo.
              </>
            ),
            zh: (
              <>
                Luis 在开启修订的情况下修改了收据：一个数字、插入和删除的文字、几个字的格式、表格的一行。可以在这里、工具栏的<strong>审阅</strong>或侧边面板的<strong>修订</strong>
                选项卡中接受或拒绝他的修订；也可以自己输入一些内容。
              </>
            ),
          })}
        </SectionHead>
        <LazyReviewDemo />
        <p className={prose}>
          {t({
            en: (
              <>
                As Ana, take out words Luis put in: they stay, his and taken out by you, two changes. Accept all of one person&apos;s, and the other&apos;s stay. <em>Show all accepted</em> and{' '}
                <em>original</em> show the document as it would be, without touching the changes.
              </>
            ),
            es: (
              <>
                Como Ana, quita palabras que puso Luis: se quedan, suyas y quitadas por ti, dos cambios. Acepta todos los de una persona y los de la otra se quedan. <em>todos aceptados</em> y{' '}
                <em>original</em> muestran el documento como quedaría, sin tocar los cambios.
              </>
            ),
            zh: (
              <>
                以 Ana 的身份删除 Luis 插入的文字：这些文字会保留，标为他插入、由你删除，共两处修订。接受某一个人的全部修订后，另一个人的仍然保留。<em>全部接受</em>和<em>原始</em>
                会显示文档最终的样子，而不改动修订。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="in-the-editor" className="mt-24">
        <SectionHead id="in-the-editor" badge={t({ en: 'The interface', es: 'La interfaz', zh: '界面' })} color="blue" title={t({ en: 'In the editor', es: 'En el editor', zh: '在编辑器中' })}>
          {t({
            en: (
              <>
                <strong>Review</strong> in the toolbar, or ⌘⇧E (Ctrl+Shift+E), turns tracking on and off; it is saved in the file, as Word saves it. Changes are signed with the editor&apos;s{' '}
                <code className={mono}>author</code>, the name notes are signed with.
              </>
            ),
            es: (
              <>
                <strong>Revisar</strong> en la barra de herramientas, o ⌘⇧E (Ctrl+Shift+E), activa y desactiva el control; se guarda en el archivo, como lo guarda Word. Los cambios se firman con el{' '}
                <code className={mono}>author</code> del editor, el nombre con que se firman las notas.
              </>
            ),
            zh: (
              <>
                工具栏中的<strong>审阅</strong>或 ⌘⇧E（Ctrl+Shift+E）可以开启和关闭修订；该设置与 Word 一样保存在文件中。修订以编辑器的 <code className={mono}>author</code>{' '}
                署名，也就是批注所用的名字。
              </>
            ),
          })}
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
          {[
            {
              title: t({ en: 'Review menu', es: 'Menú Revisar', zh: '审阅菜单' }),
              color: 'blue' as const,
              text: t({
                en: 'Track changes; accept or reject the change at the caret, or every change in the selection; the previous or next change; accept or reject them all; show the changes, the document with all of them accepted, or the original.',
                es: 'Controlar cambios; aceptar o rechazar el cambio del cursor, o todos los de la selección; el cambio anterior o el siguiente; aceptarlos o rechazarlos todos; mostrar los cambios, el documento con todos aceptados, o el original.',
                zh: '修订开关；接受或拒绝光标处的修订或选区中的所有修订；上一处或下一处修订；全部接受或全部拒绝；显示修订、全部接受后的文档或原始文档。',
              }),
            },
            {
              title: t({ en: 'Changes tab', es: 'Pestaña Cambios', zh: '修订选项卡' }),
              color: 'purple' as const,
              text: t({
                en: 'Every change with who made it, when, and where: a header, a footer or a note. Each one to go to, accept or reject; one person’s alone, to accept or reject all at once; and a switch for tracking.',
                es: 'Cada cambio con quién lo hizo, cuándo y dónde: un encabezado, un pie de página o una nota. Cada uno para ir a él, aceptarlo o rechazarlo; los de una sola persona, para aceptarlos o rechazarlos todos a la vez; y un interruptor para el control.',
                zh: '列出每处修订的作者、时间和位置（页眉、页脚或脚注）。可以跳转到每一处并接受或拒绝；可以只看某一个人的修订，一次全部接受或拒绝；还有修订开关。',
              }),
            },
            {
              title: t({ en: 'On the page', es: 'En la página', zh: '页面上' }),
              color: 'pink' as const,
              text: t({
                en: 'Each person’s changes in their colour, always the same for the same name; a move in green; and a bar in the margin beside each line with a change, of its text or of its formatting.',
                es: 'Los cambios de cada persona en su color, siempre el mismo para el mismo nombre; un movimiento en verde; y una barra en el margen junto a cada línea con un cambio, de su texto o de su formato.',
                zh: '每个人的修订用各自的颜色显示，同一名字始终同一颜色；移动以绿色显示；有修订（文字或格式）的每一行旁边的页边会有一条竖线。',
              }),
            },
          ].map((card) => (
            <div key={card.color} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
        <h3 id="keys" className="m-0 mt-12 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          {t({ en: 'The keys, while tracking', es: 'Las teclas, con el control activado', zh: '修订开启时的按键' })}
        </h3>
        <dl className="m-0 mt-4 max-w-[920px] rounded-2xl border border-border px-5">
          {KEYS.map((row) => (
            <div key={row.key.en} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[200px_1fr]">
              <dt className="text-[15px] font-semibold text-ink">{t(row.key)}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(row.text)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="in-code" className="mt-24">
        <SectionHead id="in-code" badge="Editor API" color="purple" title={t({ en: 'In code', es: 'En código', zh: '在代码中' })}>
          {t({
            en: (
              <>
                The editor of <code className={mono}>onReady</code>, or of{' '}
                <LocalLink href="/docs/editor-api/" className={LINK}>
                  the Editor API
                </LocalLink>
                .
              </>
            ),
            es: (
              <>
                El editor de <code className={mono}>onReady</code>, o el de{' '}
                <LocalLink href="/docs/editor-api/" className={LINK}>
                  la Editor API
                </LocalLink>
                .
              </>
            ),
            zh: (
              <>
                <code className={mono}>onReady</code> 给出的编辑器，或
                <LocalLink href="/docs/editor-api/" className={LINK}>
                  Editor API
                </LocalLink>
                的编辑器。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: basic }} />
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {MEMBERS.map((m) => (
            <div key={m.sig} className="border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{m.sig}</dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{t(m.text)}</dd>
            </div>
          ))}
        </dl>
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">RevisionView</h3>
        <dl className="m-0 mt-4 max-w-[920px] rounded-2xl border border-border px-5">
          {VIEW.map((field) => (
            <div key={field.name} className="border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="font-code text-[13.5px] text-ink">
                <span className="font-semibold">{field.name}</span>: <span className="text-muted">{field.type}</span>
              </dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{t(field.text)}</dd>
            </div>
          ))}
        </dl>
        <h3 id="headless" className="m-0 mt-10 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          Headless
        </h3>
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>DocsState</code> has <code className={mono}>trackChanges</code> and <code className={mono}>revisionCount</code>; the commands have the editor&apos;s methods of
                the same names, from <code className={mono}>setTrackChanges</code> to <code className={mono}>selectRevision</code>, for an interface of your own.
              </>
            ),
            es: (
              <>
                <code className={mono}>DocsState</code> tiene <code className={mono}>trackChanges</code> y <code className={mono}>revisionCount</code>; los comandos tienen los métodos del editor con
                los mismos nombres, de <code className={mono}>setTrackChanges</code> a <code className={mono}>selectRevision</code>, para una interfaz propia.
              </>
            ),
            zh: (
              <>
                <code className={mono}>DocsState</code> 提供 <code className={mono}>trackChanges</code> 和 <code className={mono}>revisionCount</code>；commands 提供与编辑器同名的方法，从{' '}
                <code className={mono}>setTrackChanges</code> 到 <code className={mono}>selectRevision</code>，供你构建自己的界面。
              </>
            ),
          })}
        </p>
        <div className={`mt-4 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: headless }} />
      </section>

      <section aria-labelledby="in-core" className="mt-24">
        <SectionHead id="in-core" badge="@rebodocs/core" color="orange" title={t({ en: 'Tracking any edit', es: 'Controlar cualquier edición', zh: '记录任意编辑' })}>
          {t({
            en: 'Whatever turned one document into another, made by a person, a program or a template, comes back as changes for someone to review. Change either text below.',
            es: 'Lo que haya convertido un documento en otro, hecho por una persona, un programa o una plantilla, vuelve como cambios para que alguien los revise. Cambia cualquiera de los textos de abajo.',
            zh: '无论是人、程序还是模板把一份文档变成了另一份，这些变化都会变成修订，供人审阅。试着修改下面任意一段文字。',
          })}
        </SectionHead>
        <TrackEditDemo />
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: core }} />
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {CORE.map((fn) => (
            <div key={fn.sig} className="border-t border-[#f0eee9] py-3 first:border-t-0">
              <dt className="font-code text-[13.5px] font-semibold text-ink">{fn.sig}</dt>
              <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{t(fn.text)}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          {t({
            en: (
              <>
                A change is part of the formatting of its text: <code className={mono}>revision</code>, <code className={mono}>revisionAuthor</code> and <code className={mono}>revisionDate</code> on a
                run, <code className={mono}>markRevision</code> on a paragraph for its mark. So it moves with the text: into the file, to the others in a{' '}
                <LocalLink href="/docs/collaboration/" className={LINK}>
                  shared document
                </LocalLink>
                , and into undo.
              </>
            ),
            es: (
              <>
                Un cambio es parte del formato de su texto: <code className={mono}>revision</code>, <code className={mono}>revisionAuthor</code> y <code className={mono}>revisionDate</code> en un run,{' '}
                <code className={mono}>markRevision</code> en un párrafo para su marca. Así viaja con el texto: al archivo, a los demás en un{' '}
                <LocalLink href="/docs/collaboration/" className={LINK}>
                  documento compartido
                </LocalLink>
                , y al deshacer.
              </>
            ),
            zh: (
              <>
                修订是文字格式的一部分：run 上的 <code className={mono}>revision</code>、<code className={mono}>revisionAuthor</code> 和 <code className={mono}>revisionDate</code>
                ，段落上表示段落标记的 <code className={mono}>markRevision</code>。因此修订会随文字一起移动：写入文件、传给
                <LocalLink href="/docs/collaboration/" className={LINK}>
                  共享文档
                </LocalLink>
                中的其他人，并进入撤销记录。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="for-an-assistant" className="mt-24">
        <SectionHead id="for-an-assistant" badge="MCP" color="pink" title={t({ en: 'For an assistant', es: 'Para un asistente', zh: '供 AI 助手使用' })}>
          {t({
            en: (
              <>
                While tracking is on, everything the{' '}
                <LocalLink href="/docs/assistants/" className={LINK}>
                  assistant&apos;s tools
                </LocalLink>{' '}
                change is tracked, signed “Assistant”, so a person can review what it did before keeping it.
              </>
            ),
            es: (
              <>
                Mientras el control está activo, todo lo que cambian las{' '}
                <LocalLink href="/docs/assistants/" className={LINK}>
                  herramientas del asistente
                </LocalLink>{' '}
                se controla, firmado “Assistant”, para que una persona revise lo que hizo antes de conservarlo.
              </>
            ),
            zh: (
              <>
                修订开启期间，
                <LocalLink href="/docs/assistants/" className={LINK}>
                  AI 助手工具
                </LocalLink>
                做出的所有更改都会被记录为修订，署名“Assistant”，以便有人在保留之前审阅它做了什么。
              </>
            ),
          })}
        </SectionHead>
        <div className="mt-6 grid max-w-[920px] grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
          {TOOLS.map((tool) => (
            <div key={tool.name} className="rounded-2xl border border-border p-4">
              <p className="m-0 font-code text-[13.5px] font-semibold text-ink">{tool.name}</p>
              <p className="m-0 mt-1.5 text-[14px] leading-[1.55] text-ink-soft">{t(tool.text)}</p>
            </div>
          ))}
        </div>
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>read_document</code> shows what was put in as <code className={mono}>{'{+…+}'}</code> and what was taken out as <code className={mono}>[-…-]</code>:
              </>
            ),
            es: (
              <>
                <code className={mono}>read_document</code> muestra lo puesto como <code className={mono}>{'{+…+}'}</code> y lo quitado como <code className={mono}>[-…-]</code>:
              </>
            ),
            zh: (
              <>
                <code className={mono}>read_document</code> 用 <code className={mono}>{'{+…+}'}</code> 表示插入的内容，用 <code className={mono}>[-…-]</code> 表示删除的内容：
              </>
            ),
          })}
        </p>
        <div className={`mt-3 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: mcp }} />
        <p className={prose}>
          {t({
            en: (
              <>
                The name is <code className={mono}>reviser</code> of the tools&apos; context, for a server that knows who the assistant works for.
              </>
            ),
            es: (
              <>
                El nombre es <code className={mono}>reviser</code> del contexto de las herramientas, para un servidor que sabe para quién trabaja el asistente.
              </>
            ),
            zh: (
              <>
                署名取自工具上下文的 <code className={mono}>reviser</code>，适用于知道 AI 助手在为谁工作的服务器。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="checked-against-word" className="mt-24">
        <SectionHead id="checked-against-word" badge="Word" color="blue" title={t({ en: 'Checked against Word', es: 'Comprobado con Word', zh: '与 Word 对照验证' })} />
        <p className={prose}>
          {t({
            en: 'Documents with insertions, deletions, a split paragraph and a joined one were opened in Word for Mac. Word found the same changes, by the same authors. Accepting all of them, and rejecting all of them, gave the same text in Word as here. Changes made in Word read back the same way, and a file opened and saved without changes keeps its XML.',
            es: 'Se abrieron en Word para Mac documentos con inserciones, eliminaciones, un párrafo dividido y uno unido. Word encontró los mismos cambios, de los mismos autores. Aceptarlos todos, y rechazarlos todos, dio el mismo texto en Word que aquí. Los cambios hechos en Word se leen de vuelta igual, y un archivo abierto y guardado sin cambios conserva su XML.',
            zh: '我们在 Mac 版 Word 中打开了包含插入、删除、拆分段落和合并段落的文档。Word 找到了相同的修订，作者也相同。全部接受和全部拒绝后，Word 中的文字与这里完全一致。在 Word 中做的修订读回来也一样，打开后未作修改就保存的文件会保留原有的 XML。',
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                Text one person put in and another took out was checked in Word for Mac too: Word keeps it, a <code className={mono}>w:del</code> inside the <code className={mono}>w:ins</code>, as it
                is written here. So were changes of formatting and rows taken out, which Word lists by the same people.
              </>
            ),
            es: (
              <>
                El texto que una persona puso y otra quitó también se comprobó en Word para Mac: Word lo conserva, un <code className={mono}>w:del</code> dentro del <code className={mono}>w:ins</code>
                , como se escribe aquí. También los cambios de formato y las filas quitadas, que Word lista con las mismas personas.
              </>
            ),
            zh: (
              <>
                一个人插入、另一个人删除的文字也在 Mac 版 Word 中验证过：Word 会保留它，即 <code className={mono}>w:ins</code> 中嵌套 <code className={mono}>w:del</code>
                ，与这里的写法相同。格式更改和删除的表格行也验证过，Word 列出的作者相同。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                A document that does not say its language has Word give every run the one it guesses when it opens it, and with changes tracked, that is a change of formatting of every run by whoever
                opened it. The DOCX the editor makes says it: the <code className={mono}>language</code> prop, or the language of the interface with the browser&apos;s region.
              </>
            ),
            es: (
              <>
                A un documento que no dice su idioma, Word le da a cada run el que adivina al abrirlo, y con el control activado, eso es un cambio de formato de cada run por quien lo abrió. El DOCX
                que hace el editor lo dice: la prop <code className={mono}>language</code>, o el idioma de la interfaz con la región del navegador.
              </>
            ),
            zh: (
              <>
                如果文档没有声明语言，Word 打开时会给每个 run 设置它猜测的语言；开启修订时，这就变成了打开者对每个 run 的格式更改。编辑器生成的 DOCX 会声明语言：取自{' '}
                <code className={mono}>language</code> 属性，或界面语言加上浏览器的地区。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge={t({ en: 'Limits', es: 'Límites', zh: '限制' })} color="yellow" title={t({ en: 'What it does not do', es: 'Lo que no hace', zh: '不支持的内容' })} />
        <ul className="m-0 mt-5 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-x-8 gap-y-3 p-0">
          {[
            t({
              en: 'Rows of a table are tracked, put in and taken out. Columns and merged or split cells change untracked, as in Word: there, a column put in or taken out is only a change of the widths of the table, and taking it back gives the widths, not the column.',
              es: 'Las filas de una tabla se controlan, puestas y quitadas. Las columnas y las celdas combinadas o divididas cambian sin control, como en Word: allí, una columna puesta o quitada es solo un cambio de los anchos de la tabla, y deshacerla devuelve los anchos, no la columna.',
              zh: '表格行的插入和删除会记录为修订。列以及合并或拆分单元格的更改不记录为修订，与 Word 相同：在 Word 中，插入或删除列只是表格宽度的更改，撤回它恢复的是宽度，而不是列。',
            }),
            t({
              en: 'Moves Word made are read, shown in green and decided both halves together. Written back, a paragraph changed here carries its move as text taken out and text put in; moving text here, cutting and pasting it, is the same.',
              es: 'Los movimientos que hizo Word se leen, se muestran en verde y se deciden sus dos mitades juntas. Al escribirse de vuelta, un párrafo cambiado aquí lleva su movimiento como texto quitado y texto puesto; mover texto aquí, cortándolo y pegándolo, es lo mismo.',
              zh: 'Word 生成的移动会被读取，以绿色显示，两部分一起处理。写回时，在这里修改过的段落会把其中的移动记为删除和插入；在这里移动文字（剪切再粘贴）也是如此。',
            }),
            t({
              en: 'Shown with every change accepted, or with none, the document is only to be looked at: to edit, show the changes again.',
              es: 'Mostrado con todos los cambios aceptados, o con ninguno, el documento es solo para mirar: para editar, vuelve a mostrar los cambios.',
              zh: '显示全部接受或原始状态时，文档只能查看：要编辑，请重新显示修订。',
            }),
            t({
              en: 'A paragraph break someone else put in, taken out, goes for good; their text stays, taken out.',
              es: 'Un salto de párrafo que puso otra persona, al quitarlo, se va del todo; su texto se queda, quitado.',
              zh: '删除别人插入的分段符时，它会被彻底删除；对方插入的文字保留，并标为删除。',
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
