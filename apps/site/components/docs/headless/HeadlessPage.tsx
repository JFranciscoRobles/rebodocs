import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';
import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import type { L } from '@/lib/i18n';
import { getT } from '@/lib/locale';
import { CODE, LINK } from '../styles';
import { HandTip, SectionHead } from '../ui';
import { LazyStateDemo } from './Lazy';

const mono = 'font-code text-[14px]';
const prose = 'm-0 mt-4 max-w-[760px] text-base leading-[1.7] text-ink-soft';

/** What `state` has, from DocsState in packages/react/src/docs.ts. */
const STATE: [L, string][] = [
  [{ en: 'Text at the selection', es: 'Texto en la selección', zh: '选区中的文字' }, 'bold, italic, underline, strike, fontFamily, fontSize, color, highlight, link'],
  [{ en: 'Paragraph', es: 'Párrafo', zh: '段落' }, 'align, lineHeight, styleId, list'],
  [{ en: 'What can be done', es: 'Qué se puede hacer', zh: '可执行的操作' }, 'canUndo, canRedo, collapsed, inTable, canEditTables, canMergeCells, canSplitCell, pictureSelected'],
  [{ en: 'Review', es: 'Revisión', zh: '审阅' }, 'trackChanges, changesView, revisionCount, restricted, activeEditable'],
  [{ en: 'Where', es: 'Dónde', zh: '位置' }, 'area (body, header or footer), page, pageCount'],
  [{ en: 'View', es: 'Vista', zh: '视图' }, 'zoom, view, fit, touch'],
  [{ en: 'Document', es: 'Documento', zh: '文档' }, 'name, dirty, saves, letterhead, fonts'],
  [{ en: 'Search', es: 'Búsqueda', zh: '搜索' }, 'findCount, findIndex'],
  [{ en: 'People', es: 'Personas', zh: '人员' }, 'collab, peers, me'],
];

/** The commands, from the list of them in docs.ts. */
const COMMANDS: [L, string][] = [
  [{ en: 'History', es: 'Historial', zh: '历史' }, 'undo, redo'],
  [{ en: 'Text', es: 'Texto', zh: '文字' }, 'toggleMark, setRunProps, insertText, insertLineBreak, selectAll, copy, cut, paste'],
  [{ en: 'Paragraph', es: 'Párrafo', zh: '段落' }, 'setParagraphProps, setParagraphStyle, toggleList, shiftListLevel, setListStyle, restartNumbering, continueNumbering, shiftIndent, insertPageBreak'],
  [
    { en: 'Tables', es: 'Tablas', zh: '表格' },
    'insertTable, insertTableRow, insertTableColumn, deleteTableRow, deleteTableColumn, deleteTable, mergeTableCells, splitTableCell, setTableCellProps, setTableBorders, setTableRowHeight, setHeaderRow',
  ],
  [{ en: 'Pictures', es: 'Imágenes', zh: '图片' }, 'insertImageFile, insertImageGrid, setPictureWrap, fitSelectedPicture'],
  [{ en: 'Templates', es: 'Plantillas', zh: '模板' }, 'insertVariable, fillVariables, insertSignatures'],
  [{ en: 'Links and notes', es: 'Enlaces y notas', zh: '链接与批注' }, 'setLink, removeLink, addNote, setNoteText, setNoteColor, removeNote, removeAllNotes, selectNote'],
  [{ en: 'Structure', es: 'Estructura', zh: '结构' }, 'insertToc, updateToc, goToHeading, moveSection, insertFootnote, insertEndnote, insertTextBox, restoreVersion'],
  [
    { en: 'Review', es: 'Revisión', zh: '审阅' },
    'setTrackChanges, setChangesView, acceptRevision, rejectRevision, acceptAllRevisions, rejectAllRevisions, goToRevision, selectRevision, setRestricted, makeEditable, removeEditable, nextEditable',
  ],
  [{ en: 'Columns and sections', es: 'Columnas y secciones', zh: '分栏与分节' }, 'setColumns, insertColumnBreak, insertSectionBreak'],
  [
    { en: 'Page', es: 'Página', zh: '页面' },
    'setPage, setPageNumbering, setFirstPageDifferent, setOwnHeaders, setEndnotesAt, setNoteNumbering, setArea, setLetterhead, setLetterheadFile, fitLetterheadMargins, removeLetterhead',
  ],
  [{ en: 'Search', es: 'Búsqueda', zh: '搜索' }, 'find, findStep, replaceFound, replaceAllFound'],
  [{ en: 'View', es: 'Vista', zh: '视图' }, 'setZoom, setFit, setView, setShowNotes, print'],
];

const same = (text: string): L => ({ en: text, es: text, zh: text });

/** The hooks, from packages/react/src/pieces.ts. */
const HOOKS: [string, L][] = [
  ['useDocsFind()', same('query, setQuery, options, setOptions, count, index, next, previous, replace, replaceAll, close')],
  [
    'useDocsLink()',
    { en: 'active (address and text), possible, set, remove, open', es: 'active (dirección y texto), possible, set, remove, open', zh: 'active（地址和文字）、possible、set、remove、open' },
  ],
  ['useDocsNotes()', same('notes, active, add, setText, setColor, remove, removeAll, select')],
  ['useDocsOutline()', same('items, active, goTo, move')],
  [
    'useDocsVariables()',
    {
      en: 'names, active, insert, select, blocks, fill; and what each asks of its value: formats, uses, setFormat, preview',
      es: 'names, active, insert, select, blocks, fill; y lo que cada una pide de su valor: formats, uses, setFormat, preview',
      zh: 'names、active、insert、select、blocks、fill；以及每个变量对其值的要求：formats、uses、setFormat、preview',
    },
  ],
  ['useDocsStyles()', same('styles, active, set')],
  [
    'useDocsPage()',
    {
      en: 'page, set, sections, section, ownHeaders, numbering, endnotesAt, noteNumbering, firstPageDifferent, and the letterhead',
      es: 'page, set, sections, section, ownHeaders, numbering, endnotesAt, noteNumbering, firstPageDifferent, y el membrete',
      zh: 'page、set、sections、section、ownHeaders、numbering、endnotesAt、noteNumbering、firstPageDifferent，以及信头',
    },
  ],
  [
    'useDocsSelectionBox()',
    { en: 'Where the selection is on the screen, to put something beside it', es: 'Dónde está la selección en la pantalla, para poner algo a su lado', zh: '选区在屏幕上的位置，用于在旁边放置元素' },
  ],
  ['useDocsCount()', { en: 'words and characters of the document, and of what is selected', es: 'palabras y caracteres del documento, y de lo seleccionado', zh: '文档以及选中内容的字数和字符数' }],
  [
    'useDocsBubble()',
    {
      en: 'The bar beside the selection, with <DocsProvider bubble>: open, close, toggle, ask',
      es: 'La barra junto a la selección, con <DocsProvider bubble>: open, close, toggle, ask',
      zh: '选区旁的工具条（需 <DocsProvider bubble>）：open、close、toggle、ask',
    },
  ],
  [
    'useDocsResponsive()',
    {
      en: 'Fits the pages to a narrow window; narrow, and keyboard in pixels',
      es: 'Ajusta las páginas a una ventana angosta; narrow, y keyboard en píxeles',
      zh: '让页面适配窄窗口；返回 narrow 和以像素计的 keyboard',
    },
  ],
  [
    'useDocsValue(select, fallback)',
    {
      en: 'Anything else worked out from the editor, drawing again only when it changes',
      es: 'Cualquier otra cosa calculada a partir del editor, que se vuelve a dibujar solo cuando cambia',
      zh: '从编辑器中计算出的任何其他值，仅在值变化时重新渲染',
    },
  ],
];

