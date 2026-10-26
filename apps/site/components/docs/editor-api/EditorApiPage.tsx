import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import type { L } from '@/lib/i18n';
import { getT, pageLocale } from '@/lib/locale';
import { REPO } from '@/lib/site';
import { CODE, LINK } from '../styles';
import { Callout, HandTip, SectionHead } from '../ui';
import { GROUPS, TYPES } from './data';
import { Points } from './Points';
import { LazyConsole, Reference } from './Reference';
import { say } from './texts';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** The three ways to the Editor, one for each way of using Rebodocs. */
const WAYS: [title: L, when: L, lang: string, code: string][] = [
  [
    { en: 'Without React', es: 'Sin React', zh: '不使用 React' },
    { en: 'The editor alone, in an element of yours.', es: 'El editor solo, en un elemento tuyo.', zh: '单独使用编辑器，放在你自己的元素中。' },
    'ts',
    `import { Editor } from '@rebodocs/editor';

const editor = new Editor(element);
editor.loadDocx(bytes);`,
  ],
  [
    { en: 'Your own interface', es: 'Tu propia interfaz', zh: '你自己的界面' },
    { en: 'Inside a DocsProvider, from the hook.', es: 'Dentro de un DocsProvider, desde el hook.', zh: '在 DocsProvider 内，通过 hook 获取。' },
    'tsx',
    `const { editor } = useDocs();

editor?.toggleMark('bold');`,
  ],
  [
    { en: 'The whole editor', es: 'El editor completo', zh: '完整的编辑器' },
    { en: 'From the handle of DocsEditor.', es: 'Desde el handle de DocsEditor.', zh: '通过 DocsEditor 的 handle 获取。' },
    'tsx',
    `const docs = useRef<DocsHandle>(null);
<DocsEditor ref={docs} docx={file} />

docs.current?.editor.find('deposit');`,
  ],
];

/**
 * "Editor API": the methods of the Editor, run on a real one at the top of
 * the page, and every member below by what it is for.
 */
