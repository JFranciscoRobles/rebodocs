import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Doc, type Paragraph, createDoc, exportDocx, importDocx, plainText, resolveParagraph, revisionsOf, setParagraphStyle } from '@rebodocs/core/internal';
import { CASES } from '../../../tools/assistant-eval/cases';
import { fontsFor } from '../src/fonts';
import { createDocServer } from '../src/server';
import { _ordinals } from '../src/tools/clauses';
import { ToolError, runTool } from '../src/tools';

const FONTS = fontsFor(createDoc()).length > 0;
const p = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });
const texts = (doc: Doc) => doc.paragraphs.map((para) => plainText(para.runs).replace(/⁠/g, ''));
const headed = (items: string[], heads: number[]) => heads.reduce((doc, i) => setParagraphStyle(doc, i, i, 'Heading1'), createDoc(items.map(p)));
const apply = (doc: Doc, name: string, args: Record<string, unknown>) => {
  const result = runTool(doc, name, args, { now: new Date('2026-10-22T12:00:00Z') });
  expect(result.doc, result.text).toBeDefined();
  return { ...result, doc: result.doc! };
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

describe('ordinals in Spanish', () => {
  const { parseOrdinal, ordinalWords, toRoman, fromRoman, caseLike } = _ordinals;
  it('reads them in every way they are written', () => {
    expect(parseOrdinal('Primera')).toEqual({ value: 1, feminine: true });
    expect(parseOrdinal('Primero')).toEqual({ value: 1, feminine: false });
    expect(parseOrdinal('Décima Primera')?.value).toBe(11);
    expect(parseOrdinal('DÉCIMA SEGUNDA')?.value).toBe(12);
    expect(parseOrdinal('Undécima')?.value).toBe(11);
    expect(parseOrdinal('decimotercera')?.value).toBe(13);
    expect(parseOrdinal('Vigésima Quinta')?.value).toBe(25);
    expect(parseOrdinal('Séptima')?.value).toBe(7);
    expect(parseOrdinal('Objeto')).toBeUndefined();
    expect(parseOrdinal('Primera Décima')).toBeUndefined();
  });
  it('writes them, with the capitals of the one they replace', () => {
    expect(ordinalWords(4, true, false)).toBe('cuarta');
    expect(ordinalWords(11, true, false)).toBe('décima primera');
    expect(ordinalWords(11, true, true)).toBe('undécima');
    expect(ordinalWords(23, false, false)).toBe('vigésimo tercero');
    expect(caseLike('CUARTA', 'quinta')).toBe('QUINTA');
    expect(caseLike('Décima Primera', 'décima segunda')).toBe('Décima Segunda');
    expect(caseLike('Novena', 'décima primera')).toBe('Décima primera');
    expect(toRoman(14)).toBe('XIV');
    expect(fromRoman('XIV')).toBe(14);
    expect(fromRoman('IIII')).toBeUndefined();
  });
});

describe('renumbering clauses', () => {
  it('puts the numbers in order after a clause was put in, and says where the text names one', () => {
    const doc = headed(
      [
        'CONTRATO',
        'Primera. Objeto',
        'Texto.',
        'Segunda. Plazo',
        'Según la cláusula Tercera, se paga.',
        'Tercera. Confidencialidad',
        'Nueva.',
        'Tercera. Renta',
        'Texto.',
        'Cuarta. Jurisdicción',
        'Texto.',
      ],
      [1, 3, 5, 7, 9],
    );
    const { doc: after, text } = apply(doc, 'renumber_clauses', {});
    expect(texts(after).filter((_, i) => [1, 3, 5, 7, 9].includes(i))).toEqual(['Primera. Objeto', 'Segunda. Plazo', 'Tercera. Confidencialidad', 'Cuarta. Renta', 'Quinta. Jurisdicción']);
    expect(text).toContain('Paragraph 8: Tercera → Cuarta');
    expect(text).toContain('Paragraph 5 says "cláusula Tercera"');
    // Done again, nothing is left to do.
    expect(runTool(after, 'renumber_clauses', {}).doc).toBeUndefined();
  });

  it('keeps how each is written: capitals, a word before it, digits, Roman numerals', () => {
    const caps = headed(['CLÁUSULA PRIMERA. OBJETO', 'x', 'CLÁUSULA TERCERA. PRECIO', 'x', 'CLÁUSULA CUARTA. FIN', 'x'], [0, 2, 4]);
    expect(texts(apply(caps, 'renumber_clauses', {}).doc!).filter((_, i) => i % 2 === 0)).toEqual(['CLÁUSULA PRIMERA. OBJETO', 'CLÁUSULA SEGUNDA. PRECIO', 'CLÁUSULA TERCERA. FIN']);
    const digits = headed(['Cláusula 1. Objeto', 'x', 'Cláusula 2. Precio', 'x', 'Cláusula 2. Fin', 'x'], [0, 2, 4]);
    expect(texts(apply(digits, 'renumber_clauses', {}).doc!)[4]).toBe('Cláusula 3. Fin');
    const roman = headed(['I. Objeto', 'x', 'III. Precio', 'x'], [0, 2]);
    expect(texts(apply(roman, 'renumber_clauses', {}).doc!)[2]).toBe('II. Precio');
    const eleven = headed(
      [...Array.from({ length: 10 }, (_, i) => `${_ordinals.caseLike('Primera', _ordinals.ordinalWords(i + 1, true, false))}. Tema`), 'Undécima. Otro', 'Undécima. Último'],
      [...Array(12).keys()],
    );
    expect(texts(apply(eleven, 'renumber_clauses', {}).doc!)[11]).toBe('Duodécima. Último');
  });

  it('starts where asked, and picks the series of a paragraph', () => {
    const doc = headed(['Primera. A', 'Segunda. B', 'Cláusula 1. C', 'Cláusula 5. D', 'Cláusula 6. E'], [0, 1, 2, 3, 4]);
    const { doc: after } = apply(doc, 'renumber_clauses', { paragraph: 3, start: 1 });
    expect(texts(after)).toEqual(['Primera. A', 'Segunda. B', 'Cláusula 1. C', 'Cláusula 2. D', 'Cláusula 3. E']);
    expect(error(createDoc([p('Hola'), p('Adiós')]), 'renumber_clauses', {})).toContain('No headings were found');
  });

  it('is tracked while changes are', () => {
    const doc = { ...headed(['Primera. A', 'x', 'Tercera. B', 'x'], [0, 2]), trackRevisions: true };
    expect(revisionsOf(apply(doc, 'renumber_clauses', {}).doc!).length).toBeGreaterThan(0);
  });
});

describe('moving a section', () => {
  const doc = () => headed(['Primera. Objeto', 'Texto de objeto.', 'Segunda. Plazo', 'Texto de plazo.', 'Más del plazo.', 'Tercera. Renta', 'Texto de renta.'], [0, 2, 5]);

  it('moves a heading with what is under it, and the numbers can be put in order after', () => {
    const { doc: after, text } = apply(doc(), 'move_section', { paragraph: 6, before: 3 });
    expect(texts(after)).toEqual(['Primera. Objeto', 'Texto de objeto.', 'Tercera. Renta', 'Texto de renta.', 'Segunda. Plazo', 'Texto de plazo.', 'Más del plazo.']);
    expect(text).toContain('now paragraphs 3 to 4');
    const renumbered = apply(after, 'renumber_clauses', {}).doc!;
    expect(texts(renumbered)[2]).toBe('Segunda. Renta');
    expect(texts(renumbered)[4]).toBe('Tercera. Plazo');
    // To the end, when no place is given.
    expect(texts(apply(doc(), 'move_section', { paragraph: 1 }).doc!).slice(-2)).toEqual(['Primera. Objeto', 'Texto de objeto.']);
  });

  it('says what it cannot do', () => {
    expect(error(doc(), 'move_section', { paragraph: 2 })).toContain('is not a heading');
    expect(error(doc(), 'move_section', { paragraph: 3, before: 4 })).toContain('inside the section itself');
  });

  it('goes in a batch, with the numbers of one reading', () => {
    const { doc: after } = apply(doc(), 'edit_document', {
      edits: [
        { tool: 'move_section', paragraph: 6, before: 1 },
        { tool: 'rewrite_paragraph', paragraph: 2, text: 'Objeto, de nuevo.' },
      ],
    });
    expect(texts(after)).toEqual(['Tercera. Renta', 'Texto de renta.', 'Primera. Objeto', 'Objeto, de nuevo.', 'Segunda. Plazo', 'Texto de plazo.', 'Más del plazo.']);
  });
});

describe('writing in a cell', () => {
  const table = () =>
    runTool(createDoc([p('Costos'), p('Fin.')]), 'insert_table', {
      after_paragraph: 1,
      rows: [
        ['Concepto', 'Monto'],
        ['Renta', '$18,500'],
      ],
    }).doc!;

  it('writes an empty cell of a new row, and one with text, by where it is', () => {
    let doc = apply(table(), 'edit_table', { paragraph: 4, action: 'insert_row_below' }).doc!;
    doc = apply(doc, 'set_cell_text', { table: 1, row: 3, cell: 1, text: 'Mantenimiento' }).doc!;
    doc = apply(doc, 'set_cell_text', { table: 1, row: 3, cell: 2, text: '$1,200' }).doc!;
    doc = apply(doc, 'set_cell_text', { table: 1, row: 2, cell: 2, text: '$19,000\nal mes' }).doc!;
    const read = runTool(doc, 'read_document').text;
    expect(read).toContain('(table 1, row 3, cell 1) Mantenimiento');
    expect(read).toContain('(table 1, row 3, cell 2) $1,200');
    expect(read).toContain('(table 1, row 2, cell 2) $19,000');
    expect(read).toContain('(table 1, row 2, cell 2) al mes');
    // Written again with one line, the cell has one paragraph again.
    const once = apply(doc, 'set_cell_text', { table: 1, row: 2, cell: 2, text: '$20,000' }).doc!;
    expect(runTool(once, 'read_document').text).not.toContain('al mes');
  });

  it('says where there is no such cell', () => {
    expect(error(table(), 'set_cell_text', { table: 2, row: 1, cell: 1, text: 'x' })).toContain('There is no table 2');
    expect(error(table(), 'set_cell_text', { table: 1, row: 9, cell: 1, text: 'x' })).toContain('has 2 rows');
    expect(error(table(), 'set_cell_text', { table: 1, row: 1, cell: 5, text: 'x' })).toContain('has 2 cells');
    expect(error(createDoc([p('a')]), 'set_cell_text', { table: 1, row: 1, cell: 1, text: 'x' })).toContain('no tables');
  });
});

describe('keeping things together on a page', () => {
  it('keeps the lines of a paragraph together', () => {
    const { doc } = apply(createDoc([p('a'), p('b')]), 'format_paragraphs', { from: 1, keep_lines_together: true });
    expect(resolveParagraph(doc!.paragraphs[0].props).keepLines).toBe(true);
    expect(runTool(doc!, 'read_formatting', { from: 1, to: 1 }).text).toContain('lines kept together');
  });

  it('keeps a table on one page, and lets it split again', () => {
    const doc = runTool(createDoc([p('a')]), 'insert_signatures', { after_paragraph: 1, titles: ['A', 'B'] }).doc!;
    const cell = doc.paragraphs.findIndex((para) => para.cell) + 1;
    const kept = apply(doc, 'edit_table', { paragraph: cell, action: 'keep_together' }).doc!;
    const table = kept.tables![0];
    expect(table.rows.every((row) => row.cantSplit)).toBe(true);
    const inRows = kept.paragraphs.filter((para) => para.cell);
    const last = table.rows[table.rows.length - 1].id;
    expect(inRows.filter((para) => para.cell!.row !== last).every((para) => para.props.keepNext)).toBe(true);
    expect(inRows.filter((para) => para.cell!.row === last).some((para) => para.props.keepNext)).toBe(false);
    const free = apply(kept, 'edit_table', { paragraph: cell, action: 'allow_split' }).doc!;
    expect(free.tables![0].rows.some((row) => row.cantSplit)).toBe(false);
    expect(free.paragraphs.filter((para) => para.cell).some((para) => para.props.keepNext)).toBe(false);
  });
});

describe('signatures kept on one page, as the layout lays them out', () => {
  it.skipIf(!FONTS)('mends the case of the evaluation without a page break, and the file keeps it', () => {
    const c = CASES.find((one) => one.id === 'signatures-on-one-page')!;
    const before = c.doc();
    const cell = before.paragraphs.findIndex((para) => para.cell) + 1;
    let doc = apply(before, 'edit_table', { paragraph: cell, action: 'keep_together' }).doc;
    // The line that introduces them goes with them.
    doc = apply(doc, 'format_paragraphs', { from: cell - 1, keep_with_next: true }).doc;
    expect(c.check(doc, before, 'Hecho.')).toEqual({ pass: true });
    const saved = importDocx(exportDocx(doc));
    expect(saved.tables![0].rows.every((row) => row.cantSplit)).toBe(true);
    expect(c.check(saved, importDocx(exportDocx(before)), 'Hecho.')).toEqual({ pass: true });
  });
});

describe('undoing changes to a file', () => {
  it('goes back one change or several, and says when there is nothing to undo', async () => {
    const server = createDocServer();
    let id = 0;
    const call = async (name: string, args: object = {}) => {
      const answer = (await server.handle({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } })) as { result: { content: { text: string }[]; isError?: boolean } };
      return { text: answer.result.content[0].text, failed: !!answer.result.isError };
    };
    await call('new_document', { path: join(tmpdir(), `rebodocs-undo-${Date.now()}.docx`) });
    expect((await call('undo')).text).toContain('nothing to undo');
    await call('insert_paragraphs', { after_paragraph: 0, paragraphs: [{ text: 'Uno' }] });
    await call('insert_paragraphs', { after_paragraph: 1, paragraphs: [{ text: 'Dos' }] });
    await call('insert_paragraphs', { after_paragraph: 2, paragraphs: [{ text: 'Tres' }] });
    // A tool that changes nothing is not a step.
    await call('read_document');
    expect((await call('undo')).text).toBe('Undid 1 change. 2 more can be undone.');
    expect((await call('read_document')).text).not.toContain('Tres');
    expect((await call('undo', { steps: 5 })).text).toContain('Undid 2 changes (there were only 2). 0 more can be undone. The document is as it was last saved.');
    expect((await call('undo', { document: 'editor' })).failed).toBe(true);
  });
});
