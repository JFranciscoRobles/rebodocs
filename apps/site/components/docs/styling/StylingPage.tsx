import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { getT } from '@/lib/locale';
import { type CssVar, RULER_VARS, SURFACE_VARS, THEMES, UI_VARS } from '../reference';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { LazyPiecesDemo, LazyThemeDemo } from './Lazy';

/** The examples of pieces of your own, by the name of their file: the code shown is the code that runs. */
const EXAMPLES = ['Toolbar', 'StatusBar', 'FindBar', 'Outline', 'SelectionBar', 'Ruler'];

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** The variables of one part, each with what it colours and what it is when not set. */
function Vars({ rows }: { rows: CssVar[] }) {
  const t = getT();
  const defaults = THEMES[0].vars;
  return (
    <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
      {rows.map(([name, what]) => (
        <div key={name} className="grid items-center gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[220px_1fr_auto]">
          <dt className="font-code text-[13.5px] font-semibold text-ink">{name}</dt>
          <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(what)}</dd>
          <dd className="m-0 flex items-center gap-2 font-code text-[12.5px] text-muted">
            <span
              aria-hidden="true"
              className="size-4 flex-none rounded border border-border-strong"
              style={name === '--dx-page-shadow' ? { background: '#fff', boxShadow: defaults[name] } : { background: defaults[name] }}
            />
            {defaults[name]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * "Styling and Tailwind": a real editor recoloured by the CSS variables; the
 * element the pages are in and its variables; the ruler's; an interface of
 * your own with the headless hooks; Tailwind; and the interface included.
 */
export async function StylingPage() {
  const t = getT();
  const examples = await Promise.all(
    EXAMPLES.map(async (name) => {
      const source = readFileSync(join(process.cwd(), 'components/docs/styling/examples', `${name}.tsx`), 'utf8').replace(/^'use client';\n\n/, '');
      return [name, await highlight(source, 'tsx', LIGHT_THEME)] as const;
    }),
  );
  const [surface, bold] = await Promise.all([
    highlight(`<DocsSurface className="h-full bg-neutral-100 dark:bg-neutral-900" />`, 'tsx', LIGHT_THEME),
    highlight(
      `function Bold() {
  const { state, commands } = useDocs();
  return (
    <button
      onClick={() => commands.toggleMark('bold')}
      aria-pressed={state.bold}
      className={\`rounded px-2 py-1 font-bold \${state.bold ? 'bg-blue-600 text-white' : 'hover:bg-neutral-100'}\`}
    >
      B
    </button>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {t({ en: 'Styling and Tailwind', es: 'Estilos y Tailwind', zh: '样式与 Tailwind' })}
      </h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: 'Two levels: recolour what comes with the editor with a few CSS variables, or draw the interface yourself with the headless hooks and whatever classes you like.',
          es: 'Dos niveles: recolorea lo que trae el editor con unas cuantas variables CSS, o dibuja la interfaz tú mismo con los hooks headless y las clases que quieras.',
          zh: '两个层次：用几个 CSS 变量为编辑器自带的界面换色，或者用 headless hooks 和你喜欢的任何类名自己绘制界面。',
        })}
      </p>
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: pick a theme below, then open a menu', es: 'tip: elige un tema abajo, luego abre un menú', zh: '提示：在下方选择一个主题，然后打开某个菜单' })}</HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'Recolour it', es: 'Cámbiale los colores', zh: '换个配色' })}>
          {t({
            en: 'The variables are set on the element the editor is in, and the editor reads them: the canvas, the ruler and every bar, menu and dialog of the interface included. Nothing else changes.',
            es: 'Las variables se fijan en el elemento donde está el editor, y el editor las lee: el lienzo, la regla y cada barra, menú y diálogo de la interfaz incluida. Nada más cambia.',
            zh: '变量设置在编辑器所在的元素上，编辑器会读取它们：画布、标尺，以及自带界面中的每个工具栏、菜单和对话框。其他一切保持不变。',
          })}
        </SectionHead>
        <LazyThemeDemo />
      </section>

      <section aria-labelledby="the-pages" className="mt-24">
        <SectionHead id="the-pages" badge={t({ en: 'Pages', es: 'Páginas', zh: '页面' })} color="blue" title={t({ en: 'The pages', es: 'Las páginas', zh: '页面' })}>
          {t({
            en: 'The element the pages are in takes classes like any other.',
            es: 'El elemento donde están las páginas acepta clases como cualquier otro.',
            zh: '页面所在的元素和其他元素一样可以添加类名。',
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: surface }} />
        <p className={prose}>
          {t({
            en: 'Its rule (the colour behind the pages, its height, that it scrolls) is in a CSS layer of its own, put before any other, so the utilities of a framework that keeps them in layers, as Tailwind 4 does, win over it. The rest of the editor’s styles are not in a layer: they are for elements inside it, which your classes do not reach.',
            es: 'Su regla (el color detrás de las páginas, su altura, que se desplace) está en una capa CSS propia, puesta antes que cualquier otra, así que las utilidades de un framework que las guarda en capas, como Tailwind 4, le ganan. El resto de los estilos del editor no están en una capa: son para elementos dentro de él, a los que tus clases no llegan.',
            zh: '它的规则（页面背后的颜色、高度、可滚动）放在一个独立的 CSS 层中，并排在所有层之前，因此像 Tailwind 4 这样把工具类放在层中的框架，其工具类会覆盖它。编辑器的其余样式不在层中：它们作用于编辑器内部的元素，你的类名不会触及。',
          })}
        </p>
        <Vars rows={SURFACE_VARS} />
        <p className={prose}>
          {t({
            en: 'The page itself is white because paper is: a document says what colour its text is, and it takes white behind it for granted.',
            es: 'La página en sí es blanca porque el papel lo es: un documento dice de qué color es su texto, y da por hecho que detrás hay blanco.',
            zh: '页面本身是白色的，因为纸张就是白色的：文档规定了文字的颜色，并默认文字背后是白色。',
          })}
        </p>
      </section>

      <section aria-labelledby="the-ruler" className="mt-24">
        <SectionHead id="the-ruler" badge={t({ en: 'Ruler', es: 'Regla', zh: '标尺' })} color="purple" title={t({ en: 'The ruler', es: 'La regla', zh: '标尺' })}>
          {t({
            en: 'Its own six, set on the same element or on any around it.',
            es: 'Sus propias seis, fijadas en el mismo elemento o en cualquiera que lo rodee.',
            zh: '标尺有自己的六个变量，可以设置在同一个元素或其任意祖先元素上。',
          })}
        </SectionHead>
        <Vars rows={RULER_VARS} />
      </section>

      <section aria-labelledby="the-included-interface" className="mt-24">
        <SectionHead
          id="the-included-interface"
          badge={t({ en: 'Interface', es: 'Interfaz', zh: '界面' })}
          color="orange"
          title={t({ en: 'The interface included', es: 'La interfaz incluida', zh: '自带的界面' })}
        >
          {t({
            en: 'The toolbar, the menus, the side panel, the status bar, the dialogs and the bar beside the selection take eleven variables. Not set, each is the colour it always was.',
            es: 'La barra de herramientas, los menús, el panel lateral, la barra de estado, los diálogos y la barra junto a la selección usan once variables. Sin fijar, cada una es el color que siempre fue.',
            zh: '工具栏、菜单、侧边栏、状态栏、对话框和选区旁的工具条共使用十一个变量。未设置时，各自保持默认颜色。',
          })}
        </SectionHead>
        <Vars rows={UI_VARS} />
        <p className={prose}>
          {t({
            en: (
              <>
                <strong>A dark theme comes with it.</strong> <code className={mono}>theme=&quot;dark&quot;</code> on <code className={mono}>DocsEditor</code> or{' '}
                <code className={mono}>DocsProvider</code> (<code className={mono}>editor.theme = &apos;dark&apos;</code> without React), or <code className={mono}>&apos;auto&apos;</code> to follow
                the system. It sets these variables to dark values whose text reads at 4.5:1, makes the tints of the menu and the reds that are not variables readable on dark, and is taken by the bars
                and menus shown outside the editor too. <code className={mono}>features=&#123;&#123; theme: true &#125;&#125;</code> puts the choice in the menu, for the person to make. A variable set
                on the element still wins over it.
              </>
            ),
            es: (
              <>
                <strong>Trae un tema oscuro.</strong> <code className={mono}>theme=&quot;dark&quot;</code> en <code className={mono}>DocsEditor</code> o <code className={mono}>DocsProvider</code> (
                <code className={mono}>editor.theme = &apos;dark&apos;</code> sin React), o <code className={mono}>&apos;auto&apos;</code> para seguir al sistema. Fija estas variables a valores
                oscuros cuyo texto se lee a 4.5:1, hace legibles sobre oscuro los tintes del menú y los rojos que no son variables, y lo toman también las barras y menús que se muestran fuera del
                editor. <code className={mono}>features=&#123;&#123; theme: true &#125;&#125;</code> pone la elección en el menú, para que la haga la persona. Una variable fijada en el elemento sigue
                ganándole.
              </>
            ),
            zh: (
              <>
                <strong>自带深色主题。</strong>在 <code className={mono}>DocsEditor</code> 或 <code className={mono}>DocsProvider</code> 上设置 <code className={mono}>theme=&quot;dark&quot;</code>
                （不用 React 时为 <code className={mono}>editor.theme = &apos;dark&apos;</code>），或设为 <code className={mono}>&apos;auto&apos;</code>{' '}
                跟随系统。它会把这些变量设为深色值，文字对比度保持 4.5:1，并让菜单中的色调以及非变量的红色在深色背景上清晰可读；编辑器之外显示的工具条和菜单也会使用它。
                <code className={mono}>features=&#123;&#123; theme: true &#125;&#125;</code> 会在菜单中提供该选项，由用户自行选择。在元素上设置的变量仍然优先。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                For a dark theme of your own, set <code className={mono}>color-scheme: dark</code> on the same element as well: the lists that drop down from a select and the scroll bars are the
                browser’s, and it draws them dark only when told. A text colour of the document is the document’s, and the page stays white.
              </>
            ),
            es: (
              <>
                Para un tema oscuro propio, fija también <code className={mono}>color-scheme: dark</code> en el mismo elemento: las listas que bajan de un select y las barras de desplazamiento son del
                navegador, y las dibuja oscuras solo cuando se le dice. Un color de texto del documento es del documento, y la página sigue blanca.
              </>
            ),
            zh: (
              <>
                如果要自定义深色主题，还需要在同一个元素上设置 <code className={mono}>color-scheme: dark</code>：select
                的下拉列表和滚动条由浏览器绘制，只有被告知时才会显示为深色。文档中的文字颜色属于文档本身，页面保持白色。
              </>
            ),
          })}
        </p>
        <div className="mt-7 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))' }}>
          {[
            {
              title: t({ en: 'For fingers', es: 'Para los dedos', zh: '适合手指' }),
              text: t({
                en: 'Where the pointer is a finger, the buttons grow: 38 pixels in the toolbar and the bar beside the selection, 34 in the status bar, 44 the items of the menu.',
                es: 'Donde el puntero es un dedo, los botones crecen: 38 píxeles en la barra de herramientas y en la barra junto a la selección, 34 en la barra de estado, 44 los elementos del menú.',
                zh: '用手指操作时按钮会变大：工具栏和选区工具条中为 38 像素，状态栏中为 34 像素，菜单项为 44 像素。',
              }),
              color: 'blue' as const,
            },
            {
              title: t({ en: 'High contrast', es: 'Alto contraste', zh: '高对比度' }),
              text: t({
                en: 'With the colours of the system forced on the page, as Windows does, what is on and what has the keyboard stay visible, whatever the theme.',
                es: 'Con los colores del sistema forzados en la página, como hace Windows, lo que está activo y lo que tiene el teclado siguen visibles, sea cual sea el tema.',
                zh: '当系统强制在页面上使用系统颜色时（例如 Windows 的做法），无论使用什么主题，激活项和拥有键盘焦点的元素都保持可见。',
              }),
              color: 'green' as const,
            },
            {
              title: t({ en: 'Contrast is yours', es: 'El contraste es tuyo', zh: '对比度由你负责' }),
              text: t({
                en: 'The default colours keep text at 4.5:1 or more. A theme of your own has to as well: check its text against its backgrounds.',
                es: 'Los colores predeterminados mantienen el texto a 4.5:1 o más. Un tema propio también debe hacerlo: comprueba su texto contra sus fondos.',
                zh: '默认颜色保证文字对比度不低于 4.5:1。你自己的主题也必须做到：请检查文字与背景的对比度。',
              }),
              color: 'yellow' as const,
            },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[card.color]}`}>{card.title}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="your-own-interface" className="mt-24">
        <SectionHead
          id="your-own-interface"
          badge={t({ en: 'Your UI', es: 'Tu interfaz', zh: '你的界面' })}
          color="yellow"
          title={t({ en: 'Pieces of your own', es: 'Piezas propias', zh: '自定义部件' })}
        >
          {t({ en: 'With the ', es: 'Con los ', zh: '借助' })}
          <LocalLink href="/docs/headless/" className={LINK}>
            {t({ en: 'headless hooks', es: 'hooks headless', zh: 'headless hooks' })}
          </LocalLink>
          {t({
            en: ' each piece is yours to draw, one at a time: a hook gives what to show and what to do, and the JSX and its classes are yours. Six of them, each on a real document, with its whole file under it.',
            es: ' cada pieza la dibujas tú, una a la vez: un hook da qué mostrar y qué hacer, y el JSX y sus clases son tuyos. Seis de ellas, cada una sobre un documento real, con su archivo completo debajo.',
            zh: '，每个部件都由你自己逐个绘制：hook 提供要显示的内容和可执行的操作，JSX 和类名由你决定。下面有六个例子，每个都作用于真实文档，完整文件附在下方。',
          })}
        </SectionHead>
        <LazyPiecesDemo code={Object.fromEntries(examples)} />
        <p className={prose}>{t({ en: 'The smallest of all, a button:', es: 'El más pequeño de todos, un botón:', zh: '最小的一个，就是一个按钮：' })}</p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: bold }} />
      </section>

      <section aria-labelledby="with-tailwind" className="mt-24">
        <SectionHead id="with-tailwind" badge="Tailwind" color="pink" title={t({ en: 'With Tailwind', es: 'Con Tailwind', zh: '配合 Tailwind' })}>
          {t({
            en: 'This site is Tailwind 4 in Next.js 16, with the editor in it. Nothing needs adding to the configuration.',
            es: 'Este sitio es Tailwind 4 en Next.js 16, con el editor dentro. No hace falta agregar nada a la configuración.',
            zh: '本网站使用 Next.js 16 和 Tailwind 4，并嵌入了编辑器。无需在配置中添加任何内容。',
          })}
        </SectionHead>
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          <li>
            {t({
              en: (
                <>
                  Tailwind’s reset gives every picture <code className={mono}>max-width: 100%</code>, which would squeeze the pictures of a document. The editor undoes it for its own.
                </>
              ),
              es: (
                <>
                  El reset de Tailwind le da a cada imagen <code className={mono}>max-width: 100%</code>, lo que apretaría las imágenes de un documento. El editor lo deshace para las suyas.
                </>
              ),
              zh: (
                <>
                  Tailwind 的 reset 会给每张图片设置 <code className={mono}>max-width: 100%</code>，这会挤压文档中的图片。编辑器会为自己的图片撤销这一设置。
                </>
              ),
            })}
          </li>
          <li>
            {t({
              en: 'The editor’s styles win over the reset’s, which Tailwind keeps in a layer, and your utilities win over the rule of the element the pages are in.',
              es: 'Los estilos del editor le ganan a los del reset, que Tailwind guarda en una capa, y tus utilidades le ganan a la regla del elemento donde están las páginas.',
              zh: '编辑器的样式优先于 Tailwind 放在层中的 reset 样式，而你的工具类又优先于页面所在元素的规则。',
            })}
          </li>
        </ul>
      </section>
    </>
  );
}
