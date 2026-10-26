import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS } from '@/lib/home';
import { getT } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { Callout, HandTip, SectionHead } from '../ui';
import { GESTURES, KNOW, NARROW } from './data';
import { LazyPhoneDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';
const COLORS = ['blue', 'purple', 'yellow', 'green', 'pink', 'orange'] as const;

/**
 * "Phones and touch": a real editor at the width of a phone, a tablet or the
 * page; what a narrow window changes; the gestures; the bar for a finger; the
 * keyboard of the screen; the reading view; and doing it in an interface of
 * your own.
 */
export async function MobilePage() {
  const t = getT();
  const [shell, plain, reading] = await Promise.all([
    highlight(
      `function Shell() {
  const { narrow, keyboard } = useDocsResponsive(600);
  return (
    <div className="flex h-dvh flex-col" style={{ paddingBottom: keyboard }}>
      {!narrow && <Ruler />}
      <DocsSurface className="min-h-0 flex-1" />
    </div>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `import { createResponsive, keyboardInset, onKeyboard } from '@rebodocs/editor';

const responsive = createResponsive(shell, editor);   // shell: what the editor and its bars are in
responsive.narrow;                                     // true under 600 pixels
const stop = onKeyboard(() => console.log(keyboardInset()));  // pixels the keyboard covers`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(`commands.setView('flow');     // and 'column' to go back to the pages`, 'ts', LIGHT_THEME),
  ]);

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {t({ en: 'Phones and touch', es: 'Teléfonos y pantallas táctiles', zh: '手机与触屏' })}
      </h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: 'A document does not change with the screen. Its pages are the same on a phone as on a monitor: the window is a place to look at them from, nearer or further, like a desk. What adapts is the zoom, the controls and the input.',
          es: 'Un documento no cambia con la pantalla. Sus páginas son las mismas en un teléfono que en un monitor: la ventana es un lugar desde donde mirarlas, más cerca o más lejos, como un escritorio. Lo que se adapta es el zoom, los controles y la entrada.',
          zh: '文档不会随屏幕而改变。它的页面在手机上和显示器上完全一样：窗口只是观看页面的地方，可近可远，就像一张书桌。会适配的是缩放、控件和输入方式。',
        })}
      </p>
      <div className="mt-4">
        <HandTip>
          {t({
            en: 'tip: change the width below, and watch what the editor does with it',
            es: 'tip: cambia el ancho abajo, y mira qué hace el editor',
            zh: '提示：在下方改变宽度，看看编辑器如何应对',
          })}
        </HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'At the width of a phone', es: 'Al ancho de un teléfono', zh: '手机的宽度' })}>
          {t({
            en: (
              <>
                The React component, as it comes: under 600 pixels it makes do with a narrow window by itself (<code className={mono}>features.responsive</code>, on unless switched off).
              </>
            ),
            es: (
              <>
                El componente de React, tal como viene: por debajo de 600 píxeles se las arregla solo con una ventana angosta (<code className={mono}>features.responsive</code>, encendido salvo que se
                apague).
              </>
            ),
            zh: (
              <>
                开箱即用的 React 组件：宽度小于 600 像素时，它会自动适配窄窗口（<code className={mono}>features.responsive</code>，默认开启）。
              </>
            ),
          })}
        </SectionHead>
        <LazyPhoneDemo />
      </section>

      <section aria-labelledby="narrow" className="mt-24">
        <SectionHead
          id="narrow"
          badge={t({ en: 'Narrow', es: 'Angosto', zh: '窄屏' })}
          color="blue"
          title={t({ en: 'What a narrow window changes', es: 'Qué cambia en una ventana angosta', zh: '窄窗口会改变什么' })}
        >
          {t({
            en: 'Never the document: how it is shown, and what is around it.',
            es: 'Nunca el documento: cómo se muestra, y lo que lo rodea.',
            zh: '永远不会改变文档本身：只改变文档的显示方式及其周围的内容。',
          })}
        </SectionHead>
        <div className="mt-7 grid max-w-[920px] gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))' }}>
          {NARROW.map((card, i) => (
            <div key={card.title.en} className="rounded-2xl border border-border p-5">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${PASTEL_CLASS[COLORS[i % COLORS.length]]}`}>{t(card.title)}</span>
              <p className="m-0 mt-2.5 text-[15px] leading-[1.6] text-ink-soft">{t(card.text)}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="gestures" className="mt-24">
        <SectionHead id="gestures" badge={t({ en: 'Touch', es: 'Táctil', zh: '触控' })} color="purple" title={t({ en: 'Gestures', es: 'Gestos', zh: '手势' })}>
          {t({
            en: 'What a finger does on the pages. With a mouse, none of the handles or the bar below show.',
            es: 'Lo que hace un dedo sobre las páginas. Con un ratón, no aparece ninguno de los tiradores ni la barra de abajo.',
            zh: '手指在页面上的操作。使用鼠标时，不会出现下方提到的拖动手柄和工具条。',
          })}
        </SectionHead>
        <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
          {GESTURES.map((row) => (
            <div key={row.gesture.en} className="grid gap-x-6 border-t border-[#f0eee9] py-3 first:border-t-0 sm:grid-cols-[160px_1fr]">
              <dt className="text-[15px] font-semibold text-ink">{t(row.gesture)}</dt>
              <dd className="m-0 text-[15px] leading-normal text-ink-soft">{t(row.text)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="bar" className="mt-24">
        <SectionHead id="bar" badge={t({ en: 'Bar', es: 'Barra', zh: '工具条' })} color="yellow" title={t({ en: 'The bar for a finger', es: 'La barra para el dedo', zh: '适合手指的工具条' })}>
          {t({
            en: 'A selection made by touch brings up the bar beside it, which then also offers Copy, Cut, Paste, Paste as text and Select all: there are no keys for them. A tap on the caret brings it up with Paste and Select all, as a phone does.',
            es: 'Una selección hecha con el dedo saca la barra a su lado, que entonces también ofrece Copiar, Cortar, Pegar, Pegar como texto y Seleccionar todo: no hay teclas para eso. Un toque sobre el cursor la saca con Pegar y Seleccionar todo, como hace un teléfono.',
            zh: '用手指选中内容后，旁边会弹出工具条，额外提供复制、剪切、粘贴、粘贴为纯文本和全选：因为没有快捷键可用。轻点光标会弹出带“粘贴”和“全选”的工具条，就像手机系统那样。',
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: 'It is the same bar a tap of ⌘ (Ctrl) brings up beside a selection with a keyboard, with what it offers for the text, the table or the picture selected. A touch anywhere else puts it away.',
            es: 'Es la misma barra que saca un toque de ⌘ (Ctrl) junto a una selección con teclado, con lo que ofrece para el texto, la tabla o la imagen seleccionados. Un toque en cualquier otro lado la guarda.',
            zh: '它与使用键盘时轻按 ⌘（Ctrl）在选区旁弹出的工具条相同，会根据选中的文字、表格或图片提供相应操作。点击其他任何地方即可收起。',
          })}
        </p>
        <Callout title={t({ en: 'Paste needs HTTPS.', es: 'Pegar necesita HTTPS.', zh: '粘贴需要 HTTPS。' })}>
          {t({
            en: (
              <>
                It is only offered on a page served over HTTPS, or on <code className={mono}>localhost</code>. Elsewhere the browser does not let a page read the clipboard; copying still works.
              </>
            ),
            es: (
              <>
                Solo se ofrece en una página servida por HTTPS, o en <code className={mono}>localhost</code>. En otros lados el navegador no deja que una página lea el portapapeles; copiar sí
                funciona.
              </>
            ),
            zh: (
              <>
                只有通过 HTTPS 访问或在 <code className={mono}>localhost</code> 上才会提供粘贴。其他情况下浏览器不允许页面读取剪贴板；复制仍然可用。
              </>
            ),
          })}
        </Callout>
      </section>

      <section aria-labelledby="keyboard" className="mt-24">
        <SectionHead
          id="keyboard"
          badge={t({ en: 'Keyboard', es: 'Teclado', zh: '键盘' })}
          color="pink"
          title={t({ en: 'The keyboard of the screen', es: 'El teclado de la pantalla', zh: '屏幕键盘' })}
        >
          {t({
            en: 'A phone does not make the window shorter when its keyboard comes up: it draws the keyboard over it.',
            es: 'Un teléfono no hace más corta la ventana cuando sale su teclado: dibuja el teclado encima.',
            zh: '手机弹出键盘时不会缩短窗口，而是把键盘绘制在窗口上方。',
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: 'The editor keeps the caret in what is left to be seen, and the interface that comes with it leaves the covered part empty, so its bars stay above the keyboard. Words appear as they are typed, also with a keyboard that composes them (every phone keyboard does), and change when the keyboard corrects the one being typed.',
            es: 'El editor mantiene el cursor en lo que queda a la vista, y la interfaz que trae deja vacía la parte cubierta, así que sus barras se quedan encima del teclado. Las palabras aparecen mientras se escriben, también con un teclado que las compone (todos los de teléfono lo hacen), y cambian cuando el teclado corrige la que se está escribiendo.',
            zh: '编辑器会让光标保持在可见区域内，自带的界面会把被遮住的部分留空，因此工具栏始终位于键盘上方。文字会随输入即时出现，使用需要组合输入的键盘（所有手机键盘都是如此，中文拼音输入法也一样）时也是如此；键盘纠正正在输入的词时，文字也会随之改变。',
          })}
        </p>
      </section>

      <section aria-labelledby="reading-view" className="mt-24">
        <SectionHead id="reading-view" badge={t({ en: 'View', es: 'Vista', zh: '视图' })} color="orange" title={t({ en: 'Reading view', es: 'Vista de lectura', zh: '阅读视图' })}>
          {t({
            en: 'The text set to the width of the window, with no pages, at its real size. It is never switched on by itself: some people prefer it to read or write at length on a phone.',
            es: 'El texto acomodado al ancho de la ventana, sin páginas, a su tamaño real. Nunca se enciende solo: algunas personas lo prefieren para leer o escribir mucho en un teléfono.',
            zh: '文字按窗口宽度排列，没有分页，以实际大小显示。它从不自动开启：有些人更喜欢用它在手机上长时间阅读或写作。',
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: 'It is the first of the views at the foot of the editor (the lines at the right of the status bar; in a narrow window, the only one left), and pressed again it goes back to the pages. Try it in the demo above. In code:',
            es: 'Es la primera de las vistas al pie del editor (las líneas a la derecha de la barra de estado; en una ventana angosta, la única que queda), y al presionarla otra vez regresa a las páginas. Pruébala en la demo de arriba. En código:',
            zh: '它是编辑器底部视图按钮中的第一个（状态栏右侧的横线图标；窄窗口中只剩这一个），再按一次即可回到分页视图。在上面的演示中试试。代码中：',
          })}
        </p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: reading }} />
        <p className={prose}>
          {t({
            en: 'It is the same document, and exports the same file. Tables narrow to fit, as far as their columns can still be read; pictures shrink; what belongs to the page (header, footer, letterhead) is not shown there.',
            es: 'Es el mismo documento, y exporta el mismo archivo. Las tablas se angostan para caber, mientras sus columnas se puedan leer; las imágenes se encogen; lo que es de la página (encabezado, pie, membrete) no se muestra ahí.',
            zh: '这是同一份文档，导出的文件也相同。表格会在列仍可阅读的前提下收窄以适应宽度；图片会缩小；属于页面的内容（页眉、页脚、信头）在这里不显示。',
          })}
        </p>
      </section>

      <section aria-labelledby="own" className="mt-24">
        <SectionHead
          id="own"
          badge={t({ en: 'Your UI', es: 'Tu interfaz', zh: '你的界面' })}
          color="green"
          title={t({ en: 'In your own interface', es: 'En tu propia interfaz', zh: '在你自己的界面中' })}
        >
          {t({ en: 'With the ', es: 'Con los ', zh: '借助' })}
          <LocalLink href="/docs/headless/" className={LINK}>
            {t({ en: 'headless hooks', es: 'hooks headless', zh: 'headless hooks' })}
          </LocalLink>
          {t({
            en: (
              <>
                , <code className={mono}>useDocsResponsive</code> fits the pages to the width, and says whether the window is narrow and how many pixels of it the keyboard covers.
              </>
            ),
            es: (
              <>
                , <code className={mono}>useDocsResponsive</code> ajusta las páginas al ancho, y dice si la ventana es angosta y cuántos píxeles de ella cubre el teclado.
              </>
            ),
            zh: (
              <>
                ，<code className={mono}>useDocsResponsive</code> 会让页面适应宽度，并告诉你窗口是否为窄屏，以及键盘遮住了多少像素。
              </>
            ),
          })}
        </SectionHead>
        <div className={`mt-6 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: shell }} />
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>state.touch</code> is true from a touch of the screen until the mouse is used: there are then no keys to copy and paste with. Without React:
              </>
            ),
            es: (
              <>
                <code className={mono}>state.touch</code> es true desde que se toca la pantalla hasta que se usa el ratón: entonces no hay teclas para copiar y pegar. Sin React:
              </>
            ),
            zh: (
              <>
                从触摸屏幕开始到再次使用鼠标为止，<code className={mono}>state.touch</code> 为 true：此时没有可用于复制粘贴的快捷键。不用 React 时：
              </>
            ),
          })}
        </p>
        <div className={`mt-5 max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: plain }} />
      </section>

      <section aria-labelledby="know" className="mt-24">
        <SectionHead id="know" badge={t({ en: 'Honest', es: 'Con franqueza', zh: '坦白说' })} color="orange" title={t({ en: 'What to know', es: 'Qué saber', zh: '须知' })} />
        <ul className="m-0 mt-6 grid max-w-[760px] list-disc gap-2.5 pl-5 text-base leading-[1.6] text-ink-soft">
          {KNOW.map((item) => (
            <li key={item.en}>{t(item)}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
