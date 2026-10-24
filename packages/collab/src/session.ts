// The editor's side of working on a document with other people: it tells the
// server what its person changes, makes the changes of the others as they
// come, and shows where each of them is. What its person does is seen at
// once, without waiting for the server; when someone else's change turns out
// to have got there first, theirs is made and its own are made again on top.
//
// Undoing takes back what this person did and nothing of what the others did
// meanwhile: it is kept as changes, not as the document as it was.

import { type Doc, importDocx } from '@rebodocs/core/internal';
import { encode, stampIds, toBase64 } from './changes';
import { type CollabHost, type HostHistory, Mirror, through } from './mirror';
import { type Entry, type Hello, type OpsPost, PREFIX, PROTOCOL, type Presence, type PresencePost, type ServerEvent, readEvent } from './protocol';
import { type Sending, Sync } from './sync';

export type { CollabHost, HostHistory, HostSelection, PeerCaret } from './mirror';
export { DEFAULT_COLLAB_PORT, PROTOCOL } from './protocol';

export interface Peer {
  client: string;
  name: string;
  color: string;
}

export type CollabState = 'connecting' | 'on' | 'offline' | 'closed';

/**
 * Why a session is closed: left from here; the room is not on the server;
 * this person may not come into it; they were sent away while in it; or the
 * editor and the server speak different versions, and one of them is to be
 * brought up to date.
 */
export type ClosedReason = 'left' | 'not-found' | 'denied' | 'removed' | 'outdated';

export interface CollabOptions {
  /** Where the server is. */
  url: string;
  /** What the others see this person as. */
  name?: string;
  /** What the system the document belongs to gave this person to show they may edit it, when it is the one to say. */
  ticket?: string;
  /** Called when the state or the people in the room change. */
  onChange?: () => void;
}

export interface Session {
  readonly room: string;
  readonly state: CollabState;
  /** Why it is closed, once it is. */
  readonly reason: ClosedReason | undefined;
  /** The name the document was shared under. */
  readonly title: string;
  /** The others in the room. */
  readonly peers: Peer[];
  /** This person's colour, once the server gave it. */
  readonly color: string;
  /** What the others see this person as: what was given here, or what the system the document belongs to says. */
  readonly name: string;
  /** Let in only to watch, by the system the document belongs to: what is changed here is not taken. */
  readonly readOnly: boolean;
  /** Changes made here the server has not taken yet. */
  readonly pending: number;
  /** How many times the document here was found not to be the room's, and was loaded again. */
  readonly resyncs: number;
  rename(name: string): void;
  /** Stops working with the others. The document stays as it is. */
  leave(): void;
}

const clean = (url: string) => url.replace(/\/+$/, '');
const tag = () => Math.random().toString(36).slice(2, 8);

/** Starts sharing a document: gives the server its file, and says the name of the room it made for it. */
export async function createRoom(url: string, docx: Uint8Array, name: string, token?: string): Promise<string> {
  const response = await fetch(`${clean(url)}${PREFIX}/rooms${token ? `?token=${encodeURIComponent(token)}` : ''}`, { method: 'POST', body: encode({ name, docx: toBase64(docx) }) });
  const answer = (await response.json()) as { room?: string; error?: string };
  if (!response.ok || !answer.room) throw new Error(answer.error ?? `${response.status}`);
  return answer.room;
}

/**
 * Whether a collaboration server answers at an address, whether it asks for a
 * word to start sharing, and the version it speaks: one not `PROTOCOL` sends
 * this editor away.
 */
export async function pingServer(url: string): Promise<{ token: boolean; protocol: number } | undefined> {
  try {
    const answer = (await (await fetch(`${clean(url)}${PREFIX}/ping`)).json()) as { collab?: number; token?: boolean };
    return answer.collab ? { token: !!answer.token, protocol: answer.collab } : undefined;
  } catch {
    return undefined;
  }
}

/** Reads a stream of server-sent events, calling `each` with every one. Resolves when the stream ends. */
async function listen(url: string, signal: AbortSignal, each: (event: ServerEvent) => void): Promise<void> {
  const response = await fetch(url, { signal, headers: { Accept: 'text/event-stream' } });
  if (!response.ok || !response.body) throw Object.assign(new Error(`${response.status}`), { status: response.status });
  const reader = response.body.getReader();
  const text = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += text.decode(value, { stream: true });
    for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      const known = data ? readEvent(event, data) : undefined;
      if (known) each(known);
    }
  }
}

/**
 * Joins the room of a document: loads it in the editor as everybody has it,
 * and keeps it in step from then on. This is the part that talks to the
 * server: what keeps the document in step is `Sync`, and what looks at the
 * editor is `Mirror`.
 */
