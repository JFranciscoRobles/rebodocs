// Where the server keeps the documents being shared. There are three ways:
// nowhere, which lasts as long as the server runs; in a folder of its own
// machine; or in the system the server is part of, which is asked for each
// document and given it back as it changes. With the last one the server
// keeps nothing itself: a room is in its memory while people are in it, and
// the document is the system's, which is also the one to say who may come in.
// Node only.

import { existsSync, mkdirSync } from 'node:fs';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { decode, encode } from './changes';
import type { Entry } from './protocol';

export type { Entry } from './protocol';

/** A session of work on a document: from when someone came into its room to when the last one left. */
export interface Session {
  /** What those who changed it are called, in the order they first did. */
  authors: string[];
}

/** What there is to keep of a room: the file it started from, and the changes made to it since. */
export interface Kept {
  name: string;
  /** Goes up each time the changes are folded into the file. */
  epoch: number;
  base: Uint8Array;
  log: Entry[];
}

export interface RoomStorage {
  /** Whether anybody may start a room with a document of their own; otherwise the rooms are the documents it has. */
  readonly open: boolean;
  /** Whether a room is let go of once nobody is in it: it is kept somewhere else, whole. */
  readonly forgets: boolean;
  load(id: string): Promise<Kept | undefined>;
  /**
   * A room as it starts, or as it is once its changes were folded into its
   * file. Folded because everybody left, `ended` says who changed it while
   * they were in it: the end of a session of work, for a storage that keeps
   * a version of each.
   */
  keep(id: string, room: Kept, folded: boolean, ended?: Session): Promise<void>;
  /** One more change to a room. */
  add(id: string, entry: Entry): void;
  /** The document of a room people are working in, as it is now: for the storages that have nothing but that. */
  save?(id: string, docx: Uint8Array): Promise<void>;
  /**
   * Who may come into a room, when knowing its name is not enough. Gives what
   * they are called, and whether they come in only to watch; or nothing for no.
   */
  admit?(id: string, ticket: string): Promise<{ name?: string; readOnly?: boolean } | undefined>;
}

/** Nothing is kept: the rooms last as long as the server runs. */
export function memoryStorage(): RoomStorage {
  return { open: true, forgets: false, load: async () => undefined, keep: async () => {}, add: () => {} };
}

/**
 * What is being written of each room, by its folder: the next writing waits
 * for it, so a change is never put before the file it goes after, nor read
 * back before it is there. Shared by every storage of the process.
 */
const writing = new Map<string, Promise<void>>();

/** The rooms in a folder, each in one of its own: its file, its changes, and what it is called. */
export function folderStorage(dir: string): RoomStorage {
  const root = resolve(dir);
  mkdirSync(root, { recursive: true });
  const at = (id: string, file: string) => join(root, id, file);
  /** Runs `task` once what was asked before it of the room is written; what fails does not hold up what follows. */
  const after = <T>(id: string, task: () => Promise<T>): Promise<T> => {
    const key = join(root, id);
    const done = (writing.get(key) ?? Promise.resolve()).then(task);
    const settled = done.then(
      () => {},
      () => {},
    );
    writing.set(key, settled);
    void settled.then(() => {
      if (writing.get(key) === settled) writing.delete(key);
    });
    return done;
  };
  return {
    open: true,
    forgets: false,
    load: (id) =>
      after(id, async () => {
        if (!existsSync(at(id, 'meta.json'))) return undefined;
        const meta = JSON.parse(await readFile(at(id, 'meta.json'), 'utf8')) as { name: string; epoch: number };
        const lines = existsSync(at(id, 'log.jsonl')) ? (await readFile(at(id, 'log.jsonl'), 'utf8')).split('\n') : [];
        return { name: meta.name, epoch: meta.epoch, base: new Uint8Array(await readFile(at(id, 'base.docx'))), log: lines.filter(Boolean).map((line) => decode<Entry>(line)) };
      }),
    keep: (id, room, folded) =>
      after(id, async () => {
        await mkdir(join(root, id), { recursive: true });
        if (folded) {
          // The file and the changes it was made from stay beside it, once: a way back.
          await rename(at(id, 'base.docx'), at(id, 'base.before.docx'));
          await rename(at(id, 'log.jsonl'), at(id, 'log.before.jsonl'));
        }
        await writeFile(at(id, 'base.docx'), room.base);
        await writeFile(at(id, 'log.jsonl'), room.log.map((entry) => `${encode(entry)}\n`).join(''));
        await writeFile(at(id, 'meta.json'), JSON.stringify({ name: room.name, epoch: room.epoch }));
      }),
    add(id, entry) {
      after(id, () => appendFile(at(id, 'log.jsonl'), `${encode(entry)}\n`)).catch((error: Error) => console.error(`[collab] ${id}: a change could not be written: ${error.message}`));
    },
  };
}

