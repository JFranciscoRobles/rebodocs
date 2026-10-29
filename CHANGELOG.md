# Changelog

Every package of Rebodocs is released at the same version, but for a patch
(0.x.y) of one package alone, which says which. Before 1.0, a minor version
(0.x.0) may change the API; such changes are listed under **Changed** with
what to do about them.

## 0.13.0

### Added

- **Taking every note away at once**: `removeAllNotes(doc)` in
  `@rebodocs/core`, `editor.removeAllNotes()` (and the command of the same
  name in `@rebodocs/react`), and `removeAll()` in `useDocsNotes`. The text
  the notes were about stays; in the editor it is one step to undo. The
  Review menu of `createToolbar` has **Delete all notes**, off while there
  are none.

### Fixed

- **The other button of the mouse** on the pages brings up the bubble with
  Copy, Cut, Paste and Select all, in place of the browser's menu, which
  could not copy or paste text it did not draw. Pressed inside the selection
  it keeps it; elsewhere the caret goes there. The editor calls the new
  `onMenu` for it; without anything set there, the browser's menu stays.

- **The types of `DocsViewer` in `@rebodocs/react`** say it gives a
  `ReactNode`, as the other components do: its declaration had every
  property of `CSSProperties` written out in it, 75 KB; it is 1 KB. (In
  `@rebodocs/viewer/react` since 0.12.1.)
- The status of each package's README says 0.12.

## 0.12.1

Of `@rebodocs/viewer` alone; it asks for `@rebodocs/core` and
`@rebodocs/editor` 0.12.0.

### Fixed

- **The types of `DocsViewer`** in `@rebodocs/viewer/react` say it gives a
  `ReactNode`, as the other components do: its declaration had every
  property of `CSSProperties` written out in it, 75 KB; it is 1 KB.
- Its README says 0.12.

## 0.12.0

### Added

- **Pictures are pasted.** Copied in this editor, a picture goes with its
  text, its size and what it shows, and to other programs as an `<img>` they
  read. Pasted from Word for Mac, the pictures come from its HTML at the
  size its VML says, in points; from Word on Windows, whose HTML only names
  them on the computer, from the RTF it puts beside it (`\shppict`, PNG or
  JPEG); from a web page, fetched when its server lets the page read them;
  and a picture copied alone, from the file the browser was given with it.
  What cannot be read is left out, and the text around it stays. In core,
  `ClipRun.image` (`ClipImage`: a `data:` address, its size in points and
  what it shows), written by `clipOf` and put in by `insertClip`.
- **Tests of the toolbar, the side panel and the status bar in Chrome**,
  driven as a person drives them, and of pictures pasted from what Word for
  Mac really put on the clipboard (`test/fixtures`).
- **`@rebodocs/viewer`, a package for a document only to read.** For an
  application that shows documents and does not edit them: `createViewer(element,
  docx)` takes the bytes of a .docx (or a `Doc`), and `<DocsViewer docx>` is in
  `@rebodocs/viewer/react`, React being an optional peer. The editor read
  only, with no caret, one page under another and each whole on the screen,
  or all of them at once as large as lets them fit (down to the least zoom
  for a long one); the status bar floats over the pages, saying the page in
  view as they scroll, without the notes, the flowing text and the language,
  its views setting the pages out the same way; `print()` and `setLayout()`.
  About 160 KB with gzip in an application, against about 260 KB for the
  whole editor. `@rebodocs/react` has `DocsViewer` too.
- **The first page for a thumbnail.** `pageThumbnail(docx)` gives it as the
  editor draws it, its pictures as data, out of sight and one at a time;
  `pagePicture(docx, size, { type, quality })` as a JPEG or a PNG, drawn
  through an SVG onto a canvas, its pictures in it.
- **`page: 'view'` for the status bar**: it says the page most in view
  rather than the caret's, for pages only read.
- **`apps/viewer`**: a shelf of documents with their thumbnails, each opened
  in the viewer (`npm run viewer`), and its page on the site, "A document
  only to read".
