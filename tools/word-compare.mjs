// Compares the editor's layout of a DOCX with Microsoft Word's, page by page
// and line by line.
//
//   node tools/word-compare.mjs contrato.docx            use the PDF Word made earlier
//   node tools/word-compare.mjs contrato.docx --word     ask Word for the PDF first
//   node tools/word-compare.mjs contrato.docx --rows 2   and the height of each line of page 2 in each
//   node tools/word-compare.mjs test-documents           every document of a folder, and a line for each
//   node tools/word-compare.mjs test-documents --expect  and whether any is worse than test-documents/expected.json
//   node tools/word-compare.mjs test-documents --update  and that file written again with what came out
//
// Word's PDF of a document is the one beside it, <name>.word.pdf, or else the
// one in fixtures/ (ignored by git, for documents of your own); Word only has
// to be opened once per document. Comparing needs Google Chrome and pdftotext
// (brew install poppler); making Word's PDF needs macOS with Microsoft Word.

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Word is sandboxed: a folder it can read and write without asking. Its own container's, where macOS lets it; the
// group container of Office, where it used to be.
const WORD_FOLDER = [join(homedir(), 'Library/Containers/com.microsoft.Word/Data/Documents'), join(homedir(), 'Library/Group Containers/UBF8T346G9.Office')].find((dir) => existsSync(dir));
const VITE_PORT = 5199;
const CHROME_PORT = 9334;

const args = process.argv.slice(2);
/** The documents asked for: files, and the .docx of folders. */
const docs = args
  .filter((a, k) => !a.startsWith('--') && args[k - 1] !== '--rows')
  .map((a) => resolve(a))
  .flatMap((path) =>
    existsSync(path) && statSync(path).isDirectory()
      ? readdirSync(path)
          .filter((f) => f.endsWith('.docx'))
          .sort()
          .map((f) => join(path, f))
      : [path],
  );
