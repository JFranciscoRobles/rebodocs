import { mkdtempSync, rmSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Doc, addNote, createDoc, createParagraph, deleteRange, docImage, exportDocx, importDocx, insertImage, insertTable, insertText, letterheadImage, letterheadOf, noteRanges, paragraphText, removeLetterhead, setLetterhead, splitParagraph } from '@rebodocs/core';
import { type CollabServer, createCollabServer } from '../src/server';
import { backendStorage } from '../src/storage';
import { type CollabHost, type HostHistory, type HostSelection, type PeerCaret, type Session, createRoom, joinRoom, pingServer } from '../src/session';

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
    if (Date.now() > end) throw new Error('nunca pasó');
    await new Promise((done) => setTimeout(done, 10));
  }
}

describe('a room', () => {
  let server: CollabServer;
  let url: string;
  let dir: string;
  let sessions: Session[];

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'collab-'));
    server = createCollabServer({ port: 0, dataDir: dir, idle: 60 });
    await server.ready;
    url = `http://127.0.0.1:${server.port}`;
    sessions = [];
  });

  afterEach(() => {
    for (const session of sessions) session.leave();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const share = (...texts: string[]) => createRoom(url, exportDocx(createDoc(texts.map((text) => createParagraph(text)))), 'prueba.docx');

  const join_ = async (room: string, name: string) => {
    const host = new Host();
    const session = joinRoom(host, room, { url, name });
    sessions.push(session);
    await until(() => session.state === 'on');
    return { host, session };
  };

  const settled = (...people: { host: Host; session: Session }[]) =>
    until(() => people.every((p) => p.session.pending === 0) && people.every((p) => JSON.stringify(p.host.texts) === JSON.stringify(people[0].host.texts)));

  it('answers to its name', async () => {
    expect(await pingServer(url)).toEqual({ token: false });
    expect(await pingServer('http://127.0.0.1:9')).toBeUndefined();
  });

  it('gives everybody the document, and what each does to the others', async () => {
    const room = await share('hola', 'mundo');
    const ana = await join_(room, 'Ana');
    const luis = await join_(room, 'Luis');
    expect(luis.host.texts).toEqual(['hola', 'mundo']);
    expect(luis.session.title).toBe('prueba.docx');
    ana.host.edit((doc) => insertText(doc, { para: 0, offset: 4 }, ' a todos').doc);
    await until(() => luis.host.texts[0] === 'hola a todos');
    luis.host.edit((doc) => splitParagraph(doc, { para: 1, offset: 5 }).doc);
    luis.host.edit((doc) => insertText(doc, { para: 2, offset: 0 }, 'fin').doc);
    await settled(ana, luis);
    expect(ana.host.texts).toEqual(['hola a todos', 'mundo', 'fin']);
  });

  it('keeps what two people type at once', async () => {
    const room = await share('uno', 'dos');
    const ana = await join_(room, 'Ana');
    const luis = await join_(room, 'Luis');
    for (let i = 0; i < 20; i++) {
      ana.host.edit((doc) => insertText(doc, { para: 0, offset: paragraphText(doc.paragraphs[0]).length }, 'a').doc);
      luis.host.edit((doc) => insertText(doc, { para: 0, offset: 0 }, 'b').doc);
      if (i % 5 === 0) await new Promise((done) => setTimeout(done, 5));
    }
    await settled(ana, luis);
    expect(ana.host.texts[0]).toBe(`${'b'.repeat(20)}uno${'a'.repeat(20)}`);
    expect(ana.host.texts[1]).toBe('dos');
  });

  it('undoes what one did and leaves what the other did', async () => {
    const room = await share('texto');
    const ana = await join_(room, 'Ana');
    const luis = await join_(room, 'Luis');
    ana.host.edit((doc) => insertText(doc, { para: 0, offset: 5 }, ' de Ana').doc);
    await settled(ana, luis);
    luis.host.edit((doc) => insertText(doc, { para: 0, offset: 0 }, 'El ').doc);
    await settled(ana, luis);
    expect(ana.host.history!.canUndo).toBe(true);
    ana.host.history!.undo();
    await settled(ana, luis);
    expect(luis.host.texts).toEqual(['El texto']);
    ana.host.history!.redo();
    await settled(ana, luis);
    expect(luis.host.texts).toEqual(['El texto de Ana']);
    // Luis has nothing of Ana's to take back, and his own is still his.
    luis.host.history!.undo();
    await settled(ana, luis);
    expect(ana.host.texts).toEqual(['texto de Ana']);
  });

  it('shows each where the other is, and keeps the place as text comes before it', async () => {
    const room = await share('hola mundo', 'segundo');
    const ana = await join_(room, 'Ana');
    const luis = await join_(room, 'Luis');
    await until(() => ana.session.peers.length === 1 && luis.session.peers.length === 1);
    expect(ana.session.peers[0].name).toBe('Luis');
    expect(ana.session.peers[0].color).not.toBe(ana.session.color);
    luis.host.move(0, 5);
    await until(() => ana.host.carets[0]?.focus.offset === 5);
    expect(ana.host.carets[0]).toMatchObject({ name: 'Luis', page: 0, focus: { para: 0, offset: 5 } });
    // Ana types before Luis's caret: his stays on the same letter, in her editor and in his.
    ana.host.edit((doc) => insertText(doc, { para: 0, offset: 0 }, '¡¡').doc);
    await settled(ana, luis);
    expect(luis.host.selection.focus).toEqual({ para: 0, offset: 7 });
    await until(() => ana.host.carets[0]?.focus.offset === 7);
    // And a paragraph above moves it down with its own.
    ana.host.edit((doc) => splitParagraph(doc, { para: 0, offset: 2 }).doc);
    await settled(ana, luis);
    expect(luis.host.selection.focus).toEqual({ para: 1, offset: 5 });
    luis.session.leave();
    await until(() => ana.session.peers.length === 0);
    expect(ana.host.carets).toEqual([]);
  });

  it('tells apart the pictures and the notes two people make at once', async () => {
    const room = await share('uno', 'dos');
    const ana = await join_(room, 'Ana');
    const luis = await join_(room, 'Luis');
    const png = (n: number) => ({ bytes: new Uint8Array([137, 80, 78, 71, n]), type: 'image/png', width: 10, height: 10 });
    // Each looked for a free name in their own document, and found the same one.
    ana.host.edit((doc) => insertImage(doc, { para: 0, offset: 0 }, png(1)).doc);
    luis.host.edit((doc) => insertImage(doc, { para: 1, offset: 0 }, png(2)).doc);
    ana.host.edit((doc) => addNote(doc, { from: { para: 0, offset: 1 }, to: { para: 0, offset: 4 } }, { text: 'de Ana', author: 'Ana' }).doc);
    luis.host.edit((doc) => addNote(doc, { from: { para: 1, offset: 1 }, to: { para: 1, offset: 4 } }, { text: 'de Luis', author: 'Luis' }).doc);
    await settled(ana, luis);
    await until(() => Object.keys(luis.host.doc.media ?? {}).length === 2 && luis.host.doc.notes?.length === 2);
    for (const { host } of [ana, luis]) {
      const pictures = host.doc.paragraphs.map((p) => docImage(host.doc, p.runs.find((run) => run.props.objectWidth)!.props.object!)!.bytes[4]);
      expect(pictures).toEqual([1, 2]);
      expect(host.doc.notes!.map((note) => note.text).sort()).toEqual(['de Ana', 'de Luis']);
      expect(new Set(host.doc.notes!.map((note) => note.id)).size).toBe(2);
      expect(noteRanges(host.doc).map((note) => note.range.from.para).sort()).toEqual([0, 1]);
    }
    // And it is still a file Word's format allows: it reads back with both of each.
    const back = importDocx(luis.host.exportDocx());
    expect(back.notes).toHaveLength(2);
    expect(back.paragraphs.filter((p) => p.runs.some((run) => run.props.objectWidth))).toHaveLength(2);
  });

  it('gives everybody the letterhead one of them puts, and takes it away for all', async () => {
    const room = await share('uno');
    const ana = await join_(room, 'Ana');
    const luis = await join_(room, 'Luis');
    const paper = new Uint8Array([137, 80, 78, 71, 5, 6, 7]);
    ana.host.edit((doc) => setLetterhead(doc, { bytes: paper, type: 'image/png' }));
    await until(() => !!letterheadOf(luis.host.doc));
    expect([...letterheadImage(luis.host.doc)!.bytes]).toEqual([...paper]);
    expect(luis.host.texts).toEqual(['uno']);
    // Whoever comes later has it too, and it is still there in the file.
    await until(() => ana.session.pending === 0);
    const eva = await join_(room, 'Eva');
    expect([...letterheadImage(eva.host.doc)!.bytes]).toEqual([...paper]);
    expect(letterheadOf(importDocx(eva.host.exportDocx()))).toBeDefined();
    luis.host.edit((doc) => removeLetterhead(doc));
    await until(() => !letterheadOf(ana.host.doc) && !letterheadOf(eva.host.doc));
  });

  it('gives whoever comes later the document as it is by then', async () => {
    const room = await share('uno');
    const ana = await join_(room, 'Ana');
    ana.host.edit((doc) => insertText(doc, { para: 0, offset: 3 }, ' y dos').doc);
    ana.host.edit((doc) => insertTable(doc, { para: 0, offset: 9 }, 2, 2).doc);
    await until(() => ana.session.pending === 0);
    const luis = await join_(room, 'Luis');
    expect(luis.host.texts).toEqual(ana.host.texts);
    expect(luis.host.doc.tables).toHaveLength(1);
  });

  it('folds the changes into the file once everybody is gone, and still has them', async () => {
    const room = await share('uno', 'dos');
    const ana = await join_(room, 'Ana');
    ana.host.edit((doc) => deleteRange(doc, { from: { para: 0, offset: 3 }, to: { para: 1, offset: 0 } }));
    ana.host.edit((doc) => insertText(doc, { para: 0, offset: 6 }, '!').doc);
    await until(() => ana.session.pending === 0);
    ana.session.leave();
    await new Promise((done) => setTimeout(done, 250));
    const luis = await join_(room, 'Luis');
    expect(luis.host.texts).toEqual(['unodos!']);
    // The server started again finds the room where it left it.
    luis.session.leave();
    server.close();
    server = createCollabServer({ port: 0, dataDir: dir, idle: 60 });
    await server.ready;
    url = `http://127.0.0.1:${server.port}`;
    const eva = await join_(room, 'Eva');
    expect(eva.host.texts).toEqual(['unodos!']);
  });

  it('ends with the same document after many edits two people make at once', async () => {
    server.close();
    server = createCollabServer({ port: 0, dataDir: dir, idle: 60, checkAfter: 20 });
    await server.ready;
    url = `http://127.0.0.1:${server.port}`;
    const room = await share('uno uno', 'dos dos', 'tres', 'cuatro');
    const ana = await join_(room, 'Ana');
    const luis = await join_(room, 'Luis');
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const pos = (doc: Doc) => {
      const para = Math.floor(next() * doc.paragraphs.length);
      return { para, offset: Math.floor(next() * (paragraphText(doc.paragraphs[para]).length + 1)) };
    };
    const anyEdit = (doc: Doc): Doc => {
      const kind = next();
      if (kind < 0.4) return insertText(doc, pos(doc), 'xy').doc;
      if (kind < 0.75) {
        let [from, to] = [pos(doc), pos(doc)];
        if (from.para > to.para || (from.para === to.para && from.offset > to.offset)) [from, to] = [to, from];
        return deleteRange(doc, { from, to });
      }
      return splitParagraph(doc, pos(doc)).doc;
    };
    for (let round = 0; round < 30; round++) {
      // Both at once, a few steps each, before either hears of the other.
      for (let step = 0; step < 3; step++) {
        ana.host.edit(anyEdit);
        luis.host.edit(anyEdit);
      }
      await settled(ana, luis);
      if (ana.host.doc.paragraphs.length < 3) ana.host.edit((doc) => insertText(splitParagraph(doc, { para: 0, offset: 0 }).doc, { para: 0, offset: 0 }, 'más texto').doc);
      await settled(ana, luis);
    }
    // Whatever the transform got wrong, both end with the room's document, ids and all.
    await until(() => ana.session.pending === 0 && luis.session.pending === 0);
    await new Promise((done) => setTimeout(done, 100));
    expect(luis.host.doc.paragraphs.map((p) => [p.id, paragraphText(p)])).toEqual(ana.host.doc.paragraphs.map((p) => [p.id, paragraphText(p)]));
    const late = await join_(room, 'Eva');
    expect(late.host.texts).toEqual(ana.host.texts);
  }, 60000);

  it('loads the room again when its document here turns out not to be the room\'s, keeping what was typed', async () => {
    server.close();
    server = createCollabServer({ port: 0, dataDir: dir, idle: 60, checkAfter: 20 });
    await server.ready;
    url = `http://127.0.0.1:${server.port}`;
    const room = await share('uno', 'dos');
    const ana = await join_(room, 'Ana');
    // Luis is given a file that is not the room's: his document is not everybody's from the start.
    const real = globalThis.fetch;
    let bases = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await real(input, init);
      if (!String(input).includes('/base?') || bases++ > 0) return response;
      const wrong = importDocx(new Uint8Array(await response.arrayBuffer()));
      return new Response(exportDocx({ ...wrong, paragraphs: [wrong.paragraphs[0], { ...wrong.paragraphs[1], runs: [{ text: 'DOS', props: wrong.paragraphs[1].runs[0].props }] }] }) as BodyInit, { headers: response.headers });
    }) as typeof fetch;
    try {
      const luis = await join_(room, 'Luis');
      expect(luis.host.texts).toEqual(['uno', 'DOS']);
      // Each goes on working: what Luis types is his, and stays.
      luis.host.edit((doc) => insertText(doc, { para: 0, offset: 3 }, ' de Luis').doc);
      ana.host.edit((doc) => insertText(doc, { para: 0, offset: 0 }, 'Ana: ').doc);
      await until(() => luis.session.resyncs > 0);
      await settled(ana, luis);
      expect(luis.host.texts).toEqual(['Ana: uno de Luis', 'dos']);
      expect(ana.host.texts).toEqual(luis.host.texts);
      expect(bases).toBe(2);
      // And then they go on as ever, without loading it again.
      luis.host.edit((doc) => insertText(doc, { para: 1, offset: 3 }, '!').doc);
      await settled(ana, luis);
      await new Promise((done) => setTimeout(done, 100));
      expect(ana.host.texts).toEqual(['Ana: uno de Luis', 'dos!']);
      expect(luis.session.resyncs + ana.session.resyncs).toBe(1);
    } finally {
      globalThis.fetch = real;
    }
  });

  it('comes back after the server went away, with what was typed meanwhile', async () => {
    const room = await share('uno');
    const ana = await join_(room, 'Ana');
    const port = server.port;
    server.close();
    await until(() => ana.session.state === 'offline');
    ana.host.edit((doc) => insertText(doc, { para: 0, offset: 3 }, ' sin red').doc);
    expect(ana.session.pending).toBeGreaterThan(0);
    server = createCollabServer({ port, dataDir: dir, idle: 60000 });
    await server.ready;
    await until(() => ana.session.state === 'on' && ana.session.pending === 0, 12000);
    const luis = await join_(room, 'Luis');
    expect(luis.host.texts).toEqual(['uno sin red']);
  }, 15000);

  it('asks for the word to start sharing when it has one, and for nothing to join', async () => {
    server.close();
    server = createCollabServer({ port: 0, token: 'una-palabra-larga' });
    await server.ready;
    url = `http://127.0.0.1:${server.port}`;
    const docx = exportDocx(createDoc([createParagraph('uno')]));
    await expect(createRoom(url, docx, 'a.docx')).rejects.toThrow('token');
    const room = await createRoom(url, docx, 'a.docx', 'una-palabra-larga');
    const ana = await join_(room, 'Ana');
    expect(ana.host.texts).toEqual(['uno']);
  });
});

