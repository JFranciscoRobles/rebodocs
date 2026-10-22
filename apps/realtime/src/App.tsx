import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DocsEditor, inkOn } from '@rebodocs/react'
import { type Room, type StoredFile, createDoc, enterRoom, listDocs, versionsOf } from './api'

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** A link that opens a document: `#doc=<name>`. Whoever opens it comes into the same room. */
const LINK = '#doc='
const linked = () => (location.hash.startsWith(LINK) ? decodeURIComponent(location.hash.slice(LINK.length)) : '')

const NAME = 'rebodocs-realtime-name'
/** What the person was called last time in this browser, or a name to start with. */
function firstName(): string {
  try {
    const kept = localStorage.getItem(NAME)
    if (kept) return kept
  } catch {
    // No storage: a new name each time.
  }
  return `Guest ${100 + Math.floor(Math.random() * 900)}`
}

interface Person {
  name: string
  color: string
}

const STATES: Record<string, string> = {
  connecting: 'Connecting…',
  on: 'Live',
  offline: 'No connection: what you type is sent when it comes back',
  off: 'Not in a room',
}

export function App() {
  const [docs, setDocs] = useState<StoredFile[]>()
  const [name, setName] = useState(firstName)
  // The document open, and the room it is worked on in; the ticket is for one name.
  const [open, setOpen] = useState<{ key: string; as: string; room: Room }>()
  const versions = useMemo(() => (open ? versionsOf(open.key) : undefined), [open?.key])
  const [live, setLive] = useState<{ state: string; people: Person[] }>({ state: 'off', people: [] })
  const [note, setNote] = useState<{ text: string; bad?: boolean }>({ text: '' })
  const fail = (problem: unknown) => setNote({ text: messageOf(problem), bad: true })

  const refresh = useCallback(() => listDocs().then(setDocs, fail), [])
  // Asked again every little while: which rooms are open, and who is in them, changes without this page doing anything.
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => void listDocs().then(setDocs, () => {}), 2000)
    return () => clearInterval(timer)
  }, [refresh])

  /** Comes into the room of a document, under the name there is now. */
  const enter = useCallback(async (key: string, as: string) => {
    const called = as.trim() || 'Someone'
    try {
      setNote({ text: '' })
      const room = await enterRoom(key, called)
      setLive({ state: 'connecting', people: [] })
      setOpen({ key, as: called, room })
      history.replaceState(null, '', LINK + encodeURIComponent(key))
      try {
        localStorage.setItem(NAME, called)
      } catch {
        // It is asked again next time.
      }
    } catch (problem) {
      fail(problem)
    }
  }, [])

  // A link someone passed on opens straight into the room. Once, also where React runs an effect twice to try it.
  const started = useRef(false)
  useEffect(() => {
    if (started.current || !linked()) return
    started.current = true
    void enter(linked(), name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** A name changed while in a room takes a ticket of its own: the person comes in again under it. */
  function rename() {
    if (open && name.trim() && name.trim() !== open.as) void enter(open.key, name)
  }

  async function create() {
    const asked = window.prompt('A name for the new document', 'untitled')?.trim()
    if (!asked) return
    const key = /\.docx$/i.test(asked) ? asked : `${asked}.docx`
    try {
      await createDoc(key)
      await refresh()
      await enter(key, name)
    } catch (problem) {
      fail(problem)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href)
      setNote({ text: 'Link copied. Open it in another window, or pass it on.' })
    } catch {
      setNote({ text: location.href })
    }
  }

  return (
    <div className="app">
      <aside className="side">
        <label className="me">
          You are
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        </label>
        <header>
          <strong>Documents</strong>
          <button onClick={() => void refresh()} title="Read the list again">↻</button>
          <button className="primary" onClick={() => void create()}>New</button>
        </header>
        {!docs && !note.bad && <p className="quiet">Reading the documents…</p>}
        {docs?.length === 0 && <p className="quiet">There are none yet. Start one with New.</p>}
        <ul>
          {docs?.map((doc) => (
            <li key={doc.key}>
              <button className={doc.key === open?.key ? 'on' : ''} onClick={() => void enter(doc.key, name)}>
                <span className="name">{doc.key}</span>
                {doc.people.length ? (
                  <small className="live">● Room open · {doc.people.map((person) => person || 'Someone').join(', ')}</small>
                ) : (
                  <small>Room closed · saved {new Date(doc.modified).toLocaleString()}</small>
                )}
              </button>
            </li>
          ))}
        </ul>
        <p className="quiet how">
Every document is a room. It opens when the first person comes in and closes when the last one leaves, with the document saved. Copy the link of one and open it in another window: each sees the other&rsquo;s caret, and what either types.
        </p>
      </aside>
      <main className="stage">
        <div className="bar">
          {open ? (
            <>
              <strong>{open.key}</strong>
              <span className={`state ${live.state}`}>{STATES[live.state] ?? live.state}</span>
              <span className="people">
                <span className="person me">{open.as} (you)</span>
                {live.people.map((person, index) => (
                  <span key={index} className="person" style={{ background: `#${person.color}`, color: inkOn(person.color) }}>{person.name}</span>
                ))}
              </span>
              <button onClick={() => void copyLink()}>Copy link</button>
            </>
          ) : (
            <span className="quiet">Open a document to come into its room.</span>
          )}
        </div>
        {note.text && <p className={`note ${note.bad ? 'bad' : 'quiet'}`}>{note.text}</p>}
        <div className="editor">
          {open ? (
            // The document comes from the room and saves itself through the backend: no `docx`, no `onSave`.
            // Made again for another room or another ticket.
            <DocsEditor
              key={open.room.ticket}
              className="fill"
              collab={open.room}
              // Kept by the backend: one when everybody leaves, and one whenever someone keeps it from the side panel.
              versions={versions}
              locale="en"
              onCollab={(state, peers) => {
                setLive({ state, people: peers.map((peer) => ({ name: peer.name || 'Someone', color: peer.color })) })
              }}
              onError={(message) => fail(new Error(message))}
            />
          ) : (
            <p className="empty">Nothing open.</p>
          )}
        </div>
      </main>
    </div>
  )
}
