<h1 align="center">@rebodocs/mcp</h1>

<p align="center">
  A <a href="https://modelcontextprotocol.io">Model Context Protocol</a> server for Word documents: AI assistants read and edit real DOCX files, keeping their layout and formatting.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rebodocs/mcp"><img src="https://img.shields.io/npm/v/@rebodocs/mcp?label=npm&color=0b57d0" alt="npm version"></a>
  <a href="https://github.com/JFranciscoRobles/rebodocs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-2e6b3c" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/tools-51-0b57d0" alt="51 tools">
</p>

<p align="center">
  <a href="https://rebodocs.com/docs/assistants/">Documentation</a> ·
  <a href="https://rebodocs.com/docs/assistants/#tools">Every tool</a> ·
  <a href="https://github.com/JFranciscoRobles/rebodocs/tree/main/apps/assistant">Chat example</a>
</p>

---

"Fill this contract", "add a clause after the third one", "turn these lines
into a table": done on the document itself, by the same engine as the
editor, instead of on a copy of its text. Works with Claude Desktop, Claude
Code, Cursor and any other MCP client.

## Quick start

```json
{
  "mcpServers": {
    "rebodocs": { "command": "npx", "args": ["-y", "@rebodocs/mcp", "--root", "/path/to/documents"] }
  }
}
```

With Node installed through nvm, Claude Desktop may not find `npx`: put the
full path from `which npx` in `command`.

For a client that connects to a server instead of starting one, or one on
another machine, the server listens over HTTP (the protocol's Streamable
HTTP), a session for each client:

```bash
npx -y @rebodocs/mcp --root /path/to/documents --http 7412
claude mcp add --transport http rebodocs http://127.0.0.1:7412/mcp
```

## Three ways in, the same tools

- **Files.** `open_document` reads a `.docx`; nothing is written until
  `save_document`, which saves DOCX, PDF or Markdown and does not overwrite a
  file unless told to.
- **The editor open in the browser.** The person presses "AI" in the
  editor's status bar, and the assistant works on the document they are
  looking at: each change is one step to undo.
- **Claude in your application.** A chat in the page (`createAssistantChat`,
  also in `@rebodocs/react`) runs the tools on the editor; your backend takes
  it to the Claude API with your key (`assistantHandler` for Next.js and other
  servers of Request and Response, `assistantRoute` for Node's own, from
  `@rebodocs/mcp/claude`). The key never reaches the browser.

## Tools

| Area | Tools |
| --- | --- |
| Files | `open_document`, `new_document`, `save_document`, `undo`, `list_documents`, `close_document` |
| Reading | `get_overview`, `read_document`, `read_formatting`, `read_pages`, `find_text`, `compare_documents`, `list_links`, `list_notes` |
| Text | `replace_text`, `rewrite_paragraph`, `insert_paragraphs`, `delete_paragraphs`, `edit_document` |
| Clauses | `move_section`, `renumber_clauses` |
| Formatting | `set_style`, `set_list`, `format_text`, `format_paragraphs`, `set_link` |
| Review | `add_note`, `remove_note`, `track_changes`, `list_changes`, `accept_changes`, `reject_changes` |
| Templates | `list_variables`, `fill_variables` |
| Tables and pictures | `insert_table`, `edit_table`, `set_cell_text`, `insert_signatures`, `insert_image`, `edit_image` |
| Pages | `set_page_setup`, `set_letterhead`, `set_columns`, `insert_column_break`, `set_page_number`, `insert_page_break`, `insert_footnote`, `insert_endnote`, `insert_text_box`, `insert_table_of_contents`, `update_table_of_contents` |

`read_formatting` tells an assistant how each paragraph looks, so that
`rewrite_paragraph` and `insert_paragraphs` keep that look.

### For contracts

| Tool | What it does |
| --- | --- |
| `edit_document` | Several changes in one call, all or none, every paragraph number in them taken from one reading: no reading again after each insertion. |
| `renumber_clauses` | Puts in order the numbers written in the headings ("Primera.", "CLÁUSULA 3.", "IV."), each as it was written, and lists where the text names a clause by a number that changed. |
| `move_section` | Moves a heading with everything under it, as dragging it in the outline does. |
| `set_cell_text` | Writes a cell by its table, row and cell, empty or not. |
| `read_pages` | How the text falls on the pages: a paragraph cut by a page, a heading left at the foot of one, a last page of a line, a table over two pages. |
| `edit_table` `keep_together` | A block of signatures whole on one page, moving only when it does not fit; `keep_lines_together` and `keep_with_next` in `format_paragraphs` for paragraphs. |
| `undo` | Goes back from the last changes to a file, up to 50. |

