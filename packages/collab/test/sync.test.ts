// What keeps an editor in step with its room, without a server: what it
// sends and when, what becomes of the others' changes made here, and the
// room loaded again, keeping what was done here.

import { describe, expect, it } from 'vitest';
import { type Doc, createDoc, createParagraph, insertText, paragraphText, splitParagraph } from '@rebodocs/core/internal';
import { diff, ensureIds, restamp, stampIds } from '../src/changes';
import type { Hello } from '../src/protocol';
import { Sync } from '../src/sync';

const room = (...texts: string[]) => stampIds(createDoc(texts.map((text) => createParagraph(text))));
const texts = (doc: Doc) => doc.paragraphs.map(paragraphText);
const hello = (more: Partial<Hello> = {}): Hello => ({ client: 'yo', key: 'k', color: 'E8710A', as: '', readOnly: false, epoch: 1, rev: 0, name: 'a.docx', from: 0, entries: [], peers: [], ...more });

/** A sync with the room loaded, and a way to do something in it as the person. */
function joined(...paragraphs: string[]) {
  const sync = new Sync();
  sync.load(hello(), room(...paragraphs), 'yo');
  let n = 0;
  const edit = (change: (doc: Doc) => Doc) => {
    const before = sync.view();
    const after = ensureIds(before, change(before), () => `yo.${n++}`);
    sync.add(diff(before, after));
    sync.keep(diff(after, before), undefined, false);
  };
  return { sync, edit };
}