export interface BackendOptions {
  /** Where the system answers for its documents: `GET` and `PUT` on `url/<id>`, `POST` on `url/<id>/access`. */
  url: string;
  /** What the server shows the system to be let in, as `Authorization: Bearer …`. */
  key?: string;
  /**
   * Gives the system every change as it comes, besides the document now and
   * then, so that a server that stops all at once loses none: the room
   * starts again from them. Off unless true; the system answers three more
   * requests then (see `backendStorage`).
   */
  log?: boolean;
}

/** What the log of a room starts with: the file its changes are made to, and which one it is. */
interface LogStart {
  epoch: number;
  name: string;
  base: Uint8Array;
}

/**
 * The documents are those of the system the server works for, which is asked
 * for them over HTTP:
 *
 *   GET  url/<id>          the document, as a DOCX; its name in `X-Document-Name` (URL-encoded). 404 when there is none.
 *   PUT  url/<id>          the document as it is now, as a DOCX, to keep. The last one of a session, when
 *                          everybody left, says so in `X-Rebodocs-Session-End: 1`, and who changed it in
 *                          `X-Rebodocs-Authors` (each name URL-encoded, separated by commas): when to keep a version.
 *   POST url/<id>/access   `{ "ticket": "…" }`: 200 with `{ "name": "…" }` when whoever has that ticket may edit it,
 *                          and `"readOnly": true` besides when they may only look at it.
 *
 * With `log`, the changes too, as lines of text the system keeps as they come and gives back as they were:
 *
 *   PUT    url/<id>/changes   a log starts: its first line, which takes the place of any log there was.
 *   POST   url/<id>/changes   more lines, to go after those there are. `X-Rebodocs-From` says how many changes
 *                             came before them, for a system that wants to check that none went missing (409 if so).
 *   GET    url/<id>/changes   every line, as they came; 404 when there is no log.
 *
 * A `PUT url/<id>` that ends a session (`X-Rebodocs-Session-End: 1`) ends the log too: the system lets it go
 * then, as the document it has is the whole of it. A room that opens with a log starts again from it.
 */
