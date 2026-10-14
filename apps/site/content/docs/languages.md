# Languages

The interface comes in Spanish and English. Every text a person reads is looked up by a key, so another language is a file of translations, added without touching the editor.

```tsx
<DocsEditor locale="en" />
```

`locale` takes a code or a browser tag (`'en-US'`, `'es_MX'`). A language the interface does not speak falls back to English.

## Adding a language

**1. Start the file.** It is written with every text in English, to translate:

```bash
npm run locale -- fr texts/fr.json
npm run locale -- fr texts/fr.json --from es     # or starting from the Spanish
```

**2. Translate it.** It is plain JSON, a key and a text. Leave what is in braces as it is:

```json
{
  "locale.name": "Français",
  "menu.save": "Enregistrer",
  "status.page": "Page {page} sur {pages}"
}
```

**3. Give it to the editor:**

```tsx
import fr from './texts/fr.json';

<DocsEditor locales={{ fr }} locale="fr" />
```

```ts
import { addLocale, setLocale } from '@rebodocs/react';   // without the component

addLocale('fr', fr);
setLocale('fr');
```

The language appears in the menu by itself (with `features.language`), under its own name. That name is `locale.name`, or what the browser calls the language if you leave it out.

## Keeping it up to date

When the interface gains texts, run the same command on the same file:

```bash
npm run locale -- fr texts/fr.json
# texts/fr.json: 342 texts, 6 new.
# To translate (same as English): 6.
```

It keeps what is translated, adds what is new in English, takes out what no longer exists, and says how much is left. A text left out of a language is shown in English, so a partial translation works.

## Changing words of a language there is

```ts
addLocale('en', { 'menu.save': 'Save to cloud' });
```

## What is translated

- **The interface:** everything.
- **The document:** nothing. It is the person's.
- **What the editor writes into the document** is in the language of the interface at the time: "Page 1 of 3" in a page number, the titles of a signature block.
- **Standard styles** are shown translated (Heading 1 / Título 1); a document's own keep their names. `useDocsStyles` gives them that way too, and again when the language changes.

## Your own interface

An interface built on the [headless hooks](/docs/headless/) has labels of its own, which the library knows nothing of. To have them follow the same language, keep them in a table and read the language of the editor where they are drawn:

```tsx
import { useSyncExternalStore } from 'react';
import { getLocale, onLocaleChange } from '@rebodocs/react';

const EN = { Guardar: 'Save', Imprimir: 'Print' } as const;

/** A component that calls this is drawn again when the language changes. */
export function useTexts() {
  const locale = useSyncExternalStore(onLocaleChange, getLocale);
  return (text: keyof typeof EN) => (locale === 'es' ? text : EN[text]);
}

function Save() {
  const tr = useTexts();
  return <button>{tr('Guardar')}</button>;
}
```

Where the library already has the word, `t('menu.save')` gives it; it needs the same hook around it, to be drawn again. A selector of your own is `setLocale('en')`.

[The demo](/docs/demos/#the-react-package) does this for every label it has, in `apps/demo/src/headless/texts.ts`.

## From code

```ts
import { t, messages, locales, getLocale, onLocaleChange } from '@rebodocs/react';

t('status.page', { page: 2, pages: 9 });   // "Page 2 of 9"
messages('en');                            // every text of a language, by key
locales();                                 // [{ code: 'es', name: 'Español' }, …]
```

> The interface was written in Spanish first. The English texts were translated and are waiting for a native review.