- **Chinese.** A line of Chinese (and Japanese) breaks between any two
  characters, as in Word, never before a closing mark such as "。", "，" or
  "」" nor after an opening one such as "「" or "（"; a justified line of it
  stretches between its characters. The font of the Chinese characters of a
  run (`w:eastAsia`) is read, kept and written as `fontEastAsia`, and a font
  for Chinese chosen in the toolbar is written as that too; the line is as
  tall as that font makes it. A double click selects a word of it and
  Ctrl/⌥ + arrow moves a word at a time, as the browser's dictionary for
  Chinese finds its words; each character counts as a word, as in Word;
  spelling leaves it alone and checks the latin words beside it; versions
  compare it, and `trackEdit` with `words` tracks it, a character at a time,
  not a sentence at once; "Whole words only" finds a word beside
  it. In a PDF, a Chinese character the font has not is drawn in the font
  for Chinese the document carries, or else in the one every reader has
  (STSong-Light, MSung-Light for Taiwan and Hong Kong), where the layout put
  it. Date variables take 2026年10月12日 and 今天.
- **The interface in Simplified and Traditional Chinese**, in
  `@rebodocs/editor/locales/zh-Hans` and `/zh-Hant`, for an application to
  give with `addLocale` (not in the editor's own bundle): `zh-TW`, `zh-HK`
  and `zh-Hant` find the Traditional one, any other Chinese tag the
  Simplified. With either, the toolbar offers the fonts Word has for it.

### Changed

- **`addLocale` takes the browser's language** while the application has
  not set one: a browser in Chinese shows Chinese once `zh-Hans` is added,
  without `locale`. After `setLocale`, or with the `locale` prop, nothing
  changes. An application that adds a language and wants English anyway
  says so with `setLocale('en')`.

### Fixed

- Escape in a menu of the toolbar opened from the keyboard gives the
  keyboard back to the button of the menu, as it says, and not to the
  document: the page's own Escape ran first.

## 0.11.0

### Added

- **A menu of commands with "/".** Typed at the start of a paragraph or
  after a space (not in 12/05, y/o or an address), a "/" brings up a menu of
  what can be put there or made of the paragraph: Normal, headings 1 to 3,
  bulleted and numbered lists, a table, a picture, a page break, a table of
  contents, a text box, a footnote, a variable, the signatures and a note on
  the word before. What is typed after it narrows the list, without minding
  accents ("titulo" finds "Título"); the arrows choose, Enter or a click does
  it in place of the "/" and what followed it, and Escape leaves them as
  text. Only what can be done where the caret is is offered. On a phone it
  sits over the caret when there is no room under it, above the keyboard. In
  the whole editor it is on unless `features.slash` is false; headless, with
  `slash: true` (the variable and the note need `bubble: true` too). On its
  own: `createSlashMenu(editor, { ask })`.
- **Commands of your own in the "/" menu.** `features.slash` (and the
  headless `slash`) take settings in place of `true`: `builtIns`, which of
  the menu's commands to keep (`false` for none, or their ids: `heading1`,
  `table`, `signatures`…), and `commands`, the application's own, each with
  a `label`, a `group` to go under, `keywords`, and what it does: `text` (a
  paragraph per line), `html` (with its formatting, as pasting it would) or
  `run(editor)`; `when(editor)` says where it is offered, and `commands` may
  be a function asked each time the menu opens.
- **A list of the variables at "{{".** Two braces bring up the variables the
  application fills (`variables`, with a `title` or an `example` each), then
  those the document already uses, narrowed by what is typed after them;
  the one chosen is written whole. A name that is in neither is offered as a
  new one. A `}`, `#` or `|` leaves the list, for blocks and formats written
  by hand. On in the whole editor unless `features.variableSuggestions` is
  false; headless, `variableSuggestions`; on its own,
  `createVariableSuggest(editor, settings)`. The list of the "/" menu and
  this one are the same piece, `createTypeahead`, for lists of your own.
