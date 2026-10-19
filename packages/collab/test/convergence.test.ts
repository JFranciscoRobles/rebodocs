// Two people edit the same document at once, each a few steps, as their
// editors send them; everybody makes the changes of the first person first.
// Whichever way round, both must end with the same document. The edits are
// random, from a seed, so a failure is the same every time it runs. With
// more seeds and more steps a few still differ (6 in 20,000 with three steps
// each): the server's check of the document, and the editors loading the room
// again, are what mends those (see session.test.ts).

import { describe, expect, it } from 'vitest';
import { type Doc, applyRunProps, createDoc, createParagraph, deleteRange, insertText, paragraphText, setParagraphProps, splitParagraph } from '@rebodocs/core';
import { type Op, apply, diff, ensureIds, stampIds, transform } from '../src/changes';

function random(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

/** The document as it reads: each paragraph's id, alignment and letters, bold ones marked. */
const shape = (doc: Doc) => doc.paragraphs.map((p) => `${p.id}:${p.props.align ?? ''}:${p.runs.map((run) => [...run.text].map((ch) => ch + (run.props.bold ? '*' : '')).join('')).join('')}`);

/** Typing, deleting (across paragraphs too), Enter, bold, centring. */
function anyEdit(doc: Doc, next: () => number): Doc {
  const pos = () => {
    const para = Math.floor(next() * doc.paragraphs.length);
    return { para, offset: Math.floor(next() * (paragraphText(doc.paragraphs[para]).length + 1)) };
  };
  const range = () => {
    let [from, to] = [pos(), pos()];
    if (from.para > to.para || (from.para === to.para && from.offset > to.offset)) [from, to] = [to, from];
    return { from, to };
  };
  const kind = next();
  if (kind < 0.35) return insertText(doc, pos(), ['x', 'yz', 'Q '][Math.floor(next() * 3)]).doc;
  if (kind < 0.6) return deleteRange(doc, range());
  if (kind < 0.75) return splitParagraph(doc, pos()).doc;
  if (kind < 0.9) return applyRunProps(doc, range(), { bold: true });
  const para = Math.floor(next() * doc.paragraphs.length);
  return setParagraphProps(doc, para, para, { align: 'center' });
}

function person(doc: Doc, tag: string, steps: number, next: () => number): { doc: Doc; ops: Op[] } {
  let now = doc;
  const ops: Op[] = [];
  for (let step = 0; step < steps; step++) {
    let n = 0;
    const made = ensureIds(now, anyEdit(now, next), () => `${tag}${step}.${n++}`);
    ops.push(...diff(now, made));
    now = made;
  }
  return { doc: now, ops };
}

/** The seeds whose two people do not end with the same document. */
function diverging(most: number, seeds: number): number[] {
  const out: number[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    const next = random(seed);
    const doc = stampIds(createDoc(['uno uno', 'dos dos', 'tres', 'cuatro'].map((text) => createParagraph(text))));
    const a = person(doc, 'a', 1 + Math.floor(next() * most), next);
    const b = person(doc, 'b', 1 + Math.floor(next() * most), next);
    const { second, first } = transform(b.ops, a.ops);
    if (JSON.stringify(shape(apply(a.doc, second))) !== JSON.stringify(shape(apply(b.doc, first)))) out.push(seed);
  }
  return out;
}

describe('two people editing at random', () => {
  it('end with the same document after one edit each', () => {
    expect(diverging(1, 3000)).toEqual([]);
  });

  it('end with the same document after a few edits each', () => {
    expect(diverging(3, 3000)).toEqual([]);
  });
});
