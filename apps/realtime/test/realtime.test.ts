import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Doc, createDoc, exportDocx, importDocx, insertText, paragraphText } from '@rebodocs/core';
import { type CollabServer, createCollabServer } from '../../../packages/collab/src/server';
import { type CollabHost, type HostHistory, type HostSelection, type PeerCaret, type Session, joinRoom } from '../../../packages/collab/src/session';
import { backendStorage } from '../../../packages/collab/src/storage';
import { createApi } from '../server/api';
import { createCollabBackend, createTickets, roomOf } from '../server/collab';
import { DOCX, type Store, folderStore } from '../server/store';

/** What the session needs of an editor, and nothing that needs a browser. */
class Host implements CollabHost {
  doc: Doc = createDoc();
  selection: HostSelection = { anchor: { para: 0, offset: 0 }, focus: { para: 0, offset: 0 } };
  place = { page: 0 };
  commits = 0;
  steps = 0;
  history?: HostHistory;
  carets: PeerCaret[] = [];
  private listeners = new Set<() => void>();
  onChange(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit() {
    for (const listener of this.listeners) listener();
  }
  load(doc: Doc) {
    this.doc = doc;
    this.selection = { anchor: { para: 0, offset: 0 }, focus: { para: 0, offset: 0 } };
    this.emit();
  }
  replace(doc: Doc, selection: HostSelection) {
    this.doc = doc;
    this.selection = selection;
    this.emit();
  }
  setPeers(carets: PeerCaret[]) {
    this.carets = carets;
  }
  exportDocx() {
    return exportDocx(this.doc);
  }
  /** What the person does, as a step of its own to undo. */
  edit(change: (doc: Doc) => Doc, caret?: { para: number; offset: number }) {
    this.doc = change(this.doc);
    if (caret) this.selection = { anchor: caret, focus: caret };
    this.commits++;
    this.steps++;
    this.emit();
  }
  move(para: number, offset: number) {
    this.selection = { anchor: { para, offset }, focus: { para, offset } };
    this.emit();
  }
  get texts() {
    return this.doc.paragraphs.map(paragraphText);
  }
}

async function until(what: () => boolean, ms = 4000): Promise<void> {
  const end = Date.now() + ms;
  while (!what()) {
    if (Date.now() > end) throw new Error('it never happened');
    await new Promise((done) => setTimeout(done, 10));
  }
}

const dir = mkdtempSync(join(tmpdir(), 'rebodocs-realtime-'));
const tickets = createTickets('a secret');
let store: Store;
let backend: Server;
let rooms: CollabServer;
let api = '';
/** How long the backend takes to say whether someone may come in, in milliseconds. */
let slowAccess = 0;
const sessions: Session[] = [];
const ask = async (path: string, init?: RequestInit) => {
  const answer = await fetch(api + path, init);
  return { status: answer.status, body: await answer.json() };
};
const docxOf = (text: string) => exportDocx(insertText(createDoc(), { para: 0, offset: 0 }, text).doc);
const textsOf = async (key: string) => importDocx((await store.get(key))!).paragraphs.map(paragraphText);

beforeAll(async () => {
  store = folderStore(dir);
  const handle = createApi(() => store, { collabUrl: (host) => `http://${host}:${rooms.port}`, tickets, inRoom: (room) => rooms.rooms().find((open) => open.id === room)?.people ?? [] });
  const collab = createCollabBackend(() => store, { key: 'the key', tickets });
  backend = createServer(async (request, response) => {
    if (slowAccess && request.url?.endsWith('/access')) await new Promise((done) => setTimeout(done, slowAccess));
    void ((await handle(request, response)) || (await collab(request, response)) || response.writeHead(404).end());
  });
  await new Promise<void>((done) => backend.listen(0, '127.0.0.1', done));
  api = `http://127.0.0.1:${(backend.address() as AddressInfo).port}`;
  // A room nobody is in is given back at once, to see it kept without waiting.
  rooms = createCollabServer({ port: 0, storage: backendStorage({ url: `${api}/backend/docs`, key: 'the key' }), idle: 30, saveEvery: 60_000 });
  await rooms.ready;
});
afterAll(() => {
  for (const session of sessions) session.leave();
  rooms.close();
  backend.close();
  backend.closeAllConnections();
  rmSync(dir, { recursive: true, force: true });
});

describe('the documents, in a folder', () => {
  it('keeps them under their names, and lets nothing out of the folder', async () => {
    await store.put('one.docx', docxOf('One'), DOCX);
    expect((await store.list()).map((file) => file.key)).toEqual(['one.docx']);
    expect(await textsOf('one.docx')).toEqual(['One']);
    expect(await store.get('gone.docx')).toBeUndefined();
    expect(await store.get('../one.docx')).toBeUndefined();
    await expect(store.put('../out.docx', docxOf('Out'), DOCX)).rejects.toThrow();
    // Nothing half written is left beside them.
    expect(readdirSync(dir)).toEqual(['one.docx']);
  });
});

describe('what the page asks', () => {
  it('lists the documents, and starts new ones empty', async () => {
    expect((await ask('/api/docs?key=new.docx', { method: 'POST' })).body).toEqual({ key: 'new.docx' });
    expect((await ask('/api/docs?key=new.docx', { method: 'POST' })).status).toBe(409);
    expect((await ask('/api/docs')).body.map((file: { key: string }) => file.key).sort()).toEqual(['new.docx', 'one.docx']);
    expect(await textsOf('new.docx')).toEqual(['']);
  });

  it('refuses names that are not of a document', async () => {
    expect((await ask('/api/docs?key=notes.txt', { method: 'POST' })).status).toBe(400);
    expect((await ask('/api/docs?key=..%2Fout.docx', { method: 'POST' })).status).toBe(400);
    expect((await ask('/api/room?key=.hidden.docx', { method: 'POST' })).status).toBe(400);
    expect((await ask('/api/room?key=gone.docx', { method: 'POST', body: '{}' })).status).toBe(404);
    expect((await ask('/api/nothing')).status).toBe(404);
  });
});

describe('what the collaboration server asks', () => {
  const room = roomOf('one.docx');
  const asServer = { authorization: 'Bearer the key' };

  it('names a room with what a room may be named with', () => {
    expect(room).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(roomOf('one.docx')).toBe(room);
    expect(roomOf('new.docx')).not.toBe(room);
  });

  it('signs tickets for one room, one name and a while', () => {
    const ticket = tickets.issue(room, 'Ana');
    expect(tickets.check(room, ticket)).toBe('Ana');
    expect(tickets.check(roomOf('new.docx'), ticket)).toBeUndefined();
    expect(tickets.check(room, `${ticket}x`)).toBeUndefined();
    expect(tickets.check(room, createTickets('another secret').issue(room, 'Ana'))).toBeUndefined();
    expect(tickets.check(room, createTickets('a secret', -1).issue(room, 'Ana'))).toBeUndefined();
    expect(tickets.check(room, 'nonsense')).toBeUndefined();
  });

  it('answers nobody else', async () => {
    expect((await fetch(`${api}/backend/docs/${room}`)).status).toBe(401);
    expect((await fetch(`${api}/backend/docs/${room}`, { headers: { authorization: 'Bearer another' } })).status).toBe(401);
    expect((await fetch(`${api}/backend/docs/${room}`, { method: 'PUT', body: docxOf('No') as BodyInit })).status).toBe(401);
    expect(await textsOf('one.docx')).toEqual(['One']);
  });

  it('gives the document with its name, and keeps what it is given back', async () => {
    const answer = await fetch(`${api}/backend/docs/${room}`, { headers: asServer });
    expect(decodeURIComponent(answer.headers.get('x-document-name')!)).toBe('one.docx');
    expect(importDocx(new Uint8Array(await answer.arrayBuffer())).paragraphs.map(paragraphText)).toEqual(['One']);
    expect((await fetch(`${api}/backend/docs/${roomOf('gone.docx')}`, { headers: asServer })).status).toBe(404);
    expect((await fetch(`${api}/backend/docs/${room}`, { method: 'PUT', headers: asServer, body: docxOf('One, kept') as BodyInit })).status).toBe(204);
    expect(await textsOf('one.docx')).toEqual(['One, kept']);
  });
});

describe('two people on one document', () => {
  const enter = async (key: string, name: string, ticket?: string) => {
    const { body } = await ask(`/api/room?key=${encodeURIComponent(key)}`, { method: 'POST', body: JSON.stringify({ name }) });
    const host = new Host();
    const session = joinRoom(host, body.room, { url: body.url, name: 'not this one', ticket: ticket ?? body.ticket });
    sessions.push(session);
    await until(() => session.state === 'on' || session.state === 'closed');
    return { host, session };
  };

  it('lets in who has a ticket, under the name it was signed for', async () => {
    await store.put('shared.docx', docxOf('Shared'), DOCX);
    const ana = await enter('shared.docx', 'Ana');
    const luis = await enter('shared.docx', 'Luis');
    expect(ana.session.state).toBe('on');
    expect(ana.session.title).toBe('shared.docx');
    expect(luis.host.texts).toEqual(['Shared']);
    await until(() => ana.session.peers.length === 1 && luis.session.peers.length === 1);
    expect(ana.session.peers[0].name).toBe('Luis');
    expect(luis.session.peers[0].name).toBe('Ana');
    // The room is open while they are in it, and the page is told who they are.
    const peopleIn = async (key: string) => (await ask('/api/docs')).body.find((file: { key: string }) => file.key === key).people;
    expect((await peopleIn('shared.docx')).sort()).toEqual(['Ana', 'Luis']);
    expect(await peopleIn('one.docx')).toEqual([]);
    expect(rooms.rooms().map((room) => room.id)).toEqual([roomOf('shared.docx')]);
    expect((await enter('shared.docx', 'Eva', 'nonsense')).session.state).toBe('closed');
    // A ticket into another room does not open this one.
    expect((await enter('shared.docx', 'Eva', tickets.issue(roomOf('one.docx'), 'Eva'))).session.state).toBe('closed');

    // What each types reaches the other.
    ana.host.edit((doc) => insertText(doc, { para: 0, offset: 6 }, ' by Ana').doc);
    await until(() => luis.host.texts[0] === 'Shared by Ana');
    luis.host.edit((doc) => insertText(doc, { para: 0, offset: 13 }, ' and Luis').doc);
    await until(() => ana.host.texts[0] === 'Shared by Ana and Luis');

    // When the last one leaves, the document goes back to where it is kept.
    ana.session.leave();
    luis.session.leave();
    const end = Date.now() + 4000;
    while ((await textsOf('shared.docx'))[0] !== 'Shared by Ana and Luis' && Date.now() < end) await new Promise((done) => setTimeout(done, 20));
    expect(await textsOf('shared.docx')).toEqual(['Shared by Ana and Luis']);
    // And the room is let go of: nothing of the document stays in the collaboration server.
    await until(() => rooms.rooms().length === 0);
    expect(await peopleIn('shared.docx')).toEqual([]);

    // Whoever comes later opens it again, with what was kept.
    const eva = await enter('shared.docx', 'Eva');
    expect(eva.host.texts).toEqual(['Shared by Ana and Luis']);
    expect(await peopleIn('shared.docx')).toEqual(['Eva']);
    eva.session.leave();
    await until(() => rooms.rooms().length === 0);
  });

  it('counts nobody who went away while the backend was being asked about them', async () => {
    await store.put('quick.docx', docxOf('Quick'), DOCX);
    const { body } = await ask('/api/room?key=quick.docx', { method: 'POST', body: JSON.stringify({ name: 'Ana' }) });
    const events = (client: string) => `${body.url}/collab/rooms/${body.room}/events?client=${client}&ticket=${encodeURIComponent(body.ticket)}`;
    // A page that is opened and closed at once, as React does to an effect while trying it: gone before the answer.
    slowAccess = 150;
    const gone = new AbortController();
    const left = fetch(events('gone'), { signal: gone.signal }).catch(() => undefined);
    await new Promise((done) => setTimeout(done, 50));
    gone.abort();
    await left;
    // Someone who stays.
    const stays = new AbortController();
    const stream = await fetch(events('stays'), { signal: stays.signal });
    slowAccess = 0;
    expect(stream.status).toBe(200);
    await new Promise((done) => setTimeout(done, 200));
    expect(rooms.rooms()).toEqual([{ id: body.room, people: ['Ana'] }]);
    // And once they leave too, nobody is left and the room closes.
    stays.abort();
    await until(() => rooms.rooms().length === 0);
  });
});
