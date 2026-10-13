// Compares the editor's layout of a DOCX with Microsoft Word's, page by page
// and line by line.
//
//   node tools/word-compare.mjs contrato.docx            use the PDF Word made earlier
//   node tools/word-compare.mjs contrato.docx --word     ask Word for the PDF first
//
// Word's PDF is kept in fixtures/<name>.word.pdf (ignored by git), so Word only
// has to be opened once per document. Needs macOS with Microsoft Word, Google
// Chrome and pdftotext (brew install poppler).

import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Word is sandboxed: this is a folder it can read and write without asking.
const WORD_FOLDER = join(homedir(), 'Library/Group Containers/UBF8T346G9.Office');
const VITE_PORT = 5199;
const CHROME_PORT = 9334;

const args = process.argv.slice(2);
const docx = resolve(args.find((a) => !a.startsWith('--')) ?? '');
if (!existsSync(docx) || !docx.endsWith('.docx')) {
  console.error('Usage: node tools/word-compare.mjs <file.docx> [--word]');
  process.exit(2);
}
const name = basename(docx, '.docx');
const pdf = join(ROOT, 'fixtures', `${name}.word.pdf`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Word's side --------------------------------------------------------------

function exportWithWord() {
  const input = join(WORD_FOLDER, `dx-compare-${name}.docx`);
  const output = join(WORD_FOLDER, `dx-compare-${name}.pdf`);
  copyFileSync(docx, input);
  try {
    const script = `
      with timeout of 120 seconds
        tell application "Microsoft Word"
          set wasRunning to running
          launch
          open POSIX file "${input}"
          set d to active document
          save as d file name "${output}" file format format PDF
          close d saving no
          if not wasRunning then quit
        end tell
      end timeout`;
    try {
      execFileSync('osascript', ['-e', script], { stdio: 'inherit', timeout: 150_000 });
    } catch (error) {
      // A dialog Word is waiting on would hold this forever; AppleScript's own time limit does not cover it.
      spawn('pkill', ['-9', '-x', 'Microsoft Word']);
      throw new Error(`Word did not finish exporting ${name}: ${error.message}`);
    }
    mkdirSync(dirname(pdf), { recursive: true });
    copyFileSync(output, pdf);
  } finally {
    rmSync(input, { force: true });
    rmSync(output, { force: true });
  }
}

/** Rows of text of each page of a PDF: [top, bottom, text]. Words at the same height are one row. */
function pdfRows(path) {
  const html = execFileSync('pdftotext', ['-bbox-layout', path, '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const decode = (t) => t.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return [...html.matchAll(/<page [^>]*>(.*?)<\/page>/gs)].map(([, page]) => {
    const lines = [...page.matchAll(/<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="[\d.]+" yMax="([\d.]+)">(.*?)<\/line>/gs)]
      .map(([, x, top, bottom, body]) => ({
        x: Number(x),
        top: Number(top),
        bottom: Number(bottom),
        text: decode([...body.matchAll(/<word[^>]*>(.*?)<\/word>/g)].map((w) => w[1]).join(' ')),
      }))
      .sort((a, b) => a.top - b.top || a.x - b.x);
    const rows = [];
    for (const line of lines) {
      const last = rows[rows.length - 1];
      if (last && Math.abs(last.top - line.top) < 3) last.parts.push(line);
      else rows.push({ top: line.top, bottom: line.bottom, parts: [line] });
    }
    return rows.map((row) => [row.top, row.bottom, row.parts.sort((a, b) => a.x - b.x).map((p) => p.text)]);
  });
}

// --- The editor's side --------------------------------------------------------

/** Every line the editor lays out, per page: [top, text, kind], with header and footer lines marked. */
async function editorRows() {
  const vite = spawn(join(ROOT, 'node_modules/.bin/vite'), ['--port', String(VITE_PORT), '--strictPort'], {
    cwd: join(ROOT, 'apps/playground'),
    stdio: 'ignore',
  });
  const profile = mkdtempSync(join(tmpdir(), 'dx-compare-'));
  const chrome = spawn(
    CHROME,
    ['--headless=new', `--remote-debugging-port=${CHROME_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'],
    { stdio: 'ignore' },
  );
  try {
    let target;
    for (let i = 0; i < 75 && !target; i++) {
      await sleep(200);
      try {
        target = (await (await fetch(`http://127.0.0.1:${CHROME_PORT}/json`)).json()).find((t) => t.type === 'page');
      } catch {}
    }
    if (!target) throw new Error('Chrome did not start');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let seq = 0;
    const pending = new Map();
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      pending.get(msg.id)?.(msg);
      pending.delete(msg.id);
    };
    const send = (method, params = {}) =>
      new Promise((done) => {
        pending.set(++seq, done);
        ws.send(JSON.stringify({ id: seq, method, params }));
      });
    const evaluate = async (expression) => {
      const { result } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails.exception ?? result.exceptionDetails));
      return result.result.value;
    };

    await send('Page.enable');
    for (let i = 0; i < 75; i++) {
      await send('Page.navigate', { url: `http://localhost:${VITE_PORT}/` });
      await sleep(400);
      if (await evaluate('typeof window.editor?.loadDocx === "function"')) break;
    }
    const data = readFileSync(docx).toString('base64');
    const rows = await evaluate(`(async () => {
      editor.loadDocx(Uint8Array.from(atob(${JSON.stringify(data)}), (c) => c.charCodeAt(0)));
      // Embedded fonts load after the document; the layout is redone when they arrive.
      await new Promise((r) => setTimeout(r, 1500));
      const text = (l) => (l.label ? l.label.text + ' ' : '') + l.fragments.filter((f) => f.kind === 'text').map((f) => f.text).join('');
      return JSON.stringify(editor.layout.pages.map((p) => [
        ...(p.header?.lines ?? []).map((l) => [l.y, text(l), 'header']),
        ...p.lines.map((l) => [l.y, text(l), 'body']),
        ...(p.footer?.lines ?? []).map((l) => [l.y, text(l), 'footer']),
      ]));
    })()`);
    ws.close();
    return JSON.parse(rows);
  } finally {
    chrome.kill();
    vite.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
  }
}

