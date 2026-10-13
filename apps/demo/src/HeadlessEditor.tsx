import { useState, useSyncExternalStore } from 'react'
import {
  DocsProvider,
  DocsRuler,
  DocsSurface,
  fontFamilies,
  getLocale,
  onLocaleChange,
  setLocale,
  useDocs,
  useDocsBubble,
  useDocsCount,
  useDocsFind,
  useDocsLink,
  useDocsNotes,
  useDocsResponsive,
  useDocsStyles,
  useDocsValue,
  useDocsVariables,
} from '@rebodocs/react'
import { download, saveFile } from './download'
import { Icon, type IconName } from './headless/Icon'
import { Panels } from './headless/Panels'
import { FONT_SIZES, INDENT_STEP, ZOOMS, hex, withCurrent } from './headless/options'
import './HeadlessEditor.css'

interface Props {
  docx?: Uint8Array
  name: string
}

const ALIGNS = [
  { align: 'left', label: 'Alinear a la izquierda' },
  { align: 'center', label: 'Centrar' },
  { align: 'right', label: 'Alinear a la derecha' },
  { align: 'justify', label: 'Justificar' },
] as const

const MARKS = [
  { mark: 'bold', label: 'Negrita', text: 'B' },
  { mark: 'italic', label: 'Cursiva', text: 'I' },
  { mark: 'underline', label: 'Subrayado', text: 'U' },
  { mark: 'strike', label: 'Tachado', text: 'S' },
] as const

function IconButton(props: { icon: IconName; label: string; on?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      className={`hd-icon ${props.on ? 'on' : ''}`}
      aria-label={props.label}
      aria-pressed={props.on}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <Icon name={props.icon} />
    </button>
  )
}

const VIEWS = [
  { view: 'column', label: 'Una columna' },
  { view: 'spread', label: 'Dos páginas' },
  { view: 'grid', label: 'Cuadrícula' },
  { view: 'flow', label: 'Sin páginas' },
] as const

