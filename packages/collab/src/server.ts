// The server several people's editors meet at to work on one document. It
// keeps, for each document being shared (a room), the file it started from
// and every change made to it since, in the order they are to be made: the
// one order everybody follows, which is what makes them all end up with the
// same document. A change that was made without knowing of others that got
// here first is adjusted to them before it takes its place.
//
// An editor listens to its room (server-sent events) and posts what its
// person does. Whoever has the name of a room can work in it: the name is
// long and random, and is all there is to keep. This is the HTTP of it: what
// a room does is in room.ts. Node only.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { importDocx } from '@rebodocs/core/internal';
import { decode, fromBase64 } from './changes';
import { type OpsPost, PREFIX, PROTOCOL, type PresencePost, eventText } from './protocol';
import { type CollabEvent, type Listener, Room, type RoomContext } from './room';
import { type Entry, type RoomStorage, type Session, folderStorage, memoryStorage } from './storage';

export type { CollabEvent, Entry, Session };
export type { Presence } from './protocol';
export { PEER_COLORS } from './room';

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
  /**
   * How long after the last change the document of a room people are in is
   * given to a storage that keeps nothing else, in milliseconds; 5000. While
   * changes keep coming, it is given at least every `saveEvery`.
   */
  saveAfter?: number;
  /** The longest the document of a room people are in goes without being given to a storage that keeps nothing else, in milliseconds; 30000. */
  saveEvery?: number;
  /**
   * How many changes a room people stay in gathers before they are folded
   * into its file, at the next pause, so that whoever comes in has fewer to
   * make; 1000. The editors in it load the file again, keeping what they had
   * not sent and what they can undo.
   */
  foldAfter?: number;
  /**
   * How often the storage is asked again whether each person in a room may
   * still be in it, in milliseconds; never when left out. Whoever it no
   * longer lets in is sent away, and whoever it now lets only watch, or edit,
   * comes back as that. `recheck` does it at once.
   */
  recheckEvery?: number;
  /**
   * What the system shows, as `Authorization: Bearer …`, to have the server
   * ask again at once who may be in a room: `POST /collab/rooms/<id>/recheck`,
   * or `POST /collab/recheck` for every room. For a system whose server of
   * rooms runs apart from it, when it takes someone's access away. Without it
   * there is no such address.
   */
  recheckKey?: string;
  /** Told what happens: who comes and goes, the changes being folded, the documents being given to the storage, and what goes wrong, which goes to the console when there is nothing to tell. */
  onEvent?: (event: CollabEvent) => void;
  /**
   * How long after the last change a room is told what its document is like,
   * for every editor in it to see that it has the same, in milliseconds; 1500.
   * While changes keep coming, it is told at least every four times as long.
   */
  checkAfter?: number;
  /**
   * What this process is called, among several behind one address: said in
   * `X-Rebodocs-Instance` on everything it answers, and by `ping`, to see
   * which one a room is in. Each room is to be in one process: the one the
   * address of the room is sent to (see the page on collaboration).
   */
  instance?: string;
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
  /**
   * Asks the storage again whether each person in a room, or in every room,
   * may still be in it: for a system that took someone's access away, or
   * changed it, to have it hold at once.
   */
  recheck(room?: string): Promise<void>;
  /** The rooms it holds now, and what the people in each are called: a room nobody is in is on its way out. */
  rooms(): { id: string; people: string[] }[];
  close(): void;
}