/** What was learned putting a headless editor in a CRM. */
const LESSONS = `const { editor, docs, ready } = useDocs();
useEffect(() => {
  if (!editor || !ready) return;
  let last = editor.doc;
  let timer: ReturnType<typeof setTimeout>;
  return editor.onChange(() => {
    if (editor.doc === last) return;     // the selection moved: nothing to save
    last = editor.doc;
    clearTimeout(timer);
    timer = setTimeout(() => void docs!.save(), 3000);   // calls onSave
  });
}, [editor, ready, docs]);`;

/**
 * "Headless: your own UI": the smallest headless editor, running, with its
 * state beside it; useDocs, its state and commands; the hooks; the keys; the
 * bar beside the selection; variables; the ruler; and a whole editor screen.
 */
export async function HeadlessPage() {
  const t = getT();
  const smallest = readFileSync(join(process.cwd(), 'components/docs/headless/Smallest.tsx'), 'utf8');
  const [first, use, find, keys, bubble, variable, ruler, autosave, focus, loading, replace, slash, commands] = await Promise.all([
    highlight(smallest, 'tsx', LIGHT_THEME),
    highlight(`const { state, commands, editor, docs, ready } = useDocs();`, 'ts', LIGHT_THEME),
    highlight(
      `function Find() {
  const find = useDocsFind();
  return (
    <div className="flex gap-2">
      <input value={find.query} onChange={(e) => find.setQuery(e.target.value)} placeholder="Find" />
      <span>{find.index} / {find.count}</span>
      <button onClick={find.previous}>↑</button>
      <button onClick={find.next}>↓</button>
    </div>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `function Editor() {
  const [finding, setFinding] = useState(false);
  const [linking, setLinking] = useState(false);
  return (
    <DocsProvider docx={file} onFindKey={() => setFinding(true)} onLinkKey={() => setLinking(true)}>
      {finding && <Find onClose={() => setFinding(false)} />}
      {linking && <LinkDialog onClose={() => setLinking(false)} />}
      <DocsSurface className="h-full" />
    </DocsProvider>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `function InsertMenu() {
  const bubble = useDocsBubble();
  return (
    <>
      <button onClick={() => bubble?.ask('variable')}>Variable</button>
      <button onClick={() => bubble?.ask('note')}>Note</button>
      <button onClick={() => bubble?.ask('link')}>Link</button>
    </>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `function Variable({ name }: { name: string }) {
  const variables = useDocsVariables();
  const [value, setValue] = useState('');
  const has = (id: FormatId) => variables.formats[name]?.some((format) => format.id === id);
  const { text, bad } = variables.preview(name, value);
  return (
    <label>
      {name}
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      <button aria-pressed={has('currency')} onClick={() => variables.setFormat(name, 'currency', !has('currency'))}>$</button>
      <small>{bad ? 'Not a number' : text}</small>
    </label>
  );
}`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `<div className="flex h-full flex-col">
  <DocsRuler />
  <DocsSurface className="min-h-0 flex-1" />
</div>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(LESSONS, 'tsx', LIGHT_THEME),
    highlight(
      `const toDocument = () => editor?.element.querySelector<HTMLElement>('.dx-input') ?? true;
<DropdownMenuContent finalFocus={toDocument}>…</DropdownMenuContent>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `const [loaded, setLoaded] = useState(false);
useEffect(() => {
  if (!loaded && ready && (!collab || state.collab === 'on')) requestAnimationFrame(() => setLoaded(true));
}, [loaded, ready, collab, state.collab]);
// <div className="relative flex-1"><DocsSurface …/>{!loaded && <Skeleton className="absolute inset-0" />}</div>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `const doc = await loadVersion({ list: async () => [], load: async () => bytes }, file.name);
commands.restoreVersion(doc);`,
      'ts',
      LIGHT_THEME,
    ),
    highlight(
      `<DocsProvider docx={file} bubble slash>
  <DocsSurface className="h-full" />
</DocsProvider>`,
      'tsx',
      LIGHT_THEME,
    ),
    highlight(
      `<DocsProvider
  docx={file}
  slash={{
    builtIns: ['heading1', 'heading2', 'bullets', 'table'],   // false for none
    commands: [
      { label: 'Privacy notice', group: 'Clauses', keywords: 'gdpr', html: '<p><b>Privacy.</b> We keep…</p>' },
      { label: 'Closing', group: 'Clauses', text: 'Yours sincerely,\\nThe management' },
      { label: 'Today', run: (editor) => editor.insertText(new Date().toLocaleDateString()) },
      { label: 'Next blank', when: (editor) => editor.restricted, run: (editor) => editor.nextEditable() },
    ],
  }}
>`,
      'tsx',
      LIGHT_THEME,
    ),
  ]);

  const rows = (list: [ReactNode, ReactNode][], width = 220, code = true) => (
    <dl className="m-0 mt-6 max-w-[920px] rounded-2xl border border-border px-5">
      {list.map(([term, text], i) => (
        <div key={i} className="grid gap-x-6 gap-y-1 border-t border-[#f0eee9] py-3 first:border-t-0" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${width}px),1fr))` }}>
          <dt className={`${code ? 'font-code text-[13.5px]' : 'text-[15px]'} font-semibold text-ink [overflow-wrap:anywhere]`}>{term}</dt>
          <dd className={`m-0 ${code ? 'text-[15px]' : 'font-code text-[13px]'} leading-[1.6] text-ink-soft [overflow-wrap:anywhere]`}>{text}</dd>
        </div>
      ))}
    </dl>
  );
  const block = (html: string, top = 'mt-5') => <div className={`${top} max-w-[760px] ${CODE}`} dangerouslySetInnerHTML={{ __html: html }} />;
  const lesson = (title: string, children: ReactNode) => (
    <div className="mt-8 max-w-[760px]">
      <h3 className="m-0 font-display text-lg font-bold tracking-[-0.01em]">{title}</h3>
      {children}
    </div>
  );
  const see = (href: string, text: L) => (
    <LocalLink href={href} className={LINK}>
      {t(text)}
    </LocalLink>
  );
  const dot = t({ en: '.', es: '.', zh: '。' });

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">
        {t({ en: 'Headless: your own UI', es: 'Headless: tu propia interfaz', zh: 'Headless：你自己的界面' })}
      </h1>
      <p className="m-0 mt-3.5 max-w-[700px] text-lg leading-[1.6] text-muted">
        {t({
          en: 'When the interface that comes with the editor is not yours, keep the pages and draw everything else yourself. The provider holds the document, the surface is where its pages go, and hooks give you what to show and what to do.',
          es: 'Cuando la interfaz que trae el editor no es la tuya, quédate con las páginas y dibuja todo lo demás tú. El provider tiene el documento, la superficie es donde van sus páginas, y los hooks te dan qué mostrar y qué hacer.',
          zh: '如果编辑器自带的界面不适合你，可以只保留页面，其余全部自己绘制。provider 持有文档，surface 是页面所在的位置，hooks 则告诉你要显示什么、能做什么。',
        })}
      </p>
      <div className="mt-4">
        <HandTip>
          {t({ en: 'tip: click and type below, and watch the state change', es: 'tip: haz clic y escribe abajo, y mira cómo cambia el estado', zh: '提示：在下方点击并输入，观察状态的变化' })}
        </HandTip>
      </div>

      <section aria-labelledby="try" className="mt-16">
        <SectionHead id="try" badge={t({ en: 'Live', es: 'En vivo', zh: '实时' })} color="green" title={t({ en: 'The smallest one', es: 'El más pequeño', zh: '最小的例子' })}>
          {t({
            en: (
              <>
                A toolbar of five things and the pages, running, with what <code className={mono}>state</code> holds beside it. Its whole file is under it.
              </>
            ),
            es: (
              <>
                Una barra de herramientas de cinco cosas y las páginas, corriendo, con lo que contiene <code className={mono}>state</code> al lado. Su archivo completo está debajo.
              </>
            ),
            zh: (
              <>
                一个只有五个按钮的工具栏加上页面，正在运行，旁边显示 <code className={mono}>state</code> 的内容。完整文件就在下方。
              </>
            ),
          })}
        </SectionHead>
        <LazyStateDemo />
        {block(first)}
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>DocsProvider</code> takes the props of <code className={mono}>DocsEditor</code> that are about the document (<code className={mono}>docx</code>,{' '}
                <code className={mono}>name</code>, <code className={mono}>author</code>, <code className={mono}>collab</code>, <code className={mono}>onSave</code>…), and{' '}
                <code className={mono}>locale</code> and <code className={mono}>locales</code> for the texts the library still has (the bar beside the selection, what a screen reader is told); not
                those of the interface it does not draw (<code className={mono}>features</code>, <code className={mono}>className</code>, <code className={mono}>onReady</code>). It has three of its
                own: <code className={mono}>onLinkKey</code>, <code className={mono}>onFindKey</code> and <code className={mono}>bubble</code>, below. It puts nothing on the page itself: its children
                are where they are.
              </>
            ),
            es: (
              <>
                <code className={mono}>DocsProvider</code> toma las props de <code className={mono}>DocsEditor</code> que tratan del documento (<code className={mono}>docx</code>,{' '}
                <code className={mono}>name</code>, <code className={mono}>author</code>, <code className={mono}>collab</code>, <code className={mono}>onSave</code>…), y{' '}
                <code className={mono}>locale</code> y <code className={mono}>locales</code> para los textos que aún tiene la biblioteca (la barra junto a la selección, lo que se le dice a un lector
                de pantalla); no las de la interfaz que no dibuja (<code className={mono}>features</code>, <code className={mono}>className</code>, <code className={mono}>onReady</code>). Tiene tres
                propias: <code className={mono}>onLinkKey</code>, <code className={mono}>onFindKey</code> y <code className={mono}>bubble</code>, abajo. No pone nada en la página por sí mismo: sus
                hijos están donde están.
              </>
            ),
            zh: (
              <>
                <code className={mono}>DocsProvider</code> 接收 <code className={mono}>DocsEditor</code> 中与文档相关的属性（<code className={mono}>docx</code>、<code className={mono}>name</code>、
                <code className={mono}>author</code>、<code className={mono}>collab</code>、<code className={mono}>onSave</code>…），以及用于库中仍保留的文本（选区旁的工具条、告诉屏幕阅读器的内容）的{' '}
                <code className={mono}>locale</code> 和 <code className={mono}>locales</code>；但不接收它不负责绘制的界面相关属性（<code className={mono}>features</code>、
                <code className={mono}>className</code>、<code className={mono}>onReady</code>）。它有三个独有的属性：<code className={mono}>onLinkKey</code>、<code className={mono}>onFindKey</code>{' '}
                和 <code className={mono}>bubble</code>，见下文。它自身不向页面输出任何内容：子元素在哪里就显示在哪里。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {see('/docs/components/', { en: 'Components and hooks', es: 'Componentes y hooks', zh: '组件与 Hooks' })}
          {t({ en: ' has each piece with what it takes and an example; ', es: ' tiene cada pieza con lo que recibe y un ejemplo; ', zh: '一页列出了每个部件的参数和示例；' })}
          {see('/docs/styling/#your-own-interface', { en: 'Styling', es: 'Estilos', zh: '样式' })}
          {t({ en: ' has six pieces made with Tailwind, running; and ', es: ' tiene seis piezas hechas con Tailwind, corriendo; y ', zh: '一页有六个用 Tailwind 做的部件，可以直接运行；而' })}
          {see('/docs/example/', { en: 'A complete interface', es: 'Una interfaz completa', zh: '一套完整的界面' })}
          {t({ en: ' is a whole application built this way.', es: ' es una aplicación completa construida así.', zh: '则是用这种方式构建的完整应用。' })}
        </p>
      </section>

      <section aria-labelledby="usedocs" className="mt-24">
        <SectionHead id="usedocs" badge="Hook" color="blue" title="useDocs">
          {t({
            en: 'What there is to show, what there is to do, and the editor itself.',
            es: 'Lo que hay que mostrar, lo que hay que hacer, y el editor en sí.',
            zh: '要显示什么、能做什么，以及编辑器本身。',
          })}
        </SectionHead>
        {block(use, 'mt-6')}
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>state</code> is a plain snapshot. It is the same object until something in it changes, so a component draws again only when it must.
              </>
            ),
            es: (
              <>
                <code className={mono}>state</code> es una instantánea simple. Es el mismo objeto hasta que algo en él cambia, así que un componente se vuelve a dibujar solo cuando hace falta.
              </>
            ),
            zh: (
              <>
                <code className={mono}>state</code> 是一个普通快照。在其中某项变化之前，它始终是同一个对象，因此组件只会在必要时重新渲染。
              </>
            ),
          })}
        </p>
        {rows(
          STATE.map(([term, text]) => [t(term), text]),
          200,
          false,
        )}
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>commands</code> are the editor’s methods. Each gives the keyboard back to the document afterwards, so a click on your button does not leave the person unable to
                type.
              </>
            ),
            es: (
              <>
                <code className={mono}>commands</code> son los métodos del editor. Cada uno le devuelve el teclado al documento después, así que un clic en tu botón no deja a la persona sin poder
                escribir.
              </>
            ),
            zh: (
              <>
                <code className={mono}>commands</code> 就是编辑器的方法。每个命令执行后都会把键盘焦点交还给文档，所以点击你的按钮后，用户仍然可以继续输入。
              </>
            ),
          })}
        </p>
        {rows(
          COMMANDS.map(([term, text]) => [t(term), text]),
          200,
          false,
        )}
        <p className={prose}>
          {t({
            en: (
              <>
                Before the document is there (on the server, and until the surface is on the page) <code className={mono}>ready</code> is false, <code className={mono}>state</code> holds neutral
                values, and the commands do nothing.
              </>
            ),
            es: (
              <>
                Antes de que el documento esté (en el servidor, y hasta que la superficie está en la página) <code className={mono}>ready</code> es false, <code className={mono}>state</code> tiene
                valores neutros, y los comandos no hacen nada.
              </>
            ),
            zh: (
              <>
                在文档就绪之前（在服务器上，以及 surface 挂载到页面之前），<code className={mono}>ready</code> 为 false，<code className={mono}>state</code> 保存的是中性值，命令不会执行任何操作。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="hooks-for-panels-and-dialogs" className="mt-24">
        <SectionHead
          id="hooks-for-panels-and-dialogs"
          badge="Hooks"
          color="purple"
          title={t({ en: 'Hooks for panels and dialogs', es: 'Hooks para paneles y diálogos', zh: '面板和对话框用的 hooks' })}
        >
          {t({
            en: 'Each gives what there is to show and what there is to do, for a piece of interface you draw, and draws again only when its own value changes.',
            es: 'Cada uno da lo que hay que mostrar y lo que hay que hacer, para una pieza de interfaz que tú dibujas, y se vuelve a dibujar solo cuando cambia su propio valor.',
            zh: '每个 hook 都为你绘制的某个界面部件提供要显示的内容和可执行的操作，并且只在自身值变化时重新渲染。',
          })}
        </SectionHead>
        {rows(
          HOOKS.map(([term, text]) => [term, t(text)]),
          240,
        )}
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>useDocsValue</code> compares what it selects as JSON at every change, so it is for small values: it warns in the console when given one as large as the document.
                To know when the document changes, <code className={mono}>editor.onChange</code>. A find bar, for example:
              </>
            ),
            es: (
              <>
                <code className={mono}>useDocsValue</code> compara lo que selecciona como JSON en cada cambio, así que es para valores pequeños: avisa en la consola cuando recibe uno tan grande como
                el documento. Para saber cuándo cambia el documento, <code className={mono}>editor.onChange</code>. Una barra de búsqueda, por ejemplo:
              </>
            ),
            zh: (
              <>
                <code className={mono}>useDocsValue</code> 会在每次变化时把选出的值作为 JSON 比较，因此只适合小的值：如果传入和整个文档一样大的值，它会在控制台中发出警告。要得知文档何时变化，请用{' '}
                <code className={mono}>editor.onChange</code>。例如一个查找栏：
              </>
            ),
          })}
        </p>
        {block(find)}
      </section>

      <section aria-labelledby="keys" className="mt-24">
        <SectionHead id="keys" badge={t({ en: 'Keys', es: 'Teclas', zh: '按键' })} color="yellow" title={t({ en: 'Keys', es: 'Teclas', zh: '按键' })}>
          {t({
            en: (
              <>
                Most keys are the editor’s own and work with nothing asked of you: ⌘B, ⌘I, ⌘U, ⌘Z and ⇧⌘Z, ⌘A, ⌘↵ for a page break, ⌘S (with an <code className={mono}>onSave</code>) and ⌘P, ⌘-click on
                a link, ⌘ and the wheel to zoom. Ctrl takes the place of ⌘ away from a Mac.
              </>
            ),
            es: (
              <>
                La mayoría de las teclas son del propio editor y funcionan sin pedirte nada: ⌘B, ⌘I, ⌘U, ⌘Z y ⇧⌘Z, ⌘A, ⌘↵ para un salto de página, ⌘S (con un <code className={mono}>onSave</code>) y
                ⌘P, ⌘-clic en un enlace, ⌘ y la rueda para el zoom. Fuera de una Mac, Ctrl toma el lugar de ⌘.
              </>
            ),
            zh: (
              <>
                大多数快捷键由编辑器自己处理，无需你做任何事：⌘B、⌘I、⌘U、⌘Z 和 ⇧⌘Z、⌘A、⌘↵ 插入分页符、⌘S（需要 <code className={mono}>onSave</code>）和 ⌘P、⌘+点击打开链接、⌘+滚轮缩放。在 Mac
                以外的系统上用 Ctrl 代替 ⌘。
              </>
            ),
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: 'Two open something only an interface has, so the editor knows the key and leaves the answer to you. Each is taken from the browser only while you give it someone to call, and only while the keyboard is in the document.',
            es: 'Dos abren algo que solo tiene una interfaz, así que el editor conoce la tecla y te deja la respuesta a ti. Cada una se le quita al navegador solo mientras le das a quién llamar, y solo mientras el teclado está en el documento.',
            zh: '有两个快捷键会打开只有界面才有的东西，因此编辑器只识别按键，具体如何响应交给你。只有在你提供回调、且键盘焦点在文档中时，编辑器才会从浏览器接管这两个快捷键。',
          })}
        </p>
        {rows(
          [
            ['onLinkKey()  ·  ⌘K', t({ en: 'Time to ask for the address of a link.', es: 'Momento de pedir la dirección de un enlace.', zh: '该询问链接地址了。' })],
            [
              'onFindKey(replace)  ·  ⌘F, ⌘H',
              t({ en: 'Time to show the search; replace is true for ⌘H.', es: 'Momento de mostrar la búsqueda; replace es true con ⌘H.', zh: '该显示搜索了；按 ⌘H 时 replace 为 true。' }),
            ],
          ],
          240,
        )}
        {block(keys)}
        <p className={prose}>
          {t({
            en: (
              <>
                Without React they are options of <code className={mono}>createDocs</code>, and <code className={mono}>docs.setKeys({'{ onLinkKey, onFindKey }'})</code> changes them later.
              </>
            ),
            es: (
              <>
                Sin React son opciones de <code className={mono}>createDocs</code>, y <code className={mono}>docs.setKeys({'{ onLinkKey, onFindKey }'})</code> las cambia después.
              </>
            ),
            zh: (
              <>
                不用 React 时，它们是 <code className={mono}>createDocs</code> 的选项，之后可以用 <code className={mono}>docs.setKeys({'{ onLinkKey, onFindKey }'})</code> 修改。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="the-bar-beside-the-selection" className="mt-24">
        <SectionHead
          id="the-bar-beside-the-selection"
          badge={t({ en: 'Bar', es: 'Barra', zh: '工具条' })}
          color="pink"
          title={t({ en: 'The bar beside the selection', es: 'La barra junto a la selección', zh: '选区旁的工具条' })}
        >
          {t({
            en: (
              <>
                <code className={mono}>{'<DocsProvider bubble>'}</code> gives the document the small bar that comes up beside what is selected, the one the included interface has.
              </>
            ),
            es: (
              <>
                <code className={mono}>{'<DocsProvider bubble>'}</code> le da al documento la pequeña barra que aparece junto a lo seleccionado, la misma que tiene la interfaz incluida.
              </>
            ),
            zh: (
              <>
                <code className={mono}>{'<DocsProvider bubble>'}</code> 会为文档提供一个出现在选中内容旁边的小工具条，与自带界面中的相同。
              </>
            ),
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: (
              <>
                On it: copy, cut and paste on a screen that is touched, a variable made of the words selected, a link, a note, and what can be done to a picture or a table. A tap on ⌘ shows and hides
                it, and with it ⌘K asks for a link there unless you gave an <code className={mono}>onLinkKey</code>. It is off unless asked for, and read when the document is made.
              </>
            ),
            es: (
              <>
                En ella: copiar, cortar y pegar en una pantalla táctil, una variable hecha con las palabras seleccionadas, un enlace, una nota, y lo que se puede hacer con una imagen o una tabla. Un
                toque en ⌘ la muestra y la oculta, y con ella ⌘K pide un enlace ahí salvo que hayas dado un <code className={mono}>onLinkKey</code>. Está apagada salvo que se pida, y se lee al crear
                el documento.
              </>
            ),
            zh: (
              <>
                工具条上有：触屏上的复制、剪切和粘贴，把选中的词变成变量，链接，批注，以及针对图片或表格的操作。轻按 ⌘ 可显示或隐藏它；有了它，除非你提供了 <code className={mono}>onLinkKey</code>
                ，否则 ⌘K 会在工具条上询问链接地址。默认关闭，在创建文档时读取。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                It is the one piece here with a look of its own, and it is put in <code className={mono}>document.body</code>. Give it your colours with the{' '}
              </>
            ),
            es: (
              <>
                Es la única pieza aquí con un aspecto propio, y se pone en <code className={mono}>document.body</code>. Dale tus colores con las{' '}
              </>
            ),
            zh: (
              <>
                它是这里唯一带有自身外观的部件，会被放到 <code className={mono}>document.body</code> 中。请通过
              </>
            ),
          })}
          {see('/docs/styling/#the-included-interface', { en: '--dx-ui-… variables', es: 'variables --dx-ui-…', zh: '--dx-ui-… 变量' })}
          {t({
            en: (
              <>
                {' '}
                on <code className={mono}>body</code> (or on <code className={mono}>body:has(.your-editor)</code>), not by reaching into its classes. <code className={mono}>useDocsBubble()</code>{' '}
                gives it to your own buttons:
              </>
            ),
            es: (
              <>
                {' '}
                en <code className={mono}>body</code> (o en <code className={mono}>body:has(.tu-editor)</code>), no metiéndote en sus clases. <code className={mono}>useDocsBubble()</code> se la da a
                tus propios botones:
              </>
            ),
            zh: (
              <>
                （设置在 <code className={mono}>body</code> 或 <code className={mono}>body:has(.your-editor)</code> 上）为它指定颜色，而不要去改它的类名。<code className={mono}>useDocsBubble()</code>{' '}
                可以让你自己的按钮使用它：
              </>
            ),
          })}
        </p>
        {block(bubble)}
        <p className={prose}>
          {t({
            en: (
              <>
                To draw one of your own, <code className={mono}>useDocsSelectionBox()</code> says where the selection is: there is one running on the page{' '}
              </>
            ),
            es: (
              <>
                Para dibujar una propia, <code className={mono}>useDocsSelectionBox()</code> dice dónde está la selección: hay una corriendo en la página{' '}
              </>
            ),
            zh: (
              <>
                如果要自己绘制工具条，<code className={mono}>useDocsSelectionBox()</code> 会告诉你选区在哪里：
              </>
            ),
          })}
          {see('/docs/styling/#your-own-interface', { en: 'Styling', es: 'Estilos', zh: '样式' })}
          {t({ en: '.', es: '.', zh: '一页中就有一个正在运行的例子。' })}
        </p>
      </section>

      <section aria-labelledby="the-slash-menu" className="mt-24">
        <SectionHead id="the-slash-menu" badge={t({ en: 'Menu', es: 'Menú', zh: '菜单' })} color="blue" title={t({ en: 'The “/” menu', es: 'El menú “/”', zh: '“/” 菜单' })}>
          {t({
            en: (
              <>
                <code className={mono}>{'<DocsProvider slash>'}</code> gives the document the menu a “/” brings up, the one the included interface has: what can be put where the caret is, or made of
                its paragraph, without reaching for the toolbar.
              </>
            ),
            es: (
              <>
                <code className={mono}>{'<DocsProvider slash>'}</code> le da al documento el menú que abre una “/”, el mismo que tiene la interfaz incluida: lo que se puede poner donde está el cursor,
                o hacer con su párrafo, sin ir a la barra de herramientas.
              </>
            ),
            zh: (
              <>
                <code className={mono}>{'<DocsProvider slash>'}</code> 会为文档提供输入 “/” 时弹出的菜单，与自带界面中的相同：无需去工具栏，就能在光标处插入内容或改变所在段落。
              </>
            ),
          })}
        </SectionHead>
        {block(slash)}
        <p className={prose}>
          {t({
            en: 'It comes up when the “/” is typed at the start of a paragraph or after a space, so a date like 12/05, “and/or” or an address is left alone. What is typed after it narrows the list, by name or by what each one does, and without minding accents; h1, h2, h3, ul, ol and toc find their own. ↑ and ↓ choose, Enter or Tab (or a click) does it in place of the “/” and what followed it, and Escape leaves them as text. It goes by itself when the caret leaves the command, or when nothing is found and a space is typed.',
            es: 'Aparece cuando la “/” se escribe al inicio de un párrafo o después de un espacio, así que una fecha como 12/05, “y/o” o una dirección quedan en paz. Lo que se escribe después acota la lista, por nombre o por lo que hace cada uno, y sin importar los acentos; h1, h2, h3, ul, ol y toc encuentran el suyo. ↑ y ↓ eligen, Enter o Tab (o un clic) lo hace en lugar de la “/” y lo que la seguía, y Escape los deja como texto. Se va solo cuando el cursor sale del comando, o cuando no se encuentra nada y se escribe un espacio.',
            zh: '只有在段落开头或空格后输入 “/” 时才会弹出，因此 12/05 这样的日期、“和/或”或网址都不受影响。之后输入的内容会按名称或功能筛选列表，并且忽略重音符号；h1、h2、h3、ul、ol 和 toc 都能找到对应项。用 ↑ 和 ↓ 选择，按 Enter 或 Tab（或点击）执行，执行结果会替换 “/” 及其后输入的内容；按 Esc 则保留为文本。光标离开命令，或找不到结果时再输入空格，菜单会自动关闭。',
          })}
        </p>
        {rows(
          [
            [
              t({ en: 'Text', es: 'Texto', zh: '文字' }),
              t({
                en: 'Normal, Heading 1 to 3 (those the document has styles for), a bulleted list, a numbered list',
                es: 'Normal, Título 1 a 3 (los que el documento tiene como estilos), una lista con viñetas, una lista numerada',
                zh: '正文、标题 1 至 3（文档中有对应样式的）、项目符号列表、编号列表',
              }),
            ],
            [
              t({ en: 'Insert', es: 'Insertar', zh: '插入' }),
              t({
                en: 'A 3 × 3 table, a picture, a page break, a table of contents, a text box, a footnote',
                es: 'Una tabla de 3 × 3, una imagen, un salto de página, una tabla de contenido, un cuadro de texto, una nota al pie',
                zh: '3 × 3 表格、图片、分页符、目录、文本框、脚注',
              }),
            ],
            [
              t({ en: 'Template', es: 'Plantilla', zh: '模板' }),
              t({
                en: 'A variable, the signatures, a note on the word before the “/”, and with forms an area to fill in',
                es: 'Una variable, las firmas, una nota sobre la palabra anterior a la “/”, y con forms un área para llenar',
                zh: '变量、签名、对 “/” 前一个词的批注，开启 forms 时还有待填区域',
              }),
            ],
          ],
          120,
        )}
        <p className={prose}>
          {t({
            en: (
              <>
                Only what can be done there is offered: in a table there is no table, no signatures, no page break and no table of contents; in a header or a footer, no page break, table of contents,
                text box, footnote or note; a table of contents only while there is none. The variable and the note ask for their name and their text in the bar beside the selection, so they are
                offered only with <code className={mono}>bubble</code> too. Doing a command is two steps for ⌘Z: the first undoes the command, the second gives back what was typed.
              </>
            ),
            es: (
              <>
                Solo se ofrece lo que se puede hacer ahí: en una tabla no hay tabla, ni firmas, ni salto de página ni tabla de contenido; en un encabezado o un pie, ni salto de página, ni tabla de
                contenido, ni cuadro de texto, ni nota al pie ni nota; una tabla de contenido solo mientras no haya ninguna. La variable y la nota piden su nombre y su texto en la barra junto a la
                selección, así que solo se ofrecen también con <code className={mono}>bubble</code>. Hacer un comando son dos pasos para ⌘Z: el primero deshace el comando, el segundo devuelve lo que
                se escribió.
              </>
            ),
            zh: (
              <>
                只会提供在当前位置可用的命令：在表格中不能插入表格、签名、分页符和目录；在页眉或页脚中不能插入分页符、目录、文本框、脚注或批注；目录只在文档中还没有目录时提供。变量和批注需要在选区旁的工具条中输入名称和内容，
                因此只有同时开启 <code className={mono}>bubble</code> 时才会提供。执行一个命令对 ⌘Z 来说是两步：第一次撤销命令，第二次恢复输入的文字。
              </>
            ),
          })}
        </p>
        <p className={prose}>
          {t({
            en: (
              <>
                Like the bar, it is put in <code className={mono}>document.body</code> and takes its colours from the --dx-ui-… variables; it opens under the caret, or over it when there is more room
                there, the keyboard of a phone counted. It is off unless asked for, and read when the document is made. Without React it is the <code className={mono}>slash</code> option of{' '}
                <code className={mono}>createDocs</code>, or <code className={mono}>{'createSlashMenu(editor, { ask: bubble.ask })'}</code> on a bare editor.
              </>
            ),
            es: (
              <>
                Como la barra, se pone en <code className={mono}>document.body</code> y toma sus colores de las variables --dx-ui-…; se abre bajo el cursor, o sobre él cuando hay más espacio ahí,
                contando el teclado de un teléfono. Está apagado salvo que se pida, y se lee al crear el documento. Sin React es la opción <code className={mono}>slash</code> de{' '}
                <code className={mono}>createDocs</code>, o <code className={mono}>{'createSlashMenu(editor, { ask: bubble.ask })'}</code> sobre un editor desnudo.
              </>
            ),
            zh: (
              <>
                与工具条一样，它也会放到 <code className={mono}>document.body</code> 中，颜色取自 --dx-ui-…
                变量；它在光标下方打开，若上方空间更大（考虑手机键盘）则在上方打开。默认关闭，在创建文档时读取。不用 React 时，它是 <code className={mono}>createDocs</code> 的{' '}
                <code className={mono}>slash</code> 选项，或在空白编辑器上使用 <code className={mono}>{'createSlashMenu(editor, { ask: bubble.ask })'}</code>。
              </>
            ),
          })}
        </p>
        <h3 className="m-0 mt-12 font-display text-xl font-bold tracking-[-0.01em]">{t({ en: 'Your own commands', es: 'Tus propios comandos', zh: '你自己的命令' })}</h3>
        <p className={prose}>
          {t({
            en: (
              <>
                Given settings in place of <code className={mono}>true</code>, the menu keeps only the commands of its own you name in <code className={mono}>builtIns</code> (normal, heading1,
                heading2, heading3, bullets, numbers, table, image, pageBreak, toc, textBox, footnote, variable, signatures, note, field), or none with <code className={mono}>false</code>, and offers
                yours after them, those of one <code className={mono}>group</code> under one heading, “More” when none is given. Each puts in <code className={mono}>text</code>, a paragraph for each
                line, or <code className={mono}>html</code> with its formatting, as pasting it would, or does what its <code className={mono}>run</code> says once the “/” is gone;{' '}
                <code className={mono}>when</code> says where it is offered. <code className={mono}>commands</code> may be a function, asked each time the menu opens.
              </>
            ),
            es: (
              <>
                Si se da una configuración en lugar de <code className={mono}>true</code>, el menú conserva solo los comandos propios que nombras en <code className={mono}>builtIns</code> (normal,
                heading1, heading2, heading3, bullets, numbers, table, image, pageBreak, toc, textBox, footnote, variable, signatures, note, field), o ninguno con <code className={mono}>false</code>,
                y ofrece los tuyos después, los de un mismo <code className={mono}>group</code> bajo un mismo encabezado, “More” cuando no se da ninguno. Cada uno pone{' '}
                <code className={mono}>text</code>, un párrafo por línea, o <code className={mono}>html</code> con su formato, como lo haría pegarlo, o hace lo que dice su{' '}
                <code className={mono}>run</code> una vez que la “/” se fue; <code className={mono}>when</code> dice dónde se ofrece. <code className={mono}>commands</code> puede ser una función, que
                se consulta cada vez que se abre el menú.
              </>
            ),
            zh: (
              <>
                如果传入配置而不是 <code className={mono}>true</code>，菜单只会保留你在 <code className={mono}>builtIns</code>{' '}
                中列出的内置命令（normal、heading1、heading2、heading3、bullets、numbers、 table、image、pageBreak、toc、textBox、footnote、variable、signatures、note、field），设为{' '}
                <code className={mono}>false</code> 则一个都不保留，然后在其后列出你的命令；同一 <code className={mono}>group</code> 的命令归在同一标题下，未指定时归入“More”。每个命令可以插入{' '}
                <code className={mono}>text</code>（每行一个段落），或像粘贴一样插入带格式的 <code className={mono}>html</code>，也可以在 “/” 消失后执行 <code className={mono}>run</code>；
                <code className={mono}>when</code> 决定在哪里提供该命令。
                <code className={mono}>commands</code> 也可以是一个函数，每次打开菜单时调用。
              </>
            ),
          })}
        </p>
        {block(commands)}
        <p className={prose}>
          {t({
            en: (
              <>
                In <code className={mono}>DocsEditor</code> the same settings go in <code className={mono}>features.slash</code>.
              </>
            ),
            es: (
              <>
                En <code className={mono}>DocsEditor</code> la misma configuración va en <code className={mono}>features.slash</code>.
              </>
            ),
            zh: (
              <>
                在 <code className={mono}>DocsEditor</code> 中，同样的配置放在 <code className={mono}>features.slash</code> 里。
              </>
            ),
          })}
        </p>
      </section>

      <section aria-labelledby="variables-that-are-dates-and-amounts" className="mt-24">
        <SectionHead
          id="variables-that-are-dates-and-amounts"
          badge={t({ en: 'Templates', es: 'Plantillas', zh: '模板' })}
          color="orange"
          title={t({ en: 'Variables that are dates and amounts', es: 'Variables que son fechas e importes', zh: '日期和金额变量' })}
        >
          {t({
            en: 'A variable may ask how its value is written: as a date, as an amount, in capitals, in bold.',
            es: 'Una variable puede pedir cómo se escribe su valor: como fecha, como importe, en mayúsculas, en negrita.',
            zh: '变量可以指定其值的书写方式：日期、金额、大写、加粗。',
          })}
        </SectionHead>
        <p className={prose}>
          {t({
            en: (
              <>
                <code className={mono}>useDocsVariables()</code> gives what each one asks (<code className={mono}>formats</code>), changes it for every place the variable is used (
                <code className={mono}>setFormat</code>), and says what a value would come out as, or that it cannot be written that way (<code className={mono}>preview</code>).
              </>
            ),
            es: (
              <>
                <code className={mono}>useDocsVariables()</code> da lo que pide cada una (<code className={mono}>formats</code>), lo cambia en cada lugar donde se usa la variable (
                <code className={mono}>setFormat</code>), y dice cómo quedaría un valor, o que no se puede escribir así (<code className={mono}>preview</code>).
              </>
            ),
            zh: (
              <>
                <code className={mono}>useDocsVariables()</code> 提供每个变量的要求（<code className={mono}>formats</code>），可在变量出现的所有位置修改格式（<code className={mono}>setFormat</code>
                ），并告诉你某个值会写成什么样，或者无法按该格式书写（
                <code className={mono}>preview</code>）。
              </>
            ),
          })}
        </p>
        {block(variable)}
        <p className={prose}>
          {t({
            en: (
              <>
                The formats are <code className={mono}>date</code>, <code className={mono}>dateLong</code>, <code className={mono}>dateFull</code>, <code className={mono}>number</code>,{' '}
                <code className={mono}>currency</code>, <code className={mono}>upper</code>, <code className={mono}>lower</code>, <code className={mono}>capital</code>,{' '}
                <code className={mono}>bold</code>, <code className={mono}>italic</code> and <code className={mono}>underline</code>. One way of writing a date or a number takes the place of another,
                and so does a change of capitals. More on{' '}
              </>
            ),
            es: (
              <>
                Los formatos son <code className={mono}>date</code>, <code className={mono}>dateLong</code>, <code className={mono}>dateFull</code>, <code className={mono}>number</code>,{' '}
                <code className={mono}>currency</code>, <code className={mono}>upper</code>, <code className={mono}>lower</code>, <code className={mono}>capital</code>,{' '}
                <code className={mono}>bold</code>, <code className={mono}>italic</code> y <code className={mono}>underline</code>. Una forma de escribir una fecha o un número reemplaza a otra, y lo
                mismo pasa con un cambio de mayúsculas. Más en{' '}
              </>
            ),
            zh: (
              <>
                可用的格式有 <code className={mono}>date</code>、<code className={mono}>dateLong</code>、<code className={mono}>dateFull</code>、<code className={mono}>number</code>、
                <code className={mono}>currency</code>、<code className={mono}>upper</code>、<code className={mono}>lower</code>、<code className={mono}>capital</code>、
                <code className={mono}>bold</code>、<code className={mono}>italic</code> 和 <code className={mono}>underline</code>。日期或数字的写法彼此替换，大小写变化也是如此。更多内容见
              </>
            ),
          })}
          {see('/docs/templates/', { en: 'Templates and variables', es: 'Plantillas y variables', zh: '模板与变量' })}
          {dot}
        </p>
      </section>

      <section aria-labelledby="the-ruler" className="mt-24">
        <SectionHead id="the-ruler" badge={t({ en: 'Ruler', es: 'Regla', zh: '标尺' })} color="green" title={t({ en: 'The ruler', es: 'La regla', zh: '标尺' })}>
          {t({
            en: (
              <>
                <code className={mono}>{'<DocsRuler />'}</code> is the ruler of the included interface: the page in centimetres, its margins and the indents of the paragraph, to drag. Put it above the{' '}
                <code className={mono}>DocsSurface</code>, as wide as it.
              </>
            ),
            es: (
              <>
                <code className={mono}>{'<DocsRuler />'}</code> es la regla de la interfaz incluida: la página en centímetros, sus márgenes y las sangrías del párrafo, para arrastrar. Ponla sobre el{' '}
                <code className={mono}>DocsSurface</code>, del mismo ancho.
              </>
            ),
            zh: (
              <>
                <code className={mono}>{'<DocsRuler />'}</code> 是自带界面中的标尺：以厘米为单位显示页面，可以拖动页边距和段落缩进。把它放在 <code className={mono}>DocsSurface</code>{' '}
                上方，宽度与之相同。
              </>
            ),
          })}
        </SectionHead>
        {block(ruler, 'mt-6')}
        <p className={prose}>
          {t({
            en: 'It is drawn on a canvas, so its look is its colours, not classes: the six ',
            es: 'Se dibuja en un canvas, así que su aspecto son sus colores, no clases: las seis ',
            zh: '它绘制在 canvas 上，因此外观由颜色决定，而不是类名：即六个',
          })}
          {see('/docs/styling/#the-ruler', { en: '--dx-ruler… variables', es: 'variables --dx-ruler…', zh: '--dx-ruler… 变量' })}
          {t({ en: '. It draws itself again when they change.', es: '. Se vuelve a dibujar cuando cambian.', zh: '。变量变化时它会重新绘制。' })}
        </p>
      </section>

      <section aria-labelledby="a-whole-editor-screen" className="mt-24">
        <SectionHead
          id="a-whole-editor-screen"
          badge={t({ en: 'Lessons', es: 'Lecciones', zh: '经验' })}
          color="blue"
          title={t({ en: 'A whole editor screen', es: 'Una pantalla completa de editor', zh: '一整个编辑器界面' })}
        >
          {t({
            en: 'What was learned putting a headless editor inside a CRM: a Next.js application with its own components, saving to its API as the person types, and rooms to work together.',
            es: 'Lo aprendido al poner un editor headless dentro de un CRM: una aplicación de Next.js con sus propios componentes, que guarda en su API mientras la persona escribe, y salas para trabajar juntos.',
            zh: '把 headless 编辑器放进一个 CRM 时学到的经验：这是一个拥有自己组件的 Next.js 应用，在用户输入时保存到它的 API，并支持多人在房间中协作。',
          })}
        </SectionHead>
        {lesson(
          t({ en: 'Start from the hooks', es: 'Empieza por los hooks', zh: '从 hooks 开始' }),
          <p className={prose}>
            {t({
              en: (
                <>
                  Most panels are already one: <code className={mono}>useDocsVariables</code> for the fields of a template, <code className={mono}>useDocsPage</code> for sections and page setup,{' '}
                  <code className={mono}>useDocsCount</code> for the status bar, <code className={mono}>useDocsResponsive</code> for phones, <code className={mono}>useDocsFind</code> for the search.
                </>
              ),
              es: (
                <>
                  La mayoría de los paneles ya son uno: <code className={mono}>useDocsVariables</code> para los campos de una plantilla, <code className={mono}>useDocsPage</code> para secciones y
                  configuración de página, <code className={mono}>useDocsCount</code> para la barra de estado, <code className={mono}>useDocsResponsive</code> para teléfonos,{' '}
                  <code className={mono}>useDocsFind</code> para la búsqueda.
                </>
              ),
              zh: (
                <>
                  大多数面板都已有对应的 hook：模板字段用 <code className={mono}>useDocsVariables</code>，分节和页面设置用 <code className={mono}>useDocsPage</code>，状态栏用{' '}
                  <code className={mono}>useDocsCount</code>，手机适配用 <code className={mono}>useDocsResponsive</code>，搜索用 <code className={mono}>useDocsFind</code>。
                </>
              ),
            })}
          </p>,
        )}
        {lesson(
          t({ en: 'Saving as the person types', es: 'Guardar mientras la persona escribe', zh: '边输入边保存' }),
          <>
            <p className={prose}>
              {t({
                en: (
                  <>
                    Listen to the editor, not to React: <code className={mono}>editor.onChange</code> is called for the selection too, so compare the document itself, which is a new object only when
                    it changed.
                  </>
                ),
                es: (
                  <>
                    Escucha al editor, no a React: <code className={mono}>editor.onChange</code> también se llama por la selección, así que compara el documento en sí, que es un objeto nuevo solo
                    cuando cambió.
                  </>
                ),
                zh: (
                  <>
                    监听编辑器，而不是 React：选区变化时也会调用 <code className={mono}>editor.onChange</code>，所以要比较文档本身——只有文档真正变化时它才是新对象。
                  </>
                ),
              })}
            </p>
            {block(autosave)}
            <p className={prose}>
              {t({
                en: (
                  <>
                    <code className={mono}>useDocsValue((e) =&gt; e.doc)</code> would compare the whole document as JSON at every key: a long contract then takes a second per keystroke.
                  </>
                ),
                es: (
                  <>
                    <code className={mono}>useDocsValue((e) =&gt; e.doc)</code> compararía todo el documento como JSON en cada tecla: un contrato largo tardaría entonces un segundo por tecla.
                  </>
                ),
                zh: (
                  <>
                    <code className={mono}>useDocsValue((e) =&gt; e.doc)</code> 会在每次按键时把整个文档作为 JSON 比较：一份长合同每按一个键就要花一秒钟。
                  </>
                ),
              })}
            </p>
          </>,
        )}
        {lesson(
          t({ en: 'Menus give the keyboard back', es: 'Los menús devuelven el teclado', zh: '菜单要交还键盘焦点' }),
          <>
            <p className={prose}>
              {t({
                en: (
                  <>
                    A menu of a component library gives the focus back to the button that opened it, and the next key goes nowhere. Give it to the document instead: Base UI’s{' '}
                    <code className={mono}>finalFocus</code>, Radix’s <code className={mono}>onCloseAutoFocus</code>.
                  </>
                ),
                es: (
                  <>
                    Un menú de una biblioteca de componentes devuelve el foco al botón que lo abrió, y la siguiente tecla no va a ningún lado. Dáselo al documento en su lugar: el{' '}
                    <code className={mono}>finalFocus</code> de Base UI, el <code className={mono}>onCloseAutoFocus</code> de Radix.
                  </>
                ),
                zh: (
                  <>
                    组件库的菜单关闭后会把焦点还给打开它的按钮，于是下一次按键就没有着落了。应该把焦点交给文档：Base UI 用 <code className={mono}>finalFocus</code>，Radix 用{' '}
                    <code className={mono}>onCloseAutoFocus</code>。
                  </>
                ),
              })}
            </p>
            {block(focus)}
          </>,
        )}
        {lesson(
          t({ en: 'A loading state', es: 'Un estado de carga', zh: '加载状态' }),
          <>
            <p className={prose}>
              {t({
                en: (
                  <>
                    <code className={mono}>DocsSurface</code> is there before the document is: an empty page shows until <code className={mono}>ready</code>, and in a room until the room has sent it (
                    <code className={mono}>state.collab === &apos;on&apos;</code>). Cover the surface until then, once:
                  </>
                ),
                es: (
                  <>
                    <code className={mono}>DocsSurface</code> está antes que el documento: se ve una página vacía hasta <code className={mono}>ready</code>, y en una sala hasta que la sala lo mandó (
                    <code className={mono}>state.collab === &apos;on&apos;</code>). Cubre la superficie hasta entonces, una vez:
                  </>
                ),
                zh: (
                  <>
                    <code className={mono}>DocsSurface</code> 比文档先出现：在 <code className={mono}>ready</code> 之前会显示空白页；在房间中，则要等到房间把文档发过来（
                    <code className={mono}>state.collab === &apos;on&apos;</code>）。在此之前用遮罩盖住 surface，只需一次：
                  </>
                ),
              })}
            </p>
            {block(loading)}
          </>,
        )}
        {lesson(
          t({ en: 'Read only', es: 'Solo lectura', zh: '只读' }),
          <p className={prose}>
            {t({
              en: (
                <>
                  <code className={mono}>editor.readOnly = true</code> for someone who may only look: the commands do nothing and the keys type nothing. In a room, the server’s{' '}
                  <code className={mono}>admit</code> saying <code className={mono}>readOnly</code> does it for you.
                </>
              ),
              es: (
                <>
                  <code className={mono}>editor.readOnly = true</code> para alguien que solo puede mirar: los comandos no hacen nada y las teclas no escriben nada. En una sala, que el{' '}
                  <code className={mono}>admit</code> del servidor diga <code className={mono}>readOnly</code> lo hace por ti.
                </>
              ),
              zh: (
                <>
                  对只能查看的用户设置 <code className={mono}>editor.readOnly = true</code>：命令不执行任何操作，按键也不会输入任何内容。在房间中，服务器的 <code className={mono}>admit</code> 返回{' '}
                  <code className={mono}>readOnly</code> 即可自动实现。
                </>
              ),
            })}
          </p>,
        )}
        {lesson(
          t({ en: 'Opening a file without leaving the room', es: 'Abrir un archivo sin salir de la sala', zh: '不离开房间打开文件' }),
          <>
            <p className={prose}>
              {t({
                en: (
                  <>
                    <code className={mono}>docs.openFile()</code> replaces the document and leaves the room. To put another DOCX in its place as one more change, which the others receive and ⌘Z takes
                    back:
                  </>
                ),
                es: (
                  <>
                    <code className={mono}>docs.openFile()</code> reemplaza el documento y sale de la sala. Para poner otro DOCX en su lugar como un cambio más, que los demás reciben y ⌘Z deshace:
                  </>
                ),
                zh: (
                  <>
                    <code className={mono}>docs.openFile()</code> 会替换文档并离开房间。如果要把另一个 DOCX 作为一次普通修改放进来（其他人会收到，⌘Z 也能撤销）：
                  </>
                ),
              })}
            </p>
            {block(replace)}
          </>,
        )}
        {lesson(
          t({ en: 'Phones', es: 'Teléfonos', zh: '手机' }),
          <p className={prose}>
            {t({
              en: (
                <>
                  <code className={mono}>useDocsResponsive</code>, or <code className={mono}>commands.setFit(&apos;width&apos;)</code> on a narrow screen: the whole page across it, zoomed, without
                  setting the text out again. See{' '}
                </>
              ),
              es: (
                <>
                  <code className={mono}>useDocsResponsive</code>, o <code className={mono}>commands.setFit(&apos;width&apos;)</code> en una pantalla angosta: la página completa a lo ancho, con zoom,
                  sin reacomodar el texto. Ve{' '}
                </>
              ),
              zh: (
                <>
                  在窄屏上使用 <code className={mono}>useDocsResponsive</code> 或 <code className={mono}>commands.setFit(&apos;width&apos;)</code>：整页缩放到屏幕宽度，而不重新排版文字。参见
                </>
              ),
            })}
            {see('/docs/mobile/', { en: 'Phones and touch', es: 'Teléfonos y pantallas táctiles', zh: '手机与触屏' })}
            {dot}
          </p>,
        )}
        {lesson(
          t({ en: 'Full screen', es: 'Pantalla completa', zh: '全屏' }),
          <p className={prose}>
            {t({
              en: (
                <>
                  The bar beside the selection, menus and toasts are drawn on the page, outside the editor. Put the page in full screen (
                  <code className={mono}>document.documentElement.requestFullscreen()</code>) and the editor above everything with <code className={mono}>position: fixed</code>, rather than the
                  editor’s own element. The bar follows an element that holds the editor into full screen; your menus and toasts will not.
                </>
              ),
              es: (
                <>
                  La barra junto a la selección, los menús y los avisos se dibujan en la página, fuera del editor. Pon la página en pantalla completa (
                  <code className={mono}>document.documentElement.requestFullscreen()</code>) y el editor encima de todo con <code className={mono}>position: fixed</code>, en lugar del propio elemento
                  del editor. La barra sigue a un elemento que contiene al editor en pantalla completa; tus menús y avisos no.
                </>
              ),
              zh: (
                <>
                  选区旁的工具条、菜单和提示都绘制在页面上，位于编辑器之外。应该让整个页面全屏（<code className={mono}>document.documentElement.requestFullscreen()</code>），并用{' '}
                  <code className={mono}>position: fixed</code> 把编辑器置于最上层，而不是让编辑器自身的元素全屏。工具条会跟随包含编辑器的元素进入全屏，但你的菜单和提示不会。
                </>
              ),
            })}
          </p>,
        )}
        {lesson(
          t({ en: 'A room inside your API', es: 'Una sala dentro de tu API', zh: '把房间放进你的 API' }),
          <p className={prose}>
            {t({
              en: (
                <>
                  <code className={mono}>createCollabServer</code> without a <code className={mono}>port</code> gives a <code className={mono}>handle</code> to mount at{' '}
                  <code className={mono}>/collab</code> in Express or Nest, with a storage that calls your services straight. The browser must reach it directly: a proxy that reads the whole response
                  first (Next’s route handlers do) never ends a stream of server-sent events. See{' '}
                </>
              ),
              es: (
                <>
                  <code className={mono}>createCollabServer</code> sin un <code className={mono}>port</code> da un <code className={mono}>handle</code> para montar en{' '}
                  <code className={mono}>/collab</code> en Express o Nest, con un almacenamiento que llama directo a tus servicios. El navegador debe llegar a él directamente: un proxy que lee primero
                  la respuesta completa (como los route handlers de Next) nunca termina un flujo de server-sent events. Ve{' '}
                </>
              ),
              zh: (
                <>
                  不传 <code className={mono}>port</code> 时，<code className={mono}>createCollabServer</code> 会返回一个 <code className={mono}>handle</code>，可以在 Express 或 Nest 中挂载到{' '}
                  <code className={mono}>/collab</code>，并配一个直接调用你服务的存储。浏览器必须能直接访问它：先读完整个响应的代理（Next 的 route handler 就是这样）永远无法结束 server-sent events
                  流。参见
                </>
              ),
            })}
            {see('/docs/collaboration/', { en: 'collaboration', es: 'colaboración', zh: '协作' })}
            {dot}
          </p>,
        )}
        {lesson(
          t({ en: 'Lists', es: 'Listas', zh: '列表' }),
          <p className={prose}>
            {t({
              en: (
                <>
                  <code className={mono}>setListStyle({"{ format: 'lowerLetter', text: '#.-' }"})</code> writes “a.-”, “b.-”; <code className={mono}>restartNumbering()</code> and{' '}
                  <code className={mono}>continueNumbering()</code> for the caret’s item. Tab and ⇧Tab change the level wherever the caret is in an item, and Enter on an empty item goes up one.
                </>
              ),
              es: (
                <>
                  <code className={mono}>setListStyle({"{ format: 'lowerLetter', text: '#.-' }"})</code> escribe “a.-”, “b.-”; <code className={mono}>restartNumbering()</code> y{' '}
                  <code className={mono}>continueNumbering()</code> para el elemento del cursor. Tab y ⇧Tab cambian el nivel en cualquier parte del elemento donde esté el cursor, y Enter en un
                  elemento vacío sube uno.
                </>
              ),
              zh: (
                <>
                  <code className={mono}>setListStyle({"{ format: 'lowerLetter', text: '#.-' }"})</code> 会写出 “a.-”“b.-”；<code className={mono}>restartNumbering()</code> 和{' '}
                  <code className={mono}>continueNumbering()</code> 作用于光标所在的列表项。无论光标在列表项的哪个位置，Tab 和 ⇧Tab 都能改变级别；在空列表项上按 Enter 会上升一级。
                </>
              ),
            })}
          </p>,
        )}
      </section>
    </>
  );
}
