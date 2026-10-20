# CRM demo

The editor inside a CRM: the documents of a property are made from a
template with the data of its record, opened and edited in its page, saved
on their own, with versions, review and an assistant. Nothing is downloaded,
and no other program is opened. A made-up real-estate CRM, in Spanish, in the
look of a presentation: a deep green, toned whites and Inter.

```bash
npm run crm        # from the root: http://localhost:5180
```

Nothing to set up. For the assistant, put a key of the Claude API in
`apps/crm/.env` (`cp apps/crm/.env.example apps/crm/.env`); without one it
says so, and the rest works.

## What to try

1. **Propiedades → a property.** Its record (**Ficha**) can be changed: the
   price, the commission, the owner.
2. **Documentos → Generar contrato de mediación.** The template is filled with
   what the record says, and opens in the page. That is its first version,
   "Generado desde la ficha".
3. **Write in it.** A moment after each change it is saved on its own: the bar
   says *Guardando…* and then *Guardado*.
4. **Change who you are**, top right, to *Luis Mena · Jurídico*, turn on
   **Revisar → Control de cambios**, and change something: it stays marked
   with his name until someone accepts or rejects it. Notes are signed too.
5. **Back to Documentos.** Leaving a document keeps a version of the work
   done, under the name of who did it. The **Versiones** tab of the side panel
   lists them, compares two word by word, and goes back to one.
6. **Asistente.** Ask it to change the term of the offers to 72 hours, or to
   review the contract and leave notes. What it changes is a step to undo and,
   with tracked changes on, is marked for someone to approve.

## What is where

| File | What it is |
| --- | --- |
| `src/App.tsx` | The CRM: its menu, the properties, the page of each with its tabs. |
| `src/data.ts` | The properties and the team, made up, and `templateValues`: what the record gives each variable of the template. |
| `src/template.ts` | The contract, as a template with `{{variables}}`. A CRM of its own keeps its templates as .docx made in Word. |
| `src/Documents.tsx` | The documents of a property, and the button that fills the template. |
| `src/DocumentView.tsx` | A document open: `DocsEditor`, saved a moment after each change (`save()`), and a version kept on leaving. |
| `src/store.ts` | Where the documents and their versions are kept: IndexedDB, in the browser. |
| `src/Chat.tsx` | The assistant, on `createAssistantChat`. |
| `server/assistant.ts` | The one route of the backend: the way to Claude, with the key. |

## In a CRM of your own

- **`src/store.ts` is the only file that changes**: its functions become calls
  to your backend, which keeps the .docx in your storage (a bucket, as in
  `apps/storage`) and checks who may open what. The page does not change.
- **The templates** are .docx files made in Word: `importDocx` opens one, and
  `fillVariables` fills it with the record, as `Documents.tsx` does.
- **The assistant** checks your session in `assistantRoute({ allow })`.
- **Several people at once** is the real-time demo, `apps/realtime`: give
  `DocsEditor` a `collab` and each document is a room. This demo is one
  person at a time.
- **The look** is yours: this one is the CSS of `src/App.css`; the editor's
  own bars keep theirs, and `--dx-canvas` colours what is behind the pages.