const NARROW = '(max-width: 900px)'
const watchNarrow = (listener: () => void) => {
  const media = window.matchMedia(NARROW)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

function TitleBar({ panels, onPanels }: { panels: boolean; onPanels: () => void }) {
  const { state, docs, editor, commands } = useDocs()
  const base = (state.name || 'documento').replace(/\.docx$/i, '')

  async function exportAs(format: string) {
    if (!docs || !editor) return
    if (format === 'docx') docs.download()
    else if (format === 'pdf') saveFile((await editor.exportPdf(base)) as BlobPart, `${base}.pdf`, 'application/pdf')
    else if (format === 'md') saveFile(editor.exportMarkdown(), `${base}.md`, 'text/markdown;charset=utf-8')
  }

  return (
    <header className="hd-title">
      <div className="hd-logo" aria-hidden="true">Rd</div>
      <div className="hd-name">
        <span>{state.name}</span>
        {state.dirty && <span className="hd-dot" role="img" aria-label="Cambios sin guardar" />}
      </div>
      <span className="hd-only-narrow">
        <IconButton icon="panel" label="Paneles" on={panels} onClick={onPanels} />
      </span>
      <IconButton icon="print" label="Imprimir" disabled={!docs} onClick={() => commands.print()} />
      <select
        className="hd-pill"
        aria-label="Exportar"
        disabled={!docs}
        value=""
        onChange={(e) => void exportAs(e.target.value)}
      >
        <option value="" disabled>Exportar…</option>
        <option value="docx">Word (.docx)</option>
        <option value="pdf">PDF</option>
        <option value="md">Markdown</option>
      </select>
      <button className="hd-pill primary" disabled={!docs} onClick={() => docs?.save()}>Guardar</button>
    </header>
  )
}

function Toolbar() {
  const { state, commands } = useDocs()
  const styles = useDocsStyles()
  const indent = useDocsValue((e) => e.activeParagraphProps().indentLeft, 0)
  const fonts = [...new Set([...fontFamilies(), ...state.fonts, state.fontFamily])].filter(Boolean).sort()

  return (
    <div className="hd-toolbar" role="toolbar" aria-label="Formato">
      <IconButton icon="undo" label="Deshacer" disabled={!state.canUndo} onClick={() => commands.undo()} />
      <IconButton icon="redo" label="Rehacer" disabled={!state.canRedo} onClick={() => commands.redo()} />
      <span className="hd-sep" />
      <select aria-label="Estilo de párrafo" style={{ width: 132 }} value={styles.active ?? ''} onChange={(e) => styles.set(e.target.value)}>
        {styles.active === undefined && <option value="">Varios</option>}
        {styles.styles.map((style) => (
          <option key={style.id} value={style.id}>{style.name}</option>
        ))}
      </select>
      <select aria-label="Fuente" style={{ width: 156 }} value={state.fontFamily} onChange={(e) => commands.setRunProps({ fontFamily: e.target.value })}>
        {fonts.map((font) => (
          <option key={font} value={font}>{font}</option>
        ))}
      </select>
      <select aria-label="Tamaño de fuente" style={{ width: 76 }} value={state.fontSize} onChange={(e) => commands.setRunProps({ fontSize: Number(e.target.value) })}>
        {withCurrent(FONT_SIZES, state.fontSize).map((size) => (
          <option key={size} value={size}>{size} pt</option>
        ))}
      </select>
      <span className="hd-sep" />
      {MARKS.map(({ mark, label, text }) => (
        <button
          key={mark}
          className={`hd-icon hd-mark-${mark} ${state[mark] ? 'on' : ''}`}
          aria-label={label}
          aria-pressed={state[mark]}
          title={label}
          onClick={() => commands.toggleMark(mark)}
        >
          {text}
        </button>
      ))}
      <label className="hd-icon hd-color" title="Color del texto">
        <span>A</span>
        <span className="hd-color-bar" style={{ background: hex(state.color, '#000000') }} />
        <input
          type="color"
          aria-label="Color del texto"
          value={hex(state.color, '#000000')}
          onChange={(e) => commands.setRunProps({ color: e.target.value.slice(1) })}
        />
      </label>
      <span className="hd-sep" />
      {ALIGNS.map(({ align, label }) => (
        <IconButton key={align} icon={align} label={label} on={state.align === align} onClick={() => commands.setParagraphProps({ align })} />
      ))}
      <span className="hd-sep" />
      <IconButton icon="bullet" label="Lista con viñetas" on={state.list === 'bullet'} onClick={() => commands.toggleList('bullet')} />
      <IconButton icon="number" label="Lista numerada" on={state.list === 'number'} onClick={() => commands.toggleList('number')} />
      {/* In a list these change the level of the item; anywhere else, the indent of the paragraph. */}
      <IconButton
        icon="outdent"
        label="Reducir sangría"
        disabled={!state.list && indent <= 0}
        onClick={() => (state.list ? commands.shiftListLevel(-1) : commands.shiftIndent(-INDENT_STEP))}
      />
      <IconButton icon="indent" label="Aumentar sangría" onClick={() => (state.list ? commands.shiftListLevel(1) : commands.shiftIndent(INDENT_STEP))} />
      <span className="hd-grow" />
      <select
        aria-label="Zoom"
        style={{ width: 132 }}
        value={state.fit ?? state.zoom}
        onChange={(e) => {
          const value = e.target.value
          if (value === 'width' || value === 'page') commands.setFit(value)
          else commands.setZoom(Number(value))
        }}
      >
        {withCurrent(ZOOMS, state.zoom).map((zoom) => (
          <option key={zoom} value={zoom}>{Math.round(zoom * 100)} %</option>
        ))}
        <option value="width">Ajustar al ancho</option>
        <option value="page">Página completa</option>
      </select>
    </div>
  )
}

function Rail({ finding, onFind }: { finding: boolean; onFind: () => void }) {
  const { state, commands } = useDocs()
  const bubble = useDocsBubble()
  const link = useDocsLink()
  const notes = useDocsNotes()
  const variables = useDocsVariables()

  return (
    <div className="hd-rail" role="toolbar" aria-label="Insertar">
      <IconButton icon="table" label="Insertar tabla 3×3" disabled={!state.canEditTables || state.inTable} onClick={() => commands.insertTable(3, 3)} />
      <label className="hd-icon" title="Insertar imagen (varias van en cuadrícula)">
        <Icon name="image" />
        <input
          type="file"
          accept="image/*"
          multiple
          aria-label="Insertar imagen"
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])]
            if (files.length > 1) void commands.insertImageGrid(files, 2)
            else if (files[0]) void commands.insertImageFile(files[0])
            e.target.value = ''
          }}
        />
      </label>
      <IconButton icon="link" label="Enlace" on={!!link.active} disabled={!link.possible} onClick={() => bubble?.ask('link')} />
      <IconButton icon="variable" label="Insertar variable" on={!!variables.active} onClick={() => bubble?.ask('variable')} />
      <IconButton icon="note" label="Añadir nota" on={!!notes.active} onClick={() => bubble?.ask('note')} />
      <IconButton icon="signature" label="Insertar firmas" onClick={() => commands.insertSignatures(['El Cliente', 'El Prestador'])} />
      <IconButton icon="pageBreak" label="Salto de página" onClick={() => commands.insertPageBreak()} />
      <IconButton icon="search" label="Buscar y reemplazar" on={finding} onClick={onFind} />
    </div>
  )
}

