import { describe, expect, it } from 'vitest';
import { type Doc, type Paragraph, columnsAt, createDoc, exportDocx, importDocx, insertTable, linkHref, plainText, setParagraphStyle, tocRange } from '@rebodocs/core';
import { TOOLS, ToolError, runTool } from '../src/tools';

const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });

function base(): Doc {
  const doc = createDoc([p('Contrato de servicios'), p('Objeto'), p('El cliente {{cliente | mayúsculas}} contrata el servicio.'), p('Precio'), p('El precio es de {{importe | moneda}}, a pagar el {{fecha | fecha larga}}.'), p('El cliente acepta.')]);
  return [[0, 'Title'], [1, 'Heading1'], [3, 'Heading1']].reduce((now, [para, style]) => setParagraphStyle(now, para as number, para as number, style as string), doc);
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
    const doc = apply(base(), 'insert_paragraphs', { after_paragraph: 5, paragraphs: [{ text: 'Vigencia', style: 'heading 2' }, { text: 'Un año.' }, { text: 'Prorrogable', list: 'bullet' }, { text: 'Revisable', list: 'bullet' }] });
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
    const result = runTool(base(), 'fill_variables', { values: { cliente: 'ana pérez', importe: 1500, fecha: '2026-10-12', otra: 'x' } }, {});
    expect(texts(result.doc!).slice(2, 5)).toEqual(['El cliente ANA PÉREZ contrata el servicio.', 'Precio', 'El precio es de $1,500.00, a pagar el 12 de octubre de 2026.']);
    expect(result.text).toBe('Filled 3 of 3 variables.\nNot variables of this document: otra.');
    const partial = runTool(base(), 'fill_variables', { values: { cliente: 'Ana', fecha: 'mañana' } });
    expect(partial.text).toContain('Filled 2 of 3 variables.\nStill without a value: importe.');
    expect(partial.text).toContain('"mañana", is not one "fecha larga" can write');
  });

  it('puts in a table, signatures, a page break and a table of contents', () => {
    let doc = apply(base(), 'insert_table', { after_paragraph: 5, rows: [['Concepto', 'Importe'], ['Servicio', '$1,500.00']] });
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
    expect(runTool(numbered, 'read_document', { area: 'footer' }).text).toMatch(/^\[1\] Página \d+ de \d+$/);
    expect(runTool(apply(numbered, 'set_page_number', { place: 'header', align: 'right' }), 'read_document', { area: 'header' }).text).toMatch(/Contrato · \{\{cliente\}\}/);
    expect(runTool(apply(numbered, 'set_page_number', { place: 'none' }), 'read_document', { area: 'footer' }).text).not.toMatch(/Página/);
    const back = importDocx(exportDocx(numbered));
    expect(runTool(back, 'read_document', { area: 'header' }).text).toBe('[1] Contrato · {{cliente}}');
  });

  it('changes the shape of a table', () => {
    const table = (doc: Doc) => runTool(doc, 'read_document', { from: 7 }).text.split('\n').filter((row) => row.includes('table 1')).map((row) => row.replace(/^\[\d+\] \(table 1, row (\d+), cell (\d+)\) ?/, '$1.$2 '));
    let doc = apply(base(), 'insert_table', { after_paragraph: 6, rows: [['a', 'b'], ['c', 'd']] });
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
    expect(added.paragraphs[3].runs.map((run) => [run.text, !!run.props.italic])).toEqual([['And ', false], ['this', true]]);
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
