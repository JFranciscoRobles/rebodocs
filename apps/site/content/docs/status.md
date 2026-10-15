# Status and roadmap

Rebodocs is a word processor compatible with Word files. It is not a copy of Word and is not meant to become one. It is working software that has not been used in production yet. This page says what has been checked and how, and what is missing, without rounding up.

## What is checked

**312 automated tests**, over the engine, the collaboration change format and session, the texts of the interface, the tools for an assistant and its chat (against a Claude of the tests' own), and the backends of the storage and real-time demos: a bucket kept in memory, and two people typing through the three routes.

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

- Sections and columns are laid out, but every page has the size and the header of the last section, and the page setup changes only that one.
- No footnotes, text boxes or tracked changes. They survive a round trip, and are shown as plain text where they can be.
- Tables: tab stops in cells (decimal ones among them) and vertical text are not laid out; a table inside a cell does not break across pages.
- No right-to-left text, and no scripts that need shaping.
- No hyphenation.

**Output**

- PDF embeds TrueType fonts only. No tagged (accessible) PDF, no links or outline in it.
- Fonts given by an application are not embedded in the DOCX.

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
- A hard crash loses up to 30 seconds. No version history.

**Packaging**

- `@rebodocs/react` and `@rebodocs/mcp` are on npm, each a bundle with the engine inside. The others are used as source inside the repository.
- The English interface texts need a native review.

## Roadmap

In rough order of how much each would matter.

1. **Use it in a real application**, and fix what that shows.
2. **Publish the engine and collaboration to npm**, each built with its types, so that the engine can be installed by itself on a server.
3. **Browser tests in the repository.** The interface checks exist as scripts outside it; they belong in a test suite, and the demos have none.
4. **Collaboration that scales**: several server processes per room, access checked while connected, a durable log.
5. **Templates by locale**: dates and currency in the language and currency you choose.
6. **Layout**: a page size and a header per section, tab stops in tables, footnotes.
7. **Accessibility**: a readable mirror of the text for screen readers, and keyboard access to every menu.
8. **Rich paste** from Word and the web.

## Contributing

The repository's `CONTRIBUTING.md` says how to set up and what the conventions are. Each package's README ends with a list of where it can improve: good places to start.

## License

MIT. Anyone may use it for anything.
