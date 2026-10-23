import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type Paragraph,
  ANCHOR_CHAR,
  autoformat,
  createDoc,
  docText,
  exportDocx,
  fillVariables,
  findAllVariables,
  findVariables,
  formatText,
  formatValue,
  setVariableFormat,
  trackDocEdit,
  decideAllRevisions,
  paragraphText,
  variableFormats,
  variableProblems,
  variableUses,
  importDocx,
  insertText,
  isVariableName,
  listKindAt,
  moveSection,
  outline,
  resolveRun,
  sectionAt,
  sectionEnd,
  setParagraphStyle,
  styleIdAt,
  variableNames,
} from '../src/internal';

const p = (text: string, props = {}): Paragraph => ({ props: {}, runs: [{ text, props }] });

describe('templates', () => {
  const template = (): Doc => ({
    ...createDoc([
      {
        props: {},
        runs: [
          { text: 'Entre {{cliente}} y ', props: {} },
          { text: '{{ empresa }}', props: { bold: true } },
          { text: ', por {{importe}}.', props: {} },
        ],
      },
      {
        props: {},
        runs: [
          { text: 'Firma: {{cli', props: {} },
          { text: ANCHOR_CHAR, props: { object: '<w:bookmarkStart/>', anchor: true } },
          { text: 'ente}} {no} {{}} {{a b.c-d_1}}', props: {} },
        ],
      },
    ]),
    footer: { paragraphs: [p('Contrato de {{cliente}} · {{fecha}}')] },
  });

  it('finds the variables of a document, each name once', () => {
    const doc = template();
    expect(findVariables(doc).map((v) => [v.name, v.range.from.para, v.range.from.offset, v.range.to.offset])).toEqual([
      ['cliente', 0, 6, 17],
      ['empresa', 0, 20, 33],
      ['importe', 0, 39, 50],
      ['cliente', 1, 7, 19],
      ['a b.c-d_1', 1, 30, 43],
    ]);
    expect(variableNames(doc)).toEqual(['cliente', 'empresa', 'importe', 'a b.c-d_1', 'fecha']);
    expect(isVariableName('nombre del cliente')).toBe(true);
    expect(isVariableName('')).toBe(false);
    expect(isVariableName('a}b')).toBe(false);
  });

  it('fills them in, in the formatting they had, leaving the ones without a value', () => {
    const filled = fillVariables(template(), { cliente: 'Ana Pérez', empresa: 'ACME', fecha: '12/10/2026' });
    expect(docText(filled).split('\n')).toEqual(['Entre Ana Pérez y ACME, por {{importe}}.', 'Firma: Ana Pérez {no} {{}} {{a b.c-d_1}}']);
    expect(filled.footer!.paragraphs[0].runs.map((r) => r.text).join('')).toBe('Contrato de Ana Pérez · 12/10/2026');
    const acme = filled.paragraphs[0].runs.find((r) => r.text === 'ACME')!;
    expect(resolveRun(acme.props).bold).toBe(true);
    // An empty value takes the variable away; nothing to fill gives the same document back.
    expect(docText(fillVariables(template(), { importe: '' })).split('\n')[0]).toBe('Entre {{cliente}} y {{ empresa }}, por .');
    const doc = template();
    expect(fillVariables(doc, { otra: 'x' })).toBe(doc);
  });

  it('fills a template that came from a file, writing only the paragraphs it touched', () => {
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const kept = '<w:p w:rsidR="00AA"><w:r><w:t>Sin variables</w:t></w:r></w:p>';
    // Word often breaks a word across runs: the variable is found all the same.
    const document = `<w:document ${NS}><w:body>${kept}<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Para {{cli</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>ente}}</w:t></w:r></w:p></w:body></w:document>`;
    const doc = importDocx(zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8(document) }));
    expect(variableNames(doc)).toEqual(['cliente']);
    const xml = strFromU8(unzipSync(exportDocx(fillVariables(doc, { cliente: 'Ana' })))['word/document.xml']);
    expect(xml).toContain(kept);
    expect(xml).toContain('<w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Para Ana</w:t></w:r></w:p>');
  });

  it('finds and fills them in every part: the first page, a section of its own, the notes and the text boxes', () => {
    const section = { page: createDoc([p('')]).page, header: { paragraphs: [p('Section {{e}}')] } };
    const doc: Doc = {
      ...createDoc([{ ...p('Body {{a}}'), section }, p('Last')]),
      firstPage: { header: { paragraphs: [p('First {{b}}')] } },
      footnotes: [{ id: '1', paragraphs: [p('Note {{c}}')] }],
      textBoxes: [{ id: '7', paragraphs: [p('Box {{d}} {{a}}')] }],
    };
    expect(variableNames(doc)).toEqual(['a', 'b', 'e', 'c', 'd']);
    expect(variableUses(doc, 'a')).toBe(2);
    const filled = fillVariables(doc, { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' });
    const text = (story?: { paragraphs: Paragraph[] }) => story?.paragraphs.map(paragraphText).join('/');
    expect([text(filled), text(filled.paragraphs[0].section!.header), text(filled.firstPage!.header), text(filled.footnotes![0]), text(filled.textBoxes![0])]).toEqual([
      'Body A/Last',
      'Section E',
      'First B',
      'Note C',
      'Box D A',
    ]);
    expect(variableNames(filled)).toEqual([]);
    expect(findAllVariables(doc).map((use) => [use.name, use.part ?? 'text'])).toEqual([
      ['a', 'text'],
      ['b', 'firstHeader'],
      ['e', 'header@0'],
      ['c', 'footnote:1'],
      ['d', 'textbox:7'],
      ['a', 'textbox:7'],
    ]);
    const marked = setVariableFormat(doc, 'b', 'upper', true, '', 'en');
    expect(text(marked.firstPage!.header)).toBe('First {{b | upper}}');
  });

  it('leaves out what was taken out while changes were tracked, and keeps the mark of what was put in', () => {
    const doc = createDoc([
      {
        props: {},
        runs: [
          { text: 'Dear {{old}} ', props: { revision: 'delete', revisionAuthor: 'Eva' } },
          { text: '{{new}}, {{na', props: { revision: 'insert', revisionAuthor: 'Eva' } },
          { text: 'XX', props: { revision: 'delete', revisionAuthor: 'Eva' } },
          { text: 'me}}', props: { revision: 'insert', revisionAuthor: 'Eva' } },
        ],
      },
    ]);
    expect(variableNames(doc)).toEqual(['new', 'name']);
    const filled = fillVariables(doc, { old: 'X', new: 'Ana', name: 'Pérez' });
    expect(filled.paragraphs[0].runs.map((r) => [r.text, r.props.revision, r.props.revisionAuthor])).toEqual([
      ['Dear {{old}} ', 'delete', 'Eva'],
      ['Ana, Pérez', 'insert', 'Eva'],
    ]);
  });

  it('changes a format while changes are tracked as a change to just what differs', () => {
    const by = { author: 'Ana', date: '2026-10-21T00:00:00Z' };
    let doc: Doc = { ...createDoc([p('Pay {{price}} now')]), trackRevisions: true };
    for (const id of ['currency', 'upper'] as const) doc = trackDocEdit(doc, setVariableFormat(doc, 'price', id, true, '', 'en'), by);
    expect(doc.paragraphs[0].runs.map((r) => [r.text, r.props.revision ?? ''])).toEqual([
      ['Pay {{price', ''],
      [' | currency | upper', 'insert'],
      ['}} now', ''],
    ]);
    expect(paragraphText(decideAllRevisions(doc, false).paragraphs[0])).toBe('Pay {{price}} now');
    // Nothing to change gives the same document back.
    expect(setVariableFormat(doc, 'price', 'bold', false)).toBe(doc);
  });

  it('tracks a filled variable as the variable taken out and its value put in, not word by word around the spaces', () => {
    const by = { author: 'Ana', date: '2026-10-21T00:00:00Z' };
    const doc: Doc = { ...createDoc([p('From {{client | capital}} today')]), trackRevisions: true };
    const tracked = trackDocEdit(doc, fillVariables(doc, { client: 'ana pérez' }), by);
    expect(tracked.paragraphs[0].runs.map((r) => [r.text, r.props.revision ?? ''])).toEqual([
      ['From ', ''],
      ['{{client | capital}}', 'delete'],
      ['Ana Pérez', 'insert'],
      [' today', ''],
    ]);
  });
});

