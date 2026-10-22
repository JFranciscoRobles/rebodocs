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

### The check against the room

The rules are not all there is. **The server checks that everybody has its document**: a moment after the changes stop (1.5 s, or every 6 s while they go on), it tells the room, in sixteen letters, what its document is like: a digest of the text, paragraph by paragraph, with its formatting and the shape of its tables. Each editor makes the same digest of the document it has from the room, and if it is not the same, it loads the room again: its file and every change made to it. What the person had typed and the room did not have yet is made again on it and sent, so nothing they wrote is lost; what they can undo starts over. So whatever the rules get wrong, it lasts a couple of seconds, not until someone opens the document again. `session.resyncs` says how many times it happened, and the console says it each time.

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
