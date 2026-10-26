// Reading what other programs put on the clipboard as HTML: here, their
// tables. The HTML is the kind Word and Google Docs write, read by a DOM of
// the tests' own (linkedom), as the page reads it with the browser's.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DOMParser, parseHTML } from 'linkedom';
import { beforeAll, describe, expect, it } from 'vitest';
import { clipFromHtml, readClipImages, rtfPictures } from '../src/paste';

beforeAll(() => {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, { DOMParser, Node: window.Node, HTMLElement: window.HTMLElement });
});

const words = (p: { runs: { text: string }[] }) => p.runs.map((r) => r.text).join('');
/** A browser puts a fragment in a page of its own; linkedom does not, so the tests do. */
const read = (html: string) => clipFromHtml(html.includes('<html') ? html : `<html><body>${html}</body></html>`);

describe('pasting a table', () => {
  it('reads one of Word: its grid, a merged cell, its widths and the paragraphs of a cell', () => {
    const html = `<html><body><!--StartFragment-->
      <p class=MsoNormal>Antes</p>
      <table class=MsoTableGrid border=1 cellspacing=0 cellpadding=0 style='border-collapse:collapse'>
        <tr><td width=312 style='width:233.75pt'><p class=MsoNormal><b>Concepto</b></p></td><td width=156 style='width:116.9pt'><p class=MsoNormal><b>Monto</b></p></td></tr>
        <tr><td style='width:233.75pt'><p class=MsoNormal>Renta</p></td><td style='width:116.9pt'><p class=MsoNormal align=right style='text-align:right'>$18,500</p></td></tr>
        <tr><td colspan=2><p class=MsoNormal>Total al mes</p><p class=MsoNormal><i>con IVA</i></p></td></tr>
      </table>
      <p class=MsoNormal>Después</p><!--EndFragment--></body></html>`;
    const clip = read(html)!;
    expect(clip.tables).toMatchObject([{ rows: 3, columns: 2, merges: [{ row: 2, column: 0, rows: 1, columns: 2 }], widths: [234, 117] }]);
    expect(clip.paragraphs.map((p) => [words(p), p.cell ? `${p.cell.row}:${p.cell.column}` : '-'])).toEqual([
      ['Antes', '-'],
      ['Concepto', '0:0'],
      ['Monto', '0:1'],
      ['Renta', '1:0'],
      ['$18,500', '1:1'],
      ['Total al mes', '2:0'],
      ['con IVA', '2:0'],
      ['Después', '-'],
    ]);
    expect(clip.paragraphs[4].props.align).toBe('right');
    expect(clip.paragraphs[1].runs[0].props.bold).toBe(true);
  });

  it('reads one of Google Docs: columns by their width, a heading row, a cell that spans rows', () => {
    const html = `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1"><div dir="ltr"><table style="border:none;border-collapse:collapse;">
      <colgroup><col width="200"><col width="100"></colgroup>
      <thead><tr><th><p dir="ltr"><span>Inmueble</span></p></th><th><p dir="ltr"><span>Precio</span></p></th></tr></thead>
      <tbody><tr><td rowspan="2"><p dir="ltr"><span>Torre Alcatraz</span></p></td><td><p dir="ltr"><span>$4.2 M</span></p></td></tr>
      <tr><td><p dir="ltr"><span>$4.0 M</span></p></td></tr></tbody></table></div></b>`;
    const clip = read(html)!;
    expect(clip.tables).toMatchObject([{ rows: 3, columns: 2, merges: [{ row: 1, column: 0, rows: 2, columns: 1 }], widths: [150, 75], header: 1 }]);
    expect(clip.paragraphs.map((p) => `${words(p)}@${p.cell!.row}:${p.cell!.column}`)).toEqual(['Inmueble@0:0', 'Precio@0:1', 'Torre Alcatraz@1:0', '$4.2 M@1:1', '$4.0 M@2:1']);
  });

  it('leaves out a table a page is laid out with, and keeps one inside a cell as lines', () => {
    const layout = read('<table role="presentation"><tr><td><p>Hola</p></td><td><p>mundo</p></td></tr></table>')!;
    expect(layout.tables).toBeUndefined();
    const single = read('<table><tr><td><p>Solo una celda</p></td></tr></table>')!;
    expect(single.tables).toBeUndefined();
    expect(words(single.paragraphs[0])).toBe('Solo una celda');
    const nested = read('<table><tr><td><table><tr><td>a</td><td>b</td></tr></table></td><td>c</td></tr><tr><td>d</td><td>e</td></tr></table>')!;
    expect(nested.tables).toHaveLength(1);
    expect(nested.paragraphs.map((p) => `${words(p)}@${p.cell!.row}:${p.cell!.column}`)).toEqual(['a\tb@0:0', 'c@0:1', 'd@1:0', 'e@1:1']);
  });

  it("reads the look of Word's cells as Word for Mac writes them: colour, lines, where the text sits, and the rows' heights", () => {
    // Cut down from what Word put on the clipboard for a table of a file of its own: each line in CSS and again in its own terms.
    const html = `<html><body><!--StartFragment-->
<table class=MsoNormalTable border=1 cellspacing=0 cellpadding=0 style='border-collapse:collapse;mso-border-alt:solid #8EAADB .5pt'>
 <tr style='mso-yfti-irow:0;height:21.0pt'>
  <td width=93 valign=top style='width:70.0pt;border:solid #8EAADB 1.0pt;mso-border-alt:solid #8EAADB .5pt;background:#1F3864;padding:0cm 5.4pt 0cm 5.4pt;height:21.0pt'>
  <p class=MsoNoSpacing><span lang=EN-US style='color:white;mso-color-alt:windowtext'>Quarter</span></p></td>
  <td width=93 style='width:70.0pt;border:solid #8EAADB 1.0pt;border-left:none;mso-border-left-alt:solid #8EAADB .5pt;mso-border-alt:solid #8EAADB .5pt;padding:0cm 5.4pt 0cm 5.4pt;height:21.0pt'>
  <p class=MsoNoSpacing><span lang=EN-US>Centred</span></p></td>
 </tr>
 <tr style='mso-yfti-irow:1;height:25.0pt;mso-height-rule:exactly;mso-row-margin-left:70.0pt'>
  <td style='mso-cell-special:placeholder;border:none;border-bottom:solid #8EAADB 1.0pt' width=93><p class='MsoNormal'>&nbsp;</td>
  <td width=200 valign=top style='width:150.0pt;border-top:double #1F3864 2.25pt;border-left:none;border-bottom:solid #BFBFBF 1.0pt;border-right:none;mso-border-top-alt:double #1F3864 2.25pt;mso-border-bottom-alt:solid #BFBFBF .5pt;background:white'>
  <p class=MsoNoSpacing><span lang=EN-US>Signed</span></p></td>
 </tr>
</table>
<!--EndFragment--></body></html>`;
    const clip = read(html)!;
    const table = clip.tables![0];
    const look = (row: number, column: number) => table.cells!.find((c) => c.row === row && c.column === column);
    const line = { style: 'single', width: 0.5, color: '8EAADB' };
    // The line Word has, half a point, and not the point it shows a browser; on the left too, though CSS leaves it to the cell beside.
    expect(look(0, 0)).toEqual({ row: 0, column: 0, shade: '1F3864', lines: { top: line, right: line, bottom: line, left: line } });
    expect(look(0, 1)).toEqual({ row: 0, column: 1, valign: 'center', lines: { top: line, right: line, bottom: line, left: line } });
    // A double line is a third of the width CSS gives it; a side CSS says none of, none.
    expect(look(1, 1)).toEqual({ row: 1, column: 1, shade: 'FFFFFF', lines: { top: { style: 'double', width: 0.75, color: '1F3864' }, bottom: { style: 'single', width: 0.5, color: 'BFBFBF' } } });
    // The place Word keeps for a row set further in is no cell to write in, and has no lines.
    expect(look(1, 0)).toEqual({ row: 1, column: 0, lines: {} });
    expect(clip.paragraphs.filter((p) => p.cell?.row === 1).map(words)).toEqual(['Signed']);
    expect(table.heights).toEqual([
      { row: 0, height: 21 },
      { row: 1, height: 25, exact: true },
    ]);
    // White text, as Word writes it.
    expect(clip.paragraphs[0].runs[0].props.color).toBe('FFFFFF');
  });
});

