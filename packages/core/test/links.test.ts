import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type Doc, type Paragraph, LINK_COLOR, autoformat, cleanHref, createDoc, exportDocx, exportPdf, importDocx, insertLink, insertText, insertToc, layoutDocument, linkAt, linkHref, plainText, removeLink, setLink, setParagraphStyle, updateToc } from '../src';

const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });
const at = (para: number, from: number, to: number) => ({ from: { para, offset: from }, to: { para, offset: to } });
const part = (bytes: Uint8Array, path: string) => strFromU8(unzipSync(bytes)[path]);
const links = (doc: Doc) => doc.paragraphs.flatMap((para) => para.runs.filter((run) => linkHref(run.props)).map((run) => [run.text, linkHref(run.props)]));

describe('links', () => {
  it('cleans an address, and refuses what a link may not open', () => {
    expect(cleanHref(' ejemplo.com/a?b=1&c=2 ')).toBe('https://ejemplo.com/a?b=1&c=2');
    expect(cleanHref('http://ejemplo.com')).toBe('http://ejemplo.com');
    expect(cleanHref('ana@ejemplo.com')).toBe('mailto:ana@ejemplo.com');
    expect(cleanHref('tel:+523312345678')).toBe('tel:+523312345678');
    expect(cleanHref('localhost:5173/x')).toBe('https://localhost:5173/x');
    expect(cleanHref('javascript:alert(1)')).toBeUndefined();
    expect(cleanHref('file:///etc/passwd')).toBeUndefined();
    expect(cleanHref('dos palabras')).toBeUndefined();
    expect(cleanHref('  ')).toBeUndefined();
  });

  it('makes a link of a stretch of text, changes where it goes and takes it away', () => {
    const start = createDoc([p('Visita nuestro sitio hoy')]);
    const made = setLink(start, at(0, 7, 20), 'https://ejemplo.com');
    expect(links(made)).toEqual([['nuestro sitio', 'https://ejemplo.com']]);
    expect(made.paragraphs[0].runs[1].props).toMatchObject({ color: LINK_COLOR, underline: true });
    // Anywhere in it, and at either end, it is the whole link that is found.
    for (const offset of [7, 12, 20]) expect(linkAt(made, { para: 0, offset })).toEqual({ href: 'https://ejemplo.com', range: at(0, 7, 20) });
    expect(linkAt(made, { para: 0, offset: 3 })).toBeUndefined();
    // Part of it sent elsewhere is a link of its own.
    const two = setLink(made, at(0, 7, 14), 'https://otro.mx');
    expect(links(two)).toEqual([['nuestro', 'https://otro.mx'], [' sitio', 'https://ejemplo.com']]);
    const plain = removeLink(two, at(0, 0, 24));
    expect(links(plain)).toEqual([]);
    expect(plain.paragraphs[0].runs).toEqual([{ text: 'Visita nuestro sitio hoy', props: {} }]);
  });

  it('writes a link at the caret', () => {
    const { doc, range } = insertLink(createDoc([p('Ver: ')]), { para: 0, offset: 5 }, 'ejemplo.com', 'https://ejemplo.com');
    expect(plainText(doc.paragraphs[0].runs)).toBe('Ver: ejemplo.com');
    expect(range).toEqual(at(0, 5, 16));
    expect(links(doc)).toEqual([['ejemplo.com', 'https://ejemplo.com']]);
  });

  it('goes to a DOCX as a relationship of the part and comes back the same', () => {
    const href = 'https://ejemplo.com/a?b=1&c=2';
    let doc = setLink(createDoc([p('Visita nuestro sitio hoy'), p('Y este otro')]), at(0, 7, 20), href);
    doc = setLink(doc, at(1, 2, 6), href);
    doc = setLink(doc, at(1, 7, 11), 'mailto:ana@ejemplo.com');
    const bytes = exportDocx(doc);
    const xml = part(bytes, 'word/document.xml');
    const rels = part(bytes, 'word/_rels/document.xml.rels');
    expect(xml).not.toContain('dx:');
    // One relationship for each address, however many links go to it.
    expect(rels.match(/relationships\/hyperlink"/g)).toHaveLength(2);
    expect(rels).toContain('Target="https://ejemplo.com/a?b=1&amp;c=2" TargetMode="External"');
    const id = /Id="(rId\d+)"[^>]*Target="https:\/\/ejemplo/.exec(rels)![1];
    expect(xml.match(new RegExp(`<w:hyperlink r:id="${id}" w:history="1">`, 'g'))).toHaveLength(2);

    const back = importDocx(bytes);
    expect(links(back)).toEqual([['nuestro sitio', href], ['este', href], ['otro', 'mailto:ana@ejemplo.com']]);
    // Untouched, it is written as it was; edited, its links keep the relationships they had.
    expect(part(exportDocx(back), 'word/document.xml')).toBe(xml);
    const edited = exportDocx(insertText(back, { para: 0, offset: 0 }, '¡').doc);
    expect(part(edited, 'word/_rels/document.xml.rels')).toBe(rels);
    expect(links(importDocx(edited))).toEqual(links(back));
    // A link taken away leaves its text, and no link in the file.
    const without = part(exportDocx(removeLink(back, at(0, 0, 24))), 'word/document.xml');
    expect(without.match(/<w:hyperlink /g)).toHaveLength(2);
  });

  it('makes a link of an address as it is typed', () => {
    const typed = (text: string) => {
      const doc = createDoc([p(text)]);
      const made = autoformat(doc, { para: 0, offset: text.length }, ' ');
      return made ? links(made.doc) : undefined;
    };
    expect(typed('Ver https://ejemplo.com/a?b=1 ')).toEqual([['https://ejemplo.com/a?b=1', 'https://ejemplo.com/a?b=1']]);
    expect(typed('www.ejemplo.mx ')).toEqual([['www.ejemplo.mx', 'https://www.ejemplo.mx']]);
    expect(typed('Escribe a ana@ejemplo.com ')).toEqual([['ana@ejemplo.com', 'mailto:ana@ejemplo.com']]);
    // What ends the sentence is not part of the address, and neither is what it is between.
    expect(typed('(ver www.ejemplo.mx). ')).toEqual([['www.ejemplo.mx', 'https://www.ejemplo.mx']]);
    expect(typed('Está en www.ejemplo.mx, ')).toEqual([['www.ejemplo.mx', 'https://www.ejemplo.mx']]);
    expect(typed('Mira (https://ejemplo.com/x_(y) ')).toEqual([['https://ejemplo.com/x_(y', 'https://ejemplo.com/x_(y']]);
    // Not every word with a dot is an address, and a variable is not one.
    expect(typed('archivo.docx ')).toBeUndefined();
    expect(typed('{{correo@cliente}} ')).toBeUndefined();
    expect(typed('nada ')).toBeUndefined();
    // A link is not made of one again.
    const linked = setLink(createDoc([p('www.ejemplo.mx ')]), at(0, 0, 14), 'https://otro.mx');
    expect(autoformat(linked, { para: 0, offset: 15 }, ' ')).toBeUndefined();
  });

  it('can be followed in a PDF, as the entries of a table of contents can', () => {
    const measurer = { width: (text: string, font: { size: number }) => text.length * font.size * 0.5, metrics: (font: { size: number }) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }) };
    const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');
    let doc = createDoc([p(''), p('Objeto'), p('Visita nuestro sitio (ñ) hoy'), ...Array.from({ length: 70 }, () => p('Relleno')), p('Precio')]);
    doc = setParagraphStyle(setParagraphStyle(doc, 1, 1, 'Heading1'), 73, 73, 'Heading1');
    doc = setLink(doc, at(2, 7, 24), 'https://ejemplo.com/a (ñ)');
    const pageOf = (now: Doc) => {
      const { lines, paraFirstLine } = layoutDocument(now, measurer);
      return (para: number) => lines[paraFirstLine[para]].page + 1;
    };
    doc = insertToc(doc, { para: 0, offset: 0 }, { pageOf: () => 1 }).doc;
    doc = updateToc(doc, { pageOf: pageOf(doc) });
    const layout = layoutDocument(doc, measurer);
    expect(layout.pages.length).toBeGreaterThan(1);
    const pdf = latin1(exportPdf(layout, { measurer }));
    // One box for the link, however many runs it is made of, and its address as addresses are written.
    expect(pdf.match(/\/S \/URI/g)).toHaveLength(1);
    expect(pdf).toContain('/URI (https://ejemplo.com/a%20\\(%C3%B1\\))');
    // Each entry goes to the page its heading is on: the first to the first page, the second to another.
    const pages = [...pdf.matchAll(/(\d+) 0 obj\n<< \/Type \/Page /g)].map((match) => match[1]);
    const dests = [...pdf.matchAll(/\/Dest \[(\d+) 0 R \/XYZ 0 [\d.]+ null\]/g)].map((match) => pages.indexOf(match[1]));
    expect(dests).toEqual([0, pageOf(doc)(74 + 1) - 1]);
    expect(dests[1]).toBeGreaterThan(0);
    expect(pdf.match(/\/Annots \[/g)).toHaveLength(1);
  });

  it('keeps the links of a header in the relationships of the header', () => {
    const header = setLink(createDoc([p('ejemplo.com')]), at(0, 0, 11), 'https://ejemplo.com');
    const bytes = exportDocx({ ...createDoc([p('Texto')]), header: { paragraphs: header.paragraphs } });
    expect(part(bytes, 'word/_rels/header1.xml.rels')).toContain('Target="https://ejemplo.com" TargetMode="External"');
    expect(part(bytes, 'word/header1.xml')).toMatch(/<w:hyperlink r:id="rId\d+"/);
    expect(links({ paragraphs: importDocx(bytes).header!.paragraphs } as Doc)).toEqual([['ejemplo.com', 'https://ejemplo.com']]);
  });
});
