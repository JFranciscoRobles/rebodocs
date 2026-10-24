// The editor's side of a session: what is new in its document since the last
// look, which is what the person did; the steps they make, to undo; where
// their caret is, by paragraph id; and the others' carets, drawn. It knows
// nothing of the server: the session tells it what to show, and sends what
// it collects.

import { type Doc, type Paragraph, type Position, type StoryPart, noteMark, paragraphLength, storyOf, withStory } from '@rebodocs/core/internal';
import { type Anchor, type Op, diff, ensureIds, mapAnchor, storyPartsOf } from './changes';
import type { PeerInfo, Presence } from './protocol';
import type { Sync } from './sync';

export interface HostSelection {
  anchor: Position;
  focus: Position;
}

/** Someone else's caret, as the editor draws it. */
export interface PeerCaret {
  name: string;
  /** Hex RGB without '#'. */
  color: string;
  /** The header or footer it is in, and the page it is being edited on; the text when there is none. */
  part?: StoryPart;
  page: number;
  anchor: Position;
  focus: Position;
}

/** What undoing asks of whoever keeps the steps. */
export interface HostHistory {
  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/** What it needs of an editor: `Editor` of @rebodocs/editor is one. */
export interface CollabHost {
  doc: Doc;
  selection: HostSelection;
  /** Where the selection is: the part when it is a header or a footer, and the page it is edited on. */
  readonly place: { part?: StoryPart; page: number };
  /** How many changes the person made, and how many of them were steps of their own to undo. */
  readonly commits: number;
  readonly steps: number;
  /** Who undoes, in place of the editor. */
  history?: HostHistory;
  onChange(listener: () => void): () => void;
  load(doc: Doc): void;
  /** Shows another document in place of the one it has, which someone else changed: not a step to undo, and the view stays where it is unless `reveal`. */
  replace(doc: Doc, selection: HostSelection, reveal?: boolean): void;
  setPeers(peers: PeerCaret[]): void;
  exportDocx(): Uint8Array<ArrayBuffer>;
}

const paragraphsOf = (doc: Doc, part: StoryPart | undefined): Paragraph[] => (part ? (storyOf(doc, part)?.paragraphs ?? []) : doc.paragraphs);

/** Where places kept by id are in a document, part by part. */
function finder(doc: Doc) {
  const maps = new Map<string, Map<string, number>>();
  return (part: StoryPart | undefined, mark: { id: string; offset: number }): Position | undefined => {
    let map = maps.get(part ?? '');
    const paragraphs = paragraphsOf(doc, part);
    if (!map) {
      map = new Map(paragraphs.map((p, i) => [p.id ?? '', i]));
      maps.set(part ?? '', map);
    }
    const para = map.get(mark.id);
    return para === undefined ? undefined : { para, offset: Math.max(0, Math.min(mark.offset, paragraphLength(paragraphs[para]))) };
  };
}

/** A place carried through changes made before it. */
export function through(sel: Presence, ops: Op[]): Presence {
  let anchor: Anchor = { ...sel.anchor, ...(sel.part ? { part: sel.part } : {}) };
  let focus: Anchor = { ...sel.focus, ...(sel.part ? { part: sel.part } : {}) };
  for (const op of ops) {
    anchor = mapAnchor(anchor, op);
    focus = mapAnchor(focus, op);
  }
  return { ...sel, anchor: { id: anchor.id, offset: anchor.offset }, focus: { id: focus.id, offset: focus.offset } };
}

export class Mirror {
  /** The editor's document the last time it was looked at: what is new in it since is what the person did. */
  shadow: Doc | undefined;
  /** Where the selection was the last time it moved: where it goes back to when the next step is undone. */
  lastSel: Presence | undefined;
  /** The others in the room, and where each is. */
  readonly peers = new Map<string, PeerInfo>();
  private seenCommits: number;
  private seenSteps: number;
  /** While it puts a document in the editor: what the editor says changed then is not the person's. */
  private applying = false;
  private minted = 0;

  constructor(
    private readonly host: CollabHost,
    private readonly sync: Sync,
    /** The id this editor is in the room with, of which new paragraphs, pictures and notes are named. */
    private readonly me: () => string,
  ) {
    this.seenCommits = host.commits;
    this.seenSteps = host.steps;
  }

  /** Whether what the editor says changed is to be looked at: it shows a room's document, and not one being put in it. */
  get listening(): boolean {
    return !this.applying && this.shadow !== undefined;
  }

  private mint = () => `${this.me().slice(0, 6)}.${(this.minted++).toString(36)}`;

  /** Where the selection is, by paragraph id. */
  here(): Presence | undefined {
    const { part, page } = this.host.place;
    const paragraphs = paragraphsOf(this.host.doc, part);
    const mark = (pos: Position) => {
      const id = paragraphs[pos.para]?.id;
      return id === undefined ? undefined : { id, offset: pos.offset };
    };
    const anchor = mark(this.host.selection.anchor);
    const focus = mark(this.host.selection.focus);
    return anchor && focus ? { ...(part ? { part } : {}), page, anchor, focus } : undefined;
  }

  /** The selection is where it is now, for the next step to go back to. */
  moved(): void {
    this.lastSel = this.here();
  }

