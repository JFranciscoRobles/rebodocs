// Runs the server for an assistant to connect to, over standard input and
// output: the way a client such as Claude Desktop starts one. With --http, it
// listens for clients over HTTP instead, each with a session of its own.
//
//   vite-node packages/mcp/src/main.ts [--port 7411] [--no-editor] [--root carpeta] [--fonts carpeta]
//                                      [--origin https://…] [--host 0.0.0.0 --token palabra]
//                                      [--timeout 30] [--http 7412]
//
// Standard output carries the protocol and nothing else; what there is to say
// to a person goes to standard error.

import { createInterface } from 'node:readline';
import { type Bridge, createBridge } from './bridge';
import { DEFAULT_PORT } from './browser';
import { serveHttp } from './http';
import { createDocServer } from './server';

const args = process.argv.slice(2);
const values = (name: string): string[] => {
  const out: string[] = [];
  for (let i = args.indexOf(name); i >= 0; i = args.indexOf(name)) out.push(...args.splice(i, 2).slice(1));
  return out;
};
const has = (name: string) => {
  const at = args.indexOf(name);
  if (at >= 0) args.splice(at, 1);
  return at >= 0;
};

const port = Number(values('--port')[0] ?? process.env.REBODOCS_MCP_PORT ?? DEFAULT_PORT);
const noEditor = has('--no-editor');
const roots = values('--root');
const fontDirs = values('--fonts');
const origins = values('--origin');
const [editorUrl] = values('--editor-url');
const [host] = values('--host');
const token = values('--token')[0] ?? process.env.REBODOCS_MCP_TOKEN;
const [waitFor] = values('--timeout');
const timeout = waitFor === undefined ? undefined : Number(waitFor) * 1000;
const [httpPort] = values('--http');
const http = httpPort === undefined ? undefined : Number(httpPort);
const isPort = (n: number) => Number.isInteger(n) && n >= 1 && n <= 65535;
if (args.length || !isPort(port) || (http !== undefined && (!isPort(http) || http === port)) || (timeout !== undefined && !(timeout >= 1000 && timeout <= 600_000))) {
  console.error(
    'Uso: main.ts [--port 7411] [--no-editor] [--root carpeta]… [--fonts carpeta]… [--origin https://mi-editor]… [--host 0.0.0.0 --token palabra] [--editor-url http://localhost:5173] [--timeout segundos] [--http 7412]',
  );
  process.exit(2);
}
// Open to other machines, anyone on the network could pass for an editor: they have to give a word.
if (host && !/^(127\.|localhost$|::1$)/.test(host) && !(token && token.length >= 12)) {
  console.error('Con --host hacia fuera de este equipo hace falta --token con una palabra de 12 caracteres o más, que el editor da al conectarse.');
  process.exit(2);
}

const bridge: Bridge | undefined = noEditor ? undefined : createBridge({ port, host, origins, token, timeout });
const editorSaid = bridge ? ` El editor se conecta en http://${host ?? '127.0.0.1'}:${port}.` : '';

if (http !== undefined) {
  const transport = serveHttp({ port: http, host, origins, token, open: () => createDocServer({ bridge, roots, fontDirs, editorUrl }) });
  transport.server.on('error', (error) => {
    console.error(`rebodocs-mcp: no se pudo escuchar en ${http}: ${error.message}`);
    process.exit(1);
  });
  transport.server.on('listening', () => console.error(`rebodocs-mcp: listo en http://${host ?? '127.0.0.1'}:${http}/mcp.${editorSaid}`));
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => {
      transport.close();
      bridge?.close();
      process.exit(0);
    });
} else serveStdio();

/** A message a line, both ways, with the client that started this process. */
function serveStdio() {
  const server = createDocServer({ bridge, roots, fontDirs, editorUrl });
  console.error(`rebodocs-mcp: listo.${editorSaid}`);

  const send = (message: object) => process.stdout.write(`${JSON.stringify(message)}\n`);
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  lines.on('line', (line) => {
    if (!line.trim()) return;
    let message: Parameters<typeof server.handle>[0];
    try {
      message = JSON.parse(line);
    } catch {
      send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }
    void server
      .handle(message)
      .then((answer) => answer && send(answer))
      .catch((error: unknown) => send({ jsonrpc: '2.0', id: message.id ?? null, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } }));
  });
  // The client closing its end is how it says it is done.
  lines.on('close', () => {
    bridge?.close();
    process.exit(0);
  });
}
