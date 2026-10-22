'use client';

// Two real editors in one room, on this page. The change format — stampIds,
// ensureIds, diff, transform, apply, mapAnchor, digest — is @rebodocs/collab's
// own; what carries the changes between them is a few lines here that do what
// joinRoom and the server do (session.ts, server.ts), with the network in
// memory so it can be held, and the order chosen.

import { type Op, apply, diff, digest, encode, ensureIds, mapAnchor, stampIds, transform } from '@rebodocs/collab';
import { type Doc, type Paragraph, createDoc, setParagraphStyle } from '@rebodocs/core';
import { type Editor, DocsProvider, DocsSurface, setLocale, useDocs } from '@rebodocs/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CAPTION } from '../styles';
import { SCENARIOS } from './data';

setLocale('en');

export const SCENARIO_EVENT = 'collab-scenario';

const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });
const START: Doc = setParagraphStyle(
  createDoc([p('Reservation receipt'), p('Payment is due within 15 days of this receipt.'), p('Late payments add a fee.'), p('Either party may cancel in writing.'), p('Signed, Ana')]),
  0,
  0,
  'Title',
);

type Who = 'Ana' | 'Luis';
const PEOPLE: { who: Who; color: string }[] = [
  { who: 'Ana', color: 'E8710A' },
  { who: 'Luis', color: '1A73E8' },
];

interface Mark {
  id: string;
  offset: number;
}
interface Client {
  who: Who;
  color: string;
  editor?: Editor;
  /** The document as the server has given it, and how many of its changes went into it. */
  confirmed: Doc;
  rev: number;
  /** Sent and not yet given its place; done since and not sent. */
  inflight?: Op[];
  buffer: Op[];
  /** The editor's document the last time it was looked at. */
  shadow: Doc;
  applying: boolean;
  minted: number;
  /** What is on its way to the server: held while the network is. */
  outbox: { rev: number; ops: Op[] }[];
  /** Each step of this person's own, as the changes that take it back: undo is theirs alone. */
  undo: Op[][];
  redo: Op[][];
  seenCommits: number;
  seenSteps: number;
}
interface Logged {
  by: Who;
  ops: Op[];
  /** The ops as their author sent them, when the server had to move them over others first. */
  sent?: Op[];
  over: number;
}

/** One operation, as a line of the log. */
function said(op: Op): string {
  const text = (runs: { text: string }[]) => JSON.stringify(runs.map((run) => run.text).join(''));
  switch (op.t) {
    case 'splice':
      return `${op.format ? 'format' : 'splice'} ${op.id} at ${op.at}${op.remove ? `, take out ${op.remove}` : ''}${op.insert.length && !op.format ? `, put in ${text(op.insert)}` : ''}`;
    case 'split':
      return `split ${op.id} at ${op.at} → ${op.newId}`;
    case 'join':
      return `join ${op.next} onto ${op.id}`;
    case 'insert':
      return `insert ${op.paras.length} after ${op.after ?? 'the start'}`;
    case 'delete':
      return `delete ${op.id}`;
    case 'para':
      return `paragraph ${op.id}: ${Object.keys(op.props ?? {}).join(', ') || 'cell'}`;
    default:
      return op.t;
  }
}

/** Ids for what the editor shows: the same for everybody, from the file. */
const paragraphsOf = (doc: Doc) => doc.paragraphs;
const markOf = (doc: Doc, pos: { para: number; offset: number }): Mark | undefined => {
  const id = paragraphsOf(doc)[pos.para]?.id;
  return id === undefined ? undefined : { id, offset: pos.offset };
};
const placeOf = (doc: Doc, mark: Mark) => {
  const para = paragraphsOf(doc).findIndex((q) => q.id === mark.id);
  if (para < 0) return undefined;
  const length = paragraphsOf(doc)[para].runs.reduce((n, run) => n + run.text.length, 0);
  return { para, offset: Math.max(0, Math.min(mark.offset, length)) };
};

