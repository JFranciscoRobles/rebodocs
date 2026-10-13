# @rebodocs/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for DOCX
documents: what an AI assistant (Claude Desktop, Claude Code, Cursor…) uses
to read and change them.

## Purpose

To give an assistant the same operations a person has in the editor, as
tools, so that "fill this contract", "add a clause after the third one" or
"turn these into a table" are done on the real document, with its layout and
formatting intact, instead of on a copy of its text.

## Two kinds of document, the same tools

- **Files.** `open_document` reads a `.docx` into memory; the tools change it
  there; nothing is written until `save_document`, which saves DOCX, PDF or
  Markdown by extension and does not overwrite an existing file unless told
  to. The editor does not have to be open.
- **The open editor.** With the "AI" button of the editor's status bar the
  page connects to the server on this machine, and the assistant works on the
  document the person is looking at. Each thing it does is one step to undo,
  and the view jumps to where it changed. The person switches it on; it does
  not connect by itself or remember between reloads.

## Tools

| Group | Tools |
| --- | --- |
| Reading | `get_overview`, `read_document`, `find_text`, `list_links`, `list_notes`, `list_variables` |
| Text | `replace_text`, `insert_paragraphs`, `delete_paragraphs`, `format_text`, `set_style`, `set_list`, `set_link` |
| Notes | `add_note`, `remove_note` |
| Templates | `fill_variables` |
| Tables and pictures | `insert_table`, `edit_table`, `insert_signatures`, `insert_image`, `edit_image` |
| Pages | `set_page_number`, `insert_page_break`, `insert_table_of_contents`, `update_table_of_contents` |
| Files | `open_document`, `save_document`, `list_documents` |

## Running it

```bash
npm run mcp -- --root ~/Documents/contracts --fonts ~/Library/Fonts
```

In the configuration of an MCP client:

```json
{
  "mcpServers": {
    "rebodocs": { "command": "node", "args": ["/path/to/packages/mcp/bin/rebodocs-mcp.mjs", "--root", "/path/to/documents"] }
  }
}
```

| Option | What it is |
| --- | --- |
| `--root DIR` | Folders files may be read from and written to. Without one, anywhere. |
| `--fonts DIR` | Folders to look for fonts in before the system's, to lay out and make PDFs. |
| `--port` | Where the editor in the browser connects; 7411. `--no-editor` to not listen. |
| `--origin URL` | Pages allowed to connect, besides `localhost`. |
| `--host`, `--token` | To listen for editors on other machines; a token of 12 characters or more is then required (`REBODOCS_MCP_TOKEN`). |

## How it works

The tools are functions over `@rebodocs/core` documents (`tools.ts`), so they are
the same whether the document is a file held by the server or the one in a
browser tab. For the tab, the server sends the call over a local bridge and
the page runs the same function on its editor (`browser.ts`).

Paragraphs are addressed by number, and every tool that changes text answers
with what it did, so the assistant does not have to read the document again
after each step.

## Where it can improve

- **Addressing by paragraph number is fragile.** After an insertion every
  later number shifts. Stable ids (the collaboration package already gives
  paragraphs one) would let an assistant plan several edits at once.
- **Page setup and letterhead.** There are tools for the text, also of the
  header and the footer, but none for the size and margins of the page or
  for its letterhead.
- **Reading long documents.** `read_document` returns text by range. A
  search by meaning, or summaries per heading, would cost an assistant fewer
  calls.
- **One transport.** Standard input and output only. Streamable HTTP would
  let a hosted assistant use it.
- **Remote editors** are possible (`--host`, `--token`) but were only tried
  on one machine.
- **Not connected to collaboration.** An assistant cannot join a shared room
  as a participant; it edits one person's tab.
- **Tests** cover the tools; the bridge to the browser was checked by hand.
