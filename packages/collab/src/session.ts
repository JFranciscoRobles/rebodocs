// The editor's side of working on a document with other people: it tells the
// server what its person changes, makes the changes of the others as they
// come, and shows where each of them is. What its person does is seen at
// once, without waiting for the server; when someone else's change turns out
// to have got there first, theirs is made and its own are made again on top.
//
// Undoing takes back what this person did and nothing of what the others did
// meanwhile: it is kept as changes, not as the document as it was.

import { type Doc, type Paragraph, type Position, type StoryPart, importDocx, noteMark, paragraphLength, storyOf, withStory } from '@rebodocs/core';
import { type Anchor, type Op, type Renamed, apply, decode, diff, digest, encode, ensureIds, mapAnchor, renameTable, stampIds, storyPartsOf, toBase64, transform } from './changes';

export const DEFAULT_COLLAB_PORT = 7420;

export interface HostSelection {
  anchor: Position;
  focus: Position;
}

/** Someone else's caret, as the editor draws it. */
export interface PeerCaret {
  name: string;
  /** Hex RGB without '#'. */
  color: string;
  /** The header or footer it is in, and the page it is being edited on; the text when there is none. */
  part?: StoryPart;
  page: number;
  anchor: Position;
  focus: Position;
}

/** What undoing asks of whoever keeps the steps. */
export interface HostHistory {
  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/** What it needs of an editor: `Editor` of @rebodocs/editor is one. */
export interface CollabHost {
  doc: Doc;
  selection: HostSelection;
  /** Where the selection is: the part when it is a header or a footer, and the page it is edited on. */
  readonly place: { part?: StoryPart; page: number };
  /** How many changes the person made, and how many of them were steps of their own to undo. */
  readonly commits: number;
  readonly steps: number;
  /** Who undoes, in place of the editor. */
  history?: HostHistory;
  onChange(listener: () => void): () => void;
  load(doc: Doc): void;
  /** Shows another document in place of the one it has, which someone else changed: not a step to undo, and the view stays where it is unless `reveal`. */
  replace(doc: Doc, selection: HostSelection, reveal?: boolean): void;
  setPeers(peers: PeerCaret[]): void;
  exportDocx(): Uint8Array;
}

export interface Peer {
  client: string;
  name: string;
  color: string;
}

export type CollabState = 'connecting' | 'on' | 'offline' | 'closed';

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
  /** The name the document was shared under. */
  readonly title: string;
  /** The others in the room. */
  readonly peers: Peer[];
  /** This person's colour, once the server gave it. */
  readonly color: string;
  /** What the others see this person as: what was given here, or what the system the document belongs to says. */
  readonly name: string;
  /** Changes made here the server has not taken yet. */
  readonly pending: number;
  /** How many times the document here was found not to be the room's, and was loaded again. */
  readonly resyncs: number;
  rename(name: string): void;
  /** Stops working with the others. The document stays as it is. */
  leave(): void;
}

interface SentPresence {
  part?: StoryPart;
  page: number;
  anchor: { id: string; offset: number };
  focus: { id: string; offset: number };
}

interface Step {
  ops: Op[];
  /** Where the selection was before. */
  sel?: SentPresence;
}

interface Entry {
  by: string;
  seq: number;
  ops: Op[];
}

const clean = (url: string) => url.replace(/\/+$/, '');
const tag = () => Math.random().toString(36).slice(2, 8);

/** Starts sharing a document: gives the server its file, and says the name of the room it made for it. */
export async function createRoom(url: string, docx: Uint8Array, name: string, token?: string): Promise<string> {
  const response = await fetch(`${clean(url)}/collab/rooms${token ? `?token=${encodeURIComponent(token)}` : ''}`, { method: 'POST', body: encode({ name, docx: toBase64(docx) }) });
  const answer = (await response.json()) as { room?: string; error?: string };
  if (!response.ok || !answer.room) throw new Error(answer.error ?? `${response.status}`);
  return answer.room;
}

/** Whether a collaboration server answers at an address, and whether it asks for a word to start sharing. */
export async function pingServer(url: string): Promise<{ token: boolean } | undefined> {
  try {
    const answer = (await (await fetch(`${clean(url)}/collab/ping`)).json()) as { collab?: number; token?: boolean };
    return answer.collab ? { token: !!answer.token } : undefined;
  } catch {
    return undefined;
  }
}

