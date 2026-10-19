// Where the backend keeps the documents. The collaboration server never sees
// this: it asks the backend, and the backend asks here. A folder is enough to
// try it; a bucket takes the same three calls (`apps/storage/server/bucket.ts`
// is one), and so would a table of a database.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface StoredFile {
  key: string;
  size: number;
  /** When it was last written, as an ISO date. */
  modified: string;
}

export interface Store {
  /** The files, or those whose key starts with `prefix`, the newest first. */
  list(prefix?: string): Promise<StoredFile[]>;
  get(key: string): Promise<Uint8Array | undefined>;
  put(key: string, body: Uint8Array, type: string): Promise<void>;
}

/** The documents as the files of a folder, each under its name; a key with `/` in it is in a folder inside, as `versions/…`. */
export function folderStore(dir: string): Store {
  const root = resolve(dir);
  mkdirSync(root, { recursive: true });
  // Names of folders and of a file, and nothing that leads out of the folder.
  const at = (key: string) => {
    const parts = key.split('/');
    return parts.every((part) => /^[^\\]+$/.test(part) && part !== '..' && part !== '.') ? join(root, ...parts) : undefined;
  };
  return {
    // The files of the folder, or of the folder inside that `prefix` (ending in `/`) names.
    async list(prefix = '') {
      const folder = prefix ? at(prefix.replace(/\/$/, '')) : root;
      if (!folder || !existsSync(folder)) return [];
      return readdirSync(folder)
        .filter((name) => !name.startsWith('.') && !name.endsWith('.part') && statSync(join(folder, name)).isFile())
        .map((name) => ({ key: `${prefix}${name}`, size: statSync(join(folder, name)).size, modified: statSync(join(folder, name)).mtime.toISOString() }))
        .sort((a, b) => b.modified.localeCompare(a.modified));
    },
    async get(key) {
      const path = at(key);
      return path && existsSync(path) ? new Uint8Array(readFileSync(path)) : undefined;
    },
    async put(key, body) {
      const path = at(key);
      if (!path) throw new Error(`"${key}" is not the name of a file.`);
      mkdirSync(dirname(path), { recursive: true });
      // Whole or not at all: a reader never finds half a document.
      writeFileSync(`${path}.part`, body);
      renameSync(`${path}.part`, path);
    },
  };
}
