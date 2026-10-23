// The way from a page to Claude, for an editor with an assistant of its own:
// a chat beside the document, with nothing to install on the machine of
// whoever uses it. The page holds the conversation and runs the tools on the
// document it has open; this side only takes the conversation to the Claude
// API and gives back what Claude answered, so that the API key never reaches
// the browser. It runs in the backend of the application: `assistantRoute`
// for a server of Node's own, `assistantHandler` for one that speaks in
// Request and Response (Next.js, Hono, Bun, Deno, Workers).
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

/**
 * The tools Claude has at hand from the start when the others are searched
 * for: those of reading and writing text, that nearly every question needs.
 */
export const ALWAYS_LOADED = new Set([
  'get_overview',
  'read_document',
  'read_formatting',
  'find_text',
  'replace_text',
  'rewrite_paragraph',
  'insert_paragraphs',
  'delete_paragraphs',
  'edit_document',
  'set_style',
  'format_text',
  'format_paragraphs',
  'add_note',
  'list_variables',
  'fill_variables',
]);

/**
 * The tools of the document, as the Claude API takes them. Always in the same
 * order, so the cache of the request holds. With `search`, only those of
 * ALWAYS_LOADED are read by Claude from the start: it finds the others,
 * of tables, pages and reviewing, with the tool that searches for them.
 */
export function assistantTools(options: { search?: boolean } = {}): Anthropic.Beta.BetaTool[] {
  return TOOLS.filter((tool) => !NOT_IN_A_PAGE.has(tool.name)).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: { type: 'object', properties: toolProperties(tool), required: tool.required ?? [] },
    // The arguments come as they are written; the page checks them, as every tool does its own.
    eager_input_streaming: true,
    ...(options.search && !ALWAYS_LOADED.has(tool.name) ? { defer_loading: true } : {}),
  }));
}

export const ASSISTANT_SYSTEM = `You work on a Word document that is open in a web editor, beside the person who asks. Your tools read and change that document; what you change appears in it at once, as a step they can undo, and when others are in the document with them they see it too.

Start from get_overview when you do not know the document yet. Paragraphs go by their number, and numbers after a paragraph you insert or delete move: read again before giving numbers from an older reading. To make several changes from one reading, use edit_document. After changes that move text across pages, read_pages tells whether a page now ends badly.

Keep the look of the document. Before rewriting or adding text that should look like what is there, read its formatting with read_formatting. To write a paragraph anew, as in a translation, use rewrite_paragraph, giving in "segments" the words that were bold or italic; new paragraphs take like_paragraph. Change fonts, sizes, alignment or spacing only when asked.

Answer in the language the person writes in. Say briefly what you did; do not paste the document back.`;

export interface AssistantOptions {
  /** The client of the Claude API; one that reads ANTHROPIC_API_KEY from the environment when left out. */
  client?: Anthropic;
  model?: string;
  /** What the assistant is told before the conversation, in place of ASSISTANT_SYSTEM. To add to it, use `context`. */
  system?: string;
  /**
   * Have Claude search for the tools it needs beyond those of ALWAYS_LOADED,
   * instead of reading all of them on every step: fewer tokens on each, and
   * one more step when it needs a tool of another kind. Off when left out.
   */
  toolSearch?: boolean;
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
  const tools: Anthropic.Beta.BetaToolUnion[] = assistantTools({ search: options.toolSearch });
  if (options.toolSearch) tools.unshift({ type: 'tool_search_tool_bm25_20251119', name: 'tool_search_tool_bm25' });
  const fixed: Anthropic.Beta.BetaTextBlockParam = { type: 'text', text: options.system ?? ASSISTANT_SYSTEM, cache_control: { type: 'ephemeral' } };

