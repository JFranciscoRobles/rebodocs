#!/usr/bin/env node
// Starts the server from anywhere: what a client's configuration points to.
// The server is TypeScript run as it is, by vite-node, which has to be told
// where the repository is: a client starts it from a folder of its own.
//
//   node packages/mcp/bin/rebodocs-mcp.mjs [--root carpeta] [--port 7411] …

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// Where vite-node keeps its command is its own business: its package says.
const pkg = join(repo, 'node_modules', 'vite-node');
const { bin } = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
const runner = join(pkg, typeof bin === 'string' ? bin : bin['vite-node']);
const child = spawn(process.execPath, [runner, '--root', repo, join(repo, 'packages', 'mcp', 'src', 'main.ts'), ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
