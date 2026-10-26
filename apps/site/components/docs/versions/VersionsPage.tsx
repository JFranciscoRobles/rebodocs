import { compareDocs } from '@rebodocs/core';
import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { getT, pageLocale } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import CompareDemo from './CompareDemo';
import { Compared } from './Compared';
import { COMPARISON, CURRENT, FUNCTIONS, INFO, KEPT, MEMBERS } from './data';
import { LazyHistoryDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

function Fields({ rows }: { rows: { name: string; type: string; text: L }[] }) {
  const t = getT();
  return (
    <dl className="m-0 mt-4 max-w-[920px] rounded-2xl border border-border px-5">
      {rows.map((field) => (
        <div key={field.name} className="border-t border-[#f0eee9] py-3 first:border-t-0">
          <dt className="font-code text-[13.5px] text-ink">
            <span className="font-semibold">{field.name}</span>: <span className="text-muted">{field.type}</span>
          </dt>
          <dd className="m-0 mt-1 text-[15px] leading-normal text-ink-soft">{t(field.text)}</dd>
        </div>
      ))}
    </dl>
  );
}

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

/**
 * "Versions": the versions an application keeps, given to a real editor on the
 * page, compareDocs on texts typed here, what a shared room does, the tool of
 * an assistant and what a comparison leaves out.
 */
export async function VersionsPage() {
  const t = getT();
  // What changed from the last version of the demo to the document as it is now, worked out by compareDocs when the site is built.
  const kept = KEPT[pageLocale()];
  const example = compareDocs(kept[kept.length - 1].doc, CURRENT[pageLocale()]).doc;
  const [prop, core, mcp] = await Promise.all([
    highlight(
      `<DocsEditor
  docx={file}
  onSave={(docx) => upload(docx)}
  versions={{
    list: () => api.versions(documentId),
    load: (id) => api.version(documentId, id),
    save: (docx, { label, author }) => api.keepVersion(documentId, docx, label, author),
  }}
/>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { compareDocs, describeChange, importDocx, restoreVersion } from '@rebodocs/core';

const before = importDocx(earlierBytes);
const after = importDocx(laterBytes);
const { changes, notes, doc, marks } = compareDocs(before, after);

for (const change of changes) console.log(change.kind, change.part ?? 'text', describeChange(change));
// changed text   Payment is due within [-15-]{+30+} days of this receipt.

const back = restoreVersion(after, before);   // the document to put in place of after`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `5 changes from the file to the document; the numbers in brackets are those of this document's paragraphs:
[1] changed: Reservation receipt{+ for room 12+}
[3] same text, another look: Late payments add a fee of 2% a month.
[4] changed: Either party may cancel [-by phone or -]in writing.
(only in the file, its paragraph 5) taken out: [-Prices include taxes.-]
[5] put in: {+Keys are returned at the front desk.+}`,
      'bash',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{t({ en: 'Versions', es: 'Versiones', zh: '版本' })}</h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: 'A version is a copy of the document as it was at some moment, kept as a DOCX. Rebodocs does not store versions: your application keeps them wherever it keeps its documents. Rebodocs lists them, compares any two, and takes the document back to one.',
          es: 'Una versión es una copia del documento tal como estaba en algún momento, guardada como DOCX. Rebodocs no almacena versiones: tu aplicación las guarda donde guarde sus documentos. Rebodocs las lista, compara dos cualesquiera y lleva el documento de vuelta a una.',
          zh: '版本是文档在某一时刻的副本，以 DOCX 形式保存。Rebodocs 不存储版本：你的应用把它们保存在存放文档的地方。Rebodocs 负责列出版本、比较任意两个版本，并把文档还原到某个版本。',
        })}
      </p>
      <Compared paragraphs={example.paragraphs} className="mt-6 max-w-[760px] rounded-[10px] bg-surface px-5 py-4 text-[17px] leading-[1.6] text-ink" />
      <div className="mt-4">
        <HandTip>
          {t({
            en: 'tip: what changed since “Sent to the client”, compared below',
            es: 'consejo: lo que cambió desde “Enviado al cliente”, comparado abajo',
            zh: '提示：自“已发送给客户”以来的更改，下面可以比较',
          })}
        </HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'Your versions', es: 'Tus versiones', zh: '你的版本' })}>
          {t({
            en: (
              <>
                A real editor, given two versions this page keeps in memory as your server would keep them. Open <strong>See changes</strong> on one, go from change to change, look at it unmarked, or{' '}
                <strong>Restore</strong> it; keep a version of your own with a name.
              </>
            ),
            es: (
              <>
                Un editor real, con dos versiones que esta página guarda en memoria como las guardaría tu servidor. Abre <strong>Ver cambios</strong> en una, ve de cambio en cambio, mírala sin marcar
                o <strong>Restáurala</strong>; guarda una versión propia con un nombre.
              </>
            ),
            zh: (
              <>
                一个真实的编辑器，带有两个版本，由本页像你的服务器那样保存在内存中。对某个版本打开<strong>查看更改</strong>，逐个浏览更改，查看不标记的样子，或者<strong>还原</strong>
                它；也可以用一个名称保存你自己的版本。
              </>
            ),
          })}
        </SectionHead>
        <LazyHistoryDemo />
        <p className={prose}>
          {t({
            en: (
              <>
                Compare with “First draft” and pick the other version under <em>To</em>: two versions compare as well as a version and the document. A line made bold is a change of look: listed, but
                the line is not marked.
              </>
            ),
            es: (
              <>
                Compara con “Primer borrador” y elige la otra versión en <em>Hasta</em>: dos versiones se comparan igual que una versión y el documento. Una línea puesta en negrita es un cambio de
                aspecto: se lista, pero la línea no se marca.
              </>
            ),
            zh: (
              <>
                与“初稿”比较，并在<em>到</em>下选择另一个版本：两个版本之间可以比较，版本与文档之间也可以。设为加粗的一行属于格式更改：会列出，但该行不会被标记。
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
                Give the component your versions, and the side panel gets a <strong>Versions</strong> tab, the newest first.
              </>
            ),
            es: (
              <>
                Dale tus versiones al componente y el panel lateral tendrá una pestaña <strong>Versiones</strong>, con la más nueva primero.
              </>
            ),
            zh: (
              <>
                把你的版本交给组件，侧边面板就会多出一个<strong>版本</strong>选项卡，最新的排在最前。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: prop }} />
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
          {[
            {
              title: t({ en: 'See changes', es: 'Ver cambios', zh: '查看更改' }),
              color: 'blue' as const,
              text: t({
                en: 'Over the pages, what changed from that version to the document as it is now, or to another version. Taken out struck through in red where it was, put in underlined in green. The document under it is not touched.',
                es: 'Sobre las páginas, lo que cambió de esa versión al documento tal como está, o a otra versión. Lo quitado, tachado en rojo donde estaba; lo puesto, subrayado en verde. El documento de debajo no se toca.',
                zh: '在页面上显示从该版本到当前文档（或另一个版本）的更改。删除的内容在原位置以红色删除线显示，插入的内容以绿色下划线显示。底下的文档不会被改动。',
              }),
            },
            {
              title: t({ en: 'Restore', es: 'Restaurar', zh: '还原' }),
              color: 'purple' as const,
              text: t({
                en: 'The version in place of the document, as one change: undo leaves it as it was. From the list, or from the comparison.',
                es: 'La versión en lugar del documento, como un solo cambio: deshacer lo deja como estaba. Desde la lista o desde la comparación.',
                zh: '用该版本替换文档，作为一次更改：撤销即可恢复原样。可以从列表或比较视图中操作。',
              }),
            },
            {
              title: t({ en: 'Save version', es: 'Guardar versión', zh: '保存版本' }),
              color: 'pink' as const,
              text: t({
                en: 'With save, keeps the document as it is now, with an optional name, signed with the author of the editor. Enter in the name saves it too.',
                es: 'Con save, guarda el documento tal como está, con un nombre opcional, firmado con el autor del editor. Enter en el nombre también lo guarda.',
                zh: '提供 save 时，以可选的名称保存文档当前的状态，并署上编辑器的作者。在名称框中按 Enter 也会保存。',
              }),
            },
          ].map((card) => (
            <div key={card.color} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
        <h3 id="versions-prop" className="m-0 mt-12 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          {t({ en: 'The versions prop', es: 'La prop versions', zh: 'versions 属性' })}
        </h3>
        <Signatures rows={MEMBERS} />
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">VersionInfo</h3>
        <Fields rows={INFO} />
        <h3 id="comparison-keys" className="m-0 mt-10 scroll-mt-24 font-display text-xl font-bold tracking-[-0.01em]">
          {t({ en: 'In the comparison', es: 'En la comparación', zh: '在比较视图中' })}
        </h3>
        <dl className="m-0 mt-4 max-w-[920px] rounded-2xl border border-border px-5">
          {[
            [
              '‹ ›, Alt+↑ Alt+↓',
              t({
                en: 'From one change to the next, as in Word’s comparison.',
                es: 'De un cambio al siguiente, como en la comparación de Word.',
                zh: '从一处更改跳到下一处，与 Word 的比较功能相同。',
              }),
            ],
            [
              t({ en: 'With the changes marked · Unmarked', es: 'Con los cambios marcados · Sin marcar', zh: '标记更改 · 不标记' }),
              t({
                en: 'The later version marked, or the earlier one as it was.',
                es: 'La versión posterior marcada, o la anterior tal como era.',
                zh: '显示标记了更改的较新版本，或原样显示较早的版本。',
              }),
            ],
            [
              t({ en: 'From · To', es: 'Desde · Hasta', zh: '从 · 到' }),
              t({
                en: 'The two versions compared; To is the current document unless another is picked.',
                es: 'Las dos versiones comparadas; Hasta es el documento actual salvo que se elija otra.',
                zh: '参与比较的两个版本；除非另选，“到”就是当前文档。',
              }),
            ],
            ['Esc', t({ en: 'Closes it, and gives the keyboard back to where it was.', es: 'La cierra y devuelve el teclado a donde estaba.', zh: '关闭比较视图，并把键盘焦点还给原来的位置。' })],
          ].map(([key, text]) => (
            <div key={key} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[260px_1fr]">
              <dt className="text-[15px] font-semibold text-ink">{key}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{text}</dd>
            </div>
          ))}
        </dl>
        <p className={prose}>
          {t({
            en: 'The count says how many changes there are in the text, how many in headers, footers, notes at the foot of the page and text boxes, and how many notes on the text were written, taken out or changed. The document compared is the one a save would write: what a DOCX cannot hold is no change.',
            es: 'El recuento dice cuántos cambios hay en el texto, cuántos en encabezados, pies de página, notas al pie y cuadros de texto, y cuántas notas sobre el texto se escribieron, quitaron o cambiaron. El documento comparado es el que escribiría un guardado: lo que un DOCX no puede contener no es un cambio.',
            zh: '计数会说明正文中有多少处更改，页眉、页脚、脚注和文本框中各有多少处，以及有多少批注被新增、删除或修改。参与比较的文档就是保存时会写出的文档：DOCX 无法容纳的内容不算更改。',
          })}
        </p>
      </section>

      <section aria-labelledby="in-code" className="mt-24">
        <SectionHead id="in-code" badge="@rebodocs/core" color="orange" title={t({ en: 'In code', es: 'En código', zh: '在代码中' })}>
          {t({
            en: 'Any two versions, on a server or in the browser: paragraph by paragraph, and word by word inside one that changed. Change either text below.',
            es: 'Dos versiones cualesquiera, en un servidor o en el navegador: párrafo por párrafo, y palabra por palabra dentro de uno que cambió. Cambia cualquiera de los textos de abajo.',
            zh: '任意两个版本，在服务器或浏览器中均可：逐段比较，在有变化的段落内再逐词比较。试着修改下面任意一段文字。',
          })}
        </SectionHead>
        <CompareDemo />
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: core }} />
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">Comparison</h3>
        <Fields rows={COMPARISON} />
        <h3 className="m-0 mt-10 font-display text-xl font-bold tracking-[-0.01em]">{t({ en: 'The functions', es: 'Las funciones', zh: '函数' })}</h3>
        <Signatures rows={FUNCTIONS} />
        <p className={prose}>
          {t({
            en: (
              <>
                A version with tracked changes is compared as if they were all accepted, as Word compares: what someone took out and nobody decided on is not counted as there.{' '}
                <code className={mono}>editor.readOnly = true</code> makes an editor for reading only, which is how the comparison is shown.
              </>
            ),
            es: (
              <>
                Una versión con cambios con control se compara como si todos estuvieran aceptados, como compara Word: lo que alguien quitó y nadie decidió no cuenta como presente.{' '}
                <code className={mono}>editor.readOnly = true</code> hace un editor solo para leer, que es como se muestra la comparación.
              </>
            ),
            zh: (
              <>
                带有修订的版本会按全部接受后的状态比较，与 Word 的比较方式相同：有人删除但尚未处理的内容不计入。<code className={mono}>editor.readOnly = true</code>{' '}
                会让编辑器只读，比较视图就是这样显示的。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="in-a-real-time-document" className="mt-24">
        <SectionHead
          id="in-a-real-time-document"
          badge={t({ en: 'Collaboration', es: 'Colaboración', zh: '协作' })}
          color="purple"
          title={t({ en: 'In a real-time document', es: 'En un documento en tiempo real', zh: '在实时文档中' })}
        />
        <p className={prose}>
          {t({
            en: 'Restoring a version in a shared room sends the others only what changed, as any other edit does: paragraphs that are the same in both stay as they are, and the pictures of the version travel with it.',
            es: 'Restaurar una versión en una sala compartida envía a los demás solo lo que cambió, como cualquier otra edición: los párrafos iguales en ambas se quedan como están, y las imágenes de la versión viajan con ella.',
            zh: '在共享房间中还原版本时，只会把变化的部分发送给其他人，与其他编辑一样：两者相同的段落保持不变，版本中的图片会随之传送。',
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                The collaboration server keeps no versions. With <code className={mono}>--backend</code>, your system receives each save (<code className={mono}>PUT url/&lt;id&gt;</code>), and the
                last one of a session of work, when everybody has left, says so with <code className={mono}>X-Rebodocs-Session-End: 1</code> and names who changed the document in{' '}
                <code className={mono}>X-Rebodocs-Authors</code>: the moment to keep a version, signed by them. See{' '}
                <LocalLink href="/docs/collaboration/#a-version-for-each-session" className={LINK}>
                  a version for each session
                </LocalLink>
                .
              </>
            ),
            es: (
              <>
                El servidor de colaboración no guarda versiones. Con <code className={mono}>--backend</code>, tu sistema recibe cada guardado (<code className={mono}>PUT url/&lt;id&gt;</code>), y el
                último de una sesión de trabajo, cuando todos se han ido, lo dice con <code className={mono}>X-Rebodocs-Session-End: 1</code> y nombra a quienes cambiaron el documento en{' '}
                <code className={mono}>X-Rebodocs-Authors</code>: el momento de guardar una versión, firmada por ellos. Mira{' '}
                <LocalLink href="/docs/collaboration/#a-version-for-each-session" className={LINK}>
                  una versión por cada sesión
                </LocalLink>
                .
              </>
            ),
            zh: (
              <>
                协作服务器不保存版本。使用 <code className={mono}>--backend</code> 时，你的系统会收到每次保存（<code className={mono}>PUT url/&lt;id&gt;</code>
                ）；一次工作会话的最后一次保存（所有人都离开时）会带上 <code className={mono}>X-Rebodocs-Session-End: 1</code>，并在 <code className={mono}>X-Rebodocs-Authors</code>{' '}
                中列出修改过文档的人：这正是保存一个由他们署名的版本的时机。参见
                <LocalLink href="/docs/collaboration/#a-version-for-each-session" className={LINK}>
                  每次会话一个版本
                </LocalLink>
                。
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
                The{' '}
                <LocalLink href="/docs/assistants/" className={LINK}>
                  MCP server
                </LocalLink>{' '}
                has <code className={mono}>compare_documents</code>: what changed between the open document and another version of it in a file, by the numbers of the document&apos;s paragraphs, and
                the notes on the text written, taken out or changed.
              </>
            ),
            es: (
              <>
                El{' '}
                <LocalLink href="/docs/assistants/" className={LINK}>
                  servidor MCP
                </LocalLink>{' '}
                tiene <code className={mono}>compare_documents</code>: lo que cambió entre el documento abierto y otra versión suya en un archivo, por los números de los párrafos del documento, y las
                notas sobre el texto escritas, quitadas o cambiadas.
              </>
            ),
            zh: (
              <>
                <LocalLink href="/docs/assistants/" className={LINK}>
                  MCP 服务器
                </LocalLink>
                提供 <code className={mono}>compare_documents</code>：按文档段落编号列出已打开的文档与文件中另一版本之间的更改，以及新增、删除或修改的批注。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: mcp }} />
        <p className={prose}>
          {t({
            en: (
              <>
                The file is the earlier version unless <code className={mono}>file_is</code> is <code className={mono}>&quot;later&quot;</code>. It lists at most 200 changes; the tool changes nothing.
              </>
            ),
            es: (
              <>
                El archivo es la versión anterior salvo que <code className={mono}>file_is</code> sea <code className={mono}>&quot;later&quot;</code>. Lista como mucho 200 cambios; la herramienta no
                cambia nada.
              </>
            ),
            zh: (
              <>
                除非 <code className={mono}>file_is</code> 为 <code className={mono}>&quot;later&quot;</code>，否则文件视为较早的版本。最多列出 200 处更改；该工具不会修改任何内容。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="the-storage-demo" className="mt-24">
        <SectionHead id="the-storage-demo" badge="Demo" color="green" title={t({ en: 'The storage demo', es: 'El demo de almacenamiento', zh: '存储演示' })} />
        <p className={prose}>
          {t({
            en: (
              <>
                <LocalLink href="/docs/storage/" className={LINK}>
                  The storage demo
                </LocalLink>{' '}
                keeps a version each time a document is saved, as a file beside it under <code className={mono}>versions/&lt;document&gt;/</code>. Its key holds when it was kept, who kept it and its
                name, so one listing request gives them all.
              </>
            ),
            es: (
              <>
                <LocalLink href="/docs/storage/" className={LINK}>
                  El demo de almacenamiento
                </LocalLink>{' '}
                guarda una versión cada vez que se guarda un documento, como un archivo a su lado en <code className={mono}>versions/&lt;document&gt;/</code>. Su clave contiene cuándo se guardó, quién
                la guardó y su nombre, así que una sola petición de listado los da todos.
              </>
            ),
            zh: (
              <>
                <LocalLink href="/docs/storage/" className={LINK}>
                  存储演示
                </LocalLink>
                每次保存文档时都会保存一个版本，作为文件放在 <code className={mono}>versions/&lt;document&gt;/</code> 下。文件的键包含保存时间、保存者和名称，因此一次列表请求就能得到全部信息。
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
              en: 'A comparison is of what the document reads and how its text looks. It leaves out the page, the sections, the definitions of the styles and the size of a picture. Rows and columns of a table show only through the paragraphs of their cells.',
              es: 'Una comparación es de lo que dice el documento y de cómo se ve su texto. Deja fuera la página, las secciones, las definiciones de los estilos y el tamaño de una imagen. Las filas y columnas de una tabla solo se ven a través de los párrafos de sus celdas.',
              zh: '比较的是文档的内容和文字格式，不包括页面设置、分节、样式定义和图片尺寸。表格的行和列只通过其单元格中的段落体现。',
            }),
            t({
              en: 'A change of look, and a note on the text written, taken out or changed, is listed, but not marked in the comparison.',
              es: 'Un cambio de aspecto, y una nota sobre el texto escrita, quitada o cambiada, se lista, pero no se marca en la comparación.',
              zh: '格式更改以及新增、删除或修改的批注会被列出，但不会在比较视图中标记。',
            }),
            t({
              en: 'Paragraphs of a table that is gone are shown, struck through, where the table was, not inside a table.',
              es: 'Los párrafos de una tabla que ya no está se muestran tachados donde estaba la tabla, no dentro de una tabla.',
              zh: '已删除表格中的段落会以删除线显示在原表格位置，而不是显示在表格中。',
            }),
            t({
              en: 'A paragraph that changed is written back as an edit would write it; one that did not change keeps its own XML.',
              es: 'Un párrafo que cambió se vuelve a escribir como lo escribiría una edición; uno que no cambió conserva su propio XML.',
              zh: '有变化的段落会像编辑后那样重新写出；没有变化的段落保留其原有的 XML。',
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
