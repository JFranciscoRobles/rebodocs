# @rebodocs/collab

[npm](https://www.npmjs.com/package/@rebodocs/collab) · `npx @rebodocs/collab --backend https://…`

Several people on the same document at once, each seeing where the others
are: the format changes travel in, the server that orders them, and the
client the editor uses.

## Purpose

To let an application add live collaboration without the collaboration
server becoming the place documents live. The server coordinates; the
application's own backend keeps the files and decides who may open them.

## What is in it

| Part | File | What it does |
| --- | --- | --- |
| Changes | `changes.ts` | The difference between two documents as a list of operations addressed by paragraph id; applying them; transforming one against another so that everyone ends with the same document. Headers, footers, footnotes and text boxes go the same way; tracked changes travel as part of the formatting of their text. |
| Server | `server.ts`, `storage.ts`, `main.ts` (`@rebodocs/collab/server`, `/storage`, the command `rebodocs-collab`) | One room per document: the base file and an ordered log of changes. Node's `http` only, and the engine. |
| Client | `session.ts` (`@rebodocs/collab/browser`) | Joins a room for an `Editor`: sends its changes, applies the others', shows their carets, undoes only this person's steps, reconnects. |

## Running the server

```bash
npx @rebodocs/collab --backend https://my-app.example/api/docs
```

From this repository, `npm run collab -- …` runs the same server from its
sources. In a Node program of your own:

```ts
import { createCollabServer } from '@rebodocs/collab/server';
import { backendStorage } from '@rebodocs/collab/storage';

const server = createCollabServer({ port: 7420, storage: backendStorage({ url: 'https://my-app.example/api/docs', key: process.env.KEY }) });
```

Without `port` it listens on none: mount it in the server your API already
has, and give it a `RoomStorage` of your own that calls your services straight.

```ts
const collab = createCollabServer({ storage: myStorage });
app.use('/collab', collab.handle);   // Express, or Nest's main.ts
```

| Option | Environment | What it is |
| --- | --- | --- |
| `--port` | `REBODOCS_COLLAB_PORT` | Port; 7420 by default. |
| `--host` | | Address to listen on. |
| `--backend URL` | `REBODOCS_COLLAB_BACKEND` | Where documents are read from and saved to: the application's backend. |
| `--backend-key` | `REBODOCS_COLLAB_BACKEND_KEY` | Sent to it as `Authorization: Bearer …`. Use the environment variable. |
| `--save-every N` | | Seconds between saves while a room has changes; 30. |
| `--data DIR` | | Keep rooms in a folder instead (for trying it out). |
| `--memory` | | Keep nothing. |
| `--token` | `REBODOCS_COLLAB_TOKEN` | A word people must give to create rooms, without a backend. |
| `--static DIR` | | Also serve a built editor from the same address. |

### With a backend (recommended)

The server holds a room in memory while people are in it and forgets it when
it empties. The backend has three routes, and it alone talks to storage (S3,
R2, a disk):

| Route | When | What it does |
| --- | --- | --- |
| `GET  URL/<id>` | Someone opens a room nobody is in. | Returns the DOCX. |
| `PUT  URL/<id>` | Every `--save-every` seconds with changes, when the room empties, on shutdown. | Stores the DOCX. The one when the room empties, if anybody changed it, has `X-Rebodocs-Session-End: 1` and `X-Rebodocs-Authors` (who changed it, each name URL-encoded, separated by commas): when to keep a version. |
| `POST URL/<id>/access` | Someone joins. Body: `{ "ticket": "…" }`. | Says whether they may, and as whom: `{ "name": "Ana" }`, or 403. |

The application gives each person a ticket (a signed, short-lived token of
its own making) and the editor passes it on:

```tsx
<DocsEditor collab={{ url: 'https://collab.example', room: documentId, ticket }} />
```

No storage credentials ever reach the browser or the collaboration server.

[`apps/realtime`](../../apps/realtime) is a backend like that to run and to
copy from: the three routes over a folder or an S3 bucket, tickets signed
with a secret, and the page. `npm run realtime`.

### From code

`main.ts` is a thin wrapper. A Node process of your own starts the same
server:

```ts
import { createCollabServer } from './src/server';
import { backendStorage } from './src/storage';

const server = createCollabServer({
  port: 7420,
  storage: backendStorage({ url: 'https://my-app.example/api/docs', key: process.env.BACKEND_KEY }),
  saveEvery: 30_000,   // how often a room people are in is given to the backend
  idle: 30_000,        // how long a room nobody is in waits before it is given back and let go of
});
await server.ready;

server.rooms();        // [{ id: 'contract-17', people: ['Ana', 'Luis'] }]: the rooms it holds now
await server.flush();  // give the backend what it does not have yet, before leaving
server.close();
```

## How it works

- **Paragraphs have ids.** A change says "in paragraph `k3`, at offset 12,
  insert `x`", so it still means the same thing after someone else added a
  paragraph above.
- **One order for everyone.** The server puts incoming changes in a single
  sequence, rebasing each against the ones it had not seen. Clients apply
  their own changes at once and rebase them when the server's order arrives.
- **Server-sent events down, POST up.** No WebSocket, so it passes through
  ordinary proxies.
- **Undo is per person.** Undoing sends the inverse of your own step,
  transformed against what the others did since.

## Where it can improve

- **It has only run on one machine.** Two tabs, and two browsers on a LAN.
  A backend with its three routes has tests with two people typing through
  it, and one over Cloudflare R2 was joined by hand. Different networks,
  HTTPS behind a proxy, and two browsers over a real bucket are untried.
- **One process per room.** Rooms live in the memory of one server. Running
  several needs a shared log (Redis, a database) or routing by room.
- **Permissions are checked on joining only.** Someone whose access is
  revoked stays until they disconnect. The ticket should be checked again
  periodically, and there is no read-only role.
- **A hard crash loses up to `--save-every` seconds.** The log should be
  written somewhere durable as it grows.
- **Convergence is tested, not proven, and checked.** The transform has unit
  tests for pairs of concurrent edits, and `test/convergence.test.ts` has two
  people edit at random from 3,000 seeds, all of which end with the same
  document; with 20,000 seeds and three edits each, 6 do not. So the server
  sends each room a digest of its document a moment after the changes stop
  (`checkAfter`), and an editor whose document differs loads the room again,
  keeping what was typed and not sent, but not what can be undone. Tables are
  not in the random edits, and concurrent edits to the structure of the same
  table are the weakest part. More clients than two are untried.
- **History is the application's.** The server keeps no versions: the
  editor compares and restores the ones the application keeps (`versions`),
  and tracked changes say who changed what. A room does not keep a version
  of its own when it empties.
- **Presence is minimal.** Carets and names; no "following" someone, no
  indication of who is typing.