export function joinRoom(host: CollabHost, room: string, options: CollabOptions): Session {
  const url = `${clean(options.url)}${PREFIX}/rooms/${room}`;
  let me = tag() + tag();
  /** What the server gave this editor when it came in, for everything it sends to be taken as its own. */
  let key = '';
  let name = options.name ?? '';
  let state: CollabState = 'connecting';
  let reason: ClosedReason | undefined;
  let title = '';
  let readOnly = false;
  let color = '';
  const sync = new Sync();
  const mirror = new Mirror(host, sync, () => me);
  const stop = new AbortController();
  /** The stream being listened to: let go of, it is listened to again. */
  let stream: AbortController | undefined;
  const changed = () => options.onChange?.();

  // --- Sending --------------------------------------------------------------------

  const post = async (what: 'ops' | 'presence', data: Omit<OpsPost, 'client' | 'key'> | Omit<PresencePost, 'client' | 'key'>): Promise<number> => {
    try {
      return (await fetch(`${url}/${what}`, { method: 'POST', body: encode({ client: me, key, ...data }), signal: stop.signal })).status;
    } catch {
      return 0;
    }
  };

  let posting = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    // Let in only to watch: the server takes nothing from here.
    if (readOnly || state !== 'on' || posting) return;
    const sent: Sending | undefined = sync.next();
    if (!sent) return;
    posting = true;
    void post('ops', sent).then((status) => {
      posting = false;
      if (state !== 'on') return;
      const then = sync.answered(sent, status);
      if (then === 'now') flush();
      else if (then === 'later') {
        clearTimeout(retry);
        retry = setTimeout(flush, 1500);
      }
    });
    changed();
  };

  let presenceTimer: ReturnType<typeof setTimeout> | undefined;
  let sentSel = '';
  const sendPresence = () => {
    clearTimeout(presenceTimer);
    presenceTimer = setTimeout(() => {
      if (state !== 'on') return;
      const sel = mirror.here();
      const said = JSON.stringify([sel ?? null, name]);
      if (said === sentSel) return;
      sentSel = said;
      void post('presence', { sel: sel ?? null, name });
    }, 40);
  };

  // --- What the person does -------------------------------------------------------

  const onHostChange = () => {
    if (!mirror.listening) return;
    mirror.collect();
    flush();
    mirror.moved();
    sendPresence();
    mirror.showPeers();
  };

  const show = (doc: Doc, sel: Presence | undefined) => {
    mirror.show(doc, sel);
    flush();
    sendPresence();
  };

  const step = (kind: 'undo' | 'redo') => {
    const done = mirror.step(kind);
    flush();
    if (!done) return;
    sendPresence();
    changed();
  };

  const history: HostHistory = {
    undo: () => step('undo'),
    redo: () => step('redo'),
    get canUndo() {
      return sync.undo.length > 0;
    },
    get canRedo() {
      return sync.redo.length > 0;
    },
  };

  // --- What the others do ---------------------------------------------------------

  const take = (entry: Entry) => {
    if (!sync.loaded) return;
    // What the person did and was not looked at yet is made before theirs, and changed by it like the rest.
    mirror.collect();
    const sel = mirror.here();
    const done = sync.take(entry, me);
    if (!done) return;
    if (done.own) {
      // Its own, in its place. As it was sent, the editor already shows it.
      if (done.doc) show(done.doc, mirror.here());
      flush();
      return;
    }
    mirror.carryPeers(done.theirs, entry.by);
    show(done.doc, sel && through(sel, done.theirs));
  };

  // --- The connection -------------------------------------------------------------

  const start = async (hello: Hello) => {
    // A server that speaks another version: nothing it says is to be taken.
    if ((hello.protocol ?? 1) !== PROTOCOL) {
      reason = 'outdated';
      state = 'closed';
      stream?.abort();
      return;
    }
    // A server of before gives no key, and asks for none.
    key = hello.key ?? '';
    title = hello.name;
    readOnly = !!hello.readOnly;
    color = hello.color;
    if (hello.as) name = hello.as;
    mirror.peers.clear();
    for (const peer of hello.peers) mirror.peers.set(peer.client, peer);
    if (sync.needsFile(hello)) {
      // From the start: the file of the room, and every change made to it since.
      const response = await fetch(`${url}/base?client=${me}&key=${encodeURIComponent(key)}`, { signal: stop.signal });
      if (!response.ok) throw new Error(`${response.status}`);
      const file = stampIds(importDocx(new Uint8Array(await response.arrayBuffer())));
      // Loaded again: what was typed while it was being loaded goes with what was made before.
      mirror.collect();
      const sel = mirror.here();
      const { doc, again, relabel } = sync.load(hello, file, me);
      if (again) mirror.show(doc, relabel(sel));
      else mirror.load(doc);
      state = 'on';
      flush();
    } else {
      state = 'on';
      for (const entry of hello.entries) take(entry);
      // What was on its way when the connection went, and never got there, goes again.
      posting = false;
      sync.resend();
      flush();
    }
    sentSel = '';
    mirror.moved();
    sendPresence();
    mirror.showPeers();
    changed();
  };

  /**
   * The document here is not the room's, or the room's changes were folded
   * into its file, where its paragraphs have the ids `ids`: it is loaded again,
   * keeping what was made here (see `Sync.lose`).
   */
  const resync = (ids?: Map<string, string>) => {
    mirror.collect();
    sync.lose(ids);
    if (!ids) console.warn(`[collab] ${room}: the document here was not the room's; loading it again`);
    // Nothing goes to the room until it is loaded again; what is typed meanwhile waits.
    state = 'connecting';
    stream?.abort();
  };

  /** Whether the server sent this person away: it is not listened to again. */
  let removed = false;
  /** Says whether it was the first event of the stream, which says it came in. */
  const hear = async (e: ServerEvent): Promise<boolean> => {
    switch (e.event) {
      case 'hello':
        await start(e.data);
        return true;
      case 'op':
        if (e.data.rev === sync.rev) take(e.data);
        break;
      case 'presence':
        mirror.peers.set(e.data.client, e.data);
        mirror.showPeers();
        changed();
        break;
      case 'leave':
        mirror.peers.delete(e.data.client);
        mirror.showPeers();
        changed();
        break;
      case 'check':
        if (sync.differs(e.data)) resync();
        break;
      case 'fold':
        // Folded after every change this editor has: made on the new file as they are. Otherwise loaded again.
        if (e.data.epoch !== sync.epoch && sync.loaded) resync(e.data.rev === sync.rev ? new Map(Object.entries(e.data.ids)) : undefined);
        break;
      case 'removed':
        // The server ends the stream itself: aborting it as it ends can leave the reading of it hanging.
        removed = true;
        break;
    }
    return false;
  };

  const run = async () => {
    let wait = 500;
    /** Events are taken one at a time, in the order they came: the first of them waits for the file of the room. */
    let queue = Promise.resolve();
    while (state !== 'closed') {
      const listening = new AbortController();
      stream = listening;
      const leaving = () => listening.abort();
      stop.signal.addEventListener('abort', leaving);
      try {
        const query = `v=${PROTOCOL}&client=${me}&key=${encodeURIComponent(key)}&name=${encodeURIComponent(name)}&epoch=${sync.epoch}&from=${sync.rev}${options.ticket ? `&ticket=${encodeURIComponent(options.ticket)}` : ''}`;
        await listen(`${url}/events?${query}`, listening.signal, (event) => {
          queue = queue.then(async () => {
            if (state !== 'closed' && (await hear(event))) wait = 500;
          });
        });
        await queue;
      } catch (error) {
        // A room that is not there is not going to be, and neither is one this person may not come into: nothing to come back to.
        const status = (error as { status?: number }).status;
        if (status === 404 || status === 403 || status === 426) {
          reason = status === 404 ? 'not-found' : status === 403 ? 'denied' : 'outdated';
          state = 'closed';
          break;
        }
        // Somebody else is in the room with this editor's id: it comes back with another.
        if (status === 409) {
          me = tag() + tag();
          key = '';
        }
      } finally {
        stop.signal.removeEventListener('abort', leaving);
      }
      if (removed) {
        reason = 'removed';
        state = 'closed';
      }
      if ((state as CollabState) === 'closed') break;
      // Let go of to load the room again: at once, without saying it went.
      if (sync.carry && !sync.loaded) continue;
      state = 'offline';
      mirror.peers.clear();
      host.setPeers([]);
      changed();
      await new Promise((done) => setTimeout(done, wait));
      wait = Math.min(wait * 2, 8000);
    }
    changed();
  };

  host.history = history;
  const unsubscribe = host.onChange(onHostChange);
  void run();

  return {
    room,
    get state() {
      return state;
    },
    get reason() {
      return reason;
    },
    get title() {
      return title;
    },
    get peers() {
      return [...mirror.peers.values()].map(({ client, name: n, color: c }) => ({ client, name: n, color: c }));
    },
    get color() {
      return color;
    },
    get name() {
      return name;
    },
    get readOnly() {
      return readOnly;
    },
    get pending() {
      return sync.pending;
    },
    get resyncs() {
      return sync.resyncs;
    },
    rename(next: string) {
      name = next;
      sendPresence();
    },
    leave() {
      if (state === 'closed') return;
      state = 'closed';
      reason = 'left';
      clearTimeout(retry);
      clearTimeout(presenceTimer);
      stop.abort();
      unsubscribe();
      if (host.history === history) host.history = undefined;
      host.setPeers([]);
      changed();
    },
  };
}

export type { Op } from './changes';