function FindBar({ onClose }: { onClose: () => void }) {
  const find = useDocsFind()
  const [replacement, setReplacement] = useState('')

  function close() {
    find.close()
    onClose()
  }

  return (
    <div className="hd-find" role="search">
      <input
        autoFocus
        aria-label="Buscar"
        placeholder="Buscar"
        value={find.query}
        onChange={(e) => find.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.shiftKey ? find.previous : find.next)()
          if (e.key === 'Escape') close()
        }}
      />
      <button className={find.options.matchCase ? 'on' : ''} aria-pressed={!!find.options.matchCase} title="Distinguir mayúsculas" onClick={() => find.setOptions({ ...find.options, matchCase: !find.options.matchCase })}>Aa</button>
      <button className={find.options.wholeWord ? 'on' : ''} aria-pressed={!!find.options.wholeWord} title="Palabra completa" onClick={() => find.setOptions({ ...find.options, wholeWord: !find.options.wholeWord })}><u>ab</u></button>
      <span className="hd-find-count">{find.count ? `${find.index} de ${find.count}` : 'Sin resultados'}</span>
      <IconButton icon="up" label="Anterior" disabled={!find.count} onClick={find.previous} />
      <IconButton icon="down" label="Siguiente" disabled={!find.count} onClick={find.next} />
      <input aria-label="Reemplazar con" placeholder="Reemplazar con" value={replacement} onChange={(e) => setReplacement(e.target.value)} />
      <button disabled={!find.count} onClick={() => find.replace(replacement)}>Reemplazar</button>
      <button disabled={!find.count} onClick={() => find.replaceAll(replacement)}>Todo</button>
      <span className="hd-grow" />
      <IconButton icon="close" label="Cerrar búsqueda" onClick={close} />
    </div>
  )
}

