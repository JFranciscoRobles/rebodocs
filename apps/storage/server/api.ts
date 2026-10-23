// What the browser asks of the backend. The files themselves do not pass
// through here: the browser is given an address signed for a few minutes and
// reads from, or writes to, the bucket itself. Only the PDF is made here,
// because that is work for a server.
//
//   GET  /api/files               the documents and PDFs of the bucket
//   GET  /api/url?key=…           an address to read one from
//   POST /api/url?key=…           an address to write a .docx to
//   GET  /api/variables?key=…     the variables of a template
//   POST /api/pdf?key=…           fills it with the JSON of the body and stores the PDF
//   GET  /api/versions?key=…      the versions kept of a document
//   POST /api/versions?key=…      an address to write a new version to, named by the JSON of the body
//
// A version is a copy of the document beside it, under `versions/`: its key
// says when it was kept, and by whom and with what name, so that listing them
// is one request. It is read as any other file, with `GET /api/url`.
//
// This is where an application of your own checks who is asking, before
// signing anything: here anyone who reaches the server may open and save.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { importDocx, variableNames } from '@rebodocs/core';
import { type Bucket, DOCX } from './bucket';
import { Refused } from './refused';
import { makePdf } from './pdf';

/** The key asked for, when it is one this server deals with: a file name with no way out of the bucket. */
function keyOf(url: URL, extension: RegExp): string {
  const key = url.searchParams.get('key') ?? '';
  if (!key || key.length > 512 || key.startsWith('/') || key.split('/').includes('..') || !extension.test(key)) throw new Refused(400, 'That is not the name of a document.');
  return key;
}

async function bodyOf(request: IncomingMessage): Promise<unknown> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of request) {
    size += (part as Buffer).length;
    if (size > 1_000_000) throw new Refused(413, 'Too much to read.');
    parts.push(part as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString('utf8') || '{}');
  } catch {
    throw new Refused(400, 'The body is not JSON.');
  }
}

/** Where the versions of a document are kept. */
const VERSIONS = 'versions/';

/** The key of a document, which may not be one of the versions: those are written once, by POST /api/versions, and never again. */
function documentKey(url: URL): string {
  const key = keyOf(url, /\.docx$/i);
  if (key.startsWith(VERSIONS)) throw new Refused(400, 'That is a version, which stays as it was kept. Save it under another name.');
  return key;
}
const versionsOf = (key: string) => `${VERSIONS}${key}/`;

/** What a version says of itself, as the end of its key: when, then by whom and with what name. */
interface VersionMeta {
  author?: string;
  label?: string;
}

const toBase64Url = (text: string) => Buffer.from(text, 'utf8').toString('base64url');
const fromBase64Url = (text: string) => Buffer.from(text, 'base64url').toString('utf8');

/** The key of a version kept now: its time, so that they sort, and what it says of itself. */
function versionKey(key: string, meta: VersionMeta, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '');
  const said = meta.author || meta.label ? `~${toBase64Url(JSON.stringify(meta))}` : '';
  return `${versionsOf(key)}${stamp}${said}.docx`;
}

