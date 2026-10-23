import { writeFileSync } from 'node:fs';
import { unzlibSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type Paragraph,
  type TextMeasurer,
  createDoc,
  exportPdf,
  insertFootnote,
  insertImage,
  insertLink,
  insertTable,
  insertText,
  insertTextBox,
  layoutDocument,
  mergeCells,
  paragraphText,
  setAltText,
  setHeaderRow,
  setParagraphStyle,
  toggleList,
  withStory,
} from '../src/internal';

const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};
const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');
const para = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/** The objects of a PDF by number, their streams unsqueezed. */
function objects(pdf: Uint8Array): Map<number, string> {
  const text = latin1(pdf);
  const out = new Map<number, string>();
  for (const match of text.matchAll(/(\d+) 0 obj\n([^\n]*)\n(stream\n)?/g)) {
    let body = match[2];
    if (match[3]) {
      const length = Number(/\/Length (\d+)/.exec(body)![1]);
      const start = match.index + match[0].length;
      const data = pdf.slice(start, start + length);
      body += `\n${body.includes('/FlateDecode') ? latin1(unzlibSync(data)) : latin1(data)}`;
    }
    out.set(Number(match[1]), body);
  }
  return out;
}

/** The tree of a tagged PDF as an outline: each element by its type, indented under its parent, with its description. */
function tree(pdf: Uint8Array): string {
  const all = objects(pdf);
  const catalog = [...all.values()].find((body) => body.startsWith('<< /Type /Catalog'))!;
  const root = all.get(Number(/\/StructTreeRoot (\d+)/.exec(catalog)![1]))!;
  const lines: string[] = [];
  const walk = (id: number, depth: number) => {
    const body = all.get(id)!;
    const type = /\/S \/(\w+)/.exec(body)![1];
    const alt = /\/Alt <FEFF([0-9A-F]*)>/.exec(body)?.[1];
    const said = alt ? ` "${String.fromCharCode(...(alt.match(/.{4}/g) ?? []).map((h) => parseInt(h, 16)))}"` : '';
    lines.push(`${'  '.repeat(depth)}${type}${said}`);
    const kids = /\/K \[(.*)\] >>$/.exec(body)![1];
    for (const kid of kids.replace(/<<[^>]*>>/g, '').matchAll(/(\d+) 0 R/g)) walk(Number(kid[1]), depth + 1);
  };
  walk(Number(/\/K (\d+) 0 R/.exec(root)![1]), 0);
  return lines.join('\n');
}

/** One of each thing the tree knows. */
function sample(): Doc {
  let doc = createDoc([
    para('Lease of the flat'),
    para('The tenant has read the house rules before signing.'),
    para('What is included'),
    para('Furniture'),
    para('A bed'),
    para('Water'),
    para(''),
    para('The plan:'),
    para(''),
    para('The rent is paid monthly.'),
  ]);
  doc = setParagraphStyle(doc, 0, 0, 'Heading1');
  doc = setParagraphStyle(doc, 2, 2, 'Heading2');
  doc = toggleList(doc, 3, 5, 'number');
  doc = { ...doc, paragraphs: doc.paragraphs.map((p, i) => (i === 4 ? { ...p, props: { ...p.props, listLevel: 1 } } : p)) };
  const before = paragraphText(doc.paragraphs[1]).indexOf(' before');
  doc = insertLink(doc, { para: 1, offset: before }, ' (online)', 'https://example.com/rules').doc;
  doc = insertFootnote(doc, { para: 1, offset: before }, 'Given on paper too.').doc;
  doc = insertImage(doc, { para: 8, offset: 0 }, { bytes: PNG, type: 'image/png', width: 100, height: 50 }).doc;
  doc = setAltText(doc, { para: 8, offset: 0 }, 'Plan of the flat');
  doc = insertTextBox(doc, { para: 9, offset: 0 }, { text: 'Signed in Madrid' }).doc;
  doc = insertTable(doc, { para: 6, offset: 0 }, 3, 2).doc;
  const cells = () => doc.paragraphs.flatMap((p, i) => (p.cell ? [i] : []));
  ['What', 'How much', 'Rent', '$1,200', 'Deposit', ''].forEach((text, k) => text && (doc = insertText(doc, { para: cells()[k], offset: 0 }, text).doc));
  doc = setHeaderRow(doc, cells()[0], true);
  doc = mergeCells(doc, cells()[3], cells()[5]).doc;
  doc = withStory(doc, 'header', { paragraphs: [para('Flat 4B')] });
  return doc;
}

/** A picture for each picture, not for a text box: a drawing that has none. */
const image = (xml: string) => (xml.includes('a:blip') ? { width: 2, height: 1, rgb: new Uint8Array(6) } : undefined);

