// Where the server keeps the documents being shared. There are three ways:
// nowhere, which lasts as long as the server runs; in a folder of its own
// machine; or in the system the server is part of, which is asked for each
// document and given it back as it changes. With the last one the server
// keeps nothing itself: a room is in its memory while people are in it, and
// the document is the system's, which is also the one to say who may come in.
// Node only.

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type Op, decode, encode } from './changes';

export interface Entry {
  /** Who made the changes, and which of their sendings it was. */
  by: string;
  seq: number;
  ops: Op[];
}

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

/** The rooms in a folder, each in one of its own: its file, its changes, and what it is called. */
export function folderStorage(dir: string): RoomStorage {
  const root = resolve(dir);
  mkdirSync(root, { recursive: true });
  const at = (id: string, file: string) => join(root, id, file);
  return {
    open: true,
    forgets: false,
    async load(id) {
      if (!existsSync(at(id, 'meta.json'))) return undefined;
      const meta = JSON.parse(readFileSync(at(id, 'meta.json'), 'utf8')) as { name: string; epoch: number };
      const lines = existsSync(at(id, 'log.jsonl')) ? readFileSync(at(id, 'log.jsonl'), 'utf8').split('\n') : [];
      return { name: meta.name, epoch: meta.epoch, base: new Uint8Array(readFileSync(at(id, 'base.docx'))), log: lines.filter(Boolean).map((line) => decode<Entry>(line)) };
    },
    async keep(id, room, folded) {
      mkdirSync(join(root, id), { recursive: true });
      if (folded) {
        // The file and the changes it was made from stay beside it, once: a way back.
        renameSync(at(id, 'base.docx'), at(id, 'base.before.docx'));
        renameSync(at(id, 'log.jsonl'), at(id, 'log.before.jsonl'));
      }
      writeFileSync(at(id, 'base.docx'), room.base);
      writeFileSync(at(id, 'log.jsonl'), room.log.map((entry) => `${encode(entry)}\n`).join(''));
      writeFileSync(at(id, 'meta.json'), JSON.stringify({ name: room.name, epoch: room.epoch }));
    },
    add(id, entry) {
      appendFileSync(at(id, 'log.jsonl'), `${encode(entry)}\n`);
    },
  };
}

export interface BackendOptions {
  /** Where the system answers for its documents: `GET` and `PUT` on `url/<id>`, `POST` on `url/<id>/access`. */
  url: string;
  /** What the server shows the system to be let in, as `Authorization: Bearer …`. */
  key?: string;
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
 */
export function backendStorage(options: BackendOptions): RoomStorage {
  const url = options.url.replace(/\/+$/, '');
  const auth: Record<string, string> = options.key ? { Authorization: `Bearer ${options.key}` } : {};
  const of = (id: string) => `${url}/${encodeURIComponent(id)}`;
  const put = async (id: string, docx: Uint8Array, ended?: Session) => {
    const end: Record<string, string> = ended ? { 'X-Rebodocs-Session-End': '1', 'X-Rebodocs-Authors': ended.authors.map(encodeURIComponent).join(',') } : {};
    const response = await fetch(of(id), { method: 'PUT', headers: { ...auth, ...end, 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, body: docx as BodyInit });
    if (!response.ok) throw new Error(`el sistema respondió ${response.status} al guardar`);
  };
  return {
    open: false,
    forgets: true,
    async load(id) {
      const response = await fetch(of(id), { headers: auth });
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error(`el sistema respondió ${response.status} al pedir el documento`);
      let name = response.headers.get('X-Document-Name') ?? '';
      try {
        name = decodeURIComponent(name);
      } catch {
        // As it came.
      }
      return { name, epoch: 1, base: new Uint8Array(await response.arrayBuffer()), log: [] };
    },
    // A room that starts is the document the system already has; one that was folded is the document to keep.
    keep: (id, room, folded, ended) => (folded ? put(id, room.base, ended) : Promise.resolve()),
    add: () => {},
    save: (id, docx) => put(id, docx),
    async admit(id, ticket) {
      const response = await fetch(`${of(id)}/access`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket }) });
      if (!response.ok) return undefined;
      const answer = (await response.json().catch(() => ({}))) as { name?: unknown; readOnly?: unknown };
      return { ...(typeof answer.name === 'string' && { name: answer.name }), ...(answer.readOnly === true && { readOnly: true }) };
    },
  };
}
