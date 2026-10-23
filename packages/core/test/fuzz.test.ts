// Damaged files: a DOCX read from anywhere may have lost a piece, have a value
// no program wrote, or end in the middle. Reading one must either give a
// document, which can be written and laid out, or say why it cannot; never
// fail inside the engine with an error of its own, such as reading a property
// of nothing. The damage is random but seeded: a failure names its seed, and
// the same seed makes the same file again.
//
//   FUZZ_RUNS=5000 npx vitest run packages/core/test/fuzz.test.ts      more of them
//   FUZZ_DIR=/path/to/docx npx vitest run packages/core/test/fuzz.test.ts   your own files as seeds

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type FontSpec,
  type Paragraph,
  type TextMeasurer,
  addNote,
  applyRunProps,
  createDoc,
  exportDocx,
  importDocx,
  insertFootnote,
  insertSignatures,
  insertTable,
  insertTextBox,
  layoutDocument,
  setLink,
  setParagraphStyle,
  toggleList,
  trackEdit,
} from '../src/internal';

const measurer: TextMeasurer = {
  width: (text: string, font: FontSpec) => text.length * font.size * 0.5,
  metrics: (font: FontSpec) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};
const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });

/** A document with a little of everything the format has: what the damage has to get through. */
function rich(): Doc {
  let doc = createDoc([
    p('Contrato de arrendamiento'),
    p('Primera. Objeto'),
    p('El arrendador da en arrendamiento el inmueble.'),
    p('Uno'),
    p('Dos'),
    p('Tres'),
    p('En constancia firman.'),
    p('Fin.'),
  ]);
  doc = setParagraphStyle(doc, 0, 0, 'Title');
  doc = setParagraphStyle(doc, 1, 1, 'Heading1');
  doc = toggleList(doc, 3, 5, 'number');
  doc = applyRunProps(doc, { from: { para: 2, offset: 4 }, to: { para: 2, offset: 14 } }, { bold: true, color: 'C0392B' });
  doc = setLink(doc, { from: { para: 2, offset: 0 }, to: { para: 2, offset: 2 } }, 'https://example.com');
  doc = addNote(doc, { from: { para: 1, offset: 0 }, to: { para: 1, offset: 7 } }, { text: '¿Así?', author: 'Ana' }).doc;
  doc = insertFootnote(doc, { para: 2, offset: 10 }, 'Según la ley.').doc;
  doc = insertTable(doc, { para: 6, offset: 0 }, 2, 2).doc;
  doc = insertTextBox(doc, { para: 2, offset: 0 }, { text: 'En una caja' }).doc;
  doc = insertSignatures(doc, { para: doc.paragraphs.length - 1, offset: 0 }, ['EL ARRENDADOR', 'EL ARRENDATARIO']).doc;
  const tracked = applyRunProps(setParagraphStyle(doc, 7, 7, 'Heading2'), { from: { para: 0, offset: 0 }, to: { para: 0, offset: 8 } }, { italic: true });
  return trackEdit(doc, tracked, { author: 'Luis', date: '2026-10-23T10:00:00Z' }).doc;
}

/** A small generator of numbers, from a seed: the same seed, the same numbers. */
function random(seed: number) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
  return { next, int: (n: number) => Math.floor(next() * n), pick: <T>(list: T[]) => list[Math.floor(next() * list.length)] };
}

