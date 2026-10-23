// What the server and the editors say to each other, both ways: the events
// of the stream an editor listens to, and what it posts. Both sides build and
// read them with these types, so that one cannot send what the other does not
// expect without the compiler saying so.

import type { StoryPart } from '@rebodocs/core/internal';
import { type Op, decode, encode } from './changes';

export const DEFAULT_COLLAB_PORT = 7420;
/** Where everything of the server is, under its address. */
export const PREFIX = '/collab';

/** A place in the text, by the id of its paragraph. */
export interface Mark {
  id: string;
  offset: number;
}

/** Where someone's caret is: what the others draw. */
export interface Presence {
  /** The header, footer, note or text box it is in; the text when there is none. */
  part?: StoryPart;
  page: number;
  anchor: Mark;
  focus: Mark;
}

/** One sending of changes, in its place in the room. */
export interface Entry {
  /** Who made the changes, and which of their sendings it was. */
  by: string;
  seq: number;
  ops: Op[];
}

/** Someone in the room, as the others see them. */
export interface PeerInfo {
  client: string;
  name: string;
  color: string;
  sel?: Presence;
}

/** What an editor is told first, once it is in. */
export interface Hello {
  client: string;
  /** What only this editor is given: everything it sends carries it. */
  key: string;
  color: string;
  /** What it is called, by the system the document belongs to when it says. */
  as: string;
  readOnly: boolean;
  /** Which of the room's files the changes are made to, and how many there are. */
  epoch: number;
  rev: number;
  /** The name the document was shared under. */
  name: string;
  /** The changes from `from` on: those it said it lacked, or all of them. */
  from: number;
  entries: Entry[];
  peers: PeerInfo[];
}

/** The events of the stream, and what each carries. */
export interface Events {
  hello: Hello;
  /** One more change, at `rev` of the room. */
  op: Entry & { rev: number };
  presence: PeerInfo;
  leave: { client: string };
  /** What the room's document is like at a revision, for each editor to see that it has the same. */
  check: { epoch: number; rev: number; digest: string };
  /** The room's `rev` changes folded into its file, which is now `epoch`; `ids` are those its paragraphs have there that they did not have. */
  fold: { epoch: number; rev: number; ids: Record<string, string> };
  /** The system no longer lets this editor in. */
  removed: Record<string, never>;
}

export type EventName = keyof Events;
export type ServerEvent = { [K in EventName]: { event: K; data: Events[K] } }[EventName];

const NAMES = new Set<string>(['hello', 'op', 'presence', 'leave', 'check', 'fold', 'removed'] satisfies EventName[]);

/** An event as the stream carries it. */
export function eventText<K extends EventName>(event: K, data: Events[K]): string {
  return `event: ${event}\ndata: ${encode(data)}\n\n`;
}

/** An event read from the stream; nothing for one this side does not know. */
export function readEvent(event: string, data: string): ServerEvent | undefined {
  return NAMES.has(event) ? ({ event, data: decode(data) } as ServerEvent) : undefined;
}

/** What an editor posts: who it is, and the key that shows it. */
interface Signed {
  client: string;
  key: string;
}

/** Changes, made to the room as it was at `rev` of its file `epoch`; `seq` goes up with each sending. */
export interface OpsPost extends Signed {
  epoch: number;
  rev: number;
  seq: number;
  ops: Op[];
}

export interface PresencePost extends Signed {
  sel: Presence | null;
  /** What it is called now, when the system the document belongs to does not say. */
  name?: string;
}
