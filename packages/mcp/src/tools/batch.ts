// Several changes at once, all said in the numbers of one reading of the
// document: what an assistant reads once and wants to change in many places,
// without reading again after each paragraph it inserts or deletes.

import type { Paragraph, Position } from '@rebodocs/core/internal';
import { type Args, type Tool, type ToolResult, ToolError, fail } from './shared';

/** The tools an edit can be: those that change the text of the document by its paragraphs. */
export const BATCHED = [
  'replace_text',
  'rewrite_paragraph',
  'insert_paragraphs',
  'delete_paragraphs',
  'set_style',
  'set_list',
  'format_text',
  'format_paragraphs',
  'set_link',
  'add_note',
  'insert_page_break',
  'move_section',
  'set_cell_text',
  'renumber_clauses',
];

/** The arguments that are the number of a paragraph. */
const NUMBERS = ['paragraph', 'from', 'to', 'like_paragraph', 'to_paragraph', 'at_paragraph'];

const MAX_EDITS = 100;

/**
 * Where each paragraph of the document as it was is after a change: the same
 * place before what changed, moved by as many as were put in or taken out
 * after it, and -1 for one that is gone or that cannot be told apart.
 */
export function follow(before: Paragraph[], after: Paragraph[], at: number[]): number[] {
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head++;
  let tail = 0;
  while (tail < before.length - head && tail < after.length - head && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
  const end = before.length - tail;
  const delta = after.length - before.length;
  const changed = after.slice(head, after.length - tail);
  return at.map((now) => {
    if (now < 0 || now < head) return now;
    if (now >= end) return now + delta;
    // A paragraph that is still there, moved or not, is where it went; one written anew, where it was, when none came or went.
    const found = changed.indexOf(before[now]);
    if (found >= 0) return head + found;
    return delta === 0 ? now : -1;
  });
}

/** The arguments of an edit with the numbers of the paragraphs as they are now. */
function moved(given: Args, at: number[], length: number, edit: number): Args {
  const out: Args = { ...given };
  const now = (n: unknown, name: string): unknown => {
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > at.length) return n;
    if (at[n - 1] < 0) fail(`Edit ${edit}: paragraph ${n} ("${name}") was deleted or written over by an earlier edit. Nothing was changed.`);
    return at[n - 1] + 1;
  };
  for (const name of NUMBERS) if (name in out) out[name] = now(out[name], name);
  // A paragraph goes in before the one that came after, so that two put in after the same one stay in the order given.
  if (typeof out.after_paragraph === 'number' && Number.isInteger(out.after_paragraph) && out.after_paragraph >= 1 && out.after_paragraph <= at.length) {
    const next = at.slice(out.after_paragraph).find((place) => place >= 0);
    out.after_paragraph = next ?? length;
  }
  if (Array.isArray(out.paragraphs))
    out.paragraphs = out.paragraphs.map((item) => (item && typeof item === 'object' && 'like_paragraph' in item ? { ...item, like_paragraph: now(item.like_paragraph, 'like_paragraph') } : item));
  return out;
}

/** The tool that makes several edits, each by the tool `toolOf` gives for its name. */
export function editDocument(toolOf: (name: string) => Tool | undefined): Tool {
  return {
    name: 'edit_document',
    title: 'Several edits at once',
    description: `Makes several changes in one go, each as the tool it names would make it, and all of them or none. Every paragraph number in them is the one read_document showed before the first edit: the numbers do not move as the edits before insert or delete paragraphs, so there is no need to read again between them. A text to find is looked for as the document is when its edit comes. Each edit is an object with "tool" (${BATCHED.join(', ')}) and the arguments of that tool beside it. The text of the document only: for a header or a footer, use each tool alone with "area".`,
    properties: {
      edits: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_EDITS,
        description: 'The changes, in the order to make them.',
        items: {
          type: 'object',
          properties: { tool: { type: 'string', enum: BATCHED, description: 'The tool that makes this change. Its arguments go beside "tool".' } },
          required: ['tool'],
        },
      },
    },
    required: ['edits'],
    writes: true,
    run(doc, args, context) {
      const edits = Array.isArray(args.edits) && args.edits.length ? (args.edits as Args[]) : fail('"edits" must be a list of changes, each with "tool".');
      if (edits.length > MAX_EDITS) fail(`At most ${MAX_EDITS} edits at once.`);
      let now = doc;
      // Where each paragraph of the document as it was read is now.
      let at = doc.paragraphs.map((_, i) => i);
      let reveal: Position | undefined;
      const said = edits.map((edit, i) => {
        const { tool: name, ...given } = edit && typeof edit === 'object' ? edit : ({} as Args);
        if (typeof name !== 'string' || !BATCHED.includes(name)) fail(`Edit ${i + 1}: "tool" must be one of ${BATCHED.join(', ')}. Nothing was changed.`);
        if (given.area !== undefined && given.area !== null && given.area !== 'body')
          fail(`Edit ${i + 1}: edit_document changes the text of the document only. Use ${name} alone with "area". Nothing was changed.`);
        const { area: _, ...rest } = given;
        let result: ToolResult;
        try {
          result = toolOf(name as string)!.run(now, moved(rest, at, now.paragraphs.length, i + 1), context);
        } catch (error) {
          if (error instanceof ToolError) fail(`Edit ${i + 1} (${name}): ${error.message} Nothing was changed.`);
          throw error;
        }
        if (result.doc && result.doc !== now) {
          at = follow(now.paragraphs, result.doc.paragraphs, at);
          now = result.doc;
          reveal ??= result.reveal;
        }
        return `${i + 1}. ${result.text.split('\n')[0]}`;
      });
      const text = `Made ${edits.length} ${edits.length === 1 ? 'edit' : 'edits'}:\n${said.join('\n')}\nThe numbers of the paragraphs are those of the document as it is now: read it again before giving more.`;
      return now === doc ? { text } : { text, doc: now, reveal };
    },
  };
}