- **Areas to fill in.** A document can be restricted to some areas of its
  text: only they can be changed, and the rest read, copied and noted on, as
  Word's Restrict editing with exceptions for everyone. A change outside them
  is not made (`editor.onRefused`), the areas flash and a screen reader is
  told; Tab and Shift+Tab go from one to the next. In the file they are
  Word's own marks (`w:permStart`, `w:permEnd`) and protection
  (`w:documentProtection w:edit="readOnly"`, without a password), so Word
  restricts it too, and a Word file restricted this way opens restricted.
  `editor.makeEditable()`, `removeEditable()`, `setRestricted()`,
  `nextEditable()`, `editableRanges`, `activeEditable`, `restricted`; in the
  core `addEditableRange`, `removeEditableRange`, `editableRanges`,
  `editableAt`, `setRestricted`, `keepsOutside` and `Doc.restricted`. With
  `features.forms` (off unless true) the interface marks them: the Review
  menu, the bar beside a selection and the "/" menu. In a room, restricting it
  reaches everybody, and what the backend keeps is restricted too.
- **The side panel open from the start**: `features.panelOpen`, true or the
  tab to open it on, on a window wide enough for it to go beside the pages.
  The panel says whether it is open (`panel.isOpen`) and when that changes
  (`onToggle` in `createPanel`); in another language it stays as it was.

- **No work lost when the collaboration server stops all at once.**
  `backendStorage({ log: true })` (`--backend-log`) gives the backend every
  change as it comes, on three more routes (`PUT`, `POST` and `GET
  url/<id>/changes`), as lines of text it keeps and gives back; a room that
  opens with a log starts again from where it was, with the same epoch, so
  the editors in it come back as from a dropped connection, with what they
  had not sent. The `PUT` that ends a session ends the log too. Without it,
  a hard crash still loses up to `saveEvery` of work.
- **The collaboration protocol has a version** (`PROTOCOL`, 1). The editor
  says it when it comes in (`v`), the server says its own in `hello` and in
  `/collab/ping`, and when they differ the editor is turned away saying so,
  instead of having its changes refused one by one. One that says none, as
  every editor and server of before, speaks 1. A closed `Session` says why
  in `reason`: `'left'`, `'not-found'`, `'denied'`, `'removed'` or
  `'outdated'`, and `DocsEditor` tells the person which.
- **Taking access away at once, from the backend**: with `recheckKey` (the
  `--backend-key` from the command line), `POST /collab/rooms/<id>/recheck`
  and `POST /collab/recheck` have the server ask `/access` again right
  then.
- **Several processes**: `instance` (`--instance`) names each one, in
  `X-Rebodocs-Instance` and `/collab/ping`, and the collaboration page has
  the recipe to route each room to one process by its id.
- **Pictures in templates.** `{{logo | image}}` (in Spanish, `imagen`) is
  filled with a picture: its value is the picture as a `data:` address of a
  PNG, a JPEG or a GIF (`data:image/png;base64,…`), so it travels in a JSON
  as any other value. It goes in at its own size, at 96 pixels an inch, or
  at the width the format says (`{{logo | image: 4cm}}`, in `cm`, `mm`,
  `in`, `pt` or `px`), its shape kept, or at both (`image: 2in x 2in`); never
  wider than the text of the page. In a block, each item gets its own; in a
  header or a footer, it stays there; the same picture used twice is kept
  once. A value that is not a picture puts nothing in, and
  `variableProblems` says it. `pictureRun` and `pictureSize`, in the internal
  API, are what `insertImage` is made of.

### Changed

- **The button of the side panel is at the end of the toolbar it opens on**,
  beside the search, with an icon of a panel on that side: on the right, as
  the panel comes, and at the start with `panel: 'left'`. It is pressed while
  the panel is open and shows how many notes and changes there are; its name
  says what the panel holds. `createToolbar` takes `panelOpen` and
  `panelSide` for this; without them the button is on the right and is not
  shown pressed.
