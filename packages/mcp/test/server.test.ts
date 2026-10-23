import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { type Paragraph, createDoc, exportDocx, importDocx, plainText, setParagraphStyle } from '@rebodocs/core/internal';
import { createBridge } from '../src/bridge';
import { EXPORT_TOOL } from '../src/browser';
import { createDocServer } from '../src/server';
import { ToolError, runTool } from '../src/tools';

const dir = mkdtempSync(join(tmpdir(), 'rebodocs-mcp-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });
const sample = () => setParagraphStyle(createDoc([p('Objeto'), p('El cliente {{cliente}} contrata el servicio.')]), 0, 0, 'Heading1');
const file = (name: string) => {
  const path = join(dir, name);
  writeFileSync(path, exportDocx(sample()));
  return path;
};

type Answer = {
  result?: { content?: { text: string }[]; isError?: boolean; tools?: { name: string; inputSchema: { properties: Record<string, unknown> } }[]; protocolVersion?: string };
  error?: { code: number };
};
const client = (server: ReturnType<typeof createDocServer>) => {
  let id = 0;
  const ask = async (method: string, params: object = {}) => (await server.handle({ jsonrpc: '2.0', id: ++id, method, params: params as Record<string, unknown> })) as Answer;
  const call = async (name: string, args: object = {}) => {
    const { result } = await ask('tools/call', { name, arguments: args });
    return { text: result!.content![0].text, failed: !!result!.isError };
  };
  return { ask, call };
};

describe('the server for an assistant', () => {
  it('speaks the protocol', async () => {
    const server = createDocServer();
    const { ask } = client(server);
    expect((await ask('initialize', { protocolVersion: '2025-03-26' })).result!.protocolVersion).toBe('2025-03-26');
    expect((await ask('initialize', { protocolVersion: '1999-01-01' })).result!.protocolVersion).toBe('2025-11-25');
    expect(await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
    expect((await ask('ping')).result).toEqual({});
    expect((await ask('resources/list')).error!.code).toBe(-32601);
    const { tools } = (await ask('tools/list')).result!;
    expect(tools!.map((tool) => tool.name)).toEqual(expect.arrayContaining(['open_document', 'save_document', 'read_document', 'replace_text', 'add_note', 'fill_variables']));
    // Every tool on a document can be told which document.
    expect(tools!.find((tool) => tool.name === 'replace_text')!.inputSchema.properties).toHaveProperty('document');
  });

  it('opens a file, changes it in memory and saves a copy', async () => {
    const path = file('contrato.docx');
    const before = readFileSync(path);
    const { call } = client(createDocServer());
    expect((await call('read_document')).text).toContain('No document is open');
    const opened = await call('open_document', { path });
    expect(opened.text).toContain('2 paragraphs');
    expect(opened.text).toContain('Template variables: cliente');
    expect((await call('fill_variables', { values: { cliente: 'Ana Pérez' } })).text).toBe('Filled 1 of 1 variables.');
    expect((await call('add_note', { find: 'servicio', note: '¿Cuál?' })).failed).toBe(false);
    expect((await call('list_documents')).text).toContain('contrato.docx (current) — changes not saved');
    // Nothing is written until it is asked for, and not over what is there.
    expect(readFileSync(path).equals(before)).toBe(true);
    const refused = await call('save_document');
    expect(refused).toMatchObject({ failed: true });
    expect(refused.text).toContain('already exists');
    const copy = join(dir, 'lleno.docx');
    expect((await call('save_document', { path: copy })).text).toBe(`Saved ${copy}.`);
    expect(readFileSync(path).equals(before)).toBe(true);
    const back = importDocx(new Uint8Array(readFileSync(copy)));
    expect(plainText(back.paragraphs[1].runs).replace(/⁠/g, '')).toBe('El cliente Ana Pérez contrata el servicio.');
    expect(back.notes).toHaveLength(1);
    expect((await call('save_document', { path: join(dir, 'lleno.md') })).failed).toBe(false);
    expect(readFileSync(join(dir, 'lleno.md'), 'utf8')).toContain('# Objeto');
    expect((await call('save_document', { path: join(dir, 'lleno.txt') })).text).toContain('must end in .docx, .pdf or .md');
    // Written over only when told to.
    expect((await call('save_document', { overwrite: true })).failed).toBe(false);
    expect((await call('list_documents')).text).not.toContain('changes not saved');
    expect((await call('close_document', { path })).text).toBe('Closed.');
  });

  it('writes a new document, and keeps to its folders', async () => {
    const { call } = client(createDocServer({ roots: [dir] }));
    const path = join(dir, 'nuevo.docx');
    expect((await call('new_document', { path })).failed).toBe(false);
    expect(
      (
        await call('insert_paragraphs', {
          after_paragraph: 0,
          paragraphs: [
            { text: 'Informe', style: 'Title' },
            { text: 'Primer punto', list: 'number' },
          ],
        })
      ).failed,
    ).toBe(false);
    expect(existsSync(path)).toBe(false);
    expect((await call('save_document')).text).toBe(`Saved ${path}.`);
    expect(plainText(importDocx(new Uint8Array(readFileSync(path))).paragraphs[0].runs)).toBe('Informe');
    const outside = await call('open_document', { path: join(tmpdir(), 'otro.docx') });
    expect(outside).toMatchObject({ failed: true });
    expect(outside.text).toContain('outside the folders this server may use');
    expect((await call('open_document', { path: join(dir, 'no-existe.docx') })).text).toContain('There is no file');
    expect((await call('nope')).text).toContain('There is no tool "nope"');
  });

  /** What the page of an editor does, by hand: listens, runs each tool on its document and posts the answer. */
  const page = async (url: string, name: string, headers: Record<string, string> = { Origin: 'http://localhost:5173' }, token = '') => {
    const state = { doc: sample(), status: 0, close: async () => {} };
    const auth = token ? `&token=${token}` : '';
    const events = await fetch(`${url}/events?name=${encodeURIComponent(name)}${auth}`, { headers });
    state.status = events.status;
    if (!events.ok) return state;
    const reader = events.body!.getReader();
    state.close = () => reader.cancel();
    const decoder = new TextDecoder();
    let buffer = '';
    void (async () => {
      for (;;) {
        const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        for (let end = buffer.indexOf('\n\n'); end >= 0; end = buffer.indexOf('\n\n')) {
          const data = /^data: (.*)$/m.exec(buffer.slice(0, end))?.[1];
          const named = /^event: /m.test(buffer.slice(0, end));
          buffer = buffer.slice(end + 2);
          if (!data || named) continue;
          const asked = JSON.parse(data) as { id: number; tool: string; args: Record<string, unknown> };
          let answer: object;
          if (asked.tool === EXPORT_TOOL) answer = { ok: true, text: '', data: Buffer.from(exportDocx(state.doc)).toString('base64') };
          else {
            try {
              const result = runTool(state.doc, asked.tool, asked.args, {});
              if (result.doc) state.doc = result.doc;
              answer = { ok: true, text: result.text };
            } catch (error) {
              answer = { ok: false, text: error instanceof ToolError ? error.message : 'broken' };
            }
          }
          await fetch(`${url}/result?${auth.slice(1)}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain' }, body: JSON.stringify({ id: asked.id, name, ...answer }) });
        }
      }
    })();
    return state;
  };
  const until = async (test: () => Promise<boolean>) => {
    for (let i = 0; i < 100 && !(await test()); i++) await new Promise((done) => setTimeout(done, 10));
  };
  const freePort = () => 7500 + Math.floor(Math.random() * 2000);

  it('reaches the document of an editor through the bridge', async () => {
    const port = freePort();
    const bridge = createBridge({ port, timeout: 2000 });
    const { call } = client(createDocServer({ bridge, cwd: dir }));
    const url = `http://127.0.0.1:${port}`;
    try {
      expect((await call('read_document', { document: 'editor' })).text).toContain('No editor is connected');
      // A page from somewhere else is not let in, and neither is what does not say where it is from.
      expect((await page(url, 'x', { Origin: 'https://example.com' })).status).toBe(403);
      expect((await page(url, 'x', {})).status).toBe(403);

      const editor = await page(url, 'contrato.docx');
      await until(async () => (await bridge.editors()).length === 1);
      // With no file open, the editor is the document.
      expect((await call('read_document')).text).toBe('[1] (Heading1) Objeto\n[2] El cliente {{cliente}} contrata el servicio.');
      expect((await call('replace_text', { find: 'el servicio', replace: 'la obra', document: 'editor' })).failed).toBe(false);
      expect(plainText(editor.doc.paragraphs[1].runs)).toBe('El cliente {{cliente}} contrata la obra.');
      const wrong = await call('replace_text', { find: 'no está', replace: 'x' });
      expect(wrong).toMatchObject({ failed: true });
      expect(wrong.text).toContain('is not in the document');
      expect((await call('list_documents')).text).toContain('An editor is connected: its document is "editor" — contrato.docx.');
      // It opens another file: the server knows it by that name at once, before anything is asked of it.
      expect(
        (await fetch(`${url}/name`, { method: 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'text/plain' }, body: JSON.stringify({ editor: 1, name: 'otro.docx' }) })).status,
      ).toBe(204);
      expect((await call('list_documents')).text).toContain('"editor" — otro.docx');
      expect((await fetch(`${url}/name`, { method: 'POST', headers: { Origin: 'https://example.com' }, body: '{}' })).status).toBe(403);
      // Its header, through the same way.
      expect((await call('insert_paragraphs', { area: 'header', after_paragraph: 0, paragraphs: [{ text: 'Borrador' }] })).failed).toBe(false);
      expect(plainText(editor.doc.header!.paragraphs[0].runs)).toBe('Borrador');
      // A picture is read by the server and put in by the page.
      const png = new Uint8Array(33);
      png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 200, 0, 0, 0, 100, 8, 6, 0, 0, 0]);
      writeFileSync(join(dir, 'logo.png'), png);
      expect((await call('insert_image', { after_paragraph: 2, path: 'logo.png' })).text).toBe('Picture inserted as paragraph 3, 5.3 × 2.6 cm.');
      expect(editor.doc.paragraphs[2].runs.some((run) => run.props.object)).toBe(true);
      expect((await call('insert_image', { after_paragraph: 2, path: 'no.png' })).text).toContain('There is no file');
      // What is open in the editor, saved to a file by the server.
      expect((await call('save_document', { document: 'editor', path: 'del-editor.docx' })).text).toBe(`Saved ${join(dir, 'del-editor.docx')}.`);
      expect(plainText(importDocx(new Uint8Array(readFileSync(join(dir, 'del-editor.docx')))).paragraphs[1].runs)).toContain('la obra');

      // A second editor: each goes by its number, and which one has to be said.
      const other = await page(url, 'recibo.docx');
      await until(async () => (await bridge.editors()).length === 2);
      expect((await call('list_documents')).text).toContain('2 editors are connected:\n"editor:1" — contrato.docx\n"editor:2" — recibo.docx');
      expect((await call('read_document', { document: 'editor' })).text).toContain('2 editors are connected: say which');
      expect((await call('replace_text', { document: 'editor:2', find: 'Objeto', replace: 'Recibo' })).failed).toBe(false);
      expect([plainText(other.doc.paragraphs[0].runs), plainText(editor.doc.paragraphs[0].runs)]).toEqual(['Recibo', 'Objeto']);
      expect((await call('read_document', { document: 'editor:9' })).text).toContain('There is no editor 9');

      await editor.close();
      await until(async () => (await bridge.editors()).length === 1);
      // The one that is left is "the editor" again.
      expect((await call('read_document', { document: 'editor' })).text).toMatch(/^\[1\] \(Heading1\) Recibo/);
      await other.close();
      await until(async () => (await bridge.editors()).length === 0);
      expect((await call('read_document', { document: 'editor' })).text).toContain('No editor is connected');
    } finally {
      bridge.close();
    }
  });

  it('shares the editors among the servers of a machine', async () => {
    const port = freePort();
    const url = `http://127.0.0.1:${port}`;
    const first = createBridge({ port, timeout: 2000 });
    await first.editors();
    // The second finds the port taken, and asks the first.
    const second = createBridge({ port, timeout: 2000 });
    const one = client(createDocServer({ bridge: first }));
    const two = client(createDocServer({ bridge: second }));
    try {
      let editor = await page(url, 'contrato.docx');
      await until(async () => (await second.editors()).length === 1);
      expect(second.problem).toBeUndefined();
      expect((await two.call('list_documents')).text).toContain('"editor" — contrato.docx');
      expect((await two.call('replace_text', { find: 'el servicio', replace: 'la obra' })).failed).toBe(false);
      expect((await one.call('read_document', { from: 2 })).text).toBe('[2] El cliente {{cliente}} contrata la obra.');
      expect((await two.call('replace_text', { find: 'no está', replace: 'x' })).text).toContain('is not in the document');
      // A page cannot pass for a server: what it sends says where it is from.
      expect((await fetch(`${url}/peers`, { headers: { Origin: 'http://localhost:5173' } })).status).toBe(404);
      expect((await fetch(`${url}/call`, { method: 'POST', headers: { Origin: 'https://example.com' }, body: '{}' })).status).toBe(403);

      // The first goes away: the second takes the port, and the editor comes back to it.
      first.close();
      await editor.close();
      expect((await two.call('read_document', { document: 'editor' })).text).toMatch(/is gone|No editor is connected/);
      editor = await page(url, 'contrato.docx');
      expect(editor.status).toBe(200);
      await until(async () => (await second.editors()).length === 1);
      expect((await two.call('read_document', { from: 1, to: 1 })).text).toBe('[1] (Heading1) Objeto');
      await editor.close();
    } finally {
      first.close();
      second.close();
    }
  });

  it('lets in a page from another machine only with its word', async () => {
    const port = freePort();
    const url = `http://127.0.0.1:${port}`;
    const bridge = createBridge({ port, timeout: 2000, token: 'una-palabra-larga', origins: ['https://editor.ejemplo.com'] });
    await bridge.editors();
    try {
      const far = { Origin: 'http://192.168.1.20:5173' };
      expect((await page(url, 'x', far)).status).toBe(403);
      expect((await page(url, 'x', far, 'otra-palabra')).status).toBe(403);
      const named = await page(url, 'x', { Origin: 'https://editor.ejemplo.com' });
      expect(named.status).toBe(200);
      const editor = await page(url, 'lejos.docx', far, 'una-palabra-larga');
      expect(editor.status).toBe(200);
      await until(async () => (await bridge.editors()).length === 2);
      const { call } = client(createDocServer({ bridge }));
      expect((await call('replace_text', { document: 'editor:2', find: 'Objeto', replace: 'Lejos' })).failed).toBe(false);
      expect(plainText(editor.doc.paragraphs[0].runs)).toBe('Lejos');
      await named.close();
      await editor.close();
    } finally {
      bridge.close();
    }
  });
});
