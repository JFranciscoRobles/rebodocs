// What the page asks of the backend, and of the bucket with the addresses the
// backend signs. No key of the bucket is ever here.

export interface BucketFile {
  key: string;
  size: number;
  modified: string;
}

/** A version kept of a document: its key in the bucket is its id. */
export interface Version {
  id: string;
  date: string;
  author?: string;
  label?: string;
}

export interface MadePdf {
  key: string;
  url: string;
  pages: number;
  missingFonts: Record<string, string>;
}

async function ask<T>(path: string, init?: RequestInit): Promise<T> {
  const answer = await fetch(path, init);
  const body = await answer.json().catch(() => ({}));
  if (!answer.ok) throw new Error(body.error ?? `The server answered ${answer.status}.`);
  return body as T;
}

const at = (path: string, key: string) => `${path}?key=${encodeURIComponent(key)}`;

/** A request to the bucket itself. One it refuses before answering is, nearly always, an origin it was not told about. */
async function bucket(url: string, init?: RequestInit): Promise<Response> {
  let answer: Response;
  try {
    answer = await fetch(url, init);
  } catch {
    throw new Error('The bucket did not let this page in. Run "npm run cors" so that it takes requests from this address.');
  }
  if (!answer.ok) throw new Error(`The bucket answered ${answer.status}.`);
  return answer;
}

export const listFiles = () => ask<BucketFile[]>('/api/files');

export const readUrl = async (key: string) => (await ask<{ url: string }>(at('/api/url', key))).url;

export async function readFile(key: string): Promise<Uint8Array> {
  return new Uint8Array(await (await bucket(await readUrl(key))).arrayBuffer());
}

export async function writeFile(key: string, docx: Uint8Array<ArrayBuffer>): Promise<void> {
  const { url, type } = await ask<{ url: string; type: string }>(at('/api/url', key), { method: 'POST' });
  // The type is part of what was signed: the bucket takes the file only with the same one.
  await bucket(url, { method: 'PUT', headers: { 'content-type': type }, body: docx });
}

export const variablesOf = async (key: string) => (await ask<{ names: string[] }>(at('/api/variables', key))).names;

export const makePdf = (key: string, values: Record<string, string>) =>
  ask<MadePdf>(at('/api/pdf', key), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(values) });

export const listVersions = (key: string) => ask<Version[]>(at('/api/versions', key));

/** Keeps `docx` as a version of the document at `key`, as the bucket's: the browser writes it there itself. */
export async function saveVersion(key: string, docx: Uint8Array<ArrayBuffer>, meta: { label?: string; author?: string } = {}): Promise<Version> {
  const { url, type, version } = await ask<{ url: string; type: string; version: Version }>(at('/api/versions', key), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(meta),
  });
  await bucket(url, { method: 'PUT', headers: { 'content-type': type }, body: docx });
  return version;
}
