# Tracked changes

With tracked changes on, what is typed stays underlined and what is deleted stays in the text, struck through, until someone accepts or rejects each change. This is Word's "Track changes": a document with tracked changes made in Word opens with them, and what is tracked in Rebodocs opens in Word as tracked changes.

## In the editor

**Review** in the toolbar, or ⌘⇧E (Ctrl+Shift+E), turns tracking on and off. Whether it is on is saved in the file, as Word saves it.

Tracked text shows in the colour of the person who made the change, with a bar in the left margin beside each line that has a change. Deleted text keeps its place:

- **Backspace** steps over text that is already deleted.
- **Delete** puts the caret after it.
- Text you deleted that was your own tracked insertion is removed for good.
- **Enter** adds a paragraph break that is itself a change. A join (Backspace at the start of a paragraph) keeps both paragraphs apart until it is accepted.

The **Review** menu accepts or rejects the change at the caret, or every change in the selection. It also moves to the previous or next change, and accepts or rejects them all. The **Changes** tab of the side panel lists every change with who made it and when, and has buttons to accept or reject each one. The list includes changes in headers, footers and footnotes.

Changes are signed with the editor's `author`, the same name comments are signed with.

## In code

| Member | What it does |
| --- | --- |
| `trackChanges`, `setTrackChanges(on)` | Whether changes are tracked. Turning it on or off is not a step to undo. |
| `revisions`, `hasRevisions`, `activeRevision` | The changes, as `{ type, author, date, range, text, part? }`. |
| `acceptRevision()`, `rejectRevision()` | The change at the caret, or the ones in the selection. |
| `acceptAllRevisions()`, `rejectAllRevisions()` | Each one step to undo. |
| `goToRevision(dir)`, `selectRevision(revision)` | |

`DocsState` has `trackChanges` and `revisionCount`, and the same names are commands.

In `@rebodocs/core`, `trackEdit(before, after, by)` tracks any edit to a text: whatever the edit was, what it removed comes back marked as deleted, and what it added is marked as inserted. `trackDocEdit` does the same for the whole document, with its headers, footers and notes, word by word. `acceptRevisions`, `rejectRevisions` and `decideAllRevisions` settle the changes, and `revisionsOf` lists them. A change is part of the formatting of its text (`revision`, `revisionAuthor` and `revisionDate` on a run; `markRevision` on a paragraph for its mark). So it moves with the text, into the file, to the other people in a shared document, and into undo.

## For an assistant

The MCP server has `track_changes`, `list_changes`, `accept_changes` and `reject_changes`. While tracking is on, everything the other tools change is tracked too, signed "Assistant", so that a person can review what the assistant did before keeping it. `read_document` shows inserted text as `{+…+}` and deleted text as `[-…-]`.

## Checked against Word

Documents with insertions, deletions, a split paragraph and a joined one were opened in Word for Mac. Word found the same changes, with the same authors. Accepting all of them, and rejecting all of them, gave the same text in Word as here. Changes made in Word read back the same way, and a file opened and saved without changes keeps its XML.

## What it does not do

- Formatting changes are kept in the file but not shown, listed, accepted or rejected here.
- Changes to the shape of a table are not tracked: inserting a table, or a row or column, while tracking is on happens untracked. Rows Word tracked as inserted or deleted are kept, not shown.
- A move is read as a deletion and an insertion, and written back as such.
- The document always shows every change. There is no view of how it would look with all of them accepted, or with none.
