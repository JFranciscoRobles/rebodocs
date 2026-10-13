import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type ListLevel,
  type Numbering,
  type TextMeasurer,
  ListCounters,
  createDoc,
  createLayoutCache,
  createParagraph,
  deleteRange,
  exportDocx,
  formatNumber,
  importDocx,
  insertText,
  layoutDocument,
  leaveList,
  listKindAt,
  listLabels,
  paragraphLength,
  shiftListLevel,
  splitParagraph,
  symbolText,
  toggleList,
} from '../src';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

// Monospace fake: every character is half the font size wide.
const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

function level(patch: Partial<ListLevel>): ListLevel {
  return { start: 1, format: 'decimal', text: '%1.', align: 'left', suffix: 'tab', run: {}, restart: true, legal: false, ...patch };
}

function numberingOf(levels: ListLevel[]): Numbering {
  return {
    abstracts: new Map([[0, levels]]),
    lists: new Map([[1, { abstractId: 0, starts: new Map(), levels: new Map() }]]),
  };
}

describe('list counters', () => {
  it('counts each level and restarts the deeper ones', () => {
    const numbering = numberingOf([
      level({}),
      level({ format: 'lowerLetter', text: '%2)' }),
      level({ format: 'lowerRoman', text: '%3.' }),
    ]);
    const counters = new ListCounters();
    const next = (lv: number) => counters.next(numbering, 1, lv)?.text;
    expect([next(0), next(0), next(1), next(1), next(2), next(0), next(1)]).toEqual(['1.', '2.', 'a)', 'b)', 'i.', '3.', 'a)']);
    expect(counters.next(numbering, 99, 0)).toBeUndefined();
  });

  it('builds multi-level labels, in digits for legal numbering', () => {
    const numbering = numberingOf([
      level({ format: 'upperRoman', text: '%1.' }),
      level({ text: '%1.%2.' }),
      level({ text: '%1.%2.%3', legal: true }),
    ]);
    const counters = new ListCounters();
    const next = (lv: number) => counters.next(numbering, 1, lv)?.text;
    expect([next(0), next(0), next(1), next(2)]).toEqual(['I.', 'II.', 'II.1.', '2.1.1']);
    // A level used before the ones above it shows them at their start value.
    expect(new ListCounters().next(numbering, 1, 1)?.text).toBe('I.1.');
  });

  it('honours restart rules, start values and start overrides', () => {
    const numbering = numberingOf([
      level({}),
      level({ text: '%1.%2.', restart: false }),
      level({ text: '(%3)', restartAfter: 1, start: 5 }),
    ]);
    numbering.lists.set(2, { abstractId: 0, starts: new Map([[0, 7]]), levels: new Map([[1, level({ format: 'none' })]]) });
    const counters = new ListCounters();
    const next = (lv: number, id = 1) => counters.next(numbering, id, lv)?.text;
    expect([next(0), next(1), next(2), next(1), next(2)]).toEqual(['1.', '1.1.', '(5)', '1.2.', '(6)']);
    // Level 1 restarts level 3; level 2 never restarts.
    expect([next(0), next(1), next(2)]).toEqual(['2.', '2.3.', '(5)']);
    // The second list starts over at 7 and defines its own second level, which shows no label.
    expect([next(0, 2), next(0, 2), next(1, 2)]).toEqual(['7.', '8.', undefined]);
  });

  it('formats numbers the way Word does', () => {
    expect([1, 4, 9, 14, 40, 1994].map((n) => formatNumber('lowerRoman', n))).toEqual(['i', 'iv', 'ix', 'xiv', 'xl', 'mcmxciv']);
    expect([1, 26, 27, 53].map((n) => formatNumber('upperLetter', n))).toEqual(['A', 'Z', 'AA', 'AAA']);
    expect(formatNumber('decimalZero', 7)).toBe('07');
  });

  it('maps symbol-font bullets to ordinary characters', () => {
    expect(symbolText('', 'Symbol')).toBe('•');
    expect(symbolText('', 'Wingdings')).toBe('▪');
    expect(symbolText('', 'Wingdings')).toBe('•');
    expect(symbolText('o', 'Courier New')).toBe('o');
  });
});