  /** Takes what the person did since the last look, for the session to send; says whether there was anything. */
  collect(): boolean {
    const { host, shadow } = this;
    if (!shadow || host.doc === shadow) return false;
    const next = ensureIds(shadow, this.unique(shadow, host.doc), this.mint);
    if (next !== host.doc) host.doc = next;
    const ops = diff(shadow, next);
    if (ops.length && host.commits !== this.seenCommits) this.sync.keep(diff(next, shadow), this.lastSel, host.steps === this.seenSteps);
    this.seen();
    this.shadow = next;
    this.sync.add(ops);
    return ops.length > 0;
  }

  /** Shows the room's document as it is first loaded. */
  load(doc: Doc): void {
    this.putting(() => {
      this.shadow = doc;
      this.host.load(doc);
    });
    this.seen();
  }

  /** Shows a document in place of the editor's, with the selection at `sel` when it is still there. */
  show(doc: Doc, sel: Presence | undefined, reveal = false): void {
    this.putting(() => {
      this.shadow = doc;
      this.host.replace(doc, this.selectionIn(doc, sel), reveal);
    });
    // Showing it may have changed it: a header being edited that someone else took away comes back, empty.
    this.collect();
    this.moved();
    this.seen();
    this.showPeers();
  }

  /** Undoes or redoes a step of the person's own; says whether there was one. */
  step(kind: 'undo' | 'redo'): boolean {
    this.collect();
    if (!this.shadow) return false;
    const done = this.sync.step(kind, this.shadow, this.here());
    if (done) this.show(done.doc, done.sel, true);
    return !!done;
  }

  // --- The others -----------------------------------------------------------------

  /** The others' carets carried through a change made before them, but for the one who made it. */
  carryPeers(ops: Op[], but: string): void {
    for (const peer of this.peers.values()) if (peer.client !== but && peer.sel) peer.sel = through(peer.sel, ops);
  }

  /** The others' carets renamed, for paragraphs given other ids. */
  relabelPeers(relabel: <T>(value: T) => T): void {
    for (const peer of this.peers.values()) if (peer.sel) peer.sel = relabel(peer.sel);
  }

  showPeers(): void {
    const find = finder(this.host.doc);
    const carets: PeerCaret[] = [];
    for (const peer of this.peers.values()) {
      if (!peer.sel) continue;
      const anchor = find(peer.sel.part, peer.sel.anchor);
      const focus = find(peer.sel.part, peer.sel.focus);
      if (anchor && focus) carets.push({ name: peer.name, color: peer.color, ...(peer.sel.part ? { part: peer.sel.part } : {}), page: peer.sel.page, anchor, focus });
    }
    this.host.setPeers(carets);
  }

  // --- Inside ---------------------------------------------------------------------

  private putting(put: () => void): void {
    this.applying = true;
    try {
      put();
    } finally {
      this.applying = false;
    }
  }

  private seen(): void {
    this.seenCommits = this.host.commits;
    this.seenSteps = this.host.steps;
  }

  /** The selection the editor is to have in `doc`: `sel` when it is still there, or its own, as near as it can be. */
  private selectionIn(doc: Doc, sel: Presence | undefined): HostSelection {
    const { part } = this.host.place;
    const find = finder(doc);
    const anchor = sel && sel.part === part ? find(part, sel.anchor) : undefined;
    const focus = sel && sel.part === part ? find(part, sel.focus) : undefined;
    return anchor && focus ? { anchor, focus } : this.host.selection;
  }

  /**
   * Two people making a picture or a note at once would give them the same
   * name, which each only looked for in their own document. The new ones are
   * named again, with something of this editor in the name.
   */
  private unique(before: Doc, after: Doc): Doc {
    let doc = after;
    const rewrite = (change: (xml: string) => string | undefined) => {
      const fix = (paragraphs: Paragraph[]): Paragraph[] => {
        let out: Paragraph[] | undefined;
        paragraphs.forEach((p, i) => {
          if (!p.runs.some((run) => run.props.object && change(run.props.object) !== undefined)) return;
          out ??= paragraphs.slice();
          out[i] = { ...p, runs: p.runs.map((run) => (run.props.object && change(run.props.object) !== undefined ? { ...run, props: { ...run.props, object: change(run.props.object) } } : run)) };
        });
        return out ?? paragraphs;
      };
      doc = { ...doc, paragraphs: fix(doc.paragraphs) };
      for (const part of storyPartsOf(doc)) {
        const story = storyOf(doc, part);
        if (!story) continue;
        const paragraphs = fix(story.paragraphs);
        if (paragraphs !== story.paragraphs) doc = withStory(doc, part, { ...story, paragraphs });
      }
    };
    if (after.media !== before.media) {
      for (const key of Object.keys(after.media ?? {})) {
        if (before.media?.[key] || key.includes('.')) continue;
        const named = `${key}.${this.mint()}`;
        const { [key]: bytes, ...rest } = doc.media!;
        doc = { ...doc, media: { ...rest, [named]: bytes } };
        rewrite((xml) => (xml.includes(`"dx:${key}"`) ? xml.split(`"dx:${key}"`).join(`"dx:${named}"`) : undefined));
      }
    }
    if (after.notes !== before.notes) {
      const had = new Set((before.notes ?? []).map((note) => note.id));
      for (const note of after.notes ?? []) {
        if (had.has(note.id) || note.id.length >= 9) continue;
        const named = String(100000000 + Math.floor(Math.random() * 899999999));
        doc = { ...doc, notes: doc.notes!.map((n) => (n.id === note.id ? { ...n, id: named } : n)) };
        rewrite((xml) => (noteMark(xml)?.id === note.id ? xml.split(`w:id="${note.id}"`).join(`w:id="${named}"`) : undefined));
      }
    }
    return doc;
  }
}