export async function EditorApiPage() {
  const t = getT();
  const locale = pageLocale();
  const ways = await Promise.all(WAYS.map(([, , lang, code]) => highlight(code, lang, LIGHT_THEME)));
  const editCode = await highlight(
    `import { fillVariables } from '@rebodocs/core';

// A function of core, on the editor's document, as one step to undo.
editor.edit((doc) => fillVariables(doc, { client: 'Ana López' }));`,
    'ts',
    LIGHT_THEME,
  );
  const listenCode = await highlight(
    `let last = editor.doc;
let timer: ReturnType<typeof setTimeout>;

const stop = editor.onChange(() => {
  if (editor.doc === last) return;     // only the selection or the view moved
  last = editor.doc;                   // a new object: the document changed
  clearTimeout(timer);
  timer = setTimeout(() => save(editor.exportDocx()), 1000);
});

// later, when the editor goes away
stop();`,
    'ts',
    LIGHT_THEME,
  );
  const members = GROUPS.reduce((n, group) => n + group.members.reduce((m, member) => m + member.sigs.length, 0), 0);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">Editor API</h1>
      <p className="m-0 mt-3.5 max-w-[680px] text-lg leading-[1.6] text-muted">
        {t({
          en: (
            <>
              The <code className="rounded-[5px] bg-hover px-1.5 py-0.5 font-code text-[15px] text-ink">Editor</code> is what everything else talks to: the toolbar, the hooks, an assistant. Here it
              is, running, with {members} of its members described below.
            </>
          ),
          es: (
            <>
              El <code className="rounded-[5px] bg-hover px-1.5 py-0.5 font-code text-[15px] text-ink">Editor</code> es con lo que habla todo lo demás: la barra de herramientas, los hooks, un
              asistente. Aquí está, funcionando, con {members} de sus miembros descritos abajo.
            </>
          ),
          zh: (
            <>
              <code className="rounded-[5px] bg-hover px-1.5 py-0.5 font-code text-[15px] text-ink">Editor</code> 是其他一切与之交互的对象：工具栏、hooks、AI
              助手。这里有一个正在运行的实例，下面介绍了它的 {members} 个成员。
            </>
          ),
        })}
      </p>
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: press ⌘K and type a method', es: 'consejo: pulsa ⌘K y escribe un método', zh: '提示：按 ⌘K 并输入方法名' })}</HandTip>
      </div>

      <section aria-labelledby="get" className="mt-16">
        <SectionHead id="get" badge={t({ en: 'Start here', es: 'Empieza aquí', zh: '从这里开始' })} color="blue" title={t({ en: 'Getting the editor', es: 'Obtener el editor', zh: '获取编辑器' })}>
          {t({ en: 'The same object, whichever way you use Rebodocs.', es: 'El mismo objeto, uses Rebodocs como lo uses.', zh: '无论以哪种方式使用 Rebodocs，得到的都是同一个对象。' })}
        </SectionHead>
        <div className="mt-7 flex flex-col gap-3">
          {WAYS.map(([title, when], i) => (
            <div key={title.en} className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-border p-5">
              <div className="flex-[1_1_200px]">
                <p className="m-0 font-display text-base font-bold tracking-[-0.01em]">{t(title)}</p>
                <p className="m-0 mt-1 text-[15px] text-ink-soft">{t(when)}</p>
              </div>
              <div className={`min-w-0 flex-[3_1_420px] ${CODE}`} dangerouslySetInnerHTML={{ __html: ways[i] }} />
            </div>
          ))}
        </div>
        <Callout title={t({ en: 'Each call is one step to undo.', es: 'Cada llamada es un paso para deshacer.', zh: '每次调用都是一个可撤销的步骤。' })}>
          {t({
            en: (
              <>
                Methods change the document the way a person would, and ⌘Z takes each back. To change it with the functions of <code className={mono}>@rebodocs/core</code>, which take a{' '}
                <code className={mono}>Doc</code> and give another, hand them to <code className={mono}>edit</code>:
              </>
            ),
            es: (
              <>
                Los métodos cambian el documento como lo haría una persona, y ⌘Z deshace cada uno. Para cambiarlo con las funciones de <code className={mono}>@rebodocs/core</code>, que toman un{' '}
                <code className={mono}>Doc</code> y dan otro, pásaselas a <code className={mono}>edit</code>:
              </>
            ),
            zh: (
              <>
                这些方法像用户操作一样修改文档，⌘Z 可以逐个撤销。要用 <code className={mono}>@rebodocs/core</code> 的函数（接收一个 <code className={mono}>Doc</code>{' '}
                并返回另一个）修改文档，请把它们交给 <code className={mono}>edit</code>：
              </>
            ),
          })}
        </Callout>
        <div className={`mt-3 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: editCode }} />
      </section>

      <section aria-labelledby="try" className="mt-24">
        <SectionHead
          id="try"
          badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })}
          color="green"
          title={t({ en: 'Try it on a real editor', es: 'Pruébalo en un editor real', zh: '在真实编辑器上试试' })}
        >
          {t({
            en: 'The sample document in the editor itself, with no toolbar: each button runs the method it shows, and the values under it are read from the editor after each change. Click and type in the page too.',
            es: 'El documento de ejemplo en el propio editor, sin barra de herramientas: cada botón ejecuta el método que muestra, y los valores de debajo se leen del editor tras cada cambio. Haz clic y escribe en la página también.',
            zh: '编辑器本身中的示例文档，没有工具栏：每个按钮运行它显示的方法，下方的值在每次更改后从编辑器读取。也可以在页面中点击和输入。',
          })}
        </SectionHead>
        <LazyConsole />
        <p className={prose}>
          {t({
            en: (
              <>
                Positions are <code className={mono}>{'{ para, offset }'}</code>: the index of a paragraph, and of a character in it. Click in the page and watch{' '}
                <code className={mono}>selection</code>: the anchor is where the selection started, the focus where it ends, so dragging backwards puts the focus first;{' '}
                <code className={mono}>range</code> gives them in order.
              </>
            ),
            es: (
              <>
                Las posiciones son <code className={mono}>{'{ para, offset }'}</code>: el índice de un párrafo, y de un carácter en él. Haz clic en la página y mira{' '}
                <code className={mono}>selection</code>: el anchor es donde empezó la selección, el focus donde termina, así que arrastrar hacia atrás pone primero el focus;{' '}
                <code className={mono}>range</code> los da en orden.
              </>
            ),
            zh: (
              <>
                位置为 <code className={mono}>{'{ para, offset }'}</code>：段落的索引，以及字符在段落中的索引。在页面中点击并观察 <code className={mono}>selection</code>：anchor
                是选区开始的位置，focus 是结束的位置，因此向后拖动时 focus 在前；<code className={mono}>range</code> 则按顺序给出。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="changes" className="mt-24">
        <SectionHead
          id="changes"
          badge={t({ en: 'Listening', es: 'Escuchar', zh: '监听' })}
          color="yellow"
          title={t({ en: 'Knowing when it changes', es: 'Saber cuándo cambia', zh: '得知何时发生变化' })}
        >
          {t({
            en: (
              <>
                One listener for everything: <code className={mono}>onChange</code> is called when the document changes, when the selection moves and when the view does.
              </>
            ),
            es: (
              <>
                Un solo listener para todo: <code className={mono}>onChange</code> se llama cuando cambia el documento, cuando se mueve la selección y cuando lo hace la vista.
              </>
            ),
            zh: (
              <>
                一个监听器处理所有情况：文档变化、选区移动以及视图变化时都会调用 <code className={mono}>onChange</code>。
              </>
            ),
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: (
              <>
                To tell them apart, compare <code className={mono}>editor.doc</code> with the one you had. The document is never changed in place: each change makes a new one, so{' '}
                <code className={mono}>!==</code> is enough, and costs nothing. The editor above counts both kinds as you use it.
              </>
            ),
            es: (
              <>
                Para distinguirlos, compara <code className={mono}>editor.doc</code> con el que tenías. El documento nunca se cambia en su sitio: cada cambio hace uno nuevo, así que{' '}
                <code className={mono}>!==</code> basta, y no cuesta nada. El editor de arriba cuenta ambos tipos mientras lo usas.
              </>
            ),
            zh: (
              <>
                要区分它们，把 <code className={mono}>editor.doc</code> 与你之前保存的比较即可。文档从不原地修改：每次更改都会生成新对象，因此用 <code className={mono}>!==</code>{' '}
                就足够了，几乎没有开销。上面的编辑器会在你使用时统计这两类变化。
              </>
            ),
          })}
        </p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: listenCode }} />
        <p className={prose}>
          {t({
            en: (
              <>
                In React, <code className={mono}>useDocs().state</code> already does this for what a toolbar shows, with <code className={mono}>state.dirty</code> for “not saved yet”; see{' '}
                <LocalLink href="/docs/components/#hooks" className={LINK}>
                  hooks
                </LocalLink>
                . Why a new object each time is cheap is told in{' '}
                <LocalLink href="/docs/architecture/#value" className={LINK}>
                  how it works
                </LocalLink>
                .
              </>
            ),
            es: (
              <>
                En React, <code className={mono}>useDocs().state</code> ya hace esto para lo que muestra una barra de herramientas, con <code className={mono}>state.dirty</code> para “sin guardar
                todavía”; mira{' '}
                <LocalLink href="/docs/components/#hooks" className={LINK}>
                  hooks
                </LocalLink>
                . Por qué un objeto nuevo cada vez sale barato se cuenta en{' '}
                <LocalLink href="/docs/architecture/#value" className={LINK}>
                  cómo funciona
                </LocalLink>
                .
              </>
            ),
            zh: (
              <>
                在 React 中，<code className={mono}>useDocs().state</code> 已经为工具栏显示的内容做了这件事，并用 <code className={mono}>state.dirty</code> 表示“尚未保存”；参见
                <LocalLink href="/docs/components/#hooks" className={LINK}>
                  hooks
                </LocalLink>
                。为什么每次生成新对象开销很小，参见
                <LocalLink href="/docs/architecture/#value" className={LINK}>
                  工作原理
                </LocalLink>
                。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="reference" className="mt-24">
        <SectionHead
          id="reference"
          badge={t({ en: 'Reference', es: 'Referencia', zh: '参考' })}
          color="purple"
          title={t({ en: 'Every member, by what it is for', es: 'Todos los miembros, por para qué sirven', zh: '全部成员（按用途分组）' })}
        >
          {t({
            en: 'The ones marked “Run it” run on the editor above. The class has a few more, for the collaboration session; its source, ',
            es: 'Los marcados con “Ejecútalo” se ejecutan en el editor de arriba. La clase tiene unos pocos más, para la sesión de colaboración; su código, ',
            zh: '标有“运行”的成员会在上面的编辑器上运行。该类还有几个用于协作会话的成员；它的源码 ',
          })}
          <a href={`${REPO}/blob/main/packages/editor/src/editor.ts`} className={LINK}>
            packages/editor/src/editor.ts
          </a>
          {t({ en: ', documents every public member.', es: ', documenta todos los miembros públicos.', zh: ' 记录了所有公开成员。' })}
        </SectionHead>
        <Reference />
      </section>

      <section aria-labelledby="types" className="mt-24">
        <SectionHead id="types" badge={t({ en: 'Reference', es: 'Referencia', zh: '参考' })} color="blue" title={t({ en: 'Types', es: 'Tipos', zh: '类型' })}>
          {t({
            en: (
              <>
                What the methods take, as <code className={mono}>@rebodocs/core</code> defines them; <code className={mono}>@rebodocs/react</code> exports them as types too. A field whose name ends in
                ? may be left out.
              </>
            ),
            es: (
              <>
                Lo que toman los métodos, como los define <code className={mono}>@rebodocs/core</code>; <code className={mono}>@rebodocs/react</code> también los exporta como tipos. Un campo cuyo
                nombre termina en ? se puede omitir.
              </>
            ),
            zh: (
              <>
                方法接收的类型，按 <code className={mono}>@rebodocs/core</code> 的定义；<code className={mono}>@rebodocs/react</code> 也导出了这些类型。名称以 ? 结尾的字段可以省略。
              </>
            ),
          })}
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] gap-4">
          {TYPES.map((type) => (
            <div key={type.name} id={`type-${type.name}`} className="scroll-mt-24 rounded-2xl border border-border p-5 target:border-brand">
              <p className="m-0 flex items-baseline justify-between gap-3">
                <a href={`#type-${type.name}`} className="font-code text-[15px] font-semibold text-ink hover:text-brand">
                  {type.name}
                </a>
                <a href={`${REPO}/blob/main/packages/${type.from.includes('/') ? type.from : `core/src/${type.from}`}`} className="font-code text-xs text-muted hover:text-brand">
                  {type.from.includes('/') ? type.from : `core/src/${type.from}`}
                </a>
              </p>
              <p className="m-0 mt-1 text-[15px] leading-[1.55] text-ink-soft">{say(type.text, locale)}</p>
              <dl className="m-0 mt-3">
                {type.fields.map(([name, kind, text]) => (
                  <div key={name} className="border-t border-[#f0eee9] py-2">
                    <dt className="flex flex-wrap items-baseline gap-x-2 font-code text-[13px]">
                      <span className="font-semibold text-ink">{name}</span>
                      <span className="text-pastel-purple-fg">{kind}</span>
                    </dt>
                    {text && <dd className="m-0 mt-0.5 text-sm leading-normal text-muted">{say(text, locale)}</dd>}
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="points" className="mt-24">
        <SectionHead id="points" badge={t({ en: 'Good to know', es: 'Bueno saberlo', zh: '小知识' })} color="orange" title={t({ en: 'Points', es: 'Puntos', zh: '磅' })}>
          {t({
            en: 'Every length is in points, 1/72 of an inch, as in Word: page sizes, margins, indents, font sizes, row heights. Type a length in what you have, and set a page on the editor above.',
            es: 'Cada longitud va en puntos, 1/72 de pulgada, como en Word: tamaños de página, márgenes, sangrías, tamaños de fuente, altos de fila. Escribe una longitud en la unidad que tengas y fija una página en el editor de arriba.',
            zh: '所有长度都以磅为单位（1/72 英寸），与 Word 相同：纸张大小、页边距、缩进、字号、行高。用你手头的单位输入长度，然后在上面的编辑器中设置页面。',
          })}
        </SectionHead>
        <Points />
        <p className={prose}>
          {t({
            en: 'On screen at zoom 1, a point is 4/3 of a CSS pixel, so a picture put in from a file comes in at its size at 96 pixels to the inch: 800 pixels wide is 600 points, made smaller when it does not fit the page.',
            es: 'En pantalla a zoom 1, un punto es 4/3 de un píxel CSS, así que una imagen puesta desde un archivo entra a su tamaño a 96 píxeles por pulgada: 800 píxeles de ancho son 600 puntos, reducida cuando no cabe en la página.',
            zh: '在屏幕上缩放为 1 时，一磅等于 4/3 个 CSS 像素，因此从文件插入的图片按每英寸 96 像素的尺寸插入：800 像素宽即 600 磅，放不下页面时会缩小。',
          })}
        </p>
      </section>
    </>
  );
}
