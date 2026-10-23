// The template of the demo: a receipt with variables in its text, its header,
// a note at the foot of the page and its signatures, a row written once for
// each line of what it pays for and a paragraph only while it is not paid,
// made with the calls an
// application would make, and the values a form of the application would give.

import { type Doc, type Paragraph, type TemplateData, createDoc, insertFootnote, insertSignatures, insertTable, insertText, paragraphText, replaceRange, setParagraphStyle } from '@rebodocs/core';

const para = (text: string, props: Paragraph['props'] = {}): Paragraph => ({ props, runs: [{ text, props: {} }] });

export function receipt(): Doc {
  let doc = createDoc([
    para('Reservation receipt'),
    para('Received from {{clientName | capital}} ({{clientEmail}}) the amount of {{amount | currency}}, on {{date | long date}}, for the reservation of {{propertyRoom}} at {{propertyAddress}}.'),
    para('The balance, {{balance | currency}}, is paid on the day the keys are handed over to {{clientName | capital}}.'),
    para(''),
    para('{{^paid}}'),
    para('Until it is paid in full, the reservation can be cancelled with a week’s notice.'),
    para('{{/paid}}'),
    para(''),
  ]);
  doc = setParagraphStyle(doc, 0, 0, 'Heading1');
  doc = { ...doc, header: { paragraphs: [para('Receipt {{receiptNumber}}', { align: 'right' })] } };
  const balance = doc.paragraphs[2];
  doc = insertFootnote(doc, { para: 2, offset: paragraphText(balance).indexOf(',') }, 'Paid by transfer to the account of {{propertyAddress}}, quoting receipt {{receiptNumber}}.').doc;
  // What it pays for: the middle row is written once for each item of "lines".
  doc = insertTable(doc, { para: 3, offset: 0 }, 3, 2).doc;
  const cells = doc.paragraphs.flatMap((p, i) => (p.cell ? [i] : []));
  ['Item', 'Amount', '{{#lines}}{{lines.item}}', '{{lines.amount | currency}}{{/lines}}', 'Total', '{{amount | currency}}'].forEach(
    (text, k) => (doc = insertText(doc, { para: cells[k], offset: 0 }, text).doc),
  );
  const last = doc.paragraphs.length - 1;
  const signed = insertSignatures(doc, { para: last, offset: 0 }, ['ADVISER', 'CLIENT'], '{{adviserName | upper}}');
  doc = signed.doc;
  // The second name, three paragraphs after the first: the title, the line, the name.
  const second = signed.name!.from.para + 3;
  return replaceRange(doc, { from: { para: second, offset: 0 }, to: { para: second, offset: paragraphText(doc.paragraphs[second]).length } }, '{{clientName | upper}}').doc;
}

/** What a form of the application would hand over. */
export const SAMPLE: TemplateData = {
  receiptNumber: '1024',
  clientName: 'ana pérez',
  clientEmail: 'ana@example.com',
  amount: 2650,
  balance: 7500,
  lines: [
    { item: 'Deposit', amount: 2500 },
    { item: 'Cleaning', amount: 150 },
  ],
  paid: false,
  date: 'today',
  propertyRoom: 'the room on the third floor',
  propertyAddress: 'Calle Roble 12',
  adviserName: 'Luis Ortega',
};
