// What the page asks of the backend. The document itself is never asked for
// here: it comes from the room, and goes back to where it is kept through it.

export interface StoredFile {
  key: string
  size: number
  modified: string
  /** Who is in its room now; nobody when the room is not open. */
  people: string[]
}

/** What the editor needs to come into a room: `<DocsEditor collab={room} />`. */
export interface Room {
  /** Where the collaboration server is. */
  url: string
  room: string
  /** What lets this person in, under the name they gave. */
  ticket: string
}

async function ask<T>(path: string, init?: RequestInit): Promise<T> {
  const answer = await fetch(path, init)
  const body = await answer.json().catch(() => ({}))
  if (!answer.ok) throw new Error(body.error ?? `The server answered ${answer.status}.`)
  return body as T
}

const at = (path: string, key: string) => `${path}?key=${encodeURIComponent(key)}`

export const listDocs = () => ask<StoredFile[]>('/api/docs')

export const createDoc = (key: string) => ask<{ key: string }>(at('/api/docs', key), { method: 'POST' })

/** The versions of a document, as the side panel of the editor asks for them: `<DocsEditor versions={versionsOf(key)} />`. */
export const versionsOf = (key: string) => ({
  list: () => ask<{ id: string; date: string; author?: string; label?: string }[]>(at('/api/versions', key)),
  async load(id: string) {
    const answer = await fetch(`${at('/api/version', key)}&id=${encodeURIComponent(id)}`)
    if (!answer.ok) throw new Error(`The server answered ${answer.status}.`)
    return new Uint8Array(await answer.arrayBuffer())
  },
  save: (docx: Uint8Array, info: { label?: string; author?: string }) =>
    ask<{ id: string }>(`${at('/api/versions', key)}&author=${encodeURIComponent(info.author ?? '')}&label=${encodeURIComponent(info.label ?? '')}`, { method: 'POST', body: docx as BodyInit }),
})

export const enterRoom = (key: string, name: string) =>
  ask<Room>(at('/api/room', key), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })
