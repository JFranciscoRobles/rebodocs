# @rebodocs/collab

> Not on npm by itself yet. It is used from this repository, and it is inside [`@rebodocs/react`](https://www.npmjs.com/package/@rebodocs/react), which is.

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
| Changes | `changes.ts` | The difference between two documents as a list of operations addressed by paragraph id; applying them; transforming one against another so that everyone ends with the same document. |
| Server | `server.ts`, `storage.ts`, `main.ts` | One room per document: the base file and an ordered log of changes. Node's `http` only, no dependencies. |
| Client | `session.ts` (`@rebodocs/collab/browser`) | Joins a room for an `Editor`: sends its changes, applies the others', shows their carets, undoes only this person's steps, reconnects. |

## Running the server

```bash
npm run collab -- --backend https://my-app.example/api/docs
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
| `PUT  URL/<id>` | Every `--save-every` seconds with changes, when the room empties, on shutdown. | Stores the DOCX. |
| `POST URL/<id>/access` | Someone joins. Body: `{ "ticket": "…" }`. | Says whether they may, and as whom: `{ "name": "Ana" }`, or 403. |

The application gives each person a ticket (a signed, short-lived token of
its own making) and the editor passes it on:

```tsx
<DocsEditor collab={{ url: 'https://collab.example', room: documentId, ticket }} />
```

No storage credentials ever reach the browser or the collaboration server.

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
  Different networks, HTTPS behind a proxy, and a real backend with real
  storage are untried.
- **One process per room.** Rooms live in the memory of one server. Running
  several needs a shared log (Redis, a database) or routing by room.
- **Permissions are checked on joining only.** Someone whose access is
  revoked stays until they disconnect. The ticket should be checked again
  periodically, and there is no read-only role.
- **A hard crash loses up to `--save-every` seconds.** The log should be
  written somewhere durable as it grows.
- **Convergence is tested case by case, not proven.** The transform has unit
  tests for pairs of concurrent edits. Randomized testing with many clients
  would find the cases nobody thought of; concurrent edits to the structure
  of the same table are the weakest part.
- **No history.** Who changed what, and going back to an earlier version,
  are not kept.
- **Presence is minimal.** Carets and names; no "following" someone, no
  indication of who is typing.
