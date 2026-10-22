# Playground

The application every package is tried in: the editor with all its interface
pieces, opening and saving files of the disk, sharing a document, and the
button that lets an AI assistant in (the MCP server of this machine,
`npm run mcp`). For Claude in a chat of the page instead, see
`apps/assistant`.

```bash
npm run dev      # http://localhost:5173
npm run build    # apps/playground/dist
```

It is not a product. It is the smallest page that wires everything together,
and so the best place to read how the pieces fit: `src/main.ts`.

The document it opens is a short tour of what the editor does, followed by
a lease of about a hundred pages: a long document to scroll and type in, as
fast as a short one, since only the pages near the view have their text.
Spelling is on, with the Spanish and English Hunspell dictionaries read from
a CDN; the **Appearance** part of the menu ☰ turns the interface dark, and
`?theme=dark` (or `auto`) opens it that way.

From the browser console, `window.editor` is the `Editor`, and `addFont` and
`addLocale` are there to try a font or a language out:

```js
await addFont({ family: 'Raleway', src: '/Raleway-Regular.ttf' });
addLocale('fr', { 'menu.save': 'Enregistrer' }); changeLocale('fr');
```

**Focus mode** (the button at the end of the bar at the bottom, or ⌘⇧.)
leaves the pages alone, full screen; Esc comes back. The lists have their
styles in the arrow beside each button: 1.-, a), i., bullets, and the levels.

The **Versions** tab of the side panel keeps versions in the page while it
is open, and compares and restores them; an application would keep them
beside its documents. Opening another file starts over.

A document is shared with `?room=<id>&collab=<server>` in the address, once
the collaboration server is running (`npm run collab`).
