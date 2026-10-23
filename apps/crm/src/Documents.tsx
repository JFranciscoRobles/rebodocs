import { exportDocx, fillVariables } from '@rebodocs/core';
import { useEffect, useState } from 'react';
import { type Person, type Property, templateValues } from './data';
import { type DocInfo, createDoc, deleteDoc, listDocs } from './store';
import { templateDoc } from './template';

/** When, said the way a person would. */
export function ago(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 45) return 'hace un momento';
  if (seconds < 3600) return `hace ${Math.round(seconds / 60)} min`;
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
}

/** The documents of the property, and the one button that makes the contract from its data. */
export function Documents({ property, person, open }: { property: Property; person: Person; open: (doc: string) => void }) {
  const [docs, setDocs] = useState<DocInfo[]>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void listDocs(property.id).then((list) => live && setDocs(list));
    return () => {
      live = false;
    };
  }, [property.id]);

  // The template, filled with what the record says now: the document starts as the CRM made it, as its first version.
  const generate = async () => {
    setBusy(true);
    try {
      const docx = exportDocx(fillVariables(templateDoc(), templateValues(property), { locale: 'es-MX' }), { language: 'es-MX' });
      const info = await createDoc(property.id, `Contrato de mediación · ${property.title}`, docx, `${person.name} · ${person.role}`, 'Generado desde la ficha');
      open(info.id);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (doc: DocInfo) => {
    if (!confirm(`¿Borrar «${doc.name}» y sus versiones?`)) return;
    await deleteDoc(doc.id);
    setDocs(await listDocs(property.id));
  };

  return (
    <div className="crm-panel">
      <div className="crm-docs-head">
        <div>
          <h2>Documentos</h2>
          <p className="crm-quiet">Se abren y se editan aquí mismo, sin descargar nada.</p>
        </div>
        <button className="crm-primary" disabled={busy} onClick={() => void generate()}>
          {busy ? 'Generando…' : 'Generar contrato de mediación'}
        </button>
      </div>
      {docs === undefined ? null : docs.length ? (
        <ul className="crm-docs">
          {docs.map((doc) => (
            <li key={doc.id}>
              <button className="crm-doc" onClick={() => open(doc.id)}>
                <span className="crm-doc-icon" aria-hidden="true">
                  W
                </span>
                <span className="crm-doc-name">{doc.name}</span>
                <span className="crm-quiet">
                  {ago(doc.updated)} · {doc.author}
                </span>
              </button>
              <button className="crm-ghost" aria-label={`Borrar ${doc.name}`} onClick={() => void remove(doc)}>
                Borrar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="crm-empty">
          <p>
            <b>Aún no hay documentos.</b>
          </p>
          <p className="crm-quiet">El contrato se genera con los datos de la ficha: propietario, inmueble, precio, comisión y vigencia.</p>
        </div>
      )}
    </div>
  );
}
