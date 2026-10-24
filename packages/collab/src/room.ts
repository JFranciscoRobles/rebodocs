// A room: one document being shared, the people in it, and every change made
// to it since its file, in the one order everybody follows. It takes a change,
// adjusting it to those that got there first; tells everybody; folds the
// changes into the file; gives the document to the storage; and asks the
// storage again who may be in. It knows nothing of HTTP: the server hands it
// each person's stream as something to write events to.

import { randomBytes } from 'node:crypto';
import { type Doc, exportDocx, importDocx } from '@rebodocs/core/internal';
import { type Op, apply, digest, renameIds, restamp, stampIds, transform } from './changes';
import { type Entry, type EventName, type Events, type Hello, type OpsPost, PROTOCOL, type PeerInfo, type Presence, eventText } from './protocol';
import type { Kept, RoomStorage, Session } from './storage';

/** The colours people are told apart by, in the order they are given out. */
export const PEER_COLORS = ['E8710A', '1A73E8', '0F9D58', 'D93025', '9334E6', '00897B', 'C2185B', '6D4C41'];
/** How many sendings someone may make at once, and how many more each second: more than an editor ever makes. */
const BURST = 200;
const PER_SECOND = 50;

/** Where events go to someone: an open stream. */
export interface Listener {
  write(text: string): void;
  end(): void;
}

/** What happens in the rooms, for a system to log or count. */
export type CollabEvent =
  | { type: 'join'; room: string; client: string; name: string; readOnly: boolean }
  | { type: 'leave'; room: string; client: string; name: string }
  /** The changes of a room folded into its file: `people` is how many were in it, none when it was left empty. */
  | { type: 'fold'; room: string; changes: number; people: number }
  | { type: 'save'; room: string }
  /** Someone the storage no longer lets in, sent away. */
  | { type: 'removed'; room: string; client: string; name: string }
  | { type: 'error'; room: string; what: string; error: Error };

/** What the storage says of someone: what they are called, and whether they only watch. Nothing for no. */
export type Pass = { name?: string; readOnly?: boolean } | undefined;

/** What a room is given by the server it is in. */
export interface RoomContext {
  storage: RoomStorage;
  idle: number;
  foldAfter: number;
  saveAfter: number;
  saveEvery: number;
  checkAfter: number;
  emit(event: CollabEvent): void;
  /** Whether the server is closing: nothing more is begun. */
  closed(): boolean;
  /** The room is kept somewhere else, whole, and nobody is in it: the server lets go of it. */
  forget(room: Room): void;
}

export interface Client {
  /** What the others know them by. */
  id: string;
  /** What only they know, given when they come in and asked of everything they send: knowing the id is not enough to send as them. */
  key: string;
  /** What they came in with, to ask the storage again. */
  ticket: string;
  name: string;
  color: string;
  sel?: Presence;
  /** Let in to watch: what they send to change the document is not taken. */
  readOnly: boolean;
  streams: Set<Listener>;
  /** What they may still send right now: it fills again with time. */
  allowance: number;
  filled: number;
}

export class Room {
  name: string;
  /** Goes up each time the changes are folded into the file: what was known of the room before is of no use then. */
  epoch: number;
  base: Uint8Array;
  log: Entry[];
  readonly clients = new Map<string, Client>();
  /** The last sending taken from each, so one sent twice is taken once. */
  private readonly seqs = new Map<string, number>();
  /** How many are on their way in, while the storage is asked about them: the room is not let go of under them. */
  private entering = 0;
  /** The document with the changes so far made, so the next ones are made to it and not all of them again. */
  private doc?: { doc: Doc; rev: number };
  /** How many changes the storage that only keeps the document has of it; -1 when a folding still has to reach it. */
  private saved: number;
  /** The session whose changes were folded into the file, while the storage still has to be given it. */
  private unkept?: Session;
  /** What everybody who came in since the room was last left empty is called, by the client they came with. */
  private readonly names = new Map<string, string>();
  /** Who changed it since it was last left empty, in the order they first did. */
  private readonly changed = new Set<string>();
  /** How many changes it may gather before they are folded, with people in it. */
  private foldAt: number;
  /** What is being written of it, for the next writing to wait for. */
  private writing?: Promise<void>;
  private idleTimer?: NodeJS.Timeout;
  private saveTimer?: NodeJS.Timeout;
  private saveSince?: number;
  private checkTimer?: NodeJS.Timeout;
  private checkSince?: number;

