# Packages

Five packages, each for one thing, and a test application.

```
@rebodocs/core  ◄──  @rebodocs/editor  ◄──  @rebodocs/react
      ▲                     ▲                      │
      ├── @rebodocs/collab ─┴──────────────────────┘
      └── @rebodocs/mcp
```

| Package | Runs in | Depends on |
| --- | --- | --- |
| `@rebodocs/core` | Browser, Node | `fflate` |
| `@rebodocs/editor` | Browser | core |
| `@rebodocs/react` | Browser (safe to render on a server) | editor, core, collab; React 18+ as a peer |
| `@rebodocs/collab` | Node (server), browser (client) | core |
| `@rebodocs/mcp` | Node | core |

Each has a README in the repository with what it is for, how it works, and a list of where it can improve.

## @rebodocs/core

The engine. Everything about a document that does not need a screen.

- **Model:** an immutable `Doc` of paragraphs, runs, tables, header and footer, styles, numbering, comments and media.
- **Operations:** pure functions, `(doc, …) => doc`, for every edit.
- **DOCX:** `importDocx` and `exportDocx`, keeping what is not understood.
- **Layout:** `layoutDocument` breaks paragraphs into lines and lines into pages; hit testing, caret and selection rectangles.
- **Output:** `renderPdf`, `exportMarkdown`.
- **Templates:** `variableNames`, `fillVariables`.

Take it when you generate or transform documents in code. See [On a server](/docs/server/).

## @rebodocs/editor

The editor in the browser, with no framework: the `Editor` class (pages, caret, selection, history, keyboard, mouse, touch) and separate interface pieces (toolbar, menu, panel, status bar, ruler, find bar, selection bubble), plus languages and fonts.

Take it for a page without React, or to build on its pieces. See [Without a framework](/docs/vanilla/).

## @rebodocs/react

On npm: [`@rebodocs/react`](https://www.npmjs.com/package/@rebodocs/react) and [`@rebodocs/mcp`](https://www.npmjs.com/package/@rebodocs/mcp).

`DocsEditor`, the whole editor as a component; `DocsProvider`, `DocsSurface` and hooks, to draw your own interface; and `mountDocs`, the whole editor with no React in it. It is the one package built as a bundle, with the others inside.

Take it for a React or Next.js application. See [React component](/docs/react/) and [Headless](/docs/headless/).

## @rebodocs/collab

The change format (operations addressed by paragraph id, and how concurrent ones are reconciled), the room server, and the client the editor uses.

Take it when several people must edit at once. See [Real-time collaboration](/docs/collaboration/).

## @rebodocs/mcp

A Model Context Protocol server whose tools are the editor's operations, over files or over the document open in a browser. It also has the route of a backend that takes a chat in the page to the Claude API (`@rebodocs/mcp/claude`); the chat itself is in `@rebodocs/react`.

Take it to let an assistant work on documents, from a client such as Claude Desktop or inside your application. See [AI assistants](/docs/assistants/).

## The applications

Besides the packages, the repository has small applications that use them. See [Demos to run](/docs/demos/).

| | |
| --- | --- |
| `apps/playground` | The page every package is tried in: `npm run dev`. Its `src/main.ts` is the shortest example of everything wired together. |
| `apps/demo` | `@rebodocs/react` as an application uses it: the whole editor, and an interface of its own on the hooks. |
| `apps/storage` | Documents in an S3 bucket: open, save, and a PDF made on the server. |
| `apps/realtime` | Several people on one document, through a backend with its three routes and signed tickets. |
| `apps/site` | This website. |
