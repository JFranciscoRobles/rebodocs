import { useState } from 'react'
import {
  type FormatId,
  NOTE_COLORS,
  type OutlineItem,
  type PageNumbering,
  useDocs,
  useDocsBubble,
  useDocsNotes,
  useDocsOutline,
  useDocsPage,
  useDocsValue,
  useDocsVariables,
} from '@rebodocs/react'
import { CELL_SHADES, FONT_SIZES, HIGHLIGHTS, LINE_HEIGHTS, hex, withCurrent } from './options'

// Page sizes in points (1/72 in), as the editor keeps them, upright.
const PAPERS = [
  { id: 'letter', name: 'Carta', width: 612, height: 792 },
  { id: 'a4', name: 'A4', width: 595.3, height: 841.9 },
  { id: 'legal', name: 'Oficio', width: 612, height: 1008 },
]
const PT_PER_CM = 72 / 2.54
const SPACE_BEFORE = 12
const SPACE_AFTER = 8

const TYPES: [FormatId | '', string][] = [
  ['', 'Texto'],
  ['date', 'Fecha corta'],
  ['dateLong', 'Fecha larga'],
  ['dateFull', 'Fecha completa'],
  ['number', 'Número'],
  ['currency', 'Moneda'],
]
const CASES: [FormatId | '', string][] = [
  ['', 'Como se escriba'],
  ['upper', 'MAYÚSCULAS'],
  ['lower', 'minúsculas'],
  ['capital', 'Cada Palabra'],
]
const MARKS: [FormatId, string, string][] = [
  ['bold', 'N', 'Negrita'],
  ['italic', 'K', 'Cursiva'],
  ['underline', 'S', 'Subrayado'],
]

const MARGINS = [
  { key: 'marginTop', label: 'Superior' },
  { key: 'marginBottom', label: 'Inferior' },
  { key: 'marginLeft', label: 'Izquierdo' },
  { key: 'marginRight', label: 'Derecho' },
] as const

function Swatches({ colors, active, label, onPick }: { colors: string[]; active: string; label: string; onPick: (color: string) => void }) {
  return (
    <div className="hd-swatches" role="group" aria-label={label}>
      {colors.map((color) => (
        <button
          key={color}
          className={color.toLowerCase() === active.toLowerCase() ? 'on' : ''}
          style={{ background: `#${color}` }}
          aria-label={`#${color}`}
          title={`#${color}`}
          onClick={() => onPick(color)}
        />
      ))}
    </div>
  )
}

