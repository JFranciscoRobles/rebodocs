import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDoc, exportDocx, importDocx, insertText, paragraphText } from '@rebodocs/core';
import { fontsFor } from '../../../packages/mcp/src/fonts';
import { createApi } from '../server/api';
import { type Bucket, DOCX, openBucket } from '../server/bucket';

// A bucket that keeps its files in memory and speaks as much of S3 as is asked
// of one here: listing, reading, writing, deleting and the rule of origins. It does not
// check signatures; what it has seen of each request is kept to look at.
const objects = new Map<string, { body: Buffer; type: string; at: Date }>();
const seen: { method: string; path: string; query: URLSearchParams; type?: string }[] = [];
let cors = '';

const s3 = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://s3');
  const parts: Buffer[] = [];
  for await (const part of request) parts.push(part as Buffer);
  const body = Buffer.concat(parts);
  const key = decodeURIComponent(url.pathname.replace(/^\/bucket\/?/, ''));
  seen.push({ method: request.method ?? '', path: url.pathname, query: url.searchParams, type: request.headers['content-type'] });
  const xml = (status: number, text: string) => response.writeHead(status, { 'content-type': 'application/xml' }).end(`<?xml version="1.0" encoding="UTF-8"?>${text}`);

  if (!key && request.method === 'PUT' && url.searchParams.has('cors')) {
    cors = body.toString('utf8');
    response.writeHead(200).end();
  } else if (!key && request.method === 'GET') {
    const prefix = url.searchParams.get('prefix') ?? '';
    const contents = [...objects].filter(([name]) => name.startsWith(prefix)).map(([name, file]) => `<Contents><Key>${name}</Key><Size>${file.body.length}</Size><LastModified>${file.at.toISOString()}</LastModified></Contents>`);
    xml(200, `<ListBucketResult><Name>bucket</Name><IsTruncated>false</IsTruncated>${contents.join('')}</ListBucketResult>`);
  } else if (request.method === 'DELETE') {
    objects.delete(key);
    response.writeHead(204).end();
  } else if (request.method === 'PUT') {
    objects.set(key, { body, type: request.headers['content-type'] ?? '', at: new Date() });
    response.writeHead(200, { etag: '"0"' }).end();
  } else if (request.method === 'GET' && objects.has(key)) {
    response.writeHead(200, { 'content-type': objects.get(key)!.type }).end(objects.get(key)!.body);
  } else {
    xml(404, '<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>');
  }
});

let backend: Server;
let bucket: Bucket;
let api = '';
const listen = (server: Server) => new Promise<number>((done) => server.listen(0, '127.0.0.1', () => done((server.address() as AddressInfo).port)));
const ask = async (path: string, init?: RequestInit) => {
  const answer = await fetch(api + path, init);
  return { status: answer.status, body: await answer.json() };
};
const docxOf = (text: string) => exportDocx(insertText(createDoc(), { para: 0, offset: 0 }, text).doc);

beforeAll(async () => {
  bucket = openBucket({ S3_ENDPOINT: `http://127.0.0.1:${await listen(s3)}`, S3_BUCKET: 'bucket', S3_ACCESS_KEY_ID: 'id', S3_SECRET_ACCESS_KEY: 'secret', S3_FORCE_PATH_STYLE: 'true' });
  const handle = createApi(() => bucket);
  backend = createServer((request, response) => void handle(request, response).then((answered) => answered || response.writeHead(404).end()));
  api = `http://127.0.0.1:${await listen(backend)}`;
});
afterAll(() => {
  s3.close();
  backend.close();
});

