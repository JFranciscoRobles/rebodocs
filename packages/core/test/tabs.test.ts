import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { type Doc, type TextMeasurer, exportDocx, importDocx, layoutDocument, setParagraphProps } from '../src/internal';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

// Monospace fake: every character is half the font size wide; 10pt text makes 5pt characters.
const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

const STYLES =
  `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="20"/></w:rPr></w:rPrDefault></w:docDefaults>` +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Tabbed"><w:name w:val="Tabbed"/><w:basedOn w:val="Normal"/>' +
  '<w:pPr><w:tabs><w:tab w:val="left" w:pos="1000"/><w:tab w:val="left" w:pos="2000"/></w:tabs></w:pPr></w:style></w:styles>';

const tab = (val: string, pos: number, leader?: string) => `<w:tab w:val="${val}"${leader ? ` w:leader="${leader}"` : ''} w:pos="${pos}"/>`;
/** A paragraph of text with tabs in it, and the tab stops and other properties it sets. */
const p = (text: string, tabs: string[] = [], pPr = '') =>
  `<w:p><w:pPr>${pPr}${tabs.length ? `<w:tabs>${tabs.join('')}</w:tabs>` : ''}</w:pPr>` +
  text
    .split('\t')
    .map((part, i) => `${i ? '<w:r><w:tab/></w:r>' : ''}${part ? `<w:r><w:t xml:space="preserve">${part}</w:t></w:r>` : ''}`)
    .join('') +
  '</w:p>';

// 300pt wide page with 10pt margins: a 280pt text area. Default tab stops every 40pt.
function open(body: string): Doc {
  const document =
    `<w:document ${W}><w:body>${body}` + '<w:sectPr><w:pgSz w:w="6000" w:h="8000"/><w:pgMar w:top="200" w:right="200" w:bottom="200" w:left="200"/></w:sectPr>' + '</w:body></w:document>';
  const settings = `<w:settings ${W}><w:defaultTabStop w:val="800"/></w:settings>`;
  return importDocx(zipSync({ 'word/document.xml': strToU8(document), 'word/styles.xml': strToU8(STYLES), 'word/settings.xml': strToU8(settings) }));
}

/** Where each stretch of text of a paragraph starts, from the left edge of the text. */
const starts = (doc: Doc, para: number) =>
  layoutDocument(doc, measurer)
    .lines.filter((l) => l.para === para)
    .flatMap((l) => l.fragments.filter((f) => f.kind === 'text').map((f) => [f.text, f.x - 10]));

describe('tab stops', () => {
  it('reads the stops of a paragraph over those of its style, and the default ones of the document', () => {
    const doc = open(p('a', [tab('right', 3000, 'hyphen'), tab('decimal', 4000)]) + p('b', [tab('clear', 1000)], '<w:pStyle w:val="Tabbed"/>') + p('c'));
    expect(doc.defaultTabStop).toBe(40);
    expect(doc.paragraphs[0].props.tabs).toEqual([
      { pos: 150, align: 'right', leader: 'hyphen' },
      { pos: 200, align: 'decimal' },
    ]);
    // The style's stop at 50pt is taken away; the other stays.
    expect(doc.paragraphs[1].props.tabs).toEqual([{ pos: 100, align: 'left' }]);
    expect(doc.paragraphs[2].props.tabs).toBeUndefined();
  });

  it('sets the text after a tab at, ending at, centred on, or with its decimal point on its stop', () => {
    const doc = open(
      p('a\tb', [tab('left', 1200)]) + p('a\tbcde', [tab('right', 2000)]) + p('a\tbcde', [tab('center', 2000)]) + p('a\t12.5', [tab('decimal', 2000)]) + p('a\t125', [tab('decimal', 2000)]),
    );
    expect(starts(doc, 0)).toEqual([
      ['a', 0],
      ['b', 60],
    ]);
    expect(starts(doc, 1)).toEqual([
      ['a', 0],
      ['bcde', 80],
    ]);
    expect(starts(doc, 2)).toEqual([
      ['a', 0],
      ['bcde', 90],
    ]);
    expect(starts(doc, 3)).toEqual([
      ['a', 0],
      ['12.5', 90],
    ]);
    // No point: it ends at the stop.
    expect(starts(doc, 4)).toEqual([
      ['a', 0],
      ['125', 85],
    ]);
  });

  it('goes on to the default stops past the last of its own, and to the hanging indent on the first line', () => {
    const doc = open(p('a\tb\tc\td', [tab('left', 1000)]) + p('a\tb', [], '<w:ind w:left="1200" w:hanging="600"/>'));
    expect(starts(doc, 0)).toEqual([
      ['a', 0],
      ['b', 50],
      ['c', 80],
      ['d', 120],
    ]);
    expect(starts(doc, 1)).toEqual([
      ['a', 30],
      ['b', 60],
    ]);
  });

  it('fills the gap of a tab with its leader, the characters on a grid from the edge of the page', () => {
    const doc = open(p('ab\tc', [tab('right', 4000, 'dot')]));
    const [line] = layoutDocument(doc, measurer).lines;
    const gap = line.fragments.find((f) => f.kind === 'tab')!;
    // The gap runs from 20pt to 205pt of the page, where 'c' starts: as many 5pt dots as fit whole in it, each at a multiple of 5.
    expect([gap.x, gap.x + gap.width]).toEqual([20, 205]);
    expect(gap.leader).toEqual({ text: '.'.repeat(37), x: 20, width: 185 });
  });

  it('lets the text up to a stop past the end of the line run past it, as Word does', () => {
    const doc = open(p('a\tbeyond the edge', [tab('right', 6400)]));
    const lines = layoutDocument(doc, measurer).lines;
    expect(lines).toHaveLength(1);
    expect(starts(doc, 0)).toEqual([
      ['a', 0],
      ['beyond the edge', 245],
    ]);
  });

  it('writes the stops back over those of the style, clearing the ones taken away', () => {
    const doc = open(p('a\tb', [], '<w:pStyle w:val="Tabbed"/>') + p('c'));
    const changed = setParagraphProps(doc, 0, 1, {
      tabs: [
        { pos: 50, align: 'left' },
        { pos: 120, align: 'center', leader: 'dot' },
      ],
    });
    const xml = strFromU8(unzipSync(exportDocx(changed))['word/document.xml']);
    expect(xml).toContain('<w:tabs><w:tab w:val="clear" w:pos="2000"/><w:tab w:val="center" w:leader="dot" w:pos="2400"/></w:tabs>');
    expect(xml).toContain('<w:tabs><w:tab w:val="left" w:pos="1000"/><w:tab w:val="center" w:leader="dot" w:pos="2400"/></w:tabs>');
    const back = importDocx(exportDocx(changed));
    expect(back.paragraphs.map((x) => x.props.tabs)).toEqual(changed.paragraphs.map((x) => x.props.tabs));
    // Untouched, a paragraph's stops go back as they came.
    expect(strFromU8(unzipSync(exportDocx(doc))['word/document.xml'])).not.toContain('w:tabs');
  });
});
