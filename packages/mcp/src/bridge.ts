// The way from the server to the editors open in browsers. The page of an
// editor connects to a small HTTP server here: it listens for what to do
// (server-sent events) and posts back what came of it. Several editors can be
// connected at once, each with a number of its own.
//
// Only one process can listen on the port. When several servers run on a
// machine, one for each assistant, the first to start has the editors and the
// others ask it: they reach the same editors through it, and one of them
// takes its place when it goes away. Node only.

import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';

export interface EditorInfo {
  /** The number the editor goes by, from 1, for as long as it is connected. */
  id: number;
  /** What the editor calls its document: the name of its file. */
  name: string;
}

export interface Answer {
  ok: boolean;
  text: string;
  data?: string;
}

export interface Bridge {
  /** The editors that are listening. */
  editors(): Promise<EditorInfo[]>;
  /** Why there is no way to an editor at all, when there is none. */
  readonly problem: string | undefined;
  readonly port: number;
  /** Asks an editor to run `tool`, and gives what it answered. Rejects when it is not there, or takes too long. */
  call(editor: number, tool: string, args: Record<string, unknown>): Promise<Answer>;
  close(): void;
}

export interface BridgeOptions {
  port: number;
  /** The address to listen on: this machine alone (127.0.0.1) when left out. */
  host?: string;
  /** Origins a page may connect from, besides this machine's own (localhost, 127.0.0.1). */
  origins?: string[];
  /** A word a page from anywhere else must give to be let in: what to ask of the ones on other machines. */
  token?: string;
  /** How long to wait for an editor to answer, in milliseconds. */
  timeout?: number;
}

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const LOCAL_ADDRESS = /^(::ffff:)?127\.|^::1$/;
const MAX_BODY = 64 * 1024 * 1024;

interface Listener {
  id: number;
  name: string;
  stream: ServerResponse;
}