describe('a bucket behind the backend', () => {
  it('says what the environment is missing', () => {
    expect(() => openBucket({ S3_BUCKET: 'bucket' })).toThrow('S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY');
  });

  it('lists the documents and the PDFs, and nothing else', async () => {
    await bucket.put('notes.txt', new TextEncoder().encode('no'), 'text/plain');
    await bucket.put('receipt.docx', docxOf('A receipt'), DOCX);
    const { body } = await ask('/api/files');
    expect(body.map((file: { key: string }) => file.key)).toEqual(['receipt.docx']);
    expect(body[0].size).toBeGreaterThan(0);
  });

  it('gives the browser a signed address to read a document from', async () => {
    const { body } = await ask('/api/url?key=receipt.docx');
    expect(new URL(body.url).searchParams.get('X-Amz-Signature')).toBeTruthy();
    const file = new Uint8Array(await (await fetch(body.url)).arrayBuffer());
    expect(paragraphText(importDocx(file).paragraphs[0])).toBe('A receipt');
  });

  it('gives a signed address to write one to, which the browser fills itself', async () => {
    const { body } = await ask('/api/url?key=folder%2Fnew.docx', { method: 'POST' });
    expect(body.type).toBe(DOCX);
    // Signed with no checksum of the body: a browser has none to send.
    expect([...new URL(body.url).searchParams.keys()].filter((name) => /checksum/i.test(name))).toEqual([]);
    const put = await fetch(body.url, { method: 'PUT', headers: { 'content-type': body.type }, body: docxOf('Written by the browser') as BodyInit });
    expect(put.status).toBe(200);
    expect(paragraphText(importDocx((await bucket.get('folder/new.docx'))!).paragraphs[0])).toBe('Written by the browser');
    expect(objects.get('folder/new.docx')!.type).toBe(DOCX);
  });

  it('refuses names that are not of a document', async () => {
    expect((await ask('/api/url?key=notes.txt')).status).toBe(400);
    expect((await ask('/api/url?key=..%2Fother.docx', { method: 'POST' })).status).toBe(400);
    expect((await ask('/api/url?key=made.pdf', { method: 'POST' })).status).toBe(400);
    expect((await ask('/api/url')).status).toBe(400);
    expect((await ask('/api/nothing')).status).toBe(404);
  });

  it('says there is no such document, and not that the bucket failed', async () => {
    expect(await bucket.get('gone.docx')).toBeUndefined();
    expect((await ask('/api/variables?key=gone.docx')).status).toBe(404);
  });

  it('names the variables of a template', async () => {
    await bucket.put('template.docx', docxOf('Received from {{client}} the amount of {{amount}}.'), DOCX);
    expect((await ask('/api/variables?key=template.docx')).body.names).toEqual(['client', 'amount']);
  });

  // Laying out needs font files, and a machine may have none.
  it.skipIf(!fontsFor(createDoc(), []).length)('fills a template and stores the PDF beside it', async () => {
    const { status, body } = await ask('/api/pdf?key=template.docx', { method: 'POST', body: JSON.stringify({ client: 'Ana Pérez', amount: 2500 }) });
    expect(status).toBe(200);
    expect(body).toMatchObject({ key: 'template.pdf', pages: 1 });
    const pdf = (await bucket.get('template.pdf'))!;
    expect(new TextDecoder().decode(pdf.subarray(0, 5))).toBe('%PDF-');
    expect(objects.get('template.pdf')!.type).toBe('application/pdf');
    expect(new Uint8Array(await (await fetch(body.url)).arrayBuffer()).length).toBe(pdf.length);
    // The template stays a template.
    expect((await ask('/api/variables?key=template.docx')).body.names).toEqual(['client', 'amount']);
  });

  it('keeps versions of a document beside it, with who kept them and their name, and lists them apart', async () => {
    const keep = async (text: string, meta: object) => {
      const { status, body } = await ask('/api/versions?key=folder%2Fcontract.docx', { method: 'POST', body: JSON.stringify(meta) });
      expect(status).toBe(200);
      expect(body.version.id.startsWith('versions/folder/contract.docx/')).toBe(true);
      expect((await fetch(body.url, { method: 'PUT', headers: { 'content-type': body.type }, body: docxOf(text) as BodyInit })).status).toBe(200);
      return body.version;
    };
    const first = await keep('First draft', { label: 'Borrador para el cliente', author: 'Ana Pérez' });
    expect(first).toMatchObject({ label: 'Borrador para el cliente', author: 'Ana Pérez' });
    await new Promise((done) => setTimeout(done, 5));
    await keep('Second draft', {});
    const { body: listed } = await ask('/api/versions?key=folder%2Fcontract.docx');
    expect(listed.map((v: { label?: string }) => v.label)).toEqual([undefined, 'Borrador para el cliente']);
    expect(Date.parse(listed[1].date)).toBeGreaterThan(Date.now() - 60_000);
    // Read as any other file; and not among the documents.
    const read = await ask(`/api/url?key=${encodeURIComponent(listed[1].id)}`);
    expect(paragraphText(importDocx(new Uint8Array(await (await fetch(read.body.url)).arrayBuffer())).paragraphs[0])).toBe('First draft');
    expect((await ask('/api/files')).body.some((file: { key: string }) => file.key.startsWith('versions/'))).toBe(false);
    expect((await ask(`/api/versions?key=${encodeURIComponent(listed[1].id)}`, { method: 'POST', body: '{}' })).status).toBe(400);
  });

  it('never signs an address to write over a version, nor makes a PDF of one', async () => {
    const version = 'versions/contract.docx/20261021T100000Z.docx';
    for (const [path, init] of [
      [`/api/url?key=${encodeURIComponent(version)}`, { method: 'POST' }],
      [`/api/pdf?key=${encodeURIComponent(version)}`, { method: 'POST', body: '{}' }],
    ] as const) {
      const { status, body } = await ask(path, init);
      expect(status).toBe(400);
      expect(body.error).toContain('version');
    }
    // It can still be read.
    expect((await ask(`/api/url?key=${encodeURIComponent(version)}`)).status).toBe(200);
  });

  it('keeps as many versions as it is told, the oldest going as new ones come', async () => {
    const few = createApi(() => bucket, { keepVersions: 2 });
    const server = createServer((request, response) => void few(request, response));
    const at = `http://127.0.0.1:${await listen(server)}`;
    const kept: string[] = [];
    for (const text of ['one', 'two', 'three']) {
      const body = await (await fetch(`${at}/api/versions?key=few.docx`, { method: 'POST', body: JSON.stringify({ label: text }) })).json();
      await fetch(body.url, { method: 'PUT', headers: { 'content-type': body.type }, body: docxOf(text) as BodyInit });
      kept.push(body.version.id);
      await new Promise((done) => setTimeout(done, 5));
    }
    const listed = await (await fetch(`${at}/api/versions?key=few.docx`)).json();
    expect(listed.map((v: { label: string }) => v.label).sort()).toEqual(['three', 'two']);
    expect(objects.has(kept[0])).toBe(false);
    server.close();
  });

  it('tells the bucket which origins may reach it', async () => {
    await bucket.allowOrigins(['http://localhost:5176']);
    expect(cors).toContain('<AllowedOrigin>http://localhost:5176</AllowedOrigin>');
    expect(cors).toContain('<AllowedMethod>PUT</AllowedMethod>');
  });
});
