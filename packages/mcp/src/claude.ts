// The way from a page to Claude, for an editor with an assistant of its own:
// a chat beside the document, with nothing to install on the machine of
// whoever uses it. The page holds the conversation and runs the tools on the
// document it has open; this side only takes the conversation to the Claude
// API and gives back what Claude answered, so that the API key never reaches
// the browser. It runs in Node, in the backend of the application.
//
//   POST /api/assistant   { messages }  →  lines of JSON, as Claude writes:
//     { "type": "text", "text": "…" }       more of what it says
//     { "type": "tool", "name": "…" }       a tool it is asking for
//     { "type": "done", "content": […], "stop_reason": "…" }   the whole answer
//     { "type": "error", "error": "…" }

import type { IncomingMessage, ServerResponse } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, toolProperties } from './tools';

/** The model unless told otherwise: the most capable Opus. */
export const ASSISTANT_MODEL = 'claude-opus-5-5';

/** What a page cannot do: read a picture from a path on the machine. */
const NOT_IN_A_PAGE = new Set(['insert_image', 'set_letterhead']);

/** The tools of the document, as the Claude API takes them. Always in the same order, so the cache of the request holds. */
export function assistantTools(): Anthropic.Beta.BetaTool[] {
  return TOOLS.filter((tool) => !NOT_IN_A_PAGE.has(tool.name)).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: { type: 'object', properties: toolProperties(tool), required: tool.required ?? [] },
    // The arguments come as they are written; the page checks them, as every tool does its own.
    eager_input_streaming: true,
  }));
}

export const ASSISTANT_SYSTEM = `You work on a Word document that is open in a web editor, beside the person who asks. Your tools read and change that document; what you change appears in it at once, as a step they can undo, and when others are in the document with them they see it too.

Start from get_overview when you do not know the document yet. Paragraphs go by their number, and numbers after a paragraph you insert or delete move: read again before giving numbers from an older reading.

Keep the look of the document. Before rewriting or adding text that should look like what is there, read its formatting with read_formatting. To write a paragraph anew, as in a translation, use rewrite_paragraph, giving in "segments" the words that were bold or italic; new paragraphs take like_paragraph. Change fonts, sizes, alignment or spacing only when asked.

Answer in the language the person writes in. Say briefly what you did; do not paste the document back.`;

