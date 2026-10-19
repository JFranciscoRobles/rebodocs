# Editor API

The `Editor` is what everything else talks to. You get it from `new Editor(element)`, from `useDocs().editor`, or from the handle of the React component (`handle.editor`).

This page lists what is used most. The class has more; its source, `packages/editor/src/editor.ts`, documents every public member.

## Positions and the selection

A position is `{ para, offset }`: the index of a paragraph, and of a character in it. The selection is an `anchor` and a `focus`.

```ts
editor.selection;                                   // { anchor, focus }
editor.range;                                       // { from, to }, in order
editor.collapsed;                                   // a caret, not a range
editor.selectedText;
editor.setSelection({ para: 2, offset: 0 }, { para: 2, offset: 12 });
editor.selectAll();
```

In a header or footer, positions are those of its own text: `editor.area` says which is being edited, and `editor.setArea('header')` goes into one.

## The document

| Member | What it does |
| --- | --- |
| `doc` | The document, as an immutable `Doc`. |
| `load(doc)`, `loadDocx(bytes)` | Open another document. |
| `exportDocx()` | The document as a DOCX. |
| `exportPdf(title?)` | As a PDF, page for page as shown. A promise. |
| `exportMarkdown()` | Its text as Markdown. |
| `print()` | The browser's print dialog, with the pages. |
| `edit(change, reveal?)` | Changes the document as a whole from outside, as one step to undo: `editor.edit((doc) => fillVariables(doc, values))`. |
| `onChange(listener)` | Called on every change of document or selection. Returns how to stop. |
| `pageCount`, `currentPage` | |

## Editing

| Member | What it does |
| --- | --- |
| `insertText(text)`, `insertParagraphBreak()`, `insertPageBreak()` | |
| `deleteBackward()`, `deleteForward()` | |
| `toggleMark('bold' \| 'italic' \| 'underline' \| 'strike')` | |
| `setRunProps({ fontFamily, fontSize, color, highlight, … })` | Character formatting of the selection, or of what is typed next. |
| `setParagraphProps({ align, lineHeight, spacingBefore, indentLeft, … })` | |
| `setParagraphStyle(id)`, `styles`, `activeStyleId()` | Paragraph styles: Normal, Title, Heading 1… |
| `toggleList('bullet' \| 'number')`, `shiftListLevel(±1)`, `shiftIndent(points)` | |
| `undo()`, `redo()`, `canUndo`, `canRedo` | |
| `activeRunProps()`, `activeParagraphProps()` | The formatting at the selection, fully resolved. |

## Tables, pictures, links, comments

| Member | What it does |
| --- | --- |
| `insertTable(rows, columns)` | |
| `insertTableRow(below)`, `insertTableColumn(right)`, `deleteTableRow()`, `deleteTableColumn()` | |
| `deleteTable()` | Removes the whole table the caret is in; for a table inside a cell, only that one. |
| `mergeTableCells()`, `splitTableCell()`, `setTableBorders(on)` | |
| `setTableCellProps({ borders, line, shade, valign })` | The cells the selection covers: their borders, the line they are drawn with (single, double, dashed, dotted), the colour behind them, and where the text sits. |
| `setTableRowHeight(points, exact)`, `setHeaderRow(on)` | The caret's row: its least height, or an exact one (0 for as tall as it holds), and whether it repeats at the top of each page. |
| `activeCellProps()` | The cell at the caret: `borders`, `shade`, `valign`, `line`, `header`, `height`, `exact`. |
| `insertImageFile(file)`, `insertImageGrid(files, columns)` | |
| `setPictureWrap(wrap)`, `fitSelectedPicture(fraction)` | |
| `setLink(address)`, `removeLink()`, `activeLink` | |
| `addNote(text)`, `setNoteText(id, text)`, `removeNote(id)`, `notes` | Comments, as Word has them. |
| `insertToc()`, `updateToc()`, `outline`, `goToHeading(para)` | |
| `trackChanges`, `setTrackChanges(on)`, `revisions`, `acceptRevision()`, `rejectRevision()`, `acceptAllRevisions()`, `rejectAllRevisions()`, `goToRevision(dir)` | Tracked changes, as Word's (⌘⇧E / Ctrl+Shift+E). See [tracked changes](/docs/tracked-changes/). |
| `restoreVersion(doc)` | Takes the document back to an earlier version of it, as one step to undo. See [versions](/docs/versions/). |
| `readOnly` | Set it, and nothing typed or done changes the document; it can still be selected and copied. |
| `goTo(pos, part?)` | Puts the caret at `pos` and brings it into view: in the text, or in a header, footer or note (`part`). |