/** A version as the page lists it, from its key; undefined for a key that is not one. */
function versionOf(file: { key: string; modified: string }, key: string) {
  const name = file.key.slice(versionsOf(key).length);
  const found = /^(\d{8}T\d{6}(?:\.\d+)?Z)(?:~([A-Za-z0-9_-]+))?\.docx$/.exec(name);
  if (!found) return undefined;
  const [, stamp, said] = found;
  const date = new Date(stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
  let meta: VersionMeta = {};
  try {
    if (said) meta = JSON.parse(fromBase64Url(said)) as VersionMeta;
  } catch {
    // A name it cannot read: the version is still there.
  }
  return {
    id: file.key,
    date: Number.isNaN(date.getTime()) ? file.modified : date.toISOString(),
    ...(typeof meta.author === 'string' && meta.author ? { author: meta.author } : {}),
    ...(typeof meta.label === 'string' && meta.label ? { label: meta.label } : {}),
  };
}

/** What a version is named by, as the body says it: short, and only text. */
function metaOf(body: unknown): VersionMeta {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Refused(400, 'The body is not an object with what the version is called.');
  const take = (value: unknown, most: number) => (typeof value === 'string' ? value.trim().slice(0, most) || undefined : undefined);
  const { author, label } = body as Record<string, unknown>;
  return { ...(take(author, 60) ? { author: take(author, 60) } : {}), ...(take(label, 100) ? { label: take(label, 100) } : {}) };
}

async function templateOf(bucket: Bucket, key: string) {
  const file = await bucket.get(key);
  if (!file) throw new Refused(404, 'There is no such document.');
  return importDocx(file);
}

/**
 * Answers the requests under `/api`; says false for any other, so that
 * whatever serves the pages can go on with it.
 */
export function createApi(bucket: () => Bucket, options: { fontDirs?: string[]; keepVersions?: number } = {}) {
  /** How many versions of a document are kept: the oldest go as new ones come. */
  const keep = Number.isFinite(options.keepVersions) ? Math.max(1, Math.floor(options.keepVersions!)) : 50;
  const routes: Record<string, (url: URL, request: IncomingMessage) => Promise<unknown>> = {
    // The versions are beside the documents, not among them.
    'GET /api/files': async () => (await bucket().list()).filter((file) => !file.key.startsWith(VERSIONS)),
    'GET /api/url': async (url) => ({ url: await bucket().readUrl(keyOf(url, /\.(docx|pdf)$/i)) }),
    'POST /api/url': async (url) => ({ url: await bucket().writeUrl(documentKey(url), DOCX), type: DOCX }),
    'GET /api/variables': async (url) => ({ names: variableNames(await templateOf(bucket(), keyOf(url, /\.docx$/i))) }),
    'GET /api/versions': async (url) => {
      const key = keyOf(url, /\.docx$/i);
      const files = await bucket().list(versionsOf(key));
      return files.map((file) => versionOf(file, key)).filter((version) => version !== undefined);
    },
    'POST /api/versions': async (url, request) => {
      const key = keyOf(url, /\.docx$/i);
      if (key.startsWith(VERSIONS)) throw new Refused(400, 'A version has no versions of its own.');
      const meta = metaOf(await bodyOf(request));
      // Room for the one that comes: the oldest beyond what is kept go. Their keys sort by when they were kept.
      const kept = (await bucket().list(versionsOf(key)))
        .map((file) => file.key)
        .filter((name) => versionOf({ key: name, modified: '' }, key))
        .sort();
      for (const old of kept.slice(0, Math.max(0, kept.length - (keep - 1)))) await bucket().remove(old);
      const version = versionKey(key, meta);
      return { url: await bucket().writeUrl(version, DOCX), type: DOCX, version: versionOf({ key: version, modified: new Date().toISOString() }, key) };
    },
    'POST /api/pdf': async (url, request) => {
      const key = documentKey(url);
      const values = await bodyOf(request);
      if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Refused(400, 'The body is not an object with a value for each variable.');
      const filled = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, String(value ?? '')]));
      const name = key.replace(/\.docx$/i, '');
      const made = makePdf(await templateOf(bucket(), key), filled, name.split('/').pop()!, options.fontDirs);
      await bucket().put(`${name}.pdf`, made.pdf, 'application/pdf');
      return { key: `${name}.pdf`, url: await bucket().readUrl(`${name}.pdf`), pages: made.pages, missingFonts: made.missingFonts };
    },
  };

  return async function api(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return false;
    const send = (status: number, body: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    const route = routes[`${request.method} ${url.pathname}`];
    if (!route) {
      send(404, { error: 'There is nothing at that address.' });
      return true;
    }
    try {
      send(200, await route(url, request));
    } catch (error) {
      // What the person can act on is said; anything else of the bucket stays in the log.
      if (error instanceof Refused) send(error.status, { error: error.message });
      else {
        console.error(error);
        // What went wrong with the bucket stays in the log of the server: it may name the bucket or the account.
        send(500, { error: error instanceof Error && / in the environment /.test(error.message) ? error.message : 'The server could not do that. Its log says why.' });
      }
    }
    return true;
  };
}
