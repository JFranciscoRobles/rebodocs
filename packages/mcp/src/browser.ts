// The editor's side of the way to an assistant: it listens to the server on
// this machine for what the assistant wants done, does it to the document
// that is open, as a step the person can undo, and says what came of it.
// It runs the same tools the server runs on files.

import type { Doc, Position } from '@rebodocs/core';
import { ToolError, runTool } from './tools';

/** What it needs of an editor: `Editor` of @rebodocs/editor is one. */
export interface AssistantHost {
  readonly doc: Doc;
  /** Changes the document as one step to undo, and brings `reveal` into view. */
  edit(change: (doc: Doc) => Doc, reveal?: Position): void;
  /** The page each paragraph of a document would start on, from 1, laid out as the editor lays it out. */
  pagesOf(doc: Doc): (para: number) => number;
  exportDocx(): Uint8Array;
  /** Who the notes made here are by. */
  author?: string;
}


export type AssistantState = 'off' | 'connecting' | 'on';

export interface AssistantLink {
  readonly state: AssistantState;
  /** How many things the assistant has done since it connected. */
  readonly calls: number;
  connect(): void;
  disconnect(): void;
  /** Tells the server the document is called something else now: another file was opened, or it was saved under another name. */
  renamed(): void;
}

export interface AssistantOptions {
  /** Where the server listens. */
  url?: string;
  /** The word that lets a page in from another machine than the server's: the one it was started with. */
  token?: string;
  /** What the document is called, for the assistant to tell one editor from another: the name of its file. */
  name?: () => string;
  /** Called when the state changes, or the assistant does something: with what it did, then. */
  onChange?: (did?: string) => void;
}

export const DEFAULT_PORT = 7411;

/** The name of the tool that asks for the document itself, as a DOCX: how the server saves what is open in the editor. */
export const EXPORT_TOOL = '$export';

const base64 = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
};

export function connectAssistant(host: AssistantHost, options: AssistantOptions = {}): AssistantLink {
  const url = (options.url ?? `http://127.0.0.1:${DEFAULT_PORT}`).replace(/\/$/, '');
  let source: EventSource | undefined;
  let state: AssistantState = 'off';
  let calls = 0;
  /** The number the server knows this editor by, once it has said so. */
  let editorId: number | undefined;

  const query = (more: Record<string, string | undefined>) => new URLSearchParams(Object.entries({ ...more, token: options.token }).filter((pair): pair is [string, string] => !!pair[1])).toString();

  const set = (next: AssistantState) => {
    if (state === next) return;
    state = next;
    options.onChange?.();
  };

  const run = (tool: string, args: Record<string, unknown>): { ok: boolean; text: string; data?: string } => {
    if (tool === EXPORT_TOOL) return { ok: true, text: '', data: base64(host.exportDocx()) };
    try {
      const result = runTool(host.doc, tool, args, { pageOf: (doc) => host.pagesOf(doc), author: host.author || undefined });
      if (result.doc && result.doc !== host.doc) host.edit(() => result.doc!, result.reveal);
      return { ok: true, text: result.text };
    } catch (error) {
      if (error instanceof ToolError) return { ok: false, text: error.message };
      return { ok: false, text: `The editor could not do it: ${error instanceof Error ? error.message : String(error)}` };
    }
  };

  const disconnect = () => {
    source?.close();
    source = undefined;
    set('off');
  };

  return {
    get state() {
      return state;
    },
    get calls() {
      return calls;
    },
    connect() {
      if (source) return;
      calls = 0;
      set('connecting');
      const opened = new EventSource(`${url}/events?${query({ name: options.name?.() })}`);
      source = opened;
      opened.addEventListener('hello', (event) => {
        try {
          editorId = (JSON.parse((event as MessageEvent<string>).data) as { editor?: number }).editor;
        } catch {
          editorId = undefined;
        }
        set('on');
      });
      // The browser tries again by itself for as long as it is wanted.
      opened.onerror = () => {
        if (source === opened) set('connecting');
      };
      opened.onmessage = (event) => {
        let asked: { id?: number; tool?: string; args?: Record<string, unknown> };
        try {
          asked = JSON.parse(event.data as string);
        } catch {
          return;
        }
        if (typeof asked.id !== 'number' || typeof asked.tool !== 'string') return;
        const answer = run(asked.tool, asked.args ?? {});
        if (asked.tool !== EXPORT_TOOL) {
          calls++;
          options.onChange?.(asked.tool);
        }
        void fetch(`${url}/result?${query({})}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ id: asked.id, name: options.name?.(), ...answer }) }).catch(() => undefined);
      };
    },
    disconnect,
    renamed() {
      if (!source || editorId === undefined) return;
      void fetch(`${url}/name?${query({})}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ editor: editorId, name: options.name?.() ?? '' }) }).catch(() => undefined);
    },
  };
}