- **The files the editor and the engine make go to `fetch` and `Blob` as
  they are.** `exportDocx`, `exportPdf` and `renderPdf(...).pdf`, the
  editor's `exportDocx()` and `exportPdf()`, what `onSave` and
  `versions.save` are given, and the handle's `exportDocx()` are typed
  `Uint8Array<ArrayBuffer>`, which they always were: with TypeScript 5.7 or
  later, `body: docx` and `new Blob([docx])` no longer need `as BodyInit` or
  `as BlobPart`. A function of yours given to `onSave` or `versions.save`
  that names its parameter `Uint8Array` still works, and the casts there
  were can stay.

## 0.10.0

### Added

- **Endnotes.** Notes at the end of the document, as Word's: read from and
  written to `endnotes.xml`, numbered i, ii, iii (or as the file says, in
  `w:endnotePr`), set out after the last line of the text under a short line,
  and on pages of their own after it when they do not fit, under a line as
  wide as the text. Or at the end of each section, when the file says so
  (`w:pos="sectEnd"`, `Doc.endnotesAt`): what follows on the page goes on
  under them, and a section that says `w:noEndnote` (`Section.noEndnotes`)
  leaves its notes to the next. `noteRules(page)` gives every line over notes
  on a page, of which there may be several. In the editor, the page menu sets
  where they go and how the section numbers them (`editor.setEndnotesAt()`,
  `editor.setNoteNumbering('endnote', …)`). Measured against Word, the three
  cases of where they go lay out as Word's, line for line. In the editor: *Insert ▸ Endnote* (⌘⌥D / Ctrl+Alt+D), a click on
  one to write in it, `editor.insertEndnote()`, `editor.endnotes` and the area
  `'endnote'`; in the core, `insertEndnote`; for an assistant,
  `insert_endnote`, the area `"endnote"` with `area_endnote`, and `[^i]` in
  `read_document`. They are compared between versions, tracked, tagged in the
  PDF, and edited together in a room.

- **Notes numbered as each section says**, at the foot of the page and at the
  end: in `w:footnotePr` and `w:endnotePr` of the section
  (`Section.footnoteNumbering`, `Section.endnoteNumbering`, and those of
  `Doc` for the last), the format, the number the count starts at, and
  whether it starts again in the section or, at the foot of the page, on each
  page. As Word does, measured with twelve files that differ in it: what a
  section does not say it does not take from the one before, the count goes
  on through the document moved on by its start (from 3, the third note shows
  5), and what the settings of the document say of it is not read. Notes
  that start again on each page are numbered once the pages are known.
  `noteNumberingOf` and `setNoteNumbering` in the core,
  `editor.noteNumbering()` and `editor.setNoteNumbering()`, and in React,
  `useDocsPage()`'s `endnotesAt`, `noteNumbering` and their setters, which the
  interface of the demo built on the hooks uses.

- **Pasting a table.** A table copied from Word, Google Docs or a web page
  comes in as a table: its cells and the paragraphs in each, cells merged
  across rows and columns, the widths of its columns fitted to the page and
  its heading rows. One of a single cell, or one a page is laid out with
  (`role="presentation"`), comes as its text; a table inside a cell comes as
  lines, cells apart by a tab, as a table in a table is not modelled. A table
  copied from the editor goes to Word and Google Docs as a table, and comes
  back whole. `Clip.tables` and `ClipParagraph.cell` in the core. Measured
  with what Word for Mac puts on the clipboard for sixteen tables of a file
  of its own: the colour of each cell, the line of each side as Word has it
  (not the thicker one it shows a browser), where its text sits, the height
  of each row, white text, and the places Word keeps for a row set further
  in. The colours a table style gives its bands Word does not put in the HTML
  (it writes white), and they do not come. Copied from the editor, a table
  takes its colours, lines and heights to Word too (`ClipTable.cells`,
  `ClipTable.heights`).
- **Documents to measure against Word, in the repository.** `test-documents/`
  keeps 47 documents made up for it (contracts, floating pictures, a
  brochure, tables in every way Word makes them, and one probe for each rule
  of Word measured), each with the PDF Word for Mac made of it.
  `npm run word-check` lays them all out in one run and fails when one has
  fewer lines where Word puts them than `test-documents/expected.json` says;
  no Word is needed. `word-compare` takes several documents or a folder, and
  never closes a Word that was already open.
