// Runs axe, the accessibility checker, on pages with the editor in them, in a
// Chrome without a window, and says what breaks WCAG 2.2 at levels A and AA:
//
//   npm run a11y -- http://localhost:5174/docs/accessibility/ [more pages]
//
// Each page is opened, given time to draw its editor, and the editor is
// checked as it is, the page around it left out; then the document is focused
// and checked again, with the caret in it. The pages of the document are not
// checked: they are hidden from screen readers on purpose, and said instead
// (see the page Accessibility); nor the handles of the ruler, which WCAG
// allows to be small because Page setup and Indents do the same. It ends with 1
// when anything is found. Chrome is found where macOS, Linux and Windows keep
// it, or given with CHROME=path.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error('Usage: npm run a11y -- <url> [url…]');
  process.exit(2);
}

const CHROMES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);
const chrome = CHROMES.find((path) => existsSync(path));
if (!chrome) {
  console.error('No Chrome found: give its path with CHROME=…');
  process.exit(2);
}

const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const profile = mkdtempSync(join(tmpdir(), 'rebodocs-a11y-'));
const port = 9400 + Math.floor(Math.random() * 400);
const browser = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      return await (await fetch(`http://localhost:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    } catch {
      await wait(200);
    }
  }
  throw new Error('Chrome did not start');
}

/** What axe finds in the page as it is now: the rules broken, each with where. */
const CHECK = `(async () => {
  const editors = [...document.querySelectorAll('.dx-app, .dx-editor')].filter((el) => !el.parentElement?.closest('.dx-app'));
  if (!editors.length) return { passed: 0, violations: [{ id: 'no-editor', impact: 'serious', help: 'There is no editor in this page', nodes: [] }] };
  const result = await axe.run(
    {
      include: editors,
      exclude: [
        // The pages of the document are hidden from screen readers on purpose: what they show is said.
        ['.dx-page'],
        // The handles of the ruler are smaller than 24 pixels, as WCAG allows for a control that has one of
        // that size doing the same (2.5.8, "equivalent"): Page setup for the margins, Indents for the indents.
        ['.dx-ruler-h'],
        ['.dx-ruler-m'],
      ],
    },
    { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } },
  );
  return {
    passed: result.passes.length,
    violations: result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) })),
  };
})()`;

let found = 0;
try {
  const target = await connect();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done) => (ws.onopen = done));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m);
  };
  const send = (method, params = {}) => new Promise((done) => { const n = ++id; pending.set(n, done); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result;
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  for (const url of urls) {
    await send('Page.navigate', { url });
    await wait(4000);
    await evaluate(axe);
    for (const moment of ['as it opens', 'with the caret in the document']) {
      if (moment !== 'as it opens') await evaluate(`document.querySelector('.dx-input')?.focus()`);
      const { result, exceptionDetails } = await evaluate(CHECK);
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      const { passed, violations } = result.value;
      console.log(`\n${url} — ${moment}: ${violations.length ? `${violations.length} broken` : 'nothing broken'}, ${passed} rules met`);
      for (const v of violations) {
        found++;
        console.log(`  ${v.impact} · ${v.id}: ${v.help}`);
        for (const where of v.nodes) console.log(`      ${where}`);
      }
    }
  }
  ws.close();
} finally {
  browser.kill();
  await wait(300);
  rmSync(profile, { recursive: true, force: true });
}
process.exit(found ? 1 : 0);
