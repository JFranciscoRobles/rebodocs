# Versions

A version is a copy of the document as it was at some moment, kept as a DOCX. Rebodocs does not store versions itself. Your application keeps them wherever it keeps its documents. Rebodocs lists them, compares any two of them, and takes the document back to one.

## In the editor

Give the component your versions, and the side panel gets a **Versions** tab:

```tsx
<DocsEditor
  docx={file}
  onSave={(docx) => upload(docx)}
  versions={{
    list: () => api.versions(documentId),
    load: (id) => api.version(documentId, id),
    save: (docx, { label, author }) => api.keepVersion(documentId, docx, label, author),
  }}
/>
```

The tab lists the versions, newest first. For each one there are two buttons:

- **See changes** shows, over the document, what changed from that version to the document as it is now. You can also compare it with another version instead. What was taken out is struck through in red, where it was. What was put in is underlined in green. The arrows (or Alt+↑ and Alt+↓) go from one change to the next, and **Unmarked** shows the version as it was. The document under the comparison is not touched.
- **Restore** puts the version in place of the document as one change. It can be undone.

With `save`, the tab also has **Save version**, with an optional name. Without `save`, versions are made only when your application makes them, for example each time the document is saved. The tab asks for the list again when it is opened, and after each save.

| Member | What it is |
| --- | --- |
| `list()` | The versions, as `{ id, date?, author?, label? }`, in any order. `date` is an ISO date. |
| `load(id)` | One version, as the bytes of its DOCX. A version does not change, so each one is read once. |
| `save(docx, { label?, author? })` | Optional. Keeps the document as it is now. `author` is the name the person signs their comments with. |

## In a real-time document

Restoring a version in a shared room sends the others only what changed, as any other edit does. Paragraphs that are the same in both stay as they are, and the pictures of the version travel with it. The collaboration server keeps no versions. With `--backend`, your system receives each save (`PUT url/<id>`), and the last one of a session of work, when everybody has left, says so with `X-Rebodocs-Session-End: 1` and names who changed the document in `X-Rebodocs-Authors`: the moment to keep a version, signed by them. See [a version for each session](/docs/collaboration/#a-version-for-each-session).

## In code

```ts
import { compareDocs, describeChange, importDocx, restoreVersion } from '@rebodocs/core';

const before = importDocx(earlierBytes);
const after = importDocx(laterBytes);
const { changes, doc, marks } = compareDocs(before, after);

for (const change of changes) console.log(change.kind, change.part ?? 'text', describeChange(change));
// changed text   El cliente paga [-cien-]{+doscientos+} pesos.
```

| | What it gives |
| --- | --- |
| `changes` | One entry for each paragraph that was put in (`added`), taken out (`removed`), changed (`changed`), or kept the same text with another look (`formatted`). Each has `before` and `after`, the paragraph's index in each version, and `part` when it is in a header, a footer or a note at the foot of the page (`'footnote:<id>'`). |
| `doc` | The later version with the changes marked, as shown in the editor. It can be laid out, printed or exported to PDF like any document. It is for reading, not for editing or keeping. |
| `marks` | Where each change starts in `doc`, for going from one to the next. |

`restoreVersion(current, version)` gives the document to put in place of `current`. The editor's `restoreVersion(doc)` does the same as one step to undo. `editor.readOnly = true` makes an editor for reading only, which is how the comparison is shown. You can draw your own with `createVersionView(editor, versions)` from `@rebodocs/editor`.

## For an assistant

The MCP server has `compare_documents`. It lists what changed between the open document and another version of it in a file, with `[-taken out-]` and `{+put in+}`.

## The storage demo

[The storage demo](/docs/storage/) keeps a version each time a document is saved. Each version is a file beside the document, under `versions/<document>/`. Its key holds the time it was kept, who kept it, and its name, so that one listing request gives them all.

## What it does not do

- A comparison is about what the document reads and how its text looks. It does not list changes to the page, the sections, the definitions of the styles, or the size of a picture. The shape of a table (rows and columns put in or taken out) shows only through the paragraphs of its cells.
- A change of look is listed, but not marked in the comparison.
- Paragraphs taken out of a table that is gone are shown, struck through, where the table was. They are not shown inside a table.
- A paragraph that changed is written back as an edit would write it. A paragraph that did not change keeps its own XML.