  constructor(
    readonly id: string,
    kept: Kept,
    private readonly ctx: RoomContext,
  ) {
    this.name = kept.name;
    this.epoch = kept.epoch;
    this.base = kept.base;
    this.log = kept.log;
    this.saved = kept.log.length;
    this.foldAt = ctx.foldAfter;
    for (const entry of kept.log) this.seqs.set(entry.by, entry.seq);
  }

  /** What there is to keep of it. */
  kept(): Kept {
    return { name: this.name, epoch: this.epoch, base: this.base, log: this.log };
  }

  /** Its document as it is now, made from its file and its changes the way every editor makes it. */
  live(): Doc {
    let { doc, rev } = this.doc ?? { doc: stampIds(importDocx(this.base)), rev: 0 };
    for (; rev < this.log.length; rev++) doc = apply(doc, this.log[rev].ops);
    this.doc = { doc, rev };
    return doc;
  }

  /** Its document as it is now, as a file. */
  current(): Uint8Array {
    return this.log.length ? exportDocx(this.live()) : this.base;
  }

  // --- People ---------------------------------------------------------------------

  /** The client with that id, when it shows the key it was given. */
  signed(client: string, key: string | null | undefined): Client | undefined {
    const found = this.clients.get(client);
    return found && found.key === key ? found : undefined;
  }

  /** Asks the storage whether whoever has `ticket` may come in; the room is not let go of meanwhile. */
  async admit(ticket: string): Promise<Pass> {
    const admit = this.ctx.storage.admit;
    if (!admit) return {};
    this.entering++;
    try {
      return await admit(this.id, ticket);
    } finally {
      this.entering--;
      if (!this.clients.size) this.left();
    }
  }

  /**
   * Lets someone in, or back with the key they were given, listening on
   * `stream`; `known` is what they said they had of the room. Gives what
   * they are told first, or nothing when somebody else is in it with their id.
   */
  join(id: string, key: string | null, ticket: string, pass: NonNullable<Pass>, asked: string, stream: Listener, known: { epoch: number; from: number }): Hello | undefined {
    const already = this.clients.get(id);
    if (already && already.key !== key) return undefined;
    clearTimeout(this.idleTimer);
    const used = new Set([...this.clients.values()].map((c) => c.color));
    const client: Client = already ?? {
      id,
      key: randomBytes(18).toString('base64url'),
      ticket,
      name: '',
      color: PEER_COLORS.find((c) => !used.has(c)) ?? PEER_COLORS[this.clients.size % PEER_COLORS.length],
      readOnly: false,
      streams: new Set(),
      allowance: BURST,
      filled: Date.now(),
    };
    client.ticket = ticket;
    // Who they are is for the system to say, when it does.
    client.name = (pass.name ?? asked).slice(0, 80);
    client.readOnly = !!pass.readOnly;
    this.clients.set(id, client);
    this.names.set(id, client.name);
    client.streams.add(stream);
    this.tell('presence', seen(client), id);
    if (!already) this.ctx.emit({ type: 'join', room: this.id, client: id, name: client.name, readOnly: client.readOnly });
    // What it has of the room is of use only if it is of the room as it is now.
    const from = known.epoch === this.epoch ? Math.max(0, Math.min(known.from || 0, this.log.length)) : 0;
    return {
      protocol: PROTOCOL,
      client: id,
      key: client.key,
      color: client.color,
      as: client.name,
      readOnly: client.readOnly,
      epoch: this.epoch,
      name: this.name,
      rev: this.log.length,
      from,
      entries: this.log.slice(from),
      peers: [...this.clients.values()].filter((c) => c !== client).map(seen),
    };
  }

  /** A stream of someone's ended: with none left, they are gone. */
  leave(client: Client, stream: Listener): void {
    client.streams.delete(stream);
    if (client.streams.size || this.clients.get(client.id) !== client) return;
    this.clients.delete(client.id);
    this.tell('leave', { client: client.id });
    this.ctx.emit({ type: 'leave', room: this.id, client: client.id, name: client.name });
    if (!this.clients.size) this.left();
  }

