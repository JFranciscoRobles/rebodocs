#!/usr/bin/env node
// Starts the server from anywhere: what whoever hosts it runs.
// The server is TypeScript run as it is, by vite-node, which has to be told
// where the repository is.
//
//   node packages/collab/bin/rebodocs-collab.mjs [--port 7420] [--host 0.0.0.0] …

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const runner = join(repo, 'node_modules', 'vite-node', 'vite-node.mjs');
const child = spawn(process.execPath, [runner, '--root', repo, join(repo, 'packages', 'collab', 'src', 'main.ts'), ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