  /**
   * The next step of the conversation; `progress` hears it as it is written,
   * and `signal` stops it. `context` is told to Claude after the instructions:
   * what the application knows of the document or of who is asking.
   */
  return async function answer(body: unknown, progress?: (event: AssistantProgress) => void, signal?: AbortSignal, context?: string): Promise<AssistantReply> {
    const messages = conversationOf(body);
    // After the instructions, which are the same for everyone and stay in the cache; what is said of this conversation comes after them.
    const system = context?.trim() ? [fixed, { type: 'text' as const, text: context.trim() }] : [fixed];
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

/** What a route and a handler have in common, for the request of either: who may ask, how much, and what Claude is told of them. */
interface GateOptions<R> extends AssistantOptions {
  /** Where the page asks. `/api/assistant` when left out. */
  path?: string;
  /** How many steps one asker may take in a minute: each tool Claude uses is one. 40 when left out. */
  perMinute?: number;
  /** Who may ask: the place where an application checks its session. Anyone when left out. */
  allow?(request: R): boolean | Promise<boolean>;
  /**
   * Who is asking, for `perMinute`: the id of the user of the session. Left
   * out, the address the request comes from, which behind a proxy is the
   * proxy's, the same for everyone.
   */
  key?(request: R): string | Promise<string>;
  /**
   * What Claude is told of this conversation besides its instructions: the
   * client a contract is for, the user, the rules of the office. Keep it the
   * same through a conversation, or each step pays for all of it again.
   */
  context?(request: R): string | undefined | Promise<string | undefined>;
}

export type AssistantRouteOptions = GateOptions<IncomingMessage>;
export type AssistantHandlerOptions = GateOptions<Request>;

/** How long to keep what was asked, and how often to forget the askers that have gone. */
const MINUTE = 60_000;

/** The checks and the counting a route and a handler share, and what Claude answers through them. */
function gate<R>(options: GateOptions<R>, defaultKey: (request: R) => string) {
  const path = options.path ?? '/api/assistant';
  const perMinute = options.perMinute ?? 40;
  const asked = new Map<string, number[]>();
  let swept = Date.now();
  let answer: ReturnType<typeof createAssistant> | undefined;

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

  /** Checks the request and reads the conversation in it; throws AssistantRefused when it cannot be answered. */
  const take = async (request: R, method: string, read: () => Promise<string>): Promise<{ body: unknown; context?: string }> => {
    if (method !== 'POST') throw new AssistantRefused(405, 'Ask with POST.');
    if (options.allow && !(await options.allow(request))) throw new AssistantRefused(403, 'You may not use the assistant.');
    if (!options.client && !process.env.ANTHROPIC_API_KEY) throw new AssistantRefused(503, 'The assistant has no API key: give the server ANTHROPIC_API_KEY.');

    // A few steps a minute for each who asks: what an open page costs is paid by whoever runs the server.
    const who = (options.key ? await options.key(request) : defaultKey(request)) || '?';
    const now = Date.now();
    if (now - swept > MINUTE) {
      for (const [key, times] of asked) if (!times.some((at) => now - at < MINUTE)) asked.delete(key);
      swept = now;
    }
    const recent = (asked.get(who) ?? []).filter((at) => now - at < MINUTE);
    if (recent.length >= perMinute) throw new AssistantRefused(429, 'Too many requests to the assistant: wait a minute.');
    recent.push(now);
    asked.set(who, recent);

    let body: unknown;
    try {
      body = JSON.parse(await read());
    } catch (error) {
      if (error instanceof AssistantRefused) throw error;
      throw new AssistantRefused(400, 'The body is not JSON.');
    }
    conversationOf(body);
    return { body, context: (await options.context?.(request)) ?? undefined };
  };

  /** Claude's answer, a line of JSON at a time as it is written, ending with the whole of it, or with what went wrong. */
  const stream = async (body: unknown, context: string | undefined, line: (value: unknown) => void, signal: AbortSignal) => {
    answer ??= createAssistant(options);
    try {
      const reply = await answer(body, line, signal, context);
      line({ type: 'done', ...reply });
    } catch (error) {
      if (!signal.aborted) line({ type: 'error', error: problem(error).error });
    }
  };

  return { path, problem, take, stream };
}

const tooLong = () => new AssistantRefused(413, 'The conversation is too long: start a new one.');

/**
 * The route of a Node server for the page: answers `POST <path>` and says
 * false for anything else, so that whatever serves the rest goes on with it.
 * Without ANTHROPIC_API_KEY (and no client given) it says so to the page.
 */
export function assistantRoute(options: AssistantRouteOptions = {}) {
  const { path, problem, take, stream } = gate(options, (request) => request.socket.remoteAddress ?? '?');

  const send = (response: ServerResponse, status: number, body: unknown) => {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(body));
  };

  const read = async (request: IncomingMessage) => {
    const parts: Buffer[] = [];
    let size = 0;
    for await (const part of request) {
      size += (part as Buffer).length;
      if (size > MAX_CONVERSATION) throw tooLong();
      parts.push(part as Buffer);
    }
    return Buffer.concat(parts).toString('utf8');
  };

  return async function route(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    if (new URL(request.url ?? '/', 'http://localhost').pathname !== path) return false;
    try {
      const { body, context } = await take(request, request.method ?? '', () => read(request));
      // From here the answer goes to the page as it is written, a line of JSON at a time.
      response.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
      // A page that goes away stops what Claude is writing for it.
      const gone = new AbortController();
      response.on('close', () => !response.writableFinished && gone.abort());
      await stream(body, context, (value) => response.write(`${JSON.stringify(value)}\n`), gone.signal);
      response.end();
    } catch (error) {
      const { status, error: message } = problem(error);
      send(response, status, { error: message });
    }
    return true;
  };
}

/**
 * The same as `assistantRoute`, for a server that speaks in Request and
 * Response: in Next.js, `export const POST = assistantHandler({ … })` in
 * `app/api/assistant/route.ts`. It answers whatever it is given; the path is
 * the router's.
 *
 * Who asks is told apart by `key`. Left out, by the address a proxy says the
 * request came from (x-forwarded-for), which anyone can say otherwise: give
 * `key` the user of the session.
 */
export function assistantHandler(options: AssistantHandlerOptions = {}) {
  const forwarded = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || '?';
  const { problem, take, stream } = gate(options, forwarded);

  const read = async (request: Request) => {
    if (!request.body) return '';
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let out = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_CONVERSATION) {
        await reader.cancel();
        throw tooLong();
      }
      out += decoder.decode(value, { stream: true });
    }
    return out + decoder.decode();
  };

  return async function handler(request: Request): Promise<Response> {
    try {
      const { body, context } = await take(request, request.method, () => read(request));
      const encoder = new TextEncoder();
      // A page that goes away stops what Claude is writing for it: the request says so, and so does the stream being let go.
      const gone = new AbortController();
      request.signal?.addEventListener('abort', () => gone.abort(), { once: true });
      const answer = new ReadableStream<Uint8Array>({
        async start(controller) {
          await stream(body, context, (value) => controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`)), gone.signal);
          controller.close();
        },
        cancel() {
          gone.abort();
        },
      });
      return new Response(answer, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
    } catch (error) {
      const { status, error: message } = problem(error);
      return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
    }
  };
}
