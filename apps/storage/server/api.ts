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
//
// This is where an application of your own checks who is asking, before
// signing anything: here anyone who reaches the server may open and save.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { importDocx, variableNames } from '@rebodocs/core';
import { type Bucket, DOCX } from './bucket';
import { makePdf } from './pdf';

/** A request that cannot be answered, and the status that says why. */
class Refused extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

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

async function templateOf(bucket: Bucket, key: string) {
  const file = await bucket.get(key);
  if (!file) throw new Refused(404, 'There is no such document.');
  return importDocx(file);
}

/**
 * Answers the requests under `/api`; says false for any other, so that
 * whatever serves the pages can go on with it.
 */
export function createApi(bucket: () => Bucket, options: { fontDirs?: string[] } = {}) {
  const routes: Record<string, (url: URL, request: IncomingMessage) => Promise<unknown>> = {
    'GET /api/files': () => bucket().list(),
    'GET /api/url': async (url) => ({ url: await bucket().readUrl(keyOf(url, /\.(docx|pdf)$/i)) }),
    'POST /api/url': async (url) => ({ url: await bucket().writeUrl(keyOf(url, /\.docx$/i), DOCX), type: DOCX }),
    'GET /api/variables': async (url) => ({ names: variableNames(await templateOf(bucket(), keyOf(url, /\.docx$/i))) }),
    'POST /api/pdf': async (url, request) => {
      const key = keyOf(url, /\.docx$/i);
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
