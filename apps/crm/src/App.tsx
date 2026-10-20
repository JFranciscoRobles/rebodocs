import { useState } from 'react'
import { type Property, FIELDS, TEAM, loadProperties, money, saveProperties } from './data'
import { DocumentView } from './DocumentView'
import { Documents } from './Documents'

type Route = { page: 'list' } | { page: 'property'; id: string; tab: 'record' | 'documents'; doc?: string }

const NAV = ['Inicio', 'Agenda', 'Contactos', 'Oportunidades', 'Propiedades', 'Operaciones', 'Reportes']

/** The CRM: its menu, the properties, and the page of each, whose Documents tab is where the editor is. */
export function App() {
  const [properties, setProperties] = useState(loadProperties)
  const [route, setRoute] = useState<Route>({ page: 'list' })
  const [who, setWho] = useState(0)
  const person = TEAM[who]
  const property = route.page === 'property' ? properties.find((p) => p.id === route.id) : undefined

  const change = (next: Property) => {
    const all = properties.map((p) => (p.id === next.id ? next : p))
    setProperties(all)
    saveProperties(all)
  }

  return (
    <div className="crm">
      <nav className="crm-side" aria-label="Menú del CRM">
        <div className="crm-brand">
          <span className="crm-mark" aria-hidden="true" />
          <span>Inmobiliaria</span>
        </div>
        {NAV.map((item) =>
          item === 'Propiedades' ? (
            <button key={item} className="crm-nav on" aria-current="page" onClick={() => setRoute({ page: 'list' })}>
              {item}
            </button>
          ) : (
            <span key={item} className="crm-nav" title="Solo de muestra">
              {item}
            </span>
          ),
        )}
        <p className="crm-side-note">Demo de Rebodocs: un CRM de ejemplo, con datos inventados.</p>
      </nav>

      <div className="crm-main">
        <header className="crm-top">
          <nav className="crm-crumbs" aria-label="Ruta">
            <button onClick={() => setRoute({ page: 'list' })}>Propiedades</button>
            {property && (
              <>
                <span aria-hidden="true">›</span>
                <button onClick={() => setRoute({ page: 'property', id: property.id, tab: route.page === 'property' ? route.tab : 'record' })}>{property.title}</button>
              </>
            )}
            {route.page === 'property' && route.doc && (
              <>
                <span aria-hidden="true">›</span>
                <b>Documento</b>
              </>
            )}
          </nav>
          <label className="crm-who">
            <span className="crm-avatar" style={{ background: `#${person.color}` }} aria-hidden="true">
              {person.name[0]}
            </span>
            <span className="crm-sr">Trabajas como</span>
            <select value={who} onChange={(e) => setWho(Number(e.target.value))}>
              {TEAM.map((p, i) => (
                <option key={p.name} value={i}>
                  {p.name} · {p.role}
                </option>
              ))}
            </select>
          </label>
        </header>

        {route.page === 'list' && <PropertyList properties={properties} open={(id) => setRoute({ page: 'property', id, tab: 'record' })} />}

        {route.page === 'property' && property && (
          <section className="crm-record">
            {!route.doc && (
              <div className="crm-record-head">
                <div>
                  <p className="crm-eyebrow">{property.kind}</p>
                  <h1>{property.title}</h1>
                  <p className="crm-quiet">
                    {property.address}, {property.city}
                  </p>
                </div>
                <p className="crm-price">{money(property.price)}</p>
              </div>
            )}
            {!route.doc && (
              <div className="crm-tabs" role="tablist" aria-label="Secciones de la propiedad">
                {(['record', 'documents'] as const).map((tab) => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={route.tab === tab}
                    className={route.tab === tab ? 'on' : ''}
                    onClick={() => setRoute({ page: 'property', id: property.id, tab })}
                  >
                    {tab === 'record' ? 'Ficha' : 'Documentos'}
                  </button>
                ))}
              </div>
            )}
            {route.tab === 'record' && <Record property={property} onChange={change} />}
            {route.tab === 'documents' && !route.doc && (
              <Documents property={property} person={person} open={(doc) => setRoute({ page: 'property', id: property.id, tab: 'documents', doc })} />
            )}
            {route.tab === 'documents' && route.doc && (
              <DocumentView key={route.doc} doc={route.doc} property={property} person={person} back={() => setRoute({ page: 'property', id: property.id, tab: 'documents' })} />
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function PropertyList({ properties, open }: { properties: Property[]; open: (id: string) => void }) {
  return (
    <section className="crm-list">
      <p className="crm-eyebrow">Propiedades</p>
      <h1>En promoción</h1>
      <div className="crm-cards">
        {properties.map((p) => (
          <button key={p.id} className="crm-card" onClick={() => open(p.id)}>
            <span className="crm-card-kind">{p.kind}</span>
            <span className="crm-card-title">{p.title}</span>
            <span className="crm-quiet">
              {p.address}, {p.city}
            </span>
            <span className="crm-card-price">{money(p.price)}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

/** The record of the property: what the contract is filled with. Changed here, the next contract made has it. */
function Record({ property, onChange }: { property: Property; onChange: (next: Property) => void }) {
  return (
    <div className="crm-panel">
      <div className="crm-fields">
        {FIELDS.map(([key, label]) => (
          <label key={key} className="crm-field">
            <span>{label}</span>
            <input
              value={property[key]}
              inputMode={key === 'price' ? 'numeric' : undefined}
              onChange={(e) => onChange({ ...property, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <p className="crm-hint">Estos datos llenan las variables del contrato al generarlo en la pestaña Documentos.</p>
    </div>
  )
}
