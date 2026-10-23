// The checks of the assistant's evaluation (tools/assistant-eval), checked
// themselves: each passes the document a right answer leaves, and fails the
// one a Claude that does nothing leaves. A check that passes nothing, or
// anything, would make a run of the evaluation measure the check.

import { describe, expect, it } from 'vitest';
import { type Doc, createDoc, paragraphText } from '@rebodocs/core/internal';
import { CASES } from '../../../tools/assistant-eval/cases';
import { fontsFor } from '../src/fonts';
import { runTool } from '../src/tools';

type Step = [string, Record<string, unknown>];
/** The number, from 1, of the paragraph that reads `text`. */
const numberOf = (doc: Doc, text: string) => doc.paragraphs.findIndex((para) => paragraphText(para) === text) + 1;
/** Whether this machine has fonts to lay a document out: the cases that check the pages need them. */
const FONTS = fontsFor(createDoc()).length > 0;

/** What a right answer does to each document, by hand. */
const REFERENCE: Record<string, Step[] | ((doc: Doc) => Step[])> = {
  'fill-template': [['fill_variables', { values: { cliente: 'Mariana Quintero Solís', importe: 25000, inmueble: 'Torre Alcatraz depto 1204', fecha: '2026-11-03', asesor: 'Rodrigo Ibarra' } }]],
  'clause-after-third': [
    ['insert_paragraphs', { after_paragraph: 7, paragraphs: [{ text: 'Cuarta. Confidencialidad', style: 'Heading1' }, { text: 'Las partes guardarán confidencialidad sobre este contrato.' }] }],
    ['renumber_clauses', {}],
  ],
  'remove-clause': [['delete_paragraphs', { from: 8, to: 9 }]],
  'replace-everywhere': [
    ['replace_text', { find: 'arrendatario', replace: 'inquilino', all: true }],
    ['replace_text', { find: 'arrendador', replace: 'propietario', all: true }],
  ],
  'tracked-change': [
    ['track_changes', { on: true }],
    ['replace_text', { find: '12 meses', replace: '24 meses' }],
  ],
  'bold-name': [['format_text', { find: 'Calle Ficticia 123', bold: true }]],
  'translate-keep-bold': [
    [
      'rewrite_paragraph',
      { paragraph: 2, segments: [{ text: 'Your personal data will be handled ' }, { text: 'confidentially', bold: true }, { text: ' and will not be shared with third parties.' }] },
    ],
  ],
  'lines-to-table': [
    ['delete_paragraphs', { from: 2, to: 5 }],
    [
      'insert_table',
      {
        after_paragraph: 1,
        rows: [
          ['Recámaras', '3'],
          ['Baños', '2.5'],
          ['Estacionamientos', '2'],
          ['Superficie', '145 m²'],
        ],
      },
    ],
  ],
  'heading-style': [
    ['set_style', { from: 2, style: 'Heading2' }],
    ['set_style', { from: 4, style: 'Heading2' }],
    ['set_style', { from: 6, style: 'Heading2' }],
    ['set_style', { from: 8, style: 'Heading2' }],
    ['set_style', { from: 10, style: 'Heading2' }],
  ],
  'review-only': [['add_note', { find: 'tribunales de la ciudad', note: '¿Qué ciudad?' }]],
  'question-only': [],
  'no-such-clause': [],
  'long-document': [['replace_text', { paragraph: 75, find: '15 días naturales', replace: '30 días hábiles' }]],
  'many-changes': [
    [
      'edit_document',
      {
        edits: [
          { tool: 'replace_text', find: '$18,500.00', replace: '$21,000.00' },
          { tool: 'replace_text', find: '12 meses', replace: '18 meses' },
          { tool: 'delete_paragraphs', from: 8, to: 9 },
          { tool: 'insert_paragraphs', after_paragraph: 7, paragraphs: [{ text: 'Cuarta. Mantenimiento', style: 'Heading1' }, { text: 'El arrendatario pagará el mantenimiento del condominio.' }] },
          { tool: 'replace_text', find: 'Calle Ficticia 123, Colonia Inventada', replace: 'Avenida Real 456, Colonia Centro' },
        ],
      },
    ],
  ],
  'header-footer': [
    ['replace_text', { area: 'header', find: 'Inmobiliaria Ejemplo — Contrato', replace: 'Inmobiliaria Quintana · Contrato 2026' }],
    ['insert_paragraphs', { area: 'footer', after_paragraph: 1, paragraphs: [{ text: 'Documento confidencial' }] }],
  ],
  'numbered-list': [['insert_paragraphs', { after_paragraph: 3, like_paragraph: 3, paragraphs: [{ text: 'Pagar el predial' }] }]],
  'decide-changes': [
    ['accept_changes', { author: 'Laura Méndez' }],
    ['reject_changes', { author: 'Pedro Ruiz' }],
  ],
  'table-rows': (doc) => {
    const parking = numberOf(doc, 'Estacionamiento');
    return [
      ['edit_table', { paragraph: parking, action: 'delete_row' }],
      // The row of Agua takes its place; the new one goes under it, its two cells empty.
      ['edit_table', { paragraph: parking, action: 'insert_row_below' }],
      ['insert_paragraphs', { after_paragraph: parking + 2, paragraphs: [{ text: 'Mantenimiento' }] }],
      ['insert_paragraphs', { after_paragraph: parking + 4, paragraphs: [{ text: '$1,200' }] }],
    ];
  },
  'signatures-on-one-page': (doc) => [
    ['edit_table', { paragraph: numberOf(doc, 'En constancia, las partes firman este contrato.') + 1, action: 'keep_together' }],
    ['format_paragraphs', { from: numberOf(doc, 'En constancia, las partes firman este contrato.'), keep_with_next: true }],
  ],
};
/** What a right answer says, where the check reads it. */
const SAID: Record<string, string> = { 'question-only': 'La renta es de $18,500.00 al mes, los primeros cinco días.', 'no-such-clause': 'El contrato no tiene una cláusula de depósito.' };