function useRoom() {
  const [, setTick] = useState(0);
  const redraw = useCallback(() => setTick((n) => n + 1), []);
  const clients = useRef<Client[]>(PEOPLE.map(({ who, color }) => ({ who, color, confirmed: START, rev: 0, buffer: [], shadow: START, applying: false, minted: 0, outbox: [], undo: [], redo: [], seenCommits: 0, seenSteps: 0 })));
  const room = useRef<{ doc: Doc; log: Logged[] }>({ doc: START, log: [] });
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const here = (c: Client) => {
    if (!c.editor) return undefined;
    const anchor = markOf(c.editor.doc, c.editor.selection.anchor);
    const focus = markOf(c.editor.doc, c.editor.selection.focus);
    return anchor && focus ? { anchor, focus } : undefined;
  };
  const through = (sel: { anchor: Mark; focus: Mark }, ops: Op[]) => {
    let { anchor, focus } = sel;
    for (const op of ops) {
      anchor = mapAnchor(anchor, op);
      focus = mapAnchor(focus, op);
    }
    return { anchor, focus };
  };

  const showPeers = () => {
    for (const c of clients.current) {
      const other = clients.current.find((o) => o !== c)!;
      const sel = here(other);
      if (!c.editor || !sel) continue;
      const anchor = placeOf(c.editor.doc, sel.anchor);
      const focus = placeOf(c.editor.doc, sel.focus);
      c.editor.setPeers(anchor && focus ? [{ name: other.who, color: other.color, page: c.editor.currentPage, anchor, focus }] : []);
    }
  };

  const show = (c: Client, doc: Doc, sel?: { anchor: Mark; focus: Mark }) => {
    if (!c.editor) return;
    c.applying = true;
    try {
      c.shadow = doc;
      const fallback = c.editor.selection;
      const anchor = sel && placeOf(doc, sel.anchor);
      const focus = sel && placeOf(doc, sel.focus);
      c.editor.replace(doc, anchor && focus ? { anchor, focus } : fallback);
    } finally {
      c.applying = false;
    }
    c.seenCommits = c.editor.commits;
    c.seenSteps = c.editor.steps;
  };

  // The server: each batch moved over what its author had not seen, put in the log, and told to everybody.
  const receive = (c: Client, sent: { rev: number; ops: Op[] }) => {
    const r = room.current;
    const missed = r.log.slice(sent.rev).flatMap((entry) => entry.ops);
    const ops = transform(sent.ops, missed).second;
    const entry: Logged = { by: c.who, ops, over: r.log.length - sent.rev, ...(missed.length && encode(ops) !== encode(sent.ops) ? { sent: sent.ops } : {}) };
    r.log.push(entry);
    r.doc = apply(r.doc, ops);
    for (const each of clients.current) take(each, entry);
  };

  const flush = (c: Client) => {
    if (c.inflight || !c.buffer.length) return;
    c.inflight = c.buffer;
    c.buffer = [];
    c.outbox.push({ rev: c.rev, ops: c.inflight });
    if (!pausedRef.current) deliver([c.who]);
  };

  const syncLocal = (c: Client) => {
    if (!c.editor || c.editor.doc === c.shadow) return;
    const next = ensureIds(c.shadow, c.editor.doc, () => `${c.who[0].toLowerCase()}.${(c.minted++).toString(36)}`);
    if (next !== c.editor.doc) c.editor.doc = next;
    const ops = diff(c.shadow, next);
    if (ops.length && c.editor.commits !== c.seenCommits) {
      const back = diff(next, c.shadow);
      const top = c.undo[c.undo.length - 1];
      if (c.editor.steps !== c.seenSteps || !top) c.undo.push(back);
      else c.undo[c.undo.length - 1] = [...back, ...top];
      c.redo = [];
    }
    c.seenCommits = c.editor.commits;
    c.seenSteps = c.editor.steps;
    c.shadow = next;
    c.buffer.push(...ops);
    flush(c);
  };

  /** Undo or redo of one person: their step taken back, as one more change sent to the others. */
  const step = (c: Client, from: Op[][], to: Op[][]) => {
    syncLocal(c);
    const taken = from.pop();
    if (!taken) return;
    const next = apply(c.shadow, taken);
    to.push(diff(next, c.shadow));
    c.buffer.push(...diff(c.shadow, next));
    show(c, next);
    flush(c);
    showPeers();
    redraw();
  };

  // A client: its own change in its place, or someone else's made on what it has.
  const take = (c: Client, entry: Logged) => {
    c.confirmed = apply(c.confirmed, entry.ops);
    c.rev++;
    if (entry.by === c.who) {
      const same = c.inflight && encode(entry.ops) === encode(c.inflight);
      c.inflight = undefined;
      if (!same) show(c, c.buffer.length ? apply(c.confirmed, c.buffer) : c.confirmed, here(c));
      flush(c);
      return;
    }
    syncLocal(c);
    const sel = here(c);
    let theirs = entry.ops;
    if (c.inflight) {
      const x = transform(c.inflight, theirs);
      c.inflight = x.second;
      theirs = x.first;
    }
    if (c.buffer.length) {
      const x = transform(c.buffer, theirs);
      c.buffer = x.second;
      theirs = x.first;
    }
    // What is kept to undo is made after theirs too, from the last step back: undoing never takes theirs.
    for (const stack of [c.undo, c.redo]) {
      let over = theirs;
      for (let i = stack.length - 1; i >= 0; i--) {
        const x = transform(stack[i], over);
        stack[i] = x.second;
        over = x.first;
      }
    }
    const mine = [...(c.inflight ?? []), ...c.buffer];
    show(c, mine.length ? apply(c.confirmed, mine) : c.confirmed, sel && through(sel, theirs));
  };

  /** Lets what is waiting through, the people in `order` first, until nothing is waiting. */
  const deliver = (order: Who[]) => {
    for (let guard = 0; guard < 50; guard++) {
      const next = [...order, ...PEOPLE.map((x) => x.who)].map((who) => clients.current.find((c) => c.who === who)!).find((c) => c.outbox.length);
      if (!next) break;
      receive(next, next.outbox.shift()!);
    }
    showPeers();
    redraw();
  };

  const attach = (who: Who, editor: Editor) => {
    const c = clients.current.find((x) => x.who === who)!;
    c.editor = editor;
    editor.history = {
      undo: () => step(c, c.undo, c.redo),
      redo: () => step(c, c.redo, c.undo),
      get canUndo() {
        return c.undo.length > 0;
      },
      get canRedo() {
        return c.redo.length > 0;
      },
    };
    reset(c);
    editor.setFit('width');
    const stop = editor.onChange(() => {
      if (c.applying) return;
      syncLocal(c);
      showPeers();
      redraw();
    });
    return stop;
  };

  /** Everybody back to the file the room started from: what they could undo starts over. */
  const reset = (only?: Client) => {
    const base = stampIds(START);
    if (!only || !room.current.log.length) room.current = { doc: base, log: [] };
    for (const c of only ? [only] : clients.current) {
      c.rev = 0;
      c.inflight = undefined;
      c.buffer = [];
      c.outbox = [];
      c.undo = [];
      c.redo = [];
      c.confirmed = base;
      c.shadow = base;
      if (!c.editor) continue;
      c.applying = true;
      try {
        c.editor.load(base);
        c.editor.setSelection({ para: 1, offset: 0 });
      } finally {
        c.applying = false;
      }
      c.shadow = c.editor.doc;
      c.seenCommits = c.editor.commits;
      c.seenSteps = c.editor.steps;
    }
    showPeers();
    redraw();
  };

  /** Sets up a case of the table: the network held, and what each of them does. */
  const play = (key: string) => {
    const scenario = SCENARIOS.find((s) => s.key === key);
    const [ana, luis] = clients.current;
    if (!scenario || !ana.editor || !luis.editor) return;
    reset();
    setPaused(true);
    pausedRef.current = true;
    scenario.ana(ana.editor);
    scenario.luis(luis.editor);
    showPeers();
    redraw();
  };

  /** The network live again, and what was held let through. */
  const resume = () => {
    setPaused(false);
    pausedRef.current = false;
    deliver([]);
  };

  return { clients: clients.current, room: room.current, paused, setPaused, deliver, attach, reset, play, resume };
}

