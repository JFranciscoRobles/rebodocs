// The versions of the documents, kept beside them in the same store, as the
// storage demo keeps them (`apps/storage/server/api.ts`), so that both read
// the same bucket the same way:
//
//   versions/<document>/<when>~<base64url of { author, label }>.docx
//
// They are under `versions/`, never among the documents. One is kept each
// time a session of work on a document ends (the collaboration server says so
// when it gives the document back the last time), signed by who changed it,
// and one each time someone keeps it by hand from the side panel.

import { DOCX, type Store } from './store';

export interface VersionInfo {
  /** Its key in the store. */
  id: string;
  date: string;
  author?: string;
  label?: string;
}

/** Where the versions of the documents are kept. */
export const VERSIONS = 'versions/';
const folderOf = (key: string) => `${VERSIONS}${key}/`;

/** Where a version of `key` made now is kept. */
export function versionKey(key: string, said: { author?: string; label?: string }, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '');
  const meta = said.author || said.label ? `~${Buffer.from(JSON.stringify(said)).toString('base64url')}` : '';
  return `${folderOf(key)}${stamp}${meta}.docx`;
}

/** The versions of `key`, the newest first. */
export async function versionsOf(store: Store, key: string): Promise<VersionInfo[]> {
  const out: VersionInfo[] = [];
  for (const file of await store.list(folderOf(key))) {
    const found = /^(\d{8}T\d{6}(?:\.\d+)?Z)(?:~([A-Za-z0-9_-]+))?\.docx$/.exec(file.key.slice(folderOf(key).length));
    if (!found) continue;
    const [, stamp, info] = found;
    let said: { author?: unknown; label?: unknown } = {};
    try {
      if (info) said = JSON.parse(Buffer.from(info, 'base64url').toString('utf8'));
    } catch {
      // A version all the same, without who or what.
    }
    const date = new Date(stamp.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
    out.push({
      id: file.key,
      date: Number.isNaN(date.getTime()) ? file.modified : date.toISOString(),
      ...(typeof said.author === 'string' && said.author ? { author: said.author } : {}),
      ...(typeof said.label === 'string' && said.label ? { label: said.label } : {}),
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Keeps the document as a version of `key`. */
export async function keepVersion(store: Store, key: string, docx: Uint8Array, said: { author?: string; label?: string }): Promise<string> {
  const id = versionKey(key, said);
  await store.put(id, docx, DOCX);
  return id;
}

/** Whether `id` is a version of `key`, and not some other file. */
export const isVersionOf = (id: string, key: string) => id.startsWith(folderOf(key)) && !id.slice(folderOf(key).length).includes('/') && !id.includes('..');