export function backendStorage(options: BackendOptions): RoomStorage {
  const url = options.url.replace(/\/+$/, '');
  const auth: Record<string, string> = options.key ? { Authorization: `Bearer ${options.key}` } : {};
  const of = (id: string) => `${url}/${encodeURIComponent(id)}`;
  const changes = (id: string) => `${of(id)}/changes`;
  /** What is on its way to the log of each room, and whether its log was started. */
  const logs = new Map<string, { start?: LogStart; started: boolean; next: number; queued: Entry[]; sending?: Promise<void> }>();
  const logOf = (id: string) => {
    let log = logs.get(id);
    if (!log) logs.set(id, (log = { started: false, next: 0, queued: [] }));
    return log;
  };
  /** Sends what is queued for a room's log, at once and one request at a time: what comes meanwhile goes in the next. */
  const sendLog = (id: string): Promise<void> => {
    const log = logOf(id);
    if (log.sending) return log.sending;
    let sending: Promise<void> | undefined;
    sending = (async () => {
      // Begun after it is set: with nothing to send, it would end before, and be held as being sent for good.
      await Promise.resolve();
      try {
        while (log.queued.length || (!log.started && log.start)) {
          if (!log.started && log.start) {
            const response = await fetch(changes(id), { method: 'PUT', headers: { ...auth, 'Content-Type': 'text/plain' }, body: `${encode(log.start)}\n` });
            if (!response.ok) throw new Error(`the system answered ${response.status} to a log being started`);
            log.started = true;
            continue;
          }
          const batch = log.queued.slice();
          const response = await fetch(changes(id), {
            method: 'POST',
            headers: { ...auth, 'Content-Type': 'text/plain', 'X-Rebodocs-From': String(log.next) },
            body: batch.map((entry) => `${encode(entry)}\n`).join(''),
          });
          if (response.status === 409) throw new Error('the system has other changes of this room than this server: is the room open in two processes at once?');
          if (!response.ok) throw new Error(`the system answered ${response.status} to changes being logged`);
          log.queued.splice(0, batch.length);
          log.next += batch.length;
        }
      } finally {
        if (log.sending === sending) log.sending = undefined;
      }
    })();
    log.sending = sending;
    return sending;
  };
  /** A new log, from the file the changes are made to from now on. */
  const restart = (id: string, start: LogStart) => {
    const log = logOf(id);
    log.start = start;
    log.started = false;
    log.next = 0;
    log.queued = [];
  };
  const put = async (id: string, docx: Uint8Array, ended?: Session) => {
    const end: Record<string, string> = ended ? { 'X-Rebodocs-Session-End': '1', 'X-Rebodocs-Authors': ended.authors.map(encodeURIComponent).join(',') } : {};
    const response = await fetch(of(id), {
      method: 'PUT',
      headers: { ...auth, ...end, 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      body: docx as BodyInit,
    });
    if (!response.ok) throw new Error(`the system answered ${response.status} to the document being kept`);
  };
  return {
    open: false,
    forgets: true,
    async load(id) {
      // A log means the server stopped while people were in the room: it starts again from where they were.
      if (options.log) {
        const logged = await fetch(changes(id), { headers: auth });
        if (logged.ok) {
          const lines = (await logged.text()).split('\n').filter(Boolean);
          const start = lines.length ? decode<LogStart>(lines[0]) : undefined;
          if (start?.base) {
            const log = lines.slice(1).map((line) => decode<Entry>(line));
            restart(id, start);
            Object.assign(logOf(id), { started: true, next: log.length });
            return { name: start.name, epoch: start.epoch, base: start.base, log };
          }
        } else if (logged.status !== 404) throw new Error(`the system answered ${logged.status} when asked for the changes of the document`);
      }
      const response = await fetch(of(id), { headers: auth });
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error(`the system answered ${response.status} when asked for the document`);
      let name = response.headers.get('X-Document-Name') ?? '';
      try {
        name = decodeURIComponent(name);
      } catch {
        // As it came.
      }
      // Read again each time a room opens, the file may not be the one an editor coming back had: the epoch says so.
      const kept = { name, epoch: Date.now(), base: new Uint8Array(await response.arrayBuffer()), log: [] };
      // The log starts with the first change, from the file the room opened with.
      if (options.log) restart(id, kept);
      return kept;
    },
    // A room that starts is the document the system already has; one that was folded is the document to keep.
    async keep(id, room, folded, ended) {
      if (!folded) return;
      // What was on its way goes first: the log is of the file being replaced.
      if (options.log) await sendLog(id).catch(() => {});
      await put(id, room.base, ended);
      if (!options.log) return;
      // The session ended, and the system let go of its log with it; or the changes became the file, and a new log starts from it.
      if (ended) logs.delete(id);
      else {
        restart(id, { name: room.name, epoch: room.epoch, base: room.base });
        // The changes made to the new file while it was being kept: those added meanwhile went to the old log.
        logOf(id).queued = room.log.slice();
        await sendLog(id);
      }
    },
    add(id, entry) {
      if (!options.log) return;
      logOf(id).queued.push(entry);
      // Not lost when it fails: it goes with the next change, or with the next file.
      sendLog(id).catch((error: Error) => console.error(`[collab] ${id}: ${error.message}`));
    },
    save: (id, docx) => put(id, docx),
    async admit(id, ticket) {
      const response = await fetch(`${of(id)}/access`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket }) });
      if (!response.ok) return undefined;
      const answer = (await response.json().catch(() => ({}))) as { name?: unknown; readOnly?: unknown };
      return { ...(typeof answer.name === 'string' && { name: answer.name }), ...(answer.readOnly === true && { readOnly: true }) };
    },
  };
}