function StatusBar() {
  const { ready, state, commands } = useDocs()
  const styles = useDocsStyles()
  const notes = useDocsValue((e) => e.showNotes, false)
  const count = useDocsCount()
  const locale = useSyncExternalStore(onLocaleChange, getLocale)
  const counted = (n: number, total: number, one: string, many: string) =>
    `${count.selected ? `${n.toLocaleString('es')} de ` : ''}${total.toLocaleString('es')} ${total === 1 ? one : many}`
  const zoomBy = (factor: number) => commands.setZoom(Math.min(4, Math.max(0.25, Math.round(state.zoom * factor * 20) / 20)))
  const style = styles.styles.find((s) => s.id === styles.active)?.name

  return (
    <footer className="hd-status">
      <span>{ready ? `Página ${state.page} de ${state.pageCount}` : 'Cargando…'}</span>
      {ready && <span className="hd-only-wide">{[style, state.fontFamily, `${state.fontSize} pt`].filter(Boolean).join(' · ')}</span>}
      {ready && <span className="hd-only-wide">{counted(count.selected?.words ?? 0, count.words, 'palabra', 'palabras')}</span>}
      {ready && <span className="hd-only-wide">{counted(count.selected?.characters ?? 0, count.characters, 'carácter', 'caracteres')}</span>}
      <span className="hd-grow" />
      <span className="hd-row">
        <span className={`hd-dot ${state.dirty ? '' : 'saved'}`} aria-hidden="true" />
        {state.dirty ? 'Sin guardar' : 'Guardado'}
      </span>
      {/* The language of what the library draws and names itself: the bar beside the selection, the ruler, the styles. */}
      <select aria-label="Idioma del editor" title="Idioma del editor" value={locale} onChange={(e) => setLocale(e.target.value)}>
        <option value="es">Español</option>
        <option value="en">English</option>
      </select>
      <select aria-label="Vista" value={state.view} onChange={(e) => commands.setView(e.target.value as (typeof VIEWS)[number]['view'])}>
        {VIEWS.map(({ view, label }) => (
          <option key={view} value={view}>{label}</option>
        ))}
      </select>
      <button className={notes ? 'on' : ''} aria-pressed={notes} disabled={state.view === 'grid' || state.view === 'flow'} onClick={() => commands.setShowNotes(!notes)}>
        Notas
      </button>
      <span className="hd-row">
        <button aria-label="Alejar" title="Alejar" onClick={() => zoomBy(1 / 1.1)}>−</button>
        <button title="Restablecer zoom" onClick={() => commands.setZoom(1)}>{Math.round(state.zoom * 100)} %</button>
        <button aria-label="Acercar" title="Acercar" onClick={() => zoomBy(1.1)}>+</button>
      </span>
    </footer>
  )
}

/** What is inside the provider: the layout, and what a narrow window asks of it. */
function Shell({ finding, setFinding }: { finding: boolean; setFinding: (finding: boolean) => void }) {
  const [panels, setPanels] = useState(false)
  const locale = useSyncExternalStore(onLocaleChange, getLocale)
  // The layout follows the window. The library fits the pages to the room they are left, and says how much the keyboard of the screen covers.
  const narrow = useSyncExternalStore(watchNarrow, () => window.matchMedia(NARROW).matches)
  const { keyboard } = useDocsResponsive()

  return (
    <div className={`hd ${narrow ? 'narrow' : ''}`} style={{ paddingBottom: keyboard || undefined }}>
      <TitleBar panels={panels} onPanels={() => setPanels(!panels)} />
      <Toolbar />
      <div className="hd-body">
        <Rail finding={finding} onFind={() => setFinding(!finding)} />
        <main className="hd-main">
          {finding && <FindBar onClose={() => setFinding(false)} />}
          {/* Made again in another language: what its markers are called is read when it is made. A narrow window has no room for it. */}
          {!narrow && <DocsRuler key={locale} />}
          <DocsSurface className="hd-surface" />
        </main>
        {narrow && panels && <button className="hd-scrim" aria-label="Cerrar paneles" onClick={() => setPanels(false)} />}
        <Panels open={panels} onClose={() => setPanels(false)} />
      </div>
      <StatusBar />
    </div>
  )
}

export function HeadlessEditor({ docx, name }: Props) {
  // Up here, where the provider is given who answers ⌘F.
  const [finding, setFinding] = useState(false)

  return (
    <DocsProvider docx={docx} name={name} author="Demo" onSave={download} bubble onFindKey={() => setFinding(true)}>
      <Shell finding={finding} setFinding={setFinding} />
    </DocsProvider>
  )
}
