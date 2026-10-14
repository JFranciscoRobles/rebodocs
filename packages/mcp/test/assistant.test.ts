import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, describe, expect, it } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { type Doc, type Paragraph, createDoc, exportDocx, plainText } from '@rebodocs/core';
import type { AssistantHost } from '../src/browser';
import { createAssistantChat } from '../src/chat';
import { assistantRoute, assistantTools } from '../src/claude';

const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });

/** A Claude that answers from a script: each request takes the next answer, and what it was asked is kept. */
function scripted(answers: { content: unknown[]; stop_reason: string }[]) {
  const asked: Anthropic.Beta.MessageCreateParams[] = [];
  const client = {
    beta: {
      messages: {
        stream(params: Anthropic.Beta.MessageCreateParams) {
          asked.push(structuredClone(params));
          const next = answers.shift() ?? { content: [{ type: 'text', text: 'Done.' }], stop_reason: 'end_turn' };
          const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
          const stream = {
            on(event: string, listener: (...args: unknown[]) => void) {
              (listeners[event] ??= []).push(listener);
              return stream;
            },
            abort() {},
            // The text in two pieces, and each tool as it starts, as the API streams them.
            async finalMessage() {
              for (const block of next.content as { type: string; text?: string }[]) {
                if (block.type === 'text') {
                  const half = Math.ceil(block.text!.length / 2);
                  for (const piece of [block.text!.slice(0, half), block.text!.slice(half)]) {
                    listeners.text?.forEach((listener) => listener(piece));
                    await new Promise((done) => setTimeout(done, 5));
                  }
                } else if (block.type === 'tool_use') listeners.streamEvent?.forEach((listener) => listener({ type: 'content_block_start', content_block: block }));
              }
              return next;
            },
          };
          return stream;
        },
      },
    },
  } as unknown as Anthropic;
  return { client, asked };
}

/** An editor over a document, as the chat sees one. */
function host(doc: Doc): AssistantHost & { edits: number } {
  const editor = {
    doc,
    edits: 0,
    edit(change: (now: Doc) => Doc) {
      editor.doc = change(editor.doc);
      editor.edits++;
    },
    pagesOf: () => () => 1,
    exportDocx: () => exportDocx(editor.doc),
  };
  return editor;
}

const servers: ReturnType<typeof createServer>[] = [];
afterAll(() => servers.forEach((server) => server.close()));