describe('formats of variables', () => {
  const today = new Date(2026, 9, 12);
  const out = (value: string, ...formats: string[]) => formatValue(value, formats, { today, locale: 'es-MX' }).text;

  it('writes dates, numbers and capitals as asked', () => {
    expect(out('2026-10-12', 'fecha')).toBe('12/10/2026');
    expect(out('5/3/26', 'fecha larga')).toBe('5 de marzo de 2026');
    expect(out('12/10/2026', 'Fecha Completa', 'MAYUSCULAS')).toBe('LUNES, 12 DE OCTUBRE DE 2026');
    expect(out('hoy', 'fecha: dd-MMM-aa')).toBe('12-oct-26');
    expect(out('2026-10-12T08:00:00Z', 'fecha: d de MMMM del yyyy')).toBe('12 de octubre del 2026');
    expect(out('1234567.5', 'número')).toBe('1,234,567.5');
    expect(out('$1,234.5', 'moneda')).toBe('$1,234.50');
    expect(out('-0.004', 'moneda')).toBe('$0.00');
    expect(out('-1999.999', 'moneda: 0')).toBe('-$2,000');
    expect(out('1234.5678', 'numero: 2')).toBe('1,234.57');
    expect(out('ana maría DE LA o-pérez', 'nombre propio')).toBe('Ana María De La O-Pérez');
    expect(out('Ñandú', 'mayúsculas')).toBe('ÑANDÚ');
    expect(formatValue('x', ['negrita', 'cursiva']).props).toEqual({ bold: true, italic: true });
  });

  it('leaves the value alone, and says so, when a format cannot be applied', () => {
    expect(formatValue('31/02/2026', ['fecha larga', 'mayúsculas'])).toEqual({ text: '31/02/2026', props: {}, problems: [{ format: 'fecha larga', kind: 'value' }] });
    expect(formatValue('mucho', ['moneda']).problems).toEqual([{ format: 'moneda', kind: 'value' }]);
    expect(formatValue('Ana', ['gritando']).problems).toEqual([{ format: 'gritando', kind: 'format' }]);
  });

  const doc = (): Doc => ({
    ...createDoc([p('A {{ fecha | fecha larga }}, {{cliente|mayúsculas|negrita}} paga {{importe | moneda}} ({{cliente}}).'), p('{{fecha | nada}} {{importe|moneda}}')]),
    header: { paragraphs: [p('{{cliente | mayúsculas | negrita}}')] },
  });

  it('writes values in the language of the document, or in English', () => {
    const template = createDoc([{ props: {}, runs: [{ text: '{{day | long date}} · {{amount | currency}}', props: {} }] }]);
    const said = (language?: string) => docText(fillVariables(language ? importDocx(exportDocx(template, { language })) : template, { day: '2026-10-21', amount: '1234.5' }));
    expect(said('en-US')).toBe('October 21, 2026 · $1,234.50');
    expect(said('es-MX')).toBe('21 de octubre de 2026 · $1,234.50');
    expect(said()).toBe('October 21, 2026 · $1,234.50');
    // One given is the one used.
    expect(docText(fillVariables(importDocx(exportDocx(template, { language: 'en-US' })), { day: '2026-10-21' }, { locale: 'es-MX' }))).toContain('21 de octubre de 2026');
  });

  it('fills each use in its own format', () => {
    const found = findVariables(doc());
    expect(found.map((v) => [v.name, v.formats])).toEqual([
      ['fecha', ['fecha larga']],
      ['cliente', ['mayúsculas', 'negrita']],
      ['importe', ['moneda']],
      ['cliente', []],
      ['fecha', ['nada']],
      ['importe', ['moneda']],
    ]);
    expect(variableNames(doc())).toEqual(['fecha', 'cliente', 'importe']);
    const filled = fillVariables(doc(), { fecha: '2026-10-12', cliente: 'Ana Pérez', importe: '1500' }, { locale: 'es-MX' });
    expect(docText(filled).split('\n')).toEqual(['A 12 de octubre de 2026, ANA PÉREZ paga $1,500.00 (Ana Pérez).', '2026-10-12 $1,500.00']);
    expect(filled.paragraphs[0].runs.filter((r) => resolveRun(r.props).bold).map((r) => r.text)).toEqual(['ANA PÉREZ']);
    expect(resolveRun(filled.header!.paragraphs[0].runs[0].props).bold).toBe(true);
    expect(variableProblems(doc(), { fecha: 'pronto', cliente: 'Ana' }, { locale: 'es-MX' })).toEqual([
      { name: 'fecha', format: 'fecha larga', kind: 'value' },
      { name: 'fecha', format: 'nada', kind: 'format' },
    ]);
  });

  it('gives a format to every use of a variable, and takes it away', () => {
    expect(variableFormats(doc(), 'cliente')).toEqual([]);
    expect(variableFormats(doc(), 'importe')).toEqual([{ id: 'currency', arg: '' }]);
    expect(variableUses(doc(), 'cliente')).toBe(3);
    let next = setVariableFormat(doc(), 'cliente', 'bold', true, '', 'es');
    expect(docText(next).split('\n')[0]).toBe('A {{ fecha | fecha larga }}, {{cliente | mayúsculas | negrita}} paga {{importe | moneda}} ({{cliente | negrita}}).');
    expect(variableFormats(next, 'cliente')).toEqual([{ id: 'bold', arg: '' }]);
    // One way of writing capitals, or a kind of value, takes the place of another; what is not understood is kept.
    next = setVariableFormat(next, 'cliente', 'capital', true, '', 'es');
    expect(next.header!.paragraphs[0].runs[0].text).toBe('{{cliente | negrita | nombre propio}}');
    next = setVariableFormat(next, 'fecha', 'date', true, 'dd.MM.yyyy', 'es');
    expect(docText(next).split('\n')[1]).toBe('{{fecha | nada | fecha: dd.MM.yyyy}} {{importe|moneda}}');
    expect(variableFormats(next, 'fecha')).toEqual([{ id: 'date', arg: 'dd.MM.yyyy' }]);
    next = setVariableFormat(next, 'importe', 'currency', false);
    expect(docText(next).split('\n')[1]).toBe('{{fecha | nada | fecha: dd.MM.yyyy}} {{importe}}');
    expect(setVariableFormat(next, 'otra', 'bold', true)).toBe(next);
    // In English, the formats are written by their English names, and read as well.
    const english = setVariableFormat(setVariableFormat(doc(), 'importe', 'currency', true, '', 'en'), 'fecha', 'dateLong', true, '', 'en-US');
    expect(docText(english).split('\n')[0]).toBe('A {{fecha | long date}}, {{cliente|mayúsculas|negrita}} paga {{importe | currency}} ({{cliente}}).');
    expect(variableFormats(english, 'fecha')).toEqual([{ id: 'dateLong', arg: '' }]);
    expect(formatText('date', 'dd/MM/yyyy', 'en')).toBe('date: dd/MM/yyyy');
    expect(formatText('date', 'dd/MM/yyyy', 'es-MX')).toBe('fecha: dd/MM/yyyy');
    expect(formatText('date', 'dd/MM/yyyy')).toBe('date: dd/MM/yyyy');
    // Without a language, the document's.
    const spanish = importDocx(exportDocx(createDoc([p('{{fecha}}')]), { language: 'es-MX' }));
    expect(docText(setVariableFormat(spanish, 'fecha', 'dateLong', true))).toBe('{{fecha | fecha larga}}');
    expect(docText(setVariableFormat(createDoc([p('{{fecha}}')]), 'fecha', 'dateLong', true))).toBe('{{fecha | long date}}');
  });
});