if (!docs.length || docs.some((d) => !existsSync(d) || !d.endsWith('.docx'))) {
  console.error('Usage: node tools/word-compare.mjs <file.docx | folder>... [--word] [--expect | --update]');
  process.exit(2);
}
/** Word's PDF of a document: the one beside it, or the one kept in fixtures/. */
const pdfOf = (docx) => {
  const beside = docx.replace(/\.docx$/, '.word.pdf');
  return existsSync(beside) ? beside : join(ROOT, 'fixtures', `${basename(docx, '.docx')}.word.pdf`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** With --rows N, the height of every line of page N in Word's PDF and in the editor, to see where they part. */
const ROWS = args.includes('--rows') ? Number(args[args.indexOf('--rows') + 1]) : undefined;

// --- Word's side --------------------------------------------------------------

/** Has Word make the PDF of `docx`, beside it. */
function exportWithWord(docx) {
  const name = basename(docx, '.docx');
  const pdf = docx.replace(/\.docx$/, '.word.pdf');
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
    // Word open already is someone's: whatever goes wrong, it is left as it is, their documents in it.
    const wasRunning = spawnSync('pgrep', ['-x', 'Microsoft Word']).status === 0;
    try {
      execFileSync('osascript', ['-e', script], { stdio: 'inherit', timeout: 150_000 });
    } catch (error) {
      // A dialog Word waits on would hold it forever, past AppleScript's own time limit: only a Word this opened, and
      // only when it did not answer in time, is closed by force.
      if (!wasRunning && error.signal === 'SIGTERM') spawn('pkill', ['-9', '-x', 'Microsoft Word']);
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
  const decode = (t) =>
    t
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
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

/** Every line the editor lays out of each of `files`, per page: [top, text, kind], with header and footer lines marked. */
async function editorRows(files) {
  const vite = spawn(join(ROOT, 'node_modules/.bin/vite'), ['--port', String(VITE_PORT), '--strictPort'], {
    cwd: join(ROOT, 'apps/playground'),
    stdio: 'ignore',
  });
  const profile = mkdtempSync(join(tmpdir(), 'dx-compare-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CHROME_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
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
    const out = [];
    for (const docx of files) {
      const data = readFileSync(docx).toString('base64');
      const rows = await evaluate(`(async () => {
      editor.loadDocx(Uint8Array.from(atob(${JSON.stringify(data)}), (c) => c.charCodeAt(0)));
      // Embedded fonts load after the document; the layout is redone when they arrive.
      await new Promise((r) => setTimeout(r, 1500));
      const text = (l) => (l.label ? l.label.text + ' ' : '') + l.fragments.filter((f) => f.kind === 'text').map((f) => f.text).join('');
      // Where a line set on its side starts on the page, as Word's PDF has it: the top of its turned text.
      const top = (l) => {
        if (!l.turn) return l.y;
        const words = l.fragments.filter((f) => f.kind === 'text' && f.text.trim());
        if (!words.length) return l.y;
        const from = Math.min(...words.map((f) => f.x));
        const to = Math.max(...words.map((f) => f.x + f.width));
        return l.turn.angle < 0 ? l.turn.y - (to - l.turn.x) : l.turn.y + (from - l.turn.x);
      };
      return JSON.stringify(editor.layout.pages.map((p) => [
        ...(p.header?.lines ?? []).map((l) => [l.y, text(l), 'header']),
        ...p.lines.map((l) => [top(l), text(l), 'body']),
        ...(p.footer?.lines ?? []).map((l) => [l.y, text(l), 'footer']),
        // The notes at the foot of the page and at the end; the number a note starts with is a word of its own in Word's PDF, and left out here.
        ...[...(p.footnotes?.notes ?? []), ...(p.endnotes?.notes ?? [])].flatMap((n) => n.lines.map((l) => [l.y, text(l), 'note'])),
      ]));
    })()`);
      out.push(JSON.parse(rows));
    }
    ws.close();
    return out;
  } finally {
    chrome.kill();
    vite.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
  }
}

// --- Comparison ---------------------------------------------------------------

for (const docx of args.includes('--word') ? docs : []) exportWithWord(docx);
const missing = docs.filter((docx) => !existsSync(pdfOf(docx)));
for (const docx of missing) console.error(`No Word PDF for ${basename(docx)} yet: run again with --word to have Microsoft Word make it.`);
if (missing.length === docs.length) process.exit(2);
const ready = docs.filter((docx) => !missing.includes(docx));

// Letters and digits only; a line made of nothing else (a signature rule) is compared as it is.
const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') || t.replace(/\s/g, '');
/** A line with and without what may be a list label in front ("a)", "1.", "IV.-"), which only one side may show as text. */
const starts = (t) => [norm(t).slice(0, 12), norm(t.trim().replace(/^\S{1,6}[.)-]+\s+/, '')).slice(0, 12)];
/** Whether two starts of line are the same text. */
const sameStart = (a, b) => starts(a).some((x) => x.length > 0 && starts(b).some((y) => x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x)))));

/** How much of Word's layout of a document the editor's has: its pages and its lines, the details to `say`. */
function compare(word, ours, say) {
  let pagesOk = 0;
  let total = 0;
  let same = 0;
  let worst = 0;
  const misses = [];

  word.forEach((rows, i) => {
    const mine = (ours[i] ?? []).filter(([, text]) => text.trim());
    // A page of notes alone, at the end of a document, starts and ends with them.
    const body = mine.some(([, , kind]) => kind === 'body') ? mine.filter(([, , kind]) => kind === 'body') : mine.filter(([, , kind]) => kind === 'note');
    // What Word shows above the first and below the last body line of ours is its header and footer.
    const inBody = rows.filter(([top]) => !body.length || (top > body[0][0] - 6 && top < body[body.length - 1][0] + 6));
    const first = inBody[0]?.[2].join(' ') ?? '';
    const last = inBody[inBody.length - 1]?.[2][0] ?? '';
    // The first and the last row of each side, whole: the cells of a row are side by side, and each side may list them in its own order.
    const rowAt = (top) => body.filter(([y]) => Math.abs(y - top) < 3).map(([, text]) => text);
    const sameRow = (theirs, mine) => (theirs ?? []).some((part) => mine.some((text) => sameStart(part, text))) || mine.some((text) => sameStart((theirs ?? []).join(' '), text));
    const ok = body.length > 0 && sameRow(inBody[0]?.[2], rowAt(body[0][0])) && sameRow(inBody[inBody.length - 1]?.[2], rowAt(body[body.length - 1][0]));
    if (ok) pagesOk++;
    else
      say(`  page ${i + 1} differs\n    Word:   ${first.slice(0, 50)} … ${last.slice(0, 50)}\n    editor: ${(body[0]?.[1] ?? '').slice(0, 50)} … ${(body[body.length - 1]?.[1] ?? '').slice(0, 50)}`);
    for (const [top, , parts] of rows) {
      if (ROWS === i + 1)
        say(
          `  ${top.toFixed(2).padStart(7)}  ${parts.join(' | ').slice(0, 40).padEnd(40)}  ${JSON.stringify(mine.filter(([y, text]) => Math.abs(y - top) < 12 && parts.some((part) => sameStart(part, text))).map(([y]) => +y.toFixed(2)))}`,
        );
      total++;
      // Each part of Word's row, or all of it: words set far apart, as in a justified line, come as parts of their own.
      const near = mine.filter(([y, text]) => Math.abs(y - top) < 4 && (parts.some((part) => sameStart(part, text)) || sameStart(parts.join(' '), text)));
      if (near.length) {
        same++;
        worst = Math.max(worst, Math.min(...near.map(([y]) => Math.abs(y - top))));
      } else {
        misses.push(
          `  page ${i + 1} at ${top.toFixed(0)}pt: Word "${parts.join(' | ').slice(0, 44)}"  editor ${JSON.stringify(mine.filter(([y]) => Math.abs(y - top) < 4).map(([, text]) => text.slice(0, 30)))}`,
        );
      }
    }
  });
  return { pages: [pagesOk, word.length], editorPages: ours.length, lines: [same, total], apart: Math.round(worst * 10) / 10, misses };
}

const results = {};
const laidOut = await editorRows(ready);
const one = ready.length === 1;
ready.forEach((docx, k) => {
  const name = basename(docx, '.docx');
  const word = pdfRows(pdfOf(docx));
  if (one) console.log(`${name}: Word ${word.length} pages, editor ${laidOut[k].length} pages`);
  const r = compare(word, laidOut[k], one ? console.log : () => {});
  results[name] = { pages: r.pages, lines: r.lines, apart: r.apart };
  if (one) {
    console.log(`pages starting and ending on the same text: ${r.pages[0]} of ${r.pages[1]}`);
    console.log(`lines with the same text at the same height: ${r.lines[0]} of ${r.lines[1]} (${((100 * r.lines[0]) / r.lines[1]).toFixed(1)}%), at most ${r.apart.toFixed(1)}pt apart`);
    for (const miss of r.misses.slice(0, 20)) console.log(miss);
    if (r.misses.length > 20) console.log(`  … and ${r.misses.length - 20} more`);
  } else {
    const pct = ((100 * r.lines[0]) / r.lines[1]).toFixed(1);
    console.log(`${name.padEnd(40)} pages ${`${r.pages[0]}/${r.pages[1]}`.padStart(7)}   lines ${`${r.lines[0]}/${r.lines[1]}`.padStart(9)} ${pct.padStart(6)}%   ${r.apart.toFixed(1)} pt`);
  }
});
if (!one) {
  const [same, all] = Object.values(results).reduce(([a, b], r) => [a + r.lines[0], b + r.lines[1]], [0, 0]);
  console.log(`\n${Object.keys(results).length} documents: ${same} of ${all} lines where Word puts them (${((100 * same) / all).toFixed(1)}%)`);
}

// Against the numbers each document had: none may have fewer pages or lines where Word puts them.
const baseline = join(dirname(ready[0]), 'expected.json');
if (args.includes('--update')) {
  writeFileSync(baseline, `${JSON.stringify(results, null, 2)}\n`);
  console.log(`Wrote ${baseline}`);
} else if (args.includes('--expect')) {
  const expected = existsSync(baseline) ? JSON.parse(readFileSync(baseline, 'utf8')) : {};
  const worse = Object.entries(results).filter(([name, r]) => expected[name] && (r.pages[0] < expected[name].pages[0] || r.lines[0] < expected[name].lines[0]));
  for (const [name, r] of worse) console.error(`WORSE ${name}: pages ${r.pages[0]} (was ${expected[name].pages[0]}), lines ${r.lines[0]} (was ${expected[name].lines[0]})`);
  const better = Object.entries(results).filter(([name, r]) => expected[name] && (r.pages[0] > expected[name].pages[0] || r.lines[0] > expected[name].lines[0]));
  for (const [name] of better) console.log(`better ${name}: run with --update to keep it`);
  process.exit(worse.length ? 1 : 0);
}
process.exit(Object.values(results).every((r) => r.pages[0] === r.pages[1]) ? 0 : 1);
