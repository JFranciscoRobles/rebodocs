// What the page "AI assistants" says that is data. The tools themselves —
// their names, descriptions and arguments — are read from @rebodocs/mcp when
// the site is built; here is only how they are grouped, the five that are the
// server's own, and examples to run.

import type { Pastel } from '@/lib/home';

export interface ToolGroup {
  id: string;
  title: string;
  color: Pastel;
  tools: string[];
}

/** The tools of a document, by what they are for. Every tool of TOOLS is in one, which the page checks when it is built. */
export const TOOL_GROUPS: ToolGroup[] = [
  { id: 'reading', title: 'Reading', color: 'blue', tools: ['get_overview', 'read_document', 'read_formatting', 'find_text', 'list_links', 'list_notes', 'list_variables', 'compare_documents'] },
  { id: 'text', title: 'Text', color: 'yellow', tools: ['replace_text', 'rewrite_paragraph', 'insert_paragraphs', 'delete_paragraphs', 'set_style', 'set_list', 'set_link'] },
  { id: 'formatting', title: 'Formatting', color: 'pink', tools: ['format_text', 'format_paragraphs'] },
  { id: 'review', title: 'Comments and tracked changes', color: 'purple', tools: ['add_note', 'remove_note', 'track_changes', 'list_changes', 'accept_changes', 'reject_changes'] },
  { id: 'templates', title: 'Templates', color: 'green', tools: ['fill_variables'] },
  { id: 'objects', title: 'Tables and pictures', color: 'orange', tools: ['insert_table', 'edit_table', 'insert_signatures', 'insert_image', 'edit_image'] },
  {
    id: 'pages',
    title: 'Pages and columns',
    color: 'blue',
    tools: ['set_page_setup', 'set_letterhead', 'set_columns', 'insert_column_break', 'set_page_number', 'insert_page_break', 'insert_footnote', 'insert_text_box', 'insert_table_of_contents', 'update_table_of_contents'],
  },
];

/** Tools that read a file of the machine: the server runs them, a page cannot. */
export const NEEDS_A_FILE = new Set(['compare_documents', 'insert_image', 'set_letterhead']);

/** The server's own tools, about files and the editor: in packages/mcp/src/server.ts. */
export const FILE_TOOLS: { name: string; description: string; params: [name: string, type: string, required: boolean, text: string][] }[] = [
  {
    name: 'open_document',
    description: 'Opens a Word file (.docx) to read it and change it. It is kept in memory: nothing is written until save_document. Gives its overview.',
    params: [['path', 'string', true, 'The path of the .docx file.']],
  },
  { name: 'new_document', description: 'Starts an empty document, to write in and save. Gives it the path it will be saved to.', params: [['path', 'string', true, 'Where it will be saved: a path ending in .docx.']] },
  {
    name: 'save_document',
    description: 'Writes a document to a file: Word (.docx), PDF (.pdf) or Markdown (.md), by the ending of the path. A DOCX that was opened keeps everything that was not changed exactly as it was. It does not write over a file that is there unless "overwrite" is true.',
    params: [
      ['document', 'string', false, 'Which document: a path opened before, or "editor" for the one open in the browser.'],
      ['path', 'string', false, 'Where to write. Left out, the file the document was opened from.'],
      ['overwrite', 'boolean', false, 'Write over a file that is already there. False when left out.'],
    ],
  },
  { name: 'list_documents', description: 'The documents that can be worked on now: the files that are open, with whether each has changes not saved, and whether an editor is connected.', params: [] },
  { name: 'close_document', description: 'Forgets a file that is open, with any changes that were not saved.', params: [['path', 'string', true, 'The path of the file.']] },
];

/** Calls to try on the sample document, as an assistant would make them, in a sensible order. */
export const EXAMPLES: { label: string; tool: string; args: Record<string, unknown> }[] = [
  { label: 'What is in it?', tool: 'get_overview', args: {} },
  { label: 'Read it', tool: 'read_document', args: { from: 1, to: 8 } },
  { label: 'How it looks', tool: 'read_formatting', args: { from: 4, to: 4 } },
  { label: 'Find “deposit”', tool: 'find_text', args: { query: 'deposit' } },
  { label: 'Fill the template', tool: 'fill_variables', args: { values: { city: 'Lisbon', date: '20 October 2026', client: 'ana lópez', property: 'Rua Augusta 12' } } },
  { label: 'Replace a word', tool: 'replace_text', args: { find: 'deposit', replace: 'down payment', all: true } },
  { label: 'Track changes', tool: 'track_changes', args: { on: true } },
  { label: 'Comment', tool: 'add_note', args: { find: 'cancel in writing', note: 'Should we give a deadline?' } },
  {
    label: 'Translate, keeping the bold',
    tool: 'rewrite_paragraph',
    args: {
      paragraph: 10,
      segments: [{ text: 'Selecciona una palabra y ponla en ' }, { text: 'negrita', bold: true }, { text: ', ' }, { text: 'roja', color: 'C0392B' }, { text: ' o resáltala.' }],
    },
  },
  { label: 'Add one like it', tool: 'insert_paragraphs', args: { after_paragraph: 14, like_paragraph: 13, paragraphs: [{ text: 'Ask Claude to fill the template and translate it, keeping its look.' }] } },
  { label: 'Add a table', tool: 'insert_table', args: { after_paragraph: 4, header: true, rows: [['Item', 'Amount'], ['Deposit', '1,500 €'], ['Balance', '13,500 €']] } },
  { label: 'Bold', tool: 'format_text', args: { find: 'Terms', bold: true, color: 'C0392B' } },
];

/** The options of the server, from packages/mcp/src/main.ts. */
export const OPTIONS: [option: string, text: string][] = [
  ['--root DIR', 'A folder files may be read from and written to; several can be given. Give one: without, anywhere on the machine.'],
  ['--fonts DIR', 'A folder to look for fonts in before the system’s, to lay out and make PDFs.'],
  ['--port N', 'Where the editor in the browser connects. 7411 by default, or REBODOCS_MCP_PORT.'],
  ['--no-editor', 'Files only: do not listen for an editor.'],
  ['--origin URL', 'A page allowed to connect, besides localhost.'],
  ['--host ADDR', 'To listen for editors on other machines. A --token of 12 characters or more is then required, or REBODOCS_MCP_TOKEN.'],
  ['--editor-url URL', 'The address of your editor, told to the assistant when no editor is connected, so it can say where to open it.'],
];

export type Client = 'desktop' | 'code' | 'cursor';

export const CLIENTS: [Client, string, string][] = [
  ['desktop', 'Claude Desktop', '~/Library/Application Support/Claude/claude_desktop_config.json (on Windows, %APPDATA%\\Claude\\claude_desktop_config.json). Restart it after changing it.'],
  ['code', 'Claude Code', 'In the terminal, in your project.'],
  ['cursor', 'Cursor', '~/.cursor/mcp.json, or .cursor/mcp.json in a project.'],
];