describe('formats of variables in another language', () => {
  const today = new Date(2026, 9, 12);
  const out = (value: string, locale: string, ...formats: string[]) => formatValue(value, formats, { today, locale }).text;

  it('writes days, numbers and currencies as the language does', () => {
    expect(out('2026-10-12', 'en-US', 'long date')).toBe('October 12, 2026');
    expect(out('2026-10-12', 'en-US', 'full date')).toBe('Monday, October 12, 2026');
    expect(out('2026-10-12', 'en-US', 'date')).toBe('10/12/2026');
    expect(out('2026-10-12', 'en-GB', 'date')).toBe('12/10/2026');
    // A day written with its digits is read in the order of the language.
    expect(out('10/12/2026', 'en-US', 'long date')).toBe('October 12, 2026');
    expect(out('today', 'de-DE', 'fecha: d. MMMM yyyy')).toBe('12. Oktober 2026');
    expect(out('1234567.5', 'de-DE', 'number')).toBe('1.234.567,5');
    expect(out('1234.5', 'en-US', 'currency')).toBe('$1,234.50');
    expect(out('1234.5', 'de-DE', 'currency: EUR').replace(/\s/g, ' ')).toBe('1.234,50 €');
    expect(formatValue('1234.5', ['moneda'], { locale: 'es-MX', currency: 'MXN' }).text).toBe('$1,234.50');
    expect(out('istanbul', 'tr-TR', 'uppercase')).toBe('İSTANBUL');
    // Without a language, in English.
    expect(formatValue('2026-10-12', ['fecha larga']).text).toBe('October 12, 2026');
    expect(formatValue('2026-10-12', ['date']).text).toBe('10/12/2026');
    expect(formatValue('1234.5', ['moneda']).text).toBe('$1,234.50');
    expect(formatValue('1234.5', ['moneda: EUR']).problems).toEqual([]);
  });
});

