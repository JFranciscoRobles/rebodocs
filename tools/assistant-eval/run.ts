// The evaluation of the assistant beside the editor: each case of `cases.ts`
// goes the way a person's question goes in the page, through the chat of the
// page and the route of the backend as they are shipped, with the real Claude
// API; then the document it leaves is checked.
//
//   npm run eval:assistant                       every case, 3 times each
//   npm run eval:assistant -- --reps 1 --cases fill-template,review-only
//   npm run eval:assistant -- --hard             only the harder cases
//   npm run eval:assistant -- --tool-search      with the tools searched for
//   npm run eval:assistant -- --effort low       or another effort, --model another model
//   npm run eval:assistant -- --null             with a Claude that does nothing: the harness, checked
//   npm run eval:assistant -- --claude-code      through Claude Code and the MCP server, on a .docx file
//
// With --claude-code, each case is a file in a folder of its own and a run of
// `claude -p` with the rebodocs server alone: the way an assistant on the
// person's machine works, with Claude Code's own instructions instead of the
// chat's, and on the plan of whoever is signed in to it, with no API key. Its
// cost is what Claude Code says the run would have cost on the API.
//
// It costs money: a run of every case three times is some 57 conversations
// (a few dollars with Opus 5.5). It needs ANTHROPIC_API_KEY, or a profile of
// `ant auth login`. What came of each goes to fixtures/assistant-eval/<time>/:
// results.jsonl (one line a case and rep, with its tokens and cost),
// errors.jsonl (what never got to an answer: not counted as a failure) and
// the whole conversation of each.

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { type Doc, exportDocx, importDocx } from '@rebodocs/core/internal';
import type { AssistantHost } from '../../packages/mcp/src/browser';
import { createAssistantChat } from '../../packages/mcp/src/chat';
import { ASSISTANT_MODEL, assistantRoute } from '../../packages/mcp/src/claude';
import { CASES } from './cases';

const args = process.argv.slice(2);
const value = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const reps = Number(value('--reps') ?? 3);
const only = value('--cases')?.split(',');
const model = value('--model') ?? (args.includes('--claude-code') ? 'opus' : ASSISTANT_MODEL);
const effort = (value('--effort') ?? 'medium') as 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const toolSearch = args.includes('--tool-search');
const nothing = args.includes('--null');
const claudeCode = args.includes('--claude-code');
/** The longest one conversation may take, whatever the stream does. */
const CEILING = 5 * 60_000;

/** Dollars a million tokens: input, output, read from the cache, written to it (five minutes). */
const PRICES: Record<string, [number, number, number, number]> = {
  'claude-opus-5-5': [4, 20, 0.2, 5],
  'claude-sonnet-5-5': [2, 10, 0.2, 2.5],
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125],
};

const cases = CASES.filter((c) => (!only || only.includes(c.id)) && (!args.includes('--hard') || c.hard));
if (!cases.length || !Number.isInteger(reps) || reps < 1) {
  console.error(`Cases: ${CASES.map((c) => c.id).join(', ')}`);
  process.exit(2);
}

interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  calls: number;
  models: string[];
}

/** A client of the API that keeps what each call cost and which model answered it. */
function counted(): { client: Anthropic; usage: Usage } {
  const usage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, models: [] };
  if (nothing) {
    // A Claude that answers without doing anything: the cases that ask for a change must fail with it.
    const client = {
      beta: { messages: { stream: () => ({ on() {}, abort() {}, finalMessage: async () => ({ content: [{ type: 'text', text: 'Listo.' }], stop_reason: 'end_turn' }) }) } },
    } as unknown as Anthropic;
    return { client, usage };
  }
  const client = new Anthropic();
  const stream = client.beta.messages.stream.bind(client.beta.messages);
  client.beta.messages.stream = ((...params: Parameters<typeof stream>) => {
    const made = stream(...params);
    const final = made.finalMessage.bind(made);
    made.finalMessage = async () => {
      const message = await final();
      usage.calls++;
      usage.input += message.usage.input_tokens;
      usage.output += message.usage.output_tokens;
      usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
      usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
      usage.models.push(message.model);
      return message;
    };
    return made;
  }) as typeof stream;
  return { client, usage };
}

const cost = (usage: Usage) => {
  const price = PRICES[model];
  if (!price) return null;
  return (usage.input * price[0] + usage.output * price[1] + usage.cacheRead * price[2] + usage.cacheWrite * price[3]) / 1e6;
};

