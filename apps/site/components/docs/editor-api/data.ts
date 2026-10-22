// What the page "Editor API" says that is data: the members of the Editor, in
// groups, the types they take, and lengths in points. Each signature, what it
// returns and each "does nothing when" is the one in packages/editor/src/editor.ts.

import type { Pastel } from '@/lib/home';

export interface Member {
  /** One or more members described together, as `name(args) → returns`; the first names the row: `#editor-<name>`. */
  sigs: string[];
  text?: string;
  /** When it does nothing, so that nobody takes it for broken. */
  nothing?: string;
  /** A call of the editor on the page that shows it. */
  run?: string;
}

export interface Group {
  id: string;
  title: string;
  color: Pastel;
  intro?: string;
  members: Member[];
}

/** The name of a member, from its signature: `toggleMark(…)` is toggleMark. */
export const nameOf = (sig: string) => sig.match(/^[a-zA-Z]+/)![0];
export const memberHash = (sig: string) => `editor-${nameOf(sig)}`;

const BODY_ONLY = 'In a header, footer, note or text box: only in the text of the document.';

export const GROUPS: Group[] = [
  {
    id: 'selection',
    title: 'Positions and the selection',
    color: 'blue',
    intro: 'A Position is { para, offset }: the index of a paragraph, and of a character in it. The selection is an anchor, where it started, and a focus, where it ends.',
    members: [
      { sigs: ['selection: { anchor: Position, focus: Position }'], text: 'As made: the focus can come before the anchor.', run: 'select' },
      { sigs: ['range: Range'], text: '{ from, to }: the same, in order.' },
      { sigs: ['collapsed: boolean'], text: 'True for a caret, false for a range.' },
      { sigs: ['selectedText: string'], text: 'The text the selection takes in.', run: 'select' },
      { sigs: ['setSelection(anchor: Position, focus = anchor)'], text: 'Selects from anchor to focus; with one position, puts the caret there.', run: 'select' },
      { sigs: ['selectAll()'], run: 'selectAll' },
      { sigs: ['area: EditArea', 'setArea(area: EditArea, page?, note?)'], text: "What is being edited: 'body', 'header', 'footer', 'footnote' or 'textbox'. In a header or footer, positions are those of its own text." },
      { sigs: ['place: { part?, page: number }'], text: 'Where the selection is: the part, when it is a header or a footer, and the page it is being edited on.' },
      { sigs: ['goTo(pos: Position, part?)'], text: 'Puts the caret at pos and brings it into view: in the text, or in a header, footer or note.' },
    ],
  },
  {
    id: 'document',
    title: 'The document',
    color: 'purple',
    members: [
      { sigs: ['doc: Doc'], text: 'The document, as an immutable Doc: a new object after each change, so doc !== before says it changed.' },
      { sigs: ['load(doc: Doc)', 'loadDocx(bytes: ArrayBuffer | Uint8Array)'], text: 'Open another document. What could be undone starts over.' },
      { sigs: ['exportDocx() → Uint8Array'], text: 'The document as a DOCX.', run: 'docx' },
      { sigs: ['exportPdf(title?) → Promise<Uint8Array>'], text: 'As a PDF, page for page as shown, tagged for screen readers in the language of the text.' },
      { sigs: ['exportMarkdown() → string'], text: 'Its text as Markdown, its tracked changes accepted; as before them while the original is shown.', run: 'markdown' },
      { sigs: ['print()'], text: "The browser's print dialog, with the pages." },
      { sigs: ['edit(change: (doc: Doc) => Doc, reveal?: Position)'], text: 'Changes the document as a whole from outside, as one step to undo.', nothing: 'When change gives back the same document.' },
      { sigs: ['onChange(listener: () => void) → () => void'], text: 'Called on every change of the document, the selection or the view. Returns how to stop. See “Knowing when it changes”.' },
      { sigs: ['pageCount: number', 'currentPage: number'], text: 'How many pages, and the one the caret is on, from 1.' },
      {
        sigs: ['readOnly: boolean'],
        text: 'Set it to only show the document: it can be selected, copied and moved about.',
        nothing: 'While it is on, every method that changes the document does nothing, edit() and undo() included. load() and loadDocx() still open another.',
      },
      { sigs: ['restoreVersion(doc: Doc)'], text: 'Takes the document back to an earlier version of it, as one step to undo. See versions.' },
    ],
  },
  {
    id: 'editing',
    title: 'Editing',
    color: 'yellow',
    members: [
      { sigs: ['insertText(text: string)', 'insertParagraphBreak()', 'insertPageBreak()'], text: 'At the caret, over what is selected.', run: 'insert' },
      { sigs: ['deleteBackward(byWord = false)', 'deleteForward(byWord = false)'], text: 'As Backspace and Delete; byWord takes a word at a time.' },
      { sigs: ['toggleMark(mark: MarkKey)'], text: "'bold', 'italic', 'underline' or 'strike'.", run: 'bold' },
      { sigs: ['setRunProps(patch: RunProps)'], text: 'Character formatting of the selection, or of what is typed next.', run: 'red' },
      { sigs: ['setParagraphProps(patch: ParagraphProps)'], text: 'The paragraphs the selection touches.', run: 'center' },
      { sigs: ['activeRunProps() → Required<RunProps>', 'activeParagraphProps() → Required<ParagraphProps>'], text: 'The formatting at the selection, fully resolved: every field has a value.' },
      { sigs: ['setParagraphStyle(id: string)', 'styles: ParagraphStyle[]', 'activeStyleId() → string | undefined'], text: 'Paragraph styles: Normal, Title, Heading 1…' },
      { sigs: ['toggleList(kind: ListKind)', 'shiftListLevel(delta: 1 | -1)', 'shiftIndent(points: number)', 'activeListKind() → ListKind | undefined'], text: "Lists, 'bullet' or 'number'. activeListKind is the kind every paragraph of the selection shares, if one.", run: 'list' },
      { sigs: ['setListStyle(style: ListStyle)', 'listStyle: ListStyle | undefined'], text: "How the labels of the selection's list level are written. Every item of that level changes, as in Word." },
      { sigs: ['restartNumbering()', 'continueNumbering() → boolean'], text: "The caret's item and those after it count from 1 again, or go on with the list before of the same kind.", nothing: 'continueNumbering returns false when there is no list before to go on with.' },
      { sigs: ['undo()', 'redo()', 'canUndo: boolean', 'canRedo: boolean'], text: 'With several people on the document, undo takes back only your own steps.', run: 'undo' },
      {
        sigs: ['copy() → Promise<boolean>', 'cut() → Promise<boolean>', 'paste({ plain? }) → Promise<boolean>', 'insertClip(clip) → boolean', 'canPaste: boolean'],
        text: 'What is copied goes as text and as HTML, and comes back whole when pasted here. plain pastes the text alone, looking like the text around it.',
        nothing: 'paste resolves to false when the browser does not let the page read what was copied: canPaste is false outside HTTPS or this machine, and the browser may ask the person first.',
      },
      { sigs: ['autoformat: boolean'], text: 'Whether typing # , - or **bold** formats as Markdown would. On by default.' },
    ],
  },
  {
    id: 'tables',
    title: 'Tables',
    color: 'green',
    members: [
      { sigs: ['insertTable(rows: number, columns: number)'], run: 'table', nothing: 'Inside a table, or when canEditTables is false.' },
      { sigs: ['insertTableRow(below: boolean)', 'insertTableColumn(right: boolean)', 'deleteTableRow()', 'deleteTableColumn()'], nothing: 'When canEditTables is false.' },
      { sigs: ['deleteTable()'], text: 'The whole table the caret is in; for a table inside a cell, only that one.' },
      { sigs: ['mergeTableCells()', 'splitTableCell()', 'setTableBorders(on: boolean)', 'tableBorders() → boolean | undefined'], text: "tableBorders: whether any cell of the caret's table has borders.", nothing: 'mergeTableCells when canMergeCells is false; splitTableCell when canSplitCell is false.' },
      { sigs: ['setTableCellProps(patch: CellPatch)'], text: 'The cells the selection covers: borders, the line they are drawn with, the colour behind them, where the text sits and which way it reads.' },
      { sigs: ['setTableRowHeight(points: number, exact = false)', 'setHeaderRow(on: boolean)'], text: "The caret's row: its least height, or an exact one, and whether it repeats at the top of each page." },
      { sigs: ['activeCellProps() → { borders, shade, valign, direction, line?, header, height, exact } | undefined'], text: 'The cell at the caret; undefined outside a table.' },
      {
        sigs: ['inTable: boolean', 'canEditTables: boolean', 'canMergeCells: boolean', 'canSplitCell: boolean'],
        text: 'What a toolbar enables. canEditTables is false in a table a header or footer came with from its file: its cells can be written in, but its shape is kept.',
      },
    ],
  },
  {
    id: 'objects',
    title: 'Pictures, links, notes, changes',
    color: 'pink',
    members: [
      {
        sigs: ['insertImageFile(file: Blob) → Promise<boolean>', 'insertImageGrid(files: Blob[], columns: number) → Promise<number>'],
        text: 'A picture at the size it has at 96 pixels to the inch, made smaller if it does not fit; a grid resolves to how many went in.',
        nothing: 'Resolves to false for a file that is not a PNG, JPEG or GIF, or does not read as one.',
      },
      { sigs: ['insertImage(bytes: Uint8Array, type: string, width: number, height: number)'], text: 'A picture from its bytes, width by height points, made smaller if it does not fit the page.' },
      { sigs: ['setPictureWrap(wrap: PictureWrap)', 'pictureWrap: PictureWrap | undefined', 'fitSelectedPicture(fraction: number)', 'pictureSelected: boolean'], text: "How the selected picture sits in the text: 'inline', 'square', 'topBottom', 'none' (under the text) or 'behind'." },
      { sigs: ['pictureDescription: string | undefined', 'setPictureDescription(text: string)'], text: 'What the selected picture shows, for whoever cannot see it, as Word keeps it ("Alt Text"): what a screen reader says of it. An empty one takes it away.' },
      { sigs: ['setLink(address: string) → boolean', 'removeLink()', 'activeLink: { href, text } | undefined', 'openLink(href: string)'], text: 'With nothing selected, the link the caret is in goes to the new address, or the address is written as a link.', nothing: 'setLink returns false for what is not an address a link may open.' },
      {
        sigs: ['addNote(text: string) → string | undefined', 'setNoteText(id, text)', 'removeNote(id)', 'notes: NoteView[]', 'activeNote: string | undefined', 'selectNote(id) → boolean'],
        text: 'Comments, as Word has them. addNote puts one on the selected text, or on the word the caret is in, and returns its id.',
        nothing: 'addNote returns undefined outside the text of the document, or with the caret on no word.',
        run: 'note',
      },
      { sigs: ['author: string', 'noteColor: string', 'setNoteColor(id, color)'], text: 'Who the notes and changes made here are by, and the colour notes are marked with: one of NOTE_COLORS.' },
      { sigs: ['trackChanges: boolean', 'setTrackChanges(on: boolean)', 'revisions: RevisionView[]', 'hasRevisions: boolean', 'activeRevision: RevisionView | undefined'], text: "Tracked changes, as Word's (⌘⇧E / Ctrl+Shift+E).", run: 'track' },
      { sigs: ['acceptRevision(revision?) → boolean', 'rejectRevision(revision?) → boolean', 'acceptAllRevisions(author?)', 'rejectAllRevisions(author?)', 'goToRevision(dir: 1 | -1) → boolean', 'selectRevision(revision)'], nothing: 'The ones that return a boolean return false when there is no change there to take.' },
      { sigs: ["changesView: 'all' | 'accepted' | 'original'", 'setChangesView(view)'], text: 'The changes marked, or the document as it would be with all of them accepted, or with none; shown without them, it is only to be looked at.' },
    ],
  },
  {
    id: 'structure',
    title: 'Headings, columns and sections',
    color: 'orange',
    members: [
      { sigs: ['outline: OutlineItem[]', 'activeHeading: number', 'goToHeading(para: number)'], text: 'The headings, which one the caret is under (-1 before the first), and going to one.' },
      { sigs: ['moveSection(from: number, before?: number)'], text: 'Moves the section a heading opens to just before the paragraph before, or to the end.' },
      { sigs: ['insertToc()', 'updateToc() → boolean', 'hasToc: boolean', 'goToToc() → boolean'], text: 'A table of contents. Saving, exporting and printing bring it up to date by themselves.', nothing: 'insertToc when there is one already, in a table, or outside the text of the document. updateToc returns false when nothing changed.' },
      { sigs: ['columns: Columns', 'setColumns(columns: Columns)'], text: 'The columns of the caret’s section. With a selection, the selected text alone becomes a section of its own on the same page.', nothing: BODY_ONLY },
      { sigs: ['insertColumnBreak()'], text: 'What follows the caret starts at the top of the next column.', nothing: 'In a table, or in a header, footer, note or text box.' },
      { sigs: ["insertSectionBreak(start: 'nextPage' | 'continuous' = 'nextPage')"], text: 'A new section at the caret, as Word’s: what follows can have another orientation, other margins, columns or a header of its own.', nothing: 'In a table, or in a header, footer, note or text box.' },
      { sigs: ['insertTextBox(text?) → string | undefined', 'textBoxes: { id, text }[]'], text: "A text box anchored to the caret's paragraph, the text going round it. Inside it, area is 'textbox'.", nothing: 'In a header, footer, note or text box, where it returns undefined.' },
      { sigs: ['insertFootnote(text?)', 'footnotes: { id, number, text }[]'], text: "A note at the foot of the page (⌘⌥F / Ctrl+Alt+F). Inside it, area is 'footnote'.", nothing: BODY_ONLY },
    ],
  },
  {
    id: 'templates',
    title: 'Templates',
    color: 'purple',
    intro: 'Variables are written {{name}} in the text, with formats after a bar: {{amount | currency}}.',
    members: [
      { sigs: ['blocks: Block[]'], text: 'The blocks of the template, {{#name}} … {{/name}}: repeated for each item of a list, or kept only when a value is there.' },
      { sigs: ['variables: string[]'], text: 'The names of the variables in the document.', run: 'variables' },
      { sigs: ['insertVariable(name: string)', 'selectVariable(name: string) → boolean', 'activeVariable: string | undefined'], text: 'selectVariable goes to the next place it is used after the caret, into a header, a footer, a note or a text box when it is there.', nothing: 'selectVariable returns false for a variable the document does not use.' },
      { sigs: ['fillVariables(values: Record<string, string>)'], text: 'Replaces them everywhere, as one step to undo; while changes are tracked, as changes.', run: 'fill' },
      { sigs: ['variableUses(name: string) → number'], text: 'How many times one is used, headers, footers, notes and text boxes included.' },
      { sigs: ['variableNotes(name: string) → string[]'], text: 'What the notes on it say, on the variable or on a part of it: in a template, what to fill it with. The panel shows them under its box.' },
      { sigs: ['variableFormats(name: string) → ActiveFormat[]', 'setVariableFormat(name, id: FormatId, on: boolean, arg?)'], text: 'The formats every use of a variable has — capitals, bold, how a date or number is written — and giving or taking one away, as one step to undo.' },
      { sigs: ['insertSignatures(titles: string[])'], text: 'A block of signature lines.', nothing: 'Inside a table, or when canEditTables is false.' },
    ],
  },
  {
    id: 'page',
    title: 'The page',
    color: 'green',
    members: [
      { sigs: ['page: PageSetup', 'setPage(patch: Partial<PageSetup>, everywhere = false)'], text: 'Size and margins, in points, of the section being edited; with everywhere, of every section. See “Points” below.' },
      { sigs: ['sectionCount: number', 'sectionIndex: number', 'sectionPages() → PageSetup[]', 'setSectionPages(pages: PageSetup[])'], text: 'The sections, the one being edited (from 0), and the page of each.', nothing: 'setSectionPages when there are not as many pages as sections.' },
      { sigs: ['ownHeaders: boolean', 'setOwnHeaders(on: boolean)'], text: "Whether a section before the last has a header and footer of its own; without, it shows the last section's." },
      { sigs: ['pageNumbering: PageNumbering | undefined', 'setPageNumbering(numbering: PageNumbering | undefined)'] },
      { sigs: ['firstPageDifferent: boolean', 'setFirstPageDifferent(on: boolean)'], text: 'A header and footer of its own for the first page of the section.' },
      {
        sigs: ['hasLetterhead: boolean', 'letterhead: { bytes, type } | undefined', 'setLetterheadFile(file: Blob, fit = true) → Promise<boolean>', 'setLetterhead(bytes, type)', 'fitLetterheadMargins() → Promise<boolean>', 'removeLetterhead()'],
        text: 'A picture over the whole page. With fit, the top and bottom margins grow to clear what it prints there. See letterheads.',
        nothing: 'The promises resolve to false for a file that is not a picture, or when there was nothing to change.',
      },
      { sigs: ['language: string | undefined'], text: "The language the text is in, as a tag ('es-MX'), written in the DOCX it makes when the file does not say one: the interface's language, with its region, when not set." },
      { sigs: ['textLanguage: string', 'setTextLanguage(tag: string)'], text: 'The language of the text as it is used: the one a person chose at the foot of the editor (setTextLanguage, which goes into the DOCX over what the file said), else language, else the one the file says, else the interface’s when the document was opened. It does not follow the interface after that: the two are apart. A screen reader reads the text in it, and variables are written in it.' },
      { sigs: ["embedFonts: boolean | 'subset'"], text: "Whether a DOCX made here carries the fonts the application gave whose licence lets them be embedded: whole by default, cut down to the characters used with 'subset'." },
    ],
  },
  {
    id: 'finding',
    title: 'Finding',
    color: 'blue',
    members: [
      { sigs: ['find(query: string, options?: FindOptions) → number'], text: 'Marks every place it is found in the text the selection is in, and returns how many; an empty query stops the search. findStep selects them.', run: 'find' },
      { sigs: ['findStep(dir: 1 | -1) → boolean', 'findCount: number', 'findIndex: number'], text: 'To the next or previous one, going round at the ends; how many there are, and which is selected, from 1.', nothing: 'findStep returns false when nothing was found.', run: 'next' },
      { sigs: ['replaceFound(text: string) → boolean', 'replaceAllFound(text: string) → number'], text: 'The selected one, then on to the next; or all of them as one step to undo, returning how many.', nothing: 'replaceFound returns false, and only goes to the next, when none is selected.', run: 'replace' },
    ],
  },
  {
    id: 'spelling',
    title: 'Spelling',
    color: 'green',
    intro: 'Words are asked about only on the pages near the view, a moment after typing stops, in the language of the text. See spelling.',
    members: [
      { sigs: ['spellChecker: SpellChecker | undefined'], text: 'What says which words are spelled wrong: createSpellChecker({ dictionaries }), or one of your own with check and suggest. None, and nothing is marked.' },
      { sigs: ['misspelling: { word, range } | undefined'], text: 'The word spelled wrong the caret is in, or at the end of; undefined while the dictionary has not said.' },
      { sigs: ['spellingSuggestions() → Promise<string[]>'], text: 'What that word could be instead, the likeliest first.' },
      { sigs: ['replaceMisspelling(text: string)'], text: 'Puts text in its place, as any edit: undone with ⌘Z, tracked when changes are.' },
      { sigs: ['ignoreMisspelling()', 'addMisspelling()', 'canAddWords: boolean'], text: 'Leaves the word, and every one like it, unmarked in this document; or gives it to the dictionary, when it takes new words.' },
      { sigs: ['onSpellingMenu: (() => void) | undefined'], text: 'Called when a word with the wave is pressed with the other button or tapped: the caret is in it, for a bar to offer its suggestions.' },
    ],
  },
  {
    id: 'view',
    title: 'The view',
    color: 'yellow',
    intro: 'The view is the editor’s, not the document’s: it is not saved in the file.',
    members: [
      { sigs: ['zoom: number', 'setZoom(zoom: number)'], text: '0.25 to 4. At 1, a point is 4/3 of a CSS pixel. setZoom stops fit.', run: 'zoom' },
      { sigs: ['fit: ZoomFit | undefined', "setFit(fit: 'width' | 'page')"], text: 'A zoom that follows the size of the window.' },
      { sigs: ['view: ViewMode', "setView(view: 'column' | 'spread' | 'grid' | 'flow')"], text: 'One page, two across, a grid, or text as wide as the window.', run: 'flow' },
      { sigs: ['showNotes: boolean', 'setShowNotes(on: boolean)'], text: 'Comments in a margin beside the pages.' },
      { sigs: ['focus()'], text: 'Gives the keyboard to the document.' },
      { sigs: ["theme: 'light' | 'dark' | 'auto'"], text: 'The colours of the interface around the pages, and of the bars and menus made for this editor, also those shown outside it. The pages stay white.' },
      { sigs: ['screenReader: boolean'], text: 'Screen reader mode: the hidden field holds the caret’s paragraph. Off by default; ⌘⌥Z (Ctrl+Alt+Z) turns it on and off.' },
      { sigs: ['announce(text: string, urgent = false)'], text: 'Says text to a screen reader, through the editor’s live region.' },
      { sigs: ['element: HTMLElement'], text: 'The element the pages scroll in.' },
      { sigs: ['destroy()'], text: 'Takes everything away.' },
    ],
  },
  {
    id: 'interface',
    title: 'For your own interface',
    color: 'pink',
    intro: 'What a bar beside the selection, a menu or a touch interface of your own needs.',
    members: [
      { sigs: ['selectionBounds() → DOMRect | undefined'], text: 'Where the selection is in the window: the selected text or picture, or the caret.' },
      { sigs: ['pageBounds(page?: number) → DOMRect'], text: 'Where a page is in the window, at the size the zoom shows it; the caret’s unless another is asked for.' },
      { sigs: ['textColumn() → { left, right }'], text: 'The edges, in points from the left of the page, of the column the caret’s paragraph is set in: the margins, or the inside of its table cell.' },
      { sigs: ['paragraphEmpty: boolean'], text: 'True when the caret is in a paragraph with nothing in it.' },
      { sigs: ['onLinkKey: (() => void) | undefined'], text: 'What ⌘K does, when given: asking for the address of a link is for whoever shows the editor.' },
      { sigs: ['byTouch: boolean', 'onTouchSelect: (() => void) | undefined'], text: 'True from a touch until the mouse is used; called when a selection was made by touch.' },
      { sigs: ['pagesOf(doc: Doc) → (para: number) => number'], text: 'The page each paragraph of a document would start on, from 1, laid out as this editor lays out.' },
    ],
  },
];