function Side({ who, attach }: { who: Who; attach: (who: Who, editor: Editor) => () => void }) {
  const { editor } = useDocs();
  useEffect(() => (editor ? attach(who, editor) : undefined), [editor, who, attach]);
  return null;
}

/** Two people in one room, with the network between them in your hands. */
export default function Room() {
  const r = useRoom();
  const [scenario, setScenario] = useState<string>();
  const box = useRef<HTMLDivElement>(null);
  const [ana, luis] = r.clients;
  const ready = !!ana.editor && !!luis.editor;
  const waiting = (c: Client) => c.outbox.length + (c.buffer.length ? 1 : 0);
  const pending = waiting(ana) + waiting(luis);
  const same = ready && digest(ana.editor!.doc) === digest(r.room.doc) && digest(luis.editor!.doc) === digest(r.room.doc);
  const current = SCENARIOS.find((s) => s.key === scenario);
  const playRef = useRef(r.play);
  playRef.current = r.play;
  // The same function at every render, so that each editor is attached once.
  const attachRef = useRef(r.attach);
  attachRef.current = r.attach;
  const attach = useCallback((who: Who, editor: Editor) => attachRef.current(who, editor), []);

  // "Try it" of the table below.
  useEffect(() => {
    const onScenario = (event: Event) => {
      const key = (event as CustomEvent<string>).detail;
      box.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScenario(key);
      playRef.current(key);
    };
    window.addEventListener(SCENARIO_EVENT, onScenario);
    return () => window.removeEventListener(SCENARIO_EVENT, onScenario);
  }, []);

  const choice = (on: boolean) =>
    `cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-40 ${on ? 'border-ink bg-ink text-white' : 'border-border-strong bg-white text-ink hover:bg-hover'}`;

  return (
    <div ref={box} className="mt-7 scroll-mt-24 overflow-hidden rounded-[18px] border border-border">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-5 py-3.5">
        <span className={CAPTION}>Network</span>
        <button type="button" aria-pressed={!r.paused} disabled={!ready} onClick={() => r.resume()} className={choice(!r.paused)}>
          Live
        </button>
        <button type="button" aria-pressed={r.paused} disabled={!ready} onClick={() => r.setPaused(true)} className={choice(r.paused)}>
          Held
        </button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <label htmlFor="collab-case" className={CAPTION}>
          A case
        </label>
        <select
          id="collab-case"
          disabled={!ready}
          value={scenario ?? ''}
          onChange={(event) => {
            setScenario(event.target.value || undefined);
            if (event.target.value) r.play(event.target.value);
          }}
          className="h-8.5 min-w-0 flex-[0_1_300px] rounded-lg border border-border-strong bg-white px-2 text-[13px] text-ink"
        >
          <option value="">Type yourself…</option>
          {SCENARIOS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            setScenario(undefined);
            r.setPaused(false);
            r.reset();
            r.resume();
          }}
          className="ml-auto cursor-pointer border-0 bg-transparent text-[13px] text-muted underline disabled:opacity-40"
        >
          Start again
        </button>
      </div>
      {current && (
        <p className="m-0 border-b border-border bg-pastel-yellow/50 px-5 py-2.5 text-[14px] leading-normal text-[#5c4a1e]">
          <strong>{current.title}.</strong> {current.setup} Choose whose change the server gets first. <span className="text-[#7a6634]">Everybody should end with: {current.expect}</span>
        </p>
      )}
      <div className="flex flex-wrap">
        {PEOPLE.map(({ who, color }) => {
          const c = r.clients.find((x) => x.who === who)!;
          return (
            <div key={who} className="min-w-0 flex-[1_1_380px] border-border first:border-r">
              <div className="flex items-center gap-2 px-4 py-2.5">
                <span className="size-2.5 rounded-full" style={{ background: `#${color}` }} aria-hidden="true" />
                <span className="text-sm font-semibold text-ink">{who}</span>
                <span className="ml-auto text-xs text-muted">
                  {c.outbox.length ? `${c.outbox.length} change on its way` : c.inflight ? 'waiting for its place' : 'up to date'}
                  {c.buffer.length ? ' · typed meanwhile' : ''}
                </span>
              </div>
              <div className="h-[300px] bg-[#e9eaee]">
                <DocsProvider>
                  <Side who={who} attach={attach} />
                  <DocsSurface className="h-full" />
                </DocsProvider>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
        {r.paused && pending > 0 ? (
          <>
            <span className="text-[13px] text-ink-soft">Let them through:</span>
            <button type="button" onClick={() => r.deliver(['Ana'])} className="h-8.5 cursor-pointer rounded-lg border-0 bg-brand px-3 text-[13px] font-semibold text-white hover:bg-brand-hover">
              Ana’s first
            </button>
            <button type="button" onClick={() => r.deliver(['Luis'])} className="h-8.5 cursor-pointer rounded-lg border-0 bg-brand px-3 text-[13px] font-semibold text-white hover:bg-brand-hover">
              Luis’s first
            </button>
          </>
        ) : (
          <span className="text-[13px] text-muted">{r.paused ? 'Held: what either types waits here until you let it through.' : 'Type in either one. Hold the network to make changes at the same time.'}</span>
        )}
        <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${!ready ? 'bg-hover text-muted' : pending ? 'bg-pastel-yellow text-pastel-yellow-fg' : same ? 'bg-pastel-green text-pastel-green-fg' : 'bg-pastel-pink text-pastel-pink-fg'}`}>
          {!ready ? 'Opening…' : pending ? `${pending} not sent yet` : same ? 'digest ✓ the same document for all three' : 'digests differ: the editor would load the room again'}
        </span>
      </div>
      <div className="max-h-[220px] overflow-y-auto bg-[#2f2e2b] px-5 py-3.5 font-code text-[12.5px] leading-[1.7] text-[#edece8]" aria-live="polite">
        <div className="text-[#a8a49a]">{'// the server’s log: one order for everybody'}</div>
        {r.room.log.length ? (
          r.room.log.map((entry, i) => (
            <div key={i}>
              <span className="text-[#a8a49a]">{i + 1}.</span> <span style={{ color: entry.by === 'Ana' ? '#f5a35c' : '#8fb8f5' }}>{entry.by}</span>{' '}
              {entry.ops.map(said).join('; ')}
              {entry.sent && <div className="pl-5 text-[#9ee0b0]">↳ moved over {entry.over} it had not seen: it said “{entry.sent.map(said).join('; ')}”</div>}
            </div>
          ))
        ) : (
          <div className="text-[#a8a49a]">nothing yet</div>
        )}
      </div>
    </div>
  );
}
