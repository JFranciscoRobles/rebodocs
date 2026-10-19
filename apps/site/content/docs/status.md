# Status and roadmap

Rebodocs is a word processor compatible with Word files. It is not a copy of Word and is not meant to become one. It is working software that has not been used in production yet. This page says what has been checked and how, and what is missing, without rounding up.

## What is checked

**388 automated tests**, over the engine, the collaboration change format and session, the texts of the interface, the tools for an assistant and its chat (against a Claude of the tests' own), and the backends of the storage and real-time demos: a bucket kept in memory, and two people typing through the three routes.

**Compatibility of layout.** Real documents are compared line by line with the PDF Word exports from the same file. On the receipt used as reference, every line is within 0.4 pt of Word's. The comparison is a command, `npm run word-compare -- file.docx`, so any document can be measured.

**Round trip.** A set of 18 documents opens and saves without losing pictures or structure. Word opens what is exported without warnings.

**The interface**, in headless Chrome with real clicks, keys and touches:

- the toolbar, tables, header and footer, page numbers, letterhead;
- collaboration between two tabs: typing at once, undo per person, tables, reconnection;
- the React component in a Next.js 16 application with Tailwind 4: server rendering, saving, features, headless hooks;
- a phone-sized screen with touch: pinch, selection handles, composed input.

Touch input was also tried on a real phone.

**A real bucket.** The backend of the [storage demo](/docs/storage/) was run by hand, from Node, against Cloudflare R2: listing, reading and writing with signed addresses, the origin rule, the PDF made on the server, and coming into a room whose document is in the bucket.

## What is not

- **Collaboration between networks.** It ran with two tabs and on a local network. Different networks, an HTTPS proxy, and two browsers typing over a real bucket are untried.
- **The demos in a browser.** The storage and real-time demos were checked through their backends and their tests, not by clicking through their pages.
- **Many documents.** The pagination rules were derived from a few files in Arial with Word for Mac. Other fonts and versions of Word may differ.
- **Many phones.** One real device. Keyboards differ.
- **Claude in the editor with a real key.** The chat and its route were tested against a Claude of the tests' own and the page was opened without a key; a conversation with the real API has not been tried in the repository.
- **Production.** Nobody has depended on it yet.

## Known limits

**The format**

- Endnotes are not laid out. They survive a round trip.
- Text boxes are drawn as rectangles with a plain fill and line, not turned; one too small for its text loses whole lines where Word cuts one in half. Those only in VML, from old files, are kept but not shown.
- Tracked changes of formatting and of table rows are kept but not shown or settled; changes to a table's shape are not tracked (see [tracked changes](/docs/tracked-changes/)).
- Footnotes of a section in columns go across the whole page, and a reference in a table cell does not make room for its note.
- Comparing versions covers the text and its look, not the page, the sections, style definitions or the size of pictures. A change of look is listed but not marked.
- No right-to-left text, and no scripts that need shaping.
- No hyphenation.

**Output**

- PDF embeds TrueType and OpenType fonts; OpenType ones in CFF go whole. No tagged (accessible) PDF, no links or outline in it.
- Fonts given by an application go into the DOCX whole, and only TrueType ones.

**The editor**

- No rich paste: pasting keeps the text only. No drag and drop of text. No spell check.
- The pages are not accessible to screen readers.
- Every page is in the DOM, so very long documents get slow.
- The included interface is light only.

**Templates**

- Date and currency formats write Spanish month names and `$`. The editor writes format names in Spanish.

**Collaboration**

- One server process holds a room.
- Access is checked on joining only.
- Two people cutting, joining and taking out paragraphs around the same place at the same instant can, rarely, end with different documents for a moment: the server's check finds it within a couple of seconds and the editor loads the room again, keeping what was typed, but what can be undone starts over (see [collaboration](/docs/collaboration/#when-two-people-change-the-same-thing)).
- A hard crash loses up to 30 seconds. The server keeps no versions: the application does, and the editor compares and restores them (see [versions](/docs/versions/)).

**Packaging**

- Every package is on npm. `@rebodocs/react` has the engine inside; an application that also installs `@rebodocs/core` carries the engine twice.
- The English interface texts need a native review.

## Roadmap

In rough order of how much each would matter.

1. **Use it in a real application**, and fix what that shows.
2. **Browser tests in the repository.** The interface checks exist as scripts outside it; they belong in a test suite, and the demos have none.
3. **Collaboration that scales**: several server processes per room, access checked while connected, a durable log.
4. **Templates by locale**: dates and currency in the language and currency you choose.
5. **Accessibility**: a readable mirror of the text for screen readers, and keyboard access to every menu.
6. **Rich paste** from Word and the web.

## Contributing

The repository's `CONTRIBUTING.md` says how to set up and what the conventions are. Each package's README ends with a list of where it can improve: good places to start.

## License

MIT. Anyone may use it for anything.