Dragging works too: the edge between two columns moves it, the bottom edge of a row makes it taller or shorter, and the bottom right corner of a table makes the whole table larger or smaller.

## Columns

| Member | What it does |
| --- | --- |
| `columns` | The columns of the section the caret is in: `count`, `space`, `widths` when they are not all as wide, `separator`. |
| `setColumns(columns)` | With a caret, the section it is in; with a selection, the selected text alone, as a section of its own on the same page. |
| `insertColumnBreak()` | What follows the caret starts at the top of the next column. |
| `insertTextBox(text?)`, `textBoxes` | A text box anchored to the caret's paragraph, the text going round it, with the caret taken into it; the text boxes and their text. A click in a box edits it (`area` is then `'textbox'`); a click on its edge selects it, to drag it elsewhere. |
| `insertFootnote(text?)`, `footnotes` | A note at the foot of the page at the caret (⌘⌥F / Ctrl+Alt+F), with the caret taken into it; the notes the text refers to, with their numbers. A click on a note edits it: `area` is then `'footnote'`. |

## Templates

| Member | What it does |
| --- | --- |
| `variables` | The names of the variables in the document. |
| `insertVariable(name)`, `selectVariable(name)` | |
| `fillVariables(values)` | Replaces them, as one step to undo. |
| `insertSignatures(titles)` | A block of signature lines. |

## The page

| Member | What it does |
| --- | --- |
| `page`, `setPage({ width, height, marginTop, … }, everywhere?)` | Size and margins, in points, of the section being edited (the caret's, or that of the page whose header is open); with `everywhere`, of every section. |
| `sectionCount`, `sectionIndex`, `sectionPages()`, `setSectionPages(pages)` | The sections, the one being edited (from 0), and the page of each. |
| `ownHeaders`, `setOwnHeaders(on)` | Whether a section before the last has a header and footer of its own; without, it shows the document's, which are the last section's. |
| `setPageNumbering(numbering)`, `pageNumbering` | |
| `firstPageDifferent`, `setFirstPageDifferent(on)` | A header and footer of its own for the first page of the section. |
| `hasLetterhead`, `letterhead`, `setLetterheadFile(file)`, `fitLetterheadMargins()`, `removeLetterhead()` | See [letterheads](/docs/letterhead/). |

## Finding

```ts
editor.find('deposit', { matchCase: false });   // how many it found
editor.findStep(1);                              // to the next one
editor.replaceFound('advance');
editor.replaceAllFound('advance');               // as one step to undo
```

## The view

The view is the editor's, not the document's: it is not saved in the file.

| Member | What it does |
| --- | --- |
| `zoom`, `setZoom(1.5)` | 0.25 to 4. |
| `fit`, `setFit('width' \| 'page')` | A zoom that follows the size of the window. |
| `view`, `setView('column' \| 'spread' \| 'grid' \| 'flow')` | One page, two across, a grid, or text as wide as the window. |
| `setShowNotes(on)` | Comments in a margin beside the pages. |
| `autoformat` | Whether typing `# `, `- ` or `**bold**` formats as Markdown would. On by default. |
| `focus()` | Gives the keyboard to the document. |
| `element` | The element the pages scroll in. |
| `destroy()` | Takes everything away. |

## Units

Everything is in points (1/72 of an inch), as in Word: page sizes, margins, indents, font sizes. A Letter page is 612 × 792.
