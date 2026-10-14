// A conversation with Claude about the document open in the editor, held by
// the page. Each step goes to the backend of the application, which takes it
// to the Claude API (`claude.ts` is one); what Claude asks of the tools is done
// here, to the editor, and the results go back in the next step, until Claude
// has nothing more to do. Changes are steps the person can undo and, in a
// room, the others see them as they see the person's own.
//
// The conversation is kept as Claude gave it, and only added to: what Claude
// thought is sent back unchanged, as the API asks.

import { type AssistantHost, runOnEditor } from './browser';

/** A piece of a message, as the Claude API has them; the page reads only text, the calls of tools and their results. */
type Block = { type: string; [key: string]: unknown };
type Message = { role: 'user' | 'assistant'; content: Block[] };

/** What the person sees of the conversation, one entry at a time. */
export type ChatEntry =
  | { kind: 'person'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; name: string; ok?: boolean; text?: string }
  | { kind: 'note'; text: string; bad?: boolean };

export interface AssistantChatOptions {
  /** Where the backend answers: `/api/assistant` when left out. */
  endpoint?: string;
  /** More of what a request carries, such as the session of the application. */
  headers?: Record<string, string>;
  /** The most steps one question may take before it stops: 40 when left out. */
  maxSteps?: number;
  onChange?: () => void;
}

export interface AssistantChat {
  readonly entries: ChatEntry[];
  /** True while it is working on a question. */
  readonly busy: boolean;
  /** Asks something, and works on it to the end. */
  send(text: string): Promise<void>;
  /** Stops after the step it is on. */
  stop(): void;
  /** Starts a new conversation. */
  clear(): void;
}

const isTextBlock = (block: Block): block is Block & { text: string } => block.type === 'text' && typeof block.text === 'string';

