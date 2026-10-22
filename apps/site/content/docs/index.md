# What is Rebodocs

Rebodocs is a word processor for the browser, compatible with Word files (DOCX), with its own engine. The document model, line breaking, pagination, caret, selection, and the reading and writing of DOCX are written from scratch. It does not use ProseMirror, `contenteditable`, or any editing library.

It was built to live inside another application: a CRM that fills contract and receipt templates and lets people edit the result. So it comes as packages you take one by one.

## What you get

- **A word processor.** Formatting, styles, lists, tab stops, tables (with tables inside cells and text turned on its side), columns, sections with a page of their own, pictures, text boxes, headers and footers, footnotes, page numbers, links, comments, table of contents, find and replace.
- **Tracked changes**, as in Word: what is typed and deleted stays marked until someone accepts or rejects it.
- **Versions** kept by your application, compared word by word and restored.
- **Compatibility with Word.** It reads and writes DOCX, and breaks lines and pages by the same rules, so a document looks the same in both.
- **A file that survives.** What the editor does not understand stays in the DOCX untouched.
- **Templates.** `{{client}}` in any document is a variable to fill.
- **PDF and DOCX on a server**, with the same layout, without a browser.
- **Collaboration** in real time, with your backend keeping the files, and a version of each session of work if you want one.
- **A phone-ready editor**: fit to width, pinch to zoom, touch selection.

## The packages

| Package | Take it when |
| --- | --- |
| `@rebodocs/react` | You have a React or Next.js application and want the editor in a screen of it. |
| `@rebodocs/editor` | You want the editor in a page with no framework, or to build on its pieces. |
| `@rebodocs/core` | You generate or transform documents in code: fill a template, make a PDF. |
| `@rebodocs/collab` | Several people must work on the same document at once. |
| `@rebodocs/mcp` | An AI assistant should read and edit documents: Claude Desktop and other MCP clients, or Claude in a chat of your application. |

[Packages](/docs/packages/) says what each one holds and how they depend on each other.

## What it is not

- **Not a copy of Word.** Rebodocs is not a copy of Microsoft Word and does not try to be one. It is a word processor of its own, compatible with the DOCX format: it opens what Word saves, Word opens what it saves, and pages come out the same in both. It does not have every feature of Word, and it has some of its own, such as template variables. Everything it adds is saved so that Word opens it and shows it well.

- **Not a hosted service.** There is nothing to sign up for. It is code you run.
- **Not finished.** It is tested and published on npm, and it does not do everything yet. [Status and roadmap](/docs/status/) lists what is checked and what is missing, plainly.

## License

MIT. Anyone may use it for anything, including commercially, with no warranty.
