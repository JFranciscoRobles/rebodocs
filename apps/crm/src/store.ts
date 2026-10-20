// Where the documents are kept: in the browser, in IndexedDB, as a CRM keeps
// them in its own storage (a bucket, a database) behind its own routes. Each
// document of a property is a .docx, and each version a .docx of its own.
// Nothing here knows of the editor: a CRM replaces this file with calls to
// its backend, and the page does not change.

import type { VersionInfo, Versions } from '@rebodocs/react';

export interface DocInfo {
  id: string;
  property: string;
  name: string;
  /** When it last changed, as an ISO date, and who changed it. */
  updated: string;
  author: string;
}

interface VersionRow extends VersionInfo {
  doc: string;
  docx: Uint8Array;
}

const DB = 'rebodocs-crm';

let opened: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      const base = request.result;
      base.createObjectStore('docs', { keyPath: 'id' }).createIndex('property', 'property');
      base.createObjectStore('files');
      base.createObjectStore('versions', { keyPath: 'id' }).createIndex('doc', 'doc');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opened;
}

/** One request in a transaction of its own, as a promise. */
async function ask<T>(stores: string | string[], mode: IDBTransactionMode, work: (tx: IDBTransaction) => IDBRequest<T> | void): Promise<T> {
  const tx = (await db()).transaction(stores, mode);
  return new Promise((resolve, reject) => {
    const request = work(tx);
    tx.oncomplete = () => resolve(request ? request.result : (undefined as T));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** The documents of a property, the last changed first. */
export async function listDocs(property: string): Promise<DocInfo[]> {
  const all = await ask<DocInfo[]>('docs', 'readonly', (tx) => tx.objectStore('docs').index('property').getAll(property));
  return all.sort((a, b) => b.updated.localeCompare(a.updated));
}

export async function getDoc(doc: string): Promise<{ info: DocInfo; docx: Uint8Array } | undefined> {
  const info = await ask<DocInfo | undefined>('docs', 'readonly', (tx) => tx.objectStore('docs').get(doc));
  if (!info) return undefined;
  const docx = await ask<Uint8Array>('files', 'readonly', (tx) => tx.objectStore('files').get(doc));
  return { info, docx };
}

/** A new document of a property, with a first version: what it was made from. */
export async function createDoc(property: string, name: string, docx: Uint8Array, author: string, label: string): Promise<DocInfo> {
  const info: DocInfo = { id: id(), property, name, updated: new Date().toISOString(), author };
  await ask(['docs', 'files'], 'readwrite', (tx) => {
    tx.objectStore('docs').put(info);
    tx.objectStore('files').put(docx, info.id);
  });
  await addVersion(info.id, docx, { author, label });
  return info;
}

/** Keeps the document as it is now: what autosave calls. */
export async function saveDoc(doc: string, docx: Uint8Array, author: string): Promise<void> {
  const info = await ask<DocInfo | undefined>('docs', 'readonly', (tx) => tx.objectStore('docs').get(doc));
  if (!info) return;
  await ask(['docs', 'files'], 'readwrite', (tx) => {
    tx.objectStore('docs').put({ ...info, updated: new Date().toISOString(), author });
    tx.objectStore('files').put(docx, doc);
  });
}

export async function deleteDoc(doc: string): Promise<void> {
  const versions = await ask<VersionRow[]>('versions', 'readonly', (tx) => tx.objectStore('versions').index('doc').getAll(doc));
  await ask(['docs', 'files', 'versions'], 'readwrite', (tx) => {
    tx.objectStore('docs').delete(doc);
    tx.objectStore('files').delete(doc);
    for (const version of versions) tx.objectStore('versions').delete(version.id);
  });
}

async function addVersion(doc: string, docx: Uint8Array, info: { label?: string; author?: string }): Promise<VersionInfo> {
  const row: VersionRow = { id: id(), doc, docx, date: new Date().toISOString(), author: info.author, label: info.label };
  await ask('versions', 'readwrite', (tx) => {
    tx.objectStore('versions').put(row);
  });
  const { docx: _, doc: __, ...version } = row;
  return version;
}

/** The versions of one document, as the editor's panel asks for them. */
export function versionsOf(doc: string, author: () => string): Versions {
  return {
    list: async () => {
      const rows = await ask<VersionRow[]>('versions', 'readonly', (tx) => tx.objectStore('versions').index('doc').getAll(doc));
      return rows.map(({ docx: _, doc: __, ...version }) => version);
    },
    load: async (version) => (await ask<VersionRow>('versions', 'readonly', (tx) => tx.objectStore('versions').get(version))).docx,
    save: (docx, info) => addVersion(doc, docx, { label: info.label, author: info.author ?? author() }),
  };
}
