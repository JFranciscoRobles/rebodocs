// The list "{{" brings up: what it offers, what typing after it does, and
// what choosing from it writes.

import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { type VariableSuggest, createVariableSuggest } from '../../src/index';
import { mount, texts } from './helpers';

let suggest: VariableSuggest | undefined;
afterEach(() => {
  suggest?.destroy();
  suggest = undefined;
});

const shown = () => document.querySelector('.dx-sl.dx-sl-open');
const names = () => [...document.querySelectorAll('.dx-sl-open .dx-sl-name')].map((node) => node.textContent);

describe('the "{{" list', () => {
  it('offers those the application fills first, then those of the document, each once', async () => {
    const editor = await mount(['Para {{cliente}} y {{fecha}}', '']);
    suggest = createVariableSuggest(editor, { variables: [{ name: 'cliente', title: 'Quien firma' }, { name: 'monto', example: '$1,200' }, 'bad}name'] });
    editor.setSelection({ para: 1, offset: 0 });
    await userEvent.keyboard('{{{{');
    expect(names()).toEqual(['cliente', 'monto', 'fecha']);
    expect(document.querySelector('.dx-sl-open .dx-sl-title')?.textContent).toBe('Quien firma');
  });

  it('writes the one chosen whole, in place of what was typed', async () => {
    const editor = await mount(['']);
    suggest = createVariableSuggest(editor, { variables: ['nombre_cliente', 'monto'] });
    await userEvent.keyboard('Paga {{{{mon');
    expect(names()[0]).toBe('monto');
    await userEvent.keyboard('{Enter} hoy');
    expect(texts(editor)).toEqual(['Paga {{monto}} hoy']);
    expect(shown()).toBeNull();
  });

  it('finds a name by any of its words', async () => {
    const editor = await mount(['']);
    suggest = createVariableSuggest(editor, { variables: ['nombre_cliente', 'monto'] });
    await userEvent.keyboard('{{{{cli');
    expect(names()[0]).toBe('nombre_cliente');
  });

  it('offers a new one by the name typed, unless told not to', async () => {
    const editor = await mount(['']);
    suggest = createVariableSuggest(editor, { variables: ['monto'] });
    await userEvent.keyboard('{{{{plazo');
    expect(names()).toEqual(['{{plazo}}']);
    await userEvent.keyboard('{Enter}');
    expect(texts(editor)).toEqual(['{{plazo}}']);
    suggest.destroy();
    suggest = createVariableSuggest(editor, { variables: ['monto'], allowNew: false, fromDocument: false });
    await userEvent.keyboard(' {{{{');
    expect(names()).toEqual(['monto']);
    await userEvent.keyboard('pla');
    expect(shown()).toBeNull();
  });

  it('goes when the name is closed by hand, or a block or a format is written', async () => {
    const editor = await mount(['']);
    suggest = createVariableSuggest(editor, { variables: ['monto'] });
    await userEvent.keyboard('{{{{monto}');
    expect(shown()).toBeNull();
    await userEvent.keyboard('} {{{{#');
    expect(shown()).toBeNull();
    await userEvent.keyboard('lista}} {{{{monto |');
    expect(shown()).toBeNull();
    expect(texts(editor)).toEqual(['{{monto}} {{#lista}} {{monto |']);
  });
});
