// The document of the demo: one of each thing a screen reader is told about
// as the caret reaches it. A heading, a link, a note at the foot of the page,
// a numbered list, a table, a picture with a description and a change Luis
// made while changes were tracked, made with the calls an application would make.

import { type Doc, type Paragraph, createDoc, insertFootnote, insertImage, insertLink, insertTable, insertText, paragraphText, setAltText, setParagraphStyle, toggleList } from '@rebodocs/core';

const para = (text: string): Paragraph => ({ props: {}, runs: [{ text, props: {} }] });

/** A small plan of the flat, drawn here: a picture to describe. */
async function plan(): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 120;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#f4f1ea';
  g.fillRect(0, 0, 240, 120);
  g.strokeStyle = '#2f2e2b';
  g.lineWidth = 3;
  g.strokeRect(8, 8, 224, 104);
  g.beginPath();
  g.moveTo(120, 8);
  g.lineTo(120, 70);
  g.moveTo(8, 70);
  g.lineTo(90, 70);
  g.stroke();
  const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function lease(): Promise<Doc> {
  let doc = createDoc([
    para('Lease of the flat'),
    para('The tenant has read the house rules before signing.'),
    para('What is included'),
    para('Furniture and appliances'),
    para('Water and heating'),
    para(''),
    para('The plan of the flat:'),
    para(''),
    para('The rent is paid on the first day of each month.'),
  ]);
  doc = setParagraphStyle(doc, 0, 0, 'Heading1');
  doc = setParagraphStyle(doc, 2, 2, 'Heading2');
  doc = toggleList(doc, 3, 4, 'number');
  // A link at the end of the second paragraph, and a note at the foot of the page after "rules".
  const rules = paragraphText(doc.paragraphs[1]).indexOf(' before');
  doc = insertLink(doc, { para: 1, offset: rules }, ' (see them online)', 'https://example.com/rules').doc;
  doc = insertFootnote(doc, { para: 1, offset: rules }, 'Given to the tenant on paper as well.').doc;
  // What Luis put in while changes were tracked.
  const last = doc.paragraphs.length - 1;
  doc = {
    ...doc,
    paragraphs: doc.paragraphs.map((p, i) =>
      i === last ? { ...p, runs: [...p.runs, { text: ' Late payments add 2% a month.', props: { revision: 'insert' as const, revisionAuthor: 'Luis', revisionDate: '2026-10-20T10:00:00Z' } }] } : p,
    ),
  };
  doc = insertImage(doc, { para: 7, offset: 0 }, { bytes: await plan(), type: 'image/png', width: 180, height: 90 }).doc;
  doc = setAltText(doc, { para: 7, offset: 0 }, 'Plan of the flat: a living room on the left, two bedrooms on the right');
  doc = insertTable(doc, { para: 5, offset: 0 }, 2, 2).doc;
  const cells = doc.paragraphs.flatMap((p, i) => (p.cell ? [i] : []));
  ['Rent', '$1,200', 'Deposit', '$2,400'].forEach((text, k) => (doc = insertText(doc, { para: cells[k], offset: 0 }, text).doc));
  return doc;
}
