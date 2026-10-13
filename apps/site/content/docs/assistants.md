# AI assistants (MCP)

`@rebodocs/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server: what an assistant such as Claude Desktop, Claude Code or Cursor uses to read and change Word documents.

It gives the assistant the operations a person has in the editor. "Fill this contract", "add a clause after the third one" or "turn this list into a table" are done on the real document, with its layout and formatting intact, and not on a copy of its text.

## Two kinds of document

**Files.** `open_document` reads a `.docx` into memory. The tools change it there, and nothing is written until `save_document`, which saves DOCX, PDF or Markdown by its extension. It does not overwrite an existing file unless told to. The editor does not have to be open.

**The open editor.** The "AI" button of the editor's status bar connects the page to the server on that machine, and the assistant works on the document the person is looking at. Each thing it does is one step to undo, and the view jumps to where it changed. The person switches it on. It does not connect by itself, and it does not remember between reloads.

## Set it up

In the configuration of your MCP client:

```json
{
  "mcpServers": {
    "rebodocs": {
      "command": "node",
      "args": ["/path/to/rebodocs/packages/mcp/bin/rebodocs-mcp.mjs", "--root", "/path/to/documents"]
    }
  }
}
```

| Option | What it is |
| --- | --- |
| `--root DIR` | A folder files may be read from and written to. Give it: without one, anywhere on the machine. |
| `--fonts DIR` | A folder to look for fonts in before the system's, to lay out and make PDFs. |
| `--port` | Where the editor in the browser connects. 7411 by default. |
| `--no-editor` | Files only: do not listen for an editor. |
| `--origin URL` | A page allowed to connect, besides `localhost`. |
| `--host`, `--token` | To listen for editors on other machines. A token of 12 characters or more is then required; put it in `REBODOCS_MCP_TOKEN`. |

To have the button in your own application:

```tsx
<DocsEditor features={{ assistant: true }} />
```

## Tools

| Group | Tools |
| --- | --- |
| Files | `open_document`, `save_document`, `list_documents` |
| Reading | `get_overview`, `read_document`, `find_text`, `list_links`, `list_notes`, `list_variables` |
| Text | `replace_text`, `insert_paragraphs`, `delete_paragraphs`, `format_text`, `set_style`, `set_list`, `set_link` |
| Comments | `add_note`, `remove_note` |
| Templates | `fill_variables` |
| Tables and pictures | `insert_table`, `edit_table`, `insert_signatures`, `insert_image`, `edit_image` |
| Pages | `set_page_number`, `insert_page_break`, `insert_table_of_contents`, `update_table_of_contents` |

Paragraphs are addressed by number, and each tool that changes text answers with what it did, so the assistant does not have to read the document again after every step.

## What to know

- Paragraph numbers shift after an insertion, so an assistant works best one edit at a time.
- There are no tools for the size and margins of the page, or for the letterhead.
- It speaks over standard input and output only.
- An assistant edits one person's editor. It cannot join a shared room as a participant.