describe('a tagged PDF', () => {
  const doc = sample();
  const pdf = exportPdf(layoutDocument(doc, measurer), { measurer, doc, title: 'Lease', image });
  if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, pdf);
  const all = objects(pdf);
  const catalog = [...all.values()].find((body) => body.startsWith('<< /Type /Catalog'))!;

  it('says it is tagged, its language and its title', () => {
    expect(catalog).toContain('/MarkInfo << /Marked true >>');
    expect(catalog).toContain('/ViewerPreferences << /DisplayDocTitle true >>');
    expect(latin1(pdf)).toContain('<dc:title><rdf:Alt><rdf:li xml:lang="x-default">Lease</rdf:li>');
    const spanish = exportPdf(layoutDocument(doc, measurer), { measurer, doc, language: 'es-MX' });
    expect(latin1(spanish)).toContain('/Lang (es-MX)');
  });

  it('keeps the headings, the lists, the table, the note, the link, the picture and the text box, in the order of the document', () => {
    expect(tree(pdf)).toBe(
      [
        'Document',
        '  H1',
        '  P',
        '    Link',
        '    Note',
        '      P',
        '  H2',
        '  L',
        '    LI',
        '      Lbl',
        '      LBody',
        '        P',
        '        L',
        '          LI',
        '            Lbl',
        '            LBody',
        '              P',
        '    LI',
        '      Lbl',
        '      LBody',
        '        P',
        '  Table',
        '    TR',
        '      TH',
        '        P',
        '      TH',
        '        P',
        '    TR',
        '      TD',
        '        P',
        '      TD',
        '        P',
        '    TR',
        '      TD',
        '        P',
        '  P',
        '  P',
        '    Figure "Plan of the flat"',
        '  P',
        '  Div',
        '    P',
      ].join('\n'),
    );
  });

  it('gives a heading cell its scope and a merged one its rows', () => {
    const cells = [...all.values()].filter((body) => /\/S \/T[HD]\b/.test(body));
    expect(cells.filter((body) => body.includes('/Scope /Column'))).toHaveLength(2);
    expect(cells.filter((body) => body.includes('/RowSpan 2'))).toHaveLength(1);
  });

  it('marks what is drawn and is not read, the header among it, as artifacts', () => {
    const content = [...all.values()].find((body) => body.includes(' Tj'))!;
    // The words are written in hex: "Flat".
    const header = content.indexOf('<466C6174');
    expect(header).toBeGreaterThan(0);
    // Every piece of text is inside a marked sequence: the header's in an artifact.
    expect(content.lastIndexOf('/Artifact BMC', header)).toBeGreaterThan(content.lastIndexOf('EMC', header));
    expect(content).toMatch(/\/H1 <<\/MCID \d+>> BDC/);
    let depth = 0;
    for (const op of content.matchAll(/\b(BDC|BMC|EMC|Tj)\b/g)) {
      if (op[1] === 'EMC') depth--;
      else if (op[1] === 'Tj') expect(depth).toBe(1);
      else depth++;
    }
    expect(depth).toBe(0);
  });

  it('ties each link to the element of its text, and each page to its pieces', () => {
    const link = [...all.values()].find((body) => body.includes('/Subtype /Link'))!;
    expect(link).toMatch(/\/StructParent \d+ \/Contents <FEFF/);
    const page = [...all.values()].find((body) => body.startsWith('<< /Type /Page '))!;
    expect(page).toContain('/StructParents 0 /Tabs /S');
    expect([...all.values()].some((body) => body.includes('/Type /OBJR'))).toBe(true);
  });

  it('gives the headings as bookmarks, nested by level', () => {
    const outlines = [...all.values()].find((body) => body.startsWith('<< /Type /Outlines'))!;
    expect(outlines).toContain('/Count 2');
    expect(catalog).toMatch(/\/Outlines \d+ 0 R/);
  });

  it('leaves a picture marked as decorative out of what is read', () => {
    const decorative = {
      ...doc,
      paragraphs: doc.paragraphs.map((p) => ({
        ...p,
        runs: p.runs.map((run) =>
          run.props.object?.includes('<wp:docPr')
            ? { ...run, props: { ...run.props, object: run.props.object.replace(/<wp:docPr\b([^>]*?)\/>/, '<wp:docPr$1><a:extLst><a:ext><adec:decorative val="1"/></a:ext></a:extLst></wp:docPr>') } }
            : run,
        ),
      })),
    };
    const out = exportPdf(layoutDocument(decorative, measurer), { measurer, doc: decorative, image });
    expect(tree(out)).not.toContain('Figure');
  });

  it('reads a heading row drawn again on the next page once', () => {
    let long = insertTable(createDoc([para('')]), { para: 0, offset: 0 }, 60, 1).doc;
    const first = long.paragraphs.findIndex((p) => p.cell);
    long = setHeaderRow(insertText(long, { para: first, offset: 0 }, 'Item').doc, first, true);
    const layout = layoutDocument(long, measurer);
    expect(layout.pages.length).toBeGreaterThan(1);
    const out = exportPdf(layout, { measurer, doc: long });
    expect(tree(out).match(/TH/g)).toHaveLength(1);
    // Drawn on both pages, read from the first.
    const contents = [...objects(out).values()].filter((body) => body.includes(' Tj'));
    expect(contents.filter((body) => body.includes('<4974656D'))).toHaveLength(2);
    expect(contents.filter((body) => /\/P <<\/MCID \d+>> BDC\n[^E]*<4974656D/.test(body))).toHaveLength(1);
  });

  it('makes a paragraph of each, without the document', () => {
    const out = exportPdf(layoutDocument(createDoc([para('One'), para('Two')]), measurer), { measurer });
    expect(tree(out)).toBe('Document\n  P\n  P');
  });
});
