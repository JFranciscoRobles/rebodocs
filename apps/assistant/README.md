# Assistant demo

Claude in the editor: a chat beside a shared document that reads it and
changes it, keeping its look. It is the realtime demo with an assistant: every
document is a room, the documents are kept in a folder or in an S3 bucket, and
what Claude does in the document of one person, the others in the room see
happen.

```bash
cp apps/assistant/.env.example apps/assistant/.env   # and put ANTHROPIC_API_KEY in it
npm run assistant                                     # from the root: http://localhost:5179
```

Without a key everything works but the chat, which says what is missing. To
keep the documents in a bucket, give `.env` the names `apps/storage` takes.

## What runs

```
 browser ──► POST /api/assistant { messages } ──► Claude API (the key is here)
   │            ◄── lines of JSON as Claude writes: its text, the tools it asks for,
   │                and at the end the whole answer
   │
   └─ runs the tools Claude asked for on the editor open, as steps to undo,
      and sends the results in the next step ──► the room ──► the others
```

- **The page holds the conversation**, and runs the tools: the same ones the
  MCP server has (`packages/mcp/src/tools.ts`), on the document it has open.
  A change is one step to undo and, being the person's own, goes to the room.
- **The server only takes the conversation to Claude** and gives back what it
  answered: the key never reaches the browser. It does not keep anything.
- **Each address has a few steps a minute** (40; `ASSISTANT_PER_MINUTE`): an
  open page spends from the key of whoever runs the server.

The model is Claude Opus 5.5 at medium effort, with adaptive thinking;
`ASSISTANT_MODEL` and `ASSISTANT_EFFORT` change them. Where the model
declines, a fallback model goes on with the request (`fallbacks: "default"`).

## What is where

| File | What it is |
| --- | --- |
| `src/Chat.tsx` | The chat: what it shows, on `createAssistantChat` of `@rebodocs/react`. |
| `src/App.tsx` | The page of the realtime demo, with the chat as a third column. |
| `server/dev.ts` | The backend of the realtime demo, and `assistantRoute` of `@rebodocs/mcp/claude` beside it. |
| `packages/mcp/src/claude.ts` | The route: the tools as the Claude API takes them, the request, the limits. |
| `packages/mcp/src/chat.ts` | The conversation in the page: the steps, running the tools, stopping. |

The rest — the documents, the rooms, the tickets — is `apps/realtime/server`,
taken from there.

## Where it can improve

- **Who may ask.** Anyone who reaches the page may, a few times a minute.
  `assistantRoute({ allow })` is where an application checks its session.
- **Pictures.** `insert_image` reads a file of the machine, which a page has
  not got: the chat leaves it out.
- **One person's chat.** The others see what Claude does, not the
  conversation.