  /** Nobody is in it: once `idle` goes by, its changes are folded into its file. */
  left(): void {
    if (this.clients.size || this.entering || this.ctx.closed()) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => void this.fold(), this.ctx.idle);
  }

  /** Whether someone may send one more thing now: what they may send fills again with time. */
  allows(client: Client): boolean {
    const now = Date.now();
    client.allowance = Math.min(BURST, client.allowance + ((now - client.filled) / 1000) * PER_SECOND);
    client.filled = now;
    if (client.allowance < 1) return false;
    client.allowance--;
    return true;
  }

  /** Where someone is now, and what they are called when the system does not say. */
  presence(client: Client, sel: Presence | null | undefined, name: unknown): void {
    client.sel = sel ?? undefined;
    if (typeof name === 'string' && !this.ctx.storage.admit) {
      client.name = name.slice(0, 80);
      this.names.set(client.id, client.name);
    }
    this.tell('presence', seen(client), client.id);
  }

  /**
   * A sending of changes, made to the room as it was at `rev`: adjusted to
   * those that got there first, it takes its place. `stale` when it was made
   * to the room before it was folded, or does not make sense.
   */
  take(client: Client, posted: Partial<OpsPost>): 'ok' | 'read-only' | 'stale' {
    if (client.readOnly) return 'read-only';
    const { rev, seq, ops } = posted;
    if (posted.epoch !== this.epoch || !Number.isInteger(rev) || rev! < 0 || rev! > this.log.length || !Number.isInteger(seq) || !Array.isArray(ops)) return 'stale';
    // Sent again because the answer got lost: it is already in its place.
    if (seq! <= (this.seqs.get(client.id) ?? 0)) return 'ok';
    const entry: Entry = {
      by: client.id,
      seq: seq!,
      ops: transform(
        ops as Op[],
        this.log.slice(rev).flatMap((e) => e.ops),
      ).second,
    };
    this.log.push(entry);
    this.seqs.set(client.id, seq!);
    this.changed.add(client.id);
    this.ctx.storage.add(this.id, entry);
    this.tell('op', { rev: this.log.length - 1, ...entry });
    this.toCheck();
    this.toSave();
    return 'ok';
  }

  /** Asks the storage again whether each person in it may still be. */
  async recheck(): Promise<void> {
    const admit = this.ctx.storage.admit;
    if (!admit) return;
    await Promise.all(
      [...this.clients.values()].map(async (client) => {
        let pass: Pass;
        try {
          pass = await admit(this.id, client.ticket);
        } catch (error) {
          // Not known: they stay as they were.
          return this.complain('could not ask again who may be in the room', error);
        }
        if (this.clients.get(client.id) !== client) return;
        if (!pass) return this.remove(client);
        // Let in as something else: they come back as that.
        if (!!pass.readOnly !== client.readOnly || (pass.name !== undefined && pass.name.slice(0, 80) !== client.name)) for (const stream of client.streams) stream.end();
      }),
    );
  }

  /** Sends someone away: the editor they are in hears that it is not to come back. */
  private remove(client: Client): void {
    for (const stream of client.streams) {
      stream.write(eventText('removed', {}));
      stream.end();
    }
    this.ctx.emit({ type: 'removed', room: this.id, client: client.id, name: client.name });
  }

  // --- Telling the editors --------------------------------------------------------

  private tell<K extends EventName>(event: K, data: Events[K], but?: string): void {
    const text = eventText(event, data);
    for (const client of this.clients.values()) if (client.id !== but) for (const stream of client.streams) stream.write(text);
  }

  /** Tells the room what its document is like, once the changes stop for a moment; or folds them, when there are many. */
  private toCheck(): void {
    const { checkAfter } = this.ctx;
    clearTimeout(this.checkTimer);
    this.checkSince ??= Date.now();
    const wait = Math.max(0, Math.min(checkAfter, this.checkSince + checkAfter * 4 - Date.now()));
    this.checkTimer = setTimeout(() => {
      this.checkTimer = undefined;
      this.checkSince = undefined;
      if (!this.clients.size || this.ctx.closed()) return;
      try {
        if (this.log.length >= this.foldAt && this.compact()) return;
        this.tell('check', { epoch: this.epoch, rev: this.log.length, digest: digest(this.live()) });
      } catch (error) {
        this.complain('the document could not be made to check it', error);
      }
    }, wait);
  }

  // --- Keeping it -----------------------------------------------------------------

  private complain(what: string, error: unknown): void {
    this.ctx.emit({ type: 'error', room: this.id, what, error: error as Error });
  }

  /** Writes to the storage, once what was being written of the room is. */
  private queue(task: () => Promise<void>): Promise<void> {
    const done = (this.writing ?? Promise.resolve()).then(task);
    this.writing = done.catch(() => {});
    return done;
  }

  /** The changes folded into a new file: everything that was known of the room before is of no use now. */
  private refile(base: Uint8Array, doc?: Doc): void {
    this.base = base;
    this.log = [];
    this.doc = doc && { doc, rev: 0 };
    this.saved = 0;
    this.seqs.clear();
    this.epoch++;
  }

  /**
   * Folds the changes of a room people are in into its file. Read again, the
   * file gives its paragraphs other ids: the editors are told which, to make
   * what they have not sent on it. Only when it reads back as the document
   * it was written from; otherwise the changes wait for the room to empty.
   */
  private compact(): boolean {
    const doc = this.live();
    const base = exportDocx(doc);
    const again = stampIds(importDocx(base));
    const ids = restamp(doc);
    const keys = (d: Doc) =>
      Object.keys(d.media ?? {})
        .sort()
        .join(',');
    if (digest(again) !== digest(doc, ids) || keys(again) !== keys(doc)) {
      this.foldAt = this.log.length * 2;
      this.complain('the document does not read back as it was written; its changes wait for the room to empty', new Error(`${this.log.length} changes`));
      return false;
    }
    const changes = this.log.length;
    this.refile(base, again);
    this.foldAt = this.ctx.foldAfter;
    for (const client of this.clients.values()) if (client.sel) client.sel = renameIds(client.sel, ids);
    void this.queue(() => this.ctx.storage.keep(this.id, this.kept(), true)).catch((error) => {
      // Given whole the next time: a storage that keeps only the document has it then.
      this.saved = -1;
      this.complain('the folded document could not be kept', error);
    });
    this.tell('fold', { epoch: this.epoch, rev: changes, ids: Object.fromEntries(ids) });
    this.ctx.emit({ type: 'fold', room: this.id, changes, people: this.clients.size });
    return true;
  }

  /** With nobody in it, its changes become its file: joining it again does not make them all over. */
  async fold(): Promise<void> {
    const empty = () => !this.clients.size && !this.entering && !this.ctx.closed();
    if (!empty()) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    try {
      await this.writing;
      if (!empty()) return;
      if (this.log.length || this.changed.size) {
        // Who changed it, as they were called: the session that ends.
        const authors = [...new Set([...this.changed].map((client) => this.names.get(client) ?? ''))].filter(Boolean);
        const changes = this.log.length;
        if (changes) {
          const base = this.current();
          // What cannot be read back is not kept in place of what could.
          importDocx(base);
          this.refile(base);
          this.ctx.emit({ type: 'fold', room: this.id, changes, people: 0 });
        }
        this.names.clear();
        this.changed.clear();
        this.unkept = { authors };
      }
      if (this.unkept) {
        const ended = this.unkept;
        await this.queue(() => this.ctx.storage.keep(this.id, this.kept(), true, ended));
        this.unkept = undefined;
      }
      if (this.ctx.storage.forgets && empty()) this.ctx.forget(this);
    } catch (error) {
      this.complain('the changes could not be kept, and are still here; trying again', error);
      if (empty()) this.idleTimer = setTimeout(() => void this.fold(), Math.max(this.ctx.idle, 5000));
    }
  }

  /** Gives a storage that keeps only the document the room's as it is now, when it does not have it; resolves once all that was being written is. */
  save(): Promise<void> {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    this.saveSince = undefined;
    const save = this.ctx.storage.save;
    if (!save) return this.writing ?? Promise.resolve();
    return this.queue(async () => {
      if (!this.clients.size || this.saved === this.log.length) return;
      const upTo = this.log.length;
      const epoch = this.epoch;
      await save(this.id, this.current());
      if (this.epoch === epoch) this.saved = Math.max(this.saved, upTo);
      this.ctx.emit({ type: 'save', room: this.id });
    }).catch((error) => {
      this.complain('the document could not be kept; trying again', error);
      if (this.clients.size && !this.ctx.closed()) this.toSave();
    });
  }

  /** Gives its document to the storage a moment after the changes stop, and every so often while they do not. */
  private toSave(): void {
    if (!this.ctx.storage.save || this.ctx.closed()) return;
    clearTimeout(this.saveTimer);
    this.saveSince ??= Date.now();
    const wait = Math.max(0, Math.min(this.ctx.saveAfter, this.saveSince + this.ctx.saveEvery - Date.now()));
    this.saveTimer = setTimeout(() => void this.save(), wait);
  }

  /** The server closes: the streams end, and nothing waits to happen. */
  close(): void {
    clearTimeout(this.idleTimer);
    clearTimeout(this.checkTimer);
    clearTimeout(this.saveTimer);
    for (const client of this.clients.values()) for (const stream of client.streams) stream.end();
  }
}

/** Someone, as the others see them. */
const seen = ({ id, name, color, sel }: Client): PeerInfo => ({ client: id, name, color, sel });