/** Reads a stream of server-sent events, calling `each` with every one. Resolves when the stream ends. */
async function listen(url: string, signal: AbortSignal, each: (event: string, data: string) => void): Promise<void> {
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
      if (data) each(event, data);
    }
  }
}

/** Joins the room of a document: loads it in the editor as everybody has it, and keeps it in step from then on. */
export function joinRoom(host: CollabHost, room: string, options: CollabOptions): Session {
  const url = clean(options.url);
  const me = tag() + tag();
  let name = options.name ?? '';
  let state: CollabState = 'connecting';
  let title = '';
  let color = '';
  const peers = new Map<string, Peer & { sel?: SentPresence }>();

  /** The document as the server has it, and how many sendings went into it. */
  let confirmed: Doc | undefined;
  let rev = 0;
  let epoch = 0;
  /** What was sent and not yet given its place, and what was done since. */
  let inflight: Op[] | undefined;
  let buffer: Op[] = [];
  let seq = 0;
  let posting = false;
  /** The editor's document the last time it was looked at: what is new in it since is what the person did. */
  let shadow: Doc | undefined;
  let seenCommits = host.commits;
  let seenSteps = host.steps;
  let lastSel: SentPresence | undefined;
  let undo: Step[] = [];
  let redo: Step[] = [];
  let minted = 0;
  const mint = () => `${me.slice(0, 6)}.${(minted++).toString(36)}`;
  let applying = false;
  const stop = new AbortController();
  /** The stream being listened to: let go of, it is listened to again. */
  let stream: AbortController | undefined;
  /** What was made here and not taken by the server, to make again on the room as it is, once it is loaded again. */
  let carry: { ops: Op[]; seq: number; sent: number } | undefined;
  let resyncs = 0;
  const changed = () => options.onChange?.();

  // --- Places ---------------------------------------------------------------------

  const paragraphsOf = (doc: Doc, part: StoryPart | undefined): Paragraph[] => (part ? (storyOf(doc, part)?.paragraphs ?? []) : doc.paragraphs);

  const here = (): SentPresence | undefined => {
    const { part, page } = host.place;
    const paragraphs = paragraphsOf(host.doc, part);
    const mark = (pos: Position) => {
      const id = paragraphs[pos.para]?.id;
      return id === undefined ? undefined : { id, offset: pos.offset };
    };
    const anchor = mark(host.selection.anchor);
    const focus = mark(host.selection.focus);
    return anchor && focus ? { ...(part ? { part } : {}), page, anchor, focus } : undefined;
  };

  /** Where places kept by id are in a document, part by part. */
  const finder = (doc: Doc) => {
    const maps = new Map<string, Map<string, number>>();
    return (part: StoryPart | undefined, mark: { id: string; offset: number }): Position | undefined => {
      let map = maps.get(part ?? '');
      const paragraphs = paragraphsOf(doc, part);
      if (!map) {
        map = new Map(paragraphs.map((p, i) => [p.id ?? '', i]));
        maps.set(part ?? '', map);
      }
      const para = map.get(mark.id);
      return para === undefined ? undefined : { para, offset: Math.max(0, Math.min(mark.offset, paragraphLength(paragraphs[para]))) };
    };
  };

  const through = (sel: SentPresence, ops: Op[]): SentPresence => {
    let anchor: Anchor = { ...sel.anchor, ...(sel.part ? { part: sel.part } : {}) };
    let focus: Anchor = { ...sel.focus, ...(sel.part ? { part: sel.part } : {}) };
    for (const op of ops) {
      anchor = mapAnchor(anchor, op);
      focus = mapAnchor(focus, op);
    }
    return { ...sel, anchor: { id: anchor.id, offset: anchor.offset }, focus: { id: focus.id, offset: focus.offset } };
  };

  /** The selection the editor is to have in `doc`: `sel` when it is still there, or its own, as near as it can be. */
  const selectionIn = (doc: Doc, sel: SentPresence | undefined): HostSelection => {
    const { part } = host.place;
    const find = finder(doc);
    const anchor = sel && sel.part === part ? find(part, sel.anchor) : undefined;
    const focus = sel && sel.part === part ? find(part, sel.focus) : undefined;
    return anchor && focus ? { anchor, focus } : host.selection;
  };

  const showPeers = () => {
    const find = finder(host.doc);
    const carets: PeerCaret[] = [];
    for (const peer of peers.values()) {
      if (!peer.sel) continue;
      const anchor = find(peer.sel.part, peer.sel.anchor);
      const focus = find(peer.sel.part, peer.sel.focus);
      if (anchor && focus) carets.push({ name: peer.name, color: peer.color, ...(peer.sel.part ? { part: peer.sel.part } : {}), page: peer.sel.page, anchor, focus });
    }
    host.setPeers(carets);
  };

  // --- Sending --------------------------------------------------------------------

  const post = async (what: 'ops' | 'presence', data: object): Promise<number> => {
    try {
      return (await fetch(`${url}/collab/rooms/${room}/${what}`, { method: 'POST', body: encode({ client: me, ...data }), signal: stop.signal })).status;
    } catch {
      return 0;
    }
  };

  let retry: ReturnType<typeof setTimeout> | undefined;
  /** Whether the server said it took what is on its way; its place comes later, with everybody's. */
  let taken = false;
  const flush = () => {
    if (state !== 'on' || posting || (inflight ? taken : !buffer.length)) return;
    if (!inflight) {
      inflight = buffer;
      buffer = [];
      seq++;
      taken = false;
    }
    posting = true;
    const sent = { epoch, rev, seq, ops: inflight };
    void post('ops', sent).then((status) => {
      posting = false;
      if (state !== 'on') return;
      if (status === 200) {
        // Its place may have come before this answer did: then there is more to send already.
        if (inflight && sent.seq === seq) taken = true;
        flush();
      } else if (status !== 409) {
        // Not taken, and not because the room moved on, which coming back to it sorts out: again.
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
      const sel = here();
      const key = JSON.stringify([sel ?? null, name]);
      if (key === sentSel) return;
      sentSel = key;
      void post('presence', { sel: sel ?? null, name });
    }, 40);
  };

  // --- What the person does -------------------------------------------------------

  /**
   * Two people making a picture or a note at once would give them the same
   * name, which each only looked for in their own document. The new ones are
   * named again, with something of this editor in the name.
   */
  const unique = (before: Doc, after: Doc): Doc => {
    let doc = after;
    const rewrite = (change: (xml: string) => string | undefined) => {
      const fix = (paragraphs: Paragraph[]): Paragraph[] => {
        let out: Paragraph[] | undefined;
        paragraphs.forEach((p, i) => {
          if (!p.runs.some((run) => run.props.object && change(run.props.object) !== undefined)) return;
          out ??= paragraphs.slice();
          out[i] = { ...p, runs: p.runs.map((run) => (run.props.object && change(run.props.object) !== undefined ? { ...run, props: { ...run.props, object: change(run.props.object) } } : run)) };
        });
        return out ?? paragraphs;
      };
      doc = { ...doc, paragraphs: fix(doc.paragraphs) };
      for (const part of storyPartsOf(doc)) {
        const story = storyOf(doc, part);
        if (!story) continue;
        const paragraphs = fix(story.paragraphs);
        if (paragraphs !== story.paragraphs) doc = withStory(doc, part, { ...story, paragraphs });
      }
    };
    if (after.media !== before.media) {
      for (const key of Object.keys(after.media ?? {})) {
        if (before.media?.[key] || key.includes('.')) continue;
        const named = `${key}.${mint()}`;
        const { [key]: bytes, ...rest } = doc.media!;
        doc = { ...doc, media: { ...rest, [named]: bytes } };
        rewrite((xml) => (xml.includes(`"dx:${key}"`) ? xml.split(`"dx:${key}"`).join(`"dx:${named}"`) : undefined));
      }
    }
    if (after.notes !== before.notes) {
      const had = new Set((before.notes ?? []).map((note) => note.id));
      for (const note of after.notes ?? []) {
        if (had.has(note.id) || note.id.length >= 9) continue;
        const named = String(100000000 + Math.floor(Math.random() * 899999999));
        doc = { ...doc, notes: doc.notes!.map((n) => (n.id === note.id ? { ...n, id: named } : n)) };
        rewrite((xml) => (noteMark(xml)?.id === note.id ? xml.split(`w:id="${note.id}"`).join(`w:id="${named}"`) : undefined));
      }
    }
    return doc;
  };

  /** Takes what the person did since the last look, to send it; says whether there was anything. */
  const syncLocal = (): boolean => {
    if (!shadow || host.doc === shadow) return false;
    const next = ensureIds(shadow, unique(shadow, host.doc), mint);
    if (next !== host.doc) host.doc = next;
    const ops = diff(shadow, next);
    if (ops.length && host.commits !== seenCommits) {
      const back = diff(next, shadow);
      const top = undo[undo.length - 1];
      if (host.steps !== seenSteps || !top) undo.push({ ops: back, sel: lastSel });
      else top.ops = [...back, ...top.ops];
      redo = [];
    }
    seenCommits = host.commits;
    seenSteps = host.steps;
    shadow = next;
    buffer.push(...ops);
    flush();
    return ops.length > 0;
  };

  const onHostChange = () => {
    if (applying || !shadow) return;
    syncLocal();
    lastSel = here();
    sendPresence();
    showPeers();
  };

  const show = (doc: Doc, sel: SentPresence | undefined, reveal = false) => {
    applying = true;
    try {
      shadow = doc;
      host.replace(doc, selectionIn(doc, sel), reveal);
    } finally {
      applying = false;
    }
    // Showing it may have changed it: a header being edited that someone else took away comes back, empty.
    syncLocal();
    lastSel = here();
    seenCommits = host.commits;
    seenSteps = host.steps;
    showPeers();
    sendPresence();
  };

  const step = (from: Step[], to: Step[]) => {
    syncLocal();
    const taken = from.pop();
    if (!taken || !shadow) return;
    const next = apply(shadow, taken.ops);
    to.push({ ops: diff(next, shadow), sel: here() });
    buffer.push(...diff(shadow, next));
    show(next, taken.sel, true);
    flush();
    changed();
  };

  const history: HostHistory = {
    undo: () => step(undo, redo),
    redo: () => step(redo, undo),
    get canUndo() {
      return undo.length > 0;
    },
    get canRedo() {
      return redo.length > 0;
    },
  };

  // --- What the others do ---------------------------------------------------------

  const rename = (ops: Op[], renamed: Renamed[]) => (renamed.length ? ops.map((op) => renamed.reduce(renameTable, op)) : ops);

  const take = (entry: Entry) => {
    if (!confirmed) return;
    confirmed = apply(confirmed, entry.ops);
    rev++;
    if (entry.by === me) {
      // Its own, in its place. As it was sent, the editor already shows it.
      const same = inflight && encode(entry.ops) === encode(inflight);
      inflight = undefined;
      taken = false;
      if (!same) show(buffer.length ? apply(confirmed, buffer) : confirmed, here());
      flush();
      return;
    }
    syncLocal();
    const sel = here();
    let theirs = entry.ops;
    const renamed: Renamed[] = [];
    if (inflight) {
      const x = transform(inflight, theirs);
      inflight = x.second;
      theirs = x.first;
      renamed.push(...x.renamed);
    }
    if (buffer.length) {
      const x = transform(rename(buffer, renamed), theirs);
      buffer = x.second;
      theirs = x.first;
      renamed.push(...x.renamed);
    }
    // What is kept to undo is made after theirs too, from the last step back.
    for (const stack of [undo, redo]) {
      let over = theirs;
      for (let i = stack.length - 1; i >= 0; i--) {
        const x = transform(rename(stack[i].ops, renamed), over);
        stack[i].ops = x.second;
        over = x.first;
      }
    }
    for (const peer of peers.values()) if (peer.client !== entry.by && peer.sel) peer.sel = through(peer.sel, theirs);
    const mine = [...(inflight ?? []), ...buffer];
    show(mine.length ? apply(confirmed, mine) : confirmed, sel && through(sel, theirs));
  };

  // --- The connection -------------------------------------------------------------

  const start = async (hello: { epoch: number; from: number; entries: Entry[]; name: string; color: string; as?: string; peers: (Peer & { sel?: SentPresence })[] }) => {
    title = hello.name;
    color = hello.color;
    if (hello.as) name = hello.as;
    peers.clear();
    for (const peer of hello.peers) peers.set(peer.client, peer);
    if (!confirmed || hello.epoch !== epoch || hello.from !== rev) {
      // From the start: the file of the room, and every change made to it since.
      const response = await fetch(`${url}/collab/rooms/${room}/base?client=${me}`, { signal: stop.signal });
      if (!response.ok) throw new Error(`${response.status}`);
      let doc = stampIds(importDocx(new Uint8Array(await response.arrayBuffer())));
      if (hello.from !== 0) {
        // It was given the changes since a place it is not at: it asks again, for all of them.
        confirmed = undefined;
        epoch = 0;
        rev = 0;
        throw new Error('out of step');
      }
      for (const entry of hello.entries) doc = apply(doc, entry.ops);
      // Loaded again because it was not the room's: what was made here and is not in the room yet, and what was
      // typed while it was being loaded, is made again on it. What was sent and got there is in it already.
      const kept = carry;
      carry = undefined;
      if (kept) syncLocal();
      const arrived = kept && kept.sent && hello.entries.some((entry) => entry.by === me && entry.seq === kept.seq);
      const mine = kept ? [...kept.ops.slice(arrived ? kept.sent : 0), ...buffer] : [];
      confirmed = doc;
      epoch = hello.epoch;
      rev = hello.entries.length;
      inflight = undefined;
      taken = false;
      buffer = [];
      undo = [];
      redo = [];
      applying = true;
      try {
        if (kept) {
          const sel = here();
          shadow = mine.length ? apply(doc, mine) : doc;
          host.replace(shadow, selectionIn(shadow, sel));
        } else {
          shadow = doc;
          host.load(doc);
        }
      } finally {
        applying = false;
      }
      buffer = mine;
      seenCommits = host.commits;
      seenSteps = host.steps;
      state = 'on';
      if (mine.length) flush();
    } else {
      state = 'on';
      for (const entry of hello.entries) take(entry);
      // What was on its way when the connection went, and never got there, goes again.
      posting = false;
      taken = false;
      flush();
    }
    sentSel = '';
    lastSel = here();
    sendPresence();
    showPeers();
    changed();
  };

  /** The document here is not the room's: it is loaded again, from the room's file and every change made to it. */
  const resync = () => {
    syncLocal();
    // What was sent may be in the room already: then it is not made again.
    carry = { ops: [...(inflight ?? []), ...buffer], seq, sent: inflight?.length ?? 0 };
    resyncs++;
    console.warn(`[collab] ${room}: el documento no era el de la sala; se carga de nuevo`);
    confirmed = undefined;
    epoch = 0;
    rev = 0;
    inflight = undefined;
    buffer = [];
    // Nothing goes to the room until it is loaded again; what is typed meanwhile waits.
    state = 'connecting';
    stream?.abort();
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
        const query = `client=${me}&name=${encodeURIComponent(name)}&epoch=${epoch}&from=${rev}${options.ticket ? `&ticket=${encodeURIComponent(options.ticket)}` : ''}`;
        await listen(`${url}/collab/rooms/${room}/events?${query}`, listening.signal, (event, data) => {
          queue = queue.then(async () => {
            if (state === 'closed') return;
            if (event === 'hello') {
              await start(decode(data));
              wait = 500;
            } else if (event === 'op') {
              const entry = decode<Entry & { rev: number }>(data);
              if (entry.rev === rev) take(entry);
            } else if (event === 'presence') {
              const peer = decode<Peer & { sel?: SentPresence }>(data);
              peers.set(peer.client, peer);
              showPeers();
              changed();
            } else if (event === 'check') {
              const check = decode<{ epoch: number; rev: number; digest: string }>(data);
              if (confirmed && check.epoch === epoch && check.rev === rev && digest(confirmed) !== check.digest) resync();
            } else if (event === 'leave') {
              peers.delete(decode<{ client: string }>(data).client);
              showPeers();
              changed();
            }
          });
        });
        await queue;
      } catch (error) {
        // A room that is not there is not going to be, and neither is one this person may not come into: nothing to come back to.
        const status = (error as { status?: number }).status;
        if (status === 404 || status === 403) {
          state = 'closed';
          break;
        }
      } finally {
        stop.signal.removeEventListener('abort', leaving);
      }
      if ((state as CollabState) === 'closed') break;
      // Let go of to load the room again: at once, without saying it went.
      if (carry && !confirmed) continue;
      state = 'offline';
      peers.clear();
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
    get title() {
      return title;
    },
    get peers() {
      return [...peers.values()].map(({ client, name: n, color: c }) => ({ client, name: n, color: c }));
    },
    get color() {
      return color;
    },
    get name() {
      return name;
    },
    get pending() {
      return (inflight?.length ?? 0) + buffer.length + (carry?.ops.length ?? 0);
    },
    get resyncs() {
      return resyncs;
    },
    rename(next: string) {
      name = next;
      sendPresence();
    },
    leave() {
      if (state === 'closed') return;
      state = 'closed';
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

export { type Op } from './changes';
