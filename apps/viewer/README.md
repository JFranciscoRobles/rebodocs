# Viewer

`@rebodocs/viewer` as an application uses it: documents only to read.

- **A shelf**: the documents, each with its first page as a thumbnail,
  made in the page with `pagePicture` (`src/App.tsx`).
- **A reader**: one of them opened in `DocsViewer`, one page under another
  or all at once, and printed.

```bash
npm run viewer        # from the root: http://localhost:5181
```

It starts with four documents that `scripts/samples.ts` puts in
`public/samples/`: three that Word saved, from `test-documents/`, and the
agreement `apps/demo` writes with the engine. `Open .docx` adds files of the
disk, several at once. Nothing leaves the page: there is no backend.

The server listens on the network too, to open the demo from a phone at the
address of this computer.

## Purpose

To show the smallest package for an application that shows documents and
does not edit them, and to try the viewer on a phone.
