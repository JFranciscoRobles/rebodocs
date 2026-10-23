// The server over HTTP, as the protocol's "Streamable HTTP" has it: one
// address where a client posts each message and gets the answer back, for a
// client that cannot start a process of its own, or that is on another
// machine. Each client has a session of its own, with its own open files;
// the editors in the browser are the same for all. Node only; `main.ts`
// starts it with --http.

import { randomUUID, timingSafeEqual } from 'node:crypto';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { DocServer } from './server';

export interface HttpOptions {
  port: number;
  /** The address to listen on: this machine alone (127.0.0.1) when left out. */
  host?: string;
  /** Where the client posts. `/mcp` when left out. */
  path?: string;
  /** Pages allowed to call from a browser, besides this machine's own. */
  origins?: string[];
  /** A word the client must give, as "Authorization: Bearer <word>": what to ask of one on another machine. */
  token?: string;
  /** A server for each new session. */
  open(): DocServer;
  /** How long a session no one uses lasts, in milliseconds. Half an hour when left out. */
  idle?: number;
  /** The most sessions at once. 32 when left out. */
  maxSessions?: number;
}

export interface HttpTransport {
  readonly server: Server;
  /** The sessions open now. */
  readonly sessions: number;
  close(): void;
}

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const MAX_BODY = 16 * 1024 * 1024;

interface Session {
  server: DocServer;
  used: number;
}

export function serveHttp(options: HttpOptions): HttpTransport {
  const path = options.path ?? '/mcp';
  const idle = options.idle ?? 30 * 60_000;
  const maxSessions = options.maxSessions ?? 32;
  const sessions = new Map<string, Session>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) if (now - session.used > idle) sessions.delete(id);
  }, 60_000);
  sweep.unref();

  const allowed = (given: string | undefined) => {
    if (!options.token) return true;
    const word = /^Bearer (.+)$/.exec(given ?? '')?.[1] ?? '';
    const a = Buffer.from(word);
    const b = Buffer.from(options.token);
    return a.length === b.length && timingSafeEqual(a, b);
  };

  const fail = (res: ServerResponse, status: number, code: number, message: string, headers: Record<string, string> = {}) =>
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers }).end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code, message } }));

  const body = (req: IncomingMessage): Promise<string> =>
    new Promise((done, failed) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY) {
          failed(new Error('too large'));
          req.destroy();
        } else chunks.push(chunk);
      });
      req.on('error', failed);
      req.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
    });

  const onRequest = async (req: IncomingMessage, res: ServerResponse) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== path) {
      res.writeHead(404).end();
      return;
    }
    // A page of another site must not reach a server on this machine through the browser of whoever is at it.
    const origin = req.headers.origin;
    if (origin && !LOCAL_ORIGIN.test(origin) && !options.origins?.includes(origin)) {
      fail(res, 403, -32000, 'This origin may not use the server.');
      return;
    }
    const cors: Record<string, string> = origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Expose-Headers': 'Mcp-Session-Id', Vary: 'Origin' } : {};
    if (req.method === 'OPTIONS') {
      res
        .writeHead(204, {
          ...cors,
          'Access-Control-Allow-Methods': 'POST, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version',
          'Access-Control-Max-Age': '600',
        })
        .end();
      return;
    }
    if (!allowed(req.headers.authorization)) {
      fail(res, 401, -32001, 'The server asks for its word: "Authorization: Bearer <word>".', { ...cors, 'WWW-Authenticate': 'Bearer' });
      return;
    }
    const id = req.headers['mcp-session-id'];
    const sessionId = typeof id === 'string' ? id : undefined;

    if (req.method === 'DELETE') {
      res.writeHead(sessionId && sessions.delete(sessionId) ? 204 : 404, cors).end();
      return;
    }
    // This server says nothing unless asked: there is no stream to listen to.
    if (req.method !== 'POST') {
      res.writeHead(405, { ...cors, Allow: 'POST, DELETE' }).end();
      return;
    }

    let message: { jsonrpc?: string; id?: number | string | null; method?: string; params?: Record<string, unknown> };
    try {
      message = JSON.parse(await body(req));
    } catch {
      fail(res, 400, -32700, 'Parse error', cors);
      return;
    }
    if (Array.isArray(message) || !message || typeof message !== 'object') {
      fail(res, 400, -32600, 'Send one message at a time.', cors);
      return;
    }

    let session: Session | undefined;
    let made: string | undefined;
    if (message.method === 'initialize') {
      if (sessions.size >= maxSessions) {
        fail(res, 503, -32000, 'Too many sessions are open: close one, or wait for one to go idle.', cors);
        return;
      }
      made = randomUUID();
      session = { server: options.open(), used: Date.now() };
    } else {
      session = sessionId ? sessions.get(sessionId) : undefined;
      if (!session) {
        // A session that is not known any more: the client starts another with "initialize".
        fail(res, sessionId ? 404 : 400, -32000, sessionId ? 'The session is not open: initialize again.' : 'Mcp-Session-Id is missing: initialize first.', cors);
        return;
      }
      session.used = Date.now();
    }

    let answer: object | undefined;
    try {
      answer = await session.server.handle(message);
    } catch (error) {
      answer = { jsonrpc: '2.0', id: message.id ?? null, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } };
    }
    if (made) sessions.set(made, session);
    const headers = { ...cors, ...(made ? { 'Mcp-Session-Id': made } : {}) };
    // A notification, or a request that was cancelled, has no answer.
    if (!answer) res.writeHead(202, headers).end();
    else res.writeHead(200, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify(answer));
  };

  const server = createServer((req, res) => {
    onRequest(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500).end();
    });
  });
  server.listen(options.port, options.host ?? '127.0.0.1');

  return {
    server,
    get sessions() {
      return sessions.size;
    },
    close() {
      clearInterval(sweep);
      sessions.clear();
      server.close();
      server.closeAllConnections();
    },
  };
}
