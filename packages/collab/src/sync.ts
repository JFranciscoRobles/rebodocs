// What an editor knows of its room, and what was done in it that the room
// does not have yet: the whole of what keeps it in step, with no network, no
// timers and no editor. The session hands it what the server says and what
// the person does, and is told what to send and what to show.
//
// There are three heaps of changes. `confirmed` is the room's document with
// every change the server gave its place, up to `rev`. `inflight` was sent
// and waits for its place; at most one sending is on its way. `buffer` is
// what was done since, to send next. What the editor shows is `confirmed`
// with `inflight` and `buffer` made on it. When someone else's change comes,
// the two heaps are transformed against it, and so are the steps kept to
// undo, so that each still means what it meant.

import type { Doc } from '@rebodocs/core/internal';
import { type Op, type Renamed, apply, diff, digest, encode, matchIds, relabelDoc, renameIds, renameTable, transform } from './changes';
import type { Entry, Events, Hello, Presence } from './protocol';

/** A step the person can undo: the changes that undo it, and where the selection was before. */
export interface Step {
  ops: Op[];
  sel?: Presence;
}

/** A sending of changes, as it goes to the server. */
export interface Sending {
  epoch: number;
  rev: number;
  seq: number;
  ops: Op[];
}

/**
 * What was made here and not taken by the server, to make again on the room
 * as it is, once it is loaded again: of it, the first `sent` were sent as
 * `seq`. When the server folded the room's changes into its file, the ids
 * its paragraphs have there, and what there was to undo, which still is.
 */
interface Carry {
  ops: Op[];
  seq: number;
  sent: number;
  ids?: Map<string, string>;
  undo?: Step[];
  redo?: Step[];
}

/** What becomes of someone else's change made here. */
export interface Taken {
  /** Theirs, as it is made after what was done here: what carets are carried through. */
  theirs: Op[];
  /** What the editor is to show. */
  doc: Doc;
}

const renamed = (ops: Op[], tables: Renamed[]) => (tables.length ? ops.map((op) => tables.reduce(renameTable, op)) : ops);

export class Sync {
  /** The room's document as the server has it, with how many of its changes, made to which of its files. */
  confirmed: Doc | undefined;
  rev = 0;
  epoch = 0;
  /** What was sent and waits for its place, and whether the server said it took it. */
  inflight: Op[] | undefined;
  taken = false;
  /** What was done since, to send next. */
  buffer: Op[] = [];
  /** How many sendings were made: the server takes each once. */
  seq = 0;
  undo: Step[] = [];
  redo: Step[] = [];
  carry: Carry | undefined;
  /**
   * Back in a room whose changes it does not have, because they were folded
   * into its file while it was away: the room's document as it last had it,
   * and what was made here on it that the room did not take.
   */
  private behind: { doc: Doc; ops: Op[] } | undefined;
  /** How many times the document here was found not to be the room's. */
  resyncs = 0;

  /** Whether it has the room: until it does, nothing is sent and nothing taken. */
  get loaded(): boolean {
    return this.confirmed !== undefined;
  }

  /** Changes made here the server has not taken yet. */
  get pending(): number {
    return (this.inflight?.length ?? 0) + this.buffer.length + (this.carry?.ops.length ?? 0) + (this.behind?.ops.length ?? 0);
  }

  /** The room's document with what was done here on top: what the editor shows. */
  view(): Doc {
    const mine = [...(this.inflight ?? []), ...this.buffer];
    return mine.length ? apply(this.confirmed!, mine) : this.confirmed!;
  }

  // --- What the person does -------------------------------------------------------

  /** What the person did, to send. */
  add(ops: Op[]): void {
    this.buffer.push(...ops);
  }

  /** A step of the person's own: `back` undoes it. Part of the last one when `join`; what there was to redo is gone. */
  keep(back: Op[], sel: Presence | undefined, join: boolean): void {
    const top = this.undo[this.undo.length - 1];
    if (join && top) top.ops = [...back, ...top.ops];
    else this.undo.push({ ops: back, sel });
    this.redo = [];
  }

  /**
   * Undoes the last step, or redoes it, on `doc`, the editor's document, with
   * the selection at `sel`: gives the document it leaves, and where the
   * selection was when the step was made. What it changes is sent.
   */
  step(kind: 'undo' | 'redo', doc: Doc, sel: Presence | undefined): { doc: Doc; sel?: Presence } | undefined {
    const [from, to] = kind === 'undo' ? [this.undo, this.redo] : [this.redo, this.undo];
    const step = from.pop();
    if (!step) return undefined;
    const next = apply(doc, step.ops);
    to.push({ ops: diff(next, doc), sel });
    this.buffer.push(...diff(doc, next));
    return { doc: next, sel: step.sel };
  }

  // --- Sending --------------------------------------------------------------------

  /** What to send now: what is on its way and was not taken, again, or what was done since. Nothing when there is nothing, or it waits for its place. */
  next(): Sending | undefined {
    if (this.inflight ? this.taken : !this.buffer.length) return undefined;
    if (!this.inflight) {
      this.inflight = this.buffer;
      this.buffer = [];
      this.seq++;
      this.taken = false;
    }
    return { epoch: this.epoch, rev: this.rev, seq: this.seq, ops: this.inflight };
  }

  /**
   * What the server answered a sending: whether to send what there is `now`,
   * `later` (it was not taken, and not because the room moved on), or to
   * `wait` for the room, which coming back to it sorts out.
   */
  answered(sent: Sending, status: number): 'now' | 'later' | 'wait' {
    if (status === 200) {
      // Its place may have come before this answer did: then there is more to send already.
      if (this.inflight && sent.seq === this.seq) this.taken = true;
      return 'now';
    }
    // Sent to the room as it was before it was loaded again: what is in it goes now.
    if (status === 409) return sent.epoch !== this.epoch ? 'now' : 'wait';
    return 'later';
  }