describe('the documents of another system', () => {
  // The system: it has the documents, says who may edit them, and is given them back.
  const KEY = 'clave-del-sistema';
  let system: Server;
  let documents: Map<string, Uint8Array>;
  let puts: number;
  /** What each PUT said about the session, in order: nothing for those of while people work. */
  let ends: (string | undefined)[];
  let down: boolean;
  let server: CollabServer;
  let url: string;
  let sessions: Session[];

  beforeEach(async () => {
    documents = new Map([['contrato-17', exportDocx(createDoc([createParagraph('uno'), createParagraph('dos')]))]]);
    puts = 0;
    ends = [];
    down = false;
    system = createServer((req, res) => {
      const [, , id, action] = req.url!.split('/');
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        if (req.headers.authorization !== `Bearer ${KEY}`) return void res.writeHead(401).end();
        if (down) return void res.writeHead(503).end();
        if (req.method === 'POST' && action === 'access') {
          const { ticket } = JSON.parse(Buffer.concat(chunks).toString()) as { ticket: string };
          const name = { 'pase-ana': 'Ana Ruiz', 'pase-luis': 'Luis Mora' }[ticket];
          return void (name && documents.has(id) ? res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ name })) : res.writeHead(403).end());
        }
        if (req.method === 'GET') {
          const docx = documents.get(id);
          return void (docx ? res.writeHead(200, { 'X-Document-Name': encodeURIComponent('Contrato nº 17.docx') }).end(docx) : res.writeHead(404).end());
        }
        if (req.method === 'PUT') {
          documents.set(id, new Uint8Array(Buffer.concat(chunks)));
          puts++;
          ends.push(req.headers['x-rebodocs-session-end'] === '1' ? String(req.headers['x-rebodocs-authors'] ?? '') : undefined);
          return void res.writeHead(204).end();
        }
        res.writeHead(404).end();
      });
    });
    await new Promise<void>((done) => system.listen(0, '127.0.0.1', done));
    const { port } = system.address() as { port: number };
    server = createCollabServer({ port: 0, storage: backendStorage({ url: `http://127.0.0.1:${port}/documentos`, key: KEY }), idle: 60, saveEvery: 3600000 });
    await server.ready;
    url = `http://127.0.0.1:${server.port}`;
    sessions = [];
  });

  afterEach(() => {
    for (const session of sessions) session.leave();
    server.close();
    system.close();
    system.closeAllConnections();
  });

  const enter = async (room: string, ticket: string) => {
    const host = new Host();
    const session = joinRoom(host, room, { url, name: 'como me llame yo', ticket });
    sessions.push(session);
    await until(() => session.state === 'on' || session.state === 'closed');
    return { host, session };
  };
  const kept = (id: string) => importDocx(documents.get(id)!).paragraphs.map(paragraphText);

  it('opens the document the system has, for those it lets in, under the name it gives them', async () => {
    const ana = await enter('contrato-17', 'pase-ana');
    await enter('contrato-17', 'pase-luis');
    expect(ana.session.state).toBe('on');
    expect(ana.host.texts).toEqual(['uno', 'dos']);
    expect(ana.session.title).toBe('Contrato nº 17.docx');
    await until(() => ana.session.peers.length === 1);
    expect(ana.session.peers[0].name).toBe('Luis Mora');
    expect((await enter('contrato-17', 'pase-inventado')).session.state).toBe('closed');
    expect((await enter('contrato-17', '')).session.state).toBe('closed');
    expect((await enter('otro-documento', 'pase-ana')).session.state).toBe('closed');
  });

  it('says which saving ends a session of work, and who changed the document in it', async () => {
    const ana = await enter('contrato-17', 'pase-ana');
    const luis = await enter('contrato-17', 'pase-luis');
    const eva = await enter('contrato-17', 'pase-ana');
    ana.host.edit((doc) => insertText(doc, { para: 0, offset: 3 }, ' de Ana').doc);
    await until(() => ana.session.pending === 0);
    await server.flush();
    luis.host.edit((doc) => insertText(doc, { para: 1, offset: 3 }, ', Luis').doc);
    await until(() => luis.session.pending === 0);
    // Someone who only looked is not among those who changed it.
    for (const person of [ana, luis, eva]) person.session.leave();
    await until(() => puts === 2);
    expect(ends).toEqual([undefined, `${encodeURIComponent('Ana Ruiz')},${encodeURIComponent('Luis Mora')}`]);
    expect(kept('contrato-17')).toEqual(['uno de Ana', 'dos, Luis']);
    // A session where nobody changed anything gives nothing back, and keeps no version.
    const again = await enter('contrato-17', 'pase-luis');
    again.session.leave();
    await new Promise((done) => setTimeout(done, 200));
    expect(puts).toBe(2);
  });

  it('gives its files to nobody who did not come in, and lets nobody start a room of their own', async () => {
    await enter('contrato-17', 'pase-ana');
    expect((await fetch(`${url}/collab/rooms/contrato-17/base`)).status).toBe(403);
    expect((await fetch(`${url}/collab/rooms/contrato-17/docx?client=nadie`)).status).toBe(403);
    await expect(createRoom(url, exportDocx(createDoc()), 'mío.docx')).rejects.toThrow('rooms');
  });

  it('gives the document back to the system as it changes, and keeps nothing once everybody is gone', async () => {
    const ana = await enter('contrato-17', 'pase-ana');
    ana.host.edit((doc) => insertText(doc, { para: 0, offset: 3 }, ' y medio').doc);
    await until(() => ana.session.pending === 0);
    expect(kept('contrato-17')).toEqual(['uno', 'dos']);
    // What the server does every so often.
    await server.flush();
    expect(kept('contrato-17')).toEqual(['uno y medio', 'dos']);
    await server.flush();
    expect(puts).toBe(1);
    ana.host.edit((doc) => insertText(doc, { para: 1, offset: 3 }, '!').doc);
    await until(() => ana.session.pending === 0);
    ana.session.leave();
    await until(() => puts === 2);
    expect(kept('contrato-17')).toEqual(['uno y medio', 'dos!']);
    // Whoever comes next gets it from the system: changed there meanwhile, it is that one.
    documents.set('contrato-17', exportDocx(createDoc([createParagraph('otro')])));
    await new Promise((done) => setTimeout(done, 50));
    const luis = await enter('contrato-17', 'pase-luis');
    expect(luis.host.texts).toEqual(['otro']);
  });

  it('holds on to the changes while the system cannot take them', async () => {
    const ana = await enter('contrato-17', 'pase-ana');
    ana.host.edit((doc) => insertText(doc, { para: 0, offset: 3 }, '!').doc);
    await until(() => ana.session.pending === 0);
    down = true;
    const quiet = console.error;
    console.error = () => {};
    try {
      await server.flush();
      expect(kept('contrato-17')).toEqual(['uno', 'dos']);
    } finally {
      console.error = quiet;
    }
    down = false;
    await server.flush();
    expect(kept('contrato-17')).toEqual(['uno!', 'dos']);
  });
});