### What a client is told

Each tool has a `title`, and says whether it only reads (`readOnlyHint`) and
whether doing it again changes more (`idempotentHint`), so a client can let
the reading ones run without asking. What the tools change stays in memory,
or is a step to undo in the editor. `save_document` and `close_document` are
the ones marked as able to lose work (`destructiveHint`); `open_document` on
a file that is already open with changes reads it again, and says that they
are gone.

## Options

| Option | Description |
| --- | --- |
| `--root DIR` | Folders files may be read from and written to. Without one, anywhere. |
| `--fonts DIR` | Folders searched for fonts before the system's, for layout and PDF. |
| `--port`, `--no-editor` | Where the browser editor connects (7411), or not listening for it. |
| `--origin URL` | Pages allowed to connect, besides `localhost`. |
| `--host`, `--token` | Listen for editors (and, with `--http`, clients) on other machines; a token of 12+ characters is then required (`REBODOCS_MCP_TOKEN`). |
| `--http PORT` | Streamable HTTP at `http://127.0.0.1:PORT/mcp` instead of standard input and output: a session for each client, `Authorization: Bearer <token>` when there is a token. |
| `--timeout SECONDS` | How long to wait for the editor to answer a tool (30). |

## Filling templates from the command line

```bash
npx -p @rebodocs/mcp rebodocs-generate template.docx data.json -o out.pdf [--fonts ./fonts] [--locale en-US] [--currency EUR]
npx -p @rebodocs/mcp rebodocs-generate template.docx --list
```

Nested objects fill dotted names (`{{client.name}}`), and a list fills a
block (`{{#lines}} … {{/lines}}`): a table row, paragraphs or text, once per
item.

## In your code

| Import | What it is | Runs in |
| --- | --- | --- |
| `@rebodocs/mcp` | The tools: `TOOLS`, `runTool(doc, name, args)`. | Anywhere |
| `@rebodocs/mcp/claude` | `assistantHandler()` (Request → Response) and `assistantRoute()` (Node's `http`): the backend of the chat, to the Claude API. | Server |
| `@rebodocs/mcp/browser` | `createAssistantChat(editor)` and the editor's side of the bridge. | Browser |

### The backend of the chat

```ts
// app/api/assistant/route.ts, in Next.js. ANTHROPIC_API_KEY in the environment.
import { assistantHandler } from '@rebodocs/mcp/claude';

export const POST = assistantHandler({
  allow: async (request) => !!(await sessionOf(request)),   // who may ask
  key: async (request) => (await sessionOf(request))!.userId, // perMinute (40) counts per user
  context: async (request) => `The adviser is ${(await sessionOf(request))!.name}.`, // told to Claude after its instructions
  // toolSearch: true,  // Claude searches for the tools of tables, pages and review when it needs one
});
```

Without `key`, a user is told apart by the address the request comes from:
behind a proxy that is the proxy's, the same for everyone.

## Evaluating the assistant

`npm run eval:assistant` (in the repository) runs nineteen cases through the
chat and the route as they ship, against the Claude API, and checks the
document each leaves: filling a template, putting a clause in its place,
tracking a change, reviewing without changing the text, saying so when what
is asked is not there; and, harder, one clause of 45, five changes at once,
the header and the footer, a numbered list, two people's tracked changes, the
rows of a table and signatures cut by a page. It costs money: see
`tools/assistant-eval/run.ts`. With `--claude-code` it runs through Claude
Code and the MCP server instead, on the plan of whoever is signed in.

## Limits

- Paragraphs are addressed by number, which shifts after an insertion: the tools answer with what changed, and `edit_document` takes several edits in the numbers of one reading.
- `read_pages` tells the pages in words: there is no picture of a page.
- A cancelled call stops the server waiting for the editor; what the editor already did stays, as a step to undo.
- In a shared room, an assistant works through the editor of the person who asked.

## Status

0.13: ready to try in production; the API may change before 1.0. See the
[changelog](https://github.com/JFranciscoRobles/rebodocs/blob/main/CHANGELOG.md).

## License

[MIT](https://github.com/JFranciscoRobles/rebodocs/blob/main/LICENSE). `@anthropic-ai/sdk` (MIT) is installed as a dependency.