const MAX_BODY = 96 * 1024 * 1024;
/** Where someone is, and what they are called, is never more. */
const MAX_PRESENCE = 64 * 1024;
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
  const rooms = new Map<string, Room>();
  /** Rooms being read from where they are kept: two who ask for one at once get the same. */
  const opening = new Map<string, Promise<Room | undefined>>();
  const storage = options.storage ?? (options.dataDir ? folderStorage(options.dataDir) : memoryStorage());
  const staticDir = options.staticDir && resolve(options.staticDir);
  let closed = false;

  const ctx: RoomContext = {
    storage,
    idle: options.idle ?? 30000,
    foldAfter: options.foldAfter ?? 1000,
    saveAfter: options.saveAfter ?? 5000,
    saveEvery: options.saveEvery ?? 30000,
    checkAfter: options.checkAfter ?? 1500,
    emit(event) {
      if (!options.onEvent) {
        if (event.type === 'error') console.error(`[collab] ${event.room}: ${event.what}: ${event.error.message}`);
        return;
      }
      try {
        options.onEvent(event);
      } catch (error) {
        console.error(`[collab] onEvent: ${(error as Error).message}`);
      }
    },
    closed: () => closed,
    forget(room) {
      if (rooms.get(room.id) === room) rooms.delete(room.id);
    },
  };

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
          const room = new Room(id, found, ctx);
          rooms.set(id, room);
          return room;
        })
        .finally(() => opening.delete(id));
      opening.set(id, wait);
    }
    return wait;
  };

  const flush = async (): Promise<void> => {
    await Promise.all([...rooms.values()].map((room) => room.save()));
  };

  const recheck = async (id?: string): Promise<void> => {
    const which = id === undefined ? [...rooms.values()] : [rooms.get(id)].filter((room): room is Room => !!room);
    await Promise.all(which.map((room) => room.recheck()));
  };
  const rechecker = options.recheckEvery && storage.admit ? setInterval(() => void recheck(), options.recheckEvery) : undefined;

  // --- HTTP -----------------------------------------------------------------------

  const body = (req: IncomingMessage, limit = MAX_BODY): Promise<string> => {
    // Read already by the server it is mounted in (Express's body parsers).
    const parsed = (req as IncomingMessage & { body?: unknown }).body;
    if (req.readableEnded && parsed !== undefined) {
      const text = typeof parsed === 'string' ? parsed : parsed instanceof Uint8Array ? Buffer.from(parsed).toString('utf8') : JSON.stringify(parsed);
      return text.length > limit ? Promise.reject(new Error('too large')) : Promise.resolve(text);
    }
    return new Promise((done, fail) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) req.destroy(new Error('too large'));
        else chunks.push(chunk);
      });
      req.on('error', fail);
      req.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
    });
  };

  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    ...(options.instance && { 'X-Rebodocs-Instance': options.instance, 'Access-Control-Expose-Headers': 'X-Rebodocs-Instance, X-Epoch' }),
  };
  const json = (res: ServerResponse, status: number, data: unknown): void => {
    res.writeHead(status, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(data));
  };
  const docx = (res: ServerResponse, file: Uint8Array, headers: Record<string, string> = {}) =>
    res.writeHead(200, { ...cors, 'Content-Type': DOCX_TYPE, 'Cache-Control': 'no-store', ...headers }).end(file);

  const serveFile = (res: ServerResponse, path: string) => {
    if (!staticDir) return json(res, 404, { error: 'not found' });
    let file = resolve(join(staticDir, decodeURIComponent(path)));
    if (file !== staticDir && !file.startsWith(staticDir + sep)) return json(res, 403, { error: 'forbidden' });
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(staticDir, 'index.html');
    if (!existsSync(file)) return json(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  };

  /** A document starts being shared: its file is what everybody starts from. */
  const share = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    if (!storage.open) return json(res, 403, { error: 'rooms' });
    if (options.token && url.searchParams.get('token') !== options.token) return json(res, 401, { error: 'token' });
    const posted = decode<{ name?: string; docx?: string }>(await body(req));
    const base = fromBase64(String(posted.docx ?? ''));
    importDocx(base);
    const room = new Room(randomBytes(12).toString('base64url'), { name: String(posted.name ?? '').slice(0, 200), epoch: 1, base, log: [] }, ctx);
    await storage.keep(room.id, room.kept(), false);
    rooms.set(room.id, room);
    json(res, 200, { room: room.id });
  };

  /** Someone comes in, and listens to the room from then on. */
  const listen = async (req: IncomingMessage, res: ServerResponse, url: URL, room: Room) => {
    const query = url.searchParams;
    // An editor that speaks another version is told so, and which one this server speaks: one that says none speaks the first.
    if (Number(query.get('v') || 1) !== PROTOCOL) return json(res, 426, { error: 'version', protocol: PROTOCOL });
    const id = (query.get('client') ?? '').slice(0, 64);
    if (!id) return json(res, 400, { error: 'client' });
    // An id somebody is in the room with: only whoever has its key comes back with it.
    if (room.clients.has(id) && !room.signed(id, query.get('key'))) return json(res, 409, { error: 'client' });
    const ticket = query.get('ticket') ?? '';
    const pass = await room.admit(ticket);
    if (!pass) return json(res, 403, { error: 'access' });
    // Gone while the room was being read or the storage was being asked about them: their
    // leaving was not heard, so they are not let in, or they would be in the room for good.
    if (req.socket.destroyed) return;
    const stream: Listener = { write: (text) => res.write(text), end: () => res.end() };
    const hello = room.join(id, query.get('key'), ticket, pass, query.get('name') ?? '', stream, { epoch: Number(query.get('epoch')), from: Number(query.get('from')) });
    // Taken by somebody else while the storage was being asked about them.
    if (!hello) return json(res, 409, { error: 'client' });
    const client = room.clients.get(id)!;
    res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(eventText('hello', hello));
    const beat = setInterval(() => res.write(': still here\n\n'), 20000);
    res.on('close', () => {
      clearInterval(beat);
      room.leave(client, stream);
    });
  };

  /** What someone in the room sends: changes, or where they are. */
  const receive = async (req: IncomingMessage, res: ServerResponse, room: Room, action: 'ops' | 'presence') => {
    const posted = decode<Partial<OpsPost & PresencePost>>(await body(req, action === 'presence' ? MAX_PRESENCE : MAX_BODY));
    const client = room.signed(String(posted.client), posted.key);
    if (!client) return json(res, 409, { error: 'client' });
    if (!room.allows(client)) return json(res, 429, { error: 'too many' });
    if (action === 'presence') {
      room.presence(client, posted.sel, posted.name);
      return json(res, 200, {});
    }
    const taken = room.take(client, posted);
    json(res, taken === 'ok' ? 200 : taken === 'read-only' ? 403 : 409, taken === 'ok' ? {} : { error: taken });
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
    // The system took someone's access away, or changed it: asked again at once, in the room it says or in all.
    if (req.method === 'POST' && options.recheckKey && ((what === 'rooms' && id && action === 'recheck') || (what === 'recheck' && !id))) {
      if (!bearer(req, options.recheckKey)) return void json(res, 401, { error: 'key' });
      await recheck(what === 'rooms' ? id : undefined);
      return void json(res, 200, {});
    }
    if (req.method === 'GET' && what === 'ping') return void json(res, 200, { collab: PROTOCOL, token: !!options.token, ...(options.instance && { instance: options.instance }) });
    if (req.method === 'POST' && what === 'rooms' && !id) return share(req, res, url);

    const room = what === 'rooms' && id ? await find(id) : undefined;
    if (!room) return void json(res, 404, { error: 'room' });
    /** Where coming in takes more than the name of the room, its files are for those who came in. */
    const inside = () => !storage.admit || !!room.signed(url.searchParams.get('client') ?? '', url.searchParams.get('key'));

    if (req.method === 'GET' && (action === 'docx' || action === 'base')) {
      if (!inside()) return void json(res, 403, { error: 'access' });
      // The document as it is now, for whoever wants the file without an editor; or the file the changes are made to.
      if (action === 'docx') docx(res, room.current());
      else docx(res, room.base, { 'X-Epoch': String(room.epoch), 'Access-Control-Expose-Headers': options.instance ? 'X-Rebodocs-Instance, X-Epoch' : 'X-Epoch' });
      return;
    }
    if (req.method === 'GET' && action === 'events') return listen(req, res, url, room);
    if (req.method === 'POST' && (action === 'ops' || action === 'presence')) return receive(req, res, room, action);
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
    recheck,
    rooms: () => [...rooms.values()].map((room) => ({ id: room.id, people: [...room.clients.values()].map((client) => client.name) })),
    close() {
      closed = true;
      clearInterval(rechecker);
      for (const room of rooms.values()) room.close();
      server?.close();
      server?.closeAllConnections();
    },
  };
}

/** Whether a request shows `key` as `Authorization: Bearer …`, compared in a time that does not say how much of it was right. */
function bearer(req: IncomingMessage, key: string): boolean {
  const given = Buffer.from(/^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1] ?? '');
  const wanted = Buffer.from(key);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

/** The rooms kept in a folder, by name: for whoever runs the server to see what it holds. */
export function storedRooms(dataDir: string): string[] {
  return existsSync(dataDir) ? readdirSync(dataDir).filter((id) => ROOM_ID.test(id) && existsSync(join(dataDir, id, 'meta.json'))) : [];
}
