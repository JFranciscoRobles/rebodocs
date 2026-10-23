// A room without a server around it: who it lets in, what it takes of each,
// and what it tells everybody, written to streams that are lists.

import { describe, expect, it } from 'vitest';
import { createDoc, createParagraph, exportDocx, insertText } from '@rebodocs/core/internal';
import { diff, stampIds } from '../src/changes';
import { type CollabEvent, type Listener, Room, type RoomContext } from '../src/room';
import { memoryStorage } from '../src/storage';

const file = () => exportDocx(createDoc([createParagraph('uno')]));

function newRoom() {
  const events: CollabEvent[] = [];
  const ctx: RoomContext = {
    storage: memoryStorage(),
    idle: 60,
    foldAfter: 1000,
    saveAfter: 5000,
    saveEvery: 30000,
    checkAfter: 60000,
    emit: (e) => events.push(e),
    closed: () => false,
    forget: () => {},
  };
  const made = new Room('sala-de-prueba', { name: 'a.docx', epoch: 1, base: file(), log: [] }, ctx);
  /** Someone in it, with what they are told. */
  const enter = (id: string, pass: { name?: string; readOnly?: boolean } = {}) => {
    const heard: string[] = [];
    const stream: Listener = { write: (text) => heard.push(text.split('\n')[0].slice(7)), end: () => heard.push('end') };
    const hello = made.join(id, null, '', pass, id, stream, { epoch: 0, from: 0 })!;
    return { hello, heard, client: made.clients.get(id)!, stream };
  };
  return { room: made, events, enter };
}

const ops = () => {
  const doc = stampIds(createDoc([createParagraph('uno')]));
  return diff(doc, insertText(doc, { para: 0, offset: 3 }, '!').doc);
};

describe('a room', () => {
  it('gives each a key of their own, and lets nobody back with an id that is not theirs', () => {
    const { room, enter } = newRoom();
    const ana = enter('ana');
    expect(ana.hello).toMatchObject({ client: 'ana', epoch: 1, rev: 0, entries: [], peers: [] });
    expect(room.signed('ana', ana.hello.key)).toBe(ana.client);
    expect(room.signed('ana', 'otra')).toBeUndefined();
    expect(room.join('ana', 'otra', '', {}, 'Falsa', { write() {}, end() {} }, { epoch: 0, from: 0 })).toBeUndefined();
    expect(room.clients.get('ana')!.name).toBe('ana');
  });

  it('takes a change once, tells the others, and takes none from whoever only watches', () => {
    const { room, enter, events } = newRoom();
    const ana = enter('ana');
    const eva = enter('eva', { readOnly: true });
    expect(room.take(ana.client, { epoch: 1, rev: 0, seq: 1, ops: ops() })).toBe('ok');
    expect(room.take(ana.client, { epoch: 1, rev: 0, seq: 1, ops: ops() })).toBe('ok');
    expect(room.log).toHaveLength(1);
    expect(eva.heard).toContain('op');
    expect(room.take(eva.client, { epoch: 1, rev: 0, seq: 1, ops: ops() })).toBe('read-only');
    expect(room.take(ana.client, { epoch: 2, rev: 0, seq: 2, ops: ops() })).toBe('stale');
    expect(room.take(ana.client, { epoch: 1, rev: 5, seq: 2, ops: ops() })).toBe('stale');
    expect(events.map((e) => e.type)).toEqual(['join', 'join']);
  });

  it('lets each send only so much at once', () => {
    const { room, enter } = newRoom();
    const ana = enter('ana');
    let allowed = 0;
    while (room.allows(ana.client) && allowed < 1000) allowed++;
    expect(allowed).toBe(200);
  });

  it('tells the others who leaves, and folds the changes once nobody is in it', async () => {
    const { room, enter, events } = newRoom();
    const ana = enter('ana');
    const luis = enter('luis');
    room.take(ana.client, { epoch: 1, rev: 0, seq: 1, ops: ops() });
    room.leave(ana.client, ana.stream);
    expect(luis.heard).toContain('leave');
    room.leave(luis.client, luis.stream);
    await new Promise((done) => setTimeout(done, 120));
    expect(room.epoch).toBe(2);
    expect(room.log).toEqual([]);
    expect(events.map((e) => e.type)).toEqual(['join', 'join', 'leave', 'leave', 'fold']);
  });
});