describe('formatting while typing', () => {
  /** Types `text` at the end of an empty paragraph, a character at a time, as the editor does. */
  const typed = (text: string, doc = createDoc([p('')])) => {
    let pos = { para: 0, offset: 0 };
    let last: ReturnType<typeof autoformat>;
    for (const ch of text) {
      ({ doc, pos } = insertText(doc, pos, ch));
      last = autoformat(doc, pos, ch);
      if (last) ({ doc, pos } = last);
    }
    return { doc, pos, formatted: !!last! };
  };

  it('starts headings and lists', () => {
    const h2 = typed('## ');
    expect(styleIdAt(h2.doc, 0)).toBe('Heading2');
    expect(docText(h2.doc)).toBe('');
    expect(h2.pos).toEqual({ para: 0, offset: 0 });
    expect(styleIdAt(typed('# ').doc, 0)).toBe('Heading1');
    expect(listKindAt(typed('- ').doc, 0)).toBe('bullet');
    expect(listKindAt(typed('* ').doc, 0)).toBe('bullet');
    expect(listKindAt(typed('1. ').doc, 0)).toBe('number');
    // Not at the start of the paragraph, or more marks than there are headings: just text.
    expect(docText(typed('a # ').doc)).toBe('a # ');
    expect(docText(typed('#### ').doc)).toBe('#### ');
    expect(docText(typed('#hola').doc)).toBe('#hola');
  });

  it('turns marked text into bold, italic and strike-through', () => {
    const bold = typed('una **palabra clave**');
    expect(docText(bold.doc)).toBe('una palabra clave');
    expect(bold.doc.paragraphs[0].runs.map((r) => [r.text, !!r.props.bold])).toEqual([
      ['una ', false],
      ['palabra clave', true],
    ]);
    expect(bold.pos).toEqual({ para: 0, offset: 17 });
    expect(typed('es *así*').doc.paragraphs[0].runs.map((r) => [r.text, !!r.props.italic])).toEqual([
      ['es ', false],
      ['así', true],
    ]);
    expect(typed('~~no~~').doc.paragraphs[0].runs.map((r) => [r.text, !!r.props.strike])).toEqual([['no', true]]);
    // Marks with nothing between them, or with space against them, are left alone.
    expect(docText(typed('2 * 3 * 4').doc)).toBe('2 * 3 * 4');
    expect(docText(typed('****').doc)).toBe('****');
    expect(docText(typed('** no**').doc)).toBe('** no**');
  });
});