/** Every name the reference has, for the search of the site. */
export const MEMBER_NAMES = GROUPS.flatMap((group) => group.members.flatMap((member) => member.sigs.map((sig) => ({ name: nameOf(sig), row: memberHash(member.sigs[0]), group: group.title }))));

export interface TypeDoc {
  name: string;
  from: string;
  text: string;
  fields: [name: string, type: string, text?: string][];
}

/** The types the methods take, as packages/core/src defines them. A field is optional where its name ends in `?`. */
export const TYPES: TypeDoc[] = [
  {
    name: 'Position',
    from: 'model.ts',
    text: 'A place in the text being edited. Range is { from, to }, in order.',
    fields: [
      ['para', 'number', 'Index of the paragraph, from 0.'],
      ['offset', 'number', 'Index of the character in it, from 0.'],
    ],
  },
  {
    name: 'RunProps',
    from: 'model.ts',
    text: 'The formatting of characters. A patch sets only the fields it has.',
    fields: [
      ['bold?, italic?, underline?, strike?', 'boolean'],
      ['fontSize?', 'number', 'In points.'],
      ['fontFamily?', 'string'],
      ['color?', 'string', "Hex RGB without '#': 'C0392B'."],
      ['highlight?', 'string', "Hex RGB without '#'. Word has only the colours of HIGHLIGHT_COLORS."],
    ],
  },
  {
    name: 'ParagraphProps',
    from: 'model.ts',
    text: 'The formatting of paragraphs. Lengths in points.',
    fields: [
      ['align?', "'left' | 'center' | 'right' | 'justify'"],
      ['spacingBefore?, spacingAfter?', 'number'],
      ['lineHeight?', 'number', 'A multiplier over the natural height of the line: 1.15, 2.'],
      ['indentLeft?, indentRight?', 'number'],
      ['indentFirstLine?', 'number', 'Added to indentLeft on the first line; negative for a hanging indent.'],
      ['pageBreakBefore?, keepNext?, keepLines?', 'boolean'],
      ['widowControl?', 'boolean', 'On unless switched off, as in Word.'],
      ['styleId?', 'string', 'Better set with setParagraphStyle.'],
      ['tabs?', 'TabStop[]', "{ pos, align: 'left' | 'center' | 'right' | 'decimal' | 'bar', leader? }."],
    ],
  },
  {
    name: 'PageSetup',
    from: 'model.ts',
    text: 'The page of a section, in points. A new document is Letter with 1-inch margins.',
    fields: [
      ['width, height', 'number', 'Landscape is a width larger than the height.'],
      ['marginTop, marginRight, marginBottom, marginLeft', 'number'],
      ['headerDistance?, footerDistance?', 'number', 'From the edge of the page to the header, and to the footer.'],
    ],
  },
  {
    name: 'Columns',
    from: 'model.ts',
    text: 'How the text of a section is set in columns, as in a newspaper.',
    fields: [
      ['count', 'number', '1 when the text runs the whole width.'],
      ['space', 'number', 'Room between two columns, in points.'],
      ['widths?', '{ width, space }[]', 'When they are not all as wide.'],
      ['separator?', 'boolean', 'A line down the middle of the room between two.'],
    ],
  },
  {
    name: 'CellPatch',
    from: 'tables.ts',
    text: 'What can be set on the cells the selection covers.',
    fields: [
      ['borders?', 'boolean'],
      ['line?', 'Border | null', "{ width, color, style: 'single' | 'double' | 'dashed' | 'dotted' }; null for the plain line."],
      ['shade?', 'string', "The colour behind, hex RGB without '#'."],
      ['valign?', "'top' | 'center' | 'bottom'"],
      ['direction?', "'level' | 'up' | 'down'", 'Which way the text reads.'],
    ],
  },
  {
    name: 'ListStyle',
    from: 'ops.ts',
    text: "How the labels of a list level are written, with # where the number goes: { format: 'lowerLetter', text: '#.-' } is “a.-”.",
    fields: [
      ['format', "'decimal' | 'decimalZero' | 'lowerLetter' | 'upperLetter' | 'lowerRoman' | 'upperRoman' | 'bullet' | 'none'"],
      ['text', 'string', "The label around #, or a bullet's character: '–'."],
    ],
  },
  {
    name: 'PageNumbering',
    from: 'pageNumbers.ts',
    text: 'A page number in the header or the footer.',
    fields: [
      ['place', "'header' | 'footer'"],
      ['align', "'left' | 'center' | 'right'"],
      ['format', "'number' | 'numberOfTotal' | 'page' | 'pageOfTotal'", '“3”, “3 / 9”, “Page 3”, “Page 3 of 9”.'],
      ['words?', '{ page, of }', 'The word before the number and the one before the total. setPageNumbering gives those of the editor’s language unless these are given.'],
    ],
  },
  {
    name: 'FindOptions',
    from: 'find.ts',
    text: 'How find looks.',
    fields: [
      ['matchCase?', 'boolean', 'Capitals and small letters count as different.'],
      ['wholeWord?', 'boolean', 'Only matches that are not part of a longer word.'],
    ],
  },
];

/** Paper sizes in points, as Word has them. */
export const PAPERS: [name: string, width: number, height: number][] = [
  ['Letter', 612, 792],
  ['A4', 595.3, 841.9],
  ['Legal', 612, 1008],
  ['A5', 419.5, 595.3],
];

/** Points in one of each unit. The editor shows a point as 4/3 of a CSS pixel at zoom 1, so a pixel is 3/4 of a point. */
export const UNIT_POINTS = { pt: 1, in: 72, cm: 72 / 2.54, mm: 72 / 25.4, px: 0.75 } as const;
export type Unit = keyof typeof UNIT_POINTS;
