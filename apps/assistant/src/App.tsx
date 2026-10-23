import { useCallback, useEffect, useRef, useState } from 'react';
import { DocsEditor, type Editor } from '@rebodocs/react';
import { type Room, type StoredFile, createDoc, enterRoom, listDocs } from '../../realtime/src/api';
import { Chat } from './Chat';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A link that opens a document: `#doc=<name>`. Whoever opens it comes into the same room. */
const LINK = '#doc=';
const linked = () => (location.hash.startsWith(LINK) ? decodeURIComponent(location.hash.slice(LINK.length)) : '');

const NAME = 'rebodocs-assistant-name';
function firstName(): string {
  try {
    const kept = localStorage.getItem(NAME);
    if (kept) return kept;
  } catch {
    // No storage: a new name each time.
  }
  return `Guest ${100 + Math.floor(Math.random() * 900)}`;
}

interface Person {
  name: string;
  color: string;
}

const STATES: Record<string, string> = {
  connecting: 'Connecting…',
  on: 'Live',
  offline: 'No connection: what you type is sent when it comes back',
  off: 'Not in a room',
};

export function App() {
  const [docs, setDocs] = useState<StoredFile[]>();
  const [name, setName] = useState(firstName);
  const [open, setOpen] = useState<{ key: string; as: string; room: Room }>();
  const [live, setLive] = useState<{ state: string; people: Person[] }>({ state: 'off', people: [] });
  const [note, setNote] = useState<{ text: string; bad?: boolean }>({ text: '' });
  // The editor of the document open: what the assistant reads and changes.
  const [editor, setEditor] = useState<Editor>();
  const fail = (problem: unknown) => setNote({ text: messageOf(problem), bad: true });

  const refresh = useCallback(() => listDocs().then(setDocs, fail), []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void listDocs().then(setDocs, () => {}), 2000);
    return () => clearInterval(timer);
  }, [refresh]);

  const enter = useCallback(async (key: string, as: string) => {
    const called = as.trim() || 'Someone';
    try {
      setNote({ text: '' });
      const room = await enterRoom(key, called);
      setLive({ state: 'connecting', people: [] });
      setOpen({ key, as: called, room });
      history.replaceState(null, '', LINK + encodeURIComponent(key));
      try {
        localStorage.setItem(NAME, called);
      } catch {
        // It is asked again next time.
      }
    } catch (problem) {
      fail(problem);
    }
  }, []);

  // A link opens straight into its room; without one, the first document there is.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    if (linked()) {
      started.current = true;
      void enter(linked(), name);
    } else if (docs?.length) {
      started.current = true;
      void enter(docs[0].key, name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs]);

  function rename() {
    if (open && name.trim() && name.trim() !== open.as) void enter(open.key, name);
  }

  async function create() {
    const asked = window.prompt('A name for the new document', 'untitled')?.trim();
    if (!asked) return;
    const key = /\.docx$/i.test(asked) ? asked : `${asked}.docx`;
    try {
      await createDoc(key);
      await refresh();
      await enter(key, name);
    } catch (problem) {
      fail(problem);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      setNote({ text: 'Link copied. Open it in another window: what the assistant does shows there too.' });
    } catch {
      setNote({ text: location.href });
    }
  }

  return (
    <div className="app with-chat">
      <aside className="side">
        <label className="me">
          You are
          <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        </label>
        <header>
          <strong>Documents</strong>
          <button onClick={() => void refresh()} title="Read the list again">
            ↻
          </button>
          <button className="primary" onClick={() => void create()}>
            New
          </button>
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
          Ask Claude, on the right, to change the document: it reads it, keeps its look, and what it does is a step you can undo. Copy the link and open it in another window to watch it from there.
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
                  <span key={index} className="person" style={{ background: `#${person.color}` }}>
                    {person.name}
                  </span>
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
            <DocsEditor
              key={open.room.ticket}
              className="fill"
              collab={open.room}
              locale="en"
              onReady={(handle) => setEditor(handle?.editor)}
              onCollab={(state, peers) => {
                setLive({ state, people: peers.map((peer) => ({ name: peer.name || 'Someone', color: peer.color })) });
              }}
              onError={(message) => fail(new Error(message))}
            />
          ) : (
            <p className="empty">Nothing open.</p>
          )}
        </div>
      </main>
      <Chat editor={editor} />
    </div>
  );
}
