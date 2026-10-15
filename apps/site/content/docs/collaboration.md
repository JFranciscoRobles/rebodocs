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
  npm run collab -- --host 0.0.0.0 --backend https://api.example.com/docs
```

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
| `PUT  /docs/<id>` | Every `--save-every` seconds with changes, when the last person leaves, on shutdown. | Store the DOCX in the body. |
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
npm run collab                 # keeps rooms in ./salas
npm run collab -- --memory     # keeps nothing
```

In the playground, the "Share" button of the status bar starts a room and gives a link to pass on.

## What to know

Collaboration has run with two tabs, and two browsers on a local network. The demo's backend has automated tests with two people typing through it, over a folder. It has not run between different networks, behind an HTTPS proxy, or with two browsers over a real bucket. Before relying on it:

- **A room is named with letters, digits, `-` and `_`**, from 8 to 64 of them. The id of a document in your system will do; the demo, which has file names, uses a digest of the name.
- **One process holds a room.** Do not run several behind a load balancer without routing each room to one of them.
- **The ticket is checked on joining only.** Someone whose access you revoke stays until they disconnect.
- **A hard crash loses up to `--save-every` seconds** of changes.
- **No version history.**
