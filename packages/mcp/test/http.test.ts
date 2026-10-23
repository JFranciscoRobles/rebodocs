import type { AddressInfo } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';
import { version } from '../package.json';
import { createBridge } from '../src/bridge';
import { serveHttp } from '../src/http';
import { createDocServer } from '../src/server';

type Listed = { name: string; title?: string; annotations: Record<string, unknown> };

const closing: (() => void)[] = [];
afterAll(() => closing.forEach((close) => close()));

/** The server over HTTP on a port of its own, and a way to post to it. */
async function serve(options: Partial<Parameters<typeof serveHttp>[0]> = {}) {
  const transport = serveHttp({ port: 0, open: () => createDocServer(), ...options });
  closing.push(() => transport.close());
  await new Promise((done) => transport.server.once('listening', done));
  const url = `http://127.0.0.1:${(transport.server.address() as AddressInfo).port}/mcp`;
  const post = (message: object, headers: Record<string, string> = {}) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(message) });
  return { transport, url, post };
}

describe('what the server says of its tools', () => {
  it('names each one, and says which only read and which can lose work', async () => {
    const server = createDocServer();
    const init = (await server.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } })) as {
      result: { protocolVersion: string; serverInfo: { version: string } };
    };
    expect(init.result.protocolVersion).toBe('2025-11-25');
    expect(init.result.serverInfo.version).toBe(version);
    const { tools } = ((await server.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })) as { result: { tools: Listed[] } }).result;
    const of = (name: string) => tools.find((tool) => tool.name === name)!;
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.annotations.openWorldHint, tool.name).toBe(false);
    }
    expect(of('list_documents').annotations.readOnlyHint).toBe(true);
    expect(of('read_pages').annotations.readOnlyHint).toBe(true);
    expect(of('save_document').annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(of('close_document').annotations.destructiveHint).toBe(true);
    expect(of('delete_paragraphs').annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: false });
    expect(of('set_style').annotations.idempotentHint).toBe(true);
    expect(of('edit_document').title).toBe('Several edits at once');
  });

  it('stops waiting for an editor when the client cancels, and does not answer', async () => {
    const port = 7500 + Math.floor(Math.random() * 2000);
    const bridge = createBridge({ port, timeout: 5000 });
    closing.push(() => bridge.close());
    // An editor that listens and never answers.
    const events = await fetch(`http://127.0.0.1:${port}/events?name=lento.docx`, { headers: { Origin: 'http://localhost:5173' } });
    const reader = events.body!.getReader();
    closing.push(() => void reader.cancel());
    for (let i = 0; i < 100 && !(await bridge.editors()).length; i++) await new Promise((done) => setTimeout(done, 10));
    const server = createDocServer({ bridge });
    const started = Date.now();
    const asked = server.handle({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'get_overview', arguments: { document: 'editor' } } });
    await new Promise((done) => setTimeout(done, 50));
    expect(await server.handle({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 7, reason: 'The person stopped it.' } })).toBeUndefined();
    expect(await asked).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('the server over HTTP', () => {
  it('gives each client a session, and answers each message', async () => {
    const { post, url } = await serve();
    const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } });
    expect(init.status).toBe(200);
    const session = init.headers.get('mcp-session-id')!;
    expect(session).toMatch(/^[0-9a-f-]{36}$/);
    expect((await init.json()).result.serverInfo.name).toBe('rebodocs');
    const headers = { 'Mcp-Session-Id': session, 'Mcp-Protocol-Version': '2025-11-25' };
    expect((await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, headers)).status).toBe(202);
    const listed = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, headers)).json();
    expect(listed.result.tools.map((tool: Listed) => tool.name)).toContain('edit_document');
    const called = await (await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_documents', arguments: {} } }, headers)).json();
    expect(called.result.content[0].text).toContain('No files are open');

    // Without a session, or with one that was closed, the client is told to start again.
    expect((await post({ jsonrpc: '2.0', id: 4, method: 'tools/list' })).status).toBe(400);
    expect((await fetch(url, { method: 'DELETE', headers })).status).toBe(204);
    expect((await post({ jsonrpc: '2.0', id: 5, method: 'tools/list' }, headers)).status).toBe(404);
    expect((await fetch(url, { method: 'GET' })).status).toBe(405);
    expect((await fetch(url, { method: 'POST', body: 'not json' })).status).toBe(400);
  });

  it('keeps the files of one session from the others', async () => {
    const { post } = await serve();
    const start = async () => (await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })).headers.get('mcp-session-id')!;
    const [a, b] = [await start(), await start()];
    const opened = await (
      await post({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'new_document', arguments: { path: '/tmp/rebodocs-sesion.docx' } } }, { 'Mcp-Session-Id': a })
    ).json();
    expect(opened.result.isError).toBeFalsy();
    const other = await (await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'list_documents', arguments: {} } }, { 'Mcp-Session-Id': b })).json();
    expect(other.result.content[0].text).toContain('No files are open');
  });

  it('lets in only the pages and the clients it was told to', async () => {
    const { post } = await serve({ token: 'una-palabra-larga', origins: ['https://crm.ejemplo.com'] });
    const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} };
    expect((await post(init)).status).toBe(401);
    expect((await post(init, { Authorization: 'Bearer otra-palabra-no' })).status).toBe(401);
    expect((await post(init, { Authorization: 'Bearer una-palabra-larga' })).status).toBe(200);
    expect((await post(init, { Authorization: 'Bearer una-palabra-larga', Origin: 'https://ajeno.ejemplo.com' })).status).toBe(403);
    const allowed = await post(init, { Authorization: 'Bearer una-palabra-larga', Origin: 'https://crm.ejemplo.com' });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://crm.ejemplo.com');
  });

  it('holds only so many sessions', async () => {
    const { post } = await serve({ maxSessions: 1 });
    const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} };
    expect((await post(init)).status).toBe(200);
    expect((await post(init)).status).toBe(503);
  });
});
