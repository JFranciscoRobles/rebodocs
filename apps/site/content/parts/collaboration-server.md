### The server in a program of your own

```ts
import { createCollabServer } from '@rebodocs/collab/server';
import { backendStorage } from '@rebodocs/collab/storage';

const server = createCollabServer({
  port: 7420,
  host: '0.0.0.0',
  storage: backendStorage({ url: 'https://api.example.com/docs', key: process.env.KEY }),
  saveAfter: 5_000,    // ms after the last change the document is given to the backend
  saveEvery: 30_000,   // and at least this often while people type
  idle: 5_000,         // ms a room nobody is in waits before it is saved and let go of
  checkAfter: 1_500,   // ms after the last change the room is told what its document is like
  foldAfter: 1_000,    // changes a room gathers before they are folded into its file, with people in it
  recheckEvery: 300_000, // ms between asking the backend again who may be in; never when left out
  onEvent: (event) => log(event), // join, leave, fold, save, removed, error
});
await server.ready;

server.rooms();        // [{ id, people: ['Ana', 'Luis'] }]: who is where, for a list of open documents
await server.recheck(documentId);   // someone's access changed: ask now, not at the next recheckEvery
process.on('SIGTERM', () => void server.flush().finally(() => server.close()));
```

The storage is an interface, so the backend over HTTP is one of three that come with it, and you can write your own (straight to a database, say):

| Storage | What it keeps |
| --- | --- |
| `backendStorage({ url, key })` | Nothing: the documents are your backend's, and it says who comes in. |
| `folderStorage(dir)` | Each room in a folder: `base.docx`, `log.jsonl` with every change, `meta.json`. The file and log before the last fold stay beside them, as `*.before.*`. |
| `memoryStorage()` | Nothing at all: rooms last as long as the process. |

`recheck` asks `/access` again with the ticket each person came in with: whoever it no longer lets in is sent away, and whoever it now lets only watch, or edit, comes back as that. Tickets that expire are asked about as they are, so make them last as long as a session may, or leave `recheckEvery` out and call `recheck` when your system takes someone's access away. Given `onEvent`, what goes wrong goes to it rather than to the console.

A `RoomStorage` has `load(id)` and `keep(id, room, folded)` for the file, `add(id, entry)` for each change, and optionally `save(id, docx)` for the document while people work, and `admit(id, ticket)` to say who may come in, under what name, and whether only to watch (`{ name, readOnly: true }`). Someone let in to watch sees the others type and cannot change anything: the editor goes read-only, and the server refuses their changes. `/access` says it the same way, with `"readOnly": true`.

### Inside your API, on its port

Left without `port`, the server listens on none: mount its `handle` in the server your API already has, and the room storage can call your services straight, without the three routes:

```ts
const collab = createCollabServer({
  storage: {
    open: false,
    forgets: true,
    // A new epoch each time: an editor that had the room before it was let go of knows the file may have changed.
    load: async (id) => ({ name: await documents.name(id), epoch: Date.now(), base: await documents.read(id), log: [] }),
    keep: async (id, room, folded, ended) => { if (folded) await documents.write(id, room.base, ended?.authors); },
    add: () => {},
    save: (id, docx) => documents.write(id, docx),
    admit: (id, ticket) => tickets.check(id, ticket),   // { name, readOnly? } or undefined
  },
  saveEvery: 10_000,
});

app.use('/collab', collab.handle);   // Express; in Nest, app.use in main.ts
```

It reads the address from `originalUrl`, so the prefix Express takes off does not matter, and takes a body your body parser already read. Its routes answer with `Access-Control-Allow-Origin: *` and need no cookies: the ticket is what lets someone in. One process still holds each room, so run one instance of the API, or route each room to one.

### On the wire

Everything is under `/collab`, as plain HTTP: one stream of [server-sent events](https://developer.mozilla.org/docs/Web/API/Server-sent_events) per person, and POSTs to send. Any proxy that passes HTTP passes it; turn response buffering off for the events route (the server already sends `X-Accel-Buffering: no` for nginx).

| Route | What it is |
| --- | --- |
| `GET  /collab/ping` | Whether a collaboration server answers, and whether starting a room needs a token. |
| `POST /collab/rooms` | Starts a room with a document (without a backend only). |
| `GET  /collab/rooms/<id>/events` | The stream: `hello` (the room, the changes the client lacks, who is in, and the client's `key`), then `op`, `presence`, `leave`, `check` (the digest of the document at a revision), `fold` (the changes folded into the file, and the paragraphs' new ids) and `removed`. A comment every 20 s keeps it open. |
| `POST /collab/rooms/<id>/ops` | A batch of changes, with `client`, `key`, `rev`, `epoch` and `seq`. |
| `POST /collab/rooms/<id>/presence` | Where this person's caret is, with `client` and `key`; 64 KB at most. |
| `GET  /collab/rooms/<id>/base`, `/docx` | The file the room started from; the document as it is now. Only for someone in the room (`client` and `key`), when there is a backend. |

Each person may send 200 at once and 50 more a second, far more than an editor does; past that the server answers 429 and the editor tries again.

### Without React

`DocsEditor` with `collab` does all of this. With the editor alone, `joinRoom` takes any `Editor`:

```ts
import { Editor } from '@rebodocs/editor';
import { joinRoom } from '@rebodocs/collab/browser';

const editor = new Editor(element);
const session = joinRoom(editor, documentId, {
  url: 'https://collab.example.com',
  ticket,
  onChange: () => render(session.state, session.peers),
});

session.pending;     // changes made here the server has not taken yet: worth checking before closing the page
session.resyncs;     // times the document here was found not to be the room's, and loaded again
session.leave();     // stops sharing; the document stays as it is
```

`createRoom(url, docx, name, token?)` starts a room with a document of the person's own (without a backend), and `pingServer(url)` says whether a server is there.

### Trying it without a backend

```bash
npx @rebodocs/collab                 # keeps rooms in ./rooms
npx @rebodocs/collab --memory        # keeps nothing
```

In the playground, the "Share" button of the status bar starts a room and gives a link to pass on.