describe('the sync of an editor with its room', () => {
  it('has one sending on its way at a time, and sends what came meanwhile once it has its place', () => {
    const { sync, edit } = joined('uno');
    expect(sync.next()).toBeUndefined();
    edit((doc) => insertText(doc, { para: 0, offset: 3 }, ' dos').doc);
    const first = sync.next()!;
    expect(first).toMatchObject({ epoch: 1, rev: 0, seq: 1 });
    // Not answered yet: the same goes again, for a connection that dropped.
    expect(sync.next()).toEqual(first);
    expect(sync.answered(first, 200)).toBe('now');
    edit((doc) => insertText(doc, { para: 0, offset: 7 }, ' tres').doc);
    // Taken, it waits for its place before the next.
    expect(sync.next()).toBeUndefined();
    expect(sync.pending).toBe(2);
    expect(sync.take({ by: 'yo', seq: 1, ops: first.ops }, 'yo')).toEqual({ own: true, doc: undefined });
    expect(sync.next()).toMatchObject({ rev: 1, seq: 2 });
    expect(texts(sync.view())).toEqual(['uno dos tres']);
  });

  it('says what to do with each answer', () => {
    const { sync, edit } = joined('uno');
    edit((doc) => insertText(doc, { para: 0, offset: 0 }, 'x').doc);
    const sent = sync.next()!;
    expect(sync.answered(sent, 503)).toBe('later');
    expect(sync.answered(sent, 0)).toBe('later');
    expect(sync.answered(sent, 409)).toBe('wait');
    // Sent to the room before it was loaded again: what there is now goes at once.
    sync.lose(new Map());
    sync.load(hello({ epoch: 2 }), room('uno'), 'yo');
    expect(sync.answered(sent, 409)).toBe('now');
    expect(sync.next()).toMatchObject({ epoch: 2, rev: 0 });
  });

  it("makes the others' changes after what was done here, and keeps what to undo in step", () => {
    const { sync, edit } = joined('uno');
    edit((doc) => insertText(doc, { para: 0, offset: 3 }, ' mío').doc);
    const sent = sync.next()!;
    edit((doc) => insertText(doc, { para: 0, offset: 7 }, '!').doc);
    const theirs = diff(room('uno'), insertText(room('uno'), { para: 0, offset: 0 }, 'El ').doc);
    const taken = sync.take({ by: 'otro', seq: 1, ops: theirs }, 'yo');
    if (taken?.own !== false) throw new Error('taken as its own');
    expect(texts(taken.doc)).toEqual(['El uno mío!']);
    expect(texts(sync.confirmed!)).toEqual(['El uno']);
    // What was on its way is now made after theirs, and so is what is undone.
    expect(sync.inflight).not.toBe(sent.ops);
    const undone = sync.step('undo', taken.doc, undefined)!;
    expect(texts(undone.doc)).toEqual(['El uno mío']);
    expect(sync.redo).toHaveLength(1);
  });

  it('finds that its document is not the room’s by the digest the server sends', () => {
    const { sync } = joined('uno');
    expect(sync.differs({ epoch: 1, rev: 0, digest: 'otra cosa' })).toBe(true);
    // Of another revision, or another file, it says nothing.
    expect(sync.differs({ epoch: 1, rev: 3, digest: 'otra cosa' })).toBe(false);
    expect(sync.differs({ epoch: 2, rev: 0, digest: 'otra cosa' })).toBe(false);
  });

  it('loads the room again, and makes on it again only what did not get there', () => {
    const { sync, edit } = joined('uno');
    edit((doc) => insertText(doc, { para: 0, offset: 3 }, ' a').doc);
    const sent = sync.next()!;
    edit((doc) => insertText(doc, { para: 0, offset: 5 }, ' b').doc);
    sync.lose();
    expect(sync.loaded).toBe(false);
    expect(sync.resyncs).toBe(1);
    expect(sync.pending).toBe(2);
    // The room has the sending that was on its way.
    const loaded = sync.load(hello({ entries: [{ by: 'yo', seq: sent.seq, ops: sent.ops }] }), room('uno'), 'yo');
    expect(loaded.again).toBe(true);
    expect(texts(loaded.doc)).toEqual(['uno a b']);
    expect(sync.buffer).toHaveLength(1);
    expect(sync.rev).toBe(1);
    expect(sync.undo).toEqual([]);
  });

  it('goes on, under the new ids, once the room’s changes are folded into its file', () => {
    const { sync, edit } = joined('uno');
    edit((doc) => splitParagraph(doc, { para: 0, offset: 2 }).doc);
    const sent = sync.next()!;
    sync.answered(sent, 200);
    sync.take({ by: 'yo', seq: sent.seq, ops: sent.ops }, 'yo');
    expect(sync.confirmed!.paragraphs.map((p) => p.id)).toEqual(['p0', 'yo.0']);
    // Typed in the new paragraph, and not sent, when the server folds.
    edit((doc) => insertText(doc, { para: 1, offset: 1 }, '+').doc);
    const ids = restamp(sync.confirmed!);
    expect([...ids]).toEqual([['yo.0', 'p1']]);
    sync.lose(ids);
    expect(sync.resyncs).toBe(0);
    const file = room('un', 'o');
    const { doc } = sync.load(hello({ epoch: 2 }), file, 'yo');
    expect(texts(doc)).toEqual(['un', 'o+']);
    expect(sync.buffer.every((op) => !JSON.stringify(op).includes('yo.0'))).toBe(true);
    // What can be undone still is, and names the paragraphs as the file does.
    expect(texts(sync.step('undo', doc, undefined)!.doc)).toEqual(['un', 'o']);
  });

  it('keeps what was typed away from a room whose changes were folded into its file meanwhile', () => {
    const { sync, edit } = joined('uno', 'dos');
    edit((doc) => insertText(doc, { para: 1, offset: 3 }, '!').doc);
    edit((doc) => splitParagraph(doc, { para: 1, offset: 4 }).doc);
    edit((doc) => insertText(doc, { para: 2, offset: 0 }, 'tres').doc);
    sync.answered(sync.next()!, 0);
    // Meanwhile the others put a paragraph first and wrote in the first one; the room was folded, and read again.
    const file = room('nuevo', 'uno y más', 'dos');
    // Given the changes since a place it is not at first, it asks again, and keeps what it had all the same.
    expect(() => sync.load(hello({ epoch: 2, from: 3 }), file, 'yo')).toThrow('out of step');
    expect(sync.pending).toBe(3);
    const { doc, again } = sync.load(hello({ epoch: 2 }), file, 'yo');
    expect(again).toBe(true);
    expect(texts(doc)).toEqual(['nuevo', 'uno y más', 'dos!', 'tres']);
    expect(texts(sync.confirmed!)).toEqual(['nuevo', 'uno y más', 'dos']);
    expect(sync.next()).toMatchObject({ epoch: 2, rev: 0 });
  });

  it('does not make again what the server said it took before the room was folded', () => {
    const { sync, edit } = joined('uno');
    edit((doc) => insertText(doc, { para: 0, offset: 3 }, '!').doc);
    sync.answered(sync.next()!, 200);
    const { doc } = sync.load(hello({ epoch: 2 }), room('uno!'), 'yo');
    expect(texts(doc)).toEqual(['uno!']);
    expect(sync.pending).toBe(0);
  });

  it('asks for every change again when it was given those since a place it is not at', () => {
    const { sync } = joined('uno');
    expect(() => sync.load(hello({ from: 3 }), room('uno'), 'yo')).toThrow('out of step');
    expect(sync.loaded).toBe(false);
    expect(sync.needsFile(hello())).toBe(true);
  });
});
