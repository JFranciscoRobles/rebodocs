import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  type Doc,
  type TextMeasurer,
  createDoc,
  exportDocx,
  importDocx,
  insertTextBox,
  layoutDocument,
  paragraphText,
  storyOf,
  textBoxLook,
  withStory,
} from '../src';

// Monospace fake: every character is half the font size wide; a 10pt line is 10pt tall.
const measurer: TextMeasurer = {
  width: (text, font) => text.length * font.size * 0.5,
  metrics: (font) => ({ ascent: font.size * 0.8, descent: font.size * 0.2 }),
};

const W =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:v="urn:schemas-microsoft-com:vml"';

/** A text box as Word writes one: the shape, and a copy in VML for older programs. 200 × 100 pt, at 100 pt from the margins. */
const box = (text: string) => {
  const content = `<w:txbxContent><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:txbxContent>`;
  return (
    '<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="1" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">' +
    '<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="margin"><wp:posOffset>1270000</wp:posOffset></wp:positionH><wp:positionV relativeFrom="margin"><wp:posOffset>1270000</wp:posOffset></wp:positionV>' +
    '<wp:extent cx="2540000" cy="1270000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="7" name="Cuadro de texto 7"/><wp:cNvGraphicFramePr/>' +
    '<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvSpPr txBox="1"/>' +
    '<wps:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2540000" cy="1270000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:ln></wps:spPr>' +
    `<wps:txbx>${content}</wps:txbx><wps:bodyPr rot="0" vert="horz" wrap="square" lIns="127000" tIns="127000" rIns="127000" bIns="127000" anchor="t"><a:noAutofit/></wps:bodyPr></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice>` +
    `<mc:Fallback><w:pict><v:shape style="width:200pt;height:100pt"><v:textbox>${content}</v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r>`
  );
};

function open(body: string): Doc {
  const document = `<w:document ${W}><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
  const styles = `<w:styles ${W}><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;
  return importDocx(zipSync({ 'word/document.xml': strToU8(document), 'word/styles.xml': strToU8(styles) }));
}

describe('text boxes', () => {
  it('reads the text of a box as a story of its own, and sets it out inside its frame', () => {
    const doc = open(`<w:p><w:r><w:t>Text</w:t></w:r>${box('Inside the box, a line that is long enough to wrap twice over')}</w:p>`);
    expect(doc.paragraphs.map(paragraphText)).toEqual(['Text⁠']);
    expect(doc.textBoxes?.map((b) => [b.id, paragraphText(b.paragraphs[0])])).toEqual([['7', 'Inside the box, a line that is long enough to wrap twice over']]);
    const [page] = layoutDocument(doc, measurer).pages;
    const [laid] = page.textBoxes!;
    expect(laid.frame).toEqual({ x: 172, y: 172, width: 200, height: 100 });
    expect(laid.look).toMatchObject({ fill: 'FFFFFF', line: { color: 'FF0000', width: 1 }, inset: { top: 10.5, left: 10.5 }, grows: false });
    // Inside its insets and half its line: 179 wide, 35 letters of 5 a line.
    expect(laid.lines.map((l) => [l.x, l.y])).toEqual([[182.5, 182.5], [182.5, 192.5]]);
    expect(laid.lines[0].fragments.map((f) => f.text).join('')).toMatch(/^Inside the box/);
    expect(laid.lines.every((l) => l.y + l.height <= 262)).toBe(true);
  });

  it('writes back only what changed, in both copies of the text', () => {
    const doc = open(`<w:p>${box('Old words')}</w:p><w:p><w:r><w:t>After</w:t></w:r></w:p>`);
    const before = strFromU8(unzipSync(exportDocx(doc))['word/document.xml']);
    expect(before).toContain('Old words');
    const story = storyOf(doc, 'textbox:7')!;
    const changed = withStory(doc, 'textbox:7', { paragraphs: [{ ...story.paragraphs[0], runs: [{ text: 'New words', props: story.paragraphs[0].runs[0].props }] }] });
    const xml = strFromU8(unzipSync(exportDocx(changed))['word/document.xml']);
    expect(xml).not.toContain('Old words');
    expect(xml.match(/New words/g)).toHaveLength(2);
    expect(importDocx(exportDocx(changed)).textBoxes?.map((b) => paragraphText(b.paragraphs[0]))).toEqual(['New words']);
  });

  it('puts a new box in, which grows with its text and reads back', () => {
    const made = insertTextBox(createDoc(), { para: 0, offset: 0 }, { width: 144, height: 30, text: 'Una nota en un cuadro' });
    const page = layoutDocument(made.doc, measurer).pages[0];
    expect(page.textBoxes?.[0].frame.width).toBe(144);
    const back = importDocx(exportDocx(made.doc));
    expect(back.textBoxes?.map((b) => [b.id, paragraphText(b.paragraphs[0])])).toEqual([[made.id, 'Una nota en un cuadro']]);
    expect(textBoxLook(back.paragraphs[0].runs.find((r) => r.props.object)!.props.object!)).toMatchObject({ fill: 'FFFFFF', line: { color: '000000', width: 0.5 }, grows: true });
  });
});
