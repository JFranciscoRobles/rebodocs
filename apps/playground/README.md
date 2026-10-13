# Playground

The application every package is tried in: the editor with all its interface
pieces, opening and saving files of the disk, sharing a document, and the
button that lets an AI assistant in.

```bash
npm run dev      # http://localhost:5173
npm run build    # apps/playground/dist
```

It is not a product. It is the smallest page that wires everything together,
and so the best place to read how the pieces fit: `src/main.ts`.

From the browser console, `window.editor` is the `Editor`, and `addFont` and
`addLocale` are there to try a font or a language out:

```js
await addFont({ family: 'Raleway', src: '/Raleway-Regular.ttf' });
addLocale('fr', { 'menu.save': 'Enregistrer' }); changeLocale('fr');
```

A document is shared with `?room=<id>&collab=<server>` in the address, once
the collaboration server is running (`npm run collab`).
