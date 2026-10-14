# Demos to run

Four applications in the repository use the packages the way yours would. Each is small, and is there to be read and copied from.

```bash
git clone https://github.com/JFranciscoRobles/rebodocs && cd rebodocs && npm install
```

| Demo | Run it | What it shows |
| --- | --- | --- |
| [The React package](#the-react-package) | `npm run demo`, or [online](/demo/) | The editor as it comes, and an interface built from nothing on the hooks. |
| [An S3 bucket](#an-s3-bucket) | `npm run storage` | Documents kept in Cloudflare R2, AWS S3 or MinIO: open, save, and a PDF made on the server. |
| [Real time](#real-time) | `npm run realtime` | Several people on one document at once, through a backend of your own. |
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

Open a document, press **Copy link** and open the link in another window. [Real-time collaboration](/docs/collaboration/#a-demo-to-run) explains each part.

## The playground

`apps/playground`, at `http://localhost:5173`. The page every package is tried in while it is written: the editor with no framework, collaboration started from the **Share** button, the MCP server for an assistant. Its `src/main.ts` is the shortest example of everything wired together.

## What they have in common

- **They take the packages from their source**, so a change in a package shows at once. Copied into a project of your own that installs `@rebodocs/react` from npm, they work without the alias in `vite.config.ts`.
- **They are made to run on your own machine.** The two with a backend check nobody: where an application decides who may do what is marked in their code.
- **Each has a README** that says what is where, and where it can improve.
