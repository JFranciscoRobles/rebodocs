// Documents with floating pictures in the ways a file can ask for them, to
// measure the layout against Microsoft Word's: each picture is a block of one
// plain colour, so where Word puts it can be read off its PDF.
//
//   npm run float-cases                 writes test-documents/float-*.docx and our PDF of each
//   npm run word-compare -- test-documents/float-<case>.docx --word     Word's PDF of one, and its lines against ours
//   npm run float-cases -- --check      where each picture is in Word's PDF and in ours
//
// Needs pdftoppm (brew install poppler) for the check. The files go to
// test-documents/, with the PDF Word made of each; our own PDFs are not kept.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import {
  type Doc,
  type Paragraph,
  type PictureWrap,
  type Position,
  type Run,
  createDoc,
  exportDocx,
  importDocx,
  insertImage,
  insertTable,
  insertText,
  moveFloat,
  renderPdf,
  setPictureWrap,
} from '../packages/core/src/internal';
import { fontsFor } from '../packages/mcp/src/fonts';

const OUT = resolve('test-documents');
const COLORS = { red: [230, 0, 0], green: [0, 170, 0], blue: [0, 0, 230], magenta: [220, 0, 220] } as const;
type Color = keyof typeof COLORS;

// --- A picture of one colour ------------------------------------------------------

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function png([r, g, b]: readonly number[]): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const body = new Uint8Array([...Buffer.from(type), ...data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    out.set(body, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const size = 8;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = [0, ...Array.from({ length: size }, () => [r, g, b]).flat()];
  const pixels = deflateSync(Buffer.from(Array.from({ length: size }, () => row).flat()));
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', pixels), chunk('IEND', new Uint8Array())]));
}

// --- Building a case --------------------------------------------------------------

const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
const filler = (count: number, from = 0) => Array.from({ length: count }, (_, i) => WORDS[(from + i) % WORDS.length]).join(' ');
const para = (text: string, props: Paragraph['props'] = {}): Paragraph => ({ props, runs: [{ text, props: {} }] });
const text = (paragraphs: number, words = 70, props: Paragraph['props'] = {}) => Array.from({ length: paragraphs }, (_, i) => para(filler(words, i * 7), props));

interface Float {
  color: Color;
  at: Position;
  width: number;
  height: number;
  wrap: Exclude<PictureWrap, 'inline'>;
  /** Points from the left of the column and from the top of its paragraph. */
  x?: number;
  y?: number;
  /** A last word on its drawing: what the functions of the core do not write. */
  edit?: (xml: string) => string;
}

/** Puts a floating picture in, as the editor would: in the line first, then taken out of it and moved. */
function float(doc: Doc, f: Float): Doc {
  let next = insertImage(doc, f.at, { bytes: png(COLORS[f.color]), type: 'image/png', width: f.width, height: f.height }).doc;
  next = setPictureWrap(next, f.at, f.wrap);
  next = moveFloat(next, f.at, f.x ?? 0, f.y ?? 0);
  if (!f.edit) return next;
  let offset = 0;
  const paragraphs = next.paragraphs.slice();
  const p = paragraphs[f.at.para];
  paragraphs[f.at.para] = {
    ...p,
    runs: p.runs.map((run): Run => {
      const here = offset === f.at.offset && !!run.props.object;
      offset += run.text.length;
      return here ? { text: run.text, props: { ...run.props, object: f.edit!(run.props.object!) } } : run;
    }),
  };
  return { ...next, paragraphs };
}
const floats = (doc: Doc, ...list: Float[]) => list.reduce(float, doc);

const gap = (points: number) => (xml: string) => xml.replace(/dist([TBLR])="\d+"/g, (_, side: string) => `dist${side}="${points * 12700}"`);
const side = (name: string) => (xml: string) => xml.replace('wrapText="bothSides"', `wrapText="${name}"`);
const from = (axis: 'H' | 'V', base: string, placed: string) => (xml: string) =>
  xml.replace(new RegExp(`<wp:position${axis}\\b[^>]*>.*?</wp:position${axis}>`, 's'), `<wp:position${axis} relativeFrom="${base}">${placed}</wp:position${axis}>`);
const offset = (points: number) => `<wp:posOffset>${Math.round(points * 12700)}</wp:posOffset>`;
const align = (where: string) => `<wp:align>${where}</wp:align>`;
const both =
  (...edits: ((xml: string) => string)[]) =>
  (xml: string) =>
    edits.reduce((now, edit) => edit(now), xml);
const tight = (xml: string) =>
  xml.replace(
    /<wp:wrapSquare\b[^>]*\/>/,
    '<wp:wrapTight wrapText="bothSides"><wp:wrapPolygon edited="0"><wp:start x="0" y="0"/><wp:lineTo x="0" y="21600"/><wp:lineTo x="21600" y="21600"/><wp:lineTo x="21600" y="0"/><wp:lineTo x="0" y="0"/></wp:wrapPolygon></wp:wrapTight>',
  );

const CASES: Record<string, () => Doc> = {
  // In the middle of the column, with the text down both sides; then at each edge.
  'both-sides': () =>
    floats(
      createDoc(text(6)),
      { color: 'red', at: { para: 0, offset: 0 }, width: 120, height: 90, wrap: 'square', x: 170, y: 12, edit: gap(9) },
      { color: 'green', at: { para: 2, offset: 0 }, width: 140, height: 70, wrap: 'square', x: 0, y: 6 },
      { color: 'blue', at: { para: 4, offset: 0 }, width: 140, height: 70, wrap: 'square', x: 328, y: 6 },
    ),
  // With little room on one side: how narrow a stretch of text Word still writes.
  narrow: () =>
    floats(
      createDoc(text(8)),
      { color: 'red', at: { para: 0, offset: 0 }, width: 120, height: 60, wrap: 'square', x: 20, y: 8, edit: gap(0) },
      { color: 'green', at: { para: 2, offset: 0 }, width: 120, height: 60, wrap: 'square', x: 45, y: 8, edit: gap(0) },
      { color: 'blue', at: { para: 4, offset: 0 }, width: 120, height: 60, wrap: 'square', x: 62, y: 8, edit: gap(0) },
      { color: 'magenta', at: { para: 6, offset: 0 }, width: 380, height: 50, wrap: 'square', x: 44, y: 8, edit: gap(0) },
    ),
  // The same with words short enough to fit anywhere: the least room Word writes in.
  'least-room': () =>
    floats(
      createDoc(Array.from({ length: 8 }, () => para(Array.from({ length: 260 }, (_, i) => ['a', 'y', 'o', 'de', 'la', 'e', 'un'][i % 7]).join(' ')))),
      { color: 'red', at: { para: 0, offset: 0 }, width: 120, height: 60, wrap: 'square', x: 6, y: 8, edit: gap(0) },
      { color: 'green', at: { para: 2, offset: 0 }, width: 120, height: 60, wrap: 'square', x: 12, y: 8, edit: gap(0) },
      { color: 'blue', at: { para: 4, offset: 0 }, width: 120, height: 60, wrap: 'square', x: 20, y: 8, edit: gap(0) },
      { color: 'magenta', at: { para: 6, offset: 0 }, width: 120, height: 60, wrap: 'square', x: 30, y: 8, edit: gap(0) },
    ),
  // Which lines are beside a picture: lines 25.3 tall whose text is the 12.65 in the middle of each. The
  // first picture starts in the room under the text of the second line and ends in the room over the text
  // of the sixth; the second does the same with the room it keeps round it, 12 points, and not with itself.
  edges: () =>
    floats(
      createDoc(text(4, 110, { lineHeight: 2, spacingAfter: 0 })),
      { color: 'red', at: { para: 0, offset: 0 }, width: 130, height: 83.2, wrap: 'square', x: 338, y: 46.3, edit: gap(0) },
      { color: 'green', at: { para: 2, offset: 0 }, width: 130, height: 59.2, wrap: 'square', x: 338, y: 58.3, edit: gap(12) },
    ),
  // How far under the foot of its text a line is still beside a picture: the second line of each paragraph,
  // whose text ends 37.95 down it (12.65 a line of text, 25.3 a line), with a picture starting a little under.
  reach: () =>
    floats(
      createDoc(text(8, 60, { lineHeight: 2, spacingAfter: 0 })),
      ...([2.6, 3.2, 3.8, 4.4, 5, 6, 8, 11] as const).map(
        (under, i): Float => ({
          color: (['red', 'green', 'blue', 'magenta'] as const)[i % 4],
          at: { para: i, offset: 0 },
          width: 130,
          height: 20,
          wrap: 'square',
          x: 338,
          y: 37.95 + under,
          edit: gap(0),
        }),
      ),
    ),
  // Told which side the text may go down.
  sides: () =>
    floats(
      createDoc(text(6)),
      { color: 'red', at: { para: 0, offset: 0 }, width: 110, height: 70, wrap: 'square', x: 180, y: 8, edit: side('left') },
      { color: 'green', at: { para: 2, offset: 0 }, width: 110, height: 70, wrap: 'square', x: 180, y: 8, edit: side('right') },
      { color: 'blue', at: { para: 4, offset: 0 }, width: 110, height: 70, wrap: 'square', x: 120, y: 8, edit: side('largest') },
    ),
  // The whole width of it left free, with and without room round it; and the outline of it gone round.
  'top-and-bottom': () =>
    floats(
      createDoc(text(6)),
      { color: 'red', at: { para: 0, offset: 0 }, width: 200, height: 60, wrap: 'topBottom', x: 100, y: 30 },
      { color: 'green', at: { para: 2, offset: 0 }, width: 200, height: 60, wrap: 'topBottom', x: 40, y: 20, edit: gap(14) },
      { color: 'blue', at: { para: 4, offset: 0 }, width: 120, height: 80, wrap: 'square', x: 60, y: 10, edit: tight },
    ),
  // Over the text and under it: the text does not move.
  'in-front': () =>
    floats(
      createDoc(text(4)),
      { color: 'red', at: { para: 0, offset: 0 }, width: 150, height: 50, wrap: 'none', x: 60, y: 20 },
      { color: 'green', at: { para: 2, offset: 0 }, width: 150, height: 50, wrap: 'behind', x: 200, y: 20 },
    ),
  // Measured from the page and from its margins, and put at a side by name.
  'relative-to': () =>
    floats(
      createDoc(text(8)),
      { color: 'red', at: { para: 0, offset: 0 }, width: 90, height: 60, wrap: 'square', edit: both(from('H', 'page', offset(40)), from('V', 'page', offset(140))) },
      { color: 'green', at: { para: 2, offset: 0 }, width: 90, height: 60, wrap: 'square', edit: both(from('H', 'margin', align('right')), from('V', 'paragraph', offset(10))) },
      { color: 'blue', at: { para: 4, offset: 0 }, width: 90, height: 60, wrap: 'square', edit: both(from('H', 'margin', align('center')), from('V', 'margin', offset(430))) },
      { color: 'magenta', at: { para: 6, offset: 0 }, width: 90, height: 60, wrap: 'square', edit: both(from('H', 'column', offset(20)), from('V', 'line', offset(0))) },
    ),
  // Anchored in the middle of a paragraph, above its line and below; with other line spacings.
  'mid-paragraph': () =>
    floats(
      createDoc([...text(2, 90, { lineHeight: 1 }), ...text(2, 90, { lineHeight: 1.5, spacingBefore: 12 }), ...text(2, 90, { lineHeight: 2, spacingAfter: 0 })]),
      { color: 'red', at: { para: 0, offset: 260 }, width: 130, height: 80, wrap: 'square', x: 0, y: 30 },
      // It starts in the room the line spacing leaves under the text of the first line, which is not beside it.
      { color: 'green', at: { para: 2, offset: 200 }, width: 130, height: 80, wrap: 'square', x: 338, y: 21.5 },
      { color: 'blue', at: { para: 4, offset: 0 }, width: 130, height: 80, wrap: 'square', x: 170, y: 15 },
    ),
  // Near the foot of a page, and taller than what is left of it.
  'page-end': () =>
    floats(
      createDoc(text(14)),
      { color: 'red', at: { para: 8, offset: 0 }, width: 150, height: 150, wrap: 'square', x: 0, y: 10 },
      { color: 'green', at: { para: 11, offset: 0 }, width: 150, height: 120, wrap: 'topBottom', x: 150, y: 20 },
    ),
  // A brochure of two pages: a title and a banner across the page, then sections whose pictures go down one side or the
  // other, near together, one beside a heading, and one placed on the page itself.
  brochure: () => {
    const title = (text: string, size: number): Paragraph => ({ props: { align: 'center', spacingAfter: 6 }, runs: [{ text, props: { bold: true, fontSize: size, color: '1F3864' } }] });
    const heading = (text: string): Paragraph => ({ props: { spacingBefore: 14, spacingAfter: 4, keepNext: true }, runs: [{ text, props: { bold: true, fontSize: 14, color: '1F3864' } }] });
    const sections = ['Ubicación', 'Espacios', 'Servicios', 'Accesos', 'Condiciones'];
    const doc = createDoc([
      title('Torre Mirador', 26),
      title('Oficinas en renta en el centro de la ciudad', 13),
      para(filler(60, 3), { align: 'justify' }),
      ...sections.flatMap((name, k) => [heading(name), ...text(2 + (k % 2), 75, { align: 'justify' })]),
    ]);
    // Paragraph indexes: 0 and 1 the titles, 2 the introduction, then each section's heading and its paragraphs.
    const at = (section: number, paragraph = 0) => 3 + [0, 3, 7, 10, 14][section] + 1 + paragraph;
    return floats(
      doc,
      { color: 'blue', at: { para: 2, offset: 0 }, width: 468, height: 70, wrap: 'topBottom', x: 0, y: 0, edit: gap(8) },
      { color: 'red', at: { para: at(0), offset: 0 }, width: 150, height: 110, wrap: 'square', x: 0, y: 4, edit: gap(9) },
      { color: 'green', at: { para: at(1, 1), offset: 0 }, width: 140, height: 100, wrap: 'square', x: 328, y: 0, edit: gap(9) },
      { color: 'magenta', at: { para: at(2), offset: 0 }, width: 120, height: 120, wrap: 'square', x: 174, y: 10, edit: gap(6) },
      { color: 'red', at: { para: at(3, 1), offset: 0 }, width: 160, height: 90, wrap: 'square', edit: both(gap(9), from('H', 'margin', align('right')), from('V', 'paragraph', offset(6))) },
      { color: 'blue', at: { para: at(4), offset: 0 }, width: 200, height: 60, wrap: 'topBottom', edit: both(from('H', 'margin', align('center')), from('V', 'paragraph', offset(40))) },
    );
  },
  // In a cell of a table, and in the header.
  'table-and-header': () => {
    let doc = createDoc([...text(2), para(''), ...text(2)]);
    doc = insertTable(doc, { para: 2, offset: 0 }, 2, 2).doc;
    const cell = doc.paragraphs.findIndex((p) => p.cell);
    for (let i = 3; i >= 0; i--) doc = insertText(doc, { para: cell + i, offset: 0 }, filler(30, i * 5)).doc;
    doc = float(doc, { color: 'red', at: { para: cell, offset: 0 }, width: 60, height: 40, wrap: 'square', x: 100, y: 6 });
    // The header as a document of its own, with the pictures of the whole.
    const head = float(
      { ...doc, paragraphs: [para('Encabezado de prueba con un texto que pasa junto a la imagen')], tables: undefined },
      { color: 'blue', at: { para: 0, offset: 0 }, width: 60, height: 30, wrap: 'square', x: 380, y: -6 },
    );
    return { ...doc, media: head.media, header: { paragraphs: head.paragraphs } };
  },
};

// --- Where the pictures are in a PDF ----------------------------------------------

/** Each colour on each page of a PDF: the box it fills, in points. */
function boxes(pdf: string): Record<string, string> {
  const dir = mkdtempSync(join(tmpdir(), 'dx-floats-'));
  try {
    execFileSync('pdftoppm', ['-r', '72', pdf, join(dir, 'p')]);
    const out: Record<string, string> = {};
    readdirSync(dir)
      .sort()
      .forEach((name, page) => {
        const data = readFileSync(join(dir, name));
        const header = data.subarray(0, 20).toString('latin1').split('\n');
        const [width, height] = header[1].split(' ').map(Number);
        const start = header.slice(0, 3).join('\n').length + 1;
        for (const [color, [r, g, b]] of Object.entries(COLORS)) {
          let x0 = Infinity;
          let y0 = Infinity;
          let x1 = -1;
          let y1 = -1;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const i = start + (y * width + x) * 3;
              if (Math.abs(data[i] - r) > 24 || Math.abs(data[i + 1] - g) > 24 || Math.abs(data[i + 2] - b) > 24) continue;
              x0 = Math.min(x0, x);
              y0 = Math.min(y0, y);
              x1 = Math.max(x1, x);
              y1 = Math.max(y1, y);
            }
          }
          if (x1 >= 0) out[color] = `p${page + 1} x ${x0}-${x1 + 1} y ${y0}-${y1 + 1}`;
        }
      });
    return out;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// --- The tool ---------------------------------------------------------------------

const check = process.argv.includes('--check');
const only = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
mkdirSync(OUT, { recursive: true });
for (const [name, build] of Object.entries(CASES)) {
  if (only.length && !only.includes(name)) continue;
  const docx = join(OUT, `float-${name}.docx`);
  const ours = join(OUT, `float-${name}.ours.pdf`);
  const word = join(OUT, `float-${name}.word.pdf`);
  const bytes = exportDocx(build());
  writeFileSync(docx, bytes);
  // Laid out from the file, as the editor would after opening it.
  const doc = importDocx(bytes);
  writeFileSync(ours, renderPdf(doc, fontsFor(doc)).pdf);
  if (!check) {
    console.log(`Wrote ${docx}`);
    continue;
  }
  if (!existsSync(word)) {
    console.log(`${name}: no PDF from Word yet (npm run word-compare -- ${docx} --word)`);
    continue;
  }
  const theirs = boxes(word);
  const mine = boxes(ours);
  for (const color of Object.keys({ ...theirs, ...mine })) {
    const same = theirs[color] === mine[color];
    const near = !same && theirs[color] && mine[color] && theirs[color].split(/\D+/).every((n, i) => Math.abs(Number(n) - Number(mine[color].split(/\D+/)[i])) <= 1);
    console.log(`${name} ${color.padEnd(8)} ${same ? 'same    ' : near ? '1 pt off' : 'DISTINTO'} Word ${theirs[color] ?? '—'}${same ? '' : `   ours ${mine[color] ?? '—'}`}`);
  }
}