function Check({ on, disabled, onChange, children }: { on: boolean; disabled?: boolean; onChange: (on: boolean) => void; children: string }) {
  return (
    <label className="hd-check">
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}

function Format() {
  const { state, commands } = useDocs()
  const paragraph = useDocsValue((e) => {
    const props = e.activeParagraphProps()
    return { before: props.spacingBefore > 0, after: props.spacingAfter > 0, keepNext: !!props.keepNext }
  }, null)
  const cell = useDocsValue((e) => e.activeCellProps() ?? null, null)
  const tableBorders = useDocsValue((e) => e.tableBorders() ?? null, null)
  const table = state.inTable && state.canEditTables
  const [size, setSize] = useState({ rows: 3, columns: 3 })

  return (
    <div className="hd-panel-body">
      <h3>Carácter</h3>
      <div className="hd-grid">
        <label className="hd-field">
          Tamaño
          <select value={state.fontSize} onChange={(e) => commands.setRunProps({ fontSize: Number(e.target.value) })}>
            {withCurrent(FONT_SIZES, state.fontSize).map((size) => (
              <option key={size} value={size}>{size} pt</option>
            ))}
          </select>
        </label>
        <label className="hd-field">
          Color
          <input type="color" value={hex(state.color, '#000000')} onChange={(e) => commands.setRunProps({ color: e.target.value.slice(1) })} />
        </label>
      </div>
      <div className="hd-field">
        Resaltado
        <Swatches colors={HIGHLIGHTS} active={state.highlight} label="Resaltado" onPick={(highlight) => commands.setRunProps({ highlight })} />
        <button disabled={!state.highlight} onClick={() => commands.setRunProps({ highlight: '' })}>Sin resaltado</button>
      </div>

      <h3>Párrafo</h3>
      <label className="hd-field">
        Interlineado
        <select value={state.lineHeight} onChange={(e) => commands.setParagraphProps({ lineHeight: Number(e.target.value) })}>
          {withCurrent(LINE_HEIGHTS, Number(state.lineHeight.toFixed(2))).map((value) => (
            <option key={value} value={value}>{value.toLocaleString('es', { minimumFractionDigits: 1 })}</option>
          ))}
        </select>
      </label>
      <Check on={!!paragraph?.before} onChange={(on) => commands.setParagraphProps({ spacingBefore: on ? SPACE_BEFORE : 0 })}>Espacio antes del párrafo</Check>
      <Check on={!!paragraph?.after} onChange={(on) => commands.setParagraphProps({ spacingAfter: on ? SPACE_AFTER : 0 })}>Espacio después del párrafo</Check>
      <Check on={!!paragraph?.keepNext} onChange={(keepNext) => commands.setParagraphProps({ keepNext })}>Mantener con el siguiente</Check>

      <h3>Tabla</h3>
      {!table && (
        <>
          <div className="hd-grid">
            <label className="hd-field">
              Filas
              <input type="number" min="1" max="50" value={size.rows} onChange={(e) => setSize({ ...size, rows: e.target.valueAsNumber || 1 })} />
            </label>
            <label className="hd-field">
              Columnas
              <input type="number" min="1" max="12" value={size.columns} onChange={(e) => setSize({ ...size, columns: e.target.valueAsNumber || 1 })} />
            </label>
          </div>
          <button disabled={!state.canEditTables || state.inTable} onClick={() => commands.insertTable(size.rows, size.columns)}>Insertar tabla</button>
          <p className="hd-empty">Con el cursor en una tabla, aquí aparecen sus filas, columnas y celdas.</p>
        </>
      )}
      {table && (
        <>
          <div className="hd-grid">
            <button disabled={!state.canMergeCells} onClick={() => commands.mergeTableCells()}>Combinar celdas</button>
            <button disabled={!state.canSplitCell} onClick={() => commands.splitTableCell()}>Dividir celda</button>
            <button onClick={() => commands.insertTableRow(false)}>Fila arriba</button>
            <button onClick={() => commands.insertTableRow(true)}>Fila abajo</button>
            <button onClick={() => commands.insertTableColumn(false)}>Columna izquierda</button>
            <button onClick={() => commands.insertTableColumn(true)}>Columna derecha</button>
            <button onClick={() => commands.deleteTableRow()}>Eliminar fila</button>
            <button onClick={() => commands.deleteTableColumn()}>Eliminar columna</button>
          </div>
          <Check on={!!tableBorders} onChange={(on) => commands.setTableBorders(on)}>Bordes de la tabla</Check>
          {cell && (
            <>
              <Check on={cell.borders} onChange={(borders) => commands.setTableCellProps({ borders })}>Bordes de la celda</Check>
              <div className="hd-field">
                Sombreado
                <Swatches colors={CELL_SHADES} active={cell.shade} label="Sombreado" onPick={(shade) => commands.setTableCellProps({ shade })} />
                <button disabled={!cell.shade} onClick={() => commands.setTableCellProps({ shade: '' })}>Sin sombreado</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Page() {
  const { state, commands } = useDocs()
  const page = useDocsPage()
  const setup = page.page
  const landscape = !!setup && setup.width > setup.height
  const short = setup ? Math.min(setup.width, setup.height) : 0
  const long = setup ? Math.max(setup.width, setup.height) : 0
  const paper = PAPERS.find((p) => Math.abs(p.width - short) < 1 && Math.abs(p.height - long) < 1)
  const numbering = page.numbering
  const base: PageNumbering = numbering ?? { place: 'footer', align: 'center', format: 'number' }
  const formats: [PageNumbering['format'], string][] = [
    ['number', `${state.page}`],
    ['numberOfTotal', `${state.page} / ${state.pageCount}`],
    ['page', `Página ${state.page}`],
    ['pageOfTotal', `Página ${state.page} de ${state.pageCount}`],
  ]

  return (
    <div className="hd-panel-body">
      <h3>Hoja</h3>
      <div className="hd-grid">
        <label className="hd-field">
          Tamaño
          <select
            value={paper?.id ?? ''}
            disabled={!setup}
            onChange={(e) => {
              const next = PAPERS.find((p) => p.id === e.target.value)
              if (next) page.set(landscape ? { width: next.height, height: next.width } : { width: next.width, height: next.height })
            }}
          >
            {!paper && <option value="">Personalizado</option>}
            {PAPERS.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="hd-field">
          Orientación
          <select
            value={landscape ? 'landscape' : 'portrait'}
            disabled={!setup}
            onChange={(e) => {
              if ((e.target.value === 'landscape') !== landscape) page.set({ width: setup!.height, height: setup!.width })
            }}
          >
            <option value="portrait">Vertical</option>
            <option value="landscape">Horizontal</option>
          </select>
        </label>
      </div>
      <div className="hd-grid">
        {MARGINS.map(({ key, label }) => (
          <label key={key} className="hd-field">
            {label} (cm)
            <input
              type="number"
              min="0"
              max="8"
              step="0.1"
              disabled={!setup}
              value={setup ? Number((setup[key] / PT_PER_CM).toFixed(1)) : ''}
              onChange={(e) => {
                const cm = e.target.valueAsNumber
                if (Number.isFinite(cm) && cm >= 0) page.set({ [key]: cm * PT_PER_CM })
              }}
            />
          </label>
        ))}
      </div>

      <h3>Membrete</h3>
      <label className="hd-outline">
        {page.letterhead ? 'Cambiar membrete…' : 'Añadir membrete…'}
        <input
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void page.setLetterhead(file)
            e.target.value = ''
          }}
        />
      </label>
      {page.letterhead && (
        <div className="hd-grid">
          <button onClick={() => void page.fitLetterheadMargins()}>Ajustar márgenes</button>
          <button onClick={() => page.removeLetterhead()}>Quitar</button>
        </div>
      )}

      <h3>Encabezado y pie</h3>
      <div className="hd-grid">
        <button className={state.area === 'header' ? 'on' : ''} onClick={() => commands.setArea(state.area === 'header' ? 'body' : 'header')}>
          Editar encabezado
        </button>
        <button className={state.area === 'footer' ? 'on' : ''} onClick={() => commands.setArea(state.area === 'footer' ? 'body' : 'footer')}>
          Editar pie
        </button>
      </div>
      <Check on={page.firstPageDifferent} onChange={(on) => page.setFirstPageDifferent(on)}>Primera página diferente</Check>

      <h3>Número de página</h3>
      <div className="hd-grid">
        <label className="hd-field">
          Lugar
          <select
            value={numbering?.place ?? ''}
            onChange={(e) => page.setNumbering(e.target.value ? { ...base, place: e.target.value as PageNumbering['place'] } : undefined)}
          >
            <option value="">Ninguno</option>
            <option value="header">Encabezado</option>
            <option value="footer">Pie</option>
          </select>
        </label>
        <label className="hd-field">
          Posición
          <select value={base.align} disabled={!numbering} onChange={(e) => page.setNumbering({ ...base, align: e.target.value as PageNumbering['align'] })}>
            <option value="left">Izquierda</option>
            <option value="center">Centro</option>
            <option value="right">Derecha</option>
          </select>
        </label>
      </div>
      <label className="hd-field">
        Formato
        <select value={base.format} disabled={!numbering} onChange={(e) => page.setNumbering({ ...base, format: e.target.value as PageNumbering['format'] })}>
          {formats.map(([format, example]) => (
            <option key={format} value={format}>{example}</option>
          ))}
        </select>
      </label>
    </div>
  )
}

function Outline() {
  const outline = useDocsOutline()
  const [dragged, setDragged] = useState<OutlineItem>()
  const [over, setOver] = useState<number>()
  // A section goes before the heading it is dropped on; the title of the document stays where it is.
  const drop = (before?: OutlineItem) => {
    if (dragged && before?.para !== dragged.para) outline.move(dragged, before)
    setDragged(undefined)
    setOver(undefined)
  }

  return (
    <nav className="hd-outline-list" aria-label="Esquema" onDragEnd={() => drop(dragged)}>
      {outline.items.length === 0 && <p className="hd-empty">Sin encabezados.</p>}
      {outline.items.map((item, index) => (
        <button
          key={item.para}
          className={`${index === outline.active ? 'on' : ''} ${over === index ? 'over' : ''}`}
          style={{ paddingLeft: 10 + Math.max(item.level - 1, 0) * 12, fontWeight: item.level === 0 ? 600 : undefined }}
          title={item.level > 0 ? 'Arrastra para mover la sección' : undefined}
          draggable={item.level > 0}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            setDragged(item)
          }}
          onDragOver={(e) => {
            if (!dragged || item.level === 0) return
            e.preventDefault()
            setOver(index)
          }}
          onDragLeave={() => setOver(undefined)}
          onDrop={(e) => {
            e.preventDefault()
            drop(item)
          }}
          onClick={() => outline.goTo(item)}
        >
          {item.text}
        </button>
      ))}
      {dragged && (
        <div
          className={`hd-drop-end ${over === -1 ? 'over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(-1)
          }}
          onDragLeave={() => setOver(undefined)}
          onDrop={(e) => {
            e.preventDefault()
            drop(undefined)
          }}
        >
          Soltar aquí para llevarla al final
        </div>
      )}
    </nav>
  )
}

function Variables() {
  const variables = useDocsVariables()
  const [values, setValues] = useState<Record<string, string>>({})
  const filled = Object.fromEntries(variables.names.filter((name) => values[name]).map((name) => [name, values[name]]))

  async function load(file: File | undefined) {
    if (!file) return
    try {
      const data: unknown = JSON.parse(await file.text())
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object')
      setValues({ ...values, ...Object.fromEntries(Object.entries(data).map(([name, value]) => [name, String(value ?? '')])) })
    } catch {
      window.alert('Ese archivo no es un JSON con un valor por variable.')
    }
  }

  return (
    <div className="hd-panel-body">
      <h3>Variables</h3>
      {variables.names.length === 0 && <p className="hd-empty">El documento no tiene variables.</p>}
      {variables.names.map((name) => {
        const formats = variables.formats[name] ?? []
        const has = (id: FormatId) => formats.some((format) => format.id === id)
        const chosen = (options: [FormatId | '', string][]) => options.find(([id]) => id && has(id))?.[0] ?? ''
        // One of a kind takes the place of another; none takes away the one there is.
        const choose = (options: [FormatId | '', string][], next: string) => {
          const current = chosen(options)
          if (next) variables.setFormat(name, next as FormatId, true)
          else if (current) variables.setFormat(name, current, false)
        }
        const value = values[name] ?? ''
        const preview = variables.preview(name, value)
        const uses = variables.uses[name] ?? 1
        return (
          <div key={name} className={`hd-var ${name === variables.active ? 'on' : ''}`}>
            <button className="hd-var-name" title="Ir a la variable" onClick={() => variables.select(name)}>
              {name}
              {uses > 1 && <small> · {uses} usos</small>}
            </button>
            <input aria-label={`Valor de ${name}`} placeholder="Valor" value={value} onChange={(e) => setValues({ ...values, [name]: e.target.value })} />
            <div className="hd-var-formats">
              <select aria-label={`Tipo de ${name}`} value={chosen(TYPES)} onChange={(e) => choose(TYPES, e.target.value)}>
                {TYPES.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
              <select aria-label={`Mayúsculas de ${name}`} value={chosen(CASES)} onChange={(e) => choose(CASES, e.target.value)}>
                {CASES.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
              {MARKS.map(([id, letter, label]) => (
                <button key={id} className={`hd-mark-${id} ${has(id) ? 'on' : ''}`} aria-pressed={has(id)} aria-label={label} title={label} onClick={() => variables.setFormat(name, id, !has(id))}>
                  {letter}
                </button>
              ))}
            </div>
            {preview.bad ? (
              <small className="hd-var-bad">{has('number') || has('currency') ? 'No es un número' : 'No es una fecha'}</small>
            ) : (
              value !== '' && preview.text !== value && <small>→ {preview.text}</small>
            )}
          </div>
        )
      })}
      {variables.names.length > 0 && (
        <div className="hd-grid">
          <label className="hd-outline">
            Cargar JSON…
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                void load(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
          <button className="hd-solid" disabled={Object.keys(filled).length === 0} onClick={() => variables.fill(filled)}>
            Rellenar
          </button>
        </div>
      )}
    </div>
  )
}

function Content() {
  const { state, commands } = useDocs()
  const hasToc = useDocsValue((e) => e.hasToc, false)

  return (
    <>
      <div className="hd-panel-body">
        <h3>Esquema</h3>
        {hasToc ? (
          <button onClick={() => commands.updateToc()}>Actualizar índice</button>
        ) : (
          <button disabled={state.area !== 'body' || state.inTable} onClick={() => commands.insertToc()}>Insertar índice</button>
        )}
      </div>
      <Outline />
      <Variables />
    </>
  )
}

function Notes() {
  const { state, commands, docs } = useDocs()
  const bubble = useDocsBubble()
  const notes = useDocsNotes()
  const shown = useDocsValue((e) => e.showNotes, false)

  return (
    <div className="hd-panel-body">
      <label className="hd-field">
        Tu nombre, con el que se firman las notas
        <input value={state.me.name} onChange={(e) => docs?.setAuthor(e.target.value)} />
      </label>
      <button className="hd-outline" onClick={() => bubble?.ask('note')}>Añadir nota a la selección</button>
      <Check on={shown} onChange={(on) => commands.setShowNotes(on)}>Mostrar notas junto a la página</Check>
      {notes.notes.length === 0 && <p className="hd-empty">El documento no tiene notas.</p>}
      {notes.notes.map((note) => (
        <article key={note.id} className={`hd-note ${note.id === notes.active ? 'on' : ''}`} style={{ borderLeftColor: `#${note.color}` }}>
          <button className="hd-note-excerpt" title="Ir al texto" onClick={() => notes.select(note.id)}>
            «{note.excerpt}»
          </button>
          <textarea aria-label={`Nota de ${note.author}`} rows={2} value={note.text} onChange={(e) => notes.setText(note.id, e.target.value)} />
          <footer>
            <span>{note.author}</span>
            <span className="hd-dots" role="group" aria-label="Color de la nota">
              {NOTE_COLORS.map((color) => (
                <button
                  key={color}
                  className={color === note.color ? 'on' : ''}
                  style={{ background: `#${color}` }}
                  aria-label={`#${color}`}
                  onClick={() => notes.setColor(note.id, color)}
                />
              ))}
            </span>
            <button onClick={() => notes.remove(note.id)}>Eliminar</button>
          </footer>
        </article>
      ))}
    </div>
  )
}

const TABS = [
  { id: 'format', label: 'Formato', panel: Format },
  { id: 'page', label: 'Página', panel: Page },
  { id: 'content', label: 'Contenido', panel: Content },
  { id: 'notes', label: 'Notas', panel: Notes },
] as const

export function Panels({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('format')
  const Panel = TABS.find((t) => t.id === tab)!.panel

  return (
    <aside className={`hd-panels ${open ? 'open' : ''}`} aria-label="Paneles">
      <div className="hd-tabs" role="tablist">
        {TABS.map(({ id, label }) => (
          <button key={id} role="tab" aria-selected={id === tab} className={id === tab ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        {/* Only where the panels lie over the document: beside it they are always there. */}
        <button className="hd-panels-close" aria-label="Cerrar paneles" onClick={onClose}>✕</button>
      </div>
      <Panel />
    </aside>
  )
}