  /** What was on its way when the connection went, and never got there, goes again. */
  resend(): void {
    this.taken = false;
  }

  // --- What the room does ---------------------------------------------------------

  /**
   * One change of the room, in its order. This editor's own comes back to its
   * place: the editor already shows it, unless it came back other than it was
   * sent (`doc`). Someone else's is made after what was done here.
   */
  take(entry: Entry, me: string): { own: true; doc?: Doc } | ({ own: false } & Taken) | undefined {
    if (!this.confirmed) return undefined;
    this.confirmed = apply(this.confirmed, entry.ops);
    this.rev++;
    if (entry.by === me) {
      const same = this.inflight && encode(entry.ops) === encode(this.inflight);
      this.inflight = undefined;
      this.taken = false;
      return { own: true, doc: same ? undefined : this.view() };
    }
    let theirs = entry.ops;
    const tables: Renamed[] = [];
    if (this.inflight) {
      const x = transform(this.inflight, theirs);
      this.inflight = x.second;
      theirs = x.first;
      tables.push(...x.renamed);
    }
    if (this.buffer.length) {
      const x = transform(renamed(this.buffer, tables), theirs);
      this.buffer = x.second;
      theirs = x.first;
      tables.push(...x.renamed);
    }
    // What is kept to undo is made after theirs too, from the last step back.
    for (const stack of [this.undo, this.redo]) {
      let over = theirs;
      for (let i = stack.length - 1; i >= 0; i--) {
        const x = transform(renamed(stack[i].ops, tables), over);
        stack[i].ops = x.second;
        over = x.first;
      }
    }
    return { own: false, theirs, doc: this.view() };
  }

  /** Whether the server's word on what the room's document is like says that this one is not it. */
  differs(check: Events['check']): boolean {
    return !!this.confirmed && check.epoch === this.epoch && check.rev === this.rev && digest(this.confirmed) !== check.digest;
  }

  // --- Loading the room -----------------------------------------------------------

  /** Whether what the server said on coming in follows from what it has, or the room is to be loaded from its file. */
  needsFile(hello: Hello): boolean {
    return !this.confirmed || hello.epoch !== this.epoch || hello.from !== this.rev;
  }

  /**
   * The room loaded from its file, `file`, and the changes made to it since.
   * Loaded again, what was made here and is not in the room, and what was
   * typed while it was being loaded, is made again on it; what was sent and
   * got there is in it already. Gives the document to show; `again` when it
   * was loaded again, with `relabel` for what still names paragraphs as they
   * were before the room's changes were folded into its file.
   */
  load(hello: Hello, file: Doc, me: string): { doc: Doc; again: boolean; relabel: <T>(value: T) => T } {
    if (!this.carry && this.confirmed && (this.inflight || this.buffer.length)) {
      // What the server answered it took is in the file; what it did not, is made again on it.
      this.behind = { doc: this.confirmed, ops: [...(this.inflight && !this.taken ? this.inflight : []), ...this.buffer] };
      this.inflight = undefined;
      this.buffer = [];
    }
    if (hello.from !== 0) {
      // It was given the changes since a place it is not at: it asks again, for all of them.
      this.forget();
      throw new Error('out of step');
    }
    let doc = file;
    for (const entry of hello.entries) doc = apply(doc, entry.ops);
    const kept = this.carry;
    const behind = this.behind;
    this.carry = undefined;
    this.behind = undefined;
    let relabel = <T>(value: T): T => (kept?.ids ? renameIds(value, kept.ids) : value);
    if (kept) {
      const arrived = kept.sent && hello.entries.some((entry) => entry.by === me && entry.seq === kept.seq);
      this.buffer = relabel([...kept.ops.slice(arrived ? kept.sent : 0), ...this.buffer]);
    } else if (behind) {
      // Nothing says which of the file's paragraphs are which it had: those that read the same are. What the
      // others did meanwhile is what turns the document it had into the file, and what was made here goes after it.
      const ids = matchIds(behind.doc, doc);
      relabel = <T>(value: T): T => renameIds(value, ids);
      const theirs = diff(relabelDoc(behind.doc, ids), doc);
      this.buffer = transform(relabel([...behind.ops, ...this.buffer]), theirs).second;
    } else {
      this.buffer = [];
    }
    this.confirmed = doc;
    this.epoch = hello.epoch;
    this.rev = hello.entries.length;
    this.inflight = undefined;
    this.taken = false;
    this.undo = relabel(kept?.undo ?? []);
    this.redo = relabel(kept?.redo ?? []);
    return { doc: this.view(), again: !!(kept || behind), relabel };
  }

  /**
   * Lets go of the room, to load it again, keeping what was made here that it
   * does not have. Because the document here was not the room's; or because
   * the room's changes were folded into its file, where its paragraphs have
   * the ids `ids`: then nothing that was sent is in it, and what there is to
   * undo still is.
   */
  lose(ids?: Map<string, string>): void {
    const ops = [...(this.inflight ?? []), ...this.buffer];
    if (ids) {
      this.carry = { ops, seq: this.seq, sent: 0, ids, undo: this.undo, redo: this.redo };
    } else {
      this.carry = { ops, seq: this.seq, sent: this.inflight?.length ?? 0 };
      this.resyncs++;
    }
    this.behind = undefined;
    this.forget();
    this.inflight = undefined;
    this.buffer = [];
  }

  private forget(): void {
    this.confirmed = undefined;
    this.epoch = 0;
    this.rev = 0;
  }
}
