// The server several people's editors meet at to work on one document. It
// keeps, for each document being shared (a room), the file it started from
// and every change made to it since, in the order they are to be made: the
// one order everybody follows, which is what makes them all end up with the
// same document. A change that was made without knowing of others that got
// here first is adjusted to them before it takes its place.
//
// An editor listens to its room (server-sent events) and posts what its
// person does. Whoever has the name of a room can work in it: the name is
// long and random, and is all there is to keep. Node only.

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { type Doc, exportDocx, importDocx } from '@rebodocs/core';
import { type Op, apply, decode, digest, encode, fromBase64, stampIds, transform } from './changes';
import { type Entry, type RoomStorage, type Session, folderStorage, memoryStorage } from './storage';

export type { Entry, Session };

export interface CollabServerOptions {
  /**
   * The port to listen on; 0 for any free one. Left out, the server listens
   * on none: its `handle` is given the requests of a server of the system's
   * own (Express, Nest, a plain one), under `/collab`.
   */
  port?: number;
  /** The address to listen on: this machine alone (127.0.0.1) when left out. */
  host?: string;
  /** Where the rooms are kept; in memory alone when neither this nor `dataDir` is given. */
  storage?: RoomStorage;
  /** The folder the rooms are kept in, so they outlive the server: short for a `folderStorage`. */
  dataDir?: string;
  /** A word whoever starts sharing a document must give. Joining a room asks for nothing but its name. */
  token?: string;
  /** A folder of files to serve besides: the editor itself, built, so one address gives both. */
  staticDir?: string;
  /** How long a room nobody is in waits before its changes are folded into its file, in milliseconds. */
  idle?: number;
  /** How often the document of a room people are in is given to a storage that keeps nothing else, in milliseconds. */
  saveEvery?: number;
  /**
   * How long after the last change a room is told what its document is like,
   * for every editor in it to see that it has the same, in milliseconds; 1500.
   * While changes keep coming, it is told at least every four times as long.
   */
  checkAfter?: number;
}

export interface CollabServer {
  /** The port it listens on; 0 when it listens on none. */
  readonly port: number;
  /** Resolves once it listens, or at once when it listens on none. */
  ready: Promise<void>;
  /**
   * Answers a request, for a server of the system's own to hand on what goes
   * to `/collab`. What does not is handed to `next` when there is one.
   */
  handle(req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void): void;
  /** Gives the storage what it does not have yet of the rooms people are in. */
  flush(): Promise<void>;
  /** The rooms it holds now, and what the people in each are called: a room nobody is in is on its way out. */
  rooms(): { id: string; people: string[] }[];
  close(): void;
}

/** A place in the text, by the id of its paragraph. */
interface Mark {
  id: string;
  offset: number;
}

/** Where someone's caret is: what the others draw. */
export interface Presence {
  part?: string;
  page: number;
  anchor: Mark;
  focus: Mark;
}

interface Client {
  id: string;
  name: string;
  color: string;
  sel?: Presence;
  /** Let in to watch: what they send to change the document is not taken. */
  readOnly?: boolean;
  streams: Set<ServerResponse>;
}

interface Room {
  id: string;
  name: string;
  /** Goes up each time the changes are folded into the file: what was known of the room before is of no use then. */
  epoch: number;
  base: Uint8Array;
  log: Entry[];
  clients: Map<string, Client>;
  /** The last sending taken from each, so one sent twice is taken once. */
  seqs: Map<string, number>;
  timer?: NodeJS.Timeout;
  /** How many are on their way in, while the storage is asked about them: the room is not let go of under them. */
  entering?: number;
  /** The document with the changes so far made, so the next ones are made to it and not all of them again. */
  live?: { doc: Doc; rev: number };
  /** How many changes the storage that only keeps the document has of it, and whether a folding still has to reach it. */
  saved: number;
  /** The session whose changes were folded into the file, while the storage still has to be given it. */
  unkept?: Session;
  /** What everybody who came in since the changes were last folded is called, by the client they came with. */
  names: Map<string, string>;
  /** When the room is to be told what its document is like, and since when it waits to be. */
  check?: NodeJS.Timeout;
  checkSince?: number;
}

/** The colours people are told apart by, in the order they are given out. */
export const PEER_COLORS = ['E8710A', '1A73E8', '0F9D58', 'D93025', '9334E6', '00897B', 'C2185B', '6D4C41'];
const MAX_BODY = 96 * 1024 * 1024;
const PREFIX = '/collab';
const ROOM_ID = /^[A-Za-z0-9_-]{8,64}$/;
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

