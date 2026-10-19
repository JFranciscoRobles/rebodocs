# Demos to run

Six applications in the repository use the packages the way yours would. Each is small, and is there to be read and copied from.

```bash
git clone https://github.com/JFranciscoRobles/rebodocs && cd rebodocs && npm install
```

| Demo | Run it | What it shows |
| --- | --- | --- |
| [The React package](#the-react-package) | `npm run demo`, or [online](/demo/) | The editor as it comes, and an interface built from nothing on the hooks. |
| [An S3 bucket](#an-s3-bucket) | `npm run storage` | Documents kept in Cloudflare R2, AWS S3 or MinIO: open, save, and a PDF made on the server. |
| [Real time](#real-time) | `npm run realtime` | Several people on one document at once, through a backend of your own. |
| [Claude in the editor](#claude-in-the-editor) | `npm run assistant` | A chat beside a shared document that reads and changes it, keeping its look. |
| [The desktop](#the-desktop) | `npm run desktop` | A desktop application with Tauri: `.docx` files of the disk, a native menu, PDF. |
| [The playground](#the-playground) | `npm run dev` | Everything wired together without a framework. |

## The React package

`apps/demo`, at `http://localhost:5175`, and on this site at [/demo](/demo/), which takes the whole window. The same document in two tabs:

- **The included one.** `DocsEditor`: the whole editor in a dozen lines.
- **Your own interface.** A toolbar, a rail, panels, a find bar, a ruler and a status bar built on `DocsProvider`, `DocsSurface` and the hooks. It does everything the first does.

The selector in its status bar changes the language of both what the library draws and the demo's own labels: they are in a table of its own, `src/headless/texts.ts`, which follows the language of the editor. [Languages](/docs/languages/#your-own-interface) says how.

Nothing to set up, and no backend: saving hands the file back as a download. [A complete interface](/docs/example/) walks through it, piece by piece.

## An S3 bucket

`apps/storage`, at `http://localhost:5176`. It needs a bucket of your own and its keys in `apps/storage/.env`.

- The list of the `.docx` and `.pdf` in the bucket.
- Opening and saving with addresses signed for a few minutes: the browser reads from and writes to the bucket itself, and never has a key.
- **PDF on the server…**: the server fills the variables of a template, lays it out with font files and stores the PDF beside it.

[Documents in an S3 bucket](/docs/storage/) has every step for Cloudflare R2, what changes for another S3, and the code to copy.

## Real time

`apps/realtime`, at `http://localhost:5177`. Nothing to set up: the documents are kept in a folder, or in a bucket when its `.env` names one.

- **Every document is a room.** There is no other way to open one.
- **A room is there only while someone is in it.** It opens when the first person comes in, and a moment after the last one leaves the document is saved and the room is let go of. The list says which rooms are open, and who is in each.
- **The collaboration server keeps nothing.** A backend gives it the document, takes it back, and says who may come in, with a signed ticket for each person.
- **A version of each session.** When everybody has left a document they changed, the backend keeps a version, signed by who changed it. The **Versions** tab of the side panel lists them, compares the document with one, goes back to one, and keeps one by hand. They are kept under `versions/`, as the storage demo keeps them.

Open a document, press **Copy link** and open the link in another window. [Real-time collaboration](/docs/collaboration/#a-demo-to-run) explains each part.

## Claude in the editor

`apps/assistant`, at `http://localhost:5179`. The real-time demo with a chat beside the document. It needs a key of the Claude API in `apps/assistant/.env`; the documents are kept in a folder, or in a bucket as in the storage demo.

- **Ask for something to be done**: "translate it into English keeping the format", "put the obligations in two columns", "make the table repeat its heading row". Claude reads the document, does it with the same tools the MCP server has, and says what it did.
- **What it does is yours**: each change is a step to undo and, in a room, the others see it happen.
- **The key stays on the server.** The page sends the conversation to its backend, which takes it to the Claude API; the tools run in the page.

[AI assistants](/docs/assistants/#in-your-own-application) has the code to put it in an application.

## The desktop

`apps/desktop`, a window of its own made with [Tauri](https://tauri.app). It needs Rust (`rustup`, from [rustup.rs](https://rustup.rs)); the first `npm run desktop` compiles for a few minutes.

- **Each window is a document**, a `.docx` file of the disk. Open, Save and Save as use the dialogs of the system, and closing a window with changes asks first.
- **A native menu**: File, Edit, View, with the usual keys. Edit has **Paste as text**.
- **Export as PDF** to a file of the disk, and the other exports of the side menu.
- **Documents from the system**: dropped on the window, or opened with a double click in the Finder or the Explorer once the application is built (`npm run build:desktop`).

The pages are the editor without a framework, as in the playground; what Rust adds is small, in `src-tauri/src/lib.rs`: reading and writing files, a window per document, and the documents the system asks to open.

## The playground

`apps/playground`, at `http://localhost:5173`. The page every package is tried in while it is written: the editor with no framework, collaboration started from the **Share** button, the MCP server for an assistant. Its `src/main.ts` is the shortest example of everything wired together.

## What they have in common

- **They take the packages from their source**, so a change in a package shows at once. Copied into a project of your own that installs `@rebodocs/react` from npm (and `@rebodocs/mcp`, for the one with Claude), they work without the alias in `vite.config.ts`.
- **They are made to run on your own machine.** The three with a backend check nobody: where an application decides who may do what is marked in their code. The one with Claude spends from your API key, a few steps a minute for each address.
- **Each has a README** that says what is where, and where it can improve.
