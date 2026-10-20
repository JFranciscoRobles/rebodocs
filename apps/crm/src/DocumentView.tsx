import { DocsEditor, type DocsHandle, type Editor } from '@rebodocs/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Chat } from './Chat'
import type { Person, Property } from './data'
import { ago } from './Documents'
import { type DocInfo, getDoc, saveDoc, versionsOf } from './store'

/** How long after the last change the document is kept: nobody has to remember to save. */
const AUTOSAVE_MS = 1500

type Saving = { state: 'saved'; at: string } | { state: 'pending' } | { state: 'saving' } | { state: 'failed' }

/**
 * A document open in the page of its property: the whole editor, saved on its
 * own a moment after each change, with a version kept when the person leaves
 * it, and the assistant beside it when asked for.
 */
export function DocumentView({ doc, property, person, back }: { doc: string; property: Property; person: Person; back: () => void }) {
  const [file, setFile] = useState<{ info: DocInfo; docx: Uint8Array } | null>()
  const [saving, setSaving] = useState<Saving>()
  const [chat, setChat] = useState(false)
  const [editor, setEditor] = useState<Editor>()
  const [, tick] = useState(0)
  const handle = useRef<DocsHandle | undefined>(undefined)
  const timer = useRef(0)
  /** Whether it changed since the last version kept. */
  const changed = useRef(false)
  const author = `${person.name} · ${person.role}`
  const authorRef = useRef(author)
  authorRef.current = author
  const versions = useMemo(() => versionsOf(doc, () => authorRef.current), [doc])

  useEffect(() => {
    let live = true
    void getDoc(doc).then((found) => live && setFile(found ?? null))
    return () => {
      live = false
    }
  }, [doc])

  // "Hace un momento" turns into minutes.
  useEffect(() => {
    const every = window.setInterval(() => tick((n) => n + 1), 30_000)
    return () => window.clearInterval(every)
  }, [])

  const flush = async () => {
    window.clearTimeout(timer.current)
    if (!handle.current?.dirty) return
    setSaving({ state: 'saving' })
    try {
      await handle.current.save()
    } catch {
      setSaving({ state: 'failed' })
    }
  }

  // Leaving: what is left is saved, and a version is kept of the work done, under the name of who did it.
  const leave = async () => {
    await flush()
    if (changed.current && handle.current) {
      changed.current = false
      await versions.save!(handle.current.exportDocx(), { author: authorRef.current })
    }
  }

  useEffect(() => {
    const onHide = () => void leave()
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      void leave()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (file === undefined) return <div className="crm-panel crm-quiet">Abriendo…</div>
  if (file === null)
    return (
      <div className="crm-panel">
        <p>Ese documento ya no existe.</p>
        <button onClick={back}>Volver a Documentos</button>
      </div>
    )

  const status =
    saving?.state === 'saving' || saving?.state === 'pending'
      ? 'Guardando…'
      : saving?.state === 'failed'
        ? 'No se pudo guardar'
        : `Guardado ${ago(saving?.at ?? file.info.updated)}`

  return (
    <div className="crm-doc-view">
      <div className="crm-doc-bar">
        <button className="crm-ghost" onClick={() => void leave().then(back)}>
          ← Documentos
        </button>
        <b className="crm-doc-title">{file.info.name}</b>
        <span className={`crm-saved ${saving?.state ?? 'saved'}`} role="status">
          {status}
        </span>
        <button className={`crm-ai-toggle${chat ? ' on' : ''}`} aria-pressed={chat} onClick={() => setChat(!chat)}>
          <span aria-hidden="true">✦</span> Asistente
        </button>
      </div>
      <div className="crm-doc-body">
        <DocsEditor
          className="crm-editor"
          docx={file.docx}
          name={file.info.name}
          author={author}
          locale="es"
          versions={versions}
          features={{ title: false }}
          onReady={(ready) => {
            handle.current = ready
            setEditor(ready?.editor)
          }}
          onChange={() => {
            changed.current = true
            setSaving({ state: 'pending' })
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => void flush(), AUTOSAVE_MS)
          }}
          onSave={async (docx) => {
            await saveDoc(doc, docx, authorRef.current)
            setSaving({ state: 'saved', at: new Date().toISOString() })
          }}
          onError={(message) => console.error(message)}
        />
        {chat && <Chat editor={editor} property={property} close={() => setChat(false)} />}
      </div>
    </div>
  )
}