- `npm run contract-cases`: six contracts made to measure the layout against
  Word where it was weakest (justified text, lists, long tables, sections,
  columns, text kept together), in Times New Roman, Georgia, Verdana and
  Arial, and three of endnotes. All but one lay out exactly as in Word.
- `npm run bench`: how long the engine takes on a long document, to compare
  before and after a change. `npm run coverage`: what the tests reach.
- Damaged files: a test reads thousands of DOCX broken at random (an element
  or an attribute taken out, a value no program writes, a part cut short) and
  asks that each be read or refused with a reason, never failing inside the
  engine. 20,000 went through without one.

- **`edit_document`**: several changes at once (replace, rewrite, insert,
  delete, style, list, format, link, note, page break), all or none, with
  every paragraph number taken from the document as it was read: an assistant
  no longer reads again after each paragraph it inserts or deletes.
- **`read_pages`**: how a document falls on its pages, in words, and what may
  want mending: a paragraph cut by a page, a heading left at the foot of one,
  a page of a line or two, a table over pages, a blank page. On files and in
  the editor (`editor.layoutOf(doc)`, `layoutOf` of `AssistantHost`).
- **Clauses.** `move_section` moves a heading with everything under it, as
  dragging it in the outline does. `renumber_clauses` puts in order the
  numbers written at the start of the headings of clauses ("Primera.",
  "CLÁUSULA 3.", "IV."), keeping how each is written, and says where the text
  names a clause whose number changed.
- `set_cell_text`: the text of a table cell by its table, row and cell, empty
  or not: the way to fill a row just put in.
- **Keeping together.** `keep_together` and `allow_split` in `edit_table`: no
  row cut by a page, and each row kept with the next, as Word keeps a table
  whole; `keep_lines_together` in `format_paragraphs`. A block of signatures
  goes to the next page only when it does not fit; a page break before it
  breaks the page even when the text above has grown shorter.
- `undo` on the server: the last changes to a file that is open, up to 50.
- **`assistantHandler`** in `@rebodocs/mcp/claude`: the backend of the chat
  for servers of Request and Response (Next.js, Hono, Bun, Deno, Workers).
- `key`, `context` and `toolSearch` on `assistantRoute` and
  `assistantHandler`: count `perMinute` per user instead of per address,
  tell Claude what the application knows after its instructions, and have
  Claude search for the less used tools instead of reading all on each step.
- **Streamable HTTP**: `rebodocs-mcp --http 7412` listens at `/mcp`, a session
  for each client, `Authorization: Bearer` when started with `--token`.
- A title for each tool, and `readOnlyHint`, `destructiveHint`,
  `idempotentHint` and `openWorldHint` on all of them, the server's own
  included: a client can let the reading ones run without asking.
- `notifications/cancelled`: the server stops waiting for the editor and
  does not answer the call. `--timeout` sets how long it waits (30 seconds).
- Protocol version 2025-11-25.
- `npm run eval:assistant`: nineteen cases through the chat and the route as
  they ship, against the Claude API, graded on the document each leaves; with
  `--claude-code`, through Claude Code and the MCP server, on a .docx file.

- **Collaboration: rooms that stay open all day.**
  - A room people never leave folded its changes into its file only once
    they all left, so its log grew all day and whoever came in had to make
    every change of it. It is now folded at the next pause once it has 1000
    changes (`foldAfter`), with everybody still in it. Each editor loads the
    new file and makes on it what it had not sent, under the paragraphs' new
    ids, keeping what it can undo. It folds only when the file reads back as
    the document it was written from.
  - The document is given to the backend 5 seconds after the changes stop
    (`saveAfter`, `--save-after`), and at least every 30 while they go on,
    so a hard crash loses seconds and not half a minute.
  - `recheckEvery` (`--recheck-every`) and `server.recheck(room)` ask
    `/access` again whether each person may still be in. Whoever it turns
    away is sent out (`removed`), and whoever it now lets only watch, or
    edit, comes back as that.
  - `onEvent` is told who comes and goes, each fold, save and removal, and
    what goes wrong, which then no longer goes to the console.
  - Each person may send 200 requests at once and 50 a second, and a caret
    may weigh up to 64 KB; past that, the server answers 429 and the editor
    tries again.

