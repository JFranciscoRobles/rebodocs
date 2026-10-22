// The storage demo's protocol, played in the page: a backend that signs
// addresses, as apps/storage/server/api.ts does, and a bucket that checks them,
// as an S3 does: the address not run out, the method and the type the ones
// signed, and the page's origin one it was told to let in. No network: what
// the bucket holds is in memory, and each request is told to `onRequest`.

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
/** How long an address handed to the browser is good for, in seconds, as in bucket.ts. */
export const URL_LIFE = 300;
const HOST = 'https://rebodocs-demo.s3.example.com';

export interface Request {
  /** Who answered: the backend, which has the keys, or the bucket, which has the files. */
  to: 'backend' | 'bucket';
  method: string;
  path: string;
  status: number;
  note: string;
}

export interface Stored {
  key: string;
  bytes: Uint8Array;
  type: string;
  modified: string;
}

/** What a version says of itself, at the end of its key, as api.ts writes it. */
interface VersionMeta {
  author?: string;
  label?: string;
}

const base64url = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromBase64url = (text: string) => new TextDecoder().decode(Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

/** Not a real signature: enough to tell an address that was changed from one that was not. */
function sign(parts: string[]): string {
  let hash = 0x811c9dc5;
  for (const ch of parts.join('\n')) hash = Math.imul(hash ^ ch.charCodeAt(0), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export class Storage {
  readonly files = new Map<string, Stored>();
  /** Whether the bucket was told to let this page's origin in: `npm run cors`. */
  cors = true;
  /** The clock of the bucket, which a demo can move on to see an address run out. */
  now = () => Date.now();
  constructor(private readonly onRequest: (request: Request) => void) {}

  private log(request: Request) {
    this.onRequest(request);
  }

  /** An address for one file, for a few minutes: what getSignedUrl makes. */
  private address(method: 'GET' | 'PUT', key: string, type = ''): string {
    const expires = Math.floor(this.now() / 1000) + URL_LIFE;
    const signature = sign([method, key, type, String(expires)]);
    return `${HOST}/${key.split('/').map(encodeURIComponent).join('/')}?X-Amz-Expires=${URL_LIFE}&X-Amz-Date=${expires}&X-Amz-SignedHeaders=${type ? 'content-type%3Bhost' : 'host'}&X-Amz-Signature=${signature}`;
  }

  // --- The backend ------------------------------------------------------------------

  listFiles(): Stored[] {
    const files = [...this.files.values()].filter((file) => !file.key.startsWith('versions/')).sort((a, b) => b.modified.localeCompare(a.modified));
    this.log({ to: 'backend', method: 'GET', path: '/api/files', status: 200, note: `${files.length} files` });
    return files;
  }

  readUrl(key: string): string {
    this.log({ to: 'backend', method: 'GET', path: `/api/url?key=${key}`, status: 200, note: '{ url }' });
    return this.address('GET', key);
  }

  writeUrl(key: string): { url: string; type: string } {
    this.log({ to: 'backend', method: 'POST', path: `/api/url?key=${key}`, status: 200, note: '{ url, type }' });
    return { url: this.address('PUT', key, DOCX), type: DOCX };
  }

  listVersions(key: string): { id: string; date: string; author?: string; label?: string }[] {
    const prefix = `versions/${key}/`;
    const found = [...this.files.values()]
      .filter((file) => file.key.startsWith(prefix))
      .map((file) => {
        const [, stamp, said] = /^(\d{8}T\d{6}(?:\.\d+)?Z)(?:~([A-Za-z0-9_-]+))?\.docx$/.exec(file.key.slice(prefix.length)) ?? [];
        let meta: VersionMeta = {};
        try {
          if (said) meta = JSON.parse(fromBase64url(said)) as VersionMeta;
        } catch {
          // A name it cannot read: the version is still there.
        }
        const date = stamp ? stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6') : file.modified;
        return { id: file.key, date, ...meta };
      });
    this.log({ to: 'backend', method: 'GET', path: `/api/versions?key=${key}`, status: 200, note: `${found.length} versions` });
    return found;
  }

  versionUrl(key: string, meta: VersionMeta): { url: string; type: string; id: string } {
    const stamp = new Date(this.now()).toISOString().replace(/[-:]/g, '');
    const said = meta.author || meta.label ? `~${base64url(JSON.stringify(meta))}` : '';
    const id = `versions/${key}/${stamp}${said}.docx`;
    this.log({ to: 'backend', method: 'POST', path: `/api/versions?key=${key}`, status: 200, note: '{ url, type, version }' });
    return { url: this.address('PUT', id, DOCX), type: DOCX, id };
  }

  // --- The bucket -------------------------------------------------------------------

  /** A request of the browser to the bucket itself, with an address the backend signed. */
  fetch(url: string, init: { method?: 'GET' | 'PUT'; type?: string; body?: Uint8Array } = {}): { status: number; body?: Uint8Array } {
    const method = init.method ?? 'GET';
    const parsed = new URL(url);
    const key = decodeURIComponent(parsed.pathname.slice(1));
    const short = key.length > 24 ? `${key.slice(0, 22)}…` : key;
    const answer = (status: number, note: string, body?: Uint8Array) => {
      this.log({ to: 'bucket', method, path: short, status, note });
      return { status, body };
    };
    // The browser asks before it sends: without the rule of origins, it never does.
    if (!this.cors) return answer(0, 'blocked: no CORS rule');
    const expires = Number(parsed.searchParams.get('X-Amz-Date'));
    if (Math.floor(this.now() / 1000) > expires) return answer(403, 'Request has expired');
    const type = method === 'PUT' ? (init.type ?? '') : '';
    if (sign([method, key, type, String(expires)]) !== parsed.searchParams.get('X-Amz-Signature')) return answer(403, 'SignatureDoesNotMatch');
    if (method === 'GET') {
      const file = this.files.get(key);
      return file ? answer(200, `${Math.round(file.bytes.length / 1024)} KB`, file.bytes) : answer(404, 'NoSuchKey');
    }
    this.files.set(key, { key, bytes: init.body ?? new Uint8Array(), type, modified: new Date(this.now()).toISOString() });
    return answer(200, `stored, ${Math.round((init.body?.length ?? 0) / 1024)} KB`);
  }
}