export interface AssistantOptions {
  /** The client of the Claude API; one that reads ANTHROPIC_API_KEY from the environment when left out. */
  client?: Anthropic;
  model?: string;
  /** What the assistant is told before the conversation. ASSISTANT_SYSTEM when left out. */
  system?: string;
  /** How hard it thinks: low is quicker and costs less. Medium when left out. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

/** What the page sends: the conversation so far, the last of it from the person or the results of the tools. */
export type AssistantRequest = { messages: Anthropic.Beta.BetaMessageParam[] };

/** What Claude answered, for the page to add to the conversation as it is and act on. */
export interface AssistantReply {
  content: Anthropic.Beta.BetaContentBlock[];
  stop_reason: Anthropic.Beta.BetaStopReason | null;
}

/** What the page is told while Claude writes, before the whole answer. */
export type AssistantProgress = { type: 'text'; text: string } | { type: 'tool'; name: string };

/** A conversation the page sent that cannot be taken on. */
export class AssistantRefused extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The longest conversation taken, in characters of its JSON: a long document read many times over. */
const MAX_CONVERSATION = 2_000_000;
const MAX_MESSAGES = 400;

/** Checks the shape of what the page sent; the API checks the rest. */
function conversationOf(body: unknown): Anthropic.Beta.BetaMessageParam[] {
  const messages = (body as AssistantRequest | undefined)?.messages;
  if (!Array.isArray(messages) || !messages.length) throw new AssistantRefused(400, 'There is no conversation to answer.');
  if (messages.length > MAX_MESSAGES) throw new AssistantRefused(413, 'The conversation is too long: start a new one.');
  for (const message of messages) {
    if (!message || (message.role !== 'user' && message.role !== 'assistant') || (typeof message.content !== 'string' && !Array.isArray(message.content))) {
      throw new AssistantRefused(400, 'A message of the conversation is not one.');
    }
  }
  if (messages[0].role !== 'user' || messages[messages.length - 1].role !== 'user') throw new AssistantRefused(400, 'The conversation has to start and end with the person.');
  return messages;
}

/**
 * Asks Claude for the next step of a conversation. The tools are those of the
 * document; Claude asks for them in its answer, and the page runs them.
 */
export function createAssistant(options: AssistantOptions = {}) {
  const client = options.client ?? new Anthropic();
  const tools = assistantTools();
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: 'text', text: options.system ?? ASSISTANT_SYSTEM, cache_control: { type: 'ephemeral' } }];

  /** The next step of the conversation; `progress` hears it as it is written, and `signal` stops it. */
  return async function answer(body: unknown, progress?: (event: AssistantProgress) => void, signal?: AbortSignal): Promise<AssistantReply> {
    const messages = conversationOf(body);
    const stream = client.beta.messages.stream({
      model: options.model ?? ASSISTANT_MODEL,
      max_tokens: 16000,
      system,
      tools,
      messages,
      thinking: { type: 'adaptive' },
      output_config: { effort: options.effort ?? 'medium' },
      // The conversation so far is read from the cache on each step: only what is new costs in full.
      cache_control: { type: 'ephemeral' },
      // Where the model declines, another goes on with the same request.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });
    if (progress) {
      stream.on('text', (text) => progress({ type: 'text', text }));
      stream.on('streamEvent', (event) => {
        if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') progress({ type: 'tool', name: event.content_block.name });
      });
    }
    signal?.addEventListener('abort', () => stream.abort(), { once: true });
    const message = await stream.finalMessage();
    return { content: message.content, stop_reason: message.stop_reason };
  };
}

export interface AssistantRouteOptions extends AssistantOptions {
  /** Where the page asks. `/api/assistant` when left out. */
  path?: string;
  /** How many steps one address may ask for in a minute: each tool Claude uses is one. 40 when left out. */
  perMinute?: number;
  /** Who may ask: the place where an application checks its session. Anyone when left out. */
  allow?(request: IncomingMessage): boolean | Promise<boolean>;
}

/**
 * The route of a Node server for the page: answers `POST <path>` and says
 * false for anything else, so that whatever serves the rest goes on with it.
 * Without ANTHROPIC_API_KEY (and no client given) it says so to the page.
 */
export function assistantRoute(options: AssistantRouteOptions = {}) {
  const path = options.path ?? '/api/assistant';
  const perMinute = options.perMinute ?? 40;
  const asked = new Map<string, number[]>();
  let answer: ReturnType<typeof createAssistant> | undefined;

  const send = (response: ServerResponse, status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(body));
  };
  /** What went wrong, said to the page, and the status it goes with before the answer has started. */
  const problem = (error: unknown): { status: number; error: string } => {
    if (error instanceof AssistantRefused) return { status: error.status, error: error.message };
    if (error instanceof Anthropic.RateLimitError) return { status: 429, error: 'The Claude API is busy for this key: try again in a moment.' };
    if (error instanceof Anthropic.AuthenticationError) return { status: 503, error: 'The API key of the server was not accepted.' };
    if (error instanceof Anthropic.BadRequestError) return { status: 400, error: `Claude did not take the conversation: ${error.message}` };
    if (error instanceof Anthropic.APIError) return { status: 502, error: `The Claude API answered ${error.status ?? 'with an error'}: try again.` };
    console.error(error);
    return { status: 500, error: 'The server could not do that. Its log says why.' };
  };

  return async function route(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    if (new URL(request.url ?? '/', 'http://localhost').pathname !== path) return false;
    try {
      if (request.method !== 'POST') throw new AssistantRefused(405, 'Ask with POST.');
      if (options.allow && !(await options.allow(request))) throw new AssistantRefused(403, 'You may not use the assistant.');
      if (!options.client && !process.env.ANTHROPIC_API_KEY) throw new AssistantRefused(503, 'The assistant has no API key: give the server ANTHROPIC_API_KEY.');

      // Each address a few steps a minute: what an open page costs is paid by whoever runs the server.
      const who = request.socket.remoteAddress ?? '?';
      const now = Date.now();
      const recent = (asked.get(who) ?? []).filter((at) => now - at < 60_000);
      if (recent.length >= perMinute) throw new AssistantRefused(429, 'Too many requests to the assistant: wait a minute.');
      recent.push(now);
      asked.set(who, recent);

      const parts: Buffer[] = [];
      let size = 0;
      for await (const part of request) {
        size += (part as Buffer).length;
        if (size > MAX_CONVERSATION) throw new AssistantRefused(413, 'The conversation is too long: start a new one.');
        parts.push(part as Buffer);
      }
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(parts).toString('utf8'));
      } catch {
        throw new AssistantRefused(400, 'The body is not JSON.');
      }
      conversationOf(body);
      answer ??= createAssistant(options);

      // From here the answer goes to the page as it is written, a line of JSON at a time.
      response.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
      const line = (value: unknown) => response.write(`${JSON.stringify(value)}\n`);
      // A page that goes away stops what Claude is writing for it.
      const gone = new AbortController();
      response.on('close', () => !response.writableFinished && gone.abort());
      try {
        const reply = await answer(body, line, gone.signal);
        line({ type: 'done', ...reply });
      } catch (error) {
        if (!gone.signal.aborted) line({ type: 'error', error: problem(error).error });
      }
      response.end();
    } catch (error) {
      const { status, error: message } = problem(error);
      send(response, status, { error: message });
    }
    return true;
  };
}