- **The editor tested in a browser.** `npm run test:browser` makes an editor
  on a page in Chrome, without a window, and gives it keys, clicks, touches,
  the clipboard and text a keyboard composes: thirty tests of what it does
  with them, of the pages it draws and of the files it makes.

### Changed

- **`packages/editor/src/editor.ts` in pieces.** It was 5,400 lines; the
  `Editor` keeps its API and its state, in 3,000, and what it does on the
  screen is in pieces of their own: `painter.ts` (what is drawn),
  `pointer.ts` (the mouse and the fingers), `keys.ts` (the hidden field and
  the clipboard), `spelling.ts` and `pdfexport.ts`. Nothing changes for
  whoever uses it: its published types have the same members.
- Vitest 5.0.5, for a flaw of 5.0.4 that let its server give out files such
  as `.env`, the one the tests in a browser open.
- **Collaboration: update the editors with the server.** An editor now sends
  a key with everything it sends (see *Fixed*). An editor of an earlier
  version comes into a room of this server and sees the others type, but
  what it changes is not taken; an editor of this one works with a server of
  before. `folderStorage` writes
  asynchronously, in order for each room, rather than blocking the process;
  the server's messages are in English. Without `--data`, `--memory` or
  `--backend`, the command keeps rooms in `./rooms`, not `./salas`: move that
  folder, or pass `--data salas`, to keep the rooms you had.
- **Collaboration: update the server and the editors together.** A note at
  the end is a part of its own (`endnote:<id>`) in the changes a room sends;
  a server of an earlier version does not know it, so an editor of this one
  writing in an endnote, in a room of a server not updated, is not kept.
- **The API of `@rebodocs/core` is what it says it is.** It exported every
  name of every file of the engine, 404 of them, its insides among them; it
  now exports 231, chosen: what the documentation, the demos and the READMEs
  use, and every type their declarations name, which a test checks. `packages/core/API.md` says
  each as the source has it, and a test fails when the two differ, so that a
  change of the API shows in a diff. The rest is in `@rebodocs/core/internal`,
  for the packages of the repository, with no promise: if you used a name
  that is no longer in `@rebodocs/core` (such as `parseXml`, `hitTest` or
  `storyOf`), import it from there for now, and say what you use it for, so
  that it can be made public.
- `Tool` (of `@rebodocs/mcp`) has a `title`, and may say `idempotent`. A tool
  of your own made to that type needs a `title`.

### Fixed

- **Shift+Enter made a new paragraph** instead of a new line in the same
  one, as Word makes: the editor typed a line break with `insertText`, which
  starts a paragraph at each line break, as a paste of several lines does.
  It is `editor.insertLineBreak()` now, which the key uses.
- **Collaboration: what was typed while away was lost** when the room's
  changes were folded into its file meanwhile: everybody left, or the server
  started again and read the document from the backend. The editor coming
  back now tells which paragraphs of the new file are those it had by what
  they read, takes what the others did as the change from one to the other,
  and makes what it typed after it, as two people typing at once. A room
  read from the backend also has an epoch of its own each time
  (`backendStorage`), so that an editor coming back cannot take the room's
  new changes as following from the old file.
- **Collaboration: what was typed as someone else's change came.** An edit
  the editor had not yet looked at when a change of someone else's arrived
  could be sent as if made after it, without being adjusted to it. What the
  person did is now taken first, and adjusted like the rest. The browser
  client is now three parts: what keeps it in step with the room
  (`sync.ts`), what looks at the editor (`mirror.ts`) and what talks to the
  server (`session.ts`); the server's rooms are in `room.ts`, without HTTP;
  and what both sides say to each other is typed once, in `protocol.ts`.