const out = join('fixtures', 'assistant-eval', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(join(out, 'transcripts'), { recursive: true });
writeFileSync(join(out, 'config.json'), JSON.stringify({ model, effort, toolSearch, reps, null: nothing, claudeCode, cases: cases.map((c) => c.id) }, null, 2));

const SERVER = resolve('packages/mcp/bin/rebodocs-mcp.mjs');

/** One case once through Claude Code: the document a file, the server of the repository the only tools it has. */
async function attemptInClaudeCode(c: (typeof CASES)[number], rep: number) {
  const dir = mkdtempSync(join(tmpdir(), `rebodocs-eval-${c.id}-`));
  const path = join(dir, 'documento.docx');
  writeFileSync(path, exportDocx(c.doc()));
  // As it is read back from its file: what is compared after is a file too.
  const before = importDocx(new Uint8Array(readFileSync(path)));
  const config = join(dir, 'mcp.json');
  writeFileSync(config, JSON.stringify({ mcpServers: { rebodocs: { command: process.execPath, args: [SERVER, '--no-editor', '--root', dir] } } }));
  const ask = `${c.ask}\n\nEl documento está en ${path}. Si lo cambias, guárdalo en ese mismo archivo.`;
  const started = Date.now();
  const run = await new Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>((done) => {
    const child = spawn(
      'claude',
      [
        '-p',
        ask,
        '--output-format',
        'json',
        '--model',
        model,
        '--mcp-config',
        config,
        '--strict-mcp-config',
        '--allowedTools',
        'mcp__rebodocs',
        '--permission-mode',
        'dontAsk',
        '--no-session-persistence',
        '--setting-sources',
        '',
      ],
      { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    const ceiling = setTimeout(() => child.kill('SIGTERM'), CEILING);
    child.on('close', (code) => {
      clearTimeout(ceiling);
      done({ code, stdout, stderr, timedOut: Date.now() - started >= CEILING });
    });
  });
  const seconds = (Date.now() - started) / 1000;
  let said: { result?: string; is_error?: boolean; num_turns?: number; total_cost_usd?: number; usage?: Record<string, number>; modelUsage?: Record<string, unknown> } = {};
  try {
    said = JSON.parse(run.stdout);
  } catch {
    // Read below as an error of the run.
  }
  const usage: Usage = {
    input: said.usage?.input_tokens ?? 0,
    output: said.usage?.output_tokens ?? 0,
    cacheRead: said.usage?.cache_read_input_tokens ?? 0,
    cacheWrite: said.usage?.cache_creation_input_tokens ?? 0,
    calls: said.num_turns ?? 0,
    models: Object.keys(said.modelUsage ?? {}),
  };
  writeFileSync(join(out, 'transcripts', `${c.id}-${rep}.json`), JSON.stringify({ ask, run: said, stderr: run.stderr }, null, 2));
  const base = { case: c.id, rep, model, effort, toolSearch, seconds, usage, cost: said.total_cost_usd ?? null, served: usage.models };
  if (run.timedOut || run.code !== 0 || said.is_error || said.result === undefined) {
    appendFileSync(join(out, 'errors.jsonl'), `${JSON.stringify({ ...base, error: run.timedOut ? 'timeout' : (said.result ?? run.stderr.slice(0, 500)) || `exit ${run.code}` })}\n`);
    rmSync(dir, { recursive: true, force: true });
    return undefined;
  }
  const after = importDocx(new Uint8Array(readFileSync(path)));
  rmSync(dir, { recursive: true, force: true });
  const graded = c.check(after, before, said.result);
  const row = { ...base, pass: graded.pass, why: graded.why, refused: false, status: 'done', tools: [] as string[] };
  appendFileSync(join(out, 'results.jsonl'), `${JSON.stringify(row)}\n`);
  return row;
}

/** One case once: the chat of the page, against the route of the backend, on a server of its own. */
async function attempt(c: (typeof CASES)[number], rep: number) {
  if (claudeCode) return attemptInClaudeCode(c, rep);
  const { client, usage } = counted();
  const route = assistantRoute({ client, model, effort, toolSearch, perMinute: 1000 });
  const server = createServer((request, response) => void route(request, response));
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/assistant`;
  const before = c.doc();
  const host = {
    doc: before,
    edit(change: (doc: Doc) => Doc) {
      host.doc = change(host.doc);
    },
    pagesOf: () => () => 1,
    exportDocx: () => exportDocx(host.doc),
    author: 'Evaluación',
  };
  const chat = createAssistantChat(host satisfies AssistantHost, { endpoint, maxSteps: 30 });
  const started = Date.now();
  const ceiling = setTimeout(() => chat.stop(), CEILING);
  try {
    await chat.send(c.ask);
  } finally {
    clearTimeout(ceiling);
    server.close();
  }
  const seconds = (Date.now() - started) / 1000;
  const entries = chat.entries;
  writeFileSync(join(out, 'transcripts', `${c.id}-${rep}.json`), JSON.stringify({ ask: c.ask, entries }, null, 2));
  const broke = entries.find((entry) => entry.kind === 'note' && entry.bad && !/would not do that|cut short/.test(entry.text));
  const timedOut = Date.now() - started >= CEILING;
  const base = { case: c.id, rep, model, effort, toolSearch, seconds, usage, cost: cost(usage), served: [...new Set(usage.models)] };
  // What never got to an answer is the harness's or the API's, not the model's.
  if (broke || timedOut) {
    appendFileSync(join(out, 'errors.jsonl'), `${JSON.stringify({ ...base, error: timedOut ? 'timeout' : (broke as { text: string }).text })}\n`);
    return undefined;
  }
  const refused = entries.some((entry) => entry.kind === 'note' && /would not do that/.test(entry.text));
  const truncated = entries.some((entry) => entry.kind === 'note' && /cut short|stopped after/.test(entry.text));
  const answer = entries
    .filter((entry) => entry.kind === 'assistant')
    .map((entry) => (entry as { text: string }).text)
    .join('\n');
  const graded = c.check(host.doc, before, answer);
  const row = {
    ...base,
    pass: graded.pass,
    why: graded.why,
    refused,
    status: truncated ? 'truncated' : 'done',
    tools: entries.filter((entry) => entry.kind === 'tool').map((entry) => (entry as { name: string }).name),
  };
  appendFileSync(join(out, 'results.jsonl'), `${JSON.stringify(row)}\n`);
  if (!nothing && usage.models.some((served) => served !== model)) console.error(`  ${c.id} #${rep}: answered by ${row.served.join(', ')}, not ${model}`);
  return row;
}

const rows: NonNullable<Awaited<ReturnType<typeof attempt>>>[] = [];
let errors = 0;
for (const c of cases) {
  for (let rep = 1; rep <= reps; rep++) {
    const row = await attempt(c, rep);
    if (!row) errors++;
    else rows.push(row);
    console.error(`${c.id} #${rep}: ${row ? (row.pass ? 'pass' : `FAIL — ${row.why}`) : 'error (errors.jsonl)'}`);
  }
}

// Each case: how many of its reps passed. All of them: the mean over cases, with the spread of the reps.
const byCase = cases.map((c) => {
  const mine = rows.filter((row) => row.case === c.id);
  return { id: c.id, about: c.about, passed: mine.filter((row) => row.pass).length, of: mine.length };
});
const perRep = Array.from({ length: reps }, (_, i) => {
  const mine = rows.filter((row) => row.rep === i + 1);
  return mine.length ? mine.filter((row) => row.pass).length / mine.length : NaN;
}).filter((n) => !Number.isNaN(n));
const mean = perRep.reduce((a, b) => a + b, 0) / (perRep.length || 1);
const spread = perRep.length > 1 ? Math.sqrt(perRep.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (perRep.length - 1)) : 0;
const dollars = rows.reduce((sum, row) => sum + (row.cost ?? 0), 0);
const lines = [
  `${claudeCode ? `Claude Code (${model}), on .docx files through the MCP server` : `${model}, effort ${effort}${toolSearch ? ', tool search' : ''}`}${nothing ? ', NULL CLAUDE' : ''}: ${reps} reps.`,
  ...byCase.map((c) => `  ${c.passed}/${c.of}  ${c.id} — ${c.about}`),
  `Passed ${(mean * 100).toFixed(0)}%${perRep.length > 1 ? ` ± ${(spread * 100).toFixed(0)} (one standard deviation over the reps)` : ''}. ${errors} attempts did not get to an answer.`,
  `${claudeCode ? 'What it would have cost on the API (Claude Code says): ' : ''}Tokens: ${rows.reduce((s, r) => s + r.usage.input + r.usage.cacheRead + r.usage.cacheWrite, 0)} in (${rows.reduce((s, r) => s + r.usage.cacheRead, 0)} from the cache), ${rows.reduce((s, r) => s + r.usage.output, 0)} out. Cost: ${PRICES[model] || claudeCode ? `$${dollars.toFixed(2)}` : 'unknown for this model'}.`,
  `Mean per conversation: ${(rows.reduce((s, r) => s + r.seconds, 0) / (rows.length || 1)).toFixed(1)} s, ${(rows.reduce((s, r) => s + r.usage.calls, 0) / (rows.length || 1)).toFixed(1)} steps.`,
  `Everything in ${out}.`,
];
writeFileSync(join(out, 'summary.txt'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));