describe('outline', () => {
  const doc = () => {
    let d = createDoc(['Informe', 'Intro', 'texto 1', 'Detalle', 'texto 2', 'Método', 'texto 3', 'Fin', 'texto 4'].map((t) => p(t)));
    d = setParagraphStyle(d, 0, 0, 'Title');
    for (const [i, id] of [
      [1, 'Heading1'],
      [3, 'Heading2'],
      [5, 'Heading1'],
      [7, 'Heading1'],
    ] as const)
      d = setParagraphStyle(d, i, i, id);
    return d;
  };

  it('lists the titles and headings, and knows where each section ends', () => {
    const d = doc();
    expect(outline(d).map((i) => `${i.level} ${i.text} @${i.para}`)).toEqual(['0 Informe @0', '1 Intro @1', '2 Detalle @3', '1 Método @5', '1 Fin @7']);
    expect([1, 3, 5, 7, 0].map((para) => sectionEnd(d, para))).toEqual([5, 5, 7, 9, 9]);
    expect([0, 2, 4, 6, 8].map((para) => sectionAt(d, para))).toEqual([0, 1, 2, 3, 4]);
  });

  it('moves a section with everything under it', () => {
    const d = doc();
    const down = moveSection(d, 1, 7);
    expect(docText(down.doc).split('\n')).toEqual(['Informe', 'Método', 'texto 3', 'Intro', 'texto 1', 'Detalle', 'texto 2', 'Fin', 'texto 4']);
    expect(down.para).toBe(3);
    expect(
      docText(moveSection(d, 5, 1).doc)
        .split('\n')
        .slice(0, 4),
    ).toEqual(['Informe', 'Método', 'texto 3', 'Intro']);
    expect(docText(moveSection(d, 3).doc).split('\n').slice(-3)).toEqual(['texto 4', 'Detalle', 'texto 2']);
    // Onto itself or inside itself: nothing moves.
    expect(moveSection(d, 1, 3).doc).toBe(d);
    expect(moveSection(d, 1, 5).doc).toBe(d);
  });

  it('writes the blocks of a file in their new order, each as it was', () => {
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const styles = `<w:styles ${NS}><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="H1"><w:name w:val="heading 1"/></w:style></w:styles>`;
    const h = (text: string) => `<w:p w:rsidR="00AA"><w:pPr><w:pStyle w:val="H1"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
    const t = (text: string) => `<w:p><w:r><w:rPr><w:lang w:val="es-MX"/></w:rPr><w:t>${text}</w:t></w:r></w:p>`;
    const table = '<w:tbl><w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:t>celda</w:t></w:r></w:p></w:tc></w:tr></w:tbl>';
    const sect = '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>';
    const blocks = [h('Uno'), t('a'), table, h('Dos'), '<w:bookmarkStart w:id="1" w:name="m"/>' + t('b'), h('Tres'), t('c')];
    const document = `<w:document ${NS}><w:body>${blocks.join('')}${sect}</w:body></w:document>`;
    const open = () => importDocx(zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8(document), 'word/styles.xml': strToU8(styles) }));
    const body = (d: Doc) => strFromU8(unzipSync(exportDocx(d))['word/document.xml']);
    const d = open();
    expect(outline(d).map((i) => i.text)).toEqual(['Uno', 'Dos', 'Tres']);
    expect(body(d)).toBe(document);
    // "Uno", with its text and its table, goes to the end; the section properties stay last.
    const moved = moveSection(d, 0).doc;
    const [uno, a, tbl, dos, b, tres, c] = blocks;
    expect(body(moved)).toBe(`<w:document ${NS}><w:body>${dos}${b}${tres}${c}${uno}${a}${tbl}${sect}</w:body></w:document>`);
    expect(docText(importDocx(exportDocx(moved))).split('\n')).toEqual(['Dos', 'b', 'Tres', 'c', 'Uno', 'a', 'celda']);
  });
});