// --- Comparison ---------------------------------------------------------------

if (args.includes('--word')) exportWithWord();
if (!existsSync(pdf)) {
  console.error(`No Word PDF for this document yet (${pdf}).\nRun again with --word to have Microsoft Word make it.`);
  process.exit(2);
}

const word = pdfRows(pdf);
const ours = await editorRows();
// Letters and digits only; a line made of nothing else (a signature rule) is compared as it is.
const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') || t.replace(/\s/g, '');
/** A line with and without what may be a list label in front ("a)", "1.", "IV.-"), which only one side may show as text. */
const starts = (t) => [norm(t).slice(0, 12), norm(t.trim().replace(/^\S{1,6}[.)\-]+\s+/, '')).slice(0, 12)];
/** Whether two starts of line are the same text. */
const sameStart = (a, b) => starts(a).some((x) => x.length > 0 && starts(b).some((y) => x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x)))));

console.log(`${name}: Word ${word.length} pages, editor ${ours.length} pages`);
let pagesOk = 0;
let total = 0;
let same = 0;
let worst = 0;
const misses = [];
word.forEach((rows, i) => {
  const mine = (ours[i] ?? []).filter(([, text]) => text.trim());
  const body = mine.filter(([, , kind]) => kind === 'body');
  // What Word shows above the first and below the last body line of ours is its header and footer.
  const inBody = rows.filter(([top]) => !body.length || (top > body[0][0] - 6 && top < body[body.length - 1][0] + 6));
  const first = inBody[0]?.[2].join(' ') ?? '';
  const last = inBody[inBody.length - 1]?.[2][0] ?? '';
  const ok = body.length > 0 && sameStart(first, body[0][1]) && sameStart(last, body[body.length - 1][1]);
  if (ok) pagesOk++;
  else console.log(`  page ${i + 1} differs\n    Word:   ${first.slice(0, 50)} … ${last.slice(0, 50)}\n    editor: ${(body[0]?.[1] ?? '').slice(0, 50)} … ${(body[body.length - 1]?.[1] ?? '').slice(0, 50)}`);
  for (const [top, , parts] of rows) {
    total++;
    const near = mine.filter(([y, text]) => Math.abs(y - top) < 4 && parts.some((part) => sameStart(part, text)));
    if (near.length) {
      same++;
      worst = Math.max(worst, Math.min(...near.map(([y]) => Math.abs(y - top))));
    } else {
      misses.push(`  page ${i + 1} at ${top.toFixed(0)}pt: Word "${parts.join(' | ').slice(0, 44)}"  editor ${JSON.stringify(mine.filter(([y]) => Math.abs(y - top) < 4).map(([, text]) => text.slice(0, 30)))}`);
    }
  }
});
console.log(`pages starting and ending on the same text: ${pagesOk} of ${word.length}`);
console.log(`lines with the same text at the same height: ${same} of ${total} (${((100 * same) / total).toFixed(1)}%), at most ${worst.toFixed(1)}pt apart`);
for (const miss of misses.slice(0, 20)) console.log(miss);
if (misses.length > 20) console.log(`  … and ${misses.length - 20} more`);
process.exit(pagesOk === word.length && ours.length === word.length ? 0 : 1);
