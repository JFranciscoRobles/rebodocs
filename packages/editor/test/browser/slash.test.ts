// The menu a "/" brings up: when it comes, what typing after it does, and
// what choosing from it leaves in the document.

import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { type SlashMenu, createSlashMenu } from '../../src/index';
import { mount, texts } from './helpers';

let menu: SlashMenu | undefined;
afterEach(() => {
  menu?.destroy();
  menu = undefined;
});

const shown = () => document.querySelector('.dx-sl.dx-sl-open');
const names = () => [...document.querySelectorAll('.dx-sl-open .dx-sl-name')].map((node) => node.textContent);

describe('the "/" menu', () => {
  it('comes up at the start of a paragraph and after a space, not inside a word or a date', async () => {
    const editor = await mount(['']);
    menu = createSlashMenu(editor);
    await userEvent.keyboard('/');
    expect(shown()).not.toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(shown()).toBeNull();
    expect(texts(editor)).toEqual(['/']);
    await userEvent.keyboard('{Backspace}12/05 y/o');
    expect(shown()).toBeNull();
    await userEvent.keyboard(' /');
    expect(shown()).not.toBeNull();
  });

  it('narrows the list with what is typed after it, and goes when nothing is found and a space follows', async () => {
    const editor = await mount(['']);
    menu = createSlashMenu(editor);
    await userEvent.keyboard('/tab');
    expect(names()[0]).toMatch(/Tabla|Table/);
    await userEvent.keyboard('{Backspace}{Backspace}{Backspace}h2');
    expect(names()).toHaveLength(1);
    await userEvent.keyboard('{Backspace}{Backspace}zzz');
    expect(names()).toEqual([]);
    await userEvent.keyboard(' ');
    expect(shown()).toBeNull();
    expect(texts(editor)).toEqual(['/zzz ']);
  });

  it('does the one chosen in place of what was typed', async () => {
    const editor = await mount(['Cláusula']);
    menu = createSlashMenu(editor);
    editor.setSelection({ para: 0, offset: 8 });
    await userEvent.keyboard('{Enter}/h1{Enter}');
    expect(shown()).toBeNull();
    expect(texts(editor)).toEqual(['Cláusula', '']);
    expect(editor.activeStyleId()).toBe(editor.styles.find((style) => style.outlineLevel === 1)?.id);
    await userEvent.keyboard('/{ArrowDown}');
    const second = names()[1];
    await userEvent.keyboard('{Enter}');
    expect(second).toBeTruthy();
    expect(texts(editor)[1]).toBe('');
  });

  it('stays where it is scrolled to, under the wheel and under the pointer', async () => {
    const editor = await mount(['']);
    menu = createSlashMenu(editor);
    await userEvent.keyboard('/');
    const list = document.querySelector<HTMLElement>('.dx-sl-open')!;
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
    list.scrollTop = 120;
    list.dispatchEvent(new Event('scroll'));
    await new Promise((done) => setTimeout(done, 50));
    expect(list.scrollTop).toBe(120);
    const last = [...list.querySelectorAll('button')].at(-1)!;
    last.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    expect(list.scrollTop).toBe(120);
    expect(last.classList.contains('dx-on')).toBe(true);
  });

  it('keeps only the commands it comes with that it is told to, or none', async () => {
    const editor = await mount(['']);
    menu = createSlashMenu(editor, { builtIns: ['table', 'heading1'] });
    await userEvent.keyboard('/');
    expect(names()).toHaveLength(2);
    await userEvent.keyboard('{Escape}{Backspace}');
    menu.destroy();
    menu = createSlashMenu(editor, { builtIns: false });
    await userEvent.keyboard('/');
    expect(names()).toEqual([]);
  });

  it('offers the application’s own: text, HTML, or what it does, where they apply', async () => {
    const editor = await mount(['']);
    let ran = 0;
    menu = createSlashMenu(editor, {
      builtIns: false,
      commands: () => [
        { label: 'Firma', group: 'Empresa', text: 'Atentamente,\nLa dirección' },
        { label: 'Aviso', keywords: 'privacy', html: '<p><b>Aviso</b> de privacidad</p>' },
        { label: 'Contar', run: () => ran++ },
        { label: 'Nunca', when: () => false },
      ],
    });
    await userEvent.keyboard('/');
    expect(names()).toEqual(['Firma', 'Aviso', 'Contar']);
    expect([...document.querySelectorAll('.dx-sl-group')].map((node) => node.textContent)).toEqual(['Empresa', expect.any(String)]);
    await userEvent.keyboard('fir{Enter}');
    expect(texts(editor)).toEqual(['Atentamente,', 'La dirección']);
    await userEvent.keyboard('{Enter}/priv{Enter}');
    expect(texts(editor)[2]).toBe('Aviso de privacidad');
    expect(editor.doc.paragraphs[2].runs[0]).toMatchObject({ text: 'Aviso', props: { bold: true } });
    await userEvent.keyboard('{Enter}/contar{Enter}');
    expect(ran).toBe(1);
    expect(texts(editor).at(-1)).toBe('');
  });

  it('goes when the caret leaves the command', async () => {
    const editor = await mount(['uno', 'dos']);
    menu = createSlashMenu(editor);
    editor.setSelection({ para: 0, offset: 3 });
    await userEvent.keyboard(' /');
    expect(shown()).not.toBeNull();
    await userEvent.keyboard('{ArrowLeft}');
    expect(shown()).toBeNull();
    await userEvent.keyboard('{ArrowRight}');
    expect(shown()).toBeNull();
  });
});