- **Collaboration: someone let in only to watch could edit.** The server took
  what was sent in the name of any client id in the room, and every id is
  sent to everybody to draw the carets. A viewer, or anyone in the room,
  could therefore send changes as an editor, or connect with that editor's
  id and turn them read-only, or give them another name. Each editor is now
  given a key of its own on coming in, and nothing is taken without it.
- **Layout, as measured against Word.**
  - A heading kept with the paragraph after it was left alone at the foot of
    the page when that paragraph keeps its lines together and goes whole to
    the next one; it now goes with it, as in Word.
  - A paragraph that starts a page (page break before) started lower than in
    Word: the space below the paragraph before still counts against the space
    it asks for above it, as between two paragraphs on a page. 20 pt above
    after 8 below starts 12 pt down, not 20.
  - In the editor, the browser measured text a little narrow (some 0.05% of a
    line), so a word Word sends to the next line could fit on this one. Text
    is now measured large and scaled down, which matches the font files to a
    hundredth of a point.
  - Text was not kerned. Word sets the pairs of letters a font lists closer
    (with its `kern` table, a space and the letter after it too) when the run
    is as big as its `w:kern` or bigger, and kerns every run of a file that
    gives no defaults for runs. The layout, the editor and the PDF now kern as
    it does; `RunProps.kern` holds the threshold, read from and written to
    `w:kern`. In the browser, Times New Roman is kerned but for its pairs
    with a space, which only the PDF has.
  - With a line spacing above single, the last line of a page went to the
    next when the room under its text did not fit; in Word only its text has
    to, and the rest may run past the foot. With single spacing nothing may:
    the point and a half a line could run past the foot is gone.
  - In the editor, the height of a line of Arial 11 came out 0.015 pt taller
    than the font file says, which over a page sent two lines Word keeps on
    it to the next. The browser's metrics are read larger now, to 0.002 pt.
  - Cells that stand apart (`w:tblCellSpacing`) shared the line between two
    rows, as touching cells do; each has its own, above and below, and the
    table its own line round them, which takes room too and is now drawn
    (`LayoutPage.frames`). A row of them was half a point short, which added
    up down a table.
  - A paragraph that ends in a column break has its end, an empty line, at the
    top of the next column, as in Word; the column started a line high.
  - A picture whose room reaches up into the lines of the paragraphs above it
    has those lines set round it too, the picture staying where it was, as
    in Word: a subtitle went below a banner, a heading beside a picture.
  - The lines of a paragraph that go on to the next page from beside a picture
    are broken again for the room there, as wide as the column.
  - A file that says no version of Word is laid out as Word opens it, as one
    of Word 2007 (`Doc.compatMode` 12): its tables line up by the text of
    their cells, their margins past the margin of the page.
  - The last line of a justified paragraph that ends a section runs across
    its column, as in Word.
  - The label of a list item is set in the formatting of its paragraph mark
    (`Paragraph.mark`, read from the file), as in Word, not in that of the
    text: a label of Arial made a line of Georgia taller.
  - A line of several fonts is as tall as the most any reaches above the
    baseline, its whole line gap included, and the most any reaches below
    (`FontMetrics.lineGap`): a bullet of Symbol needs no measure of its own,
    and lines of one font are as tall as before.
  - A cell merged down and cut by the page sets its text, in the middle, at
    the foot or on its side, in the rows of it on the page, as in Word.
  - Over notes at the foot of the page, the last line of a paragraph needs all
    of its line and the space below it, as in Word; it went in with a point or
    so too little.
  - A bullet of Symbol was measured in the font of the text it is drawn in;
    Word makes its line as tall as a line of Symbol, 12.24 pt at 10 where one
    of Arial is 11.5.
  - Together: a contract of tables and columns measured before has all its
    6 pages and 276 lines as in Word (it had 3 and 266), none more than 0.7 pt
    from where Word puts it, and the one in Arial across two sections all its
    lines.

- `perMinute` counted every user behind a proxy as one, and kept every
  address it had seen for as long as the server ran. The addresses not seen
  for a minute are now forgotten; give `key` to count per user.