export function createBridge(options: BridgeOptions): Bridge {
  const timeout = options.timeout ?? 30000;
  const host = options.host ?? '127.0.0.1';
  const leader = `http://127.0.0.1:${options.port}`;
  const listeners = new Map<number, Listener>();
  const waiting = new Map<number, { editor: number; done: (answer: Answer) => void; fail: (error: Error) => void; timer: NodeJS.Timeout }>();
  let problem: string | undefined;
  let nextEditor = 0;
  let seq = 0;
  /** True while another server on this machine has the port: the editors are asked for through it. */
  let following = false;
  let closed = false;

  const drop = (editor: number | undefined, why: string) => {
    for (const [id, wait] of waiting) {
      if (editor !== undefined && wait.editor !== editor) continue;
      clearTimeout(wait.timer);
      wait.fail(new Error(why));
      waiting.delete(id);
    }
  };

  // --- Asking an editor that is connected here ------------------------------------

  const ask = (editor: number, tool: string, args: Record<string, unknown>): Promise<Answer> =>
    new Promise((done, fail) => {
      const listener = listeners.get(editor);
      if (!listener) {
        fail(new Error(`Editor ${editor} is not connected.`));
        return;
      }
      const id = ++seq;
      const timer = setTimeout(() => {
        waiting.delete(id);
        fail(new Error('The editor did not answer in time.'));
      }, timeout);
      waiting.set(id, { editor, done, fail, timer });
      listener.stream.write(`data: ${JSON.stringify({ id, tool, args })}\n\n`);
    });

  const body = (req: IncomingMessage): Promise<unknown> =>
    new Promise((done, fail) => {
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY) req.destroy();
        else chunks.push(chunk);
      });
      req.on('error', fail);
      req.on('end', () => {
        try {
          done(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) {
          fail(error as Error);
        }
      });
    });

  // --- The server editors and other servers talk to -------------------------------

  const onRequest = (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', leader);
    const origin = req.headers.origin;

    // Another server of this machine, not a page: a browser always says where a page is from, and these do not.
    if (!origin && LOCAL_ADDRESS.test(req.socket.remoteAddress ?? '') && (url.pathname === '/peers' || url.pathname === '/call')) {
      if (req.method === 'GET' && url.pathname === '/peers') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify([...listeners.values()].map(({ id, name }) => ({ id, name }))));
        return;
      }
      if (req.method === 'POST' && url.pathname === '/call') {
        void body(req)
          .then((asked) => {
            const { editor, tool, args } = asked as { editor: number; tool: string; args: Record<string, unknown> };
            return ask(editor, tool, args ?? {});
          })
          .then(
            (answer) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(answer)),
            (error: Error) => res.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: error.message })),
          );
        return;
      }
    }

    // A page: from this machine, from an origin that was named, or with the word that lets it in.
    const trusted = !!origin && (LOCAL_ORIGIN.test(origin) || !!options.origins?.includes(origin) || (!!options.token && url.searchParams.get('token') === options.token));
    if (!trusted) {
      res.writeHead(403).end();
      return;
    }
    const cors = { 'Access-Control-Allow-Origin': origin!, Vary: 'Origin' };
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Max-Age': '600' }).end();
      return;
    }
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      const listener: Listener = { id: ++nextEditor, name: (url.searchParams.get('name') ?? '').slice(0, 200), stream: res };
      listeners.set(listener.id, listener);
      res.write(`event: hello\ndata: ${JSON.stringify({ editor: listener.id })}\n\n`);
      const beat = setInterval(() => res.write(': still here\n\n'), 20000);
      res.on('close', () => {
        clearInterval(beat);
        listeners.delete(listener.id);
        drop(listener.id, 'The editor was closed, or disconnected.');
      });
      return;
    }
    // The editor opened another file: it is known by the name of that one from now on.
    if (req.method === 'POST' && url.pathname === '/name') {
      void body(req).then(
        (posted) => {
          const { editor, name } = posted as { editor?: number; name?: string };
          const listener = listeners.get(editor ?? -1);
          if (listener && typeof name === 'string') listener.name = name.slice(0, 200);
          res.writeHead(listener ? 204 : 404, cors).end();
        },
        () => res.writeHead(400, cors).end(),
      );
      return;
    }
    if (req.method === 'POST' && url.pathname === '/result') {
      void body(req).then(
        (posted) => {
          const answer = posted as { id?: number; ok?: boolean; text?: string; data?: string; name?: string };
          const wait = waiting.get(answer.id ?? -1);
          if (!wait) {
            res.writeHead(400, cors).end();
            return;
          }
          clearTimeout(wait.timer);
          waiting.delete(answer.id!);
          // The name of its document may have changed since it connected.
          const listener = listeners.get(wait.editor);
          if (listener && typeof answer.name === 'string') listener.name = answer.name.slice(0, 200);
          wait.done({ ok: !!answer.ok, text: String(answer.text ?? ''), data: typeof answer.data === 'string' ? answer.data : undefined });
          res.writeHead(204, cors).end();
        },
        () => res.writeHead(400, cors).end(),
      );
      return;
    }
    res.writeHead(404, cors).end();
  };

  let server: Server | undefined;
  /** Starts listening; with the port taken, the editors are those of whoever has it. */
  const listen = (): Promise<void> =>
    new Promise((done) => {
      const made = createServer(onRequest);
      made.once('error', (error: NodeJS.ErrnoException) => {
        following = error.code === 'EADDRINUSE';
        problem = following ? undefined : error.message;
        done();
      });
      made.listen(options.port, host, () => {
        server = made;
        following = false;
        problem = undefined;
        done();
      });
    });
  let ready = listen();

  /** Asks the server that has the port; when it is gone, takes its place, and the editors come back by themselves. */
  const fromLeader = async <T>(path: string, init?: RequestInit): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(`${leader}${path}`, init);
    } catch {
      if (!closed) {
        ready = listen();
        await ready;
      }
      throw new Error('The server that had the editors is gone. They connect again by themselves in a few seconds: try again then.');
    }
    const answer = (await response.json()) as T & { error?: string };
    if (!response.ok) throw new Error(answer.error ?? `The server that has the editors answered ${response.status}.`);
    return answer;
  };

  return {
    get problem() {
      return problem;
    },
    port: options.port,
    async editors() {
      await ready;
      if (following) return fromLeader<EditorInfo[]>('/peers').catch(() => []);
      return [...listeners.values()].map(({ id, name }) => ({ id, name }));
    },
    async call(editor, tool, args) {
      await ready;
      if (following) return fromLeader<Answer>('/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ editor, tool, args }) });
      return ask(editor, tool, args);
    },
    close() {
      closed = true;
      drop(undefined, 'The server is closing.');
      for (const listener of listeners.values()) listener.stream.end();
      server?.close();
      server?.closeAllConnections();
    },
  };
}