const NUMBERING =
  `<w:numbering ${W}>` +
  '<w:abstractNum w:abstractNumId="0">' +
  '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/>' +
  '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>' +
  '<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%2)"/>' +
  '<w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr><w:rPr><w:b/></w:rPr></w:lvl>' +
  '</w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="1">' +
  '<w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val=""/>' +
  '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:lvl>' +
  '</w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="2">' +
  '<w:lvl w:ilvl="0"><w:pStyle w:val="Heading1"/><w:lvlText w:val="%1"/><w:pPr><w:ind w:left="432" w:hanging="432"/></w:pPr></w:lvl>' +
  '<w:lvl w:ilvl="1"><w:pStyle w:val="Heading2"/><w:lvlText w:val="%1.%2"/><w:suff w:val="space"/><w:pPr><w:ind w:left="576" w:hanging="576"/></w:pPr></w:lvl>' +
  '</w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
  '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
  '<w:num w:numId="3"><w:abstractNumId w:val="0"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>' +
  '<w:num w:numId="4"><w:abstractNumId w:val="2"/></w:num>' +
  '</w:numbering>';

const STYLES =
  `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults>` +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"/>' +
  '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:pPr><w:ind w:left="1000"/></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:pPr><w:numPr><w:numId w:val="4"/></w:numPr></w:pPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading2"><w:pPr><w:numPr><w:numId w:val="4"/></w:numPr><w:ind w:left="100" w:hanging="100"/></w:pPr></w:style>' +
  '</w:styles>';

function item(text: string, numId: number, lvl: number, extra = ''): string {
  return (
    `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="${numId}"/></w:numPr>${extra}</w:pPr>` +
    `<w:r><w:t>${text}</w:t></w:r></w:p>`
  );
}

