# Real-time collaboration

Several people on the same document at once, each seeing where the others are, with an undo of their own.

The collaboration server only coordinates. It keeps a room in memory while people are in it and forgets it when it empties. Your backend keeps the files and decides who may open them, so documents, permissions and credentials stay in one place: your system.

```
 browser ──┐                              ┌── GET  /docs/<id>          read the file
 browser ──┼──► collaboration server ─────┼── PUT  /docs/<id>          save it
 browser ──┘      (rooms in memory)       └── POST /docs/<id>/access   may this person in?
                                                    your backend ──► S3, R2, a disk…
```

## A demo to run

[`apps/realtime`](https://github.com/JFranciscoRobles/rebodocs/tree/main/apps/realtime) is all of this page working: the collaboration server, a backend with the three routes and signed tickets, and the page. Nothing to set up:

```bash
git clone https://github.com/JFranciscoRobles/rebodocs && cd rebodocs && npm install
npm run realtime          # http://localhost:5177
```

Every document is a room, and there is no other way to open one. Open `contract.docx`, press **Copy link** and open the link in another window, or another browser. Give each a name in **You are**. Each sees the other's caret and what either types.

[`apps/assistant`](/docs/demos/#claude-in-the-editor) is the same demo with Claude in a chat beside the document: what it changes, the others in the room see.

A room is there only while someone is in it. It opens when the first person comes in, with the document the backend has. While someone types it gives the document back every 10 seconds. A moment after the last one leaves it gives it back once more and is let go of: nothing of the document stays in the collaboration server. The list says which rooms are open, and who is in each: the collaboration server answers that with `rooms()`.

The documents are kept in `apps/realtime/documents`, a folder. With the names of a bucket in `apps/realtime/.env` (the ones [the storage demo](/docs/storage/) takes) they are kept in an S3 bucket instead, with no other change: the backend asks a store for `list`, `get` and `put`, and both are one.

| What | Where |
| --- | --- |
| The three routes, the tickets, the name of a room | [`server/collab.ts`](https://github.com/JFranciscoRobles/rebodocs/blob/main/apps/realtime/server/collab.ts) |
| What the page asks: the documents, a new one, a ticket | [`server/api.ts`](https://github.com/JFranciscoRobles/rebodocs/blob/main/apps/realtime/server/api.ts) |
| Where the documents are kept | [`server/store.ts`](https://github.com/JFranciscoRobles/rebodocs/blob/main/apps/realtime/server/store.ts) |
| The page | [`src/App.tsx`](https://github.com/JFranciscoRobles/rebodocs/blob/main/apps/realtime/src/App.tsx) |

The demo starts the collaboration server in its own process, on port 7421, to have one thing to run. It reaches the backend as it would from anywhere: over HTTP, with the key. The steps below are the same thing, each part on its own.

## 1. Run the server

```bash
REBODOCS_COLLAB_BACKEND_KEY=a-long-secret \
  npx @rebodocs/collab --host 0.0.0.0 --backend https://api.example.com/docs
```

It is [`@rebodocs/collab`](https://www.npmjs.com/package/@rebodocs/collab) on npm; from the repository, `npm run collab -- …` is the same server. To start it from a Node program of your own, `createCollabServer` from `@rebodocs/collab/server` takes the same options, and `backendStorage` from `@rebodocs/collab/storage` the backend.

| Option | Environment | What it is |
| --- | --- | --- |
| `--backend URL` | `REBODOCS_COLLAB_BACKEND` | Where documents are read from and saved to. |
| `--backend-key` | `REBODOCS_COLLAB_BACKEND_KEY` | Sent to your backend as `Authorization: Bearer …`. Put it in the environment, not on the command line. |
| `--port` | `REBODOCS_COLLAB_PORT` | 7420 by default. |
| `--host` | | Address to listen on. |
| `--save-every N` | | Seconds between saves while a room has changes. 30 by default. |

It is plain Node with no dependencies. Put it behind HTTPS with your usual proxy; it uses server-sent events and POST, not WebSockets, so nothing special is needed.

## 2. Three routes in your backend

Each request carries the key, so check it.

| Route | When | What you do |
| --- | --- | --- |
| `GET  /docs/<id>` | Someone opens a room nobody is in. | Return the DOCX. |
| `PUT  /docs/<id>` | Every `--save-every` seconds with changes, when the last person leaves, on shutdown. | Store the DOCX in the body. The one when the last person leaves ends a session of work, and says so: see [a version for each session](#a-version-for-each-session). |
| `POST /docs/<id>/access` | Someone joins. Body: `{ "ticket": "…" }`. | Answer `{ "name": "Ana" }` to let them in under that name, or 403. |

A sketch, with Next.js route handlers:

```ts
// app/api/docs/[id]/route.ts
const allowed = (request: Request) => request.headers.get('authorization') === `Bearer ${process.env.REBODOCS_COLLAB_BACKEND_KEY}`;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  const file = await storage.get(`docs/${(await params).id}.docx`);
  return file ? new Response(file) : new Response(null, { status: 404 });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  await storage.put(`docs/${(await params).id}.docx`, await request.arrayBuffer());
  return new Response(null, { status: 204 });
}
```

```ts
// app/api/docs/[id]/access/route.ts
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  const { ticket } = await request.json();
  const user = await verifyTicket(ticket, (await params).id);    // your own signed, short-lived token
  return user ? Response.json({ name: user.name }) : new Response(null, { status: 403 });
}
```

### A version for each session

The `PUT` made when the last person leaves, if anybody changed anything, carries two headers:

| Header | What it is |
| --- | --- |
| `X-Rebodocs-Session-End: 1` | This is the document as the session of work leaves it: everybody has gone. |
| `X-Rebodocs-Authors` | Who changed it in the session, as their names were given by `/access`, each URL-encoded, separated by commas, in the order they first changed it. Someone who only looked is not there. |

The `PUT`s made while people work have neither. So a backend that keeps a version of the document each time the people working on it leave, and not every 30 seconds, looks at the first header, and signs the version with the second:

```ts
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!allowed(request)) return new Response(null, { status: 401 });
  const id = (await params).id;
  const docx = new Uint8Array(await request.arrayBuffer());
  await storage.put(`docs/${id}.docx`, docx);
  if (request.headers.get('x-rebodocs-session-end') === '1') {
    const authors = (request.headers.get('x-rebodocs-authors') ?? '').split(',').filter(Boolean).map(decodeURIComponent);
    await storage.put(`versions/${id}/${Date.now()}.docx`, docx, { authors });
  }
  return new Response(null, { status: 204 });
}
```

Give the editor those versions (`versions` of [`DocsEditor`](/docs/react/)), and everybody in the room can see them, compare the document with one, and go back to one: going back is one more change, sent to the others. Someone can also keep one by hand from the side panel, when `versions` has `save`. See [versions](/docs/versions/).

A session ends when the room is let go of: `idle` after the last person left (30 s by default). Someone who comes back before that is in the same session. A server that stops while people are in it gives the document back without the headers: they come back to another process, and the session goes on.

The demo, `apps/realtime`, keeps them this way: in `server/collab.ts` and `server/versions.ts`.

## 3. Give each person a ticket

A ticket is whatever your backend can verify: a signed, short-lived token saying who the person is and which document they may open. Make it when you render the page, and pass it on. The demo signs the room, the name and when it expires with a secret only the backend has, so it keeps nothing to check one:

```tsx
<DocsEditor collab={{ url: 'https://collab.example.com', room: documentId, ticket }} />
```

The document comes from the room, so `docx` is not used. It saves itself through your backend, so `onSave` is not needed either.

No storage credentials reach the browser, and none reach the collaboration server.

## What people see

- The others' carets and selections, each in a colour with their name.
- Who is on the document, in the status bar.
- Undo takes back your own steps and leaves the others' in place.
- If the connection drops, the editor says so, keeps working, and sends what was typed when it comes back.

`onCollab={(state, peers) => …}` tells you the same from outside: `state` is `'connecting'`, `'on'` or `'offline'`.

## Trying it without a backend

```bash
npx @rebodocs/collab                 # keeps rooms in ./salas
npx @rebodocs/collab --memory        # keeps nothing
```

In the playground, the "Share" button of the status bar starts a room and gives a link to pass on.

## How it works inside

The rest of this page is for whoever wants to know what travels, in what order, and what happens when two people change the same thing at once. None of it is needed to use the component.

### Paragraphs by id, not by place

Everybody in a room starts from the same file, and `stampIds` gives each paragraph an id from where it is in that file: whoever reads the same file gets the same ids, without saying anything to anybody. A paragraph made later gets an id minted by the editor that made it (`<client>.<n>`), so two people can never make the same one.

A change names the paragraph it is about by that id. "In `k3`, at offset 12, insert `x`" still means the same after someone added ten paragraphs above `k3`, which "in paragraph 4" would not.

Headers, footers, footnotes and text boxes are *stories*, with paragraphs and ids of their own. A change to one carries its `part` (`header`, `firstFooter`, the header of a section, `footnote:<id>`, `textbox:<id>`…), so a caret in a footer, or text typed in a text box, goes to everybody like text in the body.

### What a change is

An editor does not send keys or documents. Every time the document changes, it compares it with the last one it sent (`diff`) and sends what is different, as a list of operations:

| Operation | What it says |
| --- | --- |
| `splice` | In paragraph `id`, at `at`, take out `remove` characters and put in these runs, with their formatting. Typing, deleting, pasting and formatting part of a paragraph are all one. |
| `split`, `join` | A paragraph cut in two at a place, with an id for the second half; two paragraphs made one. |
| `insert`, `delete` | Whole paragraphs put in after another (or at the start), or taken out. |
| `para` | The formatting of a paragraph: only what changed of it, `null` for what was taken away. Also the cell it is in and the section it ends. |
| `table` | The shape of a table as a whole: rows, columns, widths, merged cells. |
| `story` | A header, footer, footnote or text box made, or taken away. |
| `set` | Something of the document as a whole: page setup, columns, styles, the first page of its own, whether changes are tracked. |
| `note`, `media`, `num` | A comment, a picture's bytes, a list definition. |

Formatting is part of the runs, and so are [tracked changes](/docs/tracked-changes/): a deletion someone makes with tracking on travels as a `splice` that marks the text deleted, and everybody sees it struck through, signed with that person's name.

The format is in `@rebodocs/collab`, and none of it needs a browser:

```ts
import { stampIds, ensureIds, diff, apply, transform } from '@rebodocs/collab';
import { importDocx } from '@rebodocs/core';

const before = stampIds(importDocx(file));
const after = ensureIds(before, editSomehow(before), mint);
const ops = diff(before, after);       // what turns one into the other
apply(before, ops);                     // the same document as `after`
```

### One order for everybody

The server keeps, for each room, the file it started from and a log of every change since, numbered. That log is the one order everybody follows.

An editor sends its changes with the number of the last one it had seen (`rev`). If others got there in between, the server does not refuse it: it `transform`s it against those, so that it means what its author meant on the document as it now is, adds it to the log and tells everybody. Each editor makes the changes of the log in order, and so they all end with the same document.

An editor sends one batch at a time and waits for it to take its place; what is typed meanwhile is gathered for the next. Each batch has a sequence number, so one sent again because its answer was lost is taken once.

### When two people change the same thing

| What happens at once | What everybody ends with |
| --- | --- |
| Both type at the same place. | Both texts, the one the server got first before the other. |
| One deletes a passage, the other types in the middle of it. | The passage goes, and what was typed in it stays. |
| One splits a paragraph (Enter), the other types after that place. | The text goes into the second half. |
| One joins two paragraphs, the other types in the second one. | The text is in the joined paragraph, at the same place in it. |
| One formats a paragraph, the other splits it. | Both halves have the formatting. |
| Both join the same two paragraphs. | One join. |
| One deletes a paragraph, the other types in it. | The paragraph's text goes, and what was typed stays where it was, in a paragraph of its own with the same formatting. The one typing goes on typing there, without the caret jumping. The same with several paragraphs deleted at once, and with a paragraph made with Enter and typed in. |
| One deletes a paragraph, the other only formats its text or presses Enter in it. | The paragraph is gone: nothing new was written in it. |
| One formats a passage (bold, a colour, a tracked deletion), the other types in it. | What was typed stays where it was typed, without the formatting; the rest has it. |
| Both format the same passage. | Each letter has the formatting of the one the server got last. |
| One formats a passage, the other deletes part of it. | What was deleted is gone; the rest has the formatting. |
| Both put new paragraphs after the same one. | Both, the ones the server got first before the others. |
| Both insert a table at the same place. | Both tables, one after the other. |
| Both change the shape of the same table, the page setup, the styles or the same comment. | The one the server got last. Cells left without a paragraph, or paragraphs in a cell that went, are mended the same way by everybody. |
| Both add a picture or a comment. | Both: their names are made unique before they are sent. |

These rules have unit tests for pairs of concurrent changes, and tests with two clients typing through a real server. Besides, `test/convergence.test.ts` makes two people edit at random (typing, deleting across paragraphs, Enter, bold, alignment) from 3,000 seeds, with one edit each and with up to three, and checks that both end with the same document whichever way round the server takes them. They all do. With more seeds and more edits a few still do not (6 in 20,000 with three edits each): both people cut, join and take out paragraphs around the same place at the same instant. Tables are not in the random edits, and concurrent changes to the structure of the same table are the weakest part.

That is why the rules are not all there is. **The server checks that everybody has its document**: a moment after the changes stop (1.5 s, or every 6 s while they go on), it tells the room, in sixteen letters, what its document is like: a digest of the text, paragraph by paragraph, with its formatting and the shape of its tables. Each editor makes the same digest of the document it has from the room, and if it is not the same, it loads the room again: its file and every change made to it. What the person had typed and the room did not have yet is made again on it and sent, so nothing they wrote is lost; what they can undo starts over. So whatever the rules get wrong, it lasts a couple of seconds, not until someone opens the document again. `session.resyncs` says how many times it happened, and the console says it each time.

A deletion carries the paragraph it takes out, Enter the formatting of the new paragraph, and formatting says that it is formatting: older editors send changes without them, and their changes are taken the way they were before. Clients of different versions in the same room can end with different formatting, and an editor of before does not check its document against the server's, so update the editors and the server together.

### What the editor does with it

- **What the person does is shown at once.** The editor does not wait for the server. When someone else's change arrives first, it is made on the document the server confirmed, and what this person has not had confirmed yet is transformed against it and made again on top.
- **Undo is per person.** Each step is kept as the changes that undo it, not as the document as it was. When others' changes arrive, the steps kept are transformed against them too, so undoing takes back what you did and leaves what they did after.
- **Carets are places by id.** Where each person is goes as a paragraph id and an offset, with the part and the page, about 40 ms after it moves. As changes arrive, the carets of the others are carried through them.
- **Checked against the room.** The editor compares its document with the digest the server sends now and then, and loads the room again when they differ (see above).
- **Reconnection.** If the stream drops, the editor goes on working (`state` is `'offline'`) and tries again after 0.5 s, then 1, 2, 4, up to 8 s. Coming back, it says how far it had got; the server sends only what it missed, and what it had sent without an answer is sent again. If the room was folded into its file meanwhile (see below), it loads the room again from the start. A room that is not there (404) or a person no longer let in (403) ends the session.

### The life of a room

1. **It opens** when someone comes in and nobody is in it: the server asks the storage for the file (with a backend, `GET /docs/<id>`).
2. **While people are in it**, every change goes into its log in memory, and every `saveEvery` (30 s by default) the server gives the backend the document as it is (`PUT`), if it changed.
3. **When the last one leaves**, the server waits `idle` (30 s by default), makes the changes into one file, saves it, and lets the room go. That `PUT` says the session ended, and who changed the document in it: [a version for each session](#a-version-for-each-session). Someone who comes back meanwhile finds it as it was.
4. **On shutdown** (`SIGINT`, `SIGTERM`) the command gives the backend what it does not have yet before leaving. In a program of your own, call `server.flush()`.

Each time the changes are folded into the file, the room's `epoch` goes up: a client that had the room before it was folded knows its numbers no longer apply, and loads it again.

### The server in a program of your own

```ts
import { createCollabServer } from '@rebodocs/collab/server';
import { backendStorage } from '@rebodocs/collab/storage';

const server = createCollabServer({
  port: 7420,
  host: '0.0.0.0',
  storage: backendStorage({ url: 'https://api.example.com/docs', key: process.env.KEY }),
  saveEvery: 10_000,   // ms between saves while people type
  idle: 5_000,         // ms a room nobody is in waits before it is saved and let go of
  checkAfter: 1_500,   // ms after the last change the room is told what its document is like
});
await server.ready;

server.rooms();        // [{ id, people: ['Ana', 'Luis'] }]: who is where, for a list of open documents
process.on('SIGTERM', () => void server.flush().finally(() => server.close()));
```

The storage is an interface, so the backend over HTTP is one of three that come with it, and you can write your own (straight to a database, say):

| Storage | What it keeps |
| --- | --- |
| `backendStorage({ url, key })` | Nothing: the documents are your backend's, and it says who comes in. |
| `folderStorage(dir)` | Each room in a folder: `base.docx`, `log.jsonl` with every change, `meta.json`. The file and log before the last fold stay beside them, as `*.before.*`. |
| `memoryStorage()` | Nothing at all: rooms last as long as the process. |

A `RoomStorage` has `load(id)` and `keep(id, room, folded)` for the file, `add(id, entry)` for each change, and optionally `save(id, docx)` for the document while people work, and `admit(id, ticket)` to say who may come in, under what name, and whether only to watch (`{ name, readOnly: true }`). Someone let in to watch sees the others type and cannot change anything: the editor goes read-only, and the server refuses their changes. `/access` says it the same way, with `"readOnly": true`.

### Inside your API, on its port

Left without `port`, the server listens on none: mount its `handle` in the server your API already has, and the room storage can call your services straight, without the three routes:

```ts
const collab = createCollabServer({
  storage: {
    open: false,
    forgets: true,
    load: async (id) => ({ name: await documents.name(id), epoch: 1, base: await documents.read(id), log: [] }),
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
| `GET  /collab/rooms/<id>/events` | The stream: `hello` (the room, the changes the client lacks, who is in), then `op`, `presence`, `leave`, and `check` (the digest of the document at a revision). A comment every 20 s keeps it open. |
| `POST /collab/rooms/<id>/ops` | A batch of changes, with `rev`, `epoch` and `seq`. |
| `POST /collab/rooms/<id>/presence` | Where this person's caret is. |
| `GET  /collab/rooms/<id>/base`, `/docx` | The file the room started from; the document as it is now. Only for someone in the room, when there is a backend. |

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

## What to know

Collaboration has run with two tabs, and two browsers on a local network. The demo's backend has automated tests with two people typing through it, over a folder. It has not run between different networks, behind an HTTPS proxy, or with two browsers over a real bucket. Before relying on it:

- **A room is named with letters, digits, `-` and `_`**, from 8 to 64 of them. The id of a document in your system will do; the demo, which has file names, uses a digest of the name.
- **One process holds a room.** Do not run several behind a load balancer without routing each room to one of them.
- **The ticket is checked on joining only.** Someone whose access you revoke stays until they disconnect.
- **A hard crash loses up to `--save-every` seconds** of changes.
- **The server keeps no versions.** Your application keeps them, and the editor compares and restores them: see [versions](/docs/versions/). The server says when a session ends, and who changed the document in it, for your backend to keep one then. Who changed what is shown with [tracked changes](/docs/tracked-changes/), which travel to everyone in the room.