describe('the checks of the evaluation', () => {
  it('has a right answer for every case', () => {
    expect(Object.keys(REFERENCE).sort()).toEqual(CASES.map((c) => c.id).sort());
  });

  for (const c of CASES) {
    it.skipIf(c.needsFonts && !FONTS)(`${c.id}: passes a right answer, and fails doing nothing`, () => {
      const before = c.doc();
      let doc = before;
      const steps = REFERENCE[c.id];
      for (const [tool, args] of typeof steps === 'function' ? steps(before) : steps) doc = runTool(doc, tool, args, { now: new Date('2026-10-22T12:00:00Z') }).doc ?? doc;
      expect(c.check(doc, before, SAID[c.id] ?? 'Hecho.')).toEqual({ pass: true });
      expect(c.check(before, before, 'Listo.').pass).toBe(false);
    });
  }

  // The mends that are plausible and not enough: the check must tell them from a right one.
  const WRONG: Record<string, (doc: Doc) => Step[]> = {
    // The clause put in with the next number, and the ones after it left as they were: two "Cuarta".
    'clause-after-third': () => [
      ['insert_paragraphs', { after_paragraph: 7, paragraphs: [{ text: 'Cuarta. Confidencialidad', style: 'Heading1' }, { text: 'Las partes guardarán confidencialidad sobre este contrato.' }] }],
    ],
    // A page break before the signatures: whole now, but on a page of their own when the text grows shorter.
    'signatures-on-one-page': (doc) => [['insert_page_break', { after_paragraph: numberOf(doc, 'En constancia, las partes firman este contrato.') - 1 }]],
  };
  for (const [id, steps] of Object.entries(WRONG)) {
    const c = CASES.find((one) => one.id === id)!;
    it.skipIf(c.needsFonts && !FONTS)(`${id}: fails a mend that is not enough`, () => {
      const before = c.doc();
      let doc = before;
      for (const [tool, args] of steps(before)) doc = runTool(doc, tool, args).doc ?? doc;
      expect(c.check(doc, before, 'Hecho.').pass).toBe(false);
    });
  }
});
