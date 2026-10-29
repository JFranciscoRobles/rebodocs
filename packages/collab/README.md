<h1 align="center">@rebodocs/collab</h1>

<p align="center">
  Real-time collaboration for Rebodocs: the room server, its browser client, and the change format between them.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rebodocs/collab"><img src="https://img.shields.io/npm/v/@rebodocs/collab?label=npm&color=0b57d0" alt="npm version"></a>
  <a href="https://github.com/JFranciscoRobles/rebodocs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-2e6b3c" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://rebodocs.com/docs/collaboration/">Documentation</a> ·
  <a href="https://github.com/JFranciscoRobles/rebodocs/tree/main/apps/realtime">Example backend</a>
</p>

---

Several people on one document, each seeing the others' carets, with undo
per person. The collaboration server coordinates; **your backend keeps the
files and decides who may open them**, so no storage credentials reach the
browser or the collaboration server.

## Run the server

```bash
npx @rebodocs/collab --backend https://app.example/api/docs
# the key it sends your backend: REBODOCS_COLLAB_BACKEND_KEY
```

Or inside the Node server your API already has:

```ts
import { createCollabServer } from '@rebodocs/collab/server';
import { backendStorage } from '@rebodocs/collab/storage';

const collab = createCollabServer({ storage: backendStorage({ url: 'https://app.example/api/docs', key: process.env.KEY }) });
app.use('/collab', collab.handle); // Express, or Nest's main.ts
```

## Connect the editor

```tsx
<DocsEditor collab={{ url: 'https://collab.example', room: documentId, ticket }} />
```

The ticket is a short-lived token your application signs for each person.

## Your backend

Three routes, and only your backend talks to storage (S3, R2, a disk):

| Route | When | Does |
| --- | --- | --- |
| `GET URL/<id>` | Someone opens a room nobody is in. | Returns the DOCX. |
| `PUT URL/<id>` | `--save-after` seconds after the changes stop (at least every `--save-every` while they go on), when the room empties, on shutdown. | Stores the DOCX. When the room empties, `X-Rebodocs-Session-End` and `X-Rebodocs-Authors` say it is time to keep a version, and who changed it. |
| `POST URL/<id>/access` | Someone joins, with `{ "ticket" }`; and every `--recheck-every` seconds while they stay. | `{ "name": "Ana" }` to let them in, with `"readOnly": true` to let them only watch; 403 to keep them out. |

[`apps/realtime`](https://github.com/JFranciscoRobles/rebodocs/tree/main/apps/realtime)
is such a backend to run and copy: the three routes over a folder or a
bucket, and tickets signed with a secret.

## Options

| Option | Environment | Default |
| --- | --- | --- |
| `--port` | `REBODOCS_COLLAB_PORT` | `7420` |
| `--backend URL` | `REBODOCS_COLLAB_BACKEND` | — |
| `--backend-key` | `REBODOCS_COLLAB_BACKEND_KEY` | — |
| `--save-after N` | | `5` seconds after the last change |
| `--save-every N` | | `30` seconds at most while changes go on |
| `--recheck-every N` | `REBODOCS_COLLAB_RECHECK_EVERY` | Ask `/access` again this often, and send away whoever it turns down. Never by default. |
| `--data DIR`, `--memory` | | Keep rooms in a folder, or nowhere, to try it without a backend. |
| `--token` | `REBODOCS_COLLAB_TOKEN` | A word needed to create rooms without a backend. |
| `--host`, `--static DIR` | | Where to listen; a built editor to serve too. |

## How it works

- **Paragraphs have ids**, so a change still means the same thing after
  someone else adds a paragraph above.
- **One order for everyone.** The server sequences incoming changes and
  rebases each against those it had not seen; clients apply their own at once.
- **Server-sent events down, POST up.** No WebSocket, so it passes through
  ordinary proxies.
- **A digest check.** A moment after changes stop, an editor whose document
  differs from the room's loads it again, keeping what was typed.
- **Folded as it goes.** Once a room has 1000 changes (`foldAfter`), they
  are folded into its file at the next pause, with everybody still in it;
  each editor loads the new file, keeping what it had not sent and what it
  can undo.
- **A key per editor.** Everything an editor sends carries a key only it was
  given, so nobody can send as someone else, and a viewer cannot edit.
- **Limits.** 200 sendings at once and 50 a second per person, 64 KB for a
  caret; past that, 429.

In a program of your own, `onEvent` is told who comes and goes, each fold,
save and removal, and what goes wrong; `recheck(room)` asks the storage again
who may be in, at once.

## Limits

- Tried on one machine, on a local network, and across networks behind an HTTPS proxy over a real bucket.
- One server process holds a room.
- Access is checked when someone joins, and while they stay only with `--recheck-every` or `recheck()`.
- A hard crash loses the changes since the last save: up to `--save-after` seconds after typing stops, `--save-every` while it goes on.

## Status

0.13: ready to try in production; the API may change before 1.0. See the
[changelog](https://github.com/JFranciscoRobles/rebodocs/blob/main/CHANGELOG.md).

## License

[MIT](https://github.com/JFranciscoRobles/rebodocs/blob/main/LICENSE).