describe('pasting pictures', () => {
  const fixture = (name: string) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'latin1');
  /** The bytes of a data: address. */
  const bytesOf = (src: string) => Uint8Array.from(atob(src.split(',')[1]), (c) => c.charCodeAt(0));

  it('reads those of Word for Mac in its HTML, at the size its VML says, in points', () => {
    // What Word for Mac put on the clipboard copying a title with a picture of 60×30 pt in it and a line with one of 45×45.
    const clip = read(Buffer.from(fixture('word-mac-pictures.html'), 'latin1').toString('utf8'))!;
    const images = clip.paragraphs.flatMap((p) => p.runs.filter((r) => r.image).map((r) => r.image!));
    expect(clip.paragraphs.map(words)).toEqual(['Before the picture ', 'After it.']);
    expect(images.map((i) => [i.width, i.height])).toEqual([
      [60, 30],
      [45, 45],
    ]);
    // Word says image/png of what is a JPEG: the bytes say what it is.
    expect(images.every((i) => i.src.startsWith('data:image/png;base64,/9j/'))).toBe(true);
  });

  it('takes the pictures of RTF, as Word on Windows gives them for the file:/// of its HTML', async () => {
    const pictures = rtfPictures(fixture('word-mac-pictures.rtf'));
    expect(pictures.map((p) => [Math.round(p.width), Math.round(p.height)])).toEqual([
      [60, 30],
      [45, 45],
    ]);
    expect([...bytesOf(pictures[0].src).slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    const html = `<p>Before <img width=80 height=40 src="file:///C:/Users/someone/AppData/Local/Temp/msohtmlclip1/01/clip_image001.png"> after</p>`;
    const clip = await readClipImages(read(html)!, fixture('word-mac-pictures.rtf'));
    const image = clip.paragraphs[0].runs.find((r) => r.image)!.image!;
    expect(image.src).toBe(pictures[0].src);
    expect([image.width, image.height]).toEqual([60, 30]);
  });

  it('leaves out a picture it cannot read, and a speck put there to count visits, keeping the text', async () => {
    const clip = read('<p>One <img src="https://example.com/pixel.gif" width=1 height=1>two <img src="file:///nowhere.png"> three</p>')!;
    expect(clip.paragraphs[0].runs.filter((r) => r.image)).toHaveLength(1);
    const read2 = await readClipImages(clip);
    expect(read2.paragraphs[0].runs.some((r) => r.image)).toBe(false);
    expect(words(read2.paragraphs[0])).toBe('One two  three');
  });

  it('keeps a paragraph that is only a picture', () => {
    const clip = read('<p><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width=40 height=40></p>')!;
    expect(clip.paragraphs).toHaveLength(1);
    expect(clip.paragraphs[0].runs[0].image).toMatchObject({ width: 30, height: 30 });
  });
});
