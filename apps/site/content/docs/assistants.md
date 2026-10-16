# AI assistants (MCP)

`@rebodocs/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server: what an assistant such as Claude Desktop, Claude Code or Cursor uses to read and change Word documents.

It is [on npm](https://www.npmjs.com/package/@rebodocs/mcp): `npx @rebodocs/mcp` runs the server, and `npm install @rebodocs/mcp` puts the tools, or Claude in a chat, in your application.

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
      "command": "npx",
      "args": ["-y", "@rebodocs/mcp", "--root", "/path/to/documents"]
    }
  }
}
```

It comes from [npm](https://www.npmjs.com/package/@rebodocs/mcp), with the engine as its dependency: there is nothing to clone. On a Mac with Node installed by nvm, Claude Desktop does not see the `npx` of your terminal: put its whole path in `command`, as `which npx` gives it. In Claude Desktop the configuration is `~/Library/Application Support/Claude/claude_desktop_config.json`; restart it after changing it.

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
| Reading | `get_overview`, `read_document`, `read_formatting`, `find_text`, `list_links`, `list_notes`, `list_variables` |
| Text | `replace_text`, `rewrite_paragraph`, `insert_paragraphs`, `delete_paragraphs`, `set_style`, `set_list`, `set_link` |
| Formatting | `format_text` (font, size, bold, italic, underline, strike, colour, highlight), `format_paragraphs` (alignment, indents, spacing, line spacing) |
| Comments | `add_note`, `remove_note` |
| Templates | `fill_variables` |
| Tables and pictures | `insert_table`, `edit_table`, `insert_signatures`, `insert_image`, `edit_image` |
| Pages and columns | `set_page_setup`, `set_columns`, `insert_column_break`, `set_page_number`, `insert_page_break`, `insert_table_of_contents`, `update_table_of_contents` |

Paragraphs are addressed by number, and each tool that changes text answers with what it did, so the assistant does not have to read the document again after every step.

## Keeping the look

An assistant sees the text by default, not how it looks. `read_formatting` tells it, paragraph by paragraph: the style, alignment, indents, spacing and line spacing, and each stretch of text with its font, size and marks. With that:

- `rewrite_paragraph` writes a paragraph anew, as in a translation, and keeps its alignment, indents and spacing and the font, size and colour most of its text had. Given in `segments`, the words that were bold or italic stay so.
- `insert_paragraphs` with `like_paragraph` makes new paragraphs that look like one that is there.
- `replace_text` keeps the look of the text it replaces.

`edit_table` also sets the height of a row, the heading rows that repeat on each page, where the text sits in its cells and the lines around them, and deletes a whole table.

## In your own application

The button above reaches a server on the person's machine. To have Claude in your application, for anyone who uses it, the page talks to your backend instead, and the backend to the Claude API: `npm run assistant` runs it ([the demo](/docs/demos/#claude-in-the-editor)).

`npm install @rebodocs/mcp` on the server. There, a route that takes the conversation to Claude, with your key:

```ts
import { assistantRoute } from '@rebodocs/mcp/claude';

// ANTHROPIC_API_KEY in the environment. Answers POST /api/assistant.
const assistant = assistantRoute({ allow: (request) => isSignedIn(request) });
http.createServer(async (request, response) => {
  if (await assistant(request, response)) return;
  // …the rest of your server
});
```

In the page, the conversation, on the editor:

```tsx
import { createAssistantChat } from '@rebodocs/react';

const chat = createAssistantChat(handle.editor, { onChange: redraw });
await chat.send('Translate the document into English, keeping its format.');
chat.entries; // what to show: the person, Claude, each tool it used
```

The answer comes as Claude writes it: the route sends a line of JSON for each piece of text and each tool it asks for, and the whole answer at the end, so the chat shows the words as they come. The page holds the conversation and runs the tools Claude asks for on the document it has open, so each change is a step to undo, and in a room the others see it. The server keeps nothing. It gives each address 40 steps a minute (`perMinute`), and asks Claude Opus 5.5 at medium effort unless given another `model` or `effort`.

## What to know

- Paragraph numbers shift after an insertion, so an assistant works best one edit at a time.
- There is no tool for the letterhead. The page setup changes the last section of the document.
- It speaks over standard input and output only.
- In a shared room an assistant works through the editor of the person who asked: the others see its changes as that person's, but not the conversation.