/** The route on a server of its own, and the fetch of the page pointed at it. */
async function serve(route: ReturnType<typeof assistantRoute>) {
  const server = createServer((request, response) => {
    void route(request, response).then((answered) => {
      if (!answered) {
        response.writeHead(404);
        response.end();
      }
    });
  });
  servers.push(server);
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/assistant`;
}

describe('the assistant in the page', () => {
  it('gives Claude the tools a page can run, each with what it takes', () => {
    const tools = assistantTools();
    expect(tools.map((tool) => tool.name)).toContain('rewrite_paragraph');
    expect(tools.map((tool) => tool.name)).not.toContain('insert_image');
    const rewrite = tools.find((tool) => tool.name === 'rewrite_paragraph')!;
    expect(rewrite.input_schema.required).toEqual(['paragraph']);
    expect(rewrite.input_schema.properties).toHaveProperty('area');
  });

  it('runs on the document what Claude asks, sends back what came of it, and goes on until Claude is done', async () => {
    const { client, asked } = scripted([
      { content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'tool_use', id: 't1', name: 'replace_text', input: { find: 'Hola', replace: 'Hello' } }], stop_reason: 'tool_use' },
      { content: [{ type: 'tool_use', id: 't2', name: 'delete_paragraphs', input: { from: 9 } }], stop_reason: 'tool_use' },
      { content: [{ type: 'text', text: 'I translated the greeting.' }], stop_reason: 'end_turn' },
    ]);
    const endpoint = await serve(assistantRoute({ client }));
    const editor = host(createDoc([p('Hola mundo')]));
    const chat = createAssistantChat(editor, { endpoint });
    await chat.send('Translate it');

    expect(plainText(editor.doc.paragraphs[0].runs)).toBe('Hello mundo');
    expect(editor.edits).toBe(1);
    expect(chat.busy).toBe(false);
    expect(chat.entries).toEqual([
      { kind: 'person', text: 'Translate it' },
      { kind: 'tool', name: 'replace_text', ok: true, text: expect.stringContaining('Replaced') },
      { kind: 'tool', name: 'delete_paragraphs', ok: false, text: expect.stringContaining('There is no paragraph 9') },
      { kind: 'assistant', text: 'I translated the greeting.' },
    ]);
    // Each step carries the whole conversation as it was, what Claude thought among it, and the results in one message.
    expect(asked).toHaveLength(3);
    const last = asked[2].messages;
    expect(last.map((message) => message.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user']);
    expect((last[1].content as { type: string }[])[0].type).toBe('thinking');
    expect(last[4].content).toEqual([{ type: 'tool_result', tool_use_id: 't2', content: expect.stringContaining('There is no paragraph 9'), is_error: true }]);
    expect(asked[0]).toMatchObject({ model: 'claude-opus-5-5', thinking: { type: 'adaptive' }, fallbacks: 'default' });
  });

  it('shows the answer as it is written', async () => {
    const { client } = scripted([{ content: [{ type: 'text', text: 'It is a contract between two parties.' }], stop_reason: 'end_turn' }]);
    const endpoint = await serve(assistantRoute({ client }));
    const seen: string[] = [];
    const chat = createAssistantChat(host(createDoc([p('a')])), {
      endpoint,
      onChange: () => {
        const last = chat?.entries.at(-1);
        if (last?.kind === 'assistant') seen.push(last.text);
      },
    });
    await chat.send('What is it?');
    // Half of it first, then all of it.
    expect(seen[0]).toBe('It is a contract be');
    expect(seen.at(-1)).toBe('It is a contract between two parties.');
    expect(chat.entries).toEqual([
      { kind: 'person', text: 'What is it?' },
      { kind: 'assistant', text: 'It is a contract between two parties.' },
    ]);
  });

  it('says what went wrong, and keeps the conversation one Claude takes', async () => {
    const endpoint = await serve(assistantRoute({ client: scripted([]).client, perMinute: 1 }));
    const chat = createAssistantChat(host(createDoc([p('a')])), { endpoint });
    await chat.send('first');
    await chat.send('second');
    expect(chat.entries.at(-1)).toEqual({ kind: 'note', text: 'Too many requests to the assistant: wait a minute.', bad: true });

    const strict = await serve(assistantRoute({ client: scripted([]).client }));
    const bad = await fetch(strict, { method: 'POST', body: JSON.stringify({ messages: [{ role: 'assistant', content: 'x' }] }) });
    expect(bad.status).toBe(400);
    const keyless = await serve(assistantRoute());
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const answer = await fetch(keyless, { method: 'POST', body: '{}' });
      expect(answer.status).toBe(503);
      expect((await answer.json()).error).toContain('ANTHROPIC_API_KEY');
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it('stops when asked, with an answer for every tool it was asked for', async () => {
    const { client, asked } = scripted([
      { content: [{ type: 'tool_use', id: 'a', name: 'get_overview', input: {} }], stop_reason: 'tool_use' },
      { content: [{ type: 'tool_use', id: 'b', name: 'get_overview', input: {} }], stop_reason: 'tool_use' },
    ]);
    const endpoint = await serve(assistantRoute({ client }));
    const chat = createAssistantChat(host(createDoc([p('a')])), { endpoint, onChange: () => chat?.stop() });
    await chat.send('Look');
    expect(chat.entries.at(-1)).toEqual({ kind: 'note', text: 'Stopped.' });
    expect(asked.length).toBeLessThanOrEqual(2);
    await chat.send('Again');
    const sent = asked.at(-1)!.messages;
    // The question after the stop goes with a result for the tool that was not run.
    expect(sent.at(-1)!.role).toBe('user');
    expect(JSON.stringify(sent)).toContain('stopped the assistant');
  });
});
