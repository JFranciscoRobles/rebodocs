# @rebodocs/mcp

[npm](https://www.npmjs.com/package/@rebodocs/mcp) · `npx @rebodocs/mcp`

A [Model Context Protocol](https://modelcontextprotocol.io) server for DOCX
documents: what an AI assistant (Claude Desktop, Claude Code, Cursor…) uses
to read and change them.

## Purpose

To give an assistant the same operations a person has in the editor, as
tools, so that "fill this contract", "add a clause after the third one" or
"turn these into a table" are done on the real document, with its layout and
formatting intact, instead of on a copy of its text.

## Three ways in, the same tools

- **Files.** `open_document` reads a `.docx` into memory; the tools change it
  there; nothing is written until `save_document`, which saves DOCX, PDF or
  Markdown by extension and does not overwrite an existing file unless told
  to. The editor does not have to be open.
- **The open editor.** With the "AI" button of the editor's status bar the
  page connects to the server on this machine, and the assistant works on the
  document the person is looking at. Each thing it does is one step to undo,
  and the view jumps to where it changed. The person switches it on; it does
  not connect by itself or remember between reloads.
- **Claude in your application.** No server on the person's machine: a chat
  in the page talks to your backend, and your backend to the Claude API with
  your key. `assistantRoute` (`@rebodocs/mcp/claude`, `src/claude.ts`) is the
  route of the backend: it takes the conversation to Claude and sends the
  answer back as it is written, a line of JSON at a time. `createAssistantChat`
  (`src/chat.ts`, also in `@rebodocs/react`) is the conversation in the page:
  it runs the tools Claude asks for on the editor and sends back the results.
  `apps/assistant` is the demo.

## Tools

| Group | Tools |
| --- | --- |
| Reading | `get_overview`, `read_document`, `read_formatting`, `find_text`, `list_links`, `list_notes`, `list_variables` |
| Text | `replace_text`, `rewrite_paragraph`, `insert_paragraphs`, `delete_paragraphs`, `set_style`, `set_list`, `set_link` |
| Formatting | `format_text` (font, size, marks, colour), `format_paragraphs` (alignment, indents, spacing) |
| Notes | `add_note`, `remove_note` |
| Templates | `fill_variables` |
| Tables and pictures | `insert_table`, `edit_table`, `insert_signatures`, `insert_image`, `edit_image` |
| Pages and columns | `set_page_setup`, `set_columns`, `insert_column_break`, `set_page_number`, `insert_page_break`, `insert_table_of_contents`, `update_table_of_contents` |

`read_formatting` says how each paragraph and each stretch of its text looks.
With it an assistant keeps the look of what it changes: `rewrite_paragraph`
writes a paragraph anew (a translation, say) in the look it had, its bold
words given as `segments`, and `insert_paragraphs` with `like_paragraph` makes
new ones like one that is there. `edit_table` also sets row heights, heading
rows, where the text sits in the cells and the lines around them.
| Files | `open_document`, `save_document`, `list_documents` |

## Running it

From npm, with nothing to clone: its command is `rebodocs-mcp`, and npm
brings the engine, `@rebodocs/core`, with it.

```bash
npx @rebodocs/mcp --root ~/Documents/contracts --fonts ~/Library/Fonts
```

In the configuration of an MCP client:

```json
{
  "mcpServers": {
    "rebodocs": { "command": "npx", "args": ["-y", "@rebodocs/mcp", "--root", "/path/to/documents"] }
  }
}
```

With Node installed by nvm, Claude Desktop does not see the `npx` of your
terminal: put its whole path in `command` (`which npx`).

From this repository, the same server from its sources: `npm run mcp -- …`,
or `node packages/mcp/bin/rebodocs-mcp.mjs …` in a client's configuration.

## In your application

```bash
npm install @rebodocs/mcp
```

| Import | What it is | Where it runs |
| --- | --- | --- |
| `@rebodocs/mcp` | The tools: `TOOLS`, `runTool(doc, name, args)`. | Anywhere |
| `@rebodocs/mcp/claude` | `assistantRoute()`: the route of your backend that takes a chat to the Claude API with your key. | Node |
| `@rebodocs/mcp/browser` | `createAssistantChat(editor)` and the editor's side of the MCP server. Also in `@rebodocs/react`. | Browser |

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

## Building and publishing

As every package but `@rebodocs/react`, from the root of the repository:

```bash
npm run build:packages              # packages/<name>/dist is each package
npm publish ./packages/core/dist    # the engine first: the others ask for it
npm publish ./packages/mcp/dist
```

`dist/` has a package.json of its own, written by `tools/package.mjs`: the
one beside the sources stays the one the repository uses, which points at
them.

## Where it can improve

- **Addressing by paragraph number is fragile.** After an insertion every
  later number shifts. Stable ids (the collaboration package already gives
  paragraphs one) would let an assistant plan several edits at once.
- **Letterhead and sections.** There is no tool for the letterhead, and the
  page setup changes the last section only.
- **Mixed formatting in a rewrite.** `rewrite_paragraph` keeps the look most
  of the paragraph had; anything else has to be given back in `segments`.
- **Reading long documents.** `read_document` returns text by range. A
  search by meaning, or summaries per heading, would cost an assistant fewer
  calls.
- **One transport.** Standard input and output only. Streamable HTTP would
  let a hosted assistant use it.
- **Remote editors** are possible (`--host`, `--token`) but were only tried
  on one machine.
- **In a shared room, through one person.** An assistant does not join a
  room by itself: it works in the editor of the person who asked, and the
  others see its changes as that person's. They do not see the conversation.
- **Tests** cover the tools and the chat against a Claude of their own; the
  bridge to the browser was checked by hand, and the chat has not been run
  against the real API in the repository's tests.
