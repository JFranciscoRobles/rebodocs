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
  getLocale,
  useDocsVariables,
} from '@rebodocs/react'
import { type Text, useTexts } from './texts'
import { CELL_SHADES, FONT_SIZES, HIGHLIGHTS, LINE_HEIGHTS, hex, withCurrent } from './options'

// Page sizes in points (1/72 in), as the editor keeps them, upright.
const PAPERS: { id: string; name: Text; width: number; height: number }[] = [
  { id: 'letter', name: 'Carta', width: 612, height: 792 },
  { id: 'a4', name: 'A4', width: 595.3, height: 841.9 },
  { id: 'legal', name: 'Oficio', width: 612, height: 1008 },
]
const PT_PER_CM = 72 / 2.54
const SPACE_BEFORE = 12
const SPACE_AFTER = 8

const TYPES: [FormatId | '', Text][] = [
  ['', 'Texto'],
  ['date', 'Fecha corta'],
  ['dateLong', 'Fecha larga'],
  ['dateFull', 'Fecha completa'],
  ['number', 'Número'],
  ['currency', 'Moneda'],
]
const CASES: [FormatId | '', Text][] = [
  ['', 'Como se escriba'],
  ['upper', 'MAYÚSCULAS'],
  ['lower', 'minúsculas'],
  ['capital', 'Cada Palabra'],
]
const MARKS: [FormatId, Text, Text][] = [
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
  const tr = useTexts()
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
      <h3>{tr('Carácter')}</h3>
      <div className="hd-grid">
        <label className="hd-field">
          {tr('Tamaño')}
          <select value={state.fontSize} onChange={(e) => commands.setRunProps({ fontSize: Number(e.target.value) })}>
            {withCurrent(FONT_SIZES, state.fontSize).map((size) => (
              <option key={size} value={size}>{size} pt</option>
            ))}
          </select>
        </label>
        <label className="hd-field">
          {tr('Color')}
          <input type="color" value={hex(state.color, '#000000')} onChange={(e) => commands.setRunProps({ color: e.target.value.slice(1) })} />
        </label>
      </div>
      <div className="hd-field">
        {tr('Resaltado')}
        <Swatches colors={HIGHLIGHTS} active={state.highlight} label={tr('Resaltado')} onPick={(highlight) => commands.setRunProps({ highlight })} />
        <button disabled={!state.highlight} onClick={() => commands.setRunProps({ highlight: '' })}>{tr('Sin resaltado')}</button>
      </div>

      <h3>{tr('Párrafo')}</h3>
      <label className="hd-field">
        {tr('Interlineado')}
        <select value={state.lineHeight} onChange={(e) => commands.setParagraphProps({ lineHeight: Number(e.target.value) })}>
          {withCurrent(LINE_HEIGHTS, Number(state.lineHeight.toFixed(2))).map((value) => (
            <option key={value} value={value}>{value.toLocaleString(getLocale(), { minimumFractionDigits: 1 })}</option>
          ))}
        </select>
      </label>
      <Check on={!!paragraph?.before} onChange={(on) => commands.setParagraphProps({ spacingBefore: on ? SPACE_BEFORE : 0 })}>{tr('Espacio antes del párrafo')}</Check>
      <Check on={!!paragraph?.after} onChange={(on) => commands.setParagraphProps({ spacingAfter: on ? SPACE_AFTER : 0 })}>{tr('Espacio después del párrafo')}</Check>
      <Check on={!!paragraph?.keepNext} onChange={(keepNext) => commands.setParagraphProps({ keepNext })}>{tr('Mantener con el siguiente')}</Check>

      <h3>{tr('Tabla')}</h3>
      {!table && (
        <>
          <div className="hd-grid">
            <label className="hd-field">
              {tr('Filas')}
              <input type="number" min="1" max="50" value={size.rows} onChange={(e) => setSize({ ...size, rows: e.target.valueAsNumber || 1 })} />
            </label>
            <label className="hd-field">
              {tr('Columnas')}
              <input type="number" min="1" max="12" value={size.columns} onChange={(e) => setSize({ ...size, columns: e.target.valueAsNumber || 1 })} />
            </label>
          </div>
          <button disabled={!state.canEditTables || state.inTable} onClick={() => commands.insertTable(size.rows, size.columns)}>{tr('Insertar tabla')}</button>
          <p className="hd-empty">{tr('Con el cursor en una tabla, aquí aparecen sus filas, columnas y celdas.')}</p>
        </>
      )}
      {table && (
        <>
          <div className="hd-grid">
            <button disabled={!state.canMergeCells} onClick={() => commands.mergeTableCells()}>{tr('Combinar celdas')}</button>
            <button disabled={!state.canSplitCell} onClick={() => commands.splitTableCell()}>{tr('Dividir celda')}</button>
            <button onClick={() => commands.insertTableRow(false)}>{tr('Fila arriba')}</button>
            <button onClick={() => commands.insertTableRow(true)}>{tr('Fila abajo')}</button>
            <button onClick={() => commands.insertTableColumn(false)}>{tr('Columna izquierda')}</button>
            <button onClick={() => commands.insertTableColumn(true)}>{tr('Columna derecha')}</button>
            <button onClick={() => commands.deleteTableRow()}>{tr('Eliminar fila')}</button>
            <button onClick={() => commands.deleteTableColumn()}>{tr('Eliminar columna')}</button>
          </div>
          <Check on={!!tableBorders} onChange={(on) => commands.setTableBorders(on)}>{tr('Bordes de la tabla')}</Check>
          {cell && (
            <>
              <Check on={cell.borders} onChange={(borders) => commands.setTableCellProps({ borders })}>{tr('Bordes de la celda')}</Check>
              <div className="hd-field">
                {tr('Sombreado')}
                <Swatches colors={CELL_SHADES} active={cell.shade} label={tr('Sombreado')} onPick={(shade) => commands.setTableCellProps({ shade })} />
                <button disabled={!cell.shade} onClick={() => commands.setTableCellProps({ shade: '' })}>{tr('Sin sombreado')}</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Page() {
  const tr = useTexts()
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
    ['page', tr('Página {page}', { page: state.page })],
    ['pageOfTotal', tr('Página {page} de {pages}', { page: state.page, pages: state.pageCount })],
  ]

  return (
    <div className="hd-panel-body">
      <h3>{tr('Hoja')}</h3>
      <div className="hd-grid">
        <label className="hd-field">
          {tr('Tamaño')}
          <select
            value={paper?.id ?? ''}
            disabled={!setup}
            onChange={(e) => {
              const next = PAPERS.find((p) => p.id === e.target.value)
              if (next) page.set(landscape ? { width: next.height, height: next.width } : { width: next.width, height: next.height })
            }}
          >
            {!paper && <option value="">{tr('Personalizado')}</option>}
            {PAPERS.map((p) => (
              <option key={p.id} value={p.id}>{tr(p.name)}</option>
            ))}
          </select>
        </label>
        <label className="hd-field">
          {tr('Orientación')}
          <select
            value={landscape ? 'landscape' : 'portrait'}
            disabled={!setup}
            onChange={(e) => {
              if ((e.target.value === 'landscape') !== landscape) page.set({ width: setup!.height, height: setup!.width })
            }}
          >
            <option value="portrait">{tr('Vertical')}</option>
            <option value="landscape">{tr('Horizontal')}</option>
          </select>
        </label>
      </div>
      <div className="hd-grid">
        {MARGINS.map(({ key, label }) => (
          <label key={key} className="hd-field">
            {tr(label)} (cm)
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

      <h3>{tr('Membrete')}</h3>
      <label className="hd-outline">
        {page.letterhead ? tr('Cambiar membrete…') : tr('Añadir membrete…')}
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
          <button onClick={() => void page.fitLetterheadMargins()}>{tr('Ajustar márgenes')}</button>
          <button onClick={() => page.removeLetterhead()}>{tr('Quitar')}</button>
        </div>
      )}

      <h3>{tr('Encabezado y pie')}</h3>
      <div className="hd-grid">
        <button className={state.area === 'header' ? 'on' : ''} onClick={() => commands.setArea(state.area === 'header' ? 'body' : 'header')}>
          {tr('Editar encabezado')}
        </button>
        <button className={state.area === 'footer' ? 'on' : ''} onClick={() => commands.setArea(state.area === 'footer' ? 'body' : 'footer')}>
          {tr('Editar pie')}
        </button>
      </div>
      <Check on={page.firstPageDifferent} onChange={(on) => page.setFirstPageDifferent(on)}>{tr('Primera página diferente')}</Check>

      <h3>{tr('Número de página')}</h3>
      <div className="hd-grid">
        <label className="hd-field">
          {tr('Lugar')}
          <select
            value={numbering?.place ?? ''}
            onChange={(e) => page.setNumbering(e.target.value ? { ...base, place: e.target.value as PageNumbering['place'] } : undefined)}
          >
            <option value="">{tr('Ninguno')}</option>
            <option value="header">{tr('Encabezado')}</option>
            <option value="footer">{tr('Pie')}</option>
          </select>
        </label>
        <label className="hd-field">
          {tr('Posición')}
          <select value={base.align} disabled={!numbering} onChange={(e) => page.setNumbering({ ...base, align: e.target.value as PageNumbering['align'] })}>
            <option value="left">{tr('Izquierda')}</option>
            <option value="center">{tr('Centro')}</option>
            <option value="right">{tr('Derecha')}</option>
          </select>
        </label>
      </div>
      <label className="hd-field">
        {tr('Formato')}
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
  const tr = useTexts()
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
    <nav className="hd-outline-list" aria-label={tr('Esquema')} onDragEnd={() => drop(dragged)}>
      {outline.items.length === 0 && <p className="hd-empty">{tr('Sin encabezados.')}</p>}
      {outline.items.map((item, index) => (
        <button
          key={item.para}
          className={`${index === outline.active ? 'on' : ''} ${over === index ? 'over' : ''}`}
          style={{ paddingLeft: 10 + Math.max(item.level - 1, 0) * 12, fontWeight: item.level === 0 ? 600 : undefined }}
          title={item.level > 0 ? tr('Arrastra para mover la sección') : undefined}
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
          {tr('Soltar aquí para llevarla al final')}
        </div>
      )}
    </nav>
  )
}

function Variables() {
  const tr = useTexts()
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
      window.alert(tr('Ese archivo no es un JSON con un valor por variable.'))
    }
  }

  return (
    <div className="hd-panel-body">
      <h3>{tr('Variables')}</h3>
      {variables.names.length === 0 && <p className="hd-empty">{tr('El documento no tiene variables.')}</p>}
      {variables.names.map((name) => {
        const formats = variables.formats[name] ?? []
        const has = (id: FormatId) => formats.some((format) => format.id === id)
        const chosen = (options: [FormatId | '', Text][]) => options.find(([id]) => id && has(id))?.[0] ?? ''
        // One of a kind takes the place of another; none takes away the one there is.
        const choose = (options: [FormatId | '', Text][], next: string) => {
          const current = chosen(options)
          if (next) variables.setFormat(name, next as FormatId, true)
          else if (current) variables.setFormat(name, current, false)
        }
        const value = values[name] ?? ''
        const preview = variables.preview(name, value)
        const uses = variables.uses[name] ?? 1
        return (
          <div key={name} className={`hd-var ${name === variables.active ? 'on' : ''}`}>
            <button className="hd-var-name" title={tr('Ir a la variable')} onClick={() => variables.select(name)}>
              {name}
              {uses > 1 && <small> · {tr('{n} usos', { n: uses })}</small>}
            </button>
            <input aria-label={tr('Valor de {name}', { name })} placeholder={tr('Valor')} value={value} onChange={(e) => setValues({ ...values, [name]: e.target.value })} />
            <div className="hd-var-formats">
              <select aria-label={tr('Tipo de {name}', { name })} value={chosen(TYPES)} onChange={(e) => choose(TYPES, e.target.value)}>
                {TYPES.map(([id, label]) => (
                  <option key={id} value={id}>{tr(label)}</option>
                ))}
              </select>
              <select aria-label={tr('Mayúsculas de {name}', { name })} value={chosen(CASES)} onChange={(e) => choose(CASES, e.target.value)}>
                {CASES.map(([id, label]) => (
                  <option key={id} value={id}>{tr(label)}</option>
                ))}
              </select>
              {MARKS.map(([id, letter, label]) => (
                <button key={id} className={`hd-mark-${id} ${has(id) ? 'on' : ''}`} aria-pressed={has(id)} aria-label={tr(label)} title={tr(label)} onClick={() => variables.setFormat(name, id, !has(id))}>
                  {tr(letter)}
                </button>
              ))}
            </div>
            {preview.bad ? (
              <small className="hd-var-bad">{has('number') || has('currency') ? tr('No es un número') : tr('No es una fecha')}</small>
            ) : (
              value !== '' && preview.text !== value && <small>→ {preview.text}</small>
            )}
          </div>
        )
      })}
      {variables.names.length > 0 && (
        <div className="hd-grid">
          <label className="hd-outline">
            {tr('Cargar JSON…')}
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
            {tr('Rellenar')}
          </button>
        </div>
      )}
    </div>
  )
}

function Content() {
  const tr = useTexts()
  const { state, commands } = useDocs()
  const hasToc = useDocsValue((e) => e.hasToc, false)

  return (
    <>
      <div className="hd-panel-body">
        <h3>{tr('Esquema')}</h3>
        {hasToc ? (
          <button onClick={() => commands.updateToc()}>{tr('Actualizar índice')}</button>
        ) : (
          <button disabled={state.area !== 'body' || state.inTable} onClick={() => commands.insertToc()}>{tr('Insertar índice')}</button>
        )}
      </div>
      <Outline />
      <Variables />
    </>
  )
}

function Notes() {
  const tr = useTexts()
  const { state, commands, docs } = useDocs()
  const bubble = useDocsBubble()
  const notes = useDocsNotes()
  const shown = useDocsValue((e) => e.showNotes, false)

  return (
    <div className="hd-panel-body">
      <label className="hd-field">
        {tr('Tu nombre, con el que se firman las notas')}
        <input value={state.me.name} onChange={(e) => docs?.setAuthor(e.target.value)} />
      </label>
      <button className="hd-outline" onClick={() => bubble?.ask('note')}>{tr('Añadir nota a la selección')}</button>
      <Check on={shown} onChange={(on) => commands.setShowNotes(on)}>{tr('Mostrar notas junto a la página')}</Check>
      {notes.notes.length === 0 && <p className="hd-empty">{tr('El documento no tiene notas.')}</p>}
      {notes.notes.map((note) => (
        <article key={note.id} className={`hd-note ${note.id === notes.active ? 'on' : ''}`} style={{ borderLeftColor: `#${note.color}` }}>
          <button className="hd-note-excerpt" title={tr('Ir al texto')} onClick={() => notes.select(note.id)}>
            «{note.excerpt}»
          </button>
          <textarea aria-label={tr('Nota de {author}', { author: note.author })} rows={2} value={note.text} onChange={(e) => notes.setText(note.id, e.target.value)} />
          <footer>
            <span>{note.author}</span>
            <span className="hd-dots" role="group" aria-label={tr('Color de la nota')}>
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
            <button onClick={() => notes.remove(note.id)}>{tr('Eliminar')}</button>
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
  const tr = useTexts()
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('format')
  const Panel = TABS.find((t) => t.id === tab)!.panel

  return (
    <aside className={`hd-panels ${open ? 'open' : ''}`} aria-label={tr('Paneles')}>
      <div className="hd-tabs" role="tablist">
        {TABS.map(({ id, label }) => (
          <button key={id} role="tab" aria-selected={id === tab} className={id === tab ? 'on' : ''} onClick={() => setTab(id)}>
            {tr(label)}
          </button>
        ))}
        {/* Only where the panels lie over the document: beside it they are always there. */}
        <button className="hd-panels-close" aria-label={tr('Cerrar paneles')} onClick={onClose}>✕</button>
      </div>
      <Panel />
    </aside>
  )
}