export function createAssistantChat(host: AssistantHost, options: AssistantChatOptions = {}): AssistantChat {
  const endpoint = options.endpoint ?? '/api/assistant';
  const maxSteps = options.maxSteps ?? 40;
  let messages: Message[] = [];
  let notes: { after: number; text: string; bad?: boolean }[] = [];
  let busy = false;
  let stopping = false;
  let controller: AbortController | undefined;
  let entries: ChatEntry[] = [];
  /** What Claude is writing now, as it comes: its words, and the tools it asks for. */
  let live: ChatEntry[] = [];

  /** The conversation as the person reads it. */
  const rebuild = () => {
    const out: ChatEntry[] = [];
    const tools = new Map<string, ChatEntry & { kind: 'tool' }>();
    messages.forEach((message, index) => {
      for (const block of message.content) {
        if (message.role === 'user' && isTextBlock(block)) out.push({ kind: 'person', text: block.text });
        else if (message.role === 'assistant' && isTextBlock(block) && block.text.trim()) out.push({ kind: 'assistant', text: block.text });
        else if (block.type === 'tool_use') {
          const entry: ChatEntry & { kind: 'tool' } = { kind: 'tool', name: String(block.name) };
          tools.set(String(block.id), entry);
          out.push(entry);
        } else if (block.type === 'tool_result') {
          const entry = tools.get(String(block.tool_use_id));
          if (entry) Object.assign(entry, { ok: !block.is_error, text: typeof block.content === 'string' ? block.content : undefined });
        }
      }
      for (const note of notes) if (note.after === index) out.push(note.bad ? { kind: 'note', text: note.text, bad: true } : { kind: 'note', text: note.text });
    });
    entries = [...out, ...live];
    options.onChange?.();
  };

  const note = (text: string, bad = false) => {
    notes.push({ after: messages.length - 1, text, bad });
    rebuild();
  };

  /** Shows more of what Claude is writing. */
  const hear = (event: { type: string; text?: string; name?: string }) => {
    const last = live[live.length - 1];
    if (event.type === 'text' && event.text) {
      if (last?.kind === 'assistant') live[live.length - 1] = { kind: 'assistant', text: last.text + event.text };
      else live.push({ kind: 'assistant', text: event.text });
    } else if (event.type === 'tool' && event.name) live.push({ kind: 'tool', name: event.name });
    else return;
    rebuild();
  };

  /** One step: the conversation to the backend, and Claude's answer back, shown as it is written. */
  const step = async (): Promise<{ content: Block[]; stop_reason: string | null }> => {
    controller = new AbortController();
    const answer = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...options.headers },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });
    if (!answer.ok || !answer.body) {
      const body = await answer.json().catch(() => ({}));
      throw new Error(body.error ?? `The server answered ${answer.status}.`);
    }
    // A line of JSON at a time: more of the text, a tool, and at the end the whole answer.
    const reader = answer.body.pipeThrough(new TextDecoderStream()).getReader();
    let pending = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += value;
        let end: number;
        while ((end = pending.indexOf('\n')) >= 0) {
          const text = pending.slice(0, end).trim();
          pending = pending.slice(end + 1);
          if (!text) continue;
          const event = JSON.parse(text);
          if (event.type === 'done') return { content: event.content, stop_reason: event.stop_reason };
          if (event.type === 'error') throw new Error(event.error);
          hear(event);
        }
      }
    } finally {
      live = [];
    }
    throw new Error('The answer broke off before it was done. Ask again.');
  };

  /** Results for the tools Claude asked for that were not done: the conversation stays one the API takes. */
  const unanswered = (reason: string) => {
    const last = messages[messages.length - 1];
    if (last?.role !== 'assistant') return;
    const calls = last.content.filter((block) => block.type === 'tool_use');
    if (calls.length) messages.push({ role: 'user', content: calls.map((call) => ({ type: 'tool_result', tool_use_id: call.id, content: reason, is_error: true })) });
  };

  const send = async (text: string) => {
    const asked = text.trim();
    if (!asked || busy) return;
    busy = true;
    stopping = false;
    messages.push({ role: 'user', content: [{ type: 'text', text: asked }] });
    rebuild();
    try {
      for (let steps = 0; ; steps++) {
        if (steps >= maxSteps) {
          note(`It stopped after ${maxSteps} steps. Ask it to go on if there is more to do.`);
          break;
        }
        const reply = await step();
        messages.push({ role: 'assistant', content: reply.content });
        rebuild();
        if (reply.stop_reason === 'refusal') {
          note('The assistant would not do that.', true);
          break;
        }
        if (reply.stop_reason === 'max_tokens') {
          note('The answer was cut short. Ask it to go on.', true);
          break;
        }
        if (reply.stop_reason === 'pause_turn') continue;
        if (reply.stop_reason !== 'tool_use') break;
        if (stopping) break;
        // Every tool it asked for, in order, and all the results in one message.
        const results: Block[] = [];
        for (const call of reply.content.filter((block) => block.type === 'tool_use')) {
          const input = call.input && typeof call.input === 'object' ? (call.input as Record<string, unknown>) : {};
          const done = runOnEditor(host, String(call.name), input);
          results.push({ type: 'tool_result', tool_use_id: call.id, content: done.text, ...(done.ok ? {} : { is_error: true }) });
        }
        messages.push({ role: 'user', content: results });
        rebuild();
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) note(error instanceof Error ? error.message : String(error), true);
    } finally {
      if (stopping) {
        unanswered('The person stopped the assistant before this was done.');
        note('Stopped.');
      } else unanswered('This was not done: the conversation broke off.');
      busy = false;
      controller = undefined;
      rebuild();
    }
  };

  return {
    get entries() {
      return entries;
    },
    get busy() {
      return busy;
    },
    send,
    stop() {
      if (!busy) return;
      stopping = true;
      controller?.abort();
    },
    clear() {
      if (busy) return;
      messages = [];
      notes = [];
      rebuild();
    },
  };
}
