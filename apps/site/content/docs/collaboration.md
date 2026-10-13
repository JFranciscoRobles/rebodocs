# Real-time collaboration

Several people on the same document at once, each seeing where the others are, with an undo of their own.

The collaboration server only coordinates. It keeps a room in memory while people are in it and forgets it when it empties. Your backend keeps the files and decides who may open them, so documents, permissions and credentials stay in one place: your system.

```
 browser ──┐                              ┌── GET  /docs/<id>          read the file
 browser ──┼──► collaboration server ─────┼── PUT  /docs/<id>          save it
 browser ──┘      (rooms in memory)       └── POST /docs/<id>/access   may this person in?
                                                    your backend ──► S3, R2, a disk…
```

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

A ticket is whatever your backend can verify: a signed, short-lived token saying who the person is and which document they may open. Make it when you render the page, and pass it on:

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

Collaboration has run with two tabs, and two browsers on a local network. It has not run between different networks, behind an HTTPS proxy, or against a real backend with real storage. Before relying on it:

- **One process holds a room.** Do not run several behind a load balancer without routing each room to one of them.
- **The ticket is checked on joining only.** Someone whose access you revoke stays until they disconnect.
- **A hard crash loses up to `--save-every` seconds** of changes.
- **No version history.**
