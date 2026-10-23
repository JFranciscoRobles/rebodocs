import { describe, expect, it } from 'vitest';
import { zlibSync } from 'fflate';
import { type Doc, type Paragraph, columnsAt, letterheadOf, createDoc, exportDocx, importDocx, insertTable, linkHref, plainText, setParagraphStyle, tocRange } from '@rebodocs/core/internal';
import { TOOLS, ToolError, runTool } from '../src/tools';

const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });

function base(): Doc {
  const doc = createDoc([
    p('Contrato de servicios'),
    p('Objeto'),
    p('El cliente {{cliente | mayúsculas}} contrata el servicio.'),
    p('Precio'),
    p('El precio es de {{importe | moneda}}, a pagar el {{fecha | fecha larga}}.'),
    p('El cliente acepta.'),
  ]);
  return [
    [0, 'Title'],
    [1, 'Heading1'],
    [3, 'Heading1'],
  ].reduce((now, [para, style]) => setParagraphStyle(now, para as number, para as number, style as string), doc);
}
const texts = (doc: Doc) => doc.paragraphs.map((para) => plainText(para.runs).replace(/⁠/g, ''));
/** Runs a tool and gives the document after it, which must have changed. */
const apply = (doc: Doc, name: string, args: Record<string, unknown>) => {
  const result = runTool(doc, name, args, { now: new Date('2026-10-12T12:00:00Z') });
  expect(result.doc, result.text).toBeDefined();
  return result.doc!;
};
const error = (doc: Doc, name: string, args: Record<string, unknown>) => {
  try {
    runTool(doc, name, args);
  } catch (e) {
    expect(e).toBeInstanceOf(ToolError);
    return (e as Error).message;
  }
  throw new Error('expected the tool to fail');
};