function styled(text: string, style: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`;
}

function open(body: string): Doc {
  const document =
    `<w:document ${W}><w:body>${body}` +
    '<w:sectPr><w:pgSz w:w="6000" w:h="8000"/><w:pgMar w:top="200" w:right="200" w:bottom="200" w:left="200"/></w:sectPr>' +
    '</w:body></w:document>';
  return importDocx(
    zipSync({
      'word/document.xml': strToU8(document),
      'word/styles.xml': strToU8(STYLES),
      'word/numbering.xml': strToU8(NUMBERING),
    }),
  );
}

const LIST = [
  item('one', 1, 0),
  item('two', 1, 0),
  item('nested', 1, 1),
  item('three', 1, 0, '<w:ind w:left="900"/>'),
  item('dot', 2, 0),
  '<w:p><w:r><w:t>plain</w:t></w:r></w:p>',
  item('again', 3, 0),
].join('');

describe('lists in a document', () => {
  it('reads list membership and labels every item', () => {
    const doc = open(LIST);
    expect(doc.paragraphs.map((p) => [p.props.numId, p.props.listLevel])).toEqual([
      [1, 0], [1, 0], [1, 1], [1, 0], [2, 0], [undefined, undefined], [3, 0],
    ]);
    expect(listLabels(doc).map((l) => l?.text)).toEqual(['1.', '2.', 'a)', '3.', '', undefined, '1.']);
  });

  it('takes indents from the level over the style, and from the paragraph over the level', () => {
    const doc = open(LIST);
    expect(doc.paragraphs[0].props).toMatchObject({ indentLeft: 36, indentFirstLine: -18 });
    expect(doc.paragraphs[2].props).toMatchObject({ indentLeft: 72, indentFirstLine: -18 });
    expect(doc.paragraphs[3].props).toMatchObject({ indentLeft: 45, indentFirstLine: -18 });
    expect(doc.paragraphs[5].props.indentLeft).toBeUndefined();
  });

  it('finds the level of a list given by a style, whose own indents win', () => {
    const doc = open(styled('Chapter', 'Heading1') + styled('Section', 'Heading2') + styled('Next', 'Heading2'));
    expect(doc.paragraphs.map((p) => p.props.listLevel)).toEqual([0, 1, 1]);
    expect(listLabels(doc).map((l) => l?.text)).toEqual(['1', '1.1', '1.2']);
    expect(doc.paragraphs[0].props).toMatchObject({ indentLeft: 21.6, indentFirstLine: -21.6 });
    expect(doc.paragraphs[1].props).toMatchObject({ indentLeft: 5, indentFirstLine: -5 });
  });

  it('places the label in the hanging indent and the text after it', () => {
    const layout = layoutDocument(open(item('aaaa '.repeat(12).trim(), 1, 0) + item('b', 1, 1) + item('c', 2, 0)), measurer);
    const [first, second, nested, bullet] = layout.lines;
    // 10pt margin; the number sits at left - hanging = 18pt and the text at the 36pt indent.
    expect(first.label).toMatchObject({ text: '1.', x: 28, width: 10 });
    expect(first.fragments[0].x).toBe(46);
    expect(second.label).toBeUndefined();
    expect(second.x).toBe(46);
    expect(nested.label).toMatchObject({ text: 'a)', x: 64 });
    expect(nested.label!.props.bold).toBe(true);
    expect(nested.fragments[0].x).toBe(82);
    // The Symbol bullet is drawn as a character of the paragraph's font.
    expect(bullet.label).toMatchObject({ text: '•' });
    expect(bullet.label!.font.family).toBe(bullet.fragments[0].font.family);
  });

  it('moves the text to the next tab stop when the label overflows the hanging indent, or by a space', () => {
    const wide = open(item('x', 1, 0, '<w:ind w:left="720" w:hanging="60"/>'));
    // Label from 33pt to 43pt, past the 36pt indent: the text goes to the 72pt stop.
    expect(layoutDocument(wide, measurer).lines[0].fragments[0].x).toBe(10 + 72);
    const spaced = layoutDocument(open(styled('Chapter', 'Heading1') + styled('Section', 'Heading2')), measurer).lines[1];
    expect(spaced.label).toMatchObject({ text: '1.1', x: 10, width: 15 });
    expect(spaced.fragments[0].x).toBe(10 + 15 + 5);
  });

  it('keeps an item in its list when it is edited or split', () => {
    const doc = open(LIST);
    const split = splitParagraph(insertText(doc, { para: 1, offset: 3 }, '!').doc, { para: 1, offset: 2 }).doc;
    expect(listLabels(split).map((l) => l?.text).slice(0, 5)).toEqual(['1.', '2.', '3.', 'a)', '4.']);
    const xml = strFromU8(unzipSync(exportDocx(split))['word/document.xml']);
    const numbered = xml.match(/<w:numId w:val="1"\/>/g);
    expect(numbered).toHaveLength(5);
    // The level's indent is not written into the paragraph.
    expect(xml).toContain('<w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">tw</w:t></w:r>');
    expect(importDocx(exportDocx(doc))).toEqual(doc);
  });
});

describe('layout cache', () => {
  it('reuses the lines of paragraphs that did not change', () => {
    const doc = open(LIST);
    const cache = createLayoutCache();
    const before = layoutDocument(doc, measurer, cache);
    const edited = insertText(doc, { para: 5, offset: 0 }, 'very ').doc;
    const after = layoutDocument(edited, measurer, cache);
    expect(after.lines.map((l, i) => l.raw === before.lines[i].raw)).toEqual([true, true, true, true, true, false, true]);
    expect(after).toEqual(layoutDocument(edited, measurer));
  });

  it('lays a paragraph out again when its label changes', () => {
    const doc = open(LIST);
    const cache = createLayoutCache();
    const before = layoutDocument(doc, measurer, cache);
    // Removing the first item renumbers the ones after it, which are the same objects as before.
    const removed = deleteRange(doc, {
      from: { para: 0, offset: 0 },
      to: { para: 1, offset: paragraphLength(doc.paragraphs[1]) },
    });
    const emptied = { ...removed, paragraphs: removed.paragraphs.slice(1) };
    expect(emptied.paragraphs[0]).toBe(doc.paragraphs[2]);
    const after = layoutDocument(emptied, measurer, cache);
    expect(after.lines.map((l) => l.label?.text)).toEqual(['a)', '1.', '•', undefined, '1.']);
    // 'nested' keeps its label and its lines; 'three' went from 3. to 1.
    expect(after.lines[0].raw).toBe(before.lines[2].raw);
    expect(after.lines[1].raw).not.toBe(before.lines[3].raw);
    expect(after).toEqual(layoutDocument(emptied, measurer));
  });
});

function parts(doc: Doc): Record<string, string> {
  return Object.fromEntries(Object.entries(unzipSync(exportDocx(doc))).map(([path, bytes]) => [path, strFromU8(bytes)]));
}

const labelsOf = (doc: Doc) => listLabels(doc).map((l) => l?.text);

describe('editing lists', () => {
  it('starts a list, changes its kind and levels, and removes it', () => {
    const plain = createDoc(['a', 'b', 'c', 'd'].map((t) => createParagraph(t)));
    let doc = toggleList(plain, 0, 2, 'number');
    expect(labelsOf(doc)).toEqual(['1.', '2.', '3.', undefined]);
    expect(doc.paragraphs[0].props).toMatchObject({ numId: 1, listLevel: 0, indentLeft: 36, indentFirstLine: -18 });

    doc = shiftListLevel(doc, 1, 2, 1);
    expect(labelsOf(doc)).toEqual(['1.', 'a.', 'b.', undefined]);
    expect(doc.paragraphs[1].props).toMatchObject({ listLevel: 1, indentLeft: 72 });
    // Levels stop at the top and plain paragraphs are left alone.
    expect(shiftListLevel(doc, 0, 3, -1).paragraphs.map((p) => p.props.listLevel)).toEqual([0, 0, 0, undefined]);

    // Changing the kind starts another list and keeps each item's level.
    doc = toggleList(doc, 0, 2, 'bullet');
    expect(labelsOf(doc)).toEqual(['', 'o', 'o', undefined]);
    expect([0, 1, 2, 3].map((i) => listKindAt(doc, i))).toEqual(['bullet', 'bullet', 'bullet', undefined]);

    doc = toggleList(doc, 0, 2, 'bullet');
    expect(labelsOf(doc)).toEqual([undefined, undefined, undefined, undefined]);
    expect(doc.paragraphs[1].props).toMatchObject({ numId: 0, indentLeft: 0, indentFirstLine: 0 });
    expect(doc.paragraphs[1].props.listLevel).toBeUndefined();
    // The original document was not touched.
    expect(plain.numbering).toBeUndefined();
  });

  it('continues the list next to the paragraph, and starts a new one otherwise', () => {
    const doc = toggleList(createDoc(['a', 'b', 'c', 'd', 'e'].map((t) => createParagraph(t))), 0, 1, 'number');
    expect(labelsOf(toggleList(doc, 2, 2, 'number'))).toEqual(['1.', '2.', '3.', undefined, undefined]);
    const apart = toggleList(doc, 3, 4, 'number');
    expect(labelsOf(apart)).toEqual(['1.', '2.', undefined, '1.', '2.']);
    expect(apart.paragraphs[3].props.numId).not.toBe(apart.paragraphs[0].props.numId);
    // A list id the paragraphs use is never given to a new list, even if nothing defines it.
    const dangling = createDoc([createParagraph('x', {}, { numId: 7 }), createParagraph('y')]);
    expect(toggleList(dangling, 1, 1, 'bullet').paragraphs[1].props.numId).toBe(8);
  });

  it('takes one item out of a list, keeping its indent on request', () => {
    const doc = toggleList(createDoc(['a', 'b', 'c'].map((t) => createParagraph(t))), 0, 2, 'number');
    const kept = leaveList(doc, 1, true);
    expect(labelsOf(kept)).toEqual(['1.', undefined, '2.']);
    expect(kept.paragraphs[1].props).toMatchObject({ numId: 0, indentLeft: 36, indentFirstLine: 0 });
    expect(leaveList(doc, 1).paragraphs[1].props).toMatchObject({ numId: 0, indentLeft: 0, indentFirstLine: 0 });
  });

  it('writes the lists of a new document into a package Word can read', () => {
    let doc = createDoc(['a', 'b', 'c'].map((t) => createParagraph(t)));
    doc = shiftListLevel(toggleList(toggleList(doc, 0, 1, 'number'), 2, 2, 'bullet'), 1, 1, 1);
    const files = parts(doc);
    expect(files['[Content_Types].xml']).toContain('<Override PartName="/word/numbering.xml"');
    expect(files['word/_rels/document.xml.rels']).toContain('Target="numbering.xml"');
    expect(files['word/numbering.xml']).toContain(
      '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val=""/><w:lvlJc w:val="left"/>' +
        '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:cs="Symbol" w:hint="default"/></w:rPr></w:lvl>',
    );
    // Every abstract list comes before the first list, as the schema asks.
    const numbering = files['word/numbering.xml'];
    expect(numbering.lastIndexOf('<w:abstractNum ')).toBeLessThan(numbering.indexOf('<w:num '));
    expect(files['word/document.xml']).toContain('<w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr>');

    const back = importDocx(exportDocx(doc));
    expect(labelsOf(back)).toEqual(['1.', 'a.', '']);
    expect(back.numbering).toEqual(doc.numbering);
    expect(back.paragraphs.map((p) => [p.props.numId, p.props.listLevel, p.props.indentLeft, p.props.indentFirstLine])).toEqual(
      doc.paragraphs.map((p) => [p.props.numId, p.props.listLevel, p.props.indentLeft, p.props.indentFirstLine]),
    );
  });

  it('adds a new list to the numbering part of an opened document', () => {
    const doc = open(LIST);
    // 'plain' sits between a bullet list and a numbered one: numbering continues the one after it.
    expect(toggleList(doc, 5, 5, 'number').paragraphs[5].props.numId).toBe(3);
    const joined = toggleList(doc, 5, 5, 'bullet');
    expect(joined.paragraphs[5].props.numId).toBe(2);
    expect(parts(joined)['word/numbering.xml']).toBe(NUMBERING);
    expect(parts(joined)['word/document.xml']).toContain(
      '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr><w:ind w:left="720" w:hanging="360"/></w:pPr><w:r><w:t xml:space="preserve">plain</w:t></w:r></w:p>',
    );

    const fresh = toggleList(open('<w:p><w:r><w:t>x</w:t></w:r></w:p>'), 0, 0, 'number');
    expect(fresh.paragraphs[0].props.numId).toBe(5);
    const numbering = parts(fresh)['word/numbering.xml'];
    expect(numbering).toContain('</w:abstractNum><w:abstractNum w:abstractNumId="3"><w:multiLevelType');
    expect(numbering).toContain('</w:abstractNum><w:num w:numId="1">');
    expect(numbering.endsWith('<w:num w:numId="5"><w:abstractNumId w:val="3"/></w:num></w:numbering>')).toBe(true);
    const back = importDocx(exportDocx(fresh));
    expect(labelsOf(back)).toEqual(['1.']);
    // Saving again adds nothing more.
    expect(parts(back)['word/numbering.xml']).toBe(numbering);
  });

  it('creates the numbering part when the opened document has none', () => {
    const w = `<w:document ${W}><w:body><w:p><w:r><w:t>x</w:t></w:r></w:p></w:body></w:document>`;
    const pkg = {
      '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
      'word/document.xml': w,
      'word/_rels/document.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x/styles" Target="styles.xml"/></Relationships>',
    };
    const doc = importDocx(zipSync(Object.fromEntries(Object.entries(pkg).map(([k, v]) => [k, strToU8(v)]))));
    const files = parts(toggleList(doc, 0, 0, 'bullet'));
    expect(files['word/numbering.xml']).toContain('<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>');
    expect(files['[Content_Types].xml']).toContain('<Override PartName="/word/numbering.xml"');
    expect(files['[Content_Types].xml'].endsWith('</Types>')).toBe(true);
    expect(files['word/_rels/document.xml.rels']).toContain('<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>');
    // Untouched, the package is written back as it was.
    expect(parts(doc)).toEqual(pkg);
  });

  it('writes an item taken out of its list, switching off a list the style gives', () => {
    const direct = parts(leaveList(open(LIST), 0))['word/document.xml'];
    expect(direct).toContain('<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:ind w:left="0" w:firstLine="0"/></w:pPr><w:r><w:t xml:space="preserve">one</w:t></w:r></w:p>');

    const headings = open(styled('Chapter', 'Heading1') + styled('Next', 'Heading1'));
    const off = leaveList(headings, 0);
    expect(parts(off)['word/document.xml']).toContain('<w:pPr><w:pStyle w:val="Heading1"/><w:numPr><w:numId w:val="0"/></w:numPr>');
    const back = importDocx(exportDocx(off));
    expect(labelsOf(back)).toEqual([undefined, '1']);

    const deeper = parts(shiftListLevel(open(LIST), 1, 1, 1))['word/document.xml'];
    expect(deeper).toContain('<w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr><w:ind w:left="1440"/></w:pPr><w:r><w:t xml:space="preserve">two</w:t>');
  });
});