export function createCollabServer(options: CollabServerOptions): CollabServer {
  const idle = options.idle ?? 30000;
  const rooms = new Map<string, Room>();
  /** Rooms being read from where they are kept: two who ask for one at once get the same. */
  const opening = new Map<string, Promise<Room | undefined>>();
  const storage = options.storage ?? (options.dataDir ? folderStorage(options.dataDir) : memoryStorage());
  const staticDir = options.staticDir && resolve(options.staticDir);
  let closed = false;

  // --- Keeping the rooms ----------------------------------------------------------

  const kept = ({ name, epoch, base, log }: Room) => ({ name, epoch, base, log });
  const complain = (room: Room, what: string, error: unknown) => console.error(`[collab] ${room.id}: ${what}: ${(error as Error).message}`);

  const find = (id: string): Promise<Room | undefined> => {
    if (!ROOM_ID.test(id)) return Promise.resolve(undefined);
    const open = rooms.get(id);
    if (open) return Promise.resolve(open);
    let wait = opening.get(id);
    if (!wait) {
      wait = storage
        .load(id)
        .then((found) => {
          if (!found) return undefined;
          const room: Room = { id, ...found, clients: new Map(), seqs: new Map(), saved: found.log.length, names: new Map() };
          for (const entry of room.log) room.seqs.set(entry.by, entry.seq);
          rooms.set(id, room);
          return room;
        })
        .finally(() => opening.delete(id));
      opening.set(id, wait);
    }
    return wait;
  };

  /** The document of a room as it is now, made from its file and its changes the way every editor makes it. */
  const live = (room: Room): Doc => {
    let { doc, rev } = room.live ?? { doc: stampIds(importDocx(room.base)), rev: 0 };
    for (; rev < room.log.length; rev++) doc = apply(doc, room.log[rev].ops);
    room.live = { doc, rev };
    return doc;
  };

  /** The document of a room as it is now, as a file. */
  const current = (room: Room): Uint8Array => (room.log.length ? exportDocx(live(room)) : room.base);

  const checkAfter = options.checkAfter ?? 1500;
  /** Tells the room what its document is like, once the changes stop for a moment. */
  const toCheck = (room: Room) => {
    clearTimeout(room.check);
    room.checkSince ??= Date.now();
    const wait = Math.max(0, Math.min(checkAfter, room.checkSince + checkAfter * 4 - Date.now()));
    room.check = setTimeout(() => {
      room.check = undefined;
      room.checkSince = undefined;
      if (!room.clients.size || closed) return;
      try {
        tell(room, 'check', { epoch: room.epoch, rev: room.log.length, digest: digest(live(room)) });
      } catch (error) {
        complain(room, 'no se pudo calcular el documento para comprobarlo', error);
      }
    }, wait);
  };

  /** With nobody in it, a room's changes become its file: joining it again does not make them all over. */
  const fold = async (room: Room): Promise<void> => {
    if (room.clients.size || room.entering || closed) return;
    try {
      let ended: Session | undefined;
      if (room.log.length) {
        // Who changed it, as they were called: the session that ends.
        const authors = [...new Set(room.log.map((entry) => room.names.get(entry.by) ?? ''))].filter(Boolean);
        ended = { authors };
        const base = current(room);
        // What cannot be read back is not kept in place of what could.
        importDocx(base);
        room.base = base;
        room.log = [];
        room.live = undefined;
        room.saved = 0;
        room.seqs.clear();
        room.names.clear();
        room.epoch++;
        room.unkept = ended;
      }
      if (room.unkept) {
        await storage.keep(room.id, kept(room), true, room.unkept);
        room.unkept = undefined;
      }
      // Kept somewhere else, whole: nothing of it stays here.
      if (storage.forgets && !room.clients.size && !room.entering && rooms.get(room.id) === room) rooms.delete(room.id);
    } catch (error) {
      complain(room, 'los cambios no se pudieron guardar y siguen aquí; se intenta de nuevo', error);
      if (!room.clients.size && !closed) room.timer = setTimeout(() => void fold(room), Math.max(idle, 5000));
    }
  };

  const flush = async (): Promise<void> => {
    if (!storage.save) return;
    for (const room of rooms.values()) {
      if (!room.clients.size || room.saved === room.log.length) continue;
      const upTo = room.log.length;
      try {
        await storage.save(room.id, current(room));
        room.saved = Math.max(room.saved, upTo);
      } catch (error) {
        complain(room, 'no se pudo guardar el documento; se intenta de nuevo', error);
      }
    }
  };
  const saver = storage.save ? setInterval(() => void flush(), options.saveEvery ?? 30000) : undefined;

  // --- Talking to the editors -----------------------------------------------------

  const send = (stream: ServerResponse, event: string, data: unknown) => stream.write(`event: ${event}\ndata: ${encode(data)}\n\n`);
  const tell = (room: Room, event: string, data: unknown, but?: string) => {
    for (const client of room.clients.values()) {
      if (client.id !== but) for (const stream of client.streams) send(stream, event, data);
    }
  };
  const seen = ({ id, name, color, sel }: Client) => ({ client: id, name, color, sel });

  const body = (req: IncomingMessage): Promise<string> => {
    // Read already by the server it is mounted in (Express's body parsers).
    const parsed = (req as IncomingMessage & { body?: unknown }).body;
    if (req.readableEnded && parsed !== undefined) {
      if (typeof parsed === 'string') return Promise.resolve(parsed);
      if (parsed instanceof Uint8Array) return Promise.resolve(Buffer.from(parsed).toString('utf8'));
      return Promise.resolve(JSON.stringify(parsed));
    }
    return new Promise((done, fail) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY) req.destroy(new Error('too large'));
        else chunks.push(chunk);
      });
      req.on('error', fail);
      req.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
    });
  };

  const cors = { 'Access-Control-Allow-Origin': '*' };
  const json = (res: ServerResponse, status: number, data: unknown) => res.writeHead(status, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(data));

  const serveFile = (res: ServerResponse, path: string) => {
    if (!staticDir) return json(res, 404, { error: 'not found' });
    let file = resolve(join(staticDir, decodeURIComponent(path)));
    if (file !== staticDir && !file.startsWith(staticDir + sep)) return json(res, 403, { error: 'forbidden' });
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(staticDir, 'index.html');
    if (!existsSync(file)) return json(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  };

  const onRequest = async (req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void): Promise<void> => {
    // Mounted with `app.use('/collab', …)`, Express takes the prefix off the address: it is in `originalUrl`.
    const url = new URL((req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    if (!path.startsWith(`${PREFIX}/`)) {
      if (next) next();
      else if (req.method === 'GET' || req.method === 'HEAD') serveFile(res, path);
      else json(res, 404, { error: 'not found' });
      return;
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }).end();
      return;
    }
    const [, , what, id, action] = path.split('/');

    if (req.method === 'GET' && what === 'ping') return void json(res, 200, { collab: 1, token: !!options.token });

    // A document starts being shared: its file is what everybody starts from.
    if (req.method === 'POST' && what === 'rooms' && !id) {
      if (!storage.open) return void json(res, 403, { error: 'rooms' });
      if (options.token && url.searchParams.get('token') !== options.token) return void json(res, 401, { error: 'token' });
      const posted = decode<{ name?: string; docx?: string }>(await body(req));
      const base = fromBase64(String(posted.docx ?? ''));
      importDocx(base);
      const room: Room = { id: randomBytes(12).toString('base64url'), name: String(posted.name ?? '').slice(0, 200), epoch: 1, base, log: [], clients: new Map(), seqs: new Map(), saved: 0, names: new Map() };
      await storage.keep(room.id, kept(room), false);
      rooms.set(room.id, room);
      return void json(res, 200, { room: room.id });
    }

    const room = what === 'rooms' && id ? await find(id) : undefined;
    if (!room) return void json(res, 404, { error: 'room' });
    /** Where coming in takes more than the name of the room, its files are for those who came in. */
    const inside = () => !storage.admit || room.clients.has(url.searchParams.get('client') ?? '');

    // The document as it is now: for whoever wants the file without an editor.
    if (req.method === 'GET' && action === 'docx') {
      if (!inside()) return void json(res, 403, { error: 'access' });
      res.writeHead(200, { ...cors, 'Content-Type': DOCX_TYPE, 'Cache-Control': 'no-store' }).end(current(room));
      return;
    }

    if (req.method === 'GET' && action === 'base') {
      if (!inside()) return void json(res, 403, { error: 'access' });
      res.writeHead(200, { ...cors, 'Content-Type': DOCX_TYPE, 'Cache-Control': 'no-store', 'X-Epoch': String(room.epoch), 'Access-Control-Expose-Headers': 'X-Epoch' }).end(room.base);
      return;
    }

    if (req.method === 'GET' && action === 'events') {
      const clientId = (url.searchParams.get('client') ?? '').slice(0, 64);
      if (!clientId) return void json(res, 400, { error: 'client' });
      let pass: { name?: string; readOnly?: boolean } | undefined = {};
      if (storage.admit) {
        room.entering = (room.entering ?? 0) + 1;
        try {
          pass = await storage.admit(room.id, url.searchParams.get('ticket') ?? '');
        } finally {
          room.entering--;
        }
      }
      if (!pass) {
        if (!room.clients.size) void fold(room);
        return void json(res, 403, { error: 'access' });
      }
      // Gone while the room was being read or the storage was being asked about them: their
      // leaving was not heard, so they are not let in, or they would be in the room for good.
      if (req.socket.destroyed) {
        if (!room.clients.size && !closed) {
          clearTimeout(room.timer);
          room.timer = setTimeout(() => void fold(room), idle);
        }
        return;
      }
      clearTimeout(room.timer);
      const used = new Set([...room.clients.values()].map((c) => c.color));
      const client: Client = room.clients.get(clientId) ?? { id: clientId, name: '', color: PEER_COLORS.find((c) => !used.has(c)) ?? PEER_COLORS[room.clients.size % PEER_COLORS.length], streams: new Set() };
      room.clients.set(clientId, client);
      // Who they are is for the system to say, when it does.
      const named = pass.name;
      client.name = (named ?? url.searchParams.get('name') ?? '').slice(0, 80);
      client.readOnly = !!pass.readOnly;
      room.names.set(client.id, client.name);
      client.streams.add(res);
      res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      // What it has of the room is of use only if it is of the room as it is now.
      const known = Number(url.searchParams.get('epoch')) === room.epoch ? Math.max(0, Math.min(Number(url.searchParams.get('from')) || 0, room.log.length)) : 0;
      send(res, 'hello', { client: client.id, color: client.color, as: client.name, readOnly: client.readOnly, epoch: room.epoch, name: room.name, rev: room.log.length, from: known, entries: room.log.slice(known), peers: [...room.clients.values()].filter((c) => c !== client).map(seen) });
      tell(room, 'presence', seen(client), client.id);
      const beat = setInterval(() => res.write(': still here\n\n'), 20000);
      res.on('close', () => {
        clearInterval(beat);
        client.streams.delete(res);
        if (client.streams.size || room.clients.get(client.id) !== client) return;
        room.clients.delete(client.id);
        tell(room, 'leave', { client: client.id });
        if (!room.clients.size && !closed) room.timer = setTimeout(() => void fold(room), idle);
      });
      return;
    }

    if (req.method === 'POST' && (action === 'ops' || action === 'presence')) {
      const posted = decode<{ client?: string; epoch?: number; rev?: number; seq?: number; ops?: Op[]; sel?: Presence | null; name?: string }>(await body(req));
      const client = room.clients.get(String(posted.client));
      if (!client) return void json(res, 409, { error: 'client' });
      if (action === 'presence') {
        client.sel = posted.sel ?? undefined;
        if (typeof posted.name === 'string' && !storage.admit) {
          client.name = posted.name.slice(0, 80);
          room.names.set(client.id, client.name);
        }
        tell(room, 'presence', seen(client), client.id);
        return void json(res, 200, {});
      }
      if (client.readOnly) return void json(res, 403, { error: 'read-only' });
      const { rev, seq, ops } = posted;
      if (posted.epoch !== room.epoch || !Number.isInteger(rev) || rev! < 0 || rev! > room.log.length || !Number.isInteger(seq) || !Array.isArray(ops)) return void json(res, 409, { error: 'stale' });
      // Sent again because the answer got lost: it is already in its place.
      if (seq! <= (room.seqs.get(client.id) ?? 0)) return void json(res, 200, {});
      const entry: Entry = { by: client.id, seq: seq!, ops: transform(ops, room.log.slice(rev).flatMap((e) => e.ops)).second };
      room.log.push(entry);
      room.seqs.set(client.id, seq!);
      storage.add(room.id, entry);
      tell(room, 'op', { rev: room.log.length - 1, ...entry });
      toCheck(room);
      return void json(res, 200, {});
    }

    json(res, 404, { error: 'not found' });
  };

  const handle = (req: IncomingMessage, res: ServerResponse, next?: (error?: unknown) => void) => {
    onRequest(req, res, next).catch((error: Error) => {
      if (!res.headersSent) json(res, 400, { error: error.message });
      else res.end();
    });
  };

  let server: Server | undefined;
  let port = options.port ?? 0;
  const ready = new Promise<void>((done, fail) => {
    if (options.port === undefined) return done();
    const made = createServer((req, res) => handle(req, res));
    made.once('error', fail);
    made.listen(options.port, options.host ?? '127.0.0.1', () => {
      server = made;
      const address = made.address();
      if (address && typeof address === 'object') port = address.port;
      done();
    });
  });

  return {
    get port() {
      return port;
    },
    ready,
    handle,
    flush,
    rooms: () => [...rooms.values()].map((room) => ({ id: room.id, people: [...room.clients.values()].map((client) => client.name) })),
    close() {
      closed = true;
      clearInterval(saver);
      for (const room of rooms.values()) {
        clearTimeout(room.timer);
        clearTimeout(room.check);
        for (const client of room.clients.values()) for (const stream of client.streams) stream.end();
      }
      server?.close();
      server?.closeAllConnections();
    },
  };
}

/** The rooms kept in a folder, by name: for whoever runs the server to see what it holds. */
export function storedRooms(dataDir: string): string[] {
  return existsSync(dataDir) ? readdirSync(dataDir).filter((id) => ROOM_ID.test(id) && existsSync(join(dataDir, id, 'meta.json'))) : [];
}
