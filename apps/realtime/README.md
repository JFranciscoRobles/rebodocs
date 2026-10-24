# Realtime demo

Several people on one document at once, each seeing where the others are.
The collaboration server only coordinates: a backend keeps the documents and
says who may come in.

```bash
npm run realtime          # from the root: http://localhost:5177
```

Every document is a room, and a room is there only while someone is in it:
it opens when the first person comes in and, a moment after the last one
leaves, the document is saved and the room is let go of. The list says which
rooms are open and who is in each.

Open a document, press **Copy link**, and open the link in another window or
another browser. It saves itself two seconds after typing stops, and every
30 seconds while it goes on. The terminal says who comes and goes.

Every change also goes to the backend as it comes, into a log beside the
documents (`logs/`), so the collaboration server can stop at any moment and
lose none: started again, the rooms pick up where they were, and the people
in them go on as after a dropped connection. The log is emptied once the
last person leaves and the document is kept whole. `COLLAB_LOG=0` runs it
without, as the server is by default.

When everybody has left a document they changed, the backend keeps a version
of it, signed by who changed it. The **Versions** tab of the side panel lists
them, compares the document with one and goes back to one, and keeps one by
hand.

[The guide](https://rebodocs.com/docs/collaboration/) explains each part.

Nothing to set up: the documents are kept in `documents/`, and the first time
there is a sample contract in it. To keep them in an S3 bucket instead, copy
`.env.example` to `.env` and give it the names `apps/storage` takes.

It is made to run on your own machine. Anyone who reaches it may come into
any document, under the name they give.

`apps/assistant` is this demo with Claude in a chat beside the document: it
takes its backend from `server/` here.

## What runs

```
 browsers ──► collaboration server :7421 ──► GET  /backend/docs/<room>          ──► documents/
   :5177      (rooms in memory)              PUT  /backend/docs/<room>              (or a bucket)
                                             POST /backend/docs/<room>/access
                                             PUT, POST, GET /backend/docs/<room>/changes ──► logs/
```

All of it in one process, to have one thing to start. Apart they would be
three: the pages, your backend, and
`npm run collab -- --backend http://localhost:5177/backend/docs --backend-log`.

## What is where

| File | What it is |
| --- | --- |
| `server/collab.ts` | The three routes the collaboration server asks, the log of each room's changes, the signed tickets, and the name of a room. |
| `server/api.ts` | What the page asks: the documents and who is in the room of each, a new one, a ticket into a room, the versions. |
| `server/store.ts` | Where the documents are kept: a folder, or anything with `list`, `get` and `put`. |
| `server/versions.ts` | The versions, under `versions/` in the same store and named as `apps/storage` names them: one for each session of work, and those kept by hand. |
| `server/dev.ts`, `vite.config.ts` | How the demo runs everything in one process. |
| `src/App.tsx` | The page: who you are, the documents, who else is there, the editor. |
| `test/realtime.test.ts` | The backend with a collaboration server on it, and two people typing. |

## Where it can improve

- **Two browsers in the tests.** Two browsers over a real bucket, across
  networks behind an HTTPS proxy, were tried by hand; the tests run two people
  over a folder, with no browser.
- **Who may do what.** No sign-in: a ticket is signed for whatever name is
  given. `server/api.ts` says where an application decides.
- **A ticket is checked on coming in.** Whoever is in stays until they leave.
- **One process holds a room.** Several behind a load balancer need each room
  routed to one of them.