/** The ways a part may come damaged. */
const DAMAGE: ((xml: string, r: ReturnType<typeof random>) => string)[] = [
  // An element taken out, with all it holds.
  (xml, r) => {
    const starts = [...xml.matchAll(/<(w:[a-zA-Z]+)\b[^>]*?(\/?)>/g)];
    const start = starts[r.int(starts.length)];
    if (!start) return xml;
    if (start[2]) return xml.slice(0, start.index) + xml.slice(start.index! + start[0].length);
    const close = xml.indexOf(`</${start[1]}>`, start.index);
    return close < 0 ? xml : xml.slice(0, start.index) + xml.slice(close + start[1].length + 3);
  },
  // An attribute taken out.
  (xml, r) => {
    const attrs = [...xml.matchAll(/\s[\w:]+="[^"]*"/g)];
    const a = attrs[r.int(attrs.length)];
    return a ? xml.slice(0, a.index) + xml.slice(a.index! + a[0].length) : xml;
  },
  // A value no program would write: empty, negative, huge, a word, a number where a word goes.
  (xml, r) => {
    const values = [...xml.matchAll(/="([^"]*)"/g)];
    const v = values[r.int(values.length)];
    if (!v) return xml;
    const bad = r.pick(['', '-1', '0', '99999999', 'NaN', 'abc', '1.5', '-0', 'true', '#FFF', '1e309']);
    return `${xml.slice(0, v.index! + 2)}${bad}${xml.slice(v.index! + 2 + v[1].length)}`;
  },
  // The part cut short.
  (xml, r) => xml.slice(0, Math.max(1, r.int(xml.length))),
  // An element where it does not belong: a paragraph or a run moved somewhere else.
  (xml, r) => {
    const found = [...xml.matchAll(/<w:(p|r|tc|tr)\b[\s\S]*?<\/w:\1>/g)];
    const piece = found[r.int(found.length)];
    if (!piece) return xml;
    const at = r.int(xml.length);
    return xml.slice(0, at) + piece[0] + xml.slice(at);
  },
];

/** The parts damage goes to: the text, and what says how it looks and is numbered. */
const PARTS = ['word/document.xml', 'word/styles.xml', 'word/numbering.xml', 'word/footnotes.xml', 'word/comments.xml', 'word/settings.xml', '[Content_Types].xml', 'word/_rels/document.xml.rels'];

function damaged(seed: Uint8Array, at: number): Uint8Array {
  const r = random(at);
  const files = unzipSync(seed);
  const parts = PARTS.filter((name) => files[name]);
  for (let n = 1 + r.int(3); n > 0; n--) {
    const part = r.pick(parts);
    files[part] = strToU8(r.pick(DAMAGE)(strFromU8(files[part]), r));
  }
  return zipSync(files);
}

/** An error the engine meant to give: one that says what is wrong with the file. Not one of its own insides. */
const meant = (error: unknown) => error instanceof Error && !(error instanceof TypeError) && !(error instanceof RangeError) && !(error instanceof ReferenceError);

function seeds(): { name: string; bytes: Uint8Array }[] {
  const out = [{ name: 'rich', bytes: exportDocx(rich()) }];
  const dir = process.env.FUZZ_DIR;
  if (dir) for (const name of readdirSync(dir).filter((file) => file.endsWith('.docx'))) out.push({ name, bytes: new Uint8Array(readFileSync(join(dir, name))) });
  return out;
}

describe('damaged files', () => {
  const runs = Number(process.env.FUZZ_RUNS ?? 300);

  it('the seed itself reads, writes and lays out', () => {
    const doc = importDocx(exportDocx(rich()));
    expect(doc.paragraphs.length).toBeGreaterThan(5);
    expect(layoutDocument(doc, measurer).pages.length).toBeGreaterThan(0);
  });

  for (const seed of seeds()) {
    it(
      `${seed.name}: ${runs} damaged copies are read, or refused with a reason`,
      () => {
        const failures: string[] = [];
        let [read, refused, changed] = [0, 0, 0];
        const plain = JSON.stringify(importDocx(seed.bytes).paragraphs.map((para) => para.runs.map((run) => run.text).join('')));
        for (let at = 1; at <= runs && failures.length < 5; at++) {
          const bytes = damaged(seed.bytes, at);
          let doc: Doc;
          try {
            doc = importDocx(bytes);
          } catch (error) {
            if (!meant(error)) failures.push(`seed ${at}, reading: ${(error as Error).stack?.split('\n').slice(0, 3).join(' | ')}`);
            refused++;
            continue;
          }
          read++;
          if (JSON.stringify(doc.paragraphs.map((para) => para.runs.map((run) => run.text).join(''))) !== plain) changed++;
          try {
            importDocx(exportDocx(doc));
            layoutDocument(doc, measurer);
          } catch (error) {
            failures.push(`seed ${at}, after reading: ${(error as Error).stack?.split('\n').slice(0, 3).join(' | ')}`);
          }
        }
        if (process.env.FUZZ_STATS) console.log(`${seed.name}: ${read} read, ${refused} refused, ${changed} read differently from the seed`);
        expect(failures).toEqual([]);
      },
      10_000 + runs * 10,
    );
  }
});

describe('a package that lies about its size', () => {
  it('is cut to the size it says, not unpacked whole, so it cannot fill the memory', () => {
    const files = unzipSync(exportDocx(createDoc([p('hola')])));
    const big = 8 * 1024 * 1024;
    files['word/media/big.bin'] = new Uint8Array(big);
    const zip = zipSync(files, { level: 9 });
    // Every header of the part says it is 1 KB unpacked.
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    let lies = 0;
    for (let i = 0; i < zip.length - 30; i++) {
      const signature = view.getUint32(i, true);
      const at = signature === 0x04034b50 ? i + 22 : signature === 0x02014b50 ? i + 24 : -1;
      if (at > 0 && view.getUint32(at, true) === big) {
        view.setUint32(at, 1024, true);
        lies++;
      }
    }
    expect(lies).toBe(2);
    expect(unzipSync(zip)['word/media/big.bin'].length).toBe(1024);
    // An honest one that big is refused by the limit.
    expect(() => importDocx(zipSync(files, { level: 9 }), { maxSize: 4 * 1024 * 1024 })).toThrow('too large unpacked');
  });
});
