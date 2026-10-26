// Chinese, in the browser's own fonts: lines break between its characters,
// never before a comma or a full stop, and a justified line reaches the edge.

import { createDoc, createParagraph } from '@rebodocs/core/internal';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { mount, mouse, pointAt, texts } from './helpers';

const CLAUSE = '甲方应于每月五日前向乙方支付当月租金，乙方收到租金后应当开具正式发票。如甲方逾期付款，每逾期一日应按未付金额的千分之五支付违约金。';

describe('Chinese in the editor', () => {
  it('breaks its lines between characters, never before a comma, and justifies them to the edge', async () => {
    const editor = await mount(createDoc([createParagraph(CLAUSE.repeat(3), {}, { align: 'justify' })]));
    const lines = editor.layout.lines.filter((line) => line.para === 0);
    expect(lines.length).toBeGreaterThan(2);
    const right = Math.max(...lines.map((line) => line.x + line.width));
    for (const line of lines.slice(0, -1)) {
      const text = line.fragments.map((f) => f.text).join('');
      expect('，。、').not.toContain(text[0]);
      // Each line but the last reaches the right edge.
      const last = line.fragments[line.fragments.length - 1];
      expect(last.x + last.width).toBeCloseTo(right, 0);
    }
  });

  it('selects a word of it with a double click, not the whole sentence', async () => {
    const editor = await mount(['我们今天去公园散步']);
    const at = pointAt(editor, { para: 0, offset: 5 });
    mouse('mousedown', { x: at.x + 2, y: at.y }, { detail: 2 });
    mouse('mouseup', { x: at.x + 2, y: at.y }, { detail: 2 });
    const { anchor, focus } = editor.selection;
    const length = Math.abs(focus.offset - anchor.offset);
    expect(length).toBeGreaterThan(0);
    expect(length).toBeLessThan(9);
  });

  it('takes what a keyboard for Chinese composes', async () => {
    const editor = await mount(['']);
    const field = editor.input;
    field.dispatchEvent(new CompositionEvent('compositionstart'));
    field.value = 'ni';
    field.dispatchEvent(new InputEvent('input', { isComposing: true }));
    field.value = '你好';
    field.dispatchEvent(new CompositionEvent('compositionend', { data: '你好' }));
    await userEvent.keyboard('，');
    expect(texts(editor)[0]).toContain('你好');
  });
});