- The version the server told a client was written by hand; it is now that
  of the package.

## 0.9.1

### Added

- `locale` and `locales` on `DocsProvider`, as on `DocsEditor`: the language
  of the texts the library still has in a headless interface (the bar beside
  the selection, what a screen reader is told), without calling `setLocale`.
- **A note on a variable describes it.** A note put on a variable, or on a
  part of it, is shown under its box in the panel of variables: in a template,
  what to fill it with ("As written on the ID"). `variableNotes(doc)` in the
  core, `editor.variableNotes(name)` in the editor.
- `inkOn(hex)`: black or white, whichever reads better on a colour.

### Fixed

- The name over another person's caret, and their initials in the bar at the
  bottom, were white on every colour of a room, which does not read on the
  orange, green and teal ones (3.1:1). They now take black or white,
  whichever stands out more: 4.5:1 or more on all eight.

## 0.9.0

### Added

- **Spell checking.** `createSpellChecker({ dictionaries })` reads Hunspell
  dictionaries in a worker (with nspell) and the editor draws a red wave under
  words spelled wrong, on the pages in view, in the language of the text.
  Suggestions, *Ignore* and *Add to dictionary* come in the bar beside the
  selection: right click, tap, or a tap of ⌘ (Ctrl) with the caret in the
  word. `spellcheck` prop on `DocsEditor` and `DocsProvider`;
  `editor.spellChecker`, `misspelling`, `spellingSuggestions()`,
  `replaceMisspelling()`, `ignoreMisspelling()`, `addMisspelling()`. No
  dictionaries are bundled.
- **Dark theme.** `theme: 'light' | 'dark' | 'auto'` on `DocsEditor` and
  `DocsProvider`, `editor.theme`, `handle.setTheme()`, and `applyTheme()` for
  an interface assembled by hand. Bars and menus shown outside the editor take
  it too; the pages stay white. `features.theme` puts the choice in the menu.
- **Long documents.** Only the pages near the view are drawn; the rest are
  empty boxes of their size, drawn as they scroll into view. Printing draws
  them all.
- **A new default interface.** Islands on a warm canvas: two rows of tools,
  the side panel on the right, the zoom floating over the pages, and the menu
  as a screen of its own. Other layouts through `features`: `toolbar`
  (`'tabs'`, `'row'`), `panel` (`'left'`, `'rail'`), `statusBar` (`'chips'`,
  `'bar'`), `menu` (`'card'`).
- The document menu stays inside the editor's box (`within` on
  `createSidebar`), instead of covering the whole window.
- `unsaved` prop: a draft the application kept opens as having unsaved changes.
- `handle.name`; the handle and `ref` are given on every mount.

### Changed

- **`DocsEditor` looks different by default** (see above). To keep a single
  row of tools, the panel on the left and a status bar under the pages:
  `features={{ toolbar: 'row', panel: 'left', statusBar: 'bar', menu: 'card' }}`.
- **Language defaults are English, or the document's**, no longer Spanish:
  the interface (the first of the browser's languages it speaks, else
  English), `formatValue`, `formatText`, `fillVariables` and the words of page
  numbers. Pass `locale`, `language` or `{ locale: 'es-MX' }` where Spanish is
  wanted regardless of the browser or the file.
- **`versions` moved from `DocsProvider` to `DocsEditor` and `mountDocs`**,
  where it was always used. `DocsProvider` never read it.
- Changing `features` makes the editor again with the document as it is,
  unsaved changes included; before, they were lost.

### Fixed

- The `ref` of `DocsEditor` was never set.
- `setPageNumbering` wrote Spanish words in documents of other languages.
- The description of documentation pages dropped any text in parentheses.
- `word-compare` did not decode `&apos;` and numeric entities.

### Documentation

- The documentation site was rewritten page by page, each claim checked
  against the code. `/llms.txt`, `/llms-full.txt` and a Markdown file per page
  for language models.
- `THIRD_PARTY_NOTICES.md` restored, with WordCraft's notice, and published
  inside each package.