describe('tools for an assistant', () => {
  it('describes each tool with a schema of its own', () => {
    expect(new Set(TOOLS.map((tool) => tool.name)).size).toBe(TOOLS.length);
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(20);
      for (const name of tool.required ?? []) expect(tool.properties).toHaveProperty(name);
    }
  });

  it('reads the document by numbered paragraphs', () => {
    const doc = base();
    const overview = runTool(doc, 'get_overview').text;
    expect(overview).toContain('6 paragraphs');
    expect(overview).toContain('- Objeto [2]');
    expect(overview).toContain('Template variables: cliente, importe, fecha');
    expect(runTool(doc, 'read_document', { from: 1, to: 3 }).text).toBe('[1] (Title) Contrato de servicios\n[2] (Heading1) Objeto\n[3] El cliente {{cliente | mayúsculas}} contrata el servicio.');
    expect(runTool(doc, 'find_text', { query: 'el cliente' }).text).toMatch(/^2 matches:\n\[3\] El cliente .*\n\[6\] El cliente acepta\.$/);
    expect(runTool(doc, 'list_variables').text).toContain('cliente — used 1×; formats: mayúsculas');
    expect(error(doc, 'read_document', { from: 9 })).toContain('There is no paragraph 9');
  });

  it('shows each place found with the words around it, not those of the first in its paragraph', () => {
    const long = 'The deposit reserves the house for the buyer until the day of signing at the notary. The deposit is credited to the price.';
    const marked: Paragraph = {
      props: {},
      runs: [
        { text: 'Kept after a long while of thinking it over: ', props: {} },
        { text: 'the deposit', props: { revision: 'insert' } },
        { text: '\tand later, much later, once all was signed, the deposit.', props: {} },
      ],
    };
    const lines = runTool(createDoc([p(long), marked]), 'find_text', { query: 'deposit' }).text.split('\n');
    expect(lines[0]).toBe('4 matches:');
    expect(lines[1]).toMatch(/^\[1\] The deposit reserves/);
    expect(lines[1]).not.toContain('credited');
    expect(lines[2]).toContain('notary. The deposit is credited');
    // Around the marks of a change and a tab, the place is that of the text as read_document shows it.
    expect(lines[3]).toContain('over: {+the deposit+}');
    expect(lines[4]).toMatch(/^\[2\] …/);
    expect(lines[4]).toContain('once all was signed, the deposit.');
  });

  it('finds a place by its text, and asks which when there are several', () => {
    const doc = base();
    expect(error(doc, 'replace_text', { find: 'El cliente', replace: 'La clienta' })).toContain('found 2 times, in paragraphs 3, 6');
    expect(error(doc, 'replace_text', { find: 'el CLIENTE', replace: 'x' })).toContain('other capital letters');
    expect(error(doc, 'replace_text', { find: 'no está', replace: 'x' })).toContain('is not in the document');
    expect(texts(apply(doc, 'replace_text', { find: 'El cliente', replace: 'La clienta', paragraph: 6 }))[5]).toBe('La clienta acepta.');
    expect(texts(apply(doc, 'replace_text', { find: 'El cliente', replace: 'La clienta', occurrence: 1 }))[2]).toMatch(/^La clienta /);
    const all = texts(apply(doc, 'replace_text', { find: 'El cliente', replace: 'La clienta', all: true }));
    expect([all[2].slice(0, 10), all[5]]).toEqual(['La clienta', 'La clienta acepta.']);
    expect(texts(apply(doc, 'replace_text', { find: ' acepta', replace: '' }))[5]).toBe('El cliente.');
  });

  it('writes paragraphs, with styles and lists, and deletes them', () => {
    const doc = apply(base(), 'insert_paragraphs', {
      after_paragraph: 5,
      paragraphs: [{ text: 'Vigencia', style: 'heading 2' }, { text: 'Un año.' }, { text: 'Prorrogable', list: 'bullet' }, { text: 'Revisable', list: 'bullet' }],
    });
    expect(runTool(doc, 'read_document', { from: 6, to: 10 }).text).toBe('[6] (Heading2) Vigencia\n[7] Un año.\n[8] • Prorrogable\n[9] • Revisable\n[10] El cliente acepta.');
    expect(texts(apply(doc, 'insert_paragraphs', { after_paragraph: 0, paragraphs: [{ text: 'Borrador' }] }))[0]).toBe('Borrador');
    expect(error(doc, 'insert_paragraphs', { after_paragraph: 5, paragraphs: [{ text: 'x', style: 'Rara' }] })).toContain('The styles of this document are: Normal');
    const numbered = apply(doc, 'set_list', { from: 8, to: 9, kind: 'number' });
    expect(runTool(numbered, 'read_document', { from: 8, to: 9 }).text).toBe('[8] 1. Prorrogable\n[9] 2. Revisable');
    expect(runTool(apply(numbered, 'set_list', { from: 8, to: 9, kind: 'none' }), 'read_document', { from: 8, to: 9 }).text).toBe('[8] Prorrogable\n[9] Revisable');
    expect(texts(apply(doc, 'delete_paragraphs', { from: 6, to: 9 }))).toEqual(texts(base()));
    expect(runTool(apply(doc, 'set_style', { from: 7, style: 'Heading1' }), 'get_overview').text).toContain('- Un año. [7]');
  });

  it('formats, links and notes a text', () => {
    let doc = apply(base(), 'format_text', { find: 'acepta', bold: true, color: '#c0392b', highlight: 'FFFF00' });
    expect(doc.paragraphs[5].runs.find((run) => run.text === 'acepta')!.props).toMatchObject({ bold: true, color: 'C0392B', highlight: 'FFFF00' });
    expect(error(doc, 'format_text', { find: 'acepta' })).toContain('Say what to change');
    expect(error(doc, 'format_text', { find: 'acepta', highlight: '123456' })).toContain('Word only has these highlight colours');
    doc = apply(doc, 'set_link', { find: 'servicio', paragraph: 3, url: 'ejemplo.com' });
    expect(runTool(doc, 'list_links').text).toBe('[3] "servicio" → https://ejemplo.com');
    expect(error(doc, 'set_link', { find: 'acepta', url: 'javascript:alert(1)' })).toContain('not an address a link can open');
    expect(apply(doc, 'set_link', { find: 'servicio', paragraph: 3, url: '' }).paragraphs[2].runs.some((run) => linkHref(run.props))).toBe(false);
    doc = apply(doc, 'add_note', { find: 'El precio es de', note: '¿Lleva IVA?', author: 'Revisor' });
    expect(runTool(doc, 'list_notes').text).toBe('0 [5] Revisor on "El precio es de": ¿Lleva IVA?');
    // The marks of the note take no room in what is read, and the text under it is still found.
    expect(runTool(doc, 'read_document', { from: 5, to: 5 }).text).toMatch(/^\[5\] El precio es de \{\{importe/);
    expect(runTool(apply(doc, 'remove_note', { id: '0' }), 'list_notes').text).toBe('The document has no notes.');
    expect(error(doc, 'remove_note', { id: '7' })).toContain('There is no note "7"');
  });

  it('fills the variables of a template', () => {
    const result = runTool(base(), 'fill_variables', { values: { cliente: 'ana pérez', importe: 1500, fecha: '2026-10-12', otra: 'x' }, locale: 'es-MX' }, {});
    expect(texts(result.doc!).slice(2, 5)).toEqual(['El cliente ANA PÉREZ contrata el servicio.', 'Precio', 'El precio es de $1,500.00, a pagar el 12 de octubre de 2026.']);
    expect(result.text).toBe('Filled 3 of 3 variables.\nNot variables of this document: otra.');
    const partial = runTool(base(), 'fill_variables', { values: { cliente: 'Ana', fecha: 'mañana' }, locale: 'es-MX' });
    expect(partial.text).toContain('Filled 2 of 3 variables.\nStill without a value: importe.');
    expect(partial.text).toContain('"mañana", is not one "fecha larga" can write');
  });

  it('fills the blocks of a template with lists and yes or no, and lists them', () => {
    const doc = createDoc(
      ['Pedido', '{{#lineas}}', '{{lineas.cosa}}: {{lineas.precio | moneda}}', '{{/lineas}}', '{{^pagado}}Pendiente de pago.{{/pagado}}'].map((text) => ({ props: {}, runs: [{ text, props: {} }] })),
    );
    expect(runTool(doc, 'list_variables', {}).text).toBe(
      'lineas.cosa — used 1×\nlineas.precio — used 1×; formats: moneda\nBlocks:\n{{#lineas}} — paragraphs, repeated for each item of a list, or kept for true\n{{^pagado}} — some text, kept when the value is not there',
    );
    const result = runTool(doc, 'fill_variables', {
      values: {
        lineas: [
          { cosa: 'Mesa', precio: 250 },
          { cosa: 'Silla', precio: 90 },
        ],
        pagado: false,
      },
    });
    expect(texts(result.doc!)).toEqual(['Pedido', 'Mesa: $250.00', 'Silla: $90.00', 'Pendiente de pago.']);
    expect(result.text).toBe('Filled 2 of 2 variables.\nWrote out 2 of 2 blocks.');
  });

  it('puts in a table, signatures, a page break and a table of contents', () => {
    let doc = apply(base(), 'insert_table', {
      after_paragraph: 5,
      rows: [
        ['Concepto', 'Importe'],
        ['Servicio', '$1,500.00'],
      ],
    });
    expect(runTool(doc, 'read_document', { from: 6, to: 9 }).text).toBe(
      '[6] (table 1, row 1, cell 1) Concepto\n[7] (table 1, row 1, cell 2) Importe\n[8] (table 1, row 2, cell 1) Servicio\n[9] (table 1, row 2, cell 2) $1,500.00',
    );
    expect(doc.paragraphs[5].runs[0].props.bold).toBe(true);
    expect(doc.paragraphs[7].runs[0].props.bold).toBeFalsy();
    expect(error(doc, 'insert_table', { after_paragraph: 6, rows: [['a']] })).toContain('cannot go inside another');
    expect(error(doc, 'insert_table', { after_paragraph: 1, rows: [['a', 'b'], ['c']] })).toContain('same number of cells');
    expect(error(doc, 'delete_paragraphs', { from: 6, to: 7 })).toContain('are in a table');
    const last = doc.paragraphs.length;
    doc = apply(doc, 'insert_signatures', { after_paragraph: last, titles: ['ASESOR', 'CLIENTE'], names: ['{{asesor | mayúsculas}}', 'ANA PÉREZ'] });
    const signed = texts(doc).slice(last);
    expect([signed[0], signed[2], signed[3], signed[5]]).toEqual(['ASESOR', '{{asesor | mayúsculas}}', 'CLIENTE', 'ANA PÉREZ']);
    doc = apply(doc, 'insert_page_break', { after_paragraph: 3 });
    expect(runTool(doc, 'read_document', { from: 3, to: 3 }).text).toMatch(/\[page break\]$/);

    expect(error(doc, 'insert_table_of_contents', { after_paragraph: 1 })).toContain('cannot be worked out here');
    const pageOf = (now: Doc) => (para: number) => (plainText(now.paragraphs[para].runs) === 'Precio' ? 2 : 1);
    const result = runTool(doc, 'insert_table_of_contents', { after_paragraph: 1 }, { pageOf });
    expect(texts(result.doc!).slice(1, 4)).toEqual(['Índice', 'Objeto\t1', 'Precio\t2']);
    expect(tocRange(result.doc!)).toEqual({ first: 2, last: 3 });
    expect(runTool(result.doc!, 'update_table_of_contents', {}, { pageOf }).text).toContain('already up to date');
    const renamed = apply(result.doc!, 'replace_text', { find: 'Precio', replace: 'Honorarios', occurrence: 2 });
    const updated = runTool(renamed, 'update_table_of_contents', {}, { pageOf });
    expect(texts(updated.doc!)[3]).toBe('Honorarios\t1');
    expect(error(result.doc!, 'insert_table_of_contents', { after_paragraph: 1 })).toContain('already has a table of contents');
  });

  it('reads and writes the header and the footer as documents of their own', () => {
    const doc = base();
    expect(runTool(doc, 'read_document', { area: 'header' }).text).toBe('The document has no header.');
    const headed = apply(doc, 'insert_paragraphs', { area: 'header', after_paragraph: 0, paragraphs: [{ text: 'Contrato · {{cliente}}' }] });
    // The empty paragraph a new header starts as is not left behind, and the text of the document is not touched.
    expect(headed.header!.paragraphs.map((para) => plainText(para.runs))).toEqual(['Contrato · {{cliente}}']);
    expect(headed.paragraphs).toBe(doc.paragraphs);
    expect(runTool(headed, 'read_document', { area: 'header' }).text).toBe('[1] Contrato · {{cliente}}');
    expect(runTool(headed, 'get_overview').text).toContain('Header: Contrato · {{cliente}}');
    const bold = apply(headed, 'format_text', { area: 'header', find: 'Contrato', bold: true });
    expect(bold.header!.paragraphs[0].runs[0]).toMatchObject({ text: 'Contrato', props: { bold: true } });
    expect(plainText(apply(bold, 'replace_text', { area: 'header', find: 'Contrato', replace: 'Convenio' }).header!.paragraphs[0].runs)).toBe('Convenio · {{cliente}}');
    expect(error(headed, 'replace_text', { area: 'header', find: 'Objeto', replace: 'x' })).toContain('is not in the document');
    expect(error(headed, 'update_table_of_contents', { area: 'header' })).toContain('only works on the text of the document');
    expect(error(headed, 'read_document', { area: 'margin' })).toContain('"area" must be');
    // The number of the page goes in a paragraph of its own, and what was there stays.
    const numbered = apply(headed, 'set_page_number', { place: 'footer', format: 'pageOfTotal' });
    expect(runTool(numbered, 'read_document', { area: 'footer' }).text).toMatch(/^\[1\] Page \d+ of \d+$/);
    expect(runTool(apply(numbered, 'set_page_number', { place: 'header', align: 'right' }), 'read_document', { area: 'header' }).text).toMatch(/Contrato · \{\{cliente\}\}/);
    expect(runTool(apply(numbered, 'set_page_number', { place: 'none' }), 'read_document', { area: 'footer' }).text).not.toMatch(/Page \d/);
    const back = importDocx(exportDocx(numbered));
    expect(runTool(back, 'read_document', { area: 'header' }).text).toBe('[1] Contrato · {{cliente}}');
  });

  it('changes the shape of a table', () => {
    const table = (doc: Doc) =>
      runTool(doc, 'read_document', { from: 7 })
        .text.split('\n')
        .filter((row) => row.includes('table 1'))
        .map((row) => row.replace(/^\[\d+\] \(table 1, row (\d+), cell (\d+)\) ?/, '$1.$2 '));
    let doc = apply(base(), 'insert_table', {
      after_paragraph: 6,
      rows: [
        ['a', 'b'],
        ['c', 'd'],
      ],
    });
    expect(table(doc)).toEqual(['1.1 a', '1.2 b', '2.1 c', '2.2 d']);
    doc = apply(doc, 'edit_table', { paragraph: 9, action: 'insert_row_below' });
    expect(table(doc)).toEqual(['1.1 a', '1.2 b', '2.1 c', '2.2 d', '3.1 ', '3.2 ']);
    doc = apply(doc, 'edit_table', { paragraph: 7, action: 'insert_column_right' });
    expect(table(doc)).toEqual(['1.1 a', '1.2 ', '1.3 b', '2.1 c', '2.2 ', '2.3 d', '3.1 ', '3.2 ', '3.3 ']);
    doc = apply(doc, 'edit_table', { paragraph: 8, action: 'delete_column' });
    doc = apply(doc, 'edit_table', { paragraph: 11, action: 'delete_row' });
    expect(table(doc)).toEqual(['1.1 a', '1.2 b', '2.1 c', '2.2 d']);
    const merged = apply(doc, 'edit_table', { paragraph: 7, to_paragraph: 8, action: 'merge_cells' });
    expect(merged.tables![0].rows[0].cells[0].span).toBe(2);
    expect(apply(merged, 'edit_table', { paragraph: 7, action: 'split_cell' }).tables![0].rows[0].cells[0].span).toBe(1);
    expect(error(doc, 'edit_table', { paragraph: 7, action: 'split_cell' })).toContain('not a merged one');
    expect(apply(doc, 'edit_table', { paragraph: 7, to_paragraph: 8, action: 'shade_cells', shade: 'E8EEF9' }).tables![0].rows[0].cells.map((cell) => cell.shade)).toEqual(['E8EEF9', 'E8EEF9']);
    expect(apply(doc, 'edit_table', { paragraph: 7, action: 'hide_borders' }).tables![0].rows.flatMap((row) => row.cells.map((cell) => cell.borders))).toEqual([false, false, false, false]);
    expect(error(doc, 'edit_table', { paragraph: 2, action: 'delete_row' })).toContain('is not in a table');
    const wide = apply(doc, 'edit_table', { paragraph: 7, action: 'set_column_widths', widths_cm: [2.54, 5.08] });
    expect(wide.tables![0]).toMatchObject({ columns: [72, 144], fixed: true });
    expect(importDocx(exportDocx(wide)).tables![0].columns).toEqual([72, 144]);
    expect(error(doc, 'edit_table', { paragraph: 7, action: 'set_column_widths', widths_cm: [3] })).toContain('give 2 widths');
    expect(error(doc, 'edit_table', { paragraph: 7, action: 'set_column_widths', widths_cm: [15, 15] })).toContain('between the margins');
    // Another table right after it is not taken with it.
    expect(doc.paragraphs).toHaveLength(11);
    const two = apply(doc, 'insert_table', { after_paragraph: 11, rows: [['x']], header: false });
    const gone = apply(two, 'edit_table', { paragraph: 7, action: 'delete_table' });
    expect(runTool(gone, 'get_overview').text).toContain('1 tables');
    expect(texts(gone).filter((value) => 'abcdx'.includes(value) && value)).toEqual(['x']);
    expect(runTool(importDocx(exportDocx(merged)), 'read_document').text).toBe(runTool(merged, 'read_document').text);
  });

  it('puts in a picture from its bytes', () => {
    // A PNG of 200 × 100 is its first chunk; nothing here draws it.
    const png = new Uint8Array(33);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 200, 0, 0, 0, 100, 8, 6, 0, 0, 0]);
    const data = btoa(String.fromCharCode(...png));
    const result = runTool(base(), 'insert_image', { after_paragraph: 2, path: 'logo.png', data, type: 'image/png', align: 'center' });
    expect(result.text).toBe('Picture inserted as paragraph 3, 5.3 × 2.6 cm.');
    expect(runTool(result.doc!, 'read_document', { from: 3, to: 3 }).text).toBe('[3] [image]');
    expect(result.doc!.paragraphs[2].props.align).toBe('center');
    expect(result.doc!.paragraphs[2].runs.find((run) => run.props.object)!.props).toMatchObject({ objectWidth: 150, objectHeight: 75 });
    const wide = runTool(base(), 'insert_image', { after_paragraph: 2, path: 'logo.png', data, type: 'image/png', width_cm: 40 });
    expect(wide.doc!.paragraphs[2].runs.find((run) => run.props.object)!.props.objectWidth).toBe(base().page.width - base().page.marginLeft - base().page.marginRight);
    expect(error(base(), 'insert_image', { after_paragraph: 2, path: 'logo.png' })).toContain('could not be read');
    expect(error(base(), 'insert_image', { after_paragraph: 2, path: 'x.bmp', data, type: 'image/bmp' })).toContain('Only PNG, JPEG and GIF');
    expect(error(base(), 'insert_image', { after_paragraph: 2, path: 'x.png', data: btoa('no'), type: 'image/png' })).toContain('not a picture that can be read');
    // It is carried by a DOCX.
    expect(Object.keys(importDocx(exportDocx(result.doc!)).source!.files).some((name) => /media\/.*\.png$/.test(name))).toBe(true);
  });

  it('gives the document a letterhead, with the margins to clear it, and takes it away', () => {
    // A PNG the shape of a Letter page, 34 × 44, with a dark band across its top four rows.
    const width = 34;
    const height = 44;
    const rows = new Uint8Array(height * (1 + width * 4));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) rows.set(y < 4 ? [20, 40, 90, 255] : [255, 255, 255, 255], y * (1 + width * 4) + 1 + x * 4);
    const crc = (bytes: Uint8Array) => {
      let c = ~0;
      for (const byte of bytes) {
        c ^= byte;
        for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
      }
      return ~c >>> 0;
    };
    const chunk = (name: string, body: Uint8Array) => {
      const out = new Uint8Array(12 + body.length);
      const view = new DataView(out.buffer);
      view.setUint32(0, body.length);
      out.set(
        [...name].map((c) => c.charCodeAt(0)),
        4,
      );
      out.set(body, 8);
      view.setUint32(8 + body.length, crc(out.subarray(4, 8 + body.length)));
      return out;
    };
    const head = new Uint8Array(13);
    new DataView(head.buffer).setUint32(0, width);
    new DataView(head.buffer).setUint32(4, height);
    head.set([8, 6, 0, 0, 0], 8);
    const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlibSync(rows)), chunk('IEND', new Uint8Array())];
    const png = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
    parts.reduce((at, part) => (png.set(part, at), at + part.length), 0);
    const given = runTool(base(), 'set_letterhead', { path: 'paper.png', data: btoa(String.fromCharCode(...png)), type: 'image/png' });
    // Four rows of 44 are 72 points of the page; 18 more of room.
    expect(given.text).toBe('Letterhead set, behind the text of every page. Top margin 3.2 cm, bottom 2.5 cm, to clear what it prints.');
    expect(letterheadOf(given.doc!)).toBeDefined();
    expect(given.doc!.page.marginTop).toBe(90);
    expect(runTool(given.doc!, 'get_overview', {}).text).toContain('It has a letterhead');
    const removed = runTool(given.doc!, 'set_letterhead', { remove: true });
    expect(letterheadOf(removed.doc!)).toBeUndefined();
    expect(runTool(base(), 'set_letterhead', { remove: true }).text).toBe('The document has no letterhead.');
    expect(error(base(), 'set_letterhead', {})).toContain('Give "path"');
  });

  it('moves a picture, gives it another size and takes it away', () => {
    const png = new Uint8Array(33);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 200, 0, 0, 0, 100, 8, 6, 0, 0, 0]);
    const image = { path: 'logo.png', data: btoa(String.fromCharCode(...png)), type: 'image/png' };
    const doc = apply(base(), 'insert_image', { after_paragraph: 2, align: 'center', ...image });
    const picture = (now: Doc, para: number) => now.paragraphs[para].runs.find((run) => run.props.object && !run.props.anchor)?.props;
    const sized = apply(doc, 'edit_image', { paragraph: 3, action: 'resize', width_cm: 2.54 });
    expect([picture(sized, 2)!.objectWidth, picture(sized, 2)!.objectHeight]).toEqual([72, 36]);
    expect(picture(sized, 2)!.object).toContain('cx="914400" cy="457200"');
    const moved = runTool(doc, 'edit_image', { paragraph: 3, action: 'move', after_paragraph: 7 });
    expect(moved.text).toBe('The picture is now in paragraph 7.');
    // The paragraph it left is gone, and the one it is in is centred as that one was.
    expect(runTool(moved.doc!, 'read_document', { from: 3 }).text).toBe(`${runTool(base(), 'read_document', { from: 3 }).text}\n[7] [image]`);
    expect(moved.doc!.paragraphs[6].props.align).toBe('center');
    const up = runTool(moved.doc!, 'edit_image', { paragraph: 7, action: 'move', after_paragraph: 0 });
    expect(up.text).toBe('The picture is now in paragraph 1.');
    expect(runTool(up.doc!, 'read_document', { to: 2 }).text).toBe('[1] [image]\n[2] (Title) Contrato de servicios');
    expect(up.doc!.paragraphs).toHaveLength(7);
    expect(apply(doc, 'edit_image', { paragraph: 3, action: 'align', align: 'right' }).paragraphs[2].props.align).toBe('right');
    expect(picture(apply(doc, 'edit_image', { paragraph: 3, action: 'delete' }), 2)).toBeUndefined();
    expect(error(doc, 'edit_image', { paragraph: 2, action: 'delete' })).toContain('has no picture');
    expect(error(doc, 'edit_image', { paragraph: 3, occurrence: 2, action: 'delete' })).toContain('has 1 picture');
    expect(picture(importDocx(exportDocx(sized)), 2)).toMatchObject({ objectWidth: 72, objectHeight: 36 });
    // A description, for whoever cannot see it: read back with the picture, and taken away with an empty one.
    const described = runTool(doc, 'edit_image', { paragraph: 3, action: 'describe', description: 'The logo of the firm' });
    expect(described.text).toBe('The picture is described as: The logo of the firm');
    expect(runTool(described.doc!, 'read_document', { from: 3, to: 3 }).text).toBe('[3] [image: The logo of the firm]');
    expect(runTool(described.doc!, 'read_document', { from: 3, to: 3 }).text).toBe(runTool(importDocx(exportDocx(described.doc!)), 'read_document', { from: 3, to: 3 }).text);
    expect(runTool(apply(described.doc!, 'edit_image', { paragraph: 3, action: 'describe', description: '' }), 'read_document', { from: 3, to: 3 }).text).toBe('[3] [image]');
  });

  it('puts tables and pictures in a header, which a DOCX carries', () => {
    const png = new Uint8Array(33);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 200, 0, 0, 0, 100, 8, 6, 0, 0, 0]);
    const image = { path: 'logo.png', data: btoa(String.fromCharCode(...png)), type: 'image/png' };
    let doc = apply(base(), 'insert_paragraphs', { area: 'header', after_paragraph: 0, paragraphs: [{ text: 'Contrato' }] });
    doc = apply(doc, 'insert_image', { area: 'header', after_paragraph: 1, width_cm: 2, ...image });
    doc = apply(doc, 'insert_table', { area: 'header', after_paragraph: 2, rows: [['Folio', '{{folio}}']], header: false });
    const header = '[1] Contrato\n[2] [image]\n[3] (table 1, row 1, cell 1) Folio\n[4] (table 1, row 1, cell 2) {{folio}}\n[5] ';
    expect(runTool(doc, 'read_document', { area: 'header' }).text).toBe(header);
    expect(Object.keys(doc.media ?? {})).toHaveLength(1);
    expect(error(doc, 'add_note', { area: 'header', find: 'Contrato', note: 'x' })).toContain('Word has no comments there');

    const bytes = exportDocx(doc);
    const files = importDocx(bytes).source!.files;
    const part = Object.keys(files).find((name) => /header\d+\.xml$/.test(name))!;
    const xml = new TextDecoder().decode(files[part]);
    expect(xml).toMatch(/<w:tbl>.*Folio.*<\/w:tbl><w:p>.*<\/w:p><\/w:hdr>$/s);
    // The picture is named by a relationship of the header, not of the document.
    const id = /r:embed="(rId\d+)"/.exec(xml)![1];
    expect(new TextDecoder().decode(files[part.replace(/([^/]+)$/, '_rels/$1.rels')])).toContain(`Id="${id}"`);
    expect(xml).not.toContain('dx:');
    const back = importDocx(bytes);
    expect(runTool(back, 'read_document', { area: 'header' }).text).toBe(header);

    // A header that came from a file takes a new table too, where it was put; the one it had keeps its shape.
    const more = apply(back, 'insert_table', { area: 'header', after_paragraph: 1, rows: [['a', 'b']], header: false });
    expect(runTool(importDocx(exportDocx(more)), 'read_document', { area: 'header' }).text.replace(/\(table \d+, /g, '(')).toBe(
      '[1] Contrato\n[2] (row 1, cell 1) a\n[3] (row 1, cell 2) b\n[4] \n[5] [image]\n[6] (row 1, cell 1) Folio\n[7] (row 1, cell 2) {{folio}}\n[8] ',
    );
    expect(error(back, 'edit_table', { area: 'header', paragraph: 3, action: 'insert_row_below' })).toContain('cannot be given another shape here');
    expect(runTool(back, 'edit_table', { area: 'header', paragraph: 3, action: 'shade_cells', shade: 'FFF2CC' }).doc).toBeDefined();
    // One made here can be: it is not one the file had.
    const reshaped = apply(more, 'edit_table', { area: 'header', paragraph: 2, action: 'insert_row_below' });
    expect(runTool(reshaped, 'read_document', { area: 'header', from: 2, to: 5 }).text).toMatch(/row 2, cell 2\) $/);
  });

  it('leaves a document a DOCX can carry', () => {
    let doc = apply(base(), 'insert_table', { after_paragraph: 6, rows: [['a', 'b']] });
    doc = apply(doc, 'add_note', { find: 'acepta', note: 'Revisar' });
    doc = apply(doc, 'set_link', { find: 'servicio', paragraph: 3, url: 'https://ejemplo.com' });
    const back = importDocx(exportDocx(doc));
    expect(runTool(back, 'read_document').text).toBe(runTool(doc, 'read_document').text);
    expect(runTool(back, 'list_notes').text).toBe(runTool(doc, 'list_notes').text);
    expect(runTool(back, 'list_links').text).toBe(runTool(doc, 'list_links').text);
  });
  it('says how the text looks, and keeps it when the text is written anew', () => {
    const fancy: Paragraph = {
      props: { align: 'justify', indentLeft: 36, spacingAfter: 12 },
      runs: [
        { text: 'Del Cliente. ', props: { bold: true, fontFamily: 'Georgia', fontSize: 12 } },
        { text: 'Pagar a tiempo.', props: { fontFamily: 'Georgia', fontSize: 12, color: '1F3864' } },
      ],
    };
    const doc = createDoc([p('Uno'), fancy]);
    const seen = runTool(doc, 'read_formatting', { from: 2 }).text;
    expect(seen).toContain('align justify; indent left 1.27 cm');
    expect(seen).toContain('"Del Cliente. " — Georgia 12 pt, bold');
    expect(seen).toContain('"Pagar a tiempo." — Georgia 12 pt, color 1F3864');
    expect(runTool(doc, 'get_overview').text).toContain('Georgia 12 pt');

    // Translated: the paragraph keeps its place on the page, and its words their look.
    const done = apply(doc, 'rewrite_paragraph', { paragraph: 2, segments: [{ text: 'Of the Client. ', bold: true }, { text: 'Pay on time.' }] });
    expect(texts(done)[1]).toBe('Of the Client. Pay on time.');
    expect(done.paragraphs[1].props).toMatchObject({ align: 'justify', indentLeft: 36, spacingAfter: 12 });
    expect(done.paragraphs[1].runs.map((run) => [run.text, !!run.props.bold, run.props.fontFamily, run.props.color])).toEqual([
      ['Of the Client. ', true, 'Georgia', '1F3864'],
      ['Pay on time.', false, 'Georgia', '1F3864'],
    ]);
    expect(error(doc, 'rewrite_paragraph', { paragraph: 2, text: 'a\nb' })).toContain('no line breaks');

    // New paragraphs like one that is there.
    const added = apply(doc, 'insert_paragraphs', { after_paragraph: 2, like_paragraph: 2, paragraphs: [{ text: 'Also this.' }, { segments: [{ text: 'And ' }, { text: 'this', italic: true }] }] });
    expect(added.paragraphs[2].props).toMatchObject({ align: 'justify', indentLeft: 36 });
    expect(added.paragraphs[2].runs[0].props).toMatchObject({ fontFamily: 'Georgia', fontSize: 12 });
    expect(added.paragraphs[3].runs.map((run) => [run.text, !!run.props.italic])).toEqual([
      ['And ', false],
      ['this', true],
    ]);
  });

  it('changes the font and size of a text, and how paragraphs sit', () => {
    const doc = base();
    const sized = apply(doc, 'format_text', { from: 5, to: 6, font_family: 'Times New Roman', font_size: 13 });
    expect(sized.paragraphs[4].runs.every((run) => run.props.fontFamily === 'Times New Roman' && run.props.fontSize === 13)).toBe(true);
    expect(sized.paragraphs[2].runs[0].props.fontFamily).not.toBe('Times New Roman');
    expect(apply(doc, 'format_text', { find: 'acepta', font_size: 20 }).paragraphs[5].runs.some((run) => run.text === 'acepta' && run.props.fontSize === 20)).toBe(true);
    expect(error(doc, 'format_text', { font_size: 12 })).toContain('Say what text');

    const placed = apply(doc, 'format_paragraphs', { from: 3, align: 'center', first_line_cm: 1.27, space_after_pt: 6, line_spacing: 1.5 });
    expect(placed.paragraphs[2].props).toMatchObject({ align: 'center', indentFirstLine: 36, spacingAfter: 6, lineHeight: 1.5 });
    expect(error(doc, 'format_paragraphs', { from: 3 })).toContain('Say what to change');

    const tabbed = apply(doc, 'format_paragraphs', { from: 3, tab_stops: [{ at_cm: 10, align: 'right', leader: 'dot' }, { at_cm: 2.54 }] });
    expect(tabbed.paragraphs[2].props.tabs).toEqual([
      { pos: 72, align: 'left' },
      { pos: 283.46, align: 'right', leader: 'dot' },
    ]);
    expect(runTool(tabbed, 'read_formatting', { from: 3, to: 3 }).text).toContain('tab stops left at 2.54 cm, right with dots at 10 cm');
    expect(error(doc, 'format_paragraphs', { from: 3, tab_stops: [{ at_cm: 2, align: 'middle' }] })).toContain('"align" must be');
  });

  it('sets text in columns, breaks a column, and changes the page', () => {
    const doc = base();
    const two = apply(doc, 'set_columns', { from: 5, to: 6, count: 2, separator: true });
    const at = texts(two).indexOf('El cliente acepta.');
    expect(columnsAt(two, at)).toMatchObject({ count: 2, separator: true });
    expect(columnsAt(two, 0).count).toBe(1);
    expect(runTool(two, 'get_overview').text).toMatch(/Columns: paragraphs \d+ to \d+ in 2 columns/);
    const broken = apply(two, 'insert_column_break', { find: 'El cliente acepta.' });
    expect(texts(broken).length).toBeGreaterThanOrEqual(texts(two).length);
    expect(error(doc, 'insert_column_break', { at_paragraph: 2 })).toContain('not in columns');

    const page = apply(doc, 'set_page_setup', { paper: 'a4', orientation: 'landscape', margin_left_cm: 2 });
    expect(page.page.width).toBeCloseTo(841.9);
    expect(page.page.marginLeft).toBeCloseTo(56.69, 1);
    expect(error(doc, 'set_page_setup', { margin_left_cm: 10, margin_right_cm: 10 })).toContain('less than 2 cm');
  });

  it('puts notes at the foot of the page, reads them and changes them', () => {
    const one = apply(base(), 'insert_footnote', { find: 'el servicio', text: 'Según el anexo A.' });
    const two = apply(one, 'insert_footnote', { at_paragraph: 2, text: 'Primera nota del texto.' });
    const read = runTool(two, 'read_document').text;
    // Numbered by where they are in the text, not by when they were made.
    expect(read).toContain('[2] (Heading1) Objeto[^1]');
    expect(read).toContain('contrata el servicio[^2].');
    expect(read).toMatch(/\[\^1\] Primera nota del texto\.\n\[\^2\] Según el anexo A\./);
    expect(runTool(two, 'get_overview').text).toContain('2 notes at the foot of the page');
    const changed = apply(two, 'replace_text', { area: 'footnote', area_footnote: 2, find: 'anexo A', replace: 'anexo B' });
    expect(runTool(changed, 'read_document', { area: 'footnote', area_footnote: 2 }).text).toContain('Según el anexo B.');
    expect(error(two, 'read_document', { area: 'footnote', area_footnote: 3 })).toContain('from 1 to 2');
    // What is written goes into the file, and comes back.
    expect(runTool(importDocx(exportDocx(changed)), 'read_document').text).toContain('[^2] Según el anexo B.');
  });

  it('puts a text box in, lists it and changes its text', () => {
    const doc = apply(base(), 'insert_text_box', { text: 'Precio fijo\nSin IVA', at_paragraph: 5 });
    const overview = runTool(doc, 'get_overview').text;
    expect(overview).toContain('Text boxes');
    expect(overview).toContain('1. Precio fijo / Sin IVA');
    expect(runTool(doc, 'read_document', { area: 'textbox', area_textbox: 1 }).text).toContain('[2] Sin IVA');
    const changed = apply(doc, 'replace_text', { area: 'textbox', area_textbox: 1, find: 'Sin IVA', replace: 'IVA incluido' });
    expect(runTool(importDocx(exportDocx(changed)), 'read_document', { area: 'textbox', area_textbox: 1 }).text).toContain('IVA incluido');
    expect(error(doc, 'read_document', { area: 'textbox', area_textbox: 2 })).toContain('from 1 to 1');
  });

  it('tracks what it changes while changes are tracked, and accepts or rejects them', () => {
    const on = apply(base(), 'track_changes', { on: true });
    expect(runTool(on, 'get_overview').text).toContain('Changes are tracked');
    const edited = apply(apply(on, 'replace_text', { find: 'El cliente acepta.', replace: 'El cliente acepta las condiciones.' }), 'delete_paragraphs', { from: 4, to: 4 });
    const read = runTool(edited, 'read_document').text;
    expect(read).toContain('[6] El cliente acepta{+ las condiciones+}.');
    expect(read).toContain('[4] (Heading1) [-Precio-][-¶-]');
    const listed = runTool(edited, 'list_changes').text;
    expect(listed).toContain('2 tracked changes');
    expect(listed).toMatch(/1\. Assistant took out "Precio" and the paragraph break after it \(paragraph 4, 2026-10-12 12:00\)/);
    expect(listed).toContain('2. Assistant put in " las condiciones"');
    // One rejected, the other accepted: the heading is back, and the new words stay.
    const settled = apply(apply(edited, 'reject_changes', { changes: [1] }), 'accept_changes', {});
    expect(texts(settled)).toEqual(texts(apply(base(), 'replace_text', { find: 'El cliente acepta.', replace: 'El cliente acepta las condiciones.' })));
    expect(runTool(settled, 'list_changes').text).toContain('There are no tracked changes');
    // What it writes is Word's tracked changes.
    expect(runTool(importDocx(exportDocx(edited)), 'list_changes').text).toContain('2 tracked changes');
  });

  it('accepts or rejects the changes of one person, and one change alone where two people changed the same text', () => {
    const as = (who: string) => (doc: Doc, name: string, args: Record<string, unknown>) => runTool(doc, name, args, { reviser: who, now: new Date('2026-10-12T12:00:00Z') }).doc!;
    const on = apply(base(), 'track_changes', { on: true });
    const luis = as('Luis')(on, 'replace_text', { find: 'El cliente acepta.', replace: 'El cliente acepta las condiciones.' });
    // Ana takes out what Luis put in: it stays, as two changes.
    const ana = as('Ana')(luis, 'replace_text', { find: 'El cliente acepta las condiciones.', replace: 'El cliente acepta.' });
    const listed = runTool(ana, 'list_changes').text;
    expect(listed).toContain('1. Luis put in " las condiciones"');
    expect(listed).toContain('2. Ana took out " las condiciones"');
    // Ana's taking out rejected alone: Luis's words are his again.
    const back = apply(ana, 'reject_changes', { changes: [2] });
    expect(runTool(back, 'list_changes').text).toContain('1 tracked change:\n1. Luis put in " las condiciones"');
    // All of Luis's accepted: what is left is Ana's taking out.
    const theirs = apply(ana, 'accept_changes', { author: 'Luis' });
    expect(runTool(theirs, 'list_changes').text).toContain('1 tracked change:\n1. Ana took out " las condiciones"');
    expect(error(ana, 'accept_changes', { author: 'Pedro' })).toContain('"Luis", "Ana"');
  });

  it('says what changed from another version of the document', () => {
    const earlier = base();
    const later = apply(apply(earlier, 'replace_text', { find: 'El cliente acepta.', replace: 'El cliente acepta las condiciones.' }), 'delete_paragraphs', { from: 4, to: 4 });
    const data = btoa(String.fromCharCode(...exportDocx(earlier)));
    const said = runTool(later, 'compare_documents', { path: 'v1.docx', data }).text;
    expect(said).toContain('2 changes from the file to the document');
    expect(said).toContain('(only in the file, its paragraph 4) taken out: [-Precio-]');
    expect(said).toContain('[5] changed: El cliente acepta{+ las condiciones+}.');
    // The other way round, the numbers are still this document's.
    expect(runTool(earlier, 'compare_documents', { path: 'v2.docx', data: btoa(String.fromCharCode(...exportDocx(later))), file_is: 'later' }).text).toContain('[4] taken out: [-Precio-]');
    expect(runTool(earlier, 'compare_documents', { path: 'v1.docx', data }).text).toContain('There is no difference');
  });

  it('sets the page and the header of one section of several', () => {
    const doc = apply(apply(base(), 'set_columns', { from: 3, to: 4, count: 2 }), 'insert_paragraphs', { area: 'header', after_paragraph: 0, paragraphs: [{ text: 'Every page' }] });
    const middle = apply(doc, 'set_page_setup', { section: 2, orientation: 'landscape', own_header_footer: true });
    const overview = runTool(middle, 'get_overview').text;
    expect(overview).toMatch(/1\. Paragraphs 1 to \d+: 21\.59 × 27\.94 cm.*shows the document's header/);
    expect(overview).toMatch(/2\. Paragraphs \d+ to \d+: 27\.94 × 21\.59 cm.*header "Every page", footer empty of its own/);
    expect(overview).toMatch(/3\. Paragraphs .*its header and footer are the document's/);
    // Its own header is written with "area_section"; the document's stays as it was.
    const written = apply(middle, 'replace_text', { area: 'header', area_section: 2, find: 'Every page', replace: 'Landscape pages' });
    expect(runTool(written, 'read_document', { area: 'header', area_section: 2 }).text).toContain('Landscape pages');
    expect(runTool(written, 'read_document', { area: 'header' }).text).toContain('Every page');
    expect(error(doc, 'read_document', { area: 'header', area_section: 1 })).toContain("shows the document's header");
    expect(error(doc, 'set_page_setup', { section: 3, own_header_footer: true })).toContain('is the last');
    expect(error(doc, 'set_page_setup', { section: 9, paper: 'a4' })).toContain('from 1 to 3');
    // Without "section", every section's page changes.
    const a4 = apply(written, 'set_page_setup', { paper: 'a4' });
    expect(runTool(a4, 'get_overview').text.match(/21 × 29\.7 cm|29\.7 × 21 cm/g)).toHaveLength(3);
  });

  it('sets the height of a row, its heading rows, and the place and lines of its cells', () => {
    const doc = insertTable(createDoc([p('Antes')]), { para: 0, offset: 5 }, 2, 2).doc;
    const cell = doc.paragraphs.findIndex((x) => x.cell) + 1;
    expect(apply(doc, 'edit_table', { paragraph: cell, action: 'set_row_height', height_cm: 2, exact: true }).tables![0].rows[0]).toMatchObject({ exact: true });
    expect(apply(doc, 'edit_table', { paragraph: cell, action: 'header_row_on' }).tables![0].rows[0].header).toBe(true);
    expect(apply(doc, 'edit_table', { paragraph: cell, action: 'align_cells_center', to_paragraph: cell + 3 }).tables![0].rows[1].cells[1].valign).toBe('center');
    const lined = apply(doc, 'edit_table', { paragraph: cell, action: 'cell_lines', line_style: 'dashed', line_width_pt: 1, line_color: 'C0392B' });
    expect(lined.tables![0].rows[0].cells[0].lines?.top).toEqual({ width: 1, color: 'C0392B', style: 'dashed' });
    expect(texts(apply(doc, 'edit_table', { paragraph: cell, action: 'delete_table' }))).toEqual(['Antes', '']);
  });
});
