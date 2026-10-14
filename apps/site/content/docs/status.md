# Status and roadmap

Rebodocs is a word processor compatible with Word files. It is not a copy of Word and is not meant to become one. It is working software that has not been used in production yet. This page says what has been checked and how, and what is missing, without rounding up.

## What is checked

**275 automated tests**, over the engine, the collaboration change format and session, the texts of the interface, and the backends of the two demos that have one: a bucket kept in memory, and two people typing through the three routes.

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
- **Production.** Nobody has depended on it yet.

## Known limits

**The format**

- No sections with their own page setup, no columns, footnotes, text boxes or tracked changes. They survive a round trip, and are shown as plain text where they can be.
- Tables: row height cannot be edited, header rows do not repeat on the next page, borders are all or nothing per cell.
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

- Only `@rebodocs/react` is [on npm](https://www.npmjs.com/package/@rebodocs/react), as a bundle with the engine and the editor inside. The others are used as source inside the repository.
- The English interface texts need a native review.

## Roadmap

In rough order of how much each would matter.

1. **Use it in a real application**, and fix what that shows.
2. **Publish the other packages to npm**, each built with its types, so that the engine can be installed by itself on a server.
3. **Browser tests in the repository.** The interface checks exist as scripts outside it; they belong in a test suite, and the demos have none.
4. **Collaboration that scales**: several server processes per room, access checked while connected, a durable log.
5. **Templates by locale**: dates and currency in the language and currency you choose.
6. **Layout**: sections, footnotes, repeated table header rows.
7. **Accessibility**: a readable mirror of the text for screen readers, and keyboard access to every menu.
8. **Rich paste** from Word and the web.

## Contributing

The repository's `CONTRIBUTING.md` says how to set up and what the conventions are. Each package's README ends with a list of where it can improve: good places to start.

## License

MIT. Anyone may use it for anything.
